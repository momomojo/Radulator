/**
 * Radiation Dose Converter Calculator - E2E Tests
 *
 * Tests the comprehensive radiation dose unit converter with support for:
 * - Absorbed dose (Gy, rad)
 * - Equivalent dose (Sv, rem)
 * - Activity (Bq, Ci)
 * - CT effective dose estimation from DLP
 *
 * Test Coverage:
 * - Absorbed dose conversions
 * - Equivalent dose conversions with wR factors
 * - Activity conversions (SI and legacy units)
 * - CT dose calculation from CTDIvol and scan length
 * - Pediatric age adjustments
 * - Dose context comparisons
 * - Reference doses display
 * - Input validation
 * - Reference verification
 */

import { test, expect } from "@playwright/test";
import {
  navigateToCalculator,
  verifyThemeConsistency,
  verifyMobileResponsive,
} from "../../../helpers/calculator-test-helper.js";

const CALCULATOR_NAME = "Radiation Dose Converter";

test.describe("Radiation Dose Converter Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, CALCULATOR_NAME);

    // Verify calculator loaded
    await expect(page.locator("h2")).toContainText("Radiation Dose Converter");
  });

  test.describe("Visual and UI Tests", () => {
    test("should display calculator with correct title and description", async ({
      page,
    }) => {
      await expect(page.locator("h2")).toContainText(
        "Radiation Dose Converter",
      );
      await expect(
        page.getByText("Convert between radiation dose units"),
      ).toBeVisible();
    });

    test("should display info section with unit relationships", async ({
      page,
    }) => {
      await expect(page.getByText("1 Gy = 100 rad")).toBeVisible();
      await expect(page.getByText("1 Sv = 100 rem")).toBeVisible();
      await expect(page.getByText("1 Ci = 37 GBq")).toBeVisible();
    });

    test("should have conversion mode selector", async ({ page }) => {
      await expect(page.getByText("Conversion Mode")).toBeVisible();
      await expect(
        page.locator('label[for="conversion_mode-absorbed"]'),
      ).toBeVisible();
      await expect(
        page.locator('label[for="conversion_mode-equivalent"]'),
      ).toBeVisible();
      await expect(
        page.locator('label[for="conversion_mode-activity"]'),
      ).toBeVisible();
    });

    test("should have CT dose calculator checkbox", async ({ page }) => {
      await expect(page.locator('label[for="include_ct_dose"]')).toBeVisible();
    });
  });

  test.describe("Absorbed Dose Conversions", () => {
    test("should convert Gray to all absorbed dose units", async ({ page }) => {
      await page.locator('label[for="conversion_mode-absorbed"]').click();
      await page.fill('input[id="input_value"]', "1");
      await page.locator('select[id="absorbed_unit"]').selectOption("Gy");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Gray (Gy)").first()).toBeVisible();
      await expect(results.locator("text=1 Gy").first()).toBeVisible();
      await expect(results.locator("text=1000 mGy").first()).toBeVisible();
      await expect(results.locator("text=100 cGy").first()).toBeVisible();
      await expect(results.locator("text=100 rad").first()).toBeVisible();
    });

    test("should convert milliGray correctly", async ({ page }) => {
      await page.locator('label[for="conversion_mode-absorbed"]').click();
      await page.fill('input[id="input_value"]', "500");
      await page.locator('select[id="absorbed_unit"]').selectOption("mGy");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=0.5 Gy").first()).toBeVisible();
      await expect(results.locator("text=50 rad").first()).toBeVisible();
    });

    test("should convert rad to SI units", async ({ page }) => {
      await page.locator('label[for="conversion_mode-absorbed"]').click();
      await page.fill('input[id="input_value"]', "100");
      await page.locator('select[id="absorbed_unit"]').selectOption("rad");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=1 Gy").first()).toBeVisible();
      await expect(results.locator("text=1000 mGy").first()).toBeVisible();
    });

    test("should show equivalent dose note for photons", async ({ page }) => {
      await page.locator('label[for="conversion_mode-absorbed"]').click();
      await page.fill('input[id="input_value"]', "1");
      await page.locator('select[id="absorbed_unit"]').selectOption("Gy");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=For X-rays/gamma").first(),
      ).toBeVisible();
      await expect(results.locator("text=1 Sv").first()).toBeVisible();
      await expect(
        results.locator("text=For alpha particles").first(),
      ).toBeVisible();
      await expect(results.locator("text=20").first()).toBeVisible();
    });
  });

  test.describe("Equivalent Dose Conversions", () => {
    test("should convert Sievert to all equivalent dose units", async ({
      page,
    }) => {
      await page.locator('label[for="conversion_mode-equivalent"]').click();
      await page.fill('input[id="input_value"]', "0.001");
      await page.locator('select[id="equivalent_unit"]').selectOption("Sv");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Sievert (Sv)").first()).toBeVisible();
      await expect(results.locator("text=1 mSv").first()).toBeVisible();
      await expect(results.locator("text=1000").first()).toBeVisible();
      await expect(results.locator("text=0.1").first()).toBeVisible(); // rem
      await expect(results.locator("text=100").first()).toBeVisible(); // mrem
    });

    test("should convert millisievert correctly", async ({ page }) => {
      await page.locator('label[for="conversion_mode-equivalent"]').click();
      await page.fill('input[id="input_value"]', "10");
      await page.locator('select[id="equivalent_unit"]').selectOption("mSv");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=0.01 Sv").first()).toBeVisible();
      await expect(results.locator("text=10000").first()).toBeVisible(); // uSv
      await expect(results.locator("text=1 rem").first()).toBeVisible();
    });

    test("should convert rem to SI units", async ({ page }) => {
      await page.locator('label[for="conversion_mode-equivalent"]').click();
      await page.fill('input[id="input_value"]', "5");
      await page.locator('select[id="equivalent_unit"]').selectOption("rem");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=0.05 Sv").first()).toBeVisible();
      await expect(results.locator("text=50 mSv").first()).toBeVisible();
    });

    test("should show radiation weighting factor for alpha particles", async ({
      page,
    }) => {
      await page.locator('label[for="conversion_mode-equivalent"]').click();
      await page.fill('input[id="input_value"]', "1");
      await page.locator('select[id="equivalent_unit"]').selectOption("Sv");
      await page.locator('select[id="radiation_type"]').selectOption("alpha");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=wR Factor").first()).toBeVisible();
      await expect(results.locator("text=20").first()).toBeVisible();
      await expect(
        results.locator("text=Alpha particles").first(),
      ).toBeVisible();
      await expect(
        results.locator("text=Corresponding Absorbed Dose").first(),
      ).toBeVisible();
      await expect(results.locator("text=0.05 Gy").first()).toBeVisible(); // 1 Sv / 20
    });

    test("should show dose context comparisons", async ({ page }) => {
      await page.locator('label[for="conversion_mode-equivalent"]').click();
      await page.fill('input[id="input_value"]', "5");
      await page.locator('select[id="equivalent_unit"]').selectOption("mSv");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=Equivalent Background Radiation").first(),
      ).toBeVisible();
      await expect(results.locator("text=days").first()).toBeVisible();
      await expect(
        results.locator("text=Equivalent Chest X-rays").first(),
      ).toBeVisible();
      await expect(results.locator("text=chest X-rays").first()).toBeVisible();
    });

    test("should provide context for CT-range doses", async ({ page }) => {
      await page.locator('label[for="conversion_mode-equivalent"]').click();
      await page.fill('input[id="input_value"]', "6");
      await page.locator('select[id="equivalent_unit"]').selectOption("mSv");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=CT chest range").first(),
      ).toBeVisible();
    });
  });

  test.describe("Activity Conversions", () => {
    test("should convert Becquerel to all activity units", async ({ page }) => {
      await page.locator('label[for="conversion_mode-activity"]').click();
      await page.fill('input[id="input_value"]', "37000000");
      await page.locator('select[id="activity_unit"]').selectOption("Bq");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=Activity Conversions").first(),
      ).toBeVisible();
      await expect(results.locator("text=37000 kBq").first()).toBeVisible();
      await expect(results.locator("text=37 MBq").first()).toBeVisible();
      await expect(results.locator("text=1 mCi").first()).toBeVisible();
    });

    test("should convert megabecquerel correctly", async ({ page }) => {
      await page.locator('label[for="conversion_mode-activity"]').click();
      await page.fill('input[id="input_value"]', "370");
      await page.locator('select[id="activity_unit"]').selectOption("MBq");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=10 mCi").first()).toBeVisible();
      await expect(results.locator("text=0.37 GBq").first()).toBeVisible();
    });

    test("should convert Curie to SI units", async ({ page }) => {
      await page.locator('label[for="conversion_mode-activity"]').click();
      await page.fill('input[id="input_value"]', "1");
      await page.locator('select[id="activity_unit"]').selectOption("Ci");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=37 GBq").first()).toBeVisible();
      await expect(results.locator("text=1000 mCi").first()).toBeVisible();
    });

    test("should convert millicurie correctly", async ({ page }) => {
      await page.locator('label[for="conversion_mode-activity"]').click();
      await page.fill('input[id="input_value"]', "20");
      await page.locator('select[id="activity_unit"]').selectOption("mCi");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=740 MBq").first()).toBeVisible();
    });

    test("should show nuclear medicine context", async ({ page }) => {
      await page.locator('label[for="conversion_mode-activity"]').click();
      await page.fill('input[id="input_value"]', "400");
      await page.locator('select[id="activity_unit"]').selectOption("MBq");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=Nuclear Medicine Context").first(),
      ).toBeVisible();
      await expect(results.locator("text=FDG PET").first()).toBeVisible();
    });

    test("should show quick reference", async ({ page }) => {
      await page.locator('label[for="conversion_mode-activity"]').click();
      await page.fill('input[id="input_value"]', "100");
      await page.locator('select[id="activity_unit"]').selectOption("MBq");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=1 mCi = 37 MBq").first(),
      ).toBeVisible();
    });
  });

  test.describe("CT Dose Calculation", () => {
    test("should calculate CT effective dose from DLP", async ({ page }) => {
      await page.locator('label[for="include_ct_dose"]').click();
      await page.fill('input[id="ctdi_vol"]', "10");
      await page.fill('input[id="scan_length"]', "30");
      await page.locator('select[id="body_region"]').selectOption("chest");
      await page.locator('select[id="patient_age"]').selectOption("adult");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=CT Dose Calculation").first(),
      ).toBeVisible();
      await expect(results.locator("text=DLP").first()).toBeVisible();
      await expect(results.locator("text=300").first()).toBeVisible(); // DLP = 10 * 30
      await expect(results.locator("text=mGy").first()).toBeVisible();
      await expect(
        results.locator("text=Estimated Effective Dose").first(),
      ).toBeVisible();
      // 300 mGy*cm * 0.014 = 4.2 mSv
      await expect(results.locator("text=4.20 mSv").first()).toBeVisible();
    });

    test("should show k-factor for body region", async ({ page }) => {
      await page.locator('label[for="include_ct_dose"]').click();
      await page.fill('input[id="ctdi_vol"]', "10");
      await page.fill('input[id="scan_length"]', "30");
      await page.locator('select[id="body_region"]').selectOption("head");
      await page.locator('select[id="patient_age"]').selectOption("adult");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=k-factor").first()).toBeVisible();
      await expect(results.locator("text=0.0021").first()).toBeVisible();
      await expect(results.locator("text=16 cm phantom").first()).toBeVisible();
    });

    test("should apply pediatric age multiplier", async ({ page }) => {
      await page.locator('label[for="include_ct_dose"]').click();
      await page.fill('input[id="ctdi_vol"]', "10");
      await page.fill('input[id="scan_length"]', "20");
      await page.locator('select[id="body_region"]').selectOption("abdomen");
      await page.locator('select[id="patient_age"]').selectOption("5yr");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=Age Adjustment").first(),
      ).toBeVisible();
      await expect(results.locator("text=1.5×").first()).toBeVisible();
      await expect(results.locator("text=5 years").first()).toBeVisible();
      await expect(
        results.locator("text=Adult Effective Dose").first(),
      ).toBeVisible();
    });

    test("should show dose assessment compared to typical range", async ({
      page,
    }) => {
      await page.locator('label[for="include_ct_dose"]').click();
      await page.fill('input[id="ctdi_vol"]', "15");
      await page.fill('input[id="scan_length"]', "35");
      await page.locator('select[id="body_region"]').selectOption("chest");
      await page.locator('select[id="patient_age"]').selectOption("adult");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=Typical chest CT").first(),
      ).toBeVisible();
      await expect(results.locator("text=4-8 mSv").first()).toBeVisible();
      await expect(results.locator("text=Assessment").first()).toBeVisible();
    });

    test("should show chest X-ray equivalent for CT dose", async ({ page }) => {
      await page.locator('label[for="include_ct_dose"]').click();
      await page.fill('input[id="ctdi_vol"]', "10");
      await page.fill('input[id="scan_length"]', "30");
      await page.locator('select[id="body_region"]').selectOption("chest");
      await page.locator('select[id="patient_age"]').selectOption("adult");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=Equivalent Chest X-rays").first(),
      ).toBeVisible();
      await expect(
        results.locator("text=Equivalent Background Days").first(),
      ).toBeVisible();
    });

    test("should show important limitations note", async ({ page }) => {
      await page.locator('label[for="include_ct_dose"]').click();
      await page.fill('input[id="ctdi_vol"]', "10");
      await page.fill('input[id="scan_length"]', "30");
      await page.locator('select[id="body_region"]').selectOption("abdomen");
      await page.locator('select[id="patient_age"]').selectOption("adult");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=Important Limitations").first(),
      ).toBeVisible();
      await expect(
        results.locator("text=Size-Specific Dose Estimates").first(),
      ).toBeVisible();
    });
  });

  test.describe("Reference Dose Display", () => {
    test("should show common reference doses when no conversion selected", async ({
      page,
    }) => {
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=Common Reference Doses").first(),
      ).toBeVisible();
      await expect(
        results.locator("text=Chest X-ray (PA)").first(),
      ).toBeVisible();
      await expect(results.locator("text=0.02 mSv").first()).toBeVisible();
      await expect(results.locator("text=CT Head").first()).toBeVisible();
      await expect(results.locator("text=CT Chest").first()).toBeVisible();
    });

    test("should show ICRP dose limits", async ({ page }) => {
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Dose Limits").first()).toBeVisible();
      await expect(
        results.locator("text=Annual Background").first(),
      ).toBeVisible();
      await expect(results.locator("text=~3 mSv/year").first()).toBeVisible();
      await expect(
        results.locator("text=Occupational Annual Limit").first(),
      ).toBeVisible();
      await expect(results.locator("text=50 mSv/year").first()).toBeVisible();
    });
  });

  test.describe("Input Validation", () => {
    test("should show error for missing conversion mode", async ({ page }) => {
      await page.fill('input[id="input_value"]', "100");
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=Please select a conversion mode").first(),
      ).toBeVisible();
    });

    test("should show error for missing input unit in absorbed dose", async ({
      page,
    }) => {
      await page.locator('label[for="conversion_mode-absorbed"]').click();
      await page.fill('input[id="input_value"]', "100");
      // Don't select unit
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=Please select an input unit").first(),
      ).toBeVisible();
    });

    test("should handle zero input value", async ({ page }) => {
      await page.locator('label[for="conversion_mode-absorbed"]').click();
      await page.fill('input[id="input_value"]', "0");
      await page.locator('select[id="absorbed_unit"]').selectOption("Gy");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=0 Gy").first()).toBeVisible();
      await expect(results.locator("text=0 mGy").first()).toBeVisible();
    });

    test("should handle very small values with scientific notation", async ({
      page,
    }) => {
      await page.locator('label[for="conversion_mode-equivalent"]').click();
      await page.fill('input[id="input_value"]', "0.00001");
      await page.locator('select[id="equivalent_unit"]').selectOption("Sv");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=10").first()).toBeVisible();
      await expect(results.locator("text=mrem").first()).toBeVisible();
    });

    test("should handle very large values with scientific notation", async ({
      page,
    }) => {
      await page.locator('label[for="conversion_mode-activity"]').click();
      await page.fill('input[id="input_value"]', "1000000000000");
      await page.locator('select[id="activity_unit"]').selectOption("Bq");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=1000 GBq").first()).toBeVisible();
    });
  });

  test.describe("CT Dose with Unit Conversion", () => {
    test("should calculate both CT dose and unit conversion simultaneously", async ({
      page,
    }) => {
      // Set up unit conversion
      await page.locator('label[for="conversion_mode-equivalent"]').click();
      await page.fill('input[id="input_value"]', "5");
      await page.locator('select[id="equivalent_unit"]').selectOption("mSv");

      // Also enable CT dose
      await page.locator('label[for="include_ct_dose"]').click();
      await page.fill('input[id="ctdi_vol"]', "10");
      await page.fill('input[id="scan_length"]', "30");
      await page.locator('select[id="body_region"]').selectOption("chest");
      await page.locator('select[id="patient_age"]').selectOption("adult");

      await page.click('button:has-text("Calculate")');

      // Should show both sections
      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=Equivalent Dose Conversions").first(),
      ).toBeVisible();
      await expect(
        results.locator("text=CT Dose Calculation").first(),
      ).toBeVisible();
    });
  });

  test.describe("References", () => {
    test("should display radiation dose references", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: "References" }),
      ).toBeVisible();
      await expect(
        page.getByText("ICRP Publication 103").first(),
      ).toBeVisible();
    });

    test("should have link to ICRP Publication 103", async ({ page }) => {
      const icrpLink = page.locator('a[href*="icrp.org"]');
      await expect(icrpLink.first()).toBeVisible();
    });

    test("should have reference to AAPM Report 96", async ({ page }) => {
      await expect(page.getByText("AAPM Report")).toBeVisible();
    });
  });

  test.describe("Responsiveness and Theme", () => {
    test("should maintain theme consistency", async ({ page }) => {
      await verifyThemeConsistency(page);
    });

    test("should be responsive on mobile devices", async ({ page }) => {
      await verifyMobileResponsive(page);

      // Verify calculator is still usable on mobile
      await expect(page.locator("h2")).toContainText("Radiation");
      await expect(page.locator('button:has-text("Calculate")')).toBeVisible();
    });
  });
});
