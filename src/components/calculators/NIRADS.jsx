/**
 * NI-RADS Calculator
 *
 * Neck Imaging Reporting and Data System for post-treatment head and neck cancer surveillance.
 * Provides separate categories for primary site and neck nodes with management recommendations.
 *
 * Primary Sources:
 * - Aiken AH, et al. J Am Coll Radiol. 2018 (NI-RADS White Paper)
 * - Krieger DA, et al. AJNR Am J Neuroradiol. 2017 (Validation Study)
 */

export const NIRADS = {
  id: "nirads",
  category: "Neuroradiology",
  name: "ACR NI-RADS",
  desc: "Neck Imaging Reporting and Data System for post-treatment head and neck cancer surveillance",
  keywords: [
    "neck imaging",
    "head and neck",
    "squamous cell",
    "SCC",
    "recurrence",
  ],
  tags: ["Neuroradiology", "Oncology", "Head & Neck"],
  metaDesc:
    "Free NI-RADS Calculator. ACR standardized reporting for head and neck cancer surveillance imaging with CT, MRI, and PET/CT with recurrence risk and management.",

  info: {
    text: `NI-RADS (Neck Imaging Reporting and Data System) is the ACR standardized system for reporting surveillance imaging in treated head and neck cancer patients.

The system assigns separate categories for:
• PRIMARY TUMOR SITE (with 2a/2b subcategories)
• CERVICAL LYMPH NODES

Categories:
• NI-RADS 0: Incomplete (prior imaging unavailable)
• NI-RADS 1: No evidence of recurrence
• NI-RADS 2a: Low suspicion - superficial/mucosal (direct visualization)
• NI-RADS 2b: Low suspicion - deep (short-term follow-up)
• NI-RADS 3: High suspicion (biopsy recommended)
• NI-RADS 4: Known/definite recurrence

Recurrence rates by category:
• NI-RADS 1: ~4%
• NI-RADS 2: ~17%
• NI-RADS 3: ~59%

Note: Separate categories for primary site and neck should be reported.`,
    link: {
      label: "View ACR NI-RADS Resources",
      url: "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/NI-RADS",
    },
  },

  fields: [
    // IMAGING MODALITY
    {
      id: "modality",
      label: "Imaging Modality",
      type: "radio",
      opts: [
        { value: "cect", label: "Contrast-Enhanced CT" },
        { value: "mri", label: "MRI" },
        { value: "pet_ct", label: "PET/CT" },
      ],
    },

    // PRIOR IMAGING
    {
      id: "prior_available",
      label: "Prior Imaging Available for Comparison",
      type: "radio",
      opts: [
        { value: "yes", label: "Yes - prior available" },
        { value: "no_pending", label: "No - will be obtained" },
        { value: "no_unavailable", label: "No - cannot be obtained" },
      ],
    },

    // ========== PRIMARY SITE SECTION ==========
    {
      id: "primary_heading",
      label: "PRIMARY SITE ASSESSMENT",
      type: "radio",
      opts: [{ value: "header", label: "--- Primary Tumor Site Findings ---" }],
    },

    // PRIMARY CT/MRI FINDINGS
    {
      id: "primary_ct_finding",
      label: "Primary Site CT/MRI Finding",
      type: "radio",
      showIf: (vals) => vals.prior_available !== "no_pending",
      opts: [
        {
          value: "expected",
          label:
            "Expected post-treatment changes only (distortion, scar, diffuse linear enhancement)",
        },
        {
          value: "focal_mucosal",
          label: "Focal mucosal abnormality (non-masslike enhancement)",
        },
        {
          value: "deep_soft_tissue",
          label:
            "Ill-defined deep soft tissue with mild differential enhancement",
        },
        {
          value: "discrete_mass",
          label:
            "New or enlarging discrete nodule/mass with intense enhancement",
        },
        {
          value: "definite_recurrence",
          label: "Definite recurrence (pathologically proven)",
        },
      ],
    },

    // PRIMARY PET FINDINGS (conditional)
    {
      id: "primary_pet_finding",
      label: "Primary Site FDG Uptake (PET)",
      type: "radio",
      showIf: (vals) =>
        vals.modality === "pet_ct" && vals.prior_available !== "no_pending",
      opts: [
        { value: "none", label: "No abnormal uptake" },
        {
          value: "physiologic",
          label: "Physiologic or radiation mucositis pattern",
        },
        { value: "mild_focal", label: "Mild focal mucosal uptake" },
        { value: "mild_deep", label: "Mild uptake to ill-defined deep tissue" },
        {
          value: "intense_focal",
          label: "Intense focal uptake to discrete nodule/mass",
        },
      ],
    },

    // PRIMARY BONE EROSION
    {
      id: "primary_bone",
      label: "New Bone Erosion at Primary Site",
      type: "radio",
      showIf: (vals) => vals.primary_ct_finding === "discrete_mass",
      opts: [
        { value: "no", label: "No new bone erosion" },
        { value: "yes", label: "Yes - new bone erosion" },
      ],
    },

    // ========== NECK NODE SECTION ==========
    {
      id: "neck_heading",
      label: "NECK LYMPH NODE ASSESSMENT",
      type: "radio",
      opts: [
        { value: "header", label: "--- Cervical Lymph Node Findings ---" },
      ],
    },

    // NECK CT/MRI FINDINGS
    {
      id: "neck_ct_finding",
      label: "Neck Node CT/MRI Finding",
      type: "radio",
      showIf: (vals) => vals.prior_available !== "no_pending",
      opts: [
        { value: "no_abnormal", label: "No abnormal lymph nodes" },
        {
          value: "residual_stable",
          label: "Residual nodal tissue - hypoenhancing, stable",
        },
        {
          value: "residual_new_enlarging",
          label:
            "New, enlarging, or residual abnormal node WITHOUT necrosis/ENE",
        },
        {
          value: "new_necrosis",
          label: "New/enlarging node WITH necrosis or extranodal extension",
        },
        {
          value: "definite_recurrence",
          label: "Definite nodal recurrence (pathologically proven)",
        },
      ],
    },

    // NECK PET FINDINGS (conditional)
    {
      id: "neck_pet_finding",
      label: "Neck Node FDG Uptake (PET)",
      type: "radio",
      showIf: (vals) =>
        vals.modality === "pet_ct" && vals.prior_available !== "no_pending",
      opts: [
        { value: "none", label: "No abnormal nodal uptake" },
        {
          value: "mild_moderate",
          label: "Mild to moderate uptake without discrete mass",
        },
        {
          value: "intense_focal",
          label: "Intense focal uptake to new/enlarging node",
        },
      ],
    },
  ],

  compute: (vals) => {
    const {
      modality = "",
      prior_available = "",
      primary_ct_finding = "",
      primary_pet_finding = "",
      primary_bone = "",
      neck_ct_finding = "",
      neck_pet_finding = "",
    } = vals;

    // NI-RADS 0: Incomplete
    if (prior_available === "no_pending") {
      return {
        "Primary Site NI-RADS": "0 - Incomplete",
        "Neck NI-RADS": "0 - Incomplete",
        Management:
          "Obtain prior imaging for comparison, then reassign category",
        Note: "Prior imaging unavailable but will be procured. Reassign after review.",
        _severity: "info",
      };
    }

    // Validate required fields
    if (!primary_ct_finding) {
      return { Error: "Please select primary site findings." };
    }
    if (!neck_ct_finding) {
      return { Error: "Please select neck lymph node findings." };
    }

    const isPET = modality === "pet_ct";

    // ========== PRIMARY SITE CATEGORY ==========
    let primaryCategory = "";
    let primarySubcat = "";
    let primaryManagement = "";

    // Determine primary category based on CT/MRI
    switch (primary_ct_finding) {
      case "expected":
        primaryCategory = "1";
        break;
      case "focal_mucosal":
        primaryCategory = "2";
        primarySubcat = "a";
        break;
      case "deep_soft_tissue":
        primaryCategory = "2";
        primarySubcat = "b";
        break;
      case "discrete_mass":
        primaryCategory = "3";
        break;
      case "definite_recurrence":
        primaryCategory = "4";
        break;
    }

    // PET concordance rules
    if (isPET && primary_pet_finding) {
      // Discordance rules - assign lower adjacent score when discordant
      if (
        primary_ct_finding === "deep_soft_tissue" &&
        primary_pet_finding === "none"
      ) {
        // Deep tissue WITHOUT FDG uptake -> downgrade to 1
        primaryCategory = "1";
        primarySubcat = "";
      } else if (
        primary_ct_finding === "discrete_mass" &&
        (primary_pet_finding === "mild_focal" ||
          primary_pet_finding === "mild_deep")
      ) {
        // Mass with only mild uptake -> downgrade to 2b
        primaryCategory = "2";
        primarySubcat = "b";
      } else if (
        primary_ct_finding !== "discrete_mass" &&
        primary_pet_finding === "intense_focal"
      ) {
        // Intense uptake WITHOUT mass -> upgrade to 2b (not 3)
        if (primaryCategory === "1") {
          primaryCategory = "2";
          primarySubcat = "b";
        }
      }
    }

    // Bone erosion upgrades to 3
    if (primary_bone === "yes" && primaryCategory !== "4") {
      primaryCategory = "3";
      primarySubcat = "";
    }

    // Primary management
    switch (primaryCategory) {
      case "1":
        primaryManagement = "Routine surveillance (typically 6 months)";
        break;
      case "2":
        if (primarySubcat === "a") {
          primaryManagement =
            "Direct visual inspection (laryngoscopy/endoscopy)";
        } else {
          primaryManagement =
            "Short-term follow-up imaging (3 months) with CECT or PET/CT";
        }
        break;
      case "3":
        primaryManagement = "Biopsy recommended";
        break;
      case "4":
        primaryManagement = "Treatment planning";
        break;
    }

    // ========== NECK NODE CATEGORY ==========
    let neckCategory = "";
    let neckManagement = "";

    switch (neck_ct_finding) {
      case "no_abnormal":
      case "residual_stable":
        neckCategory = "1";
        break;
      case "residual_new_enlarging":
        neckCategory = "2";
        break;
      case "new_necrosis":
        neckCategory = "3";
        break;
      case "definite_recurrence":
        neckCategory = "4";
        break;
    }

    // PET concordance for neck
    if (isPET && neck_pet_finding) {
      if (
        neck_ct_finding === "residual_new_enlarging" &&
        neck_pet_finding === "none"
      ) {
        // New/enlarging node WITHOUT uptake -> downgrade to 1
        neckCategory = "1";
      } else if (
        neck_ct_finding === "residual_new_enlarging" &&
        neck_pet_finding === "intense_focal"
      ) {
        // New/enlarging with intense uptake -> upgrade to 3
        neckCategory = "3";
      }
    }

    // Neck management
    switch (neckCategory) {
      case "1":
        neckManagement = "Routine surveillance (typically 6 months)";
        break;
      case "2":
        neckManagement =
          "Short-term follow-up imaging (3 months) or PET/CT if not performed";
        break;
      case "3":
        neckManagement = "Biopsy or FNA of suspicious node";
        break;
      case "4":
        neckManagement = "Treatment planning";
        break;
    }

    // Build primary category string
    const primaryCatStr = primarySubcat
      ? `${primaryCategory}${primarySubcat}`
      : primaryCategory;

    // Get overall category (higher of the two)
    const overallCat = Math.max(
      parseInt(primaryCategory),
      parseInt(neckCategory),
    );

    // Risk estimates
    const riskByCategory = {
      1: "~4%",
      2: "~17%",
      3: "~59%",
      4: "100%",
    };

    // Build result
    const result = {
      "Primary Site NI-RADS": `${primaryCatStr} - ${getCategoryDescription(primaryCategory, primarySubcat)}`,
      "Primary Site Management": primaryManagement,
      "Neck NI-RADS": `${neckCategory} - ${getCategoryDescription(neckCategory, "")}`,
      "Neck Management": neckManagement,
      "Overall Assessment": `NI-RADS ${overallCat} - ${getCategoryDescription(overallCat.toString(), "")}`,
      "Estimated Recurrence Risk":
        riskByCategory[overallCat.toString()] || "N/A",
    };

    // Add notes
    const notes = [];

    if (isPET) {
      notes.push("PET findings incorporated using concordance rules");
    }

    if (primaryCategory !== neckCategory) {
      notes.push(
        "Primary site and neck categories differ - both reported separately",
      );
    }

    if (prior_available === "no_unavailable") {
      notes.push(
        "Categories assigned without prior comparison (prior unavailable)",
      );
    }

    if (notes.length > 0) {
      result["Clinical Notes"] = notes.join("; ");
    }

    result._severity =
      overallCat <= 1 ? "success" : overallCat <= 2 ? "warning" : "danger";

    return result;
  },

  refs: [
    {
      t: "Aiken AH, Rath TJ, Anzai Y, et al. ACR Neck Imaging Reporting and Data Systems (NI-RADS): A White Paper of the ACR NI-RADS Committee. J Am Coll Radiol. 2018;15(8):1097-1108.",
      u: "https://pubmed.ncbi.nlm.nih.gov/29983244/",
    },
    {
      t: "Krieger DA, Hudgins PA, Nayak GK, et al. Initial Performance of NI-RADS to Predict Residual or Recurrent Head and Neck Squamous Cell Carcinoma. AJNR Am J Neuroradiol. 2017;38(6):1193-1199.",
      u: "https://pubmed.ncbi.nlm.nih.gov/28364010/",
    },
    {
      t: "Juliano AF, Spieler B, Engel JD, Glastonbury CM. NI-RADS for head and neck cancer surveillance imaging. Clin Radiol. 2020;75(4):247-257.",
      u: "https://doi.org/10.1016/j.crad.2019.08.014",
    },
    {
      t: "ACR Neck Imaging Reporting and Data System (NI-RADS) Resources.",
      u: "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/NI-RADS",
    },
    {
      t: "Wangaryattawanich P, Hirschmann A, Stable A. Best Practices: Application of NI-RADS for Posttreatment Surveillance Imaging. AJR Am J Roentgenol. 2020;215(5):1083-1092.",
      u: "https://doi.org/10.2214/AJR.19.22524",
    },
  ],
};

function getCategoryDescription(category, subcat) {
  const descriptions = {
    0: "Incomplete",
    1: "No Evidence of Recurrence",
    2: subcat === "a" ? "Low Suspicion (Superficial)" : "Low Suspicion (Deep)",
    3: "High Suspicion",
    4: "Known Recurrence",
  };
  return descriptions[category] || "Unknown";
}
