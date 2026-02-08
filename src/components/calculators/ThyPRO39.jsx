/**
 * ThyPRO-39 Calculator
 * Thyroid-Related Patient-Reported Outcome - Quality of Life Assessment
 *
 * 39-item validated questionnaire measuring thyroid-specific quality of life
 * across 13 subscales. Used to evaluate QoL impact of thyroid conditions
 * including goiter, and to assess outcomes of interventions such as
 * Thyroid Arterial Embolization (TAE).
 *
 * Scoring: Each item 0-4 (Likert). Subscale scores normalized to 0-100.
 * Higher scores = worse quality of life.
 *
 * References:
 * - Watt T, et al. Thyroid. 2015;25(10):1069-79. (ThyPRO-39 short form)
 * - Singh R, et al. Cardiovasc Intervent Radiol. 2025;48:1021-1029. (TAE QoL)
 * - Watt T, et al. J Clin Endocrinol Metab. 2014;99(7):2325-32. (Responsiveness)
 * - Watt T, et al. Eur J Endocrinol. 2010;162(1):137-51. (Validity/reliability)
 */

const SINGLE_MODE = "single";
const DELTA_MODE = "delta";

// Shared Likert options for all 39 items
const LIKERT_OPTS = [
  { value: "0", label: "Not at all" },
  { value: "1", label: "A little" },
  { value: "2", label: "Some" },
  { value: "3", label: "Quite a bit" },
  { value: "4", label: "Very much" },
];

// Subscale definitions: id prefix, name, item count, item labels
const SUBSCALES = [
  {
    prefix: "gs",
    name: "Goiter Symptoms",
    items: [
      "Pressure or tightness in your throat",
      "A lump or knot feeling in your throat",
      "Visible swelling in the front of your neck",
    ],
  },
  {
    prefix: "hy",
    name: "Hyperthyroid Symptoms",
    items: [
      "Trembling hands",
      "Heart racing or pounding",
      "Feeling warm or sweating more than usual",
      "Increased bowel movements",
    ],
  },
  {
    prefix: "ho",
    name: "Hypothyroid Symptoms",
    items: [
      "Feeling cold more easily than usual",
      "Gaining weight",
      "Dry skin or brittle hair",
      "Feeling sluggish or slowed down",
    ],
  },
  {
    prefix: "ey",
    name: "Eye Symptoms",
    items: [
      "Gritty or sandy feeling in your eyes",
      "Pressure or pain behind your eyes",
      "Sensitivity to light",
    ],
  },
  {
    prefix: "ti",
    name: "Tiredness",
    items: ["Feeling tired", "Lack of energy", "Needing more sleep than usual"],
  },
  {
    prefix: "co",
    name: "Cognitive Problems",
    items: [
      "Difficulty concentrating",
      "Memory problems",
      "Difficulty thinking clearly",
    ],
  },
  {
    prefix: "an",
    name: "Anxiety",
    items: [
      "Feeling nervous or anxious",
      "Feeling worried",
      "Feeling restless or uneasy",
    ],
  },
  {
    prefix: "de",
    name: "Depression",
    items: [
      "Feeling sad or depressed",
      "Loss of interest in daily activities",
      "Feeling that life is not worth living",
    ],
  },
  {
    prefix: "em",
    name: "Emotional Susceptibility",
    items: ["Crying easily", "Being irritable", "Having emotional outbursts"],
  },
  {
    prefix: "sl",
    name: "Impaired Social Life",
    items: [
      "Avoiding social activities",
      "Spending less time with others",
      "Difficulty maintaining relationships",
    ],
  },
  {
    prefix: "dl",
    name: "Impaired Daily Life",
    items: [
      "Difficulty performing work or daily tasks",
      "Doing less than you wanted to",
      "Being limited in your activities",
    ],
  },
  {
    prefix: "cc",
    name: "Cosmetic Complaints",
    items: [
      "Your neck appearance bothering you",
      "Trying to hide your neck",
      "Not liking how your neck looks",
    ],
  },
  {
    prefix: "qol",
    name: "Overall QoL",
    items: [
      "Overall, how much has your thyroid condition affected your quality of life?",
    ],
  },
];

// Composite score uses scales 5-11 (Tiredness through Impaired Daily Life) + QoL item
// These are indices 4-10 in SUBSCALES (0-indexed), plus index 12 (Overall QoL)
const COMPOSITE_SCALE_INDICES = [4, 5, 6, 7, 8, 9, 10, 12];
const KEY_TAE_OUTCOME_SCALES = [
  "Goiter Symptoms",
  "Hyperthyroid Symptoms",
  "Cosmetic Complaints",
  "Overall QoL",
];

const showSingleModeFields = (vals) => vals.assessment_mode !== DELTA_MODE;
const showDeltaModeFields = (vals) => vals.assessment_mode === DELTA_MODE;

function buildQuestionIds(prefix = "") {
  return SUBSCALES.flatMap((scale) =>
    scale.items.map((_, index) => `${prefix}${scale.prefix}${index + 1}`),
  );
}

function buildQuestionFields({
  idPrefix = "",
  labelPrefix = "",
  sectionPrefix = "",
  showIf,
}) {
  let questionNumber = 0;
  return SUBSCALES.flatMap((scale) =>
    scale.items.map((itemLabel, index) => {
      questionNumber += 1;
      return {
        id: `${idPrefix}${scale.prefix}${index + 1}`,
        label: `${labelPrefix}${questionNumber}. ${itemLabel}`,
        subLabel: scale.name,
        type: "radio",
        opts: LIKERT_OPTS,
        showIf,
        section: sectionPrefix
          ? `${sectionPrefix} - ${scale.name}`
          : scale.name,
      };
    }),
  );
}

const SINGLE_QUESTION_IDS = buildQuestionIds();
const BASELINE_QUESTION_IDS = buildQuestionIds("b_");
const FOLLOWUP_QUESTION_IDS = buildQuestionIds("f_");

const fields = [
  {
    id: "assessment_mode",
    label: "Assessment Mode",
    subLabel: "Single assessment or baseline vs follow-up comparison",
    type: "radio",
    opts: [
      { value: SINGLE_MODE, label: "Single assessment" },
      { value: DELTA_MODE, label: "Baseline vs Follow-up (TAE tracking)" },
    ],
    section: "Workflow",
  },
  ...buildQuestionFields({
    idPrefix: "",
    labelPrefix: "",
    sectionPrefix: "",
    showIf: showSingleModeFields,
  }),
  ...buildQuestionFields({
    idPrefix: "b_",
    labelPrefix: "Baseline ",
    sectionPrefix: "Baseline",
    showIf: showDeltaModeFields,
  }),
  ...buildQuestionFields({
    idPrefix: "f_",
    labelPrefix: "Follow-up ",
    sectionPrefix: "Follow-up",
    showIf: showDeltaModeFields,
  }),
];

function isMissing(value) {
  return value === undefined || value === null || value === "";
}

function parseLikert(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 4) {
    return NaN;
  }
  return parsed;
}

function findMissingResponses(values, ids) {
  return ids.filter((id) => isMissing(values[id]));
}

function formatScore(score) {
  return `${score.toFixed(1)} / 100`;
}

function escapeCSV(value) {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateSingleCSV(subscaleScores, compositeScore, severity) {
  const date = new Date().toISOString().split("T")[0];
  const headers = [
    "Date",
    "Mode",
    ...SUBSCALES.map((s) => s.name),
    "Composite Score",
    "Severity",
  ];
  const row = [
    date,
    "Single",
    ...SUBSCALES.map((s) => subscaleScores[s.name].toFixed(1)),
    compositeScore.toFixed(1),
    severity,
  ];
  const csv = [
    headers.map(escapeCSV).join(","),
    row.map(escapeCSV).join(","),
  ].join("\n");
  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}

function generateDeltaCSV(baselineScores, followupScores) {
  const date = new Date().toISOString().split("T")[0];
  const headers = [
    "Date",
    "Scale",
    "Baseline",
    "Follow-up",
    "Delta",
    "Classification",
  ];
  const rows = SUBSCALES.map((s) => {
    const b = baselineScores.subscaleScores[s.name];
    const f = followupScores.subscaleScores[s.name];
    const d = f - b;
    return [
      date,
      s.name,
      b.toFixed(1),
      f.toFixed(1),
      d.toFixed(1),
      classifyDelta(d),
    ];
  });
  const compDelta =
    followupScores.compositeScore - baselineScores.compositeScore;
  rows.push([
    date,
    "Composite",
    baselineScores.compositeScore.toFixed(1),
    followupScores.compositeScore.toFixed(1),
    compDelta.toFixed(1),
    classifyDelta(compDelta),
  ]);
  const csv = [
    headers.map(escapeCSV).join(","),
    ...rows.map((r) => r.map(escapeCSV).join(",")),
  ].join("\n");
  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}

function classifySeverity(score) {
  if (score <= 25) return "Minimal impact";
  if (score <= 50) return "Moderate impact";
  if (score <= 75) return "Significant impact";
  return "Severe impact";
}

function classifyDelta(delta) {
  const absDelta = Math.abs(delta);
  if (absDelta < 6) return "No meaningful change";
  if (delta < 0) return "Improved";
  return "Worsened";
}

function formatDelta(delta) {
  return `${delta.toFixed(1)} points (${classifyDelta(delta)})`;
}

function computeScaleScores(values, idPrefix = "") {
  const subscaleScores = {};
  let compositeSum = 0;
  let compositeItemCount = 0;

  SUBSCALES.forEach((scale, scaleIndex) => {
    const itemIds = scale.items.map(
      (_, index) => `${idPrefix}${scale.prefix}${index + 1}`,
    );
    const numericValues = itemIds.map((id) => parseLikert(values[id]));

    if (numericValues.some((entry) => !Number.isFinite(entry))) {
      throw new Error(`Invalid response value detected in ${scale.name}.`);
    }

    const sum = numericValues.reduce((acc, value) => acc + value, 0);
    const maxPossible = scale.items.length * 4;
    const score = (sum / maxPossible) * 100;
    subscaleScores[scale.name] = score;

    if (COMPOSITE_SCALE_INDICES.includes(scaleIndex)) {
      compositeSum += sum;
      compositeItemCount += scale.items.length;
    }
  });

  return {
    subscaleScores,
    compositeScore: (compositeSum / (compositeItemCount * 4)) * 100,
  };
}

function getSingleTimepointInterpretation(compositeScore) {
  if (compositeScore <= 25) {
    return "The thyroid condition has minimal overall impact on quality of life. Individual subscale scores may reveal specific areas of concern worth monitoring.";
  }

  if (compositeScore <= 50) {
    return "The thyroid condition has a moderate impact on quality of life. Review individual subscale scores to identify specific domains most affected. Consider targeted interventions.";
  }

  if (compositeScore <= 75) {
    return "The thyroid condition has a significant impact on quality of life. Multiple domains are likely affected. Comprehensive treatment evaluation and supportive care recommended.";
  }

  return "The thyroid condition has a severe impact on quality of life. Urgent review of treatment plan recommended. Consider multidisciplinary approach including psychological support.";
}

function getDeltaInterpretation(compositeDelta) {
  const absDelta = Math.abs(compositeDelta);

  if (absDelta < 6) {
    return "Composite change is within a low-change zone. Correlate with symptom trajectory and objective thyroid outcomes.";
  }

  if (compositeDelta < -14) {
    return "Composite score shows marked improvement at follow-up, consistent with meaningful QoL gain.";
  }

  if (compositeDelta < 0) {
    return "Composite score improved at follow-up. The change is likely meaningful in group-level context.";
  }

  if (compositeDelta > 14) {
    return "Composite score worsened substantially at follow-up. Reassess treatment response and consider additional workup.";
  }

  return "Composite score worsened at follow-up. Review domain-level deltas and clinical context.";
}

export const ThyPRO39 = {
  id: "thypro-39",
  category: "Interventional",
  name: "ThyPRO-39",
  desc: "Thyroid-Related Patient-Reported Outcome - Quality of Life Assessment",
  keywords: [
    "thyroid",
    "quality of life",
    "QoL",
    "goiter",
    "ThyPRO",
    "patient-reported outcome",
    "TAE",
    "thyroid embolization",
    "nodular goiter",
  ],
  metaDesc:
    "Free ThyPRO-39 Calculator. Thyroid-specific quality of life assessment with 13 subscales and composite scoring for goiter, thyroid conditions, and TAE outcomes.",

  info: {
    text: `The ThyPRO-39 is a validated 39-item questionnaire measuring thyroid-specific quality of life across 13 subscales.

Patients rate each item based on how much they have been bothered during the past 4 weeks, from "Not at all" (0) to "Very much" (4).

Subscale scores are normalized to 0-100, where higher scores indicate worse quality of life. The composite score is derived from scales 5-11 (Tiredness, Cognitive, Anxiety, Depression, Emotional, Social, Daily Life) plus the Overall QoL item.

Assessment modes:
  - Single assessment: one-time scoring and severity interpretation
  - Baseline vs Follow-up: longitudinal delta tracking for TAE outcome review

Severity classification:
  0-25: Minimal impact
  26-50: Moderate impact
  51-75: Significant impact
  76-100: Severe impact

The ThyPRO-39 is widely used in thyroid research including evaluation of Thyroid Arterial Embolization (TAE) for nodular/multinodular goiter.

Licensing: The ThyPRO-39 is a copyrighted instrument developed by Torquil Watt and colleagues. This implementation uses paraphrased item descriptions for educational and research purposes. For formal clinical trials or commercial use, obtain a license from the ThyPRO developers. See thyPRO.dk for licensing information.`,
  },

  fields,

  compute: (v) => {
    const mode = v.assessment_mode === DELTA_MODE ? DELTA_MODE : SINGLE_MODE;

    if (mode === SINGLE_MODE) {
      const unanswered = findMissingResponses(v, SINGLE_QUESTION_IDS);
      if (unanswered.length > 0) {
        return {
          Error: `Please answer all 39 questions to calculate the ThyPRO-39 score. ${unanswered.length} question(s) remaining.`,
        };
      }

      let singleScores;
      try {
        singleScores = computeScaleScores(v, "");
      } catch (error) {
        return {
          Error:
            error?.message ||
            "Invalid response values detected. Please verify all selected responses.",
        };
      }

      const subscaleResults = {};
      for (const [scaleName, score] of Object.entries(
        singleScores.subscaleScores,
      )) {
        subscaleResults[scaleName] = formatScore(score);
      }

      const severity = classifySeverity(singleScores.compositeScore);
      const csvUri = generateSingleCSV(
        singleScores.subscaleScores,
        singleScores.compositeScore,
        severity,
      );
      return {
        ...subscaleResults,
        "Composite Score": `${formatScore(singleScores.compositeScore)} (${severity})`,
        "Clinical Interpretation": getSingleTimepointInterpretation(
          singleScores.compositeScore,
        ),
        "Download CSV": `<a href="${csvUri}" download="ThyPRO39-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-")}.csv"></a>`,
      };
    }

    const missingBaseline = findMissingResponses(v, BASELINE_QUESTION_IDS);
    const missingFollowup = findMissingResponses(v, FOLLOWUP_QUESTION_IDS);
    const totalMissing = missingBaseline.length + missingFollowup.length;

    if (totalMissing > 0) {
      return {
        Error: `Please answer all baseline and follow-up questions to calculate longitudinal change. ${totalMissing} question(s) remaining.`,
      };
    }

    let baselineScores;
    let followupScores;
    try {
      baselineScores = computeScaleScores(v, "b_");
      followupScores = computeScaleScores(v, "f_");
    } catch (error) {
      return {
        Error:
          error?.message ||
          "Invalid response values detected. Please verify all selected responses.",
      };
    }

    const baselineSeverity = classifySeverity(baselineScores.compositeScore);
    const followupSeverity = classifySeverity(followupScores.compositeScore);
    const compositeDelta =
      followupScores.compositeScore - baselineScores.compositeScore;
    const trajectory = classifyDelta(compositeDelta);

    const out = {
      "Baseline Scores": "",
    };

    for (const scale of SUBSCALES) {
      const baseline = baselineScores.subscaleScores[scale.name];
      out[`${scale.name} (Baseline)`] = formatScore(baseline);
    }
    out["Composite Score (Baseline)"] =
      `${formatScore(baselineScores.compositeScore)} (${baselineSeverity})`;

    out["Follow-up Scores"] = "";
    for (const scale of SUBSCALES) {
      const followup = followupScores.subscaleScores[scale.name];
      out[`${scale.name} (Follow-up)`] = formatScore(followup);
    }
    out["Composite Score (Follow-up)"] =
      `${formatScore(followupScores.compositeScore)} (${followupSeverity})`;

    out["Change Summary (Follow-up - Baseline)"] = "";
    for (const scaleName of KEY_TAE_OUTCOME_SCALES) {
      const delta =
        followupScores.subscaleScores[scaleName] -
        baselineScores.subscaleScores[scaleName];
      out[`${scaleName} Δ`] = formatDelta(delta);
    }
    out["Composite Score Δ"] = formatDelta(compositeDelta);
    out["Overall Trajectory"] =
      trajectory === "No meaningful change" ? "Stable" : trajectory;
    out["MIC Context"] =
      "ThyPRO MIC context: group changes around 6.3-14.3 points may be meaningful; interpret with clinical context.";
    out["Clinical Interpretation"] = getDeltaInterpretation(compositeDelta);

    const csvUri = generateDeltaCSV(baselineScores, followupScores);
    out["Download CSV"] =
      `<a href="${csvUri}" download="ThyPRO39-delta-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-")}.csv"></a>`;

    return out;
  },

  refs: [
    {
      t: "Watt T, et al. The thyroid-related quality of life measure ThyPRO has good responsiveness and ability to detect relevant treatment effects. J Clin Endocrinol Metab. 2014;99(7):2325-32.",
      u: "https://doi.org/10.1210/jc.2014-1322",
    },
    {
      t: "Watt T, et al. Establishing construct validity for the thyroid-specific patient reported outcome measure (ThyPRO): an initial examination. Qual Life Res. 2009;18(4):483-96.",
      u: "https://doi.org/10.1007/s11136-009-9460-8",
    },
    {
      t: "Watt T, et al. Development of a short version of the ThyPRO (ThyPRO-39) and investigation of its properties. Thyroid. 2015;25(10):1069-79.",
      u: "https://doi.org/10.1089/thy.2015.0209",
    },
    {
      t: "Singh R, et al. Thyroid Arterial Embolization for Nodular/Multinodular Goiter and Its Impact on Quality of Life: A Prospective Single-Center Study. Cardiovasc Intervent Radiol. 2025;48:1021-1029.",
      u: "https://doi.org/10.1007/s00270-025-04055-1",
    },
  ],
};
