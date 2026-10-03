#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import process from "node:process";

const run = spawnSync(
  process.execPath,
  [
    "--import",
    "./scripts/register-jsx-loader.mjs",
    "scripts/audit-dlp-primary-source.mjs",
    "--json",
  ],
  { cwd: process.cwd(), encoding: "utf8" },
);

assert.equal(
  run.status,
  0,
  `DLP primary-source audit failed\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`,
);

const computeTests = spawnSync(
  process.execPath,
  [
    "--import",
    "./scripts/register-jsx-loader.mjs",
    "--test",
    "tests/dlp-input-risk-compute.test.mjs",
  ],
  { cwd: process.cwd(), encoding: "utf8" },
);
assert.equal(
  computeTests.status,
  0,
  `DLP actual-export tests failed\nstdout:\n${computeTests.stdout}\nstderr:\n${computeTests.stderr}`,
);

const audit = JSON.parse(run.stdout);
assert.equal(audit.schema, "radulator-dlp-primary-source-audit/v1");
assert.equal(audit.calculator_id, "dlp-dose");
assert.equal(audit.calculator_path, "src/components/calculators/DLPDose.jsx");

// Every source is pinned by exact byte length and SHA-256 of the retrieved bytes, verified
// before any parsing.
assert.deepEqual(
  audit.sources.map(({ key, url, final_url, media_type, pin, bytes, sha256, verified_before_parsing }) => ({
    key,
    url,
    final_url,
    media_type,
    pin,
    bytes,
    sha256,
    verified_before_parsing,
  })),
  [
    {
      key: "icrp147",
      url: "https://www.icrp.org/publication.asp?id=ICRP+Publication+147",
      final_url: "https://www.icrp.org/publication.asp?id=ICRP+Publication+147",
      media_type: "text/html",
      pin: "raw-bytes",
      bytes: 42193,
      sha256: "e4601bc9c99bf9c3655ad8c919b322babf281818339dfac892b211660e5018f0",
      verified_before_parsing: true,
    },
    {
      key: "icrp103",
      url: "https://www.icrp.org/docs/ICRP_Publication_103-Annals_of_the_ICRP_37(2-4)-Free_extract.pdf",
      final_url:
        "https://www.icrp.org/docs/ICRP_Publication_103-Annals_of_the_ICRP_37(2-4)-Free_extract.pdf",
      media_type: "application/pdf",
      pin: "raw-bytes",
      bytes: 354712,
      sha256: "8129e99e681e7a20abaa6e269782195ef026002b019dd438a77c594befb556b9",
      verified_before_parsing: true,
    },
    {
      key: "aapm96",
      url: "https://www.aapm.org/pubs/reports/RPT_96.pdf",
      final_url: "https://www.aapm.org/pubs/reports/RPT_96.pdf",
      media_type: "application/pdf",
      pin: "raw-bytes",
      bytes: 1241814,
      sha256: "dd67d8b4d39c5c9ce4aa505588047754d4a30558414477161614aa5ee5178157",
      verified_before_parsing: true,
    },
  ],
);
assert.match(audit.retrieval_policy, /before any parsing and fails at once without retry on drift/);
const [icrp147, icrp103, aapm96] = audit.sources;
assert.equal(icrp147.doi, "10.1177/0146645320911864");
assert.equal(icrp147.pmid, "33653178");
// Additional check on the ICRP 147 page after its raw pin: the normalized publication column.
assert.deepEqual(
  { ...icrp147.additional_check, content_digest_basis: undefined },
  {
    content_sha256: "01ebdf43c223d42a5618b20ba63cb4db4dee9de490ad28799e794fa49f08e8a6",
    content_blocks: 19,
    content_digest_basis: undefined,
  },
);
assert.match(
  icrp147.additional_check.content_digest_basis,
  /^publication column \(Recommended citation through Executive Summary \(h\)\)/,
);
assert.equal(icrp103.doi, "10.1016/j.icrp.2007.10.003");
assert.equal(icrp103.pmid, "18082557");
assert.equal(icrp103.pages, 35);
assert.equal(aapm96.pages, 34);

const statements = new Map(audit.source_statements.map((statement) => [statement.id, statement]));
// Each source statement is pinned by the SHA-256 of its exact normalized span at the locator.
assert.deepEqual(
  audit.source_statements.map(({ id, source, locator, pdf_page, printed_page, spans }) => [
    id,
    source,
    locator,
    pdf_page ?? null,
    printed_page ?? null,
    (spans ?? []).map(({ sha256 }) => sha256),
  ]),
  [
    [
      "icrp147-recommended-citation",
      "icrp147",
      "ICRP Publication 147 page, Recommended citation",
      null,
      null,
      ["11905cdf0319ac5dea712cd6088c680c0aa4fc57f5fd3d3fa6054b88a1499095"],
    ],
    [
      "icrp147-abstract-individual-risk-organ-doses",
      "icrp147",
      "Abstract",
      null,
      null,
      ["4166c55443ee6735f6a5fe39edbe226f2a36402654fb8ac2607ca6dfaee1f52c"],
    ],
    [
      "icrp147-key-point-medical-comparison",
      "icrp147",
      "Key Points",
      null,
      null,
      ["a5db6cbeb53c52ac31c85e832ccdaf4cd3ac84aa81d6f9845cf1b764c90d81ee"],
    ],
    [
      "icrp147-key-point-not-individual-risk-analysis",
      "icrp147",
      "Key Points",
      null,
      null,
      ["a804e1e5fbd19d792f77e0b64bca1ade02379c037adebc0d162f52b3ca0142d5"],
    ],
    [
      "icrp147-es-b-population-averaged-risk-coefficients",
      "icrp147",
      "Executive Summary (b)",
      null,
      null,
      ["4c4cafd9e3ad810f9dd208fbc7bb6cf1c59fa5c54e84b1ff8a98eb46b2843585"],
    ],
    [
      "icrp147-es-c-reference-persons-of-specified-ages",
      "icrp147",
      "Executive Summary (c)",
      null,
      null,
      ["9ac4c0f19b5d1207d07ff20987067da3bc636e2a70f022b9870f4d6f37b566c4"],
    ],
    [
      "icrp147-es-f-medical-comparisons",
      "icrp147",
      "Executive Summary (f)",
      null,
      null,
      [
        "9ebd38ce710af68dfb1d5b325687fe6a57bb69b4b41c8ef338584fee24047805",
        "f9a87249aab9f695244f8218e439d5f7b8ac1865f037e7e457066ac5a557321e",
        "f1375ffe7578a64ee4794763fba22e8d6c1634e786ac1751e47c21c6f09a555a",
      ],
    ],
    [
      "icrp147-es-g-individual-risk-limits",
      "icrp147",
      "Executive Summary (g)",
      null,
      null,
      [
        "055a86bb48ba9fdfdcf972fea44f0e7047ed52cce9164b2693b2c772961117f9",
        "7bb111e8c05ce6a9bbf0181f6559c907bcea4ffa5b1f3189fd5292af1c704c90",
      ],
    ],
    [
      "icrp103-extract-identity",
      "icrp103",
      "Free extract cover",
      1,
      null,
      ["a42edb5befe2a8e5f494810938a11ccb712b3b5d74fc577d6dcc21339d0f2216"],
    ],
    [
      "icrp103-es-e-combined-detriment-5-percent-per-sv",
      "icrp103",
      "Executive Summary (e)",
      13,
      12,
      ["aaaa964f5ad71a72b960153bfee10077ef031237ca5a31bee7bec95528efe1e9"],
    ],
    [
      "icrp103-es-i-reference-person-not-individual",
      "icrp103",
      "Executive Summary (i), continued from printed p. 12",
      14,
      13,
      [
        "47bb24beef4ce9446805636fc0787bfef0c2c56c060383af84fcadd6a7694195",
        "249687a814d3e0a05b0b5af1a0409dc5413a76a150a677f4f965470d3e3e9305",
      ],
    ],
    [
      "icrp103-es-j-not-for-individual-risk",
      "icrp103",
      "Executive Summary (j)",
      14,
      13,
      [
        "2e090aebd5ff1d1d1de2a8fcf1ccc58b595c9ab99bb62b9d5154e458eff4a3ff",
        "aefb449ac5b18c2924dc319af77d18194e878c4a05a2cfd23527469855a9d40c",
      ],
    ],
    [
      "icrp103-glossary-nominal-risk-coefficient",
      "icrp103",
      "Glossary, Nominal risk coefficient",
      28,
      27,
      ["7c04c5f35753e52da34ea0263b813b6906409c98ce285b07f2b1ac38dc710fa5"],
    ],
    [
      "aapm96-identity",
      "aapm96",
      "Title page",
      3,
      null,
      ["bafc93ad1e3543d4dcfa64d2f3407b04a94b962c0cb1805d4c70c41fc9586a61"],
    ],
    [
      "aapm96-table3-age-specific-columns",
      "aapm96",
      "Table 3 caption and column header",
      19,
      13,
      [
        "9234dc4b069226749d34bc0d4c50fa3a30858b856e26b3db97b71eac2dc23eef",
        "886181a91ea2c9a1eee8f10d2932ad1eea1ddc8c8957791ee8df58d78c8004b9",
      ],
    ],
    [
      "aapm96-eq12",
      "aapm96",
      "Eq. 12",
      19,
      13,
      ["43617407e1a12094e294d30829bd3113514c730f9aa15829350a621ca8045e0d"],
    ],
    ["aapm96-table3-chest-row", "aapm96", "Table 3, Chest row", 19, 13, []],
  ],
);
for (const statement of audit.source_statements) {
  assert.equal(typeof statement.paraphrase, "string", `${statement.id}: paraphrase`);
  for (const span of statement.spans ?? []) {
    assert.ok(span.from && span.to && span.length > 0, `${statement.id}: span anchors and length`);
  }
}
assert.deepEqual(statements.get("aapm96-table3-chest-row").values, {
  "0 year old": 0.039,
  "1 year old": 0.026,
  "5 year old": 0.018,
  "10 year old": 0.013,
  Adult: 0.014,
});
assert.deepEqual(statements.get("aapm96-eq12").ignored_glyphs, ["\u2248"]);

assert.deepEqual(
  audit.claim_bindings.map(({ claim_id, source_statement_ids }) => [claim_id, source_statement_ids]),
  [
    [
      "interpretation-broad-dose-comparisons",
      ["icrp147-key-point-medical-comparison", "icrp147-es-f-medical-comparisons"],
    ],
    [
      "interpretation-not-individual-cancer-probability",
      [
        "icrp147-es-g-individual-risk-limits",
        "icrp147-key-point-not-individual-risk-analysis",
        "icrp103-es-i-reference-person-not-individual",
        "icrp103-es-j-not-for-individual-risk",
      ],
    ],
    [
      "interpretation-individual-risk-inputs",
      ["icrp147-es-g-individual-risk-limits", "icrp147-abstract-individual-risk-organ-doses"],
    ],
    [
      "removed-numerical-lifetime-cancer-risk",
      [
        "icrp103-es-e-combined-detriment-5-percent-per-sv",
        "icrp103-glossary-nominal-risk-coefficient",
        "icrp147-es-b-population-averaged-risk-coefficients",
        "icrp147-es-g-individual-risk-limits",
      ],
    ],
    [
      "icrp147-reference-and-locator",
      [
        "icrp147-recommended-citation",
        "icrp147-es-f-medical-comparisons",
        "icrp147-es-g-individual-risk-limits",
      ],
    ],
    [
      "explicit-age-stratum-required",
      ["icrp147-es-c-reference-persons-of-specified-ages", "aapm96-table3-age-specific-columns"],
    ],
    ["adult-chest-conversion-unchanged", ["aapm96-table3-chest-row", "aapm96-eq12"]],
  ],
);
const bindings = new Map(audit.claim_bindings.map(({ claim_id, runtime }) => [claim_id, runtime]));
assert.deepEqual(bindings.get("removed-numerical-lifetime-cancer-risk"), {
  removed_field_absent: true,
  percent_or_negligible_absent: true,
  cells_checked: 55,
  boundary_vector_ids: [
    "removed-negligible-branch-extremity-adult-dlp-1",
    "removed-branch-boundary-below-extremity-adult-dlp-24",
    "removed-branch-boundary-above-extremity-adult-dlp-26",
    "removed-percent-branch-extremity-adult-dlp-100",
    "aapm96-adult-chest-dlp-500",
    "abdomen-pelvis-adult-dlp-750",
    "large-chest-adult-dlp-100000",
    "pediatric-newborn-chest-dlp-500",
  ],
});
assert.deepEqual(bindings.get("explicit-age-stratum-required"), {
  runtime_strata: [
    { value: "newborn", table3_column: "0 year old" },
    { value: "child_1", table3_column: "1 year old" },
    { value: "child_5", table3_column: "5 year old" },
    { value: "child_10", table3_column: "10 year old" },
    { value: "adult", table3_column: "Adult" },
  ],
  invalid_ages_rejected: 8,
  adult_fallback_would_change_every_region: true,
});
assert.deepEqual(bindings.get("adult-chest-conversion-unchanged"), {
  table3_chest_adult_k: 0.014,
  runtime_chest_adult_k: 0.014,
  vector_id: "aapm96-adult-chest-dlp-500",
  effective_dose: "7.00 mSv",
});

assert.equal(
  audit.runtime.interpretation,
  "Estimated effective dose supports broad radiation-dose comparisons. It does not determine an individual's cancer probability; individual risk assessment requires organ doses and age-, sex-, and population-specific factors.",
);
assert.equal(
  audit.runtime.icrp147_reference,
  "ICRP Publication 147. Use of dose quantities in radiological protection. Ann ICRP. 2021;50(1). Executive summary (f)-(g): medical comparisons and individual-risk limitations.",
);
assert.equal(audit.runtime.removed_field, "Estimated Additional Lifetime Cancer Risk");
assert.equal(audit.runtime.k_table_cells, 55);
assert.equal(
  audit.runtime.k_table_sha256,
  "482165e2a7b18266b6f46550f57d36c51b489cf64440142ecc6eec7ec650cbda",
);
assert.deepEqual(audit.app_input_guardrails, {
  provenance: "radulator-data-entry-guardrail",
  publication_derived: false,
  rejected_vector_ids: [
    "partial-numeric-string-rejected",
    "nonfinite-string-rejected",
    "overflowing-string-rejected",
    "hexadecimal-string-rejected",
    "dose-underflow-rejected",
  ],
});
assert.deepEqual(audit.scope, {
  coefficient_table_changed: false,
  not_asserted: [
    "pediatric k-factor source fidelity",
    "phantom-basis disclosure",
    "typical DLP ranges and Dose Alert policy",
    "whole-calculator clinical acceptance",
  ],
});
assert.equal(audit.source_bytes_committed, false);

console.log(
  "DLP primary-source audit verified 3 byte-pinned artifacts (ICRP 147 page, ICRP 103 extract, AAPM Report 96; length and SHA-256 checked before parsing), 17 digest-pinned source statements, 7 runtime claim bindings, the unchanged 55-cell coefficient table, and the actual-export tests.",
);
