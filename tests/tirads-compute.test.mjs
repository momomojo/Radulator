import assert from "node:assert/strict";
import test from "node:test";

import "../scripts/register-jsx-loader.mjs";
import { TIRADS } from "../src/components/calculators/TIRADS.jsx";

const baseline = {
  composition: "solid",
  echogenicity: "hyperechoic",
  shape: "wider",
  margin: "smooth",
  echogenic_foci_none: true,
  echogenic_foci_macro: false,
  echogenic_foci_peripheral: false,
  echogenic_foci_punctate: false,
  nodule_size: "",
};

function withValues(overrides = {}) {
  return { ...baseline, ...overrides };
}

function assertError(values, message) {
  const result = TIRADS.compute(values);
  assert.ok(result.Error, `expected an error, got ${JSON.stringify(result)}`);
  if (message) assert.match(result.Error, message);
  return result;
}

function assertScore(values, points, category) {
  const result = TIRADS.compute(values);
  assert.equal(result["Total Points"], `${points} points`);
  assert.equal(result["TI-RADS Category"], category);
  return result;
}

test("adds all selected echogenic foci instead of choosing only the highest", () => {
  const vectors = [
    [{}, 3, "TR3 - Mildly Suspicious"],
    [{ echogenic_foci_none: false, echogenic_foci_macro: true }, 4, "TR4 - Moderately Suspicious"],
    [{ echogenic_foci_none: false, echogenic_foci_peripheral: true }, 5, "TR4 - Moderately Suspicious"],
    [{ echogenic_foci_none: false, echogenic_foci_punctate: true }, 6, "TR4 - Moderately Suspicious"],
    [
      { echogenic_foci_none: false, echogenic_foci_macro: true, echogenic_foci_peripheral: true },
      6,
      "TR4 - Moderately Suspicious",
    ],
    [
      { echogenic_foci_none: false, echogenic_foci_macro: true, echogenic_foci_punctate: true },
      7,
      "TR5 - Highly Suspicious",
    ],
    [
      { echogenic_foci_none: false, echogenic_foci_peripheral: true, echogenic_foci_punctate: true },
      8,
      "TR5 - Highly Suspicious",
    ],
    [
      {
        echogenic_foci_none: false,
        echogenic_foci_macro: true,
        echogenic_foci_peripheral: true,
        echogenic_foci_punctate: true,
      },
      9,
      "TR5 - Highly Suspicious",
    ],
  ];

  for (const [overrides, points, category] of vectors) {
    assertScore(withValues(overrides), points, category);
  }
});

test("supports the maximum additive score of 17 points", () => {
  assertScore(
    withValues({
      echogenicity: "very_hypoechoic",
      shape: "taller",
      margin: "ete",
      echogenic_foci_none: false,
      echogenic_foci_macro: true,
      echogenic_foci_peripheral: true,
      echogenic_foci_punctate: true,
    }),
    17,
    "TR5 - Highly Suspicious",
  );
});

test("requires an explicit and internally consistent echogenic-foci assessment", () => {
  assertError(
    { ...baseline, echogenic_foci_none: undefined, echogenic_foci_macro: undefined, echogenic_foci_peripheral: undefined, echogenic_foci_punctate: undefined },
    /echogenic foci/i,
  );
  assertError({ ...baseline, echogenic_foci: "punctate" }, /explicit|unsupported|echogenic foci/i);
  assertError({ ...baseline, echogenic_foci_none: true, echogenic_foci_punctate: true }, /exclusive|reassess|echogenic foci/i);
  assertError({ ...baseline, echogenic_foci_none: "false" }, /boolean|echogenic foci/i);
  assertError({ ...baseline, echogenic_foci_none: false, echogenic_foci_macro: false, echogenic_foci_peripheral: false, echogenic_foci_punctate: false }, /select|explicit|echogenic foci/i);
});

test("rejects invalid feature combinations and never maps an unassigned score to TR2", () => {
  assertError(withValues({ composition: "solid", echogenicity: "anechoic" }), /anechoic|reassess/i);
  assertError(withValues({ composition: "mixed", echogenicity: "anechoic" }), /anechoic|reassess/i);
  assertError(withValues({ composition: "unknown" }), /composition|invalid|reassess/i);
  assertError(withValues({ echogenicity: "unknown" }), /echogenicity|invalid|reassess/i);
  assertError(withValues({ shape: "unknown" }), /shape|invalid|reassess/i);
  assertError(withValues({ margin: "unknown" }), /margin|invalid|reassess/i);
});

test("accepts cystic and spongiform composition alone but rejects suspicious residual values", () => {
  assertScore({ composition: "cystic" }, 0, "TR1 - Benign");
  assertScore({ composition: "spongiform" }, 0, "TR1 - Benign");
  assertScore(
    {
      composition: "cystic",
      echogenic_foci_none: false,
      echogenic_foci_macro: false,
      echogenic_foci_peripheral: false,
      echogenic_foci_punctate: false,
    },
    0,
    "TR1 - Benign",
  );
  assertScore(
    {
      composition: "cystic",
      echogenicity: "anechoic",
      shape: "wider",
      margin: "smooth",
      echogenic_foci_none: true,
      echogenic_foci_macro: false,
      echogenic_foci_peripheral: false,
      echogenic_foci_punctate: false,
    },
    0,
    "TR1 - Benign",
  );
  assertScore(
    { composition: "spongiform", echogenicity: "hypoechoic" },
    0,
    "TR1 - Benign",
  );
  assertScore(
    { composition: "spongiform", echogenicity: "very_hypoechoic" },
    0,
    "TR1 - Benign",
  );
  assertError(
    { composition: "spongiform", margin: "lobulated" },
    /reassess.*composition|composition.*reassess/i,
  );
  assertError(
    {
      composition: "spongiform",
      echogenic_foci_none: false,
      echogenic_foci_macro: false,
      echogenic_foci_peripheral: false,
      echogenic_foci_punctate: true,
    },
    /reassess.*composition|composition.*reassess/i,
  );
  assertError(
    { composition: "spongiform", echogenicity: "unknown" },
    /echogenicity|invalid|reassess/i,
  );
  assertError({ composition: "cystic", echogenicity: false }, /echogenicity|invalid|reassess/i);
  assertError({ composition: "cystic", shape: 0 }, /shape|invalid|reassess/i);
});

test("validates nodule size as blank or a finite positive number", () => {
  for (const invalidSize of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, true, [], "1.2cm"]) {
    assertError(withValues({ nodule_size: invalidSize }), /size|positive|finite|number/i);
  }

  assertScore(withValues({ nodule_size: "" }), 3, "TR3 - Mildly Suspicious");
});

test("uses ACR size thresholds and the source follow-up schedules without optional FNA language", () => {
  const tr3Below = assertScore(withValues({ nodule_size: "1.4" }), 3, "TR3 - Mildly Suspicious");
  assert.match(tr3Below["FNA Recommendation"], /no routine.*follow-up|no fna/i);
  assert.doesNotMatch(tr3Below["FNA Recommendation"], /optional/i);

  const tr3Follow = assertScore(withValues({ nodule_size: "1.5" }), 3, "TR3 - Mildly Suspicious");
  assert.equal(tr3Follow["Follow-up Recommendation"], "Follow-up at 1, 3, and 5 years");
  assert.doesNotMatch(tr3Follow["FNA Recommendation"], /optional/i);

  const tr3Fna = assertScore(withValues({ nodule_size: "2.5" }), 3, "TR3 - Mildly Suspicious");
  assert.match(tr3Fna["FNA Recommendation"], /FNA recommended/);

  const tr4Follow = assertScore(
    withValues({ echogenicity: "hypoechoic", nodule_size: "1" }),
    4,
    "TR4 - Moderately Suspicious",
  );
  assert.equal(tr4Follow["Follow-up Recommendation"], "Follow-up at 1, 2, 3, and 5 years");

  const tr5Follow = assertScore(
    withValues({ echogenicity: "very_hypoechoic", shape: "taller", nodule_size: "0.5" }),
    8,
    "TR5 - Highly Suspicious",
  );
  assert.equal(tr5Follow["Follow-up Recommendation"], "Annual follow-up for up to 5 years");
  assert.equal(tr5Follow["Source-reported group risk estimate"], ">=20% (source-reported group estimate; not an individual probability)");
});

test("covers below, at, and above every ACR follow-up and FNA boundary", () => {
  const cases = [
    {
      id: "TR3 below follow-up",
      points: 3,
      category: "TR3 - Mildly Suspicious",
      size: "1.4",
      fna: "No FNA or routine TI-RADS follow-up recommended (<1.5 cm)",
      followUp: undefined,
    },
    {
      id: "TR3 at follow-up",
      points: 3,
      category: "TR3 - Mildly Suspicious",
      size: "1.5",
      fna: "No FNA recommended (<2.5 cm)",
      followUp: "Follow-up at 1, 3, and 5 years",
    },
    {
      id: "TR3 above follow-up",
      points: 3,
      category: "TR3 - Mildly Suspicious",
      size: "1.6",
      fna: "No FNA recommended (<2.5 cm)",
      followUp: "Follow-up at 1, 3, and 5 years",
    },
    {
      id: "TR3 below FNA",
      points: 3,
      category: "TR3 - Mildly Suspicious",
      size: "2.4",
      fna: "No FNA recommended (<2.5 cm)",
      followUp: "Follow-up at 1, 3, and 5 years",
    },
    {
      id: "TR3 at FNA",
      points: 3,
      category: "TR3 - Mildly Suspicious",
      size: "2.5",
      fna: "FNA recommended (>=2.5 cm)",
      followUp: undefined,
    },
    {
      id: "TR3 above FNA",
      points: 3,
      category: "TR3 - Mildly Suspicious",
      size: "2.6",
      fna: "FNA recommended (>=2.5 cm)",
      followUp: undefined,
    },
    {
      id: "TR4 below follow-up",
      points: 4,
      category: "TR4 - Moderately Suspicious",
      overrides: { echogenicity: "hypoechoic" },
      size: "0.9",
      fna: "No FNA or routine TI-RADS follow-up recommended (<1.0 cm)",
      followUp: undefined,
    },
    {
      id: "TR4 at follow-up",
      points: 4,
      category: "TR4 - Moderately Suspicious",
      overrides: { echogenicity: "hypoechoic" },
      size: "1.0",
      fna: "No FNA recommended (<1.5 cm)",
      followUp: "Follow-up at 1, 2, 3, and 5 years",
    },
    {
      id: "TR4 above follow-up",
      points: 4,
      category: "TR4 - Moderately Suspicious",
      overrides: { echogenicity: "hypoechoic" },
      size: "1.1",
      fna: "No FNA recommended (<1.5 cm)",
      followUp: "Follow-up at 1, 2, 3, and 5 years",
    },
    {
      id: "TR4 below FNA",
      points: 4,
      category: "TR4 - Moderately Suspicious",
      overrides: { echogenicity: "hypoechoic" },
      size: "1.4",
      fna: "No FNA recommended (<1.5 cm)",
      followUp: "Follow-up at 1, 2, 3, and 5 years",
    },
    {
      id: "TR4 at FNA",
      points: 4,
      category: "TR4 - Moderately Suspicious",
      overrides: { echogenicity: "hypoechoic" },
      size: "1.5",
      fna: "FNA recommended (>=1.5 cm)",
      followUp: undefined,
    },
    {
      id: "TR4 above FNA",
      points: 4,
      category: "TR4 - Moderately Suspicious",
      overrides: { echogenicity: "hypoechoic" },
      size: "1.6",
      fna: "FNA recommended (>=1.5 cm)",
      followUp: undefined,
    },
    {
      id: "TR5 below follow-up",
      points: 8,
      category: "TR5 - Highly Suspicious",
      overrides: { echogenicity: "very_hypoechoic", shape: "taller" },
      size: "0.4",
      fna: "No FNA or routine TI-RADS follow-up recommended (<0.5 cm)",
      followUp: undefined,
    },
    {
      id: "TR5 at follow-up",
      points: 8,
      category: "TR5 - Highly Suspicious",
      overrides: { echogenicity: "very_hypoechoic", shape: "taller" },
      size: "0.5",
      fna: "No FNA recommended (<1.0 cm)",
      followUp: "Annual follow-up for up to 5 years",
    },
    {
      id: "TR5 above follow-up",
      points: 8,
      category: "TR5 - Highly Suspicious",
      overrides: { echogenicity: "very_hypoechoic", shape: "taller" },
      size: "0.6",
      fna: "No FNA recommended (<1.0 cm)",
      followUp: "Annual follow-up for up to 5 years",
    },
    {
      id: "TR5 below FNA",
      points: 8,
      category: "TR5 - Highly Suspicious",
      overrides: { echogenicity: "very_hypoechoic", shape: "taller" },
      size: "0.9",
      fna: "No FNA recommended (<1.0 cm)",
      followUp: "Annual follow-up for up to 5 years",
    },
    {
      id: "TR5 at FNA",
      points: 8,
      category: "TR5 - Highly Suspicious",
      overrides: { echogenicity: "very_hypoechoic", shape: "taller" },
      size: "1.0",
      fna: "FNA recommended (>=1.0 cm)",
      followUp: undefined,
    },
    {
      id: "TR5 above FNA",
      points: 8,
      category: "TR5 - Highly Suspicious",
      overrides: { echogenicity: "very_hypoechoic", shape: "taller" },
      size: "1.1",
      fna: "FNA recommended (>=1.0 cm)",
      followUp: undefined,
    },
  ];

  for (const { id, points, category, overrides = {}, size, fna, followUp } of cases) {
    const result = assertScore(withValues({ ...overrides, nodule_size: size }), points, category);
    assert.equal(result["FNA Recommendation"], fna, id);
    assert.equal(result["Follow-up Recommendation"], followUp, id);
  }
});

test("reports group risk estimates instead of individual probabilities", () => {
  const result = assertScore(withValues(), 3, "TR3 - Mildly Suspicious");
  assert.equal(result["Source-reported group risk estimate"], "5% (source-reported group estimate; not an individual probability)");
  assert.equal(result["Estimated Malignancy Risk"], undefined);
});

test("states adult-nodule scope and clinical-context limitation in calculator metadata", () => {
  assert.match(
    TIRADS.info.text,
    /For adult thyroid nodules; prior biopsy results and patient-specific clinical context can alter management\./,
  );
});
