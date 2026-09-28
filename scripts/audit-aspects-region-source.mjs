#!/usr/bin/env node

// Exact-head primary-source audit for the ASPECTS region texts and region grouping.
//
// Sources, all free to read:
// - Barber et al., Lancet 2000 (the original ASPECTS paper; PMID 10905241). Only the PubMed
//   record is free; the audit reads it as the plain-text abstract, which is byte-stable.
// - Pexman et al., AJNR 2001 (the developers' methods paper; PMID 11559501, PMC7974585). The
//   publisher releases no PMC XML, the live PMC page is not byte-stable (per-request id and
//   CSRF token) and the PMC PDF sits behind a browser challenge, which the audit does not
//   bypass. The audit therefore reads a fixed Internet Archive capture of the PMC article page
//   (2025-02-02). Its article body is identical to the live page's as of 2026-09-28.
// - Dubey et al., Stroke Res Treat 2013 (PMC3732599, CC BY 3.0). Its Figure 1 reprints the
//   developers' ASPECTS template from aspectsinstroke.com with the Calgary group's permission.
// - The developers' own site, aspectsinstroke.com. The live site fails TLS (expired
//   certificate) and the audit does not bypass that, so it reads three Internet Archive
//   captures of the 2016 site: "What is ASPECTS", the training page "Insula and basal
//   ganglia" and the training page "M1-M6 regions".
//
// Pins. Every artifact is pinned by the exact byte length and SHA-256 of the raw response
// body, and each pin was byte-stable across fetches minutes apart. retrieve() checks the pins,
// the final URL (protocol, host, path, query) and the media type before returning, so nothing
// is parsed until every pin holds. For the four Internet Archive captures (an "id_" capture
// never changes) it also checks the Memento capture time, the original URL, and the capture's
// SHA-1 as published in the archive's CDX index. A 200 response that misses any pin fails at
// once and is never retried; only transport failures (network errors, timeouts, HTTP 408, 429
// and 5xx) are retried. After the pins hold, each artifact's identity (PMID, PMCID, DOI,
// title, page) is checked.
//
// Statements. Each source statement is pinned by the length and SHA-256 of the exact
// normalized span that runs from a short `from` marker to the next `to` marker inside its
// locator. Markers are at most six words, and each statement carries Radulator's own
// paraphrase, so the repository holds no copied source passages; open the URL at the locator
// to read a statement. The audit then binds the statements to the calculator runtime: the
// region grouping in "Regional Breakdown" over all 1024 region combinations, the notes that
// depend on that grouping, the unchanged 10-minus-regions arithmetic, and the region subLabels
// and info text. Any drift exits non-zero.
//
// NCBI requests identify the tool (tool=radulator-aspects-audit) and send no e-mail address.

import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { ASPECTSScore } from "../src/components/calculators/ASPECTSScore.jsx";

export const CALCULATOR_PATH = "src/components/calculators/ASPECTSScore.jsx";
const USER_AGENT = "Radulator-ASPECTS-region-source-audit/1";
const NCBI_TOOL = "radulator-aspects-audit";
export const FETCH_ATTEMPTS = 4;
const ATTEMPT_TIMEOUT_MS = 30_000;
const MAX_RETRY_DELAY_MS = 20_000;

const ARCHIVE_ORIGIN = "http://www.aspectsinstroke.com:80";

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
  pexman2001: Object.freeze({
    key: "pexman2001",
    role: "ASPECTS developers' methods paper (full text; Internet Archive capture of the PMC article page)",
    document:
      "Pexman JHW, Barber PA, Hill MD, et al. Use of the Alberta Stroke Program Early CT Score (ASPECTS) for assessing CT scans in patients with acute stroke. AJNR Am J Neuroradiol. 2001;22(8):1534-1542",
    pmid: "11559501",
    pmcid: "PMC7974585",
    original_url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7974585/",
    memento_datetime: "Sun, 02 Feb 2025 05:57:43 GMT",
    url: "https://web.archive.org/web/20250202055743id_/https://pmc.ncbi.nlm.nih.gov/articles/PMC7974585/",
    media_type: "text/html",
    pin: "raw-bytes",
    bytes: 143_520,
    sha256: "1167a826eb0079f360f2cafdbe0040fb39a9bdaa0e6ca92dc54a5132d5b569d7",
    archive_sha1_base32: "6CAKOH2THRQX4SAUN7IR3CMVB4IQDWUJ",
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
  developers_what_is: Object.freeze({
    key: "developers_what_is",
    role: "ASPECTS developers' site, 'What is ASPECTS' page (Internet Archive capture)",
    document: "aspectsinstroke.com (Foothills Medical Centre, University of Calgary), What is ASPECTS",
    original_url: `${ARCHIVE_ORIGIN}/aspects/what-is-aspects/`,
    memento_datetime: "Tue, 06 Dec 2016 11:53:58 GMT",
    url: `https://web.archive.org/web/20161206115358id_/${ARCHIVE_ORIGIN}/aspects/what-is-aspects/`,
    media_type: "text/html",
    pin: "raw-bytes",
    bytes: 12_396,
    sha256: "0fa6d381b95c3eb6d61f082c2c1e5821d3b5b00fcc461fa3666359adebb5a03e",
    archive_sha1_base32: "IEC2BKTXILM7IDIMIOYD3C7XG3CJKYBZ",
    page_title: "Alberta Stroke Program Early CT score (ASPECTS) - What is ASPECTS",
  }),
  developers_insula_basal_ganglia: Object.freeze({
    key: "developers_insula_basal_ganglia",
    role: "ASPECTS developers' site, training page 'Insula and basal ganglia' (Internet Archive capture)",
    document: "aspectsinstroke.com (Foothills Medical Centre, University of Calgary), Training: Insula and basal ganglia",
    original_url: `${ARCHIVE_ORIGIN}/training-for-aspects/optimal-window-settings222/`,
    memento_datetime: "Thu, 29 Dec 2016 22:22:03 GMT",
    url: `https://web.archive.org/web/20161229222203id_/${ARCHIVE_ORIGIN}/training-for-aspects/optimal-window-settings222/`,
    media_type: "text/html",
    pin: "raw-bytes",
    bytes: 11_387,
    sha256: "2ab9a266bbfd2dfbfcb1b8f60bded61ca9befa29393c1d6a768a0c264f5befe5",
    archive_sha1_base32: "YUXRQZ452UCGIVYWN5VJRD43FQHOU6A2",
    selected_menu_item: "Insula and basal ganglia",
  }),
  developers_m1_m6: Object.freeze({
    key: "developers_m1_m6",
    role: "ASPECTS developers' site, training page 'M1-M6 regions' (Internet Archive capture)",
    document: "aspectsinstroke.com (Foothills Medical Centre, University of Calgary), Training: M1-M6 regions",
    original_url: `${ARCHIVE_ORIGIN}/training-for-aspects/optimal-window-settings227/`,
    memento_datetime: "Fri, 30 Dec 2016 02:52:53 GMT",
    url: `https://web.archive.org/web/20161230025253id_/${ARCHIVE_ORIGIN}/training-for-aspects/optimal-window-settings227/`,
    media_type: "text/html",
    pin: "raw-bytes",
    bytes: 10_930,
    sha256: "c2f480242b0061b6a0c122496dbdf45cf6c0a416ffddec1a7f7977a87fd657fb",
    archive_sha1_base32: "YSZ7GX7XZFGGGMWDXBIO7FZHYDQFDDB5",
    page_title: "Alberta Stroke Program Early CT score (ASPECTS) - M1-M6 regions",
    selected_menu_item: "M1-M6 regions",
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
      id: "pexman2001-methods-two-cuts-one-point-per-region",
      source: "pexman2001",
      block: "The interpreters used the ASPECTS",
      locator: "Methods, paragraph that cites Fig 1",
      paraphrase:
        "ASPECTS is read on two standard axial cuts, one through the thalamus and basal ganglia and one just above the ganglionic structures; the MCA territory is worth 10 points and one point comes off for early ischemic change in each defined region.",
      spans: [
        {
          from: "The ASPECTS was determined from two",
          to: "for each of the defined regions.",
          length: 494,
          sha256: "6ce958a5911d5a9479eaa9c45c77c012c61bfb2dd21ecafdc8939fdf42fa822f",
        },
      ],
    },
    {
      id: "pexman2001-fig1-region-definitions",
      source: "pexman2001",
      block: "A and B, Right hemisphere",
      locator: "Fig 1 legend (ASPECTS study form)",
      paraphrase:
        "Study-form legend: the letters stand for caudate head (C), lentiform nucleus (L), internal capsule (IC) and insular ribbon (I); M1, M2 and M3 are the front, lateral (beside the insula) and back parts of the MCA cortex; M4 to M6 are the matching front, lateral and back MCA territories roughly 2 cm higher, above the basal ganglia.",
      spans: [
        {
          from: "C = caudate head;",
          to: "rostral to basal ganglia.",
          length: 379,
          sha256: "2e95916967d22cee28ea0d2130fbfc9684c20bd75d073fbd264ae65dfb5b4bba",
        },
      ],
    },
    {
      id: "pexman2001-results-insular-ribbon",
      source: "pexman2001",
      block: "In the lentiform, caudate, and",
      locator: "Results, How Different Physicians Interpreted ASPECTS, first paragraph",
      paraphrase:
        "Insular ribbon hypoattenuation means loss of gray/white differentiation of the insular cortex; its anterior or posterior half can be lost on its own.",
      spans: [
        {
          from: "Hypoattenuation of the insular ribbon was",
          to: "may be lost independently.",
          length: 280,
          sha256: "dcdf78866e77297b2231c64533dc39bdd9a4eed90b6dcc739e9a29ed07fbc499",
        },
      ],
    },
    {
      id: "pexman2001-results-m-areas-geometric",
      source: "pexman2001",
      block: "In the M1 to M6 territories,",
      locator: "Results, How Different Physicians Interpreted ASPECTS, M-area paragraph",
      paraphrase:
        "The developers stressed that M5 reaches medially to the margin of the lateral ventricle and that the M areas are geometric rather than anatomic areas.",
      spans: [
        {
          from: "It was stressed that the M5",
          to: "not anatomic areas.",
          length: 145,
          sha256: "be694873d12f98d72ed6c585971f4ba004e8aae4963feeab4045d9d3292be3a6",
        },
      ],
    },
    {
      id: "pexman2001-results-m1-frontal-operculum",
      source: "pexman2001",
      block: "In the M1 to M6 territories,",
      locator: "Results, How Different Physicians Interpreted ASPECTS, M-area paragraph",
      paraphrase:
        "All six developers put M1 ahead of where the sylvian fissure begins anteriorly, and all counted the frontal operculum as part of M1.",
      spans: [
        {
          from: "All observers regarded M1 as anterior",
          to: "included the frontal operculum.",
          length: 116,
          sha256: "c3fc285ddd730bd33f095f1b4cbce00ac609424fb717c5d26fb5e2e1101781f4",
        },
      ],
    },
    {
      id: "pexman2001-results-m2-boundaries",
      source: "pexman2001",
      block: "In the M1 to M6 territories,",
      locator: "Results, How Different Physicians Interpreted ASPECTS, M-area paragraph",
      paraphrase:
        "All six developers started M2 at the front tip of the temporal lobe; they disagreed on where its slanted back edge lies.",
      spans: [
        {
          from: "All observers identified the anterior end",
          to: "oblique posterior boundary varied.",
          length: 137,
          sha256: "1fea8ceb03ab7347e74d4b8646d9d79d3dcf293295dee978889047ebb0911707",
        },
      ],
    },
    {
      id: "pexman2001-results-internal-capsule-split",
      source: "pexman2001",
      block: "The internal capsule was scored",
      locator: "Results, How Different Physicians Interpreted ASPECTS, internal capsule paragraph",
      paraphrase:
        "The six developers scored the internal capsule two ways: three looked only at the posterior limb, and three looked at both limbs and took off a point if any part was involved.",
      spans: [
        {
          from: "The internal capsule was scored variably.",
          to: "any portion of it was affected.",
          length: 228,
          sha256: "9300a10d7a5ca35955e2334a3244569522638ccf15b7170f754a1cf603786718",
        },
      ],
    },
    {
      id: "pexman2001-discussion-ganglionic-divisions",
      source: "pexman2001",
      block: "The ASPECTS system was used",
      locator: "Discussion, paragraph on CT baselines",
      paraphrase:
        "On the ganglionic cut the developers always drew the divisions between M areas from the positions of the two ends of the sylvian fissure.",
      spans: [
        {
          from: "On the ganglionic level, the anatomic",
          to: "ends of the sylvian fissure.",
          length: 144,
          sha256: "2c7354c6d6715be5e26c6318ff3c3e086009b7c000c2e2ba1cd429299fd40666",
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
        "The reprinted template uses the same ten regions: caudate, lentiform nucleus and internal capsule; the insular ribbon; M1 to M3 as the front, lateral (beside the insula) and back MCA cortex on the ganglionic cut; and M4 to M6 as the front, lateral and back MCA territories directly above them, higher than the basal ganglia.",
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
    {
      id: "developers-what-is-two-levels",
      source: "developers_what_is",
      block: "ASPECTS is determined from evaluation",
      locator: "What is ASPECTS, 'How to compute ASPECTS', first item",
      paraphrase:
        "Scoring uses two standard levels: a lower one through the thalamus, basal ganglia and caudate, and a higher, supraganglionic one through the corona radiata and centrum semiovale.",
      spans: [
        {
          from: "ASPECTS is determined from evaluation of",
          to: "corona radiata and centrum semiovale",
          length: 259,
          sha256: "a88a0232b65debe56ee0f91e9485687852b43069bb11e0e245394077ea3fd57f",
        },
      ],
    },
    {
      id: "developers-what-is-one-point-per-region",
      source: "developers_what_is",
      block: "To compute the ASPECTS, 1",
      locator: "What is ASPECTS, 'How to compute ASPECTS', third item",
      paraphrase: "One point is subtracted from 10 for early ischemic change in each defined region.",
      spans: [
        {
          from: "To compute the ASPECTS, 1 point",
          to: "each of the defined regions.",
          length: 128,
          sha256: "551b459d7e6ca0a957e9c19a4f33d90eb6f2dcee4beddff4d29cdb1e1ffa9f45",
        },
      ],
    },
    {
      id: "developers-what-is-region-definitions",
      source: "developers_what_is",
      block: "Axial NCCT images showing the",
      locator: "What is ASPECTS, template legend",
      paraphrase:
        "The developers' own page gives the same ten-region legend as the reprinted template, with M4 to M6 directly above M1 to M3 and higher than the basal ganglia.",
      spans: [
        {
          from: "C- Caudate, I- Insularribbon,",
          to: "rostral to basalganglia.",
          length: 298,
          sha256: "1341ea4b26b25d47574920facb07bd29671cd6c69512ab7b79224485592089bf",
        },
      ],
    },
    {
      id: "developers-what-is-subcortical-three-points",
      source: "developers_what_is",
      block: "Axial NCCT images showing the",
      locator: "What is ASPECTS, template legend",
      paraphrase: "Subcortical structures (caudate, lentiform nucleus, internal capsule) carry 3 points.",
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
      id: "developers-what-is-cortex-seven-points",
      source: "developers_what_is",
      block: "Axial NCCT images showing the",
      locator: "What is ASPECTS, template legend",
      paraphrase: "MCA cortex (insular cortex and M1 to M6) carries 7 points.",
      spans: [
        {
          from: "MCA cortex is allotted 7 points",
          to: "M5and M6)",
          length: 74,
          sha256: "fd8ba93ed8c400aa3e1ce61eda857cae9981cf176216213e3681b3365a3a54fc",
        },
      ],
    },
    {
      id: "developers-insula-bg-insular-ribbon",
      source: "developers_insula_basal_ganglia",
      block: "Hypoattenuation of the insular ribbon",
      locator: "Training, Insula and basal ganglia, 'Insular cortex' section",
      paraphrase:
        "Insular ribbon hypoattenuation is loss of gray/white differentiation of the insular cortex; either half can be lost on its own.",
      spans: [
        {
          from: "Hypoattenuation of the insular ribbon is",
          to: "may be lost independently.",
          length: 214,
          sha256: "564331d2e51274aa4db5d22d1eac2410754d2d23c6f95d12d8a8d3a758654a43",
        },
      ],
    },
    {
      id: "developers-insula-bg-caudate-both-levels",
      source: "developers_insula_basal_ganglia",
      block: "Obscuration or hypoattenuation of the",
      locator: "Training, Insula and basal ganglia, 'Basal ganglia' section",
      paraphrase:
        "The caudate nucleus is checked on both levels: its head on the ganglionic level and its body and tail on the supraganglionic level.",
      spans: [
        {
          from: "The caudate nucleus is assessed in",
          to: "body and tail of caudate).",
          length: 132,
          sha256: "61fb2e7a599f2bbd7e7f98dacebf6a3366ee951d7673ff2a3a60aa5f5a5d9cfb",
        },
      ],
    },
    {
      id: "developers-insula-bg-internal-capsule-posterior-limb",
      source: "developers_insula_basal_ganglia",
      block: "Internal capsular region is scored",
      locator: "Training, Insula and basal ganglia, 'Internal capsule' section",
      paraphrase:
        "The developers count the internal capsule region as involved when its posterior limb is hypodense; they find anterior-limb hypodensity hard to score on non-contrast CT.",
      spans: [
        {
          from: "Internal capsular region is scored 0",
          to: "involvement of internal capsular region.",
          length: 237,
          sha256: "548826ea3a4d0ed4a817cdabc6d16851da8ec321fe10d84576a496eea34f3dde",
        },
      ],
    },
    {
      id: "developers-m1-m6-ganglionic-adjudication",
      source: "developers_m1_m6",
      block: "Any ischemic lesion on axial",
      locator: "Training, M1-M6 regions, 'M1-3 region' section",
      paraphrase:
        "A lesion on cuts at or below the caudate head is assigned to a ganglionic region (M1 to M3, insula, caudate, lentiform nucleus or internal capsule).",
      spans: [
        {
          from: "Any ischemic lesion on axial CT",
          to: "lentiform nucleus and internal capsule)",
          length: 204,
          sha256: "079d3b6025afc5419561e9352d2640af49e5a9f1a0ae23549e5d1c83552fb6fd",
        },
      ],
    },
    {
      id: "developers-m1-m6-supraganglionic-adjudication",
      source: "developers_m1_m6",
      block: "Ischemic lesions above the level",
      locator: "Training, M1-M6 regions, 'M4-6 region' section",
      paraphrase: "A lesion higher than the caudate head is assigned to a supraganglionic region (M4 to M6).",
      spans: [
        {
          from: "Ischemic lesions above the level of",
          to: "ASPECTS region (M4-M6)",
          length: 116,
          sha256: "87a688d9bf54efc2a59054489572bfbc95ffbefea74ab2c7e9b6b448b038d135",
        },
      ],
    },
  ].map((statement) => Object.freeze(statement)),
);

// Runtime text the audit binds to the statements above.
export const RUNTIME_SUBLABELS = Object.freeze({
  caudate: "Early ischemic change in caudate nucleus",
  lentiform: "Putamen and globus pallidus",
  internal_capsule: "Posterior limb of internal capsule",
  insular: "Insular cortex / loss of insular ribbon",
  m1: "Frontal operculum at ganglionic level",
  m2: "Anterior temporal lobe, lateral to insular ribbon",
  m3: "MCA cortex behind M2 at ganglionic level",
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

export const CLAIM_BINDINGS = Object.freeze(
  [
    {
      claim_id: "breakdown-subcortical-is-c-l-ic",
      runtime: "Regional Breakdown counts C, L and IC as subcortical, out of 3",
      source_statement_ids: ["dubey2013-fig1-subcortical-three-points", "developers-what-is-subcortical-three-points"],
    },
    {
      claim_id: "breakdown-insula-is-ganglionic-cortex",
      runtime: "Regional Breakdown counts I with M1-M3 as ganglionic cortex (out of 4) and M4-M6 as supraganglionic (out of 3)",
      source_statement_ids: [
        "dubey2013-fig1-cortex-seven-points",
        "developers-what-is-cortex-seven-points",
        "developers-m1-m6-ganglionic-adjudication",
        "developers-m1-m6-supraganglionic-adjudication",
      ],
    },
    {
      claim_id: "subcortical-note-uses-corrected-grouping",
      runtime: "the predominantly-subcortical note needs C, L and IC with no cortical region (I, M1-M6)",
      source_statement_ids: ["dubey2013-fig1-subcortical-three-points", "dubey2013-fig1-cortex-seven-points"],
    },
    {
      claim_id: "m1-m6-note-names-its-trigger",
      runtime: "the collateral note fires on M1-M6 and names M1-M6 rather than all MCA cortex",
      source_statement_ids: ["dubey2013-fig1-cortex-seven-points", "developers-what-is-cortex-seven-points"],
    },
    {
      claim_id: "score-is-ten-minus-regions",
      runtime: "ten region checkboxes; ASPECTS = 10 - affected regions for every combination",
      source_statement_ids: [
        "barber2000-abstract-ten-regions",
        "pexman2001-methods-two-cuts-one-point-per-region",
        "developers-what-is-one-point-per-region",
      ],
    },
    {
      claim_id: "two-levels-in-info-text",
      runtime: "info text lists C, L, IC, I, M1-M3 at the ganglionic level and M4-M6 at the supraganglionic level",
      source_statement_ids: [
        "developers-what-is-two-levels",
        "pexman2001-methods-two-cuts-one-point-per-region",
        "developers-m1-m6-ganglionic-adjudication",
        "developers-m1-m6-supraganglionic-adjudication",
      ],
    },
    {
      claim_id: "internal-capsule-posterior-limb",
      runtime: "IC subLabel and info line name the posterior limb",
      source_statement_ids: [
        "developers-insula-bg-internal-capsule-posterior-limb",
        "pexman2001-results-internal-capsule-split",
      ],
    },
    {
      claim_id: "m3-posterior-mca-cortex-behind-m2",
      runtime: "M3 subLabel and info line: posterior MCA cortex behind M2, no lobe named",
      source_statement_ids: [
        "pexman2001-fig1-region-definitions",
        "dubey2013-fig1-region-definitions",
        "developers-what-is-region-definitions",
        "pexman2001-results-m2-boundaries",
        "pexman2001-discussion-ganglionic-divisions",
        "pexman2001-results-m-areas-geometric",
      ],
    },
    {
      claim_id: "m1-frontal-operculum",
      runtime: "M1 subLabel and info line: frontal operculum, anterior MCA cortex",
      source_statement_ids: ["pexman2001-results-m1-frontal-operculum", "pexman2001-fig1-region-definitions"],
    },
    {
      claim_id: "m2-anterior-temporal-lateral-to-insula",
      runtime: "M2 subLabel and info line: anterior temporal lobe, lateral to the insular ribbon",
      source_statement_ids: [
        "pexman2001-results-m2-boundaries",
        "pexman2001-fig1-region-definitions",
        "dubey2013-fig1-region-definitions",
      ],
    },
    {
      claim_id: "m4-m6-immediately-superior",
      runtime: "M4-M6 subLabels and info lines: immediately superior to M1-M3",
      source_statement_ids: [
        "dubey2013-fig1-region-definitions",
        "developers-what-is-region-definitions",
        "pexman2001-fig1-region-definitions",
      ],
    },
    {
      claim_id: "insular-ribbon-definition",
      runtime: "insular subLabel and info line: insular cortex, loss of the insular ribbon",
      source_statement_ids: ["pexman2001-results-insular-ribbon", "developers-insula-bg-insular-ribbon"],
    },
    {
      claim_id: "caudate-region",
      runtime: "C label (caudate head) and subLabel (caudate nucleus)",
      source_statement_ids: ["pexman2001-fig1-region-definitions", "developers-insula-bg-caudate-both-levels"],
    },
  ].map((binding) => Object.freeze(binding)),
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
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-")
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

// ---- Pexman 2001: PMC article page ------------------------------------------------------------

export function pmcArticleBlocks(html) {
  const start = html.search(/<section class="body main-article-body">/);
  assert.ok(start >= 0, "pexman2001: main article body is missing");
  const end = html.slice(start).search(/<section\b[^>]*\bclass="fn-group"/);
  assert.ok(end > 0, "pexman2001: Footnotes section (end of the article body) is missing");
  const region = html.slice(start, start + end);
  return [...region.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((match) => markupText(match[1])).filter(Boolean);
}

function htmlMeta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return decodeEntities(new RegExp(`<meta name="${escaped}" content="([^"]*)"`).exec(html)?.[1] ?? "");
}

// ---- Dubey 2013: PMC XML Figure 1 caption -----------------------------------------------------

export function dubeyFigure1Caption(xml) {
  const figures = [...xml.matchAll(/<fig id="fig1"[\s\S]*?<\/fig>/g)];
  assert.equal(figures.length, 1, "dubey2013: expected exactly one Figure 1");
  const caption = /<caption>([\s\S]*?)<\/caption>/.exec(figures[0][0])?.[1];
  assert.ok(caption, "dubey2013: Figure 1 caption is missing");
  return markupText(caption);
}

// ---- Developers' site captures ----------------------------------------------------------------

export function archivedContentBlocks(html, key) {
  const start = html.indexOf('<div class="content">');
  assert.ok(start >= 0, `${key}: content column is missing`);
  assert.equal(html.indexOf('<div class="content">', start + 1), -1, `${key}: more than one content column`);
  const end = html.indexOf('<div class="footer">', start);
  assert.ok(end > start, `${key}: footer (end of the content column) is missing`);
  return [...html.slice(start, end).matchAll(/<(h1|li|p)\b[^>]*>([\s\S]*?)<\/\1>/g)]
    .map((match) => markupText(match[2]))
    .filter(Boolean);
}

// ---- Retrieval --------------------------------------------------------------------------------

export function retryDelayMs(response, attempt, now = Date.now()) {
  const retryAfter = response?.headers?.get?.("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.min(Math.max(seconds * 1_000, 0), MAX_RETRY_DELAY_MS);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.min(Math.max(date - now, 0), MAX_RETRY_DELAY_MS);
  }
  return Math.min(1_000 * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS);
}

export function isRetryableStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

// Retries only transport failures: network errors, timeouts, body-read failures and HTTP 408,
// 429 and 5xx. Every 200 response is checked against all of its source's pins (final URL,
// media type, archive capture, byte length, SHA-256) before it is returned, so nothing is
// parsed unverified. A 200 that misses any pin is a changed source, not a transient failure:
// it fails at once and is never retried.
export async function retrieve(source, { fetchImpl = fetch, sleep = delay, attempts = FETCH_ATTEMPTS } = {}) {
  let lastFailure = "unknown retrieval failure";
  let made = 0;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    made = attempt;
    let response;
    try {
      response = await fetchImpl(source.url, {
        headers: { "user-agent": USER_AGENT },
        redirect: "follow",
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      });
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    if (response?.ok) {
      let bytes;
      try {
        bytes = Buffer.from(await response.arrayBuffer());
      } catch (error) {
        lastFailure = `body read failed (${error instanceof Error ? error.message : String(error)})`;
      }
      if (bytes) {
        const artifact = {
          bytes,
          finalUrl: response.url,
          contentType: response.headers.get("content-type") ?? "",
          mementoDatetime: response.headers.get("memento-datetime"),
          link: response.headers.get("link"),
          attempts: attempt,
        };
        verifyPinnedArtifact(source, artifact);
        return artifact;
      }
    } else if (response) {
      lastFailure = `HTTP ${response.status}`;
      await response.body?.cancel?.();
      if (!isRetryableStatus(response.status)) break;
    }
    if (attempt < attempts) await sleep(retryDelayMs(response, attempt));
  }
  assert.fail(`${source.key}: primary-source retrieval failed after ${made} attempt(s) (${lastFailure})`);
}

// ---- Verification -----------------------------------------------------------------------------

// RFC 4648 base32 of the SHA-1 digest: the form of the Internet Archive CDX "digest" field.
export function sha1Base32(bytes) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let value = 0;
  let bits = 0;
  let out = "";
  for (const byte of createHash("sha1").update(bytes).digest()) {
    value = ((value << 8) | byte) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return bits > 0 ? out + alphabet[(value << (5 - bits)) & 31] : out;
}

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
  if (source.memento_datetime) {
    assert.equal(retrieved.mementoDatetime, source.memento_datetime, `${source.key}: archive capture time drifted`);
    const original = /<([^>]+)>;\s*rel="original"/.exec(retrieved.link ?? "")?.[1];
    assert.ok(original, `${source.key}: archive response lacks its original URL`);
    assert.equal(
      original.replace(/\/$/, ""),
      source.original_url.replace(/\/$/, ""),
      `${source.key}: archive capture is not of the pinned page`,
    );
  }
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
  if (source.archive_sha1_base32) {
    assert.equal(
      sha1Base32(bytes),
      source.archive_sha1_base32,
      `${source.key}: bytes differ from the Internet Archive CDX digest of the capture`,
    );
  }
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

function singleBlock(blocks, prefix, label) {
  const matches = blocks.filter((block) => block.startsWith(prefix));
  assert.equal(matches.length, 1, `${label}: expected exactly one block starting ${JSON.stringify(prefix)}`);
  return matches[0];
}

// Locates every statement's block in its source text. Returns Map(statementId -> block text).
export function locateBlocks(texts) {
  const located = new Map();
  for (const statement of STATEMENTS) {
    const label = `${statement.id} (${statement.locator})`;
    let block;
    if (statement.source === "barber2000") {
      block = texts.barber2000.sections.get(statement.block);
      assert.ok(block, `${label}: ${statement.block} is missing`);
    } else if (statement.source === "dubey2013") {
      block = texts.dubey2013.caption;
    } else {
      block = singleBlock(texts[statement.source].blocks, statement.block, label);
    }
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

  // Pexman 2001: PMC article page capture, citation metadata, then the article body.
  const pexmanHtml = retrieved.pexman2001.bytes.toString("utf8");
  assert.equal(htmlMeta(pexmanHtml, "citation_pmid"), sources.pexman2001.pmid, "pexman2001: PMID drifted");
  assert.equal(
    htmlMeta(pexmanHtml, "citation_title"),
    "Use of the Alberta Stroke Program Early CT Score (ASPECTS) for Assessing CT Scans in Patients with Acute Stroke",
    "pexman2001: title drifted",
  );
  assert.equal(htmlMeta(pexmanHtml, "citation_volume"), "22", "pexman2001: volume drifted");
  assert.equal(htmlMeta(pexmanHtml, "citation_issue"), "8", "pexman2001: issue drifted");
  assert.equal(htmlMeta(pexmanHtml, "citation_firstpage"), "1534", "pexman2001: first page drifted");
  assert.match(
    pexmanHtml,
    new RegExp(`<link rel="canonical" href="https://pmc\\.ncbi\\.nlm\\.nih\\.gov/articles/${sources.pexman2001.pmcid}/">`),
    "pexman2001: canonical PMC URL drifted",
  );
  texts.pexman2001 = { blocks: pmcArticleBlocks(pexmanHtml) };

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

  // Developers' site captures: page identity, then the content column.
  for (const key of ["developers_what_is", "developers_insula_basal_ganglia", "developers_m1_m6"]) {
    const source = sources[key];
    const html = retrieved[key].bytes.toString("utf8");
    if (source.page_title) {
      assert.ok(html.includes(`<title>${source.page_title}</title>`), `${key}: page title drifted`);
    }
    if (source.selected_menu_item) {
      assert.match(
        html,
        new RegExp(`class="selected">${source.selected_menu_item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</a>`),
        `${key}: the capture is not the ${source.selected_menu_item} page`,
      );
    }
    texts[key] = { blocks: archivedContentBlocks(html, key) };
  }

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

export function verifyRuntime(calculator = ASPECTSScore, calculatorSource = null) {
  const bindings = {};
  const checkboxes = calculator.fields.filter((field) => field.type === "checkbox");
  assert.deepEqual(
    checkboxes.map((field) => field.id),
    REGION_IDS,
    "runtime must offer exactly the ten ASPECTS region checkboxes",
  );
  const subLabels = Object.fromEntries(checkboxes.map((field) => [field.id, field.subLabel]));
  assert.deepEqual(subLabels, { ...RUNTIME_SUBLABELS }, "runtime region subLabels drifted from the audited wording");
  for (const field of checkboxes) {
    // App guardrail: FieldLabel renders "label (subLabel)".
    assert.doesNotMatch(field.subLabel, /[()]/, `${field.id}: subLabel would render nested parentheses`);
  }
  assert.equal(
    checkboxes.find((field) => field.id === "caudate").label,
    "C - Caudate Head",
    "caudate label drifted",
  );

  const info = calculator.info.text;
  const ganglionic = infoSection(info, "GANGLIONIC LEVEL", "SUPRAGANGLIONIC LEVEL");
  const supraganglionic = infoSection(info, "SUPRAGANGLIONIC LEVEL", "SCORING:");
  assert.deepEqual(ganglionic, [...RUNTIME_INFO_GANGLIONIC], "info text ganglionic-level region list drifted");
  assert.deepEqual(supraganglionic, [...RUNTIME_INFO_SUPRAGANGLIONIC], "info text supraganglionic region list drifted");
  assert.match(info, /subtract 1 point for each region/, "info text must state the one-point-per-region rule");
  assert.doesNotMatch(info, /temporal lobe \(posterior|Posterior temporal lobe/i, "info text names a lobe for M3");

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

  // Barber 2000 is the calculator's primary reference and info link.
  const doiUrl = `https://doi.org/${SOURCES.barber2000.doi}`.toLowerCase();
  assert.equal(calculator.refs[0].u.toLowerCase(), doiUrl, "first reference must be Barber 2000 by DOI");
  assert.equal(calculator.info.link.url.toLowerCase(), doiUrl, "info link must be Barber 2000 by DOI");
  assert.ok(
    calculator.refs.some((ref) => ref.u === `https://pubmed.ncbi.nlm.nih.gov/${SOURCES.pexman2001.pmid}/`),
    "calculator must cite Pexman 2001 by PMID",
  );

  if (calculatorSource !== null) {
    for (const removed of ["Posterior temporal lobe", "Subcortical: ${subcorticalAffected}/4", "(-1 point)"]) {
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
  bindings["score-is-ten-minus-regions"] = { region_checkboxes: REGION_IDS.length, region_combinations_checked: cells };
  bindings["two-levels-in-info-text"] = {
    ganglionic_level: ganglionic.length,
    supraganglionic_level: supraganglionic.length,
  };
  for (const [claim, ids, lines] of [
    ["internal-capsule-posterior-limb", ["internal_capsule"], ["• IC - Internal capsule (posterior limb)"]],
    ["m3-posterior-mca-cortex-behind-m2", ["m3"], ["• M3 - Posterior MCA cortex (behind M2)"]],
    ["m1-frontal-operculum", ["m1"], ["• M1 - Frontal operculum (anterior MCA cortex)"]],
    ["m2-anterior-temporal-lateral-to-insula", ["m2"], ["• M2 - Anterior temporal lobe (lateral to insular ribbon)"]],
    ["m4-m6-immediately-superior", ["m4", "m5", "m6"], [...RUNTIME_INFO_SUPRAGANGLIONIC]],
    ["insular-ribbon-definition", ["insular"], ["• I - Insular ribbon (insular cortex)"]],
    ["caudate-region", ["caudate"], ["• C - Caudate head"]],
  ]) {
    bindings[claim] = {
      sublabels: Object.fromEntries(ids.map((id) => [id, subLabels[id]])),
      info_lines: lines,
    };
  }
  return { bindings, cells };
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

  return {
    schema: "radulator-aspects-region-source-audit/v1",
    calculator_id: calculator.id,
    calculator_path: CALCULATOR_PATH,
    sources: Object.values(SOURCES).map((source) => ({
      key: source.key,
      role: source.role,
      document: source.document,
      ...(source.pmid ? { pmid: source.pmid } : {}),
      ...(source.pmcid ? { pmcid: source.pmcid } : {}),
      ...(source.doi ? { doi: source.doi } : {}),
      ...(source.license ? { license: source.license } : {}),
      ...(source.original_url
        ? {
            original_url: source.original_url,
            memento_datetime: source.memento_datetime,
            archive_sha1_base32: source.archive_sha1_base32,
          }
        : {}),
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
      source_statement_ids: [...binding.source_statement_ids],
      runtime: runtime.bindings[binding.claim_id],
    })),
    runtime: {
      region_sublabels: { ...RUNTIME_SUBLABELS },
      region_combinations_checked: runtime.cells,
      breakdown_example_all_regions: breakdownText(3, 4, 3),
    },
    app_guardrails: {
      provenance: "radulator-rendering-guardrail",
      publication_derived: false,
      checks: ["region subLabels contain no parentheses because FieldLabel renders label (subLabel)"],
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

export async function retrieveAll({ fetchImpl = fetch, sleep = delay } = {}) {
  const entries = await Promise.all(
    Object.values(SOURCES).map(async (source) => [source.key, await retrieve(source, { fetchImpl, sleep })]),
  );
  return Object.fromEntries(entries);
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
        JSON.stringify({
          finalUrl: artifact.finalUrl,
          contentType: artifact.contentType,
          mementoDatetime: artifact.mementoDatetime,
          link: artifact.link,
        }),
      );
    }
  }
  const audit = buildAudit(retrieved, { calculatorSource: readFileSync(CALCULATOR_PATH, "utf8") });

  if (argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(audit)}\n`);
  } else {
    console.log(
      `ASPECTS region primary-source audit passed: ${audit.sources.length} pinned artifacts, ${audit.source_statements.length} source statements, ${audit.claim_bindings.length} runtime claim bindings and ${audit.runtime.region_combinations_checked} region combinations.`,
    );
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  await main(process.argv.slice(2));
}
