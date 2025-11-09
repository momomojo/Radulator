/**
 * BCLC (Barcelona Clinic Liver Cancer) Staging Calculator
 *
 * The Barcelona Clinic Liver Cancer (BCLC) staging system is the gold standard
 * for hepatocellular carcinoma (HCC) staging. It integrates tumor burden, liver
 * function (Child-Pugh), performance status (ECOG), and cancer symptoms to provide
 * prognostic stratification and evidence-based treatment recommendations.
 *
 * Primary Sources:
 * - Llovet JM, Bru C, Bruix J. Semin Liver Dis. 1999;19(3):329-338 (Original BCLC)
 * - Reig M, Forner A, Rimola J, et al. J Hepatol. 2022;76(3):681-693 (2022 Update)
 * - Pugh RN, Murray-Lyon IM, et al. Br J Surg. 1973;60(8):646-649 (Child-Pugh)
 */

export const BCLCStaging = {
  id: "bclc-staging",
  name: "BCLC Staging (HCC)",
  desc: "Barcelona Clinic Liver Cancer staging for hepatocellular carcinoma with treatment recommendations.",

  info: {
    text: `The Barcelona Clinic Liver Cancer (BCLC) staging system is the most widely used classification for hepatocellular carcinoma (HCC). It integrates tumor burden, liver function, performance status, and cancer symptoms to provide prognostic stratification and evidence-based treatment recommendations.

The system classifies patients into 5 stages:
• Stage 0 (Very Early): Single tumor ≤2 cm
• Stage A (Early): Single tumor OR up to 3 tumors ≤3 cm
• Stage B (Intermediate): Multifocal disease without invasion
• Stage C (Advanced): Vascular invasion or metastasis
• Stage D (Terminal): Poor performance or decompensated cirrhosis

Endorsed by EASL, AASLD, and EORTC guidelines.`,
    link: {
      label: "View BCLC 2022 Guidelines",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8866082/"
    }
  },

  fields: [
    // SECTION 1: TUMOR BURDEN
    {
      id: "tumor_number",
      label: "Number of Tumors",
      type: "radio",
      opts: [
        { value: "single", label: "Single tumor" },
        { value: "2-3", label: "2-3 tumors" },
        { value: ">3", label: "More than 3 tumors" }
      ]
    },
    {
      id: "largest_tumor_size",
      label: "Largest Tumor Size (cm)",
      type: "number",
      subLabel: "Diameter in cm"
    },
    {
      id: "all_tumors_size",
      label: "All Tumors ≤3 cm? (if multiple)",
      type: "radio",
      opts: [
        { value: "yes", label: "Yes - all tumors ≤3 cm" },
        { value: "no", label: "No - at least one tumor >3 cm" },
        { value: "na", label: "N/A - single tumor" }
      ]
    },

    // SECTION 2: VASCULAR INVASION & METASTASIS
    {
      id: "vascular_invasion",
      label: "Vascular Invasion",
      type: "radio",
      opts: [
        { value: "none", label: "None" },
        { value: "portal_segmental", label: "Portal vein - segmental/sectoral" },
        { value: "portal_main", label: "Portal vein - left/right/main trunk" },
        { value: "hepatic_vein", label: "Hepatic vein invasion" }
      ]
    },
    {
      id: "extrahepatic_spread",
      label: "Extrahepatic Spread",
      type: "radio",
      opts: [
        { value: "none", label: "None" },
        { value: "lymph_nodes", label: "Lymph node metastasis" },
        { value: "distant", label: "Distant metastasis (lung, bone, etc.)" }
      ]
    },

    // SECTION 3: PERFORMANCE STATUS
    {
      id: "ecog_ps",
      label: "ECOG Performance Status",
      type: "radio",
      opts: [
        { value: "0", label: "0 - Fully active, no restrictions" },
        { value: "1", label: "1 - Restricted in strenuous activity, ambulatory" },
        { value: "2", label: "2 - Ambulatory, self-care capable, unable to work" },
        { value: "3", label: "3 - Limited self-care, confined >50% of time" },
        { value: "4", label: "4 - Completely disabled, bedbound" }
      ]
    },

    // SECTION 4: LIVER FUNCTION (Child-Pugh Components)
    {
      id: "bilirubin",
      label: "Total Bilirubin (mg/dL)",
      type: "number",
      subLabel: "Normal: <1.2 mg/dL"
    },
    {
      id: "albumin",
      label: "Serum Albumin (g/dL)",
      type: "number",
      subLabel: "Normal: 3.5-5.5 g/dL"
    },
    {
      id: "inr",
      label: "INR",
      type: "number",
      subLabel: "Normal: <1.1"
    },
    {
      id: "ascites",
      label: "Ascites",
      type: "radio",
      opts: [
        { value: "none", label: "None" },
        { value: "mild", label: "Mild/Moderate (diuretic-responsive)" },
        { value: "severe", label: "Severe (refractory)" }
      ]
    },
    {
      id: "encephalopathy",
      label: "Hepatic Encephalopathy",
      type: "radio",
      opts: [
        { value: "none", label: "None" },
        { value: "grade1-2", label: "Grade 1-2 (mild confusion/lethargy)" },
        { value: "grade3-4", label: "Grade 3-4 (stupor/coma)" }
      ]
    },

    // SECTION 5: TRANSPLANT ELIGIBILITY
    {
      id: "transplant_candidate",
      label: "Liver Transplant Candidate?",
      type: "radio",
      opts: [
        { value: "yes", label: "Yes - eligible for transplant" },
        { value: "no", label: "No - not a candidate" },
        { value: "unknown", label: "Unknown" }
      ]
    }
  ],

  compute: (vals) => {
    const {
      tumor_number = "",
      largest_tumor_size = "",
      all_tumors_size = "",
      vascular_invasion = "",
      extrahepatic_spread = "",
      ecog_ps = "",
      bilirubin = "",
      albumin = "",
      inr = "",
      ascites = "",
      encephalopathy = "",
      transplant_candidate = ""
    } = vals;

    // Parse numeric values
    const tumorSize = parseFloat(largest_tumor_size) || 0;
    const bili = parseFloat(bilirubin) || 0;
    const alb = parseFloat(albumin) || 0;
    const inrVal = parseFloat(inr) || 0;
    const ecog = parseInt(ecog_ps) || 0;

    // STEP 1: Calculate Child-Pugh Score
    // Formula from Pugh RN, et al. Br J Surg. 1973;60(8):646-649
    let cpScore = 0;

    // Bilirubin scoring
    if (bili < 2) cpScore += 1;
    else if (bili >= 2 && bili <= 3) cpScore += 2;
    else if (bili > 3) cpScore += 3;

    // Albumin scoring
    if (alb > 3.5) cpScore += 1;
    else if (alb >= 2.8 && alb <= 3.5) cpScore += 2;
    else if (alb < 2.8) cpScore += 3;

    // INR scoring
    if (inrVal < 1.7) cpScore += 1;
    else if (inrVal >= 1.7 && inrVal <= 2.2) cpScore += 2;
    else if (inrVal > 2.2) cpScore += 3;

    // Ascites scoring
    if (ascites === "none") cpScore += 1;
    else if (ascites === "mild") cpScore += 2;
    else if (ascites === "severe") cpScore += 3;

    // Encephalopathy scoring
    if (encephalopathy === "none") cpScore += 1;
    else if (encephalopathy === "grade1-2") cpScore += 2;
    else if (encephalopathy === "grade3-4") cpScore += 3;

    // Determine Child-Pugh Class
    let cpClass = "";
    if (cpScore >= 5 && cpScore <= 6) cpClass = "A";
    else if (cpScore >= 7 && cpScore <= 9) cpClass = "B";
    else if (cpScore >= 10) cpClass = "C";

    // STEP 2: BCLC Staging Algorithm
    // Based on Reig M, et al. J Hepatol. 2022;76(3):681-693
    // Decision tree: Check D → C → B/A/0

    let bclcStage = "";
    let treatment = "";
    let prognosis = "";
    let details = "";

    // Check for Stage D criteria first (terminal)
    if (ecog > 2 || (cpClass === "C" && transplant_candidate !== "yes")) {
      bclcStage = "D";
      treatment = "Best supportive care, symptomatic treatment";
      prognosis = "Median survival: ~3 months";
      details = "Terminal stage due to ";
      if (ecog > 2) details += "poor performance status (ECOG >2)";
      if (cpClass === "C" && transplant_candidate !== "yes") {
        if (ecog > 2) details += " and ";
        details += "decompensated cirrhosis (Child-Pugh C) without transplant option";
      }
    }
    // Check for Stage C criteria (advanced)
    else if (
      vascular_invasion !== "none" ||
      extrahepatic_spread !== "none"
    ) {
      bclcStage = "C";
      treatment = "Systemic therapy: Atezolizumab + Bevacizumab (1st line); Sorafenib or Lenvatinib (alternatives); Regorafenib, Cabozantinib (2nd line)";
      prognosis = "Median survival: ~2 years with systemic therapy";
      details = "Advanced stage due to ";
      if (vascular_invasion !== "none") {
        details += `vascular invasion (${vascular_invasion.replace(/_/g, " ")})`;
      }
      if (extrahepatic_spread !== "none") {
        if (vascular_invasion !== "none") details += " and ";
        details += `extrahepatic spread (${extrahepatic_spread.replace(/_/g, " ")})`;
      }
    }
    // Stage 0, A, or B - depends on tumor burden
    else {
      // Stage 0: Single tumor ≤2 cm, ECOG 0, Child-Pugh A
      if (tumor_number === "single" && tumorSize <= 2 && ecog === 0 && cpClass === "A") {
        bclcStage = "0";
        treatment = "Resection or ablation (RFA/MWA) preferred; TACE if ablation not feasible";
        prognosis = "Median survival: >5 years (5-year survival: 75%)";
        details = "Very early stage: Single tumor ≤2 cm, ECOG 0, preserved liver function";
      }
      // Stage A: Single tumor (any size) OR up to 3 tumors ≤3 cm each, ECOG 0
      else if (
        ecog === 0 &&
        (tumor_number === "single" ||
        (tumor_number === "2-3" && all_tumors_size === "yes"))
      ) {
        bclcStage = "A";
        treatment = "Resection or ablation; Liver transplant if high recurrence risk or multiple tumors; TACE as alternative";
        prognosis = "Median survival: >5 years (median OS: 81 months)";
        details = "Early stage: ";
        if (tumor_number === "single") {
          details += `Single tumor (${tumorSize} cm)`;
        } else {
          details += "2-3 tumors, all ≤3 cm (within Milan criteria)";
        }
        details += ", ECOG 0, preserved liver function";
      }
      // Stage B: Multifocal beyond Stage A criteria, ECOG 0
      else if (ecog === 0) {
        bclcStage = "B";
        treatment = "TACE (for well-defined nodules); Systemic therapy (for diffuse/extensive disease); Liver transplant (if extended criteria met + downstaging)";
        prognosis = "Median survival: ~2.5 years (30 months)";
        details = "Intermediate stage: Multifocal HCC beyond Stage A criteria";
        if (tumor_number === ">3") {
          details += " (>3 tumors)";
        } else if (all_tumors_size === "no") {
          details += " (at least one tumor >3 cm)";
        }
        details += ", ECOG 0, preserved liver function";
      }
      // Fallback for ECOG 1-2 without vascular invasion/metastasis
      else {
        bclcStage = "B-C";
        treatment = "Consider TACE or systemic therapy based on tumor burden and symptoms";
        prognosis = "Median survival: 2-3 years depending on performance status";
        details = "Borderline intermediate-advanced: No vascular invasion but impaired performance status (ECOG 1-2)";
      }
    }

    // Build output object
    const result = {
      "BCLC Stage": bclcStage,
      "Stage Details": details,
      "Child-Pugh Score": `${cpScore} points (Class ${cpClass})`,
      "ECOG Performance Status": ecog_ps,
      "Recommended Treatment": treatment,
      "Expected Prognosis": prognosis
    };

    // Add liver function interpretation
    if (cpClass === "A") {
      result["Liver Function"] = "Well-compensated cirrhosis (Class A)";
    } else if (cpClass === "B") {
      result["Liver Function"] = "Significantly compromised function (Class B)";
    } else {
      result["Liver Function"] = "Decompensated cirrhosis (Class C)";
    }

    return result;
  },

  refs: [
    {
      t: "Llovet JM, Bru C, Bruix J. Prognosis of hepatocellular carcinoma: the BCLC staging classification. Semin Liver Dis. 1999;19(3):329-338.",
      u: "https://doi.org/10.1055/s-2007-1007122"
    },
    {
      t: "Reig M, Forner A, Rimola J, et al. BCLC strategy for prognosis prediction and treatment recommendation: The 2022 update. J Hepatol. 2022;76(3):681-693.",
      u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8866082/"
    },
    {
      t: "Reig M, Forner A, Ávila MA, et al. BCLC strategy for prognosis prediction and treatment recommendations: The 2025 update. J Hepatol. 2025.",
      u: "https://doi.org/10.1016/j.jhep.2025.10.020"
    },
    {
      t: "Llovet JM, Brú C, Bruix J. The Barcelona approach: diagnosis, staging, and treatment of hepatocellular carcinoma. Liver Transpl. 2004;10(2 Suppl 1):S115-20.",
      u: "https://doi.org/10.1002/lt.20034"
    },
    {
      t: "Pugh RN, Murray-Lyon IM, Dawson JL, et al. Transection of the oesophagus for bleeding oesophageal varices. Br J Surg. 1973;60(8):646-649.",
      u: "https://doi.org/10.1002/bjs.1800600817"
    },
    {
      t: "StatPearls - Use of The Child Pugh Score in Liver Disease. NCBI Bookshelf. Updated 2024.",
      u: "https://www.ncbi.nlm.nih.gov/books/NBK542308/"
    },
    {
      t: "Oken MM, Creech RH, Tormey DC, et al. Toxicity and response criteria of the Eastern Cooperative Oncology Group. Am J Clin Oncol. 1982;5(6):649-655.",
      u: "https://pubmed.ncbi.nlm.nih.gov/7165009/"
    },
    {
      t: "ECOG-ACRIN Cancer Research Group. ECOG Performance Status Scale.",
      u: "https://ecog-acrin.org/resources/ecog-performance-status/"
    },
    {
      t: "Finn RS, Qin S, Ikeda M, et al. Atezolizumab plus Bevacizumab in Unresectable Hepatocellular Carcinoma. N Engl J Med. 2020;382(20):1894-1905.",
      u: "https://doi.org/10.1056/NEJMoa1915745"
    },
    {
      t: "European Association for the Study of the Liver. EASL Clinical Practice Guidelines: Management of hepatocellular carcinoma. J Hepatol. 2018;69(1):182-236.",
      u: "https://doi.org/10.1016/j.jhep.2018.03.019"
    },
    {
      t: "Heimbach JK, Kulik LM, Finn RS, et al. AASLD guidelines for the treatment of hepatocellular carcinoma. Hepatology. 2018;67(1):358-380.",
      u: "https://doi.org/10.1002/hep.29086"
    },
    {
      t: "Vilstrup H, Amodio P, Bajaj J, et al. Hepatic encephalopathy in chronic liver disease: 2014 Practice Guideline. Hepatology. 2014;60(2):715-735.",
      u: "https://doi.org/10.1002/hep.27210"
    }
  ]
};
