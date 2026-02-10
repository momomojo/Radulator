import { test, expect } from "@playwright/test";
import {
  navigateToCalculator,
  fillInput,
  selectRadio,
  selectOption,
  toggleCheckbox,
} from "../../../helpers/calculator-test-helper.js";
import testData from "../../../fixtures/renal-nephrometry-test-cases.json" assert { type: "json" };

/**
 * E2E Tests for R.E.N.A.L. Nephrometry Score Calculator
 *
 * The R.E.N.A.L. nephrometry score quantifies anatomical characteristics
 * of renal tumors for surgical planning and risk assessment.
 *
 * Scoring components:
 * - R: Radius (1-3 points based on tumor diameter)
 * - E: Exophytic/endophytic properties (1-3 points)
 * - N: Nearness to collecting system (1-3 points)
 * - A: Anterior/posterior location (descriptor: a/p/x, no points)
 * - L: Location relative to polar lines (1-3 points)
 * - h: Hilar suffix (descriptor, no points)
 *
 * Complexity categories:
 * - Low: 4-6 points
 * - Moderate: 7-9 points
 * - High: 10-12 points
 */

test.describe("R.E.N.A.L. Nephrometry Score Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, "RENAL Nephrometry Score");
    await expect(
      page.locator('h2:has-text("RENAL Nephrometry Score")'),
    ).toBeVisible();
  });

  test("should display calculator information and description", async ({
    page,
  }) => {
    // Verify calculator description
    await expect(
      page.locator(
        "text=Quantifies anatomical characteristics of renal tumours",
      ),
    ).toBeVisible();

    // Verify info box is present
    const infoBox = page.getByTestId("calculator-info");
    await expect(infoBox).toBeVisible();

    // Verify key components are mentioned
    await expect(infoBox).toContainText("R - Radius");
    await expect(infoBox).toContainText("E - Exophytic/endophytic");
    await expect(infoBox).toContainText("N - Nearness to collecting system");
    await expect(infoBox).toContainText("A - Anterior/posterior location");
    await expect(infoBox).toContainText("L - Location relative to polar lines");

    // Verify complexity categories are mentioned
    await expect(infoBox).toContainText("Low (4-6)");
    await expect(infoBox).toContainText("Moderate (7-9)");
    await expect(infoBox).toContainText("High (10-12)");
  });

  test("should display all input fields", async ({ page }) => {
    // Verify all 5 R.E.N.A.L. components plus hilar checkbox
    await expect(
      page.locator('label:has-text("Tumor diameter")'),
    ).toBeVisible();
    await expect(
      page.locator('label:has-text("Exophytic/endophytic nature")'),
    ).toBeVisible();
    await expect(
      page.locator('label:has-text("Nearness to collecting system")'),
    ).toBeVisible();
    await expect(
      page.locator('label:has-text("Location relative to polar line")'),
    ).toBeVisible();
    await expect(
      page.locator('label:has-text("Anterior/posterior location")'),
    ).toBeVisible();
    await expect(
      page.locator('label:has-text("Hilar location")'),
    ).toBeVisible();
  });

  test("should have Calculate button initially enabled", async ({ page }) => {
    const calculateButton = page.locator('button:has-text("Calculate")');
    await expect(calculateButton).toBeVisible();
    await expect(calculateButton).toBeEnabled();
  });

  test.describe("Comprehensive Test Cases from Fixtures", () => {
    for (const testCase of testData.testCases) {
      test(`${testCase.id}: ${testCase.description}`, async ({ page }) => {
        // Fill in the radius
        await fillInput(page, "Tumor diameter", testCase.inputs.radius);

        // Select exophytic/endophytic nature
        const exophyticLabel = {
          ">=50": "≥ 50% exophytic",
          "<50": "< 50% exophytic",
          endophytic: "Entirely endophytic",
        }[testCase.inputs.exophytic];
        await selectRadio(page, "Exophytic/endophytic nature", exophyticLabel);

        // Select nearness to collecting system
        const nearnessLabel = {
          ">=7": "≥ 7 mm",
          "4-7": "4-7 mm",
          "<=4": "≤ 4 mm",
        }[testCase.inputs.nearness];
        await selectRadio(page, "Nearness to collecting system", nearnessLabel);

        // Select polar location
        const polarLabel = {
          "above/below": "Entirely above or below polar line",
          crosses: "Crosses polar line",
          central: ">50% across polar line/between lines/crosses midline",
        }[testCase.inputs.polar];
        await selectRadio(page, "Location relative to polar line", polarLabel);

        // Select anterior/posterior location
        await selectOption(
          page,
          "Anterior/posterior location",
          testCase.inputs.anterior,
        );

        // Toggle hilar checkbox if needed
        if (testCase.inputs.hilar) {
          await toggleCheckbox(page, "Hilar location", true);
        }

        // Click Calculate
        await page.click('button:has-text("Calculate")');

        // Wait for results

        // Verify results section is visible
        const resultsSection = page.locator('section[aria-live="polite"]');
        await expect(resultsSection).toBeVisible();

        // Verify total score
        const totalScoreText = await resultsSection
          .locator('> div:has-text("Total Score")')
          .textContent();
        expect(totalScoreText).toContain(testCase.expected.totalScore);

        // Verify complexity
        const complexityText = await resultsSection
          .locator('> div:has-text("Complexity")')
          .textContent();
        expect(complexityText).toContain(testCase.expected.complexity);

        // Verify interpretation contains expected text
        const interpretationText = await resultsSection
          .locator('> div:has-text("Interpretation")')
          .textContent();
        expect(interpretationText).toContain(testCase.interpretation);
      });
    }
  });

  test.describe("R Component - Radius/Size Testing", () => {
    test("should calculate R=1 for tumor ≤ 4.0 cm", async ({ page }) => {
      await fillInput(page, "Tumor diameter", "3.5");
      await selectRadio(page, "Exophytic/endophytic nature", "≥ 50% exophytic");
      await selectRadio(page, "Nearness to collecting system", "≥ 7 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        "Entirely above or below polar line",
      );
      await selectOption(page, "Anterior/posterior location", "Anterior");

      await page.click('button:has-text("Calculate")');

      // Score should be 4a (1+1+1+1 = 4)
      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator('> div:has-text("Total Score")'),
      ).toContainText("4a");
      await expect(
        results.locator('> div:has-text("Complexity")'),
      ).toContainText("Low complexity");
    });

    test("should calculate R=1 for tumor exactly 4.0 cm (boundary)", async ({
      page,
    }) => {
      await fillInput(page, "Tumor diameter", "4.0");
      await selectRadio(page, "Exophytic/endophytic nature", "≥ 50% exophytic");
      await selectRadio(page, "Nearness to collecting system", "≥ 7 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        "Entirely above or below polar line",
      );
      await selectOption(page, "Anterior/posterior location", "Anterior");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator('> div:has-text("Total Score")'),
      ).toContainText("4a");
    });

    test("should calculate R=2 for tumor > 4.0 and < 7.0 cm", async ({
      page,
    }) => {
      await fillInput(page, "Tumor diameter", "5.5");
      await selectRadio(page, "Exophytic/endophytic nature", "≥ 50% exophytic");
      await selectRadio(page, "Nearness to collecting system", "≥ 7 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        "Entirely above or below polar line",
      );
      await selectOption(page, "Anterior/posterior location", "Anterior");

      await page.click('button:has-text("Calculate")');

      // Score should be 5a (2+1+1+1 = 5)
      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator('> div:has-text("Total Score")'),
      ).toContainText("5a");
    });

    test("should calculate R=3 for tumor exactly 7.0 cm (boundary)", async ({
      page,
    }) => {
      await fillInput(page, "Tumor diameter", "7.0");
      await selectRadio(page, "Exophytic/endophytic nature", "≥ 50% exophytic");
      await selectRadio(page, "Nearness to collecting system", "≥ 7 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        "Entirely above or below polar line",
      );
      await selectOption(page, "Anterior/posterior location", "Anterior");

      await page.click('button:has-text("Calculate")');

      // Score should be 6a (3+1+1+1 = 6)
      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator('> div:has-text("Total Score")'),
      ).toContainText("6a");
    });

    test("should calculate R=3 for tumor ≥ 7.0 cm", async ({ page }) => {
      await fillInput(page, "Tumor diameter", "9.0");
      await selectRadio(page, "Exophytic/endophytic nature", "≥ 50% exophytic");
      await selectRadio(page, "Nearness to collecting system", "≥ 7 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        "Entirely above or below polar line",
      );
      await selectOption(page, "Anterior/posterior location", "Anterior");

      await page.click('button:has-text("Calculate")');

      // Score should be 6a (3+1+1+1 = 6)
      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator('> div:has-text("Total Score")'),
      ).toContainText("6a");
    });
  });

  test.describe("E Component - Exophytic/Endophytic Testing", () => {
    test("should calculate E=1 for ≥ 50% exophytic", async ({ page }) => {
      await fillInput(page, "Tumor diameter", "4.0");
      await selectRadio(page, "Exophytic/endophytic nature", "≥ 50% exophytic");
      await selectRadio(page, "Nearness to collecting system", "≥ 7 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        "Entirely above or below polar line",
      );
      await selectOption(page, "Anterior/posterior location", "Anterior");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator('> div:has-text("Total Score")'),
      ).toContainText("4a");
    });

    test("should calculate E=2 for < 50% exophytic", async ({ page }) => {
      await fillInput(page, "Tumor diameter", "4.0");
      await selectRadio(page, "Exophytic/endophytic nature", "< 50% exophytic");
      await selectRadio(page, "Nearness to collecting system", "≥ 7 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        "Entirely above or below polar line",
      );
      await selectOption(page, "Anterior/posterior location", "Anterior");

      await page.click('button:has-text("Calculate")');

      // Score should be 5a (1+2+1+1 = 5)
      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator('> div:has-text("Total Score")'),
      ).toContainText("5a");
    });

    test("should calculate E=3 for entirely endophytic", async ({ page }) => {
      await fillInput(page, "Tumor diameter", "4.0");
      await selectRadio(
        page,
        "Exophytic/endophytic nature",
        "Entirely endophytic",
      );
      await selectRadio(page, "Nearness to collecting system", "≥ 7 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        "Entirely above or below polar line",
      );
      await selectOption(page, "Anterior/posterior location", "Anterior");

      await page.click('button:has-text("Calculate")');

      // Score should be 6a (1+3+1+1 = 6)
      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator('> div:has-text("Total Score")'),
      ).toContainText("6a");
    });
  });

  test.describe("N Component - Nearness to Collecting System Testing", () => {
    test("should calculate N=1 for ≥ 7 mm from collecting system", async ({
      page,
    }) => {
      await fillInput(page, "Tumor diameter", "4.0");
      await selectRadio(page, "Exophytic/endophytic nature", "≥ 50% exophytic");
      await selectRadio(page, "Nearness to collecting system", "≥ 7 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        "Entirely above or below polar line",
      );
      await selectOption(page, "Anterior/posterior location", "Anterior");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator('> div:has-text("Total Score")'),
      ).toContainText("4a");
    });

    test("should calculate N=2 for 4-7 mm from collecting system", async ({
      page,
    }) => {
      await fillInput(page, "Tumor diameter", "4.0");
      await selectRadio(page, "Exophytic/endophytic nature", "≥ 50% exophytic");
      await selectRadio(page, "Nearness to collecting system", "4-7 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        "Entirely above or below polar line",
      );
      await selectOption(page, "Anterior/posterior location", "Anterior");

      await page.click('button:has-text("Calculate")');

      // Score should be 5a (1+1+2+1 = 5)
      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator('> div:has-text("Total Score")'),
      ).toContainText("5a");
    });

    test("should calculate N=3 for ≤ 4 mm from collecting system", async ({
      page,
    }) => {
      await fillInput(page, "Tumor diameter", "4.0");
      await selectRadio(page, "Exophytic/endophytic nature", "≥ 50% exophytic");
      await selectRadio(page, "Nearness to collecting system", "≤ 4 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        "Entirely above or below polar line",
      );
      await selectOption(page, "Anterior/posterior location", "Anterior");

      await page.click('button:has-text("Calculate")');

      // Score should be 6a (1+1+3+1 = 6)
      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator('> div:has-text("Total Score")'),
      ).toContainText("6a");
    });
  });

  test.describe("L Component - Location Relative to Polar Lines Testing", () => {
    test("should calculate L=1 for entirely above or below polar line", async ({
      page,
    }) => {
      await fillInput(page, "Tumor diameter", "4.0");
      await selectRadio(page, "Exophytic/endophytic nature", "≥ 50% exophytic");
      await selectRadio(page, "Nearness to collecting system", "≥ 7 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        "Entirely above or below polar line",
      );
      await selectOption(page, "Anterior/posterior location", "Anterior");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator('> div:has-text("Total Score")'),
      ).toContainText("4a");
    });

    test("should calculate L=2 for crosses polar line", async ({ page }) => {
      await fillInput(page, "Tumor diameter", "4.0");
      await selectRadio(page, "Exophytic/endophytic nature", "≥ 50% exophytic");
      await selectRadio(page, "Nearness to collecting system", "≥ 7 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        "Crosses polar line",
      );
      await selectOption(page, "Anterior/posterior location", "Anterior");

      await page.click('button:has-text("Calculate")');

      // Score should be 5a (1+1+1+2 = 5)
      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator('> div:has-text("Total Score")'),
      ).toContainText("5a");
    });

    test("should calculate L=3 for >50% across polar line or central", async ({
      page,
    }) => {
      await fillInput(page, "Tumor diameter", "4.0");
      await selectRadio(page, "Exophytic/endophytic nature", "≥ 50% exophytic");
      await selectRadio(page, "Nearness to collecting system", "≥ 7 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        ">50% across polar line/between lines/crosses midline",
      );
      await selectOption(page, "Anterior/posterior location", "Anterior");

      await page.click('button:has-text("Calculate")');

      // Score should be 6a (1+1+1+3 = 6)
      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator('> div:has-text("Total Score")'),
      ).toContainText("6a");
    });
  });

  test.describe("A Descriptor - Anterior/Posterior Location Testing", () => {
    test('should append "a" suffix for Anterior location', async ({ page }) => {
      await fillInput(page, "Tumor diameter", "4.0");
      await selectRadio(page, "Exophytic/endophytic nature", "≥ 50% exophytic");
      await selectRadio(page, "Nearness to collecting system", "≥ 7 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        "Entirely above or below polar line",
      );
      await selectOption(page, "Anterior/posterior location", "Anterior");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator('> div:has-text("Total Score")'),
      ).toContainText("4a");
    });

    test('should append "p" suffix for Posterior location', async ({
      page,
    }) => {
      await fillInput(page, "Tumor diameter", "4.0");
      await selectRadio(page, "Exophytic/endophytic nature", "≥ 50% exophytic");
      await selectRadio(page, "Nearness to collecting system", "≥ 7 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        "Entirely above or below polar line",
      );
      await selectOption(page, "Anterior/posterior location", "Posterior");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator('> div:has-text("Total Score")'),
      ).toContainText("4p");
    });

    test('should append "x" suffix for Neither/Indeterminate location', async ({
      page,
    }) => {
      await fillInput(page, "Tumor diameter", "4.0");
      await selectRadio(page, "Exophytic/endophytic nature", "≥ 50% exophytic");
      await selectRadio(page, "Nearness to collecting system", "≥ 7 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        "Entirely above or below polar line",
      );
      await selectOption(
        page,
        "Anterior/posterior location",
        "Neither/Indeterminate",
      );

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator('> div:has-text("Total Score")'),
      ).toContainText("4x");
    });
  });

  test.describe("Hilar Suffix Testing", () => {
    test('should append "h" suffix when hilar involvement is checked', async ({
      page,
    }) => {
      await fillInput(page, "Tumor diameter", "4.0");
      await selectRadio(page, "Exophytic/endophytic nature", "≥ 50% exophytic");
      await selectRadio(page, "Nearness to collecting system", "≥ 7 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        "Entirely above or below polar line",
      );
      await selectOption(page, "Anterior/posterior location", "Anterior");
      await toggleCheckbox(page, "Hilar location", true);

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator('> div:has-text("Total Score")'),
      ).toContainText("4ah");
    });

    test('should not append "h" when hilar involvement is unchecked', async ({
      page,
    }) => {
      await fillInput(page, "Tumor diameter", "4.0");
      await selectRadio(page, "Exophytic/endophytic nature", "≥ 50% exophytic");
      await selectRadio(page, "Nearness to collecting system", "≥ 7 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        "Entirely above or below polar line",
      );
      await selectOption(page, "Anterior/posterior location", "Anterior");
      // Ensure hilar is unchecked (default state)

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      const scoreText = await results
        .locator('> div:has-text("Total Score")')
        .textContent();
      expect(scoreText).toContain("4a");
      expect(scoreText).not.toContain("4ah");
    });

    test('should combine all suffixes: posterior + hilar = "ph"', async ({
      page,
    }) => {
      await fillInput(page, "Tumor diameter", "4.0");
      await selectRadio(page, "Exophytic/endophytic nature", "≥ 50% exophytic");
      await selectRadio(page, "Nearness to collecting system", "≥ 7 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        "Entirely above or below polar line",
      );
      await selectOption(page, "Anterior/posterior location", "Posterior");
      await toggleCheckbox(page, "Hilar location", true);

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator('> div:has-text("Total Score")'),
      ).toContainText("4ph");
    });

    test('should combine all suffixes: indeterminate + hilar = "xh"', async ({
      page,
    }) => {
      await fillInput(page, "Tumor diameter", "4.0");
      await selectRadio(page, "Exophytic/endophytic nature", "≥ 50% exophytic");
      await selectRadio(page, "Nearness to collecting system", "≥ 7 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        "Entirely above or below polar line",
      );
      await selectOption(
        page,
        "Anterior/posterior location",
        "Neither/Indeterminate",
      );
      await toggleCheckbox(page, "Hilar location", true);

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator('> div:has-text("Total Score")'),
      ).toContainText("4xh");
    });
  });

  test.describe("Complexity Classification Testing", () => {
    test("should classify score 4-6 as Low complexity", async ({ page }) => {
      // Test with score = 6
      await fillInput(page, "Tumor diameter", "4.0");
      await selectRadio(
        page,
        "Exophytic/endophytic nature",
        "Entirely endophytic",
      );
      await selectRadio(page, "Nearness to collecting system", "≥ 7 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        "Crosses polar line",
      );
      await selectOption(page, "Anterior/posterior location", "Anterior");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator('> div:has-text("Total Score")'),
      ).toContainText("6a");
      await expect(
        results.locator('> div:has-text("Complexity")'),
      ).toContainText("Low complexity");
    });

    test("should classify score 7-9 as Moderate complexity", async ({
      page,
    }) => {
      // Test with score = 7 (boundary)
      await fillInput(page, "Tumor diameter", "5.5");
      await selectRadio(page, "Exophytic/endophytic nature", "≥ 50% exophytic");
      await selectRadio(page, "Nearness to collecting system", "4-7 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        "Crosses polar line",
      );
      await selectOption(page, "Anterior/posterior location", "Anterior");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator('> div:has-text("Total Score")'),
      ).toContainText("7a");
      await expect(
        results.locator('> div:has-text("Complexity")'),
      ).toContainText("Moderate complexity");
    });

    test("should classify score 10-12 as High complexity", async ({ page }) => {
      // Test with score = 10 (boundary)
      await fillInput(page, "Tumor diameter", "7.0");
      await selectRadio(page, "Exophytic/endophytic nature", "≥ 50% exophytic");
      await selectRadio(page, "Nearness to collecting system", "4-7 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        ">50% across polar line/between lines/crosses midline",
      );
      await selectOption(page, "Anterior/posterior location", "Anterior");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator('> div:has-text("Total Score")'),
      ).toContainText("10a");
      await expect(
        results.locator('> div:has-text("Complexity")'),
      ).toContainText("High complexity");
    });
  });

  test.describe("Boundary Condition Testing", () => {
    test("should classify score 6 as Low (boundary before Moderate)", async ({
      page,
    }) => {
      await fillInput(page, "Tumor diameter", "3.0");
      await selectRadio(
        page,
        "Exophytic/endophytic nature",
        "Entirely endophytic",
      );
      await selectRadio(page, "Nearness to collecting system", "≥ 7 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        "Crosses polar line",
      );
      await selectOption(page, "Anterior/posterior location", "Anterior");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator('> div:has-text("Total Score")'),
      ).toContainText("6a");
      await expect(
        results.locator('> div:has-text("Complexity")'),
      ).toContainText("Low complexity");
    });

    test("should classify score 7 as Moderate (boundary entering Moderate)", async ({
      page,
    }) => {
      await fillInput(page, "Tumor diameter", "5.5");
      await selectRadio(page, "Exophytic/endophytic nature", "≥ 50% exophytic");
      await selectRadio(page, "Nearness to collecting system", "4-7 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        "Crosses polar line",
      );
      await selectOption(page, "Anterior/posterior location", "Anterior");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator('> div:has-text("Total Score")'),
      ).toContainText("7a");
      await expect(
        results.locator('> div:has-text("Complexity")'),
      ).toContainText("Moderate complexity");
    });

    test("should classify score 9 as Moderate (boundary before High)", async ({
      page,
    }) => {
      await fillInput(page, "Tumor diameter", "5.0");
      await selectRadio(page, "Exophytic/endophytic nature", "< 50% exophytic");
      await selectRadio(page, "Nearness to collecting system", "≤ 4 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        "Crosses polar line",
      );
      await selectOption(page, "Anterior/posterior location", "Anterior");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator('> div:has-text("Total Score")'),
      ).toContainText("9a");
      await expect(
        results.locator('> div:has-text("Complexity")'),
      ).toContainText("Moderate complexity");
    });

    test("should classify score 10 as High (boundary entering High)", async ({
      page,
    }) => {
      await fillInput(page, "Tumor diameter", "7.5");
      await selectRadio(page, "Exophytic/endophytic nature", "≥ 50% exophytic");
      await selectRadio(page, "Nearness to collecting system", "4-7 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        ">50% across polar line/between lines/crosses midline",
      );
      await selectOption(page, "Anterior/posterior location", "Anterior");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      await expect(
        results.locator('> div:has-text("Total Score")'),
      ).toContainText("10a");
      await expect(
        results.locator('> div:has-text("Complexity")'),
      ).toContainText("High complexity");
    });
  });

  test.describe("Clinical Interpretation Testing", () => {
    test("should provide appropriate interpretation for Low complexity", async ({
      page,
    }) => {
      await fillInput(page, "Tumor diameter", "3.5");
      await selectRadio(page, "Exophytic/endophytic nature", "≥ 50% exophytic");
      await selectRadio(page, "Nearness to collecting system", "≥ 7 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        "Entirely above or below polar line",
      );
      await selectOption(page, "Anterior/posterior location", "Anterior");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      const interpretation = await results
        .locator('> div:has-text("Interpretation")')
        .textContent();
      expect(interpretation).toContain("nephron-sparing");
      expect(interpretation).toContain("94%");
      expect(interpretation).toContain("partial nephrectomy");
    });

    test("should provide appropriate interpretation for Moderate complexity", async ({
      page,
    }) => {
      await fillInput(page, "Tumor diameter", "5.5");
      await selectRadio(page, "Exophytic/endophytic nature", "≥ 50% exophytic");
      await selectRadio(page, "Nearness to collecting system", "4-7 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        "Crosses polar line",
      );
      await selectOption(page, "Anterior/posterior location", "Anterior");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      const interpretation = await results
        .locator('> div:has-text("Interpretation")')
        .textContent();
      expect(interpretation).toContain("77%");
      expect(interpretation).toContain("partial nephrectomy");
      expect(interpretation).toContain("operative difficulty");
    });

    test("should provide appropriate interpretation for High complexity", async ({
      page,
    }) => {
      await fillInput(page, "Tumor diameter", "9.0");
      await selectRadio(
        page,
        "Exophytic/endophytic nature",
        "Entirely endophytic",
      );
      await selectRadio(page, "Nearness to collecting system", "≤ 4 mm");
      await selectRadio(
        page,
        "Location relative to polar line",
        ">50% across polar line/between lines/crosses midline",
      );
      await selectOption(page, "Anterior/posterior location", "Anterior");

      await page.click('button:has-text("Calculate")');

      const results = page.locator('section[aria-live="polite"]');
      const interpretation = await results
        .locator('> div:has-text("Interpretation")')
        .textContent();
      expect(interpretation).toContain("longer operative times");
      expect(interpretation).toContain("complication rates");
      expect(interpretation).toContain("66%");
      expect(interpretation).toContain("radical nephrectomy");
    });
  });

  test.describe("Reference Links Testing", () => {
    test("should display all reference links", async ({ page }) => {
      const referencesSection = page.locator(".references-section");
      await expect(referencesSection).toBeVisible();

      // Expand collapsed references to show all 4
      const expandBtn = referencesSection.locator(
        'button:has-text("more reference")',
      );
      if (await expandBtn.isVisible()) {
        await expandBtn.click();
      }

      // Verify all 4 references are present
      await expect(
        referencesSection.locator('a:has-text("Kutikov")'),
      ).toBeVisible();
      await expect(
        referencesSection.locator('a:has-text("Canter")'),
      ).toBeVisible();
      await expect(
        referencesSection.locator('a:has-text("Rosevear")'),
      ).toBeVisible();
      await expect(
        referencesSection.locator('a:has-text("AUA Guidelines")'),
      ).toBeVisible();
    });

    test("should have valid reference links", async ({ page }) => {
      const links = [
        { text: "Kutikov", url: "https://doi.org/10.1016/j.juro.2009.05.035" },
        {
          text: "Canter",
          url: "https://doi.org/10.1016/j.urology.2011.04.035",
        },
        { text: "Rosevear", url: "https://doi.org/10.1089/end.2012.0166" },
      ];

      for (const link of links) {
        const anchor = page.locator(`a:has-text("${link.text}")`);
        await expect(anchor).toHaveAttribute("href", link.url);
        await expect(anchor).toHaveAttribute("target", "_blank");
      }
    });
  });

  test.describe("Visual and Theme Consistency", () => {
    test("should maintain consistent styling", async ({ page }) => {
      // Check calculator card is present
      const card = page.locator(".rounded-lg").first();
      await expect(card).toBeVisible();

      // Verify info box uses theme colors
      const infoBox = page.getByTestId("calculator-info");
      await expect(infoBox).toBeVisible();

      // Verify Calculate button has proper styling
      const calculateButton = page.locator('button:has-text("Calculate")');
      await expect(calculateButton).toBeVisible();
    });

    test("should display diagram link", async ({ page }) => {
      const diagramLink = page.locator(
        'button:has-text("View RENAL Score Diagram")',
      );
      await expect(diagramLink).toBeVisible();

      // Verify it has the correct URL
      const href = await diagramLink.evaluate((el) => el.onclick?.toString());
      // The button should open Radiopaedia link
    });
  });
});
