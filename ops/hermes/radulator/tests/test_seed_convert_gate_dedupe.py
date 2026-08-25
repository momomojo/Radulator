import tempfile
import unittest
from pathlib import Path
from unittest import mock

import ops.hermes.radulator.seed_convert_gate_dedupe as seed_dedupe


def issue(number, title, labels):
    return {
        "number": number,
        "title": title,
        "html_url": f"https://github.com/momomojo/Radulator/issues/{number}",
        "state": "open",
        "labels": [{"name": label} for label in labels],
        "created_at": "2026-07-07T00:00:00Z",
        "updated_at": "2026-07-07T00:00:00Z",
    }


class SeedConvertGateDedupeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.state_file = Path(self.temp.name) / "seed-state.json"
        self.state_patch = mock.patch.object(seed_dedupe, "STATE_FILE", self.state_file)
        self.state_patch.start()

    def tearDown(self):
        self.state_patch.stop()
        self.temp.cleanup()

    def test_stage_one_research_brief_is_actionable_despite_medical_gate(self):
        stage_one = issue(
            65,
            "[seed] Research brief: Contrast premedication regimen selector",
            ["seed", "lane:flash", "medical-review-pending"],
        )
        gated_implementation = issue(
            99,
            "[seed] Implement an unreviewed clinical threshold",
            ["seed", "lane:flash", "medical-review-pending"],
        )
        ordinary = issue(100, "[seed] Improve search", ["seed", "lane:flash"])

        with mock.patch.object(
            seed_dedupe,
            "open_seed_issues",
            return_value=[stage_one, gated_implementation, ordinary],
        ):
            first = seed_dedupe.preflight()
            second = seed_dedupe.preflight()

        actionable = {item["number"]: item for item in first["actionable_seed_issues"]}
        self.assertEqual(set(actionable), {65, 100})
        self.assertEqual(actionable[65]["gate_override"], "stage_1_research_only")
        self.assertEqual([item["number"] for item in first["gated_state_changes"]], [99])
        self.assertEqual([item["number"] for item in second["suppressed_gated_issues"]], [99])
        self.assertNotIn(65, {item["number"] for item in second["suppressed_gated_issues"]})
        self.assertEqual(first["decision"], "ACTION_REQUIRED")

    def test_stage_one_rule_requires_flash_lane_and_research_brief_title(self):
        candidates = [
            issue(1, "[seed] Research brief: no lane", ["seed", "medical-review-pending"]),
            issue(2, "[seed] Implement calculator", ["seed", "lane:flash", "medical-review-pending"]),
            issue(3, "[seed] Research brief: approved", ["seed", "lane:flash", "medical-review-pending"]),
        ]

        with mock.patch.object(seed_dedupe, "open_seed_issues", return_value=candidates):
            result = seed_dedupe.preflight()

        self.assertEqual([item["number"] for item in result["actionable_seed_issues"]], [3])
        self.assertEqual([item["number"] for item in result["gated_state_changes"]], [1, 2])


if __name__ == "__main__":
    unittest.main()
