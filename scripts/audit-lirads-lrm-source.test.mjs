#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import process from "node:process";

// 1. Live exact-head audit (retrieves and pins the ACR PDF).
const run = spawnSync(
  process.execPath,
  ["--import", "./scripts/register-jsx-loader.mjs", "scripts/audit-lirads-lrm-source.mjs", "--json"],
  { cwd: process.cwd(), encoding: "utf8" },
);
assert.equal(run.status, 0, `LI-RADS LR-M primary-source audit failed\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`);

// 2. Actual-export compute vectors.
const computeTests = spawnSync(
  process.execPath,
  ["--import", "./scripts/register-jsx-loader.mjs", "--test", "tests/lirads-compute.test.mjs"],
  { cwd: process.cwd(), encoding: "utf8" },
);
assert.equal(
  computeTests.status,
  0,
  `LI-RADS actual-export tests failed\nstdout:\n${computeTests.stdout}\nstderr:\n${computeTests.stderr}`,
);

const audit = JSON.parse(run.stdout);
assert.equal(audit.schema, "radulator-lirads-lrm-source-audit/v1");
assert.equal(audit.calculator_id, "lirads");
assert.equal(audit.calculator_path, "src/components/calculators/LIRADS.jsx");

const PDF_URL =
  "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/LI-RADS/LI-RADS-CT-MRI-2018-Core.pdf";
const { retrieval_attempts: attempts, ...source } = audit.source;
assert.ok(Number.isInteger(attempts) && attempts >= 1);
assert.deepEqual(source, {
  key: "acr-lirads-ctmri-v2018-core",
  authority: "American College of Radiology",
  document: "ACR CT/MRI LI-RADS v2018 Core",
  landing_page:
    "https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/LI-RADS",
  url: PDF_URL,
  final_url: PDF_URL,
  media_type: "application/pdf",
  pin: "raw-bytes",
  bytes: 1840136,
  sha256: "89fddfbd66641f37055fc16082f338bc4fec880f3d3e0042a7a9b6b69f4acfb4",
  pages: 61,
});

// Each source statement is pinned by the SHA-256 of its exact normalized span at the locator.
assert.deepEqual(
  audit.source_statements.map(({ id, locator, pdf_page, printed_page, spans }) => [
    id,
    locator,
    pdf_page,
    printed_page ?? null,
    spans.map(({ length, sha256 }) => `${length}:${sha256}`),
  ]),
  [
    ["core-identity", "Cover", 1, null, ["46:dac6972eebaae2fef0c2eb336dd0a7b9f0cb69580d032bb4eb05e0cbb13d84f8"]],
    [
      "whats-new-lr5-criteria-are-table",
      "What's New in v2018, revised LR-5 criteria",
      7,
      4,
      ["201:c5d1738d5adcc0ca7fd2293c0114cfd52328b2495d1a769ee49026f902c7214c"],
    ],
    [
      "getting-started-population",
      "Getting Started, population",
      9,
      6,
      [
        "178:a72fcc1a125bb4ceff17de7f5823a7530e32d213ea6bd2cbf85536a894dda389",
        "285:a085aa617dbecd29e7cef2b2a0b91a48626d0765381d5e4371c26d27b73ffe57",
      ],
    ],
    [
      "categories-lr-nc",
      "Categories, LR-NC",
      10,
      7,
      ["49:b94dbbea8e6c49874cc29a81692ddef5e51b2a6fa172c5adaf4fca6614bc7d46"],
    ],
    [
      "step1-diagnostic-algorithm",
      "Step 1, diagnostic algorithm branches",
      11,
      8,
      [
        "43:0d2bee42bf7b2cdf5d8adeae991e244aecc6e9e55c46af23f4c15435331788ab",
        "376:3f9290cfbe05a36f459e5fc0a73cb0dce21ab3d07cf94b3e6705de0c581ed7d2",
      ],
    ],
    [
      "step1-diagnostic-table",
      "Step 1, CT/MRI Diagnostic Table and its split cell",
      11,
      8,
      ["342:3ec838d383ad68e8da92cee3f9c7faa3c95f4f78a201cbd10b4dd374b2876a25"],
    ],
    [
      "step2-ancillary-features",
      "Step 2, ancillary features",
      12,
      9,
      [
        "42:b40ea2271a94b02f9160888f0b2bcd5c06bb4bae4a755f63d8fbfd887917430a",
        "142:bcf5daf2506a7fd1a748be8befb2411c401c06e6aa833d831c2c6e0c7106e3b0",
        "45:8ea908939807307f37de2436107c33ff8dd6ee1e928c31fa057da55c735d4a82",
        "176:2dca9611cd2c173d4b9b7116369cd7f3ac17525c88794147744ac5d086b748ec",
      ],
    ],
    [
      "whats-new-threshold-growth",
      "What's New in v2018, threshold growth",
      7,
      4,
      ["420:a228100c6bb75b8e8e30c4c6d3b67f4824464907d665d8db1528bc1ac275daad"],
    ],
    [
      "threshold-growth-definition",
      "Major Imaging Features, threshold growth",
      23,
      20,
      ["471:7a4e216900f4bee184a598d7c96ce0271dcff34ffafcc2ed80c208b7741bb505"],
    ],
    [
      "ancillary-subthreshold-growth",
      "Ancillary features favoring malignancy, subthreshold growth",
      27,
      24,
      ["112:779434719ec7815f159c2e6d51e57b53f6968ed3403cf08acab3b6d515dc3185"],
    ],
    [
      "step3-tiebreaking",
      "Step 3, tiebreaking rules",
      13,
      10,
      [
        "35:4d388c3d746830cd7eac65732556a7ffb0b9f928cb355f98046ff3df47f73a2e",
        "49:171b889bb4239d2a774354155730918e9bd42e0473ad98a4ee0603e0c7529370",
        "65:5e7ce025c3b462dd10ff48ec2ba52d60cf0cc3ed61510c7253d17fe70281e9e7",
        "36:c206896ffc31c102ad84e489043515544072cba440c258d82cd50735a17b1204",
      ],
    ],
    [
      "tumor-in-vein-definition",
      "Tumor in Vein, definition",
      24,
      21,
      ["79:f1aec3c02927d34e37bed11ad408cfb9c768868e6e7bdcb94357116617455dac"],
    ],
    [
      "lrm-criteria",
      "LR-M Criteria",
      25,
      22,
      [
        "57:1b904b7c1dfe0362cb7da7f4d39e74ac65b7b51be9b79812f9a2e62c8f582fcd",
        "305:26bca7eaa599779fb3a1d4d6675a515e29cde8cf371da1a37482f92a3d252ba3",
        "649:88c511367b897af59943889ac16f60d9e1ee44972a4e797f303f078a2ca8b9d3",
      ],
    ],
    [
      "faq-infiltrative-not-lr5-is-lrm",
      "FAQs, Diagnosis: infiltrative mass",
      42,
      39,
      ["395:35587bc5aec1467370a80a59e46c5b7262ba3526ea2de69958a3e2de249ae116"],
    ],
  ],
);
for (const statement of audit.source_statements) {
  assert.equal(typeof statement.paraphrase, "string", `${statement.id}: paraphrase`);
  for (const span of statement.spans) {
    for (const marker of [span.from, span.to]) {
      assert.ok(marker.split(/\s+/).length <= 6, `${statement.id}: marker ${JSON.stringify(marker)} exceeds six words`);
    }
  }
}

// Layout read from the PDF's text coordinates.
assert.deepEqual(
  audit.layout.step1_order.map(({ step }) => step),
  ["LR-NC", "LR-TIV", "LR-1", "LR-2", "LR-M", "diagnostic-table", "LR-3", "LR-4", "LR-5"],
);
assert.deepEqual(audit.layout.diagnostic_table, {
  none: ["LR-3", "LR-3", "LR-3", "LR-3", "LR-4"],
  one: ["LR-3", "LR-4", "LR-4", "LR-4|LR-5", "LR-5"],
  two: ["LR-4", "LR-4", "LR-4", "LR-5", "LR-5"],
});
assert.deepEqual(audit.layout.step2_ladder, {
  bar_y: 515,
  bar_order: ["LR-1", "LR-2", "LR-3", "LR-4", "LR-5"],
  forbidden_move_x: 422.8,
  upgrade_label_y: 580.3,
  downgrade_label_y: 463.9,
});
// In-memory edits of the real page text must each break the named statement's pin.
assert.deepEqual(audit.source_mutations, [
  { statement_id: "whats-new-threshold-growth", find: "≥ 50%", replace: "≥ 40%", detected: true },
  { statement_id: "whats-new-threshold-growth", find: "≤ 24 months", replace: "≤ 12 months", detected: true },
  { statement_id: "threshold-growth-definition", find: "≤ 6 months", replace: "≤ 12 months", detected: true },
  { statement_id: "ancillary-subthreshold-growth", find: "less than threshold", replace: "more than threshold", detected: true },
  { statement_id: "step2-ancillary-features", find: "downgrade by 1", replace: "downgrade by 2", detected: true },
  { statement_id: "lrm-criteria", find: "Not meeting LR", replace: "Meeting LR", detected: true },
]);
assert.deepEqual(audit.layout.lrm_condition_box, {
  targetoid_line_y: 640.9,
  or_y: 616.9,
  nontargetoid_list_y: [512.5, 565.3],
  condition_box_y: [545.5, 532.3],
});
assert.deepEqual(audit.layout.tiebreak_label, { lr4_lr5_row_y: 389.5, lrm_y: 339.6, label_y: [369.6, 356.4] });

assert.deepEqual(
  audit.claim_bindings.map(({ claim_id, source_statement_ids }) => [claim_id, source_statement_ids]),
  [
    ["step1-order", ["step1-diagnostic-algorithm", "categories-lr-nc"]],
    ["targetoid-mass-is-lrm", ["lrm-criteria"]],
    [
      "nontargetoid-lrm-only-if-not-lr5",
      ["lrm-criteria", "whats-new-lr5-criteria-are-table", "step1-diagnostic-table", "faq-infiltrative-not-lr5-is-lrm"],
    ],
    ["lr5-criteria-are-the-diagnostic-table", ["step1-diagnostic-table", "whats-new-lr5-criteria-are-table"]],
    ["lrm-decided-before-ancillary-features", ["step1-diagnostic-algorithm", "step2-ancillary-features"]],
    ["tiebreak-note-lrm-vs-lr5", ["step3-tiebreaking"]],
    ["sublabel-high-risk-population", ["getting-started-population"]],
    ["sublabel-study-adequate", ["categories-lr-nc", "step1-diagnostic-algorithm"]],
    ["sublabel-tumor-in-vein", ["tumor-in-vein-definition", "step3-tiebreaking"]],
    ["result-tumor-in-vein-definition", ["tumor-in-vein-definition"]],
    ["sublabel-has-lrm-features", ["lrm-criteria"]],
    [
      "threshold-growth-v2018",
      [
        "whats-new-threshold-growth",
        "threshold-growth-definition",
        "ancillary-subthreshold-growth",
        "step2-ancillary-features",
      ],
    ],
    ["benign-ancillary-downgrade-one-category", ["step2-ancillary-features"]],
    ["acr-reference-is-live-landing-page", ["core-identity"]],
  ],
);
const bindings = new Map(audit.claim_bindings.map(({ claim_id, runtime }) => [claim_id, runtime]));
assert.deepEqual(bindings.get("step1-order"), {
  runtime_order: ["LR-NC", "LR-TIV", "LR-1", "LR-2", "LR-M", "diagnostic-table"],
});
assert.equal(bindings.get("lr5-criteria-are-the-diagnostic-table").table_vectors, 104);
assert.deepEqual(bindings.get("nontargetoid-lrm-only-if-not-lr5"), {
  nontargetoid_fields: ["lrm_infiltrative", "lrm_marked_restriction", "lrm_necrosis", "lrm_other"],
  lr5_kept: 128,
  lrm_assigned: 288,
  major_features_visible_when_nontargetoid: true,
});
assert.equal(bindings.get("targetoid-mass-is-lrm").vectors, 521);
assert.deepEqual(bindings.get("result-tumor-in-vein-definition"), {
  category: "LR-TIV (Tumor in Vein)",
  definition: "Definite tumor in vein: unequivocal enhancing soft tissue in a vein, with or without a visible parenchymal mass",
});
assert.equal(bindings.get("tiebreak-note-lrm-vs-lr5").results_checked, 128);
assert.equal(bindings.get("lrm-decided-before-ancillary-features").lr5_then_benign_downgrade, "LR-4 (Probably HCC)");
assert.deepEqual(bindings.get("threshold-growth-v2018"), {
  field_subLabel:
    "Mass size up ≥50% within ≤6 months vs a prior CT/MRI. A new ≥10 mm observation, or ≥100% growth over >6 months, is subthreshold growth (ancillary feature), not threshold growth",
  result_note:
    "Threshold growth (v2018): a mass grew ≥50% within ≤6 months vs a prior CT/MRI. A new ≥10 mm observation or ≥100% growth over >6 months is subthreshold growth instead, an ancillary feature that upgrades at most to LR-4",
  subthreshold_option:
    "Subthreshold growth (growth below threshold, e.g. new ≥10 mm observation in ≤24 months or ≥100% over >6 months)",
  subthreshold_vectors: 104,
  new_observation_10_19mm_nonrim_aphe: "LR-4 (Probably HCC)",
});
assert.deepEqual(bindings.get("benign-ancillary-downgrade-one-category"), {
  benign_values: [
    "size_stability",
    "size_reduction",
    "parallels_blood_pool",
    "undistorted_vessels",
    "iron_in_mass",
    "marked_t2",
    "hbp_iso",
  ],
  downgrade_vectors: 728,
  lr3_to_lr2: "LR-2 (Probably Benign)",
  mixed_no_adjustment: true,
});
assert.deepEqual(bindings.get("acr-reference-is-live-landing-page"), {
  reference_url: "https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/LI-RADS",
});
assert.deepEqual(audit.app_guardrails, {
  provenance: "radulator-data-entry-guardrail",
  publication_derived: false,
  actionable_errors: ["lrmWithoutFeature", "benignityUnselected", "nontargetoidIncomplete"],
  hidden_field_scenarios: 14,
  hidden_field_mutations: 547,
});
assert.deepEqual(audit.scope, {
  not_asserted: [
    "ancillary-feature adjustment of LR-1 and LR-2 chosen directly in the benignity question",
    "LR-M and LR-5 probability figures",
    "management recommendations",
    "whole-calculator clinical acceptance",
  ],
});
assert.equal(audit.source_bytes_committed, false);

// 3. Mutation checks (offline): every guard must reject a deliberate break.
await import("./register-jsx-loader.mjs");
const auditModule = await import("./audit-lirads-lrm-source.mjs");
const { LIRADS } = await import("../src/components/calculators/LIRADS.jsx");
const {
  SOURCE,
  STATEMENTS,
  EXPECTED_TABLE,
  TARGETOID_FIELDS,
  NONTARGETOID_FIELDS,
  RUNTIME_TIEBREAK_NOTE,
  RUNTIME_THRESHOLD_GROWTH,
  MAX_RETRY_AFTER_MS,
  verifyRuntime,
  checkSpans,
  spanDigest,
  compact,
  assertRawBytePin,
  assertArtifactIdentity,
  checkStep1Order,
  parseDiagnosticTable,
  checkLrmConditionPlacement,
  checkTiebreakLabelPlacement,
  checkStep2Ladder,
  assertBindingsCoverStatements,
  parseRetryAfter,
  retrieve,
} = auditModule;

// 3a. Runtime mutants: each reintroduces one defect and must fail the runtime binding.
verifyRuntime(LIRADS, EXPECTED_TABLE);
const MAJOR_IDS = ["observation_size", "aphe", "washout", "capsule", "threshold_growth", "ancillary_malignancy", "ancillary_hcc", "ancillary_benign"];
const LRM_IDS = [...TARGETOID_FIELDS, ...NONTARGETOID_FIELDS];
const mutant = (overrides) => ({ ...LIRADS, ...overrides });
const withFields = (transform) => mutant({ fields: LIRADS.fields.map(transform) });
const computeMutant = (wrap) => mutant({ compute: (vals) => wrap(vals, LIRADS.compute(vals)) });
const runtimeMutants = [
  [
    "legacy order: a nontargetoid LR-M feature is LR-M even when LR-5 criteria are met",
    computeMutant((vals, result) =>
      result["Nontargetoid LR-M Features"]
        ? { "LI-RADS Category": "LR-M (Probably/Definitely Malignant, Not HCC-Specific)", "LR-M Basis": "legacy" }
        : result,
    ),
    /^nontargetoid lrm_\w+ \S+: LR-5 criteria met/,
  ],
  [
    "legacy showIf: major features hidden whenever the LR-M box is checked",
    withFields((field) =>
      MAJOR_IDS.includes(field.id) ? { ...field, showIf: (vals) => field.showIf(vals) && !vals.has_lrm_features } : field,
    ),
    /must stay visible/,
  ],
  [
    "legacy showIf: LR-M feature list follows only its own checkbox",
    withFields((field) => (LRM_IDS.includes(field.id) ? { ...field, showIf: (vals) => Boolean(vals.has_lrm_features) } : field)),
    /must be hidden when/,
  ],
  [
    "compute reads LR-M values the form hides",
    computeMutant((vals, result) =>
      !vals.has_lrm_features && NONTARGETOID_FIELDS.some((id) => vals[id])
        ? LIRADS.compute({ ...vals, has_lrm_features: true })
        : result,
    ),
    /hidden .* changed the result/,
  ],
  [
    "dead end: LR-M box without a feature silently falls through",
    computeMutant((vals, result) =>
      vals.has_lrm_features && !LRM_IDS.some((id) => vals[id]) ? LIRADS.compute({ ...vals, has_lrm_features: false }) : result,
    ),
    /LR-M box without a feature/,
  ],
  [
    "targetoid mass exempted when LR-5 criteria are met",
    computeMutant((vals, result) => {
      const plain = LIRADS.compute({ ...vals, has_lrm_features: false });
      return result["LR-M Basis"] === "Targetoid mass" && /^LR-5 /.test(plain["LI-RADS Category"] ?? "") ? plain : result;
    }),
    /^step 1 LR-M: runtime precedence drifted/,
  ],
  [
    "ancillary features applied before the LR-M decision",
    computeMutant((vals, result) =>
      result["Nontargetoid LR-M Features"] && !/^LR-5 /.test(result["LI-RADS Category"])
        ? LIRADS.compute({ ...vals, lrm_rim_aphe: true })
        : result,
    ),
    /step 2 downgrade/,
  ],
  [
    "tiebreak note dropped",
    computeMutant((vals, result) =>
      result["Clinical Notes"]
        ? { ...result, "Clinical Notes": result["Clinical Notes"].replace(RUNTIME_TIEBREAK_NOTE, "") }
        : result,
    ),
    /tiebreak note missing/,
  ],
  [
    "split cell: 10-19 mm nonrim APHE with capsule only promoted to LR-5",
    computeMutant((vals, result) =>
      result["LI-RADS Category"] === "LR-4 (Probably HCC)" &&
      vals.aphe === "nonrim" &&
      vals.capsule === "present" &&
      vals.washout !== "present" &&
      vals.threshold_growth !== "present" &&
      Number(vals.observation_size) >= 10 &&
      Number(vals.observation_size) < 20
        ? { ...result, "LI-RADS Category": "LR-5 (Definitely HCC)" }
        : result,
    ),
    /^table /,
  ],
  [
    "has_lrm_features subLabel reverted",
    withFields((field) =>
      field.id === "has_lrm_features" ? { ...field, subLabel: "Features suggesting malignancy but not specific for HCC" } : field,
    ),
    /has_lrm_features subLabel drifted/,
  ],
  [
    "tumor_in_vein subLabel reverted",
    withFields((field) =>
      field.id === "tumor_in_vein"
        ? { ...field, subLabel: "Unequivocal enhancing soft tissue within portal or hepatic vein" }
        : field,
    ),
    /tumor_in_vein subLabel drifted/,
  ],
  [
    "LR-TIV result definition narrowed to portal or hepatic veins (Codex review on #302)",
    computeMutant((vals, result) =>
      String(result["LI-RADS Category"] ?? "").startsWith("LR-TIV") ? { ...result, Definition: "Definite tumor invasion of portal or hepatic veins" } : result,
    ),
    /LR-TIV result definition drifted/,
  ],
  [
    "threshold-growth subLabel reverted to the v2017 definition",
    withFields((field) =>
      field.id === "threshold_growth"
        ? { ...field, subLabel: "Size increase ≥50% in ≤6 months, or new observation ≥10mm" }
        : field,
    ),
    /threshold_growth subLabel drifted/,
  ],
  [
    "threshold-growth result note reverted to the v2017 definition",
    computeMutant((vals, result) =>
      result["Clinical Notes"]?.includes(RUNTIME_THRESHOLD_GROWTH.note)
        ? {
            ...result,
            "Clinical Notes": result["Clinical Notes"].replace(
              RUNTIME_THRESHOLD_GROWTH.note,
              "Threshold growth defined as ≥50% size increase in ≤6 months or new observation ≥10mm",
            ),
          }
        : result,
    ),
    /threshold growth note missing/,
  ],
  [
    "a new >=10 mm observation (subthreshold growth) scored as threshold growth",
    computeMutant((vals, result) =>
      vals.ancillary_malignancy === "subthreshold_growth"
        ? LIRADS.compute({ ...vals, ancillary_malignancy: "none", threshold_growth: "present" })
        : result,
    ),
    /^subthreshold growth /,
  ],
  [
    "subthreshold-growth option loses its description",
    withFields((field) =>
      field.id === "ancillary_malignancy"
        ? {
            ...field,
            opts: field.opts.map((opt) =>
              opt.value === "subthreshold_growth" ? { ...opt, label: "Subthreshold growth" } : opt,
            ),
          }
        : field,
    ),
    /subthreshold growth option drifted/,
  ],
  [
    "benign ancillary features stop at LR-3 (the old behavior)",
    computeMutant((vals, result) =>
      result["Base Category (before ancillary)"] === "LR-3" && /^LR-2 /.test(result["LI-RADS Category"])
        ? { ...result, "LI-RADS Category": "LR-3 (Intermediate Probability)" }
        : result,
    ),
    /^benign downgrade .*exactly one category down/,
  ],
  [
    "benign ancillary features downgrade two categories",
    computeMutant((vals, result) =>
      result["Base Category (before ancillary)"] === "LR-4" && /^LR-3 /.test(result["LI-RADS Category"])
        ? { ...result, "LI-RADS Category": "LR-2 (Probably Benign)" }
        : result,
    ),
    /^benign downgrade .*exactly one category down/,
  ],
  [
    "ACR reference reverted to the dead page",
    mutant({
      refs: LIRADS.refs.map((ref) =>
        ref.u === SOURCE.landing_page
          ? { ...ref, u: "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/LI-RADS" }
          : ref,
      ),
    }),
    /ACR reference must be the live LI-RADS page/,
  ],
];
for (const [name, broken, message] of runtimeMutants) {
  assert.throws(
    () => verifyRuntime(broken, EXPECTED_TABLE),
    (error) => error instanceof assert.AssertionError && message.test(error.message),
    `runtime mutant must be rejected: ${name}`,
  );
}

// 3b. Source-text mutants on a synthetic page: the span pin must notice any change.
const syntheticText = "Header text. Alpha beta gamma, delta epsilon. Footer";
const syntheticPin = spanDigest(compact(syntheticText), compact("Alpha beta"), compact("delta epsilon"), "synthetic");
const syntheticStatement = { id: "synthetic", spans: [{ from: "Alpha beta", to: "delta epsilon", ...syntheticPin }] };
const clean = [];
checkSpans(syntheticStatement, syntheticText, clean);
assert.equal(clean.length, 0);
const edited = [];
checkSpans(syntheticStatement, syntheticText.replace("gamma", "gamme"), edited);
assert.equal(edited.length, 1, "a one-letter source edit must break the span pin");
const inserted = [];
checkSpans(syntheticStatement, syntheticText.replace("gamma,", "gamma, not"), inserted);
assert.equal(inserted.length, 1, "an inserted word must break the span pin");
assert.throws(() => checkSpans(syntheticStatement, "Header. Alpha beta gamma. Footer", []), /end marker/);
assert.throws(() => checkSpans(syntheticStatement, `${syntheticText} Alpha beta again`, []), /not unique/);
assert.throws(() => checkSpans(syntheticStatement, "Header. Footer", []), /start marker/);
assert.throws(
  () =>
    checkSpans(
      { id: "long", spans: [{ from: "one two three four five six seven", to: "eight", length: 1, sha256: "0" }] },
      "one two three four five six seven eight",
      [],
    ),
  /exceeds six words/,
);
for (const statement of STATEMENTS) {
  for (const span of statement.spans) {
    for (const marker of [span.from, span.to]) {
      assert.ok(marker.split(/\s+/).length <= 6, `${statement.id}: committed marker exceeds six words`);
    }
  }
}
assert.throws(
  () => assertBindingsCoverStatements(new Map([["unbound-statement", {}]]), []),
  /has no runtime binding/,
  "a verified statement without a runtime binding must be rejected",
);

// 3c. Artifact mutants: raw bytes, final URL and media type.
assert.throws(() => assertRawBytePin(SOURCE, Buffer.from("%PDF-1.7 synthetic")), /byte length drifted/);
const sameLength = Buffer.alloc(SOURCE.bytes);
sameLength.write("%PDF-1.7");
assert.throws(() => assertRawBytePin(SOURCE, sameLength), /SHA-256 drifted/);
const artifact = { finalUrl: new URL(SOURCE.url), contentType: "application/pdf", bytes: Buffer.from("%PDF-1.7") };
assertArtifactIdentity(SOURCE, artifact);
for (const [change, message] of [
  [{ finalUrl: new URL(SOURCE.url.replace("https:", "http:")) }, /left HTTPS/],
  [{ finalUrl: new URL(SOURCE.url.replace("edge.sitecorecloud.io", "example.org")) }, /host drifted/],
  [{ finalUrl: new URL(SOURCE.url.replace("2018-Core", "2024-Core")) }, /path drifted/],
  [{ finalUrl: new URL(`${SOURCE.url}?rev=2`) }, /query drifted/],
  [{ contentType: "text/html; charset=utf-8" }, /media type drifted/],
  [{ bytes: Buffer.from("<!doctype html>") }, /PDF header/],
]) {
  assert.throws(() => assertArtifactIdentity(SOURCE, { ...artifact, ...change }), message);
}

// 3d. Layout mutants on synthetic text coordinates (markers only, no source prose).
const lr = (suffix, x, y) => [
  { str: "LR", x, y },
  { str: "-", x: x + 14, y },
  { str: suffix, x: x + 17.7, y },
];
const step1Items = (rows) => [
  { str: "Untreated observation without", x: 23.6, y: 633.6 },
  ...rows.flatMap(([str, y, outcome]) => [{ str, x: 62.3, y }, ...(outcome ? lr(outcome, 480, y) : [])]),
];
const step1Rows = [
  ["If cannot be categorized", 597.6, "NC"],
  ["If definite", 567.4, "TIV"],
  ["If definitely benign", 535.9, "1"],
  ["probably benign", 505.1, "2"],
  ["If probably or definitely malignant", 474.3, "M"],
  ["Otherwise, use CT/MRI diagnostic", 439.9, null],
  ["If intermediate", 409.1, "3"],
  ["If probably HCC", 378.2, "4"],
  ["If definitely HCC", 346.8, "5"],
];
assert.deepEqual(
  checkStep1Order(step1Items(step1Rows)).map(({ step }) => step),
  ["LR-NC", "LR-TIV", "LR-1", "LR-2", "LR-M", "diagnostic-table", "LR-3", "LR-4", "LR-5"],
);
const lrmBelowTable = step1Rows.map((row) =>
  row[0] === "If probably or definitely malignant" ? [row[0], 420, row[2]] : row,
);
assert.throws(() => checkStep1Order(step1Items(lrmBelowTable)), /must be drawn below/, "LR-M moved after the table");
const wrongOutcome = step1Rows.map((row) => (row[0] === "If definitely benign" ? [row[0], row[1], "2"] : row));
assert.throws(() => checkStep1Order(step1Items(wrongOutcome)), /outcome box drifted/);

const tableItems = ({ cells = EXPECTED_TABLE, split = [["4", 416.5, 201.1], ["5", 440.1, 189.8]] } = {}) => {
  const columns = [265.3, 319.7, 374.1, 428.4, 482.8];
  const rows = { none: 223.6, one: 196.2, two: 168.9 };
  const items = [
    { str: "No APHE", x: 282.4, y: 278.6 },
    { str: "Nonrim APHE", x: 407.7, y: 278.6 },
    { str: "Observation size (mm)", x: 25.1, y: 251.1 },
    ...[["< 20", 265.0], ["≥ 20", 319.6], ["<", 373.8], ["10", 383.1], ["10", 424.9], ["-", 437.2], ["19", 440.9], ["≥ 20", 482.8]].map(
      ([str, x]) => ({ str, x, y: 251.1 }),
    ),
    { str: "None", x: 212.9, y: rows.none },
    { str: "One", x: 215.5, y: rows.one },
    { str: "≥ Two", x: 211.1, y: rows.two },
  ];
  for (const [row, y] of Object.entries(rows)) {
    cells[row].forEach((cell, column) => {
      if (cell !== "LR-4|LR-5") items.push(...lr(cell.slice(3), columns[column], y));
    });
  }
  for (const [suffix, x, y] of split) items.push(...lr(suffix, x, y));
  return items;
};
assert.deepEqual(parseDiagnosticTable(tableItems()), EXPECTED_TABLE);
const editedCells = { ...EXPECTED_TABLE, two: ["LR-4", "LR-4", "LR-4", "LR-4", "LR-5"] };
assert.notDeepEqual(parseDiagnosticTable(tableItems({ cells: editedCells })), EXPECTED_TABLE, "a changed cell must surface");
assert.throws(
  () => parseDiagnosticTable(tableItems({ split: [["5", 416.5, 201.1], ["4", 440.1, 189.8]] })),
  /split cell must hold LR-4/,
);

const lrmItems = (conditionY = [545.5, 532.3]) => [
  { str: "mass (see below for", x: 72.2, y: 640.9 },
  { str: "OR", x: 23.7, y: 616.9 },
  { str: "Nontargetoid mass", x: 23.7, y: 592.9 },
  { str: "Infiltrative appearance", x: 38.1, y: 565.3 },
  { str: "Marked diffusion restriction", x: 38.1, y: 552.1 },
  { str: "Necrosis or severe ischemia", x: 38.1, y: 538.9 },
  { str: "Other feature that in", x: 38.1, y: 525.7 },
  { str: "malignancy (specify in report)", x: 38.1, y: 512.5 },
  { str: "No tumor in vein", x: 371.2, y: conditionY[0] },
  { str: "Not meeting LR", x: 371.2, y: conditionY[1] },
];
checkLrmConditionPlacement(lrmItems());
assert.throws(
  () => checkLrmConditionPlacement(lrmItems([640.9, 627.7])),
  /must sit within the nontargetoid list/,
  "an LR-5 condition moved to the targetoid line must be rejected",
);

const tiebreakItems = (lrmY = 339.6) => [
  ...lr("4", 298.5, 389.5),
  ...lr("5", 384.2, 389.5),
  ...lr("M", 339.9, lrmY),
  { str: "hepatocellular", x: 451.9, y: 369.6 },
  { str: "origin", x: 472.7, y: 356.4 },
];
checkTiebreakLabelPlacement(tiebreakItems());
assert.throws(() => checkTiebreakLabelPlacement(tiebreakItems(420)), /LR-M must sit below/);

const ladderItems = ({ crossX = 422.8, order = ["1", "2", "3", "4", "5"] } = {}) => [
  ...order.flatMap((suffix, index) => lr(suffix, [56.5, 157.2, 257.9, 358.7, 459.7][index], 515)),
  { str: "≥ 1 AF favoring malignancy: upgrade", x: 118.7, y: 580.3 },
  { str: "≥ 1 AF favoring benignity: downgrade", x: 146, y: 463.9 },
  { str: "✘", x: crossX, y: 545.8 },
];
assert.deepEqual(checkStep2Ladder(ladderItems()).bar_order, ["LR-1", "LR-2", "LR-3", "LR-4", "LR-5"]);
assert.throws(
  () => checkStep2Ladder(ladderItems({ crossX: 210 })),
  /between LR-4 and LR-5/,
  "a forbidden move drawn elsewhere on the ladder (e.g. LR-3 to LR-2) must be rejected",
);
assert.throws(() => checkStep2Ladder(ladderItems({ order: ["1", "3", "2", "4", "5"] })), /left to right/);

// 3e. Retrieval: retries network errors, 429 and 5xx; honors Retry-After; fails fast otherwise.
const now = Date.parse("2026-09-28T00:00:00Z");
assert.equal(parseRetryAfter("7", now), 7_000);
assert.equal(parseRetryAfter("Mon, 28 Sep 2026 00:00:30 GMT", now), 30_000);
assert.equal(parseRetryAfter("Sun, 27 Sep 2026 23:00:00 GMT", now), 0);
assert.equal(parseRetryAfter("soon", now), null);
assert.equal(parseRetryAfter(null, now), null);

// A synthetic PDF body with its own raw-byte pins keeps these checks offline and exact.
const syntheticBody = Buffer.from("%PDF-1.7 synthetic LI-RADS audit body\n");
const SYNTHETIC_SOURCE = Object.freeze({
  ...SOURCE,
  key: "synthetic-pdf",
  bytes: syntheticBody.length,
  sha256: createHash("sha256").update(syntheticBody).digest("hex"),
});
const response = (status, { headers = {}, body = syntheticBody, url = SOURCE.url, readError = null } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  url,
  headers: new Headers({ "content-type": "application/pdf", ...headers }),
  body: { cancel: async () => {} },
  arrayBuffer: async () => {
    if (readError) throw readError;
    return Uint8Array.from(body).buffer;
  },
});
const scripted = (steps) => {
  const queue = [...steps];
  const impl = async () => {
    impl.calls += 1;
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return next;
  };
  impl.calls = 0;
  return impl;
};
const noSleep = async () => {};

const recovered = await retrieve(SYNTHETIC_SOURCE, {
  fetchImpl: scripted([response(429, { headers: { "retry-after": "7" } }), response(503), response(200)]),
  sleep: noSleep,
});
assert.equal(recovered.attempts, 3);
assert.deepEqual(recovered.waits, [7_000, 4_000], "Retry-After must be honored, then exponential backoff");
assert.ok(recovered.bytes.equals(syntheticBody), "only pin-verified bytes are returned");

const afterNetworkError = await retrieve(SYNTHETIC_SOURCE, {
  fetchImpl: scripted([new TypeError("fetch failed"), response(200)]),
  sleep: noSleep,
});
assert.equal(afterNetworkError.attempts, 2);

const afterAbortedBody = await retrieve(SYNTHETIC_SOURCE, {
  fetchImpl: scripted([response(200, { readError: new TypeError("terminated") }), response(200)]),
  sleep: noSleep,
});
assert.equal(afterAbortedBody.attempts, 2, "an aborted body read is a transport failure, not a completed 200");

const capped = await retrieve(SYNTHETIC_SOURCE, {
  fetchImpl: scripted([response(429, { headers: { "retry-after": "3600" } }), response(200)]),
  sleep: noSleep,
});
assert.deepEqual(capped.waits, [MAX_RETRY_AFTER_MS], "Retry-After is capped");

for (const status of [403, 404]) {
  const fetchImpl = scripted([response(status), response(200)]);
  await assert.rejects(
    retrieve(SYNTHETIC_SOURCE, { fetchImpl, sleep: noSleep }),
    new RegExp(`after 1 attempt\\(s\\) \\(HTTP ${status}\\)`),
    `HTTP ${status} (bot check, missing) must not be retried or bypassed`,
  );
  assert.equal(fetchImpl.calls, 1);
}
await assert.rejects(
  retrieve(SYNTHETIC_SOURCE, {
    fetchImpl: scripted([response(500), response(502), response(503), response(504)]),
    sleep: noSleep,
  }),
  /after 4 attempt\(s\) \(HTTP 504\)/,
);

// 3f. Pin drift on a completed HTTP 200 fails at once and is never retried, even when a correct
// response would follow. Checked against the synthetic pins and against the real ACR pins.
const sameLengthDrift = Buffer.from(syntheticBody);
sameLengthDrift[sameLengthDrift.length - 2] ^= 0x01;
const realSameLength = Buffer.alloc(SOURCE.bytes);
realSameLength.write("%PDF-1.7");
const realShorter = Buffer.alloc(SOURCE.bytes - 1);
realShorter.write("%PDF-1.7");
const driftedOk = [
  ["same-length digest drift", SYNTHETIC_SOURCE, response(200, { body: sameLengthDrift }), /SHA-256 drifted/],
  ["byte-length drift (one byte longer)", SYNTHETIC_SOURCE, response(200, { body: Buffer.concat([syntheticBody, Buffer.from(" ")]) }), /byte length drifted/],
  ["byte-length drift (truncated)", SYNTHETIC_SOURCE, response(200, { body: syntheticBody.subarray(0, -1) }), /byte length drifted/],
  ["media type drift on 200", SYNTHETIC_SOURCE, response(200, { headers: { "content-type": "text/html" } }), /media type drifted/],
  ["redirected to another host on 200", SYNTHETIC_SOURCE, response(200, { url: SOURCE.url.replace("edge.sitecorecloud.io", "example.org") }), /host drifted/],
  ["real pins: same-length digest drift", SOURCE, response(200, { body: realSameLength }), /SHA-256 drifted/],
  ["real pins: byte-length drift", SOURCE, response(200, { body: realShorter }), /byte length drifted/],
];
for (const [name, source, drifted, message] of driftedOk) {
  const fetchImpl = scripted([drifted, response(200)]);
  await assert.rejects(retrieve(source, { fetchImpl, sleep: noSleep }), message, name);
  assert.equal(fetchImpl.calls, 1, `${name}: a drifted HTTP 200 must not be retried`);
}

console.log(
  `LI-RADS LR-M primary-source audit verified 1 pinned ACR PDF (raw bytes checked before parsing), ${audit.source_statements.length} digest-pinned source statements, ${audit.source_mutations.length} in-memory source mutations caught, ${Object.keys(audit.layout).length} layout checks, ${audit.claim_bindings.length} runtime claim bindings and the actual-export tests; ${runtimeMutants.length} runtime mutants, ${driftedOk.length} drifted-200 mutants (each failed on the first fetch, never retried) and the source, artifact, layout and retrieval mutants were all rejected.`,
);
