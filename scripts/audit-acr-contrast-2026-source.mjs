#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { ContrastDosing } from "../src/components/calculators/ContrastDosing.jsx";

const FIXTURE_PATH = "tests/fixtures/compute/contrast-dosing.json";
const SOURCE_HOST = "edge.sitecorecloud.io";
const SOURCES = Object.freeze([
  {
    key: "manual",
    url: "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/Clinical/Contrast-Manual/ACR-Manual-on-Contrast-Media.pdf",
    bytes: 1765419,
    sha256: "24bfacd3344310d1546636f50aabba11d6458f432b3c8b1205d9c63efe751be2",
  },
  {
    key: "adult_card",
    url: "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/Clinical/Contrast-Manual/Contrast-Reaction-Card-Adult.pdf",
    bytes: 50299,
    sha256: "8e01c557097de36dd38706f1ce9bc540797bdee5e43534db3f6123bfabb963fb",
  },
  {
    key: "pediatric_card",
    url: "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/Clinical/Contrast-Manual/Contrast-Reaction-Card-Pediatric.pdf",
    bytes: 54773,
    sha256: "4891a24be169991168b9b0aa2524ee9f8b6e381cf31fef3ee47b4c7fb0807d1f",
  },
]);
const BOUND_VECTOR_IDS = Object.freeze([
  "egfr-without-stability-status-fails-closed",
  "stable-egfr-45-no-prophylaxis",
  "stable-egfr-30-no-routine-prophylaxis",
  "stable-egfr-44-individual-high-risk-only",
  "stable-egfr-29-isotonic-prophylaxis",
  "aki-egfr-is-unreliable",
  "anuric-dialysis-no-ciaki-prophylaxis",
  "dialysis-residual-function-higher-risk",
  "lower-viscosity-300-no-routine-warming",
  "higher-viscosity-370-selective-warming",
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function fetchExactPdf(source) {
  let lastFailure = "unknown retrieval failure";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(source.url, {
        headers: { "user-agent": "Radulator-ACR-Contrast-2026-source-audit/1" },
        redirect: "follow",
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) {
        lastFailure = `HTTP ${response.status}`;
        await response.body?.cancel();
        if (response.status !== 429 && response.status < 500) break;
      } else {
        const finalUrl = new URL(response.url);
        const expectedUrl = new URL(source.url);
        assert.equal(finalUrl.protocol, "https:", `${source.key}: redirect left HTTPS`);
        assert.equal(finalUrl.hostname, SOURCE_HOST, `${source.key}: redirect left the ACR source host`);
        assert.equal(finalUrl.pathname, expectedUrl.pathname, `${source.key}: unexpected redirect path`);
        assert.match(
          response.headers.get("content-type") ?? "",
          /^application\/pdf\b/i,
          `${source.key}: source must be a PDF`,
        );
        const bytes = Buffer.from(await response.arrayBuffer());
        assert.equal(bytes.subarray(0, 5).toString("ascii"), "%PDF-", `${source.key}: missing PDF header`);
        assert.equal(bytes.length, source.bytes, `${source.key}: source byte length drifted`);
        assert.equal(sha256(bytes), source.sha256, `${source.key}: source SHA-256 drifted`);
        return bytes;
      }
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  assert.fail(`${source.key}: ACR source retrieval failed after 3 attempts (${lastFailure})`);
}

function assertFixtureExpectation(result, expectation, vectorId) {
  assert.equal(
    Object.prototype.hasOwnProperty.call(result, "Error"),
    expectation.noError === false,
    `${vectorId}: Error state`,
  );
  for (const field of expectation.fields) {
    assert.ok(Object.prototype.hasOwnProperty.call(result, field.key), `${vectorId}: missing ${field.key}`);
    const actual = String(result[field.key]);
    if (Object.prototype.hasOwnProperty.call(field, "equals")) {
      assert.equal(actual, String(field.equals), `${vectorId}: ${field.key}`);
    } else {
      assert.ok(
        actual.includes(String(field.includes)),
        `${vectorId}: ${field.key} lacks ${JSON.stringify(field.includes)}`,
      );
    }
  }
}

const downloaded = await Promise.all(SOURCES.map(fetchExactPdf));
const fixture = JSON.parse(await readFile(FIXTURE_PATH, "utf8"));
assert.equal(fixture.calculatorId, "contrast-dosing");
assert.equal(
  ContrastDosing.guidelineVersion,
  "ACR Manual on Contrast Media 2026 (renal safety and warming context)",
);

const refUrls = new Set(ContrastDosing.refs.map((reference) => reference.u));
for (const source of SOURCES) {
  assert.ok(refUrls.has(source.url), `calculator references omit ${source.key}`);
}
const casesById = new Map(fixture.cases.map((testCase) => [testCase.id, testCase]));
assert.equal(casesById.size, fixture.cases.length, "contrast fixture IDs must be unique");
for (const vectorId of BOUND_VECTOR_IDS) {
  const testCase = casesById.get(vectorId);
  assert.ok(testCase, `contrast fixture lacks ${vectorId}`);
  assertFixtureExpectation(
    ContrastDosing.compute({ ...testCase.inputs }),
    testCase.expect,
    vectorId,
  );
}

const audit = {
  schema: "radulator-acr-contrast-2026-source-audit/v1",
  source_authority: "American College of Radiology",
  source_urls: SOURCES.map((source) => source.url),
  source_bytes: Object.fromEntries(SOURCES.map((source, index) => [source.key, downloaded[index].length])),
  source_sha256: Object.fromEntries(SOURCES.map((source) => [source.key, source.sha256])),
  source_claims: {
    stable_egfr_gte_30_general_prophylaxis_not_indicated: true,
    stable_egfr_30_44_individual_high_risk_only: true,
    aki_or_egfr_lt_30_prophylaxis_indicated: true,
    isotonic_normal_saline_preferred_ideal_regimen_unknown: true,
    assess_heart_failure_and_hypervolemia_before_volume_expansion: true,
    do_not_reduce_diagnostic_iv_dose_for_ci_aki_mitigation: true,
    anuric_dialysis_not_at_risk_for_further_renal_injury: true,
    lower_viscosity_agent_routine_warming_not_recommended: true,
    higher_viscosity_agent_warming_selective_not_routine: true,
    official_adult_and_pediatric_reaction_cards_linked: true,
  },
  bound_vector_ids: [...BOUND_VECTOR_IDS],
  runtime_vector_match: true,
  fixture_vector_match: true,
  source_bytes_committed: false,
};

if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(audit)}\n`);
} else {
  console.log(
    "ACR Contrast 2026 source audit passed: exact manual/cards, 10 bounded claims, and 10 executable vectors.",
  );
}
