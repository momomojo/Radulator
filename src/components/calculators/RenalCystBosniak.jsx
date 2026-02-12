export const RenalCystBosniak = {
  id: "bosniak",
  category: "Radiology",
  name: "Bosniak Classification (Renal Cysts)",
  desc: "Classify cystic renal lesions per Bosniak criteria (CT 2005).",
  keywords: ["kidney cyst", "renal cyst", "cystic renal mass", "Bosniak"],
  tags: ["Radiology", "Urology", "Nephrology"],
  metaDesc:
    "Free Bosniak Classification Calculator for cystic renal masses. Classify kidney cysts (I, II, IIF, III, IV) based on CT imaging features. Evidence-based management recommendations.",
  info: {
    text: "A homogeneous mass ≥ 70 HU at unenhanced CT is consistent with a high-attenuation renal cyst.\n\nNote: Use Bosniak MR criteria if evaluating renal masses on MRI. Radiology 2019 Aug;292(2):441-48. DOI: 10.1148/radiol.2019182646\n\nSilverman SG. Management of the incidental renal mass at CT: Single institution experience. From renal cell carcinoma to fat-poor angiomyolipoma to renal cyst. Radiology. 2007; Nov;245(2):331-38. DOI: 10.1148/radiol.2452061879",
  },
  fields: [
    {
      id: "walls",
      label: "Walls",
      type: "radio",
      opts: [
        { value: "hairline-thin", label: "hairline thin" },
        {
          value: "minimally-thick",
          label: "minimally thick, smooth, minimal enhancement possible",
        },
        { value: "thick-irregular", label: "thickened, irregular, enhancing" },
      ],
    },
    {
      id: "septa",
      label: "Septa",
      type: "radio",
      opts: [
        { value: "no", label: "no" },
        { value: "few-thin", label: "few, hairline thin, in enhancement" },
        {
          value: "thick",
          label: "thick, minimally thickened, minimal enhancement possible",
        },
        {
          value: "thickened-irregular",
          label: "thickened, irregular, enhancing",
        },
      ],
    },
    {
      id: "calcs",
      label: "Calcifications",
      type: "radio",
      opts: [
        { value: "no", label: "no" },
        { value: "fine", label: "fine or sheet segment (lightly thickened)" },
        { value: "thick-nodular", label: "thick or nodular" },
      ],
    },
    {
      id: "density",
      label: "Density",
      type: "radio",
      opts: [
        { value: "water", label: "water density" },
        { value: "high", label: "high attenuation (> 20 HU)" },
      ],
    },
    {
      id: "intrarenal",
      label: "Totally intrarenal (n/a)",
      type: "checkbox",
      subFields: [
        {
          id: "intrarenal_no",
          label: "no",
          type: "radio",
          name: "intrarenal_sub",
        },
        {
          id: "intrarenal_yes",
          label: "yes",
          type: "radio",
          name: "intrarenal_sub",
        },
      ],
    },
    {
      id: "large",
      label: "3cm or larger (n/a)",
      type: "checkbox",
      subFields: [
        { id: "large_no", label: "no", type: "radio", name: "large_sub" },
        { id: "large_yes", label: "yes", type: "radio", name: "large_sub" },
      ],
    },
    {
      id: "soft",
      label: "Enhancing soft-tissue component",
      type: "radio",
      opts: [
        { value: "no", label: "no" },
        { value: "yes", label: "yes" },
      ],
    },
  ],
  compute: (v) => {
    const { walls, septa, calcs, density, soft, intrarenal, large } = v;

    let cat = "I";
    let description = "Simple, benign cyst - No follow up needed";

    // Category IV - Malignant
    if (soft === "yes") {
      cat = "IV";
      description = "Clearly malignant cystic mass - Surgical resection";
    }
    // Category III - Indeterminate
    else if (
      walls === "thick-irregular" ||
      septa === "thickened-irregular" ||
      calcs === "thick-nodular"
    ) {
      cat = "III";
      description = "Indeterminate cystic mass - Surgical resection";
    }
    // Category IIF - Minimally complex
    else if (
      walls === "minimally-thick" ||
      septa === "thick" ||
      density === "high" ||
      intrarenal ||
      large
    ) {
      cat = "IIF";
      description = "Minimally complex - Follow up recommended";
    }
    // Category II - Minimally complex
    else if (
      walls !== "hairline-thin" ||
      septa === "few-thin" ||
      calcs === "fine"
    ) {
      cat = "II";
      description = "Minimally complex benign cyst - No follow up needed";
    }

    const result = {
      "Bosniak Category": cat,
      Management: description,
    };

    // Add text modules section
    if (cat === "I") {
      result["Text Module"] =
        "Cystic Lesion: Well-thin Septa (s). Calcifications (s). Water density.\nBosniak category I.\nSimple, benign cyst - No follow up needed";
    }

    result._severity =
      cat === "I" || cat === "II"
        ? "success"
        : cat === "IIF"
          ? "warning"
          : "danger";

    return result;
  },
  refs: [
    {
      t: "Bosniak MA Radiology 2005",
      u: "https://doi.org/10.1148/radiol.2362040218",
    },
    {
      t: "Silverman SG Radiology 2019",
      u: "https://doi.org/10.1148/radiol.2019182646",
    },
  ],
};
