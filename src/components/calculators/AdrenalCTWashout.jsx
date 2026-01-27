export const AdrenalCTWashout = {
  id: "adrenal-ct",
  category: "Radiology",
  name: "Adrenal Washout CT",
  desc: "Absolute & relative washout percentages to differentiate adenoma vs. non‑adenoma.",
  metaDesc:
    "Free Adrenal CT Washout Calculator. Calculate absolute and relative washout percentages to differentiate adrenal adenoma from non-adenoma. Evidence-based with peer-reviewed references.",
  info: {
    text: "Caveat: Washout measurements may be the same in adenomas and metastases from hypervascular extraadrenal primary tumors, e.g. renal cell carcinoma (RCC) or hepatocellular carcinoma (HCC).\n\nCaveat: Markedly decreased sensitivity (66.7%) of washout measurements in large adenomas (≥ 3 cm).",
  },
  fields: [
    { id: "unenh", label: "Pre‑contrast HU", type: "number" },
    { id: "portal", label: "Post‑contrast HU (60‑75 s)", type: "number" },
    { id: "delayed", label: "Delayed HU (15 min)", type: "number" },
  ],
  compute: ({ unenh = 0, portal = 0, delayed = 0 }) => {
    const apw = ((portal - delayed) / (portal - unenh)) * 100;
    const rpw = ((portal - delayed) / portal) * 100;
    return {
      "Absolute Washout (%)": apw.toFixed(1),
      "Relative Washout (%)": rpw.toFixed(1),
      Interpretation:
        apw >= 60 || rpw >= 40
          ? "Suggests adrenal adenoma"
          : "Indeterminate / non‑adenoma",
    };
  },
  refs: [
    {
      t: "Caoili EM AJR 2000",
      u: "https://doi.org/10.2214/ajr.175.5.1751411",
    },
    {
      t: "Choi YA Radiology 2013",
      u: "https://doi.org/10.1148/radiol.12120110",
    },
    {
      t: "Park SY Abdom Imaging 2015",
      u: "https://doi.org/10.1007/s00261-015-0521-x",
    },
  ],
};
