/**
 * E2E Tests for IPSS Calculator (Inferior Petrosal Sinus Sampling)
 *
 * Tests comprehensive scenarios including:
 * - Cushing's Disease with lateralization
 * - Ectopic ACTH Syndrome
 * - Failed catheterization
 * - Non-lateralizing Cushing's
 * - Dynamic row functionality
 * - Input validation
 * - UI elements and accessibility
 */

import { test, expect } from '@playwright/test';
import { navigateToCalculator } from '../../../helpers/calculator-test-helper.js';

test.describe('IPSS Calculator - Inferior Petrosal Sinus Sampling', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, 'IPSS (Petrosal Sinus Sampling)');
  });

  test('Test 1: Cushing\'s Disease with Left Lateralization', async ({ page }) => {
    // Fill basal samples - use more specific selectors
    await page.locator('label:has-text("Basal Left IPS ACTH")').locator('..').locator('input').fill('200');
    await page.locator('label:has-text("Basal Right IPS ACTH")').locator('..').locator('input').fill('180');
    await page.locator('label:has-text("Basal Peripheral ACTH")').locator('..').locator('input').fill('50');

    // Basal PRL values
    await page.locator('label:has-text("Basal Left IPS Prolactin")').locator('..').locator('input').fill('40');
    await page.locator('label:has-text("Basal Right IPS Prolactin")').locator('..').locator('input').fill('38');
    await page.locator('label:has-text("Basal Peripheral Prolactin")').locator('..').locator('input').fill('18');

    // Add post-CRH sample at +6 minutes
    // Use aria-label to target the dynamic table specifically
    const postCrhTable = page.locator('div[aria-label="Post-CRH Sample Table"]');

    // Get inputs from the first data row (items-center class distinguishes data rows from header)
    const firstRow = postCrhTable.locator('div.grid.grid-cols-8.items-center').first();
    const inputs = firstRow.locator('input');

    await inputs.nth(0).fill('6'); // time
    await inputs.nth(1).fill('850'); // leftACTH
    await inputs.nth(2).fill('420'); // rightACTH
    await inputs.nth(3).fill('55'); // periphACTH
    // Leave PRL values empty (should use basal)

    // Click Calculate
    await page.click('button:has-text("Calculate")');


    // Verify catheterization success
    await expect(page.locator('text=Both sides successfully catheterized')).toBeVisible();
    await expect(page.locator('text=2.22 — ✓ Successful')).toBeVisible(); // Left PRL ratio
    await expect(page.locator('text=2.11 — ✓ Successful')).toBeVisible(); // Right PRL ratio

    // Verify basal ratios
    await expect(page.locator('text=4.00 (>2 ✓ Positive for Cushing\'s)')).toBeVisible();

    // Verify peak ratio
    await expect(page.locator('text=15.45 (>3 ✓ Positive for Cushing\'s)')).toBeVisible();

    // Verify diagnosis - use more specific selector to avoid strict mode violation
    await expect(page.locator('text=🔵 CUSHING\'S DISEASE')).toBeVisible();

    // Verify lateralization to LEFT - use .first() since both simple and normalized methods show same result
    await expect(page.locator('text=🟢 Lateralizes to LEFT side').first()).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/ipss-cushings-left-lateralization.png',
      fullPage: true
    });
  });

  test('Test 2: Ectopic ACTH Syndrome', async ({ page }) => {
    // Fill basal samples
    await page.locator('label:has-text("Basal Left IPS ACTH")').locator('..').locator('input').fill('80');
    await page.locator('label:has-text("Basal Right IPS ACTH")').locator('..').locator('input').fill('75');
    await page.locator('label:has-text("Basal Peripheral ACTH")').locator('..').locator('input').fill('60');

    // Basal PRL values
    await page.locator('label:has-text("Basal Left IPS Prolactin")').locator('..').locator('input').fill('35');
    await page.locator('label:has-text("Basal Right IPS Prolactin")').locator('..').locator('input').fill('33');
    await page.locator('label:has-text("Basal Peripheral Prolactin")').locator('..').locator('input').fill('16');

    // Add post-CRH sample at +6 minutes (still low ratios)
    const postCrhTable = page.locator('div[aria-label="Post-CRH Sample Table"]');
    const firstRow = postCrhTable.locator('div.grid.grid-cols-8.items-center').first();
    const inputs = firstRow.locator('input');

    await inputs.nth(0).fill('6');
    await inputs.nth(1).fill('90');
    await inputs.nth(2).fill('85');
    await inputs.nth(3).fill('65');

    // Click Calculate
    await page.click('button:has-text("Calculate")');


    // Verify catheterization success
    await expect(page.locator('text=Both sides successfully catheterized')).toBeVisible();

    // Verify basal ratio is below threshold - use more specific selector
    await expect(page.locator('text=Maximum Basal Ratio: 1.33')).toBeVisible();

    // Verify peak ratio is below threshold - use more specific selector
    await expect(page.locator('text=Peak IPS/Peripheral Ratio: 1.38')).toBeVisible();

    // Verify diagnosis
    await expect(page.locator('text=🔴 ECTOPIC ACTH SYNDROME')).toBeVisible();
    await expect(page.locator('text=Search for ectopic ACTH source')).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/ipss-ectopic-acth.png',
      fullPage: true
    });
  });

  test('Test 3: Failed Catheterization', async ({ page }) => {
    // Fill basal samples with LOW PRL ratios (failed catheterization)
    await page.locator('label:has-text("Basal Left IPS ACTH")').locator('..').locator('input').fill('200');
    await page.locator('label:has-text("Basal Right IPS ACTH")').locator('..').locator('input').fill('180');
    await page.locator('label:has-text("Basal Peripheral ACTH")').locator('..').locator('input').fill('50');

    // Basal PRL values (FAILED - ratios < 1.5)
    await page.locator('label:has-text("Basal Left IPS Prolactin")').locator('..').locator('input').fill('20');
    await page.locator('label:has-text("Basal Right IPS Prolactin")').locator('..').locator('input').fill('22');
    await page.locator('label:has-text("Basal Peripheral Prolactin")').locator('..').locator('input').fill('18');

    // Click Calculate
    await page.click('button:has-text("Calculate")');


    // Verify failed catheterization
    await expect(page.locator('text=1.11 — ✗ Failed')).toBeVisible(); // Left PRL ratio
    await expect(page.locator('text=1.22 — ✗ Failed')).toBeVisible(); // Right PRL ratio
    await expect(page.locator('text=BOTH SIDES FAILED')).toBeVisible();

    // Verify inadequate study message
    await expect(page.locator('text=INADEQUATE STUDY')).toBeVisible();
    await expect(page.locator('text=Repeat procedure recommended')).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/ipss-failed-catheterization.png',
      fullPage: true
    });
  });

  test('Test 4: Non-lateralizing Cushing\'s Disease', async ({ page }) => {
    // Fill basal samples
    await page.locator('label:has-text("Basal Left IPS ACTH")').locator('..').locator('input').fill('150');
    await page.locator('label:has-text("Basal Right IPS ACTH")').locator('..').locator('input').fill('145');
    await page.locator('label:has-text("Basal Peripheral ACTH")').locator('..').locator('input').fill('45');

    // Basal PRL values
    await page.locator('label:has-text("Basal Left IPS Prolactin")').locator('..').locator('input').fill('40');
    await page.locator('label:has-text("Basal Right IPS Prolactin")').locator('..').locator('input').fill('38');
    await page.locator('label:has-text("Basal Peripheral Prolactin")').locator('..').locator('input').fill('18');

    // Add post-CRH sample at +6 minutes (high ratios but similar between sides)
    const postCrhTable = page.locator('div[aria-label="Post-CRH Sample Table"]');
    const firstRow = postCrhTable.locator('div.grid.grid-cols-8.items-center').first();
    const inputs = firstRow.locator('input');

    await inputs.nth(0).fill('6');
    await inputs.nth(1).fill('500');
    await inputs.nth(2).fill('480');
    await inputs.nth(3).fill('50');

    // Click Calculate
    await page.click('button:has-text("Calculate")');


    // Verify catheterization success
    await expect(page.locator('text=Both sides successfully catheterized')).toBeVisible();

    // Verify diagnosis is Cushing's - use more specific selector
    await expect(page.locator('text=🔵 CUSHING\'S DISEASE')).toBeVisible();

    // Verify non-lateralizing - use .first() since it appears in multiple results
    await expect(page.locator('text=⚪ Non-lateralizing').first()).toBeVisible();
    await expect(page.locator('text=bilateral exploration')).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/ipss-non-lateralizing.png',
      fullPage: true
    });
  });

  test('Test 5: Dynamic Row Add/Remove Functionality', async ({ page }) => {
    const postCrhTable = page.locator('div[aria-label="Post-CRH Sample Table"]');

    // Count data rows (items-center class only on data rows, not header)
    const dataRows = postCrhTable.locator('div.grid.grid-cols-8.items-center');

    // Initially should have 1 row
    const initialCount = await dataRows.count();
    expect(initialCount).toBe(1);

    // Click "Add Sample Time Point" button (correct button text)
    await page.click('button:has-text("Add Sample Time Point")');
    await expect(dataRows).toHaveCount(2);

    // Add another row
    await page.click('button:has-text("Add Sample Time Point")');
    await expect(dataRows).toHaveCount(3);

    // Remove a row
    const removeButtons = postCrhTable.locator('button:has-text("Remove")');
    await removeButtons.first().click();
    await expect(dataRows).toHaveCount(2);

    // Try to remove down to the last row
    await removeButtons.first().click();
    await expect(dataRows).toHaveCount(1);

    // Last remove button should be disabled
    const lastRemoveButton = removeButtons.first();
    await expect(lastRemoveButton).toBeDisabled();
  });

  test('Test 6: Multiple Post-CRH Time Points (Peak Selection)', async ({ page }) => {
    // Fill basal samples
    await page.locator('label:has-text("Basal Left IPS ACTH")').locator('..').locator('input').fill('150');
    await page.locator('label:has-text("Basal Right IPS ACTH")').locator('..').locator('input').fill('145');
    await page.locator('label:has-text("Basal Peripheral ACTH")').locator('..').locator('input').fill('50');
    await page.locator('label:has-text("Basal Left IPS Prolactin")').locator('..').locator('input').fill('40');
    await page.locator('label:has-text("Basal Right IPS Prolactin")').locator('..').locator('input').fill('38');
    await page.locator('label:has-text("Basal Peripheral Prolactin")').locator('..').locator('input').fill('18');

    const postCrhTable = page.locator('div[aria-label="Post-CRH Sample Table"]');
    const dataRows = postCrhTable.locator('div.grid.grid-cols-8.items-center');

    // Fill first row: +3 minutes
    let inputs = dataRows.nth(0).locator('input');
    await inputs.nth(0).fill('3');
    await inputs.nth(1).fill('300');
    await inputs.nth(2).fill('290');
    await inputs.nth(3).fill('55');

    // Add second row: +6 minutes (PEAK)
    await page.click('button:has-text("Add Sample Time Point")');
    await expect(dataRows).toHaveCount(2);
    inputs = dataRows.nth(1).locator('input');
    await inputs.nth(0).fill('6');
    await inputs.nth(1).fill('600');
    await inputs.nth(2).fill('580');
    await inputs.nth(3).fill('52');

    // Add third row: +15 minutes (declining)
    await page.click('button:has-text("Add Sample Time Point")');
    await expect(dataRows).toHaveCount(3);
    inputs = dataRows.nth(2).locator('input');
    await inputs.nth(0).fill('15');
    await inputs.nth(1).fill('400');
    await inputs.nth(2).fill('390');
    await inputs.nth(3).fill('50');

    // Click Calculate
    await page.click('button:has-text("Calculate")');


    // Verify peak is at +6 minutes (highest ratio ~11.54)
    await expect(page.locator('text=+6 minutes')).toBeVisible();
    await expect(page.locator('text=11.54')).toBeVisible(); // Peak ratio

    // Take screenshot
    await page.screenshot({
      path: 'test-results/ipss-multiple-timepoints.png',
      fullPage: true
    });
  });

  test('Test 7: Input Validation - Missing Basal Values', async ({ page }) => {
    // Fill only some basal values
    await page.locator('label:has-text("Basal Left IPS ACTH")').locator('..').locator('input').fill('200');
    await page.locator('label:has-text("Basal Right IPS ACTH")').locator('..').locator('input').fill('180');
    // Leave Peripheral ACTH and all PRL values empty

    // Click Calculate
    await page.click('button:has-text("Calculate")');


    // Verify error message
    await expect(page.locator('text=Please enter all basal sample values')).toBeVisible();
  });

  test('Test 8: UI Elements and Info Text', async ({ page }) => {
    // Verify calculator title
    await expect(page.locator('h2:has-text("IPSS (Petrosal Sinus Sampling)")')).toBeVisible();

    // Verify info text is visible (it's in a blue info box) - use .first() to avoid strict mode
    await expect(page.locator('text=Inferior Petrosal Sinus Sampling').first()).toBeVisible();
    await expect(page.locator('text=differentiate Cushing\'s disease').first()).toBeVisible();

    // Verify all basal field labels are present
    await expect(page.locator('label:has-text("Basal Left IPS ACTH")')).toBeVisible();
    await expect(page.locator('label:has-text("Basal Right IPS ACTH")')).toBeVisible();
    await expect(page.locator('label:has-text("Basal Peripheral ACTH")')).toBeVisible();
    await expect(page.locator('label:has-text("Basal Left IPS Prolactin")')).toBeVisible();
    await expect(page.locator('label:has-text("Basal Right IPS Prolactin")')).toBeVisible();
    await expect(page.locator('label:has-text("Basal Peripheral Prolactin")')).toBeVisible();

    // Verify dynamic row headers
    await expect(page.locator('text=Post-CRH Stimulation Samples')).toBeVisible();
    await expect(page.locator('text=Lt ACTH')).toBeVisible();
    await expect(page.locator('text=Rt ACTH')).toBeVisible();
    await expect(page.locator('text=Per ACTH')).toBeVisible();
    await expect(page.locator('text=Lt PRL')).toBeVisible();
    await expect(page.locator('text=Rt PRL')).toBeVisible();
    await expect(page.locator('text=Per PRL')).toBeVisible();

    // Verify Calculate button
    await expect(page.locator('button:has-text("Calculate")')).toBeVisible();

    // Verify Add button (correct text)
    await expect(page.locator('button:has-text("Add Sample Time Point")')).toBeVisible();
  });

  test('Test 9: References Section', async ({ page }) => {
    // Scroll to bottom to see references
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));


    // Verify references section exists
    await expect(page.locator('text=References')).toBeVisible();

    // Verify key references are present
    await expect(page.locator('text=Oldfield EH')).toBeVisible();
    await expect(page.locator('text=N Engl J Med')).toBeVisible();

    // Take screenshot of references
    await page.screenshot({
      path: 'test-results/ipss-references.png',
      fullPage: true
    });
  });

  test('Test 10: Borderline Catheterization (1.5-1.8)', async ({ page }) => {
    // Fill basal samples with BORDERLINE PRL ratios
    await page.locator('label:has-text("Basal Left IPS ACTH")').locator('..').locator('input').fill('150');
    await page.locator('label:has-text("Basal Right IPS ACTH")').locator('..').locator('input').fill('145');
    await page.locator('label:has-text("Basal Peripheral ACTH")').locator('..').locator('input').fill('50');

    // Borderline PRL values (1.67 and 1.78 ratios)
    await page.locator('label:has-text("Basal Left IPS Prolactin")').locator('..').locator('input').fill('30');
    await page.locator('label:has-text("Basal Right IPS Prolactin")').locator('..').locator('input').fill('32');
    await page.locator('label:has-text("Basal Peripheral Prolactin")').locator('..').locator('input').fill('18');

    // Click Calculate
    await page.click('button:has-text("Calculate")');


    // Verify borderline status is shown - use .first() since both left and right show borderline
    await expect(page.locator('text=⚠ Borderline').first()).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/ipss-borderline-catheterization.png',
      fullPage: true
    });
  });
});
