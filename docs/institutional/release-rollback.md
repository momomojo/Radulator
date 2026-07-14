# Radulator Institutional Release and Rollback

Status: implementation draft for review.

## Verification Build

Use a deterministic non-production release version for local and CI verification:

```bash
npm ci
npm run build:public
RADULATOR_RELEASE_VERSION=0.0.0-local-institutional-test npm run build:institutional
npm run lint
npm run check:invariants
RADULATOR_EDITION=institutional RADULATOR_RELEASE_VERSION=0.0.0-local-institutional-test npm run check:edition
npm run test:edition
RADULATOR_RELEASE_VERSION=0.0.0-local-institutional-test npm run test:institutional-network
npm audit --audit-level=high --omit=dev
```

## Release Build

Real institutional release builds must set an explicit owner-approved release version:

```bash
export RADULATOR_RELEASE_VERSION=2026.07.13-institutional.1
npm ci
npm run build:public
npm run build:institutional
RADULATOR_EDITION=institutional npm run check:edition
mkdir -p artifacts
npm sbom --sbom-format cyclonedx > "artifacts/sbom-institutional-${RADULATOR_RELEASE_VERSION}.json"
npm audit --audit-level=high --omit=dev --json > "artifacts/npm-audit-institutional-${RADULATOR_RELEASE_VERSION}.json"
```

## Rollback

If a problem is found before merge, revert the PR branch commit and rerun verification. If merged to `develop`, revert on a branch targeting `develop`. If promoted to production, follow the repository rollback rule: revert the merge commit on a branch, open a PR, and let the gate merge.

For institutional static deployments, redeploy the previous approved artifact or update first-party `release-control.json` while the branch fix proceeds.
