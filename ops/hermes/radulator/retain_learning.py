#!/usr/bin/env python3
"""Retain one production-verified Radulator lesson with exact readback."""

from __future__ import annotations

import argparse
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Callable, Dict, Optional

try:
    from .learning_context import make_learning_candidate
    from .lifecycle_controller import LifecycleLedger
except ImportError:  # Direct script execution from the installed overlay.
    from learning_context import make_learning_candidate
    from lifecycle_controller import LifecycleLedger


SCHEMA = "radulator-release-learning/v1"
RECEIPT_SCHEMA = "radulator-release-learning-receipt/v1"
STRATEGY = "kanban_closure"
MAX_RESPONSE_BYTES = 1024 * 1024
REQUIRED_FIELDS = (
    "feedback_symptom",
    "root_cause",
    "regression_test",
    "released_sha",
    "retention_id",
    "reusable_rule",
    "smoke_proof",
)


class RetentionError(RuntimeError):
    pass


def _validate_candidate(candidate: Dict[str, Any]) -> None:
    if candidate.get("schema") != SCHEMA:
        raise RetentionError("Unsupported release-learning candidate schema.")
    for field in REQUIRED_FIELDS:
        if not isinstance(candidate.get(field), str) or not candidate[field].strip():
            raise RetentionError(f"Release-learning candidate is missing {field}.")
    if not re.fullmatch(r"[0-9a-f]{40}", candidate["released_sha"]):
        raise RetentionError("released_sha must be an exact lowercase Git SHA.")
    if not re.fullmatch(r"[0-9a-f]{64}", candidate["retention_id"]):
        raise RetentionError("retention_id must be a lowercase SHA-256 digest.")


def _validated_api_url(value: str) -> str:
    parsed = urllib.parse.urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.username or parsed.password:
        raise RetentionError("Hindsight API URL must be an http(s) endpoint without embedded credentials.")
    if parsed.query or parsed.fragment:
        raise RetentionError("Hindsight API URL must not include a query or fragment.")
    return value.rstrip("/")


def _content(candidate: Dict[str, Any]) -> str:
    return "\n".join((
        f"Retention ID: {candidate['retention_id']}",
        f"Feedback symptom: {candidate['feedback_symptom']}",
        f"Root cause: {candidate['root_cause']}",
        f"Regression test: {candidate['regression_test']}",
        f"Released SHA: {candidate['released_sha']}",
        f"Smoke proof: {candidate['smoke_proof']}",
        f"Reusable rule: {candidate['reusable_rule']}",
    ))


def _request_json(
    request: urllib.request.Request,
    *,
    opener: Callable[..., Any],
    timeout: float,
) -> Dict[str, Any]:
    try:
        with opener(request, timeout=timeout) as response:
            raw = response.read(MAX_RESPONSE_BYTES + 1)
    except (OSError, urllib.error.URLError) as error:
        raise RetentionError(f"Hindsight request failed: {error}") from error
    if len(raw) > MAX_RESPONSE_BYTES:
        raise RetentionError("Hindsight response exceeded the bounded response limit.")
    try:
        decoded = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise RetentionError("Hindsight returned malformed JSON.") from error
    if not isinstance(decoded, dict):
        raise RetentionError("Hindsight response must be a JSON object.")
    return decoded


def retain_learning(
    candidate: Dict[str, Any],
    *,
    api_url: str,
    bank_id: str,
    api_key: Optional[str] = None,
    timeout: float = 60,
    opener: Callable[..., Any] = urllib.request.urlopen,
) -> Dict[str, Any]:
    _validate_candidate(candidate)
    api_url = _validated_api_url(api_url)
    if not isinstance(bank_id, str) or not bank_id.strip():
        raise RetentionError("Hindsight bank_id is required.")
    if timeout <= 0 or timeout > 120:
        raise RetentionError("Hindsight timeout must be between 0 and 120 seconds.")

    retention_id = candidate["retention_id"]
    document_id = f"radulator-release-learning-{retention_id}"
    content = _content(candidate)
    tags = ["radulator-release-learning", f"retention_id:{retention_id}"]
    bank_path = urllib.parse.quote(bank_id.strip(), safe="")
    memories_url = f"{api_url}/v1/default/banks/{bank_path}/memories"
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    payload = {
        "items": [{
            "content": content,
            "context": retention_id,
            "document_id": document_id,
            "tags": tags,
            "strategy": STRATEGY,
            "update_mode": "replace",
        }],
        "async": False,
    }
    post = urllib.request.Request(
        memories_url,
        data=json.dumps(payload, separators=(",", ":")).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    accepted = _request_json(post, opener=opener, timeout=timeout)
    if (
        accepted.get("success") is not True
        or accepted.get("bank_id") != bank_id.strip()
        or accepted.get("items_count") != 1
        or accepted.get("async") is not False
    ):
        raise RetentionError("Hindsight did not synchronously accept exactly one learning record.")

    query = urllib.parse.urlencode({"document_id": document_id, "state": "valid", "limit": 2})
    readback_request = urllib.request.Request(
        f"{memories_url}/list?{query}", headers=headers, method="GET",
    )
    readback = _request_json(readback_request, opener=opener, timeout=timeout)
    items = readback.get("items")
    if not isinstance(items, list):
        raise RetentionError("Hindsight readback did not return a memory list.")
    matching = [
        item for item in items
        if isinstance(item, dict)
        and item.get("text") == content
        and item.get("context") == retention_id
        and item.get("document_id") == document_id
        and item.get("state") == "valid"
        and set(item.get("tags") or ()) == set(tags)
        and isinstance(item.get("id"), str)
        and item["id"].strip()
    ]
    if len(matching) != 1:
        raise RetentionError("Hindsight exact-document readback did not yield one valid matching receipt.")

    return {
        "schema": RECEIPT_SCHEMA,
        "bank_id": bank_id.strip(),
        "document_id": document_id,
        "readback_state": "valid",
        "receipt_id": matching[0]["id"],
        "released_sha": candidate["released_sha"],
        "retention_id": retention_id,
        "strategy": STRATEGY,
    }


def _load_config(path: Path) -> Dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise RetentionError(f"Unable to read Hindsight config: {error}") from error
    if not isinstance(value, dict):
        raise RetentionError("Hindsight config must be a JSON object.")
    return value


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ledger", required=True)
    parser.add_argument("--task-id", required=True)
    parser.add_argument("--config")
    parser.add_argument("--timeout", type=float, default=60)
    args = parser.parse_args()

    config_path = args.config
    if not config_path:
        hermes_home = os.environ.get("HERMES_HOME", "").strip()
        if not hermes_home:
            raise RetentionError("--config or HERMES_HOME is required.")
        config_path = str(Path(hermes_home) / "hindsight/config.json")
    config = _load_config(Path(config_path))
    candidate = make_learning_candidate(LifecycleLedger(args.ledger), args.task_id)
    receipt = retain_learning(
        candidate,
        api_url=str(config.get("api_url") or ""),
        bank_id=str(config.get("bank_id") or ""),
        api_key=(
            os.environ.get("HINDSIGHT_API_KEY")
            or config.get("apiKey")
            or config.get("api_key")
            or None
        ),
        timeout=args.timeout,
    )
    print(json.dumps(receipt, sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    main()
