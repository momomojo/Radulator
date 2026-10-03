#!/usr/bin/env node

// Exact-head primary-source audit for the ASPECTS region texts and region grouping.
//
// Automated sources. Smoke runs this audit on every PR in a serialized merge queue, so it
// fetches only byte-stable NCBI E-utilities records, two requests per run:
// - Barber et al., Lancet 2000, the original ASPECTS paper (PMID 10905241), as the PubMed
//   plain-text abstract (efetch rettype=abstract, retmode=text).
// - Dubey et al., Stroke Res Treat 2013 (PMC3732599, CC BY 3.0), as PMC XML. Its Figure 1
//   reprints the ASPECTS developers' scoring template from aspectsinstroke.com with the
//   Calgary group's permission; the caption carries the template's region key and its split
//   of 3 subcortical and 7 cortical points.
// Both were byte-identical across fetches more than a minute apart.
//
// Documented, not fetched. Some runtime texts rest on sources that have no byte-stable copy:
// Pexman et al., AJNR 2001 (PMC7974585: PMC XML is front matter only, the article page changes
// on every request and the PMC PDF sits behind a browser challenge) and the developers' own
// site (the live site fails TLS; its pages survive only as Internet Archive captures, and the
// archive rate-limits). Those claims are listed in DOCUMENTED_ONLY and read by the judges in
// docs/evidence/aspects-regions.md, with URLs and capture times. The audit still pins their
// exact runtime wording, so a silent change to that text fails here too.
//
// Pins. Every fetched artifact is pinned by the exact byte length and SHA-256 of the raw
// response body. retrieve() checks the pins, the final URL (protocol, host, path, query) and
// the media type before it returns, so nothing is parsed until every pin holds. A 200 response
// that misses any pin fails at once and is never retried. Requests go one at a time through the
// shared NCBI helper (scripts/lib/ncbi-fetch.mjs): it spaces them across every audit in the run,
// writes each one to the runner's fetch log, and retries only transport failures (network
// errors, timeouts, HTTP 408, 425, 429 and 5xx), up to five attempts 1, 2, 4 and 8 s apart, or
// longer when Retry-After asks, never over 30 s. Redirects are refused, so the audit never
// contacts another host. After the pins hold, each artifact's identity (PMID, PMCID, DOI, title,
// licence) is checked.
//
// Statements. Each source statement is pinned by the length and SHA-256 of the exact
// normalized span that runs from a short `from` marker to the next `to` marker inside its
// locator. Markers are at most six words, and each statement carries Radulator's own
// paraphrase, so the repository holds no copied source passages; open the URL at the locator
// to read a statement. The audit then binds the statements to the calculator runtime: the
// region grouping in "Regional Breakdown" over all 1024 region combinations, the notes that
// depend on that grouping, the unchanged 10-minus-regions arithmetic, and the region labels,
// subLabels and info text. Any drift exits non-zero.
//
// NCBI requests identify the tool (tool=radulator-aspects-audit) and send no e-mail address. With
// NCBI_API_KEY set, the helper sends the key to E-utilities and redacts it everywhere; the final
// URL is compared with the key removed.

import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { ASPECTSScore } from "../src/components/calculators/ASPECTSScore.jsx";
import { MAX_ATTEMPTS, fetchPinned } from "./lib/ncbi-fetch.mjs";

export const CALCULATOR_PATH = "src/components/calculators/ASPECTSScore.jsx";
const USER_AGENT = "Radulator-ASPECTS-region-source-audit/2";
const NCBI_TOOL = "radulator-aspects-audit";
// The only host this audit may contact.
export const ALLOWED_HOSTS = Object.freeze(["eutils.ncbi.nlm.nih.gov"]);
export const FETCH_ATTEMPTS = MAX_ATTEMPTS;

export const SOURCES = Object.freeze({
  barber2000: Object.freeze({
    key: "barber2000",
    role: "original ASPECTS publication (PubMed plain-text abstract; full text is paywalled)",
    document:
      "Barber PA, Demchuk AM, Zhang J, Buchan AM. Validity and reliability of a quantitative computed tomography score in predicting outcome of hyperacute stroke before thrombolytic therapy. Lancet. 2000;355(9216):1670-1674",
    pmid: "10905241",
    doi: "10.1016/S0140-6736(00)02237-6",
    url: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=10905241&rettype=abstract&retmode=text&tool=${NCBI_TOOL}`,
    media_type: "text/plain",
    pin: "raw-bytes",
    bytes: 2_463,
    sha256: "fee68808adc8d45b02413464c7dc282361e72458bb2a9d340a69becad7a3960d",
  }),
  dubey2013: Object.freeze({
    key: "dubey2013",
    role: "ASPECTS developers' template reprinted with permission (Figure 1)",
    document: "Dubey P, et al. Acute stroke imaging: recent updates. Stroke Res Treat. 2013;2013:767212",
    pmid: "23970999",
    pmcid: "PMC3732599",
    doi: "10.1155/2013/767212",
    license: "https://creativecommons.org/licenses/by/3.0/",
    url: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&retmode=xml&tool=${NCBI_TOOL}&id=3732599`,
    media_type: "text/xml",
    pin: "raw-bytes",
    bytes: 65_170,
    sha256: "7a0479726ba0956a36ce9e63050bf0e052fe69ac292428a67a9254b26d54a2ba",
  }),
});

// Sources the judges read by hand; the audit never fetches them.
export const DOCUMENTED_SOURCES = Object.freeze({
  pexman2001: Object.freeze({
    document:
      "Pexman JHW, Barber PA, Hill MD, et al. Use of the Alberta Stroke Program Early CT Score (ASPECTS) for assessing CT scans in patients with acute stroke. AJNR Am J Neuroradiol. 2001;22(8):1534-1542 (PMID 11559501, PMC7974585)",
    read_at: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7974585/ (and a fixed Internet Archive capture of 2025-02-02 05:57:43 GMT)",
    not_fetched_because:
      "PMC XML is front matter only (the publisher bars full-text XML); the article page is not byte-stable (per-request id and CSRF token); the PMC PDF sits behind a browser challenge",
  }),
  developers_site: Object.freeze({
    document:
      "aspectsinstroke.com (Foothills Medical Centre, University of Calgary): 'What is ASPECTS', Training 'Insula and basal ganglia', Training 'M1-M6 regions'",
    read_at:
      "Internet Archive captures of 2016-12-06 11:53:58, 2016-12-29 22:22:03 and 2016-12-30 02:52:53 GMT (URLs in docs/evidence/aspects-regions.md)",
    not_fetched_because:
      "the live site fails TLS (expired certificate); the pages survive only as Internet Archive captures, and the archive rate-limits, so they cannot be a Smoke dependency",
  }),
});

// Source statements. `block` names the located block (see locateBlocks); each span runs from
// its `from` marker to the next `to` marker in that block after foldText normalization. The
// paraphrase is Radulator's own wording.
export const STATEMENTS = Object.freeze(
  [
    {
      id: "barber2000-abstract-ten-regions",
      source: "barber2000",
      block: "abstract:METHODS",
      locator: "Abstract, Methods",
      paraphrase: "ASPECTS partitions the MCA territory into 10 scoring regions.",
      spans: [
        {
          from: "The score divides the",
          to: "ten regions of interest.",
          length: 84,
          sha256: "b0108d25834178967bc1c3e82c1ec497ce6163ce41198d188bc142245d7905c1",
        },
      ],
    },
    {
      id: "dubey2013-fig1-provenance",
      source: "dubey2013",
      block: "fig1",
      locator: "Figure 1 caption",
      paraphrase:
        "Figure 1 is the ASPECTS scoring template from the developers' site aspectsinstroke.com, reprinted with permission from the Calgary group (Foothills Medical Centre, University of Calgary).",
      spans: [
        {
          from: "Obtained from",
          to: "the ASPECTS scoring methodology,",
          length: 94,
          sha256: "655e31450499f5368e14932b101ad828556e8e32cb4ae7ae435f1393419d6e5b",
        },
        {
          from: "(Reprint permission obtained from Dr.",
          to: "University of Calgary).",
          length: 152,
          sha256: "d65b587338b7d73a2d0ec3853e19fe48c67b37dc9eda15464201c80d86f3f35c",
        },
      ],
    },
    {
      id: "dubey2013-fig1-region-definitions",
      source: "dubey2013",
      block: "fig1",
      locator: "Figure 1 caption",
      paraphrase:
        "The template key names ten regions: caudate, insular ribbon, internal capsule and lentiform nucleus; M1, M2 and M3 as the front, the lateral (beside the insular ribbon) and the back part of the MCA cortex; and M4, M5 and M6 as the front, lateral and back MCA territories directly above M1, M2 and M3, higher than the basal ganglia.",
      spans: [
        {
          from: "C, caudate, I, insularribbon,",
          to: "rostral to basal ganglia.",
          length: 301,
          sha256: "4ec9c3c6f82b61d04280908ac4703108df66ee85d369331b849fefb0f4bca908",
        },
      ],
    },
    {
      id: "dubey2013-fig1-subcortical-three-points",
      source: "dubey2013",
      block: "fig1",
      locator: "Figure 1 caption",
      paraphrase: "Three of the ten points belong to subcortical structures: caudate, lentiform nucleus and internal capsule.",
      spans: [
        {
          from: "Subcortical structures are allotted",
          to: "and IC).",
          length: 60,
          sha256: "403235c61ec228d999245dde0fe79472671b4ccf4cb64fd2da7db5cd78106e76",
        },
      ],
    },
    {
      id: "dubey2013-fig1-cortex-seven-points",
      source: "dubey2013",
      block: "fig1",
      locator: "Figure 1 caption",
      paraphrase: "The other seven points belong to MCA cortex: the insular cortex and M1 to M6.",
      spans: [
        {
          from: "MCA cortex is allotted 7 points",
          to: "M5, and M6).",
          length: 77,
          sha256: "cde321c5e5ced68389d9ce3a4c69128cfe328897eeeeda0272fb7f6d5425b469",
        },
      ],
    },
  ].map((statement) => Object.freeze(statement)),
);

// Runtime text the audit pins exactly: automated claims bind it to the statements above, and
// documented claims bind it to docs/evidence/aspects-regions.md.
export const RUNTIME_LABELS = Object.freeze({
  caudate: "C - Caudate Head",
  lentiform: "L - Lentiform Nucleus",
  internal_capsule: "IC - Internal Capsule",
  insular: "I - Insular Ribbon",
  m1: "M1 - Anterior MCA Cortex (Ganglionic Level)",
  m2: "M2 - Lateral MCA Cortex (Ganglionic Level)",
  m3: "M3 - Posterior MCA Cortex (Ganglionic Level)",
  m4: "M4 - Anterior MCA Territory (Supraganglionic)",
  m5: "M5 - Lateral MCA Territory (Supraganglionic)",
  m6: "M6 - Posterior MCA Territory (Supraganglionic)",
});
export const RUNTIME_SUBLABELS = Object.freeze({
  caudate: "Early ischemic change in caudate nucleus",
  lentiform: "Putamen and globus pallidus",
  internal_capsule: "Posterior limb of internal capsule",
  insular: "Insular cortex / loss of insular ribbon",
  m1: "Frontal operculum",
  m2: "Anterior temporal lobe, lateral to insular ribbon",
  m3: "MCA cortex behind M2",
  m4: "Immediately superior to M1",
  m5: "Immediately superior to M2",
  m6: "Immediately superior to M3",
});
export const RUNTIME_INFO_GANGLIONIC = Object.freeze([
  "• C - Caudate head",
  "• L - Lentiform nucleus (putamen + globus pallidus)",
  "• IC - Internal capsule (posterior limb)",
  "• I - Insular ribbon (insular cortex)",
  "• M1 - Frontal operculum (anterior MCA cortex)",
  "• M2 - Anterior temporal lobe (lateral to insular ribbon)",
  "• M3 - Posterior MCA cortex (behind M2)",
]);
export const RUNTIME_INFO_SUPRAGANGLIONIC = Object.freeze([
  "• M4 - Anterior MCA territory (superior to M1)",
  "• M5 - Lateral MCA territory (superior to M2)",
  "• M6 - Posterior MCA territory (superior to M3)",
]);
export const RUNTIME_INFO_SCORING_RULE = "subtract 1 point for each region";
const SUBCORTICAL = Object.freeze(["caudate", "lentiform", "internal_capsule"]);
const GANGLIONIC_CORTICAL = Object.freeze(["insular", "m1", "m2", "m3"]);
const SUPRAGANGLIONIC_CORTICAL = Object.freeze(["m4", "m5", "m6"]);
const REGION_IDS = Object.freeze([...SUBCORTICAL, ...GANGLIONIC_CORTICAL, ...SUPRAGANGLIONIC_CORTICAL]);
const M1_TO_M6 = Object.freeze(["m1", "m2", "m3", "m4", "m5", "m6"]);
export const PREDOMINANTLY_SUBCORTICAL_NOTE =
  "Predominantly subcortical involvement - consider lenticulostriate territory infarction";
export const COMPLETE_M1_M6_NOTE =
  "Complete M1-M6 cortical involvement suggests very poor collateral circulation";

export function breakdownText(subcortical, ganglionicCortical, supraganglionic) {
  return `Subcortical (C, L, IC): ${subcortical}/3 | Ganglionic cortical (I, M1-M3): ${ganglionicCortical}/4 | Supraganglionic (M4-M6): ${supraganglionic}/3`;
}

const info = (...lines) => lines;

// Claims checked automatically against the fetched statements.
export const CLAIM_BINDINGS = Object.freeze(
  [
    {
      claim_id: "breakdown-subcortical-is-c-l-ic",
      runtime: "Regional Breakdown counts C, L and IC as subcortical, out of 3",
      source_statement_ids: ["dubey2013-fig1-subcortical-three-points"],
    },
    {
      claim_id: "breakdown-insula-is-ganglionic-cortex",
      runtime:
        "Regional Breakdown counts I with M1-M3 as ganglionic cortex (out of 4) and M4-M6 as supraganglionic (out of 3)",
      basis:
        "the insular cortex is one of the 7 cortical points; the template defines M2 by its position beside the insular ribbon, so the ribbon lies on the lower cut with M1-M3, and M4-M6 are the territories above M1-M3, higher than the basal ganglia",
      source_statement_ids: ["dubey2013-fig1-cortex-seven-points", "dubey2013-fig1-region-definitions"],
    },
    {
      claim_id: "subcortical-note-uses-corrected-grouping",
      runtime: "the predominantly-subcortical note needs C, L and IC with no cortical region (I, M1-M6)",
      source_statement_ids: ["dubey2013-fig1-subcortical-three-points", "dubey2013-fig1-cortex-seven-points"],
    },
    {
      claim_id: "m1-m6-note-names-its-trigger",
      runtime: "the collateral note fires on M1-M6 and names M1-M6 rather than all MCA cortex",
      source_statement_ids: ["dubey2013-fig1-cortex-seven-points"],
    },
    {
      claim_id: "score-is-ten-minus-regions",
      runtime: "ten region checkboxes worth one point each; ASPECTS = 10 - affected regions",
      basis:
        "Barber gives ten regions; the template gives 3 points to the three subcortical regions and 7 to the seven cortical regions, one point per region",
      source_statement_ids: [
        "barber2000-abstract-ten-regions",
        "dubey2013-fig1-subcortical-three-points",
        "dubey2013-fig1-cortex-seven-points",
      ],
    },
    {
      claim_id: "region-labels-name-template-regions",
      runtime:
        "the ten checkbox labels name the template's regions: C, L, IC and I; M1-M3 as anterior, lateral and posterior MCA cortex; M4-M6 as anterior, lateral and posterior MCA territory",
      labels: [...REGION_IDS],
      source_statement_ids: ["dubey2013-fig1-region-definitions"],
    },
    {
      claim_id: "two-levels-in-info-text",
      runtime: "info text lists C, L, IC, I and M1-M3 at the ganglionic level and M4-M6 at the supraganglionic level",
      source_statement_ids: ["dubey2013-fig1-region-definitions"],
    },
    {
      claim_id: "m2-lateral-to-insular-ribbon",
      runtime: "M2 subLabel and info line place M2 lateral to the insular ribbon",
      sublabels: ["m2"],
      info_lines: info("• M2 - Anterior temporal lobe (lateral to insular ribbon)"),
      source_statement_ids: ["dubey2013-fig1-region-definitions"],
    },
    {
      claim_id: "m3-posterior-mca-cortex-behind-m2",
      runtime: "M3 subLabel and info line: posterior MCA cortex behind M2, no lobe named",
      basis:
        "the template names M1, M2 and M3 as the front, lateral and back parts of the MCA cortex, so M3 is the back part, behind M2",
      sublabels: ["m3"],
      info_lines: info("• M3 - Posterior MCA cortex (behind M2)"),
      source_statement_ids: ["dubey2013-fig1-region-definitions"],
    },
    {
      claim_id: "m4-m6-immediately-superior",
      runtime: "M4-M6 subLabels and info lines: immediately superior to M1-M3",
      sublabels: ["m4", "m5", "m6"],
      info_lines: info(...RUNTIME_INFO_SUPRAGANGLIONIC),
      source_statement_ids: ["dubey2013-fig1-region-definitions"],
    },
    {
      claim_id: "insular-ribbon-is-insular-cortex",
      runtime: "I subLabel and info line: the insular ribbon is insular cortex",
      sublabels: ["insular"],
      info_lines: info("• I - Insular ribbon (insular cortex)"),
      source_statement_ids: ["dubey2013-fig1-region-definitions", "dubey2013-fig1-cortex-seven-points"],
    },
  ].map((binding) => Object.freeze(binding)),
);

// Claims supported only by sources with no byte-stable copy. The audit pins their runtime
// wording; the source side is read by the judges in docs/evidence/aspects-regions.md.
export const DOCUMENTED_ONLY = Object.freeze(
  [
    {
      claim_id: "internal-capsule-posterior-limb",
      runtime: "IC subLabel and info line name the posterior limb",
      sublabels: ["internal_capsule"],
      info_lines: info("• IC - Internal capsule (posterior limb)"),
      sources: [
        "developers_site: Training 'Insula and basal ganglia', Internal capsule section",
        "pexman2001: Results, How Different Physicians Interpreted ASPECTS, internal capsule paragraph",
      ],
    },
    {
      claim_id: "m1-frontal-operculum",
      runtime: "M1 subLabel and info line: frontal operculum",
      sublabels: ["m1"],
      info_lines: info("• M1 - Frontal operculum (anterior MCA cortex)"),
      sources: ["pexman2001: Results, How Different Physicians Interpreted ASPECTS, M-area paragraph"],
    },
    {
      claim_id: "m2-front-edge-anterior-temporal-lobe",
      runtime: "M2 subLabel and info line: anterior temporal lobe",
      sublabels: ["m2"],
      info_lines: info("• M2 - Anterior temporal lobe (lateral to insular ribbon)"),
      sources: ["pexman2001: Results, How Different Physicians Interpreted ASPECTS, M-area paragraph"],
    },
    {
      claim_id: "insular-ribbon-sign",
      runtime: "I subLabel: loss of the insular ribbon",
      sublabels: ["insular"],
      sources: [
        "pexman2001: Results, How Different Physicians Interpreted ASPECTS, first paragraph",
        "developers_site: Training 'Insula and basal ganglia', Insular cortex section",
      ],
    },
    {
      claim_id: "caudate-head",
      runtime: "C label and info line: caudate head",
      labels: ["caudate"],
      info_lines: info("• C - Caudate head"),
      sources: [
        "pexman2001: Fig 1 legend",
        "developers_site: Training 'Insula and basal ganglia', Basal ganglia section",
      ],
    },
    {
      claim_id: "one-point-subtracted-per-region",
      runtime: "info text: subtract 1 point for each affected region",
      supplements: "score-is-ten-minus-regions",
      sources: ["pexman2001: Methods", "developers_site: 'What is ASPECTS', How to compute ASPECTS"],
    },
    {
      claim_id: "level-assignment-at-caudate-head",
      runtime: "Regional Breakdown and info text place I with M1-M3 on the ganglionic level",
      supplements: "breakdown-insula-is-ganglionic-cortex",
      sources: ["developers_site: Training 'M1-M6 regions', M1-3 and M4-6 sections"],
    },
    {
      claim_id: "m-areas-geometric-and-sylvian-divisions",
      runtime: "M3 wording names no lobe",
      supplements: "m3-posterior-mca-cortex-behind-m2",
      sources: [
        "pexman2001: Results, M-area paragraph (the M areas are geometric)",
        "pexman2001: Discussion, paragraph on CT baselines (ganglionic divisions follow the ends of the sylvian fissure)",
      ],
    },
  ].map((claim) => Object.freeze(claim)),
);

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const NAMED_ENTITIES = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"' };

export function decodeEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&(amp|apos|gt|lt|nbsp|quot);/g, (_, name) => NAMED_ENTITIES[name]);
}

export function foldText(value) {
  return value
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function markupText(fragment) {
  return foldText(
    decodeEntities(
      fragment
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
        .replace(/<[^>]+>/g, " "),
    ),
  );
}

// ---- Barber 2000: PubMed plain-text abstract --------------------------------------------------

const BARBER_ABSTRACT_LABELS = Object.freeze(["BACKGROUND", "METHODS", "FINDINGS", "INTERPRETATION"]);

// Parses the efetch rettype=abstract, retmode=text record: blank-line-separated blocks for the
// citation, title, authors, author information, erratum and comment notes, the labelled
// abstract, and the closing DOI and PMID lines.
export function pubmedAbstractText(text) {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n[ \t]*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  assert.ok(blocks.length >= 4, "barber2000: PubMed record structure is missing");
  const abstractBlocks = blocks.filter((block) => block.startsWith(`${BARBER_ABSTRACT_LABELS[0]}: `));
  assert.equal(abstractBlocks.length, 1, "barber2000: expected exactly one labelled abstract");
  const sections = new Map();
  const labelStart = new RegExp(`^(?=(?:${BARBER_ABSTRACT_LABELS.join("|")}): )`, "m");
  for (const part of abstractBlocks[0].split(labelStart)) {
    const match = /^([A-Z]+): ([\s\S]*)$/.exec(part);
    assert.ok(match, "barber2000: abstract text outside a labelled section");
    sections.set(`abstract:${match[1]}`, foldText(match[2]));
  }
  assert.deepEqual(
    [...sections.keys()],
    BARBER_ABSTRACT_LABELS.map((label) => `abstract:${label}`),
    "barber2000: abstract sections drifted",
  );
  const errataBlock = blocks.find((block) => block.startsWith("Erratum in"));
  return {
    citation: foldText(blocks[0]),
    title: foldText(blocks[1]),
    sections,
    pmid: /^PMID: (\d+)/m.exec(text)?.[1] ?? null,
    doi: /^DOI: (\S+)$/m.exec(text)?.[1] ?? null,
    errata: errataBlock
      ? errataBlock
          .split("\n")
          .slice(1)
          .map((line) => foldText(line))
          .filter(Boolean)
      : [],
  };
}

// ---- Dubey 2013: PMC XML Figure 1 caption -----------------------------------------------------

export function dubeyFigure1Caption(xml) {
  const figures = [...xml.matchAll(/<fig id="fig1"[\s\S]*?<\/fig>/g)];
  assert.equal(figures.length, 1, "dubey2013: expected exactly one Figure 1");
  const caption = /<caption>([\s\S]*?)<\/caption>/.exec(figures[0][0])?.[1];
  assert.ok(caption, "dubey2013: Figure 1 caption is missing");
  return markupText(caption);
}

// ---- Retrieval --------------------------------------------------------------------------------

// Retrieval goes through the shared NCBI helper (scripts/lib/ncbi-fetch.mjs, Codex review on
// #305): its request spacing across the run's audits, its fetch log, and its retry policy for
// transport failures (network errors, timeouts, HTTP 408, 425, 429 and 5xx; 1, 2, 4 and 8 s
// apart, or longer when Retry-After asks, never over 30 s). Redirects are refused, not
// followed, so no request ever reaches another host. Every 200 response is checked against all
// of its source's pins (final URL, media type, byte length, SHA-256) in verify(), before it is
// returned, so nothing is parsed unverified. That is stricter than the helper's default, which
// retries a wrong final URL or media type: here a 200 that misses any pin, however short, is a
// changed source, not a transient failure, so it fails at once and is never retried.
// `fetchImpl`, `sleep`, `env` and `gate` are for tests.
export async function retrieve(source, { fetchImpl, sleep, env, gate } = {}) {
  assert.ok(
    ALLOWED_HOSTS.includes(new URL(source.url).hostname),
    `${source.key}: ${new URL(source.url).hostname} is not an allowed audit host`,
  );
  const fetched = await fetchPinned({
    url: source.url,
    label: source.key,
    pin: { sha256: source.sha256, bytes: source.bytes },
    verify: (bytes, response) => {
      // A cache hit has no response: the run's cache holds only bytes that passed these checks,
      // under the pinned SHA-256.
      if (response) {
        assertArtifactIdentity(source, {
          finalUrl: response.url,
          contentType: response.headers?.get?.("content-type") ?? "",
        });
      }
      assertRawBytePin(source, bytes);
    },
    checkResponse: (response) => {
      if (response.redirected) throw new Error(`${source.key}: redirected response`);
    },
    minBytes: 0,
    headers: { "user-agent": USER_AGENT },
    redirect: "error",
    fetchImpl,
    sleep,
    env,
    gate,
  });
  return {
    bytes: fetched.bytes,
    finalUrl: fetched.finalUrl,
    contentType: fetched.contentType ?? "",
    attempts: fetched.attempts,
  };
}

// ---- Verification -----------------------------------------------------------------------------

// All pins of one artifact, checked before anything in it is parsed.
export function verifyPinnedArtifact(source, artifact) {
  assert.equal(source.pin, "raw-bytes", `${source.key}: every source must be pinned by its raw bytes`);
  assertArtifactIdentity(source, artifact);
  assertRawBytePin(source, artifact.bytes);
}

export function assertArtifactIdentity(source, retrieved) {
  const expected = new URL(source.url);
  let finalUrl;
  try {
    finalUrl = new URL(retrieved.finalUrl);
  } catch {
    assert.fail(`${source.key}: final response URL missing or invalid (${retrieved.finalUrl || "<empty>"})`);
  }
  assert.equal(finalUrl.protocol, "https:", `${source.key}: final URL left HTTPS`);
  assert.equal(finalUrl.hostname, expected.hostname, `${source.key}: final URL host drifted`);
  assert.equal(finalUrl.pathname, expected.pathname, `${source.key}: final URL path drifted`);
  assert.equal(finalUrl.search, expected.search, `${source.key}: final URL query drifted`);
  const mediaType = retrieved.contentType.split(";")[0].trim().toLowerCase();
  assert.equal(mediaType, source.media_type, `${source.key}: media type drifted`);
}

export function assertRawBytePin(source, bytes) {
  assert.equal(source.pin, "raw-bytes", `${source.key}: raw-byte pin requested for a ${source.pin} source`);
  assert.ok(Buffer.isBuffer(bytes), `${source.key}: artifact bytes are missing`);
  assert.equal(
    bytes.length,
    source.bytes,
    `${source.key}: artifact byte length drifted (re-review the statements before re-pinning)`,
  );
  assert.equal(
    sha256(bytes),
    source.sha256,
    `${source.key}: artifact SHA-256 drifted (re-review the statements before re-pinning)`,
  );
}

export function spanDigest(text, from, to, label) {
  const start = text.indexOf(from);
  assert.ok(start >= 0, `${label}: span start marker ${JSON.stringify(from)} is missing`);
  assert.equal(
    text.indexOf(from, start + 1),
    -1,
    `${label}: span start marker ${JSON.stringify(from)} is not unique in its locator`,
  );
  const toIndex = text.indexOf(to, start + from.length);
  assert.ok(toIndex >= 0, `${label}: span end marker ${JSON.stringify(to)} is missing`);
  const value = text.slice(start, toIndex + to.length);
  return { length: value.length, sha256: sha256(value) };
}

export function checkSpans(statement, text, mismatches) {
  return statement.spans.map((span, index) => {
    const actual = spanDigest(text, foldText(span.from), foldText(span.to), `${statement.id} span ${index + 1}`);
    if (actual.length !== span.length || actual.sha256 !== span.sha256) {
      mismatches.push({
        id: statement.id,
        span: index + 1,
        expected: { length: span.length, sha256: span.sha256 },
        actual,
      });
    }
    return { from: span.from, to: span.to, ...actual };
  });
}

// Locates every statement's block in its source text. Returns Map(statementId -> block text).
export function locateBlocks(texts) {
  const located = new Map();
  for (const statement of STATEMENTS) {
    const label = `${statement.id} (${statement.locator})`;
    let block;
    if (statement.source === "barber2000") {
      block = texts.barber2000.sections.get(statement.block);
    } else if (statement.source === "dubey2013") {
      block = texts.dubey2013.caption;
    }
    assert.ok(block, `${label}: ${statement.block} is missing`);
    located.set(statement.id, block);
  }
  return located;
}

// Verifies every artifact's pins, then its identity, then every statement span. `retrieved`
// maps each source key to the retrieve() result. The pins are checked again here, before any
// parsing, so bytes handed in directly (tests, saved-source replays) pass the same gate as a
// live retrieval.
export function verifyArtifacts(retrieved, { sources = SOURCES } = {}) {
  for (const source of Object.values(sources)) {
    const artifact = retrieved[source.key];
    assert.ok(artifact, `${source.key}: artifact was not retrieved`);
    verifyPinnedArtifact(source, artifact);
  }
  const texts = {};

  // Barber 2000: PubMed plain-text record identity, then the labelled abstract.
  const barber = pubmedAbstractText(retrieved.barber2000.bytes.toString("utf8"));
  assert.equal(barber.pmid, sources.barber2000.pmid, "barber2000: PMID drifted");
  assert.equal(barber.doi?.toLowerCase(), sources.barber2000.doi.toLowerCase(), "barber2000: DOI drifted");
  assert.match(barber.citation, /^1\. Lancet\. 2000 May 13;355\(9216\):1670-4\./, "barber2000: citation drifted");
  assert.ok(
    barber.title.startsWith(
      "Validity and reliability of a quantitative computed tomography score in predicting outcome of hyperacute stroke before thrombolytic therapy.",
    ),
    "barber2000: title drifted",
  );
  texts.barber2000 = { sections: barber.sections };

  // Dubey 2013: identity from the raw-pinned XML, then the Figure 1 caption.
  const dubeyXml = retrieved.dubey2013.bytes.toString("utf8");
  for (const [type, value] of [
    ["pmcid", sources.dubey2013.pmcid],
    ["pmid", sources.dubey2013.pmid],
    ["doi", sources.dubey2013.doi],
  ]) {
    assert.ok(
      dubeyXml.includes(`<article-id pub-id-type="${type}">${value}</article-id>`),
      `dubey2013: ${type} ${value} is missing`,
    );
  }
  assert.ok(dubeyXml.includes("<article-title>Acute Stroke Imaging: Recent Updates</article-title>"), "dubey2013: title drifted");
  assert.ok(dubeyXml.includes(`xlink:href="${sources.dubey2013.license}"`), "dubey2013: CC BY 3.0 license is missing");
  texts.dubey2013 = { caption: dubeyFigure1Caption(dubeyXml) };

  const located = locateBlocks(texts);
  const mismatches = [];
  const verified = new Map();
  for (const statement of STATEMENTS) {
    verified.set(statement.id, {
      id: statement.id,
      source: statement.source,
      locator: statement.locator,
      paraphrase: statement.paraphrase,
      spans: checkSpans(statement, located.get(statement.id), mismatches),
    });
  }
  assert.equal(
    mismatches.length,
    0,
    `pinned source spans drifted (re-review each statement at its locator before re-pinning):\n${JSON.stringify(mismatches, null, 2)}`,
  );

  return { verified, barber: { errata: barber.errata } };
}

// ---- Runtime binding --------------------------------------------------------------------------

function infoSection(text, heading, nextHeading) {
  const start = text.indexOf(heading);
  assert.ok(start >= 0, `info text lacks ${JSON.stringify(heading)}`);
  const end = nextHeading ? text.indexOf(nextHeading, start) : text.length;
  assert.ok(end > start, `info text lacks ${JSON.stringify(nextHeading)} after ${JSON.stringify(heading)}`);
  return text
    .slice(start, end)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("•"));
}

function inputsFor(affected) {
  const values = { laterality: "left", time_from_onset: "" };
  for (const id of REGION_IDS) values[id] = affected.includes(id);
  return values;
}

// Words of a label's trailing parenthesis, e.g. ["Ganglionic", "Level"].
function labelLevelWords(label) {
  return (/\(([^()]*)\)\s*$/.exec(label)?.[1] ?? "").split(/\s+/).filter(Boolean);
}

// App guardrails for how FieldLabel renders a checkbox: "label (subLabel)". A subLabel must not
// nest parentheses or repeat the level already named in the label's parenthesis.
export function assertSubLabelRendering(field) {
  assert.doesNotMatch(field.subLabel, /[()]/, `${field.id}: subLabel would render nested parentheses`);
  for (const word of labelLevelWords(field.label)) {
    assert.ok(
      !field.subLabel.toLowerCase().includes(word.toLowerCase()),
      `${field.id}: subLabel repeats the label's level (${word})`,
    );
  }
}

function runtimeTexts(claim, labels, subLabels) {
  return {
    ...(claim.labels ? { labels: Object.fromEntries(claim.labels.map((id) => [id, labels[id]])) } : {}),
    ...(claim.sublabels ? { sublabels: Object.fromEntries(claim.sublabels.map((id) => [id, subLabels[id]])) } : {}),
    ...(claim.info_lines ? { info_lines: [...claim.info_lines] } : {}),
  };
}

export function verifyRuntime(calculator = ASPECTSScore, calculatorSource = null) {
  const bindings = {};
  const checkboxes = calculator.fields.filter((field) => field.type === "checkbox");
  assert.deepEqual(
    checkboxes.map((field) => field.id),
    REGION_IDS,
    "runtime must offer exactly the ten ASPECTS region checkboxes",
  );
  for (const field of checkboxes) assertSubLabelRendering(field);
  const labels = Object.fromEntries(checkboxes.map((field) => [field.id, field.label]));
  const subLabels = Object.fromEntries(checkboxes.map((field) => [field.id, field.subLabel]));
  assert.deepEqual(labels, { ...RUNTIME_LABELS }, "runtime region labels drifted from the audited wording");
  assert.deepEqual(subLabels, { ...RUNTIME_SUBLABELS }, "runtime region subLabels drifted from the audited wording");

  const infoText = calculator.info.text;
  const ganglionic = infoSection(infoText, "GANGLIONIC LEVEL", "SUPRAGANGLIONIC LEVEL");
  const supraganglionic = infoSection(infoText, "SUPRAGANGLIONIC LEVEL", "SCORING:");
  assert.deepEqual(ganglionic, [...RUNTIME_INFO_GANGLIONIC], "info text ganglionic-level region list drifted");
  assert.deepEqual(supraganglionic, [...RUNTIME_INFO_SUPRAGANGLIONIC], "info text supraganglionic region list drifted");
  assert.ok(infoText.includes(RUNTIME_INFO_SCORING_RULE), "info text must state the one-point-per-region rule");
  assert.doesNotMatch(infoText, /Posterior temporal lobe/i, "info text names a lobe for M3");

  let cells = 0;
  for (let mask = 0; mask < 1 << REGION_IDS.length; mask += 1) {
    const affected = REGION_IDS.filter((_, index) => mask & (1 << index));
    const result = calculator.compute(inputsFor(affected));
    const count = (ids) => ids.filter((id) => affected.includes(id)).length;
    const subcortical = count(SUBCORTICAL);
    const ganglionicCortical = count(GANGLIONIC_CORTICAL);
    const supraganglionicCortical = count(SUPRAGANGLIONIC_CORTICAL);
    const notes = (result["Clinical Notes"] ?? "").split("; ").filter(Boolean);
    const label = `regions [${affected.join(", ")}]`;

    assert.equal(result["ASPECTS Score"], `${10 - affected.length} / 10`, `${label}: ASPECTS = 10 - regions`);
    assert.equal(
      result["Regional Breakdown"],
      breakdownText(subcortical, ganglionicCortical, supraganglionicCortical),
      `${label}: Regional Breakdown grouping`,
    );
    assert.equal(
      notes.includes(PREDOMINANTLY_SUBCORTICAL_NOTE),
      subcortical === 3 && ganglionicCortical + supraganglionicCortical === 0,
      `${label}: predominantly-subcortical note must follow the corrected grouping`,
    );
    assert.equal(
      notes.includes(COMPLETE_M1_M6_NOTE),
      M1_TO_M6.every((id) => affected.includes(id)),
      `${label}: M1-M6 note trigger`,
    );
    assert.doesNotMatch(result["Clinical Notes"] ?? "", /Complete cortical MCA involvement/, `${label}: old note text`);
    cells += 1;
  }
  assert.equal(cells, 1024, "all 1024 region combinations must be checked");

  // Barber 2000 is the calculator's primary reference and info link; Pexman 2001 stays cited.
  const doiUrl = `https://doi.org/${SOURCES.barber2000.doi}`.toLowerCase();
  assert.equal(calculator.refs[0].u.toLowerCase(), doiUrl, "first reference must be Barber 2000 by DOI");
  assert.equal(calculator.info.link.url.toLowerCase(), doiUrl, "info link must be Barber 2000 by DOI");
  assert.ok(
    calculator.refs.some((ref) => ref.u === "https://pubmed.ncbi.nlm.nih.gov/11559501/"),
    "calculator must cite Pexman 2001 by PMID",
  );

  if (calculatorSource !== null) {
    for (const removed of [
      "Posterior temporal lobe",
      "Subcortical: ${subcorticalAffected}/4",
      "(-1 point)",
      "at ganglionic level",
    ]) {
      assert.ok(!calculatorSource.includes(removed), `calculator source still contains ${JSON.stringify(removed)}`);
    }
  }

  const grouping = {
    subcortical: [...SUBCORTICAL],
    ganglionic_cortical: [...GANGLIONIC_CORTICAL],
    supraganglionic_cortical: [...SUPRAGANGLIONIC_CORTICAL],
    denominators: { subcortical: 3, ganglionic_cortical: 4, supraganglionic_cortical: 3 },
    region_combinations_checked: cells,
  };
  bindings["breakdown-subcortical-is-c-l-ic"] = { ...grouping };
  bindings["breakdown-insula-is-ganglionic-cortex"] = { ...grouping, cortical_points: 7 };
  bindings["subcortical-note-uses-corrected-grouping"] = {
    note: PREDOMINANTLY_SUBCORTICAL_NOTE,
    requires: ["caudate", "lentiform", "internal_capsule"],
    excludes_any: [...GANGLIONIC_CORTICAL, ...SUPRAGANGLIONIC_CORTICAL],
  };
  bindings["m1-m6-note-names-its-trigger"] = { note: COMPLETE_M1_M6_NOTE, requires: [...M1_TO_M6] };
  bindings["score-is-ten-minus-regions"] = {
    region_checkboxes: REGION_IDS.length,
    region_combinations_checked: cells,
    info_rule: RUNTIME_INFO_SCORING_RULE,
  };
  bindings["two-levels-in-info-text"] = {
    ganglionic_level: ganglionic.length,
    supraganglionic_level: supraganglionic.length,
  };
  for (const claim of CLAIM_BINDINGS) {
    if (claim.labels || claim.sublabels || claim.info_lines) {
      bindings[claim.claim_id] = { ...bindings[claim.claim_id], ...runtimeTexts(claim, labels, subLabels) };
    }
  }
  const documented = {};
  for (const claim of DOCUMENTED_ONLY) {
    documented[claim.claim_id] = runtimeTexts(claim, labels, subLabels);
  }
  documented["one-point-subtracted-per-region"] = { info_rule: RUNTIME_INFO_SCORING_RULE };
  documented["level-assignment-at-caudate-head"] = { ...grouping };
  documented["m-areas-geometric-and-sylvian-divisions"] = runtimeTexts(
    { sublabels: ["m3"], info_lines: ["• M3 - Posterior MCA cortex (behind M2)"] },
    labels,
    subLabels,
  );
  return { bindings, documented, cells };
}

// ---- Audit ------------------------------------------------------------------------------------

export function buildAudit(retrieved, { calculator = ASPECTSScore, calculatorSource = null } = {}) {
  const artifacts = verifyArtifacts(retrieved);

  const boundStatementIds = new Set(CLAIM_BINDINGS.flatMap((binding) => binding.source_statement_ids));
  for (const binding of CLAIM_BINDINGS) {
    for (const statementId of binding.source_statement_ids) {
      assert.ok(artifacts.verified.has(statementId), `${binding.claim_id}: source statement ${statementId} is not verified`);
    }
  }
  for (const statementId of artifacts.verified.keys()) {
    if (statementId.endsWith("-provenance")) continue;
    assert.ok(boundStatementIds.has(statementId), `${statementId}: verified statement has no runtime binding`);
  }

  const runtime = verifyRuntime(calculator, calculatorSource);
  for (const binding of CLAIM_BINDINGS) {
    assert.ok(runtime.bindings[binding.claim_id], `${binding.claim_id}: runtime binding was not exercised`);
  }
  for (const claim of DOCUMENTED_ONLY) {
    assert.ok(runtime.documented[claim.claim_id], `${claim.claim_id}: documented claim's runtime text was not pinned`);
  }

  return {
    schema: "radulator-aspects-region-source-audit/v2",
    calculator_id: calculator.id,
    calculator_path: CALCULATOR_PATH,
    network: { hosts: [...ALLOWED_HOSTS], requests_per_run: Object.keys(SOURCES).length },
    sources: Object.values(SOURCES).map((source) => ({
      key: source.key,
      role: source.role,
      document: source.document,
      ...(source.pmid ? { pmid: source.pmid } : {}),
      ...(source.pmcid ? { pmcid: source.pmcid } : {}),
      ...(source.doi ? { doi: source.doi } : {}),
      ...(source.license ? { license: source.license } : {}),
      url: source.url,
      final_url: retrieved[source.key].finalUrl,
      media_type: source.media_type,
      pin: source.pin,
      bytes: source.bytes,
      sha256: source.sha256,
    })),
    source_statements: [...artifacts.verified.values()],
    claim_bindings: CLAIM_BINDINGS.map((binding) => ({
      claim_id: binding.claim_id,
      runtime_claim: binding.runtime,
      ...(binding.basis ? { basis: binding.basis } : {}),
      source_statement_ids: [...binding.source_statement_ids],
      runtime: runtime.bindings[binding.claim_id],
    })),
    documented_sources: Object.fromEntries(
      Object.entries(DOCUMENTED_SOURCES).map(([key, value]) => [key, { ...value }]),
    ),
    documented_only: DOCUMENTED_ONLY.map((claim) => ({
      claim_id: claim.claim_id,
      runtime_claim: claim.runtime,
      ...(claim.supplements ? { supplements: claim.supplements } : {}),
      sources: [...claim.sources],
      evidence: "docs/evidence/aspects-regions.md",
      runtime: runtime.documented[claim.claim_id],
    })),
    runtime: {
      region_labels: { ...RUNTIME_LABELS },
      region_sublabels: { ...RUNTIME_SUBLABELS },
      region_combinations_checked: runtime.cells,
      breakdown_example_all_regions: breakdownText(3, 4, 3),
    },
    app_guardrails: {
      provenance: "radulator-rendering-guardrail",
      publication_derived: false,
      checks: [
        "region subLabels contain no parentheses because FieldLabel renders label (subLabel)",
        "region subLabels do not repeat the level named in the label's parenthesis",
      ],
    },
    informational: {
      barber2000_errata_listed_by_pubmed: artifacts.barber.errata,
    },
    scope: {
      score_arithmetic_changed: false,
      not_asserted: [
        "lentiform nucleus composition (putamen and globus pallidus): standard anatomy, not stated by these sources",
        "clinical pattern notes (proximal M1 occlusion, lenticulostriate territory, collateral status): only their region grouping is bound",
        "thrombectomy eligibility, time-window and trial-threshold text",
        "whole-calculator clinical acceptance",
      ],
    },
    source_bytes_committed: false,
  };
}

// One request at a time (Codex review on #305), each through the helper's request spacing.
export async function retrieveAll(options = {}) {
  const retrieved = {};
  for (const source of Object.values(SOURCES)) retrieved[source.key] = await retrieve(source, options);
  return retrieved;
}

async function main(argv) {
  const saveIndex = argv.indexOf("--save-sources");
  const saveDir = saveIndex >= 0 ? argv[saveIndex + 1] : null;
  assert.ok(saveIndex < 0 || saveDir, "--save-sources needs a directory");

  const retrieved = await retrieveAll();
  if (saveDir) {
    // Test support: the caller passes a temporary directory and deletes it afterwards.
    mkdirSync(saveDir, { recursive: true });
    for (const [key, artifact] of Object.entries(retrieved)) {
      writeFileSync(join(saveDir, `${key}.bin`), artifact.bytes);
      writeFileSync(
        join(saveDir, `${key}.json`),
        JSON.stringify({ finalUrl: artifact.finalUrl, contentType: artifact.contentType }),
      );
    }
  }
  const audit = buildAudit(retrieved, { calculatorSource: readFileSync(CALCULATOR_PATH, "utf8") });

  if (argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(audit)}\n`);
  } else {
    console.log(
      `ASPECTS region primary-source audit passed: ${audit.sources.length} pinned NCBI artifacts, ${audit.source_statements.length} source statements, ${audit.claim_bindings.length} runtime claim bindings, ${audit.documented_only.length} documented claims with pinned runtime text, and ${audit.runtime.region_combinations_checked} region combinations.`,
    );
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  await main(process.argv.slice(2));
}
