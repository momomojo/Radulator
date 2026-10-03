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
 *
 * Criterion wording follows NICE NG158 recommendation 1.1.17, Table 2 (two-level PE Wells
 * score, adapted from Wells 2000). Weights, cut points and the cohort figures in the info text
 * and results are bound to the PubMed abstracts by scripts/audit-wells-pe-source.mjs.
 * Evidence and locators: docs/evidence/wells-pe-wording.md
 */

export const WellsPE = {
  id: "wells-pe",
  category: "Clinical Decision",
  name: "Wells Criteria for PE",
  desc: "Clinical decision rule for pulmonary embolism probability assessment",
  guidelineVersion: "Wells Criteria (2000)",
  keywords: ["pulmonary embolism", "PE", "DVT", "thrombosis", "D-dimer"],
  tags: ["Clinical Decision", "Pulmonary", "Emergency"],
  metaDesc:
    "Free Wells Criteria for PE Calculator. Estimate pre-test probability of pulmonary embolism with evidence-based scoring and D-dimer guidance.",

  info: {
    text: `The Wells Criteria for Pulmonary Embolism is a validated clinical decision rule used to estimate the pre-test probability of PE.

Wells et al. (2000) defined two ways to read the score:

3-TIER MODEL:
• Low probability: <2 points
• Moderate probability: 2–6 points
• High probability: >6 points
In the Wells 2001 emergency department cohort (930 patients), PE was found in 1.3% of low, 16.2% of moderate and 37.5% of high probability patients.

2-TIER MODEL (Recommended):
• PE Unlikely: ≤4 points (PE in 7.8% of these patients in Wells 2000)
• PE Likely: >4 points

The 2-tier model directly guides the diagnostic pathway:
• PE Unlikely: D-dimer first. In the Christopher Study (van Belle 2006), 1,028 PE-unlikely patients with a normal D-dimer were left untreated; 0.5% (95% CI 0.2–1.1%) had nonfatal VTE over 3 months of follow-up. With the SimpliRED D-dimer in Wells 2000, PE occurred in 2.2% (derivation) and 1.7% (validation) of PE-unlikely patients with a negative result.
• PE Likely: proceed directly to CT pulmonary angiography.

This calculator implements the Wells 2000 score (seven items and both cut-point schemes); item wording follows NICE NG158 Table 2. PERC is not scored here; a note suggests it for low-probability results.`,
    link: {
      label: "View Original Wells PE Study",
      url: "https://doi.org/10.1055/s-0037-1613830",
    },
  },

  fields: [
    // CLINICAL SIGNS AND SYMPTOMS
    // Wording: NICE NG158 Table 2 (adapted from Wells 2000); see docs/evidence/wells-pe-wording.md
    {
      id: "clinical_dvt",
      label: "Clinical signs/symptoms of DVT",
      subLabel: "Must include both leg swelling and pain on palpation of the deep veins",
      type: "checkbox",
    },
    {
      // Strictly "less likely": an alternative diagnosis judged equally likely scores 0.
      id: "alternative_less_likely",
      label: "Alternative diagnosis less likely than PE",
      subLabel: "PE judged more likely than every alternative diagnosis; a tie does not count",
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
        "Immobilization lasting more than 3 days, or surgery, within the previous 4 weeks",
      type: "checkbox",
    },
    {
      id: "previous_pe_dvt",
      label: "Previous PE or DVT",
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
      subLabel: "Under treatment, treated within the past 6 months, or palliative",
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
      breakdown.push("Alternative diagnosis less likely than PE: +3.0");
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

    // 3-tier model, Wells 2000 cut points: low <2, moderate 2-6, high >6.
    // Cohort PE rates by tier: Wells 2001 emergency department cohort.
    let threeTierCategory = "";
    let threeTierRate = "";

    if (score < 2) {
      threeTierCategory = "Low";
      threeTierRate = "1.3%";
    } else if (score <= 6) {
      threeTierCategory = "Moderate";
      threeTierRate = "16.2%";
    } else {
      threeTierCategory = "High";
      threeTierRate = "37.5%";
    }

    // 2-tier model (recommended), Wells 2000 split: PE unlikely <=4, likely >4.
    // Negative D-dimer outcome: Christopher Study (van Belle 2006), not an NPV claim.
    let twoTierAssessment = "";
    let recommendation = "";

    if (score <= 4) {
      twoTierAssessment = "PE Unlikely (Wells 2000: PE in 7.8%)";
      recommendation =
        "D-dimer testing recommended. If positive, proceed to CTPA. If negative: in the Christopher Study, PE-unlikely patients with a normal D-dimer were left untreated, and 0.5% (95% CI 0.2–1.1%) had nonfatal VTE over 3 months of follow-up.";
    } else {
      twoTierAssessment = "PE Likely";
      recommendation =
        "Proceed directly to CT pulmonary angiography (CTPA). D-dimer testing is not recommended as it cannot safely exclude PE at this probability.";
    }

    // Build result
    const result = {
      "Wells Score": `${score} points`,
      "2-Tier Assessment (Recommended)": twoTierAssessment,
      "3-Tier Assessment": `${threeTierCategory} Probability (Wells 2001 cohort: PE in ${threeTierRate})`,
      Recommendation: recommendation,
    };

    if (breakdown.length > 0) {
      result["Score Breakdown"] = breakdown.join("; ");
    } else {
      result["Score Breakdown"] = "No risk factors selected (0 points)";
    }

    // Additional clinical notes
    const notes = [];

    // Same low band as the 3-tier model (<2); ACP 2015 advice 2 applies PERC to low pretest probability.
    if (score < 2) {
      notes.push(
        "Consider the PERC rule in low-probability patients (score <2) to avoid unnecessary D-dimer testing",
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

    result._severity = score <= 4 ? "success" : "danger";

    return result;
  },

  refs: [
    {
      t: "Wells PS, Anderson DR, Rodger M, et al. Derivation of a simple clinical model to categorize patients probability of pulmonary embolism. Thromb Haemost. 2000;83(3):416-420.",
      u: "https://pubmed.ncbi.nlm.nih.gov/10744147/",
    },
    {
      t: "NICE NG158. Recommendation 1.1.17, Table 2: two-level PE Wells score and criterion definitions, adapted from Wells et al. 2000.",
      u: "https://www.nice.org.uk/guidance/ng158/chapter/Recommendations",
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
