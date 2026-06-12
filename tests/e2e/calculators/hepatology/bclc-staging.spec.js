/**
 * BCLC Staging Calculator - E2E Tests
 *
 * Tests the Barcelona Clinic Liver Cancer (BCLC) staging system calculator
 * for hepatocellular carcinoma (HCC) with treatment recommendations.
 *
 * Test Coverage:
 * - Stage 0 (Very Early): Single tumor ≤2 cm
 * - Stage A (Early): Single tumor OR up to 3 tumors ≤3 cm
 * - Stage B (Intermediate): Multifocal disease
 * - Stage C (Advanced): Vascular invasion or metastasis
 * - Stage D (Terminal): Poor performance or decompensated cirrhosis
 * - Child-Pugh scoring validation
 * - Conditional field display logic
 * - Reference link verification
 * - Edge cases and boundary conditions
 */

import { test, expect } from '@playwright/test';
import {
  navigateToCalculator,
  fillInput,
  selectRadio,
  verifyReferenceLinks,
  verifyThemeConsistency,
  verifyMobileResponsive
} from '../../../helpers/calculator-test-helper.js';

const CALCULATOR_NAME = 'BCLC Staging (HCC)';

test.describe('BCLC Staging Calculator', () => {

  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, CALCULATOR_NAME);

    // Verify calculator loaded
    await expect(page.getByTestId('calculator-title').first()).toContainText('BCLC Staging (HCC)');
    await expect(page.locator('text=Barcelona Clinic Liver Cancer staging').first()).toBeVisible();
  });

  test('should display calculator info panel with BCLC 2022 Guidelines link', async ({ page }) => {
    // Verify info panel is present
    const infoPanel = page.getByTestId('calculator-info');
    await expect(infoPanel).toBeVisible();

    // Verify content mentions all stages
    await expect(infoPanel).toContainText('Stage 0 (Very Early)');
    await expect(infoPanel).toContainText('Stage A (Early)');
    await expect(infoPanel).toContainText('Stage B (Intermediate)');
    await expect(infoPanel).toContainText('Stage C (Advanced)');
    await expect(infoPanel).toContainText('Stage D (Terminal)');

    // Verify guidelines link
    const guidelinesLink = page.locator('button:has-text("View BCLC 2022 Guidelines")');
    await expect(guidelinesLink).toBeVisible();
  });

  test('should display all required input fields', async ({ page }) => {
    // Tumor burden fields
    await expect(page.locator('text=Number of Tumors').first()).toBeVisible();
    await expect(page.locator('text=Largest Tumor Size (cm).first()')).toBeVisible();
    await expect(page.locator('text=All Tumors ≤3 cm?').first()).toBeVisible();

    // Vascular invasion & metastasis
    await expect(page.getByRole('group', { name: 'Vascular Invasion' })).toBeVisible();
    await expect(page.locator('text=Extrahepatic Spread').first()).toBeVisible();

    // Performance status
    await expect(page.locator('text=ECOG Performance Status').first()).toBeVisible();

    // Liver function (Child-Pugh)
    await expect(page.locator('text=Total Bilirubin (mg/dL).first()')).toBeVisible();
    await expect(page.locator('text=Serum Albumin (g/dL).first()')).toBeVisible();
    await expect(page.locator('text=INR').first()).toBeVisible();
    await expect(page.locator('text=Ascites').first()).toBeVisible();
    await expect(page.locator('text=Hepatic Encephalopathy').first()).toBeVisible();

    // Transplant eligibility
    await expect(page.locator('text=Liver Transplant Candidate?').first()).toBeVisible();
  });

  test('Stage 0 (Very Early) - Single tumor ≤2cm, ECOG 0, Child-Pugh A', async ({ page }) => {
    // Tumor burden: Single tumor ≤2 cm
    await selectRadio(page, 'Number of Tumors', 'Single tumor');
    await fillInput(page, 'Largest Tumor Size (cm)', '1.8');
    await selectRadio(page, 'All Tumors ≤3 cm?', 'N/A - single tumor');

    // No vascular invasion or metastasis
    await selectRadio(page, 'Vascular Invasion', 'None');
    await selectRadio(page, 'Extrahepatic Spread', 'None');

    // ECOG 0
    await selectRadio(page, 'ECOG Performance Status', '0 - Fully active, no restrictions');

    // Child-Pugh A: Optimal liver function
    await fillInput(page, 'Total Bilirubin (mg/dL)', '0.9');
    await fillInput(page, 'Serum Albumin (g/dL)', '4.2');
    await fillInput(page, 'INR', '1.0');
    await selectRadio(page, 'Ascites', 'None');
    await selectRadio(page, 'Hepatic Encephalopathy', 'None');

    await selectRadio(page, 'Liver Transplant Candidate?', 'Yes - eligible for transplant');

    // Calculate
    await page.getByRole('button', { name: 'Calculate' }).click();

    // Verify results
    await expect(page.locator('text=BCLC Stage:').first()).toBeVisible();
    await expect(page.locator('text=BCLC Stage: 0').first()).toBeVisible();
    await expect(page.locator('text=Very early stage').first()).toBeVisible();
    await expect(page.locator('text=Child-Pugh Score:').first()).toBeVisible();
    await expect(page.locator('text=5 points (Class A).first()')).toBeVisible();
    await expect(page.locator('text=Resection or ablation').first()).toBeVisible();
    await expect(page.locator('text=>5 years').first()).toBeVisible();
  });

  test('Stage A (Early) - Single tumor >2cm, ECOG 0, Child-Pugh A', async ({ page }) => {
    // Tumor burden: Single tumor >2 cm
    await selectRadio(page, 'Number of Tumors', 'Single tumor');
    await fillInput(page, 'Largest Tumor Size (cm)', '4.5');
    await selectRadio(page, 'All Tumors ≤3 cm?', 'N/A - single tumor');

    // No vascular invasion or metastasis
    await selectRadio(page, 'Vascular Invasion', 'None');
    await selectRadio(page, 'Extrahepatic Spread', 'None');

    // ECOG 0
    await selectRadio(page, 'ECOG Performance Status', '0 - Fully active, no restrictions');

    // Child-Pugh A
    await fillInput(page, 'Total Bilirubin (mg/dL)', '1.1');
    await fillInput(page, 'Serum Albumin (g/dL)', '3.8');
    await fillInput(page, 'INR', '1.1');
    await selectRadio(page, 'Ascites', 'None');
    await selectRadio(page, 'Hepatic Encephalopathy', 'None');

    await selectRadio(page, 'Liver Transplant Candidate?', 'No - not a candidate');

    // Calculate
    await page.getByRole('button', { name: 'Calculate' }).click();

    // Verify results
    await expect(page.locator('text=BCLC Stage:').first()).toBeVisible();
    await expect(page.locator('text=BCLC Stage: A').first()).toBeVisible();
    await expect(page.locator('text=Early stage').first()).toBeVisible();
    await expect(page.locator('text=Single tumor (4.5 cm).first()')).toBeVisible();
    await expect(page.locator('text=Resection or ablation').first()).toBeVisible();
    await expect(page.locator('text=median OS: 81 months').first()).toBeVisible();
  });

  test('Stage A (Early) - Milan Criteria: 2-3 tumors all ≤3cm', async ({ page }) => {
    // Tumor burden: 2-3 tumors, all ≤3 cm
    await selectRadio(page, 'Number of Tumors', '2-3 tumors');
    await fillInput(page, 'Largest Tumor Size (cm)', '2.8');
    await selectRadio(page, 'All Tumors ≤3 cm?', 'Yes - all tumors ≤3 cm');

    // No vascular invasion or metastasis
    await selectRadio(page, 'Vascular Invasion', 'None');
    await selectRadio(page, 'Extrahepatic Spread', 'None');

    // ECOG 0
    await selectRadio(page, 'ECOG Performance Status', '0 - Fully active, no restrictions');

    // Child-Pugh A
    await fillInput(page, 'Total Bilirubin (mg/dL)', '1.3');
    await fillInput(page, 'Serum Albumin (g/dL)', '3.6');
    await fillInput(page, 'INR', '1.2');
    await selectRadio(page, 'Ascites', 'None');
    await selectRadio(page, 'Hepatic Encephalopathy', 'None');

    await selectRadio(page, 'Liver Transplant Candidate?', 'Yes - eligible for transplant');

    // Calculate
    await page.getByRole('button', { name: 'Calculate' }).click();

    // Verify results
    await expect(page.locator('text=BCLC Stage:').first()).toBeVisible();
    await expect(page.locator('text=BCLC Stage: A').first()).toBeVisible();
    await expect(page.locator('text=2-3 tumors, all ≤3 cm (within Milan criteria).first()')).toBeVisible();
    await expect(page.locator('text=Liver transplant').first()).toBeVisible();
  });

  test('Stage B (Intermediate) - More than 3 tumors, ECOG 0', async ({ page }) => {
    // Tumor burden: >3 tumors
    await selectRadio(page, 'Number of Tumors', 'More than 3 tumors');
    await fillInput(page, 'Largest Tumor Size (cm)', '3.5');
    await selectRadio(page, 'All Tumors ≤3 cm?', 'No - at least one tumor >3 cm');

    // No vascular invasion or metastasis
    await selectRadio(page, 'Vascular Invasion', 'None');
    await selectRadio(page, 'Extrahepatic Spread', 'None');

    // ECOG 0
    await selectRadio(page, 'ECOG Performance Status', '0 - Fully active, no restrictions');

    // Child-Pugh B
    await fillInput(page, 'Total Bilirubin (mg/dL)', '2.5');
    await fillInput(page, 'Serum Albumin (g/dL)', '3.0');
    await fillInput(page, 'INR', '1.8');
    await selectRadio(page, 'Ascites', 'Slight');
    await selectRadio(page, 'Hepatic Encephalopathy', 'None');

    await selectRadio(page, 'Liver Transplant Candidate?', 'Unknown');

    // Calculate
    await page.getByRole('button', { name: 'Calculate' }).click();

    // Verify results
    await expect(page.locator('text=BCLC Stage:').first()).toBeVisible();
    await expect(page.locator('text=BCLC Stage: B').first()).toBeVisible();
    await expect(page.locator('text=Intermediate stage').first()).toBeVisible();
    await expect(page.locator('text=(>3 tumors).first()')).toBeVisible();
    await expect(page.locator('text=TACE').first()).toBeVisible();
    await expect(page.locator('text=~2.5 years').first()).toBeVisible();
    await expect(page.locator('text=Child-Pugh Score:').first()).toBeVisible();
    await expect(page.locator('text=Class B').first()).toBeVisible();
  });

  test('Stage C (Advanced) - Portal vein invasion', async ({ page }) => {
    // Tumor burden
    await selectRadio(page, 'Number of Tumors', 'Single tumor');
    await fillInput(page, 'Largest Tumor Size (cm)', '5.0');
    await selectRadio(page, 'All Tumors ≤3 cm?', 'N/A - single tumor');

    // Portal vein invasion (main determinant for Stage C)
    await selectRadio(page, 'Vascular Invasion', 'Portal vein - left/right/main trunk');
    await selectRadio(page, 'Extrahepatic Spread', 'None');

    // ECOG 1
    await selectRadio(page, 'ECOG Performance Status', '1 - Restricted in strenuous activity, ambulatory');

    // Child-Pugh A
    await fillInput(page, 'Total Bilirubin (mg/dL)', '1.5');
    await fillInput(page, 'Serum Albumin (g/dL)', '3.5');
    await fillInput(page, 'INR', '1.3');
    await selectRadio(page, 'Ascites', 'None');
    await selectRadio(page, 'Hepatic Encephalopathy', 'None');

    await selectRadio(page, 'Liver Transplant Candidate?', 'No - not a candidate');

    // Calculate
    await page.getByRole('button', { name: 'Calculate' }).click();

    // Verify results
    await expect(page.locator('text=BCLC Stage:').first()).toBeVisible();
    await expect(page.locator('text=BCLC Stage: C').first()).toBeVisible();
    await expect(page.locator('text=Advanced stage').first()).toBeVisible();
    await expect(page.locator('text=vascular invasion (portal vein left/right/main trunk).first()')).toBeVisible();
    await expect(page.locator('text=Atezolizumab + Bevacizumab').first()).toBeVisible();
    await expect(page.locator('text=Sorafenib or Lenvatinib').first()).toBeVisible();
    await expect(page.locator('text=~2 years with systemic therapy').first()).toBeVisible();
  });

  test('Stage C (Advanced) - Distant metastasis', async ({ page }) => {
    // Tumor burden
    await selectRadio(page, 'Number of Tumors', '2-3 tumors');
    await fillInput(page, 'Largest Tumor Size (cm)', '3.0');
    await selectRadio(page, 'All Tumors ≤3 cm?', 'Yes - all tumors ≤3 cm');

    // Distant metastasis
    await selectRadio(page, 'Vascular Invasion', 'None');
    await selectRadio(page, 'Extrahepatic Spread', 'Distant metastasis (lung, bone, etc.)');

    // ECOG 0
    await selectRadio(page, 'ECOG Performance Status', '0 - Fully active, no restrictions');

    // Child-Pugh A
    await fillInput(page, 'Total Bilirubin (mg/dL)', '0.8');
    await fillInput(page, 'Serum Albumin (g/dL)', '4.0');
    await fillInput(page, 'INR', '1.0');
    await selectRadio(page, 'Ascites', 'None');
    await selectRadio(page, 'Hepatic Encephalopathy', 'None');

    await selectRadio(page, 'Liver Transplant Candidate?', 'No - not a candidate');

    // Calculate
    await page.getByRole('button', { name: 'Calculate' }).click();

    // Verify results
    await expect(page.locator('text=BCLC Stage:').first()).toBeVisible();
    await expect(page.locator('text=BCLC Stage: C').first()).toBeVisible();
    await expect(page.locator('text=extrahepatic spread (distant metastasis).first()')).toBeVisible();
    await expect(page.locator('text=Systemic therapy').first()).toBeVisible();
  });

  test('Stage D (Terminal) - Poor ECOG performance (>2)', async ({ page }) => {
    // Tumor burden
    await selectRadio(page, 'Number of Tumors', 'Single tumor');
    await fillInput(page, 'Largest Tumor Size (cm)', '2.0');
    await selectRadio(page, 'All Tumors ≤3 cm?', 'N/A - single tumor');

    // No vascular invasion or metastasis
    await selectRadio(page, 'Vascular Invasion', 'None');
    await selectRadio(page, 'Extrahepatic Spread', 'None');

    // ECOG 3 (terminal criteria)
    await selectRadio(page, 'ECOG Performance Status', '3 - Limited self-care, confined >50% of time');

    // Child-Pugh A
    await fillInput(page, 'Total Bilirubin (mg/dL)', '1.0');
    await fillInput(page, 'Serum Albumin (g/dL)', '3.8');
    await fillInput(page, 'INR', '1.1');
    await selectRadio(page, 'Ascites', 'None');
    await selectRadio(page, 'Hepatic Encephalopathy', 'None');

    await selectRadio(page, 'Liver Transplant Candidate?', 'No - not a candidate');

    // Calculate
    await page.getByRole('button', { name: 'Calculate' }).click();

    // Verify results
    await expect(page.locator('text=BCLC Stage:').first()).toBeVisible();
    await expect(page.locator('text=BCLC Stage: D').first()).toBeVisible();
    await expect(page.locator('text=Terminal stage').first()).toBeVisible();
    await expect(page.locator('text=poor performance status (ECOG >2).first()')).toBeVisible();
    await expect(page.locator('text=Best supportive care').first()).toBeVisible();
    await expect(page.locator('text=~3 months').first()).toBeVisible();
  });

  test('Stage D (Terminal) - Decompensated cirrhosis (Child-Pugh C)', async ({ page }) => {
    // Tumor burden
    await selectRadio(page, 'Number of Tumors', 'Single tumor');
    await fillInput(page, 'Largest Tumor Size (cm)', '3.0');
    await selectRadio(page, 'All Tumors ≤3 cm?', 'N/A - single tumor');

    // No vascular invasion or metastasis
    await selectRadio(page, 'Vascular Invasion', 'None');
    await selectRadio(page, 'Extrahepatic Spread', 'None');

    // ECOG 1
    await selectRadio(page, 'ECOG Performance Status', '1 - Restricted in strenuous activity, ambulatory');

    // Child-Pugh C (decompensated)
    await fillInput(page, 'Total Bilirubin (mg/dL)', '4.5');
    await fillInput(page, 'Serum Albumin (g/dL)', '2.5');
    await fillInput(page, 'INR', '2.5');
    await selectRadio(page, 'Ascites', 'Moderate to Severe');
    await selectRadio(page, 'Hepatic Encephalopathy', 'Grade 3-4 (stupor/coma)');

    await selectRadio(page, 'Liver Transplant Candidate?', 'No - not a candidate');

    // Calculate
    await page.getByRole('button', { name: 'Calculate' }).click();

    // Verify results
    await expect(page.locator('text=BCLC Stage:').first()).toBeVisible();
    await expect(page.locator('text=BCLC Stage: D').first()).toBeVisible();
    await expect(page.locator('text=decompensated cirrhosis (Child-Pugh C).first()')).toBeVisible();
    await expect(page.locator('text=Child-Pugh Score:').first()).toBeVisible();
    await expect(page.locator('text=15 points (Class C).first()')).toBeVisible();
    await expect(page.locator('text=Decompensated cirrhosis').first()).toBeVisible();
  });

  test('Child-Pugh Score calculation - Class A (5-6 points)', async ({ page }) => {
    // Set up basic HCC
    await selectRadio(page, 'Number of Tumors', 'Single tumor');
    await fillInput(page, 'Largest Tumor Size (cm)', '2.0');
    await selectRadio(page, 'All Tumors ≤3 cm?', 'N/A - single tumor');
    await selectRadio(page, 'Vascular Invasion', 'None');
    await selectRadio(page, 'Extrahepatic Spread', 'None');
    await selectRadio(page, 'ECOG Performance Status', '0 - Fully active, no restrictions');

    // Child-Pugh A: All optimal (5 points total)
    await fillInput(page, 'Total Bilirubin (mg/dL)', '1.0');  // 1 point
    await fillInput(page, 'Serum Albumin (g/dL)', '4.0');     // 1 point
    await fillInput(page, 'INR', '1.0');                      // 1 point
    await selectRadio(page, 'Ascites', 'None');               // 1 point
    await selectRadio(page, 'Hepatic Encephalopathy', 'None'); // 1 point

    await selectRadio(page, 'Liver Transplant Candidate?', 'Unknown');

    // Calculate
    await page.getByRole('button', { name: 'Calculate' }).click();

    // Verify Child-Pugh calculation
    await expect(page.locator('text=5 points (Class A).first()')).toBeVisible();
    await expect(page.locator('text=Well-compensated cirrhosis (Class A).first()')).toBeVisible();
  });

  test('Child-Pugh Score calculation - Class B (7-9 points)', async ({ page }) => {
    // Set up basic HCC
    await selectRadio(page, 'Number of Tumors', 'Single tumor');
    await fillInput(page, 'Largest Tumor Size (cm)', '3.0');
    await selectRadio(page, 'All Tumors ≤3 cm?', 'N/A - single tumor');
    await selectRadio(page, 'Vascular Invasion', 'None');
    await selectRadio(page, 'Extrahepatic Spread', 'None');
    await selectRadio(page, 'ECOG Performance Status', '0 - Fully active, no restrictions');

    // Child-Pugh B: 8 points total
    await fillInput(page, 'Total Bilirubin (mg/dL)', '2.5');  // 2 points
    await fillInput(page, 'Serum Albumin (g/dL)', '3.0');     // 2 points
    await fillInput(page, 'INR', '1.8');                      // 2 points
    await selectRadio(page, 'Ascites', 'Slight');             // 2 points
    await selectRadio(page, 'Hepatic Encephalopathy', 'None'); // 1 point
    // Total: 2+2+2+2+1 = 9 points (actually should be 8 based on ranges)

    await selectRadio(page, 'Liver Transplant Candidate?', 'Unknown');

    // Calculate
    await page.getByRole('button', { name: 'Calculate' }).click();

    // Verify Child-Pugh calculation
    await expect(page.locator('text=Class B').first()).toBeVisible();
    await expect(page.locator('text=Significantly compromised function (Class B).first()')).toBeVisible();
  });

  test('Edge case: Boundary tumor size 2.0cm (Stage 0 vs A threshold)', async ({ page }) => {
    // Exactly 2.0 cm - should still be Stage 0 if all other criteria met
    await selectRadio(page, 'Number of Tumors', 'Single tumor');
    await fillInput(page, 'Largest Tumor Size (cm)', '2.0');
    await selectRadio(page, 'All Tumors ≤3 cm?', 'N/A - single tumor');
    await selectRadio(page, 'Vascular Invasion', 'None');
    await selectRadio(page, 'Extrahepatic Spread', 'None');
    await selectRadio(page, 'ECOG Performance Status', '0 - Fully active, no restrictions');

    await fillInput(page, 'Total Bilirubin (mg/dL)', '1.0');
    await fillInput(page, 'Serum Albumin (g/dL)', '4.0');
    await fillInput(page, 'INR', '1.0');
    await selectRadio(page, 'Ascites', 'None');
    await selectRadio(page, 'Hepatic Encephalopathy', 'None');

    await selectRadio(page, 'Liver Transplant Candidate?', 'Yes - eligible for transplant');

    await page.getByRole('button', { name: 'Calculate' }).click();

    // At exactly 2.0cm, should be Stage 0
    await expect(page.locator('text=BCLC Stage:').first()).toBeVisible();
    await expect(page.locator('text=BCLC Stage: 0').first()).toBeVisible();
  });

  test('Edge case: Tumor 2.1cm - should be Stage A, not Stage 0', async ({ page }) => {
    // Just over 2.0 cm - should be Stage A
    await selectRadio(page, 'Number of Tumors', 'Single tumor');
    await fillInput(page, 'Largest Tumor Size (cm)', '2.1');
    await selectRadio(page, 'All Tumors ≤3 cm?', 'N/A - single tumor');
    await selectRadio(page, 'Vascular Invasion', 'None');
    await selectRadio(page, 'Extrahepatic Spread', 'None');
    await selectRadio(page, 'ECOG Performance Status', '0 - Fully active, no restrictions');

    await fillInput(page, 'Total Bilirubin (mg/dL)', '1.0');
    await fillInput(page, 'Serum Albumin (g/dL)', '4.0');
    await fillInput(page, 'INR', '1.0');
    await selectRadio(page, 'Ascites', 'None');
    await selectRadio(page, 'Hepatic Encephalopathy', 'None');

    await selectRadio(page, 'Liver Transplant Candidate?', 'Yes - eligible for transplant');

    await page.getByRole('button', { name: 'Calculate' }).click();

    // Should be Stage A, not Stage 0
    await expect(page.locator('text=BCLC Stage:').first()).toBeVisible();
    await expect(page.locator('text=BCLC Stage: A').first()).toBeVisible();
    await expect(page.locator('text=Early stage').first()).toBeVisible();
  });

  test('Edge case: ECOG 0 with Stage 0 criteria but Child-Pugh B - should not be Stage 0', async ({ page }) => {
    // Stage 0 requires Child-Pugh A
    await selectRadio(page, 'Number of Tumors', 'Single tumor');
    await fillInput(page, 'Largest Tumor Size (cm)', '1.8');
    await selectRadio(page, 'All Tumors ≤3 cm?', 'N/A - single tumor');
    await selectRadio(page, 'Vascular Invasion', 'None');
    await selectRadio(page, 'Extrahepatic Spread', 'None');
    await selectRadio(page, 'ECOG Performance Status', '0 - Fully active, no restrictions');

    // Child-Pugh B
    await fillInput(page, 'Total Bilirubin (mg/dL)', '2.5');
    await fillInput(page, 'Serum Albumin (g/dL)', '3.0');
    await fillInput(page, 'INR', '1.8');
    await selectRadio(page, 'Ascites', 'Slight');
    await selectRadio(page, 'Hepatic Encephalopathy', 'None');

    await selectRadio(page, 'Liver Transplant Candidate?', 'Unknown');

    await page.getByRole('button', { name: 'Calculate' }).click();

    // Should be Stage A (not 0) due to Child-Pugh B
    await expect(page.locator('text=BCLC Stage:').first()).toBeVisible();
    await expect(page.locator('text=BCLC Stage: A').first()).toBeVisible();
    await expect(page.locator('text=Class B').first()).toBeVisible();
  });

  test('Edge case: Both vascular invasion AND metastasis - Stage C', async ({ page }) => {
    // Both present - should be Stage C
    await selectRadio(page, 'Number of Tumors', 'More than 3 tumors');
    await fillInput(page, 'Largest Tumor Size (cm)', '5.0');
    await selectRadio(page, 'All Tumors ≤3 cm?', 'No - at least one tumor >3 cm');

    // Both vascular invasion AND metastasis
    await selectRadio(page, 'Vascular Invasion', 'Portal vein - segmental/sectoral');
    await selectRadio(page, 'Extrahepatic Spread', 'Lymph node metastasis');

    await selectRadio(page, 'ECOG Performance Status', '1 - Restricted in strenuous activity, ambulatory');

    await fillInput(page, 'Total Bilirubin (mg/dL)', '1.5');
    await fillInput(page, 'Serum Albumin (g/dL)', '3.5');
    await fillInput(page, 'INR', '1.3');
    await selectRadio(page, 'Ascites', 'None');
    await selectRadio(page, 'Hepatic Encephalopathy', 'None');

    await selectRadio(page, 'Liver Transplant Candidate?', 'No - not a candidate');

    await page.getByRole('button', { name: 'Calculate' }).click();

    // Should be Stage C with both mentioned
    await expect(page.locator('text=BCLC Stage: C').first()).toBeVisible();
    await expect(page.locator('text=vascular invasion').first()).toBeVisible();
    await expect(page.locator('text=extrahepatic spread').first()).toBeVisible();
  });

  test('should verify all reference links are accessible', async ({ page }) => {
    // Scroll to references section
    await page.locator('h3:has-text("References")').scrollIntoViewIfNeeded();

    // Verify reference section exists
    await expect(page.locator('h3:has-text("References")')).toBeVisible();

    // Count reference links (should be 12)
    const referenceLinks = await page.locator('section a[href^="http"]').count();
    expect(referenceLinks).toBe(12);

    // Verify key references are present
    await expect(page.locator('a:has-text("Llovet JM, Bru C, Bruix J")')).toBeVisible();
    await expect(page.locator('a:has-text("Reig M, Forner A, Rimola J")')).toBeVisible();
    await expect(page.locator('a:has-text("Pugh RN, Murray-Lyon IM")')).toBeVisible();
    await expect(page.locator('a:has-text("ECOG Performance Status")')).toBeVisible();
    await expect(page.locator('a:has-text("Atezolizumab plus Bevacizumab")')).toBeVisible();

    // Test a sample of links (automated check)
    const brokenLinks = await verifyReferenceLinks(page);

    // Most links should be accessible (allow for a few rate-limiting issues)
    expect(brokenLinks.length).toBeLessThan(3);
  });

  test('should maintain theme consistency', async ({ page }) => {
    await verifyThemeConsistency(page);
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    await verifyMobileResponsive(page);

    // Verify calculator is still usable on mobile
    await expect(page.getByTestId('calculator-title').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeVisible();
  });

  test('should display subLabel hints for numeric inputs', async ({ page }) => {
    // Check that numeric fields have helpful sublabels
    await expect(page.locator('text=Normal: <1.2 mg/dL').first()).toBeVisible();
    await expect(page.locator('text=Normal: 3.5-5.5 g/dL').first()).toBeVisible();
    await expect(page.locator('text=Normal: <1.1').first()).toBeVisible();
    await expect(page.locator('text=Diameter in cm').first()).toBeVisible();
  });

  test('should handle decimal inputs correctly', async ({ page }) => {
    await selectRadio(page, 'Number of Tumors', 'Single tumor');
    await fillInput(page, 'Largest Tumor Size (cm)', '1.95');
    await fillInput(page, 'Total Bilirubin (mg/dL)', '0.85');
    await fillInput(page, 'Serum Albumin (g/dL)', '4.25');
    await fillInput(page, 'INR', '0.95');

    await selectRadio(page, 'All Tumors ≤3 cm?', 'N/A - single tumor');
    await selectRadio(page, 'Vascular Invasion', 'None');
    await selectRadio(page, 'Extrahepatic Spread', 'None');
    await selectRadio(page, 'ECOG Performance Status', '0 - Fully active, no restrictions');
    await selectRadio(page, 'Ascites', 'None');
    await selectRadio(page, 'Hepatic Encephalopathy', 'None');
    await selectRadio(page, 'Liver Transplant Candidate?', 'Yes - eligible for transplant');

    await page.getByRole('button', { name: 'Calculate' }).click();

    // Should handle decimals properly
    await expect(page.locator('text=BCLC Stage:').first()).toBeVisible();
    await expect(page.locator('text=5 points (Class A).first()')).toBeVisible();
  });

  test('Screenshot: Stage 0 with complete output', async ({ page }) => {
    // Fill out Stage 0 scenario
    await selectRadio(page, 'Number of Tumors', 'Single tumor');
    await fillInput(page, 'Largest Tumor Size (cm)', '1.8');
    await selectRadio(page, 'All Tumors ≤3 cm?', 'N/A - single tumor');
    await selectRadio(page, 'Vascular Invasion', 'None');
    await selectRadio(page, 'Extrahepatic Spread', 'None');
    await selectRadio(page, 'ECOG Performance Status', '0 - Fully active, no restrictions');
    await fillInput(page, 'Total Bilirubin (mg/dL)', '0.9');
    await fillInput(page, 'Serum Albumin (g/dL)', '4.2');
    await fillInput(page, 'INR', '1.0');
    await selectRadio(page, 'Ascites', 'None');
    await selectRadio(page, 'Hepatic Encephalopathy', 'None');
    await selectRadio(page, 'Liver Transplant Candidate?', 'Yes - eligible for transplant');

    await page.getByRole('button', { name: 'Calculate' }).click();

    // Wait for results
    await expect(page.locator('text=BCLC Stage:').first()).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/screenshots/bclc-stage-0-complete.png',
      fullPage: true
    });
  });

  test('Screenshot: Stage C with systemic therapy recommendations', async ({ page }) => {
    // Fill out Stage C scenario
    await selectRadio(page, 'Number of Tumors', 'Single tumor');
    await fillInput(page, 'Largest Tumor Size (cm)', '5.0');
    await selectRadio(page, 'All Tumors ≤3 cm?', 'N/A - single tumor');
    await selectRadio(page, 'Vascular Invasion', 'Portal vein - left/right/main trunk');
    await selectRadio(page, 'Extrahepatic Spread', 'None');
    await selectRadio(page, 'ECOG Performance Status', '1 - Restricted in strenuous activity, ambulatory');
    await fillInput(page, 'Total Bilirubin (mg/dL)', '1.5');
    await fillInput(page, 'Serum Albumin (g/dL)', '3.5');
    await fillInput(page, 'INR', '1.3');
    await selectRadio(page, 'Ascites', 'None');
    await selectRadio(page, 'Hepatic Encephalopathy', 'None');
    await selectRadio(page, 'Liver Transplant Candidate?', 'No - not a candidate');

    await page.getByRole('button', { name: 'Calculate' }).click();

    // Wait for results
    await expect(page.locator('text=Atezolizumab + Bevacizumab').first()).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/screenshots/bclc-stage-c-systemic-therapy.png',
      fullPage: true
    });
  });

});
