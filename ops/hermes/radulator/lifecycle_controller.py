#!/usr/bin/env python3
"""Tamper-evident, replayable lifecycle state for Radulator release work."""

from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import fcntl
import hashlib
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any


SCHEMA = "radulator-lifecycle-event/v1"
CURSOR_SCHEMA = "radulator-lifecycle-cursor/v1"
CANDIDATE_SCHEMA = "radulator-lifecycle-candidate/v1"
ZERO_HASH = "0" * 64
SHA_PATTERN = re.compile(r"^[0-9a-f]{40}$")

TRANSITIONS = {
    None: {"feedback"},
    "feedback": {"implementing", "blocked"},
    "implementing": {"testing", "needs_fix", "blocked"},
    "testing": {"review", "needs_fix", "blocked"},
    "review": {"approved", "needs_fix", "blocked"},
    "needs_fix": {"implementing", "blocked"},
    "approved": {"merged_develop", "merged_main", "blocked"},
    "merged_develop": {"promotion", "blocked"},
    "promotion": {"review", "merged_main", "needs_fix", "blocked"},
    "merged_main": {"deploying", "blocked"},
    "deploying": {"deployed", "blocked"},
    "deployed": {"smoke_passed", "needs_fix", "blocked"},
    "smoke_passed": {"learned", "blocked"},
    "learned": {"complete", "blocked"},
    "complete": set(),
    "blocked": set(),
}
RESUMABLE_STATES = frozenset(
    state for state, destinations in TRANSITIONS.items()
    if state is not None and "blocked" in destinations
)
TRANSITIONS["blocked"] = set(RESUMABLE_STATES)


class LedgerError(RuntimeError):
    pass


def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _event_hash(payload: dict[str, Any]) -> str:
    return hashlib.sha256(_canonical(payload).encode("utf-8")).hexdigest()


def _timestamp() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


@dataclasses.dataclass(frozen=True)
class LifecycleEvent:
    schema: str
    idempotency_key: str
    previous_hash: str
    event_hash: str
    source_id: str
    task_id: str
    pr: int | None
    head_sha: str | None
    state: str
    evidence: dict[str, Any]
    timestamp: str

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> "LifecycleEvent":
        try:
            return cls(**value)
        except TypeError as error:
            raise LedgerError(f"Malformed lifecycle event: {error}") from error

    def as_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


@dataclasses.dataclass(frozen=True)
class ReplayState:
    events: tuple[LifecycleEvent, ...]
    current_by_task: dict[str, LifecycleEvent]
    by_idempotency_key: dict[str, LifecycleEvent]
    blocked_resume_by_task: dict[str, str]


def _validate_transition(
    previous: LifecycleEvent | None,
    event: LifecycleEvent,
    *,
    blocked_resume_state: str | None = None,
) -> None:
    previous_state = previous.state if previous else None
    transition_origin = previous_state
    if previous_state == "blocked" and event.state != blocked_resume_state:
        is_legacy_block = previous is not None and "resume_state" not in previous.evidence
        if not is_legacy_block:
            raise LedgerError(
                f"Blocked lifecycle must resume at retained {blocked_resume_state!r} phase, not {event.state!r}."
            )
        transition_origin = blocked_resume_state
    if event.state not in TRANSITIONS.get(transition_origin, set()):
        raise LedgerError(f"Invalid lifecycle transition {transition_origin!r} -> {event.state!r}.")
    if previous and previous.source_id != event.source_id:
        raise LedgerError("A task source_id cannot change during replay.")
    if event.state == "implementing" and transition_origin in {"needs_fix", "blocked"}:
        if not event.evidence.get("prerequisite_change_id"):
            raise LedgerError("Requeue transition requires prerequisite_change_id evidence.")
    if transition_origin == "needs_fix" and event.state == "implementing":
        if not previous.head_sha or not event.head_sha or event.head_sha == previous.head_sha:
            raise LedgerError("NEEDS_FIX requeue requires a new exact head SHA with the correction.")


def _semantic_payload(event: LifecycleEvent) -> dict[str, Any]:
    value = event.as_dict()
    for key in ("previous_hash", "event_hash", "timestamp"):
        value.pop(key)
    return value


class LifecycleLedger:
    def __init__(self, path: str | Path):
        self.path = Path(path)

    def replay(self, handle=None) -> ReplayState:
        if handle is None and not self.path.exists():
            return ReplayState((), {}, {}, {})
        if handle is None:
            with self.path.open("r", encoding="utf-8") as reader:
                fcntl.flock(reader.fileno(), fcntl.LOCK_SH)
                return self.replay(reader)

        handle.seek(0)
        events: list[LifecycleEvent] = []
        current: dict[str, LifecycleEvent] = {}
        idempotency: dict[str, LifecycleEvent] = {}
        blocked_resume: dict[str, str] = {}
        expected_previous = ZERO_HASH
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                raise LedgerError(f"Blank lifecycle record at line {line_number}.")
            try:
                raw = json.loads(line)
            except json.JSONDecodeError as error:
                raise LedgerError(f"Malformed JSON at line {line_number}.") from error
            event = LifecycleEvent.from_dict(raw)
            if event.schema != SCHEMA:
                raise LedgerError(f"Unsupported lifecycle schema at line {line_number}.")
            if event.previous_hash != expected_previous:
                raise LedgerError(f"Broken previous hash at line {line_number}.")
            unhashed = event.as_dict()
            recorded_hash = unhashed.pop("event_hash")
            if _event_hash(unhashed) != recorded_hash:
                raise LedgerError(f"Invalid event hash at line {line_number}.")
            if event.idempotency_key in idempotency:
                raise LedgerError(f"Duplicate idempotency key at line {line_number}.")
            previous = current.get(event.task_id)
            resume_state = blocked_resume.get(event.task_id) if previous and previous.state == "blocked" else None
            _validate_transition(previous, event, blocked_resume_state=resume_state)
            if event.state == "blocked":
                retained_state = event.evidence.get("resume_state", previous.state if previous else None)
                if retained_state not in RESUMABLE_STATES or not previous or retained_state != previous.state:
                    raise LedgerError("Blocked lifecycle resume_state must retain the exact prior resumable phase.")
                blocked_resume[event.task_id] = retained_state
            else:
                blocked_resume.pop(event.task_id, None)
            events.append(event)
            current[event.task_id] = event
            idempotency[event.idempotency_key] = event
            expected_previous = event.event_hash
        return ReplayState(tuple(events), current, idempotency, blocked_resume)

    def append(
        self,
        *,
        idempotency_key: str,
        source_id: str,
        task_id: str,
        state: str,
        evidence: dict[str, Any] | None = None,
        pr: int | None = None,
        head_sha: str | None = None,
        timestamp: str | None = None,
    ) -> LifecycleEvent:
        if not all(isinstance(value, str) and value.strip() for value in (idempotency_key, source_id, task_id)):
            raise LedgerError("idempotency_key, source_id, and task_id are required.")
        if state not in TRANSITIONS:
            raise LedgerError(f"Unknown lifecycle state {state!r}.")
        if pr is not None and (not isinstance(pr, int) or pr <= 0):
            raise LedgerError("pr must be a positive integer when present.")
        if head_sha is not None and not SHA_PATTERN.fullmatch(head_sha):
            raise LedgerError("head_sha must be a lowercase 40-character Git SHA.")
        if evidence is None:
            evidence = {}
        if not isinstance(evidence, dict):
            raise LedgerError("evidence must be an object.")
        self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        descriptor = os.open(self.path, os.O_RDWR | os.O_CREAT, 0o600)
        os.chmod(self.path, 0o600)
        with os.fdopen(descriptor, "r+", encoding="utf-8") as handle:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
            replay = self.replay(handle)
            previous = replay.current_by_task.get(task_id)
            existing = replay.by_idempotency_key.get(idempotency_key)
            serialized_evidence = json.loads(_canonical(evidence))
            if state == "blocked" and existing:
                retained_state = existing.evidence.get("resume_state")
                supplied_resume = serialized_evidence.get("resume_state")
                if supplied_resume is not None and supplied_resume != retained_state:
                    raise LedgerError("Blocked lifecycle resume_state conflicts with the existing idempotent event.")
                if retained_state is not None:
                    serialized_evidence["resume_state"] = retained_state
            elif state == "blocked" and previous:
                supplied_resume = serialized_evidence.get("resume_state")
                if supplied_resume is not None and supplied_resume != previous.state:
                    raise LedgerError("Blocked lifecycle resume_state must retain the exact prior resumable phase.")
                serialized_evidence["resume_state"] = previous.state
            proposed = LifecycleEvent(
                schema=SCHEMA,
                idempotency_key=idempotency_key,
                previous_hash=replay.events[-1].event_hash if replay.events else ZERO_HASH,
                event_hash="",
                source_id=source_id,
                task_id=task_id,
                pr=pr,
                head_sha=head_sha,
                state=state,
                evidence=serialized_evidence,
                timestamp=timestamp or _timestamp(),
            )
            if existing:
                if _semantic_payload(existing) != _semantic_payload(proposed):
                    raise LedgerError(f"Conflicting event for idempotency key {idempotency_key!r}.")
                return existing
            _validate_transition(
                previous,
                proposed,
                blocked_resume_state=replay.blocked_resume_by_task.get(task_id),
            )
            unhashed = proposed.as_dict()
            unhashed.pop("event_hash")
            proposed = dataclasses.replace(proposed, event_hash=_event_hash(unhashed))
            handle.seek(0, os.SEEK_END)
            handle.write(_canonical(proposed.as_dict()) + "\n")
            handle.flush()
            os.fsync(handle.fileno())
            return proposed


def _read_cursor_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"schema": CURSOR_SCHEMA, "positions": {}}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise LedgerError(f"Lifecycle cursor state is unreadable: {error}") from error
    positions = value.get("positions") if isinstance(value, dict) else None
    if (
        not isinstance(value, dict)
        or value.get("schema") != CURSOR_SCHEMA
        or not isinstance(positions, dict)
        or any(not isinstance(key, str) or not isinstance(task_id, str) for key, task_id in positions.items())
    ):
        raise LedgerError("Lifecycle cursor state is malformed or unsupported.")
    return value


def _write_cursor_state(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(_canonical(value) + "\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
        os.chmod(path, 0o600)
        directory = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        temporary.unlink(missing_ok=True)


def select_next_candidate(
    ledger: LifecycleLedger,
    cursor_state: str | Path,
    *,
    required_state: str | None = None,
) -> dict[str, Any]:
    """Select exactly one active tracker with durable per-filter round-robin fairness."""
    if required_state is not None and required_state not in TRANSITIONS:
        raise LedgerError(f"Unknown lifecycle state filter {required_state!r}.")
    cursor_path = Path(cursor_state)
    cursor_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    lock_path = Path(f"{cursor_path}.lock")
    descriptor = os.open(lock_path, os.O_RDWR | os.O_CREAT, 0o600)
    os.chmod(lock_path, 0o600)
    with os.fdopen(descriptor, "r+", encoding="utf-8") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        cursor = _read_cursor_state(cursor_path)
        replay = ledger.replay()
        eligible = sorted(
            (
                event for event in replay.current_by_task.values()
                if event.state != "complete" and (required_state is None or event.state == required_state)
            ),
            key=lambda event: (event.timestamp, event.task_id),
        )
        position_key = f"state:{required_state}" if required_state else "all"
        selected = None
        if eligible:
            last_task_id = cursor["positions"].get(position_key)
            task_ids = [event.task_id for event in eligible]
            selected_index = (task_ids.index(last_task_id) + 1) % len(eligible) if last_task_id in task_ids else 0
            selected = eligible[selected_index]
            cursor["positions"][position_key] = selected.task_id
        _write_cursor_state(cursor_path, cursor)

    candidate = None if selected is None else {
        "task_id": selected.task_id,
        "source_id": selected.source_id,
        "state": selected.state,
        "pr": selected.pr,
        "head_sha": selected.head_sha,
        "event_hash": selected.event_hash,
        "timestamp": selected.timestamp,
    }
    return {
        "schema": CANDIDATE_SCHEMA,
        "count": 1 if candidate else 0,
        "filter_state": required_state,
        "candidate": candidate,
    }


def actions_for_event(event: LifecycleEvent) -> list[dict[str, Any]]:
    """Return deterministic Kanban actions; the caller performs and reads them back."""
    if event.state == "needs_fix":
        verdict_id = str(event.evidence.get("verdict_id", "")).strip()
        reason = str(event.evidence.get("reason", "")).strip()
        if not verdict_id or not reason or not event.pr or not event.head_sha:
            raise LedgerError("needs_fix actions require verdict_id, reason, PR, and exact head SHA.")
        action_key = f"radulator-rework:{event.task_id}:{verdict_id}"
        return [
            {
                "kind": "create_child",
                "idempotency_key": action_key,
                "parent_task_id": event.task_id,
                "title": f"Rework Radulator PR #{event.pr} after clinical verdict",
                "body": (
                    f"Rework exact PR #{event.pr} at {event.head_sha}. "
                    f"Judge verdict {verdict_id}: {reason} Push a corrected commit to the same PR and rerun exact-head tests."
                ),
                "pr": event.pr,
                "head_sha": event.head_sha,
                "verdict_id": verdict_id,
                "assignee": "codex-coding",
                "priority": 90,
                "max_runtime": "45m",
                "created_by": "radulator-lifecycle",
            },
            {
                "kind": "comment",
                "idempotency_key": f"{action_key}:parent-comment",
                "task_id": event.task_id,
                "body": f"Clinical judge returned NEEDS_FIX ({verdict_id}); deterministic rework queued for PR #{event.pr} at {event.head_sha}.",
            },
        ]
    if event.state == "smoke_passed":
        return [{
            "kind": "create_child",
            "idempotency_key": f"radulator-learn:{event.task_id}:{event.head_sha}",
            "parent_task_id": event.task_id,
            "title": "Retain verified learning for a Radulator release",
            "body": (
                f"Use the radulator-release-learning skill for parent task {event.task_id} "
                f"and exact released SHA {event.head_sha}."
            ),
            "head_sha": event.head_sha,
            "workflow": "release_learning",
            "assignee": "radulator",
        }]
    if event.state == "learned":
        return [{
            "kind": "complete",
            "idempotency_key": f"radulator-complete:{event.task_id}:{event.head_sha}",
            "task_id": event.task_id,
            "result": "released",
            "summary": f"Released {event.head_sha}; production smoke passed and learning retention was verified.",
        }]
    return []


def release_tracker_action(parent_task_id: str, pr: int, head_sha: str) -> dict[str, Any]:
    if not parent_task_id or not isinstance(pr, int) or pr <= 0 or not SHA_PATTERN.fullmatch(head_sha or ""):
        raise LedgerError("Release tracker requires parent task id, PR number, and exact head SHA.")
    return {
        "kind": "create_child",
        "idempotency_key": f"radulator-release:{parent_task_id}:pr-{pr}",
        "parent_task_id": parent_task_id,
        "title": f"Track clinical release of Radulator PR #{pr}",
        "body": (
            f"Own the autonomous clinical release lifecycle for PR #{pr}, beginning at exact head {head_sha}. "
            "Keep this task open through judge approval, merge, deployment smoke, and retained learning."
        ),
        "pr": pr,
        "head_sha": head_sha,
        "workflow": "release_tracking",
    }


def _find_task_id(value: Any) -> str | None:
    if isinstance(value, dict):
        for key in ("task_id", "id"):
            candidate = value.get(key)
            if isinstance(candidate, str) and candidate.startswith("t_"):
                return candidate
        for nested in value.values():
            found = _find_task_id(nested)
            if found:
                return found
    if isinstance(value, list):
        for nested in value:
            found = _find_task_id(nested)
            if found:
                return found
    return None


def _task_records(value: Any, task_id: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    if isinstance(value, dict):
        if task_id in (value.get("task_id"), value.get("id")):
            records.append(value)
        for nested in value.values():
            records.extend(_task_records(nested, task_id))
    elif isinstance(value, list):
        for nested in value:
            records.extend(_task_records(nested, task_id))
    return records


def _terminal_status(value: Any, task_id: str) -> str | None:
    records = _task_records(value, task_id)
    if not records:
        return None
    statuses: list[str] = []
    for record in records:
        status = next((
            str(record.get(key, "")).lower()
            for key in ("status", "state")
            if str(record.get(key, "")).lower() in {"complete", "completed", "done", "archived"}
        ), None)
        if status is None:
            return None
        statuses.append(status)
    return statuses[0] if len(set(statuses)) == 1 else None


def _has_completed_status(value: Any, task_id: str) -> bool:
    return _terminal_status(value, task_id) is not None


class HermesKanbanCLI:
    """Small verified adapter over the installed `hermes kanban` interface."""

    def __init__(self, executable: str = "hermes", runner=None):
        self.executable = executable
        self.runner = runner or self._default_runner

    @staticmethod
    def _default_runner(command: list[str]):
        return subprocess.run(command, check=False, capture_output=True, text=True)

    def _run(self, arguments: list[str], expect_json: bool = False) -> Any:
        result = self.runner([self.executable, "kanban", *arguments])
        if result.returncode != 0:
            message = (result.stderr or result.stdout or "unknown Hermes Kanban error").strip()
            raise LedgerError(f"Hermes Kanban command failed: {message}")
        if not expect_json:
            return (result.stdout or "").strip()
        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError as error:
            raise LedgerError("Hermes Kanban command did not return valid JSON.") from error

    def show(self, task_id: str) -> dict[str, Any]:
        result = self._run(["show", task_id, "--json"], expect_json=True)
        if not _task_records(result, task_id):
            raise LedgerError(f"Kanban readback did not identify task {task_id}.")
        return result

    def perform(self, action: dict[str, Any]) -> dict[str, Any]:
        kind = action.get("kind")
        if kind == "create_child":
            arguments = [
                "create",
                action["title"],
                "--body",
                action["body"],
                "--parent",
                action["parent_task_id"],
                "--idempotency-key",
                action["idempotency_key"],
            ]
            for key, option in (
                ("assignee", "--assignee"),
                ("priority", "--priority"),
                ("max_runtime", "--max-runtime"),
                ("created_by", "--created-by"),
            ):
                if action.get(key) is not None:
                    arguments.extend([option, str(action[key])])
            arguments.append("--json")
            created = self._run(arguments, expect_json=True)
            child_id = _find_task_id(created)
            if not child_id:
                raise LedgerError("Kanban create response did not contain a child task id.")
            readback = self.show(child_id)
            serialized = _canonical(readback)
            if action["body"] not in serialized:
                self._run(["comment", child_id, action["body"], "--author", "radulator-lifecycle"])
                readback = self.show(child_id)
                serialized = _canonical(readback)
            if action.get("assignee") and action["assignee"] not in serialized:
                self._run(["assign", child_id, action["assignee"]])
                readback = self.show(child_id)
                serialized = _canonical(readback)
            if action["parent_task_id"] not in serialized or action["head_sha"] not in serialized:
                raise LedgerError("Created child failed exact parent/SHA Kanban readback.")
            if action.get("assignee") and action["assignee"] not in serialized:
                raise LedgerError("Created child failed assignee Kanban readback.")
            return {"kind": kind, "task_id": child_id, "idempotency_key": action["idempotency_key"]}
        if kind == "comment":
            readback = self.show(action["task_id"])
            if action["body"] not in _canonical(readback):
                self._run(["comment", action["task_id"], action["body"], "--author", "radulator-lifecycle"])
                readback = self.show(action["task_id"])
            if action["body"] not in _canonical(readback):
                raise LedgerError("Kanban comment failed authoritative readback.")
            return {"kind": kind, "task_id": action["task_id"], "idempotency_key": action["idempotency_key"]}
        if kind == "complete":
            readback = self.show(action["task_id"])
            if not _has_completed_status(readback, action["task_id"]):
                metadata = _canonical({"idempotency_key": action["idempotency_key"]})
                self._run([
                    "complete", action["task_id"], "--result", action["result"],
                    "--summary", action["summary"], "--metadata", metadata,
                ])
                readback = self.show(action["task_id"])
            if not _has_completed_status(readback, action["task_id"]):
                raise LedgerError("Kanban completion failed authoritative readback.")
            return {
                "kind": kind,
                "task_id": action["task_id"],
                "idempotency_key": action["idempotency_key"],
                "terminal_status": _terminal_status(readback, action["task_id"]),
            }
        raise LedgerError(f"Unsupported Kanban action kind {kind!r}.")


def execute_actions(actions: list[dict[str, Any]], adapter: HermesKanbanCLI) -> list[dict[str, Any]]:
    return [adapter.perform(action) for action in actions]


def _json_argument(value: str) -> dict[str, Any]:
    parsed = json.loads(value)
    if not isinstance(parsed, dict):
        raise argparse.ArgumentTypeError("evidence must be a JSON object")
    return parsed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    append = subparsers.add_parser("append")
    append.add_argument("--ledger", required=True)
    append.add_argument("--idempotency-key", required=True)
    append.add_argument("--source-id", required=True)
    append.add_argument("--task-id", required=True)
    append.add_argument("--state", required=True, choices=sorted(state for state in TRANSITIONS if state))
    append.add_argument("--pr", type=int)
    append.add_argument("--head-sha")
    append.add_argument("--evidence-json", type=_json_argument, default={})
    replay = subparsers.add_parser("replay")
    replay.add_argument("--ledger", required=True)
    replay.add_argument("--task-id")
    next_candidate = subparsers.add_parser("next")
    next_candidate.add_argument("--ledger", required=True)
    next_candidate.add_argument("--cursor-state", required=True)
    next_candidate.add_argument("--state", choices=sorted(state for state in TRANSITIONS if state))
    actions = subparsers.add_parser("actions")
    actions.add_argument("--ledger", required=True)
    actions.add_argument("--task-id", required=True)
    apply_actions = subparsers.add_parser("apply-actions")
    apply_actions.add_argument("--ledger", required=True)
    apply_actions.add_argument("--task-id", required=True)
    apply_actions.add_argument("--hermes", default="hermes")
    bootstrap = subparsers.add_parser("bootstrap")
    bootstrap.add_argument("--parent-task-id", required=True)
    bootstrap.add_argument("--pr", type=int, required=True)
    bootstrap.add_argument("--head-sha", required=True)
    bootstrap.add_argument("--apply", action="store_true")
    bootstrap.add_argument("--hermes", default="hermes")
    args = parser.parse_args()

    if args.command == "bootstrap":
        action = release_tracker_action(args.parent_task_id, args.pr, args.head_sha)
        rendered = execute_actions([action], HermesKanbanCLI(args.hermes)) if args.apply else [action]
        print(_canonical(rendered))
        return
    ledger = LifecycleLedger(args.ledger)
    if args.command == "append":
        event = ledger.append(
            idempotency_key=args.idempotency_key,
            source_id=args.source_id,
            task_id=args.task_id,
            state=args.state,
            pr=args.pr,
            head_sha=args.head_sha,
            evidence=args.evidence_json,
        )
        print(_canonical(event.as_dict()))
    elif args.command == "next":
        print(_canonical(select_next_candidate(ledger, args.cursor_state, required_state=args.state)))
    elif args.command == "replay":
        state = ledger.replay()
        if args.task_id:
            current = state.current_by_task.get(args.task_id)
            print(_canonical(current.as_dict() if current else {}))
        else:
            print(_canonical({key: value.as_dict() for key, value in state.current_by_task.items()}))
    else:
        state = ledger.replay()
        current = state.current_by_task.get(args.task_id)
        if not current:
            raise LedgerError(f"No lifecycle state for task {args.task_id!r}.")
        rendered = actions_for_event(current)
        if args.command == "apply-actions":
            print(_canonical(execute_actions(rendered, HermesKanbanCLI(args.hermes))))
        else:
            print(_canonical(rendered))


if __name__ == "__main__":
    main()
