export const ProstateVolume = {
  id: "prostate-volume",
  category: "Radiology",
  name: "Prostate Volume",
  desc: "Ellipsoid volume estimation (MRI/US) and PSA‑Density.",
  keywords: ["prostate size", "PSA density", "PSAD", "BPH", "ellipsoid"],
  metaDesc:
    "Free Prostate Volume and PSA Density Calculator. Calculate prostate volume using ellipsoid formula from MRI/ultrasound measurements. Includes PSA density calculation.",
  info: {
    text: "Calculation by using the ellipsoid formula (length × width × height × π/6). π/6 is rounded to 0.52.\n\nUniversal PSA-Density cut-off values are not yet established. Suggested thresholds range roughly from 0.08 to 0.15 depending on clinical context.",
    link: {
      label: "PI-RADS Sector Map",
      url: "./pirads_map_clone.html",
    },
  },
  fields: [
    { id: "length", label: "Length (craniocaudal, cm):", type: "number" },
    { id: "height", label: "Height (anteroposterior, cm):", type: "number" },
    { id: "width", label: "Width (transverse, cm):", type: "number" },
    { id: "psa", label: "PSA (ng/mL):", type: "number" },
  ],
  compute: ({ length = 0, height = 0, width = 0, psa = 0 }) => {
    const volume = length * height * width * 0.52;
    const density = psa && volume ? psa / volume : null;
    return {
      "Prostate Volume (mL)": volume.toFixed(1),
      "PSA‑Density": density ? density.toFixed(3) : "‑‑",
    };
  },
  refs: [
    { t: "Paterson NR CUAJ 2016", u: "https://doi.org/10.5489/cuaj.3236" },
    {
      t: "Aminsharifi A J Urol 2018",
      u: "https://doi.org/10.1016/j.juro.2018.05.016",
    },
  ],
};
