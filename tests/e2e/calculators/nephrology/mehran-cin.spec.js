import { test, expect } from "@playwright/test";
import { navigateToCalculator } from "../../../helpers/calculator-test-helper.js";

/**
 * E2E Tests for Mehran CIN Risk Score Calculator
 * Predicts contrast-induced nephropathy and dialysis risk after PCI/angiography
 *
 * Scoring System:
 * - Hypotension (SBP <80 for >=1hr, requiring inotropes/IABP): +5 pts
 * - IABP use: +5 pts
 * - CHF (NYHA III-IV or pulmonary edema): +5 pts
 * - Age >75: +4 pts
 * - Anemia (Hct <39% men, <36% women): +3 pts
 * - Diabetes: +3 pts
 * - Serum creatinine >1.5 mg/dL: +4 pts
 * - eGFR <20: +6 pts
 * - eGFR 20-40: +4 pts
 * - eGFR 40-60: +2 pts
 * - Contrast volume: +1 pt per 100 mL
 *
 * Risk Categories:
 * - Low (<=5 pts): 7.5% CIN, 0.04% dialysis
 * - Moderate (6-10 pts): 14% CIN, 0.12% dialysis
 * - High (11-15 pts): 26.1% CIN, 1.09% dialysis
 * - Very High (>=16 pts): 57.3% CIN, 12.6% dialysis
 */

test.describe("Mehran CIN Risk Score Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, "Mehran CIN Risk Score");
  });

  test.describe("Visual and UI Tests", () => {
    test("should display calculator with correct title and description", async ({
      page,
    }) => {
      await expect(page.locator("h2")).toContainText("Mehran CIN Risk Score");
    });

    test("should have all clinical risk factor checkboxes", async ({
      page,
    }) => {
      // Target labels specifically (these are checkbox labels with Switch components)
      await expect(
        page.locator("label").filter({ hasText: "Hypotension" }),
      ).toBeVisible();
      await expect(
        page
          .locator("label")
          .filter({ hasText: "Intra-aortic balloon pump (IABP)" }),
      ).toBeVisible();
      await expect(
        page.locator("label").filter({ hasText: "Congestive heart failure" }),
      ).toBeVisible();
      await expect(
        page.locator("label").filter({ hasText: "Age >75 years" }),
      ).toBeVisible();
      await expect(
        page.locator("label").filter({ hasText: /^Anemia$/ }),
      ).toBeVisible();
      await expect(
        page.locator("label").filter({ hasText: "Diabetes mellitus" }),
      ).toBeVisible();
    });

    test("should have renal function input fields", async ({ page }) => {
      await expect(
        page.locator("label").filter({ hasText: "Serum Creatinine (mg/dL)" }),
      ).toBeVisible();
      await expect(
        page.locator("label").filter({ hasText: "eGFR (mL/min/1.73m" }),
      ).toBeVisible();
    });

    test("should have contrast volume input field", async ({ page }) => {
      await expect(
        page.locator("label").filter({ hasText: "Contrast Volume (mL)" }),
      ).toBeVisible();
    });

    test("should display info section with CIN explanation", async ({
      page,
    }) => {
      // Target the info section specifically (blue background box)
      const infoSection = page.locator(".bg-blue-50\\/60");
      await expect(infoSection).toBeVisible();
      await expect(
        infoSection.getByText("Contrast-Induced Nephropathy").first(),
      ).toBeVisible();
      await expect(infoSection.getByText("Risk Categories")).toBeVisible();
    });
  });

  test.describe("Input Validation", () => {
    test("should show error when no renal function provided", async ({
      page,
    }) => {
      // Click calculate without entering creatinine or eGFR
      await page.click("button:has-text('Calculate')");

      await expect(
        page.locator(
          "text=Please provide either serum creatinine or eGFR to calculate the risk score",
        ),
      ).toBeVisible();
    });

    test("should calculate when only creatinine is provided", async ({
      page,
    }) => {
      await page.fill('input[id="creatinine"]', "1.0");
      await page.click("button:has-text('Calculate')");

      // Target the results section (section with aria-live="polite")
      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Low Risk")).toBeVisible();
    });

    test("should calculate when only eGFR is provided", async ({ page }) => {
      await page.fill('input[id="egfr"]', "60");
      await page.click("button:has-text('Calculate')");

      // Target the results section
      const results = page.locator('section[aria-live="polite"]');
      await expect(results.locator("text=Low Risk")).toBeVisible();
    });
  });

  test.describe("Low Risk Calculations (score <= 5)", () => {
    test("should calculate low risk for healthy patient with normal renal function", async ({
      page,
    }) => {
      // Normal creatinine and eGFR, no risk factors, minimal contrast
      await page.fill('input[id="creatinine"]', "0.9");
      await page.fill('input[id="egfr"]', "90");
      await page.fill('input[id="contrast_volume"]', "100");

      await page.click("button:has-text('Calculate')");

      // Target the results section
      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Risk Category:')"),
      ).toContainText("Low Risk");
      await expect(results.locator("p:has-text('CIN Risk:')")).toContainText(
        "7.5%",
      );
      await expect(
        results.locator("p:has-text('Dialysis Risk:')"),
      ).toContainText("0.04%");
    });

    test("should calculate low risk with mild renal impairment only (eGFR 40-60)", async ({
      page,
    }) => {
      // eGFR 50 = +2 pts
      await page.fill('input[id="egfr"]', "50");
      await page.fill('input[id="contrast_volume"]', "150"); // +1 pt

      await page.click("button:has-text('Calculate')");

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Mehran Score:')"),
      ).toContainText("3 points");
      await expect(
        results.locator("p:has-text('Risk Category:')"),
      ).toContainText("Low Risk");
    });

    test("should calculate low risk with diabetes only (3 pts)", async ({
      page,
    }) => {
      // Click the switch for Diabetes mellitus
      await page.locator('button[id="diabetes"]').click();

      await page.fill('input[id="creatinine"]', "0.9");
      await page.fill('input[id="egfr"]', "85");

      await page.click("button:has-text('Calculate')");

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Mehran Score:')"),
      ).toContainText("3 points");
      await expect(
        results.locator("p:has-text('Risk Category:')"),
      ).toContainText("Low Risk");
    });

    test("should calculate low risk with anemia only (3 pts)", async ({
      page,
    }) => {
      // Click the switch for Anemia
      await page.locator('button[id="anemia"]').click();

      await page.fill('input[id="egfr"]', "80");

      await page.click("button:has-text('Calculate')");

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Mehran Score:')"),
      ).toContainText("3 points");
      await expect(
        results.locator("p:has-text('Risk Category:')"),
      ).toContainText("Low Risk");
    });

    test("should calculate low risk with age >75 only (4 pts)", async ({
      page,
    }) => {
      // Click the switch for Age >75 years
      await page.locator('button[id="age_over_75"]').click();

      await page.fill('input[id="egfr"]', "80");

      await page.click("button:has-text('Calculate')");

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Mehran Score:')"),
      ).toContainText("4 points");
      await expect(
        results.locator("p:has-text('Risk Category:')"),
      ).toContainText("Low Risk");
    });
  });

  test.describe("Moderate Risk Calculations (score 6-10)", () => {
    test("should calculate moderate risk with diabetes + anemia (6 pts)", async ({
      page,
    }) => {
      // Diabetes (3) + Anemia (3) = 6 pts
      await page.locator('button[id="diabetes"]').click();
      await page.locator('button[id="anemia"]').click();

      await page.fill('input[id="egfr"]', "70");

      await page.click("button:has-text('Calculate')");

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Mehran Score:')"),
      ).toContainText("6 points");
      await expect(
        results.locator("p:has-text('Risk Category:')"),
      ).toContainText("Moderate Risk");
      await expect(results.locator("p:has-text('CIN Risk:')")).toContainText(
        "14.0%",
      );
      await expect(
        results.locator("p:has-text('Dialysis Risk:')"),
      ).toContainText("0.12%");
    });

    test("should calculate moderate risk with age >75 + diabetes + anemia (10 pts)", async ({
      page,
    }) => {
      // Age >75 (4) + Diabetes (3) + Anemia (3) = 10 pts
      await page.locator('button[id="age_over_75"]').click();
      await page.locator('button[id="diabetes"]').click();
      await page.locator('button[id="anemia"]').click();

      await page.fill('input[id="egfr"]', "70");

      await page.click("button:has-text('Calculate')");

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Mehran Score:')"),
      ).toContainText("10 points");
      await expect(
        results.locator("p:has-text('Risk Category:')"),
      ).toContainText("Moderate Risk");
    });

    test("should calculate moderate risk with eGFR 20-40 (4 pts) + diabetes (3 pts) + 300mL contrast (3 pts)", async ({
      page,
    }) => {
      // eGFR 30 (4) + Diabetes (3) + 300mL contrast (3) = 10 pts
      await page.locator('button[id="diabetes"]').click();

      await page.fill('input[id="egfr"]', "30");
      await page.fill('input[id="contrast_volume"]', "300");

      await page.click("button:has-text('Calculate')");

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Mehran Score:')"),
      ).toContainText("10 points");
      await expect(
        results.locator("p:has-text('Risk Category:')"),
      ).toContainText("Moderate Risk");
    });

    test("should calculate moderate risk with creatinine >1.5 (4 pts) + contrast + diabetes", async ({
      page,
    }) => {
      // Creatinine >1.5 (4) + Diabetes (3) + 200mL contrast (2) = 9 pts
      // Note: Per Mehran methodology, creatinine >1.5 scoring is only used when eGFR is not provided
      await page.locator('button[id="diabetes"]').click();

      await page.fill('input[id="creatinine"]', "1.8");
      // Don't provide eGFR - calculator will use creatinine >1.5 fallback scoring
      await page.fill('input[id="contrast_volume"]', "200");

      await page.click("button:has-text('Calculate')");

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Risk Category:')"),
      ).toContainText("Moderate Risk");
    });
  });

  test.describe("High Risk Calculations (score 11-15)", () => {
    test("should calculate high risk with CHF + diabetes + anemia (11 pts)", async ({
      page,
    }) => {
      // CHF (5) + Diabetes (3) + Anemia (3) = 11 pts
      await page.locator('button[id="chf"]').click();
      await page.locator('button[id="diabetes"]').click();
      await page.locator('button[id="anemia"]').click();

      await page.fill('input[id="egfr"]', "70");

      await page.click("button:has-text('Calculate')");

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Mehran Score:')"),
      ).toContainText("11 points");
      await expect(
        results.locator("p:has-text('Risk Category:')"),
      ).toContainText("High Risk");
      await expect(results.locator("p:has-text('CIN Risk:')")).toContainText(
        "26.1%",
      );
      await expect(
        results.locator("p:has-text('Dialysis Risk:')"),
      ).toContainText("1.09%");
    });

    test("should calculate high risk with hypotension + age >75 + diabetes (12 pts)", async ({
      page,
    }) => {
      // Hypotension (5) + Age >75 (4) + Diabetes (3) = 12 pts
      await page.locator('button[id="hypotension"]').click();
      await page.locator('button[id="age_over_75"]').click();
      await page.locator('button[id="diabetes"]').click();

      await page.fill('input[id="egfr"]', "70");

      await page.click("button:has-text('Calculate')");

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Mehran Score:')"),
      ).toContainText("12 points");
      await expect(
        results.locator("p:has-text('Risk Category:')"),
      ).toContainText("High Risk");
    });

    test("should calculate high risk with IABP + anemia + eGFR 40-60 (10 pts) + 200mL contrast (2 pts)", async ({
      page,
    }) => {
      // IABP (5) + Anemia (3) + eGFR 45 (2) + 200mL (2) = 12 pts
      await page.locator('button[id="iabp"]').click();
      await page.locator('button[id="anemia"]').click();

      await page.fill('input[id="egfr"]', "45");
      await page.fill('input[id="contrast_volume"]', "200");

      await page.click("button:has-text('Calculate')");

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Mehran Score:')"),
      ).toContainText("12 points");
      await expect(
        results.locator("p:has-text('Risk Category:')"),
      ).toContainText("High Risk");
    });

    test("should calculate high risk with severe renal impairment (eGFR <20)", async ({
      page,
    }) => {
      // eGFR <20 (6) + Diabetes (3) + Anemia (3) + 300mL (3) = 15 pts
      await page.locator('button[id="diabetes"]').click();
      await page.locator('button[id="anemia"]').click();

      await page.fill('input[id="egfr"]', "15");
      await page.fill('input[id="contrast_volume"]', "300");

      await page.click("button:has-text('Calculate')");

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Mehran Score:')"),
      ).toContainText("15 points");
      await expect(
        results.locator("p:has-text('Risk Category:')"),
      ).toContainText("High Risk");
    });
  });

  test.describe("Very High Risk Calculations (score >= 16)", () => {
    test("should calculate very high risk with multiple factors (16 pts)", async ({
      page,
    }) => {
      // CHF (5) + IABP (5) + Diabetes (3) + Anemia (3) = 16 pts
      await page.locator('button[id="chf"]').click();
      await page.locator('button[id="iabp"]').click();
      await page.locator('button[id="diabetes"]').click();
      await page.locator('button[id="anemia"]').click();

      await page.fill('input[id="egfr"]', "70");

      await page.click("button:has-text('Calculate')");

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Mehran Score:')"),
      ).toContainText("16 points");
      await expect(
        results.locator("p:has-text('Risk Category:')"),
      ).toContainText("Very High Risk");
      await expect(results.locator("p:has-text('CIN Risk:')")).toContainText(
        "57.3%",
      );
      await expect(
        results.locator("p:has-text('Dialysis Risk:')"),
      ).toContainText("12.6%");
    });

    test("should calculate very high risk with hemodynamic instability and renal impairment", async ({
      page,
    }) => {
      // Hypotension (5) + IABP (5) + eGFR 30 (4) + 300mL contrast (3) = 17 pts
      await page.locator('button[id="hypotension"]').click();
      await page.locator('button[id="iabp"]').click();

      await page.fill('input[id="egfr"]', "30");
      await page.fill('input[id="contrast_volume"]', "300");

      await page.click("button:has-text('Calculate')");

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Mehran Score:')"),
      ).toContainText("17 points");
      await expect(
        results.locator("p:has-text('Risk Category:')"),
      ).toContainText("Very High Risk");
    });

    test("should calculate very high risk with all risk factors", async ({
      page,
    }) => {
      // Hypotension (5) + IABP (5) + CHF (5) + Age >75 (4) + Anemia (3) + Diabetes (3) + eGFR <20 (6) + Cr >1.5 (4) + 500mL (5) = 40 pts
      await page.locator('button[id="hypotension"]').click();
      await page.locator('button[id="iabp"]').click();
      await page.locator('button[id="chf"]').click();
      await page.locator('button[id="age_over_75"]').click();
      await page.locator('button[id="anemia"]').click();
      await page.locator('button[id="diabetes"]').click();

      await page.fill('input[id="creatinine"]', "2.5");
      await page.fill('input[id="egfr"]', "15");
      await page.fill('input[id="contrast_volume"]', "500");

      await page.click("button:has-text('Calculate')");

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Risk Category:')"),
      ).toContainText("Very High Risk");
      await expect(results.locator("p:has-text('CIN Risk:')")).toContainText(
        "57.3%",
      );
      await expect(
        results.locator("p:has-text('Dialysis Risk:')"),
      ).toContainText("12.6%");
    });

    test("should calculate very high risk with high contrast volume alone contributing", async ({
      page,
    }) => {
      // CHF (5) + Age >75 (4) + eGFR 30 (4) + 600mL contrast (6) = 19 pts
      await page.locator('button[id="chf"]').click();
      await page.locator('button[id="age_over_75"]').click();

      await page.fill('input[id="egfr"]', "30");
      await page.fill('input[id="contrast_volume"]', "600");

      await page.click("button:has-text('Calculate')");

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Mehran Score:')"),
      ).toContainText("19 points");
      await expect(
        results.locator("p:has-text('Risk Category:')"),
      ).toContainText("Very High Risk");
    });
  });

  test.describe("Score Breakdown Verification", () => {
    test("should show correct breakdown for clinical factors", async ({
      page,
    }) => {
      await page.locator('button[id="hypotension"]').click();
      await page.locator('button[id="diabetes"]').click();

      await page.fill('input[id="egfr"]', "70");

      await page.click("button:has-text('Calculate')");

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Score Breakdown:')"),
      ).toContainText("Hypotension: +5");
      await expect(
        results.locator("p:has-text('Score Breakdown:')"),
      ).toContainText("Diabetes: +3");
    });

    test("should show correct breakdown for contrast volume", async ({
      page,
    }) => {
      await page.fill('input[id="egfr"]', "70");
      await page.fill('input[id="contrast_volume"]', "250");

      await page.click("button:has-text('Calculate')");

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Score Breakdown:')"),
      ).toContainText("Contrast volume (250 mL): +2");
    });

    test("should show correct breakdown for eGFR ranges", async ({ page }) => {
      await page.fill('input[id="egfr"]', "35");

      await page.click("button:has-text('Calculate')");

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Score Breakdown:')"),
      ).toContainText("eGFR 20-40: +4");
    });

    test("should show creatinine >1.5 in breakdown when eGFR not provided", async ({ page }) => {
      // Per Mehran methodology, creatinine >1.5 scoring is used only when eGFR is not available
      await page.fill('input[id="creatinine"]', "1.8");
      // Do not provide eGFR - calculator will use creatinine >1.5 fallback scoring

      await page.click("button:has-text('Calculate')");

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Score Breakdown:')"),
      ).toContainText("Creatinine >1.5: +4");
    });
  });

  test.describe("Contrast Limits Guidance", () => {
    test("should display contrast limits based on eGFR", async ({ page }) => {
      await page.fill('input[id="egfr"]', "60");

      await page.click("button:has-text('Calculate')");

      // Target: <120 mL (60 * 2); Maximum: <180 mL (60 * 3)
      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Contrast Limits:')"),
      ).toContainText("Target: <120 mL");
      await expect(
        results.locator("p:has-text('Contrast Limits:')"),
      ).toContainText("Maximum: <180 mL");
    });

    test("should display lower contrast limits for impaired eGFR", async ({
      page,
    }) => {
      await page.fill('input[id="egfr"]', "30");

      await page.click("button:has-text('Calculate')");

      // Target: <60 mL (30 * 2); Maximum: <90 mL (30 * 3)
      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Contrast Limits:')"),
      ).toContainText("Target: <60 mL");
      await expect(
        results.locator("p:has-text('Contrast Limits:')"),
      ).toContainText("Maximum: <90 mL");
    });
  });

  test.describe("Prevention Recommendations", () => {
    test("should show standard hydration for low risk", async ({ page }) => {
      await page.fill('input[id="egfr"]', "80");

      await page.click("button:has-text('Calculate')");

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Prevention Recommendations:')"),
      ).toContainText("Standard hydration protocol");
    });

    test("should show aggressive hydration for moderate risk", async ({
      page,
    }) => {
      // Diabetes (3) + Anemia (3) = 6 pts
      await page.locator('button[id="diabetes"]').click();
      await page.locator('button[id="anemia"]').click();

      await page.fill('input[id="egfr"]', "70");

      await page.click("button:has-text('Calculate')");

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Prevention Recommendations:')"),
      ).toContainText("Aggressive hydration");
      await expect(
        results.locator("p:has-text('Prevention Recommendations:')"),
      ).toContainText("iso-osmolar contrast");
    });

    test("should show nephrology consultation for very high risk", async ({
      page,
    }) => {
      // CHF (5) + IABP (5) + Diabetes (3) + Anemia (3) = 16 pts
      await page.locator('button[id="chf"]').click();
      await page.locator('button[id="iabp"]').click();
      await page.locator('button[id="diabetes"]').click();
      await page.locator('button[id="anemia"]').click();

      await page.fill('input[id="egfr"]', "70");

      await page.click("button:has-text('Calculate')");

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Prevention Recommendations:')"),
      ).toContainText("Nephrology consultation");
      await expect(
        results.locator("p:has-text('Prevention Recommendations:')"),
      ).toContainText("delaying non-emergent procedure");
    });
  });

  test.describe("eGFR Estimation", () => {
    test("should estimate eGFR from creatinine when eGFR not provided", async ({
      page,
    }) => {
      await page.fill('input[id="creatinine"]', "1.2");

      await page.click("button:has-text('Calculate')");

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Estimated eGFR:')"),
      ).toBeVisible();
    });
  });

  test.describe("Edge Cases", () => {
    test("should handle very low contrast volume (no points)", async ({
      page,
    }) => {
      await page.fill('input[id="egfr"]', "80");
      await page.fill('input[id="contrast_volume"]', "50");

      await page.click("button:has-text('Calculate')");

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Mehran Score:')"),
      ).toContainText("0 points");
    });

    test("should handle borderline eGFR values (exactly 40)", async ({
      page,
    }) => {
      await page.fill('input[id="egfr"]', "40");

      await page.click("button:has-text('Calculate')");

      // eGFR 40 is in the 40-60 range = +2 pts
      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Score Breakdown:')"),
      ).toContainText("eGFR 40-60: +2");
    });

    test("should handle borderline eGFR values (exactly 20)", async ({
      page,
    }) => {
      await page.fill('input[id="egfr"]', "20");

      await page.click("button:has-text('Calculate')");

      // eGFR 20 is in the 20-40 range = +4 pts
      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Score Breakdown:')"),
      ).toContainText("eGFR 20-40: +4");
    });

    test("should handle normal eGFR (>=60) with no renal function points", async ({
      page,
    }) => {
      await page.fill('input[id="egfr"]', "90");

      await page.click("button:has-text('Calculate')");

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator("p:has-text('Mehran Score:')"),
      ).toContainText("0 points");
    });
  });

  test.describe("References", () => {
    test("should display Mehran study references", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: "References" }),
      ).toBeVisible();
      await expect(page.getByText("Mehran R").first()).toBeVisible();
    });

    test("should have primary source DOI link", async ({ page }) => {
      const mehranStudy = page.locator(
        'a[href="https://doi.org/10.1016/j.jacc.2004.06.034"]',
      );
      await expect(mehranStudy).toBeVisible();
    });

    test("should have ACR Contrast Manual link", async ({ page }) => {
      const acrManual = page.locator(
        'a[href="https://www.acr.org/Clinical-Resources/Contrast-Manual"]',
      );
      await expect(acrManual).toBeVisible();
    });

    test("should have PRESERVE trial reference", async ({ page }) => {
      const preserveTrial = page.locator(
        'a[href="https://doi.org/10.1056/NEJMoa1710660"]',
      );
      await expect(preserveTrial).toBeVisible();
    });
  });
});
