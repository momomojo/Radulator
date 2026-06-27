# Radulator Roadmap

> Public, milestone-level roadmap. Last updated 2026-06-27. Sequencing may shift; no dates are commitments. Business/legal workstreams are tracked privately by the maintainer.

## Where we are

38 calculators across 11 specialties, a clean ESLint baseline, and 1,400+ Playwright E2E checks, live at [radulator.com](https://radulator.com). Phase 1 (Fix & Refine) is complete: severity-based result colors, copy-results, guideline version badges, first-time onboarding, per-calculator info/education panels, a clinician-feedback sprint that added AAST 2025 kidney OIS (with a 2018/2025 version selector), a pancreas organ module, per-grade imaging guidance, per-calculator static pages with full SEO metadata, and a WCAG 2.1 AA accessibility pass.

## Phase 1 — complete

- Calculator info/education panels present across the live calculator suite
- ESLint baseline clean under `npm run lint`
- Static calculator pages and sitemap generated for calculator-level SEO
- Accessibility, copy-results, onboarding, and guideline-version badge foundations in place

## Phase 2 — Differentiate

- **Guideline currency**: standing review of guideline revisions against what each calculator implements; items under clinical review: Bosniak v2019 alignment, LI-RADS CT/MRI treatment-response v2024 (new calculator candidate), MELD 3.0 (current OPTN adult liver-allocation standard since 2023; supersedes the MELD-Na the calculator implements today), NI-RADS MRI v2025 (ACR extended NI-RADS to MRI surveillance with modality-specific descriptors and management; the calculator implements the 2018 CT/PET-CT system only), BI-RADS v2025 (ACR's 6th-edition manual, published February 2026, updates the lexicon/descriptors and outcomes-audit standards across mammography, ultrasound, and MRI; the calculator implements the 5th edition)
- **Suite completeness**: finish each specialty's daily-work calculation set before scattering across specialties — a clinician who arrives for one calculation should find their whole working set here. First target: the cardiac-CT suite (CAD-RADS is live; coronary-artery-calcium / Agatston scoring with age/sex/ethnicity percentile is the missing daily-work companion)
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
