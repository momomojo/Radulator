#!/usr/bin/env node
// Primary-source audit for the IPSS calculator's localization cutoffs.
//
// Source: Siddiq F et al. Consensus Guidelines on Inferior Petrosal Sinus Sampling: A Guideline From
// the Society of Vascular and Interventional Neurology Guidelines and Practice Standards Committee.
// Stroke: Vascular and Interventional Neurology 2026 (PMID 42088331, PMC13138407,
// DOI 10.1161/SVIN.125.002309).
//
// The DOI and the PMC HTML page sit behind browser challenges, so the audit retrieves the article
// as PMC XML through NCBI E-utilities, checks its identity, asserts the literal cutoff statements,
// and binds them to the calculator's exact boundary behaviour (inclusive >=2, >=3 and >=1.8).
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";

export const SOURCE = Object.freeze({
  pmid: "42088331",
  pmcid: "PMC13138407",
  doi: "10.1161/SVIN.125.002309",
  title: "Consensus Guidelines on Inferior Petrosal Sinus Sampling",
  url: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&retmode=xml&tool=radulator-ipss-source-audit&id=13138407",
});

// Literal statements, after normalize(): each must appear verbatim in the article body.
export const CLAIMS = Object.freeze([
  {
    id: "acth-basal-and-stimulated-cutoffs",
    text: "An ACTH IPS:P ratio >=2 prestimulation or a peak >=3 poststimulation (CRH or desmopressin) is considered diagnostic for CD.",
  },
  {
    id: "prl-supports-adequate-sampling",
    text: "Prestimulation PRL IPS:P ratios >=1.8 support adequate catheterization",
  },
  {
    id: "prl-below-1.8-flags-placement",
    text: "with a ratio <1.8 indicating improper placement",
  },
]);

export const FETCH_ATTEMPTS = 5;
export const FETCH_MAX_DELAY_MS = 30_000;

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ge: "≥", le: "≤" };

export function xmlToText(xml) {
  return xml
    .replace(/<\/(?:p|title|sec|td|th|tr|caption|label|list-item|table-wrap|fig)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

export function normalize(text) {
  return text
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/[‐-―−]/g, "-")
    .replace(/[  -​  ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function retryDelayMs(response, attempt, now = Date.now()) {
  const retryAfter = response?.headers?.get?.("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return date - now;
  }
  return 2 ** (attempt - 1) * 1_000;
}

export async function fetchSourceXml({
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  attempts = FETCH_ATTEMPTS,
} = {}) {
  let lastFailure = "unknown retrieval failure";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(SOURCE.url, {
        headers: { "user-agent": "Radulator-IPSS-primary-source-audit/1" },
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) return await response.text();
      lastFailure = `HTTP ${response.status}`;
      await response.body?.cancel?.();
      if (response.status !== 429 && response.status < 500) break;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    if (attempt < attempts) {
      await sleep(Math.min(Math.max(retryDelayMs(response, attempt), 0), FETCH_MAX_DELAY_MS));
    }
  }
  assert.fail(`${SOURCE.url}: primary-source retrieval failed after ${attempts} attempts (${lastFailure})`);
}

export function verifyIdentity(xml) {
  const text = normalize(xmlToText(xml));
  assert.ok(xml.includes(`>${SOURCE.pmid}<`), `PMID ${SOURCE.pmid} missing from the retrieved article`);
  assert.ok(xml.toLowerCase().includes(SOURCE.doi.toLowerCase()), `DOI ${SOURCE.doi} missing`);
  assert.ok(xml.includes(SOURCE.pmcid.replace("PMC", "")), `${SOURCE.pmcid} missing`);
  assert.ok(text.includes(SOURCE.title), "article title does not match the SVIN IPSS guideline");
  return text;
}

export function verifyClaims(text) {
  for (const claim of CLAIMS) {
    assert.ok(text.includes(normalize(claim.text)), `source statement not found (${claim.id}): ${claim.text}`);
  }
}

// The calculator's boundaries, checked at the exact thresholds and just below them.
export async function loadCalculator() {
  const source = readFileSync(new URL("../src/components/calculators/IPSS.jsx", import.meta.url), "utf8");
  const { IPSS } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  return IPSS;
}

export function verifyCalculatorBoundaries(IPSS) {
  const basal = { basalLeftACTH: "20", basalRightACTH: "20", basalPeriphACTH: "20", basalLeftPRL: "30", basalRightPRL: "30", basalPeriphPRL: "10" };
  const run = (overrides = {}) => IPSS.compute({ ...basal, ...overrides });
  // Basal ACTH IPS:P ratio >= 2 (inclusive).
  assert.equal(run({ basalLeftACTH: "40" })["Criteria Met"], "Basal ratio ≥2", "basal ratio exactly 2.0 must meet the criterion");
  assert.match(run({ basalLeftACTH: "39.99" })["Localization Pattern"], /^No central ACTH gradient/, "basal ratio 1.9995 must not");
  // Stimulated peak ACTH IPS:P ratio >= 3 (inclusive).
  const row = { time: "3", leftACTH: "60", rightACTH: "20", periphACTH: "20" };
  assert.equal(run({ ipssRows: [row] })["Criteria Met"], "Peak post-CRH ratio ≥3", "peak ratio exactly 3.0 must meet the criterion");
  assert.match(run({ ipssRows: [{ ...row, leftACTH: "59.99" }] })["Localization Pattern"], /^No central ACTH gradient/, "peak ratio 2.9995 must not");
  // Basal PRL IPS:P ratio >= 1.8 supports adequate sampling; below 1.8 is a sampling caution.
  assert.match(run({ basalLeftPRL: "18", basalRightPRL: "18" })["Catheterization Note"], /support adequate/, "PRL ratio exactly 1.8 must support adequacy");
  assert.match(run({ basalLeftPRL: "17.99", basalRightPRL: "18" })["Catheterization Note"], /Sampling caution/, "PRL ratio 1.799 must flag caution");
}

export async function runAudit(options = {}) {
  const xml = await fetchSourceXml(options);
  const text = verifyIdentity(xml);
  verifyClaims(text);
  verifyCalculatorBoundaries(await loadCalculator());
  return { source: SOURCE, claims: CLAIMS.map((claim) => claim.id), characters: text.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runAudit();
  console.log(`IPSS primary-source audit PASS: ${result.source.pmcid} (${result.characters} chars); ${result.claims.join(", ")}`);
}
