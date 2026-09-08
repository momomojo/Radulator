function finiteMeasurement(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (typeof value !== "string") return NaN;
  const text = value.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return NaN;
  const number = Number(text);
  return Number.isFinite(number) ? number : NaN;
}

export const AdrenalMRICSI = {
  id: "adrenal-mri",
  category: "Radiology",
  name: "Adrenal MRI Chemical Shift",
  desc: "Signal‑intensity index and adrenal‑to‑spleen CSI ratio.",
  keywords: [
    "adrenal mass",
    "chemical shift",
    "signal intensity",
    "adenoma",
    "lipid",
  ],
  tags: ["Radiology", "Adrenal", "Endocrinology"],
  metaDesc:
    "Free Adrenal MRI Chemical Shift Index Calculator. Calculate signal intensity index and adrenal-to-spleen CSI ratio to characterize adrenal lesions. Differentiate lipid-rich adenomas.",
  info: {
    text:
      "Adrenal MRI chemical-shift imaging helps characterize adrenal lesions by detecting intracellular lipid signal loss on opposed-phase images.\n\n" +
      "Enter magnitude-image ROI signal intensities, not signed phase, real/imaginary, or background-subtracted values. Use technically adequate matched ROIs; defined arithmetic does not establish reliable interpretation of near-zero or noisy signals.\n\n" +
      "Key Points:\n" +
      "• Signal-intensity index compares adrenal in-phase and opposed-phase signal\n" +
      "• Adrenal-to-spleen CSI ratio normalizes adrenal signal change to splenic signal\n" +
      "• Signal-intensity index ≥16.5% supports a lipid-rich adenoma pattern\n" +
      "• Lipid-poor adenomas, metastases, hemorrhage, and technical factors can overlap\n\n" +
      "Use with the full MRI appearance, lesion size, prior imaging, oncologic history, and local adrenal-incidentaloma guidance.",
  },
  fields: [
    { id: "a_ip", label: "Adrenal SI in‑phase", type: "number", required: true },
    { id: "a_op", label: "Adrenal SI opposed‑phase", type: "number", required: true },
    { id: "s_ip", label: "Spleen SI in‑phase", type: "number", required: true },
    { id: "s_op", label: "Spleen SI opposed‑phase", type: "number", required: true },
  ],
  compute: (inputs = {}) => {
    const a_ip = finiteMeasurement(inputs.a_ip);
    const a_op = finiteMeasurement(inputs.a_op);
    const s_ip = finiteMeasurement(inputs.s_ip);
    const s_op = finiteMeasurement(inputs.s_op);
    if (![a_ip, a_op, s_ip, s_op].every(Number.isFinite)) {
      return { Error: "Enter all four signal-intensity measurements as finite numbers." };
    }
    if (a_ip <= 0 || s_ip <= 0 || s_op <= 0 || a_op < 0) {
      return { Error: "In-phase adrenal and splenic signals and opposed-phase splenic signal must be above zero; opposed-phase adrenal signal cannot be negative." };
    }
    const siIdx = ((a_ip - a_op) / a_ip) * 100;
    const opposedRatio = a_op / s_op;
    const inPhaseRatio = a_ip / s_ip;
    const csiRatio = opposedRatio / inPhaseRatio;
    if (![siIdx, opposedRatio, inPhaseRatio, csiRatio].every(Number.isFinite) || inPhaseRatio === 0) {
      return { Error: "These measurements do not produce finite chemical-shift ratios. Check the entered values." };
    }
    const result = {
      "Signal Intensity Index (%)": siIdx.toFixed(1),
      "Adrenal‑to‑Spleen CSI Ratio": csiRatio.toFixed(2),
      Interpretation:
        siIdx >= 16.5
          ? "Suggests lipid‑rich adenoma"
          : "Non‑adenoma / lipid‑poor",
    };
    result._severity = siIdx >= 16.5 ? "success" : "warning";
    return result;
  },
  refs: [
    { t: "Blake MA AJR 2012", u: "https://doi.org/10.2214/AJR.10.4547" },
    { t: "Schieda N AJR 2017", u: "https://doi.org/10.2214/AJR.16.17758" },
  ],
};
