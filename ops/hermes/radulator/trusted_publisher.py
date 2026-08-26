#!/usr/bin/env python3
"""Publish dispatcher-sealed Radulator commits without an AI credential path."""

from __future__ import annotations

import argparse
import contextlib
import dataclasses
import fcntl
import json
import os
import re
import stat
import subprocess
import sys
from pathlib import Path, PurePosixPath
from typing import Any


CONTRACT = "hermes.trusted_local_commit.v1"
BLOCKED_MARKER = "AWAITING_TRUSTED_PUBLISHER v1"
SHA_PATTERN = re.compile(r"^[0-9a-f]{40}$")
TASK_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
MAX_CHANGED_PATHS = 5000
MAX_PATH_LENGTH = 512
REQUIRED_CONTRACT_KEYS = frozenset(
    {
        "contract",
        "task_id",
        "project_id",
        "board",
        "workspace",
        "branch",
        "base_sha",
        "head_sha",
        "changed_paths",
        "publisher_state",
    }
)
OPTIONAL_CONTRACT_KEYS = frozenset({"recovered_from_run_id"})


@dataclasses.dataclass(frozen=True)
class TrustedCommit:
    task_id: str
    project_id: str | None
    board: str
    workspace: str
    branch: str
    base_sha: str
    head_sha: str
    changed_paths: tuple[str, ...]
    run_id: int
    recovered_from_run_id: int | None = None


@dataclasses.dataclass(frozen=True)
class PublisherConfig:
    board: str
    project_id: str | None
    project_root: Path
    repository: str
    base_branch: str
    expected_origin: str
    lifecycle_controller: Path
    ledger_path: Path | None = None
    required_checks: tuple[str, ...] = (
        "Smoke Tests",
        "Targeted Calculator Tests",
        "Hermes Release Control Tests",
    )
    required_check_app_id: int = 15368


class PublisherError(RuntimeError):
    pass


class PublisherPending(PublisherError):
    pass


@dataclasses.dataclass(frozen=True)
class PublishedPullRequest:
    number: int
    url: str
    state: str
    branch: str
    head_sha: str
    base: str
    head_repository_owner: str
    is_cross_repository: bool
    labels: tuple[str, ...]

    @classmethod
    def from_dict(cls, value: Any) -> "PublishedPullRequest":
        if not isinstance(value, dict):
            raise PublisherError("pull request readback is not an object")
        labels_raw = value.get("labels", [])
        if not isinstance(labels_raw, list):
            raise PublisherError("pull request labels readback is malformed")
        labels: list[str] = []
        for item in labels_raw:
            if isinstance(item, dict) and isinstance(item.get("name"), str):
                labels.append(item["name"])
            elif isinstance(item, str):
                labels.append(item)
            else:
                raise PublisherError("pull request labels readback is malformed")
        number = value.get("number")
        owner = value.get("headRepositoryOwner")
        owner_login = owner.get("login") if isinstance(owner, dict) else None
        is_cross_repository = value.get("isCrossRepository")
        fields = {
            "url": value.get("url"),
            "state": value.get("state"),
            "branch": value.get("headRefName"),
            "head_sha": value.get("headRefOid"),
            "base": value.get("baseRefName"),
        }
        if (
            not _positive_int(number)
            or not all(isinstance(item, str) and item for item in fields.values())
            or not isinstance(owner_login, str)
            or not owner_login
            or type(is_cross_repository) is not bool
        ):
            raise PublisherError("pull request readback identity is malformed")
        return cls(
            number=number,
            head_repository_owner=owner_login,
            is_cross_repository=is_cross_repository,
            labels=tuple(sorted(set(labels))),
            **fields,
        )


def _positive_int(value: Any) -> bool:
    return type(value) is int and value > 0


def _has_exact_pr_reference(text: str, number: int) -> bool:
    return bool(re.search(rf"(?<!\d)PR\s+#{number}(?!\d)", text))


def _has_exact_sha_reference(text: str, sha: str) -> bool:
    return bool(re.search(rf"(?<![0-9a-f]){re.escape(sha)}(?![0-9a-f])", text))


def _safe_changed_paths(value: Any) -> tuple[str, ...] | None:
    if not isinstance(value, list) or not value or len(value) > MAX_CHANGED_PATHS:
        return None
    if not all(isinstance(item, str) for item in value):
        return None
    if value != sorted(value) or len(value) != len(set(value)):
        return None
    for item in value:
        path = PurePosixPath(item)
        if (
            not item
            or len(item) > MAX_PATH_LENGTH
            or "\\" in item
            or path.is_absolute()
            or item != path.as_posix()
            or any(part in {"", ".", ".."} for part in path.parts)
        ):
            return None
    return tuple(value)


def _parse_contract(payload: Any, *, run_id: Any) -> TrustedCommit | None:
    if not isinstance(payload, dict) or not _positive_int(run_id):
        return None
    keys = frozenset(payload)
    if not REQUIRED_CONTRACT_KEYS.issubset(keys):
        return None
    if keys - REQUIRED_CONTRACT_KEYS - OPTIONAL_CONTRACT_KEYS:
        return None
    recovered = payload.get("recovered_from_run_id")
    if recovered is not None and not _positive_int(recovered):
        return None
    task_id = payload.get("task_id")
    project_id = payload.get("project_id")
    board = payload.get("board")
    workspace = payload.get("workspace")
    branch = payload.get("branch")
    base_sha = payload.get("base_sha")
    head_sha = payload.get("head_sha")
    changed_paths = _safe_changed_paths(payload.get("changed_paths"))
    if (
        payload.get("contract") != CONTRACT
        or payload.get("publisher_state") != "awaiting"
        or not isinstance(task_id, str)
        or not TASK_ID_PATTERN.fullmatch(task_id)
        or (
            project_id is not None
            and (
                not isinstance(project_id, str)
                or not TASK_ID_PATTERN.fullmatch(project_id)
            )
        )
        or not isinstance(board, str)
        or not TASK_ID_PATTERN.fullmatch(board)
        or not isinstance(workspace, str)
        or not workspace.startswith("/")
        or not isinstance(branch, str)
        or not branch
        or not isinstance(base_sha, str)
        or not SHA_PATTERN.fullmatch(base_sha)
        or not isinstance(head_sha, str)
        or not SHA_PATTERN.fullmatch(head_sha)
        or head_sha == base_sha
        or changed_paths is None
    ):
        return None
    return TrustedCommit(
        task_id=task_id,
        project_id=project_id,
        board=board,
        workspace=workspace,
        branch=branch,
        base_sha=base_sha,
        head_sha=head_sha,
        changed_paths=changed_paths,
        run_id=run_id,
        recovered_from_run_id=recovered,
    )


def _candidate_for_task(kb: Any, conn: Any, task: Any, board: str) -> TrustedCommit | None:
    if getattr(task, "status", None) != "blocked":
        return None
    task_id = getattr(task, "id", None)
    if not isinstance(task_id, str) or not TASK_ID_PATTERN.fullmatch(task_id):
        return None
    events = kb.list_events(conn, task_id)
    trusted = sorted(
        (
            item
            for item in events
            if getattr(item, "kind", None) == "trusted_local_commit"
            and _positive_int(getattr(item, "id", None))
        ),
        key=lambda item: item.id,
    )
    blocked = sorted(
        (
            item
            for item in events
            if getattr(item, "kind", None) == "blocked"
            and _positive_int(getattr(item, "id", None))
        ),
        key=lambda item: item.id,
    )
    if not trusted or not blocked:
        return None
    trusted_event = trusted[-1]
    blocked_event = blocked[-1]
    blocked_payload = getattr(blocked_event, "payload", None)
    if (
        getattr(trusted_event, "task_id", None) != task_id
        or getattr(blocked_event, "task_id", None) != task_id
        or not isinstance(blocked_payload, dict)
        or blocked_payload.get("reason") != BLOCKED_MARKER
        or blocked_payload.get("kind") != "capability"
        or getattr(trusted_event, "run_id", None) != getattr(blocked_event, "run_id", None)
        or trusted_event.id >= blocked_event.id
    ):
        return None
    candidate = _parse_contract(
        getattr(trusted_event, "payload", None),
        run_id=getattr(trusted_event, "run_id", None),
    )
    if candidate is None:
        return None
    if (
        candidate.task_id != task_id
        or candidate.board != board
        or candidate.project_id != getattr(task, "project_id", None)
        or candidate.workspace != getattr(task, "workspace_path", None)
        or candidate.branch != getattr(task, "branch_name", None)
    ):
        return None
    return candidate


def select_candidate(kb: Any, conn: Any, board: str) -> TrustedCommit | None:
    """Return at most the oldest exact sealed publisher obligation."""
    tasks = kb.list_tasks(
        conn,
        status="blocked",
        include_archived=False,
        order_by="created",
    )
    for task in sorted(tasks, key=lambda item: (getattr(item, "created_at", 0), getattr(item, "id", ""))):
        candidate = _candidate_for_task(kb, conn, task, board)
        if candidate is not None:
            return candidate
    return None


def _minimal_env() -> dict[str, str]:
    allowed = ("HOME", "LANG", "LC_ALL", "PATH", "TMPDIR")
    env = {key: os.environ[key] for key in allowed if key in os.environ}
    env.update({
        "GIT_TERMINAL_PROMPT": "0",
        "GIT_CONFIG_NOSYSTEM": "1",
    })
    return env


def _run(
    args: list[str],
    *,
    cwd: Path,
    runner: Any = subprocess.run,
    check: bool = True,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess:
    result = runner(
        args,
        cwd=str(cwd),
        env=env or _minimal_env(),
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )
    if check and result.returncode != 0:
        detail = (result.stderr or result.stdout or "no output").strip()[:300]
        raise PublisherError(f"command failed ({' '.join(args[:3])}): {detail}")
    return result


def _git(
    workspace: Path,
    *args: str,
    runner: Any = subprocess.run,
    check: bool = True,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess:
    return _run(
        [
            "git",
            "-c",
            "core.hooksPath=/dev/null",
            "-c",
            "credential.helper=",
            *args,
        ],
        cwd=workspace,
        runner=runner,
        check=check,
        env=env,
    )


def _canonical_existing_path(raw: str, label: str) -> Path:
    supplied = Path(raw)
    if not supplied.is_absolute():
        raise PublisherError(f"{label} must be absolute")
    absolute = supplied.absolute()
    try:
        resolved = supplied.resolve(strict=True)
    except OSError as error:
        raise PublisherError(f"{label} does not exist") from error
    if resolved != absolute:
        raise PublisherError(f"{label} must use its canonical path")
    return resolved


def _worktree_records(text: str) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    current: dict[str, str] = {}
    for line in text.splitlines():
        if not line:
            if current:
                records.append(current)
                current = {}
            continue
        key, _, value = line.partition(" ")
        current[key] = value
    if current:
        records.append(current)
    return records


def _dangerous_local_git_config(workspace: Path, runner: Any) -> list[str]:
    exact_keys = (
        "core.hookspath",
        "core.askpass",
        "core.sshcommand",
        "credential.helper",
        "remote.origin.uploadpack",
        "remote.origin.receivepack",
        "remote.origin.pushurl",
    )
    found: list[str] = []
    for scope in ("--local", "--worktree"):
        for key in exact_keys:
            result = _git(
                workspace,
                "config",
                scope,
                "--get-all",
                key,
                runner=runner,
                check=False,
            )
            if result.returncode == 0 and result.stdout.strip():
                found.append(key)
        rewrite = _git(
            workspace,
            "config",
            scope,
            "--get-regexp",
            r"^url\..*\.(insteadof|pushinsteadof)$",
            runner=runner,
            check=False,
        )
        if rewrite.returncode == 0 and rewrite.stdout.strip():
            found.append("url rewrite")
    return sorted(set(found))


def _origin_matches(actual: str, expected: str, repository: str) -> bool:
    if actual == expected:
        return True
    if expected.startswith("/"):
        try:
            return Path(actual).resolve(strict=True) == Path(expected).resolve(strict=True)
        except OSError:
            return False
    normalized = actual.strip().removesuffix(".git")
    return normalized == f"https://github.com/{repository}" and expected == repository


def validate_local_candidate(
    candidate: TrustedCommit,
    config: PublisherConfig,
    *,
    runner: Any = subprocess.run,
) -> TrustedCommit:
    """Independently bind a sealed event to one clean local Git worktree."""
    project_root = config.project_root.resolve(strict=True)
    workspace = _canonical_existing_path(candidate.workspace, "workspace")
    worktree_root = project_root / ".worktrees"
    try:
        relative = workspace.relative_to(worktree_root)
    except ValueError as error:
        raise PublisherError("workspace is outside the registered project worktree root") from error
    if not relative.parts:
        raise PublisherError("workspace is not a registered task worktree")
    if candidate.board != config.board or candidate.project_id != config.project_id:
        raise PublisherError("sealed board or project identity mismatch")
    if candidate.branch in {"main", "develop", "gh-pages"} or candidate.branch.startswith("release/"):
        raise PublisherError("protected or release branch cannot be worker-published")

    top = _git(workspace, "rev-parse", "--show-toplevel", runner=runner).stdout.strip()
    if Path(top).resolve(strict=True) != workspace:
        raise PublisherError("Git top-level does not match sealed workspace")
    common_raw = _git(workspace, "rev-parse", "--git-common-dir", runner=runner).stdout.strip()
    common = Path(common_raw)
    if not common.is_absolute():
        common = workspace / common
    if common.resolve(strict=True) != (project_root / ".git").resolve(strict=True):
        raise PublisherError("worktree does not belong to the canonical project repository")

    records = _worktree_records(
        _git(project_root, "worktree", "list", "--porcelain", runner=runner).stdout
    )
    matches = [record for record in records if record.get("worktree") == str(workspace)]
    if len(matches) != 1:
        raise PublisherError("workspace is not an exact registered worktree")
    if matches[0].get("branch") != f"refs/heads/{candidate.branch}":
        raise PublisherError("registered worktree branch does not match sealed branch")

    current_branch = _git(
        workspace, "symbolic-ref", "--quiet", "--short", "HEAD", runner=runner, check=False
    )
    if current_branch.returncode != 0 or current_branch.stdout.strip() != candidate.branch:
        raise PublisherError("worktree branch does not match sealed branch")
    head = _git(workspace, "rev-parse", "HEAD", runner=runner).stdout.strip()
    if head != candidate.head_sha:
        raise PublisherError("worktree HEAD does not match sealed head SHA")
    parents = _git(workspace, "show", "-s", "--format=%P", "HEAD", runner=runner).stdout.split()
    if parents != [candidate.base_sha]:
        raise PublisherError("sealed commit must have exactly the sealed base as parent")
    ancestor = _git(
        workspace,
        "merge-base",
        "--is-ancestor",
        candidate.base_sha,
        candidate.head_sha,
        runner=runner,
        check=False,
    )
    if ancestor.returncode != 0:
        raise PublisherError("sealed base is not an ancestor of the sealed head")
    if _git(
        workspace,
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
        runner=runner,
    ).stdout:
        raise PublisherError("publisher requires a clean worktree")
    changed = tuple(sorted(filter(None, _git(
        workspace,
        "diff-tree",
        "--no-commit-id",
        "--name-only",
        "-r",
        candidate.head_sha,
        runner=runner,
    ).stdout.splitlines())))
    if changed != candidate.changed_paths:
        raise PublisherError("sealed changed paths do not match the exact commit")
    dangerous = _dangerous_local_git_config(workspace, runner)
    if dangerous:
        raise PublisherError(f"unsafe executable Git config is present: {', '.join(dangerous)}")
    origin = _git(workspace, "remote", "get-url", "origin", runner=runner).stdout.strip()
    if not _origin_matches(origin, config.expected_origin, config.repository):
        raise PublisherError("origin does not match the canonical repository")
    push_origin = _git(
        workspace, "remote", "get-url", "--push", "origin", runner=runner
    ).stdout.strip()
    if not _origin_matches(push_origin, config.expected_origin, config.repository):
        raise PublisherError("push origin does not match the canonical repository")
    return candidate


def _publisher_env() -> dict[str, str]:
    env = _minimal_env()
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if not token or "\n" in token or "\r" in token or len(token) > 4096:
        raise PublisherError("publisher GitHub credential is missing or malformed")
    env["GH_TOKEN"] = token
    return env


def _gh(
    *args: str,
    cwd: Path,
    runner: Any = subprocess.run,
    check: bool = True,
) -> subprocess.CompletedProcess:
    return _run(
        ["gh", *args],
        cwd=cwd,
        runner=runner,
        check=check,
        env=_publisher_env(),
    )


def _bounded_json(result: subprocess.CompletedProcess, label: str) -> Any:
    raw = result.stdout
    if not isinstance(raw, str) or len(raw.encode("utf-8")) > 1_000_000:
        raise PublisherError(f"{label} JSON readback is missing or too large")
    try:
        return json.loads(raw)
    except json.JSONDecodeError as error:
        raise PublisherError(f"{label} JSON readback is malformed") from error


def _remote_head(
    candidate: TrustedCommit,
    *,
    runner: Any,
) -> str | None:
    workspace = Path(candidate.workspace)
    result = _git(
        workspace,
        "ls-remote",
        "--heads",
        "origin",
        f"refs/heads/{candidate.branch}",
        runner=runner,
        env=_publisher_env(),
    )
    lines = [line for line in result.stdout.splitlines() if line.strip()]
    if not lines:
        return None
    if len(lines) != 1:
        raise PublisherError("remote branch readback is ambiguous")
    sha, separator, ref = lines[0].partition("\t")
    if separator != "\t" or ref != f"refs/heads/{candidate.branch}" or not SHA_PATTERN.fullmatch(sha):
        raise PublisherError("remote branch readback is malformed")
    return sha


def _exact_pr(
    value: Any,
    candidate: TrustedCommit,
    config: PublisherConfig,
) -> PublishedPullRequest:
    pr = PublishedPullRequest.from_dict(value)
    expected_owner = config.repository.split("/", 1)[0]
    if (
        pr.state != "OPEN"
        or pr.branch != candidate.branch
        or pr.head_sha != candidate.head_sha
        or pr.base != config.base_branch
        or pr.head_repository_owner != expected_owner
        or pr.is_cross_repository
    ):
        raise PublisherError("pull request repository owner or exact sealed publication does not match")
    return pr


def _list_open_prs(
    candidate: TrustedCommit,
    config: PublisherConfig,
    *,
    runner: Any,
) -> list[Any]:
    result = _gh(
        "pr",
        "list",
        "--repo",
        config.repository,
        "--base",
        config.base_branch,
        "--head",
        candidate.branch,
        "--state",
        "open",
        "--json",
        "number,url,state,headRefName,headRefOid,baseRefName,headRepositoryOwner,isCrossRepository,labels",
        cwd=Path(candidate.workspace),
        runner=runner,
    )
    value = _bounded_json(result, "pull request list")
    if not isinstance(value, list):
        raise PublisherError("pull request list readback is malformed")
    return value


def ensure_remote_and_pr(
    candidate: TrustedCommit,
    config: PublisherConfig,
    *,
    runner: Any = subprocess.run,
) -> PublishedPullRequest:
    """Non-force publish one exact sealed head and read back its PR."""
    workspace = Path(candidate.workspace)
    remote_head = _remote_head(candidate, runner=runner)
    if remote_head not in {None, candidate.head_sha}:
        ancestor = _git(
            workspace,
            "merge-base",
            "--is-ancestor",
            remote_head,
            candidate.head_sha,
            runner=runner,
            check=False,
        )
        if ancestor.returncode != 0:
            raise PublisherError("remote branch is not an ancestor of the sealed head; force publication is forbidden")
        existing = _list_open_prs(candidate, config, runner=runner)
        if len(existing) != 1:
            raise PublisherError("fast-forward correction requires exactly one existing open PR")
        prior = PublishedPullRequest.from_dict(existing[0])
        if (
            prior.state != "OPEN"
            or prior.branch != candidate.branch
            or prior.head_sha != remote_head
            or prior.base != config.base_branch
            or prior.head_repository_owner != config.repository.split("/", 1)[0]
            or prior.is_cross_repository
        ):
            raise PublisherError("existing correction PR does not match the sealed base")
        if "ready-for-gate" in prior.labels:
            _gh(
                "pr",
                "edit",
                str(prior.number),
                "--repo",
                config.repository,
                "--remove-label",
                "ready-for-gate",
                cwd=workspace,
                runner=runner,
            )
            prior = _read_pr_at_sha(
                prior.number,
                candidate,
                config,
                expected_sha=remote_head,
                runner=runner,
            )
            if "ready-for-gate" in prior.labels:
                raise PublisherError("stale readiness label remained before correction push")
    if remote_head != candidate.head_sha:
        _git(
            workspace,
            "-c",
            "credential.helper=!gh auth git-credential",
            "push",
            "origin",
            f"{candidate.head_sha}:refs/heads/{candidate.branch}",
            runner=runner,
            env=_publisher_env(),
        )
        if _remote_head(candidate, runner=runner) != candidate.head_sha:
            raise PublisherError("remote branch exact-SHA readback failed after push")

    open_prs = _list_open_prs(candidate, config, runner=runner)
    if len(open_prs) > 1:
        raise PublisherError("expected exactly one open PR for the sealed branch")
    if not open_prs:
        _gh(
            "pr",
            "create",
            "--repo",
            config.repository,
            "--base",
            config.base_branch,
            "--head",
            candidate.branch,
            "--title",
            f"feat: complete {candidate.task_id} through Hermes",
            "--body",
            (
                "Dispatcher-sealed Hermes implementation handoff.\n\n"
                f"- Task: `{candidate.task_id}`\n"
                f"- Exact head: `{candidate.head_sha}`\n"
                f"- Exact parent: `{candidate.base_sha}`\n\n"
                "Publication is performed by the credential-isolated trusted publisher."
            ),
            cwd=workspace,
            runner=runner,
        )
        open_prs = _list_open_prs(candidate, config, runner=runner)
        if len(open_prs) != 1:
            raise PublisherError("pull request creation lacked exact authoritative readback")
    return _exact_pr(open_prs[0], candidate, config)


def _read_pr(
    number: int,
    candidate: TrustedCommit,
    config: PublisherConfig,
    *,
    runner: Any,
) -> PublishedPullRequest:
    return _read_pr_at_sha(
        number,
        candidate,
        config,
        expected_sha=candidate.head_sha,
        runner=runner,
    )


def _read_pr_at_sha(
    number: int,
    candidate: TrustedCommit,
    config: PublisherConfig,
    *,
    expected_sha: str,
    runner: Any,
) -> PublishedPullRequest:
    result = _gh(
        "pr",
        "view",
        str(number),
        "--repo",
        config.repository,
        "--json",
        "number,url,state,headRefName,headRefOid,baseRefName,headRepositoryOwner,isCrossRepository,labels",
        cwd=Path(candidate.workspace),
        runner=runner,
    )
    pr = PublishedPullRequest.from_dict(_bounded_json(result, "pull request"))
    if (
        pr.state != "OPEN"
        or pr.branch != candidate.branch
        or pr.head_sha != expected_sha
        or pr.base != config.base_branch
        or pr.head_repository_owner != config.repository.split("/", 1)[0]
        or pr.is_cross_repository
    ):
        raise PublisherError("pull request repository owner or exact expected state does not match")
    return pr


def _required_checks_green(
    candidate: TrustedCommit,
    config: PublisherConfig,
    *,
    runner: Any,
) -> bool:
    result = _gh(
        "api",
        f"repos/{config.repository}/commits/{candidate.head_sha}/check-runs?per_page=100",
        cwd=Path(candidate.workspace),
        runner=runner,
    )
    value = _bounded_json(result, "check runs")
    runs = value.get("check_runs") if isinstance(value, dict) else None
    if not isinstance(runs, list):
        raise PublisherError("check runs readback is malformed")
    for required in config.required_checks:
        matching = [
            item
            for item in runs
            if isinstance(item, dict) and item.get("name") == required and _positive_int(item.get("id"))
        ]
        if not matching:
            return False
        latest = max(matching, key=lambda item: item["id"])
        app = latest.get("app")
        if (
            latest.get("status") != "completed"
            or latest.get("conclusion") != "success"
            or not isinstance(app, dict)
            or app.get("id") != config.required_check_app_id
        ):
            return False
    return True


def ensure_ready_label(
    candidate: TrustedCommit,
    pr: PublishedPullRequest,
    config: PublisherConfig,
    *,
    runner: Any = subprocess.run,
) -> PublishedPullRequest:
    """Apply readiness only after current exact-head CI and PR readback."""
    if not _required_checks_green(candidate, config, runner=runner):
        raise PublisherPending("required exact-head check suite is not green")
    current = _read_pr(pr.number, candidate, config, runner=runner)
    if "ready-for-gate" not in current.labels:
        _gh(
            "pr",
            "edit",
            str(pr.number),
            "--repo",
            config.repository,
            "--add-label",
            "ready-for-gate",
            cwd=Path(candidate.workspace),
            runner=runner,
        )
    readback = _read_pr(pr.number, candidate, config, runner=runner)
    if "ready-for-gate" not in readback.labels:
        raise PublisherError("ready-for-gate label lacked exact authoritative readback")
    return readback


def _revalidate_candidate(
    candidate: TrustedCommit,
    config: PublisherConfig,
    kb: Any,
    conn: Any,
) -> Any:
    task = kb.get_task(conn, candidate.task_id)
    if task is None:
        raise PublisherError("sealed implementation task disappeared")
    current = _candidate_for_task(kb, conn, task, config.board)
    if current != candidate:
        raise PublisherError("sealed publisher obligation changed during publication")
    return task


def complete_lifecycle_handoff(
    candidate: TrustedCommit,
    pr: PublishedPullRequest,
    config: PublisherConfig,
    kb: Any,
    conn: Any,
    *,
    runner: Any = subprocess.run,
) -> str:
    """Create/reuse the exact release tracker, then close only the worker task."""
    if (
        pr.state != "OPEN"
        or pr.branch != candidate.branch
        or pr.head_sha != candidate.head_sha
        or pr.base != config.base_branch
        or "ready-for-gate" not in pr.labels
    ):
        raise PublisherError("lifecycle handoff requires exact labeled PR readback")
    _revalidate_candidate(candidate, config, kb, conn)
    current_pr = _read_pr(pr.number, candidate, config, runner=runner)
    if "ready-for-gate" not in current_pr.labels:
        raise PublisherError("lifecycle handoff lost the exact readiness label")
    lifecycle_env = _minimal_env()
    lifecycle_env["HERMES_KANBAN_BOARD"] = config.board
    tracker_id: str | None = None
    existing_tracker = False
    if config.ledger_path is not None:
        replay_result = _run(
            [
                sys.executable,
                str(config.lifecycle_controller),
                "replay",
                "--ledger",
                str(config.ledger_path),
            ],
            cwd=config.project_root,
            runner=runner,
            env=lifecycle_env,
        )
        replay = _bounded_json(replay_result, "release lifecycle")
        if not isinstance(replay, dict):
            raise PublisherError("release lifecycle replay is malformed")
        matches = [
            value
            for value in replay.values()
            if isinstance(value, dict)
            and value.get("pr") == pr.number
            and value.get("state") != "complete"
            and isinstance(value.get("task_id"), str)
            and TASK_ID_PATTERN.fullmatch(value["task_id"])
        ]
        if len(matches) > 1:
            raise PublisherError("release lifecycle has ambiguous active trackers for the PR")
        if matches:
            tracker_id = matches[0]["task_id"]
            existing_tracker = True
    if tracker_id is None:
        result = _run(
            [
                sys.executable,
                str(config.lifecycle_controller),
                "bootstrap",
                "--apply",
                "--parent-task-id",
                candidate.task_id,
                "--pr",
                str(pr.number),
                "--head-sha",
                candidate.head_sha,
            ],
            cwd=config.project_root,
            runner=runner,
            env=lifecycle_env,
        )
        rendered = _bounded_json(result, "release tracker")
        expected_key = f"radulator-release:{candidate.task_id}:pr-{pr.number}"
        if not isinstance(rendered, list) or len(rendered) != 1 or not isinstance(rendered[0], dict):
            raise PublisherError("release tracker readback is malformed")
        record = rendered[0]
        tracker_id = record.get("task_id")
        if (
            record.get("kind") != "create_child"
            or record.get("idempotency_key") != expected_key
            or not isinstance(tracker_id, str)
            or not TASK_ID_PATTERN.fullmatch(tracker_id)
        ):
            raise PublisherError("release tracker readback does not match the exact handoff")
    tracker = kb.get_task(conn, tracker_id)
    if (
        tracker is None
        or getattr(tracker, "status", None) not in {"triage", "todo", "scheduled", "ready", "running", "blocked", "review"}
        or not isinstance(getattr(tracker, "body", None), str)
        or not _has_exact_pr_reference(tracker.body, pr.number)
        or (not existing_tracker and not _has_exact_sha_reference(tracker.body, candidate.head_sha))
    ):
        raise PublisherError("release tracker failed exact nonterminal task readback")

    current_pr = _read_pr(pr.number, candidate, config, runner=runner)
    if "ready-for-gate" not in current_pr.labels:
        raise PublisherError("lifecycle handoff lost the exact readiness label")

    comment = (
        "TRUSTED_PUBLISHER v1 publication verified. "
        f"PR {pr.url}; exact head {candidate.head_sha}; release tracker {tracker_id}."
    )
    comment_id = kb.add_comment(conn, candidate.task_id, "radulator-trusted-publisher", comment)
    if not _positive_int(comment_id):
        raise PublisherError("publisher audit comment failed durable readback")
    _revalidate_candidate(candidate, config, kb, conn)
    completion = (
        "TRUSTED_PUBLISHER v1\n"
        f"PR: {pr.url}\n"
        f"Exact head: {candidate.head_sha}\n"
        f"Release tracker: {tracker_id}"
    )
    completed = kb.complete_task(
        conn,
        candidate.task_id,
        result=completion,
        summary=completion,
        metadata={
            "contract": "radulator.trusted_publisher.completion.v1",
            "pr": pr.number,
            "head_sha": candidate.head_sha,
            "release_tracker_id": tracker_id,
        },
    )
    if completed is not True:
        raise PublisherError("implementation task completion was not applied atomically")
    final_task = kb.get_task(conn, candidate.task_id)
    if (
        final_task is None
        or getattr(final_task, "status", None) != "done"
        or getattr(final_task, "result", None) != completion
    ):
        raise PublisherError("implementation task completion failed exact readback")
    return tracker_id


@contextlib.contextmanager
def publisher_lock(path: Path):
    """Hold a persistent ownership-safe host lock for one publisher pass."""
    path = Path(path)
    if not path.is_absolute():
        raise PublisherError("publisher lock path must be absolute")
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    flags = os.O_RDWR | os.O_CREAT
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    descriptor = os.open(path, flags, 0o600)
    acquired = False
    try:
        details = os.fstat(descriptor)
        if not stat.S_ISREG(details.st_mode) or details.st_uid != os.getuid():
            raise PublisherError("publisher lock must be an owner-controlled regular file")
        os.fchmod(descriptor, 0o600)
        try:
            fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
            acquired = True
        except BlockingIOError:
            acquired = False
        yield acquired
    finally:
        if acquired:
            fcntl.flock(descriptor, fcntl.LOCK_UN)
        os.close(descriptor)


def run_once(
    config: PublisherConfig,
    kb: Any,
    conn: Any,
    *,
    runner: Any = subprocess.run,
) -> dict[str, Any]:
    """Process no more than one exact oldest publisher obligation."""
    candidate = select_candidate(kb, conn, config.board)
    if candidate is None:
        return {"status": "idle"}
    validate_local_candidate(candidate, config, runner=runner)
    pr = ensure_remote_and_pr(candidate, config, runner=runner)
    try:
        labeled = ensure_ready_label(candidate, pr, config, runner=runner)
    except PublisherPending:
        return {
            "status": "pending_ci",
            "task_id": candidate.task_id,
            "pr": pr.number,
            "head_sha": candidate.head_sha,
        }
    tracker_id = complete_lifecycle_handoff(
        candidate,
        labeled,
        config,
        kb,
        conn,
        runner=runner,
    )
    return {
        "status": "published",
        "task_id": candidate.task_id,
        "pr": labeled.number,
        "head_sha": candidate.head_sha,
        "release_tracker_id": tracker_id,
    }


def parse_runtime_config(argv: list[str] | None = None) -> tuple[PublisherConfig, Path]:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--board", default=os.environ.get("RADULATOR_HERMES_BOARD", "default"))
    parser.add_argument("--project-id", default=os.environ.get("RADULATOR_HERMES_PROJECT_ID"))
    parser.add_argument("--project-root", required=True)
    parser.add_argument("--repository", default="momomojo/Radulator")
    parser.add_argument("--base-branch", default="develop")
    parser.add_argument("--expected-origin", default="momomojo/Radulator")
    parser.add_argument("--lifecycle-controller", required=True)
    parser.add_argument("--ledger", required=True)
    parser.add_argument("--lock-file", required=True)
    args = parser.parse_args(argv)
    project_root = Path(args.project_root)
    lifecycle_controller = Path(args.lifecycle_controller)
    lock_file = Path(args.lock_file)
    ledger_path = Path(args.ledger)
    if not project_root.is_absolute() or not project_root.is_dir():
        parser.error("--project-root must be an existing absolute directory")
    if not lifecycle_controller.is_absolute() or not lifecycle_controller.is_file():
        parser.error("--lifecycle-controller must be an existing absolute file")
    if not lock_file.is_absolute():
        parser.error("--lock-file must be absolute")
    if not ledger_path.is_absolute():
        parser.error("--ledger must be absolute")
    if args.repository != "momomojo/Radulator" or args.base_branch != "develop":
        parser.error("publisher repository/base must be momomojo/Radulator and develop")
    if not TASK_ID_PATTERN.fullmatch(args.board or ""):
        parser.error("publisher board identity is malformed")
    if args.project_id is not None and not TASK_ID_PATTERN.fullmatch(args.project_id):
        parser.error("publisher board/project identity is malformed")
    config = PublisherConfig(
        board=args.board,
        project_id=args.project_id,
        project_root=project_root.resolve(strict=True),
        repository=args.repository,
        base_branch=args.base_branch,
        expected_origin=args.expected_origin,
        lifecycle_controller=lifecycle_controller.resolve(strict=True),
        ledger_path=ledger_path,
    )
    return config, lock_file


def main(argv: list[str] | None = None, *, kb_module: Any = None) -> int:
    config, lock_file = parse_runtime_config(argv)
    if kb_module is None:
        from hermes_cli import kanban_db as kb_module  # type: ignore[import-not-found]
    with publisher_lock(lock_file) as acquired:
        if not acquired:
            print(json.dumps({"status": "busy"}, sort_keys=True, separators=(",", ":")))
            return 0
        conn = kb_module.connect(board=config.board)
        try:
            result = run_once(config, kb_module, conn)
        finally:
            conn.close()
    print(json.dumps(result, sort_keys=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except PublisherPending as error:
        print(json.dumps({"status": "pending", "reason": str(error)}, sort_keys=True), file=sys.stderr)
        raise SystemExit(0)
    except PublisherError as error:
        print(f"[trusted-publisher] ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
