/**
 * AAST Trauma Grading Calculator
 * American Association for the Surgery of Trauma Organ Injury Scale
 *
 * Standardized grading system for solid organ injuries (liver, spleen, kidney, pancreas)
 * based on imaging findings. Used to guide management decisions in trauma.
 *
 * Kidney supports both 2018 and 2025 OIS revisions (version selector).
 * Pancreas uses 2024 OIS revision (ductal integrity as primary grading determinant).
 *
 * Primary Sources:
 * - Kozar RA, et al. J Trauma Acute Care Surg. 2018;85(6):1119-1122 (2018 AAST-OIS Update)
 * - Keihani S, et al. J Trauma Acute Care Surg. 2025;98(3):448-451 (2025 Kidney OIS Update)
 * - Notrica DM, et al. J Trauma Acute Care Surg. 2025;98(3):442-447 (2024 Pancreas OIS Update)
 * - Santo IDE, et al. RadioGraphics. 2023;43(9):e230040 (Imaging Review)
 * - Coccolini F, et al. World J Emerg Surg. 2020;15:24 (WSES Liver Guidelines)
 */

export const AASTTraumaGrading = {
  id: "aast-trauma-grading",
  category: "Trauma",
  name: "AAST Trauma Grading",
  desc: "AAST-OIS solid organ injury grading for liver, spleen, kidney, and pancreas trauma",
  guidelineVersion: "AAST OIS 2018/2025",
  keywords: [
    "trauma",
    "organ injury",
    "spleen injury",
    "liver injury",
    "kidney injury",
    "pancreas injury",
    "pancreatic trauma",
    "pancreatic duct",
  ],
  tags: ["Trauma", "Emergency", "Abdominal"],
  metaDesc:
    "Free AAST Trauma Grading Calculator. AAST-OIS for liver, spleen, kidney (2018/2025), and pancreas (2024) injury grading. CT-based classification with management guidelines.",

  info: {
    text: `The AAST Organ Injury Scale (OIS) is the standard grading system for solid organ trauma. Supports liver, spleen, kidney (2018/2025), and pancreas (2024 revision).

GRADING SYSTEM (Grades I-V):
• Grade I: Minor injury (subcapsular hematoma <10%, capsular tear <1 cm)
• Grade II: Moderate injury (hematoma 10-50%, laceration 1-3 cm)
• Grade III: Serious injury (large hematoma, deep laceration, contained bleeding)
• Grade IV: Severe injury (parenchymal disruption, segmental vessel injury)
• Grade V: Critical injury (massive disruption, hilar/main vessel injury)

PANCREAS (2024 Revision):
• Ductal integrity is the PRIMARY grading determinant
• Location (head vs. body/tail) differentiates Grade III from IV
• Head lacerations without duct injury reclassified from Grade IV to Grade II

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
        { value: "pancreas", label: "Pancreas" },
      ],
    },

    // KIDNEY VERSION SELECTOR
    {
      id: "kidney_ois_version",
      label: "Kidney OIS Version",
      subLabel: "2025 revision improves prediction of bleeding interventions",
      type: "radio",
      showIf: (vals) => vals.organ === "kidney",
      opts: [
        { value: "2025", label: "2025 Revision (Keihani et al.)" },
        { value: "2018", label: "2018 Revision (Kozar et al.)" },
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
    // KIDNEY FIELDS — 2025 Revision (Keihani et al.)
    // Active bleeding is the primary Grade III↔IV differentiator
    // ============================================
    {
      id: "kidney_hematoma",
      label: "Kidney Hematoma/Contusion",
      type: "radio",
      showIf: (vals) =>
        vals.organ === "kidney" && vals.kidney_ois_version !== "2018",
      opts: [
        { value: "none", label: "None" },
        { value: "contusion", label: "Contusion without laceration (Grade I)" },
        {
          value: "subcapsular_lt3_5",
          label:
            "Subcapsular hematoma <3.5 cm without active bleeding (Grade I)",
        },
        {
          value: "perinephric_hrd_lt3_5",
          label:
            "Perinephric hematoma, HRD <3.5 cm without active bleeding (Grade II)",
        },
        {
          value: "hrd_gte3_5",
          label:
            "Hematoma rim distance (HRD) ≥3.5 cm without active bleeding (Grade III)",
        },
        {
          value: "pararenal_extension",
          label: "Pararenal hematoma extension (Grade IV)",
        },
      ],
    },

    {
      id: "kidney_laceration",
      label: "Kidney Laceration",
      type: "radio",
      showIf: (vals) =>
        vals.organ === "kidney" && vals.kidney_ois_version !== "2018",
      opts: [
        { value: "none", label: "None" },
        {
          value: "lt2_5cm",
          label:
            "Laceration <2.5 cm, no collecting system involvement (Grade II)",
        },
        {
          value: "gte2_5cm_no_cs",
          label:
            "Laceration ≥2.5 cm, no collecting system involvement (Grade III)",
        },
        {
          value: "into_collecting",
          label:
            "Collecting system laceration / urinary extravasation (Grade III)",
        },
        {
          value: "upj_disruption",
          label: "Complete or near-complete UPJ disruption (Grade IV)",
        },
        {
          value: "shattered",
          label: "Multifragmented kidney (Grade IV-V)",
        },
      ],
    },

    {
      id: "kidney_urinary_extrav",
      label: "Urinary Extravasation",
      type: "checkbox",
      subLabel: "Contrast extravasation on delayed excretory phase",
      showIf: (vals) =>
        vals.organ === "kidney" && vals.kidney_ois_version !== "2018",
    },

    {
      id: "kidney_vascular",
      label: "Kidney Vascular Injury",
      type: "radio",
      showIf: (vals) =>
        vals.organ === "kidney" && vals.kidney_ois_version !== "2018",
      opts: [
        { value: "none", label: "None" },
        {
          value: "psa_avf",
          label:
            "Vascular injury without active bleeding (PSA, AVF) (Grade III)",
        },
        {
          value: "active_from_kidney",
          label: "Active bleeding from kidney (Grade IV)",
        },
        {
          value: "active_beyond_gerota",
          label: "Active bleeding extending beyond Gerota fascia (Grade IV)",
        },
        {
          value: "main_vessel",
          label:
            "Main renal artery or vein laceration with active bleeding (Grade V)",
        },
      ],
    },

    {
      id: "kidney_infarction",
      label: "Kidney Infarction",
      type: "radio",
      showIf: (vals) =>
        vals.organ === "kidney" && vals.kidney_ois_version !== "2018",
      opts: [
        { value: "none", label: "None" },
        {
          value: "partial",
          label: "Partial/segmental infarction (Grade III)",
        },
        {
          value: "complete_no_bleed",
          label:
            "Complete/near-complete infarction without active bleeding (Grade IV)",
        },
        {
          value: "complete_with_bleed",
          label:
            "Complete/near-complete infarction with active bleeding (Grade V)",
        },
      ],
    },

    // ============================================
    // KIDNEY FIELDS — 2018 Revision (Kozar et al.)
    // ============================================
    {
      id: "kidney_2018_hematoma",
      label: "Kidney Hematoma/Contusion",
      type: "radio",
      showIf: (vals) =>
        vals.organ === "kidney" && vals.kidney_ois_version === "2018",
      opts: [
        { value: "none", label: "None" },
        {
          value: "contusion",
          label: "Subcapsular hematoma and/or parenchymal contusion (Grade I)",
        },
        {
          value: "perirenal_gerota",
          label: "Perirenal hematoma confined to Gerota fascia (Grade II)",
        },
      ],
    },

    {
      id: "kidney_2018_laceration",
      label: "Kidney Laceration",
      type: "radio",
      showIf: (vals) =>
        vals.organ === "kidney" && vals.kidney_ois_version === "2018",
      opts: [
        { value: "none", label: "None" },
        {
          value: "lte1cm",
          label:
            "≤1 cm parenchymal depth without urinary extravasation (Grade II)",
        },
        {
          value: "gt1cm_no_cs",
          label:
            ">1 cm depth without collecting system rupture or urinary extravasation (Grade III)",
        },
        {
          value: "into_collecting",
          label: "Into collecting system with urinary extravasation (Grade IV)",
        },
        {
          value: "renal_pelvis_upj",
          label: "Into renal pelvis and/or complete UPJ disruption (Grade IV)",
        },
        {
          value: "shattered",
          label:
            "Shattered kidney with loss of identifiable parenchymal anatomy (Grade V)",
        },
      ],
    },

    {
      id: "kidney_2018_urinary_extrav",
      label: "Urinary Extravasation",
      type: "checkbox",
      subLabel: "Contrast extravasation on delayed phase → Grade IV",
      showIf: (vals) =>
        vals.organ === "kidney" && vals.kidney_ois_version === "2018",
    },

    {
      id: "kidney_2018_vascular",
      label: "Kidney Vascular Injury",
      type: "radio",
      showIf: (vals) =>
        vals.organ === "kidney" && vals.kidney_ois_version === "2018",
      opts: [
        { value: "none", label: "None" },
        {
          value: "contained_gerota",
          label:
            "Vascular injury or active bleeding contained within Gerota fascia (Grade III)",
        },
        {
          value: "segmental_no_bleed",
          label: "Segmental renal artery/vein injury (Grade IV)",
        },
        {
          value: "active_beyond_gerota",
          label:
            "Active bleeding extending beyond Gerota fascia into retroperitoneum (Grade IV)",
        },
        {
          value: "main_vessel",
          label:
            "Main renal artery or vein laceration or avulsion of hilum (Grade V)",
        },
      ],
    },

    {
      id: "kidney_2018_infarction",
      label: "Kidney Infarction",
      type: "radio",
      showIf: (vals) =>
        vals.organ === "kidney" && vals.kidney_ois_version === "2018",
      opts: [
        { value: "none", label: "None" },
        {
          value: "segmental_complete_no_bleed",
          label:
            "Segmental or complete kidney infarction without active bleeding (Grade IV)",
        },
        {
          value: "devascularized_with_bleed",
          label: "Devascularized kidney with active bleeding (Grade V)",
        },
      ],
    },

    // ============================================
    // PANCREAS FIELDS — 2024 Revision (Notrica et al.)
    // Ductal integrity is the primary grading determinant
    // ============================================
    {
      id: "pancreas_parenchymal",
      label: "Pancreatic Parenchymal Injury",
      type: "radio",
      showIf: (vals) => vals.organ === "pancreas",
      opts: [
        { value: "none", label: "None" },
        {
          value: "minor_contusion",
          label: "Minor contusion without duct injury (Grade I)",
        },
        {
          value: "superficial_laceration",
          label: "Superficial laceration without duct injury (Grade I)",
        },
        {
          value: "major_contusion",
          label:
            "Major contusion without duct injury or tissue loss (Grade II)",
        },
        {
          value: "major_laceration",
          label: "Major laceration without duct injury (Grade II)",
        },
      ],
    },

    {
      id: "pancreas_duct",
      label: "Pancreatic Duct Injury",
      subLabel: "Ductal integrity is the primary determinant of injury grade",
      type: "radio",
      showIf: (vals) => vals.organ === "pancreas",
      opts: [
        { value: "none", label: "No duct injury" },
        {
          value: "deep_no_interrogation",
          label:
            "Deep parenchymal injury without ductal interrogation (subgrade a)",
        },
        {
          value: "partial",
          label: "Partial ductal injury (subgrade b)",
        },
        {
          value: "complete_transection",
          label: "Complete ductal transection (subgrade c)",
        },
      ],
    },

    {
      id: "pancreas_duct_location",
      label: "Location of Duct Injury",
      subLabel: "Neck/body/tail = Grade III; Head = Grade IV",
      type: "radio",
      showIf: (vals) =>
        vals.organ === "pancreas" &&
        vals.pancreas_duct &&
        vals.pancreas_duct !== "none",
      opts: [
        {
          value: "body_tail",
          label: "Neck/body/tail (left of portal vein/SMV) — Grade III",
        },
        {
          value: "head",
          label: "Head (right of portal vein/SMV) — Grade IV",
        },
      ],
    },

    {
      id: "pancreas_destructive",
      label: "Destructive Pancreatic Head Injury",
      type: "checkbox",
      subLabel:
        "Massive disruption of pancreatic head with nonviable parenchyma → Grade V",
      showIf: (vals) => vals.organ === "pancreas",
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
      // 2025 kidney fields
      kidney_ois_version = "",
      kidney_hematoma = "",
      kidney_laceration = "",
      kidney_urinary_extrav = false,
      kidney_vascular = "",
      kidney_infarction = "",
      // 2018 kidney fields
      kidney_2018_hematoma = "",
      kidney_2018_laceration = "",
      kidney_2018_urinary_extrav = false,
      kidney_2018_vascular = "",
      kidney_2018_infarction = "",
      // pancreas fields
      pancreas_parenchymal = "",
      pancreas_duct = "",
      pancreas_duct_location = "",
      pancreas_destructive = false,
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
    // KIDNEY GRADING — 2025 Revision (Keihani et al.)
    // Active bleeding is the primary Grade III↔IV differentiator
    // ============================================
    else if (organ === "kidney" && kidney_ois_version !== "2018") {
      // VASCULAR
      if (kidney_vascular === "main_vessel") {
        grade = Math.max(grade, 5);
        gradeFindings.push(
          "Main renal artery/vein laceration with active bleeding",
        );
      } else if (
        kidney_vascular === "active_from_kidney" ||
        kidney_vascular === "active_beyond_gerota"
      ) {
        grade = Math.max(grade, 4);
        if (kidney_vascular === "active_from_kidney") {
          gradeFindings.push("Active bleeding from kidney");
        } else {
          gradeFindings.push("Active bleeding extending beyond Gerota fascia");
        }
      } else if (kidney_vascular === "psa_avf") {
        grade = Math.max(grade, 3);
        gradeFindings.push("Vascular injury without active bleeding (PSA/AVF)");
      }

      // INFARCTION
      if (kidney_infarction === "complete_with_bleed") {
        grade = Math.max(grade, 5);
        gradeFindings.push(
          "Complete/near-complete infarction with active bleeding",
        );
      } else if (kidney_infarction === "complete_no_bleed") {
        grade = Math.max(grade, 4);
        gradeFindings.push(
          "Complete/near-complete infarction without active bleeding",
        );
      } else if (kidney_infarction === "partial") {
        grade = Math.max(grade, 3);
        gradeFindings.push("Partial/segmental infarction");
      }

      // LACERATION
      if (kidney_laceration === "shattered") {
        if (
          kidney_vascular === "main_vessel" ||
          kidney_vascular === "active_from_kidney" ||
          kidney_vascular === "active_beyond_gerota"
        ) {
          grade = Math.max(grade, 5);
          gradeFindings.push("Multifragmented kidney with active bleeding");
        } else {
          grade = Math.max(grade, 4);
          gradeFindings.push("Multifragmented kidney without active bleeding");
        }
      } else if (kidney_laceration === "upj_disruption") {
        grade = Math.max(grade, 4);
        gradeFindings.push("Complete or near-complete UPJ disruption");
      } else if (
        kidney_laceration === "into_collecting" ||
        kidney_laceration === "gte2_5cm_no_cs"
      ) {
        grade = Math.max(grade, 3);
        if (kidney_laceration === "into_collecting") {
          gradeFindings.push(
            "Collecting system laceration / urinary extravasation",
          );
        } else {
          gradeFindings.push("Laceration ≥2.5 cm");
        }
      } else if (kidney_laceration === "lt2_5cm") {
        grade = Math.max(grade, 2);
        gradeFindings.push(
          "Laceration <2.5 cm, no collecting system involvement",
        );
      }

      // HEMATOMA
      if (kidney_hematoma === "pararenal_extension") {
        grade = Math.max(grade, 4);
        gradeFindings.push("Pararenal hematoma extension");
      } else if (kidney_hematoma === "hrd_gte3_5") {
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
          gradeFindings.push("Contusion without laceration");
        } else {
          gradeFindings.push("Subcapsular hematoma <3.5 cm");
        }
      }

      // URINARY EXTRAVASATION (Grade III in 2025)
      if (kidney_urinary_extrav) {
        if (grade < 4) {
          grade = Math.max(grade, 3);
        }
        gradeFindings.push("Urinary extravasation present");
      }

      const kidneyGrades = {
        1: "Minor - Contusion or subcapsular hematoma <3.5 cm",
        2: "Moderate - Small laceration <2.5 cm or limited perinephric hematoma",
        3: "Serious - Larger laceration, vascular injury without bleeding, or partial infarction",
        4: "Severe - Active bleeding, pararenal extension, multifragmented, or UPJ disruption",
        5: "Critical - Main vessel injury or multifragmented kidney with active bleeding",
      };
      gradeDescription = kidneyGrades[grade] || "";
    }

    // ============================================
    // KIDNEY GRADING — 2018 Revision (Kozar et al.)
    // ============================================
    else if (organ === "kidney" && kidney_ois_version === "2018") {
      // VASCULAR
      if (kidney_2018_vascular === "main_vessel") {
        grade = Math.max(grade, 5);
        gradeFindings.push(
          "Main renal artery or vein laceration or avulsion of hilum",
        );
      } else if (
        kidney_2018_vascular === "segmental_no_bleed" ||
        kidney_2018_vascular === "active_beyond_gerota"
      ) {
        grade = Math.max(grade, 4);
        if (kidney_2018_vascular === "segmental_no_bleed") {
          gradeFindings.push("Segmental renal artery/vein injury");
        } else {
          gradeFindings.push(
            "Active bleeding extending beyond Gerota fascia into retroperitoneum",
          );
        }
      } else if (kidney_2018_vascular === "contained_gerota") {
        grade = Math.max(grade, 3);
        gradeFindings.push(
          "Vascular injury or active bleeding contained within Gerota fascia",
        );
      }

      // INFARCTION
      if (kidney_2018_infarction === "devascularized_with_bleed") {
        grade = Math.max(grade, 5);
        gradeFindings.push("Devascularized kidney with active bleeding");
      } else if (kidney_2018_infarction === "segmental_complete_no_bleed") {
        grade = Math.max(grade, 4);
        gradeFindings.push(
          "Segmental or complete kidney infarction without active bleeding",
        );
      }

      // LACERATION
      if (kidney_2018_laceration === "shattered") {
        grade = Math.max(grade, 5);
        gradeFindings.push(
          "Shattered kidney with loss of identifiable parenchymal anatomy",
        );
      } else if (
        kidney_2018_laceration === "renal_pelvis_upj" ||
        kidney_2018_laceration === "into_collecting"
      ) {
        grade = Math.max(grade, 4);
        if (kidney_2018_laceration === "renal_pelvis_upj") {
          gradeFindings.push(
            "Laceration into renal pelvis and/or complete UPJ disruption",
          );
        } else {
          gradeFindings.push(
            "Laceration into collecting system with urinary extravasation",
          );
        }
      } else if (kidney_2018_laceration === "gt1cm_no_cs") {
        grade = Math.max(grade, 3);
        gradeFindings.push(
          "Laceration >1 cm depth without collecting system rupture",
        );
      } else if (kidney_2018_laceration === "lte1cm") {
        grade = Math.max(grade, 2);
        gradeFindings.push(
          "Laceration ≤1 cm depth without urinary extravasation",
        );
      }

      // HEMATOMA
      if (kidney_2018_hematoma === "perirenal_gerota") {
        grade = Math.max(grade, 2);
        gradeFindings.push("Perirenal hematoma confined to Gerota fascia");
      } else if (kidney_2018_hematoma === "contusion") {
        grade = Math.max(grade, 1);
        gradeFindings.push("Subcapsular hematoma and/or parenchymal contusion");
      }

      // URINARY EXTRAVASATION (Grade IV in 2018)
      if (kidney_2018_urinary_extrav) {
        grade = Math.max(grade, 4);
        gradeFindings.push("Urinary extravasation present");
      }

      const kidneyGrades = {
        1: "Minor - Subcapsular hematoma and/or contusion",
        2: "Moderate - Perirenal hematoma or small laceration ≤1 cm",
        3: "Serious - Laceration >1 cm or contained vascular injury",
        4: "Severe - Collecting system involvement, segmental vessel injury, or urinary extravasation",
        5: "Critical - Main vessel injury, shattered kidney, or devascularized with bleeding",
      };
      gradeDescription = kidneyGrades[grade] || "";
    }

    // ============================================
    // PANCREAS GRADING — 2024 Revision (Notrica et al.)
    // Ductal integrity is the primary grading determinant
    // ============================================
    else if (organ === "pancreas") {
      // DESTRUCTIVE (Grade V) — check first
      if (pancreas_destructive) {
        grade = Math.max(grade, 5);
        gradeFindings.push(
          "Destructive injury to pancreatic head with nonviable parenchyma",
        );
      }

      // DUCTAL INJURY (primary grading determinant)
      if (pancreas_duct && pancreas_duct !== "none") {
        let ductSubgrade = "";
        if (pancreas_duct === "deep_no_interrogation") {
          ductSubgrade = "Deep parenchymal without ductal interrogation (a)";
        } else if (pancreas_duct === "partial") {
          ductSubgrade = "Partial ductal injury (b)";
        } else if (pancreas_duct === "complete_transection") {
          ductSubgrade = "Complete ductal transection (c)";
        }

        if (pancreas_duct_location === "head") {
          grade = Math.max(grade, 4);
          gradeFindings.push(
            `Duct injury in pancreatic head — ${ductSubgrade}`,
          );
        } else if (pancreas_duct_location === "body_tail") {
          grade = Math.max(grade, 3);
          gradeFindings.push(`Duct injury in neck/body/tail — ${ductSubgrade}`);
        } else {
          // Duct injury selected but location not yet chosen
          grade = Math.max(grade, 3);
          gradeFindings.push(
            `Duct injury present — ${ductSubgrade} (select location for precise grading)`,
          );
        }
      }

      // PARENCHYMAL INJURY (Grades I-II, no duct involvement)
      if (
        pancreas_parenchymal === "major_contusion" ||
        pancreas_parenchymal === "major_laceration"
      ) {
        grade = Math.max(grade, 2);
        if (pancreas_parenchymal === "major_contusion") {
          gradeFindings.push(
            "Major contusion without duct injury or tissue loss",
          );
        } else {
          gradeFindings.push("Major laceration without duct injury");
        }
      } else if (
        pancreas_parenchymal === "minor_contusion" ||
        pancreas_parenchymal === "superficial_laceration"
      ) {
        grade = Math.max(grade, 1);
        if (pancreas_parenchymal === "minor_contusion") {
          gradeFindings.push("Minor contusion without duct injury");
        } else {
          gradeFindings.push("Superficial laceration without duct injury");
        }
      }

      const pancreasGrades = {
        1: "Minor - Contusion or superficial laceration without duct injury",
        2: "Moderate - Major contusion or laceration without duct injury",
        3: "Serious - Duct injury in neck/body/tail (left of portal vein/SMV)",
        4: "Severe - Duct injury in head (right of portal vein/SMV)",
        5: "Critical - Destructive injury to pancreatic head with nonviable parenchyma",
      };
      gradeDescription = pancreasGrades[grade] || "";
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

    // Management recommendations, imaging guidance, and pitfalls
    let management = "";
    let interventionConsideration = "";
    let followUp = "";
    let imagingRecommendation = "";
    let imagingPitfalls = "";

    if (organ === "liver") {
      imagingRecommendation =
        "Dual-phase CT (arterial + portal venous) is standard. Add delayed phase (5-10 min) if biliary injury or bile leak suspected. Arterial phase is critical for identifying active extravasation and pseudoaneurysm.";

      switch (grade) {
        case 1:
        case 2:
          management =
            "Non-operative management (NOM) - Observation with serial clinical and laboratory monitoring";
          interventionConsideration =
            "Intervention rarely needed; proceed to angiography only if hemodynamic deterioration";
          followUp =
            "Repeat imaging only if clinical deterioration; early mobilization";
          imagingPitfalls =
            "Subcapsular hematomas may be isoattenuating on unenhanced CT. Portal venous phase best demonstrates parenchymal laceration extent. Small contained hematomas can be missed on arterial phase alone.";
          break;
        case 3:
          management =
            "Non-operative management with close monitoring; consider angioembolization if contrast blush on CT";
          interventionConsideration =
            "Angioembolization for contained bleeding (15-25% may require); repeat CT if clinical change";
          followUp =
            "ICU observation 24-48h; serial hemoglobin; follow-up CT at 48-72h if vascular injury";
          imagingPitfalls =
            "Contained bleeding may be subtle — look for sentinel clot sign near active extravasation. Periportal tracking can mimic bile duct injury. Delayed peritoneal bleeding may develop 24-72h after initial stable imaging.";
          break;
        case 4:
          management =
            "Non-operative management in selected hemodynamically stable patients; higher likelihood of intervention";
          interventionConsideration =
            "Angioembolization for active bleeding (33-40% require intervention); operative management if unstable";
          followUp =
            "ICU observation mandatory; frequent reassessment; low threshold for intervention";
          imagingPitfalls =
            "Active extravasation extending into peritoneum may be intermittent — absence on CT does not exclude ongoing bleeding. Hepatic artery PSA may develop days after injury. Biloma formation may be delayed 1-2 weeks.";
          break;
        case 5:
          management =
            "High-risk injury requiring aggressive management; consider early operative intervention";
          interventionConsideration =
            "Operative management often required (43-57% require surgery); damage control surgery for unstable patients";
          followUp =
            "Intensive care; anticipate complications (biloma, abscess); multidisciplinary approach";
          imagingPitfalls =
            "Juxtahepatic venous injuries may show flat IVC and periportal edema rather than obvious extravasation. Retrohepatic IVC injury may be difficult to differentiate from hepatic vein injury. Hepatic devascularization can mimic normal enhancement if collateral flow is present.";
          break;
      }
    } else if (organ === "spleen") {
      imagingRecommendation =
        "Dual-phase CT (arterial + portal venous). Arterial phase is critical for detecting pseudoaneurysm, AV fistula, and active bleeding. Consider delayed imaging at 48-72h for Grade III+ to detect evolving vascular injuries.";

      switch (grade) {
        case 1:
        case 2:
          management =
            "Non-operative management (NOM) - Observation; NOM success rate >95%";
          interventionConsideration =
            "Intervention rarely needed; maintain high transfusion threshold";
          followUp =
            "Activity restriction 4-6 weeks; follow-up imaging not routinely required";
          imagingPitfalls =
            "Perisplenic clot from adjacent rib fracture or diaphragm injury may mimic splenic laceration. Motion artifact can simulate splenic injury on single-phase CT.";
          break;
        case 3:
          management =
            "Non-operative management with close monitoring; consider prophylactic angioembolization";
          interventionConsideration =
            "Proximal splenic artery embolization may improve NOM success; repeat imaging for clinical change";
          followUp =
            "ICU observation 24-48h; serial hemoglobin; activity restriction 6-8 weeks";
          imagingPitfalls =
            "Delayed splenic rupture occurs in 3-5% of cases, most within 2 weeks. Pseudoaneurysms may develop days after injury — not visible on initial CT. Contrast blush may be transient and absent on portal venous phase despite active arterial bleeding.";
          break;
        case 4:
          management =
            "Non-operative management possible with angioembolization for vascular injuries";
          interventionConsideration =
            "Angioembolization for PSA/AVF or contained bleeding; up to 80% splenic salvage with intervention";
          followUp =
            "ICU observation; anticipate possible splenectomy; vaccination planning if splenectomy likely";
          imagingPitfalls =
            "PSA/AVF may enlarge rapidly — repeat CT recommended at 48-72h even if clinically stable. Segmental devascularization may be underestimated if collateral flow partially perfuses ischemic segments.";
          break;
        case 5:
          management =
            "High-risk injury; operative management (splenectomy) often required for unstable patients";
          interventionConsideration =
            "Splenectomy for hemodynamic instability or free intraperitoneal bleeding; consider partial splenectomy if feasible";
          followUp =
            "If splenectomy: Vaccinations (pneumococcal, meningococcal, H. influenzae); lifelong infection awareness";
          imagingPitfalls =
            "Complete devascularization may show absence of enhancement without obvious extravasation — do not mistake for normal. Hilar vascular injury may present as abrupt vessel cutoff. Free intraperitoneal blood may layer dependently, mimicking ascites.";
          break;
      }
    } else if (organ === "kidney") {
      imagingRecommendation =
        "Dual-phase CT (arterial + nephrographic). ADD delayed excretory phase (10-15 min) to evaluate collecting system integrity and urinary extravasation — this is essential for Grade III+ injuries and should not be omitted.";

      switch (grade) {
        case 1:
        case 2:
          management =
            "Non-operative management (NOM) - Observation with clinical and urinalysis monitoring";
          interventionConsideration =
            "Intervention rarely needed; bed rest until gross hematuria resolves";
          followUp =
            "Follow-up ultrasound at 2-4 weeks; blood pressure monitoring long-term";
          imagingPitfalls =
            "Subcapsular hematomas may be subtle on nephrographic phase — compare with unenhanced images. Small cortical contusions can be missed on single-phase CT. Note that absence of hematuria does not exclude renal injury.";
          break;
        case 3:
          management =
            "Non-operative management with close monitoring; angioembolization for vascular injuries";
          interventionConsideration =
            "Angioembolization for PSA/AVF; urinary extravasation resolves spontaneously in 80-90% of cases";
          followUp =
            "Follow-up CT with delayed phase at 48h for urinary extravasation; urology consultation";
          imagingPitfalls =
            "Urinary extravasation requires delayed excretory phase — may be completely missed on arterial/nephrographic CT alone. Segmental infarction may appear as a subtle cortical defect; look for cortical rim sign. PSA/AVF may be small and difficult to distinguish from active bleeding.";
          break;
        case 4:
          management =
            "Non-operative management possible in stable patients; higher likelihood of intervention";
          interventionConsideration =
            "Angioembolization for active bleeding; ureteral stent or nephrostomy for persistent urinoma; exploration for UPJ disruption";
          followUp =
            "Close ICU observation; repeat imaging at 48-72h; long-term renal function monitoring";
          imagingPitfalls =
            "UPJ disruption: look for contrast in perinephric space with absent opacification of proximal ureter on delayed images. Active bleeding may be intermittent — repeat imaging if clinical concern despite negative initial CT. Pararenal hematoma extension suggests violation of Gerota fascia.";
          break;
        case 5:
          management =
            "High-risk injury; operative exploration often required; consider nephrectomy vs. reconstruction";
          interventionConsideration =
            "Nephrectomy for uncontrollable hemorrhage or complete devascularization; renal reconstruction if feasible";
          followUp =
            "Long-term renal function monitoring; blood pressure surveillance; contralateral kidney evaluation";
          imagingPitfalls =
            "Main renal artery occlusion may show absent nephrogram with cortical rim sign (capsular collaterals). Multifragmented kidney with active bleeding is a surgical emergency. Verify contralateral kidney function before considering nephrectomy.";
          break;
      }
    } else if (organ === "pancreas") {
      imagingRecommendation =
        "Dual-phase CT (arterial + portal venous) for initial assessment. MRCP or secretin-enhanced MRCP recommended when CT is indeterminate for ductal injury. Repeat CT at 12-24h if clinical suspicion persists despite normal initial scan.";

      switch (grade) {
        case 1:
        case 2:
          management =
            "Non-operative management (NOM) - Observation with serial clinical monitoring and enzyme levels";
          interventionConsideration =
            "Intervention rarely needed; NPO status and serial lipase/amylase monitoring";
          followUp =
            "Repeat imaging if clinical deterioration or rising pancreatic enzymes; advance diet as tolerated";
          imagingPitfalls =
            "Pancreatic injuries are missed on initial CT in 20-40% of cases. Contusions may appear as subtle peripancreatic fat stranding without visible parenchymal abnormality. Elevated lipase with normal CT warrants repeat imaging.";
          break;
        case 3:
          management =
            "Distal pancreatectomy (with or without splenectomy) for body/tail duct injuries; ERCP and stenting may be attempted in stable patients";
          interventionConsideration =
            "MRCP or ERCP for ductal assessment if CT indeterminate; distal pancreatectomy for confirmed transection";
          followUp =
            "Monitor for pancreatic fistula, pseudocyst formation; long-term endocrine/exocrine function surveillance";
          imagingPitfalls =
            "Ductal transection may show only as a subtle linear defect or peripancreatic fluid without clear laceration. Fluid between the splenic vein and pancreas (peripancreatic fluid sign) is a key indirect indicator of ductal injury. MRCP is more sensitive than CT for partial ductal injuries.";
          break;
        case 4:
          management =
            "Complex pancreatic head duct injuries; drainage procedures preferred over Whipple in acute setting";
          interventionConsideration =
            "Wide drainage and damage control; Whipple (pancreaticoduodenectomy) only as last resort for destruction — high morbidity";
          followUp =
            "ICU observation; anticipate pancreatic fistula/abscess; serial cross-sectional imaging; multidisciplinary hepatopancreatobiliary involvement";
          imagingPitfalls =
            "Head injuries may be obscured by adjacent duodenal injury or hematoma. Pancreatic duct injury in the head is harder to detect on CT — ERCP provides definitive assessment. Associated common bile duct injury should be actively excluded.";
          break;
        case 5:
          management =
            "Destructive pancreatic head injury requiring operative management; damage control surgery";
          interventionConsideration =
            "Damage control with wide drainage in acute phase; delayed reconstruction or Whipple if viable tissue permits";
          followUp =
            "Prolonged ICU course; high complication rate (fistula, sepsis, endocrine insufficiency); long-term pancreatic function monitoring";
          imagingPitfalls =
            "Massive pancreatic head disruption may be accompanied by duodenal, CBD, and vascular injuries — evaluate all adjacent structures. Nonviable parenchyma may show heterogeneous or absent enhancement. Vascular involvement (SMA/SMV/portal vein) must be assessed.";
          break;
      }
    }

    const organName = organ.charAt(0).toUpperCase() + organ.slice(1);
    const oisVersion =
      organ === "kidney"
        ? kidney_ois_version === "2018"
          ? "2018"
          : "2025"
        : organ === "pancreas"
          ? "2024"
          : "2018";
    const result = {
      "AAST Grade": `Grade ${grade}`,
      Organ: organName,
      ...((organ === "kidney" || organ === "pancreas") && {
        "OIS Version": oisVersion,
      }),
      "Grade Description": gradeDescription,
      "Key Findings": gradeFindings.join("; "),
      "Management Approach": management,
      "Intervention Consideration": interventionConsideration,
      "Follow-up": followUp,
      "Imaging Recommendation": imagingRecommendation,
      "Key Imaging Pitfalls": imagingPitfalls,
    };

    if (multiple_injuries && baseGrade < 3 && baseGrade > 0) {
      result["Multiple Injury Adjustment"] =
        `Base grade ${baseGrade} advanced to Grade ${grade} due to multiple injuries`;
    }

    result["CRITICAL NOTE"] =
      "HEMODYNAMIC STABILITY IS PARAMOUNT. Unstable patients require OPERATIVE MANAGEMENT regardless of anatomic grade. All management decisions should be made in consultation with trauma surgery.";

    result._severity =
      grade <= 2 ? "success" : grade === 3 ? "warning" : "danger";

    if (organ === "liver" && grade >= 4) {
      result["Liver-Specific Note"] =
        "High-grade liver injuries have significant risk of delayed bleeding, biliary complications, and hepatic necrosis. Consider damage control surgery for unstable patients.";
    } else if (organ === "spleen" && grade >= 4) {
      result["Spleen-Specific Note"] =
        "Post-splenectomy patients require immunizations and have lifelong increased infection risk. Splenic preservation should be attempted when feasible.";
    } else if (organ === "kidney") {
      if (kidney_urinary_extrav || kidney_2018_urinary_extrav) {
        result["Kidney-Specific Note"] =
          "Urinary extravasation resolves spontaneously in 80-90% of cases. Intervention indicated for enlarging urinoma, fever, persistent ileus, or suspected UPJ disruption.";
      }
    } else if (organ === "pancreas") {
      if (pancreas_duct && pancreas_duct !== "none") {
        result["Pancreas-Specific Note"] =
          "Ductal integrity is the primary determinant of pancreatic injury grade and management. MRCP or secretin-enhanced MRCP is recommended when CT is indeterminate for ductal injury. ERCP may serve both diagnostic and therapeutic roles.";
      }
      if (pancreas_destructive) {
        result["Pancreas-Specific Note"] =
          "Destructive pancreatic head injuries carry high mortality. Damage control surgery with wide drainage is preferred in the acute setting. Delayed reconstruction may be considered once the patient is stabilized.";
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
      t: "Keihani S, Tominaga GT, Swaroop M, et al. Kidney organ injury scaling: 2025 update. J Trauma Acute Care Surg. 2025;98(3):448-451.",
      u: "https://pubmed.ncbi.nlm.nih.gov/39836096/",
    },
    {
      t: "Notrica DM, Tominaga GT, Gross JA, et al. American Association for the Surgery of Trauma pancreatic organ injury scale: 2024 revision. J Trauma Acute Care Surg. 2025;98(3):442-447.",
      u: "https://doi.org/10.1097/TA.0000000000004522",
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
