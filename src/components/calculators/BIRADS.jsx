/**
 * BI-RADS Calculator
 *
 * Breast Imaging Reporting and Data System for mammography, ultrasound, and MRI.
 * Standardized classification with management recommendations.
 *
 * Primary Sources:
 * - ACR BI-RADS Atlas, 5th Edition (2013)
 * - ACR BI-RADS Atlas Fifth Edition Quick Reference
 */

export const BIRADS = {
  id: "birads",
  category: "Breast Imaging",
  name: "BI-RADS Assessment Calculator (Legacy 2013)",
  desc: "Interactive 2013-era assessment assistant for mammography, ultrasound, and MRI",
  guidelineVersion: "Legacy ACR BI-RADS 5th Ed. (2013)",
  keywords: [
    "breast",
    "mammography",
    "ultrasound",
    "MRI",
    "breast cancer",
    "mammogram",
    "BI-RADS",
    "BIRADS",
  ],
  tags: ["Breast", "Radiology", "Oncology"],
  metaDesc:
    "Legacy 2013 BI-RADS assessment calculator for mammography, ultrasound, and MRI with categories 0-6, risk bands, management context, and structured finding summaries.",

  info: {
    text: `Temporary legacy calculator: this page restores the 2013-era fifth-edition workflow while Radulator's sixth-edition implementation is under source review. It does not implement the 2025 sixth edition.

This is an interactive assessment assistant, not image interpretation. For non-benign findings, the radiologist-selected suspicion level determines the suggested category; the selected imaging descriptors structure the finding summary and clinical notes but do not independently calculate malignancy probability. Apply current institutional policy, clinical context, prior examinations, and radiologic-pathologic concordance.

BI-RADS (Breast Imaging Reporting and Data System) is the ACR standardized system for breast imaging interpretation and reporting.

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
• Category 6: Multidisciplinary treatment planning

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
      subLabel:
        "Radiologist-selected assessment; descriptors structure the output but do not independently derive risk",
      helpText:
        "Choose the overall suspicion level after integrating all imaging and clinical findings.",
      type: "radio",
      showIf: (vals) =>
        vals.finding_type === "mass" ||
        (vals.finding_type === "calcifications" &&
          vals.calc_morphology !== "typically_benign") ||
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

    const routineScreeningManagement =
      "Routine screening according to patient age, risk, symptoms, modality, and local protocol";
    const modalityLabel =
      {
        mammography: "mammography",
        ultrasound: "ultrasound",
        mri: "breast MRI",
      }[modality] || "the selected modality";

    // Known cancer (Category 6)
    if (study_context === "known_cancer") {
      return {
        "BI-RADS Category": "6 - Known Biopsy-Proven Malignancy",
        Management:
          "Coordinate multidisciplinary breast care; imaging may support staging, treatment planning, and response assessment",
        Note: "Category 6 is used for known biopsy-proven malignancy prior to definitive treatment.",
        _severity: "danger",
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
        _severity: "info",
      };
    }

    if (!finding_type) {
      return { Error: "Please select the finding type." };
    }

    // Category 1: Negative
    if (finding_type === "negative") {
      const followUp =
        study_context === "screening"
          ? { "Screening Interval": "Annual (or per guidelines)" }
          : {
              "Follow-up":
                "No imaging follow-up for this negative assessment; continue age- and risk-appropriate screening and manage the clinical indication separately",
            };

      return {
        "BI-RADS Category": "1 - Negative",
        "Malignancy Risk": "Essentially 0%",
        Management: routineScreeningManagement,
        ...followUp,
        Note: `No suspicious imaging finding identified on ${modalityLabel}. A negative imaging assessment does not supersede management of a persistent clinical concern.`,
        _severity: "success",
      };
    }

    // Category 2: Benign
    if (finding_type === "benign") {
      return {
        "BI-RADS Category": "2 - Benign",
        "Malignancy Risk": "Essentially 0%",
        Management: routineScreeningManagement,
        Note: "Definitively benign finding described for completeness. No cancer expected.",
        _severity: "success",
      };
    }

    if (
      finding_type === "calcifications" &&
      calc_morphology === "typically_benign"
    ) {
      return {
        "BI-RADS Category": "2 - Benign",
        "Malignancy Risk": "Essentially 0%",
        Management: routineScreeningManagement,
        "Finding Description": "Calcifications: typically benign calcifications",
        Note: "The selected morphology is a typically benign calcification pattern in this legacy workflow.",
        _severity: "success",
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
        management =
          "Short-interval imaging follow-up, commonly beginning at 6 months; apply modality and institutional protocol";
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

    const suspiciousDescriptorWithCategory3 =
      category === "3" &&
      (mass_shape === "irregular" ||
        mass_margin === "spiculated" ||
        calc_morphology === "fine_pleomorphic" ||
        calc_morphology === "fine_linear" ||
        asymmetry_type === "developing" ||
        finding_type === "architectural_distortion" ||
        finding_type === "associated_features");

    const decisionChecks = [];
    if (suspiciousDescriptorWithCategory3) {
      decisionChecks.push(
        "The selected probably-benign category is discordant with one or more chosen suspicious descriptors. Reassess the radiologist-selected category and current source criteria before finalizing the report.",
      );
    }
    if (
      modality === "mammography" &&
      study_context === "screening" &&
      ["3", "4", "5"].includes(category)
    ) {
      decisionChecks.push(
        "Categories 3, 4, and 5 should not be assigned directly from screening mammography in the fifth-edition workflow. Complete the diagnostic workup before final assessment.",
      );
    }
    if (decisionChecks.length > 0) {
      result["Decision Check"] = decisionChecks.join(" ");
    }

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
        "Category 3 requires a complete modality-appropriate short-interval surveillance protocol; an initial 6-month follow-up is commonly used",
      );
      notes.push(
        "Biopsy may be considered if patient preference or high anxiety",
      );
    }

    if (notes.length > 0) {
      result["Clinical Notes"] = notes.join("; ");
    }

    result._severity = category === "3" ? "warning" : "danger";
    return result;
  },

  refs: [
    {
      t: "D'Orsi CJ, Sickles EA, Mendelson EB, Morris EA. ACR BI-RADS Atlas, Breast Imaging Reporting and Data System. 5th ed. American College of Radiology; 2013.",
      u: "https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/BI-RADS",
    },
    {
      t: "American College of Radiology. ACR BI-RADS Atlas Fifth Edition Quick Reference: mammography, ultrasound, MRI, and assessment categories.",
      u: "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/BI-RADS/BIRADS-Poster.pdf",
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
      u: "https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Screening-Resources/Breast-Imaging-Resources/Lay-Report-Letters",
    },
  ],
};
