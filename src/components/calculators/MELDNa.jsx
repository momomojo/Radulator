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
 * MELD 3.0 adolescent path (age at registration 12-17):
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
  const age = parseNumericInput(vals?.ageAtRegistration);
  return isMeld3Selected(vals) && Number.isFinite(age) && age >= 18;
};

const scoreSeverity = (score) =>
  score < 15 ? "success" : score <= 25 ? "warning" : "danger";

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
    return "Low MELD 3.0 range. Higher MELD 3.0 values correspond to higher 90-day waitlist mortality risk in transplant-candidate cohorts; this calculator does not determine listing, exception scores, or allocation decisions.";
  }
  if (score <= 19) {
    return "Intermediate MELD 3.0 range. Higher MELD 3.0 values correspond to higher 90-day waitlist mortality risk in transplant-candidate cohorts; this calculator does not determine listing, exception scores, or allocation decisions.";
  }
  if (score <= 29) {
    return "High MELD 3.0 range. Higher MELD 3.0 values correspond to higher 90-day waitlist mortality risk in transplant-candidate cohorts; this calculator does not determine listing, exception scores, or allocation decisions.";
  }
  return "Very high MELD 3.0 range. Higher MELD 3.0 values correspond to higher 90-day waitlist mortality risk in transplant-candidate cohorts; this calculator does not determine listing, exception scores, or allocation decisions.";
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
      "Creatinine set to 4.0 mg/dL (dialysis ≥2x/week or 24hr CVVHD)",
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

  result._severity = scoreSeverity(meldNa);
  return result;
}

function computeMeld3(inputs) {
  const validation = validateSharedInputs(inputs);
  if (validation.Error) return validation;

  const age = parseNumericInput(inputs.ageAtRegistration);
  if (!Number.isFinite(age)) {
    return { Error: "Please enter age at registration for MELD 3.0." };
  }
  if (age < 12) {
    return {
      Error:
        "MELD 3.0 applies to candidates at least 12 years old; use the pediatric PELD/PELD Cr pathway for younger candidates.",
    };
  }
  if (age > 120) {
    return { Error: "Age at registration must be between 12 and 120 years." };
  }

  const albumin = parseNumericInput(inputs.albumin);
  if (!Number.isFinite(albumin)) {
    return { Error: "Please enter serum albumin for MELD 3.0." };
  }
  if (albumin < 0.5 || albumin > 8.0) {
    return { Error: "Albumin must be between 0.5 and 8.0 g/dL" };
  }

  const isAdolescent = age < 18;
  const sex = inputs.sex;
  if (!isAdolescent && !["male", "female"].includes(sex)) {
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
      "Creatinine set to 3.0 mg/dL for MELD 3.0 (dialysis/CVVHD rule)",
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

  const sexTerm = isAdolescent ? 1.33 : sex === "female" ? 1.33 : 0;
  const raw =
    sexTerm +
    4.56 * Math.log(adjustedBili) +
    0.82 * (137 - adjustedNa) -
    0.24 * (137 - adjustedNa) * Math.log(adjustedBili) +
    9.09 * Math.log(adjustedINR) +
    11.14 * Math.log(adjustedCr) +
    1.85 * (3.5 - adjustedAlbumin) -
    1.83 * (3.5 - adjustedAlbumin) * Math.log(adjustedCr) +
    6;

  const meld3 = clamp(Math.round(raw), 6, 40);

  if (isAdolescent) {
    notes.push(
      "Age 12-17 path used: MELD 3.0 applies +7.33 constant for all sexes",
    );
  } else if (sex === "female") {
    notes.push("Adult female MELD 3.0 sex term applied (+1.33)");
  }

  const result = {
    "MELD 3.0 Score": meld3.toString(),
    "Calculation Path": isAdolescent
      ? "Adolescent age 12-17 at registration"
      : "Adult age ≥18 at registration",
    "Prognosis Context": getMeld3PrognosisContext(meld3),
    "Legacy MELD-Na": "Available in the temporary legacy option.",
    _severity: scoreSeverity(meld3),
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
  guidelineVersion: "MELD 3.0 (OPTN 2023)",
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
    "Free MELD 3.0 Calculator with legacy MELD-Na option. Calculates OPTN liver allocation score for candidates at least 12 years old, with adolescent and adult MELD 3.0 paths.",

  info: {
    text:
      "MELD 3.0 is the current OPTN liver allocation score for candidates at least 12 years old. It updates MELD-Na by adding albumin, adult sex term handling, revised coefficients, interaction terms, sodium bounds, and a lower creatinine cap.\n\n" +
      "Current MELD 3.0 option:\n" +
      "• Age 12-17 at registration: adolescent MELD 3.0 path with +7.33 constant for all sexes\n" +
      "• Age ≥18 at registration: adult MELD 3.0 path with +1.33 adult female term\n" +
      "• Creatinine cap is 3.0 mg/dL; bilirubin/INR lower bound is 1.0; sodium is bounded 125-137; albumin is bounded 1.5-3.5\n\n" +
      "Temporary legacy option:\n" +
      "• MELD-Na (OPTN 2016) remains available for comparison and education while clinical workflows transition.\n\n" +
      "Outputs are educational and do not determine listing, exception scores, organ offers, or treatment decisions.",
    link: {
      label: "View OPTN MELD/PELD policy notice",
      url: "https://www.hrsa.gov/sites/default/files/hrsa/optn/policy-guid-change_impr-liv-alloc-meld-peld-sta-1a-sta-1b_liv.pdf",
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
      id: "ageAtRegistration",
      label: "Age at Registration",
      subLabel: "years (12-120)",
      type: "number",
      showIf: isMeld3Selected,
    },
    {
      id: "sex",
      label: "Sex for Adult MELD 3.0 Calculation",
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
      id: "albumin",
      label: "Serum Albumin",
      subLabel: "g/dL (0.5-8.0)",
      type: "number",
      showIf: isMeld3Selected,
    },
    {
      id: "dialysis",
      label: "Dialysis ≥2 times in past week OR 24hr CVVHD",
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
      t: "OPTN/HRSA Policy Notice - Improving Liver Allocation: MELD, PELD, Status 1A, Status 1B",
      u: "https://www.hrsa.gov/sites/default/files/hrsa/optn/policy-guid-change_impr-liv-alloc-meld-peld-sta-1a-sta-1b_liv.pdf",
    },
    {
      t: "OPTN/HRSA Implementation FAQ - Improving Liver Allocation",
      u: "https://www.hrsa.gov/sites/default/files/hrsa/optn/improving-liver-allocation-general-implementation-faq.pdf",
    },
    {
      t: "Kim WR et al. Gastroenterology 2021 - MELD 3.0",
      u: "https://doi.org/10.1053/j.gastro.2021.08.050",
    },
    {
      t: "Kim WR et al. Gastroenterology 2008 - MELD-Na Development",
      u: "https://doi.org/10.1053/j.gastro.2008.01.029",
    },
    {
      t: "Kamath PS et al. Hepatology 2001 - Original MELD Score",
      u: "https://doi.org/10.1053/jhep.2001.22172",
    },
  ],
};
