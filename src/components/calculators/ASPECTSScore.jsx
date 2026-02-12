/**
 * ASPECTS (Alberta Stroke Program Early CT Score) Calculator
 *
 * A validated 10-point quantitative topographic CT scan scoring system
 * developed to assess early ischemic changes in acute middle cerebral
 * artery (MCA) territory stroke.
 *
 * Primary Sources:
 * - Barber PA, et al. Lancet. 2000;355(9216):1670-1674 (Original ASPECTS)
 * - Powers WJ, et al. Stroke. 2019;50:e344-e418 (AHA/ASA Guidelines)
 * - Nogueira RG, et al. N Engl J Med. 2018;378:11-21 (DAWN Trial)
 * - Albers GW, et al. N Engl J Med. 2018;378:708-718 (DEFUSE 3 Trial)
 */

export const ASPECTSScore = {
  category: "Neuroradiology",
  id: "aspects-score",
  name: "ASPECTS Score",
  desc: "Alberta Stroke Program Early CT Score for acute MCA stroke assessment",
  keywords: ["stroke", "MCA", "ischemic", "ASPECTS", "thrombolysis"],
  tags: ["Neuroradiology", "Stroke", "Neurology"],
  metaDesc:
    "Free ASPECTS Calculator. Alberta Stroke Program Early CT Score for assessing early ischemic changes in acute MCA stroke. Evidence-based thrombectomy eligibility assessment with DAWN and DEFUSE-3 trial thresholds.",

  info: {
    text: `ASPECTS (Alberta Stroke Program Early CT Score) is a 10-point quantitative CT scoring system for acute MCA territory stroke.

The MCA territory is divided into 10 regions assessed at two levels:

GANGLIONIC LEVEL (at level of basal ganglia):
• C - Caudate head
• L - Lentiform nucleus (putamen + globus pallidus)
• IC - Internal capsule (posterior limb)
• I - Insular ribbon (insular cortex)
• M1 - Frontal operculum (anterior MCA cortex)
• M2 - Anterior temporal lobe (lateral to insular ribbon)
• M3 - Posterior temporal lobe (posterior MCA cortex)

SUPRAGANGLIONIC LEVEL (above basal ganglia):
• M4 - Anterior MCA territory (superior to M1)
• M5 - Lateral MCA territory (superior to M2)
• M6 - Posterior MCA territory (superior to M3)

SCORING: Start with 10, subtract 1 point for each region showing early ischemic change (hypodensity, loss of gray-white differentiation, sulcal effacement).

Note: ASPECTS applies only to MCA territory strokes. For posterior circulation, use pc-ASPECTS.`,
    link: {
      label: "View Original ASPECTS Publication (Barber et al. 2000)",
      url: "https://doi.org/10.1016/S0140-6736(00)02237-6",
    },
  },

  fields: [
    // LATERALITY SELECTOR
    {
      id: "laterality",
      label: "Affected Hemisphere",
      type: "radio",
      subLabel: "Side of suspected MCA territory stroke",
      opts: [
        { value: "left", label: "Left hemisphere" },
        { value: "right", label: "Right hemisphere" },
      ],
    },

    // SUBCORTICAL STRUCTURES (Ganglionic Level)
    {
      id: "caudate",
      label: "C - Caudate Head",
      type: "checkbox",
      subLabel: "Early ischemic change in caudate nucleus (-1 point)",
    },
    {
      id: "lentiform",
      label: "L - Lentiform Nucleus",
      type: "checkbox",
      subLabel: "Putamen and globus pallidus (-1 point)",
    },
    {
      id: "internal_capsule",
      label: "IC - Internal Capsule",
      type: "checkbox",
      subLabel: "Posterior limb of internal capsule (-1 point)",
    },
    {
      id: "insular",
      label: "I - Insular Ribbon",
      type: "checkbox",
      subLabel: "Insular cortex / loss of insular ribbon (-1 point)",
    },

    // CORTICAL MCA REGIONS - GANGLIONIC LEVEL (M1-M3)
    {
      id: "m1",
      label: "M1 - Anterior MCA Cortex (Ganglionic Level)",
      type: "checkbox",
      subLabel: "Frontal operculum at ganglionic level (-1 point)",
    },
    {
      id: "m2",
      label: "M2 - Lateral MCA Cortex (Ganglionic Level)",
      type: "checkbox",
      subLabel: "Anterior temporal lobe, lateral to insular ribbon (-1 point)",
    },
    {
      id: "m3",
      label: "M3 - Posterior MCA Cortex (Ganglionic Level)",
      type: "checkbox",
      subLabel: "Posterior temporal lobe at ganglionic level (-1 point)",
    },

    // CORTICAL MCA REGIONS - SUPRAGANGLIONIC LEVEL (M4-M6)
    {
      id: "m4",
      label: "M4 - Anterior MCA Territory (Supraganglionic)",
      type: "checkbox",
      subLabel: "Immediately superior to M1 (-1 point)",
    },
    {
      id: "m5",
      label: "M5 - Lateral MCA Territory (Supraganglionic)",
      type: "checkbox",
      subLabel: "Immediately superior to M2 (-1 point)",
    },
    {
      id: "m6",
      label: "M6 - Posterior MCA Territory (Supraganglionic)",
      type: "checkbox",
      subLabel: "Immediately superior to M3 (-1 point)",
    },

    // TIME FROM SYMPTOM ONSET (optional, for clinical context)
    {
      id: "time_from_onset",
      label: "Time from Symptom Onset (hours)",
      type: "number",
      subLabel: "Optional - helps determine treatment window eligibility",
    },
  ],

  compute: (vals) => {
    const {
      laterality = "",
      caudate = false,
      lentiform = false,
      internal_capsule = false,
      insular = false,
      m1 = false,
      m2 = false,
      m3 = false,
      m4 = false,
      m5 = false,
      m6 = false,
      time_from_onset = "",
    } = vals;

    // Count affected regions
    const affectedRegions = [];
    let totalAffected = 0;

    // Subcortical structures
    if (caudate) {
      affectedRegions.push("C (Caudate)");
      totalAffected++;
    }
    if (lentiform) {
      affectedRegions.push("L (Lentiform)");
      totalAffected++;
    }
    if (internal_capsule) {
      affectedRegions.push("IC (Internal Capsule)");
      totalAffected++;
    }
    if (insular) {
      affectedRegions.push("I (Insular)");
      totalAffected++;
    }

    // Ganglionic level cortical regions
    if (m1) {
      affectedRegions.push("M1");
      totalAffected++;
    }
    if (m2) {
      affectedRegions.push("M2");
      totalAffected++;
    }
    if (m3) {
      affectedRegions.push("M3");
      totalAffected++;
    }

    // Supraganglionic level cortical regions
    if (m4) {
      affectedRegions.push("M4");
      totalAffected++;
    }
    if (m5) {
      affectedRegions.push("M5");
      totalAffected++;
    }
    if (m6) {
      affectedRegions.push("M6");
      totalAffected++;
    }

    // Calculate ASPECTS score (10 minus affected regions)
    const aspectsScore = 10 - totalAffected;

    // Determine interpretation and treatment eligibility
    let interpretation = "";
    let thrombectomyEligibility = "";
    let prognosticImplication = "";

    if (aspectsScore >= 8) {
      interpretation = "Small or no early ischemic changes";
      thrombectomyEligibility = "Good candidate for mechanical thrombectomy";
      prognosticImplication = "Favorable prognosis with reperfusion therapy";
    } else if (aspectsScore >= 6) {
      interpretation = "Moderate early ischemic changes";
      thrombectomyEligibility =
        "May benefit from mechanical thrombectomy (meets standard threshold of ASPECTS >= 6)";
      prognosticImplication =
        "Moderate prognosis; treatment benefit supported by 2015 landmark trials (MR CLEAN, ESCAPE, SWIFT PRIME)";
    } else if (aspectsScore >= 3) {
      interpretation = "Large infarct core (ASPECTS 3-5)";
      thrombectomyEligibility =
        "Consider thrombectomy based on recent large core trials (SELECT2, ANGEL-ASPECT, RESCUE-Japan LIMIT)";
      prognosticImplication =
        "Higher risk of symptomatic hemorrhage, but EVT still shows benefit in recent RCTs";
    } else {
      interpretation = "Very large infarct core (ASPECTS 0-2)";
      thrombectomyEligibility =
        "Historically excluded from EVT trials; emerging data suggests some patients may benefit (individualized decision)";
      prognosticImplication =
        "Poor prognosis; high risk of hemorrhagic transformation; consider goals of care discussion";
    }

    // Build result object
    const result = {
      "ASPECTS Score": `${aspectsScore} / 10`,
      Interpretation: interpretation,
    };

    // Add laterality if specified
    if (laterality) {
      result["Affected Hemisphere"] = laterality === "left" ? "Left" : "Right";
    }

    // Add affected regions breakdown
    result["Regions Affected"] =
      totalAffected > 0
        ? `${totalAffected} region(s): ${affectedRegions.join(", ")}`
        : "No regions affected (normal CT)";

    // Add category breakdown
    const subcorticalAffected = [
      caudate,
      lentiform,
      internal_capsule,
      insular,
    ].filter(Boolean).length;
    const ganglionicCorticalAffected = [m1, m2, m3].filter(Boolean).length;
    const supraganglionicCorticalAffected = [m4, m5, m6].filter(Boolean).length;

    result["Regional Breakdown"] =
      `Subcortical: ${subcorticalAffected}/4 | Ganglionic cortical (M1-M3): ${ganglionicCorticalAffected}/3 | Supraganglionic (M4-M6): ${supraganglionicCorticalAffected}/3`;

    // Treatment eligibility
    result["Thrombectomy Eligibility"] = thrombectomyEligibility;

    // Time window considerations
    const timeHours = parseFloat(time_from_onset);
    if (!isNaN(timeHours) && timeHours > 0) {
      result["Time from Onset"] = `${timeHours} hours`;

      let timeWindowNote = "";
      if (timeHours <= 6) {
        timeWindowNote = "Within standard 6-hour window for thrombectomy";
        if (aspectsScore >= 6) {
          timeWindowNote +=
            " - Standard eligibility criteria met (per 2015 landmark trials)";
        } else if (aspectsScore >= 3) {
          timeWindowNote +=
            " - Large core: consider SELECT2/ANGEL-ASPECT criteria";
        }
      } else if (timeHours <= 16) {
        timeWindowNote =
          "Extended window (6-16 hours): DEFUSE-3 criteria may apply";
        if (aspectsScore < 6) {
          timeWindowNote += " - Note: DEFUSE-3 excluded ASPECTS < 6";
        }
      } else if (timeHours <= 24) {
        timeWindowNote =
          "Extended window (6-24 hours): DAWN trial criteria may apply";
        timeWindowNote += " - Requires clinical-imaging mismatch assessment";
      } else {
        timeWindowNote =
          "Beyond standard thrombectomy time windows (>24 hours)";
      }
      result["Time Window Assessment"] = timeWindowNote;
    }

    // Prognostic implication
    result["Prognostic Implication"] = prognosticImplication;

    // Add clinical notes for specific patterns
    const clinicalNotes = [];

    // Check for specific patterns
    if (insular && lentiform) {
      clinicalNotes.push(
        "Involvement of both insular ribbon and lentiform nucleus suggests proximal M1 occlusion with poor collaterals",
      );
    }

    if (caudate && internal_capsule) {
      clinicalNotes.push(
        "Caudate and internal capsule involvement may indicate lenticulostriate artery territory infarction",
      );
    }

    if (m1 && m2 && m3 && m4 && m5 && m6) {
      clinicalNotes.push(
        "Complete cortical MCA involvement suggests very poor collateral circulation",
      );
    }

    if (totalAffected === 0) {
      clinicalNotes.push(
        "Normal ASPECTS (10/10) - No early ischemic changes visible on NCCT. Note: Subtle changes may be missed within first 3 hours of symptom onset",
      );
    }

    if (
      subcorticalAffected >= 3 &&
      ganglionicCorticalAffected + supraganglionicCorticalAffected === 0
    ) {
      clinicalNotes.push(
        "Predominantly subcortical involvement - consider lenticulostriate territory infarction",
      );
    }

    if (clinicalNotes.length > 0) {
      result["Clinical Notes"] = clinicalNotes.join("; ");
    }

    // Add guideline references
    result["Guideline Thresholds"] =
      "Standard EVT: ASPECTS >= 6 (2019 AHA/ASA) | Large Core EVT: ASPECTS 3-5 (SELECT2, ANGEL-ASPECT, RESCUE-Japan LIMIT 2022-2023)";

    result._severity =
      aspectsScore >= 8 ? "success" : aspectsScore >= 6 ? "warning" : "danger";

    return result;
  },

  refs: [
    {
      t: "Barber PA, Demchuk AM, Zhang J, Buchan AM; ASPECTS Study Group. Validity and reliability of a quantitative computed tomography score in predicting outcome of hyperacute stroke before thrombolytic therapy. Lancet. 2000;355(9216):1670-1674.",
      u: "https://doi.org/10.1016/S0140-6736(00)02237-6",
    },
    {
      t: "Powers WJ, Rabinstein AA, Ackerson T, et al. Guidelines for the Early Management of Patients With Acute Ischemic Stroke: 2019 Update. Stroke. 2019;50:e344-e418.",
      u: "https://doi.org/10.1161/STR.0000000000000211",
    },
    {
      t: "Nogueira RG, Jadhav AP, Haussen DC, et al. Thrombectomy 6 to 24 Hours after Stroke with a Mismatch between Deficit and Infarct (DAWN Trial). N Engl J Med. 2018;378:11-21.",
      u: "https://doi.org/10.1056/NEJMoa1706442",
    },
    {
      t: "Albers GW, Marks MP, Kemp S, et al. Thrombectomy for Stroke at 6 to 16 Hours with Selection by Perfusion Imaging (DEFUSE 3). N Engl J Med. 2018;378:708-718.",
      u: "https://doi.org/10.1056/NEJMoa1713973",
    },
    {
      t: "Sarraj A, Hassan AE, Abraham MG, et al. Trial of Endovascular Thrombectomy for Large Ischemic Strokes (SELECT2). N Engl J Med. 2023;388:1259-1271.",
      u: "https://doi.org/10.1056/NEJMoa2214403",
    },
    {
      t: "Huo X, Ma G, Tong X, et al. Trial of Endovascular Therapy for Acute Ischemic Stroke with Large Infarct (ANGEL-ASPECT). N Engl J Med. 2023;388:1272-1283.",
      u: "https://doi.org/10.1056/NEJMoa2213379",
    },
    {
      t: "Yoshimura S, Sakai N, Yamagami H, et al. Endovascular Therapy for Acute Stroke with a Large Ischemic Region (RESCUE-Japan LIMIT). N Engl J Med. 2022;386:1303-1313.",
      u: "https://doi.org/10.1056/NEJMoa2118191",
    },
    {
      t: "Goyal M, Demchuk AM, Menon BK, et al. Randomized assessment of rapid endovascular treatment of ischemic stroke (ESCAPE). N Engl J Med. 2015;372:1019-1030.",
      u: "https://doi.org/10.1056/NEJMoa1414905",
    },
    {
      t: "Pexman JH, Barber PA, Hill MD, et al. Use of the Alberta Stroke Program Early CT Score (ASPECTS) for assessing CT scans in patients with acute stroke. AJNR Am J Neuroradiol. 2001;22(8):1534-1542.",
      u: "https://pubmed.ncbi.nlm.nih.gov/11559501/",
    },
    {
      t: "Menon BK, Puetz V, Kochar P, Bhatt A. ASPECTS and other neuroimaging scores in the triage and prediction of outcome in acute stroke patients. Neuroimaging Clin N Am. 2011;21(2):407-423.",
      u: "https://doi.org/10.1016/j.nic.2011.01.007",
    },
  ],
};
