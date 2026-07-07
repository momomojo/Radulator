# Testing Verification Directory

This file tracks testing verification reports, browser-based test results, and
regression testing status. It is a QA/navigation document only; calculator
formula text, thresholds, guideline versions, and roadmap ownership live
elsewhere.

## Verification Workflow

1. All new code goes on a feature branch; never push directly to `main` or
   `develop`.
2. Feature and fix PRs target `develop`.
3. Playwright E2E tests run first.
4. Agent Browser or manual browser testing validates UI/UX when a task changes
   visual behavior or interactive flows.
5. Reports are logged below with date, branch, tool, scope, and result.
6. Production release happens through a later promotion PR from `develop` to
   `main`, after the required gate checks pass.

---

## Source-Derived Inventory Snapshot

Current audit date: 2026-07-06.

Inventory and coverage are derived from source metadata and spec navigation
targets with:

```bash
node scripts/spec-map.js
node scripts/spec-map.js --check
```

Latest coverage command output:

```text
spec coverage OK: 38/38 calculators have dedicated specs
```

Inventory notes:

- `scripts/spec-map.js` scans `src/components/calculators/*.jsx` for calculator
  `id` and `name` metadata.
- `FeedbackForm.jsx` is a custom component and is excluded from the calculator
  coverage gate.
- There are 38 calculator components and 40 calculator spec files under
  `tests/e2e/calculators/`.
- The two extra spec files are cross-cutting coverage:
  `copy-results.spec.js` and `guideline-badges.spec.js`.

### Category Counts

| Metadata category | Calculator count |
| --- | ---: |
| Radiology | 12 |
| Hepatology/Liver | 9 |
| Interventional | 5 |
| Urology | 3 |
| Clinical Decision | 2 |
| Neuroradiology | 2 |
| Breast Imaging | 1 |
| Cardiac Imaging | 1 |
| Nephrology | 1 |
| Trauma | 1 |
| Women's Imaging | 1 |
| **Total** | **38** |

---

## Calculator Test Coverage Matrix

The Playwright coverage column is generated from each spec's
`navigateToCalculator(page, "...")` target. A calculator can have more than one
listed spec when a cross-cutting spec also navigates to it.

| # | Calculator | Source metadata | Playwright coverage | Last verified | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | AAST Trauma Grading | `AASTTraumaGrading.jsx` / `aast-trauma-grading` | `tests/e2e/calculators/guideline-badges.spec.js`<br>`tests/e2e/calculators/trauma/aast-trauma-grading.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 2 | ALBI Score | `ALBIScore.jsx` / `albi-score` | `tests/e2e/calculators/hepatology/albi-score.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 3 | ASPECTS Score | `ASPECTSScore.jsx` / `aspects-score` | `tests/e2e/calculators/neuroradiology/aspects-score.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 4 | Adrenal CT Washout | `AdrenalCTWashout.jsx` / `adrenal-ct` | `tests/e2e/calculators/radiology/adrenal-ct-washout.spec.js`<br>`tests/e2e/calculators/radiology/adrenal-mri-csi.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 5 | Adrenal MRI Chemical Shift | `AdrenalMRICSI.jsx` / `adrenal-mri` | `tests/e2e/calculators/radiology/adrenal-mri-csi.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 6 | Adrenal Vein Sampling – Aldosterone | `AdrenalVeinSamplingAldo.jsx` / `avs-hyperaldo` | `tests/e2e/calculators/interventional/avs-hyperaldo.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 7 | Adrenal Vein Sampling – Cortisol | `AdrenalVeinSamplingCortisol.jsx` / `avs-cortisol` | `tests/e2e/calculators/interventional/avs-cortisol.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 8 | BCLC Staging (HCC) | `BCLCStaging.jsx` / `bclc-staging` | `tests/e2e/calculators/hepatology/bclc-staging.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 9 | ACR BI-RADS | `BIRADS.jsx` / `birads` | `tests/e2e/calculators/breast/bi-rads.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 10 | CAD-RADS 2.0 | `CADRADS.jsx` / `cad-rads` | `tests/e2e/calculators/cardiac/cad-rads.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 11 | CT Severity Index (CTSI) | `CTPancreatitis.jsx` / `ct-pancreatitis` | `tests/e2e/calculators/hepatology/ct-pancreatitis.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 12 | Child-Pugh Score | `ChildPugh.jsx` / `child-pugh` | `tests/e2e/calculators/copy-results.spec.js`<br>`tests/e2e/calculators/hepatology/child-pugh.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 13 | IV Contrast Dosing | `ContrastDosing.jsx` / `contrast-dosing` | `tests/e2e/calculators/radiology/contrast-dosing.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 14 | DLP to Effective Dose | `DLPDose.jsx` / `dlp-dose` | `tests/e2e/calculators/radiology/dlp-dose.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 15 | Fleischner 2017 Pulmonary Nodules | `Fleischner.jsx` / `fleischner` | `tests/e2e/calculators/radiology/fleischner.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 16 | Hip Dysplasia | `HipDysplasiaIndices.jsx` / `hip-dysplasia` | `tests/e2e/calculators/radiology/hip-dysplasia.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 17 | Inferior Petrosal Sinus Sampling (IPSS) | `IPSS.jsx` / `ipss` | `tests/e2e/calculators/interventional/ipss.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 18 | Khoury Catheter Selector | `KhouryCatheterSelector.jsx` / `khoury-catheter-selector` | `tests/e2e/calculators/interventional/khoury-catheter-selector.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 19 | LI-RADS v2018 | `LIRADS.jsx` / `lirads` | `tests/e2e/calculators/hepatology/lirads.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 20 | Lung-RADS v2022 | `LUNGRADS.jsx` / `lung-rads` | `tests/e2e/calculators/radiology/lung-rads.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 21 | MELD-Na Score | `MELDNa.jsx` / `meld-na` | `tests/e2e/calculators/hepatology/meld-na.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 22 | MR Elastography (Liver) | `MRElastography.jsx` / `mr-elastography` | `tests/e2e/calculators/hepatology/mr-elastography.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 23 | Mehran CIN Risk Score | `MehranCIN.jsx` / `mehran-cin` | `tests/e2e/calculators/nephrology/mehran-cin.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 24 | Milan Criteria (HCC) | `MilanCriteria.jsx` / `milan-criteria` | `tests/e2e/calculators/hepatology/milan-criteria.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 25 | ACR NI-RADS | `NIRADS.jsx` / `nirads` | `tests/e2e/calculators/neuroradiology/ni-rads.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 26 | ACR O-RADS | `ORADS.jsx` / `orads` | `tests/e2e/calculators/womens/o-rads.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 27 | PI-RADS v2.1 | `PIRADS.jsx` / `pirads` | `tests/e2e/calculators/urology/pirads.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 28 | Prostate Volume & PSA Density | `ProstateVolume.jsx` / `prostate-volume` | `tests/e2e/calculators/copy-results.spec.js`<br>`tests/e2e/calculators/radiology/prostate-volume.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 29 | Radiation Dose Converter | `RadiationDoseConverter.jsx` / `radiation-dose-converter` | `tests/e2e/calculators/radiology/radiation-dose-converter.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 30 | Bosniak Classification (Renal Cysts) | `RenalCystBosniak.jsx` / `bosniak` | `tests/e2e/calculators/radiology/renal-cyst.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 31 | RENAL Nephrometry Score | `RenalNephrometry.jsx` / `renal-nephrometry` | `tests/e2e/calculators/urology/renal-nephrometry.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 32 | IIEF-5 (SHIM Score) | `SHIMCalculator.jsx` / `shim` | `tests/e2e/calculators/urology/shim.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 33 | Spleen Size | `SpleenSizeULN.jsx` / `spleen-size` | `tests/e2e/calculators/radiology/spleen-size.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 34 | ACR TI-RADS | `TIRADS.jsx` / `tirads` | `tests/e2e/calculators/radiology/tirads.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 35 | ThyPRO-39 | `ThyPRO39.jsx` / `thypro-39` | `tests/e2e/calculators/interventional/thypro-39.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 36 | Wells Criteria for DVT | `WellsDVT.jsx` / `wells-dvt` | `tests/e2e/calculators/clinical/wells-dvt.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 37 | Wells Criteria for PE | `WellsPE.jsx` / `wells-pe` | `tests/e2e/calculators/clinical/wells-pe.spec.js` | 2026-07-06 source/spec-map audit | Covered |
| 38 | Y-90 Radioembolization Dosimetry | `Y90RadiationSegmentectomy.jsx` / `y90-radiation-segmentectomy` | `tests/e2e/calculators/hepatology/y90-radiation.spec.js` | 2026-07-06 source/spec-map audit | Covered |

---

## Visual / Agent Browser Verification

Visual reports are stored in `tests/reports/`. The table below points to the
existing browser artifacts; no new browser run was needed for this documentation
refresh because no UI or calculator behavior changed.

| Date | Branch | Tool | Scope | Result | Report |
| --- | --- | --- | --- | --- | --- |
| 2026-01-24 | `feature/new-calculators-seo` | Dev-Browser / Playwright-based | TI-RADS, PI-RADS, Fleischner functional browser verification | PASS | `tests/reports/2026-01-24-feature-new-calculators-browser-verification.md` |
| 2026-01-24 | `main` | Playwright headed Chromium | TI-RADS, PI-RADS, Fleischner visual verification | PASS | `tests/reports/2026-01-24-visual-testing-tirads-pirads-fleischner.md` |
| 2026-01-26 | `main` | Dev-Browser / Playwright-based | Phase 1 UI improvements | PARTIAL PASS with finding | `tests/reports/2026-01-26-phase1-ui-improvements-qa.md` |

---

## SEO/Infrastructure Verification

| Item | Source | Current evidence | Status |
| --- | --- | --- | --- |
| `sitemap.xml` | `scripts/generate-static-pages.js`; `public/sitemap.xml` | Static file exists and generator writes sitemap during build. | Present; no dedicated automated verification found in this audit |
| `robots.txt` | `public/robots.txt` | Static file exists and references `https://radulator.com/sitemap.xml`. | Present; no dedicated automated verification found in this audit |
| JSON-LD schema | `index.html`; `scripts/generate-static-pages.js` | Root page and generated calculator pages contain JSON-LD blocks. | Present; no dedicated automated verification found in this audit |
| Meta descriptions / OG tags | `index.html`; `src/hooks/useUrlSync.js`; `scripts/generate-static-pages.js` | Root and calculator pages define meta description and Open Graph fields. | Present; no dedicated automated verification found in this audit |
| Privacy page | `public/privacy.html` | Static file exists. | Present |
| Terms page | `public/terms.html` | Static file exists. | Present |
| About page | `public/about.html`; `scripts/update-about.mjs` | Static file exists and is refreshed by the build pre-step. | Present |

---

## Verification Reports Log

Report entries should include:

- **Date**: YYYY-MM-DD
- **Branch**: Feature branch name
- **Tester**: Agent or human identifier
- **Tool**: Playwright / Agent Browser / Manual
- **Scope**: What was tested
- **Result**: PASS / FAIL / PARTIAL
- **Report File**: Path to detailed report
- **Notes**: Any issues found

### Reports

<!-- Add new reports below this line, newest first -->

| Date | Branch | Tester | Tool | Scope | Result | Report file | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-01-26 | `main` | Claude Code | Dev-Browser | Phase 1 UI improvements | PARTIAL | `tests/reports/2026-01-26-phase1-ui-improvements-qa.md` | Responsive/sidebar checks passed; enhanced result color finding noted in report |
| 2026-01-24 | `main` | Claude Code Agent | Playwright headed Chromium | TI-RADS, PI-RADS, Fleischner visual testing | PASS | `tests/reports/2026-01-24-visual-testing-tirads-pirads-fleischner.md` | All three calculators visually verified |
| 2026-01-24 | `feature/new-calculators-seo` | Claude (Agent) | Dev-Browser | TI-RADS, PI-RADS, Fleischner functional browser verification | PASS | `tests/reports/2026-01-24-feature-new-calculators-browser-verification.md` | All three calculators verified with expected outputs |

---

## Regression Testing Checklist

Before any feature/fix PR is marked ready for gate, verify the relevant subset:

- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `node scripts/spec-map.js --check`
- [ ] `npm test` for calculator logic changes or release/promotion gates
- [ ] New calculators have Playwright specs that navigate to the calculator by
      current name or id
- [ ] Agent Browser or manual visual verification completed for UI/UX changes
- [ ] No console errors in browser for UI/UX changes
- [ ] Mobile responsive layout verified for UI/UX changes
- [ ] Build-generated static pages and sitemap checked when metadata, routes, or
      build scripts change
- [ ] Calculator math verified against cited source papers when medical logic
      changes

---

## Test Infrastructure Files

```text
tests/
├── TESTING_VERIFICATION_DIR.md
├── SECURITY_AUDIT_REPORT.md
├── TEST_BEST_PRACTICES.md
├── reports/
│   └── Browser/manual QA reports and screenshots
├── e2e/
│   ├── smoke.spec.js
│   ├── onboarding.spec.js
│   └── calculators/
│       ├── breast/            (1 spec)
│       ├── cardiac/           (1 spec)
│       ├── clinical/          (2 specs)
│       ├── hepatology/        (9 specs)
│       ├── interventional/    (5 specs)
│       ├── nephrology/        (1 spec)
│       ├── neuroradiology/    (2 specs)
│       ├── radiology/         (12 specs, including Fleischner and TI-RADS)
│       ├── trauma/            (1 spec)
│       ├── urology/           (3 specs, including PI-RADS)
│       ├── womens/            (1 spec)
│       ├── copy-results.spec.js
│       └── guideline-badges.spec.js
├── fixtures/
├── data/
├── test-data/
└── helpers/
    └── calculator-test-helper.js
```

---

## Notes

- This application is used by radiology professionals in clinical settings.
- Medical accuracy is critical; formulas, thresholds, score boundaries, units,
  interpretation text, and guideline versions require explicit task approval and
  citation-backed review.
- Production stability takes priority over new features.
- New calculator coverage should be enforced with `node scripts/spec-map.js
  --check`.
