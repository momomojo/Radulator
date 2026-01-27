/**
 * Wells Criteria for DVT Calculator
 *
 * The Wells criteria for DVT is a validated clinical decision rule used to estimate
 * the pre-test probability of deep vein thrombosis. It helps guide diagnostic workup
 * and determines appropriateness of D-dimer testing vs. immediate ultrasound.
 *
 * Primary Sources:
 * - Wells PS, et al. Lancet. 1997;350(9094):1795-1798
 * - Wells PS, et al. N Engl J Med. 2003;349(13):1227-1235
 * - Goodacre S, et al. BMJ. 2005;330(7497):821 (Systematic review)
 */

export const WellsDVT = {
  id: "wells-dvt",
  category: "Clinical Decision",
  name: "Wells Criteria for DVT",
  desc: "Clinical decision rule for deep vein thrombosis probability assessment",
  metaDesc:
    "Free Wells Criteria for DVT Calculator. Estimate pre-test probability of deep vein thrombosis with evidence-based scoring and diagnostic pathway guidance.",

  info: {
    text: `The Wells Criteria for Deep Vein Thrombosis is a validated clinical decision rule used to estimate the pre-test probability of DVT in the lower extremities.

Two scoring interpretations are available:

ORIGINAL 3-TIER MODEL:
• Low probability: <1 point (~5% DVT prevalence)
• Moderate probability: 1-2 points (~17% DVT prevalence)
• High probability: ≥3 points (~53% DVT prevalence)

SIMPLIFIED 2-TIER MODEL (Recommended):
• DVT Unlikely: <2 points (~6% DVT prevalence)
• DVT Likely: ≥2 points (~28% DVT prevalence)

Recommended diagnostic pathway:
• DVT Unlikely + negative D-dimer = DVT excluded (NPV >99%)
• DVT Likely = proceed to compression ultrasound
• If initial US negative in "DVT Likely" group, repeat US in 1 week or perform whole-leg US

Note: This score is for lower extremity DVT. Upper extremity DVT requires different evaluation.`,
    link: {
      label: "View Original Wells DVT Study",
      url: "https://doi.org/10.1016/S0140-6736(97)08140-3",
    },
  },

  fields: [
    // CLINICAL SIGNS AND SYMPTOMS
    {
      id: "active_cancer",
      label: "Active cancer",
      subLabel: "Treatment ongoing, within 6 months, or palliative",
      type: "checkbox",
    },
    {
      id: "paralysis_paresis",
      label: "Paralysis, paresis, or recent plaster immobilization",
      subLabel: "Of the lower extremities",
      type: "checkbox",
    },
    {
      id: "bedridden_surgery",
      label: "Recently bedridden >3 days or major surgery within 12 weeks",
      subLabel: "Requiring general or regional anesthesia",
      type: "checkbox",
    },
    {
      id: "tenderness_deep_veins",
      label: "Localized tenderness along deep venous system",
      type: "checkbox",
    },
    {
      id: "leg_swelling",
      label: "Entire leg swollen",
      type: "checkbox",
    },
    {
      id: "calf_swelling",
      label: "Calf swelling >3 cm compared to asymptomatic leg",
      subLabel: "Measured 10 cm below tibial tuberosity",
      type: "checkbox",
    },
    {
      id: "pitting_edema",
      label: "Pitting edema confined to symptomatic leg",
      type: "checkbox",
    },
    {
      id: "collateral_veins",
      label: "Collateral superficial veins (non-varicose)",
      type: "checkbox",
    },
    {
      id: "previous_dvt",
      label: "Previously documented DVT",
      type: "checkbox",
    },
    {
      id: "alternative_diagnosis",
      label: "Alternative diagnosis at least as likely as DVT",
      subLabel: "e.g., cellulitis, Baker's cyst, muscle strain (-2 points)",
      type: "checkbox",
    },
  ],

  compute: (vals) => {
    const {
      active_cancer = false,
      paralysis_paresis = false,
      bedridden_surgery = false,
      tenderness_deep_veins = false,
      leg_swelling = false,
      calf_swelling = false,
      pitting_edema = false,
      collateral_veins = false,
      previous_dvt = false,
      alternative_diagnosis = false,
    } = vals;

    // Calculate Wells Score
    let score = 0;
    const breakdown = [];

    if (active_cancer) {
      score += 1;
      breakdown.push("Active cancer: +1");
    }
    if (paralysis_paresis) {
      score += 1;
      breakdown.push("Paralysis/paresis/immobilization: +1");
    }
    if (bedridden_surgery) {
      score += 1;
      breakdown.push("Bedridden >3 days or major surgery: +1");
    }
    if (tenderness_deep_veins) {
      score += 1;
      breakdown.push("Tenderness along deep veins: +1");
    }
    if (leg_swelling) {
      score += 1;
      breakdown.push("Entire leg swollen: +1");
    }
    if (calf_swelling) {
      score += 1;
      breakdown.push("Calf swelling >3 cm: +1");
    }
    if (pitting_edema) {
      score += 1;
      breakdown.push("Pitting edema: +1");
    }
    if (collateral_veins) {
      score += 1;
      breakdown.push("Collateral superficial veins: +1");
    }
    if (previous_dvt) {
      score += 1;
      breakdown.push("Previously documented DVT: +1");
    }
    if (alternative_diagnosis) {
      score -= 2;
      breakdown.push("Alternative diagnosis as likely: -2");
    }

    // Determine risk category - 3-tier model
    let threeTierCategory = "";
    let threeTierPrevalence = "";

    if (score < 1) {
      threeTierCategory = "Low";
      threeTierPrevalence = "~5%";
    } else if (score <= 2) {
      threeTierCategory = "Moderate";
      threeTierPrevalence = "~17%";
    } else {
      threeTierCategory = "High";
      threeTierPrevalence = "~53%";
    }

    // Determine risk category - 2-tier model (recommended)
    let twoTierCategory = "";
    let twoTierPrevalence = "";
    let recommendation = "";

    if (score < 2) {
      twoTierCategory = "DVT Unlikely";
      twoTierPrevalence = "~6%";
      recommendation =
        "D-dimer testing recommended. If negative (high-sensitivity assay), DVT is effectively excluded. If positive, proceed to compression ultrasound.";
    } else {
      twoTierCategory = "DVT Likely";
      twoTierPrevalence = "~28%";
      recommendation =
        "Proceed directly to compression ultrasound of the proximal leg veins. If negative, consider serial ultrasound in 1 week or whole-leg ultrasound.";
    }

    // Build result
    const result = {
      "Wells Score": `${score} points`,
      "2-Tier Assessment (Recommended)": `${twoTierCategory} (prevalence ${twoTierPrevalence})`,
      "3-Tier Assessment": `${threeTierCategory} Probability (prevalence ${threeTierPrevalence})`,
      Recommendation: recommendation,
    };

    if (breakdown.length > 0) {
      result["Score Breakdown"] = breakdown.join("; ");
    } else {
      result["Score Breakdown"] = "No risk factors selected (0 points)";
    }

    // Additional clinical notes
    const notes = [];

    if (score < 0) {
      notes.push(
        "Negative score indicates very low probability; strongly consider alternative diagnoses",
      );
    }

    if (score >= 3) {
      notes.push(
        "High probability - empiric anticoagulation may be considered while awaiting imaging if no contraindications and significant delay expected",
      );
    }

    if (previous_dvt) {
      notes.push(
        "Prior DVT increases post-thrombotic syndrome risk and may complicate ultrasound interpretation",
      );
    }

    if (active_cancer) {
      notes.push(
        "Cancer-associated thrombosis may require extended duration anticoagulation",
      );
    }

    if (leg_swelling && calf_swelling) {
      notes.push(
        "Marked swelling with multiple signs increases specificity for DVT",
      );
    }

    if (notes.length > 0) {
      result["Clinical Notes"] = notes.join("; ");
    }

    // Add differential diagnosis note
    if (alternative_diagnosis) {
      result["Common Alternatives"] =
        "Baker's cyst, cellulitis, muscle strain/tear, superficial thrombophlebitis, lymphedema, chronic venous insufficiency";
    }

    return result;
  },

  refs: [
    {
      t: "Wells PS, Anderson DR, Bormanis J, et al. Value of assessment of pretest probability of deep-vein thrombosis in clinical management. Lancet. 1997;350(9094):1795-1798.",
      u: "https://doi.org/10.1016/S0140-6736(97)08140-3",
    },
    {
      t: "Wells PS, Anderson DR, Rodger M, et al. Evaluation of D-dimer in the diagnosis of suspected deep-vein thrombosis. N Engl J Med. 2003;349(13):1227-1235.",
      u: "https://doi.org/10.1056/NEJMoa023153",
    },
    {
      t: "Goodacre S, Sutton AJ, Sampson FC. Meta-analysis: The value of clinical assessment in the diagnosis of deep venous thrombosis. Ann Intern Med. 2005;143(2):129-139.",
      u: "https://doi.org/10.7326/0003-4819-143-2-200507190-00012",
    },
    {
      t: "Defined guidelines for deep venous thrombosis diagnosis. N Engl J Med. 2003;349:1227-1235 (landmark study validating 2-tier model with D-dimer).",
      u: "https://pubmed.ncbi.nlm.nih.gov/14507948/",
    },
    {
      t: "Defined guidelines: An official American Thoracic Society/Society of Thoracic Radiology Clinical Practice Guideline: Evaluation of Suspected Pulmonary Embolism in Pregnancy. Am J Respir Crit Care Med. 2011;184(10):1200-1208.",
      u: "https://doi.org/10.1164/rccm.201108-1575ST",
    },
  ],
};
