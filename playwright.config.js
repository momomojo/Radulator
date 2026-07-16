import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright Configuration for Radulator Medical Calculator Testing
 * @see https://playwright.dev/docs/test-configuration
 */

const isCI = !!process.env.CI;
const isLocalSmokeScript = process.env.npm_lifecycle_event === "test:smoke";
const institutionalOrigin = process.env.RADULATOR_INSTITUTIONAL_ORIGIN || "";
const managedPreviewServer = process.env.RADULATOR_MANAGED_PREVIEW === "true";
// CI and npm-run local smoke both build first, then serve dist through preview.
const usePreviewServer = isCI || isLocalSmokeScript || Boolean(institutionalOrigin);
const baseURL = institutionalOrigin
  || (usePreviewServer ? "http://localhost:4173" : "http://localhost:5173");

export default defineConfig({
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

  ...(managedPreviewServer
    ? {}
    : {
        /* Run your local dev server before starting the tests */
        webServer: {
          command: usePreviewServer ? "npm run preview" : "npm run dev",
          url: baseURL,
          reuseExistingServer: !isCI,
          timeout: 120000,
        },
      }),
});
