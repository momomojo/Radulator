const UMOL_PER_MG_DL = 88.4;
const LB_TO_KG = 0.45359237;

const coefficientOptions = {
  male: {
    factor: 1,
    label: "Historical male coefficient (x1.00)",
  },
  female: {
    factor: 0.85,
    label: "Historical female coefficient (x0.85)",
  },
};

const weightBasisLabels = {
  actual: "Actual body weight",
  ideal: "Ideal body weight",
  adjusted: "Adjusted body weight",
  other: "Other clinician-selected formula weight",
};

function parseFiniteNumber(value) {
  if (value === null || value === undefined) return NaN;
  const text = String(value).trim();
  if (!text) return NaN;
  const number = Number(text);
  return Number.isFinite(number) ? number : NaN;
}

function formatInput(value, decimals = 1) {
  const number = parseFiniteNumber(value);
  return Number.isFinite(number) ? number.toFixed(decimals) : String(value);
}

export function formatOneDecimalHalfUp(value) {
  const rounded = Math.floor((value + 1e-12) * 10 + 0.5) / 10;
  return rounded.toFixed(1);
}

export function computeCockcroftGault(vals) {
  const {
    age_years,
    coefficient,
    weight_unit,
    formula_weight,
    weight_basis,
    scr_unit,
    serum_creatinine,
  } = vals;

  const age = parseFiniteNumber(age_years);
  const weightInput = parseFiniteNumber(formula_weight);
  const scrInput = parseFiniteNumber(serum_creatinine);

  if (!Number.isFinite(age)) {
    return { Error: "Enter a valid finite age in years." };
  }

  if (age < 18) {
    return {
      Error:
        "Cockcroft-Gault V1 is adult-only: age must be at least 18 years.",
    };
  }

  if (!coefficientOptions[coefficient]) {
    return {
      Error:
        "Select the historical male x1.00 or historical female x0.85 formula coefficient. This calculator does not infer or map sex coefficients automatically.",
    };
  }

  if (!["kg", "lb"].includes(weight_unit)) {
    return { Error: "Select the formula weight unit: kg or lb." };
  }

  if (!Number.isFinite(weightInput) || weightInput <= 0) {
    return { Error: "Enter a valid positive formula weight." };
  }

  if (!weightBasisLabels[weight_basis]) {
    return {
      Error:
        "Select the visible formula weight basis: actual, ideal, adjusted, or other clinician-selected.",
    };
  }

  if (!["mg_dl", "umol_l"].includes(scr_unit)) {
    return {
      Error:
        "Select a supported serum creatinine unit: mg/dL or µmol/L.",
    };
  }

  if (!Number.isFinite(scrInput) || scrInput <= 0) {
    return { Error: "Enter a valid positive serum creatinine value." };
  }

  const formulaWeightKg =
    weight_unit === "lb" ? weightInput * LB_TO_KG : weightInput;
  const serumCreatinineMgDl =
    scr_unit === "umol_l" ? scrInput / UMOL_PER_MG_DL : scrInput;
  const coefficientDef = coefficientOptions[coefficient];
  const rawCrCl =
    ((140 - age) * formulaWeightKg * coefficientDef.factor) /
    (72 * serumCreatinineMgDl);

  if (!Number.isFinite(rawCrCl) || rawCrCl <= 0) {
    return {
      Error:
        "The Cockcroft-Gault calculation could not produce a finite positive estimate. Check age, weight, and serum creatinine entries.",
    };
  }

  const result = {
    "Estimated creatinine clearance (Cockcroft-Gault)": `${formatOneDecimalHalfUp(rawCrCl)} mL/min`,
    "Formula Weight": `${formulaWeightKg.toFixed(1)} kg${
      weight_unit === "lb" ? ` (${formatInput(formula_weight, 1)} lb input)` : ""
    }`,
    "Formula Weight Basis": `${weightBasisLabels[weight_basis]}; clinician-selected, no automatic weight selection applied.`,
    "Serum Creatinine Input": `${formatInput(serum_creatinine, scr_unit === "umol_l" ? 0 : 2)} ${
      scr_unit === "umol_l" ? "µmol/L" : "mg/dL"
    }`,
    "Serum Creatinine Used":
      scr_unit === "umol_l"
        ? `${serumCreatinineMgDl.toFixed(4)} mg/dL (converted internally with /88.4)`
        : `${serumCreatinineMgDl.toFixed(2)} mg/dL`,
    "Formula Coefficient": coefficientDef.label,
    "Coefficient Limitation":
      "The 1976 equation uses historical binary coefficients; do not silently map unknown, transgender, or intersex patients to x1.00.",
    "Method Note":
      "Educational decision-support only: adult legacy-label eCrCl in mL/min; not eGFR, not indexed to 1.73 m2, not a dose recommendation, and not a contrast decision.",
    _severity: "neutral",
  };

  if (age > 92) {
    result["Age Caution"] =
      "Age is above 92 years, outside the reported original derivation range; interpret only with clinical review.";
  }

  if (weight_basis === "actual") {
    result["Weight Basis Caution"] =
      "Actual body weight was selected. In severe obesity, underweight, or body-composition discordance, confirm the selected formula weight against the applicable label/local protocol; V1 does not choose a winner.";
  }

  result["Scope / Limitations"] =
    "Use only with stable serum creatinine. Results may be misleading in AKI, rapidly changing renal function, suspected augmented renal clearance, critical illness, pregnancy, amputation, spinal cord injury, cachexia/frailty, severe obesity or underweight, or unusual muscle mass/diet/supplement states.";

  return result;
}

export const CockcroftGault = {
  id: "cockcroft-gault",
  category: "Nephrology",
  name: "Cockcroft-Gault eCrCl",
  desc: "Adult legacy-label estimated creatinine clearance using Cockcroft-Gault.",
  guidelineVersion: "Cockcroft-Gault V1 (approved 2026)",
  keywords: [
    "Cockcroft-Gault",
    "creatinine clearance",
    "eCrCl",
    "renal function",
    "serum creatinine",
  ],
  tags: ["Nephrology", "Safety", "Creatinine"],
  metaDesc:
    "Free Cockcroft-Gault eCrCl calculator. Adult legacy-label estimated creatinine clearance with explicit weight basis, exact µmol/L conversion, and clinical limitations.",
  info: {
    text: `Cockcroft-Gault V1 is an educational decision-support display for adult legacy-label estimated creatinine clearance (eCrCl) in mL/min. It is not measured GFR, not eGFR, not indexed to 1.73 m2, not medication-dose advice, and not a contrast-risk decision.

Formula:
CrCl = ((140 - age) x clinician-selected formula weight kg) / (72 x SCr mg/dL)
Historical female coefficient: multiply by 0.85

For serum creatinine entered in µmol/L, this calculator converts internally with:
SCr mg/dL = SCr µmol/L / 88.4

The rounded SI orientation coefficients 1.23 and 1.04 are not used for internal arithmetic. Formula weight must be clinician-selected with a visible basis; V1 does not auto-select actual, ideal, or adjusted weight.

Use only when serum creatinine is stable. Results may be misleading in acute kidney injury, rapidly changing renal function, suspected augmented renal clearance, critical illness, pregnancy, amputation, spinal cord injury, cachexia/frailty, severe obesity or underweight, or unusual muscle mass/diet/supplement states. When accuracy is consequential or estimates conflict, follow the applicable label/local protocol and consider creatinine-cystatin C eGFR, measured GFR/CrCl, pharmacy, nephrology, or the treating clinician.`,
    link: {
      label: "View original Cockcroft-Gault source",
      url: "https://pubmed.ncbi.nlm.nih.gov/1244564/",
    },
  },
  fields: [
    {
      id: "age_years",
      label: "Age",
      type: "number",
      subLabel: "years; adult use only",
    },
    {
      id: "coefficient",
      label: "Formula Coefficient",
      type: "radio",
      opts: [
        { value: "male", label: "Historical male coefficient (x1.00)" },
        { value: "female", label: "Historical female coefficient (x0.85)" },
      ],
    },
    {
      id: "weight_unit",
      label: "Formula Weight Unit",
      type: "radio",
      opts: [
        { value: "kg", label: "Kilograms (kg)" },
        { value: "lb", label: "Pounds (lb)" },
      ],
    },
    {
      id: "formula_weight",
      label: "Formula Weight",
      type: "number",
      subLabel: "clinician-selected",
    },
    {
      id: "weight_basis",
      label: "Formula Weight Basis",
      type: "select",
      opts: [
        { value: "actual", label: "Actual body weight" },
        { value: "ideal", label: "Ideal body weight" },
        { value: "adjusted", label: "Adjusted body weight" },
        { value: "other", label: "Other clinician-selected" },
      ],
    },
    {
      id: "scr_unit",
      label: "Serum Creatinine Unit",
      type: "radio",
      opts: [
        { value: "mg_dl", label: "mg/dL" },
        { value: "umol_l", label: "µmol/L" },
      ],
    },
    {
      id: "serum_creatinine",
      label: "Serum Creatinine",
      type: "number",
      subLabel: "stable value only",
    },
  ],
  compute: computeCockcroftGault,
  refs: [
    {
      t: "Cockcroft DW, Gault MH. Prediction of creatinine clearance from serum creatinine. Nephron. 1976;16(1):31-41.",
      u: "https://pubmed.ncbi.nlm.nih.gov/1244564/",
    },
    {
      t: "KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease.",
      u: "https://kdigo.org/wp-content/uploads/2024/03/KDIGO-2024-CKD-Guideline.pdf",
    },
    {
      t: "U.S. Food and Drug Administration. Pharmacokinetics in Patients with Impaired Renal Function - Study Design, Data Analysis, and Impact on Dosing. March 2024.",
      u: "https://www.fda.gov/media/78573/download?attachment",
    },
    {
      t: "National Institute of Diabetes and Digestive and Kidney Diseases. Determining Drug Dosing in Adults with Chronic Kidney Disease. Last reviewed October 2024.",
      u: "https://www.niddk.nih.gov/research-funding/research-programs/kidney-clinical-research-epidemiology/laboratory/ckd-drug-dosing-providers",
    },
    {
      t: "Bzowyckyj A, et al. Moving forward from Cockcroft-Gault creatinine clearance to race-free estimated glomerular filtration rate to improve medication-related decision-making in adults across healthcare settings. Am J Health Syst Pharm. 2025;82(12):644-659.",
      u: "https://pubmed.ncbi.nlm.nih.gov/39552516/",
    },
    {
      t: "National Kidney Foundation. Race-Agnostic eGFR for Medication-Related Decisions: Frequently Asked Questions.",
      u: "https://www.kidney.org/professionals/ckdintercept/race-agnostic-egfr-medication-related-decisions/faq",
    },
    {
      t: "Wilhelm SM, Kale-Pradhan PB. Estimating creatinine clearance: a meta-analysis. Pharmacotherapy. 2011;31(9):658-664.",
      u: "https://pubmed.ncbi.nlm.nih.gov/21923452/",
    },
    {
      t: "Winter MA, Guhr KN, Berg GM. Impact of various body weights and serum creatinine concentrations on the bias and accuracy of the Cockcroft-Gault equation. Pharmacotherapy. 2012;32(7):604-612.",
      u: "https://pubmed.ncbi.nlm.nih.gov/22576791/",
    },
    {
      t: "Bouquegneau A, et al. Creatinine-based equations for the adjustment of drug dosage in an obese population. Br J Clin Pharmacol. 2016;81(2):349-361.",
      u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4833161/",
    },
    {
      t: "Cucci MD, et al. Performance of different body weights in the Cockcroft-Gault equation in critically ill patients with and without augmented renal clearance. Pharmacotherapy. 2023;43(11):1131-1138.",
      u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10947228/",
    },
    {
      t: "Garimella PS, et al. Tubular Secretion of Creatinine and Risk of Kidney Failure: The MDRD Study. Am J Kidney Dis. 2021;77(6):992-994.",
      u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8134514/",
    },
    {
      t: "Medicines and Healthcare products Regulatory Agency. Prescribing medicines in renal impairment: using the appropriate estimate of renal function to avoid adverse drug reactions. 18 October 2019.",
      u: "https://www.gov.uk/drug-safety-update/prescribing-medicines-in-renal-impairment-using-the-appropriate-estimate-of-renal-function-to-avoid-the-risk-of-adverse-drug-reactions",
    },
    {
      t: "NHS Specialist Pharmacy Service. Calculating kidney function. Last updated 16 April 2024.",
      u: "https://www.sps.nhs.uk/articles/calculating-kidney-function/",
    },
  ],
};

export default CockcroftGault;
