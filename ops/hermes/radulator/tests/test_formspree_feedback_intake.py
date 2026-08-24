import json
import os
import tempfile
import unittest
from pathlib import Path

from ops.hermes.radulator.formspree_feedback_intake import (
    FeedbackIntakeError,
    _trusted_notification,
    extract_formspree_feedback,
    process_feedback,
)


FORM_BODY = """
<html><body>
  <table>
    <tr><th>Name</th><td>Private Submitter</td></tr>
    <tr><th>Email</th><td>private.submitter@example.test</td></tr>
    <tr><th>Type</th><td>Feature</td></tr>
    <tr><th>Calculator</th><td>BI-RADS</td></tr>
    <tr><th>Message</th><td>
      BI-RADS updated in 2025 with new terminology/classifications<br>
      Feature request: Dark mode for reading rooms/overnight call
    </td></tr>
  </table>
  <p>View submission on Formspree</p>
</body></html>
"""


class FakeGmail:
    def __init__(self, messages):
        self.messages = messages
        self.get_calls = []

    def search(self, limit):
        return [
            {
                "id": message["id"],
                "from": "Formspree <noreply@formspree.io>",
                "subject": "New submission from Radulator Feedback",
                "date": message["date"],
            }
            for message in self.messages[:limit]
        ]

    def get(self, message_id):
        self.get_calls.append(message_id)
        return next(message for message in self.messages if message["id"] == message_id)


class FakeKanban:
    def __init__(self, fail_readback=False):
        self.fail_readback = fail_readback
        self.created = []
        self.tasks = {}

    def create(self, title, body, idempotency_key):
        self.created.append((title, body, idempotency_key))
        task_id = "t_feedback_1"
        self.tasks[task_id] = {
            "id": task_id,
            "title": title,
            "body": body,
            "idempotency_key": idempotency_key,
            "status": "triage",
            "assignee": "radulator",
        }
        return task_id

    def show(self, task_id):
        if self.fail_readback:
            return {"id": task_id, "body": "incomplete"}
        return self.tasks[task_id]


class FormspreeFeedbackIntakeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.state_path = Path(self.temp.name) / "feedback-state.json"
        self.message = {
            "id": "gmail-raw-message-id-must-not-be-persisted",
            "date": "Fri, 10 Jul 2026 10:15:00 -0700",
            "from": "Formspree <noreply@formspree.io>",
            "subject": "New submission from Radulator Feedback",
            "body": FORM_BODY,
        }

    def tearDown(self):
        self.temp.cleanup()

    def test_extracts_only_allowed_feedback_fields(self):
        feedback = extract_formspree_feedback(FORM_BODY)

        self.assertEqual(feedback.kind, "Feature")
        self.assertEqual(feedback.calculator, "BI-RADS")
        self.assertEqual(
            feedback.message,
            "BI-RADS updated in 2025 with new terminology/classifications\n"
            "Feature request: Dark mode for reading rooms/overnight call",
        )
        serialized = json.dumps(feedback.to_dict())
        self.assertNotIn("Private Submitter", serialized)
        self.assertNotIn("private.submitter", serialized)
        self.assertNotIn("View submission", serialized)

    def test_sender_identity_must_match_exactly(self):
        trusted = {
            "id": "message-1",
            "from": "Formspree <noreply@formspree.io>",
            "subject": "New submission from Radulator Feedback",
        }
        spoofed = dict(trusted, **{
            "from": "noreply@formspree.io <attacker@example.test>",
        })

        self.assertTrue(_trusted_notification(trusted))
        self.assertFalse(_trusted_notification(spoofed))
        self.assertFalse(_trusted_notification("not a message"))

    def test_redacts_contact_data_inside_the_free_text(self):
        body = """
        Name: Private Submitter
        Email: private@example.test
        Type: bug
        Calculator: Other
        Message: Please contact private@example.test or +1 (555) 555-0199.
        """

        feedback = extract_formspree_feedback(body)

        self.assertEqual(
            feedback.message,
            "Please contact [email removed] or [phone removed].",
        )

    def test_stops_before_the_actual_formspree_delivery_footer(self):
        body = """
        type
        feature
        calculator
        birads
        message
        BI-RADS updated in 2025 with new terminology/classifications
        Feature request: Dark mode for reading rooms/overnight call
        Submitted 06:49 PM - 10 July 2026
        ---
        You are receiving this because you confirmed this email address on Formspree.
        """

        feedback = extract_formspree_feedback(body)

        self.assertEqual(
            feedback.message,
            "BI-RADS updated in 2025 with new terminology/classifications\n"
            "Feature request: Dark mode for reading rooms/overnight call",
        )

    def test_message_lines_beginning_with_reserved_field_words_are_never_reparsed(self):
        body = """
        Type: bug
        Calculator: BI-RADS
        Message:
        Calculator gives the wrong output after selecting 4A.
        Email should be optional for feedback.
        Type is shown as the wrong label.
        Name of the calculator is confusing.
        Message: this colon is part of the submitted feedback.
        """

        feedback = extract_formspree_feedback(body)

        self.assertEqual(feedback.calculator, "BI-RADS")
        self.assertEqual(
            feedback.message,
            "Calculator gives the wrong output after selecting 4A.\n"
            "Email should be optional for feedback.\n"
            "Type is shown as the wrong label.\n"
            "Name of the calculator is confusing.\n"
            "Message: this colon is part of the submitted feedback.",
        )

    def test_creates_one_triage_task_and_persists_only_a_digest_receipt(self):
        gmail = FakeGmail([self.message])
        kanban = FakeKanban()

        first = process_feedback(gmail, kanban, self.state_path)
        second = process_feedback(gmail, kanban, self.state_path)

        self.assertEqual(first, {"created": 1, "already_processed": 0, "quarantined": 0})
        self.assertEqual(second, {"created": 0, "already_processed": 1, "quarantined": 0})
        self.assertEqual(len(kanban.created), 1)
        title, body, idempotency_key = kanban.created[0]
        self.assertEqual(title, "Radulator feedback: BI-RADS (Feature)")
        self.assertIn("BI-RADS updated in 2025", body)
        self.assertIn("Dark mode for reading rooms", body)
        self.assertNotIn("Private Submitter", body)
        self.assertNotIn("private.submitter", body)
        self.assertRegex(idempotency_key, r"^radulator-formspree:[0-9a-f]{64}$")

        state_text = self.state_path.read_text()
        state = json.loads(state_text)
        self.assertEqual(state["version"], 1)
        self.assertEqual(len(state["processed"]), 1)
        self.assertNotIn(self.message["id"], state_text)
        self.assertNotIn("Private Submitter", state_text)
        self.assertNotIn("private.submitter", state_text)
        self.assertEqual(os.stat(self.state_path).st_mode & 0o777, 0o600)

    def test_does_not_acknowledge_a_message_until_exact_kanban_readback(self):
        gmail = FakeGmail([self.message])
        kanban = FakeKanban(fail_readback=True)

        with self.assertRaisesRegex(FeedbackIntakeError, "readback"):
            process_feedback(gmail, kanban, self.state_path)

        self.assertFalse(self.state_path.exists())

    def test_malformed_submission_creates_a_privacy_safe_quarantine_task(self):
        malformed = dict(self.message, body="Name: Private Submitter\nEmail: private@example.test")
        gmail = FakeGmail([malformed])
        kanban = FakeKanban()

        result = process_feedback(gmail, kanban, self.state_path)

        self.assertEqual(result, {"created": 0, "already_processed": 0, "quarantined": 1})
        title, body, _key = kanban.created[0]
        self.assertEqual(title, "Radulator feedback intake needs review")
        self.assertIn("could not be parsed", body)
        self.assertIn("2026-07-10", body)
        self.assertNotIn("Private Submitter", body)
        self.assertNotIn("private@example.test", body)

        repeated = process_feedback(gmail, kanban, self.state_path)
        self.assertEqual(repeated, {"created": 0, "already_processed": 1, "quarantined": 0})
        self.assertEqual(len(kanban.created), 1)

        malformed["body"] = FORM_BODY
        repaired = process_feedback(gmail, kanban, self.state_path)
        self.assertEqual(repaired, {"created": 1, "already_processed": 0, "quarantined": 0})
        self.assertEqual(len(kanban.created), 2)
        self.assertTrue(kanban.created[0][2].startswith("radulator-formspree-quarantine:"))
        self.assertTrue(kanban.created[1][2].startswith("radulator-formspree:"))
        state = json.loads(self.state_path.read_text())
        self.assertEqual(next(iter(state["processed"].values()))["classification"], "feedback")

    def test_processes_oldest_first_and_bounds_each_run(self):
        messages = [
            dict(self.message, id=f"message-{index}", date=f"Fri, {10 + index:02d} Jul 2026 10:15:00 -0700")
            for index in range(4)
        ]
        gmail = FakeGmail(list(reversed(messages)))
        kanban = FakeKanban()

        result = process_feedback(gmail, kanban, self.state_path, max_messages=2)

        self.assertEqual(result["created"], 2)
        self.assertEqual(gmail.get_calls, ["message-0", "message-1"])

        result = process_feedback(gmail, kanban, self.state_path, max_messages=2)

        self.assertEqual(result["created"], 2)
        self.assertEqual(gmail.get_calls, ["message-0", "message-1", "message-2", "message-3"])


if __name__ == "__main__":
    unittest.main()
