/**
 * Fleischner Society Guidelines Calculator
 * Management of Incidentally Detected Pulmonary Nodules (2017)
 *
 * The Fleischner Society guidelines provide evidence-based recommendations
 * for follow-up of incidentally detected pulmonary nodules on CT. The 2017
 * update includes separate algorithms for solid and subsolid nodules.
 *
 * Primary Sources:
 * - MacMahon H, et al. Radiology. 2017;284(1):228-243 (2017 Guidelines)
 * - Naidich DP, et al. Radiology. 2013;266(1):304-317 (Subsolid Nodules)
 * - MacMahon H, et al. Radiology. 2005;237(2):395-400 (Original Guidelines)
 */

export const Fleischner = {
  id: "fleischner",
  category: "Radiology",
  name: "Fleischner 2017 Pulmonary Nodules",
  desc: "2017 Pulmonary nodule management recommendations for solid and subsolid nodules",
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
    "Free Fleischner Society Guidelines Calculator. 2017 pulmonary nodule follow-up recommendations for solid and subsolid lung nodules based on size and risk factors.",

  info: {
    text: `The Fleischner Society 2017 guidelines provide recommendations for management of incidentally detected pulmonary nodules on CT.

Key Points:
• Applies to incidental nodules in patients ≥35 years old
• Does NOT apply to: lung cancer screening, immunocompromised patients, known primary cancer
• Separate pathways for solid vs subsolid (ground-glass/part-solid) nodules
• Risk factors influence follow-up for smaller nodules

Risk Factors for Malignancy:
• Smoking history (current or former)
• Family history of lung cancer
• Upper lobe location
• Spiculated or irregular margins
• Emphysema or pulmonary fibrosis

Nodule measurement: Average of long and short axis diameters on the same image.`,
    link: {
      label: "View 2017 Fleischner Guidelines",
      url: "https://doi.org/10.1148/radiol.2017161659",
    },
  },

  fields: [
    // SECTION 1: NODULE TYPE
    {
      id: "nodule_type",
      label: "Nodule Type",
      type: "radio",
      opts: [
        { value: "solid", label: "Solid nodule" },
        { value: "ground_glass", label: "Ground-glass nodule (pure GGN)" },
        { value: "part_solid", label: "Part-solid nodule (mixed GGN)" },
      ],
    },

    // SECTION 2: NUMBER OF NODULES
    {
      id: "nodule_count",
      label: "Number of Nodules",
      type: "radio",
      opts: [
        { value: "single", label: "Single nodule" },
        { value: "multiple", label: "Multiple nodules" },
      ],
    },

    // SECTION 3: NODULE SIZE
    {
      id: "nodule_size",
      label: "Nodule Size (mm)",
      subLabel: "Average of long and short axis diameters",
      type: "number",
    },

    // SECTION 4: SOLID COMPONENT SIZE (for part-solid only)
    {
      id: "solid_component",
      label: "Solid Component Size (mm)",
      subLabel: "For part-solid nodules only",
      type: "number",
      showIf: (vals) => vals.nodule_type === "part_solid",
    },

    // SECTION 5: RISK FACTORS
    {
      id: "risk_level",
      label: "Patient Risk Level",
      type: "radio",
      opts: [
        {
          value: "low",
          label:
            "Low risk - No or minimal smoking history, no other risk factors",
        },
        {
          value: "high",
          label: "High risk - Smoking history OR other risk factors present",
        },
      ],
    },

    // SECTION 6: SPECIFIC RISK FACTORS (optional detail)
    {
      id: "smoking",
      label: "Smoking History",
      type: "radio",
      opts: [
        { value: "never", label: "Never smoker" },
        { value: "former", label: "Former smoker" },
        { value: "current", label: "Current smoker" },
      ],
    },

    {
      id: "upper_lobe",
      label: "Upper Lobe Location",
      type: "checkbox",
    },

    {
      id: "spiculated",
      label: "Spiculated or Irregular Margins",
      type: "checkbox",
    },

    {
      id: "family_history",
      label: "Family History of Lung Cancer",
      type: "checkbox",
    },

    {
      id: "emphysema",
      label: "Emphysema or Pulmonary Fibrosis",
      type: "checkbox",
    },
  ],

  compute: (vals) => {
    const {
      nodule_type = "",
      nodule_count = "",
      nodule_size = "",
      solid_component = "",
      risk_level = "",
      smoking = "",
      upper_lobe = false,
      spiculated = false,
      family_history = false,
      emphysema = false,
    } = vals;

    // Validate required fields
    if (!nodule_type || !nodule_count || !nodule_size) {
      return {
        Error:
          "Please specify nodule type, count, and size to get follow-up recommendations.",
      };
    }

    const size = parseFloat(nodule_size);
    const solidSize = parseFloat(solid_component) || 0;

    if (isNaN(size) || size <= 0) {
      return {
        Error: "Please enter a valid nodule size in millimeters.",
      };
    }

    // Determine effective risk level
    let effectiveRisk = risk_level;
    if (!effectiveRisk) {
      // Infer from specific risk factors
      const hasRiskFactors =
        smoking === "current" ||
        smoking === "former" ||
        upper_lobe ||
        spiculated ||
        family_history ||
        emphysema;
      effectiveRisk = hasRiskFactors ? "high" : "low";
    }

    const isHighRisk = effectiveRisk === "high";
    const isSingle = nodule_count === "single";

    let recommendation = "";
    let rationale = "";
    let followUpInterval = "";
    let additionalNotes = [];

    // SOLID NODULES
    if (nodule_type === "solid") {
      if (isSingle) {
        // Single solid nodule
        if (size < 6) {
          if (isHighRisk) {
            recommendation = "Optional CT at 12 months";
            rationale =
              "Low-risk morphology but high-risk patient; optional follow-up may be considered";
            followUpInterval = "12 months (optional)";
          } else {
            recommendation = "No routine follow-up";
            rationale =
              "Very low probability of malignancy (<1%) for nodules <6mm in low-risk patients";
            followUpInterval = "None required";
          }
        } else if (size >= 6 && size <= 8) {
          if (isHighRisk) {
            recommendation = "CT at 6-12 months, then CT at 18-24 months";
            rationale =
              "Intermediate probability; two follow-up scans recommended for high-risk patients";
            followUpInterval = "6-12 months, then 18-24 months";
          } else {
            recommendation = "CT at 6-12 months";
            rationale =
              "Intermediate probability; single follow-up usually sufficient for low-risk patients";
            followUpInterval = "6-12 months";
          }
        } else {
          // >8mm
          recommendation =
            "Consider CT at 3 months, PET/CT, or tissue sampling";
          rationale =
            "Higher probability of malignancy; more aggressive evaluation warranted";
          followUpInterval = "3 months or immediate workup";
          additionalNotes.push(
            "Options include: short-interval CT (3 months), PET/CT, or biopsy based on probability of malignancy and patient preferences",
          );
        }
      } else {
        // Multiple solid nodules
        if (size < 6) {
          if (isHighRisk) {
            recommendation = "Optional CT at 12 months";
            rationale =
              "Multiple small nodules in high-risk patient; optional follow-up";
            followUpInterval = "12 months (optional)";
          } else {
            recommendation = "No routine follow-up";
            rationale =
              "Multiple small nodules (<6mm) have very low malignancy risk";
            followUpInterval = "None required";
          }
        } else {
          // ≥6mm
          recommendation = "CT at 3-6 months, then CT at 18-24 months";
          rationale =
            "Multiple nodules ≥6mm require closer follow-up; assess for interval change";
          followUpInterval = "3-6 months, then 18-24 months";
          additionalNotes.push(
            "Management based on the most suspicious nodule",
          );
        }
      }
    }
    // GROUND-GLASS NODULES (Pure GGN)
    else if (nodule_type === "ground_glass") {
      if (size < 6) {
        recommendation = "No routine follow-up";
        rationale =
          "Pure ground-glass nodules <6mm rarely progress; follow-up not routinely recommended";
        followUpInterval = "None required";
      } else {
        // ≥6mm
        if (isSingle) {
          recommendation =
            "CT at 6-12 months, then CT every 2 years for 5 years";
          rationale =
            "Pure GGN ≥6mm may represent adenocarcinoma in situ or minimally invasive adenocarcinoma; long-term surveillance needed";
          followUpInterval = "6-12 months, then biennial for 5 years";
        } else {
          // Multiple GGN
          recommendation =
            "CT at 3-6 months; if stable, CT at 2 years and 4 years";
          rationale =
            "Multiple ground-glass nodules may represent multifocal adenocarcinoma spectrum; long-term follow-up needed";
          followUpInterval = "3-6 months, then 2 and 4 years";
        }
      }
      additionalNotes.push(
        "Pure GGN should be measured using lung window settings",
      );
    }
    // PART-SOLID NODULES
    else if (nodule_type === "part_solid") {
      if (size < 6) {
        recommendation = "No routine follow-up";
        rationale =
          "Part-solid nodules <6mm total size have very low likelihood of invasive component";
        followUpInterval = "None required";
      } else {
        // ≥6mm
        if (isSingle) {
          recommendation =
            "CT at 3-6 months to confirm persistence, then annual CT for 5 years";
          rationale =
            "Part-solid nodules have higher malignancy risk than pure GGN; solid component determines aggressiveness";
          followUpInterval = "3-6 months, then annual for 5 years";

          if (solidSize >= 6) {
            additionalNotes.push(
              `Solid component ≥6mm (${solidSize}mm): Consider PET/CT or biopsy if persistent`,
            );
          } else if (solidSize > 0) {
            additionalNotes.push(
              `Solid component <6mm (${solidSize}mm): Annual CT for minimum 5 years if nodule persists`,
            );
          }
        } else {
          // Multiple part-solid
          recommendation =
            "CT at 3-6 months; subsequent management based on most suspicious nodule";
          rationale =
            "Multiple part-solid nodules may represent synchronous primary adenocarcinomas";
          followUpInterval = "3-6 months, then based on dominant nodule";
        }
      }
      additionalNotes.push(
        "Solid component should be measured using mediastinal window settings",
      );
    }

    // Build risk factor summary
    const riskFactors = [];
    if (smoking === "current") riskFactors.push("Current smoker");
    if (smoking === "former") riskFactors.push("Former smoker");
    if (upper_lobe) riskFactors.push("Upper lobe location");
    if (spiculated) riskFactors.push("Spiculated/irregular margins");
    if (family_history) riskFactors.push("Family history of lung cancer");
    if (emphysema) riskFactors.push("Emphysema/pulmonary fibrosis");

    // Build result object
    const result = {
      Recommendation: recommendation,
      "Follow-up Interval": followUpInterval,
      Rationale: rationale,
      "Nodule Characteristics": `${nodule_type === "solid" ? "Solid" : nodule_type === "ground_glass" ? "Ground-glass" : "Part-solid"}, ${isSingle ? "single" : "multiple"}, ${size}mm`,
      "Risk Assessment": isHighRisk ? "High risk" : "Low risk",
    };

    if (riskFactors.length > 0) {
      result["Risk Factors Present"] = riskFactors.join(", ");
    }

    if (nodule_type === "part_solid" && solidSize > 0) {
      result["Solid Component"] = `${solidSize}mm`;
    }

    if (additionalNotes.length > 0) {
      result["Additional Notes"] = additionalNotes.join("; ");
    }

    // Add important caveats
    result["Important Caveats"] =
      "Guidelines apply to incidental nodules in adults ≥35 years. NOT for lung cancer screening, immunocompromised patients, or known malignancy.";

    if (recommendation.toLowerCase().includes("no routine follow-up"))
      result._severity = "success";
    else if (
      recommendation.toLowerCase().includes("pet") ||
      recommendation.toLowerCase().includes("biopsy") ||
      recommendation.toLowerCase().includes("tissue sampling")
    )
      result._severity = "danger";
    else result._severity = "warning";

    return result;
  },

  refs: [
    {
      t: "MacMahon H, Naidich DP, Goo JM, et al. Guidelines for Management of Incidental Pulmonary Nodules Detected on CT Images: From the Fleischner Society 2017. Radiology. 2017;284(1):228-243.",
      u: "https://doi.org/10.1148/radiol.2017161659",
    },
    {
      t: "Naidich DP, Bankier AA, MacMahon H, et al. Recommendations for the Management of Subsolid Pulmonary Nodules Detected at CT: A Statement from the Fleischner Society. Radiology. 2013;266(1):304-317.",
      u: "https://doi.org/10.1148/radiol.12120628",
    },
    {
      t: "MacMahon H, Austin JH, Gamsu G, et al. Guidelines for Management of Small Pulmonary Nodules Detected on CT Scans: A Statement from the Fleischner Society. Radiology. 2005;237(2):395-400.",
      u: "https://doi.org/10.1148/radiol.2372041887",
    },
    {
      t: "Bankier AA, MacMahon H, Goo JM, et al. Recommendations for Measuring Pulmonary Nodules at CT: A Statement from the Fleischner Society. Radiology. 2017;285(2):584-600.",
      u: "https://doi.org/10.1148/radiol.2017170044",
    },
    {
      t: "Callister ME, Baldwin DR, Akram AR, et al. British Thoracic Society guidelines for the investigation and management of pulmonary nodules. Thorax. 2015;70 Suppl 2:ii1-ii54.",
      u: "https://doi.org/10.1136/thoraxjnl-2015-207168",
    },
    {
      t: "American College of Radiology. Lung-RADS Assessment Categories v2022.",
      u: "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/Lung-Rads",
    },
  ],
};
