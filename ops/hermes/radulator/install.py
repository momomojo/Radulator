#!/usr/bin/env python3
"""Install the Radulator risk-tiered Hermes control plane reversibly."""

from __future__ import annotations

import argparse
import base64
import datetime as dt
import hashlib
import json
import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any


SCHEMA = "radulator-hermes-install/v1"
BACKUP_SCHEMA = "radulator-hermes-backup/v1"
MODEL = "gpt-5.6-sol"
PROVIDER = "openai-codex"
XHIGH = re.compile(r"(?m)^\s*reasoning_effort\s*:\s*[\"']?xhigh[\"']?\s*(?:#.*)?$")


class InstallError(RuntimeError):
    pass


def _now() -> str:
    return dt.datetime.now(dt.UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def _job_id(name: str) -> str:
    return hashlib.sha256(f"radulator-hermes:{name}:v1".encode()).hexdigest()[:12]


def _require_absolute(path: Path, label: str) -> Path:
    if not path.is_absolute():
        raise InstallError(f"{label} must be an absolute path.")
    resolved = path.resolve()
    if not resolved.exists() or not resolved.is_dir():
        raise InstallError(f"{label} does not exist as a directory: {resolved}")
    return resolved


def _verify_profile(home: Path, label: str) -> None:
    config = home / "config.yaml"
    if not config.is_file():
        raise InstallError(f"{label} config.yaml is missing.")
    text = config.read_text(encoding="utf-8")
    if not XHIGH.search(text):
        raise InstallError(f"{label} must set profile-level agent.reasoning_effort to xhigh.")


def _job(name: str, home: Path, repo: Path, prompt: str, skills: list[str], expression: str) -> dict[str, Any]:
    return {
        "id": _job_id(name),
        "name": name,
        "prompt": prompt,
        "skills": skills,
        "skill": skills[0] if len(skills) == 1 else None,
        "model": MODEL,
        "provider": PROVIDER,
        "base_url": None,
        "script": None,
        "no_agent": False,
        "context_from": None,
        "schedule": {"kind": "cron", "expr": expression, "display": expression},
        "schedule_display": expression,
        "enabled": False,
        "deliver": None,
        "workdir": str(repo),
        "_home": str(home),
    }


def build_plan(*, repo: Path, radulator_home: Path, default_home: Path) -> dict[str, Any]:
    repo = _require_absolute(Path(repo), "repo")
    radulator_home = _require_absolute(Path(radulator_home), "radulator_home")
    default_home = _require_absolute(Path(default_home), "default_home")
    if radulator_home == default_home:
        raise InstallError("radulator_home and default_home must be distinct judge profiles.")
    for home, label in ((radulator_home, "radulator profile"), (default_home, "verification profile")):
        _verify_profile(home, label)
    required = [
        repo / "ops/hermes/radulator/judge-candidates.mjs",
        repo / "ops/hermes/radulator/judge-attest.mjs",
        repo / "ops/hermes/radulator/lifecycle_controller.py",
        repo / "ops/hermes/radulator/learning_context.py",
    ]
    missing = [str(path) for path in required if not path.is_file()]
    if missing:
        raise InstallError(f"Repository overlay is incomplete: {', '.join(missing)}")

    overlay = repo / "ops/hermes/radulator"
    ledger = radulator_home / "state/radulator-release-lifecycle.jsonl"
    primary_private = radulator_home / "keys/radulator-clinical/radulator-primary-v1.private.pem"
    verification_private = default_home / "keys/radulator-clinical/radulator-verification-v1.private.pem"
    jobs = [
        _job(
            "radulator-clinical-judge-primary", radulator_home, repo,
            "Collect exact ready-for-gate candidates with "
            f"node {overlay / 'judge-candidates.mjs'} --repo momomojo/Radulator --role primary. "
            "For each candidate use radulator-clinical-judge, write one decision JSON, sign with the configured primary key, "
            f"key id radulator-primary-v1 and private key {primary_private}; post it and require authoritative GitHub comment "
            "readback. Never edit source or self-improve during judgment.",
            ["radulator-clinical-judge"], "*/10 * * * *",
        ),
        _job(
            "radulator-clinical-judge-verification", default_home, repo,
            "Collect exact high-risk verification candidates with "
            f"node {overlay / 'judge-candidates.mjs'} --repo momomojo/Radulator --role verification. "
            "Act only after an exact primary PASS. Use radulator-clinical-judge independently, sign only with the verification key, "
            f"key id radulator-verification-v1 and private key {verification_private}; post it and require authoritative GitHub "
            "comment readback. Never edit source or self-improve during judgment.",
            ["radulator-clinical-judge"], "3-59/10 * * * *",
        ),
        _job(
            "radulator-release-lifecycle", radulator_home, repo,
            "Reconcile Radulator GitHub, deploy, and Kanban facts into the append-only ledger at "
            f"{ledger}. Use radulator-release-controller. Append only authoritative exact-SHA transitions; run lifecycle_controller.py "
            "apply-actions for NEEDS_FIX, smoke_passed, or learned states and verify every Kanban readback.",
            ["radulator-release-controller"], "*/5 * * * *",
        ),
        _job(
            "radulator-release-learning", radulator_home, repo,
            f"Find smoke_passed tasks in {ledger}. Use radulator-release-learning once per task. Retain only the sanitized candidate, "
            "read back Hindsight, append learned, verify Kanban completion, then append complete.",
            ["radulator-release-learning"], "2-59/10 * * * *",
        ),
    ]
    return {
        "schema": SCHEMA,
        "repo": str(repo),
        "radulator_home": str(radulator_home),
        "default_home": str(default_home),
        "jobs": jobs,
        "keys": {
            "primary_private": str(primary_private),
            "primary_public": str(primary_private.with_name("primary.public.pem")),
            "verification_private": str(verification_private),
            "verification_public": str(verification_private.with_name("verification.public.pem")),
        },
    }


def _load_jobs(path: Path) -> tuple[dict[str, Any] | list[Any], list[dict[str, Any]]]:
    if not path.exists():
        return {"jobs": []}, []
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        jobs = payload
    elif isinstance(payload, dict) and isinstance(payload.get("jobs"), list):
        jobs = payload["jobs"]
    else:
        raise InstallError(f"Unsupported Hermes jobs.json shape: {path}")
    if not all(isinstance(job, dict) for job in jobs):
        raise InstallError(f"Hermes jobs.json contains a non-object job: {path}")
    return payload, jobs


def _job_for_write(template: dict[str, Any], existing: dict[str, Any] | None, enable: bool, disable: bool) -> dict[str, Any]:
    now = _now()
    value = dict(existing or {})
    managed = {key: item for key, item in template.items() if not key.startswith("_") and key != "enabled"}
    value.update(managed)
    enabled = True if enable else False if disable else (bool(existing.get("enabled")) if existing else False)
    value["enabled"] = enabled
    if not existing:
        value.update({
            "repeat": {"times": None, "completed": 0},
            "state": "scheduled" if enabled else "paused",
            "paused_at": None if enabled else now,
            "paused_reason": None if enabled else "installed-disabled-first",
            "created_at": now,
            "updated_at": now,
            "next_run_at": None,
            "last_run_at": None,
            "last_status": None,
            "last_error": None,
        })
    elif enabled != bool(existing.get("enabled")):
        value.update({
            "state": "scheduled" if enabled else "paused",
            "paused_at": None if enabled else now,
            "paused_reason": None if enabled else "disabled-by-radulator-installer",
            "updated_at": now,
            "next_run_at": None,
        })
    return value


def _serialize(value: Any) -> bytes:
    return (json.dumps(value, indent=2, sort_keys=True) + "\n").encode("utf-8")


def _atomic_write(path: Path, content: bytes, mode: int = 0o600) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temporary = path.with_name(f".{path.name}.tmp-{os.getpid()}")
    with temporary.open("wb") as handle:
        handle.write(content)
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(temporary, mode)
    os.replace(temporary, path)


def _skill_copies(plan: dict[str, Any]) -> list[tuple[Path, Path]]:
    repo = Path(plan["repo"])
    radulator = Path(plan["radulator_home"])
    verification = Path(plan["default_home"])
    source = repo / "ops/hermes/radulator/skills"
    return [
        (source / "radulator-clinical-judge/SKILL.md", radulator / "skills/radulator-clinical-judge/SKILL.md"),
        (source / "radulator-clinical-judge/SKILL.md", verification / "skills/radulator-clinical-judge/SKILL.md"),
        (source / "radulator-release-controller/SKILL.md", radulator / "skills/radulator-release-controller/SKILL.md"),
        (source / "radulator-release-learning/SKILL.md", radulator / "skills/radulator-release-learning/SKILL.md"),
    ]


def _backup_path(plan: dict[str, Any]) -> Path:
    return Path(plan["radulator_home"]) / "state/radulator-release-backup.json"


def _control_manifest_path(plan: dict[str, Any]) -> Path:
    return Path(plan["radulator_home"]) / "state/radulator-release-control.json"


def _capture_backup(plan: dict[str, Any], targets: list[Path]) -> None:
    destination = _backup_path(plan)
    if destination.exists():
        return
    entries = []
    for target in targets:
        exists = target.is_file()
        entries.append({
            "path": str(target),
            "existed": exists,
            "mode": (target.stat().st_mode & 0o777) if exists else None,
            "content_base64": base64.b64encode(target.read_bytes()).decode("ascii") if exists else None,
        })
    _atomic_write(destination, _serialize({"schema": BACKUP_SCHEMA, "entries": entries}), 0o600)


def apply_install(
    *, repo: Path, radulator_home: Path, default_home: Path, enable: bool = False, disable: bool = False,
) -> dict[str, Any]:
    if enable and disable:
        raise InstallError("enable and disable are mutually exclusive.")
    plan = build_plan(repo=repo, radulator_home=radulator_home, default_home=default_home)
    homes = {str(Path(plan["radulator_home"])): [], str(Path(plan["default_home"])): []}
    for template in plan["jobs"]:
        homes[template["_home"]].append(template)
    jobs_paths = [Path(home) / "cron/jobs.json" for home in homes]
    skill_copies = _skill_copies(plan)
    control_manifest = _control_manifest_path(plan)
    _capture_backup(plan, [*jobs_paths, *(destination for _, destination in skill_copies), control_manifest])

    for home, templates in homes.items():
        path = Path(home) / "cron/jobs.json"
        payload, jobs = _load_jobs(path)
        indexed = {job.get("name"): job for job in jobs}
        replacements = {
            template["name"]: _job_for_write(template, indexed.get(template["name"]), enable, disable)
            for template in templates
        }
        rewritten = [replacements.pop(job.get("name"), job) for job in jobs]
        rewritten.extend(replacements.values())
        if isinstance(payload, list):
            payload = rewritten
        else:
            payload = {**payload, "jobs": rewritten}
        content = _serialize(payload)
        if not path.exists() or path.read_bytes() != content:
            _atomic_write(path, content, 0o600)

    for source, destination in skill_copies:
        if not source.is_file():
            raise InstallError(f"Required skill source is missing: {source}")
        content = source.read_bytes()
        if not destination.exists() or destination.read_bytes() != content:
            _atomic_write(destination, content, 0o644)

    manifest = {
        "schema": SCHEMA,
        "repo": plan["repo"],
        "profiles": {"primary": plan["radulator_home"], "verification": plan["default_home"]},
        "job_ids": {job["name"]: job["id"] for job in plan["jobs"]},
        "keys": plan["keys"],
        "backup_manifest": str(_backup_path(plan)),
    }
    content = _serialize(manifest)
    if not control_manifest.exists() or control_manifest.read_bytes() != content:
        _atomic_write(control_manifest, content, 0o600)
    return {"manifest_path": str(control_manifest), "job_ids": manifest["job_ids"], "mode": "enabled" if enable else "disabled" if disable else "installed"}


def restore_install(radulator_home: Path) -> dict[str, Any]:
    radulator_home = _require_absolute(Path(radulator_home), "radulator_home")
    backup_path = radulator_home / "state/radulator-release-backup.json"
    if not backup_path.is_file():
        raise InstallError(f"Backup manifest is missing: {backup_path}")
    backup = json.loads(backup_path.read_text(encoding="utf-8"))
    if backup.get("schema") != BACKUP_SCHEMA or not isinstance(backup.get("entries"), list):
        raise InstallError("Backup manifest schema is invalid.")
    restored = []
    for entry in backup["entries"]:
        target = Path(entry["path"])
        if entry["existed"]:
            _atomic_write(target, base64.b64decode(entry["content_base64"]), int(entry["mode"]))
        elif target.exists():
            if not target.is_file():
                raise InstallError(f"Refusing to remove non-file restore target: {target}")
            target.unlink()
        restored.append(str(target))
    return {"restored": restored, "backup_manifest": str(backup_path)}


def generate_keys(plan: dict[str, Any]) -> list[dict[str, Any]]:
    signer = Path(plan["repo"]) / "ops/hermes/radulator/judge-attest.mjs"
    definitions = [
        ("primary", Path(plan["radulator_home"]), "radulator-primary-v1", "primary", "radulator"),
        ("verification", Path(plan["default_home"]), "radulator-verification-v1", "verification", "verification"),
    ]
    public = []
    for _, home, key_id, role, profile in definitions:
        command = [
            "node", str(signer), "generate-key", "--directory", str(home / "keys/radulator-clinical"),
            "--key-id", key_id, "--role", role, "--profile", profile,
        ]
        result = subprocess.run(command, cwd=plan["repo"], check=False, capture_output=True, text=True)
        if result.returncode != 0:
            raise InstallError(f"Judge key generation failed for {role}: {result.stderr.strip()}")
        public.append(json.loads(result.stdout))
    return public


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path)
    parser.add_argument("--radulator-home", type=Path, required=True)
    parser.add_argument("--default-home", type=Path)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--apply", action="store_true")
    mode.add_argument("--restore", action="store_true")
    state = parser.add_mutually_exclusive_group()
    state.add_argument("--enable", action="store_true", help="Enable already-installed managed jobs after self-tests.")
    state.add_argument("--disable", action="store_true", help="Disable all managed jobs without removing their configuration.")
    parser.add_argument("--generate-keys", action="store_true", help="Create persistent signing credentials; requires operator approval.")
    args = parser.parse_args()
    if args.restore:
        print(json.dumps(restore_install(args.radulator_home), indent=2, sort_keys=True))
        return
    if args.repo is None or args.default_home is None:
        parser.error("--repo and --default-home are required for dry-run/apply")
    plan = build_plan(repo=args.repo, radulator_home=args.radulator_home, default_home=args.default_home)
    if args.dry_run:
        sanitized = {**plan, "jobs": [{key: value for key, value in job.items() if not key.startswith("_")} for job in plan["jobs"]]}
        print(json.dumps(sanitized, indent=2, sort_keys=True))
        return
    result = apply_install(
        repo=args.repo, radulator_home=args.radulator_home, default_home=args.default_home,
        enable=args.enable, disable=args.disable,
    )
    if args.generate_keys:
        result["public_keys"] = generate_keys(plan)
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
