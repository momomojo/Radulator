import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PATHS,
  ROOT,
  generate,
  readCalculators,
} from "../../scripts/generate-guideline-finder.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const calculators = readCalculators(projectRoot);

test.describe("Guideline Finder", () => {
  test("the committed page matches the guideline registry and reviewed notices", () => {
    // A registry or notice change without regenerating the page must fail here.
    const committed = fs.readFileSync(path.join(ROOT, PATHS.output), "utf8");
    expect(committed, "run node scripts/generate-guideline-finder.mjs").toBe(generate(ROOT));
  });

  test("lists every calculator, searches locally and makes no third-party requests", async ({ page }) => {
    const origin = new URL(test.info().project.use.baseURL || "http://localhost").origin;
    const external = [];
    page.on("request", (request) => {
      if (new URL(request.url()).origin !== origin) external.push(request.url());
    });
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.goto("/guidelines.html");
    await expect(page.getByRole("heading", { level: 1, name: "Guideline Finder" })).toBeVisible();
    const cards = page.locator("[data-gf-card]");
    await expect(cards).toHaveCount(calculators.length);

    // The hash-pinned script ran under the page's CSP: the search controls are shown.
    const search = page.getByRole("searchbox", { name: "Search guidelines" });
    await expect(search).toBeVisible();
    await expect(page.locator("#gf-count")).toHaveText(`Showing all ${calculators.length}`);

    await search.fill("ti-rads");
    await expect(page.locator("[data-gf-card]:not([hidden])")).toHaveCount(1);
    await expect(page.locator("#tirads")).toBeVisible();
    await expect(page.locator("#gf-count")).toHaveText(`Showing 1 of ${calculators.length}`);

    // Topic words from the calculator's own description and keywords are searchable, and every
    // term must match: "trauma spleen" finds the AAST organ injury scales.
    await search.fill("trauma spleen");
    await expect(page.locator("[data-gf-card]:not([hidden])")).toHaveCount(1);
    await expect(page.locator("#aast-trauma-grading")).toBeVisible();

    // The specialty filter narrows further.
    await search.fill("");
    await page.getByRole("combobox", { name: "Filter by specialty" }).selectOption("Nephrology");
    const nephrology = calculators.filter((calculator) => calculator.category === "Nephrology").length;
    await expect(page.locator("[data-gf-card]:not([hidden])")).toHaveCount(nephrology);

    // Official sources open in a new tab without leaking the opener or referrer.
    const official = page.locator(".sources a").first();
    await expect(official).toHaveAttribute("target", "_blank");
    await expect(official).toHaveAttribute("rel", "noopener noreferrer");

    // Each entry links back to its calculator.
    await expect(page.locator("#tirads h3 a")).toHaveAttribute("href", "/#/tirads");

    expect(external, "the Finder must not contact third parties").toEqual([]);
    expect(consoleErrors.filter((text) => /Content Security Policy|CSP/i.test(text))).toEqual([]);
  });

  test("works without JavaScript: every entry is readable", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/guidelines.html");
    await expect(page.locator("[data-gf-card]")).toHaveCount(calculators.length);
    await expect(page.locator(".gf-controls")).toBeHidden();
    await context.close();
  });

  test("is linked from the app footer", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("footer-guidelines-link")).toHaveAttribute("href", "/guidelines.html");
  });
});
