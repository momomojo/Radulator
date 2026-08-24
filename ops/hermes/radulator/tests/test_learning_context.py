import tempfile
import unittest
from pathlib import Path

from ops.hermes.radulator.learning_context import LearningError, make_learning_candidate
from ops.hermes.radulator.lifecycle_controller import LifecycleLedger


class LearningContextTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.ledger = LifecycleLedger(Path(self.temp.name) / "lifecycle.jsonl")

    def tearDown(self):
        self.temp.cleanup()

    def advance(self, final_state):
        states = [
            "feedback", "implementing", "testing", "review", "approved",
            "merged_develop", "promotion", "merged_main", "deploying",
            "deployed", "smoke_passed", "learned",
        ]
        for index, state in enumerate(states):
            evidence = {"proof": state}
            if state == "smoke_passed":
                evidence = {
                    "feedback_symptom": "The MELD-Na explanation omitted its source year.",
                    "root_cause": "The explanatory copy did not carry citation metadata.",
                    "regression_test": "The route smoke test asserts the cited source year.",
                    "released_sha": "a" * 40,
                    "smoke_proof": "https://github.com/momomojo/Radulator/actions/runs/88",
                    "reusable_rule": "Bind clinical wording changes to citation assertions.",
                }
            self.ledger.append(
                idempotency_key=f"event-{index}",
                source_id="feedback-17",
                task_id="t_parent",
                state=state,
                pr=42,
                head_sha="a" * 40,
                evidence=evidence,
            )
            if state == final_state:
                return

    def test_emits_one_sanitized_candidate_only_after_smoke(self):
        self.advance("smoke_passed")
        candidate = make_learning_candidate(self.ledger, "t_parent")
        self.assertEqual(candidate["schema"], "radulator-release-learning/v1")
        self.assertEqual(candidate["released_sha"], "a" * 40)
        self.assertEqual(len(candidate["retention_id"]), 64)
        self.assertNotIn("pr_body", candidate)
        self.assertEqual(candidate, make_learning_candidate(self.ledger, "t_parent"))

    def test_refuses_unshipped_or_already_learned_work(self):
        self.advance("review")
        with self.assertRaisesRegex(LearningError, "smoke_passed"):
            make_learning_candidate(self.ledger, "t_parent")

        second = LifecycleLedger(Path(self.temp.name) / "learned.jsonl")
        self.ledger = second
        self.advance("learned")
        with self.assertRaisesRegex(LearningError, "already"):
            make_learning_candidate(self.ledger, "t_parent")

    def test_rejects_secret_like_learning_content(self):
        self.advance("deployed")
        self.ledger.append(
            idempotency_key="bad-smoke",
            source_id="feedback-17",
            task_id="t_parent",
            state="smoke_passed",
            evidence={
                "feedback_symptom": "token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456",
                "root_cause": "copy",
                "regression_test": "test",
                "released_sha": "a" * 40,
                "smoke_proof": "run-88",
                "reusable_rule": "rule",
            },
        )
        with self.assertRaisesRegex(LearningError, "sensitive"):
            make_learning_candidate(self.ledger, "t_parent")


if __name__ == "__main__":
    unittest.main()
