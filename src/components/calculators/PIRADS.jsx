/**
 * PI-RADS v2.1 Calculator
 * Prostate Imaging Reporting and Data System
 *
 * PI-RADS v2.1 is a standardized scoring system for prostate MRI that stratifies
 * the likelihood of clinically significant prostate cancer based on multiparametric
 * MRI findings. Scoring depends on the anatomic zone (Peripheral vs Transition Zone)
 * with different dominant sequences for each.
 *
 * Primary Sources:
 * - Turkbey B, et al. Radiology. 2019;290(2):525-530 (PI-RADS v2.1)
 * - Weinreb JC, et al. Eur Urol. 2016;69(1):16-40 (PI-RADS v2)
 * - ACR PI-RADS v2.1 Document (2019)
 */

export const PIRADS = {
  id: "pirads",
  category: "Urology",
  name: "PI-RADS v2.1",
  desc: "Prostate MRI risk stratification for clinically significant cancer",
  keywords: ["prostate", "MRI", "prostate cancer", "PCa", "mpMRI"],
  tags: ["Urology", "Radiology"],
  metaDesc:
    "Free PI-RADS v2.1 Calculator. Prostate Imaging Reporting and Data System for MRI-based risk stratification of clinically significant prostate cancer.",

  info: {
    text: `PI-RADS (Prostate Imaging Reporting and Data System) v2.1 is the standardized system for reporting prostate MRI findings.

Key Principles:
• Peripheral Zone (PZ): DWI is the dominant sequence
• Transition Zone (TZ): T2W is the dominant sequence
• DCE can upgrade PZ lesions from PI-RADS 3 to 4
• DWI can upgrade TZ lesions if score exceeds T2W

Categories indicate likelihood of clinically significant cancer (Gleason ≥7):
• PI-RADS 1-2: Biopsy generally not recommended
• PI-RADS 3: Individualized decision based on clinical factors
• PI-RADS 4-5: Biopsy recommended

This calculator follows the 2019 PI-RADS v2.1 guidelines.`,
    link: {
      label: "View PI-RADS v2.1 Guidelines",
      url: "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/PI-RADS",
    },
  },

  fields: [
    // SECTION 1: LESION LOCATION
    {
      id: "zone",
      label: "Anatomic Zone",
      type: "radio",
      opts: [
        { value: "pz", label: "Peripheral Zone (PZ)" },
        { value: "tz", label: "Transition Zone (TZ)" },
        { value: "cz", label: "Central Zone (CZ) - use PZ criteria" },
        {
          value: "afs",
          label: "Anterior Fibromuscular Stroma (AFS) - use TZ criteria",
        },
      ],
    },

    // SECTION 2: LESION SIZE
    {
      id: "lesion_size",
      label: "Lesion Size (cm)",
      subLabel: "Largest diameter on axial images",
      type: "number",
    },

    // SECTION 3: T2-WEIGHTED IMAGING
    {
      id: "t2w_score",
      label: "T2-Weighted (T2W) Score",
      type: "radio",
      opts: [
        {
          value: "1",
          label: "1 - Normal (uniform hyperintense PZ / heterogeneous TZ)",
        },
        {
          value: "2",
          label: "2 - Linear/wedge-shaped or indistinct hypointensity",
        },
        {
          value: "3",
          label:
            "3 - Heterogeneous or non-circumscribed, moderately hypointense",
        },
        {
          value: "4",
          label:
            "4 - Circumscribed, homogeneous, moderately hypointense, <1.5 cm",
        },
        {
          value: "5",
          label:
            "5 - Same as 4 but ≥1.5 cm, OR definite extraprostatic extension",
        },
      ],
    },

    // SECTION 4: DIFFUSION-WEIGHTED IMAGING
    {
      id: "dwi_score",
      label: "DWI/ADC Score",
      type: "radio",
      opts: [
        {
          value: "1",
          label: "1 - Normal (no abnormality on ADC or high b-value DWI)",
        },
        {
          value: "2",
          label: "2 - Linear/wedge-shaped hypointensity on ADC",
        },
        {
          value: "3",
          label: "3 - Focal, mild-moderate hypointense on ADC",
        },
        {
          value: "4",
          label: "4 - Focal, markedly hypointense on ADC, <1.5 cm",
        },
        {
          value: "5",
          label:
            "5 - Same as 4 but ≥1.5 cm, OR definite extraprostatic extension",
        },
      ],
    },

    // SECTION 5: DYNAMIC CONTRAST ENHANCED
    {
      id: "dce",
      label: "Dynamic Contrast Enhanced (DCE)",
      type: "radio",
      opts: [
        {
          value: "negative",
          label:
            "Negative - No early/contemporaneous enhancement, or diffuse enhancement",
        },
        {
          value: "positive",
          label:
            "Positive - Focal early enhancement corresponding to DWI/T2W finding",
        },
        {
          value: "not_performed",
          label: "Not performed / Not assessable",
        },
      ],
    },

    // SECTION 6: EXTRAPROSTATIC EXTENSION
    {
      id: "epe",
      label: "Extraprostatic Extension (EPE)",
      type: "radio",
      opts: [
        { value: "no", label: "No EPE" },
        { value: "suspected", label: "EPE suspected" },
        { value: "definite", label: "Definite EPE" },
      ],
    },

    // SECTION 7: SEMINAL VESICLE INVASION
    {
      id: "svi",
      label: "Seminal Vesicle Invasion (SVI)",
      type: "radio",
      opts: [
        { value: "no", label: "No SVI" },
        { value: "suspected", label: "SVI suspected" },
        { value: "definite", label: "Definite SVI" },
      ],
    },
  ],

  compute: (vals) => {
    const {
      zone = "",
      lesion_size = "",
      t2w_score = "",
      dwi_score = "",
      dce = "",
      epe = "",
      svi = "",
    } = vals;

    // Validate required fields
    if (!zone || !t2w_score || !dwi_score) {
      return {
        Error:
          "Please select the anatomic zone and provide T2W and DWI scores to calculate PI-RADS category.",
      };
    }

    const t2w = parseInt(t2w_score);
    const dwi = parseInt(dwi_score);
    const size = parseFloat(lesion_size) || 0;

    // Determine if this is PZ-type or TZ-type scoring
    const isPZ = zone === "pz" || zone === "cz";
    const isTZ = zone === "tz" || zone === "afs";

    let piradsCategory = 0;
    let dominantSequence = "";
    let scoringExplanation = "";

    if (isPZ) {
      // Peripheral Zone: DWI is dominant
      dominantSequence = "DWI (Peripheral Zone)";
      piradsCategory = dwi;

      // DCE can upgrade from PI-RADS 3 to 4 in PZ
      if (dwi === 3 && dce === "positive") {
        piradsCategory = 4;
        scoringExplanation =
          "DWI score 3 upgraded to PI-RADS 4 due to positive DCE";
      } else {
        scoringExplanation = `PI-RADS category based on DWI score (${dwi})`;
      }
    } else if (isTZ) {
      // Transition Zone: T2W is dominant
      dominantSequence = "T2W (Transition Zone)";
      piradsCategory = t2w;

      // DWI can upgrade the category if DWI score is higher
      if (dwi > t2w) {
        if (t2w === 3 && dwi >= 4) {
          piradsCategory = 4;
          scoringExplanation = `T2W score 3 upgraded to PI-RADS 4 due to DWI score ${dwi}`;
        } else if (t2w < 3 && dwi >= 4) {
          piradsCategory = dwi;
          scoringExplanation = `PI-RADS category based on DWI score (${dwi}) which exceeds T2W score (${t2w})`;
        } else {
          scoringExplanation = `PI-RADS category based on T2W score (${t2w})`;
        }
      } else {
        scoringExplanation = `PI-RADS category based on T2W score (${t2w})`;
      }
    }

    // Handle extraprostatic extension - upgrades to PI-RADS 5
    if (epe === "definite" || svi === "definite") {
      if (piradsCategory < 5) {
        piradsCategory = 5;
        scoringExplanation +=
          "; Upgraded to PI-RADS 5 due to definite extraprostatic extension or SVI";
      }
    }

    // Determine category description and cancer probability
    let categoryDescription = "";
    let cancerProbability = "";
    let biopsyRecommendation = "";

    switch (piradsCategory) {
      case 1:
        categoryDescription = "Very Low";
        cancerProbability =
          "Clinically significant cancer highly unlikely (<3%)";
        biopsyRecommendation = "Biopsy not recommended";
        break;
      case 2:
        categoryDescription = "Low";
        cancerProbability = "Clinically significant cancer unlikely (3-10%)";
        biopsyRecommendation = "Biopsy generally not recommended";
        break;
      case 3:
        categoryDescription = "Intermediate";
        cancerProbability =
          "Equivocal - clinically significant cancer possible (10-20%)";
        biopsyRecommendation =
          "Individualized decision based on PSA density, prior biopsy, clinical factors";
        break;
      case 4:
        categoryDescription = "High";
        cancerProbability = "Clinically significant cancer likely (25-50%)";
        biopsyRecommendation = "Biopsy recommended (MRI-targeted)";
        break;
      case 5:
        categoryDescription = "Very High";
        cancerProbability =
          "Clinically significant cancer highly likely (50-90%)";
        biopsyRecommendation = "Biopsy strongly recommended (MRI-targeted)";
        break;
    }

    // Build result object
    const result = {
      "PI-RADS Category": `${piradsCategory} - ${categoryDescription}`,
      "Dominant Sequence": dominantSequence,
      "Scoring Logic": scoringExplanation,
      "Cancer Probability": cancerProbability,
      "Biopsy Recommendation": biopsyRecommendation,
    };

    // Add component scores
    result["T2W Score"] = t2w.toString();
    result["DWI/ADC Score"] = dwi.toString();

    if (dce && dce !== "not_performed") {
      result["DCE Status"] = dce === "positive" ? "Positive" : "Negative";
    }

    // Add size if provided
    if (size > 0) {
      result["Lesion Size"] = `${size} cm`;
      if (size >= 1.5) {
        result["Size Note"] = "≥1.5 cm (size criterion for score 5)";
      }
    }

    // Add staging information if EPE or SVI present
    const stagingNotes = [];
    if (epe === "definite") {
      stagingNotes.push("Definite EPE present (≥T3a)");
    } else if (epe === "suspected") {
      stagingNotes.push("EPE suspected - requires clinical correlation");
    }

    if (svi === "definite") {
      stagingNotes.push("Definite SVI present (T3b)");
    } else if (svi === "suspected") {
      stagingNotes.push("SVI suspected - requires clinical correlation");
    }

    if (stagingNotes.length > 0) {
      result["Staging Notes"] = stagingNotes.join("; ");
    }

    // Add clinical notes
    const clinicalNotes = [];

    if (isPZ && dce === "not_performed") {
      clinicalNotes.push(
        "DCE not performed - cannot assess for upgrade from PI-RADS 3 to 4",
      );
    }

    if (piradsCategory === 3) {
      clinicalNotes.push(
        "Consider PSA density (≥0.15 ng/mL/cc favors biopsy), prior negative biopsy history, family history",
      );
    }

    if (piradsCategory >= 4) {
      clinicalNotes.push(
        "MRI-targeted biopsy (cognitive or software fusion) recommended over systematic biopsy alone",
      );
    }

    if (clinicalNotes.length > 0) {
      result["Clinical Notes"] = clinicalNotes.join("; ");
    }

    result._severity =
      piradsCategory <= 2
        ? "success"
        : piradsCategory === 3
          ? "warning"
          : "danger";

    return result;
  },

  refs: [
    {
      t: "Turkbey B, Rosenkrantz AB, Haider MA, et al. Prostate Imaging Reporting and Data System Version 2.1: 2019 Update. Eur Urol. 2019;76(3):340-351.",
      u: "https://doi.org/10.1016/j.eururo.2019.02.033",
    },
    {
      t: "Weinreb JC, Barentsz JO, Choyke PL, et al. PI-RADS Prostate Imaging - Reporting and Data System: 2015, Version 2. Eur Urol. 2016;69(1):16-40.",
      u: "https://doi.org/10.1016/j.eururo.2015.08.052",
    },
    {
      t: "American College of Radiology. PI-RADS v2.1 Document.",
      u: "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/PI-RADS",
    },
    {
      t: "Kasivisvanathan V, Rannikko AS, Borghi M, et al. MRI-Targeted or Standard Biopsy for Prostate-Cancer Diagnosis (PRECISION). N Engl J Med. 2018;378(19):1767-1777.",
      u: "https://doi.org/10.1056/NEJMoa1801993",
    },
    {
      t: "Schoots IG, Barentsz JO, Bittencourt LK, et al. PI-RADS Committee Position on MRI Without Contrast Medium in Biopsy-Naive Men With Suspected Prostate Cancer. AJR Am J Roentgenol. 2021;216(1):3-14.",
      u: "https://doi.org/10.2214/AJR.20.24268",
    },
    {
      t: "Bjurlin MA, Carroll PR, Eggener S, et al. Update of the Standard Operating Procedure on the Use of Multiparametric Magnetic Resonance Imaging for the Diagnosis, Staging and Management of Prostate Cancer. J Urol. 2020;203(4):706-712.",
      u: "https://doi.org/10.1097/JU.0000000000000617",
    },
  ],
};
