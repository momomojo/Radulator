import json
import stat
import tempfile
import unittest
from pathlib import Path

from ops.hermes.radulator.install import (
    InstallError,
    apply_install,
    build_plan,
    generate_keys,
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
                "model: openai-codex/gpt-5.6-sol\nagent:\n  reasoning_effort: xhigh\ncron:\n  max_parallel_runs: 1\n"
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

    def tearDown(self):
        self.temp.cleanup()

    def kwargs(self):
        return {
            "repo": self.repo,
            "radulator_home": self.radulator_home,
            "default_home": self.default_home,
        }

    def test_dry_plan_is_read_only_and_uses_profile_level_xhigh(self):
        plan = build_plan(**self.kwargs())
        self.assertEqual(plan["schema"], "radulator-hermes-install/v1")
        self.assertEqual(len(plan["jobs"]), 4)
        self.assertFalse((self.radulator_home / "state" / "radulator-release-control.json").exists())
        for job in plan["jobs"]:
            self.assertEqual(job["workdir"], str(self.repo))
            self.assertEqual(job["model"], "gpt-5.6-sol")
            self.assertEqual(job["provider"], "openai-codex")
            self.assertNotIn("effort", job)
            self.assertNotIn("reasoning_effort", job)
            self.assertFalse(job["enabled"])

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
        managed = [job for job in [*radulator_jobs, *default_jobs] if job["name"].startswith("radulator-clinical-") or job["name"].startswith("radulator-release-")]
        self.assertEqual(len(managed), 4)
        self.assertTrue(all(job["enabled"] is False for job in managed))
        legacy = [job for job in [*radulator_jobs, *default_jobs] if job["name"] in {"pr-gate-poller", "judge-queue"}]
        self.assertEqual(len(legacy), 2)
        self.assertTrue(all(job["enabled"] is True for job in legacy))
        self.assertEqual(len({job["id"] for job in managed}), 4)
        self.assertTrue((self.radulator_home / "skills" / "radulator-clinical-judge" / "SKILL.md").exists())
        self.assertTrue((self.default_home / "skills" / "radulator-clinical-judge" / "SKILL.md").exists())

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

    def test_enable_then_restore_recovers_original_files(self):
        result = apply_install(**self.kwargs())
        apply_install(**self.kwargs(), enable=True)
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
        apply_install(**self.kwargs(), enable=True)
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
        for key in ("primary_private", "verification_private"):
            mode = Path(plan["keys"][key]).stat().st_mode
            self.assertEqual(stat.S_IMODE(mode), 0o600)


if __name__ == "__main__":
    unittest.main()
