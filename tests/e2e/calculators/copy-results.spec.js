import { test, expect } from "@playwright/test";
import {
  navigateToCalculator,
  fillInput,
} from "../../helpers/calculator-test-helper.js";

/**
 * E2E Tests for Copy Results Button
 *
 * Verifies the clipboard copy functionality added to all standard calculators.
 * Tests button visibility, feedback state, text revert, and clipboard content.
 */

// Grant clipboard permissions for all tests in this file
test.use({
  permissions: ["clipboard-read", "clipboard-write"],
});

test.describe("Copy Results Button", () => {
  test("should not show copy button before calculation", async ({ page }) => {
    await navigateToCalculator(page, "Prostate Volume");
    await expect(
      page.locator('button:has-text("Copy Results")'),
    ).not.toBeVisible();
  });

  test("should show copy button after calculation", async ({ page }) => {
    await navigateToCalculator(page, "Prostate Volume");

    await fillInput(page, "Length (craniocaudal, cm):", 5);
    await fillInput(page, "Height (anteroposterior, cm):", 4);
    await fillInput(page, "Width (transverse, cm):", 4.5);
    await fillInput(page, "PSA (ng/mL):", 6);
    await page.locator('button:has-text("Calculate")').click();

    await expect(page.locator('button:has-text("Copy Results")')).toBeVisible();
  });

  test("should change text to Copied! on click", async ({ page }) => {
    await navigateToCalculator(page, "Prostate Volume");

    await fillInput(page, "Length (craniocaudal, cm):", 5);
    await fillInput(page, "Height (anteroposterior, cm):", 4);
    await fillInput(page, "Width (transverse, cm):", 4.5);
    await fillInput(page, "PSA (ng/mL):", 6);
    await page.locator('button:has-text("Calculate")').click();

    await page.locator('button:has-text("Copy Results")').click();
    await expect(page.locator('button:has-text("Copied!")')).toBeVisible();
  });

  test("should revert to Copy Results after 2 seconds", async ({ page }) => {
    await navigateToCalculator(page, "Prostate Volume");

    await fillInput(page, "Length (craniocaudal, cm):", 5);
    await fillInput(page, "Height (anteroposterior, cm):", 4);
    await fillInput(page, "Width (transverse, cm):", 4.5);
    await fillInput(page, "PSA (ng/mL):", 6);
    await page.locator('button:has-text("Calculate")').click();

    await page.locator('button:has-text("Copy Results")').click();
    await expect(page.locator('button:has-text("Copied!")')).toBeVisible();

    // Wait for revert (2s timeout + buffer)
    await expect(page.locator('button:has-text("Copy Results")')).toBeVisible({
      timeout: 4000,
    });
  });

  test("should copy formatted results to clipboard", async ({ page }) => {
    await navigateToCalculator(page, "Prostate Volume");

    await fillInput(page, "Length (craniocaudal, cm):", 5);
    await fillInput(page, "Height (anteroposterior, cm):", 4);
    await fillInput(page, "Width (transverse, cm):", 4.5);
    await fillInput(page, "PSA (ng/mL):", 6);
    await page.locator('button:has-text("Calculate")').click();

    await page.locator('button:has-text("Copy Results")').click();

    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );

    // Verify header
    expect(clipboardText).toContain("Prostate Volume");
    expect(clipboardText).toContain("Radulator");

    // Verify key result values are present
    expect(clipboardText).toContain("Volume");
    expect(clipboardText).toContain("PSA Density");
  });

  test("should format Child-Pugh results with section headers", async ({
    page,
  }) => {
    await navigateToCalculator(page, "Child-Pugh Score");

    await fillInput(page, "Total Bilirubin", 2.5);
    await fillInput(page, "Serum Albumin", 3.0);
    await fillInput(page, "INR", 1.8);
    // Select ascites and encephalopathy via radio buttons (value-based IDs)
    await page.locator('label[for="ascites-slight"]').click();
    await page.locator('label[for="encephalopathy-none"]').click();
    await page.locator('button:has-text("Calculate")').click();

    await page.locator('button:has-text("Copy Results")').click();

    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );

    // Verify header format
    expect(clipboardText).toMatch(/Child-Pugh Score.*Radulator/);

    // Verify section header (Points Breakdown should appear)
    expect(clipboardText).toContain("Points Breakdown");

    // Verify result values
    expect(clipboardText).toContain("Child-Pugh Class");
    expect(clipboardText).toContain("Total Score");

    // Verify metadata keys (_severity) are NOT in clipboard text
    expect(clipboardText).not.toContain("_severity");
  });
});
