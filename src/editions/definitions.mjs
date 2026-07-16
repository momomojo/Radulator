export const INSTITUTIONAL_ALLOWLIST_SHA256 =
  "37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570";

export const INSTITUTIONAL_VALIDATION_MANIFEST_SHA256 =
  "37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570";

export const INSTITUTIONAL_VALIDATION_SCHEMA_SHA256 =
  "b2ea41d09944cbfe1c12fd3a8cce8f538e8c431d44b51a86eb9fd29eafffe8d6";

export const editions = {
  public: {
    id: "public",
    title: "Radulator",
    outDir: "dist",
    publicDir: "public",
    calculators: "all",
    includeFeedback: true,
    telemetry: {
      ga4: true,
      resourceHints: true,
      searchVerification: true,
    },
    externalLinks: "clickable",
    staticCalculatorPages: true,
    searchIndexPings: true,
    releaseControls: false,
    persistCalculatorChoices: true,
  },
  institutional: {
    id: "institutional",
    title: "Radulator Institutional",
    outDir: "dist-institutional",
    publicDir: "public-institutional",
    calculators: [],
    includeFeedback: false,
    telemetry: {
      ga4: false,
      resourceHints: false,
      searchVerification: false,
    },
    externalLinks: "text-only",
    staticCalculatorPages: false,
    searchIndexPings: false,
    releaseControls: true,
    persistCalculatorChoices: false,
    releaseControlFile: "release-control.json",
    allowlistHash: INSTITUTIONAL_ALLOWLIST_SHA256,
    validationManifestHash: INSTITUTIONAL_VALIDATION_MANIFEST_SHA256,
    validationSchemaHash: INSTITUTIONAL_VALIDATION_SCHEMA_SHA256,
  },
};

export default editions;
