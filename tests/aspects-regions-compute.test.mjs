import assert from "node:assert/strict";
import test from "node:test";

import { ASPECTSScore } from "../src/components/calculators/ASPECTSScore.jsx";

// Region grouping per the ASPECTS developers' template (docs/evidence/aspects-regions.md):
// subcortical structures C, L and IC carry 3 points; MCA cortex (insular cortex and M1-M6)
// carries 7. The insular ribbon is cortex scored on the ganglionic cut.
const SUBCORTICAL = ["caudate", "lentiform", "internal_capsule"];
const GANGLIONIC_CORTICAL = ["insular", "m1", "m2", "m3"];
const SUPRAGANGLIONIC_CORTICAL = ["m4", "m5", "m6"];
const REGION_IDS = [...SUBCORTICAL, ...GANGLIONIC_CORTICAL, ...SUPRAGANGLIONIC_CORTICAL];

const PREDOMINANTLY_SUBCORTICAL_NOTE =
  "Predominantly subcortical involvement - consider lenticulostriate territory infarction";
const PROXIMAL_M1_NOTE =
  "Involvement of both insular ribbon and lentiform nucleus suggests proximal M1 occlusion with poor collaterals";
const COMPLETE_M1_M6_NOTE =
  "Complete M1-M6 cortical involvement suggests very poor collateral circulation";

function inputsFor(affected) {
  const values = { laterality: "left", time_from_onset: "" };
  for (const id of REGION_IDS) values[id] = affected.includes(id);
  return values;
}

function breakdown(subcortical, ganglionicCortical, supraganglionic) {
  return `Subcortical (C, L, IC): ${subcortical}/3 | Ganglionic cortical (I, M1-M3): ${ganglionicCortical}/4 | Supraganglionic (M4-M6): ${supraganglionic}/3`;
}

function clinicalNotes(result) {
  return (result["Clinical Notes"] ?? "").split("; ").filter(Boolean);
}

test("breakdown counts C, L and IC as subcortical and the insular ribbon as ganglionic cortex", () => {
  const vectors = [
    { id: "normal", affected: [], score: "10 / 10", breakdown: breakdown(0, 0, 0) },
    { id: "insula-only", affected: ["insular"], score: "9 / 10", breakdown: breakdown(0, 1, 0) },
    {
      id: "c-l-ic",
      affected: ["caudate", "lentiform", "internal_capsule"],
      score: "7 / 10",
      breakdown: breakdown(3, 0, 0),
    },
    {
      id: "c-l-ic-i",
      affected: ["caudate", "lentiform", "internal_capsule", "insular"],
      score: "6 / 10",
      breakdown: breakdown(3, 1, 0),
    },
    { id: "l-i", affected: ["lentiform", "insular"], score: "8 / 10", breakdown: breakdown(1, 1, 0) },
    {
      id: "m1-m6",
      affected: ["m1", "m2", "m3", "m4", "m5", "m6"],
      score: "4 / 10",
      breakdown: breakdown(0, 3, 3),
    },
    { id: "all-ten", affected: REGION_IDS, score: "0 / 10", breakdown: breakdown(3, 4, 3) },
  ];
  for (const vector of vectors) {
    const result = ASPECTSScore.compute(inputsFor(vector.affected));
    assert.equal(result["ASPECTS Score"], vector.score, vector.id);
    assert.equal(result["Regional Breakdown"], vector.breakdown, vector.id);
    assert.doesNotMatch(result["Regional Breakdown"], /\/4 \| Ganglionic cortical \(M1-M3\)/, vector.id);
  }
});

test("all 1024 region combinations keep score = 10 - regions and a breakdown that sums to the region count", () => {
  for (let mask = 0; mask < 1 << REGION_IDS.length; mask += 1) {
    const affected = REGION_IDS.filter((_, index) => mask & (1 << index));
    const result = ASPECTSScore.compute(inputsFor(affected));
    const count = (ids) => ids.filter((id) => affected.includes(id)).length;
    const subcortical = count(SUBCORTICAL);
    const ganglionicCortical = count(GANGLIONIC_CORTICAL);
    const supraganglionic = count(SUPRAGANGLIONIC_CORTICAL);

    assert.equal(result["ASPECTS Score"], `${10 - affected.length} / 10`, `mask ${mask}`);
    assert.equal(
      result["Regional Breakdown"],
      breakdown(subcortical, ganglionicCortical, supraganglionic),
      `mask ${mask}`,
    );
    assert.equal(subcortical + ganglionicCortical + supraganglionic, affected.length, `mask ${mask}`);

    const predominantlySubcortical = subcortical === 3 && ganglionicCortical + supraganglionic === 0;
    assert.equal(
      clinicalNotes(result).includes(PREDOMINANTLY_SUBCORTICAL_NOTE),
      predominantlySubcortical,
      `mask ${mask}: predominantly-subcortical note`,
    );
    assert.equal(
      clinicalNotes(result).includes(COMPLETE_M1_M6_NOTE),
      ["m1", "m2", "m3", "m4", "m5", "m6"].every((id) => affected.includes(id)),
      `mask ${mask}: complete M1-M6 note`,
    );
  }
});

test("predominantly-subcortical note needs C, L and IC with no cortical region, insula included", () => {
  const vectors = [
    { id: "c-l-ic", affected: ["caudate", "lentiform", "internal_capsule"], note: true },
    { id: "c-l-ic-i", affected: ["caudate", "lentiform", "internal_capsule", "insular"], note: false },
    { id: "c-l-i", affected: ["caudate", "lentiform", "insular"], note: false },
    { id: "c-ic-i", affected: ["caudate", "internal_capsule", "insular"], note: false },
    { id: "l-ic-i", affected: ["lentiform", "internal_capsule", "insular"], note: false },
    { id: "c-l-ic-m4", affected: ["caudate", "lentiform", "internal_capsule", "m4"], note: false },
  ];
  for (const vector of vectors) {
    const notes = clinicalNotes(ASPECTSScore.compute(inputsFor(vector.affected)));
    assert.equal(notes.includes(PREDOMINANTLY_SUBCORTICAL_NOTE), vector.note, vector.id);
  }
  // Insular + lentiform keeps the proximal-M1 note and no longer also offers a
  // lenticulostriate-territory explanation for the same scan.
  const notes = clinicalNotes(ASPECTSScore.compute(inputsFor(["caudate", "lentiform", "insular"])));
  assert.ok(notes.includes(PROXIMAL_M1_NOTE));
  assert.ok(!notes.includes(PREDOMINANTLY_SUBCORTICAL_NOTE));
});

test("complete M1-M6 note keeps its M1-M6 trigger and names those regions", () => {
  const m1ToM6 = ["m1", "m2", "m3", "m4", "m5", "m6"];
  assert.ok(clinicalNotes(ASPECTSScore.compute(inputsFor(m1ToM6))).includes(COMPLETE_M1_M6_NOTE));
  assert.ok(!clinicalNotes(ASPECTSScore.compute(inputsFor(m1ToM6.slice(0, 5)))).includes(COMPLETE_M1_M6_NOTE));
  for (let mask = 0; mask < 1 << REGION_IDS.length; mask += 1) {
    const affected = REGION_IDS.filter((_, index) => mask & (1 << index));
    assert.doesNotMatch(
      ASPECTSScore.compute(inputsFor(affected))["Clinical Notes"] ?? "",
      /Complete cortical MCA involvement/,
      `mask ${mask}`,
    );
  }
});

test("region subLabels keep the audited wording and render without nested parentheses", () => {
  const checkboxes = ASPECTSScore.fields.filter((field) => field.type === "checkbox");
  assert.deepEqual(
    checkboxes.map((field) => field.id),
    REGION_IDS,
    "ten region checkboxes in on-screen order",
  );
  assert.deepEqual(Object.fromEntries(checkboxes.map((field) => [field.id, field.subLabel])), {
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
  for (const field of checkboxes) {
    // FieldLabel renders "label (subLabel)".
    assert.doesNotMatch(field.subLabel, /[()]/, `${field.id}: subLabel would render nested parentheses`);
  }
  assert.doesNotMatch(
    checkboxes.find((field) => field.id === "m3").subLabel,
    /temporal/i,
    "M3 is posterior MCA cortex, not a named lobe",
  );
});

test("info text keeps the region list consistent with the subLabels", () => {
  const text = ASPECTSScore.info.text;
  assert.ok(text.includes("• M3 - Posterior MCA cortex (behind M2)"));
  assert.doesNotMatch(text, /Posterior temporal lobe/);
  assert.ok(text.includes("• IC - Internal capsule (posterior limb)"));
  assert.ok(text.includes("subtract 1 point for each region"));
});
