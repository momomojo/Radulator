import { test, expect } from "@playwright/test";
import {
  navigateToCalculator,
  openMobileMenuIfNeeded,
} from "../../../helpers/calculator-test-helper.js";

async function selectCriterion(page, groupName, optionName) {
  await page
    .getByRole("radiogroup", { name: groupName })
    .getByRole("radio", { name: optionName })
    .check();
}

async function fillPesi(page, overrides = {}) {
  const values = {
    age_years: "65",
    male_sex_criterion: "absent",
    cancer: "no",
    heart_failure: "no",
    chronic_lung_disease: "no",
    pulse: "109",
    systolic_bp: "100",
    respiratory_rate: "29",
    temperature_c: "36.0",
    altered_mental_status: "no",
    oxygen_saturation: "90",
    ...overrides,
  };

  for (const id of [
    "age_years",
    "pulse",
    "systolic_bp",
    "respiratory_rate",
    "temperature_c",
    "oxygen_saturation",
  ]) {
    await page.locator(`#${id}`).fill(values[id]);
  }

  await selectCriterion(
    page,
    "Male sex variable in the original model",
    values.male_sex_criterion === "present"
      ? "Criterion present (+10)"
      : "Criterion absent (+0)",
  );
  await selectCriterion(
    page,
    "Cancer",
    values.cancer === "yes" ? "Present (+30)" : "Absent (+0)",
  );
  await selectCriterion(
    page,
    "Heart failure",
    values.heart_failure === "yes" ? "Present (+10)" : "Absent (+0)",
  );
  await selectCriterion(
    page,
    "Chronic lung disease",
    values.chronic_lung_disease === "yes"
      ? "Present (+10)"
      : "Absent (+0)",
  );
  await selectCriterion(
    page,
    "Altered mental status",
    values.altered_mental_status === "yes"
      ? "Present (+60)"
      : "Absent (+0)",
  );
}

function results(page) {
  return page.getByRole("status", { name: "Calculator results" });
}

test.describe("PESI Score Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, "PESI Score");
  });

  test("resolves the permanent route and is discoverable in search", async ({
    page,
  }) => {
    await expect(page).toHaveURL(/\/#\/pesi$/);
    await expect(page.getByTestId("calculator-title").first()).toContainText(
      "PESI Score",
    );

    await openMobileMenuIfNeeded(page);
    await page.getByRole("textbox", { name: "Search calculators" }).fill("PESI");
    await expect(
      page.getByRole("button", { name: /PESI Score/ }).first(),
    ).toBeVisible();
    await expect(
      page.locator("aside").getByText("Clinical Decision", { exact: true }),
    ).toBeVisible();
  });

  test("requires an explicit value for all 11 inputs", async ({ page }) => {
    const calculate = page.getByRole("button", { name: "Calculate", exact: true });
    await expect(calculate).toBeDisabled();
    await expect(calculate).toHaveAttribute(
      "aria-describedby",
      "pesi-calculate-requirements",
    );
    await expect(page.getByRole("status")).toContainText(
      "Complete all 11 required inputs",
    );
    await expect(page.getByRole("radiogroup", { name: "Cancer" })).toHaveAttribute(
      "aria-required",
      "true",
    );
    const cancerOption = page
      .getByRole("radiogroup", { name: "Cancer" })
      .getByText("Present (+30)", { exact: true });
    expect((await cancerOption.boundingBox())?.height).toBeGreaterThanOrEqual(40);

    await fillPesi(page);
    await expect(calculate).toBeEnabled();
  });

  test("crosses the class II/III and 2026 low/elevated boundary at 85/86", async ({
    page,
  }) => {
    await fillPesi(page, { age_years: "85" });
    await page.getByRole("button", { name: "Calculate", exact: true }).click();
    await expect(results(page)).toContainText("85 points");
    await expect(results(page)).toContainText("II — Low PESI mortality class");
    await expect(results(page)).toContainText(
      "Low PESI clinical-severity score (≤85)",
    );

    await page.locator("#age_years").fill("86");
    await page.getByRole("button", { name: "Calculate", exact: true }).click();
    await expect(results(page)).toContainText("86 points");
    await expect(results(page)).toContainText(
      "III — Intermediate PESI mortality class",
    );
    await expect(results(page)).toContainText(
      "Elevated PESI clinical-severity score (>85)",
    );
  });

  test("calculates the full abnormal-threshold vector without management advice", async ({
    page,
  }) => {
    await fillPesi(page, {
      age_years: "40",
      pulse: "110",
      systolic_bp: "99",
      respiratory_rate: "30",
      temperature_c: "35.9",
      altered_mental_status: "yes",
      oxygen_saturation: "89",
    });
    await page.getByRole("button", { name: "Calculate", exact: true }).click();

    await expect(results(page)).toContainText("210 points");
    await expect(results(page)).toContainText("V — Very high PESI mortality class");
    await expect(results(page)).toContainText("Pulse ≥110/min: +20");
    await expect(results(page)).toContainText("Altered mental status: +60");
    await expect(results(page)).toContainText(
      "does not independently determine outpatient care, ICU need, reperfusion",
    );
    await expect(results(page)).not.toContainText("Category C");
    await expect(results(page)).not.toContainText("thrombolysis recommended");
  });

  test("shows all primary and current-context references", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "References" })).toBeVisible();
    await expect(page.getByText(/Derivation and validation of a prognostic model/)).toBeVisible();
    await page.getByRole("button", { name: "Show 3 more references" }).click();
    await expect(page.getByText(/2026 AHA\/ACC\/ACCP/)).toBeVisible();
    await expect(page.getByText(/ISTH SSC communication/)).toBeVisible();
  });

  test("reset clears inputs and the calculated result", async ({ page }) => {
    await fillPesi(page);
    await page.getByRole("button", { name: "Calculate", exact: true }).click();
    await expect(results(page)).toContainText("65 points");

    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(page.locator("#age_years")).toHaveValue("");
    await expect(
      page.getByRole("radiogroup", {
        name: "Male sex variable in the original model",
      }).getByRole("radio", { checked: true }),
    ).toHaveCount(0);
    await expect(results(page)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Calculate", exact: true }),
    ).toBeDisabled();
  });

  test("renders the full calculator without horizontal overflow on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByTestId("calculator-title").first()).toContainText(
      "PESI Score",
    );
    await expect(page.getByRole("radiogroup", { name: "Cancer" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Calculate", exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
});
