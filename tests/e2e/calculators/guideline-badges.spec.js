/**
 * Guideline Version Badges - E2E Tests
 *
 * Tests that calculators with guidelineVersion display a badge below the title,
 * and that calculators without it do not.
 */

import { test, expect } from "@playwright/test";
import { navigateToCalculator } from "../../helpers/calculator-test-helper.js";

test.describe("Guideline Version Badges", () => {
  const badgeSelector = '[data-testid="guideline-badge"]';

  test.describe("Calculators with badges", () => {
    const badgeTests = [
      { name: "AAST Trauma Grading", expected: "AAST OIS 2018/2025" },
      { name: "ACR TI-RADS", expected: "ACR TI-RADS 2017" },
      { name: "PI-RADS v2.1", expected: "PI-RADS v2.1 (2019)" },
      { name: "LI-RADS v2018", expected: "LI-RADS v2018" },
      { name: "Lung-RADS v2022", expected: "Lung-RADS v2022" },
      { name: "ACR BI-RADS", expected: "ACR BI-RADS 5th Ed. 2013" },
      { name: "CAD-RADS 2.0", expected: "CAD-RADS 2.0 (2022)" },
      { name: "ACR NI-RADS", expected: "ACR NI-RADS 2018" },
      { name: "ACR O-RADS", expected: "ACR O-RADS 2020" },
      { name: "Fleischner 2017", expected: "Fleischner 2017" },
      { name: "Wells Criteria for PE", expected: "Wells Criteria (2000)" },
      { name: "Wells Criteria for DVT", expected: "Wells Criteria (2003)" },
      { name: "Child-Pugh Score", expected: "Child-Pugh (Pugh 1973)" },
      { name: "MELD-Na Score", expected: "MELD-Na (OPTN 2016)" },
      { name: "BCLC Staging", expected: "BCLC 2022" },
      { name: "Mehran CIN Risk Score", expected: "Mehran Score (2004)" },
    ];

    for (const { name, expected } of badgeTests) {
      test(`should display "${expected}" badge for ${name}`, async ({
        page,
      }) => {
        await navigateToCalculator(page, name);
        const badge = page.locator(badgeSelector);
        await expect(badge).toBeVisible();
        await expect(badge).toHaveText(expected);
      });
    }
  });

  test.describe("Calculators without badges", () => {
    const noBadgeCalcs = [
      "Adrenal CT Washout",
      "Adrenal MRI Chemical Shift",
      "Contrast Dosing",
      "Prostate Volume",
    ];

    for (const name of noBadgeCalcs) {
      test(`should not display badge for ${name}`, async ({ page }) => {
        await navigateToCalculator(page, name);
        await expect(page.locator(badgeSelector)).not.toBeVisible();
      });
    }
  });

  test.describe("Badge styling", () => {
    test("should render badge with correct styling", async ({ page }) => {
      await navigateToCalculator(page, "AAST Trauma Grading");
      const badge = page.locator(badgeSelector);
      await expect(badge).toBeVisible();
      // Badge should be below the description
      const desc = page.locator('[data-testid="calculator-description"]');
      await expect(desc).toBeVisible();
      const descBox = await desc.boundingBox();
      const badgeBox = await badge.boundingBox();
      expect(badgeBox.y).toBeGreaterThan(descBox.y);
    });
  });
});
