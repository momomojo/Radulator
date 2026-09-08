import { test, expect } from '@playwright/test';
import { navigateToCalculator } from '../../../helpers/calculator-test-helper.js';

const resultsRegion = (page) => page.getByRole('status', { name: 'Calculator results' });

async function expectResultText(page, expected) {
  const results = resultsRegion(page);
  await expect(results).toBeVisible();
  await expect(results).toContainText(expected);
}

async function expectAlbiGrade(page, grade) {
  const results = resultsRegion(page);
  await expect(results).toBeVisible();
  await expect(results.getByText(`Grade ${grade}`, { exact: true })).toBeVisible();
}

/**
 * ALBI Score Calculator E2E Tests
 *
 * Tests the Albumin-Bilirubin (ALBI) grade calculator for liver function assessment
 * Formula: (log₁₀ bilirubin [μmol/L] × 0.66) + (albumin [g/L] × −0.085)
 *
 * Grading:
 * - Grade 1: ≤ −2.60 (source-defined lowest-risk group)
 * - Grade 2: > −2.60 to ≤ −1.39 (Intermediate)
 * - Grade 3: > −1.39 (source-defined highest-risk group)
 *
 * Reference: Johnson et al. J Clin Oncol 2015;33(6):550-558
 */

test.describe('ALBI Score Calculator', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, 'ALBI Score');
    await expect(page.getByTestId('calculator-title').first()).toBeVisible();
  });

  test.describe('Visual Appeal & Theme Matching', () => {

    test('should display calculator with proper styling', async ({ page }) => {
      // Check calculator card is visible
      await expect(page.getByRole('main', { name: 'ALBI Score' })).toBeVisible();

      // Check title is visible and styled
      const title = page.getByTestId('calculator-title').first();
      await expect(title).toBeVisible();

      // Check description is present
      await expect(page.getByTestId('calculator-description')).toContainText('Albumin-Bilirubin grade');
    });

    test('should have responsive design on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Calculator should still be visible and usable
      await expect(page.getByTestId('calculator-title').first()).toBeVisible();

      // Fields should stack vertically on mobile
      const albumin = page.locator('label:has-text("Serum Albumin")');
      await expect(albumin).toBeVisible();
    });

    test('should display info section with proper styling', async ({ page }) => {
      await expect(page.getByText(/The original ALBI model provides/)).toBeVisible();
      await expect(page.getByText(/It is not a post-transplant outcome predictor/)).toBeVisible();
      await expect(page.getByRole('button', { name: /Open View Johnson et al/ })).toBeVisible();
    });
  });

  test.describe('Unit System Selection', () => {

    test('requires an explicit unit selection before calculation', async ({ page }) => {
      const siRadio = page.locator('input[type="radio"][value="SI"]');
      const usRadio = page.locator('input[type="radio"][value="US"]');
      await expect(siRadio).not.toBeChecked();
      await expect(usRadio).not.toBeChecked();
      await expect(page.getByRole('radiogroup', { name: 'Unit System' })).toHaveAttribute('aria-required', 'true');

      await page.locator('input[type="number"]').first().fill('40');
      await page.locator('input[type="number"]').nth(1).fill('10');
      await page.getByRole('button', { name: 'Calculate' }).click();
      await expectResultText(page, /select SI or US units before calculating/i);
    });

    test('should allow switching between SI and US units', async ({ page }) => {
      const siRadio = page.locator('input[type="radio"][value="SI"]');
      const usRadio = page.locator('input[type="radio"][value="US"]');

      // Check SI is available
      if (await siRadio.isVisible()) {
        await siRadio.check();
        await expect(siRadio).toBeChecked();
      }

      // Check US is available
      if (await usRadio.isVisible()) {
        await usRadio.check();
        await expect(usRadio).toBeChecked();
      }
    });

    test('clears a result when unit interpretation changes', async ({ page }) => {
      const siRadio = page.locator('input[type="radio"][value="SI"]');
      const usRadio = page.locator('input[type="radio"][value="US"]');
      await siRadio.check();
      await page.locator('input[type="number"]').first().fill('40');
      await page.locator('input[type="number"]').nth(1).fill('10');
      await page.getByRole('button', { name: 'Calculate' }).click();
      await expectResultText(page, /ALBI Score:\s*-2\.740/);

      await usRadio.check();
      await expect(resultsRegion(page)).toHaveCount(0);
      await expect(page.locator('input[type="number"]').first()).toHaveValue('40');
      await expect(page.locator('input[type="number"]').nth(1)).toHaveValue('10');
      await page.locator('input[type="number"]').first().fill('4');
      await page.locator('input[type="number"]').nth(1).fill('1');
      await page.getByRole('button', { name: 'Calculate' }).click();
      await expectResultText(page, /ALBI Score:\s*-2\.586/);
      await expectResultText(page, /Input Units:\s*US \(albumin g\/dL; bilirubin mg\/dL\)/);
    });
  });

  test.describe('Input Validation', () => {

    test('should accept valid albumin values', async ({ page }) => {
      const albuminInput = page.locator('input[type="number"]').first();
      await albuminInput.fill('35');
      await expect(albuminInput).toHaveValue('35');
    });

    test('should accept valid bilirubin values', async ({ page }) => {
      const inputs = page.locator('input[type="number"]');
      const bilirubinInput = inputs.nth(1);
      await bilirubinInput.fill('17');
      await expect(bilirubinInput).toHaveValue('17');
    });

    test('should reject negative values', async ({ page }) => {
      await page.locator('input[type="radio"][value="SI"]').check();
      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      // Try to enter negative values
      await albuminInput.fill('-10');
      await bilirubinInput.fill('20');

      // Click compute/calculate button if present
      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      await computeButton.click();

      // Should show error for negative values
      await expectResultText(page, /valid positive values|positive/i);
    });

    test('retains the numerical grade with an input review warning outside software thresholds', async ({ page }) => {
      await page.locator('input[type="radio"][value="SI"]').check();
      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      // Software review thresholds are not model eligibility exclusions.
      await albuminInput.fill('100');
      await bilirubinInput.fill('20');

      await page.getByRole('button', { name: 'Calculate', exact: true }).click();
      await expectResultText(page, /application review thresholds/i);
      await expectAlbiGrade(page, 1);
      await expectResultText(page, /does not establish clinical applicability/i);
    });

    test('formatted US conversions are preserved in the warning, clipboard and print layout', async ({ page }) => {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.locator('input[type="radio"][value="US"]').check();
      await page.locator('#albumin').fill('6.01');
      await page.locator('#bilirubin').fill('1.01');
      await page.getByRole('button', { name: 'Calculate', exact: true }).click();
      const conversion = 'SI values: 60.1 g/L and 17.3 μmol/L';
      await expectResultText(page, conversion);
      await expectResultText(page, '-4.292');
      await page.getByRole('button', { name: 'Copy results', exact: true }).click();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(conversion);
      await page.emulateMedia({ media: 'print' });
      await expect(resultsRegion(page).getByText(/Outside application review thresholds/)).toBeVisible();
      await expectResultText(page, conversion);
    });

    test('warning survives copy and print and clears through invalid recovery on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.locator('input[type="radio"][value="SI"]').check();
      const albumin = page.locator('#albumin');
      const bilirubin = page.locator('#bilirubin');
      const calculate = page.getByRole('button', { name: 'Calculate', exact: true });
      await albumin.fill('40');
      await bilirubin.fill('10');
      await calculate.click();
      await expectAlbiGrade(page, 1);
      await expect(resultsRegion(page)).not.toContainText('Input Check');
      await albumin.fill('65');
      await expect(resultsRegion(page)).toHaveCount(0);
      await calculate.focus();
      await page.keyboard.press('Enter');
      await expectResultText(page, /-4\.865/);
      await expectResultText(page, /Input Check/);
      await expect(resultsRegion(page).getByText('Grade 1', { exact: true })).toHaveClass(/result-warning/);
      await expect(resultsRegion(page).getByText(/Source-defined Grade 1/)).toHaveClass(/result-warning/);
      await page.getByRole('button', { name: 'Copy results', exact: true }).click();
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      expect(copied).toContain('Input Check');
      expect(copied).toContain('65 g/L');
      expect(copied).toContain('does not establish clinical applicability');
      await page.emulateMedia({ media: 'print' });
      await expectResultText(page, /Input Check/);
      await page.emulateMedia({ media: 'screen' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await albumin.fill('0');
      await expect(resultsRegion(page)).toHaveCount(0);
      await calculate.click();
      await expectResultText(page, /valid positive values/i);
      await expect(resultsRegion(page)).not.toContainText('ALBI Grade');
      await albumin.fill('40');
      await calculate.click();
      await expectAlbiGrade(page, 1);
      await expect(resultsRegion(page)).not.toContainText('Input Check');
    });
  });

  test.describe('ALBI Score Calculations - SI Units', () => {

    test('Grade 1 - source-defined lowest-risk group (ALBI ≤ -2.60)', async ({ page }) => {
      // Test case: Albumin 40 g/L, Bilirubin 10 μmol/L
      // Expected ALBI Score = -2.740

      // Select SI units
      const siRadio = page.locator('input[type="radio"][value="SI"]');
      await siRadio.check();

      // Enter values
      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      await albuminInput.fill('40');
      await bilirubinInput.fill('10');

      // Trigger calculation (values may auto-calculate or need button click)
      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      await computeButton.click();

      // Wait a moment for calculation

      // Check for Grade 1 result
      await expectAlbiGrade(page, 1);

      // Check for ALBI score in expected range
      await expectResultText(page, /ALBI Score:\s*-2\.740/);

      // Check for interpretation
      await expect(resultsRegion(page)).toContainText(/Lowest-risk group/i);
    });

    test('Grade 2 - Source-defined intermediate-risk group (ALBI > -2.60 to ≤ -1.39)', async ({ page }) => {
      // Test case: Albumin 35 g/L, Bilirubin 17 μmol/L
      // Expected ALBI Score ≈ -2.163

      const siRadio = page.locator('input[type="radio"][value="SI"]');
      await siRadio.check();

      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      await albuminInput.fill('35');
      await bilirubinInput.fill('17');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      await computeButton.click();

      // Check for Grade 2 result
      await expectAlbiGrade(page, 2);
      await expectResultText(page, /ALBI Score:\s*-2\.163/);

      // Check for interpretation
      await expect(resultsRegion(page)).toContainText(/Intermediate-risk group/i);
    });

    test('Grade 3 - Source-defined highest-risk group (ALBI > -1.39)', async ({ page }) => {
      // Test case: Albumin 25 g/L, Bilirubin 50 μmol/L
      // Expected ALBI Score ≈ -1.004

      const siRadio = page.locator('input[type="radio"][value="SI"]');
      await siRadio.check();

      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      await albuminInput.fill('25');
      await bilirubinInput.fill('50');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      await computeButton.click();

      // Check for Grade 3 result
      await expectAlbiGrade(page, 3);
      await expectResultText(page, /ALBI Score:\s*-1\.004/);

      // Check for interpretation
      await expect(resultsRegion(page)).toContainText(/Highest-risk group/i);
    });

    test('Boundary case - exact Grade 1/2 boundary (ALBI = -2.60)', async ({ page }) => {
      // Albumin 38.35294117647059 g/L, bilirubin 10 μmol/L → ALBI = -2.60

      const siRadio = page.locator('input[type="radio"][value="SI"]');
      await siRadio.check();

      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      await albuminInput.fill('38.35294117647059');
      await bilirubinInput.fill('10');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      await computeButton.click();

      // Should be Grade 1 (at or below the -2.60 cutoff)
      await expectAlbiGrade(page, 1);
      await expectResultText(page, /ALBI Score:\s*-2\.600/);
    });

    test('Boundary case - exact Grade 2/3 boundary (ALBI = -1.39)', async ({ page }) => {
      // Albumin 24.11764705882353 g/L, bilirubin 10 μmol/L → ALBI = -1.39

      const siRadio = page.locator('input[type="radio"][value="SI"]');
      await siRadio.check();

      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      await albuminInput.fill('24.11764705882353');
      await bilirubinInput.fill('10');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      await computeButton.click();

      // Should remain Grade 2 because the upper boundary is inclusive.
      await expectAlbiGrade(page, 2);
      await expectResultText(page, /ALBI Score:\s*-1\.390/);
    });
  });

  test.describe('ALBI Score Calculations - US Units', () => {

    test('US units conversion - Grade 1', async ({ page }) => {
      // Test case: Albumin 4.0 g/dL, Bilirubin 0.5 mg/dL
      // Converts to: 40 g/L, 8.55 μmol/L → ALBI ≈ -2.785

      const usRadio = page.locator('input[type="radio"][value="US"]');
      await usRadio.check();

      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      await albuminInput.fill('4.0');
      await bilirubinInput.fill('0.5');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      await computeButton.click();

      // Check for Grade 1
      await expectAlbiGrade(page, 1);

      // Should show converted SI values
      await expectResultText(page, /Converted Albumin \(SI\):\s*40\.0 g\/L/);
      await expectResultText(page, /Converted Bilirubin \(SI\):\s*8\.6 μmol\/L/);
    });

    test('US units conversion - Grade 2', async ({ page }) => {
      // Test case: Albumin 3.5 g/dL, Bilirubin 1.0 mg/dL
      // Converts to: 35 g/L, 17.1 μmol/L → ALBI ≈ -2.162

      const usRadio = page.locator('input[type="radio"][value="US"]');
      await usRadio.check();

      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      await albuminInput.fill('3.5');
      await bilirubinInput.fill('1.0');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      await computeButton.click();

      // Check for Grade 2
      await expectAlbiGrade(page, 2);

      // Should show converted SI values
      await expectResultText(page, /Converted Albumin \(SI\):\s*35\.0 g\/L/);
    });

    test('US units conversion - Grade 3', async ({ page }) => {
      // Test case: Albumin 2.5 g/dL, Bilirubin 3.0 mg/dL
      // Converts to: 25 g/L, 51.3 μmol/L → ALBI ≈ -0.995

      const usRadio = page.locator('input[type="radio"][value="US"]');
      await usRadio.check();

      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      await albuminInput.fill('2.5');
      await bilirubinInput.fill('3.0');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      await computeButton.click();

      // Check for Grade 3
      await expectAlbiGrade(page, 3);
    });
  });

  test.describe('Edge Cases & Error Handling', () => {

    test('should handle zero values', async ({ page }) => {
      await page.locator('input[type="radio"][value="SI"]').check();
      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      await albuminInput.fill('0');
      await bilirubinInput.fill('20');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      await computeButton.click();

      // Should show error message
      await expectResultText(page, /valid positive values|positive/i);
    });

    test('should handle very high bilirubin values', async ({ page }) => {
      const siRadio = page.locator('input[type="radio"][value="SI"]');
      await siRadio.check();

      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      // High bilirubin: 500 μmol/L (severe cholestasis)
      await albuminInput.fill('30');
      await bilirubinInput.fill('500');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      await computeButton.click();

      // Should still calculate (within physiological range)
      await expectAlbiGrade(page, 3);
    });

    test('should handle very low albumin values', async ({ page }) => {
      const siRadio = page.locator('input[type="radio"][value="SI"]');
      await siRadio.check();

      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      // Low albumin: 15 g/L (severe hypoalbuminemia)
      await albuminInput.fill('15');
      await bilirubinInput.fill('50');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      await computeButton.click();

      // Should calculate Grade 3
      await expectAlbiGrade(page, 3);
    });

    test('should handle decimal precision', async ({ page }) => {
      const siRadio = page.locator('input[type="radio"][value="SI"]');
      await siRadio.check();

      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      // Precise values
      await albuminInput.fill('37.8');
      await bilirubinInput.fill('12.3');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      await computeButton.click();

      // Should display result with appropriate precision
      await expectResultText(page, /ALBI Score:\s*-2\./);
    });
  });

  test.describe('Clinical Context & User Guidance', () => {

    test('should display clinical interpretation for each grade', async ({ page }) => {
      const siRadio = page.locator('input[type="radio"][value="SI"]');
      await siRadio.check();

      // Test Grade 1
      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      await albuminInput.fill('40');
      await bilirubinInput.fill('10');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      await computeButton.click();

      // Should show the source-defined group and explicit individual-use boundary.
      await expect(resultsRegion(page)).toContainText(/Source-defined Grade 1/i);
      await expect(resultsRegion(page)).toContainText(/does not determine treatment eligibility/i);
    });

    test('should not infer treatment eligibility from Grade 3', async ({ page }) => {
      const siRadio = page.locator('input[type="radio"][value="SI"]');
      await siRadio.check();

      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      // Grade 3 case
      await albuminInput.fill('25');
      await bilirubinInput.fill('50');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      await computeButton.click();

      await expect(resultsRegion(page)).toContainText(/Source-defined Grade 3/i);
      await expect(resultsRegion(page)).toContainText(/does not determine treatment eligibility/i);
      await expect(resultsRegion(page)).not.toContainText(/best supportive care|curative therapies/i);
    });
  });

  test.describe('References & Citations', () => {

    test('should display all reference citations', async ({ page }) => {
      await page.getByRole('button', { name: 'Show 2 more references' }).click();
      for (const doi of ['10.1200/JCO.2014.57.9151', '10.1371/journal.pone.0180408',
        '10.1111/jgh.13250', '10.1016/j.jhep.2016.09.008', '10.1007/s10620-020-06384-2']) {
        await expect(page.locator(`a[href="https://doi.org/${doi}"]`)).toBeVisible();
      }
    });

    test('primary reference has the exact DOI and safe external-link attributes', async ({ page }) => {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      const primary = page.getByRole('link', { name: /Johnson PJ, Berhane S/i });
      await expect(primary).toHaveAttribute('href', 'https://doi.org/10.1200/JCO.2014.57.9151');
      await expect(primary).toHaveAttribute('target', '_blank');
      await expect(primary).toHaveAttribute('rel', /noopener/);
    });
  });

  test.describe('Accessibility', () => {

    test('should have proper labels for all inputs', async ({ page }) => {
      // Check for albumin label
      await expect(page.locator('label:has-text("Albumin")')).toBeVisible();

      // Check for bilirubin label
      await expect(page.locator('label:has-text("Bilirubin")')).toBeVisible();
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

    test('calculator heading is visible in the selected theme', async ({ page }) => {
      // This is a basic check - actual contrast testing would need specialized tools
      await expect(page.getByRole('main', { name: 'ALBI Score' })).toBeVisible();

      // Verify text is readable
      const title = page.getByTestId('calculator-title').first();
      await expect(title).toBeVisible();
    });
  });

  test.describe('Formula Accuracy Verification', () => {

    test('should match expected ALBI score for known values', async ({ page }) => {
      // Test case from literature: Albumin 40 g/L, Bilirubin 10 μmol/L
      // Expected: (log10(10) * 0.66) + (40 * -0.085) = 0.66 - 3.4 = -2.740

      const siRadio = page.locator('input[type="radio"][value="SI"]');
      await siRadio.check();

      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      await albuminInput.fill('40');
      await bilirubinInput.fill('10');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      await computeButton.click();

      await expectResultText(page, /ALBI Score:\s*-2\.740/);
    });

    test('should verify unit conversion accuracy', async ({ page }) => {
      // Test: 3.5 g/dL albumin = 35 g/L
      // Test: 1.0 mg/dL bilirubin = 17.104 μmol/L

      const usRadio = page.locator('input[type="radio"][value="US"]');
      await usRadio.check();

      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      await albuminInput.fill('3.5');
      await bilirubinInput.fill('1.0');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      await computeButton.click();

      // Check converted values are displayed
      await expectResultText(page, /Converted Albumin \(SI\):\s*35\.0 g\/L/);
      await expectResultText(page, /Converted Bilirubin \(SI\):\s*17\.1 μmol\/L/);
    });

    test('preserves formatted ALBI display, copy feedback, and print layout', async ({ page, browserName }) => {
      const siRadio = page.locator('input[type="radio"][value="SI"]');
      await siRadio.check();

      await page.locator('input[type="number"]').first().fill('40');
      await page.locator('input[type="number"]').nth(1).fill('10');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      await computeButton.click();

      await expectResultText(page, /ALBI Score:\s*-2\.740/);
      await expectAlbiGrade(page, 1);
      if (browserName === 'chromium') {
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      } else {
        await page.evaluate(() => {
          window.__radulatorClipboard = '';
          Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
              writeText: async (text) => { window.__radulatorClipboard = text; },
              readText: async () => window.__radulatorClipboard,
            },
          });
        });
      }

      await page.getByRole('button', { name: /Copy results/i }).click();
      if (browserName === 'chromium') {
        const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
        expect(clipboardText).toContain('ALBI Score: -2.740');
        expect(clipboardText).toContain('ALBI Grade: Grade 1');
        expect(clipboardText).toContain('Input Units: SI (albumin g/L; bilirubin μmol/L)');
        expect(clipboardText).toContain('does not determine treatment eligibility');
        expect(clipboardText).not.toContain('_severity');
      } else {
        await expect(page.getByRole('button', { name: 'Results copied' })).toBeVisible();
        await expect(page.getByText('Copied!', { exact: true })).toBeVisible();
      }

      await page.evaluate(() => {
        window.__radulatorPrintCalls = 0;
        window.print = () => { window.__radulatorPrintCalls += 1; };
      });
      await page.getByRole('button', { name: 'Print Results' }).click();
      await expect.poll(() => page.evaluate(() => window.__radulatorPrintCalls)).toBe(1);
      await page.emulateMedia({ media: 'print' });
      await expect(page.getByRole('button', { name: 'Print Results' })).toBeHidden();
      await expect(resultsRegion(page)).toBeVisible();
    });
  });

  test('reset removes units, measurements, results and report actions', async ({ page }) => {
    await page.locator('input[value="SI"]').check();
    await page.locator('#albumin').fill('40');
    await page.locator('#bilirubin').fill('10');
    await page.getByRole('button', { name: 'Calculate', exact: true }).click();
    await expectAlbiGrade(page, 1);
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(page.locator('#albumin')).toHaveValue('');
    await expect(page.locator('#bilirubin')).toHaveValue('');
    await expect(page.locator('input[value="SI"]')).not.toBeChecked();
    await expect(resultsRegion(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Copy results', exact: true })).toHaveCount(0);
  });

  test('prints dark-mode results without navigation overlays or split warning rows', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.locator('input[value="SI"]').check();
    await page.locator('#albumin').fill('40');
    await page.locator('#bilirubin').fill('0.5');
    await page.getByRole('button', { name: 'Calculate', exact: true }).click();
    const results = resultsRegion(page);
    await expect(results).toContainText('Input Check');
    await page.emulateMedia({ media: 'print' });
    const mobileHeader = page.getByRole('button', { name: 'Open navigation menu', includeHidden: true }).locator('..');
    await expect(mobileHeader).toHaveCount(1);
    await expect(mobileHeader).toBeHidden();
    await expect(page.getByTestId('calculator-title')).toHaveCSS('color', 'rgb(0, 0, 0)');
    await expect(results).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(results.locator(':scope > div').first()).toHaveCSS('break-inside', 'avoid');
    await expect(results).toContainText('-3.599');
    await expect(results).toContainText('Grade 1');
    await expect(results).toContainText('Numerical computability does not establish clinical applicability');
  });

  test('rounding explanation accompanies the higher grade in copied results', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('input[value="SI"]').check();
    await page.locator('#albumin').fill('38.35176470588235');
    await page.locator('#bilirubin').fill('10');
    await page.getByRole('button', { name: 'Calculate', exact: true }).click();
    await expectResultText(page, /ALBI Score:\s*-2\.600/);
    await expectAlbiGrade(page, 2);
    await expectResultText(page, /grade uses the unrounded score/);
    await page.getByRole('button', { name: 'Copy results', exact: true }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('ALBI Grade: Grade 2');
    expect(copied).toContain('grade uses the unrounded score');
  });

  test('small positive laboratory values stay nonzero in the visible report', async ({ page }) => {
    await page.locator('input[value="SI"]').check();
    await page.locator('#albumin').fill('40');
    await page.locator('#bilirubin').fill('0.01');
    await page.getByRole('button', { name: 'Calculate', exact: true }).click();
    await expectResultText(page, /Bilirubin \(SI\):\s*0\.0100 μmol\/L/);
    await expectResultText(page, '-4.720');
    await expectResultText(page, 'Input Check');
  });
});
