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
import stat
import subprocess
import tempfile
from pathlib import Path
from typing import Any


SCHEMA = "radulator-lifecycle-event/v1"
CURSOR_SCHEMA = "radulator-lifecycle-cursor/v1"
CANDIDATE_SCHEMA = "radulator-lifecycle-candidate/v1"
RECONCILIATION_SCHEMA = "radulator-lifecycle-reconciliation/v1"
RECONCILIATION_RESULT_SCHEMA = "radulator-lifecycle-reconciliation-result/v1"
ZERO_HASH = "0" * 64
SHA_PATTERN = re.compile(r"^[0-9a-f]{40}$")
DIGEST_PATTERN = re.compile(r"^[0-9a-f]{64}$")
KANBAN_STATUSES = frozenset({
    "triage", "todo", "scheduled", "ready", "running", "blocked",
    "review", "done", "archived",
})
TERMINAL_KANBAN_STATUSES = frozenset({"done", "archived"})

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
        return self.append_batch([{
            "idempotency_key": idempotency_key,
            "source_id": source_id,
            "task_id": task_id,
            "state": state,
            "evidence": evidence,
            "pr": pr,
            "head_sha": head_sha,
            "timestamp": timestamp,
        }])[0]

    def append_batch(self, proposals: list[dict[str, Any]]) -> list[LifecycleEvent]:
        """Validate a semantic batch under one lock before appending any record."""
        if not isinstance(proposals, list) or not proposals:
            raise LedgerError("Lifecycle append batch requires at least one event.")
        allowed = {
            "idempotency_key", "source_id", "task_id", "state", "evidence",
            "pr", "head_sha", "timestamp",
        }
        if any(not isinstance(item, dict) or set(item) - allowed for item in proposals):
            raise LedgerError("Lifecycle append batch contains malformed event arguments.")
        self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        descriptor = os.open(self.path, os.O_RDWR | os.O_CREAT, 0o600)
        os.chmod(self.path, 0o600)
        with os.fdopen(descriptor, "r+", encoding="utf-8") as handle:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
            replay = self.replay(handle)
            results: list[LifecycleEvent] = []
            pending: list[LifecycleEvent] = []
            for arguments in proposals:
                proposed, is_new = _prepare_event(replay, **arguments)
                results.append(proposed)
                if is_new:
                    pending.append(proposed)
                    replay = _replay_with_event(replay, proposed)
            if pending:
                handle.seek(0, os.SEEK_END)
                handle.write("".join(
                    _canonical(event.as_dict()) + "\n" for event in pending
                ))
                handle.flush()
                os.fsync(handle.fileno())
            return results

    def perform_if_current(
        self,
        snapshots: list[dict[str, Any]],
        callback: Any,
    ) -> Any:
        """Run the complete external action plan under one reviewed ledger lease."""
        if not snapshots:
            raise LedgerError("Lifecycle reconciliation authority snapshots are required.")
        try:
            descriptor = os.open(self.path, os.O_RDWR)
        except OSError as error:
            raise LedgerError("Lifecycle ledger is unavailable for reconciliation.") from error
        with os.fdopen(descriptor, "r+", encoding="utf-8") as handle:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
            replay = self.replay(handle)
            for snapshot in snapshots:
                current = replay.current_by_task.get(snapshot["task_id"])
                if current is None or (
                    current.event_hash,
                    current.state,
                    current.head_sha,
                ) != (
                    snapshot["event_hash"],
                    snapshot["state"],
                    snapshot["head_sha"],
                ):
                    raise LedgerError(
                        f"Lifecycle task {snapshot['task_id']} changed during reconciliation."
                    )
            return callback()


def _prepare_event(
    replay: ReplayState,
    *,
    idempotency_key: str,
    source_id: str,
    task_id: str,
    state: str,
    evidence: dict[str, Any] | None = None,
    pr: int | None = None,
    head_sha: str | None = None,
    timestamp: str | None = None,
) -> tuple[LifecycleEvent, bool]:
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
        return existing, False
    _validate_transition(
        previous,
        proposed,
        blocked_resume_state=replay.blocked_resume_by_task.get(task_id),
    )
    unhashed = proposed.as_dict()
    unhashed.pop("event_hash")
    proposed = dataclasses.replace(proposed, event_hash=_event_hash(unhashed))
    return proposed, True


def _replay_with_event(replay: ReplayState, event: LifecycleEvent) -> ReplayState:
    current = dict(replay.current_by_task)
    current[event.task_id] = event
    idempotency = dict(replay.by_idempotency_key)
    idempotency[event.idempotency_key] = event
    blocked_resume = dict(replay.blocked_resume_by_task)
    if event.state == "blocked":
        blocked_resume[event.task_id] = event.evidence["resume_state"]
    else:
        blocked_resume.pop(event.task_id, None)
    return ReplayState(
        replay.events + (event,),
        current,
        idempotency,
        blocked_resume,
    )


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


def _validate_reconciliation_spec(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise LedgerError("Lifecycle reconciliation spec must be an object.")
    allowed_top = {"schema", "review_id", "trackers"}
    unknown_top = set(value) - allowed_top
    if unknown_top:
        raise LedgerError(
            "Lifecycle reconciliation spec has unknown fields: "
            + ", ".join(sorted(unknown_top))
        )
    if value.get("schema") != RECONCILIATION_SCHEMA:
        raise LedgerError("Lifecycle reconciliation spec has an unsupported schema.")
    review_id = value.get("review_id")
    if not isinstance(review_id, str) or not review_id.strip():
        raise LedgerError("Lifecycle reconciliation spec requires review_id.")
    trackers = value.get("trackers")
    if not isinstance(trackers, list) or not trackers or len(trackers) > 100:
        raise LedgerError("Lifecycle reconciliation spec requires 1 to 100 trackers.")

    normalized: list[dict[str, Any]] = []
    task_ids: set[str] = set()
    for index, tracker in enumerate(trackers):
        if not isinstance(tracker, dict):
            raise LedgerError(f"Reconciliation tracker {index} must be an object.")
        allowed_tracker = {
            "task_id", "source_id", "source", "pr", "head_sha", "base_sha",
        }
        unknown_tracker = set(tracker) - allowed_tracker
        if unknown_tracker:
            raise LedgerError(
                f"Reconciliation tracker {index} has unknown fields: "
                + ", ".join(sorted(unknown_tracker))
            )
        task_id = tracker.get("task_id")
        source_id = tracker.get("source_id")
        if not isinstance(task_id, str) or not task_id.startswith("t_"):
            raise LedgerError(f"Reconciliation tracker {index} requires task_id.")
        if task_id in task_ids:
            raise LedgerError(f"Reconciliation task_id {task_id} is duplicated.")
        task_ids.add(task_id)
        if not isinstance(source_id, str) or not source_id.strip():
            raise LedgerError(f"Reconciliation tracker {task_id} requires source_id.")

        source = tracker.get("source")
        if not isinstance(source, dict):
            raise LedgerError(f"Reconciliation tracker {task_id} requires source task/receipt evidence.")
        source_kind = source.get("kind")
        expected_source_keys = (
            {"kind", "task_id"}
            if source_kind == "kanban_task"
            else {"kind", "task_id", "digest"}
            if source_kind == "formspree_receipt"
            else None
        )
        if expected_source_keys is None or set(source) != expected_source_keys:
            raise LedgerError(
                f"Reconciliation tracker {task_id} has ambiguous source task/receipt evidence."
            )
        source_task_id = source.get("task_id")
        if not isinstance(source_task_id, str) or not source_task_id.startswith("t_"):
            raise LedgerError(f"Reconciliation tracker {task_id} has invalid source task_id.")
        if source_kind == "formspree_receipt" and not DIGEST_PATTERN.fullmatch(
            str(source.get("digest", ""))
        ):
            raise LedgerError(f"Reconciliation tracker {task_id} has invalid receipt digest.")

        authority_fields = (tracker.get("pr"), tracker.get("head_sha"), tracker.get("base_sha"))
        if any(field is not None for field in authority_fields) and not all(
            field is not None for field in authority_fields
        ):
            missing = [
                name for name in ("pr", "head_sha", "base_sha")
                if tracker.get(name) is None
            ]
            raise LedgerError(
                f"Reconciliation tracker {task_id} requires " + ", ".join(missing) + "."
            )
        if all(field is not None for field in authority_fields):
            if not isinstance(tracker["pr"], int) or tracker["pr"] <= 0:
                raise LedgerError(f"Reconciliation tracker {task_id} has invalid pr.")
            if not SHA_PATTERN.fullmatch(str(tracker["head_sha"])):
                raise LedgerError(f"Reconciliation tracker {task_id} has invalid head_sha.")
            if not SHA_PATTERN.fullmatch(str(tracker["base_sha"])):
                raise LedgerError(f"Reconciliation tracker {task_id} has invalid base_sha.")
        normalized.append(json.loads(_canonical(tracker)))

    return {
        "schema": RECONCILIATION_SCHEMA,
        "review_id": review_id.strip(),
        "trackers": normalized,
    }


def _load_reconciliation_spec(
    path: str | Path,
    expected_sha256: str,
) -> dict[str, Any]:
    spec_path = Path(path)
    if not DIGEST_PATTERN.fullmatch(str(expected_sha256)):
        raise LedgerError(
            "Lifecycle reconciliation spec requires an exact expected SHA-256."
        )
    nofollow = getattr(os, "O_NOFOLLOW", None)
    if nofollow is None:
        raise LedgerError(
            "Lifecycle reconciliation spec requires no-follow file support."
        )
    maximum_bytes = 1024 * 1024
    descriptor = None
    try:
        descriptor = os.open(
            spec_path,
            os.O_RDONLY | nofollow | getattr(os, "O_CLOEXEC", 0),
        )
        before = os.fstat(descriptor)
        if (
            not stat.S_ISREG(before.st_mode)
            or before.st_size > maximum_bytes
        ):
            raise LedgerError(
                "Lifecycle reconciliation spec must be a bounded regular file."
            )
        if before.st_uid != os.geteuid():
            raise LedgerError(
                "Lifecycle reconciliation spec must be owned by the running agent."
            )
        if stat.S_IMODE(before.st_mode) != 0o600:
            raise LedgerError(
                "Lifecycle reconciliation spec must have exact mode 0600."
            )
        chunks: list[bytes] = []
        total = 0
        while True:
            chunk = os.read(
                descriptor,
                min(64 * 1024, maximum_bytes + 1 - total),
            )
            if not chunk:
                break
            chunks.append(chunk)
            total += len(chunk)
            if total > maximum_bytes:
                raise LedgerError(
                    "Lifecycle reconciliation spec must be a bounded regular file."
                )
        after = os.fstat(descriptor)
        trusted_before = (
            before.st_dev,
            before.st_ino,
            before.st_uid,
            stat.S_IFMT(before.st_mode),
            stat.S_IMODE(before.st_mode),
            before.st_size,
            before.st_mtime_ns,
            before.st_ctime_ns,
        )
        trusted_after = (
            after.st_dev,
            after.st_ino,
            after.st_uid,
            stat.S_IFMT(after.st_mode),
            stat.S_IMODE(after.st_mode),
            after.st_size,
            after.st_mtime_ns,
            after.st_ctime_ns,
        )
        if trusted_after != trusted_before or total != before.st_size:
            raise LedgerError(
                "Lifecycle reconciliation spec changed while being read."
            )
        raw = b"".join(chunks)
        if hashlib.sha256(raw).hexdigest() != expected_sha256:
            raise LedgerError(
                "Lifecycle reconciliation spec does not match expected SHA-256."
            )
        value = json.loads(raw.decode("utf-8"))
    except OSError as error:
        try:
            if stat.S_ISLNK(spec_path.lstat().st_mode):
                raise LedgerError(
                    "Lifecycle reconciliation spec must not be a symlink."
                ) from error
        except OSError:
            pass
        raise LedgerError("Lifecycle reconciliation spec is unreadable.") from error
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise LedgerError("Lifecycle reconciliation spec is unreadable.") from error
    finally:
        if descriptor is not None:
            os.close(descriptor)
    return _validate_reconciliation_spec(value)


def _verified_kanban_reconciliation_task(
    adapter: Any,
    task_id: str,
) -> tuple[dict[str, Any], str]:
    try:
        readback = adapter.show(task_id)
    except Exception as error:
        raise LedgerError(f"Kanban reconciliation readback failed for {task_id}.") from error
    _exact_task_record(readback, task_id)
    status = _task_status(readback, task_id)
    return readback, status


def _kanban_authority_snapshot(
    value: Any,
    task_id: str,
) -> dict[str, Any]:
    task = _exact_task_record(value, task_id)
    return {
        "task": json.loads(_canonical(task)),
        "comments": json.loads(_canonical(_exact_task_comments(value))),
        "parents": sorted(_related_task_ids(value, "parents", task_id)),
        "children": sorted(_related_task_ids(value, "children", task_id)),
    }


def _read_kanban_authority_snapshot(
    adapter: Any,
    task_id: str,
) -> dict[str, Any]:
    readback, _status = _verified_kanban_reconciliation_task(adapter, task_id)
    return _kanban_authority_snapshot(readback, task_id)


def _read_stable_kanban_authority_pair(
    adapter: Any,
    tracker_id: str,
    source_id: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    first_tracker = _read_kanban_authority_snapshot(adapter, tracker_id)
    first_source = _read_kanban_authority_snapshot(adapter, source_id)
    second_tracker = _read_kanban_authority_snapshot(adapter, tracker_id)
    second_source = _read_kanban_authority_snapshot(adapter, source_id)
    if first_tracker != second_tracker or first_source != second_source:
        raise LedgerError(
            f"Kanban authority changed during reconciliation for {tracker_id}."
        )
    return second_tracker, second_source


def _require_kanban_authority_current(
    adapter: Any,
    authority: dict[str, Any],
) -> None:
    tracker_id = authority["tracker_task_id"]
    source_id = authority["source_task_id"]
    tracker, source = _read_stable_kanban_authority_pair(
        adapter, tracker_id, source_id,
    )
    if tracker != authority["tracker"] or source != authority["source"]:
        raise LedgerError(
            f"Kanban authority changed during reconciliation for {tracker_id}."
        )


def _advance_kanban_authority_after_action(
    adapter: Any,
    authority: dict[str, Any],
    action: dict[str, Any],
    receipt: dict[str, Any],
) -> dict[str, Any]:
    tracker_id = authority["tracker_task_id"]
    source_id = authority["source_task_id"]
    before = authority["tracker"]
    after, source = _read_stable_kanban_authority_pair(
        adapter, tracker_id, source_id,
    )
    if source != authority["source"]:
        raise LedgerError(
            f"Kanban authority changed during reconciliation for {tracker_id}."
        )
    if after != before:
        kind = action.get("kind")
        common_unchanged = (
            after["children"] == before["children"]
            and after["task"] == before["task"]
        )
        allowed = False
        if kind == "create_prerequisite":
            prerequisite_id = receipt.get("task_id")
            allowed = (
                isinstance(prerequisite_id, str)
                and prerequisite_id.startswith("t_")
                and common_unchanged
                and after["comments"] == before["comments"]
                and set(after["parents"])
                == set(before["parents"]) | {prerequisite_id}
            )
        elif kind == "comment":
            allowed = (
                common_unchanged
                and after["parents"] == before["parents"]
                and len(after["comments"]) <= len(before["comments"]) + 1
                and all(comment in after["comments"] for comment in before["comments"])
                and any(
                    comment.get("body") == action.get("body")
                    for comment in after["comments"]
                    if isinstance(comment, dict)
                )
            )
        elif kind == "complete":
            before_task = {
                key: value
                for key, value in before["task"].items()
                if key not in {"status", "state"}
            }
            after_task = {
                key: value
                for key, value in after["task"].items()
                if key not in {"status", "state"}
            }
            allowed = (
                before_task == after_task
                and after["parents"] == before["parents"]
                and after["children"] == before["children"]
                and after["comments"] == before["comments"]
                and _task_status({"task": after["task"]}, tracker_id)
                in TERMINAL_KANBAN_STATUSES
            )
        if not allowed:
            raise LedgerError(
                f"Kanban authority changed during reconciliation for {tracker_id}."
            )
    return {
        **authority,
        "tracker": after,
        "source": source,
    }


def _reconciliation_action(event: LifecycleEvent) -> dict[str, Any]:
    return {
        "kind": "create_prerequisite",
        "idempotency_key": f"radulator-reconcile:{event.task_id}:{event.event_hash}",
        "tracker_task_id": event.task_id,
        "title": f"Reconcile nonterminal Radulator release tracker {event.task_id}",
        "body": (
            f"Release tracker {event.task_id} is terminal in Kanban while its tamper-evident "
            f"lifecycle remains {event.state} at event {event.event_hash}. Preserve the ledger "
            "state, restore a runnable corrective obligation, and do not infer deployment, smoke, learning, or completion."
        ),
        "head_sha": event.head_sha,
        "assignee": "radulator",
        "priority": 100,
        "created_by": "radulator-lifecycle",
    }


def _blocked_resume_event(
    replay: ReplayState,
    task_id: str,
    retained_state: str,
) -> LifecycleEvent | None:
    current = replay.current_by_task.get(task_id)
    if (
        current is None
        or current.state != "blocked"
        or replay.blocked_resume_by_task.get(task_id) != retained_state
    ):
        return None
    task_events = [event for event in replay.events if event.task_id == task_id]
    if len(task_events) < 2 or task_events[-2].state != retained_state:
        raise LedgerError(
            f"Blocked lifecycle for {task_id} lost its exact retained {retained_state} event."
        )
    return task_events[-2]


def _event_matches_reviewed_authority(
    event: LifecycleEvent,
    tracker: dict[str, Any],
) -> bool:
    return (
        event.pr == tracker["pr"]
        and event.head_sha == tracker["head_sha"]
        and event.evidence.get("base_sha") == tracker["base_sha"]
    )


def reconcile_trackers(
    ledger: LifecycleLedger,
    spec: Any,
    adapter: Any,
    *,
    apply: bool = False,
) -> dict[str, Any]:
    """Plan or apply explicit, reviewed ledger/Kanban reconciliation only."""
    normalized = _validate_reconciliation_spec(spec)
    replay = ledger.replay()
    result: dict[str, Any] = {
        "schema": RECONCILIATION_RESULT_SCHEMA,
        "review_id": normalized["review_id"],
        "apply": apply,
        "planned_bootstrap": [],
        "bootstrapped": [],
        "already_reconciled": [],
        "terminal_mismatches": [],
        "blocked_recoveries": [],
        "planned_actions": [],
        "applied_actions": [],
    }

    # Freeze every external readback and every ledger/action decision before
    # mutating either the ledger or Kanban. A bad later entry must not
    # partially apply an earlier one.
    verified_trackers: list[tuple[dict[str, Any], str, dict[str, Any]]] = []
    for tracker in normalized["trackers"]:
        task_id = tracker["task_id"]
        tracker_readback, tracker_status = _verified_kanban_reconciliation_task(
            adapter, task_id
        )
        source = tracker["source"]
        source_readback, _source_status = _verified_kanban_reconciliation_task(
            adapter, source["task_id"]
        )
        if (
            source["kind"] == "formspree_receipt"
            and not _has_exact_receipt_digest(
                source_readback,
                source["task_id"],
                source["digest"],
            )
        ):
            raise LedgerError(
                f"Reconciliation source receipt digest failed authoritative readback for {task_id}."
            )
        if tracker.get("pr") is not None:
            pr_ok, head_ok, base_ok, coherent = _authority_mapping_status(
                tracker_readback,
                task_id,
                tracker["pr"],
                tracker["head_sha"],
                tracker["base_sha"],
            )
            if not pr_ok:
                raise LedgerError(f"Reconciliation PR failed Kanban readback for {task_id}.")
            if not head_ok:
                raise LedgerError(f"Reconciliation head SHA failed Kanban readback for {task_id}.")
            if not base_ok:
                raise LedgerError(f"Reconciliation base SHA failed Kanban readback for {task_id}.")
            if not coherent:
                raise LedgerError(
                    f"Reconciliation coherent PR/head/base mapping failed Kanban readback for {task_id}."
                )
        verified_trackers.append((
            tracker,
            tracker_status,
            {
                "tracker_task_id": task_id,
                "source_task_id": source["task_id"],
                "tracker": _kanban_authority_snapshot(
                    tracker_readback, task_id,
                ),
                "source": _kanban_authority_snapshot(
                    source_readback, source["task_id"],
                ),
            },
        ))

    frozen_plan: list[dict[str, Any]] = []
    for tracker, tracker_status, authority in verified_trackers:
        task_id = tracker["task_id"]
        source = tracker["source"]
        current = replay.current_by_task.get(task_id)
        entry_digest = hashlib.sha256(_canonical(tracker).encode("utf-8")).hexdigest()
        if current is None:
            if tracker_status in TERMINAL_KANBAN_STATUSES:
                raise LedgerError(
                    f"Cannot bootstrap terminal Kanban tracker {task_id} without lifecycle evidence."
                )
            result["planned_bootstrap"].append(task_id)
            frozen_plan.append({
                "kind": "bootstrap",
                "tracker": tracker,
                "tracker_status": tracker_status,
                "entry_digest": entry_digest,
                "authority": authority,
            })
            continue

        if current.source_id != tracker["source_id"]:
            raise LedgerError(f"Reconciliation source_id conflicts for {task_id}.")
        first = next(event for event in replay.events if event.task_id == task_id)
        recorded_digest = first.evidence.get("reconciliation_entry_sha256")
        if recorded_digest is not None and recorded_digest != entry_digest:
            raise LedgerError(f"Reconciliation spec conflicts with bootstrapped tracker {task_id}.")

        terminal_mismatch = (
            tracker_status in TERMINAL_KANBAN_STATUSES
            and current.state != "complete"
        )
        if terminal_mismatch:
            result["terminal_mismatches"].append(task_id)

        action_event = _blocked_resume_event(
            replay,
            task_id,
            "needs_fix",
        )
        if action_event is not None:
            result["blocked_recoveries"].append(task_id)
            actions = actions_for_event(action_event)
            rendered_event = action_event
        elif terminal_mismatch and current.state == "needs_fix":
            actions = actions_for_event(current)
            rendered_event = current
        elif terminal_mismatch:
            actions = [_reconciliation_action(current)]
            rendered_event = current
        else:
            actions = []
            rendered_event = None

        if (
            actions
            and tracker.get("pr") is not None
            and (
                rendered_event is None
                or not _event_matches_reviewed_authority(rendered_event, tracker)
            )
        ):
            raise LedgerError(
                f"Reconciliation lifecycle event authority conflicts for {task_id}."
            )

        if actions:
            result["planned_actions"].extend(actions)
        else:
            result["already_reconciled"].append(task_id)
        frozen_plan.append({
            "kind": "actions",
            "actions": actions,
            "authority": authority,
            "snapshot": {
                "task_id": task_id,
                "event_hash": current.event_hash,
                "state": current.state,
                "head_sha": current.head_sha,
            },
        })

    if not apply:
        return result

    bootstrap_items = [
        item for item in frozen_plan if item["kind"] == "bootstrap"
    ]
    if bootstrap_items:
        ledger.append_batch([
            {
                "idempotency_key": (
                    f"reconcile:{item['tracker']['task_id']}:feedback:"
                    f"{normalized['review_id']}"
                ),
                "source_id": item["tracker"]["source_id"],
                "task_id": item["tracker"]["task_id"],
                "state": "feedback",
                "pr": item["tracker"].get("pr"),
                "head_sha": item["tracker"].get("head_sha"),
                "evidence": {
                    "reconciliation_schema": RECONCILIATION_SCHEMA,
                    "review_id": normalized["review_id"],
                    "reconciliation_entry_sha256": item["entry_digest"],
                    "source": item["tracker"]["source"],
                    "kanban_status": item["tracker_status"],
                    **(
                        {"base_sha": item["tracker"]["base_sha"]}
                        if item["tracker"].get("base_sha") is not None
                        else {}
                    ),
                },
            }
            for item in bootstrap_items
        ])

    action_items = [
        item for item in frozen_plan
        if item["kind"] == "actions" and item["actions"]
    ]
    if action_items:
        def perform_guarded_actions() -> list[dict[str, Any]]:
            receipts: list[dict[str, Any]] = []
            for item in action_items:
                for action in item["actions"]:
                    _require_kanban_authority_current(
                        adapter, item["authority"],
                    )
                    receipt = adapter.perform(action)
                    item["authority"] = _advance_kanban_authority_after_action(
                        adapter,
                        item["authority"],
                        action,
                        receipt,
                    )
                    receipts.append(receipt)
            return receipts

        receipts = ledger.perform_if_current(
            [item["snapshot"] for item in action_items],
            perform_guarded_actions,
        )
        result["applied_actions"].extend(receipts)

    for item in frozen_plan:
        if item["kind"] == "bootstrap":
            tracker = item["tracker"]
            task_id = tracker["task_id"]
            result["bootstrapped"].append(task_id)
    return result


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
                "kind": "create_prerequisite",
                "idempotency_key": action_key,
                "tracker_task_id": event.task_id,
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
            "kind": "create_prerequisite",
            "idempotency_key": f"radulator-learn:{event.task_id}:{event.head_sha}",
            "tracker_task_id": event.task_id,
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


_TASK_AUTHORITY_FIELDS = frozenset({
    "status", "state", "pr", "head_sha", "base_sha", "title", "body",
    "result", "branch_name", "assignee", "receipt_digest", "digest",
    "parents", "children", "idempotency_key", "workflow",
})


def _direct_record_task_id(value: Any) -> str | None:
    if not isinstance(value, dict):
        return None
    identifiers = [value[key] for key in ("task_id", "id") if key in value]
    if not identifiers:
        return None
    if (
        any(not isinstance(candidate, str) or not candidate.startswith("t_") for candidate in identifiers)
        or len(set(identifiers)) != 1
    ):
        raise LedgerError("Kanban task record has conflicting or malformed identifiers.")
    return identifiers[0]


def _find_task_id(value: Any) -> str | None:
    """Return only an unambiguous root/top-level created-task identifier."""
    if not isinstance(value, dict):
        return None
    root_id = _direct_record_task_id(value)
    task = value.get("task")
    task_id = _direct_record_task_id(task)
    identifiers = {candidate for candidate in (root_id, task_id) if candidate is not None}
    if len(identifiers) > 1:
        raise LedgerError("Kanban create response has ambiguous task identifiers.")
    return next(iter(identifiers)) if identifiers else None


def _exact_task_record(value: Any, task_id: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise LedgerError(f"Kanban readback did not contain the exact task record for {task_id}.")
    root_id = _direct_record_task_id(value)
    task = value.get("task")
    task_record = task if isinstance(task, dict) else None
    top_level_task_id = _direct_record_task_id(task_record)
    if root_id is not None and top_level_task_id is not None:
        if root_id != top_level_task_id or root_id != task_id:
            raise LedgerError(f"Kanban readback has ambiguous exact task authority for {task_id}.")
        assert task_record is not None
        for field in _TASK_AUTHORITY_FIELDS:
            if (field in value) != (field in task_record) or (
                field in value and value[field] != task_record[field]
            ):
                raise LedgerError(f"Kanban readback has ambiguous exact task authority for {task_id}.")
        return task_record
    if root_id == task_id:
        return value
    if top_level_task_id == task_id and task_record is not None:
        return task_record
    raise LedgerError(f"Kanban readback did not contain the exact task record for {task_id}.")


def _exact_task_comments(value: Any) -> list[dict[str, Any]]:
    comments = value.get("comments", []) if isinstance(value, dict) else []
    if not isinstance(comments, list) or any(not isinstance(item, dict) for item in comments):
        raise LedgerError("Kanban task comments readback is malformed.")
    return comments


def _task_instruction_present(value: Any, task_id: str, body: str) -> bool:
    task = _exact_task_record(value, task_id)
    if task.get("body") == body:
        return True
    return any(comment.get("body") == body for comment in _exact_task_comments(value))


def _exact_task_evidence(value: Any, task_id: str) -> dict[str, Any]:
    task = _exact_task_record(value, task_id)
    task_fields = {
        key: task[key]
        for key in (
            "task_id", "id", "pr", "head_sha", "base_sha", "title", "body",
            "result", "branch_name",
        )
        if isinstance(task.get(key), (str, int))
    }
    comment_bodies = [
        comment["body"]
        for comment in _exact_task_comments(value)
        if isinstance(comment.get("body"), str)
    ]
    return {"task": task_fields, "comment_bodies": comment_bodies}


def _prose_authority_records(
    value: Any,
    task_id: str,
) -> list[tuple[int, str, str | None]]:
    task = _exact_task_record(value, task_id)
    bodies = [task.get("body")]
    bodies.extend(comment.get("body") for comment in _exact_task_comments(value))
    full_pattern = re.compile(
        r"(?<!\d)\bPR\s*#(?P<pr>[1-9]\d*)(?!\d)"
        r"[^\r\n]*?\b(?:exact\s+)?head(?:[_ -]?sha)?\b\s*[:=]?\s*"
        r"(?P<head>[0-9a-f]+)(?![0-9a-f])"
        r"[^\r\n]*?\bbase(?:[_ -]?sha)?\b\s*[:=]?\s*"
        r"(?P<base>[0-9a-f]+)(?![0-9a-f])",
        re.IGNORECASE,
    )
    partial_pattern = re.compile(
        r"(?<!\d)\bPR\s*#(?P<pr>[1-9]\d*)(?!\d)"
        r"[^\r\n]*?\b(?:exact\s+)?head(?:[_ -]?sha)?\b\s*[:=]?\s*"
        r"(?P<head>[0-9a-f]+)(?![0-9a-f])",
        re.IGNORECASE,
    )
    pr_marker_pattern = re.compile(
        r"(?<!\d)\bPR\s*#[1-9]\d*(?!\d)",
        re.IGNORECASE,
    )
    records: list[tuple[int, str, str | None]] = []
    for body in bodies:
        if not isinstance(body, str):
            continue
        for line in body.splitlines():
            markers = list(pr_marker_pattern.finditer(line))
            for index, marker in enumerate(markers):
                end = (
                    markers[index + 1].start()
                    if index + 1 < len(markers)
                    else len(line)
                )
                clause = line[marker.start():end]
                match = full_pattern.search(clause)
                if match is None:
                    match = partial_pattern.search(clause)
                if match is not None:
                    records.append((
                        int(match.group("pr")),
                        match.group("head").lower(),
                        (
                            match.group("base").lower()
                            if "base" in match.groupdict()
                            else None
                        ),
                    ))
    return records


def _authority_mapping_status(
    value: Any,
    task_id: str,
    pr: int,
    head_sha: str,
    base_sha: str,
) -> tuple[bool, bool, bool, bool]:
    task = _exact_task_record(value, task_id)
    records = _prose_authority_records(value, task_id)
    complete_records = {
        (record_pr, record_head, record_base)
        for record_pr, record_head, record_base in records
        if (
            len(record_head) == 40
            and isinstance(record_base, str)
            and len(record_base) == 40
            and ("pr" not in task or task.get("pr") == record_pr)
            and (
                "head_sha" not in task or task.get("head_sha") == record_head
            )
            and (
                "base_sha" not in task or task.get("base_sha") == record_base
            )
        )
    }
    fallback = next(iter(complete_records)) if len(complete_records) == 1 else None
    all_structured = all(
        field in task for field in ("pr", "head_sha", "base_sha")
    )
    coherent = all_structured or fallback is not None
    pr_ok = (
        task.get("pr") == pr
        if "pr" in task
        else (
            fallback[0] == pr
            if fallback is not None
            else any(record_pr == pr for record_pr, _head, _base in records)
        )
    )
    head_ok = (
        task.get("head_sha") == head_sha
        if "head_sha" in task
        else (
            fallback[0] == pr and fallback[1] == head_sha
            if fallback is not None
            else any(
                record_pr == pr and record_head == head_sha
                for record_pr, record_head, _base in records
            )
        )
    )
    base_ok = (
        task.get("base_sha") == base_sha
        if "base_sha" in task
        else (
            fallback == (pr, head_sha, base_sha)
            if fallback is not None
            else any(
                record_pr == pr
                and record_head == head_sha
                and record_base == base_sha
                for record_pr, record_head, record_base in records
            )
        )
    )
    return pr_ok, head_ok, base_ok, coherent


def _has_exact_receipt_digest(
    value: Any,
    task_id: str,
    digest: str,
) -> bool:
    task = _exact_task_record(value, task_id)
    structured = [
        task[field]
        for field in ("receipt_digest", "digest")
        if field in task
    ]
    if structured:
        return all(
            isinstance(item, str) and item.lower() == digest
            for item in structured
        )
    bodies = [task.get("body")]
    bodies.extend(comment.get("body") for comment in _exact_task_comments(value))
    pattern = re.compile(
        rf"(?<![0-9a-f]){re.escape(digest)}(?![0-9a-f])",
        re.IGNORECASE,
    )
    return any(
        isinstance(body, str) and pattern.search(body) is not None
        for body in bodies
    )


def _terminal_status(value: Any, task_id: str) -> str | None:
    status = _task_status(value, task_id)
    return status if status in TERMINAL_KANBAN_STATUSES else None


def _has_completed_status(value: Any, task_id: str) -> bool:
    return _terminal_status(value, task_id) is not None


def _related_task_ids(value: Any, relation: str, task_id: str) -> set[str]:
    if relation not in {"parents", "children"}:
        raise LedgerError(f"Unsupported Kanban relation {relation!r}.")
    task = _exact_task_record(value, task_id)
    containers: list[Any] = []
    if relation in task:
        containers.append(task[relation])
    if isinstance(value, dict) and value is not task and relation in value:
        containers.append(value[relation])
    if not containers:
        return set()
    relation_sets: list[set[str]] = []
    for container in containers:
        if not isinstance(container, list):
            raise LedgerError(f"Kanban {relation} readback is malformed for {task_id}.")
        related: set[str] = set()
        for item in container:
            if isinstance(item, str):
                candidate = item
            elif isinstance(item, dict):
                candidate = _direct_record_task_id(item)
            else:
                candidate = None
            if not isinstance(candidate, str) or not candidate.startswith("t_"):
                raise LedgerError(f"Kanban {relation} readback is malformed for {task_id}.")
            related.add(candidate)
        relation_sets.append(related)
    if any(related != relation_sets[0] for related in relation_sets[1:]):
        raise LedgerError(
            f"Kanban {relation} readback is ambiguous for exact task {task_id}."
        )
    return relation_sets[0]


def _task_status(value: Any, task_id: str) -> str:
    task = _exact_task_record(value, task_id)
    statuses = {
        str(task[key]).strip().lower()
        for key in ("status", "state")
        if str(task.get(key, "")).strip()
    }
    if len(statuses) != 1:
        raise LedgerError(f"Kanban status readback is missing or ambiguous for {task_id}.")
    status = next(iter(statuses))
    if status not in KANBAN_STATUSES:
        raise LedgerError(f"Kanban readback has unsupported status for exact task {task_id}.")
    return status


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
        _exact_task_record(result, task_id)
        return result

    def perform(self, action: dict[str, Any]) -> dict[str, Any]:
        kind = action.get("kind")
        if kind == "create_prerequisite":
            def create_verified(body: str, idempotency_key: str):
                arguments = [
                    "create",
                    action["title"],
                    "--body",
                    body,
                    "--idempotency-key",
                    idempotency_key,
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
                task_id = _find_task_id(created)
                if not task_id:
                    raise LedgerError(
                        "Kanban create response did not contain a prerequisite task id."
                    )
                readback = self.show(task_id)
                immutable_terminal = (
                    action.get("verdict_id")
                    and _task_status(readback, task_id) in TERMINAL_KANBAN_STATUSES
                )
                if not _task_instruction_present(readback, task_id, body):
                    if immutable_terminal:
                        raise LedgerError(
                            "Terminal NEEDS_FIX prerequisite failed exact body readback."
                        )
                    self._run([
                        "comment", task_id, body,
                        "--author", "radulator-lifecycle",
                    ])
                    readback = self.show(task_id)
                if (
                    action.get("assignee")
                    and _exact_task_record(readback, task_id).get("assignee")
                    != action["assignee"]
                ):
                    if immutable_terminal:
                        raise LedgerError(
                            "Terminal NEEDS_FIX prerequisite failed assignee readback."
                        )
                    self._run(["assign", task_id, action["assignee"]])
                    readback = self.show(task_id)
                if not _task_instruction_present(readback, task_id, body):
                    raise LedgerError("Created prerequisite failed exact body readback.")
                if (
                    action.get("assignee")
                    and _exact_task_record(readback, task_id).get("assignee")
                    != action["assignee"]
                ):
                    raise LedgerError(
                        "Created prerequisite failed assignee Kanban readback."
                    )
                return task_id, readback

            effective_key = action["idempotency_key"]
            prerequisite_id, prerequisite = create_verified(
                action["body"], effective_key,
            )
            superseded_task_ids: list[str] = []
            status = _task_status(prerequisite, prerequisite_id)
            if action.get("verdict_id") and status in TERMINAL_KANBAN_STATUSES:
                terminal_id = prerequisite_id
                superseded_task_ids.append(terminal_id)
                recovery_body = action["body"] + (
                    "\n\nRecovery: this open corrective prerequisite preserves and "
                    f"supersedes prematurely terminal prerequisite {terminal_id}; "
                    "do not rewrite or delete its history."
                )
                effective_key = (
                    action["idempotency_key"] + ":repair:" + terminal_id
                )
                prerequisite_id, prerequisite = create_verified(
                    recovery_body, effective_key,
                )
                if prerequisite_id == terminal_id:
                    raise LedgerError(
                        "Replacement NEEDS_FIX prerequisite reused its terminal task."
                    )
                status = _task_status(prerequisite, prerequisite_id)
                if status in TERMINAL_KANBAN_STATUSES:
                    raise LedgerError(
                        "Replacement NEEDS_FIX prerequisite is already terminal."
                    )

            tracker_id = action["tracker_task_id"]

            if tracker_id in _related_task_ids(prerequisite, "parents", prerequisite_id):
                self._run(["unlink", tracker_id, prerequisite_id])
                prerequisite = self.show(prerequisite_id)
                if tracker_id in _related_task_ids(prerequisite, "parents", prerequisite_id):
                    raise LedgerError("Deadlocked tracker-to-prerequisite edge survived unlink readback.")

            tracker = self.show(tracker_id)
            if prerequisite_id not in _related_task_ids(tracker, "parents", tracker_id):
                self._run(["link", prerequisite_id, tracker_id])
                tracker = self.show(tracker_id)
            if prerequisite_id not in _related_task_ids(tracker, "parents", tracker_id):
                raise LedgerError("Prerequisite-to-tracker dependency failed authoritative readback.")

            if status in {"todo", "blocked"}:
                self._run([
                    "promote", prerequisite_id,
                    f"release tracker {tracker_id} requires this prerequisite",
                    "--json",
                ])
                prerequisite = self.show(prerequisite_id)
                status = _task_status(prerequisite, prerequisite_id)
            allowed_statuses = {"ready", "running", "review"}
            if not action.get("verdict_id"):
                allowed_statuses.update({"done", "archived"})
            if status not in allowed_statuses:
                raise LedgerError(
                    f"Lifecycle prerequisite {prerequisite_id} is not runnable or complete after reconciliation."
                )
            if tracker_id in _related_task_ids(prerequisite, "parents", prerequisite_id):
                raise LedgerError("Lifecycle prerequisite still depends on its open release tracker.")
            receipt = {
                "kind": kind,
                "task_id": prerequisite_id,
                "tracker_task_id": tracker_id,
                "idempotency_key": effective_key,
                "status": status,
            }
            if superseded_task_ids:
                receipt["superseded_task_ids"] = superseded_task_ids
            return receipt
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
            if not _task_instruction_present(readback, child_id, action["body"]):
                self._run(["comment", child_id, action["body"], "--author", "radulator-lifecycle"])
                readback = self.show(child_id)
            if (
                action.get("assignee")
                and _exact_task_record(readback, child_id).get("assignee")
                != action["assignee"]
            ):
                self._run(["assign", child_id, action["assignee"]])
                readback = self.show(child_id)
            if (
                action["parent_task_id"]
                not in _related_task_ids(readback, "parents", child_id)
                or not _task_instruction_present(readback, child_id, action["body"])
                or action["head_sha"] not in action["body"]
            ):
                raise LedgerError("Created child failed exact parent/SHA Kanban readback.")
            if (
                action.get("assignee")
                and _exact_task_record(readback, child_id).get("assignee")
                != action["assignee"]
            ):
                raise LedgerError("Created child failed assignee Kanban readback.")
            return {"kind": kind, "task_id": child_id, "idempotency_key": action["idempotency_key"]}
        if kind == "comment":
            readback = self.show(action["task_id"])
            if not _task_instruction_present(
                readback, action["task_id"], action["body"]
            ):
                self._run(["comment", action["task_id"], action["body"], "--author", "radulator-lifecycle"])
                readback = self.show(action["task_id"])
            if not _task_instruction_present(
                readback, action["task_id"], action["body"]
            ):
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
    reconcile = subparsers.add_parser("reconcile")
    reconcile.add_argument("--ledger", required=True)
    reconcile.add_argument("--spec", required=True)
    reconcile.add_argument("--spec-sha256", required=True)
    reconcile.add_argument("--hermes", default="hermes")
    reconcile.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    if args.command == "bootstrap":
        action = release_tracker_action(args.parent_task_id, args.pr, args.head_sha)
        rendered = execute_actions([action], HermesKanbanCLI(args.hermes)) if args.apply else [action]
        print(_canonical(rendered))
        return
    ledger = LifecycleLedger(args.ledger)
    if args.command == "reconcile":
        print(_canonical(reconcile_trackers(
            ledger,
            _load_reconciliation_spec(args.spec, args.spec_sha256),
            HermesKanbanCLI(args.hermes),
            apply=args.apply,
        )))
    elif args.command == "append":
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
