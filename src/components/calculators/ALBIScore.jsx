// ALBI Score (Albumin-Bilirubin Grade)
// Formula from Johnson et al. J Clin Oncol 2015;33(6):550-558
// ALBI Score = (log₁₀ bilirubin [μmol/L] × 0.66) + (albumin [g/L] × −0.085)
//
// Grading criteria:
// - Grade 1: ≤ −2.60 (source-defined lowest-risk group)
// - Grade 2: > −2.60 to ≤ −1.39 (Intermediate)
// - Grade 3: > −1.39 (source-defined highest-risk group)
//
// Developed and validated in Johnson et al. 2015 for HCC prognosis
//
// Unit conversions:
// - Bilirubin: mg/dL → μmol/L (multiply by 17.104)
// - Albumin: g/dL → g/L (multiply by 10)

import { calculateAlbi } from "../../clinical/albi.js";

// Preserve small positive measurements instead of displaying a false zero.
const formatLabValue = (value) => {
  const rounded = value.toFixed(1);
  return Number(rounded) === 0 ? value.toPrecision(3) : rounded;
};

export const ALBIScore = {
  id: "albi-score",
  category: "Hepatology/Liver",
  name: "ALBI Score",
  desc: "Albumin-Bilirubin grade for liver function assessment in hepatocellular carcinoma (HCC).",
  guidelineVersion: "ALBI Grade (Johnson 2015)",
  showReset: true,
  keywords: ["liver function", "HCC", "hepatocellular", "albumin", "bilirubin"],
  tags: ["Hepatology", "Oncology"],
  metaDesc:
    "Free ALBI Score Calculator. Calculate the source-defined Albumin-Bilirubin grade for objective liver function assessment in HCC. Supports SI and US units.",
  info: {
    text: `The original ALBI model provides an objective assessment of liver function using only albumin and bilirubin. Johnson et al. developed it in 1,313 patients with hepatocellular carcinoma (HCC), then tested it in additional geographic, resection, and sorafenib cohorts and in patients with chronic liver disease without HCC.

• More objective (no subjective parameters like ascites/encephalopathy)
• Uses only two readily available laboratory values
• Produces a continuous linear predictor and three source-defined risk groups
• Was evaluated across multiple HCC cohorts and clinical settings

Scope: ALBI describes liver-function prognosis in studied HCC and chronic-liver-disease cohorts. It does not include tumor burden, determine treatment eligibility, predict individual survival, or replace individualized clinical assessment. It is not a post-transplant outcome predictor.`,
    link: {
      label: "View Johnson et al. 2015 Original Study",
      url: "https://doi.org/10.1200/JCO.2014.57.9151",
    },
  },
  fields: [
    {
      id: "unit_system",
      label: "Unit System",
      subLabel: "Required: select SI or US before calculating; switching changes interpretation, not entered numbers",
      required: true,
      type: "radio",
      opts: [
        { value: "SI", label: "SI units (μmol/L, g/L)" },
        { value: "US", label: "US units (mg/dL, g/dL)" },
      ],
    },
    {
      id: "albumin",
      label: "Serum Albumin",
      type: "number",
      subLabel: "g/L (SI) or g/dL (US); verify the laboratory units",
      step: 0.1,
      min: 0,
    },
    {
      id: "bilirubin",
      label: "Total Bilirubin",
      type: "number",
      subLabel: "μmol/L (SI) or mg/dL (US); verify the laboratory units",
      step: 0.1,
      min: 0,
    },
  ],
  compute: (values = {}) => {
    const hasExplicitUnitSystem =
      values !== null &&
      typeof values === "object" &&
      !Array.isArray(values) &&
      Object.prototype.hasOwnProperty.call(values, "unit_system");
    const clinicalResult = hasExplicitUnitSystem
      ? calculateAlbi(values)
      : { ok: false, code: "INVALID_UNITS", value: null };

    if (!clinicalResult.ok) {
      if (clinicalResult.code === "INVALID_UNITS") {
        return {
          Error: "Select SI or US units before calculating.",
        };
      }
      if (clinicalResult.code === "INVALID_INPUT") {
        return {
          Error: "Please enter valid positive values for albumin and bilirubin.",
        };
      }
      return {
        Error: "The entered values cannot produce a finite ALBI calculation in the selected units. Check the laboratory report and units.",
      };
    }

    const { score: albiScore, grade: albiGrade, albuminSI: albSI, bilirubinSI: biliSI } = clinicalResult;
    let gradeInterpretation, prognosis;

    if (albiGrade === 1) {
      gradeInterpretation = "Lowest-risk group in the original ALBI model";
      prognosis =
        "Source-defined Grade 1 (linear predictor ≤ −2.60). ALBI describes liver-function prognosis in studied cohorts; it does not determine treatment eligibility for an individual patient.";
    } else if (albiGrade === 2) {
      gradeInterpretation = "Intermediate-risk group in the original ALBI model";
      prognosis =
        "Source-defined Grade 2 (linear predictor > −2.60 to ≤ −1.39). ALBI describes liver-function prognosis in studied cohorts; it does not determine treatment eligibility for an individual patient.";
    } else {
      gradeInterpretation = "Highest-risk group in the original ALBI model";
      prognosis =
        "Source-defined Grade 3 (linear predictor > −1.39). ALBI describes liver-function prognosis in studied cohorts; it does not determine treatment eligibility for an individual patient.";
    }

    // Build output object
    const result = {
      ...(clinicalResult.inputReviewRequired ? {
        "Input Check": `Outside application review thresholds (albumin 5–60 g/L; bilirubin 1–1000 μmol/L). Entered albumin ${clinicalResult.albuminInput} ${clinicalResult.usedUSUnits ? "g/dL" : "g/L"} and bilirubin ${clinicalResult.bilirubinInput} ${clinicalResult.usedUSUnits ? "mg/dL" : "μmol/L"}; SI values: ${formatLabValue(albSI)} g/L and ${formatLabValue(biliSI)} μmol/L. Verify against the laboratory report and units. These are software input checks, not physiological or validated model boundaries. Numerical computability does not establish clinical applicability.`,
      } : {}),
      "ALBI Score": albiScore.toFixed(3),
      "ALBI Grade": `Grade ${albiGrade}`,
      "Score Precision": "Score displayed to three decimals; grade uses the unrounded score. A rounded score at a cutoff can therefore accompany the next grade.",
      Interpretation: gradeInterpretation,
      "Clinical Context": prognosis,
      Applicability: "Original ALBI prognosis model studied in HCC and chronic liver disease; not a post-transplant outcome predictor. Does not determine treatment eligibility or predict individual survival.",
      "Input Units": clinicalResult.usedUSUnits
        ? "US (albumin g/dL; bilirubin mg/dL)"
        : "SI (albumin g/L; bilirubin μmol/L)",
    };

    // Add converted SI values if US units were used
    if (clinicalResult.usedUSUnits) {
      result["Converted Bilirubin (SI)"] = `${formatLabValue(biliSI)} μmol/L`;
      result["Converted Albumin (SI)"] = `${formatLabValue(albSI)} g/L`;
      result["Note"] = "Calculation performed using SI units (shown above)";
    } else {
      result["Bilirubin (SI)"] = `${formatLabValue(biliSI)} μmol/L`;
      result["Albumin (SI)"] = `${formatLabValue(albSI)} g/L`;
    }

    result._severity =
      albiGrade === 3 ? "danger" : clinicalResult.inputReviewRequired || albiGrade === 2 ? "warning" : "success";
    return result;
  },
  refs: [
    {
      t: "Johnson PJ, Berhane S, Kagebayashi C, et al. Assessment of liver function in patients with hepatocellular carcinoma: a new evidence-based approach-the ALBI grade. J Clin Oncol. 2015;33(6):550-558.",
      u: "https://doi.org/10.1200/JCO.2014.57.9151",
    },
    {
      t: "Ho SY, Liu PH, Hsu CY, et al. Prognostic role of noninvasive liver reserve markers in patients with hepatocellular carcinoma undergoing transarterial chemoembolization. PLoS One. 2017;12(7):e0180408.",
      u: "https://doi.org/10.1371/journal.pone.0180408",
    },
    {
      t: "Hiraoka A, Kumada T, Michitaka K, et al. Usefulness of albumin-bilirubin grade for evaluation of prognosis of 2584 Japanese patients with hepatocellular carcinoma. J Gastroenterol Hepatol. 2016;31(5):1031-1036.",
      u: "https://doi.org/10.1111/jgh.13250",
    },
    {
      t: "Pinato DJ, Sharma R, Allara E, et al. The ALBI grade provides objective hepatic reserve estimation across each BCLC stage of hepatocellular carcinoma. J Hepatol. 2017;66(2):338-346.",
      u: "https://doi.org/10.1016/j.jhep.2016.09.008",
    },
    {
      t: "Ho SY, Hsu CY, Liu PH, et al. Albumin-bilirubin (ALBI) grade-based nomogram for patients with hepatocellular carcinoma undergoing transarterial chemoembolization. Digestive Diseases and Sciences. 2021;66(5):1730-1738. Supporting multivariable TACE nomogram research; the original two-input ALBI model implemented here does not implement that nomogram.",
      u: "https://doi.org/10.1007/s10620-020-06384-2",
    },
  ],
};
