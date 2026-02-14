/**
 * Lung-RADS v2022 Calculator
 *
 * Lung Imaging Reporting and Data System for lung cancer screening CT.
 * Provides standardized reporting categories with management recommendations.
 *
 * Primary Sources:
 * - ACR Lung-RADS v2022 (Current version)
 * - Defined guidelines: Lung Cancer Screening Update. Radiology. 2022
 */

export const LUNGRADS = {
  id: "lung-rads",
  category: "Radiology",
  name: "Lung-RADS v2022",
  desc: "Lung cancer screening CT classification and management recommendations",
  guidelineVersion: "Lung-RADS v2022",
  keywords: ["lung cancer screening", "LDCT", "low-dose CT", "Lung-RADS"],
  tags: ["Radiology", "Pulmonary", "Oncology"],
  metaDesc:
    "Free Lung-RADS v2022 Calculator. ACR standardized lung cancer screening CT classification with nodule measurement and management recommendations.",

  info: {
    text: `Lung-RADS (Lung Imaging Reporting and Data System) v2022 is the ACR standardized system for reporting lung cancer screening CT findings.

Categories:
• Category 0: Incomplete (prior CT needed for comparison)
• Category 1: Negative (no nodules, definitely benign findings)
• Category 2: Benign appearance (<1% malignancy)
• Category 3: Probably benign (1-2% malignancy)
• Category 4A: Suspicious (5-15% malignancy)
• Category 4B: Suspicious (>15% malignancy)
• Category 4X: Features suspicious for malignancy
• Category S: Other findings requiring workup

Key size thresholds (solid nodules):
• <6mm: Category 2
• 6-8mm (new): Category 3
• 8-15mm (new) or ≥6mm (growing): Category 4A
• ≥15mm (new): Category 4B

Lung-RADS 2022 updates include:
• Atypical pulmonary cyst category
• Revised part-solid and ground-glass nodule criteria
• Perifissural nodule classification`,
    link: {
      label: "View ACR Lung-RADS Resources",
      url: "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/Lung-RADS",
    },
  },

  fields: [
    // PRIOR CT AVAILABILITY
    {
      id: "prior_ct",
      label: "Prior Lung Cancer Screening CT Available",
      type: "radio",
      opts: [
        { value: "yes", label: "Yes - prior screening CT available" },
        {
          value: "no_not_expected",
          label: "No - baseline scan (first screening)",
        },
        { value: "no_expected", label: "No - prior expected but unavailable" },
      ],
    },

    // NODULE TYPE
    {
      id: "nodule_type",
      label: "Dominant Finding Type",
      type: "radio",
      opts: [
        { value: "none", label: "No nodules (negative exam)" },
        {
          value: "benign",
          label: "Definitely benign (calcified granuloma, hamartoma)",
        },
        { value: "solid", label: "Solid nodule or mass" },
        {
          value: "part_solid",
          label: "Part-solid nodule (ground-glass with solid component)",
        },
        { value: "ground_glass", label: "Pure ground-glass nodule (pGGN)" },
        { value: "atypical_cyst", label: "Atypical pulmonary cyst" },
        { value: "perifissural", label: "Perifissural nodule (PFN)" },
      ],
    },

    // SOLID NODULE SIZE (for solid and PFN)
    {
      id: "solid_size",
      label: "Solid Nodule Size (mm)",
      subLabel: "Average of long and short axis diameters",
      type: "number",
      showIf: (vals) =>
        vals.nodule_type === "solid" || vals.nodule_type === "perifissural",
    },

    // SOLID NODULE CHANGE
    {
      id: "solid_change",
      label: "Nodule Change from Prior",
      type: "radio",
      showIf: (vals) =>
        (vals.nodule_type === "solid" || vals.nodule_type === "perifissural") &&
        vals.prior_ct === "yes",
      opts: [
        { value: "new", label: "New nodule" },
        { value: "stable", label: "Stable (unchanged for ≥3 months)" },
        { value: "growing", label: "Growing (≥1.5mm increase)" },
        { value: "shrinking", label: "Shrinking" },
      ],
    },

    // PART-SOLID: TOTAL SIZE
    {
      id: "part_solid_total",
      label: "Part-Solid Nodule Total Size (mm)",
      subLabel: "Including ground-glass component",
      type: "number",
      showIf: (vals) => vals.nodule_type === "part_solid",
    },

    // PART-SOLID: SOLID COMPONENT SIZE
    {
      id: "part_solid_solid",
      label: "Solid Component Size (mm)",
      subLabel: "Solid portion only",
      type: "number",
      showIf: (vals) => vals.nodule_type === "part_solid",
    },

    // PART-SOLID CHANGE
    {
      id: "part_solid_change",
      label: "Part-Solid Nodule Change",
      type: "radio",
      showIf: (vals) =>
        vals.nodule_type === "part_solid" && vals.prior_ct === "yes",
      opts: [
        { value: "new", label: "New nodule" },
        { value: "stable", label: "Stable" },
        { value: "growing_total", label: "Growing total size" },
        { value: "growing_solid", label: "Growing solid component" },
        {
          value: "new_solid",
          label: "New or enlarging solid component in previously pure GGN",
        },
      ],
    },

    // GROUND-GLASS SIZE
    {
      id: "ggn_size",
      label: "Pure Ground-Glass Nodule Size (mm)",
      type: "number",
      showIf: (vals) => vals.nodule_type === "ground_glass",
    },

    // GGN CHANGE
    {
      id: "ggn_change",
      label: "GGN Change from Prior",
      type: "radio",
      showIf: (vals) =>
        vals.nodule_type === "ground_glass" && vals.prior_ct === "yes",
      opts: [
        { value: "new", label: "New GGN" },
        { value: "stable", label: "Stable" },
        { value: "growing", label: "Growing" },
      ],
    },

    // ATYPICAL CYST FEATURES
    {
      id: "cyst_features",
      label: "Atypical Cyst Features",
      type: "radio",
      showIf: (vals) => vals.nodule_type === "atypical_cyst",
      opts: [
        { value: "thick_wall", label: "Thick wall (>4mm)" },
        { value: "mural_nodule", label: "Mural nodule present" },
        { value: "growing", label: "Growing" },
      ],
    },

    // SUSPICIOUS FEATURES (for Category 4X modifier)
    {
      id: "suspicious_features",
      label: "Additional Suspicious Features",
      type: "radio",
      showIf: (vals) =>
        vals.nodule_type === "solid" || vals.nodule_type === "part_solid",
      opts: [
        { value: "none", label: "None" },
        { value: "spiculation", label: "Spiculation" },
        { value: "lymphadenopathy", label: "Suspicious lymphadenopathy" },
        { value: "other", label: "Other highly suspicious features" },
      ],
    },
  ],

  compute: (vals) => {
    const {
      prior_ct = "",
      nodule_type = "",
      solid_size = "",
      solid_change = "",
      part_solid_total = "",
      part_solid_solid = "",
      part_solid_change = "",
      ggn_size = "",
      ggn_change = "",
      cyst_features = "",
      suspicious_features = "",
    } = vals;

    // Category 0: Incomplete
    if (prior_ct === "no_expected") {
      return {
        "Lung-RADS Category": "0 - Incomplete",
        "Malignancy Probability": "N/A",
        Management:
          "Comparison with prior CT required. Retrieve prior images and reclassify.",
        Note: "Prior lung cancer screening CT expected but not available for comparison.",
        _severity: "info",
      };
    }

    // Validate required fields
    if (!nodule_type) {
      return { Error: "Please select the dominant finding type." };
    }

    let category = "";
    let categoryModifier = "";
    let malignancyRisk = "";
    let management = "";
    let finding = "";

    const isBaseline = prior_ct === "no_not_expected";

    // Category 1: Negative
    if (nodule_type === "none") {
      category = "1";
      malignancyRisk = "<1%";
      management = "Continue annual screening with LDCT in 12 months";
      finding = "No lung nodules";
    }

    // Category 2: Benign
    else if (nodule_type === "benign") {
      category = "2";
      malignancyRisk = "<1%";
      management = "Continue annual screening with LDCT in 12 months";
      finding =
        "Nodule with definitely benign features (e.g., calcified granuloma, hamartoma)";
    }

    // SOLID NODULE
    else if (nodule_type === "solid") {
      const size = parseFloat(solid_size) || 0;

      if (size <= 0) {
        return { Error: "Please enter the solid nodule size." };
      }

      finding = `Solid nodule ${size}mm`;

      if (size < 6) {
        category = "2";
        malignancyRisk = "<1%";
        management = "Continue annual screening with LDCT in 12 months";
      } else if (size >= 6 && size < 8) {
        if (isBaseline || solid_change === "new") {
          category = "3";
          malignancyRisk = "1-2%";
          management = "6-month LDCT";
        } else if (solid_change === "stable") {
          category = "2";
          malignancyRisk = "<1%";
          management = "Continue annual screening";
        } else if (solid_change === "growing") {
          category = "4A";
          malignancyRisk = "5-15%";
          management = "3-month LDCT; PET/CT may be used for nodules ≥8mm";
        }
      } else if (size >= 8 && size < 15) {
        if (isBaseline || solid_change === "new") {
          category = "4A";
          malignancyRisk = "5-15%";
          management = "3-month LDCT; PET/CT may be used";
        } else if (solid_change === "stable") {
          category = "2";
          malignancyRisk = "<1%";
          management = "Continue annual screening";
        } else if (solid_change === "growing") {
          category = "4B";
          malignancyRisk = ">15%";
          management =
            "Chest CT with or without contrast, PET/CT, and/or tissue sampling";
        }
      } else {
        // ≥15mm
        if (solid_change === "stable") {
          category = "2";
          malignancyRisk = "<1%";
          management = "Continue annual screening";
        } else {
          category = "4B";
          malignancyRisk = ">15%";
          management =
            "Chest CT with or without contrast, PET/CT, and/or tissue sampling";
        }
      }

      // Check for suspicious features (4X modifier)
      if (
        suspicious_features &&
        suspicious_features !== "none" &&
        (category === "4A" || category === "4B")
      ) {
        categoryModifier = "X";
        management =
          "Tissue sampling and/or PET/CT recommended based on suspicious features";
      }
    }

    // PERIFISSURAL NODULE
    else if (nodule_type === "perifissural") {
      const size = parseFloat(solid_size) || 0;

      if (size <= 0) {
        return { Error: "Please enter the perifissural nodule size." };
      }

      finding = `Perifissural nodule ${size}mm`;

      if (size < 10) {
        category = "2";
        malignancyRisk = "<1%";
        management = "Continue annual screening with LDCT in 12 months";
        finding += " (typical intrapulmonary lymph node)";
      } else {
        // Large PFN should be classified as solid nodule
        category = "3";
        malignancyRisk = "1-2%";
        management = "6-month LDCT for large perifissural nodule";
      }
    }

    // PART-SOLID NODULE
    else if (nodule_type === "part_solid") {
      const totalSize = parseFloat(part_solid_total) || 0;
      const solidSize = parseFloat(part_solid_solid) || 0;

      if (totalSize <= 0) {
        return { Error: "Please enter the total part-solid nodule size." };
      }

      finding = `Part-solid nodule: ${totalSize}mm total, ${solidSize}mm solid`;

      if (totalSize < 6) {
        category = "2";
        malignancyRisk = "<1%";
        management = "Continue annual screening with LDCT in 12 months";
      } else if (solidSize < 6) {
        if (isBaseline || part_solid_change === "new") {
          category = "3";
          malignancyRisk = "1-2%";
          management = "6-month LDCT";
        } else if (part_solid_change === "stable") {
          category = "2";
          malignancyRisk = "<1%";
          management = "Continue annual screening";
        } else if (
          part_solid_change === "growing_solid" ||
          part_solid_change === "new_solid"
        ) {
          category = "4A";
          malignancyRisk = "5-15%";
          management = "3-month LDCT; consider PET/CT or tissue sampling";
        }
      } else if (solidSize >= 6 && solidSize < 8) {
        if (isBaseline || part_solid_change === "new") {
          category = "4A";
          malignancyRisk = "5-15%";
          management = "3-month LDCT";
        } else if (part_solid_change === "growing_solid") {
          category = "4B";
          malignancyRisk = ">15%";
          management = "Tissue sampling and/or PET/CT";
        }
      } else {
        // solid ≥8mm
        category = "4B";
        malignancyRisk = ">15%";
        management = "Tissue sampling and/or PET/CT";
      }

      // 4X modifier for suspicious features
      if (
        suspicious_features &&
        suspicious_features !== "none" &&
        (category === "4A" || category === "4B")
      ) {
        categoryModifier = "X";
      }
    }

    // PURE GROUND-GLASS NODULE
    else if (nodule_type === "ground_glass") {
      const size = parseFloat(ggn_size) || 0;

      if (size <= 0) {
        return { Error: "Please enter the ground-glass nodule size." };
      }

      finding = `Pure ground-glass nodule ${size}mm`;

      if (size < 30) {
        if (isBaseline || ggn_change === "new") {
          category = "2";
          malignancyRisk = "<1%";
          management = "Continue annual screening with LDCT in 12 months";
        } else if (ggn_change === "stable") {
          category = "2";
          malignancyRisk = "<1%";
          management = "Continue annual screening";
        } else if (ggn_change === "growing") {
          category = "3";
          malignancyRisk = "1-2%";
          management = "6-month LDCT";
        }
      } else {
        // ≥30mm
        category = "3";
        malignancyRisk = "1-2%";
        management = "6-month LDCT";
      }
    }

    // ATYPICAL CYST
    else if (nodule_type === "atypical_cyst") {
      finding = "Atypical pulmonary cyst";

      if (cyst_features === "thick_wall" || cyst_features === "mural_nodule") {
        category = "4A";
        malignancyRisk = "5-15%";
        management = "3-month LDCT; consider PET/CT or further workup";
      } else if (cyst_features === "growing") {
        category = "3";
        malignancyRisk = "1-2%";
        management = "6-month LDCT";
      } else {
        category = "3";
        malignancyRisk = "1-2%";
        management = "6-month LDCT";
      }
    }

    // Build final category string
    const fullCategory = categoryModifier
      ? `${category}${categoryModifier}`
      : category;

    // Build result
    const result = {
      "Lung-RADS Category": `${fullCategory} - ${getCategoryDescription(category, categoryModifier)}`,
      "Malignancy Probability": malignancyRisk,
      Management: management,
      Finding: finding,
    };

    if (categoryModifier === "X") {
      result["4X Modifier"] =
        "Additional features suspicious for malignancy warrant more aggressive management";
    }

    // Add notes
    const notes = [];

    if (category === "3" || category === "4A" || category === "4B") {
      notes.push(
        "Short-term follow-up recommended to assess for interval change",
      );
    }

    if (nodule_type === "part_solid") {
      notes.push(
        "Part-solid nodules have higher malignancy risk than pure solid or ground-glass nodules at the same size",
      );
    }

    if (isBaseline) {
      notes.push("Baseline scan - prior comparison not available");
    }

    if (notes.length > 0) {
      result["Clinical Notes"] = notes.join("; ");
    }

    if (category === "0") result._severity = "info";
    else if (category === "1" || category === "2") result._severity = "success";
    else if (category === "3") result._severity = "warning";
    else result._severity = "danger";

    return result;
  },

  refs: [
    {
      t: "ACR Lung-RADS v2022. American College of Radiology Lung Imaging Reporting and Data System.",
      u: "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/Lung-RADS",
    },
    {
      t: "Defined guidelines: Pinsky PF, et al. Performance of Lung-RADS in the National Lung Screening Trial. Ann Intern Med. 2015;162(7):485-491.",
      u: "https://doi.org/10.7326/M14-2086",
    },
    {
      t: "National Lung Screening Trial Research Team. Reduced Lung-Cancer Mortality with Low-Dose Computed Tomographic Screening. N Engl J Med. 2011;365(5):395-409.",
      u: "https://doi.org/10.1056/NEJMoa1102873",
    },
    {
      t: "de Koning HJ, van der Aalst CM, de Jong PA, et al. Reduced Lung-Cancer Mortality with Volume CT Screening in a Randomized Trial (NELSON). N Engl J Med. 2020;382(6):503-513.",
      u: "https://doi.org/10.1056/NEJMoa1911793",
    },
    {
      t: "Defined guidelines Management Guidelines for Lung-RADS Categories. ACR Lung-RADS v2022.",
      u: "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/Lung-RADS",
    },
  ],
};

function getCategoryDescription(category, modifier) {
  const descriptions = {
    0: "Incomplete",
    1: "Negative",
    2: "Benign Appearance",
    3: "Probably Benign",
    "4A": "Suspicious",
    "4B": "Suspicious",
  };

  let desc = descriptions[category] || "Unknown";
  if (modifier === "X") {
    desc += " with Additional Suspicious Features";
  }
  return desc;
}
