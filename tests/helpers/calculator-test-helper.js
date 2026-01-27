import { expect } from "@playwright/test";

/**
 * Calculator Test Helper Utilities for Radulator
 * Provides common testing functions for all 18 medical calculators
 */

/**
 * Open mobile menu if needed (sidebar is collapsed on mobile)
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
async function openMobileMenuIfNeeded(page) {
  const menuButton = page.getByRole("button", {
    name: "Open navigation menu",
  });
  // Check if we're on mobile (menu button is visible)
  if (await menuButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await menuButton.click();
    // Wait for sidebar to be visible after opening
    await page.locator("aside").waitFor({ state: "visible" });
  }
}

/**
 * Navigate to a specific calculator
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} calculatorName - Name of the calculator to navigate to
 */
export async function navigateToCalculator(page, calculatorName) {
  await page.goto("/");

  // Wait for app to load - use getByRole with first() for reliable matching
  // This approach aligns with smoke tests and handles visibility correctly
  await page
    .getByRole("heading", { name: "Radulator", level: 1 })
    .first()
    .waitFor({ state: "visible", timeout: 10000 });

  // Open mobile menu if needed (sidebar is collapsed on mobile)
  await openMobileMenuIfNeeded(page);

  // Click on the calculator in the sidebar
  const calculatorButton = page
    .locator(`button:has-text("${calculatorName}")`)
    .first();
  await expect(calculatorButton).toBeVisible({ timeout: 5000 });
  await calculatorButton.click();

  // Wait for calculator to load
  await page.waitForLoadState("networkidle");
}

/**
 * Fill in a text/number input field
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} label - Label text of the field
 * @param {string|number} value - Value to fill
 */
export async function fillInput(page, label, value) {
  // Use getByRole with name matching - works with spinbutton and textbox
  // Create a regex pattern from the label to handle special characters
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const labelRegex = new RegExp(escapedLabel, "i");

  // Try spinbutton (number input) first, then textbox
  let input = page.getByRole("spinbutton", { name: labelRegex });
  if (!(await input.count())) {
    input = page.getByRole("textbox", { name: labelRegex });
  }

  // Fall back to label-based selector if role-based doesn't work
  if (!(await input.count())) {
    input = page
      .locator(
        `label:has-text("${label}") + input, label:has-text("${label}") ~ input`,
      )
      .first();
  }

  await input.clear();
  await input.fill(String(value));
  await input.blur(); // Trigger onChange
}

/**
 * Select an option from a dropdown
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} label - Label text of the select field
 * @param {string} value - Value to select
 */
export async function selectOption(page, label, value) {
  const select = page
    .locator(
      `label:has-text("${label}") + select, label:has-text("${label}") ~ select`,
    )
    .first();
  await select.selectOption(value);
}

/**
 * Select a radio button option
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} label - Label text of the radio group
 * @param {string} value - Value to select
 */
export async function selectRadio(page, label, value) {
  const radioLabel = page.locator(`text="${value}"`).first();
  await radioLabel.click();
}

/**
 * Toggle a checkbox/switch
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} label - Label text of the checkbox
 * @param {boolean} checked - Whether to check or uncheck
 */
export async function toggleCheckbox(page, label, checked) {
  const checkbox = page.locator(`label:has-text("${label}")`).first();
  const currentState = await checkbox
    .locator('button[role="switch"]')
    .getAttribute("aria-checked");
  const isChecked = currentState === "true";

  if ((checked && !isChecked) || (!checked && isChecked)) {
    await checkbox.click();
  }
}

/**
 * Get the result value from the calculator
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} resultLabel - Label of the result to get (optional)
 * @returns {Promise<string>} - Result text
 */
export async function getResult(page, resultLabel = null) {
  if (resultLabel) {
    const resultRow = page
      .locator(`.grid > div:has-text("${resultLabel}")`)
      .first();
    const resultValue = resultRow.locator("div").nth(1);
    return await resultValue.textContent();
  } else {
    // Get all results
    const resultsSection = page.locator(".bg-muted\\/50").last();
    return await resultsSection.textContent();
  }
}

/**
 * Verify a specific result value
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} label - Label of the result
 * @param {string|number} expectedValue - Expected value
 * @param {object} options - Options for assertion (contains, exact, etc.)
 */
export async function verifyResult(
  page,
  label,
  expectedValue,
  options = { exact: false },
) {
  const resultText = await getResult(page, label);

  if (options.exact) {
    expect(resultText.trim()).toBe(String(expectedValue));
  } else {
    expect(resultText).toContain(String(expectedValue));
  }
}

/**
 * Take a screenshot of the calculator
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} calculatorName - Name of the calculator
 * @param {string} testName - Name of the test scenario
 */
export async function takeScreenshot(page, calculatorName, testName) {
  await page.screenshot({
    path: `test-results/screenshots/${calculatorName}-${testName}.png`,
    fullPage: true,
  });
}

/**
 * Verify all reference links are valid
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<Array>} - Array of broken links (if any)
 */
export async function verifyReferenceLinks(page) {
  const links = await page.locator('a[href^="http"]').all();
  const brokenLinks = [];

  for (const link of links) {
    const href = await link.getAttribute("href");
    try {
      const response = await page.request.get(href);
      if (response.status() >= 400) {
        brokenLinks.push({ href, status: response.status() });
      }
    } catch (error) {
      brokenLinks.push({ href, error: error.message });
    }
  }

  return brokenLinks;
}

/**
 * Verify calculator styling matches theme
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
export async function verifyThemeConsistency(page) {
  // Check that the main content area is present
  const mainContent = page.locator("main").first();
  await expect(mainContent).toBeVisible();

  // Verify a heading (h2 for calculator title) is present
  const calcTitle = page.locator("h2").first();
  await expect(calcTitle).toBeVisible();

  // Verify the Calculate button is styled
  const calcButton = page.locator('button:has-text("Calculate")').first();
  await expect(calcButton).toBeVisible();
}

/**
 * Verify responsive design on mobile
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
export async function verifyMobileResponsive(page) {
  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });

  // On mobile, the menu button should be visible (sidebar is collapsed)
  const menuButton = page.getByRole("button", {
    name: "Open navigation menu",
  });

  // Wait a bit for responsive styles to apply
  await page.waitForTimeout(300);

  // Verify mobile layout - either menu button is visible OR sidebar is narrow
  const isMenuVisible = await menuButton.isVisible().catch(() => false);
  const sidebar = page.locator("aside").first();
  const isSidebarVisible = await sidebar.isVisible().catch(() => false);

  // Mobile layout is correct if menu button is shown or sidebar is hidden/narrow
  if (isSidebarVisible) {
    const sidebarWidth = await sidebar.evaluate((el) => el.offsetWidth);
    // Sidebar should be narrow (collapsed) on mobile or menu button should be visible
    expect(sidebarWidth < 100 || isMenuVisible).toBeTruthy();
  }

  // Reset to desktop
  await page.setViewportSize({ width: 1280, height: 720 });
}

/**
 * Clear all calculator inputs
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
export async function clearAllInputs(page) {
  const inputs = await page
    .locator('input[type="text"], input[type="number"]')
    .all();

  for (const input of inputs) {
    await input.clear();
  }
}

/**
 * Fill calculator from test case data
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {object} testCase - Test case with field values
 */
export async function fillCalculatorFromTestCase(page, testCase) {
  for (const [fieldName, value] of Object.entries(testCase.inputs)) {
    if (typeof value === "number" || typeof value === "string") {
      await fillInput(page, fieldName, value);
    } else if (typeof value === "object" && value.type) {
      if (value.type === "select") {
        await selectOption(page, fieldName, value.value);
      } else if (value.type === "radio") {
        await selectRadio(page, fieldName, value.value);
      } else if (value.type === "checkbox") {
        await toggleCheckbox(page, fieldName, value.value);
      }
    }
  }

  // Wait for calculation
  await page.waitForTimeout(500);
}

/**
 * Verify calculation accuracy
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {object} expectedResults - Expected results object
 * @param {number} tolerance - Tolerance for numerical comparison (default 0.01)
 */
export async function verifyCalculationAccuracy(
  page,
  expectedResults,
  tolerance = 0.01,
) {
  for (const [label, expectedValue] of Object.entries(expectedResults)) {
    const actualText = await getResult(page, label);

    // Extract numerical value from text
    const actualValue = parseFloat(actualText.match(/-?\d+\.?\d*/)?.[0]);
    const expected = parseFloat(expectedValue);

    if (!isNaN(actualValue) && !isNaN(expected)) {
      const diff = Math.abs(actualValue - expected);
      expect(diff).toBeLessThanOrEqual(tolerance);
    } else {
      // Non-numerical comparison
      expect(actualText).toContain(String(expectedValue));
    }
  }
}

/**
 * Test edge cases and boundary values
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} fieldLabel - Field to test
 * @param {Array} edgeCases - Array of edge case values
 */
export async function testEdgeCases(page, fieldLabel, edgeCases) {
  for (const edgeCase of edgeCases) {
    await fillInput(page, fieldLabel, edgeCase.value);
    await page.waitForTimeout(300);

    if (edgeCase.shouldError) {
      // Verify error message appears
      const errorMessage = page
        .locator("text=/error|invalid|required/i")
        .first();
      await expect(errorMessage).toBeVisible({ timeout: 2000 });
    } else {
      // Verify no error
      const noError = page.locator("text=/error|invalid/i").first();
      await expect(noError).not.toBeVisible({ timeout: 2000 });
    }
  }
}
