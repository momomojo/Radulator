import { test, expect } from "@playwright/test";

async function openNavigation(page) {
  await page
    .getByRole("heading", { name: "Radulator", level: 1 })
    .first()
    .waitFor({ state: "visible" });
}

async function openMobileMenuIfNeeded(page) {
  const menuButton = page.getByRole("button", {
    name: "Open navigation menu",
  });
  if (await menuButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await menuButton.click();
    await page.locator("aside").waitFor({ state: "visible" });
  }
}

test("preserves keyword-only calculator search metadata", async ({ page }) => {
  await page.goto("/");
  await openNavigation(page);

  await openMobileMenuIfNeeded(page);
  await page.getByPlaceholder(/search/i).fill("CCTA");
  await expect(
    page.getByRole("button", { name: "CAD-RADS 2.0", exact: true }),
  ).toBeVisible();
});

test("canonicalizes an unknown hash when the default calculator is already active", async ({
  page,
}) => {
  await page.goto("/#/aast-trauma-grading");
  await openNavigation(page);

  await page.evaluate(() => {
    window.location.hash = "#/not-a-calculator";
  });

  await expect(page).toHaveURL(/#\/aast-trauma-grading$/);
});

test("does not announce a successful route as unavailable after a failed chunk", async ({
  page,
}) => {
  await page.route(/\/CADRADS(?:-[^/]+)?\.jsx?(?:\?.*)?$/, (route) =>
    route.abort(),
  );
  await page.goto("/");
  await openNavigation(page);
  await openMobileMenuIfNeeded(page);

  await page.evaluate(() => {
    const observed = [];
    const observer = new MutationObserver(() => {
      for (const alert of document.querySelectorAll('[role="alert"]')) {
        observed.push(alert.textContent);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.__RADULATOR_ALERT_TEXTS__ = observed;
    window.__RADULATOR_ALERT_OBSERVER__ = observer;
    return observed;
  });

  await page.getByRole("button", { name: "CAD-RADS 2.0", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "CAD-RADS 2.0 could not be loaded" }),
  ).toBeVisible();

  await openMobileMenuIfNeeded(page);
  await page.getByRole("button", { name: "Adrenal CT Washout", exact: true }).click();
  await expect(page.getByTestId("calculator-title")).toContainText("Adrenal CT Washout");

  const observedAlerts = await page.evaluate(() => {
    window.__RADULATOR_ALERT_OBSERVER__.disconnect();
    return window.__RADULATOR_ALERT_TEXTS__;
  });
  expect(observedAlerts).not.toContain(
    "Calculator unavailableAdrenal CT Washout could not be loaded. Choose another calculator from the menu and try again.",
  );
});

test("recovers the requested calculator after an explicit stale-chunk reload", async ({
  page,
}) => {
  let failFirstCalculatorChunk = true;
  await page.route(/\/CADRADS(?:-[^/]+)?\.jsx?(?:\?.*)?$/, (route) => {
    if (failFirstCalculatorChunk) {
      failFirstCalculatorChunk = false;
      return route.abort();
    }
    return route.continue();
  });
  await page.goto("/");
  await openNavigation(page);
  await openMobileMenuIfNeeded(page);

  await page.getByRole("button", { name: "CAD-RADS 2.0", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "CAD-RADS 2.0 could not be loaded" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Reload page" }).click();
  await expect(page.getByTestId("calculator-title")).toContainText("CAD-RADS 2.0");
});
