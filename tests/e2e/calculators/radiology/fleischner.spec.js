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
  if (size !== "lte3" && Number(size) >= 10) {
    await fillInput(page, "Overall Nodule Maximum Long Axis", String(size));
    await fillInput(
      page,
      "Overall Nodule Perpendicular Short Axis",
      String(size),
    );
  }
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
    morphology,
    temporal = "Baseline examination or no adequate prior comparison",
    longAxis,
    shortAxis,
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
  const numericSize = size === "lte3" ? 3 : Number(size);
  const needsAxes =
    size !== "lte3" &&
    (numericSize >= 10 ||
      (type === "Part-solid nodule" && numericSize >= 6));
  if (needsAxes) {
    const resolvedLongAxis =
      longAxis ?? Math.max(numericSize, Number(component ?? numericSize));
    const resolvedShortAxis =
      shortAxis ?? Math.max(1, 2 * numericSize - resolvedLongAxis);
    await fillInput(
      page,
      "Overall Nodule Maximum Long Axis",
      String(resolvedLongAxis),
    );
    await fillInput(
      page,
      "Overall Nodule Perpendicular Short Axis",
      String(resolvedShortAxis),
    );
  }
  await selectRadio(page, "Subsolid Nodule Comparison State", temporal);
  if (context) {
    await selectRadio(page, "Solitary 5 mm Subsolid-Nodule Context", context);
  }
  if (component !== undefined) {
    await fillInput(page, "Largest Solid Component", String(component));
  }
  if (morphology) {
    await selectRadio(
      page,
      "Particularly Suspicious Part-Solid Morphology",
      morphology,
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
      "CT at 3–6 months to determine persistence or resolution",
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
    await expect(results).toContainText("most suspicious nodule may not be the largest");
  });

  test("states the solitary pure-GGN horizon as until year 5", async ({
    page,
  }) => {
    await fillSubsolid(page, { size: "6" });
    const results = await calculate(page);
    await expect(results).toContainText("CT at 6–12 months to confirm persistence");
    await expect(results).toContainText("until year 5 from baseline");
  });

  test("keeps an uncomplicated below-6-mm component on surveillance", async ({
    page,
  }) => {
    await fillSubsolid(page, {
      type: "Part-solid nodule",
      size: "10",
      component: "5",
      morphology: "No particularly suspicious morphology",
      temporal: "Persistent and stable after the recommended initial follow-up",
    });
    const results = await calculate(page);
    await expect(results).toContainText("Annual CT for at least 5 years");
    await expect(results).not.toContainText(
      "PET/CT, biopsy, or resection is recommended",
    );
  });

  test("escalates suspicious morphology independently of component size", async ({
    page,
  }) => {
    await fillSubsolid(page, {
      type: "Part-solid nodule",
      size: "10",
      component: "5",
      morphology:
        "Yes — lobulated, cystic, or otherwise particularly suspicious",
    });
    const results = await calculate(page);
    await expect(results).toContainText(
      "PET/CT, biopsy, or resection is recommended",
    );
    await expect(results).toContainText(
      "independently of component size",
    );
    await expect(results).not.toContainText("Annual CT for at least 5 years");
  });

  test("keeps a baseline 6–8-mm component in the persistence-check phase", async ({
    page,
  }) => {
    await fillSubsolid(page, {
      type: "Part-solid nodule",
      size: "10",
      component: "8",
      morphology: "No particularly suspicious morphology",
    });
    const results = await calculate(page);
    await expect(results).toContainText(
      "Consider CT at 3–6 months to evaluate persistence",
    );
    await expect(results).toContainText("Persistence is not established");
  });

  test("escalates a greater-than-8-mm solid component and includes resection", async ({
    page,
  }) => {
    await fillSubsolid(page, {
      type: "Part-solid nodule",
      size: "12",
      component: "9",
      morphology: "No particularly suspicious morphology",
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
      "overall nodule maximum long axis and perpendicular short axis",
    );
  });

  test("accepts a component long axis larger than the rounded overall average", async ({
    page,
  }) => {
    await fillSubsolid(page, {
      type: "Part-solid nodule",
      size: "6",
      component: "7",
      morphology: "No particularly suspicious morphology",
    });
    const results = await calculate(page);
    await expect(results).toContainText(
      "Consider CT at 3–6 months to evaluate persistence",
    );
    await expect(results).toContainText("Solid Component: 7 mm");
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

  test("ignores a hidden 5-mm exception after the size leaves that pathway", async ({
    page,
  }) => {
    await fillSubsolid(page, {
      size: "5",
      context: "Selected suspicious subsolid nodule close to 6 mm",
    });
    let results = await calculate(page);
    await expect(results).toContainText("Consider CT at 2 and 4 years");

    await fillInput(page, "Selected Nodule Overall Size", "6");
    await expect(
      page.getByRole("radio", {
        name: "Selected suspicious subsolid nodule close to 6 mm",
      }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("status", { name: "Calculator results" }),
    ).toHaveCount(0);

    results = await calculate(page);
    await expect(results).toContainText(
      "CT at 6–12 months to confirm persistence",
    );
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  });

  test("separates pure-GGN baseline, persistence, growth, and solid transformation", async ({
    page,
  }) => {
    await fillSubsolid(page, { size: "6" });
    let results = await calculate(page);
    await expect(results).toContainText("CT at 6–12 months to confirm persistence");

    await selectRadio(
      page,
      "Subsolid Nodule Comparison State",
      "Persistent and stable after the recommended initial follow-up",
    );
    await expect(
      page.getByRole("status", { name: "Calculator results" }),
    ).toHaveCount(0);
    results = await calculate(page);
    await expect(results).toContainText("CT every 2 years until 5 years from baseline");

    await selectRadio(
      page,
      "Subsolid Nodule Comparison State",
      "Interval growth while remaining pure ground-glass",
    );
    await selectRadio(
      page,
      "Pure-Ground-Glass Growth Confirmation",
      "Linear change <2 mm or growth otherwise not established",
    );
    await expect(
      page.getByRole("status", { name: "Calculator results" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "at least 2 mm",
    );
    await selectRadio(
      page,
      "Pure-Ground-Glass Growth Confirmation",
      "Average diameter increased by ≥2 mm on comparable CT",
    );
    results = await calculate(page);
    await expect(results).toContainText("continued annual CT");
    await expect(results).toContainText("consider resection");

    await selectRadio(
      page,
      "Subsolid Nodule Comparison State",
      "New or growing solid component",
    );
    await selectRadio(
      page,
      "Solid-Component Evolution Confirmation",
      "A new measurable solid component developed",
    );
    await expect(
      page.getByRole("status", { name: "Calculator results" }),
    ).toHaveCount(0);
    results = await calculate(page);
    await expect(results).toContainText(
      "Recharacterize and evaluate the nodule as part-solid",
    );
    await expect(results).toContainText("No pure-ground-glass schedule");
  });

  test("separates part-solid baseline, stable persistence, and growing component", async ({
    page,
  }) => {
    await fillSubsolid(page, {
      type: "Part-solid nodule",
      size: "6",
      component: "5",
      morphology: "No particularly suspicious morphology",
    });
    let results = await calculate(page);
    await expect(results).toContainText(
      "CT at 3–6 months to determine persistence or resolution",
    );

    await selectRadio(
      page,
      "Subsolid Nodule Comparison State",
      "Persistent and stable after the recommended initial follow-up",
    );
    await expect(
      page.getByRole("status", { name: "Calculator results" }),
    ).toHaveCount(0);
    results = await calculate(page);
    await expect(results).toContainText("Annual CT for at least 5 years");

    await selectRadio(
      page,
      "Subsolid Nodule Comparison State",
      "New or growing solid component",
    );
    await selectRadio(
      page,
      "Solid-Component Evolution Confirmation",
      "Solid-component diameter increased by ≥2 mm on comparable CT",
    );
    await expect(
      page.getByRole("status", { name: "Calculator results" }),
    ).toHaveCount(0);
    results = await calculate(page);
    await expect(results).toContainText(
      "PET/CT, biopsy, or resection is recommended",
    );
  });

  test("validates a component against the actual overall long axis", async ({
    page,
  }) => {
    await fillSubsolid(page, {
      type: "Part-solid nodule",
      size: "6",
      longAxis: "7",
      shortAxis: "5",
      component: "7",
      morphology: "No particularly suspicious morphology",
    });
    let results = await calculate(page);
    await expect(results).toContainText("Overall Nodule Axes: 7 × 5 mm");
    await expect(results).toContainText("Solid Component: 7 mm");

    await fillInput(page, "Largest Solid Component", "8");
    await expect(
      page.getByRole("status", { name: "Calculator results" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "cannot exceed the overall nodule maximum long axis",
    );
  });

  test("defines multiple-subsolid comparison state at the cohort and most-suspicious-nodule level", async ({
    page,
  }) => {
    await fillSubsolid(page, {
      count: "Multiple nodules",
      size: "6",
      threshold: "At least one nodule is ≥6 mm",
    });
    let results = await calculate(page);
    await expect(results).toContainText("CT at 3–6 months");

    await selectRadio(
      page,
      "Subsolid Nodule Comparison State",
      "Interval growth while remaining pure ground-glass",
    );
    await selectRadio(
      page,
      "Pure-Ground-Glass Growth Confirmation",
      "Average diameter increased by ≥2 mm on comparable CT",
    );
    results = await calculate(page);
    await expect(results).toContainText(
      "Use case-specific evaluation based on the most suspicious nodule(s)",
    );
    await expect(results).toContainText(
      "Established interval growth while the selected most suspicious nodule remains pure ground-glass",
    );

    await selectRadio(
      page,
      "Subsolid Nodule Comparison State",
      "New or growing solid component",
    );
    await selectRadio(
      page,
      "Solid-Component Evolution Confirmation",
      "A new measurable solid component developed",
    );
    results = await calculate(page);
    await expect(results).toContainText(
      "New or growing solid component in the selected most suspicious nodule(s)",
    );
  });

  test("ignores hidden subsolid values after switching to a solid pathway", async ({
    page,
  }) => {
    await fillSubsolid(page, {
      type: "Part-solid nodule",
      size: "6",
      component: "5",
      morphology: "No particularly suspicious morphology",
      temporal: "Persistent and stable after the recommended initial follow-up",
    });
    await calculate(page);

    await selectRadio(page, "Selected Nodule Type", "Solid nodule");
    await selectRadio(
      page,
      "Clinician-Estimated Malignancy Risk",
      "Low risk (<5%)",
    );
    await expect(page.getByLabel("Largest Solid Component")).not.toBeVisible();
    await expect(
      page.getByRole("radio", {
        name: "Persistent and stable after the recommended initial follow-up",
      }),
    ).not.toBeVisible();
    const results = await calculate(page);
    await expect(results).toContainText(
      "CT at 6–12 months; then consider CT at 18–24 months",
    );
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
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
    await fillSubsolid(page, {
      type: "Part-solid nodule",
      size: "12",
      component: "8",
      morphology: "No particularly suspicious morphology",
      temporal: "Persistent and stable after the recommended initial follow-up",
    });
    const results = await calculate(page);
    await expect(results).toContainText("solid component ≥6 mm is highly suspicious");
    await expect(page.getByRole("button", { name: "Copy results" })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});
