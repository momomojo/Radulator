# Testing Verification Directory

This file tracks all testing verification reports, browser-based test results, and regression testing status.
It serves as a single source of truth for what has been tested, what passed, and what still needs attention.

## Verification Workflow

1. All new code goes on a feature branch (NEVER direct to main)
2. Playwright E2E tests run first (automated)
3. Agent Browser testing validates UI/UX visually
4. Reports are logged below with date, branch, and status
5. Only after all checks pass does code merge to main

---

## Calculator Test Coverage Matrix

| #   | Calculator            | Playwright Tests                 | Agent Browser | Last Verified | Status            |
| --- | --------------------- | -------------------------------- | ------------- | ------------- | ----------------- |
| 1   | Adrenal CT Washout    | adrenal-ct-washout.spec.js       | -             | -             | Existing          |
| 2   | Adrenal MRI CSI       | adrenal-mri-csi.spec.js          | -             | -             | Existing          |
| 3   | Fleischner            | MISSING                          | -             | -             | NEW - Needs Tests |
| 4   | Prostate Volume       | prostate-volume.spec.js          | -             | -             | Existing          |
| 5   | Renal Cyst Bosniak    | renal-cyst.spec.js               | -             | -             | Existing          |
| 6   | Spleen Size ULN       | spleen-size.spec.js              | -             | -             | Existing          |
| 7   | Hip Dysplasia         | hip-dysplasia.spec.js            | -             | -             | Existing          |
| 8   | TIRADS                | MISSING                          | -             | -             | NEW - Needs Tests |
| 9   | ALBI Score            | albi-score.spec.js               | -             | -             | Existing          |
| 10  | AVS Cortisol          | avs-cortisol.spec.js             | -             | -             | Existing          |
| 11  | AVS Hyperaldo         | avs-hyperaldo.spec.js            | -             | -             | Existing          |
| 12  | BCLC Staging          | bclc-staging.spec.js             | -             | -             | Existing          |
| 13  | Child-Pugh            | child-pugh.spec.js               | -             | -             | Existing          |
| 14  | Milan Criteria        | milan-criteria.spec.js           | -             | -             | Existing          |
| 15  | MELD-Na               | meld-na.spec.js                  | -             | -             | Existing          |
| 16  | MR Elastography       | mr-elastography.spec.js          | -             | -             | Existing          |
| 17  | Y90 Radioembolization | y90-radiation.spec.js            | -             | -             | Existing          |
| 18  | IPSS                  | ipss.spec.js                     | -             | -             | Existing          |
| 19  | PI-RADS               | MISSING                          | -             | -             | NEW - Needs Tests |
| 20  | Renal Nephrometry     | renal-nephrometry.spec.js        | -             | -             | Existing          |
| 21  | SHIM                  | shim.spec.js                     | -             | -             | Existing          |
| 22  | Khoury Catheter       | khoury-catheter-selector.spec.js | -             | -             | Existing          |
| 23  | Feedback Form         | N/A (custom component)           | -             | -             | Excluded          |

---

## SEO/Infrastructure Verification

| Item              | Type            | Verified | Report | Status                   |
| ----------------- | --------------- | -------- | ------ | ------------------------ |
| sitemap.xml       | Static file     | -        | -      | NEW - Needs Verification |
| robots.txt        | Static file     | -        | -      | NEW - Needs Verification |
| JSON-LD Schema    | Structured data | -        | -      | NEW - Needs Verification |
| Meta descriptions | Head tags       | -        | -      | NEW - Needs Verification |
| Privacy page      | Static HTML     | -        | -      | Existing                 |
| Terms page        | Static HTML     | -        | -      | Existing                 |
| About page        | Static HTML     | -        | -      | Existing                 |

---

## Verification Reports Log

Reports are stored in `tests/reports/` and referenced here.

### Format

Each report entry should include:

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

| Date       | Branch                      | Tester         | Tool        | Scope                        | Result | Report File                                                              | Notes                                               |
| ---------- | --------------------------- | -------------- | ----------- | ---------------------------- | ------ | ------------------------------------------------------------------------ | --------------------------------------------------- |
| 2026-01-24 | feature/new-calculators-seo | Claude (Agent) | Dev-Browser | TI-RADS, PI-RADS, Fleischner | PASS   | tests/reports/2026-01-24-feature-new-calculators-browser-verification.md | All 3 new calculators verified with correct outputs |

---

## Regression Testing Checklist

Before any merge to main, verify:

- [ ] All existing Playwright tests pass (`npm run test`)
- [ ] New calculators have Playwright tests written
- [ ] Agent Browser visual verification completed
- [ ] No console errors in browser
- [ ] Mobile responsive layout verified
- [ ] All reference links accessible
- [ ] Build succeeds (`npm run build`)
- [ ] No new lint errors in changed files
- [ ] Calculator math verified against source papers
- [ ] SEO elements render correctly (meta tags, schema)

---

## Test Infrastructure Files

```
tests/
├── TESTING_VERIFICATION_DIR.md   <- THIS FILE
├── reports/                       <- Agent Browser & verification reports
│   └── (generated reports go here)
├── e2e/calculators/
│   ├── radiology/        (6 existing + 2 needed: fleischner, tirads)
│   ├── hepatology/       (9 existing, complete)
│   ├── urology/          (3 existing + 1 needed: pirads)
│   └── interventional/   (1 existing, complete)
├── fixtures/             (JSON test data)
├── data/                 (Additional test data)
├── test-data/            (Calculator-specific data)
└── helpers/
    └── calculator-test-helper.js
```

---

## Notes

- This application is used by radiology professionals in clinical settings
- Medical accuracy is critical - all formulas must be verified against peer-reviewed sources
- Production stability takes priority over new features
- Never merge to main without full regression test pass
