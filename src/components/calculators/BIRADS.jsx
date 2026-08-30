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

const STRUCTURED_FINDING_TYPES = Object.freeze([
  "mass",
  "calcifications",
  "architectural_distortion",
  "asymmetry",
  "associated_features",
]);

const hasStructuredFinding = (vals) =>
  STRUCTURED_FINDING_TYPES.includes(vals.finding_type);

export const BIRADS = {
  id: "birads",
  category: "Breast Imaging",
  name: "BI-RADS Assessment Calculator (Legacy 2013)",
  desc: "Interactive 2013-era assessment assistant for mammography, ultrasound, and MRI",
  guidelineVersion:
    "Legacy ACR BI-RADS 5th Ed. (2013) with public 2025 assessment-summary constraints",
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
    "Temporary legacy BI-RADS assessment assistant for mammography, ultrasound, and MRI with modality-gated descriptors and source-literal category boundaries.",

  info: {
    text: `Temporary legacy calculator: this page restores the 2013-era fifth-edition workflow while Radulator's sixth-edition implementation is under source review. It does not implement the 2025 sixth edition.

This is an interactive assessment assistant, not image interpretation. The radiologist selects the assessment level after interpreting the examination; descriptors only structure the finding summary and never derive a category or patient-specific probability. Apply current institutional policy, clinical context, prior examinations, and radiologic-pathologic concordance.

The legacy fifth-edition quick-reference constrains modality-specific descriptor choices. Current public ACR modality summary forms are used only to constrain the category structure, source-literal probability endpoints, and management wording while the full sixth-edition implementation remains under review.

BI-RADS (Breast Imaging Reporting and Data System) is the ACR standardized system for breast imaging interpretation and reporting.

Categories apply to mammography, ultrasound, and MRI:
• Category 0: Incomplete - need additional imaging
• Category 1: Negative
• Category 2: Benign finding
• Category 3: Probably benign (>0% to ≤2% for mammography/ultrasound; the MRI summary prints ≥0% to ≤2%)
• Category 4: Suspicious (>2% to <95% for ultrasound/MRI)
  - Mammography 4A: >2% to ≤10%
  - Mammography 4B: >10% to ≤50%
  - Mammography 4C: 50% to <95%
  - Ultrasound and MRI use Category 4 without A-C subdivisions in this source-gated temporary workflow
• Category 5: Highly suggestive of malignancy (≥95%)
• Category 6: Known biopsy-proven malignancy

Management wording follows the linked modality summary form: routine screening for categories 1-2, short-interval follow-up or continued surveillance for category 3, tissue diagnosis for categories 4-5, and surgeon/oncologist follow-up with definitive local therapy (usually surgery) when clinically appropriate for category 6.

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
        {
          value: "calcifications",
          label: "Calcifications (without mass)",
          showIf: (vals) => vals.modality === "mammography",
        },
        {
          value: "architectural_distortion",
          label: "Architectural distortion",
          showIf: (vals) => vals.modality === "mammography",
        },
        {
          value: "asymmetry",
          label: "Asymmetry",
          showIf: (vals) => vals.modality === "mammography",
        },
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
        {
          value: "obscured",
          label: "Obscured",
          showIf: (vals) => vals.modality === "mammography",
        },
        {
          value: "microlobulated",
          label: "Microlobulated",
          showIf: (vals) => vals.modality === "mammography",
        },
        {
          value: "indistinct",
          label: "Indistinct",
          showIf: (vals) => vals.modality === "mammography",
        },
        {
          value: "angular",
          label: "Angular",
          showIf: (vals) => vals.modality === "ultrasound",
        },
        {
          value: "irregular_margin",
          label: "Irregular margin",
          showIf: (vals) => vals.modality === "mri",
        },
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
      showIf: (vals) =>
        vals.modality === "mammography" &&
        vals.finding_type === "calcifications",
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
        vals.modality === "mammography" &&
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
      showIf: (vals) =>
        vals.modality === "mammography" && vals.finding_type === "asymmetry",
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

    // RADIOLOGIST-ASSIGNED ASSESSMENT
    {
      id: "suspicion_level",
      label: "Radiologist-Assigned Assessment",
      subLabel:
        "Required explicit category selection; the finding type and descriptors do not assign a category",
      helpText:
        "Choose the assessment already assigned after integrating all imaging and clinical findings.",
      type: "radio",
      showIf: (vals) =>
        vals.additional_needed !== "yes" &&
        vals.study_context !== "known_cancer" &&
        Boolean(vals.finding_type),
      opts: [
        {
          value: "negative",
          label: "Negative (Category 1)",
          showIf: (vals) => vals.finding_type === "negative",
        },
        {
          value: "benign",
          label: "Benign (Category 2)",
          showIf: (vals) => vals.finding_type === "benign",
        },
        {
          value: "probably_benign",
          label: "Probably benign (Category 3)",
          showIf: hasStructuredFinding,
        },
        {
          value: "low_suspicion",
          label: "Low suspicion (Category 4A; >2% to ≤10%)",
          showIf: (vals) =>
            vals.modality === "mammography" && hasStructuredFinding(vals),
        },
        {
          value: "moderate_suspicion",
          label: "Moderate suspicion (Category 4B; >10% to ≤50%)",
          showIf: (vals) =>
            vals.modality === "mammography" && hasStructuredFinding(vals),
        },
        {
          value: "high_suspicion",
          label: "High suspicion (Category 4C; 50% to <95%)",
          showIf: (vals) =>
            vals.modality === "mammography" && hasStructuredFinding(vals),
        },
        {
          value: "suspicious",
          label: "Suspicious (Category 4; >2% to <95%)",
          showIf: (vals) =>
            vals.modality !== "mammography" && hasStructuredFinding(vals),
        },
        {
          value: "highly_suggestive",
          label: "Highly suggestive (Category 5; ≥95%)",
          showIf: hasStructuredFinding,
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
      {
        mammography: "Routine mammography screening",
        ultrasound: "Routine screening",
        mri: "Routine breast screening, including MRI if appropriate according to major guidelines",
      }[modality] || "Routine screening";
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
          "Clinical follow-up with surgeon and/or oncologist, and definitive local therapy (usually surgery) when clinically appropriate",
        Note: "Category 6 is used for known biopsy-proven malignancy.",
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

    if (
      modality !== "mammography" &&
      ["calcifications", "architectural_distortion", "asymmetry"].includes(
        finding_type,
      )
    ) {
      return {
        Error:
          "The selected finding type is mammography-specific in this temporary workflow. Choose a modality-appropriate finding type.",
      };
    }

    const allowedMassMargins = {
      mammography: [
        "circumscribed",
        "obscured",
        "microlobulated",
        "indistinct",
        "spiculated",
      ],
      ultrasound: [
        "circumscribed",
        "angular",
        "microlobulated",
        "indistinct",
        "spiculated",
      ],
      mri: ["circumscribed", "irregular_margin", "spiculated"],
    };
    if (
      finding_type === "mass" &&
      mass_margin &&
      !allowedMassMargins[modality]?.includes(mass_margin)
    ) {
      return {
        Error:
          "The selected mass margin is not available for this modality in the source-gated temporary workflow.",
      };
    }

    if (!suspicion_level) {
      return {
        Error: "Please select the radiologist-assigned assessment.",
      };
    }

    if (
      (finding_type === "negative" && suspicion_level !== "negative") ||
      (finding_type !== "negative" && suspicion_level === "negative")
    ) {
      return {
        Error:
          "The selected Category 1 assessment is inconsistent with the finding type. Reconfirm the radiologist-assigned assessment.",
      };
    }
    if (
      (finding_type === "benign" && suspicion_level !== "benign") ||
      (finding_type !== "benign" && suspicion_level === "benign")
    ) {
      return {
        Error:
          "The selected Category 2 assessment is inconsistent with the finding type. Reconfirm the radiologist-assigned assessment.",
      };
    }

    // Category 1: explicit radiologist-assigned negative assessment
    if (suspicion_level === "negative") {
      return {
        "BI-RADS Category": "1 - Negative",
        "Malignancy Likelihood": "Essentially 0% likelihood of malignancy",
        Management: routineScreeningManagement,
        Note: `No suspicious imaging finding identified on ${modalityLabel}; manage any persistent clinical concern separately from this imaging assessment.`,
        _severity: "success",
      };
    }

    // Category 2: explicit radiologist-assigned benign assessment
    if (suspicion_level === "benign") {
      return {
        "BI-RADS Category": "2 - Benign",
        "Malignancy Likelihood": "Essentially 0% likelihood of malignancy",
        Management: routineScreeningManagement,
        Note: "Benign finding described for completeness.",
        _severity: "success",
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
        malignancyRisk =
          modality === "mri" ? "≥0% to ≤2%" : ">0% to ≤2%";
        management =
          modality === "mammography"
            ? "Short-interval (6-month) follow-up or continued surveillance mammography"
            : "Short-interval (6-month) follow-up or continued surveillance (12 months)";
        break;
      case "low_suspicion":
        if (modality !== "mammography") {
          return {
            Error:
              "Ultrasound and MRI use Category 4 without A-C subdivisions in the source-gated temporary workflow.",
          };
        }
        category = "4";
        subCategory = "A";
        malignancyRisk = ">2% to ≤10%";
        management = "Tissue diagnosis";
        break;
      case "moderate_suspicion":
        if (modality !== "mammography") {
          return {
            Error:
              "Ultrasound and MRI use Category 4 without A-C subdivisions in the source-gated temporary workflow.",
          };
        }
        category = "4";
        subCategory = "B";
        malignancyRisk = ">10% to ≤50%";
        management = "Tissue diagnosis";
        break;
      case "high_suspicion":
        if (modality !== "mammography") {
          return {
            Error:
              "Ultrasound and MRI use Category 4 without A-C subdivisions in the source-gated temporary workflow.",
          };
        }
        category = "4";
        subCategory = "C";
        malignancyRisk = "50% to <95%";
        management = "Tissue diagnosis";
        break;
      case "suspicious":
        if (modality === "mammography") {
          return {
            Error:
              "Use the mammography Category 4A-C assessment options for mammography.",
          };
        }
        category = "4";
        malignancyRisk = ">2% to <95%";
        management = "Tissue diagnosis";
        break;
      case "highly_suggestive":
        category = "5";
        malignancyRisk = "≥95%";
        management = "Tissue diagnosis";
        break;
    }

    if (!category) {
      return { Error: "Please select a modality-appropriate assessment level." };
    }

    // Build category string and description inline
    const categoryStr = subCategory ? `${category}${subCategory}` : category;
    const categoryDescriptions = {
      3: "Probably Benign",
      "4A": "Low Suspicion for Malignancy",
      "4B": "Moderate Suspicion for Malignancy",
      "4C": "High Suspicion for Malignancy",
      4: "Suspicious",
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
      ((finding_type === "mass" &&
        (mass_shape === "irregular" || mass_margin === "spiculated")) ||
        (finding_type === "calcifications" &&
          (calc_morphology === "fine_pleomorphic" ||
            calc_morphology === "fine_linear")) ||
        (finding_type === "asymmetry" && asymmetry_type === "developing") ||
        finding_type === "architectural_distortion" ||
        finding_type === "associated_features");

    const decisionChecks = [];
    if (suspiciousDescriptorWithCategory3) {
      decisionChecks.push(
        "The selected probably-benign category is discordant with one or more chosen suspicious descriptors. Reassess the radiologist-selected category and current source criteria before finalizing the report.",
      );
    }
    if (decisionChecks.length > 0) {
      result["Decision Check"] = decisionChecks.join(" ");
    }

    if (["4B", "4C"].includes(categoryStr)) {
      result["Published Boundary Note"] =
        "The public mammography summary form prints Category 4B as >10% to ≤50% and Category 4C as 50% to <95%, creating a source-literal overlap at exactly 50%. This assistant preserves the selected radiologist-assigned category and does not normalize that boundary.";
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
      t: "American College of Radiology. BI-RADS v2025 Mammography Summary: assessment structure, source-literal likelihood endpoints, and management wording.",
      u: "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/BI-RADS/BI-RADS-Summary-Form-Mammography.pdf",
    },
    {
      t: "American College of Radiology. BI-RADS v2025 Ultrasound Summary: assessment structure, likelihood endpoints, and management wording.",
      u: "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/BI-RADS/BI-RADS-Summary-Form-Ultrasound.pdf",
    },
    {
      t: "American College of Radiology. BI-RADS v2025 MRI Summary: unsplit Category 4 structure, likelihood endpoints, and management wording.",
      u: "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/BI-RADS/BI-RADS-Summary-Form-MRI.pdf",
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
