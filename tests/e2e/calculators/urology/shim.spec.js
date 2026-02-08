/**
 * IIEF-5 (SHIM Score) Calculator - E2E Tests
 *
 * Tests the Sexual Health Inventory for Men (IIEF-5) calculator
 * for erectile dysfunction assessment.
 *
 * Test Coverage:
 * - All 22 test cases from fixtures
 * - Severe ED (scores 1-7)
 * - Moderate ED (scores 8-11)
 * - Mild-to-Moderate ED (scores 12-16)
 * - Mild ED (scores 17-21)
 * - No ED (scores 22-25)
 * - All critical boundary conditions (7→8, 11→12, 16→17, 21→22)
 * - All 5 SHIM questions independently tested
 * - No sexual activity responses (0 points)
 * - Clinical interpretation validation
 * - Reference link verification
 * - UI/UX and responsive design
 */

import { test, expect } from "@playwright/test";
import {
  navigateToCalculator,
  selectRadio,
  verifyReferenceLinks,
  verifyThemeConsistency,
  verifyMobileResponsive,
} from "../../../helpers/calculator-test-helper.js";
import testCases from "../../../fixtures/shim-test-cases.json" assert { type: "json" };

const CALCULATOR_NAME = "IIEF-5 (SHIM Score)";

test.describe("IIEF-5 (SHIM Score) Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, CALCULATOR_NAME);

    // Verify calculator loaded
    await expect(page.locator("h2")).toContainText("IIEF-5 (SHIM Score)");
    await expect(
      page.locator("text=Sexual Health Inventory for Men").first(),
    ).toBeVisible();
  });

  test("should display calculator info panel", async ({ page }) => {
    // Verify info panel is present
    const infoPanel = page.getByTestId("calculator-info");
    await expect(infoPanel).toBeVisible();

    // Verify SHIM description
    await expect(infoPanel).toContainText("Sexual Health Inventory for Men");
    await expect(infoPanel).toContainText("IIEF-5");
    await expect(infoPanel).toContainText("5-question assessment");
    await expect(infoPanel).toContainText("erectile dysfunction");
    await expect(infoPanel).toContainText("past 6 months");
  });

  test("should display all 5 SHIM questions", async ({ page }) => {
    // Question 1: Confidence
    await expect(
      page.locator("text=1. How do you rate your confidence"),
    ).toBeVisible();
    await expect(page.locator("text=Very low")).toBeVisible();
    await expect(page.locator("text=Very high")).toBeVisible();

    // Question 2: Firmness/Penetration
    await expect(
      page.locator("text=2. When you had erections with sexual stimulation"),
    ).toBeVisible();
    await expect(
      page.locator("text=hard enough for penetration"),
    ).toBeVisible();
    await expect(page.locator("text=No sexual activity")).toBeVisible();

    // Question 3: Maintenance
    await expect(
      page.locator(
        "text=3. During sexual intercourse, how often were you able to maintain",
      ),
    ).toBeVisible();
    await expect(
      page.locator("text=Did not attempt intercourse"),
    ).toBeVisible();

    // Question 4: Difficulty maintaining
    await expect(
      page.locator(
        "text=4. During sexual intercourse, how difficult was it to maintain",
      ),
    ).toBeVisible();
    await expect(page.locator("text=Extremely difficult")).toBeVisible();
    await expect(page.locator("text=Not difficult")).toBeVisible();

    // Question 5: Satisfaction
    await expect(
      page.locator(
        "text=5. When you attempted sexual intercourse, how often was it satisfactory",
      ),
    ).toBeVisible();
    await expect(page.locator("text=Almost always or always")).toBeVisible();
  });

  test("should require all questions to be answered", async ({ page }) => {
    // Click Calculate without answering any questions
    const calculateButton = page.locator('button:has-text("Calculate")');
    await calculateButton.click();

    // Wait for results

    // Should show error
    const errorMessage = page.locator("text=Please answer all 5 questions");
    await expect(errorMessage).toBeVisible();
  });

  test("should display correct score range format", async ({ page }) => {
    // Answer all questions with middle values
    await selectRadio(page, "confidence", "Moderate");
    await selectRadio(
      page,
      "hard enough for penetration",
      "Sometimes (about half the time)",
    );
    await selectRadio(
      page,
      "able to maintain",
      "Sometimes (about half the time)",
    );
    await selectRadio(page, "how difficult", "Difficult");
    await selectRadio(
      page,
      "how often was it satisfactory",
      "Sometimes (about half the time)",
    );

    // Calculate
    await page.locator('button:has-text("Calculate")').click();

    // Verify score format includes "/25"
    const scoreResult = page.locator("text=Total IIEF-5 (SHIM Score)");
    await expect(scoreResult).toBeVisible();
    await expect(scoreResult.locator("..")).toContainText("/ 25");
  });

  // Test all fixture cases
  testCases.testCases.forEach((testCase) => {
    test(`${testCase.name} - ${testCase.notes}`, async ({ page }) => {
      // Map question IDs to radio button labels
      const questionLabels = {
        q1: getRadioLabelForQ1(testCase.inputs.q1),
        q2: getRadioLabelForQ2(testCase.inputs.q2),
        q3: getRadioLabelForQ3(testCase.inputs.q3),
        q4: getRadioLabelForQ4(testCase.inputs.q4),
        q5: getRadioLabelForQ5(testCase.inputs.q5),
      };

      // Fill in all questions
      await selectRadio(page, "confidence", questionLabels.q1);
      await selectRadio(page, "hard enough for penetration", questionLabels.q2);
      await selectRadio(page, "able to maintain", questionLabels.q3);
      await selectRadio(page, "how difficult", questionLabels.q4);
      await selectRadio(
        page,
        "how often was it satisfactory",
        questionLabels.q5,
      );

      // Click Calculate
      await page.locator('button:has-text("Calculate")').click();

      // Verify results
      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(resultsSection).toBeVisible();

      // Verify Total IIEF-5 (SHIM Score)
      await expect(resultsSection).toContainText(
        `Total IIEF-5 (SHIM Score): ${testCase.expected["Total IIEF-5 (SHIM Score)"]}`,
      );

      // Verify ED Severity
      await expect(resultsSection).toContainText(
        `ED Severity: ${testCase.expected["ED Severity"]}`,
      );

      // Verify Clinical Interpretation
      await expect(resultsSection).toContainText(
        testCase.expected["Clinical Interpretation"],
      );

      // Verify Note is present
      await expect(resultsSection).toContainText(
        "Assessment based on past 6 months",
      );
      await expect(resultsSection).toContainText(
        "Score ≤21 indicates some degree of erectile dysfunction",
      );
    });
  });

  test("Severe ED (score 5) - should show comprehensive evaluation recommendation", async ({
    page,
  }) => {
    // All questions at minimum (1 point each)
    await selectRadio(page, "confidence", "Very low");
    await selectRadio(
      page,
      "hard enough for penetration",
      "Almost never or never",
    );
    await selectRadio(page, "able to maintain", "Almost never or never");
    await selectRadio(page, "how difficult", "Extremely difficult");
    await selectRadio(
      page,
      "how often was it satisfactory",
      "Almost never or never",
    );

    await page.locator('button:has-text("Calculate")').click();

    const resultsSection = page.locator('section[aria-live="polite"]');

    // Verify severe ED classification
    await expect(resultsSection).toContainText("Severe ED");

    // Verify comprehensive medical evaluation recommended
    await expect(resultsSection).toContainText(
      "Comprehensive medical evaluation recommended",
    );
    await expect(resultsSection).toContainText("Multiple treatment options");
  });

  test("No ED (score 25) - should show normal function", async ({ page }) => {
    // All questions at maximum (5 points each)
    await selectRadio(page, "confidence", "Very high");
    await selectRadio(
      page,
      "hard enough for penetration",
      "Almost always or always",
    );
    await selectRadio(page, "able to maintain", "Almost always or always");
    await selectRadio(page, "how difficult", "Not difficult");
    await selectRadio(
      page,
      "how often was it satisfactory",
      "Almost always or always",
    );

    await page.locator('button:has-text("Calculate")').click();

    const resultsSection = page.locator('section[aria-live="polite"]');

    // Verify No ED classification
    await expect(resultsSection).toContainText("No ED");

    // Verify normal function message
    await expect(resultsSection).toContainText(
      "No evidence of erectile dysfunction",
    );
    await expect(resultsSection).toContainText("Erectile function is normal");
  });

  test("Boundary test: Score 21 (Mild ED) vs Score 22 (No ED)", async ({
    page,
  }) => {
    // Test score 21 - should be Mild ED
    await selectRadio(page, "confidence", "Very high");
    await selectRadio(
      page,
      "hard enough for penetration",
      "Most times (much more than half the time)",
    );
    await selectRadio(
      page,
      "able to maintain",
      "Most times (much more than half the time)",
    );
    await selectRadio(
      page,
      "how difficult",
      "Most times (much more than half the time)",
    );
    await selectRadio(
      page,
      "how often was it satisfactory",
      "Most times (much more than half the time)",
    );

    await page.locator('button:has-text("Calculate")').click();

    let resultsSection = page.locator('section[aria-live="polite"]');
    await expect(resultsSection).toContainText("21 / 25");
    await expect(resultsSection).toContainText("Mild ED");
    await expect(resultsSection).toContainText("lifestyle modifications");

    // Change q3 from 4 to 5 to get score 22 - should be No ED
    await selectRadio(page, "able to maintain", "Almost always or always");

    await page.locator('button:has-text("Calculate")').click();

    resultsSection = page.locator('section[aria-live="polite"]');
    await expect(resultsSection).toContainText("22 / 25");
    await expect(resultsSection).toContainText("No ED");
    await expect(resultsSection).toContainText(
      "No evidence of erectile dysfunction",
    );
  });

  test("Boundary test: Score 16 (Mild-to-Moderate) vs Score 17 (Mild)", async ({
    page,
  }) => {
    // Test score 16 - should be Mild-to-Moderate ED
    await selectRadio(page, "confidence", "High");
    await selectRadio(
      page,
      "hard enough for penetration",
      "Sometimes (about half the time)",
    );
    await selectRadio(
      page,
      "able to maintain",
      "Sometimes (about half the time)",
    );
    await selectRadio(page, "how difficult", "Difficult");
    await selectRadio(
      page,
      "how often was it satisfactory",
      "Sometimes (about half the time)",
    );

    await page.locator('button:has-text("Calculate")').click();

    let resultsSection = page.locator('section[aria-live="polite"]');
    await expect(resultsSection).toContainText("16 / 25");
    await expect(resultsSection).toContainText("Mild-to-Moderate ED");
    await expect(resultsSection).toContainText(
      "PDE5 inhibitors are often effective",
    );

    // Change q3 from 3 to 4 to get score 17 - should be Mild ED
    await selectRadio(
      page,
      "able to maintain",
      "Most times (much more than half the time)",
    );

    await page.locator('button:has-text("Calculate")').click();

    resultsSection = page.locator('section[aria-live="polite"]');
    await expect(resultsSection).toContainText("17 / 25");
    await expect(resultsSection).toContainText("Mild ED");
    await expect(resultsSection).not.toContainText("Mild-to-Moderate");
  });

  test("Boundary test: Score 11 (Moderate) vs Score 12 (Mild-to-Moderate)", async ({
    page,
  }) => {
    // Test score 11 - should be Moderate ED
    await selectRadio(page, "confidence", "Moderate");
    await selectRadio(
      page,
      "hard enough for penetration",
      "A few times (much less than half the time)",
    );
    await selectRadio(
      page,
      "able to maintain",
      "A few times (much less than half the time)",
    );
    await selectRadio(page, "how difficult", "Very difficult");
    await selectRadio(
      page,
      "how often was it satisfactory",
      "A few times (much less than half the time)",
    );

    await page.locator('button:has-text("Calculate")').click();

    let resultsSection = page.locator('section[aria-live="polite"]');
    await expect(resultsSection).toContainText("11 / 25");
    await expect(resultsSection).toContainText("Moderate ED");
    await expect(resultsSection).not.toContainText("Mild-to-Moderate");

    // Change q3 from 2 to 3 to get score 12 - should be Mild-to-Moderate ED
    await selectRadio(
      page,
      "able to maintain",
      "Sometimes (about half the time)",
    );

    await page.locator('button:has-text("Calculate")').click();

    resultsSection = page.locator('section[aria-live="polite"]');
    await expect(resultsSection).toContainText("12 / 25");
    await expect(resultsSection).toContainText("Mild-to-Moderate ED");
  });

  test("Boundary test: Score 7 (Severe) vs Score 8 (Moderate)", async ({
    page,
  }) => {
    // Test score 7 - should be Severe ED
    await selectRadio(page, "confidence", "Low");
    await selectRadio(
      page,
      "hard enough for penetration",
      "Almost never or never",
    );
    await selectRadio(
      page,
      "able to maintain",
      "A few times (much less than half the time)",
    );
    await selectRadio(page, "how difficult", "Almost never or never");
    await selectRadio(
      page,
      "how often was it satisfactory",
      "Almost never or never",
    );

    await page.locator('button:has-text("Calculate")').click();

    let resultsSection = page.locator('section[aria-live="polite"]');
    await expect(resultsSection).toContainText("7 / 25");
    await expect(resultsSection).toContainText("Severe ED");

    // Change q3 from 2 to 3 to get score 8 - should be Moderate ED
    await selectRadio(
      page,
      "able to maintain",
      "Sometimes (about half the time)",
    );

    await page.locator('button:has-text("Calculate")').click();

    resultsSection = page.locator('section[aria-live="polite"]');
    await expect(resultsSection).toContainText("8 / 25");
    await expect(resultsSection).toContainText("Moderate ED");
    await expect(resultsSection).not.toContainText("Severe");
  });

  test("No sexual activity responses - should handle zeros correctly", async ({
    page,
  }) => {
    // Q1 = 1, Q2-Q5 = 0 (no sexual activity)
    await selectRadio(page, "confidence", "Very low");
    await selectRadio(
      page,
      "hard enough for penetration",
      "No sexual activity",
    );
    await selectRadio(page, "able to maintain", "Did not attempt intercourse");
    await selectRadio(page, "how difficult", "Did not attempt intercourse");
    await selectRadio(
      page,
      "how often was it satisfactory",
      "Did not attempt intercourse",
    );

    await page.locator('button:has-text("Calculate")').click();

    const resultsSection = page.locator('section[aria-live="polite"]');

    // Score should be 1
    await expect(resultsSection).toContainText("1 / 25");

    // Should classify as Severe ED with special interpretation
    await expect(resultsSection).toContainText("Severe ED");
    await expect(resultsSection).toContainText(
      "may include no sexual activity",
    );
    await expect(resultsSection).toContainText(
      "cardiovascular and endocrine assessment",
    );
  });

  test("should verify all 4 reference links are present and valid", async ({
    page,
  }) => {
    // Scroll to references section
    const referencesSection = page.locator(
      'section:has(h3:has-text("References"))',
    );
    await referencesSection.scrollIntoViewIfNeeded();
    await expect(referencesSection).toBeVisible();

    // Verify all 4 references are present
    const referenceLinks = await referencesSection
      .locator('a[href^="http"]')
      .all();
    expect(referenceLinks.length).toBe(4);

    // Verify specific references
    await expect(referencesSection).toContainText(
      "Rosen RC, et al. The International Index of Erectile Function",
    );
    await expect(referencesSection).toContainText("Urology. 1997");
    await expect(referencesSection).toContainText("abridged, 5-item version");
    await expect(referencesSection).toContainText("Int J Impot Res. 1999");
    await expect(referencesSection).toContainText("Cappelleri JC");
    await expect(referencesSection).toContainText("2005");
    await expect(referencesSection).toContainText(
      "AUA Guideline: Erectile Dysfunction",
    );

    // Verify links are clickable and point to correct URLs
    const link1 = page.locator('a[href*="s0090-4295(97)00238-0"]');
    await expect(link1).toBeVisible();

    const link2 = page.locator('a[href*="3900472"]');
    await expect(link2).toBeVisible();

    const link3 = page.locator('a[href*="3901309"]');
    await expect(link3).toBeVisible();

    const link4 = page.locator('a[href*="auanet.org"]');
    await expect(link4).toBeVisible();
  });

  test("should maintain theme consistency", async ({ page }) => {
    await verifyThemeConsistency(page);

    // Verify SHIM-specific styling
    const calculatorCard = page.locator(".border.rounded-lg").first();
    await expect(calculatorCard).toBeVisible();

    // Verify radio buttons are properly styled
    const radioInputs = page.locator('input[type="radio"]');
    const firstRadio = radioInputs.first();
    await expect(firstRadio).toBeVisible();

    // Verify Calculate button styling
    const calculateButton = page.locator('button:has-text("Calculate")');
    await expect(calculateButton).toBeVisible();
    const buttonColor = await calculateButton.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor,
    );
    expect(buttonColor).toBeTruthy();
  });

  test("should be responsive on mobile devices", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Verify calculator is still usable
    await expect(
      page.locator('h2:has-text("IIEF-5 (SHIM Score)")'),
    ).toBeVisible();

    // Verify all questions are visible and accessible
    await expect(
      page.locator("text=1. How do you rate your confidence"),
    ).toBeVisible();
    await expect(page.locator("text=2. When you had erections")).toBeVisible();

    // Verify radio buttons work on mobile
    await selectRadio(page, "confidence", "Moderate");

    // Verify Calculate button is visible
    const calculateButton = page.locator('button:has-text("Calculate")');
    await expect(calculateButton).toBeVisible();

    // Verify mobile-specific layout
    await verifyMobileResponsive(page);
  });

  test("should allow users to recalculate with different inputs", async ({
    page,
  }) => {
    // First calculation - Severe ED
    await selectRadio(page, "confidence", "Very low");
    await selectRadio(
      page,
      "hard enough for penetration",
      "Almost never or never",
    );
    await selectRadio(page, "able to maintain", "Almost never or never");
    await selectRadio(page, "how difficult", "Extremely difficult");
    await selectRadio(
      page,
      "how often was it satisfactory",
      "Almost never or never",
    );

    await page.locator('button:has-text("Calculate")').click();

    let resultsSection = page.locator('section[aria-live="polite"]');
    await expect(resultsSection).toContainText("5 / 25");
    await expect(resultsSection).toContainText("Severe ED");

    // Second calculation - No ED
    await selectRadio(page, "confidence", "Very high");
    await selectRadio(
      page,
      "hard enough for penetration",
      "Almost always or always",
    );
    await selectRadio(page, "able to maintain", "Almost always or always");
    await selectRadio(page, "how difficult", "Not difficult");
    await selectRadio(
      page,
      "how often was it satisfactory",
      "Almost always or always",
    );

    await page.locator('button:has-text("Calculate")').click();

    resultsSection = page.locator('section[aria-live="polite"]');
    await expect(resultsSection).toContainText("25 / 25");
    await expect(resultsSection).toContainText("No ED");
  });

  test("Individual question validation - Q1 Confidence", async ({ page }) => {
    // Test that Q1 properly affects score
    await selectRadio(page, "confidence", "Very low"); // 1 point
    await selectRadio(
      page,
      "hard enough for penetration",
      "Sometimes (about half the time)",
    ); // 3 points
    await selectRadio(
      page,
      "able to maintain",
      "Sometimes (about half the time)",
    ); // 3 points
    await selectRadio(page, "how difficult", "Difficult"); // 3 points
    await selectRadio(
      page,
      "how often was it satisfactory",
      "Sometimes (about half the time)",
    ); // 3 points

    await page.locator('button:has-text("Calculate")').click();

    let resultsSection = page.locator('section[aria-live="polite"]');
    await expect(resultsSection).toContainText("13 / 25");

    // Change Q1 to Very high (5 points)
    await selectRadio(page, "confidence", "Very high");
    await page.locator('button:has-text("Calculate")').click();

    resultsSection = page.locator('section[aria-live="polite"]');
    await expect(resultsSection).toContainText("17 / 25");
  });

  test("Individual question validation - Q2 Firmness", async ({ page }) => {
    // Test that Q2 properly affects score
    await selectRadio(page, "confidence", "Moderate"); // 3 points
    await selectRadio(
      page,
      "hard enough for penetration",
      "Almost never or never",
    ); // 1 point
    await selectRadio(
      page,
      "able to maintain",
      "Sometimes (about half the time)",
    ); // 3 points
    await selectRadio(page, "how difficult", "Difficult"); // 3 points
    await selectRadio(
      page,
      "how often was it satisfactory",
      "Sometimes (about half the time)",
    ); // 3 points

    await page.locator('button:has-text("Calculate")').click();

    let resultsSection = page.locator('section[aria-live="polite"]');
    await expect(resultsSection).toContainText("13 / 25");

    // Change Q2 to Almost always or always (5 points)
    await selectRadio(
      page,
      "hard enough for penetration",
      "Almost always or always",
    );
    await page.locator('button:has-text("Calculate")').click();

    resultsSection = page.locator('section[aria-live="polite"]');
    await expect(resultsSection).toContainText("17 / 25");
  });

  test("Individual question validation - Q3 Maintenance", async ({ page }) => {
    // Test that Q3 properly affects score
    await selectRadio(page, "confidence", "Moderate"); // 3 points
    await selectRadio(
      page,
      "hard enough for penetration",
      "Sometimes (about half the time)",
    ); // 3 points
    await selectRadio(page, "able to maintain", "Almost never or never"); // 1 point
    await selectRadio(page, "how difficult", "Difficult"); // 3 points
    await selectRadio(
      page,
      "how often was it satisfactory",
      "Sometimes (about half the time)",
    ); // 3 points

    await page.locator('button:has-text("Calculate")').click();

    let resultsSection = page.locator('section[aria-live="polite"]');
    await expect(resultsSection).toContainText("13 / 25");

    // Change Q3 to Almost always or always (5 points)
    await selectRadio(page, "able to maintain", "Almost always or always");
    await page.locator('button:has-text("Calculate")').click();

    resultsSection = page.locator('section[aria-live="polite"]');
    await expect(resultsSection).toContainText("17 / 25");
  });

  test("Individual question validation - Q4 Difficulty", async ({ page }) => {
    // Test that Q4 properly affects score
    await selectRadio(page, "confidence", "Moderate"); // 3 points
    await selectRadio(
      page,
      "hard enough for penetration",
      "Sometimes (about half the time)",
    ); // 3 points
    await selectRadio(
      page,
      "able to maintain",
      "Sometimes (about half the time)",
    ); // 3 points
    await selectRadio(page, "how difficult", "Extremely difficult"); // 1 point
    await selectRadio(
      page,
      "how often was it satisfactory",
      "Sometimes (about half the time)",
    ); // 3 points

    await page.locator('button:has-text("Calculate")').click();

    let resultsSection = page.locator('section[aria-live="polite"]');
    await expect(resultsSection).toContainText("13 / 25");

    // Change Q4 to Not difficult (5 points)
    await selectRadio(page, "how difficult", "Not difficult");
    await page.locator('button:has-text("Calculate")').click();

    resultsSection = page.locator('section[aria-live="polite"]');
    await expect(resultsSection).toContainText("17 / 25");
  });

  test("Individual question validation - Q5 Satisfaction", async ({ page }) => {
    // Test that Q5 properly affects score
    await selectRadio(page, "confidence", "Moderate"); // 3 points
    await selectRadio(
      page,
      "hard enough for penetration",
      "Sometimes (about half the time)",
    ); // 3 points
    await selectRadio(
      page,
      "able to maintain",
      "Sometimes (about half the time)",
    ); // 3 points
    await selectRadio(page, "how difficult", "Difficult"); // 3 points
    await selectRadio(
      page,
      "how often was it satisfactory",
      "Almost never or never",
    ); // 1 point

    await page.locator('button:has-text("Calculate")').click();

    let resultsSection = page.locator('section[aria-live="polite"]');
    await expect(resultsSection).toContainText("13 / 25");

    // Change Q5 to Almost always or always (5 points)
    await selectRadio(
      page,
      "how often was it satisfactory",
      "Almost always or always",
    );
    await page.locator('button:has-text("Calculate")').click();

    resultsSection = page.locator('section[aria-live="polite"]');
    await expect(resultsSection).toContainText("17 / 25");
  });
});

// Helper functions to map question values to radio button labels
function getRadioLabelForQ1(value) {
  const mapping = {
    1: "Very low",
    2: "Low",
    3: "Moderate",
    4: "High",
    5: "Very high",
  };
  return mapping[value];
}

function getRadioLabelForQ2(value) {
  const mapping = {
    0: "No sexual activity",
    1: "Almost never or never",
    2: "A few times (much less than half the time)",
    3: "Sometimes (about half the time)",
    4: "Most times (much more than half the time)",
    5: "Almost always or always",
  };
  return mapping[value];
}

function getRadioLabelForQ3(value) {
  const mapping = {
    0: "Did not attempt intercourse",
    1: "Almost never or never",
    2: "A few times (much less than half the time)",
    3: "Sometimes (about half the time)",
    4: "Most times (much more than half the time)",
    5: "Almost always or always",
  };
  return mapping[value];
}

function getRadioLabelForQ4(value) {
  const mapping = {
    0: "Did not attempt intercourse",
    1: "Extremely difficult",
    2: "Very difficult",
    3: "Difficult",
    4: "Slightly difficult",
    5: "Not difficult",
  };
  return mapping[value];
}

function getRadioLabelForQ5(value) {
  const mapping = {
    0: "Did not attempt intercourse",
    1: "Almost never or never",
    2: "A few times (much less than half the time)",
    3: "Sometimes (about half the time)",
    4: "Most times (much more than half the time)",
    5: "Almost always or always",
  };
  return mapping[value];
}
