/**
 * Wells Criteria for Pulmonary Embolism Calculator
 *
 * The Wells criteria for PE is a validated clinical decision rule used to estimate
 * the pre-test probability of pulmonary embolism. It helps guide diagnostic workup
 * and determines appropriateness of D-dimer testing.
 *
 * Primary Sources:
 * - Wells PS, et al. Thromb Haemost. 2000;83(3):416-420
 * - Wells PS, et al. Ann Intern Med. 2001;135(2):98-107
 * - van Belle A, et al. JAMA. 2006;295(2):172-179 (CHRISTOPHER study)
 */

export const WellsPE = {
  id: "wells-pe",
  category: "Clinical Decision",
  name: "Wells Criteria for PE",
  desc: "Clinical decision rule for pulmonary embolism probability assessment",
  keywords: ["pulmonary embolism", "PE", "DVT", "thrombosis", "D-dimer"],
  tags: ["Clinical Decision", "Pulmonary", "Emergency"],
  metaDesc:
    "Free Wells Criteria for PE Calculator. Estimate pre-test probability of pulmonary embolism with evidence-based scoring and D-dimer guidance.",

  info: {
    text: `The Wells Criteria for Pulmonary Embolism is a validated clinical decision rule used to estimate the pre-test probability of PE.

Two scoring interpretations are available:

ORIGINAL 3-TIER MODEL:
• Low probability: 0-1 points (~3.6% PE prevalence)
• Moderate probability: 2-6 points (~20.5% PE prevalence)
• High probability: >6 points (~66.7% PE prevalence)

SIMPLIFIED 2-TIER MODEL (Recommended):
• PE Unlikely: ≤4 points (~8% PE prevalence)
• PE Likely: >4 points (~34% PE prevalence)

The 2-tier model is preferred as it directly guides the diagnostic algorithm:
• PE Unlikely + negative D-dimer = PE excluded (NPV >99%)
• PE Likely = proceed directly to CT pulmonary angiography

This calculator follows the 2001 Wells criteria with PERC rule integration.`,
    link: {
      label: "View Original Wells PE Study",
      url: "https://doi.org/10.1160/TH00-08-0302",
    },
  },

  fields: [
    // CLINICAL SIGNS AND SYMPTOMS
    {
      id: "clinical_dvt",
      label: "Clinical signs/symptoms of DVT",
      subLabel: "Leg swelling, pain with palpation of deep veins",
      type: "checkbox",
    },
    {
      id: "alternative_less_likely",
      label: "PE is #1 diagnosis OR equally likely",
      subLabel: "Alternative diagnosis is less likely than PE",
      type: "checkbox",
    },
    {
      id: "heart_rate",
      label: "Heart rate >100 bpm",
      type: "checkbox",
    },
    {
      id: "immobilization_surgery",
      label: "Immobilization or surgery in past 4 weeks",
      subLabel:
        "Bedrest ≥3 days OR surgery requiring general/regional anesthesia in past 4 weeks",
      type: "checkbox",
    },
    {
      id: "previous_pe_dvt",
      label: "Previous PE or DVT",
      subLabel: "Objectively diagnosed",
      type: "checkbox",
    },
    {
      id: "hemoptysis",
      label: "Hemoptysis",
      type: "checkbox",
    },
    {
      id: "malignancy",
      label: "Malignancy",
      subLabel: "Active cancer (treatment within 6 months or palliative)",
      type: "checkbox",
    },
  ],

  compute: (vals) => {
    const {
      clinical_dvt = false,
      alternative_less_likely = false,
      heart_rate = false,
      immobilization_surgery = false,
      previous_pe_dvt = false,
      hemoptysis = false,
      malignancy = false,
    } = vals;

    // Calculate Wells Score
    let score = 0;
    const breakdown = [];

    if (clinical_dvt) {
      score += 3;
      breakdown.push("Clinical signs/symptoms of DVT: +3.0");
    }
    if (alternative_less_likely) {
      score += 3;
      breakdown.push("PE #1 diagnosis or equally likely: +3.0");
    }
    if (heart_rate) {
      score += 1.5;
      breakdown.push("Heart rate >100: +1.5");
    }
    if (immobilization_surgery) {
      score += 1.5;
      breakdown.push("Immobilization/surgery: +1.5");
    }
    if (previous_pe_dvt) {
      score += 1.5;
      breakdown.push("Previous PE/DVT: +1.5");
    }
    if (hemoptysis) {
      score += 1;
      breakdown.push("Hemoptysis: +1.0");
    }
    if (malignancy) {
      score += 1;
      breakdown.push("Malignancy: +1.0");
    }

    // Determine risk category - 3-tier model
    let threeTierCategory = "";
    let threeTierPrevalence = "";

    if (score <= 1) {
      threeTierCategory = "Low";
      threeTierPrevalence = "~3.6%";
    } else if (score <= 6) {
      threeTierCategory = "Moderate";
      threeTierPrevalence = "~20.5%";
    } else {
      threeTierCategory = "High";
      threeTierPrevalence = "~66.7%";
    }

    // Determine risk category - 2-tier model (recommended)
    let twoTierCategory = "";
    let twoTierPrevalence = "";
    let recommendation = "";

    if (score <= 4) {
      twoTierCategory = "PE Unlikely";
      twoTierPrevalence = "~8%";
      recommendation =
        "D-dimer testing recommended. If negative, PE is effectively excluded (NPV >99%). If positive, proceed to CTPA.";
    } else {
      twoTierCategory = "PE Likely";
      twoTierPrevalence = "~34%";
      recommendation =
        "Proceed directly to CT pulmonary angiography (CTPA). D-dimer testing is not recommended as it cannot safely exclude PE at this probability.";
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

    if (score <= 4) {
      notes.push(
        "Consider PERC rule in very low-risk patients (score 0-1) to avoid unnecessary D-dimer testing",
      );
    }

    if (score > 6) {
      notes.push(
        "High clinical probability - anticoagulation may be considered while awaiting imaging if no contraindications",
      );
    }

    if (malignancy) {
      notes.push(
        "Cancer-associated thromboembolism has different treatment considerations",
      );
    }

    if (clinical_dvt && previous_pe_dvt) {
      notes.push(
        "History of VTE with current DVT symptoms suggests high recurrence risk",
      );
    }

    if (notes.length > 0) {
      result["Clinical Notes"] = notes.join("; ");
    }

    return result;
  },

  refs: [
    {
      t: "Wells PS, Anderson DR, Rodger M, et al. Derivation of a simple clinical model to categorize patients probability of pulmonary embolism. Thromb Haemost. 2000;83(3):416-420.",
      u: "https://pubmed.ncbi.nlm.nih.gov/10744147/",
    },
    {
      t: "Wells PS, Anderson DR, Rodger M, et al. Excluding pulmonary embolism at the bedside without diagnostic imaging. Ann Intern Med. 2001;135(2):98-107.",
      u: "https://doi.org/10.7326/0003-4819-135-2-200107170-00010",
    },
    {
      t: "van Belle A, Büller HR, Huisman MV, et al. Effectiveness of managing suspected pulmonary embolism using an algorithm combining clinical probability, D-dimer testing, and computed tomography (CHRISTOPHER study). JAMA. 2006;295(2):172-179.",
      u: "https://doi.org/10.1001/jama.295.2.172",
    },
    {
      t: "Konstantinides SV, Meyer G, Becattini C, et al. 2019 ESC Guidelines for the diagnosis and management of acute pulmonary embolism. Eur Heart J. 2020;41(4):543-603.",
      u: "https://doi.org/10.1093/eurheartj/ehz405",
    },
    {
      t: "Raja AS, Greenberg JO, Qaseem A, et al. Evaluation of Patients With Suspected Acute Pulmonary Embolism: Best Practice Advice From the Clinical Guidelines Committee of the American College of Physicians. Ann Intern Med. 2015;163(9):701-711.",
      u: "https://doi.org/10.7326/M14-1772",
    },
  ],
};
