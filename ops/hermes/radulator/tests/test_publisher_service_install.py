import json
import hashlib
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
        self.real_ancestor_validator = service._validate_immutable_ancestors
        self.ancestor_validator_patcher = mock.patch.object(
            service, "_validate_immutable_ancestors"
        )
        self.ancestor_validator_patcher.start()
        self.addCleanup(self.ancestor_validator_patcher.stop)
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
        self.runtime_counter = 0

    def tearDown(self):
        self.temp.cleanup()

    def plan(self):
        attestation, manifest, _runtime_root = self.shared_runtime()
        return service.build_service_plan(
            source_root=self.source,
            install_root=self.install_root,
            publisher_home=self.publisher_home,
            broker_client_config=self.client_config,
            launchd_plist_path=self.plist,
            python_executable=self.python,
            broker_runtime_attestation_path=attestation,
            runtime_manifest_path=manifest,
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

    def shared_runtime(self):
        """Write the public broker runtime-v2 contract used by focused tests."""
        self.runtime_counter += 1
        suffix = "" if self.runtime_counter == 1 else f"-{self.runtime_counter}"
        runtime_root = self.root / f"sealed-runtime{suffix}"
        package = runtime_root / "lib" / "python3.11" / "site-packages" / "hermes_cli"
        (runtime_root / "bin").mkdir(parents=True)
        package.mkdir(parents=True)
        python = runtime_root / "bin" / "python3.11"
        python.write_bytes(b"sealed python executable\n")
        python.chmod(0o555)
        runtime_probe = runtime_root / "runtime-probe.py"
        runtime_probe.write_bytes(b"# sealed runtime probe\n")
        runtime_probe.chmod(0o555)
        (package / "__init__.py").write_bytes(b"\n")
        (package / "kanban_broker_client.py").write_bytes(b"SEALED = True\n")
        (package / "__init__.py").chmod(0o444)
        (package / "kanban_broker_client.py").chmod(0o444)
        for directory in (
            runtime_root,
            runtime_root / "bin",
            runtime_root / "lib",
            runtime_root / "lib" / "python3.11",
            runtime_root / "lib" / "python3.11" / "site-packages",
            package,
        ):
            directory.chmod(0o555)
        runtime_root = runtime_root.resolve(strict=True)
        python = python.resolve(strict=True)
        runtime_probe = runtime_probe.resolve(strict=True)
        publisher_probe = (self.root / "runtime-publisher-probe.py").resolve()
        if not publisher_probe.exists():
            publisher_probe.write_bytes(
                (self.source / "trusted_publisher.py").read_bytes()
            )
            publisher_probe.chmod(0o555)
        entries = [
            {"path": "bin/", "type": "directory", "mode": 0o555},
            {"path": "bin/python3.11", "type": "file", "mode": 0o555, "size": len(python.read_bytes()), "sha256": hashlib.sha256(python.read_bytes()).hexdigest()},
            {"path": "lib/", "type": "directory", "mode": 0o555},
            {"path": "lib/python3.11/", "type": "directory", "mode": 0o555},
            {"path": "lib/python3.11/site-packages/", "type": "directory", "mode": 0o555},
            {"path": "lib/python3.11/site-packages/hermes_cli/", "type": "directory", "mode": 0o555},
            {"path": "lib/python3.11/site-packages/hermes_cli/__init__.py", "type": "file", "mode": 0o444, "size": 1, "sha256": hashlib.sha256(b"\n").hexdigest()},
            {"path": "lib/python3.11/site-packages/hermes_cli/kanban_broker_client.py", "type": "file", "mode": 0o444, "size": len(b"SEALED = True\n"), "sha256": hashlib.sha256(b"SEALED = True\n").hexdigest()},
            {"path": "runtime-probe.py", "type": "file", "mode": 0o555, "size": len(runtime_probe.read_bytes()), "sha256": hashlib.sha256(runtime_probe.read_bytes()).hexdigest()},
        ]
        manifest_sha = hashlib.sha256(json.dumps(entries, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        manifest = self.root / "broker-runtime-manifest.json"
        manifest.write_text(json.dumps({
            "contract": "hermes.kanban_broker_runtime_manifest.v1",
            "schema_version": 1,
            "runtime_root": str(runtime_root),
            "python_executable": str(python),
            "python_version": "3.11.15",
            "provenance": {
                **service.CPYTHON_RUNTIME_PROVENANCE,
                "sha256": service.CPYTHON_RUNTIME_ARCHIVE_SHA256,
            },
            "runtime_manifest_sha256": manifest_sha,
            "entries": entries,
        }, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
        manifest.chmod(0o644)
        manifest = manifest.resolve(strict=True)
        attestation = self.root / "broker-runtime-attestation.json"
        attestation.write_text(json.dumps({
            "contract": "hermes.kanban_broker_runtime_attestation.v1",
            "schema_version": 1,
            "active": False,
            "revoked": True,
            "service_config_sha256": "e" * 64,
            "hermes_source_sha": "b" * 40,
            "hermes_install_archive_sha256": "d" * 64,
            "hermes_pyproject_lock_sha256": "f" * 64,
            "hermes_provenance_sha256": "1" * 64,
            "radulator_source_sha": "a" * 40,
            "runtime_root": str(runtime_root),
            "runtime_manifest_path": str(manifest),
            "python_executable": str(python),
            "python_version": "3.11.15",
            "python_sha256": hashlib.sha256(python.read_bytes()).hexdigest(),
            "runtime_manifest_sha256": manifest_sha,
            "runtime_provenance": {
                **service.CPYTHON_RUNTIME_PROVENANCE,
                "sha256": service.CPYTHON_RUNTIME_ARCHIVE_SHA256,
            },
            "publisher_probe_path": str(publisher_probe),
            "publisher_probe_sha256": hashlib.sha256(publisher_probe.read_bytes()).hexdigest(),
            "publisher_probe_contract": "radulator.publisher_runtime_preflight.v1",
            "publisher_probe_status": "PENDING",
            "archive_digests": {"cpython": service.CPYTHON_RUNTIME_ARCHIVE_SHA256, "hermes_install": "d" * 64},
            "isolated_probe": {
                "command": [str(python), "-I", "-B", str(runtime_probe)],
                "outcome": "PENDING",
            },
        }, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
        attestation.chmod(0o644)
        return attestation, manifest, runtime_root

    def shared_plan(self):
        return self.plan()

    def test_plan_requires_pending_broker_runtime_v2_and_binds_external_manifest(self):
        plan = self.shared_plan()
        self.assertEqual(plan["contract"], service.SERVICE_PLAN_CONTRACT_V2)
        self.assertEqual(plan["runtime_root"], str((self.root / "sealed-runtime").resolve()))
        self.assertEqual(plan["python_version"], "3.11.15")
        self.assertEqual(plan["broker_runtime_attestation"]["active"], False)
        self.assertEqual(plan["broker_runtime_attestation"]["revoked"], True)
        self.assertNotEqual(plan["publisher_asset_root"], plan["runtime_root"])

    def test_real_ancestor_validator_rejects_world_writable_ancestor(self):
        path_metadata = {
            "/sealed": mock.Mock(st_mode=stat.S_IFDIR | 0o755, st_uid=0),
            "/sealed/runtime": mock.Mock(
                st_mode=stat.S_IFDIR | 0o777, st_uid=os.geteuid()
            ),
        }

        with mock.patch.object(
            Path, "lstat", new=lambda path: path_metadata[str(path)]
        ):
            with self.assertRaisesRegex(ValueError, "runtime ancestor is mutable"):
                self.real_ancestor_validator(
                    Path("/sealed/runtime/attestation.json"),
                    expected_uid=os.geteuid(),
                )

    def test_real_ancestor_validator_accepts_controlled_immutable_ancestry(self):
        path_metadata = {
            "/sealed": mock.Mock(st_mode=stat.S_IFDIR | 0o755, st_uid=0),
            "/sealed/runtime": mock.Mock(
                st_mode=stat.S_IFDIR | 0o550, st_uid=os.geteuid()
            ),
        }

        with mock.patch.object(
            Path, "lstat", new=lambda path: path_metadata[str(path)]
        ):
            self.real_ancestor_validator(
                Path("/sealed/runtime/attestation.json"),
                expected_uid=os.geteuid(),
            )

    def test_plan_rejects_v1_broker_runtime_contract(self):
        plan = self.plan()
        attestation = Path(plan["broker_runtime_attestation_path"])
        payload = json.loads(attestation.read_text())
        payload["contract"] = "hermes.kanban_broker_runtime_attestation.v0"
        attestation.write_text(json.dumps(payload) + "\n")
        with self.assertRaisesRegex(ValueError, "runtime attestation"):
            service._verify_shared_runtime(plan)

    def test_runtime_manifest_rejects_unexpected_entry(self):
        plan = self.shared_plan()
        extra = Path(plan["runtime_root"]) / "unexpected"
        Path(plan["runtime_root"]).chmod(0o755)
        extra.write_text("unexpected\n")
        Path(plan["runtime_root"]).chmod(0o555)
        with self.assertRaisesRegex(ValueError, "unexpected"):
            service._verify_shared_runtime(plan)

    def test_pending_runtime_can_transition_to_active_only_with_pass_probe(self):
        plan = self.shared_plan()
        attestation_path = Path(plan["broker_runtime_attestation_path"])
        payload = json.loads(attestation_path.read_text(encoding="utf-8"))
        payload["active"] = True
        payload["revoked"] = False
        payload["isolated_probe"]["outcome"] = "PASS"
        payload["publisher_probe_status"] = "PASS"
        attestation_path.write_text(
            json.dumps(payload, sort_keys=True, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )
        attestation_path.chmod(0o644)
        current = service._verify_shared_runtime(plan, require_active=True)
        self.assertIs(current["active"], True)
        self.assertIs(current["revoked"], False)
        self.assertEqual(current["isolated_probe"]["outcome"], "PASS")

    def test_broker_runtime_contract_rejects_noncanonical_isolated_probe_commands(self):
        for mutation in (
            "reordered flags",
            "relative probe path",
            "extra argument",
            "missing no-bytecode flag",
            "different probe script",
            "different python path",
        ):
            with self.subTest(mutation=mutation):
                plan = self.shared_plan()
                attestation_path = Path(plan["broker_runtime_attestation_path"])
                payload = json.loads(attestation_path.read_text(encoding="utf-8"))
                python = plan["python_executable"]
                runtime_probe = str(Path(plan["runtime_root"]) / "runtime-probe.py")
                commands = {
                    "reordered flags": [python, "-B", "-I", runtime_probe],
                    "relative probe path": [python, "-I", "-B", "runtime-probe.py"],
                    "extra argument": [python, "-I", "-B", runtime_probe, "--verbose"],
                    "missing no-bytecode flag": [python, "-I", runtime_probe],
                    "different probe script": [
                        python,
                        "-I",
                        "-B",
                        str(Path(plan["runtime_root"]) / "other-probe.py"),
                    ],
                    "different python path": [
                        str(Path(plan["runtime_root"]) / "bin/python3.12"),
                        "-I",
                        "-B",
                        runtime_probe,
                    ],
                }
                payload["active"] = True
                payload["revoked"] = False
                payload["publisher_probe_status"] = "PASS"
                payload["isolated_probe"] = {
                    "command": commands[mutation],
                    "outcome": "PASS",
                }
                attestation_path.write_text(
                    json.dumps(payload, sort_keys=True, separators=(",", ":")) + "\n",
                    encoding="utf-8",
                )
                attestation_path.chmod(0o644)

                with self.assertRaisesRegex(ValueError, "isolated runtime probe"):
                    service._read_broker_runtime_contract(
                        attestation_path=attestation_path,
                        manifest_path=Path(plan["runtime_manifest_path"]),
                        expected_radulator_source_sha=plan["source_commit_sha"],
                        require_active=True,
                        expected_owner_uid=os.geteuid(),
                        expected_owner_gid=os.getegid(),
                    )

    def test_runtime_plan_binding_rejects_probe_command_drift_during_transition(self):
        plan = self.shared_plan()
        attestation = json.loads(
            json.dumps(plan["broker_runtime_attestation"])
        )
        attestation["active"] = True
        attestation["revoked"] = False
        attestation["publisher_probe_status"] = "PASS"
        attestation["isolated_probe"]["outcome"] = "PASS"
        attestation["isolated_probe"]["command"].append("--unreviewed")

        self.assertFalse(
            service._runtime_plan_binding_matches(
                plan,
                attestation,
                plan["broker_runtime_manifest"],
                "0" * 64,
                plan["runtime_manifest_sha256"],
                allow_state_transition=True,
            )
        )

    def test_runtime_plan_binding_allows_only_exact_pending_to_pass_transition(self):
        plan = self.shared_plan()

        active = json.loads(json.dumps(plan["broker_runtime_attestation"]))
        active["active"] = True
        active["revoked"] = False
        active["publisher_probe_status"] = "PASS"
        active["isolated_probe"]["outcome"] = "PASS"
        self.assertTrue(
            service._runtime_plan_binding_matches(
                plan,
                active,
                plan["broker_runtime_manifest"],
                "0" * 64,
                plan["runtime_manifest_sha256"],
                allow_state_transition=True,
            )
        )

        invalid_states = (
            ("active but still revoked", True, True, "PASS", "PASS"),
            ("active before isolated probe pass", True, False, "PENDING", "PASS"),
            ("active before publisher probe pass", True, False, "PASS", "PENDING"),
            ("passes while inactive", False, True, "PASS", "PASS"),
        )
        for name, active_state, revoked, isolated_outcome, publisher_status in invalid_states:
            with self.subTest(name=name):
                observed = json.loads(json.dumps(plan["broker_runtime_attestation"]))
                observed["active"] = active_state
                observed["revoked"] = revoked
                observed["publisher_probe_status"] = publisher_status
                observed["isolated_probe"]["outcome"] = isolated_outcome
                self.assertFalse(
                    service._runtime_plan_binding_matches(
                        plan,
                        observed,
                        plan["broker_runtime_manifest"],
                        "0" * 64,
                        plan["runtime_manifest_sha256"],
                        allow_state_transition=True,
                    )
                )

    def test_wrapper_contains_b_and_runtime_preflight(self):
        wrapper = (Path(__file__).resolve().parents[1] / "trusted_publisher_cron.sh").read_text(encoding="utf-8")
        self.assertIn("-I", wrapper)
        self.assertIn("-B", wrapper)
        self.assertIn("RADULATOR_PUBLISHER_PREFLIGHT", wrapper)
        self.assertIn("--runtime-preflight", wrapper)

    def test_wrapper_runtime_preflight_needs_no_publication_only_configuration(self):
        wrapper = Path(__file__).resolve().parents[1] / "trusted_publisher_cron.sh"
        capture = self.root / "preflight-args.txt"
        capture_environment = self.root / "preflight-environment.txt"
        fake_python = self.root / "sealed-python"
        fake_python.write_text(
            "#!/bin/sh\n"
            "printf '%s\\n' \"$@\" > \"$RADULATOR_PREFLIGHT_CAPTURE\"\n"
            "printf '%s\\n' \"${GH_CONFIG_DIR-unset}\" > \"$RADULATOR_PREFLIGHT_ENV_CAPTURE\"\n",
            encoding="utf-8",
        )
        fake_python.chmod(0o755)
        env = {
            "PATH": "/usr/bin:/bin",
            "RADULATOR_PREFLIGHT_CAPTURE": str(capture),
            "RADULATOR_PREFLIGHT_ENV_CAPTURE": str(capture_environment),
            "RADULATOR_PUBLISHER_PREFLIGHT": "1",
            "GH_CONFIG_DIR": "/credential-bearing-config",
            "RADULATOR_PUBLISHER_HOME": str(self.publisher_home),
            "RADULATOR_PUBLISHER_PYTHON": str(fake_python),
            "RADULATOR_PUBLISHER_RUNTIME_ROOT": str(self.root / "sealed-runtime"),
            "RADULATOR_PUBLISHER_RUNTIME_MANIFEST": str(self.root / "runtime-manifest.json"),
            "RADULATOR_PUBLISHER_RUNTIME_MANIFEST_SHA256": "a" * 64,
            "RADULATOR_PUBLISHER_PYTHON_VERSION": "3.11.15",
            "RADULATOR_PUBLISHER_PYTHON_SHA256": "b" * 64,
            "RADULATOR_BROKER_CLIENT_CONFIG": str(self.client_config),
        }

        with tempfile.TemporaryDirectory() as working_directory:
            result = subprocess.run(
                ["/bin/bash", str(wrapper)],
                check=False,
                capture_output=True,
                text=True,
                timeout=30,
                env=env,
                cwd=working_directory,
            )

        self.assertEqual(result.returncode, 0, result.stderr)
        arguments = capture.read_text(encoding="utf-8").splitlines()
        self.assertEqual(arguments[:3], ["-I", "-B", str(wrapper.with_name("trusted_publisher.py"))])
        self.assertIn("--runtime-preflight", arguments)
        self.assertIn("--repository-id", arguments)
        self.assertIn("--broker-client-config", arguments)
        for publication_only in (
            "--project-root", "--lifecycle-controller", "--ledger", "--lock-file"
        ):
            self.assertNotIn(publication_only, arguments)
        self.assertEqual(capture_environment.read_text(encoding="utf-8"), "unset\n")

    def test_cpython_runtime_provenance_is_exact_canonical_upstream_asset(self):
        self.assertEqual(
            service.CPYTHON_RUNTIME_PROVENANCE,
            {
                "source_repository": "astral-sh/python-build-standalone",
                "release_tag": "20260602",
                "asset_id": 436826623,
                "asset_name": "cpython-3.11.15+20260602-aarch64-apple-darwin-install_only.tar.gz",
                "release_url": "https://github.com/astral-sh/python-build-standalone/releases/download/20260602/cpython-3.11.15+20260602-aarch64-apple-darwin-install_only.tar.gz",
                "verification_status": "external-sha256-bound",
                "attestation_identity": "operator-supplied-sha256",
                "attestation_status": "bound-no-signature",
            },
        )
        self.assertEqual(
            service.CPYTHON_RUNTIME_ARCHIVE_SHA256,
            "01f0de017aacd7528084dbacd46c66cfe9a0b0cd1255be0c24854b7985dd130e",
        )

    def test_plan_rejects_broker_probe_that_differs_from_reviewed_source_asset(self):
        attestation, manifest, _runtime_root = self.shared_runtime()
        trusted_publisher = self.source / "trusted_publisher.py"
        trusted_publisher.write_text("# changed reviewed publisher source\n", encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "publisher probe.*reviewed source"):
            service.build_service_plan(
                source_root=self.source,
                install_root=self.install_root,
                publisher_home=self.publisher_home,
                broker_client_config=self.client_config,
                launchd_plist_path=self.plist,
                python_executable=self.python,
                broker_runtime_attestation_path=attestation,
                runtime_manifest_path=manifest,
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
        attestation, manifest, _runtime_root = self.shared_runtime()
        with self.assertRaisesRegex(ValueError, "distinct"):
            service.build_service_plan(
                source_root=self.source,
                install_root=self.install_root,
                publisher_home=self.publisher_home,
                broker_client_config=self.client_config,
                launchd_plist_path=self.plist,
                python_executable=self.python,
                broker_runtime_attestation_path=attestation,
                runtime_manifest_path=manifest,
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
            service, "_verify_publisher_runtime_canary", return_value={"contract": "radulator.publisher_runtime_preflight.v1"}
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
                "revoked",
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
                "publisher_runtime_preflight",
                "broker_runtime_attestation_path",
                "broker_runtime_attestation_sha256",
                "runtime_root",
                "runtime_manifest_path",
                "runtime_manifest_sha256",
                "python_executable",
                "python_version",
                "python_sha256",
                "service_config_sha256",
                "hermes_pyproject_lock_sha256",
                "hermes_provenance_sha256",
                "hermes_source_sha",
                "hermes_install_archive_sha256",
                "radulator_source_sha",
                "runtime_provenance",
                "publisher_probe_path",
                "publisher_probe_sha256",
                "publisher_probe_contract",
                "publisher_probe_status",
                "archive_digests",
                "isolated_probe",
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
        ), mock.patch.object(
            service, "_verify_publisher_runtime_canary", return_value={"contract": "radulator.publisher_runtime_preflight.v1"}
        ), mock.patch.object(service, "_verify_provisioned_assets"), mock.patch.object(
            service, "_verify_broker_client", return_value="b" * 64
        ), mock.patch.object(service, "_verify_private_repository"), mock.patch.object(
            service, "_verify_publisher_credential_isolation"
        ), mock.patch.object(
            service, "_verify_publisher_runtime_canary", return_value={"contract": "radulator.publisher_runtime_preflight.v1"}
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
        ), mock.patch.object(
            service, "_verify_publisher_runtime_canary", return_value={"contract": "radulator.publisher_runtime_preflight.v1"}
        ), mock.patch.object(service, "_verify_provisioned_assets"), mock.patch.object(
            service, "_verify_broker_client", return_value="b" * 64
        ), mock.patch.object(service, "_verify_private_repository"), mock.patch.object(
            service, "_verify_publisher_credential_isolation"
        ), mock.patch.object(
            service, "_verify_publisher_runtime_canary", return_value={"contract": "radulator.publisher_runtime_preflight.v1"}
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

        def verify_assets(_plan, **_kwargs):
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
            service, "_verify_publisher_runtime_canary", return_value={"contract": "radulator.publisher_runtime_preflight.v1"}
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
                ), mock.patch.object(
                    service, "_verify_publisher_runtime_canary", return_value={"contract": "radulator.publisher_runtime_preflight.v1"}
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
        ), mock.patch.object(
            service, "_verify_publisher_runtime_canary", return_value={"contract": "radulator.publisher_runtime_preflight.v1"}
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
        ), mock.patch.object(
            service, "_verify_publisher_runtime_canary", return_value={"contract": "radulator.publisher_runtime_preflight.v1"}
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
            service, "_verify_publisher_runtime_canary", return_value={"contract": "radulator.publisher_runtime_preflight.v1"}
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
