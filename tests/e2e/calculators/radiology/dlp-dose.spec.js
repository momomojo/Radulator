import { test, expect } from "@playwright/test";
import {
  navigateToCalculator,
  fillInput,
  selectOption,
  verifyResult,
  verifyThemeConsistency,
  verifyMobileResponsive,
  clearAllInputs,
} from "../../../helpers/calculator-test-helper.js";

/**
 * E2E Tests for DLP to Effective Dose Calculator
 *
 * This calculator converts CT Dose Length Product (DLP) to estimated
 * effective dose using region-specific k-factors based on ICRP guidelines.
 *
 * Formula: Effective Dose (mSv) = DLP (mGy·cm) × k-factor (mSv/mGy·cm)
 *
 * K-factors vary by:
 * - Anatomical region (head, chest, abdomen, etc.)
 * - Patient age group (adult, child 10y, 5y, 1y, newborn)
 */

test.describe("DLP to Effective Dose Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, "DLP to Effective Dose");
  });

  test("should display calculator with correct title and description", async ({
    page,
  }) => {
    // Verify title
    await expect(page.locator("h2")).toContainText("DLP to Effective Dose");

    // Verify description
    await expect(page.getByTestId("calculator-description")).toContainText(
      "Convert CT Dose Length Product to estimated effective radiation dose",
    );

    // Verify info box is present with relevant information
    const infoBox = page.getByTestId("calculator-info");
    await expect(infoBox).toBeVisible();
    await expect(infoBox).toContainText("Dose Length Product");
    await expect(infoBox).toContainText("Effective Dose");
    await expect(infoBox).toContainText("k-factor");
  });

  test("should have all required input fields", async ({ page }) => {
    // Verify DLP input field
    await expect(
      page.locator('label:has-text("Dose Length Product (DLP)")'),
    ).toBeVisible();

    // Verify Anatomical Region select
    await expect(
      page.locator('label:has-text("Anatomical Region")'),
    ).toBeVisible();

    // Verify Patient Age Group select
    await expect(
      page.locator('label:has-text("Patient Age Group")'),
    ).toBeVisible();

    // Verify Calculate button is present
    await expect(page.locator('button:has-text("Calculate")')).toBeVisible();
  });

  // ============================================
  // ADULT HEAD CT TESTS
  // ============================================
  test("Adult Head CT: Typical DLP value (900 mGy·cm)", async ({ page }) => {
    // Adult head k-factor = 0.0021
    // Expected: 900 × 0.0021 = 1.89 mSv
    await fillInput(page, "Dose Length Product (DLP)", "900");
    await selectOption(page, "Anatomical Region", "head");
    await selectOption(page, "Patient Age Group", "adult");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("1.89 mSv");
    await expect(results).toContainText("0.0021");
    await expect(results).toContainText("Head");
    await expect(results).toContainText("Adult");
    await expect(results).toContainText("chest X-rays equivalent");
  });

  test("Adult Head CT: Low DLP value (500 mGy·cm)", async ({ page }) => {
    // Expected: 500 × 0.0021 = 1.05 mSv
    await fillInput(page, "Dose Length Product (DLP)", "500");
    await selectOption(page, "Anatomical Region", "head");
    await selectOption(page, "Patient Age Group", "adult");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("1.05 mSv");
  });

  test("Adult Head CT: High DLP value (1500 mGy·cm)", async ({ page }) => {
    // Expected: 1500 × 0.0021 = 3.15 mSv
    // Should trigger dose alert (typical range 850-1050)
    await fillInput(page, "Dose Length Product (DLP)", "1500");
    await selectOption(page, "Anatomical Region", "head");
    await selectOption(page, "Patient Age Group", "adult");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("3.15 mSv");
    await expect(results).toContainText("Dose Alert");
  });

  // ============================================
  // ADULT CHEST CT TESTS
  // ============================================
  test("Adult Chest CT: Typical DLP value (400 mGy·cm)", async ({ page }) => {
    // Adult chest k-factor = 0.014
    // Expected: 400 × 0.014 = 5.60 mSv
    await fillInput(page, "Dose Length Product (DLP)", "400");
    await selectOption(page, "Anatomical Region", "chest");
    await selectOption(page, "Patient Age Group", "adult");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("5.60 mSv");
    await expect(results).toContainText("0.014");
    await expect(results).toContainText("Chest");
    await expect(results).toContainText("Adult");
  });

  test("Adult Chest CT: Low-dose screening (200 mGy·cm)", async ({ page }) => {
    // Expected: 200 × 0.014 = 2.80 mSv
    await fillInput(page, "Dose Length Product (DLP)", "200");
    await selectOption(page, "Anatomical Region", "chest");
    await selectOption(page, "Patient Age Group", "adult");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("2.80 mSv");
  });

  // ============================================
  // ADULT ABDOMEN-PELVIS CT TESTS
  // ============================================
  test("Adult Abdomen-Pelvis CT: Typical DLP value (750 mGy·cm)", async ({
    page,
  }) => {
    // Adult abdomen_pelvis k-factor = 0.015
    // Expected: 750 × 0.015 = 11.25 mSv
    await fillInput(page, "Dose Length Product (DLP)", "750");
    await selectOption(page, "Anatomical Region", "abdomen_pelvis");
    await selectOption(page, "Patient Age Group", "adult");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("11.25 mSv");
    await expect(results).toContainText("0.015");
    await expect(results).toContainText("Abdomen + Pelvis");
  });

  test("Adult Abdomen-Pelvis CT: High DLP with dose alert (1800 mGy·cm)", async ({
    page,
  }) => {
    // Expected: 1800 × 0.015 = 27.00 mSv
    // Should trigger dose alert (typical range 500-1000)
    await fillInput(page, "Dose Length Product (DLP)", "1800");
    await selectOption(page, "Anatomical Region", "abdomen_pelvis");
    await selectOption(page, "Patient Age Group", "adult");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("27.00 mSv");
    await expect(results).toContainText("Dose Alert");
  });

  // ============================================
  // PEDIATRIC CALCULATIONS - DIFFERENT AGE GROUPS
  // ============================================
  test("Pediatric Head CT: 10-year-old (500 mGy·cm)", async ({ page }) => {
    // Child_10 head k-factor = 0.0027
    // Expected: 500 × 0.0027 = 1.35 mSv
    await fillInput(page, "Dose Length Product (DLP)", "500");
    await selectOption(page, "Anatomical Region", "head");
    await selectOption(page, "Patient Age Group", "child_10");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("1.35 mSv");
    await expect(results).toContainText("0.0027");
    await expect(results).toContainText("10-year-old");
    await expect(results).toContainText("Pediatric Note");
    await expect(results).toContainText("Pediatric Consideration");
  });

  test("Pediatric Head CT: 5-year-old (400 mGy·cm)", async ({ page }) => {
    // Child_5 head k-factor = 0.0035
    // Expected: 400 × 0.0035 = 1.40 mSv
    await fillInput(page, "Dose Length Product (DLP)", "400");
    await selectOption(page, "Anatomical Region", "head");
    await selectOption(page, "Patient Age Group", "child_5");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("1.40 mSv");
    await expect(results).toContainText("0.0035");
    await expect(results).toContainText("5-year-old");
  });

  test("Pediatric Head CT: 1-year-old (300 mGy·cm)", async ({ page }) => {
    // Child_1 head k-factor = 0.0054
    // Expected: 300 × 0.0054 = 1.62 mSv
    await fillInput(page, "Dose Length Product (DLP)", "300");
    await selectOption(page, "Anatomical Region", "head");
    await selectOption(page, "Patient Age Group", "child_1");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("1.62 mSv");
    await expect(results).toContainText("0.0054");
    await expect(results).toContainText("1-year-old");
  });

  test("Pediatric Head CT: Newborn (200 mGy·cm)", async ({ page }) => {
    // Newborn head k-factor = 0.011
    // Expected: 200 × 0.011 = 2.20 mSv
    await fillInput(page, "Dose Length Product (DLP)", "200");
    await selectOption(page, "Anatomical Region", "head");
    await selectOption(page, "Patient Age Group", "newborn");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("2.20 mSv");
    await expect(results).toContainText("0.011");
    await expect(results).toContainText("Newborn");
  });

  test("Pediatric Chest CT: 5-year-old (150 mGy·cm)", async ({ page }) => {
    // Child_5 chest k-factor = 0.023
    // Expected: 150 × 0.023 = 3.45 mSv
    await fillInput(page, "Dose Length Product (DLP)", "150");
    await selectOption(page, "Anatomical Region", "chest");
    await selectOption(page, "Patient Age Group", "child_5");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("3.45 mSv");
    await expect(results).toContainText("0.023");
    await expect(results).toContainText("Chest");
    await expect(results).toContainText("5-year-old");
    await expect(results).toContainText("Image Gently");
  });

  test("Pediatric Abdomen CT: 1-year-old (100 mGy·cm)", async ({ page }) => {
    // Child_1 abdomen k-factor = 0.041
    // Expected: 100 × 0.041 = 4.10 mSv
    await fillInput(page, "Dose Length Product (DLP)", "100");
    await selectOption(page, "Anatomical Region", "abdomen");
    await selectOption(page, "Patient Age Group", "child_1");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("4.10 mSv");
    await expect(results).toContainText("0.041");
    await expect(results).toContainText("1-year-old");
  });

  // ============================================
  // DIFFERENT ANATOMICAL REGIONS
  // ============================================
  test("Adult Neck CT (300 mGy·cm)", async ({ page }) => {
    // Adult neck k-factor = 0.0059
    // Expected: 300 × 0.0059 = 1.77 mSv
    await fillInput(page, "Dose Length Product (DLP)", "300");
    await selectOption(page, "Anatomical Region", "neck");
    await selectOption(page, "Patient Age Group", "adult");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("1.77 mSv");
    await expect(results).toContainText("0.0059");
    await expect(results).toContainText("Neck");
  });

  test("Adult Pelvis CT (450 mGy·cm)", async ({ page }) => {
    // Adult pelvis k-factor = 0.015
    // Expected: 450 × 0.015 = 6.75 mSv
    await fillInput(page, "Dose Length Product (DLP)", "450");
    await selectOption(page, "Anatomical Region", "pelvis");
    await selectOption(page, "Patient Age Group", "adult");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("6.75 mSv");
    await expect(results).toContainText("Pelvis");
  });

  test("Adult CAP CT (Chest + Abdomen + Pelvis, 1000 mGy·cm)", async ({
    page,
  }) => {
    // Adult chest_abdomen_pelvis k-factor = 0.015
    // Expected: 1000 × 0.015 = 15.00 mSv
    await fillInput(page, "Dose Length Product (DLP)", "1000");
    await selectOption(page, "Anatomical Region", "chest_abdomen_pelvis");
    await selectOption(page, "Patient Age Group", "adult");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("15.00 mSv");
    await expect(results).toContainText("Chest + Abdomen + Pelvis");
  });

  test("Adult Cervical Spine CT (300 mGy·cm)", async ({ page }) => {
    // Adult spine_cervical k-factor = 0.0059
    // Expected: 300 × 0.0059 = 1.77 mSv
    await fillInput(page, "Dose Length Product (DLP)", "300");
    await selectOption(page, "Anatomical Region", "spine_cervical");
    await selectOption(page, "Patient Age Group", "adult");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("1.77 mSv");
    await expect(results).toContainText("Cervical Spine");
  });

  test("Adult Thoracic Spine CT (350 mGy·cm)", async ({ page }) => {
    // Adult spine_thoracic k-factor = 0.014
    // Expected: 350 × 0.014 = 4.90 mSv
    await fillInput(page, "Dose Length Product (DLP)", "350");
    await selectOption(page, "Anatomical Region", "spine_thoracic");
    await selectOption(page, "Patient Age Group", "adult");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("4.90 mSv");
    await expect(results).toContainText("Thoracic Spine");
  });

  test("Adult Lumbar Spine CT (400 mGy·cm)", async ({ page }) => {
    // Adult spine_lumbar k-factor = 0.015
    // Expected: 400 × 0.015 = 6.00 mSv
    await fillInput(page, "Dose Length Product (DLP)", "400");
    await selectOption(page, "Anatomical Region", "spine_lumbar");
    await selectOption(page, "Patient Age Group", "adult");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("6.00 mSv");
    await expect(results).toContainText("Lumbar Spine");
  });

  test("Adult Extremity CT (100 mGy·cm)", async ({ page }) => {
    // Adult extremity k-factor = 0.0008
    // Expected: 100 × 0.0008 = 0.08 mSv
    // Lifetime risk: (0.08/1000) * 5 * 100 = 0.04% (>= 0.01% threshold)
    await fillInput(page, "Dose Length Product (DLP)", "100");
    await selectOption(page, "Anatomical Region", "extremity");
    await selectOption(page, "Patient Age Group", "adult");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("0.08 mSv");
    await expect(results).toContainText("Extremity");
    // Risk is 0.04%, shown as percentage (not negligible since >= 0.01%)
    await expect(results).toContainText("0.040%");
  });

  // ============================================
  // DOSE CONTEXT AND RISK ASSESSMENT
  // ============================================
  test("Should display dose context (chest X-ray equivalents)", async ({
    page,
  }) => {
    // 10 mSv / 0.1 mSv per chest X-ray = 100 chest X-rays
    await fillInput(page, "Dose Length Product (DLP)", "667");
    await selectOption(page, "Anatomical Region", "abdomen_pelvis");
    await selectOption(page, "Patient Age Group", "adult");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    // 667 × 0.015 = 10.005 mSv ≈ 100 chest X-rays
    await expect(results).toContainText("~100 chest X-rays equivalent");
  });

  test("Should display background radiation equivalent (days)", async ({
    page,
  }) => {
    // For doses < 3 mSv, should show days
    await fillInput(page, "Dose Length Product (DLP)", "100");
    await selectOption(page, "Anatomical Region", "chest");
    await selectOption(page, "Patient Age Group", "adult");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    // 100 × 0.014 = 1.4 mSv → (1.4/3)*365 ≈ 170 days
    await expect(results).toContainText("days background radiation");
  });

  test("Should display background radiation equivalent (years)", async ({
    page,
  }) => {
    // For doses >= 3 mSv, should show years
    await fillInput(page, "Dose Length Product (DLP)", "1000");
    await selectOption(page, "Anatomical Region", "abdomen_pelvis");
    await selectOption(page, "Patient Age Group", "adult");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    // 1000 × 0.015 = 15 mSv → 15/3 = 5.0 years
    await expect(results).toContainText("years background radiation");
  });

  test("Should display lifetime cancer risk estimate", async ({ page }) => {
    await fillInput(page, "Dose Length Product (DLP)", "750");
    await selectOption(page, "Anatomical Region", "abdomen_pelvis");
    await selectOption(page, "Patient Age Group", "adult");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText(
      "Estimated Additional Lifetime Cancer Risk",
    );
    await expect(results).toContainText("population average");
  });

  // ============================================
  // VALIDATION AND ERROR HANDLING
  // ============================================
  test("Should show error for missing DLP value", async ({ page }) => {
    await selectOption(page, "Anatomical Region", "head");
    await selectOption(page, "Patient Age Group", "adult");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("Error");
    await expect(results).toContainText("valid DLP value");
  });

  test("Should show error for zero DLP value", async ({ page }) => {
    await fillInput(page, "Dose Length Product (DLP)", "0");
    await selectOption(page, "Anatomical Region", "head");
    await selectOption(page, "Patient Age Group", "adult");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("Error");
  });

  test("Should show error for negative DLP value", async ({ page }) => {
    await fillInput(page, "Dose Length Product (DLP)", "-100");
    await selectOption(page, "Anatomical Region", "head");
    await selectOption(page, "Patient Age Group", "adult");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("Error");
  });

  test("Should show error for missing anatomical region", async ({ page }) => {
    await fillInput(page, "Dose Length Product (DLP)", "500");
    await selectOption(page, "Patient Age Group", "adult");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("Error");
    await expect(results).toContainText("anatomical region");
  });

  test("Should default to adult when no age group selected", async ({
    page,
  }) => {
    await fillInput(page, "Dose Length Product (DLP)", "500");
    await selectOption(page, "Anatomical Region", "head");
    // Don't select age group - should default to adult

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    // Should use adult k-factor 0.0021
    await expect(results).toContainText("1.05 mSv");
    await expect(results).toContainText("Adult");
  });

  // ============================================
  // EDGE CASES
  // ============================================
  test("Edge Case: Very small DLP value (1 mGy·cm)", async ({ page }) => {
    await fillInput(page, "Dose Length Product (DLP)", "1");
    await selectOption(page, "Anatomical Region", "head");
    await selectOption(page, "Patient Age Group", "adult");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText("0.00 mSv");
  });

  test("Edge Case: Very large DLP value (5000 mGy·cm)", async ({ page }) => {
    await fillInput(page, "Dose Length Product (DLP)", "5000");
    await selectOption(page, "Anatomical Region", "abdomen_pelvis");
    await selectOption(page, "Patient Age Group", "adult");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    // 5000 × 0.015 = 75.00 mSv
    await expect(results).toContainText("75.00 mSv");
    await expect(results).toContainText("Dose Alert");
  });

  test("Edge Case: Decimal DLP value (123.45 mGy·cm)", async ({ page }) => {
    await fillInput(page, "Dose Length Product (DLP)", "123.45");
    await selectOption(page, "Anatomical Region", "chest");
    await selectOption(page, "Patient Age Group", "adult");

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    const results = page.locator('section[aria-live="polite"]');
    // 123.45 × 0.014 = 1.7283 mSv → 1.73 mSv
    await expect(results).toContainText("1.73 mSv");
  });

  // ============================================
  // REFERENCE LINKS
  // ============================================
  test("should verify all reference citations are accessible", async ({
    page,
  }) => {
    // Scroll to references section
    await page.locator('h3:has-text("References")').scrollIntoViewIfNeeded();

    // Verify references are present
    const refs = page.locator('section a[target="_blank"]');
    const refCount = await refs.count();
    expect(refCount).toBeGreaterThanOrEqual(4);

    // Verify key references are present
    await expect(
      page.locator('a:has-text("ICRP Publication 103")'),
    ).toBeVisible();
    await expect(page.locator('a:has-text("AAPM Report")')).toBeVisible();

    // Verify links have correct attributes
    const links = await refs.all();
    for (const link of links) {
      expect(await link.getAttribute("target")).toBe("_blank");
      expect(await link.getAttribute("rel")).toBe("noopener noreferrer");
    }
  });

  // ============================================
  // UI/UX TESTS
  // ============================================
  test("should maintain theme consistency", async ({ page }) => {
    await verifyThemeConsistency(page);

    // Verify calculator card is present
    const card = page.locator(".border.rounded-lg").first();
    await expect(card).toBeVisible();

    // Verify input fields have proper styling
    const dlpInput = page.locator('input[type="number"]');
    await expect(dlpInput).toBeVisible();

    // Verify select dropdowns are present
    const selects = page.locator("select");
    const selectCount = await selects.count();
    expect(selectCount).toBe(2);
  });

  test("should be responsive on mobile devices", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Verify sidebar is narrower on mobile (w-48 = 192px vs w-64 = 256px on desktop)
    const sidebar = page.locator("aside").first();
    const sidebarWidth = await sidebar.evaluate((el) => el.offsetWidth);
    expect(sidebarWidth).toBeLessThanOrEqual(192);

    // Verify calculator is still usable on mobile
    const dlpInput = page.locator('input[type="number"]');
    await expect(dlpInput).toBeVisible();

    const calculateBtn = page.locator('button:has-text("Calculate")');
    await expect(calculateBtn).toBeVisible();

    // Reset to desktop
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test("should handle rapid successive calculations", async ({ page }) => {
    // First calculation
    await fillInput(page, "Dose Length Product (DLP)", "500");
    await selectOption(page, "Anatomical Region", "head");
    await selectOption(page, "Patient Age Group", "adult");
    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    // Immediately change values and recalculate
    await fillInput(page, "Dose Length Product (DLP)", "1000");
    await selectOption(page, "Anatomical Region", "chest");
    await page.locator('button:has-text("Calculate")').click();

    // Verify results updated correctly
    const results = page.locator('section[aria-live="polite"]');
    // 1000 × 0.014 = 14.00 mSv
    await expect(results).toContainText("14.00 mSv");
  });

  test("should handle clearing inputs", async ({ page }) => {
    // Fill values
    await fillInput(page, "Dose Length Product (DLP)", "500");
    await selectOption(page, "Anatomical Region", "head");
    await selectOption(page, "Patient Age Group", "adult");

    // Calculate
    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    // Clear inputs
    await clearAllInputs(page);

    // Verify DLP input is cleared
    const dlpInput = page.locator('input[type="number"]');
    expect(await dlpInput.inputValue()).toBe("");
  });

  // ============================================
  // PERFORMANCE
  // ============================================
  test("Performance: Calculation speed", async ({ page }) => {
    await fillInput(page, "Dose Length Product (DLP)", "500");
    await selectOption(page, "Anatomical Region", "head");
    await selectOption(page, "Patient Age Group", "adult");

    const startTime = Date.now();
    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });
    const endTime = Date.now();

    const calculationTime = endTime - startTime;
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

    await fillInput(page, "Dose Length Product (DLP)", "500");
    await selectOption(page, "Anatomical Region", "head");
    await selectOption(page, "Patient Age Group", "adult");
    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    expect(consoleErrors).toHaveLength(0);
  });

  // ============================================
  // VISUAL REGRESSION
  // ============================================
  test("Visual Regression: Calculator appearance", async ({ page }) => {
    // Take screenshot of initial state
    await page.screenshot({
      path: "test-results/screenshots/dlp-dose-initial.png",
      fullPage: true,
    });

    // Fill in typical values
    await fillInput(page, "Dose Length Product (DLP)", "500");
    await selectOption(page, "Anatomical Region", "head");
    await selectOption(page, "Patient Age Group", "adult");

    // Take screenshot with values
    await page.screenshot({
      path: "test-results/screenshots/dlp-dose-filled.png",
      fullPage: true,
    });

    // Calculate and screenshot results
    await page.locator('button:has-text("Calculate")').click();
    await page.waitForSelector('section[aria-live="polite"]', {
      state: "visible",
    });

    await page.screenshot({
      path: "test-results/screenshots/dlp-dose-results.png",
      fullPage: true,
    });
  });
});
