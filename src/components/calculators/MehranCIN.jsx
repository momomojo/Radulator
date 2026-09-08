/**
 * Mehran Contrast-Induced Nephropathy (CIN) Risk Score Calculator
 *
 * The Mehran score predicts the risk of contrast-induced nephropathy (CIN) and
 * need for dialysis following percutaneous coronary intervention (PCI).
 * It helps guide contrast dosing and preventive measures.
 *
 * Primary Sources:
 * - Mehran R, et al. J Am Coll Cardiol. 2004;44(7):1393-1399
 * - Developed in a PCI population; not a general contrast-clearance tool
 */

export const MehranCIN = {
  id: "mehran-cin",
  category: "Nephrology",
  name: "Mehran CIN Risk Score",
  desc: "Original 2004 PCI contrast-associated kidney injury risk score",
  guidelineVersion: "Mehran Score (2004)",
  keywords: [
    "contrast nephropathy",
    "AKI",
    "CIN",
    "kidney injury",
    "creatinine",
  ],
  tags: ["Nephrology", "Cardiology", "Safety"],
  metaDesc:
    "Original 2004 Mehran PCI risk score with historical cohort-rate context. Not a general IV contrast clearance or treatment calculator.",

  info: {
    text: `The Mehran Contrast-Induced Nephropathy (CIN) Risk Score predicts the risk of acute kidney injury following contrast administration during percutaneous coronary intervention.

CIN is defined as:
• Serum creatinine increase ≥25% from baseline, OR
• Absolute increase ≥0.5 mg/dL (44 μmol/L)
• Within 48-72 hours of contrast exposure

Risk Categories:
• Low Risk (≤5 points): 7.5% CIN risk, 0.04% dialysis risk
• Moderate Risk (6-10 points): 14% CIN risk, 0.12% dialysis risk
• High Risk (11-15 points): 26.1% CIN risk, 1.09% dialysis risk
• Very High Risk (≥16 points): 57.3% CIN risk, 12.6% dialysis risk

Prevention is not determined by this score alone. Assess renal function, acute kidney injury, contrast exposure route and volume status; individualize hydration, especially in severe heart failure. This tool does not prescribe hydration doses, medication holds, dialysis access or a safe contrast maximum.

Scope: original PCI model, not a general IV CT contrast risk calculator or the newer Mehran 2 model. Rates are historical cohort estimates, not an individualized guarantee. Anticipated procedural inputs give a conditional estimate; update them after the procedure.`,
    link: {
      label: "View Original Mehran Study",
      url: "https://doi.org/10.1016/j.jacc.2004.06.068",
    },
  },

  fields: [
    // SECTION 1: PATIENT CHARACTERISTICS
    {
      id: "hypotension",
      label: "Hypotension",
      subLabel:
        "SBP <80 mmHg for ≥1 hour requiring inotropes or IABP within 24 hours of procedure",
      type: "checkbox",
    },
    {
      id: "iabp",
      label: "Intra-aortic balloon pump (IABP)",
      subLabel: "Use during procedure",
      type: "checkbox",
    },
    {
      id: "chf",
      label: "Congestive heart failure",
      subLabel: "NYHA Class III-IV or history of pulmonary edema",
      type: "checkbox",
    },
    {
      id: "age_over_75",
      label: "Age >75 years",
      type: "checkbox",
    },
    {
      id: "anemia",
      label: "Anemia",
      subLabel: "Baseline hematocrit <39% for men, <36% for women",
      type: "checkbox",
    },
    {
      id: "diabetes",
      label: "Diabetes mellitus",
      type: "checkbox",
    },

    // SECTION 2: RENAL FUNCTION
    {
      id: "creatinine",
      label: "Serum Creatinine (mg/dL)",
      subLabel: "Baseline value before contrast",
      type: "number",
    },
    {
      id: "egfr",
      label: "eGFR (mL/min/1.73m²)",
      subLabel:
        "Supply a measured-report eGFR; takes precedence if both renal fields are entered. No eGFR is calculated here.",
      type: "number",
    },

    // SECTION 3: CONTRAST VOLUME
    {
      id: "contrast_volume",
      label: "Contrast Volume (mL)",
      subLabel: "Required total anticipated or administered volume; blank is unknown, not zero",
      type: "number",
      required: true,
    },
  ],

  compute: (vals) => {
    const {
      hypotension = false,
      iabp = false,
      chf = false,
      age_over_75 = false,
      anemia = false,
      diabetes = false,
      creatinine = "",
      egfr = "",
      contrast_volume = "",
    } = vals;

    const absent = (value) => value === undefined || value === null || (typeof value === "string" && value.trim() === "");
    const decimal = (value) => {
      if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
      if (typeof value !== "string" || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())) return NaN;
      const number = Number(value.trim());
      return Number.isFinite(number) ? number : NaN;
    };
    if (absent(creatinine) && absent(egfr)) {
      return {
        Error:
          "Please provide either serum creatinine or eGFR to calculate the risk score.",
      };
    }

    const directEGFR = absent(egfr) ? null : decimal(egfr);
    const creatValue = absent(creatinine) ? null : decimal(creatinine);
    if ((directEGFR !== null && (!Number.isFinite(directEGFR) || directEGFR <= 0)) ||
        (creatValue !== null && (!Number.isFinite(creatValue) || creatValue <= 0))) {
      return { Error: "Every supplied renal measurement must be a finite positive number in the displayed units." };
    }
    const volume = absent(contrast_volume) ? NaN : decimal(contrast_volume);
    if (!Number.isFinite(volume) || volume < 0) {
      return { Error: "Enter a finite nonnegative contrast volume in mL; blank volume is unknown, not zero." };
    }
    for (const value of [hypotension, iabp, chf, age_over_75, anemia, diabetes]) {
      if (value !== "" && typeof value !== "boolean") {
        return { Error: "Clinical risk factors must be selected with the checkboxes." };
      }
    }

    // Calculate points
    let score = 0;
    const breakdown = [];

    // Clinical factors
    if (hypotension) {
      score += 5;
      breakdown.push("Hypotension: +5");
    }
    if (iabp) {
      score += 5;
      breakdown.push("IABP: +5");
    }
    if (chf) {
      score += 5;
      breakdown.push("CHF: +5");
    }
    if (age_over_75) {
      score += 4;
      breakdown.push("Age >75: +4");
    }
    if (anemia) {
      score += 3;
      breakdown.push("Anemia: +3");
    }
    if (diabetes) {
      score += 3;
      breakdown.push("Diabetes: +3");
    }

    // Contrast volume scoring (1 point per 100 mL)
    if (volume > 0) {
      const volumePoints = Math.floor(volume / 100);
      score += volumePoints;
      breakdown.push(`Contrast volume (${volume} mL): +${volumePoints}`);
    }

    // Renal function scoring
    // Per Mehran 2004: use EITHER eGFR-based tiered scoring OR creatinine >1.5, not both

    // Scoring strategy:
    // - If eGFR directly provided: use modern eGFR-based tiered scoring (more granular)
    // - If only creatinine provided: use original Mehran creatinine >1.5 scoring
    if (directEGFR > 0) {
      // Use eGFR-based scoring (more granular, modern method)
      if (directEGFR < 20) {
        score += 6;
        breakdown.push(`eGFR <20: +6`);
      } else if (directEGFR < 40) {
        score += 4;
        breakdown.push(`eGFR 20-40: +4`);
      } else if (directEGFR < 60) {
        score += 2;
        breakdown.push(`eGFR 40-60: +2`);
      }
      // Note: eGFR >=60 adds 0 points for renal function
    } else if (creatValue > 1.5) {
      // Use original Mehran creatinine >1.5 scoring when eGFR not directly provided
      score += 4;
      breakdown.push(`Creatinine >1.5: +4`);
    }

    // Determine risk category
    let riskCategory = "";
    let cinRisk = "";
    let dialysisRisk = "";

    if (score <= 5) {
      riskCategory = "Low Risk";
      cinRisk = "7.5%";
      dialysisRisk = "0.04%";
    } else if (score <= 10) {
      riskCategory = "Moderate Risk";
      cinRisk = "14.0%";
      dialysisRisk = "0.12%";
    } else if (score <= 15) {
      riskCategory = "High Risk";
      cinRisk = "26.1%";
      dialysisRisk = "1.09%";
    } else {
      riskCategory = "Very High Risk";
      cinRisk = "57.3%";
      dialysisRisk = "12.6%";
    }

    // Build result
    const result = {
      "Mehran Score": `${score} points`,
      "Risk Category": riskCategory,
      "CIN Risk": cinRisk,
      "Dialysis Risk": dialysisRisk,
    };

    result["Renal Input Method"] = directEGFR !== null
      ? `Supplied eGFR ${directEGFR} mL/min/1.73m²; eGFR takes precedence over creatinine, without double-counting.`
      : `Supplied creatinine ${creatValue} mg/dL; no eGFR calculated.`;

    if (breakdown.length > 0) {
      result["Score Breakdown"] = breakdown.join("; ");
    }

    result["Prevention Context"] =
      "Assess renal function, acute kidney injury, contrast exposure route and volume status separately. Individualize hydration, especially in severe heart failure. This score does not prescribe hydration doses, medication holds, dialysis access or a safe contrast maximum.";
    result["Model Scope"] =
      "Original 2004 PCI score; displayed rates are historical cohort estimates, not an individual guarantee or general IV CT contrast clearance. Anticipated procedural inputs make the estimate conditional; update after the procedure.";

    result._severity =
      score <= 5 ? "success" : score <= 10 ? "warning" : "danger";

    return result;
  },

  refs: [
    {
      t: "Mehran R, Aymong ED, Nikolsky E, et al. A simple risk score for prediction of contrast-induced nephropathy after percutaneous coronary intervention. J Am Coll Cardiol. 2004;44(7):1393-1399.",
      u: "https://doi.org/10.1016/j.jacc.2004.06.068",
    },
    {
      t: "ESUR Guidelines on Contrast Media, renal adverse reactions: B.2.2 individualized hydration, B.2.3 exposure-specific contrast guidance, B.4.1 metformin and B.5 dialysis.",
      u: "https://esur-cm.org/index.php/en/b-renal-adverse-reactions",
    },
    {
      t: "KDIGO 2012 AKI guideline, Section 4: Table 15 PCI risk model; recommendation 4.5.1 against prophylactic dialysis solely for contrast removal.",
      u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4089629/",
    },
    {
      t: "ACR Manual on Contrast Media, Version 2024. American College of Radiology Committee on Drugs and Contrast Media.",
      u: "https://www.acr.org/Clinical-Resources/Contrast-Manual",
    },
    {
      t: "Weisbord SD, Gallagher M, Jneid H, et al. Outcomes after Angiography with Sodium Bicarbonate and Acetylcysteine (PRESERVE trial). N Engl J Med. 2018;378(7):603-614.",
      u: "https://doi.org/10.1056/NEJMoa1710660",
    },
    {
      t: "Defined guidelines for prevention of contrast-induced acute kidney injury in patients undergoing cardiovascular procedures. J Am Coll Cardiol. 2021;77(12):1536-1547.",
      u: "https://doi.org/10.1016/j.jacc.2021.01.013",
    },
    {
      t: "ESUR Guidelines on Contrast-Induced Nephropathy (CIN). Eur Radiol. 2018;28:2845-2855.",
      u: "https://doi.org/10.1007/s00330-017-5129-z",
    },
  ],
};
