# Radulator Roadmap

> Public, milestone-level roadmap. Last updated 2026-06-09. Sequencing may shift; no dates are commitments. Business/legal workstreams are tracked privately by the maintainer.

## Where we are

38 calculators across 11 specialties, ~1,100 Playwright E2E tests, live at [radulator.com](https://radulator.com). Phase 1 (Fix & Refine) is essentially complete: severity-based result colors, copy-results, guideline version badges, first-time onboarding, and a clinician-feedback sprint that added AAST 2025 kidney OIS (with a 2018/2025 version selector), a pancreas organ module, and per-grade imaging guidance.

## Phase 1 — remaining

- WCAG 2.1 AA accessibility audit and fixes
- Calculator info/education content expansion

## Phase 2 — Differentiate

- **Guideline version system**: generalize the AAST-style version selector into a first-class architecture, so calculators can offer current and prior guideline versions side by side (initial targets: Fleischner, CAD-RADS, PI-RADS; then Bosniak, LI-RADS, Milan)
- **Guided mode**: an optional "walk me through it" flow per calculator, with skill-level preferences for residents and students
- **Reference depth**: PubMed-validated citations, related-articles surfacing, "next steps" sections, and structured report-text output (copy-paste-ready impressions)

## Phase 3 — Platform

- SMART on FHIR EHR integration (gated on compliance review)
- Multi-calculator clinical workflows and context-aware suggestions
- Scale toward 75+ calculators; PWA/offline polish; internationalization

## How new calculators ship

Every calculator passes a fixed pipeline: literature research with full citations and worked examples → **physician sign-off on the spec** → implementation on a feature branch → independent QA with test vectors and E2E tests → pull request with evidence → maintainer review and merge. Calculation logic never changes without cited sources and clinical review.

## Quality invariants

- All formulas carry peer-reviewed references visible in the UI
- Outcome-verified testing (computed results checked against published worked examples)
- PR-only mainline; merge equals deploy; CI smoke tests on every PR
- No ads, no patient data stored, calculations run client-side

Suggestions and corrections are welcome via the in-app feedback form or GitHub issues.
