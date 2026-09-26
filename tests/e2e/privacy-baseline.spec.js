import { test, expect } from "@playwright/test";
import { existsSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";

const CANARIES = {
  search: "PATIENT-NOT-REAL-SEARCH-CANARY",
  input: "PATIENT-NOT-REAL-INPUT-CANARY",
  result: "PATIENT-NOT-REAL-RESULT-CANARY",
  url: "PATIENT-NOT-REAL-URL-CANARY",
  error: "SYNTHETIC-RAW-ERROR-CANARY",
};
const CANARY_VALUES = Object.values(CANARIES);
const TELEMETRY_URL =
  /googletagmanager|google-analytics|analytics\.google|collect\?|gtag|sentry|bugsnag|rollbar|datadog|telemetry|diagnostic|beacon/i;
const STATIC_RESOURCE_TYPES = new Set([
  "document",
  "stylesheet",
  "script",
  "image",
  "font",
  "manifest",
  "media",
  "texttrack",
]);

function containsCanary(record) {
  return CANARY_VALUES.some((canary) =>
    `${record.url}\n${record.postData}`.includes(canary),
  );
}

function isBuiltStaticResource(url) {
  const parsed = new URL(url);
  if (parsed.search) return false;
  const artifactRoot = resolve("dist");
  const path = resolve(artifactRoot, `.${decodeURIComponent(parsed.pathname)}`);
  return path.startsWith(`${artifactRoot}${sep}`) && existsSync(path) && statSync(path).isFile();
}

function unauthorizedCanaryRequests(records) {
  // Calculations have no legitimate dynamic transport, even when a payload is
  // encoded or contains ordinary numbers instead of the named string canaries.
  return records.filter((record) => !record.initialNavigation && (
    containsCanary(record) || record.method !== "GET" ||
    !STATIC_RESOURCE_TYPES.has(record.resourceType) || record.external === true ||
    record.resourceType === "document" || !isBuiltStaticResource(record.url)
  ));
}

function assertNoUnauthorizedCanaryRequests(records) {
  expect(unauthorizedCanaryRequests(records)).toEqual([]);
}

test.describe("Privacy baseline containment", () => {
  // The ordinary local runner serves Vite source modules, not the published
  // artifact. Keep this contract production-only instead of weakening its
  // transport allowlist. Required CI and test:privacy use the preview build.
  test.skip(({ baseURL }) => new URL(baseURL).port === "5173",
    "Production artifact containment: run npm run test:privacy. Dev React errors are covered by test:privacy:errors.");

  test("detects an input-bearing POST even without a named canary", () => {
    expect(() => assertNoUnauthorizedCanaryRequests([{
      initialNavigation: false,
      method: "POST",
      resourceType: "fetch",
      url: "https://example.test/ordinary-endpoint",
      postData: JSON.stringify({ length: 4, height: 3, width: 4, psa: 6, result: 25.0 }),
    }])).toThrow();
  });

  test("detects input-bearing image requests with numeric values in a URL", () => {
    for (const url of ["https://example.test/favicon.ico?result=25", "https://example.test/result/25.png"]) {
      expect(() => assertNoUnauthorizedCanaryRequests([{
        initialNavigation: false, method: "GET", resourceType: "image", url, postData: "",
      }])).toThrow();
    }
  });

  test("keeps calculator behavior local without analytics or diagnostic transport", async ({
    page,
    browserName,
  }) => {
    const requests = [];
    let initialNavigationSeen = false;
    let negativeControlAborted = false;
    const consoleMessages = [];
    await page.route("**/*", async (route) => {
      const request = route.request();
      const initialNavigation =
        request.isNavigationRequest() &&
        request.resourceType() === "document" &&
        request.method() === "GET" &&
        !initialNavigationSeen;
      initialNavigationSeen ||= initialNavigation;
      const record = {
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        postData: request.postData() || "",
        initialNavigation,
        external: new URL(request.url()).origin !== new URL(test.info().project.use.baseURL).origin,
      };
      requests.push(record);

      const isStaticRequest =
        request.method() === "GET" &&
        STATIC_RESOURCE_TYPES.has(request.resourceType());
      if (!isStaticRequest || record.external || TELEMETRY_URL.test(record.url) ||
          unauthorizedCanaryRequests([record]).length > 0) {
        if (request.url().endsWith("/privacy-negative-control")) {
          negativeControlAborted = true;
        }
        await route.abort();
        return;
      }
      await route.continue();
    });
    page.on("console", (message) =>
      consoleMessages.push(`${message.type()}: ${message.text()}`),
    );

    await page.goto("/?privacy_case=synthetic");
    await expect(
      page.getByRole("heading", { name: "Radulator", level: 1 }).first(),
    ).toBeVisible();
    expect(new URL(page.url()).search).toBe("?privacy_case=synthetic");

    await page.evaluate((canary) => {
      window.history.replaceState(
        null,
        "",
        `/?privacy_case=synthetic#/${canary}`,
      );
    }, CANARIES.url);
    expect(page.url()).toContain(CANARIES.url);

    const search = page.locator("#calculator-search");
    await search.fill(CANARIES.input);
    await page.waitForTimeout(650);
    await search.fill(CANARIES.search);
    await page.waitForTimeout(650);
    await search.fill("prostate");
    await expect(
      page.getByRole("button", {
        name: "Prostate Volume & PSA Density",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: "Prostate Volume & PSA Density",
        exact: true,
      })
      .click();

    await expect(page.getByTestId("calculator-title").first()).toContainText(
      "Prostate Volume & PSA Density",
    );
    await page.fill('input[id="length"]', "4");
    await page.fill('input[id="height"]', "3");
    await page.fill('input[id="width"]', "4");
    await page.fill('input[id="psa"]', "6");
    await page.getByRole("button", { name: "Calculate", exact: true }).click();

    const results = page.getByRole("status", { name: "Calculator results" });
    await expect(results).toContainText("Prostate Volume (mL): 25.0");
    await expect(
      page.getByRole("button", { name: "Copy results" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Print Results" }),
    ).toBeVisible();

    if (browserName === "chromium") {
      await page.context().grantPermissions([
        "clipboard-read",
        "clipboard-write",
      ]);
      await page.getByRole("button", { name: "Copy results" }).click();
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      expect(copied).toContain("Prostate Volume (mL): 25.0");
    }
    await page.getByRole("button", { name: "Print Results" }).click();

    const currentUrl = new URL(page.url());
    expect(currentUrl.hash).toBe("#/prostate-volume");
    for (const canary of CANARY_VALUES) {
      expect(page.url()).not.toContain(canary);
    }
    const resultText = await results.textContent();
    for (const canary of CANARY_VALUES) {
      expect(resultText).not.toContain(canary);
    }

    const preNegativeControlRequests = requests.slice();
    assertNoUnauthorizedCanaryRequests(preNegativeControlRequests);
    expect(
      requests.filter((request) => TELEMETRY_URL.test(request.url)),
    ).toEqual([]);
    const loadedResources = await page.evaluate(() =>
      performance.getEntriesByType("resource").map((entry) => entry.name),
    );
    expect(loadedResources.filter((url) => TELEMETRY_URL.test(url))).toEqual([]);
    expect(
      consoleMessages.filter((message) => CANARY_VALUES.some((canary) => message.includes(canary))),
    ).toEqual([]);
    expect(consoleMessages.filter((message) => /GA4|gtag|analytics/i.test(message))).toEqual([]);

    const negativeControlBody = JSON.stringify({
      search: CANARIES.search,
      input: CANARIES.input,
      result: CANARIES.result,
      url: CANARIES.url,
      error: CANARIES.error,
    });
    await page.evaluate(async (body) => {
      try {
        await fetch("/privacy-negative-control", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        });
      } catch {
        // The route interceptor must abort this deliberate transport.
      }
    }, negativeControlBody);

    const negativeControlRequest = requests.find(
      (request) =>
        request.url.endsWith("/privacy-negative-control") &&
        request.method === "POST",
    );
    expect(negativeControlRequest).toBeDefined();
    expect(negativeControlRequest.postData).toContain(CANARIES.error);
    expect(negativeControlAborted).toBe(true);
    expect(() => assertNoUnauthorizedCanaryRequests(requests)).toThrow();
  });

  for (const path of ["/", "/calculators/tirads/"]) {
    test(`redacts real render and compute failures after loading ${path}`, async ({ page }) => {
      const messages = [];
      const transports = [];
      let initialNavigationSeen = false;
      page.on("console", (message) => messages.push(message.text()));
      page.on("pageerror", (error) => messages.push(error.message));
      await page.route("**/*", async (route) => {
        const request = route.request();
        const initialNavigation = request.isNavigationRequest() &&
          request.resourceType() === "document" && request.method() === "GET" && !initialNavigationSeen;
        initialNavigationSeen ||= initialNavigation;
        const record = {
          url: request.url(), method: request.method(), resourceType: request.resourceType(),
          postData: request.postData() || "", initialNavigation,
          external: new URL(request.url()).origin !== new URL(test.info().project.use.baseURL).origin,
        };
        if (record.external || TELEMETRY_URL.test(record.url) || unauthorizedCanaryRequests([record]).length > 0) {
          transports.push(record);
          await route.abort();
        } else {
          await route.continue();
        }
      });
      await page.goto(`${path}?__radulator_boundary_test=1`);
      await page.getByRole("button", { name: "Boundary Recovers On Retry", exact: true }).click();
      await expect(page.getByRole("alert").filter({ hasText: "unexpected error" })).toBeVisible();
      await expect(page.locator("#calculator-navigation")).toBeVisible();
      await expect.poll(() => messages.includes("RADULATOR_RENDER_ERROR")).toBe(true);
      await page.evaluate(() => { window.__RADULATOR_TEST_SHOULD_THROW_ON_RETRY_CALC__ = false; });
      await page.getByRole("button", { name: "Try again", exact: true }).click();
      await expect(page.getByText("Recovered test calculator panel")).toBeVisible();

      await page.getByRole("button", { name: "Compute Throws On Calculate", exact: true }).click();
      await page.getByRole("button", { name: "Calculate", exact: true }).click();
      await expect(page.getByRole("alert").filter({ hasText: "could not finish the calculation" })).toBeVisible();
      expect(messages.filter((message) => /Boundary test render error|Persistent boundary test render error|Synthetic compute error/.test(message))).toEqual([]);
      expect(transports).toEqual([]);
    });
  }
});
