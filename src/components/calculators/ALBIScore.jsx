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

export const ALBIScore = {
  id: "albi-score",
  category: "Hepatology/Liver",
  name: "ALBI Score",
  desc: "Albumin-Bilirubin grade for liver function assessment in hepatocellular carcinoma (HCC).",
  guidelineVersion: "ALBI Grade (Johnson 2015)",
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

Scope: ALBI describes liver-function prognosis in studied cohorts. It does not include tumor burden, determine treatment eligibility, or replace individualized clinical assessment.`,
    link: {
      label: "View Johnson et al. 2015 Original Study",
      url: "https://doi.org/10.1200/JCO.2014.57.9151",
    },
  },
  fields: [
    {
      id: "unit_system",
      label: "Unit System",
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
      subLabel: "g/L (SI) or g/dL (US)",
      step: 0.1,
      min: 0,
    },
    {
      id: "bilirubin",
      label: "Total Bilirubin",
      type: "number",
      subLabel: "μmol/L (SI) or mg/dL (US)",
      step: 0.1,
      min: 0,
    },
  ],
  compute: ({ unit_system = "SI", albumin = 0, bilirubin = 0 }) => {
    // Parse input values
    const albInput = parseFloat(albumin) || 0;
    const biliInput = parseFloat(bilirubin) || 0;

    // Validate inputs
    if (albInput <= 0 || biliInput <= 0) {
      return {
        Error: "Please enter valid positive values for albumin and bilirubin.",
      };
    }

    // Convert to SI units (μmol/L for bilirubin, g/L for albumin)
    let biliSI, albSI;

    if (unit_system === "US") {
      // Convert from US units to SI
      biliSI = biliInput * 17.104; // mg/dL → μmol/L
      albSI = albInput * 10; // g/dL → g/L
    } else {
      // Already in SI units
      biliSI = biliInput;
      albSI = albInput;
    }

    // Validate converted values are in reasonable physiological range
    if (albSI < 5 || albSI > 60) {
      return {
        Error: `Albumin value ${albSI.toFixed(1)} g/L is outside physiological range (5-60 g/L). Please check unit selection and input.`,
      };
    }

    if (biliSI < 1 || biliSI > 1000) {
      return {
        Error: `Bilirubin value ${biliSI.toFixed(1)} μmol/L is outside physiological range (1-1000 μmol/L). Please check unit selection and input.`,
      };
    }

    // Calculate ALBI Score
    // Formula printed by Johnson et al. 2015:
    // (log₁₀ bilirubin [μmol/L] × 0.66) + (albumin [g/L] × −0.085)
    const albiScore = Math.log10(biliSI) * 0.66 + albSI * -0.085;

    // Determine ALBI Grade
    let albiGrade, gradeInterpretation, prognosis;

    if (albiScore <= -2.6) {
      albiGrade = 1;
      gradeInterpretation = "Lowest-risk group in the original ALBI model";
      prognosis =
        "Source-defined Grade 1 (linear predictor ≤ −2.60). ALBI describes liver-function prognosis in studied cohorts; it does not determine treatment eligibility for an individual patient.";
    } else if (albiScore <= -1.39) {
      albiGrade = 2;
      gradeInterpretation = "Intermediate-risk group in the original ALBI model";
      prognosis =
        "Source-defined Grade 2 (linear predictor > −2.60 to ≤ −1.39). ALBI describes liver-function prognosis in studied cohorts; it does not determine treatment eligibility for an individual patient.";
    } else {
      albiGrade = 3;
      gradeInterpretation = "Highest-risk group in the original ALBI model";
      prognosis =
        "Source-defined Grade 3 (linear predictor > −1.39). ALBI describes liver-function prognosis in studied cohorts; it does not determine treatment eligibility for an individual patient.";
    }

    // Build output object
    const result = {
      "ALBI Score": albiScore.toFixed(3),
      "ALBI Grade": `Grade ${albiGrade}`,
      Interpretation: gradeInterpretation,
      "Clinical Context": prognosis,
    };

    // Add converted SI values if US units were used
    if (unit_system === "US") {
      result["Converted Bilirubin (SI)"] = `${biliSI.toFixed(1)} μmol/L`;
      result["Converted Albumin (SI)"] = `${albSI.toFixed(1)} g/L`;
      result["Note"] = "Calculation performed using SI units (shown above)";
    } else {
      result["Bilirubin (SI)"] = `${biliSI.toFixed(1)} μmol/L`;
      result["Albumin (SI)"] = `${albSI.toFixed(1)} g/L`;
    }

    result._severity =
      albiGrade === 1 ? "success" : albiGrade === 2 ? "warning" : "danger";
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
      t: "Ho SY, Liu PH, Hsu CY, et al. Albumin-bilirubin (ALBI) grade-based nomogram for patients with hepatocellular carcinoma undergoing transarterial chemoembolization. Dig Liver Dis. 2018;50(6):600-606.",
      u: "https://doi.org/10.1016/j.dld.2018.01.128",
    },
  ],
};
