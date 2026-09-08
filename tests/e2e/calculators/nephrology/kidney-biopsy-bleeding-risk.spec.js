import { test, expect } from "@playwright/test";
import { navigateToCalculator } from "../../../helpers/calculator-test-helper.js";

const CALCULATOR_NAME = "Kidney Biopsy Major Bleeding Risk (KBRC)";
const resultRegion = (page) =>
  page.getByRole("status", { name: "Calculator results" });

async function fillProfile(page, profile) {
  for (const [field, value] of Object.entries({
    age: profile.age,
    weight: profile.weight,
    height: profile.height,
    platelets: profile.platelets,
    hemoglobin: profile.hemoglobin,
    kidney_size: profile.kidney_size,
  })) {
    await page.locator(`#${field}`).fill(String(value));
  }
  await page
    .locator(`input[name="kidney_type"][value="${profile.kidney_type}"]`)
    .check();
}

test.describe("Kidney Biopsy Major Bleeding Risk (KBRC)", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, CALCULATOR_NAME);
  });

  test("supports its permanent deep link and shows the approved scope", async ({
    page,
  }) => {
    await expect(page).toHaveURL(/\/#\/kidney-biopsy-bleeding-risk$/);
    await expect(page.getByTestId("calculator-title").first()).toContainText(
      CALCULATOR_NAME,
    );
    await expect(page.getByTestId("guideline-badge")).toContainText(
      "Thorne et al. recalibrated major-bleeding model (2026)",
    );

    const info = page.getByTestId("calculator-info");
    await expect(info).toContainText("major bleeding");
    await expect(info).toContainText("does not calculate the earlier any-bleeding");
    await expect(info).toContainText("adult Canadian cohorts");
    await expect(info).toContainText("follow-up differed between cohorts");
    await expect(info).toContainText("complements rather than replaces");
    await expect(info).toContainText(
      "data-entry guardrails, not ranges published as the model's validated domain",
    );
    await expect(info).not.toContainText(/low[- ]risk|moderate[- ]risk|high[- ]risk/i);

    await expect(page.locator("#age")).toHaveAttribute("min", "18");
    await expect(page.locator("#age")).toHaveAttribute("max", "90");
    await expect(page.locator("#platelets")).toHaveAttribute("min", "50");
    await expect(page.locator("#platelets")).toHaveAttribute("max", "700");
    await expect(page.getByText("g/L; Radulator input limit 70–180 (not g/dL)")).toBeVisible();
    await expect(page.getByText("greatest ultrasound dimension")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      /supported entry range|source calculator's supported entry range|not extrapolated/i,
    );

    await expect(
      page.getByRole("link", { name: /Thorne J, Lebedeva V/ }),
    ).toHaveAttribute("href", "https://doi.org/10.1016/j.xkme.2026.101352");
    await expect(
      page.getByRole("link", { name: /Frequency, Timing, and Prediction/ }),
    ).toHaveAttribute("href", "https://doi.org/10.1177/2054358120923527");
    await expect(
      page.getByRole("link", { name: /Short Observation Protocol/ }),
    ).toHaveAttribute("href", "https://doi.org/10.1177/20543581231205334");
  });

  test("serves and hydrates the permanent static URL", async ({
    page,
  }) => {
    test.skip(
      test.info().config.metadata.serverMode !== "preview",
      "requires a production-like preview so generated static pages are available",
    );

    const staticResponse = await page.request.get(
      "/calculators/kidney-biopsy-bleeding-risk/",
    );
    expect(staticResponse.ok()).toBe(true);
    const staticHtml = await staticResponse.text();
    expect(staticHtml).toContain(
      'data-static-calculator="kidney-biopsy-bleeding-risk"',
    );
    expect(staticHtml).toContain(
      '<link rel="canonical" href="https://radulator.com/calculators/kidney-biopsy-bleeding-risk/"',
    );

    await page.goto("/calculators/kidney-biopsy-bleeding-risk/");
    await expect(page.getByTestId("calculator-title").first()).toContainText(
      CALCULATOR_NAME,
    );
    await expect(page).toHaveURL(
      /\/calculators\/kidney-biopsy-bleeding-risk\/#\/kidney-biopsy-bleeding-risk$/,
    );
  });

  test("reproduces all four published display examples", async ({ page }) => {
    const examples = [
      [57, 81.7292, 170, 220, 107, 11.4, "native", "2.5%"],
      [57, 81.7292, 170, 220, 107, 11.4, "allograft", "1.0%"],
      [65, 69.36, 170, 150, 100, 10, "native", "7.4%"],
      [45, 86.7, 170, 300, 110, 12, "allograft", "0.4%"],
    ];

    for (const [
      age,
      weight,
      height,
      platelets,
      hemoglobin,
      kidney_size,
      kidney_type,
      expected,
    ] of examples) {
      await page.reload();
      await fillProfile(page, {
        age,
        weight,
        height,
        platelets,
        hemoglobin,
        kidney_size,
        kidney_type,
      });
      await page.getByRole("button", { name: "Calculate" }).click();
      await expect(resultRegion(page)).toContainText(expected);
    }
  });

  test("updates read-only BMI before calculation and reports clinical limitations", async ({
    page,
  }) => {
    await page.locator("#weight").fill("81.7292");
    await page.locator("#height").fill("170");
    const bmi = page.locator("#calculated_bmi");
    await expect(bmi).toHaveText("28.28 kg/m²");
    await expect(bmi).toHaveAttribute("aria-live", "polite");
    await expect(page.locator('label[for="calculated_bmi"]')).toContainText(
      "Calculated BMI",
    );

    await fillProfile(page, {
      age: 57,
      weight: 81.7292,
      height: 170,
      platelets: 220,
      hemoglobin: 107,
      kidney_size: 11.4,
      kidney_type: "native",
    });
    await page.getByRole("button", { name: "Calculate" }).click();

    const result = resultRegion(page);
    await expect(result).toContainText(
      "Biopsy-related bleeding requiring transfusion, surgery or embolization, or resulting in death",
    );
    await expect(result).toContainText("different procedural practices");
    await expect(result).toContainText("one week and one month");
    await expect(result).toContainText(
      "Do not use this percentage alone to decide whether to perform a biopsy",
    );
    await expect(result).not.toContainText(/low[- ]risk|moderate[- ]risk|high[- ]risk/i);
  });

  test("clears stale estimates when kidney type or anthropometry changes", async ({
    page,
  }) => {
    await fillProfile(page, {
      age: 57,
      weight: 81.7292,
      height: 170,
      platelets: 220,
      hemoglobin: 107,
      kidney_size: 11.4,
      kidney_type: "native",
    });
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(resultRegion(page)).toContainText("2.5%");

    await page.locator("#kidney_type-allograft").check();
    await expect(resultRegion(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(resultRegion(page)).toContainText("1.0%");

    await page.locator("#weight").fill("40");
    await expect(resultRegion(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(resultRegion(page)).toContainText("4.0%");
  });

  test("recovers from keyboard correction of an invalid g/dL-style hemoglobin entry", async ({
    page,
  }) => {
    await fillProfile(page, {
      age: 57,
      weight: 81.7292,
      height: 170,
      platelets: 220,
      hemoglobin: 10,
      kidney_size: 11.4,
      kidney_type: "native",
    });
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(resultRegion(page)).toContainText(
      "Hemoglobin must be 70–180 g/L",
    );

    const hemoglobin = page.locator("#hemoglobin");
    await hemoglobin.focus();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("107");
    await page.keyboard.press("Tab");
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(resultRegion(page)).toContainText("2.5%");
  });

  test("preserves the published equal-BMI estimate and clears the weight-review warning on recovery", async ({ page }) => {
    await fillProfile(page, { age: 45, weight: 86.7, height: 170, platelets: 300, hemoglobin: 110, kidney_size: 12, kidney_type: "allograft" });
    await page.getByRole("button", { name: "Calculate", exact: true }).click();
    await expect(resultRegion(page)).toContainText("0.4%");
    await expect(resultRegion(page)).not.toContainText("Input Review");
    await page.locator("#weight").fill("132.3");
    await page.locator("#height").fill("210");
    await expect(resultRegion(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Calculate", exact: true }).click();
    await expect(resultRegion(page)).toContainText("0.4%");
    await expect(resultRegion(page)).toContainText("30.00 kg/m²");
    await expect(resultRegion(page)).toContainText("Input Review");
    await page.locator("#weight").fill("0");
    await page.getByRole("button", { name: "Calculate", exact: true }).click();
    await expect(resultRegion(page)).toContainText("Weight must be above zero");
    await expect(resultRegion(page)).not.toContainText("0.4%");
    await page.locator("#weight").fill("86.7");
    await page.locator("#height").fill("170");
    await page.getByRole("button", { name: "Calculate", exact: true }).click();
    await expect(resultRegion(page)).toContainText("0.4%");
    await expect(resultRegion(page)).not.toContainText("Input Review");
  });

  test("copies the current result and weight warning and exposes print layout without native printing", async ({
    page,
    browserName,
  }) => {
    await fillProfile(page, {
      age: 45,
      weight: 132.3,
      height: 210,
      platelets: 300,
      hemoglobin: 110,
      kidney_size: 12,
      kidney_type: "allograft",
    });
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(resultRegion(page)).toContainText("0.4%");
    await expect(resultRegion(page)).toContainText("Input Review");

    if (browserName === "chromium") {
      await page.context().grantPermissions([
        "clipboard-read",
        "clipboard-write",
      ]);
    } else {
      await page.evaluate(() => {
        window.__radulatorClipboard = "";
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async (text) => {
              window.__radulatorClipboard = text;
            },
            readText: async () => window.__radulatorClipboard,
          },
        });
      });
    }

    await page.getByRole("button", { name: "Copy results" }).click();
    if (browserName === "chromium") {
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      expect(copied).toContain(
        "Kidney Biopsy Major Bleeding Risk (KBRC) — Radulator",
      );
      expect(copied).toContain(
        "Estimated major bleeding risk after kidney biopsy: 0.4%",
      );
      expect(copied).toContain("Model Scope:");
      expect(copied).toContain("Input Review:");
      expect(copied).toContain("Check weight, height and units");
      expect(copied).not.toContain("_probability");
    } else {
      await expect(
        page.getByRole("button", { name: "Results copied" }),
      ).toBeVisible();
      await expect(page.getByText("Copied!", { exact: true })).toBeVisible();
    }

    await page.evaluate(() => {
      window.__radulatorPrintCalls = 0;
      window.print = () => {
        window.__radulatorPrintCalls += 1;
      };
    });
    await page.getByRole("button", { name: "Print Results" }).click();
    await expect
      .poll(() => page.evaluate(() => window.__radulatorPrintCalls))
      .toBe(1);

    await page.emulateMedia({ media: "print" });
    await expect(page.locator("aside")).toBeHidden();
    await expect(page.getByRole("button", { name: "Print Results" })).toBeHidden();
    await expect(resultRegion(page)).toBeVisible();
    await expect(page.getByText("0.4%", { exact: true })).toBeVisible();
    await expect(resultRegion(page)).toContainText("Check weight, height and units");
  });

  test("warns that valid estimates above 25% may be overpredicted", async ({
    page,
  }) => {
    await fillProfile(page, {
      age: 18,
      weight: 30,
      height: 210,
      platelets: 50,
      hemoglobin: 70,
      kidney_size: 8,
      kidney_type: "native",
    });
    await page.getByRole("button", { name: "Calculate" }).click();

    const result = resultRegion(page);
    await expect(result).toContainText("30.2%");
    await expect(result).toContainText(
      "Estimates above 25% may overpredict major bleeding risk",
    );
  });

  test("does not round a finite upper-tail estimate to certainty", async ({ page }) => {
    await fillProfile(page, { age: 90, weight: 400, height: 140, platelets: 50, hemoglobin: 70, kidney_size: 8, kidney_type: "native" });
    await page.getByRole("button", { name: "Calculate", exact: true }).click();
    await expect(resultRegion(page)).toContainText(">99.9%");
    await expect(resultRegion(page)).not.toContainText("100.0%");
    await expect(resultRegion(page)).toContainText("Input Review");
    await expect(resultRegion(page)).toContainText("Calibration Warning");
  });

  test("fails closed for missing and out-of-range inputs", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(resultRegion(page)).toContainText("Age is required");

    await fillProfile(page, {
      age: 57,
      weight: 81.7292,
      height: 170,
      platelets: 220,
      hemoglobin: 107,
      kidney_size: 11.4,
      kidney_type: "native",
    });
    await page.locator("#age").fill("91");
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(resultRegion(page)).toContainText(
      "outside Radulator input limits",
    );
    await expect(resultRegion(page)).toContainText(
      "not publication-derived model-validation bounds",
    );

  });

  test("keeps controls labelled, keyboard reachable, and usable on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByRole("spinbutton", { name: /Age/ })).toBeVisible();
    await expect(
      page.getByRole("radio", { name: "Native kidney" }),
    ).toBeVisible();
    await expect(
      page.getByRole("radio", { name: "Transplanted/allograft kidney" }),
    ).toBeVisible();

    await page.locator("#age").focus();
    await page.keyboard.press("Tab");
    await expect(page.locator("#kidney_type-native")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#kidney_type-allograft")).toBeFocused();
    await expect(page.locator("#kidney_type-allograft")).toBeChecked();
    await page.keyboard.press("Tab");
    await expect(page.locator("#weight")).toBeFocused();

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(horizontalOverflow).toBe(false);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.reload();
    await expect(page.locator("aside")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
  });
});
