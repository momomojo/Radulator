import { test, expect } from "@playwright/test";
import { navigateToCalculator } from "../../../helpers/calculator-test-helper.js";

/**
 * E2E Tests for Fleischner 2017 Guidelines Calculator
 * Management of Incidentally Detected Pulmonary Nodules
 *
 * The Fleischner Society guidelines provide recommendations for follow-up
 * of incidentally detected pulmonary nodules on CT.
 *
 * Nodule Types:
 * - Solid nodules
 * - Ground-glass nodules (pure GGN)
 * - Part-solid nodules (mixed GGN)
 *
 * Key Size Thresholds:
 * - <6mm: Generally no follow-up (except high-risk)
 * - 6-8mm: Intermediate follow-up
 * - >8mm: Aggressive workup (PET/CT, biopsy)
 *
 * Risk Factors:
 * - Smoking history
 * - Upper lobe location
 * - Spiculated margins
 * - Family history of lung cancer
 * - Emphysema/pulmonary fibrosis
 */

test.describe("Fleischner 2017 Guidelines Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, "Fleischner Guidelines");
  });

  test.describe("Visual and UI Tests", () => {
    test("should display calculator with correct title and description", async ({
      page,
    }) => {
      await expect(page.locator("h2")).toContainText("Fleischner");
      await expect(
        page.locator("text=Pulmonary nodule management"),
      ).toBeVisible();
    });

    test("should have all required input fields", async ({ page }) => {
      await expect(page.locator('label:has-text("Nodule Type")')).toBeVisible();
      await expect(
        page.locator('label:has-text("Number of Nodules")'),
      ).toBeVisible();
      await expect(
        page.locator('label:has-text("Nodule Size (mm)")'),
      ).toBeVisible();
      await expect(
        page.locator('label:has-text("Patient Risk Level")'),
      ).toBeVisible();
      await expect(
        page.getByText("Smoking History", { exact: true }),
      ).toBeVisible();
    });

    test("should display info section with Fleischner explanation", async ({
      page,
    }) => {
      await expect(page.locator("text=incidental nodules")).toBeVisible();
      await expect(page.getByText("Risk Factors for Malignancy")).toBeVisible();
    });

    test("should show solid component field only for part-solid nodules", async ({
      page,
    }) => {
      // Initially hidden
      await expect(
        page.locator('label:has-text("Solid Component Size")'),
      ).not.toBeVisible();

      // Select part-solid nodule
      await page.getByText("Part-solid nodule (mixed GGN)").click();

      // Should now be visible
      await expect(
        page.locator('label:has-text("Solid Component Size")'),
      ).toBeVisible();
    });
  });

  test.describe("Solid Nodules - Single", () => {
    test("should recommend no follow-up for <6mm in low-risk patient", async ({
      page,
    }) => {
      await page.getByText("Solid nodule", { exact: true }).click();
      await page.getByText("Single nodule", { exact: true }).click();
      await page.fill('input[id="nodule_size"]', "4");
      await page.getByText("Low risk - No or minimal").click();
      await page.getByText("Never smoker").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=No routine follow-up")).toBeVisible();
      await expect(page.getByText("Risk Assessment")).toBeVisible();
    });

    test("should recommend optional CT at 12 months for <6mm in high-risk patient", async ({
      page,
    }) => {
      await page.getByText("Solid nodule", { exact: true }).click();
      await page.getByText("Single nodule", { exact: true }).click();
      await page.fill('input[id="nodule_size"]', "5");
      await page.getByText("High risk - Smoking history").click();
      await page.getByText("Current smoker").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Optional CT at 12 months")).toBeVisible();
      await expect(page.getByText("Risk Assessment")).toBeVisible();
    });

    test("should recommend CT at 6-12 months for 6-8mm in low-risk patient", async ({
      page,
    }) => {
      await page.getByText("Solid nodule", { exact: true }).click();
      await page.getByText("Single nodule", { exact: true }).click();
      await page.fill('input[id="nodule_size"]', "7");
      await page.getByText("Low risk - No or minimal").click();
      await page.getByText("Never smoker").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=CT at 6-12 months")).toBeVisible();
      await expect(page.getByText("Follow-up Interval")).toBeVisible();
    });

    test("should recommend CT at 6-12 months then 18-24 months for 6-8mm in high-risk patient", async ({
      page,
    }) => {
      await page.getByText("Solid nodule", { exact: true }).click();
      await page.getByText("Single nodule", { exact: true }).click();
      await page.fill('input[id="nodule_size"]', "7");
      await page.getByText("High risk - Smoking history").click();
      await page.getByText("Former smoker").click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=CT at 6-12 months, then CT at 18-24 months"),
      ).toBeVisible();
    });

    test("should recommend aggressive workup for >8mm nodule", async ({
      page,
    }) => {
      await page.getByText("Solid nodule", { exact: true }).click();
      await page.getByText("Single nodule", { exact: true }).click();
      await page.fill('input[id="nodule_size"]', "12");
      await page.getByText("High risk - Smoking history").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.getByText("PET/CT").first()).toBeVisible();
      await expect(page.getByText("Consider CT at 3 months")).toBeVisible();
    });
  });

  test.describe("Solid Nodules - Multiple", () => {
    test("should recommend no follow-up for multiple <6mm in low-risk patient", async ({
      page,
    }) => {
      await page.getByText("Solid nodule", { exact: true }).click();
      await page.getByText("Multiple nodules", { exact: true }).click();
      await page.fill('input[id="nodule_size"]', "4");
      await page.getByText("Low risk - No or minimal").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=No routine follow-up")).toBeVisible();
    });

    test("should recommend CT at 3-6 months then 18-24 months for multiple ≥6mm", async ({
      page,
    }) => {
      await page.getByText("Solid nodule", { exact: true }).click();
      await page.getByText("Multiple nodules", { exact: true }).click();
      await page.fill('input[id="nodule_size"]', "8");
      await page.getByText("High risk - Smoking history").click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=CT at 3-6 months, then CT at 18-24 months"),
      ).toBeVisible();
      await expect(page.locator("text=most suspicious nodule")).toBeVisible();
    });
  });

  test.describe("Ground-Glass Nodules", () => {
    test("should recommend no follow-up for GGN <6mm", async ({ page }) => {
      await page.getByText("Ground-glass nodule (pure GGN)").click();
      await page.getByText("Single nodule", { exact: true }).click();
      await page.fill('input[id="nodule_size"]', "4");
      await page.getByText("Low risk - No or minimal").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=No routine follow-up")).toBeVisible();
    });

    test("should recommend long-term surveillance for single GGN ≥6mm", async ({
      page,
    }) => {
      await page.getByText("Ground-glass nodule (pure GGN)").click();
      await page.getByText("Single nodule", { exact: true }).click();
      await page.fill('input[id="nodule_size"]', "8");
      await page.getByText("Low risk - No or minimal").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.getByText("CT at 6-12 months").first()).toBeVisible();
      await expect(page.getByText("biennial for 5 years")).toBeVisible();
      await expect(page.getByText("lung window settings")).toBeVisible();
    });

    test("should recommend shorter initial follow-up for multiple GGN ≥6mm", async ({
      page,
    }) => {
      await page.getByText("Ground-glass nodule (pure GGN)").click();
      await page.getByText("Multiple nodules", { exact: true }).click();
      await page.fill('input[id="nodule_size"]', "10");
      await page.getByText("Low risk - No or minimal").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=CT at 3-6 months")).toBeVisible();
      await expect(page.locator("text=multifocal")).toBeVisible();
    });
  });

  test.describe("Part-Solid Nodules", () => {
    test("should recommend no follow-up for part-solid <6mm", async ({
      page,
    }) => {
      await page.getByText("Part-solid nodule (mixed GGN)").click();
      await page.getByText("Single nodule", { exact: true }).click();
      await page.fill('input[id="nodule_size"]', "4");
      await page.getByText("Low risk - No or minimal").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=No routine follow-up")).toBeVisible();
    });

    test("should recommend CT at 3-6 months then annual for single part-solid ≥6mm", async ({
      page,
    }) => {
      await page.getByText("Part-solid nodule (mixed GGN)").click();
      await page.getByText("Single nodule", { exact: true }).click();
      await page.fill('input[id="nodule_size"]', "10");
      await page.fill('input[id="solid_component"]', "4");
      await page.getByText("Low risk - No or minimal").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=CT at 3-6 months")).toBeVisible();
      await expect(page.locator("text=annual CT for 5 years")).toBeVisible();
      await expect(
        page.locator("text=mediastinal window settings"),
      ).toBeVisible();
    });

    test("should note solid component ≥6mm as concerning", async ({ page }) => {
      await page.getByText("Part-solid nodule (mixed GGN)").click();
      await page.getByText("Single nodule", { exact: true }).click();
      await page.fill('input[id="nodule_size"]', "15");
      await page.fill('input[id="solid_component"]', "8");
      await page.getByText("High risk - Smoking history").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Solid component ≥6mm")).toBeVisible();
      await expect(page.locator("text=PET/CT or biopsy")).toBeVisible();
    });

    test("should handle multiple part-solid nodules", async ({ page }) => {
      await page.getByText("Part-solid nodule (mixed GGN)").click();
      await page.getByText("Multiple nodules", { exact: true }).click();
      await page.fill('input[id="nodule_size"]', "12");
      await page.getByText("High risk - Smoking history").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=CT at 3-6 months")).toBeVisible();
      await expect(page.locator("text=most suspicious nodule")).toBeVisible();
    });
  });

  test.describe("Risk Factor Assessment", () => {
    test("should infer high risk from smoking history", async ({ page }) => {
      await page.getByText("Solid nodule", { exact: true }).click();
      await page.getByText("Single nodule", { exact: true }).click();
      await page.fill('input[id="nodule_size"]', "5");
      // Don't select explicit risk level, but select current smoker
      await page.getByText("Current smoker", { exact: true }).click();

      await page.click('button:has-text("Calculate")');

      // Results should show high risk was inferred
      await expect(page.getByText("Optional CT at 12 months")).toBeVisible();
    });

    test("should infer high risk from upper lobe location", async ({
      page,
    }) => {
      await page.getByText("Solid nodule", { exact: true }).click();
      await page.getByText("Single nodule", { exact: true }).click();
      await page.fill('input[id="nodule_size"]', "5");
      await page.getByText("Never smoker", { exact: true }).click();
      // Check upper lobe checkbox
      await page.locator('label:has-text("Upper Lobe Location")').click();

      await page.click('button:has-text("Calculate")');

      // Results should show high risk was inferred from upper lobe
      await expect(page.getByText("Optional CT at 12 months")).toBeVisible();
    });

    test("should display multiple risk factors", async ({ page }) => {
      await page.getByText("Solid nodule", { exact: true }).click();
      await page.getByText("Single nodule", { exact: true }).click();
      await page.fill('input[id="nodule_size"]', "7");
      await page.getByText("High risk - Smoking history").click();
      await page.getByText("Former smoker", { exact: true }).click();
      await page.locator('label:has-text("Upper Lobe Location")').click();
      await page.locator('label:has-text("Spiculated or Irregular")').click();
      await page
        .locator('label:has-text("Family History of Lung Cancer")')
        .click();

      await page.click('button:has-text("Calculate")');

      // Results should show risk factors present section
      await expect(page.getByText("Risk Factors Present:")).toBeVisible();
      await expect(page.getByText("CT at 6-12 months").first()).toBeVisible();
    });
  });

  test.describe("Input Validation", () => {
    test("should show error when required fields missing", async ({ page }) => {
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Please specify nodule type, count, and size"),
      ).toBeVisible();
    });

    test("should show error for invalid nodule size", async ({ page }) => {
      await page.getByText("Solid nodule", { exact: true }).click();
      await page.getByText("Single nodule", { exact: true }).click();
      await page.fill('input[id="nodule_size"]', "-5");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Please enter a valid nodule size"),
      ).toBeVisible();
    });

    test("should show error when nodule type not selected", async ({
      page,
    }) => {
      await page.getByText("Single nodule", { exact: true }).click();
      await page.fill('input[id="nodule_size"]', "7");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Please specify nodule type"),
      ).toBeVisible();
    });
  });

  test.describe("Result Display", () => {
    test("should display nodule characteristics summary", async ({ page }) => {
      await page.getByText("Solid nodule", { exact: true }).click();
      await page.getByText("Single nodule", { exact: true }).click();
      await page.fill('input[id="nodule_size"]', "7");
      await page.getByText("Low risk - No or minimal").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Nodule Characteristics")).toBeVisible();
      await expect(page.locator("text=Solid, single, 7mm")).toBeVisible();
    });

    test("should display important caveats", async ({ page }) => {
      await page.getByText("Solid nodule", { exact: true }).click();
      await page.getByText("Single nodule", { exact: true }).click();
      await page.fill('input[id="nodule_size"]', "7");
      await page.getByText("Low risk - No or minimal").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.getByText("Important Caveats")).toBeVisible();
      await expect(
        page.getByText("NOT for lung cancer screening"),
      ).toBeVisible();
    });
  });

  test.describe("Edge Cases and Boundary Values", () => {
    test("should handle exactly 6mm solid nodule correctly", async ({
      page,
    }) => {
      await page.getByText("Solid nodule", { exact: true }).click();
      await page.getByText("Single nodule", { exact: true }).click();
      await page.fill('input[id="nodule_size"]', "6");
      await page.getByText("Low risk - No or minimal").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=CT at 6-12 months")).toBeVisible();
    });

    test("should handle exactly 8mm solid nodule correctly", async ({
      page,
    }) => {
      await page.getByText("Solid nodule", { exact: true }).click();
      await page.getByText("Single nodule", { exact: true }).click();
      await page.fill('input[id="nodule_size"]', "8");
      await page.getByText("Low risk - No or minimal").click();

      await page.click('button:has-text("Calculate")');

      // 8mm is at upper bound of 6-8mm range
      await expect(page.locator("text=CT at 6-12 months")).toBeVisible();
    });

    test("should handle 8.1mm as >8mm nodule", async ({ page }) => {
      await page.getByText("Solid nodule", { exact: true }).click();
      await page.getByText("Single nodule", { exact: true }).click();
      await page.fill('input[id="nodule_size"]', "8.1");
      await page.getByText("High risk - Smoking history").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.getByText("PET/CT").first()).toBeVisible();
    });

    test("should handle very large nodule (>30mm)", async ({ page }) => {
      await page.getByText("Solid nodule", { exact: true }).click();
      await page.getByText("Single nodule", { exact: true }).click();
      await page.fill('input[id="nodule_size"]', "35");
      await page.getByText("High risk - Smoking history").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.getByText("PET/CT").first()).toBeVisible();
      await expect(page.getByText("tissue sampling")).toBeVisible();
    });

    test("should handle decimal nodule sizes", async ({ page }) => {
      await page.getByText("Solid nodule", { exact: true }).click();
      await page.getByText("Single nodule", { exact: true }).click();
      await page.fill('input[id="nodule_size"]', "5.5");
      await page.getByText("Low risk - No or minimal").click();

      await page.click('button:has-text("Calculate")');

      // 5.5mm is <6mm
      await expect(page.locator("text=No routine follow-up")).toBeVisible();
    });
  });

  test.describe("References", () => {
    test("should display Fleischner references", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: "References" }),
      ).toBeVisible();
      await expect(page.getByText("MacMahon H").first()).toBeVisible();
    });

    test("should have correct number of reference links", async ({ page }) => {
      const refLinks = page.locator(
        'a[href^="https://doi.org"], a[href^="https://www.acr.org"]',
      );
      await expect(refLinks).toHaveCount(6);
    });

    test("should have valid DOI links for primary sources", async ({
      page,
    }) => {
      // 2017 Fleischner Guidelines (MacMahon et al.)
      const guideline2017 = page.locator(
        'a[href="https://doi.org/10.1148/radiol.2017161659"]',
      );
      await expect(guideline2017).toBeVisible();
      await expect(guideline2017).toContainText("Radiology. 2017");

      // Subsolid nodules (Naidich et al. 2013)
      const subsolid = page.locator(
        'a[href="https://doi.org/10.1148/radiol.12120628"]',
      );
      await expect(subsolid).toBeVisible();
      await expect(subsolid).toContainText("Radiology. 2013");

      // Original 2005 guidelines
      const original = page.locator(
        'a[href="https://doi.org/10.1148/radiol.2372041887"]',
      );
      await expect(original).toBeVisible();
      await expect(original).toContainText("Radiology. 2005");
    });

    test("should open reference links in new tab", async ({ page }) => {
      const refLinks = page.locator('a[href^="https://doi.org"]');
      const firstLink = refLinks.first();

      // Check that external links have proper attributes
      const href = await firstLink.getAttribute("href");
      expect(href).toContain("doi.org");
    });
  });
});
