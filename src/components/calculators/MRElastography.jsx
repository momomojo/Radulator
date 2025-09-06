export const MRElastography = {
  id: "mr-elastography",
  name: "MR Elastography (Liver)",
  desc: "Area-weighted mean liver stiffness across ROIs/slices.",
  info: {
    text: "Compute the area-weighted mean liver stiffness across ROIs/slices: Σ(Mi·Ai) / ΣAi.\n\nEnter stiffness in kPa and ROI area in cm² (or pixels² consistently).\n\nUse consistent ROIs: avoid vessels, wave interference, and 'hot' edges; rely on the confidence map where available.\n\nInterpretation depends on sequence, driver frequency (commonly 60 Hz), and underlying disease etiology; correlate with labs and imaging.\n\nWhen mixing ROIs of different sizes, area-weighting improves representativeness versus a simple mean.\n\nNote: Fibrosis cutoffs vary by etiology, vendor, sequence, and frequency. These are typical 60 Hz GRE ranges—always correlate clinically.",
  },
  fields: [
    { 
      id: "frequency", 
      label: "Driver frequency (Hz)", 
      type: "select", 
      opts: ["40", "50", "60", "90", "Other"],
      subLabel: "60 Hz most common"
    },
    { id: "frequency_other", label: "Custom frequency (Hz)", type: "number", subLabel: "Use if 'Other'" },
    { id: "roi1_kpa", label: "ROI 1 - Stiffness (kPa)", type: "number", subLabel: "e.g., 2.8" },
    { id: "roi1_area", label: "ROI 1 - Area (cm²)", type: "number", subLabel: "e.g., 50.0" },
    { id: "roi2_kpa", label: "ROI 2 - Stiffness (kPa)", type: "number", subLabel: "e.g., 2.8" },
    { id: "roi2_area", label: "ROI 2 - Area (cm²)", type: "number", subLabel: "e.g., 50.0" },
    { id: "roi3_kpa", label: "ROI 3 - Stiffness (kPa)", type: "number", subLabel: "e.g., 2.8" },
    { id: "roi3_area", label: "ROI 3 - Area (cm²)", type: "number", subLabel: "e.g., 50.0" },
    { id: "roi4_kpa", label: "ROI 4 - Stiffness (kPa)", type: "number", subLabel: "e.g., 2.8" },
    { id: "roi4_area", label: "ROI 4 - Area (cm²)", type: "number", subLabel: "e.g., 50.0" },
    { id: "roi_csv", label: "Paste ROI CSV (kPa,Area per line)", type: "textarea", subLabel: "Example: 2.8, 50" },
  ],
  compute: ({ 
    roi1_kpa = "", roi1_area = "",
    roi2_kpa = "", roi2_area = "",
    roi3_kpa = "", roi3_area = "",
    roi4_kpa = "", roi4_area = "",
    roi_csv = "",
    frequency = "60",
    frequency_other = ""
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
    ].filter(r => Number.isFinite(r.kpa) && Number.isFinite(r.area) && r.area > 0);

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
      .filter(r => Number.isFinite(r.kpa) && Number.isFinite(r.area) && r.area > 0);

    const rois = [...roisFromFields, ...roisFromCsv];

    // Safety checks
    if (rois.length === 0) {
      return {
        "Total Area (cm²)": "—",
        "Area-weighted Mean (kPa)": "—",
        "Interpretation": "Enter at least one valid ROI with stiffness > 0 and area > 0",
        "ROIs Used": "0 valid ROIs",
        "Formula": "Σ(Mi·Ai) / ΣAi"
      };
    }

    // Calculate area-weighted mean with zero-division protection
    const totalArea = rois.reduce((sum, r) => sum + r.area, 0);
    const weightedMean = totalArea > 0 
      ? rois.reduce((sum, r) => sum + (r.kpa * r.area), 0) / totalArea 
      : NaN;

    // Frequency-specific interpretation bins (typical ranges)
    function interpret(kpa, freq) {
      if (!Number.isFinite(kpa)) return "—";
      // Adjust cutoffs slightly based on frequency (very rough approximation)
      const freqNum = Number(freq);
      const approx = (a, b) => Math.abs(a - b) < 1;
      const freqFactor = approx(freqNum, 40) ? 0.9 : approx(freqNum, 50) ? 0.95 : approx(freqNum, 90) ? 1.1 : 1.0;
      const adjustedKpa = kpa / freqFactor;
      
      if (adjustedKpa < 2.5) return "Within normal limits (no significant fibrosis suspected)";
      if (adjustedKpa < 3.0) return "Borderline—repeatable mild elevation";
      if (adjustedKpa < 3.6) return "≥F2 fibrosis likely";
      if (adjustedKpa < 4.0) return "Advanced fibrosis (≥F3) likely";
      return "Cirrhosis (F4) likely";
    }

    const effFrequency = (String(frequency) === "Other" && frequency_other) ? String(frequency_other) : String(frequency);
    const interpretation = interpret(weightedMean, effFrequency);

    return {
      "Total Area (cm²)": totalArea.toFixed(2),
      "Area-weighted Mean (kPa)": Number.isFinite(weightedMean) ? weightedMean.toFixed(2) : "—",
      "Interpretation": interpretation,
      "ROIs Used": `${rois.length} valid ROI${rois.length !== 1 ? 's' : ''}`,
      "Frequency": `${effFrequency} Hz`,
      "Formula": "Σ(Mi·Ai) / ΣAi",
      "Notes": "Cutoffs vary by etiology, vendor, sequence, and frequency; correlate clinically"
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