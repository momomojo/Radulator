/**
 * IPSS Calculator - International Prostate Symptom Score
 *
 * Scoring System:
 * - Questions 1-7: 0-5 points each (0 = not at all, 5 = almost always/≥5 times)
 * - Total IPSS Score: 0-35 (sum of Q1-Q7)
 * - Question 8 (QoL): 0-6 points, scored separately
 *
 * Severity Classification:
 * - Mild: 0-7 (watchful waiting)
 * - Moderate: 8-19 (medical therapy)
 * - Severe: 20-35 (medical/surgical therapy)
 *
 * References:
 * - Barry MJ et al. J Urol. 1992;148(5):1549-57. DOI: 10.1016/s0022-5347(17)36966-5
 * - Cockett ATK et al. Proceedings of the WHO consultation on BPH, Paris. 1991.
 * - AUA Practice Guidelines Committee. AUA guideline on BPH. J Urol. 2003;170(2 Pt 1):530-47.
 * - Chapple CR et al. Eur Urol. 2013;64(1):118-40. DOI: 10.1016/j.eururo.2013.03.004
 * - Nickel JC. CMAJ. 2005;173(1):34-5. DOI: 10.1503/cmaj.045457
 */

export const IPSS = {
  id: "ipss",
  name: "IPSS (Prostate Symptoms)",
  desc: "International Prostate Symptom Score for assessing lower urinary tract symptoms",

  info: {
    text: "The IPSS is a validated 7-item questionnaire used to assess the severity of lower urinary tract symptoms (LUTS) in men. Questions cover voiding symptoms (incomplete emptying, frequency, intermittency, urgency, weak stream, straining) and nocturia.\n\nAn additional quality of life question (Question 8) is scored separately to assess the patient's perception of their urinary symptoms.\n\nScoring guides treatment decisions: mild symptoms (0-7) warrant watchful waiting, moderate (8-19) suggest medical therapy, and severe (20-35) may require medical or surgical intervention.",
  },

  fields: [
    {
      id: "q1",
      label: "1. Incomplete Emptying: Over the past month, how often have you had a sensation of not emptying your bladder completely after you finished urinating?",
      type: "radio",
      opts: [
        { value: "0", label: "Not at all" },
        { value: "1", label: "Less than 1 in 5 times" },
        { value: "2", label: "Less than half the time" },
        { value: "3", label: "About half the time" },
        { value: "4", label: "More than half the time" },
        { value: "5", label: "Almost always" },
      ],
    },
    {
      id: "q2",
      label: "2. Frequency: Over the past month, how often have you had to urinate again less than two hours after you finished urinating?",
      type: "radio",
      opts: [
        { value: "0", label: "Not at all" },
        { value: "1", label: "Less than 1 in 5 times" },
        { value: "2", label: "Less than half the time" },
        { value: "3", label: "About half the time" },
        { value: "4", label: "More than half the time" },
        { value: "5", label: "Almost always" },
      ],
    },
    {
      id: "q3",
      label: "3. Intermittency: Over the past month, how often have you found you stopped and started again several times when you urinated?",
      type: "radio",
      opts: [
        { value: "0", label: "Not at all" },
        { value: "1", label: "Less than 1 in 5 times" },
        { value: "2", label: "Less than half the time" },
        { value: "3", label: "About half the time" },
        { value: "4", label: "More than half the time" },
        { value: "5", label: "Almost always" },
      ],
    },
    {
      id: "q4",
      label: "4. Urgency: Over the past month, how often have you found it difficult to postpone urination?",
      type: "radio",
      opts: [
        { value: "0", label: "Not at all" },
        { value: "1", label: "Less than 1 in 5 times" },
        { value: "2", label: "Less than half the time" },
        { value: "3", label: "About half the time" },
        { value: "4", label: "More than half the time" },
        { value: "5", label: "Almost always" },
      ],
    },
    {
      id: "q5",
      label: "5. Weak Stream: Over the past month, how often have you had a weak urinary stream?",
      type: "radio",
      opts: [
        { value: "0", label: "Not at all" },
        { value: "1", label: "Less than 1 in 5 times" },
        { value: "2", label: "Less than half the time" },
        { value: "3", label: "About half the time" },
        { value: "4", label: "More than half the time" },
        { value: "5", label: "Almost always" },
      ],
    },
    {
      id: "q6",
      label: "6. Straining: Over the past month, how often have you had to push or strain to begin urination?",
      type: "radio",
      opts: [
        { value: "0", label: "Not at all" },
        { value: "1", label: "Less than 1 in 5 times" },
        { value: "2", label: "Less than half the time" },
        { value: "3", label: "About half the time" },
        { value: "4", label: "More than half the time" },
        { value: "5", label: "Almost always" },
      ],
    },
    {
      id: "q7",
      label: "7. Nocturia: Over the past month, how many times did you most typically get up to urinate from the time you went to bed until the time you got up in the morning?",
      type: "radio",
      opts: [
        { value: "0", label: "None" },
        { value: "1", label: "1 time" },
        { value: "2", label: "2 times" },
        { value: "3", label: "3 times" },
        { value: "4", label: "4 times" },
        { value: "5", label: "5 or more times" },
      ],
    },
    {
      id: "q8",
      label: "8. Quality of Life: If you were to spend the rest of your life with your urinary condition the way it is now, how would you feel about that?",
      type: "radio",
      opts: [
        { value: "0", label: "Delighted" },
        { value: "1", label: "Pleased" },
        { value: "2", label: "Mostly satisfied" },
        { value: "3", label: "Mixed — about equally satisfied and dissatisfied" },
        { value: "4", label: "Mostly dissatisfied" },
        { value: "5", label: "Unhappy" },
        { value: "6", label: "Terrible" },
      ],
    },
  ],

  compute: (v) => {
    const { q1, q2, q3, q4, q5, q6, q7, q8 } = v;

    // Validate that at least Q1-Q7 are answered
    const requiredQuestions = [q1, q2, q3, q4, q5, q6, q7];
    const hasAllRequired = requiredQuestions.every(q => q !== undefined && q !== "");

    if (!hasAllRequired) {
      return {
        Error: "Please answer all symptom questions (1-7) to calculate IPSS score.",
      };
    }

    // Calculate total IPSS score (Q1-Q7)
    const total =
      parseInt(q1) +
      parseInt(q2) +
      parseInt(q3) +
      parseInt(q4) +
      parseInt(q5) +
      parseInt(q6) +
      parseInt(q7);

    // Determine severity classification
    let severity = "";
    let recommendation = "";

    if (total <= 7) {
      severity = "Mild";
      recommendation = "Watchful waiting is appropriate. No immediate treatment needed unless symptoms are bothersome.";
    } else if (total <= 19) {
      severity = "Moderate";
      recommendation = "Medical therapy recommended. Consider alpha-blockers or 5-alpha reductase inhibitors.";
    } else {
      severity = "Severe";
      recommendation = "Medical and/or surgical therapy recommended. Consider referral to urology.";
    }

    const result = {
      "Total IPSS Score": `${total}/35`,
      "Symptom Severity": severity,
      "Management Recommendation": recommendation,
    };

    // Add QoL score if answered
    if (q8 !== undefined && q8 !== "") {
      const qolScore = parseInt(q8);
      let qolAssessment = "";

      if (qolScore === 0) {
        qolAssessment = "Delighted - Excellent quality of life";
      } else if (qolScore === 1) {
        qolAssessment = "Pleased - Very good quality of life";
      } else if (qolScore === 2) {
        qolAssessment = "Mostly satisfied - Good quality of life";
      } else if (qolScore === 3) {
        qolAssessment = "Mixed - Fair quality of life";
      } else if (qolScore === 4) {
        qolAssessment = "Mostly dissatisfied - Poor quality of life";
      } else if (qolScore === 5) {
        qolAssessment = "Unhappy - Very poor quality of life";
      } else if (qolScore === 6) {
        qolAssessment = "Terrible - Extremely poor quality of life";
      }

      result["Quality of Life Score"] = `${qolScore}/6`;
      result["QoL Assessment"] = qolAssessment;
    }

    return result;
  },

  refs: [
    {
      t: "Barry MJ et al. The American Urological Association symptom index for benign prostatic hyperplasia. J Urol. 1992;148(5):1549-57.",
      u: "https://doi.org/10.1016/s0022-5347(17)36966-5",
    },
    {
      t: "Cockett ATK et al. Proceedings of the International Consultation on Benign Prostatic Hyperplasia (BPH), Paris, France. WHO. 1991.",
      u: "https://www.who.int/",
    },
    {
      t: "AUA Practice Guidelines Committee. AUA guideline on management of benign prostatic hyperplasia. J Urol. 2003;170(2 Pt 1):530-47.",
      u: "https://www.auanet.org/",
    },
    {
      t: "Chapple CR et al. The effects of dutasteride, tamsulosin and combination therapy on lower urinary tract symptoms in men with benign prostatic hyperplasia. Eur Urol. 2013;64(1):118-40.",
      u: "https://doi.org/10.1016/j.eururo.2013.03.004",
    },
    {
      t: "Nickel JC. The overlapping lower urinary tract symptoms of benign prostatic hyperplasia and prostatitis. CMAJ. 2005;173(1):34-5.",
      u: "https://doi.org/10.1503/cmaj.045457",
    },
  ],
};
