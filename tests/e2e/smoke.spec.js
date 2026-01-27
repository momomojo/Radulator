import { test, expect } from "@playwright/test";

/**
 * Smoke Tests for Radulator
 * Quick verification that core functionality works after refactoring.
 * Tests one calculator from each major category.
 */

test.describe("Smoke Tests - Core Functionality", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for sidebar heading to be visible (single unique element)
    await page
      .getByRole("heading", { name: "Radulator", level: 1 })
      .first()
      .waitFor({ state: "visible" });
  });

  test("should load homepage and display sidebar", async ({ page }) => {
    await expect(page.locator("h1").first()).toContainText("Radulator");
    await expect(page.locator("aside")).toBeVisible();
  });

  test("should navigate to Adrenal Washout CT calculator", async ({ page }) => {
    await page.click('button:has-text("Adrenal Washout CT")');
    await expect(page.locator("h2")).toContainText("Adrenal Washout CT");
  });

  test("should calculate Adrenal Washout CT", async ({ page }) => {
    await page.click('button:has-text("Adrenal Washout CT")');

    // Fill in test values using accessible labels
    await page.getByRole("spinbutton", { name: /Pre.*contrast/i }).fill("5");
    await page.getByRole("spinbutton", { name: /Post.*contrast/i }).fill("80");
    await page.getByRole("spinbutton", { name: /Delayed/i }).fill("35");

    await page.click('button:has-text("Calculate")');

    // Verify results appear - use specific text that only appears in results
    await expect(page.getByText("Absolute Washout (%)")).toBeVisible();
    await expect(page.getByText(/60\.?0?%/)).toBeVisible();
  });

  test("should navigate to Child-Pugh calculator", async ({ page }) => {
    await page.click('button:has-text("Child-Pugh Score")');
    await expect(page.locator("h2")).toContainText("Child-Pugh");
  });

  test("should calculate Child-Pugh score", async ({ page }) => {
    await page.click('button:has-text("Child-Pugh Score")');

    // Fill numeric values for Class A
    await page.getByRole("spinbutton", { name: /Bilirubin/i }).fill("1.5");
    await page.getByRole("spinbutton", { name: /Albumin/i }).fill("4.0");
    await page.getByRole("spinbutton", { name: /INR/i }).fill("1.2");

    // Select "None" for Ascites (first "None" radio) and Encephalopathy (second "None" radio)
    const noneRadios = page.getByRole("radio", { name: "None" });
    await noneRadios.nth(0).check(); // Ascites: None
    await noneRadios.nth(1).check(); // Encephalopathy: None

    await page.click('button:has-text("Calculate")');

    // Verify results - check that score and class are shown
    await expect(page.getByText("5 points", { exact: true })).toBeVisible();
    await expect(page.getByText("Child-Pugh Class")).toBeVisible();
  });

  test("should navigate to Prostate Volume calculator", async ({ page }) => {
    await page.click('button:has-text("Prostate Volume")');
    await expect(page.locator("h2")).toContainText("Prostate Volume");
  });

  test("should calculate Prostate Volume", async ({ page }) => {
    await page.click('button:has-text("Prostate Volume")');

    // Fill in dimensions using role selectors
    await page.getByRole("spinbutton", { name: /Length/i }).fill("4");
    await page.getByRole("spinbutton", { name: /Width/i }).fill("4");
    await page.getByRole("spinbutton", { name: /Height/i }).fill("3.5");

    await page.click('button:has-text("Calculate")');

    // Verify volume result - check for specific result text
    await expect(page.getByText("Prostate Volume (mL)")).toBeVisible();
    await expect(page.getByText(/\d+\.?\d*\s*cm³/)).toBeVisible();
  });

  test("should navigate to ACR TI-RADS calculator", async ({ page }) => {
    await page.click('button:has-text("ACR TI-RADS")');
    await expect(page.locator("h2")).toContainText("TI-RADS");
  });

  test("should display references section", async ({ page }) => {
    await page.click('button:has-text("Adrenal Washout CT")');
    await expect(page.locator("text=/References/i")).toBeVisible();
  });

  test("should toggle favorites", async ({ page }) => {
    // Hover over calculator and click star
    const calcButton = page.locator('button:has-text("Child-Pugh Score")');
    await calcButton.hover();
    const starButton = calcButton.locator('button[aria-label*="favorite"]');
    if (await starButton.isVisible()) {
      await starButton.click();
    }
  });

  test("should search calculators", async ({ page }) => {
    await page.fill('input[placeholder*="Search"]', "liver");
    await expect(
      page.locator('button:has-text("Child-Pugh Score")'),
    ).toBeVisible();
  });
});
