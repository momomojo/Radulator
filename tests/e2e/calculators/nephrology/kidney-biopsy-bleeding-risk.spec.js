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
    await expect(info).not.toContainText(/low[- ]risk|moderate[- ]risk|high[- ]risk/i);

    await expect(page.locator("#age")).toHaveAttribute("min", "18");
    await expect(page.locator("#age")).toHaveAttribute("max", "90");
    await expect(page.locator("#platelets")).toHaveAttribute("min", "50");
    await expect(page.locator("#platelets")).toHaveAttribute("max", "700");
    await expect(page.getByText("g/L; supported entry range 70–180 (not g/dL)")).toBeVisible();
    await expect(page.getByText("greatest ultrasound dimension")).toBeVisible();

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
      "outside the source calculator's supported entry range",
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
  });
});
