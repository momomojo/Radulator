#!/usr/bin/env node
// Primary-source audit for the IPSS calculator's localization cutoffs.
//
// Source: Siddiq F et al. Consensus Guidelines on Inferior Petrosal Sinus Sampling: A Guideline From
// the Society of Vascular and Interventional Neurology Guidelines and Practice Standards Committee.
// Stroke: Vascular and Interventional Neurology 2026 (PMID 42088331, PMC13138407,
// DOI 10.1161/SVIN.125.002309). CC BY-NC-ND 4.0; no source bytes are committed.
//
// The DOI and the PMC HTML page sit behind browser challenges, so the audit retrieves the article
// as PMC XML through NCBI E-utilities. The response is treated as a deterministic artifact: its
// final URL host and path, media type, decoded byte length and SHA-256 must all equal the reviewed
// pins below before anything is parsed. The audit then checks the article identity, asserts each
// literal cutoff statement inside the section named by its <sec><title> path, and binds the
// statements to the calculator's exact boundary behaviour (inclusive >=2, >=3 and >=1.8).
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const SOURCE = Object.freeze({
  pmid: "42088331",
  pmcid: "PMC13138407",
  pmcidVersion: "PMC13138407.1",
  doi: "10.1161/SVIN.125.002309",
  title:
    "Consensus Guidelines on Inferior Petrosal Sinus Sampling: A Guideline From the Society of Vascular and Interventional Neurology Guidelines and Practice Standards Committee",
  license: "https://creativecommons.org/licenses/by-nc-nd/4.0/",
  url: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&retmode=xml&tool=radulator-ipss-source-audit&id=13138407",
});

// Reviewed identity of the response, pinned 2026-09-28 UTC. Six retrievals over nine minutes, from
// at least two NCBI backends (curl, and Node fetch with gzip), decoded to identical bytes. Only the
// gzip transfer encoding varied, so the pin covers the decoded entity body; the server sends no
// Content-Length. The raw bytes are pinned because nothing in them varies per request. A new PMC
// version or any reprocessing changes the digest, and the audit then fails until the source is
// re-reviewed and re-pinned.
export const PIN = Object.freeze({
  protocol: "https:",
  host: "eutils.ncbi.nlm.nih.gov",
  path: "/entrez/eutils/efetch.fcgi",
  query: Object.freeze({ db: "pmc", id: "13138407", retmode: "xml" }),
  mediaType: "text/xml",
  charset: "utf-8",
  bytes: 118457,
  sha256: "0b43fa8e60653614611f4d61a5302bcd05fe21b3adbef39566e055e7e9156c9b",
});

// Literal statements, after normalize(): each must appear exactly once in the own text of the one
// <body> section whose <sec><title> path equals section_path (nested child sections excluded).
const LAB_VALUES = Object.freeze(["Important Lab Values", "Supporting Literature Summary"]);
export const CLAIMS = Object.freeze([
  {
    id: "acth-basal-and-stimulated-cutoffs",
    text: "An ACTH IPS:P ratio >=2 prestimulation or a peak >=3 poststimulation (CRH or desmopressin) is considered diagnostic for CD.",
    locator: Object.freeze({ section_path: LAB_VALUES }),
  },
  {
    id: "prl-supports-adequate-sampling",
    text: "Prestimulation PRL IPS:P ratios >=1.8 support adequate catheterization",
    locator: Object.freeze({ section_path: LAB_VALUES }),
  },
  {
    id: "prl-below-1.8-flags-placement",
    text: "with a ratio <1.8 indicating improper placement",
    locator: Object.freeze({ section_path: LAB_VALUES }),
  },
].map((claim) => Object.freeze(claim)));

export const BOUNDARIES = Object.freeze(["2.0/1.9995", "3.0/2.9995", "1.8/1.799"]);

export const FETCH_ATTEMPTS = 5;
export const FETCH_MAX_DELAY_MS = 30_000;

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0", ge: "≥", le: "≤" };

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
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u00a0\u2000-\u200b\u202f\u205f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
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

// The final response URL (after any redirect) must be the pinned host and path, for the same record.
export function verifyFinalUrl(finalUrl, pin = PIN) {
  let url;
  try {
    url = new URL(finalUrl);
  } catch {
    assert.fail(`final response URL missing or invalid (${finalUrl || "<empty>"})`);
  }
  assert.equal(url.protocol, pin.protocol, `final response protocol ${url.protocol} is not ${pin.protocol}`);
  assert.equal(url.host, pin.host, `final response host ${url.host} is not ${pin.host}`);
  assert.equal(url.pathname, pin.path, `final response path ${url.pathname} is not ${pin.path}`);
  for (const [name, value] of Object.entries(pin.query)) {
    assert.equal(url.searchParams.get(name), value, `final response query ${name} is not ${value}`);
  }
  return url;
}

export function parseMediaType(header) {
  const [essence, ...parameters] = String(header ?? "").split(";");
  let charset = null;
  for (const parameter of parameters) {
    const separator = parameter.indexOf("=");
    if (separator < 0) continue;
    if (parameter.slice(0, separator).trim().toLowerCase() === "charset") {
      charset = parameter.slice(separator + 1).trim().replace(/^"(.*)"$/, "$1").toLowerCase();
    }
  }
  return { essence: essence.trim().toLowerCase(), charset };
}

export function verifyMediaType(header, pin = PIN) {
  const { essence, charset } = parseMediaType(header);
  assert.equal(essence, pin.mediaType, `media type ${header ?? "<missing>"} is not ${pin.mediaType}`);
  assert.equal(charset, pin.charset, `charset in ${header ?? "<missing>"} is not ${pin.charset}`);
  return `${essence}; charset=${charset}`;
}

export function verifyBytes(bytes, pin = PIN) {
  assert.equal(bytes.length, pin.bytes, `response is ${bytes.length} bytes, pinned ${pin.bytes}: the source changed; re-review before re-pinning`);
  const digest = sha256(bytes);
  assert.equal(digest, pin.sha256, `response SHA-256 ${digest} is not pinned ${pin.sha256}: the source changed; re-review before re-pinning`);
  return digest;
}

// Retries only transport failures (network errors, HTTP 429 and 5xx). A 200 response that misses a
// pin is a changed source, not a transient failure, so it fails at once.
export async function fetchSource({
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  attempts = FETCH_ATTEMPTS,
  pin = PIN,
} = {}) {
  let lastFailure = "unknown retrieval failure";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(SOURCE.url, {
        headers: { accept: "text/xml", "user-agent": "Radulator-IPSS-primary-source-audit/2" },
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    if (response?.ok) {
      const finalUrl = verifyFinalUrl(response.url, pin);
      const mediaType = verifyMediaType(response.headers.get("content-type"), pin);
      let bytes;
      try {
        bytes = Buffer.from(await response.arrayBuffer());
      } catch (error) {
        lastFailure = `body read failed (${error instanceof Error ? error.message : String(error)})`;
      }
      if (bytes) {
        const digest = verifyBytes(bytes, pin);
        return { bytes, finalUrl: `${finalUrl.origin}${finalUrl.pathname}`, mediaType, sha256: digest };
      }
    } else if (response) {
      lastFailure = `HTTP ${response.status}`;
      await response.body?.cancel?.();
      if (response.status !== 429 && response.status < 500) break;
    }
    if (attempt < attempts) {
      await sleep(Math.min(Math.max(retryDelayMs(response, attempt), 0), FETCH_MAX_DELAY_MS));
    }
  }
  assert.fail(`${SOURCE.url}: primary-source retrieval failed after ${attempts} attempts (${lastFailure})`);
}

export function decodeXml(bytes) {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export function verifyIdentity(xml) {
  const articleIds = (type) =>
    [...xml.matchAll(new RegExp(`<article-id pub-id-type="${type}">([^<]*)</article-id>`, "g"))].map((match) => match[1]);
  assert.deepEqual(articleIds("pmid"), [SOURCE.pmid], `PMID ${SOURCE.pmid} missing from the retrieved article`);
  assert.deepEqual(articleIds("pmcid"), [SOURCE.pmcid], `${SOURCE.pmcid} missing`);
  assert.deepEqual(articleIds("pmcid-ver"), [SOURCE.pmcidVersion], `article version ${SOURCE.pmcidVersion} missing`);
  assert.deepEqual(articleIds("doi").map((doi) => doi.toLowerCase()), [SOURCE.doi.toLowerCase()], `DOI ${SOURCE.doi} missing`);
  const titleGroup = xml.match(/<title-group>([\s\S]*?)<\/title-group>/)?.[1] ?? "";
  const title = titleGroup.match(/<article-title>([\s\S]*?)<\/article-title>/)?.[1] ?? "";
  assert.equal(normalize(xmlToText(title)), SOURCE.title, "article title does not match the SVIN IPSS guideline");
  assert.match(xml, new RegExp(`<ali:license_ref\\b[^>]*>${SOURCE.license.replaceAll(".", "\\.")}</ali:license_ref>`), "CC BY-NC-ND 4.0 license missing");
}

// Every <sec> in the article <body>: its <sec><title> path (outermost first) and its own text,
// that is, the section without its nested child sections.
export function bodySections(xml) {
  const open = [...xml.matchAll(/<body(?=[\s>])[^>]*>/g)];
  assert.equal(open.length, 1, "retrieved article must have exactly one <body>");
  const start = open[0].index + open[0][0].length;
  const end = xml.indexOf("</body>", start);
  assert.ok(end > start, "article <body> is unterminated");
  const body = xml.slice(start, end);
  const sections = [];
  const stack = [];
  // <sec> or <sec attrs>, never a sibling element such as <sec-meta>.
  for (const match of body.matchAll(/<sec(?=[\s>])[^>]*>|<\/sec>/g)) {
    if (match[0] === "</sec>") {
      const section = stack.pop();
      assert.ok(section, "unbalanced </sec> in article body");
      section.end = match.index + match[0].length;
      continue;
    }
    // JATS order: optional <sec-meta> and <label>, then the section <title>.
    const title = body
      .slice(match.index + match[0].length)
      .match(/^\s*(?:<sec-meta(?=[\s>])[\s\S]*?<\/sec-meta>\s*)?(?:<label(?=[\s>])[^>]*>[\s\S]*?<\/label>\s*)?<title(?=[\s>])[^>]*>([\s\S]*?)<\/title>/);
    const parent = stack.at(-1);
    const section = {
      path: [...(parent?.path ?? []), title ? normalize(xmlToText(title[1])) : ""],
      start: match.index,
      end: -1,
      children: [],
    };
    parent?.children.push(section);
    stack.push(section);
    sections.push(section);
  }
  assert.equal(stack.length, 0, "unbalanced <sec> in article body");
  return sections.map(({ path, start: from, end: to, children }) => {
    let own = "";
    let cursor = from;
    for (const child of children) {
      own += body.slice(cursor, child.start);
      cursor = child.end;
    }
    own += body.slice(cursor, to);
    return { path, text: normalize(xmlToText(own)) };
  });
}

export function verifyClaims(xml) {
  const sections = bodySections(xml);
  return CLAIMS.map((claim) => {
    const path = claim.locator.section_path;
    const where = path.join(" > ");
    const matches = sections.filter((section) => section.path.length === path.length && section.path.every((title, index) => title === path[index]));
    assert.notEqual(matches.length, 0, `section not found (${claim.id}): ${where}`);
    assert.equal(matches.length, 1, `section path is ambiguous (${claim.id}): ${where} occurs ${matches.length} times`);
    const occurrences = matches[0].text.split(normalize(claim.text)).length - 1;
    assert.equal(occurrences, 1, `source statement not found once in ${where} (${claim.id}): ${claim.text}`);
    return { id: claim.id, section_path: [...path] };
  });
}

// The calculator's boundaries, checked at the exact thresholds and just below them.
export async function loadCalculator() {
  const source = readFileSync(new URL("../src/components/calculators/IPSS.jsx", import.meta.url), "utf8");
  const { IPSS } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  return IPSS;
}

// Each boundary is checked on the left and on the right IPS, so neither side's comparison can drift.
export function verifyCalculatorBoundaries(IPSS) {
  const basal = { basalLeftACTH: "20", basalRightACTH: "20", basalPeriphACTH: "20", basalLeftPRL: "30", basalRightPRL: "30", basalPeriphPRL: "10" };
  const run = (overrides = {}) => IPSS.compute({ ...basal, ...overrides });
  for (const side of ["Left", "Right"]) {
    const ipsilateral = side.toLowerCase();
    // Basal ACTH IPS:P ratio >= 2 (inclusive).
    assert.equal(run({ [`basal${side}ACTH`]: "40" })["Criteria Met"], "Basal ratio ≥2", `${ipsilateral} basal ratio exactly 2.0 must meet the criterion`);
    assert.match(run({ [`basal${side}ACTH`]: "39.99" })["Localization Pattern"], /^No central ACTH gradient/, `${ipsilateral} basal ratio 1.9995 must not`);
    // Stimulated peak ACTH IPS:P ratio >= 3 (inclusive).
    const row = { time: "3", leftACTH: "20", rightACTH: "20", periphACTH: "20", [`${ipsilateral}ACTH`]: "60" };
    assert.equal(run({ ipssRows: [row] })["Criteria Met"], "Peak post-CRH ratio ≥3", `${ipsilateral} peak ratio exactly 3.0 must meet the criterion`);
    assert.match(run({ ipssRows: [{ ...row, [`${ipsilateral}ACTH`]: "59.99" }] })["Localization Pattern"], /^No central ACTH gradient/, `${ipsilateral} peak ratio 2.9995 must not`);
    // Basal PRL IPS:P ratio below 1.8 is a sampling caution.
    const low = run({ basalLeftPRL: "18", basalRightPRL: "18", [`basal${side}PRL`]: "17.99" });
    assert.match(low[`${side} IPS PRL Ratio`], /Sampling caution$/, `${ipsilateral} PRL ratio 1.799 must flag caution`);
    assert.match(low["Catheterization Note"], /^Sampling caution/, `${ipsilateral} PRL ratio 1.799 must flag caution`);
  }
  // Basal PRL IPS:P ratio >= 1.8 (inclusive) supports adequate sampling.
  const adequate = run({ basalLeftPRL: "18", basalRightPRL: "18" });
  for (const side of ["Left", "Right"]) {
    assert.match(adequate[`${side} IPS PRL Ratio`], /Supports adequate sampling$/, `${side.toLowerCase()} PRL ratio exactly 1.8 must support adequacy`);
  }
  assert.match(adequate["Catheterization Note"], /support adequate/, "PRL ratios exactly 1.8 must support adequacy");
  return BOUNDARIES;
}

export async function runAudit(options = {}) {
  const source = await fetchSource(options);
  const xml = decodeXml(source.bytes);
  verifyIdentity(xml);
  const claims = verifyClaims(xml);
  const boundaries = verifyCalculatorBoundaries(await loadCalculator());
  return {
    source: SOURCE,
    finalUrl: source.finalUrl,
    mediaType: source.mediaType,
    bytes: source.bytes.length,
    sha256: source.sha256,
    claims,
    boundaries,
  };
}

export function formatPass(result) {
  const bySection = new Map();
  for (const claim of result.claims) {
    const where = claim.section_path.join(" > ");
    bySection.set(where, [...(bySection.get(where) ?? []), claim.id]);
  }
  const located = [...bySection].map(([where, ids]) => `${ids.join(", ")} @ ${where}`).join("; ");
  return (
    `IPSS primary-source audit PASS: ${result.source.pmcidVersion} sha256=${result.sha256} ` +
    `(${result.bytes} bytes, ${result.mediaType}, ${result.finalUrl}); ${located}; ` +
    `calculator boundaries ${result.boundaries.join(", ")}`
  );
}

// Real paths on both sides: Node resolves symlinks in the module URL but not in argv[1].
function invokedDirectly() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  console.log(formatPass(await runAudit()));
}
