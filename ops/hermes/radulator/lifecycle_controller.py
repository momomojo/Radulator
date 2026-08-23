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
from pathlib import Path
from typing import Any


SCHEMA = "radulator-lifecycle-event/v1"
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
    "promotion": {"merged_main", "needs_fix", "blocked"},
    "merged_main": {"deploying", "blocked"},
    "deploying": {"deployed", "blocked"},
    "deployed": {"smoke_passed", "needs_fix", "blocked"},
    "smoke_passed": {"learned", "blocked"},
    "learned": {"complete", "blocked"},
    "complete": set(),
    "blocked": {"implementing", "testing", "review", "promotion", "deploying", "needs_fix"},
}


class LedgerError(RuntimeError):
    pass


def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _event_hash(payload: dict[str, Any]) -> str:
    return hashlib.sha256(_canonical(payload).encode("utf-8")).hexdigest()


def _timestamp() -> str:
    return dt.datetime.now(dt.UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


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


def _validate_transition(previous: LifecycleEvent | None, event: LifecycleEvent) -> None:
    previous_state = previous.state if previous else None
    if event.state not in TRANSITIONS.get(previous_state, set()):
        raise LedgerError(f"Invalid lifecycle transition {previous_state!r} -> {event.state!r}.")
    if previous and previous.source_id != event.source_id:
        raise LedgerError("A task source_id cannot change during replay.")
    if event.state == "implementing" and previous_state in {"needs_fix", "blocked"}:
        if not event.evidence.get("prerequisite_change_id"):
            raise LedgerError("Requeue transition requires prerequisite_change_id evidence.")
    if previous_state == "needs_fix" and event.state == "implementing":
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
            return ReplayState((), {}, {})
        if handle is None:
            with self.path.open("r", encoding="utf-8") as reader:
                return self.replay(reader)

        handle.seek(0)
        events: list[LifecycleEvent] = []
        current: dict[str, LifecycleEvent] = {}
        idempotency: dict[str, LifecycleEvent] = {}
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
            _validate_transition(current.get(event.task_id), event)
            events.append(event)
            current[event.task_id] = event
            idempotency[event.idempotency_key] = event
            expected_previous = event.event_hash
        return ReplayState(tuple(events), current, idempotency)

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
        serialized_evidence = json.loads(_canonical(evidence))

        self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        descriptor = os.open(self.path, os.O_RDWR | os.O_CREAT, 0o600)
        os.chmod(self.path, 0o600)
        with os.fdopen(descriptor, "r+", encoding="utf-8") as handle:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
            replay = self.replay(handle)
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
            existing = replay.by_idempotency_key.get(idempotency_key)
            if existing:
                if _semantic_payload(existing) != _semantic_payload(proposed):
                    raise LedgerError(f"Conflicting event for idempotency key {idempotency_key!r}.")
                return existing
            _validate_transition(replay.current_by_task.get(task_id), proposed)
            unhashed = proposed.as_dict()
            unhashed.pop("event_hash")
            proposed = dataclasses.replace(proposed, event_hash=_event_hash(unhashed))
            handle.seek(0, os.SEEK_END)
            handle.write(_canonical(proposed.as_dict()) + "\n")
            handle.flush()
            os.fsync(handle.fileno())
            return proposed


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


def _has_completed_status(value: Any) -> bool:
    if isinstance(value, dict):
        for key in ("status", "state"):
            if str(value.get(key, "")).lower() in {"complete", "completed", "done"}:
                return True
        return any(_has_completed_status(nested) for nested in value.values())
    if isinstance(value, list):
        return any(_has_completed_status(nested) for nested in value)
    return False


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
        if _find_task_id(result) != task_id:
            raise LedgerError(f"Kanban readback did not identify task {task_id}.")
        return result

    def perform(self, action: dict[str, Any]) -> dict[str, Any]:
        kind = action.get("kind")
        if kind == "create_child":
            created = self._run([
                "create",
                action["title"],
                "--parent",
                action["parent_task_id"],
                "--idempotency-key",
                action["idempotency_key"],
                "--json",
            ], expect_json=True)
            child_id = _find_task_id(created)
            if not child_id:
                raise LedgerError("Kanban create response did not contain a child task id.")
            readback = self.show(child_id)
            serialized = _canonical(readback)
            if action["body"] not in serialized:
                self._run(["comment", child_id, action["body"], "--author", "radulator-lifecycle"])
                readback = self.show(child_id)
                serialized = _canonical(readback)
            if action["parent_task_id"] not in serialized or action["head_sha"] not in serialized:
                raise LedgerError("Created child failed exact parent/SHA Kanban readback.")
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
            if not _has_completed_status(readback):
                metadata = _canonical({"idempotency_key": action["idempotency_key"]})
                self._run([
                    "complete", action["task_id"], "--result", action["result"],
                    "--summary", action["summary"], "--metadata", metadata,
                ])
                readback = self.show(action["task_id"])
            if not _has_completed_status(readback):
                raise LedgerError("Kanban completion failed authoritative readback.")
            return {"kind": kind, "task_id": action["task_id"], "idempotency_key": action["idempotency_key"]}
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
