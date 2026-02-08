/**
 * IPSS Calculator - Inferior Petrosal Sinus Sampling
 *
 * Diagnostic procedure for differentiating Cushing's disease (pituitary ACTH adenoma)
 * from ectopic ACTH syndrome through bilateral catheterization of inferior petrosal sinuses.
 *
 * Clinical Indication:
 * - ACTH-dependent Cushing's syndrome with negative/equivocal pituitary MRI
 * - Need to distinguish pituitary vs ectopic ACTH source
 * - Guide surgical approach for transsphenoidal surgery
 *
 * Sampling Protocol:
 * - Bilateral catheterization of inferior petrosal sinuses (IPS)
 * - Simultaneous sampling from left IPS, right IPS, and peripheral vein
 * - CRH stimulation at time 0
 * - Multiple time points: Basal (-10, -3, 0 min) and Post-CRH (+3, +6, +9, +15 min)
 *
 * Key Calculations:
 * 1. Catheterization Success: PRL IPS/Periphery ratio >1.8 (basal)
 * 2. Diagnosis:
 *    - Basal ACTH IPS/Periphery >2 → Cushing's disease
 *    - Peak ACTH IPS/Periphery >3 (post-CRH) → Cushing's disease
 *    - Both ≤ threshold → Ectopic ACTH syndrome
 * 3. Lateralization: ACTH ratio (higher/lower) ≥1.4
 * 4. Normalized ACTH/PRL ratios for enhanced lateralization
 *
 * References:
 * - Oldfield EH et al. N Engl J Med. 1991;325(13):897-905. DOI: 10.1056/NEJM199109263251301
 * - Lefournier V et al. J Clin Endocrinol Metab. 2003;88(1):196-203. DOI: 10.1210/jc.2002-020374
 * - Colao A et al. Eur J Endocrinol. 2001;144(5):499-507. DOI: 10.1530/eje.0.1440499
 * - Nieman LK et al. J Clin Endocrinol Metab. 2008;93(5):1526-1540. DOI: 10.1210/jc.2008-0125
 * - Wind JJ et al. J Clin Endocrinol Metab. 2013;98(6):2285-2293. DOI: 10.1210/jc.2013-1159
 * - Machado MC et al. Eur J Endocrinol. 2007;157(1):29-39. DOI: 10.1530/EJE-07-0100
 */

export const IPSS = {
  id: "ipss",
  category: "Interventional",
  name: "Inferior Petrosal Sinus Sampling (IPSS)",
  desc: "Inferior Petrosal Sinus Sampling for Cushing's disease diagnosis and lateralization",
  keywords: [
    "pituitary",
    "Cushing",
    "ACTH",
    "petrosal sinus",
    "lateralization",
  ],
  tags: ["Interventional", "Endocrinology", "Neuroradiology"],
  metaDesc:
    "Free IPSS Calculator for Cushing's disease. Inferior Petrosal Sinus Sampling with CRH stimulation, ACTH/prolactin ratios, and lateralization for pituitary vs ectopic ACTH.",

  info: {
    text: "Inferior Petrosal Sinus Sampling (IPSS) is an invasive diagnostic procedure used to differentiate Cushing's disease (pituitary ACTH adenoma) from ectopic ACTH syndrome.\\n\\nThe procedure involves bilateral catheterization of the inferior petrosal sinuses with simultaneous sampling from both sides and a peripheral vein. Samples are collected before and after CRH (corticotropin-releasing hormone) stimulation.\\n\\nKey diagnostic criteria:\\n• Basal ACTH IPS/Periphery ratio >2 indicates Cushing's disease\\n• Peak ACTH IPS/Periphery ratio >3 (post-CRH) indicates Cushing's disease (gold standard, 95-97% sensitivity/specificity)\\n• Both ratios below threshold suggest ectopic ACTH syndrome\\n\\nLateralization (when Cushing's disease confirmed):\\n• ACTH ratio ≥1.4 between sides suggests adenoma lateralization\\n• Helps guide surgical approach for transsphenoidal surgery\\n\\nProlactin measurements verify catheter position (IPS/Periphery ratio >1.8).",
  },

  // Dynamic rows pattern similar to MRElastography
  useDynamicRows: true,

  fields: [
    {
      id: "basalTime",
      label: "Basal Sample Time (minutes before CRH)",
      subLabel: "Typically -3 or -10 minutes. Most important baseline sample.",
      type: "number",
    },
    {
      id: "basalLeftACTH",
      label: "Basal Left IPS ACTH",
      subLabel: "pg/mL",
      type: "number",
    },
    {
      id: "basalRightACTH",
      label: "Basal Right IPS ACTH",
      subLabel: "pg/mL",
      type: "number",
    },
    {
      id: "basalPeriphACTH",
      label: "Basal Peripheral ACTH",
      subLabel: "pg/mL",
      type: "number",
    },
    {
      id: "basalLeftPRL",
      label: "Basal Left IPS Prolactin",
      subLabel: "ng/mL",
      type: "number",
    },
    {
      id: "basalRightPRL",
      label: "Basal Right IPS Prolactin",
      subLabel: "ng/mL",
      type: "number",
    },
    {
      id: "basalPeriphPRL",
      label: "Basal Peripheral Prolactin",
      subLabel: "ng/mL",
      type: "number",
    },
  ],

  // Post-CRH samples will be handled via dynamic rows in App.jsx
  dynamicRowLabel: "Post-CRH Sample",
  dynamicRowFields: [
    {
      id: "time",
      label: "Time (min post-CRH)",
      type: "number",
      subLabel: "e.g., 3, 6, 9, 15",
    },
    {
      id: "leftACTH",
      label: "Left IPS ACTH",
      type: "number",
      subLabel: "pg/mL",
    },
    {
      id: "rightACTH",
      label: "Right IPS ACTH",
      type: "number",
      subLabel: "pg/mL",
    },
    {
      id: "periphACTH",
      label: "Peripheral ACTH",
      type: "number",
      subLabel: "pg/mL",
    },
    { id: "leftPRL", label: "Left IPS PRL", type: "number", subLabel: "ng/mL" },
    {
      id: "rightPRL",
      label: "Right IPS PRL",
      type: "number",
      subLabel: "ng/mL",
    },
    {
      id: "periphPRL",
      label: "Peripheral PRL",
      type: "number",
      subLabel: "ng/mL",
    },
  ],

  compute: (v) => {
    // Extract basal values
    const {
      basalLeftACTH,
      basalRightACTH,
      basalPeriphACTH,
      basalLeftPRL,
      basalRightPRL,
      basalPeriphPRL,
      ipssRows, // Dynamic rows from App.jsx state
    } = v;

    // Validate basal inputs
    if (
      !basalLeftACTH ||
      !basalRightACTH ||
      !basalPeriphACTH ||
      !basalLeftPRL ||
      !basalRightPRL ||
      !basalPeriphPRL
    ) {
      return {
        Error:
          "Please enter all basal sample values (ACTH and Prolactin for both IPS sites and peripheral).",
      };
    }

    // Parse values
    const bLA = parseFloat(basalLeftACTH);
    const bRA = parseFloat(basalRightACTH);
    const bPA = parseFloat(basalPeriphACTH);
    const bLP = parseFloat(basalLeftPRL);
    const bRP = parseFloat(basalRightPRL);
    const bPP = parseFloat(basalPeriphPRL);

    // STEP 1: Assess Catheterization Success (using basal PRL ratios)
    const leftPRLRatio = bLP / bPP;
    const rightPRLRatio = bRP / bPP;

    const leftCathSuccess = leftPRLRatio > 1.8;
    const rightCathSuccess = rightPRLRatio > 1.8;
    const leftCathStatus =
      leftPRLRatio > 1.8
        ? "✓ Successful"
        : leftPRLRatio > 1.5
          ? "⚠ Borderline"
          : "✗ Failed";
    const rightCathStatus =
      rightPRLRatio > 1.8
        ? "✓ Successful"
        : rightPRLRatio > 1.5
          ? "⚠ Borderline"
          : "✗ Failed";

    const result = {
      "═══ CATHETERIZATION SUCCESS ═══": "",
      "Left IPS PRL Ratio": `${leftPRLRatio.toFixed(2)} — ${leftCathStatus}`,
      "Right IPS PRL Ratio": `${rightPRLRatio.toFixed(2)} — ${rightCathStatus}`,
      "Catheterization Note":
        leftCathSuccess && rightCathSuccess
          ? "Both sides successfully catheterized (PRL ratios >1.8)"
          : !leftCathSuccess && !rightCathSuccess
            ? "❌ BOTH SIDES FAILED - Results unreliable"
            : "One side failed - Diagnosis possible but lateralization limited",
    };

    // If both sides failed, stop here
    if (!leftCathSuccess && !rightCathSuccess) {
      result["═══ DIAGNOSTIC INTERPRETATION ═══"] = "";
      result["Final Interpretation"] =
        "❌ INADEQUATE STUDY - Both catheterizations failed (PRL ratios <1.8). Repeat procedure recommended.";
      return result;
    }

    // STEP 2: Calculate Basal ACTH Ratios
    const leftBasalACTHRatio = bLA / bPA;
    const rightBasalACTHRatio = bRA / bPA;
    const maxBasalACTHRatio = Math.max(leftBasalACTHRatio, rightBasalACTHRatio);

    result["═══ BASAL ACTH RATIOS ═══"] = "";
    result["Left IPS/Peripheral (Basal)"] = leftBasalACTHRatio.toFixed(2);
    result["Right IPS/Peripheral (Basal)"] = rightBasalACTHRatio.toFixed(2);
    result["Maximum Basal Ratio"] =
      `${maxBasalACTHRatio.toFixed(2)} ${maxBasalACTHRatio > 2 ? "(>2 ✓ Positive for Cushing's)" : "(≤2)"}`;

    // STEP 3: Process Post-CRH Samples (if available)
    let maxPeakACTHRatio = 0;
    let peakTimePoint = null;
    let peakLeftACTH = 0;
    let peakRightACTH = 0;
    let peakLeftPRL = 0;
    let peakRightPRL = 0;
    let peakPeriphACTH = 0;
    let peakPeriphPRL = 0;

    if (ipssRows && ipssRows.length > 0) {
      // Find peak post-CRH ratio
      ipssRows.forEach((row) => {
        const {
          time,
          leftACTH,
          rightACTH,
          periphACTH,
          leftPRL,
          rightPRL,
          periphPRL,
        } = row;

        // Skip incomplete rows
        if (!leftACTH || !rightACTH || !periphACTH) return;

        const pLA = parseFloat(leftACTH);
        const pRA = parseFloat(rightACTH);
        const pPA = parseFloat(periphACTH);
        const pLP = parseFloat(leftPRL || bLP); // Fallback to basal if missing
        const pRP = parseFloat(rightPRL || bRP);
        const pPP = parseFloat(periphPRL || bPP);

        const leftRatio = pLA / pPA;
        const rightRatio = pRA / pPA;
        const maxRatio = Math.max(leftRatio, rightRatio);

        if (maxRatio > maxPeakACTHRatio) {
          maxPeakACTHRatio = maxRatio;
          peakTimePoint = parseFloat(time);
          peakLeftACTH = pLA;
          peakRightACTH = pRA;
          peakPeriphACTH = pPA;
          peakLeftPRL = pLP;
          peakRightPRL = pRP;
          peakPeriphPRL = pPP;
        }
      });

      result["═══ POST-CRH ACTH RATIOS ═══"] = "";
      result["Peak Time Point"] = `+${peakTimePoint} minutes`;
      result["Peak IPS/Peripheral Ratio"] =
        `${maxPeakACTHRatio.toFixed(2)} ${maxPeakACTHRatio > 3 ? "(>3 ✓ Positive for Cushing's)" : "(≤3)"}`;
    }

    // STEP 4: Diagnostic Interpretation
    result["═══ DIAGNOSTIC INTERPRETATION ═══"] = "";

    const isCushings = maxBasalACTHRatio > 2 || maxPeakACTHRatio > 3;

    if (isCushings) {
      result["Diagnosis"] = "🔵 CUSHING'S DISEASE (Pituitary ACTH Adenoma)";
      result["Confidence"] = "HIGH (95-97% specificity with CRH stimulation)";

      if (maxBasalACTHRatio > 2 && maxPeakACTHRatio > 3) {
        result["Criteria Met"] =
          "Both basal (>2) AND peak (>3) criteria positive";
      } else if (maxBasalACTHRatio > 2) {
        result["Criteria Met"] = "Basal ratio >2";
      } else {
        result["Criteria Met"] = "Peak post-CRH ratio >3 (Gold standard)";
      }

      result["Recommendation"] =
        "Transsphenoidal surgery indicated. Proceed to lateralization assessment.";
    } else {
      result["Diagnosis"] = "🔴 ECTOPIC ACTH SYNDROME";
      result["Confidence"] =
        ipssRows && ipssRows.length > 0
          ? "HIGH (Both basal and peak ratios below threshold)"
          : "MODERATE (No post-CRH samples - basal only)";
      result["Criteria"] =
        `Basal ratio ≤2 (${maxBasalACTHRatio.toFixed(2)})${ipssRows && ipssRows.length > 0 ? ` AND peak ratio ≤3 (${maxPeakACTHRatio.toFixed(2)})` : ""}`;
      result["Recommendation"] =
        "Search for ectopic ACTH source: Chest/abdominal CT, octreotide scan. Medical management of hypercortisolism. Consider bilateral adrenalectomy if source not found.";
    }

    // STEP 5: Lateralization (only if Cushing's disease and both sides successful)
    if (
      isCushings &&
      leftCathSuccess &&
      rightCathSuccess &&
      peakTimePoint !== null
    ) {
      result["═══ LATERALIZATION ASSESSMENT ═══"] = "";

      // Simple ACTH lateralization (using peak time point)
      const higher = Math.max(peakLeftACTH, peakRightACTH);
      const lower = Math.min(peakLeftACTH, peakRightACTH);
      const lateralizationRatio = higher / lower;
      const lateralizedSide = peakLeftACTH > peakRightACTH ? "LEFT" : "RIGHT";

      const isLateralized = lateralizationRatio >= 1.4;

      result["Simple ACTH Method"] = "";
      result["  Left IPS ACTH (peak)"] = `${peakLeftACTH.toFixed(1)} pg/mL`;
      result["  Right IPS ACTH (peak)"] = `${peakRightACTH.toFixed(1)} pg/mL`;
      result["  Lateralization Ratio"] =
        `${lateralizationRatio.toFixed(2)} ${isLateralized ? "(≥1.4 ✓)" : "(<1.4)"}`;
      result["  Simple Method Result"] = isLateralized
        ? `🟢 Lateralizes to ${lateralizedSide} side`
        : `⚪ Non-lateralizing (ratio <1.4)`;

      // Normalized ACTH/PRL method
      const leftNormalized =
        peakLeftACTH / peakLeftPRL / (peakPeriphACTH / peakPeriphPRL);
      const rightNormalized =
        peakRightACTH / peakRightPRL / (peakPeriphACTH / peakPeriphPRL);
      const normalizedRatio =
        Math.max(leftNormalized, rightNormalized) /
        Math.min(leftNormalized, rightNormalized);
      const normalizedSide =
        leftNormalized > rightNormalized ? "LEFT" : "RIGHT";
      const normalizedLateralized = normalizedRatio >= 1.4;

      result["Normalized ACTH/PRL Method"] = "";
      result["  Left Normalized Ratio"] = leftNormalized.toFixed(2);
      result["  Right Normalized Ratio"] = rightNormalized.toFixed(2);
      result["  Normalized Lat. Ratio"] =
        `${normalizedRatio.toFixed(2)} ${normalizedLateralized ? "(≥1.4 ✓)" : "(<1.4)"}`;
      result["  Normalized Result"] = normalizedLateralized
        ? `🟢 Lateralizes to ${normalizedSide} side`
        : `⚪ Non-lateralizing (ratio <1.4)`;

      // Concordance check
      const concordant =
        (isLateralized &&
          normalizedLateralized &&
          lateralizedSide === normalizedSide) ||
        (!isLateralized && !normalizedLateralized);

      result["═══ LATERALIZATION SUMMARY ═══"] = "";
      result["Methods Concordance"] = concordant
        ? "✓ Both methods AGREE - Higher confidence"
        : "⚠ Methods DISAGREE - Use with caution";

      if (
        isLateralized &&
        normalizedLateralized &&
        lateralizedSide === normalizedSide
      ) {
        result["Final Lateralization"] =
          `🎯 Strong lateralization to ${lateralizedSide} side (both methods agree)`;
        result["Surgical Guidance"] =
          `Transsphenoidal approach with focus on ${lateralizedSide} side of pituitary. Consider more aggressive ${lateralizedSide} hemihypophysectomy if no visible adenoma.`;
      } else if (isLateralized || normalizedLateralized) {
        const preferredSide = isLateralized ? lateralizedSide : normalizedSide;
        result["Final Lateralization"] =
          `⚠ Possible lateralization to ${preferredSide} side (methods disagree - lower confidence)`;
        result["Surgical Guidance"] =
          `Transsphenoidal surgery with bilateral exploration. Consider ${preferredSide} side preference but inspect both thoroughly.`;
      } else {
        result["Final Lateralization"] =
          `⚪ Non-lateralizing study (both methods <1.4 threshold)`;
        result["Surgical Guidance"] =
          `Transsphenoidal surgery with thorough bilateral exploration. No side preference. Correlate with MRI findings and intraoperative inspection.`;
      }
    } else if (isCushings && (!leftCathSuccess || !rightCathSuccess)) {
      result["═══ LATERALIZATION ═══"] = "";
      result["Lateralization Status"] =
        "Not assessed - Only one side successfully catheterized";
      result["Surgical Guidance"] =
        "Transsphenoidal surgery with bilateral exploration (no lateralization data available)";
    } else if (isCushings && peakTimePoint === null) {
      result["═══ LATERALIZATION ═══"] = "";
      result["Lateralization Status"] =
        "Not assessed - No post-CRH samples entered";
      result["Note"] =
        "For optimal lateralization, use ACTH values from peak post-CRH time point";
    }

    return result;
  },

  refs: [
    {
      t: "Oldfield EH et al. Petrosal sinus sampling with and without CRH for differential diagnosis of Cushing's syndrome. N Engl J Med. 1991;325(13):897-905.",
      u: "https://doi.org/10.1056/NEJM199109263251301",
    },
    {
      t: "Lefournier V et al. Accuracy of bilateral inferior petrosal or cavernous sinuses sampling in predicting the lateralization of Cushing's disease pituitary microadenoma. J Clin Endocrinol Metab. 2003;88(1):196-203.",
      u: "https://doi.org/10.1210/jc.2002-020374",
    },
    {
      t: "Colao A et al. Inferior petrosal sinus sampling in the differential diagnosis of Cushing's syndrome: results of an Italian multicenter study. Eur J Endocrinol. 2001;144(5):499-507.",
      u: "https://doi.org/10.1530/eje.0.1440499",
    },
    {
      t: "Nieman LK et al. The diagnosis of Cushing's syndrome: an Endocrine Society Clinical Practice Guideline. J Clin Endocrinol Metab. 2008;93(5):1526-1540.",
      u: "https://doi.org/10.1210/jc.2008-0125",
    },
    {
      t: "Wind JJ et al. The lateralization accuracy of inferior petrosal sinus sampling in 501 patients with Cushing's disease. J Clin Endocrinol Metab. 2013;98(6):2285-2293.",
      u: "https://doi.org/10.1210/jc.2013-1159",
    },
    {
      t: "Machado MC et al. The inferior petrosal sinus sampling with/without desmopressin: enhancement with prolactin-to-ACTH gradient. Eur J Endocrinol. 2007;157(1):29-39.",
      u: "https://doi.org/10.1530/EJE-07-0100",
    },
  ],
};
