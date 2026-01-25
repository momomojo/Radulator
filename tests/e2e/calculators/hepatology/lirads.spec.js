/**
 * LI-RADS v2018 Calculator - E2E Tests
 *
 * Tests the Liver Imaging Reporting and Data System calculator for
 * hepatocellular carcinoma (HCC) risk stratification in at-risk patients.
 *
 * Test Coverage:
 * - LR-1: Definitely benign (0% HCC)
 * - LR-2: Probably benign (~14% HCC)
 * - LR-3: Intermediate probability (38-40% HCC)
 * - LR-4: Probably HCC (67-74% HCC)
 * - LR-5: Definitely HCC (92-95% HCC)
 * - LR-M: Malignant, not HCC-specific (93-100% malignancy)
 * - LR-TIV: Tumor in vein
 * - LR-NC: Not categorizable (inadequate study)
 * - Ancillary feature adjustments
 * - Diagnostic table algorithm
 * - Reference verification
 */

import { test, expect } from "@playwright/test";
import {
  navigateToCalculator,
  verifyReferenceLinks,
  verifyThemeConsistency,
  verifyMobileResponsive,
} from "../../../helpers/calculator-test-helper.js";

const CALCULATOR_NAME = "LI-RADS v2018";

test.describe("LI-RADS v2018 Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, CALCULATOR_NAME);

    // Verify calculator loaded
    await expect(page.locator("h2")).toContainText("LI-RADS v2018");
  });

  test.describe("Visual and UI Tests", () => {
    test("should display calculator with correct title and description", async ({
      page,
    }) => {
      await expect(page.locator("h2")).toContainText("LI-RADS v2018");
      await expect(
        page.getByText("Liver Imaging Reporting and Data System"),
      ).toBeVisible();
    });

    test("should display info section with LI-RADS explanation", async ({
      page,
    }) => {
      await expect(page.getByText("At-Risk Population")).toBeVisible();
      await expect(page.getByText("LR-1")).toBeVisible();
      await expect(page.getByText("LR-5")).toBeVisible();
    });

    test("should have initial checkbox for at-risk population", async ({
      page,
    }) => {
      await expect(
        page.getByText("Patient in LI-RADS At-Risk Population"),
      ).toBeVisible();
    });
  });

  test.describe("LR-NC - Not Categorizable (Inadequate Study)", () => {
    test("should show LR-NC when study is technically inadequate", async ({
      page,
    }) => {
      // Enable at-risk population
      await page.getByText("Patient in LI-RADS At-Risk Population").click();

      // Leave study_adequate unchecked (not adequate)
      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=LR-NC")).toBeVisible();
      await expect(page.locator("text=Not Categorizable")).toBeVisible();
      await expect(page.locator("text=Repeat imaging")).toBeVisible();
    });
  });

  test.describe("LR-TIV - Tumor in Vein", () => {
    test("should classify as LR-TIV when definite tumor in vein", async ({
      page,
    }) => {
      // Enable at-risk population and adequate study
      await page.getByText("Patient in LI-RADS At-Risk Population").click();
      await page.getByText("Study Technically Adequate").click();

      // Select tumor in vein
      await page.getByText("Definite Tumor in Vein (LR-TIV)").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=LR-TIV")).toBeVisible();
      await expect(page.locator("text=Tumor in Vein")).toBeVisible();
      await expect(
        page.locator("text=Contraindication to liver transplantation"),
      ).toBeVisible();
    });
  });

  test.describe("LR-1 - Definitely Benign", () => {
    test("should classify as LR-1 for definitely benign observation", async ({
      page,
    }) => {
      await page.getByText("Patient in LI-RADS At-Risk Population").click();
      await page.getByText("Study Technically Adequate").click();

      // Select definitely benign
      await page.getByText("Definitely benign").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=LR-1")).toBeVisible();
      await expect(page.locator("text=Definitely Benign")).toBeVisible();
      await expect(page.locator("text=0%")).toBeVisible();
      await expect(
        page.locator("text=Return to routine surveillance"),
      ).toBeVisible();
    });
  });

  test.describe("LR-2 - Probably Benign", () => {
    test("should classify as LR-2 for probably benign observation", async ({
      page,
    }) => {
      await page.getByText("Patient in LI-RADS At-Risk Population").click();
      await page.getByText("Study Technically Adequate").click();

      // Select probably benign
      await page.getByText("Probably benign").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=LR-2")).toBeVisible();
      await expect(page.locator("text=Probably Benign")).toBeVisible();
      await expect(page.locator("text=~14%")).toBeVisible();
    });
  });

  test.describe("LR-M - Malignant, Not HCC-Specific", () => {
    test("should classify as LR-M with targetoid features", async ({
      page,
    }) => {
      await page.getByText("Patient in LI-RADS At-Risk Population").click();
      await page.getByText("Study Technically Adequate").click();

      // Select indeterminate for benign status
      await page.getByText("Indeterminate - Continue evaluation").click();

      // Enable LR-M features
      await page.getByText("LR-M Features Present").click();

      // Select targetoid features
      await page.getByText("Rim arterial phase hyperenhancement").click();
      await page.getByText("Peripheral washout").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=LR-M")).toBeVisible();
      await expect(page.locator("text=Not HCC-Specific")).toBeVisible();
      await expect(page.locator("text=93-100%")).toBeVisible();
      await expect(page.locator("text=Biopsy recommended")).toBeVisible();
    });

    test("should classify as LR-M with rim APHE", async ({ page }) => {
      await page.getByText("Patient in LI-RADS At-Risk Population").click();
      await page.getByText("Study Technically Adequate").click();
      await page.getByText("Indeterminate - Continue evaluation").click();

      // Fill in size
      await page.fill('input[id="observation_size"]', "25");

      // Select rim APHE (directly triggers LR-M)
      await page.getByText("Rim APHE").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=LR-M")).toBeVisible();
      await expect(
        page.locator("text=intrahepatic cholangiocarcinoma"),
      ).toBeVisible();
    });
  });

  test.describe("LR-3 - Intermediate Probability", () => {
    test("should classify as LR-3 for observation without APHE, <20mm, 0 additional features", async ({
      page,
    }) => {
      await page.getByText("Patient in LI-RADS At-Risk Population").click();
      await page.getByText("Study Technically Adequate").click();
      await page.getByText("Indeterminate - Continue evaluation").click();

      // Size <20mm, no APHE
      await page.fill('input[id="observation_size"]', "15");
      await page.getByText("No APHE").click();
      await page.getByText("Absent", { exact: true }).first().click(); // Washout absent
      await page.getByText("Absent", { exact: true }).nth(1).click(); // Capsule absent
      await page.getByText("Absent", { exact: true }).nth(2).click(); // Threshold growth absent

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=LR-3")).toBeVisible();
      await expect(page.locator("text=Intermediate Probability")).toBeVisible();
      await expect(page.locator("text=38-40%")).toBeVisible();
      await expect(
        page.locator("text=Repeat imaging in 3-6 months"),
      ).toBeVisible();
    });

    test("should classify as LR-3 for observation with APHE, <10mm, 0 additional features", async ({
      page,
    }) => {
      await page.getByText("Patient in LI-RADS At-Risk Population").click();
      await page.getByText("Study Technically Adequate").click();
      await page.getByText("Indeterminate - Continue evaluation").click();

      // Size <10mm with APHE
      await page.fill('input[id="observation_size"]', "8");
      await page.getByText("Nonrim APHE").click();
      await page.getByText("Absent", { exact: true }).first().click(); // Washout absent
      await page.getByText("Absent", { exact: true }).nth(1).click(); // Capsule absent
      await page.getByText("Absent", { exact: true }).nth(2).click(); // Threshold growth absent

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=LR-3")).toBeVisible();
    });
  });

  test.describe("LR-4 - Probably HCC", () => {
    test("should classify as LR-4 for observation with APHE, <10mm, 1 additional feature", async ({
      page,
    }) => {
      await page.getByText("Patient in LI-RADS At-Risk Population").click();
      await page.getByText("Study Technically Adequate").click();
      await page.getByText("Indeterminate - Continue evaluation").click();

      // Size <10mm with APHE + washout
      await page.fill('input[id="observation_size"]', "8");
      await page.getByText("Nonrim APHE").click();
      await page.getByText("Present", { exact: true }).first().click(); // Washout present
      await page.getByText("Absent", { exact: true }).first().click(); // Capsule absent
      await page.getByText("Absent", { exact: true }).nth(1).click(); // Threshold growth absent

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=LR-4")).toBeVisible();
      await expect(page.locator("text=Probably HCC")).toBeVisible();
      await expect(page.locator("text=67-74%")).toBeVisible();
    });

    test("should classify as LR-4 for observation with APHE, >=20mm, 0 additional features", async ({
      page,
    }) => {
      await page.getByText("Patient in LI-RADS At-Risk Population").click();
      await page.getByText("Study Technically Adequate").click();
      await page.getByText("Indeterminate - Continue evaluation").click();

      // Size >=20mm with APHE only
      await page.fill('input[id="observation_size"]', "25");
      await page.getByText("Nonrim APHE").click();
      await page.getByText("Absent", { exact: true }).first().click();
      await page.getByText("Absent", { exact: true }).nth(1).click();
      await page.getByText("Absent", { exact: true }).nth(2).click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=LR-4")).toBeVisible();
    });

    test("should classify as LR-4 for 10-19mm with APHE + capsule only", async ({
      page,
    }) => {
      await page.getByText("Patient in LI-RADS At-Risk Population").click();
      await page.getByText("Study Technically Adequate").click();
      await page.getByText("Indeterminate - Continue evaluation").click();

      // Size 10-19mm with APHE + capsule (no washout or threshold growth)
      await page.fill('input[id="observation_size"]', "15");
      await page.getByText("Nonrim APHE").click();
      await page.getByText("Absent", { exact: true }).first().click(); // Washout absent
      await page.getByText("Present", { exact: true }).first().click(); // Capsule present
      await page.getByText("Absent", { exact: true }).first().click(); // Threshold growth absent

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=LR-4")).toBeVisible();
      await expect(
        page.locator(
          "text=capsule alone (without washout or threshold growth) yields LR-4",
        ),
      ).toBeVisible();
    });
  });

  test.describe("LR-5 - Definitely HCC", () => {
    test("should classify as LR-5 for observation with APHE, >=20mm, 1+ additional features", async ({
      page,
    }) => {
      await page.getByText("Patient in LI-RADS At-Risk Population").click();
      await page.getByText("Study Technically Adequate").click();
      await page.getByText("Indeterminate - Continue evaluation").click();

      // Size >=20mm with APHE + washout
      await page.fill('input[id="observation_size"]', "25");
      await page.getByText("Nonrim APHE").click();
      await page.getByText("Present", { exact: true }).first().click(); // Washout present
      await page.getByText("Absent", { exact: true }).first().click(); // Capsule absent
      await page.getByText("Absent", { exact: true }).nth(1).click(); // Threshold growth absent

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=LR-5")).toBeVisible();
      await expect(page.locator("text=Definitely HCC")).toBeVisible();
      await expect(page.locator("text=92-95%")).toBeVisible();
      await expect(
        page.locator("text=Treat as HCC without biopsy"),
      ).toBeVisible();
    });

    test("should classify as LR-5 for 10-19mm with APHE + washout", async ({
      page,
    }) => {
      await page.getByText("Patient in LI-RADS At-Risk Population").click();
      await page.getByText("Study Technically Adequate").click();
      await page.getByText("Indeterminate - Continue evaluation").click();

      // Size 10-19mm with APHE + washout
      await page.fill('input[id="observation_size"]', "15");
      await page.getByText("Nonrim APHE").click();
      await page.getByText("Present", { exact: true }).first().click(); // Washout present
      await page.getByText("Absent", { exact: true }).first().click(); // Capsule absent
      await page.getByText("Absent", { exact: true }).nth(1).click(); // Threshold growth absent

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=LR-5")).toBeVisible();
    });

    test("should classify as LR-5 for 10-19mm with APHE + threshold growth", async ({
      page,
    }) => {
      await page.getByText("Patient in LI-RADS At-Risk Population").click();
      await page.getByText("Study Technically Adequate").click();
      await page.getByText("Indeterminate - Continue evaluation").click();

      // Size 10-19mm with APHE + threshold growth
      await page.fill('input[id="observation_size"]', "15");
      await page.getByText("Nonrim APHE").click();
      await page.getByText("Absent", { exact: true }).first().click(); // Washout absent
      await page.getByText("Absent", { exact: true }).nth(1).click(); // Capsule absent
      await page.getByText("Present", { exact: true }).first().click(); // Threshold growth present

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=LR-5")).toBeVisible();
      await expect(page.locator("text=Threshold growth")).toBeVisible();
    });
  });

  test.describe("Ancillary Feature Adjustments", () => {
    test("should upgrade LR-3 to LR-4 with ancillary features favoring malignancy", async ({
      page,
    }) => {
      await page.getByText("Patient in LI-RADS At-Risk Population").click();
      await page.getByText("Study Technically Adequate").click();
      await page.getByText("Indeterminate - Continue evaluation").click();

      // Set up LR-3 scenario
      await page.fill('input[id="observation_size"]', "15");
      await page.getByText("No APHE").click();
      await page.getByText("Absent", { exact: true }).first().click();
      await page.getByText("Absent", { exact: true }).nth(1).click();
      await page.getByText("Absent", { exact: true }).nth(2).click();

      // Add ancillary feature favoring malignancy
      await page
        .locator('select[id="ancillary_malignancy"]')
        .selectOption("restricted_diffusion");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=LR-4")).toBeVisible();
      await expect(
        page.locator("text=Upgraded from LR-3 to LR-4"),
      ).toBeVisible();
    });

    test("should downgrade LR-5 to LR-4 with ancillary features favoring benignity", async ({
      page,
    }) => {
      await page.getByText("Patient in LI-RADS At-Risk Population").click();
      await page.getByText("Study Technically Adequate").click();
      await page.getByText("Indeterminate - Continue evaluation").click();

      // Set up LR-5 scenario
      await page.fill('input[id="observation_size"]', "25");
      await page.getByText("Nonrim APHE").click();
      await page.getByText("Present", { exact: true }).first().click(); // Washout present
      await page.getByText("Absent", { exact: true }).first().click();
      await page.getByText("Absent", { exact: true }).nth(1).click();

      // Add ancillary feature favoring benignity
      await page
        .locator('select[id="ancillary_benign"]')
        .selectOption("size_stability");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=LR-4")).toBeVisible();
      await expect(
        page.locator("text=Downgraded from LR-5 to LR-4"),
      ).toBeVisible();
    });

    test("should not adjust category when conflicting ancillary features present", async ({
      page,
    }) => {
      await page.getByText("Patient in LI-RADS At-Risk Population").click();
      await page.getByText("Study Technically Adequate").click();
      await page.getByText("Indeterminate - Continue evaluation").click();

      // Set up LR-3 scenario
      await page.fill('input[id="observation_size"]', "15");
      await page.getByText("No APHE").click();
      await page.getByText("Absent", { exact: true }).first().click();
      await page.getByText("Absent", { exact: true }).nth(1).click();
      await page.getByText("Absent", { exact: true }).nth(2).click();

      // Add conflicting ancillary features
      await page
        .locator('select[id="ancillary_malignancy"]')
        .selectOption("restricted_diffusion");
      await page
        .locator('select[id="ancillary_benign"]')
        .selectOption("size_stability");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=LR-3")).toBeVisible();
      await expect(
        page.locator("text=Conflicting ancillary features"),
      ).toBeVisible();
    });
  });

  test.describe("Edge Cases and Validation", () => {
    test("should show error when not in at-risk population", async ({
      page,
    }) => {
      // Don't enable at-risk population
      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=LI-RADS not applicable")).toBeVisible();
      await expect(
        page.locator("text=Patient must be in at-risk population"),
      ).toBeVisible();
    });

    test("should show error when size and APHE not provided for diagnostic table", async ({
      page,
    }) => {
      await page.getByText("Patient in LI-RADS At-Risk Population").click();
      await page.getByText("Study Technically Adequate").click();
      await page.getByText("Indeterminate - Continue evaluation").click();

      // Don't fill in size or APHE
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "text=Please complete observation size and APHE assessment",
        ),
      ).toBeVisible();
    });

    test("should note that <10mm cannot be LR-5", async ({ page }) => {
      await page.getByText("Patient in LI-RADS At-Risk Population").click();
      await page.getByText("Study Technically Adequate").click();
      await page.getByText("Indeterminate - Continue evaluation").click();

      // Size <10mm with multiple features (would be LR-5 if larger)
      await page.fill('input[id="observation_size"]', "8");
      await page.getByText("Nonrim APHE").click();
      await page.getByText("Present", { exact: true }).first().click(); // Washout
      await page.getByText("Present", { exact: true }).nth(1).click(); // Capsule
      await page.getByText("Present", { exact: true }).nth(2).click(); // Threshold growth

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=LR-4")).toBeVisible();
      await expect(
        page.locator("text=<10mm cannot be categorized as LR-5"),
      ).toBeVisible();
    });

    test("should show threshold growth definition", async ({ page }) => {
      await page.getByText("Patient in LI-RADS At-Risk Population").click();
      await page.getByText("Study Technically Adequate").click();
      await page.getByText("Indeterminate - Continue evaluation").click();

      await page.fill('input[id="observation_size"]', "20");
      await page.getByText("Nonrim APHE").click();
      await page.getByText("Absent", { exact: true }).first().click();
      await page.getByText("Absent", { exact: true }).nth(1).click();
      await page.getByText("Present", { exact: true }).first().click(); // Threshold growth

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=50% size increase in")).toBeVisible();
    });
  });

  test.describe("Clinical Notes", () => {
    test("should show AASLD guidelines note for LR-5", async ({ page }) => {
      await page.getByText("Patient in LI-RADS At-Risk Population").click();
      await page.getByText("Study Technically Adequate").click();
      await page.getByText("Indeterminate - Continue evaluation").click();

      await page.fill('input[id="observation_size"]', "25");
      await page.getByText("Nonrim APHE").click();
      await page.getByText("Present", { exact: true }).first().click();
      await page.getByText("Absent", { exact: true }).first().click();
      await page.getByText("Absent", { exact: true }).nth(1).click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=treatment without biopsy per AASLD"),
      ).toBeVisible();
      await expect(page.locator("text=OPTN criteria")).toBeVisible();
    });
  });

  test.describe("References", () => {
    test("should display LI-RADS references", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: "References" }),
      ).toBeVisible();
      await expect(page.getByText("Chernyak V").first()).toBeVisible();
    });

    test("should have correct number of reference links", async ({ page }) => {
      const refLinks = page.locator('a[href^="https://doi.org"]');
      const count = await refLinks.count();
      expect(count).toBeGreaterThanOrEqual(8);
    });

    test("should have link to ACR LI-RADS official resources", async ({
      page,
    }) => {
      const acrLink = page.locator('a[href*="acr.org"]');
      await expect(acrLink.first()).toBeVisible();
    });
  });

  test.describe("Responsiveness and Theme", () => {
    test("should maintain theme consistency", async ({ page }) => {
      await verifyThemeConsistency(page);
    });

    test("should be responsive on mobile devices", async ({ page }) => {
      await verifyMobileResponsive(page);

      // Verify calculator is still usable on mobile
      await expect(page.locator("h2")).toContainText("LI-RADS");
      await expect(page.locator('button:has-text("Calculate")')).toBeVisible();
    });
  });
});
