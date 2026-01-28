/**
 * BI-RADS Calculator
 *
 * Breast Imaging Reporting and Data System for mammography, ultrasound, and MRI.
 * Standardized classification with management recommendations.
 *
 * Primary Sources:
 * - ACR BI-RADS Atlas, 5th Edition (2013)
 * - D'Orsi CJ, et al. J Am Coll Radiol. 2013;10(10):733-740
 */

export const BIRADS = {
  id: "birads",
  category: "Breast Imaging",
  name: "ACR BI-RADS",
  desc: "Breast Imaging Reporting and Data System for mammography, ultrasound, and MRI",
  keywords: ["breast", "mammography", "breast cancer", "mammogram"],
  metaDesc:
    "Free BI-RADS Calculator. ACR Breast Imaging Reporting and Data System with categories 0-6, malignancy risk, and management recommendations.",

  info: {
    text: `BI-RADS (Breast Imaging Reporting and Data System) is the ACR standardized system for breast imaging interpretation and reporting.

Categories apply to mammography, ultrasound, and MRI:
• Category 0: Incomplete - need additional imaging
• Category 1: Negative
• Category 2: Benign finding
• Category 3: Probably benign (<2% malignancy risk)
• Category 4: Suspicious
  - 4A: Low suspicion (2-10%)
  - 4B: Moderate suspicion (10-50%)
  - 4C: High suspicion (50-95%)
• Category 5: Highly suggestive of malignancy (>95%)
• Category 6: Known biopsy-proven malignancy

Key management:
• Categories 1-2: Routine screening
• Category 3: Short-term follow-up (6 months)
• Categories 4-5: Tissue diagnosis (biopsy)
• Category 6: Surgical excision

BI-RADS emphasizes standardized lexicon terms for mass shape, margin, density, and associated features.`,
    link: {
      label: "View ACR BI-RADS Resources",
      url: "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/Bi-Rads",
    },
  },

  fields: [
    // MODALITY
    {
      id: "modality",
      label: "Imaging Modality",
      type: "radio",
      opts: [
        { value: "mammography", label: "Mammography" },
        { value: "ultrasound", label: "Ultrasound" },
        { value: "mri", label: "MRI" },
      ],
    },

    // STUDY CONTEXT
    {
      id: "study_context",
      label: "Study Context",
      type: "radio",
      opts: [
        { value: "screening", label: "Screening examination" },
        { value: "diagnostic", label: "Diagnostic examination" },
        { value: "known_cancer", label: "Known biopsy-proven malignancy" },
      ],
    },

    // ADDITIONAL IMAGING NEEDED
    {
      id: "additional_needed",
      label: "Additional Imaging/Assessment Needed",
      type: "radio",
      showIf: (vals) => vals.study_context !== "known_cancer",
      opts: [
        { value: "no", label: "No - assessment complete" },
        { value: "yes", label: "Yes - need additional imaging evaluation" },
      ],
    },

    // FINDING PRESENT
    {
      id: "finding_type",
      label: "Finding Type",
      type: "radio",
      showIf: (vals) =>
        vals.additional_needed !== "yes" &&
        vals.study_context !== "known_cancer",
      opts: [
        { value: "negative", label: "Negative - no findings" },
        {
          value: "benign",
          label:
            "Benign finding (cyst, calcified fibroadenoma, fat-containing lesion, implant)",
        },
        { value: "mass", label: "Mass" },
        { value: "calcifications", label: "Calcifications (without mass)" },
        {
          value: "architectural_distortion",
          label: "Architectural distortion",
        },
        { value: "asymmetry", label: "Asymmetry" },
        {
          value: "associated_features",
          label: "Associated features only (skin changes, nipple retraction)",
        },
      ],
    },

    // MASS SHAPE (for mass finding)
    {
      id: "mass_shape",
      label: "Mass Shape",
      type: "radio",
      showIf: (vals) => vals.finding_type === "mass",
      opts: [
        { value: "oval", label: "Oval" },
        { value: "round", label: "Round" },
        { value: "irregular", label: "Irregular" },
      ],
    },

    // MASS MARGIN
    {
      id: "mass_margin",
      label: "Mass Margin",
      type: "radio",
      showIf: (vals) => vals.finding_type === "mass",
      opts: [
        { value: "circumscribed", label: "Circumscribed" },
        { value: "obscured", label: "Obscured" },
        { value: "microlobulated", label: "Microlobulated" },
        { value: "indistinct", label: "Indistinct" },
        { value: "spiculated", label: "Spiculated" },
      ],
    },

    // MASS DENSITY (mammography specific)
    {
      id: "mass_density",
      label: "Mass Density",
      type: "radio",
      showIf: (vals) =>
        vals.finding_type === "mass" && vals.modality === "mammography",
      opts: [
        { value: "fat", label: "Fat-containing (radiolucent)" },
        { value: "low", label: "Low density" },
        { value: "equal", label: "Equal density" },
        { value: "high", label: "High density" },
      ],
    },

    // CALCIFICATION TYPE
    {
      id: "calc_morphology",
      label: "Calcification Morphology",
      type: "radio",
      showIf: (vals) => vals.finding_type === "calcifications",
      opts: [
        {
          value: "typically_benign",
          label:
            "Typically benign (skin, vascular, coarse, large rod-like, round, rim, dystrophic, milk of calcium, suture)",
        },
        { value: "amorphous", label: "Amorphous" },
        { value: "coarse_heterogeneous", label: "Coarse heterogeneous" },
        { value: "fine_pleomorphic", label: "Fine pleomorphic" },
        { value: "fine_linear", label: "Fine linear or fine-linear branching" },
      ],
    },

    // CALCIFICATION DISTRIBUTION
    {
      id: "calc_distribution",
      label: "Calcification Distribution",
      type: "radio",
      showIf: (vals) =>
        vals.finding_type === "calcifications" &&
        vals.calc_morphology !== "typically_benign",
      opts: [
        { value: "diffuse", label: "Diffuse" },
        { value: "regional", label: "Regional" },
        { value: "grouped", label: "Grouped (clustered)" },
        { value: "linear", label: "Linear" },
        { value: "segmental", label: "Segmental" },
      ],
    },

    // ASYMMETRY TYPE
    {
      id: "asymmetry_type",
      label: "Asymmetry Type",
      type: "radio",
      showIf: (vals) => vals.finding_type === "asymmetry",
      opts: [
        { value: "asymmetry", label: "Asymmetry (one view only)" },
        { value: "global", label: "Global asymmetry" },
        { value: "focal", label: "Focal asymmetry" },
        {
          value: "developing",
          label: "Developing asymmetry (new or increased)",
        },
      ],
    },

    // OVERALL SUSPICION LEVEL (for complex cases)
    {
      id: "suspicion_level",
      label: "Overall Assessment of Suspicion",
      subLabel: "Based on composite features",
      type: "radio",
      showIf: (vals) =>
        vals.finding_type === "mass" ||
        vals.finding_type === "calcifications" ||
        vals.finding_type === "architectural_distortion" ||
        vals.finding_type === "asymmetry" ||
        vals.finding_type === "associated_features",
      opts: [
        {
          value: "probably_benign",
          label: "Probably benign (<2% likelihood of malignancy)",
        },
        {
          value: "low_suspicion",
          label: "Low suspicion for malignancy (2-10%)",
        },
        { value: "moderate_suspicion", label: "Moderate suspicion (10-50%)" },
        { value: "high_suspicion", label: "High suspicion (50-95%)" },
        {
          value: "highly_suggestive",
          label: "Highly suggestive of malignancy (>95%)",
        },
      ],
    },
  ],

  compute: (vals) => {
    const {
      modality = "",
      study_context = "",
      additional_needed = "",
      finding_type = "",
      mass_shape = "",
      mass_margin = "",
      mass_density = "",
      calc_morphology = "",
      calc_distribution = "",
      asymmetry_type = "",
      suspicion_level = "",
    } = vals;

    // Known cancer (Category 6)
    if (study_context === "known_cancer") {
      return {
        "BI-RADS Category": "6 - Known Biopsy-Proven Malignancy",
        Management:
          "Surgical excision when clinically appropriate; imaging for treatment planning and response assessment",
        Note: "Category 6 is used for known biopsy-proven malignancy prior to definitive treatment.",
      };
    }

    // Category 0: Incomplete
    if (additional_needed === "yes") {
      let additionalType = "";
      if (modality === "mammography") {
        additionalType =
          "Additional mammographic views, ultrasound, or prior images for comparison";
      } else if (modality === "ultrasound") {
        additionalType =
          "Mammography if not performed, or targeted additional imaging";
      } else {
        additionalType = "Prior studies for comparison or additional sequences";
      }

      return {
        "BI-RADS Category": "0 - Incomplete",
        Management:
          "Recall for additional imaging evaluation before final assessment",
        "Additional Imaging": additionalType,
        Note: "Category 0 should only be used when additional imaging will help reach a final assessment.",
      };
    }

    if (!finding_type) {
      return { Error: "Please select the finding type." };
    }

    // Category 1: Negative
    if (finding_type === "negative") {
      return {
        "BI-RADS Category": "1 - Negative",
        "Malignancy Risk": "Essentially 0%",
        Management: "Routine screening mammography",
        "Screening Interval":
          study_context === "screening"
            ? "Annual (or per guidelines)"
            : "Return to annual screening",
        Note: "No mammographic findings to report. Routine screening recommended.",
      };
    }

    // Category 2: Benign
    if (finding_type === "benign") {
      return {
        "BI-RADS Category": "2 - Benign",
        "Malignancy Risk": "Essentially 0%",
        Management: "Routine screening mammography",
        Note: "Definitively benign finding described for completeness. No cancer expected.",
      };
    }

    // For other findings, use suspicion level
    if (!suspicion_level) {
      return {
        Error:
          "Please select the overall suspicion level based on imaging features.",
      };
    }

    let category = "";
    let subCategory = "";
    let malignancyRisk = "";
    let management = "";
    let findingDesc = "";

    // Build finding description
    if (finding_type === "mass") {
      findingDesc = `Mass: ${mass_shape || "shape not specified"}, ${mass_margin || "margin not specified"}`;
      if (mass_density) findingDesc += `, ${mass_density} density`;
    } else if (finding_type === "calcifications") {
      findingDesc = `Calcifications: ${calc_morphology || "morphology not specified"}`;
      if (calc_distribution)
        findingDesc += `, ${calc_distribution} distribution`;
    } else if (finding_type === "asymmetry") {
      findingDesc = `Asymmetry: ${asymmetry_type || "type not specified"}`;
    } else if (finding_type === "architectural_distortion") {
      findingDesc = "Architectural distortion";
    } else if (finding_type === "associated_features") {
      findingDesc = "Associated features (skin/nipple changes)";
    }

    // Determine category based on suspicion level
    switch (suspicion_level) {
      case "probably_benign":
        category = "3";
        malignancyRisk = "<2%";
        management = "Short-interval follow-up (6 months) strongly recommended";
        break;
      case "low_suspicion":
        category = "4";
        subCategory = "A";
        malignancyRisk = "2-10%";
        management = "Tissue diagnosis recommended (biopsy)";
        break;
      case "moderate_suspicion":
        category = "4";
        subCategory = "B";
        malignancyRisk = "10-50%";
        management = "Tissue diagnosis required (biopsy)";
        break;
      case "high_suspicion":
        category = "4";
        subCategory = "C";
        malignancyRisk = "50-95%";
        management = "Tissue diagnosis required (biopsy); high PPV";
        break;
      case "highly_suggestive":
        category = "5";
        malignancyRisk = ">95%";
        management =
          "Tissue diagnosis required; appropriate action should be taken";
        break;
    }

    // Build category string and description inline
    const categoryStr = subCategory ? `${category}${subCategory}` : category;
    const categoryDescriptions = {
      3: "Probably Benign",
      "4A": "Low Suspicion for Malignancy",
      "4B": "Moderate Suspicion for Malignancy",
      "4C": "High Suspicion for Malignancy",
      5: "Highly Suggestive of Malignancy",
    };
    const categoryDesc = categoryDescriptions[categoryStr] || "Suspicious";

    // Build result
    const result = {
      "BI-RADS Category": `${categoryStr} - ${categoryDesc}`,
      "Malignancy Likelihood": malignancyRisk,
      Management: management,
      "Finding Description": findingDesc,
    };

    // Add feature-specific notes
    const notes = [];

    if (mass_margin === "spiculated" || mass_shape === "irregular") {
      notes.push(
        "Spiculated margins and irregular shape are highly suspicious features",
      );
    }

    if (calc_morphology === "fine_linear") {
      notes.push(
        "Fine linear/branching calcifications are the most suspicious morphology",
      );
    }

    if (calc_distribution === "segmental" || calc_distribution === "linear") {
      notes.push(
        "Segmental or linear distribution suggests ductal involvement",
      );
    }

    if (asymmetry_type === "developing") {
      notes.push("Developing asymmetry warrants tissue diagnosis");
    }

    if (category === "3") {
      notes.push(
        "Category 3 requires dedicated short-term follow-up protocol: 6-month unilateral, then 6-month bilateral, then annual × 2 years",
      );
      notes.push(
        "Biopsy may be considered if patient preference or high anxiety",
      );
    }

    if (notes.length > 0) {
      result["Clinical Notes"] = notes.join("; ");
    }

    return result;
  },

  refs: [
    {
      t: "D'Orsi CJ, Sickles EA, Mendelson EB, Morris EA. ACR BI-RADS Atlas, Breast Imaging Reporting and Data System. 5th ed. American College of Radiology; 2013.",
      u: "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/Bi-Rads",
    },
    {
      t: "D'Orsi CJ, Bassett LW, Berg WA, et al. Mammography: ACR BI-RADS Lexicon and Atlas. J Am Coll Radiol. 2013;10(10):733-740.",
      u: "https://doi.org/10.1016/j.jacr.2013.05.016",
    },
    {
      t: "Sickles EA. Periodic mammographic follow-up of probably benign lesions: results in 3,184 consecutive cases. Radiology. 1991;179(2):463-468.",
      u: "https://doi.org/10.1148/radiology.179.2.2014293",
    },
    {
      t: "Defined guidelines Breast Cancer Screening and Diagnosis ACR Appropriateness Criteria. J Am Coll Radiol. 2021;18(5S):S13-S30.",
      u: "https://doi.org/10.1016/j.jacr.2021.02.003",
    },
    {
      t: "ACR BI-RADS Follow-Up and Outcome Monitoring.",
      u: "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/Bi-Rads/BI-RADS-FAQ",
    },
  ],
};
