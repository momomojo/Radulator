#!/usr/bin/env node
// NI-RADS legacy recurrence rates: exact-head primary-source audit.
//
// The NI-RADS information text shows legacy recurrence rates by category and scopes them away from
// MRI v2025. This audit binds that text, and the 2018 CT/PET-CT "Estimated Recurrence Risk" output, to
// two PubMed records:
//   - Krieger DA et al., AJNR Am J Neuroradiol 2017;38(6):1193-1199 (PMID 28364010,
//     DOI 10.3174/ajnr.A5157): abstract RESULTS give the target counts and the positive-disease rate
//     for NI-RADS 1, 2 and 3;
//   - Bunch PM et al., J Am Coll Radiol 2025;22(11):1325-1336 (PMID 40754125,
//     DOI 10.1016/j.jacr.2025.07.023): the abstract says the 2018 ACR NI-RADS paradigm was specific to
//     CT and FDG PET/CT and that the MRI-specific descriptors were developed later.
//
// PubMed's raw XML changes whenever NLM maintains a record (DTD header, revision dates, links), so each
// record is pinned by the SHA-256 of its normalized cited fields. Each statement is pinned by the SHA-256
// of the exact normalized span between two short markers. No source prose is committed.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SOURCE = Object.freeze({
  url: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=28364010,40754125&retmode=xml&tool=radulator-nirads-audit",
  protocol: "https:",
  host: "eutils.ncbi.nlm.nih.gov",
  path: "/entrez/eutils/efetch.fcgi",
  query: Object.freeze({ db: "pubmed", id: "28364010,40754125", retmode: "xml" }),
  mediaType: "text/xml",
});

// SHA-256 of JSON.stringify({ pmid, doi, year, title, abstract: [[label, text], ...] }) after normalize().
export const RECORD_PINS = Object.freeze({
  28364010: Object.freeze({
    doi: "10.3174/ajnr.A5157",
    year: "2017",
    sha256: "cea9541ec9741e4e9696986d6468f5d9a1f492728941ee04dc0145ab3e6ab090",
  }),
  40754125: Object.freeze({
    doi: "10.1016/j.jacr.2025.07.023",
    year: "2025",
    sha256: "5dca590cfde57557a915fdb3716294dfd677f30279762ed1ff798d2400d886d3",
  }),
});

// Each span runs from the first character of `from` through the last character of `to` (inclusive),
// inside the named abstract section. Markers are at most six words; `from` must occur exactly once.
export const STATEMENTS = Object.freeze([
  Object.freeze({
    id: "krieger-targets",
    pmid: "28364010",
    section: "RESULTS",
    from: "A total of 318 scans",
    to: "met the inclusion criteria.",
    length: 108,
    sha256: "4f37eb9fb8e9a1e0e9df697b7731fc1f1a0ef812f4a07065d84b84be3e6aec1c",
    paraphrase: "318 scans with 618 targets (314 primary-site, 304 nodal) were analyzed.",
  }),
  Object.freeze({
    id: "krieger-positive-disease-rates",
    pmid: "28364010",
    section: "RESULTS",
    from: "The rates of positive disease",
    to: "for each NI-RADS category, respectively.",
    length: 99,
    sha256: "8b3ca7806971ff1373504e80d911c408f1def3758cd6acfea4c3d1565bd0ff33",
    paraphrase: "Positive disease was found in 3.79%, 17.2% and 59.4% of NI-RADS 1, 2 and 3 targets.",
  }),
  Object.freeze({
    id: "bunch-2018-paradigm-ct-pet",
    pmid: "40754125",
    section: "",
    from: "an ACR-endorsed NI-RADS reporting paradigm",
    to: "PET/CT.",
    length: 113,
    sha256: "6787c5b0acb7734876cd62d3f5ac2018ab46ce1abea31f70afe810cdd07ad45e",
    paraphrase: "The ACR-endorsed NI-RADS released in 2018 was specific to CT and FDG PET/CT.",
  }),
  Object.freeze({
    id: "bunch-mri-descriptors-later",
    pmid: "40754125",
    section: "",
    from: "More recently, the ACR NI-RADS Committee",
    to: "best served by this imaging modality.",
    length: 245,
    sha256: "4ab7976969feb8baa22370ef2f14d7082467a8f8d3139810e55ce9cb087cdace",
    paraphrase: "The committee later developed MRI-specific category descriptors and management guidance.",
  }),
]);

export const INFO_HEADING_PREFIX = "Legacy NI-RADS recurrence rates by category (Krieger et al., AJNR 2017; ";
export const INFO_SCOPE =
  "These rates come from a 2017 study that predates MRI v2025, so they are not MRI v2025 estimates.";
export const INFO_MRI_OUTPUT = "MRI v2025 results in this calculator show no estimated recurrence risk.";

const FETCH_ATTEMPTS = 5;
const FETCH_MAX_DELAY_MS = 20_000;

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function decodeEntities(value) {
  const named = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"' };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&(amp|apos|gt|lt|nbsp|quot);/g, (_, name) => named[name]);
}

export function normalize(value) {
  return decodeEntities(String(value).replace(/<[^>]+>/g, ""))
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseRecords(xml) {
  const records = {};
  for (const [, article] of xml.matchAll(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g)) {
    const pmid = article.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1];
    assert.ok(pmid, "PubMed record without a PMID");
    const title = normalize(article.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)?.[1] ?? "");
    const doi = normalize(article.match(/<ArticleId IdType="doi">([\s\S]*?)<\/ArticleId>/)?.[1] ?? "");
    const year = article.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/)?.[1] ?? "";
    const abstract = [...article.matchAll(/<AbstractText([^>]*)>([\s\S]*?)<\/AbstractText>/g)].map(
      ([, attributes, text]) => [attributes.match(/Label="([^"]*)"/)?.[1] ?? "", normalize(text)],
    );
    records[pmid] = { pmid, doi, year, title, abstract };
  }
  return records;
}

export function recordDigest(record) {
  const { pmid, doi, year, title, abstract } = record;
  return sha256(JSON.stringify({ pmid, doi, year, title, abstract }));
}

export function verifyRecords(records, pins = RECORD_PINS) {
  for (const [pmid, pin] of Object.entries(pins)) {
    const record = records[pmid];
    assert.ok(record, `PMID ${pmid} missing from the PubMed response`);
    assert.equal(record.doi, pin.doi, `PMID ${pmid} DOI drifted`);
    assert.equal(record.year, pin.year, `PMID ${pmid} publication year drifted`);
    const digest = recordDigest(record);
    assert.equal(
      digest,
      pin.sha256,
      `PMID ${pmid} normalized record drifted (sha256 ${digest}); re-review the source before re-pinning`,
    );
  }
  return records;
}

export function sectionText(record, section) {
  const parts = record.abstract.filter(([label]) => label === section);
  assert.equal(parts.length, 1, `PMID ${record.pmid}: abstract section "${section}" must occur exactly once`);
  return parts[0][1];
}

export function extractSpan(text, from, to) {
  const start = text.indexOf(from);
  assert.ok(start >= 0, `start marker not found: ${from}`);
  assert.equal(text.lastIndexOf(from), start, `start marker is not unique: ${from}`);
  const end = text.indexOf(to, start + from.length);
  assert.ok(end >= 0, `end marker not found after start: ${to}`);
  return text.slice(start, end + to.length);
}

export function verifyStatements(records, statements = STATEMENTS) {
  const spans = {};
  for (const statement of statements) {
    for (const marker of [statement.from, statement.to]) {
      assert.ok(marker.split(/\s+/).length <= 6, `${statement.id}: marker longer than six words`);
    }
    const text = sectionText(records[statement.pmid], statement.section);
    const span = extractSpan(text, statement.from, statement.to);
    assert.equal(span.length, statement.length, `${statement.id}: pinned statement length drifted`);
    assert.equal(sha256(span), statement.sha256, `${statement.id}: pinned statement drifted`);
    spans[statement.id] = span;
  }
  return spans;
}

// Facts parsed from the pinned spans (numbers and dates only).
export function extractFacts(records, spans) {
  const targets = spans["krieger-targets"].match(/(\d+) targets \((\d+) primary targets and (\d+) nodal targets\)/);
  assert.ok(targets, "Krieger target counts not found in the pinned span");
  const [total, primary, nodal] = targets.slice(1).map(Number);
  assert.equal(primary + nodal, total, "Krieger primary and nodal targets must sum to the total");
  const rates = spans["krieger-positive-disease-rates"].match(/([\d.]+)%, ([\d.]+)%, and ([\d.]+)%/);
  assert.ok(rates, "Krieger positive-disease rates not found in the pinned span");
  const [rate1, rate2, rate3] = rates.slice(1).map(Number);
  assert.ok(/\b2018\b/.test(spans["bunch-2018-paradigm-ct-pet"]), "Bunch 2025: 2018 release year missing");
  assert.ok(/PET\/CT/.test(spans["bunch-2018-paradigm-ct-pet"]), "Bunch 2025: PET/CT scope missing");
  assert.ok(/\bMRI\b/.test(spans["bunch-mri-descriptors-later"]), "Bunch 2025: MRI descriptors missing");
  const kriegerYear = Number(records["28364010"].year);
  const mriYear = Number(records["40754125"].year);
  assert.ok(kriegerYear < mriYear, "the rate study must predate the MRI v2025 publication");
  assert.match(records["40754125"].title, /Version 2025/, "Bunch 2025 title must name MRI Version 2025");
  return { total, primary, nodal, rates: [rate1, rate2, rate3], kriegerYear, mriYear };
}

export const LEGACY_VECTORS = Object.freeze([
  ["1", { modality: "cect", prior_available: "yes", primary_ct_finding: "expected", neck_ct_finding: "no_abnormal" }],
  ["2", { modality: "cect", prior_available: "yes", primary_ct_finding: "deep_soft_tissue", neck_ct_finding: "residual_new_enlarging" }],
  ["3", { modality: "cect", prior_available: "yes", primary_ct_finding: "discrete_mass", primary_bone: "yes", neck_ct_finding: "new_necrosis" }],
]);

export const MRI_VECTORS = Object.freeze([
  { nirads_version: "mri_2025", during_treatment: "no", assessment_site: "primary", primary_tumor_status: "known", assessable: "yes", prior_status: "available", primary_pattern_id: "p1_expected_changes" },
  { nirads_version: "mri_2025", during_treatment: "no", assessment_site: "neck", assessable: "yes", prior_status: "available", neck_pattern_id: "n1_no_abnormal_nodes", node_temporal_status: "not_applicable" },
]);

export function bindRuntime(nirads, facts) {
  const info = String(nirads?.info?.text ?? "");
  const heading = `${INFO_HEADING_PREFIX}positive disease across ${facts.total} primary-site and neck targets):`;
  const at = info.indexOf(heading);
  assert.ok(at >= 0, "info text must carry the sourced legacy-rate heading with the Krieger target count");
  const expected = facts.rates.map((rate, index) => `• NI-RADS ${index + 1}: ~${Math.round(rate)}%`);
  const lines = info.slice(at + heading.length).trimStart().split("\n").slice(0, 3);
  assert.deepEqual(lines, expected, "info text rates must be the rounded Krieger rates, directly under the heading");
  assert.equal(
    info.search(/~\d+%/),
    info.indexOf(expected[0]) + expected[0].indexOf("~"),
    "no percentage may appear before the sourced heading",
  );
  assert.ok(info.includes(INFO_SCOPE), "info text must say the rates predate MRI v2025 and are not MRI v2025 estimates");
  assert.ok(info.includes(INFO_MRI_OUTPUT), "info text must say MRI v2025 results show no estimated recurrence risk");
  assert.ok(INFO_SCOPE.includes(String(facts.kriegerYear)), "scope sentence must name the study year");

  const refs = (nirads.refs ?? []).map((ref) => ref.u);
  for (const pmid of Object.keys(RECORD_PINS)) {
    assert.ok(refs.includes(`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`), `references must link PMID ${pmid}`);
  }

  LEGACY_VECTORS.forEach(([category, inputs], index) => {
    const result = nirads.compute(inputs);
    assert.match(result["Overall Assessment"] ?? "", new RegExp(`^NI-RADS ${category} `), `2018 vector ${category} category`);
    assert.equal(
      result["Estimated Recurrence Risk"],
      `~${Math.round(facts.rates[index])}%`,
      `2018 CT/PET-CT risk output for NI-RADS ${category} must equal the rounded Krieger rate`,
    );
  });
  MRI_VECTORS.forEach((inputs, index) => {
    const result = nirads.compute(inputs);
    assert.ok(result["Primary Site NI-RADS"] || result["Neck NI-RADS"], `MRI vector ${index + 1} must classify`);
    assert.equal(result["Estimated Recurrence Risk"], undefined, `MRI vector ${index + 1} must carry no risk estimate`);
    assert.ok(
      !Object.values(result).some((value) => typeof value === "string" && /~\d+%/.test(value)),
      `MRI vector ${index + 1} must show no legacy percentage`,
    );
  });
  return { heading, lines: expected, legacyVectors: LEGACY_VECTORS.length, mriVectors: MRI_VECTORS.length };
}

export function verifyResponse({ finalUrl, contentType }) {
  const url = new URL(finalUrl);
  assert.equal(url.protocol, SOURCE.protocol, `final URL protocol ${url.protocol}`);
  assert.equal(url.host, SOURCE.host, `final URL host ${url.host}`);
  assert.equal(url.pathname, SOURCE.path, `final URL path ${url.pathname}`);
  for (const [name, value] of Object.entries(SOURCE.query)) {
    assert.equal(url.searchParams.get(name), value, `final URL query ${name}`);
  }
  const mediaType = String(contentType ?? "").split(";")[0].trim().toLowerCase();
  assert.equal(mediaType, SOURCE.mediaType, `media type ${contentType ?? "<missing>"}`);
}

function retryDelayMs(response, attempt) {
  const retryAfter = Number(response?.headers?.get?.("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return retryAfter * 1_000;
  return 1_500 * 2 ** (attempt - 1);
}

// Retries transport failures only: network errors, HTTP 400 (NCBI returns it transiently for valid
// requests), 429 and 5xx. A 200 response that misses a pin is a changed source and fails at once.
export async function fetchSource({ fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let lastFailure = "unknown retrieval failure";
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(SOURCE.url, {
        headers: { accept: "text/xml", "user-agent": "Radulator-NIRADS-legacy-rates-audit/1" },
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    if (response?.ok) {
      verifyResponse({ finalUrl: response.url, contentType: response.headers.get("content-type") });
      return { xml: await response.text(), finalUrl: response.url, contentType: response.headers.get("content-type") };
    }
    if (response) {
      lastFailure = `HTTP ${response.status}`;
      await response.body?.cancel?.();
      if (response.status !== 400 && response.status !== 429 && response.status < 500) break;
    }
    if (attempt < FETCH_ATTEMPTS) await sleep(Math.min(retryDelayMs(response, attempt), FETCH_MAX_DELAY_MS));
  }
  assert.fail(`PubMed retrieval failed after ${FETCH_ATTEMPTS} attempts (${lastFailure})`);
}

export function runAudit({ xml, nirads }) {
  const records = verifyRecords(parseRecords(xml));
  const spans = verifyStatements(records);
  const facts = extractFacts(records, spans);
  const binding = bindRuntime(nirads, facts);
  return { records, facts, binding };
}

export async function loadRuntime(root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")) {
  const module = await import(pathToFileURL(path.join(root, "src/components/calculators/NIRADS.jsx")).href);
  return module.NIRADS;
}

export function passLine({ records, facts, binding }) {
  const pins = Object.keys(RECORD_PINS)
    .map((pmid) => `PMID ${pmid} sha256=${recordDigest(records[pmid]).slice(0, 12)}`)
    .join(", ");
  return (
    `NI-RADS legacy-rate source audit PASS: ${pins}; ${STATEMENTS.length} digest-pinned statements; ` +
    `Krieger ${facts.kriegerYear} rates ${facts.rates.join("/")}% over ${facts.total} targets ` +
    `-> info ${binding.lines.map((line) => line.split(": ")[1]).join("/")} and 2018 risk output ` +
    `(${binding.legacyVectors} vectors); MRI v2025 (${facts.mriYear}) output carries no risk (${binding.mriVectors} vectors)`
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const fetched = await fetchSource();
  const result = runAudit({ xml: fetched.xml, nirads: await loadRuntime() });
  console.log(passLine(result));
}
