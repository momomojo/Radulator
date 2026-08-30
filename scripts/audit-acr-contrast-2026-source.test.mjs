#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import process from "node:process";

const run = spawnSync(
  process.execPath,
  [
    "--import",
    "./scripts/register-jsx-loader.mjs",
    "scripts/audit-acr-contrast-2026-source.mjs",
    "--json",
  ],
  { cwd: process.cwd(), encoding: "utf8", timeout: 180_000 },
);

assert.equal(
  run.status,
  0,
  `ACR Contrast 2026 source audit failed\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`,
);

const audit = JSON.parse(run.stdout);
assert.equal(audit.schema, "radulator-acr-contrast-2026-source-audit/v1");
assert.equal(audit.source_authority, "American College of Radiology");
assert.deepEqual(audit.source_bytes, {
  manual: 1765419,
  adult_card: 50299,
  pediatric_card: 54773,
});
assert.deepEqual(audit.source_sha256, {
  manual: "24bfacd3344310d1546636f50aabba11d6458f432b3c8b1205d9c63efe751be2",
  adult_card: "8e01c557097de36dd38706f1ce9bc540797bdee5e43534db3f6123bfabb963fb",
  pediatric_card: "4891a24be169991168b9b0aa2524ee9f8b6e381cf31fef3ee47b4c7fb0807d1f",
});
assert.equal(Object.values(audit.source_claims).every(Boolean), true);
assert.equal(Object.keys(audit.source_claims).length, 11);
assert.equal(
  audit.source_claims.aki_egfr_threshold_inadequate_serum_creatinine_unreliable,
  true,
);
assert.deepEqual(audit.source_text_verification, {
  engine: "pdfjs-dist@4.10.38",
  manual_pdf_pages: [35, 43, 44, 45, 46, 47],
  manual_printed_pages: [32, 40, 41, 42, 43, 44],
  verified_claim_ids: [
    "stable-egfr-45-not-independent-risk",
    "stable-egfr-30-44-not-or-rarely-nephrotoxic",
    "aki-egfr-threshold-inadequate-serum-creatinine-unreliable",
    "aki-or-egfr-under-30-relative-not-absolute",
    "standard-diagnostic-dose-not-reduced",
    "isotonic-normal-saline-preferred-regimen-unknown",
    "aki-or-egfr-under-30-prophylaxis-with-volume-risk-check",
    "stable-egfr-30-general-prophylaxis-not-indicated",
    "stable-egfr-30-44-individual-high-risk-only",
    "anuric-dialysis-no-further-renal-damage",
    "residual-dialysis-urine-treated-higher-risk",
    "lower-viscosity-routine-warming-unsupported",
    "higher-viscosity-warming-selective-not-routine",
  ],
});
assert.deepEqual(audit.source_runtime_bindings, [
  {
    source_claim_id: "aki-egfr-threshold-inadequate-serum-creatinine-unreliable",
    manual_pdf_page: 44,
    manual_printed_page: 41,
    vector_id: "aki-egfr-is-unreliable",
    output_field: "Renal Safety Context",
    output_includes: "eGFR is unreliable for AKI risk stratification",
  },
]);
assert.equal(audit.bound_vector_ids.length, 10);
assert.equal(audit.runtime_vector_match, true);
assert.equal(audit.fixture_vector_match, true);
assert.equal(audit.source_bytes_committed, false);

console.log(
  "ACR Contrast 2026 source audit verified exact manual/card bytes, 13 page-extracted source statements, 11 source claims, and 10 executable renal/warming vectors.",
);
