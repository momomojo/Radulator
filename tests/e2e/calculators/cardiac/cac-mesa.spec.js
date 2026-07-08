import { test, expect } from "@playwright/test";
import { navigateToCalculator } from "../../../helpers/calculator-test-helper.js";

const resultsRegion = (page) =>
  page.getByRole("status", { name: "Calculator results" });

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

  test("renders the approved CAC/MESA v1 calculator", async ({ page }) => {
    await expect(page.getByTestId("calculator-title").first()).toContainText(
      "CAC/MESA Calculator",
    );
    await expect(page.getByText("Total Agatston CAC Score")).toBeVisible();
    await expect(page.getByText("Sex for MESA Reference")).toBeVisible();
    await expect(page.getByText("Vessel Count for CAC-DRS")).toBeVisible();
    await expect(
      page.getByText("It does not calculate Agatston score from CT pixels"),
    ).toBeVisible();
  });

  test("matches audited official MESA lookup examples", async ({ page }) => {
    const examples = [
      {
        score: 0,
        age: 55,
        sex: "male",
        race: "white",
        vessels: "0",
        category: "Stage 0 - No calcified coronary plaque",
        cacDrs: "A0",
        percentile: "0th percentile",
        probability: "56%",
        refs: "25th 0, 50th 6, 75th 68, 90th 234",
      },
      {
        score: 35,
        age: 46,
        sex: "female",
        race: "chinese",
        vessels: "1",
        category: "Stage 1 - Mild calcified plaque burden",
        cacDrs: "A1/N1",
        percentile: "97th percentile",
        probability: "7%",
        refs: "25th 0, 50th 0, 75th 0, 90th 0",
      },
      {
        score: 120,
        age: 62,
        sex: "female",
        race: "black",
        vessels: "2",
        category: "Stage 2 - Moderate calcified plaque burden",
        cacDrs: "A2/N2",
        percentile: "91st percentile",
        probability: "32%",
        refs: "25th 0, 50th 0, 75th 11, 90th 102",
      },
      {
        score: 450,
        age: 70,
        sex: "male",
        race: "hispanic",
        vessels: "3",
        category: "Stage 3 - Severe calcified plaque burden",
        cacDrs: "A3/N3",
        percentile: "84th percentile",
        probability: "75%",
        refs: "25th 1, 50th 56, 75th 247, 90th 666",
      },
      {
        score: 1200,
        age: 72,
        sex: "male",
        race: "white",
        vessels: "4",
        category: "Stage 4 - Extensive/extreme calcified plaque burden",
        cacDrs: "A3/N4",
        percentile: "85th percentile",
        probability: "86%",
        refs: "25th 32, 50th 180, 75th 641, 90th 1584",
      },
    ];

    for (const example of examples) {
      await fillCacMesa(page, example);
      const results = resultsRegion(page);
      await expect(results.getByText(example.category)).toBeVisible();
      await expect(results.getByText(example.cacDrs, { exact: true })).toBeVisible();
      await expect(results.getByText(example.percentile)).toBeVisible();
      await expect(results.getByText(example.probability, { exact: true })).toBeVisible();
      await expect(results.getByText(example.refs)).toBeVisible();
    }
  });

  test("maps score boundaries and exact 300 to approved categories", async ({
    page,
  }) => {
    const cases = [
      [0, "Stage 0 - No calcified coronary plaque", "A0", "0"],
      [1, "Stage 1 - Mild calcified plaque burden", "A1 / N not reported", "1-99"],
      [99, "Stage 1 - Mild calcified plaque burden", "A1 / N not reported", "1-99"],
      [100, "Stage 2 - Moderate calcified plaque burden", "A2 / N not reported", "100-299"],
      [299, "Stage 2 - Moderate calcified plaque burden", "A2 / N not reported", "100-299"],
      [300, "Stage 3 - Severe calcified plaque burden", "A3 / N not reported", "300-999"],
      [301, "Stage 3 - Severe calcified plaque burden", "A3 / N not reported", "300-999"],
      [999, "Stage 3 - Severe calcified plaque burden", "A3 / N not reported", "300-999"],
      [1000, "Stage 4 - Extensive/extreme calcified plaque burden", "A3 / N not reported", ">=1000"],
    ];

    for (const [score, category, cacDrs, range] of cases) {
      await fillCacMesa(page, {
        score,
        age: 55,
        sex: "male",
        race: "white",
        vessels: score === 0 ? "0" : "not_reported",
      });
      const results = resultsRegion(page);
      await expect(results.getByText(category)).toBeVisible();
      await expect(results.getByText(cacDrs, { exact: true })).toBeVisible();
      await expect(results.getByText(range, { exact: true })).toBeVisible();
    }
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
    await expect(
      resultsRegion(page).getByText("Stage 2 - Moderate calcified plaque burden"),
    ).toBeVisible();
    await expect(
      resultsRegion(page).getByText("age is outside 45-84 years"),
    ).toBeVisible();

    await fillCacMesa(page, {
      score: 120,
      age: 85,
      sex: "female",
      race: "black",
      vessels: "2",
    });
    await expect(
      resultsRegion(page).getByText("age is outside 45-84 years"),
    ).toBeVisible();

    await fillCacMesa(page, {
      score: 120,
      age: 62,
      sex: "female",
      race: "non_mesa",
      vessels: "2",
    });
    await expect(
      resultsRegion(page).getByText("MESA percentile unavailable: use only"),
    ).toBeVisible();
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
    await expect(
      resultsRegion(page).getByText("A1 / N not reported", { exact: true }),
    ).toBeVisible();
  });
});
