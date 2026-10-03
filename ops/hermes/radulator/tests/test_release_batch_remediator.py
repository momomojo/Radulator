import contextlib
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import release_batch_remediator as remediator

MAIN = "a" * 40
HEAD = "b" * 40
PROMOTION = {
    "number": 310,
    "url": "https://github.com/momomojo/Radulator/pull/310",
    "headRefName": "release/promote-aaaaaaaaaaaa-dddddddddddd",
    "headRefOid": HEAD,
    "baseRefOid": MAIN,
    "isCrossRepository": False,
}


def completed(args, returncode=0, stdout="", stderr=""):
    return subprocess.CompletedProcess(args, returncode, stdout, stderr)


def entry(pr, squash_digit, files, remediation=False, tier="high"):
    return {"pr": pr, "squash": squash_digit * 40, "head": "9" * 40, "tier": tier, "domain": "clinical",
            "remediation": remediation, "files": files}


def chain(entries=None, ok=True, reason="CHAIN_VERIFIED"):
    return {
        "schema": "radulator-promotion-chain/v1",
        "ok": ok,
        "reasonCode": reason,
        "entries": entries if entries is not None else [
            entry(401, "1", ["src/components/calculators/CalcA.jsx"]),
            entry(402, "2", ["src/components/calculators/CalcB.jsx"]),
            entry(403, "3", ["docs/verification/calculator-inventory.json"], remediation=True),
        ],
    }


def finding(analysis, comment_id=9001, role="primary"):
    return {"comment_id": comment_id, "record": {"clinical_analysis": analysis, "judge": {"role": role}}}


def needs_fix_record(analysis, *, head=HEAD, base=MAIN, pr=310, verdict="NEEDS_FIX", role="primary"):
    return {
        "schema": "radulator-clinical-attestation/v1",
        "pr": pr,
        "head_sha": head,
        "base_sha": base,
        "base_ref": "main",
        "verdict": verdict,
        "clinical_analysis": analysis,
        "risk": {"tier": "high"},
        "judge": {"role": role, "key_id": "k", "profile": "radulator"},
    }


def carrier(record, comment_id):
    return {"id": comment_id, "body": f"{remediator.ATTESTATION_MARKER}\n```json\n{json.dumps(record)}\n```"}


class AttributionGrammarTests(unittest.TestCase):
    def test_lines(self):
        text = "\n".join([
            "The ALBI grade boundary drifted.",
            "Batch attribution: #401",
            "`Batch attribution: #401, #402`",
            "**Batch attribution: integration**",
            "- Batch attribution: main-drift",
            "Batch attribution: chain.",
            "Batch attribution: the NI-RADS PR",
        ])
        self.assertEqual(remediator.parse_attributions(text), [
            ("prs", [401]),
            ("prs", [401, 402]),
            ("integration", []),
            ("main-drift", []),
            ("chain", []),
            ("malformed", []),
        ])
        self.assertEqual(remediator.parse_attributions("No attribution here."), [])


class DecisionTests(unittest.TestCase):
    def test_one_attributed_pr_in_a_batch_of_two_is_reverted(self):
        decision = remediator.decide(chain(), [finding("Wrong cutoff.\nBatch attribution: #401")], 0)
        self.assertEqual(decision["action"], "revert")
        self.assertEqual(decision["entry"]["pr"], 401)

    def test_several_findings_about_one_pr_still_revert_it(self):
        decision = remediator.decide(chain(), [
            finding("A.\nBatch attribution: #402", 1),
            finding("B.\nBatch attribution: #402", 2, "verification"),
        ], 1)
        self.assertEqual(decision["action"], "revert")
        self.assertEqual(decision["entry"]["pr"], 402)

    def test_escalations(self):
        cases = [
            ("integration", chain(), [finding("Batch attribution: integration")], 0),
            ("main-drift", chain(), [finding("Batch attribution: main-drift")], 0),
            ("chain", chain(), [finding("Batch attribution: chain")], 0),
            ("malformed", chain(), [finding("Batch attribution: the calculator")], 0),
            ("unattributed", chain(), [finding("Wrong cutoff, no attribution.")], 0),
            ("several-prs", chain(), [finding("Batch attribution: #401, #402")], 0),
            ("several-prs", chain(), [finding("Batch attribution: #401", 1), finding("Batch attribution: #402", 2)], 0),
            ("chain-unverified", chain(ok=False, reason="CHAIN_TREE_MISMATCH"), [finding("Batch attribution: #401")], 0),
            ("chain-unverified", None, [finding("Batch attribution: #401")], 0),
            ("not-in-batch", chain(), [finding("Batch attribution: #999")], 0),
            ("remediation-attributed", chain(), [finding("Batch attribution: #403")], 0),
            ("rounds-exhausted", chain(), [finding("Batch attribution: #401")], 2),
        ]
        for kind, chain_value, findings, rounds in cases:
            with self.subTest(kind=kind):
                decision = remediator.decide(chain_value, findings, rounds)
                self.assertEqual((decision["action"], decision["kind"]), ("card", kind), decision)

    def test_a_batch_of_one_fixes_forward(self):
        single = chain([entry(401, "1", ["src/a.jsx"]), entry(403, "3", ["src/b.jsx"], remediation=True)])
        decision = remediator.decide(single, [finding("Batch attribution: #401")], 0)
        self.assertEqual((decision["action"], decision["kind"]), ("card", "fix-forward"))

    def test_a_later_pr_touching_the_same_files_escalates(self):
        overlapping = chain([
            entry(401, "1", ["src/components/calculators/CalcA.jsx"]),
            entry(402, "2", ["src/components/calculators/CalcA.jsx"]),
        ])
        decision = remediator.decide(overlapping, [finding("Batch attribution: #401")], 0)
        self.assertEqual(decision["kind"], "later-overlap")
        self.assertIn("#402", decision["detail"])
        # The later PR itself has no later overlap and is reverted.
        self.assertEqual(remediator.decide(overlapping, [finding("Batch attribution: #402")], 0)["action"], "revert")


class MainFlowTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.state_file = os.path.join(directory.name, "state.json")

    def run_main(self, comments, *, verdicts=None, chain_value=None, revert=None, promotion=PROMOTION):
        calls = {"verify": [], "chain": [], "revert": [], "card": []}

        @contextlib.contextmanager
        def fake_worktree():
            yield "/nonexistent/main"

        def fake_verify(worktree, records):
            calls["verify"].append(records)
            return verdicts if verdicts is not None else [{"ok": True, "required": True}] * len(records)

        def fake_chain(worktree, main_sha, promotion_sha):
            calls["chain"].append((main_sha, promotion_sha))
            return chain_value if chain_value is not None else chain()

        def fake_revert(promotion_value, entry_value, comment_ids):
            calls["revert"].append((entry_value["pr"], comment_ids))
            return revert or {"status": "opened", "pr": {"number": 420}}

        def fake_card(promotion_value, kind, detail, comment_ids):
            calls["card"].append((kind, comment_ids))
            return "t_card"

        with mock.patch.multiple(
            remediator,
            open_promotion=mock.Mock(return_value=promotion),
            promotion_comments=mock.Mock(return_value=comments),
            main_worktree=fake_worktree,
            verify_records=fake_verify,
            verify_chain=fake_chain,
            open_revert=fake_revert,
            open_card=fake_card,
            STATE_FILE=self.state_file,
        ), mock.patch.object(remediator, "run", side_effect=AssertionError("no direct commands in main()")), \
                mock.patch("builtins.print") as printed:
            remediator.main()
        calls["printed"] = [call.args[0] for call in printed.call_args_list]
        return calls

    def test_no_open_promotion_does_nothing(self):
        calls = self.run_main([], promotion=None)
        self.assertEqual(calls["verify"], [])
        self.assertEqual(calls["printed"], [])

    def test_attributed_needs_fix_opens_one_revert_once(self):
        comments = [
            {"id": 1, "body": "ordinary discussion"},
            carrier(needs_fix_record("Stale head.\nBatch attribution: #402", head="c" * 40), 2),
            carrier(needs_fix_record("A PASS", verdict="PASS"), 3),
            carrier(needs_fix_record("Wrong cutoff.\nBatch attribution: #401"), 4),
        ]
        calls = self.run_main(comments)
        self.assertEqual(len(calls["verify"][0]), 1, "only NEEDS_FIX records at the exact head and base are verified")
        self.assertEqual(calls["chain"], [(MAIN, HEAD)])
        self.assertEqual(calls["revert"], [(401, [4])])
        self.assertEqual(calls["card"], [])
        self.assertEqual(len(calls["printed"]), 1)
        self.assertIn("opened revert #420 of #401", calls["printed"][0])
        state = json.loads(Path(self.state_file).read_text())
        self.assertEqual(state["rounds"], {MAIN: 1})
        self.assertEqual(state["handled"]["4"]["action"], "revert")
        again = self.run_main(comments)
        self.assertEqual((again["verify"], again["revert"], again["printed"]), ([], [], []), "each NEEDS_FIX is acted on once")

    def test_unverified_or_optional_role_findings_are_ignored(self):
        comments = [carrier(needs_fix_record("Batch attribution: #401"), 5),
                    carrier(needs_fix_record("Batch attribution: #402", role="verification"), 6)]
        calls = self.run_main(comments, verdicts=[
            {"ok": False, "reasonCode": "INVALID_SIGNATURE", "required": True},
            {"ok": True, "reasonCode": "VALID_ATTESTATION_RECORD", "required": False},
        ])
        self.assertEqual((calls["chain"], calls["revert"], calls["card"], calls["printed"]), ([], [], [], []))
        state = json.loads(Path(self.state_file).read_text())
        self.assertEqual(state["handled"]["5"]["reason"], "INVALID_SIGNATURE")
        self.assertEqual(state["handled"]["6"]["action"], "ignored")

    def test_escalation_opens_an_operator_card(self):
        calls = self.run_main([carrier(needs_fix_record("Batch attribution: integration"), 7)])
        self.assertEqual(calls["revert"], [])
        self.assertEqual(calls["card"], [("integration", [7])])
        self.assertIn("needs an operator (integration)", calls["printed"][0])

    def test_a_revert_conflict_becomes_a_card(self):
        calls = self.run_main([carrier(needs_fix_record("Batch attribution: #401"), 8)],
                              revert={"status": "conflict", "detail": "CONFLICT (content)"})
        self.assertEqual(calls["card"], [("revert-conflict", [8])])
        self.assertNotIn(MAIN, json.loads(Path(self.state_file).read_text())["rounds"])

    def test_the_third_round_escalates(self):
        Path(self.state_file).write_text(json.dumps({"schema": remediator.STATE_SCHEMA, "handled": {}, "rounds": {MAIN: 2}}))
        calls = self.run_main([carrier(needs_fix_record("Batch attribution: #401"), 9)])
        self.assertEqual(calls["card"], [("rounds-exhausted", [9])])


class ActionTests(unittest.TestCase):
    def test_revert_opens_a_labelled_remediation_pr_from_develop(self):
        calls = []
        develop = "d" * 40
        target = entry(401, "1", ["src/components/calculators/CalcA.jsx"])
        branch = f"remediation/revert-pr401-{'1' * 12}"
        listings = iter([[], [{"number": 420, "url": "https://github.com/momomojo/Radulator/pull/420", "state": "OPEN"}]])

        def fake_run(args, **kwargs):
            calls.append((args, kwargs.get("cwd")))
            if args[:3] == ["gh", "pr", "list"]:
                return completed(args, stdout=json.dumps(next(listings)))
            if args[:3] == ["git", "rev-parse", "origin/develop"]:
                return completed(args, stdout=develop + "\n")
            if args[:2] == ["git", "worktree"] or args[:2] == ["git", "push"] or "revert" in args:
                return completed(args)
            if args[:3] in (["gh", "pr", "create"], ["gh", "pr", "comment"]):
                return completed(args)
            raise AssertionError(f"unexpected command: {args}")

        with mock.patch.object(remediator, "run", side_effect=fake_run):
            outcome = remediator.open_revert(PROMOTION, target, [4])
        self.assertEqual(outcome, {"status": "opened", "pr": {"number": 420, "url": "https://github.com/momomojo/Radulator/pull/420", "state": "OPEN"}})
        commands = [args for args, _ in calls]
        self.assertIn(["git", "worktree", "add", "--detach", mock.ANY, develop], commands)
        revert = next(args for args in commands if "revert" in args)
        self.assertEqual(revert[-3:], ["revert", "--no-edit", "1" * 40])
        self.assertIn(["git", "push", "-q", "origin", f"HEAD:refs/heads/{branch}"], commands)
        create = next(args for args in commands if args[:3] == ["gh", "pr", "create"])
        self.assertEqual(create[create.index("--base") + 1], "develop")
        self.assertEqual(create[create.index("--title") + 1], "revert: PR #401 (release remediation for promotion #310)")
        self.assertEqual(create[create.index("--label") + 1], "release-remediation")
        self.assertIn(remediator.HIGH_RISK_MARKER, create[create.index("--body") + 1], "a high-risk original keeps the marker")
        comments = [args[3] for args in commands if args[:3] == ["gh", "pr", "comment"]]
        self.assertEqual(comments, ["310", "401"], "the promotion and the reverted PR are told")
        self.assertLess(commands.index(["git", "push", "-q", "origin", f"HEAD:refs/heads/{branch}"]), commands.index(create))

    def test_a_conflicting_revert_is_aborted_and_never_pushed(self):
        calls = []

        def fake_run(args, **kwargs):
            calls.append(args)
            if args[:3] == ["gh", "pr", "list"]:
                return completed(args, stdout="[]")
            if args[:3] == ["git", "rev-parse", "origin/develop"]:
                return completed(args, stdout="d" * 40 + "\n")
            if "revert" in args and "--no-edit" in args:
                return completed(args, 1, stderr="CONFLICT (content): Merge conflict in src/x.jsx")
            return completed(args)

        with mock.patch.object(remediator, "run", side_effect=fake_run):
            outcome = remediator.open_revert(PROMOTION, entry(401, "1", ["src/x.jsx"]), [4])
        self.assertEqual(outcome["status"], "conflict")
        self.assertIn(["git", "revert", "--abort"], calls)
        self.assertFalse(any(args[:2] == ["git", "push"] for args in calls))
        self.assertFalse(any(args[:3] == ["gh", "pr", "create"] for args in calls))

    def test_an_existing_revert_branch_is_reused(self):
        with mock.patch.object(remediator, "run", return_value=completed(["gh"], stdout=json.dumps([{"number": 420, "state": "MERGED"}]))) as run_mock:
            outcome = remediator.open_revert(PROMOTION, entry(401, "1", ["src/x.jsx"]), [4])
        self.assertEqual(outcome["status"], "exists")
        self.assertEqual(run_mock.call_count, 1)

    def test_standard_risk_reverts_carry_no_high_risk_marker(self):
        body = remediator.revert_body(PROMOTION, entry(401, "1", ["README.md"], tier="standard"), [4])
        self.assertNotIn(remediator.HIGH_RISK_MARKER, body)
        self.assertIn("exact inverse", body)

    def test_operator_card_is_idempotent_and_links_no_pull_request(self):
        with mock.patch.object(remediator, "run", return_value=completed(["hermes"], stdout='{"id": "t_abc"}')) as run_mock:
            card = remediator.open_card(PROMOTION, "integration", "A finding is attributed to integration.", [7])
        self.assertEqual(card, "t_abc")
        args = run_mock.call_args.args[0]
        self.assertEqual(args[:3], ["hermes", "kanban", "create"])
        self.assertEqual(args[args.index("--idempotency-key") + 1], f"radulator-batch-remediation:310:{HEAD[:12]}:integration")
        self.assertEqual(args[args.index("--initial-status") + 1], "blocked")
        self.assertNotIn("github.com", args[args.index("--body") + 1], "Kanban respawn guard: no PR links in card text")

    def test_open_promotion_requires_exactly_one_same_repository_promotion(self):
        other = {**PROMOTION, "number": 311, "headRefName": "release/promote-x"}
        fork = {**PROMOTION, "isCrossRepository": True}
        hotfix = {**PROMOTION, "headRefName": "hotfix/outage"}
        for pulls, expected in (([PROMOTION], PROMOTION), ([PROMOTION, other], None), ([fork], None), ([hotfix], None), ([], None)):
            with self.subTest(pulls=[pull["headRefName"] for pull in pulls]), \
                    mock.patch.object(remediator, "run", return_value=completed(["gh"], stdout=json.dumps(pulls))):
                self.assertEqual(remediator.open_promotion(), expected)

    def test_state_roundtrip_and_schema_reset(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "nested", "state.json")
            with mock.patch.object(remediator, "STATE_FILE", path):
                state = remediator.load_state()
                self.assertEqual(state, {"schema": remediator.STATE_SCHEMA, "handled": {}, "rounds": {}})
                state["rounds"][MAIN] = 1
                remediator.save_state(state)
                self.assertEqual(remediator.load_state()["rounds"], {MAIN: 1})
                Path(path).write_text(json.dumps({"schema": "other"}))
                self.assertEqual(remediator.load_state()["rounds"], {})


if __name__ == "__main__":
    unittest.main()
