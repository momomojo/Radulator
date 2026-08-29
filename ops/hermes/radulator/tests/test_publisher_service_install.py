import json
import os
import plistlib
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from ops.hermes.radulator import publisher_service_install as service


class UnlinkIsInconclusive:
    """A revocation target whose unlink reports success yet stays present."""

    def __init__(self, path):
        self.path = str(path)

    def lstat(self):
        return mock.Mock(st_mode=stat.S_IFREG, st_uid=0)

    def unlink(self):
        return None

    def __str__(self):
        return self.path


class PublisherServiceInstallTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root / "source"
        self.source.mkdir(mode=0o755)
        for name in (
            "publisher_service_install.py",
            "trusted_publisher.py",
            "trusted_publisher_cron.sh",
            "lifecycle_controller.py",
        ):
            path = self.source / name
            path.write_text(f"# {name}\n", encoding="utf-8")
            path.chmod(0o755 if name.endswith(".sh") else 0o644)
        self.install_root = self.root / "install"
        self.publisher_home = self.root / "publisher-home"
        self.client_config = self.root / "publisher-client.json"
        self.client_config.write_text("{}\n", encoding="utf-8")
        self.client_config.chmod(0o600)
        self.python = self.root / "python"
        self.python.write_text("python\n", encoding="utf-8")
        self.python.chmod(0o755)
        self.plist = self.root / "ai.hermes.radulator-publisher.plist"

    def tearDown(self):
        self.temp.cleanup()

    def plan(self):
        return service.build_service_plan(
            source_root=self.source,
            install_root=self.install_root,
            publisher_home=self.publisher_home,
            broker_client_config=self.client_config,
            launchd_plist_path=self.plist,
            python_executable=self.python,
            source_commit_sha="a" * 40,
            source_owner_uid=os.geteuid(),
            publisher_user="_publisher",
            publisher_uid=501,
            publisher_group="_publisher",
            publisher_gid=501,
            broker_uid=502,
            model_uid=503,
            model_gid=503,
        )

    def test_plan_is_disabled_first_and_binds_exact_immutable_assets(self):
        plan = self.plan()

        self.assertEqual(plan["contract"], service.SERVICE_PLAN_CONTRACT)
        self.assertIs(plan["enabled"], False)
        self.assertEqual(plan["source_commit_sha"], "a" * 40)
        self.assertRegex(plan["asset_manifest_sha256"], r"^[0-9a-f]{64}$")
        self.assertEqual(
            [entry["path"] for entry in plan["asset_manifest"]],
            [
                "lifecycle_controller.py",
                "publisher_service_install.py",
                "trusted_publisher.py",
                "trusted_publisher_cron.sh",
            ],
        )
        self.assertEqual(
            {plan["publisher_uid"], plan["broker_uid"], plan["model_uid"]},
            {501, 502, 503},
        )

    def test_plan_rejects_mutable_or_symlinked_source_assets(self):
        (self.source / "trusted_publisher.py").chmod(0o666)
        with self.assertRaisesRegex(ValueError, "immutable"):
            self.plan()

        (self.source / "trusted_publisher.py").unlink()
        (self.source / "trusted_publisher.py").symlink_to(
            self.source / "lifecycle_controller.py"
        )
        with self.assertRaisesRegex(ValueError, "immutable"):
            self.plan()

    def test_plan_rejects_collapsed_os_identities(self):
        with self.assertRaisesRegex(ValueError, "distinct"):
            service.build_service_plan(
                source_root=self.source,
                install_root=self.install_root,
                publisher_home=self.publisher_home,
                broker_client_config=self.client_config,
                launchd_plist_path=self.plist,
                python_executable=self.python,
                source_commit_sha="a" * 40,
                source_owner_uid=os.geteuid(),
                publisher_user="_publisher",
                publisher_uid=501,
                publisher_group="_publisher",
                publisher_gid=501,
                broker_uid=501,
                model_uid=503,
                model_gid=503,
            )

    def test_launchd_plist_has_no_credential_and_runs_only_publisher_identity(self):
        plan = self.plan()
        payload = plistlib.loads(service.render_launchd_plist(plan))

        self.assertEqual(payload["Label"], service.SERVICE_LABEL)
        self.assertEqual(payload["UserName"], "_publisher")
        self.assertEqual(payload["GroupName"], "_publisher")
        self.assertIs(payload["RunAtLoad"], True)
        self.assertIs(payload["KeepAlive"], True)
        self.assertEqual(payload["ProgramArguments"][0], "/bin/bash")
        environment = payload["EnvironmentVariables"]
        self.assertEqual(environment["RADULATOR_PUBLISHER_SERVICE_LOOP"], "1")
        self.assertNotIn("GH_TOKEN", environment)
        self.assertNotIn("GITHUB_TOKEN", environment)
        self.assertNotIn("token", json.dumps(payload).lower())

    def test_service_wrapper_loops_without_reentering_an_agent(self):
        wrapper = (
            Path(__file__).resolve().parents[1] / "trusted_publisher_cron.sh"
        ).read_text(encoding="utf-8")

        self.assertIn('RADULATOR_PUBLISHER_SERVICE_LOOP', wrapper)
        self.assertIn('RADULATOR_PUBLISHER_INTERVAL_SECONDS', wrapper)
        self.assertIn('run_publisher_once', wrapper)
        self.assertNotIn('hermes cron', wrapper)
        self.assertNotIn('codex', wrapper.lower())

    def activation_runner(
        self,
        events,
        *,
        present=True,
        running=True,
        enabled=True,
        disabled_response=None,
    ):
        """Fake launchd/GitHub transport that only turns safe after rollback.

        Process and persistent registry state stay exactly as configured until
        ``disable``/``bootout`` mutate them, so an activation readback cannot borrow
        the post-rollback safe state.
        """

        def runner(command, **_kwargs):
            events.append(" ".join(map(str, command)))
            rendered = events[-1]
            rolled_back = any(
                len(entry) > 1 and entry[1] in ("disable", "bootout")
                for entry in (event.split() for event in events)
            )
            bootstrapped = any(
                len(entry) > 1 and entry[1] == "bootstrap"
                for entry in (event.split() for event in events)
            )
            if "api user" in rendered:
                stdout = json.dumps(dict(service.READY_LABEL_ACTOR))
            elif "actions/workflows" in rendered:
                stdout = json.dumps(
                    {
                        "id": service.WORKFLOW_ID,
                        "name": service.WORKFLOW_NAME,
                        "path": service.WORKFLOW_PATH,
                        "state": "active",
                    }
                )
            elif "api repos/" in rendered:
                stdout = json.dumps(
                    {
                        "id": service.REPOSITORY_ID,
                        "full_name": service.REPOSITORY,
                        "fork": False,
                    }
                )
            elif "print-disabled" in rendered:
                if rolled_back:
                    state = "true"
                elif disabled_response is not None:
                    return subprocess.CompletedProcess(
                        command, disabled_response[0], disabled_response[1], ""
                    )
                else:
                    state = "false" if enabled else "true"
                return subprocess.CompletedProcess(
                    command, 0, f'"{service.SERVICE_LABEL}" => {state}\n', ""
                )
            elif "launchctl print" in rendered:
                if rolled_back or (not present and not bootstrapped):
                    return subprocess.CompletedProcess(
                        command, 3, "", "Could not find service"
                    )
                if running:
                    stdout = (
                        "system/ai.hermes.radulator-publisher = {\n"
                        " state = running\n pid = 4321\n}\n"
                    )
                else:
                    stdout = (
                        "system/ai.hermes.radulator-publisher = {\n"
                        " state = spawn queued\n pid = 0\n}\n"
                    )
            else:
                stdout = ""
            return subprocess.CompletedProcess(command, 0, stdout, "")

        return runner

    def test_activation_attestation_is_exact_and_never_requests_a_token(self):
        plan = self.plan()
        observed = []
        written = {}

        def runner(command, **kwargs):
            observed.append((command, kwargs))
            rendered = " ".join(map(str, command))
            if "api user" in rendered:
                stdout = json.dumps(
                    {"id": 35302851, "login": "momomojo", "type": "User"}
                )
            elif "actions/workflows/227376261" in rendered:
                stdout = json.dumps(
                    {
                        "id": 227376261,
                        "name": "E2E Tests",
                        "path": ".github/workflows/e2e-tests.yml",
                        "state": "active",
                    }
                )
            elif "api repos/momomojo/Radulator" in rendered:
                stdout = json.dumps(
                    {
                        "id": 1027532341,
                        "full_name": "momomojo/Radulator",
                        "fork": False,
                    }
                )
            elif "print-disabled" in rendered:
                stdout = '"ai.hermes.radulator-publisher" => false\n'
            elif "launchctl print" in rendered:
                stdout = (
                    "system/ai.hermes.radulator-publisher = {\n"
                    " state = running\n pid = 4321\n}\n"
                )
            else:
                stdout = ""
            return subprocess.CompletedProcess(command, 0, stdout, "")

        with mock.patch.object(service.os, "geteuid", return_value=0), mock.patch.object(
            service, "_require_production_plan"
        ), mock.patch.object(
            service, "_verify_provisioned_assets"
        ), mock.patch.object(service, "_verify_broker_client", return_value="b" * 64), mock.patch.object(
            service, "_verify_private_repository"
        ), mock.patch.object(
            service, "_verify_publisher_credential_isolation"
        ), mock.patch.object(
            service,
            "_atomic_write",
            side_effect=lambda _path, content, **_kwargs: written.update(
                {"content": content}
            ),
        ), mock.patch.object(
            service,
            "_read_file_exact",
            side_effect=lambda *_args, **_kwargs: (written["content"], mock.Mock()),
        ):
            attestation = service.activate_service(plan, runner=runner, now=lambda: 1234)

        self.assertEqual(
            set(attestation),
            {
                "contract",
                "broker_boundary",
                "service_label",
                "active",
                "publisher_uid",
                "broker_uid",
                "model_uid",
                "repository",
                "github_repository_id",
                "workflow_id",
                "workflow_path",
                "ready_label_actor",
                "publisher_client_config_sha256",
                "asset_manifest_sha256",
                "source_commit_sha",
                "publisher_credential_model_denied",
                "verified_at",
            },
        )
        self.assertTrue(all("auth token" not in " ".join(map(str, call[0])) for call in observed))

    def test_activation_attestation_write_failure_disables_live_service(self):
        plan = self.plan()
        observed = []

        def runner(command, **_kwargs):
            observed.append(command)
            rendered = " ".join(map(str, command))
            if "api user" in rendered:
                stdout = json.dumps(
                    {"id": 35302851, "login": "momomojo", "type": "User"}
                )
            elif "actions/workflows/227376261" in rendered:
                stdout = json.dumps(
                    {
                        "id": 227376261,
                        "name": "E2E Tests",
                        "path": ".github/workflows/e2e-tests.yml",
                        "state": "active",
                    }
                )
            elif "api repos/momomojo/Radulator" in rendered:
                stdout = json.dumps(
                    {
                        "id": 1027532341,
                        "full_name": "momomojo/Radulator",
                        "fork": False,
                    }
                )
            elif "print-disabled" in rendered:
                disablement = (
                    "true"
                    if any(recorded[1] in ("disable", "bootout") for recorded in observed)
                    else "false"
                )
                stdout = f'"ai.hermes.radulator-publisher" => {disablement}\n'
            elif "launchctl print" in rendered:
                if any(recorded[1] == "bootout" for recorded in observed):
                    return subprocess.CompletedProcess(
                        command, 3, "", "Could not find service"
                    )
                stdout = (
                    "system/ai.hermes.radulator-publisher = {\n"
                    " state = running\n pid = 4321\n}\n"
                )
            else:
                stdout = ""
            return subprocess.CompletedProcess(command, 0, stdout, "")

        with mock.patch.object(service.os, "geteuid", return_value=0), mock.patch.object(
            service, "_require_production_plan"
        ), mock.patch.object(service, "_verify_provisioned_assets"), mock.patch.object(
            service, "_verify_broker_client", return_value="b" * 64
        ), mock.patch.object(service, "_verify_private_repository"), mock.patch.object(
            service, "_verify_publisher_credential_isolation"
        ), mock.patch.object(
            service, "_atomic_write", side_effect=OSError("disk full")
        ):
            with self.assertRaisesRegex(OSError, "disk full"):
                service.activate_service(plan, runner=runner, now=lambda: 1234)

        rendered = [" ".join(map(str, command)) for command in observed]
        self.assertTrue(any("launchctl disable" in command for command in rendered))
        self.assertTrue(any("launchctl bootout" in command for command in rendered))

    def test_activation_attestation_construction_failure_disables_existing_service(self):
        plan = self.plan()
        observed = []

        def runner(command, **_kwargs):
            observed.append(command)
            rendered = " ".join(map(str, command))
            if "api user" in rendered:
                stdout = json.dumps(
                    {"id": 35302851, "login": "momomojo", "type": "User"}
                )
            elif "actions/workflows/227376261" in rendered:
                stdout = json.dumps(
                    {
                        "id": 227376261,
                        "name": "E2E Tests",
                        "path": ".github/workflows/e2e-tests.yml",
                        "state": "active",
                    }
                )
            elif "api repos/momomojo/Radulator" in rendered:
                stdout = json.dumps(
                    {
                        "id": 1027532341,
                        "full_name": "momomojo/Radulator",
                        "fork": False,
                    }
                )
            elif "print-disabled" in rendered:
                stdout = '"ai.hermes.radulator-publisher" => true\n'
            elif "launchctl print" in rendered:
                if any(recorded[1] == "bootout" for recorded in observed):
                    return subprocess.CompletedProcess(
                        command, 3, "", "Could not find service"
                    )
                stdout = (
                    "system/ai.hermes.radulator-publisher = {\n"
                    " state = running\n pid = 4321\n}\n"
                )
            else:
                stdout = ""
            return subprocess.CompletedProcess(command, 0, stdout, "")

        def failing_now():
            raise ValueError("clock drift")

        with mock.patch.object(service.os, "geteuid", return_value=0), mock.patch.object(
            service, "_require_production_plan"
        ), mock.patch.object(service, "_verify_provisioned_assets"), mock.patch.object(
            service, "_verify_broker_client", return_value="b" * 64
        ), mock.patch.object(service, "_verify_private_repository"), mock.patch.object(
            service, "_verify_publisher_credential_isolation"
        ), mock.patch.object(
            service, "_atomic_write", side_effect=AssertionError("attestation written")
        ):
            with self.assertRaisesRegex(ValueError, "clock drift"):
                service.activate_service(plan, runner=runner, now=failing_now)

        rendered = [" ".join(map(str, command)) for command in observed]
        self.assertTrue(any("launchctl disable" in command for command in rendered))
        self.assertTrue(any("launchctl bootout" in command for command in rendered))

    def test_activation_preflight_failure_disables_existing_service(self):
        plan = self.plan()
        observed = []

        def runner(command, **_kwargs):
            observed.append(command)
            rendered = " ".join(map(str, command))
            if "print-disabled" in rendered:
                return subprocess.CompletedProcess(
                    command, 0, '"ai.hermes.radulator-publisher" => true\n', ""
                )
            if "launchctl print" in rendered:
                return subprocess.CompletedProcess(
                    command, 3, "", "Could not find service"
                )
            return subprocess.CompletedProcess(command, 0, "", "")

        with mock.patch.object(service.os, "geteuid", return_value=0), mock.patch.object(
            service, "_require_production_plan"
        ), mock.patch.object(
            service, "_verify_provisioned_assets"
        ), mock.patch.object(
            service,
            "_verify_broker_client",
            side_effect=ValueError("broker client drift"),
        ):
            with self.assertRaisesRegex(ValueError, "broker client drift"):
                service.activate_service(plan, runner=runner)

        label = f"system/{service.SERVICE_LABEL}"
        rendered = [" ".join(map(str, command)) for command in observed]
        self.assertIn(f"/bin/launchctl disable {label}", rendered)
        self.assertIn(f"/bin/launchctl bootout {label}", rendered)

    def test_activation_rollback_requires_service_absence_readback(self):
        plan = self.plan()
        observed = []

        def runner(command, **_kwargs):
            observed.append(command)
            rendered = " ".join(map(str, command))
            if "launchctl print" in rendered:
                stdout = (
                    "system/ai.hermes.radulator-publisher = {\n"
                    " state = running\n pid = 4321\n}\n"
                )
            else:
                stdout = ""
            return subprocess.CompletedProcess(command, 0, stdout, "")

        with mock.patch.object(service.os, "geteuid", return_value=0), mock.patch.object(
            service, "_require_production_plan"
        ), mock.patch.object(
            service, "_verify_provisioned_assets"
        ), mock.patch.object(
            service,
            "_verify_broker_client",
            side_effect=ValueError("broker client drift"),
        ):
            with self.assertRaises(ValueError) as raised:
                service.activate_service(plan, runner=runner)

        self.assertEqual(
            str(raised.exception),
            "publisher activation rollback did not stop service",
        )
        label = f"system/{service.SERVICE_LABEL}"
        rendered = [" ".join(map(str, command)) for command in observed]
        self.assertIn(f"/bin/launchctl disable {label}", rendered)
        self.assertIn(f"/bin/launchctl bootout {label}", rendered)
        self.assertGreater(
            rendered.index(f"/bin/launchctl print {label}"),
            rendered.index(f"/bin/launchctl bootout {label}"),
        )

    def test_activation_rollback_disable_transport_failure_still_proves_absence(self):
        plan = self.plan()
        observed = []
        label = f"system/{service.SERVICE_LABEL}"

        def runner(command, **_kwargs):
            observed.append(command)
            rendered = " ".join(map(str, command))
            if "launchctl disable" in rendered:
                raise OSError("disable transport failed")
            if "print-disabled" in rendered:
                return subprocess.CompletedProcess(
                    command, 0, '"ai.hermes.radulator-publisher" => true\n', ""
                )
            if "launchctl print" in rendered:
                return subprocess.CompletedProcess(
                    command, 3, "", "Could not find service"
                )
            return subprocess.CompletedProcess(command, 0, "", "")

        with mock.patch.object(service.os, "geteuid", return_value=0), mock.patch.object(
            service, "_require_production_plan"
        ), mock.patch.object(
            service, "_verify_provisioned_assets"
        ), mock.patch.object(
            service,
            "_verify_broker_client",
            side_effect=ValueError("broker client drift"),
        ):
            with self.assertRaisesRegex(ValueError, "broker client drift") as raised:
                service.activate_service(plan, runner=runner)

        self.assertEqual(str(raised.exception), "broker client drift")
        rendered = [" ".join(map(str, command)) for command in observed]
        self.assertIn(f"/bin/launchctl disable {label}", rendered)
        self.assertIn(f"/bin/launchctl bootout {label}", rendered)
        self.assertGreater(
            rendered.index(f"/bin/launchctl print {label}"),
            rendered.index(f"/bin/launchctl bootout {label}"),
        )

    def test_activation_rollback_requires_persistent_disablement_readback(self):
        plan = self.plan()
        observed = []
        revoked = []
        label = f"system/{service.SERVICE_LABEL}"

        def runner(command, **_kwargs):
            observed.append(command)
            rendered = " ".join(map(str, command))
            if "print-disabled" in rendered:
                return subprocess.CompletedProcess(
                    command, 0, '"ai.hermes.radulator-publisher" => false\n', ""
                )
            if "launchctl print" in rendered:
                return subprocess.CompletedProcess(
                    command, 3, "", "Could not find service"
                )
            return subprocess.CompletedProcess(command, 0, "", "")

        real_revoke = service._revoke_activation_attestation

        def revoke(plan_arg):
            revoked.append(plan_arg["activation_attestation"])
            return real_revoke(plan_arg)

        with mock.patch.object(service.os, "geteuid", return_value=0), mock.patch.object(
            service, "_require_production_plan"
        ), mock.patch.object(service, "_verify_provisioned_assets"), mock.patch.object(
            service,
            "_verify_broker_client",
            side_effect=ValueError("broker client drift"),
        ), mock.patch.object(
            service, "_revoke_activation_attestation", side_effect=revoke
        ):
            with self.assertRaises(service.PublisherRollbackSafetyError) as raised:
                service.activate_service(plan, runner=runner)

        self.assertIsInstance(raised.exception.__cause__, ValueError)
        self.assertEqual(str(raised.exception.__cause__), "broker client drift")
        self.assertEqual(revoked, [plan["activation_attestation"]])
        rendered = [" ".join(map(str, command)) for command in observed]
        self.assertIn(f"/bin/launchctl disable {label}", rendered)
        self.assertIn(f"/bin/launchctl bootout {label}", rendered)
        self.assertIn("/bin/launchctl print-disabled system", rendered)
        self.assertGreater(
            rendered.index(f"/bin/launchctl print {label}"),
            rendered.index(f"/bin/launchctl bootout {label}"),
        )
        self.assertGreater(
            rendered.index("/bin/launchctl print-disabled system"),
            rendered.index(f"/bin/launchctl print {label}"),
        )

    def test_activation_reads_back_pid_and_persistent_enablement_and_assets_before_attestation(
        self,
    ):
        plan = self.plan()
        events = []
        written = {}
        runner = self.activation_runner(events)
        label = f"system/{service.SERVICE_LABEL}"

        def verify_assets(_plan):
            events.append("verify-assets")

        def atomic_write(_path, content, **_kwargs):
            events.append("write-attestation")
            written["content"] = content

        with mock.patch.object(service.os, "geteuid", return_value=0), mock.patch.object(
            service, "_require_production_plan"
        ), mock.patch.object(
            service, "_verify_broker_client", return_value="b" * 64
        ), mock.patch.object(
            service, "_verify_private_repository"
        ), mock.patch.object(
            service, "_verify_publisher_credential_isolation"
        ), mock.patch.object(
            service, "_verify_provisioned_assets", side_effect=verify_assets
        ), mock.patch.object(
            service, "_atomic_write", side_effect=atomic_write
        ), mock.patch.object(
            service,
            "_read_file_exact",
            side_effect=lambda *_args, **_kwargs: (written["content"], mock.Mock()),
        ):
            attestation = service.activate_service(plan, runner=runner, now=lambda: 1234)

        self.assertIs(attestation["active"], True)
        self.assertEqual(events.count("verify-assets"), 2)
        self.assertEqual(events.count("write-attestation"), 1)
        kickstart = events.index(f"/bin/launchctl kickstart -k {label}")
        live_print = [
            index
            for index, event in enumerate(events)
            if event == f"/bin/launchctl print {label}"
        ][-1]
        persistent = events.index("/bin/launchctl print-disabled system")
        post_start_verify = events.index("verify-assets", kickstart)
        self.assertGreater(live_print, kickstart)
        self.assertGreater(persistent, live_print)
        self.assertGreater(post_start_verify, persistent)
        self.assertGreater(events.index("write-attestation"), post_start_verify)

    def test_activation_still_disabled_after_kickstart_rolls_back_without_attestation(
        self,
    ):
        plan = self.plan()
        label = f"system/{service.SERVICE_LABEL}"
        regressions = (
            ("persistent-enablement", None),
            ("empty-readback", (0, "")),
            ("registry-error", (2, "print-disabled unavailable\n")),
        )
        for name, disabled_response in regressions:
            with self.subTest(name=name):
                events = []
                written = []
                runner = self.activation_runner(
                    events,
                    enabled=False,
                    disabled_response=disabled_response,
                )

                with mock.patch.object(service.os, "geteuid", return_value=0), mock.patch.object(
                    service, "_require_production_plan"
                ), mock.patch.object(
                    service, "_verify_broker_client", return_value="b" * 64
                ), mock.patch.object(
                    service, "_verify_private_repository"
                ), mock.patch.object(
                    service, "_verify_publisher_credential_isolation"
                ), mock.patch.object(service, "_verify_provisioned_assets"), mock.patch.object(
                    service, "_atomic_write",
                    side_effect=lambda _path, content, **_kwargs: written.append(content),
                ), mock.patch.object(
                    service,
                    "_read_file_exact",
                    side_effect=lambda *_args, **_kwargs: (
                        written[-1] if written else b"",
                        mock.Mock(),
                    ),
                ):
                    with self.assertRaisesRegex(
                        ValueError, "did not read back persistent enablement"
                    ):
                        service.activate_service(plan, runner=runner, now=lambda: 1234)

                self.assertEqual(written, [])
                self.assertIn(f"/bin/launchctl disable {label}", events)
                self.assertIn(f"/bin/launchctl bootout {label}", events)
                self.assertGreater(
                    max(
                        index
                        for index, event in enumerate(events)
                        if event == "/bin/launchctl print-disabled system"
                    ),
                    events.index(f"/bin/launchctl bootout {label}"),
                )

    def test_activation_bootstraps_absent_service_before_durable_readbacks(self):
        plan = self.plan()
        events = []
        written = {}
        runner = self.activation_runner(events, present=False)
        label = f"system/{service.SERVICE_LABEL}"

        def atomic_write(_path, content, **_kwargs):
            written["content"] = content

        with mock.patch.object(service.os, "geteuid", return_value=0), mock.patch.object(
            service, "_require_production_plan"
        ), mock.patch.object(
            service, "_verify_broker_client", return_value="b" * 64
        ), mock.patch.object(
            service, "_verify_private_repository"
        ), mock.patch.object(
            service, "_verify_publisher_credential_isolation"
        ), mock.patch.object(service, "_verify_provisioned_assets"), mock.patch.object(
            service, "_atomic_write", side_effect=atomic_write
        ), mock.patch.object(
            service,
            "_read_file_exact",
            side_effect=lambda *_args, **_kwargs: (written["content"], mock.Mock()),
        ):
            attestation = service.activate_service(plan, runner=runner, now=lambda: 1234)

        self.assertIs(attestation["active"], True)
        bootstrap = events.index(f"/bin/launchctl bootstrap system {plan['launchd_plist_path']}")
        enable = events.index(f"/bin/launchctl enable {label}")
        kickstart = events.index(f"/bin/launchctl kickstart -k {label}")
        persistent = events.index("/bin/launchctl print-disabled system")
        self.assertLess(bootstrap, enable)
        self.assertLess(enable, kickstart)
        self.assertGreater(persistent, kickstart)

    def test_activation_non_running_readback_rolls_back_without_attestation(self):
        plan = self.plan()
        events = []
        written = []
        runner = self.activation_runner(events, running=False)
        label = f"system/{service.SERVICE_LABEL}"

        with mock.patch.object(service.os, "geteuid", return_value=0), mock.patch.object(
            service, "_require_production_plan"
        ), mock.patch.object(
            service, "_verify_broker_client", return_value="b" * 64
        ), mock.patch.object(
            service, "_verify_private_repository"
        ), mock.patch.object(
            service, "_verify_publisher_credential_isolation"
        ), mock.patch.object(service, "_verify_provisioned_assets"), mock.patch.object(
            service, "_atomic_write",
            side_effect=lambda *_args, **_kwargs: written.append(True),
        ):
            with self.assertRaisesRegex(ValueError, "did not read back running"):
                service.activate_service(plan, runner=runner, now=lambda: 1234)

        self.assertEqual(written, [])
        self.assertIn(f"/bin/launchctl disable {label}", events)
        self.assertIn(f"/bin/launchctl bootout {label}", events)
        self.assertIn("/bin/launchctl print-disabled system", events)

    def test_activation_post_start_asset_drift_rolls_back_without_attestation(self):
        plan = self.plan()
        events = []
        written = []
        runner = self.activation_runner(events)
        label = f"system/{service.SERVICE_LABEL}"

        with mock.patch.object(service.os, "geteuid", return_value=0), mock.patch.object(
            service, "_require_production_plan"
        ), mock.patch.object(
            service, "_verify_broker_client", return_value="b" * 64
        ), mock.patch.object(
            service, "_verify_private_repository"
        ), mock.patch.object(
            service, "_verify_publisher_credential_isolation"
        ), mock.patch.object(
            service,
            "_verify_provisioned_assets",
            side_effect=[
                None,
                ValueError("publisher runtime asset differs from manifest"),
            ],
        ), mock.patch.object(
            service, "_atomic_write",
            side_effect=lambda _path, content, **_kwargs: written.append(content),
        ), mock.patch.object(
            service,
            "_read_file_exact",
            side_effect=lambda *_args, **_kwargs: (
                written[-1] if written else b"",
                mock.Mock(),
            ),
        ):
            with self.assertRaisesRegex(ValueError, "runtime asset differs from manifest"):
                service.activate_service(plan, runner=runner, now=lambda: 1234)

        self.assertEqual(written, [])
        self.assertIn(f"/bin/launchctl kickstart -k {label}", events)
        self.assertIn(f"/bin/launchctl disable {label}", events)
        self.assertIn(f"/bin/launchctl bootout {label}", events)
        self.assertGreater(
            max(
                index
                for index, event in enumerate(events)
                if event == "/bin/launchctl print-disabled system"
            ),
            events.index(f"/bin/launchctl bootout {label}"),
        )

    def test_provision_requires_persistent_disablement_before_filesystem_mutation(
        self,
    ):
        plan = self.plan()
        observed = []
        mkdirs = []
        label = f"system/{service.SERVICE_LABEL}"

        def runner(command, **_kwargs):
            observed.append(command)
            rendered = " ".join(map(str, command))
            if "print-disabled" in rendered:
                return subprocess.CompletedProcess(
                    command, 0, '"ai.hermes.radulator-publisher" => false\n', ""
                )
            if "launchctl print" in rendered:
                return subprocess.CompletedProcess(
                    command, 3, "", "Could not find service"
                )
            return subprocess.CompletedProcess(command, 0, "", "")

        with mock.patch.object(service.os, "geteuid", return_value=0), mock.patch.object(
            service, "_require_production_plan"
        ), mock.patch.object(
            service,
            "_mkdir_exact",
            side_effect=lambda path, **_kwargs: mkdirs.append(path),
        ):
            with self.assertRaisesRegex(ValueError, "persistently disabled"):
                service.provision_service(plan, runner=runner)

        rendered = [" ".join(map(str, command)) for command in observed]
        self.assertIn(f"/bin/launchctl disable {label}", rendered)
        self.assertIn("/bin/launchctl print-disabled system", rendered)
        self.assertGreater(
            rendered.index("/bin/launchctl print-disabled system"),
            rendered.index(f"/bin/launchctl disable {label}"),
        )
        self.assertEqual(mkdirs, [])

    def test_provision_disable_transport_failure_still_proves_persistent_disablement(
        self,
    ):
        plan = self.plan()
        observed = []
        mkdirs = []
        label = f"system/{service.SERVICE_LABEL}"

        def runner(command, **_kwargs):
            observed.append(command)
            rendered = " ".join(map(str, command))
            if "launchctl disable" in rendered:
                raise OSError("disable transport failed")
            if "print-disabled" in rendered:
                return subprocess.CompletedProcess(
                    command, 0, '"ai.hermes.radulator-publisher" => true\n', ""
                )
            if "launchctl print" in rendered:
                return subprocess.CompletedProcess(
                    command, 3, "", "Could not find service"
                )
            if "remote get-url" in rendered:
                return subprocess.CompletedProcess(
                    command, 0, "https://github.com/momomojo/Radulator.git\n", ""
                )
            return subprocess.CompletedProcess(command, 0, "", "")

        with mock.patch.object(service.os, "geteuid", return_value=0), mock.patch.object(
            service, "_require_production_plan"
        ), mock.patch.object(
            service,
            "_mkdir_exact",
            side_effect=lambda path, **_kwargs: mkdirs.append(path),
        ), mock.patch.object(service, "_atomic_write"), mock.patch.object(
            service, "_verify_provisioned_assets"
        ), mock.patch.object(service, "_verify_private_repository"):
            result = service.provision_service(plan, runner=runner)

        self.assertIs(result["enabled"], False)
        rendered = [" ".join(map(str, command)) for command in observed]
        self.assertIn(f"/bin/launchctl disable {label}", rendered)
        self.assertIn("/bin/launchctl print-disabled system", rendered)
        self.assertGreater(
            rendered.index("/bin/launchctl print-disabled system"),
            rendered.index(f"/bin/launchctl disable {label}"),
        )
        self.assertIn(self.install_root, mkdirs)

    def test_provision_safety_gate_orders_disable_revoke_bootout_before_readbacks_and_mkdir(
        self,
    ):
        plan = self.plan()
        events = []
        label = f"system/{service.SERVICE_LABEL}"

        def runner(command, **_kwargs):
            events.append(" ".join(map(str, command)))
            rendered = events[-1]
            if "print-disabled" in rendered:
                return subprocess.CompletedProcess(
                    command, 0, '"ai.hermes.radulator-publisher" => true\n', ""
                )
            if "launchctl print" in rendered:
                return subprocess.CompletedProcess(
                    command, 3, "", "Could not find service"
                )
            if "remote get-url" in rendered:
                return subprocess.CompletedProcess(
                    command, 0, "https://github.com/momomojo/Radulator.git\n", ""
                )
            return subprocess.CompletedProcess(command, 0, "", "")

        real_revoke = service._revoke_activation_attestation

        def revoke(plan_arg):
            events.append("revoke-attestation")
            return real_revoke(plan_arg)

        def mkdir(path, **_kwargs):
            events.append(f"mkdir {path}")

        with mock.patch.object(service.os, "geteuid", return_value=0), mock.patch.object(
            service, "_require_production_plan"
        ), mock.patch.object(
            service, "_revoke_activation_attestation", side_effect=revoke
        ), mock.patch.object(
            service, "_mkdir_exact", side_effect=mkdir
        ), mock.patch.object(service, "_atomic_write"), mock.patch.object(
            service, "_verify_provisioned_assets"
        ), mock.patch.object(service, "_verify_private_repository"):
            result = service.provision_service(plan, runner=runner)

        self.assertIs(result["enabled"], False)
        self.assertEqual(
            events[:5],
            [
                f"/bin/launchctl disable {label}",
                "revoke-attestation",
                f"/bin/launchctl bootout {label}",
                f"/bin/launchctl print {label}",
                "/bin/launchctl print-disabled system",
            ],
        )
        self.assertTrue(events[5].startswith("mkdir "))

    def test_provision_revocation_failure_still_bootout_and_readbacks_before_mkdir(
        self,
    ):
        plan = self.plan()
        events = []
        mkdirs = []
        label = f"system/{service.SERVICE_LABEL}"

        def runner(command, **_kwargs):
            events.append(" ".join(map(str, command)))
            rendered = events[-1]
            if "print-disabled" in rendered:
                return subprocess.CompletedProcess(
                    command, 0, '"ai.hermes.radulator-publisher" => true\n', ""
                )
            if "launchctl print" in rendered:
                return subprocess.CompletedProcess(
                    command, 3, "", "Could not find service"
                )
            if "remote get-url" in rendered:
                return subprocess.CompletedProcess(
                    command, 0, "https://github.com/momomojo/Radulator.git\n", ""
                )
            return subprocess.CompletedProcess(command, 0, "", "")

        with mock.patch.object(service.os, "geteuid", return_value=0), mock.patch.object(
            service, "_require_production_plan"
        ), mock.patch.object(
            service,
            "_revoke_activation_attestation",
            side_effect=OSError("attestation revocation blocked"),
        ), mock.patch.object(
            service,
            "_mkdir_exact",
            side_effect=lambda path, **_kwargs: mkdirs.append(path),
        ), mock.patch.object(service, "_atomic_write"), mock.patch.object(
            service, "_verify_provisioned_assets"
        ), mock.patch.object(service, "_verify_private_repository"):
            with self.assertRaisesRegex(
                service.PublisherAttestationRevocationError, "revocation"
            ):
                service.provision_service(plan, runner=runner)

        self.assertIn(f"/bin/launchctl bootout {label}", events)
        self.assertIn(f"/bin/launchctl print {label}", events)
        self.assertIn("/bin/launchctl print-disabled system", events)
        self.assertGreater(
            events.index(f"/bin/launchctl print {label}"),
            events.index(f"/bin/launchctl bootout {label}"),
        )
        self.assertGreater(
            events.index("/bin/launchctl print-disabled system"),
            events.index(f"/bin/launchctl print {label}"),
        )
        self.assertEqual(mkdirs, [])

    def test_provision_bootout_transport_failure_proceeds_only_on_safe_readbacks(self):
        plan = self.plan()
        observed = []
        mkdirs = []
        label = f"system/{service.SERVICE_LABEL}"

        def runner(command, **_kwargs):
            observed.append(command)
            rendered = " ".join(map(str, command))
            if "launchctl bootout" in rendered:
                raise OSError("bootout transport failed")
            if "print-disabled" in rendered:
                return subprocess.CompletedProcess(
                    command, 0, '"ai.hermes.radulator-publisher" => true\n', ""
                )
            if "launchctl print" in rendered:
                return subprocess.CompletedProcess(
                    command, 3, "", "Could not find service"
                )
            if "remote get-url" in rendered:
                return subprocess.CompletedProcess(
                    command, 0, "https://github.com/momomojo/Radulator.git\n", ""
                )
            return subprocess.CompletedProcess(command, 0, "", "")

        with mock.patch.object(service.os, "geteuid", return_value=0), mock.patch.object(
            service, "_require_production_plan"
        ), mock.patch.object(
            service,
            "_mkdir_exact",
            side_effect=lambda path, **_kwargs: mkdirs.append(path),
        ), mock.patch.object(service, "_atomic_write"), mock.patch.object(
            service, "_verify_provisioned_assets"
        ), mock.patch.object(service, "_verify_private_repository"):
            result = service.provision_service(plan, runner=runner)

        self.assertIs(result["enabled"], False)
        rendered = [" ".join(map(str, command)) for command in observed]
        self.assertIn(f"/bin/launchctl bootout {label}", rendered)
        self.assertIn(f"/bin/launchctl print {label}", rendered)
        self.assertIn("/bin/launchctl print-disabled system", rendered)
        self.assertGreater(
            rendered.index(f"/bin/launchctl print {label}"),
            rendered.index(f"/bin/launchctl bootout {label}"),
        )
        self.assertIn(self.install_root, mkdirs)

    def test_provision_fails_closed_when_loaded_after_bootout_despite_registry_true(
        self,
    ):
        plan = self.plan()
        observed = []
        mkdirs = []
        label = f"system/{service.SERVICE_LABEL}"

        def runner(command, **_kwargs):
            observed.append(command)
            rendered = " ".join(map(str, command))
            if "print-disabled" in rendered:
                return subprocess.CompletedProcess(
                    command, 0, '"ai.hermes.radulator-publisher" => true\n', ""
                )
            if "launchctl print" in rendered:
                return subprocess.CompletedProcess(
                    command,
                    0,
                    "system/ai.hermes.radulator-publisher = {\n"
                    " state = running\n pid = 4321\n}\n",
                    "",
                )
            return subprocess.CompletedProcess(command, 0, "", "")

        with mock.patch.object(service.os, "geteuid", return_value=0), mock.patch.object(
            service, "_require_production_plan"
        ), mock.patch.object(
            service,
            "_mkdir_exact",
            side_effect=lambda path, **_kwargs: mkdirs.append(path),
        ), mock.patch.object(service, "_atomic_write"), mock.patch.object(
            service, "_verify_provisioned_assets"
        ), mock.patch.object(service, "_verify_private_repository"):
            with self.assertRaisesRegex(ValueError, "booted out"):
                service.provision_service(plan, runner=runner)

        rendered = [" ".join(map(str, command)) for command in observed]
        self.assertIn(f"/bin/launchctl bootout {label}", rendered)
        self.assertGreater(
            rendered.index(f"/bin/launchctl print {label}"),
            rendered.index(f"/bin/launchctl bootout {label}"),
        )
        self.assertEqual(mkdirs, [])

    def test_activation_rollback_revocation_failure_fails_closed_despite_safe_state(
        self,
    ):
        plan = self.plan()
        observed = []
        label = f"system/{service.SERVICE_LABEL}"

        def runner(command, **_kwargs):
            observed.append(command)
            rendered = " ".join(map(str, command))
            if "print-disabled" in rendered:
                return subprocess.CompletedProcess(
                    command, 0, '"ai.hermes.radulator-publisher" => true\n', ""
                )
            if "launchctl print" in rendered:
                return subprocess.CompletedProcess(
                    command, 3, "", "Could not find service"
                )
            return subprocess.CompletedProcess(command, 0, "", "")

        with mock.patch.object(service.os, "geteuid", return_value=0), mock.patch.object(
            service, "_require_production_plan"
        ), mock.patch.object(service, "_verify_provisioned_assets"), mock.patch.object(
            service,
            "_verify_broker_client",
            side_effect=ValueError("broker client drift"),
        ), mock.patch.object(
            service,
            "_revoke_activation_attestation",
            side_effect=OSError("attestation revocation blocked"),
        ):
            with self.assertRaises(service.PublisherRollbackSafetyError) as raised:
                service.activate_service(plan, runner=runner)

        self.assertEqual(
            str(raised.exception),
            "publisher activation rollback did not revoke activation attestation",
        )
        self.assertIsInstance(raised.exception.__cause__, ValueError)
        self.assertEqual(str(raised.exception.__cause__), "broker client drift")
        rendered = [" ".join(map(str, command)) for command in observed]
        self.assertIn(f"/bin/launchctl bootout {label}", rendered)
        self.assertIn(f"/bin/launchctl print {label}", rendered)
        self.assertIn("/bin/launchctl print-disabled system", rendered)
        self.assertGreater(
            rendered.index(f"/bin/launchctl print {label}"),
            rendered.index(f"/bin/launchctl bootout {label}"),
        )
        self.assertGreater(
            rendered.index("/bin/launchctl print-disabled system"),
            rendered.index(f"/bin/launchctl print {label}"),
        )

    def test_activation_rollback_reports_unrevoked_attestation_over_safe_readback(self):
        plan = self.plan()
        observed = []
        label = f"system/{service.SERVICE_LABEL}"

        def runner(command, **_kwargs):
            observed.append(command)
            rendered = " ".join(map(str, command))
            if "print-disabled" in rendered:
                return subprocess.CompletedProcess(
                    command, 0, '"ai.hermes.radulator-publisher" => true\n', ""
                )
            if "launchctl print" in rendered:
                return subprocess.CompletedProcess(
                    command,
                    0,
                    "system/ai.hermes.radulator-publisher = {\n"
                    " state = running\n pid = 4321\n}\n",
                    "",
                )
            return subprocess.CompletedProcess(command, 0, "", "")

        with mock.patch.object(service.os, "geteuid", return_value=0), mock.patch.object(
            service, "_require_production_plan"
        ), mock.patch.object(service, "_verify_provisioned_assets"), mock.patch.object(
            service,
            "_verify_broker_client",
            side_effect=ValueError("broker client drift"),
        ), mock.patch.object(
            service,
            "_revoke_activation_attestation",
            side_effect=OSError("attestation revocation blocked"),
        ):
            with self.assertRaises(service.PublisherRollbackSafetyError) as raised:
                service.activate_service(plan, runner=runner)

        self.assertEqual(
            str(raised.exception),
            "publisher activation rollback did not revoke activation attestation",
        )
        self.assertEqual(str(raised.exception.__cause__), "broker client drift")
        rendered = [" ".join(map(str, command)) for command in observed]
        self.assertIn(f"/bin/launchctl bootout {label}", rendered)
        self.assertIn("/bin/launchctl print-disabled system", rendered)

    def test_attestation_revocation_requires_post_unlink_absence_readback(self):
        plan = self.plan()
        attempts = []

        class CountingUnlink(UnlinkIsInconclusive):
            def lstat(self):
                attempts.append(self.path)
                return super().lstat()

        with mock.patch.object(
            service, "Path", lambda value: CountingUnlink(value)
        ):
            with self.assertRaisesRegex(ValueError, "read back absent"):
                service._revoke_activation_attestation(plan)

        self.assertEqual(len(attempts), 2)

    def test_attestation_revocation_proves_absence_after_unlink(self):
        plan = self.plan()
        attempts = []

        class RevocablePath:
            def __init__(self, path):
                self.path = str(path)
                self.unlinked = False

            def lstat(self):
                attempts.append((self.path, self.unlinked))
                if self.unlinked:
                    raise FileNotFoundError(self.path)
                return mock.Mock(st_mode=stat.S_IFREG, st_uid=0)

            def unlink(self):
                self.unlinked = True

            def __str__(self):
                return self.path

        with mock.patch.object(
            service, "Path", lambda value: RevocablePath(value)
        ):
            service._revoke_activation_attestation(plan)

        self.assertEqual(
            attempts,
            [
                (plan["activation_attestation"], False),
                (plan["activation_attestation"], True),
            ],
        )

    def test_activation_rollback_fails_closed_when_attestation_survives_unlink(self):
        plan = self.plan()
        observed = []
        label = f"system/{service.SERVICE_LABEL}"

        def runner(command, **_kwargs):
            observed.append(command)
            rendered = " ".join(map(str, command))
            if "print-disabled" in rendered:
                return subprocess.CompletedProcess(
                    command, 0, '"ai.hermes.radulator-publisher" => true\n', ""
                )
            if "launchctl print" in rendered:
                return subprocess.CompletedProcess(
                    command, 3, "", "Could not find service"
                )
            return subprocess.CompletedProcess(command, 0, "", "")

        with mock.patch.object(service.os, "geteuid", return_value=0), mock.patch.object(
            service, "_require_production_plan"
        ), mock.patch.object(service, "_verify_provisioned_assets"), mock.patch.object(
            service,
            "_verify_broker_client",
            side_effect=ValueError("broker client drift"),
        ), mock.patch.object(
            service,
            "Path",
            lambda value: UnlinkIsInconclusive(value),
        ):
            with self.assertRaises(service.PublisherRollbackSafetyError) as raised:
                service.activate_service(plan, runner=runner)

        self.assertEqual(
            str(raised.exception),
            "publisher activation rollback did not revoke activation attestation",
        )
        self.assertEqual(str(raised.exception.__cause__), "broker client drift")
        rendered = [" ".join(map(str, command)) for command in observed]
        self.assertIn(f"/bin/launchctl bootout {label}", rendered)
        self.assertIn(f"/bin/launchctl print {label}", rendered)
        self.assertIn("/bin/launchctl print-disabled system", rendered)

    def test_deactivate_requires_persistent_disablement_readback(self):
        plan = self.plan()
        observed = []
        revoked = []
        label = f"system/{service.SERVICE_LABEL}"

        def runner(command, **_kwargs):
            observed.append(command)
            rendered = " ".join(map(str, command))
            if "print-disabled" in rendered:
                return subprocess.CompletedProcess(command, 0, "{\n}\n", "")
            if "launchctl print" in rendered:
                return subprocess.CompletedProcess(
                    command, 3, "", "Could not find service"
                )
            return subprocess.CompletedProcess(command, 0, "", "")

        real_revoke = service._revoke_activation_attestation

        def revoke(plan_arg):
            revoked.append(plan_arg["activation_attestation"])
            return real_revoke(plan_arg)

        with mock.patch.object(service.os, "geteuid", return_value=0), mock.patch.object(
            service, "_require_fixed_production_paths"
        ), mock.patch.object(
            service, "_revoke_activation_attestation", side_effect=revoke
        ):
            with self.assertRaises(service.PublisherDeactivationSafetyError) as raised:
                service.deactivate_service(plan, runner=runner)

        self.assertEqual(revoked, [plan["activation_attestation"]])
        rendered = [" ".join(map(str, command)) for command in observed]
        self.assertIn(f"/bin/launchctl disable {label}", rendered)
        self.assertIn(f"/bin/launchctl bootout {label}", rendered)
        self.assertIn("/bin/launchctl print-disabled system", rendered)
        self.assertGreater(
            rendered.index("/bin/launchctl print-disabled system"),
            rendered.index(f"/bin/launchctl bootout {label}"),
        )

    def test_deactivate_disable_transport_failure_still_proves_safe_state(self):
        plan = self.plan()
        observed = []
        revoked = []
        label = f"system/{service.SERVICE_LABEL}"

        def runner(command, **_kwargs):
            observed.append(command)
            rendered = " ".join(map(str, command))
            if "launchctl disable" in rendered:
                raise OSError("disable transport failed")
            if "print-disabled" in rendered:
                return subprocess.CompletedProcess(
                    command, 0, '"ai.hermes.radulator-publisher" => true\n', ""
                )
            if "launchctl print" in rendered:
                return subprocess.CompletedProcess(
                    command, 3, "", "Could not find service"
                )
            return subprocess.CompletedProcess(command, 0, "", "")

        real_revoke = service._revoke_activation_attestation

        def revoke(plan_arg):
            revoked.append(plan_arg["activation_attestation"])
            return real_revoke(plan_arg)

        with mock.patch.object(service.os, "geteuid", return_value=0), mock.patch.object(
            service, "_require_fixed_production_paths"
        ), mock.patch.object(
            service, "_revoke_activation_attestation", side_effect=revoke
        ):
            with self.assertRaises(service.PublisherDeactivationSafetyError) as raised:
                service.deactivate_service(plan, runner=runner)

        self.assertIsInstance(raised.exception.__cause__, OSError)
        self.assertEqual(revoked, [plan["activation_attestation"]])
        rendered = [" ".join(map(str, command)) for command in observed]
        self.assertIn(f"/bin/launchctl bootout {label}", rendered)
        self.assertIn(f"/bin/launchctl print {label}", rendered)
        self.assertIn("/bin/launchctl print-disabled system", rendered)
        self.assertGreater(
            rendered.index("/bin/launchctl print-disabled system"),
            rendered.index(f"/bin/launchctl print {label}"),
        )

    def test_deactivate_reports_revocation_error_over_transport_error(self):
        plan = self.plan()
        observed = []
        label = f"system/{service.SERVICE_LABEL}"

        def runner(command, **_kwargs):
            observed.append(command)
            rendered = " ".join(map(str, command))
            if "launchctl disable" in rendered:
                raise OSError("disable transport failed")
            if "print-disabled" in rendered:
                return subprocess.CompletedProcess(
                    command, 0, '"ai.hermes.radulator-publisher" => true\n', ""
                )
            if "launchctl print" in rendered:
                return subprocess.CompletedProcess(
                    command, 3, "", "Could not find service"
                )
            return subprocess.CompletedProcess(command, 0, "", "")

        with mock.patch.object(service.os, "geteuid", return_value=0), mock.patch.object(
            service, "_require_fixed_production_paths"
        ), mock.patch.object(
            service,
            "Path",
            lambda value: UnlinkIsInconclusive(value),
        ):
            with self.assertRaises(service.PublisherDeactivationSafetyError) as raised:
                service.deactivate_service(plan, runner=runner)

        self.assertEqual(
            str(raised.exception),
            "publisher deactivation did not revoke activation attestation",
        )
        self.assertIsInstance(
            raised.exception.__cause__, service.PublisherAttestationRevocationError
        )
        rendered = [" ".join(map(str, command)) for command in observed]
        self.assertIn(f"/bin/launchctl bootout {label}", rendered)
        self.assertIn("/bin/launchctl print-disabled system", rendered)


if __name__ == "__main__":
    unittest.main()
