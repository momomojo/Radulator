import { test, expect } from "@playwright/test";
import { navigateToCalculator } from "../../../helpers/calculator-test-helper.js";

/**
 * E2E Tests for PI-RADS v2.1 Calculator
 * Prostate Imaging Reporting and Data System
 *
 * PI-RADS v2.1 scoring principles:
 * - Peripheral Zone (PZ): DWI is the dominant sequence
 * - Transition Zone (TZ): T2W is the dominant sequence
 * - DCE can upgrade PZ lesions from PI-RADS 3 to 4
 * - DWI can upgrade TZ lesions if score exceeds T2W
 *
 * Categories:
 * - PI-RADS 1: Very low (clinically significant cancer highly unlikely)
 * - PI-RADS 2: Low (clinically significant cancer unlikely)
 * - PI-RADS 3: Intermediate (equivocal)
 * - PI-RADS 4: High (clinically significant cancer likely)
 * - PI-RADS 5: Very High (clinically significant cancer highly likely)
 */

test.describe("PI-RADS v2.1 Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, "PI-RADS v2.1");
  });

  test.describe("Visual and UI Tests", () => {
    test("should display calculator with correct title and description", async ({
      page,
    }) => {
      await expect(page.locator("h2")).toContainText("PI-RADS v2.1");
      await expect(
        page.locator("text=Prostate MRI risk stratification"),
      ).toBeVisible();
    });

    test("should have all required input fields", async ({ page }) => {
      await expect(
        page.locator('label:has-text("Anatomic Zone")'),
      ).toBeVisible();
      await expect(page.locator('label:has-text("Lesion Size")')).toBeVisible();
      await expect(page.locator('label:has-text("T2-Weighted")')).toBeVisible();
      await expect(
        page.locator('label:has-text("DWI/ADC Score")'),
      ).toBeVisible();
      await expect(
        page.locator('label:has-text("Dynamic Contrast Enhanced")'),
      ).toBeVisible();
    });

    test("should display info section with PI-RADS explanation", async ({
      page,
    }) => {
      await expect(
        page.getByText("Peripheral Zone (PZ)").first(),
      ).toBeVisible();
      await expect(
        page.getByText("DWI is the dominant sequence").first(),
      ).toBeVisible();
    });
  });

  test.describe("Peripheral Zone (PZ) Scoring - DWI Dominant", () => {
    test("should calculate PI-RADS 1 for normal PZ findings", async ({
      page,
    }) => {
      await page.getByText("Peripheral Zone (PZ)", { exact: true }).click();
      await page
        .locator('label:has-text("1 - Normal (no abnormality")')
        .click(); // DWI
      await page
        .locator('label:has-text("1 - Normal (uniform hyperintense")')
        .click(); // T2W
      await page.locator('label:has-text("Negative - No early")').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.getByText("PI-RADS Category: 1").first()).toBeVisible();
      await expect(page.getByText("Very Low").first()).toBeVisible();
    });

    test("should calculate PI-RADS 2 for low-risk PZ findings", async ({
      page,
    }) => {
      await page.getByText("Peripheral Zone (PZ)", { exact: true }).click();
      await page
        .locator('label:has-text("2 - Linear/wedge-shaped hypointensity")')
        .click(); // DWI
      await page
        .locator('label:has-text("2 - Linear/wedge-shaped or indistinct")')
        .click(); // T2W
      await page.locator('label:has-text("Negative - No early")').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.getByText("PI-RADS Category: 2").first()).toBeVisible();
      await expect(
        page.getByText("Dominant Sequence: DWI").first(),
      ).toBeVisible();
    });

    test("should calculate PI-RADS 3 for equivocal PZ findings", async ({
      page,
    }) => {
      await page.getByText("Peripheral Zone (PZ)", { exact: true }).click();
      await page.locator('label:has-text("3 - Focal, mild-moderate")').click(); // DWI = 3
      await page
        .locator('label:has-text("3 - Heterogeneous or non-circumscribed")')
        .click(); // T2W = 3
      await page.locator('label:has-text("Negative - No early")').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.getByText("PI-RADS Category: 3").first()).toBeVisible();
      await expect(page.getByText("Equivocal").first()).toBeVisible();
    });

    test("should upgrade PZ from PI-RADS 3 to 4 with positive DCE", async ({
      page,
    }) => {
      await page.getByText("Peripheral Zone (PZ)", { exact: true }).click();
      await page.locator('label:has-text("3 - Focal, mild-moderate")').click(); // DWI = 3
      await page
        .locator('label:has-text("3 - Heterogeneous or non-circumscribed")')
        .click(); // T2W = 3
      await page.locator('label:has-text("Positive - Focal early")').click(); // DCE positive - upgrades 3 to 4

      await page.click('button:has-text("Calculate")');

      await expect(page.getByText("4 - High").first()).toBeVisible();
      await expect(
        page.getByText("upgraded to PI-RADS 4 due to positive DCE").first(),
      ).toBeVisible();
    });

    test("should calculate PI-RADS 4 for high-risk PZ findings", async ({
      page,
    }) => {
      await page.getByText("Peripheral Zone (PZ)", { exact: true }).click();
      await page
        .locator('label:has-text("4 - Focal, markedly hypointense")')
        .click(); // DWI = 4
      await page
        .locator('label:has-text("3 - Heterogeneous or non-circumscribed")')
        .click(); // T2W = 3
      await page.locator('label:has-text("Negative - No early")').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.getByText("4 - High").first()).toBeVisible();
      await expect(
        page.getByText("Clinically significant cancer likely").first(),
      ).toBeVisible();
    });

    test("should calculate PI-RADS 5 for very high-risk PZ findings", async ({
      page,
    }) => {
      await page.getByText("Peripheral Zone (PZ)", { exact: true }).click();
      // Select T2W first (unique label)
      await page
        .locator('label:has-text("4 - Circumscribed, homogeneous")')
        .click(); // T2W = 4
      // Select DWI 5 using nth(1) - second instance is in DWI section
      await page
        .locator('label:has-text("5 - Same as 4 but ≥1.5 cm")')
        .nth(1)
        .click(); // DWI = 5
      await page.locator('label:has-text("Positive - Focal early")').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.getByText("5 - Very High").first()).toBeVisible();
      await expect(page.getByText("highly likely").first()).toBeVisible();
    });
  });

  test.describe("Transition Zone (TZ) Scoring - T2W Dominant", () => {
    test("should use T2W as dominant sequence for TZ", async ({ page }) => {
      await page.getByText("Transition Zone (TZ)", { exact: true }).click();
      await page.locator('label:has-text("3 - Focal, mild-moderate")').click(); // DWI = 3
      await page
        .locator('label:has-text("3 - Heterogeneous or non-circumscribed")')
        .click(); // T2W = 3
      await page.locator('label:has-text("Negative - No early")').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.getByText("Dominant Sequence: T2W").first(),
      ).toBeVisible();
    });

    test("should calculate PI-RADS 2 for TZ with low T2W score", async ({
      page,
    }) => {
      await page.getByText("Transition Zone (TZ)", { exact: true }).click();
      await page
        .locator('label:has-text("2 - Linear/wedge-shaped hypointensity")')
        .click(); // DWI = 2
      await page
        .locator('label:has-text("2 - Linear/wedge-shaped or indistinct")')
        .click(); // T2W = 2
      await page.locator('label:has-text("Negative - No early")').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.getByText("PI-RADS Category: 2").first()).toBeVisible();
    });

    test("should allow DWI to upgrade TZ score if higher than T2W", async ({
      page,
    }) => {
      await page.getByText("Transition Zone (TZ)", { exact: true }).click();
      // Select T2W 3 first (unique label)
      await page
        .locator('label:has-text("3 - Heterogeneous or non-circumscribed")')
        .click(); // T2W = 3
      // Select DWI 5 using nth(1) - second instance is in DWI section
      await page
        .locator('label:has-text("5 - Same as 4 but ≥1.5 cm")')
        .nth(1)
        .click(); // DWI = 5
      await page.locator('label:has-text("Negative - No early")').click();

      await page.click('button:has-text("Calculate")');

      // DWI 5 upgrades T2W 3 in TZ to PI-RADS 4
      await expect(page.getByText("4 - High").first()).toBeVisible();
      await expect(
        page.getByText("upgraded to PI-RADS 4 due to DWI").first(),
      ).toBeVisible();
    });
  });

  test.describe("EPE/SVI Staging", () => {
    test("should show EPE staging options", async ({ page }) => {
      await expect(
        page.getByText("Extraprostatic Extension (EPE)"),
      ).toBeVisible();
    });

    test("should upgrade to PI-RADS 5 with definite EPE", async ({ page }) => {
      await page.getByText("Peripheral Zone (PZ)", { exact: true }).click();
      await page
        .locator('label:has-text("4 - Focal, markedly hypointense")')
        .click(); // DWI = 4
      await page
        .locator('label:has-text("4 - Circumscribed, homogeneous")')
        .click(); // T2W = 4
      await page.locator('label:has-text("Positive - Focal early")').click();
      await page.locator('input[type="number"]').first().fill("1.2");

      // Select definite EPE
      await page.getByText("Definite EPE", { exact: true }).click();

      await page.click('button:has-text("Calculate")');

      await expect(page.getByText("PI-RADS Category: 5").first()).toBeVisible();
    });
  });

  test.describe("Lesion Size Assessment", () => {
    test("should display size categorization", async ({ page }) => {
      await page.getByText("Peripheral Zone (PZ)", { exact: true }).click();
      await page
        .locator('label:has-text("4 - Focal, markedly hypointense")')
        .click();
      await page
        .locator('label:has-text("4 - Circumscribed, homogeneous")')
        .click();
      await page.locator('label:has-text("Positive - Focal early")').click();
      await page.locator('input[type="number"]').first().fill("1.8");

      await page.click('button:has-text("Calculate")');

      await expect(page.getByText("1.5 cm").first()).toBeVisible();
    });
  });

  test.describe("DCE Assessment", () => {
    test("should not upgrade PI-RADS 4 with positive DCE", async ({ page }) => {
      // DCE only upgrades PI-RADS 3, not 4 or 5
      await page.getByText("Peripheral Zone (PZ)", { exact: true }).click();
      await page
        .locator('label:has-text("4 - Focal, markedly hypointense")')
        .click(); // DWI = 4
      await page
        .locator('label:has-text("4 - Circumscribed, homogeneous")')
        .click(); // T2W = 4
      await page.locator('label:has-text("Positive - Focal early")').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.getByText("PI-RADS Category: 4").first()).toBeVisible();
    });

    test("should handle DCE not performed", async ({ page }) => {
      await page.getByText("Peripheral Zone (PZ)", { exact: true }).click();
      await page.locator('label:has-text("3 - Focal, mild-moderate")').click();
      await page
        .locator('label:has-text("3 - Heterogeneous or non-circumscribed")')
        .click();
      await page.locator('label:has-text("Not performed")').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.getByText("PI-RADS Category: 3").first()).toBeVisible();
    });
  });

  test.describe("Input Validation", () => {
    test("should show error when zone not selected", async ({ page }) => {
      await page.click('button:has-text("Calculate")');

      await expect(page.getByText("Please select").first()).toBeVisible();
    });

    test("should show error when DWI score not selected", async ({ page }) => {
      await page.getByText("Peripheral Zone (PZ)", { exact: true }).click();
      await page.click('button:has-text("Calculate")');

      await expect(page.getByText("Please select").first()).toBeVisible();
    });
  });

  test.describe("Clinical Recommendations", () => {
    test("should recommend against biopsy for PI-RADS 1-2", async ({
      page,
    }) => {
      await page.getByText("Peripheral Zone (PZ)", { exact: true }).click();
      await page
        .locator('label:has-text("2 - Linear/wedge-shaped hypointensity")')
        .click();
      await page
        .locator('label:has-text("2 - Linear/wedge-shaped or indistinct")')
        .click();
      await page.locator('label:has-text("Negative - No early")').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.getByText("Biopsy generally not recommended").first(),
      ).toBeVisible();
    });

    test("should indicate individualized decision for PI-RADS 3", async ({
      page,
    }) => {
      await page.getByText("Peripheral Zone (PZ)", { exact: true }).click();
      await page.locator('label:has-text("3 - Focal, mild-moderate")').click();
      await page
        .locator('label:has-text("3 - Heterogeneous or non-circumscribed")')
        .click();
      await page.locator('label:has-text("Negative - No early")').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.getByText("clinical factors").first()).toBeVisible();
    });

    test("should recommend biopsy for PI-RADS 4-5", async ({ page }) => {
      await page.getByText("Peripheral Zone (PZ)", { exact: true }).click();
      await page
        .locator('label:has-text("4 - Focal, markedly hypointense")')
        .click();
      await page
        .locator('label:has-text("3 - Heterogeneous or non-circumscribed")')
        .click();
      await page.locator('label:has-text("Positive - Focal early")').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.getByText("biopsy").first()).toBeVisible();
    });
  });

  test.describe("References", () => {
    test("should display PI-RADS references", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: "References" }),
      ).toBeVisible();
      await expect(page.getByText("Turkbey").first()).toBeVisible();
    });

    test("should have correct number of reference links", async ({ page }) => {
      // Expand collapsed references to show all 6
      const expandBtn = page.locator(
        '.references-section button:has-text("more reference")',
      );
      if (await expandBtn.isVisible()) {
        await expandBtn.click();
      }

      const refLinks = page.locator(
        'a[href^="https://doi.org"], a[href^="https://www.acr.org"]',
      );
      await expect(refLinks).toHaveCount(6);
    });

    test("should have valid DOI links for primary sources", async ({
      page,
    }) => {
      // PI-RADS v2.1 Update (Turkbey et al. 2019)
      const pirads21 = page.locator(
        'a[href="https://doi.org/10.1016/j.eururo.2019.02.033"]',
      );
      await expect(pirads21).toBeVisible();
      await expect(pirads21).toContainText("Eur Urol. 2019");

      // PI-RADS v2 (Weinreb et al. 2016)
      const pirads2 = page.locator(
        'a[href="https://doi.org/10.1016/j.eururo.2015.08.052"]',
      );
      await expect(pirads2).toBeVisible();
      await expect(pirads2).toContainText("Eur Urol. 2016");

      // PRECISION Trial (Kasivisvanathan et al. 2018)
      const precision = page.locator(
        'a[href="https://doi.org/10.1056/NEJMoa1801993"]',
      );
      await expect(precision).toBeVisible();
      await expect(precision).toContainText("N Engl J Med. 2018");
    });

    test("should have link to ACR PI-RADS official resources", async ({
      page,
    }) => {
      // Expand collapsed references to show all 6
      const expandBtn = page.locator(
        '.references-section button:has-text("more reference")',
      );
      if (await expandBtn.isVisible()) {
        await expandBtn.click();
      }

      const acrLink = page.locator(
        'a[href="https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/PI-RADS"]',
      );
      await expect(acrLink).toBeVisible();
      await expect(acrLink).toContainText("American College of Radiology");
    });
  });
});
