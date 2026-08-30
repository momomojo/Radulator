const categoryDetails = {
  I: {
    term: "Benign simple cyst",
    management: "No follow-up required",
    severity: "success",
  },
  II: {
    term: "Benign Bosniak II renal cyst",
    management: "No follow-up required",
    severity: "success",
  },
  IIF: {
    term: "Probably benign cystic mass",
    management:
      "CUA 2023 suggests imaging every 6-12 months during the first year, then yearly if stable; for cysts without progression, 5 years of follow-up is suggested. The interval is based on expert opinion and the 5-year duration is a conditional recommendation with very low certainty; tailor surveillance to patient factors and specialist guidance",
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
  water: "fully characterized homogeneous simple fluid at renal mass protocol CT",
  noncontrastMinus9To20: "homogeneous -9 to 20 HU at noncontrast CT",
  hyperattenuating70: "homogeneous >=70 HU at noncontrast CT",
  renalMassNonenhancing:
    "homogeneous non-enhancing >20 HU at renal mass protocol CT",
  portalVenous21to30: "homogeneous 21-30 HU at portal venous phase CT",
  tooSmallLowAttenuation:
    "homogeneous low-attenuation mass too small to characterize",
  heterogeneousOrIncomplete:
    "heterogeneous or otherwise incompletely characterized internal attenuation at CT",
  otherCharacterized:
    "fully characterized cystic attenuation outside a benign density-only subtype",
};

const densityIsBosniakII = (density) =>
  [
    "hyperattenuating70",
    "renalMassNonenhancing",
    "portalVenous21to30",
    "tooSmallLowAttenuation",
    "noncontrastMinus9To20",
  ].includes(density);

const hasRequiredInputs = (v) =>
  v.scopeEligibility &&
  v.solidComponent &&
  v.wellDefined &&
  v.wall &&
  v.wallEnhancement &&
  v.septaCount &&
  (v.septaCount === "none" ||
    (v.septaThickness && v.septaEnhancement)) &&
  v.calcifications &&
  v.density &&
  (v.density !== "hyperattenuating70" || v.hyperattenuatingSize) &&
  v.nodule &&
  (v.nodule === "none" || v.noduleEnhancement);

const buildResult = (cat, rationale, extra = {}) => {
  const detail = categoryDetails[cat];
  const { term = detail.term, ...resultExtra } = extra;
  return {
    "Bosniak Category": cat,
    "v2019 Term": term,
    Management: detail.management,
    Rationale: rationale,
    "Text Module": `Bosniak Classification, version 2019: Bosniak ${cat} - ${term}. ${detail.management}.`,
    ...resultExtra,
    _severity: detail.severity,
  };
};

const buildUnassignedResult = (rationale) => ({
  "Bosniak Category": "Not assigned",
  "v2019 Term": "Incomplete CT characterization",
  Management:
    "Obtain or review renal mass protocol MRI features before assigning a Bosniak v2019 class.",
  Rationale: rationale,
  "Text Module":
    "Bosniak Classification, version 2019 not assigned: CT features are insufficiently characterized; renal mass protocol MRI may reveal occult enhancement.",
  _severity: "warning",
});

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
        "Bosniak v2019 is the active calculator version; the retired 2005 logic is retained only as historical context.",
      summary:
        "v2019 quantifies wall and septal thickness (≤2 mm, 3 mm, ≥4 mm), counts septa, formalizes enhancement and nodule definitions, allows any calcification morphology in Class II only when the mass remains well defined with a thin smooth wall, reclassifies many homogeneous high-attenuation nonenhancing masses as Class II, and removes size ≥3 cm and intrarenal location as standalone IIF criteria.",
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
        {
          t: "Richard PO et al. Canadian Urological Association guideline 2023",
          u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10263289/",
        },
      ],
    },
  ],
  keywords: ["kidney cyst", "renal cyst", "cystic renal mass", "Bosniak"],
  tags: ["Radiology", "Urology", "Nephrology"],
  metaDesc:
    "Free Bosniak v2019 Classification Calculator for cystic renal masses. Classify cystic kidney masses (I, II, IIF, III, IV) with CT-based version 2019 criteria.",
  info: {
    text: "Bosniak Classification, version 2019 applies to cystic renal masses with less than approximately 25% enhancing tissue after infectious, inflammatory, or vascular etiologies and necrotic solid masses are excluded. Its suggested reporting content is intended for the general population, not patients with a known or suspected renal cell carcinoma syndrome such as von Hippel-Lindau syndrome or hereditary leiomyomatosis and renal cell cancer. Enhancement must be associated with the wall, septum, or nodule used for classification and may be visually unequivocal or quantitatively confirmed at CT by a >=20 HU increase.\n\nVersion history: v2019 replaces the prior qualitative 2005 CT criteria with explicit 2/3/4 mm wall and septal thresholds, septa counts, a nodule definition, calcification treatment, and homogeneous HU-based Bosniak II density subtypes. CT Bosniak II masses must remain well defined with a thin (<=2 mm), smooth wall, and Bosniak IIF cystic masses must also be well defined. Intrarenal location and size >=3 cm alone no longer upgrade a mass, but a homogeneous hyperattenuating nonenhancing mass larger than 3 cm may be best characterized with MRI before class assignment.\n\nMany nonenhancing septa, a nonenhancing wall or septum >=3 mm, abundant calcification that could conceal enhancement, and heterogeneous or otherwise incompletely characterized internal attenuation should be evaluated with renal mass protocol MRI before assigning a class. A definite enhancing wall or septal feature does not remove the need to characterize potentially occult higher-order enhancing elements in a heterogeneous or incomplete CT examination. Use the separate Bosniak v2019 MRI criteria when MRI is required. Silverman SG, Pedrosa I, Ellis JH, et al. Radiology. 2019;292(2):475-488. DOI: 10.1148/radiol.2019182646",
  },
  fields: [
    {
      id: "scopeEligibility",
      label: "Bosniak v2019 eligibility",
      helpText:
        "Apply the general-population Bosniak guidance only after infectious, inflammatory, and vascular etiologies and necrotic solid masses are excluded, and only when a hereditary renal cell carcinoma syndrome is not known or suspected.",
      type: "radio",
      opts: [
        {
          value: "eligible",
          label:
            "general-population criteria apply; alternative etiologies and necrotic solid mass have been excluded",
        },
        {
          value: "hereditaryRccSyndrome",
          label:
            "known or suspected hereditary RCC syndrome (for example, VHL or HLRCC/FH)",
        },
        {
          value: "notExcluded",
          label: "not excluded or uncertain",
        },
      ],
    },
    {
      id: "solidComponent",
      label: "Enhancing-tissue proportion",
      helpText:
        "Bosniak v2019 applies only when enhancing tissue is less than approximately 25% of the mass.",
      type: "radio",
      opts: [
        {
          value: "under25",
          label: "less than approximately 25% of mass or absent",
        },
        {
          value: "over25",
          label: "approximately 25% of mass or more",
        },
      ],
    },
    {
      id: "wellDefined",
      label: "Mass definition",
      helpText:
        "Bosniak I, II, and IIF require a well-defined mass; an ill-defined or uncertain margin cannot be assigned to those categories from this CT pathway.",
      type: "radio",
      opts: [
        { value: "yes", label: "well defined" },
        { value: "no", label: "ill defined or uncertain" },
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
      id: "wallEnhancement",
      label: "Wall enhancement",
      helpText:
        "Record enhancement for the wall itself; enhancement elsewhere in the mass does not make a wall feature enhancing.",
      type: "radio",
      opts: [
        { value: "absent", label: "absent / not confirmed" },
        { value: "present", label: "present" },
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
      id: "septaEnhancement",
      label: "Septal enhancement",
      helpText:
        "Record enhancement for the selected septum or septa themselves; wall or nodule enhancement does not make septa enhancing.",
      type: "radio",
      showIf: (v) => v.septaCount && v.septaCount !== "none",
      opts: [
        { value: "absent", label: "absent / not confirmed" },
        { value: "present", label: "present" },
      ],
    },
    {
      id: "nodule",
      label: "Convex protrusion / nodule morphology",
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
      id: "noduleEnhancement",
      label: "Protrusion / nodule enhancement",
      helpText:
        "A Bosniak v2019 nodule must itself enhance; wall or septal enhancement does not establish nodule enhancement.",
      type: "radio",
      showIf: (v) => v.nodule && v.nodule !== "none",
      opts: [
        { value: "absent", label: "absent / not confirmed" },
        { value: "present", label: "present" },
      ],
    },
    {
      id: "calcifications",
      label: "Calcifications",
      helpText:
        "In v2019, any calcification morphology may occur in Bosniak II when the mass remains well defined with a thin smooth wall and other features are assessable; abundant calcification may require MRI.",
      type: "radio",
      opts: [
        { value: "absent", label: "absent" },
        { value: "present", label: "present, features still assessable" },
      ],
    },
    {
      id: "density",
      label: "CT attenuation characterization",
      helpText:
        "Choose fully characterized simple fluid only when a renal mass protocol examination establishes the Bosniak I features. A homogeneous -9 to 20 HU mass known only from noncontrast CT is a Bosniak II density-only subtype. Choose other fully characterized cystic attenuation only when complete renal mass protocol CT establishes a cystic mass but it does not fit a listed benign density-only subtype; the structural wall, septal, calcification, and nodule criteria still determine its class. Heterogeneous or incompletely characterized internal attenuation requires renal mass protocol MRI before assignment because occult enhancing elements may change the class.",
      type: "radio",
      opts: [
        {
          value: "water",
          label: "fully characterized homogeneous simple fluid at renal mass protocol CT",
        },
        {
          value: "noncontrastMinus9To20",
          label: "-9 to 20 HU at noncontrast CT only",
        },
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
        {
          value: "heterogeneousOrIncomplete",
          label:
            "heterogeneous or incompletely characterized internal attenuation at CT",
        },
        {
          value: "otherCharacterized",
          label:
            "other fully characterized cystic attenuation on renal mass protocol CT",
        },
      ],
    },
    {
      id: "hyperattenuatingSize",
      label: "Hyperattenuating mass size",
      helpText:
        "For a homogeneous >=70 HU noncontrast mass, a size larger than 3 cm may warrant renal mass protocol MRI before Bosniak assignment. Size is not used as an automatic IIF upgrade.",
      type: "radio",
      showIf: (v) => v.density === "hyperattenuating70",
      opts: [
        { value: "atMost3", label: "3 cm or smaller" },
        {
          value: "over3OrUncertain",
          label: "larger than 3 cm or size not confidently established",
        },
      ],
    },
  ],
  compute: (v) => {
    if (!hasRequiredInputs(v)) {
      return {
        Error:
          "Complete the eligibility, enhancing-tissue proportion, mass definition, wall, feature-specific enhancement, septa, calcification, density, and nodule fields before applying Bosniak v2019.",
        _severity: "error",
      };
    }

    if (v.scopeEligibility === "hereditaryRccSyndrome") {
      return {
        "Bosniak Category": "Not applicable",
        "v2019 Term":
          "Outside general-population guidance: hereditary renal cell carcinoma syndrome",
        Management:
          "Do not use this calculator's Bosniak I/II no-follow-up guidance; use syndrome-specific renal-mass evaluation and surveillance with the appropriate specialist.",
        Rationale:
          "The Bosniak v2019 suggested reporting content is intended for the general population and not patients with a renal cell carcinoma syndrome.",
        "Text Module":
          "Bosniak Classification, version 2019 general-population management not applied because a hereditary renal cell carcinoma syndrome is known or suspected.",
        _severity: "warning",
      };
    }

    if (v.scopeEligibility !== "eligible") {
      return {
        "Bosniak Category": "Not applicable",
        "v2019 Term": "Outside the Bosniak v2019 eligibility boundary",
        Management:
          "Resolve the alternative diagnosis or solid-mass question before applying Bosniak v2019.",
        Rationale:
          "Bosniak v2019 is intended for cystic renal masses only after infectious, inflammatory, or vascular etiologies and necrotic solid masses are excluded.",
        "Text Module":
          "Bosniak Classification, version 2019 not applied: required alternative etiologies and necrotic solid masses have not been excluded.",
        _severity: "warning",
      };
    }

    if (v.solidComponent === "over25") {
      return {
        "Bosniak Category": "Not applicable",
        "v2019 Term": "Not a Bosniak-classifiable cystic renal mass",
        Management:
          "Evaluate as a solid renal mass with cystic or necrotic change; Bosniak v2019 is intended for masses with less than approximately 25% enhancing tissue.",
        Rationale:
          "Bosniak v2019 defines cystic renal masses as having less than approximately 25% enhancing tissue.",
        "Text Module":
          "Bosniak Classification, version 2019 not applied: approximately one-quarter or more of the mass is enhancing tissue.",
        _severity: "warning",
      };
    }

    const wallEnhancing = v.wallEnhancement === "present";
    const septaPresent = v.septaCount !== "none";
    const septaEnhancing =
      septaPresent && v.septaEnhancement === "present";
    const noduleEnhancing =
      v.nodule !== "none" && v.noduleEnhancement === "present";
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

    if (v.nodule !== "none" && !noduleEnhancing) {
      return buildUnassignedResult(
        "The selected protrusion is not confirmed to enhance. A Bosniak v2019 nodule must itself enhance; enhancement of the wall or septa cannot substitute. Renal mass protocol MRI is needed before classification.",
      );
    }

    if (noduleEnhancing) {
      return buildResult(
        "IV",
        v.nodule === "acuteAny"
          ? "Enhancing nodule with acute margins meets Bosniak v2019 IV criteria. The highest class is assigned when features span classes."
          : "Enhancing >=4 mm convex protrusion with obtuse margins meets Bosniak v2019 IV criteria. The highest class is assigned when features span classes.",
      );
    }

    if (
      v.density === "hyperattenuating70" &&
      v.hyperattenuatingSize === "over3OrUncertain" &&
      !wallEnhancing &&
      !septaEnhancing
    ) {
      return buildUnassignedResult(
        "A homogeneous hyperattenuating nonenhancing mass larger than 3 cm, or one whose size is not confidently established, may be best characterized with renal mass protocol MRI before Bosniak assignment. Size is not used as an automatic IIF upgrade.",
      );
    }

    if (v.density === "heterogeneousOrIncomplete") {
      return buildUnassignedResult(
        "The selected internal attenuation is heterogeneous or otherwise incompletely characterized at CT. A known wall or septal feature does not exclude occult enhancing elements that could change the highest class; renal mass protocol MRI is recommended before assignment.",
      );
    }

    if (!wallEnhancing && v.wall !== "thin") {
      return buildUnassignedResult(
        "Bosniak II requires a well-defined thin (≤2 mm), smooth wall. The selected 3 mm, thick or irregular wall is not confirmed to enhance; enhancement of septa or a nodule cannot substitute. Renal mass protocol MRI is recommended before classification.",
      );
    }

    if (
      !septaEnhancing &&
      septaPresent &&
      (v.septaCount === "many" || v.septaThickness !== "thin")
    ) {
      return buildUnassignedResult(
        "The selected many (≥4), 3 mm, thick or irregular septum is not confirmed to enhance; enhancement of the wall or a nodule cannot substitute. Renal mass protocol MRI is recommended before assigning a Bosniak class.",
      );
    }

    if (
      (wallEnhancing && (v.wall === "thick" || v.wall === "irregular")) ||
      (septaEnhancing && thickOrIrregularSepta)
    ) {
      return buildResult(
        "III",
        "Enhancing thick (>=4 mm) or irregular wall/septa meet Bosniak v2019 III criteria when no enhancing nodule is present.",
      );
    }

    if (
      (wallEnhancing && v.wall === "minimallyThick") ||
      (septaEnhancing && (minimallyThickSepta || thinManySepta))
    ) {
      if (v.wellDefined !== "yes") {
        return buildUnassignedResult(
          "Bosniak IIF requires a well-defined cystic renal mass. The selected mass is ill defined or uncertain, so the enhancing IIF feature cannot be assigned from this CT pathway.",
        );
      }

      return buildResult(
        "IIF",
        "Enhancing 3 mm smooth wall/septa or many (>=4) thin enhancing septa meet Bosniak v2019 IIF criteria.",
      );
    }

    if (v.wellDefined !== "yes") {
      return buildUnassignedResult(
        "Bosniak I and II require a well-defined mass with a thin, smooth wall. The selected mass is ill defined or uncertain, so a benign category cannot be assigned from this CT pathway.",
      );
    }

    if (simpleWaterMass) {
      return buildResult(
        "I",
        "Fully characterized well-defined homogeneous simple-fluid mass with thin wall, no septa, no calcification, and no nodule.",
      );
    }

    if (
      v.wall === "thin" &&
      v.nodule === "none" &&
      (thinFewSepta || v.calcifications === "present" || benignIIByDensity)
    ) {
      const reasons = [];
      if (thinFewSepta) reasons.push("few (1-3) thin septa");
      if (v.calcifications === "present")
        reasons.push("calcification of any morphology");
      if (benignIIByDensity) reasons.push(densityLabels[v.density]);

      return buildResult(
        "II",
        `${reasons.join("; ")} fit Bosniak v2019 II when higher-risk enhancing features are absent.`,
        {
          term: benignIIByDensity
            ? "Likely benign Bosniak II renal mass"
            : "Benign Bosniak II renal cyst",
        },
      );
    }

    return buildUnassignedResult(
      "The selected inputs do not match a benign homogeneous CT density subtype with a thin smooth wall or an enhancing wall, septal, or nodule criterion.",
    );
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
    {
      t: "Richard PO, Violette PD, Bhindi B, et al. 2023 UPDATE - Canadian Urological Association guideline: Management of cystic renal lesions. Can Urol Assoc J. 2023;17(6):162-174.",
      u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10263289/",
    },
  ],
};
