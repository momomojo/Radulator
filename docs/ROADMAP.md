# Radulator Roadmap

> Public, milestone-level roadmap. Last updated 2026-08-26. Sequencing may shift; no dates are commitments. Business/legal workstreams are tracked privately by the maintainer.

## Where we are

A growing suite of calculators across 11 specialties, a clean ESLint baseline, and 1,400+ Playwright E2E checks, live at [radulator.com](https://radulator.com). Phase 1 (Fix & Refine) is complete: severity-based result colors, copy-results, guideline version badges, first-time onboarding, per-calculator info/education panels, a clinician-feedback sprint that added AAST 2025 kidney OIS (with a 2018/2025 version selector), a pancreas organ module, per-grade imaging guidance, per-calculator static pages with full SEO metadata, and a WCAG 2.1 AA accessibility pass.

An automated, risk-tiered clinical release pipeline now gates and promotes work to production. The Cockcroft-Gault creatinine-clearance calculator is the first to ship through it, extending the renal suite.

## Phase 1 — complete

- Calculator info/education panels present across the live calculator suite
- ESLint baseline clean under `npm run lint`
- Static calculator pages and sitemap generated for calculator-level SEO
- Accessibility, copy-results, onboarding, and guideline-version badge foundations in place

## Phase 2 — Differentiate

- **Guideline currency**: standing review of guideline revisions against what each calculator implements. The [guideline/source registry](../ops/hermes/radulator/skills/radulator-operations/references/guideline-versions.json) is the authoritative per-calculator record; a verified row is limited to its cited claims and executable evidence, while other rows remain seed-unverified.
  - **Implemented and source-verified**: Bosniak version 2019 CT classification and MELD 3.0 (OPTN Policy 9.1.D). These are bounded claims; every other row retains its separate registry status.
    - **Bosniak v2019 CT evidence**: the open [Silverman et al. primary publication](https://pmc.ncbi.nlm.nih.gov/articles/PMC6677285/?report=reader) and official [CUA 2023 publisher PDF](https://cuaj.ca/index.php/journal/article/download/8389/5706/45369) are retrieved by `npm run test:bosniak-source`; source-derived vectors include `exactly-70-hu-homogeneous-noncontrast-mass-category-ii` and `exactly-4-mm-obtuse-margin-enhancing-nodule-category-iv`. The registry claims `bosniak-v2019-category-ii` and `bosniak-v2019-iif-iii-iv-features` bind every named case to the primary source.
    - **MELD 3.0 evidence**: the official [OPTN Policy 9.1.D](https://www.hrsa.gov/sites/default/files/hrsa/optn/optn_policies.pdf) equation and [MELD/PELD calculator user guide](https://www.hrsa.gov/sites/default/files/hrsa/optn/meld-peld-calculator-user-guide.pdf) entry domains are checked by `npm run test:hermes-guideline-registry`. Registry claims `optn-adult-meld3-equation`, `optn-laboratory-bounds-and-dialysis`, and `optn-calculator-entry-domains` bind the sex term, dialysis rule, calculation bounds, and all 20 literal inclusive-endpoint/outside-domain vectors.
    - **Temporary BI-RADS rollback evidence**: the live replacement is clearly labeled `Legacy ACR BI-RADS Fifth Edition (2013) temporary rollback with public 2025 assessment-summary constraints` while the full sixth-edition manual is pending. The [official ACR BI-RADS system page](https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/BI-RADS) supplies the three-modality scope. The historically named `npm run test:birads-fda-source` retrieves the digest-pinned official [ACR BI-RADS Atlas Fifth Edition Quick Reference](https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/BI-RADS/BIRADS-Poster.pdf) plus the public ACR mammography, ultrasound, and MRI summary forms. Claims `acr-birads-three-modality-scope`, `acr-fifth-edition-descriptor-groups`, `acr-fifth-edition-assessment-labels`, `acr-mammography-assessment-boundaries-and-management`, `acr-ultrasound-assessment-boundaries-and-management`, and `acr-mri-assessment-boundaries-and-management` bind selected fifth-edition descriptor groups and the public-summary constraints for unsplit ultrasound/MRI Category 4, mammography 4A-4C, source-literal likelihood endpoints, and management wording. The workflow explicitly includes ultrasound calcifications and architectural distortion, requires modality, ignores hidden modality-specific values, and does not infer or contradict an assessment from descriptors. Descriptor-to-category inference and patient-specific probability calculation remain out of scope pending the full manual review.
  - **Queued for authoritative review or future implementation**: a combined ACR BI-RADS sixth-edition mammography/ultrasound/MRI calculator after the manual is supplied; [LI-RADS CT/MRI treatment-response v2024](https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/LI-RADS) (new calculator candidate; the current LI-RADS v2018 row remains seed-unverified); [NI-RADS MRI v2025](https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/NI-RADS) (the current ACR NI-RADS 2018 row remains seed-unverified); and [PE-RADS v2026](https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/PE-RADS) (a new-calculator candidate and imaging-report companion to the existing Wells PE clinical score). These links establish only that the ACR versions exist; they do not mark the corresponding Radulator rows verified or implemented.
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
