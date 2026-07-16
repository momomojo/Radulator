# Radulator Institutional Incident Response Outline

Status: draft operational procedure for owner review.

## Severity Triggers

Treat any of the following as release-blocking until reviewed:

- institutional build emits an off-origin automatic browser request;
- feedback, name, email, message, patient identifier, or telemetry fields appear in institutional mode;
- institutional registry imports a calculator when the approved allowlist is empty;
- release metadata hashes drift from the source allowlist or validation manifest;
- a medical formula, threshold, score boundary, unit, interpretation, classification, guideline version, or management text changes without explicit medical authorization;
- a high-severity production-scope dependency finding is untriaged for the release.

## Containment

Use the least invasive containment path:

1. Set first-party `release-control.json` to disable the release if the deployment supports fast static replacement.
2. Redeploy the last approved institutional static artifact.
3. Open a revert PR against `develop` or `main` according to the Radulator release train.

Do not hot-edit generated bundles except for the approved static release-control file.

## Recovery

Recovery requires a new branch and PR with:

- root cause summary;
- changed files;
- public and institutional verification commands;
- static forbidden-string output;
- browser network request log;
- rollback notes;
- owner review for medical, legal, licensing, or regulatory questions.
