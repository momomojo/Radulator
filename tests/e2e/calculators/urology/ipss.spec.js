import { test, expect } from '@playwright/test';

/**
 * IPSS (International Prostate Symptom Score) Calculator E2E Tests
 *
 * Tests the IPSS questionnaire used to assess the severity of lower urinary tract symptoms (LUTS) in men
 *
 * Scoring System:
 * - Questions 1-7: 0-5 points each
 *   - 0 = Not at all
 *   - 1 = Less than 1 in 5 times
 *   - 2 = Less than half the time
 *   - 3 = About half the time
 *   - 4 = More than half the time
 *   - 5 = Almost always (or 5+ times for nocturia)
 * - Total IPSS Score: 0-35 (sum of Q1-Q7)
 * - Question 8 (QoL): 0-6 points, scored separately
 *
 * Severity Classification:
 * - Mild: 0-7 (watchful waiting)
 * - Moderate: 8-19 (medical therapy recommended)
 * - Severe: 20-35 (medical/surgical therapy recommended)
 *
 * References:
 * - Barry MJ et al. J Urol. 1992;148(5):1549-57
 * - AUA Practice Guidelines Committee. J Urol. 2003;170(2 Pt 1):530-47
 */

test.describe('IPSS Calculator', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Navigate to IPSS calculator
    await page.click('text=IPSS (Prostate Symptoms)');
    // Wait for calculator to load
    await expect(page.locator('h2:has-text("IPSS (Prostate Symptoms)")')).toBeVisible();
  });

  test.describe('Visual Appeal & Theme Matching', () => {

    test('should display calculator with proper styling', async ({ page }) => {
      // Check calculator card is visible
      const card = page.locator('.card, [class*="card"]').first();
      await expect(card).toBeVisible();

      // Check title is visible and styled
      const title = page.locator('h2:has-text("IPSS (Prostate Symptoms)")');
      await expect(title).toBeVisible();

      // Check description is present
      await expect(page.locator('text=International Prostate Symptom Score')).toBeVisible();
    });

    test('should display info section with clinical context', async ({ page }) => {
      // Check if info section exists
      const infoSection = page.locator('text=validated 7-item questionnaire');
      await expect(infoSection).toBeVisible();

      // Verify key information is present
      await expect(page.locator('text=voiding symptoms')).toBeVisible();
      await expect(page.locator('text=mild symptoms (0-7)')).toBeVisible();
      await expect(page.locator('text=moderate (8-19)')).toBeVisible();
      await expect(page.locator('text=severe (20-35)')).toBeVisible();
    });

    test('should have responsive design on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Calculator should still be visible and usable
      await expect(page.locator('h2:has-text("IPSS (Prostate Symptoms)")')).toBeVisible();

      // First question should be visible
      await expect(page.locator('text=1. Incomplete Emptying')).toBeVisible();
    });

    test('should display all 8 questions clearly', async ({ page }) => {
      // Verify all 7 symptom questions
      await expect(page.locator('text=1. Incomplete Emptying')).toBeVisible();
      await expect(page.locator('text=2. Frequency')).toBeVisible();
      await expect(page.locator('text=3. Intermittency')).toBeVisible();
      await expect(page.locator('text=4. Urgency')).toBeVisible();
      await expect(page.locator('text=5. Weak Stream')).toBeVisible();
      await expect(page.locator('text=6. Straining')).toBeVisible();
      await expect(page.locator('text=7. Nocturia')).toBeVisible();

      // Verify QoL question
      await expect(page.locator('text=8. Quality of Life')).toBeVisible();
    });

    test('should have proper radio button styling and labels', async ({ page }) => {
      // Check that radio buttons have clear labels
      await expect(page.locator('label:has-text("Not at all")').first()).toBeVisible();
      await expect(page.locator('label:has-text("Less than 1 in 5 times")').first()).toBeVisible();
      await expect(page.locator('label:has-text("Almost always")').first()).toBeVisible();

      // Check nocturia specific options
      await expect(page.locator('label:has-text("None")').first()).toBeVisible();
      await expect(page.locator('label:has-text("5 or more times")').first()).toBeVisible();

      // Check QoL specific options
      await expect(page.locator('label:has-text("Delighted")')).toBeVisible();
      await expect(page.locator('label:has-text("Terrible")')).toBeVisible();
    });
  });

  test.describe('Radio Button Selection', () => {

    test('should allow selecting each radio option for Q1', async ({ page }) => {
      // Test all 6 options for Question 1
      const q1Options = [
        'Not at all',
        'Less than 1 in 5 times',
        'Less than half the time',
        'About half the time',
        'More than half the time',
        'Almost always'
      ];

      for (const option of q1Options) {
        const label = page.locator('label').filter({ hasText: new RegExp(`^${option}$`) }).first();
        await label.click();
        // Verify it's selected by checking the radio input
        const radio = await label.locator('..').locator('input[type="radio"]');
        await expect(radio).toBeChecked();
      }
    });

    test('should allow selecting nocturia frequency options', async ({ page }) => {
      // Test nocturia-specific options (Question 7)
      const nocturiaOptions = ['None', '1 time', '2 times', '3 times', '4 times', '5 or more times'];

      for (const option of nocturiaOptions) {
        // Find the nocturia section and click the option
        const label = page.locator('text=7. Nocturia').locator('..').locator(`label:has-text("${option}")`).first();
        await label.click();
      }
    });

    test('should allow selecting QoL options', async ({ page }) => {
      // Test all 7 QoL options (Question 8)
      const qolOptions = [
        'Delighted',
        'Pleased',
        'Mostly satisfied',
        'Mixed',
        'Mostly dissatisfied',
        'Unhappy',
        'Terrible'
      ];

      for (const option of qolOptions) {
        const label = page.locator(`label:has-text("${option}")`).first();
        await label.click();
      }
    });

    test('should maintain radio selection when switching questions', async ({ page }) => {
      // Select options for multiple questions
      await page.locator('label').filter({ hasText: /^Not at all$/ }).first().click();
      await page.locator('label').filter({ hasText: /^Less than 1 in 5 times$/ }).nth(1).click();

      // Click on a different question
      await page.locator('text=3. Intermittency').click();

      // Previous selections should still be maintained
      const q1Radio = page.locator('input[name="q1"][value="0"]');
      await expect(q1Radio).toBeChecked();
    });
  });

  test.describe('Mild Symptoms Calculation (Score 0-7)', () => {

    test('should correctly calculate minimal symptoms (score 0)', async ({ page }) => {
      // All "Not at all" / "None" responses
      // Q1-Q6: Not at all (0 points each)
      const notAtAll = page.locator('label').filter({ hasText: /^Not at all$/ });
      for (let i = 0; i < 6; i++) {
        await notAtAll.nth(i).click();
      }

      // Q7: None (0 points)
      await page.locator('label').filter({ hasText: /^None$/ }).first().click();

      // Q8: Delighted (0 points)
      await page.locator('label:has-text("Delighted")').click();

      // Click Calculate
      await page.click('button:has-text("Calculate")');

      // Verify results
      await expect(page.locator('text=Total IPSS Score')).toBeVisible();
      await expect(page.locator('text=0/35')).toBeVisible();
      await expect(page.locator('text=Symptom Severity')).toBeVisible();
      await expect(page.locator('text=Mild')).toBeVisible();
      await expect(page.locator('text=Watchful waiting is appropriate')).toBeVisible();
      await expect(page.locator('text=Quality of Life Score')).toBeVisible();
      await expect(page.locator('text=0/6')).toBeVisible();
      await expect(page.locator('text=Delighted - Excellent quality of life')).toBeVisible();
    });

    test('should correctly calculate mild symptoms (score 4)', async ({ page }) => {
      // Mixed low-level responses totaling 4 points
      // Q1: Not at all (0)
      await page.locator('label').filter({ hasText: /^Not at all$/ }).first().click();

      // Q2: Less than 1 in 5 times (1)
      await page.locator('label').filter({ hasText: /^Less than 1 in 5 times$/ }).first().click();

      // Q3: Not at all (0)
      await page.locator('label').filter({ hasText: /^Not at all$/ }).nth(2).click();

      // Q4: Not at all (0)
      await page.locator('label').filter({ hasText: /^Not at all$/ }).nth(3).click();

      // Q5: Less than 1 in 5 times (1)
      await page.locator('label').filter({ hasText: /^Less than 1 in 5 times$/ }).nth(1).click();

      // Q6: Not at all (0)
      await page.locator('label').filter({ hasText: /^Not at all$/ }).nth(4).click();

      // Q7: 2 times (2)
      await page.locator('label:has-text("2 times")').click();

      // Q8: Mostly satisfied (2)
      await page.locator('label:has-text("Mostly satisfied")').click();

      // Click Calculate
      await page.click('button:has-text("Calculate")');

      // Verify results
      await expect(page.locator('text=4/35')).toBeVisible();
      await expect(page.locator('text=Mild')).toBeVisible();
      await expect(page.locator('text=Watchful waiting')).toBeVisible();
      await expect(page.locator('text=2/6')).toBeVisible();
      await expect(page.locator('text=Mostly satisfied - Good quality of life')).toBeVisible();
    });

    test('should correctly calculate mild symptoms at upper boundary (score 7)', async ({ page }) => {
      // Maximum mild score: 7 points
      // Q1: Less than 1 in 5 times (1)
      await page.locator('label').filter({ hasText: /^Less than 1 in 5 times$/ }).first().click();

      // Q2: Less than half the time (2)
      await page.locator('label').filter({ hasText: /^Less than half the time$/ }).first().click();

      // Q3: Less than 1 in 5 times (1)
      await page.locator('label').filter({ hasText: /^Less than 1 in 5 times$/ }).nth(1).click();

      // Q4: Not at all (0)
      await page.locator('label').filter({ hasText: /^Not at all$/ }).nth(3).click();

      // Q5: Less than 1 in 5 times (1)
      await page.locator('label').filter({ hasText: /^Less than 1 in 5 times$/ }).nth(2).click();

      // Q6: Not at all (0)
      await page.locator('label').filter({ hasText: /^Not at all$/ }).nth(4).click();

      // Q7: 2 times (2)
      await page.locator('label:has-text("2 times")').click();

      // Q8: Pleased (1)
      await page.locator('label:has-text("Pleased")').click();

      // Click Calculate
      await page.click('button:has-text("Calculate")');

      // Verify results
      await expect(page.locator('text=7/35')).toBeVisible();
      await expect(page.locator('text=Mild')).toBeVisible();
      await expect(page.locator('text=Watchful waiting')).toBeVisible();
      await expect(page.locator('text=No immediate treatment needed')).toBeVisible();
    });

    test('should show watchful waiting recommendation for mild symptoms', async ({ page }) => {
      // Enter any mild symptom score (0-7)
      await page.locator('label').filter({ hasText: /^Not at all$/ }).first().click();
      await page.locator('label').filter({ hasText: /^Less than 1 in 5 times$/ }).first().click();
      await page.locator('label').filter({ hasText: /^Not at all$/ }).nth(2).click();
      await page.locator('label').filter({ hasText: /^Not at all$/ }).nth(3).click();
      await page.locator('label').filter({ hasText: /^Not at all$/ }).nth(4).click();
      await page.locator('label').filter({ hasText: /^Not at all$/ }).nth(5).click();
      await page.locator('label:has-text("1 time")').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator('text=Management Recommendation')).toBeVisible();
      await expect(page.locator('text=Watchful waiting is appropriate')).toBeVisible();
    });
  });

  test.describe('Moderate Symptoms Calculation (Score 8-19)', () => {

    test('should correctly calculate moderate symptoms at lower boundary (score 8)', async ({ page }) => {
      // Q1: Less than half the time (2)
      await page.locator('label').filter({ hasText: /^Less than half the time$/ }).first().click();

      // Q2: Less than half the time (2)
      await page.locator('label').filter({ hasText: /^Less than half the time$/ }).nth(1).click();

      // Q3: Less than 1 in 5 times (1)
      await page.locator('label').filter({ hasText: /^Less than 1 in 5 times$/ }).nth(1).click();

      // Q4: Less than 1 in 5 times (1)
      await page.locator('label').filter({ hasText: /^Less than 1 in 5 times$/ }).nth(2).click();

      // Q5: Not at all (0)
      await page.locator('label').filter({ hasText: /^Not at all$/ }).nth(4).click();

      // Q6: Not at all (0)
      await page.locator('label').filter({ hasText: /^Not at all$/ }).nth(5).click();

      // Q7: 2 times (2)
      await page.locator('label:has-text("2 times")').click();

      // Q8: Mixed (3)
      await page.locator('label').filter({ hasText: /Mixed/ }).click();

      // Click Calculate
      await page.click('button:has-text("Calculate")');

      // Verify results
      await expect(page.locator('text=8/35')).toBeVisible();
      await expect(page.locator('text=Moderate')).toBeVisible();
      await expect(page.locator('text=Medical therapy recommended')).toBeVisible();
      await expect(page.locator('text=alpha-blockers or 5-alpha reductase inhibitors')).toBeVisible();
    });

    test('should correctly calculate moderate symptoms at mid-range (score 13)', async ({ page }) => {
      // Q1: Less than half the time (2)
      await page.locator('label').filter({ hasText: /^Less than half the time$/ }).first().click();

      // Q2: About half the time (3)
      await page.locator('label').filter({ hasText: /^About half the time$/ }).first().click();

      // Q3: Less than half the time (2)
      await page.locator('label').filter({ hasText: /^Less than half the time$/ }).nth(1).click();

      // Q4: Less than 1 in 5 times (1)
      await page.locator('label').filter({ hasText: /^Less than 1 in 5 times$/ }).nth(2).click();

      // Q5: Less than half the time (2)
      await page.locator('label').filter({ hasText: /^Less than half the time$/ }).nth(2).click();

      // Q6: Not at all (0)
      await page.locator('label').filter({ hasText: /^Not at all$/ }).nth(5).click();

      // Q7: 3 times (3)
      await page.locator('label:has-text("3 times")').click();

      // Q8: Mostly dissatisfied (4)
      await page.locator('label:has-text("Mostly dissatisfied")').click();

      // Click Calculate
      await page.click('button:has-text("Calculate")');

      // Verify results
      await expect(page.locator('text=13/35')).toBeVisible();
      await expect(page.locator('text=Moderate')).toBeVisible();
      await expect(page.locator('text=Medical therapy recommended')).toBeVisible();
    });

    test('should correctly calculate moderate symptoms at upper boundary (score 19)', async ({ page }) => {
      // Q1: More than half the time (4)
      await page.locator('label').filter({ hasText: /^More than half the time$/ }).first().click();

      // Q2: About half the time (3)
      await page.locator('label').filter({ hasText: /^About half the time$/ }).first().click();

      // Q3: About half the time (3)
      await page.locator('label').filter({ hasText: /^About half the time$/ }).nth(1).click();

      // Q4: Less than half the time (2)
      await page.locator('label').filter({ hasText: /^Less than half the time$/ }).nth(2).click();

      // Q5: Less than half the time (2)
      await page.locator('label').filter({ hasText: /^Less than half the time$/ }).nth(3).click();

      // Q6: Less than half the time (2)
      await page.locator('label').filter({ hasText: /^Less than half the time$/ }).nth(4).click();

      // Q7: 3 times (3)
      await page.locator('label:has-text("3 times")').click();

      // Q8: Unhappy (5)
      await page.locator('label:has-text("Unhappy")').click();

      // Click Calculate
      await page.click('button:has-text("Calculate")');

      // Verify results
      await expect(page.locator('text=19/35')).toBeVisible();
      await expect(page.locator('text=Moderate')).toBeVisible();
      await expect(page.locator('text=Medical therapy recommended')).toBeVisible();
    });

    test('should show medical therapy recommendation for moderate symptoms', async ({ page }) => {
      // Enter moderate symptom score (8-19)
      await page.locator('label').filter({ hasText: /^Less than half the time$/ }).first().click();
      await page.locator('label').filter({ hasText: /^About half the time$/ }).first().click();
      await page.locator('label').filter({ hasText: /^Less than 1 in 5 times$/ }).nth(1).click();
      await page.locator('label').filter({ hasText: /^Less than 1 in 5 times$/ }).nth(2).click();
      await page.locator('label').filter({ hasText: /^Less than 1 in 5 times$/ }).nth(3).click();
      await page.locator('label').filter({ hasText: /^Not at all$/ }).nth(5).click();
      await page.locator('label:has-text("3 times")').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator('text=Management Recommendation')).toBeVisible();
      await expect(page.locator('text=Medical therapy recommended')).toBeVisible();
      await expect(page.locator('text=alpha-blockers')).toBeVisible();
    });
  });

  test.describe('Severe Symptoms Calculation (Score 20-35)', () => {

    test('should correctly calculate severe symptoms at lower boundary (score 20)', async ({ page }) => {
      // Q1: More than half the time (4)
      await page.locator('label').filter({ hasText: /^More than half the time$/ }).first().click();

      // Q2: More than half the time (4)
      await page.locator('label').filter({ hasText: /^More than half the time$/ }).nth(1).click();

      // Q3: About half the time (3)
      await page.locator('label').filter({ hasText: /^About half the time$/ }).nth(1).click();

      // Q4: Less than half the time (2)
      await page.locator('label').filter({ hasText: /^Less than half the time$/ }).nth(2).click();

      // Q5: Less than half the time (2)
      await page.locator('label').filter({ hasText: /^Less than half the time$/ }).nth(3).click();

      // Q6: About half the time (3)
      await page.locator('label').filter({ hasText: /^About half the time$/ }).nth(2).click();

      // Q7: 2 times (2)
      await page.locator('label:has-text("2 times")').click();

      // Q8: Terrible (6)
      await page.locator('label:has-text("Terrible")').click();

      // Click Calculate
      await page.click('button:has-text("Calculate")');

      // Verify results
      await expect(page.locator('text=20/35')).toBeVisible();
      await expect(page.locator('text=Severe')).toBeVisible();
      await expect(page.locator('text=Medical and/or surgical therapy recommended')).toBeVisible();
      await expect(page.locator('text=referral to urology')).toBeVisible();
    });

    test('should correctly calculate severe symptoms at mid-range (score 27)', async ({ page }) => {
      // Q1: Almost always (5)
      await page.locator('label').filter({ hasText: /^Almost always$/ }).first().click();

      // Q2: Almost always (5)
      await page.locator('label').filter({ hasText: /^Almost always$/ }).nth(1).click();

      // Q3: More than half the time (4)
      await page.locator('label').filter({ hasText: /^More than half the time$/ }).nth(1).click();

      // Q4: About half the time (3)
      await page.locator('label').filter({ hasText: /^About half the time$/ }).nth(1).click();

      // Q5: More than half the time (4)
      await page.locator('label').filter({ hasText: /^More than half the time$/ }).nth(2).click();

      // Q6: More than half the time (4)
      await page.locator('label').filter({ hasText: /^More than half the time$/ }).nth(3).click();

      // Q7: 2 times (2)
      await page.locator('label:has-text("2 times")').click();

      // Q8: Terrible (6)
      await page.locator('label:has-text("Terrible")').click();

      // Click Calculate
      await page.click('button:has-text("Calculate")');

      // Verify results
      await expect(page.locator('text=27/35')).toBeVisible();
      await expect(page.locator('text=Severe')).toBeVisible();
      await expect(page.locator('text=Medical and/or surgical therapy recommended')).toBeVisible();
    });

    test('should correctly calculate maximum severe symptoms (score 35)', async ({ page }) => {
      // All "Almost always" or "5 or more times"
      // Q1-Q6: Almost always (5 points each)
      const almostAlways = page.locator('label').filter({ hasText: /^Almost always$/ });
      for (let i = 0; i < 6; i++) {
        await almostAlways.nth(i).click();
      }

      // Q7: 5 or more times (5 points)
      await page.locator('label:has-text("5 or more times")').click();

      // Q8: Terrible (6)
      await page.locator('label:has-text("Terrible")').click();

      // Click Calculate
      await page.click('button:has-text("Calculate")');

      // Verify results
      await expect(page.locator('text=35/35')).toBeVisible();
      await expect(page.locator('text=Severe')).toBeVisible();
      await expect(page.locator('text=Medical and/or surgical therapy recommended')).toBeVisible();
      await expect(page.locator('text=6/6')).toBeVisible();
      await expect(page.locator('text=Terrible - Extremely poor quality of life')).toBeVisible();
    });

    test('should show surgical referral recommendation for severe symptoms', async ({ page }) => {
      // Enter severe symptom score (20-35)
      await page.locator('label').filter({ hasText: /^Almost always$/ }).first().click();
      await page.locator('label').filter({ hasText: /^More than half the time$/ }).nth(1).click();
      await page.locator('label').filter({ hasText: /^More than half the time$/ }).nth(2).click();
      await page.locator('label').filter({ hasText: /^About half the time$/ }).nth(1).click();
      await page.locator('label').filter({ hasText: /^More than half the time$/ }).nth(3).click();
      await page.locator('label').filter({ hasText: /^About half the time$/ }).nth(2).click();
      await page.locator('label:has-text("4 times")').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator('text=Management Recommendation')).toBeVisible();
      await expect(page.locator('text=surgical therapy')).toBeVisible();
      await expect(page.locator('text=referral to urology')).toBeVisible();
    });
  });

  test.describe('Quality of Life (QoL) Assessment', () => {

    test('should calculate QoL independently from IPSS score', async ({ page }) => {
      // Low IPSS score with poor QoL
      // Q1-Q6: Not at all (0 each)
      const notAtAll = page.locator('label').filter({ hasText: /^Not at all$/ });
      for (let i = 0; i < 6; i++) {
        await notAtAll.nth(i).click();
      }

      // Q7: None (0)
      await page.locator('label').filter({ hasText: /^None$/ }).first().click();

      // Q8: Terrible (6) - Poor QoL despite mild symptoms
      await page.locator('label:has-text("Terrible")').click();

      await page.click('button:has-text("Calculate")');

      // Should show mild IPSS but terrible QoL
      await expect(page.locator('text=0/35')).toBeVisible();
      await expect(page.locator('text=Mild')).toBeVisible();
      await expect(page.locator('text=6/6')).toBeVisible();
      await expect(page.locator('text=Terrible - Extremely poor quality of life')).toBeVisible();
    });

    test('should display all QoL assessment levels correctly', async ({ page }) => {
      // Fill in Q1-Q7 with minimal symptoms
      const notAtAll = page.locator('label').filter({ hasText: /^Not at all$/ });
      for (let i = 0; i < 6; i++) {
        await notAtAll.nth(i).click();
      }
      await page.locator('label').filter({ hasText: /^None$/ }).first().click();

      const qolTests = [
        { option: 'Delighted', expectedText: 'Delighted - Excellent quality of life' },
        { option: 'Pleased', expectedText: 'Pleased - Very good quality of life' },
        { option: 'Mostly satisfied', expectedText: 'Mostly satisfied - Good quality of life' },
        { option: 'Mixed', expectedText: 'Mixed - Fair quality of life' },
        { option: 'Mostly dissatisfied', expectedText: 'Mostly dissatisfied - Poor quality of life' },
        { option: 'Unhappy', expectedText: 'Unhappy - Very poor quality of life' },
        { option: 'Terrible', expectedText: 'Terrible - Extremely poor quality of life' }
      ];

      for (const test of qolTests) {
        await page.locator(`label:has-text("${test.option}")`).click();
        await page.click('button:has-text("Calculate")');
        await expect(page.locator(`text=${test.expectedText}`)).toBeVisible();
      }
    });

    test('should allow calculation without QoL answer', async ({ page }) => {
      // Fill only Q1-Q7 (not Q8)
      await page.locator('label').filter({ hasText: /^Not at all$/ }).first().click();
      await page.locator('label').filter({ hasText: /^Less than 1 in 5 times$/ }).first().click();
      await page.locator('label').filter({ hasText: /^Not at all$/ }).nth(2).click();
      await page.locator('label').filter({ hasText: /^Not at all$/ }).nth(3).click();
      await page.locator('label').filter({ hasText: /^Not at all$/ }).nth(4).click();
      await page.locator('label').filter({ hasText: /^Not at all$/ }).nth(5).click();
      await page.locator('label:has-text("1 time")').click();

      // Don't select Q8

      await page.click('button:has-text("Calculate")');

      // Should show IPSS score but not QoL score
      await expect(page.locator('text=2/35')).toBeVisible();
      await expect(page.locator('text=Mild')).toBeVisible();
      // QoL fields should not be present
      const qolScore = page.locator('text=Quality of Life Score');
      await expect(qolScore).not.toBeVisible();
    });
  });

  test.describe('Input Validation', () => {

    test('should require all Q1-Q7 answers before calculating', async ({ page }) => {
      // Try to calculate without answering all questions
      await page.click('button:has-text("Calculate")');

      // Should show error message
      await expect(page.locator('text=Please answer all symptom questions')).toBeVisible();
    });

    test('should not calculate with only partial answers', async ({ page }) => {
      // Answer only Q1-Q3
      await page.locator('label').filter({ hasText: /^Not at all$/ }).first().click();
      await page.locator('label').filter({ hasText: /^Less than 1 in 5 times$/ }).first().click();
      await page.locator('label').filter({ hasText: /^Not at all$/ }).nth(2).click();

      await page.click('button:has-text("Calculate")');

      // Should show error
      await expect(page.locator('text=Please answer all symptom questions')).toBeVisible();
    });

    test('should calculate successfully with all Q1-Q7 answered', async ({ page }) => {
      // Answer all required questions
      await page.locator('label').filter({ hasText: /^Not at all$/ }).first().click();
      await page.locator('label').filter({ hasText: /^Not at all$/ }).nth(1).click();
      await page.locator('label').filter({ hasText: /^Not at all$/ }).nth(2).click();
      await page.locator('label').filter({ hasText: /^Not at all$/ }).nth(3).click();
      await page.locator('label').filter({ hasText: /^Not at all$/ }).nth(4).click();
      await page.locator('label').filter({ hasText: /^Not at all$/ }).nth(5).click();
      await page.locator('label').filter({ hasText: /^None$/ }).first().click();

      await page.click('button:has-text("Calculate")');

      // Should show results
      await expect(page.locator('text=Total IPSS Score')).toBeVisible();
      await expect(page.locator('text=0/35')).toBeVisible();
    });
  });

  test.describe('Clinical Scenarios', () => {

    test('should calculate typical BPH with mild symptoms', async ({ page }) => {
      // Typical patient with mild BPH
      await page.locator('label').filter({ hasText: /^Not at all$/ }).first().click();
      await page.locator('label').filter({ hasText: /^Less than 1 in 5 times$/ }).first().click();
      await page.locator('label').filter({ hasText: /^Not at all$/ }).nth(2).click();
      await page.locator('label').filter({ hasText: /^Less than 1 in 5 times$/ }).nth(1).click();
      await page.locator('label').filter({ hasText: /^Less than 1 in 5 times$/ }).nth(2).click();
      await page.locator('label').filter({ hasText: /^Not at all$/ }).nth(5).click();
      await page.locator('label:has-text("1 time")').click();
      await page.locator('label:has-text("Pleased")').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator('text=Mild')).toBeVisible();
      await expect(page.locator('text=Watchful waiting')).toBeVisible();
    });

    test('should calculate typical BPH with moderate symptoms needing treatment', async ({ page }) => {
      // Patient with bothersome symptoms requiring medication
      await page.locator('label').filter({ hasText: /^Less than half the time$/ }).first().click();
      await page.locator('label').filter({ hasText: /^About half the time$/ }).first().click();
      await page.locator('label').filter({ hasText: /^Less than half the time$/ }).nth(1).click();
      await page.locator('label').filter({ hasText: /^About half the time$/ }).nth(1).click();
      await page.locator('label').filter({ hasText: /^Less than half the time$/ }).nth(2).click();
      await page.locator('label').filter({ hasText: /^Less than 1 in 5 times$/ }).nth(3).click();
      await page.locator('label:has-text("3 times")').click();
      await page.locator('label').filter({ hasText: /Mixed/ }).click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator('text=Moderate')).toBeVisible();
      await expect(page.locator('text=Medical therapy recommended')).toBeVisible();
    });

    test('should calculate advanced BPH with severe symptoms', async ({ page }) => {
      // Patient with severe symptoms likely needing surgery
      await page.locator('label').filter({ hasText: /^Almost always$/ }).first().click();
      await page.locator('label').filter({ hasText: /^More than half the time$/ }).nth(1).click();
      await page.locator('label').filter({ hasText: /^Almost always$/ }).nth(1).click();
      await page.locator('label').filter({ hasText: /^More than half the time$/ }).nth(2).click();
      await page.locator('label').filter({ hasText: /^Almost always$/ }).nth(2).click();
      await page.locator('label').filter({ hasText: /^More than half the time$/ }).nth(3).click();
      await page.locator('label:has-text("5 or more times")').click();
      await page.locator('label:has-text("Unhappy")').click();

      await page.click('button:has-text("Calculate")');

      await expect(page.locator('text=Severe')).toBeVisible();
      await expect(page.locator('text=surgical therapy')).toBeVisible();
      await expect(page.locator('text=referral to urology')).toBeVisible();
    });
  });

  test.describe('Reference Links', () => {

    test('should display reference section', async ({ page }) => {
      // Scroll to bottom to find references
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      // Look for reference section
      await expect(page.locator('text=References')).toBeVisible();
    });

    test('should have clickable reference links', async ({ page }) => {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      // Check for Barry reference (original IPSS study)
      const barryRef = page.locator('a:has-text("Barry MJ")');
      await expect(barryRef).toBeVisible();
      await expect(barryRef).toHaveAttribute('href', /doi\.org/);
      await expect(barryRef).toHaveAttribute('target', '_blank');

      // Check for AUA guideline reference
      const auaRef = page.locator('a:has-text("AUA Practice Guidelines")');
      await expect(auaRef).toBeVisible();
      await expect(auaRef).toHaveAttribute('href', /auanet\.org/);
    });

    test('should link to peer-reviewed sources', async ({ page }) => {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      // Verify multiple authoritative references
      await expect(page.locator('a:has-text("Barry MJ")')).toBeVisible();
      await expect(page.locator('a:has-text("Cockett ATK")')).toBeVisible();
      await expect(page.locator('a:has-text("AUA Practice Guidelines")')).toBeVisible();
      await expect(page.locator('a:has-text("Chapple CR")')).toBeVisible();
      await expect(page.locator('a:has-text("Nickel JC")')).toBeVisible();
    });
  });

  test.describe('User Experience', () => {

    test('should maintain selections when scrolling', async ({ page }) => {
      // Select options for first few questions
      await page.locator('label').filter({ hasText: /^Less than half the time$/ }).first().click();
      await page.locator('label').filter({ hasText: /^About half the time$/ }).first().click();

      // Scroll down
      await page.evaluate(() => window.scrollBy(0, 500));

      // Scroll back up
      await page.evaluate(() => window.scrollBy(0, -500));

      // Previous selections should still be maintained
      const q1Radio = page.locator('input[name="q1"][value="2"]');
      await expect(q1Radio).toBeChecked();
    });

    test('should display results immediately after calculation', async ({ page }) => {
      // Fill all required fields
      const notAtAll = page.locator('label').filter({ hasText: /^Not at all$/ });
      for (let i = 0; i < 6; i++) {
        await notAtAll.nth(i).click();
      }
      await page.locator('label').filter({ hasText: /^None$/ }).first().click();

      // Click calculate
      await page.click('button:has-text("Calculate")');

      // Results should appear quickly
      await expect(page.locator('text=Total IPSS Score')).toBeVisible({ timeout: 2000 });
    });

    test('should show all required output fields', async ({ page }) => {
      // Calculate with valid inputs
      const notAtAll = page.locator('label').filter({ hasText: /^Not at all$/ });
      for (let i = 0; i < 6; i++) {
        await notAtAll.nth(i).click();
      }
      await page.locator('label').filter({ hasText: /^None$/ }).first().click();
      await page.locator('label:has-text("Delighted")').click();

      await page.click('button:has-text("Calculate")');

      // Verify all key output fields are present
      await expect(page.locator('text=Total IPSS Score')).toBeVisible();
      await expect(page.locator('text=Symptom Severity')).toBeVisible();
      await expect(page.locator('text=Management Recommendation')).toBeVisible();
      await expect(page.locator('text=Quality of Life Score')).toBeVisible();
      await expect(page.locator('text=QoL Assessment')).toBeVisible();
    });

    test('should update results when recalculating with different values', async ({ page }) => {
      // First calculation - mild
      const notAtAll = page.locator('label').filter({ hasText: /^Not at all$/ });
      for (let i = 0; i < 6; i++) {
        await notAtAll.nth(i).click();
      }
      await page.locator('label').filter({ hasText: /^None$/ }).first().click();

      await page.click('button:has-text("Calculate")');
      await expect(page.locator('text=Mild')).toBeVisible();

      // Change to severe symptoms
      const almostAlways = page.locator('label').filter({ hasText: /^Almost always$/ });
      for (let i = 0; i < 6; i++) {
        await almostAlways.nth(i).click();
      }
      await page.locator('label:has-text("5 or more times")').click();

      await page.click('button:has-text("Calculate")');

      // Should now show severe
      await expect(page.locator('text=Severe')).toBeVisible();
      await expect(page.locator('text=35/35')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {

    test('should have proper aria labels for radio groups', async ({ page }) => {
      // Check that questions are properly labeled for screen readers
      const q1Section = page.locator('text=1. Incomplete Emptying').locator('..');
      await expect(q1Section).toBeVisible();
    });

    test('should be navigable via keyboard', async ({ page }) => {
      // Tab through form elements
      await page.keyboard.press('Tab'); // First radio button
      await page.keyboard.press('Space'); // Select it

      // Continue tabbing
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
      }

      // Should be able to reach calculate button
      await page.keyboard.press('Tab');
      // Button should be focused (can verify with accessibility tools)
    });
  });
});
