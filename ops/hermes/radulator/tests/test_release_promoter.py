import json
import subprocess
import sys
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


if __name__ == "__main__":
    unittest.main()
