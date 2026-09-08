/**
 * DLP to Effective Dose Calculator
 *
 * Converts CT Dose Length Product (DLP) to estimated effective dose using
 * ICRP-defined conversion factors (k-factors) based on anatomical region.
 * Essential for radiation dose monitoring and patient counseling.
 *
 * Primary Sources:
 * - ICRP Publication 103 (2007) - Effective dose coefficients
 * - AAPM Report 96 (2008) - CT dose descriptors
 * - European Commission EUR 16262 (CT Quality Criteria)
 * - Deak PD, et al. Radiology. 2010;257(1):158-166 (age/sex-specific factors)
 */

export const DLPDose = {
  id: "dlp-dose",
  category: "Radiology",
  name: "DLP to Effective Dose",
  desc: "Convert CT Dose Length Product to estimated effective radiation dose",
  guidelineVersion: "ICRP 103 (2007)",
  keywords: ["radiation dose", "effective dose", "CT dose", "DLP", "mSv"],
  tags: ["Radiology", "Safety", "Radiation"],
  metaDesc:
    "Free DLP to Effective Dose Calculator. Convert CT Dose Length Product (DLP) to effective dose in mSv using ICRP conversion factors for radiation dose tracking.",

  info: {
    text: `This calculator converts CT Dose Length Product (DLP) to estimated effective dose using region-specific conversion factors (k-factors).

Dose Length Product (DLP):
• Unit: mGy·cm
• Represents total radiation energy delivered
• Displayed on CT console or dose report
• DLP = CTDIvol × scan length

Effective Dose:
• Unit: millisieverts (mSv)
• Accounts for tissue radiosensitivity
• Allows comparison across imaging modalities
• Formula: Effective Dose = DLP × k-factor

K-factors vary by anatomical region due to different tissue compositions and radiosensitivity. Pediatric patients have higher k-factors due to smaller body size and more radiosensitive tissues.

Reference effective doses for context:
• Background radiation (US avg): ~3 mSv/year
• Chest X-ray: ~0.1 mSv
• CT Chest: ~7 mSv
• CT Abdomen/Pelvis: ~10 mSv`,
    link: {
      label: "View AAPM Report 96",
      url: "https://www.aapm.org/pubs/reports/RPT_96.pdf",
    },
  },

  fields: [
    // DLP INPUT
    {
      id: "dlp",
      label: "Dose Length Product (DLP)",
      subLabel: "mGy·cm (from CT console or dose report)",
      type: "number",
    },

    // ANATOMICAL REGION
    {
      id: "body_region",
      label: "Anatomical Region",
      type: "select",
      opts: [
        { value: "head", label: "Head" },
        { value: "neck", label: "Neck" },
        { value: "chest", label: "Chest" },
        { value: "abdomen", label: "Abdomen" },
        { value: "pelvis", label: "Pelvis" },
        { value: "abdomen_pelvis", label: "Abdomen + Pelvis (combined)" },
        { value: "chest_abdomen_pelvis", label: "Chest + Abdomen + Pelvis" },
        { value: "spine_cervical", label: "Spine - Cervical" },
        { value: "spine_thoracic", label: "Spine - Thoracic" },
        { value: "spine_lumbar", label: "Spine - Lumbar" },
        { value: "extremity", label: "Extremity" },
      ],
    },

    // PATIENT AGE GROUP
    {
      id: "age_group",
      label: "Patient Age Group",
      type: "select",
      opts: [
        { value: "adult", label: "Adult" },
        { value: "child_10", label: "Child (10 years)" },
        { value: "child_5", label: "Child (5 years)" },
        { value: "child_1", label: "Child (1 year)" },
        { value: "newborn", label: "Newborn (0 years)" },
      ],
    },
  ],

  compute: (vals) => {
    const { dlp = "", body_region = "", age_group = "" } = vals;

    // Validate inputs
    if (!dlp || parseFloat(dlp) <= 0) {
      return {
        Error: "Please enter a valid DLP value (mGy·cm).",
      };
    }

    if (!body_region) {
      return {
        Error: "Please select an anatomical region.",
      };
    }

    const dlpValue = parseFloat(dlp);
    const ageCategory = age_group || "adult";

    // K-factors (mSv / mGy·cm) based on ICRP Publication 103 and European Commission data
    // Format: { region: { ageGroup: k-factor } }
    const kFactors = {
      head: {
        adult: 0.0021,
        child_10: 0.0027,
        child_5: 0.0035,
        child_1: 0.0054,
        newborn: 0.011,
      },
      neck: {
        adult: 0.0059,
        child_10: 0.0076,
        child_5: 0.0095,
        child_1: 0.013,
        newborn: 0.017,
      },
      chest: {
        adult: 0.014,
        child_10: 0.018,
        child_5: 0.023,
        child_1: 0.039,
        newborn: 0.054,
      },
      abdomen: {
        adult: 0.015,
        child_10: 0.02,
        child_5: 0.026,
        child_1: 0.041,
        newborn: 0.056,
      },
      pelvis: {
        adult: 0.015,
        child_10: 0.019,
        child_5: 0.025,
        child_1: 0.04,
        newborn: 0.055,
      },
      abdomen_pelvis: {
        adult: 0.015,
        child_10: 0.0195,
        child_5: 0.0255,
        child_1: 0.0405,
        newborn: 0.0555,
      },
      chest_abdomen_pelvis: {
        adult: 0.015,
        child_10: 0.019,
        child_5: 0.025,
        child_1: 0.04,
        newborn: 0.055,
      },
      spine_cervical: {
        adult: 0.0059,
        child_10: 0.0076,
        child_5: 0.0095,
        child_1: 0.013,
        newborn: 0.017,
      },
      spine_thoracic: {
        adult: 0.014,
        child_10: 0.018,
        child_5: 0.023,
        child_1: 0.039,
        newborn: 0.054,
      },
      spine_lumbar: {
        adult: 0.015,
        child_10: 0.02,
        child_5: 0.026,
        child_1: 0.041,
        newborn: 0.056,
      },
      extremity: {
        adult: 0.0008,
        child_10: 0.001,
        child_5: 0.0013,
        child_1: 0.002,
        newborn: 0.003,
      },
    };

    // Get appropriate k-factor
    const regionFactors = kFactors[body_region];
    if (!regionFactors) {
      return { Error: "Invalid body region selected." };
    }

    const kFactor = regionFactors[ageCategory] || regionFactors.adult;

    // Calculate effective dose
    const effectiveDose = dlpValue * kFactor;

    // Format region name
    const regionNames = {
      head: "Head",
      neck: "Neck",
      chest: "Chest",
      abdomen: "Abdomen",
      pelvis: "Pelvis",
      abdomen_pelvis: "Abdomen + Pelvis",
      chest_abdomen_pelvis: "Chest + Abdomen + Pelvis",
      spine_cervical: "Cervical Spine",
      spine_thoracic: "Thoracic Spine",
      spine_lumbar: "Lumbar Spine",
      extremity: "Extremity",
    };

    const ageNames = {
      adult: "Adult",
      child_10: "10-year-old",
      child_5: "5-year-old",
      child_1: "1-year-old",
      newborn: "Newborn",
    };

    // Build result
    const result = {
      "Effective Dose": `${effectiveDose.toFixed(2)} mSv`,
      "K-Factor Used": `${kFactor} mSv/(mGy·cm)`,
      "Body Region": regionNames[body_region],
      "Age Group": ageNames[ageCategory],
      "Input DLP": `${dlpValue} mGy·cm`,
    };

    // Add context with equivalent doses
    const contexts = [];
    const chestXrayEquiv = effectiveDose / 0.1;
    contexts.push(`~${Math.round(chestXrayEquiv)} chest X-rays equivalent`);

    const backgroundDays = (effectiveDose / 3) * 365;
    if (backgroundDays < 365) {
      contexts.push(`~${Math.round(backgroundDays)} days background radiation`);
    } else {
      const years = (effectiveDose / 3).toFixed(1);
      contexts.push(`~${years} years background radiation`);
    }

    result["Dose Context"] = contexts.join("; ");

    // Risk assessment (linear no-threshold model estimate)
    // Approximately 5% per Sievert lifetime cancer risk (ICRP)
    const lifetimeRiskPercent = (effectiveDose / 1000) * 5 * 100;
    if (lifetimeRiskPercent >= 0.01) {
      result["Estimated Additional Lifetime Cancer Risk"] =
        `~${lifetimeRiskPercent.toFixed(3)}% (population average, highly uncertain)`;
    } else {
      result["Estimated Additional Lifetime Cancer Risk"] =
        "<0.01% (negligible at population level)";
    }

    // Typical reference values
    const typicalDLP = getTypicalDLP(body_region);
    if (typicalDLP) {
      result["Typical DLP Range (Adult)"] = typicalDLP;

      // Compare to reference
      const refRange = typicalDLP.match(/(\d+)-?(\d+)?/);
      if (refRange) {
        const refMid = refRange[2]
          ? (parseInt(refRange[1]) + parseInt(refRange[2])) / 2
          : parseInt(refRange[1]);
        if (dlpValue > refMid * 1.5) {
          result["Dose Alert"] =
            "DLP is significantly above typical reference levels. Verify clinical justification and protocol optimization.";
        }
      }
    }

    // Notes for specific regions
    if (body_region === "head" && ageCategory !== "adult") {
      result["Pediatric Note"] =
        "Pediatric head CT has relatively lower k-factor increase compared to body CT due to smaller scan length, but brain sensitivity in children warrants dose optimization.";
    }

    if (ageCategory !== "adult") {
      result["Pediatric Consideration"] =
        "Children have increased radiation sensitivity. Ensure protocols are optimized for pediatric patients (Image Gently principles).";
    }

    return result;
  },

  refs: [
    {
      t: "ICRP Publication 103. The 2007 Recommendations of the International Commission on Radiological Protection. Ann ICRP. 2007;37(2-4):1-332.",
      u: "https://doi.org/10.1016/j.icrp.2007.10.003",
    },
    {
      t: "AAPM Report No. 96. The Measurement, Reporting, and Management of Radiation Dose in CT. American Association of Physicists in Medicine. 2008.",
      u: "https://www.aapm.org/pubs/reports/RPT_96.pdf",
    },
    {
      t: "European Commission. EUR 16262: European Guidelines on Quality Criteria for Computed Tomography. 2000.",
      u: "https://op.europa.eu/en/publication-detail/-/publication/d229c9e1-a967-49de-b169-59ee68605f1a",
    },
    {
      t: "Deak PD, Smal Y, Kalender WA. Multisection CT protocols: sex- and age-specific conversion factors used to determine effective dose from dose-length product. Radiology. 2010;257(1):158-166.",
      u: "https://doi.org/10.1148/radiol.10100047",
    },
    {
      t: "ACR-AAPM Technical Standard for Diagnostic Medical Physics Performance Monitoring of Computed Tomography Equipment.",
      u: "https://www.acr.org/Clinical-Resources/Radiology-Safety/Radiation-Safety",
    },
    {
      t: "Image Gently Campaign - Alliance for Radiation Safety in Pediatric Imaging.",
      u: "https://www.imagegently.org/",
    },
  ],
};

// Helper function for typical DLP reference values
function getTypicalDLP(region) {
  const typicalValues = {
    head: "850-1050 mGy·cm",
    neck: "300-600 mGy·cm",
    chest: "200-600 mGy·cm",
    abdomen: "300-700 mGy·cm",
    pelvis: "300-600 mGy·cm",
    abdomen_pelvis: "500-1000 mGy·cm",
    chest_abdomen_pelvis: "700-1500 mGy·cm",
    spine_cervical: "200-400 mGy·cm",
    spine_thoracic: "250-450 mGy·cm",
    spine_lumbar: "300-550 mGy·cm",
    extremity: "50-150 mGy·cm",
  };
  return typicalValues[region] || null;
}
