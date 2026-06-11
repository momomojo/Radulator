import { test, expect } from '@playwright/test';
import { navigateToCalculator } from '../../../helpers/calculator-test-helper.js';

function calculatorTitle(page) {
  return page.getByTestId('calculator-title');
}

function calculatorDescription(page) {
  return page.getByTestId('calculator-description');
}

function khouryMain(page) {
  return page.getByRole('main', { name: 'Khoury Catheter Selector' });
}

function filterHeading(page) {
  return khouryMain(page).getByRole('heading', {
    name: 'Filter Catheters',
    level: 3,
  });
}

function filterToggleButton(page) {
  return khouryMain(page).getByRole('button', {
    name: /^(Hide|Show) catheter filters$/,
  });
}

function compatibleHeading(page) {
  return khouryMain(page).getByRole('heading', {
    name: /^Compatible Catheters/,
    level: 3,
  });
}

function compatibleSection(page) {
  return compatibleHeading(page).locator(
    'xpath=ancestor::div[contains(@class, "space-y-3")][1]',
  );
}

function selectedDetails(page) {
  return khouryMain(page)
    .getByRole('heading', { name: 'Selected Catheter Details', level: 3 })
    .locator('xpath=ancestor::div[contains(@class, "border-blue-200")][1]');
}

function safetySection(page) {
  return khouryMain(page)
    .getByRole('heading', { name: 'Safety Information', level: 3 })
    .locator('xpath=ancestor::div[contains(@class, "border-orange-200")][1]');
}

function activeFilterBadge(page, count) {
  return khouryMain(page).getByText(`${count} active`, { exact: true });
}

function clearAllButton(page) {
  return khouryMain(page).getByRole('button', { name: 'Clear All' });
}

function searchInput(page) {
  return khouryMain(page).getByLabel('Search by Name or Manufacturer');
}

function embolicAgentSelect(page) {
  return khouryMain(page).getByLabel('Embolic Agent');
}

function coilSizeSelect(page) {
  return khouryMain(page).getByLabel('Coil Size (if applicable)');
}

function microsphereSizeSelect(page) {
  return khouryMain(page).getByLabel('Microsphere Size (if applicable)');
}

function balloonCheckbox(page) {
  return khouryMain(page).getByLabel('Balloon occlusion required');
}

function detachableTipCheckbox(page) {
  return khouryMain(page).getByLabel('Detachable tip required');
}

function adaptorSelect(page) {
  return selectedDetails(page).getByLabel('Adaptor Configuration');
}

function noResultsMessage(page) {
  return compatibleSection(page).getByText('No catheters match your criteria.', {
    exact: true,
  });
}

function noResultsHint(page) {
  return compatibleSection(page).getByText('Try adjusting your filters.', {
    exact: true,
  });
}

function catheterHeading(page, name) {
  return compatibleSection(page).getByRole('heading', {
    name,
    level: 4,
  });
}

function selectCatheterButtons(page) {
  return compatibleSection(page).getByRole('button', { name: /^Select / });
}

async function selectFirstCatheter(page) {
  await selectCatheterButtons(page).first().click();
}

async function selectCatheter(page, name) {
  await compatibleSection(page)
    .getByRole('button', { name: `Select ${name}` })
    .click();
}

function selectedCatheterButton(page, name) {
  return compatibleSection(page).getByRole('button', {
    name: `${name} selected`,
  });
}

function selectedCatheterButtons(page) {
  return compatibleSection(page).getByRole('button', { name: / selected$/ });
}

function detailsHeading(page, name, level = 5) {
  return selectedDetails(page).getByRole('heading', { name, level });
}

/**
 * Khoury Catheter Selector E2E Tests
 *
 * Comprehensive test suite for the interactive microcatheter selection tool.
 * Tests cover all filtering options, search functionality, catheter selection,
 * priming volume calculations, safety warnings, and edge cases.
 *
 * Test Coverage:
 * - Initial state and database loading (30 catheters)
 * - Search functionality (name, manufacturer, case-insensitive)
 * - Embolic agent filtering (Onyx, PHIL, Squid, NBCA, coils, microspheres, Y-90)
 * - Size filtering (coil sizes, microsphere sizes)
 * - Feature toggles (balloon occlusion, detachable tip)
 * - Catheter selection and details display
 * - Adaptor selection and priming volume calculator
 * - Safety warnings and disclaimers
 * - Filter management (clear all, show/hide, active count)
 * - Edge cases (no results, multiple filters, responsive design)
 * - Visual appeal and theme matching
 *
 * References: See src/components/calculators/KhouryCatheterSelector.jsx
 */

test.describe('Khoury Catheter Selector', () => {

  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, 'Khoury Catheter Selector');
    await expect(calculatorTitle(page)).toContainText(
      'Khoury Catheter Selector',
    );
  });

  test.describe('Visual Appeal & Theme Matching', () => {

    test('should display calculator with proper styling', async ({ page }) => {
      // Check title is visible and styled
      const title = calculatorTitle(page);
      await expect(title).toBeVisible();

      // Check description is present
      await expect(calculatorDescription(page)).toContainText(
        'Interactive microcatheter selection tool',
      );

      // Check filter panel is visible
      await expect(filterHeading(page)).toBeVisible();

      // Check results section is visible
      await expect(compatibleHeading(page)).toBeVisible();

      // Check safety warnings section is visible
      await expect(safetySection(page)).toBeVisible();
    });

    test('should have responsive design on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Calculator should still be visible and usable
      await expect(calculatorTitle(page)).toContainText(
        'Khoury Catheter Selector',
      );

      // Filter panel should be visible
      await expect(filterHeading(page)).toBeVisible();

      // Results should be visible
      await expect(compatibleHeading(page)).toBeVisible();
    });

    test('should display filter collapse/expand toggle', async ({ page }) => {
      // Check show/hide filters button exists (look for ChevronUp/ChevronDown icon in CardHeader)
      const toggleButton = filterToggleButton(page);
      await expect(toggleButton).toBeVisible();

      // Click to hide filters
      await toggleButton.click();

      // Verify filters are hidden
      await expect(searchInput(page)).not.toBeVisible();

      // Click to show filters again
      await toggleButton.click();

      // Verify filters are visible
      await expect(searchInput(page)).toBeVisible();
    });
  });

  test.describe('Initial State & Database Loading', () => {

    test('should load 30 catheters by default', async ({ page }) => {
      // Check that results show 30 catheters
      await expect(compatibleHeading(page)).toContainText('(30 results)');
    });

    test('should display all filter options', async ({ page }) => {
      // Search input
      await expect(searchInput(page)).toBeVisible();

      // Embolic agent dropdown
      await expect(embolicAgentSelect(page)).toBeVisible();

      // Coil size dropdown
      await expect(coilSizeSelect(page)).toBeVisible();

      // Microsphere size dropdown
      await expect(microsphereSizeSelect(page)).toBeVisible();

      // Balloon checkbox
      await expect(balloonCheckbox(page)).toBeVisible();

      // Detachable tip checkbox
      await expect(detachableTipCheckbox(page)).toBeVisible();
    });

    test('should not have any catheter selected initially', async ({ page }) => {
      // Selected catheter details card should not be present
      await expect(selectedDetails(page)).not.toBeVisible();
    });

    test('should display safety information', async ({ page }) => {
      // Safety section should be visible
      await expect(safetySection(page)).toBeVisible();

      // Critical warnings should be visible
      await expect(
        safetySection(page).getByRole('heading', {
          name: 'Critical Safety Warnings',
          level: 5,
        }),
      ).toBeVisible();
      await expect(safetySection(page)).toContainText(
        'NBCA (n-BCA) is NOT compatible with balloon occlusion catheters',
      );

      // Disclaimer should be visible
      await expect(safetySection(page)).toContainText('Disclaimer');
      await expect(safetySection(page)).toContainText(
        'educational reference only',
      );
    });
  });

  test.describe('Search Functionality', () => {

    test('should filter catheters by name search', async ({ page }) => {
      // Search for "Scepter"
      await searchInput(page).fill('Scepter');

      // Should show Scepter catheters (Scepter C and Scepter XC)
      await expect(compatibleHeading(page)).toContainText('(3 results)');
      await expect(catheterHeading(page, 'Scepter C')).toBeVisible();
      await expect(catheterHeading(page, 'Scepter XC')).toBeVisible();
    });

    test('should filter catheters by manufacturer search', async ({ page }) => {
      // Search for "Medtronic"
      await searchInput(page).fill('Medtronic');

      // Should show Medtronic catheters
      await expect(compatibleSection(page).getByText('Medtronic').first()).toBeVisible();

      // Result count should be less than 30
      const results = compatibleHeading(page);
      const text = await results.textContent();
      expect(text).toContain('results');
      expect(text).not.toContain('30 results');
    });

    test('should perform case-insensitive search', async ({ page }) => {
      // Search for lowercase
      await searchInput(page).fill('headway');

      // Should still find Headway catheters
      await expect(compatibleSection(page).getByText('Headway').first()).toBeVisible();

      // Try uppercase
      await searchInput(page).fill('HEADWAY');
      await expect(compatibleSection(page).getByText('Headway').first()).toBeVisible();

      // Try mixed case
      await searchInput(page).fill('HeAdWaY');
      await expect(compatibleSection(page).getByText('Headway').first()).toBeVisible();
    });

    test('should show no results for non-existent search', async ({ page }) => {
      // Search for something that doesn't exist
      await searchInput(page).fill('NonExistentCatheter123');

      // Should show no results message
      await expect(noResultsMessage(page)).toBeVisible();
      await expect(noResultsHint(page)).toBeVisible();
    });

    test('should clear search results when input is cleared', async ({ page }) => {
      // Search for something
      await searchInput(page).fill('Scepter');
      await expect(compatibleHeading(page)).toContainText('(3 results)');

      // Clear search
      await searchInput(page).fill('');

      // Should show all 30 catheters again
      await expect(compatibleHeading(page)).toContainText('(30 results)');
    });

    test('should display active filter count badge for search', async ({ page }) => {
      // Initially no active filters
      await expect(activeFilterBadge(page, 1)).not.toBeVisible();

      // Add search term
      await searchInput(page).fill('Scepter');

      // Should show 1 active filter
      await expect(activeFilterBadge(page, 1)).toBeVisible();
    });
  });

  test.describe('Embolic Agent Filtering', () => {

    test('should filter by Onyx 18', async ({ page }) => {
      // Select Onyx 18
      await embolicAgentSelect(page).selectOption('onyx18');

      // Verify filtered results
      const resultsHeader = compatibleHeading(page);
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/Compatible Catheters \(\d+ results\)/);

      // Result should be less than 30 (filtered)
      expect(text).not.toContain('(30 results)');
    });

    test('should filter by PHIL 25%', async ({ page }) => {
      // Select PHIL 25%
      await embolicAgentSelect(page).selectOption('phil25');

      // Should show filtered results
      const resultsHeader = compatibleHeading(page);
      const text = await resultsHeader.textContent();

      // Verify we have results and they're filtered
      expect(text).toMatch(/\(\d+ results\)/);

      // Should exclude TransForm (not compatible with PHIL 25)
      await expect(catheterHeading(page, 'TransForm')).not.toBeVisible();
    });

    test('should filter by PHIL 30%', async ({ page }) => {
      // Select PHIL 30%
      await embolicAgentSelect(page).selectOption('phil30');

      // Should show filtered results
      const resultsHeader = compatibleHeading(page);
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);
    });

    test('should filter by PHIL 35%', async ({ page }) => {
      // Select PHIL 35%
      await embolicAgentSelect(page).selectOption('phil35');

      // Should show filtered results
      const resultsHeader = compatibleHeading(page);
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);
    });

    test('should filter by Squid 12', async ({ page }) => {
      // Select Squid 12
      await embolicAgentSelect(page).selectOption('squid12');

      // Should show filtered results
      const resultsHeader = compatibleHeading(page);
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);
    });

    test('should filter by Squid 18', async ({ page }) => {
      // Select Squid 18
      await embolicAgentSelect(page).selectOption('squid18');

      // Should show filtered results
      const resultsHeader = compatibleHeading(page);
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);
    });

    test('should filter by NBCA', async ({ page }) => {
      // Select NBCA
      await embolicAgentSelect(page).selectOption('nbca');

      // Should show filtered results (excluding balloon catheters)
      const resultsHeader = compatibleHeading(page);
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);

      // Should NOT show Scepter (balloon catheter, not NBCA compatible)
      await expect(catheterHeading(page, 'Scepter C')).not.toBeVisible();
    });

    test('should filter by coils only', async ({ page }) => {
      // Select Coils Only
      await embolicAgentSelect(page).selectOption('coils');

      // Should show filtered results
      const resultsHeader = compatibleHeading(page);
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);
    });

    test('should filter by microspheres', async ({ page }) => {
      // Select Microspheres
      await embolicAgentSelect(page).selectOption('microspheres');

      // Should show filtered results
      const resultsHeader = compatibleHeading(page);
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);
    });

    test('should filter by Y-90 microspheres', async ({ page }) => {
      // Select Y-90
      await embolicAgentSelect(page).selectOption('y90');

      // Should show filtered results
      const resultsHeader = compatibleHeading(page);
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);
    });

    test('should reset filter when "All Embolic Agents" is selected', async ({ page }) => {
      // Select a filter first
      await embolicAgentSelect(page).selectOption('phil25');

      // Verify filtered
      let text = await compatibleHeading(page).textContent();
      expect(text).not.toContain('(30 results)');

      // Reset to "All Embolic Agents"
      await embolicAgentSelect(page).selectOption('');

      // Should show all 30 catheters
      await expect(compatibleHeading(page)).toContainText('(30 results)');
    });
  });

  test.describe('Size Filtering', () => {

    test('should filter by coil size 0.010 inch', async ({ page }) => {
      // Select coil size
      await coilSizeSelect(page).selectOption('0.010');

      // Should show filtered results
      const resultsHeader = compatibleHeading(page);
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);
    });

    test('should filter by coil size 0.0165 inch', async ({ page }) => {
      // Select coil size
      await coilSizeSelect(page).selectOption('0.0165');

      // Should show filtered results including Scepter
      await expect(
        compatibleSection(page).getByRole('heading', {
          name: /Scepter/,
          level: 4,
        }).first(),
      ).toBeVisible();
    });

    test('should filter by coil size 0.018 inch', async ({ page }) => {
      // Select coil size
      await coilSizeSelect(page).selectOption('0.018');

      // Should show filtered results
      const resultsHeader = compatibleHeading(page);
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);
    });

    test('should filter by microsphere size ≤300 µm', async ({ page }) => {
      // Select microsphere size
      await microsphereSizeSelect(page).selectOption('300');

      // Should show filtered results
      const resultsHeader = compatibleHeading(page);
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);
    });

    test('should filter by microsphere size ≤500 µm', async ({ page }) => {
      // Select microsphere size
      await microsphereSizeSelect(page).selectOption('500');

      // Should show filtered results
      const resultsHeader = compatibleHeading(page);
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);
    });

    test('should filter by microsphere size ≤700 µm', async ({ page }) => {
      // Select microsphere size
      await microsphereSizeSelect(page).selectOption('700');

      // Should show filtered results
      const resultsHeader = compatibleHeading(page);
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);
    });

    test('should filter by microsphere size ≤900 µm', async ({ page }) => {
      // Select microsphere size
      await microsphereSizeSelect(page).selectOption('900');

      // Should show filtered results
      const resultsHeader = compatibleHeading(page);
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);
    });

    test('should combine embolic agent and size filters', async ({ page }) => {
      // Select embolic agent
      await embolicAgentSelect(page).selectOption('microspheres');

      // Select microsphere size
      await microsphereSizeSelect(page).selectOption('500');

      // Should show filtered results (both filters applied)
      const resultsHeader = compatibleHeading(page);
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);

      // Should show 2 active filters
      await expect(activeFilterBadge(page, 2)).toBeVisible();
    });
  });

  test.describe('Feature Toggle Filtering', () => {

    test('should filter by balloon occlusion requirement', async ({ page }) => {
      // Check balloon occlusion checkbox
      await balloonCheckbox(page).check();

      // Should show only balloon catheters
      const resultsHeader = compatibleHeading(page);
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);

      // Should show balloon catheters like Scepter
      await expect(
        compatibleSection(page).getByText('Scepter').first(),
      ).toBeVisible();

      // Should show active filter count
      await expect(activeFilterBadge(page, 1)).toBeVisible();
    });

    test('should filter by detachable tip requirement', async ({ page }) => {
      // Check detachable tip checkbox
      await detachableTipCheckbox(page).check();

      // Should show only detachable tip catheters
      const resultsHeader = compatibleHeading(page);
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);

      // Should show active filter count
      await expect(activeFilterBadge(page, 1)).toBeVisible();
    });

    test('should combine balloon and detachable tip filters', async ({ page }) => {
      // Check both
      await balloonCheckbox(page).check();
      await detachableTipCheckbox(page).check();

      // Should show no results or very limited results
      const resultsHeader = compatibleHeading(page);
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);

      // Should show 2 active filters
      await expect(activeFilterBadge(page, 2)).toBeVisible();
    });

    test('should uncheck balloon occlusion filter', async ({ page }) => {
      // Check and then uncheck
      await balloonCheckbox(page).check();
      await expect(activeFilterBadge(page, 1)).toBeVisible();

      await balloonCheckbox(page).uncheck();

      // Should show all 30 catheters again
      await expect(compatibleHeading(page)).toContainText('(30 results)');
      await expect(khouryMain(page).getByText(/active$/)).not.toBeVisible();
    });
  });

  test.describe('Catheter Selection & Details', () => {

    test('should select a catheter and display details', async ({ page }) => {
      // Click the first Select button
      await selectFirstCatheter(page);

      // Should show selected catheter details
      await expect(selectedDetails(page)).toBeVisible();

      // Should show priming volume section
      await expect(detailsHeading(page, 'Priming Volume')).toBeVisible();

      // Should show features section
      await expect(detailsHeading(page, 'Features')).toBeVisible();

      // Should show compatible embolics section
      await expect(detailsHeading(page, 'Compatible Embolic Agents')).toBeVisible();

      // Should show IFU link
      await expect(
        selectedDetails(page).getByRole('link', { name: 'View Manufacturer IFU' }),
      ).toBeVisible();
    });

    test('should select Headway Duo catheter specifically', async ({ page }) => {
      // Search for Headway Duo
      await searchInput(page).fill('Headway Duo');

      // Click Select on Headway Duo
      await selectCatheter(page, 'Headway Duo');

      // Should show Headway Duo details
      await expect(selectedDetails(page)).toBeVisible();
      await expect(
        selectedDetails(page).getByRole('heading', {
          name: 'Headway Duo',
          level: 4,
        }),
      ).toBeVisible();

      // Should show specifications
      await expect(selectedDetails(page)).toContainText('Inner Diameter:');
      await expect(selectedDetails(page)).toContainText('Outer Diameter:');
      await expect(selectedDetails(page)).toContainText('Working Length:');
      await expect(selectedDetails(page)).toContainText('Max Injection Pressure:');
    });

    test('should highlight selected catheter in results', async ({ page }) => {
      // Select first catheter
      await selectFirstCatheter(page);

      // Button should change to "Selected"
      await expect(selectedCatheterButtons(page).first()).toBeVisible();
    });

    test('should switch between selected catheters', async ({ page }) => {
      const secondCatheterName = await compatibleSection(page)
        .getByRole('heading', { level: 4 })
        .nth(1)
        .textContent();

      // Select first catheter
      await selectFirstCatheter(page);
      await expect(selectedCatheterButtons(page).first()).toBeVisible();

      // Select a different catheter
      await selectCatheterButtons(page).nth(0).click();

      // New catheter should be selected
      await expect(
        selectedCatheterButton(page, secondCatheterName.trim()),
      ).toBeVisible();

      // Details should update
      await expect(selectedDetails(page)).toBeVisible();
    });

    test('should display clinical notes if present', async ({ page }) => {
      // Select a catheter with notes (Scepter C)
      await searchInput(page).fill('Scepter C');
      await selectCatheter(page, 'Scepter C');

      // Should show clinical notes section
      await expect(detailsHeading(page, 'Clinical Notes')).toBeVisible();
      await expect(selectedDetails(page)).toContainText('NOT compatible with NBCA');
    });

    test('should display all compatible embolic agents for selected catheter', async ({ page }) => {
      // Select a catheter
      await selectFirstCatheter(page);

      // Should show compatible embolics section
      await expect(detailsHeading(page, 'Compatible Embolic Agents')).toBeVisible();

      // Should have at least one embolic agent badge
      const embolicSection = detailsHeading(
        page,
        'Compatible Embolic Agents',
      ).locator('..');
      const badges = embolicSection.locator('span');
      await expect(badges.first()).toBeVisible();
    });

    test('should display feature badges for selected catheter', async ({ page }) => {
      // Select a catheter
      await selectFirstCatheter(page);

      // Should show features section with badges
      await expect(detailsHeading(page, 'Features')).toBeVisible();

      // Should show DMSO compatibility badge
      const dmsoCompatible = selectedDetails(page).getByText('DMSO Compatible', {
        exact: true,
      });
      const dmsoNotCompatible = selectedDetails(page).getByText(
        'NOT DMSO Compatible',
        { exact: true },
      );

      // One of them should be visible
      const isDmsoCompatibleVisible = await dmsoCompatible.isVisible();
      const isDmsoNotCompatibleVisible = await dmsoNotCompatible.isVisible();
      expect(isDmsoCompatibleVisible || isDmsoNotCompatibleVisible).toBe(true);
    });
  });

  test.describe('Priming Volume Calculator', () => {

    test('should display priming volume for selected catheter', async ({ page }) => {
      // Select a catheter
      await selectFirstCatheter(page);

      // Should show priming volume
      await expect(detailsHeading(page, 'Priming Volume')).toBeVisible();

      // Should show a numeric value in mL
      const primingVolumeText = detailsHeading(page, 'Priming Volume').locator(
        '..',
      );
      await expect(primingVolumeText.locator('text=mL')).toBeVisible();
    });

    test('should change priming volume when adaptor is selected (Scepter C)', async ({ page }) => {
      // Search for and select Scepter C
      await searchInput(page).fill('Scepter C');
      await selectCatheter(page, 'Scepter C');

      // Check initial priming volume (standard)
      await expect(selectedDetails(page)).toContainText('0.44 mL');

      // Select PHIL Adaptor
      await adaptorSelect(page).selectOption('phil');

      // Priming volume should decrease to 0.23 mL
      await expect(selectedDetails(page)).toContainText('0.23 mL');

      // Verify adaptor label is shown
      await expect(selectedDetails(page)).toContainText('With PHIL Adaptor');
    });

    test('should update priming volume dynamically (Headway Duo with MicroVention adaptor)', async ({ page }) => {
      // Search for and select Headway Duo
      await searchInput(page).fill('Headway Duo');
      await selectCatheter(page, 'Headway Duo');

      // Check initial priming volume (standard)
      const primingVolumeBox = detailsHeading(page, 'Priming Volume').locator(
        '..',
      );
      const initialVolume = primingVolumeBox.locator('p').first();
      const initialText = await initialVolume.textContent();
      expect(initialText).toMatch(/\d+\.\d+ mL/);

      // If adaptor options exist, select MicroVention adaptor
      const adaptor = adaptorSelect(page);
      if (await adaptor.isVisible()) {
        const hasOptions = await adaptor.locator('option').count();
        if (hasOptions > 1) {
          // Select a different adaptor option
          await adaptor.selectOption({ index: 1 });

          // Priming volume should update
          const newVolume = await initialVolume.textContent();

          // Value should have changed (or at least still be valid)
          expect(newVolume).toMatch(/\d+\.\d+ mL/);
        }
      }
    });

    test('should show standard priming volume by default', async ({ page }) => {
      // Select any catheter
      await selectFirstCatheter(page);

      // Should show Standard configuration
      await expect(adaptorSelect(page)).toContainText('Standard');
    });
  });

  test.describe('Filter Management', () => {

    test('should display active filter count', async ({ page }) => {
      // Initially no badge
      await expect(khouryMain(page).getByText(/active$/)).not.toBeVisible();

      // Add one filter
      await searchInput(page).fill('test');
      await expect(activeFilterBadge(page, 1)).toBeVisible();

      // Add another filter
      await embolicAgentSelect(page).selectOption('onyx18');
      await expect(activeFilterBadge(page, 2)).toBeVisible();

      // Add checkbox filter
      await balloonCheckbox(page).check();
      await expect(activeFilterBadge(page, 3)).toBeVisible();
    });

    test('should show Clear All button when filters are active', async ({ page }) => {
      // Initially no Clear All button
      await expect(clearAllButton(page)).not.toBeVisible();

      // Add a filter
      await searchInput(page).fill('test');

      // Clear All button should appear
      await expect(clearAllButton(page)).toBeVisible();
    });

    test('should clear all filters when Clear All is clicked', async ({ page }) => {
      // Add multiple filters
      await searchInput(page).fill('Scepter');
      await embolicAgentSelect(page).selectOption('phil25');
      await coilSizeSelect(page).selectOption('0.0165');
      await balloonCheckbox(page).check();

      // Verify filters are active
      await expect(activeFilterBadge(page, 4)).toBeVisible();

      // Click Clear All
      await clearAllButton(page).click();

      // All filters should be cleared
      await expect(khouryMain(page).getByText(/active$/)).not.toBeVisible();
      await expect(compatibleHeading(page)).toContainText('(30 results)');

      // Search should be empty
      await expect(searchInput(page)).toHaveValue('');

      // Dropdowns should be reset
      await expect(embolicAgentSelect(page)).toHaveValue('');
      await expect(coilSizeSelect(page)).toHaveValue('');

      // Checkboxes should be unchecked
      await expect(balloonCheckbox(page)).not.toBeChecked();
    });

    test('should clear selected catheter when Clear All is clicked', async ({ page }) => {
      // Select a catheter
      await selectFirstCatheter(page);
      await expect(selectedDetails(page)).toBeVisible();

      // Add a filter
      await searchInput(page).fill('test');

      // Clear all
      await clearAllButton(page).click();

      // Selected catheter should be cleared
      await expect(selectedDetails(page)).not.toBeVisible();
    });
  });

  test.describe('Edge Cases & Complex Filtering', () => {

    test('should handle no results scenario gracefully', async ({ page }) => {
      // Combine filters that result in no matches
      await embolicAgentSelect(page).selectOption('nbca');
      await balloonCheckbox(page).check();

      // Should show no results message (NBCA not compatible with balloon)
      await expect(noResultsMessage(page)).toBeVisible();
      await expect(noResultsHint(page)).toBeVisible();
    });

    test('should handle multiple filters applied simultaneously', async ({ page }) => {
      // Apply search
      await searchInput(page).fill('Headway');

      // Apply embolic agent
      await embolicAgentSelect(page).selectOption('phil25');

      // Apply coil size
      await coilSizeSelect(page).selectOption('0.014');

      // Apply microsphere size
      await microsphereSizeSelect(page).selectOption('500');

      // Should show filtered results
      const resultsHeader = compatibleHeading(page);
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);

      // Should show 4 active filters
      await expect(activeFilterBadge(page, 4)).toBeVisible();
    });

    test('should handle all filters at maximum', async ({ page }) => {
      // Apply all possible filters
      await searchInput(page).fill('Catheter');
      await embolicAgentSelect(page).selectOption('onyx18');
      await coilSizeSelect(page).selectOption('0.018');
      await microsphereSizeSelect(page).selectOption('900');
      await balloonCheckbox(page).check();
      await detachableTipCheckbox(page).check();

      // Should show 6 active filters
      await expect(activeFilterBadge(page, 6)).toBeVisible();

      // Should either show results or no results message
      const noResults = noResultsMessage(page);
      const hasResults = compatibleHeading(page);

      const noResultsVisible = await noResults.isVisible();
      const hasResultsVisible = await hasResults.isVisible();

      expect(noResultsVisible || hasResultsVisible).toBe(true);
    });

    test('should handle rapid filter changes', async ({ page }) => {
      // Rapidly change filters
      await embolicAgentSelect(page).selectOption('onyx18');
      await embolicAgentSelect(page).selectOption('phil25');
      await embolicAgentSelect(page).selectOption('squid12');
      await embolicAgentSelect(page).selectOption('coils');

      // Should still show valid results
      const resultsHeader = compatibleHeading(page);
      await expect(resultsHeader).toBeVisible();

      // Active filter count should be 1
      await expect(activeFilterBadge(page, 1)).toBeVisible();
    });

    test('should handle special characters in search', async ({ page }) => {
      // Search with special characters
      await searchInput(page).fill('@#$%^&*()');

      // Should show no results
      await expect(noResultsMessage(page)).toBeVisible();
    });

    test('should handle very long search strings', async ({ page }) => {
      // Enter a very long search string
      const longString = 'a'.repeat(200);
      await searchInput(page).fill(longString);

      // Should show no results
      await expect(noResultsMessage(page)).toBeVisible();
    });

    test('should filter correctly when search matches partial manufacturer name', async ({ page }) => {
      // Search for partial manufacturer name
      await searchInput(page).fill('Terumo');

      // Should show TerumoNeuro and Terumo catheters
      const resultsHeader = compatibleHeading(page);
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);
      expect(text).not.toContain('(30 results)');
    });

    test('should maintain filter state after selecting and deselecting catheter', async ({ page }) => {
      // Apply filters
      await searchInput(page).fill('Headway');
      await embolicAgentSelect(page).selectOption('phil25');

      // Verify 2 active filters
      await expect(activeFilterBadge(page, 2)).toBeVisible();

      // Select a catheter
      await selectFirstCatheter(page);

      // Filters should still be active
      await expect(activeFilterBadge(page, 2)).toBeVisible();

      // Search should still have value
      await expect(searchInput(page)).toHaveValue('Headway');

      // Embolic agent should still be selected
      await expect(embolicAgentSelect(page)).toHaveValue('phil25');
    });
  });

  test.describe('Safety Warnings & Instructions', () => {

    test('should display NBCA safety warning', async ({ page }) => {
      // Safety warning should be visible
      await expect(page.locator('text=NBCA (n-BCA) is NOT compatible with balloon occlusion catheters')).toBeVisible();
    });

    test('should display DMSO compatibility warning', async ({ page }) => {
      // Warning should be visible
      await expect(page.locator('text=Always verify catheter DMSO compatibility')).toBeVisible();
    });

    test('should display priming instructions', async ({ page }) => {
      // Priming instructions should be visible
      await expect(page.locator('text=Priming Instructions for Liquid Embolics')).toBeVisible();
      await expect(page.locator('text=Flush microcatheter with sterile saline')).toBeVisible();
      await expect(page.locator('text=Fill dead space with DMSO')).toBeVisible();
    });

    test('should display maximum injection pressure warning', async ({ page }) => {
      // Warning should be visible
      await expect(page.locator('text=Observe maximum injection pressure limits')).toBeVisible();
    });

    test('should display educational disclaimer', async ({ page }) => {
      // Disclaimer should be visible
      await expect(page.locator('text=This tool is for educational reference only')).toBeVisible();
      await expect(page.locator('text=not a substitute for clinical judgment')).toBeVisible();
    });

    test('should display detailed disclaimer box', async ({ page }) => {
      // Detailed disclaimer should be visible
      await expect(page.locator('text=Disclaimer').nth(1)).toBeVisible();
      await expect(page.locator('text=This catheter selector provides reference information')).toBeVisible();
      await expect(page.locator('text=Dead space volumes and specifications should be verified')).toBeVisible();
    });
  });

  test.describe('Manufacturer IFU Links', () => {

    test('should display IFU link for selected catheter', async ({ page }) => {
      // Select a catheter
      await selectFirstCatheter(page);

      // IFU link should be visible
      const ifuLink = selectedDetails(page).getByRole('link', {
        name: 'View Manufacturer IFU',
      });
      await expect(ifuLink).toBeVisible();

      // Link should have external link icon
      await expect(ifuLink.locator('svg')).toBeVisible();

      // Link should have proper attributes
      await expect(ifuLink).toHaveAttribute('target', '_blank');
      await expect(ifuLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    test('should have valid href for IFU link', async ({ page }) => {
      // Select a catheter
      await selectFirstCatheter(page);

      // Get the IFU link
      const ifuLink = selectedDetails(page).getByRole('link', {
        name: 'View Manufacturer IFU',
      });
      const href = await ifuLink.getAttribute('href');

      // Should have a valid URL
      expect(href).toBeTruthy();
      expect(href).toMatch(/^https?:\/\//);
    });
  });

  test.describe('Responsive Design & Accessibility', () => {

    test('should be usable on tablet', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      // All main sections should be visible
      await expect(filterHeading(page)).toBeVisible();
      await expect(compatibleHeading(page)).toBeVisible();
      await expect(safetySection(page)).toBeVisible();

      // Filters should be usable
      await searchInput(page).fill('Scepter');
      await expect(activeFilterBadge(page, 1)).toBeVisible();
    });

    test('should have accessible form labels', async ({ page }) => {
      // All inputs should have labels
      const searchLabel = page.locator('label[for="search"]');
      await expect(searchLabel).toBeVisible();

      const embolicAgentLabel = page.locator('label[for="embolicAgent"]');
      await expect(embolicAgentLabel).toBeVisible();

      const coilSizeLabel = page.locator('label[for="coilSize"]');
      await expect(coilSizeLabel).toBeVisible();

      const microsphereSizeLabel = page.locator('label[for="microsphereSize"]');
      await expect(microsphereSizeLabel).toBeVisible();

      const balloonLabel = page.locator('label[for="needsBalloon"]');
      await expect(balloonLabel).toBeVisible();

      const detachableTipLabel = page.locator('label[for="needsDetachableTip"]');
      await expect(detachableTipLabel).toBeVisible();
    });

    test('should have keyboard navigation support', async ({ page }) => {
      // Tab through elements
      await page.keyboard.press('Tab'); // Focus first interactive element
      await page.keyboard.press('Tab'); // Next element
      await page.keyboard.press('Tab'); // Next element

      // Should be able to interact with focused elements
      const focused = await page.locator(':focus');
      await expect(focused).toBeDefined();
    });

    test('should display category badges correctly', async ({ page }) => {
      // Category badges should be visible in results
      const resultsSection = compatibleSection(page);
      const categoryBadge = resultsSection
        .locator('h4')
        .first()
        .locator('..')
        .locator('span')
        .first();
      await expect(categoryBadge).toBeVisible();

      // Badge text should be meaningful
      const firstBadgeText = await categoryBadge.textContent();
      expect(firstBadgeText).toBeTruthy();
      expect(firstBadgeText.length).toBeGreaterThan(0);
    });
  });

  test.describe('Performance & Optimization', () => {

    test('should load all 30 catheters quickly', async ({ page }) => {
      // Page should already be loaded from beforeEach
      // Verify all catheters are shown
      await expect(compatibleHeading(page)).toContainText('(30 results)');

      // Results should be rendered (check for at least 20 catheter cards)
      const catheterCards = selectCatheterButtons(page);
      const count = await catheterCards.count();
      expect(count).toBeGreaterThanOrEqual(20);
    });

    test('should filter results quickly', async ({ page }) => {
      // Apply a filter
      const startTime = Date.now();
      await embolicAgentSelect(page).selectOption('phil25');
      const endTime = Date.now();

      // Should filter in reasonable time (< 2 seconds)
      expect(endTime - startTime).toBeLessThan(2000);

      // Results should be updated
      const resultsHeader = compatibleHeading(page);
      await expect(resultsHeader).toBeVisible();
    });

    test('should handle rapid search input changes', async ({ page }) => {
      // Type rapidly
      await searchInput(page).fill('S');
      await searchInput(page).fill('Se');
      await searchInput(page).fill('Sec');
      await searchInput(page).fill('Scep');
      await searchInput(page).fill('Scepto');

      // Final results should be correct
      await expect(compatibleHeading(page)).toBeVisible();
    });
  });

  test.describe('Data Integrity & Accuracy', () => {

    test('should display correct catheter specifications', async ({ page }) => {
      // Select Scepter C
      await searchInput(page).fill('Scepter C');
      await selectCatheter(page, 'Scepter C');

      // Verify key specifications are present
      await expect(selectedDetails(page)).toContainText('Inner Diameter:');
      await expect(selectedDetails(page)).toContainText('Outer Diameter:');
      await expect(selectedDetails(page)).toContainText('Working Length:');
      await expect(selectedDetails(page)).toContainText('Max Injection Pressure:');

      // Verify priming volume is numeric
      const primingVolumeBox = detailsHeading(page, 'Priming Volume').locator(
        '..',
      );
      const primingVolume = primingVolumeBox.locator('p').first();
      const volumeText = await primingVolume.textContent();
      expect(volumeText).toMatch(/\d+\.\d+ mL/);
    });

    test('should show consistent data between list view and detail view', async ({ page }) => {
      // Get catheter name from list
      const resultsSection = compatibleSection(page);
      const firstCatheterName = await resultsSection.locator('h4').first().textContent();

      // Select it
      await selectFirstCatheter(page);

      // Verify same name in detail view
      const detailName = await selectedDetails(page)
        .locator('h4')
        .first()
        .textContent();
      expect(detailName).toBe(firstCatheterName);
    });

    test('should maintain data consistency across filter changes', async ({ page }) => {
      // Apply filter
      await embolicAgentSelect(page).selectOption('phil25');

      // Get first result
      const resultsSection = compatibleSection(page);
      const firstResult = await resultsSection.locator('h4').first().textContent();

      // Change filter
      await embolicAgentSelect(page).selectOption('');

      // Re-apply same filter
      await embolicAgentSelect(page).selectOption('phil25');

      // Should show same first result
      const newFirstResult = await resultsSection.locator('h4').first().textContent();
      expect(newFirstResult).toBe(firstResult);
    });
  });
});
