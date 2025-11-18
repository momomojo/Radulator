import { test, expect } from '@playwright/test';
import {
  navigateToCalculator,
  fillInput,
  selectOption,
  verifyReferenceLinks,
  verifyThemeConsistency,
  verifyMobileResponsive,
  takeScreenshot,
} from '../../../helpers/calculator-test-helper.js';

/**
 * AVS Cortisol (Cushing) Calculator E2E Tests
 *
 * Tests for the Adrenal Vein Sampling - Cortisol calculator
 * which provides comprehensive cortisol lateralization analysis
 * for ACTH-independent hypercortisolism.
 *
 * References:
 * - Acharya R et al. World J Surg 2019;43(2):527-533
 * - Young WF et al. World J Surg 2008;32(5):856-62
 */

test.describe('AVS Cortisol Calculator', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, 'AVS – Cortisol (Cushing)');

    // Wait for calculator to fully load
    await expect(page.locator('h3:has-text("Patient Information")')).toBeVisible();
  });

  test('should load calculator with all required sections', async ({ page }) => {
    // Verify all major sections are present
    await expect(page.locator('h3:has-text("Patient Information")')).toBeVisible();
    await expect(page.locator('h3:has-text("Laboratory Units")')).toBeVisible();
    await expect(page.locator('h3:has-text("Peripheral (IVC) Measurements")')).toBeVisible();
    await expect(page.locator('h3:has-text("Left Adrenal Vein Samples")')).toBeVisible();
    await expect(page.locator('h3:has-text("Right Adrenal Vein Samples")')).toBeVisible();

    // Verify calculate button is present
    await expect(page.locator('button:has-text("Calculate")')).toBeVisible();
  });

  test('should have correct patient metadata fields', async ({ page }) => {
    // Verify patient information fields
    await expect(page.locator('label:has-text("Patient Initials")')).toBeVisible();
    await expect(page.locator('label:has-text("Date of Procedure")')).toBeVisible();
    await expect(page.locator('label:has-text("Side of Nodule")')).toBeVisible();

    // Verify side of nodule dropdown has options
    const sideSelect = page.locator('label:has-text("Side of Nodule") ~ select').first();
    await expect(sideSelect).toBeVisible();

    const options = await sideSelect.locator('option').allTextContents();
    expect(options).toContain('Left');
    expect(options).toContain('Right');
    expect(options).toContain('Bilateral');
  });

  test('should have unit selection for cortisol', async ({ page }) => {
    const cortUnitsSelect = page.locator('label:has-text("Cortisol Units") ~ select').first();
    await expect(cortUnitsSelect).toBeVisible();

    const options = await cortUnitsSelect.locator('option').allTextContents();
    expect(options.some(opt => opt.includes('µg/dL'))).toBeTruthy();
    expect(options.some(opt => opt.includes('nmol/L'))).toBeTruthy();

    // Verify conversion factor is displayed
    await expect(page.locator('text=1 µg/dL = 27.59 nmol/L')).toBeVisible();
  });

  test('should support multiple left adrenal vein samples (up to 2)', async ({ page }) => {
    // Should start with 1 sample
    const initialSamples = await page.locator('label:has-text("Time Drawn")').count();
    expect(initialSamples).toBeGreaterThanOrEqual(1);

    // Add left sample button should be visible
    const addLeftButton = page.locator('button:has-text("+ Add Left Sample")');
    await expect(addLeftButton).toBeVisible();

    // Click to add second sample
    await addLeftButton.click();

    // Should now have more time fields
    const samplesAfterAdd = await page.locator('label:has-text("Time Drawn")').count();
    expect(samplesAfterAdd).toBeGreaterThan(initialSamples);

    // Button should be disabled at 2 samples (but we need to check in the left section)
    await addLeftButton.click();
    await expect(addLeftButton).toBeDisabled();
  });

  test('should support multiple right adrenal vein samples (up to 4)', async ({ page }) => {
    const addRightButton = page.locator('button:has-text("+ Add Right Sample")');
    await expect(addRightButton).toBeVisible();

    // Add samples until limit
    for (let i = 0; i < 3; i++) {
      if (await addRightButton.isEnabled()) {
        await addRightButton.click();
        await page.waitForTimeout(200);
      }
    }

    // Should be disabled at 4 samples
    await expect(addRightButton).toBeDisabled();
  });

  test('should calculate unilateral left adrenal adenoma (Test Case 1)', async ({ page }) => {
    // Patient metadata
    await fillInput(page, 'Patient Initials', 'TC1');
    await page.locator('input[type="date"]').first().fill('2024-01-15');
    await selectOption(page, 'Side of Nodule', 'Left');

    // IVC measurements (µg/dL)
    await page.locator('label:has-text("Infrarenal IVC Cortisol") ~ input').first().fill('15');
    await page.locator('label:has-text("Infrarenal IVC Epinephrine") ~ input').first().fill('50');

    // Left adrenal vein sample (successful cannulation)
    const leftCortInputs = page.locator('text="Left Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Cortisol") ~ input');
    const leftEpiInputs = page.locator('text="Left Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Epinephrine") ~ input');

    await leftCortInputs.first().fill('120'); // 120 µg/dL (AV/PV = 8.0)
    await leftEpiInputs.first().fill('250');  // Delta = 200 pg/mL (>100)

    // Right adrenal vein sample (successful cannulation, suppressed)
    const rightCortInputs = page.locator('text="Right Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Cortisol") ~ input');
    const rightEpiInputs = page.locator('text="Right Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Epinephrine") ~ input');

    await rightCortInputs.first().fill('30');  // 30 µg/dL (AV/PV = 2.0)
    await rightEpiInputs.first().fill('200');  // Delta = 150 pg/mL (>100)

    // Calculate
    await page.locator('button:has-text("Calculate")').click();

    // Wait for results
    await page.waitForTimeout(500);

    // Verify cannulation success
    await expect(page.locator('text=Left Adrenal')).toBeVisible();
    await expect(page.locator('text=✓ Successful').first()).toBeVisible();
    await expect(page.locator('text=Right Adrenal')).toBeVisible();
    await expect(page.locator('text=✓ Successful').nth(1)).toBeVisible();

    // Verify AV/PV ratios
    const resultsText = await page.locator('text=Left AV/PV Cortisol Ratio').textContent();
    expect(resultsText).toContain('8.000'); // 120/15

    const rightRatioText = await page.locator('text=Right AV/PV Cortisol Ratio').textContent();
    expect(rightRatioText).toContain('2.000'); // 30/15

    // Verify CLR
    const clrText = await page.locator('text=CLR').textContent();
    expect(clrText).toContain('4.000'); // 8.0/2.0

    // Verify interpretation
    const interpretation = page.locator('text=Unilateral cortisol-secreting adenoma on LEFT side');
    await expect(interpretation).toBeVisible();
  });

  test('should calculate unilateral right adrenal adenoma (Test Case 2)', async ({ page }) => {
    // Patient metadata
    await fillInput(page, 'Patient Initials', 'TC2');
    await page.locator('input[type="date"]').first().fill('2024-02-20');
    await selectOption(page, 'Side of Nodule', 'Right');

    // IVC measurements
    await page.locator('label:has-text("Infrarenal IVC Cortisol") ~ input').first().fill('12');
    await page.locator('label:has-text("Infrarenal IVC Epinephrine") ~ input').first().fill('40');

    // Left adrenal vein sample (suppressed)
    const leftCortInputs = page.locator('text="Left Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Cortisol") ~ input');
    const leftEpiInputs = page.locator('text="Left Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Epinephrine") ~ input');

    await leftCortInputs.first().fill('25');  // AV/PV = 2.08
    await leftEpiInputs.first().fill('180');  // Delta = 140 (>100)

    // Right adrenal vein sample (autonomous)
    const rightCortInputs = page.locator('text="Right Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Cortisol") ~ input');
    const rightEpiInputs = page.locator('text="Right Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Epinephrine") ~ input');

    await rightCortInputs.first().fill('100'); // AV/PV = 8.33
    await rightEpiInputs.first().fill('220');  // Delta = 180 (>100)

    // Calculate
    await page.locator('button:has-text("Calculate")').click();
    await page.waitForTimeout(500);

    // Verify interpretation
    const interpretation = page.locator('text=Unilateral cortisol-secreting adenoma on RIGHT side');
    await expect(interpretation).toBeVisible();

    // Verify dominant side
    const dominantText = await page.locator('text=Dominant Side').textContent();
    expect(dominantText).toContain('RIGHT');
  });

  test('should detect bilateral cortisol hypersecretion (Test Case 3)', async ({ page }) => {
    // Patient metadata
    await fillInput(page, 'Patient Initials', 'TC3');
    await selectOption(page, 'Side of Nodule', 'Bilateral');

    // IVC measurements
    await page.locator('label:has-text("Infrarenal IVC Cortisol") ~ input').first().fill('10');
    await page.locator('label:has-text("Infrarenal IVC Epinephrine") ~ input').first().fill('30');

    // Left adrenal vein sample (elevated)
    const leftCortInputs = page.locator('text="Left Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Cortisol") ~ input');
    const leftEpiInputs = page.locator('text="Left Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Epinephrine") ~ input');

    await leftCortInputs.first().fill('80');  // AV/PV = 8.0
    await leftEpiInputs.first().fill('200');  // Delta = 170 (>100)

    // Right adrenal vein sample (also elevated)
    const rightCortInputs = page.locator('text="Right Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Cortisol") ~ input');
    const rightEpiInputs = page.locator('text="Right Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Epinephrine") ~ input');

    await rightCortInputs.first().fill('70');  // AV/PV = 7.0
    await rightEpiInputs.first().fill('190');  // Delta = 160 (>100)

    // Calculate
    await page.locator('button:has-text("Calculate")').click();
    await page.waitForTimeout(500);

    // Verify CLR suggests bilateral disease (CLR ≤2)
    const clrText = await page.locator('text=CLR').textContent();
    const clrMatch = clrText.match(/(\d+\.\d+)/);
    if (clrMatch) {
      const clrValue = parseFloat(clrMatch[1]);
      expect(clrValue).toBeLessThanOrEqual(2.0);
    }

    // Verify interpretation mentions bilateral
    const interpretation = await page.locator('.bg-blue-50').last().textContent();
    expect(interpretation.toLowerCase()).toContain('bilateral');
  });

  test('should detect failed cannulation when epinephrine delta <100 (Test Case 4)', async ({ page }) => {
    // Patient metadata
    await fillInput(page, 'Patient Initials', 'TC4');

    // IVC measurements
    await page.locator('label:has-text("Infrarenal IVC Cortisol") ~ input').first().fill('15');
    await page.locator('label:has-text("Infrarenal IVC Epinephrine") ~ input').first().fill('50');

    // Left adrenal vein sample (FAILED cannulation - low epi delta)
    const leftCortInputs = page.locator('text="Left Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Cortisol") ~ input');
    const leftEpiInputs = page.locator('text="Left Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Epinephrine") ~ input');

    await leftCortInputs.first().fill('100');
    await leftEpiInputs.first().fill('120');  // Delta = 70 (<100) - FAILED

    // Right adrenal vein sample (successful)
    const rightCortInputs = page.locator('text="Right Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Cortisol") ~ input');
    const rightEpiInputs = page.locator('text="Right Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Epinephrine") ~ input');

    await rightCortInputs.first().fill('80');
    await rightEpiInputs.first().fill('200');  // Delta = 150 (>100) - SUCCESS

    // Calculate
    await page.locator('button:has-text("Calculate")').click();
    await page.waitForTimeout(500);

    // Verify left cannulation failed
    const leftStatus = page.locator('text=Left Adrenal').locator('..').locator('text=✗ Failed');
    await expect(leftStatus).toBeVisible();

    // Verify right cannulation succeeded
    const rightStatus = page.locator('text=Right Adrenal').locator('..').locator('text=✓ Successful');
    await expect(rightStatus).toBeVisible();

    // Verify warning in interpretation
    const interpretation = await page.locator('.bg-blue-50').last().textContent();
    expect(interpretation).toContain('⚠️');
    expect(interpretation.toLowerCase()).toContain('cannulation');
    expect(interpretation.toLowerCase()).toContain('unsuccessful');
  });

  test('should support multi-sample averaging for left adrenal vein', async ({ page }) => {
    // Add second left sample
    const addLeftButton = page.locator('button:has-text("+ Add Left Sample")');
    await addLeftButton.click();
    await page.waitForTimeout(200);

    // IVC measurements
    await page.locator('label:has-text("Infrarenal IVC Cortisol") ~ input').first().fill('10');
    await page.locator('label:has-text("Infrarenal IVC Epinephrine") ~ input').first().fill('40');

    // Left adrenal vein samples (2 samples)
    const leftSection = page.locator('text="Left Adrenal Vein Samples" ~ div').first();
    const leftCortInputs = leftSection.locator('label:has-text("Cortisol") ~ input');
    const leftEpiInputs = leftSection.locator('label:has-text("Epinephrine") ~ input');

    // Sample 1: Cortisol = 100, Epi = 200
    await leftCortInputs.nth(0).fill('100');
    await leftEpiInputs.nth(0).fill('200');

    // Sample 2: Cortisol = 120, Epi = 220
    await leftCortInputs.nth(1).fill('120');
    await leftEpiInputs.nth(1).fill('220');

    // Right adrenal vein sample
    const rightCortInputs = page.locator('text="Right Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Cortisol") ~ input');
    const rightEpiInputs = page.locator('text="Right Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Epinephrine") ~ input');

    await rightCortInputs.first().fill('30');
    await rightEpiInputs.first().fill('180');

    // Calculate
    await page.locator('button:has-text("Calculate")').click();
    await page.waitForTimeout(500);

    // Verify both samples were successful
    await expect(page.locator('text=✓ Successful').first()).toBeVisible();

    // Average of 100 and 120 = 110, so AV/PV ratio should be 11.0
    const leftRatioText = await page.locator('text=Left AV/PV Cortisol Ratio').textContent();
    expect(leftRatioText).toContain('11.000');
  });

  test('should support cortisol unit conversion (nmol/L to µg/dL)', async ({ page }) => {
    // Change cortisol units to nmol/L
    const cortUnitsSelect = page.locator('label:has-text("Cortisol Units") ~ select').first();
    await cortUnitsSelect.selectOption('nmol/L');

    // Enter values in nmol/L (conversion: 1 µg/dL = 27.59 nmol/L)
    // 15 µg/dL = 413.85 nmol/L
    await page.locator('label:has-text("Infrarenal IVC Cortisol") ~ input').first().fill('413.85');
    await page.locator('label:has-text("Infrarenal IVC Epinephrine") ~ input').first().fill('50');

    // Left: 120 µg/dL = 3310.8 nmol/L
    const leftCortInputs = page.locator('text="Left Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Cortisol") ~ input');
    const leftEpiInputs = page.locator('text="Left Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Epinephrine") ~ input');

    await leftCortInputs.first().fill('3310.8');
    await leftEpiInputs.first().fill('200');

    // Right: 30 µg/dL = 827.7 nmol/L
    const rightCortInputs = page.locator('text="Right Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Cortisol") ~ input');
    const rightEpiInputs = page.locator('text="Right Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Epinephrine") ~ input');

    await rightCortInputs.first().fill('827.7');
    await rightEpiInputs.first().fill('180');

    // Calculate
    await page.locator('button:has-text("Calculate")').click();
    await page.waitForTimeout(500);

    // Ratios should be the same as µg/dL test case (8.0 and 2.0)
    const leftRatioText = await page.locator('text=Left AV/PV Cortisol Ratio').textContent();
    expect(leftRatioText).toContain('8.0');

    const rightRatioText = await page.locator('text=Right AV/PV Cortisol Ratio').textContent();
    expect(rightRatioText).toContain('2.0');
  });

  test('should prefer suprarenal IVC over infrarenal when both provided', async ({ page }) => {
    // Provide both infrarenal and suprarenal IVC values
    await page.locator('label:has-text("Infrarenal IVC Cortisol") ~ input').first().fill('10');
    await page.locator('label:has-text("Infrarenal IVC Epinephrine") ~ input').first().fill('40');

    await page.locator('label:has-text("Suprarenal IVC Cortisol") ~ input').first().fill('15');
    await page.locator('label:has-text("Suprarenal IVC Epinephrine") ~ input').first().fill('50');

    // Left adrenal vein
    const leftCortInputs = page.locator('text="Left Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Cortisol") ~ input');
    const leftEpiInputs = page.locator('text="Left Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Epinephrine") ~ input');

    await leftCortInputs.first().fill('120');
    await leftEpiInputs.first().fill('200');

    // Right adrenal vein
    const rightCortInputs = page.locator('text="Right Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Cortisol") ~ input');
    const rightEpiInputs = page.locator('text="Right Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Epinephrine") ~ input');

    await rightCortInputs.first().fill('30');
    await rightEpiInputs.first().fill('180');

    // Calculate
    await page.locator('button:has-text("Calculate")').click();
    await page.waitForTimeout(500);

    // Left AV/PV ratio should be 120/15 = 8.0 (using suprarenal, not infrarenal)
    const leftRatioText = await page.locator('text=Left AV/PV Cortisol Ratio').textContent();
    expect(leftRatioText).toContain('8.000');
  });

  test('should display CSV download button after calculation', async ({ page }) => {
    // Fill minimal data
    await page.locator('label:has-text("Infrarenal IVC Cortisol") ~ input').first().fill('15');
    await page.locator('label:has-text("Infrarenal IVC Epinephrine") ~ input').first().fill('50');

    const leftCortInputs = page.locator('text="Left Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Cortisol") ~ input');
    const leftEpiInputs = page.locator('text="Left Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Epinephrine") ~ input');

    await leftCortInputs.first().fill('100');
    await leftEpiInputs.first().fill('200');

    const rightCortInputs = page.locator('text="Right Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Cortisol") ~ input');
    const rightEpiInputs = page.locator('text="Right Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Epinephrine") ~ input');

    await rightCortInputs.first().fill('30');
    await rightEpiInputs.first().fill('180');

    // Calculate
    await page.locator('button:has-text("Calculate")').click();
    await page.waitForTimeout(500);

    // Verify CSV download button appears
    const downloadButton = page.locator('button:has-text("Download Results as CSV")');
    await expect(downloadButton).toBeVisible();
    await expect(downloadButton).toBeEnabled();
  });

  test('should show error when insufficient data provided', async ({ page }) => {
    // Click calculate without filling required fields
    await page.locator('button:has-text("Calculate")').click();
    await page.waitForTimeout(300);

    // Should show error message
    const errorMessage = page.locator('text=Insufficient data');
    await expect(errorMessage).toBeVisible();
  });

  test('should allow removal of samples (except when only one remains)', async ({ page }) => {
    // Add a second left sample
    await page.locator('button:has-text("+ Add Left Sample")').click();
    await page.waitForTimeout(200);

    // Remove button should be enabled
    const removeButtons = page.locator('button:has-text("Remove")');
    const firstRemoveButton = removeButtons.first();
    await expect(firstRemoveButton).toBeEnabled();

    // Click to remove second sample
    await removeButtons.nth(1).click();
    await page.waitForTimeout(200);

    // When only 1 sample remains, remove should be disabled
    const remainingRemoveButton = page.locator('button:has-text("Remove")').first();
    await expect(remainingRemoveButton).toBeDisabled();
  });

  test('should verify all reference links are accessible', async ({ page }) => {
    // Scroll to references section (at bottom of calculator)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Verify reference links
    const brokenLinks = await verifyReferenceLinks(page);

    // All reference links should be valid
    expect(brokenLinks.length).toBe(0);

    // Verify specific DOI links are present
    const acharyaLink = page.locator('a[href*="10.1007/s00268-018-4788-2"]');
    await expect(acharyaLink).toBeVisible();

    const youngLink = page.locator('a[href*="10.1007/s00268-007-9040-y"]');
    await expect(youngLink).toBeVisible();
  });

  test('should have consistent theme styling', async ({ page }) => {
    await verifyThemeConsistency(page);

    // Verify specific AVS Cortisol styling elements
    const patientInfoSection = page.locator('.bg-blue-50').first();
    await expect(patientInfoSection).toBeVisible();

    // Verify border and rounded corners
    const hasRoundedBorders = await patientInfoSection.evaluate(el =>
      el.className.includes('border') && el.className.includes('rounded')
    );
    expect(hasRoundedBorders).toBeTruthy();
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    await verifyMobileResponsive(page);

    // Verify grid layout adapts on mobile
    await page.setViewportSize({ width: 375, height: 667 });

    // Patient info grid should stack on mobile
    const patientInfoGrid = page.locator('.grid').first();
    const gridClasses = await patientInfoGrid.getAttribute('class');

    // Should have md:grid-cols-3 but single column on mobile
    expect(gridClasses).toContain('grid');
  });

  test('should display interpretation based on Young et al. criteria', async ({ page }) => {
    // Test interpretation for classic unilateral adenoma
    await page.locator('label:has-text("Infrarenal IVC Cortisol") ~ input').first().fill('10');
    await page.locator('label:has-text("Infrarenal IVC Epinephrine") ~ input').first().fill('40');

    // Left: AV/PV = 7.0 (>6.5)
    const leftCortInputs = page.locator('text="Left Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Cortisol") ~ input');
    const leftEpiInputs = page.locator('text="Left Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Epinephrine") ~ input');

    await leftCortInputs.first().fill('70');
    await leftEpiInputs.first().fill('200');

    // Right: AV/PV = 3.0 (≤3.3)
    const rightCortInputs = page.locator('text="Right Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Cortisol") ~ input');
    const rightEpiInputs = page.locator('text="Right Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Epinephrine") ~ input');

    await rightCortInputs.first().fill('30');
    await rightEpiInputs.first().fill('180');

    // Calculate
    await page.locator('button:has-text("Calculate")').click();
    await page.waitForTimeout(500);

    // Interpretation should reference Young criteria
    const interpretation = await page.locator('.bg-blue-50').last().textContent();
    expect(interpretation).toContain('Criteria met');
    expect(interpretation).toContain('>6.5');
    expect(interpretation).toContain('≤3.3');
    expect(interpretation).toContain('≥2.3'); // CLR criterion
  });

  test('should handle edge case: very high cortisol levels', async ({ page }) => {
    // Test with very high cortisol values
    await page.locator('label:has-text("Infrarenal IVC Cortisol") ~ input').first().fill('20');
    await page.locator('label:has-text("Infrarenal IVC Epinephrine") ~ input').first().fill('50');

    const leftCortInputs = page.locator('text="Left Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Cortisol") ~ input');
    const leftEpiInputs = page.locator('text="Left Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Epinephrine") ~ input');

    await leftCortInputs.first().fill('500'); // Very high
    await leftEpiInputs.first().fill('300');

    const rightCortInputs = page.locator('text="Right Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Cortisol") ~ input');
    const rightEpiInputs = page.locator('text="Right Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Epinephrine") ~ input');

    await rightCortInputs.first().fill('40');
    await rightEpiInputs.first().fill('200');

    // Calculate
    await page.locator('button:has-text("Calculate")').click();
    await page.waitForTimeout(500);

    // Should calculate successfully
    const leftRatioText = await page.locator('text=Left AV/PV Cortisol Ratio').textContent();
    expect(leftRatioText).toContain('25.000'); // 500/20
  });

  test('should handle edge case: minimal epinephrine gradient (exactly 100)', async ({ page }) => {
    await page.locator('label:has-text("Infrarenal IVC Cortisol") ~ input').first().fill('15');
    await page.locator('label:has-text("Infrarenal IVC Epinephrine") ~ input').first().fill('50');

    const leftCortInputs = page.locator('text="Left Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Cortisol") ~ input');
    const leftEpiInputs = page.locator('text="Left Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Epinephrine") ~ input');

    await leftCortInputs.first().fill('100');
    await leftEpiInputs.first().fill('150'); // Exactly 100 pg/mL above IVC (borderline)

    const rightCortInputs = page.locator('text="Right Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Cortisol") ~ input');
    const rightEpiInputs = page.locator('text="Right Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Epinephrine") ~ input');

    await rightCortInputs.first().fill('30');
    await rightEpiInputs.first().fill('200');

    // Calculate
    await page.locator('button:has-text("Calculate")').click();
    await page.waitForTimeout(500);

    // With delta exactly at 100, cannulation should FAIL (must be >100, not ≥100)
    const leftStatus = page.locator('text=Left Adrenal').locator('..').locator('text=✗ Failed');
    await expect(leftStatus).toBeVisible();
  });

  test('should take screenshot for documentation', async ({ page }) => {
    // Fill with example data
    await fillInput(page, 'Patient Initials', 'Example');
    await page.locator('input[type="date"]').first().fill('2024-01-15');
    await selectOption(page, 'Side of Nodule', 'Left');

    await page.locator('label:has-text("Infrarenal IVC Cortisol") ~ input').first().fill('15');
    await page.locator('label:has-text("Infrarenal IVC Epinephrine") ~ input').first().fill('50');

    const leftCortInputs = page.locator('text="Left Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Cortisol") ~ input');
    const leftEpiInputs = page.locator('text="Left Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Epinephrine") ~ input');

    await leftCortInputs.first().fill('120');
    await leftEpiInputs.first().fill('250');

    const rightCortInputs = page.locator('text="Right Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Cortisol") ~ input');
    const rightEpiInputs = page.locator('text="Right Adrenal Vein Samples" ~ div').first()
      .locator('label:has-text("Epinephrine") ~ input');

    await rightCortInputs.first().fill('30');
    await rightEpiInputs.first().fill('200');

    await page.locator('button:has-text("Calculate")').click();
    await page.waitForTimeout(500);

    // Take screenshot for documentation
    await takeScreenshot(page, 'avs-cortisol', 'full-example');
  });
});
