/**
 * ACR TI-RADS Calculator
 * Thyroid Imaging Reporting and Data System
 *
 * ACR TI-RADS is a standardized risk stratification system for thyroid nodules
 * based on ultrasound features. It uses a point-based system to assign categories
 * (TR1-TR5) with corresponding FNA and follow-up recommendations.
 *
 * Primary Sources:
 * - Tessler FN, et al. J Am Coll Radiol. 2017;14(5):587-595 (ACR TI-RADS White Paper)
 * - Grant EG, et al. Thyroid. 2015;25(6):567-574 (ACR TI-RADS)
 * - Middleton WD, et al. Radiology. 2017;285(1):274-281 (Validation Study)
 */

const COMPOSITION_ONLY_FIELDS = [
  "echogenicity",
  "shape",
  "margin",
  "echogenic_foci_none",
  "echogenic_foci_macro",
  "echogenic_foci_peripheral",
  "echogenic_foci_punctate",
];

const COMPOSITION_VALUES = ["cystic", "spongiform", "mixed", "solid", "cannot_determine"];
const ECHOGENICITY_VALUES = [
  "anechoic",
  "hyperechoic",
  "hypoechoic",
  "very_hypoechoic",
  "cannot_determine",
];
const SHAPE_VALUES = ["wider", "taller"];
const MARGIN_VALUES = ["smooth", "ill_defined", "lobulated", "ete"];
const ECHOGENIC_FOCI_FIELDS = [
  "echogenic_foci_none",
  "echogenic_foci_macro",
  "echogenic_foci_peripheral",
  "echogenic_foci_punctate",
];

const GUIDANCE_SCOPE =
  "Standard initial ACR TI-RADS guidance for an adult thyroid nodule. Prior biopsy or treatment, PET avidity, suspected invasive disease, and patient-specific clinical context may require a different approach. This calculator does not assess longitudinal growth or prioritize multiple nodules.";

const isCompositionOnly = (composition) =>
  composition === "cystic" || composition === "spongiform";

const positiveNumberPattern = /^[+]?\d*\.?\d+(?:[eE][+-]?\d+)?$/;
const hasInputValue = (value) => value !== undefined && value !== null && value !== "";

function parseNoduleSize(value) {
  if (value === undefined || value === null) return { value: null };
  if (typeof value === "string" && value.trim() === "") return { value: null };

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) {
      return { error: "Nodule size must be a finite positive number or blank." };
    }
    return { value };
  }

  if (typeof value !== "string" || !positiveNumberPattern.test(value.trim())) {
    return { error: "Nodule size must be a finite positive number or blank." };
  }

  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { error: "Nodule size must be a finite positive number or blank." };
  }
  return { value: parsed };
}

function validateEchogenicFoci(vals) {
  if (Object.prototype.hasOwnProperty.call(vals, "echogenic_foci")) {
    return {
      error:
        "Echogenic foci require the explicit checkboxes; the legacy single-value field is unsupported.",
    };
  }

  const foci = Object.fromEntries(
    ECHOGENIC_FOCI_FIELDS.map((field) => [
      field,
      vals[field] === undefined || vals[field] === "" ? false : vals[field],
    ]),
  );
  for (const field of ECHOGENIC_FOCI_FIELDS) {
    if (typeof foci[field] !== "boolean") {
      return {
        error: "Echogenic foci must be selected explicitly with boolean options.",
      };
    }
  }

  const scored = [
    foci.echogenic_foci_macro,
    foci.echogenic_foci_peripheral,
    foci.echogenic_foci_punctate,
  ];
  if (foci.echogenic_foci_none && scored.some(Boolean)) {
    return {
      error:
        "Echogenic foci options are exclusive: choose no scored foci/artifacts only or the scored foci present.",
    };
  }
  if (!foci.echogenic_foci_none && !scored.some(Boolean)) {
    return {
      error: "Select the echogenic foci present, or choose no scored foci/artifacts only.",
    };
  }

  return {
    points:
      (foci.echogenic_foci_macro ? 1 : 0) +
      (foci.echogenic_foci_peripheral ? 2 : 0) +
      (foci.echogenic_foci_punctate ? 3 : 0),
    punctate: foci.echogenic_foci_punctate,
  };
}

function buildResult({
  category,
  categoryName,
  groupRisk,
  totalScore,
  pointBreakdown,
  fnaRecommendation,
  followUpRecommendation,
  size,
  notes = [],
}) {
  const result = {
    "TI-RADS Category": `${category} - ${categoryName}`,
    "Total Points": `${totalScore} points`,
    "Point Breakdown": pointBreakdown,
    "Source-reported group risk estimate": `${groupRisk} (source-reported group estimate; not an individual probability)`,
    "Guidance Scope": GUIDANCE_SCOPE,
    "FNA Recommendation": fnaRecommendation,
  };

  if (followUpRecommendation) {
    result["Follow-up Recommendation"] = followUpRecommendation;
  }
  if (size !== null) result["Nodule Size"] = `${size} cm`;
  if (notes.length > 0) result["Clinical Notes"] = notes.join("; ");

  result._severity =
    category === "TR1" || category === "TR2"
      ? "success"
      : category === "TR3"
        ? "warning"
        : "danger";
  return result;
}

export const TIRADS = {
  id: "tirads",
  category: "Radiology",
  name: "ACR TI-RADS",
  desc: "Thyroid Imaging Reporting and Data System for thyroid nodule risk stratification",
  guidelineVersion: "ACR TI-RADS 2017",
  keywords: ["thyroid", "nodule", "thyroid nodule", "FNA", "biopsy", "ACR"],
  tags: ["Radiology", "Endocrinology", "Thyroid"],
  metaDesc:
    "Free ACR TI-RADS Calculator. Thyroid nodule risk stratification based on ultrasound features with FNA recommendations. Evidence-based thyroid imaging reporting.",

  info: {
    text: `ACR TI-RADS (Thyroid Imaging Reporting and Data System) is a standardized system for assessing thyroid nodules on ultrasound.

For adult thyroid nodules; prior biopsy results and patient-specific clinical context can alter management. ${GUIDANCE_SCOPE}

The system assigns points based on 5 ultrasound feature categories:
• Composition (0-2 points)
• Echogenicity (0-3 points)
• Shape (0-3 points)
• Margin (0-3 points)
• Echogenic Foci (0-6 points when multiple scored foci coexist)

Total points determine the TI-RADS category (TR1-TR5), which guides FNA recommendations based on nodule size. Risk values below are source-reported group estimates, not individual probabilities.

This calculator follows the 2017 ACR TI-RADS guidelines.`,
    link: {
      label: "View ACR TI-RADS White Paper",
      url: "https://doi.org/10.1016/j.jacr.2017.01.046",
    },
  },

  fields: [
    // SECTION 1: COMPOSITION
    {
      id: "composition",
      label: "Composition",
      type: "radio",
      clearOnChange: COMPOSITION_ONLY_FIELDS,
      opts: [
        {
          value: "cystic",
          label: "Cystic or almost completely cystic (0 pts)",
        },
        { value: "spongiform", label: "Spongiform (0 pts)" },
        { value: "mixed", label: "Mixed cystic and solid (1 pt)" },
        { value: "solid", label: "Solid or almost completely solid (2 pts)" },
        { value: "cannot_determine", label: "Cannot determine composition — score as solid (2 pts)" },
      ],
    },

    // SECTION 2: ECHOGENICITY
    {
      id: "echogenicity",
      label: "Echogenicity",
      type: "radio",
      showIf: (vals) => !isCompositionOnly(vals.composition),
      opts: [
        { value: "anechoic", label: "Anechoic (0 pts)" },
        {
          value: "hyperechoic",
          label: "Hyperechoic or isoechoic (1 pt)",
        },
        { value: "hypoechoic", label: "Hypoechoic (2 pts)" },
        { value: "very_hypoechoic", label: "Very hypoechoic (3 pts)" },
        { value: "cannot_determine", label: "Cannot determine echogenicity — score as isoechoic (1 pt)" },
      ],
    },

    // SECTION 3: SHAPE
    {
      id: "shape",
      label: "Shape",
      type: "radio",
      showIf: (vals) => !isCompositionOnly(vals.composition),
      opts: [
        { value: "wider", label: "Wider-than-tall (0 pts)" },
        { value: "taller", label: "Taller-than-wide (3 pts)" },
      ],
    },

    // SECTION 4: MARGIN
    {
      id: "margin",
      label: "Margin",
      type: "radio",
      showIf: (vals) => !isCompositionOnly(vals.composition),
      opts: [
        { value: "smooth", label: "Smooth (0 pts)" },
        { value: "ill_defined", label: "Ill-defined (0 pts)" },
        { value: "lobulated", label: "Lobulated or irregular (2 pts)" },
        { value: "ete", label: "Extrathyroidal extension (3 pts)" },
      ],
    },

    // SECTION 5: ECHOGENIC FOCI
    {
      id: "echogenic_foci_none",
      label: "No scored echogenic foci / large comet-tail artifacts only (0 pts)",
      type: "checkbox",
      showIf: (vals) => !isCompositionOnly(vals.composition),
    },
    {
      id: "echogenic_foci_macro",
      label: "Macrocalcifications (1 pt)",
      type: "checkbox",
      showIf: (vals) => !isCompositionOnly(vals.composition),
    },
    {
      id: "echogenic_foci_peripheral",
      label: "Peripheral (rim) calcifications (2 pts)",
      type: "checkbox",
      showIf: (vals) => !isCompositionOnly(vals.composition),
    },
    {
      id: "echogenic_foci_punctate",
      label: "Punctate echogenic foci (3 pts)",
      type: "checkbox",
      showIf: (vals) => !isCompositionOnly(vals.composition),
    },

    // SECTION 6: NODULE SIZE (for FNA recommendations)
    {
      id: "nodule_size",
      label: "Maximum Nodule Dimension (cm)",
      type: "number",
      subLabel: "Largest diameter in any plane",
    },
  ],

  compute: (vals) => {
    const {
      composition = "",
      echogenicity = "",
      shape = "",
      margin = "",
      nodule_size = "",
    } = vals || {};

    const sizeResult = parseNoduleSize(nodule_size);
    if (sizeResult.error) return { Error: sizeResult.error };
    const size = sizeResult.value;

    if (Object.prototype.hasOwnProperty.call(vals || {}, "echogenic_foci")) {
      return {
        Error:
          "Echogenic foci require the explicit checkboxes; the legacy single-value field is unsupported.",
      };
    }

    if (!composition) {
      return { Error: "Please complete the composition assessment to calculate TI-RADS." };
    }
    if (!COMPOSITION_VALUES.includes(composition)) {
      return { Error: "Invalid composition; reassess the ultrasound features." };
    }

    if (isCompositionOnly(composition)) {
      if (hasInputValue(echogenicity) && !ECHOGENICITY_VALUES.includes(echogenicity)) {
        return { Error: "Invalid echogenicity; reassess the ultrasound features." };
      }
      if (hasInputValue(shape) && !SHAPE_VALUES.includes(shape)) {
        return { Error: "Invalid shape; reassess the ultrasound features." };
      }
      if (hasInputValue(margin) && !MARGIN_VALUES.includes(margin)) {
        return { Error: "Invalid margin; reassess the ultrasound features." };
      }
      const suspiciousResidual =
        hasInputValue(margin) && !["smooth", "ill_defined"].includes(margin);
      if (suspiciousResidual) {
        return {
          Error:
            "Reassess composition: cystic or spongiform nodules cannot retain suspicious residual feature selections.",
        };
      }

      const hasScoredOrInvalidFoci = ECHOGENIC_FOCI_FIELDS.some((field) => {
        const value = vals?.[field];
        return value === true || (value !== undefined && value !== "" && typeof value !== "boolean");
      });
      if (hasScoredOrInvalidFoci) {
        const fociResult = validateEchogenicFoci(vals || {});
        if (fociResult.error || fociResult.points !== 0) {
          return {
            Error:
              "Reassess composition: cystic or spongiform nodules cannot retain suspicious residual echogenic foci.",
          };
        }
      }

      return buildResult({
        category: "TR1",
        categoryName: "Benign",
        groupRisk: "<=2%",
        totalScore: 0,
        pointBreakdown: "Composition: 0 | Echogenicity: 0 | Shape: 0 | Margin: 0 | Echogenic Foci: 0",
        fnaRecommendation: "No FNA recommended",
        followUpRecommendation: "No routine TI-RADS follow-up recommended",
        size,
        notes:
          composition === "spongiform"
            ? [
                "Spongiform composition is a benign feature (aggregation of multiple microcystic components)",
              ]
            : [],
      });
    }

    if (!echogenicity || !shape || !margin) {
      return {
        Error: "Please complete all ultrasound feature assessments to calculate TI-RADS category.",
      };
    }
    if (!ECHOGENICITY_VALUES.includes(echogenicity)) {
      return { Error: "Invalid echogenicity; reassess the ultrasound features." };
    }
    if (!SHAPE_VALUES.includes(shape)) {
      return { Error: "Invalid shape; reassess the ultrasound features." };
    }
    if (!MARGIN_VALUES.includes(margin)) {
      return { Error: "Invalid margin; reassess the ultrasound features." };
    }
    if (echogenicity === "anechoic") {
      return {
        Error:
          "Reassess composition and echogenicity: anechoic applies to cystic or almost completely cystic nodules.",
      };
    }

    const fociResult = validateEchogenicFoci(vals || {});
    if (fociResult.error) return { Error: fociResult.error };

    const compositionPts = { mixed: 1, solid: 2, cannot_determine: 2 }[composition];
    const echogenicityPts = {
      hyperechoic: 1,
      hypoechoic: 2,
      very_hypoechoic: 3,
      cannot_determine: 1,
    }[echogenicity];
    const shapePts = shape === "taller" ? 3 : 0;
    const marginPts =
      margin === "lobulated" ? 2 : margin === "ete" ? 3 : 0;
    const totalScore =
      compositionPts + echogenicityPts + shapePts + marginPts + fociResult.points;

    const category =
      totalScore === 0
        ? { id: "TR1", name: "Benign", groupRisk: "<=2%" }
        : totalScore === 2
          ? { id: "TR2", name: "Not Suspicious", groupRisk: "<=2%" }
          : totalScore === 3
            ? { id: "TR3", name: "Mildly Suspicious", groupRisk: "5%" }
            : totalScore >= 4 && totalScore <= 6
              ? { id: "TR4", name: "Moderately Suspicious", groupRisk: "5-20%" }
              : totalScore >= 7
                ? { id: "TR5", name: "Highly Suspicious", groupRisk: ">=20%" }
                : null;
    if (!category) {
      return {
        Error:
          "Unable to assign a TI-RADS category for this score; reassess the ultrasound features.",
      };
    }

    const thresholds = {
      TR3: { fna: 2.5, follow: 1.5, schedule: "Follow-up at 1, 3, and 5 years" },
      TR4: { fna: 1.5, follow: 1.0, schedule: "Follow-up at 1, 2, 3, and 5 years" },
      TR5: { fna: 1.0, follow: 0.5, schedule: "Annual follow-up for up to 5 years" },
    };
    let fnaRecommendation = "No FNA recommended";
    let followUpRecommendation =
      category.id === "TR1" || category.id === "TR2"
        ? "No routine TI-RADS follow-up recommended"
        : "";
    if (thresholds[category.id]) {
      const { fna, follow, schedule } = thresholds[category.id];
      const fnaLabel = fna.toFixed(1);
      const followLabel = follow.toFixed(1);
      if (size === null) {
        fnaRecommendation =
          `FNA at >=${fnaLabel} cm; surveillance at >=${followLabel} cm; no routine TI-RADS follow-up below ${followLabel} cm`;
      } else if (size >= fna) {
        fnaRecommendation = `FNA recommended (>=${fnaLabel} cm)`;
      } else if (size >= follow) {
        fnaRecommendation = `No FNA recommended (<${fnaLabel} cm)`;
        followUpRecommendation = schedule;
      } else {
        fnaRecommendation =
          `No FNA or routine TI-RADS follow-up recommended (<${followLabel} cm)`;
      }
    }

    const notes = [];
    if (composition === "cannot_determine") {
      notes.push("Composition cannot be determined; scored as solid (2 points) per ACR guidance, not an observed solid appearance");
    }
    if (echogenicity === "cannot_determine") {
      notes.push("Echogenicity cannot be determined; scored as isoechoic (1 point) per ACR guidance, not an observed isoechoic appearance");
    }
    if (margin === "ete") {
      notes.push("Extrathyroidal extension is highly suspicious for malignancy");
    }
    if (fociResult.punctate) {
      notes.push(
        "Punctate echogenic foci may represent psammomatous calcifications, associated with papillary thyroid carcinoma",
      );
    }
    if (shape === "taller") {
      notes.push(
        "Taller-than-wide shape suggests growth across tissue planes, suspicious for malignancy",
      );
    }
    if (echogenicity === "very_hypoechoic") {
      notes.push("Very hypoechoic (darker than strap muscles) is highly suspicious");
    }

    return buildResult({
      category: category.id,
      categoryName: category.name,
      groupRisk: category.groupRisk,
      totalScore,
      pointBreakdown: `Composition: ${compositionPts} | Echogenicity: ${echogenicityPts} | Shape: ${shapePts} | Margin: ${marginPts} | Echogenic Foci: ${fociResult.points}`,
      fnaRecommendation,
      followUpRecommendation,
      size,
      notes,
    });
  },

  refs: [
    {
      t: "Tessler FN, Middleton WD, Grant EG, et al. ACR Thyroid Imaging, Reporting and Data System (TI-RADS): White Paper of the ACR TI-RADS Committee. J Am Coll Radiol. 2017;14(5):587-595.",
      u: "https://doi.org/10.1016/j.jacr.2017.01.046",
    },
    {
      t: "Grant EG, Tessler FN, Hoang JK, et al. Thyroid Ultrasound Reporting Lexicon: White Paper of the ACR Thyroid Imaging, Reporting and Data System (TIRADS) Committee. J Am Coll Radiol. 2015;12(12):1272-1279.",
      u: "https://doi.org/10.1016/j.jacr.2015.07.011",
    },
    {
      t: "Middleton WD, Teefey SA, Reading CC, et al. Multiinstitutional Analysis of Thyroid Nodule Risk Stratification Using the American College of Radiology Thyroid Imaging Reporting and Data System. AJR Am J Roentgenol. 2017;208(6):1331-1341.",
      u: "https://doi.org/10.2214/AJR.16.17613",
    },
    {
      t: "Hoang JK, Middleton WD, Farjat AE, et al. Reduction in Thyroid Nodule Biopsies and Improved Accuracy with American College of Radiology Thyroid Imaging Reporting and Data System. Radiology. 2018;287(1):185-193.",
      u: "https://doi.org/10.1148/radiol.2018172572",
    },
    {
      t: "Haugen BR, Alexander EK, Bible KC, et al. 2015 American Thyroid Association Management Guidelines for Adult Patients with Thyroid Nodules and Differentiated Thyroid Cancer. Thyroid. 2016;26(1):1-133.",
      u: "https://doi.org/10.1089/thy.2015.0020",
    },
    {
      t: "ACR TI-RADS Calculator and Resources - American College of Radiology",
      u: "https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/TI-RADS",
    },
  ],
};
