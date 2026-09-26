/**
 * NI-RADS Calculator - E2E Tests
 *
 * Tests the ACR Neck Imaging Reporting and Data System calculator for
 * post-treatment head and neck cancer surveillance.
 *
 * Test Coverage:
 * - NI-RADS 0: Incomplete (prior imaging unavailable but will be obtained)
 * - NI-RADS 1: No evidence of recurrence
 * - NI-RADS 2a: Low suspicion (superficial/mucosal - direct visualization)
 * - NI-RADS 2b: Low suspicion (deep - short-term follow-up)
 * - NI-RADS 3: High suspicion (biopsy recommended)
 * - NI-RADS 4: Known/definite recurrence
 * - Primary site and neck node separate categories
 * - PET/CT concordance rules
 * - Recurrence risk estimates
 * - Reference verification
 */

import { test, expect } from "@playwright/test";
import {
  navigateToCalculator,
  verifyThemeConsistency,
} from "../../../helpers/calculator-test-helper.js";

const CALCULATOR_NAME = "ACR NI-RADS";

/**
 * Helper to select a radio option by its exact label text within the calculator form
 * @param {import('@playwright/test').Page} page
 * @param {string} labelText - The exact label text of the radio option
 */
async function selectRadioOption(page, labelText) {
  // Target the radio's own label in the main content area. On mobile a section
  // summary can repeat the selected value (e.g. "2018 CT/PET-CT"), so prefer the
  // <label> element and fall back to any exact text match inside main.
  const label = page.locator("main label").getByText(labelText, { exact: true });
  if ((await label.count()) === 1) {
    await label.click();
    return;
  }
  await page.locator("main").getByText(labelText, { exact: true }).click();
}

/**
 * Start again from a clean form. NI-RADS does not enable the shared Reset
 * button (its definition leaves showReset off), so reload the calculator page.
 * @param {import('@playwright/test').Page} page
 */
async function resetCalculator(page) {
  await page.reload();
  await expect(page.getByTestId("calculator-title").first()).toContainText("ACR NI-RADS");
}

test.describe("ACR NI-RADS Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, CALCULATOR_NAME);

    // Verify calculator loaded
    await expect(page.getByTestId('calculator-title').first()).toContainText("ACR NI-RADS");
  });

  test.describe("Visual and UI Tests", () => {
    test("should display calculator with correct title and description", async ({
      page,
    }) => {
      await expect(page.getByTestId('calculator-title').first()).toContainText("ACR NI-RADS");
      await expect(page.getByTestId("calculator-description")).toContainText(
        "Neck Imaging Reporting and Data System",
      );
    });

    test("should display info section with NI-RADS explanation", async ({
      page,
    }) => {
      // Check within the info section specifically
      const infoSection = page.getByTestId("calculator-info");
      await expect(
        infoSection.getByText("PRIMARY TUMOR SITE").first(),
      ).toBeVisible();
      await expect(infoSection.getByText("CERVICAL LYMPH NODES")).toBeVisible();
      await expect(infoSection.getByText("NI-RADS 0")).toBeVisible();
      await expect(infoSection.getByText("NI-RADS 1")).toBeVisible();
    });

    test("should have imaging modality selection", async ({ page }) => {
      await expect(
        page.locator("main").getByText("Imaging Modality"),
      ).toBeVisible();
      await expect(
        page.locator("main").getByText("Contrast-Enhanced CT"),
      ).toBeVisible();
      // Use exact match for MRI to avoid matching "Adrenal MRI CSI" in sidebar
      await expect(
        page.locator("main").getByText("MRI", { exact: true }),
      ).toBeVisible();
      await expect(page.locator("main").getByText("PET/CT")).toBeVisible();
    });

    test("should have prior imaging availability selection", async ({
      page,
    }) => {
      await expect(
        page
          .locator("main")
          .getByText("Prior Imaging Available for Comparison"),
      ).toBeVisible();
      await expect(
        page.locator("main").getByText("Yes - prior available"),
      ).toBeVisible();
      await expect(
        page.locator("main").getByText("No - will be obtained"),
      ).toBeVisible();
      await expect(
        page.locator("main").getByText("No - cannot be obtained"),
      ).toBeVisible();
    });

    test("should have primary site and neck node assessment sections", async ({
      page,
    }) => {
      await expect(
        page.locator("main").getByText("PRIMARY SITE ASSESSMENT"),
      ).toBeVisible();
      await expect(
        page.locator("main").getByText("NECK LYMPH NODE ASSESSMENT"),
      ).toBeVisible();
    });
  });

  test.describe("NI-RADS 0 - Incomplete", () => {
    test("should calculate NI-RADS 0 when prior imaging pending", async ({
      page,
    }) => {
      await selectRadioOption(page, "Contrast-Enhanced CT");
      await selectRadioOption(page, "No - will be obtained");

      await page.click('button:has-text("Calculate")');

      const resultSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(
        resultSection.getByText("0 - Incomplete").first(),
      ).toBeVisible();
      await expect(
        resultSection.getByText("Obtain prior imaging for comparison"),
      ).toBeVisible();
      await expect(resultSection.getByText("reassign category")).toBeVisible();
    });
  });

  test.describe("NI-RADS 1 - No Evidence of Recurrence", () => {
    test("should calculate NI-RADS 1 for expected post-treatment changes at primary site", async ({
      page,
    }) => {
      await selectRadioOption(page, "Contrast-Enhanced CT");
      await selectRadioOption(page, "Yes - prior available");

      // Primary site: expected post-treatment changes
      await selectRadioOption(
        page,
        "Expected post-treatment changes only (distortion, scar, diffuse linear enhancement)",
      );

      // Neck: no abnormal lymph nodes
      await selectRadioOption(page, "No abnormal lymph nodes");

      await page.click('button:has-text("Calculate")');

      const resultSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(
        resultSection.getByText("1 - No Evidence of Recurrence").first(),
      ).toBeVisible();
      await expect(
        resultSection
          .getByText("Routine surveillance (typically 6 months)")
          .first(),
      ).toBeVisible();
      await expect(resultSection.getByText("~4%")).toBeVisible();
    });

    test("should calculate NI-RADS 1 for residual stable nodal tissue", async ({
      page,
    }) => {
      // Use exact match for MRI within main area
      await selectRadioOption(page, "MRI");
      await selectRadioOption(page, "Yes - prior available");

      await selectRadioOption(
        page,
        "Expected post-treatment changes only (distortion, scar, diffuse linear enhancement)",
      );
      await selectRadioOption(
        page,
        "Residual nodal tissue - hypoenhancing, stable",
      );

      await page.click('button:has-text("Calculate")');

      const resultSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(resultSection.getByText("Neck NI-RADS")).toBeVisible();
      await expect(
        resultSection.getByText("1 - No Evidence of Recurrence").first(),
      ).toBeVisible();
    });
  });

  test.describe("NI-RADS 2a - Low Suspicion (Superficial)", () => {
    test("should calculate NI-RADS 2a for focal mucosal abnormality", async ({
      page,
    }) => {
      await selectRadioOption(page, "Contrast-Enhanced CT");
      await selectRadioOption(page, "Yes - prior available");

      // Primary site: focal mucosal abnormality
      await selectRadioOption(
        page,
        "Focal mucosal abnormality (non-masslike enhancement)",
      );

      // Neck: no abnormal nodes
      await selectRadioOption(page, "No abnormal lymph nodes");

      await page.click('button:has-text("Calculate")');

      const resultSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(
        resultSection.getByText("2a - Low Suspicion (Superficial)"),
      ).toBeVisible();
      await expect(
        resultSection.getByText(
          "Direct visual inspection (laryngoscopy/endoscopy)",
        ),
      ).toBeVisible();
    });
  });

  test.describe("NI-RADS 2b - Low Suspicion (Deep)", () => {
    test("should calculate NI-RADS 2b for deep soft tissue changes", async ({
      page,
    }) => {
      await selectRadioOption(page, "Contrast-Enhanced CT");
      await selectRadioOption(page, "Yes - prior available");

      // Primary site: deep soft tissue
      await selectRadioOption(
        page,
        "Ill-defined deep soft tissue with mild differential enhancement",
      );

      // Neck: no abnormal nodes
      await selectRadioOption(page, "No abnormal lymph nodes");

      await page.click('button:has-text("Calculate")');

      const resultSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(
        resultSection.getByText("2b - Low Suspicion (Deep)"),
      ).toBeVisible();
      await expect(
        resultSection
          .getByText("Short-term follow-up imaging (3 months)")
          .first(),
      ).toBeVisible();
      await expect(resultSection.getByText("~17%")).toBeVisible();
    });

    test("should calculate NI-RADS 2 for new/enlarging neck node without necrosis", async ({
      page,
    }) => {
      await selectRadioOption(page, "MRI");
      await selectRadioOption(page, "Yes - prior available");

      // Primary site: expected changes
      await selectRadioOption(
        page,
        "Expected post-treatment changes only (distortion, scar, diffuse linear enhancement)",
      );

      // Neck: new/enlarging without necrosis
      await selectRadioOption(
        page,
        "New, enlarging, or residual abnormal node WITHOUT necrosis/ENE",
      );

      await page.click('button:has-text("Calculate")');

      const resultSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(resultSection.getByText("Neck NI-RADS")).toBeVisible();
      // Both Neck NI-RADS and Overall Assessment show "2 - Low Suspicion (Deep)", use first()
      await expect(
        resultSection.getByText("2 - Low Suspicion (Deep)").first(),
      ).toBeVisible();
      await expect(
        resultSection
          .getByText("Short-term follow-up imaging (3 months)")
          .first(),
      ).toBeVisible();
    });
  });

  test.describe("NI-RADS 3 - High Suspicion", () => {
    test("should calculate NI-RADS 3 for discrete mass at primary site", async ({
      page,
    }) => {
      await selectRadioOption(page, "Contrast-Enhanced CT");
      await selectRadioOption(page, "Yes - prior available");

      // Primary site: discrete mass
      await selectRadioOption(
        page,
        "New or enlarging discrete nodule/mass with intense enhancement",
      );

      // Neck: no abnormal nodes
      await selectRadioOption(page, "No abnormal lymph nodes");

      await page.click('button:has-text("Calculate")');

      const resultSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(
        resultSection.getByText("3 - High Suspicion").first(),
      ).toBeVisible();
      await expect(resultSection.getByText("Biopsy recommended")).toBeVisible();
      await expect(resultSection.getByText("~59%")).toBeVisible();
    });

    test("should calculate NI-RADS 3 for neck node with necrosis", async ({
      page,
    }) => {
      await selectRadioOption(page, "MRI");
      await selectRadioOption(page, "Yes - prior available");

      // Primary site: expected changes
      await selectRadioOption(
        page,
        "Expected post-treatment changes only (distortion, scar, diffuse linear enhancement)",
      );

      // Neck: necrosis/ENE
      await selectRadioOption(
        page,
        "New/enlarging node WITH necrosis or extranodal extension",
      );

      await page.click('button:has-text("Calculate")');

      const resultSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(resultSection.getByText("Neck NI-RADS")).toBeVisible();
      await expect(
        resultSection.getByText("3 - High Suspicion").first(),
      ).toBeVisible();
      await expect(resultSection.getByText("Biopsy or FNA")).toBeVisible();
    });

    test("should upgrade to NI-RADS 3 when new bone erosion present", async ({
      page,
    }) => {
      await selectRadioOption(page, "Contrast-Enhanced CT");
      await selectRadioOption(page, "Yes - prior available");

      // Primary site: discrete mass
      await selectRadioOption(
        page,
        "New or enlarging discrete nodule/mass with intense enhancement",
      );

      // Bone erosion question should appear
      await selectRadioOption(page, "Yes - new bone erosion");

      // Neck: no abnormal nodes
      await selectRadioOption(page, "No abnormal lymph nodes");

      await page.click('button:has-text("Calculate")');

      const resultSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(
        resultSection.getByText("Primary Site NI-RADS"),
      ).toBeVisible();
      await expect(
        resultSection.getByText("3 - High Suspicion").first(),
      ).toBeVisible();
    });
  });

  test.describe("NI-RADS 4 - Known Recurrence", () => {
    test("should calculate NI-RADS 4 for pathologically proven recurrence at primary site", async ({
      page,
    }) => {
      await selectRadioOption(page, "Contrast-Enhanced CT");
      await selectRadioOption(page, "Yes - prior available");

      // Primary site: definite recurrence
      // Note: there are two "Definite recurrence" options - one for primary site and one for neck
      // The primary site one comes first in the DOM
      await page
        .locator("main")
        .getByText("Definite recurrence (pathologically proven)")
        .first()
        .click();

      // Neck: no abnormal nodes
      await selectRadioOption(page, "No abnormal lymph nodes");

      await page.click('button:has-text("Calculate")');

      const resultSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(
        resultSection.getByText("4 - Known Recurrence").first(),
      ).toBeVisible();
      await expect(
        resultSection.getByText("Treatment planning").first(),
      ).toBeVisible();
      await expect(resultSection.getByText("100%")).toBeVisible();
    });

    test("should calculate NI-RADS 4 for pathologically proven nodal recurrence", async ({
      page,
    }) => {
      await selectRadioOption(page, "MRI");
      await selectRadioOption(page, "Yes - prior available");

      // Primary site: expected changes
      await selectRadioOption(
        page,
        "Expected post-treatment changes only (distortion, scar, diffuse linear enhancement)",
      );

      // Neck: definite nodal recurrence
      await selectRadioOption(
        page,
        "Definite nodal recurrence (pathologically proven)",
      );

      await page.click('button:has-text("Calculate")');

      const resultSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(resultSection.getByText("Neck NI-RADS")).toBeVisible();
      await expect(
        resultSection.getByText("4 - Known Recurrence").first(),
      ).toBeVisible();
      await expect(
        resultSection.getByText("Treatment planning").first(),
      ).toBeVisible();
    });
  });

  test.describe("PET/CT Concordance Rules", () => {
    test("should show PET-specific options when PET/CT selected", async ({
      page,
    }) => {
      await selectRadioOption(page, "PET/CT");
      await selectRadioOption(page, "Yes - prior available");

      await expect(
        page.locator("main").getByText("Primary Site FDG Uptake (PET)"),
      ).toBeVisible();
      await expect(
        page.locator("main").getByText("No abnormal uptake"),
      ).toBeVisible();
      // Use more specific text to avoid ambiguity
      await expect(
        page
          .locator("main")
          .getByText("Intense focal uptake to discrete nodule/mass"),
      ).toBeVisible();
    });

    test("should downgrade deep tissue to NI-RADS 1 when no FDG uptake (PET discordance)", async ({
      page,
    }) => {
      await selectRadioOption(page, "PET/CT");
      await selectRadioOption(page, "Yes - prior available");

      // Primary site: deep soft tissue (would be 2b on CT alone)
      await selectRadioOption(
        page,
        "Ill-defined deep soft tissue with mild differential enhancement",
      );

      // PET: no uptake -> discordant -> downgrade to 1
      await selectRadioOption(page, "No abnormal uptake");

      // Neck
      await selectRadioOption(page, "No abnormal lymph nodes");
      await selectRadioOption(page, "No abnormal nodal uptake");

      await page.click('button:has-text("Calculate")');

      const resultSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(
        resultSection.getByText("1 - No Evidence of Recurrence").first(),
      ).toBeVisible();
      await expect(
        resultSection.getByText(
          "PET findings incorporated using concordance rules",
        ),
      ).toBeVisible();
    });

    test("should downgrade discrete mass to NI-RADS 2b when only mild PET uptake", async ({
      page,
    }) => {
      await selectRadioOption(page, "PET/CT");
      await selectRadioOption(page, "Yes - prior available");

      // Primary site: discrete mass (would be 3 on CT alone)
      await selectRadioOption(
        page,
        "New or enlarging discrete nodule/mass with intense enhancement",
      );

      // PET: mild uptake -> discordant -> downgrade to 2b
      await selectRadioOption(page, "Mild focal mucosal uptake");

      // Bone erosion question may appear - select no
      const boneQuestion = page
        .locator("main")
        .getByText("No new bone erosion");
      if (await boneQuestion.isVisible()) {
        await boneQuestion.click();
      }

      // Neck
      await selectRadioOption(page, "No abnormal lymph nodes");
      await selectRadioOption(page, "No abnormal nodal uptake");

      await page.click('button:has-text("Calculate")');

      const resultSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(
        resultSection.getByText("2b - Low Suspicion (Deep)"),
      ).toBeVisible();
    });

    test("should upgrade neck node to NI-RADS 3 with intense focal uptake", async ({
      page,
    }) => {
      await selectRadioOption(page, "PET/CT");
      await selectRadioOption(page, "Yes - prior available");

      // Primary site
      await selectRadioOption(
        page,
        "Expected post-treatment changes only (distortion, scar, diffuse linear enhancement)",
      );
      await selectRadioOption(page, "No abnormal uptake");

      // Neck: new/enlarging node (would be 2 on CT alone)
      await selectRadioOption(
        page,
        "New, enlarging, or residual abnormal node WITHOUT necrosis/ENE",
      );

      // PET: intense uptake -> upgrade to 3
      await selectRadioOption(
        page,
        "Intense focal uptake to new/enlarging node",
      );

      await page.click('button:has-text("Calculate")');

      const resultSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(resultSection.getByText("Neck NI-RADS")).toBeVisible();
      await expect(
        resultSection.getByText("3 - High Suspicion").first(),
      ).toBeVisible();
    });
  });

  test.describe("Combined Primary Site and Neck Assessment", () => {
    test("should report different categories for primary and neck", async ({
      page,
    }) => {
      await selectRadioOption(page, "Contrast-Enhanced CT");
      await selectRadioOption(page, "Yes - prior available");

      // Primary site: expected changes (NI-RADS 1)
      await selectRadioOption(
        page,
        "Expected post-treatment changes only (distortion, scar, diffuse linear enhancement)",
      );

      // Neck: necrosis (NI-RADS 3)
      await selectRadioOption(
        page,
        "New/enlarging node WITH necrosis or extranodal extension",
      );

      await page.click('button:has-text("Calculate")');

      const resultSection = page.getByRole('status', { name: 'Calculator results' });
      // Should have different categories
      await expect(
        resultSection.getByText("Primary Site NI-RADS"),
      ).toBeVisible();
      await expect(resultSection.getByText("Neck NI-RADS")).toBeVisible();
      await expect(
        resultSection.getByText("Primary site and neck categories differ"),
      ).toBeVisible();

      // Overall should be the higher category
      await expect(resultSection.getByText("Overall Assessment")).toBeVisible();
      await expect(resultSection.getByText("NI-RADS 3")).toBeVisible();
    });

    test("should use higher category for overall assessment", async ({
      page,
    }) => {
      await selectRadioOption(page, "MRI");
      await selectRadioOption(page, "Yes - prior available");

      // Primary site: NI-RADS 2a
      await selectRadioOption(
        page,
        "Focal mucosal abnormality (non-masslike enhancement)",
      );

      // Neck: NI-RADS 4
      await selectRadioOption(
        page,
        "Definite nodal recurrence (pathologically proven)",
      );

      await page.click('button:has-text("Calculate")');

      const resultSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(resultSection.getByText("Overall Assessment")).toBeVisible();
      await expect(resultSection.getByText("NI-RADS 4")).toBeVisible();
      await expect(resultSection.getByText("100%")).toBeVisible();
    });
  });

  test.describe("Prior Imaging Unavailable", () => {
    test("should note when prior unavailable but categories still assigned", async ({
      page,
    }) => {
      await selectRadioOption(page, "Contrast-Enhanced CT");
      await selectRadioOption(page, "No - cannot be obtained");

      // Primary site
      await selectRadioOption(
        page,
        "Expected post-treatment changes only (distortion, scar, diffuse linear enhancement)",
      );

      // Neck
      await selectRadioOption(page, "No abnormal lymph nodes");

      await page.click('button:has-text("Calculate")');

      const resultSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(
        resultSection.getByText(
          "Categories assigned without prior comparison (prior unavailable)",
        ),
      ).toBeVisible();
    });
  });

  test.describe("Input Validation", () => {
    test("should show error when primary site findings not selected", async ({
      page,
    }) => {
      await selectRadioOption(page, "Contrast-Enhanced CT");
      await selectRadioOption(page, "Yes - prior available");

      // Skip primary site, only select neck
      await selectRadioOption(page, "No abnormal lymph nodes");

      await page.click('button:has-text("Calculate")');

      const resultSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(
        resultSection.getByText("Please select primary site findings"),
      ).toBeVisible();
    });

    test("should show error when neck findings not selected", async ({
      page,
    }) => {
      await selectRadioOption(page, "Contrast-Enhanced CT");
      await selectRadioOption(page, "Yes - prior available");

      // Select primary site, skip neck
      await selectRadioOption(
        page,
        "Expected post-treatment changes only (distortion, scar, diffuse linear enhancement)",
      );

      await page.click('button:has-text("Calculate")');

      const resultSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(
        resultSection.getByText("Please select neck lymph node findings"),
      ).toBeVisible();
    });
  });

  test.describe("Recurrence Risk Estimates", () => {
    test("should display correct risk for NI-RADS 1 (~4%)", async ({
      page,
    }) => {
      await selectRadioOption(page, "Contrast-Enhanced CT");
      await selectRadioOption(page, "Yes - prior available");

      await selectRadioOption(
        page,
        "Expected post-treatment changes only (distortion, scar, diffuse linear enhancement)",
      );
      await selectRadioOption(page, "No abnormal lymph nodes");

      await page.click('button:has-text("Calculate")');

      const resultSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(resultSection.getByText("~4%")).toBeVisible();
    });

    test("should display correct risk for NI-RADS 2 (~17%)", async ({
      page,
    }) => {
      await selectRadioOption(page, "Contrast-Enhanced CT");
      await selectRadioOption(page, "Yes - prior available");

      await selectRadioOption(
        page,
        "Ill-defined deep soft tissue with mild differential enhancement",
      );
      await selectRadioOption(page, "No abnormal lymph nodes");

      await page.click('button:has-text("Calculate")');

      const resultSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(resultSection.getByText("~17%")).toBeVisible();
    });

    test("should display correct risk for NI-RADS 3 (~59%)", async ({
      page,
    }) => {
      await selectRadioOption(page, "Contrast-Enhanced CT");
      await selectRadioOption(page, "Yes - prior available");

      await selectRadioOption(
        page,
        "New or enlarging discrete nodule/mass with intense enhancement",
      );
      await selectRadioOption(page, "No abnormal lymph nodes");

      await page.click('button:has-text("Calculate")');

      const resultSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(resultSection.getByText("~59%")).toBeVisible();
    });

    test("should display correct risk for NI-RADS 4 (100%)", async ({
      page,
    }) => {
      await selectRadioOption(page, "Contrast-Enhanced CT");
      await selectRadioOption(page, "Yes - prior available");

      // Use first match for primary site definite recurrence
      await page
        .locator("main")
        .getByText("Definite recurrence (pathologically proven)")
        .first()
        .click();
      await selectRadioOption(page, "No abnormal lymph nodes");

      await page.click('button:has-text("Calculate")');

      const resultSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(resultSection.getByText("100%")).toBeVisible();
    });
  });

  test.describe("References", () => {
    test("should display NI-RADS references", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: "References" }),
      ).toBeVisible();
      await expect(page.getByText("Aiken AH").first()).toBeVisible();
    });

    test("should have reference to NI-RADS white paper", async ({ page }) => {
      const whitePaperLink = page.locator(
        'a[href="https://pubmed.ncbi.nlm.nih.gov/29983244/"]',
      );
      await expect(whitePaperLink).toBeVisible();
      await expect(whitePaperLink).toContainText("J Am Coll Radiol. 2018");
    });

    test("should have reference to validation study", async ({ page }) => {
      const validationLink = page.locator(
        'a[href="https://pubmed.ncbi.nlm.nih.gov/28364010/"]',
      );
      await expect(validationLink).toBeVisible();
      await expect(validationLink).toContainText("AJNR");
    });

    test("should have link to ACR NI-RADS resources", async ({ page }) => {
      // ACR resources link is the 4th reference - expand collapsed references first
      const expandBtn = page.locator(
        '.references-section button:has-text("more reference")',
      );
      if (await expandBtn.isVisible()) {
        await expandBtn.click();
      }

      const acrLink = page.locator(
        'a[href="https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/NI-RADS"]',
      );
      await expect(acrLink).toBeVisible();
    });
  });

  test.describe("Responsiveness and Theme", () => {
    test("should maintain theme consistency", async ({ page }) => {
      await verifyThemeConsistency(page);
    });

    test("should be responsive on mobile devices", async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Verify calculator is still usable on mobile
      await expect(page.getByTestId('calculator-title').first()).toContainText("NI-RADS");
      await expect(page.getByRole('button', { name: 'Calculate' })).toBeVisible();

      // Verify the main content is still accessible
      await expect(page.locator("main")).toBeVisible();

      // Reset to desktop
      await page.setViewportSize({ width: 1280, height: 720 });
    });
  });

  test.describe("MRI v2025 reviewed pathway", () => {
    test("exposes an accessible modality/version selector and switches paths", async ({
      page,
    }) => {
      const selector = page.getByRole("radiogroup", {
        name: "NI-RADS Modality / Version",
      });
      await expect(selector).toBeVisible();
      await expect(selector.getByRole("radio", { name: "2018 CT/PET-CT" })).toBeVisible();
      await expect(selector.getByRole("radio", { name: "2025 MRI" })).toBeVisible();
      await expect(page.getByRole("radiogroup", { name: "Imaging Modality" })).toBeVisible();

      await selector.getByRole("radio", { name: "2025 MRI" }).check();
      await expect(page.getByRole("radiogroup", { name: "Imaging Modality" })).toBeHidden();
      await expect(
        page.getByRole("radiogroup", {
          name: "Is imaging being performed during active treatment?",
        }),
      ).toBeVisible();

      await selector.getByRole("radio", { name: "2018 CT/PET-CT" }).check();
      await expect(page.getByRole("radiogroup", { name: "Imaging Modality" })).toBeVisible();
    });

    test("classifies primary 2a, shows management/provenance, and copies versioned output", async ({
      page,
    }) => {
      await selectRadioOption(page, "2025 MRI");
      await selectRadioOption(page, "No — post-treatment surveillance");
      await selectRadioOption(page, "Primary Site");
      await selectRadioOption(page, "Known primary site");
      await selectRadioOption(page, "Yes — assessable");
      await selectRadioOption(page, "Available now");
      await selectRadioOption(
        page,
        "NI-RADS 2a: Focal reduced diffusion at a superficial or mucosal site",
      );
      await page.getByRole("button", { name: "Calculate" }).click();

      const results = page.getByRole("status", { name: "Calculator results" });
      await expect(results.getByText("2025 MRI")).toBeVisible();
      await expect(results.getByText("2a - Low Suspicion")).toBeVisible();
      await expect(results.getByText("Direct visual inspection.")).toBeVisible();
      await expect(results.getByText("ACR source-provided; ungraded.")).toBeVisible();
      await expect(results.getByText(/no numeric ADC cutoff/i)).toBeVisible();

      await page.evaluate(() => {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async (text) => {
              window.__niradsCopiedText = text;
            },
          },
        });
      });
      await page.getByRole("button", { name: "Copy results" }).click();
      await expect(page.getByRole("button", { name: "Results copied" })).toBeVisible();
      const copied = await page.evaluate(() => window.__niradsCopiedText);
      expect(copied).toContain("Modality / Version: 2025 MRI");
      expect(copied).toContain("Primary Site NI-RADS: 2a - Low Suspicion");
      expect(copied).toContain("Management: Direct visual inspection.");
    });

    test("enforces the category-0 new-baseline guard", async ({ page }) => {
      await selectRadioOption(page, "2025 MRI");
      await selectRadioOption(page, "No — post-treatment surveillance");
      await selectRadioOption(page, "Primary Site");
      await selectRadioOption(page, "Known primary site");
      await selectRadioOption(page, "Yes — assessable");
      await selectRadioOption(page, "Known to exist and pending");
      await selectRadioOption(page, "New post-treatment baseline");
      await page.getByRole("button", { name: "Calculate" }).click();

      let results = page.getByRole("status", { name: "Calculator results" });
      await expect(results.getByText("0 - Incomplete")).toBeVisible();
      await expect(results.getByText(/add the score in an addendum/i)).toBeVisible();

      await selectRadioOption(page, "Subsequent post-treatment study");
      await page.getByRole("button", { name: "Calculate" }).click();
      results = page.getByRole("status", { name: "Calculator results" });
      await expect(results.getByText(/requires a new baseline/i)).toBeVisible();
      await expect(results.getByText("category_0_requires_new_baseline")).toBeVisible();
    });

    test("keeps P-unknown primary, P-x, and N-x distinct from category 0", async ({
      page,
    }) => {
      await selectRadioOption(page, "2025 MRI");
      await selectRadioOption(page, "No — post-treatment surveillance");
      await selectRadioOption(page, "Primary Site");
      await selectRadioOption(page, "Unknown primary (P-unknown primary)");
      await page.getByRole("button", { name: "Calculate" }).click();
      await expect(
        page.getByRole("status", { name: "Calculator results" }).getByText("P-unknown primary"),
      ).toBeVisible();

      await resetCalculator(page);
      await selectRadioOption(page, "2025 MRI");
      await selectRadioOption(page, "No — post-treatment surveillance");
      await selectRadioOption(page, "Primary Site");
      await selectRadioOption(page, "Known primary site");
      await selectRadioOption(page, "No — technically not assessed");
      await selectRadioOption(page, "Artifact");
      await page.getByRole("button", { name: "Calculate" }).click();
      await expect(
        page.getByRole("status", { name: "Calculator results" }).getByText("P-x"),
      ).toBeVisible();

      await resetCalculator(page);
      await selectRadioOption(page, "2025 MRI");
      await selectRadioOption(page, "No — post-treatment surveillance");
      await selectRadioOption(page, "Neck Nodes");
      await selectRadioOption(page, "No — technically not assessed");
      await selectRadioOption(page, "Outside field of view");
      await page.getByRole("button", { name: "Calculate" }).click();
      await expect(
        page.getByRole("status", { name: "Calculator results" }).getByText("N-x"),
      ).toBeVisible();
    });

    test("keeps a new/enlarging node without high-suspicion morphology at neck 2", async ({
      page,
    }) => {
      await selectRadioOption(page, "2025 MRI");
      await selectRadioOption(page, "No — post-treatment surveillance");
      await selectRadioOption(page, "Neck Nodes");
      await selectRadioOption(page, "Yes — assessable");
      await selectRadioOption(page, "Available now");
      await selectRadioOption(page, "New or enlarging node");
      await selectRadioOption(
        page,
        "NI-RADS 2: New/enlarging node without high-suspicion morphology",
      );
      await page.getByRole("button", { name: "Calculate" }).click();

      const results = page.getByRole("status", { name: "Calculator results" });
      await expect(results.getByText("2 - Low Suspicion")).toBeVisible();
      await expect(results.getByText("Short-interval MRI or PET.")).toBeVisible();
    });

    test("fails closed for insufficient inputs and FDG avidity while preventing conflicts", async ({
      page,
    }) => {
      await selectRadioOption(page, "2025 MRI");
      await selectRadioOption(page, "No — post-treatment surveillance");
      await selectRadioOption(page, "Primary Site");
      await selectRadioOption(page, "Known primary site");
      await selectRadioOption(page, "Yes — assessable");
      await selectRadioOption(page, "Available now");
      await page.getByRole("button", { name: "Calculate" }).click();
      let results = page.getByRole("status", { name: "Calculator results" });
      await expect(results.getByText("insufficient_pattern")).toBeVisible();

      const lowPattern = page.getByRole("radio", {
        name: "NI-RADS 2b: Deep ill-defined nonnodular soft tissue",
      });
      const highPattern = page.getByRole("radio", {
        name: "NI-RADS 3: Discrete new/enlarging mass matching the original tumor's MRI features",
      });
      await lowPattern.check();
      await highPattern.check();
      await expect(lowPattern).not.toBeChecked();
      await expect(highPattern).toBeChecked();

      await resetCalculator(page);
      await selectRadioOption(page, "2025 MRI");
      await selectRadioOption(page, "No — post-treatment surveillance");
      await selectRadioOption(page, "Neck Nodes");
      await selectRadioOption(page, "Yes — assessable");
      await selectRadioOption(page, "Available now");
      await selectRadioOption(page, "No temporal qualifier needed");
      await selectRadioOption(
        page,
        "NI-RADS 2: PET/MRI discordance when the original tumor was FDG avid",
      );

      await page.getByRole("button", { name: "Calculate" }).click();
      results = page.getByRole("status", { name: "Calculator results" });
      await expect(
        results.getByText("discordance_rule_requires_original_fdg_avid"),
      ).toBeVisible();

      await selectRadioOption(page, "No — not FDG avid");
      await page.getByRole("button", { name: "Calculate" }).click();
      await expect(
        results.getByText("discordance_rule_requires_original_fdg_avid"),
      ).toBeVisible();

      await selectRadioOption(page, "Unknown");
      await page.getByRole("button", { name: "Calculate" }).click();
      await expect(
        results.getByText("discordance_rule_requires_original_fdg_avid"),
      ).toBeVisible();
    });

    test("does not expose archived 1f/2f categories or a numeric ADC cutoff", async ({
      page,
    }) => {
      await selectRadioOption(page, "2025 MRI");
      const formText = await page.locator("main").innerText();
      expect(formText).not.toMatch(/NI-RADS\s+(?:1f|2f)\b/);
      expect(formText).not.toMatch(/ADC\s*(?:<|>|≤|≥|=)|\b\d+(?:\.\d+)?\s*mm²/i);
    });

    test("preserves the explicit 2018 CT/PET-CT result on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await selectRadioOption(page, "2018 CT/PET-CT");
      await selectRadioOption(page, "Contrast-Enhanced CT");
      await selectRadioOption(page, "Yes - prior available");
      await selectRadioOption(
        page,
        "Expected post-treatment changes only (distortion, scar, diffuse linear enhancement)",
      );
      await selectRadioOption(page, "No abnormal lymph nodes");
      await page.getByRole("button", { name: "Calculate" }).click();

      const results = page.getByRole("status", { name: "Calculator results" });
      await expect(results.getByText("1 - No Evidence of Recurrence").first()).toBeVisible();
      await expect(results.getByText("~4%")).toBeVisible();
      await expect(results).not.toContainText("2025 MRI");
    });
  });
});
