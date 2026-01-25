import { test, expect } from "@playwright/test";
import { navigateToCalculator } from "../../../helpers/calculator-test-helper.js";

/**
 * E2E Tests for CAD-RADS 2.0 Calculator
 * Coronary Artery Disease Reporting and Data System for coronary CTA
 *
 * CAD-RADS Categories:
 * - CAD-RADS 0: 0% (No stenosis, no plaque)
 * - CAD-RADS 1: 1-24% (Minimal stenosis)
 * - CAD-RADS 2: 25-49% (Mild stenosis)
 * - CAD-RADS 3: 50-69% (Moderate stenosis)
 * - CAD-RADS 4A: 70-99% (Severe stenosis)
 * - CAD-RADS 4B: Left main >=50% or 3-vessel >=70%
 * - CAD-RADS 5: Total occlusion (100%)
 * - CAD-RADS N: Non-diagnostic
 *
 * Modifiers:
 * - /P1-P4: Plaque burden
 * - /HRP: High-risk plaque features
 * - /I: Ischemia testing recommended
 * - /S: Stent present
 * - /G: Bypass graft present
 *
 * Field IDs:
 * - study_quality: radio (diagnostic, limited, non_diagnostic)
 * - max_stenosis: radio (0, 1-24, 25-49, 50-69, 70-99, 100)
 * - severe_location: radio (non_lm, lm_mild, lm_significant)
 * - three_vessel: radio (no, yes)
 * - plaque_burden: radio (none, P1, P2, P3, P4)
 * - hrp_features: radio (none, present)
 * - ischemia_testing: radio (no, yes)
 * - prior_intervention: radio (none, stent, cabg, both)
 * - stent_status: radio (patent, stenosis, occluded, non_eval)
 * - graft_status: radio (patent, stenosis, occluded, non_eval)
 */

test.describe("CAD-RADS 2.0 Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, "CAD-RADS 2.0");
  });

  test.describe("Visual and UI Tests", () => {
    test("should display calculator with correct title and description", async ({
      page,
    }) => {
      await expect(page.locator("h2")).toContainText("CAD-RADS 2.0");
      // Use more specific selector to find the description paragraph
      await expect(
        page.locator("p.text-sm.text-gray-600").first(),
      ).toContainText("Coronary Artery Disease Reporting and Data System");
    });

    test("should have study quality field visible on load", async ({
      page,
    }) => {
      await expect(page.getByText("Study Quality")).toBeVisible();
      await expect(page.getByText("Diagnostic quality")).toBeVisible();
      await expect(
        page.getByText("Limited - some segments non-evaluable"),
      ).toBeVisible();
      await expect(page.getByText("Non-diagnostic (CAD-RADS N)")).toBeVisible();
    });

    test("should display info section with CAD-RADS explanation", async ({
      page,
    }) => {
      await expect(page.getByText("Stenosis Categories:")).toBeVisible();
      await expect(page.getByText("Modifiers (CAD-RADS 2.0):")).toBeVisible();
      await expect(page.getByText("High-Risk Plaque Features:")).toBeVisible();
    });

    test("should show maximum stenosis field when diagnostic quality selected", async ({
      page,
    }) => {
      await page
        .locator('input[name="study_quality"][value="diagnostic"]')
        .click();
      await expect(page.getByText("Maximum Coronary Stenosis")).toBeVisible();
    });

    test("should hide stenosis fields when non-diagnostic selected", async ({
      page,
    }) => {
      await page
        .locator('input[name="study_quality"][value="non_diagnostic"]')
        .click();
      await expect(
        page.getByText("Maximum Coronary Stenosis"),
      ).not.toBeVisible();
    });
  });

  test.describe("CAD-RADS 0 - No Stenosis", () => {
    test("should calculate CAD-RADS 0 for no stenosis", async ({ page }) => {
      await page
        .locator('input[name="study_quality"][value="diagnostic"]')
        .click();
      await page.locator('input[name="max_stenosis"][value="0"]').click();
      await page
        .locator('input[name="prior_intervention"][value="none"]')
        .click();

      await page.click('button:has-text("Calculate")');

      // Use the results section to find the output
      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(
        resultsSection.getByText("CAD-RADS Classification:"),
      ).toBeVisible();
      await expect(
        resultsSection.getByText("Category: CAD-RADS 0"),
      ).toBeVisible();
      await expect(resultsSection.getByText("No CAD")).toBeVisible();
      await expect(resultsSection.getByText("No further workup")).toBeVisible();
      await expect(
        resultsSection.getByText("Excellent prognosis"),
      ).toBeVisible();
    });
  });

  test.describe("CAD-RADS 1 - Minimal Stenosis", () => {
    test("should calculate CAD-RADS 1 for 1-24% stenosis", async ({ page }) => {
      await page
        .locator('input[name="study_quality"][value="diagnostic"]')
        .click();
      await page.locator('input[name="max_stenosis"][value="1-24"]').click();
      await page.locator('input[name="plaque_burden"][value="none"]').click();
      await page.locator('input[name="hrp_features"][value="none"]').click();
      await page
        .locator('input[name="prior_intervention"][value="none"]')
        .click();

      await page.click('button:has-text("Calculate")');

      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(
        resultsSection.getByText("Category: CAD-RADS 1"),
      ).toBeVisible();
      await expect(
        resultsSection.getByText("Minimal Non-Obstructive CAD (1-24%)"),
      ).toBeVisible();
      await expect(
        resultsSection.getByText("preventive measures"),
      ).toBeVisible();
      await expect(resultsSection.getByText("Statin therapy")).toBeVisible();
    });
  });

  test.describe("CAD-RADS 2 - Mild Stenosis", () => {
    test("should calculate CAD-RADS 2 for 25-49% stenosis", async ({
      page,
    }) => {
      await page
        .locator('input[name="study_quality"][value="diagnostic"]')
        .click();
      await page.locator('input[name="max_stenosis"][value="25-49"]').click();
      await page.locator('input[name="plaque_burden"][value="none"]').click();
      await page.locator('input[name="hrp_features"][value="none"]').click();
      await page
        .locator('input[name="prior_intervention"][value="none"]')
        .click();

      await page.click('button:has-text("Calculate")');

      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(
        resultsSection.getByText("Category: CAD-RADS 2"),
      ).toBeVisible();
      await expect(
        resultsSection.getByText("Mild Non-Obstructive CAD (25-49%)"),
      ).toBeVisible();
      await expect(
        resultsSection.getByText("Preventive therapy"),
      ).toBeVisible();
    });
  });

  test.describe("CAD-RADS 3 - Moderate Stenosis", () => {
    test("should calculate CAD-RADS 3 for 50-69% stenosis", async ({
      page,
    }) => {
      await page
        .locator('input[name="study_quality"][value="diagnostic"]')
        .click();
      await page.locator('input[name="max_stenosis"][value="50-69"]').click();
      await page
        .locator('input[name="severe_location"][value="non_lm"]')
        .click();
      await page.locator('input[name="plaque_burden"][value="none"]').click();
      await page.locator('input[name="hrp_features"][value="none"]').click();
      await page.locator('input[name="ischemia_testing"][value="no"]').click();
      await page
        .locator('input[name="prior_intervention"][value="none"]')
        .click();

      await page.click('button:has-text("Calculate")');

      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(
        resultsSection.getByText("Category: CAD-RADS 3"),
      ).toBeVisible();
      await expect(
        resultsSection.getByText("Moderate Stenosis (50-69%)"),
      ).toBeVisible();
      await expect(
        resultsSection.getByText("Functional testing"),
      ).toBeVisible();
    });

    test("should show ischemia testing option for CAD-RADS 3", async ({
      page,
    }) => {
      await page
        .locator('input[name="study_quality"][value="diagnostic"]')
        .click();
      await page.locator('input[name="max_stenosis"][value="50-69"]').click();

      // The label is "Ischemia Testing Recommended (/I Modifier)"
      await expect(
        page.getByText("Ischemia Testing Recommended (/I Modifier)"),
      ).toBeVisible();
    });

    test("should add /I modifier when ischemia testing recommended", async ({
      page,
    }) => {
      await page
        .locator('input[name="study_quality"][value="diagnostic"]')
        .click();
      await page.locator('input[name="max_stenosis"][value="50-69"]').click();
      await page
        .locator('input[name="severe_location"][value="non_lm"]')
        .click();
      await page.locator('input[name="plaque_burden"][value="none"]').click();
      await page.locator('input[name="hrp_features"][value="none"]').click();
      await page.locator('input[name="ischemia_testing"][value="yes"]').click();
      await page
        .locator('input[name="prior_intervention"][value="none"]')
        .click();

      await page.click('button:has-text("Calculate")');

      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(resultsSection.getByText("CAD-RADS 3/I")).toBeVisible();
      await expect(
        resultsSection.getByText("Ischemia testing recommended"),
      ).toBeVisible();
    });
  });

  test.describe("CAD-RADS 4A - Severe Stenosis", () => {
    test("should calculate CAD-RADS 4A for 70-99% stenosis in non-LM artery", async ({
      page,
    }) => {
      await page
        .locator('input[name="study_quality"][value="diagnostic"]')
        .click();
      await page.locator('input[name="max_stenosis"][value="70-99"]').click();
      // Wait for conditional fields to appear
      await expect(
        page.locator('input[name="severe_location"][value="non_lm"]'),
      ).toBeVisible();
      await page
        .locator('input[name="severe_location"][value="non_lm"]')
        .click();
      // Wait for three_vessel to appear after selecting non_lm
      await expect(
        page.locator('input[name="three_vessel"][value="no"]'),
      ).toBeVisible();
      await page.locator('input[name="three_vessel"][value="no"]').click();
      await page.locator('input[name="plaque_burden"][value="none"]').click();
      await page.locator('input[name="hrp_features"][value="none"]').click();
      await page
        .locator('input[name="prior_intervention"][value="none"]')
        .click();

      await page.click('button:has-text("Calculate")');

      const resultsSection = page.locator('section[aria-live="polite"]');
      // Use Category: prefix to be specific
      await expect(
        resultsSection.getByText("Category: CAD-RADS 4A"),
      ).toBeVisible();
      await expect(
        resultsSection.getByText("Severe Stenosis (70-99%)"),
      ).toBeVisible();
      await expect(
        resultsSection.getByText("invasive coronary angiography"),
      ).toBeVisible();
    });
  });

  test.describe("CAD-RADS 4B - Left Main or 3-Vessel Disease", () => {
    test("should calculate CAD-RADS 4B for left main >=50%", async ({
      page,
    }) => {
      await page
        .locator('input[name="study_quality"][value="diagnostic"]')
        .click();
      await page.locator('input[name="max_stenosis"][value="70-99"]').click();
      // Wait for conditional field to appear
      await expect(
        page.locator('input[name="severe_location"][value="lm_significant"]'),
      ).toBeVisible();
      await page
        .locator('input[name="severe_location"][value="lm_significant"]')
        .click();
      await page.locator('input[name="plaque_burden"][value="none"]').click();
      await page.locator('input[name="hrp_features"][value="none"]').click();
      await page
        .locator('input[name="prior_intervention"][value="none"]')
        .click();

      await page.click('button:has-text("Calculate")');

      const resultsSection = page.locator('section[aria-live="polite"]');
      // Use Category: prefix to be specific
      await expect(
        resultsSection.getByText("Category: CAD-RADS 4B"),
      ).toBeVisible();
      await expect(resultsSection.getByText("Left Main")).toBeVisible();
      await expect(resultsSection.getByText("Heart team")).toBeVisible();
    });

    test("should calculate CAD-RADS 4B for 3-vessel severe disease", async ({
      page,
    }) => {
      await page
        .locator('input[name="study_quality"][value="diagnostic"]')
        .click();
      await page.locator('input[name="max_stenosis"][value="70-99"]').click();
      // Wait for conditional fields to appear
      await expect(
        page.locator('input[name="severe_location"][value="non_lm"]'),
      ).toBeVisible();
      await page
        .locator('input[name="severe_location"][value="non_lm"]')
        .click();
      // Wait for three_vessel to appear after selecting non_lm
      await expect(
        page.locator('input[name="three_vessel"][value="yes"]'),
      ).toBeVisible();
      await page.locator('input[name="three_vessel"][value="yes"]').click();
      await page.locator('input[name="plaque_burden"][value="none"]').click();
      await page.locator('input[name="hrp_features"][value="none"]').click();
      await page
        .locator('input[name="prior_intervention"][value="none"]')
        .click();

      await page.click('button:has-text("Calculate")');

      const resultsSection = page.locator('section[aria-live="polite"]');
      // Use Category: prefix to be specific
      await expect(
        resultsSection.getByText("Category: CAD-RADS 4B"),
      ).toBeVisible();
      await expect(resultsSection.getByText("3-Vessel")).toBeVisible();
      await expect(resultsSection.getByText("Revascularization")).toBeVisible();
    });
  });

  test.describe("CAD-RADS 5 - Total Occlusion", () => {
    test("should calculate CAD-RADS 5 for 100% occlusion", async ({ page }) => {
      await page
        .locator('input[name="study_quality"][value="diagnostic"]')
        .click();
      await page.locator('input[name="max_stenosis"][value="100"]').click();
      // Wait for conditional fields to appear
      await expect(
        page.locator('input[name="plaque_burden"][value="none"]'),
      ).toBeVisible();
      await page.locator('input[name="plaque_burden"][value="none"]').click();
      await page.locator('input[name="hrp_features"][value="none"]').click();
      await page
        .locator('input[name="prior_intervention"][value="none"]')
        .click();

      await page.click('button:has-text("Calculate")');

      const resultsSection = page.locator('section[aria-live="polite"]');
      // Use Category: prefix to be specific
      await expect(resultsSection.getByText("Category: CAD-RADS 5")).toBeVisible();
      await expect(
        resultsSection.getByText("Total Occlusion (100%)"),
      ).toBeVisible();
      await expect(resultsSection.getByText("CTO PCI")).toBeVisible();
    });
  });

  test.describe("CAD-RADS N - Non-Diagnostic", () => {
    test("should calculate CAD-RADS N for non-diagnostic study", async ({
      page,
    }) => {
      await page
        .locator('input[name="study_quality"][value="non_diagnostic"]')
        .click();

      await page.click('button:has-text("Calculate")');

      const resultsSection = page.locator('section[aria-live="polite"]');
      // The compute function returns "CAD-RADS Category" not "Category" for non-diagnostic
      await expect(resultsSection.getByText("CAD-RADS N -")).toBeVisible();
      await expect(resultsSection.getByText("Repeat CTA")).toBeVisible();
      await expect(
        resultsSection.getByText("technical limitations"),
      ).toBeVisible();
    });
  });

  test.describe("Plaque Burden Modifier Tests", () => {
    test("should add P1 modifier for mild plaque burden", async ({ page }) => {
      await page
        .locator('input[name="study_quality"][value="diagnostic"]')
        .click();
      await page.locator('input[name="max_stenosis"][value="25-49"]').click();
      await page.locator('input[name="plaque_burden"][value="P1"]').click();
      await page.locator('input[name="hrp_features"][value="none"]').click();
      await page
        .locator('input[name="prior_intervention"][value="none"]')
        .click();

      await page.click('button:has-text("Calculate")');

      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(resultsSection.getByText("CAD-RADS 2/P1")).toBeVisible();
      await expect(
        resultsSection.getByText("Mild plaque burden (1-2 segments)"),
      ).toBeVisible();
    });

    test("should add P2 modifier for moderate plaque burden", async ({
      page,
    }) => {
      await page
        .locator('input[name="study_quality"][value="diagnostic"]')
        .click();
      await page.locator('input[name="max_stenosis"][value="25-49"]').click();
      await page.locator('input[name="plaque_burden"][value="P2"]').click();
      await page.locator('input[name="hrp_features"][value="none"]').click();
      await page
        .locator('input[name="prior_intervention"][value="none"]')
        .click();

      await page.click('button:has-text("Calculate")');

      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(resultsSection.getByText("CAD-RADS 2/P2")).toBeVisible();
      await expect(
        resultsSection.getByText("Moderate plaque burden (3-4 segments)"),
      ).toBeVisible();
    });

    test("should add P3 modifier for severe plaque burden with clinical note", async ({
      page,
    }) => {
      await page
        .locator('input[name="study_quality"][value="diagnostic"]')
        .click();
      await page.locator('input[name="max_stenosis"][value="25-49"]').click();
      await page.locator('input[name="plaque_burden"][value="P3"]').click();
      await page.locator('input[name="hrp_features"][value="none"]').click();
      await page
        .locator('input[name="prior_intervention"][value="none"]')
        .click();

      await page.click('button:has-text("Calculate")');

      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(resultsSection.getByText("CAD-RADS 2/P3")).toBeVisible();
      await expect(
        resultsSection.getByText("Severe plaque burden (5-7 segments)"),
      ).toBeVisible();
      await expect(
        resultsSection.getByText("aggressive risk factor modification"),
      ).toBeVisible();
    });

    test("should add P4 modifier for extensive plaque burden", async ({
      page,
    }) => {
      await page
        .locator('input[name="study_quality"][value="diagnostic"]')
        .click();
      await page.locator('input[name="max_stenosis"][value="25-49"]').click();
      await page.locator('input[name="plaque_burden"][value="P4"]').click();
      await page.locator('input[name="hrp_features"][value="none"]').click();
      await page
        .locator('input[name="prior_intervention"][value="none"]')
        .click();

      await page.click('button:has-text("Calculate")');

      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(resultsSection.getByText("CAD-RADS 2/P4")).toBeVisible();
      // Use .first() to avoid strict mode violation since text appears in Modifiers and Clinical Notes
      await expect(
        resultsSection.getByText("Extensive plaque burden").first(),
      ).toBeVisible();
    });

    test("should not show plaque burden modifier field for CAD-RADS 0", async ({
      page,
    }) => {
      await page
        .locator('input[name="study_quality"][value="diagnostic"]')
        .click();
      await page.locator('input[name="max_stenosis"][value="0"]').click();

      await expect(
        page.getByText("Plaque Burden (P Modifier)"),
      ).not.toBeVisible();
    });
  });

  test.describe("High-Risk Plaque (HRP) Modifier Tests", () => {
    test("should add HRP modifier for high-risk plaque features", async ({
      page,
    }) => {
      await page
        .locator('input[name="study_quality"][value="diagnostic"]')
        .click();
      await page.locator('input[name="max_stenosis"][value="50-69"]').click();
      await page
        .locator('input[name="severe_location"][value="non_lm"]')
        .click();
      await page.locator('input[name="plaque_burden"][value="none"]').click();
      await page.locator('input[name="hrp_features"][value="present"]').click();
      await page.locator('input[name="ischemia_testing"][value="no"]').click();
      await page
        .locator('input[name="prior_intervention"][value="none"]')
        .click();

      await page.click('button:has-text("Calculate")');

      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(resultsSection.getByText("CAD-RADS 3/HRP")).toBeVisible();
      await expect(
        resultsSection.getByText("High-risk plaque features present"),
      ).toBeVisible();
      await expect(
        resultsSection.getByText("acute coronary syndrome risk"),
      ).toBeVisible();
    });

    test("should combine plaque burden and HRP modifiers", async ({ page }) => {
      await page
        .locator('input[name="study_quality"][value="diagnostic"]')
        .click();
      await page.locator('input[name="max_stenosis"][value="50-69"]').click();
      await page
        .locator('input[name="severe_location"][value="non_lm"]')
        .click();
      await page.locator('input[name="plaque_burden"][value="P2"]').click();
      await page.locator('input[name="hrp_features"][value="present"]').click();
      await page.locator('input[name="ischemia_testing"][value="no"]').click();
      await page
        .locator('input[name="prior_intervention"][value="none"]')
        .click();

      await page.click('button:has-text("Calculate")');

      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(resultsSection.getByText("CAD-RADS 3/P2/HRP")).toBeVisible();
    });
  });

  test.describe("Prior Intervention Tests (Stent/Graft)", () => {
    test("should add S modifier for stent present", async ({ page }) => {
      await page
        .locator('input[name="study_quality"][value="diagnostic"]')
        .click();
      await page.locator('input[name="max_stenosis"][value="25-49"]').click();
      await page.locator('input[name="plaque_burden"][value="none"]').click();
      await page.locator('input[name="hrp_features"][value="none"]').click();
      await page
        .locator('input[name="prior_intervention"][value="stent"]')
        .click();
      await page.locator('input[name="stent_status"][value="patent"]').click();

      await page.click('button:has-text("Calculate")');

      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(resultsSection.getByText("CAD-RADS 2/S")).toBeVisible();
      await expect(resultsSection.getByText("Stent(s): Patent")).toBeVisible();
    });

    test("should add G modifier for bypass graft present", async ({ page }) => {
      await page
        .locator('input[name="study_quality"][value="diagnostic"]')
        .click();
      await page.locator('input[name="max_stenosis"][value="25-49"]').click();
      await page.locator('input[name="plaque_burden"][value="none"]').click();
      await page.locator('input[name="hrp_features"][value="none"]').click();
      await page
        .locator('input[name="prior_intervention"][value="cabg"]')
        .click();
      await page.locator('input[name="graft_status"][value="patent"]').click();

      await page.click('button:has-text("Calculate")');

      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(resultsSection.getByText("CAD-RADS 2/G")).toBeVisible();
      await expect(resultsSection.getByText("Graft(s): Patent")).toBeVisible();
    });

    test("should add both S and G modifiers for stents and grafts", async ({
      page,
    }) => {
      await page
        .locator('input[name="study_quality"][value="diagnostic"]')
        .click();
      await page.locator('input[name="max_stenosis"][value="25-49"]').click();
      await page.locator('input[name="plaque_burden"][value="none"]').click();
      await page.locator('input[name="hrp_features"][value="none"]').click();
      await page
        .locator('input[name="prior_intervention"][value="both"]')
        .click();
      await page.locator('input[name="stent_status"][value="patent"]').click();
      await page.locator('input[name="graft_status"][value="patent"]').click();

      await page.click('button:has-text("Calculate")');

      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(resultsSection.getByText("CAD-RADS 2/S/G")).toBeVisible();
      await expect(resultsSection.getByText("Stent(s): Patent")).toBeVisible();
      await expect(resultsSection.getByText("Graft(s): Patent")).toBeVisible();
    });

    test("should show in-stent stenosis status", async ({ page }) => {
      await page
        .locator('input[name="study_quality"][value="diagnostic"]')
        .click();
      await page.locator('input[name="max_stenosis"][value="70-99"]').click();
      await page
        .locator('input[name="severe_location"][value="non_lm"]')
        .click();
      await page.locator('input[name="three_vessel"][value="no"]').click();
      await page.locator('input[name="plaque_burden"][value="none"]').click();
      await page.locator('input[name="hrp_features"][value="none"]').click();
      await page
        .locator('input[name="prior_intervention"][value="stent"]')
        .click();
      await page
        .locator('input[name="stent_status"][value="stenosis"]')
        .click();

      await page.click('button:has-text("Calculate")');

      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(
        resultsSection.getByText("Stent(s): In-stent stenosis"),
      ).toBeVisible();
    });

    test("should show graft stenosis status", async ({ page }) => {
      await page
        .locator('input[name="study_quality"][value="diagnostic"]')
        .click();
      await page.locator('input[name="max_stenosis"][value="70-99"]').click();
      await page
        .locator('input[name="severe_location"][value="non_lm"]')
        .click();
      await page.locator('input[name="three_vessel"][value="no"]').click();
      await page.locator('input[name="plaque_burden"][value="none"]').click();
      await page.locator('input[name="hrp_features"][value="none"]').click();
      await page
        .locator('input[name="prior_intervention"][value="cabg"]')
        .click();
      await page
        .locator('input[name="graft_status"][value="stenosis"]')
        .click();

      await page.click('button:has-text("Calculate")');

      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(
        resultsSection.getByText("Graft(s): Stenosis"),
      ).toBeVisible();
    });
  });

  test.describe("Limited Quality Study Tests", () => {
    test("should show quality note for limited study", async ({ page }) => {
      await page
        .locator('input[name="study_quality"][value="limited"]')
        .click();
      await page.locator('input[name="max_stenosis"][value="25-49"]').click();
      await page.locator('input[name="plaque_burden"][value="none"]').click();
      await page.locator('input[name="hrp_features"][value="none"]').click();
      await page
        .locator('input[name="prior_intervention"][value="none"]')
        .click();

      await page.click('button:has-text("Calculate")');

      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(
        resultsSection.getByText("Category: CAD-RADS 2"),
      ).toBeVisible();
      await expect(
        resultsSection.getByText("Some coronary segments were non-evaluable"),
      ).toBeVisible();
    });
  });

  test.describe("Combined Modifier Tests", () => {
    test("should handle all modifiers together: P2/HRP/I/S", async ({
      page,
    }) => {
      await page
        .locator('input[name="study_quality"][value="diagnostic"]')
        .click();
      await page.locator('input[name="max_stenosis"][value="50-69"]').click();
      await page
        .locator('input[name="severe_location"][value="non_lm"]')
        .click();
      await page.locator('input[name="plaque_burden"][value="P2"]').click();
      await page.locator('input[name="hrp_features"][value="present"]').click();
      await page.locator('input[name="ischemia_testing"][value="yes"]').click();
      await page
        .locator('input[name="prior_intervention"][value="stent"]')
        .click();
      await page.locator('input[name="stent_status"][value="patent"]').click();

      await page.click('button:has-text("Calculate")');

      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(
        resultsSection.getByText("CAD-RADS 3/P2/HRP/I/S"),
      ).toBeVisible();
    });
  });

  test.describe("Input Validation", () => {
    test("should show error when stenosis not selected", async ({ page }) => {
      await page
        .locator('input[name="study_quality"][value="diagnostic"]')
        .click();
      // Don't select stenosis

      await page.click('button:has-text("Calculate")');

      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(
        resultsSection.getByText("Please select the maximum coronary stenosis"),
      ).toBeVisible();
    });
  });

  test.describe("References", () => {
    test("should display CAD-RADS 2.0 references", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: "References" }),
      ).toBeVisible();
      await expect(page.getByText("Cury RC").first()).toBeVisible();
    });

    test("should have correct number of reference links", async ({ page }) => {
      const refLinks = page.locator('a[href^="https://doi.org"]');
      await expect(refLinks).toHaveCount(4);
    });

    test("should have valid DOI link for CAD-RADS 2.0 publication", async ({
      page,
    }) => {
      const cadrads2Link = page.locator(
        'a[href="https://doi.org/10.1016/j.jcmg.2022.01.008"]',
      );
      await expect(cadrads2Link).toBeVisible();
      await expect(cadrads2Link).toContainText("JACC Cardiovasc Imaging. 2022");
    });

    test("should have valid DOI link for original CAD-RADS publication", async ({
      page,
    }) => {
      const originalLink = page.locator(
        'a[href="https://doi.org/10.1016/j.jcct.2016.04.005"]',
      );
      await expect(originalLink).toBeVisible();
      await expect(originalLink).toContainText(
        "J Cardiovasc Comput Tomogr. 2016",
      );
    });
  });

  test.describe("Clinical Notes Validation", () => {
    test("should show excellent prognosis note for CAD-RADS 0-1", async ({
      page,
    }) => {
      await page
        .locator('input[name="study_quality"][value="diagnostic"]')
        .click();
      await page.locator('input[name="max_stenosis"][value="1-24"]').click();
      await page.locator('input[name="plaque_burden"][value="none"]').click();
      await page.locator('input[name="hrp_features"][value="none"]').click();
      await page
        .locator('input[name="prior_intervention"][value="none"]')
        .click();

      await page.click('button:has-text("Calculate")');

      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(
        resultsSection.getByText(
          "Excellent prognosis with very low annual event rate",
        ),
      ).toBeVisible();
    });

    test("should show antiplatelet note for CAD-RADS 4-5", async ({ page }) => {
      await page
        .locator('input[name="study_quality"][value="diagnostic"]')
        .click();
      await page.locator('input[name="max_stenosis"][value="100"]').click();
      await page.locator('input[name="plaque_burden"][value="none"]').click();
      await page.locator('input[name="hrp_features"][value="none"]').click();
      await page
        .locator('input[name="prior_intervention"][value="none"]')
        .click();

      await page.click('button:has-text("Calculate")');

      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(
        resultsSection.getByText("antiplatelet therapy"),
      ).toBeVisible();
    });
  });
});
