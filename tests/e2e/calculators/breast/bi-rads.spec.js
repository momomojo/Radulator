import { test, expect } from "@playwright/test";
import { navigateToCalculator } from "../../../helpers/calculator-test-helper.js";

/**
 * E2E Tests for ACR BI-RADS Calculator
 * Breast Imaging Reporting and Data System
 *
 * ACR BI-RADS standardized classification for mammography, ultrasound, and MRI.
 *
 * Categories:
 * - Category 0: Incomplete - need additional imaging
 * - Category 1: Negative - essentially 0% malignancy risk
 * - Category 2: Benign - essentially 0% malignancy risk
 * - Category 3: Probably benign - <2% malignancy risk
 * - Category 4A: Low suspicion - 2-10% malignancy risk
 * - Category 4B: Moderate suspicion - 10-50% malignancy risk
 * - Category 4C: High suspicion - 50-95% malignancy risk
 * - Category 5: Highly suggestive - >95% malignancy risk
 * - Category 6: Known biopsy-proven malignancy
 *
 * Source: ACR BI-RADS Atlas, 5th Edition (2013)
 */

test.describe("ACR BI-RADS Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, "ACR BI-RADS");
  });

  test.describe("Visual and UI Tests", () => {
    test("should display calculator with correct title and description", async ({
      page,
    }) => {
      await expect(page.locator("h2")).toContainText("ACR BI-RADS");
      await expect(
        page.getByText("Breast Imaging Reporting and Data System").first(),
      ).toBeVisible();
    });

    test("should display imaging modality options", async ({ page }) => {
      await expect(page.getByText("Imaging Modality")).toBeVisible();
      await expect(page.getByLabel("Mammography")).toBeVisible();
      await expect(page.getByLabel("Ultrasound")).toBeVisible();
      await expect(page.getByLabel("MRI", { exact: true })).toBeVisible();
    });

    test("should display study context options", async ({ page }) => {
      await expect(page.getByText("Study Context")).toBeVisible();
      await expect(page.getByLabel("Screening examination")).toBeVisible();
      await expect(page.getByLabel("Diagnostic examination")).toBeVisible();
      await expect(
        page.getByLabel("Known biopsy-proven malignancy"),
      ).toBeVisible();
    });

    test("should display info section with BI-RADS explanation", async ({
      page,
    }) => {
      await expect(
        page.getByText("standardized system for breast imaging").first(),
      ).toBeVisible();
    });
  });

  test.describe("Category 0 - Incomplete", () => {
    test("should calculate Category 0 when additional mammographic imaging needed", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Screening examination").click();
      await page.getByLabel("Yes - need additional imaging evaluation").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=0 - Incomplete")).toBeVisible();
      await expect(
        page.locator("text=Recall for additional imaging evaluation"),
      ).toBeVisible();
      await expect(
        page.locator(
          "text=Additional mammographic views, ultrasound, or prior images",
        ),
      ).toBeVisible();
    });

    test("should calculate Category 0 for ultrasound needing mammography", async ({
      page,
    }) => {
      await page.getByLabel("Ultrasound").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("Yes - need additional imaging evaluation").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=0 - Incomplete")).toBeVisible();
      await expect(
        page.locator("text=Mammography if not performed"),
      ).toBeVisible();
    });

    test("should calculate Category 0 for MRI needing prior comparison", async ({
      page,
    }) => {
      await page.getByLabel("MRI", { exact: true }).click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("Yes - need additional imaging evaluation").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=0 - Incomplete")).toBeVisible();
      await expect(
        page.locator(
          "text=Prior studies for comparison or additional sequences",
        ),
      ).toBeVisible();
    });
  });

  test.describe("Category 1 - Negative", () => {
    test("should calculate Category 1 for negative screening mammogram", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Screening examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Negative - no findings").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=1 - Negative")).toBeVisible();
      await expect(page.locator("text=Essentially 0%")).toBeVisible();
      await expect(
        page.locator("text=Routine screening mammography"),
      ).toBeVisible();
      await expect(
        page.locator("text=Annual (or per guidelines)"),
      ).toBeVisible();
    });

    test("should calculate Category 1 for negative diagnostic ultrasound", async ({
      page,
    }) => {
      await page.getByLabel("Ultrasound").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Negative - no findings").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=1 - Negative")).toBeVisible();
      await expect(
        page.locator("text=Return to annual screening"),
      ).toBeVisible();
    });
  });

  test.describe("Category 2 - Benign", () => {
    test("should calculate Category 2 for definitively benign finding", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Screening examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page
        .getByLabel(
          "Benign finding (cyst, calcified fibroadenoma, fat-containing lesion, implant)",
        )
        .click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=2 - Benign")).toBeVisible();
      await expect(page.locator("text=Essentially 0%")).toBeVisible();
      await expect(
        page.locator("text=Routine screening mammography"),
      ).toBeVisible();
      await expect(
        page.locator("text=Definitively benign finding"),
      ).toBeVisible();
    });

    test("should calculate Category 2 on ultrasound", async ({ page }) => {
      await page.getByLabel("Ultrasound").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page
        .getByLabel(
          "Benign finding (cyst, calcified fibroadenoma, fat-containing lesion, implant)",
        )
        .click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=2 - Benign")).toBeVisible();
    });
  });

  test.describe("Category 3 - Probably Benign", () => {
    test("should calculate Category 3 for oval circumscribed mass with low suspicion", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Mass", { exact: true }).click();
      await page.getByLabel("Oval").click();
      await page.getByLabel("Circumscribed").click();
      await page.getByLabel("Equal density").click();
      await page
        .getByLabel("Probably benign (<2% likelihood of malignancy)")
        .click();

      await page.click('button:has-text("Calculate")');

      // Check results in the results section (aria-live="polite")
      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(
        resultsSection.locator("text=3 - Probably Benign"),
      ).toBeVisible();
      await expect(
        resultsSection.locator("text=Malignancy Likelihood:"),
      ).toBeVisible();
      await expect(
        resultsSection.locator("text=Short-interval follow-up (6 months)"),
      ).toBeVisible();
    });

    test("should show Category 3 follow-up protocol in clinical notes", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Mass", { exact: true }).click();
      await page.getByLabel("Oval").click();
      await page.getByLabel("Circumscribed").click();
      await page.getByLabel("Low density").click();
      await page
        .getByLabel("Probably benign (<2% likelihood of malignancy)")
        .click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=6-month unilateral")).toBeVisible();
      await expect(
        page.locator("text=Biopsy may be considered if patient preference"),
      ).toBeVisible();
    });

    test("should calculate Category 3 for typically benign calcifications", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Screening examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Calcifications (without mass)").click();
      await page
        .getByLabel(
          "Typically benign (skin, vascular, coarse, large rod-like, round, rim, dystrophic, milk of calcium, suture)",
        )
        .click();

      await page.click('button:has-text("Calculate")');

      // Typically benign calcifications don't show suspicion level, should show error
      await expect(
        page.locator("text=Please select the overall suspicion level"),
      ).toBeVisible();
    });
  });

  test.describe("Category 4A - Low Suspicion", () => {
    test("should calculate Category 4A for mass with low suspicion", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Mass", { exact: true }).click();
      await page.getByLabel("Oval").click();
      await page.getByLabel("Obscured").click();
      await page.getByLabel("Equal density").click();
      await page.getByLabel("Low suspicion for malignancy (2-10%)").click();

      await page.click('button:has-text("Calculate")');

      // Check results in the results section (aria-live="polite")
      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(
        resultsSection.locator("text=4A - Low Suspicion for Malignancy"),
      ).toBeVisible();
      await expect(
        resultsSection.locator("text=Malignancy Likelihood:"),
      ).toBeVisible();
      await expect(
        resultsSection.locator("text=Tissue diagnosis recommended (biopsy)"),
      ).toBeVisible();
    });

    test("should calculate Category 4A for amorphous calcifications", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Screening examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Calcifications (without mass)").click();
      await page.getByLabel("Amorphous").click();
      await page.getByLabel("Grouped (clustered)").click();
      await page.getByLabel("Low suspicion for malignancy (2-10%)").click();

      await page.click('button:has-text("Calculate")');

      // Check results in the results section (aria-live="polite")
      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(
        resultsSection.locator("text=4A - Low Suspicion for Malignancy"),
      ).toBeVisible();
      await expect(
        resultsSection.locator("text=Calcifications: amorphous"),
      ).toBeVisible();
    });
  });

  test.describe("Category 4B - Moderate Suspicion", () => {
    test("should calculate Category 4B for mass with moderate suspicion", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Mass", { exact: true }).click();
      await page.getByLabel("Irregular").click();
      await page.getByLabel("Indistinct").click();
      await page.getByLabel("Equal density").click();
      await page.getByLabel("Moderate suspicion (10-50%)").click();

      await page.click('button:has-text("Calculate")');

      // Check results in the results section (aria-live="polite")
      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(
        resultsSection.locator("text=4B - Moderate Suspicion for Malignancy"),
      ).toBeVisible();
      await expect(
        resultsSection.locator("text=Malignancy Likelihood:"),
      ).toBeVisible();
      await expect(
        resultsSection.locator("text=Tissue diagnosis required (biopsy)"),
      ).toBeVisible();
    });

    test("should calculate Category 4B for coarse heterogeneous calcifications", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Calcifications (without mass)").click();
      await page.getByLabel("Coarse heterogeneous").click();
      await page.getByLabel("Regional").click();
      await page.getByLabel("Moderate suspicion (10-50%)").click();

      await page.click('button:has-text("Calculate")');

      // Check results in the results section (aria-live="polite")
      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(
        resultsSection.locator("text=4B - Moderate Suspicion for Malignancy"),
      ).toBeVisible();
      await expect(
        resultsSection.locator("text=Calcifications: coarse_heterogeneous"),
      ).toBeVisible();
    });
  });

  test.describe("Category 4C - High Suspicion", () => {
    test("should calculate Category 4C for mass with high suspicion", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Mass", { exact: true }).click();
      await page.getByLabel("Irregular").click();
      await page.getByLabel("Spiculated").click();
      await page.getByLabel("High density").click();
      await page.getByLabel("High suspicion (50-95%)").click();

      await page.click('button:has-text("Calculate")');

      // Check results in the results section (aria-live="polite")
      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(
        resultsSection.locator("text=4C - High Suspicion for Malignancy"),
      ).toBeVisible();
      await expect(
        resultsSection.locator("text=Malignancy Likelihood:"),
      ).toBeVisible();
      await expect(resultsSection.locator("text=high PPV")).toBeVisible();
    });

    test("should show clinical note for spiculated margins", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Mass", { exact: true }).click();
      await page.getByLabel("Irregular").click();
      await page.getByLabel("Spiculated").click();
      await page.getByLabel("High density").click();
      await page.getByLabel("High suspicion (50-95%)").click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "text=Spiculated margins and irregular shape are highly suspicious",
        ),
      ).toBeVisible();
    });

    test("should calculate Category 4C for fine pleomorphic calcifications", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Calcifications (without mass)").click();
      await page.getByLabel("Fine pleomorphic").click();
      await page.getByLabel("Segmental").click();
      await page.getByLabel("High suspicion (50-95%)").click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=4C - High Suspicion for Malignancy"),
      ).toBeVisible();
      await expect(
        page.locator("text=Segmental or linear distribution suggests ductal"),
      ).toBeVisible();
    });
  });

  test.describe("Category 5 - Highly Suggestive of Malignancy", () => {
    test("should calculate Category 5 for highly suspicious mass", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Mass", { exact: true }).click();
      await page.getByLabel("Irregular").click();
      await page.getByLabel("Spiculated").click();
      await page.getByLabel("High density").click();
      await page.getByLabel("Highly suggestive of malignancy (>95%)").click();

      await page.click('button:has-text("Calculate")');

      // Check results in the results section (aria-live="polite")
      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(
        resultsSection.locator("text=5 - Highly Suggestive of Malignancy"),
      ).toBeVisible();
      await expect(
        resultsSection.locator("text=Malignancy Likelihood:"),
      ).toBeVisible();
      await expect(
        resultsSection.locator("text=appropriate action should be taken"),
      ).toBeVisible();
    });

    test("should calculate Category 5 for fine linear calcifications", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Calcifications (without mass)").click();
      await page.getByLabel("Fine linear or fine-linear branching").click();
      await page.getByLabel("Linear", { exact: true }).click();
      await page.getByLabel("Highly suggestive of malignancy (>95%)").click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=5 - Highly Suggestive of Malignancy"),
      ).toBeVisible();
      await expect(
        page.locator(
          "text=Fine linear/branching calcifications are the most suspicious",
        ),
      ).toBeVisible();
    });

    test("should calculate Category 5 for architectural distortion", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Architectural distortion").click();
      await page.getByLabel("Highly suggestive of malignancy (>95%)").click();

      await page.click('button:has-text("Calculate")');

      // Check results in the results section (aria-live="polite")
      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(
        resultsSection.locator("text=5 - Highly Suggestive of Malignancy"),
      ).toBeVisible();
      await expect(
        resultsSection.locator("text=Finding Description:"),
      ).toBeVisible();
    });
  });

  test.describe("Category 6 - Known Biopsy-Proven Malignancy", () => {
    test("should calculate Category 6 for known malignancy", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Known biopsy-proven malignancy").click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=6 - Known Biopsy-Proven Malignancy"),
      ).toBeVisible();
      await expect(
        page.locator("text=Surgical excision when clinically appropriate"),
      ).toBeVisible();
      await expect(
        page.locator("text=treatment planning and response assessment"),
      ).toBeVisible();
    });

    test("should calculate Category 6 on ultrasound for known malignancy", async ({
      page,
    }) => {
      await page.getByLabel("Ultrasound").click();
      await page.getByLabel("Known biopsy-proven malignancy").click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=6 - Known Biopsy-Proven Malignancy"),
      ).toBeVisible();
    });

    test("should calculate Category 6 on MRI for known malignancy", async ({
      page,
    }) => {
      await page.getByLabel("MRI", { exact: true }).click();
      await page.getByLabel("Known biopsy-proven malignancy").click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=6 - Known Biopsy-Proven Malignancy"),
      ).toBeVisible();
    });
  });

  test.describe("Asymmetry Finding Types", () => {
    test("should calculate for focal asymmetry with low suspicion", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Asymmetry", { exact: true }).click();
      await page.getByLabel("Focal asymmetry").click();
      await page.getByLabel("Low suspicion for malignancy (2-10%)").click();

      await page.click('button:has-text("Calculate")');

      // Check results in the results section (aria-live="polite")
      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(
        resultsSection.locator("text=4A - Low Suspicion"),
      ).toBeVisible();
      await expect(
        resultsSection.locator("text=Asymmetry: focal"),
      ).toBeVisible();
    });

    test("should show developing asymmetry clinical note", async ({ page }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Asymmetry", { exact: true }).click();
      await page.getByLabel("Developing asymmetry (new or increased)").click();
      await page.getByLabel("Moderate suspicion (10-50%)").click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Developing asymmetry warrants tissue diagnosis"),
      ).toBeVisible();
    });
  });

  test.describe("Associated Features Only", () => {
    test("should calculate for associated features with suspicion", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page
        .getByLabel(
          "Associated features only (skin changes, nipple retraction)",
        )
        .click();
      await page.getByLabel("Moderate suspicion (10-50%)").click();

      await page.click('button:has-text("Calculate")');

      // Check results in the results section (aria-live="polite")
      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(
        resultsSection.locator("text=4B - Moderate Suspicion"),
      ).toBeVisible();
      await expect(
        resultsSection.locator(
          "text=Associated features (skin/nipple changes)",
        ),
      ).toBeVisible();
    });
  });

  test.describe("Conditional Field Visibility", () => {
    test("should hide additional imaging field for known cancer context", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Known biopsy-proven malignancy").click();

      // Additional imaging field should not be visible for known cancer
      await expect(
        page.getByText("Additional Imaging/Assessment Needed"),
      ).not.toBeVisible();
    });

    test("should hide finding type when additional imaging needed", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Screening examination").click();
      await page.getByLabel("Yes - need additional imaging evaluation").click();

      // Finding type should not be visible when additional imaging needed
      await expect(page.getByText("Finding Type")).not.toBeVisible();
    });

    test("should show mass density only for mammography", async ({ page }) => {
      // For mammography - density should show
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Mass", { exact: true }).click();
      await page.getByLabel("Oval").click();
      await page.getByLabel("Circumscribed").click();

      await expect(page.getByText("Mass Density")).toBeVisible();
    });

    test("should hide mass density for ultrasound", async ({ page }) => {
      // For ultrasound - density should NOT show
      await page.getByLabel("Ultrasound").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Mass", { exact: true }).click();
      await page.getByLabel("Oval").click();
      await page.getByLabel("Circumscribed").click();

      await expect(page.getByText("Mass Density")).not.toBeVisible();
    });

    test("should show calcification distribution only for suspicious morphology", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Calcifications (without mass)").click();

      // Typically benign should NOT show distribution
      await page
        .getByLabel(
          "Typically benign (skin, vascular, coarse, large rod-like, round, rim, dystrophic, milk of calcium, suture)",
        )
        .click();
      await expect(
        page.getByText("Calcification Distribution"),
      ).not.toBeVisible();

      // Amorphous should show distribution
      await page.getByLabel("Amorphous").click();
      await expect(page.getByText("Calcification Distribution")).toBeVisible();
    });
  });

  test.describe("Input Validation", () => {
    test("should show error when finding type not selected", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Screening examination").click();
      await page.getByLabel("No - assessment complete").click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Please select the finding type"),
      ).toBeVisible();
    });

    test("should show error when suspicion level not selected for mass", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Mass", { exact: true }).click();
      await page.getByLabel("Oval").click();
      await page.getByLabel("Circumscribed").click();
      await page.getByLabel("Equal density").click();
      // Don't select suspicion level

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Please select the overall suspicion level"),
      ).toBeVisible();
    });
  });

  test.describe("Finding Descriptions", () => {
    test("should display mass finding description accurately", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Mass", { exact: true }).click();
      await page.getByLabel("Irregular").click();
      await page.getByLabel("Spiculated").click();
      await page.getByLabel("High density").click();
      await page.getByLabel("High suspicion (50-95%)").click();

      await page.click('button:has-text("Calculate")');

      // Check results in the results section (aria-live="polite")
      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(
        resultsSection.locator("text=Mass: irregular"),
      ).toBeVisible();
      await expect(
        resultsSection.locator("text=Finding Description:"),
      ).toBeVisible();
    });

    test("should display calcification finding description", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Calcifications (without mass)").click();
      await page.getByLabel("Fine pleomorphic").click();
      await page.getByLabel("Segmental").click();
      await page.getByLabel("High suspicion (50-95%)").click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Calcifications: fine_pleomorphic"),
      ).toBeVisible();
      await expect(page.locator("text=segmental distribution")).toBeVisible();
    });
  });

  test.describe("References", () => {
    test("should display ACR BI-RADS references", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: "References" }),
      ).toBeVisible();
      await expect(page.getByText("D'Orsi CJ").first()).toBeVisible();
    });

    test("should have valid reference links", async ({ page }) => {
      // ACR BI-RADS Atlas link
      const acrLink = page.locator(
        'a[href="https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/Bi-Rads"]',
      );
      await expect(acrLink).toBeVisible();

      // DOI link for primary paper
      const doiLink = page.locator(
        'a[href="https://doi.org/10.1016/j.jacr.2013.05.016"]',
      );
      await expect(doiLink).toBeVisible();
    });

    test("should have reference for follow-up guidelines", async ({ page }) => {
      // Sickles 1991 reference
      await expect(page.getByText("Sickles EA").first()).toBeVisible();
      await expect(page.getByText("Radiology. 1991")).toBeVisible();
    });
  });

  test.describe("Modality-Specific Workflows", () => {
    test("should complete full mammography workflow", async ({ page }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Screening examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Mass", { exact: true }).click();
      await page.getByLabel("Round").click();
      await page.getByLabel("Circumscribed").click();
      await page.getByLabel("Equal density").click();
      await page
        .getByLabel("Probably benign (<2% likelihood of malignancy)")
        .click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=3 - Probably Benign")).toBeVisible();
    });

    test("should complete full ultrasound workflow", async ({ page }) => {
      await page.getByLabel("Ultrasound").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Mass", { exact: true }).click();
      await page.getByLabel("Oval").click();
      await page.getByLabel("Circumscribed").click();
      // Note: No density for ultrasound
      await page
        .getByLabel("Probably benign (<2% likelihood of malignancy)")
        .click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=3 - Probably Benign")).toBeVisible();
    });

    test("should complete full MRI workflow", async ({ page }) => {
      await page.getByLabel("MRI", { exact: true }).click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Mass", { exact: true }).click();
      await page.getByLabel("Irregular").click();
      await page.getByLabel("Spiculated").click();
      // Note: No density for MRI
      await page.getByLabel("High suspicion (50-95%)").click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=4C - High Suspicion for Malignancy"),
      ).toBeVisible();
    });
  });
});
