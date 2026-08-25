/**
 * MELD 3.0 / MELD-Na Calculator
 *
 * Current OPTN allocation model:
 * MELD 3.0 adult path (age at registration >=18):
 * 1.33(if female) + 4.56*ln(bilirubin) + 0.82*(137-Na)
 * - 0.24*(137-Na)*ln(bilirubin) + 9.09*ln(INR)
 * + 11.14*ln(creatinine) + 1.85*(3.5-albumin)
 * - 1.83*(3.5-albumin)*ln(creatinine) + 6
 *
 * MELD 3.0 registered-before-18 path (candidate currently at least age 12):
 * same laboratory terms with +7.33 constant for all sexes.
 *
 * Temporary legacy option:
 * MELD-Na (OPTN 2016), preserved for comparison/education.
 */

const MODEL_MELD3 = "meld3";
const MODEL_LEGACY_MELD_NA = "legacy-meld-na";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const isBlank = (value) =>
  value === undefined || value === null || String(value).trim() === "";

const parseNumericInput = (value) => {
  if (isBlank(value)) return NaN;
  return Number.parseFloat(value);
};

const selectedModel = (vals) => vals?.scoringModel || MODEL_MELD3;
const isMeld3Selected = (vals) => selectedModel(vals) === MODEL_MELD3;
const isAdultMeld3Selected = (vals) => {
  const registrationAge = parseNumericInput(vals?.ageAtRegistration);
  return (
    isMeld3Selected(vals) &&
    Number.isFinite(registrationAge) &&
    registrationAge >= 18
  );
};

function validateSharedInputs({ creatinine, bilirubin, inr, sodium }) {
  const cr = parseNumericInput(creatinine);
  const bili = parseNumericInput(bilirubin);
  const inrVal = parseNumericInput(inr);
  const na = parseNumericInput(sodium);

  if (
    !Number.isFinite(cr) ||
    !Number.isFinite(bili) ||
    !Number.isFinite(inrVal) ||
    !Number.isFinite(na)
  ) {
    return {
      Error:
        "Please enter all required values (creatinine, bilirubin, INR, and sodium).",
    };
  }

  if (cr < 0.01 || cr > 40) {
    return { Error: "Creatinine must be between 0.01 and 40 mg/dL" };
  }
  if (bili < 0 || bili > 99) {
    return { Error: "Bilirubin must be between 0 and 99 mg/dL" };
  }
  if (inrVal < 0.5 || inrVal > 99) {
    return { Error: "INR must be between 0.5 and 99" };
  }
  if (na < 100 || na > 200) {
    return { Error: "Sodium must be between 100 and 200 mEq/L" };
  }

  return { cr, bili, inrVal, na };
}

function getLegacyMortalityContext(score) {
  if (score <= 9) {
    return { mortality: "1.9%", riskCategory: "Low risk" };
  }
  if (score <= 19) {
    return { mortality: "6.0%", riskCategory: "Moderate risk" };
  }
  if (score <= 29) {
    return { mortality: "19.6%", riskCategory: "High risk" };
  }
  if (score <= 39) {
    return { mortality: "52.6%", riskCategory: "Very high risk" };
  }
  return { mortality: ">70%", riskCategory: "Critical risk" };
}

function getMeld3PrognosisContext(score) {
  if (score <= 9) {
    return "MELD 3.0 numeric stratum 6-9. These numeric strata mirror bands used in peer-reviewed model evaluation; they are not qualitative risk categories or treatment/allocation recommendations. Higher scores correspond to higher 90-day waitlist mortality risk in transplant-candidate cohorts.";
  }
  if (score <= 19) {
    return "MELD 3.0 numeric stratum 10-19. These numeric strata mirror bands used in peer-reviewed model evaluation; they are not qualitative risk categories or treatment/allocation recommendations. Higher scores correspond to higher 90-day waitlist mortality risk in transplant-candidate cohorts.";
  }
  if (score <= 29) {
    return "MELD 3.0 numeric stratum 20-29. These numeric strata mirror bands used in peer-reviewed model evaluation; they are not qualitative risk categories or treatment/allocation recommendations. Higher scores correspond to higher 90-day waitlist mortality risk in transplant-candidate cohorts.";
  }
  if (score <= 39) {
    return "MELD 3.0 numeric stratum 30-39. These numeric strata mirror bands used in peer-reviewed model evaluation; they are not qualitative risk categories or treatment/allocation recommendations. Higher scores correspond to higher 90-day waitlist mortality risk in transplant-candidate cohorts.";
  }
  return "MELD 3.0 numeric stratum 40. These numeric strata mirror bands used in peer-reviewed model evaluation; they are not qualitative risk categories or treatment/allocation recommendations. This calculator does not determine listing, exception scores, organ offers, or treatment decisions.";
}

function computeLegacyMeldNa(inputs) {
  const validation = validateSharedInputs(inputs);
  if (validation.Error) return validation;

  const { cr, bili, inrVal, na } = validation;
  const notes = [];

  let adjustedCr = cr;
  if (adjustedCr < 1.0) {
    adjustedCr = 1.0;
    notes.push("Creatinine set to lower bound of 1.0 mg/dL");
  }

  if (inputs.dialysis) {
    adjustedCr = 4.0;
    notes.push(
      "Creatinine set to 4.0 mg/dL (dialysis twice, or 24 hours of CVVHD, within a week prior to the serum creatinine test)",
    );
  } else if (adjustedCr > 4.0) {
    adjustedCr = 4.0;
    notes.push("Creatinine capped at 4.0 mg/dL");
  }

  let adjustedBili = bili;
  if (adjustedBili < 1.0) {
    adjustedBili = 1.0;
    notes.push("Bilirubin set to lower bound of 1.0 mg/dL");
  }

  let adjustedINR = inrVal;
  if (adjustedINR < 1.0) {
    adjustedINR = 1.0;
    notes.push("INR set to lower bound of 1.0");
  }

  const meldRaw =
    (0.957 * Math.log(adjustedCr) +
      0.378 * Math.log(adjustedBili) +
      1.12 * Math.log(adjustedINR) +
      0.643) *
    10;

  let meld = Math.round(meldRaw);
  if (meld < 6) {
    meld = 6;
    notes.push("MELD score capped at minimum of 6");
  } else if (meld > 40) {
    meld = 40;
    notes.push("MELD score capped at maximum of 40");
  }

  let meldNa = meld;
  let adjustedNa = na;

  if (meld > 11) {
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

    const naCorrection =
      1.32 * (137 - adjustedNa) - 0.033 * meld * (137 - adjustedNa);
    meldNa = Math.round(meld + naCorrection);
    meldNa = clamp(meldNa, 6, 40);
  } else {
    notes.push(
      "MELD-Na equals MELD (sodium correction only applies when MELD > 11)",
    );
  }

  const { mortality, riskCategory } = getLegacyMortalityContext(meldNa);
  const interpretation =
    `${riskCategory} historical 3-month mortality stratum without transplantation. ` +
    "This legacy MELD-Na result is for comparison and education only; current OPTN allocation uses MELD 3.0. " +
    "It does not determine transplant evaluation, listing, priority, monitoring, or treatment.";

  const result = {
    "MELD Score": meld.toString(),
    "MELD-Na Score": meldNa.toString(),
    "3-Month Mortality": mortality,
    "Risk Category": riskCategory,
    Interpretation: interpretation,
  };

  if (notes.length > 0) {
    result["Clinical Notes"] = notes.join("; ");
  }

  result._severity = "info";
  return result;
}

function computeMeld3(inputs) {
  const validation = validateSharedInputs(inputs);
  if (validation.Error) return validation;

  const currentAge = parseNumericInput(inputs.currentAge);
  if (!Number.isFinite(currentAge)) {
    return { Error: "Please enter current age for MELD 3.0." };
  }
  if (currentAge < 12) {
    return {
      Error:
        "MELD applies only when the candidate is currently at least 12 years old; use PELD/PELD Cr for younger candidates.",
    };
  }
  const registrationAge = parseNumericInput(inputs.ageAtRegistration);
  if (!Number.isFinite(registrationAge)) {
    return { Error: "Please enter age at registration for MELD 3.0." };
  }
  if (registrationAge < 0) {
    return { Error: "Age at registration must be zero or greater." };
  }
  if (registrationAge > currentAge) {
    return { Error: "Age at registration cannot exceed current age." };
  }

  const albumin = parseNumericInput(inputs.albumin);
  if (!Number.isFinite(albumin)) {
    return { Error: "Please enter serum albumin for MELD 3.0." };
  }
  if (albumin < 0.5 || albumin > 9.9) {
    return { Error: "Albumin must be between 0.50 and 9.90 g/dL" };
  }

  const usesRegisteredBefore18Path = registrationAge < 18;
  const sex = inputs.sex;
  if (!usesRegisteredBefore18Path && !["male", "female"].includes(sex)) {
    return {
      Error: "Please select sex for adult MELD 3.0 calculation.",
    };
  }

  const { cr, bili, inrVal, na } = validation;
  const notes = [];

  let adjustedCr = cr;
  if (adjustedCr < 1.0) {
    adjustedCr = 1.0;
    notes.push("Creatinine set to lower bound of 1.0 mg/dL");
  }

  if (inputs.dialysis) {
    adjustedCr = 3.0;
    notes.push(
      "Creatinine set to 3.0 mg/dL for MELD 3.0 (dialysis twice, or 24 hours of CVVHD, within a week prior to the serum creatinine test)",
    );
  } else if (adjustedCr > 3.0) {
    adjustedCr = 3.0;
    notes.push("Creatinine capped at 3.0 mg/dL for MELD 3.0");
  }

  let adjustedBili = bili;
  if (adjustedBili < 1.0) {
    adjustedBili = 1.0;
    notes.push("Bilirubin set to lower bound of 1.0 mg/dL");
  }

  let adjustedINR = inrVal;
  if (adjustedINR < 1.0) {
    adjustedINR = 1.0;
    notes.push("INR set to lower bound of 1.0");
  }

  let adjustedNa = na;
  if (adjustedNa < 125) {
    adjustedNa = 125;
    notes.push(
      "Sodium set to lower bound of 125 mEq/L for MELD 3.0 calculation",
    );
  } else if (adjustedNa > 137) {
    adjustedNa = 137;
    notes.push(
      "Sodium set to upper bound of 137 mEq/L for MELD 3.0 calculation",
    );
  }

  let adjustedAlbumin = albumin;
  if (adjustedAlbumin < 1.5) {
    adjustedAlbumin = 1.5;
    notes.push("Albumin set to lower bound of 1.5 g/dL");
  } else if (adjustedAlbumin > 3.5) {
    adjustedAlbumin = 3.5;
    notes.push("Albumin set to upper bound of 3.5 g/dL");
  }

  const registrationPathAdjustment = usesRegisteredBefore18Path ? 1.33 : 0;
  const adultFemaleAdjustment =
    !usesRegisteredBefore18Path && sex === "female" ? 1.33 : 0;
  const raw =
    registrationPathAdjustment +
    adultFemaleAdjustment +
    4.56 * Math.log(adjustedBili) +
    0.82 * (137 - adjustedNa) -
    0.24 * (137 - adjustedNa) * Math.log(adjustedBili) +
    9.09 * Math.log(adjustedINR) +
    11.14 * Math.log(adjustedCr) +
    1.85 * (3.5 - adjustedAlbumin) -
    1.83 * (3.5 - adjustedAlbumin) * Math.log(adjustedCr) +
    6;

  const meld3 = clamp(Math.round(raw), 6, 40);

  if (usesRegisteredBefore18Path) {
    notes.push(
      "Registered-before-18 path used: MELD 3.0 applies +7.33 constant for all sexes",
    );
  } else if (sex === "female") {
    notes.push("Adult female MELD 3.0 sex term applied (+1.33)");
  }

  const result = {
    "MELD 3.0 Score": meld3.toString(),
    "Calculation Path": usesRegisteredBefore18Path
      ? "Registered before age 18; candidate currently age ≥12"
      : "Registered at age ≥18",
    "Prognosis Context": getMeld3PrognosisContext(meld3),
    "Legacy MELD-Na": "Available in the temporary legacy option.",
    _severity: "info",
  };

  if (notes.length > 0) {
    result["Clinical Notes"] = notes.join("; ");
  }

  return result;
}

export const MELDNa = {
  id: "meld-na",
  category: "Hepatology/Liver",
  name: "MELD-Na Score",
  desc: "MELD 3.0 current OPTN allocation score with a temporary legacy MELD-Na option",
  guidelineVersion: "MELD 3.0 (OPTN Policy 9.1.D)",
  keywords: [
    "MELD 3.0",
    "MELD-Na",
    "liver transplant",
    "cirrhosis",
    "end-stage liver disease",
    "ESLD",
    "transplant priority",
  ],
  tags: ["Hepatology", "Transplant"],
  metaDesc:
    "Free MELD 3.0 Calculator with legacy MELD-Na option. Calculates the OPTN liver allocation score for candidates currently at least 12 years old using the registration-age-appropriate MELD 3.0 path.",

  info: {
    text:
      "MELD 3.0 is the current OPTN liver allocation score for candidates at least 12 years old. It updates MELD-Na by adding albumin, adult sex term handling, revised coefficients, interaction terms, sodium bounds, and a lower creatinine cap.\n\n" +
      "Current MELD 3.0 option:\n" +
      "• Currently age ≥12 and registered before age 18: MELD 3.0 path with +7.33 constant for all sexes\n" +
      "• Registered at age ≥18: adult MELD 3.0 path with +1.33 female term when applicable\n" +
      "• Creatinine cap is 3.0 mg/dL; bilirubin/INR lower bound is 1.0; sodium is bounded 125-137; albumin is bounded 1.5-3.5\n\n" +
      "• Accepted laboratory-entry ranges follow the OPTN calculator: bilirubin 0-99 mg/dL, sodium 100-200 mEq/L, INR 0.5-99, creatinine 0.01-40 mg/dL, and albumin 0.50-9.90 g/dL. The calculation bounds above are then applied.\n\n" +
      "Temporary legacy option:\n" +
      "• MELD-Na (OPTN 2016) remains available for comparison and education while clinical workflows transition.\n\n" +
      "Outputs are educational and do not determine listing, exception scores, organ offers, or treatment decisions.",
    link: {
      label: "View current OPTN Policy 9",
      url: "https://www.hrsa.gov/sites/default/files/hrsa/optn/optn_policies.pdf#page=183",
    },
  },

  fields: [
    {
      id: "scoringModel",
      label: "Scoring model",
      subLabel: "Current MELD 3.0 is used when no option is selected",
      type: "radio",
      opts: [
        {
          value: MODEL_MELD3,
          label: "MELD 3.0 current allocation score",
        },
        {
          value: MODEL_LEGACY_MELD_NA,
          label: "Temporary legacy MELD-Na",
        },
      ],
    },
    {
      id: "currentAge",
      label: "Current Age",
      subLabel: "years (must currently be at least 12 for MELD)",
      type: "number",
      showIf: isMeld3Selected,
    },
    {
      id: "ageAtRegistration",
      label: "Age at Registration",
      subLabel: "years (non-negative; determines MELD 3.0 path)",
      type: "number",
      showIf: isMeld3Selected,
    },
    {
      id: "sex",
      label: "Sex for Adult MELD 3.0 Calculation",
      helpText:
        "Select Male or Female in consultation with the candidate and consistent with current OPTN guidance. Select Female when sex recorded at birth is female or, for example, when sex recorded at birth was male and the candidate is currently taking feminizing gender affirming hormone therapy. Select Male when sex recorded at birth is male or, for example, when sex recorded at birth was female and the candidate is currently taking masculinizing gender affirming hormone therapy.",
      type: "radio",
      opts: [
        { value: "male", label: "Male" },
        { value: "female", label: "Female" },
      ],
      showIf: isAdultMeld3Selected,
    },
    {
      id: "creatinine",
      label: "Creatinine",
      subLabel: "mg/dL (0.01-40)",
      type: "number",
    },
    {
      id: "bilirubin",
      label: "Total Bilirubin",
      subLabel: "mg/dL (0-99)",
      type: "number",
    },
    {
      id: "inr",
      label: "INR",
      subLabel: "0.5-99",
      type: "number",
    },
    {
      id: "sodium",
      label: "Sodium",
      subLabel: "mEq/L (100-200)",
      type: "number",
    },
    {
      id: "albumin",
      label: "Serum Albumin",
      subLabel: "g/dL (0.50-9.90)",
      type: "number",
      showIf: isMeld3Selected,
    },
    {
      id: "dialysis",
      label:
        "Had dialysis twice, or 24 hours of CVVHD, within a week prior to the serum creatinine test?",
      type: "checkbox",
    },
  ],

  compute: (vals) => {
    if (selectedModel(vals) === MODEL_LEGACY_MELD_NA) {
      return computeLegacyMeldNa(vals);
    }
    return computeMeld3(vals);
  },

  refs: [
    {
      t: "OPTN Policy 9.1.D - MELD Score",
      u: "https://www.hrsa.gov/sites/default/files/hrsa/optn/optn_policies.pdf#page=183",
    },
    {
      t: "OPTN/HRSA MELD and PELD Calculators User Guide",
      u: "https://www.hrsa.gov/sites/default/files/hrsa/optn/meld-peld-calculator-user-guide.pdf",
    },
    {
      t: "OPTN/HRSA Policy Notice - Improving Liver Allocation: MELD, PELD, Status 1A, Status 1B",
      u: "https://www.hrsa.gov/sites/default/files/hrsa/optn/policy-guid-change_impr-liv-alloc-meld-peld-sta-1a-sta-1b_liv.pdf",
    },
    {
      t: "Kim WR et al. Gastroenterology 2021 - MELD 3.0",
      u: "https://doi.org/10.1053/j.gastro.2021.08.050",
    },
    {
      t: "Kim WR et al. New England Journal of Medicine 2008 - MELD-Na Development",
      u: "https://doi.org/10.1056/NEJMoa0801209",
    },
    {
      t: "Kamath PS et al. Hepatology 2001 - Original MELD Score",
      u: "https://doi.org/10.1053/jhep.2001.22172",
    },
  ],
};
