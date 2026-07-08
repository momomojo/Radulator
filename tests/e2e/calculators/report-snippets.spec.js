import { test, expect } from "@playwright/test";
import {
  navigateToCalculator,
  fillInput,
  selectOption,
} from "../../helpers/calculator-test-helper.js";

test.use({
  permissions: ["clipboard-read", "clipboard-write"],
});

async function calculateAdultChestDlp(page, dlp = "400") {
  await navigateToCalculator(page, "DLP to Effective Dose");
  await fillInput(page, "Dose Length Product (DLP)", dlp);
  await selectOption(page, "Anatomical Region", "chest");
  await selectOption(page, "Patient Age Group", "adult");
  await page.getByRole("button", { name: "Calculate" }).click();
  await page
    .getByRole("status", { name: "Calculator results" })
    .waitFor({ state: "visible" });
}

test.describe("Report snippets", () => {
  test("shows the DLP report snippet action only after eligible results", async ({
    page,
  }) => {
    await navigateToCalculator(page, "DLP to Effective Dose");

    await expect(
      page.getByRole("button", { name: "Copy Report Snippet" }),
    ).not.toBeVisible();

    await fillInput(page, "Dose Length Product (DLP)", "400");
    await selectOption(page, "Anatomical Region", "chest");
    await selectOption(page, "Patient Age Group", "adult");
    await page.getByRole("button", { name: "Calculate" }).click();
    await page
      .getByRole("status", { name: "Calculator results" })
      .waitFor({ state: "visible" });

    await expect(
      page.getByRole("button", { name: "Copy Report Snippet" }),
    ).toBeVisible();
  });

  test("does not expose report snippets for calculators without a spec", async ({
    page,
  }) => {
    await navigateToCalculator(page, "Prostate Volume & PSA Density");

    await fillInput(page, "Length (craniocaudal, cm):", 5);
    await fillInput(page, "Height (anteroposterior, cm):", 4);
    await fillInput(page, "Width (transverse, cm):", 4.5);
    await fillInput(page, "PSA (ng/mL):", 6);
    await page.getByRole("button", { name: "Calculate" }).click();

    await expect(
      page.getByRole("button", { name: "Copy Report Snippet" }),
    ).not.toBeVisible();
  });

  test("copies only whitelisted DLP values to the report snippet", async ({
    page,
  }) => {
    await calculateAdultChestDlp(page);

    await page.getByRole("button", { name: "Copy Report Snippet" }).click();

    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );

    expect(clipboardText).toContain(
      "DLP to effective dose estimate (Radulator; educational decision support)",
    );
    expect(clipboardText).toContain("DLP: 400 mGy·cm");
    expect(clipboardText).toContain("Region: Chest");
    expect(clipboardText).toContain("Age group: Adult");
    expect(clipboardText).toContain("Estimated effective dose: 5.60 mSv");
    expect(clipboardText).toContain("K-factor used: 0.014 mSv/(mGy·cm)");
    expect(clipboardText).toContain(
      "Source basis: ICRP 103 (2007); see Radulator calculator references.",
    );
    expect(clipboardText).toContain(
      "Verify values, clinical context, and institutional reporting standards before use.",
    );

    expect(clipboardText).not.toContain("Dose Context");
    expect(clipboardText).not.toContain(
      "Estimated Additional Lifetime Cancer Risk",
    );
    expect(clipboardText).not.toContain("Typical DLP Range");
    expect(clipboardText).not.toContain("Dose Alert");
    expect(clipboardText).not.toContain("Pediatric");
    expect(clipboardText).not.toContain("chest X-rays equivalent");
    expect(clipboardText.toLowerCase()).not.toContain("protocol optimization");
    expect(clipboardText.toLowerCase()).not.toContain("negligible");
    expect(clipboardText.toLowerCase()).not.toContain("significantly above");
    expect(clipboardText.toLowerCase()).not.toContain("recommend");
  });

  test("preserves provider workflow around DLP copy actions", async ({
    page,
  }) => {
    await calculateAdultChestDlp(page);

    await page.getByRole("button", { name: "Copy Results" }).click();
    const fullResultsText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(fullResultsText).toContain("DLP to Effective Dose");
    expect(fullResultsText).toContain("Effective Dose: 5.60 mSv");
    expect(fullResultsText).toContain("Dose Context");
    expect(fullResultsText).toContain(
      "Estimated Additional Lifetime Cancer Risk",
    );

    await page.getByRole("button", { name: "Copy Report Snippet" }).click();
    const snippetText = await page.evaluate(() => navigator.clipboard.readText());
    expect(snippetText).toContain("DLP: 400 mGy·cm");
    expect(snippetText).toContain("Estimated effective dose: 5.60 mSv");
    expect(snippetText).not.toContain("Dose Context");
    expect(snippetText).not.toContain(
      "Estimated Additional Lifetime Cancer Risk",
    );

    await expect(
      page.getByRole("heading", { name: "References" }),
    ).toBeVisible();
    const icrpLink = page.getByRole("link", {
      name: /ICRP Publication 103/,
    });
    await expect(icrpLink).toBeVisible();
    await expect(icrpLink).toHaveAttribute(
      "href",
      "https://doi.org/10.1016/j.icrp.2007.10.003",
    );
    await expect(icrpLink).toHaveAttribute("target", "_blank");

    await expect(
      page.getByRole("button", { name: "Copy Report Snippet" }),
    ).toBeVisible({ timeout: 4000 });
    await page.setViewportSize({ width: 375, height: 667 });
    const snippetButton = page.getByRole("button", {
      name: "Copy Report Snippet",
    });
    await expect(snippetButton).toBeVisible();
    await snippetButton.focus();
    await expect(snippetButton).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: "Report snippet copied" }),
    ).toBeVisible();
  });

  test("excludes DLP pediatric context fields when they exist in results", async ({
    page,
  }) => {
    await navigateToCalculator(page, "DLP to Effective Dose");

    await fillInput(page, "Dose Length Product (DLP)", "500");
    await selectOption(page, "Anatomical Region", "head");
    await selectOption(page, "Patient Age Group", "child_10");
    await page.getByRole("button", { name: "Calculate" }).click();

    const results = page.getByRole("status", { name: "Calculator results" });
    await expect(results).toContainText("Pediatric Note");
    await expect(results).toContainText("Pediatric Consideration");

    await page.getByRole("button", { name: "Copy Report Snippet" }).click();

    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );

    expect(clipboardText).toContain("DLP: 500 mGy·cm");
    expect(clipboardText).toContain("Region: Head");
    expect(clipboardText).toContain("Age group: 10-year-old");
    expect(clipboardText).toContain("Estimated effective dose: 1.35 mSv");
    expect(clipboardText).toContain("K-factor used: 0.0027 mSv/(mGy·cm)");
    expect(clipboardText).not.toContain("Pediatric Note");
    expect(clipboardText).not.toContain("Pediatric Consideration");
    expect(clipboardText).not.toContain("Image Gently");
  });
});
