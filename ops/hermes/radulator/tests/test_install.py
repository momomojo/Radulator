import base64
import json
import stat
import subprocess
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock

import ops.hermes.radulator.install as install_module
from ops.hermes.radulator.install import (
    InstallError,
    apply_install,
    build_plan,
    generate_keys,
    read_github_public_keys,
    restore_install,
)


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        self.repo = Path(__file__).resolve().parents[4]
        self.radulator_home = root / "profiles" / "radulator"
        self.default_home = root / "default"
        for home in (self.radulator_home, self.default_home):
            home.mkdir(parents=True)
            (home / "config.yaml").write_text(
                "model: openai-codex/gpt-5.6-sol\nagent:\n  reasoning_effort: xhigh\ncron:\n  max_parallel_jobs: 1\n"
            )
            (home / "cron").mkdir()
        self.original_radulator_jobs = (
            b'{"jobs":['
            b'{"id":"existing","name":"keep-me","enabled":true},'
            b'{"id":"legacy-poller","name":"pr-gate-poller","enabled":true,"state":"scheduled"}'
            b']}\n'
        )
        self.original_default_jobs = (
            b'[{"id":"legacy-judge","name":"judge-queue","enabled":true,"state":"scheduled"}]\n'
        )
        (self.radulator_home / "cron" / "jobs.json").write_bytes(self.original_radulator_jobs)
        (self.default_home / "cron" / "jobs.json").write_bytes(self.original_default_jobs)
        self.activation_commands = []

    def passing_activation_runner(self, command, **_kwargs):
        self.activation_commands.append(command)
        return subprocess.CompletedProcess(command, 0, "passed", "")

    def tearDown(self):
        self.temp.cleanup()

    def kwargs(self):
        return {
            "repo": self.repo,
            "radulator_home": self.radulator_home,
            "default_home": self.default_home,
        }

    def test_timestamp_generation_uses_python39_compatible_timezone_api(self):
        sentinel = object()
        rendered = types.SimpleNamespace(
            isoformat=lambda **_kwargs: "2026-08-23T22:00:00+00:00",
        )
        fake_datetime = types.SimpleNamespace(
            datetime=types.SimpleNamespace(now=lambda timezone: rendered if timezone is sentinel else None),
            timezone=types.SimpleNamespace(utc=sentinel),
        )
        with mock.patch.object(install_module, "dt", fake_datetime):
            self.assertEqual(install_module._now(), "2026-08-23T22:00:00Z")

    def test_repository_lint_ignores_managed_worktree_storage(self):
        eslint_config = (self.repo / "eslint.config.js").read_text()
        self.assertRegex(eslint_config, r"globalIgnores\([^\n]*['\"]\.worktrees(?:/\*\*)?['\"]")

    def test_profiles_require_single_flight_cron(self):
        (self.radulator_home / "config.yaml").write_text(
            "model: openai-codex/gpt-5.6-sol\nagent:\n  reasoning_effort: xhigh\ncron:\n  max_parallel_jobs: 2\n"
        )
        with self.assertRaisesRegex(InstallError, "single-flight"):
            build_plan(**self.kwargs())

    def test_profile_accepts_valid_quoted_xhigh_scalar(self):
        for quoted in ('"xhigh"', "'xhigh'"):
            (self.radulator_home / "config.yaml").write_text(
                f"model: openai-codex/gpt-5.6-sol\nagent:\n  reasoning_effort: {quoted}\ncron:\n  max_parallel_jobs: 1\n"
            )
            self.assertEqual(len(build_plan(**self.kwargs())["jobs"]), 8)

    def test_single_flight_setting_must_be_in_top_level_cron_mapping(self):
        (self.radulator_home / "config.yaml").write_text(
            "model: openai-codex/gpt-5.6-sol\nagent:\n  reasoning_effort: xhigh\nnot_cron:\n  max_parallel_jobs: 1\n"
        )
        with self.assertRaisesRegex(InstallError, "cron.max_parallel_jobs"):
            build_plan(**self.kwargs())

    def test_duplicate_cron_or_parallel_keys_are_rejected(self):
        for text in (
            "agent:\n  reasoning_effort: xhigh\ncron:\n  max_parallel_jobs: 1\ncron:\n  max_parallel_jobs: 1\n",
            "agent:\n  reasoning_effort: xhigh\ncron:\n  max_parallel_jobs: 1\n  max_parallel_jobs: 1\n",
        ):
            (self.radulator_home / "config.yaml").write_text(text)
            with self.assertRaisesRegex(InstallError, "ambiguous"):
                build_plan(**self.kwargs())

    def test_dry_plan_is_read_only_and_uses_profile_level_xhigh(self):
        plan = build_plan(**self.kwargs())
        self.assertEqual(plan["schema"], "radulator-hermes-install/v1")
        self.assertEqual(plan["github_repository"], "momomojo/Radulator")
        self.assertEqual(len(plan["jobs"]), 8)
        self.assertFalse((self.radulator_home / "state" / "radulator-release-control.json").exists())
        agent_jobs = [job for job in plan["jobs"] if not job.get("no_agent")]
        for job in agent_jobs:
            self.assertEqual(job["model"], "gpt-5.6-sol")
            self.assertEqual(job["provider"], "openai-codex")
            self.assertNotIn("effort", job)
            self.assertNotIn("reasoning_effort", job)
            self.assertFalse(job["enabled"])
        repository_agent_jobs = [job for job in agent_jobs if job["name"] != "radulator-seed-convert"]
        self.assertTrue(all(job["workdir"] == str(self.repo) for job in repository_agent_jobs))
        feedback = next(job for job in plan["jobs"] if job["name"] == "radulator-formspree-feedback-intake")
        self.assertTrue(feedback["no_agent"])
        self.assertEqual(feedback["script"], "radulator_formspree_feedback_intake.py")
        self.assertIsNone(feedback["model"])
        self.assertIsNone(feedback["workdir"])
        self.assertFalse(feedback["enabled"])
        promoter = next(job for job in plan["jobs"] if job["name"] == "radulator-release-promoter")
        self.assertEqual(promoter["id"], "f191f946d6fa")
        self.assertTrue(promoter["no_agent"])
        self.assertEqual(promoter["script"], "release_promoter_cron.sh")
        self.assertEqual(promoter["schedule"]["expr"], "*/10 * * * *")
        self.assertIsNone(promoter["model"])
        self.assertFalse(promoter["enabled"])
        publisher_job = next(job for job in plan["jobs"] if job["name"] == "radulator-trusted-publisher")
        self.assertEqual(publisher_job["id"], "1def08dbcb74")
        self.assertTrue(publisher_job["no_agent"])
        self.assertEqual(publisher_job["script"], "trusted_publisher_cron.sh")
        self.assertEqual(publisher_job["schedule"]["expr"], "4-59/5 * * * *")
        self.assertEqual(publisher_job["prompt"], "")
        self.assertIsNone(publisher_job["model"])
        self.assertIsNone(publisher_job["provider"])
        self.assertFalse(publisher_job["enabled"])
        seed_convert = next(job for job in plan["jobs"] if job["name"] == "radulator-seed-convert")
        self.assertEqual(seed_convert["id"], "c41b8448cce4")
        self.assertFalse(seed_convert["no_agent"])
        self.assertEqual(seed_convert["script"], "seed_convert_gate_dedupe.py")
        self.assertEqual(seed_convert["skills"], ["radulator-operations"])
        self.assertEqual(seed_convert["schedule"]["expr"], "0 9 * * *")
        self.assertIn("always convert-eligible", seed_convert["prompt"])
        self.assertIn("medical-review-pending", seed_convert["prompt"])
        self.assertIn("Process at most 2 oldest first", seed_convert["prompt"])
        self.assertIn("authoritative readback", seed_convert["prompt"])
        self.assertIn("NEEDS_FIX is not a terminal hold", seed_convert["prompt"])
        self.assertEqual(seed_convert["model"], "gpt-5.6-sol")
        self.assertEqual(seed_convert["provider"], "openai-codex")
        self.assertFalse(seed_convert["enabled"])
        judge_jobs = [job for job in plan["jobs"] if job["name"].startswith("radulator-clinical-judge-")]
        self.assertTrue(all("--public-keys-file" in job["prompt"] for job in judge_jobs))
        self.assertTrue(all("--limit 1" in job["prompt"] for job in judge_jobs))
        self.assertTrue(all("Invoke that collector exactly once" in job["prompt"] for job in judge_jobs))
        self.assertTrue(all("If it returns zero candidates, stop immediately" in job["prompt"] for job in judge_jobs))
        self.assertTrue(all("never invoke the collector again" in job["prompt"] for job in judge_jobs))
        self.assertTrue(all("sign --candidate <cachedPaths[0]> --decision <decision-json-path>" in job["prompt"] for job in judge_jobs))
        self.assertTrue(all("post --repo momomojo/Radulator --attestation <attestation-json-path>" in job["prompt"] for job in judge_jobs))

        lifecycle = next(job for job in plan["jobs"] if job["name"] == "radulator-release-lifecycle")
        learning = next(job for job in plan["jobs"] if job["name"] == "radulator-release-learning")
        for job in (lifecycle, learning):
            self.assertIn("lifecycle_controller.py next", job["prompt"])
            self.assertIn("--cursor-state", job["prompt"])
            self.assertIn("Invoke that collector exactly once", job["prompt"])
            self.assertIn("If it returns count 0, stop immediately", job["prompt"])
            self.assertIn("Process only its single returned tracker", job["prompt"])
        self.assertNotIn("--state smoke_passed", lifecycle["prompt"])
        self.assertIn("--state smoke_passed", learning["prompt"])
        self.assertIn("retain_learning.py", learning["prompt"])
        self.assertIn("--task-id <candidate.task_id>", learning["prompt"])
        self.assertIn("--config", learning["prompt"])
        self.assertIn("do not call hindsight_retain", learning["prompt"].lower())

        learning_skill = (
            self.repo / "ops/hermes/radulator/skills/radulator-release-learning/SKILL.md"
        ).read_text()
        self.assertIn("retain_learning.py", learning_skill)
        self.assertIn("kanban_closure", learning_skill)
        self.assertNotIn("Call `hindsight_retain`", learning_skill)

    def test_plan_can_pin_a_truthful_self_hosted_inference_identity(self):
        plan = build_plan(
            **self.kwargs(),
            agent_model="mtplx-qwen38-27b-optimized-quality",
            agent_provider="mtplx-qwen38",
        )

        agent_jobs = [job for job in plan["jobs"] if not job.get("no_agent")]
        self.assertTrue(agent_jobs)
        self.assertTrue(all(job["model"] == "mtplx-qwen38-27b-optimized-quality" for job in agent_jobs))
        self.assertTrue(all(job["provider"] == "mtplx-qwen38" for job in agent_jobs))
        judges = [job for job in agent_jobs if job["name"].startswith("radulator-clinical-judge-")]
        self.assertTrue(all("--model mtplx-qwen38-27b-optimized-quality" in job["prompt"] for job in judges))
        self.assertTrue(all("--provider mtplx-qwen38" in job["prompt"] for job in judges))
        self.assertEqual(plan["inference"], {
            "model": "mtplx-qwen38-27b-optimized-quality",
            "provider": "mtplx-qwen38",
        })

        result = apply_install(
            **self.kwargs(),
            agent_model="mtplx-qwen38-27b-optimized-quality",
            agent_provider="mtplx-qwen38",
        )
        manifest = json.loads(Path(result["manifest_path"]).read_text())
        self.assertEqual(manifest["inference"], plan["inference"])
        radulator_jobs = json.loads((self.radulator_home / "cron" / "jobs.json").read_text())["jobs"]
        default_jobs = json.loads((self.default_home / "cron" / "jobs.json").read_text())
        managed = [job for job in [*radulator_jobs, *default_jobs] if job.get("id") in result["job_ids"].values()]
        managed_agents = [job for job in managed if not job.get("no_agent")]
        self.assertTrue(all(job["model"] == plan["inference"]["model"] for job in managed_agents))
        self.assertTrue(all(job["provider"] == plan["inference"]["provider"] for job in managed_agents))

    def test_inference_identity_rejects_blank_or_prompt_injection_values(self):
        invalid = (
            {"agent_model": ""},
            {"agent_provider": ""},
            {"agent_model": "safe-model\n--private-key /tmp/attacker"},
            {"agent_provider": "provider with spaces"},
        )
        for override in invalid:
            with self.subTest(override=override), self.assertRaisesRegex(InstallError, "inference"):
                build_plan(**self.kwargs(), **override)

    def test_judge_skill_prescribes_complete_sign_and_post_commands(self):
        skill = (self.repo / "ops/hermes/radulator/skills/radulator-clinical-judge/SKILL.md").read_text()
        self.assertIn("reviewEvidence", skill)
        self.assertIn("base64", skill)
        self.assertIn("is not missing evidence", skill)
        self.assertIn("cachedPaths[0]", skill)
        self.assertIn("judge-attest.mjs sign", skill)
        for argument in (
            "--candidate <cachedPaths[0]>", "--decision <decision-json-path>", "--private-key",
            "--key-id", "--role", "--profile", "--model", "--provider", "--output <attestation-json-path>",
        ):
            self.assertIn(argument, skill)
        self.assertIn("judge-attest.mjs post", skill)
        self.assertIn("--repo momomojo/Radulator", skill)
        self.assertIn("--attestation <attestation-json-path>", skill)
        self.assertIn("--public-keys-file", skill)

    def test_e2e_workflow_publishes_authoritative_hermes_release_control_check(self):
        workflow = (self.repo / ".github/workflows/e2e-tests.yml").read_text()
        smoke_job = workflow[:workflow.index("hermes-release-control-tests:")]
        self.assertIn("name: Verify Hermes release-control suites in Smoke evidence", smoke_job)
        for command in (
            "npm run test:hermes-lifecycle",
            "npm run test:hermes-learning",
            "npm run test:hermes-feedback-intake",
            "npm run test:hermes-seed-convert",
            "npm run test:hermes-guideline-registry",
            "npm run test:hermes-install",
        ):
            self.assertIn(command, smoke_job)
        self.assertIn("hermes-release-control-tests:", workflow)
        self.assertIn("name: Hermes Release Control Tests", workflow)
        for command in (
            "npm audit --omit=dev --audit-level=high",
            "npm run test:reconcile-deployment",
            "npm run test:hermes-judge-candidates",
            "npm run test:hermes-judge-attest",
            "npm run test:hermes-lifecycle",
            "npm run test:hermes-learning",
            "npm run test:hermes-feedback-intake",
            "npm run test:hermes-seed-convert",
            "npm run test:hermes-guideline-registry",
            "npm run test:hermes-install",
        ):
            self.assertIn(command, workflow[workflow.index("hermes-release-control-tests:"):])

    def test_apply_is_disabled_first_idempotent_and_separates_keys(self):
        first = apply_install(**self.kwargs())
        manifest_path = Path(first["manifest_path"])
        self.assertTrue(manifest_path.exists())
        manifest = json.loads(manifest_path.read_text())
        self.assertNotEqual(manifest["keys"]["primary_private"], manifest["keys"]["verification_private"])
        self.assertTrue(manifest["keys"]["primary_private"].startswith(str(self.radulator_home.resolve())))
        self.assertTrue(manifest["keys"]["verification_private"].startswith(str(self.default_home.resolve())))

        radulator_jobs = json.loads((self.radulator_home / "cron" / "jobs.json").read_text())["jobs"]
        default_jobs = json.loads((self.default_home / "cron" / "jobs.json").read_text())
        managed = [job for job in [*radulator_jobs, *default_jobs] if job.get("id") in first["job_ids"].values()]
        self.assertEqual(len(managed), 8)
        self.assertTrue(all(job["enabled"] is False for job in managed))
        legacy = [job for job in [*radulator_jobs, *default_jobs] if job["name"] in {"pr-gate-poller", "judge-queue"}]
        self.assertEqual(len(legacy), 2)
        self.assertTrue(all(job["enabled"] is True for job in legacy))
        self.assertEqual(len({job["id"] for job in managed}), 8)
        self.assertTrue((self.radulator_home / "skills" / "radulator-clinical-judge" / "SKILL.md").exists())
        self.assertTrue((self.default_home / "skills" / "radulator-clinical-judge" / "SKILL.md").exists())
        feedback_script = self.radulator_home / "scripts" / "radulator_formspree_feedback_intake.py"
        self.assertTrue(feedback_script.exists())
        self.assertEqual(stat.S_IMODE(feedback_script.stat().st_mode), 0o700)
        seed_script = self.radulator_home / "scripts" / "seed_convert_gate_dedupe.py"
        self.assertTrue(seed_script.exists())
        self.assertEqual(stat.S_IMODE(seed_script.stat().st_mode), 0o700)
        promoter_script = self.radulator_home / "scripts" / "release_promoter.py"
        promoter_wrapper = self.radulator_home / "scripts" / "release_promoter_cron.sh"
        self.assertEqual(promoter_script.read_bytes(), (
            self.repo / "ops/hermes/radulator/release_promoter.py"
        ).read_bytes())
        self.assertEqual(promoter_wrapper.read_bytes(), (
            self.repo / "ops/hermes/radulator/release_promoter_cron.sh"
        ).read_bytes())
        self.assertEqual(stat.S_IMODE(promoter_script.stat().st_mode), 0o700)
        self.assertEqual(stat.S_IMODE(promoter_wrapper.stat().st_mode), 0o700)
        publisher_script = self.radulator_home / "scripts" / "trusted_publisher.py"
        publisher_wrapper = self.radulator_home / "scripts" / "trusted_publisher_cron.sh"
        self.assertEqual(publisher_script.read_bytes(), (
            self.repo / "ops/hermes/radulator/trusted_publisher.py"
        ).read_bytes())
        self.assertEqual(publisher_wrapper.read_bytes(), (
            self.repo / "ops/hermes/radulator/trusted_publisher_cron.sh"
        ).read_bytes())
        self.assertEqual(stat.S_IMODE(publisher_script.stat().st_mode), 0o700)
        self.assertEqual(stat.S_IMODE(publisher_wrapper.stat().st_mode), 0o700)

        before = {
            "rad": (self.radulator_home / "cron" / "jobs.json").read_bytes(),
            "default": (self.default_home / "cron" / "jobs.json").read_bytes(),
            "manifest": manifest_path.read_bytes(),
        }
        second = apply_install(**self.kwargs())
        self.assertEqual(first["job_ids"], second["job_ids"])
        self.assertEqual(before["rad"], (self.radulator_home / "cron" / "jobs.json").read_bytes())
        self.assertEqual(before["default"], (self.default_home / "cron" / "jobs.json").read_bytes())
        self.assertEqual(before["manifest"], manifest_path.read_bytes())

    def test_apply_and_restore_manage_the_operations_guideline_registry(self):
        apply_install(**self.kwargs())
        source_root = self.repo / "ops/hermes/radulator/skills/radulator-operations/references"
        destination_root = self.radulator_home / "skills/domain/radulator-operations/references"

        for filename in ("guideline-versions.json", "guideline-versions.md"):
            source = source_root / filename
            destination = destination_root / filename
            self.assertEqual(destination.read_bytes(), source.read_bytes())
            self.assertEqual(stat.S_IMODE(destination.stat().st_mode), 0o644)

        restore_install(self.radulator_home)

        for filename in ("guideline-versions.json", "guideline-versions.md"):
            self.assertFalse((destination_root / filename).exists())

    def test_upgrade_preserves_existing_seed_delivery_destination(self):
        jobs_path = self.radulator_home / "cron" / "jobs.json"
        payload = json.loads(jobs_path.read_text())
        payload["jobs"].append({
            "id": "c41b8448cce4",
            "name": "radulator-seed-convert",
            "enabled": True,
            "deliver": "telegram:existing-owner",
        })
        jobs_path.write_text(json.dumps(payload) + "\n")

        apply_install(**self.kwargs())

        jobs = json.loads(jobs_path.read_text())["jobs"]
        seed_job = next(job for job in jobs if job["name"] == "radulator-seed-convert")
        self.assertEqual(seed_job["id"], "c41b8448cce4")
        self.assertTrue(seed_job["enabled"])
        self.assertEqual(seed_job["deliver"], "telegram:existing-owner")
        self.assertEqual(seed_job["script"], "seed_convert_gate_dedupe.py")

    def test_upgrade_preserves_existing_promoter_identity_state_and_delivery(self):
        jobs_path = self.radulator_home / "cron" / "jobs.json"
        payload = json.loads(jobs_path.read_text())
        payload["jobs"].append({
            "id": "f191f946d6fa",
            "name": "radulator-release-promoter",
            "enabled": True,
            "state": "scheduled",
            "deliver": "telegram",
            "script": "legacy_release_promoter.sh",
            "schedule": {"kind": "cron", "expr": "0 0 * * *", "display": "0 0 * * *"},
        })
        jobs_path.write_text(json.dumps(payload) + "\n")

        result = apply_install(**self.kwargs())

        jobs = json.loads(jobs_path.read_text())["jobs"]
        promoter = next(job for job in jobs if job["name"] == "radulator-release-promoter")
        self.assertEqual(result["job_ids"]["radulator-release-promoter"], "f191f946d6fa")
        self.assertEqual(promoter["id"], "f191f946d6fa")
        self.assertTrue(promoter["enabled"])
        self.assertEqual(promoter["state"], "scheduled")
        self.assertEqual(promoter["deliver"], "telegram")
        self.assertEqual(promoter["script"], "release_promoter_cron.sh")
        self.assertEqual(promoter["schedule"]["expr"], "*/10 * * * *")

    def test_upgrade_extends_existing_backup_for_new_managed_script(self):
        backup_path = self.radulator_home / "state" / "radulator-release-backup.json"
        backup_path.parent.mkdir(parents=True)
        radulator_jobs_path = self.radulator_home / "cron" / "jobs.json"
        backup_path.write_text(json.dumps({
            "schema": "radulator-hermes-backup/v1",
            "entries": [{
                "path": str(radulator_jobs_path),
                "existed": True,
                "mode": stat.S_IMODE(radulator_jobs_path.stat().st_mode),
                "content_base64": base64.b64encode(radulator_jobs_path.read_bytes()).decode("ascii"),
            }],
        }))

        apply_install(**self.kwargs())

        feedback_script = self.radulator_home / "scripts" / "radulator_formspree_feedback_intake.py"
        backup = json.loads(backup_path.read_text())
        recorded = {entry["path"]: entry for entry in backup["entries"]}
        feedback_script_key = str(feedback_script.resolve())
        self.assertIn(feedback_script_key, recorded)
        self.assertFalse(recorded[feedback_script_key]["existed"])
        self.assertTrue(feedback_script.exists())

        restore_install(self.radulator_home)
        self.assertFalse(feedback_script.exists())

    def test_enable_then_restore_recovers_original_files(self):
        result = apply_install(**self.kwargs())
        public_keys = generate_keys(build_plan(**self.kwargs()))
        apply_install(
            **self.kwargs(), enable=True, expected_public_keys=public_keys,
            activation_test_runner=self.passing_activation_runner,
        )
        for path in (self.radulator_home / "cron" / "jobs.json", self.default_home / "cron" / "jobs.json"):
            payload = json.loads(path.read_text())
            jobs = payload["jobs"] if isinstance(payload, dict) else payload
            managed = [job for job in jobs if job["id"] in result["job_ids"].values()]
            self.assertTrue(all(job["enabled"] is True for job in managed))
            legacy = [job for job in jobs if job["name"] in {"pr-gate-poller", "judge-queue"}]
            self.assertTrue(all(job["enabled"] is False for job in legacy))
            self.assertTrue(all(job["state"] == "paused" for job in legacy))
            self.assertTrue(all(job["paused_reason"] == "replaced-by-radulator-signed-clinical-gate" for job in legacy))

        enabled_bytes = {
            path: path.read_bytes()
            for path in (self.radulator_home / "cron" / "jobs.json", self.default_home / "cron" / "jobs.json")
        }
        apply_install(
            **self.kwargs(), enable=True, expected_public_keys=public_keys,
            activation_test_runner=self.passing_activation_runner,
        )
        self.assertTrue(all(path.read_bytes() == content for path, content in enabled_bytes.items()))

        apply_install(**self.kwargs(), disable=True)
        for path in (self.radulator_home / "cron" / "jobs.json", self.default_home / "cron" / "jobs.json"):
            payload = json.loads(path.read_text())
            jobs = payload["jobs"] if isinstance(payload, dict) else payload
            managed = [job for job in jobs if job["id"] in result["job_ids"].values()]
            self.assertTrue(all(job["enabled"] is False for job in managed))

        restore_install(self.radulator_home)
        self.assertEqual((self.radulator_home / "cron" / "jobs.json").read_bytes(), self.original_radulator_jobs)
        self.assertEqual((self.default_home / "cron" / "jobs.json").read_bytes(), self.original_default_jobs)
        self.assertFalse((self.radulator_home / "skills" / "radulator-release-learning" / "SKILL.md").exists())
        self.assertFalse((self.radulator_home / "scripts" / "radulator_formspree_feedback_intake.py").exists())
        self.assertFalse((self.radulator_home / "scripts" / "release_promoter.py").exists())
        self.assertFalse((self.radulator_home / "scripts" / "release_promoter_cron.sh").exists())
        self.assertFalse((self.radulator_home / "scripts" / "trusted_publisher.py").exists())
        self.assertFalse((self.radulator_home / "scripts" / "trusted_publisher_cron.sh").exists())

    def test_enable_requires_exact_installed_broker_contract(self):
        plan = build_plan(**self.kwargs())
        apply_install(**self.kwargs())
        public_keys = generate_keys(plan)

        def runner(command, **_kwargs):
            if any("kanban_git_broker" in str(part) for part in command):
                return subprocess.CompletedProcess(command, 1, "", "missing contract")
            return subprocess.CompletedProcess(command, 0, "passed", "")

        with self.assertRaisesRegex(InstallError, "trusted local commit broker"):
            apply_install(
                **self.kwargs(),
                enable=True,
                expected_public_keys=public_keys,
                activation_test_runner=runner,
            )

    def test_enable_refuses_missing_local_judge_trust_configuration(self):
        apply_install(**self.kwargs())
        with self.assertRaisesRegex(InstallError, "public-key|trust|key pair"):
            apply_install(**self.kwargs(), enable=True)

    def test_enable_refuses_mismatched_private_and_public_key_pair(self):
        plan = build_plan(**self.kwargs())
        apply_install(**self.kwargs())
        public_keys = generate_keys(plan)
        verification_private = Path(plan["keys"]["verification_private"])
        verification_private.write_bytes(Path(plan["keys"]["primary_private"]).read_bytes())
        verification_private.chmod(0o600)
        with self.assertRaisesRegex(InstallError, "do not match"):
            apply_install(
                **self.kwargs(), enable=True, expected_public_keys=public_keys,
                activation_test_runner=self.passing_activation_runner,
            )

    def test_enable_refuses_same_signing_key_for_both_roles(self):
        plan = build_plan(**self.kwargs())
        apply_install(**self.kwargs())
        public_keys = generate_keys(plan)
        primary_private = Path(plan["keys"]["primary_private"])
        primary_public = Path(plan["keys"]["primary_public"])
        verification_private = Path(plan["keys"]["verification_private"])
        verification_public = Path(plan["keys"]["verification_public"])
        verification_private.write_bytes(primary_private.read_bytes())
        verification_private.chmod(0o600)
        verification_public.write_bytes(primary_public.read_bytes())
        public_keys["radulator-verification-v1"]["publicKey"] = primary_public.read_text()
        serialized = json.dumps(public_keys, sort_keys=True, separators=(",", ":")) + "\n"
        for config_name in ("primary_public_keys_config", "verification_public_keys_config"):
            Path(plan["keys"][config_name]).write_text(serialized)

        with self.assertRaisesRegex(InstallError, "distinct signing keys"):
            apply_install(
                **self.kwargs(), enable=True, expected_public_keys=public_keys,
                activation_test_runner=self.passing_activation_runner,
            )

    def test_enable_requires_exact_github_public_key_mapping(self):
        plan = build_plan(**self.kwargs())
        apply_install(**self.kwargs())
        public_keys = generate_keys(plan)
        with self.assertRaisesRegex(InstallError, "GitHub public-key"):
            apply_install(**self.kwargs(), enable=True)
        mismatched = json.loads(json.dumps(public_keys))
        mismatched["radulator-primary-v1"]["profile"] = "wrong"
        with self.assertRaisesRegex(InstallError, "GitHub public-key"):
            apply_install(
                **self.kwargs(), enable=True, expected_public_keys=mismatched,
                activation_test_runner=self.passing_activation_runner,
            )

    def test_enable_refuses_any_failed_repository_self_test(self):
        plan = build_plan(**self.kwargs())
        apply_install(**self.kwargs())
        public_keys = generate_keys(plan)

        def failing_runner(command, **_kwargs):
            if any("kanban_git_broker" in str(part) for part in command):
                return subprocess.CompletedProcess(command, 0, "", "")
            return subprocess.CompletedProcess(command, 1, "", "synthetic failure")

        before_radulator = (self.radulator_home / "cron" / "jobs.json").read_bytes()
        before_default = (self.default_home / "cron" / "jobs.json").read_bytes()
        with self.assertRaisesRegex(InstallError, "activation self-test failed"):
            apply_install(
                **self.kwargs(), enable=True, expected_public_keys=public_keys,
                activation_test_runner=failing_runner,
            )
        self.assertEqual(before_radulator, (self.radulator_home / "cron" / "jobs.json").read_bytes())
        self.assertEqual(before_default, (self.default_home / "cron" / "jobs.json").read_bytes())

    def test_refuses_non_xhigh_or_non_absolute_inputs(self):
        (self.default_home / "config.yaml").write_text("agent:\n  reasoning_effort: high\n")
        with self.assertRaisesRegex(InstallError, "xhigh"):
            build_plan(**self.kwargs())
        with self.assertRaisesRegex(InstallError, "absolute"):
            build_plan(repo=Path("relative"), radulator_home=self.radulator_home, default_home=self.default_home)

    def test_key_hook_returns_repository_ready_public_mapping_only(self):
        plan = build_plan(**self.kwargs())
        public = generate_keys(plan)
        self.assertEqual(set(public), {"radulator-primary-v1", "radulator-verification-v1"})
        self.assertEqual(public["radulator-primary-v1"]["role"], "primary")
        self.assertEqual(public["radulator-verification-v1"]["role"], "verification")
        self.assertNotEqual(public["radulator-primary-v1"]["profile"], public["radulator-verification-v1"]["profile"])
        self.assertTrue(all("PRIVATE" not in json.dumps(value) for value in public.values()))
        self.assertEqual(Path(plan["keys"]["primary_public"]).name, "radulator-primary-v1.public.pem")
        self.assertEqual(Path(plan["keys"]["verification_public"]).name, "radulator-verification-v1.public.pem")
        self.assertTrue(Path(plan["keys"]["primary_public"]).is_file())
        self.assertTrue(Path(plan["keys"]["verification_public"]).is_file())
        primary_config = Path(plan["keys"]["primary_public_keys_config"])
        verification_config = Path(plan["keys"]["verification_public_keys_config"])
        self.assertEqual(json.loads(primary_config.read_text()), public)
        self.assertEqual(primary_config.read_bytes(), verification_config.read_bytes())
        for key in ("primary_private", "verification_private"):
            mode = Path(plan["keys"][key]).stat().st_mode
            self.assertEqual(stat.S_IMODE(mode), 0o600)

    def test_reads_authoritative_github_public_key_variable(self):
        expected = {"radulator-primary-v1": {"role": "primary", "profile": "radulator", "publicKey": "pem"}}

        def runner(command, **_kwargs):
            self.assertEqual(command, [
                "gh", "variable", "get", "RADULATOR_JUDGE_PUBLIC_KEYS_JSON",
                "--repo", "momomojo/Radulator",
            ])
            return subprocess.CompletedProcess(command, 0, json.dumps(expected), "")

        self.assertEqual(read_github_public_keys("momomojo/Radulator", runner=runner), expected)

        with self.assertRaisesRegex(InstallError, "bound to momomojo/Radulator"):
            read_github_public_keys("someone-else/Radulator", runner=runner)


if __name__ == "__main__":
    unittest.main()
