import { test, expect } from "@playwright/test";
import { navigateToCalculator } from "../../../helpers/calculator-test-helper.js";

/**
 * E2E Tests for Hip Dysplasia Indices Calculator
 *
 * Tests cover:
 * - Navigation and UI rendering
 * - Age/gender-specific reference values
 * - Migration index calculations
 * - Multiple age groups (newborn, infant, preschool, school age)
 * - Both genders
 * - Edge cases and boundary conditions
 * - Reference link validation
 */

test.describe("Hip Dysplasia Indices Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, "Hip Dysplasia");
    await expect(page.locator('h2:has-text("Hip Dysplasia")')).toBeVisible();
  });

  test("should display calculator name and description", async ({ page }) => {
    await expect(page.locator("h2")).toContainText("Hip Dysplasia");
    await expect(
      page.locator(
        "text=Calculate migration indices and normal values in hip dysplasia",
      ),
    ).toBeVisible();
  });

  test("should display info section with migration index explanation", async ({
    page,
  }) => {
    // Check for info text
    await expect(
      page.locator("text=Migration index measurements"),
    ).toBeVisible();
    await expect(
      page.locator(
        "text=a = lateral distance from femoral head to acetabular line",
      ),
    ).toBeVisible();
    await expect(
      page.locator(
        "text=b = medial distance from acetabular line to center of femoral head",
      ),
    ).toBeVisible();

    // Check for interpretation ranges
    await expect(page.locator("text=<22%: Normal")).toBeVisible();
    await expect(page.locator("text=22-32%: Borderline/At risk")).toBeVisible();
    await expect(page.locator("text=33-59%: Subluxation")).toBeVisible();
    await expect(page.locator("text=60-89%: Severe subluxation")).toBeVisible();
    await expect(page.locator("text=≥90%: Dislocation")).toBeVisible();
  });

  test("should display reference diagram image", async ({ page }) => {
    const image = page.locator('img[alt="Reference diagram"]');
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute("src", "./migration_index_diagram.png");
  });

  test("should display all input fields", async ({ page }) => {
    // Date of birth
    await expect(page.locator('label:has-text("Date of birth")')).toBeVisible();
    await expect(page.locator('input[type="date"]')).toBeVisible();

    // Gender radio buttons
    await expect(page.locator('label:has-text("Gender")')).toBeVisible();
    await expect(
      page.locator('input[type="radio"][value="female"]'),
    ).toBeVisible();
    await expect(
      page.locator('input[type="radio"][value="male"]'),
    ).toBeVisible();

    // AC-Angle fields
    await expect(page.locator('label:has-text("AC-Angle")')).toHaveCount(2);

    // CCD-Angle fields
    await expect(page.locator('label:has-text("CCD-Angle")')).toHaveCount(2);

    // Migration Index fields
    await expect(page.locator('label:has-text("Migration Index")')).toHaveCount(
      4,
    );
  });

  test("should calculate normal values for newborn female (0-3 months)", async ({
    page,
  }) => {
    // Set date of birth to 1 month ago
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const dobString = oneMonthAgo.toISOString().split("T")[0];

    await page.fill('input[type="date"]', dobString);
    await page.click('input[type="radio"][value="female"]');

    await page.click('button:has-text("Calculate")');

    // Check normal values for newborn female
    await expect(page.locator("text=Normal AC-Angle")).toBeVisible();
    await expect(page.locator("text=27 ± 5°")).toBeVisible();
    await expect(page.locator("text=140-150° (newborn)")).toBeVisible();
  });

  test("should calculate normal values for newborn male (0-3 months)", async ({
    page,
  }) => {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const dobString = twoMonthsAgo.toISOString().split("T")[0];

    await page.fill('input[type="date"]', dobString);
    await page.click('input[type="radio"][value="male"]');

    await page.click('button:has-text("Calculate")');

    await expect(page.locator("text=25 ± 5°")).toBeVisible();
    await expect(page.locator("text=140-150° (newborn)")).toBeVisible();
  });

  test("should calculate normal values for infant female (4-6 months)", async ({
    page,
  }) => {
    const fiveMonthsAgo = new Date();
    fiveMonthsAgo.setMonth(fiveMonthsAgo.getMonth() - 5);
    const dobString = fiveMonthsAgo.toISOString().split("T")[0];

    await page.fill('input[type="date"]', dobString);
    await page.click('input[type="radio"][value="female"]');

    await page.click('button:has-text("Calculate")');

    await expect(page.locator("text=25 ± 4°")).toBeVisible();
    await expect(page.locator("text=135-145° (infant)")).toBeVisible();
  });

  test("should calculate normal values for infant male (4-6 months)", async ({
    page,
  }) => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const dobString = sixMonthsAgo.toISOString().split("T")[0];

    await page.fill('input[type="date"]', dobString);
    await page.click('input[type="radio"][value="male"]');

    await page.click('button:has-text("Calculate")');

    await expect(page.locator("text=23 ± 4°")).toBeVisible();
    await expect(page.locator("text=135-145° (infant)")).toBeVisible();
  });

  test("should calculate normal values for 1-year-old female", async ({
    page,
  }) => {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const dobString = twelveMonthsAgo.toISOString().split("T")[0];

    await page.fill('input[type="date"]', dobString);
    await page.click('input[type="radio"][value="female"]');

    await page.click('button:has-text("Calculate")');

    await expect(page.locator("text=23 ± 3°")).toBeVisible();
    await expect(page.locator("text=130-140° (1 year)")).toBeVisible();
  });

  test("should calculate normal values for 2-year-old male", async ({
    page,
  }) => {
    const twentyFourMonthsAgo = new Date();
    twentyFourMonthsAgo.setMonth(twentyFourMonthsAgo.getMonth() - 24);
    const dobString = twentyFourMonthsAgo.toISOString().split("T")[0];

    await page.fill('input[type="date"]', dobString);
    await page.click('input[type="radio"][value="male"]');

    await page.click('button:has-text("Calculate")');

    await expect(page.locator("text=20 ± 3°")).toBeVisible();
    await expect(page.locator("text=125-135° (2 years)")).toBeVisible();
  });

  test("should calculate normal values for preschool child (3-5 years)", async ({
    page,
  }) => {
    const fortyMonthsAgo = new Date();
    fortyMonthsAgo.setMonth(fortyMonthsAgo.getMonth() - 40);
    const dobString = fortyMonthsAgo.toISOString().split("T")[0];

    await page.fill('input[type="date"]', dobString);
    await page.click('input[type="radio"][value="female"]');

    await page.click('button:has-text("Calculate")');

    await expect(page.locator("text=18-22° (preschool)")).toBeVisible();
    await expect(page.locator("text=125-135° (child)")).toBeVisible();
  });

  test("should calculate normal values for school age child (>5 years)", async ({
    page,
  }) => {
    const sevenYearsAgo = new Date();
    sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);
    const dobString = sevenYearsAgo.toISOString().split("T")[0];

    await page.fill('input[type="date"]', dobString);
    await page.click('input[type="radio"][value="male"]');

    await page.click('button:has-text("Calculate")');

    await expect(page.locator("text=15-20° (school age)")).toBeVisible();
    await expect(page.locator("text=125-135° (adult range)")).toBeVisible();
  });

  test("should calculate migration index for right hip - normal range", async ({
    page,
  }) => {
    // Set up a 4-year-old child (48 months)
    const fortyEightMonthsAgo = new Date();
    fortyEightMonthsAgo.setMonth(fortyEightMonthsAgo.getMonth() - 48);
    const dobString = fortyEightMonthsAgo.toISOString().split("T")[0];

    await page.fill('input[type="date"]', dobString);
    await page.click('input[type="radio"][value="female"]');

    // Enter migration index values for right hip: a=10, b=90 (should give ~10% - Normal)
    const miRightA = page.locator('input[id="mi_right_a"]');
    const miRightB = page.locator('input[id="mi_right_b"]');

    await miRightA.fill("10");
    await miRightB.fill("90");

    await page.click('button:has-text("Calculate")');

    // Migration Index = (10 / (10 + 90)) * 100 = 10%
    const results = page.locator('section[aria-live="polite"]');
    await expect(results.locator("text=Migration Index (Right)")).toBeVisible();
    await expect(results.locator("text=10.0%")).toBeVisible();
    await expect(results.locator("text=Normal")).toBeVisible();
  });

  test("should calculate migration index - borderline/at risk (22-32%)", async ({
    page,
  }) => {
    // Set up a 4-year-old child
    const fortyEightMonthsAgo = new Date();
    fortyEightMonthsAgo.setMonth(fortyEightMonthsAgo.getMonth() - 48);
    const dobString = fortyEightMonthsAgo.toISOString().split("T")[0];

    await page.fill('input[type="date"]', dobString);
    await page.click('input[type="radio"][value="male"]');

    // Enter migration index values: a=25, b=75 (should give 25% - Borderline)
    await page.fill('input[id="mi_left_a"]', "25");
    await page.fill('input[id="mi_left_b"]', "75");

    await page.click('button:has-text("Calculate")');

    const results = page.locator('section[aria-live="polite"]');
    await expect(results.locator("text=Migration Index (Left)")).toBeVisible();
    await expect(results.locator("text=25.0%")).toBeVisible();
    await expect(results.locator("text=Borderline/At risk")).toBeVisible();
  });

  test("should calculate migration index - subluxation (33-59%)", async ({
    page,
  }) => {
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    const dobString = threeYearsAgo.toISOString().split("T")[0];

    await page.fill('input[type="date"]', dobString);
    await page.click('input[type="radio"][value="female"]');

    // Enter migration index values: a=40, b=60 (should give 40% - Subluxation)
    await page.fill('input[id="mi_right_a"]', "40");
    await page.fill('input[id="mi_right_b"]', "60");

    await page.click('button:has-text("Calculate")');

    const results = page.locator('section[aria-live="polite"]');
    await expect(results.locator("text=40.0%")).toBeVisible();
    await expect(results.locator("text=Subluxation")).toBeVisible();
  });

  test("should calculate migration index - severe subluxation (60-89%)", async ({
    page,
  }) => {
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const dobString = fiveYearsAgo.toISOString().split("T")[0];

    await page.fill('input[type="date"]', dobString);
    await page.click('input[type="radio"][value="male"]');

    // Enter migration index values: a=70, b=30 (should give 70% - Severe subluxation)
    await page.fill('input[id="mi_left_a"]', "70");
    await page.fill('input[id="mi_left_b"]', "30");

    await page.click('button:has-text("Calculate")');

    const results = page.locator('section[aria-live="polite"]');
    await expect(results.locator("text=70.0%")).toBeVisible();
    await expect(results.locator("text=Severe subluxation")).toBeVisible();
  });

  test("should calculate migration index - dislocation (≥90%)", async ({
    page,
  }) => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const dobString = twoYearsAgo.toISOString().split("T")[0];

    await page.fill('input[type="date"]', dobString);
    await page.click('input[type="radio"][value="female"]');

    // Enter migration index values: a=95, b=5 (should give 95% - Dislocation)
    await page.fill('input[id="mi_right_a"]', "95");
    await page.fill('input[id="mi_right_b"]', "5");

    await page.click('button:has-text("Calculate")');

    const results = page.locator('section[aria-live="polite"]');
    await expect(results.locator("text=95.0%")).toBeVisible();
    await expect(results.locator("text=Dislocation")).toBeVisible();
  });

  test("should calculate bilateral migration indices", async ({ page }) => {
    const fourYearsAgo = new Date();
    fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);
    const dobString = fourYearsAgo.toISOString().split("T")[0];

    await page.fill('input[type="date"]', dobString);
    await page.click('input[type="radio"][value="male"]');

    // Right hip: a=15, b=85 (15% - Normal)
    await page.fill('input[id="mi_right_a"]', "15");
    await page.fill('input[id="mi_right_b"]', "85");

    // Left hip: a=28, b=72 (28% - Borderline)
    await page.fill('input[id="mi_left_a"]', "28");
    await page.fill('input[id="mi_left_b"]', "72");

    await page.click('button:has-text("Calculate")');

    // Check both results
    await expect(page.locator("text=Migration Index (Right)")).toBeVisible();
    await expect(page.locator("text=15.0%")).toBeVisible();
    await expect(page.locator("text=Migration Index (Left)")).toBeVisible();
    await expect(page.locator("text=28.0%")).toBeVisible();
  });

  test("should handle infant under 3 years with different interpretation ranges", async ({
    page,
  }) => {
    // Test a 2-year-old (24 months) - should use different thresholds
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const dobString = twoYearsAgo.toISOString().split("T")[0];

    await page.fill('input[type="date"]', dobString);
    await page.click('input[type="radio"][value="female"]');

    // Enter migration index of 15% (would be "At risk" for under 3 years)
    await page.fill('input[id="mi_right_a"]', "15");
    await page.fill('input[id="mi_right_b"]', "85");

    await page.click('button:has-text("Calculate")');

    const results = page.locator('section[aria-live="polite"]');
    await expect(results.locator("text=15.0%")).toBeVisible();
    await expect(results.locator("text=At risk")).toBeVisible();
  });

  test("should handle edge case: 100% migration (complete dislocation)", async ({
    page,
  }) => {
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    const dobString = threeYearsAgo.toISOString().split("T")[0];

    await page.fill('input[type="date"]', dobString);
    await page.click('input[type="radio"][value="male"]');

    // Enter migration index values: a=100, b=0 (100% - Complete dislocation)
    await page.fill('input[id="mi_left_a"]', "100");
    await page.fill('input[id="mi_left_b"]', "0");

    await page.click('button:has-text("Calculate")');

    const results = page.locator('section[aria-live="polite"]');
    await expect(results.locator("text=100.0%")).toBeVisible();
    await expect(results.locator("text=Dislocation")).toBeVisible();
  });

  test("should handle edge case: 0% migration (perfectly centered)", async ({
    page,
  }) => {
    const fourYearsAgo = new Date();
    fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);
    const dobString = fourYearsAgo.toISOString().split("T")[0];

    await page.fill('input[type="date"]', dobString);
    await page.click('input[type="radio"][value="female"]');

    // Enter migration index values: a=0, b=100 (0% - Perfect)
    await page.fill('input[id="mi_right_a"]', "0");
    await page.fill('input[id="mi_right_b"]', "100");

    await page.click('button:has-text("Calculate")');

    const results = page.locator('section[aria-live="polite"]');
    await expect(results.locator("text=0.0%")).toBeVisible();
    await expect(results.locator("text=Normal")).toBeVisible();
  });

  test("should display all three references", async ({ page }) => {
    await expect(page.locator('h3:has-text("References")')).toBeVisible();

    // Check for three reference links
    const references = page.locator('section:has(h3:has-text("References")) a');
    await expect(references).toHaveCount(3);

    // Verify reference texts and URLs
    await expect(
      page.locator('a[href="https://pubmed.ncbi.nlm.nih.gov/954321/"]'),
    ).toBeVisible();
    await expect(
      page.locator("text=Tönnis D. Normal values of the hip joint"),
    ).toBeVisible();

    await expect(
      page.locator('a[href="https://doi.org/10.1007/978-3-662-06621-8"]'),
    ).toBeVisible();
    await expect(
      page.locator("text=Die Angeborene Hüftdysplasie"),
    ).toBeVisible();

    await expect(
      page.locator('a[href="https://pubmed.ncbi.nlm.nih.gov/6930145/"]'),
    ).toBeVisible();
    await expect(
      page.locator("text=Reimers J. The stability of the hip in children"),
    ).toBeVisible();
  });

  test("should open reference links in new tab", async ({ page }) => {
    const firstRef = page.locator(
      'a[href="https://pubmed.ncbi.nlm.nih.gov/954321/"]',
    );
    await expect(firstRef).toHaveAttribute("target", "_blank");
    await expect(firstRef).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("should require date of birth and gender for normal values", async ({
    page,
  }) => {
    await page.click('button:has-text("Calculate")');

    // Should show message when DOB or gender is missing
    await expect(
      page.locator("text=Enter date of birth and gender"),
    ).toBeVisible();
  });

  test("should calculate migration index without date of birth", async ({
    page,
  }) => {
    // Migration index should work without DOB
    await page.fill('input[id="mi_right_a"]', "20");
    await page.fill('input[id="mi_right_b"]', "80");

    await page.click('button:has-text("Calculate")');

    // Should still show migration index calculation
    await expect(page.locator("text=Migration Index (Right)")).toBeVisible();
    await expect(page.locator("text=20.0%")).toBeVisible();
  });

  test("should handle decimal values in migration index", async ({ page }) => {
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    const dobString = threeYearsAgo.toISOString().split("T")[0];

    await page.fill('input[type="date"]', dobString);
    await page.click('input[type="radio"][value="female"]');

    // Enter decimal values
    await page.fill('input[id="mi_right_a"]', "12.5");
    await page.fill('input[id="mi_right_b"]', "87.5");

    await page.click('button:has-text("Calculate")');

    // Should calculate correctly: 12.5 / 100 = 12.5%
    await expect(page.locator("text=12.5%")).toBeVisible();
  });

  test("should be responsive on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size

    // Check that calculator is visible and usable
    await expect(page.locator('h2:has-text("Hip Dysplasia")')).toBeVisible();
    await expect(page.locator('input[type="date"]')).toBeVisible();
    await expect(page.locator('button:has-text("Calculate")')).toBeVisible();
  });

  test("should be responsive on tablet viewport", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad size

    await expect(page.locator('h2:has-text("Hip Dysplasia")')).toBeVisible();
    await expect(page.locator('input[type="date"]')).toBeVisible();
  });

  test("should reset values when switching calculators", async ({ page }) => {
    // Enter some values
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const dobString = oneYearAgo.toISOString().split("T")[0];

    await page.fill('input[type="date"]', dobString);
    await page.click('input[type="radio"][value="female"]');
    await page.fill('input[id="mi_right_a"]', "20");

    // Switch to another calculator
    await page.click("text=Spleen Size");

    // Switch back to Hip Dysplasia
    await page.click("text=Hip Dysplasia");

    // Fields should be reset
    await expect(page.locator('input[type="date"]')).toHaveValue("");
    await expect(
      page.locator('input[type="radio"][value="female"]'),
    ).not.toBeChecked();
  });
});

test.describe("Hip Dysplasia Calculator - Accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, "Hip Dysplasia");
  });

  test("should have proper ARIA labels", async ({ page }) => {
    const inputFields = page.locator('div[aria-label="Input fields"]');
    await expect(inputFields).toBeVisible();
  });

  test("should support keyboard navigation", async ({ page }) => {
    // Tab through form fields
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    // Radio buttons should be focusable
    const femaleRadio = page.locator('input[type="radio"][value="female"]');
    await femaleRadio.focus();
    await page.keyboard.press("Space");

    await expect(femaleRadio).toBeChecked();
  });
});
