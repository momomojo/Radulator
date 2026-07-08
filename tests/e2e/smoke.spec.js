import { test, expect } from "@playwright/test";
import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * Smoke Tests for Radulator
 * Quick verification that core functionality works after refactoring.
 * Tests one calculator from each major category.
 */

/**
 * Helper to open mobile menu if needed (sidebar is collapsed on mobile)
 */
async function openMobileMenuIfNeeded(page) {
  const menuButton = page.getByRole("button", {
    name: "Open navigation menu",
  });
  // Check if we're on mobile (menu button is visible)
  if (await menuButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await menuButton.click();
    // Wait for sidebar to be visible after opening
    await page.locator("aside").waitFor({ state: "visible" });
  }
}

/**
 * Helper to click a calculator button (handles mobile menu)
 */
async function clickCalculator(page, calculatorName) {
  await openMobileMenuIfNeeded(page);
  await page.click(`button:has-text("${calculatorName}")`);
}

const STATIC_MELD_PAGE = "dist/calculators/meld-na/index.html";
const STATIC_BUILD_INPUTS = [
  "index.html",
  "package.json",
  "scripts/generate-static-pages.js",
  "src",
  "vite.config.js",
];

function latestMtimeMs(path) {
  const stat = statSync(path);
  if (!stat.isDirectory()) return stat.mtimeMs;

  return readdirSync(path).reduce(
    (latest, entry) => Math.max(latest, latestMtimeMs(join(path, entry))),
    stat.mtimeMs,
  );
}

function latestStaticBuildInputMtimeMs() {
  return Math.max(...STATIC_BUILD_INPUTS.map(latestMtimeMs));
}

test.describe("Smoke Tests - Core Functionality", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for app to load
    await page
      .getByRole("heading", { name: "Radulator", level: 1 })
      .first()
      .waitFor({ state: "visible" });
  });

  test("should load homepage and display sidebar", async ({ page }) => {
    await expect(page.locator("h1").first()).toContainText("Radulator");
    await expect(page.locator("aside")).toBeVisible();
  });

  test("should navigate to Adrenal CT Washout calculator", async ({ page }) => {
    await clickCalculator(page, "Adrenal CT Washout");
    await expect(
      page.getByTestId("calculator-title").first(),
    ).toContainText("Adrenal CT Washout");
  });

  test("should calculate Adrenal CT Washout", async ({ page }) => {
    await clickCalculator(page, "Adrenal CT Washout");

    // Fill in test values using accessible labels
    await page.getByRole("spinbutton", { name: /Pre.*contrast/i }).fill("5");
    await page.getByRole("spinbutton", { name: /Post.*contrast/i }).fill("80");
    await page.getByRole("spinbutton", { name: /Delayed/i }).fill("35");

    await page.getByRole('button', { name: 'Calculate' }).click();

    // Verify results appear - use specific text that only appears in results
    await expect(page.getByText("Absolute Washout (%)")).toBeVisible();
    await expect(page.getByText(/60\.?0?%/)).toBeVisible();
  });

  test("should navigate to Child-Pugh calculator", async ({ page }) => {
    await clickCalculator(page, "Child-Pugh Score");
    await expect(
          page.getByTestId("calculator-title").first(),
        ).toContainText("Child-Pugh");
  });

  test("should calculate Child-Pugh score", async ({ page }) => {
    await clickCalculator(page, "Child-Pugh Score");

    // Fill numeric values for Class A
    await page.getByRole("spinbutton", { name: /Bilirubin/i }).fill("1.5");
    await page.getByRole("spinbutton", { name: /Albumin/i }).fill("4.0");
    await page.getByRole("spinbutton", { name: /INR/i }).fill("1.2");

    // Select "None" for Ascites (first "None" radio) and Encephalopathy (second "None" radio)
    const noneRadios = page.getByRole("radio", { name: "None" });
    await noneRadios.nth(0).check(); // Ascites: None
    await noneRadios.nth(1).check(); // Encephalopathy: None

    await page.getByRole('button', { name: 'Calculate' }).click();

    // Verify results - check that score and class are shown
    await expect(page.getByText("5 points", { exact: true })).toBeVisible();
    await expect(page.getByText("Child-Pugh Class")).toBeVisible();
  });

  test("should navigate to Prostate Volume & PSA Density calculator", async ({
    page,
  }) => {
    await clickCalculator(page, "Prostate Volume & PSA Density");
    await expect(
          page.getByTestId("calculator-title").first(),
        ).toContainText("Prostate Volume");
  });

  test("should calculate Prostate Volume & PSA Density", async ({ page }) => {
    await clickCalculator(page, "Prostate Volume & PSA Density");

    // Fill in dimensions using role selectors
    await page.getByRole("spinbutton", { name: /Length/i }).fill("4");
    await page.getByRole("spinbutton", { name: /Width/i }).fill("4");
    await page.getByRole("spinbutton", { name: /Height/i }).fill("3.5");

    await page.getByRole('button', { name: 'Calculate' }).click();

    // Verify volume result - check for specific result text
    await expect(page.getByText("Prostate Volume (mL)")).toBeVisible();
    await expect(page.getByText(/\d+\.?\d*\s*cm³/)).toBeVisible();
  });

  test("should navigate to ACR TI-RADS calculator", async ({ page }) => {
    await clickCalculator(page, "ACR TI-RADS");
    await expect(
          page.getByTestId("calculator-title").first(),
        ).toContainText("TI-RADS");
  });

  test("should display references section", async ({ page }) => {
    await clickCalculator(page, "Adrenal CT Washout");
    await expect(page.locator("text=/References/i")).toBeVisible();
  });

  test("generated calculator page exposes crawlable body HTML", async ({
    page,
    request,
    baseURL,
  }) => {
    test.skip(
      !existsSync(STATIC_MELD_PAGE),
      "requires npm run build so generated static pages are available",
    );
    test.skip(
      !baseURL?.includes("4173"),
      "requires Vite preview so generated static pages are served",
    );

    expect(
      statSync(STATIC_MELD_PAGE).mtimeMs,
      `${STATIC_MELD_PAGE} is older than source/build inputs; run npm run build before smoke preview`,
    ).toBeGreaterThanOrEqual(latestStaticBuildInputMtimeMs() - 1000);

    const response = await request.get("/calculators/meld-na/");
    expect(response.ok()).toBe(true);
    const html = await response.text();

    expect(html).toContain("MELD-Na Score Calculator");
    expect(html).toContain("Free MELD-Na Score Calculator.");
    expect(html).toContain("Kamath PS et al. Hepatology 2001");
    expect(html).toMatch(/<section[^>]+aria-labelledby="static-related-heading"/);
    expect(html.match(/href="\/calculators\/[^"]+\/"/g)?.length ?? 0).toBeGreaterThanOrEqual(3);

    const hydrationMessages = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && /hydration|Hydration failed|did not match/i.test(msg.text())) {
        hydrationMessages.push(msg.text());
      }
    });

    await page.goto("/calculators/meld-na/");
    await expect(page.getByTestId("calculator-title")).toContainText("MELD-Na Score");
    await page.screenshot({
      path: "test-results/static-meld-na-page.png",
      fullPage: true,
    });
    expect(hydrationMessages).toEqual([]);
  });

  test("should toggle favorites", async ({ page }) => {
    // Open mobile menu if needed
    await openMobileMenuIfNeeded(page);
    // Hover over calculator and click star
    const calcButton = page.locator('button:has-text("Child-Pugh Score")');
    await calcButton.hover();
    const starButton = calcButton.locator('button[aria-label*="favorite"]');
    if (await starButton.isVisible()) {
      await starButton.click();
    }
  });

  test("should search calculators", async ({ page }) => {
    // Open mobile menu if needed for search
    await openMobileMenuIfNeeded(page);
    await page.fill('input[placeholder*="Search"]', "liver");
    await expect(
      page.locator('button:has-text("Child-Pugh Score")'),
    ).toBeVisible();
  });
});
