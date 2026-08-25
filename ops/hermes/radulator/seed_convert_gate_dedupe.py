#!/usr/bin/env python3
"""Classify Radulator seed issues for the bounded WF-2b conversion cron.

Stage-1 research briefs are approved research-only work. They remain actionable
even when an old ``medical-review-pending`` label is present; clinical safety is
enforced later by independent source review and the exact-head release gate.
Other medically gated seeds are emitted once and then suppressed until their
state or labels change.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import tempfile
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPO = os.environ.get("RADULATOR_REPO", "momomojo/Radulator")
API = f"https://api.github.com/repos/{REPO}"
TIMEOUT = int(os.environ.get("RADULATOR_SEED_DEDUPE_TIMEOUT", "30"))
PROFILE_DIR = Path(
    os.environ.get("HERMES_HOME")
    or os.environ.get("HERMES_PROFILE_DIR")
    or Path.home() / ".hermes" / "profiles" / "radulator"
)
STATE_FILE = PROFILE_DIR / "state" / "radulator-seed-convert-gate-alerts.json"
MEDICAL_GATE_LABEL = os.environ.get("RADULATOR_MEDICAL_GATE_LABEL", "medical-review-pending")
SEED_LABEL = os.environ.get("RADULATOR_SEED_LABEL", "seed")
FLASH_LANE_LABEL = os.environ.get("RADULATOR_FLASH_LANE_LABEL", "lane:flash")
UA = {"User-Agent": "radulator-seed-convert-gate-dedupe/2.0 (+local cron preflight)"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def gh_token() -> str:
    token = (os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN") or "").strip()
    if token:
        return token
    env_file = PROFILE_DIR / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8", errors="ignore").splitlines():
            if line.startswith("GH_TOKEN=") or line.startswith("GITHUB_TOKEN="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def gh_json(path: str) -> Any:
    url = path if path.startswith("http") else API + path
    headers = {**UA, "Accept": "application/vnd.github+json"}
    token = gh_token()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return json.loads(response.read().decode("utf-8"))


def load_state() -> dict[str, Any]:
    try:
        state = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        state = {}
    state["version"] = 2
    state.setdefault("medical_gate_alerts", {})
    state.setdefault("cleared_gate_alerts", {})
    return state


def save_state(state: dict[str, Any]) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    state["updated_at"] = utc_now()
    cleared = state.get("cleared_gate_alerts", {})
    if isinstance(cleared, dict) and len(cleared) > 200:
        keep = sorted(cleared.items(), key=lambda pair: pair[1].get("cleared_at", ""))[-200:]
        state["cleared_gate_alerts"] = dict(keep)
    payload = (json.dumps(state, indent=2, sort_keys=True) + "\n").encode("utf-8")
    descriptor, temporary_name = tempfile.mkstemp(prefix=".seed-state-", dir=STATE_FILE.parent)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary_name, 0o600)
        os.replace(temporary_name, STATE_FILE)
    finally:
        if os.path.exists(temporary_name):
            os.unlink(temporary_name)


def label_names(issue: dict[str, Any]) -> list[str]:
    labels: list[str] = []
    for item in issue.get("labels") or []:
        if isinstance(item, str):
            labels.append(item)
        elif isinstance(item, dict) and item.get("name"):
            labels.append(str(item["name"]))
    return sorted(set(labels), key=str.casefold)


def is_stage_one_research_brief(issue: dict[str, Any]) -> bool:
    labels = label_names(issue)
    title = " ".join(str(issue.get("title") or "").split()).casefold()
    return FLASH_LANE_LABEL in labels and title.startswith("[seed] research brief:")


def fingerprint_payload(issue: dict[str, Any]) -> dict[str, Any]:
    return {
        "issue": issue.get("number"),
        "state": str(issue.get("state", "")).lower(),
        "labels": label_names(issue),
    }


def issue_fingerprint(issue: dict[str, Any]) -> str:
    payload = json.dumps(fingerprint_payload(issue), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def issue_summary(issue: dict[str, Any]) -> dict[str, Any]:
    return {
        "number": issue.get("number"),
        "title": issue.get("title"),
        "url": issue.get("html_url") or issue.get("url"),
        "state": str(issue.get("state", "")).lower(),
        "labels": label_names(issue),
        "created_at": issue.get("created_at"),
        "updated_at": issue.get("updated_at"),
        "fingerprint": issue_fingerprint(issue),
    }


def open_seed_issues() -> list[dict[str, Any]]:
    query = urllib.parse.urlencode({
        "state": "open",
        "labels": SEED_LABEL,
        "sort": "created",
        "direction": "asc",
        "per_page": "100",
    })
    issues = gh_json(f"/issues?{query}")
    return [issue for issue in issues if not issue.get("pull_request")]


def record_gate(
    state: dict[str, Any],
    issue: dict[str, Any],
    *,
    reason: str,
    source: str,
    now: str,
) -> dict[str, Any]:
    key = str(issue.get("number"))
    previous = state.get("medical_gate_alerts", {}).get(key)
    record = {
        **issue_summary(issue),
        "fingerprint_payload": fingerprint_payload(issue),
        "last_recorded_at": now,
        "last_notified_at": now,
        "reason": reason,
        "source": source,
        "previous_fingerprint": (previous or {}).get("fingerprint"),
        "previous_labels": (previous or {}).get("labels"),
        "previous_state": (previous or {}).get("state"),
    }
    state["medical_gate_alerts"][key] = record
    return record


def _clear_previous_gate(
    state: dict[str, Any],
    key: str,
    summary: dict[str, Any],
    now: str,
    reason: str,
) -> dict[str, Any] | None:
    previous = state.get("medical_gate_alerts", {}).pop(key, None)
    if not previous:
        return None
    cleared = {
        **previous,
        "cleared_at": now,
        "cleared_to": summary,
        "clear_reason": reason,
    }
    state.setdefault("cleared_gate_alerts", {})[key] = cleared
    return cleared


def preflight(*, dry_run: bool = False) -> dict[str, Any]:
    now = utc_now()
    state = load_state()
    suppressed: list[dict[str, Any]] = []
    changed: list[dict[str, Any]] = []
    actionable: list[dict[str, Any]] = []
    cleared: list[dict[str, Any]] = []

    for issue in open_seed_issues():
        key = str(issue.get("number"))
        labels = label_names(issue)
        fingerprint = issue_fingerprint(issue)
        previous = state.get("medical_gate_alerts", {}).get(key)
        summary = issue_summary(issue)

        if MEDICAL_GATE_LABEL in labels and is_stage_one_research_brief(issue):
            actionable.append({**summary, "gate_override": "stage_1_research_only"})
            if not dry_run:
                _clear_previous_gate(state, key, summary, now, "stage_1_research_override")
            continue

        if MEDICAL_GATE_LABEL in labels:
            if previous and previous.get("fingerprint") == fingerprint:
                suppressed.append(summary)
            else:
                changed_item = {
                    **summary,
                    "change_kind": "first_seen_gate" if not previous else "state_or_label_changed",
                    "previous_fingerprint": (previous or {}).get("fingerprint"),
                    "previous_labels": (previous or {}).get("labels"),
                    "previous_state": (previous or {}).get("state"),
                }
                changed.append(changed_item)
                if not dry_run:
                    record_gate(
                        state,
                        issue,
                        reason=changed_item["change_kind"],
                        source="preflight",
                        now=now,
                    )
            continue

        if previous:
            cleared_item = {
                **summary,
                "change_kind": "gate_label_removed_or_state_changed",
                "previous_fingerprint": previous.get("fingerprint"),
                "previous_labels": previous.get("labels"),
                "previous_state": previous.get("state"),
            }
            cleared.append(cleared_item)
            if not dry_run:
                _clear_previous_gate(state, key, summary, now, "gate_label_removed_or_state_changed")

        actionable.append(summary)

    if not dry_run:
        save_state(state)

    decision = "ACTION_REQUIRED" if (changed or actionable or cleared) else "NO_ACTION_SILENT"
    return {
        "ok": True,
        "repo": REPO,
        "state_path": str(STATE_FILE),
        "medical_gate_label": MEDICAL_GATE_LABEL,
        "seed_label": SEED_LABEL,
        "decision": decision,
        "gated_state_changes": changed,
        "cleared_gate_changes": cleared,
        "actionable_seed_issues": actionable,
        "suppressed_gated_issues": suppressed,
    }


def record_issue(number: int, *, reason: str, dry_run: bool = False) -> dict[str, Any]:
    issue = gh_json(f"/issues/{number}")
    if MEDICAL_GATE_LABEL not in label_names(issue):
        raise SystemExit(
            f"issue #{number} does not currently have label {MEDICAL_GATE_LABEL!r}; "
            "add the gate label before recording the alert fingerprint"
        )
    now = utc_now()
    state = load_state()
    record = record_gate(state, issue, reason=reason, source="record-issue", now=now)
    if not dry_run:
        save_state(state)
    return {"ok": True, "recorded": record, "state_path": str(STATE_FILE), "dry_run": dry_run}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--record-issue", type=int)
    parser.add_argument("--reason", default="medical gate alert sent")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    try:
        if args.record_issue is not None:
            result = record_issue(args.record_issue, reason=args.reason, dry_run=args.dry_run)
        else:
            result = preflight(dry_run=args.dry_run)
    except Exception as error:  # noqa: BLE001 - scheduled preflight must explain failure compactly
        result = {
            "ok": False,
            "decision": "PREFLIGHT_FAILED_AGENT_SHOULD_FALL_BACK_TO_WF2B",
            "error": f"{type(error).__name__}: {error}",
            "state_path": str(STATE_FILE),
        }
        print("SEED_CONVERT_PREFLIGHT_JSON")
        print(json.dumps(result, indent=2, sort_keys=True))
        return 1
    print("SEED_CONVERT_PREFLIGHT_JSON")
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
