/**
 * MELD 3.0 Calculator
 * Model for End-Stage Liver Disease 3.0 for candidates at least 12 years old.
 *
 * Formula:
 * MELD 3.0 = 1.33(if female) + 4.56*ln(bilirubin) + 0.82*(137-Na)
 * - 0.24*(137-Na)*ln(bilirubin) + 9.09*ln(INR)
 * + 11.14*ln(creatinine) + 1.85*(3.5-albumin)
 * - 1.83*(3.5-albumin)*ln(creatinine) + 6
 *
 * Candidates registered before age 18 use the adolescent OPTN path: the same
 * terms with a +7.33 constant, equivalent to the +1.33 term for all sexes.
 */

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const parseNumber = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

function mortalityContext(score) {
  if (score <= 9) {
    return {
      band: "MELD 3.0 tier 6-9",
      text:
        "Lowest MELD 3.0 score tier used in the published reclassification analysis. Interpret relative 90-day waitlist risk with the full clinical picture.",
      severity: "success",
    };
  }
  if (score <= 19) {
    return {
      band: "MELD 3.0 tier 10-19",
      text:
        "Lower-intermediate MELD 3.0 score tier. Higher scores correspond to higher relative 90-day waitlist mortality risk.",
      severity: "warning",
    };
  }
  if (score <= 29) {
    return {
      band: "MELD 3.0 tier 20-29",
      text:
        "Intermediate-high MELD 3.0 score tier. Use current OPTN policy, exception status, and transplant-center review before action.",
      severity: "danger",
    };
  }
  if (score <= 39) {
    return {
      band: "MELD 3.0 tier 30-39",
      text:
        "High MELD 3.0 score tier. Use current OPTN policy, exception status, and transplant-center review before action.",
      severity: "danger",
    };
  }
  return {
    band: "MELD 3.0 tier 40",
    text:
      "Maximum MELD 3.0 score tier. Use current OPTN policy, exception status, and transplant-center review before action.",
    severity: "danger",
  };
}

export const MELD30 = {
  id: "meld-3",
  category: "Hepatology/Liver",
  name: "MELD 3.0 Score",
  desc: "MELD 3.0 allocation severity score for candidates age 12 or older using bilirubin, INR, creatinine, sodium, albumin, current age, age at registration, and adult sex term",
  guidelineVersion: "MELD 3.0 (OPTN 2023)",
  keywords: [
    "MELD 3.0",
    "liver transplant",
    "cirrhosis",
    "end-stage liver disease",
    "ESLD",
    "adult transplant allocation",
    "adolescent transplant allocation",
    "waitlist mortality",
  ],
  tags: ["Hepatology", "Transplant"],
  metaDesc:
    "Free MELD 3.0 Calculator. Calculate the OPTN 2023 liver allocation severity score for candidates age 12 or older with albumin, age-at-registration path, adult sex term, and cautious 90-day mortality context.",

  info: {
    text:
      "MELD 3.0 is the current OPTN liver allocation severity score for candidates age 12 or older.\n\n" +
      "Scope:\n" +
      "- Candidates age 18 or older at registration use the adult formula\n" +
      "- Candidates currently at least 12 and registered before age 18 use the adolescent formula (+7.33 constant)\n" +
      "- This calculator does not implement PELD for candidates under age 12\n" +
      "- Uses bilirubin, INR, creatinine, sodium, albumin, current age, age at registration, and adult sex term\n" +
      "- Creatinine is capped at 3.0 mg/dL; dialysis sets creatinine to 3.0 mg/dL\n" +
      "- Sodium is bounded 125-137 mEq/L; albumin is bounded 1.5-3.5 g/dL\n" +
      "- Final score is rounded to the nearest integer and capped 6-40\n\n" +
      "Mortality text is intentionally cautious: MELD 3.0 ranks waitlist risk up to 90 days, but exact prognosis depends on exception points, transplant-center review, and clinical context.",
    link: {
      label: "View MELD 3.0 primary source",
      url: "https://doi.org/10.1053/j.gastro.2021.08.050",
    },
  },

  versionHistory: [
    {
      version: "MELD 3.0",
      shortVersion: "MELD 3.0",
      year: 2023,
      replaces: "MELD-Na",
      status:
        "Current OPTN liver allocation standard for candidates age 12 or older.",
      summary:
        "MELD 3.0 replaced MELD-Na for OPTN liver allocation in 2023 and adds albumin, an age-at-registration path, adult sex term, updated coefficients, and interaction terms.",
      whySuperseded:
        "The newer model improves waitlist risk ranking. MELD-Na remains available temporarily for comparison and documentation.",
      citations: [
        {
          t: "Kim WR et al. Gastroenterology 2021",
          u: "https://doi.org/10.1053/j.gastro.2021.08.050",
        },
        {
          t: "OPTN implementation FAQ",
          u: "https://www.hrsa.gov/sites/default/files/hrsa/optn/improving-liver-allocation-general-implementation-faq.pdf",
        },
      ],
    },
  ],

  fields: [
    {
      id: "currentAge",
      label: "Current Age",
      subLabel: "years (must be at least 12; use PELD if <12)",
      type: "number",
    },
    {
      id: "ageAtRegistration",
      label: "Age at Registration",
      subLabel: "years (selects adult vs registered-before-18 path)",
      type: "number",
    },
    {
      id: "sex",
      label: "Sex for Adult MELD",
      type: "radio",
      opts: [
        { value: "male", label: "Male" },
        { value: "female", label: "Female" },
      ],
      showIf: (vals) => parseNumber(vals.ageAtRegistration) >= 18,
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
      label: "Albumin",
      subLabel: "g/dL (1.0-6.0)",
      type: "number",
    },
    {
      id: "dialysis",
      label: "Dialysis >=2 times in past week OR 24hr CVVHD",
      type: "checkbox",
    },
  ],

  compute: ({
    currentAge,
    ageAtRegistration,
    sex,
    creatinine,
    bilirubin,
    inr,
    sodium,
    albumin,
    dialysis,
  }) => {
    const current = parseNumber(currentAge);
    const age = parseNumber(ageAtRegistration);
    const cr = parseNumber(creatinine);
    const bili = parseNumber(bilirubin);
    const inrVal = parseNumber(inr);
    const na = parseNumber(sodium);
    const alb = parseNumber(albumin);

    if (
      !Number.isFinite(current) ||
      !Number.isFinite(age) ||
      !Number.isFinite(cr) ||
      !Number.isFinite(bili) ||
      !Number.isFinite(inrVal) ||
      !Number.isFinite(na) ||
      !Number.isFinite(alb)
    ) {
      return {
        Error:
          "Please enter current age, age at registration, creatinine, bilirubin, INR, sodium, and albumin.",
      };
    }

    if (current < 12 || current > 120) {
      return {
        Error:
          "Current age must be between 12 and 120 years for MELD 3.0. Use PELD for candidates under 12.",
      };
    }
    if (age < 0 || age > 120) {
      return {
        Error: "Age at registration must be between 0 and 120 years.",
      };
    }
    if (age > current) {
      return { Error: "Age at registration cannot exceed current age." };
    }

    const adultPath = age >= 18;
    if (adultPath && !["male", "female"].includes(sex)) {
      return {
        Error: "Please select male or female sex for the adult formula.",
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
    if (alb < 1.0 || alb > 6.0) {
      return { Error: "Albumin must be between 1.0 and 6.0 g/dL" };
    }

    const notes = [];

    let adjustedCr = Math.max(cr, 1.0);
    if (adjustedCr !== cr) {
      notes.push("Creatinine set to lower bound of 1.0 mg/dL");
    }

    if (dialysis) {
      adjustedCr = 3.0;
      notes.push("Creatinine set to 3.0 mg/dL for MELD 3.0 dialysis rule");
    } else if (adjustedCr > 3.0) {
      adjustedCr = 3.0;
      notes.push("Creatinine capped at 3.0 mg/dL for MELD 3.0");
    }

    let adjustedBili = Math.max(bili, 1.0);
    if (adjustedBili !== bili) {
      notes.push("Bilirubin set to lower bound of 1.0 mg/dL");
    }

    let adjustedINR = Math.max(inrVal, 1.0);
    if (adjustedINR !== inrVal) {
      notes.push("INR set to lower bound of 1.0");
    }

    const adjustedNa = clamp(na, 125.0, 137.0);
    if (adjustedNa !== na) {
      notes.push(
        `Sodium bounded to ${adjustedNa.toFixed(0)} mEq/L for MELD 3.0`,
      );
    }

    const adjustedAlbumin = clamp(alb, 1.5, 3.5);
    if (adjustedAlbumin !== alb) {
      notes.push(
        `Albumin bounded to ${adjustedAlbumin.toFixed(1)} g/dL for MELD 3.0`,
      );
    }

    const sexTerm = adultPath ? (sex === "female" ? 1.33 : 0) : 1.33;
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

    const score = clamp(Math.round(raw), 6, 40);
    const mortality = mortalityContext(score);
    const allocationPath = adultPath
      ? "Adult MELD 3.0 (age >=18 at registration)"
      : "Adolescent MELD 3.0 (currently >=12 and registered before age 18)";
    const adjustedInputs = [
      `current age ${current.toFixed(1)} years`,
      `age at registration ${age.toFixed(1)} years`,
      `Cr ${adjustedCr.toFixed(1)} mg/dL`,
      `bilirubin ${adjustedBili.toFixed(1)} mg/dL`,
      `INR ${adjustedINR.toFixed(1)}`,
      `Na ${adjustedNa.toFixed(0)} mEq/L`,
      `albumin ${adjustedAlbumin.toFixed(1)} g/dL`,
      adultPath
        ? `adult sex term ${sexTerm.toFixed(2)}`
        : "adolescent constant +7.33",
    ].join("; ");

    const result = {
      "MELD 3.0 Score": score.toString(),
      "MELD 3.0 Raw": raw.toFixed(4),
      "Allocation Path": allocationPath,
      "Risk Band": mortality.band,
      "90-Day Mortality Context": mortality.text,
      "Adjusted Inputs": adjustedInputs,
      "Version Note":
        "MELD 3.0 is the current OPTN allocation standard for candidates age 12 or older; MELD-Na is retained here only as a temporary legacy comparison calculator.",
    };

    if (notes.length) {
      result["Calculation Notes"] = notes.join("; ");
    }

    result._severity = mortality.severity;
    return result;
  },

  refs: [
    {
      t: "Kim WR et al. Gastroenterology 2021 - MELD 3.0 primary model",
      u: "https://doi.org/10.1053/j.gastro.2021.08.050",
    },
    {
      t: "OPTN policy notice - MELD 3.0 and PELD creatinine implementation",
      u: "https://www.hrsa.gov/sites/default/files/hrsa/optn/policy-guid-change_impr-liv-alloc-meld-peld-sta-1a-sta-1b_liv.pdf",
    },
    {
      t: "OPTN implementation FAQ - MELD 3.0 go-live July 13, 2023",
      u: "https://www.hrsa.gov/sites/default/files/hrsa/optn/improving-liver-allocation-general-implementation-faq.pdf",
    },
  ],
};
