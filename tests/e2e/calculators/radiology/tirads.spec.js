import { test, expect } from "@playwright/test";
import { navigateToCalculator } from "../../../helpers/calculator-test-helper.js";

/**
 * E2E Tests for ACR TI-RADS Calculator
 * Thyroid Imaging Reporting and Data System
 *
 * ACR TI-RADS uses a point-based system with 5 ultrasound feature categories:
 * - Composition (0-2 pts)
 * - Echogenicity (0-3 pts)
 * - Shape (0-3 pts)
 * - Margin (0-3 pts)
 * - Echogenic Foci (0-3 pts)
 *
 * Categories:
 * - TR1 (0 pts): Benign, <2% malignancy risk
 * - TR2 (2 pts): Not Suspicious, <2% malignancy risk
 * - TR3 (3 pts): Mildly Suspicious, ~5% malignancy risk
 * - TR4 (4-6 pts): Moderately Suspicious, 5-20% malignancy risk
 * - TR5 (≥7 pts): Highly Suspicious, >20% malignancy risk
 */

test.describe("ACR TI-RADS Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, "ACR TI-RADS");
  });

  test.describe("Visual and UI Tests", () => {
    test("should display calculator with correct title and description", async ({
      page,
    }) => {
      await expect(page.locator("h2")).toContainText("ACR TI-RADS");
      await expect(
        page.getByText("ACR TI-RADS", { exact: true }).first(),
      ).toBeVisible();
    });

    test("should have all 5 ultrasound feature categories", async ({
      page,
    }) => {
      await expect(
        page.getByText("Composition", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Echogenicity", { exact: true }),
      ).toBeVisible();
      await expect(page.getByText("Shape", { exact: true })).toBeVisible();
      await expect(page.getByText("Margin", { exact: true })).toBeVisible();
      await expect(page.getByText("Echogenic Foci").first()).toBeVisible();
    });

    test("should have nodule size input field", async ({ page }) => {
      await expect(page.getByText("Maximum Nodule Dimension")).toBeVisible();
    });

    test("should display info section with TI-RADS explanation", async ({
      page,
    }) => {
      await expect(
        page.getByText("5 ultrasound feature categories"),
      ).toBeVisible();
      await expect(page.getByText("TI-RADS category").first()).toBeVisible();
    });
  });

  test.describe("TR1 - Benign Category", () => {
    test("should calculate TR1 for purely cystic nodule (0 pts)", async ({
      page,
    }) => {
      // Select all benign features (0 points each)
      await page
        .getByText("Cystic or almost completely cystic (0 pts)")
        .click();
      await page.getByText("Anechoic (0 pts)").click();
      await page.getByText("Wider-than-tall (0 pts)").click();
      await page.getByText("Smooth (0 pts)").click();
      await page
        .getByText("None or large comet-tail artifacts (0 pts)")
        .click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=TR1 - Benign")).toBeVisible();
      await expect(page.locator("text=0 points")).toBeVisible();
      await expect(page.locator("text=<2%")).toBeVisible();
      await expect(page.locator("text=No FNA recommended")).toBeVisible();
    });
  });

  test.describe("TR2 - Not Suspicious Category", () => {
    test("should calculate TR2 for spongiform nodule (0 pts)", async ({
      page,
    }) => {
      await page.getByText("Spongiform (0 pts)").click();
      await page.getByText("Hyperechoic or isoechoic (1 pt)").click(); // 1 pt
      await page.getByText("Wider-than-tall (0 pts)").click(); // 0 pts
      await page.getByText("Smooth (0 pts)").click(); // 0 pts
      await page.getByText("Macrocalcifications (1 pt)").click(); // 1 pt

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=TR2 - Not Suspicious")).toBeVisible();
      await expect(page.getByText("Total Points: 2 points")).toBeVisible();
      await expect(page.getByText("<2%").first()).toBeVisible();
    });
  });

  test.describe("TR3 - Mildly Suspicious Category", () => {
    test("should calculate TR3 for 3 points", async ({ page }) => {
      await page.getByText("Solid or almost completely solid (2 pts)").click(); // 2 pts
      await page.getByText("Hyperechoic or isoechoic (1 pt)").click(); // 1 pt
      await page.getByText("Wider-than-tall (0 pts)").click(); // 0 pts
      await page.getByText("Smooth (0 pts)").click(); // 0 pts
      await page
        .getByText("None or large comet-tail artifacts (0 pts)")
        .click(); // 0 pts

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=TR3 - Mildly Suspicious")).toBeVisible();
      await expect(page.getByText("Total Points: 3 points")).toBeVisible();
      await expect(page.getByText("~5%").first()).toBeVisible();
    });

    test("should recommend FNA for TR3 ≥2.5 cm", async ({ page }) => {
      await page.getByText("Solid or almost completely solid (2 pts)").click();
      await page.getByText("Hyperechoic or isoechoic (1 pt)").click();
      await page.getByText("Wider-than-tall (0 pts)").click();
      await page.getByText("Smooth (0 pts)").click();
      await page
        .getByText("None or large comet-tail artifacts (0 pts)")
        .click();
      await page.fill('input[id="nodule_size"]', "2.8");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=FNA recommended")).toBeVisible();
      await expect(page.locator("text=2.5 cm")).toBeVisible();
    });
  });

  test.describe("TR4 - Moderately Suspicious Category", () => {
    test("should calculate TR4 for 4 points", async ({ page }) => {
      await page.getByText("Solid or almost completely solid (2 pts)").click(); // 2 pts
      await page.getByText("Hypoechoic (2 pts)").click(); // 2 pts
      await page.getByText("Wider-than-tall (0 pts)").click(); // 0 pts
      await page.getByText("Smooth (0 pts)").click(); // 0 pts
      await page
        .getByText("None or large comet-tail artifacts (0 pts)")
        .click(); // 0 pts

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=TR4 - Moderately Suspicious"),
      ).toBeVisible();
      await expect(page.locator("text=4 points")).toBeVisible();
      await expect(page.locator("text=5-20%")).toBeVisible();
    });

    test("should calculate TR4 for 6 points", async ({ page }) => {
      await page.getByText("Solid or almost completely solid (2 pts)").click(); // 2 pts
      await page.getByText("Hypoechoic (2 pts)").click(); // 2 pts
      await page.getByText("Wider-than-tall (0 pts)").click(); // 0 pts
      await page.getByText("Lobulated or irregular (2 pts)").click(); // 2 pts
      await page
        .getByText("None or large comet-tail artifacts (0 pts)")
        .click(); // 0 pts

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=TR4 - Moderately Suspicious"),
      ).toBeVisible();
      await expect(page.locator("text=6 points")).toBeVisible();
    });

    test("should recommend FNA for TR4 ≥1.5 cm", async ({ page }) => {
      await page.getByText("Solid or almost completely solid (2 pts)").click();
      await page.getByText("Hypoechoic (2 pts)").click();
      await page.getByText("Wider-than-tall (0 pts)").click();
      await page.getByText("Smooth (0 pts)").click();
      await page
        .getByText("None or large comet-tail artifacts (0 pts)")
        .click();
      await page.fill('input[id="nodule_size"]', "1.8");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=FNA recommended")).toBeVisible();
      await expect(page.locator("text=1.5 cm")).toBeVisible();
    });
  });

  test.describe("TR5 - Highly Suspicious Category", () => {
    test("should calculate TR5 for 7+ points", async ({ page }) => {
      await page.getByText("Solid or almost completely solid (2 pts)").click(); // 2 pts
      await page.getByText("Hypoechoic (2 pts)").click(); // 2 pts
      await page.getByText("Taller-than-wide (3 pts)").click(); // 3 pts
      await page.getByText("Smooth (0 pts)").click(); // 0 pts
      await page
        .getByText("None or large comet-tail artifacts (0 pts)")
        .click(); // 0 pts

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=TR5 - Highly Suspicious")).toBeVisible();
      await expect(page.locator("text=7 points")).toBeVisible();
      await expect(page.locator("text=>20%")).toBeVisible();
    });

    test("should calculate high-risk nodule with all suspicious features (12+ pts)", async ({
      page,
    }) => {
      await page.getByText("Solid or almost completely solid (2 pts)").click(); // 2 pts
      await page.getByText("Hypoechoic (2 pts)").click(); // 2 pts
      await page.getByText("Taller-than-wide (3 pts)").click(); // 3 pts
      await page.getByText("Lobulated or irregular (2 pts)").click(); // 2 pts
      await page.getByText("Punctate echogenic foci (3 pts)").click(); // 3 pts
      await page.fill('input[id="nodule_size"]', "1.5");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=TR5 - Highly Suspicious")).toBeVisible();
      await expect(page.locator("text=12 points")).toBeVisible();
      await expect(page.locator("text=FNA recommended")).toBeVisible();
    });

    test("should recommend FNA for TR5 ≥1.0 cm", async ({ page }) => {
      await page.getByText("Solid or almost completely solid (2 pts)").click();
      await page.getByText("Very hypoechoic (3 pts)").click(); // 3 pts
      await page.getByText("Taller-than-wide (3 pts)").click(); // 3 pts
      await page.getByText("Smooth (0 pts)").click();
      await page
        .getByText("None or large comet-tail artifacts (0 pts)")
        .click();
      await page.fill('input[id="nodule_size"]', "1.2");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=TR5 - Highly Suspicious")).toBeVisible();
      await expect(page.locator("text=FNA recommended")).toBeVisible();
      await expect(page.locator("text=1.0 cm")).toBeVisible();
    });

    test("should show clinical notes for extrathyroidal extension", async ({
      page,
    }) => {
      await page.getByText("Solid or almost completely solid (2 pts)").click();
      await page.getByText("Hypoechoic (2 pts)").click();
      await page.getByText("Wider-than-tall (0 pts)").click();
      await page.getByText("Extrathyroidal extension (3 pts)").click(); // 3 pts
      await page
        .getByText("None or large comet-tail artifacts (0 pts)")
        .click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Extrathyroidal extension is highly suspicious"),
      ).toBeVisible();
    });
  });

  test.describe("Point Breakdown", () => {
    test("should display accurate point breakdown", async ({ page }) => {
      await page.getByText("Solid or almost completely solid (2 pts)").click(); // 2 pts
      await page.getByText("Hypoechoic (2 pts)").click(); // 2 pts
      await page.getByText("Taller-than-wide (3 pts)").click(); // 3 pts
      await page.getByText("Lobulated or irregular (2 pts)").click(); // 2 pts
      await page.getByText("Punctate echogenic foci (3 pts)").click(); // 3 pts

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Composition: 2")).toBeVisible();
      await expect(page.locator("text=Echogenicity: 2")).toBeVisible();
      await expect(page.locator("text=Shape: 3")).toBeVisible();
      await expect(page.locator("text=Margin: 2")).toBeVisible();
      await expect(page.locator("text=Echogenic Foci: 3")).toBeVisible();
    });
  });

  test.describe("Clinical Notes", () => {
    test("should show note for spongiform composition", async ({ page }) => {
      await page.getByText("Spongiform (0 pts)").click();
      await page.getByText("Anechoic (0 pts)").click();
      await page.getByText("Wider-than-tall (0 pts)").click();
      await page.getByText("Smooth (0 pts)").click();
      await page
        .getByText("None or large comet-tail artifacts (0 pts)")
        .click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Spongiform composition is a benign feature"),
      ).toBeVisible();
    });

    test("should show note for punctate echogenic foci", async ({ page }) => {
      await page.getByText("Solid or almost completely solid (2 pts)").click();
      await page.getByText("Hypoechoic (2 pts)").click();
      await page.getByText("Wider-than-tall (0 pts)").click();
      await page.getByText("Smooth (0 pts)").click();
      await page.getByText("Punctate echogenic foci (3 pts)").click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=psammomatous calcifications"),
      ).toBeVisible();
      await expect(
        page.locator("text=papillary thyroid carcinoma"),
      ).toBeVisible();
    });

    test("should show note for taller-than-wide shape", async ({ page }) => {
      await page.getByText("Solid or almost completely solid (2 pts)").click();
      await page.getByText("Hypoechoic (2 pts)").click();
      await page.getByText("Taller-than-wide (3 pts)").click();
      await page.getByText("Smooth (0 pts)").click();
      await page
        .getByText("None or large comet-tail artifacts (0 pts)")
        .click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=growth across tissue planes"),
      ).toBeVisible();
    });
  });

  test.describe("Input Validation", () => {
    test("should show error when features not selected", async ({ page }) => {
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Please complete all ultrasound feature assessments"),
      ).toBeVisible();
    });

    test("should show error when only partial features selected", async ({
      page,
    }) => {
      await page.getByText("Solid or almost completely solid (2 pts)").click();
      await page.getByText("Hypoechoic (2 pts)").click();
      // Missing Shape, Margin, Echogenic Foci

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Please complete all ultrasound feature assessments"),
      ).toBeVisible();
    });
  });

  test.describe("References", () => {
    test("should display ACR TI-RADS references", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: "References" }),
      ).toBeVisible();
      await expect(page.getByText("Tessler FN").first()).toBeVisible();
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
      // ACR TI-RADS White Paper (Tessler et al. 2017)
      const whitePaper = page.locator(
        'a[href="https://doi.org/10.1016/j.jacr.2017.01.046"]',
      );
      await expect(whitePaper).toBeVisible();
      await expect(whitePaper).toContainText("J Am Coll Radiol. 2017");

      // TI-RADS Lexicon (Grant et al. 2015)
      const lexicon = page.locator(
        'a[href="https://doi.org/10.1016/j.jacr.2015.07.011"]',
      );
      await expect(lexicon).toBeVisible();
      await expect(lexicon).toContainText("J Am Coll Radiol. 2015");

      // ATA Guidelines (Haugen et al. 2016)
      const ata = page.locator(
        'a[href="https://doi.org/10.1089/thy.2015.0020"]',
      );
      await expect(ata).toBeVisible();
      await expect(ata).toContainText("Thyroid. 2016");
    });

    test("should have link to ACR TI-RADS official resources", async ({
      page,
    }) => {
      const acrLink = page.locator(
        'a[href="https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/TI-RADS"]',
      );
      await expect(acrLink).toBeVisible();
      await expect(acrLink).toContainText("ACR");
    });
  });
});
