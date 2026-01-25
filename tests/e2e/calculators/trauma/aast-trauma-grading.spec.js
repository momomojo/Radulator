/**
 * AAST Trauma Grading Calculator - E2E Tests
 *
 * Tests the AAST-OIS 2018 solid organ injury grading calculator for
 * liver, spleen, and kidney trauma.
 *
 * Test Coverage:
 * - Liver injury grading (Grades I-V)
 * - Spleen injury grading (Grades I-V)
 * - Kidney injury grading (Grades I-V)
 * - Vascular injury criteria
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
      await expect(page.getByText("AAST-OIS 2018")).toBeVisible();
    });

    test("should display info section with grading explanation", async ({
      page,
    }) => {
      await expect(page.getByText("Grade I")).toBeVisible();
      await expect(page.getByText("Grade V")).toBeVisible();
      await expect(page.getByText("Vascular injury criteria")).toBeVisible();
    });

    test("should have organ selection", async ({ page }) => {
      await expect(page.getByText("Injured Organ")).toBeVisible();
      await expect(page.getByText("Liver", { exact: true })).toBeVisible();
      await expect(page.getByText("Spleen", { exact: true })).toBeVisible();
      await expect(page.getByText("Kidney", { exact: true })).toBeVisible();
    });

    test("should have multiple injuries checkbox", async ({ page }) => {
      await expect(
        page.getByText("Multiple Injuries in Same Organ"),
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
      await expect(page.getByText("Liver Hematoma")).toBeVisible();
      await expect(page.getByText("Liver Laceration")).toBeVisible();
      await expect(page.getByText("Liver Vascular Injury")).toBeVisible();
    });

    test("should classify Grade I liver injury - subcapsular hematoma <10%", async ({
      page,
    }) => {
      await page.getByText("Subcapsular, <10% surface area").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Grade 1")).toBeVisible();
      await expect(page.locator("text=Liver")).toBeVisible();
      await expect(page.locator("text=Minor")).toBeVisible();
      await expect(page.locator("text=Non-operative management")).toBeVisible();
    });

    test("should classify Grade I liver injury - capsular tear <1cm", async ({
      page,
    }) => {
      await page.getByText("Capsular tear, <1 cm parenchymal depth").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Grade 1")).toBeVisible();
      await expect(page.locator("text=Capsular tear")).toBeVisible();
    });

    test("should classify Grade II liver injury - laceration 1-3 cm", async ({
      page,
    }) => {
      await page.getByText("1-3 cm parenchymal depth, <10 cm length").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Grade 2")).toBeVisible();
      await expect(page.locator("text=Moderate")).toBeVisible();
    });

    test("should classify Grade III liver injury - deep laceration >3cm", async ({
      page,
    }) => {
      await page.getByText(">3 cm parenchymal depth").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Grade 3")).toBeVisible();
      await expect(page.locator("text=Serious")).toBeVisible();
      await expect(page.locator("text=angioembolization")).toBeVisible();
    });

    test("should classify Grade III liver injury - contained active bleeding", async ({
      page,
    }) => {
      await page
        .getByText("Active bleeding contained within liver parenchyma")
        .click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Grade 3")).toBeVisible();
      await expect(page.locator("text=contained")).toBeVisible();
    });

    test("should classify Grade IV liver injury - 25-75% lobe disruption", async ({
      page,
    }) => {
      await page
        .getByText("Parenchymal disruption 25-75% of hepatic lobe")
        .click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Grade 4")).toBeVisible();
      await expect(page.locator("text=Severe")).toBeVisible();
      await expect(page.locator("text=33-40%")).toBeVisible();
    });

    test("should classify Grade IV liver injury - intraperitoneal bleeding", async ({
      page,
    }) => {
      await page
        .getByText("Active bleeding extending beyond liver into peritoneum")
        .click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Grade 4")).toBeVisible();
      await expect(page.locator("text=peritoneum")).toBeVisible();
    });

    test("should classify Grade V liver injury - >75% lobe disruption", async ({
      page,
    }) => {
      await page
        .getByText("Parenchymal disruption >75% of hepatic lobe")
        .click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Grade 5")).toBeVisible();
      await expect(page.locator("text=Critical")).toBeVisible();
      await expect(page.locator("text=damage control surgery")).toBeVisible();
    });

    test("should classify Grade V liver injury - juxtahepatic venous injury", async ({
      page,
    }) => {
      await page.getByText("Juxtahepatic venous injury").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Grade 5")).toBeVisible();
      await expect(page.locator("text=retrohepatic IVC")).toBeVisible();
    });

    test("should classify Grade V with major hepatic vein checkbox", async ({
      page,
    }) => {
      await page.getByText("Major Hepatic Vein or IVC Injury").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Grade 5")).toBeVisible();
    });

    test("should show liver-specific notes for high-grade injury", async ({
      page,
    }) => {
      await page
        .getByText("Parenchymal disruption 25-75% of hepatic lobe")
        .click();

      await page.click('button:has-text("Calculate")');

      // Grade IV shows 33-40% intervention rate
      await expect(page.locator("text=Liver")).toBeVisible();
    });
  });

  test.describe("Spleen Injury Grading", () => {
    test.beforeEach(async ({ page }) => {
      await page.getByText("Spleen", { exact: true }).click();
    });

    test("should show spleen-specific fields when spleen selected", async ({
      page,
    }) => {
      await expect(page.getByText("Spleen Hematoma")).toBeVisible();
      await expect(page.getByText("Spleen Laceration")).toBeVisible();
      await expect(page.getByText("Spleen Vascular Injury")).toBeVisible();
    });

    test("should classify Grade I spleen injury", async ({ page }) => {
      await page.getByText("Subcapsular, <10% surface area").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Grade 1")).toBeVisible();
      await expect(page.locator("text=Spleen")).toBeVisible();
      await expect(page.locator("text=NOM success rate >95%")).toBeVisible();
    });

    test("should classify Grade III spleen injury - large hematoma", async ({
      page,
    }) => {
      await page.getByText("Subcapsular, >50% surface area").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Grade 3")).toBeVisible();
      await expect(
        page.locator("text=prophylactic angioembolization"),
      ).toBeVisible();
    });

    test("should classify Grade IV spleen injury - PSA or AVF", async ({
      page,
    }) => {
      await page.getByText("Pseudoaneurysm or arteriovenous fistula").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Grade 4")).toBeVisible();
      await expect(page.locator("text=80% splenic salvage")).toBeVisible();
    });

    test("should classify Grade V spleen injury - shattered", async ({
      page,
    }) => {
      await page.getByText("Shattered spleen").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Grade 5")).toBeVisible();
      await expect(page.locator("text=splenectomy")).toBeVisible();
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

      await expect(page.locator("text=Grade 5")).toBeVisible();
      await expect(page.locator("text=devascularization")).toBeVisible();
    });

    test("should show spleen-specific vaccination note for Grade V", async ({
      page,
    }) => {
      await page.getByText("Shattered spleen").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Vaccinations")).toBeVisible();
      await expect(page.locator("text=pneumococcal")).toBeVisible();
    });
  });

  test.describe("Kidney Injury Grading", () => {
    test.beforeEach(async ({ page }) => {
      await page.getByText("Kidney", { exact: true }).click();
    });

    test("should show kidney-specific fields when kidney selected", async ({
      page,
    }) => {
      await expect(page.getByText("Kidney Hematoma")).toBeVisible();
      await expect(page.getByText("Kidney Laceration")).toBeVisible();
      await expect(page.getByText("Urinary Extravasation")).toBeVisible();
      await expect(page.getByText("Kidney Vascular Injury")).toBeVisible();
      await expect(page.getByText("Kidney Infarction")).toBeVisible();
    });

    test("should classify Grade I kidney injury - contusion", async ({
      page,
    }) => {
      await page.getByText("Parenchymal contusion").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Grade 1")).toBeVisible();
      await expect(page.locator("text=Kidney")).toBeVisible();
      await expect(page.locator("text=Minor")).toBeVisible();
    });

    test("should classify Grade II kidney injury - small laceration", async ({
      page,
    }) => {
      await page
        .getByText("<2.5 cm parenchymal depth, no collecting system")
        .click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Grade 2")).toBeVisible();
    });

    test("should classify Grade III kidney injury - hematoma rim distance >=3.5cm", async ({
      page,
    }) => {
      await page.getByText("Hematoma rim distance").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Grade 3")).toBeVisible();
      await expect(page.locator("text=HRD")).toBeVisible();
    });

    test("should classify Grade III kidney injury - collecting system involvement", async ({
      page,
    }) => {
      await page
        .getByText("Laceration extending into collecting system")
        .click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Grade 3")).toBeVisible();
      await expect(page.locator("text=collecting system")).toBeVisible();
    });

    test("should classify Grade IV kidney injury - UPJ disruption", async ({
      page,
    }) => {
      await page.getByText("Ureteropelvic junction (UPJ) disruption").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Grade 4")).toBeVisible();
      await expect(page.locator("text=UPJ")).toBeVisible();
    });

    test("should classify Grade V kidney injury - main vessel injury", async ({
      page,
    }) => {
      await page
        .getByText("Main renal artery or vein laceration/transection")
        .click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Grade 5")).toBeVisible();
      await expect(page.locator("text=nephrectomy")).toBeVisible();
    });

    test("should note urinary extravasation on result", async ({ page }) => {
      await page
        .getByText("<2.5 cm parenchymal depth, no collecting system")
        .click();
      await page.getByText("Urinary Extravasation").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Urinary extravasation")).toBeVisible();
      // Should upgrade to at least Grade 3
      await expect(page.locator("text=Grade 3")).toBeVisible();
    });

    test("should show kidney-specific note about urinary extravasation resolution", async ({
      page,
    }) => {
      await page
        .getByText("Laceration extending into collecting system")
        .click();
      await page.getByText("Urinary Extravasation").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=80-90%")).toBeVisible();
      await expect(page.locator("text=spontaneously")).toBeVisible();
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

      await expect(page.locator("text=Grade 2")).toBeVisible();
      await expect(
        page.locator("text=Multiple injuries (+1 grade)"),
      ).toBeVisible();
      await expect(
        page.locator("text=Base grade 1 advanced to Grade 2"),
      ).toBeVisible();
    });

    test("should not advance grade beyond III for multiple injuries", async ({
      page,
    }) => {
      await page.getByText("Liver", { exact: true }).click();
      await page.getByText(">3 cm parenchymal depth").click();
      await page.getByText("Multiple Injuries in Same Organ").click();

      await page.click('button:has-text("Calculate")');

      // Grade III should not advance further due to multiple injuries rule
      await expect(page.locator("text=Grade 3")).toBeVisible();
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

      await expect(page.locator("text=Non-operative management")).toBeVisible();
      await expect(page.locator("text=Observation")).toBeVisible();
    });

    test("should show angioembolization consideration for Grade III", async ({
      page,
    }) => {
      await page.getByText("Liver", { exact: true }).click();
      await page
        .getByText("Active bleeding contained within liver parenchyma")
        .click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Angioembolization")).toBeVisible();
      await expect(page.locator("text=15-25%")).toBeVisible();
    });

    test("should show operative management note for Grade V", async ({
      page,
    }) => {
      await page.getByText("Liver", { exact: true }).click();
      await page
        .getByText("Parenchymal disruption >75% of hepatic lobe")
        .click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=43-57%")).toBeVisible();
      await expect(page.locator("text=damage control surgery")).toBeVisible();
    });
  });

  test.describe("Hemodynamic Stability Warning", () => {
    test("should always display critical hemodynamic stability note", async ({
      page,
    }) => {
      await page.getByText("Liver", { exact: true }).click();
      await page.getByText("Subcapsular, <10% surface area").click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=HEMODYNAMIC STABILITY IS PARAMOUNT"),
      ).toBeVisible();
      await expect(page.locator("text=Unstable patients")).toBeVisible();
      await expect(page.locator("text=OPERATIVE MANAGEMENT")).toBeVisible();
    });
  });

  test.describe("Input Validation", () => {
    test("should show error when no organ selected", async ({ page }) => {
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Please select the injured organ"),
      ).toBeVisible();
    });

    test("should show error when no injury finding selected for liver", async ({
      page,
    }) => {
      await page.getByText("Liver", { exact: true }).click();
      // Don't select any injury findings
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Please select at least one injury finding"),
      ).toBeVisible();
    });

    test("should show error when no injury finding selected for spleen", async ({
      page,
    }) => {
      await page.getByText("Spleen", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Please select at least one injury finding"),
      ).toBeVisible();
    });

    test("should show error when no injury finding selected for kidney", async ({
      page,
    }) => {
      await page.getByText("Kidney", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Please select at least one injury finding"),
      ).toBeVisible();
    });
  });

  test.describe("Conditional Field Display", () => {
    test("should only show liver fields when liver selected", async ({
      page,
    }) => {
      await page.getByText("Liver", { exact: true }).click();

      await expect(page.getByText("Liver Hematoma")).toBeVisible();
      await expect(page.getByText("Spleen Hematoma")).not.toBeVisible();
      await expect(page.getByText("Kidney Hematoma")).not.toBeVisible();
    });

    test("should only show spleen fields when spleen selected", async ({
      page,
    }) => {
      await page.getByText("Spleen", { exact: true }).click();

      await expect(page.getByText("Spleen Hematoma")).toBeVisible();
      await expect(page.getByText("Liver Hematoma")).not.toBeVisible();
      await expect(page.getByText("Kidney Hematoma")).not.toBeVisible();
    });

    test("should only show kidney fields when kidney selected", async ({
      page,
    }) => {
      await page.getByText("Kidney", { exact: true }).click();

      await expect(page.getByText("Kidney Hematoma")).toBeVisible();
      await expect(page.getByText("Liver Hematoma")).not.toBeVisible();
      await expect(page.getByText("Spleen Hematoma")).not.toBeVisible();
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

      // Should be Grade III (highest)
      await expect(page.locator("text=Grade 3")).toBeVisible();
      await expect(page.locator("text=Subcapsular hematoma")).toBeVisible();
      await expect(page.locator("text=>3 cm")).toBeVisible();
    });

    test("should list all findings in results", async ({ page }) => {
      await page.getByText("Spleen", { exact: true }).click();

      // Select multiple findings
      await page.getByText("Subcapsular, 10-50% surface area").click();
      await page.getByText("1-3 cm parenchymal depth").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Key Findings")).toBeVisible();
      await expect(
        page.locator("text=Subcapsular hematoma 10-50%"),
      ).toBeVisible();
      await expect(page.locator("text=1-3 cm")).toBeVisible();
    });
  });

  test.describe("References", () => {
    test("should display AAST references", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: "References" }),
      ).toBeVisible();
      await expect(page.getByText("Kozar RA")).toBeVisible();
    });

    test("should have reference to 2018 AAST-OIS update", async ({ page }) => {
      const aastLink = page.locator('a[href*="TA.0000000000002058"]');
      await expect(aastLink).toBeVisible();
    });

    test("should have reference to WSES guidelines", async ({ page }) => {
      await expect(page.getByText("WSES")).toBeVisible();
      await expect(page.getByText("World J Emerg Surg")).toBeVisible();
    });

    test("should have link to AAST official website", async ({ page }) => {
      const aastWebsite = page.locator('a[href*="aast.org"]');
      await expect(aastWebsite).toBeVisible();
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
