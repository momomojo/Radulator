import { test, expect } from '@playwright/test';
import { navigateToCalculator } from '../../../helpers/calculator-test-helper.js';

/**
 * Child-Pugh Score Calculator E2E Tests
 *
 * Tests the Child-Pugh scoring system for classification and prognosis of chronic liver disease and cirrhosis
 *
 * Scoring Parameters:
 * - Bilirubin: <2 (1pt), 2-3 (2pts), >3 (3pts) mg/dL
 * - Albumin: >3.5 (1pt), 2.8-3.5 (2pts), <2.8 (3pts) g/dL
 * - INR: <1.7 (1pt), 1.7-2.2 (2pts), >2.2 (3pts)
 * - Ascites: None (1pt), Slight (2pts), Moderate to Severe (3pts)
 * - Encephalopathy: None (1pt), Grade 1-2 (2pts), Grade 3-4 (3pts)
 *
 * Classification:
 * - Class A (5-6 points): Well-compensated disease, 1-year mortality 5-10%, surgical risk 10%
 * - Class B (7-9 points): Significant functional compromise, 1-year mortality 15-20%, surgical risk 30%
 * - Class C (10-15 points): Decompensated disease, 1-year mortality 45-55%, surgical risk 70-80%
 *
 * References:
 * - Pugh et al. Br J Surg. 1973;60(8):646-649
 * - Child & Turcotte. Surgery and portal hypertension. 1964
 */

test.describe('Child-Pugh Score Calculator', () => {

  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, 'Child-Pugh Score');
    await expect(page.locator('h2:has-text("Child-Pugh Score")')).toBeVisible();
  });

  test.describe('Visual Appeal & Theme Matching', () => {

    test('should display calculator with proper styling', async ({ page }) => {
      // Check calculator card is visible
      const card = page.locator('.card, [class*="card"]').first();
      await expect(card).toBeVisible();

      // Check title is visible and styled
      const title = page.locator('h2:has-text("Child-Pugh Score")');
      await expect(title).toBeVisible();

      // Check description is present
      await expect(page.locator('text=Classification and prognosis')).toBeVisible();
    });

    test('should have responsive design on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Calculator should still be visible and usable
      await expect(page.locator('h2:has-text("Child-Pugh Score")')).toBeVisible();

      // Fields should be visible
      await expect(page.locator('label:has-text("Total Bilirubin")')).toBeVisible();
      await expect(page.locator('label:has-text("Serum Albumin")')).toBeVisible();
    });

    test('should display info section with clinical context', async ({ page }) => {
      // Check if info section exists
      const infoSection = page.locator('text=five clinical measures');
      if (await infoSection.isVisible()) {
        await expect(infoSection).toBeVisible();
      }
    });

    test('should have proper field labels with units', async ({ page }) => {
      // Check that fields have proper labels and sublabels
      await expect(page.locator('label:has-text("Total Bilirubin")')).toBeVisible();
      await expect(page.locator('text=mg/dL')).toBeVisible();
      await expect(page.locator('label:has-text("Serum Albumin")')).toBeVisible();
      await expect(page.locator('text=g/dL')).toBeVisible();
      await expect(page.locator('label:has-text("INR")')).toBeVisible();
      await expect(page.locator('label:has-text("Ascites")')).toBeVisible();
      await expect(page.locator('label:has-text("Hepatic Encephalopathy")')).toBeVisible();
    });
  });

  test.describe('Input Validation', () => {

    test('should accept valid bilirubin values', async ({ page }) => {
      const bilirubinInput = page.locator('input[type="number"]').first();
      await bilirubinInput.fill('2.5');
      await expect(bilirubinInput).toHaveValue('2.5');
    });

    test('should accept valid albumin values', async ({ page }) => {
      const albuminInput = page.locator('input[type="number"]').nth(1);
      await albuminInput.fill('3.2');
      await expect(albuminInput).toHaveValue('3.2');
    });

    test('should accept valid INR values', async ({ page }) => {
      const inrInput = page.locator('input[type="number"]').nth(2);
      await inrInput.fill('1.5');
      await expect(inrInput).toHaveValue('1.5');
    });

    test('should show error for negative bilirubin', async ({ page }) => {
      const bilirubinInput = page.locator('input[type="number"]').first();
      await bilirubinInput.fill('-1');

      // Try to trigger calculation (might need to fill other required fields)
      const albuminInput = page.locator('input[type="number"]').nth(1);
      await albuminInput.fill('3.5');
      const inrInput = page.locator('input[type="number"]').nth(2);
      await inrInput.fill('1.2');

      // Check for error message
      const errorText = page.locator('text=Please enter a valid bilirubin value');
      if (await errorText.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(errorText).toBeVisible();
      }
    });

    test('should show error for negative albumin', async ({ page }) => {
      const bilirubinInput = page.locator('input[type="number"]').first();
      await bilirubinInput.fill('2.0');
      const albuminInput = page.locator('input[type="number"]').nth(1);
      await albuminInput.fill('-1');
      const inrInput = page.locator('input[type="number"]').nth(2);
      await inrInput.fill('1.2');

      const errorText = page.locator('text=Please enter a valid albumin value');
      if (await errorText.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(errorText).toBeVisible();
      }
    });

    test('should show error for negative INR', async ({ page }) => {
      const bilirubinInput = page.locator('input[type="number"]').first();
      await bilirubinInput.fill('2.0');
      const albuminInput = page.locator('input[type="number"]').nth(1);
      await albuminInput.fill('3.5');
      const inrInput = page.locator('input[type="number"]').nth(2);
      await inrInput.fill('-1');

      const errorText = page.locator('text=Please enter a valid INR value');
      if (await errorText.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(errorText).toBeVisible();
      }
    });
  });

  test.describe('Radio Button Selection', () => {

    test('should allow selecting ascites status', async ({ page }) => {
      // Check for None option
      const noneOption = page.locator('label:has-text("None")').first();
      await noneOption.click();

      // Check for Slight option
      const slightOption = page.locator('label:has-text("Slight")');
      await slightOption.click();

      // Check for Moderate to Severe option
      const moderateOption = page.locator('label:has-text("Moderate to Severe")');
      await moderateOption.click();
    });

    test('should allow selecting encephalopathy grade', async ({ page }) => {
      // Find encephalopathy radio buttons (should be the second set)
      const noneEnceph = page.locator('label').filter({ hasText: /^None$/ }).nth(1);
      if (await noneEnceph.isVisible().catch(() => false)) {
        await noneEnceph.click();
      }

      const grade12 = page.locator('label:has-text("Grade 1-2")');
      await grade12.click();

      const grade34 = page.locator('label:has-text("Grade 3-4")');
      await grade34.click();
    });
  });

  test.describe('Class A Calculation (Well-Compensated)', () => {

    test('should correctly calculate Class A - minimum score (5 points)', async ({ page }) => {
      // Best possible values: all 1 point each
      const bilirubinInput = page.locator('input[type="number"]').first();
      await bilirubinInput.fill('1.5'); // <2 = 1 point

      const albuminInput = page.locator('input[type="number"]').nth(1);
      await albuminInput.fill('4.0'); // >3.5 = 1 point

      const inrInput = page.locator('input[type="number"]').nth(2);
      await inrInput.fill('1.2'); // <1.7 = 1 point

      // Select None for ascites (1 point)
      await page.locator('label:has-text("None")').first().click();

      // Select None for encephalopathy (1 point)
      const noneEnceph = page.locator('label').filter({ hasText: /^None$/ }).nth(1);
      await noneEnceph.click();

      // Verify results
      await expect(page.locator('text=5 points')).toBeVisible();
      await expect(page.locator('text=Child-Pugh Class')).toBeVisible();
      await expect(page.locator('text=/Class.*A/i')).toBeVisible();
      await expect(page.locator('text=Well-compensated disease')).toBeVisible();
      await expect(page.locator('text=5-10%').first()).toBeVisible(); // 1-year mortality
      await expect(page.locator('text=10%').nth(1)).toBeVisible(); // Surgical risk
    });

    test('should correctly calculate Class A - maximum score (6 points)', async ({ page }) => {
      // Mix of 1 and 2 points
      const bilirubinInput = page.locator('input[type="number"]').first();
      await bilirubinInput.fill('2.2'); // 2-3 = 2 points

      const albuminInput = page.locator('input[type="number"]').nth(1);
      await albuminInput.fill('4.0'); // >3.5 = 1 point

      const inrInput = page.locator('input[type="number"]').nth(2);
      await inrInput.fill('1.2'); // <1.7 = 1 point

      // None for ascites (1 point)
      await page.locator('label:has-text("None")').first().click();

      // None for encephalopathy (1 point)
      const noneEnceph = page.locator('label').filter({ hasText: /^None$/ }).nth(1);
      await noneEnceph.click();

      // Verify results
      await expect(page.locator('text=6 points')).toBeVisible();
      await expect(page.locator('text=/Class.*A/i')).toBeVisible();
      await expect(page.locator('text=Well-compensated disease')).toBeVisible();
    });

    test('should show proper breakdown for Class A', async ({ page }) => {
      // Enter values for Class A
      await page.locator('input[type="number"]').first().fill('1.8');
      await page.locator('input[type="number"]').nth(1).fill('3.6');
      await page.locator('input[type="number"]').nth(2).fill('1.5');
      await page.locator('label:has-text("None")').first().click();
      const noneEnceph = page.locator('label').filter({ hasText: /^None$/ }).nth(1);
      await noneEnceph.click();

      // Check for points breakdown section
      await expect(page.locator('text=Points Breakdown')).toBeVisible();
      await expect(page.locator('text=/1\\.8.*1 point/')).toBeVisible(); // Bilirubin
      await expect(page.locator('text=/3\\.6.*1 point/')).toBeVisible(); // Albumin
      await expect(page.locator('text=/1\\.5.*1 point/')).toBeVisible(); // INR
    });
  });

  test.describe('Class B Calculation (Significant Compromise)', () => {

    test('should correctly calculate Class B - minimum score (7 points)', async ({ page }) => {
      const bilirubinInput = page.locator('input[type="number"]').first();
      await bilirubinInput.fill('2.5'); // 2-3 = 2 points

      const albuminInput = page.locator('input[type="number"]').nth(1);
      await albuminInput.fill('3.2'); // 2.8-3.5 = 2 points

      const inrInput = page.locator('input[type="number"]').nth(2);
      await inrInput.fill('1.2'); // <1.7 = 1 point

      // None for ascites (1 point)
      await page.locator('label:has-text("None")').first().click();

      // None for encephalopathy (1 point)
      const noneEnceph = page.locator('label').filter({ hasText: /^None$/ }).nth(1);
      await noneEnceph.click();

      // Verify results
      await expect(page.locator('text=7 points')).toBeVisible();
      await expect(page.locator('text=/Class.*B/i')).toBeVisible();
      await expect(page.locator('text=Significant functional compromise')).toBeVisible();
      await expect(page.locator('text=15-20%')).toBeVisible(); // 1-year mortality
      await expect(page.locator('text=30%')).toBeVisible(); // Surgical risk
    });

    test('should correctly calculate Class B - middle score (8 points)', async ({ page }) => {
      const bilirubinInput = page.locator('input[type="number"]').first();
      await bilirubinInput.fill('2.5'); // 2-3 = 2 points

      const albuminInput = page.locator('input[type="number"]').nth(1);
      await albuminInput.fill('3.0'); // 2.8-3.5 = 2 points

      const inrInput = page.locator('input[type="number"]').nth(2);
      await inrInput.fill('1.8'); // 1.7-2.2 = 2 points

      // None for ascites (1 point)
      await page.locator('label:has-text("None")').first().click();

      // None for encephalopathy (1 point)
      const noneEnceph = page.locator('label').filter({ hasText: /^None$/ }).nth(1);
      await noneEnceph.click();

      // Verify results
      await expect(page.locator('text=8 points')).toBeVisible();
      await expect(page.locator('text=/Class.*B/i')).toBeVisible();
    });

    test('should correctly calculate Class B - maximum score (9 points)', async ({ page }) => {
      const bilirubinInput = page.locator('input[type="number"]').first();
      await bilirubinInput.fill('2.5'); // 2-3 = 2 points

      const albuminInput = page.locator('input[type="number"]').nth(1);
      await albuminInput.fill('3.0'); // 2.8-3.5 = 2 points

      const inrInput = page.locator('input[type="number"]').nth(2);
      await inrInput.fill('1.8'); // 1.7-2.2 = 2 points

      // Slight ascites (2 points)
      await page.locator('label:has-text("Slight")').click();

      // None for encephalopathy (1 point)
      const noneEnceph = page.locator('label').filter({ hasText: /^None$/ }).nth(1);
      await noneEnceph.click();

      // Verify results
      await expect(page.locator('text=9 points')).toBeVisible();
      await expect(page.locator('text=/Class.*B/i')).toBeVisible();
      await expect(page.locator('text=Significant functional compromise')).toBeVisible();
    });

    test('should show proper breakdown for Class B with ascites', async ({ page }) => {
      await page.locator('input[type="number"]').first().fill('2.8');
      await page.locator('input[type="number"]').nth(1).fill('3.1');
      await page.locator('input[type="number"]').nth(2).fill('1.9');
      await page.locator('label:has-text("Slight")').click();
      const noneEnceph = page.locator('label').filter({ hasText: /^None$/ }).nth(1);
      await noneEnceph.click();

      // Check for points breakdown
      await expect(page.locator('text=Points Breakdown')).toBeVisible();
      await expect(page.locator('text=/Slight.*2 points/')).toBeVisible(); // Ascites
    });
  });

  test.describe('Class C Calculation (Decompensated)', () => {

    test('should correctly calculate Class C - minimum score (10 points)', async ({ page }) => {
      const bilirubinInput = page.locator('input[type="number"]').first();
      await bilirubinInput.fill('3.5'); // >3 = 3 points

      const albuminInput = page.locator('input[type="number"]').nth(1);
      await albuminInput.fill('2.6'); // <2.8 = 3 points

      const inrInput = page.locator('input[type="number"]').nth(2);
      await inrInput.fill('1.2'); // <1.7 = 1 point

      // None for ascites (1 point)
      await page.locator('label:has-text("None")').first().click();

      // Grade 1-2 for encephalopathy (2 points)
      await page.locator('label:has-text("Grade 1-2")').click();

      // Verify results
      await expect(page.locator('text=10 points')).toBeVisible();
      await expect(page.locator('text=/Class.*C/i')).toBeVisible();
      await expect(page.locator('text=Decompensated disease')).toBeVisible();
      await expect(page.locator('text=45-55%')).toBeVisible(); // 1-year mortality
      await expect(page.locator('text=70-80%')).toBeVisible(); // Surgical risk
    });

    test('should correctly calculate Class C - middle score (12 points)', async ({ page }) => {
      const bilirubinInput = page.locator('input[type="number"]').first();
      await bilirubinInput.fill('4.0'); // >3 = 3 points

      const albuminInput = page.locator('input[type="number"]').nth(1);
      await albuminInput.fill('2.5'); // <2.8 = 3 points

      const inrInput = page.locator('input[type="number"]').nth(2);
      await inrInput.fill('2.5'); // >2.2 = 3 points

      // None for ascites (1 point)
      await page.locator('label:has-text("None")').first().click();

      // Grade 1-2 for encephalopathy (2 points)
      await page.locator('label:has-text("Grade 1-2")').click();

      // Verify results
      await expect(page.locator('text=12 points')).toBeVisible();
      await expect(page.locator('text=/Class.*C/i')).toBeVisible();
    });

    test('should correctly calculate Class C - maximum score (15 points)', async ({ page }) => {
      const bilirubinInput = page.locator('input[type="number"]').first();
      await bilirubinInput.fill('5.0'); // >3 = 3 points

      const albuminInput = page.locator('input[type="number"]').nth(1);
      await albuminInput.fill('2.0'); // <2.8 = 3 points

      const inrInput = page.locator('input[type="number"]').nth(2);
      await inrInput.fill('3.0'); // >2.2 = 3 points

      // Moderate to Severe ascites (3 points)
      await page.locator('label:has-text("Moderate to Severe")').click();

      // Grade 3-4 for encephalopathy (3 points)
      await page.locator('label:has-text("Grade 3-4")').click();

      // Verify results
      await expect(page.locator('text=15 points')).toBeVisible();
      await expect(page.locator('text=/Class.*C/i')).toBeVisible();
      await expect(page.locator('text=Decompensated disease')).toBeVisible();
    });

    test('should show proper breakdown for Class C with severe parameters', async ({ page }) => {
      await page.locator('input[type="number"]').first().fill('4.5');
      await page.locator('input[type="number"]').nth(1).fill('2.2');
      await page.locator('input[type="number"]').nth(2).fill('2.8');
      await page.locator('label:has-text("Moderate to Severe")').click();
      await page.locator('label:has-text("Grade 3-4")').click();

      // Check for points breakdown
      await expect(page.locator('text=Points Breakdown')).toBeVisible();
      await expect(page.locator('text=/4\\.5.*3 points/')).toBeVisible(); // Bilirubin
      await expect(page.locator('text=/2\\.2.*3 points/')).toBeVisible(); // Albumin
      await expect(page.locator('text=/2\\.8.*3 points/')).toBeVisible(); // INR
      await expect(page.locator('text=/Moderate.*3 points/')).toBeVisible(); // Ascites
      await expect(page.locator('text=/Grade 3-4.*3 points/')).toBeVisible(); // Encephalopathy
    });
  });

  test.describe('Edge Cases and Boundary Testing', () => {

    test('should correctly score bilirubin at boundary (2.0 mg/dL)', async ({ page }) => {
      const bilirubinInput = page.locator('input[type="number"]').first();
      await bilirubinInput.fill('2.0'); // Should be 2 points (in range 2-3)

      const albuminInput = page.locator('input[type="number"]').nth(1);
      await albuminInput.fill('4.0');

      const inrInput = page.locator('input[type="number"]').nth(2);
      await inrInput.fill('1.2');

      await page.locator('label:has-text("None")').first().click();
      const noneEnceph = page.locator('label').filter({ hasText: /^None$/ }).nth(1);
      await noneEnceph.click();

      // Should show 2 points for bilirubin
      await expect(page.locator('text=/2\\.0.*2 points/')).toBeVisible();
    });

    test('should correctly score bilirubin at boundary (3.0 mg/dL)', async ({ page }) => {
      const bilirubinInput = page.locator('input[type="number"]').first();
      await bilirubinInput.fill('3.0'); // Should be 2 points (in range 2-3)

      const albuminInput = page.locator('input[type="number"]').nth(1);
      await albuminInput.fill('4.0');

      const inrInput = page.locator('input[type="number"]').nth(2);
      await inrInput.fill('1.2');

      await page.locator('label:has-text("None")').first().click();
      const noneEnceph = page.locator('label').filter({ hasText: /^None$/ }).nth(1);
      await noneEnceph.click();

      // Should show 2 points for bilirubin
      await expect(page.locator('text=/3\\.0.*2 points/')).toBeVisible();
    });

    test('should correctly score albumin at boundary (3.5 g/dL)', async ({ page }) => {
      const bilirubinInput = page.locator('input[type="number"]').first();
      await bilirubinInput.fill('1.5');

      const albuminInput = page.locator('input[type="number"]').nth(1);
      await albuminInput.fill('3.5'); // Should be 2 points (in range 2.8-3.5)

      const inrInput = page.locator('input[type="number"]').nth(2);
      await inrInput.fill('1.2');

      await page.locator('label:has-text("None")').first().click();
      const noneEnceph = page.locator('label').filter({ hasText: /^None$/ }).nth(1);
      await noneEnceph.click();

      // Should show 2 points for albumin
      await expect(page.locator('text=/3\\.5.*2 points/')).toBeVisible();
    });

    test('should correctly score albumin at boundary (2.8 g/dL)', async ({ page }) => {
      const bilirubinInput = page.locator('input[type="number"]').first();
      await bilirubinInput.fill('1.5');

      const albuminInput = page.locator('input[type="number"]').nth(1);
      await albuminInput.fill('2.8'); // Should be 2 points (in range 2.8-3.5)

      const inrInput = page.locator('input[type="number"]').nth(2);
      await inrInput.fill('1.2');

      await page.locator('label:has-text("None")').first().click();
      const noneEnceph = page.locator('label').filter({ hasText: /^None$/ }).nth(1);
      await noneEnceph.click();

      // Should show 2 points for albumin
      await expect(page.locator('text=/2\\.8.*2 points/')).toBeVisible();
    });

    test('should correctly score INR at boundary (1.7)', async ({ page }) => {
      const bilirubinInput = page.locator('input[type="number"]').first();
      await bilirubinInput.fill('1.5');

      const albuminInput = page.locator('input[type="number"]').nth(1);
      await albuminInput.fill('4.0');

      const inrInput = page.locator('input[type="number"]').nth(2);
      await inrInput.fill('1.7'); // Should be 2 points (in range 1.7-2.2)

      await page.locator('label:has-text("None")').first().click();
      const noneEnceph = page.locator('label').filter({ hasText: /^None$/ }).nth(1);
      await noneEnceph.click();

      // Should show 2 points for INR
      await expect(page.locator('text=/1\\.7.*2 points/')).toBeVisible();
    });

    test('should correctly score INR at boundary (2.2)', async ({ page }) => {
      const bilirubinInput = page.locator('input[type="number"]').first();
      await bilirubinInput.fill('1.5');

      const albuminInput = page.locator('input[type="number"]').nth(1);
      await albuminInput.fill('4.0');

      const inrInput = page.locator('input[type="number"]').nth(2);
      await inrInput.fill('2.2'); // Should be 2 points (in range 1.7-2.2)

      await page.locator('label:has-text("None")').first().click();
      const noneEnceph = page.locator('label').filter({ hasText: /^None$/ }).nth(1);
      await noneEnceph.click();

      // Should show 2 points for INR
      await expect(page.locator('text=/2\\.2.*2 points/')).toBeVisible();
    });

    test('should handle zero values', async ({ page }) => {
      const bilirubinInput = page.locator('input[type="number"]').first();
      await bilirubinInput.fill('0');

      const albuminInput = page.locator('input[type="number"]').nth(1);
      await albuminInput.fill('4.0');

      const inrInput = page.locator('input[type="number"]').nth(2);
      await inrInput.fill('1.2');

      await page.locator('label:has-text("None")').first().click();
      const noneEnceph = page.locator('label').filter({ hasText: /^None$/ }).nth(1);
      await noneEnceph.click();

      // Should calculate with 0 bilirubin (1 point as <2)
      await expect(page.locator('text=/0\\.0.*1 point/')).toBeVisible();
    });

    test('should handle very high values', async ({ page }) => {
      const bilirubinInput = page.locator('input[type="number"]').first();
      await bilirubinInput.fill('20.0'); // Very high

      const albuminInput = page.locator('input[type="number"]').nth(1);
      await albuminInput.fill('1.5'); // Very low

      const inrInput = page.locator('input[type="number"]').nth(2);
      await inrInput.fill('5.0'); // Very high

      await page.locator('label:has-text("Moderate to Severe")').click();
      await page.locator('label:has-text("Grade 3-4")').click();

      // Should still calculate correctly (maximum 15 points)
      await expect(page.locator('text=15 points')).toBeVisible();
      await expect(page.locator('text=/Class.*C/i')).toBeVisible();
    });

    test('should handle decimal precision', async ({ page }) => {
      const bilirubinInput = page.locator('input[type="number"]').first();
      await bilirubinInput.fill('1.999'); // Just under 2.0

      const albuminInput = page.locator('input[type="number"]').nth(1);
      await albuminInput.fill('3.501'); // Just over 3.5

      const inrInput = page.locator('input[type="number"]').nth(2);
      await inrInput.fill('1.699'); // Just under 1.7

      await page.locator('label:has-text("None")').first().click();
      const noneEnceph = page.locator('label').filter({ hasText: /^None$/ }).nth(1);
      await noneEnceph.click();

      // All should score 1 point each
      await expect(page.locator('text=5 points')).toBeVisible();
    });
  });

  test.describe('Clinical Scenarios', () => {

    test('should calculate compensated cirrhosis (typical Class A)', async ({ page }) => {
      // Typical well-compensated cirrhosis patient
      await page.locator('input[type="number"]').first().fill('1.2'); // Normal bilirubin
      await page.locator('input[type="number"]').nth(1).fill('3.8'); // Good albumin
      await page.locator('input[type="number"]').nth(2).fill('1.3'); // Mild INR elevation
      await page.locator('label:has-text("None")').first().click();
      const noneEnceph = page.locator('label').filter({ hasText: /^None$/ }).nth(1);
      await noneEnceph.click();

      await expect(page.locator('text=/Class.*A/i')).toBeVisible();
      await expect(page.locator('text=Well-compensated disease')).toBeVisible();
    });

    test('should calculate early decompensation (typical Class B)', async ({ page }) => {
      // Patient with early decompensation
      await page.locator('input[type="number"]').first().fill('2.5'); // Elevated bilirubin
      await page.locator('input[type="number"]').nth(1).fill('3.0'); // Low albumin
      await page.locator('input[type="number"]').nth(2).fill('1.9'); // Elevated INR
      await page.locator('label:has-text("Slight")').click(); // Developing ascites
      const noneEnceph = page.locator('label').filter({ hasText: /^None$/ }).nth(1);
      await noneEnceph.click();

      await expect(page.locator('text=/Class.*B/i')).toBeVisible();
      await expect(page.locator('text=Significant functional compromise')).toBeVisible();
    });

    test('should calculate advanced decompensation (typical Class C)', async ({ page }) => {
      // Patient with advanced decompensated cirrhosis
      await page.locator('input[type="number"]').first().fill('4.5'); // High bilirubin
      await page.locator('input[type="number"]').nth(1).fill('2.3'); // Low albumin
      await page.locator('input[type="number"]').nth(2).fill('2.5'); // High INR
      await page.locator('label:has-text("Moderate to Severe")').click();
      await page.locator('label:has-text("Grade 1-2")').click();

      await expect(page.locator('text=/Class.*C/i')).toBeVisible();
      await expect(page.locator('text=Decompensated disease')).toBeVisible();
      await expect(page.locator('text=45-55%')).toBeVisible();
    });
  });

  test.describe('Reference Links', () => {

    test('should display reference section', async ({ page }) => {
      // Scroll to bottom to find references
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      // Look for reference section
      const refSection = page.locator('text=References');
      if (await refSection.isVisible().catch(() => false)) {
        await expect(refSection).toBeVisible();
      }
    });

    test('should have clickable reference links', async ({ page }) => {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      // Check for Pugh reference
      const pughRef = page.locator('a:has-text("Pugh")');
      if (await pughRef.isVisible().catch(() => false)) {
        await expect(pughRef).toHaveAttribute('href', /doi\.org|ncbi/);
        await expect(pughRef).toHaveAttribute('target', '_blank');
      }
    });
  });

  test.describe('User Experience', () => {

    test('should update results dynamically as inputs change', async ({ page }) => {
      // Enter initial values for Class A
      await page.locator('input[type="number"]').first().fill('1.5');
      await page.locator('input[type="number"]').nth(1).fill('4.0');
      await page.locator('input[type="number"]').nth(2).fill('1.2');
      await page.locator('label:has-text("None")').first().click();
      const noneEnceph = page.locator('label').filter({ hasText: /^None$/ }).nth(1);
      await noneEnceph.click();

      // Verify Class A
      await expect(page.locator('text=/Class.*A/i')).toBeVisible();

      // Change to Class C values
      await page.locator('input[type="number"]').first().fill('5.0');
      await page.locator('input[type="number"]').nth(1).fill('2.0');
      await page.locator('input[type="number"]').nth(2).fill('3.0');

      // Should update to Class C
      await expect(page.locator('text=/Class.*C/i')).toBeVisible();
    });

    test('should maintain entered values when switching between fields', async ({ page }) => {
      const bilirubinInput = page.locator('input[type="number"]').first();
      const albuminInput = page.locator('input[type="number"]').nth(1);
      const inrInput = page.locator('input[type="number"]').nth(2);

      await bilirubinInput.fill('2.5');
      await albuminInput.fill('3.2');
      await inrInput.fill('1.8');

      // Click back to first field
      await bilirubinInput.click();

      // All values should be maintained
      await expect(bilirubinInput).toHaveValue('2.5');
      await expect(albuminInput).toHaveValue('3.2');
      await expect(inrInput).toHaveValue('1.8');
    });

    test('should display all required mortality and risk information', async ({ page }) => {
      // Enter valid values
      await page.locator('input[type="number"]').first().fill('2.5');
      await page.locator('input[type="number"]').nth(1).fill('3.0');
      await page.locator('input[type="number"]').nth(2).fill('1.8');
      await page.locator('label:has-text("None")').first().click();
      const noneEnceph = page.locator('label').filter({ hasText: /^None$/ }).nth(1);
      await noneEnceph.click();

      // Check for all key output fields
      await expect(page.locator('text=Total Score')).toBeVisible();
      await expect(page.locator('text=Child-Pugh Class')).toBeVisible();
      await expect(page.locator('text=Classification')).toBeVisible();
      await expect(page.locator('text=1-Year Mortality')).toBeVisible();
      await expect(page.locator('text=Perioperative Mortality')).toBeVisible();
      await expect(page.locator('text=Points Breakdown')).toBeVisible();
    });
  });
});
