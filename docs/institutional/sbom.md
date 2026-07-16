# Radulator Institutional SBOM Procedure

Status: implementation draft for owner/security review.

Generate SBOM and audit artifacts from the same dependency state used for the release build:

```bash
export RADULATOR_RELEASE_VERSION=2026.07.13-institutional.1
mkdir -p artifacts
npm sbom --sbom-format cyclonedx > "artifacts/sbom-institutional-${RADULATOR_RELEASE_VERSION}.json"
npm audit --audit-level=high --omit=dev --json > "artifacts/npm-audit-institutional-${RADULATOR_RELEASE_VERSION}.json"
```

The implementation moved `tailwindcss-animate` to `devDependencies` so Tailwind build tooling is not present in the production omit-dev dependency tree. A release cannot ship with untriaged high-severity production-scope audit findings.

If an institution receives source and runs local builds, dev/build-tool audit findings remain a separate source-build security review topic.
