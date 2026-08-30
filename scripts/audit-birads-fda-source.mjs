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
const SOURCE_PREFIX =
  "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/BI-RADS/";
const OFFICIAL_ARTIFACTS = Object.freeze([
  {
    id: "fifth-edition-quick-reference",
    url: `${SOURCE_PREFIX}BIRADS-Poster.pdf`,
    bytes: 621_351,
    sha256: "7ee3b4e3713103eba7c5618b49a5dc9112c3aa11ba8b8620b34d7ccb1b5cb410",
  },
  {
    id: "mammography-summary",
    url: `${SOURCE_PREFIX}BI-RADS-Summary-Form-Mammography.pdf`,
    bytes: 64_921,
    sha256: "98d88679deb266ac030de0d96d9f15a5fcde3b0a1a4d6a7aeb29aa49b85daae6",
  },
  {
    id: "ultrasound-summary",
    url: `${SOURCE_PREFIX}BI-RADS-Summary-Form-Ultrasound.pdf`,
    bytes: 67_317,
    sha256: "38f24a245a9ea992f5f29e221f6000eb4a60c9d8d78f4a3dce68130179adec1d",
  },
  {
    id: "mri-summary",
    url: `${SOURCE_PREFIX}BI-RADS-Summary-Form-MRI.pdf`,
    bytes: 63_321,
    sha256: "75900dbd050ec22266db01cf5e18a8caae1e07e0d5e5f819195af7cf0b569dd9",
  },
]);
const BOUND_VECTOR_IDS = Object.freeze([
  "mammography-incomplete",
  "ultrasound-incomplete",
  "mri-incomplete",
  "known-biopsy-proven-malignancy",
  "negative-finding-requires-radiologist-assessment",
  "negative-screening",
  "benign-finding-requires-radiologist-assessment",
  "benign-finding",
  "typically-benign-calcifications-require-radiologist-assessment",
  "probably-benign-mass",
  "low-suspicion-mass",
  "moderate-suspicion-calcifications",
  "high-suspicion-spiculated-mass",
  "highly-suggestive-linear-calcifications",
  "category-5-inclusive-95-boundary",
  "probably-benign-selection-warns-on-suspicious-mass-descriptors",
  "screening-mammography-probably-benign-no-uncited-warning",
  "developing-asymmetry",
  "associated-features",
  "mri-rejects-category-4-subdivision",
  "ultrasound-rejects-mammography-specific-finding",
  "ultrasound-suspicious-category-4",
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function fetchOfficialArtifact(artifact) {
  const expected = new URL(artifact.url);
  assert.equal(expected.protocol, "https:");
  assert.equal(expected.hostname, SOURCE_HOST);

  let lastFailure = "unknown retrieval failure";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(artifact.url, {
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
        assert.equal(
          bytes.length,
          artifact.bytes,
          `${artifact.id}: official ACR artifact size drifted`,
        );
        assert.equal(
          sha256(bytes),
          artifact.sha256,
          `${artifact.id}: official ACR artifact digest drifted`,
        );
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
  assert.fail(
    `${artifact.id}: official ACR retrieval failed after 3 attempts (${lastFailure})`,
  );
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

const sourceBytes = await Promise.all(
  OFFICIAL_ARTIFACTS.map((artifact) => fetchOfficialArtifact(artifact)),
);
assert.equal(BIRADS.name, "BI-RADS Assessment Calculator (Legacy 2013)");
assert.equal(
  BIRADS.guidelineVersion,
  "Legacy ACR BI-RADS 5th Ed. (2013) with public 2025 assessment-summary constraints",
);
assert.match(BIRADS.info.text, /Temporary legacy calculator/);
assert.match(BIRADS.info.text, /does not implement the 2025 sixth edition/);
assert.match(BIRADS.info.text, /radiologist selects the assessment level/);
for (const artifact of OFFICIAL_ARTIFACTS) {
  assert.ok(
    BIRADS.refs.some((reference) => reference.u === artifact.url),
    `${artifact.id}: calculator references must expose the exact official ACR artifact`,
  );
}

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
const findingType = BIRADS.fields.find((field) => field.id === "finding_type");
const calcificationOption = findingType.opts.find(
  (option) => option.value === "calcifications",
);
assert.equal(calcificationOption.showIf({ modality: "mammography" }), true);
assert.equal(calcificationOption.showIf({ modality: "ultrasound" }), false);
assert.equal(calcificationOption.showIf({ modality: "mri" }), false);
const suspicion = BIRADS.fields.find((field) => field.id === "suspicion_level");
const category4A = suspicion.opts.find(
  (option) => option.value === "low_suspicion",
);
const category4B = suspicion.opts.find(
  (option) => option.value === "moderate_suspicion",
);
const category4C = suspicion.opts.find(
  (option) => option.value === "high_suspicion",
);
const mriCategory4 = suspicion.opts.find(
  (option) => option.value === "suspicious",
);
assert.equal(category4A.showIf({ modality: "mammography", finding_type: "mass" }), true);
assert.equal(category4A.showIf({ modality: "ultrasound", finding_type: "mass" }), false);
assert.equal(category4A.showIf({ modality: "mri", finding_type: "mass" }), false);
assert.equal(category4B.showIf({ modality: "mammography", finding_type: "mass" }), true);
assert.equal(category4B.showIf({ modality: "ultrasound", finding_type: "mass" }), false);
assert.equal(category4B.showIf({ modality: "mri", finding_type: "mass" }), false);
assert.equal(category4C.showIf({ modality: "mammography", finding_type: "mass" }), true);
assert.equal(category4C.showIf({ modality: "ultrasound", finding_type: "mass" }), false);
assert.equal(category4C.showIf({ modality: "mri", finding_type: "mass" }), false);
assert.equal(mriCategory4.showIf({ modality: "mammography", finding_type: "mass" }), false);
assert.equal(mriCategory4.showIf({ modality: "ultrasound", finding_type: "mass" }), true);
assert.equal(mriCategory4.showIf({ modality: "mri", finding_type: "mass" }), true);
const staleHiddenDescriptorResult = BIRADS.compute({
  modality: "mammography",
  study_context: "diagnostic",
  additional_needed: "no",
  finding_type: "mass",
  mass_shape: "oval",
  mass_margin: "circumscribed",
  mass_density: "equal",
  calc_morphology: "fine_linear",
  calc_distribution: "linear",
  suspicion_level: "probably_benign",
});
assert.equal(
  Object.prototype.hasOwnProperty.call(staleHiddenDescriptorResult, "Decision Check"),
  false,
  "hidden calcification descriptors must not alter an active mass assessment",
);
const screeningCategory3Result = BIRADS.compute({
  modality: "mammography",
  study_context: "screening",
  additional_needed: "no",
  finding_type: "mass",
  mass_shape: "oval",
  mass_margin: "circumscribed",
  mass_density: "equal",
  suspicion_level: "probably_benign",
});
assert.equal(
  Object.prototype.hasOwnProperty.call(screeningCategory3Result, "Decision Check"),
  false,
  "source audit must reject an uncited screening-only assessment warning",
);

const fixture = JSON.parse(await readFile(FIXTURE_PATH, "utf8"));
assert.equal(fixture.calculatorId, "birads");
assert.equal(fixture.version, "legacy-fifth-edition-2013-temporary-v2");
const casesById = new Map(fixture.cases.map((testCase) => [testCase.id, testCase]));
assert.equal(casesById.size, fixture.cases.length, "BI-RADS fixture IDs must be unique");
for (const vectorId of BOUND_VECTOR_IDS) {
  const testCase = casesById.get(vectorId);
  assert.ok(testCase, `BI-RADS fixture lacks ${vectorId}`);
  assertFixtureExpectation(BIRADS.compute({ ...testCase.inputs }), testCase.expect, vectorId);
}

const audit = {
  schema: "radulator-birads-legacy-source-audit/v2",
  source_authority: "American College of Radiology",
  source_host: SOURCE_HOST,
  sources: OFFICIAL_ARTIFACTS.map((artifact, index) => ({
    id: artifact.id,
    url: artifact.url,
    bytes: sourceBytes[index].length,
    sha256: sha256(sourceBytes[index]),
  })),
  source_claims: {
    assessment_categories_0_through_6: true,
    category_0_modality_wording: true,
    fifth_edition_descriptor_groups: true,
    mammography_ultrasound_mri_scope: true,
    mammography_only_findings_are_modality_gated: true,
    mri_category_4_has_no_subdivisions: true,
    source_literal_probability_endpoints: true,
    source_literal_management_wording: true,
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
    `BI-RADS legacy source audit passed: ${OFFICIAL_ARTIFACTS.length} digest-pinned ACR artifacts and ${BOUND_VECTOR_IDS.length} executable vectors.`,
  );
}
