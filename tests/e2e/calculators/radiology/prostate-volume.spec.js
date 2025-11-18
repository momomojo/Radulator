import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Prostate Volume Calculator
 *
 * Tests the ellipsoid volume calculation (L × W × H × π/6) and PSA-Density
 * calculations according to the formula: PSA-D = PSA (ng/mL) / Volume (mL)
 *
 * References:
 * - Paterson NR et al. CUAJ 2016 (DOI: 10.5489/cuaj.3236)
 * - Aminsharifi A et al. J Urol 2018 (DOI: 10.1016/j.juro.2018.05.016)
 */

test.describe('Prostate Volume Calculator', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Navigate to Prostate Volume calculator
    await page.click('button:has-text("Prostate Volume")');

    // Verify calculator loaded
    await expect(page.locator('h2')).toContainText('Prostate Volume');
  });

  test.describe('Visual Appeal & Theme Matching', () => {

    test('should display calculator with proper styling', async ({ page }) => {
      // Check header is visible and styled
      const header = page.locator('h2:has-text("Prostate Volume")');
      await expect(header).toBeVisible();
      await expect(header).toHaveClass(/text-xl|font-semibold/);

      // Check description is visible
      const description = page.locator('text=Ellipsoid volume estimation');
      await expect(description).toBeVisible();
    });

    test('should display info box with formula explanation', async ({ page }) => {
      const infoBox = page.locator('.bg-blue-50\\/60');
      await expect(infoBox).toBeVisible();
      await expect(infoBox).toContainText('ellipsoid formula');
      await expect(infoBox).toContainText('π/6 is rounded to 0.52');
      await expect(infoBox).toContainText('PSA-Density cut-off values');
    });

    test('should display PI-RADS Sector Map button', async ({ page }) => {
      const button = page.locator('button:has-text("PI-RADS Sector Map")');
      await expect(button).toBeVisible();
      await expect(button).toHaveClass(/bg-blue-500|text-white/);
    });

    test('should have responsive layout on mobile', async ({ page, isMobile }) => {
      if (isMobile) {
        // Check sidebar is visible on mobile
        const sidebar = page.locator('aside');
        await expect(sidebar).toBeVisible();

        // Check inputs stack vertically on mobile
        const inputGrid = page.locator('[aria-label="Input fields"]');
        await expect(inputGrid).toHaveClass(/grid-cols-1/);
      }
    });

    test('should have responsive layout on desktop', async ({ page, viewport }) => {
      if (viewport && viewport.width >= 768) {
        // Check inputs are in 2-column grid on desktop
        const inputGrid = page.locator('[aria-label="Input fields"]');
        await expect(inputGrid).toHaveClass(/md:grid-cols-2/);
      }
    });
  });

  test.describe('User Usefulness Assessment', () => {

    test('should display clear field labels', async ({ page }) => {
      await expect(page.locator('label:has-text("Length (craniocaudal, cm):")')).toBeVisible();
      await expect(page.locator('label:has-text("Height (anteroposterior, cm):")')).toBeVisible();
      await expect(page.locator('label:has-text("Width (transverse, cm):")')).toBeVisible();
      await expect(page.locator('label:has-text("PSA (ng/mL):")')).toBeVisible();
    });

    test('should provide clinical context in info box', async ({ page }) => {
      const infoBox = page.locator('.bg-blue-50\\/60');
      await expect(infoBox).toContainText('0.08 to 0.15');
      await expect(infoBox).toContainText('clinical context');
    });

    test('should have accessible Calculate button', async ({ page }) => {
      const calculateButton = page.locator('button:has-text("Calculate")');
      await expect(calculateButton).toBeVisible();
      await expect(calculateButton).toBeEnabled();
    });
  });

  test.describe('Citation Verification', () => {

    test('should display references section', async ({ page }) => {
      const referencesSection = page.locator('section:has(h3:has-text("References"))');
      await expect(referencesSection).toBeVisible();
    });

    test('should have valid Paterson 2016 CUAJ reference', async ({ page }) => {
      const link = page.locator('a[href="https://doi.org/10.5489/cuaj.3236"]');
      await expect(link).toBeVisible();
      await expect(link).toContainText('Paterson NR CUAJ 2016');

      // Verify link opens in new tab
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    test('should have valid Aminsharifi 2018 J Urol reference', async ({ page }) => {
      const link = page.locator('a[href="https://doi.org/10.1016/j.juro.2018.05.016"]');
      await expect(link).toBeVisible();
      await expect(link).toContainText('Aminsharifi A J Urol 2018');

      // Verify link opens in new tab
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  test.describe('Professional Appearance', () => {

    test('should maintain consistent UI styling', async ({ page }) => {
      // Check card styling
      const card = page.locator('.w-full.max-w-4xl');
      await expect(card).toBeVisible();

      // Check input fields have consistent styling
      const inputs = page.locator('input[type="number"]');
      expect(await inputs.count()).toBe(4);

      for (let i = 0; i < 4; i++) {
        const input = inputs.nth(i);
        await expect(input).toHaveClass(/border|rounded|p-2/);
      }
    });

    test('should display results section with proper formatting', async ({ page }) => {
      // Fill in test values
      await page.fill('#length', '5.0');
      await page.fill('#height', '4.0');
      await page.fill('#width', '4.5');
      await page.fill('#psa', '6.0');

      // Click Calculate
      await page.click('button:has-text("Calculate")');

      // Check results section
      const results = page.locator('section[aria-live="polite"]');
      await expect(results).toBeVisible();

      // Check font-mono styling for result labels
      const resultLabels = results.locator('.font-mono');
      expect(await resultLabels.count()).toBeGreaterThan(0);
    });
  });

  test.describe('Calculation Accuracy', () => {

    test('should calculate volume correctly - normal prostate', async ({ page }) => {
      // Test case: Normal prostate (L=4.0, H=3.0, W=3.5)
      // Expected volume = 4.0 × 3.0 × 3.5 × 0.52 = 21.84 ≈ 21.8 mL
      await page.fill('#length', '4.0');
      await page.fill('#height', '3.0');
      await page.fill('#width', '3.5');

      await page.click('button:has-text("Calculate")');

      await expect(page.locator('text=Prostate Volume (mL):')).toBeVisible();
      await expect(page.locator('text=21.8')).toBeVisible();
    });

    test('should calculate volume correctly - enlarged prostate', async ({ page }) => {
      // Test case: Enlarged prostate (L=6.0, H=5.0, W=5.5)
      // Expected volume = 6.0 × 5.0 × 5.5 × 0.52 = 85.8 mL
      await page.fill('#length', '6.0');
      await page.fill('#height', '5.0');
      await page.fill('#width', '5.5');

      await page.click('button:has-text("Calculate")');

      await expect(page.locator('text=Prostate Volume (mL):')).toBeVisible();
      await expect(page.locator('text=85.8')).toBeVisible();
    });

    test('should calculate volume correctly - small prostate', async ({ page }) => {
      // Test case: Small prostate (L=3.0, H=2.5, W=2.8)
      // Expected volume = 3.0 × 2.5 × 2.8 × 0.52 = 10.92 ≈ 10.9 mL
      await page.fill('#length', '3.0');
      await page.fill('#height', '2.5');
      await page.fill('#width', '2.8');

      await page.click('button:has-text("Calculate")');

      await expect(page.locator('text=Prostate Volume (mL):')).toBeVisible();
      await expect(page.locator('text=10.9')).toBeVisible();
    });

    test('should handle zero dimensions', async ({ page }) => {
      // Test case: Zero dimensions
      await page.fill('#length', '0');
      await page.fill('#height', '0');
      await page.fill('#width', '0');

      await page.click('button:has-text("Calculate")');

      await expect(page.locator('text=Prostate Volume (mL):')).toBeVisible();
      await expect(page.locator('text=0.0')).toBeVisible();
    });

    test('should handle decimal precision', async ({ page }) => {
      // Test case: High precision decimals (L=4.23, H=3.87, W=4.12)
      // Expected volume = 4.23 × 3.87 × 4.12 × 0.52 = 35.07... ≈ 35.1 mL
      await page.fill('#length', '4.23');
      await page.fill('#height', '3.87');
      await page.fill('#width', '4.12');

      await page.click('button:has-text("Calculate")');

      await expect(page.locator('text=Prostate Volume (mL):')).toBeVisible();
      await expect(page.locator('text=35.1')).toBeVisible();
    });
  });

  test.describe('PSA-Density Calculation', () => {

    test('should calculate PSA-Density correctly - normal range', async ({ page }) => {
      // Test case: L=4.0, H=3.0, W=3.5 (volume=21.8), PSA=2.5
      // Expected PSA-D = 2.5 / 21.8 = 0.1146... ≈ 0.115
      await page.fill('#length', '4.0');
      await page.fill('#height', '3.0');
      await page.fill('#width', '3.5');
      await page.fill('#psa', '2.5');

      await page.click('button:has-text("Calculate")');

      await expect(page.locator('text=PSA‑Density:')).toBeVisible();
      await expect(page.locator('text=0.115')).toBeVisible();
    });

    test('should calculate PSA-Density correctly - elevated PSA', async ({ page }) => {
      // Test case: L=5.0, H=4.0, W=4.5 (volume=46.8), PSA=8.0
      // Expected PSA-D = 8.0 / 46.8 = 0.1709... ≈ 0.171
      await page.fill('#length', '5.0');
      await page.fill('#height', '4.0');
      await page.fill('#width', '4.5');
      await page.fill('#psa', '8.0');

      await page.click('button:has-text("Calculate")');

      await expect(page.locator('text=PSA‑Density:')).toBeVisible();
      await expect(page.locator('text=0.171')).toBeVisible();
    });

    test('should calculate PSA-Density correctly - low PSA', async ({ page }) => {
      // Test case: L=3.5, H=3.0, W=3.2 (volume=17.47), PSA=1.2
      // Expected PSA-D = 1.2 / 17.472 = 0.0687... ≈ 0.069
      await page.fill('#length', '3.5');
      await page.fill('#height', '3.0');
      await page.fill('#width', '3.2');
      await page.fill('#psa', '1.2');

      await page.click('button:has-text("Calculate")');

      await expect(page.locator('text=PSA‑Density:')).toBeVisible();
      await expect(page.locator('text=0.069')).toBeVisible();
    });

    test('should show dashes when PSA is zero', async ({ page }) => {
      // Test case: Volume calculated but no PSA entered
      await page.fill('#length', '4.0');
      await page.fill('#height', '3.0');
      await page.fill('#width', '3.5');
      await page.fill('#psa', '0');

      await page.click('button:has-text("Calculate")');

      await expect(page.locator('text=PSA‑Density:')).toBeVisible();
      await expect(page.locator('text=‑‑')).toBeVisible();
    });

    test('should show dashes when PSA is not provided', async ({ page }) => {
      // Test case: Volume calculated but PSA field left empty
      await page.fill('#length', '4.0');
      await page.fill('#height', '3.0');
      await page.fill('#width', '3.5');

      await page.click('button:has-text("Calculate")');

      await expect(page.locator('text=PSA‑Density:')).toBeVisible();
      await expect(page.locator('text=‑‑')).toBeVisible();
    });

    test('should handle very small PSA values', async ({ page }) => {
      // Test case: Very small PSA (L=4.0, H=3.0, W=3.5, PSA=0.1)
      // Expected PSA-D = 0.1 / 21.84 = 0.00458... ≈ 0.005
      await page.fill('#length', '4.0');
      await page.fill('#height', '3.0');
      await page.fill('#width', '3.5');
      await page.fill('#psa', '0.1');

      await page.click('button:has-text("Calculate")');

      await expect(page.locator('text=PSA‑Density:')).toBeVisible();
      await expect(page.locator('text=0.005')).toBeVisible();
    });

    test('should handle very high PSA values', async ({ page }) => {
      // Test case: Very high PSA (L=7.0, H=6.0, W=6.5, PSA=50.0)
      // Volume = 7.0 × 6.0 × 6.5 × 0.52 = 142.74
      // Expected PSA-D = 50.0 / 142.74 = 0.3502... ≈ 0.350
      await page.fill('#length', '7.0');
      await page.fill('#height', '6.0');
      await page.fill('#width', '6.5');
      await page.fill('#psa', '50.0');

      await page.click('button:has-text("Calculate")');

      await expect(page.locator('text=PSA‑Density:')).toBeVisible();
      await expect(page.locator('text=0.350')).toBeVisible();
    });
  });

  test.describe('Edge Cases', () => {

    test('should handle very large dimensions', async ({ page }) => {
      // Test case: Unusually large prostate (L=10.0, H=9.0, W=9.5)
      // Expected volume = 10.0 × 9.0 × 9.5 × 0.52 = 445.2 mL
      await page.fill('#length', '10.0');
      await page.fill('#height', '9.0');
      await page.fill('#width', '9.5');

      await page.click('button:has-text("Calculate")');

      await expect(page.locator('text=Prostate Volume (mL):')).toBeVisible();
      await expect(page.locator('text=445.2')).toBeVisible();
    });

    test('should handle very small dimensions', async ({ page }) => {
      // Test case: Very small prostate (L=1.0, H=0.8, W=0.9)
      // Expected volume = 1.0 × 0.8 × 0.9 × 0.52 = 0.3744 ≈ 0.4 mL
      await page.fill('#length', '1.0');
      await page.fill('#height', '0.8');
      await page.fill('#width', '0.9');

      await page.click('button:has-text("Calculate")');

      await expect(page.locator('text=Prostate Volume (mL):')).toBeVisible();
      await expect(page.locator('text=0.4')).toBeVisible();
    });

    test('should clear previous results when recalculating', async ({ page }) => {
      // First calculation
      await page.fill('#length', '4.0');
      await page.fill('#height', '3.0');
      await page.fill('#width', '3.5');
      await page.fill('#psa', '2.5');
      await page.click('button:has-text("Calculate")');

      await expect(page.locator('text=21.8')).toBeVisible();

      // Change values and recalculate
      await page.fill('#length', '5.0');
      await page.fill('#height', '4.0');
      await page.fill('#width', '4.5');
      await page.fill('#psa', '5.0');
      await page.click('button:has-text("Calculate")');

      // New results should be displayed
      await expect(page.locator('text=46.8')).toBeVisible();
      await expect(page.locator('text=0.107')).toBeVisible();
    });

    test('should handle switching calculators and returning', async ({ page }) => {
      // Fill in values
      await page.fill('#length', '4.0');
      await page.fill('#height', '3.0');
      await page.fill('#width', '3.5');

      // Switch to another calculator
      await page.click('button:has-text("Adrenal CT Washout")');
      await expect(page.locator('h2:has-text("Adrenal CT Washout")')).toBeVisible();

      // Return to Prostate Volume
      await page.click('button:has-text("Prostate Volume")');
      await expect(page.locator('h2:has-text("Prostate Volume")')).toBeVisible();

      // Fields should be cleared
      const lengthInput = page.locator('#length');
      await expect(lengthInput).toHaveValue('');
    });
  });

  test.describe('Input Validation', () => {

    test('should accept positive numeric values', async ({ page }) => {
      await page.fill('#length', '4.5');
      await page.fill('#height', '3.2');
      await page.fill('#width', '3.8');
      await page.fill('#psa', '2.5');

      await page.click('button:has-text("Calculate")');

      // Should calculate successfully
      await expect(page.locator('section[aria-live="polite"]')).toBeVisible();
    });

    test('should accept decimal values', async ({ page }) => {
      await page.fill('#length', '4.567');
      await page.fill('#height', '3.234');
      await page.fill('#width', '3.891');
      await page.fill('#psa', '2.543');

      await page.click('button:has-text("Calculate")');

      // Should calculate successfully
      await expect(page.locator('section[aria-live="polite"]')).toBeVisible();
    });

    test('should handle empty fields as zero', async ({ page }) => {
      // Leave all fields empty
      await page.click('button:has-text("Calculate")');

      // Should still calculate (treating empty as 0)
      await expect(page.locator('text=Prostate Volume (mL):')).toBeVisible();
      await expect(page.locator('text=0.0')).toBeVisible();
    });

    test('should maintain precision in calculations', async ({ page }) => {
      // Test with precise decimal values
      await page.fill('#length', '4.123');
      await page.fill('#height', '3.456');
      await page.fill('#width', '3.789');
      await page.fill('#psa', '2.543');

      await page.click('button:has-text("Calculate")');

      // Results should be displayed with proper precision
      const results = page.locator('section[aria-live="polite"]');
      await expect(results).toContainText('Prostate Volume (mL):');
      await expect(results).toContainText('PSA‑Density:');
    });
  });

  test.describe('Accessibility', () => {

    test('should have proper ARIA labels', async ({ page }) => {
      const calculateButton = page.locator('button:has-text("Calculate")');
      await expect(calculateButton).not.toHaveAttribute('aria-disabled', 'true');

      const inputFields = page.locator('[aria-label="Input fields"]');
      await expect(inputFields).toBeVisible();
    });

    test('should have accessible form labels', async ({ page }) => {
      // Check all inputs have associated labels
      const lengthLabel = page.locator('label[for="length"]');
      await expect(lengthLabel).toBeVisible();

      const heightLabel = page.locator('label[for="height"]');
      await expect(heightLabel).toBeVisible();

      const widthLabel = page.locator('label[for="width"]');
      await expect(widthLabel).toBeVisible();

      const psaLabel = page.locator('label[for="psa"]');
      await expect(psaLabel).toBeVisible();
    });

    test('should have live region for results', async ({ page }) => {
      await page.fill('#length', '4.0');
      await page.fill('#height', '3.0');
      await page.fill('#width', '3.5');

      await page.click('button:has-text("Calculate")');

      const resultsSection = page.locator('section[aria-live="polite"]');
      await expect(resultsSection).toBeVisible();
    });

    test('should be keyboard navigable', async ({ page }) => {
      // Tab through inputs
      await page.keyboard.press('Tab');
      await page.keyboard.type('4.0');

      await page.keyboard.press('Tab');
      await page.keyboard.type('3.0');

      await page.keyboard.press('Tab');
      await page.keyboard.type('3.5');

      await page.keyboard.press('Tab');
      await page.keyboard.type('2.5');

      // Tab to Calculate button and press Enter
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');

      // Results should be displayed
      await expect(page.locator('section[aria-live="polite"]')).toBeVisible();
    });
  });

  test.describe('Clinical Interpretation', () => {

    test('should display normal prostate volume message', async ({ page }) => {
      // Normal prostate: ≤30 cm³
      await page.fill('#length', '4.0');
      await page.fill('#height', '3.0');
      await page.fill('#width', '3.5');

      await page.click('button:has-text("Calculate")');

      // Should show normal message (volume = 21.8 mL)
      await expect(page.locator('text=Normal prostate volume')).toBeVisible();
    });

    test('should not display normal message for enlarged prostate', async ({ page }) => {
      // Enlarged prostate: >30 cm³
      await page.fill('#length', '6.0');
      await page.fill('#height', '5.0');
      await page.fill('#width', '5.5');

      await page.click('button:has-text("Calculate")');

      // Should NOT show normal message (volume = 85.8 mL)
      await expect(page.locator('text=Normal prostate volume')).not.toBeVisible();
    });

    test('should show clinical context for PSA-Density thresholds', async ({ page }) => {
      const infoBox = page.locator('.bg-blue-50\\/60');

      // Verify PSA-D threshold guidance is present
      await expect(infoBox).toContainText('0.08 to 0.15');
      await expect(infoBox).toContainText('clinical context');
    });
  });

  test.describe('PI-RADS Sector Map Link', () => {

    test('should have PI-RADS sector map button', async ({ page }) => {
      const button = page.locator('button:has-text("PI-RADS Sector Map")');
      await expect(button).toBeVisible();
    });

    test('should open PI-RADS map in new window', async ({ page, context }) => {
      const button = page.locator('button:has-text("PI-RADS Sector Map")');

      // Click the button and wait for new page
      const [newPage] = await Promise.all([
        context.waitForEvent('page'),
        button.click()
      ]);

      // Verify new page URL contains pirads_map
      expect(newPage.url()).toContain('pirads_map');
    });
  });

  test.describe('Multi-Device Testing', () => {

    test('should work on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });

      await page.fill('#length', '4.0');
      await page.fill('#height', '3.0');
      await page.fill('#width', '3.5');
      await page.fill('#psa', '2.5');

      await page.click('button:has-text("Calculate")');

      await expect(page.locator('text=21.8')).toBeVisible();
    });

    test('should work on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      await page.fill('#length', '4.0');
      await page.fill('#height', '3.0');
      await page.fill('#width', '3.5');
      await page.fill('#psa', '2.5');

      await page.click('button:has-text("Calculate")');

      await expect(page.locator('text=21.8')).toBeVisible();
    });

    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await page.fill('#length', '4.0');
      await page.fill('#height', '3.0');
      await page.fill('#width', '3.5');
      await page.fill('#psa', '2.5');

      await page.click('button:has-text("Calculate")');

      await expect(page.locator('text=21.8')).toBeVisible();
    });
  });
});
