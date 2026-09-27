/*
 * Y-90 Radiation Segmentectomy Dosimetry Calculator
 *
 * This calculator provides educational uniform and compartment dosimetry for
 * clinician-selected hepatic targets. The calculation convention retained
 * here is 49.67 J/GBq, with liver density 1.03 g/mL and a 1.0 kg lung mass
 * assumption. It does not determine treatment suitability or a product vial.
 */

const ENERGY_PER_GBQ_J = 49.67;
const LIVER_DENSITY_KG_PER_ML = 0.00103;
const LUNG_MASS_KG = 1.0;
const GBQ_PER_MCI = 0.037;
const SUPPORTED_TREATMENT_INTENTS = new Set(["segmentectomy", "lobectomy"]);
const SUPPORTED_MODELS = new Set(["mird", "partition"]);
const SUPPORTED_MICROSPHERES = new Set(["glass", "resin"]);

const GUIDANCE_SCOPE =
  "Educational compartment dosimetry for clinician-selected targets. Assumes 1.0 kg lung mass and 1.03 g/mL liver density. Does not assess cumulative lung dose, hepatic reserve, extrahepatic deposition, product-specific eligibility, or treatment suitability. No calibration-to-treatment decay or vial-order calculation.";

const isNumericInput = (value) => {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string" || value.trim() === "") return false;
  const normalized = value.trim();
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)) {
    return false;
  }
  return Number.isFinite(Number(normalized));
};

const numericValue = (value) => Number(value);

const formatActivity = (activityGBq) =>
  `${activityGBq.toFixed(2)} GBq (${(activityGBq / GBQ_PER_MCI).toFixed(1)} mCi)`;

export const Y90RadiationSegmentectomy = {
  id: "y90-radiation-segmentectomy",
  category: "Hepatology/Liver",
  name: "Y-90 Radioembolization Dosimetry",
  desc: "Dosimetry calculator for Y-90 radioembolization using MIRD and partition models",
  guidelineVersion: "EANM compartment dosimetry convention (49.67 J/GBq)",
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
    "Educational Y-90 compartment dosimetry for clinician-selected hepatic targets using uniform and partition models.",

  info: {
    text: `Y-90 Radiation Segmentectomy Dosimetry Calculator

This calculator provides educational compartment dosimetry for clinician-selected targets using:
• MIRD Model: uniform dose across the selected perfused target volume
• Partition Model: tumor and normal compartments using a tumor-to-normal activity concentration ratio per unit mass

The partition T/N ratio is a tumor-to-normal activity concentration (activity or corrected counts per unit mass), not a total tumor/normal counts ratio. The calculation uses 49.67 J/GBq, 1.03 g/mL liver density, and a 1.0 kg lung mass assumption.

Activity at Treatment Time includes expected residual compensation. Expected Injected Activity is the activity entering the patient.

Numeric ranges shown in the fields are application/software entry bounds pending applicability review; they are not product eligibility or treatment-selection guidance.

${GUIDANCE_SCOPE}`,
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
      showIf: (values) => values.dosimetry_model === "partition",
    },
    {
      id: "target_dose",
      label: "Target Dose",
      type: "number",
      subLabel:
        "Gy (80-800) - mean perfused-volume dose for uniform; tumor dose for partition",
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
      subLabel:
        "Partition only: activity concentration per unit mass (1-50)",
      showIf: (values) => values.dosimetry_model === "partition",
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
    if (!SUPPORTED_TREATMENT_INTENTS.has(treatment_intent)) {
      return { Error: "Treatment intent must be a supported option" };
    }
    if (!SUPPORTED_MODELS.has(dosimetry_model)) {
      return { Error: "Dosimetry model must be a supported option" };
    }
    if (!SUPPORTED_MICROSPHERES.has(microsphere_type)) {
      return { Error: "Microsphere type must be a supported option" };
    }

    if (!isNumericInput(segment_volume)) {
      return { Error: "Target segment volume must be a finite number between 10-2000 mL" };
    }
    if (!isNumericInput(target_dose)) {
      return { Error: "Target dose must be a finite number between 80-800 Gy" };
    }
    if (!isNumericInput(lung_shunt)) {
      return { Error: "Lung shunt fraction is required and must be between 0-50%" };
    }
    if (!isNumericInput(vial_residual)) {
      return { Error: "Vial residual must be a finite number between 0-20%" };
    }

    const segVol = numericValue(segment_volume);
    const dose = numericValue(target_dose);
    const lungShuntPercent = numericValue(lung_shunt);
    const residualPercent = numericValue(vial_residual);

    if (segVol < 10 || segVol > 2000) {
      return { Error: "Target segment volume must be between 10-2000 mL" };
    }
    if (dose < 80 || dose > 800) {
      return { Error: "Target dose must be between 80-800 Gy" };
    }
    if (lungShuntPercent < 0 || lungShuntPercent > 50) {
      return { Error: "Lung shunt fraction is required and must be between 0-50%" };
    }
    if (residualPercent < 0 || residualPercent > 20) {
      return { Error: "Vial residual must be between 0-20%" };
    }

    const lsf = lungShuntPercent / 100;
    const residual = residualPercent / 100;
    let tumVol = 0;
    let tnRatio = 1;

    if (dosimetry_model === "partition") {
      if (!isNumericInput(tumor_volume)) {
        return {
          Error:
            "Tumor volume must be positive and ≤ segment volume for partition model",
        };
      }
      if (!isNumericInput(tn_ratio)) {
        return {
          Error:
            "Tumor-to-normal ratio must be between 1-50 for partition model",
        };
      }
      tumVol = numericValue(tumor_volume);
      tnRatio = numericValue(tn_ratio);
      if (tumVol <= 0 || tumVol > segVol) {
        return {
          Error:
            "Tumor volume must be positive and ≤ segment volume for partition model",
        };
      }
      if (tnRatio < 1 || tnRatio > 50) {
        return {
          Error:
            "Tumor-to-normal ratio must be between 1-50 for partition model",
        };
      }
    }

    const hasWeight = patient_weight !== "" && patient_weight !== undefined;
    const hasHeight = patient_height !== "" && patient_height !== undefined;

    let bsa = "";
    if (hasWeight && hasHeight) {
      if (!isNumericInput(patient_weight) || !isNumericInput(patient_height)) {
        return { Error: "Patient weight and height must be finite numbers if provided" };
      }
      const weight = numericValue(patient_weight);
      const height = numericValue(patient_height);
      if (weight <= 0 || weight > 500) {
        return { Error: "Patient weight must be between 0-500 kg if provided" };
      }
      if (height <= 0 || height > 300) {
        return { Error: "Patient height must be between 0-300 cm if provided" };
      }
      bsa = `${Math.sqrt((height * weight) / 3600).toFixed(2)} m²`;
    }

    const segmentMass = segVol * LIVER_DENSITY_KG_PER_ML;
    const tumorMass = tumVol * LIVER_DENSITY_KG_PER_ML;
    const normalMass = segmentMass - tumorMass;
    if (dosimetry_model === "partition" && normalMass <= 0) {
      return {
        Error:
          "Normal tissue mass must be positive for partition model (tumor cannot equal entire segment)",
      };
    }

    const normalDose = dosimetry_model === "partition" ? dose / tnRatio : 0;
    const requiredEnergyJ =
      dosimetry_model === "partition"
        ? dose * tumorMass + normalDose * normalMass
        : dose * segmentMass;
    const injectedActivityGBq =
      requiredEnergyJ / (ENERGY_PER_GBQ_J * (1 - lsf));
    const activityAtTreatmentGBq = injectedActivityGBq / (1 - residual);
    const lungDose = (ENERGY_PER_GBQ_J * injectedActivityGBq * lsf) / LUNG_MASS_KG;
    const meanSegmentDose = requiredEnergyJ / segmentMass;
    const treatmentIntentLabel =
      treatment_intent === "segmentectomy" ? "Segmentectomy" : "Lobectomy";
    const microsphereLabel =
      microsphere_type === "glass" ? "Glass (TheraSphere)" : "Resin (SIR-Spheres)";

    const results = {
      "═══ CALCULATED ACTIVITY ═══": "",
      "Activity at Treatment Time": formatActivity(activityAtTreatmentGBq),
      "Expected Injected Activity": formatActivity(injectedActivityGBq),
      "Activity Definitions":
        "Activity at Treatment Time includes expected residual compensation; Expected Injected Activity is the activity entering the patient.",
      "Expected Residual": `${residualPercent.toFixed(1)}%`,
      "═══ DOSIMETRY RESULTS ═══": "",
      "Required Energy": `${requiredEnergyJ.toFixed(1)} J`,
    };

    if (dosimetry_model === "mird") {
      results["Mean Segment Dose"] = `${meanSegmentDose.toFixed(1)} Gy`;
      results["Model Used"] = "MIRD (uniform distribution)";
    } else {
      results["Tumor Dose"] = `${dose.toFixed(1)} Gy`;
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
        `${(normalMass / LIVER_DENSITY_KG_PER_ML).toFixed(0)} mL (${(normalMass * 1000).toFixed(1)} g)`;
    }

    results["═══ LUNG DOSE CHECK ═══"] = "";
    results["Lung Shunt Fraction"] = `${(lsf * 100).toFixed(1)}%`;
    results["Estimated Lung Dose"] = `${lungDose.toFixed(1)} Gy`;
    results["Single-Treatment Lung Dose Check"] =
      lungDose > 30
        ? "Above 30 Gy reference — specialist review required"
        : "At or below 30 Gy reference — not treatment clearance";
    results["Microsphere Type"] = microsphereLabel;
    results["Treatment Intent"] = treatmentIntentLabel;
    results["Treatment Suitability"] = "Not assessed";
    if (bsa) results["Body Surface Area"] = bsa;

    results["═══ INTERPRETATION ═══"] = "";
    results["Clinical Interpretation"] =
      dosimetry_model === "mird"
        ? `Uniform model reports ${dose.toFixed(1)} Gy mean dose across the selected perfused target volume.`
        : `Partition model reports ${dose.toFixed(1)} Gy tumor dose and ${normalDose.toFixed(1)} Gy normal-tissue dose from the selected T/N ratio.`;
    results.Formula =
      dosimetry_model === "mird"
        ? "A_inj [GBq] = D_mean [Gy] × M [kg] / (49.67 [J/GBq] × (1 − LSF))"
        : "A_inj [GBq] = (D_T × M_T + D_N × M_N) / (49.67 [J/GBq] × (1 − LSF))";
    results.Notes = `Conversion convention: 49.67 J/GBq. Liver density: 1.03 g/mL. Lung dose assumes 1.0 kg lung mass. ${GUIDANCE_SCOPE}`;
    results["Guidance Scope"] = GUIDANCE_SCOPE;

    return results;
  },

  refs: [
    {
      t: "Weber M et al. EANM procedure guideline for the treatment of liver cancer and liver metastases with intra-arterial radioactive compounds. Eur J Nucl Med Mol Imaging. 2022",
      u: "https://doi.org/10.1007/s00259-021-05600-z",
    },
    {
      t: "TheraSphere Y-90 Glass Microspheres FDA eIFU P200029S011C",
      u: "https://www.accessdata.fda.gov/cdrh_docs/pdf20/P200029S011C.pdf",
    },
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
  ],
};
