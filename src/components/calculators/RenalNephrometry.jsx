export const RenalNephrometry = {
  id: "renal-nephrometry",
  category: "Urology",
  name: "RENAL Nephrometry Score",
  desc: "Quantifies anatomical characteristics of renal tumours for surgical planning and risk assessment.",
  keywords: [
    "kidney tumor",
    "renal mass",
    "partial nephrectomy",
    "RENAL score",
    "PADUA",
  ],
  tags: ["Urology", "Oncology", "Surgical"],
  metaDesc:
    "Free R.E.N.A.L. Nephrometry Score Calculator. Assess renal tumor complexity for surgical planning. Calculate low, moderate, or high complexity based on size, location, and anatomy.",
  info: {
    text:
      "The R.E.N.A.L. score standardizes assessment of renal tumor anatomy. " +
      "It evaluates:\n" +
      "• R - Radius (tumor size)\n" +
      "• E - Exophytic/endophytic properties\n" +
      "• N - Nearness to collecting system\n" +
      "• A - Anterior/posterior location (descriptor only)\n" +
      "• L - Location relative to polar lines\n\n" +
      "Scores of 1-3 points are assigned to R, E, N, and L components. " +
      "The A descriptor (a/p/x) and optional 'h' suffix (hilar) do not contribute points.\n\n" +
      "Complexity categories: Low (4-6), Moderate (7-9), High (10-12)\n\n" +
      "Can be calculated from CT or MRI. Coronal images are best for polar line assessment, axial for anterior/posterior location.",
    link: {
      label: "View RENAL Score Diagram",
      url: "https://radiopaedia.org/articles/renal-nephrometry-scoring-system-2",
    },
  },
  fields: [
    {
      id: "radius",
      label: "Tumor diameter (cm)",
      type: "number",
      subLabel: "maximal diameter",
    },
    {
      id: "exophytic",
      label: "Exophytic/endophytic nature",
      type: "radio",
      opts: [
        { value: ">=50", label: "≥ 50% exophytic" },
        { value: "<50", label: "< 50% exophytic" },
        { value: "endophytic", label: "Entirely endophytic" },
      ],
    },
    {
      id: "nearness",
      label: "Nearness to collecting system (mm)",
      type: "radio",
      opts: [
        { value: ">=7", label: "≥ 7 mm" },
        { value: "4-7", label: "4-7 mm" },
        { value: "<=4", label: "≤ 4 mm" },
      ],
    },
    {
      id: "polar",
      label: "Location relative to polar line",
      type: "radio",
      opts: [
        {
          value: "above/below",
          label: "Entirely above or below polar line",
        },
        { value: "crosses", label: "Crosses polar line" },
        {
          value: "central",
          label: ">50% across polar line/between lines/crosses midline",
        },
      ],
    },
    {
      id: "anterior",
      label: "Anterior/posterior location",
      type: "select",
      opts: ["Anterior", "Posterior", "Neither/Indeterminate"],
    },
    {
      id: "hilar",
      label: "Hilar location (abuts renal artery/vein)",
      type: "checkbox",
    },
  ],
  compute: (v) => {
    const { radius, exophytic, nearness, polar, anterior, hilar } = v;

    // Determine points for radius
    let rPts = 0;
    const d = parseFloat(radius);
    if (!isNaN(d)) {
      if (d <= 4) rPts = 1;
      else if (d < 7) rPts = 2;
      else rPts = 3;
    }

    // Points for exophytic/endophytic nature
    let ePts = 0;
    if (exophytic === ">=50") ePts = 1;
    else if (exophytic === "<50") ePts = 2;
    else if (exophytic === "endophytic") ePts = 3;

    // Points for nearness to collecting system
    let nPts = 0;
    if (nearness === ">=7") nPts = 1;
    else if (nearness === "4-7") nPts = 2;
    else if (nearness === "<=4") nPts = 3;

    // Points for polar location
    let lPts = 0;
    if (polar === "above/below") lPts = 1;
    else if (polar === "crosses") lPts = 2;
    else if (polar === "central") lPts = 3;

    const total = rPts + ePts + nPts + lPts;

    // Determine complexity category
    let complexity = "";
    if (total >= 10) complexity = "High complexity";
    else if (total >= 7) complexity = "Moderate complexity";
    else complexity = "Low complexity";

    // Build suffix for descriptor
    let suffix = "";
    if (anterior === "Anterior") suffix = "a";
    else if (anterior === "Posterior") suffix = "p";
    else suffix = "x";
    if (hilar) suffix += "h";

    // Interpretation based on complexity
    let interpretation;
    if (total >= 10) {
      interpretation =
        "High complexity tumors are associated with longer operative times and higher complication rates. " +
        "In studies, 66% of high-complexity lesions underwent radical nephrectomy vs. partial nephrectomy. " +
        "Risk of conversion from partial to radical nephrectomy is 4-fold higher. " +
        "Consider radical nephrectomy when: oncologic potential is high, contralateral kidney is normal, " +
        "and partial nephrectomy would be technically challenging.";
    } else if (total >= 7) {
      interpretation =
        "Moderate complexity tumors can usually be managed with partial nephrectomy (77% success rate), " +
        "though operative difficulty is increased. About 23% require radical nephrectomy. " +
        "Surgical approach should consider surgeon experience and patient factors.";
    } else {
      interpretation =
        "Low complexity tumors are amenable to nephron-sparing approaches. " +
        "In studies, 94% were successfully treated with partial nephrectomy, with only 6% requiring radical nephrectomy. " +
        "Minimally invasive techniques or thermal ablation are often feasible.";
    }

    return {
      "Total Score": `${total}${suffix}`,
      Complexity: complexity,
      Interpretation: interpretation,
    };
  },
  refs: [
    {
      t: "Kutikov & Uzzo 2009 - Original RENAL nephrometry score",
      u: "https://doi.org/10.1016/j.juro.2009.05.035",
    },
    {
      t: "Canter et al. 2011 - Utility of the R.E.N.A.L. score validation",
      u: "https://doi.org/10.1016/j.urology.2011.04.035",
    },
    {
      t: "Rosevear et al. 2012 - RENAL score predicts surgical outcomes",
      u: "https://doi.org/10.1089/end.2012.0166",
    },
    {
      t: "AUA Guidelines 2021 - Renal Mass and Localized Renal Cancer",
      u: "https://www.auanet.org/guidelines-and-quality/guidelines/renal-mass-and-localized-renal-cancer-evaluation-management-and-follow-up",
    },
  ],
};
