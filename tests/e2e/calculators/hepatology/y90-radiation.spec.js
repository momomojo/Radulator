/**
 * E2E coverage for the bounded Y-90 educational dosimetry calculator.
 * Clinical claims are intentionally limited to the approved scope text and
 * the separate single-treatment lung-dose reference check.
 */

import { test, expect } from "@playwright/test";
import { navigateToCalculator } from "../../../helpers/calculator-test-helper.js";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

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
    await fillUniform(page, { segment_volume: "1000", target_dose: "115", lung_shunt: "20" });
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByText("At or below 30 Gy reference — not treatment clearance")).toBeVisible();

    await page.fill('input[id="target_dose"]', "117");
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

  test("copies the complete scope and prints the current result layout", async ({ page }) => {
    await openCalculator(page);
    await fillUniform(page);
    await page.getByRole("button", { name: "Calculate" }).click();

    await page.getByRole("button", { name: "Copy results" }).click();
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain("Educational compartment dosimetry for clinician-selected targets.");
    expect(clipboardText).toContain("Treatment Suitability");
    expect(clipboardText).not.toContain("Activity to Order");
    expect(clipboardText).not.toContain("Recommended Vial Size");

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
