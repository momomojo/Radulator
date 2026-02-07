import { test, expect } from "@playwright/test";
import { navigateToCalculator } from "../../../helpers/calculator-test-helper.js";

/**
 * E2E Tests for Lung-RADS v2022 Calculator
 * ACR Lung Imaging Reporting and Data System for lung cancer screening CT
 *
 * Lung-RADS Categories:
 * - Category 0: Incomplete (prior CT needed for comparison)
 * - Category 1: Negative (no nodules)
 * - Category 2: Benign appearance (<1% malignancy)
 * - Category 3: Probably benign (1-2% malignancy)
 * - Category 4A: Suspicious (5-15% malignancy)
 * - Category 4B: Suspicious (>15% malignancy)
 * - Category 4X: Features suspicious for malignancy (4A/4B with modifier)
 *
 * Key Size Thresholds (solid nodules):
 * - <6mm: Category 2
 * - 6-8mm (new): Category 3
 * - 8-15mm (new) or ≥6mm (growing): Category 4A
 * - ≥15mm (new): Category 4B
 */

test.describe("Lung-RADS v2022 Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, "Lung-RADS v2022");
  });

  test.describe("Visual and UI Tests", () => {
    test("should display calculator with correct title and description", async ({
      page,
    }) => {
      await expect(page.locator("h2")).toContainText("Lung-RADS");
      await expect(
        page.getByText("Lung cancer screening CT classification"),
      ).toBeVisible();
    });

    test("should have all required input fields", async ({ page }) => {
      await expect(
        page.locator(
          'label:has-text("Prior Lung Cancer Screening CT Available")',
        ),
      ).toBeVisible();
      await expect(
        page.locator('label:has-text("Dominant Finding Type")'),
      ).toBeVisible();
    });

    test("should display info section with Lung-RADS explanation", async ({
      page,
    }) => {
      await expect(
        page.getByText("Lung-RADS (Lung Imaging Reporting and Data System)"),
      ).toBeVisible();
      await expect(page.getByText("Category 0: Incomplete")).toBeVisible();
    });

    test("should show solid nodule size field when solid nodule selected", async ({
      page,
    }) => {
      // Initially hidden
      await expect(
        page.locator('label:has-text("Solid Nodule Size (mm)")'),
      ).not.toBeVisible();

      // Select solid nodule type
      await page.getByText("Solid nodule or mass").click();

      // Should now be visible
      await expect(
        page.locator('label:has-text("Solid Nodule Size (mm)")'),
      ).toBeVisible();
    });

    test("should show part-solid fields when part-solid nodule selected", async ({
      page,
    }) => {
      // Select part-solid nodule type
      await page
        .getByText("Part-solid nodule (ground-glass with solid component)")
        .click();

      // Should show both size fields
      await expect(
        page.locator('label:has-text("Part-Solid Nodule Total Size (mm)")'),
      ).toBeVisible();
      await expect(
        page.locator('label:has-text("Solid Component Size (mm)")'),
      ).toBeVisible();
    });
  });

  test.describe("Category 0 - Incomplete", () => {
    test("should classify as Category 0 when prior expected but unavailable", async ({
      page,
    }) => {
      await page.getByText("No - prior expected but unavailable").click();
      await page.getByText("Solid nodule or mass").click();
      await page.fill('input[id="solid_size"]', "10");
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("0 - Incomplete");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Management:')",
        ),
      ).toContainText("prior CT required");
    });
  });

  test.describe("Category 1 - Negative", () => {
    test("should classify as Category 1 for no nodules (baseline)", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page.getByText("No nodules (negative exam)").click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("1 - Negative");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Malignancy Probability:')",
        ),
      ).toContainText("<1%");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Management:')",
        ),
      ).toContainText("annual screening");
    });

    test("should classify as Category 1 for no nodules (with prior available)", async ({
      page,
    }) => {
      await page.getByText("Yes - prior screening CT available").click();
      await page.getByText("No nodules (negative exam)").click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("1 - Negative");
    });
  });

  test.describe("Category 2 - Benign Appearance", () => {
    test("should classify as Category 2 for definitely benign nodule", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page
        .getByText("Definitely benign (calcified granuloma, hamartoma)")
        .click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("2 - Benign Appearance");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Malignancy Probability:')",
        ),
      ).toContainText("<1%");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Management:')",
        ),
      ).toContainText("annual screening");
    });

    test("should classify as Category 2 for solid nodule <6mm (baseline)", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page.getByText("Solid nodule or mass").click();
      await page.fill('input[id="solid_size"]', "4");
      await page.getByLabel("None", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("2 - Benign Appearance");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Malignancy Probability:')",
        ),
      ).toContainText("<1%");
    });

    test("should classify as Category 2 for stable solid nodule 6-8mm", async ({
      page,
    }) => {
      await page.getByText("Yes - prior screening CT available").click();
      await page.getByText("Solid nodule or mass").click();
      await page.fill('input[id="solid_size"]', "7");
      await page.getByText("Stable (unchanged for").click();
      await page.getByLabel("None", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("2 - Benign Appearance");
    });

    test("should classify as Category 2 for perifissural nodule <10mm", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page.getByText("Perifissural nodule (PFN)").click();
      await page.fill('input[id="solid_size"]', "8");
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("2 - Benign Appearance");
      await expect(
        page.locator("section[aria-live='polite'] > div:has-text('Finding:')"),
      ).toContainText("intrapulmonary lymph node");
    });

    test("should classify as Category 2 for small pure GGN <30mm (baseline)", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page.getByText("Pure ground-glass nodule (pGGN)").click();
      await page.fill('input[id="ggn_size"]', "20");
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("2 - Benign Appearance");
    });
  });

  test.describe("Category 3 - Probably Benign", () => {
    test("should classify as Category 3 for new solid nodule 6-8mm", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page.getByText("Solid nodule or mass").click();
      await page.fill('input[id="solid_size"]', "7");
      await page.getByLabel("None", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("3 - Probably Benign");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Malignancy Probability:')",
        ),
      ).toContainText("1-2%");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Management:')",
        ),
      ).toContainText("6-month LDCT");
    });

    test("should classify as Category 3 for new solid nodule on follow-up", async ({
      page,
    }) => {
      await page.getByText("Yes - prior screening CT available").click();
      await page.getByText("Solid nodule or mass").click();
      await page.fill('input[id="solid_size"]', "6");
      await page.getByText("New nodule").click();
      await page.getByLabel("None", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("3 - Probably Benign");
    });

    test("should classify as Category 3 for large perifissural nodule >=10mm", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page.getByText("Perifissural nodule (PFN)").click();
      await page.fill('input[id="solid_size"]', "12");
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("3 - Probably Benign");
    });

    test("should classify as Category 3 for growing pure GGN <30mm", async ({
      page,
    }) => {
      await page.getByText("Yes - prior screening CT available").click();
      await page.getByText("Pure ground-glass nodule (pGGN)").click();
      await page.fill('input[id="ggn_size"]', "20");
      await page.getByText("Growing", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("3 - Probably Benign");
    });

    test("should classify as Category 3 for large pure GGN >=30mm", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page.getByText("Pure ground-glass nodule (pGGN)").click();
      await page.fill('input[id="ggn_size"]', "35");
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("3 - Probably Benign");
    });

    test("should classify as Category 3 for new part-solid nodule with solid <6mm", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page
        .getByText("Part-solid nodule (ground-glass with solid component)")
        .click();
      await page.fill('input[id="part_solid_total"]', "15");
      await page.fill('input[id="part_solid_solid"]', "4");
      await page.getByLabel("None", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("3 - Probably Benign");
    });

    test("should classify as Category 3 for growing atypical cyst", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page.getByLabel("Atypical pulmonary cyst").click();
      await page.getByText("Growing", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("3 - Probably Benign");
    });
  });

  test.describe("Category 4A - Suspicious (5-15% malignancy)", () => {
    test("should classify as Category 4A for new solid nodule 8-15mm (baseline)", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page.getByText("Solid nodule or mass").click();
      await page.fill('input[id="solid_size"]', "10");
      await page.getByLabel("None", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("4A - Suspicious");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Malignancy Probability:')",
        ),
      ).toContainText("5-15%");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Management:')",
        ),
      ).toContainText("3-month LDCT");
    });

    test("should classify as Category 4A for growing solid nodule 6-8mm", async ({
      page,
    }) => {
      await page.getByText("Yes - prior screening CT available").click();
      await page.getByText("Solid nodule or mass").click();
      await page.fill('input[id="solid_size"]', "7");
      await page.getByText("Growing (").click();
      await page.getByLabel("None", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("4A - Suspicious");
    });

    test("should classify as Category 4A for new part-solid with solid 6-8mm", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page
        .getByText("Part-solid nodule (ground-glass with solid component)")
        .click();
      await page.fill('input[id="part_solid_total"]', "20");
      await page.fill('input[id="part_solid_solid"]', "7");
      await page.getByLabel("None", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("4A - Suspicious");
    });

    test("should classify as Category 4A for growing solid component in part-solid (solid <6mm)", async ({
      page,
    }) => {
      await page.getByText("Yes - prior screening CT available").click();
      await page
        .getByText("Part-solid nodule (ground-glass with solid component)")
        .click();
      await page.fill('input[id="part_solid_total"]', "15");
      await page.fill('input[id="part_solid_solid"]', "4");
      await page.getByText("Growing solid component").click();
      await page.getByLabel("None", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("4A - Suspicious");
    });

    test("should classify as Category 4A for atypical cyst with thick wall", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page.getByLabel("Atypical pulmonary cyst").click();
      await page.getByText("Thick wall (>4mm)").click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("4A - Suspicious");
    });

    test("should classify as Category 4A for atypical cyst with mural nodule", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page.getByLabel("Atypical pulmonary cyst").click();
      await page.getByText("Mural nodule present").click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("4A - Suspicious");
    });
  });

  test.describe("Category 4B - Suspicious (>15% malignancy)", () => {
    test("should classify as Category 4B for new solid nodule >=15mm", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page.getByText("Solid nodule or mass").click();
      await page.fill('input[id="solid_size"]', "18");
      await page.getByLabel("None", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("4B - Suspicious");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Malignancy Probability:')",
        ),
      ).toContainText(">15%");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Management:')",
        ),
      ).toContainText("PET/CT");
    });

    test("should classify as Category 4B for growing solid nodule 8-15mm", async ({
      page,
    }) => {
      await page.getByText("Yes - prior screening CT available").click();
      await page.getByText("Solid nodule or mass").click();
      await page.fill('input[id="solid_size"]', "12");
      await page.getByText("Growing (").click();
      await page.getByLabel("None", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("4B - Suspicious");
    });

    test("should classify as Category 4B for part-solid with solid >=8mm", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page
        .getByText("Part-solid nodule (ground-glass with solid component)")
        .click();
      await page.fill('input[id="part_solid_total"]', "25");
      await page.fill('input[id="part_solid_solid"]', "10");
      await page.getByLabel("None", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("4B - Suspicious");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Management:')",
        ),
      ).toContainText("Tissue sampling");
    });

    test("should classify as Category 4B for growing solid component 6-8mm in part-solid", async ({
      page,
    }) => {
      await page.getByText("Yes - prior screening CT available").click();
      await page
        .getByText("Part-solid nodule (ground-glass with solid component)")
        .click();
      await page.fill('input[id="part_solid_total"]', "18");
      await page.fill('input[id="part_solid_solid"]', "7");
      await page.getByText("Growing solid component").click();
      await page.getByLabel("None", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("4B - Suspicious");
    });
  });

  test.describe("Category 4X - Suspicious with Additional Features", () => {
    test("should classify as Category 4AX for 4A with spiculation", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page.getByText("Solid nodule or mass").click();
      await page.fill('input[id="solid_size"]', "10");
      await page.getByText("Spiculation").click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("4AX");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('4X Modifier:')",
        ),
      ).toBeVisible();
    });

    test("should classify as Category 4BX for 4B with lymphadenopathy", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page.getByText("Solid nodule or mass").click();
      await page.fill('input[id="solid_size"]', "18");
      await page.getByText("Suspicious lymphadenopathy").click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("4BX");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Management:')",
        ),
      ).toContainText("suspicious features");
    });

    test("should classify as Category 4AX for part-solid with other suspicious features", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page
        .getByText("Part-solid nodule (ground-glass with solid component)")
        .click();
      await page.fill('input[id="part_solid_total"]', "20");
      await page.fill('input[id="part_solid_solid"]', "6");
      await page.getByText("Other highly suspicious features").click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("4AX");
    });

    test("should NOT add X modifier when suspicious features is None", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page.getByText("Solid nodule or mass").click();
      await page.fill('input[id="solid_size"]', "10");
      await page.getByLabel("None", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("4A - Suspicious");
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).not.toContainText("4AX");
    });
  });

  test.describe("Input Validation", () => {
    test("should show error when nodule type not selected", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      // Don't select nodule type
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("section[aria-live='polite'] > div:has-text('Error:')"),
      ).toContainText("select the dominant finding type");
    });

    test("should show error when solid nodule size not entered", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page.getByText("Solid nodule or mass").click();
      // Don't enter size
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("section[aria-live='polite'] > div:has-text('Error:')"),
      ).toContainText("enter the solid nodule size");
    });

    test("should show error when part-solid total size not entered", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page
        .getByText("Part-solid nodule (ground-glass with solid component)")
        .click();
      // Don't enter total size
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("section[aria-live='polite'] > div:has-text('Error:')"),
      ).toContainText("total part-solid nodule size");
    });

    test("should show error when GGN size not entered", async ({ page }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page.getByText("Pure ground-glass nodule (pGGN)").click();
      // Don't enter size
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("section[aria-live='polite'] > div:has-text('Error:')"),
      ).toContainText("ground-glass nodule size");
    });
  });

  test.describe("Conditional Field Display", () => {
    test("should show nodule change options only when prior CT is available", async ({
      page,
    }) => {
      // With baseline (no prior), no change options
      await page.getByText("No - baseline scan (first screening)").click();
      await page.getByText("Solid nodule or mass").click();

      await expect(
        page.locator('label:has-text("Nodule Change from Prior")'),
      ).not.toBeVisible();

      // Select prior available
      await page.getByText("Yes - prior screening CT available").click();

      // Now change options should be visible
      await expect(
        page.locator('label:has-text("Nodule Change from Prior")'),
      ).toBeVisible();
    });

    test("should show part-solid change options when prior CT and part-solid selected", async ({
      page,
    }) => {
      await page.getByText("Yes - prior screening CT available").click();
      await page
        .getByText("Part-solid nodule (ground-glass with solid component)")
        .click();

      await expect(
        page.locator('label:has-text("Part-Solid Nodule Change")'),
      ).toBeVisible();
    });

    test("should show GGN change options when prior CT and GGN selected", async ({
      page,
    }) => {
      await page.getByText("Yes - prior screening CT available").click();
      await page.getByText("Pure ground-glass nodule (pGGN)").click();

      await expect(
        page.locator('label:has-text("GGN Change from Prior")'),
      ).toBeVisible();
    });

    test("should show cyst features when atypical cyst selected", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page.getByLabel("Atypical pulmonary cyst").click();

      await expect(
        page.locator('label:has-text("Atypical Cyst Features")'),
      ).toBeVisible();
    });

    test("should show suspicious features only for solid and part-solid nodules", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();

      // Check solid nodule shows suspicious features
      await page.getByText("Solid nodule or mass").click();
      await expect(
        page.locator('label:has-text("Additional Suspicious Features")'),
      ).toBeVisible();

      // Check part-solid shows suspicious features
      await page
        .getByText("Part-solid nodule (ground-glass with solid component)")
        .click();
      await expect(
        page.locator('label:has-text("Additional Suspicious Features")'),
      ).toBeVisible();

      // Check GGN does NOT show suspicious features
      await page.getByText("Pure ground-glass nodule (pGGN)").click();
      await expect(
        page.locator('label:has-text("Additional Suspicious Features")'),
      ).not.toBeVisible();
    });
  });

  test.describe("Clinical Notes", () => {
    test("should show baseline scan note", async ({ page }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page.getByText("Solid nodule or mass").click();
      await page.fill('input[id="solid_size"]', "7");
      await page.getByLabel("None", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Clinical Notes:')",
        ),
      ).toContainText("Baseline scan");
    });

    test("should show short-term follow-up note for Category 3", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page.getByText("Solid nodule or mass").click();
      await page.fill('input[id="solid_size"]', "7");
      await page.getByLabel("None", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Clinical Notes:')",
        ),
      ).toContainText("Short-term follow-up");
    });

    test("should show part-solid malignancy risk note", async ({ page }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page
        .getByText("Part-solid nodule (ground-glass with solid component)")
        .click();
      await page.fill('input[id="part_solid_total"]', "15");
      await page.fill('input[id="part_solid_solid"]', "4");
      await page.getByLabel("None", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Clinical Notes:')",
        ),
      ).toContainText("higher malignancy risk");
    });
  });

  test.describe("Edge Cases and Boundary Values", () => {
    test("should handle exactly 6mm solid nodule (threshold boundary)", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page.getByText("Solid nodule or mass").click();
      await page.fill('input[id="solid_size"]', "6");
      await page.getByLabel("None", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      // 6mm is at lower bound of 6-8mm range = Category 3
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("3 - Probably Benign");
    });

    test("should handle exactly 8mm solid nodule (threshold boundary)", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page.getByText("Solid nodule or mass").click();
      await page.fill('input[id="solid_size"]', "8");
      await page.getByLabel("None", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      // 8mm is at upper bound of 6-8mm range for baseline = still 4A
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("4A - Suspicious");
    });

    test("should handle exactly 15mm solid nodule (threshold boundary)", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page.getByText("Solid nodule or mass").click();
      await page.fill('input[id="solid_size"]', "15");
      await page.getByLabel("None", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      // 15mm is >=15mm = Category 4B
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("4B - Suspicious");
    });

    test("should handle exactly 30mm pure GGN (threshold boundary)", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page.getByText("Pure ground-glass nodule (pGGN)").click();
      await page.fill('input[id="ggn_size"]', "30");
      await page.click('button:has-text("Calculate")');

      // 30mm is >=30mm = Category 3
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("3 - Probably Benign");
    });

    test("should handle exactly 10mm perifissural nodule (threshold boundary)", async ({
      page,
    }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page.getByText("Perifissural nodule (PFN)").click();
      await page.fill('input[id="solid_size"]', "10");
      await page.click('button:has-text("Calculate")');

      // 10mm is >=10mm = Category 3
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("3 - Probably Benign");
    });

    test("should handle decimal nodule sizes", async ({ page }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page.getByText("Solid nodule or mass").click();
      await page.fill('input[id="solid_size"]', "5.9");
      await page.getByLabel("None", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      // 5.9mm is <6mm = Category 2
      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("2 - Benign Appearance");
    });

    test("should handle very large nodule", async ({ page }) => {
      await page.getByText("No - baseline scan (first screening)").click();
      await page.getByText("Solid nodule or mass").click();
      await page.fill('input[id="solid_size"]', "50");
      await page.getByLabel("None", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "section[aria-live='polite'] > div:has-text('Lung-RADS Category:')",
        ),
      ).toContainText("4B - Suspicious");
    });
  });

  test.describe("References", () => {
    test("should display Lung-RADS references", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: "References" }),
      ).toBeVisible();
      await expect(page.getByText("ACR Lung-RADS v2022").first()).toBeVisible();
    });

    test("should have ACR Lung-RADS link", async ({ page }) => {
      const acrLink = page.locator(
        'a[href="https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/Lung-RADS"]',
      );
      await expect(acrLink.first()).toBeVisible();
    });

    test("should have valid DOI links for key studies", async ({ page }) => {
      // NLST study
      const nlstLink = page.locator(
        'a[href="https://doi.org/10.1056/NEJMoa1102873"]',
      );
      await expect(nlstLink).toBeVisible();

      // NELSON trial
      const nelsonLink = page.locator(
        'a[href="https://doi.org/10.1056/NEJMoa1911793"]',
      );
      await expect(nelsonLink).toBeVisible();
    });
  });
});
