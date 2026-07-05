const categoryDetails = {
  I: {
    term: "Benign simple cyst",
    management: "No follow-up required",
    severity: "success",
  },
  II: {
    term: "Benign cystic mass",
    management: "No follow-up required",
    severity: "success",
  },
  IIF: {
    term: "Probably benign cystic mass",
    management: "Follow-up imaging at 6 months, 12 months, then annually for 5 years",
    severity: "warning",
  },
  III: {
    term: "Indeterminate cystic mass",
    management: "Consider urology consultation",
    severity: "danger",
  },
  IV: {
    term: "Cystic mass, highly suspicious for malignancy",
    management: "Consider urology consultation",
    severity: "danger",
  },
};

const densityLabels = {
  water: "homogeneous -9 to 20 HU at noncontrast CT",
  hyperattenuating70: "homogeneous >=70 HU at noncontrast CT",
  renalMassNonenhancing:
    "homogeneous non-enhancing >20 HU at renal mass protocol CT",
  portalVenous21to30: "homogeneous 21-30 HU at portal venous phase CT",
  tooSmallLowAttenuation:
    "homogeneous low-attenuation mass too small to characterize",
  other: "not one of the v2019 benign homogeneous CT density subtypes",
};

const densityIsBosniakII = (density) =>
  [
    "hyperattenuating70",
    "renalMassNonenhancing",
    "portalVenous21to30",
    "tooSmallLowAttenuation",
  ].includes(density);

const hasRequiredInputs = (v) =>
  v.solidComponent &&
  v.wall &&
  v.septaCount &&
  (v.septaCount === "none" || v.septaThickness) &&
  v.calcifications &&
  v.density &&
  v.enhancement &&
  v.nodule;

const buildResult = (cat, rationale, extra = {}) => {
  const detail = categoryDetails[cat];
  return {
    "Bosniak Category": cat,
    "v2019 Term": detail.term,
    Management: detail.management,
    Rationale: rationale,
    "Text Module": `Bosniak Classification, version 2019: Bosniak ${cat} - ${detail.term}. ${detail.management}.`,
    ...extra,
    _severity: detail.severity,
  };
};

export const RenalCystBosniak = {
  id: "bosniak",
  category: "Radiology",
  name: "Bosniak Classification (Renal Cysts)",
  desc: "Classify cystic renal masses using Bosniak Classification, version 2019 CT criteria.",
  guidelineVersion: "Bosniak v2019",
  versionHistory: [
    {
      version: "Bosniak v2019",
      shortVersion: "v2019",
      year: 2019,
      replaces: "Bosniak 2005",
      status:
        "Bosniak v2019 is the active calculator version after physician sign-off on 2026-07-05; the retired 2005 logic is retained only as historical context.",
      summary:
        "v2019 quantifies wall and septal thickness (≤2 mm, 3 mm, ≥4 mm), counts septa, formalizes enhancement and nodule definitions, treats any calcification morphology as Class II when features remain assessable, reclassifies many homogeneous high-attenuation nonenhancing masses as Class II, and removes size ≥3 cm and intrarenal location as standalone IIF criteria.",
      whySuperseded:
        "The newer criteria replace qualitative 2005 descriptors with explicit measurements and enhancement rules, separate irregular thickening from nodules, and remove older upgrade paths that the brief identifies as unsupported standalone predictors.",
      citations: [
        {
          t: "Silverman SG et al. Radiology 2019",
          u: "https://doi.org/10.1148/radiol.2019182646",
        },
        {
          t: "Bosniak MA Radiology 2005",
          u: "https://doi.org/10.1148/radiol.2362040218",
        },
      ],
    },
  ],
  keywords: ["kidney cyst", "renal cyst", "cystic renal mass", "Bosniak"],
  tags: ["Radiology", "Urology", "Nephrology"],
  metaDesc:
    "Free Bosniak v2019 Classification Calculator for cystic renal masses. Classify cystic kidney masses (I, II, IIF, III, IV) with CT-based version 2019 criteria.",
  info: {
    text: "Bosniak Classification, version 2019 applies to cystic renal masses with less than approximately 25% enhancing tissue. Enhancement may be visually unequivocal or quantitatively confirmed at CT by a >=20 HU increase.\n\nVersion history: v2019 replaces the prior qualitative 2005 CT criteria with explicit 2/3/4 mm wall and septal thresholds, septa counts, a nodule definition, binary calcification treatment, and homogeneous HU-based Bosniak II density subtypes. Intrarenal location and size >=3 cm alone no longer upgrade a mass.\n\nUse the separate Bosniak v2019 MRI criteria when evaluating renal masses on MRI. Silverman SG, Pedrosa I, Ellis JH, et al. Radiology. 2019;292(2):475-488. DOI: 10.1148/radiol.2019182646",
  },
  fields: [
    {
      id: "solidComponent",
      label: "Enhancing solid component",
      helpText:
        "Bosniak v2019 applies only when enhancing tissue is less than approximately 25% of the mass.",
      type: "radio",
      opts: [
        { value: "under25", label: "<=25% of mass or absent" },
        { value: "over25", label: ">25% of mass" },
      ],
    },
    {
      id: "wall",
      label: "Wall thickness / morphology",
      helpText:
        "Thin <=2 mm, minimally thickened 3 mm, thick >=4 mm; irregular means <=3 mm obtuse convex protrusion.",
      type: "radio",
      opts: [
        { value: "thin", label: "thin (<=2 mm), smooth" },
        { value: "minimallyThick", label: "smooth minimally thickened (3 mm)" },
        { value: "thick", label: "smooth thickened (>=4 mm)" },
        {
          value: "irregular",
          label: "irregular wall (<=3 mm obtuse convex protrusion)",
        },
      ],
    },
    {
      id: "septaCount",
      label: "Septa count",
      helpText: "v2019 defines few as 1-3 septa and many as >=4 septa.",
      type: "radio",
      opts: [
        { value: "none", label: "none" },
        { value: "few", label: "few (1-3)" },
        { value: "many", label: "many (>=4)" },
      ],
    },
    {
      id: "septaThickness",
      label: "Septal thickness / morphology",
      helpText:
        "Choose the most suspicious septal feature when septa are present.",
      type: "radio",
      showIf: (v) => v.septaCount && v.septaCount !== "none",
      opts: [
        { value: "thin", label: "thin (<=2 mm), smooth" },
        { value: "minimallyThick", label: "smooth minimally thickened (3 mm)" },
        { value: "thick", label: "smooth thickened (>=4 mm)" },
        {
          value: "irregular",
          label: "irregular septum (<=3 mm obtuse convex protrusion)",
        },
      ],
    },
    {
      id: "nodule",
      label: "Enhancing nodule morphology",
      helpText:
        "v2019 defines a nodule as >=4 mm with obtuse margins or any size with acute margins.",
      type: "radio",
      opts: [
        { value: "none", label: "none" },
        { value: "obtuse4", label: ">=4 mm convex protrusion, obtuse margins" },
        { value: "acuteAny", label: "any size convex protrusion, acute margins" },
      ],
    },
    {
      id: "calcifications",
      label: "Calcifications",
      helpText:
        "In v2019, any calcification morphology is Bosniak II if other features are assessable.",
      type: "radio",
      opts: [
        { value: "absent", label: "absent" },
        { value: "present", label: "present, features still assessable" },
      ],
    },
    {
      id: "density",
      label: "Homogeneous CT density subtype",
      type: "radio",
      opts: [
        { value: "water", label: "-9 to 20 HU at noncontrast CT" },
        { value: "hyperattenuating70", label: ">=70 HU at noncontrast CT" },
        {
          value: "renalMassNonenhancing",
          label: "non-enhancing >20 HU at renal mass protocol CT",
        },
        { value: "portalVenous21to30", label: "21-30 HU at portal venous CT" },
        {
          value: "tooSmallLowAttenuation",
          label: "low attenuation, too small to characterize",
        },
        { value: "other", label: "other / not a benign HU subtype" },
      ],
    },
    {
      id: "enhancement",
      label: "Wall, septal, or nodule enhancement",
      helpText:
        "Enhancement is visually unequivocal or CT >=20 HU increase from noncontrast to contrast-enhanced phases.",
      type: "radio",
      opts: [
        { value: "absent", label: "absent / not confirmed" },
        { value: "present", label: "present" },
      ],
    },
  ],
  compute: (v) => {
    if (!hasRequiredInputs(v)) {
      return {
        Error:
          "Complete the solid-component gate, wall, septa, calcification, density, enhancement, and nodule fields before applying Bosniak v2019.",
        _severity: "error",
      };
    }

    if (v.solidComponent === "over25") {
      return {
        "Bosniak Category": "Not applicable",
        "v2019 Term": "Not a Bosniak-classifiable cystic renal mass",
        Management:
          "Evaluate as a solid renal mass with cystic or necrotic change; Bosniak v2019 is not intended for masses with >25% enhancing solid tissue.",
        Rationale:
          "Bosniak v2019 defines cystic renal masses as having less than approximately 25% enhancing tissue.",
        "Text Module":
          "Bosniak Classification, version 2019 not applied: more than 25% of the mass is enhancing solid tissue.",
        _severity: "warning",
      };
    }

    const enhancing = v.enhancement === "present";
    const septaPresent = v.septaCount !== "none";
    const thinFewSepta =
      v.septaCount === "few" && v.septaThickness === "thin";
    const thinManySepta =
      v.septaCount === "many" && v.septaThickness === "thin";
    const minimallyThickSepta =
      septaPresent && v.septaThickness === "minimallyThick";
    const thickOrIrregularSepta =
      septaPresent &&
      (v.septaThickness === "thick" || v.septaThickness === "irregular");
    const benignIIByDensity = densityIsBosniakII(v.density);
    const simpleWaterMass =
      v.wall === "thin" &&
      v.septaCount === "none" &&
      v.calcifications === "absent" &&
      v.density === "water" &&
      v.nodule === "none";

    if (enhancing && v.nodule !== "none") {
      return buildResult(
        "IV",
        v.nodule === "acuteAny"
          ? "Enhancing nodule with acute margins meets Bosniak v2019 IV criteria."
          : "Enhancing >=4 mm convex protrusion with obtuse margins meets Bosniak v2019 IV criteria.",
      );
    }

    if (enhancing && (v.wall === "thick" || v.wall === "irregular" || thickOrIrregularSepta)) {
      return buildResult(
        "III",
        "Enhancing thick (>=4 mm) or irregular wall/septa meet Bosniak v2019 III criteria when no enhancing nodule is present.",
      );
    }

    if (
      enhancing &&
      (v.wall === "minimallyThick" || minimallyThickSepta || thinManySepta)
    ) {
      return buildResult(
        "IIF",
        "Enhancing 3 mm smooth wall/septa or many (>=4) thin enhancing septa meet Bosniak v2019 IIF criteria.",
      );
    }

    if (simpleWaterMass) {
      return buildResult(
        "I",
        "Well-defined homogeneous simple fluid (-9 to 20 HU) mass with thin wall, no septa, no calcification, and no nodule.",
      );
    }

    if (
      thinFewSepta ||
      thinManySepta ||
      v.calcifications === "present" ||
      benignIIByDensity
    ) {
      const reasons = [];
      if (thinFewSepta) reasons.push("few (1-3) thin septa");
      if (thinManySepta && !enhancing)
        reasons.push("many thin septa without confirmed enhancement");
      if (v.calcifications === "present")
        reasons.push("calcification of any morphology");
      if (benignIIByDensity) reasons.push(densityLabels[v.density]);

      return buildResult(
        "II",
        `${reasons.join("; ")} fit Bosniak v2019 II when higher-risk enhancing features are absent.`,
      );
    }

    return {
      "Bosniak Category": "Not assigned",
      "v2019 Term": "Incomplete CT characterization",
      Management:
        "Obtain or review renal mass protocol CT/MRI features before assigning a Bosniak v2019 class.",
      Rationale:
        "The selected inputs do not match a benign homogeneous density subtype or enhancing wall/septal/nodule criterion.",
      "Text Module":
        "Bosniak Classification, version 2019 not assigned: CT features are insufficiently characterized.",
      _severity: "warning",
    };
  },
  refs: [
    {
      t: "Silverman SG, Pedrosa I, Ellis JH, et al. Bosniak Classification of Cystic Renal Masses, Version 2019. Radiology. 2019;292(2):475-488.",
      u: "https://doi.org/10.1148/radiol.2019182646",
    },
    {
      t: "Bosniak MA Radiology 2005",
      u: "https://doi.org/10.1148/radiol.2362040218",
    },
  ],
};
