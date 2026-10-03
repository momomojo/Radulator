import contextlib
import datetime
import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import release_promoter as promoter


def completed(args, returncode=0, stdout="", stderr=""):
    return subprocess.CompletedProcess(args, returncode, stdout, stderr)


class ReleasePromoterReconciliationTests(unittest.TestCase):
    def setUp(self):
        self.main_sha = "a" * 40
        self.develop_sha = "b" * 40
        self.desired_branch = (
            "release/promote-" + self.main_sha[:12] + "-" + self.develop_sha[:12]
        )
        self.stale = {
            "number": 146,
            "url": "https://github.com/momomojo/Radulator/pull/146",
            "headRefName": "release/promote-aaaaaaaaaaaa-cccccccccccc",
            "headRefOid": "c" * 40,
        }
        self.replacement = {
            "number": 150,
            "url": "https://github.com/momomojo/Radulator/pull/150",
            "headRefName": self.desired_branch,
        }

    def common_patches(self, open_prs):
        return mock.patch.multiple(
            promoter,
            fetch_refs=mock.DEFAULT,
            rev_parse=mock.DEFAULT,
            open_promotions=mock.DEFAULT,
            ensure_promotion_branch=mock.DEFAULT,
            exact_promotion_attempt_exists=mock.DEFAULT,
            open_promotion_for_branch=mock.DEFAULT,
        )

    def configure(self, patched, open_prs):
        patched["fetch_refs"].return_value = None
        patched["rev_parse"].side_effect = [self.main_sha, self.develop_sha]
        patched["open_promotions"].return_value = open_prs
        patched["ensure_promotion_branch"].return_value = self.desired_branch
        patched["exact_promotion_attempt_exists"].return_value = False
        patched["open_promotion_for_branch"].return_value = self.replacement

    def cleanup_runner(
        self,
        *,
        closed=None,
        repository=None,
        branch_state=None,
        open_prs=None,
        push_returncode=0,
        post_delete_ref="",
    ):
        calls = []
        stale_branch = self.stale["headRefName"]
        stale_sha = self.stale["headRefOid"]
        closed = closed or {
            **self.stale,
            "state": "CLOSED",
            "mergedAt": None,
            "baseRefName": "main",
        }
        repository = repository or {"default_branch": "main"}
        branch_state = branch_state or {
            "name": stale_branch,
            "protected": False,
            "commit": {"sha": stale_sha},
        }
        open_prs = [] if open_prs is None else open_prs

        def fake_run(args, **kwargs):
            calls.append(args)
            if args[:3] == ["gh", "pr", "close"]:
                return completed(args)
            if args[:3] == ["gh", "pr", "view"]:
                return completed(args, stdout=json.dumps(closed) + "\n")
            if args == ["gh", "api", "repos/momomojo/Radulator"]:
                return completed(args, stdout=json.dumps(repository) + "\n")
            if args == [
                "gh", "api", f"repos/momomojo/Radulator/branches/{stale_branch}"
            ]:
                return completed(args, stdout=json.dumps(branch_state) + "\n")
            if args[:3] == ["gh", "pr", "list"]:
                return completed(args, stdout=json.dumps(open_prs) + "\n")
            if args[:2] == ["git", "push"]:
                return completed(
                    args,
                    returncode=push_returncode,
                    stderr="lease rejected" if push_returncode else "",
                )
            if args[:3] == ["git", "ls-remote", "--heads"]:
                return completed(args, stdout=post_delete_ref)
            raise AssertionError(f"unexpected command: {args}")

        return calls, fake_run

    def test_stale_open_promotion_is_replaced_then_closed(self):
        calls = []

        def fake_run(args, **kwargs):
            calls.append(args)
            if args[:3] == ["git", "rev-list", "--format=%ct %h %s"]:
                return completed(args, stdout=f"{int(time.time())} abc123 change\n")
            if args[:3] == ["gh", "pr", "create"]:
                return completed(args, stdout=self.replacement["url"] + "\n")
            if args[:3] == ["gh", "pr", "close"]:
                return completed(args)
            raise AssertionError(f"unexpected command: {args}")

        with self.common_patches([self.stale]) as patched, mock.patch.object(
            promoter, "run", side_effect=fake_run
        ), mock.patch.object(
            promoter, "delete_closed_promotion_branch"
        ) as delete_mock:
            self.configure(patched, [self.stale])
            promoter.main()

        patched["ensure_promotion_branch"].assert_called_once_with(
            self.main_sha, self.develop_sha
        )
        create_index = next(i for i, c in enumerate(calls) if c[:3] == ["gh", "pr", "create"])
        close_index = next(i for i, c in enumerate(calls) if c[:3] == ["gh", "pr", "close"])
        self.assertLess(create_index, close_index)
        close_call = calls[close_index]
        self.assertIn("146", close_call)
        self.assertTrue(any(self.replacement["url"] in arg for arg in close_call))
        patched["open_promotion_for_branch"].assert_called_once_with(self.desired_branch)
        delete_mock.assert_called_once_with(self.stale, self.desired_branch)

    def test_existing_exact_promotion_is_kept_and_stale_peer_is_closed(self):
        calls = []

        def fake_run(args, **kwargs):
            calls.append(args)
            if args[:3] == ["git", "rev-list", "--format=%ct %h %s"]:
                return completed(args, stdout=f"{int(time.time())} abc123 change\n")
            if args[:3] == ["gh", "pr", "close"]:
                return completed(args)
            raise AssertionError(f"unexpected command: {args}")

        with self.common_patches([self.replacement, self.stale]) as patched, mock.patch.object(
            promoter, "run", side_effect=fake_run
        ), mock.patch.object(
            promoter, "delete_closed_promotion_branch"
        ) as delete_mock:
            self.configure(patched, [self.replacement, self.stale])
            promoter.main()

        patched["ensure_promotion_branch"].assert_not_called()
        patched["open_promotion_for_branch"].assert_not_called()
        self.assertFalse(any(c[:3] == ["gh", "pr", "create"] for c in calls))
        close_calls = [c for c in calls if c[:3] == ["gh", "pr", "close"]]
        self.assertEqual(len(close_calls), 1)
        self.assertIn("146", close_calls[0])
        delete_mock.assert_called_once_with(self.stale, self.desired_branch)

    def test_creation_without_authoritative_readback_never_closes_stale_pr(self):
        calls = []

        def fake_run(args, **kwargs):
            calls.append(args)
            if args[:3] == ["git", "rev-list", "--format=%ct %h %s"]:
                return completed(args, stdout=f"{int(time.time())} abc123 change\n")
            if args[:3] == ["gh", "pr", "create"]:
                return completed(args, stdout="https://github.com/momomojo/Radulator/pull/150\n")
            raise AssertionError(f"unexpected command: {args}")

        with self.common_patches([self.stale]) as patched, mock.patch.object(
            promoter, "run", side_effect=fake_run
        ):
            self.configure(patched, [self.stale])
            patched["open_promotion_for_branch"].return_value = None
            with self.assertRaises(RuntimeError):
                promoter.main()

        self.assertFalse(any(c[:3] == ["gh", "pr", "close"] for c in calls))

    def test_exact_head_readback_retries_github_indexing_delay(self):
        responses = [
            completed(["gh"], stdout="[]\n"),
            completed(["gh"], stdout=__import__("json").dumps([self.replacement]) + "\n"),
        ]
        with mock.patch.object(promoter, "run", side_effect=responses) as run_mock, \
             mock.patch.object(promoter.time, "sleep") as sleep_mock:
            result = promoter.open_promotion_for_branch(self.desired_branch)

        self.assertEqual(result, self.replacement)
        self.assertEqual(run_mock.call_count, 2)
        sleep_mock.assert_called_once()

    def test_exact_closed_stale_ref_is_deleted_only_after_all_readbacks(self):
        calls, fake_run = self.cleanup_runner()
        branch = self.stale["headRefName"]
        sha = self.stale["headRefOid"]

        with mock.patch.object(promoter, "run", side_effect=fake_run):
            promoter.close_superseded_promotions(
                [self.stale], self.desired_branch, self.replacement
            )

        close_index = next(i for i, call in enumerate(calls) if call[:3] == ["gh", "pr", "close"])
        closed_readback_index = next(i for i, call in enumerate(calls) if call[:3] == ["gh", "pr", "view"])
        branch_readback_index = calls.index([
            "gh", "api", f"repos/momomojo/Radulator/branches/{branch}"
        ])
        open_pr_readback_index = next(i for i, call in enumerate(calls) if call[:3] == ["gh", "pr", "list"])
        delete_call = [
            "git", "push", f"--force-with-lease=refs/heads/{branch}:{sha}",
            "origin", "--delete", branch,
        ]
        delete_index = calls.index(delete_call)
        self.assertLess(close_index, closed_readback_index)
        self.assertLess(closed_readback_index, branch_readback_index)
        self.assertLess(branch_readback_index, open_pr_readback_index)
        self.assertLess(open_pr_readback_index, delete_index)
        self.assertEqual(calls[-1], [
            "git", "ls-remote", "--heads", "origin", f"refs/heads/{branch}",
        ])

    def test_nonclosed_pr_readback_preserves_stale_ref(self):
        calls, fake_run = self.cleanup_runner(closed={
            **self.stale,
            "state": "MERGED",
            "mergedAt": "2026-08-25T00:00:00Z",
            "baseRefName": "main",
        })
        with mock.patch.object(promoter, "run", side_effect=fake_run):
            promoter.close_superseded_promotions(
                [self.stale], self.desired_branch, self.replacement
            )
        self.assertTrue(any(call[:3] == ["gh", "pr", "view"] for call in calls))
        self.assertFalse(any(call[:2] == ["git", "push"] for call in calls))

    def test_advanced_ref_is_preserved(self):
        calls, fake_run = self.cleanup_runner(branch_state={
            "name": self.stale["headRefName"],
            "protected": False,
            "commit": {"sha": "d" * 40},
        })
        with mock.patch.object(promoter, "run", side_effect=fake_run):
            promoter.close_superseded_promotions(
                [self.stale], self.desired_branch, self.replacement
            )
        self.assertIn([
            "gh", "api",
            f"repos/momomojo/Radulator/branches/{self.stale['headRefName']}",
        ], calls)
        self.assertFalse(any(call[:2] == ["git", "push"] for call in calls))

    def test_protected_ref_is_preserved(self):
        calls, fake_run = self.cleanup_runner(branch_state={
            "name": self.stale["headRefName"],
            "protected": True,
            "commit": {"sha": self.stale["headRefOid"]},
        })
        with mock.patch.object(promoter, "run", side_effect=fake_run):
            promoter.close_superseded_promotions(
                [self.stale], self.desired_branch, self.replacement
            )
        self.assertIn([
            "gh", "api",
            f"repos/momomojo/Radulator/branches/{self.stale['headRefName']}",
        ], calls)
        self.assertFalse(any(call[:2] == ["git", "push"] for call in calls))

    def test_default_ref_is_preserved(self):
        calls, fake_run = self.cleanup_runner(repository={
            "default_branch": self.stale["headRefName"],
        })
        with mock.patch.object(promoter, "run", side_effect=fake_run):
            promoter.close_superseded_promotions(
                [self.stale], self.desired_branch, self.replacement
            )
        self.assertIn(["gh", "api", "repos/momomojo/Radulator"], calls)
        self.assertFalse(any(call[:2] == ["git", "push"] for call in calls))

    def test_open_pr_using_stale_ref_preserves_it(self):
        calls, fake_run = self.cleanup_runner(open_prs=[{
            "number": 171,
            "headRefOid": self.stale["headRefOid"],
        }])
        with mock.patch.object(promoter, "run", side_effect=fake_run):
            promoter.close_superseded_promotions(
                [self.stale], self.desired_branch, self.replacement
            )
        self.assertTrue(any(call[:3] == ["gh", "pr", "list"] for call in calls))
        self.assertFalse(any(call[:2] == ["git", "push"] for call in calls))

    def test_sha_lease_race_fails_without_post_delete_claim(self):
        calls, fake_run = self.cleanup_runner(push_returncode=1)
        with mock.patch.object(promoter, "run", side_effect=fake_run):
            with self.assertRaisesRegex(RuntimeError, "exact-SHA deletion failed"):
                promoter.close_superseded_promotions(
                    [self.stale], self.desired_branch, self.replacement
                )
        self.assertTrue(any(call[:2] == ["git", "push"] for call in calls))
        self.assertFalse(any(call[:3] == ["git", "ls-remote", "--heads"] for call in calls))

    def test_delete_requires_absent_ref_readback(self):
        branch = self.stale["headRefName"]
        sha = self.stale["headRefOid"]
        calls, fake_run = self.cleanup_runner(
            post_delete_ref=f"{sha}\trefs/heads/{branch}\n"
        )
        with mock.patch.object(promoter, "run", side_effect=fake_run):
            with self.assertRaisesRegex(RuntimeError, "still exists"):
                promoter.close_superseded_promotions(
                    [self.stale], self.desired_branch, self.replacement
                )
        self.assertTrue(any(call[:3] == ["git", "ls-remote", "--heads"] for call in calls))


def chain_fixture(**overrides):
    chain = {
        "schema": "radulator-promotion-chain/v1",
        "ok": True,
        "reasonCode": "CHAIN_VERIFIED",
        "M": "a" * 40,
        "D": "b" * 40,
        "S0": "e" * 40,
        "P": None,
        "entries": [
            {
                "pr": 274, "title": "feat(nirads): MRI v2025 | legacy rates", "squash": "1" * 40,
                "head": "2" * 40, "base": "e" * 40, "tier": "high", "domain": "clinical",
                "remediation": False, "urgent": False, "labels": ["ready-for-gate"],
                "roles": [{"role": "primary", "commentId": 11}, {"role": "verification", "commentId": 12}],
                "files": ["src/components/calculators/NIRADS.jsx", "src/components/forms/Field.jsx"],
            },
            {
                "pr": 295, "title": "fix(nirads): scope legacy rates", "squash": "3" * 40,
                "head": "4" * 40, "base": "1" * 40, "tier": "high", "domain": "clinical",
                "remediation": True, "urgent": False, "labels": ["ready-for-gate", "release-remediation"],
                "roles": [{"role": "primary", "commentId": 21}, {"role": "verification", "commentId": 22}],
                "files": ["src/components/calculators/NIRADS.jsx"],
            },
        ],
        "counts": {"commits": 2, "prs": 2, "nonRemediation": 1, "remediation": 1, "urgent": 0,
                   "highRiskClinical": 1},
        "domain": "clinical",
        "firstMergedAt": "2026-09-28T10:00:00Z",
        "lastMergedAt": "2026-09-28T11:00:00Z",
        "overlappingFiles": ["src/components/calculators/NIRADS.jsx"],
        "integrationMergedPaths": ["docs/verification/calculator-inventory.json"],
        "policy": {"maxPrs": 2, "maxHighRiskClinical": 2, "maxAgeHours": 24},
        "digest": "c" * 64,
    }
    chain.update(overrides)
    return chain


NOW = datetime.datetime(2026, 9, 28, 11, 30, tzinfo=datetime.timezone.utc).timestamp()


class BatchModeSwitchTests(unittest.TestCase):
    def test_only_exact_values_enable_a_mode(self):
        for stdout, returncode, expected in (
            ("true\n", 0, "true"),
            ("shadow\n", 0, "shadow"),
            ("false\n", 0, "disabled"),
            ("TRUE\n", 0, "disabled"),
            ("", 1, "disabled"),
        ):
            with self.subTest(stdout=stdout, returncode=returncode), mock.patch.object(
                promoter, "run", return_value=completed(["gh"], returncode, stdout)
            ) as run_mock:
                self.assertEqual(promoter.batch_mode(), expected)
                self.assertEqual(
                    run_mock.call_args.args[0],
                    ["gh", "variable", "get", "RADULATOR_BATCH_PROMOTIONS_ENABLED",
                     "--repo", "momomojo/Radulator"],
                )

    def test_an_unreadable_switch_keeps_single_release_promotions(self):
        with mock.patch.object(promoter, "run", side_effect=RuntimeError("gh timed out")):
            self.assertEqual(promoter.batch_mode(), "disabled")


class BatchRipenessTests(unittest.TestCase):
    def test_each_trigger(self):
        young = chain_fixture(firstMergedAt="2026-09-28T11:20:00Z", lastMergedAt="2026-09-28T11:25:00Z")
        self.assertEqual(promoter.batch_ripeness(young, NOW, [{"number": 300, "labels": []}], False), [])
        cases = {
            "develop advanced": (young, [{"number": 300, "labels": []}], True),
            "release-urgent PR is in the batch": (
                chain_fixture(firstMergedAt="2026-09-28T11:20:00Z", lastMergedAt="2026-09-28T11:25:00Z",
                              counts={**young["counts"], "urgent": 1}),
                [{"number": 300, "labels": []}], False),
            "approved release-urgent PR is waiting": (
                young, [{"number": 300, "labels": ["ready-for-gate", "release-urgent"]}], False),
            "the batch is full": (
                chain_fixture(firstMergedAt="2026-09-28T11:20:00Z", lastMergedAt="2026-09-28T11:25:00Z",
                              counts={**young["counts"], "nonRemediation": 2, "highRiskClinical": 1}),
                [{"number": 300, "labels": []}], False),
            "high-risk clinical PRs": (
                chain_fixture(firstMergedAt="2026-09-28T11:20:00Z", lastMergedAt="2026-09-28T11:25:00Z",
                              policy={"maxPrs": 4, "maxHighRiskClinical": 1}),
                [{"number": 300, "labels": []}], False),
            "oldest PR has waited 2 hours": (
                chain_fixture(firstMergedAt="2026-09-28T09:30:00Z", lastMergedAt="2026-09-28T11:25:00Z"),
                [{"number": 300, "labels": []}], False),
            "it is quiet": (
                chain_fixture(firstMergedAt="2026-09-28T11:00:00Z", lastMergedAt="2026-09-28T11:10:00Z"),
                [], False),
        }
        for expected, (chain, approved, replacing) in cases.items():
            with self.subTest(trigger=expected):
                reasons = promoter.batch_ripeness(chain, NOW, approved, replacing)
                self.assertTrue(any(expected in reason for reason in reasons), reasons)

    def test_an_approved_develop_pr_keeps_a_recent_batch_open(self):
        chain = chain_fixture(firstMergedAt="2026-09-28T11:00:00Z", lastMergedAt="2026-09-28T11:05:00Z")
        self.assertEqual(promoter.batch_ripeness(chain, NOW, [{"number": 301, "labels": []}], False), [])
        self.assertTrue(promoter.batch_ripeness(chain, NOW, [], False))

    def test_approved_develop_prs_read_the_gate_authorization(self):
        listing = [
            {"number": 301, "labels": [{"name": "ready-for-gate"}], "statusCheckRollup": [
                {"__typename": "StatusContext", "context": "Radulator Clinical Release Authorization",
                 "state": "SUCCESS"},
            ]},
            {"number": 302, "labels": [], "statusCheckRollup": [
                {"__typename": "StatusContext", "context": "Radulator Clinical Release Authorization",
                 "state": "FAILURE"},
                {"__typename": "CheckRun", "name": "Smoke Tests", "conclusion": "SUCCESS"},
            ]},
        ]
        with mock.patch.object(promoter, "run", return_value=completed(["gh"], 0, json.dumps(listing))) as run_mock:
            self.assertEqual(promoter.approved_develop_prs(), [{"number": 301, "labels": ["ready-for-gate"]}])
        self.assertIn("statusCheckRollup", run_mock.call_args.args[0][-1])


class BatchPromotionFlowTests(unittest.TestCase):
    def setUp(self):
        self.main_sha = "a" * 40
        self.develop_sha = "b" * 40
        self.branch = "release/promote-" + self.main_sha[:12] + "-" + self.develop_sha[:12]
        self.replacement = {
            "number": 310,
            "url": "https://github.com/momomojo/Radulator/pull/310",
            "headRefName": self.branch,
        }
        self.alert_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.alert_dir.cleanup)

    def run_main(self, *, mode, range_chain=None, promotion_chain=None, approved=None, commit_age_seconds=600,
                 open_prs=None):
        calls = []
        verify_calls = []
        commit_ts = int(NOW - commit_age_seconds)

        def fake_run(args, **kwargs):
            calls.append(args)
            if args[:3] == ["git", "rev-list", "--format=%ct %h %s"]:
                return completed(args, stdout=(
                    f"commit {'1' * 40}\n{commit_ts} 1111111 PR #274: exact-head clinical gate passed\n"
                    f"commit {'3' * 40}\n{commit_ts + 60} 3333333 PR #295: exact-head clinical gate passed\n"
                ))
            if args[:3] == ["gh", "pr", "create"]:
                return completed(args, stdout=self.replacement["url"] + "\n")
            if args[:3] == ["gh", "pr", "close"]:
                return completed(args)
            raise AssertionError(f"unexpected command: {args}")

        def fake_verify(worktree, main_sha, develop_sha=None, promotion_sha=None):
            verify_calls.append({"main": main_sha, "develop": develop_sha, "promotion": promotion_sha})
            if promotion_sha:
                return promotion_chain or chain_fixture(P=promotion_sha)
            return range_chain or chain_fixture()

        @contextlib.contextmanager
        def fake_worktree(main_sha):
            yield "/nonexistent/main-worktree"

        with mock.patch.multiple(
            promoter,
            fetch_refs=mock.DEFAULT,
            rev_parse=mock.DEFAULT,
            open_promotions=mock.DEFAULT,
            ensure_promotion_branch=mock.DEFAULT,
            exact_promotion_attempt_exists=mock.DEFAULT,
            open_promotion_for_branch=mock.DEFAULT,
            batch_mode=mock.DEFAULT,
            approved_develop_prs=mock.DEFAULT,
            remote_branch_sha=mock.DEFAULT,
            close_superseded_promotions=mock.DEFAULT,
        ) as patched, mock.patch.object(promoter, "run", side_effect=fake_run), \
                mock.patch.object(promoter, "verify_chain", side_effect=fake_verify), \
                mock.patch.object(promoter, "main_worktree", fake_worktree), \
                mock.patch.object(promoter, "ALERT_STATE", os.path.join(self.alert_dir.name, "alerts.json")), \
                mock.patch.object(promoter.time, "time", return_value=NOW):
            patched["rev_parse"].side_effect = [self.main_sha, self.develop_sha]
            patched["open_promotions"].return_value = open_prs or []
            patched["ensure_promotion_branch"].return_value = self.branch
            patched["exact_promotion_attempt_exists"].return_value = False
            patched["open_promotion_for_branch"].return_value = self.replacement
            patched["batch_mode"].return_value = mode
            patched["approved_develop_prs"].return_value = approved if approved is not None else []
            patched["remote_branch_sha"].return_value = "f" * 40
            promoter.main()
        create = next((call for call in calls if call[:3] == ["gh", "pr", "create"]), None)
        return create, verify_calls, patched

    @staticmethod
    def arg(call, name):
        return call[call.index(name) + 1]

    def test_disabled_and_shadow_modes_open_the_single_release_promotion(self):
        for mode in ("disabled", "shadow"):
            with self.subTest(mode=mode):
                create, verify_calls, _ = self.run_main(mode=mode)
                self.assertEqual(verify_calls, [], "no chain is computed outside batch mode")
                self.assertEqual(self.arg(create, "--title"), "release: promote develop to main (2 changes)")
                self.assertEqual(self.arg(create, "--label"), "promotion,ready-for-gate")
                self.assertIn("review this as a RELEASE", self.arg(create, "--body"))

    def test_a_young_busy_batch_waits(self):
        create, verify_calls, patched = self.run_main(
            mode="true",
            range_chain=chain_fixture(firstMergedAt="2026-09-28T11:20:00Z", lastMergedAt="2026-09-28T11:25:00Z"),
            approved=[{"number": 300, "labels": []}],
        )
        self.assertIsNone(create)
        self.assertEqual(verify_calls, [{"main": self.main_sha, "develop": self.develop_sha, "promotion": None}])
        patched["ensure_promotion_branch"].assert_not_called()

    def test_a_ripe_verified_batch_opens_a_batch_review(self):
        create, verify_calls, _ = self.run_main(mode="true")
        self.assertEqual(verify_calls[-1]["promotion"], "f" * 40, "the pushed promotion head is verified too")
        title = self.arg(create, "--title")
        body = self.arg(create, "--body")
        self.assertEqual(title, "release: promote develop to main (2 PRs: #274, #295)")
        self.assertEqual(self.arg(create, "--label"), "promotion,ready-for-gate")
        self.assertIn("**Review mode: BATCH.**", body)
        self.assertIn("| #274 | feat(nirads): MRI v2025 \\| legacy rates |", body)
        self.assertIn("[verification](https://github.com/momomojo/Radulator/pull/274#issuecomment-12)", body)
        self.assertIn("`docs/verification/calculator-inventory.json`", body)
        self.assertIn("Shared clinical infrastructure touched: `src/components/forms/Field.jsx`", body)
        self.assertIn("`Clinical Source Audits (exact head)`", body)
        self.assertIn("`Batch attribution: main-drift`", body)
        manifest = json.loads(body.split("<!-- radulator-batch-promotion/v1 -->\n```json\n", 1)[1].split("\n```", 1)[0])
        self.assertEqual(manifest["review_mode"], "batch")
        self.assertEqual([entry["pr"] for entry in manifest["entries"]], [274, 295])
        self.assertEqual(manifest["promotion"], "f" * 40)
        self.assertIsNone(promoter.EXPLICIT_HIGH_RISK_PATTERN.search(f"{title}\n{body}"))

    def test_an_unverified_chain_opens_a_full_review(self):
        broken = chain_fixture(ok=False, reasonCode="CHAIN_ATTESTATION_MISSING", entries=[])
        create, _, _ = self.run_main(mode="true", range_chain=broken, promotion_chain=broken)
        self.assertEqual(self.arg(create, "--label"), "promotion,ready-for-gate,promotion-full-review")
        body = self.arg(create, "--body")
        self.assertIn("**Review mode: FULL REVIEW.** The promotion chain is not verified (CHAIN_ATTESTATION_MISSING)", body)
        self.assertEqual(self.arg(create, "--title"), "release: promote develop to main (2 PRs: #274, #295)",
                         "the PR list falls back to the develop commit titles")

    def test_a_promotion_head_that_fails_its_content_proof_is_a_full_review(self):
        create, _, _ = self.run_main(
            mode="true",
            promotion_chain=chain_fixture(ok=False, reasonCode="PROMOTION_CONTENT_MISMATCH"),
        )
        self.assertIn("promotion-full-review", self.arg(create, "--label"))
        self.assertIn("(PROMOTION_CONTENT_MISMATCH)", self.arg(create, "--body"))

    def test_a_mixed_domain_batch_alerts_once_and_never_opens(self):
        mixed = chain_fixture(ok=False, reasonCode="BATCH_DOMAIN_MIXED")
        with mock.patch("builtins.print") as printed:
            first, _, patched = self.run_main(mode="true", range_chain=mixed)
            second, _, _ = self.run_main(mode="true", range_chain=mixed)
        self.assertIsNone(first)
        self.assertIsNone(second)
        patched["ensure_promotion_branch"].assert_not_called()
        alerts = [call.args[0] for call in printed.call_args_list if "ALERT" in call.args[0]]
        self.assertEqual(len(alerts), 1, "the every-10-minutes cron alerts once per develop head")

    def test_unavailable_chain_evidence_retries_then_opens_a_full_review(self):
        unavailable = chain_fixture(ok=False, reasonCode="CHAIN_EVIDENCE_UNAVAILABLE", entries=[])
        create, _, _ = self.run_main(mode="true", range_chain=unavailable, commit_age_seconds=600)
        self.assertIsNone(create, "a young batch retries on the next run")
        create, _, _ = self.run_main(mode="true", range_chain=unavailable, promotion_chain=unavailable,
                                     commit_age_seconds=3 * 3600)
        self.assertIn("promotion-full-review", self.arg(create, "--label"))

    def test_a_superseded_promotion_is_replaced_without_waiting(self):
        stale = {"number": 303, "url": "https://github.com/momomojo/Radulator/pull/303",
                 "headRefName": "release/promote-aaaaaaaaaaaa-cccccccccccc", "headRefOid": "c" * 40}
        create, _, patched = self.run_main(
            mode="true",
            range_chain=chain_fixture(firstMergedAt="2026-09-28T11:20:00Z", lastMergedAt="2026-09-28T11:25:00Z"),
            approved=[{"number": 300, "labels": []}],
            open_prs=[stale],
        )
        self.assertIsNotNone(create)
        patched["close_superseded_promotions"].assert_called_once()

    def test_the_body_never_declares_high_risk(self):
        chain = chain_fixture()
        chain["entries"][0]["title"] = "<!-- radulator-risk: high --> risk: high"
        title, body, _ = promoter.batch_pr_fields({"full_review": False, "why": "it is quiet"}, chain, [274, 295])
        self.assertIsNone(promoter.EXPLICIT_HIGH_RISK_PATTERN.search(f"{title}\n{body}"))
        self.assertIn("&lt;!-- radulator-risk: high --&gt;", body)


if __name__ == "__main__":
    unittest.main()
