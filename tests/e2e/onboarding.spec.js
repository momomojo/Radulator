// @ts-check
import { test, expect } from "@playwright/test";

const BASE_URL = "/";

/**
 * Clear the welcome-seen flag so the welcome card shows on next load.
 */
async function clearWelcomeFlag(page) {
  await page.evaluate(() => localStorage.removeItem("radulator-welcome-seen"));
}

/**
 * Set the welcome-seen flag so the welcome card is hidden.
 */
async function setWelcomeFlag(page) {
  await page.evaluate(() =>
    localStorage.setItem("radulator-welcome-seen", "true"),
  );
}

/**
 * Open the guide overlay via the footer link (always visible on any viewport).
 */
async function openGuideViaFooter(page) {
  await page.locator('[data-testid="footer-guide-link"]').click();
  await expect(page.locator('[data-testid="guide-panel"]')).toBeVisible();
}

// ---------------------------------------------------------------------------
// Welcome Card
// ---------------------------------------------------------------------------
test.describe("Welcome Card", () => {
  test("shows on first visit", async ({ page }) => {
    await page.goto(BASE_URL);
    await clearWelcomeFlag(page);
    await page.reload();
    await expect(page.locator('[data-testid="welcome-card"]')).toBeVisible();
  });

  test("dismisses and stays dismissed after reload", async ({ page }) => {
    await page.goto(BASE_URL);
    await clearWelcomeFlag(page);
    await page.reload();
    await expect(page.locator('[data-testid="welcome-card"]')).toBeVisible();

    // Dismiss
    await page.locator('[data-testid="welcome-dismiss"]').click();
    await expect(
      page.locator('[data-testid="welcome-card"]'),
    ).not.toBeVisible();

    // Reload and verify still dismissed
    await page.reload();
    await expect(
      page.locator('[data-testid="welcome-card"]'),
    ).not.toBeVisible();
  });

  test("not shown for returning users", async ({ page }) => {
    await page.goto(BASE_URL);
    await setWelcomeFlag(page);
    await page.reload();
    await expect(
      page.locator('[data-testid="welcome-card"]'),
    ).not.toBeVisible();
  });

  test("'Open the Guide' link opens GuideOverlay and dismisses card", async ({
    page,
  }) => {
    await page.goto(BASE_URL);
    await clearWelcomeFlag(page);
    await page.reload();
    await expect(page.locator('[data-testid="welcome-card"]')).toBeVisible();

    await page.locator('[data-testid="welcome-open-guide"]').click();

    // Guide overlay should be open
    await expect(page.locator('[data-testid="guide-panel"]')).toBeVisible();
    // Welcome card should be dismissed
    await expect(
      page.locator('[data-testid="welcome-card"]'),
    ).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Guide Button
// ---------------------------------------------------------------------------
test.describe("Guide Button", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await setWelcomeFlag(page);
    await page.reload();
  });

  test("visible in desktop sidebar header", async ({ page }) => {
    // Sidebar guide button is inside <aside> with hidden md:flex class
    const sidebarButton = page.locator('aside [data-testid="guide-button"]');
    await expect(sidebarButton).toBeVisible();
  });

  test("visible in mobile header", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    // Mobile header guide button (first visible one)
    const guideButtons = page.locator('[data-testid="guide-button"]');
    await expect(guideButtons.first()).toBeVisible();
  });

  test("opens guide overlay on click", async ({ page }) => {
    // Use sidebar button (visible on desktop)
    await page.locator('aside [data-testid="guide-button"]').click();
    await expect(page.locator('[data-testid="guide-panel"]')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Guide Overlay
// ---------------------------------------------------------------------------
test.describe("Guide Overlay", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await setWelcomeFlag(page);
    await page.reload();
    // Open guide via footer link (always visible regardless of viewport)
    await openGuideViaFooter(page);
  });

  test("displays all 9 section titles", async ({ page }) => {
    const expectedSections = [
      "Getting Started",
      "Navigating Calculators",
      "Search and Tag Filtering",
      "Favorites and Recent Calculators",
      "Using a Calculator",
      "Understanding Results",
      "Copy and Print Results",
      "Dark Mode",
      "Clinical References",
    ];

    for (const title of expectedSections) {
      await expect(
        page
          .locator('[data-testid="guide-panel"]')
          .getByText(title, { exact: true })
          .first(),
      ).toBeVisible();
    }
  });

  test("close button works", async ({ page }) => {
    await page.locator('[data-testid="guide-close-button"]').click();
    await expect(page.locator('[data-testid="guide-panel"]')).not.toBeVisible();
  });

  test("ESC key closes", async ({ page }) => {
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-testid="guide-panel"]')).not.toBeVisible();
  });

  test("backdrop click closes", async ({ page }) => {
    const backdrop = page.locator('[data-testid="guide-backdrop"]');
    await backdrop.click({ position: { x: 10, y: 10 } });
    await expect(page.locator('[data-testid="guide-panel"]')).not.toBeVisible();
  });

  test("scrollable content — last section visible after scroll", async ({
    page,
  }) => {
    const overlay = page.locator('[data-testid="guide-overlay"]');
    await overlay.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await expect(
      page.locator('[data-testid="guide-section-title-clinical-references"]'),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Footer Guide link
// ---------------------------------------------------------------------------
test.describe("Footer Guide link", () => {
  test("opens guide overlay", async ({ page }) => {
    await page.goto(BASE_URL);
    await setWelcomeFlag(page);
    await page.reload();

    await page.locator('[data-testid="footer-guide-link"]').click();
    await expect(page.locator('[data-testid="guide-panel"]')).toBeVisible();
  });
});
