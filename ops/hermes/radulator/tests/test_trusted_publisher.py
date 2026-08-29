import dataclasses
import contextlib
import hashlib
import inspect
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


def broker_remote_repository():
    return {
        "contract": "hermes.github_repository.v1",
        "host": "github.com",
        "owner": "momomojo",
        "name": "Radulator",
        "full_name": "momomojo/Radulator",
        "repository_id": 1027532341,
        "canonical_url": "https://github.com/momomojo/Radulator",
        "is_fork": False,
        "publication_policy": {
            "pull_request_base": "develop",
            "workflow_id": 227376261,
            "workflow_name": "E2E Tests",
            "workflow_path": ".github/workflows/e2e-tests.yml",
            "workflow_event": "pull_request",
            "required_job_names": [
                "Smoke Tests",
                "Targeted Calculator Tests",
                "Hermes Release Control Tests",
            ],
            "required_app": {"id": 15368, "slug": "github-actions"},
            "ready_label_actor": {
                "id": 35302851,
                "login": "momomojo",
                "type": "User",
            },
            "ready_label": "ready-for-gate",
        },
    }


def broker_event(**overrides):
    remote = broker_remote_repository()
    value = {
        "contract": "hermes.trusted_local_commit.v1",
        "broker_boundary": "hermes.dedicated_broker_identity.v1",
        "receipt_id": "klc_1234567890abcdef1234567890abcdef",
        "key_id": "1" * 24,
        "task_id": "t_example",
        "run_id": 17,
        "claim_generation": 1,
        "dispatch_authority_receipt_id": "kda_1234567890abcdef1234567890abcdef",
        "dispatch_authority_payload_sha256": "2" * 64,
        "project_id": "radulator",
        "board": "default",
        "repository_id": "radulator",
        "repository_fingerprint": "3" * 64,
        "remote_repository": remote,
        "remote_repository_sha256": "",
        "workspace": "/private/hermes/workspaces/t_example",
        "workspace_id": "workspace_123",
        "workspace_manifest_sha256": "5" * 64,
        "branch": "radulator/t_example-feature",
        "base_branch": "develop",
        "base_sha": BASE_SHA,
        "target_base_sha": BASE_SHA,
        "head_sha": HEAD_SHA,
        "changed_paths": ["src/example.js"],
        "changed_entries": [
            {
                "path": "src/example.js",
                "operation": "add",
                "mode": "100644",
                "sha256": "6" * 64,
                "size": 24,
            }
        ],
        "publisher_state": "awaiting",
        "reason": "AWAITING_TRUSTED_PUBLISHER v1",
        "payload_sha256": "",
    }
    value.update(overrides)
    if "remote_repository_sha256" not in overrides:
        value["remote_repository_sha256"] = hashlib.sha256(
            json.dumps(
                value["remote_repository"], sort_keys=True, separators=(",", ":")
            ).encode("utf-8")
        ).hexdigest()
    if "payload_sha256" not in overrides:
        value["payload_sha256"] = hashlib.sha256(
            json.dumps(
                {key: item for key, item in value.items() if key != "payload_sha256"},
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest()
    return value


class FakeBrokerClient:
    def __init__(self, *, event_payload=None, handoff=None, ack_overrides=None, ack_error=None):
        self.event_payload = event_payload or broker_event()
        self.handoff = handoff
        self.ack_overrides = dict(ack_overrides or {})
        self.ack_error = ack_error
        self.ack_response = None
        self.calls = []

    def call(self, method, body):
        self.calls.append((method, body))
        if method == "list_publish_obligations":
            payload = self.event_payload
            return {
                "contract": "hermes.publisher_obligation_query.v1",
                "broker_boundary": "hermes.dedicated_broker_identity.v1",
                "items": [{
                    "contract": "hermes.trusted_local_commit.v1",
                    "broker_boundary": "hermes.dedicated_broker_identity.v1",
                    "receipt_id": payload["receipt_id"],
                    "key_id": payload["key_id"],
                    "payload_sha256": payload["payload_sha256"],
                    "verified": True,
                    "revoked": False,
                    "operation_state": "EMITTED",
                    "canonical_payload": payload,
                    "created_at": 123,
                }],
                "has_more": False,
                "next_cursor": {
                    "created_at": 123,
                    "receipt_id": payload["receipt_id"],
                },
            }
        if method == "export_bundle" and self.handoff is not None:
            return self.handoff
        if method == "ack_publish":
            if self.ack_error is not None:
                raise self.ack_error
            response = {
                "contract": "hermes.publisher_ack.v1",
                "broker_boundary": "hermes.dedicated_broker_identity.v1",
                "receipt_id": body["receipt_id"],
                "task_id": body["task_id"],
                "run_id": body["run_id"],
                "repository_id": body["repository_id"],
                "branch": body["branch"],
                "base_branch": body["base_branch"],
                "head_sha": body["head_sha"],
                "branch_published_from": body["base_sha"],
                "branch_published_to": body["head_sha"],
                "repository_base_sha": body["target_base_sha"],
                "publish_outcome": "fast_forwarded",
                "cleanup_state": "cleaned",
                "completion_id": "kpc_1234567890abcdef1234567890abcdef",
                "completion_payload_sha256": "8" * 64,
                "remote_readback_sha256": hashlib.sha256(
                    publisher._canonical_json(body["remote_readback"])
                ).hexdigest(),
            }
            response.update(self.ack_overrides)
            self.ack_response = response
            return response
        raise AssertionError(f"unexpected broker call: {method}")


class DedicatedBrokerPublisherTests(unittest.TestCase):
    def broker_config(self, root):
        return publisher.PublisherConfig(
            board="default",
            project_id="radulator",
            project_root=Path(root),
            repository="momomojo/Radulator",
            base_branch="develop",
            expected_origin="momomojo/Radulator",
            lifecycle_controller=Path(root) / "lifecycle_controller.py",
            repository_id="radulator",
            publisher_state_dir=Path(root) / ".publisher-state",
            expected_broker_uid=os.geteuid(),
            publisher_gid=os.getegid(),
            github_repository_id=1027532341,
            required_workflow_id=227376261,
            ready_label_actor_id=35302851,
            ready_label_actor_login="momomojo",
            ready_label_actor_type="User",
        )

    def test_selects_only_exact_verified_broker_obligation(self):
        with tempfile.TemporaryDirectory() as directory:
            config = self.broker_config(directory)
            client = FakeBrokerClient()

            candidate = publisher.select_broker_obligation(client, config)

            self.assertEqual(candidate.task_id, "t_example")
            self.assertEqual(candidate.repository_id, "radulator")
            self.assertEqual(candidate.receipt_id, broker_event()["receipt_id"])
            self.assertEqual(candidate.head_sha, HEAD_SHA)
            self.assertEqual(client.calls, [(
                "list_publish_obligations",
                {
                    "contract": "hermes.publisher_obligation_query.v1",
                    "repository_id": "radulator",
                    "after_created_at": 0,
                    "after_receipt_id": "",
                    "limit": 1,
                },
            )])

    def test_rejects_broker_obligation_with_wrong_repository_or_extra_event_field(self):
        with tempfile.TemporaryDirectory() as directory:
            config = self.broker_config(directory)
            for payload in (
                broker_event(repository_id="other"),
                {**broker_event(), "unsealed": True},
                broker_event(base_branch="main"),
            ):
                with self.subTest(payload=payload):
                    with self.assertRaises(publisher.PublisherError):
                        publisher.select_broker_obligation(
                            FakeBrokerClient(event_payload=payload), config
                        )

    def test_stages_exact_broker_bundle_into_private_publisher_repository(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source"
            publisher_repo = root / "publisher-repo"
            source.mkdir()
            subprocess.run(["git", "init", "-b", "develop"], cwd=source, check=True, capture_output=True)
            subprocess.run(["git", "config", "user.name", "Test"], cwd=source, check=True)
            subprocess.run(["git", "config", "user.email", "test@example.invalid"], cwd=source, check=True)
            (source / "README.md").write_text("base\n", encoding="utf-8")
            deleted_content = b"delete me\n"
            (source / "delete.txt").write_bytes(deleted_content)
            subprocess.run(["git", "add", "."], cwd=source, check=True)
            subprocess.run(["git", "commit", "-m", "base"], cwd=source, check=True, capture_output=True)
            base_sha = subprocess.run(
                ["git", "rev-parse", "HEAD"], cwd=source, check=True, capture_output=True, text=True
            ).stdout.strip()
            subprocess.run(["git", "switch", "-c", "radulator/t_example-feature"], cwd=source, check=True, capture_output=True)
            modified_content = b"updated\n"
            (source / "README.md").write_bytes(modified_content)
            (source / "delete.txt").unlink()
            (source / "src").mkdir()
            source_content = b"\x00\xffbroker-binary\n"
            (source / "src" / "example.bin").write_bytes(source_content)
            subprocess.run(["git", "add", "."], cwd=source, check=True)
            subprocess.run(["git", "commit", "-m", "feature"], cwd=source, check=True, capture_output=True)
            head_sha = subprocess.run(
                ["git", "rev-parse", "HEAD"], cwd=source, check=True, capture_output=True, text=True
            ).stdout.strip()
            bundle = root / "broker.bundle"
            subprocess.run(
                ["git", "bundle", "create", str(bundle), "refs/heads/radulator/t_example-feature"],
                cwd=source,
                check=True,
                capture_output=True,
            )
            bundle.chmod(0o640)
            subprocess.run(["git", "clone", str(source), str(publisher_repo)], check=True, capture_output=True)
            publisher_repo.chmod(0o700)
            config = dataclasses.replace(
                self.broker_config(publisher_repo),
                expected_origin=str(source.resolve()),
                publisher_state_dir=root / "publisher-state",
            )
            event_payload = broker_event(
                base_sha=base_sha,
                target_base_sha=base_sha,
                head_sha=head_sha,
                changed_paths=["README.md", "delete.txt", "src/example.bin"],
                changed_entries=[
                    {
                        "path": "README.md",
                        "operation": "modify",
                        "mode": "100644",
                        "sha256": hashlib.sha256(modified_content).hexdigest(),
                        "size": len(modified_content),
                    },
                    {
                        "path": "delete.txt",
                        "operation": "delete",
                        "mode": "100644",
                        "sha256": None,
                        "size": 0,
                    },
                    {
                        "path": "src/example.bin",
                        "operation": "add",
                        "mode": "100644",
                        "sha256": hashlib.sha256(source_content).hexdigest(),
                        "size": len(source_content),
                    },
                ],
            )
            client = FakeBrokerClient(event_payload=event_payload)
            candidate = publisher.select_broker_obligation(client, config)
            content = bundle.read_bytes()
            handoff = {
                "contract": "hermes.publisher_object_handoff.v1",
                "broker_boundary": "hermes.dedicated_broker_identity.v1",
                "receipt_id": event_payload["receipt_id"],
                "receipt_payload_sha256": event_payload["payload_sha256"],
                "bundle_path": str(bundle),
                "bundle_sha256": hashlib.sha256(content).hexdigest(),
                "bundle_size": len(content),
                "repository_id": "radulator",
                "branch": event_payload["branch"],
                "base_branch": "develop",
                "base_sha": base_sha,
                "target_base_sha": base_sha,
                "head_sha": head_sha,
            }

            staged = publisher.stage_broker_bundle(candidate, handoff, config)

            self.assertEqual(staged.workspace, str(publisher_repo.resolve()))
            self.assertEqual(staged.sealed_workspace, event_payload["workspace"])
            self.assertEqual(staged.bundle_sha256, handoff["bundle_sha256"])
            self.assertEqual(
                subprocess.run(
                    [
                        "git",
                        "rev-parse",
                        f"refs/hermes-publisher/{event_payload['receipt_id']}",
                    ],
                    cwd=publisher_repo,
                    check=True,
                    capture_output=True,
                    text=True,
                ).stdout.strip(),
                head_sha,
            )
            self.assertEqual(
                publisher.validate_local_candidate(staged, config), staged
            )
            for field, wrong_value in (
                ("operation", "modify"),
                ("mode", "100755"),
                ("sha256", "6" * 64),
                ("size", len(source_content) + 1),
            ):
                with self.subTest(field=field):
                    changed_entries = [dict(entry) for entry in staged.changed_entries]
                    changed_entry = changed_entries[2]
                    changed_entry[field] = wrong_value
                    inconsistent = dataclasses.replace(
                        staged, changed_entries=tuple(changed_entries)
                    )
                    with self.assertRaisesRegex(
                        publisher.PublisherError,
                        "changed entry",
                    ):
                        publisher.validate_local_candidate(inconsistent, config)

    def test_broker_run_acknowledges_only_exact_labeled_ci_readback(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config = self.broker_config(root)
            event_payload = broker_event()
            handoff = {
                "contract": "hermes.publisher_object_handoff.v1",
                "broker_boundary": "hermes.dedicated_broker_identity.v1",
                "receipt_id": event_payload["receipt_id"],
                "receipt_payload_sha256": event_payload["payload_sha256"],
                "bundle_path": str(root / "broker.bundle"),
                "bundle_sha256": "a" * 64,
                "bundle_size": 123,
                "repository_id": "radulator",
                "branch": event_payload["branch"],
                "base_branch": "develop",
                "base_sha": BASE_SHA,
                "target_base_sha": BASE_SHA,
                "head_sha": HEAD_SHA,
            }
            client = FakeBrokerClient(event_payload=event_payload, handoff=handoff)
            candidate = publisher.select_broker_obligation(client, config)
            staged = dataclasses.replace(
                candidate,
                workspace=str(root),
                bundle_path=str(root / "staged.bundle"),
                bundle_sha256=handoff["bundle_sha256"],
                bundle_size=handoff["bundle_size"],
            )
            pr = publisher.PublishedPullRequest.from_dict(exact_pr())
            labeled = publisher.PublishedPullRequest.from_dict(
                exact_pr(labels=[{"name": "ready-for-gate"}])
            )
            readback = {"contract": "hermes.github_publish_readback.v1"}
            client.calls.clear()

            with mock.patch.object(
                publisher, "stage_broker_bundle", return_value=staged
            ), mock.patch.object(
                publisher, "ensure_remote_and_pr", return_value=pr
            ), mock.patch.object(
                publisher, "ensure_ready_label", return_value=labeled
            ), mock.patch.object(
                publisher, "collect_broker_remote_readback", return_value=readback
            ):
                result = publisher.run_broker_once(config, client)

            self.assertEqual(result["status"], "published")
            self.assertEqual(result["completion_id"], "kpc_1234567890abcdef1234567890abcdef")
            methods = [method for method, _body in client.calls]
            self.assertEqual(
                methods,
                ["list_publish_obligations", "export_bundle", "ack_publish"],
            )
            acknowledgement = client.calls[-1][1]
            self.assertEqual(
                set(acknowledgement),
                {
                    "contract",
                    "receipt_id",
                    "receipt_payload_sha256",
                    "bundle_sha256",
                    "repository_id",
                    "task_id",
                    "run_id",
                    "branch",
                    "base_branch",
                    "base_sha",
                    "target_base_sha",
                    "head_sha",
                    "published_head_sha",
                    "publish_outcome",
                    "readback_complete",
                    "remote_readback",
                },
            )
            self.assertEqual(acknowledgement["target_base_sha"], BASE_SHA)
            self.assertEqual(acknowledgement["published_head_sha"], HEAD_SHA)
            self.assertIs(acknowledgement["readback_complete"], True)
            self.assertEqual(acknowledgement["remote_readback"], readback)

    def broker_ack_setup(self, root, readback, *, ack_overrides=None):
        """Stub the publish path so run_broker_once exercises ack validation only."""
        config = self.broker_config(root)
        event_payload = broker_event()
        handoff = {
            "contract": "hermes.publisher_object_handoff.v1",
            "broker_boundary": "hermes.dedicated_broker_identity.v1",
            "receipt_id": event_payload["receipt_id"],
            "receipt_payload_sha256": event_payload["payload_sha256"],
            "bundle_path": str(root / "broker.bundle"),
            "bundle_sha256": "a" * 64,
            "bundle_size": 123,
            "repository_id": "radulator",
            "branch": event_payload["branch"],
            "base_branch": "develop",
            "base_sha": BASE_SHA,
            "target_base_sha": BASE_SHA,
            "head_sha": HEAD_SHA,
        }
        client = FakeBrokerClient(
            event_payload=event_payload,
            handoff=handoff,
            ack_overrides=ack_overrides,
        )
        candidate = publisher.select_broker_obligation(client, config)
        staged = dataclasses.replace(
            candidate,
            workspace=str(root),
            bundle_path=str(root / "staged.bundle"),
            bundle_sha256=handoff["bundle_sha256"],
            bundle_size=handoff["bundle_size"],
        )
        pr = publisher.PublishedPullRequest.from_dict(exact_pr())
        labeled = publisher.PublishedPullRequest.from_dict(
            exact_pr(labels=[{"name": "ready-for-gate"}])
        )
        client.calls.clear()

        def run():
            with mock.patch.object(
                publisher, "stage_broker_bundle", return_value=staged
            ), mock.patch.object(
                publisher, "ensure_remote_and_pr", return_value=pr
            ), mock.patch.object(
                publisher, "ensure_ready_label", return_value=labeled
            ), mock.patch.object(
                publisher, "collect_broker_remote_readback", return_value=readback
            ):
                return publisher.run_broker_once(config, client)

        return run, client

    def test_broker_ack_digest_binds_the_sent_remote_readback(self):
        readback = {"contract": "hermes.github_publish_readback.v1"}
        expected = hashlib.sha256(publisher._canonical_json(readback)).hexdigest()
        with tempfile.TemporaryDirectory() as directory:
            run, client = self.broker_ack_setup(Path(directory), readback)

            result = run()

            self.assertEqual(result["status"], "published")
            self.assertEqual(client.calls[-1][1]["remote_readback"], readback)
            self.assertEqual(client.ack_response["remote_readback_sha256"], expected)
            self.assertNotEqual(expected, "9" * 64)

    def test_broker_ack_with_mismatched_readback_digest_rejects(self):
        readback = {"contract": "hermes.github_publish_readback.v1"}
        with tempfile.TemporaryDirectory() as directory:
            for digest in ("9" * 64, "0" * 64, "f" * 64):
                with self.subTest(digest=digest):
                    run, _client = self.broker_ack_setup(
                        Path(directory),
                        readback,
                        ack_overrides={"remote_readback_sha256": digest},
                    )

                    with self.assertRaises(publisher.PublisherError):
                        run()

    def test_broker_ack_extra_field_or_wrong_binding_rejects_even_with_matching_digest(self):
        readback = {"contract": "hermes.github_publish_readback.v1"}
        expected = hashlib.sha256(publisher._canonical_json(readback)).hexdigest()
        with tempfile.TemporaryDirectory() as directory:
            for overrides in (
                {"remote_readback_sha256": expected, "unsealed": True},
                {"remote_readback_sha256": expected, "head_sha": "c" * 40},
                {"remote_readback_sha256": expected, "cleanup_state": "pending"},
                {
                    "remote_readback_sha256": expected,
                    "receipt_id": "klc_" + "0" * 48,
                },
            ):
                with self.subTest(overrides=overrides):
                    run, _client = self.broker_ack_setup(
                        Path(directory), readback, ack_overrides=overrides
                    )

                    with self.assertRaises(publisher.PublisherError):
                        run()

    def broker_run_setup(self, root, *, ack_error=None):
        """Real run_broker_once with the already-proved publish steps stubbed."""
        config = self.broker_config(root)
        event_payload = broker_event()
        handoff = {
            "contract": "hermes.publisher_object_handoff.v1",
            "broker_boundary": "hermes.dedicated_broker_identity.v1",
            "receipt_id": event_payload["receipt_id"],
            "receipt_payload_sha256": event_payload["payload_sha256"],
            "bundle_path": str(root / "broker.bundle"),
            "bundle_sha256": "a" * 64,
            "bundle_size": 123,
            "repository_id": "radulator",
            "branch": event_payload["branch"],
            "base_branch": "develop",
            "base_sha": BASE_SHA,
            "target_base_sha": BASE_SHA,
            "head_sha": HEAD_SHA,
        }
        client = FakeBrokerClient(
            event_payload=event_payload,
            handoff=handoff,
            ack_error=ack_error,
        )
        candidate = publisher.select_broker_obligation(client, config)
        staged = dataclasses.replace(
            candidate,
            workspace=str(root),
            bundle_path=str(root / "staged.bundle"),
            bundle_sha256=handoff["bundle_sha256"],
            bundle_size=handoff["bundle_size"],
        )
        pr = publisher.PublishedPullRequest.from_dict(exact_pr())
        labeled = publisher.PublishedPullRequest.from_dict(
            exact_pr(labels=[{"name": "ready-for-gate"}])
        )
        client.calls.clear()
        return config, client, staged, pr, labeled

    def test_broker_run_pending_ci_returns_pending_without_readback_or_ack(self):
        with tempfile.TemporaryDirectory() as directory:
            config, client, staged, pr, _labeled = self.broker_run_setup(Path(directory))
            runner = object()

            with mock.patch.object(
                publisher, "stage_broker_bundle", return_value=staged
            ), mock.patch.object(
                publisher, "ensure_remote_and_pr", return_value=pr
            ), mock.patch.object(
                publisher,
                "ensure_ready_label",
                side_effect=publisher.PublisherPending(
                    "required exact-head check suite is not green"
                ),
            ) as label, mock.patch.object(
                publisher, "collect_broker_remote_readback"
            ) as readback, mock.patch.object(
                publisher, "_compensate_ready_label"
            ) as compensate:
                result = publisher.run_broker_once(config, client, runner=runner)

            self.assertEqual(label.call_count, 1)
            self.assertEqual(
                result,
                {
                    "status": "pending_ci",
                    "task_id": staged.task_id,
                    "pr": pr.number,
                    "head_sha": staged.head_sha,
                },
            )
            readback.assert_not_called()
            compensate.assert_not_called()
            self.assertEqual(
                [method for method, _body in client.calls],
                ["list_publish_obligations", "export_bundle"],
            )
            self.assertIsNone(client.ack_response)

    def test_broker_run_readback_failure_compensates_label_once_and_never_acks(self):
        failure = publisher.PublisherError("exact-head CI evidence is no longer green")
        with tempfile.TemporaryDirectory() as directory:
            config, client, staged, pr, labeled = self.broker_run_setup(Path(directory))
            runner = object()

            with mock.patch.object(
                publisher, "stage_broker_bundle", return_value=staged
            ), mock.patch.object(
                publisher, "ensure_remote_and_pr", return_value=pr
            ), mock.patch.object(
                publisher, "ensure_ready_label", return_value=labeled
            ), mock.patch.object(
                publisher,
                "collect_broker_remote_readback",
                side_effect=failure,
            ) as collect, mock.patch.object(
                publisher, "_compensate_ready_label"
            ) as compensate:
                with self.assertRaises(publisher.PublisherError) as caught:
                    publisher.run_broker_once(config, client, runner=runner)

            self.assertIs(caught.exception, failure)
            self.assertEqual(collect.call_count, 1)
            self.assertEqual(
                compensate.call_args,
                ((staged, labeled, config), {"runner": runner}),
            )
            self.assertEqual(
                [method for method, _body in client.calls],
                ["list_publish_obligations", "export_bundle"],
            )
            self.assertIsNone(client.ack_response)

    def test_broker_run_ack_transport_failure_is_ambiguous_and_preserves_readiness(self):
        transport_error = RuntimeError("broker transport closed after ack write")
        readback = {"contract": "hermes.github_publish_readback.v1"}
        with tempfile.TemporaryDirectory() as directory:
            config, client, staged, pr, labeled = self.broker_run_setup(
                Path(directory), ack_error=transport_error
            )
            runner = object()

            with mock.patch.object(
                publisher, "stage_broker_bundle", return_value=staged
            ), mock.patch.object(
                publisher, "ensure_remote_and_pr", return_value=pr
            ), mock.patch.object(
                publisher, "ensure_ready_label", return_value=labeled
            ), mock.patch.object(
                publisher,
                "collect_broker_remote_readback",
                return_value=readback,
            ), mock.patch.object(
                publisher, "_compensate_ready_label"
            ) as compensate:
                with self.assertRaisesRegex(
                    publisher.PublisherCompletionAmbiguous, "UNSAFE_COMPLETION_STATE"
                ) as caught:
                    publisher.run_broker_once(config, client, runner=runner)

            self.assertIs(caught.exception.__cause__, transport_error)
            compensate.assert_not_called()
            acks = [body for method, body in client.calls if method == "ack_publish"]
            self.assertEqual(len(acks), 1)
            self.assertEqual(acks[0]["receipt_id"], staged.receipt_id)
            self.assertEqual(acks[0]["head_sha"], HEAD_SHA)
            self.assertEqual(acks[0]["published_head_sha"], HEAD_SHA)
            self.assertIs(acks[0]["readback_complete"], True)
            self.assertEqual(acks[0]["remote_readback"], readback)
            self.assertIsNone(client.ack_response)


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

    def broker_candidate(self, **overrides):
        """Bind the GitHub candidate to a broker receipt without re-running broker intake."""
        event = broker_event()
        binding = {
            "receipt_id": event["receipt_id"],
            "receipt_payload_sha256": event["payload_sha256"],
            "repository_id": event["repository_id"],
            "broker_boundary": event["broker_boundary"],
            "target_base_sha": event["target_base_sha"],
        }
        binding.update(overrides)
        return dataclasses.replace(self.candidate, **binding)

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

    def test_broker_receipt_sealed_base_mismatch_pends_before_any_publication(self):
        advanced_base = "d" * 40
        candidate = self.broker_candidate(target_base_sha=BASE_SHA)
        runner = QueueRunner([
            self.remote_feature(),
            self.remote_base(advanced_base),
        ])

        with self.assertRaisesRegex(
            publisher.PublisherPending,
            "broker-sealed pull-request base no longer matches the live target",
        ):
            publisher.ensure_remote_and_pr(candidate, self.config, runner=runner)

        self.assertTrue(all("ls-remote" in call for call, _ in runner.calls))
        self.assertFalse(runner.responses)
        flat = [part for call, _kwargs in runner.calls for part in call]
        for forbidden in (
            "push",
            "create",
            "reopen",
            "edit",
            "--force",
            "--add-label",
            "--remove-label",
        ):
            self.assertNotIn(forbidden, flat)

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
            self.remote_feature(BASE_SHA),
            self.remote_base(),
            response(stdout=""),
            response(stdout=json.dumps(old_unlabeled) + "\n"),
            response(stdout="pushed\n"),
            self.remote_feature(),
            response(stdout=json.dumps(exact_pr()) + "\n"),
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

    def test_correction_removes_and_reads_back_gate_label_even_when_history_looked_unlabeled(self):
        stale_unlabeled = exact_pr(headRefOid=BASE_SHA, labels=[])
        authoritative_unlabeled = exact_pr(headRefOid=BASE_SHA, labels=[])
        runner = QueueRunner([
            self.remote_feature(BASE_SHA),
            self.remote_base(),
            response(returncode=0),
            response(returncode=0),
            response(stdout=json.dumps([stale_unlabeled]) + "\n"),
            self.remote_feature(BASE_SHA),
            self.remote_base(),
            response(stdout="removed\n"),
            response(stdout=json.dumps(authoritative_unlabeled) + "\n"),
            response(stdout="pushed\n"),
            self.remote_feature(),
            response(stdout=json.dumps(exact_pr()) + "\n"),
            response(stdout=json.dumps([exact_pr()]) + "\n"),
        ])

        result = publisher.ensure_remote_and_pr(self.candidate, self.config, runner=runner)

        self.assertEqual(result.head_sha, HEAD_SHA)
        remove_index = next(
            index
            for index, (call, _) in enumerate(runner.calls)
            if Path(call[0]).name == "gh" and "--remove-label" in call
        )
        push_index = next(
            index for index, (call, _) in enumerate(runner.calls) if "push" in call
        )
        self.assertEqual(push_index, remove_index + 2)

    def test_correction_label_race_after_unlabeled_history_blocks_push(self):
        stale_unlabeled = exact_pr(headRefOid=BASE_SHA, labels=[])
        raced_labeled = exact_pr(
            headRefOid=BASE_SHA,
            labels=[{"name": "ready-for-gate"}],
        )
        runner = QueueRunner([
            self.remote_feature(BASE_SHA),
            self.remote_base(),
            response(returncode=0),
            response(returncode=0),
            response(stdout=json.dumps([stale_unlabeled]) + "\n"),
            self.remote_feature(BASE_SHA),
            self.remote_base(),
            response(stdout="removed\n"),
            response(stdout=json.dumps(raced_labeled) + "\n"),
        ])

        with self.assertRaisesRegex(publisher.PublisherError, "remained"):
            publisher.ensure_remote_and_pr(self.candidate, self.config, runner=runner)

        self.assertTrue(any("--remove-label" in call for call, _ in runner.calls))
        self.assertFalse(any("push" in call for call, _ in runner.calls))

    def test_correction_label_readded_during_push_is_compensated_after_push(self):
        old_unlabeled = exact_pr(headRefOid=BASE_SHA, labels=[])
        updated_labeled = exact_pr(labels=[{"name": "ready-for-gate"}])
        updated_unlabeled = exact_pr(labels=[])
        runner = QueueRunner([
            self.remote_feature(BASE_SHA),
            self.remote_base(),
            response(returncode=0),
            response(returncode=0),
            response(stdout=json.dumps([old_unlabeled]) + "\n"),
            self.remote_feature(BASE_SHA),
            self.remote_base(),
            response(stdout="removed\n"),
            response(stdout=json.dumps(old_unlabeled) + "\n"),
            response(stdout="pushed\n"),
            self.remote_feature(),
            response(stdout=json.dumps(updated_labeled) + "\n"),
            response(stdout="removed\n"),
            response(stdout=json.dumps(updated_unlabeled) + "\n"),
        ])

        with self.assertRaisesRegex(publisher.PublisherError, "readiness|label"):
            publisher.ensure_remote_and_pr(self.candidate, self.config, runner=runner)

        removals = [
            call
            for call, _ in runner.calls
            if Path(call[0]).name == "gh" and "--remove-label" in call
        ]
        self.assertEqual(len(removals), 2)
        self.assertEqual(runner.responses, [])

    def test_correction_post_push_head_readback_failure_still_compensates_label(self):
        old_unlabeled = exact_pr(headRefOid=BASE_SHA, labels=[])
        updated_unlabeled = exact_pr(labels=[])
        runner = QueueRunner([
            self.remote_feature(BASE_SHA),
            self.remote_base(),
            response(returncode=0),
            response(returncode=0),
            response(stdout=json.dumps([old_unlabeled]) + "\n"),
            self.remote_feature(BASE_SHA),
            self.remote_base(),
            response(stdout="removed\n"),
            response(stdout=json.dumps(old_unlabeled) + "\n"),
            response(stdout="pushed\n"),
            self.remote_feature(None),
            response(stdout="removed\n"),
            response(stdout=json.dumps(updated_unlabeled) + "\n"),
        ])

        with self.assertRaisesRegex(publisher.PublisherError, "exact-SHA"):
            publisher.ensure_remote_and_pr(self.candidate, self.config, runner=runner)

        removals = [
            call
            for call, _ in runner.calls
            if Path(call[0]).name == "gh" and "--remove-label" in call
        ]
        self.assertEqual(len(removals), 2)
        self.assertEqual(runner.responses, [])

    def test_final_exact_pr_with_unexpected_gate_label_is_compensated_and_rejected(self):
        labeled = exact_pr(labels=[{"name": "ready-for-gate"}])
        unlabeled = exact_pr(labels=[])
        runner = QueueRunner([
            self.remote_feature(),
            self.remote_base(),
            response(stdout=json.dumps([labeled]) + "\n"),
            response(stdout="removed\n"),
            response(stdout=json.dumps(unlabeled) + "\n"),
        ])

        with self.assertRaisesRegex(publisher.PublisherError, "readiness|label"):
            publisher.ensure_remote_and_pr(self.candidate, self.config, runner=runner)

        self.assertTrue(any("--remove-label" in call for call, _ in runner.calls))
        self.assertEqual(runner.responses, [])

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
            self.remote_feature(BASE_SHA),
            self.remote_base(),
            response(stdout="removed\n"),
            response(stdout=json.dumps(closed_unlabeled) + "\n"),
            response(stdout="pushed\n"),
            self.remote_feature(),
            response(stdout=json.dumps(closed_updated) + "\n"),
            response(stdout=json.dumps([closed_updated]) + "\n"),
            response(stdout="removed\n"),
            response(stdout=json.dumps(closed_updated) + "\n"),
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
            self.remote_feature(BASE_SHA),
            self.remote_base(),
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
                    self.remote_feature(BASE_SHA),
                    self.remote_base(),
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
            response(stdout="removed\n"),
            response(stdout=json.dumps(old) + "\n"),
            response(stdout="pushed\n"),
            self.remote_feature(),
            response(stdout=json.dumps(updated) + "\n"),
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
            response(stdout="removed\n"),
            response(stdout=json.dumps(closed) + "\n"),
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
        self.assertTrue(any(
            Path(call[0]).name == "gh" and "--remove-label" in call
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

    def test_broker_receipt_exact_retry_retains_existing_ready_label_without_removing_it(self):
        labeled = exact_pr(labels=[{"name": "ready-for-gate"}])
        candidate = self.broker_candidate()
        runner = QueueRunner([
            self.remote_feature(),
            self.remote_base(),
            response(stdout=json.dumps([labeled]) + "\n"),
        ])

        result = publisher.ensure_remote_and_pr(candidate, self.config, runner=runner)

        self.assertEqual(result.number, 181)
        self.assertEqual(result.labels, ("ready-for-gate",))
        self.assertFalse(runner.responses)
        flat = [part for call, _kwargs in runner.calls for part in call]
        self.assertNotIn("--remove-label", flat)
        self.assertNotIn("--add-label", flat)
        self.assertNotIn("push", flat)

    def test_broker_receipt_retained_ready_label_is_compensated_when_exact_ci_is_pending(self):
        labeled = exact_pr(labels=[{"name": "ready-for-gate"}])
        candidate = self.broker_candidate()
        pr = publisher.PublishedPullRequest.from_dict(labeled)
        older = self.run_payload(id=9001, status="completed", conclusion="success")
        newer = self.run_payload(
            id=9002,
            run_attempt=2,
            check_suite_id=778,
            status="in_progress",
            conclusion=None,
        )
        pending_ci = [
            self.remote_feature(),
            self.remote_base(),
            response(stdout=json.dumps(labeled) + "\n"),
            response(stdout=json.dumps(self.workflow_payload()) + "\n"),
            response(
                stdout=json.dumps({"total_count": 2, "workflow_runs": [older, newer]}) + "\n"
            ),
            response(stdout="removed\n"),
        ]

        runner = QueueRunner(pending_ci + [response(stdout=json.dumps(exact_pr()) + "\n")])
        with self.assertRaisesRegex(
            publisher.PublisherPending, "required exact-head check suite is not green"
        ):
            publisher.ensure_ready_label(candidate, pr, self.config, runner=runner)

        removals = [call for call, _ in runner.calls if "--remove-label" in call]
        self.assertEqual(len(removals), 1)
        self.assertIn("ready-for-gate", removals[0])
        self.assertFalse(any(
            call[1:3] == ["pr", "edit"] and "--add-label" in call
            for call, _ in runner.calls
        ))
        self.assertEqual(runner.calls[-1][0][1:3], ["pr", "view"])

        hostile_runner = QueueRunner(pending_ci + [response(stdout=json.dumps(labeled) + "\n")])
        with self.assertRaisesRegex(publisher.PublisherError, "UNSAFE_LABEL_STATE"):
            publisher.ensure_ready_label(candidate, pr, self.config, runner=hostile_runner)
        self.assertEqual(len([
            call for call, _ in hostile_runner.calls if "--remove-label" in call
        ]), 1)

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
            "completed_at": "2026-08-27T12:34:56Z",
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

    def test_exact_required_checks_evidence_binds_one_run_suite_and_app(self):
        pr = publisher.PublishedPullRequest.from_dict(exact_pr())
        runner = QueueRunner(self.green_ci_responses())

        evidence = publisher._required_checks_evidence(
            self.candidate, pr, self.config, runner=runner
        )

        self.assertEqual(evidence["workflow_id"], 227376261)
        self.assertEqual(evidence["run_id"], 9001)
        self.assertEqual(evidence["newest_run_id_for_workflow_and_head"], 9001)
        self.assertEqual(evidence["check_suite_id"], 777)
        self.assertEqual(evidence["completed_at"], 1787834096)
        self.assertEqual(
            evidence["required_job_ids"],
            list(range(1, len(self.config.required_checks) + 1)),
        )
        self.assertTrue(all(
            item["app"] == {"id": 15368, "slug": "github-actions"}
            and item["workflow_run_id"] == 9001
            and item["check_suite_id"] == 777
            for item in evidence["required_jobs"]
        ))

    def test_remote_readback_binds_repository_pr_ci_and_publisher_label_actor(self):
        config = dataclasses.replace(
            self.config,
            github_repository_id=1027532341,
            required_workflow_id=227376261,
            ready_label_actor_id=35302851,
            ready_label_actor_login="momomojo",
            ready_label_actor_type="User",
        )
        candidate = dataclasses.replace(
            self.candidate,
            target_base_sha=BASE_SHA,
            remote_repository=broker_remote_repository(),
        )
        labeled_pr = publisher.PublishedPullRequest.from_dict(
            exact_pr(labels=[{"name": "ready-for-gate"}])
        )
        repository = {
            "id": 1027532341,
            "name": "Radulator",
            "full_name": "momomojo/Radulator",
            "html_url": "https://github.com/momomojo/Radulator",
            "fork": False,
            "owner": {"login": "momomojo"},
        }
        pull = {
            "number": 181,
            "html_url": "https://github.com/momomojo/Radulator/pull/181",
            "state": "open",
            "draft": False,
            "labels": [{"name": "ready-for-gate"}],
            "head": {
                "ref": candidate.branch,
                "sha": HEAD_SHA,
                "repo": {"full_name": "momomojo/Radulator", "fork": False},
            },
            "base": {"ref": "develop", "sha": BASE_SHA},
        }
        label_event = {
            "id": 66001,
            "event": "labeled",
            "created_at": "2026-08-27T12:35:00Z",
            "label": {"name": "ready-for-gate"},
            "actor": {
                "id": 35302851,
                "login": "momomojo",
                "type": "User",
            },
        }
        runner = QueueRunner([
            *self.green_ci_responses(),
            response(stdout=json.dumps(repository) + "\n"),
            response(stdout=json.dumps(pull) + "\n"),
            response(stdout=json.dumps([label_event]) + "\n"),
        ])

        readback = publisher.collect_broker_remote_readback(
            candidate, labeled_pr, config, runner=runner
        )

        self.assertEqual(readback["repository"], broker_remote_repository())
        self.assertEqual(readback["pull_request"]["head_sha"], HEAD_SHA)
        self.assertEqual(readback["pull_request"]["base_sha"], BASE_SHA)
        self.assertEqual(readback["workflow"]["run_id"], 9001)
        self.assertEqual(readback["ready_label"]["label_event_id"], 66001)
        self.assertEqual(
            readback["ready_label"]["actor"], label_event["actor"]
        )

    def publisher_actor(self):
        return {"id": 35302851, "login": "momomojo", "type": "User"}

    def ready_label_history_setup(self):
        config = dataclasses.replace(
            self.config,
            github_repository_id=1027532341,
            required_workflow_id=227376261,
            ready_label_actor_id=35302851,
            ready_label_actor_login="momomojo",
            ready_label_actor_type="User",
        )
        candidate = dataclasses.replace(
            self.candidate,
            target_base_sha=BASE_SHA,
            remote_repository=broker_remote_repository(),
        )
        return config, candidate

    def ready_label_history_readback(self, label_events):
        """Run the broker readback with a scripted ready-for-gate event history."""

        config, candidate = self.ready_label_history_setup()
        labeled_pr = publisher.PublishedPullRequest.from_dict(
            exact_pr(labels=[{"name": "ready-for-gate"}])
        )
        repository = {
            "id": 1027532341,
            "name": "Radulator",
            "full_name": "momomojo/Radulator",
            "html_url": "https://github.com/momomojo/Radulator",
            "fork": False,
            "owner": {"login": "momomojo"},
        }
        pull = {
            "number": 181,
            "html_url": "https://github.com/momomojo/Radulator/pull/181",
            "state": "open",
            "draft": False,
            "labels": [{"name": "ready-for-gate"}],
            "head": {
                "ref": candidate.branch,
                "sha": HEAD_SHA,
                "repo": {"full_name": "momomojo/Radulator", "fork": False},
            },
            "base": {"ref": "develop", "sha": BASE_SHA},
        }
        runner = QueueRunner([
            *self.green_ci_responses(),
            response(stdout=json.dumps(repository) + "\n"),
            response(stdout=json.dumps(pull) + "\n"),
            response(stdout=json.dumps(label_events) + "\n"),
        ])
        return publisher.collect_broker_remote_readback(
            candidate, labeled_pr, config, runner=runner
        )

    def ready_label_event(self, event_id, created_at, *, actor=None, event="labeled"):
        return {
            "id": event_id,
            "event": event,
            "created_at": created_at,
            "label": {"name": "ready-for-gate"},
            "actor": dict(self.publisher_actor()) if actor is None else dict(actor),
        }

    def test_later_wrong_actor_relabel_supersedes_publisher_label_event(self):
        publisher_event = self.ready_label_event(66001, "2026-08-27T12:35:00Z")
        other_actor = {"id": 999, "login": "someone-else", "type": "User"}
        later = self.ready_label_event(
            66002, "2026-08-27T12:36:00Z", actor=other_actor
        )
        for history in ([publisher_event, later], [later, publisher_event]):
            with self.subTest(ids=[item["id"] for item in history]):
                with self.assertRaisesRegex(publisher.PublisherError, "actor"):
                    self.ready_label_history_readback(history)

    def test_later_unlabeled_event_rejects_while_current_ready_label_is_present(self):
        publisher_event = self.ready_label_event(66001, "2026-08-27T12:35:00Z")
        removed = self.ready_label_event(
            66002, "2026-08-27T12:36:00Z", event="unlabeled"
        )
        for history in ([publisher_event, removed], [removed, publisher_event]):
            with self.subTest(events=[item["event"] for item in history]):
                with self.assertRaisesRegex(publisher.PublisherError, "removed"):
                    self.ready_label_history_readback(history)

    def test_same_timestamp_ready_label_history_prefers_highest_event_id(self):
        wrong_actor = self.ready_label_event(
            66001,
            "2026-08-27T12:35:00Z",
            actor={"id": 999, "login": "someone-else", "type": "User"},
        )
        publisher_event = self.ready_label_event(66002, "2026-08-27T12:35:00Z")
        for history in (
            [wrong_actor, publisher_event],
            [publisher_event, wrong_actor],
        ):
            with self.subTest(ids=[item["id"] for item in history]):
                readback = self.ready_label_history_readback(history)
                self.assertEqual(readback["ready_label"]["label_event_id"], 66002)
                self.assertEqual(readback["ready_label"]["actor"], self.publisher_actor())

    def test_malformed_relevant_ready_label_event_rejects(self):
        publisher_event = self.ready_label_event(66001, "2026-08-27T12:35:00Z")
        malformed = [
            self.ready_label_event(0, "2026-08-27T12:36:00Z", event="unlabeled"),
            self.ready_label_event(66002, "not-a-timestamp", event="unlabeled"),
            self.ready_label_event(66002, None),
        ]
        for item in malformed:
            with self.subTest(event=item):
                with self.assertRaisesRegex(publisher.PublisherError, "ready label event"):
                    self.ready_label_history_readback([publisher_event, item])

    def test_ready_label_history_requires_post_ci_publisher_label_event(self):
        cases = {
            "pre_ci": [self.ready_label_event(66001, "2026-08-27T12:34:00Z")],
            "irrelevant": [
                {
                    "id": 66003,
                    "event": "review_requested",
                    "created_at": "2026-08-27T12:36:00Z",
                    "review_requester": {"id": 35302851, "login": "momomojo", "type": "User"},
                }
            ],
            "other_label": [
                {
                    **self.ready_label_event(66004, "2026-08-27T12:36:00Z"),
                    "label": {"name": "ship-it"},
                }
            ],
        }
        for name, history in cases.items():
            with self.subTest(case=name):
                with self.assertRaisesRegex(publisher.PublisherError, "unavailable|predates"):
                    self.ready_label_history_readback(history)

    def test_single_valid_ready_label_event_remains_accepted(self):
        publisher_event = self.ready_label_event(66001, "2026-08-27T12:35:00Z")
        readback = self.ready_label_history_readback([publisher_event])

        self.assertEqual(readback["ready_label"]["label_event_id"], 66001)
        self.assertEqual(readback["ready_label"]["actor"], self.publisher_actor())
        self.assertEqual(readback["ready_label"]["present"], True)

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
        self.ci_patch = mock.patch.object(
            publisher, "_required_checks_green", return_value=True
        )
        self.ci_proof = self.ci_patch.start()
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
        self.ci_patch.stop()
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
        self.assertEqual(len(kb.comments), 2)
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

    def test_completion_commit_then_response_failure_recovers_exact_terminal_state(self):
        class CommitThenDisconnectKanban(MutableKanban):
            def complete_trusted_publisher_authority(self, conn, **kwargs):
                super().complete_trusted_publisher_authority(conn, **kwargs)
                raise ConnectionError("synthetic response lost after commit")

        kb = CommitThenDisconnectKanban(
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
            response(stdout=json.dumps(exact_pr(labels=[])) + "\n"),
            response(stdout="edited\n"),
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
        self.assertEqual(kb.get_task(None, "t_example").status, "done")
        self.assertEqual(len(kb.comments), 2)
        self.assertEqual(runner.responses, [])
        self.assertTrue(any(
            Path(call[0]).name == "gh"
            and call[1:3] == ["pr", "edit"]
            and "--add-label" in call
            for call, _ in runner.calls
        ))
        self.assertFalse(any(
            Path(call[0]).name == "gh"
            and call[1:3] == ["pr", "edit"]
            and "--remove-label" in call
            for call, _ in runner.calls
        ))

    def test_exact_completion_response_restores_label_and_rechecks_terminal_state(self):
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
            response(stdout=json.dumps(exact_pr(labels=[])) + "\n"),
            response(stdout="edited\n"),
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
        self.assertEqual(runner.responses, [])
        self.assertTrue(any(
            Path(call[0]).name == "gh"
            and call[1:3] == ["pr", "edit"]
            and "--add-label" in call
            for call, _ in runner.calls
        ))

    def test_terminal_relabel_compensates_when_exact_ci_changes_after_write(self):
        kb = self.kb()
        completion = (
            "TRUSTED_PUBLISHER v1\n"
            f"PR: {self.pr.url}\n"
            f"Exact head: {HEAD_SHA}\n"
            "Release tracker: t_release"
        )
        implementation = kb.by_id["t_example"]
        implementation.status = "done"
        implementation.result = completion
        comment = (
            "TRUSTED_PUBLISHER v1 publication verified. "
            f"PR {self.pr.url}; exact head {HEAD_SHA}; release tracker t_release."
        )
        kb.comments.append(SimpleNamespace(
            id=1,
            task_id="t_example",
            author="radulator-trusted-publisher",
            body=comment,
        ))
        self.ci_proof.side_effect = [True, False]
        runner = QueueRunner([
            response(stdout="edited\n"),
            self.labeled_pr_response(),
            response(stdout="removed\n"),
            response(stdout=json.dumps(exact_pr(labels=[])) + "\n"),
        ])

        with self.assertRaisesRegex(
            publisher.PublisherCompletionAmbiguous,
            "exact-head CI changed",
        ):
            publisher._recover_committed_lifecycle_completion(
                candidate=self.candidate,
                pr=self.pr,
                config=self.config,
                kb=kb,
                conn=object(),
                tracker_id="t_release",
                tracker_status="todo",
                existing_tracker=False,
                relation_task="t_release",
                expected_parents=["t_example"],
                comment_id=1,
                comment=comment,
                completion=completion,
                runner=runner,
                current_pr=publisher.PublishedPullRequest.from_dict(
                    exact_pr(labels=[])
                ),
            )

        self.assertEqual(self.ci_proof.call_count, 2)
        self.assertTrue(any("--add-label" in call for call, _ in runner.calls))
        self.assertTrue(any("--remove-label" in call for call, _ in runner.calls))
        self.assertEqual(runner.responses, [])

    def test_terminal_relabel_never_mutates_when_current_exact_ci_is_not_green(self):
        kb = self.kb()
        completion = (
            "TRUSTED_PUBLISHER v1\n"
            f"PR: {self.pr.url}\n"
            f"Exact head: {HEAD_SHA}\n"
            "Release tracker: t_release"
        )
        implementation = kb.by_id["t_example"]
        implementation.status = "done"
        implementation.result = completion
        comment = (
            "TRUSTED_PUBLISHER v1 publication verified. "
            f"PR {self.pr.url}; exact head {HEAD_SHA}; release tracker t_release."
        )
        kb.comments.append(SimpleNamespace(
            id=1,
            task_id="t_example",
            author="radulator-trusted-publisher",
            body=comment,
        ))
        self.ci_proof.return_value = False
        runner = QueueRunner([])

        with self.assertRaisesRegex(
            publisher.PublisherCompletionAmbiguous,
            "exact-head CI is not green",
        ):
            publisher._recover_committed_lifecycle_completion(
                candidate=self.candidate,
                pr=self.pr,
                config=self.config,
                kb=kb,
                conn=object(),
                tracker_id="t_release",
                tracker_status="todo",
                existing_tracker=False,
                relation_task="t_release",
                expected_parents=["t_example"],
                comment_id=1,
                comment=comment,
                completion=completion,
                runner=runner,
                current_pr=publisher.PublishedPullRequest.from_dict(
                    exact_pr(labels=[])
                ),
            )

        self.assertEqual(self.ci_proof.call_count, 1)
        self.assertEqual(runner.calls, [])

    def test_terminal_recovery_requires_bounded_host_authenticated_runtime(self):
        kb = self.kb()
        current = kb.by_id["t_example"]
        current.status = "done"
        current.result = (
            "TRUSTED_PUBLISHER v1\n"
            f"PR: {self.pr.url}\n"
            f"Exact head: {HEAD_SHA}\n"
            "Release tracker: t_release"
        )

        with self.assertRaisesRegex(
            publisher.PublisherPending,
            "PENDING_HERMES_RUNTIME.*host-authenticated",
        ):
            publisher.recover_terminal_completion_obligation(
                self.config, kb, object(), runner=QueueRunner([])
            )

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
            self.labeled_pr_response(),
            self.labeled_pr_response(),
        ])

        publisher.complete_lifecycle_handoff(
            self.candidate, self.pr, self.config, kb, object(), runner=runner
        )

        self.assertEqual(len(kb.comments), 2)


class TrustedPublisherRunTests(unittest.TestCase):
    def setUp(self):
        self.recovery_patch = mock.patch.object(
            publisher,
            "recover_terminal_completion_obligation",
            return_value=None,
        )
        self.recovery_patch.start()
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

    def tearDown(self):
        self.recovery_patch.stop()

    def test_missing_bounded_completion_query_holds_before_any_task_or_github_scan(self):
        self.recovery_patch.stop()
        kb = FakeKanban(
            [
                task(),
                task(
                    id="t_spoof",
                    status="done",
                    result=(
                        "TRUSTED_PUBLISHER v1\n"
                        "PR: https://github.com/momomojo/Radulator/pull/999\n"
                        f"Exact head: {HEAD_SHA}\n"
                        "Release tracker: t_spoof_tracker"
                    ),
                ),
            ],
            {"t_example": exact_events(changed_paths=["src/example.js"])},
        )
        runner = QueueRunner([])
        try:
            result = publisher.run_once(
                self.config, kb, object(), runner=runner
            )
        finally:
            self.recovery_patch.start()

        self.assertEqual(result["status"], "pending_runtime")
        self.assertRegex(result["reason"], "bounded host-authenticated")
        self.assertEqual(runner.calls, [])

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

    def test_every_post_label_handoff_failure_removes_and_proves_label_absent(self):
        failure_points = (
            "bootstrap failed",
            "ledger append failed",
            "comment write failed",
            "final authority CAS failed",
            "final lifecycle readback failed",
        )
        for failure in failure_points:
            with self.subTest(failure=failure), mock.patch.dict(
                os.environ, {"GH_TOKEN": "test-token"}
            ):
                kb = FakeKanban(
                    [task()],
                    {"t_example": exact_events(changed_paths=["src/example.js"])},
                )
                runner = QueueRunner([
                    response(stdout="removed\n"),
                    response(stdout=json.dumps(exact_pr(labels=[])) + "\n"),
                ])
                with mock.patch.object(publisher, "validate_local_candidate"), \
                     mock.patch.object(
                         publisher, "ensure_remote_and_pr", return_value=self.pr
                     ), \
                     mock.patch.object(
                         publisher, "ensure_ready_label", return_value=self.labeled
                     ), \
                     mock.patch.object(
                         publisher,
                         "complete_lifecycle_handoff",
                         side_effect=publisher.PublisherError(failure),
                     ):
                    with self.assertRaisesRegex(publisher.PublisherError, failure):
                        publisher.run_once(
                            self.config, kb, object(), runner=runner
                        )

                self.assertTrue(any(
                    Path(call[0]).name == "gh"
                    and call[1:3] == ["pr", "edit"]
                    and "--remove-label" in call
                    for call, _ in runner.calls
                ))
                self.assertEqual(runner.responses, [])

    def test_terminal_completion_ambiguity_preserves_ready_label_for_recovery(self):
        class TerminalReadbackKanban(FakeKanban):
            def get_task(self, _conn, task_id):
                if task_id == "t_example":
                    return SimpleNamespace(id=task_id, status="done")
                return None

        kb = TerminalReadbackKanban(
            [task()],
            {"t_example": exact_events(changed_paths=["src/example.js"])},
        )
        runner = QueueRunner([])
        with mock.patch.object(publisher, "validate_local_candidate"), \
             mock.patch.object(
                 publisher, "ensure_remote_and_pr", return_value=self.pr
             ), \
             mock.patch.object(
                 publisher, "ensure_ready_label", return_value=self.labeled
             ), \
             mock.patch.object(
                 publisher,
                 "complete_lifecycle_handoff",
                 side_effect=publisher.PublisherCompletionAmbiguous(
                     "UNSAFE_COMPLETION_STATE: response lost after terminal commit"
                 ),
             ):
            with self.assertRaisesRegex(
                publisher.PublisherError, "UNSAFE_COMPLETION_STATE"
            ):
                publisher.run_once(self.config, kb, object(), runner=runner)

        self.assertEqual(runner.calls, [])

    def test_post_label_handoff_failure_reports_unsafe_when_absence_cannot_be_proven(self):
        kb = FakeKanban(
            [task()],
            {"t_example": exact_events(changed_paths=["src/example.js"])},
        )
        runner = QueueRunner([
            response(stdout="removed\n"),
            response(
                stdout=json.dumps(
                    exact_pr(labels=[{"name": "ready-for-gate"}])
                ) + "\n"
            ),
        ])
        with mock.patch.dict(os.environ, {"GH_TOKEN": "test-token"}), \
             mock.patch.object(publisher, "validate_local_candidate"), \
             mock.patch.object(
                 publisher, "ensure_remote_and_pr", return_value=self.pr
             ), \
             mock.patch.object(
                 publisher, "ensure_ready_label", return_value=self.labeled
             ), \
             mock.patch.object(
                 publisher,
                 "complete_lifecycle_handoff",
                 side_effect=publisher.PublisherError("ledger failed"),
             ):
            with self.assertRaisesRegex(
                publisher.PublisherError, "UNSAFE_LABEL_STATE"
            ):
                publisher.run_once(self.config, kb, object(), runner=runner)

    def test_post_label_handoff_failure_reports_unsafe_when_removal_fails(self):
        kb = FakeKanban(
            [task()],
            {"t_example": exact_events(changed_paths=["src/example.js"])},
        )
        runner = QueueRunner([
            response(returncode=1, stderr="synthetic label removal failure"),
        ])
        with mock.patch.dict(os.environ, {"GH_TOKEN": "test-token"}), \
             mock.patch.object(publisher, "validate_local_candidate"), \
             mock.patch.object(
                 publisher, "ensure_remote_and_pr", return_value=self.pr
             ), \
             mock.patch.object(
                 publisher, "ensure_ready_label", return_value=self.labeled
             ), \
             mock.patch.object(
                 publisher,
                 "complete_lifecycle_handoff",
                 side_effect=publisher.PublisherError("bootstrap failed"),
             ):
            with self.assertRaisesRegex(
                publisher.PublisherError, "UNSAFE_LABEL_STATE"
            ):
                publisher.run_once(self.config, kb, object(), runner=runner)

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

    def test_main_uses_only_publisher_broker_client_and_never_kanban_database(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "Radulator"
            root.mkdir()
            controller = root / "ops/hermes/radulator/lifecycle_controller.py"
            controller.parent.mkdir(parents=True)
            controller.write_text("# test\n", encoding="utf-8")
            state = Path(directory) / "publisher-state"
            args = [
                "--board", "default",
                "--project-id", "radulator",
                "--project-root", str(root),
                "--repository", "momomojo/Radulator",
                "--base-branch", "develop",
                "--expected-origin", "momomojo/Radulator",
                "--lifecycle-controller", str(controller),
                "--ledger", str(state / "release.jsonl"),
                "--lock-file", str(state / "publisher.lock"),
                "--repository-id", "radulator",
                "--publisher-state-dir", str(state),
                "--broker-client-config", str(state / "client.json"),
                "--expected-broker-uid", str(os.geteuid()),
                "--publisher-gid", str(os.getegid()),
                "--github-repository-id", "1027532341",
                "--workflow-id", "227376261",
                "--ready-label-actor-id", "35302851",
                "--ready-label-actor-login", "momomojo",
                "--ready-label-actor-type", "User",
            ]
            broker_client = object()
            output = io.StringIO()

            with mock.patch.object(
                publisher, "run_broker_once", return_value={"status": "idle"}
            ) as run, contextlib.redirect_stdout(output):
                result = publisher.main(args, broker_client=broker_client)

            self.assertEqual(result, 0)
            run.assert_called_once()
            self.assertIs(run.call_args.args[1], broker_client)
            self.assertEqual(json.loads(output.getvalue()), {"status": "idle"})
            self.assertNotIn("kanban_db", inspect.getsource(publisher.main))


if __name__ == "__main__":
    unittest.main()
