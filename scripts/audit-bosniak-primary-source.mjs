#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { RenalCystBosniak } from "../src/components/calculators/RenalCystBosniak.jsx";
import { MAX_ATTEMPTS, fetchPinned } from "./lib/ncbi-fetch.mjs";

const FIXTURE_PATH = "tests/fixtures/compute/bosniak.json";
const CLASSIFICATION_SOURCE_URL =
  "https://pmc.ncbi.nlm.nih.gov/articles/PMC6677285/?report=reader";
const CLASSIFICATION_SOURCE_HOST = "pmc.ncbi.nlm.nih.gov";
const CLASSIFICATION_SOURCE_PATH = "/articles/PMC6677285/";
const CLASSIFICATION_SOURCE_MEDIA_TYPE = "text/html";
const CLASSIFICATION_RAW_MIN_BYTES = 300_000;
const CLASSIFICATION_RAW_MAX_BYTES = 1_000_000;
const CLASSIFICATION_CANONICAL_BYTES = 111_115;
const CLASSIFICATION_CANONICAL_SHA256 =
  "007a4c01927d5a9fb4f8b0458dedc5793fe0f3d7c051fcb8f3267b76b57c95e5";
const MANAGEMENT_SOURCE_URL =
  "https://pmc.ncbi.nlm.nih.gov/articles/PMC10263289/?report=reader";
const MANAGEMENT_SOURCE_HOST = "pmc.ncbi.nlm.nih.gov";
const MANAGEMENT_SOURCE_PATH = "/articles/PMC10263289/";
const MANAGEMENT_SOURCE_MEDIA_TYPE = "text/html";
const MANAGEMENT_RAW_MIN_BYTES = 300_000;
const MANAGEMENT_RAW_MAX_BYTES = 1_000_000;
const MANAGEMENT_CANONICAL_BYTES = 77_293;
const MANAGEMENT_CANONICAL_SHA256 =
  "320f8aa91a3143c45a93856f840d4d81d39f0a6d4636eb10340bbd4293180324";
const MANAGEMENT_TITLE =
  "2023 UPDATE – Canadian Urological Association guideline: Management of cystic renal lesions";
const MANAGEMENT_FULLTEXT_URL = "https://pmc.ncbi.nlm.nih.gov/articles/PMC10263289/";
const SOURCE_TEXT_VERIFICATION = Object.freeze({
  silverman: Object.freeze([
    Object.freeze({
      claim_id: "bosniak-v2019-category-ii",
      section_id: "s5",
      locator:
        "HTML section #s5 (Recent Developments to Improve Characterization of Cystic Renal Masses)",
      required_text: "well-defined homogeneous masses of 70 hu or greater",
    }),
    Object.freeze({
      claim_id: "bosniak-v2019-iif-iii-iv-features",
      section_id: "sec17",
      locator: "HTML section #sec17 (Bosniak IV)",
      required_text: "focal enhancing convex protrusion 4 mm or larger",
    }),
    Object.freeze({
      claim_id: "bosniak-v2019-iif-iii-iv-features",
      section_id: "sec17",
      locator: "HTML section #sec17 (Bosniak IV)",
      required_text: "obtuse margins with the wall or septa",
    }),
  ]),
  cua: Object.freeze([
    Object.freeze({
      id: "cua-title",
      identity: "h1",
      locator: "PMC HTML article H1 title",
      required_text: "2023 update - canadian urological association guideline: management of cystic renal lesions",
    }),
    Object.freeze({
      id: "cua-doi",
      identity: "citation_doi",
      locator: "PMC HTML citation_doi metadata",
      required_text: "10.5489/cuaj.8389",
    }),
    Object.freeze({
      id: "cua-iif-interval",
      section_id: "sec15",
      locator: "PMC HTML section #sec15 (Bosniak category IIF), recommendation 6",
      required_text:
        "for patients with a bosniak iif cyst, a followup every 6-12 months is suggested for the first year, and then yearly if the cyst is stable",
    }),
    Object.freeze({
      id: "cua-iif-interval-evidence",
      section_id: "sec15",
      locator: "PMC HTML section #sec15 (Bosniak category IIF), recommendation 6 evidence grade",
      required_text: "expert opinion",
    }),
    Object.freeze({
      id: "cua-iif-duration",
      section_id: "sec15",
      locator: "PMC HTML section #sec15 (Bosniak category IIF), recommendation 7",
      required_text:
        "for patients with a bosniak iif cyst that do not demonstrate progression on imaging, a followup of five years is suggested",
    }),
    Object.freeze({
      id: "cua-iif-duration-evidence",
      section_id: "sec15",
      locator: "PMC HTML section #sec15 (Bosniak category IIF), recommendation 7 evidence grade",
      required_text: "conditional recommendation, very low certainty in evidence of effects",
    }),
  ]),
});
const SOURCE_MAX_BYTES = 1_000_000;
const BOUND_VECTOR_IDS = Object.freeze([
  "exactly-70-hu-homogeneous-noncontrast-mass-category-ii",
  "exactly-4-mm-obtuse-margin-enhancing-nodule-category-iv",
  "minimally-thick-enhancing-wall-category-iif",
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertExactFinalUrl(response, expectedUrl, label) {
  if (response.url !== expectedUrl) {
    throw new Error(`${label} final URL is not exact: ${response.url}`);
  }
  const actual = new URL(response.url);
  const expected = new URL(expectedUrl);
  for (const component of [
    "protocol",
    "username",
    "password",
    "hostname",
    "port",
    "pathname",
    "search",
    "hash",
  ]) {
    assert.equal(actual[component], expected[component], `${label} final URL ${component}`);
  }
}

function assertMediaType(response, expectedMediaType, label) {
  const contentType = response.headers.get("content-type") ?? "";
  const mediaType = contentType.split(";", 1)[0].trim().toLowerCase();
  assert.equal(mediaType, expectedMediaType, `${label} media type`);
}

// PMC answers some automated requests with a proof-of-work page ("Preparing to download...") that has
// none of the article's citation metadata. Such a page is a challenge, not the article.
function isPmcChallengePage(bytes) {
  return !/<meta\b[^>]*\bname\s*=\s*["']citation_doi["']/i.test(bytes.toString("utf8"));
}

// Retrieval goes through the shared NCBI helper (scripts/lib/ncbi-fetch.mjs): request spacing, up to 5
// attempts 1, 2, 4 and 8 s apart for transport failures (network errors, 429 and 5xx, a redirected or
// wrong-URL or wrong-media-type response, and a challenge page: one under the raw size floor or
// without citation metadata), and NCBI_API_KEY never sent to PMC. Each article page is validated
// (identity, canonical text digest, locators) before it is used; a 200 page that fails validation is a
// changed source and fails at once. `fetchImpl`, `sleepImpl` and `env` are for tests.
async function fetchArtifact(source, { fetchImpl, sleepImpl, env, verifyDigest = true, validate }) {
  let validated;
  await fetchPinned({
    url: source.url,
    label: source.label,
    // The pinned canonical text digest, recomputed by validate(); fixture tests turn it off.
    pin: verifyDigest ? { kind: "canonical", sha256: source.canonicalSha256 } : null,
    verify: async (bytes) => {
      validated = await validate({ bytes });
    },
    isChallenge: (bytes) => isPmcChallengePage(bytes),
    checkResponse: (response) => {
      if (response.redirected) throw new Error("redirected response");
      assertExactFinalUrl(response, source.url, source.label);
      assertMediaType(response, source.mediaType, source.label);
    },
    minBytes: source.minBytes,
    maxBytes: source.maxBytes,
    headers: { "user-agent": source.userAgent },
    redirect: "error",
    fetchImpl,
    sleep: sleepImpl,
    env,
  });
  return validated;
}

function decodeHtmlEntities(value) {
  const named = new Map([
    ["amp", "&"],
    ["apos", "'"],
    ["ge", ">="],
    ["gt", ">"],
    ["le", "<="],
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
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const CLASSIFICATION_SOURCE = Object.freeze({
  id: "silverman-pmc-html",
  label: "Silverman PMC HTML",
  url: CLASSIFICATION_SOURCE_URL,
  host: CLASSIFICATION_SOURCE_HOST,
  path: CLASSIFICATION_SOURCE_PATH,
  mediaType: CLASSIFICATION_SOURCE_MEDIA_TYPE,
  userAgent: "Radulator-Bosniak-Silverman-source-audit/1",
  maxBytes: CLASSIFICATION_RAW_MAX_BYTES,
  minBytes: CLASSIFICATION_RAW_MIN_BYTES,
  canonicalBytes: CLASSIFICATION_CANONICAL_BYTES,
  canonicalSha256: CLASSIFICATION_CANONICAL_SHA256,
});

const MANAGEMENT_SOURCE = Object.freeze({
  id: "cua-pmc-html",
  label: "CUA 2023 PMC HTML",
  url: MANAGEMENT_SOURCE_URL,
  host: MANAGEMENT_SOURCE_HOST,
  path: MANAGEMENT_SOURCE_PATH,
  mediaType: MANAGEMENT_SOURCE_MEDIA_TYPE,
  userAgent: "Radulator-Bosniak-CUA-2023-source-audit/1",
  maxBytes: MANAGEMENT_RAW_MAX_BYTES,
  minBytes: MANAGEMENT_RAW_MIN_BYTES,
  canonicalBytes: MANAGEMENT_CANONICAL_BYTES,
  canonicalSha256: MANAGEMENT_CANONICAL_SHA256,
});

function metadataValue(html, name) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const nameMatch = tag.match(/\bname\s*=\s*["']([^"']+)["']/i);
    if (nameMatch?.[1].toLowerCase() !== name.toLowerCase()) continue;
    return tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1] ?? null;
  }
  return null;
}

function articleBodyText(html, sourceLabel) {
  const mainStart = html.search(/<main\b/i);
  const articleOffset = mainStart < 0 ? -1 : html.slice(mainStart).search(/<article\b/i);
  const articleStart = articleOffset < 0 ? -1 : mainStart + articleOffset;
  const articleEndOffset = articleStart < 0 ? -1 : html.slice(articleStart).search(/<\/article>/i);
  const articleEnd = articleEndOffset < 0 ? -1 : articleStart + articleEndOffset;
  assert.ok(
    mainStart >= 0 && articleStart > mainStart && articleEnd > articleStart,
    `${sourceLabel} article body is missing`,
  );
  return visibleText(html.slice(articleStart, articleEnd + "</article>".length));
}

function classificationArticleText(html) {
  return articleBodyText(html, "Silverman PMC");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function elementById(html, tagName, id, sourceLabel) {
  const openingTag = new RegExp(
    `<${tagName}\\b(?=[^>]*\\bid=["']${escapeRegExp(id)}["'])[^>]*>`,
    "gi",
  );
  const openingMatches = [...html.matchAll(openingTag)];
  assert.equal(
    openingMatches.length,
    1,
    `${sourceLabel} locator ${tagName}#${id} must occur exactly once (found ${openingMatches.length})`,
  );
  const openingMatch = openingMatches[0];
  const tagPattern = new RegExp(`</?${tagName}\\b[^>]*>`, "gi");
  tagPattern.lastIndex = openingMatch.index + openingMatch[0].length;
  let depth = 1;
  let tagMatch;
  while ((tagMatch = tagPattern.exec(html)) !== null) {
    if (tagMatch[0].startsWith("</")) {
      depth -= 1;
    } else if (!tagMatch[0].endsWith("/>")) {
      depth += 1;
    }
    if (depth === 0) {
      return html.slice(openingMatch.index, tagPattern.lastIndex);
    }
  }
  assert.fail(`${sourceLabel} locator ${tagName}#${id} is not closed`);
}

function assertRequiredText(text, contract, sourceLabel) {
  assert.ok(
    text.includes(contract.required_text),
    `${sourceLabel} lacks ${contract.locator}: ${contract.required_text}`,
  );
  return contract;
}

function verifyManagementLocators(html) {
  return SOURCE_TEXT_VERIFICATION.cua.map((contract) => {
    if (contract.identity === "h1") {
      const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
      assert.ok(heading, "CUA 2023 PMC HTML article H1 title is missing");
      return assertRequiredText(visibleText(heading[1]), contract, "CUA 2023 PMC HTML");
    }
    if (contract.identity) {
      return assertRequiredText(
        visibleText(metadataValue(html, contract.identity) ?? ""),
        contract,
        "CUA 2023 PMC HTML",
      );
    }
    return assertRequiredText(
      visibleText(elementById(html, "section", contract.section_id, "CUA 2023 PMC HTML")),
      contract,
      "CUA 2023 PMC HTML",
    );
  });
}

function assertClassificationIdentity(html) {
  assert.equal(metadataValue(html, "citation_journal_title"), "Radiology", "Silverman journal identity drifted");
  assert.equal(
    metadataValue(html, "citation_title"),
    "Bosniak Classification of Cystic Renal Masses, Version 2019: An Update Proposal and Needs Assessment",
    "Silverman title identity drifted",
  );
  assert.equal(metadataValue(html, "citation_doi"), "10.1148/radiol.2019182646", "Silverman DOI identity drifted");
  assert.equal(metadataValue(html, "citation_pmid"), "31210616", "Silverman PMID identity drifted");
}

function validateClassification({ bytes, verifyDigest = true } = {}) {
  assert.ok(bytes.length >= CLASSIFICATION_SOURCE.minBytes, "Silverman PMC HTML is unexpectedly small");
  const html = bytes.toString("utf8");
  assertClassificationIdentity(html);
  const canonical = Buffer.from(classificationArticleText(html), "utf8");
  if (verifyDigest) {
    assert.equal(canonical.length, CLASSIFICATION_SOURCE.canonicalBytes, "Silverman canonical text length drifted");
    assert.equal(sha256(canonical), CLASSIFICATION_SOURCE.canonicalSha256, "Silverman canonical text SHA256 drifted");
  }
  const canonicalText = canonical.toString("utf8");
  for (const [snippet, message] of [
    ["well-defined homogeneous masses of 70 hu or greater", "inclusive 70 HU category-II boundary"],
    ["focal enhancing convex protrusion 4 mm or larger", "inclusive 4 mm category-IV nodule boundary"],
    ["obtuse margins with the wall or septa", "obtuse-margin nodule qualifier"],
  ]) assert.ok(canonicalText.includes(snippet), `Silverman publication lacks the ${message}`);
  const sourceTextVerification = SOURCE_TEXT_VERIFICATION.silverman.map((contract) =>
    assertRequiredText(
      visibleText(elementById(html, "section", contract.section_id, "Silverman HTML")),
      contract,
      "Silverman publication",
    )
  );
  return { bytes, html, canonical, canonicalSha256: sha256(canonical), sourceTextVerification };
}

function assertManagementIdentity(html) {
  assert.equal(
    metadataValue(html, "citation_journal_title"),
    "Canadian Urological Association Journal",
    "CUA 2023 journal identity drifted",
  );
  assert.equal(metadataValue(html, "citation_doi"), "10.5489/cuaj.8389", "CUA 2023 DOI identity drifted");
  assert.equal(metadataValue(html, "citation_pmid"), "37310905", "CUA 2023 PMID identity drifted");
  assert.equal(
    metadataValue(html, "citation_fulltext_html_url"),
    MANAGEMENT_FULLTEXT_URL,
    "CUA 2023 full-text URL identity drifted",
  );
  const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  assert.equal(headings.length, 1, "CUA 2023 article must contain exactly one H1");
  assert.equal(visibleText(headings[0][1]), visibleText(MANAGEMENT_TITLE), "CUA 2023 H1 title identity drifted");
  assert.match(html, /\bPMCID:\s*PMC10263289\b/i, "CUA 2023 PMCID identity drifted");
}

async function validateManagementHtml({ bytes, verifyDigest = true } = {}) {
  assert.ok(bytes.length >= MANAGEMENT_SOURCE.minBytes, "CUA 2023 PMC HTML is unexpectedly small");
  const html = bytes.toString("utf8");
  assertManagementIdentity(html);
  const canonical = Buffer.from(articleBodyText(html, "CUA 2023 PMC"), "utf8");
  if (verifyDigest) {
    assert.equal(canonical.length, MANAGEMENT_SOURCE.canonicalBytes, "CUA 2023 canonical article text length drifted");
    assert.equal(sha256(canonical), MANAGEMENT_SOURCE.canonicalSha256, "CUA 2023 canonical article text SHA256 drifted");
  }
  const text = canonical.toString("utf8");
  assert.ok(
    text.includes("for patients with a bosniak iif cyst, a followup every 6-12 months is suggested for the first year, and then yearly if the cyst is stable"),
    "CUA 2023 lacks the IIF first-year and stable annual follow-up recommendation",
  );
  assert.ok(
    text.includes("for patients with a bosniak iif cyst that do not demonstrate progression on imaging, a followup of five years is suggested"),
    "CUA 2023 lacks the five-year no-progression follow-up recommendation",
  );
  assert.ok(text.includes("expert opinion"), "CUA 2023 lacks the interval evidence grade");
  assert.ok(text.includes("conditional recommendation, very low certainty"), "CUA 2023 lacks the duration evidence grade");
  const sourceTextVerification = verifyManagementLocators(html);
  const sec15Text = visibleText(elementById(html, "section", "sec15", "CUA 2023 PMC HTML"));
  const interval = SOURCE_TEXT_VERIFICATION.cua.find(({ id }) => id === "cua-iif-interval");
  const intervalEvidence = SOURCE_TEXT_VERIFICATION.cua.find(({ id }) => id === "cua-iif-interval-evidence");
  const duration = SOURCE_TEXT_VERIFICATION.cua.find(({ id }) => id === "cua-iif-duration");
  const durationEvidence = SOURCE_TEXT_VERIFICATION.cua.find(({ id }) => id === "cua-iif-duration-evidence");
  assert.ok(
    sec15Text.includes(`${interval.required_text} (${intervalEvidence.required_text})`),
    "CUA 2023 section #sec15 has an interval recommendation/evidence-grade mismatch",
  );
  assert.ok(
    sec15Text.includes(`${duration.required_text} (${durationEvidence.required_text})`),
    "CUA 2023 section #sec15 has a duration recommendation/evidence-grade mismatch",
  );
  return { bytes, html, canonical, canonicalSha256: sha256(canonical), sourceTextVerification };
}

const fetchClassificationHtml = (options = {}) => fetchArtifact(CLASSIFICATION_SOURCE, {
  ...options,
  verifyDigest: options.verifyDigest !== false,
  validate: ({ bytes }) => validateClassification({ bytes, verifyDigest: options.verifyDigest !== false }),
});
const fetchManagementHtml = (options = {}) => fetchArtifact(MANAGEMENT_SOURCE, {
  ...options,
  verifyDigest: options.verifyDigest !== false,
  validate: ({ bytes }) => validateManagementHtml({ bytes, verifyDigest: options.verifyDigest !== false }),
});

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

function mockResponse({
  body,
  status = 200,
  url,
  contentType = "text/html; charset=utf-8",
  contentLength = String(Buffer.byteLength(body)),
  redirected = false,
  chunkSize = 16_384,
  cancelError,
}) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const stats = { cancelCount: 0, bytesEnqueued: 0 };
  let offset = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      const end = Math.min(offset + chunkSize, bytes.length);
      controller.enqueue(new Uint8Array(bytes.subarray(offset, end)));
      stats.bytesEnqueued += end - offset;
      offset = end;
    },
    cancel() {
      stats.cancelCount += 1;
      if (cancelError) throw cancelError;
    },
  });
  return {
    status,
    url,
    redirected,
    headers: new Headers({
      "content-type": contentType,
      ...(contentLength === null ? {} : { "content-length": contentLength }),
    }),
    body: stream,
    stats,
  };
}

function sequenceFetch(responses, calls = []) {
  let index = 0;
  return async () => {
    calls.push(index + 1);
    const response = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return response;
  };
}

function classificationFixtureHtml(nonce) {
  return `${"x".repeat(CLASSIFICATION_RAW_MIN_BYTES)}
    <meta name="citation_journal_title" content="Radiology">
    <meta name="citation_title" content="Bosniak Classification of Cystic Renal Masses, Version 2019: An Update Proposal and Needs Assessment">
    <meta name="citation_doi" content="10.1148/radiol.2019182646">
    <meta name="citation_pmid" content="31210616">
    <main><article><script nonce="${nonce}">const volatile = "${nonce}";</script>
      <section id="s5"><h2>Recent Developments to Improve Characterization of Cystic Renal Masses</h2>
        Well-defined homogeneous masses of 70 HU or greater are included.
      </section>
      <section id="sec17"><h3>Bosniak IV</h3>
        A focal enhancing convex protrusion 4 mm or larger is a nodule.
        Nodules have obtuse margins with the wall or septa.
      </section>
    </article></main>`;
}

async function runSelfTests() {
  const noWait = async () => {};
  const fixtureOne = classificationFixtureHtml("runner-one");
  const fixtureTwo = classificationFixtureHtml("runner-two");
  const cuaHtmlFixture = `${"x".repeat(300_000)}
    <meta name="citation_journal_title" content="Canadian Urological Association Journal">
    <meta name="citation_title" content="2023 UPDATE – Canadian Urological Association guideline: Management of cystic renal lesions">
    <meta name="citation_doi" content="10.5489/cuaj.8389">
    <meta name="citation_pmid" content="37310905">
    <meta name="citation_fulltext_html_url" content="https://pmc.ncbi.nlm.nih.gov/articles/PMC10263289/">
    <main><article><script nonce="cua-runner-one">const volatile = "cua-runner-one";</script><h1>2023 UPDATE – Canadian Urological Association guideline: Management of cystic renal lesions</h1><div>PMCID: PMC10263289</div>
      <section id="sec15"><h2>Bosniak category IIF</h2>
        For patients with a Bosniak IIF cyst, a followup every 6–12 months is suggested for the first year, and then yearly if the cyst is stable (Expert opinion).
        For patients with a Bosniak IIF cyst that do not demonstrate progression on imaging, a followup of five years is suggested (Conditional recommendation, very low certainty in evidence of effects).
      </section>${"x".repeat(76_809)}
    </article></main>`;
  const cuaHtmlSourceFixture = {
    label: "CUA 2023 PMC HTML",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10263289/?report=reader",
    mediaType: "text/html",
    userAgent: "Radulator-Bosniak-CUA-2023-source-audit/1",
    maxBytes: SOURCE_MAX_BYTES,
  };
  assert.equal(
    MANAGEMENT_SOURCE.url,
    cuaHtmlSourceFixture.url,
    "the CUA live source must be the exact PMC reader URL",
  );
  assert.equal(
    MANAGEMENT_SOURCE.mediaType,
    cuaHtmlSourceFixture.mediaType,
    "the CUA live source must accept HTML rather than the intermittent publisher PDF",
  );
  const cuaFixtureResult = await fetchManagementHtml({
      fetchImpl: sequenceFetch([
        mockResponse({ body: cuaHtmlFixture, url: cuaHtmlSourceFixture.url }),
      ]),
      sleepImpl: noWait,
      verifyDigest: false,
  });
  assert.equal(cuaFixtureResult.canonical.length > 0, true, "CUA PMC HTML fixture has canonical article text");
  assert.deepEqual(
    cuaFixtureResult.sourceTextVerification,
    SOURCE_TEXT_VERIFICATION.cua,
    "CUA PMC HTML fixture matches the pinned section contracts",
  );
  const nonceVariantResult = await fetchManagementHtml({
    fetchImpl: sequenceFetch([
      mockResponse({ body: cuaHtmlFixture.replace(/cua-runner-one/g, "cua-runner-two"), url: cuaHtmlSourceFixture.url }),
    ]),
    sleepImpl: noWait,
    verifyDigest: false,
  });
  assert.equal(nonceVariantResult.canonical.length, cuaFixtureResult.canonical.length);
  assert.equal(nonceVariantResult.canonicalSha256, cuaFixtureResult.canonicalSha256);
  assert.notEqual(
    sha256(Buffer.from(cuaHtmlFixture)),
    sha256(Buffer.from(cuaHtmlFixture.replace(/cua-runner-one/g, "cua-runner-two"))),
    "volatile CUA HTML wrapper bytes must not be treated as its canonical digest",
  );

  // Retrieval policy (scripts/lib/ncbi-fetch.mjs). A 200 page that fails validation is a changed
  // source and fails at once; a wrong final URL or media type, a redirect, and a challenge page are
  // retried, five attempts in all; a terminal status stops at once.
  const cancelCounts = (responses) => responses.map(({ stats }) => stats.cancelCount);
  const retriedResponses = (make) => Array.from({ length: MAX_ATTEMPTS }, make);

  // Pin mutations served with HTTP 200. The fixture's canonical text has the pinned CUA length, so a
  // same-length semantic edit must fail the digest, and a one-character insertion must fail the length.
  const semanticChangeFixture = cuaHtmlFixture.replace("yearly if the cyst is stable", "yearly if the cyst is stably");
  assert.equal(
    Buffer.byteLength(articleBodyText(semanticChangeFixture, "CUA 2023 PMC")),
    MANAGEMENT_SOURCE.canonicalBytes,
    "the semantic-change fixture keeps the pinned canonical length",
  );
  const semanticChangeCalls = [];
  await assert.rejects(
    fetchManagementHtml({
      fetchImpl: sequenceFetch([mockResponse({ body: semanticChangeFixture, url: MANAGEMENT_SOURCE.url })], semanticChangeCalls),
      sleepImpl: noWait,
    }),
    /CUA 2023 canonical article text SHA256 drifted/,
    "semantic CUA article changes fail the pinned canonical digest",
  );
  assert.equal(semanticChangeCalls.length, 1, "a same-length digest drift is a changed source, never retried");
  const semanticChangeCanonical = Buffer.from(articleBodyText(semanticChangeFixture, "CUA 2023 PMC"), "utf8");
  assert.notEqual(
    cuaFixtureResult.canonicalSha256,
    sha256(semanticChangeCanonical),
    "semantic CUA article changes alter the canonical digest",
  );
  const lengthDriftFixture = cuaHtmlFixture.replace("yearly if the cyst is stable", "yearly if the cyst is stables");
  assert.equal(
    Buffer.byteLength(articleBodyText(lengthDriftFixture, "CUA 2023 PMC")),
    MANAGEMENT_SOURCE.canonicalBytes + 1,
    "the length-drift fixture is one canonical byte longer than the pin",
  );
  const lengthDriftCalls = [];
  await assert.rejects(
    fetchManagementHtml({
      fetchImpl: sequenceFetch([mockResponse({ body: lengthDriftFixture, url: MANAGEMENT_SOURCE.url })], lengthDriftCalls),
      sleepImpl: noWait,
    }),
    /CUA 2023 canonical article text length drifted/,
    "a canonical length change fails the pinned canonical length",
  );
  assert.equal(lengthDriftCalls.length, 1, "a length drift is a changed source, never retried");

  const wrongCuaIdentityCalls = [];
  await assert.rejects(
    fetchManagementHtml({
      fetchImpl: sequenceFetch([
        mockResponse({ body: cuaHtmlFixture.replace("10.5489/cuaj.8389", "10.5489/cuaj.wrong"), url: MANAGEMENT_SOURCE.url }),
      ], wrongCuaIdentityCalls),
      sleepImpl: noWait,
      verifyDigest: false,
    }),
    /CUA 2023 DOI identity drifted/,
    "CUA PMC HTML identity drift is rejected",
  );
  assert.equal(wrongCuaIdentityCalls.length, 1);

  const wrongCuaUrlResponses = retriedResponses(() =>
    mockResponse({
      body: cuaHtmlFixture,
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10263289/?report=reader&variant=1",
    }),
  );
  const wrongCuaUrlCalls = [];
  await assert.rejects(
    fetchManagementHtml({
      fetchImpl: sequenceFetch(wrongCuaUrlResponses, wrongCuaUrlCalls),
      sleepImpl: noWait,
      verifyDigest: false,
    }),
    /CUA 2023 PMC HTML retrieval failed after 5 of 5 attempts \(CUA 2023 PMC HTML final URL is not exact/,
    "CUA PMC HTML wrong final URL is rejected",
  );
  assert.equal(wrongCuaUrlCalls.length, MAX_ATTEMPTS);
  assert.deepEqual(
    cancelCounts(wrongCuaUrlResponses),
    [1, 1, 1, 1, 1],
    "every CUA wrong-final-URL response cancels its unread body",
  );

  for (const [fixture, found] of [
    [cuaHtmlFixture.replace('id="sec15"', 'id="sec99"'), 0],
    [cuaHtmlFixture.replace("</article>", '<section id="sec15">duplicate locator</section></article>'), 2],
  ]) {
    const calls = [];
    await assert.rejects(
      fetchManagementHtml({
        fetchImpl: sequenceFetch([mockResponse({ body: fixture, url: MANAGEMENT_SOURCE.url })], calls),
        sleepImpl: noWait,
        verifyDigest: false,
      }),
      new RegExp(`CUA 2023 PMC HTML locator section#sec15 must occur exactly once \\(found ${found}\\)`),
      found === 0 ? "CUA recommendations moved out of sec15 are rejected" : "duplicate CUA section IDs are rejected",
    );
    assert.equal(calls.length, 1);
  }

  const cuaChallenge = `${"<html><title>Preparing to download...</title>"}${"x".repeat(MANAGEMENT_SOURCE.minBytes)}</html>`;
  const cuaChallengeResponses = retriedResponses(() => mockResponse({ body: cuaChallenge, url: MANAGEMENT_SOURCE.url }));
  const cuaChallengeCalls = [];
  await assert.rejects(
    fetchManagementHtml({
      fetchImpl: sequenceFetch(cuaChallengeResponses, cuaChallengeCalls),
      sleepImpl: noWait,
      verifyDigest: false,
    }),
    /CUA 2023 PMC HTML retrieval failed after 5 of 5 attempts \(CUA 2023 PMC HTML served a challenge page/,
    "CUA PMC challenge/variant body is retried, then rejected",
  );
  assert.equal(cuaChallengeCalls.length, MAX_ATTEMPTS);
  assert.deepEqual(
    cancelCounts(cuaChallengeResponses),
    [0, 0, 0, 0, 0],
    "fully consumed CUA challenge bodies do not require a second cleanup",
  );
  const misplacedClassificationFixture = fixtureOne
    .replace('id="s5"', 'id="swapped-s5"')
    .replace('id="sec17"', 'id="s5"')
    .replace('id="swapped-s5"', 'id="sec17"');
  const misplacedCalls = [];
  await assert.rejects(
    fetchClassificationHtml({
      fetchImpl: sequenceFetch([
        mockResponse({ body: misplacedClassificationFixture, url: CLASSIFICATION_SOURCE.url }),
      ], misplacedCalls),
      sleepImpl: noWait,
      verifyDigest: false,
    }),
    /Silverman publication lacks HTML section #s5/,
    "Silverman locator verification rejects matching text in a different section",
  );
  assert.equal(misplacedCalls.length, 1);
  const first = await fetchClassificationHtml({
    fetchImpl: sequenceFetch([
      mockResponse({
        body: fixtureOne,
        url: CLASSIFICATION_SOURCE.url,
      }),
    ]),
    sleepImpl: noWait,
    verifyDigest: false,
  });
  const second = await fetchClassificationHtml({
    fetchImpl: sequenceFetch([
      mockResponse({
        body: fixtureTwo,
        url: CLASSIFICATION_SOURCE.url,
      }),
    ]),
    sleepImpl: noWait,
    verifyDigest: false,
  });
  assert.equal(first.canonical.length, second.canonical.length);
  assert.equal(first.canonicalSha256, second.canonicalSha256);

  const challenge = `${"<html><title>Preparing to download...</title>"}${"x".repeat(CLASSIFICATION_RAW_MIN_BYTES)}</html>`;
  const challengeCalls = [];
  const challengeResponses = retriedResponses(() => mockResponse({ body: challenge, url: CLASSIFICATION_SOURCE.url }));
  await assert.rejects(
    fetchClassificationHtml({
      fetchImpl: sequenceFetch(challengeResponses, challengeCalls),
      sleepImpl: noWait,
      verifyDigest: false,
    }),
    /Silverman PMC HTML retrieval failed after 5 of 5 attempts \(Silverman PMC HTML served a challenge page/,
  );
  assert.equal(challengeCalls.length, MAX_ATTEMPTS, "PoW/variant body uses bounded retry count");
  assert.deepEqual(
    cancelCounts(challengeResponses),
    [0, 0, 0, 0, 0],
    "fully consumed variant bodies do not require a second cleanup",
  );
  const recoveredCalls = [];
  const recovered = await fetchClassificationHtml({
    fetchImpl: sequenceFetch([
      mockResponse({ body: "<html><title>Preparing to download...</title></html>", url: CLASSIFICATION_SOURCE.url }),
      mockResponse({ body: fixtureOne, url: CLASSIFICATION_SOURCE.url }),
    ], recoveredCalls),
    sleepImpl: noWait,
    verifyDigest: false,
  });
  assert.equal(recovered.canonicalSha256, first.canonicalSha256, "a page under the size floor is retried until the article arrives");
  assert.equal(recoveredCalls.length, 2);

  const wrongUrlResponses = retriedResponses(() =>
    mockResponse({
      body: fixtureOne,
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6677285/?report=reader&variant=1",
    }),
  );
  const wrongUrlCalls = [];
  await assert.rejects(
    fetchClassificationHtml({
      fetchImpl: sequenceFetch(wrongUrlResponses, wrongUrlCalls),
      sleepImpl: noWait,
      verifyDigest: false,
    }),
    /Silverman PMC HTML retrieval failed after 5 of 5 attempts \(Silverman PMC HTML final URL is not exact/,
  );
  assert.equal(wrongUrlCalls.length, MAX_ATTEMPTS, "wrong final URL uses bounded retries");
  assert.deepEqual(
    cancelCounts(wrongUrlResponses),
    [1, 1, 1, 1, 1],
    "every wrong-final-URL response cancels its unread body",
  );

  const wrongMediaResponses = retriedResponses(() =>
    mockResponse({
      body: "wrong media body",
      url: MANAGEMENT_SOURCE.url,
      contentType: "application/pdf",
    }),
  );
  const wrongMediaCalls = [];
  await assert.rejects(
    fetchManagementHtml({
      fetchImpl: sequenceFetch(wrongMediaResponses, wrongMediaCalls),
      sleepImpl: noWait,
      verifyDigest: false,
    }),
    /CUA 2023 PMC HTML retrieval failed after 5 of 5 attempts \(CUA 2023 PMC HTML media type/,
  );
  assert.equal(wrongMediaCalls.length, MAX_ATTEMPTS, "wrong media type uses bounded retries");
  assert.deepEqual(
    cancelCounts(wrongMediaResponses),
    [1, 1, 1, 1, 1],
    "every wrong-media response cancels its unread body",
  );

  const redirectedResponses = retriedResponses(() =>
    mockResponse({
      body: "redirected",
      url: MANAGEMENT_SOURCE.url,
      contentType: MANAGEMENT_SOURCE.mediaType,
      redirected: true,
      cancelError: new Error("fixture cancel failed"),
    }),
  );
  const redirectedCalls = [];
  await assert.rejects(
    fetchManagementHtml({
      fetchImpl: sequenceFetch(redirectedResponses, redirectedCalls),
      sleepImpl: noWait,
      verifyDigest: false,
    }),
    /retrieval failed after 5 of 5 attempts \(redirected response\)/,
  );
  assert.equal(redirectedCalls.length, MAX_ATTEMPTS, "redirect rejection retries within the five-attempt bound");
  assert.deepEqual(
    cancelCounts(redirectedResponses),
    [1, 1, 1, 1, 1],
    "redirect cleanup is attempted even when cancellation rejects",
  );

  const notFound = mockResponse({
    body: "not found",
    status: 404,
    url: MANAGEMENT_SOURCE.url,
    contentType: MANAGEMENT_SOURCE.mediaType,
    cancelError: new Error("fixture cancel failed"),
  });
  const notFoundCalls = [];
  await assert.rejects(
    fetchManagementHtml({
      fetchImpl: sequenceFetch([notFound], notFoundCalls),
      sleepImpl: noWait,
      verifyDigest: false,
    }),
    /retrieval failed after 1 of 5 attempts \(HTTP 404\)/,
  );
  assert.equal(notFoundCalls.length, 1, "non-retryable HTTP 404 makes one request");
  assert.equal(notFound.stats.cancelCount, 1, "HTTP failure cleanup is attempted even when cancellation rejects");

  const oversized = mockResponse({
    body: Buffer.alloc(SOURCE_MAX_BYTES + 65_536, 0x78),
    url: CLASSIFICATION_SOURCE.url,
    contentLength: null,
    chunkSize: 32_768,
  });
  const oversizedCalls = [];
  await assert.rejects(
    fetchClassificationHtml({
      fetchImpl: sequenceFetch([oversized], oversizedCalls),
      sleepImpl: noWait,
      verifyDigest: false,
    }),
    /Silverman PMC HTML body exceeds the 1000000-byte boundary/,
  );
  assert.equal(oversizedCalls.length, 1, "an oversized page is a changed source, never retried");
  assert.equal(oversized.stats.cancelCount, 1, "oversized stream cancels its reader");
  assert.ok(oversized.stats.bytesEnqueued < SOURCE_MAX_BYTES + 65_536, "oversized stream stops before full body");

  // NCBI_API_KEY hygiene: PMC is not a key host, so requests go to the exact canonical URL, and no
  // error or fetch-log line ever carries the key.
  const keyScratch = mkdtempSync(path.join(os.tmpdir(), "bosniak-ncbi-key-"));
  try {
    const fakeKey = "1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b";
    const env = { NCBI_API_KEY: fakeKey, RADULATOR_SOURCE_FETCH_LOG: path.join(keyScratch, "fetch-log.jsonl") };
    const requested = [];
    await fetchManagementHtml({
      env,
      sleepImpl: noWait,
      verifyDigest: false,
      fetchImpl: async (url) => {
        requested.push(url);
        return mockResponse({ body: cuaHtmlFixture, url });
      },
    });
    assert.equal(requested.length === 1 && requested[0] === MANAGEMENT_SOURCE.url, true, "PMC must never receive NCBI_API_KEY");
    const exhausted = await fetchClassificationHtml({
      env,
      sleepImpl: noWait,
      fetchImpl: async (url) => {
        throw new TypeError(`request to ${url}&api_key=${fakeKey} failed`);
      },
    }).then(() => null, (error) => error);
    assert.ok(exhausted instanceof Error, "an exhausted retrieval fails loudly");
    const surfaces = `${exhausted.message}\n${readFileSync(env.RADULATOR_SOURCE_FETCH_LOG, "utf8")}`;
    assert.equal(surfaces.includes(fakeKey), false, "NCBI_API_KEY must never reach output");
    assert.equal(/api_key=(?!\[REDACTED\])/.test(surfaces), false, "no api_key value may reach output");
  } finally {
    rmSync(keyScratch, { recursive: true, force: true });
  }
}

if (process.argv.includes("--self-test")) {
  await runSelfTests();
  console.log("Bosniak source retrieval fixture tests passed");
} else {
  const [classificationSource, managementSource] = await Promise.all([
    fetchClassificationHtml(),
    fetchManagementHtml(),
  ]);

  const fixture = JSON.parse(await readFile(FIXTURE_PATH, "utf8"));
  assert.equal(fixture.calculatorId, "bosniak");
  const casesById = new Map(fixture.cases.map((testCase) => [testCase.id, testCase]));
  assert.equal(casesById.size, fixture.cases.length, "Bosniak fixture IDs must be unique");
  for (const vectorId of BOUND_VECTOR_IDS) {
    const testCase = casesById.get(vectorId);
    assert.ok(testCase, `Bosniak fixture lacks ${vectorId}`);
    assertFixtureExpectation(
      RenalCystBosniak.compute({ ...testCase.inputs }),
      testCase.expect,
      vectorId,
    );
  }

  const artifacts = [
    {
      id: CLASSIFICATION_SOURCE.id,
      url: CLASSIFICATION_SOURCE.url,
      host: CLASSIFICATION_SOURCE.host,
      path: CLASSIFICATION_SOURCE.path,
      media_type: CLASSIFICATION_SOURCE.mediaType,
      raw_source_min_bytes: CLASSIFICATION_SOURCE.minBytes,
      raw_source_max_bytes: CLASSIFICATION_SOURCE.maxBytes,
      canonical_source_bytes: classificationSource.canonical.length,
      canonical_source_sha256: classificationSource.canonicalSha256,
    },
    {
      id: MANAGEMENT_SOURCE.id,
      url: MANAGEMENT_SOURCE.url,
      host: MANAGEMENT_SOURCE.host,
      path: MANAGEMENT_SOURCE.path,
      media_type: MANAGEMENT_SOURCE.mediaType,
      raw_source_min_bytes: MANAGEMENT_SOURCE.minBytes,
      raw_source_max_bytes: MANAGEMENT_SOURCE.maxBytes,
      canonical_source_bytes: managementSource.canonical.length,
      canonical_source_sha256: managementSource.canonicalSha256,
    },
  ];
  const audit = {
    schema: "radulator-bosniak-primary-source-audit/v1",
    source_authority: "Silverman et al., Radiology 2019 and CUA 2023",
    source_urls: [CLASSIFICATION_SOURCE.url, MANAGEMENT_SOURCE.url],
    artifacts,
    source_bytes: {
      silverman: classificationSource.bytes.length,
      cua: managementSource.bytes.length,
    },
    source_canonical_bytes: {
      silverman: classificationSource.canonical.length,
      cua: managementSource.canonical.length,
    },
    source_canonical_sha256: {
      silverman: classificationSource.canonicalSha256,
      cua: managementSource.canonicalSha256,
    },
    source_text_verification: {
      silverman: classificationSource.sourceTextVerification,
      cua: managementSource.sourceTextVerification,
    },
    source_claims: {
      homogeneous_noncontrast_mass_70_hu_or_greater: true,
      obtuse_margin_nodule_4_mm_or_larger: true,
      iif_first_year_followup_months: [6, 12],
      iif_yearly_if_stable: true,
      iif_followup_years_if_no_progression: 5,
      iif_interval_evidence: "expert opinion",
      iif_duration_evidence: "conditional recommendation, very low certainty",
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
      "Bosniak primary-source audit passed: 2 classification boundaries, CUA IIF management, and 3 executable vectors.",
    );
  }
}
