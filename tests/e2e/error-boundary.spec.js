import { test, expect } from "@playwright/test";

async function installBoundaryTestCalculators(page) {
  await page.addInitScript(() => {
    window.__RADULATOR_TEST_RENDER_COUNTS__ = {};
    window.__RADULATOR_TEST_SHOULD_THROW_ON_RETRY_CALC__ = true;
    window.__RADULATOR_TEST_CALCS__ = [
      {
        id: "boundary-recovers-on-retry",
        category: "Test",
        name: "Boundary Recovers On Retry",
        desc: "Test-only calculator that recovers after the retry path resets the boundary.",
        isCustomComponent: true,
        Component: function BoundaryRecoversOnRetry() {
          const key = "boundary-recovers-on-retry";
          window.__RADULATOR_TEST_RENDER_COUNTS__[key] =
            (window.__RADULATOR_TEST_RENDER_COUNTS__[key] || 0) + 1;
          if (window.__RADULATOR_TEST_SHOULD_THROW_ON_RETRY_CALC__) {
            throw new Error("Boundary test render error");
          }
          return "Recovered test calculator panel";
        },
      },
      {
        id: "boundary-always-throws",
        category: "Test",
        name: "Boundary Always Throws",
        desc: "Test-only calculator that always throws during render.",
        isCustomComponent: true,
        Component: function BoundaryAlwaysThrows() {
          const key = "boundary-always-throws";
          window.__RADULATOR_TEST_RENDER_COUNTS__[key] =
            (window.__RADULATOR_TEST_RENDER_COUNTS__[key] || 0) + 1;
          throw new Error("Persistent boundary test render error");
        },
      },
    ];
  });
}

async function openCalculator(page, calculatorName) {
  await page.getByRole("button", { name: calculatorName, exact: true }).click();
}

test.describe("Calculator error boundary", () => {
  test.beforeEach(async ({ page }) => {
    await installBoundaryTestCalculators(page);
    await page.goto("/");
    await page
      .getByRole("heading", { name: "Radulator", level: 1 })
      .first()
      .waitFor({ state: "visible" });
  });

  test("keeps navigation mounted and retries a render-phase calculator error", async ({
    page,
  }) => {
    await openCalculator(page, "Boundary Recovers On Retry");

    const errorPanel = page.getByRole("alert").filter({
      hasText: "This calculator hit an unexpected error",
    });
    await expect(errorPanel).toBeVisible();
    await expect(page.locator("#calculator-navigation")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Adrenal CT Washout", exact: true }),
    ).toBeVisible();

    await page.evaluate(() => {
      window.__RADULATOR_TEST_SHOULD_THROW_ON_RETRY_CALC__ = false;
    });
    await page.getByRole("button", { name: "Try again" }).click();

    await expect(page.getByText("Recovered test calculator panel")).toBeVisible();
    await expect(errorPanel).toHaveCount(0);
  });

  test("clears a tripped calculator boundary when another calculator is selected", async ({
    page,
  }) => {
    await openCalculator(page, "Boundary Always Throws");

    const errorPanel = page.getByRole("alert").filter({
      hasText: "This calculator hit an unexpected error",
    });
    await expect(errorPanel).toBeVisible();
    await expect(page.locator("#calculator-navigation")).toBeVisible();

    await openCalculator(page, "Adrenal CT Washout");

    await expect(page.getByTestId("calculator-title")).toContainText(
      "Adrenal CT Washout",
    );
    await expect(errorPanel).toHaveCount(0);
  });
});
