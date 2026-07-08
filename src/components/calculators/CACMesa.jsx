import { MESA_CAC_REFERENCE } from "../../data/mesaCacReference.js";

const MESA_RACE_OPTIONS = [
  { value: "white", label: "White/Caucasian" },
  { value: "black", label: "Black/African American" },
  { value: "chinese", label: "Chinese American" },
  { value: "hispanic", label: "Hispanic" },
  { value: "non_mesa", label: "Other / not in MESA reference" },
];

const MESA_SEX_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
];

const VESSEL_OPTIONS = [
  { value: "not_reported", label: "Not reported" },
  { value: "0", label: "0 vessels" },
  { value: "1", label: "1 vessel" },
  { value: "2", label: "2 vessels" },
  { value: "3", label: "3 vessels" },
  { value: "4", label: "4 vessels" },
];

function parseOptionalInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return NaN;
  return parsed;
}

function formatScore(score) {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function getAbsoluteCategory(score) {
  if (score === 0) {
    return {
      stage: "Stage 0",
      label: "No calcified coronary plaque",
      range: "0",
      severity: "success",
    };
  }
  if (score < 100) {
    return {
      stage: "Stage 1",
      label: "Mild calcified plaque burden",
      range: "1-99",
      severity: "success",
    };
  }
  if (score < 300) {
    return {
      stage: "Stage 2",
      label: "Moderate calcified plaque burden",
      range: "100-299",
      severity: "warning",
    };
  }
  if (score < 1000) {
    return {
      stage: "Stage 3",
      label: "Severe calcified plaque burden",
      range: "300-999",
      severity: "danger",
    };
  }
  return {
    stage: "Stage 4",
    label: "Extensive/extreme calcified plaque burden",
    range: ">=1000",
    severity: "danger",
  };
}

function getCacDrs(score, vesselCount) {
  const aCategory =
    score === 0 ? "A0" : score < 100 ? "A1" : score < 300 ? "A2" : "A3";

  if (score === 0) return aCategory;
  if (!vesselCount || vesselCount === "not_reported") {
    return `${aCategory} / N not reported`;
  }
  return `${aCategory}/N${vesselCount}`;
}

function getMesaPercentile(record, score) {
  if (score === 0) return 0;
  let percentile = 0;
  for (let i = 0; i < record.t.length; i += 1) {
    if (score >= record.t[i]) percentile = i + 1;
    else break;
  }
  return percentile;
}

function getMesaContext({ age, sex, race, score }) {
  if (age === null || sex === "" || race === "") {
    return {
      available: false,
      reason:
        "Enter age, sex, and a MESA race/ethnicity category for percentile context.",
    };
  }
  if (!Number.isInteger(age)) {
    return {
      available: false,
      reason: "MESA percentile unavailable: age must be a whole number.",
    };
  }
  if (age < 45 || age > 84) {
    return {
      available: false,
      reason: "MESA percentile unavailable: age is outside 45-84 years.",
    };
  }
  if (!["female", "male"].includes(sex)) {
    return {
      available: false,
      reason: "MESA percentile unavailable: sex must be female or male.",
    };
  }
  if (!["white", "black", "chinese", "hispanic"].includes(race)) {
    return {
      available: false,
      reason:
        "MESA percentile unavailable: use only White/Caucasian, Black/African American, Chinese American, or Hispanic categories.",
    };
  }

  const key = `${race}:${sex}:${age}`;
  const record = MESA_CAC_REFERENCE[key];
  if (!record) {
    return {
      available: false,
      reason: "MESA percentile unavailable for this reference combination.",
    };
  }

  return {
    available: true,
    percentile: getMesaPercentile(record, score),
    probabilityNonzero: record.p,
    referenceScores: record.r,
  };
}

function getOrdinal(value) {
  const suffix =
    value % 100 >= 11 && value % 100 <= 13
      ? "th"
      : value % 10 === 1
        ? "st"
        : value % 10 === 2
          ? "nd"
          : value % 10 === 3
            ? "rd"
            : "th";
  return `${value}${suffix}`;
}

function buildReportSnippet({
  score,
  category,
  cacDrs,
  mesa,
  age,
  sex,
  race,
}) {
  const mesaLine = mesa.available
    ? `MESA: ${getOrdinal(mesa.percentile)} percentile for ${race} ${sex}, age ${age}; probability of nonzero CAC ${mesa.probabilityNonzero}%; reference 25/50/75/90 ${mesa.referenceScores.join("/")}.`
    : `MESA: ${mesa.reason}`;

  return [
    `Agatston CAC total: ${formatScore(score)}.`,
    `Absolute category: ${category.stage} (${category.label}; ${category.range}).`,
    `CAC-DRS: ${cacDrs}.`,
    mesaLine,
    "Educational/radiology support only; correlate clinically.",
  ].join(" ");
}

/**
 * CAC/MESA Calculator
 *
 * Total Agatston CAC score interpretation, CAC-DRS A/N output, and MESA
 * percentile context. MESA data are static thresholds generated from the
 * official MESA CAC Score Reference Values calculator, not runtime calls.
 *
 * Primary sources:
 * - Agatston 1990 DOI 10.1016/0735-1097(90)90282-T, PMID 2407762
 * - McClelland 2006 DOI 10.1161/CIRCULATIONAHA.105.580696, PMID 16365194
 * - Hecht 2018 CAC-DRS DOI 10.1016/j.jcct.2018.03.008, PMID 29793848
 * - Maron/Budoff 2024 CAC staging DOI 10.1016/j.jacadv.2024.101287,
 *   PMID 39385944
 */
export const CACMesa = {
  id: "cac-mesa",
  category: "Cardiac Imaging",
  name: "CAC/MESA Calculator",
  desc: "Agatston coronary calcium category, CAC-DRS, and MESA percentile context",
  guidelineVersion: "CAC/MESA percentile + CAC-DRS v1",
  keywords: [
    "CAC",
    "Agatston",
    "coronary calcium",
    "MESA",
    "CAC-DRS",
    "cardiac CT",
  ],
  tags: ["Cardiac", "Radiology"],
  metaDesc:
    "Free CAC/MESA Calculator. Interpret total Agatston coronary calcium score with CAC category, CAC-DRS output, and MESA percentile context.",

  info: {
    text:
      "This calculator interprets a total Agatston coronary artery calcium score already produced by CT software. It does not calculate Agatston score from CT pixels, lesion area, HU bins, scanner protocol, or slice data.\n\n" +
      "Outputs include absolute CAC burden stage, optional CAC-DRS A/N code, and MESA percentile context for age 45-84 using only the MESA-supported race/ethnicity categories.\n\n" +
      "MESA percentile values are shown only within the reference population. Outside those limits, the absolute category and CAC-DRS remain available, but percentile is not extrapolated.",
    link: {
      label: "View MESA CAC Score Reference Values",
      url: "https://mesa-nhlbi.org/researchers/tools/cac-score-reference-values",
    },
  },

  fields: [
    {
      id: "score",
      label: "Total Agatston CAC Score",
      subLabel: "Non-negative score from CT workstation/software",
      type: "number",
    },
    {
      id: "age",
      label: "Age",
      subLabel: "Years; MESA reference range 45-84",
      type: "number",
    },
    {
      id: "sex",
      label: "Sex for MESA Reference",
      type: "select",
      opts: MESA_SEX_OPTIONS,
    },
    {
      id: "race",
      label: "Race/Ethnicity for MESA Reference",
      type: "select",
      opts: MESA_RACE_OPTIONS,
    },
    {
      id: "vessel_count",
      label: "Vessel Count for CAC-DRS",
      subLabel: "Optional number of coronary vessels with CAC",
      type: "select",
      opts: VESSEL_OPTIONS,
    },
  ],

  compute: ({ score, age, sex = "", race = "", vessel_count = "" }) => {
    const parsedScore = Number(score);
    if (score === undefined || score === null || score === "") {
      return { Error: "Enter the total Agatston CAC score." };
    }
    if (!Number.isFinite(parsedScore) || parsedScore < 0) {
      return { Error: "Total Agatston CAC score must be a non-negative number." };
    }

    const parsedAge = parseOptionalInteger(age);
    if (Number.isNaN(parsedAge)) {
      return { Error: "Age must be a whole number when entered." };
    }

    const vesselCount =
      vessel_count === "" ? "not_reported" : String(vessel_count);
    if (
      !["not_reported", "0", "1", "2", "3", "4"].includes(vesselCount)
    ) {
      return { Error: "Vessel count must be not reported or 0-4 vessels." };
    }
    if (parsedScore === 0 && ["1", "2", "3", "4"].includes(vesselCount)) {
      return {
        Error:
          "CAC score 0 is inconsistent with a positive CAC-DRS vessel count.",
      };
    }
    if (parsedScore > 0 && vesselCount === "0") {
      return {
        Error:
          "CAC score greater than 0 is inconsistent with 0 vessels containing CAC.",
      };
    }

    const category = getAbsoluteCategory(parsedScore);
    const cacDrs = getCacDrs(parsedScore, vesselCount);
    const mesa = getMesaContext({
      age: parsedAge,
      sex,
      race,
      score: parsedScore,
    });
    const referenceText = mesa.available
      ? `25th ${mesa.referenceScores[0]}, 50th ${mesa.referenceScores[1]}, 75th ${mesa.referenceScores[2]}, 90th ${mesa.referenceScores[3]}`
      : "Unavailable";

    const result = {
      "Absolute CAC Category": `${category.stage} - ${category.label}`,
      "Agatston Score": formatScore(parsedScore),
      "CAC Score Range": category.range,
      "CAC-DRS": cacDrs,
      "MESA Percentile": mesa.available
        ? `${getOrdinal(mesa.percentile)} percentile`
        : mesa.reason,
      "MESA Probability Nonzero CAC": mesa.available
        ? `${mesa.probabilityNonzero}%`
        : "Unavailable",
      "MESA Reference Scores": referenceText,
      "Clinical Boundary":
        "Educational/radiology support only. This does not diagnose obstructive CAD and does not provide medication or prevention-management recommendations.",
      "Report Snippet": buildReportSnippet({
        score: parsedScore,
        category,
        cacDrs,
        mesa,
        age: parsedAge,
        sex,
        race,
      }),
      _severity: category.severity,
    };

    if (!mesa.available) {
      result["MESA Limitation"] =
        "Do not extrapolate beyond the MESA age 45-84 and supported race/ethnicity reference groups.";
    }

    return result;
  },

  refs: [
    {
      t: "Agatston AS et al. Quantification of coronary artery calcium using ultrafast computed tomography. J Am Coll Cardiol. 1990;15(4):827-832. PMID 2407762.",
      u: "https://doi.org/10.1016/0735-1097(90)90282-T",
    },
    {
      t: "McClelland RL et al. Distribution of coronary artery calcium by race, gender, and age: results from MESA. Circulation. 2006;113(1):30-37. PMID 16365194.",
      u: "https://doi.org/10.1161/CIRCULATIONAHA.105.580696",
    },
    {
      t: "MESA/NHLBI CAC Score Reference Values public calculator.",
      u: "https://mesa-nhlbi.org/researchers/tools/cac-score-reference-values",
    },
    {
      t: "Hecht HS et al. CAC-DRS: Coronary Artery Calcium Data and Reporting System. J Cardiovasc Comput Tomogr. 2018;12(3):185-191. PMID 29793848.",
      u: "https://doi.org/10.1016/j.jcct.2018.03.008",
    },
    {
      t: "Kumar P, Bhatia M. Coronary Artery Calcium Data and Reporting System (CAC-DRS): A Primer. J Cardiovasc Imaging. 2023;31(1):1-17. PMID 36693339.",
      u: "https://doi.org/10.4250/jcvi.2022.0029",
    },
    {
      t: "Grundy SM et al. 2018 AHA/ACC Cholesterol Guideline. Circulation. 2019;139(25):e1082-e1143. PMID 30586774.",
      u: "https://doi.org/10.1161/CIR.0000000000000625",
    },
    {
      t: "Arnett DK et al. 2019 ACC/AHA Primary Prevention Guideline. Circulation. 2019;140(11):e596-e646. PMID 30879355.",
      u: "https://doi.org/10.1161/CIR.0000000000000678",
    },
    {
      t: "Maron DJ, Budoff MJ, Sky J, et al. Coronary Artery Calcium Staging to Guide Preventive Interventions. JACC Adv. 2024;3(11):101287. PMID 39385944.",
      u: "https://doi.org/10.1016/j.jacadv.2024.101287",
    },
  ],
};
