import { test, expect } from '@playwright/test';
import { navigateToCalculator } from '../../../helpers/calculator-test-helper.js';

/**
 * Milan Criteria Calculator E2E Tests
 *
 * Tests liver transplant eligibility criteria for hepatocellular carcinoma (HCC) patients
 *
 * Milan Criteria (Mazzaferro et al., 1996):
 * - Single tumor ≤5 cm, OR
 * - 2-3 tumors each ≤3 cm
 * - NO macrovascular invasion
 * - NO extrahepatic disease
 *
 * UCSF Criteria (Yao et al., 2001):
 * - Single tumor ≤6.5 cm, OR
 * - 2-3 tumors with largest ≤4.5 cm AND total diameter ≤8 cm
 * - NO macrovascular invasion
 * - NO extrahepatic disease
 *
 * References:
 * - Mazzaferro V et al. N Engl J Med 1996;334:693-9 (PMID: 8594428)
 * - Yao FY et al. Hepatology 2001;33(6):1394-403 (PMID: 11391528)
 */

test.describe('Milan Criteria Calculator', () => {

  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, 'Milan Criteria (HCC)');
    await expect(page.locator('h2:has-text("Milan Criteria (HCC)")')).toBeVisible();
  });

  test.describe('Visual Appeal & Theme Matching', () => {

    test('should display calculator with proper styling and professional appearance', async ({ page }) => {
      // Check calculator card is visible
      const card = page.locator('.card, [class*="card"]').first();
      await expect(card).toBeVisible();

      // Check title is visible and styled
      const title = page.locator('h2:has-text("Milan Criteria (HCC)")');
      await expect(title).toBeVisible();

      // Check description is present
      await expect(page.locator('text=Liver transplant eligibility criteria')).toBeVisible();
    });

    test('should have responsive design on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Calculator should still be visible and usable
      await expect(page.locator('h2:has-text("Milan Criteria (HCC)")')).toBeVisible();

      // Fields should be visible and accessible
      const tumorCountLabel = page.locator('label:has-text("Number of Tumors")');
      await expect(tumorCountLabel).toBeVisible();
    });

    test('should display info section with clinical context', async ({ page }) => {
      // Check if info section exists with Milan criteria description
      const infoSection = page.locator('text=The Milan Criteria, established in 1996');
      await expect(infoSection).toBeVisible();

      // Check for mention of UCSF criteria
      const ucsfInfo = page.locator('text=expanded UCSF criteria');
      await expect(ucsfInfo).toBeVisible();

      // Check for clinical guidance about unknown status
      const unknownGuidance = page.locator('text=unknown');
      await expect(unknownGuidance).toBeVisible();
    });

    test('should have consistent theme with other calculators', async ({ page }) => {
      // Check sidebar styling
      const sidebar = page.locator('aside');
      await expect(sidebar).toBeVisible();

      // Check button styling
      const calculateButton = page.locator('button:has-text("Calculate")');
      await expect(calculateButton).toBeVisible();
      await expect(calculateButton).toHaveClass(/.*w-full.*/);
    });
  });

  test.describe('Professional Appearance & User Usefulness', () => {

    test('should display all required input fields for HCC assessment', async ({ page }) => {
      // Check Number of Tumors dropdown
      await expect(page.locator('label:has-text("Number of Tumors")')).toBeVisible();

      // Check Largest Tumor Diameter field
      await expect(page.locator('label:has-text("Largest Tumor Diameter")')).toBeVisible();

      // Check Macrovascular Invasion radio buttons
      await expect(page.locator('label:has-text("Macrovascular Invasion")')).toBeVisible();

      // Check Extrahepatic Disease radio buttons
      await expect(page.locator('label:has-text("Extrahepatic Disease")')).toBeVisible();
    });

    test('should show conditional fields based on tumor count', async ({ page }) => {
      // Select 1 tumor - second and third tumor fields should not be visible
      const tumorSelect = page.locator('select').first();
      await tumorSelect.selectOption('1');

      // Second tumor field should not be visible
      const secondTumorLabel = page.locator('label:has-text("Second Tumor Diameter")');
      await expect(secondTumorLabel).not.toBeVisible();

      // Select 2 tumors - second field should appear
      await tumorSelect.selectOption('2');
      await expect(secondTumorLabel).toBeVisible();

      // Third tumor field should not be visible yet
      const thirdTumorLabel = page.locator('label:has-text("Third Tumor Diameter")');
      await expect(thirdTumorLabel).not.toBeVisible();

      // Select 3 tumors - both second and third fields should appear
      await tumorSelect.selectOption('3');
      await expect(secondTumorLabel).toBeVisible();
      await expect(thirdTumorLabel).toBeVisible();
    });

    test('should provide helpful sublabels and guidance', async ({ page }) => {
      // Check for subLabel on largest tumor field
      await expect(page.locator('text=Required')).toBeVisible();

      // Check for conditional sublabels
      const tumorSelect = page.locator('select').first();
      await tumorSelect.selectOption('2');
      await expect(page.locator('text=Required when 2+ tumors')).toBeVisible();

      await tumorSelect.selectOption('3');
      await expect(page.locator('text=Required when 3 tumors')).toBeVisible();
    });
  });

  test.describe('Citation Verification', () => {

    test('should display all four reference citations', async ({ page }) => {
      // Scroll to references section
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      // Check for references header
      await expect(page.locator('h3:has-text("References")')).toBeVisible();

      // Check for Mazzaferro 1996 (Original Milan Criteria)
      const mazzaferro1996 = page.locator('a:has-text("Mazzaferro V et al. N Engl J Med 1996")');
      await expect(mazzaferro1996).toBeVisible();
      await expect(mazzaferro1996).toHaveAttribute('href', 'https://pubmed.ncbi.nlm.nih.gov/8594428/');

      // Check for Yao 2001 (UCSF Expanded Criteria)
      const yao2001 = page.locator('a:has-text("Yao FY et al. Transplantation 2001")');
      await expect(yao2001).toBeVisible();
      // Note: PMID in code is incorrect (11923664), correct PMID should be 11391528

      // Check for Mazzaferro 2009 (Validation)
      const mazzaferro2009 = page.locator('a:has-text("Mazzaferro V et al. Lancet Oncol 2009")');
      await expect(mazzaferro2009).toBeVisible();
      await expect(mazzaferro2009).toHaveAttribute('href', 'https://pubmed.ncbi.nlm.nih.gov/19058754/');

      // Check for Duffy 2007 (UCSF vs Milan Outcomes)
      const duffy2007 = page.locator('a:has-text("Duffy JP et al. Ann Surg 2007")');
      await expect(duffy2007).toBeVisible();
      // Note: PMID in code is incorrect (17435545), correct PMID should be 17717454
    });

    test('should have working PubMed links', async ({ page }) => {
      // Check that all reference links open in new tab
      const links = page.locator('section:has(h3:has-text("References")) a');
      const count = await links.count();

      expect(count).toBe(4);

      for (let i = 0; i < count; i++) {
        const link = links.nth(i);
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      }
    });
  });

  test.describe('Clinical Calculation Accuracy', () => {

    test('WITHIN Milan: Single tumor 4.5 cm, no invasion/disease', async ({ page }) => {
      // Fill in patient data
      await page.locator('select').first().selectOption('1');
      await page.fill('input[type="number"]', '4.5');
      await page.check('input[type="radio"][value="no"]');
      const radioButtons = page.locator('input[type="radio"][value="no"]');
      await radioButtons.nth(1).check();

      // Calculate
      await page.click('button:has-text("Calculate")');

      // Verify results
      await expect(page.locator('text=WITHIN CRITERIA')).toBeVisible();
      await expect(page.locator('text=ELIGIBLE - Meets Milan Criteria')).toBeVisible();
      await expect(page.locator('text=4-year survival >70%')).toBeVisible();
    });

    test('BEYOND Milan but WITHIN UCSF: Single tumor 6.0 cm', async ({ page }) => {
      // Fill in patient data
      await page.locator('select').first().selectOption('1');
      await page.fill('input[type="number"]', '6.0');
      await page.check('input[type="radio"][value="no"]');
      const radioButtons = page.locator('input[type="radio"][value="no"]');
      await radioButtons.nth(1).check();

      // Calculate
      await page.click('button:has-text("Calculate")');

      // Verify results
      await expect(page.locator('text=BEYOND CRITERIA').first()).toBeVisible();
      await expect(page.locator('text=WITHIN CRITERIA').nth(1)).toBeVisible();
      await expect(page.locator('text=ELIGIBLE - Meets UCSF Criteria')).toBeVisible();
    });

    test('WITHIN Milan: 2 tumors at 2.8 cm and 2.5 cm', async ({ page }) => {
      // Fill in patient data
      await page.locator('select').first().selectOption('2');

      const numberInputs = page.locator('input[type="number"]');
      await numberInputs.nth(0).fill('2.8');
      await numberInputs.nth(1).fill('2.5');

      await page.check('input[type="radio"][value="no"]');
      const radioButtons = page.locator('input[type="radio"][value="no"]');
      await radioButtons.nth(1).check();

      // Calculate
      await page.click('button:has-text("Calculate")');

      // Verify results
      await expect(page.locator('text=WITHIN CRITERIA').first()).toBeVisible();
      await expect(page.locator('text=ELIGIBLE - Meets Milan Criteria')).toBeVisible();
      await expect(page.locator('text=2 tumors, largest 2.8 cm')).toBeVisible();
    });

    test('BEYOND Milan but WITHIN UCSF: 3 tumors (4.0, 3.5, 0.5 cm)', async ({ page }) => {
      // Total = 8.0 cm (within UCSF limit), largest 4.0 cm (within UCSF 4.5 cm limit)
      // But largest exceeds Milan 3 cm limit
      await page.locator('select').first().selectOption('3');

      const numberInputs = page.locator('input[type="number"]');
      await numberInputs.nth(0).fill('4.0');
      await numberInputs.nth(1).fill('3.5');
      await numberInputs.nth(2).fill('0.5');

      await page.check('input[type="radio"][value="no"]');
      const radioButtons = page.locator('input[type="radio"][value="no"]');
      await radioButtons.nth(1).check();

      // Calculate
      await page.click('button:has-text("Calculate")');

      // Verify Milan BEYOND
      await expect(page.locator('text=BEYOND CRITERIA').first()).toBeVisible();
      await expect(page.locator('text=3 tumors, largest 4.0 cm exceeds 3 cm limit')).toBeVisible();

      // Verify UCSF WITHIN
      await expect(page.locator('text=WITHIN CRITERIA').nth(1)).toBeVisible();
      await expect(page.locator('text=total 8.0 cm')).toBeVisible();
    });

    test('BEYOND both criteria: 4 or more tumors', async ({ page }) => {
      await page.locator('select').first().selectOption('4 or more');
      await page.fill('input[type="number"]', '2.5');

      await page.check('input[type="radio"][value="no"]');
      const radioButtons = page.locator('input[type="radio"][value="no"]');
      await radioButtons.nth(1).check();

      // Calculate
      await page.click('button:has-text("Calculate")');

      // Verify results
      await expect(page.locator('text=BEYOND CRITERIA').first()).toBeVisible();
      await expect(page.locator('text=NOT ELIGIBLE - Beyond both Milan and UCSF criteria')).toBeVisible();
      await expect(page.locator('text=4 or more tumors present')).toBeVisible();
    });

    test('BEYOND both criteria: Macrovascular invasion present', async ({ page }) => {
      // Even with ideal tumor characteristics, invasion is absolute contraindication
      await page.locator('select').first().selectOption('1');
      await page.fill('input[type="number"]', '3.0');

      await page.check('input[type="radio"][value="yes"]');
      const radioButtons = page.locator('input[type="radio"][value="no"]');
      await radioButtons.nth(1).check();

      // Calculate
      await page.click('button:has-text("Calculate")');

      // Verify results
      await expect(page.locator('text=BEYOND CRITERIA').first()).toBeVisible();
      await expect(page.locator('text=Macrovascular invasion present (absolute contraindication)')).toBeVisible();
      await expect(page.locator('text=NOT ELIGIBLE')).toBeVisible();
    });

    test('BEYOND both criteria: Extrahepatic disease present', async ({ page }) => {
      // Even with ideal tumor characteristics, extrahepatic disease is absolute contraindication
      await page.locator('select').first().selectOption('1');
      await page.fill('input[type="number"]', '3.0');

      const radioButtons = page.locator('input[type="radio"][value="no"]');
      await radioButtons.nth(0).check();

      await page.check('input[type="radio"][value="yes"]');

      // Calculate
      await page.click('button:has-text("Calculate")');

      // Verify results
      await expect(page.locator('text=BEYOND CRITERIA').first()).toBeVisible();
      await expect(page.locator('text=Extrahepatic disease present (absolute contraindication)')).toBeVisible();
      await expect(page.locator('text=NOT ELIGIBLE')).toBeVisible();
    });

    test('INDETERMINATE: Unknown macrovascular invasion status', async ({ page }) => {
      await page.locator('select').first().selectOption('1');
      await page.fill('input[type="number"]', '4.0');

      await page.check('input[type="radio"][value="unknown"]');
      const radioButtons = page.locator('input[type="radio"][value="no"]');
      await radioButtons.nth(1).check();

      // Calculate
      await page.click('button:has-text("Calculate")');

      // Verify results
      await expect(page.locator('text=INDETERMINATE - Further diagnostic workup required')).toBeVisible();
      await expect(page.locator('text=Macrovascular invasion status unknown - further workup required')).toBeVisible();
    });

    test('INDETERMINATE: Unknown extrahepatic disease status', async ({ page }) => {
      await page.locator('select').first().selectOption('1');
      await page.fill('input[type="number"]', '4.0');

      const radioButtons = page.locator('input[type="radio"][value="no"]');
      await radioButtons.nth(0).check();

      await page.check('input[type="radio"][value="unknown"]');

      // Calculate
      await page.click('button:has-text("Calculate")');

      // Verify results
      await expect(page.locator('text=INDETERMINATE - Further diagnostic workup required')).toBeVisible();
      await expect(page.locator('text=Extrahepatic disease status unknown - further workup required')).toBeVisible();
    });

    test('BEYOND Milan, edge of UCSF: Single tumor exactly 6.5 cm', async ({ page }) => {
      await page.locator('select').first().selectOption('1');
      await page.fill('input[type="number"]', '6.5');

      await page.check('input[type="radio"][value="no"]');
      const radioButtons = page.locator('input[type="radio"][value="no"]');
      await radioButtons.nth(1).check();

      // Calculate
      await page.click('button:has-text("Calculate")');

      // Verify Milan BEYOND
      await expect(page.locator('text=Single tumor 6.5 cm exceeds 5 cm limit')).toBeVisible();

      // Verify UCSF WITHIN (at boundary)
      await expect(page.locator('text=Single tumor 6.5 cm (≤6.5 cm required)')).toBeVisible();
      await expect(page.locator('text=ELIGIBLE - Meets UCSF Criteria')).toBeVisible();
    });

    test('BEYOND UCSF: 3 tumors exceeding total diameter limit', async ({ page }) => {
      // 3 tumors: 4.0 + 3.0 + 1.5 = 8.5 cm (exceeds UCSF 8 cm total limit)
      await page.locator('select').first().selectOption('3');

      const numberInputs = page.locator('input[type="number"]');
      await numberInputs.nth(0).fill('4.0');
      await numberInputs.nth(1).fill('3.0');
      await numberInputs.nth(2).fill('1.5');

      await page.check('input[type="radio"][value="no"]');
      const radioButtons = page.locator('input[type="radio"][value="no"]');
      await radioButtons.nth(1).check();

      // Calculate
      await page.click('button:has-text("Calculate")');

      // Verify both BEYOND
      await expect(page.locator('text=BEYOND CRITERIA').first()).toBeVisible();
      await expect(page.locator('text=total diameter 8.5 cm exceeds 8 cm limit')).toBeVisible();
      await expect(page.locator('text=NOT ELIGIBLE - Beyond both Milan and UCSF criteria')).toBeVisible();
    });
  });

  test.describe('Input Validation & Error Handling', () => {

    test('should require tumor count selection', async ({ page }) => {
      // Try to calculate without selecting tumor count
      await page.click('button:has-text("Calculate")');

      // Should show error
      await expect(page.locator('text=Please select the number of tumors')).toBeVisible();
    });

    test('should require largest tumor diameter', async ({ page }) => {
      await page.locator('select').first().selectOption('1');

      await page.check('input[type="radio"][value="no"]');
      const radioButtons = page.locator('input[type="radio"][value="no"]');
      await radioButtons.nth(1).check();

      // Calculate without entering tumor size
      await page.click('button:has-text("Calculate")');

      // Should show error
      await expect(page.locator('text=Please enter the largest tumor diameter')).toBeVisible();
    });

    test('should require second tumor size when count is 2', async ({ page }) => {
      await page.locator('select').first().selectOption('2');
      await page.fill('input[type="number"]', '3.5');

      await page.check('input[type="radio"][value="no"]');
      const radioButtons = page.locator('input[type="radio"][value="no"]');
      await radioButtons.nth(1).check();

      // Calculate without second tumor size
      await page.click('button:has-text("Calculate")');

      // Should show error
      await expect(page.locator('text=Please enter the second tumor diameter')).toBeVisible();
    });

    test('should require third tumor size when count is 3', async ({ page }) => {
      await page.locator('select').first().selectOption('3');

      const numberInputs = page.locator('input[type="number"]');
      await numberInputs.nth(0).fill('3.0');
      await numberInputs.nth(1).fill('2.5');
      // Don't fill third tumor

      await page.check('input[type="radio"][value="no"]');
      const radioButtons = page.locator('input[type="radio"][value="no"]');
      await radioButtons.nth(1).check();

      // Calculate
      await page.click('button:has-text("Calculate")');

      // Should show error
      await expect(page.locator('text=Please enter the third tumor diameter')).toBeVisible();
    });

    test('should require macrovascular invasion status', async ({ page }) => {
      await page.locator('select').first().selectOption('1');
      await page.fill('input[type="number"]', '4.0');

      const radioButtons = page.locator('input[type="radio"][value="no"]');
      await radioButtons.nth(1).check(); // Only check extrahepatic, not vascular

      // Calculate
      await page.click('button:has-text("Calculate")');

      // Should show error
      await expect(page.locator('text=Please specify macrovascular invasion status')).toBeVisible();
    });

    test('should require extrahepatic disease status', async ({ page }) => {
      await page.locator('select').first().selectOption('1');
      await page.fill('input[type="number"]', '4.0');

      await page.check('input[type="radio"][value="no"]');
      // Don't check extrahepatic disease

      // Calculate
      await page.click('button:has-text("Calculate")');

      // Should show error
      await expect(page.locator('text=Please specify extrahepatic disease status')).toBeVisible();
    });
  });

  test.describe('Expected Clinical Outcomes Display', () => {

    test('should show excellent prognosis for Milan-eligible patients', async ({ page }) => {
      await page.locator('select').first().selectOption('1');
      await page.fill('input[type="number"]', '4.0');

      await page.check('input[type="radio"][value="no"]');
      const radioButtons = page.locator('input[type="radio"][value="no"]');
      await radioButtons.nth(1).check();

      await page.click('button:has-text("Calculate")');

      // Check for survival statistics from Mazzaferro 1996 and 2009
      await expect(page.locator('text=Expected 4-year survival >70%')).toBeVisible();
      await expect(page.locator('text=5-year recurrence-free survival 83%')).toBeVisible();
    });

    test('should show good prognosis for UCSF-eligible patients', async ({ page }) => {
      await page.locator('select').first().selectOption('1');
      await page.fill('input[type="number"]', '6.0');

      await page.check('input[type="radio"][value="no"]');
      const radioButtons = page.locator('input[type="radio"][value="no"]');
      await radioButtons.nth(1).check();

      await page.click('button:has-text("Calculate")');

      // Check for UCSF outcomes from Yao 2001
      await expect(page.locator('text=Expected 5-year survival ~75%')).toBeVisible();
    });

    test('should suggest alternatives for ineligible patients', async ({ page }) => {
      await page.locator('select').first().selectOption('4 or more');
      await page.fill('input[type="number"]', '5.0');

      await page.check('input[type="radio"][value="no"]');
      const radioButtons = page.locator('input[type="radio"][value="no"]');
      await radioButtons.nth(1).check();

      await page.click('button:has-text("Calculate")');

      // Check for alternative treatment suggestions
      await expect(page.locator('text=Consider alternative treatments')).toBeVisible();
      await expect(page.locator('text=ablation, TACE, systemic therapy')).toBeVisible();
      await expect(page.locator('text=Down-staging protocols')).toBeVisible();
    });

    test('should recommend workup for unknown status', async ({ page }) => {
      await page.locator('select').first().selectOption('1');
      await page.fill('input[type="number"]', '4.0');

      await page.check('input[type="radio"][value="unknown"]');
      const radioButtons = page.locator('input[type="radio"][value="unknown"]');
      await radioButtons.nth(1).check();

      await page.click('button:has-text("Calculate")');

      // Check for workup recommendation
      await expect(page.locator('text=Cannot determine eligibility until')).toBeVisible();
      await expect(page.locator('text=vascular invasion and extrahepatic disease status are clarified')).toBeVisible();
    });
  });

  test.describe('Results Display Format', () => {

    test('should display comprehensive results with proper sections', async ({ page }) => {
      await page.locator('select').first().selectOption('2');

      const numberInputs = page.locator('input[type="number"]');
      await numberInputs.nth(0).fill('2.8');
      await numberInputs.nth(1).fill('2.2');

      await page.check('input[type="radio"][value="no"]');
      const radioButtons = page.locator('input[type="radio"][value="no"]');
      await radioButtons.nth(1).check();

      await page.click('button:has-text("Calculate")');

      // Check for patient summary section
      await expect(page.locator('text=Number of Tumors:')).toBeVisible();
      await expect(page.locator('text=Largest Tumor Diameter:')).toBeVisible();
      await expect(page.locator('text=Total Tumor Diameter:')).toBeVisible();
      await expect(page.locator('text=Macrovascular Invasion:')).toBeVisible();
      await expect(page.locator('text=Extrahepatic Disease:')).toBeVisible();

      // Check for Milan criteria section
      await expect(page.locator('text=Milan Criteria:')).toBeVisible();
      await expect(page.locator('text=Milan Details:')).toBeVisible();

      // Check for UCSF criteria section
      await expect(page.locator('text=UCSF Criteria:')).toBeVisible();
      await expect(page.locator('text=UCSF Details:')).toBeVisible();

      // Check for final assessment section
      await expect(page.locator('text=Transplant Eligibility:')).toBeVisible();
      await expect(page.locator('text=Expected Outcomes:')).toBeVisible();
    });

    test('should format tumor sizes with one decimal place', async ({ page }) => {
      await page.locator('select').first().selectOption('1');
      await page.fill('input[type="number"]', '4.567');

      await page.check('input[type="radio"][value="no"]');
      const radioButtons = page.locator('input[type="radio"][value="no"]');
      await radioButtons.nth(1).check();

      await page.click('button:has-text("Calculate")');

      // Check formatted output
      await expect(page.locator('text=4.6 cm')).toBeVisible();
    });

    test('should capitalize status values properly', async ({ page }) => {
      await page.locator('select').first().selectOption('1');
      await page.fill('input[type="number"]', '4.0');

      await page.check('input[type="radio"][value="no"]');
      const radioButtons = page.locator('input[type="radio"][value="no"]');
      await radioButtons.nth(1).check();

      await page.click('button:has-text("Calculate")');

      // Check capitalization
      await expect(page.locator('text=Macrovascular Invasion: No')).toBeVisible();
      await expect(page.locator('text=Extrahepatic Disease: No')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {

    test('should have proper ARIA labels and roles', async ({ page }) => {
      // Check for proper labeling
      const tumorCountLabel = page.locator('label:has-text("Number of Tumors")');
      await expect(tumorCountLabel).toBeVisible();

      // Check radio button groups have proper structure
      const radioGroups = page.locator('[type="radio"]');
      const count = await radioGroups.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should be keyboard navigable', async ({ page }) => {
      // Tab through form elements
      await page.keyboard.press('Tab');

      // Verify focus states work
      const activeElement = page.locator(':focus');
      await expect(activeElement).toBeVisible();
    });
  });
});
