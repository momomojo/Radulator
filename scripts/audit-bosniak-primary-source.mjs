#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { RenalCystBosniak } from "../src/components/calculators/RenalCystBosniak.jsx";

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
const RETRY_ATTEMPTS = 3;
const BOUND_VECTOR_IDS = Object.freeze([
  "exactly-70-hu-homogeneous-noncontrast-mass-category-ii",
  "exactly-4-mm-obtuse-margin-enhancing-nodule-category-iv",
  "minimally-thick-enhancing-wall-category-iif",
]);

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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

async function cancelResponseBody(response) {
  try {
    await response.body?.cancel();
  } catch {
    // Cleanup errors cannot replace the authoritative URL, status, or media failure.
  }
}

async function readBoundedBody(response, maxBytes, label) {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 0) {
      await cancelResponseBody(response);
      throw new Error(`${label} content-length is malformed`);
    }
    if (declaredLength > maxBytes) {
      await cancelResponseBody(response);
      throw new Error(`${label} body exceeds the ${maxBytes}-byte boundary`);
    }
  }
  if (!response.body || typeof response.body.getReader !== "function") {
    await cancelResponseBody(response);
    throw new Error(`${label} response body is not stream-readable`);
  }
  let reader;
  try {
    reader = response.body.getReader();
  } catch (error) {
    await cancelResponseBody(response);
    throw error;
  }
  const chunks = [];
  let totalBytes = 0;
  let cancelled = false;
  const cancel = async () => {
    if (cancelled) return;
    cancelled = true;
    try {
      await reader.cancel();
    } catch {
      // The size failure remains authoritative if the body is already closed.
    }
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof ArrayBuffer) && !ArrayBuffer.isView(value)) {
        await cancel();
        throw new Error(`${label} response body yielded a malformed chunk`);
      }
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await cancel();
        throw new Error(`${label} body exceeds the ${maxBytes}-byte boundary`);
      }
      chunks.push(
        value instanceof ArrayBuffer
          ? Buffer.from(value)
          : Buffer.from(value.buffer, value.byteOffset, value.byteLength),
      );
    }
  } catch (error) {
    await cancel();
    throw error;
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, totalBytes);
}

async function fetchArtifact(
  source,
  { fetchImpl = globalThis.fetch, sleepImpl = wait, validate },
) {
  let lastFailure = "unknown retrieval failure";
  let attemptsMade = 0;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    attemptsMade = attempt;
    try {
      const response = await fetchImpl(source.url, {
        headers: { "user-agent": source.userAgent },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
      if (response.redirected === true) {
        lastFailure = "redirected response";
        await cancelResponseBody(response);
      } else if (response.status !== 200) {
        lastFailure = `HTTP ${response.status}`;
        await cancelResponseBody(response);
        if (response.status !== 429 && response.status >= 300 && response.status < 500) break;
      } else {
        try {
          assertExactFinalUrl(response, source.url, source.label);
          assertMediaType(response, source.mediaType, source.label);
        } catch (error) {
          await cancelResponseBody(response);
          throw error;
        }
        const bytes = await readBoundedBody(response, source.maxBytes, source.label);
        return await validate({ bytes, response });
      }
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    if (attempt < RETRY_ATTEMPTS) {
      await sleepImpl(attempt * 500);
    }
  }
  const attemptWord = attemptsMade === 1 ? "attempt" : "attempts";
  throw new Error(
    `${source.label} retrieval failed after ${attemptsMade} ${attemptWord} (${lastFailure})`,
  );
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
  validate: ({ bytes }) => validateClassification({ bytes, verifyDigest: options.verifyDigest !== false }),
});
const fetchManagementHtml = (options = {}) => fetchArtifact(MANAGEMENT_SOURCE, {
  ...options,
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

  const semanticChangeFixture = cuaHtmlFixture.replace("yearly if the cyst is stable", "yearly if the cyst is stably");
  const semanticChangeResponses = Array.from({ length: RETRY_ATTEMPTS }, () =>
    mockResponse({ body: semanticChangeFixture, url: MANAGEMENT_SOURCE.url }),
  );
  const semanticChangeCalls = [];
  await assert.rejects(
    fetchManagementHtml({
      fetchImpl: sequenceFetch(semanticChangeResponses, semanticChangeCalls),
      sleepImpl: noWait,
    }),
    /CUA 2023 PMC HTML retrieval failed after 3 attempts \(CUA 2023 canonical article text SHA256 drifted/,
    "semantic CUA article changes fail the pinned canonical digest",
  );
  assert.equal(semanticChangeCalls.length, RETRY_ATTEMPTS, "semantic digest drift uses bounded retries");
  const semanticChangeCanonical = Buffer.from(articleBodyText(semanticChangeFixture, "CUA 2023 PMC"), "utf8");
  assert.notEqual(
    cuaFixtureResult.canonicalSha256,
    sha256(semanticChangeCanonical),
    "semantic CUA article changes alter the canonical digest",
  );

  const wrongCuaIdentityResponses = Array.from({ length: RETRY_ATTEMPTS }, () =>
    mockResponse({
      body: cuaHtmlFixture.replace("10.5489/cuaj.8389", "10.5489/cuaj.wrong"),
      url: MANAGEMENT_SOURCE.url,
    }),
  );
  const wrongCuaIdentityCalls = [];
  await assert.rejects(
    fetchManagementHtml({
      fetchImpl: sequenceFetch(wrongCuaIdentityResponses, wrongCuaIdentityCalls),
      sleepImpl: noWait,
      verifyDigest: false,
    }),
    /CUA 2023 PMC HTML retrieval failed after 3 attempts \(CUA 2023 DOI identity drifted/,
    "CUA PMC HTML identity drift is rejected",
  );
  assert.equal(wrongCuaIdentityCalls.length, RETRY_ATTEMPTS);

  const wrongCuaUrlResponses = Array.from({ length: RETRY_ATTEMPTS }, () =>
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
    /CUA 2023 PMC HTML retrieval failed after 3 attempts \(CUA 2023 PMC HTML final URL is not exact/,
    "CUA PMC HTML wrong final URL is rejected",
  );
  assert.equal(wrongCuaUrlCalls.length, RETRY_ATTEMPTS);
  assert.deepEqual(
    wrongCuaUrlResponses.map(({ stats }) => stats.cancelCount),
    [1, 1, 1],
    "every CUA wrong-final-URL response cancels its unread body",
  );

  const movedCuaLocatorFixture = cuaHtmlFixture.replace('id="sec15"', 'id="sec99"');
  const movedCuaLocatorResponses = Array.from({ length: RETRY_ATTEMPTS }, () =>
    mockResponse({ body: movedCuaLocatorFixture, url: MANAGEMENT_SOURCE.url }),
  );
  const movedCuaLocatorCalls = [];
  await assert.rejects(
    fetchManagementHtml({
      fetchImpl: sequenceFetch(movedCuaLocatorResponses, movedCuaLocatorCalls),
      sleepImpl: noWait,
      verifyDigest: false,
    }),
    /CUA 2023 PMC HTML retrieval failed after 3 attempts \(CUA 2023 PMC HTML locator section#sec15 must occur exactly once \(found 0\)/,
    "CUA recommendations moved out of sec15 are rejected",
  );
  assert.equal(movedCuaLocatorCalls.length, RETRY_ATTEMPTS);

  const duplicateCuaLocatorFixture = cuaHtmlFixture.replace(
    "</article>",
    '<section id="sec15">duplicate locator</section></article>',
  );
  const duplicateCuaLocatorResponses = Array.from({ length: RETRY_ATTEMPTS }, () =>
    mockResponse({ body: duplicateCuaLocatorFixture, url: MANAGEMENT_SOURCE.url }),
  );
  const duplicateCuaLocatorCalls = [];
  await assert.rejects(
    fetchManagementHtml({
      fetchImpl: sequenceFetch(duplicateCuaLocatorResponses, duplicateCuaLocatorCalls),
      sleepImpl: noWait,
      verifyDigest: false,
    }),
    /CUA 2023 PMC HTML retrieval failed after 3 attempts \(CUA 2023 PMC HTML locator section#sec15 must occur exactly once \(found 2\)/,
    "duplicate CUA section IDs are rejected",
  );
  assert.equal(duplicateCuaLocatorCalls.length, RETRY_ATTEMPTS);

  const cuaChallenge = `${"<html><title>Preparing to download...</title>"}${"x".repeat(MANAGEMENT_SOURCE.minBytes)}</html>`;
  const cuaChallengeResponses = Array.from({ length: RETRY_ATTEMPTS }, () =>
    mockResponse({ body: cuaChallenge, url: MANAGEMENT_SOURCE.url }),
  );
  const cuaChallengeCalls = [];
  await assert.rejects(
    fetchManagementHtml({
      fetchImpl: sequenceFetch(cuaChallengeResponses, cuaChallengeCalls),
      sleepImpl: noWait,
      verifyDigest: false,
    }),
    /CUA 2023 PMC HTML retrieval failed after 3 attempts \(CUA 2023 journal identity drifted/,
    "CUA PMC challenge/variant body is rejected",
  );
  assert.equal(cuaChallengeCalls.length, RETRY_ATTEMPTS);
  assert.deepEqual(
    cuaChallengeResponses.map(({ stats }) => stats.cancelCount),
    [0, 0, 0],
    "fully consumed CUA challenge bodies do not require a second cleanup",
  );
  const misplacedClassificationFixture = fixtureOne
    .replace('id="s5"', 'id="swapped-s5"')
    .replace('id="sec17"', 'id="s5"')
    .replace('id="swapped-s5"', 'id="sec17"');
  await assert.rejects(
    fetchClassificationHtml({
      fetchImpl: sequenceFetch([
        mockResponse({
          body: misplacedClassificationFixture,
          url: CLASSIFICATION_SOURCE.url,
        }),
        mockResponse({
          body: misplacedClassificationFixture,
          url: CLASSIFICATION_SOURCE.url,
        }),
        mockResponse({
          body: misplacedClassificationFixture,
          url: CLASSIFICATION_SOURCE.url,
        }),
      ]),
      sleepImpl: noWait,
      verifyDigest: false,
    }),
    /Silverman PMC HTML retrieval failed after 3 attempts \(Silverman publication lacks HTML section #s5/,
    "Silverman locator verification rejects matching text in a different section",
  );
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
  const challengeResponses = Array.from({ length: RETRY_ATTEMPTS }, () =>
    mockResponse({ body: challenge, url: CLASSIFICATION_SOURCE.url }),
  );
  await assert.rejects(
    fetchClassificationHtml({
      fetchImpl: sequenceFetch(challengeResponses, challengeCalls),
      sleepImpl: noWait,
      verifyDigest: false,
    }),
    /Silverman PMC HTML retrieval failed after 3 attempts \(Silverman journal identity drifted/,
  );
  assert.equal(challengeCalls.length, RETRY_ATTEMPTS, "PoW/variant body uses bounded retry count");
  assert.deepEqual(
    challengeResponses.map(({ stats }) => stats.cancelCount),
    [0, 0, 0],
    "fully consumed variant bodies do not require a second cleanup",
  );

  const wrongUrlResponses = Array.from({ length: RETRY_ATTEMPTS }, () =>
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
    /Silverman PMC HTML retrieval failed after 3 attempts \(Silverman PMC HTML final URL is not exact/,
  );
  assert.equal(wrongUrlCalls.length, RETRY_ATTEMPTS, "wrong final URL uses bounded retries");
  assert.deepEqual(
    wrongUrlResponses.map(({ stats }) => stats.cancelCount),
    [1, 1, 1],
    "every wrong-final-URL response cancels its unread body",
  );

  const wrongMediaResponses = Array.from({ length: RETRY_ATTEMPTS }, () =>
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
    /CUA 2023 PMC HTML retrieval failed after 3 attempts \(CUA 2023 PMC HTML media type/,
  );
  assert.equal(wrongMediaCalls.length, RETRY_ATTEMPTS, "wrong media type uses bounded retries");
  assert.deepEqual(
    wrongMediaResponses.map(({ stats }) => stats.cancelCount),
    [1, 1, 1],
    "every wrong-media response cancels its unread body",
  );

  const redirectedResponses = Array.from({ length: RETRY_ATTEMPTS }, () =>
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
    /retrieval failed after 3 attempts \(redirected response\)/,
  );
  assert.equal(redirectedCalls.length, RETRY_ATTEMPTS, "redirect rejection retries exactly three times");
  assert.deepEqual(
    redirectedResponses.map(({ stats }) => stats.cancelCount),
    [1, 1, 1],
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
    /retrieval failed after 1 attempt \(HTTP 404\)/,
  );
  assert.equal(notFoundCalls.length, 1, "non-retryable HTTP 404 makes one request");
  assert.equal(notFound.stats.cancelCount, 1, "HTTP failure cleanup is attempted even when cancellation rejects");

  const oversizedResponses = Array.from({ length: RETRY_ATTEMPTS }, () =>
    mockResponse({
      body: Buffer.alloc(SOURCE_MAX_BYTES + 65_536, 0x78),
      url: CLASSIFICATION_SOURCE.url,
      contentLength: null,
      chunkSize: 32_768,
    }),
  );
  const oversizedCalls = [];
  await assert.rejects(
    fetchClassificationHtml({
      fetchImpl: sequenceFetch(oversizedResponses, oversizedCalls),
      sleepImpl: noWait,
      verifyDigest: false,
    }),
    /retrieval failed after 3 attempts \(Silverman PMC HTML body exceeds the 1000000-byte boundary\)/,
  );
  assert.equal(oversizedCalls.length, RETRY_ATTEMPTS, "oversized stream retries within the bound");
  for (const response of oversizedResponses) {
    assert.equal(response.stats.cancelCount, 1, "oversized stream cancels its reader");
    assert.ok(
      response.stats.bytesEnqueued < SOURCE_MAX_BYTES + 65_536,
      "oversized stream stops before full body",
    );
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
