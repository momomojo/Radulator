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
 *   (targetoid mass -> LR-M; nontargetoid LR-M feature -> LR-M only when LR-5
 *   criteria are not met; no dead end or stale hidden values)
 * - LR-TIV: Tumor in vein
 * - LR-NC: Not categorizable (inadequate study)
 * - Ancillary feature adjustments
 * - Diagnostic table algorithm
 * - Reference verification
 */

import { test, expect } from "@playwright/test";
import {
  navigateToCalculator,
  verifyThemeConsistency,
  verifyMobileResponsive,
} from "../../../helpers/calculator-test-helper.js";

const CALCULATOR_NAME = "LI-RADS v2018";

test.describe("LI-RADS v2018 Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, CALCULATOR_NAME);

    // Verify calculator loaded
    await expect(page.getByTestId('calculator-title').first()).toContainText("LI-RADS v2018");
  });

  test.describe("Visual and UI Tests", () => {
    test("should display calculator with correct title and description", async ({
      page,
    }) => {
      await expect(page.getByTestId('calculator-title').first()).toContainText("LI-RADS v2018");
      await expect(
        page.getByTestId('calculator-info-text'),
      ).toContainText("Liver Imaging Reporting and Data System");
    });

    test("should display info section with LI-RADS explanation", async ({
      page,
    }) => {
      await expect(page.getByTestId('calculator-info-text')).toContainText("hepatocellular carcinoma");
      await expect(page.getByTestId('calculator-info-text')).toContainText("LR-1");
      await expect(page.getByTestId('calculator-info-text')).toContainText("LR-5");
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
      const results = page.getByRole('status', { name: 'Calculator results' });

      // Enable at-risk population
      await page.locator('label[for="high_risk_population"]').click();

      // Leave study_adequate unchecked (not adequate)
      await page.click('button:has-text("Calculate")');

      await expect(results.locator("text=LR-NC")).toBeVisible();
      await expect(results.locator("text=Not Categorizable")).toBeVisible();
      await expect(results.locator("text=Repeat imaging")).toBeVisible();
    });
  });

  test.describe("LR-TIV - Tumor in Vein", () => {
    test("should classify as LR-TIV when definite tumor in vein", async ({
      page,
    }) => {
      const results = page.getByRole('status', { name: 'Calculator results' });

      // Enable at-risk population and adequate study
      await page.locator('label[for="high_risk_population"]').click();
      await page.locator('label[for="study_adequate"]').click();

      // Select tumor in vein
      await page.locator('label[for="tumor_in_vein"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(results.getByText("LR-TIV (Tumor in Vein)", { exact: true })).toBeVisible();
      // The definition is the Core's any-vein criterion (printed p. 21), not only portal or hepatic veins.
      await expect(
        results.getByText(/^Definite tumor in vein: unequivocal enhancing soft tissue in a vein, with or without a visible parenchymal mass$/),
      ).toBeVisible();
      await expect(results.getByText(/portal or hepatic veins/)).toHaveCount(0);
      await expect(
        results.locator("text=Contraindication to liver transplantation"),
      ).toBeVisible();
    });
  });

  test.describe("LR-1 - Definitely Benign", () => {
    test("should classify as LR-1 for definitely benign observation", async ({
      page,
    }) => {
      const results = page.getByRole('status', { name: 'Calculator results' });

      await page.locator('label[for="high_risk_population"]').click();
      await page.locator('label[for="study_adequate"]').click();

      // Select definitely benign
      await page.locator('label[for="benign_status-definitely_benign"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(results.locator("text=LR-1")).toBeVisible();
      await expect(results.locator("text=Definitely Benign")).toBeVisible();
      await expect(results.locator("text=0%").first()).toBeVisible();
      await expect(
        results.locator("text=Return to routine surveillance"),
      ).toBeVisible();
    });
  });

  test.describe("LR-2 - Probably Benign", () => {
    test("should classify as LR-2 for probably benign observation", async ({
      page,
    }) => {
      const results = page.getByRole('status', { name: 'Calculator results' });

      await page.locator('label[for="high_risk_population"]').click();
      await page.locator('label[for="study_adequate"]').click();

      // Select probably benign
      await page.locator('label[for="benign_status-probably_benign"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(results.locator("text=LR-2")).toBeVisible();
      await expect(results.locator("text=Probably Benign")).toBeVisible();
      await expect(results.locator("text=~14%")).toBeVisible();
    });
  });

  test.describe("LR-M - Malignant, Not HCC-Specific", () => {
    test("should classify as LR-M with targetoid features", async ({
      page,
    }) => {
      const results = page.getByRole('status', { name: 'Calculator results' });

      await page.locator('label[for="high_risk_population"]').click();
      await page.locator('label[for="study_adequate"]').click();

      // Select indeterminate for benign status
      await page.locator('label[for="benign_status-indeterminate"]').click();

      // Enable LR-M features
      await page.locator('label[for="has_lrm_features"]').click();

      // Major features stay on screen until a targetoid feature is selected
      await expect(page.locator('input[id="observation_size"]')).toBeVisible();

      // Select targetoid features
      await page.locator('label[for="lrm_rim_aphe"]').click();
      await page.locator('label[for="lrm_peripheral_washout"]').click();

      // A targetoid mass is LR-M whatever its major features, so they are hidden
      await expect(page.locator('input[id="observation_size"]')).toHaveCount(0);

      await page.click('button:has-text("Calculate")');

      await expect(results.locator("text=LR-M").first()).toBeVisible();
      await expect(results.locator("text=Not HCC-Specific")).toBeVisible();
      await expect(results.locator("text=93-100%")).toBeVisible();
      await expect(results.getByText("Multidisciplinary discussion for tailored workup, which often includes biopsy", { exact: true })).toBeVisible();
      await expect(results.getByText("Targetoid mass", { exact: true })).toBeVisible();
    });

    test("should keep LR-5 when a nontargetoid LR-M feature is present but LR-5 criteria are met", async ({
      page,
    }) => {
      const results = page.getByRole('status', { name: 'Calculator results' });

      await page.locator('label[for="high_risk_population"]').click();
      await page.locator('label[for="study_adequate"]').click();
      await page.locator('label[for="benign_status-indeterminate"]').click();
      await page.locator('label[for="has_lrm_features"]').click();
      await page.locator('label[for="lrm_necrosis"]').click();

      // Nontargetoid features need the major features to check LR-5 criteria
      await expect(page.locator('input[id="observation_size"]')).toBeVisible();

      // >=20 mm, nonrim APHE + washout meets LR-5 criteria
      await page.fill('input[id="observation_size"]', "25");
      await page.locator('label[for="aphe-nonrim"]').click();
      await page.locator('label[for="washout-present"]').click();
      await page.locator('label[for="capsule-absent"]').click();
      await page.locator('label[for="threshold_growth-absent"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(results.locator("text=LR-5").first()).toBeVisible();
      await expect(results.locator("text=Definitely HCC")).toBeVisible();
      await expect(
        results.locator("text=LR-M not assigned: LR-5 criteria met"),
      ).toBeVisible();
      await expect(
        results.locator("text=lower certainty of hepatocellular origin"),
      ).toBeVisible();
      await expect(results.locator("text=Not HCC-Specific")).toHaveCount(0);
    });

    test("should assign LR-M for a nontargetoid LR-M feature when LR-5 criteria are not met", async ({
      page,
    }) => {
      const results = page.getByRole('status', { name: 'Calculator results' });

      await page.locator('label[for="high_risk_population"]').click();
      await page.locator('label[for="study_adequate"]').click();
      await page.locator('label[for="benign_status-indeterminate"]').click();
      await page.locator('label[for="has_lrm_features"]').click();
      await page.locator('label[for="lrm_infiltrative"]').click();

      // >=20 mm, nonrim APHE, no additional major feature: diagnostic table LR-4
      await page.fill('input[id="observation_size"]', "25");
      await page.locator('label[for="aphe-nonrim"]').click();
      await page.locator('label[for="washout-absent"]').click();
      await page.locator('label[for="capsule-absent"]').click();
      await page.locator('label[for="threshold_growth-absent"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(results.locator("text=LR-M").first()).toBeVisible();
      await expect(results.locator("text=Not HCC-Specific")).toBeVisible();
      await expect(
        results.locator(
          "text=LR-5 criteria not met (diagnostic table: LR-4)",
        ),
      ).toBeVisible();
    });

    test("should ask for a feature when LR-M Features Present has none selected", async ({
      page,
    }) => {
      const results = page.getByRole('status', { name: 'Calculator results' });

      await page.locator('label[for="high_risk_population"]').click();
      await page.locator('label[for="study_adequate"]').click();
      await page.locator('label[for="benign_status-indeterminate"]').click();
      await page.locator('label[for="has_lrm_features"]').click();

      // The major features are not hidden by the checkbox alone
      await expect(page.locator('input[id="observation_size"]')).toBeVisible();

      await page.click('button:has-text("Calculate")');

      await expect(
        results.getByText(/is checked but no LR-M feature is selected/),
      ).toBeVisible();
      await expect(results.locator("text=LI-RADS Category")).toHaveCount(0);
    });

    test("should ignore LR-M features hidden by unchecking LR-M Features Present", async ({
      page,
    }) => {
      const results = page.getByRole('status', { name: 'Calculator results' });

      await page.locator('label[for="high_risk_population"]').click();
      await page.locator('label[for="study_adequate"]').click();
      await page.locator('label[for="benign_status-indeterminate"]').click();

      // Diagnostic table LR-4 (>=20 mm, nonrim APHE, no additional feature)
      await page.fill('input[id="observation_size"]', "25");
      await page.locator('label[for="aphe-nonrim"]').click();
      await page.locator('label[for="washout-absent"]').click();
      await page.locator('label[for="capsule-absent"]').click();
      await page.locator('label[for="threshold_growth-absent"]').click();

      await page.locator('label[for="has_lrm_features"]').click();
      await page.locator('label[for="lrm_marked_restriction"]').click();
      await page.click('button:has-text("Calculate")');
      await expect(results.locator("text=LR-M").first()).toBeVisible();

      // Unchecking the box hides the feature list; its stale value must not count
      await page.locator('label[for="has_lrm_features"]').click();
      await expect(page.locator('[id="lrm_marked_restriction"]')).toHaveCount(0);
      await page.click('button:has-text("Calculate")');

      await expect(results.locator("text=LR-4").first()).toBeVisible();
      await expect(results.locator("text=Probably HCC")).toBeVisible();
      await expect(results.locator("text=Not HCC-Specific")).toHaveCount(0);
    });

    test("should classify as LR-M with rim APHE", async ({ page }) => {
      const results = page.getByRole('status', { name: 'Calculator results' });

      await page.locator('label[for="high_risk_population"]').click();
      await page.locator('label[for="study_adequate"]').click();
      await page.locator('label[for="benign_status-indeterminate"]').click();

      // Fill in size
      await page.fill('input[id="observation_size"]', "25");

      // Select rim APHE (directly triggers LR-M)
      await page.locator('label[for="aphe-rim"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(results.locator("text=LR-M").first()).toBeVisible();
      await expect(
        results.locator("text=intrahepatic cholangiocarcinoma"),
      ).toBeVisible();
    });
  });

  test.describe("LR-3 - Intermediate Probability", () => {
    test("should classify as LR-3 for observation without APHE, <20mm, 0 additional features", async ({
      page,
    }) => {
      const results = page.getByRole('status', { name: 'Calculator results' });

      await page.locator('label[for="high_risk_population"]').click();
      await page.locator('label[for="study_adequate"]').click();
      await page.locator('label[for="benign_status-indeterminate"]').click();

      // Size <20mm, no APHE
      await page.fill('input[id="observation_size"]', "15");
      await page.locator('label[for="aphe-none"]').click();
      await page.locator('label[for="washout-absent"]').click();
      await page.locator('label[for="capsule-absent"]').click();
      await page.locator('label[for="threshold_growth-absent"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(results.locator("text=LR-3")).toBeVisible();
      await expect(results.locator("text=Intermediate Probability")).toBeVisible();
      await expect(results.locator("text=38-40%")).toBeVisible();
      await expect(
        results.locator("text=Repeat imaging in 3-6 months"),
      ).toBeVisible();
    });

    test("should classify as LR-3 for observation with APHE, <10mm, 0 additional features", async ({
      page,
    }) => {
      const results = page.getByRole('status', { name: 'Calculator results' });

      await page.locator('label[for="high_risk_population"]').click();
      await page.locator('label[for="study_adequate"]').click();
      await page.locator('label[for="benign_status-indeterminate"]').click();

      // Size <10mm with APHE
      await page.fill('input[id="observation_size"]', "8");
      await page.locator('label[for="aphe-nonrim"]').click();
      await page.locator('label[for="washout-absent"]').click();
      await page.locator('label[for="capsule-absent"]').click();
      await page.locator('label[for="threshold_growth-absent"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(results.locator("text=LR-3")).toBeVisible();
    });
  });

  test.describe("LR-4 - Probably HCC", () => {
    test("should classify as LR-4 for observation with APHE, <10mm, 1 additional feature", async ({
      page,
    }) => {
      const results = page.getByRole('status', { name: 'Calculator results' });

      await page.locator('label[for="high_risk_population"]').click();
      await page.locator('label[for="study_adequate"]').click();
      await page.locator('label[for="benign_status-indeterminate"]').click();

      // Size <10mm with APHE + washout
      await page.fill('input[id="observation_size"]', "8");
      await page.locator('label[for="aphe-nonrim"]').click();
      await page.locator('label[for="washout-present"]').click();
      await page.locator('label[for="capsule-absent"]').click();
      await page.locator('label[for="threshold_growth-absent"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(results.locator("text=LR-4").first()).toBeVisible();
      await expect(results.locator("text=Probably HCC")).toBeVisible();
      await expect(results.locator("text=67-74%")).toBeVisible();
    });

    test("should classify as LR-4 for observation with APHE, >=20mm, 0 additional features", async ({
      page,
    }) => {
      const results = page.getByRole('status', { name: 'Calculator results' });

      await page.locator('label[for="high_risk_population"]').click();
      await page.locator('label[for="study_adequate"]').click();
      await page.locator('label[for="benign_status-indeterminate"]').click();

      // Size >=20mm with APHE only
      await page.fill('input[id="observation_size"]', "25");
      await page.locator('label[for="aphe-nonrim"]').click();
      await page.locator('label[for="washout-absent"]').click();
      await page.locator('label[for="capsule-absent"]').click();
      await page.locator('label[for="threshold_growth-absent"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(results.locator("text=LR-4").first()).toBeVisible();
    });

    test("should classify as LR-4 for 10-19mm with APHE + capsule only", async ({
      page,
    }) => {
      const results = page.getByRole('status', { name: 'Calculator results' });

      await page.locator('label[for="high_risk_population"]').click();
      await page.locator('label[for="study_adequate"]').click();
      await page.locator('label[for="benign_status-indeterminate"]').click();

      // Size 10-19mm with APHE + capsule (no washout or threshold growth)
      await page.fill('input[id="observation_size"]', "15");
      await page.locator('label[for="aphe-nonrim"]').click();
      await page.locator('label[for="washout-absent"]').click();
      await page.locator('label[for="capsule-present"]').click();
      await page.locator('label[for="threshold_growth-absent"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(results.locator("text=LR-4").first()).toBeVisible();
      await expect(
        results.locator(
          "text=capsule alone (without washout or threshold growth) yields LR-4",
        ),
      ).toBeVisible();
    });
  });

  test.describe("LR-5 - Definitely HCC", () => {
    test("should classify as LR-5 for observation with APHE, >=20mm, 1+ additional features", async ({
      page,
    }) => {
      const results = page.getByRole('status', { name: 'Calculator results' });

      await page.locator('label[for="high_risk_population"]').click();
      await page.locator('label[for="study_adequate"]').click();
      await page.locator('label[for="benign_status-indeterminate"]').click();

      // Size >=20mm with APHE + washout
      await page.fill('input[id="observation_size"]', "25");
      await page.locator('label[for="aphe-nonrim"]').click();
      await page.locator('label[for="washout-present"]').click();
      await page.locator('label[for="capsule-absent"]').click();
      await page.locator('label[for="threshold_growth-absent"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(results.locator("text=LR-5").first()).toBeVisible();
      await expect(results.locator("text=Definitely HCC")).toBeVisible();
      await expect(results.locator("text=92-95%")).toBeVisible();
      await expect(
        results.locator("text=Treat as HCC without biopsy"),
      ).toBeVisible();
    });

    test("should classify as LR-5 for 10-19mm with APHE + washout", async ({
      page,
    }) => {
      const results = page.getByRole('status', { name: 'Calculator results' });

      await page.locator('label[for="high_risk_population"]').click();
      await page.locator('label[for="study_adequate"]').click();
      await page.locator('label[for="benign_status-indeterminate"]').click();

      // Size 10-19mm with APHE + washout
      await page.fill('input[id="observation_size"]', "15");
      await page.locator('label[for="aphe-nonrim"]').click();
      await page.locator('label[for="washout-present"]').click();
      await page.locator('label[for="capsule-absent"]').click();
      await page.locator('label[for="threshold_growth-absent"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(results.locator("text=LR-5").first()).toBeVisible();
    });

    test("should classify as LR-5 for 10-19mm with APHE + threshold growth", async ({
      page,
    }) => {
      const results = page.getByRole('status', { name: 'Calculator results' });

      await page.locator('label[for="high_risk_population"]').click();
      await page.locator('label[for="study_adequate"]').click();
      await page.locator('label[for="benign_status-indeterminate"]').click();

      // Size 10-19mm with APHE + threshold growth
      await page.fill('input[id="observation_size"]', "15");
      await page.locator('label[for="aphe-nonrim"]').click();
      await page.locator('label[for="washout-absent"]').click();
      await page.locator('label[for="capsule-absent"]').click();
      await page.locator('label[for="threshold_growth-present"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(results.locator("text=LR-5").first()).toBeVisible();
      await expect(results.locator("text=Threshold growth").first()).toBeVisible();
    });
  });

  test.describe("Ancillary Feature Adjustments", () => {
    test("should upgrade LR-3 to LR-4 with ancillary features favoring malignancy", async ({
      page,
    }) => {
      const results = page.getByRole('status', { name: 'Calculator results' });

      await page.locator('label[for="high_risk_population"]').click();
      await page.locator('label[for="study_adequate"]').click();
      await page.locator('label[for="benign_status-indeterminate"]').click();

      // Set up LR-3 scenario
      await page.fill('input[id="observation_size"]', "15");
      await page.locator('label[for="aphe-none"]').click();
      await page.locator('label[for="washout-absent"]').click();
      await page.locator('label[for="capsule-absent"]').click();
      await page.locator('label[for="threshold_growth-absent"]').click();

      // Add ancillary feature favoring malignancy
      await page
        .locator('select[id="ancillary_malignancy"]')
        .selectOption("restricted_diffusion");

      await page.click('button:has-text("Calculate")');

      await expect(results.locator("text=LR-4").first()).toBeVisible();
      await expect(
        results.locator("text=Upgraded from LR-3 to LR-4"),
      ).toBeVisible();
    });

    test("should downgrade LR-5 to LR-4 with ancillary features favoring benignity", async ({
      page,
    }) => {
      const results = page.getByRole('status', { name: 'Calculator results' });

      await page.locator('label[for="high_risk_population"]').click();
      await page.locator('label[for="study_adequate"]').click();
      await page.locator('label[for="benign_status-indeterminate"]').click();

      // Set up LR-5 scenario
      await page.fill('input[id="observation_size"]', "25");
      await page.locator('label[for="aphe-nonrim"]').click();
      await page.locator('label[for="washout-present"]').click();
      await page.locator('label[for="capsule-absent"]').click();
      await page.locator('label[for="threshold_growth-absent"]').click();

      // Add ancillary feature favoring benignity
      await page
        .locator('select[id="ancillary_benign"]')
        .selectOption("size_stability");

      await page.click('button:has-text("Calculate")');

      await expect(results.locator("text=LR-4").first()).toBeVisible();
      await expect(
        results.locator("text=Downgraded from LR-5 to LR-4"),
      ).toBeVisible();
    });

    test("should downgrade LR-3 to LR-2 when an ancillary feature favors benignity", async ({
      page,
    }) => {
      const results = page.getByRole('status', { name: 'Calculator results' });

      await page.locator('label[for="high_risk_population"]').click();
      await page.locator('label[for="study_adequate"]').click();
      await page.locator('label[for="benign_status-indeterminate"]').click();

      // LR-3 from the diagnostic table (<20 mm, no APHE, no additional feature)
      await page.fill('input[id="observation_size"]', "15");
      await page.locator('label[for="aphe-none"]').click();
      await page.locator('label[for="washout-absent"]').click();
      await page.locator('label[for="capsule-absent"]').click();
      await page.locator('label[for="threshold_growth-absent"]').click();

      await page
        .locator('select[id="ancillary_benign"]')
        .selectOption("size_stability");

      await page.click('button:has-text("Calculate")');

      // One category down, not to LR-1
      await expect(results.locator("text=LR-2").first()).toBeVisible();
      await expect(results.locator("text=Probably Benign")).toBeVisible();
      await expect(
        results.locator("text=Downgraded from LR-3 to LR-2"),
      ).toBeVisible();
      await expect(results.locator("text=LR-1")).toHaveCount(0);
    });

    test("should not adjust category when conflicting ancillary features present", async ({
      page,
    }) => {
      const results = page.getByRole('status', { name: 'Calculator results' });

      await page.locator('label[for="high_risk_population"]').click();
      await page.locator('label[for="study_adequate"]').click();
      await page.locator('label[for="benign_status-indeterminate"]').click();

      // Set up LR-3 scenario
      await page.fill('input[id="observation_size"]', "15");
      await page.locator('label[for="aphe-none"]').click();
      await page.locator('label[for="washout-absent"]').click();
      await page.locator('label[for="capsule-absent"]').click();
      await page.locator('label[for="threshold_growth-absent"]').click();

      // Add conflicting ancillary features
      await page
        .locator('select[id="ancillary_malignancy"]')
        .selectOption("restricted_diffusion");
      await page
        .locator('select[id="ancillary_benign"]')
        .selectOption("size_stability");

      await page.click('button:has-text("Calculate")');

      // Conflicting ancillary features cancel out: category stays LR-3 and the
      // app applies no adjustment (the "Ancillary Adjustment" row is only shown
      // when the category actually changes), so no adjustment text is rendered.
      await expect(results.locator("text=LR-3").first()).toBeVisible();
      await expect(
        results.locator("text=Upgraded from LR-3"),
      ).toHaveCount(0);
      await expect(
        results.locator("text=Downgraded"),
      ).toHaveCount(0);
    });
  });

  test.describe("Edge Cases and Validation", () => {
    test("should show error when not in at-risk population", async ({
      page,
    }) => {
      const results = page.getByRole('status', { name: 'Calculator results' });

      // Don't enable at-risk population
      await page.click('button:has-text("Calculate")');

      await expect(results.locator("text=LI-RADS not applicable")).toBeVisible();
      await expect(
        results.locator("text=Patient must be in at-risk population"),
      ).toBeVisible();
    });

    test("should show error when size and APHE not provided for diagnostic table", async ({
      page,
    }) => {
      const results = page.getByRole('status', { name: 'Calculator results' });

      await page.locator('label[for="high_risk_population"]').click();
      await page.locator('label[for="study_adequate"]').click();
      await page.locator('label[for="benign_status-indeterminate"]').click();

      // Don't fill in size or APHE
      await page.click('button:has-text("Calculate")');

      await expect(
        results.locator(
          "text=Please complete observation size and APHE assessment",
        ),
      ).toBeVisible();
    });

    test("should note that <10mm cannot be LR-5", async ({ page }) => {
      const results = page.getByRole('status', { name: 'Calculator results' });

      await page.locator('label[for="high_risk_population"]').click();
      await page.locator('label[for="study_adequate"]').click();
      await page.locator('label[for="benign_status-indeterminate"]').click();

      // Size <10mm with multiple features (would be LR-5 if larger)
      await page.fill('input[id="observation_size"]', "8");
      await page.locator('label[for="aphe-nonrim"]').click();
      await page.locator('label[for="washout-present"]').click();
      await page.locator('label[for="capsule-present"]').click();
      await page.locator('label[for="threshold_growth-present"]').click();

      await page.click('button:has-text("Calculate")');

      // .first(): the v2018 threshold-growth note also mentions LR-4
      await expect(results.locator("text=LR-4").first()).toBeVisible();
      await expect(
        results.locator("text=<10mm cannot be categorized as LR-5"),
      ).toBeVisible();
    });

    test("should show the v2018 threshold growth definition", async ({ page }) => {
      const results = page.getByRole('status', { name: 'Calculator results' });

      await page.locator('label[for="high_risk_population"]').click();
      await page.locator('label[for="study_adequate"]').click();
      await page.locator('label[for="benign_status-indeterminate"]').click();

      // The field itself says a new >=10 mm observation is subthreshold growth
      await expect(
        page.getByText(/is subthreshold growth \(ancillary feature\), not threshold growth/),
      ).toBeVisible();
      await expect(page.getByText(/or new observation ≥10mm/)).toHaveCount(0);

      await page.fill('input[id="observation_size"]', "20");
      await page.locator('label[for="aphe-nonrim"]').click();
      await page.locator('label[for="washout-absent"]').click();
      await page.locator('label[for="capsule-absent"]').click();
      await page.locator('label[for="threshold_growth-present"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(results.locator("text=grew ≥50% within ≤6 months")).toBeVisible();
      await expect(
        results.locator("text=is subthreshold growth instead"),
      ).toBeVisible();
      await expect(results.locator("text=new observation ≥10mm")).toHaveCount(0);
    });

    test("should keep a new 10-19 mm observation below LR-5 when entered as subthreshold growth", async ({
      page,
    }) => {
      const results = page.getByRole('status', { name: 'Calculator results' });

      await page.locator('label[for="high_risk_population"]').click();
      await page.locator('label[for="study_adequate"]').click();
      await page.locator('label[for="benign_status-indeterminate"]').click();

      // 15 mm with nonrim APHE only (washout, capsule, threshold growth absent): LR-3
      await page.fill('input[id="observation_size"]', "15");
      await page.locator('label[for="aphe-nonrim"]').click();
      await page.locator('label[for="washout-absent"]').click();
      await page.locator('label[for="capsule-absent"]').click();
      await page.locator('label[for="threshold_growth-absent"]').click();

      // New observation: subthreshold growth, an ancillary feature favoring malignancy
      await page
        .locator('select[id="ancillary_malignancy"]')
        .selectOption("subthreshold_growth");

      await page.click('button:has-text("Calculate")');

      await expect(results.locator("text=LR-4").first()).toBeVisible();
      await expect(results.locator("text=Upgraded from LR-3 to LR-4")).toBeVisible();
      await expect(results.locator("text=Definitely HCC")).toHaveCount(0);
    });
  });

  test.describe("Clinical Notes", () => {
    test("should show AASLD guidelines note for LR-5", async ({ page }) => {
      const results = page.getByRole('status', { name: 'Calculator results' });

      await page.locator('label[for="high_risk_population"]').click();
      await page.locator('label[for="study_adequate"]').click();
      await page.locator('label[for="benign_status-indeterminate"]').click();

      await page.fill('input[id="observation_size"]', "25");
      await page.locator('label[for="aphe-nonrim"]').click();
      await page.locator('label[for="washout-present"]').click();
      await page.locator('label[for="capsule-absent"]').click();
      await page.locator('label[for="threshold_growth-absent"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        results.locator("text=treatment without biopsy per AASLD"),
      ).toBeVisible();
      await expect(results.locator("text=OPTN criteria")).toBeVisible();
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
      // Expand collapsed references first
      const expand = page.getByRole('button', { name: /Show.*more/i });
      if (await expand.isVisible().catch(() => false)) await expand.click();

      const refLinks = page.locator('a[href^="https://doi.org"]');
      const count = await refLinks.count();
      expect(count).toBeGreaterThanOrEqual(8);
    });

    test("should have link to ACR LI-RADS official resources", async ({
      page,
    }) => {
      // Expand collapsed references first
      const expand = page.getByRole('button', { name: /Show.*more/i });
      if (await expand.isVisible().catch(() => false)) await expand.click();

      const acrLink = page.locator('a[href*="acr.org"]');
      await expect(acrLink.first()).toBeVisible();
      // The live ACR LI-RADS page (the former path returns HTTP 404)
      await expect(
        page.locator(
          'a[href="https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/LI-RADS"]',
        ),
      ).toBeVisible();
      await expect(
        page.locator('a[href="https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/LI-RADS"]'),
      ).toHaveCount(0);
    });
  });

  test.describe("Responsiveness and Theme", () => {
    test("should maintain theme consistency", async ({ page }) => {
      await verifyThemeConsistency(page);
    });

    test("should be responsive on mobile devices", async ({ page }) => {
      await verifyMobileResponsive(page);

      // Verify calculator is still usable on mobile
      await expect(page.getByTestId('calculator-title').first()).toContainText("LI-RADS");
      await expect(page.getByRole('button', { name: 'Calculate' })).toBeVisible();
    });
  });
});
