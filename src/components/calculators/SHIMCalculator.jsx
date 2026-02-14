/**
 * SHIM Score Calculator
 * Sexual Health Inventory for Men (IIEF-5)
 *
 * Assesses erectile dysfunction using a 5-question validated questionnaire.
 * Score range: 0-25 (standard clinical range: 5-25)
 *
 * References:
 * - Rosen RC, et al. Int J Impot Res. 1999;11(6):319-26. (Original validation)
 * - Cappelleri JC, et al. Int J Impot Res. 2005;17(4):307-15. (IIEF-5 review)
 * - AUA Guideline on Erectile Dysfunction (2018 Amendment)
 * - Rosen RC, et al. Urology. 1997;49(6):822-30. (Original IIEF)
 */

export const SHIMCalculator = {
  id: "shim",
  category: "Urology",
  name: "IIEF-5 (SHIM Score)",
  desc: "Sexual Health Inventory for Men (IIEF-5) - Erectile Dysfunction Assessment",
  guidelineVersion: "IIEF-5 (Rosen 1999)",
  keywords: [
    "erectile dysfunction",
    "ED",
    "IIEF-5",
    "sexual health",
    "impotence",
  ],
  tags: ["Urology", "Sexual Health"],
  metaDesc:
    "Free SHIM/IIEF-5 Score Calculator. Sexual Health Inventory for Men - validated erectile dysfunction screening questionnaire with severity classification.",

  info: {
    text: `The Sexual Health Inventory for Men (SHIM), also known as IIEF-5, is a validated 5-question assessment tool for erectile dysfunction.

Interpretation is based on patient responses over the past 6 months. A score ≤21 suggests some degree of erectile dysfunction.

This tool is widely used in clinical practice and research to assess ED severity and monitor treatment response.`,
  },

  fields: [
    {
      id: "q1",
      label:
        "1. How do you rate your confidence that you could get and keep an erection?",
      type: "radio",
      opts: [
        { value: "1", label: "Very low" },
        { value: "2", label: "Low" },
        { value: "3", label: "Moderate" },
        { value: "4", label: "High" },
        { value: "5", label: "Very high" },
      ],
    },
    {
      id: "q2",
      label:
        "2. When you had erections with sexual stimulation, how often were your erections hard enough for penetration (entering your partner)?",
      type: "radio",
      opts: [
        { value: "0", label: "No sexual activity" },
        { value: "1", label: "Almost never or never" },
        { value: "2", label: "A few times (much less than half the time)" },
        { value: "3", label: "Sometimes (about half the time)" },
        { value: "4", label: "Most times (much more than half the time)" },
        { value: "5", label: "Almost always or always" },
      ],
    },
    {
      id: "q3",
      label:
        "3. During sexual intercourse, how often were you able to maintain your erection after you had penetrated (entered) your partner?",
      type: "radio",
      opts: [
        { value: "0", label: "Did not attempt intercourse" },
        { value: "1", label: "Almost never or never" },
        { value: "2", label: "A few times (much less than half the time)" },
        { value: "3", label: "Sometimes (about half the time)" },
        { value: "4", label: "Most times (much more than half the time)" },
        { value: "5", label: "Almost always or always" },
      ],
    },
    {
      id: "q4",
      label:
        "4. During sexual intercourse, how difficult was it to maintain your erection to completion of intercourse?",
      type: "radio",
      opts: [
        { value: "0", label: "Did not attempt intercourse" },
        { value: "1", label: "Extremely difficult" },
        { value: "2", label: "Very difficult" },
        { value: "3", label: "Difficult" },
        { value: "4", label: "Slightly difficult" },
        { value: "5", label: "Not difficult" },
      ],
    },
    {
      id: "q5",
      label:
        "5. When you attempted sexual intercourse, how often was it satisfactory for you?",
      type: "radio",
      opts: [
        { value: "0", label: "Did not attempt intercourse" },
        { value: "1", label: "Almost never or never" },
        { value: "2", label: "A few times (much less than half the time)" },
        { value: "3", label: "Sometimes (about half the time)" },
        { value: "4", label: "Most times (much more than half the time)" },
        { value: "5", label: "Almost always or always" },
      ],
    },
  ],

  compute: (v) => {
    const { q1, q2, q3, q4, q5 } = v;

    // Validate all questions are answered
    if (!q1 || !q2 || !q3 || !q4 || !q5) {
      return {
        Error: "Please answer all 5 questions to calculate the SHIM score.",
      };
    }

    // Parse values to integers
    const score1 = parseInt(q1);
    const score2 = parseInt(q2);
    const score3 = parseInt(q3);
    const score4 = parseInt(q4);
    const score5 = parseInt(q5);

    // Validate numeric values
    if (
      !Number.isInteger(score1) ||
      score1 < 1 ||
      score1 > 5 ||
      !Number.isInteger(score2) ||
      score2 < 0 ||
      score2 > 5 ||
      !Number.isInteger(score3) ||
      score3 < 0 ||
      score3 > 5 ||
      !Number.isInteger(score4) ||
      score4 < 0 ||
      score4 > 5 ||
      !Number.isInteger(score5) ||
      score5 < 0 ||
      score5 > 5
    ) {
      return {
        Error:
          "Invalid response values detected. Please check your selections.",
      };
    }

    // Calculate total score
    const totalScore = score1 + score2 + score3 + score4 + score5;

    // Determine ED severity classification
    let severity = "";
    let interpretation = "";

    if (totalScore >= 22 && totalScore <= 25) {
      severity = "No ED";
      interpretation =
        "No evidence of erectile dysfunction. Erectile function is normal.";
    } else if (totalScore >= 17 && totalScore <= 21) {
      severity = "Mild ED";
      interpretation =
        "Mild erectile dysfunction. Consider lifestyle modifications and counseling. Medical treatment may be beneficial if desired.";
    } else if (totalScore >= 12 && totalScore <= 16) {
      severity = "Mild-to-Moderate ED";
      interpretation =
        "Mild-to-moderate erectile dysfunction. Medical evaluation and treatment options should be discussed. PDE5 inhibitors are often effective.";
    } else if (totalScore >= 8 && totalScore <= 11) {
      severity = "Moderate ED";
      interpretation =
        "Moderate erectile dysfunction. Medical evaluation recommended. Treatment with PDE5 inhibitors or other therapies should be considered.";
    } else if (totalScore >= 5 && totalScore <= 7) {
      severity = "Severe ED";
      interpretation =
        "Severe erectile dysfunction. Comprehensive medical evaluation recommended to identify underlying causes. Multiple treatment options should be explored.";
    } else if (totalScore >= 0 && totalScore <= 4) {
      // Non-standard range including "0" responses
      severity = "Severe ED";
      interpretation =
        "Severe erectile dysfunction (may include no sexual activity). Comprehensive medical evaluation recommended. Consider cardiovascular and endocrine assessment as clinically indicated.";
    }

    const _severity =
      totalScore >= 22 ? "success" : totalScore >= 12 ? "warning" : "danger";

    return {
      "Total SHIM Score": `${totalScore} / 25`,
      "ED Severity": severity,
      "Clinical Interpretation": interpretation,
      Note: "Assessment based on past 6 months. Score ≤21 indicates some degree of erectile dysfunction.",
      _severity,
    };
  },

  refs: [
    {
      t: "Rosen RC, et al. The International Index of Erectile Function (IIEF): a multidimensional scale for assessment of erectile dysfunction. Urology. 1997;49(6):822-30.",
      u: "https://doi.org/10.1016/s0090-4295(97)00238-0",
    },
    {
      t: "Rosen RC, et al. Development and evaluation of an abridged, 5-item version of the International Index of Erectile Function (IIEF-5) as a diagnostic tool for erectile dysfunction. Int J Impot Res. 1999;11(6):319-26.",
      u: "https://doi.org/10.1038/sj.ijir.3900472",
    },
    {
      t: "Cappelleri JC, et al. Diagnostic evaluation of the erectile function domain of the International Index of Erectile Function. Int J Impot Res. 2005;17(4):307-15.",
      u: "https://doi.org/10.1038/sj.ijir.3901309",
    },
    {
      t: "AUA Guideline: Erectile Dysfunction (2018 Amendment)",
      u: "https://www.auanet.org/guidelines/guidelines/erectile-dysfunction-(ed)-guideline",
    },
  ],
};
