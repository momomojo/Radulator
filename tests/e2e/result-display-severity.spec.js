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
    await navigateToCalculator(page, "Hip Dysplasia");

    const fortyEightMonthsAgo = new Date();
    fortyEightMonthsAgo.setMonth(fortyEightMonthsAgo.getMonth() - 48);
    await page
      .locator('input[type="date"]')
      .fill(fortyEightMonthsAgo.toISOString().split("T")[0]);
    await page.locator('input[type="radio"][value="female"]').click();
    await page.fill('input[id="mi_right_a"]', "10");
    await page.fill('input[id="mi_right_b"]', "90");
    await page.getByRole("button", { name: "Calculate" }).click();

    const primaryResult = primaryResultCard(page);
    await expect(primaryResult).toContainText("Normal AC-Angle");
    await expect(resultRegion(page)).toContainText("10.0% - Normal");
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

  test("renders invalid calculator output without result actions", async ({
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
    await expect(page.getByRole("button", { name: "Copy results" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: "Copy Report Snippet" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Print Results" })).toHaveCount(
      0,
    );
  });
});
