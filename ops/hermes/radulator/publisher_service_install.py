#!/usr/bin/env python3
"""Provision and activate the credential-isolated Radulator publisher service.

The service is installed disabled-first from a root-owned immutable source
snapshot.  Activation runs only host-side identity and GitHub readback probes;
it never reads or prints a GitHub token.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import plistlib
import re
import stat
import subprocess
import time
from pathlib import Path
from typing import Any, Callable


SERVICE_PLAN_CONTRACT = "radulator.dedicated_publisher_service_plan.v1"
ACTIVATION_CONTRACT = "radulator.dedicated_publisher_activation.v1"
BROKER_BOUNDARY = "hermes.dedicated_broker_identity.v1"
SERVICE_LABEL = "ai.hermes.radulator-publisher"
PRODUCTION_INSTALL_ROOT = Path(
    "/Library/Application Support/HermesKanban/radulator-publisher"
)
PRODUCTION_PUBLISHER_HOME = Path("/var/db/hermes-radulator-publisher")
PRODUCTION_LAUNCHD_PLIST = Path(
    "/Library/LaunchDaemons/ai.hermes.radulator-publisher.plist"
)
REPOSITORY = "momomojo/Radulator"
REPOSITORY_ID = 1027532341
WORKFLOW_ID = 227376261
WORKFLOW_NAME = "E2E Tests"
WORKFLOW_PATH = ".github/workflows/e2e-tests.yml"
READY_LABEL_ACTOR = {"id": 35302851, "login": "momomojo", "type": "User"}
SOURCE_ASSETS = (
    "lifecycle_controller.py",
    "publisher_service_install.py",
    "trusted_publisher.py",
    "trusted_publisher_cron.sh",
)
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
SHA1_RE = re.compile(r"^[0-9a-f]{40}$")
PERSISTENT_DISABLE_READBACK_RE = re.compile(
    r'^[ \t]*["\']?' + re.escape(SERVICE_LABEL) + r'["\']?[ \t]*=>[ \t]*["\']?true["\']?[ \t]*$',
    re.MULTILINE,
)
PERSISTENT_ENABLE_READBACK_RE = re.compile(
    r'^[ \t]*["\']?' + re.escape(SERVICE_LABEL) + r'["\']?[ \t]*=>[ \t]*["\']?false["\']?[ \t]*$',
    re.MULTILINE,
)


class PublisherRollbackSafetyError(ValueError):
    """Activation rollback could not prove the publisher stays persistently disabled."""


class PublisherDeactivationSafetyError(ValueError):
    """Explicit deactivation could not prove the publisher stays persistently disabled."""


class PublisherAttestationRevocationError(ValueError):
    """Activation attestation revocation could not be completed and read back absent.

    Unlike a failed launchd mutation, no later state readback can supersede this
    outcome, so callers must treat it as an unprovable unsafe rollback.
    """


def _absolute(path: Path, label: str) -> Path:
    value = Path(path)
    if not value.is_absolute() or value.parent == value:
        raise ValueError(f"{label} must be an absolute bounded path")
    return value


def _read_file_exact(
    path: Path,
    *,
    expected_uid: int | None = None,
    expected_gid: int | None = None,
    expected_mode: int | None = None,
    immutable_owner: bool = False,
    maximum: int = 16 * 1024 * 1024,
) -> tuple[bytes, os.stat_result]:
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_CLOEXEC", 0)
    descriptor = os.open(path, flags)
    try:
        before = os.fstat(descriptor)
        if (
            not stat.S_ISREG(before.st_mode)
            or before.st_nlink != 1
            or before.st_size < 0
            or before.st_size > maximum
            or (expected_uid is not None and before.st_uid != int(expected_uid))
            or (expected_gid is not None and before.st_gid != int(expected_gid))
            or (
                expected_mode is not None
                and stat.S_IMODE(before.st_mode) != int(expected_mode)
            )
            or (immutable_owner and stat.S_IMODE(before.st_mode) & 0o022)
        ):
            raise ValueError(f"immutable file identity is unsafe: {path}")
        chunks: list[bytes] = []
        total = 0
        while True:
            chunk = os.read(descriptor, min(1024 * 1024, maximum + 1 - total))
            if not chunk:
                break
            chunks.append(chunk)
            total += len(chunk)
            if total > maximum:
                raise ValueError(f"file exceeds bounded size: {path}")
        after = os.fstat(descriptor)
        if (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) != (
            after.st_dev,
            after.st_ino,
            after.st_size,
            after.st_mtime_ns,
        ):
            raise ValueError(f"file changed during immutable read: {path}")
        return b"".join(chunks), before
    finally:
        os.close(descriptor)


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _source_manifest(source_root: Path, *, expected_uid: int) -> tuple[list[dict[str, Any]], str]:
    root = source_root.resolve(strict=True)
    root_info = root.lstat()
    if (
        stat.S_ISLNK(root_info.st_mode)
        or not stat.S_ISDIR(root_info.st_mode)
        or root_info.st_uid != int(expected_uid)
        or stat.S_IMODE(root_info.st_mode) & 0o022
    ):
        raise ValueError("publisher source root is not immutable")
    entries: list[dict[str, Any]] = []
    for name in SOURCE_ASSETS:
        path = root / name
        try:
            content, info = _read_file_exact(
                path, expected_uid=expected_uid, immutable_owner=True
            )
        except (OSError, ValueError) as error:
            raise ValueError(f"publisher source asset is not immutable: {name}") from error
        entries.append(
            {
                "path": name,
                "size": int(info.st_size),
                "sha256": _sha256(content),
                "mode": 0o555 if name.endswith(".sh") else 0o444,
            }
        )
    entries.sort(key=lambda item: item["path"])
    digest = _sha256(
        json.dumps(entries, sort_keys=True, separators=(",", ":")).encode("utf-8")
    )
    return entries, digest


def build_service_plan(
    *,
    source_root: Path,
    install_root: Path,
    publisher_home: Path,
    broker_client_config: Path,
    launchd_plist_path: Path,
    python_executable: Path,
    source_commit_sha: str,
    source_owner_uid: int,
    publisher_user: str,
    publisher_uid: int,
    publisher_group: str,
    publisher_gid: int,
    broker_uid: int,
    model_uid: int,
    model_gid: int,
) -> dict[str, Any]:
    """Build an exact disabled-first service plan from immutable source bytes."""

    source_root = _absolute(source_root, "source root").resolve(strict=True)
    install_root = _absolute(install_root, "install root")
    publisher_home = _absolute(publisher_home, "publisher home")
    broker_client_config = _absolute(broker_client_config, "broker client config")
    launchd_plist_path = _absolute(launchd_plist_path, "launchd plist")
    python_executable = _absolute(python_executable, "publisher Python").resolve(strict=True)
    identities = {int(publisher_uid), int(broker_uid), int(model_uid)}
    if len(identities) != 3 or any(value <= 0 for value in identities):
        raise ValueError("model, broker, and publisher UIDs must be distinct")
    if int(publisher_gid) <= 0 or int(model_gid) <= 0:
        raise ValueError("publisher and model GIDs must be positive")
    if not re.fullmatch(r"_[A-Za-z0-9_-]{1,62}", publisher_user):
        raise ValueError("publisher account name is invalid")
    if not re.fullmatch(r"_[A-Za-z0-9_-]{1,62}", publisher_group):
        raise ValueError("publisher group name is invalid")
    if not SHA1_RE.fullmatch(source_commit_sha):
        raise ValueError("publisher source commit SHA is invalid")
    if (
        install_root == publisher_home
        or install_root in publisher_home.parents
        or publisher_home in install_root.parents
    ):
        raise ValueError("publisher immutable and private roots must be disjoint")
    manifest, manifest_sha = _source_manifest(
        source_root, expected_uid=int(source_owner_uid)
    )
    python_content, _python_info = _read_file_exact(
        python_executable, immutable_owner=True, maximum=128 * 1024 * 1024
    )
    runtime_root = install_root / "runtime"
    state_dir = publisher_home / "state"
    repository_root = publisher_home / "Radulator"
    return {
        "contract": SERVICE_PLAN_CONTRACT,
        "enabled": False,
        "service_label": SERVICE_LABEL,
        "source_root": str(source_root),
        "source_owner_uid": int(source_owner_uid),
        "source_commit_sha": source_commit_sha,
        "install_root": str(install_root),
        "runtime_root": str(runtime_root),
        "publisher_home": str(publisher_home),
        "state_dir": str(state_dir),
        "repository_root": str(repository_root),
        "broker_client_config": str(broker_client_config),
        "launchd_plist_path": str(launchd_plist_path),
        "python_executable": str(python_executable),
        "python_sha256": _sha256(python_content),
        "publisher_user": publisher_user,
        "publisher_uid": int(publisher_uid),
        "publisher_group": publisher_group,
        "publisher_gid": int(publisher_gid),
        "broker_uid": int(broker_uid),
        "model_uid": int(model_uid),
        "model_gid": int(model_gid),
        "repository": REPOSITORY,
        "github_repository_id": REPOSITORY_ID,
        "workflow_id": WORKFLOW_ID,
        "workflow_path": WORKFLOW_PATH,
        "ready_label_actor": dict(READY_LABEL_ACTOR),
        "asset_manifest": manifest,
        "asset_manifest_sha256": manifest_sha,
        "activation_attestation": str(install_root / "activation-attestation.json"),
    }


def _validate_plan(plan: dict[str, Any]) -> None:
    required = {
        "contract",
        "enabled",
        "service_label",
        "source_root",
        "source_owner_uid",
        "source_commit_sha",
        "install_root",
        "runtime_root",
        "publisher_home",
        "state_dir",
        "repository_root",
        "broker_client_config",
        "launchd_plist_path",
        "python_executable",
        "python_sha256",
        "publisher_user",
        "publisher_uid",
        "publisher_group",
        "publisher_gid",
        "broker_uid",
        "model_uid",
        "model_gid",
        "repository",
        "github_repository_id",
        "workflow_id",
        "workflow_path",
        "ready_label_actor",
        "asset_manifest",
        "asset_manifest_sha256",
        "activation_attestation",
    }
    if (
        not isinstance(plan, dict)
        or set(plan) != required
        or plan.get("contract") != SERVICE_PLAN_CONTRACT
        or plan.get("enabled") is not False
        or plan.get("service_label") != SERVICE_LABEL
        or plan.get("repository") != REPOSITORY
        or plan.get("github_repository_id") != REPOSITORY_ID
        or plan.get("workflow_id") != WORKFLOW_ID
        or plan.get("workflow_path") != WORKFLOW_PATH
        or plan.get("ready_label_actor") != READY_LABEL_ACTOR
        or not SHA1_RE.fullmatch(str(plan.get("source_commit_sha") or ""))
        or not SHA256_RE.fullmatch(str(plan.get("asset_manifest_sha256") or ""))
        or not SHA256_RE.fullmatch(str(plan.get("python_sha256") or ""))
        or len({plan.get("publisher_uid"), plan.get("broker_uid"), plan.get("model_uid")}) != 3
        or type(plan.get("model_gid")) is not int
        or plan["model_gid"] <= 0
    ):
        raise ValueError("publisher service plan is not exact")
    for key in (
        "source_root",
        "install_root",
        "runtime_root",
        "publisher_home",
        "state_dir",
        "repository_root",
        "broker_client_config",
        "launchd_plist_path",
        "python_executable",
        "activation_attestation",
    ):
        _absolute(Path(plan[key]), key.replace("_", " "))


def _require_fixed_production_paths(plan: dict[str, Any]) -> None:
    _validate_plan(plan)
    if (
        Path(plan["install_root"]) != PRODUCTION_INSTALL_ROOT
        or Path(plan["publisher_home"]) != PRODUCTION_PUBLISHER_HOME
        or Path(plan["launchd_plist_path"]) != PRODUCTION_LAUNCHD_PLIST
        or Path(plan["activation_attestation"])
        != PRODUCTION_INSTALL_ROOT / "activation-attestation.json"
    ):
        raise ValueError("publisher production plan paths or source authority are unsafe")


def _require_production_plan(plan: dict[str, Any]) -> None:
    """Reject any root activation path that is model-writable or relocatable."""

    _require_fixed_production_paths(plan)
    if plan.get("source_owner_uid") != 0:
        raise ValueError("publisher production source must be root-owned")
    _python, python_info = _read_file_exact(
        Path(plan["python_executable"]),
        expected_uid=0,
        immutable_owner=True,
        maximum=128 * 1024 * 1024,
    )
    if python_info.st_uid != 0:
        raise ValueError("publisher Python runtime must be root-owned")
    source_root = Path(plan["source_root"])
    manifest, manifest_sha = _source_manifest(source_root, expected_uid=0)
    if (
        manifest != plan["asset_manifest"]
        or manifest_sha != plan["asset_manifest_sha256"]
    ):
        raise ValueError("publisher root-owned source snapshot changed")
    git_env = {
        "HOME": "/var/empty",
        "PATH": "/usr/bin:/bin",
        "GIT_CONFIG_GLOBAL": "/dev/null",
        "GIT_CONFIG_SYSTEM": "/dev/null",
        "GIT_TERMINAL_PROMPT": "0",
    }
    identity = subprocess.run(
        [
            "/usr/bin/git",
            "-C",
            str(source_root),
            "rev-parse",
            "--verify",
            "HEAD^{commit}",
        ],
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
        env=git_env,
    )
    clean = subprocess.run(
        ["/usr/bin/git", "-C", str(source_root), "status", "--porcelain=v1"],
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
        env=git_env,
    )
    origin = subprocess.run(
        ["/usr/bin/git", "-C", str(source_root), "remote", "get-url", "origin"],
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
        env=git_env,
    )
    normalized_origin = origin.stdout.strip().removesuffix(".git")
    if (
        identity.returncode != 0
        or identity.stdout.strip() != plan["source_commit_sha"]
        or clean.returncode != 0
        or clean.stdout != ""
        or origin.returncode != 0
        or normalized_origin != f"https://github.com/{REPOSITORY}"
    ):
        raise ValueError(
            "publisher source must be a clean exact root-owned canonical commit"
        )


def render_launchd_plist(plan: dict[str, Any]) -> bytes:
    """Render a secret-free launchd service definition for one publisher UID."""

    _validate_plan(plan)
    runtime_root = Path(plan["runtime_root"])
    state_dir = Path(plan["state_dir"])
    environment = {
        "HOME": plan["publisher_home"],
        "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
        "RADULATOR_PUBLISHER_HOME": plan["publisher_home"],
        "RADULATOR_PUBLISHER_PYTHON": plan["python_executable"],
        "RADULATOR_PUBLISHER_PROJECT_ROOT": plan["repository_root"],
        "RADULATOR_PUBLISHER_STATE_DIR": plan["state_dir"],
        "RADULATOR_BROKER_CLIENT_CONFIG": plan["broker_client_config"],
        "RADULATOR_BROKER_UID": str(plan["broker_uid"]),
        "RADULATOR_PUBLISHER_GID": str(plan["publisher_gid"]),
        "RADULATOR_GITHUB_REPOSITORY_ID": str(REPOSITORY_ID),
        "RADULATOR_GITHUB_WORKFLOW_ID": str(WORKFLOW_ID),
        "RADULATOR_READY_LABEL_ACTOR_ID": str(READY_LABEL_ACTOR["id"]),
        "RADULATOR_READY_LABEL_ACTOR_LOGIN": READY_LABEL_ACTOR["login"],
        "RADULATOR_READY_LABEL_ACTOR_TYPE": READY_LABEL_ACTOR["type"],
        "RADULATOR_PUBLISHER_SERVICE_LOOP": "1",
        "RADULATOR_PUBLISHER_INTERVAL_SECONDS": "60",
    }
    payload = {
        "Label": SERVICE_LABEL,
        "ProgramArguments": [
            "/bin/bash",
            str(runtime_root / "trusted_publisher_cron.sh"),
        ],
        "UserName": plan["publisher_user"],
        "GroupName": plan["publisher_group"],
        "WorkingDirectory": plan["repository_root"],
        "EnvironmentVariables": environment,
        "RunAtLoad": True,
        "KeepAlive": True,
        "ProcessType": "Background",
        "ThrottleInterval": 30,
        "StandardOutPath": str(state_dir / "publisher.stdout.log"),
        "StandardErrorPath": str(state_dir / "publisher.stderr.log"),
    }
    return plistlib.dumps(payload, fmt=plistlib.FMT_XML, sort_keys=True)


def _mkdir_exact(path: Path, *, uid: int, gid: int, mode: int) -> None:
    try:
        existing = path.lstat()
    except FileNotFoundError:
        path.mkdir(parents=True, exist_ok=False, mode=mode)
    else:
        if stat.S_ISLNK(existing.st_mode) or not stat.S_ISDIR(existing.st_mode):
            raise ValueError(f"directory provisioning target is unsafe: {path}")
    flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(path, flags)
    try:
        os.fchown(descriptor, uid, gid)
        os.fchmod(descriptor, mode)
        info = os.fstat(descriptor)
        if (
            not stat.S_ISDIR(info.st_mode)
            or info.st_uid != uid
            or info.st_gid != gid
            or stat.S_IMODE(info.st_mode) != mode
        ):
            raise ValueError(f"directory provisioning failed closed: {path}")
    finally:
        os.close(descriptor)


def _atomic_write(path: Path, content: bytes, *, uid: int, gid: int, mode: int) -> None:
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(temporary, flags, mode)
    try:
        view = memoryview(content)
        while view:
            view = view[os.write(descriptor, view) :]
        os.fsync(descriptor)
        os.fchown(descriptor, uid, gid)
        os.fchmod(descriptor, mode)
    finally:
        os.close(descriptor)
    os.replace(temporary, path)
    directory = os.open(path.parent, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


def _publisher_env(plan: dict[str, Any]) -> dict[str, str]:
    return {
        "HOME": plan["publisher_home"],
        "GH_CONFIG_DIR": str(Path(plan["publisher_home"]) / ".config" / "gh"),
        "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
        "GIT_CONFIG_GLOBAL": "/dev/null",
        "GIT_CONFIG_SYSTEM": "/dev/null",
        "GIT_TERMINAL_PROMPT": "0",
    }


def _run_as_publisher(
    plan: dict[str, Any],
    command: list[str],
    *,
    runner: Callable[..., subprocess.CompletedProcess] = subprocess.run,
) -> subprocess.CompletedProcess:
    return runner(
        command,
        check=False,
        capture_output=True,
        text=True,
        timeout=60,
        env=_publisher_env(plan),
        cwd=plan["repository_root"],
        user=int(plan["publisher_uid"]),
        group=int(plan["publisher_gid"]),
        extra_groups=(),
    )


def provision_service(
    plan: dict[str, Any],
    *,
    runner: Callable[..., subprocess.CompletedProcess] = subprocess.run,
) -> dict[str, Any]:
    """Provision exact assets only after proving the service is booted out and disabled.

    For a ``KeepAlive`` job, process absence is not durable proof and ``disable``
    does not itself unload an already-started process, so the gate issues every
    lifecycle mutation first (disable, attestation revocation, bootout) and only
    then takes its authoritative readbacks.  A raising mutation is inconclusive and
    is superseded solely by those post-mutation readbacks.
    """

    _require_production_plan(plan)
    if os.geteuid() != 0:
        raise PermissionError("publisher service provisioning requires root")
    label = f"system/{SERVICE_LABEL}"
    errors, attestation_revoked, absent, disabled = _disable_publisher(plan, runner, label)
    revocation_errors = [
        error
        for error in errors
        if isinstance(error, PublisherAttestationRevocationError)
    ]
    if not attestation_revoked or revocation_errors:
        raise PublisherAttestationRevocationError(
            "publisher activation attestation revocation did not complete before provisioning"
        ) from (
            revocation_errors[0]
            if revocation_errors
            else errors[0]
            if errors
            else None
        )
    if not absent:
        raise ValueError("publisher service must be booted out before provisioning") from (
            errors[0] if errors else None
        )
    if not disabled:
        raise ValueError(
            "publisher service must be persistently disabled before provisioning"
        ) from (errors[0] if errors else None)
    install_root = Path(plan["install_root"])
    runtime_root = Path(plan["runtime_root"])
    publisher_home = Path(plan["publisher_home"])
    state_dir = Path(plan["state_dir"])
    repository_root = Path(plan["repository_root"])
    _mkdir_exact(install_root, uid=0, gid=0, mode=0o711)
    _mkdir_exact(runtime_root, uid=0, gid=0, mode=0o555)
    _mkdir_exact(
        Path(plan["launchd_plist_path"]).parent, uid=0, gid=0, mode=0o755
    )
    for path in (
        publisher_home,
        publisher_home / ".config",
        publisher_home / ".config" / "gh",
        state_dir,
        repository_root,
    ):
        _mkdir_exact(
            path,
            uid=int(plan["publisher_uid"]),
            gid=int(plan["publisher_gid"]),
            mode=0o700,
        )
    source_root = Path(plan["source_root"])
    for entry in plan["asset_manifest"]:
        source, _info = _read_file_exact(
            source_root / entry["path"],
            expected_uid=int(plan["source_owner_uid"]),
            immutable_owner=True,
        )
        if _sha256(source) != entry["sha256"] or len(source) != entry["size"]:
            raise ValueError("publisher source changed after plan construction")
        _atomic_write(
            runtime_root / entry["path"],
            source,
            uid=0,
            gid=0,
            mode=int(entry["mode"]),
        )
    _atomic_write(
        Path(plan["launchd_plist_path"]),
        render_launchd_plist(plan),
        uid=0,
        gid=0,
        mode=0o644,
    )
    dot_git = repository_root / ".git"
    if not dot_git.exists():
        initialized = _run_as_publisher(
            plan,
            ["/usr/bin/git", "init", "--initial-branch=publisher-private"],
            runner=runner,
        )
        if initialized.returncode != 0:
            raise ValueError("publisher private repository initialization failed")
    _mkdir_exact(
        dot_git,
        uid=int(plan["publisher_uid"]),
        gid=int(plan["publisher_gid"]),
        mode=0o700,
    )
    remote = _run_as_publisher(
        plan,
        ["/usr/bin/git", "remote", "get-url", "origin"],
        runner=runner,
    )
    canonical = f"https://github.com/{REPOSITORY}.git"
    if remote.returncode == 0 and remote.stdout.strip() != canonical:
        raise ValueError("publisher private repository origin is not canonical")
    if remote.returncode != 0:
        added = _run_as_publisher(
            plan,
            ["/usr/bin/git", "remote", "add", "origin", canonical],
            runner=runner,
        )
        if added.returncode != 0:
            raise ValueError("publisher private repository origin setup failed")
    _verify_provisioned_assets(plan)
    _verify_private_repository(plan)
    return {
        "contract": SERVICE_PLAN_CONTRACT,
        "enabled": False,
        "service_label": SERVICE_LABEL,
        "asset_manifest_sha256": plan["asset_manifest_sha256"],
        "source_commit_sha": plan["source_commit_sha"],
    }


def _verify_provisioned_assets(plan: dict[str, Any]) -> None:
    runtime_root = Path(plan["runtime_root"])
    root_info = runtime_root.lstat()
    if (
        stat.S_ISLNK(root_info.st_mode)
        or not stat.S_ISDIR(root_info.st_mode)
        or root_info.st_uid != 0
        or stat.S_IMODE(root_info.st_mode) != 0o555
    ):
        raise ValueError("publisher runtime root is not immutable")
    for entry in plan["asset_manifest"]:
        content, _info = _read_file_exact(
            runtime_root / entry["path"],
            expected_uid=0,
            expected_gid=0,
            expected_mode=int(entry["mode"]),
        )
        if len(content) != entry["size"] or _sha256(content) != entry["sha256"]:
            raise ValueError("publisher runtime asset differs from manifest")
    plist, _info = _read_file_exact(
        Path(plan["launchd_plist_path"]),
        expected_uid=0,
        expected_gid=0,
        expected_mode=0o644,
    )
    if plist != render_launchd_plist(plan):
        raise ValueError("publisher launchd plist differs from exact plan")
    python, _info = _read_file_exact(
        Path(plan["python_executable"]),
        immutable_owner=True,
        maximum=128 * 1024 * 1024,
    )
    if _sha256(python) != plan["python_sha256"]:
        raise ValueError("publisher Python runtime identity changed")


def _verify_broker_client(plan: dict[str, Any]) -> str:
    content, _info = _read_file_exact(
        Path(plan["broker_client_config"]),
        expected_uid=int(plan["publisher_uid"]),
        expected_mode=0o600,
        maximum=1024 * 1024,
    )
    try:
        config = json.loads(content)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("publisher broker client config is malformed") from error
    required = {
        "contract",
        "surface",
        "socket_path",
        "key_path",
        "expected_broker_uid",
        "sequence_path",
    }
    if (
        not isinstance(config, dict)
        or set(config) != required
        or config.get("contract") != "hermes.kanban_broker_client_config.v1"
        or config.get("surface") != "publisher"
        or config.get("expected_broker_uid") != plan["broker_uid"]
    ):
        raise ValueError("publisher broker client contract is not exact")
    key_path = _absolute(Path(config["key_path"]), "publisher broker key")
    key, _key_info = _read_file_exact(
        key_path,
        expected_uid=int(plan["broker_uid"]),
        expected_gid=int(plan["publisher_gid"]),
        expected_mode=0o640,
        maximum=32,
    )
    if len(key) != 32:
        raise ValueError("publisher broker client key is invalid")
    _absolute(Path(config["socket_path"]), "publisher broker socket")
    _absolute(Path(config["sequence_path"]), "publisher broker sequence")
    return _sha256(content)


def _verify_private_repository(plan: dict[str, Any]) -> None:
    root = Path(plan["repository_root"])
    for path in (root, root / ".git"):
        info = path.lstat()
        if (
            stat.S_ISLNK(info.st_mode)
            or not stat.S_ISDIR(info.st_mode)
            or info.st_uid != int(plan["publisher_uid"])
            or info.st_gid != int(plan["publisher_gid"])
            or stat.S_IMODE(info.st_mode) != 0o700
        ):
            raise ValueError("publisher private repository identity is unsafe")


def _cross_uid_open_result(path: Path, *, uid: int, gid: int) -> str:
    """Observe open permission under one UID without reading credential bytes."""

    if os.geteuid() != 0:
        raise PermissionError("publisher credential isolation canary requires root")
    read_fd, write_fd = os.pipe()
    pid = os.fork()
    if pid == 0:  # windows-footgun: ok - root-only macOS activation canary
        try:
            os.close(read_fd)
            os.setgroups([])
            os.setgid(int(gid))
            os.setuid(int(uid))
            flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
            try:
                descriptor = os.open(path, flags)
            except PermissionError:
                result = b"DENIED"
            except Exception as error:
                result = f"ERROR:{type(error).__name__}".encode("ascii", "replace")
            else:
                os.close(descriptor)
                result = b"ALLOWED"
            os.write(write_fd, result)
        except Exception as error:
            os.write(
                write_fd,
                f"ERROR:{type(error).__name__}".encode("ascii", "replace"),
            )
        finally:
            os._exit(0)
    os.close(write_fd)
    result = os.read(read_fd, 64)
    os.close(read_fd)
    _pid, status = os.waitpid(pid, 0)
    if not os.WIFEXITED(status):
        return "ERROR:child_status"
    return result.decode("ascii", "replace") or "ERROR:no_result"


def _verify_publisher_credential_isolation(plan: dict[str, Any]) -> None:
    credential = (
        Path(plan["publisher_home"]) / ".config" / "gh" / "hosts.yml"
    )
    info = credential.lstat()
    if (
        stat.S_ISLNK(info.st_mode)
        or not stat.S_ISREG(info.st_mode)
        or info.st_uid != int(plan["publisher_uid"])
        or info.st_gid != int(plan["publisher_gid"])
        or info.st_nlink != 1
        or stat.S_IMODE(info.st_mode) != 0o600
    ):
        raise ValueError("publisher GitHub credential file identity is unsafe")
    model = _cross_uid_open_result(
        credential,
        uid=int(plan["model_uid"]),
        gid=int(plan["model_gid"]),
    )
    publisher = _cross_uid_open_result(
        credential,
        uid=int(plan["publisher_uid"]),
        gid=int(plan["publisher_gid"]),
    )
    if model != "DENIED" or publisher != "ALLOWED":
        raise ValueError(
            "publisher GitHub credential cross-UID isolation canary failed"
        )


def _parse_json_result(result: subprocess.CompletedProcess, label: str) -> dict[str, Any]:
    if result.returncode != 0:
        raise ValueError(f"publisher GitHub {label} readback failed")
    try:
        payload = json.loads(result.stdout)
    except (TypeError, json.JSONDecodeError) as error:
        raise ValueError(f"publisher GitHub {label} readback is malformed") from error
    if not isinstance(payload, dict):
        raise ValueError(f"publisher GitHub {label} readback is malformed")
    return payload


def _revoke_activation_attestation(plan: dict[str, Any]) -> None:
    """Revoke the root activation attestation and prove the path is absent."""

    path = Path(plan["activation_attestation"])
    try:
        info = path.lstat()
    except FileNotFoundError:
        return
    if (
        stat.S_ISLNK(info.st_mode)
        or not stat.S_ISREG(info.st_mode)
        or info.st_uid != 0
    ):
        raise PublisherAttestationRevocationError(
            "publisher activation attestation revocation target is unsafe"
        )
    path.unlink()
    try:
        path.lstat()
    except FileNotFoundError:
        return
    raise PublisherAttestationRevocationError(
        f"publisher activation attestation revocation did not read back absent: {path}"
    )


def _read_persistent_disable_state(
    runner: Callable[..., subprocess.CompletedProcess],
) -> bool:
    """Ask the authoritative launchd registry whether the publisher is disabled."""

    try:
        result = runner(
            ["/bin/launchctl", "print-disabled", "system"],
            check=False,
            capture_output=True,
            text=True,
        )
    except Exception:
        return False
    stdout = result.stdout if isinstance(result.stdout, str) else ""
    return result.returncode == 0 and PERSISTENT_DISABLE_READBACK_RE.search(stdout) is not None


def _read_persistent_enable_state(
    runner: Callable[..., subprocess.CompletedProcess],
) -> bool:
    """Ask the authoritative launchd registry whether the publisher stays enabled.

    A live PID is instantaneous state; only ``print-disabled`` proves the service will
    still be enabled after the next reboot, so activation must read this back before it
    attests anything.
    """

    try:
        result = runner(
            ["/bin/launchctl", "print-disabled", "system"],
            check=False,
            capture_output=True,
            text=True,
        )
    except Exception:
        return False
    stdout = result.stdout if isinstance(result.stdout, str) else ""
    return result.returncode == 0 and PERSISTENT_ENABLE_READBACK_RE.search(stdout) is not None


def _disable_publisher(
    plan: dict[str, Any],
    runner: Callable[..., subprocess.CompletedProcess],
    label: str,
) -> tuple[list[Exception], bool, bool, bool]:
    """Attempt every publisher compensation independently, then read back safe state.

    Attestation-revocation failures stay distinguishable from launchd mutation
    transport failures inside ``errors``: the latter may be superseded by the
    independent state readbacks below, the former never can.
    """

    errors: list[Exception] = []
    try:
        runner(
            ["/bin/launchctl", "disable", label],
            check=False,
            capture_output=True,
            text=True,
        )
    except Exception as error:
        # A raising mutation is neither proof of success nor permission to skip the
        # independent compensation and readbacks that follow it.
        errors.append(error)
    try:
        _revoke_activation_attestation(plan)
        attestation_revoked = True
    except Exception as error:
        errors.append(error)
        attestation_revoked = False
    try:
        runner(
            ["/bin/launchctl", "bootout", label],
            check=False,
            capture_output=True,
            text=True,
        )
    except Exception as error:
        errors.append(error)
    try:
        check = runner(
            ["/bin/launchctl", "print", label],
            check=False,
            capture_output=True,
            text=True,
        )
    except Exception as error:
        errors.append(error)
        check = None
    absent = check is not None and check.returncode != 0
    disabled = _read_persistent_disable_state(runner)
    return errors, attestation_revoked, absent, disabled


def _rollback_activation(
    plan: dict[str, Any],
    runner: Callable[..., subprocess.CompletedProcess],
    label: str,
    error: BaseException,
) -> None:
    """Disable the privileged publisher, then prove absence and persistent disablement.

    Returns only when the safe state is proved, so the caller may re-raise the
    original activation error.  An unproved safe state fails closed.  Revocation is
    checked first because no process or registry readback can supersede it.
    """

    errors, attestation_revoked, absent, disabled = _disable_publisher(plan, runner, label)
    revocation_errors = [
        error
        for error in errors
        if isinstance(error, PublisherAttestationRevocationError)
    ]
    if not attestation_revoked or revocation_errors:
        raise PublisherRollbackSafetyError(
            "publisher activation rollback did not revoke activation attestation"
        ) from error
    if not absent:
        raise PublisherRollbackSafetyError(
            "publisher activation rollback did not stop service"
        ) from error
    if not disabled:
        raise PublisherRollbackSafetyError(
            "publisher activation rollback did not prove persistent disablement"
        ) from error


def activate_service(
    plan: dict[str, Any],
    *,
    runner: Callable[..., subprocess.CompletedProcess] = subprocess.run,
    now: Callable[[], int] = lambda: int(time.time()),
) -> dict[str, Any]:
    """Start launchd as root and attest only live, durable, re-verified state."""

    _require_production_plan(plan)
    if os.geteuid() != 0:
        raise PermissionError("publisher service activation requires root")
    label = f"system/{SERVICE_LABEL}"
    try:
        _verify_provisioned_assets(plan)
        client_sha = _verify_broker_client(plan)
        _verify_private_repository(plan)
        _verify_publisher_credential_isolation(plan)
        gh = "/opt/homebrew/bin/gh"
        actor = _parse_json_result(
            _run_as_publisher(plan, [gh, "api", "user"], runner=runner), "actor"
        )
        repository = _parse_json_result(
            _run_as_publisher(
                plan, [gh, "api", f"repos/{REPOSITORY}"], runner=runner
            ),
            "repository",
        )
        workflow = _parse_json_result(
            _run_as_publisher(
                plan,
                [gh, "api", f"repos/{REPOSITORY}/actions/workflows/{WORKFLOW_ID}"],
                runner=runner,
            ),
            "workflow",
        )
        if {key: actor.get(key) for key in READY_LABEL_ACTOR} != READY_LABEL_ACTOR:
            raise ValueError(
                "publisher GitHub actor is not the pinned ready-label actor"
            )
        if (
            repository.get("id") != REPOSITORY_ID
            or repository.get("full_name") != REPOSITORY
            or repository.get("fork") is not False
        ):
            raise ValueError("publisher GitHub repository identity is not exact")
        if (
            workflow.get("id") != WORKFLOW_ID
            or workflow.get("name") != WORKFLOW_NAME
            or workflow.get("path") != WORKFLOW_PATH
            or workflow.get("state") != "active"
        ):
            raise ValueError("publisher GitHub workflow identity is not exact")
    except Exception as error:
        _rollback_activation(plan, runner, label, error)
        raise
    try:
        attestation = {
            "contract": ACTIVATION_CONTRACT,
            "broker_boundary": BROKER_BOUNDARY,
            "service_label": SERVICE_LABEL,
            "active": True,
            "publisher_uid": plan["publisher_uid"],
            "broker_uid": plan["broker_uid"],
            "model_uid": plan["model_uid"],
            "repository": REPOSITORY,
            "github_repository_id": REPOSITORY_ID,
            "workflow_id": WORKFLOW_ID,
            "workflow_path": WORKFLOW_PATH,
            "ready_label_actor": dict(READY_LABEL_ACTOR),
            "publisher_client_config_sha256": client_sha,
            "asset_manifest_sha256": plan["asset_manifest_sha256"],
            "source_commit_sha": plan["source_commit_sha"],
            "publisher_credential_model_denied": True,
            "verified_at": int(now()),
        }
        encoded = (json.dumps(attestation, sort_keys=True, separators=(",", ":")) + "\n").encode()
        state = runner(
            ["/bin/launchctl", "print", label],
            check=False,
            capture_output=True,
            text=True,
        )
        if state.returncode != 0:
            bootstrap = runner(
                [
                    "/bin/launchctl",
                    "bootstrap",
                    "system",
                    plan["launchd_plist_path"],
                ],
                check=False,
                capture_output=True,
                text=True,
            )
            if bootstrap.returncode != 0:
                raise ValueError("publisher launchd bootstrap failed")
        for command in (
            ["/bin/launchctl", "enable", label],
            ["/bin/launchctl", "kickstart", "-k", label],
        ):
            result = runner(command, check=False, capture_output=True, text=True)
            if result.returncode != 0:
                raise ValueError("publisher launchd activation failed")
        live = runner(
            ["/bin/launchctl", "print", label],
            check=False,
            capture_output=True,
            text=True,
        )
        output = live.stdout if isinstance(live.stdout, str) else ""
        if (
            live.returncode != 0
            or SERVICE_LABEL not in output
            or re.search(r"\bstate\s*=\s*running\b", output) is None
            or re.search(r"\bpid\s*=\s*[1-9][0-9]*\b", output) is None
        ):
            raise ValueError("publisher launchd service did not read back running")
        if not _read_persistent_enable_state(runner):
            raise ValueError(
                "publisher launchd service did not read back persistent enablement"
            )
        _verify_provisioned_assets(plan)
        _atomic_write(
            Path(plan["activation_attestation"]),
            encoded,
            uid=0,
            gid=0,
            mode=0o644,
        )
        readback, _info = _read_file_exact(
            Path(plan["activation_attestation"]),
            expected_uid=0,
            expected_gid=0,
            expected_mode=0o644,
            maximum=1024 * 1024,
        )
        if readback != encoded:
            raise ValueError("publisher activation attestation readback changed")
    except Exception as error:
        _rollback_activation(plan, runner, label, error)
        raise
    return attestation


def deactivate_service(
    plan: dict[str, Any],
    *,
    runner: Callable[..., subprocess.CompletedProcess] = subprocess.run,
) -> dict[str, Any]:
    """Boot out the publisher, revoke its attestation, and prove persistent disablement."""

    _require_fixed_production_paths(plan)
    if os.geteuid() != 0:
        raise PermissionError("publisher service deactivation requires root")
    label = f"system/{SERVICE_LABEL}"
    errors, attestation_revoked, absent, disabled = _disable_publisher(plan, runner, label)
    revocation_errors = [
        error
        for error in errors
        if isinstance(error, PublisherAttestationRevocationError)
    ]
    if not attestation_revoked or revocation_errors:
        raise PublisherDeactivationSafetyError(
            "publisher deactivation did not revoke activation attestation"
        ) from (
            revocation_errors[0]
            if revocation_errors
            else errors[0]
            if errors
            else None
        )
    if not absent:
        raise PublisherDeactivationSafetyError(
            "publisher service did not remain disabled"
        ) from (errors[0] if errors else None)
    if not disabled:
        raise PublisherDeactivationSafetyError(
            "publisher deactivation did not prove persistent disablement"
        ) from (errors[0] if errors else None)
    if errors:
        raise PublisherDeactivationSafetyError(
            "publisher deactivation compensation did not complete"
        ) from errors[0]
    return {"service_label": SERVICE_LABEL, "active": False}


def _load_plan(path: Path) -> dict[str, Any]:
    raw, _info = _read_file_exact(
        Path(path),
        expected_uid=0 if os.geteuid() == 0 else None,
        expected_mode=0o600 if os.geteuid() == 0 else None,
        maximum=1024 * 1024,
    )
    try:
        plan = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("publisher service plan is malformed") from error
    _validate_plan(plan)
    return plan


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    plan_parser = subparsers.add_parser("plan")
    plan_parser.add_argument("--source-root", required=True, type=Path)
    plan_parser.add_argument("--source-commit-sha", required=True)
    plan_parser.add_argument("--broker-client-config", required=True, type=Path)
    plan_parser.add_argument("--python-executable", required=True, type=Path)
    plan_parser.add_argument("--publisher-user", required=True)
    plan_parser.add_argument("--publisher-uid", required=True, type=int)
    plan_parser.add_argument("--publisher-group", required=True)
    plan_parser.add_argument("--publisher-gid", required=True, type=int)
    plan_parser.add_argument("--broker-uid", required=True, type=int)
    plan_parser.add_argument("--model-uid", required=True, type=int)
    plan_parser.add_argument("--model-gid", required=True, type=int)
    plan_parser.add_argument("--output", required=True, type=Path)
    for command in ("provision", "activate", "deactivate"):
        child = subparsers.add_parser(command)
        child.add_argument("--plan", required=True, type=Path)
    args = parser.parse_args(argv)
    if args.command == "plan":
        if os.geteuid() != 0:
            raise PermissionError("publisher production plan rendering requires root")
        plan = build_service_plan(
            source_root=args.source_root,
            install_root=PRODUCTION_INSTALL_ROOT,
            publisher_home=PRODUCTION_PUBLISHER_HOME,
            broker_client_config=args.broker_client_config,
            launchd_plist_path=PRODUCTION_LAUNCHD_PLIST,
            python_executable=args.python_executable,
            source_commit_sha=args.source_commit_sha,
            source_owner_uid=0,
            publisher_user=args.publisher_user,
            publisher_uid=args.publisher_uid,
            publisher_group=args.publisher_group,
            publisher_gid=args.publisher_gid,
            broker_uid=args.broker_uid,
            model_uid=args.model_uid,
            model_gid=args.model_gid,
        )
        _require_production_plan(plan)
        output = _absolute(args.output, "plan output")
        _atomic_write(
            output,
            (json.dumps(plan, sort_keys=True, separators=(",", ":")) + "\n").encode(),
            uid=0,
            gid=0,
            mode=0o600,
        )
        print(json.dumps({"contract": SERVICE_PLAN_CONTRACT, "plan": str(output)}))
        return 0
    plan = _load_plan(args.plan)
    if args.command == "provision":
        result = provision_service(plan)
    elif args.command == "activate":
        result = activate_service(plan)
    else:
        result = deactivate_service(plan)
    print(json.dumps(result, sort_keys=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
