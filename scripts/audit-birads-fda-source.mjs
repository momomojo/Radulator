#!/usr/bin/env node

// Historical filename retained for workflow compatibility during the temporary
// 2013 rollback. This audit is ACR-specific and makes no FDA/MQSA claim.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { BIRADS } from "../src/components/calculators/BIRADS.jsx";

const FIXTURE_PATH = "tests/fixtures/compute/birads.json";
const SOURCE_HOST = "edge.sitecorecloud.io";
const SOURCE_URL =
  "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/BI-RADS/BIRADS-Poster.pdf";
const EXPECTED_SOURCE_SIZE = 621_351;
const EXPECTED_SOURCE_SHA256 =
  "7ee3b4e3713103eba7c5618b49a5dc9112c3aa11ba8b8620b34d7ccb1b5cb410";
const BOUND_VECTOR_IDS = Object.freeze([
  "mammography-incomplete",
  "ultrasound-incomplete",
  "mri-incomplete",
  "known-biopsy-proven-malignancy",
  "negative-screening",
  "benign-finding",
  "typically-benign-calcifications-are-category-2",
  "probably-benign-mass",
  "low-suspicion-mass",
  "moderate-suspicion-calcifications",
  "high-suspicion-spiculated-mass",
  "highly-suggestive-linear-calcifications",
  "probably-benign-selection-warns-on-suspicious-mass-descriptors",
  "screening-mammography-probably-benign-needs-diagnostic-workup",
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function fetchOfficialArtifact() {
  const expected = new URL(SOURCE_URL);
  assert.equal(expected.protocol, "https:");
  assert.equal(expected.hostname, SOURCE_HOST);

  let lastFailure = "unknown retrieval failure";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(SOURCE_URL, {
        headers: { "user-agent": "Radulator-BIRADS-legacy-source-audit/1" },
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        lastFailure = `HTTP ${response.status}`;
        await response.body?.cancel();
        if (response.status !== 429 && response.status < 500) break;
      } else {
        const finalUrl = new URL(response.url);
        assert.equal(finalUrl.protocol, "https:", "artifact redirect left HTTPS");
        assert.equal(finalUrl.hostname, SOURCE_HOST, "artifact redirect left the sealed host");
        assert.equal(finalUrl.pathname, expected.pathname, "artifact redirect changed the sealed path");
        assert.match(
          response.headers.get("content-type") ?? "",
          /^application\/pdf\b/i,
          "official ACR artifact must be a PDF",
        );
        const bytes = Buffer.from(await response.arrayBuffer());
        assert.equal(bytes.length, EXPECTED_SOURCE_SIZE, "official ACR artifact size drifted");
        assert.equal(sha256(bytes), EXPECTED_SOURCE_SHA256, "official ACR artifact digest drifted");
        assert.equal(bytes.subarray(0, 5).toString("ascii"), "%PDF-", "artifact lacks a PDF header");
        return bytes;
      }
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  assert.fail(`official ACR retrieval failed after 3 attempts (${lastFailure})`);
}

function assertFixtureExpectation(result, expectation, vectorId) {
  const hasError = Object.prototype.hasOwnProperty.call(result, "Error");
  assert.equal(hasError, expectation.noError === false, `${vectorId}: Error state`);
  for (const field of expectation.fields) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(result, field.key),
      `${vectorId}: missing ${field.key}`,
    );
    const actual = String(result[field.key]);
    if (Object.prototype.hasOwnProperty.call(field, "equals")) {
      assert.equal(actual, String(field.equals), `${vectorId}: ${field.key}`);
    }
    if (Object.prototype.hasOwnProperty.call(field, "includes")) {
      assert.ok(
        actual.includes(String(field.includes)),
        `${vectorId}: ${field.key} lacks ${JSON.stringify(field.includes)}`,
      );
    }
  }
}

const sourceBytes = await fetchOfficialArtifact();
assert.equal(BIRADS.name, "BI-RADS Assessment Calculator (Legacy 2013)");
assert.equal(BIRADS.guidelineVersion, "Legacy ACR BI-RADS 5th Ed. (2013)");
assert.match(BIRADS.info.text, /Temporary legacy calculator/);
assert.match(BIRADS.info.text, /does not implement the 2025 sixth edition/);
assert.match(BIRADS.info.text, /radiologist-selected suspicion level/);
assert.ok(
  BIRADS.refs.some((reference) => reference.u === SOURCE_URL),
  "calculator references must expose the exact official ACR artifact",
);

const modality = BIRADS.fields.find((field) => field.id === "modality");
assert.deepEqual(
  modality.opts.map((option) => option.value),
  ["mammography", "ultrasound", "mri"],
  "legacy workflow must retain all three source modalities",
);
const calcMorphology = BIRADS.fields.find((field) => field.id === "calc_morphology");
assert.ok(
  calcMorphology.opts.some((option) => option.value === "typically_benign"),
  "legacy workflow must distinguish the official typically-benign morphology group",
);

const fixture = JSON.parse(await readFile(FIXTURE_PATH, "utf8"));
assert.equal(fixture.calculatorId, "birads");
assert.equal(fixture.version, "legacy-fifth-edition-2013-temporary-v1");
const casesById = new Map(fixture.cases.map((testCase) => [testCase.id, testCase]));
assert.equal(casesById.size, fixture.cases.length, "BI-RADS fixture IDs must be unique");
for (const vectorId of BOUND_VECTOR_IDS) {
  const testCase = casesById.get(vectorId);
  assert.ok(testCase, `BI-RADS fixture lacks ${vectorId}`);
  assertFixtureExpectation(BIRADS.compute({ ...testCase.inputs }), testCase.expect, vectorId);
}

const audit = {
  schema: "radulator-birads-legacy-source-audit/v1",
  source_authority: "American College of Radiology",
  source_host: SOURCE_HOST,
  source: {
    url: SOURCE_URL,
    bytes: sourceBytes.length,
    sha256: sha256(sourceBytes),
    locator:
      "ACR BI-RADS Atlas Fifth Edition Quick Reference: mammography, ultrasound, MRI, descriptor tables, and assessment categories 0-6",
  },
  source_claims: {
    assessment_categories_0_through_6: true,
    category_0_modality_wording: true,
    fifth_edition_descriptor_groups: true,
    mammography_ultrasound_mri_scope: true,
  },
  bound_vector_ids: [...BOUND_VECTOR_IDS],
  runtime_vector_match: true,
  fixture_vector_match: true,
  temporary_rollback: true,
  full_manual_validation_complete: false,
  source_bytes_committed: false,
};

if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(audit)}\n`);
} else {
  console.log(
    `BI-RADS legacy source audit passed: digest-pinned ACR fifth-edition artifact and ${BOUND_VECTOR_IDS.length} executable vectors.`,
  );
}
