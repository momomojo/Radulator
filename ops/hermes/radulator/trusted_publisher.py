#!/usr/bin/env python3
"""Publish dispatcher-sealed Radulator commits without an AI credential path."""

from __future__ import annotations

import argparse
import contextlib
import dataclasses
import fcntl
import hashlib
import json
import os
import re
import secrets
import stat
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any


CONTRACT = "hermes.trusted_local_commit.v1"
REQUEST_CONTRACT = "hermes.trusted_git_completion_request.v1"
AUTHORITY_REQUEST_CONTRACT = "hermes.trusted_publisher.authority-request.v1"
AUTHORITY_CLAIM_CONTRACT = "hermes.trusted_publisher.authority-claim.v1"
AUTHORITY_VERIFICATION_REQUEST_CONTRACT = "hermes.trusted_publisher.authority-verification-request.v1"
AUTHORITY_VERIFICATION_CONTRACT = "hermes.trusted_publisher.authority-verified.v1"
COMPLETION_CAS_CONTRACT = "hermes.trusted_publisher.completion-cas.v1"
BROKER_BOUNDARY = "hermes.dedicated_broker_identity.v1"
BROKER_OBLIGATION_QUERY_CONTRACT = "hermes.publisher_obligation_query.v1"
BROKER_HANDOFF_CONTRACT = "hermes.publisher_object_handoff.v1"
BLOCKED_MARKER = "AWAITING_TRUSTED_PUBLISHER v1"
GIT_BINARY = "/usr/bin/git"
GH_BINARY = "/opt/homebrew/bin/gh"
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
BROKER_CONTRACT_KEYS = frozenset(
    {
        "contract",
        "broker_boundary",
        "receipt_id",
        "key_id",
        "task_id",
        "run_id",
        "claim_generation",
        "dispatch_authority_receipt_id",
        "dispatch_authority_payload_sha256",
        "project_id",
        "board",
        "repository_id",
        "repository_fingerprint",
        "remote_repository",
        "remote_repository_sha256",
        "workspace",
        "workspace_id",
        "workspace_manifest_sha256",
        "branch",
        "base_branch",
        "base_sha",
        "target_base_sha",
        "head_sha",
        "changed_paths",
        "changed_entries",
        "publisher_state",
        "reason",
        "payload_sha256",
    }
)


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
    target_base_sha: str | None = None
    receipt_id: str | None = None
    receipt_payload_sha256: str | None = None
    repository_id: str | None = None
    broker_boundary: str | None = None
    remote_repository: dict[str, Any] | None = None
    changed_entries: tuple[dict[str, Any], ...] = ()
    sealed_workspace: str | None = None
    bundle_path: str | None = None
    bundle_sha256: str | None = None
    bundle_size: int | None = None


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
    required_check_app_slug: str = "github-actions"
    e2e_workflow_path: str = ".github/workflows/e2e-tests.yml"
    e2e_workflow_name: str = "E2E Tests"
    repository_id: str | None = None
    publisher_state_dir: Path | None = None
    broker_client_config: Path | None = None
    expected_broker_uid: int | None = None
    publisher_gid: int | None = None
    github_repository_id: int | None = None
    required_workflow_id: int | None = None
    ready_label_actor_id: int | None = None
    ready_label_actor_login: str | None = None
    ready_label_actor_type: str | None = None


class PublisherError(RuntimeError):
    pass


class PublisherPending(PublisherError):
    pass


class PublisherCompletionAmbiguous(PublisherError):
    """A terminal CAS may have committed, so readiness must not be removed."""

    pass


@dataclasses.dataclass(frozen=True)
class PublishedPullRequest:
    number: int
    url: str
    state: str
    branch: str
    head_sha: str
    base: str
    base_sha: str
    head_repository_owner: str
    is_cross_repository: bool
    labels: tuple[str, ...]
    merged_at: str | None

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
        merged_at = value.get("mergedAt")
        fields = {
            "url": value.get("url"),
            "state": value.get("state"),
            "branch": value.get("headRefName"),
            "head_sha": value.get("headRefOid"),
            "base": value.get("baseRefName"),
            "base_sha": value.get("baseRefOid"),
        }
        if (
            not _positive_int(number)
            or not all(isinstance(item, str) and item for item in fields.values())
            or not isinstance(owner_login, str)
            or not owner_login
            or type(is_cross_repository) is not bool
            or (merged_at is not None and not isinstance(merged_at, str))
        ):
            raise PublisherError("pull request readback identity is malformed")
        return cls(
            number=number,
            head_repository_owner=owner_login,
            is_cross_repository=is_cross_repository,
            labels=tuple(sorted(set(labels))),
            merged_at=merged_at,
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


def _candidate_for_task(
    kb: Any, conn: Any, task: Any, board: str
) -> TrustedCommit | None:
    if (
        getattr(task, "status", None) != "blocked"
        or getattr(task, "block_kind", None) != "capability"
    ):
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
    run = kb.get_run(conn, candidate.run_id)
    latest_run = kb.latest_run(conn, task_id)
    if (
        candidate.task_id != task_id
        or candidate.board != board
        or candidate.project_id != getattr(task, "project_id", None)
        or candidate.workspace != getattr(task, "workspace_path", None)
        or candidate.branch != getattr(task, "branch_name", None)
        or getattr(task, "current_run_id", None) is not None
        or run is None
        or getattr(run, "id", None) != candidate.run_id
        or getattr(run, "task_id", None) != task_id
        or getattr(run, "status", None) != "blocked"
        or getattr(run, "outcome", None) != "blocked"
        or not _positive_int(getattr(run, "ended_at", None))
        or getattr(run, "summary", None) != BLOCKED_MARKER
        or latest_run is None
        or getattr(latest_run, "id", None) != candidate.run_id
    ):
        return None
    if candidate.recovered_from_run_id is not None:
        recovered = kb.get_run(conn, candidate.recovered_from_run_id)
        requests = [
            item
            for item in events
            if getattr(item, "kind", None) == "trusted_git_completion_requested"
            and getattr(item, "run_id", None) == candidate.recovered_from_run_id
            and isinstance(getattr(item, "payload", None), dict)
            and item.payload.get("contract") == REQUEST_CONTRACT
        ]
        if (
            candidate.recovered_from_run_id >= candidate.run_id
            or recovered is None
            or getattr(recovered, "task_id", None) != task_id
            or getattr(recovered, "status", None) != "reclaimed"
            or getattr(recovered, "outcome", None) != "reclaimed"
            or not _positive_int(getattr(recovered, "ended_at", None))
            or len(requests) != 1
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


def _canonical_json(value: Any) -> bytes:
    return json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")


def _exact_broker_remote_repository(
    value: Any, config: PublisherConfig
) -> dict[str, Any]:
    fields = {
        "contract",
        "host",
        "owner",
        "name",
        "full_name",
        "repository_id",
        "canonical_url",
        "is_fork",
        "publication_policy",
    }
    if not isinstance(value, dict) or set(value) != fields:
        raise PublisherError("broker GitHub repository binding is not exact")
    try:
        owner, name = config.repository.split("/", 1)
    except ValueError as error:
        raise PublisherError("publisher repository identity is malformed") from error
    if (
        value.get("contract") != "hermes.github_repository.v1"
        or value.get("host") != "github.com"
        or value.get("owner") != owner
        or value.get("name") != name
        or value.get("full_name") != config.repository
        or value.get("repository_id") != config.github_repository_id
        or value.get("canonical_url") != f"https://github.com/{config.repository}"
        or value.get("is_fork") is not False
    ):
        raise PublisherError("broker GitHub repository identity does not match publisher")
    policy = value.get("publication_policy")
    policy_fields = {
        "pull_request_base",
        "workflow_id",
        "workflow_name",
        "workflow_path",
        "workflow_event",
        "required_job_names",
        "required_app",
        "ready_label_actor",
        "ready_label",
    }
    expected_actor = {
        "id": config.ready_label_actor_id,
        "login": config.ready_label_actor_login,
        "type": config.ready_label_actor_type,
    }
    if (
        not isinstance(policy, dict)
        or set(policy) != policy_fields
        or policy.get("pull_request_base") != config.base_branch
        or policy.get("workflow_id") != config.required_workflow_id
        or policy.get("workflow_name") != config.e2e_workflow_name
        or policy.get("workflow_path") != config.e2e_workflow_path
        or policy.get("workflow_event") != "pull_request"
        or policy.get("required_job_names") != list(config.required_checks)
        or policy.get("required_app")
        != {
            "id": config.required_check_app_id,
            "slug": config.required_check_app_slug,
        }
        or policy.get("ready_label_actor") != expected_actor
        or policy.get("ready_label") != "ready-for-gate"
        or not _positive_int(config.github_repository_id)
        or not _positive_int(config.required_workflow_id)
        or not _positive_int(config.ready_label_actor_id)
        or config.ready_label_actor_type not in {"User", "Bot"}
    ):
        raise PublisherError("broker publication policy does not match publisher")
    return json.loads(_canonical_json(value))


def _exact_broker_changed_entries(
    value: Any, *, changed_paths: tuple[str, ...]
) -> tuple[dict[str, Any], ...]:
    if not isinstance(value, list) or len(value) != len(changed_paths):
        raise PublisherError("broker changed-entry list is malformed")
    normalized: list[dict[str, Any]] = []
    for index, entry in enumerate(value):
        if not isinstance(entry, dict) or set(entry) != {
            "path",
            "operation",
            "mode",
            "sha256",
            "size",
        }:
            raise PublisherError("broker changed-entry fields are not exact")
        operation = entry.get("operation")
        mode = entry.get("mode")
        sha256 = entry.get("sha256")
        size = entry.get("size")
        if (
            entry.get("path") != changed_paths[index]
            or operation not in {"add", "modify", "delete"}
            or mode not in {"100644", "100755"}
            or type(size) is not int
            or size < 0
            or (
                operation == "delete"
                and (sha256 is not None or size != 0)
            )
            or (
                operation != "delete"
                and (
                    not isinstance(sha256, str)
                    or not re.fullmatch(r"[0-9a-f]{64}", sha256)
                )
            )
        ):
            raise PublisherError("broker changed-entry authority is invalid")
        normalized.append(json.loads(_canonical_json(entry)))
    return tuple(normalized)


def _parse_broker_obligation_item(
    item: Any, config: PublisherConfig
) -> TrustedCommit:
    item_fields = {
        "contract",
        "broker_boundary",
        "receipt_id",
        "key_id",
        "payload_sha256",
        "verified",
        "revoked",
        "operation_state",
        "canonical_payload",
        "created_at",
    }
    if (
        not isinstance(item, dict)
        or set(item) != item_fields
        or item.get("contract") != CONTRACT
        or item.get("broker_boundary") != BROKER_BOUNDARY
        or item.get("verified") is not True
        or item.get("revoked") is not False
        or item.get("operation_state") != "EMITTED"
        or not _positive_int(item.get("created_at"))
    ):
        raise PublisherError("broker publication obligation does not verify")
    payload = item.get("canonical_payload")
    if not isinstance(payload, dict) or set(payload) != BROKER_CONTRACT_KEYS:
        raise PublisherError("broker publication event fields are not exact")
    receipt_id = payload.get("receipt_id")
    key_id = payload.get("key_id")
    payload_sha256 = payload.get("payload_sha256")
    project_id = payload.get("project_id")
    changed_paths = _safe_changed_paths(payload.get("changed_paths"))
    branch = payload.get("branch")
    workspace = payload.get("workspace")
    if (
        payload.get("contract") != CONTRACT
        or payload.get("broker_boundary") != BROKER_BOUNDARY
        or payload.get("publisher_state") != "awaiting"
        or payload.get("reason") != BLOCKED_MARKER
        or payload.get("repository_id") != config.repository_id
        or payload.get("board") != config.board
        or project_id != config.project_id
        or payload.get("base_branch") != config.base_branch
        or item.get("receipt_id") != receipt_id
        or item.get("key_id") != key_id
        or item.get("payload_sha256") != payload_sha256
        or not isinstance(receipt_id, str)
        or not TASK_ID_PATTERN.fullmatch(receipt_id)
        or not isinstance(key_id, str)
        or not re.fullmatch(r"[0-9a-f]{24}", key_id)
        or not isinstance(payload_sha256, str)
        or not re.fullmatch(r"[0-9a-f]{64}", payload_sha256)
        or hashlib.sha256(
            _canonical_json({
                key: value for key, value in payload.items() if key != "payload_sha256"
            })
        ).hexdigest()
        != payload_sha256
        or not isinstance(payload.get("task_id"), str)
        or not TASK_ID_PATTERN.fullmatch(payload["task_id"])
        or not _positive_int(payload.get("run_id"))
        or not isinstance(branch, str)
        or len(branch) > 200
        or not re.fullmatch(r"[A-Za-z0-9._/-]+", branch)
        or branch.startswith("/")
        or branch.endswith("/")
        or ".." in PurePosixPath(branch).parts
        or branch in {"main", "develop", "gh-pages"}
        or branch.startswith("release/")
        or not isinstance(workspace, str)
        or not workspace.startswith("/")
        or not isinstance(payload.get("base_sha"), str)
        or not SHA_PATTERN.fullmatch(payload["base_sha"])
        or not isinstance(payload.get("target_base_sha"), str)
        or not SHA_PATTERN.fullmatch(payload["target_base_sha"])
        or not isinstance(payload.get("head_sha"), str)
        or not SHA_PATTERN.fullmatch(payload["head_sha"])
        or payload["head_sha"] == payload["base_sha"]
        or changed_paths is None
    ):
        raise PublisherError("broker publication event authority is invalid")
    remote = _exact_broker_remote_repository(payload.get("remote_repository"), config)
    if (
        not isinstance(payload.get("remote_repository_sha256"), str)
        or hashlib.sha256(_canonical_json(remote)).hexdigest()
        != payload["remote_repository_sha256"]
    ):
        raise PublisherError("broker remote repository digest does not verify")
    entries = _exact_broker_changed_entries(
        payload.get("changed_entries"), changed_paths=changed_paths
    )
    return TrustedCommit(
        task_id=payload["task_id"],
        project_id=project_id,
        board=payload["board"],
        workspace=workspace,
        branch=branch,
        base_sha=payload["base_sha"],
        target_base_sha=payload["target_base_sha"],
        head_sha=payload["head_sha"],
        changed_paths=changed_paths,
        run_id=payload["run_id"],
        receipt_id=receipt_id,
        receipt_payload_sha256=payload_sha256,
        repository_id=payload["repository_id"],
        broker_boundary=BROKER_BOUNDARY,
        remote_repository=remote,
        changed_entries=entries,
        sealed_workspace=workspace,
    )


def select_broker_obligation(
    client: Any, config: PublisherConfig
) -> TrustedCommit | None:
    """Read at most one oldest receipt from the authenticated broker surface."""

    if not config.repository_id or not TASK_ID_PATTERN.fullmatch(config.repository_id):
        raise PublisherError("publisher broker repository identity is unavailable")
    result = client.call(
        "list_publish_obligations",
        {
            "contract": BROKER_OBLIGATION_QUERY_CONTRACT,
            "repository_id": config.repository_id,
            "after_created_at": 0,
            "after_receipt_id": "",
            "limit": 1,
        },
    )
    if not isinstance(result, dict) or set(result) != {
        "contract",
        "broker_boundary",
        "items",
        "has_more",
        "next_cursor",
    }:
        raise PublisherError("broker obligation query response is not exact")
    items = result.get("items")
    if (
        result.get("contract") != BROKER_OBLIGATION_QUERY_CONTRACT
        or result.get("broker_boundary") != BROKER_BOUNDARY
        or not isinstance(items, list)
        or len(items) > 1
        or type(result.get("has_more")) is not bool
    ):
        raise PublisherError("broker obligation query response is invalid")
    if not items:
        if result.get("next_cursor") is not None or result.get("has_more") is not False:
            raise PublisherError("empty broker obligation cursor is malformed")
        return None
    cursor = result.get("next_cursor")
    if (
        not isinstance(cursor, dict)
        or set(cursor) != {"created_at", "receipt_id"}
        or cursor.get("created_at") != items[0].get("created_at")
        or cursor.get("receipt_id") != items[0].get("receipt_id")
    ):
        raise PublisherError("broker obligation cursor does not bind its item")
    return _parse_broker_obligation_item(items[0], config)


def _prescan_publisher_repository(project_root: Path) -> None:
    root_info = project_root.lstat()
    if (
        not stat.S_ISDIR(root_info.st_mode)
        or root_info.st_uid != os.geteuid()
        or stat.S_IMODE(root_info.st_mode) & 0o077
    ):
        raise PublisherError("publisher repository root is not private to its identity")
    dot_git = project_root / ".git"
    git_info = dot_git.lstat()
    if stat.S_ISLNK(git_info.st_mode) or not stat.S_ISDIR(git_info.st_mode):
        raise PublisherError("publisher repository Git directory is not canonical")
    for forbidden in (
        dot_git / "info" / "grafts",
        dot_git / "refs" / "replace",
        dot_git / "objects" / "info" / "alternates",
    ):
        try:
            forbidden.lstat()
        except FileNotFoundError:
            pass
        else:
            raise PublisherError("publisher repository contains forbidden Git authority")
    config_text = _read_regular_no_follow(
        dot_git / "config", "publisher repository Git config"
    )
    assert config_text is not None
    unsafe = _unsafe_git_config_names(config_text, str(dot_git / "config"))
    if unsafe:
        raise PublisherError(
            f"unsafe executable Git config is present: {', '.join(unsafe)}"
        )


def _read_exact_bundle(
    path: Path,
    *,
    expected_uid: int,
    expected_gid: int,
    expected_mode: int,
    expected_size: int,
    expected_sha256: str,
) -> bytes:
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_CLOEXEC", 0)
    try:
        descriptor = os.open(path, flags)
    except OSError as error:
        raise PublisherError("broker bundle is not safely readable") from error
    try:
        before = os.fstat(descriptor)
        if (
            not stat.S_ISREG(before.st_mode)
            or before.st_uid != expected_uid
            or before.st_gid != expected_gid
            or before.st_nlink != 1
            or stat.S_IMODE(before.st_mode) != expected_mode
            or before.st_size != expected_size
            or before.st_size <= 0
            or before.st_size > 512 * 1024 * 1024
        ):
            raise PublisherError("broker bundle ownership, mode, or size is unsafe")
        chunks: list[bytes] = []
        while True:
            chunk = os.read(descriptor, 1024 * 1024)
            if not chunk:
                break
            chunks.append(chunk)
        after = os.fstat(descriptor)
        if (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) != (
            after.st_dev,
            after.st_ino,
            after.st_size,
            after.st_mtime_ns,
        ):
            raise PublisherError("broker bundle changed during publisher read")
        content = b"".join(chunks)
        if hashlib.sha256(content).hexdigest() != expected_sha256:
            raise PublisherError("broker bundle digest does not verify")
        return content
    finally:
        os.close(descriptor)


def _private_state_directory(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    info = path.lstat()
    if (
        not stat.S_ISDIR(info.st_mode)
        or info.st_uid != os.geteuid()
        or stat.S_IMODE(info.st_mode) != 0o700
    ):
        raise PublisherError("publisher state directory is not owner-only")
    return path


def stage_broker_bundle(
    candidate: TrustedCommit,
    handoff: Any,
    config: PublisherConfig,
    *,
    runner: Any = subprocess.run,
) -> TrustedCommit:
    """Copy, verify, and import only the receipt-bound immutable Git bundle."""

    handoff_fields = {
        "contract",
        "broker_boundary",
        "receipt_id",
        "receipt_payload_sha256",
        "bundle_path",
        "bundle_sha256",
        "bundle_size",
        "repository_id",
        "branch",
        "base_branch",
        "base_sha",
        "target_base_sha",
        "head_sha",
    }
    if not isinstance(handoff, dict) or set(handoff) != handoff_fields:
        raise PublisherError("broker object handoff fields are not exact")
    bundle_sha256 = handoff.get("bundle_sha256")
    bundle_size = handoff.get("bundle_size")
    if (
        handoff.get("contract") != BROKER_HANDOFF_CONTRACT
        or handoff.get("broker_boundary") != BROKER_BOUNDARY
        or handoff.get("receipt_id") != candidate.receipt_id
        or handoff.get("receipt_payload_sha256") != candidate.receipt_payload_sha256
        or handoff.get("repository_id") != candidate.repository_id
        or handoff.get("branch") != candidate.branch
        or handoff.get("base_branch") != config.base_branch
        or handoff.get("base_sha") != candidate.base_sha
        or handoff.get("target_base_sha") != candidate.target_base_sha
        or handoff.get("head_sha") != candidate.head_sha
        or not isinstance(bundle_sha256, str)
        or not re.fullmatch(r"[0-9a-f]{64}", bundle_sha256)
        or type(bundle_size) is not int
        or bundle_size <= 0
        or config.expected_broker_uid is None
        or config.publisher_gid is None
        or config.publisher_state_dir is None
        or candidate.receipt_id is None
    ):
        raise PublisherError("broker object handoff does not bind the obligation")
    source_path = Path(str(handoff.get("bundle_path") or ""))
    if not source_path.is_absolute():
        raise PublisherError("broker bundle path must be absolute")
    content = _read_exact_bundle(
        source_path,
        expected_uid=config.expected_broker_uid,
        expected_gid=config.publisher_gid,
        expected_mode=0o640,
        expected_size=bundle_size,
        expected_sha256=bundle_sha256,
    )
    bundles = _private_state_directory(config.publisher_state_dir / "bundles")
    staged = bundles / f"{candidate.receipt_id}.bundle"
    if staged.exists() or staged.is_symlink():
        _read_exact_bundle(
            staged,
            expected_uid=os.geteuid(),
            expected_gid=os.getegid(),
            expected_mode=0o600,
            expected_size=bundle_size,
            expected_sha256=bundle_sha256,
        )
    else:
        temporary = bundles / f".{candidate.receipt_id}.{secrets.token_hex(8)}.tmp"
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
        descriptor = os.open(temporary, flags, 0o600)
        try:
            view = memoryview(content)
            while view:
                written = os.write(descriptor, view)
                view = view[written:]
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
        os.replace(temporary, staged)
        directory_fd = os.open(bundles, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    project_root = config.project_root.resolve(strict=True)
    _prescan_publisher_repository(project_root)
    advertised = _git(
        project_root, "bundle", "list-heads", str(staged), runner=runner
    ).stdout.splitlines()
    if advertised != [f"{candidate.head_sha} refs/heads/{candidate.branch}"]:
        raise PublisherError("publisher bundle does not advertise the exact receipt head")
    local_ref = f"refs/hermes-publisher/{candidate.receipt_id}"
    prior = _git(
        project_root, "rev-parse", "--verify", local_ref, runner=runner, check=False
    )
    if prior.returncode == 0 and prior.stdout.strip() != candidate.head_sha:
        raise PublisherError("publisher receipt ref already binds another object")
    if prior.returncode != 0:
        _git(
            project_root,
            "fetch",
            "--no-tags",
            str(staged),
            f"refs/heads/{candidate.branch}:{local_ref}",
            runner=runner,
        )
    if _git(project_root, "rev-parse", local_ref, runner=runner).stdout.strip() != candidate.head_sha:
        raise PublisherError("publisher bundle import lacked exact object readback")
    staged_candidate = dataclasses.replace(
        candidate,
        workspace=str(project_root),
        sealed_workspace=candidate.sealed_workspace or candidate.workspace,
        bundle_path=str(staged),
        bundle_sha256=bundle_sha256,
        bundle_size=bundle_size,
    )
    return validate_local_candidate(staged_candidate, config, runner=runner)


def _minimal_env() -> dict[str, str]:
    allowed = ("LANG", "LC_ALL", "TMPDIR")
    env = {key: os.environ[key] for key in allowed if key in os.environ}
    env.update({
        "HOME": "/var/empty",
        "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
        "GIT_TERMINAL_PROMPT": "0",
        "GIT_ASKPASS": "/dev/null",
        "SSH_ASKPASS": "/dev/null",
        "GIT_ATTR_NOSYSTEM": "1",
        "GIT_NO_REPLACE_OBJECTS": "1",
        "GIT_CONFIG_COUNT": "0",
        "GIT_CONFIG_GLOBAL": "/dev/null",
        "GIT_CONFIG_NOSYSTEM": "1",
        "GIT_CONFIG_SYSTEM": "/dev/null",
    })
    return env


def _run(
    args: list[str],
    *,
    cwd: Path,
    runner: Any = subprocess.run,
    check: bool = True,
    env: dict[str, str] | None = None,
    text: bool = True,
) -> subprocess.CompletedProcess:
    result = runner(
        args,
        cwd=str(cwd),
        env=env or _minimal_env(),
        check=False,
        capture_output=True,
        text=text,
        timeout=30,
    )
    if check and result.returncode != 0:
        detail_value = result.stderr or result.stdout or "no output"
        if isinstance(detail_value, bytes):
            detail_value = detail_value.decode("utf-8", errors="replace")
        detail = detail_value.strip()[:300]
        raise PublisherError(f"command failed ({' '.join(args[:3])}): {detail}")
    return result


def _git(
    workspace: Path,
    *args: str,
    runner: Any = subprocess.run,
    check: bool = True,
    env: dict[str, str] | None = None,
    text: bool = True,
) -> subprocess.CompletedProcess:
    return _run(
        [
            GIT_BINARY,
            "--no-optional-locks",
            "--no-replace-objects",
            "-c",
            "core.hooksPath=/dev/null",
            "-c",
            "core.fsmonitor=false",
            "-c",
            "core.askPass=/dev/null",
            "-c",
            "core.sshCommand=/usr/bin/false",
            "-c",
            "core.gitProxy=none",
            "-c",
            "credential.helper=",
            "-c",
            "diff.external=",
            "-c",
            "core.attributesFile=/dev/null",
            "-c",
            "protocol.ext.allow=never",
            "-c",
            "http.proxy=",
            "-c",
            "http.sslVerify=true",
            "-c",
            "http.extraHeader=",
            "-c",
            "http.followRedirects=false",
            *args,
        ],
        cwd=workspace,
        runner=runner,
        check=check,
        env=env,
        text=text,
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


def _read_regular_no_follow(path: Path, label: str, *, required: bool = True) -> str | None:
    flags = os.O_RDONLY
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        descriptor = os.open(path, flags)
    except FileNotFoundError:
        if not required:
            return None
        raise PublisherError(f"{label} is missing")
    except OSError as error:
        raise PublisherError(f"{label} is not a safe regular file") from error
    try:
        details = os.fstat(descriptor)
        if not stat.S_ISREG(details.st_mode) or details.st_uid != os.getuid():
            raise PublisherError(f"{label} is not an owner-controlled regular file")
        raw = os.read(descriptor, 1_000_001)
        if len(raw) > 1_000_000:
            raise PublisherError(f"{label} is too large")
        try:
            return raw.decode("utf-8")
        except UnicodeDecodeError as error:
            raise PublisherError(f"{label} is not UTF-8") from error
    finally:
        os.close(descriptor)


def _unsafe_git_config_names(text: str, label: str) -> list[str]:
    """Parse enough Git config syntax to reject every executable/transport surface."""
    exact_keys = {
        "core.hookspath",
        "core.fsmonitor",
        "core.alternaterefscommand",
        "core.askpass",
        "core.sshcommand",
        "core.gitproxy",
        "core.attributesfile",
        "diff.external",
    }
    unsafe_prefixes = (
        "credential.",
        "diff.",
        "filter.",
        "http.",
        "https.",
        "include.",
        "includeif.",
        "merge.",
        "protocol.",
        "url.",
    )
    found: list[str] = []
    section: str | None = None
    subsection: str | None = None
    section_pattern = re.compile(
        r'^\s*\[\s*([A-Za-z0-9.-]+)(?:\s+("(?:[^"\\]|\\.)*"))?\s*\]\s*(?:[#;].*)?$'
    )
    key_pattern = re.compile(r"^\s*([A-Za-z][A-Za-z0-9.-]*)\s*(?:=|$)")
    for line_number, raw in enumerate(text.splitlines(), start=1):
        stripped = raw.strip()
        if not stripped or stripped.startswith(("#", ";")):
            continue
        if raw.rstrip().endswith("\\"):
            raise PublisherError(f"{label} has ambiguous continuation at line {line_number}")
        section_match = section_pattern.fullmatch(raw)
        if section_match:
            section = section_match.group(1).casefold()
            subsection = section_match.group(2)
            if subsection is not None:
                try:
                    decoded = json.loads(subsection)
                except json.JSONDecodeError as error:
                    raise PublisherError(
                        f"{label} has malformed subsection at line {line_number}"
                    ) from error
                subsection = decoded.casefold() if isinstance(decoded, str) else None
            continue
        match = key_pattern.match(raw)
        if section is None or match is None:
            raise PublisherError(f"{label} has unparseable config at line {line_number}")
        key_name = match.group(1).casefold()
        key = f"{section}.{key_name}"
        if subsection is not None:
            key = f"{section}.{subsection}.{key_name}"
        remote_transport_override = (
            section == "remote"
            and key_name
            in {"proxy", "proxyauthmethod", "pushurl", "receivepack", "uploadpack"}
        )
        if key in exact_keys or key.startswith(unsafe_prefixes) or remote_transport_override:
            found.append(key)
    return sorted(set(found))


def _prescan_local_git_config(workspace: Path, project_root: Path) -> None:
    """Reject dangerous repository config without invoking Git or any configured helper."""
    dot_git = _read_regular_no_follow(workspace / ".git", "worktree Git link")
    assert dot_git is not None
    lines = dot_git.splitlines()
    if len(lines) != 1 or not lines[0].startswith("gitdir: "):
        raise PublisherError("worktree Git link is malformed")
    raw_gitdir = Path(lines[0].removeprefix("gitdir: "))
    if not raw_gitdir.is_absolute():
        raise PublisherError("worktree Git link must use an absolute path")
    expected_root = (project_root / ".git" / "worktrees").resolve(strict=True)
    try:
        gitdir = raw_gitdir.resolve(strict=True)
        relative = gitdir.relative_to(expected_root)
    except (OSError, ValueError) as error:
        raise PublisherError("worktree Git link is outside the canonical repository") from error
    if len(relative.parts) != 1 or gitdir != raw_gitdir.absolute():
        raise PublisherError("worktree Git link is not canonical")
    grafts = expected_root.parent / "info" / "grafts"
    try:
        grafts.lstat()
    except FileNotFoundError:
        pass
    except OSError as error:
        raise PublisherError("legacy Git graft authority cannot be inspected safely") from error
    else:
        raise PublisherError("legacy Git graft authority is forbidden")
    config_paths = (project_root / ".git" / "config", gitdir / "config.worktree")
    found: list[str] = []
    for index, config_path in enumerate(config_paths):
        text = _read_regular_no_follow(
            config_path,
            "repository Git config" if index == 0 else "worktree Git config",
            required=index == 0,
        )
        if text is not None:
            found.extend(_unsafe_git_config_names(text, str(config_path)))
    if found:
        raise PublisherError(
            f"unsafe executable Git config is present: {', '.join(sorted(set(found)))}"
        )


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


def _tree_blob(
    project_root: Path,
    treeish: str,
    path: str,
    *,
    runner: Any,
) -> tuple[str, str]:
    raw = _git(
        project_root,
        "ls-tree",
        "-z",
        treeish,
        "--",
        path,
        runner=runner,
    ).stdout
    if not isinstance(raw, str) or not raw.endswith("\0") or raw.count("\0") != 1:
        raise PublisherError("broker changed entry does not bind one Git tree object")
    record = raw[:-1]
    if "\t" not in record:
        raise PublisherError("broker changed entry Git tree object is malformed")
    metadata, actual_path = record.split("\t", 1)
    fields = metadata.split(" ")
    if (
        len(fields) != 3
        or actual_path != path
        or fields[0] not in {"100644", "100755"}
        or fields[1] != "blob"
        or not SHA_PATTERN.fullmatch(fields[2])
    ):
        raise PublisherError("broker changed entry Git tree object is invalid")
    return fields[0], fields[2]


def _commit_changed_entries(
    candidate: TrustedCommit,
    project_root: Path,
    *,
    runner: Any,
) -> tuple[dict[str, Any], ...]:
    raw = _git(
        project_root,
        "diff-tree",
        "--no-commit-id",
        "--name-status",
        "-r",
        "--no-renames",
        "-z",
        candidate.base_sha,
        candidate.head_sha,
        runner=runner,
    ).stdout
    if not isinstance(raw, str) or not raw.endswith("\0"):
        raise PublisherError("broker changed entry commit diff is malformed")
    parts = raw.split("\0")
    if parts[-1] != "" or len(parts[:-1]) % 2:
        raise PublisherError("broker changed entry commit diff is malformed")
    operation_by_status = {"A": "add", "M": "modify", "D": "delete"}
    entries_by_path: dict[str, dict[str, Any]] = {}
    for index in range(0, len(parts) - 1, 2):
        status, path = parts[index], parts[index + 1]
        operation = operation_by_status.get(status)
        if operation is None or path in entries_by_path:
            raise PublisherError("broker changed entry operation is invalid")
        treeish = candidate.base_sha if operation == "delete" else candidate.head_sha
        mode, object_id = _tree_blob(
            project_root,
            treeish,
            path,
            runner=runner,
        )
        if operation == "delete":
            content_sha256 = None
            size = 0
        else:
            content = _git(
                project_root,
                "cat-file",
                "blob",
                object_id,
                runner=runner,
                text=False,
            ).stdout
            if not isinstance(content, bytes):
                raise PublisherError("broker changed entry blob readback is malformed")
            content_sha256 = hashlib.sha256(content).hexdigest()
            size = len(content)
        entries_by_path[path] = {
            "path": path,
            "operation": operation,
            "mode": mode,
            "sha256": content_sha256,
            "size": size,
        }
    if tuple(sorted(entries_by_path)) != candidate.changed_paths:
        raise PublisherError("broker changed entry paths do not match exact commit")
    return tuple(entries_by_path[path] for path in candidate.changed_paths)


def _validate_broker_candidate(
    candidate: TrustedCommit,
    config: PublisherConfig,
    *,
    runner: Any,
) -> TrustedCommit:
    project_root = config.project_root.resolve(strict=True)
    if (
        candidate.workspace != str(project_root)
        or candidate.sealed_workspace is None
        or not candidate.sealed_workspace.startswith("/")
        or candidate.board != config.board
        or candidate.project_id != config.project_id
        or candidate.repository_id != config.repository_id
        or candidate.broker_boundary != BROKER_BOUNDARY
        or candidate.receipt_id is None
        or not TASK_ID_PATTERN.fullmatch(candidate.receipt_id)
        or candidate.receipt_payload_sha256 is None
        or not re.fullmatch(r"[0-9a-f]{64}", candidate.receipt_payload_sha256)
        or candidate.branch in {"main", "develop", "gh-pages"}
        or candidate.branch.startswith("release/")
        or candidate.bundle_path is None
        or candidate.bundle_sha256 is None
        or candidate.bundle_size is None
        or candidate.target_base_sha is None
        or not SHA_PATTERN.fullmatch(candidate.target_base_sha)
    ):
        raise PublisherError("staged broker candidate authority is incomplete")
    _prescan_publisher_repository(project_root)
    top = _git(project_root, "rev-parse", "--show-toplevel", runner=runner).stdout.strip()
    if Path(top).resolve(strict=True) != project_root:
        raise PublisherError("publisher repository top-level is not canonical")
    _read_exact_bundle(
        Path(candidate.bundle_path),
        expected_uid=os.geteuid(),
        expected_gid=os.getegid(),
        expected_mode=0o600,
        expected_size=candidate.bundle_size,
        expected_sha256=candidate.bundle_sha256,
    )
    advertised = _git(
        project_root,
        "bundle",
        "list-heads",
        candidate.bundle_path,
        runner=runner,
    ).stdout.splitlines()
    if advertised != [f"{candidate.head_sha} refs/heads/{candidate.branch}"]:
        raise PublisherError("staged bundle head no longer binds the receipt")
    local_ref = f"refs/hermes-publisher/{candidate.receipt_id}"
    if _git(project_root, "rev-parse", local_ref, runner=runner).stdout.strip() != candidate.head_sha:
        raise PublisherError("publisher receipt ref does not bind the sealed head")
    parents = _git(
        project_root,
        "show",
        "-s",
        "--format=%P",
        candidate.head_sha,
        runner=runner,
    ).stdout.split()
    if parents != [candidate.base_sha]:
        raise PublisherError("brokered commit parent does not match sealed base")
    ancestor = _git(
        project_root,
        "merge-base",
        "--is-ancestor",
        candidate.base_sha,
        candidate.head_sha,
        runner=runner,
        check=False,
    )
    if ancestor.returncode != 0:
        raise PublisherError("brokered base is not an ancestor of sealed head")
    target_ancestor = _git(
        project_root,
        "merge-base",
        "--is-ancestor",
        candidate.target_base_sha,
        candidate.head_sha,
        runner=runner,
        check=False,
    )
    if target_ancestor.returncode != 0:
        raise PublisherError("brokered target base is not contained in sealed head")
    changed = tuple(sorted(filter(None, _git(
        project_root,
        "diff-tree",
        "--no-commit-id",
        "--name-only",
        "-r",
        candidate.head_sha,
        runner=runner,
    ).stdout.splitlines())))
    if changed != candidate.changed_paths:
        raise PublisherError("broker changed paths do not match exact commit")
    if (
        _commit_changed_entries(candidate, project_root, runner=runner)
        != candidate.changed_entries
    ):
        raise PublisherError(
            "broker changed entry authority does not match exact commit objects"
        )
    origin = _git(
        project_root, "remote", "get-url", "origin", runner=runner
    ).stdout.strip()
    push_origin = _git(
        project_root,
        "remote",
        "get-url",
        "--push",
        "origin",
        runner=runner,
    ).stdout.strip()
    if not _origin_matches(origin, config.expected_origin, config.repository) or not _origin_matches(
        push_origin, config.expected_origin, config.repository
    ):
        raise PublisherError("publisher repository origin is not canonical")
    return candidate


def validate_local_candidate(
    candidate: TrustedCommit,
    config: PublisherConfig,
    *,
    runner: Any = subprocess.run,
) -> TrustedCommit:
    """Independently bind a sealed event to one clean local Git worktree."""
    if candidate.receipt_id is not None:
        return _validate_broker_candidate(candidate, config, runner=runner)
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

    _prescan_local_git_config(workspace, project_root)
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
        [GH_BINARY, *args],
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
    config: PublisherConfig,
    *,
    runner: Any,
) -> str | None:
    workspace = Path(candidate.workspace)
    result = _git(
        workspace,
        "ls-remote",
        "--heads",
        f"https://github.com/{config.repository}.git",
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


def _remote_target_base(
    candidate: TrustedCommit,
    config: PublisherConfig,
    *,
    runner: Any,
) -> str:
    workspace = Path(candidate.workspace)
    result = _git(
        workspace,
        "ls-remote",
        "--heads",
        f"https://github.com/{config.repository}.git",
        f"refs/heads/{config.base_branch}",
        runner=runner,
        env=_publisher_env(),
    )
    lines = [line for line in result.stdout.splitlines() if line.strip()]
    if len(lines) != 1:
        raise PublisherError("target base branch readback is missing or ambiguous")
    sha, separator, ref = lines[0].partition("\t")
    if separator != "\t" or ref != f"refs/heads/{config.base_branch}" or not SHA_PATTERN.fullmatch(sha):
        raise PublisherError("target base branch readback is malformed")
    return sha


def _exact_pr(
    value: Any,
    candidate: TrustedCommit,
    config: PublisherConfig,
    *,
    target_base_sha: str,
) -> PublishedPullRequest:
    pr = PublishedPullRequest.from_dict(value)
    expected_owner = config.repository.split("/", 1)[0]
    if (
        pr.state != "OPEN"
        or pr.branch != candidate.branch
        or pr.head_sha != candidate.head_sha
        or pr.base != config.base_branch
        or pr.base_sha != target_base_sha
        or pr.head_repository_owner != expected_owner
        or pr.is_cross_repository
    ):
        raise PublisherError("pull request repository owner or exact sealed publication does not match")
    return pr


def _list_branch_prs(
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
        "--head",
        candidate.branch,
        "--state",
        "all",
        "--limit",
        "10000",
        "--json",
        "number,url,state,headRefName,headRefOid,baseRefName,baseRefOid,headRepositoryOwner,isCrossRepository,labels,mergedAt",
        cwd=Path(candidate.workspace),
        runner=runner,
    )
    value = _bounded_json(result, "pull request history")
    if not isinstance(value, list):
        raise PublisherError("pull request history readback is malformed")
    if len(value) >= 10000:
        raise PublisherError("pull request history exceeds the complete enumeration limit")
    return value


def ensure_remote_and_pr(
    candidate: TrustedCommit,
    config: PublisherConfig,
    kb: Any | None = None,
    conn: Any | None = None,
    *,
    runner: Any = subprocess.run,
) -> PublishedPullRequest:
    """Non-force publish one exact sealed head and read back its PR."""
    workspace = Path(candidate.workspace)
    correction_pr: PublishedPullRequest | None = None
    validate_local_candidate(candidate, config, runner=runner)
    if kb is not None:
        _revalidate_candidate(candidate, config, kb, conn)
    remote_head = _remote_head(candidate, config, runner=runner)
    target_base_sha = _remote_target_base(candidate, config, runner=runner)
    if (
        candidate.receipt_id is not None
        and candidate.target_base_sha != target_base_sha
    ):
        raise PublisherPending(
            "broker-sealed pull-request base no longer matches the live target"
        )
    if remote_head is None:
        if candidate.base_sha != target_base_sha:
            raise PublisherError("new publication parent is not the current target base")
    elif remote_head != candidate.head_sha:
        if candidate.base_sha != remote_head:
            raise PublisherError("correction commit parent is not the current remote feature head")
        target_ancestor = _git(
            workspace,
            "merge-base",
            "--is-ancestor",
            target_base_sha,
            candidate.head_sha,
            runner=runner,
            check=False,
        )
        if target_ancestor.returncode != 0:
            raise PublisherError("current target base is not contained in the correction head")
    elif candidate.base_sha != target_base_sha:
        target_ancestor = _git(
            workspace,
            "merge-base",
            "--is-ancestor",
            target_base_sha,
            candidate.head_sha,
            runner=runner,
            check=False,
        )
        if target_ancestor.returncode != 0:
            raise PublisherError("current target base is not contained in the exact-head retry")
        retry_history = _list_branch_prs(candidate, config, runner=runner)
        if len(retry_history) != 1:
            raise PublisherError("exact-head correction retry lacks one authoritative pull request")
        retry_pr = PublishedPullRequest.from_dict(retry_history[0])
        if (
            retry_pr.branch != candidate.branch
            or retry_pr.head_sha != candidate.head_sha
            or retry_pr.base != config.base_branch
            or retry_pr.base_sha != target_base_sha
            or retry_pr.head_repository_owner != config.repository.split("/", 1)[0]
            or retry_pr.is_cross_repository
            or retry_pr.merged_at is not None
        ):
            raise PublisherError("exact-head correction retry pull request base authority is not exact")
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
        existing = _list_branch_prs(candidate, config, runner=runner)
        if len(existing) > 1:
            raise PublisherError("feature branch has ambiguous pull request history")
        prior = PublishedPullRequest.from_dict(existing[0]) if existing else None
        if (
            prior is not None
            and (
                prior.branch != candidate.branch
                or prior.head_sha != remote_head
                or prior.base != config.base_branch
                or prior.base_sha != target_base_sha
                or prior.head_repository_owner != config.repository.split("/", 1)[0]
                or prior.is_cross_repository
                or prior.merged_at is not None
            )
        ):
            raise PublisherError("existing correction PR does not match the sealed base")
        if prior is not None:
            correction_pr = prior
    if remote_head != candidate.head_sha:
        if remote_head is None and _list_branch_prs(candidate, config, runner=runner):
            raise PublisherError(
                "deleted feature branch has prior pull request history and cannot be republished"
            )
        if (
            _remote_head(candidate, config, runner=runner) != remote_head
            or _remote_target_base(candidate, config, runner=runner) != target_base_sha
        ):
            raise PublisherError("remote publication snapshot changed before push")
        if kb is not None:
            _revalidate_candidate(candidate, config, kb, conn)
        validate_local_candidate(candidate, config, runner=runner)
        if correction_pr is not None:
            _remove_ready_label_and_read_back(
                candidate,
                correction_pr.number,
                config,
                expected_sha=remote_head,
                expected_base_sha=target_base_sha,
                expected_state=correction_pr.state,
                runner=runner,
            )
        _git(
            workspace,
            "-c",
            f"credential.helper=!{GH_BINARY} auth git-credential",
            "push",
            f"https://github.com/{config.repository}.git",
            f"{candidate.head_sha}:refs/heads/{candidate.branch}",
            runner=runner,
            env=_publisher_env(),
        )
        if correction_pr is not None:
            try:
                if _remote_head(candidate, config, runner=runner) != candidate.head_sha:
                    raise PublisherError("remote branch exact-SHA readback failed after push")
                post_push = _load_pr(
                    correction_pr.number, candidate, config, runner=runner
                )
                if (
                    post_push.number != correction_pr.number
                    or post_push.state not in {"OPEN", "CLOSED"}
                    or post_push.branch != candidate.branch
                    or post_push.head_sha != candidate.head_sha
                    or post_push.base != config.base_branch
                    or post_push.base_sha != target_base_sha
                    or post_push.head_repository_owner
                    != config.repository.split("/", 1)[0]
                    or post_push.is_cross_repository
                    or post_push.merged_at is not None
                ):
                    raise PublisherError(
                        "post-push correction pull request authority is not exact"
                    )
                if "ready-for-gate" in post_push.labels:
                    raise PublisherError(
                        "post-push correction acquired an unexpected readiness label"
                    )
            except Exception:
                _compensate_ready_label(
                    candidate, correction_pr, config, runner=runner
                )
                raise
        elif _remote_head(candidate, config, runner=runner) != candidate.head_sha:
            raise PublisherError("remote branch exact-SHA readback failed after push")
        if kb is not None:
            _revalidate_candidate(candidate, config, kb, conn)

    branch_prs = _list_branch_prs(candidate, config, runner=runner)
    if len(branch_prs) > 1:
        raise PublisherError("feature branch has more than one pull request")
    if branch_prs:
        prior = PublishedPullRequest.from_dict(branch_prs[0])
        if prior.merged_at is not None or prior.state == "MERGED":
            raise PublisherError("feature branch was already merged and cannot be republished")
        if (
            prior.state not in {"OPEN", "CLOSED"}
            or prior.branch != candidate.branch
            or prior.head_sha != candidate.head_sha
            or prior.base != config.base_branch
            or prior.base_sha != target_base_sha
            or prior.head_repository_owner != config.repository.split("/", 1)[0]
            or prior.is_cross_repository
        ):
            raise PublisherError(
                "same-branch pull request repository owner/base/head authority is not exact"
            )
        if prior.state == "CLOSED":
            validate_local_candidate(candidate, config, runner=runner)
            if kb is not None:
                _revalidate_candidate(candidate, config, kb, conn)
            prior = _remove_ready_label_and_read_back(
                candidate,
                prior.number,
                config,
                expected_sha=candidate.head_sha,
                expected_base_sha=target_base_sha,
                expected_state="CLOSED",
                runner=runner,
            )
            if _remote_target_base(candidate, config, runner=runner) != target_base_sha:
                raise PublisherError("target base changed before pull request reopen")
            _gh(
                "pr",
                "reopen",
                str(prior.number),
                "--repo",
                config.repository,
                cwd=workspace,
                runner=runner,
            )
            branch_prs = _list_branch_prs(candidate, config, runner=runner)
    if not branch_prs:
        validate_local_candidate(candidate, config, runner=runner)
        if kb is not None:
            _revalidate_candidate(candidate, config, kb, conn)
        if (
            _remote_head(candidate, config, runner=runner) != candidate.head_sha
            or _remote_target_base(candidate, config, runner=runner) != target_base_sha
        ):
            raise PublisherError("publication snapshot changed before pull request creation")
        branch_prs = _list_branch_prs(candidate, config, runner=runner)
        if len(branch_prs) > 1:
            raise PublisherError("feature branch has more than one pull request")
        if not branch_prs:
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
            branch_prs = _list_branch_prs(candidate, config, runner=runner)
            if len(branch_prs) != 1:
                raise PublisherError("pull request creation lacked exact authoritative readback")
    final_pr = _exact_pr(
        branch_prs[0], candidate, config, target_base_sha=target_base_sha
    )
    if "ready-for-gate" in final_pr.labels:
        if candidate.receipt_id is not None:
            return final_pr
        _compensate_ready_label(candidate, final_pr, config, runner=runner)
        raise PublisherError(
            "final pull request carried an unexpected readiness label before CI gating"
        )
    return final_pr


def _read_pr(
    number: int,
    candidate: TrustedCommit,
    config: PublisherConfig,
    *,
    expected_base_sha: str,
    runner: Any,
) -> PublishedPullRequest:
    return _read_pr_at_sha(
        number,
        candidate,
        config,
        expected_sha=candidate.head_sha,
        expected_base_sha=expected_base_sha,
        runner=runner,
    )


def _read_pr_at_sha(
    number: int,
    candidate: TrustedCommit,
    config: PublisherConfig,
    *,
    expected_sha: str,
    expected_base_sha: str,
    expected_state: str = "OPEN",
    runner: Any,
) -> PublishedPullRequest:
    pr = _load_pr(number, candidate, config, runner=runner)
    if (
        pr.state != expected_state
        or pr.branch != candidate.branch
        or pr.head_sha != expected_sha
        or pr.base != config.base_branch
        or pr.base_sha != expected_base_sha
        or pr.head_repository_owner != config.repository.split("/", 1)[0]
        or pr.is_cross_repository
    ):
        raise PublisherError("pull request repository owner or exact expected state does not match")
    return pr


def _load_pr(
    number: int,
    candidate: TrustedCommit,
    config: PublisherConfig,
    *,
    runner: Any,
) -> PublishedPullRequest:
    result = _gh(
        "pr",
        "view",
        str(number),
        "--repo",
        config.repository,
        "--json",
        "number,url,state,headRefName,headRefOid,baseRefName,baseRefOid,headRepositoryOwner,isCrossRepository,labels,mergedAt",
        cwd=Path(candidate.workspace),
        runner=runner,
    )
    return PublishedPullRequest.from_dict(_bounded_json(result, "pull request"))


def _remove_ready_label_and_read_back(
    candidate: TrustedCommit,
    number: int,
    config: PublisherConfig,
    *,
    expected_sha: str,
    expected_base_sha: str,
    expected_state: str = "OPEN",
    runner: Any,
) -> PublishedPullRequest:
    """Remove readiness idempotently and prove exact authoritative absence."""
    _gh(
        "pr",
        "edit",
        str(number),
        "--repo",
        config.repository,
        "--remove-label",
        "ready-for-gate",
        cwd=Path(candidate.workspace),
        runner=runner,
    )
    readback = _read_pr_at_sha(
        number,
        candidate,
        config,
        expected_sha=expected_sha,
        expected_base_sha=expected_base_sha,
        expected_state=expected_state,
        runner=runner,
    )
    if "ready-for-gate" in readback.labels:
        raise PublisherError("ready-for-gate label remained after removal")
    return readback


def _compensate_ready_label(
    candidate: TrustedCommit,
    pr: PublishedPullRequest,
    config: PublisherConfig,
    *,
    runner: Any,
) -> None:
    try:
        _gh(
            "pr",
            "edit",
            str(pr.number),
            "--repo",
            config.repository,
            "--remove-label",
            "ready-for-gate",
            cwd=Path(candidate.workspace),
            runner=runner,
        )
        cleanup = _load_pr(pr.number, candidate, config, runner=runner)
        if cleanup.number != pr.number or "ready-for-gate" in cleanup.labels:
            raise PublisherError("ready-for-gate compensation lacked exact absence readback")
    except Exception as cleanup_error:
        raise PublisherError(
            "UNSAFE_LABEL_STATE: ready-for-gate absence could not be proven"
        ) from cleanup_error


def _github_timestamp(value: Any, *, label: str) -> int:
    if not isinstance(value, str) or not value.endswith("Z"):
        raise PublisherError(f"{label} timestamp is malformed")
    try:
        parsed = datetime.fromisoformat(value[:-1] + "+00:00")
    except ValueError as error:
        raise PublisherError(f"{label} timestamp is malformed") from error
    if parsed.tzinfo is None:
        raise PublisherError(f"{label} timestamp is malformed")
    timestamp = int(parsed.astimezone(timezone.utc).timestamp())
    if timestamp <= 0:
        raise PublisherError(f"{label} timestamp is malformed")
    return timestamp


def _required_checks_evidence(
    candidate: TrustedCommit,
    pr: PublishedPullRequest,
    config: PublisherConfig,
    *,
    runner: Any,
) -> dict[str, Any] | None:
    workflow_result = _gh(
        "api",
        f"repos/{config.repository}/actions/workflows/e2e-tests.yml",
        cwd=Path(candidate.workspace),
        runner=runner,
    )
    workflow = _bounded_json(workflow_result, "workflow identity")
    if not isinstance(workflow, dict):
        raise PublisherError("workflow identity readback is malformed")
    workflow_id = workflow.get("id")
    if (
        not _positive_int(workflow_id)
        or workflow.get("name") != config.e2e_workflow_name
        or workflow.get("path") != config.e2e_workflow_path
        or workflow.get("state") != "active"
    ):
        return None

    runs_result = _gh(
        "api",
        (
            f"repos/{config.repository}/actions/workflows/{workflow_id}/runs?head_sha={candidate.head_sha}"
            "&event=pull_request&per_page=100"
        ),
        cwd=Path(candidate.workspace),
        runner=runner,
    )
    runs_payload = _bounded_json(runs_result, "workflow runs")
    runs = runs_payload.get("workflow_runs") if isinstance(runs_payload, dict) else None
    total_runs = runs_payload.get("total_count") if isinstance(runs_payload, dict) else None
    if not isinstance(runs, list) or type(total_runs) is not int or total_runs != len(runs):
        raise PublisherError("workflow runs readback is malformed")
    repository_url = f"https://api.github.com/repos/{config.repository}"

    def exact_pull_binding(item: Any) -> bool:
        if not isinstance(item, dict) or item.get("number") != pr.number:
            return False
        head = item.get("head")
        base = item.get("base")
        return (
            isinstance(head, dict)
            and isinstance(base, dict)
            and head.get("sha") == candidate.head_sha
            and head.get("ref") == candidate.branch
            and isinstance(head.get("repo"), dict)
            and head["repo"].get("url") == repository_url
            and base.get("sha") == pr.base_sha
            and base.get("ref") == config.base_branch
            and isinstance(base.get("repo"), dict)
            and base["repo"].get("url") == repository_url
        )

    matching_runs = [
        item
        for item in runs
        if isinstance(item, dict)
        and _positive_int(item.get("id"))
        and item.get("workflow_id") == workflow_id
        and item.get("name") == config.e2e_workflow_name
        and item.get("path") == config.e2e_workflow_path
        and item.get("event") == "pull_request"
        and _positive_int(item.get("run_attempt"))
        and _positive_int(item.get("check_suite_id"))
        and item.get("head_sha") == candidate.head_sha
        and item.get("head_branch") == candidate.branch
        and isinstance(item.get("pull_requests"), list)
        and len(item["pull_requests"]) == 1
        and exact_pull_binding(item["pull_requests"][0])
    ]
    if not matching_runs:
        return None
    selected_run = max(matching_runs, key=lambda item: (item["id"], item["run_attempt"]))
    if selected_run.get("status") != "completed" or selected_run.get("conclusion") != "success":
        return None
    run_id = selected_run["id"]
    run_attempt = selected_run["run_attempt"]
    check_suite_id = selected_run["check_suite_id"]
    completed_at = _github_timestamp(
        selected_run.get("completed_at"), label="workflow completion"
    )

    jobs_result = _gh(
        "api",
        f"repos/{config.repository}/actions/runs/{run_id}/attempts/{run_attempt}/jobs?per_page=100",
        cwd=Path(candidate.workspace),
        runner=runner,
    )
    jobs_payload = _bounded_json(jobs_result, "workflow jobs")
    jobs = jobs_payload.get("jobs") if isinstance(jobs_payload, dict) else None
    total_jobs = jobs_payload.get("total_count") if isinstance(jobs_payload, dict) else None
    if not isinstance(jobs, list) or type(total_jobs) is not int or total_jobs != len(jobs):
        raise PublisherError("workflow jobs readback is malformed")
    required_job_ids: list[int] = []
    required_jobs: list[dict[str, Any]] = []
    for required in config.required_checks:
        matching_jobs = [
            item
            for item in jobs
            if isinstance(item, dict) and item.get("name") == required and _positive_int(item.get("id"))
        ]
        if len(matching_jobs) != 1:
            return None
        job = matching_jobs[0]
        if (
            job.get("run_id") != run_id
            or job.get("run_attempt") != run_attempt
            or job.get("head_sha") != candidate.head_sha
            or job.get("workflow_name") != config.e2e_workflow_name
            or job.get("status") != "completed"
            or job.get("conclusion") != "success"
            or job.get("check_run_url")
            != f"https://api.github.com/repos/{config.repository}/check-runs/{job['id']}"
        ):
            return None
        check_result = _gh(
            "api",
            f"repos/{config.repository}/check-runs/{job['id']}",
            cwd=Path(candidate.workspace),
            runner=runner,
        )
        check = _bounded_json(check_result, f"{required} check run")
        if not isinstance(check, dict) or check.get("id") != job["id"] or check.get("name") != required:
            return None
        app = check.get("app")
        suite = check.get("check_suite")
        if (
            check.get("head_sha") != candidate.head_sha
            or check.get("status") != "completed"
            or check.get("conclusion") != "success"
            or not isinstance(app, dict)
            or app.get("id") != config.required_check_app_id
            or app.get("slug") != config.required_check_app_slug
            or not isinstance(suite, dict)
            or suite.get("id") != check_suite_id
        ):
            return None
        required_job_ids.append(job["id"])
        required_jobs.append({
            "job_id": job["id"],
            "check_run_id": check["id"],
            "workflow_id": workflow_id,
            "workflow_run_id": run_id,
            "run_attempt": run_attempt,
            "check_suite_id": check_suite_id,
            "name": required,
            "status": "completed",
            "conclusion": "success",
            "head_sha": candidate.head_sha,
            "app": {
                "id": config.required_check_app_id,
                "slug": config.required_check_app_slug,
            },
        })
    return {
        "workflow_id": workflow_id,
        "workflow_name": config.e2e_workflow_name,
        "workflow_path": config.e2e_workflow_path,
        "run_id": run_id,
        "newest_run_id_for_workflow_and_head": run_id,
        "run_attempt": run_attempt,
        "check_suite_id": check_suite_id,
        "event": "pull_request",
        "head_sha": candidate.head_sha,
        "status": "completed",
        "conclusion": "success",
        "completed_at": completed_at,
        "required_job_ids": required_job_ids,
        "required_jobs": required_jobs,
    }


def _required_checks_green(
    candidate: TrustedCommit,
    pr: PublishedPullRequest,
    config: PublisherConfig,
    *,
    runner: Any,
) -> bool:
    return _required_checks_evidence(
        candidate, pr, config, runner=runner
    ) is not None


def collect_broker_remote_readback(
    candidate: TrustedCommit,
    pr: PublishedPullRequest,
    config: PublisherConfig,
    *,
    runner: Any = subprocess.run,
) -> dict[str, Any]:
    """Build the exact GitHub evidence object accepted by the broker CAS."""

    if (
        candidate.remote_repository is None
        or candidate.target_base_sha is None
        or "ready-for-gate" not in pr.labels
        or pr.number <= 0
        or pr.head_sha != candidate.head_sha
        or pr.branch != candidate.branch
        or pr.base != config.base_branch
        or pr.base_sha != candidate.target_base_sha
    ):
        raise PublisherError("labeled pull request does not bind the broker receipt")
    repository_binding = _exact_broker_remote_repository(
        candidate.remote_repository, config
    )
    workflow = _required_checks_evidence(
        candidate, pr, config, runner=runner
    )
    if workflow is None or workflow["workflow_id"] != config.required_workflow_id:
        raise PublisherError("exact-head CI evidence is no longer green")

    repository_payload = _bounded_json(
        _gh(
            "api",
            f"repos/{config.repository}",
            cwd=Path(candidate.workspace),
            runner=runner,
        ),
        "GitHub repository",
    )
    owner, name = config.repository.split("/", 1)
    if (
        not isinstance(repository_payload, dict)
        or repository_payload.get("id") != config.github_repository_id
        or repository_payload.get("name") != name
        or repository_payload.get("full_name") != config.repository
        or repository_payload.get("html_url")
        != f"https://github.com/{config.repository}"
        or repository_payload.get("fork") is not False
        or not isinstance(repository_payload.get("owner"), dict)
        or repository_payload["owner"].get("login") != owner
    ):
        raise PublisherError("live GitHub repository identity does not match policy")

    pull_payload = _bounded_json(
        _gh(
            "api",
            f"repos/{config.repository}/pulls/{pr.number}",
            cwd=Path(candidate.workspace),
            runner=runner,
        ),
        "GitHub pull request",
    )
    head = pull_payload.get("head") if isinstance(pull_payload, dict) else None
    base = pull_payload.get("base") if isinstance(pull_payload, dict) else None
    head_repository = head.get("repo") if isinstance(head, dict) else None
    labels = pull_payload.get("labels") if isinstance(pull_payload, dict) else None
    label_names = (
        [item.get("name") for item in labels if isinstance(item, dict)]
        if isinstance(labels, list)
        else []
    )
    if (
        not isinstance(pull_payload, dict)
        or pull_payload.get("number") != pr.number
        or pull_payload.get("html_url") != pr.url
        or pull_payload.get("state") != "open"
        or pull_payload.get("draft") is not False
        or not isinstance(head, dict)
        or head.get("ref") != candidate.branch
        or head.get("sha") != candidate.head_sha
        or not isinstance(head_repository, dict)
        or head_repository.get("full_name") != config.repository
        or head_repository.get("fork") is not False
        or not isinstance(base, dict)
        or base.get("ref") != config.base_branch
        or base.get("sha") != candidate.target_base_sha
        or "ready-for-gate" not in label_names
    ):
        raise PublisherError("live pull request does not bind exact branch/base/head")

    events = _bounded_json(
        _gh(
            "api",
            f"repos/{config.repository}/issues/{pr.number}/events?per_page=100",
            cwd=Path(candidate.workspace),
            runner=runner,
        ),
        "ready label events",
    )
    if not isinstance(events, list) or len(events) >= 100:
        raise PublisherError("ready label event enumeration is incomplete")
    expected_actor = {
        "id": config.ready_label_actor_id,
        "login": config.ready_label_actor_login,
        "type": config.ready_label_actor_type,
    }
    candidates: list[tuple[int, int, str, Any]] = []
    for item in events:
        if not isinstance(item, dict) or item.get("event") not in (
            "labeled",
            "unlabeled",
        ):
            continue
        label = item.get("label")
        if not isinstance(label, dict) or label.get("name") != "ready-for-gate":
            continue
        if not _positive_int(item.get("id")):
            raise PublisherError("ready label event identity is malformed")
        actor = item.get("actor")
        normalized_actor = (
            {
                "id": actor.get("id"),
                "login": actor.get("login"),
                "type": actor.get("type"),
            }
            if isinstance(actor, dict)
            else None
        )
        created_at = _github_timestamp(
            item.get("created_at"), label="ready label event"
        )
        candidates.append((created_at, item["id"], item["event"], normalized_actor))
    if not candidates:
        raise PublisherError("post-CI ready label actor event is unavailable")
    label_created_at, label_event_id, label_event, label_actor = max(
        candidates, key=lambda item: (item[0], item[1])
    )
    if label_event != "labeled":
        raise PublisherError("latest ready-for-gate event removed readiness")
    if label_created_at < workflow["completed_at"]:
        raise PublisherError("ready label event predates exact-head CI completion")
    if label_actor != expected_actor:
        raise PublisherError("ready label event actor does not match policy")
    readback_at = max(int(time.time()), label_created_at)
    return {
        "contract": "hermes.github_publish_readback.v1",
        "repository": repository_binding,
        "pull_request": {
            "number": pr.number,
            "url": pr.url,
            "state": "open",
            "is_draft": False,
            "head_repository_full_name": config.repository,
            "head_repository_is_fork": False,
            "head_ref": candidate.branch,
            "head_ref_full": f"refs/heads/{candidate.branch}",
            "base_ref": config.base_branch,
            "base_ref_full": f"refs/heads/{config.base_branch}",
            "base_sha": candidate.target_base_sha,
            "head_sha": candidate.head_sha,
        },
        "workflow": workflow,
        "ready_label": {
            "name": "ready-for-gate",
            "present": True,
            "label_event_id": label_event_id,
            "actor": label_actor,
            "pull_request_number": pr.number,
            "head_sha": candidate.head_sha,
            "workflow_run_id": workflow["run_id"],
            "check_suite_id": workflow["check_suite_id"],
            "event_created_at": label_created_at,
            "readback_at": readback_at,
        },
    }


def ensure_ready_label(
    candidate: TrustedCommit,
    pr: PublishedPullRequest,
    config: PublisherConfig,
    kb: Any | None = None,
    conn: Any | None = None,
    *,
    runner: Any = subprocess.run,
) -> PublishedPullRequest:
    """Apply readiness only after current exact-head CI and PR readback."""
    validate_local_candidate(candidate, config, runner=runner)
    if (
        _remote_head(candidate, config, runner=runner) != candidate.head_sha
        or _remote_target_base(candidate, config, runner=runner) != pr.base_sha
    ):
        raise PublisherPending("remote publication snapshot is not exact")
    if kb is not None:
        _revalidate_candidate(candidate, config, kb, conn)
    current = _read_pr(
        pr.number,
        candidate,
        config,
        expected_base_sha=pr.base_sha,
        runner=runner,
    )
    attempted = False
    observed_label = "ready-for-gate" in current.labels
    try:
        if not _required_checks_green(candidate, pr, config, runner=runner):
            raise PublisherPending("required exact-head check suite is not green")
        if "ready-for-gate" not in current.labels:
            validate_local_candidate(candidate, config, runner=runner)
            attempted = True
        if attempted:
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
        validate_local_candidate(candidate, config, runner=runner)
        if (
            _remote_head(candidate, config, runner=runner) != candidate.head_sha
            or _remote_target_base(candidate, config, runner=runner) != pr.base_sha
        ):
            raise PublisherError("remote publication snapshot changed after readiness write")
        if kb is not None:
            _revalidate_candidate(candidate, config, kb, conn)
        if not _required_checks_green(candidate, pr, config, runner=runner):
            raise PublisherError("exact CI evidence changed after readiness write")
        readback = _read_pr(
            pr.number,
            candidate,
            config,
            expected_base_sha=pr.base_sha,
            runner=runner,
        )
        if "ready-for-gate" not in readback.labels:
            raise PublisherError("ready-for-gate label lacked exact authoritative readback")
    except Exception:
        if not attempted and not observed_label:
            raise
        _compensate_ready_label(candidate, pr, config, runner=runner)
        raise
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


def _claim_publisher_authority(
    candidate: TrustedCommit,
    config: PublisherConfig,
    kb: Any,
    conn: Any,
) -> dict[str, Any]:
    """Acquire/reuse the runtime's durable exact publisher authority claim."""
    claim = getattr(kb, "claim_trusted_publisher_authority", None)
    if not callable(claim):
        raise PublisherPending(
            "PENDING_HERMES_RUNTIME: durable trusted-publisher authority claim/CAS "
            "support is not installed"
        )
    try:
        receipt = claim(
            conn,
            contract=AUTHORITY_REQUEST_CONTRACT,
            publisher_contract=CONTRACT,
            blocked_marker=BLOCKED_MARKER,
            expected_repository=config.repository,
            task_id=candidate.task_id,
            expected_board=config.board,
            expected_project_id=candidate.project_id,
            expected_workspace_path=candidate.workspace,
            expected_branch_name=candidate.branch,
            expected_run_id=candidate.run_id,
            expected_base_sha=candidate.base_sha,
            expected_head_sha=candidate.head_sha,
            expected_changed_paths=list(candidate.changed_paths),
        )
    except TypeError as error:
        raise PublisherPending(
            "PENDING_HERMES_RUNTIME: installed trusted-publisher authority API does "
            "not implement the exact v1 claim contract"
        ) from error
    if (
        isinstance(receipt, dict)
        and receipt.get("contract") == AUTHORITY_CLAIM_CONTRACT
        and receipt.get("status") == "conflict"
    ):
        raise PublisherError("durable trusted-publisher authority claim conflicted")
    expected = {
        "contract": AUTHORITY_CLAIM_CONTRACT,
        "status": "claimed",
        "repository": config.repository,
        "task_id": candidate.task_id,
        "run_id": candidate.run_id,
        "board": config.board,
        "project_id": candidate.project_id,
        "workspace": candidate.workspace,
        "branch": candidate.branch,
        "base_sha": candidate.base_sha,
        "head_sha": candidate.head_sha,
        "changed_paths": list(candidate.changed_paths),
    }
    if (
        not isinstance(receipt, dict)
        or set(receipt)
        != {*expected, "claim_id", "host_receipt_id", "host_receipt_signature"}
        or any(receipt.get(key) != value for key, value in expected.items())
        or not isinstance(receipt.get("claim_id"), str)
        or not receipt["claim_id"]
        or len(receipt["claim_id"]) > 512
        or any(character.isspace() for character in receipt["claim_id"])
        or not isinstance(receipt.get("host_receipt_id"), str)
        or not TASK_ID_PATTERN.fullmatch(receipt["host_receipt_id"])
        or not isinstance(receipt.get("host_receipt_signature"), str)
        or not re.fullmatch(r"[A-Za-z0-9+/]{86}==", receipt["host_receipt_signature"])
    ):
        raise PublisherPending(
            "PENDING_HERMES_RUNTIME: durable trusted-publisher authority claim did "
            "not return the exact v1 receipt"
        )
    verify = getattr(kb, "verify_trusted_publisher_authority_receipt", None)
    if not callable(verify):
        raise PublisherPending(
            "PENDING_HERMES_RUNTIME: installed trusted-publisher authority API does "
            "not expose host receipt signature verification"
        )
    try:
        verified = verify(
            conn,
            contract=AUTHORITY_VERIFICATION_REQUEST_CONTRACT,
            receipt=receipt,
            expected_repository=config.repository,
            expected_task_id=candidate.task_id,
            expected_run_id=candidate.run_id,
            expected_board=config.board,
            expected_project_id=candidate.project_id,
            expected_workspace_path=candidate.workspace,
            expected_branch_name=candidate.branch,
            expected_base_sha=candidate.base_sha,
            expected_head_sha=candidate.head_sha,
            expected_changed_paths=list(candidate.changed_paths),
        )
    except TypeError as error:
        raise PublisherPending(
            "PENDING_HERMES_RUNTIME: installed trusted-publisher authority receipt "
            "verifier does not implement the exact v1 contract"
        ) from error
    expected_verification = {
        "contract": AUTHORITY_VERIFICATION_CONTRACT,
        "status": "verified",
        "claim_id": receipt["claim_id"],
        "host_receipt_id": receipt["host_receipt_id"],
    }
    if (
        not isinstance(verified, dict)
        or set(verified) != set(expected_verification)
        or any(verified.get(key) != value for key, value in expected_verification.items())
    ):
        raise PublisherPending(
            "PENDING_HERMES_RUNTIME: trusted-publisher host receipt signature was "
            "not verified exactly"
        )
    return receipt


def _exact_parent_ids(kb: Any, conn: Any, task_id: str) -> list[str]:
    parents = kb.parent_ids(conn, task_id)
    if not isinstance(parents, list) or not all(
        isinstance(item, str) and TASK_ID_PATTERN.fullmatch(item) for item in parents
    ):
        raise PublisherError("Kanban parent relation readback is malformed")
    return parents


def _ensure_exact_comment(
    kb: Any,
    conn: Any,
    task_id: str,
    author: str,
    body: str,
) -> int:
    matches = [
        item
        for item in kb.list_comments(conn, task_id)
        if getattr(item, "task_id", None) == task_id
        and getattr(item, "author", None) == author
        and getattr(item, "body", None) == body
        and _positive_int(getattr(item, "id", None))
    ]
    if len(matches) > 1:
        raise PublisherError("publisher audit comment is duplicated")
    if not matches:
        comment_id = kb.add_comment(conn, task_id, author, body)
        if not _positive_int(comment_id):
            raise PublisherError("publisher audit comment failed durable write")
    readback = [
        item
        for item in kb.list_comments(conn, task_id)
        if getattr(item, "task_id", None) == task_id
        and getattr(item, "author", None) == author
        and getattr(item, "body", None) == body
        and _positive_int(getattr(item, "id", None))
    ]
    if len(readback) != 1:
        raise PublisherError("publisher audit comment failed exact durable readback")
    return readback[0].id


def _recover_committed_lifecycle_completion(
    *,
    candidate: TrustedCommit,
    pr: PublishedPullRequest,
    config: PublisherConfig,
    kb: Any,
    conn: Any,
    tracker_id: str,
    tracker_status: str,
    existing_tracker: bool,
    relation_task: str,
    expected_parents: list[str],
    comment_id: int,
    comment: str,
    completion: str,
    runner: Any,
    current_pr: PublishedPullRequest | None = None,
) -> bool:
    """Resolve a lost CAS response from independent terminal readbacks.

    The host CAS may commit immediately before its client connection fails.
    Removing the label in that state would strand a completed task, so this
    path accepts only the exact task/tracker/relation/comment/PR state and
    restores the readiness label only on that exact open PR when necessary.
    """
    implementation = kb.get_task(conn, candidate.task_id)
    if implementation is None or getattr(implementation, "status", None) != "done":
        return False
    if getattr(implementation, "result", None) != completion:
        raise PublisherCompletionAmbiguous(
            "UNSAFE_COMPLETION_STATE: terminal implementation result is not exact"
        )
    tracker = kb.get_task(conn, tracker_id)
    if (
        tracker is None
        or getattr(tracker, "status", None) != tracker_status
        or not isinstance(getattr(tracker, "body", None), str)
        or not _has_exact_pr_reference(tracker.body, pr.number)
        or (
            not existing_tracker
            and not _has_exact_sha_reference(tracker.body, candidate.head_sha)
        )
        or _exact_parent_ids(kb, conn, relation_task) != expected_parents
    ):
        raise PublisherCompletionAmbiguous(
            "UNSAFE_COMPLETION_STATE: terminal release tracker authority is not exact"
        )
    comments = [
        item
        for item in kb.list_comments(conn, candidate.task_id)
        if getattr(item, "id", None) == comment_id
        and getattr(item, "task_id", None) == candidate.task_id
        and getattr(item, "author", None) == "radulator-trusted-publisher"
        and getattr(item, "body", None) == comment
    ]
    if len(comments) != 1:
        raise PublisherCompletionAmbiguous(
            "UNSAFE_COMPLETION_STATE: terminal audit comment is not exact"
        )
    if current_pr is None:
        current_pr = _read_pr(
            pr.number,
            candidate,
            config,
            expected_base_sha=pr.base_sha,
            runner=runner,
        )
    observed_label = "ready-for-gate" in current_pr.labels
    attempted_label = False
    try:
        if not _required_checks_green(candidate, pr, config, runner=runner):
            raise PublisherCompletionAmbiguous(
                "UNSAFE_COMPLETION_STATE: terminal exact-head CI is not green"
            )
        if not observed_label:
            attempted_label = True
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
        current_pr = _read_pr(
            pr.number,
            candidate,
            config,
            expected_base_sha=pr.base_sha,
            runner=runner,
        )
        if "ready-for-gate" not in current_pr.labels:
            raise PublisherCompletionAmbiguous(
                "UNSAFE_COMPLETION_STATE: terminal PR readiness could not be restored"
            )
        if not _required_checks_green(candidate, pr, config, runner=runner):
            raise PublisherCompletionAmbiguous(
                "UNSAFE_COMPLETION_STATE: terminal exact-head CI changed after readiness"
            )
    except Exception as recovery_error:
        if observed_label or attempted_label:
            try:
                _compensate_ready_label(candidate, pr, config, runner=runner)
            except Exception as cleanup_error:
                raise PublisherCompletionAmbiguous(
                    "UNSAFE_LABEL_STATE: terminal readiness absence could not be proven"
                ) from cleanup_error
        if isinstance(recovery_error, PublisherCompletionAmbiguous):
            raise
        raise PublisherCompletionAmbiguous(
            "UNSAFE_COMPLETION_STATE: terminal CI/readiness proof remains pending"
        ) from recovery_error
    _ensure_exact_comment(
        kb,
        conn,
        candidate.task_id,
        "radulator-trusted-publisher",
        _terminal_verification_comment(
            pr.number, candidate.head_sha, tracker_id
        ),
    )
    return True


def _terminal_verification_comment(
    pr_number: int, head_sha: str, tracker_id: str
) -> str:
    return (
        "TRUSTED_PUBLISHER_COMPLETION_VERIFIED v1 "
        f"PR #{pr_number}; exact head {head_sha}; release tracker {tracker_id}; "
        "ready-for-gate read back."
    )


def recover_terminal_completion_obligation(
    config: PublisherConfig,
    kb: Any,
    conn: Any,
    *,
    runner: Any = subprocess.run,
) -> dict[str, Any] | None:
    """Hold until Hermes exposes a bounded host-authenticated obligation query.

    A terminal task result is model-controlled prose and therefore cannot be a
    recovery carrier.  The reviewed dedicated broker currently has no RPC that
    lists incomplete completion acknowledgements with an authenticated receipt,
    so this release must not infer or scan for them.
    """
    del config, kb, conn, runner
    raise PublisherPending(
        "PENDING_HERMES_RUNTIME: bounded host-authenticated trusted-publisher "
        "completion-obligation query is not installed"
    )


def complete_lifecycle_handoff(
    candidate: TrustedCommit,
    pr: PublishedPullRequest,
    config: PublisherConfig,
    kb: Any,
    conn: Any,
    *,
    authority: dict[str, Any] | None = None,
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
    if authority is None:
        authority = _claim_publisher_authority(candidate, config, kb, conn)
    else:
        expected_authority = {
            "contract": AUTHORITY_CLAIM_CONTRACT,
            "status": "claimed",
            "repository": config.repository,
            "task_id": candidate.task_id,
            "run_id": candidate.run_id,
            "board": config.board,
            "project_id": candidate.project_id,
            "workspace": candidate.workspace,
            "branch": candidate.branch,
            "base_sha": candidate.base_sha,
            "head_sha": candidate.head_sha,
            "changed_paths": list(candidate.changed_paths),
        }
        if (
            set(authority)
            != {
                *expected_authority,
                "claim_id",
                "host_receipt_id",
                "host_receipt_signature",
            }
            or any(
                authority.get(key) != value
                for key, value in expected_authority.items()
            )
            or not isinstance(authority.get("claim_id"), str)
            or not authority["claim_id"]
            or not isinstance(authority.get("host_receipt_id"), str)
            or not TASK_ID_PATTERN.fullmatch(authority["host_receipt_id"])
            or not isinstance(authority.get("host_receipt_signature"), str)
            or not re.fullmatch(
                r"[A-Za-z0-9+/]{86}==", authority["host_receipt_signature"]
            )
        ):
            raise PublisherError("lifecycle handoff authority receipt is not exact")
    _revalidate_candidate(candidate, config, kb, conn)
    current_pr = _read_pr(
        pr.number,
        candidate,
        config,
        expected_base_sha=pr.base_sha,
        runner=runner,
    )
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
            and value.get("state") == "needs_fix"
            and value.get("head_sha") == candidate.base_sha
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
        bootstrap_tracker = kb.get_task(conn, tracker_id)
        if (
            bootstrap_tracker is None
            or getattr(bootstrap_tracker, "status", None)
            not in {"triage", "todo", "scheduled", "ready", "running", "blocked", "review"}
            or not isinstance(getattr(bootstrap_tracker, "body", None), str)
            or not _has_exact_pr_reference(bootstrap_tracker.body, pr.number)
            or not _has_exact_sha_reference(bootstrap_tracker.body, candidate.head_sha)
            or _exact_parent_ids(kb, conn, tracker_id) != [candidate.task_id]
        ):
            raise PublisherError("release tracker failed exact bootstrap readback")
        if config.ledger_path is None:
            raise PublisherError("release lifecycle ledger is required for a new tracker")
        seed_key = f"radulator-feedback:{tracker_id}:pr-{pr.number}:{candidate.head_sha}"
        evidence = {
            "contract": "radulator.trusted_publisher.lifecycle-seed.v1",
            "pr": pr.number,
            "head_sha": candidate.head_sha,
            "implementation_task_id": candidate.task_id,
        }
        appended_result = _run(
            [
                sys.executable,
                str(config.lifecycle_controller),
                "append",
                "--ledger",
                str(config.ledger_path),
                "--idempotency-key",
                seed_key,
                "--source-id",
                candidate.task_id,
                "--task-id",
                tracker_id,
                "--state",
                "feedback",
                "--pr",
                str(pr.number),
                "--head-sha",
                candidate.head_sha,
                "--evidence-json",
                json.dumps(evidence, sort_keys=True, separators=(",", ":")),
            ],
            cwd=config.project_root,
            runner=runner,
            env=lifecycle_env,
        )
        appended = _bounded_json(appended_result, "release lifecycle seed")
        if not isinstance(appended, dict) or any(
            appended.get(key) != value
            for key, value in {
                "idempotency_key": seed_key,
                "source_id": candidate.task_id,
                "task_id": tracker_id,
                "state": "feedback",
                "pr": pr.number,
                "head_sha": candidate.head_sha,
            }.items()
        ):
            raise PublisherError("release lifecycle seed failed exact readback")
        replay_seed_result = _run(
            [
                sys.executable,
                str(config.lifecycle_controller),
                "replay",
                "--ledger",
                str(config.ledger_path),
                "--task-id",
                tracker_id,
            ],
            cwd=config.project_root,
            runner=runner,
            env=lifecycle_env,
        )
        replay_seed = _bounded_json(replay_seed_result, "release lifecycle seed replay")
        if not isinstance(replay_seed, dict) or any(
            replay_seed.get(key) != value
            for key, value in {
                "idempotency_key": seed_key,
                "source_id": candidate.task_id,
                "task_id": tracker_id,
                "state": "feedback",
                "pr": pr.number,
                "head_sha": candidate.head_sha,
            }.items()
        ):
            raise PublisherError("release lifecycle seed replay is not exact")
    tracker = kb.get_task(conn, tracker_id)
    if (
        tracker is None
        or getattr(tracker, "status", None) not in {"triage", "todo", "scheduled", "ready", "running", "blocked", "review"}
        or not isinstance(getattr(tracker, "body", None), str)
        or not _has_exact_pr_reference(tracker.body, pr.number)
        or (not existing_tracker and not _has_exact_sha_reference(tracker.body, candidate.head_sha))
    ):
        raise PublisherError("release tracker failed exact nonterminal task readback")
    expected_parents = [tracker_id] if existing_tracker else [candidate.task_id]
    relation_task = candidate.task_id if existing_tracker else tracker_id
    if _exact_parent_ids(kb, conn, relation_task) != expected_parents:
        raise PublisherError("release tracker lineage failed exact relation readback")
    if existing_tracker:
        _ensure_exact_comment(
            kb,
            conn,
            tracker_id,
            "radulator-trusted-publisher",
            (
                "TRUSTED_PUBLISHER_CORRECTION v1 "
                f"PR #{pr.number}; prior head {candidate.base_sha}; "
                f"corrected head {candidate.head_sha}; implementation task {candidate.task_id}."
            ),
        )

    current_pr = _read_pr(
        pr.number,
        candidate,
        config,
        expected_base_sha=pr.base_sha,
        runner=runner,
    )
    if "ready-for-gate" not in current_pr.labels:
        raise PublisherError("lifecycle handoff lost the exact readiness label")

    comment = (
        "TRUSTED_PUBLISHER v1 publication verified. "
        f"PR {pr.url}; exact head {candidate.head_sha}; release tracker {tracker_id}."
    )
    comment_id = _ensure_exact_comment(
        kb,
        conn,
        candidate.task_id,
        "radulator-trusted-publisher",
        comment,
    )
    _revalidate_candidate(candidate, config, kb, conn)
    final_pr = _read_pr(
        pr.number,
        candidate,
        config,
        expected_base_sha=pr.base_sha,
        runner=runner,
    )
    if "ready-for-gate" not in final_pr.labels:
        raise PublisherError("implementation completion lost exact readiness authority")
    completion = (
        "TRUSTED_PUBLISHER v1\n"
        f"PR: {pr.url}\n"
        f"Exact head: {candidate.head_sha}\n"
        f"Release tracker: {tracker_id}"
    )
    final_tracker = kb.get_task(conn, tracker_id)
    tracker_status = getattr(final_tracker, "status", None)
    if (
        final_tracker is None
        or tracker_status
        not in {"triage", "todo", "scheduled", "ready", "running", "blocked", "review"}
        or not isinstance(getattr(final_tracker, "body", None), str)
        or not _has_exact_pr_reference(final_tracker.body, pr.number)
        or (not existing_tracker and not _has_exact_sha_reference(final_tracker.body, candidate.head_sha))
        or _exact_parent_ids(kb, conn, relation_task) != expected_parents
    ):
        raise PublisherError("final release tracker authority is not exact")
    complete_authority = getattr(kb, "complete_trusted_publisher_authority", None)
    if not callable(complete_authority):
        raise PublisherPending(
            "PENDING_HERMES_RUNTIME: durable trusted-publisher authority completion "
            "CAS support is not installed"
        )
    completion_metadata = {
        "contract": "radulator.trusted_publisher.completion.v1",
        "pr": pr.number,
        "head_sha": candidate.head_sha,
        "release_tracker_id": tracker_id,
    }
    completion_error: Exception | None = None
    try:
        completed = complete_authority(
            conn,
            contract=COMPLETION_CAS_CONTRACT,
            claim_id=authority["claim_id"],
            host_receipt_id=authority["host_receipt_id"],
            host_receipt_signature=authority["host_receipt_signature"],
            expected_repository=config.repository,
            expected_board=config.board,
            task_id=candidate.task_id,
            expected_status="blocked",
            expected_block_kind="capability",
            expected_project_id=candidate.project_id,
            expected_workspace_path=candidate.workspace,
            expected_branch_name=candidate.branch,
            expected_run_id=candidate.run_id,
            expected_base_sha=candidate.base_sha,
            expected_head_sha=candidate.head_sha,
            expected_changed_paths=list(candidate.changed_paths),
            expected_tracker_id=tracker_id,
            expected_tracker_status=tracker_status,
            relation_task_id=relation_task,
            expected_parent_ids=expected_parents,
            expected_comment_id=comment_id,
            expected_comment_author="radulator-trusted-publisher",
            expected_comment_body=comment,
            result=completion,
            summary=completion,
            metadata=completion_metadata,
        )
    except Exception as error:
        completion_error = error
        completed = None
    expected_completion = {
        "contract": COMPLETION_CAS_CONTRACT,
        "status": "completed",
        "claim_id": authority["claim_id"],
        "host_receipt_id": authority["host_receipt_id"],
        "repository": config.repository,
        "task_id": candidate.task_id,
        "run_id": candidate.run_id,
        "board": config.board,
        "project_id": candidate.project_id,
        "workspace": candidate.workspace,
        "branch": candidate.branch,
        "base_sha": candidate.base_sha,
        "head_sha": candidate.head_sha,
        "changed_paths": list(candidate.changed_paths),
        "tracker_id": tracker_id,
    }
    completion_response_exact = (
        isinstance(completed, dict)
        and set(completed) == set(expected_completion)
        and all(
            completed.get(key) == value
            for key, value in expected_completion.items()
        )
    )
    try:
        recovered = _recover_committed_lifecycle_completion(
            candidate=candidate,
            pr=pr,
            config=config,
            kb=kb,
            conn=conn,
            tracker_id=tracker_id,
            tracker_status=tracker_status,
            existing_tracker=existing_tracker,
            relation_task=relation_task,
            expected_parents=expected_parents,
            comment_id=comment_id,
            comment=comment,
            completion=completion,
            runner=runner,
        )
    except PublisherCompletionAmbiguous:
        raise
    except Exception as recovery_error:
        final_task = kb.get_task(conn, candidate.task_id)
        if (
            completion_response_exact
            or (
                final_task is not None
                and getattr(final_task, "status", None) == "done"
            )
        ):
            raise PublisherCompletionAmbiguous(
                "UNSAFE_COMPLETION_STATE: committed authority could not be read back exactly"
            ) from recovery_error
        if completion_error is not None:
            raise completion_error
        raise PublisherError(
            "implementation task authority CAS was not applied atomically"
        ) from recovery_error
    if recovered:
        return tracker_id
    if completion_response_exact:
        raise PublisherCompletionAmbiguous(
            "UNSAFE_COMPLETION_STATE: completed authority lacked exact terminal readback"
        )
    if completion_error is not None:
        raise completion_error
    raise PublisherError("implementation task authority CAS was not applied atomically")


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
    try:
        terminal_recovery = recover_terminal_completion_obligation(
            config, kb, conn, runner=runner
        )
    except PublisherPending as error:
        if not str(error).startswith("PENDING_HERMES_RUNTIME:"):
            raise
        return {"status": "pending_runtime", "reason": str(error)}
    if terminal_recovery is not None:
        return {"status": "recovered", **terminal_recovery}
    candidate = select_candidate(kb, conn, config.board)
    if candidate is None:
        return {"status": "idle"}
    try:
        authority = _claim_publisher_authority(candidate, config, kb, conn)
    except PublisherPending as error:
        if not str(error).startswith("PENDING_HERMES_RUNTIME:"):
            raise
        return {
            "status": "pending_runtime",
            "task_id": candidate.task_id,
            "head_sha": candidate.head_sha,
            "reason": str(error),
        }
    validate_local_candidate(candidate, config, runner=runner)
    pr = ensure_remote_and_pr(
        candidate,
        config,
        kb,
        conn,
        runner=runner,
    )
    try:
        labeled = ensure_ready_label(
            candidate,
            pr,
            config,
            kb,
            conn,
            runner=runner,
        )
    except PublisherPending:
        return {
            "status": "pending_ci",
            "task_id": candidate.task_id,
            "pr": pr.number,
            "head_sha": candidate.head_sha,
        }
    try:
        tracker_id = complete_lifecycle_handoff(
            candidate,
            labeled,
            config,
            kb,
            conn,
            authority=authority,
            runner=runner,
        )
    except PublisherCompletionAmbiguous:
        raise
    except Exception:
        _compensate_ready_label(candidate, labeled, config, runner=runner)
        raise
    return {
        "status": "published",
        "task_id": candidate.task_id,
        "pr": labeled.number,
        "head_sha": candidate.head_sha,
        "release_tracker_id": tracker_id,
    }


def _validate_broker_acknowledgement_result(
    result: Any,
    *,
    candidate: TrustedCommit,
    expected_remote_readback_sha256: str,
) -> dict[str, Any]:
    fields = {
        "contract",
        "broker_boundary",
        "receipt_id",
        "task_id",
        "run_id",
        "repository_id",
        "branch",
        "base_branch",
        "head_sha",
        "branch_published_from",
        "branch_published_to",
        "repository_base_sha",
        "publish_outcome",
        "cleanup_state",
        "completion_id",
        "completion_payload_sha256",
        "remote_readback_sha256",
    }
    if (
        not isinstance(result, dict)
        or set(result) != fields
        or result.get("contract") != "hermes.publisher_ack.v1"
        or result.get("broker_boundary") != BROKER_BOUNDARY
        or result.get("receipt_id") != candidate.receipt_id
        or result.get("task_id") != candidate.task_id
        or result.get("run_id") != candidate.run_id
        or result.get("repository_id") != candidate.repository_id
        or result.get("branch") != candidate.branch
        or result.get("base_branch") != "develop"
        or result.get("head_sha") != candidate.head_sha
        or result.get("branch_published_from") != candidate.base_sha
        or result.get("branch_published_to") != candidate.head_sha
        or result.get("repository_base_sha") != candidate.target_base_sha
        or result.get("publish_outcome") != "fast_forwarded"
        or result.get("cleanup_state") != "cleaned"
        or not isinstance(result.get("completion_id"), str)
        or not TASK_ID_PATTERN.fullmatch(result["completion_id"])
        or not isinstance(result.get("completion_payload_sha256"), str)
        or not re.fullmatch(r"[0-9a-f]{64}", result["completion_payload_sha256"])
        or not isinstance(result.get("remote_readback_sha256"), str)
        or not re.fullmatch(r"[0-9a-f]{64}", result["remote_readback_sha256"])
        or result["remote_readback_sha256"] != expected_remote_readback_sha256
    ):
        raise PublisherError("broker acknowledgement result is not exact")
    return result


def run_broker_once(
    config: PublisherConfig,
    client: Any,
    *,
    runner: Any = subprocess.run,
) -> dict[str, Any]:
    """Publish at most one broker receipt without reading the Kanban database."""

    candidate = select_broker_obligation(client, config)
    if candidate is None:
        return {"status": "idle"}
    handoff = client.call(
        "export_bundle",
        {
            "receipt_id": candidate.receipt_id,
            "payload_sha256": candidate.receipt_payload_sha256,
        },
    )
    staged = stage_broker_bundle(candidate, handoff, config, runner=runner)
    pr = ensure_remote_and_pr(staged, config, runner=runner)
    try:
        labeled = ensure_ready_label(staged, pr, config, runner=runner)
    except PublisherPending:
        return {
            "status": "pending_ci",
            "task_id": staged.task_id,
            "pr": pr.number,
            "head_sha": staged.head_sha,
        }
    try:
        remote_readback = collect_broker_remote_readback(
            staged, labeled, config, runner=runner
        )
    except Exception:
        _compensate_ready_label(staged, labeled, config, runner=runner)
        raise
    expected_remote_readback_sha256 = hashlib.sha256(
        _canonical_json(remote_readback)
    ).hexdigest()
    acknowledgement = {
        "contract": "hermes.publisher_ack.v1",
        "receipt_id": staged.receipt_id,
        "receipt_payload_sha256": staged.receipt_payload_sha256,
        "bundle_sha256": staged.bundle_sha256,
        "repository_id": staged.repository_id,
        "task_id": staged.task_id,
        "run_id": staged.run_id,
        "branch": staged.branch,
        "base_branch": config.base_branch,
        "base_sha": staged.base_sha,
        "target_base_sha": staged.target_base_sha,
        "head_sha": staged.head_sha,
        "published_head_sha": staged.head_sha,
        "publish_outcome": "fast_forwarded",
        "readback_complete": True,
        "remote_readback": remote_readback,
    }
    try:
        acknowledged = client.call("ack_publish", acknowledgement)
    except Exception as error:
        raise PublisherCompletionAmbiguous(
            "UNSAFE_COMPLETION_STATE: broker acknowledgement response was not read back; "
            "retry the exact receipt without removing readiness"
        ) from error
    verified = _validate_broker_acknowledgement_result(
        acknowledged,
        candidate=staged,
        expected_remote_readback_sha256=expected_remote_readback_sha256,
    )
    return {
        "status": "published",
        "task_id": staged.task_id,
        "pr": labeled.number,
        "head_sha": staged.head_sha,
        "completion_id": verified["completion_id"],
        "completion_payload_sha256": verified["completion_payload_sha256"],
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
    parser.add_argument("--repository-id")
    parser.add_argument("--publisher-state-dir")
    parser.add_argument("--broker-client-config")
    parser.add_argument("--expected-broker-uid", type=int)
    parser.add_argument("--publisher-gid", type=int)
    parser.add_argument("--github-repository-id", type=int)
    parser.add_argument("--workflow-id", type=int)
    parser.add_argument("--ready-label-actor-id", type=int)
    parser.add_argument("--ready-label-actor-login")
    parser.add_argument("--ready-label-actor-type", choices=("User", "Bot"))
    args = parser.parse_args(argv)
    project_root = Path(args.project_root)
    lifecycle_controller = Path(args.lifecycle_controller)
    lock_file = Path(args.lock_file)
    ledger_path = Path(args.ledger)
    publisher_state_dir = (
        Path(args.publisher_state_dir) if args.publisher_state_dir else None
    )
    broker_client_config = (
        Path(args.broker_client_config) if args.broker_client_config else None
    )
    if not project_root.is_absolute() or not project_root.is_dir():
        parser.error("--project-root must be an existing absolute directory")
    if not lifecycle_controller.is_absolute() or not lifecycle_controller.is_file():
        parser.error("--lifecycle-controller must be an existing absolute file")
    if not lock_file.is_absolute():
        parser.error("--lock-file must be absolute")
    if not ledger_path.is_absolute():
        parser.error("--ledger must be absolute")
    if publisher_state_dir is not None and not publisher_state_dir.is_absolute():
        parser.error("--publisher-state-dir must be absolute")
    if broker_client_config is not None and not broker_client_config.is_absolute():
        parser.error("--broker-client-config must be absolute")
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
        repository_id=args.repository_id,
        publisher_state_dir=publisher_state_dir,
        broker_client_config=broker_client_config,
        expected_broker_uid=args.expected_broker_uid,
        publisher_gid=args.publisher_gid,
        github_repository_id=args.github_repository_id,
        required_workflow_id=args.workflow_id,
        ready_label_actor_id=args.ready_label_actor_id,
        ready_label_actor_login=args.ready_label_actor_login,
        ready_label_actor_type=args.ready_label_actor_type,
    )
    return config, lock_file


def main(argv: list[str] | None = None, *, broker_client: Any = None) -> int:
    config, lock_file = parse_runtime_config(argv)
    required_broker = {
        "repository_id": config.repository_id,
        "publisher_state_dir": config.publisher_state_dir,
        "broker_client_config": config.broker_client_config,
        "expected_broker_uid": config.expected_broker_uid,
        "publisher_gid": config.publisher_gid,
        "github_repository_id": config.github_repository_id,
        "required_workflow_id": config.required_workflow_id,
        "ready_label_actor_id": config.ready_label_actor_id,
        "ready_label_actor_login": config.ready_label_actor_login,
        "ready_label_actor_type": config.ready_label_actor_type,
    }
    missing = sorted(key for key, value in required_broker.items() if value is None)
    if missing:
        raise PublisherError(
            "dedicated broker publisher configuration is incomplete: "
            + ", ".join(missing)
        )
    if broker_client is None:
        from hermes_cli.kanban_broker_client import load_broker_client

        broker_client = load_broker_client(
            config.broker_client_config, expected_surface="publisher"
        )
    with publisher_lock(lock_file) as acquired:
        if not acquired:
            print(json.dumps({"status": "busy"}, sort_keys=True, separators=(",", ":")))
            return 0
        result = run_broker_once(config, broker_client)
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
