/**
 * IPSS sampling interpretation for adult ACTH-dependent hypercortisolism.
 * Preserves raw ACTH ratios and separates basal/concurrent PRL normalization.
 * Sources and limits: docs/verification/calculators/ipss.md and refs below.
 * No autonomous diagnosis, procedural prescription or tumor-side selection.
 */

export const IPSS = {
  id: "ipss",
  category: "Interventional",
  name: "Inferior Petrosal Sinus Sampling (IPSS)",
  desc: "Basal and post-CRH ACTH ratios with explicitly labeled prolactin normalization",
  guidelineVersion: "IPSS sampling interpretation (SVIN 2026)",
  keywords: [
    "pituitary",
    "Cushing",
    "ACTH",
    "petrosal sinus",
    "lateralization",
  ],
  tags: ["Interventional", "Endocrinology", "Neuroradiology"],
  metaDesc:
    "IPSS sampling calculator for adult ACTH-dependent hypercortisolism: basal and post-CRH ACTH ratios, optional prolactin and method-specific normalization. No automated surgical-side selection.",

  info: {
    text: "Calculate basal and post-CRH ACTH ratios from simultaneous left IPS, right IPS and peripheral samples. Intended for adult ACTH-dependent hypercortisolism with active cortisol excess at sampling; IPSS does not establish hypercortisolism.\n\nA basal ACTH IPS/P ratio ≥2 or stimulated ratio ≥3 supports a central gradient. False-positive and false-negative results occur. Basal prolactin ratios ≥1.8 support sampling adequacy, but neither prove catheter position nor exclude a pituitary source when lower.\n\nProlactin is optional: enter a complete left/right/peripheral set or leave the whole set blank. Basal-PRL and concurrent-PRL normalized ratios are shown separately at a unique dominant unadjusted stimulated ACTH peak. They are not interchangeable diagnostic cutoffs or tumor-lateralization scores. Tied peaks require review.\n\nInterpret alongside venography, sampling protocol, endocrine assessment and imaging. This tool does not choose a surgical side, prescribe treatment or implement a desmopressin protocol.",
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

    const positiveDecimal = (value) => {
      if (typeof value !== "number" && typeof value !== "string") return NaN;
      if (typeof value === "string" && !/^[+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())) return NaN;
      const number = Number(value);
      return Number.isFinite(number) && number > 0 ? number : NaN;
    };
    const absent = (value) => value === undefined || value === null || (typeof value === "string" && value.trim() === "");
    // Compare validated decimal inputs exactly: binary division can put an
    // exact 30.9/10.3 boundary just below 3, or hide a tie across sample times.
    const decimalFraction = (value) => {
      const [mantissa, exponent = "0"] = String(value).trim().replace(/^\+/, "").toLowerCase().split("e");
      const [whole, fraction = ""] = mantissa.split(".");
      const digits = BigInt((whole + fraction).replace(/^0+/, "") || "0");
      const scale = fraction.length - Number(exponent);
      return scale >= 0 ? [digits, 10n ** BigInt(scale)] : [digits * 10n ** BigInt(-scale), 1n];
    };
    const exactRatio = (numerator, denominator) => {
      const [n, nd] = decimalFraction(numerator);
      const [d, dd] = decimalFraction(denominator);
      return [n * dd, nd * d];
    };
    const compareRatios = ([a, ad], [b, bd]) => {
      const difference = a * bd - b * ad;
      return difference < 0n ? -1 : difference > 0n ? 1 : 0;
    };
    const hasBasalPRL = ![basalLeftPRL, basalRightPRL, basalPeriphPRL].every(absent);
    const basal = [basalLeftACTH, basalRightACTH, basalPeriphACTH, ...(hasBasalPRL ? [basalLeftPRL, basalRightPRL, basalPeriphPRL] : [])].map(positiveDecimal);
    if (!basal.every(Number.isFinite)) {
      return {
        Error:
          "Enter all three basal ACTH concentrations as finite positive numbers in the displayed units. Prolactin is optional: enter all three finite positive values or leave the whole set blank.",
      };
    }

    const [bLA, bRA, bPA, bLP, bRP, bPP] = basal;
    const basalRatios = [bLA / bPA, bRA / bPA, ...(hasBasalPRL ? [bLP / bPP, bRP / bPP] : [])];
    if (!basalRatios.every((ratio) => Number.isFinite(ratio) && ratio > 0)) {
      return { Error: "Basal ratios cannot be represented reliably. Check concentrations and units." };
    }

    if (ipssRows !== undefined && !Array.isArray(ipssRows)) {
      return { Error: "Post-stimulation samples must be entered as rows." };
    }
    const samples = [];
    const sampleFields = ["time", "leftACTH", "rightACTH", "periphACTH", "leftPRL", "rightPRL", "periphPRL"];
    for (const [index, row] of (ipssRows ?? []).entries()) {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        return { Error: `Post-stimulation row ${index + 1} is invalid.` };
      }
      if (sampleFields.every((field) => absent(row[field]))) continue;
      const sample = {};
      const hasPRL = ![row.leftPRL, row.rightPRL, row.periphPRL].every(absent);
      for (const field of sampleFields) {
        if (field.endsWith("PRL") && !hasPRL) continue;
        sample[field] = positiveDecimal(row[field]);
        if (!Number.isFinite(sample[field])) {
          return { Error: `Post-stimulation row ${index + 1}: enter complete positive finite ACTH values and time; any supplied prolactin must also be positive and finite.` };
        }
      }
      if (![sample.leftACTH / sample.periphACTH, sample.rightACTH / sample.periphACTH].every((ratio) => Number.isFinite(ratio) && ratio > 0)) {
        return { Error: `Post-stimulation row ${index + 1}: ratios cannot be represented reliably. Check concentrations and units.` };
      }
      sample.exactLeftACTH = exactRatio(row.leftACTH, row.periphACTH);
      sample.exactRightACTH = exactRatio(row.rightACTH, row.periphACTH);
      samples.push(sample);
    }

    // STEP 1: Assess Catheterization Success (using basal PRL ratios)
    const leftPRLRatio = hasBasalPRL ? bLP / bPP : null;
    const rightPRLRatio = hasBasalPRL ? bRP / bPP : null;

    const leftCathSuccess = hasBasalPRL && compareRatios(exactRatio(basalLeftPRL, basalPeriphPRL), [18n, 10n]) >= 0;
    const rightCathSuccess = hasBasalPRL && compareRatios(exactRatio(basalRightPRL, basalPeriphPRL), [18n, 10n]) >= 0;
    const leftCathStatus =
      leftCathSuccess ? "Supports adequate sampling" : "Sampling caution";
    const rightCathStatus =
      rightCathSuccess ? "Supports adequate sampling" : "Sampling caution";

    const result = {
      "Clinical Context": "Interpret only in established ACTH-dependent hypercortisolism with active cortisol excess at sampling. IPSS does not establish hypercortisolism. False-positive and false-negative localization results occur; correlate with sampling adequacy, endocrine testing and imaging.",
      "Surgical Limitation": "IPSS right-left gradients alone are not sufficiently reliable to select a tumor side or surgical resection. This report does not prescribe treatment.",
      "═══ CATHETERIZATION SUCCESS ═══": "",
      "Left IPS PRL Ratio": hasBasalPRL ? `${leftPRLRatio.toFixed(2)} — ${leftCathStatus}` : "Not available: basal prolactin not supplied",
      "Right IPS PRL Ratio": hasBasalPRL ? `${rightPRLRatio.toFixed(2)} — ${rightCathStatus}` : "Not available: basal prolactin not supplied",
      "Catheterization Note":
        !hasBasalPRL ? "Basal prolactin assessment not available; review venography and sampling adequacy separately." : leftCathSuccess && rightCathSuccess
          ? "Bilateral basal PRL ratios ≥1.8 support adequate pituitary venous sampling; this is not proof of catheter position."
          : "Sampling caution: at least one basal PRL ratio is <1.8. Review venography, sample handling and clinical context; low PRL alone does not establish catheter failure or erase the ACTH findings.",
    };

    // STEP 2: Calculate Basal ACTH Ratios
    const leftBasalACTHRatio = bLA / bPA;
    const rightBasalACTHRatio = bRA / bPA;
    const maxBasalACTHRatio = Math.max(leftBasalACTHRatio, rightBasalACTHRatio);
    const basalCriterionMet = compareRatios(exactRatio(basalLeftACTH, basalPeriphACTH), [2n, 1n]) >= 0 || compareRatios(exactRatio(basalRightACTH, basalPeriphACTH), [2n, 1n]) >= 0;

    result["═══ BASAL ACTH RATIOS ═══"] = "";
    result["Left IPS/Peripheral (Basal)"] = leftBasalACTHRatio.toFixed(2);
    result["Right IPS/Peripheral (Basal)"] = rightBasalACTHRatio.toFixed(2);
    result["Maximum Basal Ratio"] =
      `${maxBasalACTHRatio.toFixed(2)} ${basalCriterionMet ? "(≥2 central gradient criterion met)" : "(<2)"}`;

    // Identify the dominant unadjusted stimulated peak before any normalization.
    let maxPeakACTHRatio = 0;
    let exactPeakACTHRatio = [0n, 1n];
    let peakSamples = [];
    for (const row of samples) {
      for (const side of ["LEFT", "RIGHT"]) {
        const ratio = (side === "LEFT" ? row.leftACTH : row.rightACTH) / row.periphACTH;
        const exact = side === "LEFT" ? row.exactLeftACTH : row.exactRightACTH;
        const comparison = compareRatios(exact, exactPeakACTHRatio);
        if (comparison > 0) {
          maxPeakACTHRatio = ratio;
          exactPeakACTHRatio = exact;
          peakSamples = [{ row, side }];
        } else if (comparison === 0) {
          peakSamples.push({ row, side });
        }
      }
    }
    const stimulatedCriterionMet = compareRatios(exactPeakACTHRatio, [3n, 1n]) >= 0;
    if (peakSamples.length > 0) {
      result["═══ POST-CRH ACTH RATIOS ═══"] = "";
      result["Peak Time Point"] = [...new Set(peakSamples.map(({ row }) => `+${row.time} minutes`))].join("; ");
      result["Peak IPS/Peripheral Ratio"] =
        `${maxPeakACTHRatio.toFixed(2)} ${stimulatedCriterionMet ? "(≥3 central gradient criterion met)" : "(<3)"}`;
    }

    // STEP 4: Diagnostic Interpretation
    result["═══ DIAGNOSTIC INTERPRETATION ═══"] = "";

    const isCushings = basalCriterionMet || stimulatedCriterionMet;

    if (isCushings) {
      result["Localization Pattern"] = "Central ACTH gradient present under the displayed criteria; supports a pituitary source in the appropriate clinical and sampling context, but is not a definitive diagnosis.";

      if (basalCriterionMet && stimulatedCriterionMet) {
        result["Criteria Met"] =
          "Both basal (≥2) AND stimulated peak (≥3) criteria met";
      } else if (basalCriterionMet) {
        result["Criteria Met"] = "Basal ratio ≥2";
      } else {
        result["Criteria Met"] = "Peak post-CRH ratio ≥3";
      }

      result["Recommendation"] =
        "Correlate the sampling pattern with endocrine assessment and imaging; do not choose surgery or a resection side from these ratios alone.";
    } else {
      result["Localization Pattern"] = samples.length > 0
        ? "No central ACTH gradient demonstrated under the displayed basal and stimulated criteria. An ectopic source is possible, but false-negative pituitary sampling must be considered."
        : "No central ACTH gradient demonstrated in the basal sample. No stimulated samples were entered; a basal-only result does not establish an ectopic source.";
      result["Criteria"] =
        `Basal ratio <2 (${maxBasalACTHRatio.toFixed(2)})${samples.length > 0 ? ` AND peak ratio <3 (${maxPeakACTHRatio.toFixed(2)})` : ""}`;
      result["Recommendation"] =
        "Review sampling adequacy, active cortisol excess, protocol and endocrine/imaging findings before further localization or treatment decisions.";
    }

    // Method-specific descriptive arithmetic; no normalized diagnosis or tumor-side claim.
    if (peakSamples.length === 1) {
      const { row, side } = peakSamples[0];
      result["Normalization sample"] = `${side} IPS at +${row.time} minutes; dominant unadjusted stimulated ACTH IPS/P ${maxPeakACTHRatio.toFixed(4)}`;
      const basalDenominator = hasBasalPRL ? (side === "LEFT" ? bLP : bRP) / bPP : null;
      const concurrentDenominator = row.periphPRL === undefined ? null : (side === "LEFT" ? row.leftPRL : row.rightPRL) / row.periphPRL;
      for (const [label, denominator, method] of [
        ["Basal PRL-normalized peak ACTH ratio", basalDenominator, "ipsilateral basal PRL IPS/P; Sharma 2011"],
        ["Concurrent PRL-normalized peak ACTH ratio", concurrentDenominator, "ipsilateral concurrent PRL IPS/P; SVIN 2026 Figure 5"],
      ]) {
        if (denominator === null) {
          result[label] = "Not available: required prolactin set not supplied; no substitution performed.";
        } else {
          const normalized = maxPeakACTHRatio / denominator;
          if (!Number.isFinite(denominator) || denominator <= 0 || !Number.isFinite(normalized) || normalized <= 0) {
            return { Error: "Normalized ratios cannot be represented reliably. Check concentrations and units." };
          }
          result[label] = `${normalized.toFixed(4)} — ${maxPeakACTHRatio.toFixed(4)} divided by ${denominator.toFixed(4)} (${method})`;
        }
      }
      result["Normalization limitation"] = "These are distinct method-specific ratios, not interchangeable diagnostic cutoffs or bilateral tumor-lateralization scores. Interpret with the cited method, sampling context and specialist judgment.";
    } else if (peakSamples.length > 1) {
      result["Normalization sample"] = "Tied dominant unadjusted ACTH peaks: " + peakSamples.map(({ row, side }) => `${side} +${row.time} minutes`).join("; ") + ". No single normalization sample selected; review the tied measurements.";
    }

    result._severity = "info";

    return {
      "ACTH sampling summary": `Basal maximum ${maxBasalACTHRatio.toFixed(2)}; ${samples.length > 0 ? `post-CRH peak ${maxPeakACTHRatio.toFixed(2)}` : "no stimulated samples entered"}. ${isCushings ? "Central gradient criterion met" : "No central gradient demonstrated"}; interpret in clinical and sampling context.`,
      ...result,
    };
  },

  refs: [
    {
      t: "Siddiq F et al. Consensus Guidelines on Inferior Petrosal Sinus Sampling. SVIN 2026. Important Lab Values, Figure 5 and timing: inclusive ACTH/PRL criteria and concurrent normalization.",
      u: "https://doi.org/10.1161/SVIN.125.002309",
    },
    {
      t: "Sharma ST, Raff H, Nieman LK. Prolactin as a marker of successful catheterization during IPSS (2011). Study analysis: dominant post-CRH ACTH normalized by ipsilateral basal PRL.",
      u: "https://doi.org/10.1210/jc.2011-2149",
    },
    {
      t: "Fleseriu M et al. Consensus on diagnosis and management of Cushing's disease: a guideline update (2021). IPSS clinical context, false results and limits of right-left localization; accepted manuscript pp.13,16–18.",
      u: "https://doi.org/10.1016/S2213-8587(21)00235-7",
    },
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
