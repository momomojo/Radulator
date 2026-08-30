/**
 * Fleischner Society 2017 incidental pulmonary nodule guidance.
 *
 * Management source:
 * - MacMahon H, et al. Radiology. 2017;284(1):228-243.
 *   https://doi.org/10.1148/radiol.2017161659
 * Measurement source:
 * - Bankier AA, et al. Radiology. 2017;285(2):584-600.
 *   https://doi.org/10.1148/radiol.2017162894
 */

const APPLICABILITY_RESULTS = {
  screening: {
    "Fleischner Applicability": "Not applicable",
    Reason: "The Fleischner 2017 incidental-nodule table is not intended for lung cancer screening.",
    "Next Step": "Use the applicable lung-cancer-screening protocol, such as ACR Lung-RADS, rather than a Fleischner schedule.",
  },
  under_35: {
    "Fleischner Applicability": "Not applicable",
    Reason: "The Fleischner 2017 table does not apply to patients younger than 35 years.",
    "Next Step": "Use case-specific clinical and radiologic assessment instead of this table.",
  },
  known_cancer: {
    "Fleischner Applicability": "Not applicable",
    Reason: "The Fleischner 2017 table does not apply to patients with known cancer.",
    "Next Step": "Use cancer-specific and case-specific management rather than this incidental-nodule table.",
  },
  immunocompromised: {
    "Fleischner Applicability": "Not applicable",
    Reason: "The Fleischner 2017 table does not apply to immunocompromised patients.",
    "Next Step": "Use case-specific management that accounts for immune status and the clinical differential.",
  },
  uncertain: {
    "Fleischner Applicability": "Uncertain",
    Reason: "Eligibility for the Fleischner 2017 incidental-nodule table has not been established.",
    "Next Step": "Review the clinical context and confirm eligibility before assigning a Fleischner follow-up schedule.",
  },
};

function wholeMillimeter(value) {
  return /^-?\d+$/.test(String(value ?? "").trim());
}

function measurementBasis(size, count, type) {
  const parts = ["Measurements are recorded to the nearest whole millimeter on lung-window images."];
  if (size < 10) {
    parts.push("Overall size is the average of maximal long-axis and perpendicular maximal short-axis diameters in the plane showing the greatest dimensions.");
  } else {
    parts.push("For an overall size ≥10 mm, both long- and short-axis diameters have been recorded.");
  }
  if (count === "multiple") {
    parts.push("The entered size represents the most suspicious nodule, which may not be the largest.");
  }
  if (type === "part_solid") {
    parts.push("The solid component is the maximum long-axis diameter of the largest solid component, measured separately on lung-window images.");
  }
  return parts.join(" ");
}

function applicabilityResult(value) {
  const result = APPLICABILITY_RESULTS[value];
  if (!result) return null;
  return {
    ...result,
    "Guideline Scope": "No Fleischner follow-up schedule was generated.",
    _severity: "warning",
  };
}

export const Fleischner = {
  id: "fleischner",
  category: "Radiology",
  name: "Fleischner 2017 Pulmonary Nodules",
  desc: "Source-locked 2017 follow-up guidance for eligible incidental solid and subsolid pulmonary nodules",
  guidelineVersion: "Fleischner 2017",
  keywords: ["pulmonary nodule", "lung nodule", "incidental", "follow-up", "CT chest"],
  tags: ["Radiology", "Pulmonary", "Oncology"],
  metaDesc: "Fleischner 2017 incidental pulmonary nodule follow-up guide with explicit scope, measurement, solid, and subsolid pathways.",

  info: {
    text: `This tool transcribes the Fleischner Society 2017 management table for eligible, incidentally detected pulmonary nodules on CT.

Scope gate:
• Adults age 35 years or older
• Incidental nodules, not lung cancer screening
• Not immunocompromised
• No known cancer

Measurement gate:
• Measure on lung-window images
• Record whole millimeters
• For nodules <10 mm, enter the average of maximal long-axis and perpendicular maximal short-axis diameters in the plane showing the greatest dimensions
• For nodules ≥10 mm, record both axes
• For part-solid nodules, separately enter the maximum long-axis diameter of the largest solid component

For multiple nodules, enter the most suspicious nodule, which may not be the largest. For solid nodules, the interpreting clinician must select the holistic malignancy-risk stratum; this tool does not infer risk from isolated factors.`,
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
        { value: "eligible", label: "Eligible incidental nodule: age ≥35, not screening, not immunocompromised, and no known cancer" },
        { value: "under_35", label: "Patient is younger than 35 years" },
        { value: "screening", label: "Nodule was detected in a lung cancer screening program" },
        { value: "immunocompromised", label: "Patient is immunocompromised" },
        { value: "known_cancer", label: "Patient has known cancer" },
        { value: "uncertain", label: "Eligibility is uncertain" },
      ],
    },
    {
      id: "nodule_type",
      label: "Nodule Type",
      type: "radio",
      showIf: (vals) => vals.guideline_applicability === "eligible",
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
      showIf: (vals) => vals.guideline_applicability === "eligible",
      opts: [
        { value: "single", label: "Single nodule" },
        { value: "multiple", label: "Multiple nodules" },
      ],
    },
    {
      id: "nodule_size",
      label: "Recorded Overall Nodule Size (whole mm)",
      subLabel: "For multiple nodules, enter the most suspicious nodule; measure on lung windows.",
      type: "number",
      showIf: (vals) => vals.guideline_applicability === "eligible",
    },
    {
      id: "large_nodule_axes_recorded",
      label: "Both Overall Axes Recorded",
      subLabel: "Required when the entered overall size is ≥10 mm.",
      type: "radio",
      showIf: (vals) => vals.guideline_applicability === "eligible" && Number(vals.nodule_size) >= 10,
      opts: [
        { value: "yes", label: "Yes — long- and short-axis diameters are recorded" },
        { value: "no", label: "No / uncertain" },
      ],
    },
    {
      id: "solid_component",
      label: "Largest Solid Component (whole mm)",
      subLabel: "Maximum long-axis diameter of the largest solid component on lung-window images.",
      type: "number",
      showIf: (vals) => vals.guideline_applicability === "eligible" && vals.nodule_type === "part_solid",
    },
    {
      id: "risk_level",
      label: "Clinician-Estimated Malignancy Risk",
      subLabel: "Required for solid nodules; select holistically rather than from one isolated factor.",
      type: "radio",
      showIf: (vals) => vals.guideline_applicability === "eligible" && vals.nodule_type === "solid",
      opts: [
        { value: "low", label: "Low risk (<5%)" },
        { value: "high", label: "High risk (≥5%)" },
      ],
    },
    {
      id: "sub6_ground_glass_context",
      label: "Solitary Pure GGN <6 mm Context",
      type: "radio",
      showIf: (vals) => vals.guideline_applicability === "eligible" && vals.nodule_type === "ground_glass" && vals.nodule_count === "single" && Number(vals.nodule_size) > 0 && Number(vals.nodule_size) < 6,
      opts: [
        { value: "routine", label: "Ordinary <6 mm pure GGN" },
        { value: "selected_suspicious_near_6", label: "Selected suspicious pure GGN close to 6 mm" },
      ],
    },
    {
      id: "component_concern",
      label: "Solid-Component Growth or Particularly Suspicious Morphology",
      type: "radio",
      showIf: (vals) => vals.guideline_applicability === "eligible" && vals.nodule_type === "part_solid" && vals.nodule_count === "single" && Number(vals.solid_component) >= 6 && Number(vals.solid_component) <= 8,
      opts: [
        { value: "no", label: "No / not established" },
        { value: "yes", label: "Yes — growing or particularly suspicious" },
      ],
    },
  ],

  compute: (vals) => {
    const applicability = vals.guideline_applicability ?? "";
    if (!applicability) {
      return { Error: "Please establish Fleischner 2017 applicability before using the follow-up table." };
    }
    if (applicability !== "eligible") {
      return applicabilityResult(applicability) ?? { Error: "Please select a valid Fleischner applicability state." };
    }

    const noduleType = vals.nodule_type ?? "";
    const noduleCount = vals.nodule_count ?? "";
    if (!["solid", "ground_glass", "part_solid"].includes(noduleType)) {
      return { Error: "Please specify a valid nodule type." };
    }
    if (!["single", "multiple"].includes(noduleCount)) {
      return { Error: "Please specify whether the nodule is single or multiple." };
    }

    if (String(vals.nodule_size ?? "").trim() === "") {
      return { Error: "Please enter the recorded overall nodule size." };
    }
    if (!wholeMillimeter(vals.nodule_size)) {
      return { Error: "Enter a pre-recorded whole-millimeter overall size; do not threshold a fractional measurement in this tool." };
    }
    const size = Number(vals.nodule_size);
    if (size <= 0) {
      return { Error: "Overall nodule size must be a positive whole-millimeter value." };
    }
    if (size > 30) {
      return { Error: "A lesion greater than 30 mm is outside this pulmonary-nodule table; use case-specific mass evaluation." };
    }
    if (size >= 10 && vals.large_nodule_axes_recorded !== "yes") {
      return { Error: "For an overall size ≥10 mm, record both long- and short-axis diameters before using this table." };
    }

    let solidSize = null;
    if (noduleType === "part_solid") {
      if (String(vals.solid_component ?? "").trim() === "") {
        return { Error: "Enter the recorded solid-component size for a part-solid nodule." };
      }
      if (!wholeMillimeter(vals.solid_component)) {
        return { Error: "Enter a pre-recorded whole-millimeter solid-component size." };
      }
      solidSize = Number(vals.solid_component);
      if (solidSize <= 0) {
        return { Error: "Solid-component size must be a positive whole-millimeter value." };
      }
      if (solidSize > size) {
        return { Error: "Solid-component size cannot exceed the overall nodule size." };
      }
    }

    if (noduleType === "solid" && !["low", "high"].includes(vals.risk_level)) {
      return { Error: "Select the clinician-estimated risk stratum for a solid nodule." };
    }
    if (noduleType === "ground_glass" && noduleCount === "single" && size < 6 && !["routine", "selected_suspicious_near_6"].includes(vals.sub6_ground_glass_context)) {
      return { Error: "Specify whether the solitary pure GGN is ordinary or meets the selected suspicious near-6-mm exception." };
    }
    if (noduleType === "part_solid" && noduleCount === "single" && size >= 6 && solidSize >= 6 && solidSize <= 8 && !["yes", "no"].includes(vals.component_concern)) {
      return { Error: "Specify whether solid-component growth or particularly suspicious morphology is present." };
    }

    const single = noduleCount === "single";
    const highRisk = vals.risk_level === "high";
    let recommendation;
    let followUp;
    let rationale;
    let decisionBoundary;

    if (noduleType === "solid") {
      if (single && size < 6) {
        recommendation = highRisk ? "Optional CT at 12 months" : "No routine follow-up";
        followUp = highRisk ? "12 months (optional)" : "None";
        rationale = "Fleischner 2017 Table 1, single solid nodule <6 mm.";
        decisionBoundary = highRisk ? "Single solid nodule <6 mm with clinician-selected high risk." : "Single solid nodule <6 mm with clinician-selected low risk.";
      } else if (single && size <= 8) {
        recommendation = highRisk ? "CT at 6–12 months; then CT at 18–24 months" : "CT at 6–12 months; then consider CT at 18–24 months";
        followUp = highRisk ? "6–12 months, then 18–24 months" : "6–12 months, then 18–24 months (consider)";
        rationale = "Fleischner 2017 Table 1, single solid nodule 6–8 mm.";
        decisionBoundary = highRisk ? "High-risk 6–8 mm row; the later CT is recommended." : "Low-risk 6–8 mm row; the later CT remains optional.";
      } else if (single) {
        recommendation = "Consider CT at 3 months, PET/CT, or tissue sampling";
        followUp = "3 months or diagnostic evaluation, selected case by case";
        rationale = "Fleischner 2017 Table 1, single solid nodule >8 mm.";
        decisionBoundary = "Single solid nodule >8 mm; the table lists alternatives rather than choosing one for the patient.";
      } else if (size < 6) {
        recommendation = highRisk ? "Optional CT at 12 months" : "No routine follow-up";
        followUp = highRisk ? "12 months (optional)" : "None";
        rationale = "Fleischner 2017 Table 1, multiple solid nodules <6 mm.";
        decisionBoundary = "Multiple solid nodules <6 mm; management uses the most suspicious nodule.";
      } else {
        recommendation = highRisk ? "CT at 3–6 months; then CT at 18–24 months" : "CT at 3–6 months; then consider CT at 18–24 months";
        followUp = highRisk ? "3–6 months, then 18–24 months" : "3–6 months, then 18–24 months (consider)";
        rationale = "Fleischner 2017 Table 1, multiple solid nodules ≥6 mm.";
        decisionBoundary = highRisk ? "High-risk multiple-solid row; management is based on the most suspicious nodule." : "Low-risk multiple-solid row; the later CT is optional and management is based on the most suspicious nodule.";
      }
    } else if (noduleCount === "multiple") {
      if (size < 6) {
        recommendation = "CT at 3–6 months; if stable, consider CT at 2 and 4 years";
        followUp = "3–6 months; if stable, 2 and 4 years (consider)";
        rationale = "Fleischner 2017 Table 1, multiple subsolid nodules <6 mm.";
        decisionBoundary = "Multiple subsolid nodules <6 mm; use the most suspicious nodule, which may not be the largest.";
      } else {
        recommendation = "CT at 3–6 months; subsequent management based on the most suspicious nodule(s)";
        followUp = "3–6 months, then the pathway for the most suspicious nodule(s)";
        rationale = "Fleischner 2017 Table 1, multiple subsolid nodules ≥6 mm.";
        decisionBoundary = "Subsequent management is not a fixed 2/4-year schedule; the most suspicious nodule may not be the largest.";
      }
    } else if (noduleType === "ground_glass") {
      if (size < 6 && vals.sub6_ground_glass_context === "selected_suspicious_near_6") {
        recommendation = "Consider CT at 2 and 4 years";
        followUp = "2 and 4 years (consider)";
        rationale = "Fleischner Recommendation 3 permits this option for selected suspicious pure GGNs close to 6 mm.";
        decisionBoundary = "This is the selected suspicious pure ground-glass nodule close to 6 mm exception, not the ordinary <6 mm row.";
      } else if (size < 6) {
        recommendation = "No routine follow-up";
        followUp = "None";
        rationale = "Fleischner 2017 Table 1, ordinary solitary pure GGN <6 mm.";
        decisionBoundary = "Ordinary solitary pure ground-glass nodule <6 mm.";
      } else {
        recommendation = "CT at 6–12 months to confirm persistence; then CT every 2 years until 5 years";
        followUp = "6–12 months, then every 2 years until year 5 from baseline";
        rationale = "Fleischner 2017 Table 1, solitary pure GGN ≥6 mm.";
        decisionBoundary = "The surveillance horizon ends at 5 years from baseline; it is not five additional years after confirmation.";
      }
    } else if (size < 6) {
      recommendation = "No routine follow-up";
      followUp = "None";
      rationale = "Fleischner 2017 Table 1, solitary part-solid nodule <6 mm.";
      decisionBoundary = "Solitary part-solid nodule with overall size <6 mm.";
    } else if (solidSize < 6) {
      recommendation = "CT at 3–6 months to confirm persistence; if unchanged and the solid component remains <6 mm, annual CT for 5 years";
      followUp = "3–6 months, then annually through 5 years if unchanged and the component remains <6 mm";
      rationale = "Fleischner 2017 Table 1 and Recommendation 4, solitary part-solid nodule ≥6 mm with solid component <6 mm.";
      decisionBoundary = "Annual surveillance applies only while the solid component remains <6 mm.";
    } else if (solidSize > 8 || vals.component_concern === "yes") {
      recommendation = "PET/CT, biopsy, or resection is recommended";
      followUp = "Diagnostic evaluation rather than the <6 mm component surveillance pathway";
      rationale = "Fleischner Recommendation 4 escalation for a solid component >8 mm, growth, or particularly suspicious morphology.";
      decisionBoundary = solidSize > 8 ? "The solid component >8 mm crosses the escalation boundary." : "The solid component is growing or particularly suspicious, which crosses the escalation boundary.";
    } else {
      recommendation = "CT at 3–6 months to confirm persistence; a solid component ≥6 mm is highly suspicious";
      followUp = "3–6 months to confirm persistence; subsequent evaluation based on the complete case";
      rationale = "Fleischner Recommendation 4, solitary part-solid nodule with a 6–8 mm solid component and no selected additional escalation feature.";
      decisionBoundary = "A 6–8 mm solid component is highly suspicious but size in this interval alone does not by itself trigger PET/CT, biopsy, or resection.";
    }

    const typeLabel = noduleType === "solid" ? "Solid" : noduleType === "ground_glass" ? "Pure ground-glass" : "Part-solid";
    const result = {
      "Fleischner Applicability": "Applicable",
      Recommendation: recommendation,
      "Follow-up Interval": followUp,
      Rationale: rationale,
      "Decision Boundary": decisionBoundary,
      "Nodule Characteristics": `${typeLabel}, ${single ? "single" : "multiple"}, ${size} mm`,
      "Measurement Basis": measurementBasis(size, noduleCount, noduleType),
      "Guideline Scope": "This is a table-based reference for an already characterized incidental pulmonary nodule; it does not diagnose malignancy or select among case-dependent diagnostic options.",
      "Source Framework": "Fleischner Society 2017 incidental pulmonary nodule guideline and 2017 measurement statement",
    };

    if (noduleType === "solid") {
      result["Risk Assessment"] = `Solid-nodule pathway uses clinician-selected ${highRisk ? "high risk (≥5%)" : "low risk (<5%)"}; the tool does not infer risk from isolated factors.`;
    }
    if (solidSize !== null) {
      result["Solid Component"] = `${solidSize} mm`;
    }

    const lowerRecommendation = recommendation.toLowerCase();
    if (lowerRecommendation.includes("no routine follow-up")) result._severity = "success";
    else if (lowerRecommendation.includes("pet/ct") || lowerRecommendation.includes("tissue sampling") || lowerRecommendation.includes("resection")) result._severity = "danger";
    else result._severity = "warning";

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
