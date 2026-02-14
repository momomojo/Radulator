export const MRElastography = {
  id: "mr-elastography",
  category: "Hepatology/Liver",
  name: "MR Elastography (Liver)",
  desc: "Area-weighted mean liver stiffness across ROIs/slices.",
  guidelineVersion: "MRE Consensus (Manduca 2020)",
  keywords: ["liver stiffness", "fibrosis", "cirrhosis", "MRE", "elastography"],
  tags: ["Hepatology", "Radiology"],
  metaDesc:
    "Free MR Elastography Calculator for liver fibrosis staging. Calculate area-weighted mean liver stiffness from multiple ROIs. Supports CSV input and fibrosis interpretation.",
  info: {
    text: "MR Elastography (Liver) – Quick Start\n\nGoal: Compute the area-weighted mean liver stiffness across ROIs/slices using Σ(Mi·Ai) / ΣAi.\n\nHow to use:\n1) Select driver frequency (60 Hz is most common for GRE).\n2) Enter ROI stiffness (kPa) and ROI area (cm²) in the fields provided.\n   - You can also paste multiple rows via the CSV box (format: kPa,Area per line).\n   - Or add rows below in the Dynamic ROIs table.\n3) Click Calculate. The tool displays total area, weighted mean (kPa), and an interpretation.\n\nCSV example:\n2.8, 50\n3.2, 45\n3.6, 40\n\nTechnique & interpretation notes:\n• Use consistent ROIs; avoid vessels, wave interference, and hot edges; prefer confidence maps when available.\n• Interpretation depends on sequence, frequency, vendor, and disease etiology; always correlate clinically.\n• Typical 60 Hz GRE ranges (institutional variations exist): <2.5 normal; 2.5–3.0 borderline; 3.0–3.6 ≥F2; 3.6–4.0 ≥F3; ≥4.0 cirrhosis likely.",
    link: {
      label: "Consensus guidance (Manduca 2020)",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8495610/",
    },
  },
  fields: [
    {
      id: "frequency",
      label: "Driver frequency (Hz)",
      type: "select",
      opts: ["40", "50", "60", "90", "Other"],
      subLabel: "60 Hz most common",
    },
    {
      id: "frequency_other",
      label: "Custom frequency (Hz)",
      type: "number",
      subLabel: "Use if 'Other'",
    },
    {
      id: "roi1_kpa",
      label: "ROI 1 - Stiffness (kPa)",
      type: "number",
      subLabel: "e.g., 2.8",
    },
    {
      id: "roi1_area",
      label: "ROI 1 - Area (cm²)",
      type: "number",
      subLabel: "e.g., 50.0",
    },
    {
      id: "roi2_kpa",
      label: "ROI 2 - Stiffness (kPa)",
      type: "number",
      subLabel: "e.g., 2.8",
    },
    {
      id: "roi2_area",
      label: "ROI 2 - Area (cm²)",
      type: "number",
      subLabel: "e.g., 50.0",
    },
    {
      id: "roi3_kpa",
      label: "ROI 3 - Stiffness (kPa)",
      type: "number",
      subLabel: "e.g., 2.8",
    },
    {
      id: "roi3_area",
      label: "ROI 3 - Area (cm²)",
      type: "number",
      subLabel: "e.g., 50.0",
    },
    {
      id: "roi4_kpa",
      label: "ROI 4 - Stiffness (kPa)",
      type: "number",
      subLabel: "e.g., 2.8",
    },
    {
      id: "roi4_area",
      label: "ROI 4 - Area (cm²)",
      type: "number",
      subLabel: "e.g., 50.0",
    },
    {
      id: "roi_csv",
      label: "Paste ROI CSV (kPa,Area per line)",
      type: "textarea",
      subLabel: "Example: 2.8, 50",
    },
  ],
  compute: ({
    roi1_kpa = "",
    roi1_area = "",
    roi2_kpa = "",
    roi2_area = "",
    roi3_kpa = "",
    roi3_area = "",
    roi4_kpa = "",
    roi4_area = "",
    roi_csv = "",
    frequency = "60",
    frequency_other = "",
    roi_rows = [],
  }) => {
    // Parse and filter valid ROIs with robust input handling
    const parseValue = (val) => {
      if (!val || val === "") return NaN;
      const parsed = parseFloat(String(val).replace(",", "."));
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN;
    };

    // From individual ROI fields
    const roisFromFields = [
      { kpa: parseValue(roi1_kpa), area: parseValue(roi1_area) },
      { kpa: parseValue(roi2_kpa), area: parseValue(roi2_area) },
      { kpa: parseValue(roi3_kpa), area: parseValue(roi3_area) },
      { kpa: parseValue(roi4_kpa), area: parseValue(roi4_area) },
    ].filter(
      (r) => Number.isFinite(r.kpa) && Number.isFinite(r.area) && r.area > 0,
    );

    // From CSV textarea (kpa,area per line)
    const roisFromCsv = String(roi_csv || "")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const parts = line.split(/[;,\s]+/).filter(Boolean);
        const kpa = parseValue(parts[0]);
        const area = parseValue(parts[1]);
        return { kpa, area };
      })
      .filter(
        (r) => Number.isFinite(r.kpa) && Number.isFinite(r.area) && r.area > 0,
      );

    // From dynamic rows array
    const roisFromRows = Array.isArray(roi_rows)
      ? roi_rows
          .map((r) => ({ kpa: parseValue(r?.kpa), area: parseValue(r?.area) }))
          .filter(
            (r) =>
              Number.isFinite(r.kpa) && Number.isFinite(r.area) && r.area > 0,
          )
      : [];

    const rois = [...roisFromFields, ...roisFromCsv, ...roisFromRows];

    // Safety checks
    if (rois.length === 0) {
      return {
        "Total Area (cm²)": "—",
        "Area-weighted Mean (kPa)": "—",
        Interpretation:
          "Enter at least one valid ROI with stiffness > 0 and area > 0",
        "ROIs Used": "0 valid ROIs",
        Formula: "Σ(Mi·Ai) / ΣAi",
      };
    }

    // Calculate area-weighted mean with zero-division protection
    const totalArea = rois.reduce((sum, r) => sum + r.area, 0);
    const weightedMean =
      totalArea > 0
        ? rois.reduce((sum, r) => sum + r.kpa * r.area, 0) / totalArea
        : NaN;

    // Frequency-specific interpretation bins (typical ranges)
    function interpret(kpa, freq) {
      if (!Number.isFinite(kpa)) return "—";
      // Adjust cutoffs slightly based on frequency (very rough approximation)
      const freqNum = Number(freq);
      const approx = (a, b) => Math.abs(a - b) < 1;
      const freqFactor = approx(freqNum, 40)
        ? 0.9
        : approx(freqNum, 50)
          ? 0.95
          : approx(freqNum, 90)
            ? 1.1
            : 1.0;
      const adjustedKpa = kpa / freqFactor;

      if (adjustedKpa < 2.5)
        return "Within normal limits (no significant fibrosis suspected)";
      if (adjustedKpa < 3.0) return "Borderline—repeatable mild elevation";
      if (adjustedKpa < 3.6) return "≥F2 fibrosis likely";
      if (adjustedKpa < 4.0) return "Advanced fibrosis (≥F3) likely";
      return "Cirrhosis (F4) likely";
    }

    const effFrequency =
      String(frequency) === "Other" && frequency_other
        ? String(frequency_other)
        : String(frequency);
    const interpretation = interpret(weightedMean, effFrequency);

    return {
      "Total Area (cm²)": totalArea.toFixed(2),
      "Area-weighted Mean (kPa)": Number.isFinite(weightedMean)
        ? weightedMean.toFixed(2)
        : "—",
      "Area-weighted Mean Raw (kPa)": Number.isFinite(weightedMean)
        ? String(weightedMean)
        : "",
      Interpretation: interpretation,
      "ROIs Used": `${rois.length} valid ROI${rois.length !== 1 ? "s" : ""}`,
      Frequency: `${effFrequency} Hz`,
      Formula: "Σ(Mi·Ai) / ΣAi",
      Notes:
        "Cutoffs vary by etiology, vendor, sequence, and frequency; correlate clinically",
    };
  },
  refs: [
    {
      t: "Manduca et al., MRE: Principles, guidelines, and terminology, 2020",
      u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8495610/",
    },
    {
      t: "Mariappan et al., MAGNETIC RESONANCE ELASTOGRAPHY: A REVIEW, 2010",
      u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3066083/",
    },
    {
      t: "Resoundant: clinical overview & practical tips",
      u: "https://www.resoundant.com/radiology",
    },
  ],
};
