/**
 * AAST Trauma Grading Calculator
 * American Association for the Surgery of Trauma Organ Injury Scale (2018 Revision)
 *
 * Standardized grading system for solid organ injuries (liver, spleen, kidney)
 * based on imaging findings. Used to guide management decisions in trauma.
 *
 * Primary Sources:
 * - Kozar RA, et al. J Trauma Acute Care Surg. 2018;85(6):1119-1122 (2018 AAST-OIS Update)
 * - Santo IDE, et al. RadioGraphics. 2023;43(9):e230040 (Imaging Review)
 * - Coccolini F, et al. World J Emerg Surg. 2020;15:24 (WSES Liver Guidelines)
 */

export const AASTTraumaGrading = {
  id: "aast-trauma-grading",
  category: "Trauma",
  name: "AAST Trauma Grading",
  desc: "AAST-OIS 2018 solid organ injury grading for liver, spleen, and kidney trauma",
  metaDesc:
    "Free AAST Trauma Grading Calculator. AAST-OIS 2018 revision for liver, spleen, and kidney injury grading. CT-based classification with WSES management guidelines.",

  info: {
    text: `The AAST Organ Injury Scale (OIS) is the standard grading system for solid organ trauma, updated in 2018 to incorporate vascular injury criteria visible on CT.

GRADING SYSTEM (Grades I-V):
• Grade I: Minor injury (subcapsular hematoma <10%, capsular tear <1 cm)
• Grade II: Moderate injury (hematoma 10-50%, laceration 1-3 cm)
• Grade III: Serious injury (large hematoma, deep laceration, contained bleeding)
• Grade IV: Severe injury (parenchymal disruption, segmental vessel injury)
• Grade V: Critical injury (massive disruption, hilar/main vessel injury)

KEY 2018 UPDATES:
• Vascular injury criteria integrated into grading
• Active bleeding location (contained vs. extending beyond organ) now affects grade
• Pseudoaneurysm and AV fistula criteria added

MANAGEMENT PRINCIPLES (WSES Guidelines):
• Hemodynamic stability is the PRIMARY determinant of management
• Anatomic grade alone does NOT dictate operative vs. non-operative management
• Low-grade injuries (I-II): Usually non-operative
• Higher grades (III-V): May still be managed non-operatively if hemodynamically stable`,
    link: {
      label: "View 2018 AAST-OIS Update",
      url: "https://doi.org/10.1097/TA.0000000000002058",
    },
  },

  fields: [
    // ORGAN SELECTION
    {
      id: "organ",
      label: "Injured Organ",
      type: "radio",
      opts: [
        { value: "liver", label: "Liver" },
        { value: "spleen", label: "Spleen" },
        { value: "kidney", label: "Kidney" },
      ],
    },

    // ============================================
    // LIVER FIELDS
    // ============================================
    {
      id: "liver_hematoma",
      label: "Liver Hematoma",
      type: "radio",
      showIf: (vals) => vals.organ === "liver",
      opts: [
        { value: "none", label: "None" },
        {
          value: "subcapsular_lt10",
          label: "Subcapsular, <10% surface area (Grade I)",
        },
        {
          value: "subcapsular_10_50",
          label: "Subcapsular, 10-50% surface area (Grade II)",
        },
        {
          value: "intraparenchymal_lt10",
          label: "Intraparenchymal, <10 cm diameter (Grade II)",
        },
        {
          value: "subcapsular_gt50",
          label: "Subcapsular, >50% surface area (Grade III)",
        },
        {
          value: "ruptured_subcapsular",
          label: "Ruptured subcapsular or parenchymal hematoma (Grade III)",
        },
        {
          value: "intraparenchymal_gt10",
          label: "Intraparenchymal hematoma >10 cm (Grade III)",
        },
      ],
    },

    {
      id: "liver_laceration",
      label: "Liver Laceration",
      type: "radio",
      showIf: (vals) => vals.organ === "liver",
      opts: [
        { value: "none", label: "None" },
        {
          value: "capsular_lt1cm",
          label: "Capsular tear, <1 cm parenchymal depth (Grade I)",
        },
        {
          value: "1_3cm",
          label: "1-3 cm parenchymal depth, <10 cm length (Grade II)",
        },
        { value: "gt3cm", label: ">3 cm parenchymal depth (Grade III)" },
        {
          value: "disruption_25_75",
          label: "Parenchymal disruption 25-75% of hepatic lobe (Grade IV)",
        },
        {
          value: "disruption_gt75",
          label: "Parenchymal disruption >75% of hepatic lobe (Grade V)",
        },
      ],
    },

    {
      id: "liver_vascular",
      label: "Liver Vascular Injury",
      type: "radio",
      showIf: (vals) => vals.organ === "liver",
      opts: [
        { value: "none", label: "None" },
        {
          value: "contained",
          label:
            "Active bleeding contained within liver parenchyma (Grade III)",
        },
        {
          value: "free_peritoneum",
          label:
            "Active bleeding extending beyond liver into peritoneum (Grade IV)",
        },
        {
          value: "juxtahepatic",
          label:
            "Juxtahepatic venous injury (retrohepatic IVC/central major hepatic veins) (Grade V)",
        },
      ],
    },

    {
      id: "liver_major_vein",
      label: "Major Hepatic Vein or IVC Injury",
      type: "checkbox",
      subLabel: "Injury to retrohepatic IVC or central hepatic veins → Grade V",
      showIf: (vals) => vals.organ === "liver",
    },

    // ============================================
    // SPLEEN FIELDS
    // ============================================
    {
      id: "spleen_hematoma",
      label: "Spleen Hematoma",
      type: "radio",
      showIf: (vals) => vals.organ === "spleen",
      opts: [
        { value: "none", label: "None" },
        {
          value: "subcapsular_lt10",
          label: "Subcapsular, <10% surface area (Grade I)",
        },
        {
          value: "subcapsular_10_50",
          label: "Subcapsular, 10-50% surface area (Grade II)",
        },
        {
          value: "intraparenchymal_lt5",
          label: "Intraparenchymal, <5 cm diameter (Grade II)",
        },
        {
          value: "subcapsular_gt50",
          label: "Subcapsular, >50% surface area (Grade III)",
        },
        {
          value: "intraparenchymal_gte5",
          label: "Intraparenchymal hematoma ≥5 cm or expanding (Grade III)",
        },
        {
          value: "ruptured",
          label:
            "Ruptured subcapsular or intraparenchymal hematoma (Grade III)",
        },
      ],
    },

    {
      id: "spleen_laceration",
      label: "Spleen Laceration",
      type: "radio",
      showIf: (vals) => vals.organ === "spleen",
      opts: [
        { value: "none", label: "None" },
        {
          value: "capsular_lt1cm",
          label: "Capsular tear, <1 cm parenchymal depth (Grade I)",
        },
        {
          value: "1_3cm",
          label: "1-3 cm parenchymal depth (Grade II)",
        },
        { value: "gt3cm", label: ">3 cm parenchymal depth (Grade III)" },
        {
          value: "segmental_gt25",
          label:
            "Laceration involving segmental or hilar vessels with >25% devascularization (Grade IV)",
        },
        { value: "shattered", label: "Shattered spleen (Grade V)" },
      ],
    },

    {
      id: "spleen_vascular",
      label: "Spleen Vascular Injury",
      type: "radio",
      showIf: (vals) => vals.organ === "spleen",
      opts: [
        { value: "none", label: "None" },
        {
          value: "psa_avf",
          label: "Pseudoaneurysm or arteriovenous fistula (Grade IV)",
        },
        {
          value: "contained",
          label: "Active bleeding confined within splenic capsule (Grade IV)",
        },
        {
          value: "free_peritoneum",
          label:
            "Active bleeding extending beyond spleen into peritoneum (Grade V)",
        },
        {
          value: "hilar_devascularized",
          label:
            "Hilar vascular injury with complete splenic devascularization (Grade V)",
        },
      ],
    },

    // ============================================
    // KIDNEY FIELDS
    // ============================================
    {
      id: "kidney_hematoma",
      label: "Kidney Hematoma/Contusion",
      type: "radio",
      showIf: (vals) => vals.organ === "kidney",
      opts: [
        { value: "none", label: "None" },
        { value: "contusion", label: "Parenchymal contusion (Grade I)" },
        {
          value: "subcapsular_lt3_5",
          label: "Subcapsular hematoma <3.5 cm from kidney edge (Grade I)",
        },
        {
          value: "perinephric_hrd_lt3_5",
          label:
            "Perinephric hematoma, hematoma rim distance (HRD) <3.5 cm (Grade II)",
        },
        {
          value: "hrd_gte3_5",
          label: "Hematoma rim distance ≥3.5 cm (Grade III)",
        },
      ],
    },

    {
      id: "kidney_laceration",
      label: "Kidney Laceration",
      type: "radio",
      showIf: (vals) => vals.organ === "kidney",
      opts: [
        { value: "none", label: "None" },
        {
          value: "lt2_5cm",
          label:
            "<2.5 cm parenchymal depth, no collecting system involvement (Grade II)",
        },
        {
          value: "gte2_5cm_no_cs",
          label:
            "≥2.5 cm parenchymal depth, no collecting system involvement (Grade III)",
        },
        {
          value: "into_collecting",
          label:
            "Laceration extending into collecting system with urinary extravasation (Grade III)",
        },
        {
          value: "deep_calyceal",
          label:
            "Deep laceration involving calyces, renal pelvis, or UPJ (Grade IV)",
        },
        {
          value: "upj_disruption",
          label: "Ureteropelvic junction (UPJ) disruption (Grade IV)",
        },
        {
          value: "shattered",
          label: "Shattered/multifragmented kidney (Grade IV-V)",
        },
      ],
    },

    {
      id: "kidney_urinary_extrav",
      label: "Urinary Extravasation",
      type: "checkbox",
      subLabel: "Contrast extravasation on delayed phase",
      showIf: (vals) => vals.organ === "kidney",
    },

    {
      id: "kidney_vascular",
      label: "Kidney Vascular Injury",
      type: "radio",
      showIf: (vals) => vals.organ === "kidney",
      opts: [
        { value: "none", label: "None" },
        {
          value: "psa_avf_contained",
          label:
            "Pseudoaneurysm, AV fistula, or contained active bleeding (Grade III)",
        },
        {
          value: "segmental_no_bleed",
          label:
            "Segmental artery/vein injury without active bleeding (Grade IV)",
        },
        {
          value: "active_beyond_gerota",
          label: "Active bleeding extending beyond Gerota fascia (Grade IV)",
        },
        {
          value: "main_vessel",
          label:
            "Main renal artery or vein laceration/transection with active bleeding (Grade V)",
        },
      ],
    },

    {
      id: "kidney_infarction",
      label: "Kidney Infarction",
      type: "radio",
      showIf: (vals) => vals.organ === "kidney",
      opts: [
        { value: "none", label: "None" },
        { value: "partial", label: "Partial/segmental infarction (Grade III)" },
        {
          value: "partial_no_bleed",
          label: "Segmental infarction without active bleeding (Grade IV)",
        },
        {
          value: "complete_with_bleed",
          label: "Complete kidney infarction with active bleeding (Grade V)",
        },
      ],
    },

    // ============================================
    // COMMON FIELDS
    // ============================================
    {
      id: "multiple_injuries",
      label: "Multiple Injuries in Same Organ",
      type: "checkbox",
      subLabel: "Advance one grade for multiple injuries (up to Grade III)",
    },
  ],

  compute: (vals) => {
    const {
      organ = "",
      liver_hematoma = "",
      liver_laceration = "",
      liver_vascular = "",
      liver_major_vein = false,
      spleen_hematoma = "",
      spleen_laceration = "",
      spleen_vascular = "",
      kidney_hematoma = "",
      kidney_laceration = "",
      kidney_urinary_extrav = false,
      kidney_vascular = "",
      kidney_infarction = "",
      multiple_injuries = false,
    } = vals;

    if (!organ) {
      return {
        Error: "Please select the injured organ to calculate the AAST grade.",
      };
    }

    let grade = 0;
    let gradeFindings = [];
    let gradeDescription = "";

    // ============================================
    // LIVER GRADING
    // ============================================
    if (organ === "liver") {
      if (liver_major_vein || liver_vascular === "juxtahepatic") {
        grade = Math.max(grade, 5);
        gradeFindings.push(
          "Juxtahepatic venous injury (retrohepatic IVC/central hepatic veins)",
        );
      }

      if (liver_laceration === "disruption_gt75") {
        grade = Math.max(grade, 5);
        gradeFindings.push("Parenchymal disruption >75% of hepatic lobe");
      } else if (liver_laceration === "disruption_25_75") {
        grade = Math.max(grade, 4);
        gradeFindings.push("Parenchymal disruption 25-75% of hepatic lobe");
      } else if (liver_laceration === "gt3cm") {
        grade = Math.max(grade, 3);
        gradeFindings.push(">3 cm parenchymal depth laceration");
      } else if (liver_laceration === "1_3cm") {
        grade = Math.max(grade, 2);
        gradeFindings.push("1-3 cm parenchymal depth laceration");
      } else if (liver_laceration === "capsular_lt1cm") {
        grade = Math.max(grade, 1);
        gradeFindings.push("Capsular tear <1 cm depth");
      }

      if (liver_vascular === "free_peritoneum") {
        grade = Math.max(grade, 4);
        gradeFindings.push(
          "Active bleeding extending beyond liver into peritoneum",
        );
      } else if (liver_vascular === "contained") {
        grade = Math.max(grade, 3);
        gradeFindings.push("Active bleeding contained within liver parenchyma");
      }

      if (
        liver_hematoma === "subcapsular_gt50" ||
        liver_hematoma === "ruptured_subcapsular" ||
        liver_hematoma === "intraparenchymal_gt10"
      ) {
        grade = Math.max(grade, 3);
        if (liver_hematoma === "subcapsular_gt50") {
          gradeFindings.push("Subcapsular hematoma >50% surface area");
        } else if (liver_hematoma === "ruptured_subcapsular") {
          gradeFindings.push("Ruptured subcapsular/parenchymal hematoma");
        } else {
          gradeFindings.push("Intraparenchymal hematoma >10 cm");
        }
      } else if (
        liver_hematoma === "subcapsular_10_50" ||
        liver_hematoma === "intraparenchymal_lt10"
      ) {
        grade = Math.max(grade, 2);
        if (liver_hematoma === "subcapsular_10_50") {
          gradeFindings.push("Subcapsular hematoma 10-50% surface area");
        } else {
          gradeFindings.push("Intraparenchymal hematoma <10 cm");
        }
      } else if (liver_hematoma === "subcapsular_lt10") {
        grade = Math.max(grade, 1);
        gradeFindings.push("Subcapsular hematoma <10% surface area");
      }

      const liverGrades = {
        1: "Minor - Subcapsular hematoma <10% or capsular tear <1 cm",
        2: "Moderate - Subcapsular 10-50% or laceration 1-3 cm",
        3: "Serious - Large hematoma or deep laceration or contained bleeding",
        4: "Severe - Major lobe disruption or intraperitoneal bleeding",
        5: "Critical - Massive disruption or juxtahepatic venous injury",
      };
      gradeDescription = liverGrades[grade] || "";
    }

    // ============================================
    // SPLEEN GRADING
    // ============================================
    else if (organ === "spleen") {
      if (
        spleen_vascular === "free_peritoneum" ||
        spleen_vascular === "hilar_devascularized"
      ) {
        grade = Math.max(grade, 5);
        if (spleen_vascular === "free_peritoneum") {
          gradeFindings.push(
            "Active bleeding extending beyond spleen into peritoneum",
          );
        } else {
          gradeFindings.push(
            "Hilar vascular injury with complete devascularization",
          );
        }
      } else if (
        spleen_vascular === "psa_avf" ||
        spleen_vascular === "contained"
      ) {
        grade = Math.max(grade, 4);
        if (spleen_vascular === "psa_avf") {
          gradeFindings.push("Pseudoaneurysm or AV fistula");
        } else {
          gradeFindings.push("Active bleeding confined within splenic capsule");
        }
      }

      if (spleen_laceration === "shattered") {
        grade = Math.max(grade, 5);
        gradeFindings.push("Shattered spleen");
      } else if (spleen_laceration === "segmental_gt25") {
        grade = Math.max(grade, 4);
        gradeFindings.push(
          "Segmental/hilar vessel injury with >25% devascularization",
        );
      } else if (spleen_laceration === "gt3cm") {
        grade = Math.max(grade, 3);
        gradeFindings.push(">3 cm parenchymal depth laceration");
      } else if (spleen_laceration === "1_3cm") {
        grade = Math.max(grade, 2);
        gradeFindings.push("1-3 cm parenchymal depth laceration");
      } else if (spleen_laceration === "capsular_lt1cm") {
        grade = Math.max(grade, 1);
        gradeFindings.push("Capsular tear <1 cm depth");
      }

      if (
        spleen_hematoma === "subcapsular_gt50" ||
        spleen_hematoma === "intraparenchymal_gte5" ||
        spleen_hematoma === "ruptured"
      ) {
        grade = Math.max(grade, 3);
        if (spleen_hematoma === "subcapsular_gt50") {
          gradeFindings.push("Subcapsular hematoma >50% surface area");
        } else if (spleen_hematoma === "intraparenchymal_gte5") {
          gradeFindings.push("Intraparenchymal hematoma ≥5 cm");
        } else {
          gradeFindings.push("Ruptured subcapsular/intraparenchymal hematoma");
        }
      } else if (
        spleen_hematoma === "subcapsular_10_50" ||
        spleen_hematoma === "intraparenchymal_lt5"
      ) {
        grade = Math.max(grade, 2);
        if (spleen_hematoma === "subcapsular_10_50") {
          gradeFindings.push("Subcapsular hematoma 10-50% surface area");
        } else {
          gradeFindings.push("Intraparenchymal hematoma <5 cm");
        }
      } else if (spleen_hematoma === "subcapsular_lt10") {
        grade = Math.max(grade, 1);
        gradeFindings.push("Subcapsular hematoma <10% surface area");
      }

      const spleenGrades = {
        1: "Minor - Subcapsular hematoma <10% or capsular tear <1 cm",
        2: "Moderate - Subcapsular 10-50% or laceration 1-3 cm",
        3: "Serious - Large hematoma or deep laceration",
        4: "Severe - Vascular injury (PSA/AVF) or >25% devascularization",
        5: "Critical - Shattered spleen or hilar avulsion or free bleeding",
      };
      gradeDescription = spleenGrades[grade] || "";
    }

    // ============================================
    // KIDNEY GRADING
    // ============================================
    else if (organ === "kidney") {
      if (kidney_vascular === "main_vessel") {
        grade = Math.max(grade, 5);
        gradeFindings.push(
          "Main renal artery/vein laceration or transection with active bleeding",
        );
      } else if (
        kidney_vascular === "active_beyond_gerota" ||
        kidney_vascular === "segmental_no_bleed"
      ) {
        grade = Math.max(grade, 4);
        if (kidney_vascular === "active_beyond_gerota") {
          gradeFindings.push("Active bleeding extending beyond Gerota fascia");
        } else {
          gradeFindings.push(
            "Segmental artery/vein injury without active bleeding",
          );
        }
      } else if (kidney_vascular === "psa_avf_contained") {
        grade = Math.max(grade, 3);
        gradeFindings.push(
          "Pseudoaneurysm, AV fistula, or contained active bleeding",
        );
      }

      if (kidney_infarction === "complete_with_bleed") {
        grade = Math.max(grade, 5);
        gradeFindings.push("Complete kidney infarction with active bleeding");
      } else if (kidney_infarction === "partial_no_bleed") {
        grade = Math.max(grade, 4);
        gradeFindings.push("Segmental infarction without active bleeding");
      } else if (kidney_infarction === "partial") {
        grade = Math.max(grade, 3);
        gradeFindings.push("Partial/segmental infarction");
      }

      if (kidney_laceration === "shattered") {
        if (
          kidney_vascular === "main_vessel" ||
          kidney_vascular === "active_beyond_gerota"
        ) {
          grade = Math.max(grade, 5);
          gradeFindings.push("Shattered kidney with active bleeding");
        } else {
          grade = Math.max(grade, 4);
          gradeFindings.push("Multifragmented kidney without active bleeding");
        }
      } else if (
        kidney_laceration === "upj_disruption" ||
        kidney_laceration === "deep_calyceal"
      ) {
        grade = Math.max(grade, 4);
        if (kidney_laceration === "upj_disruption") {
          gradeFindings.push("Ureteropelvic junction disruption");
        } else {
          gradeFindings.push("Deep laceration involving calyces");
        }
      } else if (
        kidney_laceration === "into_collecting" ||
        kidney_laceration === "gte2_5cm_no_cs"
      ) {
        grade = Math.max(grade, 3);
        if (kidney_laceration === "into_collecting") {
          gradeFindings.push("Laceration extending into collecting system");
        } else {
          gradeFindings.push("Parenchymal laceration ≥2.5 cm");
        }
      } else if (kidney_laceration === "lt2_5cm") {
        grade = Math.max(grade, 2);
        gradeFindings.push(
          "Parenchymal laceration <2.5 cm, no collecting system involvement",
        );
      }

      if (kidney_hematoma === "hrd_gte3_5") {
        grade = Math.max(grade, 3);
        gradeFindings.push("Hematoma rim distance ≥3.5 cm");
      } else if (kidney_hematoma === "perinephric_hrd_lt3_5") {
        grade = Math.max(grade, 2);
        gradeFindings.push("Perinephric hematoma with HRD <3.5 cm");
      } else if (
        kidney_hematoma === "contusion" ||
        kidney_hematoma === "subcapsular_lt3_5"
      ) {
        grade = Math.max(grade, 1);
        if (kidney_hematoma === "contusion") {
          gradeFindings.push("Parenchymal contusion");
        } else {
          gradeFindings.push("Subcapsular hematoma <3.5 cm");
        }
      }

      if (kidney_urinary_extrav) {
        if (grade < 4) {
          grade = Math.max(grade, 3);
        }
        gradeFindings.push("Urinary extravasation present");
      }

      const kidneyGrades = {
        1: "Minor - Contusion or subcapsular hematoma <3.5 cm",
        2: "Moderate - Small laceration <2.5 cm or limited perinephric hematoma",
        3: "Serious - Larger laceration or contained vascular injury or partial infarction",
        4: "Severe - Collecting system involvement or segmental vessel injury",
        5: "Critical - Main vessel injury or shattered kidney with active bleeding",
      };
      gradeDescription = kidneyGrades[grade] || "";
    }

    // Apply multiple injury rule
    let baseGrade = grade;
    if (multiple_injuries && grade < 3 && grade > 0) {
      grade += 1;
      gradeFindings.push("Multiple injuries (+1 grade)");
    }

    if (grade === 0) {
      return {
        Error:
          "Please select at least one injury finding to calculate the AAST grade.",
      };
    }

    // Management recommendations based on WSES guidelines
    let management = "";
    let interventionConsideration = "";
    let followUp = "";

    if (organ === "liver") {
      switch (grade) {
        case 1:
        case 2:
          management =
            "Non-operative management (NOM) - Observation with serial clinical and laboratory monitoring";
          interventionConsideration =
            "Intervention rarely needed; proceed to angiography only if hemodynamic deterioration";
          followUp =
            "Repeat imaging only if clinical deterioration; early mobilization";
          break;
        case 3:
          management =
            "Non-operative management with close monitoring; consider angioembolization if contrast blush on CT";
          interventionConsideration =
            "Angioembolization for contained bleeding (15-25% may require); repeat CT if clinical change";
          followUp =
            "ICU observation 24-48h; serial hemoglobin; follow-up CT at 48-72h if vascular injury";
          break;
        case 4:
          management =
            "Non-operative management in selected hemodynamically stable patients; higher likelihood of intervention";
          interventionConsideration =
            "Angioembolization for active bleeding (33-40% require intervention); operative management if unstable";
          followUp =
            "ICU observation mandatory; frequent reassessment; low threshold for intervention";
          break;
        case 5:
          management =
            "High-risk injury requiring aggressive management; consider early operative intervention";
          interventionConsideration =
            "Operative management often required (43-57% require surgery); damage control surgery for unstable patients";
          followUp =
            "Intensive care; anticipate complications (biloma, abscess); multidisciplinary approach";
          break;
      }
    } else if (organ === "spleen") {
      switch (grade) {
        case 1:
        case 2:
          management =
            "Non-operative management (NOM) - Observation; NOM success rate >95%";
          interventionConsideration =
            "Intervention rarely needed; maintain high transfusion threshold";
          followUp =
            "Activity restriction 4-6 weeks; follow-up imaging not routinely required";
          break;
        case 3:
          management =
            "Non-operative management with close monitoring; consider prophylactic angioembolization";
          interventionConsideration =
            "Proximal splenic artery embolization may improve NOM success; repeat imaging for clinical change";
          followUp =
            "ICU observation 24-48h; serial hemoglobin; activity restriction 6-8 weeks";
          break;
        case 4:
          management =
            "Non-operative management possible with angioembolization for vascular injuries";
          interventionConsideration =
            "Angioembolization for PSA/AVF or contained bleeding; up to 80% splenic salvage with intervention";
          followUp =
            "ICU observation; anticipate possible splenectomy; vaccination planning if splenectomy likely";
          break;
        case 5:
          management =
            "High-risk injury; operative management (splenectomy) often required for unstable patients";
          interventionConsideration =
            "Splenectomy for hemodynamic instability or free intraperitoneal bleeding; consider partial splenectomy if feasible";
          followUp =
            "If splenectomy: Vaccinations (pneumococcal, meningococcal, H. influenzae); lifelong infection awareness";
          break;
      }
    } else if (organ === "kidney") {
      switch (grade) {
        case 1:
        case 2:
          management =
            "Non-operative management (NOM) - Observation with clinical and urinalysis monitoring";
          interventionConsideration =
            "Intervention rarely needed; bed rest until gross hematuria resolves";
          followUp =
            "Follow-up ultrasound at 2-4 weeks; blood pressure monitoring long-term";
          break;
        case 3:
          management =
            "Non-operative management with close monitoring; angioembolization for vascular injuries";
          interventionConsideration =
            "Angioembolization for PSA/AVF; urinary extravasation resolves spontaneously in 80-90% of cases";
          followUp =
            "Follow-up CT with delayed phase at 48h for urinary extravasation; urology consultation";
          break;
        case 4:
          management =
            "Non-operative management possible in stable patients; higher likelihood of intervention";
          interventionConsideration =
            "Angioembolization for active bleeding; ureteral stent or nephrostomy for persistent urinoma; exploration for UPJ disruption";
          followUp =
            "Close ICU observation; repeat imaging at 48-72h; long-term renal function monitoring";
          break;
        case 5:
          management =
            "High-risk injury; operative exploration often required; consider nephrectomy vs. reconstruction";
          interventionConsideration =
            "Nephrectomy for uncontrollable hemorrhage or complete devascularization; renal reconstruction if feasible";
          followUp =
            "Long-term renal function monitoring; blood pressure surveillance; contralateral kidney evaluation";
          break;
      }
    }

    const organName = organ.charAt(0).toUpperCase() + organ.slice(1);
    const result = {
      "AAST Grade": `Grade ${grade}`,
      Organ: organName,
      "Grade Description": gradeDescription,
      "Key Findings": gradeFindings.join("; "),
      "Management Approach": management,
      "Intervention Consideration": interventionConsideration,
      "Follow-up": followUp,
    };

    if (multiple_injuries && baseGrade < 3 && baseGrade > 0) {
      result["Multiple Injury Adjustment"] =
        `Base grade ${baseGrade} advanced to Grade ${grade} due to multiple injuries`;
    }

    result["CRITICAL NOTE"] =
      "HEMODYNAMIC STABILITY IS PARAMOUNT. Unstable patients require OPERATIVE MANAGEMENT regardless of anatomic grade. All management decisions should be made in consultation with trauma surgery.";

    if (organ === "liver" && grade >= 4) {
      result["Liver-Specific Note"] =
        "High-grade liver injuries have significant risk of delayed bleeding, biliary complications, and hepatic necrosis. Consider damage control surgery for unstable patients.";
    } else if (organ === "spleen" && grade >= 4) {
      result["Spleen-Specific Note"] =
        "Post-splenectomy patients require immunizations and have lifelong increased infection risk. Splenic preservation should be attempted when feasible.";
    } else if (organ === "kidney") {
      if (kidney_urinary_extrav) {
        result["Kidney-Specific Note"] =
          "Urinary extravasation resolves spontaneously in 80-90% of cases. Intervention indicated for enlarging urinoma, fever, persistent ileus, or suspected UPJ disruption.";
      }
    }

    return result;
  },

  refs: [
    {
      t: "Kozar RA, Crandall M, Shanmuganathan K, et al. Organ injury scaling 2018 update: Spleen, liver, and kidney. J Trauma Acute Care Surg. 2018;85(6):1119-1122.",
      u: "https://doi.org/10.1097/TA.0000000000002058",
    },
    {
      t: "Moore EE, Shackford SR, Pachter HL, et al. Organ injury scaling: spleen, liver, and kidney. J Trauma. 1989;29(12):1664-1666.",
      u: "https://pubmed.ncbi.nlm.nih.gov/2593197/",
    },
    {
      t: "Santo IDE, Sailer A, Solomon N, et al. Grading Abdominal Trauma: Changes in and Implications of the Revised 2018 AAST-OIS for the Spleen, Liver, and Kidney. RadioGraphics. 2023;43(9):e230040.",
      u: "https://doi.org/10.1148/rg.230040",
    },
    {
      t: "Coccolini F, Coimbra R, Ordonez C, et al. Liver trauma: WSES 2020 guidelines. World J Emerg Surg. 2020;15:24.",
      u: "https://doi.org/10.1186/s13017-020-00302-7",
    },
    {
      t: "Coccolini F, Montori G, Catena F, et al. Splenic trauma: WSES classification and guidelines for adult and pediatric patients. World J Emerg Surg. 2017;12:40.",
      u: "https://doi.org/10.1186/s13017-017-0151-4",
    },
    {
      t: "Coccolini F, Moore EE, Kluger Y, et al. Kidney and uro-trauma: WSES-AAST guidelines. World J Emerg Surg. 2019;14:54.",
      u: "https://doi.org/10.1186/s13017-019-0274-x",
    },
    {
      t: "Tinkoff G, Esposito TJ, Reed J, et al. American Association for the Surgery of Trauma Organ Injury Scale I: Spleen, Liver, and Kidney, Validation Based on the National Trauma Data Bank. J Am Coll Surg. 2008;207(5):646-655.",
      u: "https://doi.org/10.1016/j.jamcollsurg.2008.06.342",
    },
    {
      t: "Morell-Hofert D, Primavesi F, Gassner E, et al. Validation of the revised 2018 AAST-OIS classification. Eur Radiol. 2020;30(12):6570-6581.",
      u: "https://doi.org/10.1007/s00330-020-07061-8",
    },
    {
      t: "Bhullar IS, Frykberg ER, Siragusa D, et al. AAST Organ Injury Scale 2018 update for CT-based grading of renal trauma. Emerg Radiol. 2019;26(6):635-643.",
      u: "https://doi.org/10.1007/s10140-019-01721-z",
    },
    {
      t: "AAST Official Website - Organ Injury Scale",
      u: "https://www.aast.org/resources-detail/injury-scoring-scale",
    },
  ],
};
