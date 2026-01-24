export const SpleenSizeULN = {
  id: "spleen-size",
  name: "Spleen Size",
  desc: "Gender- and height-adjusted upper limits of normal spleen length and volume",
  metaDesc:
    "Free Spleen Size Calculator. Calculate gender and height-adjusted upper limits of normal for spleen length and volume. Based on Chow et al. 2016 study.",
  info: {
    text: "The formula was validated for women between 155 and 180 cm and men between 165 and 200 cm body height.\n\nThe spleen volume was derived from ultrasound measurements using the ellipsoid formula. You can use the prostate volume calculator for volume estimation.",
  },
  fields: [
    {
      id: "gender",
      label: "Gender",
      type: "radio",
      opts: [
        { value: "female", label: "female" },
        { value: "male", label: "male" },
      ],
    },
    { id: "height", label: "Body Height (cm)", type: "number" },
  ],
  compute: ({ gender, height = 0 }) => {
    const h = parseFloat(height);
    if (!h || !gender) return {};

    let spleenLength, spleenVolume;

    // Apply the correct formulas based on the Chow et al. 2016 study
    if (gender === "female") {
      // Female formulas (validated for 155-180 cm)
      spleenLength = 0.0282 * h + 7.5526;
      spleenVolume = 7.0996 * h - 939.5;
    } else {
      // Male formulas (validated for 165-200 cm)
      spleenLength = 0.0544 * h + 3.6693;
      spleenVolume = 4.3803 * h - 457.15;
    }

    // Check if height is within validated range
    const validRange =
      gender === "female" ? h >= 155 && h <= 180 : h >= 165 && h <= 200;

    const result = {
      "Spleen length should not exceed (cm)": spleenLength.toFixed(1),
      "Spleen volume should not exceed (cm³)":
        Math.round(spleenVolume).toString(),
    };

    if (validRange) {
      result["Interpretation"] =
        "The above mentioned spleen size and volume are within 95% of observations in healthy individuals.";
    } else {
      const range = gender === "female" ? "155-180 cm" : "165-200 cm";
      result["Warning"] =
        `Height outside validated range (${range}). Results may be less accurate.`;
      result["Interpretation"] =
        "The above mentioned spleen size and volume are within 95% of observations in healthy individuals (extrapolated beyond validated range).";
    }

    return result;
  },
  refs: [
    {
      t: "Chow KU, Luxembourg B, Seifried E, et al. Spleen Size Is Significantly Influenced by Body Height and Sex: Establishment of Normal Values for Spleen Size at US with a Cohort of 1200 Healthy Individuals. Radiology. 2016 Apr;279(1):306-13. DOI: 10.1148/radiol.2015150887",
      u: "https://doi.org/10.1148/radiol.2015150887",
    },
  ],
};
