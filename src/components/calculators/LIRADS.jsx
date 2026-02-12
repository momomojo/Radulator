/**
 * LI-RADS v2018 Calculator
 * Liver Imaging Reporting and Data System
 *
 * LI-RADS is a comprehensive standardized system developed by the ACR for the
 * interpretation and reporting of liver imaging in patients at risk for HCC.
 * It assigns categories (LR-1 through LR-5, LR-M, LR-TIV) based on imaging features.
 *
 * Primary Sources:
 * - Chernyak V, et al. Radiology. 2018;289(3):816-830 (LI-RADS v2018)
 * - Cerny M, et al. RadioGraphics. 2018;38(7):1973-2001 (Ancillary Features)
 * - Marrero JA, et al. Hepatology. 2018;68(2):723-750 (AASLD Guidelines)
 */

export const LIRADS = {
  id: "lirads",
  category: "Hepatology/Liver",
  name: "LI-RADS v2018",
  desc: "Liver Imaging Reporting and Data System for hepatocellular carcinoma risk stratification",
  keywords: ["liver", "HCC", "hepatocellular carcinoma", "LR-5", "liver mass"],
  tags: ["Hepatology", "Radiology", "Oncology"],
  metaDesc:
    "Free LI-RADS v2018 Calculator. Standardized liver imaging classification for HCC risk in at-risk patients. CT/MRI features, categories LR-1 to LR-5, LR-M, LR-TIV with management recommendations.",

  info: {
    text: `LI-RADS (Liver Imaging Reporting and Data System) v2018 is the ACR standardized system for interpreting liver imaging in patients at risk for hepatocellular carcinoma (HCC).

Applicable to adults (≥18 years) with:
• Cirrhosis (except vascular or congenital causes)
• Chronic hepatitis B viral infection
• Current or prior HCC

Categories:
• LR-1: Definitely benign (0% HCC)
• LR-2: Probably benign (~14% HCC)
• LR-3: Intermediate probability (38-40% HCC)
• LR-4: Probably HCC (67-74% HCC)
• LR-5: Definitely HCC (92-95% HCC)
• LR-M: Probably/definitely malignant, not HCC-specific
• LR-TIV: Tumor in vein

Major features used: Arterial phase hyperenhancement (APHE), size, washout, enhancing capsule, and threshold growth.`,
    link: {
      label: "View ACR LI-RADS v2018 Guidelines",
      url: "https://doi.org/10.1148/radiol.2018181494",
    },
  },

  fields: [
    // SECTION 1: PATIENT ELIGIBILITY
    {
      id: "high_risk_population",
      label: "Patient in LI-RADS At-Risk Population",
      subLabel:
        "Cirrhosis, chronic hepatitis B, or current/prior HCC (required)",
      type: "checkbox",
    },

    // SECTION 2: STUDY QUALITY
    {
      id: "study_adequate",
      label: "Study Technically Adequate",
      subLabel: "Image quality sufficient for evaluation",
      type: "checkbox",
      showIf: (vals) => vals.high_risk_population,
    },

    // SECTION 3: TUMOR IN VEIN (LR-TIV)
    {
      id: "tumor_in_vein",
      label: "Definite Tumor in Vein (LR-TIV)",
      subLabel:
        "Unequivocal enhancing soft tissue within portal or hepatic vein",
      type: "checkbox",
      showIf: (vals) => vals.high_risk_population && vals.study_adequate,
    },

    // SECTION 4: BENIGN DETERMINATION
    {
      id: "benign_status",
      label: "Observation Benignity",
      type: "radio",
      opts: [
        {
          value: "indeterminate",
          label: "Indeterminate - Continue evaluation",
        },
        {
          value: "definitely_benign",
          label: "Definitely benign (cyst, hemangioma, focal fat) → LR-1",
        },
        {
          value: "probably_benign",
          label:
            "Probably benign (distinctive nodule <20mm, no major HCC features) → LR-2",
        },
      ],
      showIf: (vals) =>
        vals.high_risk_population && vals.study_adequate && !vals.tumor_in_vein,
    },

    // SECTION 5: LR-M FEATURES
    {
      id: "has_lrm_features",
      label: "LR-M Features Present",
      subLabel: "Features suggesting malignancy but not specific for HCC",
      type: "checkbox",
      showIf: (vals) =>
        vals.high_risk_population &&
        vals.study_adequate &&
        !vals.tumor_in_vein &&
        vals.benign_status === "indeterminate",
    },

    // LR-M Targetoid Features
    {
      id: "lrm_rim_aphe",
      label: "Rim arterial phase hyperenhancement",
      type: "checkbox",
      showIf: (vals) => vals.has_lrm_features,
    },
    {
      id: "lrm_peripheral_washout",
      label: "Peripheral washout",
      type: "checkbox",
      showIf: (vals) => vals.has_lrm_features,
    },
    {
      id: "lrm_delayed_central_enhancement",
      label: "Delayed central enhancement",
      type: "checkbox",
      showIf: (vals) => vals.has_lrm_features,
    },
    {
      id: "lrm_targetoid_restriction",
      label: "Targetoid restriction on DWI",
      type: "checkbox",
      showIf: (vals) => vals.has_lrm_features,
    },
    {
      id: "lrm_targetoid_hbp",
      label: "Targetoid transitional/hepatobiliary phase appearance",
      type: "checkbox",
      showIf: (vals) => vals.has_lrm_features,
    },

    // LR-M Non-targetoid Features
    {
      id: "lrm_infiltrative",
      label: "Infiltrative appearance",
      type: "checkbox",
      showIf: (vals) => vals.has_lrm_features,
    },
    {
      id: "lrm_marked_restriction",
      label: "Marked diffusion restriction",
      type: "checkbox",
      showIf: (vals) => vals.has_lrm_features,
    },
    {
      id: "lrm_necrosis",
      label: "Necrosis or severe ischemia",
      type: "checkbox",
      showIf: (vals) => vals.has_lrm_features,
    },
    {
      id: "lrm_other",
      label: "Other features suggesting non-HCC malignancy",
      type: "checkbox",
      showIf: (vals) => vals.has_lrm_features,
    },

    // SECTION 6: MAJOR FEATURES (for diagnostic table)
    {
      id: "observation_size",
      label: "Observation Size (mm)",
      subLabel: "Largest outer-to-outer dimension; include capsule if present",
      type: "number",
      showIf: (vals) =>
        vals.high_risk_population &&
        vals.study_adequate &&
        !vals.tumor_in_vein &&
        vals.benign_status === "indeterminate" &&
        !vals.has_lrm_features,
    },

    {
      id: "aphe",
      label: "Arterial Phase Hyperenhancement (APHE)",
      type: "radio",
      opts: [
        { value: "none", label: "No APHE" },
        {
          value: "nonrim",
          label: "Nonrim APHE (hyperenhancement greater than liver)",
        },
        { value: "rim", label: "Rim APHE → suggests LR-M" },
      ],
      showIf: (vals) =>
        vals.high_risk_population &&
        vals.study_adequate &&
        !vals.tumor_in_vein &&
        vals.benign_status === "indeterminate" &&
        !vals.has_lrm_features,
    },

    {
      id: "washout",
      label: 'Nonperipheral "Washout"',
      subLabel:
        "Temporal reduction in enhancement relative to liver (PVP/delayed for ECA; PVP only for gadoxetate)",
      type: "radio",
      opts: [
        { value: "absent", label: "Absent" },
        { value: "present", label: "Present" },
      ],
      showIf: (vals) =>
        vals.high_risk_population &&
        vals.study_adequate &&
        !vals.tumor_in_vein &&
        vals.benign_status === "indeterminate" &&
        !vals.has_lrm_features &&
        vals.aphe !== "rim",
    },

    {
      id: "capsule",
      label: 'Enhancing "Capsule"',
      subLabel:
        "Smooth, uniform rim of hyperenhancement on PVP, delayed, or transitional phase",
      type: "radio",
      opts: [
        { value: "absent", label: "Absent" },
        { value: "present", label: "Present" },
      ],
      showIf: (vals) =>
        vals.high_risk_population &&
        vals.study_adequate &&
        !vals.tumor_in_vein &&
        vals.benign_status === "indeterminate" &&
        !vals.has_lrm_features &&
        vals.aphe !== "rim",
    },

    {
      id: "threshold_growth",
      label: "Threshold Growth",
      subLabel: "Size increase ≥50% in ≤6 months, or new observation ≥10mm",
      type: "radio",
      opts: [
        { value: "absent", label: "Absent" },
        { value: "present", label: "Present" },
      ],
      showIf: (vals) =>
        vals.high_risk_population &&
        vals.study_adequate &&
        !vals.tumor_in_vein &&
        vals.benign_status === "indeterminate" &&
        !vals.has_lrm_features &&
        vals.aphe !== "rim",
    },

    // SECTION 7: ANCILLARY FEATURES
    {
      id: "ancillary_malignancy",
      label: "Ancillary Features Favoring Malignancy",
      subLabel:
        "Select all that apply (optional - can upgrade category by 1, max LR-4)",
      type: "select",
      opts: [
        { value: "none", label: "None" },
        { value: "us_visible", label: "US visibility as discrete nodule" },
        { value: "subthreshold_growth", label: "Subthreshold growth" },
        { value: "corona", label: "Corona enhancement" },
        { value: "fat_sparing", label: "Fat sparing in focal fat" },
        { value: "restricted_diffusion", label: "Restricted diffusion" },
        {
          value: "t2_hyperintensity",
          label: "Mild-moderate T2 hyperintensity",
        },
        { value: "iron_sparing", label: "Iron sparing in siderotic liver" },
        {
          value: "transitional_hypo",
          label: "Transitional phase hypointensity",
        },
        { value: "hbp_hypo", label: "Hepatobiliary phase hypointensity" },
      ],
      showIf: (vals) =>
        vals.high_risk_population &&
        vals.study_adequate &&
        !vals.tumor_in_vein &&
        vals.benign_status === "indeterminate" &&
        !vals.has_lrm_features &&
        vals.aphe !== "rim",
    },

    {
      id: "ancillary_hcc",
      label: "Ancillary Features Favoring HCC",
      subLabel:
        "Select all that apply (optional - can upgrade category by 1, max LR-4)",
      type: "select",
      opts: [
        { value: "none", label: "None" },
        { value: "nonenhancing_capsule", label: "Nonenhancing capsule" },
        { value: "nodule_in_nodule", label: "Nodule-in-nodule architecture" },
        { value: "mosaic", label: "Mosaic architecture" },
        { value: "blood_products", label: "Blood products in mass" },
        {
          value: "fat_in_mass",
          label: "Fat in mass (more than adjacent liver)",
        },
      ],
      showIf: (vals) =>
        vals.high_risk_population &&
        vals.study_adequate &&
        !vals.tumor_in_vein &&
        vals.benign_status === "indeterminate" &&
        !vals.has_lrm_features &&
        vals.aphe !== "rim",
    },

    {
      id: "ancillary_benign",
      label: "Ancillary Features Favoring Benignity",
      subLabel:
        "Select all that apply (optional - can downgrade category by 1)",
      type: "select",
      opts: [
        { value: "none", label: "None" },
        { value: "size_stability", label: "Size stability ≥2 years" },
        { value: "size_reduction", label: "Size reduction" },
        { value: "parallels_blood_pool", label: "Parallels blood pool" },
        { value: "undistorted_vessels", label: "Undistorted vessels" },
        { value: "iron_in_mass", label: "Iron in mass (more than liver)" },
        { value: "marked_t2", label: "Marked T2 hyperintensity" },
        { value: "hbp_iso", label: "Hepatobiliary phase isointensity" },
      ],
      showIf: (vals) =>
        vals.high_risk_population &&
        vals.study_adequate &&
        !vals.tumor_in_vein &&
        vals.benign_status === "indeterminate" &&
        !vals.has_lrm_features &&
        vals.aphe !== "rim",
    },
  ],

  compute: (vals) => {
    const {
      high_risk_population = false,
      study_adequate = false,
      tumor_in_vein = false,
      benign_status = "",
      has_lrm_features = false,
      lrm_rim_aphe = false,
      lrm_peripheral_washout = false,
      lrm_delayed_central_enhancement = false,
      lrm_targetoid_restriction = false,
      lrm_targetoid_hbp = false,
      lrm_infiltrative = false,
      lrm_marked_restriction = false,
      lrm_necrosis = false,
      lrm_other = false,
      observation_size = "",
      aphe = "",
      washout = "",
      capsule = "",
      threshold_growth = "",
      ancillary_malignancy = "none",
      ancillary_hcc = "none",
      ancillary_benign = "none",
    } = vals;

    // Step 1: Check if patient is in LI-RADS population
    if (!high_risk_population) {
      return {
        "LI-RADS Status":
          "LI-RADS not applicable - Patient must be in at-risk population",
        "At-Risk Criteria":
          "Cirrhosis (non-vascular), chronic hepatitis B, or current/prior HCC",
        Note: "LI-RADS should not be used for patients outside the at-risk population",
      };
    }

    // Step 2: Check study adequacy
    if (!study_adequate) {
      return {
        "LI-RADS Category": "LR-NC (Not Categorizable)",
        Definition:
          "Image omission or degradation precludes adequate evaluation",
        Recommendation: "Repeat imaging with adequate technique",
        _severity: "info",
      };
    }

    // Step 3: Check for tumor in vein
    if (tumor_in_vein) {
      return {
        "LI-RADS Category": "LR-TIV (Tumor in Vein)",
        Definition: "Definite tumor invasion of portal or hepatic veins",
        "Clinical Significance": "Indicates advanced disease stage",
        "Transplant Eligibility": "Contraindication to liver transplantation",
        Recommendation: "Multidisciplinary discussion required",
        "Diagnostic Criteria":
          "Unequivocal enhancing soft tissue within a vein",
        _severity: "danger",
      };
    }

    // Step 4: Check benign status
    if (benign_status === "definitely_benign") {
      return {
        "LI-RADS Category": "LR-1 (Definitely Benign)",
        "HCC Probability": "0%",
        Definition:
          "100% certainty benign (e.g., simple cyst, hemangioma, focal fat)",
        Recommendation: "Return to routine surveillance",
        _severity: "success",
      };
    }

    if (benign_status === "probably_benign") {
      return {
        "LI-RADS Category": "LR-2 (Probably Benign)",
        "HCC Probability": "~14%",
        Definition:
          "High probability benign; distinctive nodule <20mm without major HCC features",
        Recommendation:
          "Return to routine surveillance; option for alternate imaging modality",
        _severity: "success",
      };
    }

    // Step 5: Check for LR-M features
    if (has_lrm_features) {
      const lrmFeatures = [];
      if (lrm_rim_aphe) lrmFeatures.push("Rim APHE");
      if (lrm_peripheral_washout) lrmFeatures.push("Peripheral washout");
      if (lrm_delayed_central_enhancement)
        lrmFeatures.push("Delayed central enhancement");
      if (lrm_targetoid_restriction)
        lrmFeatures.push("Targetoid restriction on DWI");
      if (lrm_targetoid_hbp)
        lrmFeatures.push("Targetoid transitional/HBP appearance");
      if (lrm_infiltrative) lrmFeatures.push("Infiltrative appearance");
      if (lrm_marked_restriction)
        lrmFeatures.push("Marked diffusion restriction");
      if (lrm_necrosis) lrmFeatures.push("Necrosis/severe ischemia");
      if (lrm_other) lrmFeatures.push("Other non-HCC malignancy features");

      if (lrmFeatures.length > 0) {
        return {
          "LI-RADS Category":
            "LR-M (Probably/Definitely Malignant, Not HCC-Specific)",
          "Malignancy Probability": "93-100%",
          "HCC Probability": "29-44%",
          Definition: "Malignant features present but not specific for HCC",
          "LR-M Features Identified": lrmFeatures.join("; "),
          "Differential Diagnosis":
            "Atypical HCC, intrahepatic cholangiocarcinoma (iCCA), combined HCC-CCA, metastases",
          Recommendation: "Biopsy recommended; multidisciplinary discussion",
          _severity: "danger",
        };
      }
    }

    // Check for rim APHE (redirects to LR-M)
    if (aphe === "rim") {
      return {
        "LI-RADS Category":
          "LR-M (Probably/Definitely Malignant, Not HCC-Specific)",
        "Malignancy Probability": "93-100%",
        "HCC Probability": "29-44%",
        Definition:
          "Rim arterial phase hyperenhancement suggests non-HCC malignancy",
        "Key Feature": "Rim APHE (peripheral > central enhancement)",
        "Differential Diagnosis":
          "Intrahepatic cholangiocarcinoma (iCCA), combined HCC-CCA, metastases",
        Recommendation: "Biopsy recommended; multidisciplinary discussion",
        _severity: "danger",
      };
    }

    // Step 6: Apply diagnostic table
    if (!observation_size || !aphe) {
      return {
        Error:
          "Please complete observation size and APHE assessment to determine LI-RADS category.",
      };
    }

    const size = parseFloat(observation_size) || 0;
    const hasAPHE = aphe === "nonrim";
    const hasWashout = washout === "present";
    const hasCapsule = capsule === "present";
    const hasThresholdGrowth = threshold_growth === "present";

    // Count additional major features (excluding APHE and size)
    const additionalFeatures = [
      hasWashout,
      hasCapsule,
      hasThresholdGrowth,
    ].filter(Boolean).length;

    let baseCategory = "";
    let categoryName = "";
    let hccProbability = "";

    // Apply LI-RADS diagnostic table algorithm
    if (!hasAPHE) {
      // WITHOUT nonrim APHE
      if (size < 20) {
        baseCategory = additionalFeatures >= 2 ? "LR-4" : "LR-3";
      } else {
        // >= 20mm
        baseCategory = additionalFeatures >= 1 ? "LR-4" : "LR-3";
      }
    } else {
      // WITH nonrim APHE
      if (size < 10) {
        baseCategory = additionalFeatures >= 1 ? "LR-4" : "LR-3";
      } else if (size >= 10 && size < 20) {
        if (additionalFeatures >= 2) {
          baseCategory = "LR-5";
        } else if (hasWashout || hasThresholdGrowth) {
          baseCategory = "LR-5";
        } else if (hasCapsule && additionalFeatures === 1) {
          baseCategory = "LR-4";
        } else {
          baseCategory = "LR-3";
        }
      } else {
        // >= 20mm
        baseCategory = additionalFeatures >= 1 ? "LR-5" : "LR-4";
      }
    }

    // Set category details
    const categoryDetails = {
      "LR-3": {
        name: "Intermediate Probability",
        hcc: "38-40%",
        recommendation:
          "Repeat imaging in 3-6 months (same or alternate modality)",
      },
      "LR-4": {
        name: "Probably HCC",
        hcc: "67-74%",
        recommendation:
          "Multidisciplinary discussion; consider biopsy or short-term follow-up",
      },
      "LR-5": {
        name: "Definitely HCC",
        hcc: "92-95%",
        recommendation:
          "Treat as HCC without biopsy; proceed to staging and treatment planning",
      },
    };

    categoryName = categoryDetails[baseCategory].name;
    hccProbability = categoryDetails[baseCategory].hcc;

    // Step 7: Apply ancillary feature adjustments
    const hasAncillaryMalignancy =
      ancillary_malignancy !== "none" && ancillary_malignancy !== "";
    const hasAncillaryHCC = ancillary_hcc !== "none" && ancillary_hcc !== "";
    const hasAncillaryBenign =
      ancillary_benign !== "none" && ancillary_benign !== "";

    let finalCategory = baseCategory;
    let ancillaryAdjustment = "";

    // Check for conflicting ancillary features
    const hasFavoringMalignancy = hasAncillaryMalignancy || hasAncillaryHCC;
    const hasFavoringBenignity = hasAncillaryBenign;

    if (hasFavoringMalignancy && hasFavoringBenignity) {
      ancillaryAdjustment =
        "Conflicting ancillary features present - no category adjustment applied";
    } else if (hasFavoringMalignancy && !hasFavoringBenignity) {
      // Upgrade by 1, max LR-4 (cannot upgrade to LR-5)
      if (baseCategory === "LR-3") {
        finalCategory = "LR-4";
        ancillaryAdjustment =
          "Upgraded from LR-3 to LR-4 based on ancillary features favoring malignancy";
      } else {
        ancillaryAdjustment =
          "Ancillary features favor malignancy but cannot upgrade beyond LR-4";
      }
    } else if (hasFavoringBenignity && !hasFavoringMalignancy) {
      // Downgrade by 1
      if (baseCategory === "LR-5") {
        finalCategory = "LR-4";
        ancillaryAdjustment =
          "Downgraded from LR-5 to LR-4 based on ancillary features favoring benignity";
      } else if (baseCategory === "LR-4") {
        finalCategory = "LR-3";
        ancillaryAdjustment =
          "Downgraded from LR-4 to LR-3 based on ancillary features favoring benignity";
      } else {
        ancillaryAdjustment =
          "Ancillary features favor benignity but no further downgrade possible";
      }
    }

    // Update category name and probability if changed
    if (finalCategory !== baseCategory) {
      categoryName = categoryDetails[finalCategory].name;
      hccProbability = categoryDetails[finalCategory].hcc;
    }

    // Build feature summary
    const majorFeatures = [];
    if (hasAPHE) majorFeatures.push("Nonrim APHE: Present");
    else majorFeatures.push("Nonrim APHE: Absent");
    majorFeatures.push(`Size: ${size} mm`);
    majorFeatures.push(`Washout: ${hasWashout ? "Present" : "Absent"}`);
    majorFeatures.push(
      `Enhancing Capsule: ${hasCapsule ? "Present" : "Absent"}`,
    );
    majorFeatures.push(
      `Threshold Growth: ${hasThresholdGrowth ? "Present" : "Absent"}`,
    );

    // Build result object
    const result = {
      "LI-RADS Category": `${finalCategory} (${categoryName})`,
      "HCC Probability": hccProbability,
      "Major Features": majorFeatures.join(" | "),
      "Additional Major Features Count": `${additionalFeatures} of 3 (washout, capsule, threshold growth)`,
      Recommendation: categoryDetails[finalCategory].recommendation,
    };

    // Add base category if adjusted
    if (finalCategory !== baseCategory) {
      result["Base Category (before ancillary)"] = baseCategory;
      result["Ancillary Adjustment"] = ancillaryAdjustment;
    }

    // Add clinical notes for specific findings
    const notes = [];

    if (size < 10 && hasAPHE && additionalFeatures >= 2) {
      notes.push(
        "Observation <10mm cannot be categorized as LR-5 regardless of other features",
      );
    }

    if (
      size >= 10 &&
      size < 20 &&
      hasAPHE &&
      hasCapsule &&
      !hasWashout &&
      !hasThresholdGrowth
    ) {
      notes.push(
        "At 10-19mm with APHE, capsule alone (without washout or threshold growth) yields LR-4, not LR-5",
      );
    }

    if (hasThresholdGrowth) {
      notes.push(
        "Threshold growth defined as ≥50% size increase in ≤6 months or new observation ≥10mm",
      );
    }

    if (finalCategory === "LR-5") {
      notes.push("LR-5 allows treatment without biopsy per AASLD guidelines");
      notes.push(
        "Verify OPTN criteria separately if patient is a transplant candidate",
      );
    }

    if (notes.length > 0) {
      result["Clinical Notes"] = notes.join("; ");
    }

    result._severity = finalCategory === "LR-3" ? "warning" : "danger";
    return result;
  },

  refs: [
    {
      t: "Chernyak V, Fowler KJ, Kamaya A, et al. Liver Imaging Reporting and Data System (LI-RADS) Version 2018: Imaging of Hepatocellular Carcinoma in At-Risk Patients. Radiology. 2018;289(3):816-830.",
      u: "https://doi.org/10.1148/radiol.2018181494",
    },
    {
      t: "Cerny M, Chernyak V, Olive D, et al. LI-RADS Version 2018 Ancillary Features at MRI. RadioGraphics. 2018;38(7):1973-2001.",
      u: "https://doi.org/10.1148/rg.2018180052",
    },
    {
      t: "Marrero JA, Kulik LM, Sirlin CB, et al. Diagnosis, Staging, and Management of Hepatocellular Carcinoma: 2018 Practice Guidance by AASLD. Hepatology. 2018;68(2):723-750.",
      u: "https://doi.org/10.1002/hep.29913",
    },
    {
      t: "Kang JH, Choi SH, Lee JS, et al. Interreader Agreement of Liver Imaging Reporting and Data System on MRI: A Systematic Review and Meta-Analysis. J Magn Reson Imaging. 2020;52(3):795-804.",
      u: "https://doi.org/10.1002/jmri.27065",
    },
    {
      t: "van der Pol CB, Lim CS, Sirlin CB, et al. Diagnostic Performance of LI-RADS for MRI and CT Detection of HCC: A Systematic Review and Meta-Analysis. Eur J Radiol. 2021;134:109439.",
      u: "https://doi.org/10.1016/j.ejrad.2020.109439",
    },
    {
      t: "Lee S, Kim SS, Shin H, et al. LI-RADS Version 2018 Category 5 for Diagnosing Hepatocellular Carcinoma: An Updated Meta-Analysis. Eur Radiol. 2024;34:1410-1422.",
      u: "https://doi.org/10.1007/s00330-023-10134-z",
    },
    {
      t: "Bae JS, et al. LI-RADS Tumor in Vein at CT and Hepatobiliary MRI. Radiology. 2021;302(1):107-115.",
      u: "https://doi.org/10.1148/radiol.2021210215",
    },
    {
      t: "Ronot M, et al. A Multicenter Assessment of Interreader Reliability of LI-RADS Version 2018 for MRI and CT. Radiology. 2023;307(5):e222855.",
      u: "https://doi.org/10.1148/radiol.222855",
    },
    {
      t: "Tang A, et al. LI-RADS: a conceptual and historical review. J Hepatocell Carcinoma. 2019;6:23-34.",
      u: "https://doi.org/10.2147/JHC.S186239",
    },
    {
      t: "ACR LI-RADS - Liver Imaging Reporting and Data System",
      u: "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/LI-RADS",
    },
  ],
};
