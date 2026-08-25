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
  return String(score);
}

function getAbsoluteCategory(score) {
  if (score === 0) {
    return {
      label: "No calcified coronary plaque",
      range: "0",
      severity: "success",
    };
  }
  if (score < 100) {
    return {
      label: "Mild calcified plaque burden",
      range: "1-99",
      severity: "success",
    };
  }
  if (score < 300) {
    return {
      label: "Moderate calcified plaque burden",
      range: "100-299",
      severity: "warning",
    };
  }
  if (score < 1000) {
    return {
      label: "Severe calcified plaque burden",
      range: "300-999",
      severity: "danger",
    };
  }
  return {
    label: "Extensive calcified plaque burden",
    range: ">=1000",
    severity: "danger",
  };
}

function getCacDrs(score, vesselCount) {
  if (score === 300) {
    return "A category unassigned at exact 300 (primary CAC-DRS table defines A3 as >300)";
  }
  const aCategory =
    score === 0 ? "A0" : score < 100 ? "A1" : score < 300 ? "A2" : "A3";

  if (score === 0) return aCategory;
  if (!vesselCount || vesselCount === "not_reported") {
    return `${aCategory} / N not reported`;
  }
  return `${aCategory}/N${vesselCount}`;
}

function getMesaReferencePosition(referenceScores, score) {
  const labels = ["25th", "50th", "75th", "90th"];
  const exact = referenceScores
    .map((value, index) => ({ value, label: labels[index] }))
    .filter(({ value }) => value === score);
  if (exact.length > 0) {
    const joined = exact.map(({ label }) => label).join("/");
    const tied = exact.length > 1 ? "tied " : "";
    return `At ${tied}${joined} reference score (${score})`;
  }
  if (score < referenceScores[0]) {
    return `Below 25th reference score (${referenceScores[0]})`;
  }
  if (score > referenceScores[3]) {
    return `Above 90th reference score (${referenceScores[3]})`;
  }
  let lowerIndex = 0;
  let upperIndex = 3;
  for (let index = 0; index < referenceScores.length; index += 1) {
    if (referenceScores[index] < score) lowerIndex = index;
    if (referenceScores[index] > score) {
      upperIndex = index;
      break;
    }
  }
  return `Between ${labels[lowerIndex]} (${referenceScores[lowerIndex]}) and ${labels[upperIndex]} (${referenceScores[upperIndex]}) reference scores`;
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
    referencePosition: getMesaReferencePosition(record.r, score),
    probabilityNonzero: record.p,
    referenceScores: record.r,
  };
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
    ? `MESA reference for ${race} ${sex}, age ${age}: ${mesa.referencePosition}; probability of nonzero CAC ${mesa.probabilityNonzero}%; reference 25/50/75/90 ${mesa.referenceScores.join("/")}.`
    : `MESA: ${mesa.reason}`;

  return [
    `Agatston CAC total: ${formatScore(score)}.`,
    `Absolute CAC band: ${category.label} (${category.range}).`,
    `CAC-DRS: ${cacDrs}.`,
    mesaLine,
    "Educational/radiology support only; correlate clinically.",
  ].join(" ");
}

/**
 * CAC/MESA Calculator
 *
 * Total Agatston CAC score interpretation, CAC-DRS A/N output, and MESA
 * reference context. MESA data are reproducible reference landmarks generated
 * from the official MESA CAC Score Reference Values calculator, not runtime calls.
 *
 * Primary sources:
 * - Agatston 1990 DOI 10.1016/0735-1097(90)90282-T, PMID 2407762
 * - McClelland 2006 DOI 10.1161/CIRCULATIONAHA.105.580696, PMID 16365194
 * - Hecht 2018 CAC-DRS DOI 10.1016/j.jcct.2018.03.008, PMID 29793848
 * - Maron 2024 proposed CAC staging DOI 10.1016/j.jacadv.2024.101287, PMID 39385944
 */
export const CACMesa = {
  id: "cac-mesa",
  category: "Cardiac Imaging",
  name: "CAC/MESA Calculator",
  desc: "Agatston coronary calcium band, CAC-DRS, and MESA reference context",
  guidelineVersion: "MESA reference values + CAC-DRS (SCCT 2018)",
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
    "Free CAC/MESA Calculator. Interpret a whole-number Agatston coronary calcium score with CAC-DRS and official MESA reference context.",

  info: {
    text:
      "This calculator interprets a total Agatston coronary artery calcium score already produced by CT software. It does not calculate Agatston score from CT pixels, lesion area, HU bins, scanner protocol, or slice data.\n\n" +
      "Outputs include an absolute CAC burden band from the Maron et al. 2024 proposed staging bands, an optional CAC-DRS A/N code from the original SCCT 2018 CAC-DRS publication, and MESA reference context for age 45-84 using only the MESA-supported race/ethnicity categories. The proposed absolute bands are 0, 1-99, 100-299, 300-999, and >=1000; this tool reports burden labels only and does not reproduce the proposal's treatment recommendations. The primary CAC-DRS table separately defines A2 as 100-299 and A3 as >300, leaving exact 300 unassigned; this tool discloses that boundary instead of inferring a CAC-DRS category.\n\n" +
      "The local MESA output compares the score with the official 25th, 50th, 75th, and 90th reference scores. It does not estimate an exact percentile. The reference cohort comprised participants free of clinical cardiovascular disease and treated diabetes at baseline. A relative reference position does not by itself establish that a patient is at high clinical risk. Outside the MESA limits, the absolute band and CAC-DRS remain available without extrapolation.",
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
    if (
      !Number.isFinite(parsedScore) ||
      parsedScore < 0 ||
      !Number.isInteger(parsedScore)
    ) {
      return {
        Error: "Total Agatston CAC score must be a non-negative whole number.",
      };
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
      "Absolute CAC Band": category.label,
      "Absolute CAC Source": "Maron et al. 2024 proposed staging bands",
      "Agatston Score": formatScore(parsedScore),
      "CAC Score Range": category.range,
      "CAC-DRS": cacDrs,
      "MESA Reference Position": mesa.available
        ? mesa.referencePosition
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

    result["MESA Limitation"] = mesa.available
      ? "The MESA reference cohort comprised participants free of clinical cardiovascular disease and treated diabetes at baseline. Relative reference position does not by itself establish high clinical risk. This local tool compares only the official 25th, 50th, 75th, and 90th reference scores; use the official MESA calculator when an estimated exact percentile is needed."
      : "Do not extrapolate beyond the MESA age 45-84 and supported race/ethnicity reference groups.";

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
      t: "Maron DJ et al. Coronary Artery Calcium Staging to Guide Preventive Interventions: A Proposal and Call to Action. JACC Adv. 2024;3(11):101287. PMID 39385944.",
      u: "https://doi.org/10.1016/j.jacadv.2024.101287",
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
  ],
};
