/**
 * CAD-RADS 2.0 Calculator
 *
 * Coronary Artery Disease Reporting and Data System for coronary CTA.
 * Standardized classification of coronary artery stenosis with management recommendations.
 *
 * Primary Sources:
 * - Cury RC, et al. JACC Cardiovasc Imaging. 2022 (CAD-RADS 2.0)
 * - Defined guidelines et al. J Cardiovasc Comput Tomogr. 2016 (Original CAD-RADS)
 */

export const CADRADS = {
  id: "cad-rads",
  category: "Cardiac Imaging",
  name: "CAD-RADS 2.0",
  desc: "Coronary Artery Disease Reporting and Data System for coronary CTA",
  keywords: ["coronary", "CCTA", "coronary CTA", "CAD", "stenosis"],
  tags: ["Cardiac", "Radiology"],
  metaDesc:
    "Free CAD-RADS 2.0 Calculator. Standardized coronary CTA stenosis classification with plaque burden modifiers and management recommendations.",

  info: {
    text: `CAD-RADS (Coronary Artery Disease Reporting and Data System) 2.0 is the standardized system for reporting coronary CTA findings.

Stenosis Categories:
• CAD-RADS 0: 0% (No stenosis, no plaque)
• CAD-RADS 1: 1-24% (Minimal stenosis)
• CAD-RADS 2: 25-49% (Mild stenosis)
• CAD-RADS 3: 50-69% (Moderate stenosis)
• CAD-RADS 4A: 70-99% (Severe stenosis)
• CAD-RADS 4B: Left main ≥50% or 3-vessel ≥70%
• CAD-RADS 5: Total occlusion (100%)
• CAD-RADS N: Non-diagnostic

Modifiers (CAD-RADS 2.0):
• /P: Plaque burden (P1=mild, P2=moderate, P3=severe, P4=extensive)
• /I: Ischemia testing recommended
• /HRP: High-risk plaque features
• /E: Exception (stent, bypass grafts)
• /G: Grafts (S=stent, G=CABG)
• /V: Vulnerability marker

High-Risk Plaque Features:
• Positive remodeling (>10% vs reference)
• Low attenuation plaque (<30 HU)
• Napkin-ring sign
• Spotty calcification`,
    link: {
      label: "View CAD-RADS 2.0 Publication",
      url: "https://doi.org/10.1016/j.jcmg.2022.01.008",
    },
  },

  fields: [
    // STUDY QUALITY
    {
      id: "study_quality",
      label: "Study Quality",
      type: "radio",
      opts: [
        { value: "diagnostic", label: "Diagnostic quality" },
        { value: "limited", label: "Limited - some segments non-evaluable" },
        { value: "non_diagnostic", label: "Non-diagnostic (CAD-RADS N)" },
      ],
    },

    // MAXIMUM STENOSIS
    {
      id: "max_stenosis",
      label: "Maximum Coronary Stenosis",
      type: "radio",
      showIf: (vals) => vals.study_quality !== "non_diagnostic",
      opts: [
        { value: "0", label: "0% - No stenosis, no plaque" },
        { value: "1-24", label: "1-24% - Minimal non-obstructive" },
        { value: "25-49", label: "25-49% - Mild non-obstructive" },
        { value: "50-69", label: "50-69% - Moderate stenosis" },
        { value: "70-99", label: "70-99% - Severe stenosis" },
        { value: "100", label: "100% - Total occlusion" },
      ],
    },

    // LOCATION OF SEVERE DISEASE (for 4B classification)
    {
      id: "severe_location",
      label: "Location of Significant Stenosis",
      type: "radio",
      showIf: (vals) =>
        vals.max_stenosis === "50-69" || vals.max_stenosis === "70-99",
      opts: [
        { value: "non_lm", label: "Non-left main coronary artery" },
        { value: "lm_mild", label: "Left main <50%" },
        { value: "lm_significant", label: "Left main ≥50%" },
      ],
    },

    // THREE-VESSEL DISEASE
    {
      id: "three_vessel",
      label: "Three-Vessel Disease (≥70% in LAD, LCx, RCA)",
      type: "radio",
      showIf: (vals) => vals.max_stenosis === "70-99",
      opts: [
        { value: "no", label: "No - <3 vessels with ≥70% stenosis" },
        { value: "yes", label: "Yes - 3 major vessels each ≥70%" },
      ],
    },

    // PLAQUE BURDEN (P modifier)
    {
      id: "plaque_burden",
      label: "Plaque Burden (P Modifier)",
      type: "radio",
      showIf: (vals) =>
        vals.study_quality !== "non_diagnostic" && vals.max_stenosis !== "0",
      opts: [
        { value: "none", label: "Not assessed / No modifier" },
        { value: "P1", label: "P1 - Mild (1-2 segments)" },
        { value: "P2", label: "P2 - Moderate (3-4 segments)" },
        { value: "P3", label: "P3 - Severe (5-7 segments)" },
        { value: "P4", label: "P4 - Extensive (≥8 segments)" },
      ],
    },

    // HIGH-RISK PLAQUE FEATURES
    {
      id: "hrp_features",
      label: "High-Risk Plaque Features (HRP Modifier)",
      type: "radio",
      showIf: (vals) =>
        vals.study_quality !== "non_diagnostic" && vals.max_stenosis !== "0",
      opts: [
        { value: "none", label: "No high-risk features" },
        {
          value: "present",
          label:
            "Present (positive remodeling, low-attenuation, napkin-ring, spotty calcification)",
        },
      ],
    },

    // ISCHEMIA TESTING
    {
      id: "ischemia_testing",
      label: "Ischemia Testing Recommended (/I Modifier)",
      subLabel: "For intermediate stenosis or discordant symptoms",
      type: "radio",
      showIf: (vals) => vals.max_stenosis === "50-69",
      opts: [
        { value: "no", label: "No" },
        { value: "yes", label: "Yes - Functional testing recommended" },
      ],
    },

    // STENT/GRAFT ASSESSMENT
    {
      id: "prior_intervention",
      label: "Prior Coronary Intervention",
      type: "radio",
      opts: [
        { value: "none", label: "No stents or bypass grafts" },
        { value: "stent", label: "Coronary stent(s) present" },
        { value: "cabg", label: "Bypass graft(s) present" },
        { value: "both", label: "Both stents and grafts" },
      ],
    },

    // STENT PATENCY
    {
      id: "stent_status",
      label: "Stent Status",
      type: "radio",
      showIf: (vals) =>
        vals.prior_intervention === "stent" ||
        vals.prior_intervention === "both",
      opts: [
        { value: "patent", label: "Patent (no significant in-stent stenosis)" },
        { value: "stenosis", label: "In-stent stenosis (≥50%)" },
        { value: "occluded", label: "Occluded stent" },
        { value: "non_eval", label: "Non-evaluable (blooming artifact)" },
      ],
    },

    // GRAFT PATENCY
    {
      id: "graft_status",
      label: "Bypass Graft Status",
      type: "radio",
      showIf: (vals) =>
        vals.prior_intervention === "cabg" ||
        vals.prior_intervention === "both",
      opts: [
        { value: "patent", label: "All grafts patent" },
        { value: "stenosis", label: "Graft stenosis (≥50%)" },
        { value: "occluded", label: "Occluded graft(s)" },
        { value: "non_eval", label: "Non-evaluable" },
      ],
    },
  ],

  compute: (vals) => {
    const {
      study_quality = "",
      max_stenosis = "",
      severe_location = "",
      three_vessel = "",
      plaque_burden = "",
      hrp_features = "",
      ischemia_testing = "",
      prior_intervention = "",
      stent_status = "",
      graft_status = "",
    } = vals;

    // Non-diagnostic study
    if (study_quality === "non_diagnostic") {
      return {
        "CAD-RADS Category": "CAD-RADS N - Non-Diagnostic",
        Management:
          "Repeat CTA with optimized protocol, alternative testing (stress testing, invasive angiography), or clinical correlation",
        Note: "Study is non-diagnostic due to technical limitations. Consider motion, calcification, or poor contrast opacification.",
      };
    }

    if (!max_stenosis) {
      return { Error: "Please select the maximum coronary stenosis." };
    }

    // Determine base category
    let category = "";
    let categoryDesc = "";
    let management = "";

    switch (max_stenosis) {
      case "0":
        category = "0";
        categoryDesc = "No CAD";
        management =
          "No further workup. Address cardiovascular risk factors as clinically indicated.";
        break;
      case "1-24":
        category = "1";
        categoryDesc = "Minimal Non-Obstructive CAD (1-24%)";
        management =
          "No further workup. Consider preventive measures and lifestyle modification. Statin therapy per guidelines.";
        break;
      case "25-49":
        category = "2";
        categoryDesc = "Mild Non-Obstructive CAD (25-49%)";
        management =
          "No further workup. Preventive therapy recommended. Consider statin, aspirin per guidelines.";
        break;
      case "50-69":
        category = "3";
        categoryDesc = "Moderate Stenosis (50-69%)";
        management =
          "Functional testing may be considered to assess hemodynamic significance. Optimize medical therapy.";
        break;
      case "70-99":
        // Check for 4B (LM or 3-vessel)
        if (severe_location === "lm_significant") {
          category = "4B";
          categoryDesc = "Left Main ≥50% or 3-Vessel Severe Disease";
          management =
            "Referral for invasive coronary angiography. Revascularization evaluation. Heart team discussion recommended.";
        } else if (three_vessel === "yes") {
          category = "4B";
          categoryDesc = "3-Vessel Severe Stenosis (≥70% each)";
          management =
            "Referral for invasive coronary angiography. Revascularization evaluation. Heart team discussion recommended.";
        } else {
          category = "4A";
          categoryDesc = "Severe Stenosis (70-99%)";
          management =
            "Referral for invasive coronary angiography. Consider revascularization based on symptoms and ischemia.";
        }
        break;
      case "100":
        category = "5";
        categoryDesc = "Total Occlusion (100%)";
        management =
          "Referral for invasive coronary angiography. Evaluate for CTO PCI if symptoms warrant.";
        break;
    }

    // Build modifiers
    const modifiers = [];

    // Plaque burden modifier
    if (plaque_burden && plaque_burden !== "none") {
      modifiers.push(plaque_burden);
    }

    // High-risk plaque
    if (hrp_features === "present") {
      modifiers.push("HRP");
    }

    // Ischemia testing
    if (ischemia_testing === "yes") {
      modifiers.push("I");
    }

    // Stent/Graft modifiers
    if (prior_intervention === "stent" || prior_intervention === "both") {
      modifiers.push("S");
    }
    if (prior_intervention === "cabg" || prior_intervention === "both") {
      modifiers.push("G");
    }

    // Build final classification
    let fullCategory = `CAD-RADS ${category}`;
    if (modifiers.length > 0) {
      fullCategory += "/" + modifiers.join("/");
    }

    // Build result
    const result = {
      "CAD-RADS Classification": fullCategory,
      Category: `CAD-RADS ${category} - ${categoryDesc}`,
      Management: management,
    };

    // Add modifier explanations
    if (modifiers.length > 0) {
      const modifierExplanations = [];
      if (plaque_burden && plaque_burden !== "none") {
        const plaqueDesc = {
          P1: "Mild plaque burden (1-2 segments)",
          P2: "Moderate plaque burden (3-4 segments)",
          P3: "Severe plaque burden (5-7 segments)",
          P4: "Extensive plaque burden (≥8 segments)",
        };
        modifierExplanations.push(plaqueDesc[plaque_burden]);
      }
      if (hrp_features === "present") {
        modifierExplanations.push(
          "High-risk plaque features present (consider intensified preventive therapy)",
        );
      }
      if (ischemia_testing === "yes") {
        modifierExplanations.push(
          "Ischemia testing recommended for functional assessment",
        );
      }
      result["Modifiers"] = modifierExplanations.join("; ");
    }

    // Stent/Graft status
    if (prior_intervention !== "none" && prior_intervention) {
      const interventionStatus = [];
      if (stent_status) {
        const stentDesc = {
          patent: "Stent(s): Patent",
          stenosis: "Stent(s): In-stent stenosis",
          occluded: "Stent(s): Occluded",
          non_eval: "Stent(s): Non-evaluable",
        };
        interventionStatus.push(stentDesc[stent_status]);
      }
      if (graft_status) {
        const graftDesc = {
          patent: "Graft(s): Patent",
          stenosis: "Graft(s): Stenosis",
          occluded: "Graft(s): Occluded",
          non_eval: "Graft(s): Non-evaluable",
        };
        interventionStatus.push(graftDesc[graft_status]);
      }
      if (interventionStatus.length > 0) {
        result["Prior Intervention Status"] = interventionStatus.join("; ");
      }
    }

    // Risk stratification notes
    const notes = [];

    if (hrp_features === "present") {
      notes.push(
        "High-risk plaque features associated with increased acute coronary syndrome risk independent of stenosis severity",
      );
    }

    if (category === "0" || category === "1") {
      notes.push("Excellent prognosis with very low annual event rate (<1%)");
    } else if (category === "4A" || category === "4B" || category === "5") {
      notes.push(
        "Consider antiplatelet therapy pending further workup if not contraindicated",
      );
    }

    if (plaque_burden === "P3" || plaque_burden === "P4") {
      notes.push(
        "Extensive plaque burden warrants aggressive risk factor modification",
      );
    }

    if (notes.length > 0) {
      result["Clinical Notes"] = notes.join("; ");
    }

    // Study quality note
    if (study_quality === "limited") {
      result["Quality Note"] =
        "Some coronary segments were non-evaluable. Report findings apply to visualized segments only.";
    }

    return result;
  },

  refs: [
    {
      t: "Cury RC, Leipsic J, Abbara S, et al. CAD-RADS 2.0 - 2022 Coronary Artery Disease-Reporting and Data System: An Expert Consensus Document. JACC Cardiovasc Imaging. 2022;15(11):1974-2001.",
      u: "https://doi.org/10.1016/j.jcmg.2022.01.008",
    },
    {
      t: "Cury RC, Abbara S, Achenbach S, et al. CAD-RADS™: Coronary Artery Disease – Reporting and Data System. J Cardiovasc Comput Tomogr. 2016;10(4):269-281.",
      u: "https://doi.org/10.1016/j.jcct.2016.04.005",
    },
    {
      t: "Defined guidelines: SCCT Guidelines for the Interpretation and Reporting of Coronary CT Angiography. J Cardiovasc Comput Tomogr. 2022;16(4):321-332.",
      u: "https://doi.org/10.1016/j.jcct.2022.02.003",
    },
    {
      t: "Defined guidelines: 2019 ESC Guidelines for the diagnosis and management of chronic coronary syndromes. Eur Heart J. 2020;41(3):407-477.",
      u: "https://doi.org/10.1093/eurheartj/ehz425",
    },
    {
      t: "ACR-NASCI-SPR Practice Parameter for the Performance and Interpretation of Cardiac Computed Tomography.",
      u: "https://www.acr.org/Clinical-Resources/Practice-Parameters-and-Technical-Standards",
    },
  ],
};
