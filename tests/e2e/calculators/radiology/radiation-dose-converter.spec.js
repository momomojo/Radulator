import { test, expect } from "@playwright/test";

// Source contract: docs/verification/calculators/radiation-dose-converter.md.
// All expected conversions/CT cases are independent literals.
const report = (page) => page.getByRole("status", { name: "Calculator results" });
const calculate = (page) => page.getByRole("button", { name: "Calculate", exact: true }).click();
async function conversion(page, mode, unit, value) {
  await page.locator(`label[for="conversion_mode-${mode}"]`).click();
  await page.locator("#input_value").fill(value);
  await page.locator(`#${mode}_unit`).selectOption(unit);
}
async function ctInputs(page, age = "adult", region = "head", phantom = "16") {
  await page.locator('label[for="include_ct_dose"]').click();
  await page.locator("#ctdi_vol").fill("10");
  await page.locator("#scan_length").fill("10");
  await page.locator("#patient_age").selectOption(age);
  await page.locator("#body_region").selectOption(region);
  await page.locator("#ct_phantom").selectOption(phantom);
}
test.beforeEach(async ({ page }) => {
  await page.goto("/#/radiation-dose-converter");
  await expect(page.getByTestId("calculator-title").first()).toHaveText("Radiation Dose Converter");
});
const unitCases = [
  ["absorbed", "Gy", "1", "1 Gy"], ["absorbed", "mGy", "1000", "1 Gy"],
  ["absorbed", "cGy", "100", "1 Gy"], ["absorbed", "rad", "100", "1 Gy"],
  ["equivalent", "Sv", "1", "1 Sv"], ["equivalent", "mSv", "1000", "1 Sv"],
  ["equivalent", "uSv", "1000000", "1 Sv"], ["equivalent", "rem", "100", "1 Sv"],
  ["equivalent", "mrem", "100000", "1 Sv"],
  ["activity", "Bq", "37000000000", "37 GBq"], ["activity", "kBq", "37000000", "37 GBq"],
  ["activity", "MBq", "37000", "37 GBq"], ["activity", "GBq", "37", "37 GBq"],
  ["activity", "Ci", "1", "37 GBq"], ["activity", "mCi", "1000", "37 GBq"],
  ["activity", "uCi", "1000000", "37 GBq"],
];
for (const [mode, unit, value, expected] of unitCases) {
  test(`NIST conversion from ${unit} preserves the physical quantity`, async ({ page }) => {
    await conversion(page, mode, unit, value);
    await calculate(page);
    await expect(report(page).getByText(expected, { exact: true })).toBeVisible();
    await expect(report(page)).not.toContainText(/Infinity|NaN|Below typical|Exceeds annual/);
  });
}
test("invalid, blank and overflow values clear old output and recover, including explicit zero", async ({ page }) => {
  await conversion(page, "absorbed", "Gy", "1");
  await calculate(page);
  for (const value of ["", "-1", "1e308"]) {
    await page.locator("#input_value").fill(value);
    await expect(report(page)).not.toBeVisible();
    await calculate(page);
    await expect(report(page).getByRole("alert")).toBeVisible();
    await expect(report(page)).not.toContainText("1000 mGy");
    await expect(page.getByRole("button", { name: "Copy results", exact: true })).not.toBeVisible();
    await page.locator("#input_value").fill("1");
    await calculate(page);
    await expect(report(page).getByText("1000 mGy", { exact: true })).toBeVisible();
  }
  await page.locator("#input_value").fill("0");
  await calculate(page);
  await expect(report(page).getByText("0 Gy", { exact: true })).toBeVisible();
});
test("no calculation selected produces an actionable error rather than reference-table success", async ({ page }) => {
  await calculate(page);
  await expect(report(page).getByRole("alert")).toBeVisible();
  await expect(report(page)).not.toContainText("Common Reference Doses");
});
test("organ inverse requires confirmation and neutron energy; disabling clears derived output", async ({ page }) => {
  await conversion(page, "equivalent", "Sv", "1");
  await expect(page.locator("#radiation_type")).not.toBeVisible();
  await page.locator('label[for="input_is_organ_equivalent"]').click();
  await page.locator("#radiation_type").selectOption("alpha");
  await calculate(page);
  await expect(report(page).getByText("0.05 Gy", { exact: true })).toBeVisible();
  await page.locator("#radiation_type").selectOption("neutron");
  await expect(report(page)).not.toBeVisible();
  await calculate(page);
  await expect(report(page).getByRole("alert")).toBeVisible();
  await page.locator("#neutron_energy_mev").fill("1");
  await calculate(page);
  await expect(report(page)).toContainText("20.691793");
  await expect(report(page)).toContainText("one radiation type");
  await page.locator('label[for="input_is_organ_equivalent"]').click();
  await expect(page.locator("#neutron_energy_mev")).not.toBeVisible();
  await calculate(page);
  await expect(report(page)).not.toContainText("Corresponding Absorbed Dose");
  await expect(report(page).getByText("1 Sv", { exact: true })).toBeVisible();
});
for (const [age, region, phantom, expected] of [
  ["0yr", "head", "16", "1.1 mSv"], ["5yr", "abdomen", "16", "2 mSv"],
  ["10yr", "chest", "16", "1.3 mSv"], ["adult", "chest", "32", "1.4 mSv"],
]) {
  test(`CT reference ${age}/${region}/${phantom} uses source-specific factor`, async ({ page }) => {
    await ctInputs(page, age, region, phantom);
    await calculate(page);
    await expect(report(page).getByText("100.0 mGy·cm", { exact: true })).toBeVisible();
    await expect(report(page).getByText(expected, { exact: true })).toBeVisible();
    await expect(report(page)).toContainText("AAPM Report 96");
    await expect(report(page)).not.toContainText(/Age Adjustment|Typical Range|Equivalent Chest X-rays/);
  });
}
test("phantom uncertainty withholds E, preserves DLP and recovers without stale estimate", async ({ page }) => {
  await ctInputs(page, "0yr");
  await calculate(page);
  await expect(report(page).getByText("1.1 mSv", { exact: true })).toBeVisible();
  for (const basis of ["32", "unknown"]) {
    await page.locator("#ct_phantom").selectOption(basis);
    await expect(report(page)).not.toBeVisible();
    await calculate(page);
    await expect(report(page)).toContainText("estimate withheld");
    await expect(report(page)).not.toContainText("Estimated Effective Dose");
    await expect(report(page)).toContainText("100.0 mGy·cm");
  }
  await page.locator("#ct_phantom").selectOption("16");
  await calculate(page);
  await expect(report(page).getByText("1.1 mSv", { exact: true })).toBeVisible();
});
test("mixed selected operations fail atomically and recover", async ({ page }) => {
  await conversion(page, "equivalent", "mSv", "5");
  await ctInputs(page);
  await page.locator("#ctdi_vol").fill("");
  await calculate(page);
  await expect(report(page).getByRole("alert")).toBeVisible();
  await expect(report(page)).not.toContainText("0.005 Sv");
  await page.locator("#ctdi_vol").fill("10");
  await calculate(page);
  await expect(report(page).getByText("0.005 Sv", { exact: true })).toBeVisible();
  await expect(report(page).getByText("0.21 mSv", { exact: true })).toBeVisible();
});
test("copy contains calculated values and clinical limitations; print media retains the report", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await ctInputs(page, "0yr");
  await calculate(page);
  await page.getByRole("button", { name: "Copy results", exact: true }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("1.1 mSv");
  expect(copied).toContain("AAPM96");
  expect(copied).toContain("phantom");
  await page.emulateMedia({ media: "print" });
  await expect(report(page)).toBeVisible();
  await expect(report(page).getByText("1.1 mSv", { exact: true })).toBeVisible();
});
test("mobile keyboard calculation, reference links and layout remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await conversion(page, "activity", "MBq", "185");
  await page.getByRole("button", { name: "Calculate", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(report(page)).toContainText("5 mCi");
  await expect(report(page)).toContainText("Activity alone");
  await expect(page.locator('a[href*="nist.gov"]').first()).toBeVisible();
  await expect(page.locator('a[href*="PUB1987_web.pdf"]').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test.describe("CT report on a fresh mobile viewport", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("retains every report value within the report bounds", async ({ page }, testInfo) => {
    await ctInputs(page, "0yr");
    await calculate(page);
    await expect.poll(() => report(page).evaluate((node) => {
      const bounds = node.getBoundingClientRect();
      return [...node.querySelectorAll("span")].filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.right > bounds.right + 1 || rect.left < bounds.left - 1 || element.scrollWidth > element.clientWidth + 1;
      }).map((element) => element.textContent);
    })).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("mobile-ct-report.png"), fullPage: true });
  });
});
