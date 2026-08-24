/**
 * Mammography assessment-category guide.
 *
 * This is an independently worded educational crosswalk. It uses public FDA
 * MQSA reporting terminology and cites the ACR as the BI-RADS version owner;
 * it does not reproduce the proprietary lexicon or infer an assessment from
 * imaging features.
 */

const ASSESSMENTS = {
  "0_additional": {
    option: "0A — Additional imaging evaluation is needed",
    assessment: "Incomplete — additional imaging evaluation is needed",
    mqsa: "Incomplete: Need additional imaging evaluation",
    likelihood: "Not a final malignancy-risk category",
    nextStep:
      "Complete the recommended imaging evaluation before a final assessment category is assigned.",
    severity: "info",
  },
  "0_priors": {
    option: "0P — Prior mammograms are needed for comparison",
    assessment: "Incomplete — prior mammograms are needed for comparison",
    mqsa: "Incomplete: Need prior mammograms for comparison",
    likelihood: "Not a final malignancy-risk category",
    nextStep:
      "Obtain prior mammograms when possible, then issue the follow-up assessment required by the reporting jurisdiction.",
    reportingRequirement:
      "Under U.S. MQSA, a follow-up report with a final assessment must be issued within 30 calendar days, even when comparison images cannot be obtained.",
    severity: "info",
  },
  1: {
    option: "1 — Negative",
    assessment: "1 — Negative",
    mqsa: "Negative",
    likelihood:
      "No suspicious imaging finding is identified by this selected category; this guide does not calculate patient-specific risk.",
    nextStep:
      "Continue the screening plan based on age, risk, symptoms, and local protocol.",
    severity: "success",
  },
  2: {
    option: "2 — Benign",
    assessment: "2 — Benign",
    mqsa: "Benign",
    likelihood:
      "The imaging finding is assessed as benign; this guide does not calculate patient-specific risk.",
    nextStep:
      "Continue the screening plan based on age, risk, symptoms, and local protocol unless another clinical issue requires action.",
    severity: "success",
  },
  3: {
    option: "3 — Probably benign",
    assessment: "3 — Probably benign",
    mqsa: "Probably Benign",
    likelihood: ">0% to ≤2% expected likelihood of malignancy",
    nextStep:
      "Use short-interval imaging surveillance under the interpreting radiologist's and institution's protocol; National Mammography Database evidence supports the importance of an initial 6-month follow-up.",
    severity: "warning",
  },
  4: {
    option: "4 — Suspicious",
    assessment: "4 — Suspicious",
    mqsa: "Suspicious",
    likelihood: ">2% to <95% expected likelihood of malignancy",
    nextStep:
      "Tissue sampling is generally indicated after the interpreting radiologist confirms imaging, clinical, and procedural concordance.",
    severity: "danger",
  },
  "4A": {
    option: "4A — Low suspicion",
    assessment: "4A — Low suspicion",
    mqsa: "Suspicious",
    likelihood: ">2% to ≤10% expected likelihood of malignancy",
    nextStep:
      "Tissue sampling is generally indicated after the interpreting radiologist confirms imaging, clinical, and procedural concordance.",
    severity: "danger",
  },
  "4B": {
    option: "4B — Moderate suspicion",
    assessment: "4B — Moderate suspicion",
    mqsa: "Suspicious",
    likelihood: ">10% to ≤50% expected likelihood of malignancy",
    nextStep:
      "Tissue sampling is generally indicated after the interpreting radiologist confirms imaging, clinical, and procedural concordance.",
    severity: "danger",
  },
  "4C": {
    option: "4C — High suspicion",
    assessment: "4C — High suspicion",
    mqsa: "Suspicious",
    likelihood: ">50% to <95% expected likelihood of malignancy",
    nextStep:
      "Tissue sampling is generally indicated with timely clinical coordination and radiologic-pathologic concordance review.",
    severity: "danger",
  },
  5: {
    option: "5 — Highly suggestive of malignancy",
    assessment: "5 — Highly suggestive of malignancy",
    mqsa: "Highly Suggestive of Malignancy",
    likelihood: "≥95% expected likelihood of malignancy",
    nextStep:
      "Prompt tissue confirmation and multidisciplinary care coordination are generally indicated.",
    severity: "danger",
  },
  6: {
    option: "6 — Known tissue-proven malignancy",
    assessment: "6 — Known tissue-proven malignancy",
    mqsa: "Known Biopsy-Proven Malignancy",
    likelihood:
      "Not applicable — malignancy has already been established by tissue diagnosis",
    nextStep:
      "Use imaging for treatment planning or response assessment as directed by the care team; this category is not a new diagnostic probability.",
    severity: "danger",
  },
  post_marker: {
    option: "P — Post-procedure mammogram for marker placement",
    assessment: "Post-procedure mammogram for marker placement",
    mqsa: "Post-Procedure Mammogram for Marker Placement",
    likelihood:
      "Not applicable — this examination records marker placement rather than lesion risk",
    nextStep:
      "Use this U.S. MQSA category only for a post-procedure mammogram performed to document marker deployment and position.",
    biradsNumbering:
      "None — this FDA MQSA assessment is not a numbered BI-RADS category",
    severity: "info",
  },
};

const ASSESSMENT_ORDER = [
  "0_additional",
  "0_priors",
  "1",
  "2",
  "3",
  "4",
  "4A",
  "4B",
  "4C",
  "5",
  "6",
  "post_marker",
];

export const BIRADS = {
  id: "birads",
  category: "Breast Imaging",
  name: "Mammography Assessment Guide (BI-RADS v2025 context)",
  desc: "Radiologist-selected mammography assessment categories from FDA MQSA with current BI-RADS v2025 context",
  guidelineVersion: "FDA MQSA 2024 · ACR BI-RADS v2025 context",
  keywords: [
    "breast",
    "mammography",
    "mammogram",
    "BI-RADS",
    "BIRADS",
    "MQSA",
    "breast cancer",
  ],
  tags: ["Breast", "Radiology", "Mammography", "Reporting"],
  metaDesc:
    "Independent mammography assessment-category guide using FDA MQSA terminology with ACR BI-RADS v2025 context and peer-reviewed risk evidence.",

  versionHistory: [
    {
      version: "Legacy Radulator feature-inference page",
      shortVersion: "legacy",
      year: "2013-era",
      status:
        "Removed because it could imply that a web form can derive a BI-RADS category from selected imaging descriptors.",
      summary:
        "The prior page mixed mammography, ultrasound, and MRI feature inputs with 2013-era category and management text.",
      whySuperseded:
        "The current page keeps category assignment with the interpreting radiologist and avoids reproducing a proprietary lexicon.",
      citations: [
        {
          t: "Archived standard owner and current-version reference",
          u: "https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/BI-RADS",
        },
      ],
    },
    {
      version: "ACR BI-RADS v2025 context",
      shortVersion: "v2025 context",
      year: "2025",
      replaces: "Legacy Radulator feature-inference page",
      status:
        "Current ACR version context, cross-referenced to public FDA MQSA mammography assessment terminology.",
      summary:
        "The guide distinguishes the two incomplete-assessment pathways, adds the FDA marker-placement assessment, preserves published category 4 risk boundaries, and does not reproduce the proprietary lexicon.",
      citations: [
        {
          t: "ACR BI-RADS current release and citation guidance",
          u: "https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/BI-RADS",
        },
        {
          t: "FDA MQSA final-rule overview",
          u: "https://www.fda.gov/radiation-emitting-products/mammography-quality-standards-act-mqsa-and-mqsa-program/important-information-final-rule-amend-mammography-quality-standards-act-mqsa",
        },
      ],
    },
  ],

  info: {
    text: `This independent educational guide covers mammography assessment categories only. It is not an ACR-licensed BI-RADS implementation, is not affiliated with or endorsed by the American College of Radiology, and does not reproduce the ACR manual or lexicon.

Select the final category already assigned by a qualified interpreting physician. Radulator does not assign a category from imaging features, interpret images, replace a report, calculate patient-specific cancer risk, or determine management for an individual patient.

The FDA MQSA terminology shown here governs U.S. mammography report categories; MQSA is a regulatory framework, not a complete clinical-practice guideline. The ACR owns and maintains BI-RADS® and released v2025 on December 1, 2025 across mammography, ultrasound, MRI, contrast-enhanced mammography, and outcomes auditing. This page uses that current version only as context and links users to the official materials.

Category-specific next steps below are independently worded educational summaries. Apply the official manual, the interpreting radiologist's judgment, local protocol, patient risk, symptoms, and radiologic-pathologic concordance. BI-RADS® is a registered trademark of the American College of Radiology.`,
    link: {
      label: "View the ACR BI-RADS current release",
      url: "https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/BI-RADS",
    },
  },

  fields: [
    {
      id: "assessment",
      label: "Radiologist-assigned mammography assessment",
      subLabel:
        "Selected-category reference only; this guide does not interpret imaging findings.",
      helpText:
        "Choose the final assessment already assigned by a qualified interpreting physician.",
      type: "radio",
      opts: ASSESSMENT_ORDER.map((value) => ({
        value,
        label: ASSESSMENTS[value].option,
      })),
    },
  ],

  compute: (vals) => {
    const row = ASSESSMENTS[vals.assessment];
    if (!row) {
      return {
        Error: "Select the radiologist-assigned mammography assessment category.",
      };
    }

    const result = {
      Assessment: row.assessment,
      "MQSA category": row.mqsa,
      "Likelihood context": row.likelihood,
      "Next step": row.nextStep,
      "Decision boundary":
        "This guide does not calculate patient-specific risk; a qualified interpreting physician assigns the category.",
      "Implementation scope":
        "Mammography assessment categories only; no image interpretation, feature-to-category inference, proprietary lexicon, or patient-specific risk calculation.",
      "Source framework":
        "FDA MQSA mammography reporting terminology with ACR BI-RADS® v2025 version context",
      _severity: row.severity,
    };

    if (row.reportingRequirement) {
      result["U.S. reporting requirement"] = row.reportingRequirement;
    }
    if (row.biradsNumbering) {
      result["BI-RADS numbering"] = row.biradsNumbering;
    }
    return result;
  },

  refs: [
    {
      t: "FDA MQSA final-rule overview: mammography report assessment categories (enforced September 10, 2024)",
      u: "https://www.fda.gov/radiation-emitting-products/mammography-quality-standards-act-mqsa-and-mqsa-program/important-information-final-rule-amend-mammography-quality-standards-act-mqsa",
    },
    {
      t: "FDA MQSA Alternative Standard #25: follow-up after prior-comparison incomplete assessment",
      u: "https://www.fda.gov/radiation-emitting-products/regulations-mqsa/mqsa-alternative-standard-25-issuing-report-assessment-incomplete-need-additional-imaging-evaluation",
    },
    {
      t: "FDA MQSA Alternative Standard #12: post-procedure mammogram for marker placement",
      u: "https://www.fda.gov/radiation-emitting-products/regulations-mqsa/mqsa-alternative-standard-12-assessment-category-post-procedure-mammograms-marker-placement",
    },
    {
      t: "ACR BI-RADS current release, citation and software-usage information",
      u: "https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/BI-RADS",
    },
    {
      t: "American College of Radiology. BI-RADS v2025 manual release announcement. December 1, 2025.",
      u: "https://www.acr.org/News-and-Publications/Media-Center/2025/bi-rads-v2025-manual-released",
    },
    {
      t: "Minichetti P, et al. AJR v2025 review: key updates and implications for breast imaging practice. AJR Am J Roentgenol. 2026. PMID 42233890.",
      u: "https://pubmed.ncbi.nlm.nih.gov/42233890/",
    },
    {
      t: "Kang BJ. Breast Imaging Reporting and Data System v2025: Key Updates in Mammography. J Korean Soc Radiol. 2026;87:437-459.",
      u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC13266138/",
    },
    {
      t: "Berg WA, et al. Cancer yield and follow-up for category 3 after screening mammography recall. Radiology. 2020;296:32-41. PMID 32427557.",
      u: "https://pubmed.ncbi.nlm.nih.gov/32427557/",
    },
    {
      t: "Strigel RM, et al. Published category 4A, 4B and 4C malignancy-probability boundaries. AJR Am J Roentgenol. 2017;209:222-229. PMID 28792802.",
      u: "https://pubmed.ncbi.nlm.nih.gov/28792802/",
    },
  ],
};
