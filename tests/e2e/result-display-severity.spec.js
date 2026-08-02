import { test, expect } from "@playwright/test";
import {
  fillInput,
  navigateToCalculator,
} from "../helpers/calculator-test-helper.js";

function resultRegion(page) {
  return page.getByRole("status", { name: "Calculator results" });
}

function primaryResultCard(page) {
  return resultRegion(page).locator(":scope > div").first();
}

test.describe("ResultDisplay severity regression coverage", () => {
  test("uses an explicit _severity value for the primary result", async ({
    page,
  }) => {
    await navigateToCalculator(page, "Child-Pugh Score");

    await fillInput(page, "Total Bilirubin", 2.5);
    await fillInput(page, "Serum Albumin", 3.0);
    await fillInput(page, "INR", 1.8);
    await page.locator('label[for="ascites-slight"]').click();
    await page.locator('label[for="encephalopathy-none"]').click();
    await page.getByRole("button", { name: "Calculate" }).click();

    const primaryResult = primaryResultCard(page);
    await expect(primaryResult).toContainText("Total Score: 9 points");
    await expect(primaryResult).toHaveClass(/--result-warning-bg/);
    await expect(primaryResult).toHaveClass(/--result-warning-border/);
  });

  test("uses fallback pattern scanning for a non-error result without _severity", async ({
    page,
  }) => {
    await navigateToCalculator(page, "IV Contrast Dosing");

    await page.getByText("Kilograms (kg)").click();
    await page.fill('input[id="weight"]', "70");
    await page.getByText("Centimeters (cm)").click();
    await page.fill('input[id="height"]', "175");
    await page.getByRole("radio", { name: /^Male$/ }).check();
    await page.fill('input[id="egfr"]', "60");
    await page.locator('select[id="contrast_agent"]').selectOption("300");
    await page.locator('select[id="study_type"]').selectOption("routine");
    await page.locator('select[id="iv_access"]').selectOption("20g");
    await page.getByRole("button", { name: "Calculate" }).click();

    const primaryResult = primaryResultCard(page);
    await expect(primaryResult).toContainText("Recommended Contrast Volume");
    await expect(resultRegion(page)).toContainText("Very Low Risk");
    await expect(primaryResult).toHaveClass(/--result-success-bg/);
    await expect(primaryResult).toHaveClass(/--result-success-border/);
  });

  test("falls back to neutral styling when results have no severity metadata or matching pattern", async ({
    page,
  }) => {
    await navigateToCalculator(page, "Prostate Volume & PSA Density");

    await fillInput(page, "Length (craniocaudal, cm):", 5);
    await fillInput(page, "Height (anteroposterior, cm):", 4);
    await fillInput(page, "Width (transverse, cm):", 4.5);
    await fillInput(page, "PSA (ng/mL):", 6);
    await page.getByRole("button", { name: "Calculate" }).click();

    const primaryResult = primaryResultCard(page);
    await expect(primaryResult).toContainText("Prostate Volume (mL): 46.8");
    await expect(primaryResult).toHaveClass(/bg-muted/);
    await expect(primaryResult).toHaveClass(/border-border/);
  });

  test("does not render a result region before a calculator has results", async ({
    page,
  }) => {
    await navigateToCalculator(page, "Prostate Volume & PSA Density");

    await expect(resultRegion(page)).toHaveCount(0);
  });

  test("renders invalid calculator output with error severity styling", async ({
    page,
  }) => {
    await navigateToCalculator(page, "DLP to Effective Dose");
    await page.getByRole("button", { name: "Calculate" }).click();

    const results = resultRegion(page);
    await expect(results).toContainText("Please enter a valid DLP value");
    await expect(primaryResultCard(page)).toHaveClass(/--result-danger-bg/);
    await expect(primaryResultCard(page)).toHaveClass(
      /--result-danger-border/,
    );
  });
});
