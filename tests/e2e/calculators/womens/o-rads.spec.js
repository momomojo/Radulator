import { test, expect } from "@playwright/test";
import { navigateToCalculator } from "../../../helpers/calculator-test-helper.js";

/**
 * E2E Tests for ACR O-RADS Calculator
 * Ovarian-Adnexal Reporting and Data System for US and MRI
 *
 * O-RADS US Categories:
 * - 0: Incomplete evaluation
 * - 1: Normal premenopausal ovary (0% malignancy)
 * - 2: Almost certainly benign (<1% malignancy)
 * - 3: Low risk (1-10% malignancy)
 * - 4: Intermediate risk (10-50% malignancy)
 * - 5: High risk (>=50% malignancy)
 *
 * O-RADS MRI Categories:
 * - 0: Incomplete examination
 * - 1: Normal ovaries (0% PPV)
 * - 2: Almost certainly benign (<0.5% PPV)
 * - 3: Low risk (~5% PPV)
 * - 4: Intermediate risk (~50% PPV)
 * - 5: High risk (~90% PPV)
 *
 * Sources:
 * - Andreotti RF, et al. Radiology. 2020 (O-RADS US)
 * - Thomassin-Naggara I, et al. Radiology. 2022 (O-RADS MRI)
 */

test.describe("ACR O-RADS Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, "ACR O-RADS");
  });

  test.describe("Visual and UI Tests", () => {
    test("should display calculator with correct title and description", async ({
      page,
    }) => {
      await expect(page.locator("h2")).toContainText("ACR O-RADS");
      await expect(
        page.getByText("Ovarian-Adnexal Reporting and Data System").first(),
      ).toBeVisible();
    });

    test("should have modality selection for US and MRI", async ({ page }) => {
      await expect(page.getByText("Imaging Modality")).toBeVisible();
      await expect(page.locator('label[for="modality-us"]')).toBeVisible();
      await expect(page.locator('label[for="modality-mri"]')).toBeVisible();
    });

    test("should have study complete field", async ({ page }) => {
      await expect(page.getByText("Study Complete/Diagnostic")).toBeVisible();
    });

    test("should display info section with O-RADS explanation", async ({
      page,
    }) => {
      await expect(
        page.getByText("O-RADS (Ovarian-Adnexal Reporting and Data System)"),
      ).toBeVisible();
      await expect(
        page.getByText("ULTRASOUND (O-RADS US v2022)"),
      ).toBeVisible();
      await expect(page.getByText("MRI (O-RADS MRI):")).toBeVisible();
    });
  });

  test.describe("O-RADS US Category 0 - Incomplete", () => {
    test("should return Category 0 for incomplete US study", async ({
      page,
    }) => {
      await page.locator('label[for="modality-us"]').click();
      await page.locator('label[for="study_complete-no"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=O-RADS US 0 - Incomplete")).toBeVisible();
      await expect(
        page.locator("text=Additional imaging required"),
      ).toBeVisible();
    });
  });

  test.describe("O-RADS US Category 1 - Normal/Physiologic", () => {
    test("should return Category 1 for normal ovary", async ({ page }) => {
      await page.locator('label[for="modality-us"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="us_menopausal-premenopausal"]').click();
      await page.locator('label[for="us_finding-normal"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=O-RADS US 1 - Normal/Physiologic"),
      ).toBeVisible();
      await expect(page.getByText("Malignancy Risk: 0%")).toBeVisible();
      await expect(page.locator("text=No follow-up needed")).toBeVisible();
    });
  });

  test.describe("O-RADS US Category 2 - Almost Certainly Benign", () => {
    test("should return Category 2 for simple cyst <=10cm", async ({
      page,
    }) => {
      await page.locator('label[for="modality-us"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="us_menopausal-premenopausal"]').click();
      await page.locator('label[for="us_finding-simple_cyst"]').click();
      await page.fill('input[id="us_size"]', "5");
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=O-RADS US 2 - Almost Certainly Benign"),
      ).toBeVisible();
      await expect(page.getByText("Malignancy Risk: <1%")).toBeVisible();
    });

    test("should return Category 2 for classic benign lesion <10cm", async ({
      page,
    }) => {
      await page.locator('label[for="modality-us"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="us_menopausal-premenopausal"]').click();
      await page.locator('label[for="us_finding-classic_benign"]').click();
      await page.fill('input[id="us_size"]', "4");
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=O-RADS US 2 - Almost Certainly Benign"),
      ).toBeVisible();
      await expect(page.getByText("Malignancy Risk: <1%")).toBeVisible();
    });

    test("should return Category 2 for unilocular cyst with smooth wall", async ({
      page,
    }) => {
      await page.locator('label[for="modality-us"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="us_menopausal-premenopausal"]').click();
      await page.locator('label[for="us_finding-unilocular"]').click();
      await page.fill('input[id="us_size"]', "3");
      await page.locator('label[for="us_inner_wall-smooth"]').click();
      await page.locator('label[for="us_solid_component-none"]').click();
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=O-RADS US 2 - Almost Certainly Benign"),
      ).toBeVisible();
    });
  });

  test.describe("O-RADS US Category 3 - Low Risk", () => {
    test("should return Category 3 for large simple cyst >10cm", async ({
      page,
    }) => {
      await page.locator('label[for="modality-us"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="us_menopausal-premenopausal"]').click();
      await page.locator('label[for="us_finding-simple_cyst"]').click();
      await page.fill('input[id="us_size"]', "12");
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=O-RADS US 3 - Low Risk")).toBeVisible();
      await expect(page.getByText("Malignancy Risk: 1-10%")).toBeVisible();
      await expect(page.locator("text=Gynecologist evaluation")).toBeVisible();
    });

    test("should return Category 3 for classic benign >=10cm", async ({
      page,
    }) => {
      await page.locator('label[for="modality-us"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="us_menopausal-premenopausal"]').click();
      await page.locator('label[for="us_finding-classic_benign"]').click();
      await page.fill('input[id="us_size"]', "11");
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=O-RADS US 3 - Low Risk")).toBeVisible();
      await expect(page.getByText("Malignancy Risk: 1-10%")).toBeVisible();
    });

    test("should return Category 3 for unilocular cyst with irregular wall", async ({
      page,
    }) => {
      await page.locator('label[for="modality-us"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="us_menopausal-premenopausal"]').click();
      await page.locator('label[for="us_finding-unilocular"]').click();
      await page.fill('input[id="us_size"]', "4");
      await page.locator('label[for="us_inner_wall-irregular"]').click();
      await page.locator('label[for="us_solid_component-none"]').click();
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=O-RADS US 3 - Low Risk")).toBeVisible();
      await expect(page.getByText("Malignancy Risk: 1-10%")).toBeVisible();
    });

    test("should return Category 3 for multilocular cyst with smooth walls, small size, low CS", async ({
      page,
    }) => {
      await page.locator('label[for="modality-us"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="us_menopausal-premenopausal"]').click();
      await page.locator('label[for="us_finding-multilocular"]').click();
      await page.fill('input[id="us_size"]', "5");
      await page.locator('label[for="us_inner_wall-smooth"]').click();
      await page.locator('label[for="us_solid_component-none"]').click();
      await page.locator('label[for="us_color_score-2"]').click();
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=O-RADS US 3 - Low Risk")).toBeVisible();
      await expect(page.locator("text=6-month follow-up US")).toBeVisible();
    });

    test("should return Category 3 for solid smooth lesion with CS 1", async ({
      page,
    }) => {
      await page.locator('label[for="modality-us"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="us_menopausal-premenopausal"]').click();
      await page.locator('label[for="us_finding-solid"]').click();
      await page.fill('input[id="us_size"]', "3");
      await page.locator('label[for="us_solid_contour-smooth"]').click();
      await page.locator('label[for="us_color_score-1"]').click();
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=O-RADS US 3 - Low Risk")).toBeVisible();
      await expect(page.locator("text=may represent fibroma")).toBeVisible();
    });
  });

  test.describe("O-RADS US Category 4 - Intermediate Risk", () => {
    test("should return Category 4 for unilocular cyst with 1-3 papillary projections", async ({
      page,
    }) => {
      await page.locator('label[for="modality-us"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="us_menopausal-premenopausal"]').click();
      await page.locator('label[for="us_finding-unilocular"]').click();
      await page.fill('input[id="us_size"]', "5");
      await page.locator('label[for="us_inner_wall-smooth"]').click();
      await page
        .locator('label[for="us_solid_component-papillary_1_3"]')
        .click();
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=O-RADS US 4 - Intermediate Risk"),
      ).toBeVisible();
      await expect(page.getByText("Malignancy Risk: 10-50%")).toBeVisible();
      await expect(
        page.locator("text=gyn-oncology consultation"),
      ).toBeVisible();
    });

    test("should return Category 4 for multilocular with irregular wall", async ({
      page,
    }) => {
      await page.locator('label[for="modality-us"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="us_menopausal-premenopausal"]').click();
      await page.locator('label[for="us_finding-multilocular"]').click();
      await page.fill('input[id="us_size"]', "5");
      await page.locator('label[for="us_inner_wall-irregular"]').click();
      await page.locator('label[for="us_solid_component-none"]').click();
      await page.locator('label[for="us_color_score-2"]').click();
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=O-RADS US 4 - Intermediate Risk"),
      ).toBeVisible();
      await expect(page.getByText("Malignancy Risk: 10-50%")).toBeVisible();
    });

    test("should return Category 4 for multilocular with solid component and low CS", async ({
      page,
    }) => {
      await page.locator('label[for="modality-us"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="us_menopausal-premenopausal"]').click();
      await page.locator('label[for="us_finding-multilocular"]').click();
      await page.fill('input[id="us_size"]', "5");
      await page.locator('label[for="us_inner_wall-smooth"]').click();
      await page.locator('label[for="us_solid_component-solid"]').click();
      await page.locator('label[for="us_color_score-2"]').click();
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=O-RADS US 4 - Intermediate Risk"),
      ).toBeVisible();
    });

    test("should return Category 4 for solid smooth lesion with CS 2-3", async ({
      page,
    }) => {
      await page.locator('label[for="modality-us"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="us_menopausal-premenopausal"]').click();
      await page.locator('label[for="us_finding-solid"]').click();
      await page.fill('input[id="us_size"]', "3");
      await page.locator('label[for="us_solid_contour-smooth"]').click();
      await page.locator('label[for="us_color_score-3"]').click();
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=O-RADS US 4 - Intermediate Risk"),
      ).toBeVisible();
      await expect(
        page.locator("text=MRI for further characterization"),
      ).toBeVisible();
    });
  });

  test.describe("O-RADS US Category 5 - High Risk", () => {
    test("should return Category 5 for unilocular with >=4 papillary projections", async ({
      page,
    }) => {
      await page.locator('label[for="modality-us"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="us_menopausal-premenopausal"]').click();
      await page.locator('label[for="us_finding-unilocular"]').click();
      await page.fill('input[id="us_size"]', "5");
      await page.locator('label[for="us_inner_wall-smooth"]').click();
      await page
        .locator('label[for="us_solid_component-papillary_4_plus"]')
        .click();
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=O-RADS US 5 - High Risk")).toBeVisible();
      await expect(page.getByText(/Malignancy Risk:.*50%/)).toBeVisible();
      await expect(
        page.locator("text=Gynecologic oncologist referral"),
      ).toBeVisible();
    });

    test("should return Category 5 for multilocular with solid component and high CS", async ({
      page,
    }) => {
      await page.locator('label[for="modality-us"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="us_menopausal-premenopausal"]').click();
      await page.locator('label[for="us_finding-multilocular"]').click();
      await page.fill('input[id="us_size"]', "5");
      await page.locator('label[for="us_inner_wall-smooth"]').click();
      await page.locator('label[for="us_solid_component-solid"]').click();
      await page.locator('label[for="us_color_score-3"]').click();
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=O-RADS US 5 - High Risk")).toBeVisible();
    });

    test("should return Category 5 for solid lesion with irregular contour", async ({
      page,
    }) => {
      await page.locator('label[for="modality-us"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="us_menopausal-premenopausal"]').click();
      await page.locator('label[for="us_finding-solid"]').click();
      await page.fill('input[id="us_size"]', "3");
      await page.locator('label[for="us_solid_contour-irregular"]').click();
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=O-RADS US 5 - High Risk")).toBeVisible();
      await expect(
        page.locator("text=Gynecologic oncologist referral"),
      ).toBeVisible();
    });

    test("should return Category 5 for solid smooth lesion with CS 4", async ({
      page,
    }) => {
      await page.locator('label[for="modality-us"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="us_menopausal-premenopausal"]').click();
      await page.locator('label[for="us_finding-solid"]').click();
      await page.fill('input[id="us_size"]', "3");
      await page.locator('label[for="us_solid_contour-smooth"]').click();
      await page.locator('label[for="us_color_score-4"]').click();
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=O-RADS US 5 - High Risk")).toBeVisible();
    });
  });

  test.describe("O-RADS MRI Category 0 - Incomplete", () => {
    test("should return Category 0 for incomplete MRI study", async ({
      page,
    }) => {
      await page.locator('label[for="modality-mri"]').click();
      await page.locator('label[for="study_complete-no"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=O-RADS MRI 0 - Incomplete"),
      ).toBeVisible();
      await expect(
        page.locator("text=Additional imaging required"),
      ).toBeVisible();
    });
  });

  test.describe("O-RADS MRI Category 1 - Normal", () => {
    test("should return Category 1 for normal ovaries on MRI", async ({
      page,
    }) => {
      await page.locator('label[for="modality-mri"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="mri_finding-normal"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=O-RADS MRI 1 - Normal")).toBeVisible();
      await expect(page.getByText("PPV: 0%")).toBeVisible();
      await expect(page.locator("text=No follow-up needed")).toBeVisible();
    });
  });

  test.describe("O-RADS MRI Category 2 - Almost Certainly Benign", () => {
    test("should return Category 2 for paraovarian cyst", async ({ page }) => {
      await page.locator('label[for="modality-mri"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="mri_finding-paraovarian"]').click();
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=O-RADS MRI 2 - Almost Certainly Benign"),
      ).toBeVisible();
      await expect(page.getByText("PPV: <0.5%")).toBeVisible();
    });

    test("should return Category 2 for unilocular simple cyst without wall enhancement", async ({
      page,
    }) => {
      await page.locator('label[for="modality-mri"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="mri_finding-unilocular_simple"]').click();
      await page.locator('label[for="mri_wall_enhancement-none"]').click();
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=O-RADS MRI 2 - Almost Certainly Benign"),
      ).toBeVisible();
      await expect(page.getByText("PPV: <0.5%")).toBeVisible();
    });

    test("should return Category 2 for unilocular non-simple without solid tissue", async ({
      page,
    }) => {
      await page.locator('label[for="modality-mri"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page
        .locator('label[for="mri_finding-unilocular_nonsimple"]')
        .click();
      await page.locator('label[for="mri_solid_tissue-none"]').click();
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=O-RADS MRI 2 - Almost Certainly Benign"),
      ).toBeVisible();
      await expect(
        page.locator("text=endometrioma/hemorrhagic cyst"),
      ).toBeVisible();
    });

    test("should return Category 2 for dermoid without significant solid tissue", async ({
      page,
    }) => {
      await page.locator('label[for="modality-mri"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="mri_finding-lipid"]').click();
      await page.locator('label[for="mri_lipid_solid-none"]').click();
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=O-RADS MRI 2 - Almost Certainly Benign"),
      ).toBeVisible();
      await expect(page.getByText("Lesion: Dermoid")).toBeVisible();
    });

    test("should return Category 2 for T2 dark/DWI dark solid (fibroma-type)", async ({
      page,
    }) => {
      await page.locator('label[for="modality-mri"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="mri_finding-dark_t2_dwi"]').click();
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=O-RADS MRI 2 - Almost Certainly Benign"),
      ).toBeVisible();
      await expect(page.getByText("consistent with fibroma")).toBeVisible();
    });
  });

  test.describe("O-RADS MRI Category 3 - Low Risk", () => {
    test("should return Category 3 for unilocular simple cyst with smooth wall enhancement", async ({
      page,
    }) => {
      await page.locator('label[for="modality-mri"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="mri_finding-unilocular_simple"]').click();
      await page.locator('label[for="mri_wall_enhancement-smooth"]').click();
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=O-RADS MRI 3 - Low Risk")).toBeVisible();
      await expect(page.getByText("PPV: ~5%")).toBeVisible();
      await expect(page.locator("text=Follow-up imaging")).toBeVisible();
    });

    test("should return Category 3 for multilocular cyst without solid tissue", async ({
      page,
    }) => {
      await page.locator('label[for="modality-mri"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="mri_finding-multilocular"]').click();
      await page.locator('label[for="mri_solid_tissue-none"]').click();
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=O-RADS MRI 3 - Low Risk")).toBeVisible();
      await expect(page.getByText("PPV: ~5%")).toBeVisible();
    });

    test("should return Category 3 for solid tissue with low-risk TIC", async ({
      page,
    }) => {
      await page.locator('label[for="modality-mri"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="mri_finding-solid_enhancing"]').click();
      await page.locator('label[for="mri_tic-low"]').click();
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=O-RADS MRI 3 - Low Risk")).toBeVisible();
      await expect(
        page.getByText("Lesion: Enhancing solid tissue, low-risk TIC"),
      ).toBeVisible();
    });
  });

  test.describe("O-RADS MRI Category 4 - Intermediate Risk", () => {
    test("should return Category 4 for dermoid with large enhancing solid tissue", async ({
      page,
    }) => {
      await page.locator('label[for="modality-mri"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="mri_finding-lipid"]').click();
      await page.locator('label[for="mri_lipid_solid-present"]').click();
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=O-RADS MRI 4 - Intermediate Risk"),
      ).toBeVisible();
      await expect(page.getByText("PPV: ~50%")).toBeVisible();
      await expect(page.locator("text=malignant transformation")).toBeVisible();
    });

    test("should return Category 4 for solid tissue with intermediate-risk TIC", async ({
      page,
    }) => {
      await page.locator('label[for="modality-mri"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="mri_finding-solid_enhancing"]').click();
      await page.locator('label[for="mri_tic-intermediate"]').click();
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=O-RADS MRI 4 - Intermediate Risk"),
      ).toBeVisible();
      await expect(page.getByText("PPV: ~50%")).toBeVisible();
    });

    test("should return Category 4 for multilocular with solid tissue and intermediate TIC", async ({
      page,
    }) => {
      await page.locator('label[for="modality-mri"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="mri_finding-multilocular"]').click();
      await page.locator('label[for="mri_solid_tissue-present"]').click();
      await page.locator('label[for="mri_tic-intermediate"]').click();
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=O-RADS MRI 4 - Intermediate Risk"),
      ).toBeVisible();
    });
  });

  test.describe("O-RADS MRI Category 5 - High Risk", () => {
    test("should return Category 5 for solid tissue with high-risk TIC", async ({
      page,
    }) => {
      await page.locator('label[for="modality-mri"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="mri_finding-solid_enhancing"]').click();
      await page.locator('label[for="mri_tic-high"]').click();
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=O-RADS MRI 5 - High Risk")).toBeVisible();
      await expect(page.getByText("PPV: ~90%")).toBeVisible();
      await expect(
        page.locator("text=Gynecologic oncologist referral"),
      ).toBeVisible();
    });

    test("should return Category 5 for multilocular with solid tissue and high-risk TIC", async ({
      page,
    }) => {
      await page.locator('label[for="modality-mri"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="mri_finding-multilocular"]').click();
      await page.locator('label[for="mri_solid_tissue-present"]').click();
      await page.locator('label[for="mri_tic-high"]').click();
      await page.locator('label[for="peritoneal-none"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=O-RADS MRI 5 - High Risk")).toBeVisible();
      await expect(page.getByText("PPV: ~90%")).toBeVisible();
    });
  });

  test.describe("Peritoneal Disease - Category 5", () => {
    test("should return US Category 5 when peritoneal disease present", async ({
      page,
    }) => {
      await page.locator('label[for="modality-us"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="us_menopausal-premenopausal"]').click();
      await page.locator('label[for="us_finding-simple_cyst"]').click();
      await page.fill('input[id="us_size"]', "5");
      await page.locator('label[for="peritoneal-present"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=O-RADS US 5 - High Risk")).toBeVisible();
      await expect(page.getByText(/Malignancy Risk:.*50%/)).toBeVisible();
      await expect(page.locator("text=Peritoneal disease")).toBeVisible();
    });

    test("should return MRI Category 5 when peritoneal disease present", async ({
      page,
    }) => {
      await page.locator('label[for="modality-mri"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="mri_finding-unilocular_simple"]').click();
      await page.locator('label[for="mri_wall_enhancement-none"]').click();
      await page.locator('label[for="peritoneal-present"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator("text=O-RADS MRI 5 - High Risk")).toBeVisible();
      await expect(page.getByText("Malignancy Risk: ~90%")).toBeVisible();
      await expect(page.locator("text=Peritoneal disease")).toBeVisible();
    });
  });

  test.describe("Input Validation", () => {
    test("should show error when modality not selected", async ({ page }) => {
      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Please select imaging modality"),
      ).toBeVisible();
    });

    test("should show error for US when primary finding not selected", async ({
      page,
    }) => {
      await page.locator('label[for="modality-us"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      await page.locator('label[for="us_menopausal-premenopausal"]').click();
      // Don't select primary finding

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Please select the primary US finding"),
      ).toBeVisible();
    });

    test("should show error for MRI when primary finding not selected", async ({
      page,
    }) => {
      await page.locator('label[for="modality-mri"]').click();
      await page.locator('label[for="study_complete-yes"]').click();
      // Don't select primary finding

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Please select the primary MRI finding"),
      ).toBeVisible();
    });
  });

  test.describe("References", () => {
    test("should display O-RADS references", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: "References" }),
      ).toBeVisible();
      await expect(page.getByText("Andreotti RF").first()).toBeVisible();
      await expect(page.getByText("Thomassin-Naggara").first()).toBeVisible();
    });

    test("should have correct number of reference links", async ({ page }) => {
      const refLinks = page.locator(
        'a[href^="https://pubmed.ncbi.nlm.nih.gov"], a[href^="https://www.acr.org"]',
      );
      await expect(refLinks).toHaveCount(5);
    });

    test("should have valid PubMed links for primary sources", async ({
      page,
    }) => {
      // O-RADS US 2020 paper
      const usLink = page.locator(
        'a[href="https://pubmed.ncbi.nlm.nih.gov/31687921/"]',
      );
      await expect(usLink).toBeVisible();
      await expect(usLink).toContainText("Radiology. 2020");

      // O-RADS MRI paper
      const mriLink = page.locator(
        'a[href="https://pubmed.ncbi.nlm.nih.gov/35040672/"]',
      );
      await expect(mriLink).toBeVisible();
      await expect(mriLink).toContainText("Radiology. 2022");
    });

    test("should have links to ACR O-RADS official resources", async ({
      page,
    }) => {
      const acrLink = page.locator(
        'a[href="https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/O-RADS/Ultrasound"]',
      );
      await expect(acrLink).toBeVisible();
      await expect(acrLink).toContainText("ACR");
    });
  });
});
