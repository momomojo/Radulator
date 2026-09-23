import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { navigateToCalculator } from "../../../helpers/calculator-test-helper.js";

const report = page => page.locator('div[role="status"][aria-atomic="false"]');
const download = page => page.getByRole("button", { name: "Download Results as CSV", exact: true });
const calculate = page => page.getByRole("button", { name: "Calculate", exact: true }).click();

async function fillProtocol(page, prefix) {
  for (const [name, value] of [
    [`${prefix} infrarenal IVC aldosterone`, "10"],
    [`${prefix} infrarenal IVC cortisol`, "10"],
    [`${prefix} Left Adrenal Vein sample 1 aldosterone`, "1000"],
    [`${prefix} Left Adrenal Vein sample 1 cortisol`, "100"],
    [`${prefix} Right Adrenal Vein sample 1 aldosterone`, "100"],
    [`${prefix} Right Adrenal Vein sample 1 cortisol`, "100"],
  ]) await page.getByRole("spinbutton", { name, exact: true }).fill(value);
}

test.describe("AVS aldosterone current-input report ownership", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, "Adrenal Vein Sampling – Aldosterone");
  });

  for (const mode of ["pre", "post", "both"]) {
    test(`${mode}: measurement edits withdraw old report and CSV until recalculated`, async ({ page }) => {
      await page.locator(`input[name="avs-aldo-protocol"][value="${mode}"]`).check();
      const prefixes = mode === "both" ? ["Pre", "Post"] : [mode === "pre" ? "Pre" : "Post"];
      for (const prefix of prefixes) await fillProtocol(page, prefix);
      await calculate(page);
      await expect(report(page)).toBeVisible();
      await expect(report(page)).toContainText(/LI:\s*10\.00/);
      await expect(download(page)).toBeVisible();
      for (const prefix of prefixes) {
        await page.getByRole("spinbutton", { name: `${prefix} Right Adrenal Vein sample 1 aldosterone`, exact: true }).fill("200");
        await expect(report(page)).toHaveCount(0);
        await expect(download(page)).toHaveCount(0);
        await calculate(page);
        await expect(report(page)).toBeVisible();
        await expect(report(page)).toContainText(/LI:\s*5\.00/);
        await expect(download(page)).toBeVisible();
      }
    });
  }

  const edits = {
    "peripheral concentration": page => page.getByRole("spinbutton", { name: "Post infrarenal IVC cortisol", exact: true }).fill("20"),
    "aldosterone units": page => page.getByLabel("Aldosterone Units", { exact: true }).selectOption("pg/mL"),
    "cortisol units": page => page.getByLabel("Cortisol Units", { exact: true }).selectOption("nmol/L"),
    "protocol": page => page.getByLabel("Both (comparison view)", { exact: true }).check(),
    "initials": page => page.getByLabel("Patient Initials", { exact: true }).fill("SYNTHETIC"),
    "procedure date": page => page.getByLabel("Date of Procedure", { exact: true }).fill("2026-09-08"),
    "nodule side": page => page.getByLabel("Side of Nodule", { exact: true }).selectOption("Left"),
    "notes": page => page.getByLabel("Notes (e.g., microcatheter used)", { exact: true }).fill("Synthetic test only"),
    "sample time": page => page.getByLabel("Post Left Adrenal Vein sample 1 time", { exact: true }).fill("10:00"),
    "sample addition": page => page.getByRole("button", { name: "Add Post Left Adrenal Vein sample", exact: true }).click(),
    "sample removal": page => page.getByRole("button", { name: "Remove Post Left Adrenal Vein sample 2", exact: true }).click(),
  };
  for (const [kind, edit] of Object.entries(edits)) {
    test(`${kind} cannot leave old results exportable`, async ({ page }) => {
      await fillProtocol(page, "Post");
      if (kind === "sample removal") await page.getByRole("button", { name: "Add Post Left Adrenal Vein sample", exact: true }).click();
      await calculate(page);
      await expect(download(page)).toBeVisible();
      await edit(page);
      await expect(report(page)).toHaveCount(0);
      await expect(download(page)).toHaveCount(0);
    });
  }

  test("focusing an unchanged field preserves the current report", async ({ page }) => {
    await fillProtocol(page, "Post");
    await calculate(page);
    await page.getByLabel("Patient Initials", { exact: true }).focus();
    await expect(report(page)).toBeVisible();
    await expect(download(page)).toBeVisible();
  });

  for (const mode of ["pre", "post", "both"]) {
    test(`${mode}: sample structure changes withdraw report without losing values`, async ({ page }) => {
      await page.locator(`input[name="avs-aldo-protocol"][value="${mode}"]`).check();
      const prefixes = mode === "both" ? ["Pre", "Post"] : [mode === "pre" ? "Pre" : "Post"];
      for (const prefix of prefixes) await fillProtocol(page, prefix);
      await calculate(page);
      for (const prefix of prefixes) for (const side of ["Left", "Right"]) {
        const label = `${prefix} ${side} Adrenal Vein`;
        await expect(page.getByRole("button", { name: `Remove ${label} sample 1`, exact: true })).toBeDisabled();
        await expect(download(page)).toBeVisible();
        await page.getByRole("button", { name: `Add ${label} sample`, exact: true }).click();
        await expect(report(page)).toHaveCount(0);
        await expect(download(page)).toHaveCount(0);
        await expect(page.getByLabel(`${label} sample 1 cortisol`, { exact: true })).toHaveValue("100");
        await page.getByLabel(`${label} sample 2 cortisol`, { exact: true }).fill("100");
        await page.getByLabel(`${label} sample 2 aldosterone`, { exact: true }).fill(side === "Left" ? "1000" : "100");
        await calculate(page);
        await expect(download(page)).toBeVisible();
        await page.getByRole("button", { name: `Remove ${label} sample 2`, exact: true }).click();
        await expect(report(page)).toHaveCount(0);
        await expect(download(page)).toHaveCount(0);
        await expect(page.getByLabel(`${label} sample 1 cortisol`, { exact: true })).toHaveValue("100");
        await calculate(page);
        await expect(report(page)).toContainText(/LI:\s*10\.00/);
      }
    });
  }

  test("downloaded CSV reflects recalculated inputs and downloading preserves the report", async ({ page }) => {
    await fillProtocol(page, "Post");
    await calculate(page);
    await page.getByLabel("Post Right Adrenal Vein sample 1 aldosterone", { exact: true }).fill("200");
    await expect(download(page)).toHaveCount(0);
    await calculate(page);
    const pending = page.waitForEvent("download");
    await download(page).click();
    const csv = await readFile(await (await pending).path(), "utf8");
    expect(csv).toContain("Right AV 1,—,200.00,100.00");
    expect(csv).toContain("Lateralization Index (LI):,5.00,");
    expect(csv).not.toContain("Lateralization Index (LI):,10.00,");
    await expect(report(page)).toBeVisible();
    await expect(download(page)).toBeVisible();
  });

  test("each concentration field labels the units actually selected for calculation", async ({ page }) => {
    await page.getByLabel("Both (comparison view)", { exact: true }).check();
    await page.getByLabel("Aldosterone Units", { exact: true }).selectOption("pg/mL");
    await page.getByLabel("Cortisol Units", { exact: true }).selectOption("nmol/L");
    for (const input of await page.getByRole("spinbutton").all()) {
      const name = await input.getAttribute("aria-label");
      const units = name.endsWith("cortisol") ? "nmol/L" : "pg/mL";
      await expect(input.locator("..")).toContainText(`(${units})`);
    }
    for (const prefix of ["Pre", "Post"]) for (const [name, value] of [
      [`${prefix} infrarenal IVC aldosterone`, "100"],
      [`${prefix} infrarenal IVC cortisol`, "275.9"],
      [`${prefix} Left Adrenal Vein sample 1 aldosterone`, "10000"],
      [`${prefix} Left Adrenal Vein sample 1 cortisol`, "2759"],
      [`${prefix} Right Adrenal Vein sample 1 aldosterone`, "1000"],
      [`${prefix} Right Adrenal Vein sample 1 cortisol`, "2759"],
    ]) await page.getByRole("spinbutton", { name, exact: true }).fill(value);
    await calculate(page);
    await expect(report(page).locator("p").filter({ hasText: /^LI:\s*10\.00/ })).toHaveCount(2);
    const pending = page.waitForEvent("download");
    await download(page).click();
    const csv = await readFile(await (await pending).path(), "utf8");
    expect(csv).toContain("Left AV 1,—,10000.00,2759.00");
    expect(csv).toContain("Right AV 1,—,1000.00,2759.00");
    expect(csv).toContain("Left SI:,10.00,");
    expect(csv).toContain("Right SI:,10.00,");
  });

  test.describe("mobile report recovery", () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test("keyboard recalculation uses edited values and stays within the viewport", async ({ page }, testInfo) => {
      await fillProtocol(page, "Post");
      const button = page.getByRole("button", { name: "Calculate", exact: true });
      await button.focus();
      await page.keyboard.press("Enter");
      await expect(report(page)).toContainText(/LI:\s*10\.00/);
      await page.getByLabel("Post Right Adrenal Vein sample 1 aldosterone", { exact: true }).fill("200");
      await expect(download(page)).toHaveCount(0);
      await button.focus();
      await page.keyboard.press("Enter");
      await expect(report(page)).toContainText(/LI:\s*5\.00/);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await report(page).screenshot({ path: testInfo.outputPath("avs-aldo-mobile-report.png") });
    });
  });
});
