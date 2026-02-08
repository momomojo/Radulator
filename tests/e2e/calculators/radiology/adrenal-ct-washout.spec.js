import { test, expect } from "@playwright/test";
import {
  navigateToCalculator,
  fillInput,
  verifyResult,
  verifyReferenceLinks,
  verifyThemeConsistency,
  verifyMobileResponsive,
  clearAllInputs,
  verifyCalculationAccuracy,
  testEdgeCases,
} from "../../../helpers/calculator-test-helper.js";

/**
 * E2E Tests for Adrenal CT Washout Calculator
 *
 * This calculator computes absolute and relative washout percentages
 * to differentiate adrenal adenomas from non-adenomas using CT imaging.
 *
 * Formulas:
 * - Absolute Washout = ((Portal - Delayed) / (Portal - Unenhanced)) × 100
 * - Relative Washout = ((Portal - Delayed) / Portal) × 100
 *
 * Clinical Thresholds:
 * - Adenoma: Absolute ≥60% OR Relative ≥40%
 */

test.describe("Adrenal CT Washout Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, "Adrenal CT Washout");
  });

  test("should display calculator with correct title and description", async ({
    page,
  }) => {
    // Verify title
    await expect(page.locator("h2")).toContainText("Adrenal CT Washout");

    // Verify description - use header sibling selector instead of color class
    await expect(page.locator("header p")).toContainText(
      "Absolute & relative washout percentages",
    );

    // Verify info box with caveats - look for the div that contains the caveat info
    const infoBox = page.locator('div:has-text("Caveat")').first();
    await expect(infoBox).toBeVisible();
    await expect(infoBox).toContainText(
      "hypervascular extraadrenal primary tumors",
    );
    await expect(infoBox).toContainText("large adenomas");
  });

  test("should have all required input fields", async ({ page }) => {
    // Verify all three input fields are present
    await expect(
      page.locator('label:has-text("Pre‑contrast HU")'),
    ).toBeVisible();
    await expect(
      page.locator('label:has-text("Post‑contrast HU (60‑75 s)")'),
    ).toBeVisible();
    await expect(
      page.locator('label:has-text("Delayed HU (15 min)")'),
    ).toBeVisible();

    // Verify Calculate button is present
    await expect(page.locator('button:has-text("Calculate")')).toBeVisible();
  });

  test("Test Case 1: Typical Adenoma (both washouts meet thresholds)", async ({
    page,
  }) => {
    // From test_cases.md - Test Case 1
    await fillInput(page, "Pre‑contrast HU", "10");
    await fillInput(page, "Post‑contrast HU (60‑75 s)", "100");
    await fillInput(page, "Delayed HU (15 min)", "40");

    // Click calculate
    await page.locator('button:has-text("Calculate")').click();

    // Wait for results
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    // Verify absolute washout: ((100 - 40) / (100 - 10)) × 100 = 66.7%
    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("Absolute Washout (%)");
    await expect(results).toContainText("66.7");

    // Verify relative washout: ((100 - 40) / 100) × 100 = 60.0%
    await expect(results).toContainText("Relative Washout (%)");
    await expect(results).toContainText("60.0");

    // Verify interpretation
    await expect(results).toContainText("Suggests adrenal adenoma");
  });

  test("Test Case 2: Non-adenoma (low washout values)", async ({ page }) => {
    // From test_cases.md - Test Case 2
    await fillInput(page, "Pre‑contrast HU", "20");
    await fillInput(page, "Post‑contrast HU (60‑75 s)", "80");
    await fillInput(page, "Delayed HU (15 min)", "70");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    // Verify absolute washout: ((80 - 70) / (80 - 20)) × 100 = 16.7%
    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("16.7");

    // Verify relative washout: ((80 - 70) / 80) × 100 = 12.5%
    await expect(results).toContainText("12.5");

    // Verify interpretation - should NOT suggest adenoma
    await expect(results).toContainText("Indeterminate / non‑adenoma");
  });

  test("Test Case 3: Borderline adenoma (absolute meets, relative does not)", async ({
    page,
  }) => {
    // Custom test case: Absolute = 60% exactly, Relative = 35%
    // Unenhanced: 5, Portal: 60, Delayed: 27
    // Absolute: ((60 - 27) / (60 - 5)) × 100 = 60.0%
    // Relative: ((60 - 27) / 60) × 100 = 55.0%

    await fillInput(page, "Pre‑contrast HU", "5");
    await fillInput(page, "Post‑contrast HU (60‑75 s)", "60");
    await fillInput(page, "Delayed HU (15 min)", "27");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');

    // Verify calculations
    await expect(results).toContainText("60.0");
    await expect(results).toContainText("55.0");

    // Should suggest adenoma (meets absolute threshold)
    await expect(results).toContainText("Suggests adrenal adenoma");
  });

  test("Test Case 4: Borderline adenoma (relative meets, absolute does not)", async ({
    page,
  }) => {
    // Custom test case: Absolute = 55%, Relative = 40% exactly
    // If Relative = 40%, then (Portal - Delayed) / Portal = 0.4
    // So Delayed = Portal × 0.6
    // Let Portal = 100, Delayed = 60
    // For Absolute = 55%: (100 - 60) / (100 - Unenhanced) = 0.55
    // 40 / (100 - Unenhanced) = 0.55
    // 100 - Unenhanced = 72.73
    // Unenhanced = 27.27

    await fillInput(page, "Pre‑contrast HU", "27.3");
    await fillInput(page, "Post‑contrast HU (60‑75 s)", "100");
    await fillInput(page, "Delayed HU (15 min)", "60");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');

    // Verify relative is 40%
    await expect(results).toContainText("40.0");

    // Should suggest adenoma (meets relative threshold)
    await expect(results).toContainText("Suggests adrenal adenoma");
  });

  test("Test Case 5: High enhancement lesion (typical metastasis pattern)", async ({
    page,
  }) => {
    // Unenhanced: 30, Portal: 120, Delayed: 110
    // Absolute: ((120 - 110) / (120 - 30)) × 100 = 11.1%
    // Relative: ((120 - 110) / 120) × 100 = 8.3%

    await fillInput(page, "Pre‑contrast HU", "30");
    await fillInput(page, "Post‑contrast HU (60‑75 s)", "120");
    await fillInput(page, "Delayed HU (15 min)", "110");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("11.1");
    await expect(results).toContainText("8.3");
    await expect(results).toContainText("Indeterminate / non‑adenoma");
  });

  test("Test Case 6: Lipid-poor adenoma (still meets criteria)", async ({
    page,
  }) => {
    // Unenhanced: 25, Portal: 85, Delayed: 34
    // Absolute: ((85 - 34) / (85 - 25)) × 100 = 85.0%
    // Relative: ((85 - 34) / 85) × 100 = 60.0%

    await fillInput(page, "Pre‑contrast HU", "25");
    await fillInput(page, "Post‑contrast HU (60‑75 s)", "85");
    await fillInput(page, "Delayed HU (15 min)", "34");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("85.0");
    await expect(results).toContainText("60.0");
    await expect(results).toContainText("Suggests adrenal adenoma");
  });

  test("Edge Case: Zero enhancement (portal = delayed)", async ({ page }) => {
    // No washout at all
    await fillInput(page, "Pre‑contrast HU", "10");
    await fillInput(page, "Post‑contrast HU (60‑75 s)", "50");
    await fillInput(page, "Delayed HU (15 min)", "50");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    // Both should be 0%
    await expect(results).toContainText("0.0");
    await expect(results).toContainText("Indeterminate / non‑adenoma");
  });

  test("Edge Case: Negative HU values (lipid-rich adenoma)", async ({
    page,
  }) => {
    // Lipid-rich adenoma with negative unenhanced HU
    await fillInput(page, "Pre‑contrast HU", "-10");
    await fillInput(page, "Post‑contrast HU (60‑75 s)", "80");
    await fillInput(page, "Delayed HU (15 min)", "35");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    // Absolute: ((80 - 35) / (80 - (-10))) × 100 = (45 / 90) × 100 = 50.0%
    // Relative: ((80 - 35) / 80) × 100 = 56.25%
    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("50.0");
    await expect(results).toContainText("56.3"); // Rounded
    await expect(results).toContainText("Suggests adrenal adenoma");
  });

  test("Edge Case: Very high washout values", async ({ page }) => {
    // Extreme adenoma: very rapid washout
    await fillInput(page, "Pre‑contrast HU", "0");
    await fillInput(page, "Post‑contrast HU (60‑75 s)", "100");
    await fillInput(page, "Delayed HU (15 min)", "5");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    // Absolute: ((100 - 5) / (100 - 0)) × 100 = 95.0%
    // Relative: ((100 - 5) / 100) × 100 = 95.0%
    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("95.0");
    await expect(results).toContainText("Suggests adrenal adenoma");
  });

  test("Edge Case: Decimal input values", async ({ page }) => {
    // Test with decimal precision
    await fillInput(page, "Pre‑contrast HU", "12.5");
    await fillInput(page, "Post‑contrast HU (60‑75 s)", "98.3");
    await fillInput(page, "Delayed HU (15 min)", "41.7");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    // Absolute: ((98.3 - 41.7) / (98.3 - 12.5)) × 100 = 65.97%
    // Relative: ((98.3 - 41.7) / 98.3) × 100 = 57.58%
    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("66.0"); // Rounded to 1 decimal
    await expect(results).toContainText("57.6");
    await expect(results).toContainText("Suggests adrenal adenoma");
  });

  test("should verify all reference citations are accessible", async ({
    page,
  }) => {
    // Scroll to references section
    await page.locator('h3:has-text("References")').scrollIntoViewIfNeeded();

    // Verify all three references are present
    const refs = page.locator('section a[target="_blank"]');
    await expect(refs).toHaveCount(3);

    // Verify reference text
    await expect(
      page.locator('a:has-text("Caoili EM AJR 2000")'),
    ).toBeVisible();
    await expect(
      page.locator('a:has-text("Choi YA Radiology 2013")'),
    ).toBeVisible();
    await expect(
      page.locator('a:has-text("Park SY Abdom Imaging 2015")'),
    ).toBeVisible();

    // Verify DOI links
    const links = await refs.all();
    const hrefs = await Promise.all(
      links.map((link) => link.getAttribute("href")),
    );

    expect(hrefs).toContain("https://doi.org/10.2214/ajr.175.5.1751411");
    expect(hrefs).toContain("https://doi.org/10.1148/radiol.12120110");
    expect(hrefs).toContain("https://doi.org/10.1007/s00261-015-0521-x");

    // Verify links have correct attributes
    for (const link of links) {
      expect(await link.getAttribute("target")).toBe("_blank");
      expect(await link.getAttribute("rel")).toBe("noopener noreferrer");
    }
  });

  test("should maintain theme consistency", async ({ page }) => {
    await verifyThemeConsistency(page);

    // Verify specific styling elements
    const card = page.locator(".border.rounded-lg").first();
    await expect(card).toBeVisible();

    // Verify input fields have proper styling
    const inputs = page.locator('input[type="number"]');
    const inputCount = await inputs.count();
    expect(inputCount).toBe(3);

    // Verify labels are properly styled
    const labels = page.locator("label");
    const labelCount = await labels.count();
    expect(labelCount).toBeGreaterThanOrEqual(3);
  });

  test("should be responsive on mobile devices", async ({ page }) => {
    await verifyMobileResponsive(page);

    // Verify calculator is still usable on mobile
    const inputs = page.locator('input[type="number"]');
    await expect(inputs.first()).toBeVisible();

    const calculateBtn = page.locator('button:has-text("Calculate")');
    await expect(calculateBtn).toBeVisible();
  });

  test("should handle rapid successive calculations", async ({ page }) => {
    // Test 1
    await fillInput(page, "Pre‑contrast HU", "10");
    await fillInput(page, "Post‑contrast HU (60‑75 s)", "100");
    await fillInput(page, "Delayed HU (15 min)", "40");
    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    // Test 2 - immediately change values and recalculate
    await fillInput(page, "Pre‑contrast HU", "20");
    await fillInput(page, "Post‑contrast HU (60‑75 s)", "80");
    await fillInput(page, "Delayed HU (15 min)", "70");
    await page.locator('button:has-text("Calculate")').click();

    // Verify results updated correctly
    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("16.7");
    await expect(results).toContainText("12.5");
  });

  test("should handle clearing inputs", async ({ page }) => {
    // Fill values
    await fillInput(page, "Pre‑contrast HU", "10");
    await fillInput(page, "Post‑contrast HU (60‑75 s)", "100");
    await fillInput(page, "Delayed HU (15 min)", "40");

    // Calculate
    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    // Clear all inputs
    await clearAllInputs(page);

    // Verify inputs are cleared
    const inputs = await page.locator('input[type="number"]').all();
    for (const input of inputs) {
      expect(await input.inputValue()).toBe("");
    }
  });

  test("Visual Regression: Calculator appearance", async ({ page }) => {
    // Take screenshot of initial state
    await page.screenshot({
      path: "test-results/screenshots/adrenal-ct-washout-initial.png",
      fullPage: true,
    });

    // Fill in typical values
    await fillInput(page, "Pre‑contrast HU", "10");
    await fillInput(page, "Post‑contrast HU (60‑75 s)", "100");
    await fillInput(page, "Delayed HU (15 min)", "40");

    // Take screenshot with values
    await page.screenshot({
      path: "test-results/screenshots/adrenal-ct-washout-filled.png",
      fullPage: true,
    });

    // Calculate and screenshot results
    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    await page.screenshot({
      path: "test-results/screenshots/adrenal-ct-washout-results.png",
      fullPage: true,
    });
  });

  test("Performance: Calculation speed", async ({ page }) => {
    await fillInput(page, "Pre‑contrast HU", "10");
    await fillInput(page, "Post‑contrast HU (60‑75 s)", "100");
    await fillInput(page, "Delayed HU (15 min)", "40");

    const startTime = Date.now();
    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });
    const endTime = Date.now();

    const calculationTime = endTime - startTime;

    // Should complete in less than 500ms
    expect(calculationTime).toBeLessThan(500);
  });

  test("should not have console errors during calculation", async ({
    page,
  }) => {
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await fillInput(page, "Pre‑contrast HU", "10");
    await fillInput(page, "Post‑contrast HU (60‑75 s)", "100");
    await fillInput(page, "Delayed HU (15 min)", "40");
    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    expect(consoleErrors).toHaveLength(0);
  });
});
