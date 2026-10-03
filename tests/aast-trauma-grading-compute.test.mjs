import assert from "node:assert/strict";
import test from "node:test";

import "../scripts/register-jsx-loader.mjs";
import { AASTTraumaGrading } from "../src/components/calculators/AASTTraumaGrading.jsx";

// Grade-advance modifiers are bound per organ AND version to the table note that
// states them (Kozar 2018, J Trauma Acute Care Surg 85:1119-1122, Tables 1-3;
// docs/evidence/aast-injury-modifiers.md):
//   liver 2018, spleen 2018 -> multiple grade I-II injuries: +1 grade, ceiling III
//   kidney 2018             -> bilateral renal injuries:     +1 grade, ceiling III
//   pancreas 2024           -> the 1990 AAST pancreas scale's multiple-injury advance
//                              (+1 grade, ceiling III), kept until the 2024 notes are verified
//   kidney 2025 / no version -> the calculator's earlier multiple-injury advance (+1 grade,
//                              ceiling III), unchanged until Keihani 2025's notes are verified
// The app passes hidden field values to compute(), so stale checkbox values must
// never change a grade on a path that does not own the modifier.

const compute = (values) => AASTTraumaGrading.compute(values);
const field = (id) => AASTTraumaGrading.fields.find((f) => f.id === id);
const gradeOf = (result) => {
  assert.equal(result.Error, undefined, `unexpected Error: ${result.Error}`);
  const match = /^Grade ([1-5])$/.exec(result["AAST Grade"]);
  assert.ok(match, `AAST Grade not parsed from ${JSON.stringify(result["AAST Grade"])}`);
  return Number(match[1]);
};

// One single-finding input per base grade, for every organ/version path.
const BASE_VECTORS = {
  liver: {
    1: { organ: "liver", liver_hematoma: "subcapsular_lt10" },
    2: { organ: "liver", liver_hematoma: "subcapsular_10_50" },
    3: { organ: "liver", liver_laceration: "gt3cm" },
    4: { organ: "liver", liver_laceration: "disruption_25_75" },
    5: { organ: "liver", liver_laceration: "disruption_gt75" },
  },
  spleen: {
    1: { organ: "spleen", spleen_hematoma: "subcapsular_lt10" },
    2: { organ: "spleen", spleen_laceration: "1_3cm" },
    3: { organ: "spleen", spleen_laceration: "gt3cm" },
    4: { organ: "spleen", spleen_vascular: "psa_avf" },
    5: { organ: "spleen", spleen_laceration: "shattered" },
  },
  kidney2018: {
    1: { organ: "kidney", kidney_ois_version: "2018", kidney_2018_hematoma: "contusion" },
    2: { organ: "kidney", kidney_ois_version: "2018", kidney_2018_hematoma: "perirenal_gerota" },
    3: { organ: "kidney", kidney_ois_version: "2018", kidney_2018_laceration: "gt1cm_no_cs" },
    4: { organ: "kidney", kidney_ois_version: "2018", kidney_2018_laceration: "into_collecting" },
    5: { organ: "kidney", kidney_ois_version: "2018", kidney_2018_laceration: "shattered" },
  },
  kidney2025: {
    1: { organ: "kidney", kidney_ois_version: "2025", kidney_hematoma: "contusion" },
    2: { organ: "kidney", kidney_ois_version: "2025", kidney_laceration: "lt2_5cm" },
    3: { organ: "kidney", kidney_ois_version: "2025", kidney_laceration: "gte2_5cm_no_cs" },
    4: { organ: "kidney", kidney_ois_version: "2025", kidney_hematoma: "pararenal_extension" },
    5: { organ: "kidney", kidney_ois_version: "2025", kidney_vascular: "main_vessel" },
  },
  // No version chosen: the 2025 path is used and labeled "2025".
  kidneyDefault: {
    1: { organ: "kidney", kidney_hematoma: "contusion" },
    2: { organ: "kidney", kidney_laceration: "lt2_5cm" },
    3: { organ: "kidney", kidney_laceration: "gte2_5cm_no_cs" },
    4: { organ: "kidney", kidney_hematoma: "pararenal_extension" },
    5: { organ: "kidney", kidney_vascular: "main_vessel" },
  },
  pancreas: {
    1: { organ: "pancreas", pancreas_parenchymal: "minor_contusion" },
    2: { organ: "pancreas", pancreas_parenchymal: "major_contusion" },
    3: { organ: "pancreas", pancreas_duct: "partial", pancreas_duct_location: "body_tail" },
    4: { organ: "pancreas", pancreas_duct: "partial", pancreas_duct_location: "head" },
    5: { organ: "pancreas", pancreas_destructive: true },
  },
};

// Which modifier each path owns (null = none verified, never applied).
const OWNED_MODIFIER = {
  liver: "multiple_injuries",
  spleen: "multiple_injuries",
  kidney2018: "kidney_2018_bilateral",
  kidney2025: "multiple_injuries", // earlier advance, unchanged (Keihani 2025 notes not verified)
  kidneyDefault: "multiple_injuries",
  pancreas: "multiple_injuries", // 1990 AAST pancreas scale, kept until the 2024 notes are verified
};
const MODIFIERS = ["multiple_injuries", "kidney_2018_bilateral"];
const advanced = (base) => (base === 1 || base === 2 ? base + 1 : base);

test("every base vector grades as intended with no modifier", () => {
  for (const [path, byGrade] of Object.entries(BASE_VECTORS)) {
    for (const [base, inputs] of Object.entries(byGrade)) {
      const result = compute({ ...inputs });
      assert.equal(gradeOf(result), Number(base), `${path} base ${base}`);
      assert.equal(result["Multiple Injury Adjustment"], undefined, `${path} base ${base}`);
      assert.equal(result["Bilateral Injury Adjustment"], undefined, `${path} base ${base}`);
    }
  }
});

test("each path applies only its own modifier, at the grade I-II boundaries with ceiling III", () => {
  for (const [path, byGrade] of Object.entries(BASE_VECTORS)) {
    for (const [baseText, inputs] of Object.entries(byGrade)) {
      const base = Number(baseText);
      for (const modifier of MODIFIERS) {
        for (const checked of [false, true]) {
          const label = `${path} base ${base} ${modifier}=${checked}`;
          const result = compute({ ...inputs, [modifier]: checked });
          const applies = checked && OWNED_MODIFIER[path] === modifier;
          const expected = applies ? advanced(base) : base;
          assert.equal(gradeOf(result), expected, label);

          const advancedNow = expected !== base;
          // "Grade Description" describes the final grade, not the base grade.
          assert.equal(
            result["Grade Description"],
            compute({ ...BASE_VECTORS[path][expected] })["Grade Description"],
            `${label}: description of the final grade`,
          );
          const findings = result["Key Findings"];
          assert.equal(
            findings.includes("Multiple injuries (+1 grade)"),
            advancedNow && modifier === "multiple_injuries",
            `${label}: multiple-injury finding`,
          );
          assert.equal(
            findings.includes("Bilateral renal injuries (+1 grade)"),
            advancedNow && modifier === "kidney_2018_bilateral",
            `${label}: bilateral finding`,
          );
          if (advancedNow && modifier === "multiple_injuries") {
            assert.equal(
              result["Multiple Injury Adjustment"],
              `Base grade ${base} advanced to Grade ${expected} due to multiple injuries`,
              label,
            );
          } else {
            assert.equal(result["Multiple Injury Adjustment"], undefined, label);
          }
          if (advancedNow && modifier === "kidney_2018_bilateral") {
            assert.equal(
              result["Bilateral Injury Adjustment"],
              `Base grade ${base} advanced to Grade ${expected} due to bilateral renal injuries (2018 kidney OIS)`,
              label,
            );
          } else {
            assert.equal(result["Bilateral Injury Adjustment"], undefined, label);
          }
        }
      }
    }
  }
});

test("explicit boundary vectors: liver/spleen/pancreas multiple and kidney 2018 bilateral", () => {
  const vectors = [
    // [inputs, expected grade]
    [{ ...BASE_VECTORS.liver[1], multiple_injuries: true }, 2],
    [{ ...BASE_VECTORS.liver[2], multiple_injuries: true }, 3],
    [{ ...BASE_VECTORS.liver[3], multiple_injuries: true }, 3],
    [{ ...BASE_VECTORS.liver[4], multiple_injuries: true }, 4],
    [{ ...BASE_VECTORS.spleen[1], multiple_injuries: true }, 2],
    [{ ...BASE_VECTORS.spleen[2], multiple_injuries: true }, 3],
    [{ ...BASE_VECTORS.spleen[3], multiple_injuries: true }, 3],
    [{ ...BASE_VECTORS.spleen[5], multiple_injuries: true }, 5],
    [{ ...BASE_VECTORS.kidney2018[1], kidney_2018_bilateral: true }, 2],
    [{ ...BASE_VECTORS.kidney2018[2], kidney_2018_bilateral: true }, 3],
    [{ ...BASE_VECTORS.kidney2018[3], kidney_2018_bilateral: true }, 3],
    [{ ...BASE_VECTORS.kidney2018[4], kidney_2018_bilateral: true }, 4],
    // The former bug on the 2018 kidney path: "multiple injuries" advanced the grade (its table: highest grade).
    [{ ...BASE_VECTORS.kidney2018[2], multiple_injuries: true }, 2],
    // Primary judge on #304: the 2025 kidney path (and no version) keeps the earlier advance, unchanged.
    [{ ...BASE_VECTORS.kidney2025[2], multiple_injuries: true }, 3],
    [{ ...BASE_VECTORS.kidneyDefault[1], multiple_injuries: true }, 2],
    [{ ...BASE_VECTORS.kidney2025[2], kidney_2018_bilateral: true }, 2],
    // Codex on #304: the pancreas keeps the 1990 scale's advance (not removed without evidence).
    [{ ...BASE_VECTORS.pancreas[1], multiple_injuries: true }, 2],
    [{ ...BASE_VECTORS.pancreas[2], multiple_injuries: true }, 3],
    [{ ...BASE_VECTORS.pancreas[3], multiple_injuries: true }, 3],
    [{ ...BASE_VECTORS.pancreas[5], multiple_injuries: true }, 5],
  ];
  for (const [inputs, expected] of vectors) {
    assert.equal(gradeOf(compute(inputs)), expected, JSON.stringify(inputs));
  }
});

test("after an advance, Grade Description describes the advanced grade (liver, spleen, kidney 2018)", () => {
  const vectors = [
    // [inputs, final grade, description of the final grade]
    [{ ...BASE_VECTORS.liver[1], multiple_injuries: true }, 2, "Moderate - Subcapsular 10-50% or laceration 1-3 cm"],
    [{ ...BASE_VECTORS.liver[2], multiple_injuries: true }, 3, "Serious - Large hematoma or deep laceration or contained bleeding"],
    [{ ...BASE_VECTORS.spleen[1], multiple_injuries: true }, 2, "Moderate - Subcapsular 10-50% or laceration 1-3 cm"],
    [{ ...BASE_VECTORS.spleen[2], multiple_injuries: true }, 3, "Serious - Large hematoma or deep laceration"],
    [{ ...BASE_VECTORS.kidney2018[1], kidney_2018_bilateral: true }, 2, "Moderate - Perirenal hematoma or small laceration ≤1 cm"],
    [{ ...BASE_VECTORS.kidney2018[2], kidney_2018_bilateral: true }, 3, "Serious - Laceration >1 cm or contained vascular injury"],
  ];
  for (const [inputs, final, description] of vectors) {
    const result = compute(inputs);
    assert.equal(gradeOf(result), final, JSON.stringify(inputs));
    assert.equal(result["Grade Description"], description, JSON.stringify(inputs));
    // The base grade is still named by the adjustment line.
    const adjustment = result["Multiple Injury Adjustment"] ?? result["Bilateral Injury Adjustment"];
    assert.match(adjustment, new RegExp(`^Base grade ${final - 1} advanced to Grade ${final} `));
  }
  // Without an advance the description is unchanged.
  assert.equal(compute({ ...BASE_VECTORS.liver[1] })["Grade Description"], "Minor - Subcapsular hematoma <10% or capsular tear <1 cm");
  assert.equal(compute({ ...BASE_VECTORS.liver[3], multiple_injuries: true })["Grade Description"], "Serious - Large hematoma or deep laceration or contained bleeding");
});

const DUCT_LOCATION_ERROR =
  "Select the Location of Duct Injury (neck/body/tail or head) to grade this pancreatic duct injury: it is Grade III in the neck, body or tail and Grade IV in the head.";

test("a pancreatic duct injury without a location fails closed, unless a destructive head injury makes it grade V", () => {
  for (const duct of ["deep_no_interrogation", "partial", "complete_transection"]) {
    for (const location of [undefined, "", "neck", "HEAD", "left"]) {
      for (const extra of [{}, { pancreas_parenchymal: "major_contusion" }]) {
        const inputs = { organ: "pancreas", pancreas_duct: duct, ...extra };
        if (location !== undefined) inputs.pancreas_duct_location = location;
        const result = compute(inputs);
        assert.deepEqual(result, { Error: DUCT_LOCATION_ERROR }, JSON.stringify(inputs));
      }
      // Codex on #304: the location separates grades III and IV only, so a destructive head injury is
      // grade V without one (its critical result and management never wait for an irrelevant answer).
      const destructive = { organ: "pancreas", pancreas_duct: duct, pancreas_destructive: true };
      if (location !== undefined) destructive.pancreas_duct_location = location;
      assert.equal(gradeOf(compute(destructive)), 5, JSON.stringify(destructive));
    }
    // With a location, the 2024 location rule grades it.
    assert.equal(gradeOf(compute({ organ: "pancreas", pancreas_duct: duct, pancreas_duct_location: "body_tail" })), 3, duct);
    assert.equal(gradeOf(compute({ organ: "pancreas", pancreas_duct: duct, pancreas_duct_location: "head" })), 4, duct);
    assert.equal(
      gradeOf(compute({ organ: "pancreas", pancreas_duct: duct, pancreas_duct_location: "body_tail", pancreas_destructive: true })),
      5,
      duct,
    );
  }
  // No duct injury: a location left over from an earlier choice is ignored.
  assert.equal(
    gradeOf(compute({ organ: "pancreas", pancreas_duct: "none", pancreas_duct_location: "head", pancreas_parenchymal: "major_contusion" })),
    2,
  );
  // Pancreas values left over on another organ never raise the error.
  assert.equal(gradeOf(compute({ ...BASE_VECTORS.liver[1], pancreas_duct: "partial" })), 1);
});

const PANCREAS_2024_NOTE =
  "The 2024 pancreas OIS revision's table notes could not be verified, so the multiple-injury advance of the earlier 1990 AAST pancreas scale is kept: multiple injuries raise a grade I–II result by one, to at most Grade III. Clinical judgment applies.";

test("pancreas base grade I-II results say the 1990 advance is kept; no other path carries a grade-advance note", () => {
  const expectedNote = { pancreas: PANCREAS_2024_NOTE };
  for (const [path, byGrade] of Object.entries(BASE_VECTORS)) {
    for (const [baseText, inputs] of Object.entries(byGrade)) {
      const base = Number(baseText);
      for (const stale of [{}, { multiple_injuries: true, kidney_2018_bilateral: true }]) {
        const result = compute({ ...inputs, ...stale });
        const wanted = path === "pancreas" && base <= 2 ? expectedNote[path] : undefined;
        assert.equal(result["Grade-Advance Note"], wanted, `${path} base ${base} ${JSON.stringify(stale)}`);
      }
    }
  }
});

test("liver grade II laceration length follows Kozar 2018 Table 2 (≤10 cm)", () => {
  const laceration = field("liver_laceration").opts.find((opt) => opt.value === "1_3cm");
  assert.equal(laceration.label, "1-3 cm parenchymal depth, ≤10 cm length (Grade II)");
  assert.equal(gradeOf(compute({ organ: "liver", liver_laceration: "1_3cm" })), 2);
});

test("kidney 2018 bilateral advance changes the management tier with the grade", () => {
  const base = compute({ ...BASE_VECTORS.kidney2018[2] });
  const withBilateral = compute({ ...BASE_VECTORS.kidney2018[2], kidney_2018_bilateral: true });
  assert.equal(base["AAST Grade"], "Grade 2");
  assert.equal(withBilateral["AAST Grade"], "Grade 3");
  assert.equal(withBilateral["OIS Version"], "2018");
  assert.match(withBilateral["Management Approach"], /angioembolization for vascular injuries/);
  assert.equal(withBilateral._severity, "warning");
});

test("stale hidden checkbox values never change a grade on a path that does not own them", () => {
  const staleEverything = { multiple_injuries: true, kidney_2018_bilateral: true };
  // Liver/spleen: only the multiple rule applies; a stale bilateral value is ignored.
  assert.equal(gradeOf(compute({ ...BASE_VECTORS.liver[1], kidney_2018_bilateral: true })), 1);
  assert.equal(gradeOf(compute({ ...BASE_VECTORS.spleen[2], kidney_2018_bilateral: true })), 2);
  // Kidney 2018: bilateral applies once, multiple never stacks on top.
  assert.equal(gradeOf(compute({ ...BASE_VECTORS.kidney2018[1], ...staleEverything })), 2);
  // Pancreas: only the multiple rule applies (1990 scale), once; a stale bilateral value is ignored.
  assert.equal(gradeOf(compute({ ...BASE_VECTORS.pancreas[1], ...staleEverything })), 2);
  assert.equal(gradeOf(compute({ ...BASE_VECTORS.pancreas[2], kidney_2018_bilateral: true })), 2);
  // Kidney 2025 (explicit or default): only the earlier multiple advance applies, once; a stale bilateral value
  // (a 2018-only rule) never does.
  for (const inputs of [
    BASE_VECTORS.kidney2025[1],
    BASE_VECTORS.kidney2025[2],
    BASE_VECTORS.kidneyDefault[1],
    BASE_VECTORS.kidneyDefault[2],
  ]) {
    const result = compute({ ...inputs, ...staleEverything });
    assert.equal(gradeOf(result), gradeOf(compute({ ...inputs })) + 1, JSON.stringify(inputs));
    assert.equal(gradeOf(compute({ ...inputs, kidney_2018_bilateral: true })), gradeOf(compute({ ...inputs })), JSON.stringify(inputs));
    assert.equal(result["Bilateral Injury Adjustment"], undefined);
  }
  // Switching kidney 2018 -> 2025 with bilateral still checked must not advance.
  assert.equal(
    gradeOf(compute({ ...BASE_VECTORS.kidney2018[2], kidney_ois_version: "2025", kidney_laceration: "lt2_5cm", kidney_2018_bilateral: true })),
    2,
  );
});

test("modifiers apply only to an explicit boolean true", () => {
  for (const value of ["true", 1, "on", {}, []]) {
    assert.equal(gradeOf(compute({ ...BASE_VECTORS.liver[1], multiple_injuries: value })), 1, String(value));
    assert.equal(
      gradeOf(compute({ ...BASE_VECTORS.kidney2018[1], kidney_2018_bilateral: value })),
      1,
      String(value),
    );
  }
});

test("modifier checkboxes are shown only on the organ/version that owns them", () => {
  const multiple = field("multiple_injuries");
  const bilateral = field("kidney_2018_bilateral");
  assert.equal(multiple.type, "checkbox");
  assert.equal(bilateral.type, "checkbox");
  const cases = [
    [{}, false, false],
    [{ organ: "liver" }, true, false],
    [{ organ: "spleen" }, true, false],
    [{ organ: "kidney" }, true, false],
    [{ organ: "kidney", kidney_ois_version: "2025" }, true, false],
    [{ organ: "kidney", kidney_ois_version: "2018" }, false, true],
    [{ organ: "pancreas" }, true, false],
    // Version values left over from a kidney session do not expose either box elsewhere.
    [{ organ: "liver", kidney_ois_version: "2018" }, true, false],
    [{ organ: "pancreas", kidney_ois_version: "2018" }, true, false],
  ];
  for (const [vals, showMultiple, showBilateral] of cases) {
    assert.equal(multiple.showIf(vals), showMultiple, `multiple ${JSON.stringify(vals)}`);
    assert.equal(bilateral.showIf(vals), showBilateral, `bilateral ${JSON.stringify(vals)}`);
  }
});

test("modifier and reworded subLabels are version-accurate", () => {
  assert.equal(field("multiple_injuries").label, "Multiple Injuries in Same Organ");
  assert.equal(
    field("multiple_injuries").subLabel,
    "Multiple grade I–II injuries: advance one grade, up to Grade III",
  );
  assert.equal(field("kidney_2018_bilateral").label, "Bilateral Renal Injuries");
  assert.equal(
    field("kidney_2018_bilateral").subLabel,
    "Both kidneys injured: advance one grade, up to Grade III (2018 kidney OIS)",
  );
  assert.equal(
    field("kidney_2018_urinary_extrav").subLabel,
    "Excreted contrast leaking outside the collecting system on delayed (excretory) phase → Grade IV",
  );
  assert.equal(
    field("pancreas_destructive").subLabel,
    "Pancreatic head destruction with nonviable parenchyma (2024 revision) → Grade V",
  );
  // The reworded fields keep their scoring.
  assert.equal(
    gradeOf(compute({ organ: "kidney", kidney_ois_version: "2018", kidney_2018_urinary_extrav: true })),
    4,
  );
  assert.equal(gradeOf(compute({ organ: "pancreas", pancreas_destructive: true })), 5);
});

test("kidney version labels: no version chosen runs and reports the 2025 path", () => {
  const selector = field("kidney_ois_version");
  assert.deepEqual(
    selector.opts.map(({ value, label }) => [value, label]),
    [
      ["2025", "2025 Revision (Keihani et al.)"],
      ["2018", "2018 Revision (Kozar et al.)"],
    ],
  );
  const defaulted = compute({ organ: "kidney", kidney_hematoma: "contusion" });
  const explicit = compute({ organ: "kidney", kidney_ois_version: "2025", kidney_hematoma: "contusion" });
  assert.equal(defaulted["OIS Version"], "2025");
  assert.deepEqual(defaulted, explicit);
  // 2025-only urinary extravasation grading (III) differs from 2018 (IV).
  assert.equal(gradeOf(compute({ organ: "kidney", kidney_urinary_extrav: true })), 3);
  assert.equal(
    gradeOf(compute({ organ: "kidney", kidney_ois_version: "2018", kidney_2018_urinary_extrav: true })),
    4,
  );
});

test("the 2025 kidney reference names the published author list", () => {
  const keihani = AASTTraumaGrading.refs.find((ref) => ref.u === "https://pubmed.ncbi.nlm.nih.gov/39836096/");
  assert.ok(keihani, "Keihani 2025 reference is missing");
  assert.match(keihani.t, /^Keihani S, Tominaga GT, Matta R, et al\. Kidney organ injury scaling: 2025 update\./);
});

test("the AAST website reference keeps its citation text without the dead link", () => {
  const aast = AASTTraumaGrading.refs.filter((ref) => ref.t === "AAST Official Website - Organ Injury Scale");
  assert.equal(aast.length, 1);
  assert.equal(aast[0].u, undefined, "the AAST page no longer serves the scales, so no link is given");
  for (const ref of AASTTraumaGrading.refs) {
    assert.ok(!String(ref.u ?? "").includes("resources-detail/injury-scoring-scale"), ref.t);
  }
});
