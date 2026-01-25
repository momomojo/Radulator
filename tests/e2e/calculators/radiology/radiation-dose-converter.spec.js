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
      await expect(page.getByText("Absorbed Dose (Gy, rad)")).toBeVisible();
      await expect(page.getByText("Equivalent Dose (Sv, rem)")).toBeVisible();
      await expect(page.getByText("Activity (Bq, Ci)")).toBeVisible();
    });

    test("should have CT dose calculator checkbox", async ({ page }) => {
      await expect(page.getByText("Calculate CT Effective Dose")).toBeVisible();
    });
  });

  test.describe("Absorbed Dose Conversions", () => {
    test("should convert Gray to all absorbed dose units", async ({ page }) => {
      await page.getByText("Absorbed Dose (Gy, rad)").click();
      await page.fill('input[id="input_value"]', "1");
      await page.locator('select[id="absorbed_unit"]').selectOption("Gy");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Gray (Gy)")).toBeVisible();
      await expect(page.locator("text=1.0000 Gy")).toBeVisible();
      await expect(page.locator("text=1000 mGy")).toBeVisible();
      await expect(page.locator("text=100 cGy")).toBeVisible();
      await expect(page.locator("text=100 rad")).toBeVisible();
    });

    test("should convert milliGray correctly", async ({ page }) => {
      await page.getByText("Absorbed Dose (Gy, rad)").click();
      await page.fill('input[id="input_value"]', "500");
      await page.locator('select[id="absorbed_unit"]').selectOption("mGy");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=0.5000 Gy")).toBeVisible();
      await expect(page.locator("text=50 rad")).toBeVisible();
    });

    test("should convert rad to SI units", async ({ page }) => {
      await page.getByText("Absorbed Dose (Gy, rad)").click();
      await page.fill('input[id="input_value"]', "100");
      await page.locator('select[id="absorbed_unit"]').selectOption("rad");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=1.0000 Gy")).toBeVisible();
      await expect(page.locator("text=1000 mGy")).toBeVisible();
    });

    test("should show equivalent dose note for photons", async ({ page }) => {
      await page.getByText("Absorbed Dose (Gy, rad)").click();
      await page.fill('input[id="input_value"]', "1");
      await page.locator('select[id="absorbed_unit"]').selectOption("Gy");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=For X-rays/gamma")).toBeVisible();
      await expect(page.locator("text=1.0000 Sv")).toBeVisible();
      await expect(page.locator("text=For alpha particles")).toBeVisible();
      await expect(page.locator("text=20")).toBeVisible();
    });
  });

  test.describe("Equivalent Dose Conversions", () => {
    test("should convert Sievert to all equivalent dose units", async ({
      page,
    }) => {
      await page.getByText("Equivalent Dose (Sv, rem)").click();
      await page.fill('input[id="input_value"]', "0.001");
      await page.locator('select[id="equivalent_unit"]').selectOption("Sv");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Sievert (Sv)")).toBeVisible();
      await expect(page.locator("text=1 mSv")).toBeVisible();
      await expect(page.locator("text=1000")).toBeVisible();
      await expect(page.locator("text=0.1")).toBeVisible(); // rem
      await expect(page.locator("text=100")).toBeVisible(); // mrem
    });

    test("should convert millisievert correctly", async ({ page }) => {
      await page.getByText("Equivalent Dose (Sv, rem)").click();
      await page.fill('input[id="input_value"]', "10");
      await page.locator('select[id="equivalent_unit"]').selectOption("mSv");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=0.0100 Sv")).toBeVisible();
      await expect(page.locator("text=10000")).toBeVisible(); // uSv
      await expect(page.locator("text=1 rem")).toBeVisible();
    });

    test("should convert rem to SI units", async ({ page }) => {
      await page.getByText("Equivalent Dose (Sv, rem)").click();
      await page.fill('input[id="input_value"]', "5");
      await page.locator('select[id="equivalent_unit"]').selectOption("rem");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=0.0500 Sv")).toBeVisible();
      await expect(page.locator("text=50 mSv")).toBeVisible();
    });

    test("should show radiation weighting factor for alpha particles", async ({
      page,
    }) => {
      await page.getByText("Equivalent Dose (Sv, rem)").click();
      await page.fill('input[id="input_value"]', "1");
      await page.locator('select[id="equivalent_unit"]').selectOption("Sv");
      await page.locator('select[id="radiation_type"]').selectOption("alpha");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=wR Factor")).toBeVisible();
      await expect(page.locator("text=20")).toBeVisible();
      await expect(page.locator("text=Alpha particles")).toBeVisible();
      await expect(
        page.locator("text=Corresponding Absorbed Dose"),
      ).toBeVisible();
      await expect(page.locator("text=0.0500 Gy")).toBeVisible(); // 1 Sv / 20
    });

    test("should show dose context comparisons", async ({ page }) => {
      await page.getByText("Equivalent Dose (Sv, rem)").click();
      await page.fill('input[id="input_value"]', "5");
      await page.locator('select[id="equivalent_unit"]').selectOption("mSv");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Equivalent Background Radiation"),
      ).toBeVisible();
      await expect(page.locator("text=days")).toBeVisible();
      await expect(page.locator("text=Equivalent Chest X-rays")).toBeVisible();
      await expect(page.locator("text=chest X-rays")).toBeVisible();
    });

    test("should provide context for CT-range doses", async ({ page }) => {
      await page.getByText("Equivalent Dose (Sv, rem)").click();
      await page.fill('input[id="input_value"]', "6");
      await page.locator('select[id="equivalent_unit"]').selectOption("mSv");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=CT chest range")).toBeVisible();
    });
  });

  test.describe("Activity Conversions", () => {
    test("should convert Becquerel to all activity units", async ({ page }) => {
      await page.getByText("Activity (Bq, Ci)").click();
      await page.fill('input[id="input_value"]', "37000000");
      await page.locator('select[id="activity_unit"]').selectOption("Bq");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Activity Conversions")).toBeVisible();
      await expect(page.locator("text=37000 kBq")).toBeVisible();
      await expect(page.locator("text=37 MBq")).toBeVisible();
      await expect(page.locator("text=1 mCi")).toBeVisible();
    });

    test("should convert megabecquerel correctly", async ({ page }) => {
      await page.getByText("Activity (Bq, Ci)").click();
      await page.fill('input[id="input_value"]', "370");
      await page.locator('select[id="activity_unit"]').selectOption("MBq");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=10 mCi")).toBeVisible();
      await expect(page.locator("text=0.3700 GBq")).toBeVisible();
    });

    test("should convert Curie to SI units", async ({ page }) => {
      await page.getByText("Activity (Bq, Ci)").click();
      await page.fill('input[id="input_value"]', "1");
      await page.locator('select[id="activity_unit"]').selectOption("Ci");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=37 GBq")).toBeVisible();
      await expect(page.locator("text=1000 mCi")).toBeVisible();
    });

    test("should convert millicurie correctly", async ({ page }) => {
      await page.getByText("Activity (Bq, Ci)").click();
      await page.fill('input[id="input_value"]', "20");
      await page.locator('select[id="activity_unit"]').selectOption("mCi");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=740 MBq")).toBeVisible();
    });

    test("should show nuclear medicine context", async ({ page }) => {
      await page.getByText("Activity (Bq, Ci)").click();
      await page.fill('input[id="input_value"]', "400");
      await page.locator('select[id="activity_unit"]').selectOption("MBq");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Nuclear Medicine Context")).toBeVisible();
      await expect(page.locator("text=FDG PET")).toBeVisible();
    });

    test("should show quick reference", async ({ page }) => {
      await page.getByText("Activity (Bq, Ci)").click();
      await page.fill('input[id="input_value"]', "100");
      await page.locator('select[id="activity_unit"]').selectOption("MBq");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=1 mCi = 37 MBq")).toBeVisible();
    });
  });

  test.describe("CT Dose Calculation", () => {
    test("should calculate CT effective dose from DLP", async ({ page }) => {
      await page.getByText("Calculate CT Effective Dose").click();
      await page.fill('input[id="ctdi_vol"]', "10");
      await page.fill('input[id="scan_length"]', "30");
      await page.locator('select[id="body_region"]').selectOption("chest");
      await page.locator('select[id="patient_age"]').selectOption("adult");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=CT Dose Calculation")).toBeVisible();
      await expect(page.locator("text=DLP")).toBeVisible();
      await expect(page.locator("text=300")).toBeVisible(); // DLP = 10 * 30
      await expect(page.locator("text=mGy")).toBeVisible();
      await expect(page.locator("text=Estimated Effective Dose")).toBeVisible();
      // 300 mGy*cm * 0.014 = 4.2 mSv
      await expect(page.locator("text=4.20 mSv")).toBeVisible();
    });

    test("should show k-factor for body region", async ({ page }) => {
      await page.getByText("Calculate CT Effective Dose").click();
      await page.fill('input[id="ctdi_vol"]', "10");
      await page.fill('input[id="scan_length"]', "30");
      await page.locator('select[id="body_region"]').selectOption("head");
      await page.locator('select[id="patient_age"]').selectOption("adult");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=k-factor")).toBeVisible();
      await expect(page.locator("text=0.0021")).toBeVisible();
      await expect(page.locator("text=16 cm phantom")).toBeVisible();
    });

    test("should apply pediatric age multiplier", async ({ page }) => {
      await page.getByText("Calculate CT Effective Dose").click();
      await page.fill('input[id="ctdi_vol"]', "10");
      await page.fill('input[id="scan_length"]', "20");
      await page.locator('select[id="body_region"]').selectOption("abdomen");
      await page.locator('select[id="patient_age"]').selectOption("5yr");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Age Adjustment")).toBeVisible();
      await expect(page.locator("text=1.5x")).toBeVisible();
      await expect(page.locator("text=5 years")).toBeVisible();
      await expect(page.locator("text=Adult Effective Dose")).toBeVisible();
    });

    test("should show dose assessment compared to typical range", async ({
      page,
    }) => {
      await page.getByText("Calculate CT Effective Dose").click();
      await page.fill('input[id="ctdi_vol"]', "15");
      await page.fill('input[id="scan_length"]', "35");
      await page.locator('select[id="body_region"]').selectOption("chest");
      await page.locator('select[id="patient_age"]').selectOption("adult");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Typical chest CT")).toBeVisible();
      await expect(page.locator("text=4-8 mSv")).toBeVisible();
      await expect(page.locator("text=Assessment")).toBeVisible();
    });

    test("should show chest X-ray equivalent for CT dose", async ({ page }) => {
      await page.getByText("Calculate CT Effective Dose").click();
      await page.fill('input[id="ctdi_vol"]', "10");
      await page.fill('input[id="scan_length"]', "30");
      await page.locator('select[id="body_region"]').selectOption("chest");
      await page.locator('select[id="patient_age"]').selectOption("adult");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Equivalent Chest X-rays")).toBeVisible();
      await expect(
        page.locator("text=Equivalent Background Days"),
      ).toBeVisible();
    });

    test("should show important limitations note", async ({ page }) => {
      await page.getByText("Calculate CT Effective Dose").click();
      await page.fill('input[id="ctdi_vol"]', "10");
      await page.fill('input[id="scan_length"]', "30");
      await page.locator('select[id="body_region"]').selectOption("abdomen");
      await page.locator('select[id="patient_age"]').selectOption("adult");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Important Limitations")).toBeVisible();
      await expect(
        page.locator("text=Size-Specific Dose Estimates"),
      ).toBeVisible();
    });
  });

  test.describe("Reference Dose Display", () => {
    test("should show common reference doses when no conversion selected", async ({
      page,
    }) => {
      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Common Reference Doses")).toBeVisible();
      await expect(page.locator("text=Chest X-ray (PA)")).toBeVisible();
      await expect(page.locator("text=0.02 mSv")).toBeVisible();
      await expect(page.locator("text=CT Head")).toBeVisible();
      await expect(page.locator("text=CT Chest")).toBeVisible();
    });

    test("should show ICRP dose limits", async ({ page }) => {
      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Dose Limits")).toBeVisible();
      await expect(page.locator("text=Annual Background")).toBeVisible();
      await expect(page.locator("text=~3 mSv/year")).toBeVisible();
      await expect(
        page.locator("text=Occupational Annual Limit"),
      ).toBeVisible();
      await expect(page.locator("text=50 mSv/year")).toBeVisible();
    });
  });

  test.describe("Input Validation", () => {
    test("should show error for missing conversion mode", async ({ page }) => {
      await page.fill('input[id="input_value"]', "100");
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Please select a conversion mode"),
      ).toBeVisible();
    });

    test("should show error for missing input unit in absorbed dose", async ({
      page,
    }) => {
      await page.getByText("Absorbed Dose (Gy, rad)").click();
      await page.fill('input[id="input_value"]', "100");
      // Don't select unit
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Please select an input unit"),
      ).toBeVisible();
    });

    test("should handle zero input value", async ({ page }) => {
      await page.getByText("Absorbed Dose (Gy, rad)").click();
      await page.fill('input[id="input_value"]', "0");
      await page.locator('select[id="absorbed_unit"]').selectOption("Gy");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=0 Gy")).toBeVisible();
      await expect(page.locator("text=0 mGy")).toBeVisible();
    });

    test("should handle very small values with scientific notation", async ({
      page,
    }) => {
      await page.getByText("Equivalent Dose (Sv, rem)").click();
      await page.fill('input[id="input_value"]', "0.00001");
      await page.locator('select[id="equivalent_unit"]').selectOption("Sv");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=10")).toBeVisible();
      await expect(page.locator("text=mrem")).toBeVisible();
    });

    test("should handle very large values with scientific notation", async ({
      page,
    }) => {
      await page.getByText("Activity (Bq, Ci)").click();
      await page.fill('input[id="input_value"]', "1000000000000");
      await page.locator('select[id="activity_unit"]').selectOption("Bq");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=1000 GBq")).toBeVisible();
    });
  });

  test.describe("CT Dose with Unit Conversion", () => {
    test("should calculate both CT dose and unit conversion simultaneously", async ({
      page,
    }) => {
      // Set up unit conversion
      await page.getByText("Equivalent Dose (Sv, rem)").click();
      await page.fill('input[id="input_value"]', "5");
      await page.locator('select[id="equivalent_unit"]').selectOption("mSv");

      // Also enable CT dose
      await page.getByText("Calculate CT Effective Dose").click();
      await page.fill('input[id="ctdi_vol"]', "10");
      await page.fill('input[id="scan_length"]', "30");
      await page.locator('select[id="body_region"]').selectOption("chest");
      await page.locator('select[id="patient_age"]').selectOption("adult");

      await page.click('button:has-text("Calculate")');

      // Should show both sections
      await expect(
        page.locator("text=Equivalent Dose Conversions"),
      ).toBeVisible();
      await expect(page.locator("text=CT Dose Calculation")).toBeVisible();
    });
  });

  test.describe("References", () => {
    test("should display radiation dose references", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: "References" }),
      ).toBeVisible();
      await expect(page.getByText("ICRP Publication 103")).toBeVisible();
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
