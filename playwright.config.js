import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright Configuration for Radulator Medical Calculator Testing
 * @see https://playwright.dev/docs/test-configuration
 */

const isCI = !!process.env.CI;

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
    baseURL: isCI ? "http://localhost:4173" : "http://localhost:5173",

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

    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },

    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },

    /* Test against mobile viewports. */
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 12"] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: isCI ? "npm run preview" : "npm run dev",
    url: isCI ? "http://localhost:4173" : "http://localhost:5173",
    reuseExistingServer: !isCI,
    timeout: 120000,
  },
});
