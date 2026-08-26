import dataclasses
import contextlib
import io
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from ops.hermes.radulator import trusted_publisher as publisher


HEAD_SHA = "b" * 40
BASE_SHA = "a" * 40


class FakeKanban:
    def __init__(self, tasks, events, runs=None):
        self.tasks = list(tasks)
        self.events = dict(events)
        self.runs = dict(runs or {
            17: SimpleNamespace(
                id=17,
                task_id="t_example",
                status="blocked",
                outcome="blocked",
                ended_at=123,
                summary="AWAITING_TRUSTED_PUBLISHER v1",
            )
        })
        self.authority_claims = []

    def claim_trusted_publisher_authority(self, _conn, **kwargs):
        self.authority_claims.append(kwargs)
        return {
            "contract": "hermes.trusted_publisher.authority-claim.v1",
            "status": "claimed",
            "claim_id": f"publisher:{kwargs['task_id']}:{kwargs['expected_run_id']}",
            "host_receipt_id": f"receipt-{kwargs['task_id']}-{kwargs['expected_run_id']}",
            "host_receipt_signature": "A" * 86 + "==",
            "repository": kwargs["expected_repository"],
            "task_id": kwargs["task_id"],
            "run_id": kwargs["expected_run_id"],
            "board": kwargs["expected_board"],
            "project_id": kwargs["expected_project_id"],
            "workspace": kwargs["expected_workspace_path"],
            "branch": kwargs["expected_branch_name"],
            "base_sha": kwargs["expected_base_sha"],
            "head_sha": kwargs["expected_head_sha"],
            "changed_paths": kwargs["expected_changed_paths"],
        }

    def verify_trusted_publisher_authority_receipt(self, _conn, **kwargs):
        receipt = kwargs["receipt"]
        return {
            "contract": "hermes.trusted_publisher.authority-verified.v1",
            "status": "verified",
            "claim_id": receipt["claim_id"],
            "host_receipt_id": receipt["host_receipt_id"],
        }

    def list_tasks(self, _conn, **kwargs):
        assert kwargs == {
            "status": "blocked",
            "include_archived": False,
            "order_by": "created",
        }
        return list(self.tasks)

    def list_events(self, _conn, task_id):
        return list(self.events.get(task_id, []))

    def get_run(self, _conn, run_id):
        return self.runs.get(run_id)

    def latest_run(self, _conn, task_id):
        rows = [run for run in self.runs.values() if getattr(run, "task_id", None) == task_id]
        return max(rows, key=lambda run: run.id) if rows else None


def task(**overrides):
    value = {
        "id": "t_example",
        "status": "blocked",
        "project_id": "radulator",
        "workspace_path": "/srv/radulator/.worktrees/t_example",
        "branch_name": "radulator/t_example-feature",
        "created_at": 100,
        "current_run_id": None,
        "block_kind": "capability",
    }
    value.update(overrides)
    return SimpleNamespace(**value)


def event(kind, payload, *, event_id, run_id=17):
    return SimpleNamespace(
        id=event_id,
        task_id="t_example",
        kind=kind,
        payload=payload,
        created_at=100 + event_id,
        run_id=run_id,
    )


def contract(**overrides):
    value = {
        "contract": "hermes.trusted_local_commit.v1",
        "task_id": "t_example",
        "project_id": "radulator",
        "board": "default",
        "workspace": "/srv/radulator/.worktrees/t_example",
        "branch": "radulator/t_example-feature",
        "base_sha": BASE_SHA,
        "head_sha": HEAD_SHA,
        "changed_paths": ["docs/evidence.json", "src/example.js"],
        "publisher_state": "awaiting",
    }
    value.update(overrides)
    return value


def exact_events(**contract_overrides):
    return [
        event("trusted_local_commit", contract(**contract_overrides), event_id=1),
        event(
            "blocked",
            {
                "reason": "AWAITING_TRUSTED_PUBLISHER v1",
                "kind": "capability",
            },
            event_id=2,
        ),
    ]


class TrustedPublisherSelectionTests(unittest.TestCase):
    def select(self, *, tasks=None, events=None):
        tasks = [task()] if tasks is None else tasks
        events = {"t_example": exact_events()} if events is None else events
        return publisher.select_candidate(FakeKanban(tasks, events), object(), "default")

    def test_selects_exact_oldest_sealed_contract(self):
        candidate = self.select()

        self.assertEqual(candidate.task_id, "t_example")
        self.assertEqual(candidate.head_sha, HEAD_SHA)
        self.assertEqual(candidate.base_sha, BASE_SHA)
        self.assertEqual(candidate.changed_paths, ("docs/evidence.json", "src/example.js"))
        self.assertEqual(candidate.run_id, 17)

    def test_accepts_exact_null_project_identity_from_live_board(self):
        candidate = self.select(
            tasks=[task(project_id=None)],
            events={"t_example": exact_events(project_id=None)},
        )

        self.assertIsNotNone(candidate)
        self.assertIsNone(candidate.project_id)

    def test_selects_only_oldest_eligible_task(self):
        first = task(id="t_bad", created_at=1)
        second = task(id="t_example", created_at=2)
        fake = FakeKanban(
            [first, second],
            {
                "t_bad": exact_events(task_id="t_other"),
                "t_example": exact_events(),
            },
        )

        candidate = publisher.select_candidate(fake, object(), "default")

        self.assertEqual(candidate.task_id, "t_example")

    def test_returns_none_when_no_exact_candidate_exists(self):
        self.assertIsNone(self.select(tasks=[]))

    def test_rejects_contract_or_identity_mismatch(self):
        cases = {
            "contract": "hermes.trusted_local_commit.v0",
            "task_id": "t_other",
            "project_id": "other",
            "board": "other",
            "workspace": "/srv/radulator/.worktrees/other",
            "branch": "radulator/other",
            "base_sha": "A" * 40,
            "head_sha": "short",
            "changed_paths": ["src/example.js", "src/example.js"],
            "publisher_state": "published",
        }
        for key, value in cases.items():
            with self.subTest(key=key):
                result = self.select(events={"t_example": exact_events(**{key: value})})
                self.assertIsNone(result)

    def test_rejects_extra_keys_absolute_or_unsorted_paths(self):
        for payload in (
            {**contract(), "unexpected": True},
            contract(changed_paths=["/etc/passwd"]),
            contract(changed_paths=["src/z.js", "src/a.js"]),
            contract(changed_paths=["../escape"]),
            contract(changed_paths=[]),
        ):
            with self.subTest(payload=payload):
                events = [
                    event("trusted_local_commit", payload, event_id=1),
                    event(
                        "blocked",
                        {"reason": "AWAITING_TRUSTED_PUBLISHER v1", "kind": "capability"},
                        event_id=2,
                    ),
                ]
                self.assertIsNone(self.select(events={"t_example": events}))

    def test_rejects_wrong_or_ambiguous_latest_event_sequence(self):
        cases = [
            [event("trusted_local_commit", contract(), event_id=1)],
            [
                event("trusted_local_commit", contract(), event_id=1, run_id=17),
                event(
                    "blocked",
                    {"reason": "AWAITING_TRUSTED_PUBLISHER v1", "kind": "capability"},
                    event_id=2,
                    run_id=18,
                ),
            ],
            exact_events() + [event("trusted_local_commit", contract(), event_id=3)],
        ]
        for events in cases:
            with self.subTest(events=[item.kind for item in events]):
                self.assertIsNone(self.select(events={"t_example": events}))

        with_comment = exact_events() + [event("commented", {}, event_id=3)]
        self.assertIsNotNone(self.select(events={"t_example": with_comment}))

    def test_event_authority_uses_event_ids_not_adapter_order(self):
        events = [
            event(
                "blocked",
                {"reason": "AWAITING_TRUSTED_PUBLISHER v1", "kind": "capability"},
                event_id=4,
            ),
            event(
                "trusted_local_commit",
                contract(head_sha="c" * 40),
                event_id=3,
            ),
            event("trusted_local_commit", contract(), event_id=1),
        ]

        candidate = self.select(events={"t_example": events})

        self.assertEqual(candidate.head_sha, "c" * 40)

    def test_accepts_bounded_recovery_run_id_only(self):
        current = SimpleNamespace(id=17, task_id="t_example", status="blocked", outcome="blocked", ended_at=123, summary="AWAITING_TRUSTED_PUBLISHER v1")
        prior = SimpleNamespace(id=12, task_id="t_example", status="reclaimed", outcome="reclaimed", ended_at=100, summary=None)
        request = event("trusted_git_completion_requested", {"contract": "hermes.trusted_git_completion_request.v1"}, event_id=0, run_id=12)
        fake = FakeKanban(
            [task()],
            {"t_example": [request, *exact_events(recovered_from_run_id=12)]},
            runs={12: prior, 17: current},
        )
        candidate = publisher.select_candidate(fake, object(), "default")
        self.assertEqual(candidate.recovered_from_run_id, 12)
        for invalid in (0, -1, "12", True):
            with self.subTest(invalid=invalid):
                self.assertIsNone(
                    self.select(
                        events={"t_example": exact_events(recovered_from_run_id=invalid)}
                    )
                )

    def test_rejects_unfinished_or_mismatched_authoritative_run(self):
        cases = (
            SimpleNamespace(id=17, task_id="t_example", status="running", outcome=None, ended_at=None, summary=None),
            SimpleNamespace(id=17, task_id="t_other", status="blocked", outcome="blocked", ended_at=123, summary="AWAITING_TRUSTED_PUBLISHER v1"),
            SimpleNamespace(id=17, task_id="t_example", status="blocked", outcome="completed", ended_at=123, summary="AWAITING_TRUSTED_PUBLISHER v1"),
            SimpleNamespace(id=17, task_id="t_example", status="blocked", outcome="blocked", ended_at=123, summary="other"),
        )
        for run in cases:
            with self.subTest(run=run):
                fake = FakeKanban(
                    [task()],
                    {"t_example": exact_events()},
                    runs={17: run},
                )
                self.assertIsNone(publisher.select_candidate(fake, object(), "default"))

    def test_rejects_superseded_latest_run_or_wrong_block_kind(self):
        valid = SimpleNamespace(
            id=17,
            task_id="t_example",
            status="blocked",
            outcome="blocked",
            ended_at=123,
            summary="AWAITING_TRUSTED_PUBLISHER v1",
        )
        later = SimpleNamespace(
            id=18,
            task_id="t_example",
            status="blocked",
            outcome="blocked",
            ended_at=124,
            summary="AWAITING_TRUSTED_PUBLISHER v1",
        )
        fake = FakeKanban(
            [task()],
            {"t_example": exact_events()},
            runs={17: valid, 18: later},
        )
        self.assertIsNone(publisher.select_candidate(fake, object(), "default"))
        self.assertIsNone(self.select(tasks=[task(block_kind="medical")]))

    def test_recovery_requires_exact_reclaimed_run_and_request_event(self):
        current = SimpleNamespace(
            id=17,
            task_id="t_example",
            status="blocked",
            outcome="blocked",
            ended_at=123,
            summary="AWAITING_TRUSTED_PUBLISHER v1",
        )
        prior = SimpleNamespace(
            id=12,
            task_id="t_example",
            status="reclaimed",
            outcome="reclaimed",
            ended_at=100,
            summary=None,
        )
        request = event(
            "trusted_git_completion_requested",
            {"contract": "hermes.trusted_git_completion_request.v1"},
            event_id=0,
            run_id=12,
        )
        events = [request, *exact_events(recovered_from_run_id=12)]
        fake = FakeKanban(
            [task()],
            {"t_example": events},
            runs={12: prior, 17: current},
        )
        self.assertIsNotNone(publisher.select_candidate(fake, object(), "default"))
        fake.events["t_example"] = exact_events(recovered_from_run_id=12)
        self.assertIsNone(publisher.select_candidate(fake, object(), "default"))


class TrustedPublisherGitAuthorityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.origin = self.root / "origin.git"
        self.project = self.root / "Radulator"
        self.workspace = self.project / ".worktrees" / "t_example"
        subprocess.run(["git", "init", "--bare", str(self.origin)], check=True, capture_output=True)
        subprocess.run(
            ["git", "clone", str(self.origin), str(self.project)],
            check=True,
            capture_output=True,
        )
        self.git(self.project, "config", "user.name", "Test")
        self.git(self.project, "config", "user.email", "test@example.invalid")
        (self.project / "README.md").write_text("base\n", encoding="utf-8")
        self.git(self.project, "add", "README.md")
        self.git(self.project, "commit", "-m", "base")
        self.base_sha = self.git(self.project, "rev-parse", "HEAD").stdout.strip()
        self.git(
            self.project,
            "worktree",
            "add",
            "-b",
            "radulator/t_example-feature",
            str(self.workspace),
            self.base_sha,
        )
        (self.workspace / "src").mkdir()
        (self.workspace / "src" / "example.js").write_text("export const value = 1;\n")
        self.git(self.workspace, "add", "src/example.js")
        self.git(self.workspace, "commit", "-m", "feat: example")
        self.head_sha = self.git(self.workspace, "rev-parse", "HEAD").stdout.strip()
        self.config = publisher.PublisherConfig(
            board="default",
            project_id="radulator",
            project_root=self.project,
            repository="momomojo/Radulator",
            base_branch="develop",
            expected_origin=str(self.origin.resolve()),
            lifecycle_controller=self.project / "ops/hermes/radulator/lifecycle_controller.py",
        )
        self.candidate = publisher.TrustedCommit(
            task_id="t_example",
            project_id="radulator",
            board="default",
            workspace=str(self.workspace.resolve()),
            branch="radulator/t_example-feature",
            base_sha=self.base_sha,
            head_sha=self.head_sha,
            changed_paths=("src/example.js",),
            run_id=17,
        )

    def tearDown(self):
        self.temp.cleanup()

    @staticmethod
    def git(cwd, *args, check=True):
        return subprocess.run(
            ["git", *args], cwd=cwd, check=check, capture_output=True, text=True
        )

    def test_accepts_exact_clean_task_worktree(self):
        result = publisher.validate_local_candidate(self.candidate, self.config)
        self.assertEqual(result, self.candidate)

    def test_rejects_dirty_detached_wrong_branch_or_changed_paths(self):
        (self.workspace / "untracked.txt").write_text("dirty\n")
        with self.assertRaisesRegex(publisher.PublisherError, "clean"):
            publisher.validate_local_candidate(self.candidate, self.config)
        (self.workspace / "untracked.txt").unlink()

        self.git(self.workspace, "checkout", "--detach")
        with self.assertRaisesRegex(publisher.PublisherError, "branch"):
            publisher.validate_local_candidate(self.candidate, self.config)
        self.git(self.workspace, "switch", "radulator/t_example-feature")

        mismatch = dataclasses.replace(self.candidate, changed_paths=("README.md",))
        with self.assertRaisesRegex(publisher.PublisherError, "changed paths"):
            publisher.validate_local_candidate(mismatch, self.config)

    def test_rejects_wrong_head_parent_or_protected_branch(self):
        wrong_head = dataclasses.replace(self.candidate, head_sha="c" * 40)
        with self.assertRaisesRegex(publisher.PublisherError, "HEAD"):
            publisher.validate_local_candidate(wrong_head, self.config)

        wrong_base = dataclasses.replace(self.candidate, base_sha="d" * 40)
        with self.assertRaisesRegex(publisher.PublisherError, "parent"):
            publisher.validate_local_candidate(wrong_base, self.config)

        protected = dataclasses.replace(self.candidate, branch="develop")
        with self.assertRaisesRegex(publisher.PublisherError, "protected"):
            publisher.validate_local_candidate(protected, self.config)

    def test_rejects_workspace_outside_registered_project_worktrees(self):
        outside = dataclasses.replace(self.candidate, workspace=str(self.project.resolve()))
        with self.assertRaisesRegex(publisher.PublisherError, "worktree root"):
            publisher.validate_local_candidate(outside, self.config)

        symlink = self.root / "linked-workspace"
        symlink.symlink_to(self.workspace, target_is_directory=True)
        aliased = dataclasses.replace(self.candidate, workspace=str(symlink))
        with self.assertRaisesRegex(publisher.PublisherError, "canonical"):
            publisher.validate_local_candidate(aliased, self.config)

    def test_rejects_executable_local_git_configuration(self):
        self.git(self.workspace, "config", "core.hooksPath", "/tmp/hooks")
        with self.assertRaisesRegex(publisher.PublisherError, "Git config"):
            publisher.validate_local_candidate(self.candidate, self.config)

    def test_rejects_git_execution_surfaces_before_first_git_command(self):
        for key, value in (
            ("core.fsmonitor", "/tmp/attacker-fsmonitor"),
            ("core.alternateRefsCommand", "/tmp/attacker-alternate-refs"),
            ("diff.external", "/tmp/attacker-diff"),
        ):
            with self.subTest(key=key):
                self.git(self.workspace, "config", key, value)
                calls = []

                def forbidden_runner(args, **kwargs):
                    calls.append((args, kwargs))
                    raise AssertionError("Git ran before unsafe config was rejected")

                try:
                    with self.assertRaisesRegex(publisher.PublisherError, "Git config"):
                        publisher.validate_local_candidate(
                            self.candidate,
                            self.config,
                            runner=forbidden_runner,
                        )
                    self.assertEqual(calls, [])
                finally:
                    self.git(self.workspace, "config", "--unset-all", key, check=False)

    def test_replace_ref_cannot_forge_sealed_commit_parent(self):
        base_tree = self.git(
            self.workspace, "show", "-s", "--format=%T", self.base_sha
        ).stdout.strip()
        forged_base = subprocess.run(
            ["git", "commit-tree", base_tree],
            cwd=self.workspace,
            input="forged base\n",
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        head_tree = self.git(
            self.workspace, "show", "-s", "--format=%T", self.head_sha
        ).stdout.strip()
        forged_head = subprocess.run(
            ["git", "commit-tree", head_tree, "-p", forged_base],
            cwd=self.workspace,
            input="forged head\n",
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        self.git(self.workspace, "replace", self.head_sha, forged_head)

        replaced_parent = self.git(
            self.workspace, "show", "-s", "--format=%P", self.head_sha
        ).stdout.strip()
        raw_parent = self.git(
            self.workspace,
            "--no-replace-objects",
            "show",
            "-s",
            "--format=%P",
            self.head_sha,
        ).stdout.strip()
        self.assertEqual(replaced_parent, forged_base)
        self.assertEqual(raw_parent, self.base_sha)

        forged_candidate = dataclasses.replace(self.candidate, base_sha=forged_base)
        with self.assertRaisesRegex(publisher.PublisherError, "parent"):
            publisher.validate_local_candidate(forged_candidate, self.config)
        self.assertEqual(
            publisher.validate_local_candidate(self.candidate, self.config),
            self.candidate,
        )

    def test_legacy_graft_is_rejected_before_first_git_command(self):
        base_tree = self.git(
            self.workspace, "show", "-s", "--format=%T", self.base_sha
        ).stdout.strip()
        forged_base = subprocess.run(
            ["git", "commit-tree", base_tree],
            cwd=self.workspace,
            input="forged base\n",
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        grafts = self.project / ".git" / "info" / "grafts"
        grafts.parent.mkdir(parents=True, exist_ok=True)
        grafts.write_text(
            f"{self.head_sha} {forged_base}\n",
            encoding="utf-8",
        )

        raw_parent = next(
            line.removeprefix("parent ")
            for line in self.git(
                self.workspace,
                "cat-file",
                "-p",
                self.head_sha,
            ).stdout.splitlines()
            if line.startswith("parent ")
        )
        grafted_parent = self.git(
            self.workspace,
            "--no-replace-objects",
            "show",
            "-s",
            "--format=%P",
            self.head_sha,
        ).stdout.strip()
        self.assertEqual(raw_parent, self.base_sha)
        self.assertEqual(grafted_parent, forged_base)
        self.assertNotEqual(grafted_parent, raw_parent)

        calls = []

        def forbidden_runner(*args, **kwargs):
            calls.append((args, kwargs))
            raise AssertionError("Git ran before the graft pre-scan rejected authority")

        forged_candidate = dataclasses.replace(
            self.candidate,
            base_sha=forged_base,
        )
        with self.assertRaisesRegex(publisher.PublisherError, "graft"):
            publisher.validate_local_candidate(
                forged_candidate,
                self.config,
                runner=forbidden_runner,
            )
        self.assertEqual(calls, [])

    def test_every_git_invocation_uses_fixed_execution_neutralizers(self):
        observed = []

        def runner(args, **kwargs):
            observed.append((list(args), kwargs))
            return subprocess.run(args, **kwargs)

        publisher.validate_local_candidate(self.candidate, self.config, runner=runner)

        required = {
            "core.hooksPath=/dev/null",
            "core.fsmonitor=false",
            "core.askPass=/dev/null",
            "core.sshCommand=/usr/bin/false",
            "credential.helper=",
            "diff.external=",
            "core.attributesFile=/dev/null",
            "protocol.ext.allow=never",
            "http.proxy=",
            "http.sslVerify=true",
            "http.extraHeader=",
            "http.followRedirects=false",
        }
        for command, invocation in observed:
            with self.subTest(command=command):
                self.assertEqual(command[0], publisher.GIT_BINARY)
                self.assertIn("--no-replace-objects", command)
                self.assertEqual(invocation["env"]["GIT_NO_REPLACE_OBJECTS"], "1")
                configured = {
                    command[index + 1]
                    for index, part in enumerate(command[:-1])
                    if part == "-c"
                }
                self.assertTrue(required.issubset(configured))
                self.assertIn("--no-optional-locks", command)

    def test_rejects_local_git_network_tls_proxy_and_credential_configuration(self):
        unsafe = (
            ("http.proxy", "http://127.0.0.1:4444"),
            ("http.sslVerify", "false"),
            ("http.https://github.com/.extraHeader", "Authorization: attack"),
            ("credential.useHttpPath", "true"),
            ("protocol.ext.allow", "always"),
            ("include.path", "/tmp/attacker-gitconfig"),
        )
        for key, value in unsafe:
            with self.subTest(key=key):
                self.git(self.workspace, "config", key, value)
                try:
                    with self.assertRaisesRegex(publisher.PublisherError, "Git config"):
                        publisher.validate_local_candidate(self.candidate, self.config)
                finally:
                    self.git(self.workspace, "config", "--unset-all", key, check=False)

    def test_rejects_wrong_origin_and_sibling_registration(self):
        self.git(self.workspace, "remote", "set-url", "origin", "https://example.invalid/other.git")
        with self.assertRaisesRegex(publisher.PublisherError, "origin"):
            publisher.validate_local_candidate(self.candidate, self.config)

        self.git(self.workspace, "remote", "set-url", "origin", str(self.origin.resolve()))
        self.git(self.workspace, "remote", "set-url", "--push", "origin", "ext::sh -c evil")
        with self.assertRaisesRegex(publisher.PublisherError, "push origin|Git config"):
            publisher.validate_local_candidate(self.candidate, self.config)
        self.git(self.workspace, "config", "--unset-all", "remote.origin.pushurl")

        wrong_workspace = dataclasses.replace(
            self.candidate,
            workspace=str((self.project / ".worktrees" / "not-registered").resolve()),
        )
        with self.assertRaisesRegex(publisher.PublisherError, "workspace|worktree"):
            publisher.validate_local_candidate(wrong_workspace, self.config)

    def test_canonical_github_publisher_requires_https_remote(self):
        self.assertFalse(
            publisher._origin_matches(
                "git@github.com:momomojo/Radulator.git",
                "momomojo/Radulator",
                "momomojo/Radulator",
            )
        )


class QueueRunner:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def __call__(self, args, **kwargs):
        self.calls.append((list(args), kwargs))
        if not self.responses:
            raise AssertionError(f"unexpected command: {args}")
        response = self.responses.pop(0)
        if callable(response):
            return response(args, kwargs)
        return subprocess.CompletedProcess(args, *response)


def response(returncode=0, stdout="", stderr=""):
    return (returncode, stdout, stderr)


def exact_pr(**overrides):
    value = {
        "number": 181,
        "url": "https://github.com/momomojo/Radulator/pull/181",
        "state": "OPEN",
        "headRefName": "radulator/t_example-feature",
        "headRefOid": HEAD_SHA,
        "baseRefName": "develop",
        "baseRefOid": BASE_SHA,
        "headRepositoryOwner": {"login": "momomojo"},
        "isCrossRepository": False,
        "labels": [],
        "mergedAt": None,
    }
    value.update(overrides)
    return value


class TrustedPublisherGitHubTests(unittest.TestCase):
    def setUp(self):
        self.env_patch = mock.patch.dict(os.environ, {"GH_TOKEN": "test-token"})
        self.env_patch.start()
        self.config = publisher.PublisherConfig(
            board="default",
            project_id="radulator",
            project_root=Path("/srv/radulator"),
            repository="momomojo/Radulator",
            base_branch="develop",
            expected_origin="momomojo/Radulator",
            lifecycle_controller=Path("/srv/radulator/ops/hermes/radulator/lifecycle_controller.py"),
        )
        self.candidate = publisher.TrustedCommit(
            task_id="t_example",
            project_id="radulator",
            board="default",
            workspace="/srv/radulator/.worktrees/t_example",
            branch="radulator/t_example-feature",
            base_sha=BASE_SHA,
            head_sha=HEAD_SHA,
            changed_paths=("src/example.js",),
            run_id=17,
        )
        self.validator_patch = mock.patch.object(
            publisher,
            "validate_local_candidate",
            return_value=self.candidate,
        )
        self.validator = self.validator_patch.start()

    def remote_feature(self, sha=HEAD_SHA):
        return response(stdout=(f"{sha}\trefs/heads/{self.candidate.branch}\n" if sha else ""))

    def remote_base(self, sha=BASE_SHA):
        return response(stdout=f"{sha}\trefs/heads/{self.config.base_branch}\n")

    def tearDown(self):
        self.validator_patch.stop()
        self.env_patch.stop()

    def test_absent_remote_pushes_without_force_and_opens_exact_pr(self):
        runner = QueueRunner([
            self.remote_feature(None),
            self.remote_base(),
            response(stdout="[]\n"),
            self.remote_feature(None),
            self.remote_base(),
            response(stdout="pushed\n"),
            self.remote_feature(),
            response(stdout="[]\n"),
            self.remote_feature(),
            self.remote_base(),
            response(stdout="[]\n"),
            response(stdout=exact_pr()["url"] + "\n"),
            response(stdout=json.dumps([exact_pr()]) + "\n"),
        ])

        result = publisher.ensure_remote_and_pr(self.candidate, self.config, runner=runner)

        self.assertEqual(result.number, 181)
        flat = [part for call, _kwargs in runner.calls for part in call]
        self.assertNotIn("--force", flat)
        self.assertFalse(any(part.startswith("--force-with-lease") for part in flat))
        push = next(call for call, _ in runner.calls if "push" in call)
        self.assertIn(
            f"{self.candidate.head_sha}:refs/heads/{self.candidate.branch}",
            push,
        )
        self.assertFalse(any(part.startswith("HEAD:") for part in push))
        self.assertIn(
            "credential.helper=!/opt/homebrew/bin/gh auth git-credential",
            push,
        )
        self.assertNotIn("test-token", flat)
        self.assertIn("https://github.com/momomojo/Radulator.git", push)
        remote_read = next(call for call, _ in runner.calls if "ls-remote" in call)
        self.assertIn("https://github.com/momomojo/Radulator.git", remote_read)
        self.assertGreaterEqual(self.validator.call_count, 2)

    def test_local_git_authority_is_revalidated_immediately_before_push(self):
        timeline = []
        queued = QueueRunner([
            self.remote_feature(None),
            self.remote_base(),
            response(stdout="[]\n"),
            self.remote_feature(None),
            self.remote_base(),
            response(stdout="pushed\n"),
            self.remote_feature(),
            response(stdout="[]\n"),
            self.remote_feature(),
            self.remote_base(),
            response(stdout="[]\n"),
            response(stdout=exact_pr()["url"] + "\n"),
            response(stdout=json.dumps([exact_pr()]) + "\n"),
        ])

        def validating(*_args, **_kwargs):
            timeline.append("local-authority")
            return self.candidate

        def runner(command, **kwargs):
            if "push" in command:
                self.assertEqual(timeline[-1], "local-authority")
            else:
                timeline.append(" ".join(str(item) for item in command))
            return queued(command, **kwargs)

        self.validator.side_effect = validating
        publisher.ensure_remote_and_pr(self.candidate, self.config, runner=runner)

    def test_exact_remote_and_pr_are_reused_idempotently(self):
        runner = QueueRunner([
            self.remote_feature(),
            self.remote_base(),
            response(stdout=json.dumps([exact_pr()]) + "\n"),
        ])

        result = publisher.ensure_remote_and_pr(self.candidate, self.config, runner=runner)

        self.assertEqual(result.head_sha, HEAD_SHA)
        self.assertFalse(any("push" in call for call, _ in runner.calls))

    def test_exact_remote_retry_still_requires_current_target_base_authority(self):
        advanced_base = "d" * 40
        runner = QueueRunner([
            self.remote_feature(),
            self.remote_base(advanced_base),
            response(returncode=1),
        ])

        with self.assertRaisesRegex(publisher.PublisherError, "current target base"):
            publisher.ensure_remote_and_pr(self.candidate, self.config, runner=runner)

        self.assertFalse(any(
            Path(call[0]).name == "gh" and call[1:3] in (["pr", "create"], ["pr", "reopen"])
            for call, _ in runner.calls
        ))

    def test_pr_history_enumerates_same_branch_across_all_bases(self):
        calls = []
        wrong_base = exact_pr(baseRefName="main", baseRefOid="d" * 40)

        def runner(args, **kwargs):
            call = list(args)
            calls.append(call)
            if "ls-remote" in call:
                ref = call[-1]
                if ref == f"refs/heads/{self.candidate.branch}":
                    stdout = f"{HEAD_SHA}\t{ref}\n"
                else:
                    stdout = f"{BASE_SHA}\t{ref}\n"
                return subprocess.CompletedProcess(args, 0, stdout, "")
            if Path(call[0]).name == "gh" and call[1:3] == ["pr", "list"]:
                # Match GitHub's filter semantics: the existing retargeted PR
                # disappears only when the publisher incorrectly filters base.
                value = [] if "--base" in call else [wrong_base]
                return subprocess.CompletedProcess(args, 0, json.dumps(value) + "\n", "")
            if Path(call[0]).name == "gh" and call[1:3] == ["pr", "create"]:
                return subprocess.CompletedProcess(args, 0, exact_pr()["url"] + "\n", "")
            raise AssertionError(f"unexpected command: {call}")

        with self.assertRaises(publisher.PublisherError):
            publisher.ensure_remote_and_pr(self.candidate, self.config, runner=runner)

        self.assertFalse(any(
            Path(call[0]).name == "gh" and call[1:3] == ["pr", "create"]
            for call in calls
        ))

    def test_deleted_branch_with_prior_pr_history_rejects_before_push(self):
        calls = []
        prior = exact_pr(
            state="CLOSED",
            headRefOid="c" * 40,
            baseRefName="main",
            baseRefOid="d" * 40,
        )

        def runner(args, **_kwargs):
            call = list(args)
            calls.append(call)
            if "ls-remote" in call:
                ref = call[-1]
                output = "" if ref.endswith(self.candidate.branch) else f"{BASE_SHA}\t{ref}\n"
                return subprocess.CompletedProcess(args, 0, output, "")
            if Path(call[0]).name == "gh" and call[1:3] == ["pr", "list"]:
                return subprocess.CompletedProcess(args, 0, json.dumps([prior]) + "\n", "")
            if "push" in call:
                raise AssertionError("publisher pushed before checking complete PR history")
            raise AssertionError(f"unexpected command: {call}")

        with self.assertRaisesRegex(publisher.PublisherError, "history"):
            publisher.ensure_remote_and_pr(self.candidate, self.config, runner=runner)

        self.assertFalse(any("push" in call for call in calls))

    def test_pr_history_is_rechecked_immediately_before_create(self):
        calls = []
        history_reads = 0

        def runner(args, **kwargs):
            nonlocal history_reads
            call = list(args)
            calls.append(call)
            if "ls-remote" in call:
                ref = call[-1]
                sha = HEAD_SHA if ref.endswith(self.candidate.branch) else BASE_SHA
                return subprocess.CompletedProcess(args, 0, f"{sha}\t{ref}\n", "")
            if Path(call[0]).name == "gh" and call[1:3] == ["pr", "list"]:
                history_reads += 1
                value = [] if history_reads == 1 else [exact_pr()]
                return subprocess.CompletedProcess(args, 0, json.dumps(value) + "\n", "")
            if Path(call[0]).name == "gh" and call[1:3] == ["pr", "create"]:
                return subprocess.CompletedProcess(args, 0, exact_pr()["url"] + "\n", "")
            raise AssertionError(f"unexpected command: {call}")

        result = publisher.ensure_remote_and_pr(self.candidate, self.config, runner=runner)

        self.assertEqual(result.number, 181)
        self.assertGreaterEqual(history_reads, 2)
        self.assertFalse(any(
            Path(call[0]).name == "gh" and call[1:3] == ["pr", "create"]
            for call in calls
        ))

    def test_cross_repository_pr_is_never_accepted(self):
        fork_pr = exact_pr(
            headRepositoryOwner={"login": "attacker"},
            isCrossRepository=True,
        )
        runner = QueueRunner([
            self.remote_feature(),
            self.remote_base(),
            response(stdout=json.dumps([fork_pr]) + "\n"),
        ])

        with self.assertRaisesRegex(publisher.PublisherError, "repository owner"):
            publisher.ensure_remote_and_pr(self.candidate, self.config, runner=runner)
        self.assertFalse(any(call[:3] == ["gh", "pr", "create"] for call, _ in runner.calls))

    def test_existing_pr_at_sealed_base_fast_forwards_without_force(self):
        old = exact_pr(
            headRefOid=BASE_SHA,
            labels=[{"name": "ready-for-gate"}],
        )
        old_unlabeled = exact_pr(headRefOid=BASE_SHA, labels=[])
        runner = QueueRunner([
            self.remote_feature(BASE_SHA),
            self.remote_base(),
            response(returncode=0),
            response(returncode=0),
            response(stdout=json.dumps([old]) + "\n"),
            response(stdout=""),
            response(stdout=json.dumps(old_unlabeled) + "\n"),
            self.remote_feature(BASE_SHA),
            self.remote_base(),
            response(stdout="pushed\n"),
            self.remote_feature(),
            response(stdout=json.dumps([exact_pr()]) + "\n"),
        ])

        result = publisher.ensure_remote_and_pr(self.candidate, self.config, runner=runner)

        self.assertEqual(result.head_sha, HEAD_SHA)
        self.assertTrue(any(
            Path(call[0]).name == "gh" and call[1:3] == ["pr", "edit"] and "--remove-label" in call
            for call, _ in runner.calls
        ))
        push = next(call for call, _ in runner.calls if "push" in call)
        self.assertNotIn("--force", push)
        self.assertFalse(any(part.startswith("--force-with-lease") for part in push))

    def test_closed_correction_pr_loses_stale_gate_label_before_push_and_reopen(self):
        closed_labeled = exact_pr(
            state="CLOSED",
            headRefOid=BASE_SHA,
            labels=[{"name": "ready-for-gate"}],
        )
        closed_unlabeled = exact_pr(state="CLOSED", headRefOid=BASE_SHA)
        closed_updated = exact_pr(state="CLOSED")
        runner = QueueRunner([
            self.remote_feature(BASE_SHA),
            self.remote_base(),
            response(returncode=0),
            response(returncode=0),
            response(stdout=json.dumps([closed_labeled]) + "\n"),
            response(stdout="removed\n"),
            response(stdout=json.dumps(closed_unlabeled) + "\n"),
            self.remote_feature(BASE_SHA),
            self.remote_base(),
            response(stdout="pushed\n"),
            self.remote_feature(),
            response(stdout=json.dumps([closed_updated]) + "\n"),
            self.remote_base(),
            response(stdout="reopened\n"),
            response(stdout=json.dumps([exact_pr()]) + "\n"),
        ])

        result = publisher.ensure_remote_and_pr(self.candidate, self.config, runner=runner)

        self.assertEqual(result.head_sha, HEAD_SHA)
        mutations = [
            call
            for call, _ in runner.calls
            if Path(call[0]).name in {"git", "gh"}
            and ("push" in call or call[1:3] in (["pr", "edit"], ["pr", "reopen"]))
        ]
        remove_index = next(index for index, call in enumerate(mutations) if "--remove-label" in call)
        push_index = next(index for index, call in enumerate(mutations) if "push" in call)
        reopen_index = next(index for index, call in enumerate(mutations) if call[1:3] == ["pr", "reopen"])
        self.assertLess(remove_index, push_index)
        self.assertLess(push_index, reopen_index)

    def test_closed_correction_label_remove_failure_blocks_push_and_reopen(self):
        closed_labeled = exact_pr(
            state="CLOSED",
            headRefOid=BASE_SHA,
            labels=[{"name": "ready-for-gate"}],
        )
        runner = QueueRunner([
            self.remote_feature(BASE_SHA),
            self.remote_base(),
            response(returncode=0),
            response(returncode=0),
            response(stdout=json.dumps([closed_labeled]) + "\n"),
            response(returncode=1, stderr="label mutation failed"),
        ])

        with self.assertRaisesRegex(publisher.PublisherError, "command failed"):
            publisher.ensure_remote_and_pr(self.candidate, self.config, runner=runner)

        self.assertTrue(any("--remove-label" in call for call, _ in runner.calls))
        self.assertFalse(any("push" in call for call, _ in runner.calls))
        self.assertFalse(any(
            Path(call[0]).name == "gh" and call[1:3] == ["pr", "reopen"]
            for call, _ in runner.calls
        ))

    def test_closed_correction_label_or_head_race_blocks_push_and_reopen(self):
        closed_labeled = exact_pr(
            state="CLOSED",
            headRefOid=BASE_SHA,
            labels=[{"name": "ready-for-gate"}],
        )
        raced = (
            exact_pr(
                state="CLOSED",
                headRefOid=BASE_SHA,
                labels=[{"name": "ready-for-gate"}],
            ),
            exact_pr(state="CLOSED", headRefOid="c" * 40),
            exact_pr(state="OPEN", headRefOid=BASE_SHA),
        )
        for readback in raced:
            with self.subTest(readback=readback):
                runner = QueueRunner([
                    self.remote_feature(BASE_SHA),
                    self.remote_base(),
                    response(returncode=0),
                    response(returncode=0),
                    response(stdout=json.dumps([closed_labeled]) + "\n"),
                    response(stdout="removed\n"),
                    response(stdout=json.dumps(readback) + "\n"),
                ])

                with self.assertRaises(publisher.PublisherError):
                    publisher.ensure_remote_and_pr(self.candidate, self.config, runner=runner)

                self.assertTrue(any("--remove-label" in call for call, _ in runner.calls))
                self.assertFalse(any("push" in call for call, _ in runner.calls))
                self.assertFalse(any(
                    Path(call[0]).name == "gh" and call[1:3] == ["pr", "reopen"]
                    for call, _ in runner.calls
                ))

    def test_correction_keeps_commit_parent_separate_from_current_target_base(self):
        target_sha = "d" * 40
        old = exact_pr(headRefOid=BASE_SHA, baseRefOid=target_sha)
        updated = exact_pr(baseRefOid=target_sha)
        runner = QueueRunner([
            self.remote_feature(BASE_SHA),
            self.remote_base(target_sha),
            response(returncode=0),
            response(returncode=0),
            response(stdout=json.dumps([old]) + "\n"),
            self.remote_feature(BASE_SHA),
            self.remote_base(target_sha),
            response(stdout="pushed\n"),
            self.remote_feature(),
            response(stdout=json.dumps([updated]) + "\n"),
        ])

        result = publisher.ensure_remote_and_pr(self.candidate, self.config, runner=runner)

        self.assertEqual(result.base_sha, target_sha)
        self.assertNotEqual(result.base_sha, self.candidate.base_sha)

    def test_remote_target_change_before_push_fails_closed(self):
        runner = QueueRunner([
            self.remote_feature(None),
            self.remote_base(),
            response(stdout="[]\n"),
            self.remote_feature(None),
            self.remote_base("d" * 40),
        ])
        with self.assertRaisesRegex(publisher.PublisherError, "snapshot changed"):
            publisher.ensure_remote_and_pr(self.candidate, self.config, runner=runner)
        self.assertFalse(any("push" in call for call, _ in runner.calls))

    def test_differing_remote_or_ambiguous_pr_rejects(self):
        runner = QueueRunner([
            self.remote_feature("c" * 40),
            self.remote_base(),
        ])
        with self.assertRaisesRegex(publisher.PublisherError, "remote feature head"):
            publisher.ensure_remote_and_pr(self.candidate, self.config, runner=runner)

        runner = QueueRunner([
            self.remote_feature(),
            self.remote_base(),
            response(stdout=json.dumps([exact_pr(), exact_pr(number=182)]) + "\n"),
        ])
        with self.assertRaisesRegex(publisher.PublisherError, "more than one"):
            publisher.ensure_remote_and_pr(self.candidate, self.config, runner=runner)

    def test_create_without_exact_readback_rejects(self):
        runner = QueueRunner([
            self.remote_feature(),
            self.remote_base(),
            response(stdout="[]\n"),
            self.remote_base(),
            response(stdout=exact_pr()["url"] + "\n"),
            response(stdout="[]\n"),
        ])
        with self.assertRaisesRegex(publisher.PublisherError, "readback"):
            publisher.ensure_remote_and_pr(self.candidate, self.config, runner=runner)

    def test_closed_unmerged_branch_pr_is_reopened_instead_of_duplicated(self):
        closed = exact_pr(state="CLOSED")
        opened = exact_pr()
        runner = QueueRunner([
            self.remote_feature(),
            self.remote_base(),
            response(stdout=json.dumps([closed]) + "\n"),
            self.remote_base(),
            response(stdout="reopened\n"),
            response(stdout=json.dumps([opened]) + "\n"),
        ])

        result = publisher.ensure_remote_and_pr(self.candidate, self.config, runner=runner)

        self.assertEqual(result.number, 181)
        self.assertTrue(any(
            Path(call[0]).name == "gh" and call[1:3] == ["pr", "reopen"]
            for call, _ in runner.calls
        ))
        self.assertFalse(any(
            Path(call[0]).name == "gh" and call[1:3] == ["pr", "create"]
            for call, _ in runner.calls
        ))

    def test_exact_head_closed_pr_loses_gate_label_before_reopen(self):
        closed_labeled = exact_pr(
            state="CLOSED",
            labels=[{"name": "ready-for-gate"}],
        )
        closed_unlabeled = exact_pr(state="CLOSED")
        runner = QueueRunner([
            self.remote_feature(),
            self.remote_base(),
            response(stdout=json.dumps([closed_labeled]) + "\n"),
            response(stdout="removed\n"),
            response(stdout=json.dumps(closed_unlabeled) + "\n"),
            self.remote_base(),
            response(stdout="reopened\n"),
            response(stdout=json.dumps([exact_pr()]) + "\n"),
        ])

        result = publisher.ensure_remote_and_pr(self.candidate, self.config, runner=runner)

        self.assertEqual(result.state, "OPEN")
        edits = [call for call, _ in runner.calls if Path(call[0]).name == "gh"]
        remove_index = next(index for index, call in enumerate(edits) if "--remove-label" in call)
        reopen_index = next(index for index, call in enumerate(edits) if call[1:3] == ["pr", "reopen"])
        self.assertLess(remove_index, reopen_index)

    def test_closed_retargeted_branch_pr_fails_before_reopen_or_mutation(self):
        retargeted = exact_pr(
            state="CLOSED",
            baseRefName="main",
            baseRefOid="d" * 40,
        )
        runner = QueueRunner([
            self.remote_feature(),
            self.remote_base(),
            response(stdout=json.dumps([retargeted]) + "\n"),
        ])

        with self.assertRaisesRegex(publisher.PublisherError, "authority"):
            publisher.ensure_remote_and_pr(self.candidate, self.config, runner=runner)

        mutations = (
            ["pr", "reopen"],
            ["pr", "edit"],
            ["pr", "create"],
        )
        self.assertFalse(any(
            Path(call[0]).name == "gh" and call[1:3] in mutations
            for call, _ in runner.calls
        ))

    def test_merged_branch_pr_is_never_reused_or_duplicated(self):
        merged = exact_pr(state="MERGED", mergedAt="2026-08-25T00:00:00Z")
        runner = QueueRunner([
            self.remote_feature(),
            self.remote_base(),
            response(stdout=json.dumps([merged]) + "\n"),
        ])
        with self.assertRaisesRegex(publisher.PublisherError, "already merged"):
            publisher.ensure_remote_and_pr(self.candidate, self.config, runner=runner)
        self.assertFalse(any(
            Path(call[0]).name == "gh" and call[1:3] == ["pr", "create"]
            for call, _ in runner.calls
        ))

    def test_newer_exact_pending_run_supersedes_older_green_run(self):
        pr = publisher.PublishedPullRequest.from_dict(exact_pr())
        older = self.run_payload(id=9001, status="completed", conclusion="success")
        newer = self.run_payload(
            id=9002,
            run_attempt=2,
            check_suite_id=778,
            status="in_progress",
            conclusion=None,
        )
        runner = QueueRunner(self.label_snapshot_responses() + [
            response(stdout=json.dumps(exact_pr()) + "\n"),
            response(stdout=json.dumps(self.workflow_payload()) + "\n"),
            response(stdout=json.dumps({"total_count": 2, "workflow_runs": [older, newer]}) + "\n"),
        ])
        with self.assertRaisesRegex(publisher.PublisherPending, "check"):
            publisher.ensure_ready_label(self.candidate, pr, self.config, runner=runner)

    def test_existing_ready_label_is_removed_when_newer_exact_ci_is_pending(self):
        labeled = exact_pr(labels=[{"name": "ready-for-gate"}])
        pr = publisher.PublishedPullRequest.from_dict(labeled)
        older = self.run_payload(id=9001, status="completed", conclusion="success")
        newer = self.run_payload(
            id=9002,
            run_attempt=2,
            check_suite_id=778,
            status="in_progress",
            conclusion=None,
        )
        runner = QueueRunner(self.label_snapshot_responses() + [
            response(stdout=json.dumps(labeled) + "\n"),
            response(stdout=json.dumps(self.workflow_payload()) + "\n"),
            response(stdout=json.dumps({"total_count": 2, "workflow_runs": [older, newer]}) + "\n"),
            response(stdout="removed\n"),
            response(stdout=json.dumps(exact_pr()) + "\n"),
        ])

        with self.assertRaisesRegex(publisher.PublisherPending, "check"):
            publisher.ensure_ready_label(self.candidate, pr, self.config, runner=runner)

        self.assertTrue(any(
            Path(call[0]).name == "gh" and "--remove-label" in call
            for call, _ in runner.calls
        ))

    def test_run_suite_and_attempt_must_bind_every_required_check(self):
        pr = publisher.PublishedPullRequest.from_dict(exact_pr())
        wrong_jobs = self.jobs_payload(run_attempt=2)
        runner = QueueRunner(self.label_snapshot_responses() + [
            response(stdout=json.dumps(exact_pr()) + "\n"),
            response(stdout=json.dumps(self.workflow_payload()) + "\n"),
            response(stdout=json.dumps({"total_count": 1, "workflow_runs": [self.run_payload()]}) + "\n"),
            response(stdout=json.dumps(wrong_jobs) + "\n"),
        ])
        with self.assertRaisesRegex(publisher.PublisherPending, "check"):
            publisher.ensure_ready_label(self.candidate, pr, self.config, runner=runner)

        suite_mismatch = self.check_payload(
            1,
            self.config.required_checks[0],
            check_suite={"id": 999},
        )
        runner = QueueRunner(self.label_snapshot_responses() + [
            response(stdout=json.dumps(exact_pr()) + "\n"),
            *self.green_ci_responses()[:3],
            response(stdout=json.dumps(suite_mismatch) + "\n"),
        ])
        with self.assertRaisesRegex(publisher.PublisherPending, "check"):
            publisher.ensure_ready_label(self.candidate, pr, self.config, runner=runner)

    def workflow_payload(self, **overrides):
        value = {
            "id": 227376261,
            "name": "E2E Tests",
            "path": ".github/workflows/e2e-tests.yml",
            "state": "active",
        }
        value.update(overrides)
        return value

    def run_payload(self, **overrides):
        value = {
            "id": 9001,
            "run_attempt": 1,
            "check_suite_id": 777,
            "workflow_id": 227376261,
            "name": "E2E Tests",
            "path": ".github/workflows/e2e-tests.yml",
            "event": "pull_request",
            "status": "completed",
            "conclusion": "success",
            "head_sha": HEAD_SHA,
            "head_branch": self.candidate.branch,
            "pull_requests": [{
                "number": 181,
                "head": {
                    "sha": HEAD_SHA,
                    "ref": self.candidate.branch,
                    "repo": {"url": "https://api.github.com/repos/momomojo/Radulator"},
                },
                "base": {
                    "sha": BASE_SHA,
                    "ref": "develop",
                    "repo": {"url": "https://api.github.com/repos/momomojo/Radulator"},
                },
            }],
        }
        value.update(overrides)
        return value

    def jobs_payload(self, **overrides):
        jobs = []
        for index, name in enumerate(self.config.required_checks, start=1):
            value = {
                "id": index,
                "run_id": 9001,
                "run_attempt": 1,
                "name": name,
                "head_sha": HEAD_SHA,
                "workflow_name": "E2E Tests",
                "status": "completed",
                "conclusion": "success",
                "check_run_url": f"https://api.github.com/repos/momomojo/Radulator/check-runs/{index}",
            }
            value.update(overrides)
            jobs.append(value)
        return {"total_count": len(jobs), "jobs": jobs}

    def check_payload(self, index, name, **overrides):
        value = {
            "id": index,
            "name": name,
            "head_sha": HEAD_SHA,
            "status": "completed",
            "conclusion": "success",
            "app": {"id": self.config.required_check_app_id, "slug": "github-actions"},
            "check_suite": {"id": 777},
        }
        value.update(overrides)
        return value

    def green_ci_responses(self):
        return [
            response(stdout=json.dumps(self.workflow_payload()) + "\n"),
            response(stdout=json.dumps({"total_count": 1, "workflow_runs": [self.run_payload()]}) + "\n"),
            response(stdout=json.dumps(self.jobs_payload()) + "\n"),
            *[
                response(stdout=json.dumps(self.check_payload(index, name)) + "\n")
                for index, name in enumerate(self.config.required_checks, start=1)
            ],
        ]

    def label_snapshot_responses(self):
        return [self.remote_feature(), self.remote_base()]

    def test_exact_required_checks_gate_label_and_exact_readback(self):
        labeled = exact_pr(labels=[{"name": "ready-for-gate"}])
        runner = QueueRunner(self.label_snapshot_responses() + [
            response(stdout=json.dumps(exact_pr()) + "\n"),
            *self.green_ci_responses(),
            response(stdout=""),
            *self.label_snapshot_responses(),
            *self.green_ci_responses(),
            response(stdout=json.dumps(labeled) + "\n"),
        ])
        pr = publisher.PublishedPullRequest.from_dict(exact_pr())

        result = publisher.ensure_ready_label(self.candidate, pr, self.config, runner=runner)

        self.assertEqual(result.labels, ("ready-for-gate",))
        self.assertTrue(any(Path(call[0]).name == "gh" and call[1:3] == ["pr", "edit"] for call, _ in runner.calls))

    def test_missing_failed_pending_or_wrong_app_check_never_labels(self):
        response_sets = [
            self.label_snapshot_responses() + [
                response(stdout=json.dumps(exact_pr()) + "\n"),
                response(stdout=json.dumps(self.workflow_payload(state="disabled_manually")) + "\n"),
            ],
            [
                *self.label_snapshot_responses(),
                response(stdout=json.dumps(exact_pr()) + "\n"),
                response(stdout=json.dumps(self.workflow_payload()) + "\n"),
                response(stdout=json.dumps({"total_count": 1, "workflow_runs": [self.run_payload(conclusion="failure")]}) + "\n"),
            ],
            self.label_snapshot_responses() + [
                response(stdout=json.dumps(exact_pr()) + "\n"),
                *self.green_ci_responses()[:2],
                response(stdout=json.dumps(self.jobs_payload(conclusion="failure")) + "\n"),
            ],
            self.label_snapshot_responses() + [
                response(stdout=json.dumps(exact_pr()) + "\n"),
                *self.green_ci_responses()[:3],
                response(stdout=json.dumps(self.check_payload(1, self.config.required_checks[0], app={"id": 999, "slug": "other"})) + "\n")
            ],
        ]
        pr = publisher.PublishedPullRequest.from_dict(exact_pr())
        for responses in response_sets:
            with self.subTest(response_count=len(responses)):
                runner = QueueRunner(responses)
                with self.assertRaisesRegex(publisher.PublisherPending, "check"):
                    publisher.ensure_ready_label(self.candidate, pr, self.config, runner=runner)
                self.assertFalse(any(Path(call[0]).name == "gh" and call[1:3] == ["pr", "edit"] for call, _ in runner.calls))

    def test_label_write_without_exact_head_readback_rejects(self):
        wrong = exact_pr(headRefOid="c" * 40, labels=[{"name": "ready-for-gate"}])
        wrong_unlabeled = exact_pr(headRefOid="c" * 40, labels=[])
        runner = QueueRunner(self.label_snapshot_responses() + [
            response(stdout=json.dumps(exact_pr()) + "\n"),
            *self.green_ci_responses(),
            response(stdout=""),
            *self.label_snapshot_responses(),
            *self.green_ci_responses(),
            response(stdout=json.dumps(wrong) + "\n"),
            response(stdout=""),
            response(stdout=json.dumps(wrong_unlabeled) + "\n"),
        ])
        pr = publisher.PublishedPullRequest.from_dict(exact_pr())
        with self.assertRaisesRegex(publisher.PublisherError, "exact"):
            publisher.ensure_ready_label(self.candidate, pr, self.config, runner=runner)
        self.assertTrue(any(
            Path(call[0]).name == "gh" and call[1:3] == ["pr", "edit"] and "--remove-label" in call
            for call, _ in runner.calls
        ))

    def test_label_timeout_is_compensated_and_absence_is_read_back(self):
        def timeout_after_server_write(_args, _kwargs):
            raise TimeoutError("simulated client timeout after label write")

        runner = QueueRunner(self.label_snapshot_responses() + [
            response(stdout=json.dumps(exact_pr()) + "\n"),
            *self.green_ci_responses(),
            timeout_after_server_write,
            response(stdout="removed\n"),
            response(stdout=json.dumps(exact_pr()) + "\n"),
        ])
        pr = publisher.PublishedPullRequest.from_dict(exact_pr())

        with self.assertRaisesRegex(TimeoutError, "simulated"):
            publisher.ensure_ready_label(self.candidate, pr, self.config, runner=runner)

        self.assertTrue(any(
            Path(call[0]).name == "gh" and call[1:3] == ["pr", "edit"] and "--remove-label" in call
            for call, _ in runner.calls
        ))

    def test_failed_label_compensation_is_a_distinct_unsafe_state(self):
        def timeout_after_server_write(_args, _kwargs):
            raise TimeoutError("simulated label write timeout")

        runner = QueueRunner(self.label_snapshot_responses() + [
            response(stdout=json.dumps(exact_pr()) + "\n"),
            *self.green_ci_responses(),
            timeout_after_server_write,
            response(returncode=1, stderr="cannot remove"),
        ])
        pr = publisher.PublishedPullRequest.from_dict(exact_pr())

        with self.assertRaisesRegex(publisher.PublisherError, "UNSAFE_LABEL_STATE"):
            publisher.ensure_ready_label(self.candidate, pr, self.config, runner=runner)

    def test_identityless_name_matched_checks_are_rejected(self):
        pr = publisher.PublishedPullRequest.from_dict(exact_pr())
        runner = QueueRunner(self.label_snapshot_responses() + [
            response(stdout=json.dumps(exact_pr()) + "\n"),
            *self.green_ci_responses()[:3],
            response(stdout=json.dumps(
                self.check_payload(1, self.config.required_checks[0], head_sha=None, check_suite=None)
            ) + "\n"),
        ])

        with self.assertRaisesRegex(publisher.PublisherPending, "check"):
            publisher.ensure_ready_label(self.candidate, pr, self.config, runner=runner)

        self.assertFalse(any(Path(call[0]).name == "gh" and call[1:3] == ["pr", "edit"] for call, _ in runner.calls))


class MutableKanban(FakeKanban):
    def __init__(self, tasks, events, child, parents=None):
        super().__init__(tasks, events)
        self.by_id = {item.id: item for item in tasks}
        self.by_id[child.id] = child
        self.comments = []
        self.completions = []
        self.parents = dict(parents or {child.id: ["t_example"], "t_example": []})

    def get_task(self, _conn, task_id):
        return self.by_id.get(task_id)

    def add_comment(self, _conn, task_id, author, body):
        record = SimpleNamespace(
            id=len(self.comments) + 1,
            task_id=task_id,
            author=author,
            body=body,
        )
        self.comments.append(record)
        return record.id

    def list_comments(self, _conn, task_id):
        return [item for item in self.comments if item.task_id == task_id]

    def parent_ids(self, _conn, task_id):
        return list(self.parents.get(task_id, []))

    def complete_task(self, _conn, task_id, **kwargs):
        self.completions.append((task_id, kwargs))
        current = self.by_id[task_id]
        self.by_id[task_id] = SimpleNamespace(**{**vars(current), "status": "done", "result": kwargs["result"]})
        return True

    def complete_trusted_publisher_authority(self, conn, **kwargs):
        task_id = kwargs["task_id"]
        current = self.by_id.get(task_id)
        tracker = self.by_id.get(kwargs["expected_tracker_id"])
        if (
            current is None
            or current.status != "blocked"
            or current.block_kind != "capability"
            or current.branch_name != kwargs["expected_branch_name"]
            or current.workspace_path != kwargs["expected_workspace_path"]
            or tracker is None
            or tracker.status != kwargs["expected_tracker_status"]
            or self.parent_ids(conn, kwargs["relation_task_id"])
            != kwargs["expected_parent_ids"]
        ):
            return {"contract": "hermes.trusted_publisher.completion-cas.v1", "status": "conflict"}
        self.complete_task(
            conn,
            task_id,
            result=kwargs["result"],
            summary=kwargs["summary"],
            metadata=kwargs["metadata"],
        )
        return {
            "contract": "hermes.trusted_publisher.completion-cas.v1",
            "status": "completed",
            "claim_id": kwargs["claim_id"],
            "host_receipt_id": kwargs["host_receipt_id"],
            "repository": kwargs["expected_repository"],
            "task_id": task_id,
            "run_id": kwargs["expected_run_id"],
            "board": kwargs["expected_board"],
            "project_id": kwargs["expected_project_id"],
            "workspace": kwargs["expected_workspace_path"],
            "branch": kwargs["expected_branch_name"],
            "base_sha": kwargs["expected_base_sha"],
            "head_sha": kwargs["expected_head_sha"],
            "changed_paths": kwargs["expected_changed_paths"],
            "tracker_id": kwargs["expected_tracker_id"],
        }


class TrustedPublisherLifecycleTests(unittest.TestCase):
    def setUp(self):
        self.env_patch = mock.patch.dict(os.environ, {"GH_TOKEN": "test-token"})
        self.env_patch.start()
        self.config = publisher.PublisherConfig(
            board="default",
            project_id="radulator",
            project_root=Path("/srv/radulator"),
            repository="momomojo/Radulator",
            base_branch="develop",
            expected_origin="momomojo/Radulator",
            lifecycle_controller=Path("/srv/radulator/ops/hermes/radulator/lifecycle_controller.py"),
            ledger_path=Path("/srv/radulator/state/release.jsonl"),
        )
        self.candidate = publisher.TrustedCommit(
            task_id="t_example",
            project_id="radulator",
            board="default",
            workspace="/srv/radulator/.worktrees/t_example",
            branch="radulator/t_example-feature",
            base_sha=BASE_SHA,
            head_sha=HEAD_SHA,
            changed_paths=("src/example.js",),
            run_id=17,
        )
        self.pr = publisher.PublishedPullRequest.from_dict(
            exact_pr(labels=[{"name": "ready-for-gate"}])
        )
        self.child = SimpleNamespace(
            id="t_release",
            status="todo",
            body=f"Track PR #181 at exact head {HEAD_SHA}",
            project_id=None,
        )

    def tearDown(self):
        self.env_patch.stop()

    def kb(self):
        return MutableKanban(
            [task()],
            {"t_example": exact_events(changed_paths=["src/example.js"])},
            self.child,
        )

    @staticmethod
    def labeled_pr_response():
        return response(
            stdout=json.dumps(exact_pr(labels=[{"name": "ready-for-gate"}])) + "\n"
        )

    def test_bootstraps_exact_tracker_then_completes_implementation_task(self):
        kb = self.kb()
        rendered = [{
            "kind": "create_child",
            "task_id": "t_release",
            "idempotency_key": "radulator-release:t_example:pr-181",
        }]
        seed = {
            "idempotency_key": f"radulator-feedback:t_release:pr-181:{HEAD_SHA}",
            "source_id": "t_example",
            "task_id": "t_release",
            "state": "feedback",
            "pr": 181,
            "head_sha": HEAD_SHA,
        }
        runner = QueueRunner([
            self.labeled_pr_response(),
            response(stdout="{}\n"),
            response(stdout=json.dumps(rendered) + "\n"),
            response(stdout=json.dumps(seed) + "\n"),
            response(stdout=json.dumps(seed) + "\n"),
            self.labeled_pr_response(),
            self.labeled_pr_response(),
        ])

        tracker = publisher.complete_lifecycle_handoff(
            self.candidate,
            self.pr,
            self.config,
            kb,
            object(),
            runner=runner,
        )

        self.assertEqual(tracker, "t_release")
        self.assertEqual(len(kb.comments), 1)
        self.assertEqual(len(kb.completions), 1)
        task_id, completion = kb.completions[0]
        self.assertEqual(task_id, "t_example")
        self.assertIn(self.pr.url, completion["result"])
        self.assertIn(HEAD_SHA, completion["result"])
        self.assertIn("t_release", completion["result"])
        self.assertEqual(kb.get_task(None, "t_example").status, "done")

    def test_pr_head_change_before_task_completion_fails_closed(self):
        kb = self.kb()
        rendered = [{
            "kind": "create_child",
            "task_id": "t_release",
            "idempotency_key": "radulator-release:t_example:pr-181",
        }]
        seed = {
            "idempotency_key": f"radulator-feedback:t_release:pr-181:{HEAD_SHA}",
            "source_id": "t_example",
            "task_id": "t_release",
            "state": "feedback",
            "pr": 181,
            "head_sha": HEAD_SHA,
        }
        wrong_head = exact_pr(
            headRefOid="c" * 40,
            labels=[{"name": "ready-for-gate"}],
        )
        runner = QueueRunner([
            response(stdout=json.dumps(exact_pr(labels=[{"name": "ready-for-gate"}])) + "\n"),
            response(stdout="{}\n"),
            response(stdout=json.dumps(rendered) + "\n"),
            response(stdout=json.dumps(seed) + "\n"),
            response(stdout=json.dumps(seed) + "\n"),
            response(stdout=json.dumps(wrong_head) + "\n"),
        ])

        with self.assertRaisesRegex(publisher.PublisherError, "exact expected state"):
            publisher.complete_lifecycle_handoff(
                self.candidate,
                self.pr,
                self.config,
                kb,
                object(),
                runner=runner,
            )

        self.assertEqual(kb.comments, [])
        self.assertEqual(kb.completions, [])

    def test_changed_sealed_event_rejects_before_lifecycle_mutation(self):
        kb = self.kb()
        kb.events["t_example"] = exact_events(
            head_sha="c" * 40, changed_paths=["src/example.js"]
        )
        runner = QueueRunner([])
        with self.assertRaisesRegex(publisher.PublisherError, "changed"):
            publisher.complete_lifecycle_handoff(
                self.candidate, self.pr, self.config, kb, object(), runner=runner
            )
        self.assertEqual(kb.comments, [])
        self.assertEqual(kb.completions, [])

    def test_final_authority_cas_rejects_concurrent_tracker_mutation(self):
        class ConcurrentKanban(MutableKanban):
            def complete_trusted_publisher_authority(self, _conn, **kwargs):
                tracker = self.by_id[kwargs["expected_tracker_id"]]
                self.by_id[tracker.id] = SimpleNamespace(
                    **{**vars(tracker), "status": "done"}
                )
                return {
                    "contract": "hermes.trusted_publisher.completion-cas.v1",
                    "status": "conflict",
                }

        kb = ConcurrentKanban(
            [task()],
            {"t_example": exact_events(changed_paths=["src/example.js"])},
            self.child,
        )
        rendered = [{
            "kind": "create_child",
            "task_id": "t_release",
            "idempotency_key": "radulator-release:t_example:pr-181",
        }]
        seed = {
            "idempotency_key": f"radulator-feedback:t_release:pr-181:{HEAD_SHA}",
            "source_id": "t_example",
            "task_id": "t_release",
            "state": "feedback",
            "pr": 181,
            "head_sha": HEAD_SHA,
        }
        runner = QueueRunner([
            self.labeled_pr_response(),
            response(stdout="{}\n"),
            response(stdout=json.dumps(rendered) + "\n"),
            response(stdout=json.dumps(seed) + "\n"),
            response(stdout=json.dumps(seed) + "\n"),
            self.labeled_pr_response(),
            self.labeled_pr_response(),
        ])

        with self.assertRaisesRegex(publisher.PublisherError, "authority CAS"):
            publisher.complete_lifecycle_handoff(
                self.candidate, self.pr, self.config, kb, object(), runner=runner
            )

        self.assertEqual(kb.completions, [])
        self.assertEqual(kb.get_task(None, "t_example").status, "blocked")

    def test_malformed_or_mismatched_tracker_output_rejects(self):
        cases = [
            [],
            [{"kind": "create_child", "task_id": "bad", "idempotency_key": "wrong"}],
            [{
                "kind": "create_child",
                "task_id": "t_release",
                "idempotency_key": "radulator-release:t_other:pr-181",
            }],
        ]
        for rendered in cases:
            with self.subTest(rendered=rendered):
                kb = self.kb()
                runner = QueueRunner([
                    self.labeled_pr_response(),
                    response(stdout="{}\n"),
                    response(stdout=json.dumps(rendered) + "\n"),
                ])
                with self.assertRaisesRegex(publisher.PublisherError, "tracker"):
                    publisher.complete_lifecycle_handoff(
                        self.candidate, self.pr, self.config, kb, object(), runner=runner
                    )
                self.assertEqual(kb.completions, [])

    def test_terminal_or_mismatched_child_rejects(self):
        rendered = [{
            "kind": "create_child",
            "task_id": "t_release",
            "idempotency_key": "radulator-release:t_example:pr-181",
        }]
        for child in (
            SimpleNamespace(id="t_release", status="done", body=f"PR #181 {HEAD_SHA}"),
            SimpleNamespace(id="t_release", status="todo", body="wrong"),
            SimpleNamespace(
                id="t_release",
                status="todo",
                body=f"Track PR #1810 at exact head {HEAD_SHA}f",
            ),
        ):
            with self.subTest(child=child):
                kb = MutableKanban(
                    [task()],
                    {"t_example": exact_events(changed_paths=["src/example.js"])},
                    child,
                )
                runner = QueueRunner([
                    self.labeled_pr_response(),
                    response(stdout="{}\n"),
                    response(stdout=json.dumps(rendered) + "\n"),
                ])
                with self.assertRaisesRegex(publisher.PublisherError, "tracker"):
                    publisher.complete_lifecycle_handoff(
                        self.candidate, self.pr, self.config, kb, object(), runner=runner
                    )
                self.assertEqual(kb.completions, [])

    def test_correction_reuses_existing_release_tracker(self):
        config = dataclasses.replace(
            self.config,
            ledger_path=Path("/srv/radulator/state/release.jsonl"),
        )
        existing = {
            "t_release": {
                "task_id": "t_release",
                "pr": 181,
                "head_sha": BASE_SHA,
                "state": "needs_fix",
                "source_id": "t_original",
            }
        }
        kb = self.kb()
        kb.parents["t_example"] = ["t_release"]
        kb.by_id["t_release"].body = f"Track clinical release of Radulator PR #181 at {BASE_SHA}"
        runner = QueueRunner([
            self.labeled_pr_response(),
            response(stdout=json.dumps(existing) + "\n"),
            self.labeled_pr_response(),
            self.labeled_pr_response(),
        ])

        tracker = publisher.complete_lifecycle_handoff(
            self.candidate,
            self.pr,
            config,
            kb,
            object(),
            runner=runner,
        )

        self.assertEqual(tracker, "t_release")
        self.assertFalse(any("bootstrap" in call for call, _ in runner.calls))
        self.assertEqual(len(kb.completions), 1)

    def test_bootstrap_requires_exact_parent_relation_before_ledger_seed(self):
        kb = self.kb()
        kb.parents["t_release"] = ["t_foreign"]
        rendered = [{
            "kind": "create_child",
            "task_id": "t_release",
            "idempotency_key": "radulator-release:t_example:pr-181",
        }]
        runner = QueueRunner([
            self.labeled_pr_response(),
            response(stdout="{}\n"),
            response(stdout=json.dumps(rendered) + "\n"),
        ])
        with self.assertRaisesRegex(publisher.PublisherError, "bootstrap readback"):
            publisher.complete_lifecycle_handoff(
                self.candidate, self.pr, self.config, kb, object(), runner=runner
            )
        self.assertFalse(any("append" in call for call, _ in runner.calls))
        self.assertEqual(kb.completions, [])

    def test_exact_audit_comment_is_idempotent_on_retry(self):
        kb = self.kb()
        rendered = [{
            "kind": "create_child",
            "task_id": "t_release",
            "idempotency_key": "radulator-release:t_example:pr-181",
        }]
        seed = {
            "idempotency_key": f"radulator-feedback:t_release:pr-181:{HEAD_SHA}",
            "source_id": "t_example",
            "task_id": "t_release",
            "state": "feedback",
            "pr": 181,
            "head_sha": HEAD_SHA,
        }
        body = (
            "TRUSTED_PUBLISHER v1 publication verified. "
            f"PR {self.pr.url}; exact head {HEAD_SHA}; release tracker t_release."
        )
        kb.comments.append(SimpleNamespace(
            id=1,
            task_id="t_example",
            author="radulator-trusted-publisher",
            body=body,
        ))
        runner = QueueRunner([
            self.labeled_pr_response(),
            response(stdout="{}\n"),
            response(stdout=json.dumps(rendered) + "\n"),
            response(stdout=json.dumps(seed) + "\n"),
            response(stdout=json.dumps(seed) + "\n"),
            self.labeled_pr_response(),
            self.labeled_pr_response(),
        ])

        publisher.complete_lifecycle_handoff(
            self.candidate, self.pr, self.config, kb, object(), runner=runner
        )

        self.assertEqual(len(kb.comments), 1)


class TrustedPublisherRunTests(unittest.TestCase):
    def setUp(self):
        self.config = publisher.PublisherConfig(
            board="default",
            project_id="radulator",
            project_root=Path("/srv/radulator"),
            repository="momomojo/Radulator",
            base_branch="develop",
            expected_origin="momomojo/Radulator",
            lifecycle_controller=Path("/srv/radulator/ops/hermes/radulator/lifecycle_controller.py"),
        )
        self.candidate = publisher.TrustedCommit(
            task_id="t_example",
            project_id="radulator",
            board="default",
            workspace="/srv/radulator/.worktrees/t_example",
            branch="radulator/t_example-feature",
            base_sha=BASE_SHA,
            head_sha=HEAD_SHA,
            changed_paths=("src/example.js",),
            run_id=17,
        )
        self.pr = publisher.PublishedPullRequest.from_dict(exact_pr())
        self.labeled = publisher.PublishedPullRequest.from_dict(
            exact_pr(labels=[{"name": "ready-for-gate"}])
        )

    def test_no_candidate_is_a_silent_noop(self):
        kb = FakeKanban([], {})
        with mock.patch.object(publisher, "validate_local_candidate") as local:
            result = publisher.run_once(self.config, kb, object())
        self.assertEqual(result, {"status": "idle"})
        local.assert_not_called()

    def test_missing_authority_runtime_fails_closed_before_publication(self):
        kb = FakeKanban(
            [task()],
            {"t_example": exact_events(changed_paths=["src/example.js"])},
        )
        kb.claim_trusted_publisher_authority = None
        with mock.patch.object(publisher, "validate_local_candidate") as local, \
             mock.patch.object(publisher, "ensure_remote_and_pr") as remote, \
             mock.patch.object(publisher, "ensure_ready_label") as label:
            result = publisher.run_once(self.config, kb, object())

        self.assertEqual(result["status"], "pending_runtime")
        self.assertRegex(result["reason"], "PENDING_HERMES_RUNTIME.*authority")
        local.assert_not_called()
        remote.assert_not_called()
        label.assert_not_called()

    def test_pending_ci_preserves_blocked_task_without_lifecycle_handoff(self):
        kb = FakeKanban([task()], {"t_example": exact_events(changed_paths=["src/example.js"])})
        with mock.patch.object(publisher, "validate_local_candidate"), \
             mock.patch.object(publisher, "ensure_remote_and_pr", return_value=self.pr), \
             mock.patch.object(
                 publisher,
                 "ensure_ready_label",
                 side_effect=publisher.PublisherPending("checks pending"),
             ), \
             mock.patch.object(publisher, "complete_lifecycle_handoff") as handoff:
            result = publisher.run_once(self.config, kb, object())
        self.assertEqual(result["status"], "pending_ci")
        handoff.assert_not_called()

    def test_sparse_unbound_authority_receipt_is_pending_before_publication(self):
        kb = FakeKanban([task()], {"t_example": exact_events(changed_paths=["src/example.js"])})

        def sparse_claim(_conn, **kwargs):
            return {
                "contract": "hermes.trusted_publisher.authority-claim.v1",
                "status": "claimed",
                "claim_id": "publisher:t_example:17",
                "task_id": kwargs["task_id"],
                "run_id": kwargs["expected_run_id"],
                "branch": kwargs["expected_branch_name"],
                "base_sha": kwargs["expected_base_sha"],
                "head_sha": kwargs["expected_head_sha"],
            }

        kb.claim_trusted_publisher_authority = sparse_claim
        with mock.patch.object(publisher, "validate_local_candidate") as local, \
             mock.patch.object(publisher, "ensure_remote_and_pr", return_value=self.pr) as remote, \
             mock.patch.object(
                 publisher,
                 "ensure_ready_label",
                 side_effect=publisher.PublisherPending("checks pending"),
             ):
            result = publisher.run_once(self.config, kb, object())

        self.assertEqual(result["status"], "pending_runtime")
        self.assertRegex(result["reason"], "exact v1 receipt")
        local.assert_not_called()
        remote.assert_not_called()

    def test_happy_path_completes_exact_handoff(self):
        kb = FakeKanban([task()], {"t_example": exact_events(changed_paths=["src/example.js"])})
        with mock.patch.object(publisher, "validate_local_candidate") as local, \
             mock.patch.object(publisher, "ensure_remote_and_pr", return_value=self.pr), \
             mock.patch.object(publisher, "ensure_ready_label", return_value=self.labeled), \
             mock.patch.object(publisher, "complete_lifecycle_handoff", return_value="t_release") as handoff:
            result = publisher.run_once(self.config, kb, object())
        self.assertEqual(result, {
            "status": "published",
            "task_id": "t_example",
            "pr": 181,
            "head_sha": HEAD_SHA,
            "release_tracker_id": "t_release",
        })
        local.assert_called_once_with(self.candidate, self.config, runner=subprocess.run)
        handoff.assert_called_once()
        self.assertEqual(len(kb.authority_claims), 1)
        claim_request = kb.authority_claims[0]
        self.assertEqual(claim_request["task_id"], self.candidate.task_id)
        self.assertEqual(claim_request["expected_run_id"], self.candidate.run_id)
        self.assertEqual(claim_request["expected_branch_name"], self.candidate.branch)
        self.assertEqual(claim_request["expected_head_sha"], self.candidate.head_sha)
        self.assertEqual(claim_request["expected_repository"], self.config.repository)
        self.assertEqual(claim_request["expected_board"], self.config.board)
        self.assertEqual(claim_request["expected_project_id"], self.candidate.project_id)
        self.assertEqual(claim_request["expected_workspace_path"], self.candidate.workspace)
        self.assertEqual(claim_request["expected_base_sha"], self.candidate.base_sha)
        self.assertEqual(claim_request["expected_changed_paths"], list(self.candidate.changed_paths))
        authority = handoff.call_args.kwargs["authority"]
        self.assertEqual(authority["claim_id"], "publisher:t_example:17")

    def test_kernel_lock_has_single_owner_and_releases(self):
        with tempfile.TemporaryDirectory() as directory:
            lock_path = Path(directory) / "publisher.lock"
            with publisher.publisher_lock(lock_path) as first:
                self.assertTrue(first)
                with publisher.publisher_lock(lock_path) as second:
                    self.assertFalse(second)
            with publisher.publisher_lock(lock_path) as third:
                self.assertTrue(third)

    def test_cli_config_requires_absolute_project_and_lock_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "Radulator"
            root.mkdir()
            controller = root / "ops/hermes/radulator/lifecycle_controller.py"
            controller.parent.mkdir(parents=True)
            controller.write_text("# test\n")
            lock = Path(directory) / "state/publisher.lock"
            config, parsed_lock = publisher.parse_runtime_config([
                "--board", "default",
                "--project-id", "radulator",
                "--project-root", str(root),
                "--repository", "momomojo/Radulator",
                "--base-branch", "develop",
                "--expected-origin", "momomojo/Radulator",
                "--lifecycle-controller", str(controller),
                "--ledger", str(Path(directory) / "state/release.jsonl"),
                "--lock-file", str(lock),
            ])
            self.assertEqual(config.project_root, root.resolve())
            self.assertEqual(parsed_lock, lock)
            with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                publisher.parse_runtime_config(["--project-root", "relative"])


if __name__ == "__main__":
    unittest.main()
