/**
 * E2E Tests for Renal Cyst (Bosniak CT) Calculator
 *
 * Tests the Bosniak classification system for cystic renal lesions
 * Based on Bosniak MA, Radiology 2005; 236(1):33-42
 *
 * Categories tested:
 * - Category I: Simple benign cyst
 * - Category II: Minimally complex benign cyst
 * - Category IIF: Minimally complex requiring follow-up
 * - Category III: Indeterminate cystic mass
 * - Category IV: Clearly malignant cystic mass
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const CALCULATOR_NAME = 'Renal Cyst (Bosniak CT)';

test.describe('Renal Cyst (Bosniak) Calculator', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto(BASE_URL);

    // Wait for app to load
    await page.waitForLoadState('networkidle');

    // Select Renal Cyst calculator from sidebar
    await page.click(`text=${CALCULATOR_NAME}`);

    // Verify calculator is loaded
    await expect(page.locator('h2')).toContainText(CALCULATOR_NAME);
  });

  test('should display calculator info and references', async ({ page }) => {
    // Check for info text about high-attenuation cysts
    await expect(page.locator('.info, [class*="info"]')).toContainText('70 HU');

    // Verify references are present
    const references = page.locator('.references, [class*="ref"]');
    await expect(references).toContainText('Bosniak');
    await expect(references).toContainText('Silverman');
  });

  test('Category I - Simple Benign Cyst', async ({ page }) => {
    // Input: hairline thin walls, no septa, no calcs, water density, no soft tissue
    await page.check('input[value="hairline-thin"]');
    await page.check('input[value="no"][name*="septa"]');
    await page.check('input[value="no"][name*="calcs"]');
    await page.check('input[value="water"]');
    await page.check('input[value="no"][name*="soft"]');

    // Click Calculate button
    await page.click('button:has-text("Calculate")');

    // Verify results
    await expect(page.locator('.results, [class*="result"]')).toContainText('Bosniak Category');
    await expect(page.locator('.results, [class*="result"]')).toContainText('I');
    await expect(page.locator('.results, [class*="result"]')).toContainText('Simple, benign cyst');
    await expect(page.locator('.results, [class*="result"]')).toContainText('No follow up needed');

    // Verify text module is generated for Category I
    await expect(page.locator('.results, [class*="result"]')).toContainText('Text Module');
    await expect(page.locator('.results, [class*="result"]')).toContainText('Bosniak category I');
  });

  test('Category II - Few Thin Septa', async ({ page }) => {
    // Input: hairline thin walls, few thin septa, no calcs, water density
    await page.check('input[value="hairline-thin"]');
    await page.check('input[value="few-thin"]');
    await page.check('input[value="no"][name*="calcs"]');
    await page.check('input[value="water"]');
    await page.check('input[value="no"][name*="soft"]');

    await page.click('button:has-text("Calculate")');

    // Verify Category II classification
    await expect(page.locator('.results, [class*="result"]')).toContainText('II');
    await expect(page.locator('.results, [class*="result"]')).toContainText('Minimally complex benign cyst');
    await expect(page.locator('.results, [class*="result"]')).toContainText('No follow up needed');
  });

  test('Category II - Fine Calcifications', async ({ page }) => {
    // Input: hairline thin walls, no septa, fine calcs, water density
    await page.check('input[value="hairline-thin"]');
    await page.check('input[value="no"][name*="septa"]');
    await page.check('input[value="fine"]');
    await page.check('input[value="water"]');
    await page.check('input[value="no"][name*="soft"]');

    await page.click('button:has-text("Calculate")');

    // Verify Category II
    await expect(page.locator('.results, [class*="result"]')).toContainText('II');
    await expect(page.locator('.results, [class*="result"]')).toContainText('Minimally complex benign cyst');
  });

  test('Category IIF - High Attenuation (>20 HU)', async ({ page }) => {
    // Input: simple cyst but high attenuation
    await page.check('input[value="hairline-thin"]');
    await page.check('input[value="no"][name*="septa"]');
    await page.check('input[value="no"][name*="calcs"]');
    await page.check('input[value="high"]'); // High attenuation (>20 HU)
    await page.check('input[value="no"][name*="soft"]');

    await page.click('button:has-text("Calculate")');

    // Verify Category IIF with follow-up
    await expect(page.locator('.results, [class*="result"]')).toContainText('IIF');
    await expect(page.locator('.results, [class*="result"]')).toContainText('Minimally complex');
    await expect(page.locator('.results, [class*="result"]')).toContainText('Follow up recommended');
  });

  test('Category IIF - Minimally Thick Walls', async ({ page }) => {
    // Input: minimally thick smooth walls with minimal enhancement possible
    await page.check('input[value="minimally-thick"]');
    await page.check('input[value="no"][name*="septa"]');
    await page.check('input[value="no"][name*="calcs"]');
    await page.check('input[value="water"]');
    await page.check('input[value="no"][name*="soft"]');

    await page.click('button:has-text("Calculate")');

    // Verify Category IIF
    await expect(page.locator('.results, [class*="result"]')).toContainText('IIF');
    await expect(page.locator('.results, [class*="result"]')).toContainText('Follow up recommended');
  });

  test('Category IIF - Thick Septa', async ({ page }) => {
    // Input: thick/minimally thickened septa
    await page.check('input[value="hairline-thin"]');
    await page.check('input[value="thick"]'); // Thick septa
    await page.check('input[value="no"][name*="calcs"]');
    await page.check('input[value="water"]');
    await page.check('input[value="no"][name*="soft"]');

    await page.click('button:has-text("Calculate")');

    // Verify Category IIF
    await expect(page.locator('.results, [class*="result"]')).toContainText('IIF');
  });

  test('Category IIF - Totally Intrarenal', async ({ page }) => {
    // Input: totally intrarenal cyst
    await page.check('input[value="hairline-thin"]');
    await page.check('input[value="no"][name*="septa"]');
    await page.check('input[value="no"][name*="calcs"]');
    await page.check('input[value="water"]');

    // Check intrarenal checkbox and select "yes" radio
    const intrarenal = page.locator('label:has-text("Totally intrarenal")');
    await intrarenal.scrollIntoViewIfNeeded();
    await intrarenal.click();
    await page.check('input[id="intrarenal_yes"]');

    await page.check('input[value="no"][name*="soft"]');

    await page.click('button:has-text("Calculate")');

    // Verify Category IIF
    await expect(page.locator('.results, [class*="result"]')).toContainText('IIF');
  });

  test('Category IIF - Large (≥3cm)', async ({ page }) => {
    // Input: large cyst (3cm or larger)
    await page.check('input[value="hairline-thin"]');
    await page.check('input[value="no"][name*="septa"]');
    await page.check('input[value="no"][name*="calcs"]');
    await page.check('input[value="water"]');

    // Check large checkbox and select "yes" radio
    const large = page.locator('label:has-text("3cm or larger")');
    await large.scrollIntoViewIfNeeded();
    await large.click();
    await page.check('input[id="large_yes"]');

    await page.check('input[value="no"][name*="soft"]');

    await page.click('button:has-text("Calculate")');

    // Verify Category IIF
    await expect(page.locator('.results, [class*="result"]')).toContainText('IIF');
  });

  test('Category III - Thick Irregular Walls', async ({ page }) => {
    // Input: thickened, irregular, enhancing walls
    await page.check('input[value="thick-irregular"]');
    await page.check('input[value="no"][name*="septa"]');
    await page.check('input[value="no"][name*="calcs"]');
    await page.check('input[value="water"]');
    await page.check('input[value="no"][name*="soft"]');

    await page.click('button:has-text("Calculate")');

    // Verify Category III - Indeterminate
    await expect(page.locator('.results, [class*="result"]')).toContainText('III');
    await expect(page.locator('.results, [class*="result"]')).toContainText('Indeterminate cystic mass');
    await expect(page.locator('.results, [class*="result"]')).toContainText('Surgical resection');
  });

  test('Category III - Thickened Irregular Septa', async ({ page }) => {
    // Input: thickened, irregular, enhancing septa
    await page.check('input[value="hairline-thin"]');
    await page.check('input[value="thickened-irregular"]');
    await page.check('input[value="no"][name*="calcs"]');
    await page.check('input[value="water"]');
    await page.check('input[value="no"][name*="soft"]');

    await page.click('button:has-text("Calculate")');

    // Verify Category III
    await expect(page.locator('.results, [class*="result"]')).toContainText('III');
    await expect(page.locator('.results, [class*="result"]')).toContainText('Indeterminate cystic mass');
    await expect(page.locator('.results, [class*="result"]')).toContainText('Surgical resection');
  });

  test('Category III - Thick Nodular Calcifications', async ({ page }) => {
    // Input: thick or nodular calcifications
    await page.check('input[value="hairline-thin"]');
    await page.check('input[value="no"][name*="septa"]');
    await page.check('input[value="thick-nodular"]');
    await page.check('input[value="water"]');
    await page.check('input[value="no"][name*="soft"]');

    await page.click('button:has-text("Calculate")');

    // Verify Category III
    await expect(page.locator('.results, [class*="result"]')).toContainText('III');
    await expect(page.locator('.results, [class*="result"]')).toContainText('Surgical resection');
  });

  test('Category IV - Enhancing Soft Tissue Component', async ({ page }) => {
    // Input: enhancing soft-tissue component (malignant)
    await page.check('input[value="hairline-thin"]');
    await page.check('input[value="no"][name*="septa"]');
    await page.check('input[value="no"][name*="calcs"]');
    await page.check('input[value="water"]');
    await page.check('input[value="yes"][name*="soft"]'); // Enhancing soft tissue

    await page.click('button:has-text("Calculate")');

    // Verify Category IV - Malignant
    await expect(page.locator('.results, [class*="result"]')).toContainText('IV');
    await expect(page.locator('.results, [class*="result"]')).toContainText('Clearly malignant cystic mass');
    await expect(page.locator('.results, [class*="result"]')).toContainText('Surgical resection');
  });

  test('Category IV - Soft Tissue Overrides All Other Features', async ({ page }) => {
    // Input: soft tissue present with all other concerning features
    // Should still be Category IV (not V or higher)
    await page.check('input[value="thick-irregular"]');
    await page.check('input[value="thickened-irregular"]');
    await page.check('input[value="thick-nodular"]');
    await page.check('input[value="high"]');
    await page.check('input[value="yes"][name*="soft"]'); // Soft tissue = Category IV

    await page.click('button:has-text("Calculate")');

    // Verify Category IV (soft tissue always means IV)
    await expect(page.locator('.results, [class*="result"]')).toContainText('IV');
    await expect(page.locator('.results, [class*="result"]')).toContainText('Clearly malignant');
  });

  test('Edge Case - Multiple IIF Features Stay IIF', async ({ page }) => {
    // Input: multiple IIF features (high attenuation + large + intrarenal)
    // Should be IIF, not upgraded to III
    await page.check('input[value="hairline-thin"]');
    await page.check('input[value="no"][name*="septa"]');
    await page.check('input[value="no"][name*="calcs"]');
    await page.check('input[value="high"]'); // IIF feature

    // Check intrarenal
    const intrarenal = page.locator('label:has-text("Totally intrarenal")');
    await intrarenal.scrollIntoViewIfNeeded();
    await intrarenal.click();
    await page.check('input[id="intrarenal_yes"]'); // IIF feature

    // Check large
    const large = page.locator('label:has-text("3cm or larger")');
    await large.scrollIntoViewIfNeeded();
    await large.click();
    await page.check('input[id="large_yes"]'); // IIF feature

    await page.check('input[value="no"][name*="soft"]');

    await page.click('button:has-text("Calculate")');

    // Verify still Category IIF (not upgraded)
    await expect(page.locator('.results, [class*="result"]')).toContainText('IIF');
    await expect(page.locator('.results, [class*="result"]')).toContainText('Follow up recommended');
  });

  test('Edge Case - Category III Features Override IIF Features', async ({ page }) => {
    // Input: thick irregular walls (III) + high attenuation (IIF)
    // Should be Category III
    await page.check('input[value="thick-irregular"]'); // Category III feature
    await page.check('input[value="no"][name*="septa"]');
    await page.check('input[value="no"][name*="calcs"]');
    await page.check('input[value="high"]'); // Category IIF feature
    await page.check('input[value="no"][name*="soft"]');

    await page.click('button:has-text("Calculate")');

    // Verify Category III (not IIF)
    await expect(page.locator('.results, [class*="result"]')).toContainText('III');
    await expect(page.locator('.results, [class*="result"]')).toContainText('Indeterminate');
  });

  test('should validate reference links are present', async ({ page }) => {
    // Scroll to references section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Check for Bosniak 2005 reference
    const bosniakRef = page.locator('a[href*="10.1148/radiol.2362040218"]');
    await expect(bosniakRef).toBeVisible();

    // Check for Silverman 2019 reference (MRI criteria)
    const silvermanRef = page.locator('a[href*="10.1148/radiol.2019182646"]');
    await expect(silvermanRef).toBeVisible();
  });

  test('should handle reset functionality', async ({ page }) => {
    // Fill in some fields
    await page.check('input[value="thick-irregular"]');
    await page.check('input[value="thickened-irregular"]');
    await page.check('input[value="thick-nodular"]');

    await page.click('button:has-text("Calculate")');

    // Verify results are shown
    await expect(page.locator('.results, [class*="result"]')).toContainText('III');

    // Click reset/clear button (if exists)
    const resetButton = page.locator('button:has-text("Reset"), button:has-text("Clear")');
    if (await resetButton.count() > 0) {
      await resetButton.click();

      // Verify results are cleared
      await expect(page.locator('.results, [class*="result"]')).not.toContainText('III');
    }
  });

  test('should display helpful info about MRI criteria', async ({ page }) => {
    // Check that calculator mentions MRI criteria are different
    const infoSection = page.locator('.info, [class*="info"], [class*="desc"]');
    await expect(infoSection).toContainText('MRI');
    await expect(infoSection).toContainText('2019');
  });

  test('accessibility - keyboard navigation', async ({ page }) => {
    // Test that radio buttons are accessible via keyboard
    await page.keyboard.press('Tab'); // Should focus first input
    await page.keyboard.press('Space'); // Should select

    // Continue tabbing through fields
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Should be able to reach Calculate button
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'INPUT', 'SELECT']).toContain(focusedElement);
  });

  test('performance - calculator responds quickly', async ({ page }) => {
    // Fill in fields
    await page.check('input[value="hairline-thin"]');
    await page.check('input[value="no"][name*="septa"]');
    await page.check('input[value="no"][name*="calcs"]');
    await page.check('input[value="water"]');
    await page.check('input[value="no"][name*="soft"]');

    // Measure calculation time
    const startTime = Date.now();
    await page.click('button:has-text("Calculate")');
    await expect(page.locator('.results, [class*="result"]')).toContainText('I');
    const endTime = Date.now();

    const calculationTime = endTime - startTime;
    expect(calculationTime).toBeLessThan(500); // Should complete within 500ms
  });

  test('should not have console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Perform typical user workflow
    await page.check('input[value="hairline-thin"]');
    await page.check('input[value="few-thin"]');
    await page.check('input[value="no"][name*="calcs"]');
    await page.check('input[value="water"]');
    await page.check('input[value="no"][name*="soft"]');
    await page.click('button:has-text("Calculate")');

    // Wait a bit for any async errors
    await page.waitForTimeout(1000);

    // Verify no console errors
    expect(consoleErrors).toHaveLength(0);
  });
});
