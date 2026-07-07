import { test, expect } from "@playwright/test";

async function openBoundaryTestApp(page) {
  await page.goto("/?__radulator_boundary_test=1");
  await page
    .getByRole("heading", { name: "Radulator", level: 1 })
    .first()
    .waitFor({ state: "visible" });
}

async function openCalculator(page, calculatorName) {
  await page.getByRole("button", { name: calculatorName, exact: true }).click();
}

test.describe("Calculator error boundary", () => {
  test.beforeEach(async ({ page }) => {
    await openBoundaryTestApp(page);
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
