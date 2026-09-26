/**
 * E2E coverage for the bounded Y-90 educational dosimetry calculator.
 * Clinical claims are intentionally limited to the approved scope text and
 * the separate single-treatment lung-dose reference check.
 */

import { test, expect } from "@playwright/test";
import { navigateToCalculator } from "../../../helpers/calculator-test-helper.js";

const calculatorName = "Y-90 Radioembolization Dosimetry";

async function openCalculator(page) {
  await navigateToCalculator(page, calculatorName);
  await expect(page.getByTestId("calculator-title").first()).toContainText(
    calculatorName,
  );
}

async function fillUniform(page, values = {}) {
  await page.locator('input[value="lobectomy"]').click();
  await page.locator('input[value="mird"]').click();
  await page.fill('input[id="segment_volume"]', values.segment_volume ?? "1000");
  await page.fill('input[id="target_dose"]', values.target_dose ?? "100");
  await page.fill('input[id="lung_shunt"]', values.lung_shunt ?? "10");
  await page.fill('input[id="vial_residual"]', values.vial_residual ?? "0");
  await page.locator('input[value="glass"]').click();
}

async function fillPartition(page, values = {}) {
  await page.locator('input[value="lobectomy"]').click();
  await page.locator('input[value="partition"]').click();
  await page.fill('input[id="segment_volume"]', values.segment_volume ?? "1000");
  await page.fill('input[id="tumor_volume"]', values.tumor_volume ?? "200");
  await page.fill('input[id="target_dose"]', values.target_dose ?? "300");
  await page.fill('input[id="lung_shunt"]', values.lung_shunt ?? "10");
  await page.fill('input[id="tn_ratio"]', values.tn_ratio ?? "3");
  await page.fill('input[id="vial_residual"]', values.vial_residual ?? "0");
  await page.locator('input[value="glass"]').click();
}

test.describe("Y-90 Radioembolization Dosimetry Calculator", () => {
  test("displays the bounded educational scope and supported controls", async ({ page }) => {
    await openCalculator(page);

    await expect(page.locator("text=Dosimetry calculator for Y-90 radioembolization")).toBeVisible();
    await expect(page.locator("text=MIRD Model: uniform dose across the selected perfused target volume")).toBeVisible();
    await expect(page.locator("text=No calibration-to-treatment decay or vial-order calculation.")).toBeVisible();
    await expect(page.locator('label:has-text("Treatment Intent")')).toBeVisible();
    await expect(page.locator('label:has-text("Dosimetry Model")')).toBeVisible();
    await expect(page.locator('label:has-text("Target Segment Volume")')).toBeVisible();
    await expect(page.locator('label:has-text("Target Dose")')).toBeVisible();
    await expect(page.locator('label:has-text("Lung Shunt Fraction")')).toBeVisible();
    await expect(page.locator('label:has-text("Expected Vial Residual")')).toBeVisible();
    await expect(page.getByRole("heading", { name: "References" })).toBeVisible();

    await expect(page.locator('input[id="tumor_volume"]')).toHaveCount(0);
    await expect(page.locator('input[id="tn_ratio"]')).toHaveCount(0);
    await page.locator('input[value="partition"]').click();
    await expect(page.locator('input[id="tumor_volume"]')).toBeVisible();
    await expect(page.locator('input[id="tn_ratio"]')).toBeVisible();
    await page.locator('input[value="mird"]').click();
    await expect(page.locator('input[id="tumor_volume"]')).toHaveCount(0);
    await expect(page.locator('input[id="tn_ratio"]')).toHaveCount(0);
  });

  test("retains radio controls and software-bound sublabels", async ({ page }) => {
    await openCalculator(page);
    await expect(page.locator('input[value="segmentectomy"]')).toBeVisible();
    await expect(page.locator('input[value="lobectomy"]')).toBeVisible();
    await expect(page.locator('input[value="glass"]')).toBeVisible();
    await expect(page.locator('input[value="resin"]')).toBeVisible();
    await expect(page.getByText("mL (10-2000)")).toBeVisible();
    await expect(page.getByText("Gy (80-800)")).toBeVisible();
    await expect(page.getByText("% (0-50)")).toBeVisible();
    await expect(page.getByText("kg (for BSA calculation)")).toBeVisible();
    await expect(page.getByText("cm (for BSA calculation)")).toBeVisible();
  });

  test("retains required radio and blank lung-shunt validation", async ({ page }) => {
    await openCalculator(page);
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("Treatment intent must be a supported option")).toBeVisible();

    await page.locator('input[value="lobectomy"]').click();
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("Dosimetry model must be a supported option")).toBeVisible();

    await page.locator('input[value="mird"]').click();
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("Microsphere type must be a supported option")).toBeVisible();

    await fillUniform(page, { lung_shunt: "" });
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("Lung shunt fraction is required and must be between 0-50%")).toBeVisible();
  });

  test("calculates uniform 100 Gy at 10% shunt with injected and treatment-time activity", async ({ page }) => {
    await openCalculator(page);
    await fillUniform(page);
    await page.getByRole("button", { name: "Calculate" }).click();

    await expect(page.getByText("═══ CALCULATED ACTIVITY ═══")).toBeVisible();
    await expect(page.getByText("Activity at Treatment Time: 2.30 GBq (62.3 mCi)")).toBeVisible();
    await expect(page.getByText("Expected Injected Activity: 2.30 GBq (62.3 mCi)")).toBeVisible();
    await expect(page.getByText("Required Energy: 103.0 J")).toBeVisible();
    await expect(page.getByText("Mean Segment Dose: 100.0 Gy")).toBeVisible();
    await expect(page.getByText("Estimated Lung Dose: 11.4 Gy")).toBeVisible();
    await expect(page.getByText("Treatment Suitability: Not assessed")).toBeVisible();
    await expect(page.getByText("At or below 30 Gy reference — not treatment clearance")).toBeVisible();
    await expect(page.locator("text=Activity to Order")).toHaveCount(0);
    await expect(page.locator("text=Recommended Vial Size")).toHaveCount(0);
    await expect(page.locator("text=Safety Status")).toHaveCount(0);
    await expect(page.locator("text=CONTRAINDICATION")).toHaveCount(0);
    await expect(page.locator("text=190 Gy")).toHaveCount(0);
  });

  test("residual changes treatment-time activity but not expected injection or lung dose", async ({ page }) => {
    await openCalculator(page);
    await fillUniform(page, { vial_residual: "10" });
    await page.getByRole("button", { name: "Calculate" }).click();

    await expect(page.getByText("Activity at Treatment Time: 2.56 GBq (69.2 mCi)")).toBeVisible();
    await expect(page.getByText("Expected Injected Activity: 2.30 GBq (62.3 mCi)")).toBeVisible();
    await expect(page.getByText("Estimated Lung Dose: 11.4 Gy")).toBeVisible();
  });

  test("calculates partition mass-weighting and T/N=1 equivalence", async ({ page }) => {
    await openCalculator(page);
    await fillPartition(page);
    await page.getByRole("button", { name: "Calculate" }).click();

    await expect(page.getByText("Activity at Treatment Time: 3.23 GBq (87.2 mCi)")).toBeVisible();
    await expect(page.getByText("Expected Injected Activity: 3.23 GBq (87.2 mCi)")).toBeVisible();
    await expect(page.getByText("Normal Tissue Dose: 100.0 Gy")).toBeVisible();
    await expect(page.getByText("Mean Segment Dose: 140.0 Gy")).toBeVisible();
    await expect(page.getByText("Estimated Lung Dose: 16.0 Gy")).toBeVisible();

    await page.locator('input[id="tn_ratio"]').fill("1");
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("Activity at Treatment Time: 6.91 GBq (186.8 mCi)")).toBeVisible();
    await expect(page.getByText("Normal Tissue Dose: 300.0 Gy")).toBeVisible();
    await expect(page.getByText("Mean Segment Dose: 300.0 Gy")).toBeVisible();
    await expect(page.getByText("Above 30 Gy reference — specialist review required")).toBeVisible();
  });

  test("uses the unrounded lung-dose boundary and never presents clearance", async ({ page }) => {
    await openCalculator(page);
    await fillUniform(page, { segment_volume: "1000", target_dose: "116.5", lung_shunt: "20" });
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("At or below 30 Gy reference — not treatment clearance")).toBeVisible();

    await page.fill('input[id="target_dose"]', "116.51");
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("Above 30 Gy reference — specialist review required")).toBeVisible();
    await expect(page.getByText("Treatment Suitability: Not assessed")).toBeVisible();
  });

  test("retains input validation and optional BSA without accepting malformed numeric text", async ({ page }) => {
    await openCalculator(page);
    await fillUniform(page, { segment_volume: "9" });
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("Target segment volume must be between 10-2000 mL")).toBeVisible();

    await fillUniform(page, { segment_volume: "1000" });
    await page.fill('input[id="patient_weight"]', "70");
    await page.fill('input[id="patient_height"]', "175");
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("Body Surface Area: 1.84 m²")).toBeVisible();

    await page.fill('input[id="segment_volume"]', "");
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText(/Target segment volume must be a finite number/)).toBeVisible();
  });

  test("retains partition and numeric range validation", async ({ page }) => {
    await openCalculator(page);
    await fillUniform(page, { target_dose: "79" });
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("Target dose must be between 80-800 Gy")).toBeVisible();

    await fillUniform(page, { lung_shunt: "51" });
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("Lung shunt fraction is required and must be between 0-50%")).toBeVisible();

    await fillUniform(page, { vial_residual: "21" });
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("Vial residual must be between 0-20%")).toBeVisible();

    await page.locator('input[value="partition"]').click();
    await page.fill('input[id="segment_volume"]', "1000");
    await page.fill('input[id="target_dose"]', "300");
    await page.fill('input[id="lung_shunt"]', "10");
    await page.fill('input[id="vial_residual"]', "0");
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText(/Tumor volume must be positive/)).toBeVisible();

    await page.fill('input[id="tumor_volume"]', "1001");
    await page.fill('input[id="tn_ratio"]', "3");
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText(/Tumor volume must be positive/)).toBeVisible();

    await page.fill('input[id="tumor_volume"]', "200");
    await page.fill('input[id="tn_ratio"]', "0");
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText(/Tumor-to-normal ratio must be between 1-50/)).toBeVisible();

    await page.fill('input[id="tn_ratio"]', "");
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText(/Tumor-to-normal ratio must be between 1-50/)).toBeVisible();

    await page.fill('input[id="tn_ratio"]', "51");
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText(/Tumor-to-normal ratio must be between 1-50/)).toBeVisible();
  });

  test("retains optional BSA omission behavior and boundary arithmetic", async ({ page }) => {
    await openCalculator(page);
    await fillUniform(page, { segment_volume: "10", target_dose: "80", lung_shunt: "0" });
    await page.fill('input[id="patient_weight"]', "70");
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("Body Surface Area")).toHaveCount(0);

    await page.fill('input[id="patient_weight"]', "501");
    await page.fill('input[id="patient_height"]', "175");
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("Patient weight must be between 0-500 kg if provided")).toBeVisible();

    await page.fill('input[id="patient_weight"]', "70");
    await page.fill('input[id="patient_height"]', "301");
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("Patient height must be between 0-300 cm if provided")).toBeVisible();

    await page.fill('input[id="patient_weight"]', "");
    await page.fill('input[id="patient_height"]', "175");
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("Body Surface Area")).toHaveCount(0);

    await fillUniform(page, { segment_volume: "2000", target_dose: "800", lung_shunt: "50" });
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("Activity at Treatment Time: 66.36 GBq (1793.5 mCi)")).toBeVisible();

    await page.fill('input[id="lung_shunt"]', "0");
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("Estimated Lung Dose: 0.0 Gy")).toBeVisible();
  });

  test("clears stale results before recalculation after model or dose changes", async ({ page }) => {
    await openCalculator(page);
    await fillUniform(page);
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("Activity at Treatment Time: 2.30 GBq (62.3 mCi)")).toBeVisible();

    await page.fill('input[id="target_dose"]', "101");
    await expect(page.getByRole("status", { name: "Calculator results" })).toHaveCount(0);
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByRole("status", { name: "Calculator results" })).toBeVisible();
    await expect(page.getByText("Mean Segment Dose: 101.0 Gy")).toBeVisible();
    await page.locator('input[value="partition"]').click();
    await expect(page.getByRole("status", { name: "Calculator results" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Copy results" })).toHaveCount(0);
  });

  test("retains reference links and organized result separators", async ({ page }) => {
    await openCalculator(page);
    await expect(page.getByRole("heading", { name: "References" })).toBeVisible();
    await expect(page.getByText(/EANM procedure guideline for the treatment of liver cancer/)).toBeVisible();
    await expect(page.getByText("TheraSphere Y-90 Glass Microspheres FDA eIFU P200029S011C")).toBeVisible();
    await fillUniform(page);
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("═══ CALCULATED ACTIVITY ═══")).toBeVisible();
    await expect(page.getByText("═══ DOSIMETRY RESULTS ═══")).toBeVisible();
    await expect(page.getByText("═══ LUNG DOSE CHECK ═══")).toBeVisible();
  });

  test("keeps copy-button feedback available across browsers", async ({ page }) => {
    await page.addInitScript(() => {
      const writes = [];
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async (value) => writes.push(value) },
      });
      window.__radulatorClipboardWrites = writes;
    });
    await openCalculator(page);
    await fillUniform(page);
    await page.getByRole("button", { name: "Calculate" }).click();
    await page.getByRole("button", { name: "Copy results" }).click();
    await expect(page.getByRole("button", { name: "Results copied" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__radulatorClipboardWrites.length)).toBe(1);
  });

  test("copies the complete scope and validates the print layout", async ({ page, browserName }) => {
    if (browserName === "chromium") {
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    }
    await openCalculator(page);
    await fillUniform(page);
    await page.getByRole("button", { name: "Calculate" }).click();

    if (browserName === "chromium") {
      await page.getByRole("button", { name: "Copy results" }).click();
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toContain("Educational compartment dosimetry for clinician-selected targets. Assumes 1.0 kg lung mass and 1.03 g/mL liver density. Does not assess cumulative lung dose, hepatic reserve, extrahepatic deposition, product-specific eligibility, or treatment suitability. No calibration-to-treatment decay or vial-order calculation.");
      expect(clipboardText).toContain("Treatment Suitability");
      expect(clipboardText).not.toContain("Activity to Order");
      expect(clipboardText).not.toContain("Recommended Vial Size");
    }

    const skipLink = page.getByRole("link", { name: "Skip to calculator", exact: true });
    await skipLink.focus();
    await expect(skipLink).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await expect(skipLink).toBeHidden();
    await expect(page.getByText("Treatment Suitability: Not assessed")).toBeVisible();
    await expect(page.getByRole("status", { name: "Calculator results" })).toContainText("Educational compartment dosimetry for clinician-selected targets.");
    await expect(page.locator("aside")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Calculate" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Print Results" })).not.toBeVisible();

    await page.emulateMedia({ media: "screen" });
    await page.evaluate(() => {
      window.__radulatorPrintCalls = 0;
      window.print = () => {
        window.__radulatorPrintCalls += 1;
      };
    });
    await page.getByRole("button", { name: "Print Results" }).click();
    await expect.poll(() => page.evaluate(() => window.__radulatorPrintCalls)).toBe(1);
  });
});
