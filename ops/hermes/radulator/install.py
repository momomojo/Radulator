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
CANONICAL_GITHUB_REPOSITORY = "momomojo/Radulator"
LEGACY_GATE_JOB_NAMES = frozenset({"pr-gate-poller", "judge-queue"})
ACTIVATION_SELF_TESTS = (
    ("npm", "run", "test:release-policy"),
    ("npm", "run", "test:independent-review-gate"),
    ("npm", "run", "test:auto-merge"),
    ("npm", "run", "test:authorize-deployment"),
    ("npm", "run", "test:reconcile-deployment"),
    ("npm", "run", "test:post-deploy-smoke"),
    ("npm", "run", "test:release-marker"),
    ("npm", "run", "test:rollback-deployment"),
    ("npm", "run", "test:hermes-judge-candidates"),
    ("npm", "run", "test:hermes-judge-attest"),
    ("npm", "run", "test:hermes-lifecycle"),
    ("npm", "run", "test:hermes-learning"),
    ("npm", "run", "test:hermes-feedback-intake"),
    ("npm", "run", "check:invariants"),
    ("npm", "run", "lint", "--", "--quiet"),
    ("npm", "run", "build"),
)


class InstallError(RuntimeError):
    pass


def _now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _job_id(name: str) -> str:
    return hashlib.sha256(f"radulator-hermes:{name}:v1".encode()).hexdigest()[:12]


def _require_absolute(path: Path, label: str) -> Path:
    if not path.is_absolute():
        raise InstallError(f"{label} must be an absolute path.")
    resolved = path.resolve()
    if not resolved.exists() or not resolved.is_dir():
        raise InstallError(f"{label} does not exist as a directory: {resolved}")
    return resolved


def _top_level_mapping_scalar(text: str, section: str, key: str, label: str) -> str | None:
    section_count = 0
    key_count = 0
    value = None
    in_section = False
    direct_indent = None
    mapping_line = re.compile(r"^([A-Za-z0-9_-]+)\s*:\s*(.*?)\s*$")
    for line_number, raw in enumerate(text.splitlines(), start=1):
        if not raw.strip() or raw.lstrip().startswith("#") or raw.strip() == "---":
            continue
        leading = raw[: len(raw) - len(raw.lstrip())]
        if "\t" in leading:
            raise InstallError(f"{label} has ambiguous tab indentation at config line {line_number}.")
        content = raw.split("#", 1)[0].rstrip()
        if not content.strip():
            continue
        indent = len(content) - len(content.lstrip(" "))
        match = mapping_line.fullmatch(content.lstrip(" "))
        if indent == 0:
            in_section = bool(match and match.group(1) == section)
            direct_indent = None
            if in_section:
                section_count += 1
                if match.group(2):
                    raise InstallError(f"{label} must express {section} as a block mapping.")
            continue
        if not in_section:
            continue
        if direct_indent is None:
            direct_indent = indent
        if indent == direct_indent and match and match.group(1) == key:
            key_count += 1
            value = match.group(2)

    if section_count > 1 or key_count > 1:
        raise InstallError(f"{label} has ambiguous duplicate YAML keys for {section}.{key}.")
    if section_count != 1 or key_count != 1:
        return None
    return value


def _yaml_string_scalar(value: str | None) -> str | None:
    if not value or len(value) < 2 or value[0] != value[-1] or value[0] not in {"'", '"'}:
        return value
    if value[0] == "'":
        return value[1:-1].replace("''", "'")
    try:
        decoded = json.loads(value)
    except json.JSONDecodeError:
        return value
    return decoded if isinstance(decoded, str) else value


def _verify_profile(home: Path, label: str) -> None:
    config = home / "config.yaml"
    if not config.is_file():
        raise InstallError(f"{label} config.yaml is missing.")
    text = config.read_text(encoding="utf-8")
    effort = _top_level_mapping_scalar(text, "agent", "reasoning_effort", label)
    if _yaml_string_scalar(effort) != "xhigh":
        raise InstallError(f"{label} must set profile-level agent.reasoning_effort to xhigh.")
    if _top_level_mapping_scalar(text, "cron", "max_parallel_jobs", label) != "1":
        raise InstallError(f"{label} must set cron.max_parallel_jobs to 1 for single-flight judgment.")


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


def _script_job(name: str, home: Path, script: str, expression: str) -> dict[str, Any]:
    return {
        "id": _job_id(name),
        "name": name,
        "prompt": "",
        "skills": [],
        "skill": None,
        "model": None,
        "provider": None,
        "base_url": None,
        "script": script,
        "no_agent": True,
        "context_from": None,
        "schedule": {"kind": "cron", "expr": expression, "display": expression},
        "schedule_display": expression,
        "enabled": False,
        "deliver": None,
        "workdir": None,
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
        repo / "ops/hermes/radulator/github-ci-identity.mjs",
        repo / "ops/hermes/radulator/public-keys.mjs",
        repo / "ops/hermes/radulator/lifecycle_controller.py",
        repo / "ops/hermes/radulator/learning_context.py",
        repo / "ops/hermes/radulator/retain_learning.py",
        repo / "ops/hermes/radulator/formspree_feedback_intake.py",
    ]
    missing = [str(path) for path in required if not path.is_file()]
    if missing:
        raise InstallError(f"Repository overlay is incomplete: {', '.join(missing)}")

    overlay = repo / "ops/hermes/radulator"
    ledger = radulator_home / "state/radulator-release-lifecycle.jsonl"
    lifecycle_cursor = radulator_home / "state/radulator-release-lifecycle-cursor.json"
    learning_cursor = radulator_home / "state/radulator-release-learning-cursor.json"
    hindsight_config = radulator_home / "hindsight/config.json"
    signer = overlay / "judge-attest.mjs"
    primary_private = radulator_home / "keys/radulator-clinical/radulator-primary-v1.private.pem"
    verification_private = default_home / "keys/radulator-clinical/radulator-verification-v1.private.pem"
    primary_public = primary_private.with_name("radulator-primary-v1.public.pem")
    verification_public = verification_private.with_name("radulator-verification-v1.public.pem")
    primary_public_keys_config = primary_private.with_name("public-keys.json")
    verification_public_keys_config = verification_private.with_name("public-keys.json")
    jobs = [
        _job(
            "radulator-clinical-judge-primary", radulator_home, repo,
            "Collect exact ready-for-gate candidates with "
            f"node {overlay / 'judge-candidates.mjs'} --repo {CANONICAL_GITHUB_REPOSITORY} --role primary --limit 1 "
            f"--public-keys-file {primary_public_keys_config}. "
            "Invoke that collector exactly once in this run. If it returns zero candidates, stop immediately. Review only its single "
            "returned candidate and never invoke the collector again in the same run. Use radulator-clinical-judge, write one decision "
            "JSON. Replace the angle-bracket path placeholders, then run exactly: "
            f"node {signer} sign --candidate <cachedPaths[0]> --decision <decision-json-path> --private-key {primary_private} "
            f"--key-id radulator-primary-v1 --role primary --profile radulator --model {MODEL} --provider {PROVIDER} "
            f"--output <attestation-json-path> && node {signer} post --repo {CANONICAL_GITHUB_REPOSITORY} "
            f"--attestation <attestation-json-path> --public-keys-file {primary_public_keys_config}. Require authoritative GitHub comment "
            "readback. Never edit source or self-improve during judgment.",
            ["radulator-clinical-judge"], "*/10 * * * *",
        ),
        _job(
            "radulator-clinical-judge-verification", default_home, repo,
            "Collect exact high-risk verification candidates with "
            f"node {overlay / 'judge-candidates.mjs'} --repo {CANONICAL_GITHUB_REPOSITORY} --role verification --limit 1 "
            f"--public-keys-file {verification_public_keys_config}. "
            "Invoke that collector exactly once in this run. If it returns zero candidates, stop immediately. Review only its single "
            "returned candidate and never invoke the collector again in the same run. Act only after an exact primary PASS. Use "
            "radulator-clinical-judge independently and write one decision JSON. Replace the angle-bracket path placeholders, then run "
            f"exactly: node {signer} sign --candidate <cachedPaths[0]> --decision <decision-json-path> "
            f"--private-key {verification_private} --key-id radulator-verification-v1 --role verification --profile default "
            f"--model {MODEL} --provider {PROVIDER} --output <attestation-json-path> && node {signer} post "
            f"--repo {CANONICAL_GITHUB_REPOSITORY} --attestation <attestation-json-path> "
            f"--public-keys-file {verification_public_keys_config}. Require authoritative GitHub "
            "comment readback. Never edit source or self-improve during judgment.",
            ["radulator-clinical-judge"], "3-59/10 * * * *",
        ),
        _job(
            "radulator-release-lifecycle", radulator_home, repo,
            f"Run python3 {overlay / 'lifecycle_controller.py'} next --ledger {ledger} --cursor-state {lifecycle_cursor}. "
            "Invoke that collector exactly once in this run. If it returns count 0, stop immediately. Process only its single returned "
            "tracker and never enumerate the full ledger, board, or session history in this run. Reconcile only that tracker's Radulator "
            "GitHub, deploy, and Kanban facts. Use radulator-release-controller. Append only authoritative exact-SHA transitions; run "
            "lifecycle_controller.py apply-actions for NEEDS_FIX, smoke_passed, or learned states and verify every Kanban readback.",
            ["radulator-release-controller"], "*/5 * * * *",
        ),
        _job(
            "radulator-release-learning", radulator_home, repo,
            f"Run python3 {overlay / 'lifecycle_controller.py'} next --ledger {ledger} --cursor-state {learning_cursor} "
            "--state smoke_passed. Invoke that collector exactly once in this run. If it returns count 0, stop immediately. Process only "
            "its single returned tracker and never enumerate the full ledger, board, or session history in this run. Use "
            "radulator-release-learning once for that tracker. Replace only <candidate.task_id>, then run exactly: "
            f"python3 {overlay / 'retain_learning.py'} --ledger {ledger} --task-id <candidate.task_id> "
            f"--config {hindsight_config}. Do not call hindsight_retain. "
            "Use only its exact readback receipt to append learned, verify Kanban terminal readback, then append complete.",
            ["radulator-release-learning"], "2-59/10 * * * *",
        ),
        _script_job(
            "radulator-formspree-feedback-intake",
            radulator_home,
            "radulator_formspree_feedback_intake.py",
            "7-59/15 * * * *",
        ),
    ]
    return {
        "schema": SCHEMA,
        "repo": str(repo),
        "github_repository": CANONICAL_GITHUB_REPOSITORY,
        "radulator_home": str(radulator_home),
        "default_home": str(default_home),
        "jobs": jobs,
        "keys": {
            "primary_private": str(primary_private),
            "primary_public": str(primary_public),
            "primary_public_keys_config": str(primary_public_keys_config),
            "verification_private": str(verification_private),
            "verification_public": str(verification_public),
            "verification_public_keys_config": str(verification_public_keys_config),
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


def _retire_legacy_gate(job: dict[str, Any]) -> dict[str, Any]:
    if job.get("name") not in LEGACY_GATE_JOB_NAMES:
        return job
    if (
        job.get("enabled") is False
        and job.get("state") == "paused"
        and job.get("paused_reason") == "replaced-by-radulator-signed-clinical-gate"
        and job.get("next_run_at") is None
    ):
        return job
    now = _now()
    value = dict(job)
    value.update({
        "enabled": False,
        "state": "paused",
        "paused_at": job.get("paused_at") if job.get("enabled") is False and job.get("paused_at") else now,
        "paused_reason": "replaced-by-radulator-signed-clinical-gate",
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


def _script_copies(plan: dict[str, Any]) -> list[tuple[Path, Path]]:
    repo = Path(plan["repo"])
    radulator = Path(plan["radulator_home"])
    return [(
        repo / "ops/hermes/radulator/formspree_feedback_intake.py",
        radulator / "scripts/radulator_formspree_feedback_intake.py",
    )]


def _backup_path(plan: dict[str, Any]) -> Path:
    return Path(plan["radulator_home"]) / "state/radulator-release-backup.json"


def _control_manifest_path(plan: dict[str, Any]) -> Path:
    return Path(plan["radulator_home"]) / "state/radulator-release-control.json"


def _verify_activation_trust(plan: dict[str, Any], expected_public_keys: dict[str, Any] | None) -> None:
    keys = plan["keys"]
    signer = Path(plan["repo"]) / "ops/hermes/radulator/judge-attest.mjs"
    config_paths = [Path(keys["primary_public_keys_config"]), Path(keys["verification_public_keys_config"])]
    try:
        configs = [json.loads(path.read_text(encoding="utf-8")) for path in config_paths]
    except (OSError, json.JSONDecodeError) as error:
        raise InstallError(f"Local judge public-key trust configuration is missing or invalid: {error}") from error
    if configs[0] != configs[1] or set(configs[0]) != {"radulator-primary-v1", "radulator-verification-v1"}:
        raise InstallError("Judge profiles must share the same complete two-role public-key trust configuration.")
    expected = {
        "radulator-primary-v1": ("primary", "radulator", Path(keys["primary_public"]), Path(keys["primary_private"])),
        "radulator-verification-v1": ("verification", "default", Path(keys["verification_public"]), Path(keys["verification_private"])),
    }
    public_fingerprints: set[str] = set()
    for key_id, (role, profile, public_path, private_path) in expected.items():
        configured = configs[0].get(key_id)
        if not isinstance(configured, dict) or configured.get("role") != role or configured.get("profile") != profile:
            raise InstallError(f"Local judge trust configuration has the wrong identity for {key_id}.")
        if not public_path.is_file() or not private_path.is_file():
            raise InstallError(f"Judge key pair is incomplete for {key_id}.")
        if configured.get("publicKey") != public_path.read_text(encoding="utf-8"):
            raise InstallError(f"Judge public-key trust configuration does not match {public_path}.")
        if private_path.stat().st_mode & 0o777 != 0o600:
            raise InstallError(f"Judge private key must use mode 0600: {private_path}")
        verification = subprocess.run(
            [
                "node", str(signer), "verify-key-pair",
                "--private-key", str(private_path),
                "--public-key", str(public_path),
            ],
            cwd=plan["repo"], check=False, capture_output=True, text=True,
        )
        if verification.returncode != 0:
            raise InstallError(f"Judge private and public keys do not match for {key_id}.")
        try:
            fingerprint = json.loads(verification.stdout).get("publicKeyFingerprint")
        except (json.JSONDecodeError, AttributeError) as error:
            raise InstallError(f"Judge public-key fingerprint readback is malformed for {key_id}.") from error
        if not isinstance(fingerprint, str) or not re.fullmatch(r"[0-9a-f]{64}", fingerprint):
            raise InstallError(f"Judge public-key fingerprint readback is malformed for {key_id}.")
        public_fingerprints.add(fingerprint)
    if len(public_fingerprints) != len(expected):
        raise InstallError("Primary and verification roles must use distinct signing keys.")
    if not isinstance(expected_public_keys, dict) or configs[0] != expected_public_keys:
        raise InstallError("GitHub public-key configuration must exactly match both local judge trust configurations.")


def _run_activation_self_tests(plan: dict[str, Any], runner=None) -> None:
    runner = runner or subprocess.run
    for command in ACTIVATION_SELF_TESTS:
        result = runner(
            list(command), cwd=plan["repo"], check=False, capture_output=True, text=True,
        )
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "no test output").strip()[-1000:]
            raise InstallError(f"Repository activation self-test failed ({' '.join(command)}): {detail}")


def _capture_backup(plan: dict[str, Any], targets: list[Path]) -> None:
    destination = _backup_path(plan)
    def canonical(value: str | Path) -> str:
        return str(Path(value).expanduser().resolve(strict=False))

    if destination.exists():
        try:
            backup = json.loads(destination.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise InstallError(f"Backup manifest is unreadable: {destination}") from error
        if backup.get("schema") != BACKUP_SCHEMA or not isinstance(backup.get("entries"), list):
            raise InstallError(f"Backup manifest schema is invalid: {destination}")
        entries = list(backup["entries"])
        raw_paths = [entry.get("path") for entry in entries if isinstance(entry, dict)]
        if len(raw_paths) != len(entries) or not all(isinstance(path, str) for path in raw_paths):
            raise InstallError(f"Backup manifest contains invalid or duplicate targets: {destination}")
        recorded_paths = [canonical(path) for path in raw_paths]
        if len(set(recorded_paths)) != len(recorded_paths):
            raise InstallError(f"Backup manifest contains invalid or duplicate targets: {destination}")
    else:
        entries = []
        recorded_paths = []

    changed = False
    for target in targets:
        canonical_target = canonical(target)
        if canonical_target in recorded_paths:
            continue
        exists = target.is_file()
        entries.append({
            "path": str(target),
            "existed": exists,
            "mode": (target.stat().st_mode & 0o777) if exists else None,
            "content_base64": base64.b64encode(target.read_bytes()).decode("ascii") if exists else None,
        })
        recorded_paths.append(canonical_target)
        changed = True
    if changed or not destination.exists():
        _atomic_write(destination, _serialize({"schema": BACKUP_SCHEMA, "entries": entries}), 0o600)


def apply_install(
    *, repo: Path, radulator_home: Path, default_home: Path, enable: bool = False, disable: bool = False,
    expected_public_keys: dict[str, Any] | None = None,
    activation_test_runner=None,
) -> dict[str, Any]:
    if enable and disable:
        raise InstallError("enable and disable are mutually exclusive.")
    plan = build_plan(repo=repo, radulator_home=radulator_home, default_home=default_home)
    if enable:
        _verify_activation_trust(plan, expected_public_keys)
        _run_activation_self_tests(plan, activation_test_runner)
    homes = {str(Path(plan["radulator_home"])): [], str(Path(plan["default_home"])): []}
    for template in plan["jobs"]:
        homes[template["_home"]].append(template)
    jobs_paths = [Path(home) / "cron/jobs.json" for home in homes]
    skill_copies = _skill_copies(plan)
    script_copies = _script_copies(plan)
    control_manifest = _control_manifest_path(plan)
    _capture_backup(plan, [
        *jobs_paths,
        *(destination for _, destination in skill_copies),
        *(destination for _, destination in script_copies),
        control_manifest,
    ])

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
        if enable:
            rewritten = [_retire_legacy_gate(job) for job in rewritten]
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

    for source, destination in script_copies:
        if not source.is_file():
            raise InstallError(f"Required script source is missing: {source}")
        content = source.read_bytes()
        if not destination.exists() or destination.read_bytes() != content:
            _atomic_write(destination, content, 0o700)

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


def generate_keys(plan: dict[str, Any]) -> dict[str, dict[str, Any]]:
    signer = Path(plan["repo"]) / "ops/hermes/radulator/judge-attest.mjs"
    definitions = [
        ("primary", Path(plan["radulator_home"]), "radulator-primary-v1", "primary", "radulator"),
        ("verification", Path(plan["default_home"]), "radulator-verification-v1", "verification", "default"),
    ]
    public = {}
    for _, home, key_id, role, profile in definitions:
        command = [
            "node", str(signer), "generate-key", "--directory", str(home / "keys/radulator-clinical"),
            "--key-id", key_id, "--role", role, "--profile", profile,
        ]
        result = subprocess.run(command, cwd=plan["repo"], check=False, capture_output=True, text=True)
        if result.returncode != 0:
            raise InstallError(f"Judge key generation failed for {role}: {result.stderr.strip()}")
        generated = json.loads(result.stdout)
        if generated.get("keyId") != key_id or not isinstance(generated.get("publicConfig"), dict):
            raise InstallError(f"Judge key generation returned malformed public configuration for {role}.")
        public[key_id] = generated["publicConfig"]
    serialized = _serialize(public)
    for name in ("primary_public_keys_config", "verification_public_keys_config"):
        _atomic_write(Path(plan["keys"][name]), serialized, 0o600)
    return public


def read_github_public_keys(repository: str, runner=None) -> dict[str, Any]:
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository or ""):
        raise InstallError("GitHub repository must use owner/name format.")
    if repository != CANONICAL_GITHUB_REPOSITORY:
        raise InstallError(
            f"Installer is bound to {CANONICAL_GITHUB_REPOSITORY}; refusing trust readback from {repository}."
        )
    runner = runner or subprocess.run
    command = [
        "gh", "variable", "get", "RADULATOR_JUDGE_PUBLIC_KEYS_JSON",
        "--repo", repository,
    ]
    result = runner(command, check=False, capture_output=True, text=True)
    if result.returncode != 0:
        raise InstallError(f"GitHub public-key variable readback failed: {(result.stderr or result.stdout).strip()}")
    try:
        public_keys = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise InstallError("GitHub public-key variable readback is not valid JSON.") from error
    if not isinstance(public_keys, dict):
        raise InstallError("GitHub public-key variable readback must be a JSON object.")
    return public_keys


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
    parser.add_argument("--github-repository", default=CANONICAL_GITHUB_REPOSITORY)
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
    expected_public_keys = read_github_public_keys(args.github_repository) if args.enable else None
    result = apply_install(
        repo=args.repo, radulator_home=args.radulator_home, default_home=args.default_home,
        enable=args.enable, disable=args.disable, expected_public_keys=expected_public_keys,
    )
    if args.generate_keys:
        result["public_keys"] = generate_keys(plan)
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
