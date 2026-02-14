// ALBI Score (Albumin-Bilirubin Grade)
// Formula from Johnson et al. J Clin Oncol 2015;33(6):550-558
// ALBI Score = (log₁₀ bilirubin [μmol/L] × 0.66) + (albumin [g/L] × −0.0852)
//
// Grading criteria:
// - Grade 1: ≤ −2.60 (Best liver function)
// - Grade 2: > −2.60 to ≤ −1.39 (Intermediate)
// - Grade 3: > −1.39 (Worst liver function)
//
// Originally derived from Ho et al. Br J Cancer 1996;74(11):1838-1842
// Validated in Johnson et al. 2015 for HCC prognosis
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
    "Free ALBI Score Calculator. Calculate Albumin-Bilirubin grade for objective liver function assessment in HCC. Supports SI and US units. Evidence-based prognosis.",
  info: {
    text: `The ALBI grade provides an objective, evidence-based assessment of liver function severity using only albumin and bilirubin. It was developed specifically for patients with hepatocellular carcinoma (HCC) and offers several advantages over Child-Pugh classification:

• More objective (no subjective parameters like ascites/encephalopathy)
• Better prognostic discrimination, especially in well-compensated patients
• Uses only two readily available laboratory values
• Validated across multiple HCC cohorts and treatment modalities

The ALBI score is increasingly used for:
- Refining prognosis within BCLC stages (particularly Stage B substratification)
- Treatment selection and response prediction
- Clinical trial stratification
- Longitudinal monitoring of liver function

Note: ALBI complements but does not replace Child-Pugh in BCLC staging.`,
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
    // Formula: (log₁₀ bilirubin [μmol/L] × 0.66) + (albumin [g/L] × −0.0852)
    const albiScore = Math.log10(biliSI) * 0.66 + albSI * -0.0852;

    // Determine ALBI Grade
    let albiGrade, gradeInterpretation, prognosis;

    if (albiScore <= -2.6) {
      albiGrade = 1;
      gradeInterpretation = "Best liver function - well-compensated";
      prognosis =
        "Grade 1 patients have the best prognosis. Median survival in original cohort: 85.6 months. Suitable for curative therapies (resection, ablation, transplant) and all systemic treatments.";
    } else if (albiScore <= -1.39) {
      albiGrade = 2;
      gradeInterpretation =
        "Intermediate liver function - moderately compensated";
      prognosis =
        "Grade 2 patients have intermediate prognosis. Median survival in original cohort: 23.1 months. May be suitable for locoregional therapies (TACE, TARE) and systemic treatments with monitoring.";
    } else {
      albiGrade = 3;
      gradeInterpretation = "Worst liver function - poorly compensated";
      prognosis =
        "Grade 3 patients have the poorest prognosis. Median survival in original cohort: 6.6 months. Treatment options limited; consider best supportive care or clinical trials. Systemic therapy requires careful assessment of liver reserve.";
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
