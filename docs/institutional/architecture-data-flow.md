# Radulator Institutional Architecture and Data Flow

Status: implementation draft for review. This document describes implemented engineering controls and does not grant deployment, medical, legal, licensing, or regulatory approval.

## Edition Model

Radulator now builds from a fail-closed edition resolver:

- `RADULATOR_EDITION=public` builds the public site into `dist`.
- `RADULATOR_EDITION=institutional` builds the institutional site into `dist-institutional`.
- Institutional builds require `RADULATOR_RELEASE_VERSION`.
- Institutional builds reject known telemetry, form-provider, ad-provider, pixel, and search-verification environment variables before Vite runs.

## Current Institutional Catalog

The approved institutional allowlist is exactly `[]`.

The institutional build imports zero calculator components, emits no static calculator pages, and renders an empty-catalog release screen. Any non-empty institutional registry requires a new rights, validation, and owner-approval packet.

## Data Flow

Institutional browser flow:

1. Browser requests first-party static HTML/CSS/JS/assets.
2. App reads generated edition metadata and the empty generated calculator registry.
3. No calculator input or result UI exists in this release because no calculator is approved.
4. Release metadata is served as first-party static JSON: `/release.json`.
5. Emergency release control is served as first-party static JSON: `/release-control.json`.

No EHR, PACS, Epic, API, PHI, institutional-network integration, telemetry endpoint, feedback endpoint, remote font, CDN script, or off-origin automatic request is implemented in the institutional build.

## Evidence Boundary

Static checks are implemented in `scripts/check-edition-invariants.mjs`. Runtime browser network proof is implemented in `tests/e2e/institutional-network.spec.js` and is run through `npm run test:institutional-network`.

Runtime completeness is established only by a passing browser network proof against `dist-institutional`.
