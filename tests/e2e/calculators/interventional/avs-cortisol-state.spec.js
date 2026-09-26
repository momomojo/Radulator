import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { navigateToCalculator } from "../../../helpers/calculator-test-helper.js";

const report = page => page.locator('div[role="status"][aria-atomic="false"]');
const download = page => page.getByRole("button", { name: "Download Results as CSV", exact: true });
const calculate = page => page.getByRole("button", { name: "Calculate", exact: true }).click();

test.describe("AVS cortisol current-input report ownership", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, "Adrenal Vein Sampling – Cortisol");
    for (const [name, value] of [
      ["Infrarenal IVC cortisol", "10"], ["Infrarenal IVC epinephrine", "100"],
      ["Left adrenal vein sample 1 cortisol", "100"], ["Left adrenal vein sample 1 epinephrine", "1000"],
      ["Right adrenal vein sample 1 cortisol", "20"], ["Right adrenal vein sample 1 epinephrine", "1000"],
    ]) await page.getByRole("spinbutton", { name, exact: true }).fill(value);
  });

  const edits = {
    "peripheral cortisol": page => page.getByLabel("Infrarenal IVC cortisol", { exact: true }).fill("20"),
    "peripheral epinephrine": page => page.getByLabel("Infrarenal IVC epinephrine", { exact: true }).fill("200"),
    "adrenal cortisol": page => page.getByLabel("Right adrenal vein sample 1 cortisol", { exact: true }).fill("200"),
    "adrenal epinephrine": page => page.getByLabel("Left adrenal vein sample 1 epinephrine", { exact: true }).fill("2000"),
    "cortisol units": page => page.getByLabel("Cortisol Units", { exact: true }).selectOption("nmol/L"),
    "initials": page => page.getByLabel("Patient Initials", { exact: true }).fill("SYNTHETIC"),
    "procedure date": page => page.getByLabel("Date of Procedure", { exact: true }).fill("2026-09-08"),
    "nodule side": page => page.getByLabel("Side of Nodule", { exact: true }).selectOption("Left"),
    "sample time": page => page.getByLabel("Left adrenal vein sample 1 time drawn", { exact: true }).fill("10:00"),
  };
  for (const [name, edit] of Object.entries(edits)) test(`${name} withdraws old report and export`, async ({ page }) => {
    await calculate(page);
    await expect(download(page)).toBeVisible();
    await edit(page);
    await expect(report(page)).toHaveCount(0);
    await expect(download(page)).toHaveCount(0);
  });

  for (const side of ["Left", "Right"]) for (const action of ["add", "remove"]) {
    test(`${side} sample ${action} withdraws report and preserves remaining inputs`, async ({ page }) => {
      const add = page.getByRole("button", { name: `+ Add ${side} Sample`, exact: true });
      if (action === "remove") await add.click();
      await calculate(page);
      await expect(download(page)).toBeVisible();
      if (action === "add") await add.click();
      else await page.getByRole("button", { name: `Remove ${side.toLowerCase()} adrenal vein sample 2`, exact: true }).click();
      await expect(report(page)).toHaveCount(0);
      await expect(download(page)).toHaveCount(0);
      await expect(page.getByLabel(`${side} adrenal vein sample 1 cortisol`, { exact: true })).toHaveValue(side === "Left" ? "100" : "20");
    });
  }

  test("recalculation and actual CSV use the edited concentrations", async ({ page }) => {
    await calculate(page);
    await expect(report(page)).toContainText(/CLR \(Side-to-side Ratio\):\s*5\.000/);
    await page.getByLabel("Right adrenal vein sample 1 cortisol", { exact: true }).fill("200");
    await expect(download(page)).toHaveCount(0);
    await calculate(page);
    await expect(report(page)).toContainText(/CLR \(Side-to-side Ratio\):\s*2\.000/);
    const pending = page.waitForEvent("download");
    await download(page).click();
    const csv = await readFile(await (await pending).path(), "utf8");
    expect(csv).toContain("Right AV/PV Ratio:,20.000");
    expect(csv).toContain("Side-to-side Cortisol Lateralization Ratio (CLR):,2.000");
    await page.getByLabel("Patient Initials", { exact: true }).focus();
    await expect(report(page)).toBeVisible();
    await expect(download(page)).toBeVisible();
  });

  test.describe("mobile report recovery", () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test("keyboard recalculation replaces the stale ratio without horizontal overflow", async ({ page }, testInfo) => {
      const button = page.getByRole("button", { name: "Calculate", exact: true });
      await button.focus();
      await page.keyboard.press("Enter");
      await expect(report(page)).toContainText(/CLR \(Side-to-side Ratio\):\s*5\.000/);
      await page.getByLabel("Right adrenal vein sample 1 cortisol", { exact: true }).fill("200");
      await expect(report(page)).toHaveCount(0);
      await button.focus();
      await page.keyboard.press("Enter");
      await expect(report(page)).toContainText(/CLR \(Side-to-side Ratio\):\s*2\.000/);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await report(page).screenshot({ path: testInfo.outputPath("avs-cortisol-mobile-report.png") });
    });
  });
});
