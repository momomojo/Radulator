// Wells PE: compute-level regression vectors.
//
// These vectors pin the item weights, the two-level split and the three-tier cut points of Wells 2000
// (PMID 10744147) over every possible selection, the sourced cohort figures in the results, and the
// checkbox wording from NICE NG158 recommendation 1.1.17, Table 2 (adapted from Wells 2000).
// scripts/audit-wells-pe-source.mjs binds the same numbers to the byte-pinned PubMed abstracts.
// Evidence and locators: docs/evidence/wells-pe-wording.md
import assert from "node:assert/strict";
import test from "node:test";

import { WellsPE } from "../src/components/calculators/WellsPE.jsx";

// Item weights: Wells 2000 abstract (PMID 10744147) and NICE NG158 Table 2 agree.
const ITEMS = [
  ["clinical_dvt", 3, "Clinical signs/symptoms of DVT: +3.0"],
  ["alternative_less_likely", 3, "Alternative diagnosis less likely than PE: +3.0"],
  ["heart_rate", 1.5, "Heart rate >100: +1.5"],
  ["immobilization_surgery", 1.5, "Immobilization/surgery: +1.5"],
  ["previous_pe_dvt", 1.5, "Previous PE/DVT: +1.5"],
  ["hemoptysis", 1, "Hemoptysis: +1.0"],
  ["malignancy", 1, "Malignancy: +1.0"],
];
const IDS = ITEMS.map(([id]) => id);

// Cohort PE rates: Wells 2000 (PE unlikely) and the Wells 2001 emergency department cohort (tiers).
const UNLIKELY = "PE Unlikely (Wells 2000: PE in 7.8%)";
const LIKELY = "PE Likely";
const LOW = "Low Probability (Wells 2001 cohort: PE in 1.3%)";
const MODERATE = "Moderate Probability (Wells 2001 cohort: PE in 16.2%)";
const HIGH = "High Probability (Wells 2001 cohort: PE in 37.5%)";
// Negative D-dimer outcome in PE-unlikely patients: Christopher Study (van Belle 2006), 5 of 1028.
const CHRISTOPHER_OUTCOME = "0.5% (95% CI 0.2–1.1%) had nonfatal VTE over 3 months of follow-up";

// Two-level split: PE unlikely at 4 points or less, likely above 4 (Wells 2000 abstract; NICE Table 2).
const twoTier = (score) => (score <= 4 ? UNLIKELY : LIKELY);
// Three-tier cut points (Wells 2000 abstract): low below 2, moderate 2 to 6, high above 6.
const threeTier = (score) => (score < 2 ? LOW : score <= 6 ? MODERATE : HIGH);

const select = (...ids) => Object.fromEntries(IDS.map((id) => [id, ids.includes(id)]));
const scoreOf = (input) => ITEMS.reduce((sum, [id, weight]) => sum + (input[id] ? weight : 0), 0);

function assertOutcome(input, score, two, three) {
  const result = WellsPE.compute(input);
  assert.equal(result["Wells Score"], `${score} points`, JSON.stringify(input));
  assert.equal(result["2-Tier Assessment (Recommended)"], two, JSON.stringify(input));
  assert.equal(result["3-Tier Assessment"], three, JSON.stringify(input));
  return result;
}

test("field contract: seven checkbox items in source order", () => {
  assert.deepEqual(
    WellsPE.fields.map((field) => field.id),
    IDS,
  );
  for (const field of WellsPE.fields) assert.equal(field.type, "checkbox", field.id);
});

test("all 128 selections keep the sourced weights, the <=4/>4 split and the three-tier cut points", () => {
  const seen = new Set();
  for (let mask = 0; mask < 1 << IDS.length; mask += 1) {
    const input = Object.fromEntries(IDS.map((id, index) => [id, Boolean(mask & (1 << index))]));
    const score = scoreOf(input);
    const result = assertOutcome(input, score, twoTier(score), threeTier(score));
    const selected = ITEMS.filter(([id]) => input[id]).map(([, , line]) => line);
    assert.equal(
      result["Score Breakdown"],
      selected.length ? selected.join("; ") : "No risk factors selected (0 points)",
    );
    if (score <= 4) {
      assert.match(result.Recommendation, /^D-dimer testing recommended\. If positive, proceed to CTPA\./);
      assert.ok(result.Recommendation.endsWith(`${CHRISTOPHER_OUTCOME}.`), result.Recommendation);
      assert.match(result.Recommendation, /Christopher Study/);
      assert.equal(result._severity, "success");
    } else {
      assert.match(result.Recommendation, /^Proceed directly to CT pulmonary angiography \(CTPA\)\./);
      assert.equal(result._severity, "danger");
    }
    // The PERC note uses the same low band as the three-tier model.
    assert.equal(/\bPERC\b/.test(result["Clinical Notes"] ?? ""), score < 2, `PERC note at ${score} points`);
    // No NPV >99% or "excluded" claim, and no unsourced percentage, in any output.
    for (const value of Object.values(result)) {
      if (typeof value !== "string") continue;
      assert.doesNotMatch(value, /NPV|>\s*99|effectively excluded|PE excluded/i);
      for (const [percentage] of value.matchAll(/\d+(?:\.\d+)?%/g)) {
        assert.ok(["1.3%", "16.2%", "37.5%", "7.8%", "0.5%", "95%", "1.1%"].includes(percentage), `unsourced ${percentage}`);
      }
    }
    seen.add(score);
  }
  // 0 to 12.5 in half points; 0.5 and 12 are unreachable with these weights.
  assert.equal(seen.size, 24);
  assert.equal(Math.max(...seen), 12.5);
});

test("named boundary vectors", () => {
  assertOutcome({}, 0, UNLIKELY, LOW);
  assertOutcome(select("hemoptysis"), 1, UNLIKELY, LOW);
  // The three-tier lower boundary: 1.5 is low (below 2), 2 is moderate.
  assertOutcome(select("heart_rate"), 1.5, UNLIKELY, LOW);
  assertOutcome(select("hemoptysis", "malignancy"), 2, UNLIKELY, MODERATE);
  // The two-level boundary: exactly 4 is unlikely, 4.5 is likely.
  assertOutcome(select("clinical_dvt", "malignancy"), 4, UNLIKELY, MODERATE);
  assertOutcome(select("alternative_less_likely", "hemoptysis"), 4, UNLIKELY, MODERATE);
  assertOutcome(select("clinical_dvt", "heart_rate"), 4.5, LIKELY, MODERATE);
  // The three-tier upper boundary: 6 is moderate, 6.5 is high.
  assertOutcome(select("clinical_dvt", "alternative_less_likely"), 6, LIKELY, MODERATE);
  assertOutcome(select("clinical_dvt", "heart_rate", "hemoptysis", "malignancy"), 6.5, LIKELY, HIGH);
  assertOutcome(select(...IDS), 12.5, LIKELY, HIGH);
});

test("Wells 2000 cut-point boundaries: 1.5 low, 2.0 moderate, 6.0 moderate, 6.5 high", () => {
  // Every single 1.5-point item is low probability (the score is below 2.0).
  for (const id of ["heart_rate", "immobilization_surgery", "previous_pe_dvt"]) {
    assertOutcome(select(id), 1.5, UNLIKELY, LOW);
  }
  assertOutcome(select("malignancy", "hemoptysis"), 2, UNLIKELY, MODERATE);
  assertOutcome(select("heart_rate", "immobilization_surgery", "previous_pe_dvt", "malignancy", "hemoptysis"), 6.5, LIKELY, HIGH);
  assertOutcome(select("clinical_dvt", "alternative_less_likely"), 6, LIKELY, MODERATE);
  assertOutcome(select("heart_rate", "immobilization_surgery", "previous_pe_dvt", "hemoptysis"), 5.5, LIKELY, MODERATE);
  assertOutcome(select("clinical_dvt", "heart_rate", "hemoptysis", "malignancy"), 6.5, LIKELY, HIGH);
});

test("info text states the Wells 2000 bands and attributed cohort figures, with no NPV >99% claim", () => {
  const info = WellsPE.info.text;
  const lines = info.split("\n");
  for (const line of [
    "• Low probability: <2 points",
    "• Moderate probability: 2–6 points",
    "• High probability: >6 points",
    "• PE Unlikely: ≤4 points (PE in 7.8% of these patients in Wells 2000)",
    "• PE Likely: >4 points",
  ]) {
    assert.ok(lines.includes(line), line);
  }
  assert.match(info, /Wells 2001 emergency department cohort \(930 patients\)/);
  assert.match(info, /1\.3% of low, 16\.2% of moderate and 37\.5% of high probability patients/);
  assert.match(info, /Christopher Study \(van Belle 2006\), 1,028 PE-unlikely patients with a normal D-dimer were left untreated/);
  assert.ok(info.includes(CHRISTOPHER_OUTCOME));
  assert.match(info, /SimpliRED D-dimer in Wells 2000, PE occurred in 2\.2% \(derivation\) and 1\.7% \(validation\)/);
  assert.match(info, /implements the Wells 2000 score/);
  assert.doesNotMatch(info, /NPV|>\s*99|excluded|~3\.6%|~20\.5%|~66\.7%|~34%|PERC rule integration|2001 Wells criteria/);
});

test("the PERC note keys off the low band (score below 2), not 0-1 or the PE-unlikely split", () => {
  for (const [input, score, expected] of [
    [{}, 0, true],
    [select("hemoptysis"), 1, true],
    [select("heart_rate"), 1.5, true],
    [select("hemoptysis", "malignancy"), 2, false],
    [select("clinical_dvt", "hemoptysis"), 4, false],
  ]) {
    const notes = WellsPE.compute(input)["Clinical Notes"] ?? "";
    assert.equal(/\bPERC\b/.test(notes), expected, `${score} points`);
    if (expected) assert.match(notes, /score <2/);
    assert.doesNotMatch(notes, /0-1/);
  }
});

test("the alternative-diagnosis item uses the strict sourced wording, and its 3 points can cross the >4 split", () => {
  const field = WellsPE.fields.find((candidate) => candidate.id === "alternative_less_likely");
  assert.equal(field.label, "Alternative diagnosis less likely than PE");
  assert.match(field.subLabel, /more likely than every alternative diagnosis/);
  assert.match(field.subLabel, /a tie does not count/);

  const everyText = JSON.stringify(WellsPE.fields);
  assert.doesNotMatch(everyText, /equally likely|#1/i);
  const all = WellsPE.compute(select(...IDS));
  assert.doesNotMatch(JSON.stringify(all), /equally likely|#1/i);
  assert.match(all["Score Breakdown"], /Alternative diagnosis less likely than PE: \+3\.0/);

  // Why the wording matters: this one item moves 1.5 points (unlikely) to 4.5 points (likely).
  assertOutcome(select("previous_pe_dvt"), 1.5, UNLIKELY, LOW);
  assertOutcome(select("previous_pe_dvt", "alternative_less_likely"), 4.5, LIKELY, MODERATE);
});

test("criterion definitions follow NICE NG158 Table 2", () => {
  const byId = Object.fromEntries(WellsPE.fields.map((field) => [field.id, field]));

  // Signs of DVT: at minimum both leg swelling and pain on palpation of the deep veins.
  assert.match(byId.clinical_dvt.subLabel, /\bboth leg swelling and pain on palpation of the deep veins\b/);

  // Immobilization must exceed 3 days; surgery also counts; 4-week window; no DVT-rule qualifiers.
  assert.match(byId.immobilization_surgery.subLabel, /\bmore than 3 days\b/);
  assert.match(byId.immobilization_surgery.subLabel, /\b4 weeks\b/);
  assert.doesNotMatch(byId.immobilization_surgery.subLabel, /≥|at least|anesthesia|anaesthesia|bedrest/i);

  // Previous DVT/PE carries no extra qualifier in the cited source.
  assert.equal(byId.previous_pe_dvt.subLabel, undefined);

  // Malignancy: current treatment, treatment within 6 months, or palliative (not NICE's broader
  // glossary term "active cancer").
  assert.match(byId.malignancy.subLabel, /\btreatment\b/);
  assert.match(byId.malignancy.subLabel, /\b6 months\b/);
  assert.match(byId.malignancy.subLabel, /\bpalliative\b/);
  assert.doesNotMatch(byId.malignancy.subLabel, /active cancer/i);

  // Labels render as "label (subLabel)"; keep subLabels free of nested parentheses.
  for (const field of WellsPE.fields) {
    if (field.subLabel !== undefined) assert.doesNotMatch(field.subLabel, /[()]/, field.id);
  }
});

test("citations: Wells 2000 DOI link and PubMed record, Wells 2001, Christopher Study and NICE NG158", () => {
  assert.equal(WellsPE.guidelineVersion, "Wells Criteria (2000)");
  assert.equal(WellsPE.info.link.url, "https://doi.org/10.1055/s-0037-1613830");
  const urls = WellsPE.refs.map((ref) => ref.u);
  assert.ok(urls.includes("https://pubmed.ncbi.nlm.nih.gov/10744147/"));
  assert.ok(urls.includes("https://doi.org/10.7326/0003-4819-135-2-200107170-00010"));
  assert.ok(urls.includes("https://doi.org/10.1001/jama.295.2.172"));
  assert.ok(urls.includes("https://www.nice.org.uk/guidance/ng158/chapter/Recommendations"));
});
