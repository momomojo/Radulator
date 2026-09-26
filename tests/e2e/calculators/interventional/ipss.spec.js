import { test, expect } from "@playwright/test";
import { navigateToCalculator } from "../../../helpers/calculator-test-helper.js";

const results = page => page.getByRole("status", { name: "Calculator results" });
const rows = page => page.locator('[aria-label="Post-CRH Sample Table"] .grid.items-center');
async function basal(page, values = {}) {
  for (const [id, value] of Object.entries({ basalLeftACTH:"100", basalRightACTH:"50", basalPeriphACTH:"20", basalLeftPRL:"30", basalRightPRL:"30", basalPeriphPRL:"10", ...values })) {
    await page.locator("#" + id).fill(value);
  }
}
async function sample(page, values, index = 0) {
  const inputs = rows(page).nth(index).locator("input");
  for (const [i, value] of values.entries()) await inputs.nth(i).fill(value);
}
async function calculate(page) {
  await page.getByRole("button", { name:"Calculate", exact:true }).click();
}
test.describe("IPSS reviewed sampling workflow", () => {
  test.beforeEach(async ({page}) => {
    await navigateToCalculator(page, "Inferior Petrosal Sinus Sampling (IPSS)");
  });
  test("basal-only calculation ignores the empty default stimulated row", async ({page}) => {
    await basal(page); await calculate(page);
    await expect(page).toHaveURL(/#\/ipss$/);
    await expect(results(page)).toContainText("5.00");
    await expect(results(page)).toContainText("2.50");
    await expect(results(page)).not.toContainText("Peak Time Point");
    await expect(results(page)).not.toContainText("95-97%");
    await expect(results(page)).not.toContainText("surgery indicated");
  });
  test("sample-entry help explains units and optional PRL without surgical-side claims", async ({page}) => {
    const table = page.getByLabel("Post-CRH Sample Table", {exact:true});
    await expect(table).toContainText("ACTH in pg/mL");
    await expect(table).toContainText("prolactin in ng/mL");
    await expect(table).toContainText("same units");
    await expect(table).not.toContainText("improve lateralization accuracy");
  });
  test("sample columns align with their headers and all seven values fit the print width", async ({page}) => {
    const table = page.getByLabel("Post-CRH Sample Table", {exact:true});
    const headers = table.locator(".grid.font-medium > div");
    const inputs = rows(page).first().locator("input");
    for (let i=0;i<7;i++) {
      const header = await headers.nth(i).boundingBox();
      const input = await inputs.nth(i).boundingBox();
      expect(Math.abs(header.x-input.x)).toBeLessThan(2);
    }
    await sample(page,["3","200","100","20","60","30","10"]);
    await page.setViewportSize({width:800,height:1000});
    await page.emulateMedia({media:"print"});
    const parent = await table.boundingBox();
    for (let i=0;i<7;i++) {
      const input = await inputs.nth(i).boundingBox();
      expect(input.x).toBeGreaterThanOrEqual(parent.x);
      expect(input.x+input.width).toBeLessThanOrEqual(parent.x+parent.width+1);
    }
  });
  test("separate normalization methods retain their measured denominators in actual copy", async ({page,context}) => {
    await basal(page);
    await sample(page, ["3","200","100","20","60","30","10"]);
    await calculate(page);
    await expect(results(page)).toContainText("3.3333");
    await expect(results(page)).toContainText("1.6667");
    await expect(results(page)).toContainText("LEFT IPS at +3");
    await expect(results(page)).not.toContainText("Strong lateralization");
    await context.grantPermissions(["clipboard-read","clipboard-write"]);
    await page.getByRole("button",{name:"Copy results",exact:true}).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain("Basal PRL-normalized");
    expect(copied).toContain("Concurrent PRL-normalized");
    expect(copied).toContain("3.3333");
    expect(copied).toContain("1.6667");
    expect(copied).toContain("does not prescribe treatment");
  });
  test("absent prolactin preserves ACTH and reports unavailable normalization", async ({page}) => {
    await basal(page,{basalLeftPRL:"",basalRightPRL:"",basalPeriphPRL:""});
    await sample(page,["3","200","100","20"]);
    await calculate(page);
    await expect(results(page)).toContainText("10.00");
    await expect(results(page)).toContainText("Not available: required prolactin");
    await expect(results(page)).not.toContainText("NaN");
  });
  test("partial prolactin is rejected and recovery restores the methods", async ({page}) => {
    await basal(page);
    await sample(page,["3","200","100","20","60","","10"]);
    await calculate(page);
    await expect(results(page)).toContainText("row 1");
    await expect(results(page)).not.toContainText("Localization Pattern");
    await sample(page,["3","200","100","20","60","30","10"]);
    await calculate(page);
    await expect(results(page)).toContainText("1.6667");
  });
  test("invalid denominator clears the old result and copy action", async ({page}) => {
    await basal(page); await calculate(page);
    await page.locator("#basalPeriphACTH").fill("0");
    await expect(results(page)).toHaveCount(0);
    await calculate(page);
    await expect(results(page)).toContainText("finite positive");
    await expect(page.getByRole("button",{name:"Copy results",exact:true})).toHaveCount(0);
    await page.locator("#basalPeriphACTH").fill("20");
    await calculate(page);
    await expect(results(page)).toContainText("5.00");
  });
  test("low prolactin warns without suppressing ACTH results", async ({page}) => {
    await basal(page,{basalLeftPRL:"10",basalRightPRL:"10"});
    await calculate(page);
    await expect(results(page)).toContainText("Sampling caution");
    await expect(results(page)).toContainText("5.00");
    await expect(results(page)).not.toContainText("BOTH SIDES FAILED");
  });
  test("inclusive basal and stimulated boundaries use unrounded values", async ({page}) => {
    await basal(page,{basalLeftACTH:"40",basalRightACTH:"20",basalLeftPRL:"18",basalRightPRL:"18"});
    await calculate(page);
    await expect(results(page)).toContainText("Basal ratio ≥2");
    await expect(results(page)).toContainText("support adequate");
    await page.locator("#basalLeftACTH").fill("39.99");
    await sample(page,["3","60","20","20"]);
    await calculate(page);
    await expect(results(page)).toContainText("Peak post-CRH ratio ≥3");
  });
  test("negative basal-only pattern does not establish an ectopic source", async ({page}) => {
    await basal(page,{basalLeftACTH:"20",basalRightACTH:"20"});
    await calculate(page);
    await expect(results(page)).toContainText("basal-only result does not establish an ectopic source");
    await expect(results(page)).not.toContainText("ECTOPIC ACTH SYNDROME");
  });
  test("partial stimulated row cannot masquerade as an absent sample", async ({page}) => {
    await basal(page);
    await sample(page,["3","200"]);
    await calculate(page);
    await expect(results(page)).toContainText("row 1");
    await sample(page,["3","200","100","20"]);
    await calculate(page);
    await expect(results(page)).toContainText("10.00");
  });
  test("peak selection uses the unadjusted ratio across added rows", async ({page}) => {
    await basal(page);
    await sample(page,["3","100","80","20","10","10","10"]);
    await page.getByRole("button",{name:"Add Sample Time Point"}).click();
    await sample(page,["6","200","100","20","60","30","10"],1);
    await calculate(page);
    await expect(results(page)).toContainText("LEFT IPS at +6");
    await expect(results(page)).toContainText("1.6667");
    await rows(page).nth(1).getByRole("button",{name:"Remove"}).click();
    await expect(results(page)).toHaveCount(0);
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first().getByRole("button",{name:"Remove"})).toBeDisabled();
  });
  test("tied peaks expose ambiguity instead of arbitrarily choosing a side", async ({page}) => {
    await basal(page);
    await sample(page,["3","200","200","20","60","30","10"]);
    await calculate(page);
    await expect(results(page)).toContainText("Tied dominant");
    await expect(results(page)).not.toContainText("Basal PRL-normalized peak ACTH ratio");
  });
  test("scope, references, keyboard and mobile print layout remain usable", async ({page}) => {
    await expect(page.getByTestId("calculator-info")).toContainText("Prolactin is optional");
    await page.getByRole("button",{name:/Show .* more references/}).click();
    await expect(page.locator('a[href="https://doi.org/10.1161/SVIN.125.002309"]')).toBeVisible();
    await expect(page.locator('a[href="https://doi.org/10.1210/jc.2011-2149"]')).toBeVisible();
    await basal(page);
    await page.locator("#basalLeftACTH").focus();
    await page.keyboard.press("Tab");
    await expect(page.locator("#basalRightACTH")).toBeFocused();
    await calculate(page);
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.emulateMedia({media:"print"});
    await expect(results(page)).toBeVisible();
    await expect(results(page)).toContainText("Surgical Limitation");
    await expect(page.getByRole("button",{name:"Print Results",exact:true})).toBeHidden();
  });
});
