import { test, expect } from "@playwright/test";
import { navigateToCalculator } from "../../../helpers/calculator-test-helper.js";

/**
 * E2E Tests for Wells PE Calculator
 * Wells Criteria for Pulmonary Embolism
 */

test.describe("Wells Criteria for PE Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, "Wells Criteria for PE");
  });

  test.describe("Visual and UI Tests", () => {
    test("should display calculator with correct title", async ({ page }) => {
      await expect(page.locator("h2")).toContainText("Wells Criteria for PE");
    });

    test("should have all 7 criteria as checkboxes", async ({ page }) => {
      await expect(
        page.getByText("Clinical signs/symptoms of DVT"),
      ).toBeVisible();
      await expect(page.getByText("PE is #1 diagnosis")).toBeVisible();
      await expect(page.getByText("Heart rate >100 bpm")).toBeVisible();
      await expect(page.getByText("Immobilization")).toBeVisible();
      await expect(page.getByText("Previous PE or DVT")).toBeVisible();
      await expect(page.getByText("Hemoptysis")).toBeVisible();
      await expect(page.getByText("Malignancy")).toBeVisible();
    });

    test("should display info section with Wells explanation", async ({
      page,
    }) => {
      await expect(
        page.getByTestId("calculator-info").getByText("Wells Criteria"),
      ).toBeVisible();
    });
  });

  test.describe("Low Risk Calculations", () => {
    test("should calculate 0 points when no criteria selected", async ({
      page,
    }) => {
      await page.click("button:has-text('Calculate')");

      // Check that results contain expected values
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Wells Score:')",
        ),
      ).toContainText("0 points");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('3-Tier Assessment:')",
        ),
      ).toContainText("Low");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('2-Tier Assessment')",
        ),
      ).toContainText("PE Unlikely");
    });

    test("should calculate 1 pt with hemoptysis only", async ({ page }) => {
      await page.locator('button[id="hemoptysis"]').click();

      await page.click("button:has-text('Calculate')");

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Wells Score:')",
        ),
      ).toContainText("1 points");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('3-Tier Assessment:')",
        ),
      ).toContainText("Low");
    });
  });

  test.describe("Moderate Risk Calculations", () => {
    test("should calculate moderate risk with immobilization + HR >100", async ({
      page,
    }) => {
      // Immobilization (1.5 pts) + HR >100 (1.5 pts) = 3 pts
      await page.locator('button[id="immobilization_surgery"]').click();
      await page.locator('button[id="heart_rate"]').click();

      await page.click("button:has-text('Calculate')");

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Wells Score:')",
        ),
      ).toContainText("3 points");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('3-Tier Assessment:')",
        ),
      ).toContainText("Moderate");
    });
  });

  test.describe("High Risk Calculations", () => {
    test("should calculate high risk with DVT signs + PE likely + HR >100", async ({
      page,
    }) => {
      // DVT signs (3 pts) + PE likely (3 pts) + HR >100 (1.5 pts) = 7.5 pts
      await page.locator('button[id="clinical_dvt"]').click();
      await page.locator('button[id="alternative_less_likely"]').click();
      await page.locator('button[id="heart_rate"]').click();

      await page.click("button:has-text('Calculate')");

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Wells Score:')",
        ),
      ).toContainText("7.5 points");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('3-Tier Assessment:')",
        ),
      ).toContainText("High");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('2-Tier Assessment')",
        ),
      ).toContainText("PE Likely");
    });

    test("should calculate max score with all criteria selected", async ({
      page,
    }) => {
      // All criteria = 3+3+1.5+1.5+1.5+1+1 = 12.5 pts
      const switches = page.locator("button[role='switch']");
      const count = await switches.count();

      for (let i = 0; i < count; i++) {
        await switches.nth(i).click();
      }

      await page.click("button:has-text('Calculate')");

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Wells Score:')",
        ),
      ).toContainText("12.5 points");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('3-Tier Assessment:')",
        ),
      ).toContainText("High");
    });
  });

  test.describe("2-Tier Risk Classification", () => {
    test("should show PE Unlikely for score <= 4", async ({ page }) => {
      // HR >100 (1.5) + Hemoptysis (1) + Malignancy (1) = 3.5 pts
      await page.locator('button[id="heart_rate"]').click();
      await page.locator('button[id="hemoptysis"]').click();
      await page.locator('button[id="malignancy"]').click();

      await page.click("button:has-text('Calculate')");

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('2-Tier Assessment')",
        ),
      ).toContainText("PE Unlikely");
    });

    test("should show PE Likely for score > 4", async ({ page }) => {
      // DVT signs (3) + Previous PE/DVT (1.5) + Malignancy (1) = 5.5 pts
      await page.locator('button[id="clinical_dvt"]').click();
      await page.locator('button[id="previous_pe_dvt"]').click();
      await page.locator('button[id="malignancy"]').click();

      await page.click("button:has-text('Calculate')");

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('2-Tier Assessment')",
        ),
      ).toContainText("PE Likely");
    });
  });

  test.describe("Management Recommendations", () => {
    test("should recommend D-dimer for PE Unlikely", async ({ page }) => {
      await page.click("button:has-text('Calculate')");

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Recommendation:')",
        ),
      ).toContainText("D-dimer");
    });

    test("should recommend CTPA for PE Likely", async ({ page }) => {
      await page.locator('button[id="clinical_dvt"]').click();
      await page.locator('button[id="alternative_less_likely"]').click();

      await page.click("button:has-text('Calculate')");

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Recommendation:')",
        ),
      ).toContainText("CTPA");
    });
  });

  test.describe("References", () => {
    test("should display Wells PE references", async ({ page }) => {
      await expect(page.getByText("References")).toBeVisible();
      await expect(page.locator("a[href*='pubmed']").first()).toBeVisible();
    });
  });
});
