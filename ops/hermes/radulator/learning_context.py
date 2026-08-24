#!/usr/bin/env python3
"""Produce a bounded Hindsight retention candidate after production smoke."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from typing import Any

try:
    from .lifecycle_controller import LifecycleLedger, SHA_PATTERN
except ImportError:  # Direct script execution from the installed overlay.
    from lifecycle_controller import LifecycleLedger, SHA_PATTERN


SCHEMA = "radulator-release-learning/v1"
REQUIRED_FIELDS = (
    "feedback_symptom",
    "root_cause",
    "regression_test",
    "released_sha",
    "smoke_proof",
    "reusable_rule",
)
SENSITIVE = re.compile(
    r"(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|"
    r"(?:api[_ -]?key|access[_ -]?token|password)\s*[:=]\s*\S+)",
    re.IGNORECASE,
)


class LearningError(RuntimeError):
    pass


def _clean(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise LearningError(f"Missing learning field {field}.")
    cleaned = " ".join(value.split())
    if len(cleaned) > 1000:
        raise LearningError(f"Learning field {field} is too long.")
    if SENSITIVE.search(cleaned):
        raise LearningError(f"Learning field {field} contains sensitive content.")
    return cleaned


def make_learning_candidate(ledger: LifecycleLedger, task_id: str) -> dict[str, str]:
    replay = ledger.replay()
    current = replay.current_by_task.get(task_id)
    if not current:
        raise LearningError(f"No lifecycle state for task {task_id!r}.")
    if current.state in {"learned", "complete"}:
        raise LearningError("Learning was already retained for this task.")
    if current.state != "smoke_passed":
        raise LearningError("Learning is allowed only from smoke_passed state.")
    values = {field: _clean(current.evidence.get(field), field) for field in REQUIRED_FIELDS}
    if not SHA_PATTERN.fullmatch(values["released_sha"]):
        raise LearningError("released_sha is malformed.")
    if current.head_sha and current.head_sha != values["released_sha"]:
        raise LearningError("released_sha does not match the smoke-passed lifecycle head.")
    base = {
        "schema": SCHEMA,
        "task_id": task_id,
        "source_id": current.source_id,
        **values,
    }
    canonical = json.dumps(base, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return {**base, "retention_id": hashlib.sha256(canonical.encode("utf-8")).hexdigest()}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ledger", required=True)
    parser.add_argument("--task-id", required=True)
    args = parser.parse_args()
    print(json.dumps(make_learning_candidate(LifecycleLedger(args.ledger), args.task_id), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
