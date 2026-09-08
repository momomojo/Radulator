/**
 * Radiation Dose Converter
 * Comprehensive unit conversion for radiation dose quantities
 *
 * This calculator provides conversion between SI and legacy units for:
 * - Absorbed Dose (Gy, mGy, cGy, rad)
 * - Equivalent/Effective Dose (Sv, mSv, μSv, rem, mrem)
 * - Activity (Bq, kBq, MBq, GBq, Ci, mCi, μCi)
 *
 * Also includes CT effective dose estimation from DLP values.
 *
 * Primary Sources:
 * - ICRP Publication 103 (2007): The 2007 Recommendations of the ICRP
 * - AAPM Report No. 96 (2008): Radiation Dose in CT
 * - ICRP Publication 92 (2003): Radiation Weighting Factors
 */

export const RadiationDoseConverter = {
  id: "radiation-dose-converter",
  category: "Radiology",
  name: "Radiation Dose Converter",
  guidelineVersion: "NIST unit conversions / AAPM96 CT reference / ICRP103 weighting",
  desc: "Convert between radiation dose units (Gy, Sv, Bq, etc.) with CT dose estimation",
  keywords: ["Gy", "rad", "Sv", "rem", "radiation units"],
  tags: ["Radiology", "Safety", "Radiation"],
  metaDesc:
    "Convert radiation units within absorbed dose, Sv/rem or activity. Optional organ-dose relationship and historical AAPM96 CT reference estimates with explicit age, region and phantom basis.",

  info: {
    text: `This comprehensive radiation dose converter supports three categories of radiation measurements:

• Absorbed Dose (Gy, rad): Energy deposited per unit mass
• Equivalent Dose (Sv, rem): Absorbed dose weighted by radiation type (wR factor)
• Activity (Bq, Ci): Rate of radioactive decay

Key relationships:
• 1 Gy = 100 rad = 1000 mGy
• 1 Sv = 100 rem = 1000 mSv
• 1 Ci = 37 GBq = 3.7 × 10¹⁰ Bq

Absorbed dose, organ-equivalent dose and effective dose are distinct quantities. H = wR × organ-mean absorbed dose for one radiation type; effective dose additionally needs tissue weighting. Optional H/wR arithmetic requires explicit organ-equivalent input confirmation. It is not an effective-dose or patient-risk conversion.

CT section: CTDIvol × length estimates DLP. Historical AAPM96 Table3 factors depend on reference age, region and CTDI phantom basis. Unknown or mismatched phantom basis returns DLP without an effective-dose estimate. No individualized dose, normal/abnormal assessment or age interpolation is provided.

Unit factors: NIST SP811. Radiation weighting: ICRP103 as reproduced in IAEA115 (2023). Activity conversion does not assess an administered activity or prescribe a radiopharmaceutical.`,
    link: {
      label: "ICRP Publication 103",
      url: "https://www.icrp.org/publication.asp?id=ICRP+Publication+103",
    },
  },

  fields: [
    // SECTION 1: CONVERSION MODE
    {
      id: "conversion_mode",
      label: "Conversion Mode",
      type: "radio",
      opts: [
        { value: "absorbed", label: "Absorbed Dose (Gy, rad)" },
        { value: "equivalent", label: "Sv / rem Unit Conversion" },
        { value: "activity", label: "Activity (Bq, Ci)" },
      ],
    },

    // SECTION 2: INPUT VALUE
    {
      id: "input_value",
      label: "Input Value",
      type: "number",
      subLabel: "Enter the dose or activity value to convert",
    },

    // SECTION 3: INPUT UNIT - ABSORBED DOSE
    {
      id: "absorbed_unit",
      label: "Input Unit",
      type: "select",
      opts: [
        { value: "Gy", label: "Gray (Gy)" },
        { value: "mGy", label: "milligray (mGy)" },
        { value: "cGy", label: "centigray (cGy)" },
        { value: "rad", label: "rad" },
      ],
      showIf: (vals) => vals.conversion_mode === "absorbed",
    },

    // SECTION 4: INPUT UNIT - EQUIVALENT DOSE
    {
      id: "equivalent_unit",
      label: "Input Unit",
      type: "select",
      opts: [
        { value: "Sv", label: "Sievert (Sv)" },
        { value: "mSv", label: "millisievert (mSv)" },
        { value: "uSv", label: "microsievert (μSv)" },
        { value: "rem", label: "rem" },
        { value: "mrem", label: "millirem (mrem)" },
      ],
      showIf: (vals) => vals.conversion_mode === "equivalent",
    },

    // SECTION 5: INPUT UNIT - ACTIVITY
    {
      id: "activity_unit",
      label: "Input Unit",
      type: "select",
      opts: [
        { value: "Bq", label: "Becquerel (Bq)" },
        { value: "kBq", label: "kilobecquerel (kBq)" },
        { value: "MBq", label: "megabecquerel (MBq)" },
        { value: "GBq", label: "gigabecquerel (GBq)" },
        { value: "Ci", label: "Curie (Ci)" },
        { value: "mCi", label: "millicurie (mCi)" },
        { value: "uCi", label: "microcurie (μCi)" },
      ],
      showIf: (vals) => vals.conversion_mode === "activity",
    },

    // Optional organ-equivalent relationship, never inferred from the Sv unit.
    {
      id: "input_is_organ_equivalent",
      label: "Calculate Organ-Mean Absorbed Dose",
      type: "checkbox",
      subLabel: "I confirm the input is organ-equivalent dose from one radiation type, not effective dose",
      showIf: (vals) => vals.conversion_mode === "equivalent",
    },
    {
      id: "radiation_type",
      label: "Radiation Type",
      type: "select",
      subLabel: "For D = organ-equivalent H / wR; no mixed-spectrum or RBE calculation",
      opts: [
        { value: "photon", label: "X-rays / Gamma rays (wR = 1)" },
        { value: "beta", label: "Beta particles / Electrons (wR = 1)" },
        { value: "proton", label: "Protons (wR = 2)" },
        { value: "alpha", label: "Alpha particles (wR = 20)" },
        { value: "neutron", label: "Neutrons — enter incident energy" },
      ],
      showIf: (vals) => vals.conversion_mode === "equivalent" && vals.input_is_organ_equivalent === true,
    },
    {
      id: "neutron_energy_mev",
      label: "Incident Neutron Energy (MeV)",
      type: "number",
      subLabel: "Positive incident energy; ICRP103 piecewise weighting, not spectrum integration",
      showIf: (vals) => vals.conversion_mode === "equivalent" && vals.input_is_organ_equivalent === true && vals.radiation_type === "neutron",
    },

    // SECTION 7: CT DOSE CALCULATOR
    {
      id: "include_ct_dose",
      label: "Calculate CT Effective Dose",
      type: "checkbox",
      subLabel: "Estimate effective dose from CTDIvol and scan length",
    },

    {
      id: "ctdi_vol",
      label: "CTDIvol (mGy)",
      type: "number",
      subLabel: "Volume CT Dose Index from scanner console",
      showIf: (vals) => vals.include_ct_dose === true,
    },

    {
      id: "scan_length",
      label: "Scan Length (cm)",
      type: "number",
      subLabel: "Total scan coverage",
      showIf: (vals) => vals.include_ct_dose === true,
    },

    {
      id: "body_region",
      label: "Body Region",
      type: "select",
      subLabel: "For k-factor selection",
      opts: [
        { value: "head", label: "Head" },
        { value: "neck", label: "Neck" },
        { value: "chest", label: "Chest" },
        { value: "abdomen", label: "Abdomen (published abdomen/pelvis factor)" },
        { value: "pelvis", label: "Pelvis (published abdomen/pelvis factor)" },
        { value: "trunk", label: "Trunk" },
      ],
      showIf: (vals) => vals.include_ct_dose === true,
    },

    {
      id: "patient_age",
      label: "Patient Age Category",
      type: "select",
      subLabel: "Select the AAPM96 reference age; no interpolation or universal age multiplier",
      opts: [
        { value: "adult", label: "Adult" },
        { value: "10yr", label: "10 years" },
        { value: "5yr", label: "5 years" },
        { value: "1yr", label: "1 year" },
        { value: "0yr", label: "Newborn" },
      ],
      showIf: (vals) => vals.include_ct_dose === true,
    },
    {
      id: "ct_phantom",
      label: "Scanner CTDI Phantom Basis",
      type: "select",
      subLabel: "Read the scanner dose report; patient size alone does not establish the phantom basis",
      opts: [
        { value: "16", label: "16 cm" },
        { value: "32", label: "32 cm" },
        { value: "unknown", label: "Unknown — calculate DLP only" },
      ],
      showIf: (vals) => vals.include_ct_dose === true,
    },
  ],

  compute: (vals) => {
    const {
      conversion_mode = "",
      input_value = "",
      absorbed_unit = "",
      equivalent_unit = "",
      activity_unit = "",
      radiation_type = "",
      include_ct_dose = false,
      ctdi_vol = "",
      scan_length = "",
      body_region = "",
      patient_age = "",
      ct_phantom = "",
    } = vals;

    const result = {};

    const finiteDecimal = (value) => {
      if (typeof value !== "number" && typeof value !== "string") return NaN;
      const text = String(value).trim();
      if (!/^[+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return NaN;
      const number = Number(text);
      if (!Number.isFinite(number) || number < 0) return NaN;
      // A positive decimal too small for Number must not become a known zero.
      if (number === 0 && /[1-9]/.test(text.split(/[eE]/)[0])) return NaN;
      return number;
    };
    const unitFactors = {
      absorbed: { Gy: 1, mGy: 0.001, cGy: 0.01, rad: 0.01 },
      equivalent: { Sv: 1, mSv: 0.001, uSv: 0.000001, rem: 0.01, mrem: 0.00001 },
      activity: { Bq: 1, kBq: 1e3, MBq: 1e6, GBq: 1e9, Ci: 3.7e10, mCi: 3.7e7, uCi: 3.7e4 },
    };
    if (typeof include_ct_dose !== "boolean") {
      return { Error: "Select CT calculation using the checkbox." };
    }
    if (typeof conversion_mode !== "string" || (conversion_mode !== "" && !Object.hasOwn(unitFactors, conversion_mode))) {
      return { Error: "Select a supported conversion mode." };
    }
    if (!conversion_mode && (input_value !== "" || !include_ct_dose)) {
      return { Error: "Select a conversion mode and value, or select CT calculation alone." };
    }
    const inputVal = finiteDecimal(input_value);
    if (conversion_mode) {
      const units = unitFactors[conversion_mode];
      const unit = { absorbed: absorbed_unit, equivalent: equivalent_unit, activity: activity_unit }[conversion_mode];
      if (typeof unit !== "string" || !Object.hasOwn(units, unit) || !Number.isFinite(inputVal)) {
        return { Error: "Enter a complete finite non-negative conversion value and select a supported input unit." };
      }
      const base = inputVal * units[unit];
      if (Object.values(units).some((factor) => !Number.isFinite(base / factor) || (inputVal > 0 && base / factor === 0))) {
        return { Error: "Converted values cannot be represented reliably. Check the value and units." };
      }
    }
    if (include_ct_dose) {
      const dose = finiteDecimal(ctdi_vol);
      const length = finiteDecimal(scan_length);
      if (!(dose > 0) || !(length > 0) ||
          !["head", "neck", "chest", "abdomen", "pelvis", "trunk"].includes(body_region) ||
          !["0yr", "1yr", "5yr", "10yr", "adult"].includes(patient_age) ||
          !["16", "32", "unknown"].includes(ct_phantom)) {
        return { Error: "Enter finite positive CTDIvol and scan length; select age, region and scanner CTDI phantom basis." };
      }
      if (!Number.isFinite(dose * length) || dose * length === 0) {
        return { Error: "DLP cannot be represented reliably. Check CTDIvol and scan length." };
      }
    }

    const formatValue = (value, unit) => {
      if (value === 0) return `0 ${unit}`;
      if (Math.abs(value) >= 1e6 || Math.abs(value) < .0001) return `${value.toExponential(4)} ${unit}`;
      return `${Number(value.toFixed(value < 1 ? 6 : 4))} ${unit}`;
    };
    if (conversion_mode) {
      const units = unitFactors[conversion_mode];
      const unit = { absorbed: absorbed_unit, equivalent: equivalent_unit, activity: activity_unit }[conversion_mode];
      const base = inputVal * units[unit];
      const labels = {
        Gy: "Gray (Gy)", mGy: "milligray (mGy)", cGy: "centigray (cGy)", rad: "rad",
        Sv: "Sievert (Sv)", mSv: "millisievert (mSv)", uSv: "microsievert (μSv)", rem: "rem", mrem: "millirem (mrem)",
        Bq: "Becquerel (Bq)", kBq: "kilobecquerel (kBq)", MBq: "megabecquerel (MBq)", GBq: "gigabecquerel (GBq)",
        Ci: "Curie (Ci)", mCi: "millicurie (mCi)", uCi: "microcurie (μCi)",
      };
      for (const [target, factor] of Object.entries(units)) {
        result[labels[target]] = formatValue(base / factor, target.replace("uSv", "μSv").replace("uCi", "μCi"));
      }
      if (conversion_mode === "absorbed") {
        result["Quantity limitation"] = "Absorbed dose is energy per mass. Organ-equivalent dose H = wR × organ-mean absorbed dose; effective dose additionally requires tissue weighting. A Gy input alone does not establish effective dose or patient risk.";
      } else if (conversion_mode === "activity") {
        result["Activity limitation"] = "Activity alone does not determine absorbed dose or whether an administered activity is appropriate. Tracer, indication, patient and protocol details are required; no prescribing recommendation is made.";
        result["Quick Reference"] = "1 mCi = 37 MBq | 1 Ci = 37 GBq";
      } else {
        result["Quantity limitation"] = "Sv/rem conversion preserves the entered quantity. Organ-equivalent and effective dose are not interchangeable; these unit conversions do not infer patient risk or compare patient exposure with occupational limits.";
        const confirmed = vals.input_is_organ_equivalent === undefined ? false : vals.input_is_organ_equivalent;
        if (typeof confirmed !== "boolean") return { Error: "Confirm the organ-equivalent input assumption using the checkbox." };
        if (confirmed) {
          if (typeof radiation_type !== "string") return { Error: "Select a supported radiation type for the organ-dose relationship." };
          const fixed = { photon: 1, beta: 1, proton: 2, alpha: 20 };
          let weight;
          if (Object.hasOwn(fixed, radiation_type)) {
            weight = fixed[radiation_type];
          } else if (radiation_type === "neutron") {
            const energy = finiteDecimal(vals.neutron_energy_mev);
            if (!(energy > 0)) return { Error: "Enter a finite positive incident neutron energy in MeV." };
            const logEnergy = Math.log(energy);
            weight = energy < 1
              ? 2.5 + 18.2 * Math.exp(-(logEnergy ** 2) / 6)
              : energy <= 50
                ? 5 + 17 * Math.exp(-((logEnergy + Math.LN2) ** 2) / 6)
                : 2.5 + 3.25 * Math.exp(-((logEnergy + Math.log(.04)) ** 2) / 6);
          } else {
            return { Error: "Select a supported radiation type for the organ-dose relationship." };
          }
          const dose = base / weight;
          if (!Number.isFinite(dose) || (inputVal > 0 && dose === 0)) {
            return { Error: "Organ-mean absorbed dose cannot be represented reliably. Check the input and units." };
          }
          result["wR Factor"] = `${Number(weight.toFixed(6))} (${radiation_type}; ICRP103 / IAEA115)`;
          result["Organ dose formula"] = "D (Gy) = organ-equivalent H (Sv) / wR";
          result["Corresponding Absorbed Dose"] = formatValue(dose, "Gy");
          result["Organ dose assumptions"] = "Input is organ-equivalent dose from one radiation type, not effective dose. Neutron weighting assumes the stated incident energy; this is not spectrum integration, operational dosimeter conversion or radiotherapy RBE.";
          if (radiation_type === "neutron") result["Incident neutron energy"] = formatValue(finiteDecimal(vals.neutron_energy_mev), "MeV");
        }
      }
    }

    // AAPM Report 96, Table 3, printed p.13: age-specific reference factors.
    if (include_ct_dose) {
      const dlp = finiteDecimal(ctdi_vol) * finiteDecimal(scan_length);
      const table = {
        head: [.011, .0067, .0040, .0032, .0021],
        neck: [.017, .012, .011, .0079, .0059],
        chest: [.039, .026, .018, .013, .014],
        abdomen: [.049, .030, .020, .015, .015],
        pelvis: [.049, .030, .020, .015, .015],
        trunk: [.044, .028, .019, .014, .015],
      };
      const ageIndex = ["0yr", "1yr", "5yr", "10yr", "adult"].indexOf(patient_age);
      const requiredPhantom = patient_age !== "adult" || ["head", "neck"].includes(body_region) ? "16" : "32";
      result["CT Dose Calculation"] = "AAPM Report 96 (2008), Table 3 reference estimate";
      result["Input - CTDIvol"] = formatValue(finiteDecimal(ctdi_vol), "mGy");
      result["Input - Scan Length"] = formatValue(finiteDecimal(scan_length), "cm");
      result["DLP (Dose Length Product)"] = dlp >= .1 && dlp < 1e6 ? `${dlp.toFixed(1)} mGy·cm` : formatValue(dlp, "mGy·cm");
      result["CT reference scope"] = `${body_region}; ${patient_age}; scanner phantom ${ct_phantom} cm. Abdomen/pelvis share the published combined-region factor. DLP here is CTDIvol × length, not a replacement for scanner-reported series DLP.`;
      if (ct_phantom !== requiredPhantom) {
        result["CT estimate limitation"] = `Effective-dose estimate withheld: this age/region table requires the ${requiredPhantom} cm CTDI phantom basis. Confirm the scanner basis; no phantom conversion is assumed.`;
      } else {
        const kFactor = table[body_region][ageIndex];
        const effectiveDose = dlp * kFactor;
        if (!Number.isFinite(effectiveDose) || effectiveDose === 0) {
          return { Error: "Estimated effective dose cannot be represented reliably. Check CTDIvol and scan length." };
        }
        result["k-factor"] = `${kFactor} mSv/(mGy·cm) [${requiredPhantom} cm phantom]`;
        result["CT Formula"] = "E (mSv) = DLP × k";
        result["Estimated Effective Dose"] = formatValue(effectiveDose, "mSv");
      }
      result["Important Limitations"] = "Historical AAPM96 population/reference estimate, not individualized organ dose, patient risk, or a judgment of exposure appropriateness. Age and region factors are not universal multipliers; no interpolation or protocol optimization is performed.";
    }


    result._severity = "info";
    if (include_ct_dose && !conversion_mode) {
      const primary = result["Estimated Effective Dose"] ? "Estimated Effective Dose" : "DLP (Dose Length Product)";
      return { [primary]: result[primary], ...result };
    }
    return result;
  },

  refs: [
    {
      t: "NIST SP811 Appendix B.9, radiology conversion factors: Gy/rad, Sv/rem and Bq/Ci.",
      u: "https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9",
    },
    {
      t: "IAEA Safety Reports Series115 (2023), Neutron Monitoring for Radiation Protection, printed pp41–42, Eq5.10/Table5.4: ICRP103 radiation weighting.",
      u: "https://www-pub.iaea.org/MTCD/Publications/PDF/PUB1987_web.pdf",
    },
    {
      t: "ICRP Publication 103 (2007). The 2007 Recommendations of the International Commission on Radiological Protection. Ann ICRP 37(2-4).",
      u: "https://www.icrp.org/publication.asp?id=ICRP+Publication+103",
    },
    {
      t: "ICRP Publication 92 (2003). Relative Biological Effectiveness (RBE), Quality Factor (Q), and Radiation Weighting Factor (wR). Ann ICRP 33(4).",
      u: "https://www.icrp.org/publication.asp?id=ICRP+Publication+92",
    },
    {
      t: "AAPM Report No. 96 (2008). The Measurement, Reporting, and Management of Radiation Dose in CT. American Association of Physicists in Medicine.",
      u: "https://www.aapm.org/pubs/reports/RPT_96.pdf",
    },
    {
      t: "European Commission (1999). European Guidelines on Quality Criteria for Computed Tomography. Report EUR 16262.",
      u: "https://op.europa.eu/en/publication-detail/-/publication/d229c9e1-a967-49de-b169-59ee68605f1a",
    },
    {
      t: "Smith-Bindman R, et al. Radiation Dose Associated with Common Computed Tomography Examinations. Arch Intern Med. 2009;169(22):2078-2086.",
      u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4635397/",
    },
    {
      t: "NCRP Report No. 160 (2009). Ionizing Radiation Exposure of the Population of the United States.",
      u: "https://ncrponline.org/publications/reports/ncrp-report-160/",
    },
    {
      t: "Radiologyinfo.org - Radiation Dose in X-Ray and CT Exams. Radiological Society of North America.",
      u: "https://www.radiologyinfo.org/en/info/safety-xray",
    },
    {
      t: "REMM - Radiation Units and Conversion Factors. U.S. Department of Health and Human Services.",
      u: "https://remm.hhs.gov/radmeasurement.htm",
    },
  ],
};
