import json
import unittest
from unittest import mock

from ops.hermes.radulator.retain_learning import RetentionError, _request_json, retain_learning


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


class RawResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self, _size=-1):
        return self.payload


class RetainLearningTests(unittest.TestCase):
    def test_rejects_pathological_json_readback_with_retention_error(self):
        for payload in (
            b'{"count":' + b"9" * 5000 + b"}",
            b"[" * 1100 + b"]" * 1100,
        ):
            with self.subTest(payload=payload[:20]):
                with self.assertRaises(RetentionError):
                    _request_json(
                        mock.Mock(),
                        opener=lambda _request, timeout=None: RawResponse(payload),
                        timeout=1,
                    )

    def _retained_content(self):
        return "\n".join((
            f"Retention ID: {CANDIDATE['retention_id']}",
            f"Feedback symptom: {CANDIDATE['feedback_symptom']}",
            f"Root cause: {CANDIDATE['root_cause']}",
            f"Regression test: {CANDIDATE['regression_test']}",
            f"Released SHA: {CANDIDATE['released_sha']}",
            f"Smoke proof: {CANDIDATE['smoke_proof']}",
            f"Reusable rule: {CANDIDATE['reusable_rule']}",
        ))

    def _chunk_readback(self, chunks, *, total=None, count=None):
        document_id = f"radulator-release-learning-{CANDIDATE['retention_id']}"
        tags = ["radulator-release-learning", f"retention_id:{CANDIDATE['retention_id']}"]
        items = [
            {
                "id": f"memory_{index}",
                "text": text,
                "context": CANDIDATE["retention_id"],
                "document_id": document_id,
                "state": "valid",
                "tags": tags,
            }
            for index, text in chunks
        ]
        return {
            "items": items,
            "total": len(items) if total is None else total,
            "count": len(items) if count is None else count,
        }

    def _opener_for_readback(self, readback):
        responses = iter([
            FakeResponse({"success": True, "bank_id": "hermes-radulator", "items_count": 1, "async": False}),
            FakeResponse(readback),
        ])
        return lambda _request, timeout=None: next(responses)

    def test_uses_bounded_chunk_strategy_and_exact_document_readback(self):
        requests = []

        def opener(request, timeout):
            requests.append((request, timeout))
            if request.get_method() == "POST":
                return FakeResponse({"success": True, "bank_id": "hermes-radulator", "items_count": 1, "async": False})
            posted = json.loads(requests[0][0].data)
            return FakeResponse({
                "items": [{
                    "id": "receipt_0",
                    "text": posted["items"][0]["content"],
                    "context": CANDIDATE["retention_id"],
                    "document_id": posted["items"][0]["document_id"],
                    "state": "valid",
                    "tags": posted["items"][0]["tags"],
                }],
                "total": 1,
                "count": 1,
            })

        receipt = retain_learning(
            CANDIDATE,
            api_url="http://hindsight.test:8890",
            bank_id="hermes-radulator",
            opener=opener,
            timeout=45,
        )

        self.assertEqual(receipt["schema"], "radulator-release-learning-receipt/v1")
        self.assertEqual(receipt["receipt_id"], "receipt_0")
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

    def test_accepts_exact_two_chunk_readback_in_chunk_order(self):
        content = self._retained_content()
        split_at = content.index("\nReleased SHA:")
        readback = self._chunk_readback([
            (0, content[:split_at]),
            (1, content[split_at + 1:]),
        ])

        receipt = retain_learning(
            CANDIDATE,
            api_url="http://hindsight.test:8890",
            bank_id="hermes-radulator",
            opener=self._opener_for_readback(readback),
        )

        self.assertEqual(receipt["receipt_id"], "memory_0")

    def test_rejects_multi_chunk_readback_without_exact_bounded_counts(self):
        content = self._retained_content()
        readback = self._chunk_readback([(0, content)], total=2, count=1)

        with self.assertRaisesRegex(RetentionError, "exact-document readback"):
            retain_learning(
                CANDIDATE,
                api_url="http://hindsight.test:8890",
                bank_id="hermes-radulator",
                opener=self._opener_for_readback(readback),
            )

    def test_rejects_duplicate_or_gapped_chunk_ids(self):
        content = self._retained_content()
        split_at = content.index("\nReleased SHA:")
        for chunks in (
            [(0, content[:split_at]), (0, content[split_at + 1:])],
            [(0, content[:split_at]), (2, content[split_at + 1:])],
        ):
            with self.subTest(chunks=chunks):
                with self.assertRaisesRegex(RetentionError, "exact-document readback"):
                    retain_learning(
                        CANDIDATE,
                        api_url="http://hindsight.test:8890",
                        bank_id="hermes-radulator",
                        opener=self._opener_for_readback(self._chunk_readback(chunks)),
                    )

    def test_rejects_chunks_from_different_memory_ids(self):
        content = self._retained_content()
        split_at = content.index("\nReleased SHA:")
        readback = self._chunk_readback([(0, content[:split_at]), (1, content[split_at + 1:])])
        readback["items"][0]["id"] = "memoryA_0"
        readback["items"][1]["id"] = "memoryB_1"

        with self.assertRaisesRegex(RetentionError, "did not share one memory id"):
            retain_learning(
                CANDIDATE,
                api_url="http://hindsight.test:8890",
                bank_id="hermes-radulator",
                opener=self._opener_for_readback(readback),
            )

    def test_rejects_out_of_order_or_mismatched_multi_chunk_readback(self):
        content = self._retained_content()
        split_at = content.index("\nReleased SHA:")
        chunks = [(0, content[:split_at]), (1, content[split_at + 1:])]
        out_of_order = self._chunk_readback(list(reversed(chunks)))
        mismatched = self._chunk_readback(chunks)
        mismatched["items"][1]["tags"] = ["radulator-release-learning"]

        for readback in (out_of_order, mismatched):
            with self.subTest(readback=readback):
                with self.assertRaisesRegex(RetentionError, "exact-document readback"):
                    retain_learning(
                        CANDIDATE,
                        api_url="http://hindsight.test:8890",
                        bank_id="hermes-radulator",
                        opener=self._opener_for_readback(readback),
                    )

    def test_rejects_altered_multi_chunk_text(self):
        content = self._retained_content()
        split_at = content.index("\nReleased SHA:")
        readback = self._chunk_readback([
            (0, content[:split_at]),
            (1, "altered " + content[split_at + 1:]),
        ])

        with self.assertRaisesRegex(RetentionError, "exact-document readback"):
            retain_learning(
                CANDIDATE,
                api_url="http://hindsight.test:8890",
                bank_id="hermes-radulator",
                opener=self._opener_for_readback(readback),
            )

    def test_rejects_extra_multi_chunk_text(self):
        content = self._retained_content()
        split_at = content.index("\nReleased SHA:")
        readback = self._chunk_readback([
            (0, content[:split_at]),
            (1, content[split_at + 1:]),
            (2, "unexpected extra chunk"),
        ])

        with self.assertRaisesRegex(RetentionError, "exact-document readback"):
            retain_learning(
                CANDIDATE,
                api_url="http://hindsight.test:8890",
                bank_id="hermes-radulator",
                opener=self._opener_for_readback(readback),
            )

    def test_rejects_malformed_chunk_id_and_tags_with_retention_error(self):
        content = self._retained_content()
        malformed_id = self._chunk_readback([(0, content)])
        malformed_id["items"][0]["id"] = "memory_" + "9" * 5000
        malformed_tags = self._chunk_readback([(0, content)])
        malformed_tags["items"][0]["tags"] = ["radulator-release-learning", []]

        for readback in (malformed_id, malformed_tags):
            with self.subTest(readback=readback):
                with self.assertRaises(RetentionError):
                    retain_learning(
                        CANDIDATE,
                        api_url="http://hindsight.test:8890",
                        bank_id="hermes-radulator",
                        opener=self._opener_for_readback(readback),
                    )

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

    def test_fails_closed_when_readback_contains_a_second_valid_record(self):
        document_id = f"radulator-release-learning-{CANDIDATE['retention_id']}"
        tags = ["radulator-release-learning", f"retention_id:{CANDIDATE['retention_id']}"]
        posted_content = None

        def opener(request, timeout=None):
            nonlocal posted_content
            if request.get_method() == "POST":
                posted_content = json.loads(request.data)["items"][0]["content"]
                return FakeResponse({
                    "success": True,
                    "bank_id": "hermes-radulator",
                    "items_count": 1,
                    "async": False,
                })
            return FakeResponse({
                "items": [
                    {
                        "id": "receipt-exact",
                        "text": posted_content,
                        "context": CANDIDATE["retention_id"],
                        "document_id": document_id,
                        "state": "valid",
                        "tags": tags,
                    },
                    {
                        "id": "receipt-conflicting",
                        "text": "stale conflicting content",
                        "context": CANDIDATE["retention_id"],
                        "document_id": document_id,
                        "state": "valid",
                        "tags": tags,
                    },
                ],
                "total": 2,
            })

        with self.assertRaisesRegex(RetentionError, "exact-document readback"):
            retain_learning(
                CANDIDATE,
                api_url="http://hindsight.test:8890",
                bank_id="hermes-radulator",
                opener=opener,
            )

    def test_rejects_non_http_endpoint_before_network_access(self):
        opener = mock.Mock()

        with self.assertRaisesRegex(RetentionError, "http"):
            retain_learning(CANDIDATE, api_url="file:///tmp/memory", bank_id="hermes-radulator", opener=opener)

        opener.assert_not_called()


if __name__ == "__main__":
    unittest.main()
