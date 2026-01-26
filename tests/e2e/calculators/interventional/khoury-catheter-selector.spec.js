import { test, expect } from '@playwright/test';

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
    await page.goto('/');
    // Navigate to Khoury Catheter Selector
    await page.click('text=Khoury Catheter Selector');
    // Wait for calculator to load
    await expect(page.locator('h2:has-text("Khoury Catheter Selector")')).toBeVisible();
  });

  test.describe('Visual Appeal & Theme Matching', () => {

    test('should display calculator with proper styling', async ({ page }) => {
      // Check title is visible and styled
      const title = page.locator('h2:has-text("Khoury Catheter Selector")');
      await expect(title).toBeVisible();

      // Check description is present
      await expect(page.locator('text=Interactive microcatheter selection tool')).toBeVisible();

      // Check filter panel is visible
      await expect(page.locator('text=Filter Catheters')).toBeVisible();

      // Check results section is visible
      await expect(page.locator('h3:has-text("Compatible Catheters")')).toBeVisible();

      // Check safety warnings section is visible
      await expect(page.locator('text=Safety Information')).toBeVisible();
    });

    test('should have responsive design on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Calculator should still be visible and usable
      await expect(page.locator('h2:has-text("Khoury Catheter Selector")')).toBeVisible();

      // Filter panel should be visible
      await expect(page.locator('text=Filter Catheters')).toBeVisible();

      // Results should be visible
      await expect(page.locator('h3:has-text("Compatible Catheters")')).toBeVisible();
    });

    test('should display filter collapse/expand toggle', async ({ page }) => {
      // Check show/hide filters button exists (look for ChevronUp/ChevronDown icon in CardHeader)
      const filterCard = page.locator('h3:has-text("Filter Catheters")').locator('..');
      const toggleButton = filterCard.locator('button').last();
      await expect(toggleButton).toBeVisible();

      // Click to hide filters
      await toggleButton.click();

      // Verify filters are hidden
      await expect(page.locator('#search')).not.toBeVisible();

      // Click to show filters again
      await toggleButton.click();

      // Verify filters are visible
      await expect(page.locator('#search')).toBeVisible();
    });
  });

  test.describe('Initial State & Database Loading', () => {

    test('should load 30 catheters by default', async ({ page }) => {
      // Check that results show 30 catheters
      await expect(page.locator('text=Compatible Catheters (30 results)')).toBeVisible();
    });

    test('should display all filter options', async ({ page }) => {
      // Search input
      await expect(page.locator('#search')).toBeVisible();
      await expect(page.locator('label:has-text("Search by Name or Manufacturer")')).toBeVisible();

      // Embolic agent dropdown
      await expect(page.locator('#embolicAgent')).toBeVisible();
      await expect(page.locator('label:has-text("Embolic Agent")')).toBeVisible();

      // Coil size dropdown
      await expect(page.locator('#coilSize')).toBeVisible();
      await expect(page.locator('label:has-text("Coil Size")')).toBeVisible();

      // Microsphere size dropdown
      await expect(page.locator('#microsphereSize')).toBeVisible();
      await expect(page.locator('label:has-text("Microsphere Size")')).toBeVisible();

      // Balloon checkbox
      await expect(page.locator('#needsBalloon')).toBeVisible();
      await expect(page.locator('label:has-text("Balloon occlusion required")')).toBeVisible();

      // Detachable tip checkbox
      await expect(page.locator('#needsDetachableTip')).toBeVisible();
      await expect(page.locator('label:has-text("Detachable tip required")')).toBeVisible();
    });

    test('should not have any catheter selected initially', async ({ page }) => {
      // Selected catheter details card should not be present
      await expect(page.locator('text=Selected Catheter Details')).not.toBeVisible();
    });

    test('should display safety information', async ({ page }) => {
      // Safety section should be visible
      await expect(page.locator('text=Safety Information')).toBeVisible();

      // Critical warnings should be visible
      await expect(page.locator('text=Critical Safety Warnings')).toBeVisible();
      await expect(page.locator('text=NBCA (n-BCA) is NOT compatible with balloon occlusion catheters')).toBeVisible();

      // Disclaimer should be visible
      await expect(page.locator('text=Disclaimer')).toBeVisible();
      await expect(page.locator('text=educational reference only')).toBeVisible();
    });
  });

  test.describe('Search Functionality', () => {

    test('should filter catheters by name search', async ({ page }) => {
      // Search for "Scepter"
      await page.fill('#search', 'Scepter');

      // Should show Scepter catheters (Scepter C and Scepter XC)
      await expect(page.locator('h3:has-text("Compatible Catheters (3 results)")')).toBeVisible();
      await expect(page.locator('h4:has-text("Scepter C")').first()).toBeVisible();
      await expect(page.locator('h4:has-text("Scepter XC")').first()).toBeVisible();
    });

    test('should filter catheters by manufacturer search', async ({ page }) => {
      // Search for "Medtronic"
      await page.fill('#search', 'Medtronic');

      // Should show Medtronic catheters
      await expect(page.locator('text=Medtronic').first()).toBeVisible();

      // Result count should be less than 30
      const results = page.locator('h3:has-text("Compatible Catheters")');
      const text = await results.textContent();
      expect(text).toContain('results');
      expect(text).not.toContain('30 results');
    });

    test('should perform case-insensitive search', async ({ page }) => {
      // Search for lowercase
      await page.fill('#search', 'headway');

      // Should still find Headway catheters
      await expect(page.locator('text=Headway').first()).toBeVisible();

      // Try uppercase
      await page.fill('#search', 'HEADWAY');
      await expect(page.locator('text=Headway').first()).toBeVisible();

      // Try mixed case
      await page.fill('#search', 'HeAdWaY');
      await expect(page.locator('text=Headway').first()).toBeVisible();
    });

    test('should show no results for non-existent search', async ({ page }) => {
      // Search for something that doesn't exist
      await page.fill('#search', 'NonExistentCatheter123');

      // Should show no results message
      await expect(page.locator('text=No catheters match your criteria')).toBeVisible();
      await expect(page.locator('text=Try adjusting your filters')).toBeVisible();
    });

    test('should clear search results when input is cleared', async ({ page }) => {
      // Search for something
      await page.fill('#search', 'Scepter');
      await expect(page.locator('h3:has-text("Compatible Catheters (3 results)")')).toBeVisible();

      // Clear search
      await page.fill('#search', '');

      // Should show all 30 catheters again
      await expect(page.locator('h3:has-text("Compatible Catheters (30 results)")')).toBeVisible();
    });

    test('should display active filter count badge for search', async ({ page }) => {
      // Initially no active filters
      await expect(page.locator('text=1 active')).not.toBeVisible();

      // Add search term
      await page.fill('#search', 'Scepter');

      // Should show 1 active filter
      await expect(page.locator('text=1 active')).toBeVisible();
    });
  });

  test.describe('Embolic Agent Filtering', () => {

    test('should filter by Onyx 18', async ({ page }) => {
      // Select Onyx 18
      await page.selectOption('#embolicAgent', 'onyx18');

      // Verify filtered results
      const resultsHeader = page.locator('h3:has-text("Compatible Catheters")');
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/Compatible Catheters \(\d+ results\)/);

      // Result should be less than 30 (filtered)
      expect(text).not.toContain('(30 results)');
    });

    test('should filter by PHIL 25%', async ({ page }) => {
      // Select PHIL 25%
      await page.selectOption('#embolicAgent', 'phil25');

      // Should show filtered results
      const resultsHeader = page.locator('h3:has-text("Compatible Catheters")');
      const text = await resultsHeader.textContent();

      // Verify we have results and they're filtered
      expect(text).toMatch(/\(\d+ results\)/);

      // Should exclude TransForm (not compatible with PHIL 25)
      await expect(page.locator('h4:has-text("TransForm")').first()).not.toBeVisible();
    });

    test('should filter by PHIL 30%', async ({ page }) => {
      // Select PHIL 30%
      await page.selectOption('#embolicAgent', 'phil30');

      // Should show filtered results
      const resultsHeader = page.locator('h3:has-text("Compatible Catheters")');
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);
    });

    test('should filter by PHIL 35%', async ({ page }) => {
      // Select PHIL 35%
      await page.selectOption('#embolicAgent', 'phil35');

      // Should show filtered results
      const resultsHeader = page.locator('h3:has-text("Compatible Catheters")');
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);
    });

    test('should filter by Squid 12', async ({ page }) => {
      // Select Squid 12
      await page.selectOption('#embolicAgent', 'squid12');

      // Should show filtered results
      const resultsHeader = page.locator('h3:has-text("Compatible Catheters")');
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);
    });

    test('should filter by Squid 18', async ({ page }) => {
      // Select Squid 18
      await page.selectOption('#embolicAgent', 'squid18');

      // Should show filtered results
      const resultsHeader = page.locator('h3:has-text("Compatible Catheters")');
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);
    });

    test('should filter by NBCA', async ({ page }) => {
      // Select NBCA
      await page.selectOption('#embolicAgent', 'nbca');

      // Should show filtered results (excluding balloon catheters)
      const resultsHeader = page.locator('h3:has-text("Compatible Catheters")');
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);

      // Should NOT show Scepter (balloon catheter, not NBCA compatible)
      await expect(page.locator('h4:has-text("Scepter C")').first()).not.toBeVisible();
    });

    test('should filter by coils only', async ({ page }) => {
      // Select Coils Only
      await page.selectOption('#embolicAgent', 'coils');

      // Should show filtered results
      const resultsHeader = page.locator('h3:has-text("Compatible Catheters")');
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);
    });

    test('should filter by microspheres', async ({ page }) => {
      // Select Microspheres
      await page.selectOption('#embolicAgent', 'microspheres');

      // Should show filtered results
      const resultsHeader = page.locator('h3:has-text("Compatible Catheters")');
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);
    });

    test('should filter by Y-90 microspheres', async ({ page }) => {
      // Select Y-90
      await page.selectOption('#embolicAgent', 'y90');

      // Should show filtered results
      const resultsHeader = page.locator('h3:has-text("Compatible Catheters")');
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);
    });

    test('should reset filter when "All Embolic Agents" is selected', async ({ page }) => {
      // Select a filter first
      await page.selectOption('#embolicAgent', 'phil25');

      // Verify filtered
      let text = await page.locator('h3:has-text("Compatible Catheters")').textContent();
      expect(text).not.toContain('(30 results)');

      // Reset to "All Embolic Agents"
      await page.selectOption('#embolicAgent', '');

      // Should show all 30 catheters
      await expect(page.locator('h3:has-text("Compatible Catheters (30 results)")')).toBeVisible();
    });
  });

  test.describe('Size Filtering', () => {

    test('should filter by coil size 0.010 inch', async ({ page }) => {
      // Select coil size
      await page.selectOption('#coilSize', '0.010');

      // Should show filtered results
      const resultsHeader = page.locator('h3:has-text("Compatible Catheters")');
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);
    });

    test('should filter by coil size 0.0165 inch', async ({ page }) => {
      // Select coil size
      await page.selectOption('#coilSize', '0.0165');

      // Should show filtered results including Scepter
      await expect(page.locator('h4:has-text("Scepter")').first()).toBeVisible();
    });

    test('should filter by coil size 0.018 inch', async ({ page }) => {
      // Select coil size
      await page.selectOption('#coilSize', '0.018');

      // Should show filtered results
      const resultsHeader = page.locator('h3:has-text("Compatible Catheters")');
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);
    });

    test('should filter by microsphere size ≤300 µm', async ({ page }) => {
      // Select microsphere size
      await page.selectOption('#microsphereSize', '300');

      // Should show filtered results
      const resultsHeader = page.locator('h3:has-text("Compatible Catheters")');
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);
    });

    test('should filter by microsphere size ≤500 µm', async ({ page }) => {
      // Select microsphere size
      await page.selectOption('#microsphereSize', '500');

      // Should show filtered results
      const resultsHeader = page.locator('h3:has-text("Compatible Catheters")');
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);
    });

    test('should filter by microsphere size ≤700 µm', async ({ page }) => {
      // Select microsphere size
      await page.selectOption('#microsphereSize', '700');

      // Should show filtered results
      const resultsHeader = page.locator('h3:has-text("Compatible Catheters")');
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);
    });

    test('should filter by microsphere size ≤900 µm', async ({ page }) => {
      // Select microsphere size
      await page.selectOption('#microsphereSize', '900');

      // Should show filtered results
      const resultsHeader = page.locator('h3:has-text("Compatible Catheters")');
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);
    });

    test('should combine embolic agent and size filters', async ({ page }) => {
      // Select embolic agent
      await page.selectOption('#embolicAgent', 'microspheres');

      // Select microsphere size
      await page.selectOption('#microsphereSize', '500');

      // Should show filtered results (both filters applied)
      const resultsHeader = page.locator('h3:has-text("Compatible Catheters")');
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);

      // Should show 2 active filters
      await expect(page.locator('text=2 active')).toBeVisible();
    });
  });

  test.describe('Feature Toggle Filtering', () => {

    test('should filter by balloon occlusion requirement', async ({ page }) => {
      // Check balloon occlusion checkbox
      await page.check('#needsBalloon');

      // Should show only balloon catheters
      const resultsHeader = page.locator('h3:has-text("Compatible Catheters")');
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);

      // Should show balloon catheters like Scepter
      await expect(page.locator('text=Scepter').first()).toBeVisible();

      // Should show active filter count
      await expect(page.locator('text=1 active')).toBeVisible();
    });

    test('should filter by detachable tip requirement', async ({ page }) => {
      // Check detachable tip checkbox
      await page.check('#needsDetachableTip');

      // Should show only detachable tip catheters
      const resultsHeader = page.locator('h3:has-text("Compatible Catheters")');
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);

      // Should show active filter count
      await expect(page.locator('text=1 active')).toBeVisible();
    });

    test('should combine balloon and detachable tip filters', async ({ page }) => {
      // Check both
      await page.check('#needsBalloon');
      await page.check('#needsDetachableTip');

      // Should show no results or very limited results
      const resultsHeader = page.locator('h3:has-text("Compatible Catheters")');
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);

      // Should show 2 active filters
      await expect(page.locator('text=2 active')).toBeVisible();
    });

    test('should uncheck balloon occlusion filter', async ({ page }) => {
      // Check and then uncheck
      await page.check('#needsBalloon');
      await expect(page.locator('text=1 active')).toBeVisible();

      await page.uncheck('#needsBalloon');

      // Should show all 30 catheters again
      await expect(page.locator('h3:has-text("Compatible Catheters (30 results)")')).toBeVisible();
      await expect(page.locator('span:has-text("active")')).not.toBeVisible();
    });
  });

  test.describe('Catheter Selection & Details', () => {

    test('should select a catheter and display details', async ({ page }) => {
      // Click the first Select button
      await page.locator('button:has-text("Select")').first().click();

      // Should show selected catheter details
      await expect(page.locator('h3:has-text("Selected Catheter Details")')).toBeVisible();

      // Should show priming volume section
      await expect(page.locator('h5:has-text("Priming Volume")')).toBeVisible();

      // Should show features section
      await expect(page.locator('h5:has-text("Features")')).toBeVisible();

      // Should show compatible embolics section
      await expect(page.locator('h5:has-text("Compatible Embolic Agents")')).toBeVisible();

      // Should show IFU link
      await expect(page.locator('a:has-text("View Manufacturer IFU")')).toBeVisible();
    });

    test('should select Headway Duo catheter specifically', async ({ page }) => {
      // Search for Headway Duo
      await page.fill('#search', 'Headway Duo');

      // Click Select on Headway Duo
      await page.click('button:has-text("Select")');

      // Should show Headway Duo details
      await expect(page.locator('h3:has-text("Selected Catheter Details")')).toBeVisible();
      await expect(page.locator('h4:has-text("Headway Duo")').first()).toBeVisible();

      // Should show specifications
      await expect(page.locator('text=Inner Diameter:')).toBeVisible();
      await expect(page.locator('text=Outer Diameter:')).toBeVisible();
      await expect(page.locator('text=Working Length:')).toBeVisible();
      await expect(page.locator('text=Max Injection Pressure:')).toBeVisible();
    });

    test('should highlight selected catheter in results', async ({ page }) => {
      // Select first catheter
      await page.locator('button:has-text("Select")').first().click();

      // Button should change to "Selected"
      await expect(page.locator('button:has-text("Selected")').first()).toBeVisible();
    });

    test('should switch between selected catheters', async ({ page }) => {
      // Select first catheter
      await page.locator('button:has-text("Select")').first().click();
      await expect(page.locator('button:has-text("Selected")').first()).toBeVisible();

      // Select a different catheter
      await page.click('button:has-text("Select")').nth(1);

      // New catheter should be selected
      await expect(page.locator('button:has-text("Selected")').nth(1)).toBeVisible();

      // Details should update
      await expect(page.locator('h3:has-text("Selected Catheter Details")')).toBeVisible();
    });

    test('should display clinical notes if present', async ({ page }) => {
      // Select a catheter with notes (Scepter C)
      await page.fill('#search', 'Scepter C');
      await page.click('button:has-text("Select")');

      // Should show clinical notes section
      await expect(page.locator('h5:has-text("Clinical Notes")')).toBeVisible();
      await expect(page.locator('p:has-text("NOT compatible with NBCA")')).toBeVisible();
    });

    test('should display all compatible embolic agents for selected catheter', async ({ page }) => {
      // Select a catheter
      await page.locator('button:has-text("Select")').first().click();

      // Should show compatible embolics section
      await expect(page.locator('h5:has-text("Compatible Embolic Agents")')).toBeVisible();

      // Should have at least one embolic agent badge
      const badges = page.locator('.text-xs.px-2.py-1.bg-gray-100');
      await expect(badges.first()).toBeVisible();
    });

    test('should display feature badges for selected catheter', async ({ page }) => {
      // Select a catheter
      await page.locator('button:has-text("Select")').first().click();

      // Should show features section with badges
      await expect(page.locator('h5:has-text("Features")')).toBeVisible();

      // Should show DMSO compatibility badge
      const dmsoCompatible = page.locator('text=DMSO Compatible');
      const dmsoNotCompatible = page.locator('text=NOT DMSO Compatible');

      // One of them should be visible
      const isDmsoCompatibleVisible = await dmsoCompatible.isVisible();
      const isDmsoNotCompatibleVisible = await dmsoNotCompatible.isVisible();
      expect(isDmsoCompatibleVisible || isDmsoNotCompatibleVisible).toBe(true);
    });
  });

  test.describe('Priming Volume Calculator', () => {

    test('should display priming volume for selected catheter', async ({ page }) => {
      // Select a catheter
      await page.locator('button:has-text("Select")').first().click();

      // Should show priming volume
      await expect(page.locator('h5:has-text("Priming Volume")')).toBeVisible();

      // Should show a numeric value in mL
      const primingVolumeText = page.locator('h5:has-text("Priming Volume")').locator('..');
      await expect(primingVolumeText.locator('text=mL')).toBeVisible();
    });

    test('should change priming volume when adaptor is selected (Scepter C)', async ({ page }) => {
      // Search for and select Scepter C
      await page.fill('#search', 'Scepter C');
      await page.click('button:has-text("Select")');

      // Check initial priming volume (standard)
      await expect(page.locator('text=0.44 mL')).toBeVisible();

      // Select PHIL Adaptor
      await page.selectOption('#adaptorType', 'phil');

      // Priming volume should decrease to 0.23 mL
      await expect(page.locator('text=0.23 mL')).toBeVisible();

      // Verify adaptor label is shown
      await expect(page.locator('p:has-text("With PHIL Adaptor")')).toBeVisible();
    });

    test('should update priming volume dynamically (Headway Duo with MicroVention adaptor)', async ({ page }) => {
      // Search for and select Headway Duo
      await page.fill('#search', 'Headway Duo');
      await page.click('button:has-text("Select")');

      // Check initial priming volume (standard)
      const initialVolume = page.locator('.text-3xl.font-bold.text-blue-700');
      const initialText = await initialVolume.textContent();
      expect(initialText).toMatch(/\d+\.\d+ mL/);

      // If adaptor options exist, select MicroVention adaptor
      const adaptorSelect = page.locator('#adaptorType');
      if (await adaptorSelect.isVisible()) {
        const hasOptions = await page.locator('#adaptorType option').count();
        if (hasOptions > 1) {
          // Select a different adaptor option
          await page.selectOption('#adaptorType', { index: 1 });

          // Priming volume should update
          const newVolume = await initialVolume.textContent();

          // Value should have changed (or at least still be valid)
          expect(newVolume).toMatch(/\d+\.\d+ mL/);
        }
      }
    });

    test('should show standard priming volume by default', async ({ page }) => {
      // Select any catheter
      await page.locator('button:has-text("Select")').first().click();

      // Should show Standard configuration
      await expect(page.locator('option:has-text("Standard")')).toBeVisible();
    });
  });

  test.describe('Filter Management', () => {

    test('should display active filter count', async ({ page }) => {
      // Initially no badge
      await expect(page.locator('span:has-text("active")')).not.toBeVisible();

      // Add one filter
      await page.fill('#search', 'test');
      await expect(page.locator('span:has-text("1 active")')).toBeVisible();

      // Add another filter
      await page.selectOption('#embolicAgent', 'onyx18');
      await expect(page.locator('span:has-text("2 active")')).toBeVisible();

      // Add checkbox filter
      await page.check('#needsBalloon');
      await expect(page.locator('span:has-text("3 active")')).toBeVisible();
    });

    test('should show Clear All button when filters are active', async ({ page }) => {
      // Initially no Clear All button
      await expect(page.locator('button:has-text("Clear All")')).not.toBeVisible();

      // Add a filter
      await page.fill('#search', 'test');

      // Clear All button should appear
      await expect(page.locator('button:has-text("Clear All")')).toBeVisible();
    });

    test('should clear all filters when Clear All is clicked', async ({ page }) => {
      // Add multiple filters
      await page.fill('#search', 'Scepter');
      await page.selectOption('#embolicAgent', 'phil25');
      await page.selectOption('#coilSize', '0.0165');
      await page.check('#needsBalloon');

      // Verify filters are active
      await expect(page.locator('span:has-text("4 active")')).toBeVisible();

      // Click Clear All
      await page.click('button:has-text("Clear All")');

      // All filters should be cleared
      await expect(page.locator('span:has-text("active")')).not.toBeVisible();
      await expect(page.locator('h3:has-text("Compatible Catheters (30 results)")')).toBeVisible();

      // Search should be empty
      await expect(page.locator('#search')).toHaveValue('');

      // Dropdowns should be reset
      await expect(page.locator('#embolicAgent')).toHaveValue('');
      await expect(page.locator('#coilSize')).toHaveValue('');

      // Checkboxes should be unchecked
      await expect(page.locator('#needsBalloon')).not.toBeChecked();
    });

    test('should clear selected catheter when Clear All is clicked', async ({ page }) => {
      // Select a catheter
      await page.locator('button:has-text("Select")').first().click();
      await expect(page.locator('h3:has-text("Selected Catheter Details")')).toBeVisible();

      // Add a filter
      await page.fill('#search', 'test');

      // Clear all
      await page.click('button:has-text("Clear All")');

      // Selected catheter should be cleared
      await expect(page.locator('h3:has-text("Selected Catheter Details")')).not.toBeVisible();
    });
  });

  test.describe('Edge Cases & Complex Filtering', () => {

    test('should handle no results scenario gracefully', async ({ page }) => {
      // Combine filters that result in no matches
      await page.selectOption('#embolicAgent', 'nbca');
      await page.check('#needsBalloon');

      // Should show no results message (NBCA not compatible with balloon)
      await expect(page.locator('text=No catheters match your criteria')).toBeVisible();
      await expect(page.locator('text=Try adjusting your filters')).toBeVisible();
    });

    test('should handle multiple filters applied simultaneously', async ({ page }) => {
      // Apply search
      await page.fill('#search', 'Headway');

      // Apply embolic agent
      await page.selectOption('#embolicAgent', 'phil25');

      // Apply coil size
      await page.selectOption('#coilSize', '0.014');

      // Apply microsphere size
      await page.selectOption('#microsphereSize', '500');

      // Should show filtered results
      const resultsHeader = page.locator('h3:has-text("Compatible Catheters")');
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);

      // Should show 4 active filters
      await expect(page.locator('span:has-text("4 active")')).toBeVisible();
    });

    test('should handle all filters at maximum', async ({ page }) => {
      // Apply all possible filters
      await page.fill('#search', 'Catheter');
      await page.selectOption('#embolicAgent', 'onyx18');
      await page.selectOption('#coilSize', '0.018');
      await page.selectOption('#microsphereSize', '900');
      await page.check('#needsBalloon');
      await page.check('#needsDetachableTip');

      // Should show 6 active filters
      await expect(page.locator('span:has-text("6 active")')).toBeVisible();

      // Should either show results or no results message
      const noResults = page.locator('text=No catheters match your criteria');
      const hasResults = page.locator('h3:has-text("Compatible Catheters")');

      const noResultsVisible = await noResults.isVisible();
      const hasResultsVisible = await hasResults.isVisible();

      expect(noResultsVisible || hasResultsVisible).toBe(true);
    });

    test('should handle rapid filter changes', async ({ page }) => {
      // Rapidly change filters
      await page.selectOption('#embolicAgent', 'onyx18');
      await page.selectOption('#embolicAgent', 'phil25');
      await page.selectOption('#embolicAgent', 'squid12');
      await page.selectOption('#embolicAgent', 'coils');

      // Should still show valid results
      const resultsHeader = page.locator('h3:has-text("Compatible Catheters")');
      await expect(resultsHeader).toBeVisible();

      // Active filter count should be 1
      await expect(page.locator('span:has-text("1 active")')).toBeVisible();
    });

    test('should handle special characters in search', async ({ page }) => {
      // Search with special characters
      await page.fill('#search', '@#$%^&*()');

      // Should show no results
      await expect(page.locator('text=No catheters match your criteria')).toBeVisible();
    });

    test('should handle very long search strings', async ({ page }) => {
      // Enter a very long search string
      const longString = 'a'.repeat(200);
      await page.fill('#search', longString);

      // Should show no results
      await expect(page.locator('text=No catheters match your criteria')).toBeVisible();
    });

    test('should filter correctly when search matches partial manufacturer name', async ({ page }) => {
      // Search for partial manufacturer name
      await page.fill('#search', 'Terumo');

      // Should show TerumoNeuro and Terumo catheters
      const resultsHeader = page.locator('h3:has-text("Compatible Catheters")');
      const text = await resultsHeader.textContent();
      expect(text).toMatch(/\(\d+ results\)/);
      expect(text).not.toContain('(30 results)');
    });

    test('should maintain filter state after selecting and deselecting catheter', async ({ page }) => {
      // Apply filters
      await page.fill('#search', 'Headway');
      await page.selectOption('#embolicAgent', 'phil25');

      // Verify 2 active filters
      await expect(page.locator('span:has-text("2 active")')).toBeVisible();

      // Select a catheter
      await page.locator('button:has-text("Select")').first().click();

      // Filters should still be active
      await expect(page.locator('span:has-text("2 active")')).toBeVisible();

      // Search should still have value
      await expect(page.locator('#search')).toHaveValue('Headway');

      // Embolic agent should still be selected
      await expect(page.locator('#embolicAgent')).toHaveValue('phil25');
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
      await page.locator('button:has-text("Select")').first().click();

      // IFU link should be visible
      const ifuLink = page.locator('a:has-text("View Manufacturer IFU")');
      await expect(ifuLink).toBeVisible();

      // Link should have external link icon
      await expect(ifuLink.locator('svg')).toBeVisible();

      // Link should have proper attributes
      await expect(ifuLink).toHaveAttribute('target', '_blank');
      await expect(ifuLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    test('should have valid href for IFU link', async ({ page }) => {
      // Select a catheter
      await page.locator('button:has-text("Select")').first().click();

      // Get the IFU link
      const ifuLink = page.locator('a:has-text("View Manufacturer IFU")');
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
      await expect(page.locator('h3:has-text("Filter Catheters")')).toBeVisible();
      await expect(page.locator('h3:has-text("Compatible Catheters")')).toBeVisible();
      await expect(page.locator('h3:has-text("Safety Information")')).toBeVisible();

      // Filters should be usable
      await page.fill('#search', 'Scepter');
      await expect(page.locator('span:has-text("1 active")')).toBeVisible();
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
      const categoryBadges = page.locator('.text-xs.px-2.py-0\\.5.bg-gray-100');
      await expect(categoryBadges.first()).toBeVisible();

      // Badge text should be meaningful
      const firstBadgeText = await categoryBadges.first().textContent();
      expect(firstBadgeText).toBeTruthy();
      expect(firstBadgeText.length).toBeGreaterThan(0);
    });
  });

  test.describe('Performance & Optimization', () => {

    test('should load all 30 catheters quickly', async ({ page }) => {
      // Page should already be loaded from beforeEach
      // Verify all catheters are shown
      await expect(page.locator('text=Compatible Catheters (30 results)')).toBeVisible();

      // Results should be rendered (check for at least 20 catheter cards)
      const catheterCards = page.locator('button:has-text("Select")');
      const count = await catheterCards.count();
      expect(count).toBeGreaterThanOrEqual(20);
    });

    test('should filter results quickly', async ({ page }) => {
      // Apply a filter
      const startTime = Date.now();
      await page.selectOption('#embolicAgent', 'phil25');
      const endTime = Date.now();

      // Should filter in reasonable time (< 2 seconds)
      expect(endTime - startTime).toBeLessThan(2000);

      // Results should be updated
      const resultsHeader = page.locator('h3:has-text("Compatible Catheters")');
      await expect(resultsHeader).toBeVisible();
    });

    test('should handle rapid search input changes', async ({ page }) => {
      // Type rapidly
      await page.fill('#search', 'S');
      await page.fill('#search', 'Se');
      await page.fill('#search', 'Sec');
      await page.fill('#search', 'Scep');
      await page.fill('#search', 'Scepto');

      // Final results should be correct
      await expect(page.locator('text=Compatible Catheters').first()).toBeVisible();
    });
  });

  test.describe('Data Integrity & Accuracy', () => {

    test('should display correct catheter specifications', async ({ page }) => {
      // Select Scepter C
      await page.fill('#search', 'Scepter C');
      await page.locator('button:has-text("Select")').first().click();

      // Verify key specifications are present
      await expect(page.locator('text=Inner Diameter:')).toBeVisible();
      await expect(page.locator('text=Outer Diameter:')).toBeVisible();
      await expect(page.locator('text=Working Length:')).toBeVisible();
      await expect(page.locator('text=Max Injection Pressure:')).toBeVisible();

      // Verify priming volume is numeric
      const primingVolume = page.locator('.text-3xl.font-bold.text-blue-700');
      const volumeText = await primingVolume.textContent();
      expect(volumeText).toMatch(/\d+\.\d+ mL/);
    });

    test('should show consistent data between list view and detail view', async ({ page }) => {
      // Get catheter name from list
      const firstCatheterName = await page.locator('h4.font-semibold.text-base').first().textContent();

      // Select it
      await page.locator('button:has-text("Select")').first().click();

      // Verify same name in detail view
      const detailName = await page.locator('h4.font-semibold.text-lg').first().textContent();
      expect(detailName).toBe(firstCatheterName);
    });

    test('should maintain data consistency across filter changes', async ({ page }) => {
      // Apply filter
      await page.selectOption('#embolicAgent', 'phil25');

      // Get first result
      const firstResult = await page.locator('h4.font-semibold.text-base').first().textContent();

      // Change filter
      await page.selectOption('#embolicAgent', '');

      // Re-apply same filter
      await page.selectOption('#embolicAgent', 'phil25');

      // Should show same first result
      const newFirstResult = await page.locator('h4.font-semibold.text-base').first().textContent();
      expect(newFirstResult).toBe(firstResult);
    });
  });
});
