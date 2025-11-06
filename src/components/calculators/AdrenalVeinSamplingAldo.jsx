// Adrenal Vein Sampling – Aldosterone Calculator
//
// This calculator interprets adrenal vein sampling (AVS) data for the
// evaluation of primary hyperaldosteronism.  It supports both pre‑ and
// post‑cosyntropin measurements and calculates selectivity indices (SI),
// aldosterone‑to‑cortisol ratios, the lateralisation index (LI) and
// contralateral suppression ratio (CR) for each condition.  Lateralisation
// criteria follow international consensus guidelines: a selectivity index of
// ≥5 with ACTH stimulation (≥2 without ACTH) is required for successful
// cannulation【33594518913723†L35-L39】, and a lateralisation index (LI) >4
// with ACTH stimulation or >2 without ACTH indicates unilateral disease
//【33594518913723†L225-L242】.  The contralateral suppression ratio
// (CR) is defined as the aldosterone‑to‑cortisol ratio in the non‑dominant
// adrenal vein divided by the corresponding ratio in the IVC; CR <1
// suggests suppression of the contralateral gland【33594518913723†L242-L248】.  The
// adrenal‑to‑IVC index (AV/IVC ratio) compares the dominant A/C ratio
// with the IVC ratio; thresholds of >5.5 (ipsilateral) and <0.5
// (contralateral) have been proposed【33594518913723†L250-L257】 but require
// caution.  Results are summarised separately for pre‑ and post‑ACTH
// conditions and can be downloaded as a CSV file.

export const AVSHyperaldo = {
  id: "avs-hyperaldo",
  name: "Adrenal Vein Sampling – Aldosterone",
  desc:
    "Interprets AVS data for primary hyperaldosteronism (pre‑ and post‑cosyntropin)",
  info: {
    text:
      "This tool calculates selectivity indices, aldosterone‑to‑cortisol (A/C) ratios, lateralisation index (LI), contralateral suppression ratio (CR) and adrenal‑to‑IVC index (AV/IVC) for primary hyperaldosteronism. " +
      "Successful cannulation is defined by a selectivity index (SI) ≥5 with ACTH stimulation or ≥2 without ACTH" +
      "【33594518913723†L35-L39】.  Lateralisation is determined using the LI: (A/C of dominant adrenal)/(A/C of non‑dominant adrenal); a cutoff of >4 with ACTH (or >2 without ACTH) suggests unilateral aldosterone hypersecretion【33594518913723†L225-L242】.  The CR compares the non‑dominant A/C ratio to that of the IVC; values <1 indicate contralateral suppression【33594518913723†L242-L248】.  The AV/IVC index compares the dominant A/C ratio to the IVC ratio; >5.5 or <0.5 have been proposed to indicate ipsilateral or contralateral disease【33594518913723†L250-L257】.  Data are summarised for both pre‑ and post‑cosyntropin conditions if provided."
  },
  fields: [
    // Pre‑cosyntropin fields
    { id: "pre_ivc_ald", label: "Pre: IVC aldosterone", type: "number" },
    { id: "pre_ivc_cort", label: "Pre: IVC cortisol", type: "number" },
    { id: "pre_left_ald", label: "Pre: Left adrenal vein aldosterone", type: "number" },
    { id: "pre_left_cort", label: "Pre: Left adrenal vein cortisol", type: "number" },
    { id: "pre_right_ald", label: "Pre: Right adrenal vein aldosterone", type: "number" },
    { id: "pre_right_cort", label: "Pre: Right adrenal vein cortisol", type: "number" },
    // Post‑cosyntropin fields
    { id: "post_ivc_ald", label: "Post: IVC aldosterone", type: "number" },
    { id: "post_ivc_cort", label: "Post: IVC cortisol", type: "number" },
    { id: "post_left_ald", label: "Post: Left adrenal vein aldosterone", type: "number" },
    { id: "post_left_cort", label: "Post: Left adrenal vein cortisol", type: "number" },
    { id: "post_right_ald", label: "Post: Right adrenal vein aldosterone", type: "number" },
    { id: "post_right_cort", label: "Post: Right adrenal vein cortisol", type: "number" },
  ],
  compute: (v) => {
    // Helper to compute metrics for a given prefix (pre or post)
    function computeSet(prefix, useACTH) {
      const ivcAld = parseFloat(v[`${prefix}_ivc_ald`]);
      const ivcCort = parseFloat(v[`${prefix}_ivc_cort`]);
      const leftAld = parseFloat(v[`${prefix}_left_ald`]);
      const leftCort = parseFloat(v[`${prefix}_left_cort`]);
      const rightAld = parseFloat(v[`${prefix}_right_ald`]);
      const rightCort = parseFloat(v[`${prefix}_right_cort`]);
      if (
        [ivcAld, ivcCort, leftAld, leftCort, rightAld, rightCort].some(
          (x) => isNaN(x)
        ) ||
        ivcCort === 0 ||
        leftCort === 0 ||
        rightCort === 0
      ) {
        return null;
      }
      // Selectivity indices (SI)
      const siLeft = leftCort / ivcCort;
      const siRight = rightCort / ivcCort;
      const siThreshold = useACTH ? 5 : 2;
      const siLeftOk = siLeft >= siThreshold;
      const siRightOk = siRight >= siThreshold;
      // Aldosterone to cortisol ratios
      const acLeft = leftAld / leftCort;
      const acRight = rightAld / rightCort;
      const acIvc = ivcAld / ivcCort;
      // Determine dominant and nondominant sides
      const dominantSide = acLeft >= acRight ? "Left" : "Right";
      const dominant = Math.max(acLeft, acRight);
      const nondominant = Math.min(acLeft, acRight);
      // Lateralisation index (LI)
      const li = dominant / nondominant;
      const liThreshold = useACTH ? 4 : 2;
      // Contralateral suppression ratio (CR)
      const cr = nondominant / acIvc;
      // Adrenal‑to‑IVC index (AV/IVC)
      const avivc = dominant / acIvc;
      // Interpret results
      let interpretation;
      if (!siLeftOk || !siRightOk) {
        interpretation =
          `Cannulation failure on ${!siLeftOk && !siRightOk ? "both" : !siLeftOk ? "left" : "right"} side(s) ` +
          `(SI < ${siThreshold}). Reliable lateralisation requires adequate selectivity.`;
      } else {
        if (li > liThreshold) {
          interpretation =
            `Unilateral aldosterone hypersecretion likely on the ${dominantSide} side (LI = ${li.toFixed(2)} > ${liThreshold}). ` +
            `Consider adrenalectomy if clinically appropriate【33594518913723†L225-L242】.`;
          if (cr < 1) {
            interpretation +=
              ` Contralateral suppression ratio (CR = ${cr.toFixed(2)}) is <1, supporting contralateral suppression【33594518913723†L242-L248】.`;
          }
        } else if (li >= liThreshold * 0.5) {
          interpretation =
            `Indeterminate lateralisation (LI = ${li.toFixed(2)}). Values between ${
              liThreshold * 0.5
            } and ${liThreshold} are equivocal; repeat sampling or rely on additional indices.`;
        } else {
          interpretation =
            `Bilateral disease likely (LI = ${li.toFixed(2)} ≤ ${liThreshold * 0.5}). Medical management with mineralocorticoid receptor antagonists is suggested.`;
        }
      }
      return {
        siLeft,
        siRight,
        siLeftOk,
        siRightOk,
        acLeft,
        acRight,
        acIvc,
        li,
        cr,
        avivc,
        dominantSide,
        interpretation,
      };
    }
    // Compute both pre‑ and post‑ACTH conditions
    const pre = computeSet("pre", false);
    const post = computeSet("post", true);
    const results = {};
    function summarise(name, obj) {
      if (!obj) return;
      results[`${name} – Selectivity index (Left)`] = obj.siLeft.toFixed(2);
      results[`${name} – Selectivity index (Right)`] = obj.siRight.toFixed(2);
      results[`${name} – Selectivity adequate?`] = `Left: ${obj.siLeftOk ? "Yes" : "No"}, Right: ${obj.siRightOk ? "Yes" : "No"}`;
      results[`${name} – A/C ratio (Left)`] = obj.acLeft.toFixed(4);
      results[`${name} – A/C ratio (Right)`] = obj.acRight.toFixed(4);
      results[`${name} – A/C ratio (IVC)`] = obj.acIvc.toFixed(4);
      results[`${name} – Lateralisation index (LI)`] = obj.li.toFixed(2);
      results[`${name} – Contralateral suppression ratio (CR)`] = obj.cr.toFixed(2);
      results[`${name} – AV/IVC index`] = obj.avivc.toFixed(2);
      results[`${name} – Interpretation`] = obj.interpretation;
    }
    if (pre) summarise("Pre", pre);
    if (post) summarise("Post", post);
    // If no data at all
    if (!pre && !post) {
      return { Error: "Insufficient data to compute metrics." };
    }
    // Construct CSV
    const csvHeader = ["Metric", "Value"];
    const csvRows = Object.entries(results).map(([k, v]) => [k, String(v)]);
    const csvContent = [csvHeader, ...csvRows]
      .map((row) => row.join(","))
      .join("\n");
    const encoded = encodeURIComponent(csvContent);
    const downloadLink = `data:text/csv;charset=utf-8,${encoded}`;
    results["Download CSV"] = `<a href='${downloadLink}' download='avs_hyperaldo_results.csv'>Download results</a>`;
    return results;
  },
  refs: [
    {
      t: "Naruse et al. 2021 – AVS for subtype diagnosis of primary hyperaldosteronism",
      u: "https://doi.org/10.3803/EnM.2021.1192",
    },
    {
      t: "PASO study – Primary Aldosteronism Surgical Outcome",
      u: "https://doi.org/10.1210/jc.2016-2938",
    },
    {
      t: "Young et al. 2003 – Lateralisation criteria in AVS",
      u: "https://doi.org/10.1056/NEJMoa030315",
    },
  ],
};