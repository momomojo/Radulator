import { test, expect } from "@playwright/test";
import {
  fillInput,
  navigateToCalculator,
  selectRadio,
} from "../../../helpers/calculator-test-helper.js";

const eligibleLabel =
  "Eligible incidental nodule: age ≥35, not screening, not immunocompromised, and no known cancer";
const indeterminateLabel =
  "Indeterminate pulmonary nodule characterized on thin-section CT";
const measuredLabel = ">3 mm — enter a recorded whole-mm size";
const categoricalLabel = "≤3 mm — categorical; do not measure";

async function selectEligible(page) {
  await selectRadio(page, "Fleischner 2017 Applicability", eligibleLabel);
  await selectRadio(
    page,
    "Thin-Section Nodule Characterization",
    indeterminateLabel,
  );
}

async function selectSize(page, size) {
  if (size === "lte3") {
    await selectRadio(page, "Selected Nodule Size Category", categoricalLabel);
    return;
  }
  await selectRadio(page, "Selected Nodule Size Category", measuredLabel);
  await fillInput(page, "Selected Nodule Overall Size", String(size));
  if (Number(size) >= 10) {
    await selectRadio(
      page,
      "Both Overall Axes Recorded",
      "Yes — long- and short-axis diameters are recorded",
    );
  }
}

async function fillSolid(
  page,
  {
    count = "Single nodule",
    size,
    risk,
    threshold,
    dominantRule = "Use the multiple-solid table row",
  },
) {
  await selectEligible(page);
  await selectRadio(page, "Selected Nodule Type", "Solid nodule");
  await selectRadio(page, "Number of Nodules", count);
  if (count === "Multiple nodules") {
    const cohort =
      threshold ?? (size === "lte3" || Number(size) < 6
        ? "Every nodule is <6 mm"
        : "At least one nodule is ≥6 mm");
    await selectRadio(page, "Multiple-Nodule 6 mm Cohort Threshold", cohort);
  }
  await selectSize(page, size);
  await selectRadio(page, "Clinician-Estimated Malignancy Risk", risk);
  if (
    count === "Multiple nodules" &&
    (threshold === "At least one nodule is ≥6 mm" ||
      (threshold === undefined && size !== "lte3" && Number(size) >= 6))
  ) {
    await selectRadio(page, "Dominant Solid-Nodule Management Rule", dominantRule);
  }
}

async function fillSubsolid(
  page,
  {
    type = "Pure ground-glass nodule",
    count = "Single nodule",
    size,
    threshold,
    context,
    component,
    concern,
  },
) {
  await selectEligible(page);
  await selectRadio(page, "Selected Nodule Type", type);
  await selectRadio(page, "Number of Nodules", count);
  if (count === "Multiple nodules") {
    const cohort =
      threshold ?? (size === "lte3" || Number(size) < 6
        ? "Every nodule is <6 mm"
        : "At least one nodule is ≥6 mm");
    await selectRadio(page, "Multiple-Nodule 6 mm Cohort Threshold", cohort);
  }
  await selectSize(page, size);
  if (context) {
    await selectRadio(page, "Solitary 5 mm Subsolid-Nodule Context", context);
  }
  if (component !== undefined) {
    await fillInput(page, "Largest Solid Component", String(component));
  }
  if (concern) {
    await selectRadio(
      page,
      "Solid-Component Growth or Particularly Suspicious Morphology",
      concern,
    );
  }
}

async function calculate(page) {
  await page.getByRole("button", { name: "Calculate" }).click();
  return page.getByRole("status", { name: "Calculator results" });
}

test.describe("Fleischner 2017 source-locked calculator", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCalculator(page, "Fleischner 2017 Pulmonary Nodules");
  });

  test("keyboard-gates clinical fields behind applicability and thin-section characterization", async ({
    page,
  }) => {
    const eligible = page.getByRole("radio", { name: eligibleLabel });
    await expect(eligible).toBeVisible();
    await expect(
      page.getByRole("radio", { name: indeterminateLabel }),
    ).not.toBeVisible();

    await eligible.focus();
    await page.keyboard.press("Space");
    const characterized = page.getByRole("radio", { name: indeterminateLabel });
    await expect(characterized).toBeVisible();
    await characterized.focus();
    await page.keyboard.press("Space");

    await expect(
      page.getByRole("radio", { name: "Solid nodule", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("radio", { name: "Low risk (<5%)" }),
    ).not.toBeVisible();
  });

  for (const exclusion of [
    {
      name: "screening",
      option: "Nodule was detected in a lung cancer screening program",
      expected: "Lung-RADS",
    },
    {
      name: "younger than 35",
      option: "Patient is younger than 35 years",
      expected: "minimize serial CT",
    },
    {
      name: "immunocompromised",
      option: "Patient is immunocompromised",
      expected: "risk for infection",
    },
    {
      name: "known cancer",
      option: "Patient has known cancer",
      expected: "risk for metastases",
    },
    {
      name: "uncertain eligibility",
      option: "Eligibility is uncertain",
      expected: "confirm eligibility",
    },
  ]) {
    test(`routes ${exclusion.name} without a Fleischner schedule`, async ({
      page,
    }) => {
      await selectRadio(
        page,
        "Fleischner 2017 Applicability",
        exclusion.option,
      );
      const results = await calculate(page);
      await expect(results).toContainText(exclusion.expected);
      await expect(results).toContainText(
        "No Fleischner table schedule was generated",
      );
      await expect(results).not.toContainText("Follow-up Interval:");
    });
  }

  test("routes definitive benign fat or calcification outside the table", async ({
    page,
  }) => {
    await selectRadio(page, "Fleischner 2017 Applicability", eligibleLabel);
    await selectRadio(
      page,
      "Thin-Section Nodule Characterization",
      "Definitively benign fat or calcification",
    );
    const results = await calculate(page);
    await expect(results).toContainText("No further CT follow-up");
    await expect(results).toContainText(
      "No Fleischner table schedule was generated",
    );
  });

  test("routes a typical intrapulmonary lymph node outside the table", async ({
    page,
  }) => {
    await selectRadio(page, "Fleischner 2017 Applicability", eligibleLabel);
    await selectRadio(
      page,
      "Thin-Section Nodule Characterization",
      "Typical intrapulmonary lymph node morphology",
    );
    const results = await calculate(page);
    await expect(results).toContainText("No CT follow-up is recommended");
    await expect(results).not.toContainText("Follow-up Interval:");
  });

  test("fails closed when thin-section characterization is unavailable", async ({
    page,
  }) => {
    await selectRadio(page, "Fleischner 2017 Applicability", eligibleLabel);
    await selectRadio(
      page,
      "Thin-Section Nodule Characterization",
      "Thin-section characterization is unavailable",
    );
    const results = await calculate(page);
    await expect(results).toContainText("Characterization incomplete");
    await expect(results).toContainText("contiguous thin sections");
    await expect(results).not.toContainText("Follow-up Interval:");
  });

  test("uses a categorical pathway instead of false precision at 3 mm or less", async ({
    page,
  }) => {
    await fillSolid(page, {
      size: "lte3",
      risk: "Low risk (<5%)",
    });
    await expect(
      page.getByLabel("Selected Nodule Overall Size (whole mm)"),
    ).not.toBeVisible();
    const results = await calculate(page);
    await expect(results).toContainText("No routine follow-up");
    await expect(results).toContainText("≤3 mm category");
    await expect(results).toContainText("should not be measured");
  });

  test("preserves low-risk optionality and keyboard-selectable risk at 6 mm", async ({
    page,
  }) => {
    await selectEligible(page);
    await selectRadio(page, "Selected Nodule Type", "Solid nodule");
    await selectRadio(page, "Number of Nodules", "Single nodule");
    await selectSize(page, "6");
    const lowRisk = page.getByRole("radio", { name: "Low risk (<5%)" });
    await lowRisk.focus();
    await page.keyboard.press("Space");
    const results = await calculate(page);
    await expect(results).toContainText(
      "CT at 6–12 months; then consider CT at 18–24 months",
    );
    await expect(results).toContainText("clinician-selected low risk (<5%)");
  });

  test("uses any-nodule threshold separately from a smaller most-suspicious nodule", async ({
    page,
  }) => {
    await fillSolid(page, {
      count: "Multiple nodules",
      size: "5",
      risk: "Low risk (<5%)",
      threshold: "At least one nodule is ≥6 mm",
    });
    const results = await calculate(page);
    await expect(results).toContainText(
      "CT at 3–6 months; then consider CT at 18–24 months",
    );
    await expect(results).toContainText("At least one nodule is ≥6 mm");
    await expect(results).toContainText("most suspicious nodule");
  });

  test("supports the Recommendation 2 dominant solitary-path override", async ({
    page,
  }) => {
    await fillSolid(page, {
      count: "Multiple nodules",
      size: "9",
      risk: "Low risk (<5%)",
      threshold: "At least one nodule is ≥6 mm",
      dominantRule:
        "Use the solitary pathway for a larger or more suspicious dominant nodule",
    });
    const results = await calculate(page);
    await expect(results).toContainText(
      "Consider CT at 3 months, PET/CT, or tissue sampling",
    );
    await expect(results).toContainText("solitary-nodule pathway override");
  });

  test("surfaces the selected suspicious solitary pure-GGN exception", async ({
    page,
  }) => {
    await fillSubsolid(page, {
      size: "5",
      context: "Selected suspicious subsolid nodule close to 6 mm",
    });
    const results = await calculate(page);
    await expect(results).toContainText("Consider CT at 2 and 4 years");
    await expect(results).toContainText(
      "selected suspicious pure ground-glass nodule close to 6 mm",
    );
  });

  test("extends the selected close-to-6-mm exception to part-solid nodules without a component measurement", async ({
    page,
  }) => {
    await fillSubsolid(page, {
      type: "Part-solid nodule",
      size: "5",
      context: "Selected suspicious subsolid nodule close to 6 mm",
    });
    await expect(page.getByLabel("Largest Solid Component")).not.toBeVisible();
    const results = await calculate(page);
    await expect(results).toContainText("Consider CT at 2 and 4 years");
    await expect(results).toContainText(
      "no discrete solid-component measurement is required",
    );
  });

  test("uses the all-below-6 multiple-subsolid pathway", async ({ page }) => {
    await fillSubsolid(page, {
      count: "Multiple nodules",
      size: "5",
      threshold: "Every nodule is <6 mm",
    });
    const results = await calculate(page);
    await expect(results).toContainText(
      "CT at 3–6 months; if stable, consider CT at 2 and 4 years",
    );
  });

  test("uses the any-at-least-6 multiple-subsolid pathway even when the selected nodule is 5 mm", async ({
    page,
  }) => {
    await fillSubsolid(page, {
      count: "Multiple nodules",
      size: "5",
      threshold: "At least one nodule is ≥6 mm",
    });
    const results = await calculate(page);
    await expect(results).toContainText(
      "subsequent management based on the most suspicious nodule(s)",
    );
    await expect(results).toContainText("not a fixed 2/4-year schedule");
  });

  test("states the solitary pure-GGN horizon as until year 5", async ({
    page,
  }) => {
    await fillSubsolid(page, { size: "6" });
    const results = await calculate(page);
    await expect(results).toContainText(
      "CT at 6–12 months to confirm persistence; then CT every 2 years until 5 years",
    );
    await expect(results).toContainText("until year 5 from baseline");
  });

  test("keeps an uncomplicated below-6-mm component on surveillance", async ({
    page,
  }) => {
    await fillSubsolid(page, {
      type: "Part-solid nodule",
      size: "10",
      component: "5",
      concern: "No / not established",
    });
    const results = await calculate(page);
    await expect(results).toContainText("annual CT for 5 years");
    await expect(results).not.toContainText(
      "PET/CT, biopsy, or resection is recommended",
    );
  });

  test("escalates growth or suspicious morphology independently of component size", async ({
    page,
  }) => {
    await fillSubsolid(page, {
      type: "Part-solid nodule",
      size: "10",
      component: "5",
      concern: "Yes — growing or particularly suspicious",
    });
    const results = await calculate(page);
    await expect(results).toContainText(
      "PET/CT, biopsy, or resection is recommended",
    );
    await expect(results).toContainText(
      "independently of component size",
    );
    await expect(results).not.toContainText("annual CT for 5 years");
  });

  test("preserves consider optionality for an uncomplicated 6–8-mm component", async ({
    page,
  }) => {
    await fillSubsolid(page, {
      type: "Part-solid nodule",
      size: "10",
      component: "8",
      concern: "No / not established",
    });
    const results = await calculate(page);
    await expect(results).toContainText(
      "Consider CT at 3–6 months to confirm persistence",
    );
    await expect(results).toContainText("does not by itself trigger PET/CT");
  });

  test("escalates a greater-than-8-mm solid component and includes resection", async ({
    page,
  }) => {
    await fillSubsolid(page, {
      type: "Part-solid nodule",
      size: "12",
      component: "9",
      concern: "No / not established",
    });
    const results = await calculate(page);
    await expect(results).toContainText(
      "PET/CT, biopsy, or resection is recommended",
    );
    await expect(results).toContainText("solid component >8 mm");
  });

  test("rejects fractional measurements instead of assigning a threshold", async ({
    page,
  }) => {
    await fillSolid(page, { size: "5.5", risk: "Low risk (<5%)" });
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "pre-recorded whole-millimeter overall size",
    );
  });

  test("requires both axes for an overall size at least 10 mm", async ({
    page,
  }) => {
    await selectEligible(page);
    await selectRadio(page, "Selected Nodule Type", "Solid nodule");
    await selectRadio(page, "Number of Nodules", "Single nodule");
    await selectRadio(page, "Selected Nodule Size Category", measuredLabel);
    await fillInput(page, "Selected Nodule Overall Size", "10");
    await selectRadio(
      page,
      "Clinician-Estimated Malignancy Risk",
      "High risk (≥5%)",
    );
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "record both long- and short-axis diameters",
    );
  });

  test("rejects a solid component larger than the overall nodule", async ({
    page,
  }) => {
    await fillSubsolid(page, {
      type: "Part-solid nodule",
      size: "8",
      component: "9",
    });
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "cannot exceed the overall nodule size",
    );
  });

  test("rejects a contradictory all-below-6 cohort with a selected 6-mm nodule", async ({
    page,
  }) => {
    await fillSubsolid(page, {
      count: "Multiple nodules",
      size: "6",
      threshold: "Every nodule is <6 mm",
    });
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "conflicts with the statement that every nodule is <6 mm",
    );
  });

  test("invalidates a calculated result whenever its inputs change", async ({
    page,
  }) => {
    await fillSolid(page, { size: "6", risk: "Low risk (<5%)" });
    let results = await calculate(page);
    await expect(results).toContainText("CT at 6–12 months");
    await expect(page.getByRole("button", { name: "Copy results" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Print Results" })).toBeVisible();

    await fillInput(page, "Selected Nodule Overall Size", "9");
    await expect(
      page.getByRole("status", { name: "Calculator results" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Copy results" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Print Results" })).toHaveCount(0);

    results = await calculate(page);
    await expect(results).toContainText(
      "Consider CT at 3 months, PET/CT, or tissue sampling",
    );

    await selectRadio(
      page,
      "Fleischner 2017 Applicability",
      "Nodule was detected in a lung cancer screening program",
    );
    await expect(
      page.getByRole("status", { name: "Calculator results" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Copy results" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Print Results" })).toHaveCount(0);

    results = await calculate(page);
    await expect(results).toContainText("Lung-RADS");
    await expect(results).not.toContainText("Follow-up Interval:");
  });

  test("copies and prints only the current source-qualified result", async ({
    page,
  }) => {
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text) => {
            window.__radulatorClipboard = text;
          },
          readText: async () => window.__radulatorClipboard ?? "",
        },
      });
    });
    await fillSolid(page, { size: "6", risk: "Low risk (<5%)" });
    await calculate(page);

    await page.getByRole("button", { name: "Copy results" }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain(
      "Recommendation: CT at 6–12 months; then consider CT at 18–24 months",
    );
    expect(copied).toContain("Fleischner Society 2017");

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
  });

  test("shows corrected primary references and source-critical technique text", async ({
    page,
  }) => {
    await expect(page.getByText(/contiguous thin sections ≤1\.5 mm/i)).toBeVisible();
    await expect(page.getByText(/low-radiation technique/i)).toBeVisible();
    const showMore = page.getByRole("button", { name: /more reference/i });
    if (await showMore.count()) await showMore.click();
    await expect(
      page.locator('a[href="https://doi.org/10.1148/radiol.2017161659"]'),
    ).toBeVisible();
    await expect(
      page.locator('a[href="https://doi.org/10.1148/radiol.2017162894"]'),
    ).toBeVisible();
    await expect(
      page.locator('a[href="https://doi.org/10.1148/radiol.2017170044"]'),
    ).toHaveCount(0);
    await expect(page.getByText(/mediastinal window settings/i)).toHaveCount(0);
  });

  test("keeps the complete gate usable on a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole("radio", { name: eligibleLabel })).toBeVisible();
    await selectEligible(page);
    await expect(
      page.getByRole("radio", { name: "Pure ground-glass nodule" }),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});
