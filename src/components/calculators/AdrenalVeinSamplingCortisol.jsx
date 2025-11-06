// Adrenal Vein Sampling – Cortisol (Autonomous Cushing) Calculator
//
// This calculator estimates cortisol lateralisation during adrenal vein sampling
// for ACTH‑independent cortisol excess (mild or subclinical Cushing).  It
// reproduces the workflow of the CSV templates provided by the user and
// incorporates published criteria from Young et al. and subsequent studies.
// Cannulation success is evaluated using the epinephrine gradient (AV−IVC
// >100 pg/mL)【366586390981246†L574-L576】.  Cortisol lateralisation is
// assessed using the adrenal‑to‑peripheral vein (AV/PV) cortisol ratio and
// the side‑to‑side cortisol lateralisation ratio (CLR).  A unilateral
// cortisol‑secreting adenoma is diagnosed when the AV/PV cortisol ratio is
// >6.5 on one side and ≤3.3 on the contralateral side with CLR ≥2.3【366586390981246†L576-L581】.  Bilateral
// hypersecretion is suggested when CLR ≤2【366586390981246†L576-L581】.  Results can be
// downloaded as a CSV file for attachment to the patient record.

export const AVSCortisol = {
  id: "avs-cortisol",
  name: "Adrenal Vein Sampling – Cortisol",
  desc:
    "Evaluates lateralisation of cortisol secretion during adrenal vein sampling for ACTH‑independent hypercortisolism.",
  info: {
    text:
      "This tool assists in interpreting adrenal vein sampling (AVS) for autonomous cortisol secretion. " +
      "Successful cannulation is confirmed when the adrenal vein (AV) epinephrine level exceeds the inferior vena cava (IVC) level by ≥100 pg/mL" +
      "【366586390981246†L574-L576】.  For each side, the AV/PV cortisol ratio is computed as the adrenal cortisol divided by the peripheral (IVC) cortisol. " +
      "Side‑to‑side cortisol lateralisation ratio (CLR) is the ratio of the higher AV/PV cortisol ratio to the lower ratio.  A unilateral cortisol‑secreting adenoma is suggested when the AV/PV ratio is >6.5 on one side and ≤3.3 on the contralateral side and the CLR ≥2.3; " +
      "bilateral hypersecretion is suggested when CLR ≤2【366586390981246†L576-L581】."
  },
  fields: [
    {
      id: "ivc_cort",
      label: "Peripheral (IVC) cortisol",
      type: "number",
      subLabel: "µg/dL or nmol/L (consistent units)",
    },
    {
      id: "ivc_epi",
      label: "Peripheral (IVC) epinephrine",
      type: "number",
      subLabel: "pg/mL",
    },
    {
      id: "left_cort",
      label: "Left adrenal vein cortisol",
      type: "number",
      subLabel: "µg/dL or nmol/L (same units as IVC)",
    },
    {
      id: "left_epi",
      label: "Left adrenal vein epinephrine",
      type: "number",
      subLabel: "pg/mL",
    },
    {
      id: "right_cort",
      label: "Right adrenal vein cortisol",
      type: "number",
      subLabel: "µg/dL or nmol/L (same units as IVC)",
    },
    {
      id: "right_epi",
      label: "Right adrenal vein epinephrine",
      type: "number",
      subLabel: "pg/mL",
    },
  ],
  compute: (v) => {
    const ivcCort = parseFloat(v.ivc_cort);
    const ivcEpi = parseFloat(v.ivc_epi);
    const leftCort = parseFloat(v.left_cort);
    const leftEpi = parseFloat(v.left_epi);
    const rightCort = parseFloat(v.right_cort);
    const rightEpi = parseFloat(v.right_epi);
    // Ratios and epinephrine gradients
    const leftSuccess = !isNaN(leftEpi) && !isNaN(ivcEpi) ? leftEpi - ivcEpi > 100 : false;
    const rightSuccess = !isNaN(rightEpi) && !isNaN(ivcEpi) ? rightEpi - ivcEpi > 100 : false;
    const leftRatio = !isNaN(leftCort) && !isNaN(ivcCort) && ivcCort !== 0 ? leftCort / ivcCort : NaN;
    const rightRatio = !isNaN(rightCort) && !isNaN(ivcCort) && ivcCort !== 0 ? rightCort / ivcCort : NaN;
    let clr = NaN;
    if (!isNaN(leftRatio) && !isNaN(rightRatio) && leftRatio > 0 && rightRatio > 0) {
      const higher = Math.max(leftRatio, rightRatio);
      const lower = Math.min(leftRatio, rightRatio);
      clr = higher / lower;
    }
    // Determine interpretation
    let interpretation;
    if (!leftSuccess || !rightSuccess) {
      interpretation =
        "Cannulation unsuccessful on " +
        (leftSuccess ? (rightSuccess ? "none" : "right") : (rightSuccess ? "left" : "both")) +
        ". Adequate epinephrine gradient (>100 pg/mL) is required for reliable interpretation";
    } else if (!isNaN(leftRatio) && !isNaN(rightRatio)) {
      const dominantSide = leftRatio > rightRatio ? "Left" : "Right";
      const dominantRatio = Math.max(leftRatio, rightRatio);
      const nondominantRatio = Math.min(leftRatio, rightRatio);
      // Conditions for unilateral disease
      const unilateral = dominantRatio > 6.5 && nondominantRatio <= 3.3 && clr >= 2.3;
      const bilateral = clr <= 2;
      if (unilateral) {
        interpretation =
          `Unilateral cortisol‑secreting adenoma likely on the ${dominantSide} side. ` +
          `Criteria met: dominant AV/PV cortisol ratio >6.5, contralateral ≤3.3 and CLR ≥2.3【366586390981246†L576-L581】.`;
      } else if (bilateral) {
        interpretation =
          "Bilateral cortisol hypersecretion is likely (CLR ≤2), suggesting adrenal hyperplasia【366586390981246†L576-L581】.";
      } else {
        interpretation =
          "No clear lateralisation. AV/PV ratios and CLR do not meet published criteria for unilateral disease; results are indeterminate.";
      }
    } else {
      interpretation = "Insufficient data to compute ratios.";
    }
    // Build results object
    const results = {
      "Left AV/PV cortisol ratio": isNaN(leftRatio) ? "–" : leftRatio.toFixed(2),
      "Right AV/PV cortisol ratio": isNaN(rightRatio) ? "–" : rightRatio.toFixed(2),
      "Side‑to‑side cortisol ratio (CLR)": isNaN(clr) ? "–" : clr.toFixed(2),
      "Cannulation success": `Left: ${leftSuccess ? "Yes" : "No"}, Right: ${rightSuccess ? "Yes" : "No"}`,
      Interpretation: interpretation,
    };
    // Prepare CSV for download
    const csvLines = [
      ["Parameter", "Value"],
      ["Left AV/PV cortisol ratio", isNaN(leftRatio) ? "" : leftRatio.toFixed(4)],
      ["Right AV/PV cortisol ratio", isNaN(rightRatio) ? "" : rightRatio.toFixed(4)],
      ["CLR", isNaN(clr) ? "" : clr.toFixed(4)],
      ["Cannulation success", `Left: ${leftSuccess ? "Yes" : "No"}, Right: ${rightSuccess ? "Yes" : "No"}`],
      ["Interpretation", interpretation.replace(/\n/g, " ")],
    ];
    const csvContent = csvLines.map((row) => row.join(",")).join("\n");
    const encoded = encodeURIComponent(csvContent);
    const downloadLink = `data:text/csv;charset=utf-8,${encoded}`;
    results["Download CSV"] = `<a href='${downloadLink}' download='avs_cortisol_results.csv'>Download results</a>`;
    return results;
  },
  refs: [
    {
      t: "Acharya et al. 2019 – AVS outcomes in bilateral adrenal mass and ACTH‑independent Cushing's syndrome",
      u: "https://doi.org/10.1007/s00268-018-4845-y",
    },
    {
      t: "Young et al. 2007 – Cortisol lateralisation criteria in AVS",
      u: "https://doi.org/10.1007/s00268-006-0214-7",
    },
    {
      t: "Hu et al. 2022 – Case report: PA and subclinical Cushing with AVS",
      u: "https://doi.org/10.3389/fcvm.2022.911333",
    },
  ],
};