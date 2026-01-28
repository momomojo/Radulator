/**
 * Mehran Contrast-Induced Nephropathy (CIN) Risk Score Calculator
 *
 * The Mehran score predicts the risk of contrast-induced nephropathy (CIN) and
 * need for dialysis following percutaneous coronary intervention (PCI).
 * It helps guide contrast dosing and preventive measures.
 *
 * Primary Sources:
 * - Mehran R, et al. J Am Coll Cardiol. 2004;44(7):1393-1399
 * - Validated in PCI population; applicable to other contrast procedures
 */

export const MehranCIN = {
  id: "mehran-cin",
  category: "Nephrology",
  name: "Mehran CIN Risk Score",
  desc: "Predicts risk of contrast-induced nephropathy after angiography/PCI",
  keywords: [
    "contrast nephropathy",
    "AKI",
    "CIN",
    "kidney injury",
    "creatinine",
  ],
  metaDesc:
    "Free Mehran CIN Risk Score Calculator. Predict contrast-induced nephropathy and dialysis risk after PCI or angiography with evidence-based risk stratification.",

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

Prevention strategies include:
• Adequate hydration (isotonic saline preferred)
• Minimize contrast volume (target <3-4 mL/kg/eGFR)
• Hold nephrotoxic medications
• Consider iso-osmolar or low-osmolar contrast

Note: Score was developed for PCI; risk may differ for CT contrast.`,
    link: {
      label: "View Original Mehran Study",
      url: "https://doi.org/10.1016/j.jacc.2004.06.034",
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
        "Estimated glomerular filtration rate; if not provided, will estimate from creatinine",
      type: "number",
    },

    // SECTION 3: CONTRAST VOLUME
    {
      id: "contrast_volume",
      label: "Contrast Volume (mL)",
      subLabel: "Total anticipated or administered volume",
      type: "number",
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

    // Validate required fields
    if (!creatinine && !egfr) {
      return {
        Error:
          "Please provide either serum creatinine or eGFR to calculate the risk score.",
      };
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
    const volume = parseFloat(contrast_volume) || 0;
    if (volume > 0) {
      const volumePoints = Math.floor(volume / 100);
      score += volumePoints;
      breakdown.push(`Contrast volume (${volume} mL): +${volumePoints}`);
    }

    // Renal function scoring
    // Per Mehran 2004: use EITHER eGFR-based tiered scoring OR creatinine >1.5, not both
    const directEGFR = parseFloat(egfr) || 0;
    const creatValue = parseFloat(creatinine) || 0;
    let estimatedEGFR = directEGFR;

    // Estimate eGFR from creatinine if not directly provided (for contrast limit guidance)
    if (!directEGFR && creatValue > 0) {
      // Simplified CKD-EPI approximation (assume 70 year old, non-Black)
      estimatedEGFR =
        141 *
        Math.pow(Math.min(creatValue / 0.9, 1), -0.411) *
        Math.pow(Math.max(creatValue / 0.9, 1), -1.209) *
        0.993;
      estimatedEGFR = Math.round(estimatedEGFR);
    }

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
    let riskLevel = "";

    if (score <= 5) {
      riskCategory = "Low Risk";
      cinRisk = "7.5%";
      dialysisRisk = "0.04%";
      riskLevel = "low";
    } else if (score <= 10) {
      riskCategory = "Moderate Risk";
      cinRisk = "14.0%";
      dialysisRisk = "0.12%";
      riskLevel = "moderate";
    } else if (score <= 15) {
      riskCategory = "High Risk";
      cinRisk = "26.1%";
      dialysisRisk = "1.09%";
      riskLevel = "high";
    } else {
      riskCategory = "Very High Risk";
      cinRisk = "57.3%";
      dialysisRisk = "12.6%";
      riskLevel = "very-high";
    }

    // Build result
    const result = {
      "Mehran Score": `${score} points`,
      "Risk Category": riskCategory,
      "CIN Risk": cinRisk,
      "Dialysis Risk": dialysisRisk,
    };

    if (estimatedEGFR > 0) {
      result["Estimated eGFR"] = `${estimatedEGFR} mL/min/1.73m²`;
    }

    if (breakdown.length > 0) {
      result["Score Breakdown"] = breakdown.join("; ");
    }

    // Prevention recommendations
    const recommendations = [];

    if (riskLevel === "low") {
      recommendations.push(
        "Standard hydration protocol (1 mL/kg/hr isotonic saline for 6-12 hours)",
      );
      recommendations.push("Limit contrast to minimum necessary volume");
    } else if (riskLevel === "moderate") {
      recommendations.push(
        "Aggressive hydration (1.5 mL/kg/hr isotonic saline starting 3-12 hours pre-procedure)",
      );
      recommendations.push("Target contrast volume <3× eGFR (mL)");
      recommendations.push("Consider iso-osmolar contrast agent");
      recommendations.push(
        "Hold nephrotoxins (NSAIDs, aminoglycosides) 24-48 hours before and after",
      );
    } else if (riskLevel === "high") {
      recommendations.push(
        "Aggressive IV hydration (isotonic saline 1.5 mL/kg/hr starting 12 hours pre-procedure)",
      );
      recommendations.push("Target contrast volume <2× eGFR (mL)");
      recommendations.push("Use iso-osmolar contrast agent (iodixanol)");
      recommendations.push("Hold metformin, nephrotoxins, ACE inhibitors/ARBs");
      recommendations.push(
        "Consider staged procedure to minimize contrast load",
      );
      recommendations.push(
        "Monitor creatinine at 24, 48, and 72 hours post-procedure",
      );
    } else {
      recommendations.push("Strongly consider delaying non-emergent procedure");
      recommendations.push(
        "If proceeding, minimize contrast (<1.5× eGFR or <100 mL total)",
      );
      recommendations.push(
        "Maximize pre-procedure hydration (1.5-3 mL/kg/hr × 6-12 hours)",
      );
      recommendations.push("Use iso-osmolar contrast agent");
      recommendations.push("Nephrology consultation recommended");
      recommendations.push(
        "Consider prophylactic renal replacement therapy access",
      );
      recommendations.push("Intensive post-procedure monitoring");
    }

    result["Prevention Recommendations"] = recommendations.join("; ");

    // Maximum safe contrast volume guidance
    if (estimatedEGFR > 0) {
      const maxContrast = Math.round(estimatedEGFR * 3);
      const targetContrast = Math.round(estimatedEGFR * 2);
      result["Contrast Limits"] =
        `Target: <${targetContrast} mL; Maximum: <${maxContrast} mL (based on eGFR × 2-3)`;
    }

    return result;
  },

  refs: [
    {
      t: "Mehran R, Aymong ED, Nikolsky E, et al. A simple risk score for prediction of contrast-induced nephropathy after percutaneous coronary intervention. J Am Coll Cardiol. 2004;44(7):1393-1399.",
      u: "https://doi.org/10.1016/j.jacc.2004.06.034",
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
