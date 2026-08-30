#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { ContrastDosing } from "../src/components/calculators/ContrastDosing.jsx";

const FIXTURE_PATH = "tests/fixtures/compute/contrast-dosing.json";
const GUIDELINE_REGISTRY_PATH =
  "ops/hermes/radulator/skills/radulator-operations/references/guideline-versions.json";
const SOURCE_HOST = "edge.sitecorecloud.io";
const EXPECTED_REGISTRY_LOCATORS = Object.freeze({
  "acr-2026-stable-egfr-prophylaxis":
    "Manual PDF pp. 43-44 and 47 (printed pp. 40-41 and 44): stable eGFR risk evidence and prophylaxis indications",
  "acr-2026-aki-and-egfr-under-30":
    "Manual PDF pp. 44-46 (printed pp. 41-43): AKI threshold unreliability, caution, standard diagnostic dose, volume expansion, and prophylaxis",
  "acr-2026-dialysis-renal-function":
    "Manual PDF p. 47 (printed p. 44): anuric dialysis and residual renal function",
  "acr-2026-contrast-warming":
    "Manual PDF p. 35 (printed p. 32): warming recommendations and limited evidence grades",
});
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
const MANUAL_PDF_PAGES = Object.freeze([35, 43, 44, 45, 46, 47]);
const MANUAL_PRINTED_PAGES = Object.freeze([32, 40, 41, 42, 43, 44]);
const VERIFIED_SOURCE_TEXT_CLAIM_IDS = Object.freeze([
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
]);
const SOURCE_RUNTIME_BINDINGS = Object.freeze([
  Object.freeze({
    source_claim_id: "stable-egfr-45-not-independent-risk",
    manual_pdf_pages: [43],
    manual_printed_pages: [40],
    runtime_assertions: [
      {
        vector_id: "stable-egfr-45-no-prophylaxis",
        output_field: "Renal Safety Context",
        output_includes: ["not an independent nephrotoxic risk factor"],
      },
    ],
  }),
  Object.freeze({
    source_claim_id: "stable-egfr-30-44-not-or-rarely-nephrotoxic",
    manual_pdf_pages: [43, 44],
    manual_printed_pages: [40, 41],
    runtime_assertions: [
      {
        vector_id: "stable-egfr-44-individual-high-risk-only",
        output_field: "Renal Safety Context",
        output_includes: ["either not nephrotoxic or rarely so"],
      },
    ],
  }),
  Object.freeze({
    source_claim_id: "aki-egfr-threshold-inadequate-serum-creatinine-unreliable",
    manual_pdf_pages: [44],
    manual_printed_pages: [41],
    runtime_assertions: [
      {
        vector_id: "aki-egfr-is-unreliable",
        output_field: "Renal Safety Context",
        output_includes: ["eGFR is unreliable for AKI risk stratification"],
      },
    ],
  }),
  Object.freeze({
    source_claim_id: "aki-or-egfr-under-30-relative-not-absolute",
    manual_pdf_pages: [45],
    manual_printed_pages: [42],
    runtime_assertions: [
      {
        vector_id: "stable-egfr-29-isotonic-prophylaxis",
        output_field: "Renal Safety Context",
        output_includes: ["Contrast concern is relative, not absolute"],
      },
      {
        vector_id: "aki-egfr-is-unreliable",
        output_field: "Renal Safety Context",
        output_includes: ["relative, not absolute, concern"],
      },
    ],
  }),
  Object.freeze({
    source_claim_id: "standard-diagnostic-dose-not-reduced",
    manual_pdf_pages: [46],
    manual_printed_pages: [43],
    runtime_assertions: [
      {
        vector_id: "stable-egfr-29-isotonic-prophylaxis",
        output_field: "Diagnostic Dose",
        output_includes: ["Do not reduce the diagnostic contrast dose solely to mitigate CI-AKI risk"],
      },
    ],
  }),
  Object.freeze({
    source_claim_id: "isotonic-normal-saline-preferred-regimen-unknown",
    manual_pdf_pages: [46],
    manual_printed_pages: [43],
    runtime_assertions: [
      {
        vector_id: "stable-egfr-29-isotonic-prophylaxis",
        output_field: "Renal Recommendation",
        output_includes: [
          "IV isotonic volume expansion is indicated",
          "0.9% normal saline is preferred",
          "ideal infusion rate and volume are unknown",
        ],
      },
    ],
  }),
  Object.freeze({
    source_claim_id: "aki-or-egfr-under-30-prophylaxis-with-volume-risk-check",
    manual_pdf_pages: [46],
    manual_printed_pages: [43],
    runtime_assertions: [
      {
        vector_id: "stable-egfr-29-isotonic-prophylaxis",
        output_field: "Renal Recommendation",
        output_includes: ["IV isotonic volume expansion is indicated"],
      },
      {
        vector_id: "aki-egfr-is-unreliable",
        output_field: "Volume Expansion Safety",
        output_includes: ["Heart failure or hypervolemia"],
      },
    ],
  }),
  Object.freeze({
    source_claim_id: "stable-egfr-30-general-prophylaxis-not-indicated",
    manual_pdf_pages: [47],
    manual_printed_pages: [44],
    runtime_assertions: [
      {
        vector_id: "stable-egfr-30-no-routine-prophylaxis",
        output_field: "Renal Recommendation",
        output_includes: ["not indicated for the general population"],
      },
    ],
  }),
  Object.freeze({
    source_claim_id: "stable-egfr-30-44-individual-high-risk-only",
    manual_pdf_pages: [47],
    manual_printed_pages: [44],
    runtime_assertions: [
      {
        vector_id: "stable-egfr-44-individual-high-risk-only",
        output_field: "Renal Recommendation",
        output_includes: ["individual high-risk circumstances"],
      },
    ],
  }),
  Object.freeze({
    source_claim_id: "anuric-dialysis-no-further-renal-damage",
    manual_pdf_pages: [47],
    manual_printed_pages: [44],
    runtime_assertions: [
      {
        vector_id: "anuric-dialysis-no-ciaki-prophylaxis",
        output_field: "Renal Safety Context",
        output_includes: ["not at risk for further renal injury from iodinated contrast"],
      },
    ],
  }),
  Object.freeze({
    source_claim_id: "residual-dialysis-urine-treated-higher-risk",
    manual_pdf_pages: [47],
    manual_printed_pages: [44],
    runtime_assertions: [
      {
        vector_id: "dialysis-residual-function-higher-risk",
        output_field: "Renal Safety Context",
        output_includes: ["residual kidney function", "higher-risk renal state"],
      },
    ],
  }),
  Object.freeze({
    source_claim_id: "lower-viscosity-routine-warming-unsupported",
    manual_pdf_pages: [35],
    manual_printed_pages: [32],
    runtime_assertions: [
      {
        vector_id: "lower-viscosity-300-no-routine-warming",
        output_field: "Contrast Warming",
        output_includes: ["Routine warming is not supported", "lower-viscosity 300 mg I/mL"],
      },
    ],
  }),
  Object.freeze({
    source_claim_id: "higher-viscosity-warming-selective-not-routine",
    manual_pdf_pages: [35],
    manual_printed_pages: [32],
    runtime_assertions: [
      {
        vector_id: "higher-viscosity-370-selective-warming",
        output_field: "Contrast Warming",
        output_includes: ["may be considered selectively", "not established as a routine requirement"],
      },
    ],
  }),
]);
const SOURCE_RESOURCE_BINDINGS = Object.freeze([
  Object.freeze({
    source_claim_id: "official-adult-and-pediatric-reaction-cards-linked",
    source_keys: ["adult_card", "pediatric_card"],
    vector_id: "lower-viscosity-300-no-routine-warming",
    output_field: "Acute Reaction Resources",
    output_includes: ["official ACR Adult or Pediatric Contrast Reaction Card"],
  }),
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

function normalizeSourceText(value) {
  return value
    .normalize("NFKC")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function requireSourceText(pageText, pageNumber, claimId, fragments) {
  const text = pageText.get(pageNumber);
  assert.ok(text, `${claimId}: manual PDF page ${pageNumber} was not extracted`);
  for (const fragment of fragments) {
    const normalizedFragment = normalizeSourceText(fragment);
    assert.ok(
      text.includes(normalizedFragment),
      `${claimId}: manual PDF page ${pageNumber} lacks ${JSON.stringify(normalizedFragment)}`,
    );
  }
}

async function verifyManualSourceText(manualBytes) {
  const document = await getDocument({
    data: new Uint8Array(manualBytes),
    useSystemFonts: true,
  }).promise;
  assert.equal(document.numPages, 126, "manual page count drifted");

  const pageText = new Map();
  for (const pageNumber of MANUAL_PDF_PAGES) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pageText.set(
      pageNumber,
      normalizeSourceText(
        content.items.map((item) => `${item.str}${item.hasEOL ? " " : ""}`).join(""),
      ),
    );
  }
  const verifiedClaimPages = new Map();
  const verifySourceText = (pageNumber, claimId, fragments) => {
    requireSourceText(pageText, pageNumber, claimId, fragments);
    const pages = verifiedClaimPages.get(claimId) ?? [];
    if (!pages.includes(pageNumber)) pages.push(pageNumber);
    verifiedClaimPages.set(claimId, pages);
  };

  verifySourceText(35, "lower-viscosity-routine-warming-unsupported", [
    "lack of supportive evidence to recommend the practice of routine warming of low-osmolality, lower-viscosity iodinated contrast agents",
  ]);
  verifySourceText(35, "higher-viscosity-warming-selective-not-routine", [
    "some evidence that the warming of low-osmolality, higher-viscosity iodinated contrast agents",
    "reported data is inconsistent and insufficient to recommend its routine practice",
    "one may consider iodine-based contrast media warming to reduce viscosity in certain circumstances",
  ]);
  verifySourceText(43, "stable-egfr-45-not-independent-risk", [
    "stable baseline eGFR ≥45 mL/min/1.73m2, IV iodinated contrast media are not an independent nephrotoxic risk factor",
  ]);
  verifySourceText(43, "stable-egfr-30-44-not-or-rarely-nephrotoxic", [
    "stable baseline eGFR 30-44 mL/min/1.73m2, IV iodinated contrast media are either not nephrotoxic or",
  ]);
  verifySourceText(44, "stable-egfr-30-44-not-or-rarely-nephrotoxic", ["rarely so"]);
  verifySourceText(44, "aki-egfr-threshold-inadequate-serum-creatinine-unreliable", [
    "no serum creatinine or eGFR threshold is adequate to stratify risk for patients with AKI because serum creatinine in this setting is unreliable",
  ]);
  verifySourceText(45, "aki-or-egfr-under-30-relative-not-absolute", [
    "concern for the development of CI-AKI is a relative but not absolute contraindication",
    "at-risk patients that have AKI or an eGFR less than 30",
  ]);
  verifySourceText(46, "standard-diagnostic-dose-not-reduced", [
    "it is not recommended to reduce doses to attempt to mitigate the risk of CI-AKI",
    "standard contrast dosing is recommended if the benefits have been deemed to outweigh the risks",
  ]);
  verifySourceText(46, "isotonic-normal-saline-preferred-regimen-unknown", [
    "the ideal infusion rate and volume is unknown, but isotonic fluid such as 0.9% normal saline (NS) is preferred",
  ]);
  verifySourceText(46, "aki-or-egfr-under-30-prophylaxis-with-volume-risk-check", [
    "prophylaxis is indicated for patients who have AKI or severe CKD with an eGFR less than 30",
    "the risks of volume expansion (i.e., heart failure or other hypervolemic conditions) should be considered before initiation",
  ]);
  verifySourceText(47, "stable-egfr-30-general-prophylaxis-not-indicated", [
    "prophylaxis is not indicated for the general population of patients with stable eGFR greater than or equal to 30",
  ]);
  verifySourceText(47, "stable-egfr-30-44-individual-high-risk-only", [
    "prophylaxis may also be considered on an individual basis for high-risk circumstances",
    "in patients with an eGFR of 30-44",
  ]);
  verifySourceText(47, "anuric-dialysis-no-further-renal-damage", [
    "patients with anuric end-stage chronic kidney disease who do not have a functioning transplant can receive intravascular iodinated contrast medium without risk of further renal damage",
  ]);
  verifySourceText(47, "residual-dialysis-urine-treated-higher-risk", [
    "patients undergoing dialysis who make more than 1-2 cups of urine/day (236-473 mL) should be considered nonanuric and treated as high-risk patients similar to patients with AKI or eGFR less than 30",
  ]);

  await document.destroy();
  return {
    engine: "pdfjs-dist@4.10.38",
    manual_pdf_pages: [...MANUAL_PDF_PAGES],
    manual_printed_pages: [...MANUAL_PRINTED_PAGES],
    verified_claim_ids: [...VERIFIED_SOURCE_TEXT_CLAIM_IDS],
    verified_claim_pages: Object.fromEntries(
      VERIFIED_SOURCE_TEXT_CLAIM_IDS.map((claimId) => [claimId, verifiedClaimPages.get(claimId)]),
    ),
  };
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
const sourceTextVerification = await verifyManualSourceText(downloaded[0]);
const fixture = JSON.parse(await readFile(FIXTURE_PATH, "utf8"));
const guidelineRegistry = JSON.parse(await readFile(GUIDELINE_REGISTRY_PATH, "utf8"));
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
assert.deepEqual(
  SOURCE_RUNTIME_BINDINGS.map((binding) => binding.source_claim_id),
  sourceTextVerification.verified_claim_ids,
  "every page-verified source statement must have one explicit runtime binding",
);
const validatedSourceClaimIds = [];
for (const binding of SOURCE_RUNTIME_BINDINGS) {
  assert.ok(
    sourceTextVerification.verified_claim_ids.includes(binding.source_claim_id),
    `${binding.source_claim_id}: source claim is not page-verified`,
  );
  assert.deepEqual(
    binding.manual_pdf_pages,
    sourceTextVerification.verified_claim_pages[binding.source_claim_id],
    `${binding.source_claim_id}: binding pages drifted from extracted source pages`,
  );
  assert.equal(
    binding.manual_pdf_pages.length,
    binding.manual_printed_pages.length,
    `${binding.source_claim_id}: PDF and printed page locators must be paired`,
  );
  assert.deepEqual(
    binding.manual_printed_pages,
    binding.manual_pdf_pages.map((pageNumber) => pageNumber - 3),
    `${binding.source_claim_id}: printed page locator drifted from the manual numbering offset`,
  );
  assert.ok(binding.manual_pdf_pages.length > 0, `${binding.source_claim_id}: page locator is required`);
  assert.ok(binding.runtime_assertions.length > 0, `${binding.source_claim_id}: runtime assertion is required`);
  for (const runtimeAssertion of binding.runtime_assertions) {
    const testCase = casesById.get(runtimeAssertion.vector_id);
    assert.ok(testCase, `contrast fixture lacks ${runtimeAssertion.vector_id}`);
    const result = ContrastDosing.compute({ ...testCase.inputs });
    for (const expectedText of runtimeAssertion.output_includes) {
      assert.ok(
        testCase.expect.fields.some(
          (field) =>
            field.key === runtimeAssertion.output_field && field.includes === expectedText,
        ),
        `${runtimeAssertion.vector_id}: fixture does not bind ${binding.source_claim_id} to ${runtimeAssertion.output_field}`,
      );
      assert.ok(
        String(result[runtimeAssertion.output_field]).includes(expectedText),
        `${runtimeAssertion.vector_id}: runtime output does not implement ${binding.source_claim_id}`,
      );
    }
  }
  validatedSourceClaimIds.push(binding.source_claim_id);
}
for (const binding of SOURCE_RESOURCE_BINDINGS) {
  for (const sourceKey of binding.source_keys) {
    const sourceIndex = SOURCES.findIndex((source) => source.key === sourceKey);
    assert.notEqual(sourceIndex, -1, `${binding.source_claim_id}: unknown source ${sourceKey}`);
    const source = SOURCES[sourceIndex];
    assert.equal(downloaded[sourceIndex].length, source.bytes, `${sourceKey}: downloaded source bytes drifted`);
    assert.ok(refUrls.has(source.url), `${binding.source_claim_id}: calculator omits ${sourceKey}`);
  }
  const testCase = casesById.get(binding.vector_id);
  assert.ok(testCase, `contrast fixture lacks ${binding.vector_id}`);
  const result = ContrastDosing.compute({ ...testCase.inputs });
  for (const expectedText of binding.output_includes) {
    assert.ok(
      testCase.expect.fields.some(
        (field) => field.key === binding.output_field && field.includes === expectedText,
      ),
      `${binding.vector_id}: fixture does not bind ${binding.source_claim_id} to ${binding.output_field}`,
    );
    assert.ok(
      String(result[binding.output_field]).includes(expectedText),
      `${binding.vector_id}: runtime output does not implement ${binding.source_claim_id}`,
    );
  }
  validatedSourceClaimIds.push(binding.source_claim_id);
}
for (const vectorId of BOUND_VECTOR_IDS) {
  const testCase = casesById.get(vectorId);
  assert.ok(testCase, `contrast fixture lacks ${vectorId}`);
  assertFixtureExpectation(
    ContrastDosing.compute({ ...testCase.inputs }),
    testCase.expect,
    vectorId,
  );
}
const registryRecord = guidelineRegistry.records.find(
  (record) => record.calculator_id === fixture.calculatorId,
);
assert.ok(registryRecord, "guideline registry omits contrast-dosing");
const registryClaimsById = new Map(
  registryRecord.implementation_evidence.claims.map((claim) => [claim.id, claim]),
);
const registryClaimLocators = Object.fromEntries(
  Object.entries(EXPECTED_REGISTRY_LOCATORS).map(([claimId, locator]) => {
    const claim = registryClaimsById.get(claimId);
    assert.ok(claim, `guideline registry omits ${claimId}`);
    assert.equal(claim.source_locator, locator, `${claimId}: source locator drifted`);
    return [claimId, claim.source_locator];
  }),
);

const audit = {
  schema: "radulator-acr-contrast-2026-source-audit/v1",
  source_authority: "American College of Radiology",
  source_urls: SOURCES.map((source) => source.url),
  source_bytes: Object.fromEntries(SOURCES.map((source, index) => [source.key, downloaded[index].length])),
  source_sha256: Object.fromEntries(SOURCES.map((source) => [source.key, source.sha256])),
  source_text_verification: sourceTextVerification,
  source_claims: Object.fromEntries(
    validatedSourceClaimIds.map((claimId) => [claimId.replaceAll("-", "_"), true]),
  ),
  source_runtime_bindings: SOURCE_RUNTIME_BINDINGS.map((binding) => ({ ...binding })),
  source_resource_bindings: SOURCE_RESOURCE_BINDINGS.map((binding) => ({ ...binding })),
  registry_claim_locators: registryClaimLocators,
  bound_vector_ids: [...BOUND_VECTOR_IDS],
  runtime_vector_match:
    SOURCE_RUNTIME_BINDINGS.length === sourceTextVerification.verified_claim_ids.length,
  fixture_vector_match: BOUND_VECTOR_IDS.every((vectorId) => casesById.has(vectorId)),
  source_bytes_committed: false,
};

if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(audit)}\n`);
} else {
  console.log(
    "ACR Contrast 2026 source audit passed: exact manual/cards, 13 page-extracted source statements, 14 explicit source bindings, and 10 executable vectors.",
  );
}
