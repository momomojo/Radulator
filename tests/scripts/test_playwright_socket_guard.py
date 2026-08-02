#!/usr/bin/env python3
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts"
FIXTURES = ROOT / "tests" / "fixtures" / "playwright-socket-guard"
GUARD_PATH = SCRIPTS / "playwright_socket_guard.py"
LAUNCHER_PATH = SCRIPTS / "local-socket-guard.mjs"
SYSCTL_PATH = FIXTURES / "sysctl.txt"
HEALTHY_PATH = FIXTURES / "healthy.netstat"

SPEC = importlib.util.spec_from_file_location("playwright_socket_guard", GUARD_PATH)
assert SPEC is not None
assert SPEC.loader is not None
guard = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = guard
SPEC.loader.exec_module(guard)
SYSCTL = SYSCTL_PATH.read_text()


def rows(count: int, peer: str = "127.0.0.1.5173") -> str:
    return "\n".join(
        f"tcp4 0 0 127.0.0.1.{50000 + index} {peer} TIME_WAIT"
        for index in range(count)
    )


def fixture_environment(netstat_path: Path, *, ci: bool = False) -> dict[str, str]:
    env = os.environ.copy()
    env.pop("CI", None)
    env.pop("RADULATOR_SOCKET_GUARD_PASSED", None)
    env["RADULATOR_SOCKET_GUARD_NETSTAT_FILE"] = str(netstat_path)
    env["RADULATOR_SOCKET_GUARD_SYSCTL_FILE"] = str(SYSCTL_PATH)
    if ci:
        env["CI"] = "true"
    return env


def marker_command(marker: Path) -> list[str]:
    return [
        sys.executable,
        "-c",
        "from pathlib import Path; import sys; Path(sys.argv[1]).write_text('started')",
        str(marker),
    ]


class SocketGuardTests(unittest.TestCase):
    def test_parse_and_assess_healthy_snapshot(self) -> None:
        snapshot = guard.make_snapshot(rows(1), SYSCTL)
        self.assertEqual(snapshot.ipv4_time_wait, 1)
        self.assertEqual(snapshot.top_ipv4_time_wait_peer, "127.0.0.1.5173")
        self.assertEqual(guard.assess(snapshot, 0.60, 0.75)[0], "ok")

    def test_top_peer_threshold_catches_local_playwright_pattern(self) -> None:
        snapshot = guard.make_snapshot(rows(12_300), SYSCTL)
        status, reasons = guard.assess(snapshot, 0.60, 0.75)
        self.assertEqual(status, "critical")
        self.assertTrue(any("top peer" in reason for reason in reasons))

    def test_guard_cli_returns_75_for_deterministic_critical_fixture(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            critical_path = Path(directory) / "critical.netstat"
            critical_path.write_text(rows(12_300))
            result = subprocess.run(
                [
                    sys.executable,
                    str(GUARD_PATH),
                    "--netstat-file",
                    str(critical_path),
                    "--sysctl-file",
                    str(SYSCTL_PATH),
                    "--assert-safe",
                    "--json",
                ],
                capture_output=True,
                text=True,
                check=False,
            )
        self.assertEqual(result.returncode, 75)
        self.assertEqual(json.loads(result.stdout)["status"], "critical")

    def test_guarded_entrypoint_blocks_before_command_launch_with_exit_75(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            temp = Path(directory)
            critical_path = temp / "critical.netstat"
            marker = temp / "launched"
            critical_path.write_text(rows(12_300))
            result = subprocess.run(
                ["node", str(LAUNCHER_PATH), "--", *marker_command(marker)],
                env=fixture_environment(critical_path),
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 75)
            self.assertFalse(marker.exists(), "guarded command must not launch")
            self.assertEqual(json.loads(result.stdout)["status"], "critical")

    def test_guarded_entrypoint_launches_command_for_healthy_fixture(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            marker = Path(directory) / "launched"
            result = subprocess.run(
                ["node", str(LAUNCHER_PATH), "--", *marker_command(marker)],
                env=fixture_environment(HEALTHY_PATH),
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(marker.read_text(), "started")
            self.assertEqual(json.loads(result.stdout)["status"], "ok")

    def test_ci_bypasses_local_guard_without_changing_ci_launch_behavior(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            temp = Path(directory)
            critical_path = temp / "critical.netstat"
            marker = temp / "launched"
            critical_path.write_text(rows(12_300))
            result = subprocess.run(
                ["node", str(LAUNCHER_PATH), "--", *marker_command(marker)],
                env=fixture_environment(critical_path, ci=True),
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(marker.read_text(), "started")
            self.assertEqual(result.stdout, "")

    def test_direct_playwright_config_load_blocks_critical_fixture_with_75(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            critical_path = Path(directory) / "critical.netstat"
            critical_path.write_text(rows(12_300))
            config_url = (ROOT / "playwright.config.js").as_uri()
            result = subprocess.run(
                ["node", "--input-type=module", "-e", f"await import({json.dumps(config_url)})"],
                cwd=ROOT,
                env=fixture_environment(critical_path),
                capture_output=True,
                text=True,
                check=False,
            )
        self.assertEqual(result.returncode, 75, result.stderr)
        self.assertEqual(json.loads(result.stdout)["status"], "critical")

    def test_direct_vite_serve_config_blocks_critical_fixture_with_75(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            critical_path = Path(directory) / "critical.netstat"
            critical_path.write_text(rows(12_300))
            config_url = (ROOT / "vite.config.js").as_uri()
            expression = (
                f"const factory=(await import({json.dumps(config_url)})).default;"
                "factory({command:'serve', mode:'development'});"
            )
            result = subprocess.run(
                ["node", "--input-type=module", "-e", expression],
                cwd=ROOT,
                env=fixture_environment(critical_path),
                capture_output=True,
                text=True,
                check=False,
            )
        self.assertEqual(result.returncode, 75, result.stderr)
        self.assertEqual(json.loads(result.stdout)["status"], "critical")

    def test_playwright_workers_are_local_2_and_ci_4_in_both_configs(self) -> None:
        for filename in ("playwright.config.js", "playwright.nightly.config.js"):
            config_url = (ROOT / filename).as_uri()
            expression = (
                f"const config=(await import({json.dumps(config_url)})).default;"
                "console.log(config.workers);"
            )
            for ci, expected in ((False, "2"), (True, "4")):
                env = os.environ.copy()
                env.pop("CI", None)
                env["RADULATOR_SOCKET_GUARD_PASSED"] = "1"
                if ci:
                    env["CI"] = "true"
                result = subprocess.run(
                    ["node", "--input-type=module", "-e", expression],
                    cwd=ROOT,
                    env=env,
                    capture_output=True,
                    text=True,
                    check=False,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stdout.strip(), expected, f"{filename} CI={ci}")

    def test_local_worker_override_above_2_is_rejected_but_ci_override_is_not(self) -> None:
        config_url = (ROOT / "playwright.config.js").as_uri()
        expression = (
            "process.argv=['node','playwright','test','--workers=3'];"
            f"const config=(await import({json.dumps(config_url)})).default;"
            "console.log(config.workers);"
        )
        local_env = os.environ.copy()
        local_env.pop("CI", None)
        local_env["RADULATOR_SOCKET_GUARD_PASSED"] = "1"
        local_result = subprocess.run(
            ["node", "--input-type=module", "-e", expression],
            cwd=ROOT,
            env=local_env,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(local_result.returncode, 2)
        self.assertIn("capped at 2", local_result.stderr)

        ci_env = {**local_env, "CI": "true"}
        ci_result = subprocess.run(
            ["node", "--input-type=module", "-e", expression],
            cwd=ROOT,
            env=ci_env,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(ci_result.returncode, 0, ci_result.stderr)
        self.assertEqual(ci_result.stdout.strip(), "4")

    def test_local_vite_and_playwright_package_entrypoints_are_guarded(self) -> None:
        scripts = json.loads((ROOT / "package.json").read_text())["scripts"]
        guarded_entries = (
            "dev",
            "preview",
            "test",
            "test:headed",
            "test:debug",
            "test:ui",
            "test:report",
            "test:smoke",
            "test:calculator",
            "test:chromium",
            "test:firefox",
            "test:webkit",
            "test:mobile",
            "proof:feature",
        )
        launcher = "node scripts/local-socket-guard.mjs --"
        for entry in guarded_entries:
            self.assertIn(launcher, scripts[entry], entry)


if __name__ == "__main__":
    unittest.main()
