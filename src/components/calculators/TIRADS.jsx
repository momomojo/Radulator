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

export const TIRADS = {
  id: "tirads",
  category: "Radiology",
  name: "ACR TI-RADS",
  desc: "Thyroid Imaging Reporting and Data System for thyroid nodule risk stratification",
  keywords: ["thyroid", "nodule", "thyroid nodule", "FNA", "biopsy", "ACR"],
  tags: ["Radiology", "Endocrinology", "Thyroid"],
  metaDesc:
    "Free ACR TI-RADS Calculator. Thyroid nodule risk stratification based on ultrasound features with FNA recommendations. Evidence-based thyroid imaging reporting.",

  info: {
    text: `ACR TI-RADS (Thyroid Imaging Reporting and Data System) is a standardized system for assessing thyroid nodules on ultrasound.

The system assigns points based on 5 ultrasound feature categories:
• Composition (0-2 points)
• Echogenicity (0-3 points)
• Shape (0-3 points)
• Margin (0-3 points)
• Echogenic Foci (0-3 points)

Total points determine the TI-RADS category (TR1-TR5), which guides FNA recommendations based on nodule size.

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
      opts: [
        {
          value: "cystic",
          label: "Cystic or almost completely cystic (0 pts)",
        },
        { value: "spongiform", label: "Spongiform (0 pts)" },
        { value: "mixed", label: "Mixed cystic and solid (1 pt)" },
        { value: "solid", label: "Solid or almost completely solid (2 pts)" },
      ],
    },

    // SECTION 2: ECHOGENICITY
    {
      id: "echogenicity",
      label: "Echogenicity",
      type: "radio",
      opts: [
        { value: "anechoic", label: "Anechoic (0 pts)" },
        {
          value: "hyperechoic",
          label: "Hyperechoic or isoechoic (1 pt)",
        },
        { value: "hypoechoic", label: "Hypoechoic (2 pts)" },
        { value: "very_hypoechoic", label: "Very hypoechoic (3 pts)" },
      ],
    },

    // SECTION 3: SHAPE
    {
      id: "shape",
      label: "Shape",
      type: "radio",
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
      opts: [
        { value: "smooth", label: "Smooth (0 pts)" },
        { value: "ill_defined", label: "Ill-defined (0 pts)" },
        { value: "lobulated", label: "Lobulated or irregular (2 pts)" },
        { value: "ete", label: "Extrathyroidal extension (3 pts)" },
      ],
    },

    // SECTION 5: ECHOGENIC FOCI
    {
      id: "echogenic_foci",
      label: "Echogenic Foci (select the highest point value present)",
      type: "radio",
      opts: [
        {
          value: "none",
          label: "None or large comet-tail artifacts (0 pts)",
        },
        { value: "macro", label: "Macrocalcifications (1 pt)" },
        {
          value: "peripheral",
          label: "Peripheral (rim) calcifications (2 pts)",
        },
        { value: "punctate", label: "Punctate echogenic foci (3 pts)" },
      ],
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
      echogenic_foci = "",
      nodule_size = "",
    } = vals;

    // Validate required fields
    if (!composition || !echogenicity || !shape || !margin || !echogenic_foci) {
      return {
        Error:
          "Please complete all ultrasound feature assessments to calculate TI-RADS category.",
      };
    }

    // Calculate points for each category
    let compositionPts = 0;
    let echogenicityPts = 0;
    let shapePts = 0;
    let marginPts = 0;
    let echogenicFociPts = 0;

    // Composition scoring
    switch (composition) {
      case "cystic":
      case "spongiform":
        compositionPts = 0;
        break;
      case "mixed":
        compositionPts = 1;
        break;
      case "solid":
        compositionPts = 2;
        break;
    }

    // Echogenicity scoring
    switch (echogenicity) {
      case "anechoic":
        echogenicityPts = 0;
        break;
      case "hyperechoic":
        echogenicityPts = 1;
        break;
      case "hypoechoic":
        echogenicityPts = 2;
        break;
      case "very_hypoechoic":
        echogenicityPts = 3;
        break;
    }

    // Shape scoring
    switch (shape) {
      case "wider":
        shapePts = 0;
        break;
      case "taller":
        shapePts = 3;
        break;
    }

    // Margin scoring
    switch (margin) {
      case "smooth":
      case "ill_defined":
        marginPts = 0;
        break;
      case "lobulated":
        marginPts = 2;
        break;
      case "ete":
        marginPts = 3;
        break;
    }

    // Echogenic foci scoring (highest value, not additive)
    switch (echogenic_foci) {
      case "none":
        echogenicFociPts = 0;
        break;
      case "macro":
        echogenicFociPts = 1;
        break;
      case "peripheral":
        echogenicFociPts = 2;
        break;
      case "punctate":
        echogenicFociPts = 3;
        break;
    }

    // Calculate total score
    const totalScore =
      compositionPts +
      echogenicityPts +
      shapePts +
      marginPts +
      echogenicFociPts;

    // Determine TI-RADS category
    let category = "";
    let categoryName = "";
    let malignancyRisk = "";

    if (totalScore === 0) {
      category = "TR1";
      categoryName = "Benign";
      malignancyRisk = "<2%";
    } else if (totalScore === 2) {
      category = "TR2";
      categoryName = "Not Suspicious";
      malignancyRisk = "<2%";
    } else if (totalScore === 3) {
      category = "TR3";
      categoryName = "Mildly Suspicious";
      malignancyRisk = "~5%";
    } else if (totalScore >= 4 && totalScore <= 6) {
      category = "TR4";
      categoryName = "Moderately Suspicious";
      malignancyRisk = "5-20%";
    } else if (totalScore >= 7) {
      category = "TR5";
      categoryName = "Highly Suspicious";
      malignancyRisk = ">20%";
    } else {
      // Score of 1 (edge case)
      category = "TR2";
      categoryName = "Not Suspicious";
      malignancyRisk = "<2%";
    }

    // Determine FNA recommendation based on category and size
    const size = parseFloat(nodule_size) || 0;
    let fnaRecommendation = "";
    let followUpRecommendation = "";

    if (category === "TR1") {
      fnaRecommendation = "No FNA recommended";
      followUpRecommendation = "No follow-up needed for benign nodules";
    } else if (category === "TR2") {
      fnaRecommendation = "No FNA recommended";
      followUpRecommendation = "No follow-up needed";
    } else if (category === "TR3") {
      if (size >= 2.5) {
        fnaRecommendation = "FNA recommended (≥2.5 cm)";
      } else if (size >= 1.5) {
        fnaRecommendation = "Follow recommended; FNA optional";
        followUpRecommendation = "Follow at 1, 2, 3, and 5 years";
      } else if (size > 0) {
        fnaRecommendation = "No FNA recommended (<1.5 cm)";
        followUpRecommendation =
          "Consider follow-up if clinical concern; otherwise not required";
      } else {
        fnaRecommendation =
          "FNA if ≥2.5 cm; Follow if ≥1.5 cm; No FNA if <1.5 cm";
      }
    } else if (category === "TR4") {
      if (size >= 1.5) {
        fnaRecommendation = "FNA recommended (≥1.5 cm)";
      } else if (size >= 1.0) {
        fnaRecommendation = "Follow recommended; FNA optional";
        followUpRecommendation = "Follow at 1, 2, 3, and 5 years";
      } else if (size > 0) {
        fnaRecommendation = "No FNA recommended (<1.0 cm)";
        followUpRecommendation =
          "Consider follow-up if clinical concern; otherwise not required";
      } else {
        fnaRecommendation =
          "FNA if ≥1.5 cm; Follow if ≥1.0 cm; No FNA if <1.0 cm";
      }
    } else if (category === "TR5") {
      if (size >= 1.0) {
        fnaRecommendation = "FNA recommended (≥1.0 cm)";
      } else if (size >= 0.5) {
        fnaRecommendation = "Follow recommended; FNA optional";
        followUpRecommendation = "Annual follow-up recommended";
      } else if (size > 0) {
        fnaRecommendation = "No FNA recommended (<0.5 cm)";
        followUpRecommendation =
          "Consider follow-up; observation reasonable for very small nodules";
      } else {
        fnaRecommendation =
          "FNA if ≥1.0 cm; Follow if ≥0.5 cm; No FNA if <0.5 cm";
      }
    }

    // Build point breakdown
    const pointBreakdown = `Composition: ${compositionPts} | Echogenicity: ${echogenicityPts} | Shape: ${shapePts} | Margin: ${marginPts} | Echogenic Foci: ${echogenicFociPts}`;

    // Build result object
    const result = {
      "TI-RADS Category": `${category} - ${categoryName}`,
      "Total Points": `${totalScore} points`,
      "Point Breakdown": pointBreakdown,
      "Estimated Malignancy Risk": malignancyRisk,
      "FNA Recommendation": fnaRecommendation,
    };

    // Add follow-up if applicable
    if (followUpRecommendation) {
      result["Follow-up Recommendation"] = followUpRecommendation;
    }

    // Add size-based context
    if (size > 0) {
      result["Nodule Size"] = `${size} cm`;
    }

    // Add clinical notes for specific findings
    const notes = [];

    if (composition === "spongiform") {
      notes.push(
        "Spongiform composition is a benign feature (aggregation of multiple microcystic components)",
      );
    }

    if (margin === "ete") {
      notes.push(
        "Extrathyroidal extension is highly suspicious for malignancy and may indicate T3/T4 disease",
      );
    }

    if (echogenic_foci === "punctate") {
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
      notes.push(
        "Very hypoechoic (darker than strap muscles) is highly suspicious",
      );
    }

    if (notes.length > 0) {
      result["Clinical Notes"] = notes.join("; ");
    }

    return result;
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
      u: "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/TI-RADS",
    },
  ],
};
