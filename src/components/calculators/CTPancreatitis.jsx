/**
 * CT Severity Index (CTSI) / Balthazar Score Calculator
 *
 * The CT Severity Index combines the Balthazar grade of acute pancreatitis
 * with pancreatic necrosis extent to predict morbidity and mortality.
 * Also known as the Modified CT Severity Index (MCTSI).
 *
 * Primary Sources:
 * - Balthazar EJ, et al. Radiology. 1985;156(3):767-772 (Original Balthazar grade)
 * - Balthazar EJ, et al. Radiology. 1990;174(2):331-336 (CTSI with necrosis)
 * - Mortele KJ, et al. Radiology. 2004;233(3):728-735 (Modified CTSI)
 */

export const CTPancreatitis = {
  id: "ct-pancreatitis",
  name: "CT Severity Index (CTSI)",
  desc: "Balthazar score with necrosis grading for acute pancreatitis severity",
  metaDesc:
    "Free CT Severity Index (CTSI) Calculator. Balthazar grade with pancreatic necrosis extent for acute pancreatitis severity assessment and prognosis.",

  info: {
    text: `The CT Severity Index (CTSI) combines the Balthazar CT grade with pancreatic necrosis extent to predict acute pancreatitis severity.

BALTHAZAR GRADE (0-4 points):
• Grade A (0 pts): Normal pancreas
• Grade B (1 pt): Pancreatic enlargement only
• Grade C (2 pts): Peripancreatic fat stranding
• Grade D (3 pts): Single peripancreatic fluid collection
• Grade E (4 pts): ≥2 fluid collections or gas in/around pancreas

NECROSIS SCORE (0-6 points):
• None (0 pts): No necrosis
• ≤30% (2 pts): Minor necrosis
• 30-50% (4 pts): Moderate necrosis
• >50% (6 pts): Extensive necrosis

CTSI = Balthazar Grade + Necrosis Score (0-10 points)

Severity Categories:
• Mild (0-3): 3% morbidity, 3% mortality
• Moderate (4-6): 35% morbidity, 6% mortality
• Severe (7-10): 92% morbidity, 17% mortality

Note: CT should be performed 48-72 hours after symptom onset for accurate necrosis assessment.`,
    link: {
      label: "View Balthazar CT Classification",
      url: "https://radiopaedia.org/articles/ct-severity-index-acute-pancreatitis",
    },
  },

  fields: [
    // TIMING
    {
      id: "timing",
      label: "Time from symptom onset",
      type: "radio",
      opts: [
        {
          value: "early",
          label: "<48 hours (early - necrosis may not be visible)",
        },
        { value: "optimal", label: "48-72 hours (optimal timing for CTSI)" },
        { value: "late", label: ">72 hours" },
      ],
    },

    // BALTHAZAR GRADE
    {
      id: "balthazar_grade",
      label: "Balthazar CT Grade",
      type: "radio",
      opts: [
        { value: "A", label: "Grade A - Normal pancreas (0 points)" },
        {
          value: "B",
          label: "Grade B - Focal or diffuse pancreatic enlargement (1 point)",
        },
        {
          value: "C",
          label:
            "Grade C - Peripancreatic fat stranding/inflammatory changes (2 points)",
        },
        {
          value: "D",
          label: "Grade D - Single peripancreatic fluid collection (3 points)",
        },
        {
          value: "E",
          label:
            "Grade E - ≥2 fluid collections or retroperitoneal gas (4 points)",
        },
      ],
    },

    // PANCREATIC NECROSIS
    {
      id: "necrosis_extent",
      label: "Pancreatic Necrosis Extent",
      subLabel: "Non-enhancing pancreatic parenchyma on contrast-enhanced CT",
      type: "radio",
      opts: [
        {
          value: "none",
          label: "No necrosis - pancreas enhances normally (0 points)",
        },
        { value: "30", label: "≤30% necrosis (2 points)" },
        { value: "50", label: "30-50% necrosis (4 points)" },
        { value: "over50", label: ">50% necrosis (6 points)" },
      ],
    },

    // EXTRAPANCREATIC COMPLICATIONS (for Modified CTSI)
    {
      id: "extrapancreatic",
      label: "Extrapancreatic Complications (Modified CTSI)",
      subLabel: "Select all that apply",
      type: "radio",
      opts: [
        { value: "none", label: "None" },
        {
          value: "one_or_more",
          label:
            "One or more: Ascites, pleural effusion, vascular/GI complications",
        },
      ],
    },
  ],

  compute: (vals) => {
    const {
      timing = "",
      balthazar_grade = "",
      necrosis_extent = "",
      extrapancreatic = "none",
    } = vals;

    // Validate required fields
    if (!balthazar_grade) {
      return {
        Error: "Please select a Balthazar CT grade.",
      };
    }

    if (!necrosis_extent) {
      return {
        Error: "Please select pancreatic necrosis extent.",
      };
    }

    // Calculate Balthazar grade points
    const balthazarPoints = {
      A: 0,
      B: 1,
      C: 2,
      D: 3,
      E: 4,
    };
    const gradePoints = balthazarPoints[balthazar_grade];

    // Calculate necrosis points
    const necrosisPoints = {
      none: 0,
      30: 2,
      50: 4,
      over50: 6,
    };
    const necPoints = necrosisPoints[necrosis_extent];

    // Calculate CTSI (Original)
    const ctsi = gradePoints + necPoints;

    // Calculate Modified CTSI (adds extrapancreatic complications)
    const extrapancreaticPoints = extrapancreatic === "one_or_more" ? 2 : 0;
    const mctsi = gradePoints + necPoints + extrapancreaticPoints;

    // Determine severity category (Original CTSI)
    let severity = "";
    let morbidityRisk = "";
    let mortalityRisk = "";

    if (ctsi <= 3) {
      severity = "Mild";
      morbidityRisk = "~8%";
      mortalityRisk = "~3%";
    } else if (ctsi <= 6) {
      severity = "Moderate";
      morbidityRisk = "~35%";
      mortalityRisk = "~6%";
    } else {
      severity = "Severe";
      morbidityRisk = "~92%";
      mortalityRisk = "~17%";
    }

    // Modified CTSI severity
    let mctsiSeverity = "";
    if (mctsi <= 2) {
      mctsiSeverity = "Mild";
    } else if (mctsi <= 4) {
      mctsiSeverity = "Moderate";
    } else {
      mctsiSeverity = "Severe";
    }

    // Necrosis type description
    const necrosisDescriptions = {
      none: "Interstitial edematous pancreatitis",
      30: "Necrotizing pancreatitis (minor)",
      50: "Necrotizing pancreatitis (moderate)",
      over50: "Necrotizing pancreatitis (extensive)",
    };

    // Build result
    const result = {
      "CT Severity Index (CTSI)": `${ctsi} points - ${severity}`,
      "Balthazar Grade": `Grade ${balthazar_grade} (${gradePoints} points)`,
      "Necrosis Score": `${necPoints} points (${necrosis_extent === "none" ? "none" : necrosis_extent === "30" ? "≤30%" : necrosis_extent === "50" ? "30-50%" : ">50%"})`,
      "Pancreatitis Type": necrosisDescriptions[necrosis_extent],
      "Morbidity Risk": morbidityRisk,
      "Mortality Risk": mortalityRisk,
    };

    // Add Modified CTSI
    result["Modified CTSI"] = `${mctsi} points - ${mctsiSeverity}`;
    if (extrapancreatic === "one_or_more") {
      result["Extrapancreatic Complications"] = "Present (+2 points)";
    }

    // Clinical implications
    const implications = [];

    if (necPoints === 0) {
      implications.push(
        "Interstitial edematous pancreatitis typically resolves within 1-2 weeks",
      );
      implications.push("Low risk of infected necrosis or organ failure");
    } else {
      implications.push(
        "Necrotizing pancreatitis requires close monitoring for infection",
      );
      implications.push("Consider repeat imaging if clinical deterioration");
    }

    if (necPoints >= 4) {
      implications.push(
        "High risk of infected necrosis (~30-40% with >30% necrosis)",
      );
      implications.push("Consider ICU admission and early nutrition support");
      implications.push(
        "Surgical/interventional consultation may be needed for infected necrosis",
      );
    }

    if (balthazar_grade === "E") {
      implications.push(
        "Multiple fluid collections may evolve into walled-off necrosis (WON) or pseudocysts",
      );
      implications.push("Gas in collections suggests infected necrosis");
    }

    if (implications.length > 0) {
      result["Clinical Implications"] = implications.join("; ");
    }

    // Timing warnings
    if (timing === "early") {
      result["Timing Note"] =
        "CT performed <48 hours may underestimate necrosis extent. Consider repeat CT at 48-72 hours if clinical concern for severe pancreatitis.";
    }

    // Atlanta Classification integration
    let atlantaSeverity = "Mild acute pancreatitis";
    if (necPoints > 0 || extrapancreatic === "one_or_more") {
      if (ctsi >= 7 || mctsi >= 6) {
        atlantaSeverity =
          "Severe acute pancreatitis (persistent organ failure likely)";
      } else {
        atlantaSeverity =
          "Moderately severe acute pancreatitis (local complications, transient organ failure)";
      }
    }
    result["Revised Atlanta Classification"] = atlantaSeverity;

    return result;
  },

  refs: [
    {
      t: "Balthazar EJ, Ranson JH, Naidich DP, et al. Acute pancreatitis: prognostic value of CT. Radiology. 1985;156(3):767-772.",
      u: "https://doi.org/10.1148/radiology.156.3.4023241",
    },
    {
      t: "Balthazar EJ, Robinson DL, Megibow AJ, Ranson JH. Acute pancreatitis: value of CT in establishing prognosis. Radiology. 1990;174(2):331-336.",
      u: "https://doi.org/10.1148/radiology.174.2.2296641",
    },
    {
      t: "Mortele KJ, Wiesner W, Intriere L, et al. A modified CT severity index for evaluating acute pancreatitis: improved correlation with patient outcome. AJR Am J Roentgenol. 2004;183(5):1261-1265.",
      u: "https://doi.org/10.2214/ajr.183.5.1831261",
    },
    {
      t: "Banks PA, Bollen TL, Dervenis C, et al. Classification of acute pancreatitis—2012: revision of the Atlanta classification and definitions by international consensus. Gut. 2013;62(1):102-111.",
      u: "https://doi.org/10.1136/gutjnl-2012-302779",
    },
    {
      t: "Defined guidelines Working Group: ACR Appropriateness Criteria - Acute Pancreatitis. J Am Coll Radiol. 2019;16(5S):S427-S440.",
      u: "https://doi.org/10.1016/j.jacr.2019.02.013",
    },
  ],
};
