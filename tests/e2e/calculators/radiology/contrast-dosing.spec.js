/**
 * IV Contrast Dosing Calculator - E2E Tests
 *
 * Tests the iodinated contrast dosing calculator for CT studies with
 * weight-based dosing, lean body weight adjustment, and renal risk assessment.
 *
 * Test Coverage:
 * - Weight-based dosing calculations (TBW and LBW)
 * - BMI calculation and LBW adjustment for BMI >= 30
 * - Iodine Delivery Rate (IDR) calculations
 * - Flow rate recommendations by IV access type
 * - eGFR-based renal risk stratification (ACR/NKF 2020)
 * - Unit conversions (kg/lbs, cm/in)
 * - Study type protocol variations
 * - Maximum volume capping
 * - Input validation
 * - Reference verification
 */

import { test, expect } from "@playwright/test";
import {
  navigateToCalculator,
  fillInput,
  selectOption,
  verifyThemeConsistency,
  verifyMobileResponsive,
} from "../../../helpers/calculator-test-helper.js";

const CALCULATOR_NAME = "IV Contrast Dosing";

test.describe("IV Contrast Dosing Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, CALCULATOR_NAME);

    // Verify calculator loaded
    await expect(page.locator("h2")).toContainText("IV Contrast Dosing");
  });

  test.describe("Visual and UI Tests", () => {
    test("should display calculator with correct title and description", async ({
      page,
    }) => {
      await expect(page.locator("h2")).toContainText("IV Contrast Dosing");
      await expect(
        page.getByText("iodinated contrast dosing calculator"),
      ).toBeVisible();
    });

    test("should display info section with dosing explanation", async ({
      page,
    }) => {
      await expect(page.getByText("Weight-based dosing")).toBeVisible();
      await expect(page.getByText("Iodine Delivery Rate")).toBeVisible();
      await expect(page.getByText("eGFR-based")).toBeVisible();
    });

    test("should have all required input fields", async ({ page }) => {
      // Patient demographics
      await expect(page.getByText("Weight Unit")).toBeVisible();
      await expect(page.getByText("Patient Weight")).toBeVisible();
      await expect(page.getByText("Height Unit")).toBeVisible();
      await expect(page.getByText("Patient Height")).toBeVisible();
      await expect(page.getByText("Sex")).toBeVisible();

      // Renal function
      await expect(page.getByText("eGFR")).toBeVisible();

      // Contrast selection
      await expect(page.getByText("Contrast Agent")).toBeVisible();
      await expect(page.getByText("Study Type")).toBeVisible();
      await expect(page.getByText("IV Access Type")).toBeVisible();
    });
  });

  test.describe("Standard Weight Dosing (BMI < 30)", () => {
    test("should calculate contrast volume for routine CT in normal BMI patient", async ({
      page,
    }) => {
      // Patient: 70kg, 175cm, male (BMI ~22.9)
      await page.getByText("Kilograms (kg)").click();
      await page.fill('input[id="weight"]', "70");
      await page.getByText("Centimeters (cm)").click();
      await page.fill('input[id="height"]', "175");
      await page.getByText("Male").click();

      // Standard setup
      await page.locator('select[id="contrast_agent"]').selectOption("300");
      await page.locator('select[id="study_type"]').selectOption("routine");
      await page.locator('select[id="iv_access"]').selectOption("20g");

      await page.click('button:has-text("Calculate")');

      // 70kg * 400 mg I/kg / 300 mg I/mL = ~93 mL
      await expect(
        page.locator("text=Recommended Contrast Volume"),
      ).toBeVisible();
      await expect(page.locator("text=93 mL")).toBeVisible();
      await expect(page.locator("text=Total Body Weight")).toBeVisible();
    });

    test("should calculate contrast volume for hepatic CT", async ({
      page,
    }) => {
      // Patient: 70kg, 175cm, male
      await page.getByText("Kilograms (kg)").click();
      await page.fill('input[id="weight"]', "70");
      await page.getByText("Centimeters (cm)").click();
      await page.fill('input[id="height"]', "175");
      await page.getByText("Male").click();

      // Hepatic CT (550 mg I/kg)
      await page.locator('select[id="contrast_agent"]').selectOption("350");
      await page.locator('select[id="study_type"]').selectOption("hepatic");
      await page.locator('select[id="iv_access"]').selectOption("18g");

      await page.click('button:has-text("Calculate")');

      // 70kg * 550 mg I/kg / 350 mg I/mL = 110 mL
      await expect(page.locator("text=110 mL")).toBeVisible();
      await expect(page.locator("text=550 mg I/kg")).toBeVisible();
    });

    test("should calculate contrast volume for CTA", async ({ page }) => {
      // Patient: 80kg, 180cm, male
      await page.getByText("Kilograms (kg)").click();
      await page.fill('input[id="weight"]', "80");
      await page.getByText("Centimeters (cm)").click();
      await page.fill('input[id="height"]', "180");
      await page.getByText("Male").click();

      // CTA (350 mg I/kg)
      await page.locator('select[id="contrast_agent"]').selectOption("370");
      await page.locator('select[id="study_type"]').selectOption("cta");
      await page.locator('select[id="iv_access"]').selectOption("18g");

      await page.click('button:has-text("Calculate")');

      // 80kg * 350 mg I/kg / 370 mg I/mL = ~76 mL
      await expect(page.locator("text=76 mL")).toBeVisible();
      await expect(
        page.locator("text=bolus tracking or test bolus"),
      ).toBeVisible();
    });
  });

  test.describe("Lean Body Weight Dosing (BMI >= 30)", () => {
    test("should use LBW-based dosing for obese patient", async ({ page }) => {
      // Patient: 110kg, 170cm, male (BMI ~38)
      await page.getByText("Kilograms (kg)").click();
      await page.fill('input[id="weight"]', "110");
      await page.getByText("Centimeters (cm)").click();
      await page.fill('input[id="height"]', "170");
      await page.getByText("Male").click();

      await page.locator('select[id="contrast_agent"]').selectOption("300");
      await page.locator('select[id="study_type"]').selectOption("routine");
      await page.locator('select[id="iv_access"]').selectOption("20g");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=LBW")).toBeVisible();
      await expect(page.locator("text=BMI")).toBeVisible();
      await expect(page.locator("text=630 mg I/kg")).toBeVisible();
      await expect(page.locator("text=Volume reduced")).toBeVisible();
    });

    test("should calculate LBW correctly using Boer formula for female", async ({
      page,
    }) => {
      // Patient: 100kg, 165cm, female (BMI ~36.7)
      await page.getByText("Kilograms (kg)").click();
      await page.fill('input[id="weight"]', "100");
      await page.getByText("Centimeters (cm)").click();
      await page.fill('input[id="height"]', "165");
      await page.getByText("Female").click();

      await page.locator('select[id="contrast_agent"]').selectOption("300");
      await page.locator('select[id="study_type"]').selectOption("routine");
      await page.locator('select[id="iv_access"]').selectOption("20g");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=LBW (BMI")).toBeVisible();
      // Female LBW = 0.252 * 100 + 0.473 * 165 - 48.3 = ~56.5 kg
      await expect(page.locator("text=Body Composition")).toBeVisible();
    });
  });

  test.describe("Unit Conversions", () => {
    test("should convert pounds to kilograms correctly", async ({ page }) => {
      // Patient: 154 lbs = 70 kg
      await page.getByText("Pounds (lbs)").click();
      await page.fill('input[id="weight"]', "154");
      await page.getByText("Centimeters (cm)").click();
      await page.fill('input[id="height"]', "175");
      await page.getByText("Male").click();

      await page.locator('select[id="contrast_agent"]').selectOption("300");
      await page.locator('select[id="study_type"]').selectOption("routine");
      await page.locator('select[id="iv_access"]').selectOption("20g");

      await page.click('button:has-text("Calculate")');

      // Should be similar to 70kg result
      await expect(page.locator("text=93 mL")).toBeVisible();
      await expect(page.locator("text=TBW: 69.")).toBeVisible(); // ~69.9 kg
    });

    test("should convert inches to centimeters correctly", async ({ page }) => {
      // Patient: 70kg, 69 inches = 175.26 cm
      await page.getByText("Kilograms (kg)").click();
      await page.fill('input[id="weight"]', "70");
      await page.getByText("Inches (in)").click();
      await page.fill('input[id="height"]', "69");
      await page.getByText("Male").click();

      await page.locator('select[id="contrast_agent"]').selectOption("300");
      await page.locator('select[id="study_type"]').selectOption("routine");
      await page.locator('select[id="iv_access"]').selectOption("20g");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=93 mL")).toBeVisible();
    });
  });

  test.describe("Iodine Delivery Rate (IDR)", () => {
    test("should calculate IDR and show assessment for CTA", async ({
      page,
    }) => {
      await page.getByText("Kilograms (kg)").click();
      await page.fill('input[id="weight"]', "70");
      await page.getByText("Centimeters (cm)").click();
      await page.fill('input[id="height"]', "175");
      await page.getByText("Male").click();

      await page.locator('select[id="contrast_agent"]').selectOption("370");
      await page.locator('select[id="study_type"]').selectOption("cta");
      await page.locator('select[id="iv_access"]').selectOption("18g");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Iodine Delivery Rate")).toBeVisible();
      await expect(page.locator("text=g I/s")).toBeVisible();
    });

    test("should warn if IDR is below optimal for CTA", async ({ page }) => {
      await page.getByText("Kilograms (kg)").click();
      await page.fill('input[id="weight"]', "70");
      await page.getByText("Centimeters (cm)").click();
      await page.fill('input[id="height"]', "175");
      await page.getByText("Male").click();

      // Low concentration with restricted IV access
      await page.locator('select[id="contrast_agent"]').selectOption("300");
      await page.locator('select[id="study_type"]').selectOption("cta");
      await page.locator('select[id="iv_access"]').selectOption("22g_hand");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Below optimal for CTA")).toBeVisible();
      await expect(
        page.locator("text=consider higher concentration"),
      ).toBeVisible();
    });
  });

  test.describe("IV Access and Flow Rate", () => {
    test("should limit flow rate for hand/wrist IV", async ({ page }) => {
      await page.getByText("Kilograms (kg)").click();
      await page.fill('input[id="weight"]', "70");
      await page.getByText("Centimeters (cm)").click();
      await page.fill('input[id="height"]', "175");
      await page.getByText("Male").click();

      await page.locator('select[id="contrast_agent"]').selectOption("300");
      await page.locator('select[id="study_type"]').selectOption("routine");
      await page.locator('select[id="iv_access"]').selectOption("22g_hand");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=1.5 mL/s")).toBeVisible();
      await expect(
        page.locator("text=Hand/wrist IV: Flow rate limited"),
      ).toBeVisible();
    });

    test("should show appropriate flow rate for 18G access", async ({
      page,
    }) => {
      await page.getByText("Kilograms (kg)").click();
      await page.fill('input[id="weight"]', "70");
      await page.getByText("Centimeters (cm)").click();
      await page.fill('input[id="height"]', "175");
      await page.getByText("Male").click();

      await page.locator('select[id="contrast_agent"]').selectOption("370");
      await page.locator('select[id="study_type"]').selectOption("hepatic");
      await page.locator('select[id="iv_access"]').selectOption("18g");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=4-5 mL/s")).toBeVisible();
    });
  });

  test.describe("Renal Risk Assessment (eGFR)", () => {
    test("should show very low risk for eGFR >= 45", async ({ page }) => {
      await page.getByText("Kilograms (kg)").click();
      await page.fill('input[id="weight"]', "70");
      await page.getByText("Centimeters (cm)").click();
      await page.fill('input[id="height"]', "175");
      await page.getByText("Male").click();
      await page.fill('input[id="egfr"]', "60");

      await page.locator('select[id="contrast_agent"]').selectOption("300");
      await page.locator('select[id="study_type"]').selectOption("routine");
      await page.locator('select[id="iv_access"]').selectOption("20g");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Very Low Risk")).toBeVisible();
      await expect(
        page.locator("text=No special precautions needed"),
      ).toBeVisible();
    });

    test("should show low-moderate risk for eGFR 30-44", async ({ page }) => {
      await page.getByText("Kilograms (kg)").click();
      await page.fill('input[id="weight"]', "70");
      await page.getByText("Centimeters (cm)").click();
      await page.fill('input[id="height"]', "175");
      await page.getByText("Male").click();
      await page.fill('input[id="egfr"]', "38");

      await page.locator('select[id="contrast_agent"]').selectOption("300");
      await page.locator('select[id="study_type"]').selectOption("routine");
      await page.locator('select[id="iv_access"]').selectOption("20g");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Low-Moderate Risk")).toBeVisible();
      await expect(page.locator("text=IV hydration")).toBeVisible();
      await expect(page.locator("text=eGFR 30-44")).toBeVisible();
    });

    test("should show high risk for eGFR < 30", async ({ page }) => {
      await page.getByText("Kilograms (kg)").click();
      await page.fill('input[id="weight"]', "70");
      await page.getByText("Centimeters (cm)").click();
      await page.fill('input[id="height"]', "175");
      await page.getByText("Male").click();
      await page.fill('input[id="egfr"]', "25");

      await page.locator('select[id="contrast_agent"]').selectOption("300");
      await page.locator('select[id="study_type"]').selectOption("routine");
      await page.locator('select[id="iv_access"]').selectOption("20g");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=HIGH RISK")).toBeVisible();
      await expect(
        page.locator("text=IV saline prophylaxis strongly recommended"),
      ).toBeVisible();
      await expect(page.locator("text=contrast-associated AKI")).toBeVisible();
    });
  });

  test.describe("Volume Capping", () => {
    test("should cap volume at 150 mL for large patients", async ({ page }) => {
      // Very large patient
      await page.getByText("Kilograms (kg)").click();
      await page.fill('input[id="weight"]', "150");
      await page.getByText("Centimeters (cm)").click();
      await page.fill('input[id="height"]', "175");
      await page.getByText("Male").click();

      await page.locator('select[id="contrast_agent"]').selectOption("300");
      await page.locator('select[id="study_type"]').selectOption("hepatic");
      await page.locator('select[id="iv_access"]').selectOption("18g");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=150 mL")).toBeVisible();
      await expect(page.locator("text=Volume capped")).toBeVisible();
    });
  });

  test.describe("Input Validation", () => {
    test("should show error when patient demographics not provided", async ({
      page,
    }) => {
      await page.locator('select[id="contrast_agent"]').selectOption("300");
      await page.locator('select[id="study_type"]').selectOption("routine");
      await page.locator('select[id="iv_access"]').selectOption("20g");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Please enter patient weight, height, and sex"),
      ).toBeVisible();
    });

    test("should show error when contrast selection not complete", async ({
      page,
    }) => {
      await page.getByText("Kilograms (kg)").click();
      await page.fill('input[id="weight"]', "70");
      await page.getByText("Centimeters (cm)").click();
      await page.fill('input[id="height"]', "175");
      await page.getByText("Male").click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "text=Please select contrast agent, study type, and IV access",
        ),
      ).toBeVisible();
    });
  });

  test.describe("Protocol Notes", () => {
    test("should show hepatic protocol note", async ({ page }) => {
      await page.getByText("Kilograms (kg)").click();
      await page.fill('input[id="weight"]', "70");
      await page.getByText("Centimeters (cm)").click();
      await page.fill('input[id="height"]', "175");
      await page.getByText("Male").click();

      await page.locator('select[id="contrast_agent"]').selectOption("350");
      await page.locator('select[id="study_type"]').selectOption("hepatic");
      await page.locator('select[id="iv_access"]').selectOption("18g");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=High flow rate for optimal parenchymal enhancement"),
      ).toBeVisible();
    });

    test("should show warming recommendation", async ({ page }) => {
      await page.getByText("Kilograms (kg)").click();
      await page.fill('input[id="weight"]', "70");
      await page.getByText("Centimeters (cm)").click();
      await page.fill('input[id="height"]', "175");
      await page.getByText("Male").click();

      await page.locator('select[id="contrast_agent"]').selectOption("300");
      await page.locator('select[id="study_type"]').selectOption("routine");
      await page.locator('select[id="iv_access"]').selectOption("20g");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Warm contrast to 37")).toBeVisible();
    });

    test("should show injection duration and saline flush", async ({
      page,
    }) => {
      await page.getByText("Kilograms (kg)").click();
      await page.fill('input[id="weight"]', "70");
      await page.getByText("Centimeters (cm)").click();
      await page.fill('input[id="height"]', "175");
      await page.getByText("Male").click();

      await page.locator('select[id="contrast_agent"]').selectOption("300");
      await page.locator('select[id="study_type"]').selectOption("routine");
      await page.locator('select[id="iv_access"]').selectOption("20g");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Injection Duration")).toBeVisible();
      await expect(page.locator("text=seconds")).toBeVisible();
      await expect(page.locator("text=Saline Flush")).toBeVisible();
      await expect(page.locator("text=30 mL")).toBeVisible();
    });
  });

  test.describe("References", () => {
    test("should display contrast dosing references", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: "References" }),
      ).toBeVisible();
      await expect(page.getByText("ACR Manual")).toBeVisible();
    });

    test("should have link to ACR Manual on Contrast Media", async ({
      page,
    }) => {
      const acrLink = page.locator('a[href*="acr.org"]');
      await expect(acrLink.first()).toBeVisible();
    });

    test("should have reference to ACR/NKF consensus", async ({ page }) => {
      await expect(page.getByText("Davenport MS")).toBeVisible();
      await expect(page.getByText("National Kidney Foundation")).toBeVisible();
    });
  });

  test.describe("Responsiveness and Theme", () => {
    test("should maintain theme consistency", async ({ page }) => {
      await verifyThemeConsistency(page);
    });

    test("should be responsive on mobile devices", async ({ page }) => {
      await verifyMobileResponsive(page);

      // Verify calculator is still usable on mobile
      await expect(page.locator("h2")).toContainText("Contrast");
      await expect(page.locator('button:has-text("Calculate")')).toBeVisible();
    });
  });
});
