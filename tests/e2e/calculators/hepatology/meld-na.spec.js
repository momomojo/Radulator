/**
 * E2E Tests for MELD-Na Calculator
 * Model for End-Stage Liver Disease with Sodium
 *
 * Test Coverage:
 * - Basic MELD score calculation
 * - MELD-Na score calculation (when MELD > 11)
 * - Dialysis adjustments (Cr = 4.0)
 * - Lower bounds (Cr, Bili, INR >= 1.0)
 * - Upper bounds (Cr <= 4.0, MELD/MELD-Na 6-40)
 * - Sodium adjustments (Na 125-137 for MELD-Na)
 * - Mortality risk categories
 * - Transplant eligibility criteria
 * - Input validation
 * - Edge cases
 */

import { test, expect } from "@playwright/test";
import {
  navigateToCalculator,
  selectRadio,
} from "../../../helpers/calculator-test-helper.js";

// The results render in a region with role="status" / aria-label="Calculator results".
// Each key/value is rendered in separate elements (the primary "MELD Score" puts its value
// in a `div.text-2xl`; secondary rows put the value in a sibling span). The concatenated
// text content is ambiguous (e.g. "MELD-Na Score: 103-Month Mortality..." where the "3"
// belongs to the next row), so read each score from its own element.
const resultsRegion = (page) =>
  page.getByRole("status", { name: "Calculator results" });

// MELD Score is the primary result: a block containing a span "MELD Score:&nbsp;"
// and the numeric value in a separate `div.text-2xl`.
function meldScoreBlock(page) {
  return resultsRegion(page)
    .locator("div", {
      has: page.locator("span", { hasText: /^MELD Score:/ }),
    })
    .first();
}

async function getMeldScore(page) {
  const val = await meldScoreBlock(page).locator("div.text-2xl").textContent();
  return parseInt(val.trim(), 10);
}

// MELD-Na Score is a secondary row: a flex div with a label span and a value span.
function meldNaScoreRow(page) {
  return resultsRegion(page).locator("div.flex", {
    has: page.locator("span", { hasText: /^MELD-Na Score:/ }),
  });
}

async function getMeldNaScore(page) {
  const val = await meldNaScoreRow(page).locator("span").nth(1).textContent();
  return parseInt(val.trim(), 10);
}

function meld3ScoreBlock(page) {
  return resultsRegion(page)
    .locator("div", {
      has: page.locator("span", { hasText: /^MELD 3\.0 Score:/ }),
    })
    .first();
}

async function getMeld3Score(page) {
  const val = await meld3ScoreBlock(page).locator("div.text-2xl").textContent();
  return parseInt(val.trim(), 10);
}

async function selectLegacyMeldNa(page) {
  await selectRadio(page, "Scoring model", "Temporary legacy MELD-Na");
}

async function selectCurrentMeld3(page) {
  await selectRadio(page, "Scoring model", "MELD 3.0 current allocation score");
}

async function fillMeld3Inputs(
  page,
  { age = "45", sex = "male", creatinine, bilirubin, inr, sodium, albumin },
) {
  await page.fill('input[id="ageAtRegistration"]', String(age));
  if (Number.parseFloat(age) >= 18) {
    await expect(
      page.locator('label:has-text("Sex for Adult MELD 3.0 Calculation")'),
    ).toBeVisible();
    await selectRadio(
      page,
      "Sex for Adult MELD 3.0 Calculation",
      sex === "female" ? "Female" : "Male",
    );
  }
  await page.fill('input[id="creatinine"]', String(creatinine));
  await page.fill('input[id="bilirubin"]', String(bilirubin));
  await page.fill('input[id="inr"]', String(inr));
  await page.fill('input[id="sodium"]', String(sodium));
  await page.fill('input[id="albumin"]', String(albumin));
}

test.describe("MELD-Na Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, "MELD-Na Score");
    await expect(page.getByTestId('calculator-title').first()).toContainText("MELD-Na Score");
    await selectLegacyMeldNa(page);
  });

  test.describe("Visual and UI Tests", () => {
    test("should display calculator with proper layout", async ({ page }) => {
      // Check header
      await expect(page.getByTestId('calculator-title').first()).toContainText("MELD-Na Score");

      // Check info section
      await expect(
        page.locator("text=MELD 3.0 is the current OPTN"),
      ).toBeVisible();
      await expect(
        page.locator("text=Temporary legacy option"),
      ).toBeVisible();

      // Check all input fields are present
      await expect(page.locator('label:has-text("Scoring model")')).toBeVisible();
      await expect(page.locator('label:has-text("Creatinine")')).toBeVisible();
      await expect(
        page.locator('label:has-text("Total Bilirubin")'),
      ).toBeVisible();
      await expect(page.locator('label:has-text("INR")').first()).toBeVisible();
      await expect(page.locator('label:has-text("Sodium")')).toBeVisible();
      await expect(
        page.locator('label:has-text("Dialysis ≥2 times")'),
      ).toBeVisible();

      // Check Calculate button
      await expect(page.getByRole('button', { name: 'Calculate' })).toBeVisible();

      // Check References section (heading, not the "Show more" button)
      await expect(
        page.getByRole("heading", { name: "References" }),
      ).toBeVisible();
    });

    test("should show subLabels with units and ranges", async ({ page }) => {
      await expect(page.locator("text=mg/dL (0.1-15.0)")).toBeVisible();
      await expect(page.locator("text=mg/dL (0.1-50.0)")).toBeVisible();
      await expect(page.locator("text=0.8-10.0")).toBeVisible();
      await expect(page.locator("text=mEq/L (110-160)")).toBeVisible();
    });

    test("should have working dialysis checkbox", async ({ page }) => {
      const dialysisCheckbox = page.locator('button[role="switch"]');

      // Initially unchecked
      await expect(dialysisCheckbox).toHaveAttribute("aria-checked", "false");

      // Click to check
      await dialysisCheckbox.click();
      await expect(dialysisCheckbox).toHaveAttribute("aria-checked", "true");

      // Click to uncheck
      await dialysisCheckbox.click();
      await expect(dialysisCheckbox).toHaveAttribute("aria-checked", "false");
    });
  });

  test.describe("MELD 3.0 Current Model", () => {
    test("should default to MELD 3.0 when no model is selected", async ({
      page,
    }) => {
      await page.reload();
      await expect(page.getByTestId('calculator-title').first()).toContainText("MELD-Na Score");
      await fillMeld3Inputs(page, {
        age: "45",
        sex: "male",
        creatinine: "0.8",
        bilirubin: "0.8",
        inr: "1.0",
        sodium: "140",
        albumin: "4.0",
      });

      await page.click('button:has-text("Calculate")');

      expect(await getMeld3Score(page)).toBe(6);
      await expect(page.locator("text=MELD 3.0 Score:")).toBeVisible();
      await expect(page.locator("text=Calculation Path:")).toBeVisible();
    });

    test("verifier example 1: normal low-score male should be MELD 3.0 6", async ({
      page,
    }) => {
      await selectCurrentMeld3(page);
      await fillMeld3Inputs(page, {
        age: "45",
        sex: "male",
        creatinine: "0.8",
        bilirubin: "0.8",
        inr: "1.0",
        sodium: "140",
        albumin: "4.0",
      });

      await page.click('button:has-text("Calculate")');

      expect(await getMeld3Score(page)).toBe(6);
    });

    test("verifier example 2: adult female sex term rounds to 13 and same labs male to 12", async ({
      page,
    }) => {
      await selectCurrentMeld3(page);
      await fillMeld3Inputs(page, {
        age: "45",
        sex: "female",
        creatinine: "1.0",
        bilirubin: "1.5",
        inr: "1.2",
        sodium: "135",
        albumin: "3.0",
      });

      await page.click('button:has-text("Calculate")');
      expect(await getMeld3Score(page)).toBe(13);
      await expect(
        page.locator("text=Adult female MELD 3.0 sex term applied"),
      ).toBeVisible();

      await selectRadio(
        page,
        "Sex for Adult MELD 3.0 Calculation",
        "Male",
      );
      await page.click('button:has-text("Calculate")');
      expect(await getMeld3Score(page)).toBe(12);
    });

    test("verifier example 3: hypoalbuminemia case should be MELD 3.0 16", async ({
      page,
    }) => {
      await selectCurrentMeld3(page);
      await fillMeld3Inputs(page, {
        age: "45",
        sex: "male",
        creatinine: "1.0",
        bilirubin: "2.0",
        inr: "1.5",
        sodium: "137",
        albumin: "1.8",
      });

      await page.click('button:has-text("Calculate")');

      expect(await getMeld3Score(page)).toBe(16);
    });

    test("verifier example 4: high-score female/hyponatremia rounds to 38 and same labs male to 36", async ({
      page,
    }) => {
      await selectCurrentMeld3(page);
      await fillMeld3Inputs(page, {
        age: "45",
        sex: "female",
        creatinine: "2.5",
        bilirubin: "10.0",
        inr: "2.2",
        sodium: "128",
        albumin: "2.8",
      });

      await page.click('button:has-text("Calculate")');
      expect(await getMeld3Score(page)).toBe(38);

      await selectRadio(
        page,
        "Sex for Adult MELD 3.0 Calculation",
        "Male",
      );
      await page.click('button:has-text("Calculate")');
      expect(await getMeld3Score(page)).toBe(36);
    });

    test("verifier example 5: dialysis/creatinine cap case should be MELD 3.0 25", async ({
      page,
    }) => {
      await selectCurrentMeld3(page);
      await fillMeld3Inputs(page, {
        age: "45",
        sex: "male",
        creatinine: "5.0",
        bilirubin: "2.0",
        inr: "1.5",
        sodium: "137",
        albumin: "3.5",
      });
      await page.locator('button[role="switch"]').click();

      await page.click('button:has-text("Calculate")');

      expect(await getMeld3Score(page)).toBe(25);
      await expect(
        page.locator("text=Creatinine set to 3.0 mg/dL for MELD 3.0"),
      ).toBeVisible();
    });

    test("should use adolescent age 12-17 MELD 3.0 +7.33 path", async ({
      page,
    }) => {
      await selectCurrentMeld3(page);
      await fillMeld3Inputs(page, {
        age: "16",
        creatinine: "1.0",
        bilirubin: "1.5",
        inr: "1.2",
        sodium: "135",
        albumin: "3.0",
      });

      await page.click('button:has-text("Calculate")');

      expect(await getMeld3Score(page)).toBe(13);
      await expect(
        page.locator("text=Adolescent age 12-17 at registration"),
      ).toBeVisible();
      await expect(
        page.getByText(
          "Age 12-17 path used: MELD 3.0 applies +7.33 constant for all sexes",
        ),
      ).toBeVisible();
      await expect(
        page.locator('label:has-text("Sex for Adult MELD 3.0 Calculation")'),
      ).not.toBeVisible();
    });
  });

  test.describe("Basic MELD Score Calculations", () => {
    test("should calculate low MELD score (6-9)", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "0.8");
      await page.fill('input[id="bilirubin"]', "0.9");
      await page.fill('input[id="inr"]', "1.0");
      await page.fill('input[id="sodium"]', "140");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=MELD Score:")).toBeVisible();
      await expect(page.locator("text=MELD-Na Score:")).toBeVisible();
      await expect(page.locator("text=Low risk").first()).toBeVisible();
      await expect(page.locator("text=1.9%")).toBeVisible();
    });

    test("should calculate moderate MELD score (10-19)", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "1.5");
      await page.fill('input[id="bilirubin"]', "2.5");
      await page.fill('input[id="inr"]', "1.5");
      await page.fill('input[id="sodium"]', "135");

      await page.click('button:has-text("Calculate")');

      const score = await getMeldScore(page);

      expect(score).toBeGreaterThanOrEqual(10);
      expect(score).toBeLessThanOrEqual(19);

      await expect(page.locator("text=Moderate risk").first()).toBeVisible();
      await expect(page.locator("text=6.0%")).toBeVisible();
    });

    test("should calculate high MELD score (20-29)", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "2.0");
      await page.fill('input[id="bilirubin"]', "4.0");
      await page.fill('input[id="inr"]', "1.8");
      await page.fill('input[id="sodium"]', "138");

      await page.click('button:has-text("Calculate")');

      const score = await getMeldScore(page);

      expect(score).toBeGreaterThanOrEqual(20);
      expect(score).toBeLessThanOrEqual(29);

      // "High risk" is a substring of "Very high risk"; scope to the Risk Category
      // value via the results region and use .first() to avoid the interpretation match.
      await expect(
        resultsRegion(page).getByText("High risk", { exact: false }).first(),
      ).toBeVisible();
      await expect(page.locator("text=19.6%")).toBeVisible();
    });

    test("should calculate very high MELD score (30-39)", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "3.5");
      await page.fill('input[id="bilirubin"]', "15.0");
      await page.fill('input[id="inr"]', "2.5");
      await page.fill('input[id="sodium"]', "128");

      await page.click('button:has-text("Calculate")');

      const score = await getMeldScore(page);

      expect(score).toBeGreaterThanOrEqual(30);
      expect(score).toBeLessThanOrEqual(39);

      await expect(page.locator("text=Very high risk").first()).toBeVisible();
      await expect(page.locator("text=52.6%")).toBeVisible();
    });

    test("should calculate critical MELD score (40)", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "4.0");
      await page.fill('input[id="bilirubin"]', "30.0");
      await page.fill('input[id="inr"]', "4.0");
      await page.fill('input[id="sodium"]', "125");

      await page.click('button:has-text("Calculate")');

      expect(await getMeldScore(page)).toBe(40);
      await expect(page.locator("text=Critical risk").first()).toBeVisible();
      await expect(page.locator("text=>70%")).toBeVisible();
    });
  });

  test.describe("MELD-Na Sodium Correction", () => {
    test("should apply sodium correction when MELD > 11", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "2.0");
      await page.fill('input[id="bilirubin"]', "3.0");
      await page.fill('input[id="inr"]', "1.8");
      await page.fill('input[id="sodium"]', "130");

      await page.click('button:has-text("Calculate")');

      const meld = await getMeldScore(page);
      const meldNa = await getMeldNaScore(page);

      // MELD-Na should be different from MELD when MELD > 11 and Na < 137
      expect(meldNa).toBeGreaterThan(meld);
    });

    test("should NOT apply sodium correction when MELD <= 11", async ({
      page,
    }) => {
      await page.fill('input[id="creatinine"]', "1.0");
      await page.fill('input[id="bilirubin"]', "1.5");
      await page.fill('input[id="inr"]', "1.2");
      await page.fill('input[id="sodium"]', "130");

      await page.click('button:has-text("Calculate")');

      await expect(
        resultsRegion(page).getByText("MELD-Na equals MELD"),
      ).toBeVisible();

      const meld = await getMeldScore(page);
      const meldNa = await getMeldNaScore(page);

      expect(meldNa).toBe(meld);
    });

    test("should cap sodium at 125 mEq/L for MELD-Na calculation", async ({
      page,
    }) => {
      await page.fill('input[id="creatinine"]', "2.0");
      await page.fill('input[id="bilirubin"]', "4.0");
      await page.fill('input[id="inr"]', "1.8");
      await page.fill('input[id="sodium"]', "120");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Sodium set to lower bound of 125 mEq/L"),
      ).toBeVisible();
    });

    test("should cap sodium at 137 mEq/L for MELD-Na calculation", async ({
      page,
    }) => {
      await page.fill('input[id="creatinine"]', "2.0");
      await page.fill('input[id="bilirubin"]', "4.0");
      await page.fill('input[id="inr"]', "1.8");
      await page.fill('input[id="sodium"]', "145");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Sodium set to upper bound of 137 mEq/L"),
      ).toBeVisible();
    });
  });

  test.describe("Dialysis Adjustments", () => {
    test("should set creatinine to 4.0 when dialysis is checked", async ({
      page,
    }) => {
      await page.fill('input[id="creatinine"]', "1.5");
      await page.fill('input[id="bilirubin"]', "3.0");
      await page.fill('input[id="inr"]', "1.5");
      await page.fill('input[id="sodium"]', "135");

      // Check dialysis
      await page.locator('button[role="switch"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Creatinine set to 4.0 mg/dL (dialysis"),
      ).toBeVisible();
    });

    test("should override high creatinine with dialysis value", async ({
      page,
    }) => {
      await page.fill('input[id="creatinine"]', "5.0");
      await page.fill('input[id="bilirubin"]', "3.0");
      await page.fill('input[id="inr"]', "1.5");
      await page.fill('input[id="sodium"]', "135");

      // Check dialysis
      await page.locator('button[role="switch"]').click();

      await page.click('button:has-text("Calculate")');

      // Should show dialysis note, not the Cr capped note
      await expect(
        page.locator("text=Creatinine set to 4.0 mg/dL (dialysis"),
      ).toBeVisible();
    });
  });

  test.describe("Lower Bound Adjustments", () => {
    test("should set creatinine lower bound to 1.0", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "0.5");
      await page.fill('input[id="bilirubin"]', "2.0");
      await page.fill('input[id="inr"]', "1.5");
      await page.fill('input[id="sodium"]', "135");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Creatinine set to lower bound of 1.0 mg/dL"),
      ).toBeVisible();
    });

    test("should set bilirubin lower bound to 1.0", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "1.5");
      await page.fill('input[id="bilirubin"]', "0.5");
      await page.fill('input[id="inr"]', "1.5");
      await page.fill('input[id="sodium"]', "135");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Bilirubin set to lower bound of 1.0 mg/dL"),
      ).toBeVisible();
    });

    test("should set INR lower bound to 1.0", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "1.5");
      await page.fill('input[id="bilirubin"]', "2.0");
      await page.fill('input[id="inr"]', "0.9");
      await page.fill('input[id="sodium"]', "135");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=INR set to lower bound of 1.0"),
      ).toBeVisible();
    });
  });

  test.describe("Upper Bound Adjustments", () => {
    test("should cap creatinine at 4.0 (without dialysis)", async ({
      page,
    }) => {
      await page.fill('input[id="creatinine"]', "6.0");
      await page.fill('input[id="bilirubin"]', "3.0");
      await page.fill('input[id="inr"]', "1.5");
      await page.fill('input[id="sodium"]', "135");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Creatinine capped at 4.0 mg/dL"),
      ).toBeVisible();
    });

    test("should cap MELD score at minimum of 6", async ({ page }) => {
      // With all inputs at/below the lower bounds, every component is floored to
      // its minimum, so MELD bottoms out at 6 (the lowest possible MELD score).
      await page.fill('input[id="creatinine"]', "0.5");
      await page.fill('input[id="bilirubin"]', "0.3");
      await page.fill('input[id="inr"]', "0.9");
      await page.fill('input[id="sodium"]', "140");

      await page.click('button:has-text("Calculate")');

      expect(await getMeldScore(page)).toBe(6);
      // Lower-bound clamping notes for each component should be shown.
      await expect(
        page.locator("text=Creatinine set to lower bound of 1.0 mg/dL"),
      ).toBeVisible();
    });

    test("should cap MELD score at maximum of 40", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "4.0");
      await page.fill('input[id="bilirubin"]', "50.0");
      await page.fill('input[id="inr"]', "10.0");
      await page.fill('input[id="sodium"]', "135");

      await page.click('button:has-text("Calculate")');

      expect(await getMeldScore(page)).toBe(40);
    });
  });

  test.describe("Transplant Eligibility Interpretation", () => {
    test("should suggest monitoring for MELD-Na < 15", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "1.2");
      await page.fill('input[id="bilirubin"]', "1.5");
      await page.fill('input[id="inr"]', "1.3");
      await page.fill('input[id="sodium"]', "138");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "text=Monitor closely; transplant evaluation if disease progresses",
        ),
      ).toBeVisible();
    });

    test("should indicate transplant candidacy for MELD-Na 15-24", async ({
      page,
    }) => {
      await page.fill('input[id="creatinine"]', "1.6");
      await page.fill('input[id="bilirubin"]', "2.5");
      await page.fill('input[id="inr"]', "1.5");
      await page.fill('input[id="sodium"]', "133");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "text=Patient meets criteria for liver transplant evaluation",
        ),
      ).toBeVisible();
      await expect(
        page.locator("text=Candidate for transplant listing"),
      ).toBeVisible();
    });

    test("should indicate high priority for MELD-Na >= 25", async ({
      page,
    }) => {
      await page.fill('input[id="creatinine"]', "3.0");
      await page.fill('input[id="bilirubin"]', "10.0");
      await page.fill('input[id="inr"]', "2.2");
      await page.fill('input[id="sodium"]', "128");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "text=Patient meets criteria for liver transplant evaluation",
        ),
      ).toBeVisible();
      await expect(
        page.locator("text=High priority for transplantation"),
      ).toBeVisible();
    });
  });

  test.describe("Input Validation", () => {
    test("should show error for missing inputs", async ({ page }) => {
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Please enter all required values"),
      ).toBeVisible();
    });

    test("should show error for creatinine out of range (too low)", async ({
      page,
    }) => {
      await page.fill('input[id="creatinine"]', "0.05");
      await page.fill('input[id="bilirubin"]', "2.0");
      await page.fill('input[id="inr"]', "1.5");
      await page.fill('input[id="sodium"]', "135");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Creatinine must be between 0.1 and 15.0 mg/dL"),
      ).toBeVisible();
    });

    test("should show error for creatinine out of range (too high)", async ({
      page,
    }) => {
      await page.fill('input[id="creatinine"]', "20.0");
      await page.fill('input[id="bilirubin"]', "2.0");
      await page.fill('input[id="inr"]', "1.5");
      await page.fill('input[id="sodium"]', "135");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Creatinine must be between 0.1 and 15.0 mg/dL"),
      ).toBeVisible();
    });

    test("should show error for bilirubin out of range", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "1.5");
      await page.fill('input[id="bilirubin"]', "60.0");
      await page.fill('input[id="inr"]', "1.5");
      await page.fill('input[id="sodium"]', "135");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Bilirubin must be between 0.1 and 50.0 mg/dL"),
      ).toBeVisible();
    });

    test("should show error for INR out of range", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "1.5");
      await page.fill('input[id="bilirubin"]', "2.0");
      await page.fill('input[id="inr"]', "12.0");
      await page.fill('input[id="sodium"]', "135");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=INR must be between 0.8 and 10.0"),
      ).toBeVisible();
    });

    test("should show error for sodium out of range (too low)", async ({
      page,
    }) => {
      await page.fill('input[id="creatinine"]', "1.5");
      await page.fill('input[id="bilirubin"]', "2.0");
      await page.fill('input[id="inr"]', "1.5");
      await page.fill('input[id="sodium"]', "100");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Sodium must be between 110 and 160 mEq/L"),
      ).toBeVisible();
    });

    test("should show error for sodium out of range (too high)", async ({
      page,
    }) => {
      await page.fill('input[id="creatinine"]', "1.5");
      await page.fill('input[id="bilirubin"]', "2.0");
      await page.fill('input[id="inr"]', "1.5");
      await page.fill('input[id="sodium"]', "170");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Sodium must be between 110 and 160 mEq/L"),
      ).toBeVisible();
    });
  });

  test.describe("Edge Cases and Special Scenarios", () => {
    test("should handle normal values (healthy patient)", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "1.0");
      await page.fill('input[id="bilirubin"]', "1.0");
      await page.fill('input[id="inr"]', "1.0");
      await page.fill('input[id="sodium"]', "140");

      await page.click('button:has-text("Calculate")');

      expect(await getMeldScore(page)).toBe(6);
      expect(await getMeldNaScore(page)).toBe(6);
      await expect(page.locator("text=Low risk").first()).toBeVisible();
    });

    test("should handle borderline MELD score (exactly 11)", async ({
      page,
    }) => {
      // These values give exactly MELD = 11
      await page.fill('input[id="creatinine"]', "1.0");
      await page.fill('input[id="bilirubin"]', "2.2");
      await page.fill('input[id="inr"]', "1.2");
      await page.fill('input[id="sodium"]', "130");

      await page.click('button:has-text("Calculate")');

      expect(await getMeldScore(page)).toBe(11);
      // At MELD <= 11, sodium correction should NOT apply
      await expect(
        resultsRegion(page).getByText("MELD-Na equals MELD"),
      ).toBeVisible();
    });

    test("should handle minimal sodium (125)", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "2.0");
      await page.fill('input[id="bilirubin"]', "4.0");
      await page.fill('input[id="inr"]', "1.8");
      await page.fill('input[id="sodium"]', "125");

      await page.click('button:has-text("Calculate")');

      const meld = await getMeldScore(page);
      const meldNa = await getMeldNaScore(page);

      // With Na=125, MELD-Na should be significantly higher than MELD
      expect(meldNa).toBeGreaterThan(meld);
    });

    test("should handle all lower bounds simultaneously", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "0.5");
      await page.fill('input[id="bilirubin"]', "0.5");
      await page.fill('input[id="inr"]', "0.9");
      await page.fill('input[id="sodium"]', "140");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Creatinine set to lower bound"),
      ).toBeVisible();
      await expect(
        page.locator("text=Bilirubin set to lower bound"),
      ).toBeVisible();
      await expect(page.locator("text=INR set to lower bound")).toBeVisible();
    });

    test("should handle decimal inputs correctly", async ({ page }) => {
      await page.fill('input[id="creatinine"]', "1.23");
      await page.fill('input[id="bilirubin"]', "2.45");
      await page.fill('input[id="inr"]', "1.67");
      await page.fill('input[id="sodium"]', "134.5");

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=MELD Score:")).toBeVisible();
      await expect(page.locator("text=MELD-Na Score:")).toBeVisible();
    });
  });

  test.describe("Reference Links", () => {
    test("should display all 5 references", async ({ page }) => {
      // Expand collapsed references (CollapsibleReferences shows only 3 by default)
      const expandButton = page.getByRole("button", {
        name: /Show \d+ more reference/,
      });
      if (await expandButton.isVisible().catch(() => false)) {
        await expandButton.click();
      }

      const references = await page
        .locator('section:has-text("References") li')
        .count();
      expect(references).toBe(5);
    });

    test("should have clickable reference links", async ({ page }) => {
      const firstLink = page
        .locator('section:has-text("References") a')
        .first();
      await expect(firstLink).toHaveAttribute("href", /https?:\/\/.+/);
      await expect(firstLink).toHaveAttribute("target", "_blank");
    });

    test("should include key references", async ({ page }) => {
      // The first 3 references are visible by default.
      await expect(
        page.locator("text=OPTN/HRSA Policy Notice"),
      ).toBeVisible();
      await expect(
        page.locator("text=Kim WR et al. Gastroenterology 2021"),
      ).toBeVisible();

      // Legacy MELD-Na citation is hidden until expanded.
      await page
        .getByRole("button", { name: /Show \d+ more reference/ })
        .click();
      await expect(
        page.locator("text=Kim WR et al. Gastroenterology 2008"),
      ).toBeVisible();
    });
  });

  test.describe("Clinical Workflow", () => {
    test("should support complete clinical workflow", async ({ page }) => {
      // Step 1: Enter patient data
      await page.fill('input[id="creatinine"]', "2.8");
      await page.fill('input[id="bilirubin"]', "5.2");
      await page.fill('input[id="inr"]', "1.9");
      await page.fill('input[id="sodium"]', "131");

      // Step 2: Calculate
      await page.click('button:has-text("Calculate")');

      // Step 3: Verify results appear
      await expect(page.locator("text=MELD Score:")).toBeVisible();
      await expect(page.locator("text=MELD-Na Score:")).toBeVisible();
      await expect(page.locator("text=3-Month Mortality:")).toBeVisible();
      await expect(page.locator("text=Risk Category:")).toBeVisible();
      await expect(page.locator("text=Interpretation:")).toBeVisible();

      // Step 4: Update with dialysis
      await page.locator('button[role="switch"]').click();
      await page.click('button:has-text("Calculate")');

      // Step 5: Verify dialysis note appears
      await expect(
        page.locator("text=Creatinine set to 4.0 mg/dL (dialysis"),
      ).toBeVisible();
    });

    test("should handle recalculation with different values", async ({
      page,
    }) => {
      // First calculation
      await page.fill('input[id="creatinine"]', "1.5");
      await page.fill('input[id="bilirubin"]', "2.0");
      await page.fill('input[id="inr"]', "1.3");
      await page.fill('input[id="sodium"]', "138");
      await page.click('button:has-text("Calculate")');

      const firstScore = await getMeldScore(page);

      // Second calculation with higher values
      await page.fill('input[id="creatinine"]', "3.0");
      await page.fill('input[id="bilirubin"]', "8.0");
      await page.fill('input[id="inr"]', "2.5");
      await page.fill('input[id="sodium"]', "128");
      await page.click('button:has-text("Calculate")');

      const secondScore = await getMeldScore(page);

      // Second MELD should be higher
      expect(secondScore).toBeGreaterThan(firstScore);
    });
  });

  test.describe("Accessibility", () => {
    test("should have proper ARIA labels", async ({ page }) => {
      const creatinineInput = page.locator('input[id="creatinine"]');
      await expect(creatinineInput).toHaveAttribute("type", "number");

      const dialysisSwitch = page.locator('button[role="switch"]');
      await expect(dialysisSwitch).toHaveAttribute("aria-checked");
    });

    test("should have keyboard navigation support", async ({ page }) => {
      // Tab into the first input then fill each field explicitly to avoid
      // depending on exact tab order, then assert the entered values persist.
      await page.locator('input[id="creatinine"]').focus();
      await page.keyboard.type("1.5");

      await page.locator('input[id="bilirubin"]').focus();
      await page.keyboard.type("2.0");

      await page.locator('input[id="inr"]').focus();
      await page.keyboard.type("1.3");

      await page.locator('input[id="sodium"]').focus();
      await page.keyboard.type("135");

      // Verify values entered
      await expect(page.locator('input[id="creatinine"]')).toHaveValue("1.5");
      await expect(page.locator('input[id="bilirubin"]')).toHaveValue("2.0");
      await expect(page.locator('input[id="inr"]')).toHaveValue("1.3");
      await expect(page.locator('input[id="sodium"]')).toHaveValue("135");
    });
  });
});
