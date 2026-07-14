#!/usr/bin/env node
import { spawn } from "node:child_process";
import process from "node:process";

const env = {
  ...process.env,
  RADULATOR_RELEASE_VERSION:
    process.env.RADULATOR_RELEASE_VERSION || "0.0.0-local-institutional-test",
  RADULATOR_INSTITUTIONAL_ORIGIN:
    process.env.RADULATOR_INSTITUTIONAL_ORIGIN || "http://127.0.0.1:4173",
  RADULATOR_MANAGED_PREVIEW: "true",
};

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
      env,
      ...options,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}

function waitForPreview(origin, timeoutMs = 60000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const response = await fetch(origin, { method: "HEAD" });
        if (response.ok) {
          resolve();
          return;
        }
      } catch {
        // Retry until timeout.
      }
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error(`Timed out waiting for ${origin}`));
        return;
      }
      setTimeout(tick, 500);
    };
    tick();
  });
}

let preview;
try {
  await run("npm", ["run", "build:institutional"], { env });

  preview = spawn(
    "npx",
    [
      "vite",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      "4173",
      "--strictPort",
      "--outDir",
      "dist-institutional",
    ],
    { stdio: "inherit", env },
  );
  preview.on("error", (error) => {
    throw error;
  });

  await waitForPreview(env.RADULATOR_INSTITUTIONAL_ORIGIN);
  await run(
    "npx",
    [
      "playwright",
      "test",
      "tests/e2e/institutional-network.spec.js",
      "--project=chromium",
    ],
    { env },
  );
} finally {
  if (preview && !preview.killed) {
    preview.kill("SIGTERM");
  }
}
