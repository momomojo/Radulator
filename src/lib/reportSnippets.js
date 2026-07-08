export const REPORT_SNIPPET_SCHEMA_VERSION = 1;

const hasResultKey = (results, key) =>
  Object.prototype.hasOwnProperty.call(results, key) &&
  results[key] !== undefined &&
  results[key] !== null &&
  String(results[key]).trim() !== "";

export const reportSnippetSpecs = {
  "dlp-dose": {
    version: REPORT_SNIPPET_SCHEMA_VERSION,
    calculatorId: "dlp-dose",
    riskClass: "values-only",
    clinicalReviewRequired: false,
    title: "DLP to Effective Dose",
    sourceLabel: "ICRP 103 (2007); see Radulator calculator references",
    requiredResultKeys: [
      "Input DLP",
      "Body Region",
      "Age Group",
      "Effective Dose",
      "K-Factor Used",
    ],
    allowedResultKeys: [
      "Input DLP",
      "Body Region",
      "Age Group",
      "Effective Dose",
      "K-Factor Used",
    ],
    excludedResultKeys: [
      "Dose Context",
      "Estimated Additional Lifetime Cancer Risk",
      "Typical DLP Range (Adult)",
      "Dose Alert",
      "Pediatric Note",
      "Pediatric Consideration",
    ],
    buildSnippet: ({ results }) =>
      [
        "DLP to effective dose estimate (Radulator; educational decision support)",
        `DLP: ${results["Input DLP"]}`,
        `Region: ${results["Body Region"]}`,
        `Age group: ${results["Age Group"]}`,
        `Estimated effective dose: ${results["Effective Dose"]}`,
        `K-factor used: ${results["K-Factor Used"]}`,
        "Source basis: ICRP 103 (2007); see Radulator calculator references.",
        "Verify values, clinical context, and institutional reporting standards before use.",
      ].join("\n"),
  },
};

export function canBuildReportSnippet(calculatorId, results) {
  const spec = reportSnippetSpecs[calculatorId];
  if (!spec || !results || results.Error) return false;

  return spec.requiredResultKeys.every((key) => hasResultKey(results, key));
}

export function buildReportSnippet({ calculatorId, results }) {
  const spec = reportSnippetSpecs[calculatorId];
  if (!spec || !canBuildReportSnippet(calculatorId, results)) return null;

  return spec.buildSnippet({ results });
}
