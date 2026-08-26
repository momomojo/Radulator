const KBRC_INPUT_LIMIT_PROVENANCE = "radulator-data-entry-guardrail";
const KBRC_CALIBRATION_WARNING_THRESHOLD = 0.25;

const KBRC_INPUT_LIMITS = {
  age: { label: "Age", min: 18, max: 90, unit: "years" },
  weight: { label: "Weight", min: 30, max: 130, unit: "kg" },
  height: { label: "Height", min: 140, max: 210, unit: "cm" },
  platelets: {
    label: "Platelet count",
    min: 50,
    max: 700,
    unit: "×10⁹/L",
  },
  hemoglobin: { label: "Hemoglobin", min: 70, max: 180, unit: "g/L" },
  kidney_size: {
    label: "Target kidney length",
    min: 8,
    max: 16,
    unit: "cm",
  },
};

function parseFiniteNumber(value) {
  if (value === null || value === undefined) return NaN;
  const text = String(value).trim();
  if (!text) return NaN;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function validateNumericInput(id, value) {
  const range = KBRC_INPUT_LIMITS[id];
  if (value === null || value === undefined || String(value).trim() === "") {
    return { error: `${range.label} is required.` };
  }

  const parsed = parseFiniteNumber(value);
  if (!Number.isFinite(parsed)) {
    return {
      error: `${range.label} must be a finite number in ${range.unit}.`,
    };
  }

  if (parsed < range.min || parsed > range.max) {
    return {
      error: `${range.label} must be ${range.min}–${range.max} ${range.unit}; values outside Radulator input limits are not accepted. These data-entry guardrails are not publication-derived model-validation bounds.`,
    };
  }

  return { value: parsed };
}

function positivePartCubed(value, knot) {
  return Math.max(value - knot, 0) ** 3;
}

export function calculateKbrcMajorBleedingProbability({
  age,
  bmi,
  platelets,
  hemoglobin,
  kidneySize,
  native,
}) {
  const pp = positivePartCubed;
  const linearPredictor =
    2.0998143 +
    0.059035592 * age -
    1.9209284e-5 * pp(age, 31) +
    4.8213766e-5 * pp(age, 57) -
    2.9004482e-5 * pp(age, 74.219456) -
    0.16226705 * kidneySize +
    0.014154593 * pp(kidneySize, 9.5) -
    0.027601456 * pp(kidneySize, 11.4) +
    0.013446863 * pp(kidneySize, 13.4) -
    0.038695221 * hemoglobin -
    8.4544322e-6 * pp(hemoglobin, 79) +
    1.5416906e-5 * pp(hemoglobin, 107) -
    6.9624735e-6 * pp(hemoglobin, 141) -
    0.0033086696 * platelets -
    6.7231169e-9 * pp(platelets, 128.1) +
    1.120357e-8 * pp(platelets, 220) -
    4.4804528e-9 * pp(platelets, 357.9) +
    0.90339297 * Number(native) -
    0.10722806 * bmi +
    0.00051289958 * pp(bmi, 21.67) -
    0.00088913491 * pp(bmi, 28.291414) +
    0.00037623533 * pp(bmi, 37.318);

  const probability =
    linearPredictor >= 0
      ? 1 / (1 + Math.exp(-linearPredictor))
      : Math.exp(linearPredictor) / (1 + Math.exp(linearPredictor));

  return {
    linearPredictor,
    probability: Math.min(1, Math.max(0, probability)),
  };
}

export function calculateBmi(weightKg, heightCm) {
  const weight = parseFiniteNumber(weightKg);
  const height = parseFiniteNumber(heightCm);
  if (!Number.isFinite(weight) || !Number.isFinite(height) || height <= 0) {
    return NaN;
  }
  return weight / (height / 100) ** 2;
}

function formatProbabilityPercent(probability) {
  const percent = probability * 100;
  const rounded = percent.toFixed(1);
  return probability > 0 && rounded === "0.0" ? "<0.1%" : `${rounded}%`;
}

export function computeKidneyBiopsyBleedingRisk(values) {
  const validated = {};
  for (const id of Object.keys(KBRC_INPUT_LIMITS)) {
    const result = validateNumericInput(id, values[id]);
    if (result.error) return { Error: result.error };
    validated[id] = result.value;
  }

  if (
    !Object.prototype.hasOwnProperty.call(
      { native: true, allograft: false },
      values.kidney_type,
    )
  ) {
    return {
      Error: "Select whether the target is a native or transplanted/allograft kidney.",
    };
  }

  const bmi = calculateBmi(validated.weight, validated.height);
  if (!Number.isFinite(bmi) || bmi <= 0) {
    return { Error: "BMI could not be calculated from weight and height." };
  }

  const { linearPredictor, probability } =
    calculateKbrcMajorBleedingProbability({
      age: validated.age,
      bmi,
      platelets: validated.platelets,
      hemoglobin: validated.hemoglobin,
      kidneySize: validated.kidney_size,
      native: values.kidney_type === "native",
    });

  if (!Number.isFinite(probability)) {
    return {
      Error: "The calculation did not produce a finite probability. Check all entries.",
    };
  }

  return {
    "Estimated major bleeding risk after kidney biopsy":
      formatProbabilityPercent(probability),
    "Calculated BMI": `${bmi.toFixed(2)} kg/m²`,
    "Outcome Definition":
      "Biopsy-related bleeding requiring transfusion, surgery or embolization, or resulting in death.",
    "Model Scope":
      "2026 recalibrated preprocedure model for adults undergoing diagnostic percutaneous native- or transplant-kidney biopsy.",
    "Clinical Limitation":
      "Use this estimate with clinical judgment, local biopsy protocols, medication and coagulation review, blood-pressure assessment, and appropriate postprocedure monitoring. Canadian development and validation cohorts used different procedural practices and follow-up windows (one week and one month), so performance may differ elsewhere.",
    ...(probability > KBRC_CALIBRATION_WARNING_THRESHOLD
      ? {
          "Calibration Warning":
            "Estimates above 25% may overpredict major bleeding risk. The 2026 external-validation study reported mild overprediction in this range; do not treat 25% as a risk category or action threshold.",
        }
      : {}),
    "Safety Note":
      "Do not use this percentage alone to decide whether to perform a biopsy, change antithrombotic therapy or prophylaxis, choose monitoring duration, or trigger treatment.",
    _linearPredictor: linearPredictor,
    _probability: probability,
    _severity: "neutral",
  };
}

function deriveBmiDisplay(values) {
  const bmi = calculateBmi(values.weight, values.height);
  return Number.isFinite(bmi) && bmi > 0 ? `${bmi.toFixed(2)} kg/m²` : "—";
}

export const KidneyBiopsyBleedingRisk = {
  id: "kidney-biopsy-bleeding-risk",
  category: "Nephrology",
  name: "Kidney Biopsy Major Bleeding Risk (KBRC)",
  desc: "Estimates major bleeding probability after diagnostic percutaneous native- or transplant-kidney biopsy.",
  guidelineVersion: "Thorne et al. recalibrated major-bleeding model (2026)",
  keywords: [
    "KBRC",
    "kidney biopsy",
    "renal biopsy",
    "major bleeding",
    "transplant kidney",
  ],
  tags: ["Nephrology", "Interventional", "Safety"],
  metaDesc:
    "Free KBRC calculator estimating major bleeding probability after adult diagnostic percutaneous native- or transplant-kidney biopsy using the 2026 recalibrated model.",
  info: {
    text: `This preprocedure model estimates the probability of major bleeding after a diagnostic percutaneous kidney biopsy. It combines age, calculated body mass index, platelet count, hemoglobin, target-kidney length, and native-versus-transplant status.

The displayed estimate uses only the Thorne et al. 2026 recalibrated major-bleeding equation. It does not calculate the earlier any-bleeding or minor-bleeding outcomes, and the evidence does not establish universal probability categories or action thresholds.

Intended scope: adults undergoing an imaging-guided diagnostic percutaneous biopsy of a native or transplanted kidney. It is not validated here for pediatric, kidney-mass, intraoperative implantation, open, or nonpercutaneous biopsy.

The numeric entry limits shown below are conservative Radulator data-entry guardrails, not ranges published as the model's validated domain.

The model was developed and validated in adult Canadian cohorts with few major-bleeding events. Technique, needle size, medication practices, prophylaxis, case mix, and follow-up differed between cohorts and centers. The estimate complements rather than replaces patient-specific assessment and local protocols.`,
    link: {
      label: "View the 2026 external validation and recalibration study",
      url: "https://doi.org/10.1016/j.xkme.2026.101352",
    },
  },
  fields: [
    {
      id: "age",
      label: "Age",
      type: "number",
      subLabel: "years; Radulator input limit 18–90",
      min: 18,
      max: 90,
      step: "any",
      inputMode: "decimal",
    },
    {
      id: "kidney_type",
      label: "Target Kidney Type",
      type: "radio",
      opts: [
        { value: "native", label: "Native kidney" },
        { value: "allograft", label: "Transplanted/allograft kidney" },
      ],
    },
    {
      id: "weight",
      label: "Weight",
      type: "number",
      subLabel: "kg; Radulator input limit 30–130",
      min: 30,
      max: 130,
      step: "any",
      inputMode: "decimal",
    },
    {
      id: "height",
      label: "Height",
      type: "number",
      subLabel: "cm; Radulator input limit 140–210",
      min: 140,
      max: 210,
      step: "any",
      inputMode: "decimal",
    },
    {
      id: "calculated_bmi",
      label: "Calculated BMI",
      type: "derived",
      subLabel: "kg/m²; calculated from weight and height",
      derive: deriveBmiDisplay,
    },
    {
      id: "platelets",
      label: "Platelet Count Before Biopsy",
      type: "number",
      subLabel: "×10⁹/L; Radulator input limit 50–700",
      min: 50,
      max: 700,
      step: "any",
      inputMode: "decimal",
    },
    {
      id: "hemoglobin",
      label: "Hemoglobin Before Biopsy",
      type: "number",
      subLabel: "g/L; Radulator input limit 70–180 (not g/dL)",
      min: 70,
      max: 180,
      step: "any",
      inputMode: "decimal",
    },
    {
      id: "kidney_size",
      label: "Target Kidney Length",
      type: "number",
      subLabel: "cm; greatest ultrasound dimension; Radulator input limit 8–16",
      min: 8,
      max: 16,
      step: "any",
      inputMode: "decimal",
    },
  ],
  compute: computeKidneyBiopsyBleedingRisk,
  refs: [
    {
      t: "Thorne J, Lebedeva V, Thanamayooran A, et al. External Validation and Recalibration of a Risk Calculator for Major Bleeding After Diagnostic Kidney Biopsy. Kidney Med. 2026;8(6):101352.",
      u: "https://doi.org/10.1016/j.xkme.2026.101352",
    },
    {
      t: "Schorr M, Roshanov PS, Weir MA, House AA. Frequency, Timing, and Prediction of Major Bleeding Complications From Percutaneous Renal Biopsy. Can J Kidney Health Dis. 2020;7:2054358120923527.",
      u: "https://doi.org/10.1177/2054358120923527",
    },
    {
      t: "Schorr M, Roshanov PS, Vandelinde J, House AA. Risk and Timing of Major Bleeding Complications Requiring Intervention of the Percutaneous Kidney Biopsy With a Short Observation Protocol. Can J Kidney Health Dis. 2023;10:20543581231205334.",
      u: "https://doi.org/10.1177/20543581231205334",
    },
  ],
};

export default KidneyBiopsyBleedingRisk;

export {
  KBRC_CALIBRATION_WARNING_THRESHOLD,
  KBRC_INPUT_LIMITS,
  KBRC_INPUT_LIMIT_PROVENANCE,
};
