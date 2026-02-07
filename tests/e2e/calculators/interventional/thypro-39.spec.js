/**
 * ThyPRO-39 Calculator - E2E Tests
 *
 * Tests the Thyroid-Related Patient-Reported Outcome questionnaire
 * for thyroid-specific quality of life assessment.
 *
 * Test Coverage:
 * - UI: Title, all 39 questions, 5 response options, info, references
 * - All-zero score: All subscales = 0, composite = 0, "Minimal"
 * - All-max score: All subscales = 100, composite = 100, "Severe"
 * - Single subscale scoring
 * - Mixed scores with individual subscale verification
 * - Severity boundary tests (25/26, 50/51, 75/76)
 * - Validation: incomplete responses
 * - References: 4 DOI links present
 * - Responsive design
 */

import { test, expect } from "@playwright/test";
import {
  navigateToCalculator,
  verifyThemeConsistency,
  verifyMobileResponsive,
} from "../../../helpers/calculator-test-helper.js";

const CALCULATOR_NAME = "ThyPRO-39";

// Map question numbers (1-39) to field IDs
const QUESTION_IDS = [
  "gs1",
  "gs2",
  "gs3", // 1-3: Goiter Symptoms
  "hy1",
  "hy2",
  "hy3",
  "hy4", // 4-7: Hyperthyroid Symptoms
  "ho1",
  "ho2",
  "ho3",
  "ho4", // 8-11: Hypothyroid Symptoms
  "ey1",
  "ey2",
  "ey3", // 12-14: Eye Symptoms
  "ti1",
  "ti2",
  "ti3", // 15-17: Tiredness
  "co1",
  "co2",
  "co3", // 18-20: Cognitive Problems
  "an1",
  "an2",
  "an3", // 21-23: Anxiety
  "de1",
  "de2",
  "de3", // 24-26: Depression
  "em1",
  "em2",
  "em3", // 27-29: Emotional Susceptibility
  "sl1",
  "sl2",
  "sl3", // 30-32: Impaired Social Life
  "dl1",
  "dl2",
  "dl3", // 33-35: Impaired Daily Life
  "cc1",
  "cc2",
  "cc3", // 36-38: Cosmetic Complaints
  "qol1", // 39: Overall QoL
];

// Likert value to label mapping
const LIKERT_MAP = {
  0: "Not at all",
  1: "A little",
  2: "Some",
  3: "Quite a bit",
  4: "Very much",
};

/**
 * Click the radio input for a specific question and Likert value.
 * Uses the unique input id: "${fieldId}-${value}"
 */
async function selectAnswer(page, questionNum, likertValue) {
  const fieldId = QUESTION_IDS[questionNum - 1];
  const radioId = `${fieldId}-${likertValue}`;
  await page.locator(`label[for="${radioId}"]`).click();
}

/**
 * Answer all 39 questions with the same Likert value
 */
async function answerAllQuestions(page, likertValue) {
  for (let q = 1; q <= 39; q++) {
    await selectAnswer(page, q, likertValue);
  }
}

/**
 * Answer a range of questions with a given Likert value
 */
async function answerQuestionRange(page, start, end, likertValue) {
  for (let q = start; q <= end; q++) {
    await selectAnswer(page, q, likertValue);
  }
}

test.describe("ThyPRO-39 Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, CALCULATOR_NAME);
    await expect(page.locator("h2")).toContainText("ThyPRO-39");
  });

  test.describe("UI Elements", () => {
    test("should display calculator title and description", async ({
      page,
    }) => {
      await expect(page.locator("h2")).toContainText("ThyPRO-39");
      await expect(
        page.locator("text=Thyroid-Related Patient-Reported Outcome").first(),
      ).toBeVisible();
    });

    test("should display info panel with scoring details", async ({ page }) => {
      const infoPanel = page.getByTestId("calculator-info");
      await expect(infoPanel).toBeVisible();
      await expect(infoPanel).toContainText("ThyPRO-39");
      await expect(infoPanel).toContainText("39-item");
      await expect(infoPanel).toContainText("13 subscales");
      await expect(infoPanel).toContainText("past 4 weeks");
      await expect(infoPanel).toContainText("0-100");
      await expect(infoPanel).toContainText("Minimal impact");
      await expect(infoPanel).toContainText("Severe impact");
    });

    test("should display Goiter Symptoms subscale questions (1-3)", async ({
      page,
    }) => {
      await expect(
        page.locator("text=1. Pressure or tightness in your throat"),
      ).toBeVisible();
      await expect(
        page.locator("text=2. A lump or knot feeling in your throat"),
      ).toBeVisible();
      await expect(
        page.locator("text=3. Visible swelling in the front of your neck"),
      ).toBeVisible();
    });

    test("should display Overall QoL question (39)", async ({ page }) => {
      await page
        .locator("text=39. Overall, how much has your thyroid condition")
        .scrollIntoViewIfNeeded();
      await expect(
        page.locator(
          "text=39. Overall, how much has your thyroid condition affected your quality of life?",
        ),
      ).toBeVisible();
    });

    test("should display subscale labels as subLabels", async ({ page }) => {
      await expect(page.locator("text=Goiter Symptoms").first()).toBeVisible();
      await expect(
        page.locator("text=Hyperthyroid Symptoms").first(),
      ).toBeVisible();
    });

    test("should display 5 Likert response options for first question", async ({
      page,
    }) => {
      // Verify the 5 radio inputs exist for gs1
      await expect(page.locator('label[for="gs1-0"]')).toBeVisible();
      await expect(page.locator('label[for="gs1-1"]')).toBeVisible();
      await expect(page.locator('label[for="gs1-2"]')).toBeVisible();
      await expect(page.locator('label[for="gs1-3"]')).toBeVisible();
      await expect(page.locator('label[for="gs1-4"]')).toBeVisible();

      // Verify labels contain the right text
      await expect(page.locator('label[for="gs1-0"]')).toContainText(
        "Not at all",
      );
      await expect(page.locator('label[for="gs1-4"]')).toContainText(
        "Very much",
      );
    });
  });

  test.describe("Scoring", () => {
    test("All-zero score: all items = 0 should give all subscales 0.0", async ({
      page,
    }) => {
      await answerAllQuestions(page, 0);
      await page.locator('button:has-text("Calculate")').click();

      const results = page.locator('section[aria-live="polite"]');
      await expect(results).toBeVisible();

      // All subscale scores should be 0.0
      await expect(results).toContainText("Goiter Symptoms: 0.0 / 100");
      await expect(results).toContainText("Hyperthyroid Symptoms: 0.0 / 100");
      await expect(results).toContainText("Hypothyroid Symptoms: 0.0 / 100");
      await expect(results).toContainText("Eye Symptoms: 0.0 / 100");
      await expect(results).toContainText("Tiredness: 0.0 / 100");
      await expect(results).toContainText("Cognitive Problems: 0.0 / 100");
      await expect(results).toContainText("Anxiety: 0.0 / 100");
      await expect(results).toContainText("Depression: 0.0 / 100");
      await expect(results).toContainText(
        "Emotional Susceptibility: 0.0 / 100",
      );
      await expect(results).toContainText("Impaired Social Life: 0.0 / 100");
      await expect(results).toContainText("Impaired Daily Life: 0.0 / 100");
      await expect(results).toContainText("Cosmetic Complaints: 0.0 / 100");
      await expect(results).toContainText("Overall QoL: 0.0 / 100");
      await expect(results).toContainText("Composite Score: 0.0 / 100");
      await expect(results).toContainText("Minimal impact");
    });

    test("All-max score: all items = 4 should give all subscales 100.0", async ({
      page,
    }) => {
      await answerAllQuestions(page, 4);
      await page.locator('button:has-text("Calculate")').click();

      const results = page.locator('section[aria-live="polite"]');
      await expect(results).toBeVisible();

      await expect(results).toContainText("Goiter Symptoms: 100.0 / 100");
      await expect(results).toContainText("Hyperthyroid Symptoms: 100.0 / 100");
      await expect(results).toContainText("Hypothyroid Symptoms: 100.0 / 100");
      await expect(results).toContainText("Eye Symptoms: 100.0 / 100");
      await expect(results).toContainText("Tiredness: 100.0 / 100");
      await expect(results).toContainText("Cognitive Problems: 100.0 / 100");
      await expect(results).toContainText("Anxiety: 100.0 / 100");
      await expect(results).toContainText("Depression: 100.0 / 100");
      await expect(results).toContainText(
        "Emotional Susceptibility: 100.0 / 100",
      );
      await expect(results).toContainText("Impaired Social Life: 100.0 / 100");
      await expect(results).toContainText("Impaired Daily Life: 100.0 / 100");
      await expect(results).toContainText("Cosmetic Complaints: 100.0 / 100");
      await expect(results).toContainText("Overall QoL: 100.0 / 100");
      await expect(results).toContainText("Composite Score: 100.0 / 100");
      await expect(results).toContainText("Severe impact");
    });

    test("Single subscale: goiter items max, rest zero", async ({ page }) => {
      // Goiter (Q1-3) = 4, all rest = 0
      await answerQuestionRange(page, 1, 3, 4);
      await answerQuestionRange(page, 4, 39, 0);

      await page.locator('button:has-text("Calculate")').click();

      const results = page.locator('section[aria-live="polite"]');
      await expect(results).toBeVisible();

      await expect(results).toContainText("Goiter Symptoms: 100.0 / 100");
      await expect(results).toContainText("Hyperthyroid Symptoms: 0.0 / 100");
      await expect(results).toContainText("Tiredness: 0.0 / 100");
      // Goiter is NOT in composite, so composite should be 0
      await expect(results).toContainText("Composite Score: 0.0 / 100");
      await expect(results).toContainText("Minimal impact");
    });

    test("Mixed scores: varied selections across subscales", async ({
      page,
    }) => {
      // Goiter (Q1-3): value 1 -> (3/12)*100 = 25.0
      await answerQuestionRange(page, 1, 3, 1);
      // Hyperthyroid (Q4-7): value 2 -> (8/16)*100 = 50.0
      await answerQuestionRange(page, 4, 7, 2);
      // Hypothyroid (Q8-11): value 3 -> (12/16)*100 = 75.0
      await answerQuestionRange(page, 8, 11, 3);
      // Eye (Q12-14): value 4 -> (12/12)*100 = 100.0
      await answerQuestionRange(page, 12, 14, 4);
      // Tiredness (Q15-17): value 1 -> (3/12)*100 = 25.0
      await answerQuestionRange(page, 15, 17, 1);
      // Cognitive (Q18-20): value 2 -> (6/12)*100 = 50.0
      await answerQuestionRange(page, 18, 20, 2);
      // Anxiety (Q21-23): value 0 -> 0.0
      await answerQuestionRange(page, 21, 23, 0);
      // Depression (Q24-26): value 3 -> (9/12)*100 = 75.0
      await answerQuestionRange(page, 24, 26, 3);
      // Emotional (Q27-29): value 4 -> (12/12)*100 = 100.0
      await answerQuestionRange(page, 27, 29, 4);
      // Social (Q30-32): value 1 -> (3/12)*100 = 25.0
      await answerQuestionRange(page, 30, 32, 1);
      // Daily (Q33-35): value 2 -> (6/12)*100 = 50.0
      await answerQuestionRange(page, 33, 35, 2);
      // Cosmetic (Q36-38): value 0 -> 0.0
      await answerQuestionRange(page, 36, 38, 0);
      // QoL (Q39): value 3 -> (3/4)*100 = 75.0
      await selectAnswer(page, 39, 3);

      await page.locator('button:has-text("Calculate")').click();

      const results = page.locator('section[aria-live="polite"]');
      await expect(results).toBeVisible();

      await expect(results).toContainText("Goiter Symptoms: 25.0 / 100");
      await expect(results).toContainText("Hyperthyroid Symptoms: 50.0 / 100");
      await expect(results).toContainText("Hypothyroid Symptoms: 75.0 / 100");
      await expect(results).toContainText("Eye Symptoms: 100.0 / 100");
      await expect(results).toContainText("Tiredness: 25.0 / 100");
      await expect(results).toContainText("Cognitive Problems: 50.0 / 100");
      await expect(results).toContainText("Anxiety: 0.0 / 100");
      await expect(results).toContainText("Depression: 75.0 / 100");
      await expect(results).toContainText(
        "Emotional Susceptibility: 100.0 / 100",
      );
      await expect(results).toContainText("Impaired Social Life: 25.0 / 100");
      await expect(results).toContainText("Impaired Daily Life: 50.0 / 100");
      await expect(results).toContainText("Cosmetic Complaints: 0.0 / 100");
      await expect(results).toContainText("Overall QoL: 75.0 / 100");

      // Composite: Ti=3 + Co=6 + An=0 + De=9 + Em=12 + Sl=3 + Dl=6 + QoL=3 = 42
      // Items: 3+3+3+3+3+3+3+1 = 22, max = 22*4 = 88
      // Score = (42/88)*100 = 47.727... ≈ 47.7
      await expect(results).toContainText("Composite Score: 47.7 / 100");
      await expect(results).toContainText("Moderate impact");
    });
  });

  test.describe("Severity Boundaries", () => {
    test("Composite score at boundary 25.0 -> Minimal impact", async ({
      page,
    }) => {
      // Non-composite scales (Q1-14, Q36-38): value 0
      await answerQuestionRange(page, 1, 14, 0);
      await answerQuestionRange(page, 36, 38, 0);
      // Composite items (Q15-35, Q39): all value 1 -> sum = 22
      // 22 / 88 * 100 = 25.0
      await answerQuestionRange(page, 15, 35, 1);
      await selectAnswer(page, 39, 1);

      await page.locator('button:has-text("Calculate")').click();

      const results = page.locator('section[aria-live="polite"]');
      await expect(results).toContainText("Composite Score: 25.0 / 100");
      await expect(results).toContainText("Minimal impact");
    });

    test("Composite score just above 25 -> Moderate impact", async ({
      page,
    }) => {
      await answerQuestionRange(page, 1, 14, 0);
      await answerQuestionRange(page, 36, 38, 0);
      // 21 items at 1, QoL at 2 -> sum = 21 + 2 = 23
      // 23 / 88 * 100 = 26.136... -> Moderate
      await answerQuestionRange(page, 15, 35, 1);
      await selectAnswer(page, 39, 2);

      await page.locator('button:has-text("Calculate")').click();

      const results = page.locator('section[aria-live="polite"]');
      await expect(results).toContainText("Moderate impact");
    });

    test("Composite score at boundary 50.0 -> Moderate impact", async ({
      page,
    }) => {
      await answerQuestionRange(page, 1, 14, 0);
      await answerQuestionRange(page, 36, 38, 0);
      // All 22 composite items at 2 -> sum = 44
      // 44 / 88 * 100 = 50.0
      await answerQuestionRange(page, 15, 35, 2);
      await selectAnswer(page, 39, 2);

      await page.locator('button:has-text("Calculate")').click();

      const results = page.locator('section[aria-live="polite"]');
      await expect(results).toContainText("Composite Score: 50.0 / 100");
      await expect(results).toContainText("Moderate impact");
    });

    test("Composite score just above 50 -> Significant impact", async ({
      page,
    }) => {
      await answerQuestionRange(page, 1, 14, 0);
      await answerQuestionRange(page, 36, 38, 0);
      // 21 items at 2, QoL at 3 -> sum = 42 + 3 = 45
      // 45 / 88 * 100 = 51.136... -> Significant
      await answerQuestionRange(page, 15, 35, 2);
      await selectAnswer(page, 39, 3);

      await page.locator('button:has-text("Calculate")').click();

      const results = page.locator('section[aria-live="polite"]');
      await expect(results).toContainText("Significant impact");
    });

    test("Composite score at boundary 75.0 -> Significant impact", async ({
      page,
    }) => {
      await answerQuestionRange(page, 1, 14, 0);
      await answerQuestionRange(page, 36, 38, 0);
      // All 22 composite items at 3 -> sum = 66
      // 66 / 88 * 100 = 75.0
      await answerQuestionRange(page, 15, 35, 3);
      await selectAnswer(page, 39, 3);

      await page.locator('button:has-text("Calculate")').click();

      const results = page.locator('section[aria-live="polite"]');
      await expect(results).toContainText("Composite Score: 75.0 / 100");
      await expect(results).toContainText("Significant impact");
    });

    test("Composite score just above 75 -> Severe impact", async ({ page }) => {
      await answerQuestionRange(page, 1, 14, 0);
      await answerQuestionRange(page, 36, 38, 0);
      // 21 items at 3, QoL at 4 -> sum = 63 + 4 = 67
      // 67 / 88 * 100 = 76.136... -> Severe
      await answerQuestionRange(page, 15, 35, 3);
      await selectAnswer(page, 39, 4);

      await page.locator('button:has-text("Calculate")').click();

      const results = page.locator('section[aria-live="polite"]');
      await expect(results).toContainText("Severe impact");
    });
  });

  test.describe("Validation", () => {
    test("should require all questions to be answered", async ({ page }) => {
      await page.locator('button:has-text("Calculate")').click();
      await expect(
        page.locator("text=Please answer all 39 questions"),
      ).toBeVisible();
    });

    test("should show error with partial answers", async ({ page }) => {
      await answerQuestionRange(page, 1, 10, 0);
      await page.locator('button:has-text("Calculate")').click();
      await expect(
        page.locator("text=Please answer all 39 questions"),
      ).toBeVisible();
      await expect(page.locator("text=29 question(s) remaining")).toBeVisible();
    });
  });

  test.describe("References", () => {
    test("should display all 4 reference links with DOIs", async ({ page }) => {
      // References use the CollapsibleReferences component with class "references-section"
      const refsSection = page.locator(".references-section");
      await refsSection.scrollIntoViewIfNeeded();
      await expect(refsSection).toBeVisible();

      // By default only 3 are shown; expand to see all 4
      const expandButton = refsSection.locator(
        'button:has-text("Show 1 more reference")',
      );
      if (await expandButton.isVisible().catch(() => false)) {
        await expandButton.click();
      }

      // Verify 4 reference links
      const referenceLinks = await refsSection.locator('a[href^="http"]').all();
      expect(referenceLinks.length).toBe(4);

      // Verify key references
      await expect(refsSection).toContainText("Watt T, et al");
      await expect(refsSection).toContainText("Thyroid. 2015");
      await expect(refsSection).toContainText("Singh R, et al");
      await expect(refsSection).toContainText(
        "Cardiovasc Intervent Radiol. 2025",
      );

      // Verify DOI links
      await expect(
        page.locator('a[href*="10.1089/thy.2015.0209"]'),
      ).toBeVisible();
      await expect(
        page.locator('a[href*="10.1007/s00270-025-04055-1"]'),
      ).toBeVisible();
      await expect(
        page.locator('a[href*="10.1210/jc.2014-1322"]'),
      ).toBeVisible();
    });
  });

  test.describe("UI/UX", () => {
    test("should maintain theme consistency", async ({ page }) => {
      await verifyThemeConsistency(page);
    });

    test("should be responsive on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await expect(page.locator('h2:has-text("ThyPRO-39")')).toBeVisible();
      await expect(page.locator("text=1. Pressure or tightness")).toBeVisible();
      await verifyMobileResponsive(page);
    });

    test("should allow recalculation with different inputs", async ({
      page,
    }) => {
      // First: all zeros
      await answerAllQuestions(page, 0);
      await page.locator('button:has-text("Calculate")').click();

      let results = page.locator('section[aria-live="polite"]');
      await expect(results).toContainText("Composite Score: 0.0 / 100");

      // Second: all max
      await answerAllQuestions(page, 4);
      await page.locator('button:has-text("Calculate")').click();

      results = page.locator('section[aria-live="polite"]');
      await expect(results).toContainText("Composite Score: 100.0 / 100");
    });
  });
});
