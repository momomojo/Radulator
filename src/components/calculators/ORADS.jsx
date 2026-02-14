/**
 * O-RADS Calculator
 *
 * Ovarian-Adnexal Reporting and Data System for ultrasound and MRI.
 * Standardized risk stratification of adnexal lesions.
 *
 * Primary Sources:
 * - Andreotti RF, et al. Radiology. 2020 (O-RADS US)
 * - Thomassin-Naggara I, et al. Radiology. 2022 (O-RADS MRI)
 * - ACR O-RADS Resources
 */

export const ORADS = {
  id: "orads",
  category: "Women's Imaging",
  name: "ACR O-RADS",
  desc: "Ovarian-Adnexal Reporting and Data System for US and MRI",
  guidelineVersion: "ACR O-RADS 2020",
  keywords: ["ovarian", "ovary", "adnexal", "ovarian mass", "cyst"],
  tags: ["Women's Imaging", "Radiology", "Oncology"],
  metaDesc:
    "Free O-RADS Calculator. ACR risk stratification for ovarian/adnexal lesions using ultrasound or MRI with malignancy risk and management recommendations.",

  info: {
    text: `O-RADS (Ovarian-Adnexal Reporting and Data System) is the ACR standardized system for risk-stratifying adnexal lesions.

ULTRASOUND (O-RADS US v2022):
• Category 0: Incomplete evaluation
• Category 1: Normal premenopausal ovary
• Category 2: Almost certainly benign (<1% malignancy)
• Category 3: Low risk (1-10% malignancy)
• Category 4: Intermediate risk (10-50% malignancy)
• Category 5: High risk (≥50% malignancy)

MRI (O-RADS MRI):
• Category 0: Incomplete examination
• Category 1: Normal ovaries
• Category 2: Almost certainly benign (<0.5% PPV)
• Category 3: Low risk (~5% PPV)
• Category 4: Intermediate risk (~50% PPV)
• Category 5: High risk (~90% PPV)

Key concepts:
• US uses color score (1-4) for vascularity assessment
• MRI uses time-intensity curves (TIC) for solid tissue
• Solid tissue must be enhancing (not clot, fat, or debris)
• Peritoneal findings upgrade to category 5`,
    link: {
      label: "View ACR O-RADS Resources",
      url: "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/O-RADS",
    },
  },

  fields: [
    // MODALITY SELECTION
    {
      id: "modality",
      label: "Imaging Modality",
      type: "radio",
      opts: [
        { value: "us", label: "Ultrasound (O-RADS US)" },
        { value: "mri", label: "MRI (O-RADS MRI)" },
      ],
    },

    // STUDY COMPLETE
    {
      id: "study_complete",
      label: "Study Complete/Diagnostic",
      type: "radio",
      opts: [
        { value: "yes", label: "Yes - Complete evaluation" },
        { value: "no", label: "No - Incomplete (Category 0)" },
      ],
    },

    // ========== ULTRASOUND FIELDS ==========
    // MENOPAUSAL STATUS
    {
      id: "us_menopausal",
      label: "Menopausal Status",
      type: "radio",
      showIf: (vals) => vals.modality === "us" && vals.study_complete === "yes",
      opts: [
        { value: "premenopausal", label: "Premenopausal" },
        { value: "postmenopausal", label: "Postmenopausal" },
      ],
    },

    // US FINDING TYPE
    {
      id: "us_finding",
      label: "Primary US Finding",
      type: "radio",
      showIf: (vals) => vals.modality === "us" && vals.study_complete === "yes",
      opts: [
        {
          value: "normal",
          label: "Normal ovary / physiologic follicle or corpus luteum ≤3cm",
        },
        {
          value: "simple_cyst",
          label: "Simple cyst (anechoic, smooth thin wall)",
        },
        {
          value: "classic_benign",
          label:
            "Classic benign (hemorrhagic cyst, dermoid, endometrioma, hydrosalpinx)",
        },
        { value: "unilocular", label: "Unilocular non-simple cyst" },
        { value: "multilocular", label: "Multilocular cyst" },
        { value: "solid", label: "Solid lesion" },
      ],
    },

    // US CYST SIZE
    {
      id: "us_size",
      label: "Lesion Size (cm)",
      type: "number",
      showIf: (vals) =>
        vals.modality === "us" &&
        vals.us_finding &&
        vals.us_finding !== "normal",
    },

    // US INNER WALL (for cystic lesions)
    {
      id: "us_inner_wall",
      label: "Inner Wall/Septation Morphology",
      type: "radio",
      showIf: (vals) =>
        vals.modality === "us" &&
        (vals.us_finding === "unilocular" ||
          vals.us_finding === "multilocular"),
      opts: [
        { value: "smooth", label: "Smooth" },
        { value: "irregular", label: "Irregular" },
      ],
    },

    // US SOLID COMPONENT
    {
      id: "us_solid_component",
      label: "Solid Component (≥3mm)",
      type: "radio",
      showIf: (vals) =>
        vals.modality === "us" &&
        (vals.us_finding === "unilocular" ||
          vals.us_finding === "multilocular"),
      opts: [
        { value: "none", label: "None" },
        { value: "papillary_1_3", label: "Papillary projections (1-3)" },
        { value: "papillary_4_plus", label: "Papillary projections (≥4)" },
        { value: "solid", label: "Solid component present" },
      ],
    },

    // US SOLID CONTOUR
    {
      id: "us_solid_contour",
      label: "Solid Lesion Outer Contour",
      type: "radio",
      showIf: (vals) => vals.modality === "us" && vals.us_finding === "solid",
      opts: [
        { value: "smooth", label: "Smooth" },
        { value: "irregular", label: "Irregular" },
      ],
    },

    // US COLOR SCORE
    {
      id: "us_color_score",
      label: "Color Score (Doppler Vascularity)",
      type: "radio",
      showIf: (vals) =>
        vals.modality === "us" &&
        (vals.us_finding === "multilocular" ||
          vals.us_finding === "solid" ||
          (vals.us_solid_component && vals.us_solid_component !== "none")),
      opts: [
        { value: "1", label: "CS 1 - No flow" },
        { value: "2", label: "CS 2 - Minimal flow" },
        { value: "3", label: "CS 3 - Moderate flow" },
        { value: "4", label: "CS 4 - Very strong flow" },
      ],
    },

    // US ACOUSTIC SHADOWING (for solid)
    {
      id: "us_shadowing",
      label: "Acoustic Shadowing",
      type: "radio",
      showIf: (vals) =>
        vals.modality === "us" &&
        vals.us_finding === "solid" &&
        vals.us_solid_contour === "smooth",
      opts: [
        { value: "yes", label: "Present" },
        { value: "no", label: "Absent" },
      ],
    },

    // ========== MRI FIELDS ==========
    // MRI FINDING TYPE
    {
      id: "mri_finding",
      label: "Primary MRI Finding",
      type: "radio",
      showIf: (vals) =>
        vals.modality === "mri" && vals.study_complete === "yes",
      opts: [
        { value: "normal", label: "Normal ovaries" },
        { value: "unilocular_simple", label: "Unilocular cyst - simple fluid" },
        {
          value: "unilocular_nonsimple",
          label:
            "Unilocular cyst - non-simple fluid (hemorrhagic/endometriotic)",
        },
        { value: "multilocular", label: "Multilocular cyst" },
        { value: "lipid", label: "Lipid-containing (dermoid)" },
        {
          value: "dark_t2_dwi",
          label: "T2 dark/DWI dark solid (fibroma-type)",
        },
        { value: "solid_enhancing", label: "Enhancing solid tissue" },
        { value: "paraovarian", label: "Paraovarian cyst / hydrosalpinx" },
      ],
    },

    // MRI WALL ENHANCEMENT
    {
      id: "mri_wall_enhancement",
      label: "Wall Enhancement",
      type: "radio",
      showIf: (vals) =>
        vals.modality === "mri" &&
        (vals.mri_finding === "unilocular_simple" ||
          vals.mri_finding === "unilocular_nonsimple"),
      opts: [
        { value: "none", label: "No wall enhancement" },
        { value: "smooth", label: "Smooth wall enhancement" },
      ],
    },

    // MRI SOLID TISSUE
    {
      id: "mri_solid_tissue",
      label: "Enhancing Solid Tissue",
      type: "radio",
      showIf: (vals) =>
        vals.modality === "mri" &&
        (vals.mri_finding === "unilocular_nonsimple" ||
          vals.mri_finding === "multilocular"),
      opts: [
        { value: "none", label: "None" },
        {
          value: "present",
          label:
            "Present (papillary projections, mural nodules, irregular wall)",
        },
      ],
    },

    // MRI LIPID SOLID TISSUE
    {
      id: "mri_lipid_solid",
      label: "Large Enhancing Solid Tissue in Dermoid",
      type: "radio",
      showIf: (vals) => vals.modality === "mri" && vals.mri_finding === "lipid",
      opts: [
        { value: "none", label: "None (small Rokitansky nodule OK)" },
        { value: "present", label: "Large-volume enhancing solid tissue" },
      ],
    },

    // MRI TIC TYPE
    {
      id: "mri_tic",
      label: "Time-Intensity Curve (TIC)",
      type: "radio",
      showIf: (vals) =>
        vals.modality === "mri" &&
        (vals.mri_solid_tissue === "present" ||
          vals.mri_finding === "solid_enhancing" ||
          vals.mri_finding === "dark_t2_dwi"),
      opts: [
        { value: "low", label: "Low-risk TIC (gradual, no plateau)" },
        {
          value: "intermediate",
          label: "Intermediate-risk TIC (slope ≤ myometrium, plateau)",
        },
        { value: "high", label: "High-risk TIC (slope > myometrium, plateau)" },
      ],
    },

    // ========== COMMON FIELD ==========
    // PERITONEAL FINDINGS
    {
      id: "peritoneal",
      label: "Peritoneal/Omental Findings",
      type: "radio",
      showIf: (vals) =>
        vals.study_complete === "yes" &&
        vals.modality &&
        ((vals.modality === "us" &&
          vals.us_finding &&
          vals.us_finding !== "normal") ||
          (vals.modality === "mri" &&
            vals.mri_finding &&
            vals.mri_finding !== "normal")),
      opts: [
        { value: "none", label: "None" },
        { value: "present", label: "Ascites and/or peritoneal nodularity" },
      ],
    },
  ],

  compute: (vals) => {
    const { modality = "", study_complete = "", peritoneal = "" } = vals;

    if (!modality) {
      return { Error: "Please select imaging modality (US or MRI)." };
    }

    // Category 0: Incomplete
    if (study_complete === "no") {
      return {
        "O-RADS Category": `O-RADS ${modality.toUpperCase()} 0 - Incomplete`,
        Management: "Additional imaging required for complete evaluation",
        _severity: "info",
      };
    }

    // Peritoneal disease -> Category 5
    if (peritoneal === "present") {
      return {
        "O-RADS Category": `O-RADS ${modality.toUpperCase()} 5 - High Risk`,
        "Malignancy Risk": modality === "us" ? "≥50%" : "~90%",
        Management: "Referral to gynecologic oncologist",
        "Critical Finding":
          "Peritoneal disease (ascites/nodularity) indicates high malignancy risk",
        _severity: "danger",
      };
    }

    // ========== ULTRASOUND SCORING ==========
    if (modality === "us") {
      return computeORADSUS(vals);
    }

    // ========== MRI SCORING ==========
    if (modality === "mri") {
      return computeORADSMRI(vals);
    }

    return { Error: "Unable to compute O-RADS category." };
  },

  refs: [
    {
      t: "Andreotti RF, Timmerman D, Strachowski LM, et al. O-RADS US Risk Stratification and Management System. Radiology. 2020;294(1):168-185.",
      u: "https://pubmed.ncbi.nlm.nih.gov/31687921/",
    },
    {
      t: "Strachowski LM, Jha P, Phillips CH, et al. O-RADS US v2022: An Update. Radiology. 2023;308(3):e230685.",
      u: "https://pubmed.ncbi.nlm.nih.gov/37698472/",
    },
    {
      t: "Thomassin-Naggara I, Rockall A, Glanc P, et al. O-RADS MRI Risk Stratification System. Radiology. 2022;303(1):35-47.",
      u: "https://pubmed.ncbi.nlm.nih.gov/35040672/",
    },
    {
      t: "ACR O-RADS Ultrasound Resources.",
      u: "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/O-RADS/Ultrasound",
    },
    {
      t: "ACR O-RADS MRI Resources.",
      u: "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/O-RADS/MRI",
    },
  ],
};

function computeORADSUS(vals) {
  const {
    us_menopausal = "",
    us_finding = "",
    us_size = "",
    us_inner_wall = "",
    us_solid_component = "",
    us_solid_contour = "",
    us_color_score = "",
    us_shadowing = "",
  } = vals;

  if (!us_finding) {
    return { Error: "Please select the primary US finding." };
  }

  const size = parseFloat(us_size) || 0;
  const cs = parseInt(us_color_score) || 1;

  // Category 1: Normal
  if (us_finding === "normal") {
    return {
      "O-RADS Category": "O-RADS US 1 - Normal/Physiologic",
      "Malignancy Risk": "0%",
      Management: "No follow-up needed",
      _severity: "success",
    };
  }

  // Simple cyst
  if (us_finding === "simple_cyst") {
    if (size <= 10) {
      return {
        "O-RADS Category": "O-RADS US 2 - Almost Certainly Benign",
        "Malignancy Risk": "<1%",
        Management:
          us_menopausal === "premenopausal"
            ? "No follow-up needed"
            : "Consider 1-year follow-up",
        Lesion: `Simple cyst ${size}cm`,
        _severity: "success",
      };
    } else {
      return {
        "O-RADS Category": "O-RADS US 3 - Low Risk",
        "Malignancy Risk": "1-10%",
        Management: "Gynecologist evaluation",
        Lesion: `Large simple cyst ${size}cm`,
        _severity: "warning",
      };
    }
  }

  // Classic benign
  if (us_finding === "classic_benign") {
    if (size < 10) {
      return {
        "O-RADS Category": "O-RADS US 2 - Almost Certainly Benign",
        "Malignancy Risk": "<1%",
        Management: "Symptomatic management; no imaging follow-up needed",
        Lesion: `Classic benign lesion ${size}cm`,
        _severity: "success",
      };
    } else {
      return {
        "O-RADS Category": "O-RADS US 3 - Low Risk",
        "Malignancy Risk": "1-10%",
        Management: "Gynecologist evaluation due to size",
        Lesion: `Classic benign lesion ${size}cm (large)`,
        _severity: "warning",
      };
    }
  }

  // Unilocular non-simple
  if (us_finding === "unilocular") {
    if (us_solid_component === "papillary_4_plus") {
      return {
        "O-RADS Category": "O-RADS US 5 - High Risk",
        "Malignancy Risk": "≥50%",
        Management: "Gynecologic oncologist referral",
        Lesion: "Unilocular cyst with ≥4 papillary projections",
        _severity: "danger",
      };
    }
    if (us_solid_component === "papillary_1_3") {
      return {
        "O-RADS Category": "O-RADS US 4 - Intermediate Risk",
        "Malignancy Risk": "10-50%",
        Management: "Gynecologist with gyn-oncology consultation",
        Lesion: "Unilocular cyst with 1-3 papillary projections",
        _severity: "danger",
      };
    }
    if (us_inner_wall === "irregular" || size > 10) {
      return {
        "O-RADS Category": "O-RADS US 3 - Low Risk",
        "Malignancy Risk": "1-10%",
        Management: "6-month follow-up US or gynecologist evaluation",
        Lesion: `Unilocular cyst, ${us_inner_wall} wall, ${size}cm`,
        _severity: "warning",
      };
    }
    return {
      "O-RADS Category": "O-RADS US 2 - Almost Certainly Benign",
      "Malignancy Risk": "<1%",
      Management: "Consider follow-up if symptomatic",
      Lesion: `Unilocular cyst with smooth wall, ${size}cm`,
      _severity: "success",
    };
  }

  // Multilocular
  if (us_finding === "multilocular") {
    if (
      us_solid_component === "solid" ||
      us_solid_component === "papillary_4_plus"
    ) {
      if (cs >= 3) {
        return {
          "O-RADS Category": "O-RADS US 5 - High Risk",
          "Malignancy Risk": "≥50%",
          Management: "Gynecologic oncologist referral",
          Lesion: `Multilocular with solid component, CS ${cs}`,
          _severity: "danger",
        };
      } else {
        return {
          "O-RADS Category": "O-RADS US 4 - Intermediate Risk",
          "Malignancy Risk": "10-50%",
          Management: "Gynecologist with gyn-oncology consultation",
          Lesion: `Multilocular with solid component, CS ${cs}`,
          _severity: "danger",
        };
      }
    }
    if (us_inner_wall === "irregular" || size >= 10 || cs === 4) {
      return {
        "O-RADS Category": "O-RADS US 4 - Intermediate Risk",
        "Malignancy Risk": "10-50%",
        Management: "Gynecologist with gyn-oncology consultation; MRI may help",
        Lesion: `Multilocular cyst, ${us_inner_wall} walls, ${size}cm, CS ${cs}`,
        _severity: "danger",
      };
    }
    return {
      "O-RADS Category": "O-RADS US 3 - Low Risk",
      "Malignancy Risk": "1-10%",
      Management: "6-month follow-up US",
      Lesion: `Multilocular cyst with smooth walls, ${size}cm, CS ${cs}`,
      _severity: "warning",
    };
  }

  // Solid
  if (us_finding === "solid") {
    if (us_solid_contour === "irregular") {
      return {
        "O-RADS Category": "O-RADS US 5 - High Risk",
        "Malignancy Risk": "≥50%",
        Management: "Gynecologic oncologist referral",
        Lesion: "Solid lesion with irregular contour",
        _severity: "danger",
      };
    }
    if (cs === 4) {
      return {
        "O-RADS Category": "O-RADS US 5 - High Risk",
        "Malignancy Risk": "≥50%",
        Management: "Gynecologic oncologist referral",
        Lesion: "Solid smooth lesion with CS 4",
        _severity: "danger",
      };
    }
    if (cs === 1 || (us_shadowing === "yes" && cs < 4)) {
      return {
        "O-RADS Category": "O-RADS US 3 - Low Risk",
        "Malignancy Risk": "1-10%",
        Management: "6-month follow-up; may represent fibroma",
        Lesion: `Solid smooth lesion, CS ${cs}${us_shadowing === "yes" ? ", shadowing" : ""}`,
        _severity: "warning",
      };
    }
    return {
      "O-RADS Category": "O-RADS US 4 - Intermediate Risk",
      "Malignancy Risk": "10-50%",
      Management: "MRI for further characterization; gynecologist referral",
      Lesion: `Solid smooth lesion, CS ${cs}`,
      _severity: "danger",
    };
  }

  return { Error: "Unable to classify US finding." };
}

function computeORADSMRI(vals) {
  const {
    mri_finding = "",
    mri_wall_enhancement = "",
    mri_solid_tissue = "",
    mri_lipid_solid = "",
    mri_tic = "",
  } = vals;

  if (!mri_finding) {
    return { Error: "Please select the primary MRI finding." };
  }

  // Category 1: Normal
  if (mri_finding === "normal") {
    return {
      "O-RADS Category": "O-RADS MRI 1 - Normal",
      PPV: "0%",
      Management: "No follow-up needed",
      _severity: "success",
    };
  }

  // Paraovarian/Hydrosalpinx
  if (mri_finding === "paraovarian") {
    return {
      "O-RADS Category": "O-RADS MRI 2 - Almost Certainly Benign",
      PPV: "<0.5%",
      Management: "No follow-up needed",
      Lesion: "Paraovarian cyst/hydrosalpinx",
      _severity: "success",
    };
  }

  // Unilocular simple
  if (mri_finding === "unilocular_simple") {
    if (mri_wall_enhancement === "none") {
      return {
        "O-RADS Category": "O-RADS MRI 2 - Almost Certainly Benign",
        PPV: "<0.5%",
        Management: "No follow-up needed",
        Lesion: "Unilocular simple cyst without wall enhancement",
        _severity: "success",
      };
    }
    return {
      "O-RADS Category": "O-RADS MRI 3 - Low Risk",
      PPV: "~5%",
      Management: "Follow-up imaging recommended",
      Lesion: "Unilocular cyst with smooth wall enhancement",
      _severity: "warning",
    };
  }

  // Unilocular non-simple
  if (mri_finding === "unilocular_nonsimple") {
    if (mri_solid_tissue === "none") {
      return {
        "O-RADS Category": "O-RADS MRI 2 - Almost Certainly Benign",
        PPV: "<0.5%",
        Management:
          "No follow-up needed for endometrioma/hemorrhagic cyst appearance",
        Lesion: "Unilocular cyst with non-simple fluid, no solid tissue",
        _severity: "success",
      };
    }
    // Has solid tissue - use TIC
    return computeByTIC(mri_tic, "Unilocular with solid tissue");
  }

  // Multilocular
  if (mri_finding === "multilocular") {
    if (mri_solid_tissue === "none") {
      return {
        "O-RADS Category": "O-RADS MRI 3 - Low Risk",
        PPV: "~5%",
        Management: "Follow-up imaging recommended",
        Lesion: "Multilocular cyst without solid tissue",
        _severity: "warning",
      };
    }
    return computeByTIC(mri_tic, "Multilocular with solid tissue");
  }

  // Lipid-containing (dermoid)
  if (mri_finding === "lipid") {
    if (mri_lipid_solid === "none") {
      return {
        "O-RADS Category": "O-RADS MRI 2 - Almost Certainly Benign",
        PPV: "<0.5%",
        Management: "No follow-up needed; manage symptomatically",
        Lesion: "Dermoid without significant solid tissue",
        _severity: "success",
      };
    }
    return {
      "O-RADS Category": "O-RADS MRI 4 - Intermediate Risk",
      PPV: "~50%",
      Management: "Gynecologist with gyn-oncology consultation",
      Lesion:
        "Dermoid with large enhancing solid tissue - malignant transformation?",
      _severity: "danger",
    };
  }

  // T2 dark/DWI dark (fibroma-type)
  if (mri_finding === "dark_t2_dwi") {
    return {
      "O-RADS Category": "O-RADS MRI 2 - Almost Certainly Benign",
      PPV: "<0.5%",
      Management: "No follow-up needed; consistent with fibroma/Brenner",
      Lesion: "T2 dark/DWI dark solid tissue (fibrous)",
      _severity: "success",
    };
  }

  // Enhancing solid tissue
  if (mri_finding === "solid_enhancing") {
    return computeByTIC(mri_tic, "Enhancing solid tissue");
  }

  return { Error: "Unable to classify MRI finding." };
}

function computeByTIC(tic, lesionDesc) {
  if (!tic) {
    return {
      "O-RADS Category": "O-RADS MRI 4 or 5 - TIC Needed",
      Management: "TIC analysis required for definitive categorization",
      Lesion: lesionDesc,
      _severity: "danger",
    };
  }

  if (tic === "low") {
    return {
      "O-RADS Category": "O-RADS MRI 3 - Low Risk",
      PPV: "~5%",
      Management: "Follow-up imaging or clinical management",
      Lesion: `${lesionDesc}, low-risk TIC`,
      _severity: "warning",
    };
  }
  if (tic === "intermediate") {
    return {
      "O-RADS Category": "O-RADS MRI 4 - Intermediate Risk",
      PPV: "~50%",
      Management: "Gynecologist with gyn-oncology consultation",
      Lesion: `${lesionDesc}, intermediate-risk TIC`,
      _severity: "danger",
    };
  }
  return {
    "O-RADS Category": "O-RADS MRI 5 - High Risk",
    PPV: "~90%",
    Management: "Gynecologic oncologist referral",
    Lesion: `${lesionDesc}, high-risk TIC`,
    _severity: "danger",
  };
}
