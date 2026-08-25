import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { navigateToCalculator } from "../../../helpers/calculator-test-helper.js";

const resultsRegion = (page) =>
  page.getByRole("status", { name: "Calculator results" });

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resultRow(results, label) {
  return results.locator(":scope > div").filter({
    hasText: new RegExp(`^\\s*${escapeRegExp(label)}:\\s*`),
  });
}

async function expectResultValue(results, label, value, options) {
  const row = resultRow(results, label);
  await expect(row).toHaveCount(1);
  await expect(row.getByText(value, options)).toBeVisible();
}

async function fillCacMesa(
  page,
  { score, age = 62, sex = "female", race = "black", vessels = "2" },
) {
  await page.locator("#score").fill(String(score));
  await page.locator("#age").fill(String(age));
  await page.locator("#sex").selectOption(sex);
  await page.locator("#race").selectOption(race);
  await page.locator("#vessel_count").selectOption(vessels);
  await page.getByRole("button", { name: "Calculate" }).click();
}

test.describe("CAC/MESA Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, "CAC/MESA Calculator");
  });

  test("renders the source-identified CAC/MESA calculator", async ({ page }) => {
    await expect(page.getByTestId("calculator-title").first()).toContainText(
      "CAC/MESA Calculator",
    );
    await expect(page.getByText("Total Agatston CAC Score")).toBeVisible();
    await expect(page.getByText("Sex for MESA Reference")).toBeVisible();
    await expect(page.getByText("Vessel Count for CAC-DRS")).toBeVisible();
    await expect(
      page.getByText("It does not calculate Agatston score from CT pixels"),
    ).toBeVisible();
    await expect(page.getByTestId("guideline-badge")).toHaveText(
      "MESA reference values + CAC-DRS (SCCT 2018)",
    );
    await expect(
      page.getByText("Maron et al. 2024 proposed CAC stage", {
        exact: false,
      }),
    ).toBeVisible();
  });

  test("discloses the MESA cohort and relative-risk limitations", async ({
    page,
  }) => {
    await expect(
      page.getByText(
        "free of clinical cardiovascular disease and treated diabetes at baseline",
        { exact: false },
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        "does not by itself establish that a patient is at high clinical risk",
        { exact: false },
      ),
    ).toBeVisible();

    await fillCacMesa(page, { score: 120 });
    await expectResultValue(
      resultsRegion(page),
      "MESA Limitation",
      /free of clinical cardiovascular disease and treated diabetes.*does not by itself establish high clinical risk/i,
    );

    const clinicalDocument = readFileSync(
      "docs/calculators/cardiac/cac-mesa.md",
      "utf8",
    ).replace(/\s+/g, " ");
    expect(clinicalDocument).toContain(
      "free of clinical cardiovascular disease and treated diabetes at baseline",
    );
    expect(clinicalDocument).toContain(
      "does not by itself establish that a patient is at high clinical risk",
    );
  });

  test("matches audited official MESA lookup examples", async ({ page }) => {
    const examples = [
      {
        score: 0,
        age: 55,
        sex: "male",
        race: "white",
        vessels: "0",
        category: "No calcified coronary plaque",
        stage: "0",
        stagingBurden: "No calcified atherosclerotic burden",
        cacDrs: "A0",
        position: "At 25th reference score (0)",
        probability: "56%",
        refs: "25th 0, 50th 6, 75th 68, 90th 234",
      },
      {
        score: 35,
        age: 46,
        sex: "female",
        race: "chinese",
        vessels: "1",
        category: "CAC 1-99",
        stage: "2",
        stagingBurden: "Moderate calcified atherosclerotic burden",
        cacDrs: "A1/N1",
        position: "Above 90th reference score (0)",
        probability: "7%",
        refs: "25th 0, 50th 0, 75th 0, 90th 0",
      },
      {
        score: 120,
        age: 62,
        sex: "female",
        race: "black",
        vessels: "2",
        category: "Moderate calcified plaque burden",
        stage: "2",
        stagingBurden: "Moderate calcified atherosclerotic burden",
        cacDrs: "A2/N2",
        position: "Above 90th reference score (102)",
        probability: "32%",
        refs: "25th 0, 50th 0, 75th 11, 90th 102",
      },
      {
        score: 450,
        age: 70,
        sex: "male",
        race: "hispanic",
        vessels: "3",
        category: "Severe calcified plaque burden",
        stage: "3",
        stagingBurden: "Severe calcified atherosclerotic burden",
        cacDrs: "A3/N3",
        position: "Between 75th (247) and 90th (666) reference scores",
        probability: "75%",
        refs: "25th 1, 50th 56, 75th 247, 90th 666",
      },
      {
        score: 1200,
        age: 72,
        sex: "male",
        race: "white",
        vessels: "4",
        category: "Extensive calcified plaque burden",
        stage: "4",
        stagingBurden: "Extensive calcified atherosclerotic burden",
        cacDrs: "A3/N4",
        position: "Between 75th (641) and 90th (1584) reference scores",
        probability: "86%",
        refs: "25th 32, 50th 180, 75th 641, 90th 1584",
      },
    ];

    for (const example of examples) {
      await fillCacMesa(page, example);
      const results = resultsRegion(page);
      await expectResultValue(results, "Absolute CAC Band", example.category);
      await expectResultValue(results, "Maron CAC Stage", example.stage, {
        exact: true,
      });
      await expectResultValue(
        results,
        "CAC Staging Burden",
        example.stagingBurden,
      );
      await expectResultValue(results, "CAC-DRS", example.cacDrs, {
        exact: true,
      });
      await expectResultValue(results, "MESA Reference Position", example.position);
      await expectResultValue(
        results,
        "MESA Probability Nonzero CAC",
        example.probability,
        { exact: true },
      );
      await expectResultValue(results, "MESA Reference Scores", example.refs);
    }
  });

  test("maps boundaries without inferring the ambiguous exact-300 CAC-DRS category", async ({
    page,
  }) => {
    const cases = [
      [0, "No calcified coronary plaque", "A0", "0", "0"],
      [1, "CAC 1-99", "A1 / N not reported", "1-99", "1"],
      [99, "CAC 1-99", "A1 / N not reported", "1-99", "2"],
      [100, "Moderate calcified plaque burden", "A2 / N not reported", "100-299", "2"],
      [299, "Moderate calcified plaque burden", "A2 / N not reported", "100-299", "2"],
      [
        300,
        "Severe calcified plaque burden",
        "Not reported at exact 300 because the primary CAC-DRS source has a boundary conflict",
        "300-999",
        "3",
      ],
      [301, "Severe calcified plaque burden", "A3 / N not reported", "300-999", "3"],
      [999, "Severe calcified plaque burden", "A3 / N not reported", "300-999", "3"],
      [1000, "Extensive calcified plaque burden", "A3 / N not reported", ">=1000", "4"],
    ];

    for (const [score, category, cacDrs, range, stage] of cases) {
      await fillCacMesa(page, {
        score,
        age: 55,
        sex: "male",
        race: "white",
        vessels: score === 0 ? "0" : "not_reported",
      });
      const results = resultsRegion(page);
      await expectResultValue(results, "Absolute CAC Band", category);
      await expectResultValue(results, "CAC-DRS", cacDrs, { exact: true });
      await expectResultValue(results, "CAC Score Range", range, { exact: true });
      await expectResultValue(results, "Maron CAC Stage", stage, { exact: true });
    }
  });

  test("upstages CAC 1-99 at the MESA 75th-percentile boundary", async ({
    page,
  }) => {
    await fillCacMesa(page, {
      score: 35,
      age: 46,
      sex: "female",
      race: "chinese",
      vessels: "1",
    });

    const results = resultsRegion(page);
    await expectResultValue(results, "Absolute CAC Band", "CAC 1-99", {
      exact: true,
    });
    await expectResultValue(results, "Maron CAC Stage", "2", { exact: true });
    await expectResultValue(
      results,
      "CAC Staging Burden",
      "Moderate calcified atherosclerotic burden",
    );
    await expectResultValue(
      results,
      "CAC Stage Criterion",
      ">=75th MESA reference score (0)",
    );
  });

  test("keeps absolute output while marking MESA unavailable outside limits", async ({
    page,
  }) => {
    await fillCacMesa(page, {
      score: 120,
      age: 44,
      sex: "female",
      race: "black",
      vessels: "2",
    });
    await expectResultValue(
      resultsRegion(page),
      "Absolute CAC Band",
      "Moderate calcified plaque burden",
    );
    await expectResultValue(
      resultsRegion(page),
      "MESA Reference Position",
      "age is outside 45-84 years",
    );

    await fillCacMesa(page, {
      score: 120,
      age: 85,
      sex: "female",
      race: "black",
      vessels: "2",
    });
    await expectResultValue(
      resultsRegion(page),
      "MESA Reference Position",
      "age is outside 45-84 years",
    );

    await fillCacMesa(page, {
      score: 120,
      age: 62,
      sex: "female",
      race: "non_mesa",
      vessels: "2",
    });
    await expectResultValue(
      resultsRegion(page),
      "MESA Reference Position",
      "MESA percentile unavailable: use only",
    );
  });

  test("validates inconsistent CAC score and vessel count", async ({ page }) => {
    await fillCacMesa(page, {
      score: 0,
      age: 55,
      sex: "male",
      race: "white",
      vessels: "1",
    });
    await expect(
      resultsRegion(page).getByText(
        "CAC score 0 is inconsistent with a positive CAC-DRS vessel count.",
      ),
    ).toBeVisible();

    await fillCacMesa(page, {
      score: 35,
      age: 46,
      sex: "female",
      race: "chinese",
      vessels: "not_reported",
    });
    await expectResultValue(
      resultsRegion(page),
      "CAC-DRS",
      "A1 / N not reported",
      { exact: true },
    );
  });

  test("rejects fractional scores instead of applying integer reference data", async ({
    page,
  }) => {
    await fillCacMesa(page, {
      score: 0.5,
      age: 55,
      sex: "male",
      race: "white",
      vessels: "1",
    });
    await expect(
      resultsRegion(page).getByText(
        "Total Agatston CAC score must be a non-negative whole number.",
      ),
    ).toBeVisible();
  });
});
