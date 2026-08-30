import { test, expect } from "@playwright/test";
import {
  fillInput,
  navigateToCalculator,
  selectRadio,
} from "../../../helpers/calculator-test-helper.js";

const eligibleLabel =
  "Eligible incidental nodule: age ≥35, not screening, not immunocompromised, and no known cancer";

async function selectEligible(page) {
  await selectRadio(page, "Fleischner 2017 Applicability", eligibleLabel);
}

async function calculate(page) {
  await page.getByRole("button", { name: "Calculate" }).click();
  return page.getByRole("status", { name: "Calculator results" });
}

async function fillSolid(page, { count = "Single nodule", size, risk }) {
  await selectEligible(page);
  await selectRadio(page, "Nodule Type", "Solid nodule");
  await selectRadio(page, "Number of Nodules", count);
  await fillInput(page, "Recorded Overall Nodule Size", size);
  if (Number(size) >= 10) {
    await selectRadio(
      page,
      "Both Overall Axes Recorded",
      "Yes — long- and short-axis diameters are recorded",
    );
  }
  await selectRadio(page, "Clinician-Estimated Malignancy Risk", risk);
}

test.describe("Fleischner 2017 source-locked calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, "Fleischner 2017 Pulmonary Nodules");
  });

  test("gates all clinical fields behind an accessible applicability choice", async ({
    page,
  }) => {
    const eligible = page.getByRole("radio", { name: eligibleLabel });
    await expect(eligible).toBeVisible();
    await expect(
      page.getByRole("radio", { name: "Solid nodule", exact: true }),
    ).not.toBeVisible();

    await eligible.focus();
    await page.keyboard.press("Space");

    await expect(eligible).toBeChecked();
    await expect(
      page.getByRole("radio", { name: "Solid nodule", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("radio", { name: "Low risk (<5%)" }),
    ).not.toBeVisible();
  });

  test("routes screening patients to Lung-RADS without a Fleischner schedule", async ({
    page,
  }) => {
    await selectRadio(
      page,
      "Fleischner 2017 Applicability",
      "Nodule was detected in a lung cancer screening program",
    );
    const results = await calculate(page);

    await expect(results).toContainText("Fleischner Applicability: Not applicable");
    await expect(results).toContainText("Lung-RADS");
    await expect(results).toContainText("No Fleischner follow-up schedule was generated");
    await expect(results).not.toContainText("Follow-up Interval:");
  });

  test("preserves optional late CT for a low-risk single solid 6 mm nodule", async ({
    page,
  }) => {
    await fillSolid(page, {
      size: "6",
      risk: "Low risk (<5%)",
    });
    const results = await calculate(page);

    await expect(results).toContainText(
      "CT at 6–12 months; then consider CT at 18–24 months",
    );
    await expect(results).toContainText("clinician-selected low risk (<5%)");
    await expect(results).toContainText("whole millimeter on lung-window images");
  });

  test("uses the multiple-solid row and most-suspicious-nodule rule above 8 mm", async ({
    page,
  }) => {
    await fillSolid(page, {
      count: "Multiple nodules",
      size: "9",
      risk: "Low risk (<5%)",
    });
    const results = await calculate(page);

    await expect(results).toContainText(
      "CT at 3–6 months; then consider CT at 18–24 months",
    );
    await expect(results).toContainText("most suspicious nodule, which may not be the largest");
    await expect(results).not.toContainText("Consider CT at 3 months, PET/CT");
  });

  test("surfaces the selected suspicious solitary GGN near-6-mm exception", async ({
    page,
  }) => {
    await selectEligible(page);
    await selectRadio(page, "Nodule Type", "Pure ground-glass nodule");
    await selectRadio(page, "Number of Nodules", "Single nodule");
    await fillInput(page, "Recorded Overall Nodule Size", "5");
    await selectRadio(
      page,
      "Solitary Pure GGN <6 mm Context",
      "Selected suspicious pure GGN close to 6 mm",
    );
    const results = await calculate(page);

    await expect(results).toContainText("Consider CT at 2 and 4 years");
    await expect(results).toContainText("selected suspicious pure ground-glass nodule close to 6 mm exception");
  });

  test("uses the multiple-subsolid pathway below 6 mm", async ({ page }) => {
    await selectEligible(page);
    await selectRadio(page, "Nodule Type", "Pure ground-glass nodule");
    await selectRadio(page, "Number of Nodules", "Multiple nodules");
    await fillInput(page, "Recorded Overall Nodule Size", "5");
    const results = await calculate(page);

    await expect(results).toContainText(
      "CT at 3–6 months; if stable, consider CT at 2 and 4 years",
    );
    await expect(results).not.toContainText("No routine follow-up");
  });

  test("does not hard-code late follow-up for multiple subsolid nodules at least 6 mm", async ({
    page,
  }) => {
    await selectEligible(page);
    await selectRadio(page, "Nodule Type", "Pure ground-glass nodule");
    await selectRadio(page, "Number of Nodules", "Multiple nodules");
    await fillInput(page, "Recorded Overall Nodule Size", "6");
    const results = await calculate(page);

    await expect(results).toContainText(
      "subsequent management based on the most suspicious nodule(s)",
    );
    await expect(results).toContainText("not a fixed 2/4-year schedule");
  });

  test("states the solitary pure GGN surveillance horizon as until year 5", async ({
    page,
  }) => {
    await selectEligible(page);
    await selectRadio(page, "Nodule Type", "Pure ground-glass nodule");
    await selectRadio(page, "Number of Nodules", "Single nodule");
    await fillInput(page, "Recorded Overall Nodule Size", "6");
    const results = await calculate(page);

    await expect(results).toContainText(
      "CT at 6–12 months to confirm persistence; then CT every 2 years until 5 years",
    );
    await expect(results).toContainText("until year 5 from baseline");
  });

  test("keeps a 6 mm part-solid component on the highly-suspicious short-term path", async ({
    page,
  }) => {
    await selectEligible(page);
    await selectRadio(page, "Nodule Type", "Part-solid nodule");
    await selectRadio(page, "Number of Nodules", "Single nodule");
    await fillInput(page, "Recorded Overall Nodule Size", "8");
    await fillInput(page, "Largest Solid Component", "6");
    await selectRadio(
      page,
      "Solid-Component Growth or Particularly Suspicious Morphology",
      "No / not established",
    );
    const results = await calculate(page);

    await expect(results).toContainText(
      "CT at 3–6 months to confirm persistence; a solid component ≥6 mm is highly suspicious",
    );
    await expect(results).toContainText(
      "does not by itself trigger PET/CT, biopsy, or resection",
    );
  });

  test("escalates a greater-than-8-mm solid component and includes resection", async ({
    page,
  }) => {
    await selectEligible(page);
    await selectRadio(page, "Nodule Type", "Part-solid nodule");
    await selectRadio(page, "Number of Nodules", "Single nodule");
    await fillInput(page, "Recorded Overall Nodule Size", "12");
    await selectRadio(
      page,
      "Both Overall Axes Recorded",
      "Yes — long- and short-axis diameters are recorded",
    );
    await fillInput(page, "Largest Solid Component", "9");
    const results = await calculate(page);

    await expect(results).toContainText("PET/CT, biopsy, or resection is recommended");
    await expect(results).toContainText("solid component >8 mm");
    await expect(results).not.toContainText("annual CT for 5 years");
  });

  test("rejects fractional measurements instead of silently assigning a threshold", async ({
    page,
  }) => {
    await fillSolid(page, {
      size: "5.5",
      risk: "Low risk (<5%)",
    });
    await page.getByRole("button", { name: "Calculate" }).click();

    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "pre-recorded whole-millimeter overall size",
    );
  });

  test("requires both axes for an overall size at least 10 mm", async ({
    page,
  }) => {
    await selectEligible(page);
    await selectRadio(page, "Nodule Type", "Solid nodule");
    await selectRadio(page, "Number of Nodules", "Single nodule");
    await fillInput(page, "Recorded Overall Nodule Size", "10");
    await selectRadio(page, "Clinician-Estimated Malignancy Risk", "High risk (≥5%)");
    await page.getByRole("button", { name: "Calculate" }).click();

    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "record both long- and short-axis diameters",
    );
  });

  test("rejects a solid component larger than the overall nodule", async ({
    page,
  }) => {
    await selectEligible(page);
    await selectRadio(page, "Nodule Type", "Part-solid nodule");
    await selectRadio(page, "Number of Nodules", "Single nodule");
    await fillInput(page, "Recorded Overall Nodule Size", "8");
    await fillInput(page, "Largest Solid Component", "9");
    await page.getByRole("button", { name: "Calculate" }).click();

    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "cannot exceed the overall nodule size",
    );
  });

  test("copies the source-qualified result text", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await fillSolid(page, {
      size: "6",
      risk: "Low risk (<5%)",
    });
    await calculate(page);

    await page.getByRole("button", { name: "Copy results" }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain(
      "Recommendation: CT at 6–12 months; then consider CT at 18–24 months",
    );
    expect(copied).toContain("Fleischner Society 2017");
  });

  test("shows the corrected measurement DOI and no obsolete DOI", async ({
    page,
  }) => {
    const showMore = page.getByRole("button", { name: /more reference/i });
    if (await showMore.count()) await showMore.click();

    await expect(
      page.locator(
        'a[href="https://doi.org/10.1148/radiol.2017162894"]',
      ),
    ).toBeVisible();
    await expect(
      page.locator(
        'a[href="https://doi.org/10.1148/radiol.2017170044"]',
      ),
    ).toHaveCount(0);
    await expect(page.getByText(/mediastinal window settings/i)).toHaveCount(0);
  });
});
