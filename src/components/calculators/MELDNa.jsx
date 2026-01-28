/**
 * MELD-Na Calculator
 * Model for End-Stage Liver Disease with Sodium
 *
 * MELD Score Formula (Kamath et al. 2001, Wiesner et al. 2003):
 * MELD = [0.957 × ln(Cr) + 0.378 × ln(Bili) + 1.120 × ln(INR) + 0.643] × 10
 *
 * MELD-Na Formula (Kim et al. 2008):
 * MELD-Na = MELD + 1.32 × (137 - Na) - [0.033 × MELD × (137 - Na)]
 *
 * Bounds and Adjustments:
 * - Lower bounds: Cr ≥ 1.0, Bili ≥ 1.0, INR ≥ 1.0
 * - If dialysis ≥2x in past week OR 24hr CVVHD: Cr = 4.0
 * - If Cr > 4.0: Cr = 4.0
 * - MELD rounded to nearest integer, capped 6-40
 * - Na capped between 125-137 mEq/L for MELD-Na calculation
 * - MELD-Na only applies if MELD > 11
 *
 * References:
 * 1. Kamath PS et al. Hepatology 2001;33(2):464-70
 * 2. Wiesner R et al. Liver Transpl 2003;9(3):252-8
 * 3. Kim WR et al. Gastroenterology 2008;134(4):1001-1001.e1
 * 4. Biggins SW et al. Hepatology 2021;74(2):1104-15
 * 5. UNOS Policy 9: Allocation of Livers and Liver-Intestines
 * 6. Sharma P et al. Am J Transplant 2008;8(11):2420-4
 */

export const MELDNa = {
  id: "meld-na",
  category: "Hepatology/Liver",
  name: "MELD-Na Score",
  desc: "Model for End-Stage Liver Disease with Sodium for transplant prioritization",
  keywords: [
    "liver transplant",
    "cirrhosis",
    "end-stage liver disease",
    "ESLD",
    "transplant priority",
  ],
  metaDesc:
    "Free MELD-Na Score Calculator. Calculate Model for End-Stage Liver Disease with Sodium for liver transplant prioritization. Includes 90-day mortality estimate and UNOS allocation.",

  info: {
    text:
      "The MELD-Na score predicts 3-month mortality in patients with end-stage liver disease and is used for liver transplant allocation.\n\n" +
      "Key Points:\n" +
      "• MELD uses creatinine, bilirubin, and INR\n" +
      "• MELD-Na adds sodium correction (only if MELD > 11)\n" +
      "• Dialysis ≥2x/week or 24hr CVVHD sets creatinine to 4.0\n" +
      "• Values are bounded: Cr, Bili, INR ≥ 1.0; Na 125-137 mEq/L\n" +
      "• Final scores capped at 6-40 range\n\n" +
      "Interpretation guides allocation priority for liver transplantation (UNOS).",
  },

  fields: [
    {
      id: "creatinine",
      label: "Creatinine",
      subLabel: "mg/dL (0.1-15.0)",
      type: "number",
    },
    {
      id: "bilirubin",
      label: "Total Bilirubin",
      subLabel: "mg/dL (0.1-50.0)",
      type: "number",
    },
    {
      id: "inr",
      label: "INR",
      subLabel: "0.8-10.0",
      type: "number",
    },
    {
      id: "sodium",
      label: "Sodium",
      subLabel: "mEq/L (110-160)",
      type: "number",
    },
    {
      id: "dialysis",
      label: "Dialysis ≥2 times in past week OR 24hr CVVHD",
      type: "checkbox",
    },
  ],

  compute: ({ creatinine, bilirubin, inr, sodium, dialysis }) => {
    // Parse and validate inputs
    const cr = parseFloat(creatinine);
    const bili = parseFloat(bilirubin);
    const inrVal = parseFloat(inr);
    const na = parseFloat(sodium);

    // Validation
    if (!cr || !bili || !inrVal || !na) {
      return {
        Error:
          "Please enter all required values (creatinine, bilirubin, INR, and sodium).",
      };
    }

    if (cr < 0.1 || cr > 15.0) {
      return { Error: "Creatinine must be between 0.1 and 15.0 mg/dL" };
    }
    if (bili < 0.1 || bili > 50.0) {
      return { Error: "Bilirubin must be between 0.1 and 50.0 mg/dL" };
    }
    if (inrVal < 0.8 || inrVal > 10.0) {
      return { Error: "INR must be between 0.8 and 10.0" };
    }
    if (na < 110 || na > 160) {
      return { Error: "Sodium must be between 110 and 160 mEq/L" };
    }

    const notes = [];

    // Apply creatinine adjustments per MELD rules
    let adjustedCr = cr;

    // Lower bound: Cr ≥ 1.0
    if (adjustedCr < 1.0) {
      adjustedCr = 1.0;
      notes.push("Creatinine set to lower bound of 1.0 mg/dL");
    }

    // Dialysis rule: If dialysis ≥2x/week or 24hr CVVHD, set Cr = 4.0
    if (dialysis) {
      adjustedCr = 4.0;
      notes.push(
        "Creatinine set to 4.0 mg/dL (dialysis ≥2x/week or 24hr CVVHD)",
      );
    }
    // Upper bound: If Cr > 4.0, cap at 4.0
    else if (adjustedCr > 4.0) {
      adjustedCr = 4.0;
      notes.push("Creatinine capped at 4.0 mg/dL");
    }

    // Apply bilirubin lower bound
    let adjustedBili = bili;
    if (adjustedBili < 1.0) {
      adjustedBili = 1.0;
      notes.push("Bilirubin set to lower bound of 1.0 mg/dL");
    }

    // Apply INR lower bound
    let adjustedINR = inrVal;
    if (adjustedINR < 1.0) {
      adjustedINR = 1.0;
      notes.push("INR set to lower bound of 1.0");
    }

    // Calculate MELD score
    // MELD = [0.957 × ln(Cr) + 0.378 × ln(Bili) + 1.120 × ln(INR) + 0.643] × 10
    const meldRaw =
      (0.957 * Math.log(adjustedCr) +
        0.378 * Math.log(adjustedBili) +
        1.12 * Math.log(adjustedINR) +
        0.643) *
      10;

    // Round to nearest integer
    let meld = Math.round(meldRaw);

    // Cap MELD between 6 and 40
    if (meld < 6) {
      meld = 6;
      notes.push("MELD score capped at minimum of 6");
    } else if (meld > 40) {
      meld = 40;
      notes.push("MELD score capped at maximum of 40");
    }

    // Calculate MELD-Na (only if MELD > 11)
    let meldNa = meld;
    let adjustedNa = na;

    if (meld > 11) {
      // Cap sodium between 125 and 137 mEq/L
      if (adjustedNa < 125) {
        adjustedNa = 125;
        notes.push(
          "Sodium set to lower bound of 125 mEq/L for MELD-Na calculation",
        );
      } else if (adjustedNa > 137) {
        adjustedNa = 137;
        notes.push(
          "Sodium set to upper bound of 137 mEq/L for MELD-Na calculation",
        );
      }

      // MELD-Na = MELD + 1.32 × (137 - Na) - [0.033 × MELD × (137 - Na)]
      const naCorrection =
        1.32 * (137 - adjustedNa) - 0.033 * meld * (137 - adjustedNa);
      meldNa = meld + naCorrection;

      // Round to nearest integer
      meldNa = Math.round(meldNa);

      // Cap MELD-Na between 6 and 40
      if (meldNa < 6) {
        meldNa = 6;
      } else if (meldNa > 40) {
        meldNa = 40;
      }
    } else {
      notes.push(
        "MELD-Na equals MELD (sodium correction only applies when MELD > 11)",
      );
    }

    // Determine 3-month mortality based on MELD-Na score
    // Using established mortality estimates from Kamath 2001 and subsequent validation
    let mortality;
    let riskCategory;

    if (meldNa <= 9) {
      mortality = "1.9%";
      riskCategory = "Low risk";
    } else if (meldNa <= 19) {
      mortality = "6.0%";
      riskCategory = "Moderate risk";
    } else if (meldNa <= 29) {
      mortality = "19.6%";
      riskCategory = "High risk";
    } else if (meldNa <= 39) {
      mortality = "52.6%";
      riskCategory = "Very high risk";
    } else {
      mortality = ">70%";
      riskCategory = "Critical risk";
    }

    // Build interpretation
    let interpretation = `${riskCategory} of 3-month mortality without transplantation. `;

    if (meldNa >= 15) {
      interpretation +=
        "Patient meets criteria for liver transplant evaluation (MELD-Na ≥15). ";
    }

    if (meldNa >= 25) {
      interpretation += "High priority for transplantation.";
    } else if (meldNa >= 15) {
      interpretation += "Candidate for transplant listing.";
    } else {
      interpretation +=
        "Monitor closely; transplant evaluation if disease progresses.";
    }

    // Build result object
    const result = {
      "MELD Score": meld.toString(),
      "MELD-Na Score": meldNa.toString(),
      "3-Month Mortality": mortality,
      "Risk Category": riskCategory,
      Interpretation: interpretation,
    };

    // Add clinical notes if any
    if (notes.length > 0) {
      result["Clinical Notes"] = notes.join("; ");
    }

    return result;
  },

  refs: [
    {
      t: "Kamath PS et al. Hepatology 2001 - Original MELD Score",
      u: "https://doi.org/10.1053/jhep.2001.22172",
    },
    {
      t: "Wiesner R et al. Liver Transpl 2003 - MELD for Transplant Allocation",
      u: "https://doi.org/10.1053/jlts.2003.50040",
    },
    {
      t: "Kim WR et al. Gastroenterology 2008 - MELD-Na Development",
      u: "https://doi.org/10.1053/j.gastro.2008.01.029",
    },
    {
      t: "Biggins SW et al. Hepatology 2021 - MELD-Na Implementation",
      u: "https://doi.org/10.1002/hep.31565",
    },
    {
      t: "UNOS Policy 9 - Allocation of Livers",
      u: "https://optn.transplant.hrsa.gov/media/eavh5bf3/optn_policies.pdf",
    },
    {
      t: "Sharma P et al. Am J Transplant 2008 - MELD Exceptions",
      u: "https://doi.org/10.1111/j.1600-6143.2008.02391.x",
    },
  ],
};
