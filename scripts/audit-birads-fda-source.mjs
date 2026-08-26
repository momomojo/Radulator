#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { BIRADS } from "../src/components/calculators/BIRADS.jsx";

const FIXTURE_PATH = "tests/fixtures/compute/birads.json";
const SOURCE_HOST = "www.fda.gov";
const SOURCES = Object.freeze({
  finalRule:
    "https://www.fda.gov/radiation-emitting-products/mammography-quality-standards-act-mqsa-and-mqsa-program/important-information-final-rule-amend-mammography-quality-standards-act-mqsa",
  faq:
    "https://www.fda.gov/radiation-emitting-products/mammography-information-patients/frequently-asked-questions-about-mqsa",
  alternative25:
    "https://www.fda.gov/radiation-emitting-products/regulations-mqsa/mqsa-alternative-standard-25-issuing-report-assessment-incomplete-need-additional-imaging-evaluation",
  alternative12:
    "https://www.fda.gov/radiation-emitting-products/regulations-mqsa/mqsa-alternative-standard-12-assessment-category-post-procedure-mammograms-marker-placement",
});
const BOUND_VECTOR_IDS = Object.freeze([
  "category-3",
  "category-4",
  "category-5",
  "incomplete-prior-comparison",
  "post-procedure-marker",
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function fetchOfficialHtml(url) {
  const expected = new URL(url);
  assert.equal(expected.protocol, "https:", `${url}: source must use HTTPS`);
  assert.equal(expected.hostname, SOURCE_HOST, `${url}: source must be an FDA host`);

  let lastFailure = "unknown retrieval failure";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "Radulator-BIRADS-FDA-source-audit/1" },
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        lastFailure = `HTTP ${response.status}`;
        await response.body?.cancel();
        if (response.status !== 429 && response.status < 500) break;
      } else {
        const finalUrl = new URL(response.url);
        assert.equal(finalUrl.protocol, "https:", `${url}: redirect left HTTPS`);
        assert.equal(finalUrl.hostname, SOURCE_HOST, `${url}: redirect left FDA`);
        assert.equal(finalUrl.pathname, expected.pathname, `${url}: unexpected redirect path`);
        assert.match(
          response.headers.get("content-type") ?? "",
          /^text\/html\b/i,
          `${url}: source must be HTML`,
        );
        const bytes = Buffer.from(await response.arrayBuffer());
        assert.ok(bytes.length > 1_000, `${url}: source response is unexpectedly small`);
        assert.ok(bytes.length <= 2_000_000, `${url}: source response is unexpectedly large`);
        return { bytes, html: bytes.toString("utf8"), url };
      }
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  assert.fail(`${url}: official FDA retrieval failed after 3 attempts (${lastFailure})`);
}

function decodeHtmlEntities(value) {
  const named = new Map([
    ["amp", "&"],
    ["apos", "'"],
    ["gt", ">"],
    ["lt", "<"],
    ["nbsp", " "],
    ["quot", '"'],
  ]);
  return value
    .replace(/&#x([a-f0-9]+);/gi, (_, digits) =>
      String.fromCodePoint(Number.parseInt(digits, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, digits) => String.fromCodePoint(Number(digits)))
    .replace(/&([a-z]+);/gi, (entity, name) => named.get(name.toLowerCase()) ?? entity);
}

function visibleText(html) {
  return decodeHtmlEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .normalize("NFKC")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function requireAll(text, label, fragments) {
  for (const fragment of fragments) {
    assert.ok(text.includes(fragment), `${label}: official FDA text lacks ${JSON.stringify(fragment)}`);
  }
}

function assertFixtureExpectation(result, expectation, vectorId) {
  assert.equal(
    Object.prototype.hasOwnProperty.call(result, "Error"),
    expectation.noError === false,
    `${vectorId}: Error state`,
  );
  for (const field of expectation.fields) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(result, field.key),
      `${vectorId}: missing ${field.key}`,
    );
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

const fetched = Object.fromEntries(
  await Promise.all(
    Object.entries(SOURCES).map(async ([key, url]) => [key, await fetchOfficialHtml(url)]),
  ),
);
const text = Object.fromEntries(
  Object.entries(fetched).map(([key, source]) => [key, visibleText(source.html)]),
);

requireAll(text.faq, "MQSA FAQ seven-day rule", [
  "suspicious",
  "highly suggestive of malignancy",
  "written summary of the results to the patient within seven calendar days of the final interpretation",
]);
requireAll(text.finalRule, "MQSA final-rule provider and patient communication", [
  'final assessment category of "suspicious" or "highly suggestive of malignancy,"',
  "mammography report is provided to the health care provider",
  "patient lay summary is provided to the patient within 7 calendar days of the date the mammogram was interpreted",
]);
requireAll(text.faq, "MQSA FAQ self-referred pathway", [
  "facilities must have a system for referring such patients to a healthcare provider when clinically indicated",
  "probably benign",
  "suspicious",
  "highly suggestive of malignancy",
]);
requireAll(text.finalRule, "MQSA final-rule prior-comparison follow-up", [
  '"incomplete: need prior mammograms for comparison,"',
  "follow-up report with a final overall assessment within 30 calendar days of the initial report",
  "regardless of whether comparison views are obtained",
]);
requireAll(text.alternative25, "MQSA Alternative Standard #25", [
  "alternative standard #25",
  "incomplete: need additional imaging evaluation",
  "incomplete: need prior mammograms for comparison",
  "follow-up report issued within 30 calendar days",
]);
requireAll(text.alternative12, "MQSA Alternative Standard #12", [
  "alternative standard #12",
  "post procedure mammograms for marker placement",
  "can only be used for a post procedure mammogram to confirm the deployment and position of a breast tissue marker",
]);

const runtime = Object.freeze({
  category3: BIRADS.compute({ assessment: "3" }),
  category4: BIRADS.compute({ assessment: "4" }),
  category5: BIRADS.compute({ assessment: "5" }),
  priorComparison: BIRADS.compute({ assessment: "0_priors" }),
  markerPlacement: BIRADS.compute({ assessment: "post_marker" }),
});

for (const [label, result] of [
  ["category 4", runtime.category4],
  ["category 5", runtime.category5],
]) {
  requireAll(String(result["U.S. reporting requirement"]).toLowerCase(), label, [
    "mammography report to the health care provider",
    "patient lay summary to the patient",
    "within seven calendar days of interpretation",
  ]);
}
for (const [label, result] of [
  ["category 3", runtime.category3],
  ["category 4", runtime.category4],
  ["category 5", runtime.category5],
]) {
  requireAll(String(result["U.S. self-referred patient pathway"]).toLowerCase(), label, [
    "patients who do not have a health care provider",
    "must maintain a referral system",
  ]);
}
requireAll(
  String(runtime.priorComparison["U.S. reporting requirement"]).toLowerCase(),
  "prior-comparison runtime",
  [
    "within 30 calendar days",
    "even when comparison images cannot be obtained",
    "alternative standard #25",
    '"incomplete: need additional imaging evaluation"',
  ],
);
assert.equal(
  runtime.markerPlacement["MQSA category"],
  "Post-Procedure Mammogram for Marker Placement",
);
requireAll(String(runtime.markerPlacement["Next step"]).toLowerCase(), "marker runtime", [
  "post-procedure mammogram",
  "document marker deployment and position",
]);
assert.equal(
  runtime.markerPlacement["BI-RADS numbering"],
  "None — this FDA MQSA assessment is not a numbered BI-RADS category",
);

const fixture = JSON.parse(await readFile(FIXTURE_PATH, "utf8"));
assert.equal(fixture.calculatorId, "birads");
const casesById = new Map(fixture.cases.map((testCase) => [testCase.id, testCase]));
assert.equal(casesById.size, fixture.cases.length, "BI-RADS fixture IDs must be unique");
for (const vectorId of BOUND_VECTOR_IDS) {
  const testCase = casesById.get(vectorId);
  assert.ok(testCase, `BI-RADS fixture lacks ${vectorId}`);
  assertFixtureExpectation(BIRADS.compute({ ...testCase.inputs }), testCase.expect, vectorId);
}

const audit = {
  schema: "radulator-birads-fda-source-audit/v1",
  source_authority: "U.S. Food and Drug Administration",
  source_host: SOURCE_HOST,
  sources: Object.values(fetched).map(({ bytes, url }) => ({
    url,
    bytes: bytes.length,
    sha256: sha256(bytes),
  })),
  source_claims: {
    alternative_standard_12_marker_placement: true,
    alternative_standard_25_additional_imaging: true,
    prior_comparison_follow_up_within_30_days: true,
    provider_report_and_patient_summary_within_7_days: true,
    self_referred_referral_system: true,
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
    "BI-RADS FDA source audit passed: 4 official pages, 5 source claims, 5 executable vectors.",
  );
}
