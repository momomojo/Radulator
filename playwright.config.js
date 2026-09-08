import { defineConfig, devices } from "@playwright/test";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

/**
 * Playwright Configuration for Radulator Medical Calculator Testing
 * @see https://playwright.dev/docs/test-configuration
 */

const isCI = !!process.env.CI;
const isLocalSmokeScript = process.env.npm_lifecycle_event === "test:smoke";
// CI and npm-run local smoke both build first, then serve dist through preview.
const usePreviewServer = isCI || isLocalSmokeScript || process.env.RADULATOR_QA_PREVIEW === "1";
const root = fileURLToPath(new URL(".", import.meta.url));
// Stable per worktree; a collision fails closed instead of silently switching ports.
const localPort = 20000 + createHash("sha256").update(root).digest().readUInt16BE(0) % 30000;
const port = process.env.RADULATOR_QA_PORT ?? String(isCI ? 4173 : localPort);
if (!/^[1-9]\d{0,4}$/.test(port) || Number(port) > 65535) {
  throw new Error("RADULATOR_QA_PORT must be an integer port from 1 to 65535.");
}
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  metadata: { serverMode: usePreviewServer ? "preview" : "dev" },
  testDir: "./tests/e2e",

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: isCI,

  /* Retry on CI only */
  retries: isCI ? 1 : 0,

  /* Use multiple workers in CI for speed */
  workers: isCI ? 4 : undefined,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ["html", { open: "never" }],
    ["list"],
    ["json", { outputFile: "test-results/results.json" }],
  ],

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",

    /* Screenshot on failure */
    screenshot: "only-on-failure",

    /* Video on failure */
    video: "retain-on-failure",

    /* Maximum time each action such as `click()` can take - longer in CI */
    actionTimeout: isCI ? 30000 : 10000,

    /* Navigation timeout */
    navigationTimeout: isCI ? 30000 : 15000,
  },

  /* Global test timeout */
  timeout: isCI ? 60000 : 30000,

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Other browsers moved to playwright.nightly.config.js
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: `npm run ${usePreviewServer ? "preview" : "dev"} -- --host 127.0.0.1 --port ${port} --strictPort`,
    cwd: root,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
