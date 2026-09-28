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
// Each record is retrieved as PubMed's plain-text abstract (efetch rettype=abstract, retmode=text) and
// verified as bytes before parsing: final URL, media type, exact byte length and SHA-256. The text form
// carries no DTD header or retrieval metadata, so it changes only when the record itself changes.
// Each statement is also pinned by the SHA-256 of the exact normalized span between two short markers.
// No source prose is committed.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const EFETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";

// One plain-text abstract per record, pinned by its exact bytes.
export const SOURCES = Object.freeze({
  28364010: Object.freeze({
    url: `${EFETCH}?db=pubmed&id=28364010&rettype=abstract&retmode=text&tool=radulator-nirads-audit`,
    doi: "10.3174/ajnr.A5157",
    year: "2017",
    bytes: 2945,
    sha256: "70d3751d0aeda10b23daa09c036a9f46b2191c030b0d45bdfab865a2aa83cb87",
  }),
  40754125: Object.freeze({
    url: `${EFETCH}?db=pubmed&id=40754125&rettype=abstract&retmode=text&tool=radulator-nirads-audit`,
    doi: "10.1016/j.jacr.2025.07.023",
    year: "2025",
    bytes: 3480,
    sha256: "f8c61b8642a29ca57ed3c0cf9d55dadd2d7caca10d909ac095496072d8728f30",
  }),
});
export const SOURCE_HOST = "eutils.ncbi.nlm.nih.gov";
export const SOURCE_PATH = "/entrez/eutils/efetch.fcgi";
export const SOURCE_MEDIA_TYPE = "text/plain";

// Each span runs from the first character of `from` through the last character of `to` (inclusive),
// inside the named abstract section ("" = the unlabelled abstract). Markers are at most six words;
// `from` must occur exactly once in that section.
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

export function normalize(value) {
  return String(value).normalize("NFKC").replace(/\s+/g, " ").trim();
}

// Exact bytes first: nothing is parsed from a response that is not the pinned artifact.
export function verifySourceBytes(pmid, bytes, source = SOURCES[pmid]) {
  assert.ok(source, `PMID ${pmid} is not a pinned source`);
  assert.ok(Buffer.isBuffer(bytes), `PMID ${pmid}: source bytes missing`);
  assert.equal(
    bytes.length,
    source.bytes,
    `PMID ${pmid}: source byte length drifted (${bytes.length}, pinned ${source.bytes}); re-review the record before re-pinning`,
  );
  const digest = sha256(bytes);
  assert.equal(
    digest,
    source.sha256,
    `PMID ${pmid}: source SHA-256 drifted (${digest}); re-review the record before re-pinning`,
  );
  return digest;
}

// PubMed plain-text abstract layout: blank-line separated blocks for the citation, title, authors,
// author information, abstract, copyright and identifiers.
export function parseRecordText(text) {
  const blocks = text.split(/\n[ \t]*\n/).map((block) => block.trim()).filter(Boolean);
  const citation = normalize(blocks[0] ?? "");
  const title = normalize(blocks[1] ?? "");
  const infoIndex = blocks.findIndex((block) => block.startsWith("Author information:"));
  assert.ok(infoIndex >= 2, "record lacks the author-information block");
  // PubMed inserts linked-record notices (comments, errata, updates) between the author block and the
  // abstract; the abstract is the first block after the author block that is not such a notice.
  const notice = /^(Comment (in|on)|Erratum (in|for)|Update (in|of)|Retraction (in|of)|Expression of concern (in|for)|Republished (in|from)|Conflict of interest|Copyright|©|DOI:|PMID:|PMCID:)/;
  const abstract = normalize(blocks.slice(infoIndex + 1).find((block) => !notice.test(block)) ?? "");
  return {
    citation,
    title,
    abstract,
    year: citation.match(/\. (\d{4}) [A-Z][a-z]{2}\b/)?.[1] ?? "",
    doi: text.match(/^DOI: (\S+)$/m)?.[1] ?? "",
    pmid: text.match(/^PMID: (\d+)/m)?.[1] ?? "",
  };
}

export function sectionText(record, section) {
  if (!section) {
    assert.ok(!/\b[A-Z][A-Z ]{3,}: /.test(record.abstract), `PMID ${record.pmid}: abstract is unexpectedly labelled`);
    return record.abstract;
  }
  const labels = [...record.abstract.matchAll(/(?:^|\s)([A-Z][A-Z ]{3,}): /g)];
  const hits = labels.filter((match) => match[1] === section);
  assert.equal(hits.length, 1, `PMID ${record.pmid}: abstract section "${section}" must occur exactly once`);
  const start = hits[0].index + hits[0][0].length;
  const next = labels.find((match) => match.index > hits[0].index);
  return record.abstract.slice(start, next ? next.index : undefined).trim();
}

export function extractSpan(text, from, to) {
  const start = text.indexOf(from);
  assert.ok(start >= 0, `start marker not found: ${from}`);
  assert.equal(text.lastIndexOf(from), start, `start marker is not unique: ${from}`);
  const end = text.indexOf(to, start + from.length);
  assert.ok(end >= 0, `end marker not found after start: ${to}`);
  return text.slice(start, end + to.length);
}

export function verifyRecord(pmid, record, source = SOURCES[pmid]) {
  assert.equal(record.pmid, pmid, `PMID ${pmid}: record identifier drifted`);
  assert.equal(record.doi, source.doi, `PMID ${pmid}: DOI drifted`);
  assert.equal(record.year, source.year, `PMID ${pmid}: publication year drifted`);
  assert.ok(record.abstract.length > 0, `PMID ${pmid}: abstract missing`);
  return record;
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

// Facts parsed from the pinned spans and records (numbers and dates only).
export function extractFacts(records, spans) {
  const targets = spans["krieger-targets"].match(/(\d+) targets \((\d+) primary targets and (\d+) nodal targets\)/);
  assert.ok(targets, "Krieger target counts not found in the pinned span");
  const [total, primary, nodal] = targets.slice(1).map(Number);
  assert.equal(primary + nodal, total, "Krieger primary and nodal targets must sum to the total");
  const rates = spans["krieger-positive-disease-rates"].match(/([\d.]+)%, ([\d.]+)%, and ([\d.]+)%/);
  assert.ok(rates, "Krieger positive-disease rates not found in the pinned span");
  assert.ok(/\b2018\b/.test(spans["bunch-2018-paradigm-ct-pet"]), "Bunch 2025: 2018 release year missing");
  assert.ok(/PET\/CT/.test(spans["bunch-2018-paradigm-ct-pet"]), "Bunch 2025: PET/CT scope missing");
  assert.ok(/\bMRI\b/.test(spans["bunch-mri-descriptors-later"]), "Bunch 2025: MRI descriptors missing");
  const kriegerYear = Number(records["28364010"].year);
  const mriYear = Number(records["40754125"].year);
  assert.ok(kriegerYear < mriYear, "the rate study must predate the MRI v2025 publication");
  assert.match(records["40754125"].title, /Version 2025/, "Bunch 2025 title must name MRI Version 2025");
  return { total, primary, nodal, rates: rates.slice(1).map(Number), kriegerYear, mriYear };
}

export const LEGACY_VECTORS = Object.freeze([
  ["1", { modality: "cect", prior_available: "yes", primary_ct_finding: "expected", neck_ct_finding: "no_abnormal" }],
  ["2", { modality: "cect", prior_available: "yes", primary_ct_finding: "deep_soft_tissue", neck_ct_finding: "residual_new_enlarging" }],
  ["3", { modality: "cect", prior_available: "yes", primary_ct_finding: "discrete_mass", primary_bone: "yes", neck_ct_finding: "new_necrosis" }],
]);

export const LEGACY_MRI_VECTORS = Object.freeze([
  { modality: "mri", prior_available: "yes", primary_ct_finding: "discrete_mass", primary_bone: "yes", neck_ct_finding: "new_necrosis" },
  { nirads_version: "ct_pet_2018", modality: "mri", prior_available: "yes", primary_ct_finding: "expected", neck_ct_finding: "no_abnormal" },
]);

export const LEGACY_NO_MODALITY_VECTORS = Object.freeze([
  { prior_available: "yes", primary_ct_finding: "discrete_mass", primary_bone: "yes", neck_ct_finding: "new_necrosis" },
  { nirads_version: "ct_pet_2018", modality: "", prior_available: "yes", primary_ct_finding: "expected", neck_ct_finding: "no_abnormal" },
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
  for (const pmid of Object.keys(SOURCES)) {
    assert.ok(refs.includes(`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`), `references must link PMID ${pmid}`);
  }

  // Bunch 2025 (pinned statement bunch-2018-paradigm-ct-pet): the 2018 paradigm covers CT and FDG PET/CT only,
  // so the legacy path must not offer MRI and must never return 2018 categories or rates for MRI input.
  const legacyModality = (nirads.fields ?? []).find((field) => field.id === "modality");
  assert.deepEqual(
    (legacyModality?.opts ?? []).map((option) => option.value).sort(),
    ["cect", "pet_ct"],
    "the 2018 CT/PET-CT modality options must be CT and PET/CT only",
  );
  for (const inputs of LEGACY_MRI_VECTORS) {
    const result = nirads.compute(inputs);
    assert.ok(result && typeof result.Error === "string", "MRI input on the 2018 path must fail closed with an error");
    assert.equal(result["Estimated Recurrence Risk"], undefined, "MRI input must never receive a 2018 recurrence rate");
    assert.equal(result["Overall Assessment"], undefined, "MRI input must never receive a 2018 category");
  }
  // Without a selected modality nothing shows the study was CT or PET/CT, so the same boundary applies.
  for (const inputs of LEGACY_NO_MODALITY_VECTORS) {
    const result = nirads.compute(inputs);
    assert.ok(result && typeof result.Error === "string", "input without a modality on the 2018 path must fail closed with an error");
    assert.equal(result["Estimated Recurrence Risk"], undefined, "input without a modality must never receive a 2018 recurrence rate");
    assert.equal(result["Overall Assessment"], undefined, "input without a modality must never receive a 2018 category");
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
  return {
    heading,
    lines: expected,
    legacyVectors: LEGACY_VECTORS.length,
    mriVectors: MRI_VECTORS.length,
    legacyMriRejected: LEGACY_MRI_VECTORS.length,
    legacyNoModalityRejected: LEGACY_NO_MODALITY_VECTORS.length,
  };
}

export function verifyResponse(pmid, { finalUrl, contentType }) {
  const expected = new URL(SOURCES[pmid].url);
  const url = new URL(finalUrl);
  assert.equal(url.protocol, "https:", `PMID ${pmid}: final URL protocol ${url.protocol}`);
  assert.equal(url.host, SOURCE_HOST, `PMID ${pmid}: final URL host ${url.host}`);
  assert.equal(url.pathname, SOURCE_PATH, `PMID ${pmid}: final URL path ${url.pathname}`);
  for (const name of ["db", "id", "rettype", "retmode"]) {
    assert.equal(url.searchParams.get(name), expected.searchParams.get(name), `PMID ${pmid}: final URL query ${name}`);
  }
  const mediaType = String(contentType ?? "").split(";")[0].trim().toLowerCase();
  assert.equal(mediaType, SOURCE_MEDIA_TYPE, `PMID ${pmid}: media type ${contentType ?? "<missing>"}`);
}

// Retry-After (seconds) is honoured only when the header is present; the caller caps every wait at
// FETCH_MAX_DELAY_MS. Without it the exponential backoff applies: Number(null) is 0, so an absent header
// must not be parsed as an immediate retry.
function retryDelayMs(response, attempt) {
  const header = response?.headers?.get?.("retry-after");
  const retryAfter = header == null || String(header).trim() === "" ? Number.NaN : Number(header);
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return retryAfter * 1_000;
  return 1_500 * 2 ** (attempt - 1);
}

// Retries transport failures only: network errors, HTTP 400 (NCBI returns it transiently for valid
// requests), 429 and 5xx. A 200 response that misses its URL, media-type, length or digest pin is a
// changed source and fails at once.
export async function fetchSource(pmid, { fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const source = SOURCES[pmid];
  let lastFailure = "unknown retrieval failure";
  let made = 0;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    made = attempt;
    let response;
    try {
      response = await fetchImpl(source.url, {
        headers: { accept: "text/plain", "user-agent": "Radulator-NIRADS-legacy-rates-audit/2" },
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    if (response?.ok) {
      verifyResponse(pmid, { finalUrl: response.url, contentType: response.headers.get("content-type") });
      const bytes = Buffer.from(await response.arrayBuffer());
      verifySourceBytes(pmid, bytes, source);
      return bytes;
    }
    if (response) {
      lastFailure = `HTTP ${response.status}`;
      await response.body?.cancel?.();
      if (response.status !== 400 && response.status !== 429 && response.status < 500) break;
    }
    if (attempt < FETCH_ATTEMPTS) await sleep(Math.min(retryDelayMs(response, attempt), FETCH_MAX_DELAY_MS));
  }
  assert.fail(`PMID ${pmid}: PubMed retrieval failed after ${made} of ${FETCH_ATTEMPTS} attempts (${lastFailure})`);
}

export async function fetchSources(options) {
  const sources = {};
  for (const pmid of Object.keys(SOURCES)) sources[pmid] = await fetchSource(pmid, options);
  return sources;
}

// `sources` maps each PMID to the exact response bytes. Bytes are verified before anything is parsed.
export function runAudit({ sources, nirads }) {
  const records = {};
  for (const pmid of Object.keys(SOURCES)) {
    verifySourceBytes(pmid, sources[pmid]);
    records[pmid] = verifyRecord(pmid, parseRecordText(sources[pmid].toString("utf8")));
  }
  const spans = verifyStatements(records);
  const facts = extractFacts(records, spans);
  const binding = bindRuntime(nirads, facts);
  return { records, facts, binding };
}

export async function loadRuntime(root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")) {
  const module = await import(pathToFileURL(path.join(root, "src/components/calculators/NIRADS.jsx")).href);
  return module.NIRADS;
}

export function passLine({ facts, binding }) {
  const pins = Object.entries(SOURCES)
    .map(([pmid, source]) => `PMID ${pmid} ${source.bytes} bytes sha256=${source.sha256.slice(0, 12)}`)
    .join(", ");
  return (
    `NI-RADS legacy-rate source audit PASS: ${pins} (text/plain, raw bytes); ${STATEMENTS.length} digest-pinned statements; ` +
    `Krieger ${facts.kriegerYear} rates ${facts.rates.join("/")}% over ${facts.total} targets ` +
    `-> info ${binding.lines.map((line) => line.split(": ")[1]).join("/")} and 2018 risk output ` +
    `(${binding.legacyVectors} vectors); MRI v2025 (${facts.mriYear}) output carries no risk (${binding.mriVectors} vectors); ` +
    `2018 path offers CT/PET-CT only and rejects MRI (${binding.legacyMriRejected} vectors) ` +
    `and a missing modality (${binding.legacyNoModalityRejected} vectors)`
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = runAudit({ sources: await fetchSources(), nirads: await loadRuntime() });
  console.log(passLine(result));
}
