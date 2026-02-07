/**
 * E2E Test Suite: Renal Cyst (Bosniak Classification) Calculator
 *
 * Tests the Bosniak CT classification system for cystic renal lesions based on
 * the 2005 Bosniak classification criteria.
 *
 * Coverage:
 * - All Bosniak categories (I, II, IIF, III, IV)
 * - Text module generation
 * - Input validation
 * - UI/UX consistency
 * - Citation verification
 *
 * @see https://doi.org/10.1148/radiol.2362040218 - Bosniak MA Radiology 2005
 * @see https://doi.org/10.1148/radiol.2019182646 - Silverman SG Radiology 2019
 */

import { test, expect } from '@playwright/test';
import { navigateToCalculator } from '../../../helpers/calculator-test-helper.js';

test.describe('Renal Cyst (Bosniak Classification) Calculator', () => {

  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, 'Renal Cyst (Bosniak CT)');
    await expect(
      page.getByRole('heading', { name: 'Renal Cyst (Bosniak CT)', level: 2 }),
    ).toBeVisible();
  });

  test('should display calculator title and description', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Renal Cyst (Bosniak CT)', level: 2 })).toBeVisible();
    await expect(page.getByText('Classify cystic renal lesions per Bosniak criteria (CT 2005).')).toBeVisible();
  });

  test('should display info panel with clinical guidance', async ({ page }) => {
    const infoPanel = page.getByTestId('calculator-info');
    await expect(infoPanel).toBeVisible();
    await expect(infoPanel).toContainText('A homogeneous mass ≥ 70 HU at unenhanced CT');
    await expect(infoPanel).toContainText('Use Bosniak MR criteria if evaluating renal masses on MRI');
  });

  test('should display all required input fields', async ({ page }) => {
    // Check for all field labels
    await expect(page.getByText('Walls', { exact: true })).toBeVisible();
    await expect(page.getByText('Septa', { exact: true })).toBeVisible();
    await expect(page.getByText('Calcifications', { exact: true })).toBeVisible();
    await expect(page.getByText('Density', { exact: true })).toBeVisible();
    await expect(page.getByText('Totally intrarenal (n/a)')).toBeVisible();
    await expect(page.getByText('3cm or larger (n/a)')).toBeVisible();
    await expect(page.getByText('Enhancing soft-tissue component')).toBeVisible();
  });

  test('should display references section with valid DOI links', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'References', level: 3 })).toBeVisible();

    const bosniakRef = page.getByRole('link', { name: 'Bosniak MA Radiology 2005' });
    await expect(bosniakRef).toBeVisible();
    await expect(bosniakRef).toHaveAttribute('href', 'https://doi.org/10.1148/radiol.2362040218');

    const silvermanRef = page.getByRole('link', { name: 'Silverman SG Radiology 2019' });
    await expect(silvermanRef).toBeVisible();
    await expect(silvermanRef).toHaveAttribute('href', 'https://doi.org/10.1148/radiol.2019182646');
  });

  test.describe('Bosniak Category I - Simple Benign Cyst', () => {
    test('should classify simple cyst as Category I', async ({ page }) => {
      // Input: Simple cyst characteristics
      await page.locator('input[value="hairline-thin"]').click();
      await page.locator('input[value="no"][type="radio"]').first().click(); // Septa: no
      await page.locator('input[value="no"][type="radio"]').nth(1).click(); // Calcifications: no
      await page.locator('input[value="water"]').click();
      await page.locator('input[value="no"][type="radio"]').last().click(); // Soft tissue: no

      // Calculate
      await page.getByRole('button', { name: 'Calculate' }).click();

      // Verify results
      const results = page.locator('[aria-live="polite"]');
      await expect(results).toBeVisible();
      await expect(results).toContainText('Bosniak Category: I');
      await expect(results).toContainText('Management: Simple, benign cyst - No follow up needed');
      await expect(results).toContainText('Text Module:');
      await expect(results).toContainText('Bosniak category I');
    });
  });

  test.describe('Bosniak Category II - Minimally Complex Benign Cyst', () => {
    test('should classify thin septa cyst as Category II', async ({ page }) => {
      await page.locator('input[value="hairline-thin"]').click();
      await page.locator('input[value="few-thin"]').click(); // Few thin septa
      await page.locator('input[value="no"][type="radio"]').nth(1).click(); // No calcifications
      await page.locator('input[value="water"]').click();
      await page.locator('input[value="no"][type="radio"]').last().click();

      await page.getByRole('button', { name: 'Calculate' }).click();

      const results = page.locator('[aria-live="polite"]');
      await expect(results).toContainText('Bosniak Category: II');
      await expect(results).toContainText('Minimally complex benign cyst - No follow up needed');
    });
  });

  test.describe('Bosniak Category IIF - Follow-up Required', () => {
    test('should classify high attenuation cyst as Category IIF', async ({ page }) => {
      await page.locator('input[value="hairline-thin"]').click();
      await page.locator('input[value="no"][type="radio"]').first().click();
      await page.locator('input[value="no"][type="radio"]').nth(1).click();
      await page.locator('input[value="high"]').click(); // High attenuation >20 HU
      await page.locator('input[value="no"][type="radio"]').last().click();

      await page.getByRole('button', { name: 'Calculate' }).click();

      const results = page.locator('[aria-live="polite"]');
      await expect(results).toContainText('Bosniak Category: IIF');
      await expect(results).toContainText('Follow up recommended');
    });
  });

  test.describe('Bosniak Category III - Indeterminate, Surgical Resection', () => {
    test('should classify thick irregular walls as Category III', async ({ page }) => {
      await page.locator('input[value="thick-irregular"]').click(); // Thick irregular walls
      await page.locator('input[value="no"][type="radio"]').first().click();
      await page.locator('input[value="no"][type="radio"]').nth(1).click();
      await page.locator('input[value="water"]').click();
      await page.locator('input[value="no"][type="radio"]').last().click();

      await page.getByRole('button', { name: 'Calculate' }).click();

      const results = page.locator('[aria-live="polite"]');
      await expect(results).toContainText('Bosniak Category: III');
      await expect(results).toContainText('Indeterminate cystic mass - Surgical resection');
    });
  });

  test.describe('Bosniak Category IV - Clearly Malignant', () => {
    test('should classify enhancing soft tissue as Category IV', async ({ page }) => {
      await page.locator('input[value="hairline-thin"]').click();
      await page.locator('input[value="no"][type="radio"]').first().click();
      await page.locator('input[value="no"][type="radio"]').nth(1).click();
      await page.locator('input[value="water"]').click();
      await page.locator('input[value="yes"]').click(); // Enhancing soft tissue

      await page.getByRole('button', { name: 'Calculate' }).click();

      const results = page.locator('[aria-live="polite"]');
      await expect(results).toContainText('Bosniak Category: IV');
      await expect(results).toContainText('Clearly malignant cystic mass - Surgical resection');
    });
  });
});
