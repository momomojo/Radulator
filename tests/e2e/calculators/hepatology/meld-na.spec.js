/**
 * E2E Tests for MELD-Na Calculator
 * Model for End-Stage Liver Disease with Sodium
 *
 * Test Coverage:
 * - Basic MELD score calculation
 * - MELD-Na score calculation (when MELD > 11)
 * - Dialysis adjustments (Cr = 4.0)
 * - Lower bounds (Cr, Bili, INR >= 1.0)
 * - Upper bounds (Cr <= 4.0, MELD/MELD-Na 6-40)
 * - Sodium adjustments (Na 125-137 for MELD-Na)
 * - Mortality risk categories
 * - Transplant eligibility criteria
 * - Input validation
 * - Edge cases
 */

import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:5173";

test.describe("MELD-Na Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    // Navigate to MELD-Na calculator
    await page.click("text=MELD-Na Score");
    await expect(page.locator("h2")).toContainText("MELD-Na Score");
  });

  test.describe("Visual and UI Tests", () => {
    test("should display calculator with proper layout", async ({ page }) => {
      // Check header
      await expect(page.locator("h2")).toContainText("MELD-Na Score");
      await expect(
        page.locator("text=Model for End-Stage Liver Disease"),
      ).toBeVisible();

      // Check info section
      await expect(
        page.locator("text=The MELD-Na score predicts"),
      ).toBeVisible();
      await expect(
        page.locator("text=Interpretation guides allocation priority"),
      ).toBeVisible();

      // Check all input fields are present
      await expect(page.locator('label:has-text("Creatinine")')).toBeVisible();
      await expect(
        page.locator('label:has-text("Total Bilirubin")'),
      ).toBeVisible();
      await expect(page.locator('label:has-text("INR")')).toBeVisible();
      await expect(page.locator('label:has-text("Sodium")')).toBeVisible();
      await expect(
        page.locator('label:has-text("Dialysis ≥2 times")'),
      ).toBeVisible();

      // Check Calculate button
      await expect(page.locator('button:has-text("Calculate")')).toBeVisible();

      // Check References section
      await expect(page.locator("text=References")).toBeVisible();
    });

    test("should show subLabels with units and ranges", async ({ page }) => {
      await expect(page.locator("text=mg/dL (0.1-15.0)")).toBeVisible();
      await expect(page.locator("text=mg/dL (0.1-50.0)")).toBeVisible();
      await expect(page.locator("text=0.8-10.0")).toBeVisible();
      await expect(page.locator("text=mEq/L (110-160)")).toBeVisible();
    });

    test("should have working dialysis checkbox", async ({ page }) => {
      const dialysisCheckbox = page.locator('button[role="switch"]');

      // Initially unchecked
      await expect(dialysisCheckbox).toHaveAttribute("aria-checked", "false");

      // Click to check
      await dialysisCheckbox.click();
      await expect(dialysisCheckbox).toHaveAttribute("aria-checked", "true");

      // Click to uncheck
      await dialysisCheckbox.click();
      await expect(dialysisCheckbox).toHaveAttribute("aria-checked", "false");
    });
  });

  test.describe("Basic MELD Score Calculations", () => {
    test("should calculate low MELD score (6-9)", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "0.8");
      await page.fill('input[id="bilirubin"]', "0.9");
      await page.fill('input[id="inr"]', "1.0");
      await page.fill('input[id="sodium"]', "140");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=MELD Score:")).toBeVisible();
      await expect(page.locator("text=MELD-Na Score:")).toBeVisible();
      await expect(page.locator("text=Low risk")).toBeVisible();
      await expect(page.locator("text=1.9%")).toBeVisible();
    });

    test("should calculate moderate MELD score (10-19)", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "1.5");
      await page.fill('input[id="bilirubin"]', "2.5");
      await page.fill('input[id="inr"]', "1.5");
      await page.fill('input[id="sodium"]', "135");

      await page.click('button:has-text("Calculate")');

      const meldScore = await page
        .locator("text=/MELD Score: \\d+/")
        .textContent();
      const score = parseInt(meldScore.match(/\\d+/)[0]);

      expect(score).toBeGreaterThanOrEqual(10);
      expect(score).toBeLessThanOrEqual(19);

      await expect(page.locator("text=Moderate risk")).toBeVisible();
      await expect(page.locator("text=6.0%")).toBeVisible();
    });

    test("should calculate high MELD score (20-29)", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "2.5");
      await page.fill('input[id="bilirubin"]', "8.0");
      await page.fill('input[id="inr"]', "2.0");
      await page.fill('input[id="sodium"]', "130");

      await page.click('button:has-text("Calculate")');

      const meldScore = await page
        .locator("text=/MELD Score: \\d+/")
        .textContent();
      const score = parseInt(meldScore.match(/\\d+/)[0]);

      expect(score).toBeGreaterThanOrEqual(20);
      expect(score).toBeLessThanOrEqual(29);

      await expect(page.locator("text=High risk")).toBeVisible();
      await expect(page.locator("text=19.6%")).toBeVisible();
    });

    test("should calculate very high MELD score (30-39)", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "3.5");
      await page.fill('input[id="bilirubin"]', "15.0");
      await page.fill('input[id="inr"]', "2.5");
      await page.fill('input[id="sodium"]', "128");

      await page.click('button:has-text("Calculate")');

      const meldScore = await page
        .locator("text=/MELD Score: \\d+/")
        .textContent();
      const score = parseInt(meldScore.match(/\\d+/)[0]);

      expect(score).toBeGreaterThanOrEqual(30);
      expect(score).toBeLessThanOrEqual(39);

      await expect(page.locator("text=Very high risk")).toBeVisible();
      await expect(page.locator("text=52.6%")).toBeVisible();
    });

    test("should calculate critical MELD score (40)", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "4.0");
      await page.fill('input[id="bilirubin"]', "30.0");
      await page.fill('input[id="inr"]', "4.0");
      await page.fill('input[id="sodium"]', "125");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=MELD Score: 40")).toBeVisible();
      await expect(page.locator("text=Critical risk")).toBeVisible();
      await expect(page.locator("text=>70%")).toBeVisible();
    });
  });

  test.describe("MELD-Na Sodium Correction", () => {
    test("should apply sodium correction when MELD > 11", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "2.0");
      await page.fill('input[id="bilirubin"]', "3.0");
      await page.fill('input[id="inr"]', "1.8");
      await page.fill('input[id="sodium"]', "130");

      await page.click('button:has-text("Calculate")');

      const meldText = await page
        .locator("text=/MELD Score: \\d+/")
        .textContent();
      const meldNaText = await page
        .locator("text=/MELD-Na Score: \\d+/")
        .textContent();

      const meld = parseInt(meldText.match(/\\d+/)[0]);
      const meldNa = parseInt(meldNaText.match(/\\d+/)[0]);

      // MELD-Na should be different from MELD when MELD > 11 and Na < 137
      expect(meldNa).toBeGreaterThan(meld);
    });

    test("should NOT apply sodium correction when MELD <= 11", async ({
      page,
    }) => {
      await page.fill('input[id="creatinine"]', "1.0");
      await page.fill('input[id="bilirubin"]', "1.5");
      await page.fill('input[id="inr"]', "1.2");
      await page.fill('input[id="sodium"]', "130");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=MELD-Na equals MELD")).toBeVisible();

      const meldText = await page
        .locator("text=/MELD Score: \\d+/")
        .textContent();
      const meldNaText = await page
        .locator("text=/MELD-Na Score: \\d+/")
        .textContent();

      const meld = parseInt(meldText.match(/\\d+/)[0]);
      const meldNa = parseInt(meldNaText.match(/\\d+/)[0]);

      expect(meldNa).toBe(meld);
    });

    test("should cap sodium at 125 mEq/L for MELD-Na calculation", async ({
      page,
    }) => {
      await page.fill('input[id="creatinine"]', "2.0");
      await page.fill('input[id="bilirubin"]', "4.0");
      await page.fill('input[id="inr"]', "1.8");
      await page.fill('input[id="sodium"]', "120");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Sodium set to lower bound of 125 mEq/L"),
      ).toBeVisible();
    });

    test("should cap sodium at 137 mEq/L for MELD-Na calculation", async ({
      page,
    }) => {
      await page.fill('input[id="creatinine"]', "2.0");
      await page.fill('input[id="bilirubin"]', "4.0");
      await page.fill('input[id="inr"]', "1.8");
      await page.fill('input[id="sodium"]', "145");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Sodium set to upper bound of 137 mEq/L"),
      ).toBeVisible();
    });
  });

  test.describe("Dialysis Adjustments", () => {
    test("should set creatinine to 4.0 when dialysis is checked", async ({
      page,
    }) => {
      await page.fill('input[id="creatinine"]', "1.5");
      await page.fill('input[id="bilirubin"]', "3.0");
      await page.fill('input[id="inr"]', "1.5");
      await page.fill('input[id="sodium"]', "135");

      // Check dialysis
      await page.locator('button[role="switch"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Creatinine set to 4.0 mg/dL (dialysis"),
      ).toBeVisible();
    });

    test("should override high creatinine with dialysis value", async ({
      page,
    }) => {
      await page.fill('input[id="creatinine"]', "5.0");
      await page.fill('input[id="bilirubin"]', "3.0");
      await page.fill('input[id="inr"]', "1.5");
      await page.fill('input[id="sodium"]', "135");

      // Check dialysis
      await page.locator('button[role="switch"]').click();

      await page.click('button:has-text("Calculate")');

      // Should show dialysis note, not the Cr capped note
      await expect(
        page.locator("text=Creatinine set to 4.0 mg/dL (dialysis"),
      ).toBeVisible();
    });
  });

  test.describe("Lower Bound Adjustments", () => {
    test("should set creatinine lower bound to 1.0", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "0.5");
      await page.fill('input[id="bilirubin"]', "2.0");
      await page.fill('input[id="inr"]', "1.5");
      await page.fill('input[id="sodium"]', "135");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Creatinine set to lower bound of 1.0 mg/dL"),
      ).toBeVisible();
    });

    test("should set bilirubin lower bound to 1.0", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "1.5");
      await page.fill('input[id="bilirubin"]', "0.5");
      await page.fill('input[id="inr"]', "1.5");
      await page.fill('input[id="sodium"]', "135");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Bilirubin set to lower bound of 1.0 mg/dL"),
      ).toBeVisible();
    });

    test("should set INR lower bound to 1.0", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "1.5");
      await page.fill('input[id="bilirubin"]', "2.0");
      await page.fill('input[id="inr"]', "0.9");
      await page.fill('input[id="sodium"]', "135");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=INR set to lower bound of 1.0"),
      ).toBeVisible();
    });
  });

  test.describe("Upper Bound Adjustments", () => {
    test("should cap creatinine at 4.0 (without dialysis)", async ({
      page,
    }) => {
      await page.fill('input[id="creatinine"]', "6.0");
      await page.fill('input[id="bilirubin"]', "3.0");
      await page.fill('input[id="inr"]', "1.5");
      await page.fill('input[id="sodium"]', "135");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Creatinine capped at 4.0 mg/dL"),
      ).toBeVisible();
    });

    test("should cap MELD score at minimum of 6", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "0.5");
      await page.fill('input[id="bilirubin"]', "0.3");
      await page.fill('input[id="inr"]', "0.9");
      await page.fill('input[id="sodium"]', "140");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=MELD Score: 6")).toBeVisible();
      await expect(
        page.locator("text=MELD score capped at minimum of 6"),
      ).toBeVisible();
    });

    test("should cap MELD score at maximum of 40", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "4.0");
      await page.fill('input[id="bilirubin"]', "50.0");
      await page.fill('input[id="inr"]', "10.0");
      await page.fill('input[id="sodium"]', "135");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=MELD Score: 40")).toBeVisible();
    });
  });

  test.describe("Transplant Eligibility Interpretation", () => {
    test("should suggest monitoring for MELD-Na < 15", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "1.2");
      await page.fill('input[id="bilirubin"]', "1.5");
      await page.fill('input[id="inr"]', "1.3");
      await page.fill('input[id="sodium"]', "138");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "text=Monitor closely; transplant evaluation if disease progresses",
        ),
      ).toBeVisible();
    });

    test("should indicate transplant candidacy for MELD-Na 15-24", async ({
      page,
    }) => {
      await page.fill('input[id="creatinine"]', "2.0");
      await page.fill('input[id="bilirubin"]', "3.0");
      await page.fill('input[id="inr"]', "1.6");
      await page.fill('input[id="sodium"]', "132");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "text=Patient meets criteria for liver transplant evaluation",
        ),
      ).toBeVisible();
      await expect(
        page.locator("text=Candidate for transplant listing"),
      ).toBeVisible();
    });

    test("should indicate high priority for MELD-Na >= 25", async ({
      page,
    }) => {
      await page.fill('input[id="creatinine"]', "3.0");
      await page.fill('input[id="bilirubin"]', "10.0");
      await page.fill('input[id="inr"]', "2.2");
      await page.fill('input[id="sodium"]', "128");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "text=Patient meets criteria for liver transplant evaluation",
        ),
      ).toBeVisible();
      await expect(
        page.locator("text=High priority for transplantation"),
      ).toBeVisible();
    });
  });

  test.describe("Input Validation", () => {
    test("should show error for missing inputs", async ({ page }) => {
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Please enter all required values"),
      ).toBeVisible();
    });

    test("should show error for creatinine out of range (too low)", async ({
      page,
    }) => {
      await page.fill('input[id="creatinine"]', "0.05");
      await page.fill('input[id="bilirubin"]', "2.0");
      await page.fill('input[id="inr"]', "1.5");
      await page.fill('input[id="sodium"]', "135");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Creatinine must be between 0.1 and 15.0 mg/dL"),
      ).toBeVisible();
    });

    test("should show error for creatinine out of range (too high)", async ({
      page,
    }) => {
      await page.fill('input[id="creatinine"]', "20.0");
      await page.fill('input[id="bilirubin"]', "2.0");
      await page.fill('input[id="inr"]', "1.5");
      await page.fill('input[id="sodium"]', "135");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Creatinine must be between 0.1 and 15.0 mg/dL"),
      ).toBeVisible();
    });

    test("should show error for bilirubin out of range", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "1.5");
      await page.fill('input[id="bilirubin"]', "60.0");
      await page.fill('input[id="inr"]', "1.5");
      await page.fill('input[id="sodium"]', "135");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Bilirubin must be between 0.1 and 50.0 mg/dL"),
      ).toBeVisible();
    });

    test("should show error for INR out of range", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "1.5");
      await page.fill('input[id="bilirubin"]', "2.0");
      await page.fill('input[id="inr"]', "12.0");
      await page.fill('input[id="sodium"]', "135");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=INR must be between 0.8 and 10.0"),
      ).toBeVisible();
    });

    test("should show error for sodium out of range (too low)", async ({
      page,
    }) => {
      await page.fill('input[id="creatinine"]', "1.5");
      await page.fill('input[id="bilirubin"]', "2.0");
      await page.fill('input[id="inr"]', "1.5");
      await page.fill('input[id="sodium"]', "100");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Sodium must be between 110 and 160 mEq/L"),
      ).toBeVisible();
    });

    test("should show error for sodium out of range (too high)", async ({
      page,
    }) => {
      await page.fill('input[id="creatinine"]', "1.5");
      await page.fill('input[id="bilirubin"]', "2.0");
      await page.fill('input[id="inr"]', "1.5");
      await page.fill('input[id="sodium"]', "170");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Sodium must be between 110 and 160 mEq/L"),
      ).toBeVisible();
    });
  });

  test.describe("Edge Cases and Special Scenarios", () => {
    test("should handle normal values (healthy patient)", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "1.0");
      await page.fill('input[id="bilirubin"]', "1.0");
      await page.fill('input[id="inr"]', "1.0");
      await page.fill('input[id="sodium"]', "140");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=MELD Score: 6")).toBeVisible();
      await expect(page.locator("text=MELD-Na Score: 6")).toBeVisible();
      await expect(page.locator("text=Low risk")).toBeVisible();
    });

    test("should handle borderline MELD score (exactly 11)", async ({
      page,
    }) => {
      // Need to find values that give exactly MELD=11
      await page.fill('input[id="creatinine"]', "1.0");
      await page.fill('input[id="bilirubin"]', "3.0");
      await page.fill('input[id="inr"]', "1.2");
      await page.fill('input[id="sodium"]', "130");

      await page.click('button:has-text("Calculate")');

      // At MELD=11, sodium correction should NOT apply
      await expect(page.locator("text=MELD-Na equals MELD")).toBeVisible();
    });

    test("should handle minimal sodium (125)", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "2.0");
      await page.fill('input[id="bilirubin"]', "4.0");
      await page.fill('input[id="inr"]', "1.8");
      await page.fill('input[id="sodium"]', "125");

      await page.click('button:has-text("Calculate")');

      const meldText = await page
        .locator("text=/MELD Score: \\d+/")
        .textContent();
      const meldNaText = await page
        .locator("text=/MELD-Na Score: \\d+/")
        .textContent();

      const meld = parseInt(meldText.match(/\\d+/)[0]);
      const meldNa = parseInt(meldNaText.match(/\\d+/)[0]);

      // With Na=125, MELD-Na should be significantly higher than MELD
      expect(meldNa).toBeGreaterThan(meld);
    });

    test("should handle all lower bounds simultaneously", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "0.5");
      await page.fill('input[id="bilirubin"]', "0.5");
      await page.fill('input[id="inr"]', "0.9");
      await page.fill('input[id="sodium"]', "140");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Creatinine set to lower bound"),
      ).toBeVisible();
      await expect(
        page.locator("text=Bilirubin set to lower bound"),
      ).toBeVisible();
      await expect(page.locator("text=INR set to lower bound")).toBeVisible();
    });

    test("should handle decimal inputs correctly", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "1.23");
      await page.fill('input[id="bilirubin"]', "2.45");
      await page.fill('input[id="inr"]', "1.67");
      await page.fill('input[id="sodium"]', "134.5");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=MELD Score:")).toBeVisible();
      await expect(page.locator("text=MELD-Na Score:")).toBeVisible();
    });
  });

  test.describe("Reference Links", () => {
    test("should display all 6 references", async ({ page }) => {
      const references = await page
        .locator('section:has-text("References") li')
        .count();
      expect(references).toBe(6);
    });

    test("should have clickable reference links", async ({ page }) => {
      const firstLink = page
        .locator('section:has-text("References") a')
        .first();
      await expect(firstLink).toHaveAttribute("href", /https?:\/\/.+/);
      await expect(firstLink).toHaveAttribute("target", "_blank");
    });

    test("should include key references", async ({ page }) => {
      await expect(
        page.locator("text=Kamath PS et al. Hepatology 2001"),
      ).toBeVisible();
      await expect(
        page.locator("text=Kim WR et al. Gastroenterology 2008"),
      ).toBeVisible();
      await expect(page.locator("text=UNOS Policy 9")).toBeVisible();
    });
  });

  test.describe("Clinical Workflow", () => {
    test("should support complete clinical workflow", async ({ page }) => {
      // Step 1: Enter patient data
      await page.fill('input[id="creatinine"]', "2.8");
      await page.fill('input[id="bilirubin"]', "5.2");
      await page.fill('input[id="inr"]', "1.9");
      await page.fill('input[id="sodium"]', "131");

      // Step 2: Calculate
      await page.click('button:has-text("Calculate")');

      // Step 3: Verify results appear
      await expect(page.locator("text=MELD Score:")).toBeVisible();
      await expect(page.locator("text=MELD-Na Score:")).toBeVisible();
      await expect(page.locator("text=3-Month Mortality:")).toBeVisible();
      await expect(page.locator("text=Risk Category:")).toBeVisible();
      await expect(page.locator("text=Interpretation:")).toBeVisible();

      // Step 4: Update with dialysis
      await page.locator('button[role="switch"]').click();
      await page.click('button:has-text("Calculate")');

      // Step 5: Verify dialysis note appears
      await expect(
        page.locator("text=Creatinine set to 4.0 mg/dL (dialysis"),
      ).toBeVisible();
    });

    test("should handle recalculation with different values", async ({
      page,
    }) => {
      // First calculation
      await page.fill('input[id="creatinine"]', "1.5");
      await page.fill('input[id="bilirubin"]', "2.0");
      await page.fill('input[id="inr"]', "1.3");
      await page.fill('input[id="sodium"]', "138");
      await page.click('button:has-text("Calculate")');

      const firstResult = await page
        .locator("text=/MELD Score: \\d+/")
        .textContent();

      // Second calculation with higher values
      await page.fill('input[id="creatinine"]', "3.0");
      await page.fill('input[id="bilirubin"]', "8.0");
      await page.fill('input[id="inr"]', "2.5");
      await page.fill('input[id="sodium"]', "128");
      await page.click('button:has-text("Calculate")');

      const secondResult = await page
        .locator("text=/MELD Score: \\d+/")
        .textContent();

      // Second MELD should be higher
      const firstScore = parseInt(firstResult.match(/\\d+/)[0]);
      const secondScore = parseInt(secondResult.match(/\\d+/)[0]);
      expect(secondScore).toBeGreaterThan(firstScore);
    });
  });

  test.describe("Accessibility", () => {
    test("should have proper ARIA labels", async ({ page }) => {
      const creatinineInput = page.locator('input[id="creatinine"]');
      await expect(creatinineInput).toHaveAttribute("type", "number");

      const dialysisSwitch = page.locator('button[role="switch"]');
      await expect(dialysisSwitch).toHaveAttribute("aria-checked");
    });

    test("should have keyboard navigation support", async ({ page }) => {
      // Tab through inputs
      await page.keyboard.press("Tab");
      await page.keyboard.type("1.5");

      await page.keyboard.press("Tab");
      await page.keyboard.type("2.0");

      await page.keyboard.press("Tab");
      await page.keyboard.type("1.3");

      await page.keyboard.press("Tab");
      await page.keyboard.type("135");

      // Verify values entered
      await expect(page.locator('input[id="creatinine"]')).toHaveValue("1.5");
      await expect(page.locator('input[id="bilirubin"]')).toHaveValue("2.0");
      await expect(page.locator('input[id="inr"]')).toHaveValue("1.3");
      await expect(page.locator('input[id="sodium"]')).toHaveValue("135");
    });
  });
});
