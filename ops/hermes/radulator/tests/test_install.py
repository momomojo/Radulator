import base64
import fcntl
import hashlib
import hmac
import importlib.util
import json
import os
import re
import stat
import subprocess
import sys
import tempfile
import threading
import time
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
        self.default_home = root / ".hermes"
        self.radulator_home = self.default_home / "profiles" / "radulator"
        for home in (self.radulator_home, self.default_home):
            home.mkdir(parents=True, exist_ok=True)
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

    def resign_backup(self, payload):
        unsigned = {"schema": payload["schema"], "entries": payload["entries"]}
        serialized = (json.dumps(unsigned, indent=2, sort_keys=True) + "\n").encode("utf-8")
        key = (self.radulator_home / "state" / "radulator-release-backup.hmac.key").read_bytes()
        payload["hmac_sha256"] = hmac.new(key, serialized, hashlib.sha256).hexdigest()
        return (json.dumps(payload, indent=2, sort_keys=True) + "\n").encode("utf-8")

    def publisher_job(self):
        payload = json.loads((self.radulator_home / "cron" / "jobs.json").read_text())
        jobs = payload["jobs"] if isinstance(payload, dict) else payload
        return next(job for job in jobs if job["name"] == "radulator-trusted-publisher")

    def set_publisher_enabled(self):
        path = self.radulator_home / "cron" / "jobs.json"
        payload = json.loads(path.read_text())
        jobs = payload["jobs"] if isinstance(payload, dict) else payload
        publisher = next(job for job in jobs if job["name"] == "radulator-trusted-publisher")
        publisher.update({"enabled": True, "state": "scheduled", "paused_at": None, "paused_reason": None})
        path.write_text(json.dumps(payload) + "\n")

    @staticmethod
    def write_counterfeit_runtime_modules(root):
        hermes_cli = root / "hermes_cli"
        tools = root / "tools"
        hermes_cli.mkdir(parents=True)
        tools.mkdir(parents=True)
        (hermes_cli / "__init__.py").write_text("")
        (tools / "__init__.py").write_text("")
        (hermes_cli / "kanban_git_broker.py").write_text(
            "PUBLISH_CONTRACT = 'hermes.trusted_local_commit.v1'\n"
        )
        (hermes_cli / "kanban_db.py").write_text(
            "def claim_trusted_publisher_authority(): pass\n"
            "def complete_trusted_publisher_authority(): pass\n"
            "def verify_trusted_publisher_authority_receipt(): pass\n"
            "def run_trusted_publisher_authority_semantic_canary():\n"
            "    return {\n"
            "        'contract': 'hermes.trusted_publisher.authority-semantic-canary.v1',\n"
            "        'claim_exact_identity_bound': True,\n"
            "        'conflicting_claim_rejected': True,\n"
            "        'stale_run_rejected': True,\n"
            "        'stale_tracker_rejected': True,\n"
            "        'completion_atomic': True,\n"
            "        'replay_idempotent': True,\n"
            "        'host_receipt_signature_verified': True,\n"
            "    }\n"
        )
        (tools / "kanban_worker_boundary.py").write_text(
            "WORKER_GIT_SECURITY_BOUNDARY = 'hermes.worker_git_isolation.v1'\n"
            "def run_worker_model_path_denial_canary():\n"
            "    return {\n"
            "        'contract': 'hermes.worker_model_path_denial_canary.v1',\n"
            "        'model_path_attempted': True,\n"
            "        'profile_env_denied': True,\n"
            "        'gh_config_denied': True,\n"
            "        'gh_token_denied': True,\n"
            "        'ssh_config_denied': True,\n"
            "        'ssh_private_keys_denied': True,\n"
            "        'keychain_lookup_denied': True,\n"
            "        'loopback_network_denied': True,\n"
            "        'public_network_denied': True,\n"
            "        'git_metadata_write_denied': True,\n"
            "        'workspace_edit_succeeded': True,\n"
            "        'bounded_test_succeeded': True,\n"
            "    }\n"
        )

    def counterfeit_runtime_plan(self, repo):
        runtime_python = (
            self.default_home / "hermes-agent" / "venv" / "bin" / "python"
        )
        runtime_python.parent.mkdir(parents=True, exist_ok=True)
        runtime_python.symlink_to(Path(sys.executable))
        return {
            "radulator_home": str(self.radulator_home),
            "repo": str(repo),
        }

    def legacy_v1_entries(self, plan, *, extra_target_id=None):
        targets = install_module._backup_targets(plan)
        # This fixture is deliberately independent of the current target set: it
        # represents the exact allowlist emitted by the deployed v1 installer.
        target_ids = [
            "primary:cron/jobs.json",
            "verification:cron/jobs.json",
            "primary:skills/radulator-clinical-judge/SKILL.md",
            "verification:skills/radulator-clinical-judge/SKILL.md",
            "primary:skills/radulator-release-controller/SKILL.md",
            "primary:skills/radulator-release-learning/SKILL.md",
            "primary:skills/domain/radulator-operations/references/guideline-versions.json",
            "primary:skills/domain/radulator-operations/references/guideline-versions.md",
            "primary:scripts/radulator_formspree_feedback_intake.py",
            "primary:scripts/seed_convert_gate_dedupe.py",
            "primary:scripts/release_promoter.py",
            "primary:scripts/release_promoter_cron.sh",
            "primary:state/radulator-release-control.json",
        ]
        if extra_target_id is not None:
            target_ids.append(extra_target_id)
        entries = []
        for target_id in target_ids:
            target = targets[target_id]
            exists = target.exists()
            entries.append({
                "path": str(target),
                "existed": exists,
                "mode": stat.S_IMODE(target.stat().st_mode) if exists else None,
                "content_base64": (
                    base64.b64encode(target.read_bytes()).decode("ascii")
                    if exists
                    else None
                ),
            })
        return entries

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
        wrapper_text = publisher_wrapper.read_text(encoding="utf-8")
        self.assertNotIn("RADULATOR_HERMES_PROJECT_ID", wrapper_text)
        self.assertNotIn("RADULATOR_PROJECT_ROOT", wrapper_text)
        self.assertNotIn('"$@"', wrapper_text)
        self.assertNotIn('source "$PROFILE_DIR/.env"', wrapper_text)
        self.assertIn("unset GH_TOKEN GITHUB_TOKEN", wrapper_text)
        self.assertIn("auth token --hostname github.com", wrapper_text)

        self.assertIn('--board "default"', wrapper_text)
        self.assertIn('--project-root "/Users/agent/Documents/Radulator"', wrapper_text)

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

    def test_plain_apply_quiesces_preexisting_same_name_verification_job_before_asset_copy(self):
        jobs_path = self.default_home / "cron" / "jobs.json"
        jobs = json.loads(jobs_path.read_text())
        jobs.append({
            "id": "operator-verification",
            "name": "radulator-clinical-judge-verification",
            "enabled": True,
            "state": "scheduled",
            "next_run_at": "2026-08-26T12:00:00Z",
        })
        jobs_path.write_text(json.dumps(jobs) + "\n")
        verification_skill = (
            self.default_home / "skills" / "radulator-clinical-judge" / "SKILL.md"
        ).resolve()
        original_atomic_write = install_module._atomic_write
        observed_states = []

        def observe_verification_asset(path, content, mode=0o600):
            if Path(path).resolve() == verification_skill:
                current = json.loads(jobs_path.read_text())
                matched = [
                    job
                    for job in current
                    if job.get("name") == "radulator-clinical-judge-verification"
                ]
                observed_states.append([
                    (job.get("enabled"), job.get("state"), job.get("next_run_at"))
                    for job in matched
                ])
            return original_atomic_write(path, content, mode)

        with mock.patch.object(
            install_module, "_atomic_write", side_effect=observe_verification_asset
        ):
            apply_install(**self.kwargs())

        self.assertEqual(observed_states, [[(False, "paused", None)]])
        matched = [
            job
            for job in json.loads(jobs_path.read_text())
            if job.get("name") == "radulator-clinical-judge-verification"
        ]
        self.assertEqual(len(matched), 1)
        self.assertIs(matched[0]["enabled"], False)
        self.assertEqual(matched[0]["state"], "paused")
        self.assertIsNone(matched[0]["next_run_at"])

    def test_plain_apply_and_restore_quiesce_renamed_publisher_script_consumer_before_asset_copy(self):
        jobs_path = self.radulator_home / "cron" / "jobs.json"
        payload = json.loads(jobs_path.read_text())
        payload["jobs"].append({
            "id": "operator-shadow-publisher",
            "name": "operator-shadow-publisher",
            "script": "trusted_publisher_cron.sh",
            "enabled": True,
            "state": "scheduled",
            "next_run_at": "2026-08-26T12:00:00Z",
        })
        jobs_path.write_text(json.dumps(payload) + "\n")
        publisher_wrapper = (
            self.radulator_home / "scripts" / "trusted_publisher_cron.sh"
        ).resolve()
        original_atomic_write = install_module._atomic_write
        observed_enabled_consumers = []

        def observe_publisher_asset(path, content, mode=0o600):
            if Path(path).resolve() == publisher_wrapper:
                current = json.loads(jobs_path.read_text())["jobs"]
                observed_enabled_consumers.append([
                    job["id"]
                    for job in current
                    if job.get("script") == "trusted_publisher_cron.sh"
                    and job.get("enabled") is not False
                ])
            return original_atomic_write(path, content, mode)

        with mock.patch.object(
            install_module, "_atomic_write", side_effect=observe_publisher_asset
        ):
            apply_install(**self.kwargs())

        self.assertEqual(observed_enabled_consumers, [[]])
        consumers = [
            job
            for job in json.loads(jobs_path.read_text())["jobs"]
            if job.get("script") == "trusted_publisher_cron.sh"
        ]
        self.assertEqual(len(consumers), 1)
        self.assertEqual(consumers[0]["id"], "1def08dbcb74")
        self.assertIs(consumers[0]["enabled"], False)

        restore_install(**self.kwargs())
        restored = [
            job
            for job in json.loads(jobs_path.read_text())["jobs"]
            if job.get("script") == "trusted_publisher_cron.sh"
        ]
        self.assertEqual(len(restored), 1)
        self.assertEqual(restored[0]["id"], "operator-shadow-publisher")
        self.assertIs(restored[0]["enabled"], False)
        self.assertEqual(restored[0]["state"], "paused")
        self.assertIsNone(restored[0]["next_run_at"])

    def test_duplicate_managed_script_consumers_are_quiesced_and_rejected_before_asset_copy(self):
        jobs_path = self.radulator_home / "cron" / "jobs.json"
        payload = json.loads(jobs_path.read_text())
        for suffix in ("one", "two"):
            payload["jobs"].append({
                "id": f"shadow-{suffix}",
                "name": f"shadow-{suffix}",
                "script": "trusted_publisher_cron.sh",
                "enabled": True,
                "state": "scheduled",
                "next_run_at": "2026-08-26T12:00:00Z",
            })
        jobs_path.write_text(json.dumps(payload) + "\n")

        with self.assertRaisesRegex(InstallError, "ambiguous|duplicate"):
            apply_install(**self.kwargs())

        self.assertFalse(
            (self.radulator_home / "scripts" / "trusted_publisher_cron.sh").exists()
        )
        consumers = [
            job
            for job in json.loads(jobs_path.read_text())["jobs"]
            if job.get("script") == "trusted_publisher_cron.sh"
        ]
        self.assertGreaterEqual(len(consumers), 2)
        self.assertTrue(all(job.get("enabled") is False for job in consumers))
        self.assertTrue(all(job.get("state") == "paused" for job in consumers))
        self.assertTrue(all(job.get("next_run_at") is None for job in consumers))

    def test_symlink_alias_consumer_is_quiesced_and_rejected_before_asset_copy(self):
        apply_install(**self.kwargs())
        self.set_publisher_enabled()
        jobs_path = self.radulator_home / "cron" / "jobs.json"
        payload = json.loads(jobs_path.read_text())
        payload["jobs"].append({
            "id": "operator-publisher-alias",
            "name": "operator-publisher-alias",
            "script": "publisher-alias.sh",
            "enabled": True,
            "state": "scheduled",
            "next_run_at": "2026-08-26T12:00:00Z",
        })
        jobs_path.write_text(json.dumps(payload) + "\n")
        scripts = self.radulator_home / "scripts"
        (scripts / "publisher-alias.sh").symlink_to("trusted_publisher_cron.sh")
        publisher_wrapper = scripts / "trusted_publisher_cron.sh"
        drifted = b"#!/bin/sh\nexit 93\n"
        publisher_wrapper.write_bytes(drifted)
        publisher_wrapper.chmod(0o700)

        with self.assertRaisesRegex(InstallError, "ambiguous|duplicate"):
            apply_install(**self.kwargs())

        self.assertEqual(publisher_wrapper.read_bytes(), drifted)
        consumers = [
            job
            for job in json.loads(jobs_path.read_text())["jobs"]
            if job.get("id") in {"1def08dbcb74", "operator-publisher-alias"}
        ]
        self.assertEqual(len(consumers), 2)
        self.assertTrue(all(job.get("enabled") is False for job in consumers))
        self.assertTrue(all(job.get("state") == "paused" for job in consumers))
        self.assertTrue(all(job.get("next_run_at") is None for job in consumers))

    def test_external_hardlink_alias_is_quiesced_and_rejected_before_asset_copy(self):
        apply_install(**self.kwargs())
        self.set_publisher_enabled()
        jobs_path = self.radulator_home / "cron" / "jobs.json"
        payload = json.loads(jobs_path.read_text())
        scripts = self.radulator_home / "scripts"
        publisher_wrapper = scripts / "trusted_publisher_cron.sh"
        drifted = b"#!/bin/sh\nexit 94\n"
        publisher_wrapper.write_bytes(drifted)
        publisher_wrapper.chmod(0o700)
        external_alias = self.default_home / "external-publisher-alias.sh"
        os.link(publisher_wrapper, external_alias)
        payload["jobs"].append({
            "id": "external-hardlink-publisher",
            "name": "external-hardlink-publisher",
            "script": str(external_alias),
            "enabled": True,
            "state": "scheduled",
            "next_run_at": "2026-08-26T12:00:00Z",
        })
        jobs_path.write_text(json.dumps(payload) + "\n")

        with self.assertRaisesRegex(InstallError, "ambiguous|duplicate"):
            apply_install(**self.kwargs())

        self.assertEqual(publisher_wrapper.read_bytes(), drifted)
        consumers = [
            job
            for job in json.loads(jobs_path.read_text())["jobs"]
            if job.get("id") in {"1def08dbcb74", "external-hardlink-publisher"}
        ]
        self.assertEqual(len(consumers), 2)
        self.assertTrue(all(job.get("enabled") is False for job in consumers))
        self.assertTrue(all(job.get("state") == "paused" for job in consumers))
        self.assertTrue(all(job.get("next_run_at") is None for job in consumers))

    def test_restore_quiesces_external_hardlink_alias_before_first_restore_write(self):
        apply_install(**self.kwargs())
        self.set_publisher_enabled()
        jobs_path = self.radulator_home / "cron" / "jobs.json"
        payload = json.loads(jobs_path.read_text())
        publisher_wrapper = (
            self.radulator_home / "scripts" / "trusted_publisher_cron.sh"
        )
        external_alias = self.default_home / "restore-publisher-alias.sh"
        os.link(publisher_wrapper, external_alias)
        payload["jobs"].append({
            "id": "restore-hardlink-publisher",
            "name": "restore-hardlink-publisher",
            "script": str(external_alias),
            "enabled": True,
            "state": "scheduled",
            "next_run_at": "2026-08-26T12:00:00Z",
        })
        jobs_path.write_text(json.dumps(payload) + "\n")
        original_apply = install_module._apply_restored_target
        observed = []

        def observe_first_restore_write(target, existed, mode, content):
            if not observed:
                current = json.loads(jobs_path.read_text())["jobs"]
                alias = next(
                    job
                    for job in current
                    if job.get("id") == "restore-hardlink-publisher"
                )
                observed.append(
                    (
                        alias.get("enabled"),
                        alias.get("state"),
                        alias.get("next_run_at"),
                    )
                )
            return original_apply(target, existed, mode, content)

        with mock.patch.object(
            install_module,
            "_apply_restored_target",
            side_effect=observe_first_restore_write,
        ):
            restore_install(**self.kwargs())

        self.assertEqual(observed, [(False, "paused", None)])

    def test_duplicate_exact_publisher_identities_are_quiesced_before_rejection(self):
        jobs_path = self.radulator_home / "cron" / "jobs.json"
        payload = json.loads(jobs_path.read_text())
        for suffix in ("one", "two"):
            payload["jobs"].append({
                "id": "1def08dbcb74",
                "name": "radulator-trusted-publisher",
                "script": "trusted_publisher_cron.sh",
                "enabled": True,
                "state": "scheduled",
                "next_run_at": "2026-08-26T12:00:00Z",
            })
        jobs_path.write_text(json.dumps(payload) + "\n")

        with self.assertRaisesRegex(InstallError, "ambiguous|duplicate"):
            apply_install(**self.kwargs())

        duplicates = [
            job
            for job in json.loads(jobs_path.read_text())["jobs"]
            if job.get("id") == "1def08dbcb74"
            or job.get("name") == "radulator-trusted-publisher"
        ]
        self.assertEqual(len(duplicates), 2)
        self.assertTrue(all(job.get("enabled") is False for job in duplicates))
        self.assertTrue(all(job.get("state") == "paused" for job in duplicates))
        self.assertTrue(all(job.get("next_run_at") is None for job in duplicates))
        self.assertFalse(
            (self.radulator_home / "scripts" / "trusted_publisher_cron.sh").exists()
        )

    def test_enable_holds_both_gateway_job_locks_through_render_and_journal_finish(self):
        result = apply_install(**self.kwargs())
        public_keys = generate_keys(build_plan(**self.kwargs()))
        verification_jobs = self.default_home / "cron" / "jobs.json"
        verification_lock = self.default_home / "cron" / ".jobs.lock"
        release = self.default_home / "cron" / "release-gateway-writer"
        writer_source = """
import fcntl, json, os, pathlib, sys, time
jobs_path = pathlib.Path(sys.argv[1])
lock_path = pathlib.Path(sys.argv[2])
release_path = pathlib.Path(sys.argv[3])
with lock_path.open('a+') as lock:
    fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
    stale = json.loads(jobs_path.read_text())
    print('locked', flush=True)
    while not release_path.exists():
        time.sleep(0.01)
    jobs = stale if isinstance(stale, list) else stale['jobs']
    jobs.append({'id': 'gateway-write', 'name': 'gateway-write', 'enabled': False})
    temporary = jobs_path.with_name('jobs.gateway.tmp')
    temporary.write_text(json.dumps(stale) + '\\n')
    os.replace(temporary, jobs_path)
"""
        writer = subprocess.Popen(
            [
                sys.executable,
                "-c",
                writer_source,
                str(verification_jobs),
                str(verification_lock),
                str(release),
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        self.assertEqual(writer.stdout.readline().strip(), "locked")
        outcome = []

        def enable():
            try:
                outcome.append(apply_install(
                    **self.kwargs(),
                    enable=True,
                    expected_public_keys=public_keys,
                    activation_test_runner=self.passing_activation_runner,
                ))
            except BaseException as error:
                outcome.append(error)

        worker = threading.Thread(target=enable)
        worker.start()
        time.sleep(0.15)
        blocked_behind_gateway = worker.is_alive()
        release.write_text("release\n")
        worker.join(timeout=5)
        stdout, stderr = writer.communicate(timeout=5)

        self.assertEqual(writer.returncode, 0, stderr or stdout)
        self.assertTrue(blocked_behind_gateway)
        self.assertFalse(worker.is_alive())
        self.assertEqual(len(outcome), 1)
        if isinstance(outcome[0], BaseException):
            raise outcome[0]
        self.assertEqual(outcome[0]["mode"], "enabled")
        managed_ids = set(result["job_ids"].values())
        observed_ids = set()
        for path in (
            self.radulator_home / "cron" / "jobs.json",
            self.default_home / "cron" / "jobs.json",
        ):
            payload = json.loads(path.read_text())
            jobs = payload if isinstance(payload, list) else payload["jobs"]
            for job in jobs:
                if job.get("id") not in managed_ids:
                    continue
                observed_ids.add(job["id"])
                self.assertIs(job.get("enabled"), True)
                self.assertEqual(job.get("state"), "scheduled")
        self.assertEqual(observed_ids, managed_ids)

    def test_apply_times_out_fail_closed_when_gateway_job_lock_is_unavailable(self):
        apply_install(**self.kwargs())
        publisher = self.radulator_home / "scripts" / "trusted_publisher.py"
        publisher.write_bytes(b"operator bytes must not be replaced\n")
        publisher.chmod(0o700)
        lock_path = self.radulator_home / "cron" / ".jobs.lock"
        holder = subprocess.Popen(
            [
                sys.executable,
                "-c",
                (
                    "import fcntl,pathlib,sys,time; "
                    "p=pathlib.Path(sys.argv[1]); "
                    "f=p.open('a+'); fcntl.flock(f.fileno(),fcntl.LOCK_EX); "
                    "print('locked',flush=True); time.sleep(0.3)"
                ),
                str(lock_path),
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        self.assertEqual(holder.stdout.readline().strip(), "locked")
        try:
            with mock.patch.object(
                install_module,
                "JOBS_LOCK_TIMEOUT_SECONDS",
                0.05,
                create=True,
            ):
                with self.assertRaisesRegex(InstallError, "jobs lock"):
                    apply_install(**self.kwargs())
        finally:
            stdout, stderr = holder.communicate(timeout=5)
            self.assertEqual(holder.returncode, 0, stderr or stdout)

        self.assertEqual(publisher.read_bytes(), b"operator bytes must not be replaced\n")

    def test_activation_proofs_run_unlocked_while_all_managed_consumers_are_disabled(self):
        result = apply_install(**self.kwargs())
        public_keys = generate_keys(build_plan(**self.kwargs()))
        managed_ids = set(result["job_ids"].values())
        observations = []

        def runner(command, **_kwargs):
            descriptors = []
            acquired = True
            try:
                for path in sorted((
                    self.radulator_home / "cron" / ".jobs.lock",
                    self.default_home / "cron" / ".jobs.lock",
                ), key=str):
                    descriptor = path.open("a+")
                    descriptors.append(descriptor)
                    try:
                        fcntl.flock(
                            descriptor.fileno(),
                            fcntl.LOCK_EX | fcntl.LOCK_NB,
                        )
                    except BlockingIOError:
                        acquired = False
                disabled = True
                for jobs_path in (
                    self.radulator_home / "cron" / "jobs.json",
                    self.default_home / "cron" / "jobs.json",
                ):
                    payload = json.loads(jobs_path.read_text())
                    jobs = payload if isinstance(payload, list) else payload["jobs"]
                    disabled = disabled and all(
                        job.get("enabled") is False
                        for job in jobs
                        if job.get("id") in managed_ids
                    )
                observations.append((acquired, disabled))
            finally:
                for descriptor in reversed(descriptors):
                    try:
                        fcntl.flock(descriptor.fileno(), fcntl.LOCK_UN)
                    finally:
                        descriptor.close()
            return subprocess.CompletedProcess(command, 0, "test-token", "")

        apply_install(
            **self.kwargs(),
            enable=True,
            expected_public_keys=public_keys,
            activation_test_runner=runner,
        )

        self.assertTrue(observations)
        self.assertTrue(all(acquired and disabled for acquired, disabled in observations))

    def test_crash_between_profile_enable_writes_recovers_both_profiles_disabled(self):
        result = apply_install(**self.kwargs())
        plan = build_plan(**self.kwargs())
        public_keys = generate_keys(plan)
        primary_path = (self.radulator_home / "cron" / "jobs.json").resolve()
        journal_path = self.radulator_home / "state" / "radulator-jobs-transaction.json"
        managed_ids = set(result["job_ids"].values())
        original_atomic_write = install_module._atomic_write
        injected = False

        def crash_after_primary_enable(path, content, mode=0o600):
            nonlocal injected
            written = original_atomic_write(path, content, mode)
            if Path(path).resolve() == primary_path and not injected:
                payload = json.loads(content)
                jobs = payload["jobs"] if isinstance(payload, dict) else payload
                managed = [job for job in jobs if job.get("id") in managed_ids]
                if managed and any(job.get("enabled") is True for job in managed):
                    injected = True
                    raise SystemExit("synthetic process death between profile writes")
            return written

        with mock.patch.object(
            install_module, "_atomic_write", side_effect=crash_after_primary_enable
        ):
            with self.assertRaisesRegex(SystemExit, "synthetic process death"):
                apply_install(
                    **self.kwargs(),
                    enable=True,
                    expected_public_keys=public_keys,
                    activation_test_runner=self.passing_activation_runner,
                )

        self.assertTrue(injected)
        self.assertTrue(journal_path.is_file())
        apply_install(**self.kwargs())
        self.assertFalse(journal_path.exists())
        observed_ids = set()
        for path in (
            self.radulator_home / "cron" / "jobs.json",
            self.default_home / "cron" / "jobs.json",
        ):
            payload = json.loads(path.read_text())
            jobs = payload["jobs"] if isinstance(payload, dict) else payload
            for job in jobs:
                if job.get("id") not in managed_ids:
                    continue
                observed_ids.add(job["id"])
                self.assertIs(job.get("enabled"), False)
                self.assertEqual(job.get("state"), "paused")
                self.assertIsNone(job.get("next_run_at"))
        self.assertEqual(observed_ids, managed_ids)

    def test_wrapper_isolates_python_imports_before_exporting_token(self):
        wrapper = (
            self.repo / "ops/hermes/radulator/trusted_publisher_cron.sh"
        ).read_text(encoding="utf-8")

        self.assertIn("PYTHONHOME PYTHONPATH", wrapper)
        self.assertRegex(
            wrapper,
            r'hermes-agent/venv/bin/python"\s+\\\n\s+-I\s+\\',
        )

    def test_wrapper_import_path_cannot_observe_synthetic_github_token(self):
        root = Path(self.temp.name)
        fake = root / "publisher-counterfeit"
        hermes_cli = fake / "hermes_cli"
        hermes_cli.mkdir(parents=True)
        marker = "COUNTERFEIT_IMPORT_SAW_TOKEN="
        (hermes_cli / "__init__.py").write_text(
            "import os\n"
            f"print('{marker}' + os.environ.get('GH_TOKEN', ''))\n"
            "from . import kanban_db\n"
        )
        (hermes_cli / "kanban_db.py").write_text(
            "class Connection:\n"
            "    def close(self): pass\n"
            "def connect(board): return Connection()\n"
            "def list_tasks(conn, **kwargs): return []\n"
        )
        project = root / "publisher-project"
        project.mkdir()
        controller = root / "publisher-controller.py"
        controller.write_text("")
        wrapper = (
            self.repo / "ops/hermes/radulator/trusted_publisher_cron.sh"
        ).read_text(encoding="utf-8")
        command = [sys.executable]
        if re.search(
            r'hermes-agent/venv/bin/python"\s+\\\n\s+-I\s+\\', wrapper
        ):
            command.append("-I")
        command.extend([
            str(self.repo / "ops/hermes/radulator/trusted_publisher.py"),
            "--project-root", str(project),
            "--lifecycle-controller", str(controller),
            "--ledger", str(root / "publisher-ledger.jsonl"),
            "--lock-file", str(root / "publisher.lock"),
        ])
        environment = dict(os.environ)
        environment["GH_TOKEN"] = "synthetic-review-token"
        environment["PYTHONPATH"] = str(fake)
        if re.search(r"unset .*PYTHONPATH", wrapper):
            environment.pop("PYTHONPATH")
        result = subprocess.run(
            command,
            cwd=self.repo,
            env=environment,
            check=False,
            capture_output=True,
            text=True,
        )

        self.assertNotIn(marker, result.stdout + result.stderr)

    def test_clean_install_copies_executable_publisher_lifecycle_dependency(self):
        apply_install(**self.kwargs())
        installed = self.radulator_home / "scripts" / "lifecycle_controller.py"
        source = self.repo / "ops/hermes/radulator/lifecycle_controller.py"
        self.assertEqual(installed.read_bytes(), source.read_bytes())
        self.assertEqual(stat.S_IMODE(installed.stat().st_mode), 0o700)

        spec = importlib.util.spec_from_file_location(
            "installed_trusted_publisher",
            self.radulator_home / "scripts" / "trusted_publisher.py",
        )
        self.assertIsNotNone(spec)
        module = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = module
        try:
            spec.loader.exec_module(module)
        finally:
            sys.modules.pop(spec.name, None)
        config, _lock = module.parse_runtime_config([
            "--project-root", str(self.repo),
            "--lifecycle-controller", str(installed),
            "--ledger", str(self.radulator_home / "state" / "release.jsonl"),
            "--lock-file", str(self.radulator_home / "state" / "publisher.lock"),
        ])
        self.assertEqual(config.lifecycle_controller, installed.resolve())

        restore_install(**self.kwargs())
        self.assertFalse(installed.exists())

    def test_apply_and_restore_manage_the_operations_guideline_registry(self):
        apply_install(**self.kwargs())
        source_root = self.repo / "ops/hermes/radulator/skills/radulator-operations/references"
        destination_root = self.radulator_home / "skills/domain/radulator-operations/references"

        for filename in ("guideline-versions.json", "guideline-versions.md"):
            source = source_root / filename
            destination = destination_root / filename
            self.assertEqual(destination.read_bytes(), source.read_bytes())
            self.assertEqual(stat.S_IMODE(destination.stat().st_mode), 0o644)

        restore_install(**self.kwargs())

        for filename in ("guideline-versions.json", "guideline-versions.md"):
            self.assertFalse((destination_root / filename).exists())

    def test_backup_uses_signed_symbolic_v2_with_owner_only_regular_key_and_manifest(self):
        apply_install(**self.kwargs())
        backup_path = self.radulator_home / "state" / "radulator-release-backup.json"
        key_path = self.radulator_home / "state" / "radulator-release-backup.hmac.key"

        backup = json.loads(backup_path.read_text())
        self.assertEqual(backup["schema"], "radulator-hermes-backup/v2")
        self.assertRegex(backup["hmac_sha256"], r"^[0-9a-f]{64}$")
        self.assertTrue(all("target_id" in entry and "path" not in entry for entry in backup["entries"]))
        self.assertEqual(len({entry["target_id"] for entry in backup["entries"]}), len(backup["entries"]))
        for protected in (backup_path, key_path):
            details = protected.lstat()
            self.assertTrue(stat.S_ISREG(details.st_mode))
            self.assertEqual(details.st_uid, os.getuid())
            self.assertEqual(stat.S_IMODE(details.st_mode), 0o600)
        self.assertEqual(len(key_path.read_bytes()), 32)

    def test_restore_rejects_content_tamper_before_any_target_write(self):
        apply_install(**self.kwargs())
        backup_path = self.radulator_home / "state" / "radulator-release-backup.json"
        jobs_path = self.radulator_home / "cron" / "jobs.json"
        installed = jobs_path.read_bytes()
        backup = json.loads(backup_path.read_text())
        backup["entries"][0]["content_base64"] = base64.b64encode(b"attacker").decode("ascii")
        backup_path.write_text(json.dumps(backup) + "\n")
        backup_path.chmod(0o600)

        with self.assertRaisesRegex(InstallError, "authentication"):
            restore_install(**self.kwargs())

        self.assertEqual(jobs_path.read_bytes(), installed)

    def test_restore_bad_hmac_quiesces_enabled_publisher_before_rejection(self):
        apply_install(**self.kwargs())
        self.set_publisher_enabled()
        backup_path = self.radulator_home / "state" / "radulator-release-backup.json"
        backup = json.loads(backup_path.read_text())
        backup["hmac_sha256"] = "0" * 64
        backup_path.write_text(json.dumps(backup) + "\n")
        backup_path.chmod(0o600)

        with self.assertRaisesRegex(InstallError, "authentication"):
            restore_install(**self.kwargs())

        publisher = self.publisher_job()
        self.assertIs(publisher["enabled"], False)
        self.assertEqual(publisher["state"], "paused")
        self.assertIsNone(publisher["next_run_at"])

    def test_restore_unsafe_backup_key_quiesces_enabled_publisher_before_rejection(self):
        apply_install(**self.kwargs())
        self.set_publisher_enabled()
        key_path = (
            self.radulator_home
            / "state"
            / "radulator-release-backup.hmac.key"
        )
        key_path.chmod(0o644)

        with self.assertRaisesRegex(InstallError, "0600"):
            restore_install(**self.kwargs())

        publisher = self.publisher_job()
        self.assertIs(publisher["enabled"], False)
        self.assertEqual(publisher["state"], "paused")
        self.assertIsNone(publisher["next_run_at"])

    def test_restore_rejects_signed_unknown_duplicate_and_injected_targets(self):
        for mutation, message in (
            (lambda entries: entries[0].update({"target_id": "attacker.unknown"}), "unknown"),
            (lambda entries: entries[1].update({"target_id": entries[0]["target_id"]}), "duplicate"),
            (lambda entries: entries[0].update({"path": "/tmp/injected"}), "fields"),
        ):
            with self.subTest(message=message):
                with tempfile.TemporaryDirectory() as nested:
                    root = Path(nested)
                    verification = root / ".hermes"
                    radulator = verification / "profiles" / "radulator"
                    for home in (radulator, verification):
                        home.mkdir(parents=True, exist_ok=True)
                        (home / "config.yaml").write_text(
                            "model: openai-codex/gpt-5.6-sol\nagent:\n  reasoning_effort: xhigh\ncron:\n  max_parallel_jobs: 1\n"
                        )
                        (home / "cron").mkdir()
                    (radulator / "cron/jobs.json").write_bytes(self.original_radulator_jobs)
                    (verification / "cron/jobs.json").write_bytes(self.original_default_jobs)
                    args = {"repo": self.repo, "radulator_home": radulator, "default_home": verification}
                    apply_install(**args)
                    backup_path = radulator / "state/radulator-release-backup.json"
                    backup = json.loads(backup_path.read_text())
                    mutation(backup["entries"])
                    key = (radulator / "state/radulator-release-backup.hmac.key").read_bytes()
                    unsigned = {"schema": backup["schema"], "entries": backup["entries"]}
                    serialized = (json.dumps(unsigned, indent=2, sort_keys=True) + "\n").encode("utf-8")
                    backup["hmac_sha256"] = hmac.new(key, serialized, hashlib.sha256).hexdigest()
                    backup_path.write_text(json.dumps(backup, indent=2, sort_keys=True) + "\n")
                    backup_path.chmod(0o600)
                    with self.assertRaisesRegex(InstallError, message):
                        restore_install(**args)

    def test_restore_validates_invalid_later_entry_before_restoring_first(self):
        apply_install(**self.kwargs())
        backup_path = self.radulator_home / "state" / "radulator-release-backup.json"
        jobs_path = self.radulator_home / "cron" / "jobs.json"
        installed = jobs_path.read_bytes()
        backup = json.loads(backup_path.read_text())
        backup["entries"][-1]["content_base64"] = "***not-base64***"
        backup_path.write_bytes(self.resign_backup(backup))
        backup_path.chmod(0o600)

        with self.assertRaisesRegex(InstallError, "content"):
            restore_install(**self.kwargs())

        self.assertEqual(jobs_path.read_bytes(), installed)

    def test_restore_crash_after_verification_profile_write_recovers_disabled_first(self):
        verification_jobs = self.default_home / "cron" / "jobs.json"
        original = json.loads(verification_jobs.read_text())
        original.append({
            "id": "operator-verification",
            "name": "radulator-clinical-judge-verification",
            "enabled": True,
            "state": "scheduled",
            "next_run_at": "2026-08-26T12:00:00Z",
        })
        verification_jobs.write_text(json.dumps(original) + "\n")
        apply_install(**self.kwargs())
        journal_path = self.radulator_home / "state" / "radulator-jobs-transaction.json"
        original_atomic_write = install_module._atomic_write
        injected = False

        def crash_after_sanitized_verification_restore(path, content, mode=0o600):
            nonlocal injected
            written = original_atomic_write(path, content, mode)
            if Path(path).resolve() != verification_jobs.resolve() or injected:
                return written
            payload = json.loads(content)
            jobs = payload["jobs"] if isinstance(payload, dict) else payload
            matched = [
                job
                for job in jobs
                if job.get("name") == "radulator-clinical-judge-verification"
            ]
            if len(matched) == 1 and matched[0].get("id") == "operator-verification":
                injected = True
                raise SystemExit("synthetic restore process death")
            return written

        with mock.patch.object(
            install_module,
            "_atomic_write",
            side_effect=crash_after_sanitized_verification_restore,
        ):
            with self.assertRaisesRegex(SystemExit, "synthetic restore process death"):
                restore_install(**self.kwargs())

        self.assertTrue(injected)
        self.assertTrue(journal_path.is_file())
        current = json.loads(verification_jobs.read_text())
        matched = [
            job
            for job in current
            if job.get("name") == "radulator-clinical-judge-verification"
        ]
        self.assertEqual(len(matched), 1)
        self.assertIs(matched[0].get("enabled"), False)
        self.assertEqual(matched[0].get("state"), "paused")
        self.assertIsNone(matched[0].get("next_run_at"))

        restore_install(**self.kwargs())
        self.assertFalse(journal_path.exists())
        current = json.loads(verification_jobs.read_text())
        matched = [
            job
            for job in current
            if job.get("name") == "radulator-clinical-judge-verification"
        ]
        self.assertEqual(len(matched), 1)
        self.assertIs(matched[0].get("enabled"), False)
        self.assertEqual(matched[0].get("state"), "paused")
        self.assertIsNone(matched[0].get("next_run_at"))

    def test_restore_rejects_symlink_or_non_0600_authentication_key(self):
        for unsafe in ("mode", "symlink", "dangling-symlink"):
            with self.subTest(unsafe=unsafe):
                apply_install(**self.kwargs())
                key_path = self.radulator_home / "state" / "radulator-release-backup.hmac.key"
                if unsafe == "mode":
                    key_path.chmod(0o640)
                else:
                    real_key = key_path.with_name("real-backup-key")
                    key_path.replace(real_key)
                    key_path.symlink_to(real_key)
                    if unsafe == "dangling-symlink":
                        real_key.unlink()
                with self.assertRaisesRegex(InstallError, "regular non-symlink|0600"):
                    restore_install(**self.kwargs())
                if unsafe == "mode":
                    key_path.chmod(0o600)
                else:
                    key_path.unlink()
                    if real_key.exists():
                        real_key.replace(key_path)

    def test_restore_rejects_protected_files_not_owned_by_runtime_user(self):
        apply_install(**self.kwargs())
        actual_uid = (self.radulator_home / "state" / "radulator-release-backup.json").lstat().st_uid
        with mock.patch.object(install_module.os, "getuid", return_value=actual_uid + 1):
            with self.assertRaisesRegex(InstallError, "owner-controlled"):
                restore_install(**self.kwargs())

    def test_restore_rejects_backup_manifest_without_exact_0600_mode(self):
        apply_install(**self.kwargs())
        backup_path = self.radulator_home / "state" / "radulator-release-backup.json"
        backup_path.chmod(0o640)

        with self.assertRaisesRegex(InstallError, "exact mode 0600"):
            restore_install(**self.kwargs())

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
        self.assertFalse(seed_job["enabled"])
        self.assertEqual(seed_job["state"], "paused")
        self.assertIsNone(seed_job["next_run_at"])
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
        self.assertFalse(promoter["enabled"])
        self.assertEqual(promoter["state"], "paused")
        self.assertIsNone(promoter["next_run_at"])
        self.assertEqual(promoter["deliver"], "telegram")
        self.assertEqual(promoter["script"], "release_promoter_cron.sh")
        self.assertEqual(promoter["schedule"]["expr"], "*/10 * * * *")

    def test_plain_apply_quiesces_enabled_drifted_publisher_before_copy_and_leaves_it_disabled(self):
        apply_install(**self.kwargs())
        self.set_publisher_enabled()
        publisher = self.radulator_home / "scripts" / "trusted_publisher.py"
        publisher.write_bytes(b"old publisher bytes\n")
        publisher.chmod(0o700)
        original_atomic_write = install_module._atomic_write
        observed_disabled_at_copy = []

        def recording_atomic_write(path, content, mode=0o600):
            if Path(path).resolve() == publisher.resolve() and content == (self.repo / "ops/hermes/radulator/trusted_publisher.py").read_bytes():
                observed_disabled_at_copy.append(self.publisher_job()["enabled"] is False)
            return original_atomic_write(path, content, mode)

        with mock.patch.object(install_module, "_atomic_write", side_effect=recording_atomic_write):
            apply_install(**self.kwargs())

        self.assertEqual(observed_disabled_at_copy, [True])
        self.assertFalse(self.publisher_job()["enabled"])
        self.assertEqual(publisher.read_bytes(), (self.repo / "ops/hermes/radulator/trusted_publisher.py").read_bytes())

    def test_explicit_enable_copies_drift_then_preflights_while_disabled_before_reenabling(self):
        plan = build_plan(**self.kwargs())
        apply_install(**self.kwargs())
        self.set_publisher_enabled()
        publisher = self.radulator_home / "scripts" / "trusted_publisher.py"
        publisher.write_bytes(b"old publisher bytes\n")
        publisher.chmod(0o700)
        public_keys = generate_keys(plan)
        observed = []

        def runner(command, **_kwargs):
            observed.append({
                "command": command,
                "disabled": self.publisher_job()["enabled"] is False,
                "installed": publisher.read_bytes() == (self.repo / "ops/hermes/radulator/trusted_publisher.py").read_bytes(),
            })
            output = "test-token" if "auth" in command and "token" in command else "passed"
            return subprocess.CompletedProcess(command, 0, output, "")

        apply_install(
            **self.kwargs(), enable=True, expected_public_keys=public_keys,
            activation_test_runner=runner,
        )

        self.assertTrue(observed)
        self.assertTrue(all(item["disabled"] and item["installed"] for item in observed))
        self.assertTrue(self.publisher_job()["enabled"])

    def test_repeated_enable_is_an_exact_jobs_file_noop_across_timestamp_boundaries(self):
        plan = build_plan(**self.kwargs())
        apply_install(**self.kwargs())
        public_keys = generate_keys(plan)
        with mock.patch.object(
            install_module, "_now", return_value="2026-08-26T12:00:00Z"
        ):
            apply_install(
                **self.kwargs(),
                enable=True,
                expected_public_keys=public_keys,
                activation_test_runner=self.passing_activation_runner,
            )
        before = {
            path: path.read_bytes()
            for path in (
                self.radulator_home / "cron" / "jobs.json",
                self.default_home / "cron" / "jobs.json",
            )
        }

        with mock.patch.object(
            install_module, "_now", return_value="2026-08-26T12:00:02Z"
        ):
            apply_install(
                **self.kwargs(),
                enable=True,
                expected_public_keys=public_keys,
                activation_test_runner=self.passing_activation_runner,
            )

        self.assertEqual(
            before,
            {path: path.read_bytes() for path in before},
        )

    def test_failed_post_copy_enable_restores_prior_publisher_bytes_and_remains_disabled(self):
        plan = build_plan(**self.kwargs())
        apply_install(**self.kwargs())
        self.set_publisher_enabled()
        publisher = self.radulator_home / "scripts" / "trusted_publisher.py"
        wrapper = self.radulator_home / "scripts" / "trusted_publisher_cron.sh"
        old_publisher = b"old publisher bytes\n"
        old_wrapper = b"#!/bin/sh\nexit 77\n"
        publisher.write_bytes(old_publisher)
        wrapper.write_bytes(old_wrapper)
        publisher.chmod(0o700)
        wrapper.chmod(0o700)
        public_keys = generate_keys(plan)

        def failing_runner(command, **_kwargs):
            if any("kanban_git_broker" in str(part) for part in command):
                return subprocess.CompletedProcess(command, 1, "", "missing security boundary")
            return subprocess.CompletedProcess(command, 0, "test-token", "")

        with self.assertRaisesRegex(InstallError, "broker|security"):
            apply_install(
                **self.kwargs(), enable=True, expected_public_keys=public_keys,
                activation_test_runner=failing_runner,
            )

        self.assertEqual(publisher.read_bytes(), old_publisher)
        self.assertEqual(wrapper.read_bytes(), old_wrapper)
        self.assertFalse(self.publisher_job()["enabled"])

    def test_unsafe_enabled_publisher_asset_is_quiesced_before_installer_refuses_it(self):
        apply_install(**self.kwargs())
        self.set_publisher_enabled()
        publisher = self.radulator_home / "scripts" / "trusted_publisher.py"
        outside = self.radulator_home / "unsafe-publisher-target.py"
        outside.write_bytes(b"unsafe\n")
        publisher.unlink()
        publisher.symlink_to(outside)

        with self.assertRaisesRegex(InstallError, "non-symlink"):
            apply_install(**self.kwargs())

        self.assertFalse(self.publisher_job()["enabled"])
        self.assertTrue(publisher.is_symlink())

    def test_apply_rejects_symlinked_managed_parent_before_copying_outside_profile(self):
        outside = self.default_home / "outside-scripts"
        outside.mkdir()
        scripts = self.radulator_home / "scripts"
        scripts.symlink_to(outside, target_is_directory=True)

        with self.assertRaisesRegex(InstallError, "parent.*non-symlink"):
            apply_install(**self.kwargs())

        self.assertFalse((outside / "trusted_publisher.py").exists())

    def test_fresh_apply_quiesces_enabled_publisher_before_unsafe_parent_preflight_failure(self):
        plan = build_plan(**self.kwargs())
        jobs_path = self.radulator_home / "cron" / "jobs.json"
        payload = json.loads(jobs_path.read_text())
        publisher = next(
            job for job in plan["jobs"] if job["name"] == "radulator-trusted-publisher"
        )
        payload["jobs"].append({
            key: value for key, value in publisher.items() if key != "_home"
        })
        payload["jobs"][-1].update({
            "enabled": True,
            "state": "scheduled",
            "next_run_at": "2026-08-26T12:00:00Z",
        })
        jobs_path.write_text(json.dumps(payload) + "\n")
        outside = self.default_home / "outside-fresh-scripts"
        outside.mkdir()
        (self.radulator_home / "scripts").symlink_to(outside, target_is_directory=True)

        with self.assertRaisesRegex(InstallError, "parent.*non-symlink"):
            apply_install(**self.kwargs())

        current = self.publisher_job()
        self.assertIs(current["enabled"], False)
        self.assertEqual(current["state"], "paused")
        self.assertIsNone(current["next_run_at"])
        self.assertFalse((outside / "trusted_publisher.py").exists())
        prefix = json.loads(
            (
                self.radulator_home
                / "state"
                / "radulator-release-backup.json"
            ).read_text()
        )
        entries = {entry["target_id"]: entry for entry in prefix["entries"]}
        self.assertEqual(
            set(entries),
            {"primary:cron/jobs.json", "verification:cron/jobs.json"},
        )
        original_primary = json.loads(
            base64.b64decode(
                entries["primary:cron/jobs.json"]["content_base64"]
            )
        )
        original_publisher = next(
            job
            for job in original_primary["jobs"]
            if job.get("id") == "1def08dbcb74"
        )
        self.assertIs(original_publisher["enabled"], True)

    def test_unsafe_backup_key_is_checked_only_after_durable_quiescence_and_preserves_original_jobs(self):
        plan = build_plan(**self.kwargs())
        jobs_path = self.radulator_home / "cron" / "jobs.json"
        payload = json.loads(jobs_path.read_text())
        publisher = next(
            job for job in plan["jobs"] if job["name"] == "radulator-trusted-publisher"
        )
        payload["jobs"].append({
            key: value for key, value in publisher.items() if key != "_home"
        })
        payload["jobs"][-1].update({
            "enabled": True,
            "state": "scheduled",
            "next_run_at": "2026-08-26T12:00:00Z",
        })
        jobs_path.write_text(json.dumps(payload) + "\n")
        key_path = (
            self.radulator_home
            / "state"
            / "radulator-release-backup.hmac.key"
        )
        key_path.parent.mkdir()
        key_path.write_bytes(b"unsafe-key")
        key_path.chmod(0o644)

        with self.assertRaisesRegex(InstallError, "0600|wrong length"):
            apply_install(**self.kwargs())

        current = self.publisher_job()
        self.assertIs(current["enabled"], False)
        self.assertEqual(current["state"], "paused")
        self.assertIsNone(current["next_run_at"])

        key_path.unlink()
        apply_install(**self.kwargs())
        backup = json.loads(
            (
                self.radulator_home
                / "state"
                / "radulator-release-backup.json"
            ).read_text()
        )
        entries = {entry["target_id"]: entry for entry in backup["entries"]}
        original_primary = json.loads(
            base64.b64decode(
                entries["primary:cron/jobs.json"]["content_base64"]
            )
        )
        original_publisher = next(
            job
            for job in original_primary["jobs"]
            if job.get("id") == "1def08dbcb74"
        )
        self.assertIs(original_publisher["enabled"], True)

    def test_legacy_no_key_apply_quiesces_enabled_publisher_before_unsafe_parent_migration_failure(self):
        plan = build_plan(**self.kwargs())
        jobs_path = self.radulator_home / "cron" / "jobs.json"
        payload = json.loads(jobs_path.read_text())
        publisher = next(
            job for job in plan["jobs"] if job["name"] == "radulator-trusted-publisher"
        )
        payload["jobs"].append({
            key: value for key, value in publisher.items() if key != "_home"
        })
        payload["jobs"][-1].update({
            "enabled": True,
            "state": "scheduled",
            "next_run_at": "2026-08-26T12:00:00Z",
        })
        jobs_path.write_text(json.dumps(payload) + "\n")
        backup_path = self.radulator_home / "state" / "radulator-release-backup.json"
        backup_path.parent.mkdir()
        backup_path.write_text(json.dumps({
            "schema": "radulator-hermes-backup/v1",
            "entries": self.legacy_v1_entries(plan),
        }) + "\n")
        backup_path.chmod(0o600)
        outside = self.default_home / "outside-legacy-scripts"
        outside.mkdir()
        (self.radulator_home / "scripts").symlink_to(outside, target_is_directory=True)

        with self.assertRaisesRegex(InstallError, "parent.*non-symlink"):
            apply_install(**self.kwargs())

        current = self.publisher_job()
        self.assertIs(current["enabled"], False)
        self.assertEqual(current["state"], "paused")
        self.assertIsNone(current["next_run_at"])
        self.assertEqual(
            json.loads(backup_path.read_text())["schema"],
            "radulator-hermes-backup/v1",
        )
        self.assertFalse((outside / "trusted_publisher.py").exists())

    def test_upgrade_rejects_partial_unsigned_v1_backup_before_writing(self):
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
        backup_path.chmod(0o600)

        with self.assertRaisesRegex(InstallError, "exactly match"):
            apply_install(**self.kwargs())

        feedback_script = self.radulator_home / "scripts" / "radulator_formspree_feedback_intake.py"
        self.assertFalse(feedback_script.exists())
        self.assertEqual((self.radulator_home / "cron" / "jobs.json").read_bytes(), self.original_radulator_jobs)

    def test_upgrade_migrates_only_complete_exact_v1_backup_to_signed_symbolic_v2(self):
        plan = build_plan(**self.kwargs())
        backup_path = self.radulator_home / "state" / "radulator-release-backup.json"
        backup_path.parent.mkdir()
        v1_entries = self.legacy_v1_entries(plan)
        backup_path.write_text(json.dumps({
            "schema": "radulator-hermes-backup/v1",
            "entries": v1_entries,
        }) + "\n")
        backup_path.chmod(0o600)

        apply_install(**self.kwargs())

        migrated = json.loads(backup_path.read_text())
        self.assertEqual(migrated["schema"], "radulator-hermes-backup/v2")
        self.assertRegex(migrated["hmac_sha256"], r"^[0-9a-f]{64}$")
        self.assertTrue(all(set(entry) == {"target_id", "existed", "mode", "content_base64"} for entry in migrated["entries"]))
        restore_install(**self.kwargs())
        self.assertFalse((self.radulator_home / "scripts" / "radulator_formspree_feedback_intake.py").exists())

    def test_v1_migration_captures_new_targets_before_install_and_restore(self):
        plan = build_plan(**self.kwargs())
        scripts = self.radulator_home / "scripts"
        scripts.mkdir()
        lifecycle = scripts / "lifecycle_controller.py"
        lifecycle.write_bytes(b"operator-owned preexisting lifecycle\n")
        lifecycle.chmod(0o640)
        backup_path = self.radulator_home / "state" / "radulator-release-backup.json"
        backup_path.parent.mkdir()
        backup_path.write_text(json.dumps({
            "schema": "radulator-hermes-backup/v1",
            "entries": self.legacy_v1_entries(plan),
        }) + "\n")
        backup_path.chmod(0o600)

        apply_install(**self.kwargs())

        migrated = json.loads(backup_path.read_text())
        entries = {entry["target_id"]: entry for entry in migrated["entries"]}
        self.assertEqual(set(entries), set(install_module._backup_targets(plan)))
        captured = entries["primary:scripts/lifecycle_controller.py"]
        self.assertTrue(captured["existed"])
        self.assertEqual(captured["mode"], 0o640)
        self.assertEqual(
            base64.b64decode(captured["content_base64"]),
            b"operator-owned preexisting lifecycle\n",
        )

        restore_install(**self.kwargs())
        self.assertEqual(lifecycle.read_bytes(), b"operator-owned preexisting lifecycle\n")
        self.assertEqual(stat.S_IMODE(lifecycle.stat().st_mode), 0o640)
        self.assertFalse((scripts / "trusted_publisher.py").exists())
        self.assertFalse((scripts / "trusted_publisher_cron.sh").exists())

    def test_v1_migration_rejects_enlarged_allowlist_before_any_write(self):
        plan = build_plan(**self.kwargs())
        backup_path = self.radulator_home / "state" / "radulator-release-backup.json"
        backup_path.parent.mkdir()
        backup_path.write_text(json.dumps({
            "schema": "radulator-hermes-backup/v1",
            "entries": self.legacy_v1_entries(
                plan,
                extra_target_id="primary:scripts/trusted_publisher.py",
            ),
        }) + "\n")
        backup_path.chmod(0o600)

        with mock.patch.object(install_module, "_atomic_write") as writes:
            with self.assertRaisesRegex(InstallError, "previous managed target allowlist"):
                apply_install(**self.kwargs())

        writes.assert_not_called()
        self.assertEqual(
            (self.radulator_home / "cron/jobs.json").read_bytes(),
            self.original_radulator_jobs,
        )

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

        restore_install(**self.kwargs())
        self.assertEqual((self.radulator_home / "cron" / "jobs.json").read_bytes(), self.original_radulator_jobs)
        self.assertEqual((self.default_home / "cron" / "jobs.json").read_bytes(), self.original_default_jobs)
        self.assertFalse((self.radulator_home / "skills" / "radulator-release-learning" / "SKILL.md").exists())
        self.assertFalse((self.radulator_home / "scripts" / "radulator_formspree_feedback_intake.py").exists())
        self.assertFalse((self.radulator_home / "scripts" / "release_promoter.py").exists())
        self.assertFalse((self.radulator_home / "scripts" / "release_promoter_cron.sh").exists())
        self.assertFalse((self.radulator_home / "scripts" / "trusted_publisher.py").exists())
        self.assertFalse((self.radulator_home / "scripts" / "trusted_publisher_cron.sh").exists())

    def test_verification_profile_write_failure_restores_both_job_files_exactly(self):
        result = apply_install(**self.kwargs())
        plan = build_plan(**self.kwargs())
        public_keys = generate_keys(plan)
        primary_path = (self.radulator_home / "cron" / "jobs.json").resolve()
        verification_path = (self.default_home / "cron" / "jobs.json").resolve()
        before = {
            primary_path: primary_path.read_bytes(),
            verification_path: verification_path.read_bytes(),
        }
        managed_ids = set(result["job_ids"].values())
        original_atomic_write = install_module._atomic_write
        verification_failed = False

        def fail_verification_enable(path, content, mode=0o600):
            nonlocal verification_failed
            path = Path(path)
            if path == verification_path and not verification_failed:
                payload = json.loads(content)
                jobs = payload["jobs"] if isinstance(payload, dict) else payload
                managed = [job for job in jobs if job.get("id") in managed_ids]
                if managed and any(job.get("enabled") is True for job in managed):
                    verification_failed = True
                    raise InstallError("synthetic verification-profile write failure")
            return original_atomic_write(path, content, mode)

        with mock.patch.object(
            install_module, "_atomic_write", side_effect=fail_verification_enable
        ):
            with self.assertRaisesRegex(
                InstallError, "synthetic verification-profile write failure"
            ):
                apply_install(
                    **self.kwargs(),
                    enable=True,
                    expected_public_keys=public_keys,
                    activation_test_runner=self.passing_activation_runner,
                )

        self.assertTrue(verification_failed)
        self.assertEqual(primary_path.read_bytes(), before[primary_path])
        self.assertEqual(verification_path.read_bytes(), before[verification_path])

    def test_job_snapshot_restore_failure_disables_and_reads_back_every_managed_job(self):
        result = apply_install(**self.kwargs())
        plan = build_plan(**self.kwargs())
        public_keys = generate_keys(plan)
        primary_path = (self.radulator_home / "cron" / "jobs.json").resolve()
        verification_path = (self.default_home / "cron" / "jobs.json").resolve()
        before_primary = primary_path.read_bytes()
        managed_ids = set(result["job_ids"].values())
        original_atomic_write = install_module._atomic_write
        verification_failed = False
        rollback_failed = False

        def fail_verification_then_primary_restore(path, content, mode=0o600):
            nonlocal verification_failed, rollback_failed
            path = Path(path)
            if path == verification_path and not verification_failed:
                payload = json.loads(content)
                jobs = payload["jobs"] if isinstance(payload, dict) else payload
                managed = [job for job in jobs if job.get("id") in managed_ids]
                if managed and any(job.get("enabled") is True for job in managed):
                    verification_failed = True
                    raise InstallError("synthetic verification-profile write failure")
            if (
                path == primary_path
                and verification_failed
                and not rollback_failed
                and content == before_primary
            ):
                rollback_failed = True
                raise InstallError("synthetic exact job rollback failure")
            return original_atomic_write(path, content, mode)

        with mock.patch.object(
            install_module,
            "_atomic_write",
            side_effect=fail_verification_then_primary_restore,
        ):
            with self.assertRaisesRegex(InstallError, "UNSAFE_JOB_STATE"):
                apply_install(
                    **self.kwargs(),
                    enable=True,
                    expected_public_keys=public_keys,
                    activation_test_runner=self.passing_activation_runner,
                )

        self.assertTrue(verification_failed)
        self.assertTrue(rollback_failed)
        observed_ids = set()
        for path in (primary_path, verification_path):
            payload = json.loads(path.read_text())
            jobs = payload["jobs"] if isinstance(payload, dict) else payload
            for job in jobs:
                if job.get("id") not in managed_ids:
                    continue
                observed_ids.add(job["id"])
                self.assertIs(job.get("enabled"), False)
                self.assertEqual(job.get("state"), "paused")
                self.assertIsNone(job.get("next_run_at"))
        self.assertEqual(observed_ids, managed_ids)

    def test_invalid_verification_profile_is_rejected_before_primary_job_write(self):
        apply_install(**self.kwargs())
        plan = build_plan(**self.kwargs())
        public_keys = generate_keys(plan)
        primary_path = self.radulator_home / "cron" / "jobs.json"
        verification_path = self.default_home / "cron" / "jobs.json"
        before_primary = primary_path.read_bytes()
        verification_path.write_text('{"jobs": "not-a-list"}\n')
        before_verification = verification_path.read_bytes()

        with self.assertRaisesRegex(InstallError, "Unsupported Hermes jobs.json shape"):
            apply_install(
                **self.kwargs(),
                enable=True,
                expected_public_keys=public_keys,
                activation_test_runner=self.passing_activation_runner,
            )

        self.assertEqual(primary_path.read_bytes(), before_primary)
        self.assertEqual(verification_path.read_bytes(), before_verification)

    def test_verification_failure_from_active_install_quiesces_every_managed_job(self):
        result = apply_install(**self.kwargs())
        plan = build_plan(**self.kwargs())
        public_keys = generate_keys(plan)
        apply_install(
            **self.kwargs(),
            enable=True,
            expected_public_keys=public_keys,
            activation_test_runner=self.passing_activation_runner,
        )
        mismatched = json.loads(json.dumps(public_keys))
        mismatched["radulator-verification-v1"]["profile"] = "wrong"

        with self.assertRaisesRegex(InstallError, "GitHub public-key"):
            apply_install(
                **self.kwargs(),
                enable=True,
                expected_public_keys=mismatched,
                activation_test_runner=self.passing_activation_runner,
            )

        managed_ids = set(result["job_ids"].values())
        observed_ids = set()
        for path in (
            self.radulator_home / "cron" / "jobs.json",
            self.default_home / "cron" / "jobs.json",
        ):
            payload = json.loads(path.read_text())
            jobs = payload["jobs"] if isinstance(payload, dict) else payload
            for job in jobs:
                if job.get("id") not in managed_ids:
                    continue
                observed_ids.add(job["id"])
                self.assertIs(job.get("enabled"), False)
                self.assertEqual(job.get("state"), "paused")
                self.assertIsNone(job.get("next_run_at"))
        self.assertEqual(observed_ids, managed_ids)

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

    def test_activation_rejects_repository_controlled_counterfeit_runtime(self):
        root = Path(self.temp.name)
        repo = root / "counterfeit-repository"
        repo.mkdir()
        self.write_counterfeit_runtime_modules(repo)
        plan = self.counterfeit_runtime_plan(repo)

        with mock.patch.dict(os.environ):
            os.environ.pop("PYTHONPATH", None)
            os.environ.pop("PYTHONHOME", None)
            with self.assertRaisesRegex(
                InstallError,
                "Installed Hermes runtime|PENDING_HERMES_RUNTIME",
            ):
                install_module._verify_broker_contract(plan)

    def test_activation_rejects_pythonpath_counterfeit_runtime(self):
        root = Path(self.temp.name)
        repo = root / "empty-repository"
        repo.mkdir()
        counterfeit = root / "counterfeit-pythonpath"
        self.write_counterfeit_runtime_modules(counterfeit)
        plan = self.counterfeit_runtime_plan(repo)

        with mock.patch.dict(
            os.environ,
            {"PYTHONPATH": str(counterfeit), "PYTHONHOME": ""},
        ):
            with self.assertRaisesRegex(
                InstallError,
                "Installed Hermes runtime|PENDING_HERMES_RUNTIME",
            ):
                install_module._verify_broker_contract(plan)

    def test_activation_probes_use_isolated_trusted_runtime_context(self):
        root = Path(self.temp.name)
        repo = root / "activation-repository"
        repo.mkdir()
        plan = self.counterfeit_runtime_plan(repo)
        observed = []

        def runner(command, **kwargs):
            observed.append((command, kwargs))
            return subprocess.CompletedProcess(command, 1, "", "missing runtime")

        with self.assertRaisesRegex(InstallError, "Installed Hermes runtime"):
            install_module._verify_broker_contract(plan, runner)

        command, invocation = observed[0]
        self.assertEqual(command[1], "-I")
        self.assertEqual(
            Path(invocation["cwd"]).resolve(),
            self.default_home.resolve(),
        )
        self.assertNotIn("PYTHONPATH", invocation["env"])
        self.assertNotIn("PYTHONHOME", invocation["env"])
        self.assertIn("__file__", command[-1])
        self.assertIn(str(self.default_home.resolve()), command[-1])

    def test_enable_requires_a_prior_disabled_first_publisher_install(self):
        plan = build_plan(**self.kwargs())
        public_keys = generate_keys(plan)

        with self.assertRaisesRegex(InstallError, "disabled-first"):
            apply_install(
                **self.kwargs(), enable=True, expected_public_keys=public_keys,
                activation_test_runner=self.passing_activation_runner,
            )

        self.assertFalse((self.radulator_home / "scripts" / "trusted_publisher.py").exists())

    def test_enable_requires_exact_installed_worker_security_boundary(self):
        plan = build_plan(**self.kwargs())
        apply_install(**self.kwargs())
        public_keys = generate_keys(plan)

        def runner(command, **_kwargs):
            rendered = " ".join(str(part) for part in command)
            if "kanban_worker_boundary" in rendered:
                return subprocess.CompletedProcess(command, 1, "", "missing boundary")
            output = "test-token" if "auth" in command and "token" in command else "passed"
            return subprocess.CompletedProcess(command, 0, output, "")

        with self.assertRaisesRegex(InstallError, "worker security boundary"):
            apply_install(
                **self.kwargs(), enable=True, expected_public_keys=public_keys,
                activation_test_runner=runner,
            )

    def test_enable_executes_worker_model_path_denial_canary(self):
        plan = build_plan(**self.kwargs())
        apply_install(**self.kwargs())
        public_keys = generate_keys(plan)
        observed = []

        def runner(command, **_kwargs):
            rendered = " ".join(str(part) for part in command)
            if "run_worker_model_path_denial_canary" in rendered:
                observed.append(rendered)
                return subprocess.CompletedProcess(
                    command, 1, "", "runtime canary entrypoint is unavailable"
                )
            output = "test-token" if "auth" in command and "token" in command else "passed"
            return subprocess.CompletedProcess(command, 0, output, "")

        with self.assertRaisesRegex(
            InstallError,
            "PENDING_HERMES_RUNTIME.*model-path denial canary",
        ):
            apply_install(
                **self.kwargs(), enable=True, expected_public_keys=public_keys,
                activation_test_runner=runner,
            )

        self.assertEqual(len(observed), 1)
        self.assertFalse(self.publisher_job()["enabled"])

    def test_enable_fails_when_model_path_canary_omits_any_required_denial(self):
        plan = build_plan(**self.kwargs())
        apply_install(**self.kwargs())
        public_keys = generate_keys(plan)
        with tempfile.TemporaryDirectory() as module_root:
            tools_dir = Path(module_root) / "tools"
            tools_dir.mkdir()
            (tools_dir / "__init__.py").write_text("")
            (tools_dir / "kanban_worker_boundary.py").write_text(
                "def run_worker_model_path_denial_canary():\n"
                "    return {\n"
                "        'contract': 'hermes.worker_model_path_denial_canary.v1',\n"
                "        'model_path_attempted': True,\n"
                "        'git_metadata_write_denied': True,\n"
                "        'github_credentials_absent': True,\n"
                "        'github_network_denied': True,\n"
                "    }\n"
            )

            def runner(command, **_kwargs):
                rendered = " ".join(str(part) for part in command)
                if "run_worker_model_path_denial_canary" in rendered:
                    env = dict(os.environ)
                    env["PYTHONPATH"] = module_root
                    return subprocess.run(
                        [sys.executable, *command[1:]],
                        cwd=self.repo,
                        env=env,
                        check=False,
                        capture_output=True,
                        text=True,
                    )
                output = "test-token" if "auth" in command and "token" in command else "passed"
                return subprocess.CompletedProcess(command, 0, output, "")

            with self.assertRaisesRegex(
                InstallError,
                "PENDING_HERMES_RUNTIME.*model-path denial canary",
            ):
                apply_install(
                    **self.kwargs(),
                    enable=True,
                    expected_public_keys=public_keys,
                    activation_test_runner=runner,
                )

        self.assertFalse(self.publisher_job()["enabled"])

    def test_enable_requires_durable_publisher_authority_cas_runtime(self):
        plan = build_plan(**self.kwargs())
        apply_install(**self.kwargs())
        public_keys = generate_keys(plan)

        def runner(command, **_kwargs):
            rendered = " ".join(str(part) for part in command)
            if "claim_trusted_publisher_authority" in rendered:
                return subprocess.CompletedProcess(
                    command, 1, "", "authority API unavailable"
                )
            output = "test-token" if "auth" in command and "token" in command else "passed"
            return subprocess.CompletedProcess(command, 0, output, "")

        with self.assertRaisesRegex(
            InstallError,
            "PENDING_HERMES_RUNTIME.*authority claim/CAS",
        ):
            apply_install(
                **self.kwargs(), enable=True, expected_public_keys=public_keys,
                activation_test_runner=runner,
            )

        self.assertFalse(self.publisher_job()["enabled"])

    def test_enable_executes_semantic_authority_cas_canary_not_callable_probe(self):
        plan = build_plan(**self.kwargs())
        apply_install(**self.kwargs())
        public_keys = generate_keys(plan)
        observed = []

        def runner(command, **_kwargs):
            rendered = " ".join(str(part) for part in command)
            if "run_trusted_publisher_authority_semantic_canary" in rendered:
                observed.append(rendered)
                return subprocess.CompletedProcess(
                    command, 1, "", "semantic CAS canary unavailable"
                )
            output = "test-token" if "auth" in command and "token" in command else "passed"
            return subprocess.CompletedProcess(command, 0, output, "")

        with self.assertRaisesRegex(
            InstallError,
            "PENDING_HERMES_RUNTIME.*semantic authority claim/CAS",
        ):
            apply_install(
                **self.kwargs(),
                enable=True,
                expected_public_keys=public_keys,
                activation_test_runner=runner,
            )

        self.assertEqual(len(observed), 1)
        self.assertFalse(self.publisher_job()["enabled"])

    def test_enable_requires_host_github_auth_without_printing_token(self):
        plan = build_plan(**self.kwargs())
        apply_install(**self.kwargs())
        public_keys = generate_keys(plan)

        def runner(command, **_kwargs):
            if "auth" in command and "token" in command:
                return subprocess.CompletedProcess(command, 1, "", "not logged in")
            return subprocess.CompletedProcess(command, 0, "passed", "")

        with self.assertRaisesRegex(InstallError, "publisher GitHub authentication"):
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
            if any(
                marker in str(part)
                for part in command
                for marker in (
                    "kanban_git_broker",
                    "kanban_worker_boundary",
                    "claim_trusted_publisher_authority",
                )
            ):
                return subprocess.CompletedProcess(command, 0, "", "")
            if "auth" in command and "token" in command:
                return subprocess.CompletedProcess(command, 0, "test-token", "")
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
