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
  desc: "Convert between radiation dose units (Gy, Sv, Bq, etc.) with CT dose estimation",
  keywords: ["Gy", "rad", "Sv", "rem", "radiation units"],
  tags: ["Radiology", "Safety", "Radiation"],
  metaDesc:
    "Free Radiation Dose Unit Converter. Convert between Gray, Sievert, Becquerel, rad, rem, and Curie. Includes CT effective dose calculator with DLP to mSv conversion using ICRP 103 standards.",

  info: {
    text: `This comprehensive radiation dose converter supports three categories of radiation measurements:

• Absorbed Dose (Gy, rad): Energy deposited per unit mass
• Equivalent Dose (Sv, rem): Absorbed dose weighted by radiation type (wR factor)
• Activity (Bq, Ci): Rate of radioactive decay

Key relationships:
• 1 Gy = 100 rad = 1000 mGy
• 1 Sv = 100 rem = 1000 mSv
• 1 Ci = 37 GBq = 3.7 × 10¹⁰ Bq

For photons (X-rays, gamma): 1 Gy = 1 Sv
For alpha particles: 1 Gy = 20 Sv (wR = 20)

CT Dose Section: Calculates effective dose from CTDIvol and scan length using AAPM/European Commission k-factors.

All conversions follow ICRP Publication 103 (2007) standards.`,
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
        { value: "equivalent", label: "Equivalent Dose (Sv, rem)" },
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

    // SECTION 6: RADIATION TYPE (for equivalent dose)
    {
      id: "radiation_type",
      label: "Radiation Type",
      type: "select",
      subLabel: "For absorbed → equivalent dose relationship (wR factor)",
      opts: [
        { value: "photon", label: "X-rays / Gamma rays (wR = 1)" },
        { value: "beta", label: "Beta particles / Electrons (wR = 1)" },
        { value: "proton", label: "Protons (wR = 2)" },
        { value: "alpha", label: "Alpha particles (wR = 20)" },
        { value: "neutron_low", label: "Neutrons < 10 keV (wR ≈ 5)" },
        { value: "neutron_med", label: "Neutrons 100 keV - 2 MeV (wR ≈ 20)" },
        { value: "neutron_high", label: "Neutrons > 20 MeV (wR ≈ 5)" },
      ],
      showIf: (vals) => vals.conversion_mode === "equivalent",
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
        { value: "head", label: "Head (k = 0.0021)" },
        { value: "neck", label: "Neck (k = 0.0059)" },
        { value: "chest", label: "Chest (k = 0.014)" },
        { value: "abdomen", label: "Abdomen (k = 0.015)" },
        { value: "pelvis", label: "Pelvis (k = 0.015)" },
        { value: "trunk", label: "Trunk/CAP (k = 0.015)" },
      ],
      showIf: (vals) => vals.include_ct_dose === true,
    },

    {
      id: "patient_age",
      label: "Patient Age Category",
      type: "select",
      subLabel: "Pediatric patients receive higher effective doses",
      opts: [
        { value: "adult", label: "Adult (1.0x)" },
        { value: "10yr", label: "10 years (1.2x)" },
        { value: "5yr", label: "5 years (1.5x)" },
        { value: "1yr", label: "1 year (1.9x)" },
        { value: "0yr", label: "Newborn (2.25x)" },
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
    } = vals;

    const result = {};

    // Validate required fields for unit conversion
    if (!conversion_mode && input_value !== "" && !include_ct_dose) {
      return {
        Error: "Please select a conversion mode to begin.",
      };
    }

    const inputVal = parseFloat(input_value);

    // Helper function to format values with appropriate precision
    const formatValue = (val, unit) => {
      if (val === 0) return `0 ${unit}`;
      if (Math.abs(val) >= 1e6) return `${val.toExponential(4)} ${unit}`;
      let str;
      if (Math.abs(val) >= 1) {
        str = val.toFixed(4);
      } else if (Math.abs(val) >= 0.0001) {
        str = val.toFixed(6);
      } else {
        return `${val.toExponential(4)} ${unit}`;
      }
      // Strip trailing zeros for clean display
      str = str.replace(/\.?0+$/, "");
      return `${str} ${unit}`;
    };

    // Process unit conversions if input value provided
    if (!isNaN(inputVal) && inputVal >= 0) {
      // ABSORBED DOSE CONVERSIONS
      if (conversion_mode === "absorbed") {
        if (!absorbed_unit) {
          result["Error"] = "Please select an input unit.";
        } else {
          // Convert to base unit (Gy)
          let valueInGy;
          switch (absorbed_unit) {
            case "Gy":
              valueInGy = inputVal;
              break;
            case "mGy":
              valueInGy = inputVal * 0.001;
              break;
            case "cGy":
              valueInGy = inputVal * 0.01;
              break;
            case "rad":
              valueInGy = inputVal * 0.01;
              break;
            default:
              valueInGy = inputVal;
          }

          result["Absorbed Dose Conversions"] = "━━━━━━━━━━━━━━━━━━━━━━━━━";
          result["Gray (Gy)"] = formatValue(valueInGy, "Gy");
          result["milligray (mGy)"] = formatValue(valueInGy * 1000, "mGy");
          result["centigray (cGy)"] = formatValue(valueInGy * 100, "cGy");
          result["rad"] = formatValue(valueInGy * 100, "rad");

          // Add equivalent dose note for photons
          result["Equivalent Dose (X-rays/gamma)"] =
            "━━━━━━━━━━━━━━━━━━━━━━━━━";
          result["Note (wR = 1)"] =
            `For X-rays/gamma: ${formatValue(valueInGy, "Gy")} = ${formatValue(valueInGy, "Sv")}`;
          result["Note (wR = 20)"] =
            `For alpha particles: ${formatValue(valueInGy, "Gy")} = ${formatValue(valueInGy * 20, "Sv")}`;
        }
      }

      // EQUIVALENT DOSE CONVERSIONS
      if (conversion_mode === "equivalent") {
        if (!equivalent_unit) {
          result["Error"] = "Please select an input unit.";
        } else {
          // Convert to base unit (Sv)
          let valueInSv;
          switch (equivalent_unit) {
            case "Sv":
              valueInSv = inputVal;
              break;
            case "mSv":
              valueInSv = inputVal * 0.001;
              break;
            case "uSv":
              valueInSv = inputVal * 0.000001;
              break;
            case "rem":
              valueInSv = inputVal * 0.01;
              break;
            case "mrem":
              valueInSv = inputVal * 0.00001;
              break;
            default:
              valueInSv = inputVal;
          }

          result["Equivalent Dose Conversions"] = "━━━━━━━━━━━━━━━━━━━━━━━━━";
          result["Sievert (Sv)"] = formatValue(valueInSv, "Sv");
          result["millisievert (mSv)"] = formatValue(valueInSv * 1000, "mSv");
          result["microsievert (μSv)"] = formatValue(
            valueInSv * 1000000,
            "μSv",
          );
          result["rem"] = formatValue(valueInSv * 100, "rem");
          result["millirem (mrem)"] = formatValue(valueInSv * 100000, "mrem");

          // Radiation weighting factor info
          if (radiation_type) {
            let wR, wRNote;
            switch (radiation_type) {
              case "photon":
                wR = 1;
                wRNote = "X-rays, gamma rays";
                break;
              case "beta":
                wR = 1;
                wRNote = "Beta particles, electrons";
                break;
              case "proton":
                wR = 2;
                wRNote = "Protons (> 2 MeV)";
                break;
              case "alpha":
                wR = 20;
                wRNote = "Alpha particles";
                break;
              case "neutron_low":
                wR = 5;
                wRNote = "Neutrons < 10 keV";
                break;
              case "neutron_med":
                wR = 20;
                wRNote = "Neutrons 100 keV - 2 MeV";
                break;
              case "neutron_high":
                wR = 5;
                wRNote = "Neutrons > 20 MeV";
                break;
              default:
                wR = 1;
                wRNote = "Default";
            }

            result["Radiation Weighting Factor"] = "━━━━━━━━━━━━━━━━━━━━━━━━━";
            result["wR Factor"] = `${wR} (${wRNote})`;
            result["Formula"] = `H (Sv) = D (Gy) × wR`;

            // Show absorbed dose equivalent
            const absorbedDose = valueInSv / wR;
            result["Corresponding Absorbed Dose"] = formatValue(
              absorbedDose,
              "Gy",
            );
          }

          // Reference doses for context
          const valueInMSv = valueInSv * 1000;
          result["Dose Context"] = "━━━━━━━━━━━━━━━━━━━━━━━━━";

          // Calculate chest X-ray equivalents (0.02 mSv per PA chest X-ray)
          const chestXrayEq = valueInMSv / 0.02;
          // Background radiation ~3 mSv/year = 0.00822 mSv/day
          const backgroundDaysEq = valueInMSv / (3 / 365);

          result["Equivalent Background Radiation"] =
            `${backgroundDaysEq.toFixed(1)} days of natural background`;
          result["Equivalent Chest X-rays (PA)"] =
            `≈ ${chestXrayEq.toFixed(0)} chest X-rays`;

          // Contextual comparisons
          const comparisons = [];
          if (valueInMSv < 0.02)
            comparisons.push("Less than a chest X-ray (0.02 mSv)");
          else if (valueInMSv < 0.1)
            comparisons.push("Similar to a chest X-ray");
          else if (valueInMSv < 1)
            comparisons.push("Similar to a few chest X-rays");
          else if (valueInMSv < 3)
            comparisons.push("Similar to 1 year of background radiation");
          else if (valueInMSv < 8)
            comparisons.push("Similar to CT chest range (4-8 mSv)");
          else if (valueInMSv < 15)
            comparisons.push("Similar to CT abdomen/pelvis range");
          else if (valueInMSv < 50)
            comparisons.push("Approaching annual occupational limit (50 mSv)");
          else comparisons.push("Exceeds annual occupational limit (50 mSv)");

          if (comparisons.length > 0) {
            result["Context"] = comparisons.join("; ");
          }
        }
      }

      // ACTIVITY CONVERSIONS
      if (conversion_mode === "activity") {
        if (!activity_unit) {
          result["Error"] = "Please select an input unit.";
        } else {
          // Convert to base unit (Bq)
          let valueInBq;
          switch (activity_unit) {
            case "Bq":
              valueInBq = inputVal;
              break;
            case "kBq":
              valueInBq = inputVal * 1e3;
              break;
            case "MBq":
              valueInBq = inputVal * 1e6;
              break;
            case "GBq":
              valueInBq = inputVal * 1e9;
              break;
            case "Ci":
              valueInBq = inputVal * 3.7e10;
              break;
            case "mCi":
              valueInBq = inputVal * 3.7e7;
              break;
            case "uCi":
              valueInBq = inputVal * 3.7e4;
              break;
            default:
              valueInBq = inputVal;
          }

          result["Activity Conversions (SI Units)"] =
            "━━━━━━━━━━━━━━━━━━━━━━━━━";
          result["Becquerel (Bq)"] =
            valueInBq >= 1e6
              ? `${valueInBq.toExponential(4)} Bq`
              : formatValue(valueInBq, "Bq");
          result["kilobecquerel (kBq)"] = formatValue(valueInBq / 1e3, "kBq");
          result["megabecquerel (MBq)"] = formatValue(valueInBq / 1e6, "MBq");
          result["gigabecquerel (GBq)"] = formatValue(valueInBq / 1e9, "GBq");

          result["Activity Conversions (Legacy Units)"] =
            "━━━━━━━━━━━━━━━━━━━━━━━━━";
          result["Curie (Ci)"] = formatValue(valueInBq / 3.7e10, "Ci");
          result["millicurie (mCi)"] = formatValue(valueInBq / 3.7e7, "mCi");
          result["microcurie (μCi)"] = formatValue(valueInBq / 3.7e4, "μCi");

          // Common nuclear medicine context
          const valueInMBq = valueInBq / 1e6;
          result["Nuclear Medicine Context"] = "━━━━━━━━━━━━━━━━━━━━━━━━━";

          const nmComparisons = [];
          if (valueInMBq >= 370 && valueInMBq <= 555) {
            nmComparisons.push(
              "Typical FDG PET dose range (370-555 MBq / 10-15 mCi)",
            );
          }
          if (valueInMBq >= 740 && valueInMBq <= 925) {
            nmComparisons.push(
              "Typical Tc-99m MDP bone scan range (740-925 MBq / 20-25 mCi)",
            );
          }
          if (valueInMBq >= 740 && valueInMBq <= 1110) {
            nmComparisons.push("Typical Tc-99m sestamibi cardiac stress range");
          }
          if (valueInMBq >= 1110 && valueInMBq <= 7400) {
            nmComparisons.push("Therapeutic I-131 range (30-200 mCi)");
          }

          if (nmComparisons.length > 0) {
            result["Clinical Context"] = nmComparisons.join("; ");
          } else if (valueInMBq < 370) {
            result["Clinical Context"] =
              "Below typical diagnostic nuclear medicine doses";
          } else {
            result["Clinical Context"] =
              "Common diagnostic activities: 370-925 MBq (10-25 mCi)";
          }

          // Quick reference
          result["Quick Reference"] = "1 mCi = 37 MBq | 1 Ci = 37 GBq";
        }
      }
    } else if (input_value !== "" && !include_ct_dose) {
      result["Error"] =
        "Please enter a valid non-negative number for conversion.";
    }

    // CT DOSE CALCULATION
    if (include_ct_dose) {
      const ctdiVolVal = parseFloat(ctdi_vol);
      const scanLengthVal = parseFloat(scan_length);

      if (
        !isNaN(ctdiVolVal) &&
        !isNaN(scanLengthVal) &&
        ctdiVolVal > 0 &&
        scanLengthVal > 0 &&
        body_region
      ) {
        // Calculate DLP
        const dlp = ctdiVolVal * scanLengthVal;

        // Get k-factor based on body region (AAPM Report 96 / European Commission)
        let kFactor;
        let phantomSize;
        switch (body_region) {
          case "head":
            kFactor = 0.0021;
            phantomSize = "16 cm";
            break;
          case "neck":
            kFactor = 0.0059;
            phantomSize = "16 cm";
            break;
          case "chest":
            kFactor = 0.014;
            phantomSize = "32 cm";
            break;
          case "abdomen":
            kFactor = 0.015;
            phantomSize = "32 cm";
            break;
          case "pelvis":
            kFactor = 0.015;
            phantomSize = "32 cm";
            break;
          case "trunk":
            kFactor = 0.015;
            phantomSize = "32 cm";
            break;
          default:
            kFactor = 0.015;
            phantomSize = "32 cm";
        }

        // Get age multiplier for pediatric patients
        let ageMultiplier;
        let ageDesc;
        switch (patient_age) {
          case "0yr":
            ageMultiplier = 2.25;
            ageDesc = "Newborn";
            break;
          case "1yr":
            ageMultiplier = 1.9;
            ageDesc = "1 year";
            break;
          case "5yr":
            ageMultiplier = 1.5;
            ageDesc = "5 years";
            break;
          case "10yr":
            ageMultiplier = 1.2;
            ageDesc = "10 years";
            break;
          case "adult":
          default:
            ageMultiplier = 1.0;
            ageDesc = "Adult";
        }

        // Calculate effective dose
        const effectiveDoseAdult = dlp * kFactor;
        const effectiveDose = effectiveDoseAdult * ageMultiplier;

        result["CT Dose Calculation"] = "━━━━━━━━━━━━━━━━━━━━━━━━━";
        result["Input - CTDIvol"] = `${ctdiVolVal.toFixed(2)} mGy`;
        result["Input - Scan Length"] = `${scanLengthVal.toFixed(1)} cm`;
        result["DLP (Dose Length Product)"] = `${dlp.toFixed(1)} mGy·cm`;
        result["k-factor"] =
          `${kFactor} mSv/(mGy·cm) [${body_region}, ${phantomSize} phantom]`;
        result["Formula"] = "E (mSv) = DLP × k";

        if (patient_age && patient_age !== "adult") {
          result["Age Adjustment"] =
            `${ageMultiplier}× multiplier for ${ageDesc}`;
          result["Adult Effective Dose"] =
            `${effectiveDoseAdult.toFixed(2)} mSv`;
        }

        result["Estimated Effective Dose"] = `${effectiveDose.toFixed(2)} mSv`;

        // Context comparisons
        const chestXrays = effectiveDose / 0.02;
        const backgroundDays = effectiveDose / (3 / 365);
        result["Equivalent Chest X-rays"] = `≈ ${Math.round(chestXrays)}`;
        result["Equivalent Background Days"] =
          `≈ ${Math.round(backgroundDays)} days`;

        // Typical dose range comparison by body region
        result["Dose Assessment"] = "━━━━━━━━━━━━━━━━━━━━━━━━━";
        let doseContext = "";
        let typicalRange = "";

        if (body_region === "head") {
          typicalRange = "Typical head CT: 1.5-2.5 mSv";
          if (effectiveDose < 1.5) doseContext = "Below typical range";
          else if (effectiveDose <= 2.5) doseContext = "Within typical range";
          else doseContext = "Above typical range";
        } else if (body_region === "neck") {
          typicalRange = "Typical neck CT: 1.5-3.0 mSv";
          if (effectiveDose < 1.5) doseContext = "Below typical range";
          else if (effectiveDose <= 3.0) doseContext = "Within typical range";
          else doseContext = "Above typical range";
        } else if (body_region === "chest") {
          typicalRange = "Typical chest CT: 4-8 mSv";
          if (effectiveDose < 4) doseContext = "Below typical range";
          else if (effectiveDose <= 8) doseContext = "Within typical range";
          else doseContext = "Above typical range";
        } else if (body_region === "abdomen" || body_region === "pelvis") {
          typicalRange = "Typical abdomen/pelvis CT: 6-15 mSv";
          if (effectiveDose < 6) doseContext = "Below typical range";
          else if (effectiveDose <= 15) doseContext = "Within typical range";
          else doseContext = "Above typical range";
        } else if (body_region === "trunk") {
          typicalRange = "Typical CAP CT: 8-15 mSv";
          if (effectiveDose < 8) doseContext = "Below typical range";
          else if (effectiveDose <= 15) doseContext = "Within typical range";
          else doseContext = "Above typical range";
        }

        result["Typical Range"] = typicalRange;
        result["Assessment"] = doseContext;

        // Important limitations
        result["Important Limitations"] =
          "k-factors provide population-average estimates only. Actual patient dose varies significantly with body habitus. Consider Size-Specific Dose Estimates (SSDE) for individual patients.";
      } else if (include_ct_dose) {
        result["CT Dose Input Required"] =
          "Enter CTDIvol (mGy), scan length (cm), and select body region.";
      }
    }

    // Add reference dose table if no specific calculation was done
    if (
      Object.keys(result).length === 0 ||
      (input_value === "" && !include_ct_dose)
    ) {
      result["Common Reference Doses"] = "━━━━━━━━━━━━━━━━━━━━━━━━━";
      result["Chest X-ray (PA)"] = "0.02 mSv";
      result["Chest X-ray (PA + Lat)"] = "0.1 mSv";
      result["Mammography (bilateral)"] = "0.4 mSv";
      result["Lumbar Spine X-ray"] = "1.5 mSv";
      result["CT Head"] = "1.5-2.5 mSv";
      result["CT Chest"] = "4-8 mSv";
      result["CT Abdomen/Pelvis"] = "8-15 mSv";
      result["Bone Scan (Tc-99m MDP)"] = "4-5 mSv";
      result["PET/CT (F-18 FDG)"] = "7-14 mSv";

      result["Dose Limits (ICRP)"] = "━━━━━━━━━━━━━━━━━━━━━━━━━";
      result["Annual Background (US avg)"] = "~3 mSv/year";
      result["Public Annual Limit"] = "1 mSv/year";
      result["Occupational Annual Limit"] = "50 mSv/year";
      result["Occupational 5-Year Limit"] = "100 mSv (20 mSv/year average)";

      result["Instructions"] =
        "Select a conversion mode and enter a value to see unit conversions.";
    }

    return result;
  },

  refs: [
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
