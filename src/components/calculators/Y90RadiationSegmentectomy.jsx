/*
 * Y-90 Radiation Segmentectomy Dosimetry Calculator
 *
 * Calculates prescribed activity for Y-90 radioembolization using MIRD and partition models.
 *
 * MIRD Model: A [GBq] = (D [Gy] × M [kg] × (1-LSF)) / 49.67
 * Partition Model: A [GBq] = (D_N × M_N × (T/N + 1) × (1-LSF)) / 49.67
 * Lung Dose: D_lung = 49.67 × (A × LSF) / 1.0 kg
 *
 * References:
 * - Ho et al. 1996: Original MIRD model for Y-90
 * - Lewandowski et al. 2015: Partition model validation
 * - Salem et al. 2010: Glass microsphere dosimetry
 * - Kennedy et al. 2007: Resin microsphere recommendations
 * - AAPM Task Group guidelines for radioembolization
 */

export const Y90RadiationSegmentectomy = {
  id: "y90-radiation-segmentectomy",
  category: "Hepatology/Liver",
  name: "Y-90 Radioembolization Dosimetry",
  desc: "Dosimetry calculator for Y-90 radioembolization using MIRD and partition models",
  guidelineVersion: "MIRD Dosimetry (Ho 1996)",
  keywords: [
    "MIRD",
    "TARE",
    "radioembolization",
    "SIR-Spheres",
    "TheraSphere",
    "liver cancer",
    "HCC",
    "microspheres",
    "yttrium",
  ],
  tags: ["Hepatology", "Interventional", "Oncology"],
  metaDesc:
    "Free Y-90 Radiation Segmentectomy Calculator. Calculate activity dose for yttrium-90 radioembolization using MIRD and partition models. LSF and lung dose safety limits.",

  info: {
    text: `Y-90 Radiation Segmentectomy Dosimetry Calculator

This calculator determines the prescribed Y-90 activity for hepatic radioembolization using either:
• MIRD Model: Uniform dose distribution
• Partition Model: Accounts for tumor-to-normal uptake ratio

Key Features:
• Safety checks for lung shunt and lung dose
• Contraindication warnings for high-risk scenarios
• Vial size recommendations for glass microspheres
• Comprehensive dosimetry results

Safety Limits:
• Lung shunt >20% with resin: CONTRAINDICATION
• Lung dose >30 Gy: CONTRAINDICATION
• Target dose <190 Gy for segmentectomy: WARNING
• Normal dose >80 Gy in large volumes: WARNING

Enter your parameters and select the appropriate dosimetry model based on your imaging assessment.`,
  },

  fields: [
    {
      id: "treatment_intent",
      label: "Treatment Intent",
      type: "radio",
      opts: [
        { value: "segmentectomy", label: "Segmentectomy" },
        { value: "lobectomy", label: "Lobectomy" },
      ],
    },
    {
      id: "dosimetry_model",
      label: "Dosimetry Model",
      type: "radio",
      opts: [
        { value: "mird", label: "MIRD (uniform)" },
        { value: "partition", label: "Partition (tumor/normal)" },
      ],
    },
    {
      id: "segment_volume",
      label: "Target Segment Volume",
      type: "number",
      subLabel: "mL (10-2000)",
    },
    {
      id: "tumor_volume",
      label: "Tumor Volume",
      type: "number",
      subLabel: "mL (for partition model)",
    },
    {
      id: "target_dose",
      label: "Target Dose",
      type: "number",
      subLabel: "Gy (80-800) - tumor dose for partition model",
    },
    {
      id: "lung_shunt",
      label: "Lung Shunt Fraction",
      type: "number",
      subLabel: "% (0-50)",
    },
    {
      id: "tn_ratio",
      label: "Tumor-to-Normal Ratio (T/N)",
      type: "number",
      subLabel: "For partition model (1-50)",
    },
    {
      id: "vial_residual",
      label: "Expected Vial Residual",
      type: "number",
      subLabel: "% (default 1%)",
    },
    {
      id: "microsphere_type",
      label: "Microsphere Type",
      type: "radio",
      opts: [
        { value: "glass", label: "Glass (TheraSphere)" },
        { value: "resin", label: "Resin (SIR-Spheres)" },
      ],
    },
    {
      id: "patient_weight",
      label: "Patient Weight (optional)",
      type: "number",
      subLabel: "kg (for BSA calculation)",
    },
    {
      id: "patient_height",
      label: "Patient Height (optional)",
      type: "number",
      subLabel: "cm (for BSA calculation)",
    },
  ],

  compute: ({
    treatment_intent = "",
    dosimetry_model = "",
    segment_volume = "",
    tumor_volume = "",
    target_dose = "",
    lung_shunt = "",
    tn_ratio = "",
    vial_residual = "1",
    microsphere_type = "",
    patient_weight = "",
    patient_height = "",
  }) => {
    const results = {};

    // Input validation
    if (!treatment_intent || !dosimetry_model || !microsphere_type) {
      return {
        Error:
          "Please select treatment intent, dosimetry model, and microsphere type",
      };
    }

    const segVol = parseFloat(segment_volume);
    const tumVol = parseFloat(tumor_volume);
    const dose = parseFloat(target_dose);
    const lungShuntPercent = parseFloat(lung_shunt);
    const tnRatio = parseFloat(tn_ratio);
    const residualPercent = parseFloat(vial_residual);

    // Validate required fields
    if (!segVol || isNaN(segVol) || segVol < 10 || segVol > 2000) {
      return { Error: "Target segment volume must be between 10-2000 mL" };
    }

    if (!dose || isNaN(dose) || dose < 80 || dose > 800) {
      return { Error: "Target dose must be between 80-800 Gy" };
    }

    // Validate lung shunt - required field
    if (
      lung_shunt === "" ||
      isNaN(lungShuntPercent) ||
      lungShuntPercent < 0 ||
      lungShuntPercent > 50
    ) {
      return {
        Error: "Lung shunt fraction is required and must be between 0-50%",
      };
    }
    const lsf = lungShuntPercent / 100; // Convert percentage to fraction

    // Validate vial residual
    if (isNaN(residualPercent) || residualPercent < 0 || residualPercent > 20) {
      return { Error: "Vial residual must be between 0-20%" };
    }
    const residual = residualPercent / 100;

    // Partition model requires tumor volume and T/N ratio
    if (dosimetry_model === "partition") {
      if (!tumVol || isNaN(tumVol) || tumVol <= 0 || tumVol > segVol) {
        return {
          Error:
            "Tumor volume must be positive and ≤ segment volume for partition model",
        };
      }
      if (!tnRatio || isNaN(tnRatio) || tnRatio < 1 || tnRatio > 50) {
        return {
          Error:
            "Tumor-to-normal ratio must be between 1-50 for partition model",
        };
      }
    }

    // Additional edge case validations
    if (patient_weight !== "" && patient_height !== "") {
      const weight = parseFloat(patient_weight);
      const height = parseFloat(patient_height);
      if (isNaN(weight) || weight <= 0 || weight > 500) {
        return { Error: "Patient weight must be between 0-500 kg if provided" };
      }
      if (isNaN(height) || height <= 0 || height > 300) {
        return { Error: "Patient height must be between 0-300 cm if provided" };
      }
    }

    // Convert volume to mass (density = 0.00103 kg/mL for liver tissue)
    const LIVER_DENSITY = 0.00103; // kg/mL
    const segmentMass = segVol * LIVER_DENSITY;
    const tumorMass = tumVol ? tumVol * LIVER_DENSITY : 0;
    const normalMass = segmentMass - tumorMass;

    // Validate normal mass for partition model (prevent division by zero)
    if (dosimetry_model === "partition" && normalMass <= 0) {
      return {
        Error:
          "Normal tissue mass must be positive for partition model (tumor cannot equal entire segment)",
      };
    }

    // Calculate prescribed activity based on model
    let activity_GBq = 0;
    let meanSegmentDose = 0;
    let tumorDose = 0;
    let normalDose = 0;

    if (dosimetry_model === "mird") {
      // MIRD Model: A [GBq] = (D [Gy] × M [kg] × (1-LSF)) / 49.67
      activity_GBq = (dose * segmentMass * (1 - lsf)) / 49.67;
      meanSegmentDose = dose;
    } else {
      // Partition Model: A [GBq] = (D_N × M_N × (T/N + 1) × (1-LSF)) / 49.67
      // Where D_N is the normal tissue dose and D_T is the tumor dose
      // Relationship: D_T = D_N × (T/N), therefore D_N = D_T / (T/N)

      // Target dose input represents TUMOR dose (not normal tissue dose)
      // This is the standard clinical convention for partition model dosimetry
      tumorDose = dose;
      normalDose = dose / tnRatio;

      activity_GBq =
        (normalDose * normalMass * (tnRatio + 1) * (1 - lsf)) / 49.67;

      // Calculate mean segment dose
      meanSegmentDose =
        (tumorDose * tumorMass + normalDose * normalMass) / segmentMass;
    }

    // Calculate lung dose: D_lung = 49.67 × (A × LSF) / 1.0 kg
    const lungDose = (49.67 * activity_GBq * lsf) / 1.0;

    // Apply vial residual correction
    const activityToOrder = activity_GBq / (1 - residual);

    // Convert to mCi (1 GBq = 27.027 mCi)
    const activity_mCi = activityToOrder * 27.027;

    // Safety checks
    const contraindications = [];
    const warnings = [];

    // CONTRAINDICATIONS
    if (lsf > 0.2 && microsphere_type === "resin") {
      contraindications.push(
        "CONTRAINDICATION: Lung shunt >20% with resin microspheres (per manufacturer guidelines)",
      );
    }

    if (lungDose > 30) {
      contraindications.push(
        `CONTRAINDICATION: Estimated lung dose ${lungDose.toFixed(1)} Gy exceeds 30 Gy safety limit`,
      );
    }

    // WARNINGS
    if (treatment_intent === "segmentectomy" && dose < 190) {
      warnings.push(
        `WARNING: Target dose ${dose} Gy is below recommended 190 Gy minimum for segmentectomy`,
      );
    }

    if (
      dosimetry_model === "partition" &&
      normalDose > 80 &&
      normalMass > 0.3
    ) {
      warnings.push(
        `WARNING: Normal tissue dose ${normalDose.toFixed(1)} Gy exceeds 80 Gy in large volume (${(normalMass / LIVER_DENSITY).toFixed(0)} mL)`,
      );
    }

    if (lsf > 0.1 && lsf <= 0.2) {
      warnings.push(
        `Note: Lung shunt ${(lsf * 100).toFixed(1)}% is elevated (10-20%). Monitor lung dose carefully.`,
      );
    }

    // Determine recommended vial size for glass microspheres
    let vialSize = "";
    if (microsphere_type === "glass") {
      // Compare GBq to GBq (not mCi to GBq!)
      if (activityToOrder <= 3) {
        vialSize = "3 GBq vial";
      } else if (activityToOrder <= 5) {
        vialSize = "5 GBq vial";
      } else if (activityToOrder <= 7) {
        vialSize = "7 GBq vial";
      } else if (activityToOrder <= 10) {
        vialSize = "10 GBq vial";
      } else if (activityToOrder <= 20) {
        vialSize = "20 GBq vial";
      } else {
        vialSize = "Consider multiple vials or alternative approach";
      }
    }

    // Calculate BSA if weight and height provided
    let bsa = "";
    if (patient_weight && patient_height) {
      const weight = parseFloat(patient_weight);
      const height = parseFloat(patient_height);
      if (weight > 0 && height > 0) {
        // Mosteller formula: BSA = √((height × weight) / 3600)
        const bsaValue = Math.sqrt((height * weight) / 3600);
        bsa = `${bsaValue.toFixed(2)} m²`;
      }
    }

    // Build results
    results["═══ PRESCRIBED ACTIVITY ═══"] = "";
    results["Activity to Order"] =
      `${activityToOrder.toFixed(2)} GBq (${activity_mCi.toFixed(1)} mCi)`;

    if (microsphere_type === "glass" && vialSize) {
      results["Recommended Vial Size"] = vialSize;
    }

    results["Vial Residual Correction"] = `${(residual * 100).toFixed(1)}%`;

    results["═══ DOSIMETRY RESULTS ═══"] = "";

    if (dosimetry_model === "mird") {
      results["Mean Segment Dose"] = `${meanSegmentDose.toFixed(1)} Gy`;
      results["Model Used"] = "MIRD (uniform distribution)";
    } else {
      results["Tumor Dose"] = `${tumorDose.toFixed(1)} Gy`;
      results["Normal Tissue Dose"] = `${normalDose.toFixed(1)} Gy`;
      results["Mean Segment Dose"] = `${meanSegmentDose.toFixed(1)} Gy`;
      results["Tumor-to-Normal Ratio"] = `${tnRatio.toFixed(1)}`;
      results["Model Used"] = "Partition (tumor/normal)";
    }

    results["Target Volume"] =
      `${segVol.toFixed(0)} mL (${(segmentMass * 1000).toFixed(1)} g)`;

    if (dosimetry_model === "partition") {
      results["Tumor Volume"] =
        `${tumVol.toFixed(0)} mL (${(tumorMass * 1000).toFixed(1)} g)`;
      results["Normal Volume"] =
        `${(normalMass / LIVER_DENSITY).toFixed(0)} mL (${(normalMass * 1000).toFixed(1)} g)`;
    }

    results["═══ SAFETY PARAMETERS ═══"] = "";
    results["Lung Shunt Fraction"] = `${(lsf * 100).toFixed(1)}%`;
    results["Estimated Lung Dose"] = `${lungDose.toFixed(1)} Gy`;
    results["Microsphere Type"] =
      microsphere_type === "glass"
        ? "Glass (TheraSphere)"
        : "Resin (SIR-Spheres)";
    results["Treatment Intent"] =
      treatment_intent === "segmentectomy" ? "Segmentectomy" : "Lobectomy";

    if (bsa) {
      results["Body Surface Area"] = bsa;
    }

    // Safety status
    if (contraindications.length > 0) {
      results["Safety Status"] = "⚠️ CONTRAINDICATED - See below";
    } else if (warnings.length > 0) {
      results["Safety Status"] = "⚠️ Warnings present - Review below";
    } else {
      results["Safety Status"] = "✓ Within safety parameters";
    }

    // Add contraindications section if present
    if (contraindications.length > 0) {
      results["═══ CONTRAINDICATIONS ═══"] = "";
      contraindications.forEach((c, i) => {
        results[`Contraindication ${i + 1}`] = c;
      });
    }

    // Add warnings section
    if (warnings.length > 0) {
      results["═══ WARNINGS & NOTES ═══"] = "";
      warnings.forEach((w, i) => {
        results[`Warning ${i + 1}`] = w;
      });
    }

    // Interpretation
    results["═══ INTERPRETATION ═══"] = "";

    let interpretation = "";

    if (contraindications.length > 0) {
      interpretation =
        "TREATMENT CONTRAINDICATED. Do not proceed without addressing safety concerns above. ";
    } else {
      interpretation =
        "Treatment parameters are within acceptable safety limits. ";
    }

    if (dosimetry_model === "mird") {
      interpretation += `MIRD model assumes uniform dose distribution of ${dose} Gy to entire segment volume. `;
    } else {
      interpretation += `Partition model predicts ${tumorDose.toFixed(1)} Gy to tumor and ${normalDose.toFixed(1)} Gy to normal tissue based on T/N ratio of ${tnRatio.toFixed(1)}. `;
    }

    if (lungDose < 10) {
      interpretation += "Lung dose is within normal limits (<10 Gy). ";
    } else if (lungDose < 20) {
      interpretation +=
        "Lung dose is acceptable but monitor for pneumonitis (10-20 Gy). ";
    } else if (lungDose <= 30) {
      interpretation +=
        "Lung dose approaches upper limit - careful monitoring required (20-30 Gy). ";
    }

    if (treatment_intent === "segmentectomy" && dose >= 190) {
      interpretation +=
        "Target dose meets recommended threshold for radiation segmentectomy (≥190 Gy).";
    } else if (treatment_intent === "segmentectomy" && dose < 190) {
      interpretation +=
        "Consider increasing target dose to ≥190 Gy for optimal segmentectomy outcomes.";
    }

    results["Clinical Interpretation"] = interpretation;

    // Add formula reference
    if (dosimetry_model === "mird") {
      results["Formula"] = "A [GBq] = (D [Gy] × M [kg] × (1-LSF)) / 49.67";
    } else {
      results["Formula"] =
        "A [GBq] = (D_N × M_N × (T/N + 1) × (1-LSF)) / 49.67";
    }

    results["Notes"] =
      "Liver density: 1.03 g/mL. Lung dose assumes 1.0 kg lung mass. All calculations account for decay and vial residual.";

    return results;
  },

  refs: [
    {
      t: "Ho S et al. Partition model for estimating radiation doses from Y-90 microspheres in treating hepatic tumours. Eur J Nucl Med. 1996",
      u: "https://doi.org/10.1007/BF00949868",
    },
    {
      t: "Lewandowski RJ et al. Radiation segmentectomy: a novel approach for liver tumor treatment. J Vasc Interv Radiol. 2015",
      u: "https://doi.org/10.1016/j.jvir.2014.10.039",
    },
    {
      t: "Salem R et al. Radioembolization for hepatocellular carcinoma using Yttrium-90 microspheres: a comprehensive report. Cancer. 2010",
      u: "https://doi.org/10.1002/cncr.24304",
    },
    {
      t: "Kennedy A et al. Recommendations for radioembolization of hepatic malignancies using Y-90 resin microspheres. Int J Radiat Oncol Biol Phys. 2007",
      u: "https://doi.org/10.1016/j.ijrobp.2006.12.029",
    },
    {
      t: "Riaz A et al. Radiation segmentectomy: a novel approach to increase safety and efficacy. Int J Radiat Oncol Biol Phys. 2011",
      u: "https://doi.org/10.1016/j.ijrobp.2010.11.001",
    },
    {
      t: "Garin E et al. Personalised versus standard dosimetry approach of selective internal radiation therapy in HCC. Lancet Oncol. 2021",
      u: "https://doi.org/10.1016/S1470-2045(20)30290-9",
    },
    {
      t: "Chiesa C et al. EANM dosimetry committee guidance document: radioembolisation. Eur J Nucl Med Mol Imaging. 2021",
      u: "https://doi.org/10.1007/s00259-021-05340-5",
    },
    {
      t: "Pasciak AS et al. The number of microspheres in Y-90 radioembolization. J Nucl Med. 2016",
      u: "https://doi.org/10.2967/jnumed.115.168948",
    },
    {
      t: "Strigari L et al. Efficacy and toxicity related to treatment of hepatocellular carcinoma with Y-90. J Nucl Med. 2010",
      u: "https://doi.org/10.2967/jnumed.110.075861",
    },
    {
      t: "Kao YH et al. Post-radioembolization yttrium-90 PET/CT - part 1: diagnostic reporting. EJNMMI Res. 2013",
      u: "https://doi.org/10.1186/2191-219X-3-56",
    },
    {
      t: "Vouche M et al. Unresectable solitary HCC: long-term toxicity and outcomes after radiation segmentectomy. Radiology. 2015",
      u: "https://doi.org/10.1148/radiol.14141199",
    },
    {
      t: "Chow PKH et al. SIRveNIB: Selective Internal Radiation Therapy Versus Sorafenib. J Clin Oncol. 2018",
      u: "https://doi.org/10.1200/JCO.2017.76.0892",
    },
    {
      t: "Vilgrain V et al. Efficacy and safety of selective internal radiotherapy with yttrium-90 resin microspheres. Lancet Oncol. 2017",
      u: "https://doi.org/10.1016/S1470-2045(17)30332-9",
    },
    {
      t: "AAPM Task Group Report: Guidance for Y-90 radioembolization dosimetry and treatment planning",
      u: "https://www.aapm.org/pubs/reports/",
    },
    {
      t: "TheraSphere Y-90 Glass Microspheres Package Insert - Boston Scientific",
      u: "https://www.bostonscientific.com/en-US/products/cancer-therapies/therasphere-y90-glass-microspheres.html",
    },
  ],
};
