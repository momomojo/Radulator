import { test, expect } from "@playwright/test";
import { navigateToCalculator } from "../../../helpers/calculator-test-helper.js";

test.describe("RECIST 1.1 calculator", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test.beforeEach(async ({ page }) => {
    // The shared helper opens /#/recist-1-1 and waits for the title; using it
    // also registers this spec with scripts/spec-map.js coverage.
    await navigateToCalculator(page, "RECIST 1.1 Tumor Response");
  });

  test("classifies the exact PR boundary and copies the complete measurable-disease impression", async ({
    page,
  }) => {
    await page.locator("#target-1-organ").selectOption("liver");
    await page.locator("#target-1-baseline").fill("100");
    await page.locator("#target-1-current").fill("70");
    await page.locator("#prior-nadir").fill("100");

    await page
      .getByRole("button", {
        name: "Calculate RECIST 1.1 time-point response",
      })
      .click();

    const results = page.getByTestId("recist-results");
    await expect(results).toContainText("Partial Response (PR)");
    await expect(results).toContainText("Current target sum");
    await expect(results).toContainText("70 mm");
    await expect(results).toContainText("100 mm (-30.0%)");
    await expect(results).toContainText("100 mm (-30.0%; -30 mm)");
    await expect(results).toContainText("Lesion 1 (Liver; non-nodal)");

    const impression = page.getByTestId("recist-impression");
    await expect(impression).toContainText(
      "RECIST 1.1 time-point response: Partial Response (PR)",
    );
    await expect(impression).toContainText(
      "Target-lesion sum 70 mm (-30.0% vs baseline 100 mm; -30.0% / -30 mm vs prior nadir 100 mm)",
    );

    await page.getByRole("button", { name: "Copy impression" }).click();
    await expect(
      page.getByText("RECIST impression copied to clipboard."),
    ).toBeAttached();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toContain("RECIST 1.1 time-point response: Partial Response (PR)");
  });

  // EORTC's RECIST 1.1 clarifications count both lungs (and other paired organs) as one organ, and all
  // lymph nodes as one organ; the organ is chosen from a list, never typed (primary judge on #277).
  test("counts both lungs as one organ and all lymph nodes as one organ", async ({ page }) => {
    await page.getByRole("button", { name: "Add target lesion (1/5)" }).click();
    await page.getByRole("button", { name: "Add target lesion (2/5)" }).click();
    for (const index of [1, 2, 3]) {
      await page.locator(`#target-${index}-organ`).selectOption("lung");
      await page.locator(`#target-${index}-baseline`).fill("20");
      await page.locator(`#target-${index}-current`).fill("20");
    }
    await page.locator("#prior-nadir").fill("60");
    const calculate = page.getByRole("button", {
      name: "Calculate RECIST 1.1 time-point response",
    });
    await calculate.click();
    const validationAlert = page
      .getByRole("alert")
      .filter({ hasText: "Resolve the following before classification" });
    await expect(validationAlert).toContainText(
      "paired organs such as both lungs or both kidneys count as one organ",
    );

    // Three nodal targets: all nodes are one organ, whatever the organ chosen before switching.
    for (const index of [1, 2, 3]) {
      await page.locator(`#target-${index}-kind`).selectOption("node");
      await expect(page.locator(`#target-${index}-organ`)).toHaveText(
        "Lymph nodes (all nodes count as one organ)",
      );
    }
    await calculate.click();
    await expect(validationAlert).toContainText(
      "RECIST 1.1 counts all lymph nodes as one organ: at most two nodal target lesions.",
    );

    // Two nodes and one lung target are allowed.
    await page.locator("#target-3-kind").selectOption("non_nodal");
    await page.locator("#target-3-organ").selectOption("lung");
    await calculate.click();
    const results = page.getByTestId("recist-results");
    await expect(results).toContainText("Lesion 1 (Lymph nodes; node)");
    await expect(results).toContainText("Lesion 3 (Lung; non-nodal)");
  });

  // A missing target measurement: the measured subset is a lower bound, and the copied impression says so
  // and why it already proves progression (primary judge on #277).
  test("copies an incomplete measured subset as a lower bound that proves PD", async ({ page }) => {
    await page.getByRole("button", { name: "Add target lesion (1/5)" }).click();
    await page.locator("#target-1-organ").selectOption("liver");
    await page.locator("#target-1-baseline").fill("50");
    await page.locator("#target-1-current").fill("25");
    await page.locator("#target-2-organ").selectOption("lung");
    await page.locator("#target-2-baseline").fill("50");
    await page.locator("#target-2-current-status").selectOption("missing");
    await page.locator("#prior-nadir").fill("20");
    await page
      .getByRole("button", {
        name: "Calculate RECIST 1.1 time-point response",
      })
      .click();

    const results = page.getByTestId("recist-results");
    await expect(results).toContainText("Progressive Disease (PD)");
    await expect(results).toContainText("Measured target subset (lower bound; 1 missing)");
    await expect(results).toContainText("100 mm (no percentage: the current sum is incomplete)");
    await expect(results).not.toContainText("Current target sum");

    const impression = page.getByTestId("recist-impression");
    await expect(impression).toContainText(
      "Target-lesion sum incomplete: 1 target measurement is missing.",
    );
    await expect(impression).toContainText(
      "The measured targets alone sum to 25 mm, a lower bound for the full sum",
    );
    await expect(impression).toContainText("so the missing measurement cannot change it");
    await expect(impression).not.toContainText("vs baseline");

    await page.getByRole("button", { name: "Copy impression" }).click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toContain("a lower bound for the full sum");
  });

  test("uses the non-target-only copy template without target arithmetic", async ({
    page,
  }) => {
    await page.locator("#recist-mode").selectOption("non_target_only");
    await page
      .getByRole("button", {
        name: "Calculate RECIST 1.1 time-point response",
      })
      .click();

    const results = page.getByTestId("recist-results");
    await expect(results).toContainText("Non-CR/non-PD");
    await expect(results).not.toContainText("Target response");
    await expect(results).not.toContainText("Baseline denominator");

    const impression = page.getByTestId("recist-impression");
    await expect(impression).toContainText(
      "RECIST 1.1 time-point response: Non-CR/non-PD",
    );
    await expect(impression).not.toContainText("Target-lesion sum");
    await expect(impression).not.toContainText("baseline");
    await expect(impression).not.toContainText("nadir");
  });

  test("supports a 320px keyboard workflow, live validation, and theme parity", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });

    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);

    const addButton = page.getByRole("button", {
      name: "Add target lesion (1/5)",
    });
    await addButton.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("fieldset")).toHaveCount(2);

    await page.locator("#target-1-organ").selectOption("liver");
    await page.locator("#target-2-organ").selectOption("lung");
    const moveSecondUp = page.getByRole("button", {
      name: "Move target lesion 2 up",
    });
    await moveSecondUp.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("fieldset").first().locator("select").first()).toHaveValue(
      "lung",
    );

    const actionButtons = page.locator(
      'button[aria-label^="Move target lesion"], button[aria-label^="Remove target lesion"]',
    );
    for (let index = 0; index < (await actionButtons.count()); index += 1) {
      const bounds = await actionButtons.nth(index).boundingBox();
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
    }

    const removeSecond = page.getByRole("button", {
      name: "Remove target lesion 2",
    });
    await removeSecond.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("fieldset")).toHaveCount(1);

    await page
      .getByRole("button", {
        name: "Calculate RECIST 1.1 time-point response",
      })
      .click();
    // Scope to RECIST's own validation alert: the site-wide medical disclaimer
    // banner is also role="alert".
    const validationAlert = page
      .getByRole("alert")
      .filter({ hasText: "Resolve the following before classification" });
    await expect(validationAlert).toBeVisible();

    await page.getByRole("button", { name: "Switch to dark mode" }).first().click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(validationAlert).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
  });
});
