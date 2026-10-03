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

const PERC_NOTE =
  "Consider the PERC rule only if the overall clinical impression (history, examination and initial tests such as ECG or chest X-ray) gives low clinical suspicion of PE and other diagnoses are feasible (NICE NG158 1.1.16). A Wells score below 2 is not enough on its own. With a low pretest probability and all PERC criteria met, ACP 2015 advises against D-dimer testing or imaging. PERC is not validated in people with COVID-19.";

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
    // NICE NG158 1.1.16's conditions and ACP 2015 advice 2, word for word (primary judge on #342).
    if (expected) assert.ok(notes.split("; ").includes(PERC_NOTE), `${score} points: PERC note text`);
    assert.doesNotMatch(notes, /0-1|score <2/);
  }
});

test("the PERC note states NICE's and ACP's conditions instead of presenting the score band as enough", () => {
  assert.match(PERC_NOTE, /only if the overall clinical impression .* gives low clinical suspicion of PE/);
  assert.match(PERC_NOTE, /other diagnoses are feasible \(NICE NG158 1\.1\.16\)/);
  assert.match(PERC_NOTE, /A Wells score below 2 is not enough on its own\./);
  assert.match(PERC_NOTE, /all PERC criteria met, ACP 2015 advises against D-dimer testing or imaging/);
  assert.match(PERC_NOTE, /not validated in people with COVID-19/);
  assert.doesNotMatch(PERC_NOTE, /; /, "the note stays one Clinical Notes entry");
});

test("the alternative-diagnosis item uses the strict sourced wording, and its 3 points can cross the >4 split", () => {
  const field = WellsPE.fields.find((candidate) => candidate.id === "alternative_less_likely");
  assert.equal(field.label, "Alternative diagnosis less likely than PE");
  assert.equal(field.subLabel, undefined);

  const everyText = JSON.stringify(WellsPE.fields);
  assert.doesNotMatch(everyText, /equally likely|#1/i);
  const all = WellsPE.compute(select(...IDS));
  assert.doesNotMatch(JSON.stringify(all), /equally likely|#1/i);
  assert.match(all["Score Breakdown"], /Alternative diagnosis less likely than PE: \+3\.0/);

  // Why the wording matters: this one item moves 1.5 points (unlikely) to 4.5 points (likely).
  assertOutcome(select("previous_pe_dvt"), 1.5, UNLIKELY, LOW);
  assertOutcome(select("previous_pe_dvt", "alternative_less_likely"), 4.5, LIKELY, MODERATE);
});

test("criterion definitions follow NICE NG158 Table 2 and are part of the visible labels", () => {
  const byId = Object.fromEntries(WellsPE.fields.map((field) => [field.id, field]));

  // Checkbox subLabels are not rendered, so each definition is in the label, in Table 2's own
  // "name (definition)" layout, and no field keeps a hidden subLabel (primary judge on #342).
  for (const field of WellsPE.fields) assert.equal(field.subLabel, undefined, `${field.id}: hidden subLabel`);

  // Signs of DVT: at minimum both leg swelling and pain on palpation of the deep veins.
  assert.equal(
    byId.clinical_dvt.label,
    "Clinical signs/symptoms of DVT (at minimum, leg swelling and pain on palpation of the deep veins)",
  );

  // Immobilization must exceed 3 days; surgery also counts; 4-week window; no DVT-rule qualifiers.
  assert.equal(
    byId.immobilization_surgery.label,
    "Immobilization or surgery in the previous 4 weeks (immobilization for more than 3 days)",
  );
  assert.doesNotMatch(byId.immobilization_surgery.label, /≥|at least|anesthesia|anaesthesia|bedrest/i);

  // Previous DVT/PE carries no extra qualifier in the cited source.
  assert.equal(byId.previous_pe_dvt.label, "Previous PE or DVT");

  // Malignancy: current treatment, treatment within 6 months, or palliative (not NICE's broader
  // glossary term "active cancer").
  assert.equal(byId.malignancy.label, "Malignancy (under treatment, treated within the past 6 months, or palliative)");
  assert.doesNotMatch(byId.malignancy.label, /active cancer/i);
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
