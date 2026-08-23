import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from ops.hermes.radulator.lifecycle_controller import (
    LedgerError,
    HermesKanbanCLI,
    LifecycleLedger,
    actions_for_event,
    execute_actions,
)


HEAD = "a" * 40


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

    def test_needs_fix_requeues_exact_sha_without_attachments(self):
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
        self.assertNotIn("attachment", json.dumps(child).lower())
        self.assertEqual(actions, actions_for_event(needs_fix))

        resumed = self.ledger.append(
            idempotency_key="resume-comment-991",
            source_id="feedback-17",
            task_id="t_parent",
            state="implementing",
            pr=42,
            head_sha=HEAD,
            evidence={"prerequisite_change_id": "child-created:t_rework"},
        )
        self.assertEqual(resumed.state, "implementing")

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
                    "id": "t_child", "status": "open", "parent_id": args[args.index("--parent") + 1], "comments": [],
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
        comment_commands = [command for command in commands if command[2] == "comment"]
        self.assertEqual(len(comment_commands), 2)

        execute_actions(actions_for_event(event), HermesKanbanCLI(runner=runner))
        comment_commands = [command for command in commands if command[2] == "comment"]
        self.assertEqual(len(comment_commands), 2, "authoritative readback prevents duplicate comments")


if __name__ == "__main__":
    unittest.main()
