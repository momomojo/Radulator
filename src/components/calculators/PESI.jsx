const REQUIRED_INPUTS = [
  "age_years",
  "male_sex_criterion",
  "cancer",
  "heart_failure",
  "chronic_lung_disease",
  "pulse",
  "systolic_bp",
  "respiratory_rate",
  "temperature_c",
  "altered_mental_status",
  "oxygen_saturation",
];

function isMissing(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function hasCompletePesiInputs(values = {}) {
  return REQUIRED_INPUTS.every((id) => !isMissing(values[id]));
}

function parseRequiredNumber(value) {
  if (isMissing(value)) return NaN;
  return Number(value);
}

function parseExplicitCriterion(
  value,
  fieldLabel,
  presentValue = "yes",
  absentValue = "no",
) {
  if (value === presentValue) return true;
  if (value === absentValue) return false;
  return { Error: `Select whether ${fieldLabel} is present or absent.` };
}

function classifyPesi(score) {
  if (score <= 65) {
    return { className: "I", label: "Very low", range: "0-1.6%" };
  }
  if (score <= 85) {
    return { className: "II", label: "Low", range: "1.7-3.5%" };
  }
  if (score <= 105) {
    return { className: "III", label: "Intermediate", range: "3.2-7.1%" };
  }
  if (score <= 125) {
    return { className: "IV", label: "High", range: "4.0-11.4%" };
  }
  return { className: "V", label: "Very high", range: "10.0-24.5%" };
}

export function computePESI(values = {}) {
  if (!hasCompletePesiInputs(values)) {
    return {
      Error:
        "Complete all 11 required PESI inputs, including an explicit present or absent choice for every clinical criterion.",
    };
  }

  const age = parseRequiredNumber(values.age_years);
  const pulse = parseRequiredNumber(values.pulse);
  const systolicBp = parseRequiredNumber(values.systolic_bp);
  const respiratoryRate = parseRequiredNumber(values.respiratory_rate);
  const temperatureC = parseRequiredNumber(values.temperature_c);
  const oxygenSaturation = parseRequiredNumber(values.oxygen_saturation);

  if (!Number.isFinite(age) || !Number.isInteger(age) || age < 18) {
    return { Error: "Enter age as a whole number of years (18 or older)." };
  }
  if (!Number.isFinite(pulse) || pulse <= 0) {
    return { Error: "Enter a finite positive pulse in beats per minute." };
  }
  if (!Number.isFinite(systolicBp) || systolicBp <= 0) {
    return { Error: "Enter a finite positive systolic blood pressure in mm Hg." };
  }
  if (!Number.isFinite(respiratoryRate) || respiratoryRate <= 0) {
    return { Error: "Enter a finite positive respiratory rate in breaths per minute." };
  }
  if (!Number.isFinite(temperatureC) || temperatureC <= 0) {
    return { Error: "Enter a finite positive temperature in degrees Celsius." };
  }
  if (
    !Number.isFinite(oxygenSaturation) ||
    oxygenSaturation < 0 ||
    oxygenSaturation > 100
  ) {
    return { Error: "Enter oxygen saturation as a value from 0% through 100%." };
  }

  const criterionDefinitions = [
    [
      "male_sex_criterion",
      "the original-model male sex criterion",
      "present",
      "absent",
    ],
    ["cancer", "cancer", "yes", "no"],
    ["heart_failure", "heart failure", "yes", "no"],
    ["chronic_lung_disease", "chronic lung disease", "yes", "no"],
    ["altered_mental_status", "altered mental status", "yes", "no"],
  ];
  const criteria = {};

  for (const [id, label, presentValue, absentValue] of criterionDefinitions) {
    const parsed = parseExplicitCriterion(
      values[id],
      label,
      presentValue,
      absentValue,
    );
    if (typeof parsed === "object") return parsed;
    criteria[id] = parsed;
  }

  const pointRows = [
    ["Age in years", age],
    ["Original-model male sex criterion", criteria.male_sex_criterion ? 10 : 0],
    ["Cancer", criteria.cancer ? 30 : 0],
    ["Heart failure", criteria.heart_failure ? 10 : 0],
    ["Chronic lung disease", criteria.chronic_lung_disease ? 10 : 0],
    ["Pulse ≥110/min", pulse >= 110 ? 20 : 0],
    ["Systolic blood pressure <100 mm Hg", systolicBp < 100 ? 30 : 0],
    ["Respiratory rate ≥30/min", respiratoryRate >= 30 ? 20 : 0],
    ["Temperature <36.0 °C", temperatureC < 36 ? 20 : 0],
    ["Altered mental status", criteria.altered_mental_status ? 60 : 0],
    ["Oxygen saturation <90%", oxygenSaturation < 90 ? 20 : 0],
  ];
  const score = pointRows.reduce((total, [, points]) => total + points, 0);
  const classification = classifyPesi(score);
  const lowClinicalSeverity = score <= 85;

  return {
    "PESI Score": `${score} points`,
    "PESI Class": `${classification.className} — ${classification.label} PESI mortality class`,
    "Observed 30-Day Mortality Range": `${classification.range} across the original derivation, internal-validation, and external-validation cohorts; this is not an individualized probability.`,
    "2026 AHA/ACC Clinical-Severity Context": lowClinicalSeverity
      ? "Low PESI clinical-severity score (≤85)"
      : "Elevated PESI clinical-severity score (>85)",
    "Score Breakdown": pointRows
      .map(([label, points]) => `${label}: +${points}`)
      .join("; "),
    "Scope / Safety":
      "PESI estimates short-term prognosis only after acute pulmonary embolism is confirmed. It does not diagnose PE or independently determine outpatient care, ICU need, reperfusion, or a 2026 AHA/ACC Acute PE Clinical Category.",
    "Interpretation Context":
      "Interpret alongside hemodynamic and respiratory status, right-ventricular assessment, biomarkers, bleeding risk, clinical judgment, and local protocols.",
    _severity:
      score <= 85 ? "success" : score <= 105 ? "warning" : "danger",
  };
}

export const PESI = {
  id: "pesi",
  category: "Clinical Decision",
  name: "PESI Score",
  desc: "Adult acute pulmonary embolism 30-day mortality risk classification using the original PESI.",
  guidelineVersion: "Original PESI (2005) · 2026 AHA/ACC context",
  keywords: [
    "PESI",
    "pulmonary embolism severity index",
    "pulmonary embolism prognosis",
    "30-day mortality",
    "acute PE",
  ],
  tags: ["Clinical Decision", "Pulmonary", "Emergency"],
  metaDesc:
    "Free original PESI Score calculator for adults with confirmed acute pulmonary embolism. Calculates the five PESI mortality classes with observed cohort ranges and 2026 AHA/ACC clinical-severity context.",
  info: {
    text: `Use the original Pulmonary Embolism Severity Index (PESI) to classify short-term mortality risk in adults after acute pulmonary embolism has been objectively confirmed. This is a prognostic score, not a diagnostic rule or the simplified PESI.

The score starts with age in years, then adds the source-model increments for the explicitly selected demographic and clinical criteria. Vital-sign thresholds are pulse ≥110/min, systolic blood pressure <100 mm Hg, respiratory rate ≥30/min, temperature <36.0 °C, and oxygen saturation <90% (with or without supplemental oxygen).

The original five classes are reported with mortality ranges observed across the original study cohorts. Those ranges are cohort observations, not a personalized calibrated probability. Current 2026 AHA/ACC context treats PESI ≤85 as a low clinical-severity score and PESI >85 as an elevated score. PESI alone does not assign an AHA/ACC Acute PE Clinical Category or establish “high-risk PE.”`,
    link: {
      label: "View original PESI derivation study",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2718410/",
    },
  },
  fields: [
    {
      id: "age_years",
      label: "Age",
      type: "number",
      subLabel: "whole years; age 18 or older",
      section: "Demographics",
      required: true,
      min: 18,
      step: 1,
    },
    {
      id: "male_sex_criterion",
      label: "Male sex variable in the original model",
      subLabel: "required source-model variable",
      type: "radio",
      section: "Demographics",
      required: true,
      opts: [
        { value: "present", label: "Criterion present (+10)" },
        { value: "absent", label: "Criterion absent (+0)" },
      ],
    },
    {
      id: "cancer",
      label: "Cancer",
      subLabel:
        "diagnosis of cancer other than basal-cell or squamous-cell skin cancer within 6 months, cancer treatment within 6 months, or recurrent/metastatic cancer",
      type: "radio",
      section: "Clinical History",
      required: true,
      opts: [
        { value: "yes", label: "Present (+30)" },
        { value: "no", label: "Absent (+0)" },
      ],
    },
    {
      id: "heart_failure",
      label: "Heart failure",
      type: "radio",
      section: "Clinical History",
      required: true,
      opts: [
        { value: "yes", label: "Present (+10)" },
        { value: "no", label: "Absent (+0)" },
      ],
    },
    {
      id: "chronic_lung_disease",
      label: "Chronic lung disease",
      type: "radio",
      section: "Clinical History",
      required: true,
      opts: [
        { value: "yes", label: "Present (+10)" },
        { value: "no", label: "Absent (+0)" },
      ],
    },
    {
      id: "altered_mental_status",
      label: "Altered mental status",
      subLabel: "disorientation, lethargy, stupor, or coma",
      type: "radio",
      section: "Clinical History",
      required: true,
      opts: [
        { value: "yes", label: "Present (+60)" },
        { value: "no", label: "Absent (+0)" },
      ],
    },
    {
      id: "pulse",
      label: "Pulse",
      type: "number",
      subLabel: "beats/min; +20 at ≥110",
      section: "Vital Signs",
      required: true,
      min: 1,
      step: "any",
    },
    {
      id: "systolic_bp",
      label: "Systolic blood pressure",
      type: "number",
      subLabel: "mm Hg; +30 below 100",
      section: "Vital Signs",
      required: true,
      min: 1,
      step: "any",
    },
    {
      id: "respiratory_rate",
      label: "Respiratory rate",
      type: "number",
      subLabel: "breaths/min; +20 at ≥30",
      section: "Vital Signs",
      required: true,
      min: 1,
      step: "any",
    },
    {
      id: "temperature_c",
      label: "Temperature",
      type: "number",
      subLabel: "°C; +20 below 36.0",
      section: "Vital Signs",
      required: true,
      min: 1,
      step: "any",
    },
    {
      id: "oxygen_saturation",
      label: "Oxygen saturation",
      type: "number",
      subLabel: "% with or without supplemental oxygen; +20 below 90",
      section: "Vital Signs",
      required: true,
      min: 0,
      max: 100,
      step: "any",
    },
  ],
  canRun: hasCompletePesiInputs,
  canRunMessage:
    "Complete all 11 required inputs to enable the PESI calculation; clinical criteria require an explicit present or absent selection.",
  showReset: true,
  compute: computePESI,
  refs: [
    {
      t: "Aujesky D, Obrosky DS, Stone RA, et al. Derivation and validation of a prognostic model for pulmonary embolism. Am J Respir Crit Care Med. 2005;172(8):1041-1046.",
      u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2718410/",
    },
    {
      t: "Aujesky D, Perrier A, Roy PM, et al. Validation of a clinical prognostic model to identify low-risk patients with pulmonary embolism. J Intern Med. 2007;261(6):597-604.",
      u: "https://pubmed.ncbi.nlm.nih.gov/17547715/",
    },
    {
      t: "Zhou XY, Ben SQ, Chen HL, Ni SS. The prognostic value of pulmonary embolism severity index in acute pulmonary embolism: a meta-analysis. Respir Res. 2012;13:111.",
      u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3571977/",
    },
    {
      t: "2026 AHA/ACC/ACCP/ACEP/CHEST/SCAI/SHM/SIR/SVM/SVN Guideline for the Evaluation and Management of Acute Pulmonary Embolism in Adults.",
      u: "https://doi.org/10.1161/CIR.0000000000001415",
    },
    {
      t: "2026 Acute Pulmonary Embolism Guideline-at-a-Glance. J Am Coll Cardiol. 2026.",
      u: "https://www.jacc.org/doi/10.1016/j.jacc.2025.12.023",
    },
    {
      t: "Talerico R, de Wit K, Barco S, et al. Evidence-based risk stratification of patients with acute pulmonary embolism: communication from the ISTH SSC Subcommittee on Predictive and Diagnostic Variables in Thrombotic Disease. J Thromb Haemost. 2026.",
      u: "https://pubmed.ncbi.nlm.nih.gov/41354154/",
    },
  ],
};
