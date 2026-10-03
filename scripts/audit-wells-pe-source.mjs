#!/usr/bin/env node
// Wells PE: exact-head primary-source audit.
//
// Binds the Wells PE calculator's scoring, and the cohort figures it shows, to three PubMed records:
//   - Wells PS et al., Thromb Haemost 2000;83(3):416-420 (PMID 10744147): the seven items and their
//     weights, the three-tier cut points, the two-tier split, the PE rate in PE-unlikely patients and the
//     PE rate after a negative SimpliRED D-dimer;
//   - Wells PS et al., Ann Intern Med 2001;135(2):98-107 (PMID 11453709,
//     DOI 10.7326/0003-4819-135-2-200107170-00010): the emergency department cohort and its PE rate by
//     pretest-probability tier;
//   - van Belle A et al. (Christopher Study), JAMA 2006;295(2):172-179 (PMID 16403929,
//     DOI 10.1001/jama.295.2.172): the dichotomized-rule pathway and the 3-month VTE rate in untreated
//     PE-unlikely patients with a normal D-dimer.
//
// Each record is retrieved as PubMed's plain-text abstract (efetch rettype=abstract, retmode=text) and
// verified as bytes before parsing: final URL, media type, exact byte length and SHA-256. Each statement
// is also pinned by the SHA-256 of the exact normalized span between two markers of at most six words.
// No source prose is committed. NICE NG158, the source of the criterion wording, is deliberately not
// fetched here (outages and byte-changing re-renders); see docs/evidence/wells-pe-wording.md.
//
// Requests go one at a time through the shared NCBI helper (scripts/lib/ncbi-fetch.mjs): its request
// spacing across every audit in the run, its fetch log, and its retries for transport failures only.
// Redirects are refused, so the audit never contacts another host.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fetchPinned } from "./lib/ncbi-fetch.mjs";

const EFETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";
const efetchUrl = (pmid) => `${EFETCH}?db=pubmed&id=${pmid}&rettype=abstract&retmode=text&tool=radulator-wells-audit`;

export const WELLS_2000 = "10744147";
export const WELLS_2001 = "11453709";
export const CHRISTOPHER = "16403929";

// One plain-text abstract per record, pinned by its exact bytes and its abstract layout.
export const SOURCES = Object.freeze({
  [WELLS_2000]: Object.freeze({
    url: efetchUrl(WELLS_2000),
    doi: "", // PubMed carries no DOI for this record.
    year: "2000",
    sections: Object.freeze([""]),
    bytes: 3104,
    sha256: "6a5ba4c054a1c74315f88a2bbd1fbeabbc599db49c70def9f1c7b8be36c64de8",
  }),
  [WELLS_2001]: Object.freeze({
    url: efetchUrl(WELLS_2001),
    doi: "10.7326/0003-4819-135-2-200107170-00010",
    year: "2001",
    sections: Object.freeze([
      "BACKGROUND",
      "OBJECTIVE",
      "DESIGN",
      "SETTING",
      "PATIENTS",
      "INTERVENTIONS",
      "MEASUREMENTS",
      "RESULTS",
      "CONCLUSION",
    ]),
    bytes: 3848,
    sha256: "2ad680b73da4d69e2bef5b05b20040cb92a19d903105e54c6ed0d9db4a4c0af8",
  }),
  [CHRISTOPHER]: Object.freeze({
    url: efetchUrl(CHRISTOPHER),
    doi: "10.1001/jama.295.2.172",
    year: "2006",
    sections: Object.freeze([
      "CONTEXT",
      "OBJECTIVE",
      "DESIGN, SETTING, AND PATIENTS",
      "INTERVENTIONS",
      "MAIN OUTCOME MEASURE",
      "RESULTS",
      "CONCLUSIONS",
    ]),
    bytes: 3234,
    sha256: "92919cce91f7e5b447723f84177f9ad496c0b026374cb8444c3e00cb781c0689",
  }),
});
export const SOURCE_HOST = "eutils.ncbi.nlm.nih.gov";
export const SOURCE_PATH = "/entrez/eutils/efetch.fcgi";
export const SOURCE_MEDIA_TYPE = "text/plain";

// Each span runs from the first character of `from` through the last character of `to` (inclusive),
// inside the named abstract section ("" = the unlabelled abstract). Markers are at most six words;
// `from` must occur exactly once in that section. Paraphrases are our own words.
export const STATEMENTS = Object.freeze([
  Object.freeze({
    id: "wells2000-items",
    pmid: WELLS_2000,
    section: "",
    from: "The following seven variables and",
    to: "and malignancy (1.0).",
    length: 319,
    sha256: "b81b504b61d8dcaff5e7d41e91c51dff7501cc2438d74921fc41bcaa46691e1e",
    paraphrase:
      "Seven weighted items: signs of DVT 3.0; absence of an alternative diagnosis 3.0; heart rate above 100 1.5; immobilization or surgery within 4 weeks 1.5; prior DVT or PE 1.5; hemoptysis 1.0; cancer 1.0.",
  }),
  Object.freeze({
    id: "wells2000-three-tier",
    pmid: WELLS_2000,
    section: "",
    from: "Patients were considered low probability",
    to: "was over 6.0.",
    length: 136,
    sha256: "e1d6168f28e0fccb9cc15e52595b56631e00153637733f6a6b684e01d347c94f",
    paraphrase: "Low probability below 2.0 points, moderate 2.0 to 6.0, high above 6.0.",
  }),
  Object.freeze({
    id: "wells2000-two-tier",
    pmid: WELLS_2000,
    section: "",
    from: "Pulmonary embolism unlikely was assigned",
    to: "the score was >4.0.",
    length: 111,
    sha256: "1d9a55c16e581ac013b57141f15a03a7940f6a3375191deedd628842ef62e40c",
    paraphrase: "PE unlikely at 4.0 points or less, PE likely above 4.0.",
  }),
  Object.freeze({
    id: "wells2000-unlikely-rates",
    pmid: WELLS_2000,
    section: "",
    from: "7.8% of patients with scores",
    to: "in the validation set.",
    length: 219,
    sha256: "bc0fea1088ea6e8bfa230627b62f1c287f365a9674844d3dae8ca6668aba7023",
    paraphrase:
      "PE in 7.8% of PE-unlikely patients; after a negative D-dimer, 2.2% (95% CI 1.0-4.0%) for derivation and 1.7% for validation.",
  }),
  Object.freeze({
    id: "wells2001-setting",
    pmid: WELLS_2001,
    section: "SETTING",
    from: "Emergency departments at four",
    to: "in Canada.",
    length: 64,
    sha256: "df3674210cfd18b55b1700607b03b64cb4316505d3697b6b5a6ab591a4a1fcf9",
    paraphrase: "Four Canadian tertiary-care emergency departments.",
  }),
  Object.freeze({
    id: "wells2001-cohort",
    pmid: WELLS_2001,
    section: "PATIENTS",
    from: "930 consecutive patients with",
    to: "pulmonary embolism.",
    length: 59,
    sha256: "ca9c1a8fea674e2d876cc21019ac076211fb6a44e0015c7be61afff6e85dfcef",
    paraphrase: "930 consecutive patients with suspected PE.",
  }),
  Object.freeze({
    id: "wells2001-tier-rates",
    pmid: WELLS_2001,
    section: "RESULTS",
    from: "The pretest probability of pulmonary",
    to: "embolism), respectively.",
    length: 165,
    sha256: "9625c5d46401c0556a878c75f1d60de4ae6d2e843a05a1b9adb7a3b169f9fa50",
    paraphrase: "Low, moderate and high pretest probability: 527, 339 and 64 patients, with PE in 1.3%, 16.2% and 37.5%.",
  }),
  Object.freeze({
    id: "wells2001-low-negative",
    pmid: WELLS_2001,
    section: "RESULTS",
    from: "Of the 437 patients with",
    to: "99.1% to 100%).",
    length: 296,
    sha256: "9b0ca05075f2fdac15eb27d854da0b7fc1b78815759fb83bc722d8484f5c5e5e",
    paraphrase:
      "Low pretest probability with a negative D-dimer: 437 patients, 1 PE during follow-up, NPV 99.5% (CI 99.1-100%). This is the low tier, not the PE-unlikely group.",
  }),
  Object.freeze({
    id: "christopher-pathway",
    pmid: CHRISTOPHER,
    section: "INTERVENTIONS",
    from: "Patients were categorized as",
    to: "followed up for 3 months.",
    length: 522,
    sha256: "5399cb29cbeadb382bbcc61c762117268d506a46d7c813376c09005eaceaf0a4",
    paraphrase:
      "A dichotomized Wells rule: PE-unlikely patients had D-dimer testing and a normal result counted as excluded; everyone else had CT; excluded patients got no anticoagulation; 3-month follow-up.",
  }),
  Object.freeze({
    id: "christopher-outcome",
    pmid: CHRISTOPHER,
    section: "MAIN OUTCOME MEASURE",
    from: "Symptomatic or fatal venous thromboembolism",
    to: "3-month follow-up.",
    length: 75,
    sha256: "b68a2e2d472b285ea425c139e27fc3f4174be33f638be4a7daf6020d1fb42a22",
    paraphrase: "Outcome: symptomatic or fatal VTE within 3 months.",
  }),
  Object.freeze({
    id: "christopher-unlikely-normal",
    pmid: CHRISTOPHER,
    section: "RESULTS",
    from: "The combination of pulmonary embolism",
    to: "0.2%-1.1%]).",
    length: 262,
    sha256: "28e1ea5e97c7cb504a92d7ec0489d9b48397144b719f0b1c9b77de6889ffedfb",
    paraphrase:
      "PE unlikely with a normal D-dimer: 1057 patients (32.0%), 1028 left untreated, 5 later nonfatal VTE (0.5%, 95% CI 0.2-1.1%).",
  }),
]);

// Runtime items in rule order, and a keyword that the source item name and the runtime label share.
export const FIELD_ORDER = Object.freeze([
  "clinical_dvt",
  "alternative_less_likely",
  "heart_rate",
  "immobilization_surgery",
  "previous_pe_dvt",
  "hemoptysis",
  "malignancy",
]);
const ITEM_KEYS = Object.freeze([
  /\bDVT\b/,
  /alternative diagnosis/i,
  /heart rate >100/i,
  /immobilization or surgery/i,
  /previous\b.*\b(?:DVT|PE)\b/i,
  /hemoptysis/i,
  /malignancy/i,
]);

// Claims the calculator must not make: an NPV above 99% for PE-unlikely patients, or "excluded".
export const FORBIDDEN_CLAIMS = /NPV|>\s*99|effectively excluded|PE excluded/i;


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
// author information, linked-record notices, abstract and identifiers. Structured abstracts start
// each section on its own line with an upper-case label.
export function parseRecordText(text) {
  const blocks = text.split(/\n[ \t]*\n/).map((block) => block.trim()).filter(Boolean);
  const infoIndex = blocks.findIndex((block) => block.startsWith("Author information:"));
  assert.ok(infoIndex >= 3, "record lacks the author-information block");
  const notice = /^(Comment (in|on)|Erratum (in|for)|Update (in|of)|Retraction (in|of)|Expression of concern (in|for)|Republished (in|from)|Summary for patients in|Original report in|Collaborators:|Conflict of interest|Copyright|©|DOI:|PMID:|PMCID:)/;
  const abstractBlock = blocks.slice(infoIndex + 1).find((block) => !notice.test(block)) ?? "";
  const sections = [];
  let current = { label: "", lines: [] };
  for (const line of abstractBlock.split("\n")) {
    const heading = line.match(/^([A-Z][A-Z ,]*[A-Z]): (.*)$/);
    if (heading) {
      if (current.label || current.lines.length) sections.push(current);
      current = { label: heading[1], lines: [heading[2]] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.label || current.lines.length) sections.push(current);
  const citation = normalize(blocks[0] ?? "");
  return {
    citation,
    title: normalize(blocks[1] ?? ""),
    authors: normalize(blocks[2] ?? ""),
    sections: sections.map(({ label, lines }) => ({ label, text: normalize(lines.join(" ")) })),
    year: citation.match(/\. (\d{4}) [A-Z][a-z]{2}\b/)?.[1] ?? "",
    doi: text.match(/^DOI: (\S+)$/m)?.[1] ?? "",
    pmid: text.match(/^PMID: (\d+)/m)?.[1] ?? "",
  };
}

export function sectionText(record, section) {
  const hits = record.sections.filter((candidate) => candidate.label === section);
  assert.equal(hits.length, 1, `PMID ${record.pmid}: abstract section "${section}" must occur exactly once`);
  return hits[0].text;
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
  assert.deepEqual(
    record.sections.map((section) => section.label),
    [...source.sections],
    `PMID ${pmid}: abstract sections drifted`,
  );
  assert.ok(record.sections.every((section) => section.text.length > 0), `PMID ${pmid}: empty abstract section`);
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

function match(span, pattern, what) {
  const found = span.match(pattern);
  assert.ok(found, `${what} not found in the pinned span`);
  return found;
}

// Facts parsed from the pinned spans and records (names of items, numbers and years only).
export function extractFacts(records, spans) {
  const wells2000 = records[WELLS_2000];
  const wells2001 = records[WELLS_2001];
  const christopher = records[CHRISTOPHER];

  // Wells 2000: the seven items and weights, in rule order.
  const itemsSpan = spans["wells2000-items"];
  assert.match(itemsSpan, /\bseven\b/, "Wells 2000 must name seven items");
  const list = itemsSpan.slice(itemsSpan.indexOf(": ") + 2);
  const items = [...list.matchAll(/(?:^|, | and )([^,()]+?) \((\d+\.\d)\)/g)].map(([, name, weight]) => ({
    name: name.trim(),
    weight: Number(weight),
  }));
  assert.equal(items.length, 7, "Wells 2000 must list seven weighted items");

  // Wells 2000: three-tier cut points and the two-tier split.
  const tiers = spans["wells2000-three-tier"];
  const lowBelow = Number(match(tiers, /low probability if the score was <(\d+\.\d)/, "Wells 2000 low cut point")[1]);
  const [, moderateFrom, moderateTo] = match(tiers, /(\d+\.\d) to (\d+\.\d)/, "Wells 2000 moderate range");
  const highAbove = Number(match(tiers, /over (\d+\.\d)/, "Wells 2000 high cut point")[1]);
  assert.equal(Number(moderateFrom), lowBelow, "Wells 2000: moderate must start at the low cut point");
  assert.equal(Number(moderateTo), highAbove, "Wells 2000: moderate must end at the high cut point");
  const split = spans["wells2000-two-tier"];
  const unlikelyAtMost = Number(match(split, /< or =(\d+\.\d)/, "Wells 2000 unlikely cut point")[1]);
  const likelyAbove = Number(match(split, />(\d+\.\d)\.$/, "Wells 2000 likely cut point")[1]);
  assert.equal(likelyAbove, unlikelyAtMost, "Wells 2000: likely must start where unlikely ends");

  // Wells 2000: PE rate in PE-unlikely patients, and after a negative SimpliRED D-dimer.
  const rates = spans["wells2000-unlikely-rates"];
  const unlikelyRate = match(rates, /^(\d+\.\d)% of patients/, "Wells 2000 PE-unlikely PE rate")[1];
  assert.equal(Number(match(rates, /equal to (\d+)/, "Wells 2000 PE-unlikely group")[1]), unlikelyAtMost);
  const [, derivation, derivationLow, derivationHigh] = match(
    rates,
    /(\d+\.\d)% \(95% CI = (\d+\.\d)% to (\d+\.\d)%\) in the derivation/,
    "Wells 2000 negative D-dimer rate (derivation)",
  );
  const validation = match(rates, /(\d+\.\d)% in the validation/, "Wells 2000 negative D-dimer rate (validation)")[1];
  assert.match(wells2000.title, /\bSimpliRED D-dimer\b/, "Wells 2000 must name the SimpliRED D-dimer");

  // Wells 2001: emergency department cohort and PE rate by pretest-probability tier.
  assert.match(spans["wells2001-setting"], /^Emergency departments\b/, "Wells 2001 must be an emergency department cohort");
  const cohort = Number(match(spans["wells2001-cohort"], /^(\d+) consecutive patients/, "Wells 2001 cohort size")[1]);
  const tierSpan = spans["wells2001-tier-rates"];
  assert.match(tierSpan, /\blow, moderate, and high\b/, "Wells 2001 tiers must be listed low, moderate, high");
  const tierCounts = match(tierSpan, /(\d+), (\d+), and (\d+) patients/, "Wells 2001 tier counts").slice(1).map(Number);
  assert.equal(tierCounts.reduce((sum, count) => sum + count, 0), cohort, "Wells 2001 tier counts must sum to the cohort");
  const tierRates = match(tierSpan, /\((\d+\.\d)%, (\d+\.\d)%, and (\d+\.\d)%/, "Wells 2001 tier PE rates").slice(1);
  const lowNegative = spans["wells2001-low-negative"];
  assert.match(lowNegative, /\blow clinical probability\b/, "the Wells 2001 NPV must belong to the low tier");
  const [, npv, npvLow, npvHigh] = match(lowNegative, /was (\d+\.\d)% \(CI, (\d+\.\d)% to (\d+)%\)/, "Wells 2001 NPV");

  // Christopher Study: dichotomized-rule pathway, outcome and the PE-unlikely + normal D-dimer group.
  assert.match(christopher.authors, /^van Belle A\b/, "Christopher Study first author");
  assert.match(christopher.authors, /\bChristopher Study Investigators\b/, "Christopher Study group name");
  const pathway = spans["christopher-pathway"];
  assert.match(pathway, /\bdichotomized version of the Wells\b/, "Christopher Study must use the dichotomized Wells rule");
  assert.match(pathway, /\bAll other patients underwent CT\b/, "Christopher Study: CT for everyone else");
  assert.match(pathway, /\bAnticoagulants were withheld\b/, "Christopher Study: no anticoagulation when excluded");
  const months = Number(match(pathway, /followed up for (\d+) months\.$/, "Christopher Study follow-up")[1]);
  assert.equal(
    Number(match(spans["christopher-outcome"], /during (\d+)-month follow-up\.$/, "Christopher Study outcome window")[1]),
    months,
    "Christopher Study outcome window must equal the follow-up",
  );
  const group = spans["christopher-unlikely-normal"];
  const [, combined, , untreated] = match(group, /in (\d+) patients \((\d+\.\d)%\), of whom (\d+) were not treated/, "Christopher Study group size");
  const [, events, rate, ciLow, ciHigh] = match(
    group,
    /nonfatal VTE occurred in (\d+) patients \((\d+\.\d)% \[95% confidence interval \{CI\}, (\d+\.\d)%-(\d+\.\d)%\]\)/,
    "Christopher Study VTE rate",
  );
  assert.equal(((Number(events) / Number(untreated)) * 100).toFixed(1), rate, "Christopher Study rate must equal events / untreated");

  return {
    years: { wells2000: wells2000.year, wells2001: wells2001.year, christopher: christopher.year },
    items,
    lowBelow,
    highAbove,
    unlikelyAtMost,
    unlikelyRate,
    negativeDimer: { derivation, derivationLow, derivationHigh, validation },
    cohort,
    tierCounts,
    tierRates,
    lowTierNegativeDimer: { npv, npvLow, npvHigh },
    christopher: { combined: Number(combined), untreated: Number(untreated), events: Number(events), rate, ciLow, ciHigh, months },
  };
}

const whole = (value) => String(Number(value));

// The exact runtime text each fact must appear in.
export function expectedText(facts) {
  const { years, christopher: c } = facts;
  const outcome = `${c.rate}% (95% CI ${c.ciLow}–${c.ciHigh}%) had nonfatal VTE over ${c.months} months of follow-up`;
  return {
    // Visible labels (primary judge on #342): each NICE NG158 Table 2 definition is part of the label,
    // because checkbox subLabels are not rendered. NICE is read by hand (not fetched); these pin the text.
    labels: {
      clinical_dvt: "Clinical signs/symptoms of DVT (at minimum, leg swelling and pain on palpation of the deep veins)",
      alternative_less_likely: "Alternative diagnosis less likely than PE",
      heart_rate: "Heart rate >100 bpm",
      immobilization_surgery: "Immobilization or surgery in the previous 4 weeks (immobilization for more than 3 days)",
      previous_pe_dvt: "Previous PE or DVT",
      hemoptysis: "Hemoptysis",
      malignancy: "Malignancy (under treatment, treated within the past 6 months, or palliative)",
    },
    // The PERC note (primary judge on #342): NICE NG158 1.1.16's conditions and ACP 2015 Best Practice
    // Advice 2, so the low band is never presented as enough for PERC on its own.
    perc:
      "Consider the PERC rule only if the overall clinical impression " +
      "(history, examination and initial tests such as ECG or chest X-ray) gives low clinical suspicion of PE and other diagnoses are feasible (NICE NG158 1.1.16). " +
      `A Wells score below ${whole(facts.lowBelow)} is not enough on its own. ` +
      "With a low pretest probability and all PERC criteria met, ACP 2015 advises against D-dimer testing or imaging. " +
      "PERC is not validated in people with COVID-19.",
    bands: [
      `• Low probability: <${whole(facts.lowBelow)} points`,
      `• Moderate probability: ${whole(facts.lowBelow)}–${whole(facts.highAbove)} points`,
      `• High probability: >${whole(facts.highAbove)} points`,
      `• PE Unlikely: ≤${whole(facts.unlikelyAtMost)} points (PE in ${facts.unlikelyRate}% of these patients in Wells ${years.wells2000})`,
      `• PE Likely: >${whole(facts.unlikelyAtMost)} points`,
    ],
    tierRates:
      `In the Wells ${years.wells2001} emergency department cohort (${facts.cohort} patients), PE was found in ` +
      `${facts.tierRates[0]}% of low, ${facts.tierRates[1]}% of moderate and ${facts.tierRates[2]}% of high probability patients.`,
    christopher:
      `In the Christopher Study (van Belle ${years.christopher}), ${c.untreated.toLocaleString("en-US")} PE-unlikely patients ` +
      `with a normal D-dimer were left untreated; ${outcome}.`,
    simplired:
      `With the SimpliRED D-dimer in Wells ${years.wells2000}, PE occurred in ${facts.negativeDimer.derivation}% (derivation) ` +
      `and ${facts.negativeDimer.validation}% (validation) of PE-unlikely patients with a negative result.`,
    scope: `This calculator implements the Wells ${years.wells2000} score (seven items and both cut-point schemes)`,
    recommendationUnlikely:
      "D-dimer testing recommended. If positive, proceed to CTPA. If negative: in the Christopher Study, " +
      `PE-unlikely patients with a normal D-dimer were left untreated, and ${outcome}.`,
    threeTier: {
      Low: `Low Probability (Wells ${years.wells2001} cohort: PE in ${facts.tierRates[0]}%)`,
      Moderate: `Moderate Probability (Wells ${years.wells2001} cohort: PE in ${facts.tierRates[1]}%)`,
      High: `High Probability (Wells ${years.wells2001} cohort: PE in ${facts.tierRates[2]}%)`,
    },
    twoTierUnlikely: `PE Unlikely (Wells ${years.wells2000}: PE in ${facts.unlikelyRate}%)`,
    twoTierLikely: "PE Likely",
    // Every percentage the runtime may show, each one sourced above ("95%" labels the CI).
    percentages: new Set(
      [...facts.tierRates, facts.unlikelyRate, facts.negativeDimer.derivation, facts.negativeDimer.validation, c.rate, c.ciHigh, "95"].map(
        (value) => `${value}%`,
      ),
    ),
  };
}

function assertSourcedPercentages(text, allowed, where) {
  for (const [percentage] of String(text).matchAll(/\d+(?:\.\d+)?%/g)) {
    assert.ok(allowed.has(percentage), `${where}: unsourced percentage ${percentage}`);
  }
}

export function bindRuntime(wellsPE, facts) {
  const text = expectedText(facts);
  const fields = wellsPE?.fields ?? [];

  // Items: rule order, identity and weight.
  assert.deepEqual(
    fields.map((field) => field.id),
    [...FIELD_ORDER],
    "runtime items must be the seven Wells 2000 items in rule order",
  );
  facts.items.forEach((item, index) => {
    assert.match(item.name, ITEM_KEYS[index], `Wells 2000 item ${index + 1} is not the expected item`);
    assert.match(fields[index].label, ITEM_KEYS[index], `runtime label for ${FIELD_ORDER[index]} must name Wells 2000 item ${index + 1}`);
    assert.equal(
      wellsPE.compute({ [FIELD_ORDER[index]]: true })["Wells Score"],
      `${item.weight} points`,
      `${FIELD_ORDER[index]} must weigh ${item.weight} points (Wells 2000)`,
    );
  });
  for (const field of fields) {
    assert.equal(field.label, text.labels[field.id], `runtime label for ${field.id} must carry its NICE NG158 Table 2 definition`);
    assert.equal(field.subLabel, undefined, `${field.id} must not keep a hidden subLabel (checkbox subLabels are not rendered)`);
  }

  // Every selection: score, both tiers, recommendation, PERC note, and no unsourced claims.
  let vectors = 0;
  for (let mask = 0; mask < 1 << FIELD_ORDER.length; mask += 1) {
    const input = Object.fromEntries(FIELD_ORDER.map((id, index) => [id, Boolean(mask & (1 << index))]));
    const score = facts.items.reduce((sum, item, index) => sum + (input[FIELD_ORDER[index]] ? item.weight : 0), 0);
    const result = wellsPE.compute(input);
    const where = `selection ${mask} (${score} points)`;
    assert.equal(result["Wells Score"], `${score} points`, `${where}: score must be the sum of the Wells 2000 weights`);
    const tier = score < facts.lowBelow ? "Low" : score <= facts.highAbove ? "Moderate" : "High";
    assert.equal(result["3-Tier Assessment"], text.threeTier[tier], `${where}: three-tier result must follow the Wells 2000 cut points`);
    const unlikely = score <= facts.unlikelyAtMost;
    assert.equal(
      result["2-Tier Assessment (Recommended)"],
      unlikely ? text.twoTierUnlikely : text.twoTierLikely,
      `${where}: two-tier result must follow the Wells 2000 split`,
    );
    if (unlikely) {
      assert.equal(result.Recommendation, text.recommendationUnlikely, `${where}: recommendation must carry the Christopher Study outcome`);
    }
    assert.equal(
      /\bPERC\b/.test(result["Clinical Notes"] ?? ""),
      score < facts.lowBelow,
      `${where}: the PERC note must follow the Wells 2000 low band`,
    );
    if (score < facts.lowBelow) {
      assert.ok(
        String(result["Clinical Notes"]).split("; ").includes(text.perc),
        `${where}: the PERC note must state the NICE NG158 1.1.16 and ACP 2015 conditions exactly`,
      );
    }
    for (const [key, value] of Object.entries(result)) {
      if (typeof value !== "string") continue;
      assert.doesNotMatch(value, FORBIDDEN_CLAIMS, `${where}: ${key} must not claim NPV >99% or exclusion`);
      assertSourcedPercentages(value, text.percentages, `${where}: ${key}`);
    }
    vectors += 1;
  }

  // Information text.
  const info = String(wellsPE?.info?.text ?? "");
  const lines = info.split("\n");
  for (const line of text.bands) assert.ok(lines.includes(line), `info text must carry the sourced band line "${line}"`);
  assert.ok(info.includes(text.tierRates), "info text must carry the Wells 2001 tier PE rates");
  assert.ok(info.includes(text.christopher), "info text must carry the Christopher Study outcome");
  assert.ok(info.includes(text.simplired), "info text must carry the Wells 2000 SimpliRED rates");
  assert.ok(info.includes(text.scope), "info text must say which Wells score the calculator implements");
  assert.doesNotMatch(info, FORBIDDEN_CLAIMS, "info text must not claim NPV >99% or exclusion");
  assert.doesNotMatch(info, /PERC rule integration|2001 Wells criteria/i, "info text must not overstate what is implemented");
  assertSourcedPercentages(info, text.percentages, "info text");

  // Version and references.
  assert.equal(wellsPE.guidelineVersion, `Wells Criteria (${facts.years.wells2000})`, "guidelineVersion must name Wells 2000");
  const refs = (wellsPE.refs ?? []).map((ref) => ref.u);
  for (const [pmid, source] of Object.entries(SOURCES)) {
    const linked =
      refs.includes(`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`) || (source.doi && refs.includes(`https://doi.org/${source.doi}`));
    assert.ok(linked, `references must link PMID ${pmid}`);
  }
  return { vectors, bands: text.bands.length };
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

// Retrieval goes through the shared NCBI helper (Codex review on #305, applied here too): request
// spacing across the run's audits, the fetch log and cache, and retries for transport failures only
// (network errors, timeouts, HTTP 408, 425, 429 and 5xx, and HTTP 400, which E-utilities returns
// transiently for valid requests): five attempts 1, 2, 4 and 8 s apart, or longer when Retry-After asks,
// never over 30 s. Redirects are refused, not followed. A 200 response that misses its URL, media-type,
// length or digest pin is a changed source and fails at once: those pins are checked in verify(), which
// is stricter than the helper's default of retrying a wrong final URL or media type. `fetchImpl`,
// `sleep`, `env` and `gate` are for tests.
export async function fetchSource(pmid, { fetchImpl, sleep, env, gate } = {}) {
  const source = SOURCES[pmid];
  const fetched = await fetchPinned({
    url: source.url,
    label: `PMID ${pmid}`,
    pin: { sha256: source.sha256, bytes: source.bytes },
    verify: (bytes, response) => {
      // A cache hit has no response: the run's cache holds only bytes that passed these checks.
      if (response) verifyResponse(pmid, { finalUrl: response.url, contentType: response.headers?.get?.("content-type") });
      verifySourceBytes(pmid, bytes, source);
    },
    checkResponse: (response) => {
      if (response.redirected) throw new Error(`PMID ${pmid}: redirected response`);
    },
    minBytes: 0,
    headers: { accept: "text/plain", "user-agent": "Radulator-Wells-PE-audit/1" },
    redirect: "error",
    fetchImpl,
    sleep,
    env,
    gate,
  });
  return fetched.bytes;
}

// One request at a time; the helper spaces them.
export async function fetchSources(options = {}) {
  const sources = {};
  for (const pmid of Object.keys(SOURCES)) sources[pmid] = await fetchSource(pmid, options);
  return sources;
}

// `sources` maps each PMID to the exact response bytes. Bytes are verified before anything is parsed.
export function runAudit({ sources, wellsPE }) {
  const records = {};
  for (const pmid of Object.keys(SOURCES)) {
    verifySourceBytes(pmid, sources[pmid]);
    records[pmid] = verifyRecord(pmid, parseRecordText(sources[pmid].toString("utf8")));
  }
  const spans = verifyStatements(records);
  const facts = extractFacts(records, spans);
  const binding = bindRuntime(wellsPE, facts);
  return { records, facts, binding };
}

export async function loadRuntime(root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")) {
  const module = await import(pathToFileURL(path.join(root, "src/components/calculators/WellsPE.jsx")).href);
  return module.WellsPE;
}

export function passLine({ facts, binding }) {
  const pins = Object.entries(SOURCES)
    .map(([pmid, source]) => `PMID ${pmid} ${source.bytes} bytes sha256=${source.sha256.slice(0, 12)}`)
    .join(", ");
  const c = facts.christopher;
  return (
    `Wells PE source audit PASS: ${pins} (text/plain, raw bytes); ${STATEMENTS.length} digest-pinned statements; ` +
    `weights ${facts.items.map((item) => item.weight).join("/")}; 3-tier <${facts.lowBelow}/${facts.lowBelow}-${facts.highAbove}/>${facts.highAbove}; ` +
    `2-tier <=${facts.unlikelyAtMost}/>${facts.unlikelyAtMost}; Wells ${facts.years.wells2001} tier PE ${facts.tierRates.join("/")}% (n=${facts.cohort}); ` +
    `Wells ${facts.years.wells2000} PE-unlikely ${facts.unlikelyRate}%, negative SimpliRED ${facts.negativeDimer.derivation}/${facts.negativeDimer.validation}%; ` +
    `Christopher ${c.events}/${c.untreated} VTE ${c.rate}% (${c.ciLow}-${c.ciHigh}) at ${c.months} months -> ` +
    `${binding.vectors} selections, ${binding.bands} info band lines, info text, recommendation, labels and PERC note bound`
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = runAudit({ sources: await fetchSources(), wellsPE: await loadRuntime() });
  console.log(passLine(result));
}
