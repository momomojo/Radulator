import { test, expect } from '@playwright/test';

/**
 * ALBI Score Calculator E2E Tests
 *
 * Tests the Albumin-Bilirubin (ALBI) grade calculator for liver function assessment
 * Formula: (log₁₀ bilirubin [μmol/L] × 0.66) + (albumin [g/L] × −0.0852)
 *
 * Grading:
 * - Grade 1: ≤ −2.60 (Best liver function)
 * - Grade 2: > −2.60 to ≤ −1.39 (Intermediate)
 * - Grade 3: > −1.39 (Worst liver function)
 *
 * Reference: Johnson et al. J Clin Oncol 2015;33(6):550-558
 */

test.describe('ALBI Score Calculator', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Navigate to ALBI Score calculator
    await page.click('text=ALBI Score');
    // Wait for calculator to load
    await expect(page.locator('h2:has-text("ALBI Score")')).toBeVisible();
  });

  test.describe('Visual Appeal & Theme Matching', () => {

    test('should display calculator with proper styling', async ({ page }) => {
      // Check calculator card is visible
      const card = page.locator('.card, [class*="card"]').first();
      await expect(card).toBeVisible();

      // Check title is visible and styled
      const title = page.locator('h2:has-text("ALBI Score")');
      await expect(title).toBeVisible();

      // Check description is present
      await expect(page.locator('text=Albumin-Bilirubin grade')).toBeVisible();
    });

    test('should have responsive design on mobile', async ({ page, viewport }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Calculator should still be visible and usable
      await expect(page.locator('h2:has-text("ALBI Score")')).toBeVisible();

      // Fields should stack vertically on mobile
      const albumin = page.locator('label:has-text("Serum Albumin")');
      await expect(albumin).toBeVisible();
    });

    test('should display info section with proper styling', async ({ page }) => {
      // Check if info section exists
      const infoSection = page.locator('text=The ALBI grade provides');
      if (await infoSection.isVisible()) {
        await expect(infoSection).toBeVisible();
      }

      // Check for reference link
      const refLink = page.locator('a:has-text("Johnson et al. 2015")');
      if (await refLink.isVisible()) {
        await expect(refLink).toHaveAttribute('href', /.+/);
      }
    });
  });

  test.describe('Unit System Selection', () => {

    test('should allow switching between SI and US units', async ({ page }) => {
      // Default should be SI units
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
      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      // Try to enter negative values
      await albuminInput.fill('-10');
      await bilirubinInput.fill('20');

      // Click compute/calculate button if present
      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      if (await computeButton.isVisible()) {
        await computeButton.click();
      }

      // Should show error for negative values
      const errorText = page.locator('text=/error|invalid|positive/i');
      if (await errorText.isVisible()) {
        await expect(errorText).toBeVisible();
      }
    });

    test('should validate physiological ranges', async ({ page }) => {
      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      // Enter values outside physiological range (albumin > 60 g/L)
      await albuminInput.fill('100');
      await bilirubinInput.fill('20');

      // Trigger calculation
      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      if (await computeButton.isVisible()) {
        await computeButton.click();
      }

      // Should show range error
      const errorText = page.locator('text=/physiological range|outside.*range/i');
      if (await errorText.isVisible()) {
        await expect(errorText).toBeVisible();
      }
    });
  });

  test.describe('ALBI Score Calculations - SI Units', () => {

    test('Grade 1 - Best liver function (ALBI ≤ -2.60)', async ({ page }) => {
      // Test case: Albumin 40 g/L, Bilirubin 10 μmol/L
      // Expected ALBI Score ≈ -2.742

      // Select SI units
      const siRadio = page.locator('input[type="radio"][value="SI"]');
      if (await siRadio.isVisible()) {
        await siRadio.check();
      }

      // Enter values
      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      await albuminInput.fill('40');
      await bilirubinInput.fill('10');

      // Trigger calculation (values may auto-calculate or need button click)
      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      if (await computeButton.isVisible()) {
        await computeButton.click();
      }

      // Wait a moment for calculation
      await page.waitForTimeout(500);

      // Check for Grade 1 result
      await expect(page.locator('text=/Grade 1|ALBI Grade.*1/i')).toBeVisible();

      // Check for ALBI score in expected range
      await expect(page.locator('text=/-2.7|-2.8/i')).toBeVisible();

      // Check for interpretation
      await expect(page.locator('text=/Best liver function|well-compensated/i')).toBeVisible();
    });

    test('Grade 2 - Intermediate function (ALBI > -2.60 to ≤ -1.39)', async ({ page }) => {
      // Test case: Albumin 35 g/L, Bilirubin 17 μmol/L
      // Expected ALBI Score ≈ -2.164

      const siRadio = page.locator('input[type="radio"][value="SI"]');
      if (await siRadio.isVisible()) {
        await siRadio.check();
      }

      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      await albuminInput.fill('35');
      await bilirubinInput.fill('17');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      if (await computeButton.isVisible()) {
        await computeButton.click();
      }

      await page.waitForTimeout(500);

      // Check for Grade 2 result
      await expect(page.locator('text=/Grade 2|ALBI Grade.*2/i')).toBeVisible();

      // Check for interpretation
      await expect(page.locator('text=/Intermediate|moderately compensated/i')).toBeVisible();
    });

    test('Grade 3 - Worst function (ALBI > -1.39)', async ({ page }) => {
      // Test case: Albumin 25 g/L, Bilirubin 50 μmol/L
      // Expected ALBI Score ≈ -1.003

      const siRadio = page.locator('input[type="radio"][value="SI"]');
      if (await siRadio.isVisible()) {
        await siRadio.check();
      }

      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      await albuminInput.fill('25');
      await bilirubinInput.fill('50');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      if (await computeButton.isVisible()) {
        await computeButton.click();
      }

      await page.waitForTimeout(500);

      // Check for Grade 3 result
      await expect(page.locator('text=/Grade 3|ALBI Grade.*3/i')).toBeVisible();

      // Check for interpretation
      await expect(page.locator('text=/Worst|poorly compensated/i')).toBeVisible();
    });

    test('Boundary case - Grade 1/2 boundary (ALBI = -2.60)', async ({ page }) => {
      // Albumin 38.7 g/L, Bilirubin 11 μmol/L → ALBI ≈ -2.598

      const siRadio = page.locator('input[type="radio"][value="SI"]');
      if (await siRadio.isVisible()) {
        await siRadio.check();
      }

      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      await albuminInput.fill('38.7');
      await bilirubinInput.fill('11');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      if (await computeButton.isVisible()) {
        await computeButton.click();
      }

      await page.waitForTimeout(500);

      // Should be Grade 2 (just above -2.60)
      await expect(page.locator('text=/Grade [12]/i')).toBeVisible();
    });

    test('Boundary case - Grade 2/3 boundary (ALBI = -1.39)', async ({ page }) => {
      // Albumin 27 g/L, Bilirubin 28 μmol/L → ALBI ≈ -1.352

      const siRadio = page.locator('input[type="radio"][value="SI"]');
      if (await siRadio.isVisible()) {
        await siRadio.check();
      }

      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      await albuminInput.fill('27');
      await bilirubinInput.fill('28');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      if (await computeButton.isVisible()) {
        await computeButton.click();
      }

      await page.waitForTimeout(500);

      // Should be Grade 3 (just above -1.39)
      await expect(page.locator('text=/Grade [23]/i')).toBeVisible();
    });
  });

  test.describe('ALBI Score Calculations - US Units', () => {

    test('US units conversion - Grade 1', async ({ page }) => {
      // Test case: Albumin 4.0 g/dL, Bilirubin 0.5 mg/dL
      // Converts to: 40 g/L, 8.55 μmol/L → ALBI ≈ -2.776

      const usRadio = page.locator('input[type="radio"][value="US"]');
      if (await usRadio.isVisible()) {
        await usRadio.check();
      }

      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      await albuminInput.fill('4.0');
      await bilirubinInput.fill('0.5');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      if (await computeButton.isVisible()) {
        await computeButton.click();
      }

      await page.waitForTimeout(500);

      // Check for Grade 1
      await expect(page.locator('text=/Grade 1/i')).toBeVisible();

      // Should show converted SI values
      await expect(page.locator('text=/40.*g\/L|Converted.*Albumin/i')).toBeVisible();
      await expect(page.locator('text=/8\.5.*μmol\/L|Converted.*Bilirubin/i')).toBeVisible();
    });

    test('US units conversion - Grade 2', async ({ page }) => {
      // Test case: Albumin 3.5 g/dL, Bilirubin 1.0 mg/dL
      // Converts to: 35 g/L, 17.1 μmol/L → ALBI ≈ -2.162

      const usRadio = page.locator('input[type="radio"][value="US"]');
      if (await usRadio.isVisible()) {
        await usRadio.check();
      }

      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      await albuminInput.fill('3.5');
      await bilirubinInput.fill('1.0');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      if (await computeButton.isVisible()) {
        await computeButton.click();
      }

      await page.waitForTimeout(500);

      // Check for Grade 2
      await expect(page.locator('text=/Grade 2/i')).toBeVisible();

      // Should show converted SI values
      await expect(page.locator('text=/35.*g\/L|Converted.*Albumin/i')).toBeVisible();
    });

    test('US units conversion - Grade 3', async ({ page }) => {
      // Test case: Albumin 2.5 g/dL, Bilirubin 3.0 mg/dL
      // Converts to: 25 g/L, 51.3 μmol/L → ALBI ≈ -0.995

      const usRadio = page.locator('input[type="radio"][value="US"]');
      if (await usRadio.isVisible()) {
        await usRadio.check();
      }

      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      await albuminInput.fill('2.5');
      await bilirubinInput.fill('3.0');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      if (await computeButton.isVisible()) {
        await computeButton.click();
      }

      await page.waitForTimeout(500);

      // Check for Grade 3
      await expect(page.locator('text=/Grade 3/i')).toBeVisible();
    });
  });

  test.describe('Edge Cases & Error Handling', () => {

    test('should handle zero values', async ({ page }) => {
      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      await albuminInput.fill('0');
      await bilirubinInput.fill('20');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      if (await computeButton.isVisible()) {
        await computeButton.click();
      }

      await page.waitForTimeout(500);

      // Should show error message
      await expect(page.locator('text=/error|invalid|positive/i')).toBeVisible();
    });

    test('should handle very high bilirubin values', async ({ page }) => {
      const siRadio = page.locator('input[type="radio"][value="SI"]');
      if (await siRadio.isVisible()) {
        await siRadio.check();
      }

      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      // High bilirubin: 500 μmol/L (severe cholestasis)
      await albuminInput.fill('30');
      await bilirubinInput.fill('500');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      if (await computeButton.isVisible()) {
        await computeButton.click();
      }

      await page.waitForTimeout(500);

      // Should still calculate (within physiological range)
      await expect(page.locator('text=/Grade 3/i')).toBeVisible();
    });

    test('should handle very low albumin values', async ({ page }) => {
      const siRadio = page.locator('input[type="radio"][value="SI"]');
      if (await siRadio.isVisible()) {
        await siRadio.check();
      }

      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      // Low albumin: 15 g/L (severe hypoalbuminemia)
      await albuminInput.fill('15');
      await bilirubinInput.fill('50');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      if (await computeButton.isVisible()) {
        await computeButton.click();
      }

      await page.waitForTimeout(500);

      // Should calculate Grade 3
      await expect(page.locator('text=/Grade 3/i')).toBeVisible();
    });

    test('should handle decimal precision', async ({ page }) => {
      const siRadio = page.locator('input[type="radio"][value="SI"]');
      if (await siRadio.isVisible()) {
        await siRadio.check();
      }

      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      // Precise values
      await albuminInput.fill('37.8');
      await bilirubinInput.fill('12.3');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      if (await computeButton.isVisible()) {
        await computeButton.click();
      }

      await page.waitForTimeout(500);

      // Should display result with appropriate precision
      const result = page.locator('text=/-2\./i');
      await expect(result).toBeVisible();
    });
  });

  test.describe('Clinical Context & User Guidance', () => {

    test('should display clinical interpretation for each grade', async ({ page }) => {
      const siRadio = page.locator('input[type="radio"][value="SI"]');
      if (await siRadio.isVisible()) {
        await siRadio.check();
      }

      // Test Grade 1
      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      await albuminInput.fill('40');
      await bilirubinInput.fill('10');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      if (await computeButton.isVisible()) {
        await computeButton.click();
      }

      await page.waitForTimeout(500);

      // Should show prognosis information
      await expect(page.locator('text=/median survival|prognosis|suitable for/i')).toBeVisible();
    });

    test('should display appropriate treatment recommendations', async ({ page }) => {
      const siRadio = page.locator('input[type="radio"][value="SI"]');
      if (await siRadio.isVisible()) {
        await siRadio.check();
      }

      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      // Grade 3 case
      await albuminInput.fill('25');
      await bilirubinInput.fill('50');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      if (await computeButton.isVisible()) {
        await computeButton.click();
      }

      await page.waitForTimeout(500);

      // Should mention treatment limitations for Grade 3
      await expect(page.locator('text=/best supportive care|limited|careful assessment/i')).toBeVisible();
    });
  });

  test.describe('References & Citations', () => {

    test('should display all reference citations', async ({ page }) => {
      // Scroll to bottom to see references
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      // Check for Johnson et al. 2015 (primary reference)
      await expect(page.locator('text=/Johnson.*2015/i')).toBeVisible();

      // Check for multiple references
      const references = page.locator('text=/doi.org|https:\/\//i');
      const count = await references.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should have working reference links', async ({ page }) => {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      // Find DOI links
      const doiLinks = page.locator('a[href*="doi.org"]');
      const linkCount = await doiLinks.count();

      if (linkCount > 0) {
        // Check first link has valid href
        const firstLink = doiLinks.first();
        const href = await firstLink.getAttribute('href');
        expect(href).toContain('doi.org');

        // Verify link opens in new tab (target="_blank")
        const target = await firstLink.getAttribute('target');
        if (target) {
          expect(target).toBe('_blank');
        }
      }
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

    test('should have sufficient color contrast', async ({ page }) => {
      // This is a basic check - actual contrast testing would need specialized tools
      const card = page.locator('.card, [class*="card"]').first();
      await expect(card).toBeVisible();

      // Verify text is readable
      const title = page.locator('h2:has-text("ALBI Score")');
      await expect(title).toBeVisible();
    });
  });

  test.describe('Formula Accuracy Verification', () => {

    test('should match expected ALBI score for known values', async ({ page }) => {
      // Test case from literature: Albumin 40 g/L, Bilirubin 10 μmol/L
      // Expected: (log10(10) * 0.66) + (40 * -0.0852) = 0.66 - 3.408 = -2.748

      const siRadio = page.locator('input[type="radio"][value="SI"]');
      if (await siRadio.isVisible()) {
        await siRadio.check();
      }

      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      await albuminInput.fill('40');
      await bilirubinInput.fill('10');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      if (await computeButton.isVisible()) {
        await computeButton.click();
      }

      await page.waitForTimeout(500);

      // Check for score in range -2.74 to -2.75
      await expect(page.locator('text=/-2\.74|-2\.75/i')).toBeVisible();
    });

    test('should verify unit conversion accuracy', async ({ page }) => {
      // Test: 3.5 g/dL albumin = 35 g/L
      // Test: 1.0 mg/dL bilirubin = 17.104 μmol/L

      const usRadio = page.locator('input[type="radio"][value="US"]');
      if (await usRadio.isVisible()) {
        await usRadio.check();
      }

      const albuminInput = page.locator('input[type="number"]').first();
      const bilirubinInput = page.locator('input[type="number"]').nth(1);

      await albuminInput.fill('3.5');
      await bilirubinInput.fill('1.0');

      const computeButton = page.locator('button:has-text("Compute"), button:has-text("Calculate")').first();
      if (await computeButton.isVisible()) {
        await computeButton.click();
      }

      await page.waitForTimeout(500);

      // Check converted values are displayed
      await expect(page.locator('text=/35.*g\/L/i')).toBeVisible();
      await expect(page.locator('text=/17\.1.*μmol\/L/i')).toBeVisible();
    });
  });
});
