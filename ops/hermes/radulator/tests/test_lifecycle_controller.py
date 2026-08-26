import hashlib
import json
import subprocess
import sys
import tempfile
import time
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

    def make_last_blocked_record_legacy(self):
        records = [json.loads(line) for line in self.ledger_path.read_text().splitlines()]
        legacy_blocked = records[-1]
        self.assertEqual(legacy_blocked["state"], "blocked")
        legacy_blocked["evidence"].pop("resume_state", None)
        unhashed = dict(legacy_blocked)
        unhashed.pop("event_hash")
        legacy_blocked["event_hash"] = lifecycle_module._event_hash(unhashed)
        self.ledger_path.write_text("\n".join(
            json.dumps(record, sort_keys=True, separators=(",", ":")) for record in records
        ) + "\n")

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
        self.assertEqual([item["kind"] for item in actions], ["create_prerequisite", "comment"])
        child = actions[0]
        self.assertEqual(child["tracker_task_id"], "t_parent")
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

    def test_needs_fix_rework_is_a_runnable_prerequisite_not_a_tracker_child(self):
        self.append("feedback", 0)
        self.append("implementing", 1)
        self.append("testing", 2)
        self.append("review", 3)
        event = self.append(
            "needs_fix",
            4,
            {"verdict_id": "comment-991", "reason": "Fix citation."},
        )

        action = actions_for_event(event)[0]

        self.assertEqual(action["kind"], "create_prerequisite")
        self.assertEqual(action["tracker_task_id"], "t_parent")
        self.assertNotIn("parent_task_id", action)

    def test_existing_deadlocked_rework_edge_is_reversed_and_promoted_once(self):
        self.append("feedback", 0)
        self.append("implementing", 1)
        self.append("testing", 2)
        self.append("review", 3)
        event = self.append(
            "needs_fix",
            4,
            {"verdict_id": "comment-991", "reason": "Fix citation."},
        )
        action = actions_for_event(event)[0]
        tasks = {
            "t_parent": {
                "task": {"id": "t_parent", "status": "todo"},
                "parents": ["t_valid_decomposed_prerequisite"],
            },
            "t_child": {
                "task": {
                    "id": "t_child",
                    "status": "todo",
                    "body": action["body"],
                    "assignee": "codex-coding",
                },
                "parents": ["t_parent"],
            },
        }
        commands = []

        def runner(command):
            commands.append(command)
            args = command[2:]
            if args[0] == "create":
                self.assertNotIn("--parent", args)
                return subprocess.CompletedProcess(
                    command, 0, json.dumps(tasks["t_child"]), "",
                )
            if args[0] == "show":
                return subprocess.CompletedProcess(
                    command, 0, json.dumps(tasks[args[1]]), "",
                )
            if args[0] == "unlink":
                parent_id, child_id = args[1:3]
                tasks[child_id]["parents"].remove(parent_id)
                return subprocess.CompletedProcess(command, 0, "ok", "")
            if args[0] == "link":
                parent_id, child_id = args[1:3]
                tasks[child_id]["parents"].append(parent_id)
                return subprocess.CompletedProcess(command, 0, "ok", "")
            if args[0] == "promote":
                tasks[args[1]]["task"]["status"] = "ready"
                return subprocess.CompletedProcess(command, 0, json.dumps({"ok": True}), "")
            return subprocess.CompletedProcess(command, 1, "", "unexpected")

        adapter = HermesKanbanCLI(runner=runner)
        receipt = adapter.perform(action)
        replayed = adapter.perform(action)

        self.assertEqual(receipt["kind"], "create_prerequisite")
        self.assertEqual(replayed["task_id"], receipt["task_id"])
        self.assertEqual(tasks["t_child"]["parents"], [])
        self.assertEqual(tasks["t_child"]["task"]["status"], "ready")
        self.assertEqual(
            tasks["t_parent"]["parents"],
            ["t_valid_decomposed_prerequisite", "t_child"],
        )
        self.assertEqual(
            [command[2] for command in commands].count("unlink"),
            1,
        )
        self.assertEqual(
            [command[2] for command in commands].count("link"),
            1,
        )
        self.assertEqual(
            [command[2] for command in commands].count("promote"),
            1,
        )

    def test_terminal_needs_fix_prerequisite_gets_one_open_versioned_replacement(self):
        self.append("feedback", 0)
        self.append("implementing", 1)
        self.append("testing", 2)
        self.append("review", 3)
        event = self.append(
            "needs_fix",
            4,
            {"verdict_id": "comment-terminal", "reason": "Fix exact citation."},
        )
        action = actions_for_event(event)[0]
        repair_key = action["idempotency_key"] + ":repair:t_terminal"
        tasks = {
            "t_parent": {
                "task": {"id": "t_parent", "status": "archived"},
                "parents": ["t_unrelated_tracker_prerequisite"],
            },
            "t_terminal": {
                "task": {
                    "id": "t_terminal",
                    "status": "done",
                    "body": action["body"],
                    "assignee": "codex-coding",
                },
                "parents": [],
            },
            "t_replacement": {
                "task": {
                    "id": "t_replacement",
                    "status": "todo",
                    "body": "replacement awaiting verified recovery instruction",
                    "assignee": "codex-coding",
                },
                "comments": [],
                "parents": ["t_unrelated_rework_prerequisite"],
            },
        }
        commands = []

        def runner(command):
            commands.append(command)
            args = command[2:]
            if args[0] == "create":
                key = args[args.index("--idempotency-key") + 1]
                if key == action["idempotency_key"]:
                    task_id = "t_terminal"
                elif key == repair_key:
                    task_id = "t_replacement"
                else:
                    return subprocess.CompletedProcess(command, 1, "", "unexpected key")
                return subprocess.CompletedProcess(
                    command, 0, json.dumps(tasks[task_id]), "",
                )
            if args[0] == "show":
                return subprocess.CompletedProcess(
                    command, 0, json.dumps(tasks[args[1]]), "",
                )
            if args[0] == "comment":
                tasks[args[1]].setdefault("comments", []).append({"body": args[2]})
                return subprocess.CompletedProcess(command, 0, "ok", "")
            if args[0] == "assign":
                tasks[args[1]]["task"]["assignee"] = args[2]
                return subprocess.CompletedProcess(command, 0, "ok", "")
            if args[0] == "link":
                parent_id, child_id = args[1:3]
                tasks[child_id]["parents"].append(parent_id)
                return subprocess.CompletedProcess(command, 0, "ok", "")
            if args[0] == "promote":
                tasks[args[1]]["task"]["status"] = "ready"
                return subprocess.CompletedProcess(
                    command, 0, json.dumps({"ok": True}), "",
                )
            return subprocess.CompletedProcess(command, 1, "", "unexpected")

        adapter = HermesKanbanCLI(runner=runner)
        first = adapter.perform(action)
        replayed = adapter.perform(action)

        self.assertEqual(first["task_id"], "t_replacement")
        self.assertEqual(replayed["task_id"], "t_replacement")
        self.assertEqual(first["status"], "ready")
        self.assertEqual(first["superseded_task_ids"], ["t_terminal"])
        self.assertEqual(first["idempotency_key"], repair_key)
        self.assertIn("t_terminal", json.dumps(tasks["t_replacement"]))
        self.assertEqual(
            tasks["t_parent"]["parents"],
            ["t_unrelated_tracker_prerequisite", "t_replacement"],
        )
        self.assertEqual(
            tasks["t_replacement"]["parents"],
            ["t_unrelated_rework_prerequisite"],
        )
        self.assertEqual(tasks["t_terminal"]["parents"], [])
        self.assertEqual([cmd[2] for cmd in commands].count("link"), 1)
        self.assertEqual([cmd[2] for cmd in commands].count("promote"), 1)

    def test_blocked_smoke_phase_resumes_exactly_and_completes_learning(self):
        states = [
            "feedback", "implementing", "testing", "review", "approved",
            "merged_develop", "promotion", "merged_main", "deploying",
            "deployed", "smoke_passed",
        ]
        for index, state in enumerate(states):
            self.append(state, index)

        blocked = self.append("blocked", 20, {"reason": "temporary Kanban readback failure"})
        self.assertEqual(blocked.evidence["resume_state"], "smoke_passed")
        with self.assertRaisesRegex(LedgerError, "resume.*smoke_passed"):
            self.append("learned", 21)

        resumed = self.append("smoke_passed", 22, {"proof": "smoke readback recovered"})
        learned = self.append("learned", 23)
        completed = self.append("complete", 24)
        self.assertEqual(resumed.state, "smoke_passed")
        self.assertEqual(learned.state, "learned")
        self.assertEqual(completed.state, "complete")

    def test_blocked_learning_phase_resumes_exactly_before_completion(self):
        states = [
            "feedback", "implementing", "testing", "review", "approved",
            "merged_develop", "promotion", "merged_main", "deploying",
            "deployed", "smoke_passed", "learned",
        ]
        for index, state in enumerate(states):
            self.append(state, index)

        blocked = self.append("blocked", 20, {"reason": "terminal receipt temporarily unavailable"})
        self.assertEqual(blocked.evidence["resume_state"], "learned")
        with self.assertRaisesRegex(LedgerError, "resume.*learned"):
            self.append("complete", 21)

        self.append("learned", 22, {"proof": "terminal readback recovered"})
        completed = self.append("complete", 23)
        self.assertEqual(completed.state, "complete")

    def test_duplicate_blocked_event_remains_idempotent(self):
        self.append("feedback", 0)
        first = self.append("blocked", 1, {"reason": "temporary external failure"})
        duplicate = self.append("blocked", 1, {"reason": "temporary external failure"})

        self.assertEqual(first.event_hash, duplicate.event_hash)
        self.assertEqual(first.evidence["resume_state"], "feedback")
        self.assertEqual(len(self.ledger_path.read_text().splitlines()), 2)

    def test_legacy_blocked_event_recovers_to_derived_prior_phase(self):
        states = [
            "feedback", "implementing", "testing", "review", "approved",
            "merged_develop", "promotion", "merged_main", "deploying",
            "deployed", "smoke_passed",
        ]
        for index, state in enumerate(states):
            self.append(state, index)
        self.append("blocked", 20, {"reason": "legacy transient failure"})

        self.make_last_blocked_record_legacy()

        replay = LifecycleLedger(self.ledger_path).replay()
        self.assertEqual(replay.blocked_resume_by_task["t_parent"], "smoke_passed")
        resumed = LifecycleLedger(self.ledger_path).append(
            idempotency_key="legacy-resume",
            source_id="feedback-17",
            task_id="t_parent",
            state="smoke_passed",
            pr=42,
            head_sha=HEAD,
            evidence={"proof": "legacy phase derived"},
            timestamp="2026-08-23T20:22:00Z",
        )
        self.assertEqual(resumed.state, "smoke_passed")

    def test_legacy_blocked_event_allows_one_valid_direct_advance(self):
        for index, state in enumerate(["feedback", "implementing", "testing", "review"]):
            self.append(state, index)
        self.append("blocked", 20, {"reason": "legacy review handoff failure"})
        self.make_last_blocked_record_legacy()

        advanced = LifecycleLedger(self.ledger_path).append(
            idempotency_key="legacy-review-needs-fix",
            source_id="feedback-17",
            task_id="t_parent",
            state="needs_fix",
            pr=42,
            head_sha=HEAD,
            evidence={"verdict_id": "comment-legacy", "reason": "Correction required."},
            timestamp="2026-08-23T20:21:00Z",
        )
        self.assertEqual(advanced.state, "needs_fix")

    def test_legacy_blocked_event_still_rejects_skipped_phases(self):
        for index, state in enumerate(["feedback", "implementing", "testing", "review"]):
            self.append(state, index)
        self.append("blocked", 20, {"reason": "legacy review handoff failure"})
        self.make_last_blocked_record_legacy()

        with self.assertRaisesRegex(LedgerError, "transition"):
            LifecycleLedger(self.ledger_path).append(
                idempotency_key="legacy-review-skips-to-main",
                source_id="feedback-17",
                task_id="t_parent",
                state="merged_main",
                pr=42,
                head_sha=HEAD,
                evidence={"proof": "must not skip approval"},
                timestamp="2026-08-23T20:21:00Z",
            )

    def test_promotion_may_return_to_review_before_main_approval(self):
        states = [
            "feedback", "implementing", "testing", "review", "approved",
            "merged_develop", "promotion", "review", "approved", "merged_main",
        ]
        for index, state in enumerate(states):
            self.append(state, index)

        replay = self.ledger.replay()
        self.assertEqual(replay.current_by_task["t_parent"].state, "merged_main")

    def test_kanban_adapter_is_idempotent_and_verifies_readback(self):
        self.append("feedback", 0)
        self.append("implementing", 1)
        self.append("testing", 2)
        self.append("review", 3)
        event = self.append("needs_fix", 4, {"verdict_id": "comment-991", "reason": "Fix citation."})
        tasks = {
            "t_parent": {
                "task": {"id": "t_parent", "status": "todo"},
                "parents": [],
                "comments": [],
            },
        }
        commands = []

        def runner(command):
            commands.append(command)
            args = command[2:]
            if args[0] == "create":
                child = tasks.setdefault("t_child", {
                    "task": {
                        "id": "t_child",
                        "status": "todo",
                        "body": args[args.index("--body") + 1],
                        "assignee": args[args.index("--assignee") + 1],
                        "priority": int(args[args.index("--priority") + 1]),
                        "max_runtime": args[args.index("--max-runtime") + 1],
                        "created_by": args[args.index("--created-by") + 1],
                    },
                    "parents": [],
                    "comments": [],
                })
                return subprocess.CompletedProcess(command, 0, json.dumps(child), "")
            if args[0] == "show":
                return subprocess.CompletedProcess(command, 0, json.dumps(tasks[args[1]]), "")
            if args[0] == "link":
                parent_id, child_id = args[1:3]
                tasks[child_id]["parents"].append(parent_id)
                return subprocess.CompletedProcess(command, 0, "ok", "")
            if args[0] == "promote":
                tasks[args[1]]["task"]["status"] = "ready"
                return subprocess.CompletedProcess(command, 0, json.dumps({"ok": True}), "")
            if args[0] == "comment":
                tasks[args[1]]["comments"].append({"body": args[2]})
                return subprocess.CompletedProcess(command, 0, "ok", "")
            return subprocess.CompletedProcess(command, 1, "", "unexpected")

        receipts = execute_actions(actions_for_event(event), HermesKanbanCLI(runner=runner))
        self.assertEqual([receipt["kind"] for receipt in receipts], ["create_prerequisite", "comment"])
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

    def test_kanban_adapter_ignores_nested_duplicate_relation_records(self):
        action = {
            "kind": "create_prerequisite",
            "idempotency_key": "nested-relation-authority",
            "tracker_task_id": "t_parent",
            "title": "Restore exact relation authority",
            "body": "Link this prerequisite to the exact tracker root.",
            "assignee": "radulator",
        }
        tasks = {
            "t_parent": {
                "task": {
                    "id": "t_parent",
                    "status": "archived",
                    "body": "release tracker",
                    "parents": [],
                },
                "parents": [],
                "history": [{
                    "id": "t_parent",
                    "status": "archived",
                    "parents": ["t_prerequisite"],
                }],
            },
        }
        commands = []

        def runner(command):
            commands.append(command)
            args = command[2:]
            if args[0] == "create":
                tasks["t_prerequisite"] = {
                    "task": {
                        "id": "t_prerequisite",
                        "status": "ready",
                        "body": action["body"],
                        "assignee": "radulator",
                        "parents": [],
                    },
                    "parents": [],
                }
                return subprocess.CompletedProcess(
                    command, 0, json.dumps(tasks["t_prerequisite"]), "",
                )
            if args[0] == "show":
                return subprocess.CompletedProcess(
                    command, 0, json.dumps(tasks[args[1]]), "",
                )
            if args[0] == "link":
                parent_id, child_id = args[1:3]
                tasks[child_id]["parents"].append(parent_id)
                tasks[child_id]["task"]["parents"].append(parent_id)
                return subprocess.CompletedProcess(command, 0, "ok", "")
            return subprocess.CompletedProcess(command, 1, "", "unexpected")

        receipt = HermesKanbanCLI(runner=runner).perform(action)

        self.assertEqual(receipt["task_id"], "t_prerequisite")
        self.assertEqual(tasks["t_parent"]["parents"], ["t_prerequisite"])
        self.assertEqual([command[2] for command in commands].count("link"), 1)

    def test_kanban_create_uses_top_level_task_instead_of_nested_history_id(self):
        action = {
            "kind": "create_prerequisite",
            "idempotency_key": "exact-create-response-authority",
            "tracker_task_id": "t_parent",
            "title": "Use the exact created task",
            "body": "Bind this instruction only to the exact created task.",
            "assignee": "radulator",
        }
        tasks = {
            "t_created": {
                "task": {
                    "id": "t_created",
                    "status": "ready",
                    "body": action["body"],
                    "assignee": "radulator",
                    "parents": [],
                },
                "parents": [],
                "comments": [],
            },
            "t_victim": {
                "task": {
                    "id": "t_victim",
                    "status": "ready",
                    "body": "Unrelated historical task.",
                    "assignee": "someone-else",
                    "parents": [],
                },
                "parents": [],
                "comments": [],
            },
            "t_parent": {
                "task": {
                    "id": "t_parent",
                    "status": "archived",
                    "body": "release tracker",
                    "parents": [],
                },
                "parents": [],
                "comments": [],
            },
        }
        mutations = []

        def runner(command):
            args = command[2:]
            if args[0] == "create":
                return subprocess.CompletedProcess(command, 0, json.dumps({
                    "history": [{"id": "t_victim"}],
                    "task": {"id": "t_created"},
                }), "")
            if args[0] == "show":
                return subprocess.CompletedProcess(
                    command, 0, json.dumps(tasks[args[1]]), "",
                )
            if args[0] == "link":
                parent_id, child_id = args[1:3]
                mutations.append(("link", parent_id, child_id))
                tasks[child_id]["parents"].append(parent_id)
                tasks[child_id]["task"]["parents"].append(parent_id)
                return subprocess.CompletedProcess(command, 0, "ok", "")
            if args[0] in {"comment", "assign"}:
                mutations.append((args[0], args[1]))
                return subprocess.CompletedProcess(command, 0, "ok", "")
            return subprocess.CompletedProcess(command, 1, "", "unexpected")

        receipt = HermesKanbanCLI(runner=runner).perform(action)

        self.assertEqual(receipt["task_id"], "t_created")
        self.assertEqual(mutations, [("link", "t_created", "t_parent")])

    def test_kanban_adapter_rejects_status_found_only_in_nested_duplicate(self):
        action = {
            "kind": "create_prerequisite",
            "idempotency_key": "nested-status-authority",
            "tracker_task_id": "t_parent",
            "title": "Reject nested status authority",
            "body": "Only the exact task root may authorize status.",
            "assignee": "radulator",
        }
        prerequisite = {
            "task": {
                "id": "t_prerequisite",
                "body": action["body"],
                "assignee": "radulator",
                "parents": [],
            },
            "parents": [],
            "history": [{"id": "t_prerequisite", "status": "ready"}],
        }

        def runner(command):
            args = command[2:]
            if args[0] == "create" or (
                args[0] == "show" and args[1] == "t_prerequisite"
            ):
                return subprocess.CompletedProcess(
                    command, 0, json.dumps(prerequisite), "",
                )
            return subprocess.CompletedProcess(command, 1, "", "unexpected mutation")

        with self.assertRaisesRegex(LedgerError, "status readback is missing"):
            HermesKanbanCLI(runner=runner).perform(action)

    def test_completion_rejects_nested_terminal_status_before_mutation(self):
        action = {
            "kind": "complete",
            "idempotency_key": "exact-terminal-status-only",
            "task_id": "t_parent",
            "result": "released",
            "summary": "Exact authority required.",
        }
        readback = {
            "task": {"id": "t_parent", "body": "release tracker"},
            "history": [{"id": "t_parent", "status": "archived"}],
        }
        commands = []

        def runner(command):
            commands.append(command)
            args = command[2:]
            if args[0] == "show":
                return subprocess.CompletedProcess(command, 0, json.dumps(readback), "")
            if args[0] == "complete":
                return subprocess.CompletedProcess(command, 0, "ok", "")
            return subprocess.CompletedProcess(command, 1, "", "unexpected")

        with self.assertRaisesRegex(LedgerError, "status readback is missing"):
            HermesKanbanCLI(runner=runner).perform(action)

        self.assertEqual([command[2] for command in commands], ["show"])

    def test_learning_child_is_assigned_to_radulator_profile(self):
        states = [
            "feedback", "implementing", "testing", "review", "approved",
            "merged_develop", "promotion", "merged_main", "deploying",
            "deployed", "smoke_passed",
        ]
        for index, state in enumerate(states):
            event = self.append(state, index)

        action = actions_for_event(event)[0]

        self.assertEqual(action["kind"], "create_prerequisite")
        self.assertEqual(action["tracker_task_id"], "t_parent")
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

        with self.assertRaisesRegex(LedgerError, "unsupported status"):
            HermesKanbanCLI(runner=runner).perform(action)

        self.assertEqual([command[2] for command in commands], ["show"])

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
            "t_parent": {
                "task": {"id": "t_parent", "status": "todo"},
                "parents": [],
            },
            "t_child": {
                "task": {
                    "id": "t_child", "status": "ready",
                    "body": action["body"], "assignee": None,
                },
                "parents": [],
                "comments": [],
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
                tasks[args[1]]["task"]["assignee"] = args[2]
                return subprocess.CompletedProcess(command, 0, "ok", "")
            if args[0] == "link":
                parent_id, child_id = args[1:3]
                tasks[child_id]["parents"].append(parent_id)
                return subprocess.CompletedProcess(command, 0, "ok", "")
            return subprocess.CompletedProcess(command, 1, "", "unexpected")

        receipt = HermesKanbanCLI(runner=runner).perform(action)

        self.assertEqual(receipt["task_id"], "t_child")
        self.assertEqual(tasks["t_child"]["task"]["assignee"], "codex-coding")
        self.assertEqual(len([command for command in commands if command[2] == "assign"]), 1)

    def test_prerequisite_readback_ignores_historical_body_and_assignee_events(self):
        action = {
            "kind": "create_prerequisite",
            "idempotency_key": "exact-task-fields",
            "tracker_task_id": "t_parent",
            "title": "Retain learning",
            "body": "Current exact prerequisite instruction.",
            "assignee": "radulator",
        }
        tasks = {
            "t_parent": {
                "task": {"id": "t_parent", "status": "todo", "body": "tracker"},
                "parents": ["t_child"],
            },
            "t_child": {
                "task": {
                    "id": "t_child",
                    "status": "ready",
                    "body": "Stale task body that must not pass readback.",
                    "assignee": "default",
                },
                "parents": [],
                "comments": [],
                "events": [{
                    "payload": {
                        "body": action["body"],
                        "assignee": action["assignee"],
                    },
                }],
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
            if args[0] == "comment":
                tasks[args[1]]["comments"].append({"body": args[2]})
                return subprocess.CompletedProcess(command, 0, "ok", "")
            if args[0] == "assign":
                tasks[args[1]]["task"]["assignee"] = args[2]
                return subprocess.CompletedProcess(command, 0, "ok", "")
            return subprocess.CompletedProcess(command, 1, "", "unexpected")

        receipt = HermesKanbanCLI(runner=runner).perform(action)

        self.assertEqual(receipt["status"], "ready")
        self.assertEqual(tasks["t_child"]["task"]["assignee"], "radulator")
        self.assertEqual(tasks["t_child"]["comments"], [{"body": action["body"]}])
        self.assertEqual([command[2] for command in commands].count("assign"), 1)
        self.assertEqual([command[2] for command in commands].count("comment"), 1)

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

    def test_reconciliation_bootstraps_missing_meld_and_kbrc_only_to_feedback(self):
        self.assertTrue(
            callable(getattr(lifecycle_module, "reconcile_trackers", None)),
            "lifecycle reconciliation entrypoint must exist",
        )
        tasks = {
            "t_f60ac506": {
                "task": {
                    "id": "t_f60ac506",
                    "status": "blocked",
                    "title": "Track clinical release of Radulator PR #81",
                    "body": "MELD tracker with no authoritative PR/head mapping",
                },
                "parents": [],
            },
            "t_56c8fd34": {
                "task": {
                    "id": "t_56c8fd34",
                    "status": "blocked",
                    "title": "Track clinical release of Radulator PR #148",
                    "body": "KBRC tracker with no authoritative PR/head mapping",
                },
                "parents": [],
            },
            "t_1630667d": {
                "task": {
                    "id": "t_1630667d",
                    "status": "done",
                    "body": "Receipt digest: " + "1" * 64,
                },
                "parents": [],
            },
        }

        class Adapter:
            def show(self, task_id):
                return tasks[task_id]

            def perform(self, _action):
                self.fail("bootstrap must not perform Kanban actions")

        spec = {
            "schema": "radulator-lifecycle-reconciliation/v1",
            "review_id": "state-audit-2026-08-25",
            "trackers": [
                {
                    "task_id": "t_f60ac506",
                    "source_id": "meld-source",
                    "source": {
                        "kind": "kanban_task",
                        "task_id": "t_f60ac506",
                    },
                },
                {
                    "task_id": "t_56c8fd34",
                    "source_id": "kbrc-formspree",
                    "source": {
                        "kind": "formspree_receipt",
                        "task_id": "t_1630667d",
                        "digest": "1" * 64,
                    },
                },
            ],
        }

        planned = lifecycle_module.reconcile_trackers(
            self.ledger,
            spec,
            Adapter(),
            apply=False,
        )
        self.assertEqual(
            planned["planned_bootstrap"],
            ["t_f60ac506", "t_56c8fd34"],
        )
        self.assertEqual(len(self.ledger.replay().events), 0)

        first = lifecycle_module.reconcile_trackers(
            self.ledger,
            spec,
            Adapter(),
            apply=True,
        )
        second = lifecycle_module.reconcile_trackers(
            self.ledger,
            spec,
            Adapter(),
            apply=True,
        )

        self.assertEqual(
            first["bootstrapped"],
            ["t_f60ac506", "t_56c8fd34"],
        )
        self.assertEqual(
            second["already_reconciled"],
            ["t_f60ac506", "t_56c8fd34"],
        )
        replay = self.ledger.replay()
        self.assertEqual(len(replay.events), 2)
        self.assertEqual(
            {event.task_id: event.state for event in replay.events},
            {"t_f60ac506": "feedback", "t_56c8fd34": "feedback"},
        )
        self.assertIsNone(replay.current_by_task["t_f60ac506"].pr)
        self.assertIsNone(replay.current_by_task["t_f60ac506"].head_sha)
        self.assertNotIn(
            "base_sha",
            replay.current_by_task["t_f60ac506"].evidence,
        )

    def test_reconciliation_rejects_incomplete_or_unreadable_authority(self):
        self.assertTrue(
            callable(getattr(lifecycle_module, "reconcile_trackers", None)),
            "lifecycle reconciliation entrypoint must exist",
        )

        class Adapter:
            def show(self, task_id):
                return {
                    "task": {
                        "id": task_id,
                        "status": "done",
                        "body": "wrong receipt digest",
                    },
                    "parents": [],
                }

        incomplete = {
            "schema": "radulator-lifecycle-reconciliation/v1",
            "review_id": "audit",
            "trackers": [{
                "task_id": "t_missing",
                "source_id": "source",
                "source": {
                    "kind": "formspree_receipt",
                    "task_id": "t_receipt",
                    "digest": "1" * 64,
                },
                "pr": 81,
                "head_sha": HEAD,
            }],
        }

        with self.assertRaisesRegex(LedgerError, "base_sha"):
            lifecycle_module.reconcile_trackers(
                self.ledger,
                incomplete,
                Adapter(),
                apply=True,
            )

        unreadable = json.loads(json.dumps(incomplete))
        unreadable["trackers"][0]["base_sha"] = NEXT_HEAD
        with self.assertRaisesRegex(LedgerError, "receipt digest"):
            lifecycle_module.reconcile_trackers(
                self.ledger,
                unreadable,
                Adapter(),
                apply=True,
            )

        authority_without_base_readback = {
            "schema": "radulator-lifecycle-reconciliation/v1",
            "review_id": "audit",
            "trackers": [{
                "task_id": "t_missing",
                "source_id": "source",
                "source": {"kind": "kanban_task", "task_id": "t_source"},
                "pr": 81,
                "head_sha": HEAD,
                "base_sha": NEXT_HEAD,
            }],
        }

        class MissingBaseAdapter:
            def show(self, task_id):
                return {
                    "task": {
                        "id": task_id,
                        "status": "blocked" if task_id == "t_missing" else "done",
                        "body": "PR #81 exact head " + HEAD,
                    },
                    "parents": [],
                }

        with self.assertRaisesRegex(LedgerError, "base SHA"):
            lifecycle_module.reconcile_trackers(
                self.ledger,
                authority_without_base_readback,
                MissingBaseAdapter(),
                apply=True,
            )

        self.assertEqual(len(self.ledger.replay().events), 0)

    def test_reconciliation_preflights_every_entry_before_any_apply(self):
        tasks = {
            "t_first": {
                "task": {"id": "t_first", "status": "blocked", "body": "first"},
                "parents": [],
            },
            "t_first_source": {
                "task": {"id": "t_first_source", "status": "done", "body": "source"},
                "parents": [],
            },
            "t_second": {
                "task": {"id": "t_second", "status": "blocked", "body": "second"},
                "parents": [],
            },
            "t_second_receipt": {
                "task": {
                    "id": "t_second_receipt",
                    "status": "done",
                    "body": "wrong receipt digest",
                },
                "parents": [],
            },
        }

        class Adapter:
            def show(self, task_id):
                return tasks[task_id]

            def perform(self, _action):
                raise AssertionError("failed preflight must not mutate Kanban")

        spec = {
            "schema": "radulator-lifecycle-reconciliation/v1",
            "review_id": "atomic-preflight-audit",
            "trackers": [
                {
                    "task_id": "t_first",
                    "source_id": "first-source",
                    "source": {"kind": "kanban_task", "task_id": "t_first_source"},
                },
                {
                    "task_id": "t_second",
                    "source_id": "second-source",
                    "source": {
                        "kind": "formspree_receipt",
                        "task_id": "t_second_receipt",
                        "digest": "1" * 64,
                    },
                },
            ],
        }

        with self.assertRaisesRegex(LedgerError, "receipt digest"):
            lifecycle_module.reconcile_trackers(
                self.ledger,
                spec,
                Adapter(),
                apply=True,
            )

        self.assertEqual(self.ledger.replay().events, ())

    def test_reconciliation_rejects_tracker_found_only_in_nested_child(self):
        tasks = {
            "t_tracker": {
                "task": {
                    "id": "t_unrelated",
                    "status": "todo",
                    "body": "unrelated show result",
                },
                "children": [{
                    "id": "t_tracker",
                    "status": "todo",
                    "body": "nested historical tracker",
                }],
            },
            "t_source": {
                "task": {"id": "t_source", "status": "done", "body": "source"},
                "parents": [],
            },
        }

        class Adapter:
            def show(self, task_id):
                return tasks[task_id]

            def perform(self, _action):
                raise AssertionError("nested-only tracker must not mutate Kanban")

        spec = {
            "schema": "radulator-lifecycle-reconciliation/v1",
            "review_id": "nested-only-tracker-audit",
            "trackers": [{
                "task_id": "t_tracker",
                "source_id": "source",
                "source": {"kind": "kanban_task", "task_id": "t_source"},
            }],
        }

        with self.assertRaisesRegex(LedgerError, "exact task record"):
            lifecycle_module.reconcile_trackers(
                self.ledger, spec, Adapter(), apply=True,
            )
        self.assertEqual(self.ledger.replay().events, ())

    def test_reconciliation_rejects_source_found_only_in_nested_child(self):
        tasks = {
            "t_tracker": {
                "task": {"id": "t_tracker", "status": "todo", "body": "tracker"},
                "parents": [],
            },
            "t_source": {
                "task": {
                    "id": "t_unrelated",
                    "status": "done",
                    "body": "unrelated show result",
                },
                "children": [{
                    "id": "t_source",
                    "status": "done",
                    "body": "nested historical source",
                }],
            },
        }

        class Adapter:
            def show(self, task_id):
                return tasks[task_id]

            def perform(self, _action):
                raise AssertionError("nested-only source must not mutate Kanban")

        spec = {
            "schema": "radulator-lifecycle-reconciliation/v1",
            "review_id": "nested-only-source-audit",
            "trackers": [{
                "task_id": "t_tracker",
                "source_id": "source",
                "source": {"kind": "kanban_task", "task_id": "t_source"},
            }],
        }

        with self.assertRaisesRegex(LedgerError, "exact task record"):
            lifecycle_module.reconcile_trackers(
                self.ledger, spec, Adapter(), apply=True,
            )
        self.assertEqual(self.ledger.replay().events, ())

    def test_reconciliation_rejects_conflicting_root_and_top_level_task_authority(self):
        for index, state in enumerate((
            "feedback", "implementing", "testing", "review",
        )):
            self.append(state, index, {"base_sha": "c" * 40})
        self.append(
            "needs_fix",
            4,
            {
                "base_sha": "c" * 40,
                "verdict_id": "conflicting-task-authority",
                "reason": "Correct it.",
            },
        )

        class Adapter:
            def show(self, task_id):
                if task_id == "t_parent":
                    return {
                        "id": "t_parent",
                        "status": "archived",
                        "pr": 42,
                        "head_sha": HEAD,
                        "base_sha": "c" * 40,
                        "parents": [],
                        "task": {
                            "id": "t_parent",
                            "status": "ready",
                            "pr": 999,
                            "head_sha": NEXT_HEAD,
                            "base_sha": "d" * 40,
                            "parents": ["t_conflicting"],
                        },
                    }
                return {
                    "task": {"id": "t_source", "status": "done", "body": "source"},
                    "parents": [],
                }

            def perform(self, _action):
                raise AssertionError("ambiguous task authority must not mutate Kanban")

        spec = {
            "schema": "radulator-lifecycle-reconciliation/v1",
            "review_id": "conflicting-root-task-authority",
            "trackers": [{
                "task_id": "t_parent",
                "source_id": "feedback-17",
                "source": {"kind": "kanban_task", "task_id": "t_source"},
                "pr": 42,
                "head_sha": HEAD,
                "base_sha": "c" * 40,
            }],
        }

        with self.assertRaisesRegex(LedgerError, "ambiguous exact task"):
            lifecycle_module.reconcile_trackers(
                self.ledger, spec, Adapter(), apply=True,
            )

    def test_reconciliation_rejects_unsupported_exact_task_status(self):
        tasks = {
            "t_tracker": {
                "task": {
                    "id": "t_tracker",
                    "status": "not-a-kanban-status",
                    "body": "tracker",
                },
                "parents": [],
            },
            "t_source": {
                "task": {"id": "t_source", "status": "done", "body": "source"},
                "parents": [],
            },
        }

        class Adapter:
            def show(self, task_id):
                return tasks[task_id]

            def perform(self, _action):
                raise AssertionError("unsupported status must not mutate Kanban")

        spec = {
            "schema": "radulator-lifecycle-reconciliation/v1",
            "review_id": "canonical-kanban-status-audit",
            "trackers": [{
                "task_id": "t_tracker",
                "source_id": "source",
                "source": {"kind": "kanban_task", "task_id": "t_source"},
            }],
        }

        with self.assertRaisesRegex(LedgerError, "unsupported status"):
            lifecycle_module.reconcile_trackers(
                self.ledger, spec, Adapter(), apply=True,
            )
        self.assertEqual(self.ledger.replay().events, ())

    def test_reconciliation_rechecks_exact_lifecycle_snapshot_before_each_action(self):
        for index, state in enumerate((
            "feedback", "implementing", "testing", "review",
        )):
            self.append(state, index)
        self.append(
            "needs_fix",
            4,
            {
                "verdict_id": "stale-head-verdict",
                "reason": "Correct the old head.",
                "base_sha": "c" * 40,
            },
        )
        actions = []

        class Adapter:
            advanced = False

            def show(inner_self, task_id):
                if task_id == "t_parent" and not inner_self.advanced:
                    inner_self.advanced = True
                    self.ledger.append(
                        idempotency_key="concurrent-corrected-head",
                        source_id="feedback-17",
                        task_id="t_parent",
                        state="implementing",
                        pr=42,
                        head_sha=NEXT_HEAD,
                        evidence={"prerequisite_change_id": "correction-1"},
                        timestamp="2026-08-23T20:05:00Z",
                    )
                if task_id == "t_parent":
                    return {
                        "task": {
                            "id": task_id,
                            "status": "archived",
                            "pr": 42,
                            "head_sha": HEAD,
                            "base_sha": "c" * 40,
                            "body": "tracker",
                        },
                        "parents": [],
                    }
                return {
                    "task": {"id": task_id, "status": "done", "body": "source"},
                    "parents": [],
                }

            def perform(self, action):
                actions.append(action)
                return {"kind": action["kind"]}

        spec = {
            "schema": "radulator-lifecycle-reconciliation/v1",
            "review_id": "current-event-cas-audit",
            "trackers": [{
                "task_id": "t_parent",
                "source_id": "feedback-17",
                "source": {"kind": "kanban_task", "task_id": "t_source"},
                "pr": 42,
                "head_sha": HEAD,
                "base_sha": "c" * 40,
            }],
        }

        with self.assertRaisesRegex(LedgerError, "changed during reconciliation"):
            lifecycle_module.reconcile_trackers(
                self.ledger, spec, Adapter(), apply=True,
            )

        current = self.ledger.replay().current_by_task["t_parent"]
        self.assertEqual((current.state, current.head_sha), ("implementing", NEXT_HEAD))
        self.assertEqual(actions, [])

    def test_reconciliation_holds_authority_lease_across_external_action(self):
        for index, state in enumerate((
            "feedback", "implementing", "testing", "review",
        )):
            self.append(state, index)
        self.append(
            "needs_fix",
            4,
            {"verdict_id": "concurrent-lease-verdict", "reason": "Correct it."},
        )
        child_marker = Path(self.temp.name) / "concurrent-append-started"
        child_processes = []
        performed_actions = []

        class Adapter:
            concurrent_append_finished_during_action = None

            def show(inner_self, task_id):
                if task_id == "t_parent":
                    return {
                        "task": {
                            "id": task_id,
                            "status": "archived",
                            "body": "release tracker",
                        },
                        "parents": [],
                    }
                return {
                    "task": {"id": task_id, "status": "done", "body": "source"},
                    "parents": [],
                }

            def perform(inner_self, action):
                performed_actions.append(action["kind"])
                if child_processes:
                    return {"kind": action["kind"]}
                wrapper = (
                    "from pathlib import Path; import subprocess, sys; "
                    "Path(sys.argv[1]).write_text('started'); "
                    "raise SystemExit(subprocess.run(sys.argv[2:]).returncode)"
                )
                command = [
                    sys.executable,
                    "-c",
                    wrapper,
                    str(child_marker),
                    sys.executable,
                    str(Path(lifecycle_module.__file__)),
                    "append",
                    "--ledger",
                    str(self.ledger_path),
                    "--idempotency-key",
                    "concurrent-new-head-during-action",
                    "--source-id",
                    "feedback-17",
                    "--task-id",
                    "t_parent",
                    "--state",
                    "implementing",
                    "--pr",
                    "42",
                    "--head-sha",
                    NEXT_HEAD,
                    "--evidence-json",
                    json.dumps({"prerequisite_change_id": "correction-1"}),
                ]
                process = subprocess.Popen(
                    command,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                )
                child_processes.append(process)
                deadline = time.monotonic() + 5
                while not child_marker.exists() and time.monotonic() < deadline:
                    time.sleep(0.01)
                self.assertTrue(child_marker.exists(), "concurrent append did not start")
                time.sleep(0.2)
                inner_self.concurrent_append_finished_during_action = (
                    process.poll() is not None
                )
                return {"kind": action["kind"]}

        adapter = Adapter()
        spec = {
            "schema": "radulator-lifecycle-reconciliation/v1",
            "review_id": "external-action-authority-lease-audit",
            "trackers": [{
                "task_id": "t_parent",
                "source_id": "feedback-17",
                "source": {"kind": "kanban_task", "task_id": "t_source"},
            }],
        }

        result = lifecycle_module.reconcile_trackers(
            self.ledger, spec, adapter, apply=True,
        )
        for process in child_processes:
            stdout, stderr = process.communicate(timeout=5)
            self.assertEqual(process.returncode, 0, stderr or stdout)

        self.assertEqual(len(result["applied_actions"]), 2)
        self.assertEqual(performed_actions, ["create_prerequisite", "comment"])
        self.assertFalse(
            adapter.concurrent_append_finished_during_action,
            "a concurrent ledger append must block until the external action releases its authority lease",
        )
        current = self.ledger.replay().current_by_task["t_parent"]
        self.assertEqual((current.state, current.head_sha), ("implementing", NEXT_HEAD))

    def test_reconciliation_rejects_receipt_digest_prefix_of_longer_hex_token(self):
        digest = "1" * 64
        tasks = {
            "t_tracker": {
                "task": {"id": "t_tracker", "status": "todo", "body": "tracker"},
                "parents": [],
            },
            "t_receipt": {
                "task": {
                    "id": "t_receipt",
                    "status": "done",
                    "body": "Receipt digest: " + digest + "f",
                },
                "parents": [],
            },
        }

        class Adapter:
            def show(self, task_id):
                return tasks[task_id]

            def perform(self, _action):
                raise AssertionError("ambiguous receipt digest must not mutate Kanban")

        spec = {
            "schema": "radulator-lifecycle-reconciliation/v1",
            "review_id": "exact-receipt-digest-audit",
            "trackers": [{
                "task_id": "t_tracker",
                "source_id": "feedback-source",
                "source": {
                    "kind": "formspree_receipt",
                    "task_id": "t_receipt",
                    "digest": digest,
                },
            }],
        }

        with self.assertRaisesRegex(LedgerError, "receipt digest"):
            lifecycle_module.reconcile_trackers(
                self.ledger, spec, Adapter(), apply=True,
            )

        self.assertEqual(self.ledger.replay().events, ())

    def test_reconciliation_preflights_ledger_conflicts_before_any_apply(self):
        self.ledger.append(
            idempotency_key="existing-second",
            source_id="authoritative-second-source",
            task_id="t_second",
            state="feedback",
            timestamp="2026-08-23T20:00:00Z",
        )
        initial_events = self.ledger.replay().events
        tasks = {
            task_id: {
                "task": {"id": task_id, "status": "todo", "body": "readable"},
                "parents": [],
            }
            for task_id in (
                "t_first", "t_first_source", "t_second", "t_second_source",
            )
        }

        class Adapter:
            def show(self, task_id):
                return tasks[task_id]

            def perform(self, _action):
                raise AssertionError("failed frozen plan must not mutate Kanban")

        spec = {
            "schema": "radulator-lifecycle-reconciliation/v1",
            "review_id": "ledger-preflight-audit",
            "trackers": [
                {
                    "task_id": "t_first",
                    "source_id": "first-source",
                    "source": {"kind": "kanban_task", "task_id": "t_first_source"},
                },
                {
                    "task_id": "t_second",
                    "source_id": "conflicting-second-source",
                    "source": {"kind": "kanban_task", "task_id": "t_second_source"},
                },
            ],
        }

        with self.assertRaisesRegex(LedgerError, "source_id conflicts"):
            lifecycle_module.reconcile_trackers(
                self.ledger, spec, Adapter(), apply=True,
            )

        self.assertEqual(self.ledger.replay().events, initial_events)

    def test_reconciliation_preflights_later_idempotency_collision_before_append(self):
        collision_key = "reconcile:t_second:feedback:batch-collision-audit"
        self.ledger.append(
            idempotency_key=collision_key,
            source_id="unrelated-source",
            task_id="t_unrelated",
            state="feedback",
            timestamp="2026-08-23T20:00:00Z",
        )
        initial_bytes = self.ledger_path.read_bytes()
        tasks = {
            task_id: {
                "task": {"id": task_id, "status": "todo", "body": "readable"},
                "parents": [],
            }
            for task_id in (
                "t_first", "t_first_source", "t_second", "t_second_source",
            )
        }

        class Adapter:
            def show(self, task_id):
                return tasks[task_id]

            def perform(self, _action):
                raise AssertionError("semantic collision must not mutate Kanban")

        spec = {
            "schema": "radulator-lifecycle-reconciliation/v1",
            "review_id": "batch-collision-audit",
            "trackers": [
                {
                    "task_id": "t_first",
                    "source_id": "first-source",
                    "source": {"kind": "kanban_task", "task_id": "t_first_source"},
                },
                {
                    "task_id": "t_second",
                    "source_id": "second-source",
                    "source": {"kind": "kanban_task", "task_id": "t_second_source"},
                },
            ],
        }

        with self.assertRaisesRegex(LedgerError, "idempotency key"):
            lifecycle_module.reconcile_trackers(
                self.ledger, spec, Adapter(), apply=True,
            )

        self.assertEqual(self.ledger_path.read_bytes(), initial_bytes)

    def test_reconciliation_rejects_prefixed_pr_reference_before_bootstrap(self):
        tasks = {
            "t_tracker": {
                "task": {
                    "id": "t_tracker",
                    "status": "todo",
                    "body": "Track PR #169 at exact head " + HEAD + " base " + NEXT_HEAD,
                    "events": [{"payload": {"body": "Historical PR #16 mapping"}}],
                },
                "parents": [],
            },
            "t_source": {
                "task": {"id": "t_source", "status": "done", "body": "source"},
                "parents": [],
            },
        }

        class Adapter:
            def show(self, task_id):
                return tasks[task_id]

            def perform(self, _action):
                raise AssertionError("invalid PR binding must not mutate Kanban")

        spec = {
            "schema": "radulator-lifecycle-reconciliation/v1",
            "review_id": "exact-pr-audit",
            "trackers": [{
                "task_id": "t_tracker",
                "source_id": "source",
                "source": {"kind": "kanban_task", "task_id": "t_source"},
                "pr": 16,
                "head_sha": HEAD,
                "base_sha": NEXT_HEAD,
            }],
        }

        with self.assertRaisesRegex(LedgerError, "PR failed"):
            lifecycle_module.reconcile_trackers(
                self.ledger, spec, Adapter(), apply=True,
            )

        self.assertEqual(self.ledger.replay().events, ())

    def test_reconciliation_rejects_head_sha_prefix_of_longer_hex_token(self):
        tasks = {
            "t_tracker": {
                "task": {
                    "id": "t_tracker",
                    "status": "todo",
                    "body": (
                        "Track PR #16 at head " + HEAD + "f and base " + NEXT_HEAD
                    ),
                },
                "parents": [],
            },
            "t_source": {
                "task": {"id": "t_source", "status": "done", "body": "source"},
                "parents": [],
            },
        }

        class Adapter:
            def show(self, task_id):
                return tasks[task_id]

            def perform(self, _action):
                raise AssertionError("ambiguous SHA token must not mutate Kanban")

        spec = {
            "schema": "radulator-lifecycle-reconciliation/v1",
            "review_id": "exact-sha-audit",
            "trackers": [{
                "task_id": "t_tracker",
                "source_id": "source",
                "source": {"kind": "kanban_task", "task_id": "t_source"},
                "pr": 16,
                "head_sha": HEAD,
                "base_sha": NEXT_HEAD,
            }],
        }

        with self.assertRaisesRegex(LedgerError, "head SHA"):
            lifecycle_module.reconcile_trackers(
                self.ledger, spec, Adapter(), apply=True,
            )

        self.assertEqual(self.ledger.replay().events, ())

    def test_structured_pr_and_shas_override_stale_matching_prose(self):
        requested_base = "d" * 40
        spec = {
            "schema": "radulator-lifecycle-reconciliation/v1",
            "review_id": "structured-authority-audit",
            "trackers": [{
                "task_id": "t_tracker",
                "source_id": "source",
                "source": {"kind": "kanban_task", "task_id": "t_source"},
                "pr": 16,
                "head_sha": HEAD,
                "base_sha": requested_base,
            }],
        }

        for field, conflicting, message in (
            ("pr", 999, "PR failed"),
            ("head_sha", NEXT_HEAD, "head SHA failed"),
            ("base_sha", "c" * 40, "base SHA failed"),
        ):
            with self.subTest(field=field):
                task = {
                    "id": "t_tracker",
                    "status": "todo",
                    "pr": 16,
                    "head_sha": HEAD,
                    "base_sha": requested_base,
                    "body": (
                        "Stale mapping PR #16 at head " + HEAD
                        + " and base " + requested_base
                    ),
                }
                task[field] = conflicting
                tasks = {
                    "t_tracker": {"task": task, "parents": []},
                    "t_source": {
                        "task": {
                            "id": "t_source",
                            "status": "done",
                            "body": "source",
                        },
                        "parents": [],
                    },
                }

                class Adapter:
                    def show(self, task_id):
                        return tasks[task_id]

                    def perform(self, _action):
                        raise AssertionError(
                            "structured authority conflict must not mutate Kanban"
                        )

                with self.assertRaisesRegex(LedgerError, message):
                    lifecycle_module.reconcile_trackers(
                        self.ledger, spec, Adapter(), apply=True,
                    )

        self.assertEqual(self.ledger.replay().events, ())

    def test_prose_authority_does_not_mix_stale_pr_head_and_base_tokens(self):
        requested_base = "d" * 40
        tasks = {
            "t_tracker": {
                "task": {
                    "id": "t_tracker",
                    "status": "todo",
                    "body": (
                        "Current mapping: PR #999; head " + requested_base
                        + "; base " + HEAD
                    ),
                },
                "comments": [
                    {
                        "body": (
                            "Stale mapping: PR #16; head " + HEAD
                            + "; base " + requested_base
                        ),
                    },
                ],
                "parents": [],
            },
            "t_source": {
                "task": {"id": "t_source", "status": "done", "body": "source"},
                "parents": [],
            },
        }

        class Adapter:
            def show(self, task_id):
                return tasks[task_id]

            def perform(self, _action):
                raise AssertionError("mixed stale authority must not mutate Kanban")

        spec = {
            "schema": "radulator-lifecycle-reconciliation/v1",
            "review_id": "coherent-prose-authority-audit",
            "trackers": [{
                "task_id": "t_tracker",
                "source_id": "source",
                "source": {"kind": "kanban_task", "task_id": "t_source"},
                "pr": 16,
                "head_sha": HEAD,
                "base_sha": requested_base,
            }],
        }

        with self.assertRaisesRegex(LedgerError, "coherent"):
            lifecycle_module.reconcile_trackers(
                self.ledger, spec, Adapter(), apply=True,
            )

        self.assertEqual(self.ledger.replay().events, ())

    def test_prose_authority_does_not_cross_a_second_pr_clause(self):
        requested_base = "d" * 40
        tasks = {
            "t_tracker": {
                "task": {
                    "id": "t_tracker",
                    "status": "todo",
                    "body": (
                        "Current PR #999 head " + requested_base
                        + "; stale PR #16 head " + HEAD
                        + " base " + requested_base
                    ),
                },
                "parents": [],
            },
            "t_source": {
                "task": {"id": "t_source", "status": "done", "body": "source"},
                "parents": [],
            },
        }

        class Adapter:
            def show(self, task_id):
                return tasks[task_id]

            def perform(self, _action):
                raise AssertionError("cross-PR authority must not mutate Kanban")

        spec = {
            "schema": "radulator-lifecycle-reconciliation/v1",
            "review_id": "clause-bounded-authority-audit",
            "trackers": [{
                "task_id": "t_tracker",
                "source_id": "source",
                "source": {"kind": "kanban_task", "task_id": "t_source"},
                "pr": 999,
                "head_sha": requested_base,
                "base_sha": requested_base,
            }],
        }

        with self.assertRaisesRegex(LedgerError, "PR failed|base SHA|coherent"):
            lifecycle_module.reconcile_trackers(
                self.ledger, spec, Adapter(), apply=True,
            )

        self.assertEqual(self.ledger.replay().events, ())

    def test_reconciliation_spec_requires_owned_nonsymlink_exact_0600_file(self):
        payload = {
            "schema": "radulator-lifecycle-reconciliation/v1",
            "review_id": "file-trust-audit",
            "trackers": [{
                "task_id": "t_missing",
                "source_id": "source",
                "source": {"kind": "kanban_task", "task_id": "t_source"},
            }],
        }
        target = Path(self.temp.name) / "target.json"
        target.write_text(json.dumps(payload))
        target.chmod(0o600)
        expected_sha256 = hashlib.sha256(target.read_bytes()).hexdigest()
        symlink = Path(self.temp.name) / "reviewed.json"
        symlink.symlink_to(target)
        with self.assertRaisesRegex(LedgerError, "symlink"):
            lifecycle_module._load_reconciliation_spec(symlink, expected_sha256)

        loose = Path(self.temp.name) / "loose.json"
        loose.write_text(json.dumps(payload))
        loose.chmod(0o640)
        with self.assertRaisesRegex(LedgerError, "0600"):
            lifecycle_module._load_reconciliation_spec(loose, expected_sha256)

        wrong_owner = Path(self.temp.name) / "wrong-owner.json"
        wrong_owner.write_text(json.dumps(payload))
        wrong_owner.chmod(0o600)
        with mock.patch.object(
            lifecycle_module.os,
            "geteuid",
            return_value=wrong_owner.stat().st_uid + 1,
        ):
            with self.assertRaisesRegex(LedgerError, "owned"):
                lifecycle_module._load_reconciliation_spec(
                    wrong_owner, expected_sha256,
                )

    def test_reconciliation_spec_requires_exact_reviewed_sha256(self):
        original = json.dumps({
            "schema": "radulator-lifecycle-reconciliation/v1",
            "review_id": "reviewed-a",
            "trackers": [{
                "task_id": "t_missing",
                "source_id": "source",
                "source": {"kind": "kanban_task", "task_id": "t_source"},
            }],
        }, separators=(",", ":")).encode()
        replacement = original.replace(b"reviewed-a", b"reviewed-b")
        self.assertEqual(len(replacement), len(original))
        spec_path = Path(self.temp.name) / "digest-bound.json"
        spec_path.write_bytes(replacement)
        spec_path.chmod(0o600)
        reviewed_sha256 = hashlib.sha256(original).hexdigest()

        with self.assertRaisesRegex(LedgerError, "SHA-256"):
            lifecycle_module._load_reconciliation_spec(
                spec_path, reviewed_sha256,
            )

    def test_reconciliation_spec_rejects_in_place_change_during_fd_read(self):
        original = json.dumps({
            "schema": "radulator-lifecycle-reconciliation/v1",
            "review_id": "reviewed-a",
            "trackers": [{
                "task_id": "t_missing",
                "source_id": "source",
                "source": {"kind": "kanban_task", "task_id": "t_source"},
            }],
        }, separators=(",", ":")).encode()
        replacement = original.replace(b"reviewed-a", b"reviewed-b")
        spec_path = Path(self.temp.name) / "mutated-during-read.json"
        spec_path.write_bytes(original)
        spec_path.chmod(0o600)
        reviewed_sha256 = hashlib.sha256(original).hexdigest()
        real_read = lifecycle_module.os.read
        changed = False

        def tampering_read(descriptor, count):
            nonlocal changed
            chunk = real_read(descriptor, count)
            if chunk and not changed:
                changed = True
                spec_path.write_bytes(replacement)
                spec_path.chmod(0o600)
            return chunk

        with mock.patch.object(
            lifecycle_module.os, "read", side_effect=tampering_read,
        ):
            with self.assertRaisesRegex(LedgerError, "changed"):
                lifecycle_module._load_reconciliation_spec(
                    spec_path, reviewed_sha256,
                )

    def test_archived_nonterminal_cac_tracker_keeps_needs_fix_and_plans_correction(self):
        self.assertTrue(
            callable(getattr(lifecycle_module, "reconcile_trackers", None)),
            "lifecycle reconciliation entrypoint must exist",
        )
        for index, state in enumerate([
            "feedback", "implementing", "testing", "review", "needs_fix",
        ]):
            evidence = (
                {
                    "verdict_id": "5413367924",
                    "reason": "Correct clinical semantics.",
                    "base_sha": "e" * 40,
                }
                if state == "needs_fix"
                else {"proof": str(index)}
            )
            self.ledger.append(
                idempotency_key=f"cac-event-{index}",
                source_id="feedback-17",
                task_id="t_parent",
                state=state,
                pr=169,
                head_sha=HEAD,
                evidence=evidence,
                timestamp=f"2026-08-23T20:{index:02d}:00Z",
            )

        tasks = {
            "t_parent": {
                "task": {
                    "id": "t_parent",
                    "status": "archived",
                    "title": "Track clinical release of Radulator PR #169",
                    "body": "PR #169 exact head " + HEAD + " base " + "e" * 40,
                },
                "parents": [],
            },
            "t_source": {
                "task": {"id": "t_source", "status": "done", "body": "CAC source"},
                "parents": [],
            },
        }

        class Adapter:
            def show(self, task_id):
                return tasks[task_id]

            def perform(self, _action):
                raise AssertionError("dry reconciliation must not mutate Kanban")

        result = lifecycle_module.reconcile_trackers(
            self.ledger,
            {
                "schema": "radulator-lifecycle-reconciliation/v1",
                "review_id": "cac-archive-audit",
                "trackers": [{
                    "task_id": "t_parent",
                    "source_id": "feedback-17",
                    "source": {"kind": "kanban_task", "task_id": "t_source"},
                    "pr": 169,
                    "head_sha": HEAD,
                    "base_sha": "e" * 40,
                }],
            },
            Adapter(),
            apply=False,
        )

        self.assertEqual(self.ledger.replay().current_by_task["t_parent"].state, "needs_fix")
        self.assertEqual(len(self.ledger.replay().events), 5)
        self.assertEqual(
            [action["kind"] for action in result["planned_actions"]],
            ["create_prerequisite", "comment"],
        )
        self.assertEqual(result["terminal_mismatches"], ["t_parent"])

    def test_reconciliation_action_requires_exact_existing_event_authority(self):
        reviewed_base = "d" * 40
        recorded_base = "c" * 40
        for index, state in enumerate([
            "feedback", "implementing", "testing", "review", "needs_fix",
        ]):
            evidence = (
                {
                    "verdict_id": "event-authority-verdict",
                    "reason": "Correct the unchanged head.",
                    "base_sha": recorded_base,
                }
                if state == "needs_fix"
                else {"proof": str(index)}
            )
            self.append(state, index, evidence)
        initial_ledger = self.ledger_path.read_bytes()
        tasks = {
            "t_parent": {
                "task": {
                    "id": "t_parent",
                    "status": "archived",
                    "pr": 42,
                    "head_sha": HEAD,
                    "base_sha": reviewed_base,
                    "body": "tracker",
                },
                "parents": [],
            },
            "t_source": {
                "task": {"id": "t_source", "status": "done", "body": "source"},
                "parents": [],
            },
        }

        class Adapter:
            def show(self, task_id):
                return tasks[task_id]

            def perform(self, _action):
                raise AssertionError("conflicting event authority must not mutate Kanban")

        spec = {
            "schema": "radulator-lifecycle-reconciliation/v1",
            "review_id": "exact-render-event-authority-audit",
            "trackers": [{
                "task_id": "t_parent",
                "source_id": "feedback-17",
                "source": {"kind": "kanban_task", "task_id": "t_source"},
                "pr": 42,
                "head_sha": HEAD,
                "base_sha": reviewed_base,
            }],
        }

        with self.assertRaisesRegex(LedgerError, "lifecycle event authority"):
            lifecycle_module.reconcile_trackers(
                self.ledger, spec, Adapter(), apply=True,
            )

        self.assertEqual(self.ledger_path.read_bytes(), initial_ledger)

    def test_reconciliation_repairs_only_latest_blocked_needs_fix_edge_idempotently(self):
        self.append("feedback", 0)
        self.append("implementing", 1)
        self.append("testing", 2)
        self.append("review", 3)
        self.append(
            "needs_fix",
            4,
            {"verdict_id": "old-verdict", "reason": "Old correction."},
        )
        self.ledger.append(
            idempotency_key="corrected-head",
            source_id="feedback-17",
            task_id="t_parent",
            state="implementing",
            pr=42,
            head_sha=NEXT_HEAD,
            evidence={"prerequisite_change_id": "commit:" + NEXT_HEAD},
            timestamp="2026-08-23T20:05:00Z",
        )
        for index, state in enumerate(("testing", "review"), start=6):
            self.ledger.append(
                idempotency_key=f"latest-{state}",
                source_id="feedback-17",
                task_id="t_parent",
                state=state,
                pr=42,
                head_sha=NEXT_HEAD,
                evidence={"proof": state},
                timestamp=f"2026-08-23T20:{index:02d}:00Z",
            )
        latest = self.ledger.append(
            idempotency_key="latest-needs-fix",
            source_id="feedback-17",
            task_id="t_parent",
            state="needs_fix",
            pr=42,
            head_sha=NEXT_HEAD,
            evidence={"verdict_id": "latest-verdict", "reason": "Latest correction."},
            timestamp="2026-08-23T20:08:00Z",
        )
        self.ledger.append(
            idempotency_key="latest-blocked",
            source_id="feedback-17",
            task_id="t_parent",
            state="blocked",
            pr=42,
            head_sha=NEXT_HEAD,
            evidence={"reason": "Legacy dependency inversion."},
            timestamp="2026-08-23T20:09:00Z",
        )
        latest_action = actions_for_event(latest)[0]
        tasks = {
            "t_parent": {
                "task": {"id": "t_parent", "status": "todo", "body": "tracker"},
                "parents": ["t_unrelated_tracker_prerequisite"],
                "comments": [],
            },
            "t_source": {
                "task": {"id": "t_source", "status": "done", "body": "source"},
                "parents": [],
            },
            "t_old_rework": {
                "task": {
                    "id": "t_old_rework",
                    "status": "todo",
                    "body": "Old correction.",
                    "assignee": "codex-coding",
                },
                "parents": ["t_parent"],
            },
            "t_latest_rework": {
                "task": {
                    "id": "t_latest_rework",
                    "status": "todo",
                    "body": latest_action["body"],
                    "assignee": "codex-coding",
                },
                "parents": ["t_parent", "t_unrelated_rework_prerequisite"],
            },
        }
        commands = []

        def runner(command):
            commands.append(command)
            args = command[2:]
            if args[0] == "create":
                key = args[args.index("--idempotency-key") + 1]
                self.assertEqual(
                    key,
                    "radulator-rework:t_parent:latest-verdict",
                )
                return subprocess.CompletedProcess(
                    command, 0, json.dumps(tasks["t_latest_rework"]), "",
                )
            if args[0] == "show":
                return subprocess.CompletedProcess(
                    command, 0, json.dumps(tasks[args[1]]), "",
                )
            if args[0] == "unlink":
                parent_id, child_id = args[1:3]
                tasks[child_id]["parents"].remove(parent_id)
                return subprocess.CompletedProcess(command, 0, "ok", "")
            if args[0] == "link":
                parent_id, child_id = args[1:3]
                tasks[child_id]["parents"].append(parent_id)
                return subprocess.CompletedProcess(command, 0, "ok", "")
            if args[0] == "promote":
                tasks[args[1]]["task"]["status"] = "ready"
                return subprocess.CompletedProcess(
                    command, 0, json.dumps({"ok": True}), "",
                )
            if args[0] == "comment":
                tasks[args[1]]["comments"].append({"body": args[2]})
                return subprocess.CompletedProcess(command, 0, "ok", "")
            return subprocess.CompletedProcess(command, 1, "", "unexpected")

        adapter = HermesKanbanCLI(runner=runner)
        spec = {
            "schema": "radulator-lifecycle-reconciliation/v1",
            "review_id": "blocked-needs-fix-audit",
            "trackers": [{
                "task_id": "t_parent",
                "source_id": "feedback-17",
                "source": {"kind": "kanban_task", "task_id": "t_source"},
            }],
        }

        first = lifecycle_module.reconcile_trackers(
            self.ledger, spec, adapter, apply=True,
        )
        second = lifecycle_module.reconcile_trackers(
            self.ledger, spec, adapter, apply=True,
        )

        self.assertEqual(first["blocked_recoveries"], ["t_parent"])
        self.assertEqual(second["blocked_recoveries"], ["t_parent"])
        self.assertEqual(
            first["planned_actions"][0]["idempotency_key"],
            "radulator-rework:t_parent:latest-verdict",
        )
        self.assertEqual(
            tasks["t_latest_rework"]["parents"],
            ["t_unrelated_rework_prerequisite"],
        )
        self.assertEqual(tasks["t_latest_rework"]["task"]["status"], "ready")
        self.assertEqual(tasks["t_old_rework"]["parents"], ["t_parent"])
        self.assertEqual(
            tasks["t_parent"]["parents"],
            ["t_unrelated_tracker_prerequisite", "t_latest_rework"],
        )
        self.assertEqual([cmd[2] for cmd in commands].count("unlink"), 1)
        self.assertEqual([cmd[2] for cmd in commands].count("link"), 1)
        self.assertEqual([cmd[2] for cmd in commands].count("promote"), 1)
        self.assertEqual([cmd[2] for cmd in commands].count("comment"), 1)

    def test_reconcile_cli_is_read_only_until_apply_and_then_idempotent(self):
        spec_path = Path(self.temp.name) / "reviewed-reconciliation.json"
        spec_path.write_text(json.dumps({
            "schema": "radulator-lifecycle-reconciliation/v1",
            "review_id": "reviewed-cli-canary",
            "trackers": [{
                "task_id": "t_missing",
                "source_id": "source-cli",
                "source": {"kind": "kanban_task", "task_id": "t_source"},
            }],
        }))
        spec_path.chmod(0o600)
        spec_sha256 = hashlib.sha256(spec_path.read_bytes()).hexdigest()
        fake_hermes = Path(self.temp.name) / "fake-hermes"
        fake_hermes.write_text(
            "#!/usr/bin/env python3\n"
            "import json,sys\n"
            "task_id=sys.argv[3]\n"
            "status='blocked' if task_id=='t_missing' else 'done'\n"
            "print(json.dumps({'task':{'id':task_id,'status':status,'body':'source'},'parents':[]}))\n"
        )
        fake_hermes.chmod(0o700)
        base_command = [
            sys.executable,
            str(Path(lifecycle_module.__file__)),
            "reconcile",
            "--ledger",
            str(self.ledger_path),
            "--spec",
            str(spec_path),
            "--spec-sha256",
            spec_sha256,
            "--hermes",
            str(fake_hermes),
        ]

        planned = subprocess.run(base_command, capture_output=True, text=True)

        self.assertEqual(planned.returncode, 0, planned.stderr)
        self.assertEqual(json.loads(planned.stdout)["planned_bootstrap"], ["t_missing"])
        self.assertFalse(self.ledger_path.exists())

        first = subprocess.run(base_command + ["--apply"], capture_output=True, text=True)
        second = subprocess.run(base_command + ["--apply"], capture_output=True, text=True)

        self.assertEqual(first.returncode, 0, first.stderr)
        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertEqual(json.loads(first.stdout)["bootstrapped"], ["t_missing"])
        self.assertEqual(json.loads(second.stdout)["already_reconciled"], ["t_missing"])
        self.assertEqual(len(self.ledger_path.read_text().splitlines()), 1)


if __name__ == "__main__":
    unittest.main()
