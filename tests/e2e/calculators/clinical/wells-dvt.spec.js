import { test, expect } from "@playwright/test";
import { navigateToCalculator } from "../../../helpers/calculator-test-helper.js";

/**
 * E2E Tests for Wells DVT Calculator
 * Wells Criteria for Deep Vein Thrombosis
 *
 * Scoring:
 * - Each positive criterion: +1 point
 * - Alternative diagnosis as likely: -2 points
 *
 * Risk Levels:
 * - 3-Tier: Low (<1), Moderate (1-2), High (>=3)
 * - 2-Tier: DVT Unlikely (<2), DVT Likely (>=2)
 */

test.describe("Wells Criteria for DVT Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, "Wells Criteria for DVT");
  });

  test.describe("Visual and UI Tests", () => {
    test("should display calculator with correct title", async ({ page }) => {
      await expect(page.locator("h2")).toContainText("Wells Criteria for DVT");
    });

    test("should have all 10 criteria as checkboxes", async ({ page }) => {
      await expect(page.getByText("Active cancer")).toBeVisible();
      await expect(
        page.getByText("Paralysis, paresis, or recent plaster immobilization"),
      ).toBeVisible();
      await expect(
        page.getByText("Recently bedridden >3 days or major surgery"),
      ).toBeVisible();
      await expect(
        page.getByText("Localized tenderness along deep venous system"),
      ).toBeVisible();
      await expect(page.getByText("Entire leg swollen")).toBeVisible();
      await expect(
        page.getByText("Calf swelling >3 cm compared to asymptomatic leg"),
      ).toBeVisible();
      await expect(
        page.getByText("Pitting edema confined to symptomatic leg"),
      ).toBeVisible();
      await expect(
        page.getByText("Collateral superficial veins (non-varicose)"),
      ).toBeVisible();
      await expect(page.getByText("Previously documented DVT")).toBeVisible();
      await expect(
        page.getByText("Alternative diagnosis at least as likely as DVT"),
      ).toBeVisible();
    });

    test("should display info section with Wells DVT explanation", async ({
      page,
    }) => {
      await expect(
        page.locator(".bg-blue-50").getByText("Wells Criteria"),
      ).toBeVisible();
    });

    test("should have 10 checkbox switches", async ({ page }) => {
      const switches = page.locator("button[role='switch']");
      await expect(switches).toHaveCount(10);
    });
  });

  test.describe("Low Risk Calculations", () => {
    test("should calculate 0 points when no criteria selected", async ({
      page,
    }) => {
      await page.click("button:has-text('Calculate')");

      await expect(page.locator("p:has-text('Wells Score:')")).toContainText(
        "0 points",
      );
      await expect(
        page.locator("p:has-text('3-Tier Assessment:')"),
      ).toContainText("Low");
      await expect(
        page.locator("p:has-text('2-Tier Assessment')"),
      ).toContainText("DVT Unlikely");
    });

    test("should calculate -2 points with only alternative diagnosis", async ({
      page,
    }) => {
      const altDxSwitch = page
        .locator("label:has-text('Alternative diagnosis at least as likely')")
        .locator("..");
      await altDxSwitch.locator("button[role='switch']").click();

      await page.click("button:has-text('Calculate')");

      await expect(page.locator("p:has-text('Wells Score:')")).toContainText(
        "-2 points",
      );
      await expect(
        page.locator("p:has-text('3-Tier Assessment:')"),
      ).toContainText("Low");
      await expect(
        page.locator("p:has-text('2-Tier Assessment')"),
      ).toContainText("DVT Unlikely");
    });

    test("should calculate 1 point with single positive criterion", async ({
      page,
    }) => {
      const cancerSwitch = page
        .locator("label:has-text('Active cancer')")
        .locator("..");
      await cancerSwitch.locator("button[role='switch']").click();

      await page.click("button:has-text('Calculate')");

      await expect(page.locator("p:has-text('Wells Score:')")).toContainText(
        "1 points",
      );
      await expect(
        page.locator("p:has-text('3-Tier Assessment:')"),
      ).toContainText("Moderate");
      await expect(
        page.locator("p:has-text('2-Tier Assessment')"),
      ).toContainText("DVT Unlikely");
    });
  });

  test.describe("Moderate Risk Calculations", () => {
    test("should calculate moderate risk with 2 positive criteria", async ({
      page,
    }) => {
      // Active cancer (+1) + Entire leg swollen (+1) = 2 pts
      const cancerSwitch = page
        .locator("label:has-text('Active cancer')")
        .locator("..");
      await cancerSwitch.locator("button[role='switch']").click();

      const legSwitch = page
        .locator("label:has-text('Entire leg swollen')")
        .locator("..");
      await legSwitch.locator("button[role='switch']").click();

      await page.click("button:has-text('Calculate')");

      await expect(page.locator("p:has-text('Wells Score:')")).toContainText(
        "2 points",
      );
      await expect(
        page.locator("p:has-text('3-Tier Assessment:')"),
      ).toContainText("Moderate");
      await expect(
        page.locator("p:has-text('2-Tier Assessment')"),
      ).toContainText("DVT Likely");
    });

    test("should calculate 1 point with 3 positive and alternative diagnosis", async ({
      page,
    }) => {
      // 3 positive (+3) + alternative diagnosis (-2) = 1 pt
      const cancerSwitch = page
        .locator("label:has-text('Active cancer')")
        .locator("..");
      await cancerSwitch.locator("button[role='switch']").click();

      const legSwitch = page
        .locator("label:has-text('Entire leg swollen')")
        .locator("..");
      await legSwitch.locator("button[role='switch']").click();

      const pittingSwitch = page
        .locator("label:has-text('Pitting edema')")
        .locator("..");
      await pittingSwitch.locator("button[role='switch']").click();

      const altDxSwitch = page
        .locator("label:has-text('Alternative diagnosis at least as likely')")
        .locator("..");
      await altDxSwitch.locator("button[role='switch']").click();

      await page.click("button:has-text('Calculate')");

      await expect(page.locator("p:has-text('Wells Score:')")).toContainText(
        "1 points",
      );
      await expect(
        page.locator("p:has-text('3-Tier Assessment:')"),
      ).toContainText("Moderate");
      await expect(
        page.locator("p:has-text('2-Tier Assessment')"),
      ).toContainText("DVT Unlikely");
    });
  });

  test.describe("High Risk Calculations", () => {
    test("should calculate high risk with 3 positive criteria", async ({
      page,
    }) => {
      // Active cancer (+1) + leg swelling (+1) + calf swelling (+1) = 3 pts
      const cancerSwitch = page
        .locator("label:has-text('Active cancer')")
        .locator("..");
      await cancerSwitch.locator("button[role='switch']").click();

      const legSwitch = page
        .locator("label:has-text('Entire leg swollen')")
        .locator("..");
      await legSwitch.locator("button[role='switch']").click();

      const calfSwitch = page
        .locator("label:has-text('Calf swelling >3 cm')")
        .locator("..");
      await calfSwitch.locator("button[role='switch']").click();

      await page.click("button:has-text('Calculate')");

      await expect(page.locator("p:has-text('Wells Score:')")).toContainText(
        "3 points",
      );
      await expect(
        page.locator("p:has-text('3-Tier Assessment:')"),
      ).toContainText("High");
      await expect(
        page.locator("p:has-text('2-Tier Assessment')"),
      ).toContainText("DVT Likely");
    });

    test("should calculate max score with all positive criteria selected", async ({
      page,
    }) => {
      // All 9 positive criteria = 9 pts (not clicking alternative diagnosis)
      const switches = page.locator("button[role='switch']");
      const count = await switches.count();

      // Click all except the last one (alternative diagnosis)
      for (let i = 0; i < count - 1; i++) {
        await switches.nth(i).click();
      }

      await page.click("button:has-text('Calculate')");

      await expect(page.locator("p:has-text('Wells Score:')")).toContainText(
        "9 points",
      );
      await expect(
        page.locator("p:has-text('3-Tier Assessment:')"),
      ).toContainText("High");
      await expect(
        page.locator("p:has-text('2-Tier Assessment')"),
      ).toContainText("DVT Likely");
    });

    test("should calculate 7 points with all criteria including alternative diagnosis", async ({
      page,
    }) => {
      // All 10 criteria: 9 positive - 2 = 7 pts
      const switches = page.locator("button[role='switch']");
      const count = await switches.count();

      for (let i = 0; i < count; i++) {
        await switches.nth(i).click();
      }

      await page.click("button:has-text('Calculate')");

      await expect(page.locator("p:has-text('Wells Score:')")).toContainText(
        "7 points",
      );
      await expect(
        page.locator("p:has-text('3-Tier Assessment:')"),
      ).toContainText("High");
    });
  });

  test.describe("2-Tier Risk Classification", () => {
    test("should show DVT Unlikely for score < 2", async ({ page }) => {
      // Score of 1: single criterion
      const tendernessSwitch = page
        .locator("label:has-text('Localized tenderness')")
        .locator("..");
      await tendernessSwitch.locator("button[role='switch']").click();

      await page.click("button:has-text('Calculate')");

      await expect(page.locator("p:has-text('Wells Score:')")).toContainText(
        "1 points",
      );
      await expect(
        page.locator("p:has-text('2-Tier Assessment')"),
      ).toContainText("DVT Unlikely");
    });

    test("should show DVT Likely for score >= 2", async ({ page }) => {
      // Score of 2: two criteria
      const prevDvtSwitch = page
        .locator("label:has-text('Previously documented DVT')")
        .locator("..");
      await prevDvtSwitch.locator("button[role='switch']").click();

      const collateralSwitch = page
        .locator("label:has-text('Collateral superficial veins')")
        .locator("..");
      await collateralSwitch.locator("button[role='switch']").click();

      await page.click("button:has-text('Calculate')");

      await expect(page.locator("p:has-text('Wells Score:')")).toContainText(
        "2 points",
      );
      await expect(
        page.locator("p:has-text('2-Tier Assessment')"),
      ).toContainText("DVT Likely");
    });
  });

  test.describe("Management Recommendations", () => {
    test("should recommend D-dimer for DVT Unlikely", async ({ page }) => {
      await page.click("button:has-text('Calculate')");

      await expect(page.locator("p:has-text('Recommendation:')")).toContainText(
        "D-dimer",
      );
    });

    test("should recommend ultrasound for DVT Likely", async ({ page }) => {
      // Score of 2: two criteria
      const cancerSwitch = page
        .locator("label:has-text('Active cancer')")
        .locator("..");
      await cancerSwitch.locator("button[role='switch']").click();

      const paralysisSwitch = page
        .locator("label:has-text('Paralysis, paresis')")
        .locator("..");
      await paralysisSwitch.locator("button[role='switch']").click();

      await page.click("button:has-text('Calculate')");

      await expect(page.locator("p:has-text('Recommendation:')")).toContainText(
        "ultrasound",
      );
    });
  });

  test.describe("Clinical Notes", () => {
    test("should display note about negative score", async ({ page }) => {
      const altDxSwitch = page
        .locator("label:has-text('Alternative diagnosis at least as likely')")
        .locator("..");
      await altDxSwitch.locator("button[role='switch']").click();

      await page.click("button:has-text('Calculate')");

      await expect(page.locator("p:has-text('Clinical Notes:')")).toContainText(
        "Negative score",
      );
    });

    test("should display note about empiric anticoagulation for high risk", async ({
      page,
    }) => {
      // Get to score of 3+
      const cancerSwitch = page
        .locator("label:has-text('Active cancer')")
        .locator("..");
      await cancerSwitch.locator("button[role='switch']").click();

      const legSwitch = page
        .locator("label:has-text('Entire leg swollen')")
        .locator("..");
      await legSwitch.locator("button[role='switch']").click();

      const calfSwitch = page
        .locator("label:has-text('Calf swelling >3 cm')")
        .locator("..");
      await calfSwitch.locator("button[role='switch']").click();

      await page.click("button:has-text('Calculate')");

      await expect(page.locator("p:has-text('Clinical Notes:')")).toContainText(
        "empiric anticoagulation",
      );
    });

    test("should display note about prior DVT", async ({ page }) => {
      const prevDvtSwitch = page
        .locator("label:has-text('Previously documented DVT')")
        .locator("..");
      await prevDvtSwitch.locator("button[role='switch']").click();

      await page.click("button:has-text('Calculate')");

      await expect(page.locator("p:has-text('Clinical Notes:')")).toContainText(
        "Prior DVT",
      );
    });

    test("should display note about cancer-associated thrombosis", async ({
      page,
    }) => {
      const cancerSwitch = page
        .locator("label:has-text('Active cancer')")
        .locator("..");
      await cancerSwitch.locator("button[role='switch']").click();

      await page.click("button:has-text('Calculate')");

      await expect(page.locator("p:has-text('Clinical Notes:')")).toContainText(
        "Cancer-associated thrombosis",
      );
    });

    test("should display common alternatives when alternative diagnosis selected", async ({
      page,
    }) => {
      const altDxSwitch = page
        .locator("label:has-text('Alternative diagnosis at least as likely')")
        .locator("..");
      await altDxSwitch.locator("button[role='switch']").click();

      await page.click("button:has-text('Calculate')");

      await expect(
        page.locator("p:has-text('Common Alternatives:')"),
      ).toContainText("Baker's cyst");
    });
  });

  test.describe("Score Breakdown", () => {
    test("should show no risk factors message when nothing selected", async ({
      page,
    }) => {
      await page.click("button:has-text('Calculate')");

      await expect(
        page.locator("p:has-text('Score Breakdown:')"),
      ).toContainText("No risk factors selected");
    });

    test("should show breakdown of selected criteria", async ({ page }) => {
      const cancerSwitch = page
        .locator("label:has-text('Active cancer')")
        .locator("..");
      await cancerSwitch.locator("button[role='switch']").click();

      const legSwitch = page
        .locator("label:has-text('Entire leg swollen')")
        .locator("..");
      await legSwitch.locator("button[role='switch']").click();

      await page.click("button:has-text('Calculate')");

      const breakdown = page.locator("p:has-text('Score Breakdown:')");
      await expect(breakdown).toContainText("Active cancer: +1");
      await expect(breakdown).toContainText("Entire leg swollen: +1");
    });
  });

  test.describe("Edge Cases", () => {
    test("should handle toggling criteria on and off", async ({ page }) => {
      const cancerSwitch = page
        .locator("label:has-text('Active cancer')")
        .locator("..");
      const switchButton = cancerSwitch.locator("button[role='switch']");

      // Toggle on
      await switchButton.click();
      await page.click("button:has-text('Calculate')");
      await expect(page.locator("p:has-text('Wells Score:')")).toContainText(
        "1 points",
      );

      // Toggle off
      await switchButton.click();
      await page.click("button:has-text('Calculate')");
      await expect(page.locator("p:has-text('Wells Score:')")).toContainText(
        "0 points",
      );
    });

    test("should calculate correctly at 2-tier boundary (score = 2)", async ({
      page,
    }) => {
      // Exactly 2 points - should be DVT Likely (boundary is >= 2)
      const bedriddenSwitch = page
        .locator("label:has-text('Recently bedridden')")
        .locator("..");
      await bedriddenSwitch.locator("button[role='switch']").click();

      const tendernessSwitch = page
        .locator("label:has-text('Localized tenderness')")
        .locator("..");
      await tendernessSwitch.locator("button[role='switch']").click();

      await page.click("button:has-text('Calculate')");

      await expect(page.locator("p:has-text('Wells Score:')")).toContainText(
        "2 points",
      );
      await expect(
        page.locator("p:has-text('2-Tier Assessment')"),
      ).toContainText("DVT Likely");
      await expect(
        page.locator("p:has-text('3-Tier Assessment:')"),
      ).toContainText("Moderate");
    });

    test("should calculate correctly at 3-tier moderate/high boundary (score = 3)", async ({
      page,
    }) => {
      // Exactly 3 points - should be High Probability
      const bedriddenSwitch = page
        .locator("label:has-text('Recently bedridden')")
        .locator("..");
      await bedriddenSwitch.locator("button[role='switch']").click();

      const tendernessSwitch = page
        .locator("label:has-text('Localized tenderness')")
        .locator("..");
      await tendernessSwitch.locator("button[role='switch']").click();

      const pittingSwitch = page
        .locator("label:has-text('Pitting edema')")
        .locator("..");
      await pittingSwitch.locator("button[role='switch']").click();

      await page.click("button:has-text('Calculate')");

      await expect(page.locator("p:has-text('Wells Score:')")).toContainText(
        "3 points",
      );
      await expect(
        page.locator("p:has-text('3-Tier Assessment:')"),
      ).toContainText("High");
    });
  });

  test.describe("References", () => {
    test("should display Wells DVT references", async ({ page }) => {
      await expect(page.getByText("References")).toBeVisible();
      await expect(page.locator("a[href*='doi.org']").first()).toBeVisible();
    });
  });
});
