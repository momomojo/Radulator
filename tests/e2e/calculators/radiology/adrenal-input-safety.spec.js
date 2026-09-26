import { test, expect } from "@playwright/test";

const cases = [
  { id: "adrenal-ct", values: { unenh: "10", portal: "100", delayed: "40" }, output: "66.7", invalidField: "portal", invalidValue: "10", restoredValue: "100" },
  { id: "adrenal-mri", values: { a_ip: "100", a_op: "50", s_ip: "100", s_op: "100" }, output: "0.50", invalidField: "s_op", invalidValue: "0", restoredValue: "100" },
];

async function open(page, id) {
  await page.goto(`/#/${id}`);
  for (const name of ["Dismiss medical disclaimer banner", "Dismiss welcome message"]) {
    const button = page.getByRole("button", { name, exact: true });
    if (await button.isVisible()) await button.click();
  }
}

for (const scenario of cases) {
  test(`${scenario.id} rejects invalid calculations and does not offer a stale report`, async ({ page, context, browserName }) => {
    await open(page, scenario.id);
    const result = page.getByRole("status", { name: "Calculator results" });
    const calculate = page.getByRole("button", { name: "Calculate", exact: true });
    await calculate.click();
    await expect(result).toContainText(/enter all/i);
    await expect(result).not.toContainText(/NaN|Infinity|adenoma/i);

    for (const [id, value] of Object.entries(scenario.values)) await page.locator(`#${id}`).fill(value);
    await expect(result).toHaveCount(0);
    await calculate.click();
    await expect(result).toContainText(scenario.output);

    if (browserName === "chromium") {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.getByRole("button", { name: "Copy results", exact: true }).click();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(scenario.output);
    }

    await page.locator(`#${scenario.invalidField}`).fill(scenario.invalidValue);
    await expect(result).toHaveCount(0);
    await calculate.click();
    await expect(result).toContainText(/zero/i);
    await expect(result).not.toContainText(/NaN|Infinity|adenoma/i);
    await expect(result).not.toContainText(scenario.output);
    await expect(page.getByRole("button", { name: /^(Copy results|Results copied)$/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Print Results", exact: true })).toHaveCount(0);

    await page.locator(`#${scenario.invalidField}`).fill(scenario.restoredValue);
    await expect(result).toHaveCount(0);
    await calculate.click();
    await expect(result).toContainText(scenario.output);
  });
}

test("CT does not turn a conventional washout threshold into unconditional benignity", async ({ page }) => {
  await open(page, "adrenal-ct");
  for (const [id, value] of Object.entries(cases[0].values)) await page.locator(`#${id}`).fill(value);
  await page.getByRole("button", { name: "Calculate", exact: true }).click();
  await expect(page.getByRole("status", { name: "Calculator results" })).toContainText("66.7");
  await expect(page.locator("main")).not.toContainText("indicates benign adenoma");
  await expect(page.locator("main")).toContainText("hypervascular extraadrenal primary tumors");
});

test("adrenal measurement results remain readable on mobile and in print media", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "adrenal-mri");
  for (const [id, value] of Object.entries(cases[1].values)) await page.locator(`#${id}`).fill(value);
  await page.locator("#s_op").press("Tab");
  const calculate = page.getByRole("button", { name: "Calculate", exact: true });
  await expect(calculate).toBeFocused();
  await page.keyboard.press("Enter");
  const result = page.getByRole("status", { name: "Calculator results" });
  await expect(result).toContainText("50.0");
  await expect(result).toContainText("0.50");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.emulateMedia({ media: "print" });
  await expect(result).toBeVisible();
  await expect(result).toContainText("0.50");
  await expect(page.locator("aside")).toBeHidden();
});
