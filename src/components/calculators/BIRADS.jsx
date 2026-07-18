/**
 * BI-RADS Calculator
 *
 * ACR BI-RADS v2025 mammography assessment-category guidance.
 * This tool reports radiologist-selected categories only; it does not infer a
 * BI-RADS category from imaging features or implement the complete lexicon.
 */

const ASSESSMENT_ROWS = {
  "0_additional": {
    inputLabel: "0 additional imaging",
    label: "Incomplete: Need Additional Imaging Evaluation",
    likelihood: "N/A",
    management: "Recall for additional imaging",
    classificationClaimId: "category-0-split",
    managementClaimId: "mammography-management-0-additional",
    severity: "info",
  },
  "0_priors": {
    inputLabel: "0 prior comparison",
    label: "Incomplete: Need Prior Mammograms for Comparison",
    likelihood: "N/A",
    management: "Need comparison to prior examination(s)",
    classificationClaimId: "category-0-split",
    managementClaimId: "mammography-management-0-priors",
    severity: "info",
  },
  1: {
    inputLabel: "1",
    label: "Negative",
    likelihood: "Essentially 0% likelihood of malignancy",
    management: "Routine mammography screening",
    classificationClaimId: "mammography-category-1",
    managementClaimId: "mammography-management-1",
    severity: "success",
  },
  2: {
    inputLabel: "2",
    label: "Benign",
    likelihood: "Essentially 0% likelihood of malignancy",
    management: "Routine mammography screening",
    classificationClaimId: "mammography-category-2",
    managementClaimId: "mammography-management-2",
    severity: "success",
  },
  3: {
    inputLabel: "3",
    label: "Probably Benign",
    likelihood: ">0% but ≤2% likelihood of malignancy",
    management:
      "Short-interval (6-month) follow-up or continued surveillance mammography",
    classificationClaimId: "mammography-category-3",
    managementClaimId: "mammography-management-3",
    severity: "warning",
  },
  4: {
    inputLabel: "4",
    label: "Suspicious",
    likelihood: ">2% but <95% likelihood of malignancy",
    management: "Tissue diagnosis",
    classificationClaimId: "mammography-category-4",
    managementClaimId: "mammography-management-4",
    severity: "danger",
    sourceLiteralLikelihood: "2% but <95% likelihood of malignancy",
    normalizationProvenance:
      "Normalized UI >2% but <95%; source literal 2% but <95%; basis = mammography 4A plus public aggregate US/MRI/CEM rows; owner choice Q2=A.",
  },
  "4A": {
    inputLabel: "4A",
    label: "Low suspicion for malignancy",
    likelihood: ">2% to ≤10% likelihood of malignancy",
    management: "Tissue diagnosis",
    classificationClaimId: "mammography-category-4a",
    managementClaimId: "mammography-management-4",
    severity: "danger",
  },
  "4B": {
    inputLabel: "4B",
    label: "Moderate suspicion for malignancy",
    likelihood: ">10% to ≤50% likelihood of malignancy",
    management: "Tissue diagnosis",
    classificationClaimId: "mammography-category-4b",
    managementClaimId: "mammography-management-4",
    severity: "danger",
  },
  "4C": {
    inputLabel: "4C",
    label: "High suspicion for malignancy",
    likelihood: "50% to <95% likelihood of malignancy",
    management: "Tissue diagnosis",
    classificationClaimId: "mammography-category-4c",
    managementClaimId: "mammography-management-4",
    severity: "danger",
  },
  5: {
    inputLabel: "5",
    label: "Highly Suggestive of Malignancy",
    likelihood: "≥95% likelihood of malignancy",
    management: "Tissue diagnosis",
    classificationClaimId: "mammography-category-5",
    managementClaimId: "mammography-management-5",
    severity: "danger",
  },
  6: {
    inputLabel: "6",
    label: "Known Biopsy-Proven Malignancy",
    likelihood: "N/A",
    management:
      "Clinical follow-up with surgeon and/or oncologist, and definitive local therapy (usually surgery) when clinically appropriate",
    classificationClaimId: "mammography-category-6",
    managementClaimId: "mammography-management-6",
    severity: "danger",
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
];

const assessmentOptions = ASSESSMENT_ORDER.map((value) => ({
  value,
  label: ASSESSMENT_ROWS[value].inputLabel,
}));

export const BIRADS = {
  id: "birads",
  category: "Breast Imaging",
  name: "ACR BI-RADS",
  desc: "ACR BI-RADS v2025 mammography assessment-category guidance",
  guidelineVersion: "ACR BI-RADS v2025",
  keywords: ["breast", "mammography", "breast cancer", "mammogram", "BI-RADS"],
  tags: ["Breast", "Radiology", "Oncology"],
  metaDesc:
    "Free BI-RADS v2025 mammography assessment-category guide with ACR source-provided likelihood and management wording.",

  versionHistory: [
    {
      version: "ACR BI-RADS 5th Edition",
      shortVersion: "5th Ed.",
      year: "2013",
      status:
        "Prior public Radulator implementation used 2013-era feature-oriented wording.",
      summary:
        "The v2025 repair supersedes that workflow for this calculator with mammography assessment-category guidance.",
      citations: [
        {
          t: "ACR BI-RADS current release page",
          u: "https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/BI-RADS",
        },
      ],
    },
    {
      version: "ACR BI-RADS v2025",
      shortVersion: "v2025",
      year: "2025",
      replaces: "ACR BI-RADS 5th Edition",
      status:
        "Current ACR public release; this calculator implements mammography assessment-category guidance only.",
      summary:
        "v2025 splits Category 0 and updates public modality summary forms. This tool preserves the mammography assessment table and does not reproduce the paid manual.",
      citations: [
        {
          t: "ACR BI-RADS current release page",
          u: "https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/BI-RADS",
        },
        {
          t: "ACR BI-RADS v2025 What's New",
          u: "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/BI-RADS/BIRADS-v2025-Whats-New.pdf",
        },
        {
          t: "ACR BI-RADS mammography summary form",
          u: "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/BI-RADS/BI-RADS-Summary-Form-Mammography.pdf",
        },
      ],
    },
  ],

  info: {
    text: `This BI-RADS v2025 tool is scoped to mammography assessment-category guidance only.

Select the final radiologist-assigned assessment category. Radulator does not infer a BI-RADS category from imaging features, does not implement a complete lexicon, and does not implement ultrasound, MRI, or contrast-enhanced mammography workflows.

For aggregate Category 4, the UI displays >2% but <95% likelihood of malignancy. Provenance preserves the mammography source literal 2% but <95% and the normalization basis: mammography 4A plus public aggregate US/MRI/CEM rows; owner choice Q2=A.

Management text is ACR source-provided and ungraded (recommendation grade N/A). Use this as educational decision support alongside the official ACR materials and clinical judgment.`,
    link: {
      label: "View ACR BI-RADS v2025 Resources",
      url: "https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/BI-RADS",
    },
  },

  fields: [
    {
      id: "assessment",
      label: "Radiologist-selected mammography assessment",
      subLabel:
        "Choose the final ACR BI-RADS v2025 mammography assessment category.",
      helpText:
        "This is a selected-category guide, not feature-to-category inference.",
      type: "radio",
      opts: assessmentOptions,
    },
  ],

  compute: (vals) => {
    const row = ASSESSMENT_ROWS[vals.assessment];
    if (!row) {
      return {
        Error:
          "Please select the radiologist-selected mammography assessment category.",
      };
    }

    const result = {
      "BI-RADS Category": `${row.inputLabel} - ${row.label}`,
      Likelihood: row.likelihood,
      Management: row.management,
      "Recommendation Grade": "N/A (ACR source-provided, ungraded)",
      Scope: "Mammography assessment-category guidance only",
      "Clinical Use":
        "Radiologist-selected category only; no feature-to-category inference and no complete lexicon implementation",
      "Classification Claim": row.classificationClaimId,
      "Management Claim": row.managementClaimId,
      "Source Attribution":
        "ACR BI-RADS v2025 public mammography summary form; peer-reviewed reviews are context, not classification authority",
      _severity: row.severity,
    };

    if (row.sourceLiteralLikelihood) {
      result["Category 4 Source Literal"] = row.sourceLiteralLikelihood;
      result["Category 4 UI Normalization"] =
        ">2% but <95% likelihood of malignancy";
      result["Category 4 Normalization Basis"] = row.normalizationProvenance;
    }

    return result;
  },

  refs: [
    {
      t: "American College of Radiology. ACR Breast Imaging Reporting & Data System (BI-RADS). Current Release and Citation and Usage Guidelines.",
      u: "https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/BI-RADS",
    },
    {
      t: "American College of Radiology. ACR BI-RADS Mammography Lexicon Summary Form. In: ACR BI-RADS v2025 Manual. Appendix B, pp. 173-176.",
      u: "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/BI-RADS/BI-RADS-Summary-Form-Mammography.pdf",
    },
    {
      t: "American College of Radiology. ACR BI-RADS v2025 Manual - What's New? November 2025.",
      u: "https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/BI-RADS/BIRADS-v2025-Whats-New.pdf",
    },
    {
      t: "American College of Radiology. ACR Publishes BI-RADS v2025 Manual to Advance Breast Imaging Standards. December 1, 2025.",
      u: "https://www.acr.org/News-and-Publications/Media-Center/2025/bi-rads-v2025-manual-released",
    },
    {
      t: "Kang BJ. Breast Imaging Reporting and Data System v2025: Key Updates in Mammography. J Korean Soc Radiol. 2026;87(3):437-459.",
      u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC13266138/",
    },
    {
      t: "Berg WA, Berg JM, Sickles EA, et al. Cancer Yield and Patterns of Follow-up for BI-RADS Category 3 after Screening Mammography Recall in the National Mammography Database. Radiology. 2020;296(1):32-41.",
      u: "https://pubmed.ncbi.nlm.nih.gov/32427557/",
    },
    {
      t: "Elezaby M, Li G, Bhargavan-Chatfield M, Burnside ES, DeMartini WB. ACR BI-RADS Assessment Category 4 Subdivisions in Diagnostic Mammography. Radiology. 2018;287(2):416-422.",
      u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6413875/",
    },
  ],
};
