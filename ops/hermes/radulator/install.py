#!/usr/bin/env python3
"""Install the Radulator risk-tiered Hermes control plane reversibly."""

from __future__ import annotations

import argparse
import base64
import binascii
import contextlib
import datetime as dt
import fcntl
import hashlib
import hmac
import json
import os
import re
import shutil
import stat
import subprocess
import time
from pathlib import Path
from typing import Any


SCHEMA = "radulator-hermes-install/v1"
BACKUP_SCHEMA = "radulator-hermes-backup/v3"
PREVIOUS_BACKUP_SCHEMA = "radulator-hermes-backup/v2"
LEGACY_BACKUP_SCHEMA = "radulator-hermes-backup/v1"
JOBS_TRANSACTION_SCHEMA = "radulator-hermes-jobs-transaction/v1"
JOBS_PREFLIGHT_BACKUP_SCHEMA = "radulator-hermes-jobs-preflight-backup/v2"
JOBS_LOCK_TIMEOUT_SECONDS = 10.0
BACKUP_HMAC_KEY_BYTES = 32
MODEL = "gpt-5.6-sol"
PROVIDER = "openai-codex"
CANONICAL_GITHUB_REPOSITORY = "momomojo/Radulator"
LEGACY_GATE_JOB_NAMES = frozenset({"pr-gate-poller", "judge-queue"})
SEED_CONVERT_JOB_ID = "c41b8448cce4"
PROMOTER_JOB_ID = "f191f946d6fa"
PUBLISHER_JOB_ID = "1def08dbcb74"
LEGACY_V1_TARGET_IDS = frozenset({
    "primary:cron/jobs.json",
    "verification:cron/jobs.json",
    "primary:skills/radulator-clinical-judge/SKILL.md",
    "verification:skills/radulator-clinical-judge/SKILL.md",
    "primary:skills/radulator-release-controller/SKILL.md",
    "primary:skills/radulator-release-learning/SKILL.md",
    "primary:skills/domain/radulator-operations/references/guideline-versions.json",
    "primary:skills/domain/radulator-operations/references/guideline-versions.md",
    "primary:scripts/radulator_formspree_feedback_intake.py",
    "primary:scripts/seed_convert_gate_dedupe.py",
    "primary:scripts/release_promoter.py",
    "primary:scripts/release_promoter_cron.sh",
    "primary:state/radulator-release-control.json",
})
SEED_CONVERT_PROMPT = """Seed conversion pass (WF-2b) with automatic clinical governance. Load radulator-operations and treat SEED_CONVERT_PREFLIGHT_JSON as control data.

Owner policy:
- Approved work must never wait for manual owner signoff.
- A stage-1 research brief is research-only and always convert-eligible, including when it carries medical-review-pending.
- Any later clinical implementation must use a PR to develop, exact-head CI, signed independent primary and verification judge PASS attestations when high risk, protected automatic merge, production promotion, live smoke, immutable release-marker readback, and retained learning.
- NEEDS_FIX is not a terminal hold: create or resume corrective work on the same PR, require a new head, rerun tests, and rejudge. Never bypass the gate or merge manually.

Processing:
1. Build the eligible queue from actionable_seed_issues. Treat gate_override=stage_1_research_only as authoritative approval for research-only conversion. Process at most 2 oldest first.
2. Before creating anything, search the authoritative Kanban for an existing card that already cites the exact GitHub issue URL/number. Reuse and reconcile it rather than duplicating.
3. For each new stage-1 issue, fetch the full issue and create one goal-mode Radulator research card. The card must produce a source-verified brief using current primary society/regulatory guidance and peer-reviewed papers, create a fresh independent review handoff, and after review PASS automatically create the implementation card. It must not edit production directly.
4. The implementation card must preserve the source scope, publish via a PR to develop, include calculator/unit/boundary/error-path and browser regressions, and remain open through the signed clinical gate. Clinical judge NEEDS_FIX must route to correction plus a new exact head and re-review.
5. Only after authoritative readback of the created/reused card, comment on the GitHub issue with the card id and automatic clinical release policy, remove medical-review-pending, and close the converted seed issue. Never close before card readback.
6. For a non-stage-1 seed that genuinely lacks enough specification to create safe research work, create a bounded research/reconciliation card instead of an owner hold. Alert only if an external credential, legal consent, or unavailable authoritative source makes progress impossible.
7. If no card was created/reconciled and no operational error exists, respond exactly [SILENT]. Never combine [SILENT] with other content.
"""
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
    ("npm", "run", "test:hermes-seed-convert"),
    ("npm", "run", "test:hermes-guideline-registry"),
    ("npm", "run", "test:hermes-trusted-publisher"),
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


def _inference_identity(model: str, provider: str) -> tuple[str, str]:
    model_pattern = r"[A-Za-z0-9][A-Za-z0-9._:/+@-]{0,255}"
    provider_pattern = r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}"
    if not re.fullmatch(model_pattern, model or ""):
        raise InstallError("Agent inference model is blank or contains unsupported characters.")
    if not re.fullmatch(provider_pattern, provider or ""):
        raise InstallError("Agent inference provider is blank or contains unsupported characters.")
    return model, provider


def _job(
    name: str, home: Path, repo: Path, prompt: str, skills: list[str], expression: str,
    model: str, provider: str,
) -> dict[str, Any]:
    return {
        "id": _job_id(name),
        "name": name,
        "prompt": prompt,
        "skills": skills,
        "skill": skills[0] if len(skills) == 1 else None,
        "model": model,
        "provider": provider,
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


def _script_job(
    name: str,
    home: Path,
    script: str,
    expression: str,
    *,
    job_id: str | None = None,
    preserve_existing: tuple[str, ...] = (),
) -> dict[str, Any]:
    return {
        "id": job_id or _job_id(name),
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
        "_preserve_existing": list(preserve_existing),
    }


def _script_agent_job(
    name: str,
    job_id: str,
    home: Path,
    prompt: str,
    skill: str,
    script: str,
    expression: str,
    model: str,
    provider: str,
) -> dict[str, Any]:
    return {
        "id": job_id,
        "name": name,
        "prompt": prompt,
        "skills": [skill],
        "skill": skill,
        "model": model,
        "provider": provider,
        "base_url": None,
        "script": script,
        "no_agent": False,
        "context_from": None,
        "schedule": {"kind": "cron", "expr": expression, "display": expression},
        "schedule_display": expression,
        "enabled": False,
        "deliver": None,
        "workdir": None,
        "_home": str(home),
        "_preserve_existing": ["deliver"],
    }


def build_plan(
    *, repo: Path, radulator_home: Path, default_home: Path,
    agent_model: str = MODEL, agent_provider: str = PROVIDER,
) -> dict[str, Any]:
    repo = _require_absolute(Path(repo), "repo")
    radulator_home = _require_absolute(Path(radulator_home), "radulator_home")
    default_home = _require_absolute(Path(default_home), "default_home")
    if radulator_home == default_home:
        raise InstallError("radulator_home and default_home must be distinct judge profiles.")
    agent_model, agent_provider = _inference_identity(agent_model, agent_provider)
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
        repo / "ops/hermes/radulator/seed_convert_gate_dedupe.py",
        repo / "ops/hermes/radulator/release_promoter.py",
        repo / "ops/hermes/radulator/release_promoter_cron.sh",
        repo / "ops/hermes/radulator/trusted_publisher.py",
        repo / "ops/hermes/radulator/trusted_publisher_cron.sh",
        repo / "ops/hermes/radulator/skills/radulator-operations/references/guideline-versions.json",
        repo / "ops/hermes/radulator/skills/radulator-operations/references/guideline-versions.md",
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
            f"--key-id radulator-primary-v1 --role primary --profile radulator --model {agent_model} --provider {agent_provider} "
            f"--output <attestation-json-path> && node {signer} post --repo {CANONICAL_GITHUB_REPOSITORY} "
            f"--attestation <attestation-json-path> --public-keys-file {primary_public_keys_config}. Require authoritative GitHub comment "
            "readback. Never edit source or self-improve during judgment.",
            ["radulator-clinical-judge"], "*/10 * * * *", agent_model, agent_provider,
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
            f"--model {agent_model} --provider {agent_provider} --output <attestation-json-path> && node {signer} post "
            f"--repo {CANONICAL_GITHUB_REPOSITORY} --attestation <attestation-json-path> "
            f"--public-keys-file {verification_public_keys_config}. Require authoritative GitHub "
            "comment readback. Never edit source or self-improve during judgment.",
            ["radulator-clinical-judge"], "3-59/10 * * * *", agent_model, agent_provider,
        ),
        _job(
            "radulator-release-lifecycle", radulator_home, repo,
            f"Run python3 {overlay / 'lifecycle_controller.py'} next --ledger {ledger} --cursor-state {lifecycle_cursor}. "
            "Invoke that collector exactly once in this run. If it returns count 0, stop immediately. Process only its single returned "
            "tracker and never enumerate the full ledger, board, or session history in this run. Reconcile only that tracker's Radulator "
            "GitHub, deploy, and Kanban facts. Use radulator-release-controller. Append only authoritative exact-SHA transitions; run "
            "lifecycle_controller.py apply-actions for NEEDS_FIX, smoke_passed, or learned states and verify every Kanban readback.",
            ["radulator-release-controller"], "*/5 * * * *", agent_model, agent_provider,
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
            ["radulator-release-learning"], "2-59/10 * * * *", agent_model, agent_provider,
        ),
        _script_job(
            "radulator-release-promoter",
            radulator_home,
            "release_promoter_cron.sh",
            "*/10 * * * *",
            job_id=PROMOTER_JOB_ID,
            preserve_existing=("deliver",),
        ),
        _script_job(
            "radulator-trusted-publisher",
            radulator_home,
            "trusted_publisher_cron.sh",
            "4-59/5 * * * *",
            job_id=PUBLISHER_JOB_ID,
        ),
        _script_job(
            "radulator-formspree-feedback-intake",
            radulator_home,
            "radulator_formspree_feedback_intake.py",
            "7-59/15 * * * *",
        ),
        _script_agent_job(
            "radulator-seed-convert",
            SEED_CONVERT_JOB_ID,
            radulator_home,
            SEED_CONVERT_PROMPT,
            "radulator-operations",
            "seed_convert_gate_dedupe.py",
            "0 9 * * *",
            agent_model,
            agent_provider,
        ),
    ]
    return {
        "schema": SCHEMA,
        "repo": str(repo),
        "github_repository": CANONICAL_GITHUB_REPOSITORY,
        "radulator_home": str(radulator_home),
        "default_home": str(default_home),
        "inference": {"model": agent_model, "provider": agent_provider},
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
    return _decode_jobs(path.read_bytes(), path)


def _decode_jobs(
    content: bytes, path: Path
) -> tuple[dict[str, Any] | list[Any], list[dict[str, Any]]]:
    try:
        payload = json.loads(content.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise InstallError(f"Hermes jobs.json is invalid: {path}") from error
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
    preserve_existing = set(template.get("_preserve_existing", [])) if existing else set()
    managed = {
        key: item
        for key, item in template.items()
        if not key.startswith("_") and key != "enabled" and key not in preserve_existing
    }
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
    descriptor = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


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
        (
            source / "radulator-operations/references/guideline-versions.json",
            radulator / "skills/domain/radulator-operations/references/guideline-versions.json",
        ),
        (
            source / "radulator-operations/references/guideline-versions.md",
            radulator / "skills/domain/radulator-operations/references/guideline-versions.md",
        ),
    ]


def _script_copies(plan: dict[str, Any]) -> list[tuple[Path, Path]]:
    repo = Path(plan["repo"])
    radulator = Path(plan["radulator_home"])
    return [
        (
            repo / "ops/hermes/radulator/formspree_feedback_intake.py",
            radulator / "scripts/radulator_formspree_feedback_intake.py",
        ),
        (
            repo / "ops/hermes/radulator/seed_convert_gate_dedupe.py",
            radulator / "scripts/seed_convert_gate_dedupe.py",
        ),
        (
            repo / "ops/hermes/radulator/release_promoter.py",
            radulator / "scripts/release_promoter.py",
        ),
        (
            repo / "ops/hermes/radulator/release_promoter_cron.sh",
            radulator / "scripts/release_promoter_cron.sh",
        ),
        (
            repo / "ops/hermes/radulator/trusted_publisher.py",
            radulator / "scripts/trusted_publisher.py",
        ),
        (
            repo / "ops/hermes/radulator/lifecycle_controller.py",
            radulator / "scripts/lifecycle_controller.py",
        ),
        (
            repo / "ops/hermes/radulator/trusted_publisher_cron.sh",
            radulator / "scripts/trusted_publisher_cron.sh",
        ),
    ]


def _backup_path(plan: dict[str, Any]) -> Path:
    return Path(plan["radulator_home"]) / "state/radulator-release-backup.json"


def _control_manifest_path(plan: dict[str, Any]) -> Path:
    return Path(plan["radulator_home"]) / "state/radulator-release-control.json"


def _backup_key_path(plan: dict[str, Any]) -> Path:
    return Path(plan["radulator_home"]) / "state/radulator-release-backup.hmac.key"


def _jobs_transaction_path(plan: dict[str, Any]) -> Path:
    return Path(plan["radulator_home"]) / "state/radulator-jobs-transaction.json"


def _jobs_transaction_key_path(plan: dict[str, Any]) -> Path:
    return Path(plan["radulator_home"]) / "state/radulator-jobs-transaction.hmac.key"


def _jobs_preflight_backup_path(plan: dict[str, Any]) -> Path:
    return Path(plan["radulator_home"]) / "state/radulator-jobs-preflight-backup.json"


def _backup_targets(plan: dict[str, Any]) -> dict[str, Path]:
    """Return the only restorable targets, addressed without stored filesystem paths."""
    homes = {
        "primary": Path(plan["radulator_home"]),
        "verification": Path(plan["default_home"]),
    }
    ordered = [
        homes["primary"] / "cron/jobs.json",
        homes["verification"] / "cron/jobs.json",
        *(destination for _, destination in _skill_copies(plan)),
        *(destination for _, destination in _script_copies(plan)),
        _control_manifest_path(plan),
    ]
    targets: dict[str, Path] = {}
    for target in ordered:
        matches = [
            (profile, home)
            for profile, home in homes.items()
            if target == home or home in target.parents
        ]
        if not matches:
            raise InstallError(f"Managed backup target is outside the approved profiles: {target}")
        profile, home = max(matches, key=lambda item: len(item[1].parts))
        target_id = f"{profile}:{target.relative_to(home).as_posix()}"
        if target_id in targets or target in targets.values():
            raise InstallError(f"Managed backup target is duplicated: {target}")
        targets[target_id] = target
    return targets


def _require_protected_file(path: Path, label: str) -> os.stat_result:
    try:
        details = path.lstat()
    except OSError as error:
        raise InstallError(f"{label} is missing: {path}") from error
    if not stat.S_ISREG(details.st_mode) or details.st_uid != os.getuid():
        raise InstallError(f"{label} must be an owner-controlled regular non-symlink file: {path}")
    if stat.S_IMODE(details.st_mode) != 0o600:
        raise InstallError(f"{label} must use exact mode 0600: {path}")
    return details


def _require_safe_target(target: Path, plan: dict[str, Any], *, may_be_missing: bool) -> None:
    roots = (Path(plan["radulator_home"]), Path(plan["default_home"]))
    matching = [root for root in roots if target == root or root in target.parents]
    if not matching:
        raise InstallError(f"Restore target is outside the approved profiles: {target}")
    root = max(matching, key=lambda item: len(item.parts))
    chain = [root]
    relative = target.relative_to(root)
    current = root
    for part in relative.parts[:-1]:
        current = current / part
        chain.append(current)
    for directory in chain:
        try:
            details = directory.lstat()
        except FileNotFoundError:
            continue
        except OSError as error:
            raise InstallError(f"Restore target parent is unreadable: {directory}") from error
        if not stat.S_ISDIR(details.st_mode) or details.st_uid != os.getuid():
            raise InstallError(f"Restore target parent must be an owner-controlled non-symlink directory: {directory}")
    try:
        details = target.lstat()
    except FileNotFoundError:
        if may_be_missing:
            return
        raise InstallError(f"Managed target is missing: {target}")
    except OSError as error:
        raise InstallError(f"Managed target is unreadable: {target}") from error
    if not stat.S_ISREG(details.st_mode) or details.st_uid != os.getuid():
        raise InstallError(f"Managed target must be an owner-controlled regular non-symlink file: {target}")


class _ProfileJobsLock:
    def __init__(self, plan: dict[str, Any]):
        self.plan = plan
        self.paths = sorted({
            Path(plan["radulator_home"]) / "cron/.jobs.lock",
            Path(plan["default_home"]) / "cron/.jobs.lock",
        }, key=lambda path: str(path.resolve(strict=False)))
        self.acquired: list[tuple[Path, int]] = []

    @property
    def held(self) -> bool:
        return len(self.acquired) == len(self.paths)

    def acquire(self) -> None:
        if self.acquired:
            raise InstallError("Hermes jobs locks are already held.")
        deadline = time.monotonic() + JOBS_LOCK_TIMEOUT_SECONDS
        try:
            for path in self.paths:
                _require_safe_target(path, self.plan, may_be_missing=True)
                flags = os.O_RDWR | os.O_CREAT
                flags |= getattr(os, "O_CLOEXEC", 0)
                flags |= getattr(os, "O_NOFOLLOW", 0)
                try:
                    descriptor = os.open(path, flags, 0o600)
                except OSError as error:
                    raise InstallError(f"Hermes jobs lock is unavailable: {path}") from error
                try:
                    details = os.fstat(descriptor)
                    if not stat.S_ISREG(details.st_mode) or details.st_uid != os.getuid():
                        raise InstallError(
                            f"Hermes jobs lock must be an owner-controlled regular file: {path}"
                        )
                    while True:
                        try:
                            fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
                            break
                        except (BlockingIOError, OSError) as error:
                            if time.monotonic() >= deadline:
                                raise InstallError(
                                    f"Hermes jobs lock acquisition timed out: {path}"
                                ) from error
                            time.sleep(0.01)
                    authoritative = path.lstat()
                    if (
                        not stat.S_ISREG(authoritative.st_mode)
                        or authoritative.st_uid != os.getuid()
                        or authoritative.st_dev != details.st_dev
                        or authoritative.st_ino != details.st_ino
                    ):
                        raise InstallError(
                            f"Hermes jobs lock path changed during acquisition: {path}"
                        )
                except Exception:
                    os.close(descriptor)
                    raise
                self.acquired.append((path, descriptor))
        except Exception:
            self.release()
            raise

    def release(self) -> None:
        while self.acquired:
            _, descriptor = self.acquired.pop()
            try:
                fcntl.flock(descriptor, fcntl.LOCK_UN)
            finally:
                os.close(descriptor)

    @contextlib.contextmanager
    def suspended(self):
        if not self.held:
            raise InstallError("Hermes jobs locks cannot be suspended while unheld.")
        self.release()
        try:
            yield
        finally:
            self.acquire()


@contextlib.contextmanager
def _locked_profile_jobs(plan: dict[str, Any]):
    """Hold both exact gateway locks, with a bounded proof-only suspension."""
    locks = _ProfileJobsLock(plan)
    locks.acquire()
    try:
        yield locks
    finally:
        locks.release()


def _backup_unsigned(
    entries: list[dict[str, Any]], jobs_preflight: dict[str, Any]
) -> dict[str, Any]:
    return {
        "schema": BACKUP_SCHEMA,
        "entries": entries,
        "jobs_preflight": jobs_preflight,
    }


def _backup_signature(
    key: bytes, entries: list[dict[str, Any]], jobs_preflight: dict[str, Any]
) -> str:
    return hmac.new(
        key,
        _serialize(_backup_unsigned(entries, jobs_preflight)),
        hashlib.sha256,
    ).hexdigest()


def _jobs_preflight_binding(plan: dict[str, Any]) -> dict[str, Any]:
    path = _jobs_preflight_backup_path(plan)
    _require_safe_target(path, plan, may_be_missing=True)
    try:
        path.lstat()
    except FileNotFoundError:
        return {"required": False, "sha256": None}
    _require_protected_file(path, "Hermes jobs preflight backup")
    return {
        "required": True,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    }


def _validate_jobs_preflight_binding(value: Any) -> dict[str, Any]:
    if (
        not isinstance(value, dict)
        or set(value) != {"required", "sha256"}
        or not isinstance(value.get("required"), bool)
        or (
            value["required"]
            and (
                not isinstance(value.get("sha256"), str)
                or not re.fullmatch(r"[0-9a-f]{64}", value["sha256"])
            )
        )
        or (not value["required"] and value.get("sha256") is not None)
    ):
        raise InstallError("Backup manifest jobs preflight binding is invalid.")
    return dict(value)


def _read_or_create_backup_key(plan: dict[str, Any], *, create: bool) -> bytes:
    key_path = _backup_key_path(plan)
    _require_safe_target(key_path, plan, may_be_missing=True)
    try:
        key_path.lstat()
    except FileNotFoundError:
        if not create:
            raise InstallError(f"Backup authentication key is missing: {key_path}")
        _atomic_write(key_path, os.urandom(BACKUP_HMAC_KEY_BYTES), 0o600)
    _require_protected_file(key_path, "Backup authentication key")
    key = key_path.read_bytes()
    if len(key) != BACKUP_HMAC_KEY_BYTES:
        raise InstallError("Backup authentication key has the wrong length.")
    return key


def _read_or_create_jobs_transaction_key(
    plan: dict[str, Any], *, create: bool
) -> bytes:
    """Return the job-safety key without consulting the release backup key.

    Job quiescence has to remain available when the older release-backup key or
    manifest is malformed.  Keeping this key separate prevents those fallible
    backup validations from running before enabled managed consumers are
    durably disabled and read back.
    """
    key_path = _jobs_transaction_key_path(plan)
    _require_safe_target(key_path, plan, may_be_missing=True)
    try:
        key_path.lstat()
    except FileNotFoundError:
        if not create:
            raise InstallError(f"Hermes jobs transaction key is missing: {key_path}")
        _atomic_write(key_path, os.urandom(BACKUP_HMAC_KEY_BYTES), 0o600)
    _require_protected_file(key_path, "Hermes jobs transaction key")
    key = key_path.read_bytes()
    if len(key) != BACKUP_HMAC_KEY_BYTES:
        raise InstallError("Hermes jobs transaction key has the wrong length.")
    return key


def _validate_backup_entry(entry: Any, *, legacy: bool) -> tuple[str, bool, int | None, bytes | None]:
    expected_fields = {"path" if legacy else "target_id", "existed", "mode", "content_base64"}
    if not isinstance(entry, dict) or set(entry) != expected_fields:
        raise InstallError("Backup manifest entry fields are invalid.")
    identity = entry["path" if legacy else "target_id"]
    existed = entry["existed"]
    mode = entry["mode"]
    encoded = entry["content_base64"]
    if not isinstance(identity, str) or not identity or not isinstance(existed, bool):
        raise InstallError("Backup manifest entry identity is invalid.")
    if existed:
        if not isinstance(mode, int) or isinstance(mode, bool) or not 0 <= mode <= 0o777:
            raise InstallError("Backup manifest entry mode is invalid.")
        if not isinstance(encoded, str):
            raise InstallError("Backup manifest entry content is invalid.")
        try:
            content = base64.b64decode(encoded, validate=True)
        except (ValueError, binascii.Error) as error:
            raise InstallError("Backup manifest entry content is invalid.") from error
    else:
        if mode is not None or encoded is not None:
            raise InstallError("Backup manifest absent entry must not contain mode or content.")
        content = None
    return identity, existed, mode, content


def _snapshot_backup_target(
    target_id: str,
    target: Path,
    plan: dict[str, Any],
) -> dict[str, Any]:
    _require_safe_target(target, plan, may_be_missing=True)
    try:
        target.lstat()
    except FileNotFoundError:
        return {
            "target_id": target_id,
            "existed": False,
            "mode": None,
            "content_base64": None,
        }
    _require_safe_target(target, plan, may_be_missing=False)
    return {
        "target_id": target_id,
        "existed": True,
        "mode": stat.S_IMODE(target.lstat().st_mode),
        "content_base64": base64.b64encode(target.read_bytes()).decode("ascii"),
    }


def _stable_job_digest(job: dict[str, Any]) -> str:
    return hashlib.sha256(_serialize(job)).hexdigest()


def _preinstall_managed_consumers(plan: dict[str, Any]) -> list[dict[str, str]]:
    homes = {
        str(Path(plan["radulator_home"])): [],
        str(Path(plan["default_home"])): [],
    }
    for template in plan["jobs"]:
        homes[template["_home"]].append(template)
    scripts, skills, prompt_tokens = _managed_provenance(plan, homes)
    templates = [template for values in homes.values() for template in values]
    records: list[dict[str, str]] = []
    for profile, home in (
        ("primary", Path(plan["radulator_home"])),
        ("verification", Path(plan["default_home"])),
    ):
        _, jobs = _load_jobs(home / "cron/jobs.json")
        records.extend(
            {"profile": profile, "job_sha256": _stable_job_digest(job)}
            for job in jobs
            if _job_consumes_managed_target(
                job, home, templates, scripts, skills, prompt_tokens
            )
        )
    return sorted(records, key=lambda item: (item["profile"], item["job_sha256"]))


def _jobs_preflight_unsigned(
    entries: list[dict[str, Any]], managed_consumers: list[dict[str, str]]
) -> dict[str, Any]:
    return {
        "schema": JOBS_PREFLIGHT_BACKUP_SCHEMA,
        "entries": entries,
        "managed_consumers": managed_consumers,
    }


def _capture_jobs_preflight_backup(plan: dict[str, Any]) -> None:
    """Authenticate the original two job files without touching backup state."""
    destination = _jobs_preflight_backup_path(plan)
    try:
        destination.lstat()
    except FileNotFoundError:
        _require_safe_target(destination, plan, may_be_missing=True)
    else:
        # Never parse attacker-controlled prior state while managed jobs may be
        # active.  This intentionally does not validate even the file type or
        # mode; a later post-quiescence load authenticates this exact path.
        return
    targets = _backup_targets(plan)
    entries = [
        _snapshot_backup_target(target_id, targets[target_id], plan)
        for target_id in (
            "primary:cron/jobs.json",
            "verification:cron/jobs.json",
        )
    ]
    managed_consumers = _preinstall_managed_consumers(plan)
    key = _read_or_create_jobs_transaction_key(plan, create=True)
    unsigned = _jobs_preflight_unsigned(entries, managed_consumers)
    payload = {
        **unsigned,
        "hmac_sha256": hmac.new(
            key, _serialize(unsigned), hashlib.sha256
        ).hexdigest(),
    }
    _atomic_write(destination, _serialize(payload), 0o600)
    _require_protected_file(destination, "Hermes jobs preflight backup")


def _load_jobs_preflight_backup(
    plan: dict[str, Any],
) -> tuple[list[dict[str, Any]], frozenset[tuple[str, str]]]:
    destination = _jobs_preflight_backup_path(plan)
    _require_safe_target(destination, plan, may_be_missing=False)
    _require_protected_file(destination, "Hermes jobs preflight backup")
    try:
        payload = json.loads(destination.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise InstallError("Hermes jobs preflight backup is unreadable.") from error
    if (
        not isinstance(payload, dict)
        or set(payload)
        != {"schema", "entries", "managed_consumers", "hmac_sha256"}
        or payload.get("schema") != JOBS_PREFLIGHT_BACKUP_SCHEMA
        or not isinstance(payload.get("entries"), list)
        or not isinstance(payload.get("managed_consumers"), list)
    ):
        raise InstallError("Hermes jobs preflight backup schema is invalid.")
    entries = list(payload["entries"])
    validated = [_validate_backup_entry(entry, legacy=False) for entry in entries]
    identities = [target_id for target_id, *_ in validated]
    if identities != [
        "primary:cron/jobs.json",
        "verification:cron/jobs.json",
    ]:
        raise InstallError("Hermes jobs preflight backup identities are invalid.")
    managed_consumers: list[tuple[str, str]] = []
    for record in payload["managed_consumers"]:
        if (
            not isinstance(record, dict)
            or set(record) != {"profile", "job_sha256"}
            or record.get("profile") not in {"primary", "verification"}
            or not isinstance(record.get("job_sha256"), str)
            or not re.fullmatch(r"[0-9a-f]{64}", record["job_sha256"])
        ):
            raise InstallError("Hermes jobs preflight managed provenance is invalid.")
        managed_consumers.append((record["profile"], record["job_sha256"]))
    if len(set(managed_consumers)) != len(managed_consumers):
        raise InstallError("Hermes jobs preflight managed provenance is duplicated.")
    key = _read_or_create_jobs_transaction_key(plan, create=False)
    unsigned = _jobs_preflight_unsigned(entries, payload["managed_consumers"])
    signature = payload.get("hmac_sha256")
    expected = hmac.new(key, _serialize(unsigned), hashlib.sha256).hexdigest()
    if not isinstance(signature, str) or not hmac.compare_digest(signature, expected):
        raise InstallError("Hermes jobs preflight backup authentication failed.")
    return entries, frozenset(managed_consumers)


def _load_bound_jobs_preflight(
    plan: dict[str, Any], binding: dict[str, Any]
) -> frozenset[tuple[str, str]]:
    binding = _validate_jobs_preflight_binding(binding)
    if not binding["required"]:
        return frozenset()
    path = _jobs_preflight_backup_path(plan)
    _require_safe_target(path, plan, may_be_missing=False)
    _require_protected_file(path, "Hermes jobs preflight backup")
    if not hmac.compare_digest(
        hashlib.sha256(path.read_bytes()).hexdigest(), binding["sha256"]
    ):
        raise InstallError(
            "Hermes jobs preflight backup does not match the signed backup binding."
        )
    _, managed_consumers = _load_jobs_preflight_backup(plan)
    return managed_consumers


def _load_backup(plan: dict[str, Any], *, migrate_legacy: bool) -> dict[str, Any]:
    destination = _backup_path(plan)
    _require_safe_target(destination, plan, may_be_missing=True)
    _require_protected_file(destination, "Backup manifest")
    try:
        backup = json.loads(destination.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise InstallError(f"Backup manifest is unreadable: {destination}") from error
    if not isinstance(backup, dict) or not isinstance(backup.get("entries"), list):
        raise InstallError(f"Backup manifest schema is invalid: {destination}")
    targets = _backup_targets(plan)
    entries = list(backup["entries"])
    if backup.get("schema") == LEGACY_BACKUP_SCHEMA:
        if not migrate_legacy or set(backup) != {"schema", "entries"}:
            raise InstallError("Legacy backup manifest requires a safe installer migration.")
        validated = [_validate_backup_entry(entry, legacy=True) for entry in entries]
        paths = [identity for identity, *_ in validated]
        if not LEGACY_V1_TARGET_IDS.issubset(targets):
            raise InstallError("Installer no longer maps the exact previous backup target allowlist.")
        expected_paths = {str(targets[target_id]) for target_id in LEGACY_V1_TARGET_IDS}
        if len(set(paths)) != len(paths) or set(paths) != expected_paths:
            raise InstallError(
                "Legacy backup paths must exactly match the previous managed target allowlist."
            )
        legacy_by_path = {
            identity: (existed, mode, content)
            for identity, existed, mode, content in validated
        }
        entries = []
        for target_id, target in targets.items():
            if target_id in LEGACY_V1_TARGET_IDS:
                existed, mode, content = legacy_by_path[str(target)]
                entries.append({
                    "target_id": target_id,
                    "existed": existed,
                    "mode": mode,
                    "content_base64": (
                        base64.b64encode(content).decode("ascii")
                        if content is not None
                        else None
                    ),
                })
            else:
                entries.append(_snapshot_backup_target(target_id, target, plan))
        key = _read_or_create_backup_key(plan, create=True)
        jobs_preflight = _jobs_preflight_binding(plan)
        migrated = {
            **_backup_unsigned(entries, jobs_preflight),
            "hmac_sha256": _backup_signature(
                key, entries, jobs_preflight
            ),
        }
        _atomic_write(destination, _serialize(migrated), 0o600)
        return migrated
    if backup.get("schema") == PREVIOUS_BACKUP_SCHEMA:
        if (
            not migrate_legacy
            or set(backup) != {"schema", "entries", "hmac_sha256"}
        ):
            raise InstallError(
                "Previous backup manifest requires a safe installer migration."
            )
        key = _read_or_create_backup_key(plan, create=False)
        old_unsigned = {
            "schema": PREVIOUS_BACKUP_SCHEMA,
            "entries": entries,
        }
        old_signature = hmac.new(
            key, _serialize(old_unsigned), hashlib.sha256
        ).hexdigest()
        if (
            not isinstance(backup.get("hmac_sha256"), str)
            or not hmac.compare_digest(backup["hmac_sha256"], old_signature)
        ):
            raise InstallError("Backup manifest authentication failed.")
        validated = [_validate_backup_entry(entry, legacy=False) for entry in entries]
        identities = [target_id for target_id, *_ in validated]
        if len(set(identities)) != len(identities):
            raise InstallError("Previous backup manifest contains duplicate target ids.")
        if set(identities) != set(targets):
            raise InstallError(
                "Previous backup manifest must exactly match the managed target allowlist."
            )
        for target_id in identities:
            _require_safe_target(targets[target_id], plan, may_be_missing=True)
        jobs_preflight = _jobs_preflight_binding(plan)
        if not jobs_preflight["required"]:
            raise InstallError(
                "Previous backup manifest lacks required authenticated jobs provenance."
            )
        _load_jobs_preflight_backup(plan)
        migrated = {
            **_backup_unsigned(entries, jobs_preflight),
            "hmac_sha256": _backup_signature(
                key, entries, jobs_preflight
            ),
        }
        _atomic_write(destination, _serialize(migrated), 0o600)
        return migrated
    if (
        backup.get("schema") != BACKUP_SCHEMA
        or set(backup)
        != {"schema", "entries", "jobs_preflight", "hmac_sha256"}
    ):
        raise InstallError(f"Backup manifest schema is invalid: {destination}")
    jobs_preflight = _validate_jobs_preflight_binding(backup["jobs_preflight"])
    key = _read_or_create_backup_key(plan, create=False)
    signature = backup.get("hmac_sha256")
    if not isinstance(signature, str) or not hmac.compare_digest(
        signature, _backup_signature(key, entries, jobs_preflight)
    ):
        raise InstallError("Backup manifest authentication failed.")
    return backup


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


def _activation_python_env() -> dict[str, str]:
    return {
        "HOME": "/var/empty",
        "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
        "PYTHONNOUSERSITE": "1",
    }


def _trusted_runtime_probe(
    hermes_root: Path,
    module_name: str,
    predicate: str,
) -> str:
    return (
        "import importlib, json; from pathlib import Path; "
        f"root = Path({str(hermes_root)!r}).resolve(strict=True); "
        f"module = importlib.import_module({module_name!r}); "
        "origin = Path(module.__file__).resolve(strict=True); "
        f"raise SystemExit(0 if root in origin.parents and ({predicate}) else 1)"
    )


def _verify_broker_contract(plan: dict[str, Any], runner=None) -> None:
    runner = runner or subprocess.run
    hermes_root = Path(plan["radulator_home"]).parent.parent.resolve(strict=True)
    runtime_python = hermes_root / "hermes-agent/venv/bin/python"
    checks = (
        (
            "trusted local commit broker",
            _trusted_runtime_probe(
                hermes_root,
                "hermes_cli.kanban_git_broker",
                "module.PUBLISH_CONTRACT == 'hermes.trusted_local_commit.v1'",
            ),
        ),
        (
            "worker security boundary",
            _trusted_runtime_probe(
                hermes_root,
                "tools.kanban_worker_boundary",
                "module.WORKER_GIT_SECURITY_BOUNDARY == 'hermes.worker_git_isolation.v1'",
            ),
        ),
    )
    for label, expression in checks:
        command = [str(runtime_python), "-I", "-c", expression]
        result = runner(
            command,
            cwd=hermes_root,
            check=False,
            capture_output=True,
            text=True,
            env=_activation_python_env(),
        )
        if result.returncode != 0:
            raise InstallError(f"Installed Hermes runtime does not expose the approved {label} contract.")

    authority_canary = {
        "contract": "hermes.trusted_publisher.authority-semantic-canary.v1",
        "claim_exact_identity_bound": True,
        "conflicting_claim_rejected": True,
        "stale_run_rejected": True,
        "stale_tracker_rejected": True,
        "completion_atomic": True,
        "replay_idempotent": True,
        "host_receipt_signature_verified": True,
    }
    authority_expression = _trusted_runtime_probe(
        hermes_root,
        "hermes_cli.kanban_db",
        (
            "callable(getattr(module, 'claim_trusted_publisher_authority', None)) "
            "and callable(getattr(module, 'complete_trusted_publisher_authority', None)) "
            "and callable(getattr(module, 'verify_trusted_publisher_authority_receipt', None)) "
            "and callable(getattr(module, 'run_trusted_publisher_authority_semantic_canary', None)) "
            "and module.run_trusted_publisher_authority_semantic_canary() == "
            f"json.loads({json.dumps(authority_canary)!r})"
        ),
    )
    authority_command = [str(runtime_python), "-I", "-c", authority_expression]
    authority = runner(
        authority_command,
        cwd=hermes_root,
        check=False,
        capture_output=True,
        text=True,
        env=_activation_python_env(),
    )
    if authority.returncode != 0:
        raise InstallError(
            "PENDING_HERMES_RUNTIME: installed Hermes must pass the semantic authority "
            "claim/CAS and host-receipt verification canary before the trusted "
            "publisher can be enabled."
        )

    canary_contract = {
        "contract": "hermes.worker_model_path_denial_canary.v1",
        "model_path_attempted": True,
        "profile_env_denied": True,
        "gh_config_denied": True,
        "gh_token_denied": True,
        "ssh_config_denied": True,
        "ssh_private_keys_denied": True,
        "keychain_lookup_denied": True,
        "loopback_network_denied": True,
        "public_network_denied": True,
        "git_metadata_write_denied": True,
        "workspace_edit_succeeded": True,
        "bounded_test_succeeded": True,
    }
    canary_expression = _trusted_runtime_probe(
        hermes_root,
        "tools.kanban_worker_boundary",
        (
            "callable(getattr(module, 'run_worker_model_path_denial_canary', None)) "
            "and module.run_worker_model_path_denial_canary() == "
            f"json.loads({json.dumps(canary_contract)!r})"
        ),
    )
    canary_command = [str(runtime_python), "-I", "-c", canary_expression]
    canary = runner(
        canary_command,
        cwd=hermes_root,
        check=False,
        capture_output=True,
        text=True,
        env=_activation_python_env(),
    )
    if canary.returncode != 0:
        raise InstallError(
            "PENDING_HERMES_RUNTIME: installed Hermes must execute the approved "
            "worker model-path denial canary before the trusted publisher can be enabled."
        )


def _verify_publisher_auth(plan: dict[str, Any], runner=None) -> None:
    runner = runner or subprocess.run
    command = ["/opt/homebrew/bin/gh", "auth", "token", "--hostname", "github.com"]
    result = runner(
        command,
        cwd=plan["repo"],
        check=False,
        capture_output=True,
        text=True,
        env={
            "HOME": str(Path.home()),
            "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
        },
    )
    token = result.stdout.strip() if isinstance(result.stdout, str) else ""
    if (
        result.returncode != 0
        or not token
        or len(token) > 4096
        or "\n" in token
        or "\r" in token
    ):
        raise InstallError(
            "Trusted publisher GitHub authentication is unavailable or malformed."
        )


def _verify_dedicated_publisher_identity(_plan: dict[str, Any]) -> None:
    """Hold activation until a reviewed cross-UID service contract is bound.

    The previously probed Python constants and same-UID model-path canaries are
    useful defense-in-depth evidence, but they cannot establish a credential
    boundary against a model that can drive another process owned by that same
    account.  No dedicated broker/publisher receipt contract is source-bound in
    this release, so activation must remain explicitly unavailable.
    """
    raise InstallError(
        "PENDING_HERMES_RUNTIME: trusted publisher activation requires a reviewed "
        "dedicated broker/publisher service running under a separate OS identity "
        "with exact authenticated peer and receipt readback."
    )


def _capture_backup(plan: dict[str, Any]) -> None:
    destination = _backup_path(plan)
    targets = _backup_targets(plan)
    _require_safe_target(destination, plan, may_be_missing=True)
    try:
        destination.lstat()
    except FileNotFoundError:
        destination_present = False
    else:
        destination_present = True
    if destination_present:
        backup = _load_backup(plan, migrate_legacy=True)
        entries = list(backup["entries"])
        jobs_preflight = _validate_jobs_preflight_binding(
            backup["jobs_preflight"]
        )
        validated = [_validate_backup_entry(entry, legacy=False) for entry in entries]
        recorded_ids = [target_id for target_id, *_ in validated]
        if len(set(recorded_ids)) != len(recorded_ids):
            raise InstallError(f"Backup manifest contains duplicate target ids: {destination}")
        unknown = sorted(set(recorded_ids) - set(targets))
        if unknown:
            raise InstallError(f"Backup manifest contains unknown target ids: {', '.join(unknown)}")
        for target_id in recorded_ids:
            _require_safe_target(targets[target_id], plan, may_be_missing=True)
    else:
        preflight_path = _jobs_preflight_backup_path(plan)
        _require_safe_target(preflight_path, plan, may_be_missing=True)
        if preflight_path.exists():
            # This is deliberately the first point at which the pre-quiescence
            # snapshot is parsed or authenticated.  Callers have already
            # disabled and read back every managed job under both locks.
            entries, _ = _load_jobs_preflight_backup(plan)
            recorded_ids = [entry["target_id"] for entry in entries]
            jobs_preflight = _jobs_preflight_binding(plan)
            key = _read_or_create_backup_key(plan, create=True)
            signed_prefix = {
                **_backup_unsigned(entries, jobs_preflight),
                "hmac_sha256": _backup_signature(
                    key, entries, jobs_preflight
                ),
            }
            _atomic_write(destination, _serialize(signed_prefix), 0o600)
            _require_protected_file(destination, "Backup manifest")
            destination_present = True
        else:
            entries = []
            recorded_ids = []
            jobs_preflight = {"required": False, "sha256": None}

    changed = False
    for target_id, target in targets.items():
        if target_id in recorded_ids:
            continue
        _require_safe_target(target, plan, may_be_missing=True)
        try:
            target.lstat()
        except FileNotFoundError:
            exists = False
        else:
            _require_safe_target(target, plan, may_be_missing=False)
            exists = True
        entries.append({
            "target_id": target_id,
            "existed": exists,
            "mode": stat.S_IMODE(target.lstat().st_mode) if exists else None,
            "content_base64": base64.b64encode(target.read_bytes()).decode("ascii") if exists else None,
        })
        recorded_ids.append(target_id)
        changed = True
    if changed or not destination_present:
        key = _read_or_create_backup_key(plan, create=True)
        signed = {
            **_backup_unsigned(entries, jobs_preflight),
            "hmac_sha256": _backup_signature(
                key, entries, jobs_preflight
            ),
        }
        _atomic_write(destination, _serialize(signed), 0o600)
    _require_protected_file(destination, "Backup manifest")


def _publisher_copies(plan: dict[str, Any]) -> list[tuple[Path, Path]]:
    return [
        pair
        for pair in _script_copies(plan)
        if pair[1].name
        in {"trusted_publisher.py", "trusted_publisher_cron.sh", "lifecycle_controller.py"}
    ]


def _publisher_job_readback(plan: dict[str, Any]) -> dict[str, Any] | None:
    path = Path(plan["radulator_home"]) / "cron/jobs.json"
    _require_safe_target(path, plan, may_be_missing=True)
    _, jobs = _load_jobs(path)
    matches = [
        job
        for job in jobs
        if job.get("name") == "radulator-trusted-publisher" or job.get("id") == PUBLISHER_JOB_ID
    ]
    if not matches:
        return None
    if len(matches) != 1 or matches[0].get("name") != "radulator-trusted-publisher" or matches[0].get("id") != PUBLISHER_JOB_ID:
        raise InstallError("Trusted publisher job identity is missing, duplicated, or ambiguous.")
    return matches[0]


def _publisher_exact_identity_count(plan: dict[str, Any]) -> int:
    path = Path(plan["radulator_home"]) / "cron/jobs.json"
    _require_safe_target(path, plan, may_be_missing=True)
    _, jobs = _load_jobs(path)
    return sum(
        1
        for job in jobs
        if job.get("name") == "radulator-trusted-publisher"
        and job.get("id") == PUBLISHER_JOB_ID
    )


def _quiesce_publisher(plan: dict[str, Any]) -> None:
    path = Path(plan["radulator_home"]) / "cron/jobs.json"
    payload, jobs = _load_jobs(path)
    current = _publisher_job_readback(plan)
    if current is None or current.get("enabled") is False:
        return
    now = _now()
    rewritten = []
    for job in jobs:
        if job.get("name") == "radulator-trusted-publisher" and job.get("id") == PUBLISHER_JOB_ID:
            rewritten.append({
                **job,
                "enabled": False,
                "state": "paused",
                "paused_at": now,
                "paused_reason": "publisher-upgrade-quiesce",
                "updated_at": now,
                "next_run_at": None,
            })
        else:
            rewritten.append(job)
    updated = rewritten if isinstance(payload, list) else {**payload, "jobs": rewritten}
    _atomic_write(path, _serialize(updated), 0o600)
    readback = _publisher_job_readback(plan)
    if readback is None or readback.get("enabled") is not False or readback.get("state") != "paused":
        raise InstallError("Trusted publisher job did not read back as quiesced.")


def _publisher_assets_drift(plan: dict[str, Any]) -> bool:
    drift = False
    for source, destination in _publisher_copies(plan):
        if not source.is_file():
            raise InstallError(f"Required script source is missing: {source}")
        _require_safe_target(destination, plan, may_be_missing=True)
        try:
            details = destination.lstat()
        except FileNotFoundError:
            drift = True
            continue
        if not stat.S_ISREG(details.st_mode) or details.st_uid != os.getuid():
            raise InstallError(f"Installed publisher asset must be an owner-controlled regular non-symlink file: {destination}")
        if stat.S_IMODE(details.st_mode) != 0o700 or destination.read_bytes() != source.read_bytes():
            drift = True
    return drift


def _publisher_snapshots(plan: dict[str, Any]) -> dict[Path, tuple[bool, int | None, bytes | None]]:
    snapshots = {}
    for _, destination in _publisher_copies(plan):
        try:
            details = destination.lstat()
        except FileNotFoundError:
            snapshots[destination] = (False, None, None)
            continue
        if not stat.S_ISREG(details.st_mode) or details.st_uid != os.getuid():
            raise InstallError(f"Installed publisher asset must be an owner-controlled regular non-symlink file: {destination}")
        snapshots[destination] = (True, stat.S_IMODE(details.st_mode), destination.read_bytes())
    return snapshots


def _restore_publisher_snapshots(
    plan: dict[str, Any], snapshots: dict[Path, tuple[bool, int | None, bytes | None]],
) -> None:
    for destination, (existed, mode, content) in snapshots.items():
        if existed:
            if mode is None or content is None:
                raise InstallError("Publisher rollback snapshot is incomplete.")
            _atomic_write(destination, content, mode)
        else:
            try:
                destination.lstat()
            except FileNotFoundError:
                continue
            details = destination.lstat()
            if not stat.S_ISREG(details.st_mode) or details.st_uid != os.getuid():
                raise InstallError(f"Refusing to remove unsafe publisher asset after failed upgrade: {destination}")
            destination.unlink()


def _job_file_snapshots(
    plan: dict[str, Any], paths: list[Path]
) -> dict[Path, tuple[bool, int | None, bytes | None]]:
    snapshots: dict[Path, tuple[bool, int | None, bytes | None]] = {}
    for path in paths:
        _require_safe_target(path, plan, may_be_missing=True)
        try:
            details = path.lstat()
        except FileNotFoundError:
            snapshots[path] = (False, None, None)
            continue
        snapshots[path] = (
            True,
            stat.S_IMODE(details.st_mode),
            path.read_bytes(),
        )
    return snapshots


def _restore_job_file_snapshots(
    plan: dict[str, Any],
    snapshots: dict[Path, tuple[bool, int | None, bytes | None]],
) -> None:
    for path, (existed, mode, content) in snapshots.items():
        _require_safe_target(path, plan, may_be_missing=True)
        if existed:
            if mode is None or content is None:
                raise InstallError("Hermes job rollback snapshot is incomplete.")
            if not path.exists() or path.read_bytes() != content or stat.S_IMODE(path.lstat().st_mode) != mode:
                _atomic_write(path, content, mode)
        else:
            try:
                details = path.lstat()
            except FileNotFoundError:
                continue
            if not stat.S_ISREG(details.st_mode) or details.st_uid != os.getuid():
                raise InstallError(
                    f"Refusing to remove unsafe Hermes job file after failed activation: {path}"
                )
            path.unlink()

    for path, (existed, mode, content) in snapshots.items():
        try:
            details = path.lstat()
        except FileNotFoundError:
            if existed:
                raise InstallError(f"Hermes job rollback readback is missing: {path}")
            continue
        if not existed:
            raise InstallError(f"Hermes job rollback left an unexpected file: {path}")
        if (
            mode is None
            or content is None
            or not stat.S_ISREG(details.st_mode)
            or details.st_uid != os.getuid()
            or stat.S_IMODE(details.st_mode) != mode
            or path.read_bytes() != content
        ):
            raise InstallError(f"Hermes job rollback failed exact readback: {path}")


def _job_snapshots_contain_enabled_managed_jobs(
    snapshots: dict[Path, tuple[bool, int | None, bytes | None]],
    homes: dict[str, list[dict[str, Any]]],
) -> bool:
    for home, templates in homes.items():
        path = Path(home) / "cron/jobs.json"
        existed, _, content = snapshots[path]
        if not existed:
            continue
        if content is None:
            return True
        try:
            payload = json.loads(content.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return True
        if isinstance(payload, list):
            jobs = payload
        elif isinstance(payload, dict) and isinstance(payload.get("jobs"), list):
            jobs = payload["jobs"]
        else:
            return True
        if not all(isinstance(job, dict) for job in jobs):
            return True
        for template in templates:
            matches = [
                job
                for job in jobs
                if job.get("name") == template["name"] or job.get("id") == template["id"]
            ]
            if len(matches) > 1 or any(job.get("enabled") is not False for job in matches):
                return True
    return False


def _job_skill_names(job: dict[str, Any]) -> set[str]:
    names: set[str] = set()
    skill = job.get("skill")
    if isinstance(skill, str) and skill:
        names.add(skill)
    skills = job.get("skills")
    if isinstance(skills, list):
        names.update(value for value in skills if isinstance(value, str) and value)
    return names


def _managed_provenance(
    plan: dict[str, Any], homes: dict[str, list[dict[str, Any]]]
) -> tuple[set[str], set[str], tuple[str, ...]]:
    templates = [template for values in homes.values() for template in values]
    scripts = {
        Path(value).name
        for template in templates
        if isinstance((value := template.get("script")), str) and value
    }
    scripts.update(destination.name for _, destination in _script_copies(plan))
    skills = {
        value
        for template in templates
        for value in _job_skill_names(template)
    }
    prompt_tokens = tuple(sorted({*scripts, *skills}, key=lambda value: (-len(value), value)))
    return scripts, skills, prompt_tokens


def _prompt_mentions_token(prompt: Any, token: str) -> bool:
    return isinstance(prompt, str) and re.search(
        rf"(?<![A-Za-z0-9_.-]){re.escape(token)}(?![A-Za-z0-9_.-])",
        prompt,
    ) is not None


def _job_matches_template_provenance(
    job: dict[str, Any], template: dict[str, Any], home: Path
) -> bool:
    if job.get("name") == template["name"] or job.get("id") == template["id"]:
        return True
    template_script = template.get("script")
    job_script = job.get("script")
    if (
        isinstance(template_script, str)
        and template_script
        and _job_script_consumes_managed_target(
            home, job_script, {Path(template_script).name}
        )
    ):
        return True
    template_skills = _job_skill_names(template)
    if template_skills and template_skills.intersection(_job_skill_names(job)):
        return True
    prompt = job.get("prompt")
    if isinstance(prompt, str) and prompt and prompt == template.get("prompt"):
        return True
    return any(
        _prompt_mentions_token(prompt, token)
        for token in (
            *(
                [Path(template_script).name]
                if isinstance(template_script, str) and template_script
                else []
            ),
            *sorted(template_skills),
        )
    )


def _job_script_consumes_managed_target(
    home: Path,
    script: Any,
    managed_names: set[str],
    managed_homes: set[Path] | None = None,
) -> bool:
    if not isinstance(script, str) or not script:
        return False
    try:
        raw = Path(script).expanduser()
    except (OSError, RuntimeError, ValueError):
        return False
    if raw.name in managed_names:
        return True

    scripts_root = home / "scripts"
    candidate = raw if raw.is_absolute() else scripts_root / raw
    managed_roots = {scripts_root}
    managed_roots.update(
        managed_home / "scripts" for managed_home in (managed_homes or set())
    )

    # A hard link can live outside either profile's scripts root and use an
    # unrelated basename. Compare the non-followed regular-file identity
    # against both managed roots so cross-profile aliases are also quiesced.
    # lstat avoids opening FIFOs/devices or following an attacker-selected
    # symlink.
    try:
        candidate_details = candidate.lstat()
    except (FileNotFoundError, OSError, RuntimeError, ValueError):
        candidate_details = None
    if candidate_details is not None and stat.S_ISREG(candidate_details.st_mode):
        for managed_root in managed_roots:
            for managed_name in managed_names:
                try:
                    managed_details = (managed_root / managed_name).lstat()
                except (FileNotFoundError, OSError, RuntimeError, ValueError):
                    continue
                if (
                    stat.S_ISREG(managed_details.st_mode)
                    and candidate_details.st_dev == managed_details.st_dev
                    and candidate_details.st_ino == managed_details.st_ino
                ):
                    return True

    try:
        resolved_candidate = candidate.resolve(strict=False)
    except (OSError, RuntimeError, ValueError):
        return False

    for managed_root in managed_roots:
        for managed_name in managed_names:
            managed_target = managed_root / managed_name
            try:
                if resolved_candidate == managed_target.resolve(strict=False):
                    return True
                candidate_details = candidate.stat()
                managed_details = managed_target.stat()
            except (FileNotFoundError, OSError, RuntimeError, ValueError):
                continue
            if (
                stat.S_ISREG(candidate_details.st_mode)
                and stat.S_ISREG(managed_details.st_mode)
                and candidate_details.st_dev == managed_details.st_dev
                and candidate_details.st_ino == managed_details.st_ino
            ):
                return True
    return False


def _job_consumes_managed_target(
    job: dict[str, Any],
    home: Path,
    templates: list[dict[str, Any]],
    scripts: set[str],
    skills: set[str],
    prompt_tokens: tuple[str, ...],
) -> bool:
    if any(
        job.get("name") == template["name"] or job.get("id") == template["id"]
        for template in templates
    ):
        return True
    managed_homes = {
        Path(template["_home"])
        for template in templates
        if isinstance(template.get("_home"), str)
    }
    if _job_script_consumes_managed_target(
        home, job.get("script"), scripts, managed_homes
    ):
        return True
    if skills.intersection(_job_skill_names(job)):
        return True
    return any(_prompt_mentions_token(job.get("prompt"), token) for token in prompt_tokens)


def _quiesced_job(job: dict[str, Any], reason: str) -> dict[str, Any]:
    if (
        job.get("enabled") is False
        and job.get("state") == "paused"
        and job.get("next_run_at") is None
    ):
        return job
    now = _now()
    return {
        **job,
        "enabled": False,
        "state": "paused",
        "paused_at": job.get("paused_at") or now,
        "paused_reason": reason,
        "updated_at": now,
        "next_run_at": None,
    }


def _reconciled_managed_job_files(
    plan: dict[str, Any],
    homes: dict[str, list[dict[str, Any]]],
    *,
    enabled: bool,
    stable_enabled_files: dict[Path, bytes] | None = None,
) -> tuple[dict[Path, bytes], tuple[str, ...]]:
    rendered: dict[Path, bytes] = {}
    ambiguities: list[str] = []
    scripts, skills, prompt_tokens = _managed_provenance(plan, homes)
    for home, templates in homes.items():
        profile_home = Path(home)
        path = profile_home / "cron/jobs.json"
        _require_safe_target(path, plan, may_be_missing=True)
        payload, jobs = _load_jobs(path)
        baseline_jobs: list[dict[str, Any]] = []
        if enabled and stable_enabled_files is not None and path in stable_enabled_files:
            _, baseline_jobs = _decode_jobs(stable_enabled_files[path], path)
        rewritten = list(jobs)
        claimed: set[int] = set()
        for template in templates:
            matches = [
                index
                for index, job in enumerate(rewritten)
                if index not in claimed
                and _job_matches_template_provenance(job, template, profile_home)
            ]
            exact = [
                index
                for index in matches
                if rewritten[index].get("name") == template["name"]
                and rewritten[index].get("id") == template["id"]
            ]
            if len(matches) > 1:
                ambiguities.append(template["name"])
            selected = exact[0] if exact else matches[0] if matches else None
            existing = rewritten[selected] if selected is not None else None
            stable_existing = [
                job
                for job in baseline_jobs
                if job.get("name") == template["name"]
                and job.get("id") == template["id"]
                and job.get("enabled") is True
                and job.get("state") == "scheduled"
            ]
            write_existing = (
                stable_existing[0]
                if enabled
                and len(stable_existing) == 1
                and existing is not None
                and existing.get("name") == template["name"]
                and existing.get("id") == template["id"]
                else existing
            )
            updated = _job_for_write(template, write_existing, enabled, not enabled)
            if not enabled:
                updated = _quiesced_job(updated, "managed-target-quiesce")
            if selected is not None:
                rewritten[selected] = updated
                claimed.add(selected)
            else:
                rewritten.append(updated)
                claimed.add(len(rewritten) - 1)
        all_templates = [template for values in homes.values() for template in values]
        for index, job in enumerate(rewritten):
            if index in claimed:
                continue
            if _job_consumes_managed_target(
                job, profile_home, all_templates, scripts, skills, prompt_tokens
            ):
                rewritten[index] = _quiesced_job(
                    job, "duplicate-managed-target-consumer"
                )
        if enabled:
            rewritten = [_retire_legacy_gate(job) for job in rewritten]
        updated = rewritten if isinstance(payload, list) else {**payload, "jobs": rewritten}
        rendered[path] = _serialize(updated)
    return rendered, tuple(sorted(set(ambiguities)))


def _disabled_managed_job_files(
    plan: dict[str, Any], homes: dict[str, list[dict[str, Any]]]
) -> dict[Path, bytes]:
    return _reconciled_managed_job_files(plan, homes, enabled=False)[0]


def _enabled_managed_job_files(
    plan: dict[str, Any], homes: dict[str, list[dict[str, Any]]]
) -> dict[Path, bytes]:
    return _reconciled_managed_job_files(plan, homes, enabled=True)[0]


def _disable_and_verify_all_managed_jobs(
    plan: dict[str, Any], homes: dict[str, list[dict[str, Any]]]
) -> None:
    rendered = _disabled_managed_job_files(plan, homes)
    for path, content in rendered.items():
        _atomic_write(path, content, 0o600)
    _verify_managed_job_state(
        plan, homes, expected_enabled=False, require_present=True
    )


def _verify_managed_job_state(
    plan: dict[str, Any],
    homes: dict[str, list[dict[str, Any]]],
    *,
    expected_enabled: bool,
    require_present: bool,
) -> None:
    scripts, skills, prompt_tokens = _managed_provenance(plan, homes)
    all_templates = [template for values in homes.values() for template in values]
    for home, templates in homes.items():
        profile_home = Path(home)
        path = profile_home / "cron/jobs.json"
        if not path.exists() and not require_present:
            continue
        _, jobs = _load_jobs(path)
        active_indexes: set[int] = set()
        for template in templates:
            exact = [
                index
                for index, job in enumerate(jobs)
                if job.get("name") == template["name"]
                and job.get("id") == template["id"]
            ]
            if require_present and not exact:
                raise InstallError(
                    f"Managed Hermes job identity did not read back exactly: {template['name']}"
                )
            if expected_enabled:
                active = [
                    index
                    for index in exact
                    if jobs[index].get("enabled") is True
                    and jobs[index].get("state") == "scheduled"
                ]
                if require_present and len(active) != 1:
                    raise InstallError(
                        f"Managed Hermes job did not read back as enabled: {template['name']}"
                    )
                active_indexes.update(active)
        for index, job in enumerate(jobs):
            if not _job_consumes_managed_target(
                job, profile_home, all_templates, scripts, skills, prompt_tokens
            ):
                continue
            if expected_enabled and index in active_indexes:
                continue
            if not (
                job.get("enabled") is False
                and job.get("state") == "paused"
                and job.get("next_run_at") is None
            ):
                raise InstallError(
                    "An enabled or unquiesced consumer of a managed Hermes target "
                    f"survived readback: {job.get('name') or job.get('id')}"
                )


def _managed_jobs_require_preflight_quiesce(
    plan: dict[str, Any], homes: dict[str, list[dict[str, Any]]]
) -> bool:
    scripts, skills, prompt_tokens = _managed_provenance(plan, homes)
    templates = [template for values in homes.values() for template in values]
    for home in homes:
        profile_home = Path(home)
        path = profile_home / "cron/jobs.json"
        _require_safe_target(path, plan, may_be_missing=True)
        _, jobs = _load_jobs(path)
        for job in jobs:
            if not _job_consumes_managed_target(
                job,
                profile_home,
                templates,
                scripts,
                skills,
                prompt_tokens,
            ):
                continue
            if not (
                job.get("enabled") is False
                and job.get("state") == "paused"
                and job.get("next_run_at") is None
            ):
                return True
    return False


def _quiesce_managed_jobs_before_preflight(
    plan: dict[str, Any],
    homes: dict[str, list[dict[str, Any]]],
    *,
    operation: str,
) -> None:
    if not _managed_jobs_require_preflight_quiesce(plan, homes):
        return
    _capture_jobs_preflight_backup(plan)
    disabled = _disabled_managed_job_files(plan, homes)
    _execute_jobs_transaction(
        plan,
        homes,
        operation=operation,
        desired=disabled,
        recovery=disabled,
        expected_enabled=False,
    )


def _jobs_transaction_unsigned(
    operation: str, recovery: dict[str, dict[str, Any]]
) -> dict[str, Any]:
    return {
        "schema": JOBS_TRANSACTION_SCHEMA,
        "operation": operation,
        "recovery": recovery,
    }


def _jobs_transaction_recovery_payload(
    plan: dict[str, Any], contents: dict[Path, bytes]
) -> dict[str, dict[str, Any]]:
    paths = {
        "primary": Path(plan["radulator_home"]) / "cron/jobs.json",
        "verification": Path(plan["default_home"]) / "cron/jobs.json",
    }
    if set(contents) != set(paths.values()):
        raise InstallError("Hermes jobs transaction must bind both exact profile files.")
    return {
        profile: {
            "content_base64": base64.b64encode(contents[path]).decode("ascii"),
            "sha256": hashlib.sha256(contents[path]).hexdigest(),
        }
        for profile, path in paths.items()
    }


def _begin_jobs_transaction(
    plan: dict[str, Any], operation: str, recovery_contents: dict[Path, bytes]
) -> None:
    if operation not in {"install-quiesce", "install-enable", "restore"}:
        raise InstallError("Hermes jobs transaction operation is invalid.")
    path = _jobs_transaction_path(plan)
    _require_safe_target(path, plan, may_be_missing=True)
    if path.exists():
        raise InstallError("UNSAFE_JOB_STATE: an unfinished Hermes jobs transaction already exists.")
    recovery = _jobs_transaction_recovery_payload(plan, recovery_contents)
    unsigned = _jobs_transaction_unsigned(operation, recovery)
    key = _read_or_create_jobs_transaction_key(plan, create=True)
    payload = {
        **unsigned,
        "hmac_sha256": hmac.new(
            key, _serialize(unsigned), hashlib.sha256
        ).hexdigest(),
    }
    _atomic_write(path, _serialize(payload), 0o600)
    _require_protected_file(path, "Hermes jobs transaction journal")


def _load_jobs_transaction(plan: dict[str, Any]) -> dict[Path, bytes]:
    path = _jobs_transaction_path(plan)
    _require_safe_target(path, plan, may_be_missing=False)
    _require_protected_file(path, "Hermes jobs transaction journal")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise InstallError("Hermes jobs transaction journal is unreadable.") from error
    if (
        not isinstance(payload, dict)
        or set(payload) != {"schema", "operation", "recovery", "hmac_sha256"}
        or payload.get("schema") != JOBS_TRANSACTION_SCHEMA
        or payload.get("operation")
        not in {"install-quiesce", "install-enable", "restore"}
        or not isinstance(payload.get("recovery"), dict)
        or set(payload["recovery"]) != {"primary", "verification"}
    ):
        raise InstallError("Hermes jobs transaction journal schema is invalid.")
    unsigned = _jobs_transaction_unsigned(payload["operation"], payload["recovery"])
    signature = payload.get("hmac_sha256")
    key = _read_or_create_jobs_transaction_key(plan, create=False)
    expected_signature = hmac.new(
        key, _serialize(unsigned), hashlib.sha256
    ).hexdigest()
    if not isinstance(signature, str) or not hmac.compare_digest(
        signature, expected_signature
    ):
        raise InstallError("Hermes jobs transaction journal authentication failed.")
    paths = {
        "primary": Path(plan["radulator_home"]) / "cron/jobs.json",
        "verification": Path(plan["default_home"]) / "cron/jobs.json",
    }
    decoded: dict[Path, bytes] = {}
    for profile, destination in paths.items():
        entry = payload["recovery"][profile]
        if not isinstance(entry, dict) or set(entry) != {"content_base64", "sha256"}:
            raise InstallError("Hermes jobs transaction recovery entry is invalid.")
        encoded = entry.get("content_base64")
        digest = entry.get("sha256")
        if not isinstance(encoded, str) or not isinstance(digest, str):
            raise InstallError("Hermes jobs transaction recovery entry is invalid.")
        try:
            content = base64.b64decode(encoded, validate=True)
        except (ValueError, binascii.Error) as error:
            raise InstallError("Hermes jobs transaction recovery content is invalid.") from error
        if not re.fullmatch(r"[0-9a-f]{64}", digest) or not hmac.compare_digest(
            digest, hashlib.sha256(content).hexdigest()
        ):
            raise InstallError("Hermes jobs transaction recovery digest is invalid.")
        decoded[destination] = content
    return decoded


def _finish_jobs_transaction(plan: dict[str, Any]) -> None:
    path = _jobs_transaction_path(plan)
    _require_safe_target(path, plan, may_be_missing=False)
    path.unlink()
    descriptor = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def _write_and_verify_job_files(contents: dict[Path, bytes]) -> None:
    for path, content in contents.items():
        _atomic_write(path, content, 0o600)
    for path, content in contents.items():
        details = path.lstat()
        if (
            not stat.S_ISREG(details.st_mode)
            or details.st_uid != os.getuid()
            or stat.S_IMODE(details.st_mode) != 0o600
            or path.read_bytes() != content
        ):
            raise InstallError(f"Hermes jobs transaction failed exact readback: {path}")


def _recover_jobs_transaction(
    plan: dict[str, Any], homes: dict[str, list[dict[str, Any]]]
) -> bool:
    path = _jobs_transaction_path(plan)
    _require_safe_target(path, plan, may_be_missing=True)
    if not path.exists():
        return False
    try:
        recovery = _load_jobs_transaction(plan)
        _write_and_verify_job_files(recovery)
        _verify_managed_job_state(
            plan, homes, expected_enabled=False, require_present=True
        )
        _finish_jobs_transaction(plan)
    except Exception as error:
        raise InstallError(
            "UNSAFE_JOB_STATE: unfinished Hermes jobs transaction could not be recovered."
        ) from error
    return True


def _execute_jobs_transaction(
    plan: dict[str, Any],
    homes: dict[str, list[dict[str, Any]]],
    *,
    operation: str,
    desired: dict[Path, bytes],
    recovery: dict[Path, bytes],
    expected_enabled: bool,
    keep_journal: bool = False,
) -> None:
    _begin_jobs_transaction(plan, operation, recovery)
    try:
        _write_and_verify_job_files(desired)
        _verify_managed_job_state(
            plan,
            homes,
            expected_enabled=expected_enabled,
            require_present=True,
        )
        if not keep_journal:
            _finish_jobs_transaction(plan)
    except Exception:
        _recover_jobs_transaction(plan, homes)
        raise


def _verify_installed_publisher_assets(plan: dict[str, Any]) -> None:
    for source, destination in _publisher_copies(plan):
        try:
            details = destination.lstat()
        except OSError as error:
            raise InstallError(f"Installed publisher asset is missing: {destination}") from error
        if (
            not stat.S_ISREG(details.st_mode)
            or details.st_uid != os.getuid()
            or stat.S_IMODE(details.st_mode) != 0o700
            or destination.read_bytes() != source.read_bytes()
        ):
            raise InstallError(f"Installed publisher asset failed exact runtime readback: {destination}")


def apply_install(
    *, repo: Path, radulator_home: Path, default_home: Path, enable: bool = False, disable: bool = False,
    expected_public_keys: dict[str, Any] | None = None,
    activation_test_runner=None,
    agent_model: str = MODEL,
    agent_provider: str = PROVIDER,
) -> dict[str, Any]:
    if enable and disable:
        raise InstallError("enable and disable are mutually exclusive.")
    plan = build_plan(
        repo=repo, radulator_home=radulator_home, default_home=default_home,
        agent_model=agent_model, agent_provider=agent_provider,
    )
    with _locked_profile_jobs(plan) as jobs_locks:
        return _apply_install_under_job_locks(
            plan=plan,
            jobs_locks=jobs_locks,
            enable=enable,
            disable=disable,
            expected_public_keys=expected_public_keys,
            activation_test_runner=activation_test_runner,
        )


def _apply_install_under_job_locks(
    *,
    plan: dict[str, Any],
    jobs_locks: _ProfileJobsLock,
    enable: bool,
    disable: bool,
    expected_public_keys: dict[str, Any] | None,
    activation_test_runner: Any,
) -> dict[str, Any]:
    homes = {str(Path(plan["radulator_home"])): [], str(Path(plan["default_home"])): []}
    for template in plan["jobs"]:
        homes[template["_home"]].append(template)
    skill_copies = _skill_copies(plan)
    script_copies = _script_copies(plan)
    publisher_copies = _publisher_copies(plan)
    ordinary_script_copies = [pair for pair in script_copies if pair not in publisher_copies]
    control_manifest = _control_manifest_path(plan)
    _recover_jobs_transaction(plan, homes)
    initial_job_files: dict[Path, bytes] = {}
    for home in homes:
        jobs_path = Path(home) / "cron/jobs.json"
        _require_safe_target(jobs_path, plan, may_be_missing=True)
        initial_job_files[jobs_path] = (
            jobs_path.read_bytes() if jobs_path.exists() else _serialize({"jobs": []})
        )
    publisher_identity_count = _publisher_exact_identity_count(plan)
    _quiesce_managed_jobs_before_preflight(
        plan, homes, operation="install-quiesce"
    )
    publisher_snapshots: dict[Path, tuple[bool, int | None, bytes | None]] | None = None

    try:
        _capture_backup(plan)
        disabled_job_files, job_ambiguities = _reconciled_managed_job_files(
            plan, homes, enabled=False
        )
        # This two-profile transaction must precede every asset/config write.
        # It also replaces any foreign same-name managed identity with the
        # exact disabled template, so plain apply is always disabled-first.
        _execute_jobs_transaction(
            plan,
            homes,
            operation="install-quiesce",
            desired=disabled_job_files,
            recovery=disabled_job_files,
            expected_enabled=False,
        )
        if job_ambiguities:
            raise InstallError(
                "Managed Hermes job provenance is duplicated or ambiguous: "
                + ", ".join(job_ambiguities)
            )
        if enable and publisher_identity_count != 1:
            raise InstallError(
                "Trusted publisher must complete a prior unambiguous disabled-first "
                "install before enablement."
            )
        publisher_snapshots = _publisher_snapshots(plan)
        for source, destination in skill_copies:
            if not source.is_file():
                raise InstallError(f"Required skill source is missing: {source}")
            content = source.read_bytes()
            if not destination.exists() or destination.read_bytes() != content:
                _atomic_write(destination, content, 0o644)

        for source, destination in [*ordinary_script_copies, *publisher_copies]:
            if not source.is_file():
                raise InstallError(f"Required script source is missing: {source}")
            content = source.read_bytes()
            if not destination.exists() or destination.read_bytes() != content or stat.S_IMODE(destination.lstat().st_mode) != 0o700:
                _atomic_write(destination, content, 0o700)

        _verify_installed_publisher_assets(plan)
        if enable:
            # Proof commands can exceed the gateway's bounded lock wait. Run
            # them only after every managed consumer is read back disabled,
            # then reacquire both locks and reconcile current state again.
            with jobs_locks.suspended():
                _verify_activation_trust(plan, expected_public_keys)
                _verify_broker_contract(plan, activation_test_runner)
                _verify_dedicated_publisher_identity(plan)
                _verify_publisher_auth(plan, activation_test_runner)
                _run_activation_self_tests(plan, activation_test_runner)
            disabled_job_files, post_proof_ambiguities = (
                _reconciled_managed_job_files(plan, homes, enabled=False)
            )
            _execute_jobs_transaction(
                plan,
                homes,
                operation="install-quiesce",
                desired=disabled_job_files,
                recovery=disabled_job_files,
                expected_enabled=False,
            )
            if post_proof_ambiguities:
                raise InstallError(
                    "Managed Hermes job provenance changed during activation proofs: "
                    + ", ".join(post_proof_ambiguities)
                )
            _verify_installed_publisher_assets(plan)

        manifest = {
            "schema": SCHEMA,
            "repo": plan["repo"],
            "profiles": {"primary": plan["radulator_home"], "verification": plan["default_home"]},
            "job_ids": {job["name"]: job["id"] for job in plan["jobs"]},
            "inference": plan["inference"],
            "keys": plan["keys"],
            "backup_manifest": str(_backup_path(plan)),
        }
        content = _serialize(manifest)
        if not control_manifest.exists() or control_manifest.read_bytes() != content:
            _atomic_write(control_manifest, content, 0o600)
        _verify_managed_job_state(
            plan, homes, expected_enabled=False, require_present=True
        )
        if enable:
            enabled_job_files, enable_ambiguities = _reconciled_managed_job_files(
                plan,
                homes,
                enabled=True,
                stable_enabled_files=initial_job_files,
            )
            if enable_ambiguities:
                raise InstallError(
                    "Managed Hermes job provenance became duplicated or ambiguous: "
                    + ", ".join(enable_ambiguities)
                )
            # Activation is the final mutation. A process death after either
            # profile write leaves the authenticated recovery journal in place;
            # the next installer invocation restores both profiles disabled.
            _execute_jobs_transaction(
                plan,
                homes,
                operation="install-enable",
                desired=enabled_job_files,
                recovery=disabled_job_files,
                expected_enabled=True,
            )
    except Exception as original_error:
        if not jobs_locks.held:
            raise InstallError(
                "UNSAFE_JOB_STATE: both Hermes jobs locks could not be reacquired "
                "after activation proofs."
            )
        try:
            _read_or_create_backup_key(plan, create=False)
        except Exception:
            # No authenticated job transaction was possible or attempted. An
            # enabled managed consumer would already have forced key creation
            # and durable quiescence before entering this preflight.
            raise original_error
        job_recovery_error: Exception | None = None
        try:
            _recover_jobs_transaction(plan, homes)
            safe_disabled = _disabled_managed_job_files(plan, homes)
            _execute_jobs_transaction(
                plan,
                homes,
                operation="install-quiesce",
                desired=safe_disabled,
                recovery=safe_disabled,
                expected_enabled=False,
            )
        except Exception as recovery_error:
            job_recovery_error = recovery_error
        if publisher_snapshots is not None:
            _restore_publisher_snapshots(plan, publisher_snapshots)
        if job_recovery_error is not None:
            raise InstallError(
                "UNSAFE_JOB_STATE: managed Hermes jobs could not be restored or proven disabled."
            ) from job_recovery_error
        raise
    return {"manifest_path": str(control_manifest), "job_ids": manifest["job_ids"], "mode": "enabled" if enable else "disabled" if disable else "installed"}


def _sanitize_restored_jobs(
    plan: dict[str, Any],
    homes: dict[str, list[dict[str, Any]]],
    content: bytes,
    path: Path,
    *,
    profile: str,
    stable_managed_consumers: frozenset[tuple[str, str]],
) -> bytes:
    try:
        payload = json.loads(content.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise InstallError(f"Restored Hermes jobs.json is invalid: {path}") from error
    if isinstance(payload, list):
        jobs = payload
    elif isinstance(payload, dict) and isinstance(payload.get("jobs"), list):
        jobs = payload["jobs"]
    else:
        raise InstallError(f"Unsupported restored Hermes jobs.json shape: {path}")
    if not all(isinstance(job, dict) for job in jobs):
        raise InstallError(f"Restored Hermes jobs.json contains a non-object job: {path}")

    templates = [template for values in homes.values() for template in values]
    scripts, skills, prompt_tokens = _managed_provenance(plan, homes)
    rewritten: list[dict[str, Any]] = []
    changed = False
    profile_home = path.parent.parent
    for job in jobs:
        was_managed_before_replacement = (
            profile, _stable_job_digest(job)
        ) in stable_managed_consumers
        if not was_managed_before_replacement and not _job_consumes_managed_target(
            job, profile_home, templates, scripts, skills, prompt_tokens
        ):
            rewritten.append(job)
            continue
        disabled = _quiesced_job(job, "restore-disabled-first")
        changed = True
        rewritten.append(disabled)
    if not changed:
        return content
    updated = rewritten if isinstance(payload, list) else {**payload, "jobs": rewritten}
    return _serialize(updated)


def _apply_restored_target(
    target: Path,
    existed: bool,
    mode: int | None,
    content: bytes | None,
) -> None:
    if existed:
        if mode is None or content is None:
            raise InstallError("Validated backup operation is incomplete.")
        _atomic_write(target, content, mode)
        return
    try:
        target.lstat()
    except FileNotFoundError:
        return
    target.unlink()
    descriptor = os.open(target.parent, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def _verify_restored_target(
    target: Path,
    existed: bool,
    mode: int | None,
    content: bytes | None,
) -> None:
    try:
        details = target.lstat()
    except FileNotFoundError:
        if existed:
            raise InstallError(f"Restored target is missing after readback: {target}")
        return
    if not existed:
        raise InstallError(f"Restore left an unexpected managed target: {target}")
    if (
        mode is None
        or content is None
        or not stat.S_ISREG(details.st_mode)
        or details.st_uid != os.getuid()
        or stat.S_IMODE(details.st_mode) != mode
        or target.read_bytes() != content
    ):
        raise InstallError(f"Restored target failed exact readback: {target}")


def restore_install(
    *, repo: Path, radulator_home: Path, default_home: Path,
    agent_model: str = MODEL, agent_provider: str = PROVIDER,
) -> dict[str, Any]:
    plan = build_plan(
        repo=repo,
        radulator_home=radulator_home,
        default_home=default_home,
        agent_model=agent_model,
        agent_provider=agent_provider,
    )
    with _locked_profile_jobs(plan):
        return _restore_install_under_job_locks(plan)


def _restore_install_under_job_locks(plan: dict[str, Any]) -> dict[str, Any]:
    homes = {str(Path(plan["radulator_home"])): [], str(Path(plan["default_home"])): []}
    for template in plan["jobs"]:
        homes[template["_home"]].append(template)
    _recover_jobs_transaction(plan, homes)
    _quiesce_managed_jobs_before_preflight(plan, homes, operation="restore")
    backup_path = _backup_path(plan)
    try:
        backup_path.lstat()
    except FileNotFoundError:
        raise InstallError(f"Backup manifest is missing: {backup_path}")
    backup = _load_backup(plan, migrate_legacy=True)
    stable_managed_consumers = _load_bound_jobs_preflight(
        plan, backup["jobs_preflight"]
    )
    targets = _backup_targets(plan)
    entries = [_validate_backup_entry(entry, legacy=False) for entry in backup["entries"]]
    target_ids = [target_id for target_id, *_ in entries]
    if len(set(target_ids)) != len(target_ids):
        raise InstallError("Backup manifest contains duplicate target ids.")
    unknown = sorted(set(target_ids) - set(targets))
    if unknown:
        raise InstallError(f"Backup manifest contains unknown target ids: {', '.join(unknown)}")
    missing = sorted(set(targets) - set(target_ids))
    if missing:
        raise InstallError(f"Backup manifest is missing managed target ids: {', '.join(missing)}")

    operations: list[tuple[Path, bool, int | None, bytes | None]] = []
    for target_id, existed, mode, content in entries:
        target = targets[target_id]
        _require_safe_target(target, plan, may_be_missing=True)
        if existed and target_id in {
            "primary:cron/jobs.json",
            "verification:cron/jobs.json",
        }:
            if content is None:
                raise InstallError("Validated jobs backup operation is incomplete.")
            content = _sanitize_restored_jobs(
                plan,
                homes,
                content,
                target,
                profile=target_id.split(":", 1)[0],
                stable_managed_consumers=stable_managed_consumers,
            )
        operations.append((target, existed, mode, content))

    safe_disabled = _disabled_managed_job_files(plan, homes)
    restored: list[str] = []
    try:
        # Keep the signed journal until every restored target and both job
        # profiles have been read back. A process death at any point is
        # recovered to the known installed-disabled state on the next run.
        _execute_jobs_transaction(
            plan,
            homes,
            operation="restore",
            desired=safe_disabled,
            recovery=safe_disabled,
            expected_enabled=False,
            keep_journal=True,
        )
        for target, existed, mode, content in operations:
            _apply_restored_target(target, existed, mode, content)
            restored.append(str(target))
        for operation in operations:
            _verify_restored_target(*operation)
        _verify_managed_job_state(
            plan, homes, expected_enabled=False, require_present=False
        )
        _finish_jobs_transaction(plan)
    except Exception:
        try:
            _recover_jobs_transaction(plan, homes)
            _verify_managed_job_state(
                plan, homes, expected_enabled=False, require_present=True
            )
        except Exception as recovery_error:
            raise InstallError(
                "UNSAFE_JOB_STATE: restore could not recover and prove both Hermes profiles disabled."
            ) from recovery_error
        raise
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
    parser.add_argument("--agent-model", default=MODEL, help="Inference model pinned to all managed agent jobs.")
    parser.add_argument("--agent-provider", default=PROVIDER, help="Inference provider pinned to all managed agent jobs.")
    args = parser.parse_args()
    if args.restore:
        if args.repo is None or args.default_home is None:
            parser.error("--repo and --default-home are required for restore")
        print(json.dumps(restore_install(
            repo=args.repo,
            radulator_home=args.radulator_home,
            default_home=args.default_home,
            agent_model=args.agent_model,
            agent_provider=args.agent_provider,
        ), indent=2, sort_keys=True))
        return
    if args.repo is None or args.default_home is None:
        parser.error("--repo and --default-home are required for dry-run/apply")
    plan = build_plan(
        repo=args.repo, radulator_home=args.radulator_home, default_home=args.default_home,
        agent_model=args.agent_model, agent_provider=args.agent_provider,
    )
    if args.dry_run:
        sanitized = {**plan, "jobs": [{key: value for key, value in job.items() if not key.startswith("_")} for job in plan["jobs"]]}
        print(json.dumps(sanitized, indent=2, sort_keys=True))
        return
    expected_public_keys = read_github_public_keys(args.github_repository) if args.enable else None
    result = apply_install(
        repo=args.repo, radulator_home=args.radulator_home, default_home=args.default_home,
        enable=args.enable, disable=args.disable, expected_public_keys=expected_public_keys,
        agent_model=args.agent_model, agent_provider=args.agent_provider,
    )
    if args.generate_keys:
        result["public_keys"] = generate_keys(plan)
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
