import { test, expect } from '@playwright/test';
import {
  navigateToCalculator,
  fillInput,
  verifyResult,
  verifyReferenceLinks,
  verifyThemeConsistency,
  verifyMobileResponsive,
  clearAllInputs,
  takeScreenshot
} from '../../../helpers/calculator-test-helper.js';

/**
 * E2E Tests for Adrenal MRI CSI Calculator
 *
 * Tests the Chemical Shift Imaging (CSI) calculator for adrenal lesion characterization.
 * Validates signal intensity index and adrenal-to-spleen CSI ratio calculations.
 *
 * Clinical Context:
 * - Signal Intensity Index (SII): ((SI_in-phase - SI_opposed-phase) / SI_in-phase) × 100
 * - CSI Ratio: (Adrenal_OP / Spleen_OP) / (Adrenal_IP / Spleen_IP)
 * - Threshold: SII ≥ 16.5% suggests lipid-rich adenoma
 *
 * References:
 * - Blake MA et al., AJR 2012 (DOI: 10.2214/AJR.10.4547)
 * - Schieda N et al., AJR 2017 (DOI: 10.2214/AJR.16.17758)
 */

const CALCULATOR_NAME = 'Adrenal MRI CSI';

test.describe('Adrenal MRI CSI Calculator - Core Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, CALCULATOR_NAME);
  });

  test('should load calculator with correct title and description', async ({ page }) => {
    // Verify calculator title
    await expect(page.locator('h2')).toContainText('Adrenal MRI CSI');

    // Verify description
    const description = page.locator('p.text-sm.text-gray-600');
    await expect(description).toContainText('Signal‑intensity index');
    await expect(description).toContainText('adrenal‑to‑spleen CSI ratio');
  });

  test('should display all required input fields', async ({ page }) => {
    // Verify all 4 input fields are present
    await expect(page.locator('label:has-text("Adrenal SI in‑phase")')).toBeVisible();
    await expect(page.locator('label:has-text("Adrenal SI opposed‑phase")')).toBeVisible();
    await expect(page.locator('label:has-text("Spleen SI in‑phase")')).toBeVisible();
    await expect(page.locator('label:has-text("Spleen SI opposed‑phase")')).toBeVisible();

    // Verify Calculate button is present
    await expect(page.locator('button:has-text("Calculate")')).toBeVisible();
  });
});

test.describe('Adrenal MRI CSI Calculator - Clinical Test Cases', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, CALCULATOR_NAME);
  });

  test('Test Case 1: Lipid-rich Adenoma (Classic Positive)', async ({ page }) => {
    // Inputs from test_cases.md - typical lipid-rich adenoma
    await fillInput(page, 'Adrenal SI in‑phase', '1000');
    await fillInput(page, 'Adrenal SI opposed‑phase', '500');
    await fillInput(page, 'Spleen SI in‑phase', '800');
    await fillInput(page, 'Spleen SI opposed‑phase', '750');

    // Click Calculate
    await page.click('button:has-text("Calculate")');
    await page.waitForTimeout(300);

    // Expected results:
    // SII = ((1000 - 500) / 1000) × 100 = 50.0%
    // CSI Ratio = (500/750) / (1000/800) = 0.6667 / 1.25 = 0.53

    // Verify Signal Intensity Index
    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText('Signal Intensity Index (%): 50.0');

    // Verify CSI Ratio (approximately 0.53)
    await expect(results).toContainText('Adrenal‑to‑Spleen CSI Ratio: 0.53');

    // Verify interpretation
    await expect(results).toContainText('Suggests lipid‑rich adenoma');

    // Screenshot for visual verification
    await takeScreenshot(page, 'adrenal-mri-csi', 'lipid-rich-adenoma');
  });

  test('Test Case 2: Non-adenoma / Lipid-poor (Negative)', async ({ page }) => {
    // Inputs showing minimal signal drop - non-adenoma pattern
    await fillInput(page, 'Adrenal SI in‑phase', '800');
    await fillInput(page, 'Adrenal SI opposed‑phase', '750');
    await fillInput(page, 'Spleen SI in‑phase', '700');
    await fillInput(page, 'Spleen SI opposed‑phase', '680');

    await page.click('button:has-text("Calculate")');
    await page.waitForTimeout(300);

    // Expected results:
    // SII = ((800 - 750) / 800) × 100 = 6.25%
    // CSI Ratio = (750/680) / (800/700) = 1.103 / 1.143 = 0.97

    const results = page.locator('section[aria-live="polite"]');

    // Verify Signal Intensity Index (below threshold)
    await expect(results).toContainText('Signal Intensity Index (%): 6.2');

    // Verify CSI Ratio
    await expect(results).toContainText('Adrenal‑to‑Spleen CSI Ratio: 0.97');

    // Verify interpretation (not adenoma)
    await expect(results).toContainText('Non‑adenoma / lipid‑poor');
  });

  test('Test Case 3: Borderline Adenoma (at threshold)', async ({ page }) => {
    // Test case at the 16.5% threshold
    // SII = 16.5%, so: (A_IP - A_OP) / A_IP = 0.165
    // A_IP = 1000, A_OP = 835
    await fillInput(page, 'Adrenal SI in‑phase', '1000');
    await fillInput(page, 'Adrenal SI opposed‑phase', '835');
    await fillInput(page, 'Spleen SI in‑phase', '800');
    await fillInput(page, 'Spleen SI opposed‑phase', '800');

    await page.click('button:has-text("Calculate")');
    await page.waitForTimeout(300);

    const results = page.locator('section[aria-live="polite"]');

    // At threshold: 16.5%
    await expect(results).toContainText('Signal Intensity Index (%): 16.5');

    // Should classify as adenoma (≥ 16.5%)
    await expect(results).toContainText('Suggests lipid‑rich adenoma');
  });

  test('Test Case 4: High signal intensity drop (strong adenoma)', async ({ page }) => {
    // Very high SII suggesting benign adenoma
    await fillInput(page, 'Adrenal SI in‑phase', '2000');
    await fillInput(page, 'Adrenal SI opposed‑phase', '600');
    await fillInput(page, 'Spleen SI in‑phase', '900');
    await fillInput(page, 'Spleen SI opposed‑phase', '880');

    await page.click('button:has-text("Calculate")');
    await page.waitForTimeout(300);

    // Expected: SII = ((2000 - 600) / 2000) × 100 = 70.0%
    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText('Signal Intensity Index (%): 70.0');
    await expect(results).toContainText('Suggests lipid‑rich adenoma');
  });

  test('Test Case 5: Signal paradox (opposed > in-phase)', async ({ page }) => {
    // Edge case: opposed-phase signal higher than in-phase (negative SII)
    await fillInput(page, 'Adrenal SI in‑phase', '500');
    await fillInput(page, 'Adrenal SI opposed‑phase', '600');
    await fillInput(page, 'Spleen SI in‑phase', '800');
    await fillInput(page, 'Spleen SI opposed‑phase', '750');

    await page.click('button:has-text("Calculate")');
    await page.waitForTimeout(300);

    // Expected: SII = ((500 - 600) / 500) × 100 = -20.0%
    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText('Signal Intensity Index (%): -20.0');

    // Negative SII should indicate non-adenoma
    await expect(results).toContainText('Non‑adenoma / lipid‑poor');
  });
});

test.describe('Adrenal MRI CSI Calculator - Edge Cases & Validation', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, CALCULATOR_NAME);
  });

  test('should handle zero values gracefully', async ({ page }) => {
    await fillInput(page, 'Adrenal SI in‑phase', '0');
    await fillInput(page, 'Adrenal SI opposed‑phase', '0');
    await fillInput(page, 'Spleen SI in‑phase', '100');
    await fillInput(page, 'Spleen SI opposed‑phase', '100');

    await page.click('button:has-text("Calculate")');
    await page.waitForTimeout(300);

    // Division by zero in SII calculation - should show NaN or Infinity
    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toBeVisible();

    // Should still display results (even if mathematically undefined)
    await expect(results).toContainText('Signal Intensity Index');
  });

  test('should handle very large values', async ({ page }) => {
    await fillInput(page, 'Adrenal SI in‑phase', '999999');
    await fillInput(page, 'Adrenal SI opposed‑phase', '499999');
    await fillInput(page, 'Spleen SI in‑phase', '800000');
    await fillInput(page, 'Spleen SI opposed‑phase', '750000');

    await page.click('button:has-text("Calculate")');
    await page.waitForTimeout(300);

    const results = page.locator('section[aria-live="polite"]');

    // Should calculate correctly: ((999999 - 499999) / 999999) × 100 = 50.0%
    await expect(results).toContainText('Signal Intensity Index (%): 50.0');
  });

  test('should handle decimal values with precision', async ({ page }) => {
    await fillInput(page, 'Adrenal SI in‑phase', '1234.567');
    await fillInput(page, 'Adrenal SI opposed‑phase', '678.901');
    await fillInput(page, 'Spleen SI in‑phase', '890.123');
    await fillInput(page, 'Spleen SI opposed‑phase', '845.678');

    await page.click('button:has-text("Calculate")');
    await page.waitForTimeout(300);

    const results = page.locator('section[aria-live="polite"]');

    // Expected: ((1234.567 - 678.901) / 1234.567) × 100 = 45.02%
    await expect(results).toContainText('Signal Intensity Index (%): 45.0');
    await expect(results).toBeVisible();
  });

  test('should clear results when switching calculators', async ({ page }) => {
    // Fill and calculate
    await fillInput(page, 'Adrenal SI in‑phase', '1000');
    await fillInput(page, 'Adrenal SI opposed‑phase', '500');
    await fillInput(page, 'Spleen SI in‑phase', '800');
    await fillInput(page, 'Spleen SI opposed‑phase', '750');
    await page.click('button:has-text("Calculate")');

    // Verify results appear
    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText('Signal Intensity Index');

    // Switch to different calculator
    await page.click('button:has-text("Adrenal CT Washout")');
    await page.waitForTimeout(500);

    // Switch back
    await page.click(`button:has-text("${CALCULATOR_NAME}")`);
    await page.waitForTimeout(500);

    // Results should be cleared
    await expect(results).not.toBeVisible();

    // Input fields should be empty
    const firstInput = page.locator('label:has-text("Adrenal SI in‑phase")').locator('~ input');
    await expect(firstInput).toHaveValue('');
  });
});

test.describe('Adrenal MRI CSI Calculator - Formula Verification', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, CALCULATOR_NAME);
  });

  test('should verify Signal Intensity Index formula accuracy', async ({ page }) => {
    // Test multiple known values
    const testCases = [
      { a_ip: 1000, a_op: 500, expected_sii: 50.0 },
      { a_ip: 800, a_op: 600, expected_sii: 25.0 },
      { a_ip: 1200, a_op: 1000, expected_sii: 16.7 },
      { a_ip: 500, a_op: 450, expected_sii: 10.0 },
    ];

    for (const tc of testCases) {
      await clearAllInputs(page);

      await fillInput(page, 'Adrenal SI in‑phase', tc.a_ip.toString());
      await fillInput(page, 'Adrenal SI opposed‑phase', tc.a_op.toString());
      await fillInput(page, 'Spleen SI in‑phase', '800');
      await fillInput(page, 'Spleen SI opposed‑phase', '800');

      await page.click('button:has-text("Calculate")');
      await page.waitForTimeout(300);

      const results = page.locator('section[aria-live="polite"]');
      const expectedSII = tc.expected_sii.toFixed(1);
      await expect(results).toContainText(`Signal Intensity Index (%): ${expectedSII}`);
    }
  });

  test('should verify CSI Ratio formula accuracy', async ({ page }) => {
    // CSI Ratio = (Adrenal_OP / Spleen_OP) / (Adrenal_IP / Spleen_IP)
    // Test case: (500/750) / (1000/800) = 0.6667 / 1.25 = 0.533
    await fillInput(page, 'Adrenal SI in‑phase', '1000');
    await fillInput(page, 'Adrenal SI opposed‑phase', '500');
    await fillInput(page, 'Spleen SI in‑phase', '800');
    await fillInput(page, 'Spleen SI opposed‑phase', '750');

    await page.click('button:has-text("Calculate")');
    await page.waitForTimeout(300);

    const results = page.locator('section[aria-live="polite"]');
    // Expected: 0.53 (rounded to 2 decimals)
    await expect(results).toContainText('Adrenal‑to‑Spleen CSI Ratio: 0.53');
  });

  test('should verify threshold interpretation (16.5%)', async ({ page }) => {
    // Test cases around the 16.5% threshold
    const thresholdTests = [
      { sii_percent: 16.4, expected: 'Non‑adenoma / lipid‑poor' },
      { sii_percent: 16.5, expected: 'Suggests lipid‑rich adenoma' },
      { sii_percent: 16.6, expected: 'Suggests lipid‑rich adenoma' },
    ];

    for (const tc of thresholdTests) {
      await clearAllInputs(page);

      // Calculate A_OP from desired SII: A_OP = A_IP × (1 - SII/100)
      const a_ip = 1000;
      const a_op = Math.round(a_ip * (1 - tc.sii_percent / 100));

      await fillInput(page, 'Adrenal SI in‑phase', a_ip.toString());
      await fillInput(page, 'Adrenal SI opposed‑phase', a_op.toString());
      await fillInput(page, 'Spleen SI in‑phase', '800');
      await fillInput(page, 'Spleen SI opposed‑phase', '800');

      await page.click('button:has-text("Calculate")');
      await page.waitForTimeout(300);

      const results = page.locator('section[aria-live="polite"]');
      await expect(results).toContainText(tc.expected);
    }
  });
});

test.describe('Adrenal MRI CSI Calculator - UI/UX Quality', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, CALCULATOR_NAME);
  });

  test('should verify theme consistency and styling', async ({ page }) => {
    await verifyThemeConsistency(page);

    // Verify card styling
    const card = page.locator('.border.rounded-lg').first();
    await expect(card).toBeVisible();

    // Verify input fields have consistent styling
    const inputs = page.locator('input[type="number"]');
    const inputCount = await inputs.count();
    expect(inputCount).toBe(4); // Should have 4 number inputs

    // Verify labels are properly associated
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const inputId = await input.getAttribute('id');
      const label = page.locator(`label[for="${inputId}"]`);
      await expect(label).toBeVisible();
    }
  });

  test('should be mobile responsive', async ({ page }) => {
    await verifyMobileResponsive(page);

    // Verify calculator is still usable on mobile
    await page.setViewportSize({ width: 375, height: 667 });

    // All fields should still be visible
    await expect(page.locator('label:has-text("Adrenal SI in‑phase")')).toBeVisible();
    await expect(page.locator('button:has-text("Calculate")')).toBeVisible();

    // Should be able to fill and calculate
    await fillInput(page, 'Adrenal SI in‑phase', '1000');
    await fillInput(page, 'Adrenal SI opposed‑phase', '500');
    await fillInput(page, 'Spleen SI in‑phase', '800');
    await fillInput(page, 'Spleen SI opposed‑phase', '750');
    await page.click('button:has-text("Calculate")');

    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toBeVisible();

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('should have accessible labels and ARIA attributes', async ({ page }) => {
    // Verify input fields have proper labels
    const labelTexts = [
      'Adrenal SI in‑phase',
      'Adrenal SI opposed‑phase',
      'Spleen SI in‑phase',
      'Spleen SI opposed‑phase'
    ];

    for (const labelText of labelTexts) {
      const label = page.locator(`label:has-text("${labelText}")`);
      await expect(label).toBeVisible();

      // Check that label is properly associated with input
      const forAttr = await label.getAttribute('for');
      if (forAttr) {
        const associatedInput = page.locator(`#${forAttr}`);
        await expect(associatedInput).toBeVisible();
      }
    }

    // Verify results section has aria-live for screen readers
    await fillInput(page, 'Adrenal SI in‑phase', '1000');
    await fillInput(page, 'Adrenal SI opposed‑phase', '500');
    await fillInput(page, 'Spleen SI in‑phase', '800');
    await fillInput(page, 'Spleen SI opposed‑phase', '750');
    await page.click('button:has-text("Calculate")');

    const resultsSection = page.locator('section[aria-live="polite"]');
    await expect(resultsSection).toBeVisible();
  });
});

test.describe('Adrenal MRI CSI Calculator - References & Documentation', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, CALCULATOR_NAME);
  });

  test('should display reference section', async ({ page }) => {
    // Verify References heading exists
    await expect(page.locator('h3:has-text("References")')).toBeVisible();

    // Verify both references are present
    await expect(page.locator('a:has-text("Blake MA AJR 2012")')).toBeVisible();
    await expect(page.locator('a:has-text("Schieda N AJR 2017")')).toBeVisible();
  });

  test('should have valid reference DOI links', async ({ page }) => {
    // Verify DOI links are present and properly formatted
    const blakeLink = page.locator('a:has-text("Blake MA AJR 2012")');
    const blakeHref = await blakeLink.getAttribute('href');
    expect(blakeHref).toBe('https://doi.org/10.2214/AJR.10.4547');

    const schiedaLink = page.locator('a:has-text("Schieda N AJR 2017")');
    const schiedaHref = await schiedaLink.getAttribute('href');
    expect(schiedaHref).toBe('https://doi.org/10.2214/AJR.16.17758');

    // Verify links open in new tab
    await expect(blakeLink).toHaveAttribute('target', '_blank');
    await expect(schiedaLink).toHaveAttribute('target', '_blank');

    // Verify rel="noopener noreferrer" for security
    await expect(blakeLink).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(schiedaLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('should verify reference links redirect correctly', async ({ page, context }) => {
    // Note: DOI links redirect (302) to publisher, which may require subscription (403)
    // We verify the DOI resolver responds, not the final destination

    const links = [
      'https://doi.org/10.2214/AJR.10.4547',
      'https://doi.org/10.2214/AJR.16.17758'
    ];

    for (const link of links) {
      const response = await page.request.head(link);
      // DOI resolver should respond (302 redirect or 200)
      // 403 from publisher is acceptable (subscription required)
      expect([200, 302, 403]).toContain(response.status());
    }
  });
});

test.describe('Adrenal MRI CSI Calculator - Performance & Browser Compatibility', () => {
  test('should calculate results quickly', async ({ page }) => {
    await navigateToCalculator(page, CALCULATOR_NAME);

    await fillInput(page, 'Adrenal SI in‑phase', '1000');
    await fillInput(page, 'Adrenal SI opposed‑phase', '500');
    await fillInput(page, 'Spleen SI in‑phase', '800');
    await fillInput(page, 'Spleen SI opposed‑phase', '750');

    // Measure calculation time
    const startTime = Date.now();
    await page.click('button:has-text("Calculate")');

    // Wait for results to appear
    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toBeVisible({ timeout: 1000 });

    const endTime = Date.now();
    const calculationTime = endTime - startTime;

    // Should calculate in under 500ms
    expect(calculationTime).toBeLessThan(500);
  });

  test('should have no console errors during normal use', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await navigateToCalculator(page, CALCULATOR_NAME);

    await fillInput(page, 'Adrenal SI in‑phase', '1000');
    await fillInput(page, 'Adrenal SI opposed‑phase', '500');
    await fillInput(page, 'Spleen SI in‑phase', '800');
    await fillInput(page, 'Spleen SI opposed‑phase', '750');
    await page.click('button:has-text("Calculate")');

    await page.waitForTimeout(1000);

    // Should have no console errors
    expect(consoleErrors).toHaveLength(0);
  });

  test('should make no external network requests during calculation', async ({ page }) => {
    const networkRequests = [];
    page.on('request', request => {
      // Filter out localhost and static assets
      const url = request.url();
      if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
        networkRequests.push(url);
      }
    });

    await navigateToCalculator(page, CALCULATOR_NAME);

    await fillInput(page, 'Adrenal SI in‑phase', '1000');
    await fillInput(page, 'Adrenal SI opposed‑phase', '500');
    await fillInput(page, 'Spleen SI in‑phase', '800');
    await fillInput(page, 'Spleen SI opposed‑phase', '750');
    await page.click('button:has-text("Calculate")');

    await page.waitForTimeout(500);

    // Should be a fully static client-side calculator
    expect(networkRequests).toHaveLength(0);
  });
});

test.describe('Adrenal MRI CSI Calculator - Clinical Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, CALCULATOR_NAME);
  });

  test('Clinical Scenario: Incidental adrenal mass - confirm adenoma', async ({ page }) => {
    // Patient with 2cm right adrenal mass found on trauma CT
    // MRI performed for characterization
    // Strong signal drop suggests benign adenoma - no further follow-up needed

    await fillInput(page, 'Adrenal SI in‑phase', '1200');
    await fillInput(page, 'Adrenal SI opposed‑phase', '400');
    await fillInput(page, 'Spleen SI in‑phase', '850');
    await fillInput(page, 'Spleen SI opposed‑phase', '820');

    await page.click('button:has-text("Calculate")');
    await page.waitForTimeout(300);

    // SII = ((1200 - 400) / 1200) × 100 = 66.7%
    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText('Signal Intensity Index (%): 66.7');
    await expect(results).toContainText('Suggests lipid‑rich adenoma');

    // Clinical interpretation: No further imaging or biopsy needed
    await takeScreenshot(page, 'adrenal-mri-csi', 'clinical-adenoma-confirmed');
  });

  test('Clinical Scenario: Possible metastasis - indeterminate lesion', async ({ page }) => {
    // Patient with known malignancy and new adrenal mass
    // Minimal signal drop on MRI - cannot exclude metastasis
    // May need PET-CT or biopsy for definitive characterization

    await fillInput(page, 'Adrenal SI in‑phase', '900');
    await fillInput(page, 'Adrenal SI opposed‑phase', '880');
    await fillInput(page, 'Spleen SI in‑phase', '800');
    await fillInput(page, 'Spleen SI opposed‑phase', '790');

    await page.click('button:has-text("Calculate")');
    await page.waitForTimeout(300);

    // SII = ((900 - 880) / 900) × 100 = 2.2%
    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText('Signal Intensity Index (%): 2.2');
    await expect(results).toContainText('Non‑adenoma / lipid‑poor');

    await takeScreenshot(page, 'adrenal-mri-csi', 'clinical-indeterminate-needs-workup');
  });

  test('Clinical Scenario: Borderline case requiring correlation', async ({ page }) => {
    // Patient with adrenal mass showing borderline signal drop
    // SII near threshold - correlate with CT washout and clinical context

    await fillInput(page, 'Adrenal SI in‑phase', '1000');
    await fillInput(page, 'Adrenal SI opposed‑phase', '830');
    await fillInput(page, 'Spleen SI in‑phase', '850');
    await fillInput(page, 'Spleen SI opposed‑phase', '840');

    await page.click('button:has-text("Calculate")');
    await page.waitForTimeout(300);

    // SII = ((1000 - 830) / 1000) × 100 = 17.0%
    const results = page.locator('section[aria-live="polite"]');
    await expect(results).toContainText('Signal Intensity Index (%): 17.0');
    await expect(results).toContainText('Suggests lipid‑rich adenoma');

    // Clinical note: Borderline - consider CT washout for confirmation
    await takeScreenshot(page, 'adrenal-mri-csi', 'clinical-borderline-needs-correlation');
  });
});
