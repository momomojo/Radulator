/**
 * E2E Tests for Y-90 Radiation Segmentectomy Calculator
 * Dosimetry calculator for Y-90 radioembolization
 *
 * Test Coverage:
 * - MIRD model calculations (uniform dose distribution)
 * - Partition model calculations (tumor/normal compartments)
 * - Multi-compartment dose calculations
 * - Lung dose and lung shunt fraction validation
 * - Safety contraindications (lung shunt >20%, lung dose >30 Gy)
 * - Clinical warnings (low target dose, high normal dose)
 * - Vial size recommendations (glass microspheres)
 * - BSA calculations (optional patient parameters)
 * - Residual vial correction
 * - Treatment intent (segmentectomy vs lobectomy)
 * - Input validation and edge cases
 */

import { test, expect } from "@playwright/test";
import { navigateToCalculator } from "../../../helpers/calculator-test-helper.js";

test.describe("Y-90 Radioembolization Dosimetry Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, "Y-90 Radioembolization Dosimetry");
    await expect(page.locator("h2")).toContainText(
      "Y-90 Radioembolization Dosimetry",
    );
  });

  test.describe("Visual and UI Tests", () => {
    test("should display calculator with proper layout", async ({ page }) => {
      // Check header
      await expect(page.locator("h2")).toContainText(
        "Y-90 Radioembolization Dosimetry",
      );
      await expect(
        page.locator("text=Dosimetry calculator for Y-90 radioembolization"),
      ).toBeVisible();

      // Check info section
      await expect(
        page.locator("text=Y-90 Radiation Segmentectomy Dosimetry Calculator"),
      ).toBeVisible();
      await expect(
        page.locator("text=MIRD Model: Uniform dose distribution"),
      ).toBeVisible();
      await expect(
        page.locator(
          "text=Partition Model: Accounts for tumor-to-normal uptake ratio",
        ),
      ).toBeVisible();

      // Check all input fields are present
      await expect(
        page.locator('label:has-text("Treatment Intent")'),
      ).toBeVisible();
      await expect(
        page.locator('label:has-text("Dosimetry Model")'),
      ).toBeVisible();
      await expect(
        page.locator('label:has-text("Target Segment Volume")'),
      ).toBeVisible();
      await expect(
        page.locator('label:has-text("Tumor Volume")'),
      ).toBeVisible();
      await expect(page.locator('label:has-text("Target Dose")')).toBeVisible();
      await expect(
        page.locator('label:has-text("Lung Shunt Fraction")'),
      ).toBeVisible();
      await expect(
        page.locator('label:has-text("Tumor-to-Normal Ratio")'),
      ).toBeVisible();
      await expect(
        page.locator('label:has-text("Expected Vial Residual")'),
      ).toBeVisible();
      await expect(
        page.locator('label:has-text("Microsphere Type")'),
      ).toBeVisible();
      await expect(
        page.locator('label:has-text("Patient Weight")'),
      ).toBeVisible();
      await expect(
        page.locator('label:has-text("Patient Height")'),
      ).toBeVisible();

      // Check Calculate button
      await expect(page.locator('button:has-text("Calculate")')).toBeVisible();

      // Check References section
      await expect(page.locator("text=References")).toBeVisible();
    });

    test("should show subLabels with units and ranges", async ({ page }) => {
      await expect(page.locator("text=mL (10-2000)")).toBeVisible();
      await expect(page.locator("text=mL (for partition model)")).toBeVisible();
      await expect(page.locator("text=Gy (80-800)")).toBeVisible();
      await expect(page.locator("text=% (0-50)")).toBeVisible();
      await expect(
        page.locator("text=For partition model (1-50)"),
      ).toBeVisible();
      await expect(page.locator("text=% (default 1%)")).toBeVisible();
      await expect(page.locator("text=kg (for BSA calculation)")).toBeVisible();
      await expect(page.locator("text=cm (for BSA calculation)")).toBeVisible();
    });

    test("should have working radio buttons for treatment intent", async ({
      page,
    }) => {
      const segmentectomy = page.locator('input[value="segmentectomy"]');
      const lobectomy = page.locator('input[value="lobectomy"]');

      // Check segmentectomy
      await segmentectomy.click();
      await expect(segmentectomy).toBeChecked();
      await expect(lobectomy).not.toBeChecked();

      // Check lobectomy
      await lobectomy.click();
      await expect(lobectomy).toBeChecked();
      await expect(segmentectomy).not.toBeChecked();
    });

    test("should have working radio buttons for dosimetry model", async ({
      page,
    }) => {
      const mird = page.locator('input[value="mird"]');
      const partition = page.locator('input[value="partition"]');

      // Check MIRD
      await mird.click();
      await expect(mird).toBeChecked();
      await expect(partition).not.toBeChecked();

      // Check Partition
      await partition.click();
      await expect(partition).toBeChecked();
      await expect(mird).not.toBeChecked();
    });

    test("should have working radio buttons for microsphere type", async ({
      page,
    }) => {
      const glass = page.locator('input[value="glass"]');
      const resin = page.locator('input[value="resin"]');

      // Check glass
      await glass.click();
      await expect(glass).toBeChecked();
      await expect(resin).not.toBeChecked();

      // Check resin
      await resin.click();
      await expect(resin).toBeChecked();
      await expect(glass).not.toBeChecked();
    });
  });

  test.describe("MIRD Model Calculations", () => {
    test("should calculate MIRD model for standard segmentectomy", async ({
      page,
    }) => {
      // Standard radiation segmentectomy parameters
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.fill('input[id="segment_volume"]', "200");
      await page.fill('input[id="target_dose"]', "205");
      await page.fill('input[id="lung_shunt"]', "5");
      await page.fill('input[id="vial_residual"]', "1");
      await page.locator('input[value="glass"]').click();

      await page.click('button:has-text("Calculate")');

      // Check prescribed activity section
      await expect(
        page.locator("text=═══ PRESCRIBED ACTIVITY ═══"),
      ).toBeVisible();
      await expect(
        page.locator("text=/Activity to Order.*GBq.*mCi/"),
      ).toBeVisible();
      await expect(page.locator("text=Recommended Vial Size")).toBeVisible();
      await expect(
        page.locator("text=Vial Residual Correction: 1.0%"),
      ).toBeVisible();

      // Check dosimetry results
      await expect(
        page.locator("text=═══ DOSIMETRY RESULTS ═══"),
      ).toBeVisible();
      await expect(
        page.locator("text=Mean Segment Dose: 205.0 Gy"),
      ).toBeVisible();
      await expect(
        page.locator("text=Model Used: MIRD (uniform distribution)"),
      ).toBeVisible();
      await expect(page.locator("text=/Target Volume.*200 mL/")).toBeVisible();

      // Check safety parameters
      await expect(
        page.locator("text=═══ SAFETY PARAMETERS ═══"),
      ).toBeVisible();
      await expect(
        page.locator("text=Lung Shunt Fraction: 5.0%"),
      ).toBeVisible();
      await expect(
        page.locator("text=/Estimated Lung Dose.*Gy/"),
      ).toBeVisible();
      await expect(
        page.locator("text=Microsphere Type: Glass (TheraSphere)"),
      ).toBeVisible();
      await expect(
        page.locator("text=Treatment Intent: Segmentectomy"),
      ).toBeVisible();

      // Should have no contraindications
      await expect(
        page.locator("text=Safety Status: ✓ Within safety parameters"),
      ).toBeVisible();

      // Check interpretation
      await expect(page.locator("text=═══ INTERPRETATION ═══")).toBeVisible();
      await expect(
        page.locator(
          "text=/Treatment parameters are within acceptable safety limits/",
        ),
      ).toBeVisible();
      await expect(
        page.locator("text=/MIRD model assumes uniform dose distribution/"),
      ).toBeVisible();

      // Check formula
      await expect(
        page.locator(
          "text=Formula: A [GBq] = (D [Gy] × M [kg] × (1-LSF)) / 49.67",
        ),
      ).toBeVisible();
    });

    test("should calculate MIRD model with 3 GBq vial recommendation", async ({
      page,
    }) => {
      // Small volume segmentectomy
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.fill('input[id="segment_volume"]', "100");
      await page.fill('input[id="target_dose"]', "200");
      await page.fill('input[id="lung_shunt"]', "5");
      await page.fill('input[id="vial_residual"]', "1");
      await page.locator('input[value="glass"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Recommended Vial Size: 3 GBq vial"),
      ).toBeVisible();
    });

    test("should calculate MIRD model for lobectomy with higher volume", async ({
      page,
    }) => {
      // Lobectomy with larger volume
      await page.locator('input[value="lobectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.fill('input[id="segment_volume"]', "800");
      await page.fill('input[id="target_dose"]', "120");
      await page.fill('input[id="lung_shunt"]', "8");
      await page.fill('input[id="vial_residual"]', "1");
      await page.locator('input[value="glass"]').click();

      await page.click('button:has-text("Calculate")');

      // Check that it calculated successfully
      await expect(
        page.locator("text=Mean Segment Dose: 120.0 Gy"),
      ).toBeVisible();
      await expect(
        page.locator("text=Treatment Intent: Lobectomy"),
      ).toBeVisible();
      await expect(page.locator("text=/Target Volume.*800 mL/")).toBeVisible();
    });
  });

  test.describe("Partition Model Calculations", () => {
    test("should calculate partition model with standard parameters", async ({
      page,
    }) => {
      // Standard partition model with tumor/normal ratio
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="partition"]').click();
      await page.fill('input[id="segment_volume"]', "300");
      await page.fill('input[id="tumor_volume"]', "100");
      await page.fill('input[id="target_dose"]', "400");
      await page.fill('input[id="lung_shunt"]', "5");
      await page.fill('input[id="tn_ratio"]', "3");
      await page.fill('input[id="vial_residual"]', "1");
      await page.locator('input[value="glass"]').click();

      await page.click('button:has-text("Calculate")');

      // Check dosimetry results - partition model specific
      await expect(page.locator("text=/Tumor Dose.*400.0 Gy/")).toBeVisible();
      await expect(page.locator("text=/Normal Tissue Dose.*Gy/")).toBeVisible();
      await expect(page.locator("text=/Mean Segment Dose.*Gy/")).toBeVisible();
      await expect(
        page.locator("text=Tumor-to-Normal Ratio: 3.0"),
      ).toBeVisible();
      await expect(
        page.locator("text=Model Used: Partition (tumor/normal)"),
      ).toBeVisible();

      // Check volume breakdown
      await expect(page.locator("text=/Tumor Volume.*100 mL/")).toBeVisible();
      await expect(page.locator("text=/Normal Volume.*200 mL/")).toBeVisible();

      // Check interpretation mentions partition model
      await expect(
        page.locator("text=/Partition model predicts.*Gy to tumor/"),
      ).toBeVisible();

      // Check formula
      await expect(
        page.locator(
          "text=Formula: A [GBq] = (D_N × M_N × (T/N + 1) × (1-LSF)) / 49.67",
        ),
      ).toBeVisible();
    });

    test("should calculate partition model with high T/N ratio", async ({
      page,
    }) => {
      // High tumor-to-normal ratio (very hot tumor)
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="partition"]').click();
      await page.fill('input[id="segment_volume"]', "200");
      await page.fill('input[id="tumor_volume"]', "50");
      await page.fill('input[id="target_dose"]', "500");
      await page.fill('input[id="lung_shunt"]', "5");
      await page.fill('input[id="tn_ratio"]', "10");
      await page.fill('input[id="vial_residual"]', "1");
      await page.locator('input[value="glass"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Tumor-to-Normal Ratio: 10.0"),
      ).toBeVisible();
      await expect(page.locator("text=/Tumor Dose.*500.0 Gy/")).toBeVisible();
      // Normal dose should be tumor dose / T/N ratio = 500/10 = 50 Gy
      await expect(
        page.locator("text=/Normal Tissue Dose.*50.0 Gy/"),
      ).toBeVisible();
    });

    test("should calculate partition model with low T/N ratio", async ({
      page,
    }) => {
      // Low T/N ratio (minimal differential uptake)
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="partition"]').click();
      await page.fill('input[id="segment_volume"]', "250");
      await page.fill('input[id="tumor_volume"]', "80");
      await page.fill('input[id="target_dose"]', "300");
      await page.fill('input[id="lung_shunt"]', "5");
      await page.fill('input[id="tn_ratio"]', "2");
      await page.fill('input[id="vial_residual"]', "1");
      await page.locator('input[value="glass"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Tumor-to-Normal Ratio: 2.0"),
      ).toBeVisible();
      await expect(page.locator("text=/Tumor Dose.*300.0 Gy/")).toBeVisible();
      // Normal dose should be 300/2 = 150 Gy
      await expect(
        page.locator("text=/Normal Tissue Dose.*150.0 Gy/"),
      ).toBeVisible();
    });
  });

  test.describe("Safety Contraindications and Warnings", () => {
    test("should show CONTRAINDICATION for lung shunt >20% with resin", async ({
      page,
    }) => {
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.fill('input[id="segment_volume"]', "200");
      await page.fill('input[id="target_dose"]', "205");
      await page.fill('input[id="lung_shunt"]', "25"); // >20%
      await page.fill('input[id="vial_residual"]', "1");
      await page.locator('input[value="resin"]').click(); // Resin microspheres

      await page.click('button:has-text("Calculate")');

      // Should show contraindication
      await expect(
        page.locator("text=Safety Status: ⚠️ CONTRAINDICATED - See below"),
      ).toBeVisible();
      await expect(
        page.locator("text=═══ CONTRAINDICATIONS ═══"),
      ).toBeVisible();
      await expect(
        page.locator(
          "text=/CONTRAINDICATION: Lung shunt >20% with resin microspheres/",
        ),
      ).toBeVisible();
      await expect(
        page.locator("text=/TREATMENT CONTRAINDICATED/"),
      ).toBeVisible();
    });

    test("should show CONTRAINDICATION for lung dose >30 Gy", async ({
      page,
    }) => {
      // Very high lung shunt that results in >30 Gy lung dose
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.fill('input[id="segment_volume"]', "500");
      await page.fill('input[id="target_dose"]', "300");
      await page.fill('input[id="lung_shunt"]', "30"); // Very high
      await page.fill('input[id="vial_residual"]', "1");
      await page.locator('input[value="glass"]').click();

      await page.click('button:has-text("Calculate")');

      // Should show contraindication for lung dose
      await expect(
        page.locator("text=Safety Status: ⚠️ CONTRAINDICATED - See below"),
      ).toBeVisible();
      await expect(
        page.locator(
          "text=/CONTRAINDICATION: Estimated lung dose.*exceeds 30 Gy/",
        ),
      ).toBeVisible();
    });

    test("should show WARNING for segmentectomy dose <190 Gy", async ({
      page,
    }) => {
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.fill('input[id="segment_volume"]', "200");
      await page.fill('input[id="target_dose"]', "150"); // Below 190 Gy
      await page.fill('input[id="lung_shunt"]', "5");
      await page.fill('input[id="vial_residual"]', "1");
      await page.locator('input[value="glass"]').click();

      await page.click('button:has-text("Calculate")');

      // Should show warning (not contraindication)
      await expect(
        page.locator("text=Safety Status: ⚠️ Warnings present - Review below"),
      ).toBeVisible();
      await expect(page.locator("text=═══ WARNINGS & NOTES ═══")).toBeVisible();
      await expect(
        page.locator(
          "text=/WARNING: Target dose 150 Gy is below recommended 190 Gy/",
        ),
      ).toBeVisible();
      await expect(
        page.locator("text=/Consider increasing target dose to ≥190 Gy/"),
      ).toBeVisible();
    });

    test("should show WARNING for normal dose >80 Gy in large volume", async ({
      page,
    }) => {
      // Partition model with high normal dose
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="partition"]').click();
      await page.fill('input[id="segment_volume"]', "500");
      await page.fill('input[id="tumor_volume"]', "100");
      await page.fill('input[id="target_dose"]', "400");
      await page.fill('input[id="lung_shunt"]', "5");
      await page.fill('input[id="tn_ratio"]', "2"); // Results in 200 Gy normal dose
      await page.fill('input[id="vial_residual"]', "1");
      await page.locator('input[value="glass"]').click();

      await page.click('button:has-text("Calculate")');

      // Should show warning for high normal dose
      await expect(
        page.locator("text=/WARNING: Normal tissue dose.*exceeds 80 Gy/"),
      ).toBeVisible();
    });

    test("should show note for lung shunt 10-20%", async ({ page }) => {
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.fill('input[id="segment_volume"]', "200");
      await page.fill('input[id="target_dose"]', "205");
      await page.fill('input[id="lung_shunt"]', "15"); // 10-20%
      await page.fill('input[id="vial_residual"]', "1");
      await page.locator('input[value="glass"]').click();

      await page.click('button:has-text("Calculate")');

      // Should show note about elevated lung shunt
      await expect(
        page.locator("text=/Note: Lung shunt.*is elevated.*10-20%/"),
      ).toBeVisible();
    });

    test("should be safe with optimal parameters", async ({ page }) => {
      // Perfect parameters - no warnings or contraindications
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.fill('input[id="segment_volume"]', "200");
      await page.fill('input[id="target_dose"]', "205");
      await page.fill('input[id="lung_shunt"]', "5");
      await page.fill('input[id="vial_residual"]', "1");
      await page.locator('input[value="glass"]').click();

      await page.click('button:has-text("Calculate")');

      // Should show safe status
      await expect(
        page.locator("text=Safety Status: ✓ Within safety parameters"),
      ).toBeVisible();
      await expect(
        page.locator(
          "text=Treatment parameters are within acceptable safety limits",
        ),
      ).toBeVisible();
    });
  });

  test.describe("Vial Size Recommendations", () => {
    test("should recommend 3 GBq vial for low activity", async ({ page }) => {
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.fill('input[id="segment_volume"]', "80");
      await page.fill('input[id="target_dose"]', "205");
      await page.fill('input[id="lung_shunt"]', "5");
      await page.fill('input[id="vial_residual"]', "1");
      await page.locator('input[value="glass"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Recommended Vial Size: 3 GBq vial"),
      ).toBeVisible();
    });

    test("should recommend 5 GBq vial for moderate activity", async ({
      page,
    }) => {
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.fill('input[id="segment_volume"]', "150");
      await page.fill('input[id="target_dose"]', "205");
      await page.fill('input[id="lung_shunt"]', "5");
      await page.fill('input[id="vial_residual"]', "1");
      await page.locator('input[value="glass"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Recommended Vial Size: 5 GBq vial"),
      ).toBeVisible();
    });

    test("should recommend 10 GBq vial for higher activity", async ({
      page,
    }) => {
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.fill('input[id="segment_volume"]', "300");
      await page.fill('input[id="target_dose"]', "205");
      await page.fill('input[id="lung_shunt"]', "5");
      await page.fill('input[id="vial_residual"]', "1");
      await page.locator('input[value="glass"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Recommended Vial Size: 10 GBq vial"),
      ).toBeVisible();
    });

    test("should recommend 20 GBq vial for very high activity", async ({
      page,
    }) => {
      await page.locator('input[value="lobectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.fill('input[id="segment_volume"]', "600");
      await page.fill('input[id="target_dose"]', "205");
      await page.fill('input[id="lung_shunt"]', "5");
      await page.fill('input[id="vial_residual"]', "1");
      await page.locator('input[value="glass"]').click();

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Recommended Vial Size: 20 GBq vial"),
      ).toBeVisible();
    });

    test("should not show vial recommendation for resin microspheres", async ({
      page,
    }) => {
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.fill('input[id="segment_volume"]', "200");
      await page.fill('input[id="target_dose"]', "205");
      await page.fill('input[id="lung_shunt"]', "10");
      await page.fill('input[id="vial_residual"]', "1");
      await page.locator('input[value="resin"]').click();

      await page.click('button:has-text("Calculate")');

      // No vial size recommendation for resin
      await expect(
        page.locator("text=Recommended Vial Size"),
      ).not.toBeVisible();
    });
  });

  test.describe("BSA Calculation (Optional)", () => {
    test("should calculate BSA when height and weight provided", async ({
      page,
    }) => {
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.fill('input[id="segment_volume"]', "200");
      await page.fill('input[id="target_dose"]', "205");
      await page.fill('input[id="lung_shunt"]', "5");
      await page.fill('input[id="vial_residual"]', "1");
      await page.locator('input[value="glass"]').click();
      await page.fill('input[id="patient_weight"]', "70");
      await page.fill('input[id="patient_height"]', "170");

      await page.click('button:has-text("Calculate")');

      // Should show BSA calculation
      await expect(page.locator("text=/Body Surface Area.*m²/")).toBeVisible();
    });

    test("should not show BSA when only weight provided", async ({ page }) => {
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.fill('input[id="segment_volume"]', "200");
      await page.fill('input[id="target_dose"]', "205");
      await page.fill('input[id="lung_shunt"]', "5");
      await page.fill('input[id="vial_residual"]', "1");
      await page.locator('input[value="glass"]').click();
      await page.fill('input[id="patient_weight"]', "70");

      await page.click('button:has-text("Calculate")');

      // Should NOT show BSA
      await expect(page.locator("text=Body Surface Area")).not.toBeVisible();
    });

    test("should not show BSA when only height provided", async ({ page }) => {
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.fill('input[id="segment_volume"]', "200");
      await page.fill('input[id="target_dose"]', "205");
      await page.fill('input[id="lung_shunt"]', "5");
      await page.fill('input[id="vial_residual"]', "1");
      await page.locator('input[value="glass"]').click();
      await page.fill('input[id="patient_height"]', "170");

      await page.click('button:has-text("Calculate")');

      // Should NOT show BSA
      await expect(page.locator("text=Body Surface Area")).not.toBeVisible();
    });
  });

  test.describe("Input Validation and Error Handling", () => {
    test("should require treatment intent, dosimetry model, and microsphere type", async ({
      page,
    }) => {
      // Try to calculate without selections
      await page.fill('input[id="segment_volume"]', "200");
      await page.fill('input[id="target_dose"]', "205");
      await page.fill('input[id="lung_shunt"]', "5");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "text=Error: Please select treatment intent, dosimetry model, and microsphere type",
        ),
      ).toBeVisible();
    });

    test("should validate segment volume range (10-2000 mL)", async ({
      page,
    }) => {
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.locator('input[value="glass"]').click();
      await page.fill('input[id="segment_volume"]', "5"); // Too low
      await page.fill('input[id="target_dose"]', "205");
      await page.fill('input[id="lung_shunt"]', "5");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "text=Error: Target segment volume must be between 10-2000 mL",
        ),
      ).toBeVisible();
    });

    test("should validate target dose range (80-800 Gy)", async ({ page }) => {
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.locator('input[value="glass"]').click();
      await page.fill('input[id="segment_volume"]', "200");
      await page.fill('input[id="target_dose"]', "50"); // Too low
      await page.fill('input[id="lung_shunt"]', "5");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Error: Target dose must be between 80-800 Gy"),
      ).toBeVisible();
    });

    test("should require lung shunt fraction", async ({ page }) => {
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.locator('input[value="glass"]').click();
      await page.fill('input[id="segment_volume"]', "200");
      await page.fill('input[id="target_dose"]', "205");
      // Don't fill lung_shunt

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "text=Error: Lung shunt fraction is required and must be between 0-50%",
        ),
      ).toBeVisible();
    });

    test("should validate lung shunt range (0-50%)", async ({ page }) => {
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.locator('input[value="glass"]').click();
      await page.fill('input[id="segment_volume"]', "200");
      await page.fill('input[id="target_dose"]', "205");
      await page.fill('input[id="lung_shunt"]', "60"); // Too high

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "text=Error: Lung shunt fraction is required and must be between 0-50%",
        ),
      ).toBeVisible();
    });

    test("should validate vial residual range (0-20%)", async ({ page }) => {
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.locator('input[value="glass"]').click();
      await page.fill('input[id="segment_volume"]', "200");
      await page.fill('input[id="target_dose"]', "205");
      await page.fill('input[id="lung_shunt"]', "5");
      await page.fill('input[id="vial_residual"]', "25"); // Too high

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Error: Vial residual must be between 0-20%"),
      ).toBeVisible();
    });

    test("should require tumor volume for partition model", async ({
      page,
    }) => {
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="partition"]').click();
      await page.locator('input[value="glass"]').click();
      await page.fill('input[id="segment_volume"]', "200");
      await page.fill('input[id="target_dose"]', "400");
      await page.fill('input[id="lung_shunt"]', "5");
      // Don't fill tumor_volume

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=/Error:.*Tumor volume.*partition model/"),
      ).toBeVisible();
    });

    test("should require T/N ratio for partition model", async ({ page }) => {
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="partition"]').click();
      await page.locator('input[value="glass"]').click();
      await page.fill('input[id="segment_volume"]', "200");
      await page.fill('input[id="tumor_volume"]', "100");
      await page.fill('input[id="target_dose"]', "400");
      await page.fill('input[id="lung_shunt"]', "5");
      // Don't fill tn_ratio

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=/Error:.*Tumor-to-normal ratio.*partition model/"),
      ).toBeVisible();
    });

    test("should validate T/N ratio range (1-50)", async ({ page }) => {
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="partition"]').click();
      await page.locator('input[value="glass"]').click();
      await page.fill('input[id="segment_volume"]', "200");
      await page.fill('input[id="tumor_volume"]', "100");
      await page.fill('input[id="target_dose"]', "400");
      await page.fill('input[id="lung_shunt"]', "5");
      await page.fill('input[id="tn_ratio"]', "60"); // Too high

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator(
          "text=Error: Tumor-to-normal ratio must be between 1-50 for partition model",
        ),
      ).toBeVisible();
    });

    test("should validate tumor volume ≤ segment volume", async ({ page }) => {
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="partition"]').click();
      await page.locator('input[value="glass"]').click();
      await page.fill('input[id="segment_volume"]', "200");
      await page.fill('input[id="tumor_volume"]', "250"); // Larger than segment!
      await page.fill('input[id="target_dose"]', "400");
      await page.fill('input[id="lung_shunt"]', "5");
      await page.fill('input[id="tn_ratio"]', "3");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=/Error:.*Tumor volume.*≤ segment volume/"),
      ).toBeVisible();
    });

    test("should validate patient weight if provided", async ({ page }) => {
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.locator('input[value="glass"]').click();
      await page.fill('input[id="segment_volume"]', "200");
      await page.fill('input[id="target_dose"]', "205");
      await page.fill('input[id="lung_shunt"]', "5");
      await page.fill('input[id="patient_weight"]', "600"); // Too high
      await page.fill('input[id="patient_height"]', "170");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=/Error:.*Patient weight.*0-500 kg/"),
      ).toBeVisible();
    });

    test("should validate patient height if provided", async ({ page }) => {
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.locator('input[value="glass"]').click();
      await page.fill('input[id="segment_volume"]', "200");
      await page.fill('input[id="target_dose"]', "205");
      await page.fill('input[id="lung_shunt"]', "5");
      await page.fill('input[id="patient_weight"]', "70");
      await page.fill('input[id="patient_height"]', "350"); // Too high

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=/Error:.*Patient height.*0-300 cm/"),
      ).toBeVisible();
    });
  });

  test.describe("Edge Cases and Special Scenarios", () => {
    test("should handle minimum valid values", async ({ page }) => {
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.locator('input[value="glass"]').click();
      await page.fill('input[id="segment_volume"]', "10"); // Minimum
      await page.fill('input[id="target_dose"]', "80"); // Minimum
      await page.fill('input[id="lung_shunt"]', "0"); // Minimum
      await page.fill('input[id="vial_residual"]', "0");

      await page.click('button:has-text("Calculate")');

      // Should calculate successfully
      await expect(page.locator("text=Activity to Order")).toBeVisible();
      await expect(
        page.locator("text=Lung Shunt Fraction: 0.0%"),
      ).toBeVisible();
    });

    test("should handle maximum valid values", async ({ page }) => {
      await page.locator('input[value="lobectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.locator('input[value="glass"]').click();
      await page.fill('input[id="segment_volume"]', "2000"); // Maximum
      await page.fill('input[id="target_dose"]', "800"); // Maximum
      await page.fill('input[id="lung_shunt"]', "15"); // High but safe
      await page.fill('input[id="vial_residual"]', "5");

      await page.click('button:has-text("Calculate")');

      // Should calculate successfully with warnings
      await expect(page.locator("text=Activity to Order")).toBeVisible();
    });

    test("should handle zero lung shunt correctly", async ({ page }) => {
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.locator('input[value="glass"]').click();
      await page.fill('input[id="segment_volume"]', "200");
      await page.fill('input[id="target_dose"]', "205");
      await page.fill('input[id="lung_shunt"]', "0");
      await page.fill('input[id="vial_residual"]', "1");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=Lung Shunt Fraction: 0.0%"),
      ).toBeVisible();
      await expect(
        page.locator("text=Estimated Lung Dose: 0.0 Gy"),
      ).toBeVisible();
    });

    test("should handle T/N ratio of 1 (no differential uptake)", async ({
      page,
    }) => {
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="partition"]').click();
      await page.locator('input[value="glass"]').click();
      await page.fill('input[id="segment_volume"]', "200");
      await page.fill('input[id="tumor_volume"]', "100");
      await page.fill('input[id="target_dose"]', "400");
      await page.fill('input[id="lung_shunt"]', "5");
      await page.fill('input[id="tn_ratio"]', "1"); // Equal uptake
      await page.fill('input[id="vial_residual"]', "1");

      await page.click('button:has-text("Calculate")');

      // Tumor and normal dose should be equal
      await expect(page.locator("text=Tumor Dose: 400.0 Gy")).toBeVisible();
      await expect(
        page.locator("text=Normal Tissue Dose: 400.0 Gy"),
      ).toBeVisible();
    });

    test("should show correct lung dose interpretation for various ranges", async ({
      page,
    }) => {
      // Test <10 Gy
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.locator('input[value="glass"]').click();
      await page.fill('input[id="segment_volume"]', "100");
      await page.fill('input[id="target_dose"]', "205");
      await page.fill('input[id="lung_shunt"]', "5");
      await page.fill('input[id="vial_residual"]', "1");

      await page.click('button:has-text("Calculate")');

      await expect(
        page.locator("text=/Lung dose is within normal limits.*<10 Gy/"),
      ).toBeVisible();
    });

    test("should handle decimal inputs correctly", async ({ page }) => {
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="partition"]').click();
      await page.locator('input[value="glass"]').click();
      await page.fill('input[id="segment_volume"]', "123.5");
      await page.fill('input[id="tumor_volume"]', "45.8");
      await page.fill('input[id="target_dose"]', "387.2");
      await page.fill('input[id="lung_shunt"]', "7.3");
      await page.fill('input[id="tn_ratio"]', "4.5");
      await page.fill('input[id="vial_residual"]', "1.2");

      await page.click('button:has-text("Calculate")');

      // Should calculate successfully with decimal values
      await expect(page.locator("text=Activity to Order")).toBeVisible();
    });
  });

  test.describe("References and Documentation", () => {
    test("should display all 15 references", async ({ page }) => {
      const references = await page
        .locator('section:has-text("References") li')
        .count();
      expect(references).toBe(15);
    });

    test("should have working reference links", async ({ page }) => {
      // Check that DOI links are present and properly formatted
      await expect(
        page.locator('a[href*="doi.org/10.1007/BF00949868"]'),
      ).toBeVisible(); // Ho 1996
      await expect(
        page.locator('a[href*="doi.org/10.1016/j.jvir.2014.10.039"]'),
      ).toBeVisible(); // Lewandowski 2015
      await expect(
        page.locator('a[href*="doi.org/10.1002/cncr.24304"]'),
      ).toBeVisible(); // Salem 2010
      await expect(
        page.locator('a[href*="doi.org/10.1016/j.ijrobp.2006.12.029"]'),
      ).toBeVisible(); // Kennedy 2007
      await expect(
        page.locator('a[href*="doi.org/10.1016/S1470-2045(20)30290-9"]'),
      ).toBeVisible(); // Garin 2021
    });

    test("should include manufacturer and professional society references", async ({
      page,
    }) => {
      await expect(
        page.locator("text=TheraSphere Y-90 Glass Microspheres Package Insert"),
      ).toBeVisible();
      await expect(page.locator("text=AAPM Task Group Report")).toBeVisible();
    });
  });

  test.describe("Result Display and Formatting", () => {
    test("should display activity in both GBq and mCi", async ({ page }) => {
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.locator('input[value="glass"]').click();
      await page.fill('input[id="segment_volume"]', "200");
      await page.fill('input[id="target_dose"]', "205");
      await page.fill('input[id="lung_shunt"]', "5");
      await page.fill('input[id="vial_residual"]', "1");

      await page.click('button:has-text("Calculate")');

      // Should show both units
      const activityText = await page
        .locator("text=/Activity to Order.*GBq.*mCi/")
        .textContent();
      expect(activityText).toContain("GBq");
      expect(activityText).toContain("mCi");
    });

    test("should display volume and mass for target", async ({ page }) => {
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.locator('input[value="glass"]').click();
      await page.fill('input[id="segment_volume"]', "200");
      await page.fill('input[id="target_dose"]', "205");
      await page.fill('input[id="lung_shunt"]', "5");
      await page.fill('input[id="vial_residual"]', "1");

      await page.click('button:has-text("Calculate")');

      // Should show both mL and grams
      await expect(
        page.locator("text=/Target Volume.*200 mL.*g/"),
      ).toBeVisible();
    });

    test("should use section separators for organization", async ({ page }) => {
      await page.locator('input[value="segmentectomy"]').click();
      await page.locator('input[value="mird"]').click();
      await page.locator('input[value="glass"]').click();
      await page.fill('input[id="segment_volume"]', "200");
      await page.fill('input[id="target_dose"]', "205");
      await page.fill('input[id="lung_shunt"]', "5");
      await page.fill('input[id="vial_residual"]', "1");

      await page.click('button:has-text("Calculate")');

      // Check all section separators
      await expect(
        page.locator("text=═══ PRESCRIBED ACTIVITY ═══"),
      ).toBeVisible();
      await expect(
        page.locator("text=═══ DOSIMETRY RESULTS ═══"),
      ).toBeVisible();
      await expect(
        page.locator("text=═══ SAFETY PARAMETERS ═══"),
      ).toBeVisible();
      await expect(page.locator("text=═══ INTERPRETATION ═══")).toBeVisible();
    });
  });
});
