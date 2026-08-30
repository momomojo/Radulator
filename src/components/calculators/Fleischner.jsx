/**
 * Fleischner Society 2017 incidental pulmonary nodule guidance.
 * Management: https://doi.org/10.1148/radiol.2017161659
 * Measurement: https://doi.org/10.1148/radiol.2017162894
 */

const APPLICABILITY_RESULTS = {
  screening: {
    "Fleischner Applicability": "Not applicable",
    Reason:
      "The Fleischner 2017 incidental-nodule table is not intended for lung cancer screening.",
    "Next Step":
      "Use the applicable lung-cancer-screening protocol, such as ACR Lung-RADS, rather than a Fleischner schedule.",
  },
  under_35: {
    "Fleischner Applicability": "Not applicable",
    Reason:
      "The Fleischner 2017 table does not apply to patients younger than 35 years; infection is more likely than cancer in this age group.",
    "Next Step":
      "Use case-specific clinical and radiologic assessment and minimize serial CT when possible.",
  },
  known_cancer: {
    "Fleischner Applicability": "Not applicable",
    Reason:
      "The Fleischner 2017 table does not apply to patients with known cancer (a primary cancer at risk for metastases).",
    "Next Step":
      "Use cancer-specific and case-specific management rather than this incidental-nodule table.",
  },
  immunocompromised: {
    "Fleischner Applicability": "Not applicable",
    Reason:
      "The Fleischner 2017 table does not apply to immunocompromised patients who are at risk for infection.",
    "Next Step":
      "Use case-specific management that accounts for immune status and the clinical differential.",
  },
  uncertain: {
    "Fleischner Applicability": "Uncertain",
    Reason:
      "Eligibility for the Fleischner 2017 incidental-nodule table has not been established.",
    "Next Step":
      "Review the clinical context and confirm eligibility before assigning a Fleischner follow-up schedule.",
  },
};

const CHARACTERIZATION_RESULTS = {
  benign_fat_or_calcification: {
    "Fleischner Applicability": "Not a table-managed indeterminate nodule",
    Recommendation:
      "No further CT follow-up is recommended for a definitively benign fat- or calcification-containing nodule.",
    Reason:
      "Thin-section characterization establishes a benign diagnosis rather than an indeterminate nodule requiring the management table.",
    _severity: "success",
  },
  typical_intrapulmonary_lymph_node: {
    "Fleischner Applicability": "Not a table-managed indeterminate nodule",
    Recommendation:
      "No CT follow-up is recommended for morphology typical of an intrapulmonary lymph node.",
    Reason:
      "The 2017 guideline specifically excludes a typical intrapulmonary lymph node from nodule follow-up.",
    _severity: "success",
  },
  thin_sections_unavailable: {
    "Fleischner Applicability": "Characterization incomplete",
    Reason:
      "Accurate small-nodule characterization requires contiguous thin sections (≤1.5 mm, typically 1.0 mm) with multiplanar reconstructions.",
    "Next Step":
      "If the initial examination used thick sections, consider a short-term examination with contiguous thin sections as a baseline before applying the table.",
    _severity: "warning",
  },
  uncertain: {
    "Fleischner Applicability": "Characterization uncertain",
    Reason:
      "The lesion has not been established as an indeterminate pulmonary nodule appropriate for this table.",
    "Next Step":
      "Complete thin-section characterization and confirm whether benign fat/calcification or typical intrapulmonary-lymph-node morphology is present.",
    _severity: "warning",
  },
};

function wholeMillimeter(value) {
  return /^-?\d+$/.test(String(value ?? "").trim());
}

function lookupOwn(map, value) {
  return Object.hasOwn(map, value) ? map[value] : null;
}

function noTableResult(result) {
  return {
    ...result,
    "Guideline Scope": "No Fleischner table schedule was generated.",
  };
}

function measurementBasis({ sizeMode, size, count, type }) {
  const parts = [
    "Characterization is based on contiguous thin-section CT (≤1.5 mm) and measurements are performed on lung-window images.",
  ];

  if (sizeMode === "lte3_unmeasured") {
    parts.push(
      "The selected nodule is recorded in the ≤3 mm category without a false-precision linear measurement, because nodules this small should not be measured.",
    );
  } else if (size < 10) {
    parts.push(
      "Overall size is the nearest whole millimeter average of maximal long-axis and perpendicular maximal short-axis diameters in the plane showing the greatest dimensions.",
    );
  } else {
    parts.push(
      "For an overall size ≥10 mm, both long- and short-axis diameters have been recorded.",
    );
  }

  if (count === "multiple") {
    parts.push(
      "The entered selected-nodule size describes the most suspicious nodule, which may not be the largest; the cohort threshold separately records whether any nodule is ≥6 mm.",
    );
  }

  if (type === "part_solid") {
    if (sizeMode === "lte3_unmeasured" || size < 6) {
      parts.push(
        "A discrete solid component is not required below 6 mm overall because it cannot be defined reliably at this size.",
      );
    } else {
      parts.push(
        "The solid component is the maximum long-axis diameter of the largest solid component, measured separately to the nearest whole millimeter.",
      );
    }
  }

  return parts.join(" ");
}

function solidSolitaryOutcome(size, highRisk) {
  if (size < 6) {
    return {
      recommendation: highRisk ? "Optional CT at 12 months" : "No routine follow-up",
      followUp: highRisk ? "12 months (optional)" : "None",
      rationale: "Fleischner 2017 Table 1 §solid, solitary solid nodule <6 mm.",
      decisionBoundary: highRisk
        ? "Solitary solid nodule <6 mm with clinician-selected high risk."
        : "Solitary solid nodule <6 mm with clinician-selected low risk.",
    };
  }

  if (size <= 8) {
    return {
      recommendation: highRisk
        ? "CT at 6–12 months; then CT at 18–24 months"
        : "CT at 6–12 months; then consider CT at 18–24 months",
      followUp: highRisk
        ? "6–12 months, then 18–24 months"
        : "6–12 months, then 18–24 months (consider)",
      rationale: "Fleischner 2017 Table 1 §solid, solitary solid nodule 6–8 mm.",
      decisionBoundary: highRisk
        ? "High-risk 6–8 mm row; the later CT is recommended."
        : "Low-risk 6–8 mm row; the later CT remains optional.",
    };
  }

  return {
    recommendation: "Consider CT at 3 months, PET/CT, or tissue sampling",
    followUp: "3 months or diagnostic evaluation, selected case by case",
    rationale: "Fleischner 2017 Table 1 §solid, solitary solid nodule >8 mm.",
    decisionBoundary:
      "Solitary solid nodule >8 mm; the table lists alternatives rather than choosing one for the patient.",
  };
}

export const Fleischner = {
  id: "fleischner",
  category: "Radiology",
  name: "Fleischner 2017 Pulmonary Nodules",
  desc: "Source-locked 2017 follow-up guidance for eligible incidental solid and subsolid pulmonary nodules",
  guidelineVersion: "Fleischner 2017",
  keywords: [
    "pulmonary nodule",
    "lung nodule",
    "incidental",
    "follow-up",
    "CT chest",
  ],
  tags: ["Radiology", "Pulmonary", "Oncology"],
  metaDesc:
    "Fleischner 2017 incidental pulmonary nodule follow-up guide with explicit scope, characterization, measurement, solid, and subsolid pathways.",

  info: {
    text: `This tool transcribes the Fleischner Society 2017 management table for eligible, incidentally detected pulmonary nodules on CT.

Scope gate:
• Adults age 35 years or older
• Incidental nodules, not lung cancer screening
• Not immunocompromised
• No known primary cancer

Characterization and technique gate:
• Establish an indeterminate nodule on contiguous thin sections ≤1.5 mm (typically 1.0 mm) with multiplanar reconstructions
• Definitively benign fat/calcification and typical intrapulmonary-lymph-node morphology do not enter the follow-up table
• Review all available prior imaging for growth or stability
• Use a low-radiation technique for follow-up CT

Measurement gate:
• Measure on lung-window images and record whole millimeters
• Do not assign a false-precision measurement to nodules ≤3 mm
• For nodules >3 and <10 mm, enter the average of maximal long-axis and perpendicular maximal short-axis diameters in the plane showing the greatest dimensions
• For nodules ≥10 mm, record both axes
• For part-solid nodules ≥6 mm, separately enter the maximum long-axis diameter of the largest solid component

For multiple nodules, separately state whether any nodule is ≥6 mm and characterize the most suspicious nodule, which may not be the largest. For solid nodules, the interpreting clinician must select the holistic malignancy-risk stratum; this tool does not infer risk from isolated factors.`,
    link: {
      label: "View the 2017 Fleischner guideline",
      url: "https://doi.org/10.1148/radiol.2017161659",
    },
  },

  fields: [
    {
      id: "guideline_applicability",
      label: "Fleischner 2017 Applicability",
      subLabel: "Choose the single statement that matches the patient and examination.",
      type: "radio",
      opts: [
        {
          value: "eligible",
          label:
            "Eligible incidental nodule: age ≥35, not screening, not immunocompromised, and no known cancer",
        },
        { value: "under_35", label: "Patient is younger than 35 years" },
        {
          value: "screening",
          label: "Nodule was detected in a lung cancer screening program",
        },
        {
          value: "immunocompromised",
          label: "Patient is immunocompromised",
        },
        { value: "known_cancer", label: "Patient has known cancer" },
        { value: "uncertain", label: "Eligibility is uncertain" },
      ],
    },
    {
      id: "nodule_characterization",
      label: "Thin-Section Nodule Characterization",
      subLabel:
        "Characterize on contiguous sections ≤1.5 mm with multiplanar reconstructions before applying the table.",
      type: "radio",
      showIf: (vals) => vals.guideline_applicability === "eligible",
      opts: [
        {
          value: "indeterminate_thin_section",
          label: "Indeterminate pulmonary nodule characterized on thin-section CT",
        },
        {
          value: "benign_fat_or_calcification",
          label: "Definitively benign fat or calcification",
        },
        {
          value: "typical_intrapulmonary_lymph_node",
          label: "Typical intrapulmonary lymph node morphology",
        },
        {
          value: "thin_sections_unavailable",
          label: "Thin-section characterization is unavailable",
        },
        { value: "uncertain", label: "Characterization is uncertain" },
      ],
    },
    {
      id: "nodule_type",
      label: "Selected Nodule Type",
      subLabel:
        "For multiple nodules, select the morphology of the most suspicious nodule.",
      type: "radio",
      showIf: (vals) =>
        vals.guideline_applicability === "eligible" &&
        vals.nodule_characterization === "indeterminate_thin_section",
      opts: [
        { value: "solid", label: "Solid nodule" },
        { value: "ground_glass", label: "Pure ground-glass nodule" },
        { value: "part_solid", label: "Part-solid nodule" },
      ],
    },
    {
      id: "nodule_count",
      label: "Number of Nodules",
      type: "radio",
      showIf: (vals) =>
        vals.guideline_applicability === "eligible" &&
        vals.nodule_characterization === "indeterminate_thin_section",
      opts: [
        { value: "single", label: "Single nodule" },
        { value: "multiple", label: "Multiple nodules" },
      ],
    },
    {
      id: "multiple_size_threshold",
      label: "Multiple-Nodule 6 mm Cohort Threshold",
      subLabel:
        "This cohort threshold is separate from the size of the most suspicious nodule.",
      type: "radio",
      showIf: (vals) =>
        vals.guideline_applicability === "eligible" &&
        vals.nodule_characterization === "indeterminate_thin_section" &&
        vals.nodule_count === "multiple",
      opts: [
        { value: "all_lt6", label: "Every nodule is <6 mm" },
        { value: "any_ge6", label: "At least one nodule is ≥6 mm" },
      ],
    },
    {
      id: "size_mode",
      label: "Selected Nodule Size Category",
      subLabel:
        "Do not enter a false-precision measurement for a nodule ≤3 mm.",
      type: "radio",
      showIf: (vals) =>
        vals.guideline_applicability === "eligible" &&
        vals.nodule_characterization === "indeterminate_thin_section",
      opts: [
        { value: "lte3_unmeasured", label: "≤3 mm — categorical; do not measure" },
        { value: "measured", label: ">3 mm — enter a recorded whole-mm size" },
      ],
    },
    {
      id: "nodule_size",
      label: "Selected Nodule Overall Size (whole mm)",
      subLabel:
        "For multiple nodules, enter the most suspicious nodule; measure on lung windows.",
      type: "number",
      showIf: (vals) =>
        vals.guideline_applicability === "eligible" &&
        vals.nodule_characterization === "indeterminate_thin_section" &&
        vals.size_mode === "measured",
    },
    {
      id: "large_nodule_axes_recorded",
      label: "Both Overall Axes Recorded",
      subLabel: "Required when the selected nodule's entered overall size is ≥10 mm.",
      type: "radio",
      showIf: (vals) =>
        vals.guideline_applicability === "eligible" &&
        vals.nodule_characterization === "indeterminate_thin_section" &&
        vals.size_mode === "measured" &&
        Number(vals.nodule_size) >= 10,
      opts: [
        {
          value: "yes",
          label: "Yes — long- and short-axis diameters are recorded",
        },
        { value: "no", label: "No / uncertain" },
      ],
    },
    {
      id: "solid_component",
      label: "Largest Solid Component (whole mm)",
      subLabel:
        "Maximum long-axis diameter of the largest solid component on lung-window images.",
      type: "number",
      showIf: (vals) =>
        vals.guideline_applicability === "eligible" &&
        vals.nodule_characterization === "indeterminate_thin_section" &&
        vals.nodule_type === "part_solid" &&
        vals.size_mode === "measured" &&
        Number(vals.nodule_size) >= 6,
    },
    {
      id: "risk_level",
      label: "Clinician-Estimated Malignancy Risk",
      subLabel:
        "Required for solid nodules; select holistically rather than from one isolated factor.",
      type: "radio",
      showIf: (vals) =>
        vals.guideline_applicability === "eligible" &&
        vals.nodule_characterization === "indeterminate_thin_section" &&
        vals.nodule_type === "solid",
      opts: [
        { value: "low", label: "Low risk (<5%)" },
        { value: "high", label: "High risk (≥5%)" },
      ],
    },
    {
      id: "sub6_subsolid_context",
      label: "Solitary 5 mm Subsolid-Nodule Context",
      type: "radio",
      showIf: (vals) =>
        vals.guideline_applicability === "eligible" &&
        vals.nodule_characterization === "indeterminate_thin_section" &&
        ["ground_glass", "part_solid"].includes(vals.nodule_type) &&
        vals.nodule_count === "single" &&
        vals.size_mode === "measured" &&
        Number(vals.nodule_size) === 5,
      opts: [
        { value: "routine", label: "Ordinary 5 mm subsolid nodule" },
        {
          value: "selected_suspicious_near_6",
          label: "Selected suspicious subsolid nodule close to 6 mm",
        },
      ],
    },
    {
      id: "dominant_solid_management",
      label: "Dominant Solid-Nodule Management Rule",
      subLabel:
        "Recommendation 2 allows a larger or more suspicious dominant nodule to use the solitary-nodule pathway.",
      type: "radio",
      showIf: (vals) =>
        vals.guideline_applicability === "eligible" &&
        vals.nodule_characterization === "indeterminate_thin_section" &&
        vals.nodule_type === "solid" &&
        vals.nodule_count === "multiple" &&
        vals.multiple_size_threshold === "any_ge6",
      opts: [
        { value: "multiple_table", label: "Use the multiple-solid table row" },
        {
          value: "solitary_override",
          label:
            "Use the solitary pathway for a larger or more suspicious dominant nodule",
        },
      ],
    },
    {
      id: "component_concern",
      label: "Solid-Component Growth or Particularly Suspicious Morphology",
      subLabel:
        "Particularly suspicious examples include lobulated margins or cystic components.",
      type: "radio",
      showIf: (vals) =>
        vals.guideline_applicability === "eligible" &&
        vals.nodule_characterization === "indeterminate_thin_section" &&
        vals.nodule_type === "part_solid" &&
        vals.nodule_count === "single" &&
        vals.size_mode === "measured" &&
        Number(vals.nodule_size) >= 6,
      opts: [
        { value: "no", label: "No / not established" },
        { value: "yes", label: "Yes — growing or particularly suspicious" },
      ],
    },
  ],

  compute: (vals) => {
    const applicability = vals.guideline_applicability ?? "";
    if (!applicability) {
      return {
        Error:
          "Please establish Fleischner 2017 applicability before using the follow-up table.",
      };
    }
    if (applicability !== "eligible") {
      const result = lookupOwn(APPLICABILITY_RESULTS, applicability);
      return result
        ? noTableResult({ ...result, _severity: "warning" })
        : { Error: "Please select a valid Fleischner applicability state." };
    }

    const characterization = vals.nodule_characterization ?? "";
    if (!characterization) {
      return {
        Error:
          "Please establish thin-section nodule characterization before using the follow-up table.",
      };
    }
    if (characterization !== "indeterminate_thin_section") {
      const result = lookupOwn(CHARACTERIZATION_RESULTS, characterization);
      return result
        ? noTableResult(result)
        : { Error: "Please select a valid thin-section characterization state." };
    }

    const noduleType = vals.nodule_type ?? "";
    const noduleCount = vals.nodule_count ?? "";
    if (!["solid", "ground_glass", "part_solid"].includes(noduleType)) {
      return { Error: "Please specify a valid nodule type." };
    }
    if (!["single", "multiple"].includes(noduleCount)) {
      return { Error: "Please specify whether the nodule is single or multiple." };
    }

    let multipleSizeThreshold = null;
    if (noduleCount === "multiple") {
      multipleSizeThreshold = vals.multiple_size_threshold ?? "";
      if (!["all_lt6", "any_ge6"].includes(multipleSizeThreshold)) {
        return {
          Error:
            "For multiple nodules, specify whether every nodule is <6 mm or at least one nodule is ≥6 mm.",
        };
      }
    }

    const sizeMode = vals.size_mode ?? "";
    if (!["lte3_unmeasured", "measured"].includes(sizeMode)) {
      return {
        Error:
          "Please select the categorical ≤3 mm pathway or the recorded whole-millimeter pathway.",
      };
    }

    let size = 3;
    if (sizeMode === "measured") {
      if (String(vals.nodule_size ?? "").trim() === "") {
        return { Error: "Please enter the recorded overall nodule size." };
      }
      if (!wholeMillimeter(vals.nodule_size)) {
        return {
          Error:
            "Enter a pre-recorded whole-millimeter overall size; do not threshold a fractional measurement in this tool.",
        };
      }
      size = Number(vals.nodule_size);
      if (size <= 0) {
        return {
          Error: "Overall nodule size must be a positive whole-millimeter value.",
        };
      }
      if (size <= 3) {
        return {
          Error:
            "For a nodule ≤3 mm, use the categorical unmeasured pathway instead of entering false precision.",
        };
      }
      if (size > 30) {
        return {
          Error:
            "A lesion greater than 30 mm is outside this pulmonary-nodule table; use case-specific mass evaluation.",
        };
      }
      if (size >= 10 && vals.large_nodule_axes_recorded !== "yes") {
        return {
          Error:
            "For an overall size ≥10 mm, record both long- and short-axis diameters before using this table.",
        };
      }
    }

    if (
      noduleCount === "multiple" &&
      multipleSizeThreshold === "all_lt6" &&
      size >= 6
    ) {
      return {
        Error:
          "The selected nodule is ≥6 mm, which conflicts with the statement that every nodule is <6 mm.",
      };
    }

    let solidSize = null;
    if (noduleType === "part_solid" && size >= 6) {
      if (String(vals.solid_component ?? "").trim() === "") {
        return {
          Error:
            "Enter the recorded solid-component size for a part-solid nodule ≥6 mm.",
        };
      }
      if (!wholeMillimeter(vals.solid_component)) {
        return {
          Error:
            "Enter a pre-recorded whole-millimeter solid-component size.",
        };
      }
      solidSize = Number(vals.solid_component);
      if (solidSize <= 0) {
        return {
          Error: "Solid-component size must be a positive whole-millimeter value.",
        };
      }
      if (solidSize > size) {
        return {
          Error: "Solid-component size cannot exceed the overall nodule size.",
        };
      }
    }

    if (noduleType === "solid" && !["low", "high"].includes(vals.risk_level)) {
      return {
        Error: "Select the clinician-estimated risk stratum for a solid nodule.",
      };
    }

    if (
      ["ground_glass", "part_solid"].includes(noduleType) &&
      noduleCount === "single" &&
      size === 5 &&
      !["routine", "selected_suspicious_near_6"].includes(
        vals.sub6_subsolid_context,
      )
    ) {
      return {
        Error:
          "Specify whether the solitary 5 mm subsolid nodule is ordinary or meets the selected suspicious near-6-mm exception.",
      };
    }
    if (
      vals.sub6_subsolid_context === "selected_suspicious_near_6" &&
      size !== 5
    ) {
      return {
        Error:
          "The selected suspicious close-to-6-mm exception is restricted to the 5 mm categorical boundary in this implementation.",
      };
    }

    let dominantSolidManagement = null;
    if (
      noduleType === "solid" &&
      noduleCount === "multiple" &&
      multipleSizeThreshold === "any_ge6"
    ) {
      dominantSolidManagement = vals.dominant_solid_management ?? "";
      if (!["multiple_table", "solitary_override"].includes(dominantSolidManagement)) {
        return {
          Error:
            "Specify whether to use the multiple-solid row or the solitary pathway for a larger or more suspicious dominant nodule.",
        };
      }
      if (dominantSolidManagement === "solitary_override" && size < 6) {
        return {
          Error:
            "The solitary dominant-nodule override requires a selected dominant nodule ≥6 mm; otherwise use the multiple-solid table row.",
        };
      }
    }

    if (
      noduleType === "part_solid" &&
      noduleCount === "single" &&
      size >= 6 &&
      !["yes", "no"].includes(vals.component_concern)
    ) {
      return {
        Error:
          "Specify whether solid-component growth or particularly suspicious morphology is present.",
      };
    }

    const single = noduleCount === "single";
    const highRisk = vals.risk_level === "high";
    const cohortAtLeast6 = single
      ? size >= 6
      : multipleSizeThreshold === "any_ge6";
    let recommendation;
    let followUp;
    let rationale;
    let decisionBoundary;

    if (noduleType === "solid") {
      if (single || dominantSolidManagement === "solitary_override") {
        const outcome = solidSolitaryOutcome(size, highRisk);
        ({ recommendation, followUp, rationale, decisionBoundary } = outcome);
        if (!single) {
          rationale +=
            " Recommendation 2 directs a larger or more suspicious dominant nodule to the solitary-nodule pathway.";
          decisionBoundary +=
            " The clinician selected the Recommendation 2 solitary-nodule pathway override.";
        }
      } else if (!cohortAtLeast6) {
        recommendation = highRisk
          ? "Optional CT at 12 months"
          : "No routine follow-up";
        followUp = highRisk ? "12 months (optional)" : "None";
        rationale =
          "Fleischner 2017 Table 1 §solid and Recommendation 2, multiple solid nodules all <6 mm.";
        decisionBoundary =
          "Every solid nodule is <6 mm; management remains conditional on clinician-selected risk.";
      } else {
        recommendation = highRisk
          ? "CT at 3–6 months; then CT at 18–24 months"
          : "CT at 3–6 months; then consider CT at 18–24 months";
        followUp = highRisk
          ? "3–6 months, then 18–24 months"
          : "3–6 months, then 18–24 months (consider)";
        rationale =
          "Fleischner 2017 Table 1 §solid and Recommendation 2, multiple solid nodules with at least one nodule ≥6 mm.";
        decisionBoundary = highRisk
          ? "At least one nodule is ≥6 mm; the clinician selected the multiple-solid row, and the most suspicious nodule guides management."
          : "At least one nodule is ≥6 mm; the clinician selected the multiple-solid row, the most suspicious nodule guides management, and the later CT remains optional.";
      }
    } else if (!single) {
      if (!cohortAtLeast6) {
        recommendation =
          "CT at 3–6 months; if stable, consider CT at 2 and 4 years";
        followUp = "3–6 months; if stable, 2 and 4 years (consider)";
        rationale =
          "Fleischner 2017 Table 1 §subsolid and Recommendation 5, multiple subsolid nodules all <6 mm.";
        decisionBoundary =
          "Every subsolid nodule is <6 mm; infection and other nonneoplastic causes should be considered.";
      } else {
        recommendation =
          "CT at 3–6 months; subsequent management based on the most suspicious nodule(s)";
        followUp =
          "3–6 months, then the pathway for the most suspicious nodule(s)";
        rationale =
          "Fleischner 2017 Table 1 §subsolid and Recommendation 5, multiple subsolid nodules with at least one nodule ≥6 mm.";
        decisionBoundary =
          "At least one subsolid nodule is ≥6 mm; subsequent management is not a fixed 2/4-year schedule, and the most suspicious nodule may not be the largest.";
      }
    } else if (noduleType === "ground_glass") {
      if (
        size === 5 &&
        vals.sub6_subsolid_context === "selected_suspicious_near_6"
      ) {
        recommendation = "Consider CT at 2 and 4 years";
        followUp = "2 and 4 years (consider)";
        rationale =
          "Fleischner Recommendation 3 permits this option for selected suspicious subsolid nodules close to 6 mm.";
        decisionBoundary =
          "This is the selected suspicious pure ground-glass nodule close to 6 mm exception, not the ordinary <6 mm row.";
      } else if (size < 6) {
        recommendation = "No routine follow-up";
        followUp = "None";
        rationale =
          "Fleischner 2017 Table 1 §subsolid and Recommendation 3, ordinary solitary pure GGN <6 mm.";
        decisionBoundary = "Ordinary solitary pure ground-glass nodule <6 mm.";
      } else {
        recommendation =
          "CT at 6–12 months to confirm persistence; then CT every 2 years until 5 years";
        followUp =
          "6–12 months, then every 2 years until year 5 from baseline";
        rationale =
          "Fleischner 2017 Table 1 §subsolid and Recommendation 3, solitary pure GGN ≥6 mm.";
        decisionBoundary =
          "The surveillance horizon ends at 5 years from baseline; it is not five additional years after confirmation.";
      }
    } else if (size < 6) {
      if (
        size === 5 &&
        vals.sub6_subsolid_context === "selected_suspicious_near_6"
      ) {
        recommendation = "Consider CT at 2 and 4 years";
        followUp = "2 and 4 years (consider)";
        rationale =
          "Fleischner Recommendations 3–4 permit this option for selected suspicious subsolid nodules close to 6 mm.";
        decisionBoundary =
          "This is the selected suspicious subsolid nodule close to 6 mm exception; no discrete solid-component measurement is required at this overall size.";
      } else {
        recommendation = "No routine follow-up";
        followUp = "None";
        rationale =
          "Fleischner 2017 Table 1 §subsolid and Recommendation 4, ordinary solitary part-solid nodule <6 mm.";
        decisionBoundary =
          "A discrete solid component cannot be defined reliably at this overall size.";
      }
    } else if (vals.component_concern === "yes" || solidSize > 8) {
      recommendation = "PET/CT, biopsy, or resection is recommended";
      followUp =
        "Diagnostic evaluation rather than the component-surveillance pathway";
      rationale =
        "Fleischner Recommendation 4 escalation for a solid component >8 mm, growth, or particularly suspicious morphology.";
      decisionBoundary =
        vals.component_concern === "yes"
          ? "The solid component is growing or particularly suspicious, which crosses the escalation boundary independently of component size."
          : "The solid component >8 mm crosses the escalation boundary.";
    } else if (solidSize < 6) {
      recommendation =
        "CT at 3–6 months to confirm persistence; if unchanged and the solid component remains <6 mm, annual CT for 5 years";
      followUp =
        "3–6 months, then annually through 5 years if unchanged and the component remains <6 mm";
      rationale =
        "Fleischner 2017 Table 1 §subsolid and Recommendation 4, solitary part-solid nodule ≥6 mm with solid component <6 mm.";
      decisionBoundary =
        "Annual surveillance applies only while the solid component remains <6 mm and no growth or particularly suspicious morphology is established.";
    } else {
      recommendation =
        "Consider CT at 3–6 months to confirm persistence; a solid component ≥6 mm is highly suspicious";
      followUp =
        "Consider 3–6-month CT to confirm persistence; subsequent evaluation is based on the complete case";
      rationale =
        "Fleischner Recommendation 4, solitary part-solid nodule with a 6–8 mm solid component and no selected additional escalation feature.";
      decisionBoundary =
        "A 6–8 mm solid component is highly suspicious but size in this interval alone does not by itself trigger PET/CT, biopsy, or resection.";
    }

    const typeLabel =
      noduleType === "solid"
        ? "Solid"
        : noduleType === "ground_glass"
          ? "Pure ground-glass"
          : "Part-solid";
    const sizeLabel =
      sizeMode === "lte3_unmeasured"
        ? "≤3 mm category (unmeasured)"
        : `${size} mm`;
    const result = {
      "Fleischner Applicability": "Applicable",
      Recommendation: recommendation,
      "Follow-up Interval": followUp,
      Rationale: rationale,
      "Decision Boundary": decisionBoundary,
      "Nodule Characteristics": `${typeLabel}, ${single ? "single" : "multiple"}, selected nodule ${sizeLabel}`,
      "Measurement Basis": measurementBasis({
        sizeMode,
        size,
        count: noduleCount,
        type: noduleType,
      }),
      "Guideline Scope":
        "This is a table-based reference for an already characterized incidental pulmonary nodule; it does not diagnose malignancy or select among case-dependent diagnostic options.",
      "Source Framework":
        "Fleischner Society 2017 incidental pulmonary nodule guideline and 2017 measurement statement",
    };

    if (noduleCount === "multiple") {
      result["Multiple-Nodule Threshold"] =
        multipleSizeThreshold === "any_ge6"
          ? "At least one nodule is ≥6 mm"
          : "Every nodule is <6 mm";
    }
    if (noduleType === "solid") {
      result["Risk Assessment"] =
        `Solid-nodule pathway uses clinician-selected ${highRisk ? "high risk (≥5%)" : "low risk (<5%)"}; the tool does not infer risk from isolated factors.`;
    }
    if (solidSize !== null) {
      result["Solid Component"] = `${solidSize} mm`;
    }

    const lowerRecommendation = recommendation.toLowerCase();
    if (lowerRecommendation.includes("no routine follow-up")) {
      result._severity = "success";
    } else if (
      lowerRecommendation.includes("pet/ct") ||
      lowerRecommendation.includes("tissue sampling") ||
      lowerRecommendation.includes("resection")
    ) {
      result._severity = "danger";
    } else {
      result._severity = "warning";
    }

    return result;
  },

  refs: [
    {
      t: "MacMahon H, Naidich DP, Goo JM, et al. Guidelines for Management of Incidental Pulmonary Nodules Detected on CT Images: From the Fleischner Society 2017. Radiology. 2017;284(1):228-243.",
      u: "https://doi.org/10.1148/radiol.2017161659",
    },
    {
      t: "Bankier AA, MacMahon H, Goo JM, et al. Recommendations for Measuring Pulmonary Nodules at CT: A Statement from the Fleischner Society. Radiology. 2017;285(2):584-600.",
      u: "https://doi.org/10.1148/radiol.2017162894",
    },
    {
      t: "NCBI Bookshelf Table 5.1. Revised Fleischner guidelines (2017) for solid nodules (open cross-check reproduction).",
      u: "https://www.ncbi.nlm.nih.gov/books/NBK553863/table/ch5.Tab1/",
    },
    {
      t: "NCBI Bookshelf Table 5.2. Revised Fleischner guidelines (2017) for subsolid nodules (open cross-check reproduction).",
      u: "https://www.ncbi.nlm.nih.gov/books/NBK553863/table/ch5.Tab2/",
    },
    {
      t: "American College of Radiology. Lung-RADS Assessment Categories v2022 (screening context only).",
      u: "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/Lung-Rads",
    },
  ],
};
