#!/usr/bin/env node
/**
 * Fail closed before local macOS Playwright/Vite launches when IPv4 TIME_WAIT
 * pressure is unsafe. CI and non-macOS local environments retain their existing
 * behavior. Deterministic tests may provide both fixture environment variables.
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const PASSED_ENV = "RADULATOR_SOCKET_GUARD_PASSED";
const NETSTAT_ENV = "RADULATOR_SOCKET_GUARD_NETSTAT_FILE";
const SYSCTL_ENV = "RADULATOR_SOCKET_GUARD_SYSCTL_FILE";
const GUARD_SCRIPT = fileURLToPath(
  new URL("./playwright_socket_guard.py", import.meta.url),
);

export function runLocalSocketGuard({
  env = process.env,
  platform = process.platform,
} = {}) {
  if (env.CI || env[PASSED_ENV] === "1") return 0;

  const netstatFixture = env[NETSTAT_ENV];
  const sysctlFixture = env[SYSCTL_ENV];
  if (Boolean(netstatFixture) !== Boolean(sysctlFixture)) {
    console.error(
      `${NETSTAT_ENV} and ${SYSCTL_ENV} must be provided together.`,
    );
    return 2;
  }

  // Fixture mode keeps the fail-before-launch behavior testable on Linux CI.
  if (platform !== "darwin" && !netstatFixture) return 0;

  const args = [GUARD_SCRIPT, "--assert-safe", "--json"];
  if (netstatFixture) {
    args.push("--netstat-file", netstatFixture, "--sysctl-file", sysctlFixture);
  } else {
    args.push("--samples", "2", "--interval", "15");
  }
  const result = spawnSync("python3", args, { env, stdio: "inherit" });
  if (result.error) {
    console.error(`Unable to run the local socket guard: ${result.error.message}`);
    return 1;
  }
  if (result.signal) {
    console.error(`Local socket guard terminated by ${result.signal}.`);
    return 1;
  }
  const status = result.status ?? 1;
  if (status === 0) env[PASSED_ENV] = "1";
  return status;
}

export function enforceLocalSocketGuard(options) {
  const status = runLocalSocketGuard(options);
  if (status !== 0) process.exit(status);
}

export function enforceLocalPlaywrightWorkerLimit({
  argv = process.argv.slice(2),
  env = process.env,
  maxWorkers = 2,
} = {}) {
  if (env.CI) return;

  let requestedWorkers;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--workers" || argument === "-j") {
      requestedWorkers = argv[index + 1];
      index += 1;
    } else if (argument.startsWith("--workers=")) {
      requestedWorkers = argument.slice("--workers=".length);
    } else if (/^-j=?\S+/.test(argument)) {
      requestedWorkers = argument.replace(/^-j=?/, "");
    }
  }
  if (requestedWorkers === undefined) return;

  const numericWorkers = /^\d+$/.test(requestedWorkers)
    ? Number(requestedWorkers)
    : Number.NaN;
  if (numericWorkers >= 1 && numericWorkers <= maxWorkers) return;

  console.error(
    `Local Playwright workers are capped at ${maxWorkers}; received --workers=${requestedWorkers}.`,
  );
  process.exit(2);
}

function runCommand(argv) {
  const command = argv[0] === "--" ? argv.slice(1) : argv;
  if (command.length === 0) {
    console.error("usage: node scripts/local-socket-guard.mjs -- <command> [args...]");
    return 2;
  }

  const guardStatus = runLocalSocketGuard();
  if (guardStatus !== 0) return guardStatus;

  const result = spawnSync(command[0], command.slice(1), {
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) {
    console.error(`Unable to launch ${command[0]}: ${result.error.message}`);
    return result.error.code === "ENOENT" ? 127 : 1;
  }
  if (result.signal) {
    console.error(`${command[0]} terminated by ${result.signal}.`);
    return 1;
  }
  return result.status ?? 1;
}

const isMain = process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exitCode = runCommand(process.argv.slice(2));
