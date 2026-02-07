/**
 * E2E Test: Spleen Size (ULN) Calculator
 *
 * Tests the gender- and height-adjusted upper limits of normal spleen length and volume calculator.
 * Based on Chow KU et al., Radiology 2016;279(1):306-13.
 *
 * Formula validation:
 * Female (155-180 cm):
 *   - Length (cm) = (0.0282 × height) + 7.5526
 *   - Volume (cm³) = (7.0996 × height) - 939.5
 *
 * Male (165-200 cm):
 *   - Length (cm) = (0.0544 × height) + 3.6693
 *   - Volume (cm³) = (4.3803 × height) - 457.15
 */

import { test, expect } from '@playwright/test';
import { navigateToCalculator } from '../../../helpers/calculator-test-helper.js';

// Test data covering validated ranges and edge cases
const testCases = [
  // Female - Within validated range (155-180 cm)
  {
    gender: 'female',
    height: 155,
    expectedLength: 11.9,
    expectedVolume: 161,
    shouldShowWarning: false,
    description: 'Female at lower bound of validated range'
  },
  {
    gender: 'female',
    height: 170,
    expectedLength: 12.3,
    expectedVolume: 267,
    shouldShowWarning: false,
    description: 'Female at mid-range height'
  },
  {
    gender: 'female',
    height: 180,
    expectedLength: 12.6,
    expectedVolume: 368,
    shouldShowWarning: false,
    description: 'Female at upper bound of validated range'
  },

  // Female - Outside validated range
  {
    gender: 'female',
    height: 150,
    expectedLength: 11.8,
    expectedVolume: 125,
    shouldShowWarning: true,
    warningText: 'Height outside validated range (155-180 cm)',
    description: 'Female below validated range'
  },
  {
    gender: 'female',
    height: 185,
    expectedLength: 12.8,
    expectedVolume: 374,
    shouldShowWarning: true,
    warningText: 'Height outside validated range (155-180 cm)',
    description: 'Female above validated range'
  },

  // Male - Within validated range (165-200 cm)
  {
    gender: 'male',
    height: 165,
    expectedLength: 12.6,
    expectedVolume: 266,
    shouldShowWarning: false,
    description: 'Male at lower bound of validated range'
  },
  {
    gender: 'male',
    height: 180,
    expectedLength: 13.5,
    expectedVolume: 331,
    shouldShowWarning: false,
    description: 'Male at mid-range height'
  },
  {
    gender: 'male',
    height: 200,
    expectedLength: 14.6,
    expectedVolume: 419,
    shouldShowWarning: false,
    description: 'Male at upper bound of validated range'
  },

  // Male - Outside validated range
  {
    gender: 'male',
    height: 160,
    expectedLength: 12.4,
    expectedVolume: 244,
    shouldShowWarning: true,
    warningText: 'Height outside validated range (165-200 cm)',
    description: 'Male below validated range'
  },
  {
    gender: 'male',
    height: 210,
    expectedLength: 15.1,
    expectedVolume: 463,
    shouldShowWarning: true,
    warningText: 'Height outside validated range (165-200 cm)',
    description: 'Male above validated range'
  }
];

test.describe('Spleen Size Calculator', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, 'Spleen Size');
    await expect(page.getByRole('heading', { name: 'Spleen Size' })).toBeVisible();
  });

  test('displays calculator title and description', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Spleen Size' })).toBeVisible();
    await expect(page.getByText('Gender- and height-adjusted upper limits')).toBeVisible();
  });

  test('displays validation information', async ({ page }) => {
    const validationText = await page.getByText(/validated for women between 155 and 180 cm/);
    await expect(validationText).toBeVisible();
  });

  test('shows gender radio buttons', async ({ page }) => {
    await expect(page.getByRole('radio', { name: 'female' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'male' })).toBeVisible();
  });

  test('shows height input field', async ({ page }) => {
    await expect(page.getByRole('spinbutton', { name: 'Body Height (cm)' })).toBeVisible();
  });

  test('displays reference citation', async ({ page }) => {
    const citation = await page.getByText(/Chow KU.*Radiology.*2016/);
    await expect(citation).toBeVisible();

    // Verify DOI link
    const doiLink = page.getByRole('link', { name: /Chow KU/ });
    await expect(doiLink).toHaveAttribute('href', 'https://doi.org/10.1148/radiol.2015150887');
  });

  // Test all calculation scenarios
  testCases.forEach(testCase => {
    test(`calculates correctly: ${testCase.description}`, async ({ page }) => {
      // Select gender
      await page.getByRole('radio', { name: testCase.gender }).click();

      // Enter height
      await page.getByRole('spinbutton', { name: 'Body Height (cm)' }).fill(testCase.height.toString());

      // Click calculate
      await page.getByRole('button', { name: 'Calculate' }).click();

      // Verify spleen length result
      const lengthText = await page.getByText(/Spleen length should not exceed \(cm\):/);
      await expect(lengthText).toBeVisible();
      const lengthValue = await page.getByText(testCase.expectedLength.toString());
      await expect(lengthValue).toBeVisible();

      // Verify spleen volume result
      const volumeText = await page.getByText(/Spleen volume should not exceed \(cm³\):/);
      await expect(volumeText).toBeVisible();
      const volumeValue = await page.getByText(testCase.expectedVolume.toString());
      await expect(volumeValue).toBeVisible();

      // Verify warning message if expected
      if (testCase.shouldShowWarning) {
        await expect(page.getByText(testCase.warningText)).toBeVisible();
        await expect(page.getByText(/extrapolated beyond validated range/)).toBeVisible();
      } else {
        await expect(page.getByText(/Height outside validated range/)).not.toBeVisible();
      }

      // Verify interpretation always appears
      await expect(page.getByText(/within 95% of observations in healthy individuals/)).toBeVisible();
    });
  });

  test('does not calculate without gender selected', async ({ page }) => {
    await page.getByRole('spinbutton', { name: 'Body Height (cm)' }).fill('170');
    await page.getByRole('button', { name: 'Calculate' }).click();

    // Should not show results
    await expect(page.getByText(/Spleen length should not exceed/)).not.toBeVisible();
  });

  test('does not calculate without height entered', async ({ page }) => {
    await page.getByRole('radio', { name: 'female' }).click();
    await page.getByRole('button', { name: 'Calculate' }).click();

    // Should not show results
    await expect(page.getByText(/Spleen length should not exceed/)).not.toBeVisible();
  });

  test('updates calculation when switching gender', async ({ page }) => {
    const height = 175;

    // Female calculation
    await page.getByRole('radio', { name: 'female' }).click();
    await page.getByRole('spinbutton', { name: 'Body Height (cm)' }).fill(height.toString());
    await page.getByRole('button', { name: 'Calculate' }).click();

    const femaleLength = await page.getByText('12.5').textContent();

    // Switch to male
    await page.getByRole('radio', { name: 'male' }).click();
    await page.getByRole('button', { name: 'Calculate' }).click();

    const maleLength = await page.getByText('13.2').textContent();

    // Values should be different
    expect(femaleLength).not.toBe(maleLength);
  });

  test('handles decimal height values', async ({ page }) => {
    await page.getByRole('radio', { name: 'female' }).click();
    await page.getByRole('spinbutton', { name: 'Body Height (cm)' }).fill('167.5');
    await page.getByRole('button', { name: 'Calculate' }).click();

    // Should calculate and display results
    await expect(page.getByText(/Spleen length should not exceed/)).toBeVisible();
    await expect(page.getByText(/Spleen volume should not exceed/)).toBeVisible();
  });

  test('responsive design - mobile view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await expect(page.getByRole('heading', { name: 'Spleen Size' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'female' })).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: 'Body Height (cm)' })).toBeVisible();
  });

  test('responsive design - tablet view', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    await expect(page.getByRole('heading', { name: 'Spleen Size' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'female' })).toBeVisible();
  });

  test('citation link opens in new context', async ({ page, context }) => {
    const citationLink = page.getByRole('link', { name: /Chow KU/ });

    // Verify link has correct href
    await expect(citationLink).toHaveAttribute('href', 'https://doi.org/10.1148/radiol.2015150887');

    // Verify link target
    await expect(citationLink).toHaveAttribute('target', '_blank');
  });
});
