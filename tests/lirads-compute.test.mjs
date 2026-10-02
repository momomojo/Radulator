import assert from "node:assert/strict";
import test from "node:test";

import "../scripts/register-jsx-loader.mjs";
import { LIRADS } from "../src/components/calculators/LIRADS.jsx";

// Regression vectors for the LI-RADS v2018 LR-M ordering fix. Source and
// locators: docs/evidence/lirads-lrm-order.md (ACR CT/MRI LI-RADS v2018 Core,
// printed pp. 8-10 and 22).

const LRM = "LR-M (Probably/Definitely Malignant, Not HCC-Specific)";
const CATEGORY_LABELS = {
  "LR-3": "LR-3 (Intermediate Probability)",
  "LR-4": "LR-4 (Probably HCC)",
  "LR-5": "LR-5 (Definitely HCC)",
};

const TARGETOID = [
  ["lrm_rim_aphe", "Rim APHE"],
  ["lrm_peripheral_washout", "Peripheral washout"],
  ["lrm_delayed_central_enhancement", "Delayed central enhancement"],
  ["lrm_targetoid_restriction", "Targetoid restriction on DWI"],
  ["lrm_targetoid_hbp", "Targetoid transitional/HBP appearance"],
];
const NONTARGETOID = [
  ["lrm_infiltrative", "Infiltrative appearance"],
  ["lrm_marked_restriction", "Marked diffusion restriction"],
  ["lrm_necrosis", "Necrosis/severe ischemia"],
  ["lrm_other", "Other non-HCC malignancy features"],
];
const MAJOR_FIELDS = ["observation_size", "aphe"];
const NONRIM_FIELDS = [
  "washout",
  "capsule",
  "threshold_growth",
  "ancillary_malignancy",
  "ancillary_hcc",
  "ancillary_benign",
];

const TIEBREAK_NOTE =
  "Nontargetoid LR-M features give LR-M only when LR-5 criteria are not met. If unsure between LR-M and this category, choose LR-M (v2018 tiebreaking: lower certainty of hepatocellular origin)";
const NO_FEATURE_ERROR =
  '"LR-M Features Present" is checked but no LR-M feature is selected. Select each LR-M feature present, or uncheck "LR-M Features Present" to use the diagnostic table.';
const BENIGNITY_ERROR =
  "Select an Observation Benignity option to continue (Indeterminate opens the LR-M and major-feature inputs).";
const NONTARGETOID_INCOMPLETE_ERROR =
  "Nontargetoid LR-M features make the observation LR-M only if it does not meet LR-5 criteria. Complete observation size, APHE, washout, capsule and threshold growth so LR-5 criteria can be checked.";
const SIZE_APHE_ERROR =
  "Please complete observation size and APHE assessment to determine LI-RADS category.";

const indeterminate = {
  high_risk_population: true,
  study_adequate: true,
  tumor_in_vein: false,
  benign_status: "indeterminate",
};

function majors(size, aphe, { washout = false, capsule = false, growth = false } = {}) {
  return {
    observation_size: String(size),
    aphe,
    washout: washout ? "present" : "absent",
    capsule: capsule ? "present" : "absent",
    threshold_growth: growth ? "present" : "absent",
  };
}

// Every diagnostic-table cell that meets LR-5 criteria, and cells that do not.
const LR5_CELLS = [
  ["10-19 mm, nonrim APHE + washout", majors(15, "nonrim", { washout: true })],
  ["10-19 mm, nonrim APHE + threshold growth", majors(15, "nonrim", { growth: true })],
  ["10-19 mm, nonrim APHE + washout + capsule", majors(15, "nonrim", { washout: true, capsule: true })],
  ["10-19 mm, nonrim APHE + capsule + threshold growth", majors(15, "nonrim", { capsule: true, growth: true })],
  ["exactly 10 mm, nonrim APHE + washout", majors(10, "nonrim", { washout: true })],
  [">=20 mm, nonrim APHE + washout", majors(25, "nonrim", { washout: true })],
  [">=20 mm, nonrim APHE + capsule", majors(25, "nonrim", { capsule: true })],
  [">=20 mm, nonrim APHE + threshold growth", majors(25, "nonrim", { growth: true })],
  ["exactly 20 mm, nonrim APHE + capsule", majors(20, "nonrim", { capsule: true })],
];
const NON_LR5_CELLS = [
  ["<20 mm, no APHE, no additional feature", majors(15, "none"), "LR-3"],
  ["<20 mm, no APHE, washout + capsule", majors(15, "none", { washout: true, capsule: true }), "LR-4"],
  [">=20 mm, no APHE, no additional feature", majors(25, "none"), "LR-3"],
  [">=20 mm, no APHE, all three features", majors(40, "none", { washout: true, capsule: true, growth: true }), "LR-4"],
  ["<10 mm, nonrim APHE, no additional feature", majors(8, "nonrim"), "LR-3"],
  ["<10 mm, nonrim APHE, all three features", majors(9.9, "nonrim", { washout: true, capsule: true, growth: true }), "LR-4"],
  ["10-19 mm, nonrim APHE, no additional feature", majors(15, "nonrim"), "LR-3"],
  ["10-19 mm, nonrim APHE + capsule only", majors(19.9, "nonrim", { capsule: true }), "LR-4"],
  [">=20 mm, nonrim APHE, no additional feature", majors(25, "nonrim"), "LR-4"],
];

function shownIds(vals) {
  return new Set(
    LIRADS.fields.filter((field) => !field.showIf || field.showIf(vals)).map((field) => field.id),
  );
}

// Independent statement of the v2018 CT/MRI diagnostic table (Core printed p. 8).
function expectedTableCategory(size, aphe, { washout, capsule, growth }) {
  const count = [washout, capsule, growth].filter(Boolean).length;
  if (aphe !== "nonrim") {
    if (size < 20) return count >= 2 ? "LR-4" : "LR-3";
    return count >= 1 ? "LR-4" : "LR-3";
  }
  if (size < 10) return count >= 1 ? "LR-4" : "LR-3";
  if (size < 20) {
    if (count >= 2) return "LR-5";
    if (count === 1) return capsule ? "LR-4" : "LR-5";
    return "LR-3";
  }
  return count >= 1 ? "LR-5" : "LR-4";
}

test("nontargetoid LR-M feature on an observation that meets LR-5 criteria stays LR-5", () => {
  for (const [id, label] of NONTARGETOID) {
    for (const [cell, values] of LR5_CELLS) {
      const result = LIRADS.compute({ ...indeterminate, has_lrm_features: true, [id]: true, ...values });
      assert.equal(result["LI-RADS Category"], CATEGORY_LABELS["LR-5"], `${id} / ${cell}`);
      assert.equal(result["LR-M Basis"], undefined, `${id} / ${cell}`);
      assert.equal(
        result["Nontargetoid LR-M Features"],
        `${label} (LR-M not assigned: LR-5 criteria met)`,
        `${id} / ${cell}`,
      );
      assert.ok(result["Clinical Notes"].startsWith(TIEBREAK_NOTE), `${id} / ${cell}: tiebreak note`);
    }
  }

  const all = Object.fromEntries(NONTARGETOID.map(([id]) => [id, true]));
  const result = LIRADS.compute({ ...indeterminate, has_lrm_features: true, ...all, ...LR5_CELLS[5][1] });
  assert.equal(result["LI-RADS Category"], CATEGORY_LABELS["LR-5"]);
  assert.equal(
    result["Nontargetoid LR-M Features"],
    `${NONTARGETOID.map(([, label]) => label).join("; ")} (LR-M not assigned: LR-5 criteria met)`,
  );
});

test("nontargetoid LR-M feature without LR-5 criteria is LR-M", () => {
  for (const [id, label] of NONTARGETOID) {
    for (const [cell, values, tableCategory] of NON_LR5_CELLS) {
      const result = LIRADS.compute({ ...indeterminate, has_lrm_features: true, [id]: true, ...values });
      assert.equal(result["LI-RADS Category"], LRM, `${id} / ${cell}`);
      assert.equal(result["LR-M Features Identified"], label, `${id} / ${cell}`);
      assert.equal(
        result["LR-M Basis"],
        `Nontargetoid mass with LR-M feature(s); LR-5 criteria not met (diagnostic table: ${tableCategory})`,
        `${id} / ${cell}`,
      );
      assert.equal(result.Recommendation, "Multidisciplinary discussion for tailored workup, which often includes biopsy");
      assert.equal(result._severity, "danger");
    }
  }
});

test("targetoid LR-M feature is LR-M regardless of major features", () => {
  const cells = [
    ...LR5_CELLS.map(([cell, values]) => [cell, values]),
    ...NON_LR5_CELLS.map(([cell, values]) => [cell, values]),
    ["no major features entered", {}],
  ];
  for (const [id, label] of TARGETOID) {
    for (const [cell, values] of cells) {
      const result = LIRADS.compute({ ...indeterminate, has_lrm_features: true, [id]: true, ...values });
      assert.equal(result["LI-RADS Category"], LRM, `${id} / ${cell}`);
      assert.equal(result["LR-M Features Identified"], label, `${id} / ${cell}`);
      assert.equal(result["LR-M Basis"], "Targetoid mass", `${id} / ${cell}`);
      assert.equal(result["Major Features"], undefined, `${id} / ${cell}: major features not read`);
    }
  }

  // Targetoid and nontargetoid together: listed in field order, still targetoid.
  const both = LIRADS.compute({
    ...indeterminate,
    has_lrm_features: true,
    lrm_peripheral_washout: true,
    lrm_necrosis: true,
    ...LR5_CELLS[5][1],
  });
  assert.equal(both["LI-RADS Category"], LRM);
  assert.equal(both["LR-M Features Identified"], "Peripheral washout; Necrosis/severe ischemia");
  assert.equal(both["LR-M Basis"], "Targetoid mass");

  // Rim APHE chosen in the APHE field is a targetoid appearance too.
  const rim = LIRADS.compute({
    ...indeterminate,
    has_lrm_features: true,
    lrm_infiltrative: true,
    observation_size: "25",
    aphe: "rim",
  });
  assert.equal(rim["LI-RADS Category"], LRM);
  assert.equal(rim["Key Feature"], "Rim APHE (peripheral > central enhancement)");
  assert.equal(rim["LR-M Features Identified"], "Infiltrative appearance");
});

test("major features stay visible for nontargetoid features and hide for targetoid ones", () => {
  const lrmOn = { ...indeterminate, has_lrm_features: true };
  const nonrimMajors = [...MAJOR_FIELDS, ...NONRIM_FIELDS];

  const noneSelected = shownIds(lrmOn);
  for (const id of [...nonrimMajors, ...TARGETOID.map(([f]) => f), ...NONTARGETOID.map(([f]) => f)]) {
    assert.ok(noneSelected.has(id), `${id} must be shown while no LR-M feature is selected`);
  }

  for (const [id] of NONTARGETOID) {
    const shown = shownIds({ ...lrmOn, [id]: true });
    for (const field of nonrimMajors) assert.ok(shown.has(field), `${id}: ${field} must stay visible`);
  }

  for (const [id] of TARGETOID) {
    const shown = shownIds({ ...lrmOn, [id]: true, lrm_necrosis: true });
    for (const field of nonrimMajors) assert.ok(!shown.has(field), `${id}: ${field} must be hidden`);
    for (const [feature] of [...TARGETOID, ...NONTARGETOID]) {
      assert.ok(shown.has(feature), `${id}: LR-M feature ${feature} stays visible`);
    }
  }

  // The LR-M feature list follows the whole chain, not only its own checkbox.
  for (const broken of [
    { benign_status: "definitely_benign" },
    { benign_status: "probably_benign" },
    { benign_status: "" },
    { tumor_in_vein: true },
    { study_adequate: false },
    { high_risk_population: false },
  ]) {
    const shown = shownIds({ ...lrmOn, lrm_rim_aphe: true, lrm_necrosis: true, ...broken });
    assert.ok(!shown.has("has_lrm_features"), JSON.stringify(broken));
    for (const [feature] of [...TARGETOID, ...NONTARGETOID]) {
      assert.ok(!shown.has(feature), `${feature} hidden when ${JSON.stringify(broken)}`);
    }
  }
});

test("LR-M Features Present with no feature selected is actionable, not a dead end", () => {
  const lrmOn = { ...indeterminate, has_lrm_features: true };
  for (const values of [{}, LR5_CELLS[0][1], NON_LR5_CELLS[1][1], { observation_size: "25", aphe: "rim" }]) {
    const result = LIRADS.compute({ ...lrmOn, ...values });
    assert.deepEqual(result, { Error: NO_FEATURE_ERROR }, JSON.stringify(values));
  }
  // The inputs the message points to are on screen, and so are the major features.
  const shown = shownIds(lrmOn);
  assert.ok(shown.has("has_lrm_features"));
  assert.ok(shown.has("observation_size") && shown.has("aphe"));

  // Unchecking the box categorizes from the visible major features.
  const unchecked = LIRADS.compute({ ...lrmOn, has_lrm_features: false, ...LR5_CELLS[0][1] });
  assert.equal(unchecked["LI-RADS Category"], CATEGORY_LABELS["LR-5"]);
});

test("nontargetoid feature with incomplete major features asks for them", () => {
  for (const [id] of NONTARGETOID) {
    for (const partial of [{}, { observation_size: "25" }, { aphe: "nonrim" }]) {
      const result = LIRADS.compute({ ...indeterminate, has_lrm_features: true, [id]: true, ...partial });
      assert.deepEqual(result, { Error: NONTARGETOID_INCOMPLETE_ERROR }, `${id} ${JSON.stringify(partial)}`);
    }
  }
  // Without LR-M features the original prompt is unchanged.
  assert.deepEqual(LIRADS.compute({ ...indeterminate }), { Error: SIZE_APHE_ERROR });
});

test("unselected benignity asks for the visible input instead of hidden fields", () => {
  const base = { high_risk_population: true, study_adequate: true, tumor_in_vein: false };
  for (const stale of [{}, LR5_CELLS[5][1], { has_lrm_features: true, lrm_rim_aphe: true }]) {
    assert.deepEqual(LIRADS.compute({ ...base, ...stale }), { Error: BENIGNITY_ERROR }, JSON.stringify(stale));
  }
  const shown = shownIds(base);
  assert.ok(shown.has("benign_status"));
  assert.ok(!shown.has("observation_size") && !shown.has("has_lrm_features"));
});

test("stale values in hidden fields never change the category", () => {
  // Unchecked LR-M box: previously ticked LR-M features are hidden and ignored.
  for (const [id] of [...TARGETOID, ...NONTARGETOID]) {
    const lr5 = LIRADS.compute({ ...indeterminate, has_lrm_features: false, [id]: true, ...LR5_CELLS[5][1] });
    assert.equal(lr5["LI-RADS Category"], CATEGORY_LABELS["LR-5"], id);
    assert.equal(lr5["Nontargetoid LR-M Features"], undefined, id);
    const lr4 = LIRADS.compute({ ...indeterminate, has_lrm_features: false, [id]: true, ...NON_LR5_CELLS[1][1] });
    assert.equal(lr4["LI-RADS Category"], CATEGORY_LABELS["LR-4"], id);
  }

  // Targetoid feature hides the major features: their values are not read.
  const withStale = LIRADS.compute({
    ...indeterminate,
    has_lrm_features: true,
    lrm_targetoid_hbp: true,
    ...LR5_CELLS[5][1],
    ancillary_benign: "size_stability",
  });
  const without = LIRADS.compute({ ...indeterminate, has_lrm_features: true, lrm_targetoid_hbp: true });
  assert.deepEqual(withStale, without);

  // Benign categories and earlier steps ignore stale LR-M and major values.
  const stale = { has_lrm_features: true, lrm_rim_aphe: true, lrm_necrosis: true, ...LR5_CELLS[5][1] };
  assert.match(
    LIRADS.compute({ ...indeterminate, ...stale, benign_status: "definitely_benign" })["LI-RADS Category"],
    /^LR-1 /,
  );
  assert.match(
    LIRADS.compute({ ...indeterminate, ...stale, benign_status: "probably_benign" })["LI-RADS Category"],
    /^LR-2 /,
  );
  assert.match(LIRADS.compute({ ...indeterminate, ...stale, tumor_in_vein: true })["LI-RADS Category"], /^LR-TIV /);
  assert.match(LIRADS.compute({ ...indeterminate, ...stale, study_adequate: false })["LI-RADS Category"], /^LR-NC /);

  // Rim APHE hides washout, capsule, threshold growth and ancillary features.
  const rim = { ...indeterminate, observation_size: "25", aphe: "rim" };
  assert.deepEqual(
    LIRADS.compute({ ...rim, washout: "present", capsule: "present", ancillary_benign: "size_stability" }),
    LIRADS.compute(rim),
  );
});

test("compute output is invariant to every hidden field's value", () => {
  const scenarios = [
    {},
    { high_risk_population: true },
    { high_risk_population: true, study_adequate: true },
    { high_risk_population: true, study_adequate: true, tumor_in_vein: true },
    { ...indeterminate, benign_status: "definitely_benign" },
    { ...indeterminate, benign_status: "probably_benign" },
    { ...indeterminate },
    { ...indeterminate, ...LR5_CELLS[0][1] },
    { ...indeterminate, ...NON_LR5_CELLS[0][1], ancillary_malignancy: "corona" },
    { ...indeterminate, ...LR5_CELLS[5][1], ancillary_benign: "size_stability" },
    { ...indeterminate, has_lrm_features: true },
    { ...indeterminate, has_lrm_features: true, lrm_rim_aphe: true },
    { ...indeterminate, has_lrm_features: true, lrm_necrosis: true, ...LR5_CELLS[6][1] },
    { ...indeterminate, has_lrm_features: true, lrm_other: true, ...NON_LR5_CELLS[8][1] },
    { ...indeterminate, observation_size: "25", aphe: "rim" },
  ];
  const valuesFor = (field) => {
    if (field.type === "checkbox") return [true, false];
    if (field.type === "number") return ["5", "15", "25"];
    return [...field.opts.map((opt) => opt.value), ""];
  };
  let checked = 0;
  for (const scenario of scenarios) {
    const baseline = LIRADS.compute(scenario);
    const shown = shownIds(scenario);
    for (const field of LIRADS.fields.filter((candidate) => !shown.has(candidate.id))) {
      for (const value of valuesFor(field)) {
        assert.deepEqual(
          LIRADS.compute({ ...scenario, [field.id]: value }),
          baseline,
          `${JSON.stringify(scenario)}: hidden ${field.id}=${JSON.stringify(value)} changed the result`,
        );
        checked += 1;
      }
    }
  }
  assert.ok(checked > 200, `expected a broad hidden-value sweep, got ${checked}`);
});

test("step 1 order: LR-NC, LR-TIV, LR-1, LR-2, LR-M, then the diagnostic table", () => {
  const everything = {
    high_risk_population: true,
    study_adequate: true,
    tumor_in_vein: true,
    benign_status: "definitely_benign",
    has_lrm_features: true,
    lrm_rim_aphe: true,
    ...LR5_CELLS[5][1],
  };
  const ladder = [
    [{ study_adequate: false }, /^LR-NC /],
    [{}, /^LR-TIV /],
    [{ tumor_in_vein: false }, /^LR-1 /],
    [{ tumor_in_vein: false, benign_status: "probably_benign" }, /^LR-2 /],
    [{ tumor_in_vein: false, benign_status: "indeterminate" }, /^LR-M /],
    [{ tumor_in_vein: false, benign_status: "indeterminate", has_lrm_features: false }, /^LR-5 /],
  ];
  for (const [overrides, expected] of ladder) {
    assert.match(LIRADS.compute({ ...everything, ...overrides })["LI-RADS Category"], expected);
  }
});

test("ancillary features apply after the LR-M decision", () => {
  const necrosis = { ...indeterminate, has_lrm_features: true, lrm_necrosis: true };

  // Not meeting LR-5 criteria: LR-M, whatever the ancillary features.
  for (const ancillary of [
    { ancillary_malignancy: "corona" },
    { ancillary_hcc: "mosaic" },
    { ancillary_benign: "size_stability" },
  ]) {
    const result = LIRADS.compute({ ...necrosis, ...NON_LR5_CELLS[0][1], ...ancillary });
    assert.equal(result["LI-RADS Category"], LRM, JSON.stringify(ancillary));
  }

  // Meeting LR-5 criteria: LR-5 from step 1, then the step 2 adjustment.
  const downgraded = LIRADS.compute({ ...necrosis, ...LR5_CELLS[5][1], ancillary_benign: "size_stability" });
  assert.equal(downgraded["LI-RADS Category"], CATEGORY_LABELS["LR-4"]);
  assert.equal(downgraded["Base Category (before ancillary)"], "LR-5");
  assert.ok(downgraded["Clinical Notes"].startsWith(TIEBREAK_NOTE));

  const conflicting = LIRADS.compute({
    ...necrosis,
    ...LR5_CELLS[5][1],
    ancillary_malignancy: "corona",
    ancillary_benign: "size_stability",
  });
  assert.equal(conflicting["LI-RADS Category"], CATEGORY_LABELS["LR-5"]);
});

test("diagnostic table is unchanged when no LR-M feature is present", () => {
  const sizes = [5, 9, 9.9, 10, 15, 19, 19.9, 20, 25, 40];
  let vectors = 0;
  for (const size of sizes) {
    for (const aphe of ["none", "nonrim"]) {
      for (const washout of [false, true]) {
        for (const capsule of [false, true]) {
          for (const growth of [false, true]) {
            const flags = { washout, capsule, growth };
            const expected = expectedTableCategory(size, aphe, flags);
            const values = majors(size, aphe, flags);
            const plain = LIRADS.compute({ ...indeterminate, ...values });
            assert.equal(plain["LI-RADS Category"], CATEGORY_LABELS[expected], JSON.stringify(values));

            const nontargetoid = LIRADS.compute({
              ...indeterminate,
              has_lrm_features: true,
              lrm_marked_restriction: true,
              ...values,
            });
            assert.equal(
              nontargetoid["LI-RADS Category"],
              expected === "LR-5" ? CATEGORY_LABELS["LR-5"] : LRM,
              `nontargetoid ${JSON.stringify(values)}`,
            );

            const targetoid = LIRADS.compute({
              ...indeterminate,
              has_lrm_features: true,
              lrm_delayed_central_enhancement: true,
              ...values,
            });
            assert.equal(targetoid["LI-RADS Category"], LRM, `targetoid ${JSON.stringify(values)}`);
            vectors += 1;
          }
        }
      }
    }
  }
  assert.equal(vectors, 160);
});

const TG_SUBLABEL =
  "Mass size up ≥50% within ≤6 months vs a prior CT/MRI. A new ≥10 mm observation in ≤24 months, or ≥100% growth over >6 months, is subthreshold growth (ancillary feature), not threshold growth";
const TG_NOTE =
  "Threshold growth (v2018): a mass grew ≥50% within ≤6 months vs a prior CT/MRI. A new ≥10 mm observation in ≤24 months or ≥100% growth over >6 months is subthreshold growth instead, an ancillary feature that upgrades at most to LR-4";
const SUBTHRESHOLD_LABEL =
  "Subthreshold growth (growth below threshold, e.g. new ≥10 mm observation in ≤24 months or ≥100% over >6 months)";
const BENIGN_AF = ["size_stability", "size_reduction", "parallels_blood_pool", "undistorted_vessels", "iron_in_mass", "marked_t2", "hbp_iso"];
const ONE_STEP_DOWN = { "LR-5": "LR-4", "LR-4": "LR-3", "LR-3": "LR-2" };
const LR2_LABEL = "LR-2 (Probably Benign)";

test("threshold growth follows v2018: a new >=10 mm observation is subthreshold growth", () => {
  const threshold = LIRADS.fields.find((field) => field.id === "threshold_growth");
  assert.equal(threshold.subLabel, TG_SUBLABEL);
  const option = LIRADS.fields
    .find((field) => field.id === "ancillary_malignancy")
    .opts.find((opt) => opt.value === "subthreshold_growth");
  assert.equal(option.label, SUBTHRESHOLD_LABEL);

  // No visible text may still count a new observation as threshold growth.
  const visibleText = JSON.stringify(
    LIRADS.fields.map((field) => [field.label, field.subLabel, (field.opts ?? []).map((opt) => opt.label)]),
  );
  assert.doesNotMatch(visibleText, /or new observation ≥\s?10\s?mm/i);

  // True threshold growth: 10-19 mm nonrim APHE + threshold growth is LR-5, with the v2018 note.
  const trueGrowth = LIRADS.compute({ ...indeterminate, ...majors(15, "nonrim", { growth: true }) });
  assert.equal(trueGrowth["LI-RADS Category"], CATEGORY_LABELS["LR-5"]);
  assert.ok(trueGrowth["Clinical Notes"].includes(TG_NOTE));
  assert.doesNotMatch(trueGrowth["Clinical Notes"], /or new observation ≥10mm/);

  // The same observation first seen as a new >=10 mm lesion: subthreshold growth, LR-4 at most.
  for (const [values, expected] of [
    [majors(15, "nonrim"), "LR-4"], // LR-3 -> LR-4
    [majors(10, "nonrim"), "LR-4"],
    [majors(15, "none"), "LR-4"], // LR-3 -> LR-4
    [majors(25, "nonrim"), "LR-4"], // LR-4 stays LR-4, never LR-5
    [majors(15, "nonrim", { capsule: true }), "LR-4"],
    [majors(8, "nonrim", { washout: true }), "LR-4"],
    [majors(25, "nonrim", { washout: true }), "LR-5"], // already LR-5 from the table
  ]) {
    const result = LIRADS.compute({ ...indeterminate, ...values, ancillary_malignancy: "subthreshold_growth" });
    assert.equal(result["LI-RADS Category"], CATEGORY_LABELS[expected], JSON.stringify(values));
  }
});

test("ancillary features favoring benignity downgrade exactly one category, including LR-3 to LR-2", () => {
  const sizes = [5, 9.9, 10, 15, 19.9, 20, 25];
  let vectors = 0;
  for (const size of sizes) {
    for (const aphe of ["none", "nonrim"]) {
      for (const washout of [false, true]) {
        for (const capsule of [false, true]) {
          for (const growth of [false, true]) {
            const flags = { washout, capsule, growth };
            const table = expectedTableCategory(size, aphe, flags);
            const values = { ...indeterminate, ...majors(size, aphe, flags) };
            for (const benign of BENIGN_AF) {
              const result = LIRADS.compute({ ...values, ancillary_benign: benign });
              const expected = ONE_STEP_DOWN[table];
              assert.equal(
                result["LI-RADS Category"],
                expected === "LR-2" ? LR2_LABEL : CATEGORY_LABELS[expected],
                `${table} + ${benign}`,
              );
              assert.equal(result["Base Category (before ancillary)"], table);
              assert.equal(
                result["Ancillary Adjustment"],
                `Downgraded from ${table} to ${expected} based on ancillary features favoring benignity`,
              );
              vectors += 1;
            }
            // Other side of the rule: both kinds present -> no adjustment at all.
            for (const conflict of [{ ancillary_malignancy: "corona" }, { ancillary_hcc: "mosaic" }]) {
              const result = LIRADS.compute({ ...values, ancillary_benign: "size_stability", ...conflict });
              assert.equal(result["LI-RADS Category"], CATEGORY_LABELS[table], `${table} conflicting`);
              assert.equal(result["Base Category (before ancillary)"], undefined);
            }
          }
        }
      }
    }
  }
  assert.equal(vectors, 7 * 2 * 8 * BENIGN_AF.length);

  // The LR-2 reached by downgrade carries the probably-benign texts and is never LR-1.
  const lr2 = LIRADS.compute({ ...indeterminate, ...majors(15, "none"), ancillary_benign: "size_stability" });
  assert.equal(lr2["LI-RADS Category"], LR2_LABEL);
  assert.equal(lr2["HCC Probability"], "~14%");
  assert.equal(lr2.Recommendation, "Return to surveillance in 6 months; consider repeat diagnostic imaging in ≤6 months");
  assert.equal(lr2._severity, "success");

  // Malignancy side unchanged: up one category, never to LR-5.
  for (const [values, expected] of [
    [majors(15, "none"), "LR-4"],
    [majors(25, "nonrim"), "LR-4"],
    [majors(25, "nonrim", { washout: true }), "LR-5"],
  ]) {
    const result = LIRADS.compute({ ...indeterminate, ...values, ancillary_malignancy: "corona" });
    assert.equal(result["LI-RADS Category"], CATEGORY_LABELS[expected]);
  }

  // LR-M is decided before ancillary features, so a benign feature cannot turn it into LR-2.
  const lrm = LIRADS.compute({
    ...indeterminate,
    has_lrm_features: true,
    lrm_necrosis: true,
    ...majors(15, "none"),
    ancillary_benign: "size_stability",
  });
  assert.equal(lrm["LI-RADS Category"], LRM);
});

test("ACR reference points to the live LI-RADS page", () => {
  const urls = LIRADS.refs.map((ref) => ref.u);
  assert.ok(
    urls.includes("https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/LI-RADS"),
  );
  assert.ok(!urls.some((url) => url.includes("acr.org/Clinical-Resources/Reporting-and-Data-Systems/LI-RADS")));
});

test("reworded checkbox subLabels", () => {
  const subLabel = (id) => LIRADS.fields.find((field) => field.id === id).subLabel;
  assert.equal(
    subLabel("high_risk_population"),
    "Adults (≥18 y) with cirrhosis, chronic hepatitis B, or current/prior HCC; excludes cirrhosis from congenital hepatic fibrosis or vascular disorders (required)",
  );
  assert.equal(
    subLabel("study_adequate"),
    "No image omission or degradation that prevents categorization (otherwise LR-NC)",
  );
  assert.equal(
    subLabel("tumor_in_vein"),
    "Unequivocal enhancing soft tissue within a vein, with or without a visible parenchymal mass; if unsure, leave unchecked",
  );
  assert.equal(
    subLabel("has_lrm_features"),
    "Targetoid mass, or a nontargetoid mass not meeting LR-5 criteria with infiltrative appearance, marked diffusion restriction, necrosis/severe ischemia, or another non-HCC feature",
  );
});
