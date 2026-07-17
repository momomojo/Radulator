import { test, expect } from "@playwright/test";
import { navigateToCalculator } from "../../../helpers/calculator-test-helper.js";

const CALCULATOR_NAME = "Cockcroft-Gault eCrCl";
const resultsRegion = (page) =>
  page.getByRole("status", { name: "Calculator results" });

async function chooseRadio(page, name, value) {
  await page.locator(`input[name="${name}"][value="${value}"]`).check();
}

async function fillCockcroftGault(page, overrides = {}) {
  const values = {
    age_years: "65",
    coefficient: "male",
    weight_unit: "kg",
    formula_weight: "70",
    weight_basis: "actual",
    scr_unit: "mg_dl",
    serum_creatinine: "1.2",
    ...overrides,
  };

  await page.locator("#age_years").fill(values.age_years);
  await chooseRadio(page, "coefficient", values.coefficient);
  await chooseRadio(page, "weight_unit", values.weight_unit);
  await page.locator("#formula_weight").fill(values.formula_weight);
  if (values.weight_basis !== undefined) {
    await page.locator("#weight_basis").selectOption(values.weight_basis);
  }
  await chooseRadio(page, "scr_unit", values.scr_unit);
  await page.locator("#serum_creatinine").fill(values.serum_creatinine);
}

async function calculate(page) {
  await page.getByRole("button", { name: "Calculate" }).click();
}

test.describe("Cockcroft-Gault eCrCl Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, CALCULATOR_NAME);
  });

  test("displays approved V1 scope, fields, and references", async ({
    page,
  }) => {
    await expect(page.getByTestId("calculator-title").first()).toContainText(
      CALCULATOR_NAME,
    );
    await expect(page.getByTestId("calculator-description")).toContainText(
      "Adult legacy-label estimated creatinine clearance",
    );

    const info = page.getByTestId("calculator-info");
    await expect(info).toContainText("not eGFR");
    await expect(info).toContainText("not medication-dose advice");
    await expect(info).toContainText("converts internally with:");
    await expect(info).toContainText("SCr mg/dL = SCr µmol/L / 88.4");
    await expect(info).toContainText("V1 does not auto-select");

    await expect(page.getByRole("spinbutton", { name: /Age/ })).toBeVisible();
    await expect(
      page.getByText("Historical male coefficient (x1.00)", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Historical female coefficient (x0.85)", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("spinbutton", { name: /Formula Weight/ }),
    ).toBeVisible();
    await expect(page.getByLabel("Formula Weight Basis")).toBeVisible();
    await expect(page.getByText("Serum Creatinine Unit")).toBeVisible();
    await expect(
      page.getByRole("spinbutton", { name: /Serum Creatinine/ }),
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "References" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: /Prediction of creatinine clearance from serum creatinine/,
      }),
    ).toHaveAttribute("href", "https://pubmed.ncbi.nlm.nih.gov/1244564/");
  });

  test("calculates the approved deterministic source vectors", async ({
    page,
  }) => {
    await fillCockcroftGault(page);
    await calculate(page);
    await expect(resultsRegion(page)).toContainText("60.8 mL/min");
    await expect(resultsRegion(page)).toContainText(
      "Actual body weight; clinician-selected",
    );

    await page.reload();
    await fillCockcroftGault(page, {
      coefficient: "female",
      weight_basis: "ideal",
    });
    await calculate(page);
    await expect(resultsRegion(page)).toContainText("51.6 mL/min");
    await expect(resultsRegion(page)).toContainText("x0.85");
    await expect(resultsRegion(page)).toContainText(
      "historical binary coefficients",
    );

    await page.reload();
    await fillCockcroftGault(page, {
      age_years: "90",
      coefficient: "female",
      formula_weight: "45",
      weight_basis: "other",
      serum_creatinine: "0.7",
    });
    await calculate(page);
    await expect(resultsRegion(page)).toContainText("37.9 mL/min");
    await expect(resultsRegion(page)).toContainText(
      "Other clinician-selected formula weight",
    );
  });

  test("uses exact internal /88.4 conversion for µmol/L serum creatinine", async ({
    page,
  }) => {
    await fillCockcroftGault(page, {
      age_years: "80",
      formula_weight: "60",
      weight_basis: "adjusted",
      scr_unit: "umol_l",
      serum_creatinine: "120",
    });

    await calculate(page);

    const results = resultsRegion(page);
    await expect(results).toContainText("36.8 mL/min");
    await expect(results).toContainText("1.3575 mg/dL");
    await expect(results).toContainText("converted internally with /88.4");
    await expect(results).not.toContainText("36.9 mL/min");
  });

  test("rounds one-decimal output with half-up behavior", async ({ page }) => {
    await fillCockcroftGault(page, {
      formula_weight: "35.376",
      weight_basis: "ideal",
      serum_creatinine: "1",
    });

    await calculate(page);

    await expect(resultsRegion(page)).toContainText("36.9 mL/min");
  });

  test("enforces adult age boundary and warns above derivation range", async ({
    page,
  }) => {
    await fillCockcroftGault(page, {
      age_years: "17",
      serum_creatinine: "1.0",
    });
    await calculate(page);
    await expect(resultsRegion(page)).toContainText("adult-only");

    await page.reload();
    await fillCockcroftGault(page, {
      age_years: "18",
      serum_creatinine: "1.0",
    });
    await calculate(page);
    await expect(resultsRegion(page)).toContainText("118.6 mL/min");

    await page.reload();
    await fillCockcroftGault(page, {
      age_years: "93",
      formula_weight: "60",
      weight_basis: "ideal",
      serum_creatinine: "1.0",
    });
    await calculate(page);
    await expect(resultsRegion(page)).toContainText("39.2 mL/min");
    await expect(resultsRegion(page)).toContainText("above 92 years");
  });

  test("rejects nonpositive input and missing visible weight basis", async ({
    page,
  }) => {
    await fillCockcroftGault(page, {
      serum_creatinine: "0",
    });
    await calculate(page);
    await expect(resultsRegion(page)).toContainText(
      "valid positive serum creatinine",
    );

    await page.reload();
    await page.locator("#age_years").fill("65");
    await chooseRadio(page, "coefficient", "male");
    await chooseRadio(page, "weight_unit", "kg");
    await page.locator("#formula_weight").fill("70");
    await chooseRadio(page, "scr_unit", "mg_dl");
    await page.locator("#serum_creatinine").fill("1.0");
    await calculate(page);
    await expect(resultsRegion(page)).toContainText(
      "visible formula weight basis",
    );
  });

  test("shows selected formula weight basis without automatic helper", async ({
    page,
  }) => {
    const bases = [
      ["actual", "Actual body weight"],
      ["ideal", "Ideal body weight"],
      ["adjusted", "Adjusted body weight"],
      ["other", "Other clinician-selected formula weight"],
    ];

    for (const [basisValue, basisText] of bases) {
      await page.reload();
      await fillCockcroftGault(page, {
        weight_basis: basisValue,
        serum_creatinine: "1.0",
      });
      await calculate(page);
      await expect(resultsRegion(page)).toContainText(basisText);
      await expect(resultsRegion(page)).toContainText(
        "no automatic weight selection applied",
      );
    }
  });

  test("works on mobile with labelled controls and calculator reset on switch", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await fillCockcroftGault(page, {
      scr_unit: "umol_l",
      serum_creatinine: "120",
    });
    await calculate(page);

    await expect(resultsRegion(page)).toBeVisible();
    await expect(resultsRegion(page)).toContainText("53.7 mL/min");
    await expect(
      page.getByRole("button", { name: "Open navigation menu" }),
    ).toBeVisible();

    await navigateToCalculator(page, "Mehran CIN Risk Score");
    await navigateToCalculator(page, CALCULATOR_NAME);

    await expect(page.locator("#age_years")).toHaveValue("");
    await expect(resultsRegion(page)).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Calculate" })).toBeVisible();
  });
});
