# Fleischner 2017 Source-Correction and Sequential Release Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for implementation and superpowers:verification-before-completion before any completion or release claim.

**Goal:** Correct the Fleischner calculator to the independently approved 2017 source dossier, bind every released claim to executable vectors and reproducible source evidence, and release only this calculator through exact-head CI and observed production QA.

**Architecture:** Keep the calculator deterministic and fail-closed. A first-class applicability gate prevents excluded patients from receiving a Fleischner schedule; source-conformant whole-millimeter inputs drive a literal solid/subsolid decision table; a canonical compute fixture is the clinical contract. A transparent online audit verifies primary-publication identity plus stable NLM table reproductions without claiming that CI downloaded RSNA's bot-protected full text. Registry, roadmap, workflow, PR, deployment, and live-browser evidence all bind to the same exact head.

**Tech Stack:** React calculator objects, Node JSX loader, JSON compute fixtures, Playwright, Node primary-source audit scripts, GitHub Actions, protected `develop`/`main` release flow, direct browser QA.

**Evidence inputs:** Approved dossier `.superpowers/sdd/2026-08-30-canary-calculator-evidence-wave/task-3-report.md`; independent approval `.superpowers/sdd/2026-08-30-canary-calculator-evidence-wave/task-3-review.md`; primary guideline DOI `10.1148/radiol.2017161659`; measurement DOI `10.1148/radiol.2017162894`; NLM table reproductions `NBK553863/table/ch5.Tab1` and `NBK553863/table/ch5.Tab2`.

## Global constraints

- Release one calculator only. No ASPECTS, AAST, BI-RADS, or unrelated behavior changes enter this diff.
- Preserve the source's optionality and exact time horizons; do not convert `consider` into a mandatory recommendation.
- Do not infer malignancy risk from individual checkboxes. Solid-nodule risk must be a clinician-selected holistic estimate; subsolid pathways do not use the solid risk field.
- Require a pre-recorded positive whole-millimeter size. Reject fractions instead of inventing an `x.5` rounding convention.
- Use lung-window measurements. For overall nodules below 10 mm, instruct users to enter the rounded average of long and perpendicular short axes; for nodules at least 10 mm, require both numeric axes and verify that their rounded average matches the entered overall size. For part-solid nodules at least 6 mm, use a categorical ≤3 mm / too-small-to-measure-reliably component path or require the maximum long-axis size when the component is >3 mm; verify a measured component does not exceed the actual overall maximum long axis.
- Require an explicit prior-comparison state for every subsolid nodule so baseline confirmation, persistent/stable surveillance, pure-ground-glass growth, and a new or growing solid component cannot collapse into one schedule.
- For multiple subsolid nodules, define baseline/persistence at cohort level and interval evolution at the selected most suspicious management-driving nodule(s). A growth-triggered path also requires an explicit establishment basis: at least 2 mm average-diameter change on comparable CT, a visually established new solid component, or validated volumetry under its reproducibility protocol.
- Multiple-nodule size means the most suspicious nodule, which may not be the largest.
- Applicability exclusions gate the schedule before any management output. Screening cases route to Lung-RADS context; other excluded or uncertain states receive no Fleischner schedule.
- RSNA command-line HTTP 403 must remain explicit. The audit may verify DOI/Crossref identity and exact NLM table fragments, but must not label a secondary reproduction as the primary full text.
- No deployment or live-site claim follows from local tests, an open PR, or green CI alone.

---

### Task 1: Add the failing source-derived compute contract

**Files:**
- Create: `tests/fixtures/compute/fleischner.json`
- Delete after replacement: `tests/fixtures/fleischner-test-data.json`
- Test: `scripts/run-compute-tests.mjs`

- [ ] Add representative and adjacent vectors for every source cell: single/multiple solid at 5/6/8/9 mm and low/high risk; ordinary and selected-suspicious solitary GGN below 6 mm; solitary GGN at least 6 mm; multiple subsolid below and at least 6 mm; solitary part-solid with component below 6, 6–8, and above 8 mm; and baseline, persistent/stable, pure-ground-glass growth, and solid-component-evolution transitions.
- [ ] Add invalid vectors for missing applicability, every exclusion, missing type/count/risk/size, zero/negative/fractional size, missing or invalid component, a component exceeding the actual overall maximum long axis, missing/invalid temporal or growth-establishment state, sub-2-mm unconfirmed linear change, and missing or inconsistent numeric axes at 10 mm or above.
- [ ] Bind expectations to observable result keys and source-literal wording, including `consider CT at 18–24 months`, `until 5 years`, and `PET/CT, biopsy, or resection` where supported.
- [ ] Run `node --import ./scripts/register-jsx-loader.mjs scripts/run-compute-tests.mjs` and record the expected Fleischner failures before implementation.

### Task 2: Implement fail-closed inputs and the literal decision table

**Files:**
- Modify: `src/components/calculators/Fleischner.jsx`
- Test: `tests/fixtures/compute/fleischner.json`

- [ ] Add the applicability/exclusion gate and prevent excluded or uncertain cases from reaching a Fleischner schedule.
- [ ] Replace automatic risk-factor inference with a required clinician-selected solid-nodule risk estimate (`low` under 5% versus `high` at least 5%); hide it for subsolid pathways.
- [ ] Enforce source-conformant whole-mm, relational, numeric-axis, rounded-average, and solid-component-containment validation.
- [ ] Implement all approved `E-*` decision cells literally, including low-risk optionality, selected suspicious GGN handling, baseline versus persistent multiple-subsolid routing, source-qualified pure-ground-glass growth, and the part-solid persistence / established solid-component-evolution distinctions.
- [ ] Remove unsupported individualized probability, diagnosis, and prognosis prose; retain concise report-ready rationale, scope, measurement method, and decision boundary.
- [ ] Correct the Bankier measurement DOI to `10.1148/radiol.2017162894` and make all measurement guidance lung-window based.
- [ ] Run the compute fixture until all Fleischner vectors pass without weakening expectations.

### Task 3: Replace browser tests with the source-derived UI contract

**Files:**
- Modify: `tests/e2e/calculators/radiology/fleischner.spec.js`

- [ ] Test conditional field visibility, keyboard-accessible applicability/risk/temporal/growth-basis controls, exclusion routing, and clearing of hidden temporal, growth-basis, or component state when nodule type changes.
- [ ] Test each clinical branch at representative boundaries, all invalid inputs, copy/print-safe result text, corrected references, and absence of the old auto-risk and mediastinal-window claims.
- [ ] Assert that excluded patients never receive a follow-up schedule and that multiple-subsolid results clearly defer later management to the most suspicious nodule when required.
- [ ] Run `npx playwright test tests/e2e/calculators/radiology/fleischner.spec.js --project=chromium`.

### Task 4: Add a transparent deterministic source audit

**Files:**
- Create: `scripts/audit-fleischner-primary-source.mjs`
- Create: `scripts/audit-fleischner-primary-source.test.mjs`
- Modify: `package.json`

- [ ] Verify Crossref metadata for primary guideline DOI `10.1148/radiol.2017161659` and measurement DOI `10.1148/radiol.2017162894`, including titles, publisher, journal, volume/issue, pages, and publication year.
- [ ] Fetch the two NLM table reproductions, isolate the exact management-table fragments, and assert their deterministic contents/hashes. Label them secondary cross-checks in the emitted audit.
- [ ] Assert the calculator metadata, corrected DOI, canonical fixture identity, vector bindings, and absence of the known wrong DOI and source-conflicting phrases.
- [ ] Emit a machine-readable schema that separately reports primary metadata identity, primary full-text transport limitation, secondary table extraction, runtime/fixture agreement, and tested vector ids.
- [ ] Add `test:fleischner-source` and append it to `test:primary-source`; run the new test both alone and through the aggregate command.

### Task 5: Promote only the proven claim set in registry and roadmap

**Files:**
- Modify: `ops/hermes/radulator/skills/radulator-operations/references/guideline-versions.json`
- Modify: `ops/hermes/radulator/guideline-registry.test.mjs`
- Modify: `docs/ROADMAP.md`
- Modify: `tests/roadmap-guideline-status.test.mjs`
- Modify: `.github/workflows/e2e-tests.yml`

- [ ] Change Fleischner from `seed-unverified` to `verified` only after every registry claim has a registered source, exact locator, source hash or metadata assertion, and one or more passing canonical vector ids.
- [ ] Register the primary guideline, primary measurement statement, and both clearly labeled NLM cross-check artifacts; document the RSNA CLI transport limitation without downgrading the observed browser review.
- [ ] Add calculator-specific registry assertions for audit command/schema, source identity, exact fragment hashes, fixture metadata, claim/vector coverage, and implementation path.
- [ ] Move Fleischner into the roadmap's implemented-and-source-verified accounting with the exact audit command and claim ids; update the integrity regression.
- [ ] Add `npm run test:fleischner-source` literally to the exact-head source-audit workflow step.

### Task 6: Verify the complete local change

**Files:**
- Review: every changed file from Tasks 1–5

- [ ] Run formatter/linter checks appropriate to the touched files.
- [ ] Run `npm run test:fleischner-source`.
- [ ] Run `npm run test:compute`.
- [ ] Run the dedicated Fleischner Playwright spec in Chromium and WebKit.
- [ ] Run `npm run test:hermes-guideline-registry` and `npm run test:primary-source`.
- [ ] Run `npm test`, `npm run build`, and any repository release-policy/invariant tests required by the existing workflow.
- [ ] Inspect `git diff --check`, the complete diff, and `git status`; distinguish pre-existing ignored scratch artifacts from tracked release files.

### Task 7: Independent clinical, code, and exact-head review

**Files:**
- Read-only review of the complete candidate diff and approved dossier

- [ ] Have an implementation-independent reviewer check every decision branch, exclusion, measurement rule, source locator, audit assertion, and test expectation against the approved dossier and authoritative sources.
- [ ] Have a second reviewer inspect code quality, accessibility, regression risk, dead/orphan artifacts, and CI integration.
- [ ] Resolve all findings test-first, rerun affected verification, commit a single reviewable calculator change, and push the exact SHA to a Fleischner-only PR targeting `develop`.
- [ ] Read back the PR head SHA, changed files, reviews, labels, and every required check. Add release-ready state only after all required checks pass on that exact SHA.

### Task 8: Sequential promotion, deployment, and observed live QA

**Files / state:**
- GitHub `develop` and protected `main`
- Production deployment and `https://radulator.com/#/fleischner`

- [ ] Merge the approved exact head into `develop`, verify the resulting develop SHA, then use the repository's protected promotion path to `main` without force.
- [ ] Verify the production deployment binds to the expected main SHA and release marker; do not infer this from branch state alone.
- [ ] In a real browser, hard-refresh the live route and exercise: one solid low-risk optional branch, one multiple-subsolid branch, one part-solid escalation branch, one exclusion, one invalid fractional measurement, references, copy results, and responsive layout.
- [ ] Capture exact live URL, observed release marker/SHA, test inputs, output text, and any browser-console/network errors.
- [ ] Declare Fleischner complete only when source audit, local/full tests, independent reviews, exact-head GitHub checks, deployment identity, and direct live QA all agree.
