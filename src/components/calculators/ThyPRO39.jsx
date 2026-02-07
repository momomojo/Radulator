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

// Build fields from subscale definitions
let questionNumber = 0;
const fields = SUBSCALES.flatMap((scale) =>
  scale.items.map((itemLabel, i) => {
    questionNumber++;
    return {
      id: `${scale.prefix}${i + 1}`,
      label: `${questionNumber}. ${itemLabel}`,
      subLabel: scale.name,
      type: "radio",
      opts: LIKERT_OPTS,
    };
  }),
);

// Composite score uses scales 5-11 (Tiredness through Impaired Daily Life) + QoL item
// These are indices 4-10 in SUBSCALES (0-indexed), plus index 12 (Overall QoL)
const COMPOSITE_SCALE_INDICES = [4, 5, 6, 7, 8, 9, 10, 12];

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

Severity classification:
  0-25: Minimal impact
  26-50: Moderate impact
  51-75: Significant impact
  76-100: Severe impact

The ThyPRO-39 is widely used in thyroid research including evaluation of Thyroid Arterial Embolization (TAE) for nodular/multinodular goiter.`,
  },

  fields,

  compute: (v) => {
    // Check if all 39 questions are answered
    const allFieldIds = SUBSCALES.flatMap((scale) =>
      scale.items.map((_, i) => `${scale.prefix}${i + 1}`),
    );

    const unanswered = allFieldIds.filter(
      (id) => v[id] === undefined || v[id] === null || v[id] === "",
    );

    if (unanswered.length > 0) {
      return {
        Error: `Please answer all 39 questions to calculate the ThyPRO-39 score. ${unanswered.length} question(s) remaining.`,
      };
    }

    // Calculate each subscale score
    const subscaleResults = {};
    let compositeSum = 0;
    let compositeItemCount = 0;

    SUBSCALES.forEach((scale, scaleIndex) => {
      const itemIds = scale.items.map((_, i) => `${scale.prefix}${i + 1}`);
      const sum = itemIds.reduce((acc, id) => acc + parseInt(v[id]), 0);
      const maxPossible = scale.items.length * 4;
      const score = (sum / maxPossible) * 100;

      subscaleResults[scale.name] = `${score.toFixed(1)} / 100`;

      // Add to composite if this scale is in the composite set
      if (COMPOSITE_SCALE_INDICES.includes(scaleIndex)) {
        compositeSum += sum;
        compositeItemCount += scale.items.length;
      }
    });

    // Calculate composite score
    const compositeScore = (compositeSum / (compositeItemCount * 4)) * 100;

    // Determine severity
    let severity;
    if (compositeScore <= 25) {
      severity = "Minimal impact";
    } else if (compositeScore <= 50) {
      severity = "Moderate impact";
    } else if (compositeScore <= 75) {
      severity = "Significant impact";
    } else {
      severity = "Severe impact";
    }

    // Build interpretation
    let interpretation;
    if (compositeScore <= 25) {
      interpretation =
        "The thyroid condition has minimal overall impact on quality of life. Individual subscale scores may reveal specific areas of concern worth monitoring.";
    } else if (compositeScore <= 50) {
      interpretation =
        "The thyroid condition has a moderate impact on quality of life. Review individual subscale scores to identify specific domains most affected. Consider targeted interventions.";
    } else if (compositeScore <= 75) {
      interpretation =
        "The thyroid condition has a significant impact on quality of life. Multiple domains are likely affected. Comprehensive treatment evaluation and supportive care recommended.";
    } else {
      interpretation =
        "The thyroid condition has a severe impact on quality of life. Urgent review of treatment plan recommended. Consider multidisciplinary approach including psychological support.";
    }

    return {
      ...subscaleResults,
      "Composite Score": `${compositeScore.toFixed(1)} / 100 (${severity})`,
      "Clinical Interpretation": interpretation,
    };
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
