import json
import unittest
from unittest import mock

from ops.hermes.radulator.retain_learning import RetentionError, retain_learning


CANDIDATE = {
    "schema": "radulator-release-learning/v1",
    "feedback_symptom": "Approved work remained held.",
    "root_cause": "The retention path used slow structured extraction.",
    "regression_test": "The deterministic retention test verifies exact readback.",
    "released_sha": "a" * 40,
    "retention_id": "b" * 64,
    "reusable_rule": "Use an idempotent chunk receipt before lifecycle completion.",
    "smoke_proof": "production smoke artifact 88 passed",
    "source_id": "t_source",
    "task_id": "t_parent",
}


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self, _size=-1):
        return json.dumps(self.payload).encode("utf-8")


class RetainLearningTests(unittest.TestCase):
    def test_uses_bounded_chunk_strategy_and_exact_document_readback(self):
        requests = []

        def opener(request, timeout):
            requests.append((request, timeout))
            if request.get_method() == "POST":
                return FakeResponse({"success": True, "bank_id": "hermes-radulator", "items_count": 1, "async": False})
            posted = json.loads(requests[0][0].data)
            return FakeResponse({
                "items": [{
                    "id": "receipt-1",
                    "text": posted["items"][0]["content"],
                    "context": CANDIDATE["retention_id"],
                    "document_id": posted["items"][0]["document_id"],
                    "state": "valid",
                    "tags": posted["items"][0]["tags"],
                }],
                "total": 1,
            })

        receipt = retain_learning(
            CANDIDATE,
            api_url="http://hindsight.test:8890",
            bank_id="hermes-radulator",
            opener=opener,
            timeout=45,
        )

        self.assertEqual(receipt["schema"], "radulator-release-learning-receipt/v1")
        self.assertEqual(receipt["receipt_id"], "receipt-1")
        self.assertEqual(receipt["retention_id"], CANDIDATE["retention_id"])
        self.assertEqual(receipt["strategy"], "kanban_closure")
        self.assertEqual([request.get_method() for request, _ in requests], ["POST", "GET"])
        self.assertEqual([timeout for _, timeout in requests], [45, 45])

        payload = json.loads(requests[0][0].data)
        self.assertFalse(payload["async"])
        item = payload["items"][0]
        self.assertEqual(item["strategy"], "kanban_closure")
        self.assertEqual(item["update_mode"], "replace")
        self.assertEqual(item["document_id"], f"radulator-release-learning-{CANDIDATE['retention_id']}")
        self.assertIn("Feedback symptom: Approved work remained held.", item["content"])
        self.assertNotIn("source_id", item["content"])
        self.assertIn("document_id=radulator-release-learning-", requests[1][0].full_url)

    def test_fails_closed_when_readback_does_not_match_exact_content(self):
        responses = iter([
            FakeResponse({"success": True, "bank_id": "hermes-radulator", "items_count": 1, "async": False}),
            FakeResponse({
                "items": [{
                    "id": "receipt-1",
                    "text": "different",
                    "context": CANDIDATE["retention_id"],
                    "document_id": f"radulator-release-learning-{CANDIDATE['retention_id']}",
                    "state": "valid",
                    "tags": ["radulator-release-learning", f"retention_id:{CANDIDATE['retention_id']}"],
                }],
            }),
        ])

        with self.assertRaisesRegex(RetentionError, "readback"):
            retain_learning(
                CANDIDATE,
                api_url="http://hindsight.test:8890",
                bank_id="hermes-radulator",
                opener=lambda _request, timeout=None: next(responses),
            )

    def test_rejects_non_http_endpoint_before_network_access(self):
        opener = mock.Mock()

        with self.assertRaisesRegex(RetentionError, "http"):
            retain_learning(CANDIDATE, api_url="file:///tmp/memory", bank_id="hermes-radulator", opener=opener)

        opener.assert_not_called()


if __name__ == "__main__":
    unittest.main()
