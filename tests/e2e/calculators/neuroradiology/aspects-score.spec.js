/**
 * ASPECTS Score Calculator - E2E Tests
 *
 * Tests the Alberta Stroke Program Early CT Score calculator for acute
 * MCA territory stroke assessment.
 *
 * Test Coverage:
 * - Score range 0-10 (10 regions)
 * - Regional breakdown (subcortical, ganglionic cortical, supraganglionic)
 * - Thrombectomy eligibility thresholds (ASPECTS >= 6)
 * - Extended time window guidance (DAWN, DEFUSE-3)
 * - Large core trial references (SELECT2, ANGEL-ASPECT)
 * - Laterality selection
 * - Clinical pattern recognition notes
 * - Reference verification
 */

import { test, expect } from "@playwright/test";
import {
  navigateToCalculator,
  verifyReferenceLinks,
  verifyThemeConsistency,
  verifyMobileResponsive,
} from "../../../helpers/calculator-test-helper.js";

const CALCULATOR_NAME = "ASPECTS Score";

test.describe("ASPECTS Score Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, CALCULATOR_NAME);

    // Verify calculator loaded
    await expect(page.locator("h2")).toContainText("ASPECTS Score");
  });

  test.describe("Visual and UI Tests", () => {
    test("should display calculator with correct title and description", async ({
      page,
    }) => {
      await expect(page.locator("h2")).toContainText("ASPECTS Score");
      await expect(
        page.getByText("Alberta Stroke Program Early CT Score"),
      ).toBeVisible();
    });

    test("should display info section with ASPECTS explanation", async ({
      page,
    }) => {
      await expect(page.getByText("10 regions")).toBeVisible();
      await expect(page.getByText("GANGLIONIC LEVEL")).toBeVisible();
      await expect(page.getByText("SUPRAGANGLIONIC LEVEL")).toBeVisible();
    });

    test("should have all 10 brain region checkboxes", async ({ page }) => {
      // Subcortical structures
      await expect(page.getByText("C - Caudate Head")).toBeVisible();
      await expect(page.getByText("L - Lentiform Nucleus")).toBeVisible();
      await expect(page.getByText("IC - Internal Capsule")).toBeVisible();
      await expect(page.getByText("I - Insular Ribbon")).toBeVisible();

      // Ganglionic level cortical
      await expect(page.getByText("M1 - Anterior MCA Cortex")).toBeVisible();
      await expect(page.getByText("M2 - Lateral MCA Cortex")).toBeVisible();
      await expect(page.getByText("M3 - Posterior MCA Cortex")).toBeVisible();

      // Supraganglionic level
      await expect(
        page.getByText("M4 - Anterior MCA Territory (Supraganglionic)"),
      ).toBeVisible();
      await expect(
        page.getByText("M5 - Lateral MCA Territory (Supraganglionic)"),
      ).toBeVisible();
      await expect(
        page.getByText("M6 - Posterior MCA Territory (Supraganglionic)"),
      ).toBeVisible();
    });

    test("should have laterality selection", async ({ page }) => {
      await expect(page.getByText("Affected Hemisphere")).toBeVisible();
      await expect(page.getByText("Left hemisphere")).toBeVisible();
      await expect(page.getByText("Right hemisphere")).toBeVisible();
    });

    test("should have optional time from onset field", async ({ page }) => {
      await expect(page.getByText("Time from Symptom Onset")).toBeVisible();
    });
  });

  test.describe("ASPECTS 10/10 - Normal CT", () => {
    test("should calculate ASPECTS 10 when no regions affected", async ({
      page,
    }) => {
      await page.getByText("Left hemisphere").click();
      // Don't check any region checkboxes
      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=ASPECTS Score")).toBeVisible();
      await expect(page.locator("text=10 / 10")).toBeVisible();
      await expect(
        page.locator("text=Small or no early ischemic changes"),
      ).toBeVisible();
      await expect(page.locator("text=No regions affected")).toBeVisible();
      await expect(
        page.locator("text=Good candidate for mechanical thrombectomy"),
      ).toBeVisible();
    });

    test("should show note about subtle changes within first 3 hours", async ({
      page,
    }) => {
      await page.getByText("Left hemisphere").click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Subtle changes may be missed within first 3 hours"),
      ).toBeVisible();
    });
  });

  test.describe("ASPECTS 8-10 - Favorable Prognosis", () => {
    test("should calculate ASPECTS 9 with one region affected", async ({
      page,
    }) => {
      await page.getByText("Left hemisphere").click();
      await page.getByText("I - Insular Ribbon").click();
      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=9 / 10")).toBeVisible();
      await expect(page.locator("text=1 region(s): I (Insular)")).toBeVisible();
      await expect(
        page.locator("text=Favorable prognosis with reperfusion therapy"),
      ).toBeVisible();
    });

    test("should calculate ASPECTS 8 with two regions affected", async ({
      page,
    }) => {
      await page.getByText("Right hemisphere").click();
      await page.getByText("I - Insular Ribbon").click();
      await page.getByText("L - Lentiform Nucleus").click();
      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=8 / 10")).toBeVisible();
      await expect(page.locator("text=2 region(s)")).toBeVisible();
      await expect(
        page.locator("text=Good candidate for mechanical thrombectomy"),
      ).toBeVisible();
    });
  });

  test.describe("ASPECTS 6-7 - Standard Thrombectomy Threshold", () => {
    test("should calculate ASPECTS 6 and confirm thrombectomy eligibility", async ({
      page,
    }) => {
      await page.getByText("Left hemisphere").click();
      // Select 4 regions (10 - 4 = 6)
      await page.getByText("C - Caudate Head").click();
      await page.getByText("L - Lentiform Nucleus").click();
      await page.getByText("IC - Internal Capsule").click();
      await page.getByText("I - Insular Ribbon").click();
      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=6 / 10")).toBeVisible();
      await expect(
        page.locator("text=Moderate early ischemic changes"),
      ).toBeVisible();
      await expect(page.locator("text=ASPECTS >= 6")).toBeVisible();
      await expect(page.locator("text=MR CLEAN, ESCAPE")).toBeVisible();
    });

    test("should show regional breakdown correctly", async ({ page }) => {
      await page.getByText("Left hemisphere").click();
      await page.getByText("C - Caudate Head").click();
      await page.getByText("L - Lentiform Nucleus").click();
      await page.getByText("IC - Internal Capsule").click();
      await page.getByText("I - Insular Ribbon").click();
      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Subcortical: 4/4")).toBeVisible();
      await expect(page.locator("text=Ganglionic cortical")).toBeVisible();
      await expect(page.locator("text=Supraganglionic")).toBeVisible();
    });
  });

  test.describe("ASPECTS 3-5 - Large Core", () => {
    test("should calculate ASPECTS 5 and reference large core trials", async ({
      page,
    }) => {
      await page.getByText("Left hemisphere").click();
      // Select 5 regions (10 - 5 = 5)
      await page.getByText("C - Caudate Head").click();
      await page.getByText("L - Lentiform Nucleus").click();
      await page.getByText("IC - Internal Capsule").click();
      await page.getByText("I - Insular Ribbon").click();
      await page.getByText("M1 - Anterior MCA Cortex").click();
      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=5 / 10")).toBeVisible();
      await expect(page.locator("text=Large infarct core")).toBeVisible();
      await expect(page.locator("text=SELECT2")).toBeVisible();
      await expect(page.locator("text=ANGEL-ASPECT")).toBeVisible();
      await expect(page.locator("text=RESCUE-Japan LIMIT")).toBeVisible();
    });

    test("should calculate ASPECTS 3", async ({ page }) => {
      await page.getByText("Left hemisphere").click();
      // Select 7 regions (10 - 7 = 3)
      await page.getByText("C - Caudate Head").click();
      await page.getByText("L - Lentiform Nucleus").click();
      await page.getByText("IC - Internal Capsule").click();
      await page.getByText("I - Insular Ribbon").click();
      await page.getByText("M1 - Anterior MCA Cortex").click();
      await page.getByText("M2 - Lateral MCA Cortex").click();
      await page.getByText("M3 - Posterior MCA Cortex").click();
      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=3 / 10")).toBeVisible();
      await expect(
        page.locator("text=Higher risk of symptomatic hemorrhage"),
      ).toBeVisible();
    });
  });

  test.describe("ASPECTS 0-2 - Very Large Core", () => {
    test("should calculate ASPECTS 2 and show poor prognosis", async ({
      page,
    }) => {
      await page.getByText("Left hemisphere").click();
      // Select 8 regions (10 - 8 = 2)
      await page.getByText("C - Caudate Head").click();
      await page.getByText("L - Lentiform Nucleus").click();
      await page.getByText("IC - Internal Capsule").click();
      await page.getByText("I - Insular Ribbon").click();
      await page.getByText("M1 - Anterior MCA Cortex").click();
      await page.getByText("M2 - Lateral MCA Cortex").click();
      await page.getByText("M3 - Posterior MCA Cortex").click();
      await page.getByText("M4 - Anterior MCA Territory").click();
      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=2 / 10")).toBeVisible();
      await expect(page.locator("text=Very large infarct core")).toBeVisible();
      await expect(page.locator("text=Poor prognosis")).toBeVisible();
      await expect(page.locator("text=goals of care")).toBeVisible();
    });

    test("should calculate ASPECTS 0 with complete MCA involvement", async ({
      page,
    }) => {
      await page.getByText("Left hemisphere").click();
      // Select all 10 regions
      await page.getByText("C - Caudate Head").click();
      await page.getByText("L - Lentiform Nucleus").click();
      await page.getByText("IC - Internal Capsule").click();
      await page.getByText("I - Insular Ribbon").click();
      await page.getByText("M1 - Anterior MCA Cortex").click();
      await page.getByText("M2 - Lateral MCA Cortex").click();
      await page.getByText("M3 - Posterior MCA Cortex").click();
      await page.getByText("M4 - Anterior MCA Territory").click();
      await page.getByText("M5 - Lateral MCA Territory").click();
      await page.getByText("M6 - Posterior MCA Territory").click();
      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=0 / 10")).toBeVisible();
      await expect(page.locator("text=10 region(s)")).toBeVisible();
    });
  });

  test.describe("Time Window Assessment", () => {
    test("should show standard 6-hour window guidance", async ({ page }) => {
      await page.getByText("Left hemisphere").click();
      await page.getByText("I - Insular Ribbon").click();
      await page.fill('input[id="time_from_onset"]', "4");
      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=4 hours")).toBeVisible();
      await expect(
        page.locator("text=Within standard 6-hour window"),
      ).toBeVisible();
    });

    test("should show DEFUSE-3 criteria for 6-16 hours", async ({ page }) => {
      await page.getByText("Left hemisphere").click();
      await page.getByText("I - Insular Ribbon").click();
      await page.getByText("L - Lentiform Nucleus").click();
      await page.fill('input[id="time_from_onset"]', "12");
      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=12 hours")).toBeVisible();
      await expect(page.locator("text=DEFUSE-3")).toBeVisible();
      await expect(page.locator("text=6-16 hours")).toBeVisible();
    });

    test("should show DAWN trial criteria for 6-24 hours", async ({ page }) => {
      await page.getByText("Left hemisphere").click();
      await page.getByText("I - Insular Ribbon").click();
      await page.fill('input[id="time_from_onset"]', "20");
      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=20 hours")).toBeVisible();
      await expect(page.locator("text=DAWN")).toBeVisible();
      await expect(
        page.locator("text=clinical-imaging mismatch"),
      ).toBeVisible();
    });

    test("should warn about exceeding 24-hour window", async ({ page }) => {
      await page.getByText("Left hemisphere").click();
      await page.fill('input[id="time_from_onset"]', "30");
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Beyond standard thrombectomy time windows"),
      ).toBeVisible();
    });

    test("should note DEFUSE-3 excluded ASPECTS < 6", async ({ page }) => {
      await page.getByText("Left hemisphere").click();
      // ASPECTS 5
      await page.getByText("C - Caudate Head").click();
      await page.getByText("L - Lentiform Nucleus").click();
      await page.getByText("IC - Internal Capsule").click();
      await page.getByText("I - Insular Ribbon").click();
      await page.getByText("M1 - Anterior MCA Cortex").click();
      await page.fill('input[id="time_from_onset"]', "10");
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=DEFUSE-3 excluded ASPECTS < 6"),
      ).toBeVisible();
    });
  });

  test.describe("Clinical Pattern Notes", () => {
    test("should show proximal M1 occlusion note for insular + lentiform involvement", async ({
      page,
    }) => {
      await page.getByText("Left hemisphere").click();
      await page.getByText("I - Insular Ribbon").click();
      await page.getByText("L - Lentiform Nucleus").click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=proximal M1 occlusion with poor collaterals"),
      ).toBeVisible();
    });

    test("should show lenticulostriate note for caudate + internal capsule involvement", async ({
      page,
    }) => {
      await page.getByText("Left hemisphere").click();
      await page.getByText("C - Caudate Head").click();
      await page.getByText("IC - Internal Capsule").click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=lenticulostriate artery territory"),
      ).toBeVisible();
    });

    test("should show complete cortical involvement note", async ({ page }) => {
      await page.getByText("Left hemisphere").click();
      await page.getByText("M1 - Anterior MCA Cortex").click();
      await page.getByText("M2 - Lateral MCA Cortex").click();
      await page.getByText("M3 - Posterior MCA Cortex").click();
      await page.getByText("M4 - Anterior MCA Territory").click();
      await page.getByText("M5 - Lateral MCA Territory").click();
      await page.getByText("M6 - Posterior MCA Territory").click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Complete cortical MCA involvement"),
      ).toBeVisible();
      await expect(
        page.locator("text=very poor collateral circulation"),
      ).toBeVisible();
    });
  });

  test.describe("Guideline Thresholds", () => {
    test("should display AHA/ASA guideline thresholds", async ({ page }) => {
      await page.getByText("Left hemisphere").click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Standard EVT: ASPECTS >= 6"),
      ).toBeVisible();
      await expect(page.locator("text=2019 AHA/ASA")).toBeVisible();
    });

    test("should display large core trial thresholds", async ({ page }) => {
      await page.getByText("Left hemisphere").click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Large Core EVT: ASPECTS 3-5"),
      ).toBeVisible();
      await expect(page.locator("text=2022-2023")).toBeVisible();
    });
  });

  test.describe("Input Validation and Edge Cases", () => {
    test("should handle right hemisphere selection", async ({ page }) => {
      await page.getByText("Right hemisphere").click();
      await page.getByText("I - Insular Ribbon").click();
      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=9 / 10")).toBeVisible();
      await expect(page.locator("text=Affected Hemisphere")).toBeVisible();
      await expect(page.locator("text=Right")).toBeVisible();
    });

    test("should handle calculation without laterality specified", async ({
      page,
    }) => {
      await page.getByText("I - Insular Ribbon").click();
      await page.click('button:has-text("Calculate")');

      // Should still calculate
      await expect(page.locator("text=9 / 10")).toBeVisible();
    });

    test("should handle decimal time from onset", async ({ page }) => {
      await page.getByText("Left hemisphere").click();
      await page.fill('input[id="time_from_onset"]', "4.5");
      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=4.5 hours")).toBeVisible();
    });
  });

  test.describe("References", () => {
    test("should display ASPECTS references", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: "References" }),
      ).toBeVisible();
      await expect(page.getByText("Barber PA").first()).toBeVisible();
    });

    test("should have reference to original ASPECTS publication", async ({
      page,
    }) => {
      const lancetLink = page.locator('a[href*="S0140-6736"]');
      await expect(lancetLink).toBeVisible();
      await expect(lancetLink).toContainText("Lancet");
    });

    test("should have reference to DAWN trial", async ({ page }) => {
      const dawnLink = page.locator('a[href*="NEJMoa1706442"]');
      await expect(dawnLink).toBeVisible();
    });

    test("should have reference to DEFUSE-3 trial", async ({ page }) => {
      const defuseLink = page.locator('a[href*="NEJMoa1713973"]');
      await expect(defuseLink).toBeVisible();
    });

    test("should have references to large core trials", async ({ page }) => {
      await expect(page.getByText("SELECT2").first()).toBeVisible();
      await expect(page.getByText("ANGEL-ASPECT").first()).toBeVisible();
      await expect(page.getByText("RESCUE-Japan").first()).toBeVisible();
    });
  });

  test.describe("Responsiveness and Theme", () => {
    test("should maintain theme consistency", async ({ page }) => {
      await verifyThemeConsistency(page);
    });

    test("should be responsive on mobile devices", async ({ page }) => {
      await verifyMobileResponsive(page);

      // Verify calculator is still usable on mobile
      await expect(page.locator("h2")).toContainText("ASPECTS");
      await expect(page.locator('button:has-text("Calculate")')).toBeVisible();
    });
  });
});
