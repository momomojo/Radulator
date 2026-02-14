/**
 * AAST Trauma Grading Calculator - E2E Tests
 *
 * Tests the AAST-OIS solid organ injury grading calculator for
 * liver, spleen, kidney, and pancreas trauma.
 *
 * Test Coverage:
 * - Liver injury grading (Grades I-V)
 * - Spleen injury grading (Grades I-V)
 * - Kidney injury grading (Grades I-V, 2018 and 2025 OIS)
 * - Pancreas injury grading (Grades I-V, 2024 OIS)
 * - Vascular injury criteria
 * - Ductal injury grading (pancreas)
 * - Multiple injury advancement rule
 * - Management recommendations (WSES guidelines)
 * - Hemodynamic stability warnings
 * - Input validation
 * - Reference verification
 */

import { test, expect } from "@playwright/test";
import {
  navigateToCalculator,
  verifyThemeConsistency,
  verifyMobileResponsive,
} from "../../../helpers/calculator-test-helper.js";

const CALCULATOR_NAME = "AAST Trauma Grading";

test.describe("AAST Trauma Grading Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, CALCULATOR_NAME);

    // Verify calculator loaded
    await expect(page.locator("h2")).toContainText("AAST Trauma Grading");
  });

  test.describe("Visual and UI Tests", () => {
    test("should display calculator with correct title and description", async ({
      page,
    }) => {
      await expect(page.locator("h2")).toContainText("AAST Trauma Grading");
      await expect(
        page.getByText("AAST-OIS solid organ").first(),
      ).toBeVisible();
    });

    test("should display info section with grading explanation", async ({
      page,
    }) => {
      await expect(page.getByText("Grade I").first()).toBeVisible();
      await expect(page.getByText("Grade V").first()).toBeVisible();
      await expect(page.getByText("Ductal integrity").first()).toBeVisible();
    });

    test("should have organ selection", async ({ page }) => {
      await expect(page.getByText("Injured Organ").first()).toBeVisible();
      await expect(
        page.getByText("Liver", { exact: true }).first(),
      ).toBeVisible();
      await expect(
        page.getByText("Spleen", { exact: true }).first(),
      ).toBeVisible();
      await expect(
        page.getByText("Kidney", { exact: true }).first(),
      ).toBeVisible();
      await expect(
        page.getByText("Pancreas", { exact: true }).first(),
      ).toBeVisible();
    });

    test("should have multiple injuries checkbox", async ({ page }) => {
      await expect(
        page.getByText("Multiple Injuries in Same Organ").first(),
      ).toBeVisible();
    });
  });

  test.describe("Liver Injury Grading", () => {
    test.beforeEach(async ({ page }) => {
      await page.getByText("Liver", { exact: true }).click();
    });

    test("should show liver-specific fields when liver selected", async ({
      page,
    }) => {
      await expect(page.getByText("Liver Hematoma").first()).toBeVisible();
      await expect(page.getByText("Liver Laceration").first()).toBeVisible();
      await expect(
        page.getByText("Liver Vascular Injury").first(),
      ).toBeVisible();
    });

    test("should classify Grade I liver injury - subcapsular hematoma <10%", async ({
      page,
    }) => {
      await page.getByText("Subcapsular, <10% surface area").click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 1").first()).toBeVisible();
      await expect(results.locator("text=Liver").first()).toBeVisible();
      await expect(results.locator("text=Minor").first()).toBeVisible();
      await expect(
        results.locator("text=Non-operative management").first(),
      ).toBeVisible();
    });

    test("should classify Grade I liver injury - capsular tear <1cm", async ({
      page,
    }) => {
      await page.getByText("Capsular tear, <1 cm parenchymal depth").click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 1").first()).toBeVisible();
      await expect(results.locator("text=Capsular tear").first()).toBeVisible();
    });

    test("should classify Grade II liver injury - laceration 1-3 cm", async ({
      page,
    }) => {
      await page.getByText("1-3 cm parenchymal depth, <10 cm length").click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 2").first()).toBeVisible();
      await expect(results.locator("text=Moderate").first()).toBeVisible();
    });

    test("should classify Grade III liver injury - deep laceration >3cm", async ({
      page,
    }) => {
      await page.getByText(">3 cm parenchymal depth").click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 3").first()).toBeVisible();
      await expect(results.locator("text=Serious").first()).toBeVisible();
      await expect(
        results.locator("text=angioembolization").first(),
      ).toBeVisible();
    });

    test("should classify Grade III liver injury - contained active bleeding", async ({
      page,
    }) => {
      await page
        .getByText("Active bleeding contained within liver parenchyma")
        .click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 3").first()).toBeVisible();
      await expect(results.locator("text=contained").first()).toBeVisible();
    });

    test("should classify Grade IV liver injury - 25-75% lobe disruption", async ({
      page,
    }) => {
      await page
        .getByText("Parenchymal disruption 25-75% of hepatic lobe")
        .click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 4").first()).toBeVisible();
      await expect(results.locator("text=Severe").first()).toBeVisible();
      await expect(results.locator("text=33-40%").first()).toBeVisible();
    });

    test("should classify Grade IV liver injury - intraperitoneal bleeding", async ({
      page,
    }) => {
      await page
        .getByText("Active bleeding extending beyond liver into peritoneum")
        .click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 4").first()).toBeVisible();
      await expect(results.locator("text=peritoneum").first()).toBeVisible();
    });

    test("should classify Grade V liver injury - >75% lobe disruption", async ({
      page,
    }) => {
      await page
        .getByText("Parenchymal disruption >75% of hepatic lobe")
        .click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 5").first()).toBeVisible();
      await expect(results.locator("text=Critical").first()).toBeVisible();
      await expect(
        results.locator("text=damage control surgery").first(),
      ).toBeVisible();
    });

    test("should classify Grade V liver injury - juxtahepatic venous injury", async ({
      page,
    }) => {
      await page.getByText("Juxtahepatic venous injury").click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 5").first()).toBeVisible();
      await expect(
        results.locator("text=retrohepatic IVC").first(),
      ).toBeVisible();
    });

    test("should classify Grade V with major hepatic vein checkbox", async ({
      page,
    }) => {
      await page.getByText("Major Hepatic Vein or IVC Injury").click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 5").first()).toBeVisible();
    });

    test("should show liver-specific notes for high-grade injury", async ({
      page,
    }) => {
      await page
        .getByText("Parenchymal disruption 25-75% of hepatic lobe")
        .click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      // Grade IV shows 33-40% intervention rate
      await expect(results.locator("text=Liver").first()).toBeVisible();
    });
  });

  test.describe("Spleen Injury Grading", () => {
    test.beforeEach(async ({ page }) => {
      await page.getByText("Spleen", { exact: true }).click();
    });

    test("should show spleen-specific fields when spleen selected", async ({
      page,
    }) => {
      await expect(page.getByText("Spleen Hematoma").first()).toBeVisible();
      await expect(page.getByText("Spleen Laceration").first()).toBeVisible();
      await expect(
        page.getByText("Spleen Vascular Injury").first(),
      ).toBeVisible();
    });

    test("should classify Grade I spleen injury", async ({ page }) => {
      await page.getByText("Subcapsular, <10% surface area").click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 1").first()).toBeVisible();
      await expect(results.locator("text=Spleen").first()).toBeVisible();
      await expect(
        results.locator("text=NOM success rate >95%").first(),
      ).toBeVisible();
    });

    test("should classify Grade III spleen injury - large hematoma", async ({
      page,
    }) => {
      await page.getByText("Subcapsular, >50% surface area").click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 3").first()).toBeVisible();
      await expect(
        results.locator("text=prophylactic angioembolization").first(),
      ).toBeVisible();
    });

    test("should classify Grade IV spleen injury - PSA or AVF", async ({
      page,
    }) => {
      await page.getByText("Pseudoaneurysm or arteriovenous fistula").click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 4").first()).toBeVisible();
      await expect(
        results.locator("text=80% splenic salvage").first(),
      ).toBeVisible();
    });

    test("should classify Grade V spleen injury - shattered", async ({
      page,
    }) => {
      await page.getByText("Shattered spleen").click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 5").first()).toBeVisible();
      await expect(results.locator("text=splenectomy").first()).toBeVisible();
    });

    test("should classify Grade V spleen injury - hilar devascularization", async ({
      page,
    }) => {
      await page
        .getByText(
          "Hilar vascular injury with complete splenic devascularization",
        )
        .click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 5").first()).toBeVisible();
      await expect(
        results.locator("text=devascularization").first(),
      ).toBeVisible();
    });

    test("should show spleen-specific vaccination note for Grade V", async ({
      page,
    }) => {
      await page.getByText("Shattered spleen").click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Vaccinations").first()).toBeVisible();
      await expect(results.locator("text=pneumococcal").first()).toBeVisible();
    });
  });

  test.describe("Kidney Injury Grading", () => {
    test.beforeEach(async ({ page }) => {
      await page.getByText("Kidney", { exact: true }).click();
    });

    test("should show kidney-specific fields when kidney selected", async ({
      page,
    }) => {
      await expect(page.getByText("Kidney Hematoma").first()).toBeVisible();
      await expect(page.getByText("Kidney Laceration").first()).toBeVisible();
      await expect(
        page.getByText("Urinary Extravasation").first(),
      ).toBeVisible();
      await expect(
        page.getByText("Kidney Vascular Injury").first(),
      ).toBeVisible();
      await expect(page.getByText("Kidney Infarction").first()).toBeVisible();
    });

    test("should classify Grade I kidney injury - contusion", async ({
      page,
    }) => {
      await page.getByText("Contusion without laceration").click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 1").first()).toBeVisible();
      await expect(results.locator("text=Kidney").first()).toBeVisible();
      await expect(results.locator("text=Minor").first()).toBeVisible();
    });

    test("should classify Grade II kidney injury - small laceration", async ({
      page,
    }) => {
      await page.getByText("Laceration <2.5 cm, no collecting system").click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 2").first()).toBeVisible();
    });

    test("should classify Grade III kidney injury - hematoma rim distance >=3.5cm", async ({
      page,
    }) => {
      await page.locator('label[for="kidney_hematoma-hrd_gte3_5"]').click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 3").first()).toBeVisible();
      await expect(
        results.locator("text=Hematoma rim distance").first(),
      ).toBeVisible();
    });

    test("should classify Grade III kidney injury - collecting system involvement", async ({
      page,
    }) => {
      await page
        .getByText("Collecting system laceration / urinary extravasation")
        .click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 3").first()).toBeVisible();
      await expect(
        results.locator("text=collecting system").first(),
      ).toBeVisible();
    });

    test("should classify Grade IV kidney injury - UPJ disruption", async ({
      page,
    }) => {
      await page.getByText("Complete or near-complete UPJ disruption").click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 4").first()).toBeVisible();
      await expect(results.locator("text=UPJ").first()).toBeVisible();
    });

    test("should classify Grade V kidney injury - main vessel injury", async ({
      page,
    }) => {
      await page
        .getByText("Main renal artery or vein laceration with active bleeding")
        .click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 5").first()).toBeVisible();
      await expect(results.locator("text=nephrectomy").first()).toBeVisible();
    });

    test("should note urinary extravasation on result", async ({ page }) => {
      await page.getByText("Laceration <2.5 cm, no collecting system").click();
      await page.locator('label[for="kidney_urinary_extrav"]').click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=Urinary extravasation").first(),
      ).toBeVisible();
      // Should upgrade to at least Grade 3
      await expect(results.locator("text=Grade 3").first()).toBeVisible();
    });

    test("should show kidney-specific note about urinary extravasation resolution", async ({
      page,
    }) => {
      await page
        .getByText("Collecting system laceration / urinary extravasation")
        .click();
      await page.locator('label[for="kidney_urinary_extrav"]').click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=80-90%").first()).toBeVisible();
      await expect(results.locator("text=spontaneously").first()).toBeVisible();
    });
  });

  test.describe("Multiple Injury Rule", () => {
    test("should advance grade by 1 for multiple injuries (Grade I to II)", async ({
      page,
    }) => {
      await page.getByText("Liver", { exact: true }).click();
      await page.getByText("Subcapsular, <10% surface area").click();
      await page.getByText("Multiple Injuries in Same Organ").click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 2").first()).toBeVisible();
      await expect(
        results.locator("text=Multiple injuries (+1 grade)").first(),
      ).toBeVisible();
      await expect(
        results.locator("text=Base grade 1 advanced to Grade 2").first(),
      ).toBeVisible();
    });

    test("should not advance grade beyond III for multiple injuries", async ({
      page,
    }) => {
      await page.getByText("Liver", { exact: true }).click();
      await page.getByText(">3 cm parenchymal depth").click();
      await page.getByText("Multiple Injuries in Same Organ").click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      // Grade III should not advance further due to multiple injuries rule
      await expect(results.locator("text=Grade 3").first()).toBeVisible();
      // Should not show advancement message since it's already >= Grade III
    });
  });

  test.describe("Management Recommendations", () => {
    test("should show NOM recommendation for low-grade liver injury", async ({
      page,
    }) => {
      await page.getByText("Liver", { exact: true }).click();
      await page.getByText("Subcapsular, <10% surface area").click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=Non-operative management").first(),
      ).toBeVisible();
      await expect(results.locator("text=Observation").first()).toBeVisible();
    });

    test("should show angioembolization consideration for Grade III", async ({
      page,
    }) => {
      await page.getByText("Liver", { exact: true }).click();
      await page
        .getByText("Active bleeding contained within liver parenchyma")
        .click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=Angioembolization").first(),
      ).toBeVisible();
      await expect(results.locator("text=15-25%").first()).toBeVisible();
    });

    test("should show operative management note for Grade V", async ({
      page,
    }) => {
      await page.getByText("Liver", { exact: true }).click();
      await page
        .getByText("Parenchymal disruption >75% of hepatic lobe")
        .click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=43-57%").first()).toBeVisible();
      await expect(
        results.locator("text=damage control surgery").first(),
      ).toBeVisible();
    });
  });

  test.describe("Hemodynamic Stability Warning", () => {
    test("should always display critical hemodynamic stability note", async ({
      page,
    }) => {
      await page.getByText("Liver", { exact: true }).click();
      await page.getByText("Subcapsular, <10% surface area").click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=HEMODYNAMIC STABILITY IS PARAMOUNT").first(),
      ).toBeVisible();
      await expect(
        results.locator("text=Unstable patients").first(),
      ).toBeVisible();
      await expect(
        results.locator("text=OPERATIVE MANAGEMENT").first(),
      ).toBeVisible();
    });
  });

  test.describe("Input Validation", () => {
    test("should show error when no organ selected", async ({ page }) => {
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Please select the injured organ").first(),
      ).toBeVisible();
    });

    test("should show error when no injury finding selected for liver", async ({
      page,
    }) => {
      await page.getByText("Liver", { exact: true }).click();
      // Don't select any injury findings
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Please select at least one injury finding").first(),
      ).toBeVisible();
    });

    test("should show error when no injury finding selected for spleen", async ({
      page,
    }) => {
      await page.getByText("Spleen", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Please select at least one injury finding").first(),
      ).toBeVisible();
    });

    test("should show error when no injury finding selected for kidney", async ({
      page,
    }) => {
      await page.getByText("Kidney", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Please select at least one injury finding").first(),
      ).toBeVisible();
    });
  });

  test.describe("Conditional Field Display", () => {
    test("should only show liver fields when liver selected", async ({
      page,
    }) => {
      await page.getByText("Liver", { exact: true }).click();

      await expect(page.getByText("Liver Hematoma").first()).toBeVisible();
      await expect(page.getByText("Spleen Hematoma").first()).not.toBeVisible();
      await expect(page.getByText("Kidney Hematoma").first()).not.toBeVisible();
    });

    test("should only show spleen fields when spleen selected", async ({
      page,
    }) => {
      await page.getByText("Spleen", { exact: true }).click();

      await expect(page.getByText("Spleen Hematoma").first()).toBeVisible();
      await expect(page.getByText("Liver Hematoma").first()).not.toBeVisible();
      await expect(page.getByText("Kidney Hematoma").first()).not.toBeVisible();
    });

    test("should only show kidney fields when kidney selected", async ({
      page,
    }) => {
      await page.getByText("Kidney", { exact: true }).click();

      await expect(page.getByText("Kidney Hematoma").first()).toBeVisible();
      await expect(page.getByText("Liver Hematoma").first()).not.toBeVisible();
      await expect(page.getByText("Spleen Hematoma").first()).not.toBeVisible();
    });
  });

  test.describe("Combined Injuries Within Same Organ", () => {
    test("should take highest grade when multiple injury types present", async ({
      page,
    }) => {
      await page.getByText("Liver", { exact: true }).click();

      // Select Grade I hematoma and Grade III laceration
      await page.getByText("Subcapsular, <10% surface area").click();
      await page.getByText(">3 cm parenchymal depth").click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      // Should be Grade III (highest)
      await expect(results.locator("text=Grade 3").first()).toBeVisible();
      await expect(
        results.locator("text=Subcapsular hematoma").first(),
      ).toBeVisible();
      await expect(results.locator("text=>3 cm").first()).toBeVisible();
    });

    test("should list all findings in results", async ({ page }) => {
      await page.getByText("Spleen", { exact: true }).click();

      // Select multiple findings
      await page.getByText("Subcapsular, 10-50% surface area").click();
      await page.getByText("1-3 cm parenchymal depth").click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Key Findings").first()).toBeVisible();
      await expect(
        results.locator("text=Subcapsular hematoma 10-50%").first(),
      ).toBeVisible();
      await expect(results.locator("text=1-3 cm").first()).toBeVisible();
    });
  });

  test.describe("References", () => {
    test("should display AAST references", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: "References" }),
      ).toBeVisible();
      await expect(page.getByText("Kozar RA").first()).toBeVisible();
    });

    test("should have reference to 2018 AAST-OIS update", async ({ page }) => {
      const aastLink = page.locator('a[href*="TA.0000000000002058"]');
      await expect(aastLink).toBeVisible();
    });

    test("should have reference to WSES guidelines", async ({ page }) => {
      const refsSection = page.locator(".references-section");
      const expandBtn = refsSection.locator(
        'button:has-text("more reference")',
      );
      if (await expandBtn.isVisible()) {
        await expandBtn.click();
      }
      await expect(refsSection.getByText("WSES").first()).toBeVisible();
      await expect(
        refsSection.getByText("World J Emerg Surg").first(),
      ).toBeVisible();
    });

    test("should have link to AAST official website", async ({ page }) => {
      const expandBtn = page.locator(
        '.references-section button:has-text("more reference")',
      );
      if (await expandBtn.isVisible()) {
        await expandBtn.click();
      }
      const aastWebsite = page.locator('a[href*="aast.org"]');
      await expect(aastWebsite).toBeVisible();
    });
  });

  test.describe("Kidney OIS Version Selector", () => {
    test("should show version selector when kidney is selected", async ({
      page,
    }) => {
      await page.getByText("Kidney", { exact: true }).click();
      await expect(page.getByText("Kidney OIS Version").first()).toBeVisible();
      await expect(
        page.locator('label[for="kidney_ois_version-2025"]'),
      ).toBeVisible();
      await expect(
        page.locator('label[for="kidney_ois_version-2018"]'),
      ).toBeVisible();
    });

    test("should not show version selector for liver", async ({ page }) => {
      await page.getByText("Liver", { exact: true }).click();
      await expect(
        page.getByText("Kidney OIS Version").first(),
      ).not.toBeVisible();
    });

    test("should not show version selector for spleen", async ({ page }) => {
      await page.getByText("Spleen", { exact: true }).click();
      await expect(
        page.getByText("Kidney OIS Version").first(),
      ).not.toBeVisible();
    });

    test("should show OIS version in results for kidney", async ({ page }) => {
      await page.getByText("Kidney", { exact: true }).click();
      await page.getByText("Contusion without laceration").click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=OIS Version").first()).toBeVisible();
    });
  });

  test.describe("Kidney 2025 OIS Grading", () => {
    test.beforeEach(async ({ page }) => {
      await page.getByText("Kidney", { exact: true }).click();
      await page.locator('label[for="kidney_ois_version-2025"]').click();
    });

    test("should grade pararenal hematoma extension as Grade IV", async ({
      page,
    }) => {
      await page.getByText("Pararenal hematoma extension").click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 4").first()).toBeVisible();
      await expect(
        results.locator("text=Pararenal hematoma extension").first(),
      ).toBeVisible();
    });

    test("should grade PSA/AVF without active bleeding as Grade III", async ({
      page,
    }) => {
      await page.getByText("Vascular injury without active bleeding").click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 3").first()).toBeVisible();
      await expect(results.locator("text=PSA/AVF").first()).toBeVisible();
    });

    test("should grade active bleeding from kidney as Grade IV (key 2025 change)", async ({
      page,
    }) => {
      await page.getByText("Active bleeding from kidney").click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 4").first()).toBeVisible();
      await expect(
        results.locator("text=Active bleeding from kidney").first(),
      ).toBeVisible();
    });

    test("should grade complete infarction without bleeding as Grade IV", async ({
      page,
    }) => {
      await page
        .getByText("Complete/near-complete infarction without active bleeding")
        .click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 4").first()).toBeVisible();
    });

    test("should grade complete infarction with bleeding as Grade V", async ({
      page,
    }) => {
      await page
        .getByText("Complete/near-complete infarction with active bleeding")
        .click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 5").first()).toBeVisible();
    });

    test("should grade multifragmented kidney with active bleeding as Grade V", async ({
      page,
    }) => {
      await page.getByText("Multifragmented kidney").click();
      await page.getByText("Active bleeding from kidney").click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 5").first()).toBeVisible();
      await expect(
        results
          .locator("text=Multifragmented kidney with active bleeding")
          .first(),
      ).toBeVisible();
    });

    test("should grade multifragmented kidney without active bleeding as Grade IV", async ({
      page,
    }) => {
      await page.getByText("Multifragmented kidney").click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 4").first()).toBeVisible();
      await expect(
        results.locator("text=without active bleeding").first(),
      ).toBeVisible();
    });

    test("should grade urinary extravasation as Grade III (downgraded in 2025)", async ({
      page,
    }) => {
      await page.getByText("Laceration <2.5 cm, no collecting system").click();
      await page.locator('label[for="kidney_urinary_extrav"]').click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 3").first()).toBeVisible();
    });
  });

  test.describe("Kidney 2018 OIS Grading", () => {
    test.beforeEach(async ({ page }) => {
      await page.getByText("Kidney", { exact: true }).click();
      await page.locator('label[for="kidney_ois_version-2018"]').click();
    });

    test("should show 2018-specific fields", async ({ page }) => {
      await expect(page.getByText("Kidney Hematoma").first()).toBeVisible();
      await expect(page.getByText("Kidney Laceration").first()).toBeVisible();
      await expect(
        page.getByText("Kidney Vascular Injury").first(),
      ).toBeVisible();
    });

    test("should classify Grade I - contusion (2018)", async ({ page }) => {
      await page
        .getByText("Subcapsular hematoma and/or parenchymal contusion")
        .click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 1").first()).toBeVisible();
      await expect(results.locator("text=2018").first()).toBeVisible();
    });

    test("should classify Grade II - small laceration ≤1cm (2018)", async ({
      page,
    }) => {
      await page
        .getByText("≤1 cm parenchymal depth without urinary extravasation")
        .click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 2").first()).toBeVisible();
    });

    test("should classify Grade III - laceration >1cm (2018)", async ({
      page,
    }) => {
      await page
        .getByText(
          ">1 cm depth without collecting system rupture or urinary extravasation",
        )
        .click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 3").first()).toBeVisible();
    });

    test("should classify Grade III - contained vascular (2018)", async ({
      page,
    }) => {
      await page
        .getByText("Vascular injury or active bleeding contained within Gerota")
        .click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 3").first()).toBeVisible();
    });

    test("should classify Grade IV - collecting system with urinary extravasation (2018)", async ({
      page,
    }) => {
      await page
        .getByText("Into collecting system with urinary extravasation")
        .click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 4").first()).toBeVisible();
    });

    test("should classify Grade IV - urinary extravasation checkbox (2018)", async ({
      page,
    }) => {
      await page
        .getByText("Subcapsular hematoma and/or parenchymal contusion")
        .click();
      await page.locator('label[for="kidney_2018_urinary_extrav"]').click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      // In 2018, urinary extravasation = Grade IV
      await expect(results.locator("text=Grade 4").first()).toBeVisible();
    });

    test("should classify Grade V - shattered kidney (2018)", async ({
      page,
    }) => {
      await page
        .getByText("Shattered kidney with loss of identifiable")
        .click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 5").first()).toBeVisible();
    });

    test("should classify Grade V - main vessel injury (2018)", async ({
      page,
    }) => {
      await page
        .getByText("Main renal artery or vein laceration or avulsion")
        .click();

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 5").first()).toBeVisible();
    });
  });

  // ============================================
  // PANCREAS INJURY GRADING (2024 OIS)
  // ============================================
  test.describe("Pancreas Injury Grading (2024 OIS)", () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('label[for="organ-pancreas"]').click();
    });

    test("should show pancreas-specific fields when pancreas selected", async ({
      page,
    }) => {
      await expect(
        page.getByText("Pancreatic Parenchymal Injury").first(),
      ).toBeVisible();
      await expect(
        page.getByText("Pancreatic Duct Injury").first(),
      ).toBeVisible();
      await expect(
        page.getByText("Destructive Pancreatic Head Injury").first(),
      ).toBeVisible();
    });

    test("should not show liver/spleen/kidney fields for pancreas", async ({
      page,
    }) => {
      await expect(page.locator("text=Liver Hematoma")).not.toBeVisible();
      await expect(page.locator("text=Spleen Hematoma")).not.toBeVisible();
      await expect(page.locator("text=Kidney Hematoma")).not.toBeVisible();
    });

    test("should show OIS Version 2024 in results", async ({ page }) => {
      await page.getByText("Minor contusion without duct injury").click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=2024").first()).toBeVisible();
    });

    // Grade I tests
    test("should classify Grade I - minor contusion", async ({ page }) => {
      await page.getByText("Minor contusion without duct injury").click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 1").first()).toBeVisible();
      await expect(
        results.locator("text=Minor contusion without duct injury").first(),
      ).toBeVisible();
    });

    test("should classify Grade I - superficial laceration", async ({
      page,
    }) => {
      await page
        .getByText("Superficial laceration without duct injury")
        .click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 1").first()).toBeVisible();
    });

    // Grade II tests
    test("should classify Grade II - major contusion", async ({ page }) => {
      await page
        .getByText("Major contusion without duct injury or tissue loss")
        .click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 2").first()).toBeVisible();
    });

    test("should classify Grade II - major laceration", async ({ page }) => {
      await page
        .locator('label[for="pancreas_parenchymal-major_laceration"]')
        .click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 2").first()).toBeVisible();
    });

    // Grade III tests - duct injury in body/tail
    test("should classify Grade III - complete transection body/tail", async ({
      page,
    }) => {
      await page.getByText("Complete ductal transection").click();
      await page
        .locator('label[for="pancreas_duct_location-body_tail"]')
        .click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 3").first()).toBeVisible();
      await expect(
        results.locator("text=neck/body/tail").first(),
      ).toBeVisible();
    });

    test("should classify Grade III - partial duct injury body/tail", async ({
      page,
    }) => {
      await page.getByText("Partial ductal injury").click();
      await page
        .locator('label[for="pancreas_duct_location-body_tail"]')
        .click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 3").first()).toBeVisible();
    });

    test("should classify Grade III - deep parenchymal without ductal interrogation body/tail", async ({
      page,
    }) => {
      await page.getByText("Deep parenchymal injury without ductal").click();
      await page
        .locator('label[for="pancreas_duct_location-body_tail"]')
        .click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 3").first()).toBeVisible();
    });

    // Grade IV tests - duct injury in head
    test("should classify Grade IV - complete transection head", async ({
      page,
    }) => {
      await page.getByText("Complete ductal transection").click();
      await page.locator('label[for="pancreas_duct_location-head"]').click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 4").first()).toBeVisible();
      await expect(
        results.locator("text=pancreatic head").first(),
      ).toBeVisible();
    });

    test("should classify Grade IV - partial duct injury head", async ({
      page,
    }) => {
      await page.getByText("Partial ductal injury").click();
      await page.locator('label[for="pancreas_duct_location-head"]').click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 4").first()).toBeVisible();
    });

    // Grade V test
    test("should classify Grade V - destructive head injury", async ({
      page,
    }) => {
      await page.click('label[for="pancreas_destructive"]');
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 5").first()).toBeVisible();
      await expect(results.locator("text=Destructive").first()).toBeVisible();
    });

    // Duct location conditional visibility
    test("should show duct location only when duct injury selected", async ({
      page,
    }) => {
      // Initially no duct injury → location should not be visible
      await expect(
        page.locator("text=Location of Duct Injury"),
      ).not.toBeVisible();

      // Select duct injury → location should appear
      await page.getByText("Complete ductal transection").click();
      await expect(
        page.getByText("Location of Duct Injury").first(),
      ).toBeVisible();
    });

    // Ductal injury note
    test("should show pancreas-specific note for duct injuries", async ({
      page,
    }) => {
      await page.getByText("Complete ductal transection").click();
      await page
        .locator('label[for="pancreas_duct_location-body_tail"]')
        .click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=Ductal integrity").first(),
      ).toBeVisible();
    });

    // Management recommendations
    test("should show appropriate management for Grade III", async ({
      page,
    }) => {
      await page.getByText("Partial ductal injury").click();
      await page
        .locator('label[for="pancreas_duct_location-body_tail"]')
        .click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=pancreatectomy").first(),
      ).toBeVisible();
    });

    test("should show appropriate management for Grade V", async ({ page }) => {
      await page.click('label[for="pancreas_destructive"]');
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=damage control").first(),
      ).toBeVisible();
    });

    // Multiple injury rule
    test("should advance grade for multiple injuries (up to Grade III)", async ({
      page,
    }) => {
      await page
        .getByText("Major contusion without duct injury or tissue loss")
        .click();
      await page.click('label[for="multiple_injuries"]');
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Grade 3").first()).toBeVisible();
      await expect(
        results.locator("text=Multiple injuries").first(),
      ).toBeVisible();
    });
  });

  // ============================================
  // IMAGING GUIDANCE (Task D)
  // ============================================
  test.describe("Imaging Recommendation and Pitfalls", () => {
    test("should show imaging recommendation for liver", async ({ page }) => {
      await page.getByText("Liver", { exact: true }).click();
      await page.getByText("Capsular tear, <1 cm").click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Dual-phase CT").first()).toBeVisible();
    });

    test("should show imaging pitfalls for liver Grade III", async ({
      page,
    }) => {
      await page.getByText("Liver", { exact: true }).click();
      await page.getByText(">3 cm parenchymal depth").click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=sentinel clot").first()).toBeVisible();
    });

    test("should show imaging recommendation for spleen", async ({ page }) => {
      await page.getByText("Spleen", { exact: true }).click();
      await page.getByText("Subcapsular, <10%").click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=arterial phase is critical").first(),
      ).toBeVisible();
    });

    test("should show delayed rupture pitfall for spleen Grade III", async ({
      page,
    }) => {
      await page.getByText("Spleen", { exact: true }).click();
      await page.getByText(">3 cm parenchymal depth").click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=Delayed splenic rupture").first(),
      ).toBeVisible();
    });

    test("should show delayed excretory phase recommendation for kidney", async ({
      page,
    }) => {
      await page.locator('label[for="organ-kidney"]').click();
      await page.getByText("Contusion without laceration").click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=delayed excretory phase").first(),
      ).toBeVisible();
    });

    test("should show MRCP recommendation for pancreas", async ({ page }) => {
      await page.locator('label[for="organ-pancreas"]').click();
      await page.getByText("Minor contusion without duct injury").click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=MRCP").first()).toBeVisible();
    });

    test("should show pancreas CT miss rate pitfall", async ({ page }) => {
      await page.locator('label[for="organ-pancreas"]').click();
      await page.getByText("Minor contusion without duct injury").click();
      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("text=missed on initial CT").first(),
      ).toBeVisible();
    });
  });

  test.describe("Responsiveness and Theme", () => {
    test("should maintain theme consistency", async ({ page }) => {
      await verifyThemeConsistency(page);
    });

    test("should be responsive on mobile devices", async ({ page }) => {
      await verifyMobileResponsive(page);

      // Verify calculator is still usable on mobile
      await expect(page.locator("h2")).toContainText("AAST");
      await expect(page.locator('button:has-text("Calculate")')).toBeVisible();
    });
  });
});
