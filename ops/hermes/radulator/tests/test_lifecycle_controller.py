import json
import subprocess
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock

import ops.hermes.radulator.lifecycle_controller as lifecycle_module
from ops.hermes.radulator.lifecycle_controller import (
    LedgerError,
    HermesKanbanCLI,
    LifecycleLedger,
    actions_for_event,
    execute_actions,
    release_tracker_action,
    select_next_candidate,
)


HEAD = "a" * 40
NEXT_HEAD = "b" * 40


class LifecycleLedgerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.ledger_path = Path(self.temp.name) / "lifecycle.jsonl"
        self.ledger = LifecycleLedger(self.ledger_path)

    def tearDown(self):
        self.temp.cleanup()

    def append(self, state, index, evidence=None):
        return self.ledger.append(
            idempotency_key=f"event-{index}",
            source_id="feedback-17",
            task_id="t_parent",
            state=state,
            pr=42,
            head_sha=HEAD,
            evidence=evidence or {"proof": f"proof-{index}"},
            timestamp=f"2026-08-23T20:{index:02d}:00Z",
        )

    def test_timestamp_generation_uses_python39_compatible_timezone_api(self):
        sentinel = object()
        rendered = types.SimpleNamespace(
            isoformat=lambda **_kwargs: "2026-08-23T22:00:00+00:00",
        )
        fake_datetime = types.SimpleNamespace(
            datetime=types.SimpleNamespace(now=lambda timezone: rendered if timezone is sentinel else None),
            timezone=types.SimpleNamespace(utc=sentinel),
        )
        with mock.patch.object(lifecycle_module, "dt", fake_datetime):
            self.assertEqual(lifecycle_module._timestamp(), "2026-08-23T22:00:00Z")

    def test_replays_complete_lifecycle_and_survives_restart(self):
        states = [
            "feedback", "implementing", "testing", "review", "approved",
            "merged_develop", "promotion", "merged_main", "deploying",
            "deployed", "smoke_passed", "learned", "complete",
        ]
        for index, state in enumerate(states):
            self.append(state, index)

        replay = LifecycleLedger(self.ledger_path).replay()
        self.assertEqual(replay.current_by_task["t_parent"].state, "complete")
        self.assertEqual(len(replay.events), len(states))
        self.assertEqual(replay.events[-1].previous_hash, replay.events[-2].event_hash)

    def test_duplicate_is_idempotent_and_conflicting_duplicate_fails(self):
        first = self.append("feedback", 0)
        duplicate = self.append("feedback", 0)
        self.assertEqual(first.event_hash, duplicate.event_hash)
        self.assertEqual(len(self.ledger_path.read_text().splitlines()), 1)

        with self.assertRaisesRegex(LedgerError, "idempotency key"):
            self.ledger.append(
                idempotency_key="event-0",
                source_id="feedback-17",
                task_id="t_parent",
                state="feedback",
                evidence={"proof": "different"},
                timestamp="2026-08-23T20:00:00Z",
            )

    def test_detects_tampering(self):
        self.append("feedback", 0)
        payload = json.loads(self.ledger_path.read_text())
        payload["evidence"]["proof"] = "tampered"
        self.ledger_path.write_text(json.dumps(payload) + "\n")
        with self.assertRaisesRegex(LedgerError, "hash"):
            self.ledger.replay()

    def test_rejects_invalid_transition_and_early_completion(self):
        self.append("feedback", 0)
        with self.assertRaisesRegex(LedgerError, "transition"):
            self.append("approved", 1)

        ledger = LifecycleLedger(Path(self.temp.name) / "second.jsonl")
        ledger.append(idempotency_key="f", source_id="f", task_id="t", state="feedback")
        ledger.append(idempotency_key="i", source_id="f", task_id="t", state="implementing")
        with self.assertRaisesRegex(LedgerError, "transition"):
            ledger.append(idempotency_key="c", source_id="f", task_id="t", state="complete")

    def test_needs_fix_requires_a_new_exact_head_before_requeue(self):
        self.append("feedback", 0)
        self.append("implementing", 1)
        self.append("testing", 2)
        self.append("review", 3)
        needs_fix = self.append(
            "needs_fix",
            4,
            {"verdict_id": "comment-991", "reason": "Threshold citation does not match."},
        )
        actions = actions_for_event(needs_fix)
        self.assertEqual([item["kind"] for item in actions], ["create_child", "comment"])
        child = actions[0]
        self.assertEqual(child["parent_task_id"], "t_parent")
        self.assertEqual(child["head_sha"], HEAD)
        self.assertEqual(child["idempotency_key"], "radulator-rework:t_parent:comment-991")
        self.assertEqual(child["assignee"], "codex-coding")
        self.assertEqual(child["priority"], 90)
        self.assertEqual(child["max_runtime"], "45m")
        self.assertEqual(child["created_by"], "radulator-lifecycle")
        self.assertNotIn("attachment", json.dumps(child).lower())
        self.assertEqual(actions, actions_for_event(needs_fix))

        with self.assertRaisesRegex(LedgerError, "new exact head"):
            self.ledger.append(
                idempotency_key="resume-comment-991-same-head",
                source_id="feedback-17",
                task_id="t_parent",
                state="implementing",
                pr=42,
                head_sha=HEAD,
                evidence={"prerequisite_change_id": "child-created:t_rework"},
            )
        resumed = self.ledger.append(
            idempotency_key="resume-comment-991-new-head",
            source_id="feedback-17",
            task_id="t_parent",
            state="implementing",
            pr=42,
            head_sha=NEXT_HEAD,
            evidence={"prerequisite_change_id": "commit:" + NEXT_HEAD},
        )
        self.assertEqual(resumed.state, "implementing")
        self.assertEqual(resumed.head_sha, NEXT_HEAD)

    def test_kanban_adapter_is_idempotent_and_verifies_readback(self):
        self.append("feedback", 0)
        self.append("implementing", 1)
        self.append("testing", 2)
        self.append("review", 3)
        event = self.append("needs_fix", 4, {"verdict_id": "comment-991", "reason": "Fix citation."})
        tasks = {
            "t_parent": {"id": "t_parent", "status": "open", "comments": []},
        }
        commands = []

        def runner(command):
            commands.append(command)
            args = command[2:]
            if args[0] == "create":
                child = tasks.setdefault("t_child", {
                    "id": "t_child",
                    "status": "open",
                    "parent_id": args[args.index("--parent") + 1],
                    "body": args[args.index("--body") + 1],
                    "assignee": args[args.index("--assignee") + 1],
                    "priority": int(args[args.index("--priority") + 1]),
                    "max_runtime": args[args.index("--max-runtime") + 1],
                    "created_by": args[args.index("--created-by") + 1],
                    "comments": [],
                })
                return subprocess.CompletedProcess(command, 0, json.dumps(child), "")
            if args[0] == "show":
                return subprocess.CompletedProcess(command, 0, json.dumps(tasks[args[1]]), "")
            if args[0] == "comment":
                tasks[args[1]]["comments"].append({"body": args[2]})
                return subprocess.CompletedProcess(command, 0, "ok", "")
            return subprocess.CompletedProcess(command, 1, "", "unexpected")

        receipts = execute_actions(actions_for_event(event), HermesKanbanCLI(runner=runner))
        self.assertEqual([receipt["kind"] for receipt in receipts], ["create_child", "comment"])
        create_command = next(command for command in commands if command[2] == "create")
        self.assertEqual(create_command[create_command.index("--body") + 1], actions_for_event(event)[0]["body"])
        self.assertEqual(create_command[create_command.index("--assignee") + 1], "codex-coding")
        self.assertEqual(create_command[create_command.index("--priority") + 1], "90")
        self.assertEqual(create_command[create_command.index("--max-runtime") + 1], "45m")
        self.assertEqual(create_command[create_command.index("--created-by") + 1], "radulator-lifecycle")
        comment_commands = [command for command in commands if command[2] == "comment"]
        self.assertEqual(len(comment_commands), 1)

        execute_actions(actions_for_event(event), HermesKanbanCLI(runner=runner))
        comment_commands = [command for command in commands if command[2] == "comment"]
        self.assertEqual(len(comment_commands), 1, "authoritative readback prevents duplicate comments")

    def test_learning_child_is_assigned_to_radulator_profile(self):
        states = [
            "feedback", "implementing", "testing", "review", "approved",
            "merged_develop", "promotion", "merged_main", "deploying",
            "deployed", "smoke_passed",
        ]
        for index, state in enumerate(states):
            event = self.append(state, index)

        action = actions_for_event(event)[0]

        self.assertEqual(action["kind"], "create_child")
        self.assertEqual(action["workflow"], "release_learning")
        self.assertEqual(action["assignee"], "radulator")

    def test_archived_release_tracker_is_an_authoritative_terminal_receipt(self):
        states = [
            "feedback", "implementing", "testing", "review", "approved",
            "merged_develop", "promotion", "merged_main", "deploying",
            "deployed", "smoke_passed", "learned",
        ]
        for index, state in enumerate(states):
            event = self.append(state, index)
        action = actions_for_event(event)[0]
        commands = []

        def runner(command):
            commands.append(command)
            args = command[2:]
            if args[0] == "show":
                return subprocess.CompletedProcess(
                    command, 0, json.dumps({"task": {"id": "t_parent", "status": "archived"}}), "",
                )
            return subprocess.CompletedProcess(command, 1, "", "unexpected mutation")

        receipt = HermesKanbanCLI(runner=runner).perform(action)

        self.assertEqual(receipt["task_id"], "t_parent")
        self.assertEqual(receipt["terminal_status"], "archived")
        self.assertEqual([command[2] for command in commands], ["show"])

    def test_unrelated_nested_terminal_task_cannot_complete_requested_tracker(self):
        states = [
            "feedback", "implementing", "testing", "review", "approved",
            "merged_develop", "promotion", "merged_main", "deploying",
            "deployed", "smoke_passed", "learned",
        ]
        for index, state in enumerate(states):
            event = self.append(state, index)
        action = actions_for_event(event)[0]
        commands = []

        def runner(command):
            commands.append(command)
            args = command[2:]
            if args[0] == "show":
                return subprocess.CompletedProcess(command, 0, json.dumps({
                    "task": {
                        "id": "t_parent",
                        "status": "in_progress",
                        "children": [{"id": "t_unrelated", "status": "archived"}],
                    },
                }), "")
            if args[0] == "complete":
                return subprocess.CompletedProcess(command, 0, "ok", "")
            return subprocess.CompletedProcess(command, 1, "", "unexpected mutation")

        with self.assertRaisesRegex(LedgerError, "completion failed authoritative readback"):
            HermesKanbanCLI(runner=runner).perform(action)

        self.assertEqual([command[2] for command in commands], ["show", "complete", "show"])

    def test_next_candidate_is_bounded_round_robin_and_excludes_complete(self):
        cursor = Path(self.temp.name) / "lifecycle-cursor.json"
        self.ledger.append(
            idempotency_key="one-feedback", source_id="source-one", task_id="t_one",
            state="feedback", pr=1, head_sha=HEAD, timestamp="2026-08-23T20:00:00Z",
        )
        self.ledger.append(
            idempotency_key="two-feedback", source_id="source-two", task_id="t_two",
            state="feedback", pr=2, head_sha=NEXT_HEAD, timestamp="2026-08-23T20:01:00Z",
        )
        complete_states = [
            "feedback", "implementing", "testing", "review", "approved", "merged_develop",
            "promotion", "merged_main", "deploying", "deployed", "smoke_passed", "learned", "complete",
        ]
        for index, state in enumerate(complete_states):
            self.ledger.append(
                idempotency_key=f"complete-{state}", source_id="source-complete", task_id="t_complete",
                state=state, pr=3, head_sha=HEAD, timestamp=f"2026-08-23T21:{index:02d}:00Z",
            )

        first = select_next_candidate(self.ledger, cursor)
        second = select_next_candidate(self.ledger, cursor)
        third = select_next_candidate(self.ledger, cursor)

        self.assertEqual(first["count"], 1)
        self.assertEqual(first["candidate"]["task_id"], "t_one")
        self.assertEqual(second["candidate"]["task_id"], "t_two")
        self.assertEqual(third["candidate"]["task_id"], "t_one")
        self.assertNotIn("evidence", first["candidate"])
        self.assertEqual(cursor.stat().st_mode & 0o777, 0o600)
        self.assertEqual((Path(str(cursor) + ".lock")).stat().st_mode & 0o777, 0o600)

    def test_existing_idempotent_rework_child_is_repaired_to_codex_assignee(self):
        self.append("feedback", 0)
        self.append("implementing", 1)
        self.append("testing", 2)
        self.append("review", 3)
        event = self.append("needs_fix", 4, {"verdict_id": "comment-991", "reason": "Fix citation."})
        action = actions_for_event(event)[0]
        tasks = {
            "t_child": {
                "id": "t_child", "status": "ready", "parent_id": "t_parent",
                "body": action["body"], "assignee": None, "comments": [],
            },
        }
        commands = []

        def runner(command):
            commands.append(command)
            args = command[2:]
            if args[0] == "create":
                return subprocess.CompletedProcess(command, 0, json.dumps(tasks["t_child"]), "")
            if args[0] == "show":
                return subprocess.CompletedProcess(command, 0, json.dumps(tasks[args[1]]), "")
            if args[0] == "assign":
                tasks[args[1]]["assignee"] = args[2]
                return subprocess.CompletedProcess(command, 0, "ok", "")
            return subprocess.CompletedProcess(command, 1, "", "unexpected")

        receipt = HermesKanbanCLI(runner=runner).perform(action)

        self.assertEqual(receipt["task_id"], "t_child")
        self.assertEqual(tasks["t_child"]["assignee"], "codex-coding")
        self.assertEqual(len([command for command in commands if command[2] == "assign"]), 1)

    def test_next_candidate_state_filter_has_independent_cursor(self):
        cursor = Path(self.temp.name) / "lifecycle-cursor.json"
        self.ledger.append(
            idempotency_key="feedback-only", source_id="source-feedback", task_id="t_feedback",
            state="feedback", pr=1, head_sha=HEAD, timestamp="2026-08-23T20:00:00Z",
        )
        smoke_states = [
            "feedback", "implementing", "testing", "review", "approved", "merged_develop",
            "promotion", "merged_main", "deploying", "deployed", "smoke_passed",
        ]
        for index, state in enumerate(smoke_states):
            self.ledger.append(
                idempotency_key=f"smoke-{state}", source_id="source-smoke", task_id="t_smoke",
                state=state, pr=2, head_sha=NEXT_HEAD, timestamp=f"2026-08-23T21:{index:02d}:00Z",
            )

        filtered = select_next_candidate(self.ledger, cursor, required_state="smoke_passed")
        unfiltered = select_next_candidate(self.ledger, cursor)
        empty = select_next_candidate(self.ledger, cursor, required_state="learned")

        self.assertEqual(filtered["candidate"]["task_id"], "t_smoke")
        self.assertEqual(filtered["filter_state"], "smoke_passed")
        self.assertEqual(unfiltered["candidate"]["task_id"], "t_feedback")
        self.assertEqual(empty["count"], 0)
        self.assertIsNone(empty["candidate"])

    def test_concurrent_next_processes_claim_distinct_round_robin_slots(self):
        cursor = Path(self.temp.name) / "concurrent-cursor.json"
        for index in range(2):
            self.ledger.append(
                idempotency_key=f"concurrent-{index}", source_id=f"source-{index}", task_id=f"t_{index}",
                state="feedback", pr=index + 1, head_sha=HEAD,
                timestamp=f"2026-08-23T20:0{index}:00Z",
            )
        command = [
            sys.executable,
            str(Path(lifecycle_module.__file__)),
            "next",
            "--ledger",
            str(self.ledger_path),
            "--cursor-state",
            str(cursor),
        ]
        processes = [
            subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            for _ in range(2)
        ]
        results = []
        for process in processes:
            stdout, stderr = process.communicate(timeout=10)
            self.assertEqual(process.returncode, 0, stderr)
            results.append(json.loads(stdout))

        self.assertEqual({result["candidate"]["task_id"] for result in results}, {"t_0", "t_1"})

    def test_review_bootstrap_creates_separate_release_tracker(self):
        action = release_tracker_action("t_implementation", 42, HEAD)
        self.assertEqual(action["idempotency_key"], "radulator-release:t_implementation:pr-42")
        self.assertEqual(action["parent_task_id"], "t_implementation")
        self.assertEqual(action["head_sha"], HEAD)
        self.assertIn("deployment smoke", action["body"])
        self.assertNotIn("attachment", json.dumps(action).lower())


if __name__ == "__main__":
    unittest.main()
