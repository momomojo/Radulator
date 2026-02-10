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
        page.getByText("Alberta Stroke Program Early CT Score").first(),
      ).toBeVisible();
    });

    test("should display info section with ASPECTS explanation", async ({
      page,
    }) => {
      await expect(page.getByText("10 regions").first()).toBeVisible();
      await expect(page.getByText("GANGLIONIC LEVEL").first()).toBeVisible();
      await expect(
        page.getByText("SUPRAGANGLIONIC LEVEL").first(),
      ).toBeVisible();
    });

    test("should have all 10 brain region checkboxes", async ({ page }) => {
      // Subcortical structures
      await expect(page.locator('label[for="caudate"]')).toBeVisible();
      await expect(page.locator('label[for="lentiform"]')).toBeVisible();
      await expect(page.locator('label[for="internal_capsule"]')).toBeVisible();
      await expect(page.locator('label[for="insular"]')).toBeVisible();

      // Ganglionic level cortical
      await expect(page.locator('label[for="m1"]')).toBeVisible();
      await expect(page.locator('label[for="m2"]')).toBeVisible();
      await expect(page.locator('label[for="m3"]')).toBeVisible();

      // Supraganglionic level
      await expect(page.locator('label[for="m4"]')).toBeVisible();
      await expect(page.locator('label[for="m5"]')).toBeVisible();
      await expect(page.locator('label[for="m6"]')).toBeVisible();
    });

    test("should have laterality selection", async ({ page }) => {
      await expect(page.getByText("Affected Hemisphere").first()).toBeVisible();
      await expect(page.locator('label[for="laterality-left"]')).toBeVisible();
      await expect(page.locator('label[for="laterality-right"]')).toBeVisible();
    });

    test("should have optional time from onset field", async ({ page }) => {
      await expect(page.getByText("Time from Symptom Onset")).toBeVisible();
    });
  });

  test.describe("ASPECTS 10/10 - Normal CT", () => {
    test("should calculate ASPECTS 10 when no regions affected", async ({
      page,
    }) => {
      await page.locator('label[for="laterality-left"]').click();
      // Don't check any region checkboxes
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=ASPECTS Score").first()).toBeVisible();
      await expect(results.locator("text=10 / 10").first()).toBeVisible();
      await expect(
        results.locator("text=Small or no early ischemic changes").first(),
      ).toBeVisible();
      await expect(
        results.locator("text=No regions affected").first(),
      ).toBeVisible();
      await expect(
        results
          .locator("text=Good candidate for mechanical thrombectomy")
          .first(),
      ).toBeVisible();
    });

    test("should show note about subtle changes within first 3 hours", async ({
      page,
    }) => {
      await page.locator('label[for="laterality-left"]').click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results
          .locator("text=Subtle changes may be missed within first 3 hours")
          .first(),
      ).toBeVisible();
    });
  });

  test.describe("ASPECTS 8-10 - Favorable Prognosis", () => {
    test("should calculate ASPECTS 9 with one region affected", async ({
      page,
    }) => {
      await page.locator('label[for="laterality-left"]').click();
      await page.locator('label[for="insular"]').click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=9 / 10").first()).toBeVisible();
      await expect(
        results.locator("text=1 region(s): I (Insular)").first(),
      ).toBeVisible();
      await expect(
        results
          .locator("text=Favorable prognosis with reperfusion therapy")
          .first(),
      ).toBeVisible();
    });

    test("should calculate ASPECTS 8 with two regions affected", async ({
      page,
    }) => {
      await page.locator('label[for="laterality-right"]').click();
      await page.locator('label[for="insular"]').click();
      await page.locator('label[for="lentiform"]').click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=8 / 10").first()).toBeVisible();
      await expect(results.locator("text=2 region(s)").first()).toBeVisible();
      await expect(
        results
          .locator("text=Good candidate for mechanical thrombectomy")
          .first(),
      ).toBeVisible();
    });
  });

  test.describe("ASPECTS 6-7 - Standard Thrombectomy Threshold", () => {
    test("should calculate ASPECTS 6 and confirm thrombectomy eligibility", async ({
      page,
    }) => {
      await page.locator('label[for="laterality-left"]').click();
      // Select 4 regions (10 - 4 = 6)
      await page.locator('label[for="caudate"]').click();
      await page.locator('label[for="lentiform"]').click();
      await page.locator('label[for="internal_capsule"]').click();
      await page.locator('label[for="insular"]').click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=6 / 10").first()).toBeVisible();
      await expect(
        results.locator("text=Moderate early ischemic changes").first(),
      ).toBeVisible();
      await expect(results.locator("text=ASPECTS >= 6").first()).toBeVisible();
      await expect(
        results.locator("text=MR CLEAN, ESCAPE").first(),
      ).toBeVisible();
    });

    test("should show regional breakdown correctly", async ({ page }) => {
      await page.locator('label[for="laterality-left"]').click();
      await page.locator('label[for="caudate"]').click();
      await page.locator('label[for="lentiform"]').click();
      await page.locator('label[for="internal_capsule"]').click();
      await page.locator('label[for="insular"]').click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=Subcortical: 4/4").first(),
      ).toBeVisible();
      await expect(
        results.locator("text=Ganglionic cortical").first(),
      ).toBeVisible();
      await expect(
        results.locator("text=Supraganglionic").first(),
      ).toBeVisible();
    });
  });

  test.describe("ASPECTS 3-5 - Large Core", () => {
    test("should calculate ASPECTS 5 and reference large core trials", async ({
      page,
    }) => {
      await page.locator('label[for="laterality-left"]').click();
      // Select 5 regions (10 - 5 = 5)
      await page.locator('label[for="caudate"]').click();
      await page.locator('label[for="lentiform"]').click();
      await page.locator('label[for="internal_capsule"]').click();
      await page.locator('label[for="insular"]').click();
      await page.locator('label[for="m1"]').click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=5 / 10").first()).toBeVisible();
      await expect(
        results.locator("text=Large infarct core").first(),
      ).toBeVisible();
      await expect(results.locator("text=SELECT2").first()).toBeVisible();
      await expect(results.locator("text=ANGEL-ASPECT").first()).toBeVisible();
      await expect(
        results.locator("text=RESCUE-Japan LIMIT").first(),
      ).toBeVisible();
    });

    test("should calculate ASPECTS 3", async ({ page }) => {
      await page.locator('label[for="laterality-left"]').click();
      // Select 7 regions (10 - 7 = 3)
      await page.locator('label[for="caudate"]').click();
      await page.locator('label[for="lentiform"]').click();
      await page.locator('label[for="internal_capsule"]').click();
      await page.locator('label[for="insular"]').click();
      await page.locator('label[for="m1"]').click();
      await page.locator('label[for="m2"]').click();
      await page.locator('label[for="m3"]').click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=3 / 10").first()).toBeVisible();
      await expect(
        results.locator("text=Higher risk of symptomatic hemorrhage").first(),
      ).toBeVisible();
    });
  });

  test.describe("ASPECTS 0-2 - Very Large Core", () => {
    test("should calculate ASPECTS 2 and show poor prognosis", async ({
      page,
    }) => {
      await page.locator('label[for="laterality-left"]').click();
      // Select 8 regions (10 - 8 = 2)
      await page.locator('label[for="caudate"]').click();
      await page.locator('label[for="lentiform"]').click();
      await page.locator('label[for="internal_capsule"]').click();
      await page.locator('label[for="insular"]').click();
      await page.locator('label[for="m1"]').click();
      await page.locator('label[for="m2"]').click();
      await page.locator('label[for="m3"]').click();
      await page.locator('label[for="m4"]').click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=2 / 10").first()).toBeVisible();
      await expect(
        results.locator("text=Very large infarct core").first(),
      ).toBeVisible();
      await expect(
        results.locator("text=Poor prognosis").first(),
      ).toBeVisible();
      await expect(results.locator("text=goals of care").first()).toBeVisible();
    });

    test("should calculate ASPECTS 0 with complete MCA involvement", async ({
      page,
    }) => {
      await page.locator('label[for="laterality-left"]').click();
      // Select all 10 regions
      await page.locator('label[for="caudate"]').click();
      await page.locator('label[for="lentiform"]').click();
      await page.locator('label[for="internal_capsule"]').click();
      await page.locator('label[for="insular"]').click();
      await page.locator('label[for="m1"]').click();
      await page.locator('label[for="m2"]').click();
      await page.locator('label[for="m3"]').click();
      await page.locator('label[for="m4"]').click();
      await page.locator('label[for="m5"]').click();
      await page.locator('label[for="m6"]').click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=0 / 10").first()).toBeVisible();
      await expect(results.locator("text=10 region(s)").first()).toBeVisible();
    });
  });

  test.describe("Time Window Assessment", () => {
    test("should show standard 6-hour window guidance", async ({ page }) => {
      await page.locator('label[for="laterality-left"]').click();
      await page.locator('label[for="insular"]').click();
      await page.fill('input[id="time_from_onset"]', "4");
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=4 hours").first()).toBeVisible();
      await expect(
        results.locator("text=Within standard 6-hour window").first(),
      ).toBeVisible();
    });

    test("should show DEFUSE-3 criteria for 6-16 hours", async ({ page }) => {
      await page.locator('label[for="laterality-left"]').click();
      await page.locator('label[for="insular"]').click();
      await page.locator('label[for="lentiform"]').click();
      await page.fill('input[id="time_from_onset"]', "12");
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=12 hours").first()).toBeVisible();
      await expect(results.locator("text=DEFUSE-3").first()).toBeVisible();
      await expect(results.locator("text=6-16 hours").first()).toBeVisible();
    });

    test("should show DAWN trial criteria for 6-24 hours", async ({ page }) => {
      await page.locator('label[for="laterality-left"]').click();
      await page.locator('label[for="insular"]').click();
      await page.fill('input[id="time_from_onset"]', "20");
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=20 hours").first()).toBeVisible();
      await expect(results.locator("text=DAWN").first()).toBeVisible();
      await expect(
        results.locator("text=clinical-imaging mismatch").first(),
      ).toBeVisible();
    });

    test("should warn about exceeding 24-hour window", async ({ page }) => {
      await page.locator('label[for="laterality-left"]').click();
      await page.fill('input[id="time_from_onset"]', "30");
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results
          .locator("text=Beyond standard thrombectomy time windows")
          .first(),
      ).toBeVisible();
    });

    test("should note DEFUSE-3 excluded ASPECTS < 6", async ({ page }) => {
      await page.locator('label[for="laterality-left"]').click();
      // ASPECTS 5
      await page.locator('label[for="caudate"]').click();
      await page.locator('label[for="lentiform"]').click();
      await page.locator('label[for="internal_capsule"]').click();
      await page.locator('label[for="insular"]').click();
      await page.locator('label[for="m1"]').click();
      await page.fill('input[id="time_from_onset"]', "10");
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=DEFUSE-3 excluded ASPECTS < 6").first(),
      ).toBeVisible();
    });
  });

  test.describe("Clinical Pattern Notes", () => {
    test("should show proximal M1 occlusion note for insular + lentiform involvement", async ({
      page,
    }) => {
      await page.locator('label[for="laterality-left"]').click();
      await page.locator('label[for="insular"]').click();
      await page.locator('label[for="lentiform"]').click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results
          .locator("text=proximal M1 occlusion with poor collaterals")
          .first(),
      ).toBeVisible();
    });

    test("should show lenticulostriate note for caudate + internal capsule involvement", async ({
      page,
    }) => {
      await page.locator('label[for="laterality-left"]').click();
      await page.locator('label[for="caudate"]').click();
      await page.locator('label[for="internal_capsule"]').click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=lenticulostriate artery territory").first(),
      ).toBeVisible();
    });

    test("should show complete cortical involvement note", async ({ page }) => {
      await page.locator('label[for="laterality-left"]').click();
      await page.locator('label[for="m1"]').click();
      await page.locator('label[for="m2"]').click();
      await page.locator('label[for="m3"]').click();
      await page.locator('label[for="m4"]').click();
      await page.locator('label[for="m5"]').click();
      await page.locator('label[for="m6"]').click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=Complete cortical MCA involvement").first(),
      ).toBeVisible();
      await expect(
        results.locator("text=very poor collateral circulation").first(),
      ).toBeVisible();
    });
  });

  test.describe("Guideline Thresholds", () => {
    test("should display AHA/ASA guideline thresholds", async ({ page }) => {
      await page.locator('label[for="laterality-left"]').click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=Standard EVT: ASPECTS >= 6").first(),
      ).toBeVisible();
      await expect(results.locator("text=2019 AHA/ASA").first()).toBeVisible();
    });

    test("should display large core trial thresholds", async ({ page }) => {
      await page.locator('label[for="laterality-left"]').click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=Large Core EVT: ASPECTS 3-5").first(),
      ).toBeVisible();
      await expect(results.locator("text=2022-2023").first()).toBeVisible();
    });
  });

  test.describe("Input Validation and Edge Cases", () => {
    test("should handle right hemisphere selection", async ({ page }) => {
      await page.locator('label[for="laterality-right"]').click();
      await page.locator('label[for="insular"]').click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=9 / 10").first()).toBeVisible();
      await expect(
        results.locator("text=Affected Hemisphere").first(),
      ).toBeVisible();
      await expect(results.locator("text=Right").first()).toBeVisible();
    });

    test("should handle calculation without laterality specified", async ({
      page,
    }) => {
      await page.locator('label[for="insular"]').click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      // Should still calculate
      await expect(results.locator("text=9 / 10").first()).toBeVisible();
    });

    test("should handle decimal time from onset", async ({ page }) => {
      await page.locator('label[for="laterality-left"]').click();
      await page.fill('input[id="time_from_onset"]', "4.5");
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=4.5 hours").first()).toBeVisible();
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
      // DEFUSE-3 is the 4th reference (index 3), hidden by default
      const refsSection = page.locator(".references-section");
      const expandBtn = refsSection.locator(
        'button:has-text("more reference")',
      );
      if (await expandBtn.isVisible()) {
        await expandBtn.click();
      }
      const defuseLink = page.locator('a[href*="NEJMoa1713973"]');
      await expect(defuseLink).toBeVisible();
    });

    test("should have references to large core trials", async ({ page }) => {
      // SELECT2, ANGEL-ASPECT, RESCUE-Japan are references 5-7 (index 4-6), hidden by default
      const refsSection = page.locator(".references-section");
      const expandBtn = refsSection.locator(
        'button:has-text("more reference")',
      );
      if (await expandBtn.isVisible()) {
        await expandBtn.click();
      }
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
