import { test, expect } from '@playwright/test';
import { navigateToCalculator } from '../../../helpers/calculator-test-helper.js';

function calculatorTitle(page) {
  return page.getByTestId('calculator-title');
}

function calculatorDescription(page) {
  return page.getByTestId('calculator-description');
}

function calculatorInfo(page) {
  return page.getByTestId('calculator-info');
}

function dynamicRoiTable(page) {
  return page.getByLabel('Dynamic ROI table');
}

function addRoiButton(page) {
  return dynamicRoiTable(page).getByRole('button', { name: 'Add ROI' });
}

function removeRoiButtons(page) {
  return dynamicRoiTable(page).getByRole('button', { name: 'Remove' });
}

function roiNumber(page, number) {
  return dynamicRoiTable(page).getByText(`#${number}`, { exact: true });
}

function calculateControl(page) {
  return page.getByRole('button', { name: 'Calculate' });
}

function resultsSection(page) {
  return page.getByRole('status', { name: 'Calculator results' });
}

function resultRow(page, label) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return resultsSection(page)
    .locator('span')
    .filter({ hasText: new RegExp(`^${escapedLabel}:\\s*$`) })
    .locator(
      'xpath=ancestor::div[contains(@class, "justify-between") or contains(@class, "rounded-lg")][1]',
    );
}

async function expectResult(page, label, expected) {
  await expect(resultRow(page, label)).toContainText(expected);
}

/**
 * MR Elastography (Liver) Calculator E2E Tests
 *
 * Tests the MR Elastography calculator for area-weighted mean liver stiffness
 * Formula: Σ(Mi·Ai) / ΣAi
 * where Mi = stiffness in kPa, Ai = ROI area in cm²
 *
 * Interpretation (typical 60 Hz GRE ranges):
 * - <2.5 kPa: Within normal limits
 * - 2.5-3.0 kPa: Borderline
 * - 3.0-3.6 kPa: ≥F2 fibrosis likely
 * - 3.6-4.0 kPa: ≥F3 advanced fibrosis likely
 * - ≥4.0 kPa: Cirrhosis (F4) likely
 *
 * Reference: Manduca et al., 2020
 */

test.describe('MR Elastography Calculator', () => {

  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, 'MR Elastography (Liver)');
    await expect(calculatorTitle(page)).toContainText('MR Elastography');
  });

  test.describe('Visual Appeal & Theme Matching', () => {

    test('should display calculator with proper styling', async ({ page }) => {
      // Check calculator card is visible
      const card = page.locator('.card, [class*="card"]').filter({ visible: true }).first();
      await expect(card).toBeVisible();

      // Check title is visible and styled
      const title = calculatorTitle(page);
      await expect(title).toBeVisible();

      // Check description is present
      await expect(calculatorDescription(page)).toContainText(
        'Area-weighted mean liver stiffness',
      );
    });

    test('should have responsive design on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Calculator should still be visible and usable
      await expect(calculatorTitle(page)).toContainText('MR Elastography');

      // Fields should be accessible on mobile
      const frequencySelect = page.getByLabel('Driver frequency (Hz)');
      await expect(frequencySelect).toBeVisible();
    });

    test('should display info section with proper styling', async ({ page }) => {
      // Check if info section exists
      const infoSection = calculatorInfo(page);
      await expect(infoSection).toBeVisible();
      await expect(infoSection).toContainText(
        'Goal: Compute the area-weighted mean',
      );

      // Check for reference link
      const refLink = page.getByRole('button', {
        name: /Open Consensus guidance.*Manduca/i,
      });
      await expect(refLink).toBeVisible();
    });

    test('should display dynamic ROI table with proper styling', async ({ page }) => {
      // Check for dynamic table headers
      const table = dynamicRoiTable(page);
      await expect(
        table.getByRole('heading', { name: 'Dynamic ROIs' }),
      ).toBeVisible();
      await expect(table.getByText('Slice / ROI', { exact: true })).toBeVisible();
      await expect(
        table.getByText('Stiffness (kPa)', { exact: true }),
      ).toBeVisible();
      await expect(table.getByText('ROI Area', { exact: true })).toBeVisible();

      // Check for Add ROI button
      const addButton = addRoiButton(page);
      await expect(addButton).toBeVisible();
    });
  });

  test.describe('Frequency Selection', () => {

    test('should have frequency dropdown with standard options', async ({ page }) => {
      const frequencySelect = page.getByLabel('Driver frequency (Hz)');
      await expect(frequencySelect).toBeVisible();

      // Check for common frequencies
      const options = await frequencySelect.locator('option').allTextContents();
      expect(options).toContain('60');
      expect(options).toContain('40');
      expect(options).toContain('50');
      expect(options).toContain('90');
      expect(options).toContain('Other');
    });

    test('should show custom frequency field when "Other" selected', async ({ page }) => {
      const frequencySelect = page.getByLabel('Driver frequency (Hz)');
      await frequencySelect.selectOption('Other');

      // Custom frequency field should become visible
      const customFreq = page.getByLabel('Custom frequency (Hz)');
      await expect(customFreq).toBeVisible();
    });
  });

  test.describe('Input Methods - Individual ROI Fields', () => {

    test('should accept individual ROI values', async ({ page }) => {
      // Enter first ROI
      const roi1Kpa = page.locator('input[id="roi1_kpa"]');
      const roi1Area = page.locator('input[id="roi1_area"]');

      await roi1Kpa.fill('2.8');
      await expect(roi1Kpa).toHaveValue('2.8');

      await roi1Area.fill('50.0');
      await expect(roi1Area).toHaveValue('50.0');
    });

    test('should handle multiple individual ROI fields', async ({ page }) => {
      // Enter values in multiple ROI fields
      await page.fill('input[id="roi1_kpa"]', '2.8');
      await page.fill('input[id="roi1_area"]', '50.0');
      await page.fill('input[id="roi2_kpa"]', '3.2');
      await page.fill('input[id="roi2_area"]', '45.0');
      await page.fill('input[id="roi3_kpa"]', '3.6');
      await page.fill('input[id="roi3_area"]', '40.0');

      // All values should be retained
      await expect(page.locator('input[id="roi1_kpa"]')).toHaveValue('2.8');
      await expect(page.locator('input[id="roi2_kpa"]')).toHaveValue('3.2');
      await expect(page.locator('input[id="roi3_kpa"]')).toHaveValue('3.6');
    });
  });

  test.describe('Input Methods - CSV Paste', () => {

    test('should accept CSV input', async ({ page }) => {
      const csvInput = page.getByLabel('Paste ROI CSV (kPa,Area per line)');
      const csvData = '2.8, 50\n3.2, 45\n3.6, 40';

      await csvInput.fill(csvData);
      await expect(csvInput).toHaveValue(csvData);
    });

    test('should handle various CSV formats', async ({ page }) => {
      const csvInput = page.getByLabel('Paste ROI CSV (kPa,Area per line)');

      // Test semicolon separated
      await csvInput.fill('2.8;50.0\n3.2;45.0');
      await expect(csvInput).toHaveValue('2.8;50.0\n3.2;45.0');

      // Test with spaces
      await csvInput.clear();
      await csvInput.fill('2.8  50.0\n3.2  45.0');
      await expect(csvInput).toHaveValue('2.8  50.0\n3.2  45.0');
    });

    test('should handle European decimal notation', async ({ page }) => {
      const csvInput = page.getByLabel('Paste ROI CSV (kPa,Area per line)');

      // European format with comma as decimal separator
      await csvInput.fill('2,8;50,0\n3,2;45,0');
      await expect(csvInput).toHaveValue('2,8;50,0\n3,2;45,0');
    });
  });

  test.describe('Input Methods - Dynamic ROI Rows', () => {

    test('should have one default dynamic ROI row', async ({ page }) => {
      // Check for first row
      await expect(roiNumber(page, 1)).toBeVisible();

      // Should have stiffness and area inputs for row 1
      const inputs = await page.locator('input[aria-label*="ROI 1"]').count();
      expect(inputs).toBeGreaterThanOrEqual(2);
    });

    test('should add new dynamic ROI rows', async ({ page }) => {
      const addButton = addRoiButton(page);

      // Add a second row
      await addButton.click();
      await expect(roiNumber(page, 2)).toBeVisible();

      // Add a third row
      await addButton.click();
      await expect(roiNumber(page, 3)).toBeVisible();
    });

    test('should accept values in dynamic ROI rows', async ({ page }) => {
      // Fill first dynamic row
      const row1Kpa = page.locator('input[aria-label="ROI 1 stiffness in kPa"]');
      const row1Area = page.locator('input[aria-label="ROI 1 area in cm²"]');

      await row1Kpa.fill('3.5');
      await row1Area.fill('55.0');

      await expect(row1Kpa).toHaveValue('3.5');
      await expect(row1Area).toHaveValue('55.0');
    });

    test('should remove dynamic ROI rows', async ({ page }) => {
      const addButton = addRoiButton(page);

      // Add two more rows (total 3)
      await addButton.click();
      await addButton.click();
      await expect(roiNumber(page, 3)).toBeVisible();

      // Remove the second row
      const removeButtons = removeRoiButtons(page);
      await removeButtons.nth(1).click();

      // Should still have 2 rows
      await expect(roiNumber(page, 2)).toBeVisible();
    });

    test('should not allow removing the last dynamic row', async ({ page }) => {
      const removeButton = removeRoiButtons(page).first();

      // Should be disabled when only one row exists
      await expect(removeButton).toBeDisabled();
    });

    test('should validate dynamic row inputs', async ({ page }) => {
      const row1Kpa = page.locator('input[aria-label="ROI 1 stiffness in kPa"]');

      // Enter invalid value (negative)
      await row1Kpa.fill('-5');

      // Field should show validation state
      await expect(row1Kpa).toHaveAttribute('aria-invalid', 'true');
    });
  });

  test.describe('Calculate Button State', () => {

    test('should disable Calculate button when no valid ROIs', async ({ page }) => {
      const calculateButton = calculateControl(page);

      // Should be disabled initially
      await expect(calculateButton).toBeDisabled();
    });

    test('should enable Calculate when valid ROI entered in fields', async ({ page }) => {
      // Enter valid ROI
      await page.fill('input[id="roi1_kpa"]', '2.8');
      await page.fill('input[id="roi1_area"]', '50.0');

      const calculateButton = calculateControl(page);
      await expect(calculateButton).toBeEnabled();
    });

    test('should enable Calculate when valid CSV entered', async ({ page }) => {
      const csvInput = page.getByLabel('Paste ROI CSV (kPa,Area per line)');
      await csvInput.fill('2.8, 50.0');

      const calculateButton = calculateControl(page);
      await expect(calculateButton).toBeEnabled();
    });

    test('should enable Calculate when valid dynamic row entered', async ({ page }) => {
      const row1Kpa = page.locator('input[aria-label="ROI 1 stiffness in kPa"]');
      const row1Area = page.locator('input[aria-label="ROI 1 area in cm²"]');

      await row1Kpa.fill('3.5');
      await row1Area.fill('55.0');

      const calculateButton = calculateControl(page);
      await expect(calculateButton).toBeEnabled();
    });
  });

  test.describe('MRE Calculations - Single ROI', () => {

    test('Normal liver (F0) - Single ROI', async ({ page }) => {
      // Test case: 2.0 kPa, 50 cm² → Mean = 2.0 kPa (normal)
      await page.fill('input[id="roi1_kpa"]', '2.0');
      await page.fill('input[id="roi1_area"]', '50.0');

      await calculateControl(page).click();


      // Check results
      await expectResult(page, 'Total Area (cm²)', '50.00');
      await expectResult(page, 'Area-weighted Mean (kPa)', '2.00');
      await expectResult(
        page,
        'Interpretation',
        /Within normal limits|no significant fibrosis/i,
      );
    });

    test('Borderline (F0-F1) - Single ROI', async ({ page }) => {
      // Test case: 2.7 kPa, 45 cm² → Mean = 2.7 kPa (borderline)
      await page.fill('input[id="roi1_kpa"]', '2.7');
      await page.fill('input[id="roi1_area"]', '45.0');

      await calculateControl(page).click();


      await expectResult(page, 'Area-weighted Mean (kPa)', '2.70');
      await expectResult(page, 'Interpretation', /Borderline.*mild elevation/i);
    });

    test('F2 Fibrosis - Single ROI', async ({ page }) => {
      // Test case: 3.3 kPa, 50 cm² → Mean = 3.3 kPa (≥F2)
      await page.fill('input[id="roi1_kpa"]', '3.3');
      await page.fill('input[id="roi1_area"]', '50.0');

      await calculateControl(page).click();


      await expectResult(page, 'Area-weighted Mean (kPa)', '3.30');
      await expectResult(page, 'Interpretation', /≥F2 fibrosis likely/i);
    });

    test('F3 Advanced Fibrosis - Single ROI', async ({ page }) => {
      // Test case: 3.8 kPa, 48 cm² → Mean = 3.8 kPa (≥F3)
      await page.fill('input[id="roi1_kpa"]', '3.8');
      await page.fill('input[id="roi1_area"]', '48.0');

      await calculateControl(page).click();


      await expectResult(page, 'Area-weighted Mean (kPa)', '3.80');
      await expectResult(page, 'Interpretation', /Advanced fibrosis.*≥F3.*likely/i);
    });

    test('F4 Cirrhosis - Single ROI', async ({ page }) => {
      // Test case: 5.2 kPa, 42 cm² → Mean = 5.2 kPa (F4)
      await page.fill('input[id="roi1_kpa"]', '5.2');
      await page.fill('input[id="roi1_area"]', '42.0');

      await calculateControl(page).click();


      await expectResult(page, 'Area-weighted Mean (kPa)', '5.20');
      await expectResult(page, 'Interpretation', /Cirrhosis.*F4.*likely/i);
    });
  });

  test.describe('MRE Calculations - Multiple ROIs', () => {

    test('Area-weighted mean with 3 ROIs (normal range)', async ({ page }) => {
      // Test case:
      // ROI 1: 2.5 kPa, 50 cm²
      // ROI 2: 2.3 kPa, 45 cm²
      // ROI 3: 2.7 kPa, 40 cm²
      // Expected mean: (2.5*50 + 2.3*45 + 2.7*40) / (50+45+40) = 336.5 / 135 = 2.49 kPa

      await page.fill('input[id="roi1_kpa"]', '2.5');
      await page.fill('input[id="roi1_area"]', '50.0');
      await page.fill('input[id="roi2_kpa"]', '2.3');
      await page.fill('input[id="roi2_area"]', '45.0');
      await page.fill('input[id="roi3_kpa"]', '2.7');
      await page.fill('input[id="roi3_area"]', '40.0');

      await calculateControl(page).click();


      await expectResult(page, 'Total Area (cm²)', '135.00');
      await expectResult(page, 'Area-weighted Mean (kPa)', '2.49');
      await expectResult(page, 'ROIs Used', '3 valid ROIs');
    });

    test('Area-weighted mean with 4 ROIs (F2 range)', async ({ page }) => {
      // Test case:
      // ROI 1: 3.2 kPa, 55 cm²
      // ROI 2: 3.4 kPa, 48 cm²
      // ROI 3: 3.1 kPa, 52 cm²
      // ROI 4: 3.5 kPa, 50 cm²
      // Expected mean: (3.2*55 + 3.4*48 + 3.1*52 + 3.5*50) / (55+48+52+50) = 675.4 / 205 = 3.29 kPa

      await page.fill('input[id="roi1_kpa"]', '3.2');
      await page.fill('input[id="roi1_area"]', '55.0');
      await page.fill('input[id="roi2_kpa"]', '3.4');
      await page.fill('input[id="roi2_area"]', '48.0');
      await page.fill('input[id="roi3_kpa"]', '3.1');
      await page.fill('input[id="roi3_area"]', '52.0');
      await page.fill('input[id="roi4_kpa"]', '3.5');
      await page.fill('input[id="roi4_area"]', '50.0');

      await calculateControl(page).click();


      await expectResult(page, 'Total Area (cm²)', '205.00');
      await expectResult(page, 'Area-weighted Mean (kPa)', '3.29');
      await expectResult(page, 'ROIs Used', '4 valid ROIs');
      await expectResult(page, 'Interpretation', /≥F2 fibrosis likely/i);
    });

    test('Area-weighted averaging via CSV input', async ({ page }) => {
      const csvInput = page.getByLabel('Paste ROI CSV (kPa,Area per line)');
      const csvData = '2.8, 50\n3.2, 45\n3.6, 40';
      // Expected: (2.8*50 + 3.2*45 + 3.6*40) / 135 = 428 / 135 = 3.17 kPa

      await csvInput.fill(csvData);
      await calculateControl(page).click();


      await expectResult(page, 'Total Area (cm²)', '135.00');
      await expectResult(page, 'Area-weighted Mean (kPa)', '3.17');
      await expectResult(page, 'ROIs Used', '3 valid ROIs');
    });

    test('Area-weighted averaging via dynamic rows', async ({ page }) => {
      // Add rows and fill values
      const addButton = addRoiButton(page);
      await addButton.click(); // Add 2nd row
      await addButton.click(); // Add 3rd row

      // Fill dynamic rows
      const row1Kpa = page.locator('input[aria-label="ROI 1 stiffness in kPa"]');
      const row1Area = page.locator('input[aria-label="ROI 1 area in cm²"]');
      const row2Kpa = page.locator('input[aria-label="ROI 2 stiffness in kPa"]');
      const row2Area = page.locator('input[aria-label="ROI 2 area in cm²"]');
      const row3Kpa = page.locator('input[aria-label="ROI 3 stiffness in kPa"]');
      const row3Area = page.locator('input[aria-label="ROI 3 area in cm²"]');

      await row1Kpa.fill('4.2');
      await row1Area.fill('50.0');
      await row2Kpa.fill('4.5');
      await row2Area.fill('48.0');
      await row3Kpa.fill('3.9');
      await row3Area.fill('52.0');

      // Expected: (4.2*50 + 4.5*48 + 3.9*52) / 150 = 628.8 / 150 = 4.19 kPa

      await calculateControl(page).click();


      await expectResult(page, 'Total Area (cm²)', '150.00');
      await expectResult(page, 'Area-weighted Mean (kPa)', '4.19');
      await expectResult(page, 'Interpretation', /Cirrhosis.*F4.*likely/i);
    });
  });

  test.describe('Frequency-Adjusted Interpretation', () => {

    test('40 Hz frequency adjustment', async ({ page }) => {
      const frequencySelect = page.getByLabel('Driver frequency (Hz)');
      await frequencySelect.selectOption('40');

      // Enter ROI at 60 Hz F2 threshold
      await page.fill('input[id="roi1_kpa"]', '3.0');
      await page.fill('input[id="roi1_area"]', '50.0');

      await calculateControl(page).click();


      await expectResult(page, 'Frequency', '40 Hz');
      // Should adjust interpretation for 40 Hz
    });

    test('90 Hz frequency adjustment', async ({ page }) => {
      const frequencySelect = page.getByLabel('Driver frequency (Hz)');
      await frequencySelect.selectOption('90');

      await page.fill('input[id="roi1_kpa"]', '3.0');
      await page.fill('input[id="roi1_area"]', '50.0');

      await calculateControl(page).click();


      await expectResult(page, 'Frequency', '90 Hz');
    });

    test('Custom frequency input', async ({ page }) => {
      const frequencySelect = page.getByLabel('Driver frequency (Hz)');
      await frequencySelect.selectOption('Other');

      const customFreq = page.locator('input[id="frequency_other"]');
      await customFreq.fill('75');

      await page.fill('input[id="roi1_kpa"]', '3.5');
      await page.fill('input[id="roi1_area"]', '50.0');

      await calculateControl(page).click();


      await expectResult(page, 'Frequency', '75 Hz');
    });
  });

  test.describe('Edge Cases & Error Handling', () => {

    test('should handle zero area gracefully', async ({ page }) => {
      await page.fill('input[id="roi1_kpa"]', '3.0');
      await page.fill('input[id="roi1_area"]', '0');

      const calculateButton = calculateControl(page);
      // Should remain disabled or show error
      await expect(calculateButton).toBeDisabled();
    });

    test('should handle negative stiffness values', async ({ page }) => {
      const row1Kpa = page.locator('input[aria-label="ROI 1 stiffness in kPa"]');
      await row1Kpa.fill('-2.5');

      // Should show validation error
      await expect(row1Kpa).toHaveAttribute('aria-invalid', 'true');
    });

    test('should handle very small ROI areas', async ({ page }) => {
      // Very small but valid area
      await page.fill('input[id="roi1_kpa"]', '3.0');
      await page.fill('input[id="roi1_area"]', '0.1');

      await calculateControl(page).click();


      await expect(resultRow(page, 'Area-weighted Mean (kPa)')).toBeVisible();
    });

    test('should handle very high stiffness values', async ({ page }) => {
      // Severe cirrhosis: 10 kPa
      await page.fill('input[id="roi1_kpa"]', '10.0');
      await page.fill('input[id="roi1_area"]', '50.0');

      await calculateControl(page).click();


      await expectResult(page, 'Area-weighted Mean (kPa)', '10.00');
      await expectResult(page, 'Interpretation', /Cirrhosis.*F4.*likely/i);
    });

    test('should filter out invalid rows in CSV', async ({ page }) => {
      const csvInput = page.getByLabel('Paste ROI CSV (kPa,Area per line)');
      // Mix of valid and invalid rows
      const csvData = '2.8, 50\ninvalid, text\n3.2, 45\n, \n3.6, 40';

      await csvInput.fill(csvData);
      await calculateControl(page).click();


      // Should only count 3 valid ROIs
      await expectResult(page, 'ROIs Used', '3 valid ROIs');
    });

    test('should handle decimal precision correctly', async ({ page }) => {
      await page.fill('input[id="roi1_kpa"]', '3.456789');
      await page.fill('input[id="roi1_area"]', '50.123456');

      await calculateControl(page).click();


      // Should display with 2 decimal precision
      await expectResult(page, 'Area-weighted Mean (kPa)', '3.46');
      await expectResult(page, 'Total Area (cm²)', '50.12');
    });
  });

  test.describe('Combined Input Methods', () => {

    test('should combine fields, CSV, and dynamic rows', async ({ page }) => {
      // Add value to field
      await page.fill('input[id="roi1_kpa"]', '2.8');
      await page.fill('input[id="roi1_area"]', '50.0');

      // Add CSV
      const csvInput = page.getByLabel('Paste ROI CSV (kPa,Area per line)');
      await csvInput.fill('3.2, 45');

      // Add dynamic row
      const row1Kpa = page.locator('input[aria-label="ROI 1 stiffness in kPa"]');
      const row1Area = page.locator('input[aria-label="ROI 1 area in cm²"]');
      await row1Kpa.fill('3.6');
      await row1Area.fill('40.0');

      await calculateControl(page).click();


      // Should combine all three inputs (3 ROIs total)
      await expectResult(page, 'ROIs Used', '3 valid ROIs');
      await expectResult(page, 'Total Area (cm²)', '135.00');
    });

    test('should prioritize valid inputs from all sources', async ({ page }) => {
      // Mix valid and invalid from different sources
      await page.fill('input[id="roi1_kpa"]', ''); // Empty
      await page.fill('input[id="roi1_area"]', '');

      await page.fill('input[id="roi2_kpa"]', '3.0'); // Valid
      await page.fill('input[id="roi2_area"]', '50.0');

      const csvInput = page.getByLabel('Paste ROI CSV (kPa,Area per line)');
      await csvInput.fill('3.5, 45'); // Valid

      await calculateControl(page).click();


      // Should count only 2 valid ROIs
      await expectResult(page, 'ROIs Used', '2 valid ROIs');
    });
  });

  test.describe('Clinical Context & User Guidance', () => {

    test('should display formula in results', async ({ page }) => {
      await page.fill('input[id="roi1_kpa"]', '3.0');
      await page.fill('input[id="roi1_area"]', '50.0');

      await calculateControl(page).click();


      await expectResult(page, 'Formula', /Σ.*Mi.*Ai/i);
    });

    test('should display clinical notes about variability', async ({ page }) => {
      await page.fill('input[id="roi1_kpa"]', '3.5');
      await page.fill('input[id="roi1_area"]', '50.0');

      await calculateControl(page).click();


      await expectResult(
        page,
        'Notes',
        /Cutoffs vary|vendor|frequency|correlate clinically/i,
      );
    });

    test('should provide guidance for each fibrosis stage', async ({ page }) => {
      // Test normal
      await page.fill('input[id="roi1_kpa"]', '2.0');
      await page.fill('input[id="roi1_area"]', '50.0');
      await calculateControl(page).click();

      await expectResult(page, 'Interpretation', /no significant fibrosis/i);

      // Clear and test F2
      await page.fill('input[id="roi1_kpa"]', '3.3');
      await calculateControl(page).click();

      await expectResult(page, 'Interpretation', /≥F2 fibrosis likely/i);

      // Clear and test F4
      await page.fill('input[id="roi1_kpa"]', '5.0');
      await calculateControl(page).click();

      await expectResult(page, 'Interpretation', /Cirrhosis.*likely/i);
    });
  });

  test.describe('References & Citations', () => {

    test('should display all reference citations', async ({ page }) => {
      // Scroll to bottom to see references
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      // Check for Manduca et al. 2020 (primary reference)
      await expect(
        page.getByRole('link', { name: /Manduca.*2020/i }),
      ).toBeVisible();

      // Check for Mariappan review
      await expect(
        page.getByRole('link', { name: /Mariappan.*2010/i }),
      ).toBeVisible();

      // Check for Resoundant reference
      await expect(page.getByRole('link', { name: /Resoundant/i })).toBeVisible();
    });

    test('should have working reference links', async ({ page }) => {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      // Find PMC links
      const pmcLinks = page.locator('a[href*="pmc.ncbi.nlm.nih.gov"]');
      const linkCount = await pmcLinks.count();
      expect(linkCount).toBeGreaterThan(0);

      // Check first link has valid href
      if (linkCount > 0) {
        const firstLink = pmcLinks.first();
        const href = await firstLink.getAttribute('href');
        expect(href).toContain('pmc.ncbi.nlm.nih.gov');

        // Verify link opens in new tab
        const target = await firstLink.getAttribute('target');
        if (target) {
          expect(target).toBe('_blank');
        }
      }
    });
  });

  test.describe('Accessibility', () => {

    test('should have proper labels for all inputs', async ({ page }) => {
      await expect(page.getByLabel('Driver frequency (Hz)')).toBeVisible();
      await expect(page.getByLabel('ROI 1 - Stiffness (kPa)')).toBeVisible();
      await expect(page.getByLabel('ROI 1 - Area (cm²)')).toBeVisible();
    });

    test('should have aria-labels on dynamic row inputs', async ({ page }) => {
      const kpaInput = page.locator('input[aria-label="ROI 1 stiffness in kPa"]');
      const areaInput = page.locator('input[aria-label="ROI 1 area in cm²"]');

      await expect(kpaInput).toBeVisible();
      await expect(areaInput).toBeVisible();
    });

    test('should mark invalid inputs with aria-invalid', async ({ page }) => {
      const row1Kpa = page.locator('input[aria-label="ROI 1 stiffness in kPa"]');
      await row1Kpa.fill('-5');

      await expect(row1Kpa).toHaveAttribute('aria-invalid', 'true');
    });

    test('should be keyboard navigable', async ({ page }) => {
      // Tab through form elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Should be able to focus inputs
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });

    test('should announce results to screen readers', async ({ page }) => {
      await page.fill('input[id="roi1_kpa"]', '3.0');
      await page.fill('input[id="roi1_area"]', '50.0');
      await calculateControl(page).click();


      // Results section should have aria-live
      const results = resultsSection(page);
      await expect(results).toBeVisible();
    });
  });

  test.describe('Formula Accuracy Verification', () => {

    test('should calculate area-weighted mean correctly - 2 ROIs', async ({ page }) => {
      // Manual calculation:
      // ROI 1: 2.5 kPa × 60 cm² = 150
      // ROI 2: 3.5 kPa × 40 cm² = 140
      // Total: (150 + 140) / (60 + 40) = 290 / 100 = 2.90 kPa

      await page.fill('input[id="roi1_kpa"]', '2.5');
      await page.fill('input[id="roi1_area"]', '60.0');
      await page.fill('input[id="roi2_kpa"]', '3.5');
      await page.fill('input[id="roi2_area"]', '40.0');

      await calculateControl(page).click();


      await expectResult(page, 'Total Area (cm²)', '100.00');
      await expectResult(page, 'Area-weighted Mean (kPa)', '2.90');
    });

    test('should calculate area-weighted mean correctly - 5 ROIs', async ({ page }) => {
      // Use CSV for easier 5 ROI input
      // Manual calculation:
      // 2.0*30 + 2.5*35 + 3.0*40 + 3.5*25 + 4.0*20 = 60+87.5+120+87.5+80 = 435
      // Total area: 30+35+40+25+20 = 150
      // Mean: 435 / 150 = 2.90 kPa

      const csvInput = page.getByLabel('Paste ROI CSV (kPa,Area per line)');
      await csvInput.fill('2.0, 30\n2.5, 35\n3.0, 40\n3.5, 25\n4.0, 20');

      await calculateControl(page).click();


      await expectResult(page, 'Total Area (cm²)', '150.00');
      await expectResult(page, 'Area-weighted Mean (kPa)', '2.90');
      await expectResult(page, 'ROIs Used', '5 valid ROIs');
    });

    test('should verify area-weighting vs simple average', async ({ page }) => {
      // Demonstrate that area-weighting matters:
      // ROI 1: 2.0 kPa × 90 cm² = 180
      // ROI 2: 5.0 kPa × 10 cm² = 50
      // Area-weighted mean: 230 / 100 = 2.30 kPa
      // Simple average would be: (2.0 + 5.0) / 2 = 3.5 kPa
      // This shows the calculator properly weights by area

      await page.fill('input[id="roi1_kpa"]', '2.0');
      await page.fill('input[id="roi1_area"]', '90.0');
      await page.fill('input[id="roi2_kpa"]', '5.0');
      await page.fill('input[id="roi2_area"]', '10.0');

      await calculateControl(page).click();


      // Should be 2.30, not 3.50
      await expectResult(page, 'Area-weighted Mean (kPa)', '2.30');
      // Should NOT show 3.5
      await expect(resultRow(page, 'Area-weighted Mean (kPa)')).not.toContainText(
        /3\.5/,
      );
    });
  });

  test.describe('Multi-Row Table UI', () => {

    test('should display table with proper column headers', async ({ page }) => {
      // Check all three column headers
      const table = dynamicRoiTable(page);
      await expect(table.getByText('Slice / ROI', { exact: true })).toBeVisible();
      await expect(
        table.getByText('Stiffness (kPa)', { exact: true }),
      ).toBeVisible();
      await expect(table.getByText('ROI Area', { exact: true })).toBeVisible();
    });

    test('should maintain table layout with multiple rows', async ({ page }) => {
      const addButton = addRoiButton(page);

      // Add multiple rows
      for (let i = 0; i < 5; i++) {
        await addButton.click();
      }

      // Check all row numbers are visible
      for (let i = 1; i <= 6; i++) {
        await expect(roiNumber(page, i)).toBeVisible();
      }
    });

    test('should show helpful tip text above table', async ({ page }) => {
      await expect(dynamicRoiTable(page)).toContainText(
        /paste multiple pairs.*CSV.*add rows here/i,
      );
    });

    test('should have placeholder text in dynamic row inputs', async ({ page }) => {
      const kpaInput = page.locator('input[aria-label="ROI 1 stiffness in kPa"]');
      const placeholder = await kpaInput.getAttribute('placeholder');
      expect(placeholder).toBeTruthy();
    });
  });
});
