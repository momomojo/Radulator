export const AdrenalMRICSI = {
  id: "adrenal-mri",
  category: "Radiology",
  name: "Adrenal MRI CSI",
  desc: "Signal‑intensity index and adrenal‑to‑spleen CSI ratio.",
  metaDesc:
    "Free Adrenal MRI Chemical Shift Index Calculator. Calculate signal intensity index and adrenal-to-spleen CSI ratio to characterize adrenal lesions. Differentiate lipid-rich adenomas.",
  fields: [
    { id: "a_ip", label: "Adrenal SI in‑phase", type: "number" },
    { id: "a_op", label: "Adrenal SI opposed‑phase", type: "number" },
    { id: "s_ip", label: "Spleen SI in‑phase", type: "number" },
    { id: "s_op", label: "Spleen SI opposed‑phase", type: "number" },
  ],
  compute: ({ a_ip = 0, a_op = 0, s_ip = 0, s_op = 0 }) => {
    const siIdx = ((a_ip - a_op) / a_ip) * 100;
    const csiRatio = a_op / s_op / (a_ip / s_ip);
    return {
      "Signal Intensity Index (%)": siIdx.toFixed(1),
      "Adrenal‑to‑Spleen CSI Ratio": csiRatio.toFixed(2),
      Interpretation:
        siIdx >= 16.5
          ? "Suggests lipid‑rich adenoma"
          : "Non‑adenoma / lipid‑poor",
    };
  },
  refs: [
    { t: "Blake MA AJR 2012", u: "https://doi.org/10.2214/AJR.10.4547" },
    { t: "Schieda N AJR 2017", u: "https://doi.org/10.2214/AJR.16.17758" },
  ],
};
