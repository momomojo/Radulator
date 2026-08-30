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
 * - Category 3: Probably benign - source-literal endpoint through 2%
 * - Category 4A: Low suspicion - >2% to <=10%
 * - Category 4B: Moderate suspicion - >10% to <=50%
 * - Category 4C: High suspicion - 50% to <95%
 * - Category 4: MRI suspicious assessment without A-C subdivisions
 * - Category 5: Highly suggestive - >=95%
 * - Category 6: Known biopsy-proven malignancy
 *
 * Sources: ACR BI-RADS Atlas 5th Edition quick reference plus public ACR
 * modality summary forms for category boundaries and management wording.
 */

const calculatorName = "BI-RADS Assessment Calculator (Legacy 2013)";

test.describe("Legacy 2013 BI-RADS Assessment Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, calculatorName);
  });

  test.describe("Visual and UI Tests", () => {
    test("should display calculator with correct title and description", async ({
      page,
    }) => {
      await expect(page.getByTestId('calculator-title').first()).toContainText(calculatorName);
      await expect(page.getByTestId("guideline-badge")).toHaveText(
        "Legacy ACR BI-RADS 5th Ed. (2013) with public 2025 assessment-summary constraints",
      );
      await expect(
        page.getByText("Breast Imaging Reporting and Data System").first(),
      ).toBeVisible();
      await expect(
        page.getByText("does not implement the 2025 sixth edition"),
      ).toBeVisible();
      await expect(
        page.getByText("The radiologist selects the assessment level", {
          exact: false,
        }),
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
      const results = page.getByRole("status", { name: "Calculator results" });
      await expect(results).toContainText("Recall for additional imaging");
      await expect(results).not.toContainText("Additional mammographic views");
    });

    test("should keep ultrasound Category 0 wording source-literal", async ({
      page,
    }) => {
      await page.getByLabel("Ultrasound").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("Yes - need additional imaging evaluation").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=0 - Incomplete")).toBeVisible();
      const results = page.getByRole("status", { name: "Calculator results" });
      await expect(results).toContainText("Recall for additional imaging");
      await expect(results).not.toContainText("Mammography if not performed");
    });

    test("should keep MRI Category 0 wording source-literal", async ({
      page,
    }) => {
      await page.getByLabel("MRI", { exact: true }).click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("Yes - need additional imaging evaluation").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=0 - Incomplete")).toBeVisible();
      const results = page.getByRole("status", { name: "Calculator results" });
      await expect(results).toContainText("Recall for additional imaging");
      await expect(results).not.toContainText("additional sequences");
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
      await page.getByLabel("Negative (Category 1)").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=1 - Negative")).toBeVisible();
      await expect(page.locator("text=Essentially 0%")).toBeVisible();
      await expect(
        page.locator("text=Routine mammography screening"),
      ).toBeVisible();
    });

    test("should calculate Category 1 for negative diagnostic ultrasound", async ({
      page,
    }) => {
      await page.getByLabel("Ultrasound").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Negative - no findings").click();
      await page.getByLabel("Negative (Category 1)").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=1 - Negative")).toBeVisible();
      const resultsSection = page.getByRole("status", {
        name: "Calculator results",
      });
      await expect(resultsSection).toContainText(
        "manage any persistent clinical concern separately",
      );
      await expect(resultsSection).toContainText(
        "No suspicious imaging finding identified on ultrasound",
      );
      await expect(resultsSection).not.toContainText("mammographic");
      await expect(resultsSection).not.toContainText("annual screening");
    });

    test("should not infer Category 1 from finding type alone", async ({ page }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Screening examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Negative - no findings").click();

      await expect(page.getByText("Radiologist-Assigned Assessment")).toBeVisible();
      await page.click('button:has-text("Calculate")');

      await expect(
        page.getByRole("status", { name: "Calculator results" }),
      ).toContainText("Please select the radiologist-assigned assessment");
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
      await page.getByLabel("Benign (Category 2)").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=2 - Benign")).toBeVisible();
      const resultsSection = page.getByRole("status", {
        name: "Calculator results",
      });
      await expect(resultsSection).toContainText("Routine mammography screening");
      await expect(page.locator("text=Essentially 0%")).toBeVisible();
      await expect(page.locator("text=Benign finding described")).toBeVisible();
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
      await page.getByLabel("Benign (Category 2)").click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=2 - Benign")).toBeVisible();
    });

    test("should not infer Category 2 from finding type alone", async ({ page }) => {
      await page.getByLabel("Ultrasound").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page
        .getByLabel(
          "Benign finding (cyst, calcified fibroadenoma, fat-containing lesion, implant)",
        )
        .click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.getByRole("status", { name: "Calculator results" }),
      ).toContainText("Please select the radiologist-assigned assessment");
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
        .getByLabel("Probably benign (Category 3)")
        .click();

      await page.click('button:has-text("Calculate")');

      // Check results in the results section (aria-live="polite")
      const resultsSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(
        resultsSection.locator("text=3 - Probably Benign"),
      ).toBeVisible();
      await expect(
        resultsSection.locator("text=Malignancy Likelihood:"),
      ).toBeVisible();
      await expect(
        resultsSection.locator(
          "text=Short-interval (6-month) follow-up or continued surveillance mammography",
        ),
      ).toBeVisible();
      await expect(resultsSection).toContainText(">0% to ≤2%");
    });

    test("should show source-literal Category 3 follow-up management", async ({
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
        .getByLabel("Probably benign (Category 3)")
        .click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "text=Short-interval (6-month) follow-up or continued surveillance mammography",
        ),
      ).toBeVisible();
    });

    test("should not auto-assign Category 2 from calcification morphology", async ({
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

      const resultsSection = page.getByRole("status", {
        name: "Calculator results",
      });
      await expect(resultsSection).toContainText(
        "Please select the radiologist-assigned assessment",
      );
      await expect(
        page.getByRole("radiogroup", {
          name: "Radiologist-Assigned Assessment",
        }),
      ).toBeVisible();
    });

    test("should not infer discordance from descriptors selected with Category 3", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Mass", { exact: true }).click();
      await page.getByLabel("Irregular").click();
      await page.getByLabel("Spiculated").click();
      await page.getByLabel("High density").click();
      await page
        .getByLabel("Probably benign (Category 3)")
        .click();

      await page.click('button:has-text("Calculate")');

      const resultsSection = page.getByRole("status", {
        name: "Calculator results",
      });
      await expect(resultsSection).toContainText("3 - Probably Benign");
      await expect(resultsSection).not.toContainText("Decision Check");
      await expect(resultsSection).not.toContainText("discordant");
    });

    test("should ignore hidden calcification descriptors after switching to a mass", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Calcifications (without mass)").click();
      await page.getByLabel("Fine linear or fine-linear branching").click();
      await page.getByLabel("Linear", { exact: true }).click();

      await page.getByLabel("Mass", { exact: true }).click();
      await page.getByLabel("Oval").click();
      await page.getByLabel("Circumscribed").click();
      await page.getByLabel("Equal density").click();
      await page.getByLabel("Probably benign (Category 3)").click();
      await page.click('button:has-text("Calculate")');

      const resultsSection = page.getByRole("status", {
        name: "Calculator results",
      });
      await expect(resultsSection).toContainText("3 - Probably Benign");
      await expect(resultsSection).toContainText("Mass: oval, circumscribed");
      await expect(resultsSection).not.toContainText("Decision Check");
      await expect(resultsSection).not.toContainText("fine_linear");
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
      await page.getByLabel("Low suspicion (Category 4A; >2% to ≤10%)").click();

      await page.click('button:has-text("Calculate")');

      // Check results in the results section (aria-live="polite")
      const resultsSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(
        resultsSection.locator("text=4A - Low Suspicion for Malignancy"),
      ).toBeVisible();
      await expect(
        resultsSection.locator("text=Malignancy Likelihood:"),
      ).toBeVisible();
      await expect(
        resultsSection.locator("text=Tissue diagnosis"),
      ).toBeVisible();
      await expect(resultsSection).toContainText(">2% to ≤10%");
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
      await page.getByLabel("Low suspicion (Category 4A; >2% to ≤10%)").click();

      await page.click('button:has-text("Calculate")');

      // Check results in the results section (aria-live="polite")
      const resultsSection = page.getByRole('status', { name: 'Calculator results' });
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
      await page.getByLabel("Moderate suspicion (Category 4B; >10% to ≤50%)").click();

      await page.click('button:has-text("Calculate")');

      // Check results in the results section (aria-live="polite")
      const resultsSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(
        resultsSection.locator("text=4B - Moderate Suspicion for Malignancy"),
      ).toBeVisible();
      await expect(
        resultsSection.locator("text=Malignancy Likelihood:"),
      ).toBeVisible();
      await expect(
        resultsSection.locator("text=Tissue diagnosis"),
      ).toBeVisible();
      await expect(resultsSection).toContainText(">10% to ≤50%");
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
      await page.getByLabel("Moderate suspicion (Category 4B; >10% to ≤50%)").click();

      await page.click('button:has-text("Calculate")');

      // Check results in the results section (aria-live="polite")
      const resultsSection = page.getByRole('status', { name: 'Calculator results' });
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
      await page.getByLabel("High suspicion (Category 4C; 50% to <95%)").click();

      await page.click('button:has-text("Calculate")');

      // Check results in the results section (aria-live="polite")
      const resultsSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(
        resultsSection.locator("text=4C - High Suspicion for Malignancy"),
      ).toBeVisible();
      await expect(
        resultsSection.locator("text=Malignancy Likelihood:"),
      ).toBeVisible();
      await expect(resultsSection).toContainText("50% to <95%");
      await expect(resultsSection).toContainText("source-literal overlap at exactly 50%");
    });

    test("should preserve spiculated margins in the finding summary", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Mass", { exact: true }).click();
      await page.getByLabel("Irregular").click();
      await page.getByLabel("Spiculated").click();
      await page.getByLabel("High density").click();
      await page.getByLabel("High suspicion (Category 4C; 50% to <95%)").click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Mass: irregular, spiculated"),
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
      await page.getByLabel("High suspicion (Category 4C; 50% to <95%)").click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=4C - High Suspicion for Malignancy"),
      ).toBeVisible();
      await expect(
        page.locator("text=Calcifications: fine_pleomorphic, segmental distribution"),
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
      await page.getByLabel("Highly suggestive (Category 5; ≥95%)").click();

      await page.click('button:has-text("Calculate")');

      // Check results in the results section (aria-live="polite")
      const resultsSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(
        resultsSection.locator("text=5 - Highly Suggestive of Malignancy"),
      ).toBeVisible();
      await expect(
        resultsSection.locator("text=Malignancy Likelihood:"),
      ).toBeVisible();
      await expect(
        resultsSection.locator("text=Tissue diagnosis"),
      ).toBeVisible();
      await expect(resultsSection).toContainText("≥95%");
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
      await page.getByLabel("Highly suggestive (Category 5; ≥95%)").click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=5 - Highly Suggestive of Malignancy"),
      ).toBeVisible();
      await expect(
        page.locator("text=Calcifications: fine_linear, linear distribution"),
      ).toBeVisible();
    });

    test("should calculate Category 5 for architectural distortion", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Architectural distortion").click();
      await page.getByLabel("Highly suggestive (Category 5; ≥95%)").click();

      await page.click('button:has-text("Calculate")');

      // Check results in the results section (aria-live="polite")
      const resultsSection = page.getByRole('status', { name: 'Calculator results' });
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
        page.locator("text=Clinical follow-up with surgeon and/or oncologist"),
      ).toBeVisible();
      await expect(
        page
          .getByRole("status", { name: "Calculator results" })
          .getByText(
            /definitive local therapy \(usually surgery\) when clinically appropriate/,
          ),
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
      await page.getByLabel("Low suspicion (Category 4A; >2% to ≤10%)").click();

      await page.click('button:has-text("Calculate")');

      // Check results in the results section (aria-live="polite")
      const resultsSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(
        resultsSection.locator("text=4A - Low Suspicion"),
      ).toBeVisible();
      await expect(
        resultsSection.locator("text=Asymmetry: focal"),
      ).toBeVisible();
    });

    test("should preserve developing asymmetry in the structured finding summary", async ({ page }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Asymmetry", { exact: true }).click();
      await page.getByLabel("Developing asymmetry (new or increased)").click();
      await page.getByLabel("Moderate suspicion (Category 4B; >10% to ≤50%)").click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Asymmetry: developing"),
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
        .getByLabel("Associated features only")
        .click();
      await page.getByLabel("Moderate suspicion (Category 4B; >10% to ≤50%)").click();

      await page.click('button:has-text("Calculate")');

      // Check results in the results section (aria-live="polite")
      const resultsSection = page.getByRole('status', { name: 'Calculator results' });
      await expect(
        resultsSection.locator("text=4B - Moderate Suspicion"),
      ).toBeVisible();
      await expect(
        resultsSection.locator(
          "text=Associated features (skin/nipple changes)",
        ),
      ).toBeVisible();
    });

    test("should keep ultrasound associated-feature wording source-exact", async ({
      page,
    }) => {
      await page.getByLabel("Ultrasound").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Associated features only").click();
      await page.getByLabel("Suspicious (Category 4; >2% to <95%)").click();
      await page.click('button:has-text("Calculate")');

      const results = page.getByRole("status", { name: "Calculator results" });
      await expect(results).toContainText("Associated features (skin changes)");
      await expect(results).not.toContainText("nipple retraction");
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

    test("should expose supported ultrasound findings and unsplit Category 4", async ({
      page,
    }) => {
      await page.getByLabel("Ultrasound").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();

      await expect(
        page.getByLabel("Calcifications (without mass)"),
      ).toBeVisible();
      await expect(
        page.getByLabel("Architectural distortion"),
      ).toBeVisible();
      await expect(page.getByLabel("Asymmetry", { exact: true })).not.toBeVisible();

      await page.getByLabel("Mass", { exact: true }).click();
      await expect(page.getByLabel("Obscured", { exact: true })).not.toBeVisible();
      await expect(page.getByLabel("Angular", { exact: true })).toBeVisible();
      await expect(
        page.getByLabel("Low suspicion (Category 4A; >2% to ≤10%)"),
      ).not.toBeVisible();
      await expect(
        page.getByLabel("Moderate suspicion (Category 4B; >10% to ≤50%)"),
      ).not.toBeVisible();
      await expect(
        page.getByLabel("High suspicion (Category 4C; 50% to <95%)"),
      ).not.toBeVisible();
      await expect(
        page.getByLabel("Suspicious (Category 4; >2% to <95%)"),
      ).toBeVisible();
    });

    test("should expose unsplit Category 4 and MRI-specific margins for MRI", async ({
      page,
    }) => {
      await page.getByLabel("MRI", { exact: true }).click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Mass", { exact: true }).click();

      await expect(page.getByLabel("Obscured", { exact: true })).not.toBeVisible();
      await expect(page.getByLabel("Microlobulated", { exact: true })).not.toBeVisible();
      await expect(page.getByLabel("Indistinct", { exact: true })).not.toBeVisible();
      await expect(page.getByLabel("Irregular margin", { exact: true })).toBeVisible();
      await expect(
        page.getByLabel("Low suspicion (Category 4A; >2% to ≤10%)"),
      ).not.toBeVisible();
      await expect(
        page.getByLabel("Suspicious (Category 4; >2% to <95%)"),
      ).toBeVisible();
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

    test("should ignore a hidden distribution after switching to typically benign morphology", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Calcifications (without mass)").click();
      await page.getByLabel("Amorphous").click();
      await page.getByLabel("Segmental").click();
      await page
        .getByLabel(
          "Typically benign (skin, vascular, coarse, large rod-like, round, rim, dystrophic, milk of calcium, suture)",
        )
        .click();
      await page.getByLabel("Probably benign (Category 3)").click();
      await page.click('button:has-text("Calculate")');

      const results = page.getByRole("status", { name: "Calculator results" });
      await expect(results).toContainText("Calcifications: typically_benign");
      await expect(results).not.toContainText("segmental distribution");
    });
  });

  test.describe("Input Validation", () => {
    test("should require an imaging modality before any assessment", async ({
      page,
    }) => {
      await page.getByLabel("Known biopsy-proven malignancy").click();
      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=Please select imaging modality")).toBeVisible();
    });

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
        page.locator("text=Please select the radiologist-assigned assessment"),
      ).toBeVisible();
    });
  });

  test.describe("Finding Descriptions", () => {
    test("should ignore stale mammography density after switching to ultrasound", async ({
      page,
    }) => {
      await page.getByLabel("Mammography").click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Mass", { exact: true }).click();
      await page.getByLabel("Oval").click();
      await page.getByLabel("Circumscribed").click();
      await page.getByLabel("High density").click();
      await page.getByLabel("Ultrasound").click();
      await page.getByLabel("Probably benign (Category 3)").click();
      await page.click('button:has-text("Calculate")');

      const results = page.getByRole("status", { name: "Calculator results" });
      await expect(results).toContainText("Mass: oval, circumscribed");
      await expect(results).not.toContainText("high density");
    });

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
      await page.getByLabel("High suspicion (Category 4C; 50% to <95%)").click();

      await page.click('button:has-text("Calculate")');

      // Check results in the results section (aria-live="polite")
      const resultsSection = page.getByRole('status', { name: 'Calculator results' });
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
      await page.getByLabel("High suspicion (Category 4C; 50% to <95%)").click();

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
      await expect(
        page.getByText("ACR BI-RADS Atlas Fifth Edition Quick Reference"),
      ).toBeVisible();
    });

    test("should have valid reference links", async ({ page }) => {
      // ACR BI-RADS Atlas link
      const acrLink = page.locator(
        'a[href="https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/BI-RADS"]',
      );
      await expect(acrLink).toBeVisible();

      // Official ACR fifth-edition quick-reference artifact
      const quickReferenceLink = page.locator(
        'a[href="https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/BI-RADS/BIRADS-Poster.pdf"]',
      );
      await expect(quickReferenceLink).toBeVisible();
    });

    test("should expose the official modality assessment summaries", async ({ page }) => {
      await page
        .getByRole("button", { name: /Show \d+ more references/ })
        .click();
      await expect(
        page.getByRole("link", { name: /BI-RADS v2025 Mammography Summary/ }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /BI-RADS v2025 Ultrasound Summary/ }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /BI-RADS v2025 MRI Summary/ }),
      ).toBeVisible();
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
        .getByLabel("Probably benign (Category 3)")
        .click();

      await page.click('button:has-text("Calculate")');

      const resultsSection = page.getByRole("status", {
        name: "Calculator results",
      });
      await expect(resultsSection).toContainText("3 - Probably Benign");
      await expect(resultsSection).not.toContainText("screening mammography");
      await expect(resultsSection).not.toContainText("diagnostic workup");
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
        .getByLabel("Probably benign (Category 3)")
        .click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=3 - Probably Benign")).toBeVisible();
    });

    test("should complete full MRI workflow", async ({ page }) => {
      await page.getByLabel("MRI", { exact: true }).click();
      await page.getByLabel("Diagnostic examination").click();
      await page.getByLabel("No - assessment complete").click();
      await page.getByLabel("Mass", { exact: true }).click();
      await page.getByLabel("Irregular", { exact: true }).click();
      await page.getByLabel("Spiculated").click();
      // Note: No density for MRI
      await expect(
        page.getByLabel("High suspicion (Category 4C; 50% to <95%)"),
      ).not.toBeVisible();
      await page
        .getByLabel("Suspicious (Category 4; >2% to <95%)")
        .click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=4 - Suspicious"),
      ).toBeVisible();
    });
  });
});
