# Canary Calculator Evidence Wave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce three independent, reproducible primary-source dossiers for AAST Trauma Grading, ASPECTS, and Fleischner, then select the first calculator eligible for its own sequential integration/release plan.

**Architecture:** Three read-only agents audit separate calculators concurrently. The coordinator independently reproduces every release-relevant claim and vector, rejects incomplete dossiers, and selects the first accepted candidate for a subsequent calculator-specific TDD plan; no research agent edits shared repository or GitHub state.

**Tech Stack:** React calculator modules, JSON fixtures, Playwright, Node.js audit scripts, official/primary web and PDF sources, Git/GitHub protected release workflow, Hermes signed reviewers.

**Spec:** `docs/superpowers/specs/2026-08-30-parallel-calculator-audit-release.md`

## Global Constraints

- Evidence agents are read-only and may not edit files, create branches/PRs, apply labels, invoke jobs, or access credentials.
- One agent owns one calculator dossier at a time.
- Search snippets and secondary summaries are discovery aids only; release claims require authoritative primary or official source readback.
- The coordinator independently reproduces critical source claims and arithmetic before accepting a dossier.
- Only one calculator enters integration/release at once; research may continue in parallel.
- Missing, ambiguous, inaccessible, or conflicting evidence remains fail-closed.
- Do not edit `docs/ROADMAP.md`, generated `dist/`, calculator ids, or unrelated files.

---

### Task 1: AAST Trauma Grading Read-Only Dossier

**Files:**
- Read: `src/components/calculators/AASTTraumaGrading.jsx`
- Read: `tests/e2e/calculators/trauma/aast-trauma-grading.spec.js`
- Read: `tests/fixtures/aast-trauma-test-data.json`
- Read: `ops/hermes/radulator/skills/radulator-operations/references/guideline-versions.json`
- Modify: none

**Interfaces:**
- Consumes: registry record `calculator_id = "aast-trauma-grading"` and the current runtime/tests listed above.
- Produces: one structured dossier message with `calculator_id`, `sources`, `claim_map`, `vectors`, `discrepancies`, `unsupported_claims`, `limitations`, and `disposition`.

- [ ] **Step 1: Inventory every release-relevant runtime claim**

Record all organ-specific liver, spleen, kidney, and pancreas grades; multiple-injury behavior; imaging statements; hemodynamic warnings; and management recommendations. Cite file and line for each runtime claim.

- [ ] **Step 2: Retrieve authoritative sources**

Use the official AAST OIS publications/pages and primary revision papers for liver/spleen/kidney 2018, kidney 2025, and pancreas 2024. Use primary WSES or other original consensus publications only for management claims. Record exact version, URL, document identity, and table/page/section locator.

- [ ] **Step 3: Build an explicit claim map**

For each runtime grade criterion and management statement, return one of `directly-supported`, `inference`, `conflict`, or `not-found`. Never collapse criteria across organs or revisions.

- [ ] **Step 4: Calculate vectors independently**

Provide at least one representative vector for every organ/grade represented by the runtime, every exact threshold boundary, every multiple-injury transition, and every invalid/insufficient-input state. State expected grade/output without copying the current fixture expectation.

- [ ] **Step 5: Return the dossier**

Recommend exactly one disposition: `correct-and-verify`, `verify-without-behavior-change`, or `remain-unverified`. Include unresolved access or version conflicts explicitly.

---

### Task 2: ASPECTS Read-Only Dossier

**Files:**
- Read: `src/components/calculators/ASPECTSScore.jsx`
- Read: `tests/e2e/calculators/neuroradiology/aspects-score.spec.js`
- Read: `tests/fixtures/aspects-test-data.json`
- Read: `ops/hermes/radulator/skills/radulator-operations/references/guideline-versions.json`
- Modify: none

**Interfaces:**
- Consumes: registry record `calculator_id = "aspects-score"` and the current runtime/tests listed above.
- Produces: one structured dossier message with `calculator_id`, `sources`, `claim_map`, `vectors`, `discrepancies`, `unsupported_claims`, `limitations`, and `disposition`.

- [ ] **Step 1: Inventory runtime semantics**

Record region definitions, starting score, subtraction behavior, laterality behavior, score interpretation, prognostic statements, and treatment/management implications with file/line locators.

- [ ] **Step 2: Retrieve the original model and later evidence used by the UI**

Open Barber et al. 2000 or the authoritative primary publication that defines ASPECTS. Retrieve separate primary or official evidence for any thrombectomy threshold, prognosis, or management statement not present in the original model. Record exact page/table/section locators.

- [ ] **Step 3: Map every claim to evidence**

Classify each region, scoring rule, interpretation, and management statement as `directly-supported`, `inference`, `conflict`, or `not-found`. Distinguish the original score from later treatment-trial selection criteria.

- [ ] **Step 4: Calculate vectors independently**

Return vectors for score 10, score 0, single-region subtraction, multi-region subtraction, laterality if applicable, duplicate/invalid selection behavior, and every numeric interpretation or management boundary currently displayed.

- [ ] **Step 5: Return the dossier**

Recommend exactly one disposition: `correct-and-verify`, `verify-without-behavior-change`, or `remain-unverified`, with unsupported claims and source limitations called out.

---

### Task 3: Fleischner Pulmonary Nodule Read-Only Dossier

**Files:**
- Read: `src/components/calculators/Fleischner.jsx`
- Read: `tests/e2e/calculators/radiology/fleischner.spec.js`
- Read: `tests/fixtures/compute/fleischner.json`
- Read: `ops/hermes/radulator/skills/radulator-operations/references/guideline-versions.json`
- Modify: none

**Interfaces:**
- Consumes: registry record `calculator_id = "fleischner"` and the current runtime/tests listed above.
- Produces: one structured dossier message with `calculator_id`, `sources`, `claim_map`, `vectors`, `discrepancies`, `unsupported_claims`, `limitations`, and `disposition`.

- [ ] **Step 1: Inventory the full decision table**

Record population exclusions, solid/subsolid type, single/multiple status, size boundaries, risk strata, follow-up intervals, escalation recommendations, and every caveat with file/line locators.

- [ ] **Step 2: Retrieve the 2017 guideline source**

Use the official Radiology guideline publication and any official open table or society artifact needed to verify exact recommendations. Record document version, URL, table/page/section locator, and access limitations.

- [ ] **Step 3: Map each decision cell to source evidence**

Return one record per runtime decision cell and classify it as `directly-supported`, `inference`, `conflict`, or `not-found`. Treat exclusions and size-boundary inclusivity as first-class claims.

- [ ] **Step 4: Calculate boundary vectors independently**

Return representative and adjacent vectors at every size boundary for solid and subsolid nodules, single and multiple nodules, low/high risk, and exclusion states. Include expected follow-up wording and flag any unsupported management specificity.

- [ ] **Step 5: Return the dossier**

Recommend exactly one disposition: `correct-and-verify`, `verify-without-behavior-change`, or `remain-unverified`, explicitly separating inaccessible-source limitations from implementation discrepancies.

---

### Task 4: Coordinator Dossier Acceptance and First-Candidate Selection

**Files:**
- Read: the calculator/runtime/test/registry files named in Tasks 1-3
- Read: every authoritative source cited in the returned dossiers
- Modify: none

**Interfaces:**
- Consumes: all three structured dossier messages.
- Produces: an acceptance table for all three dossiers and the exact calculator id selected for the next independently planned release task.

- [ ] **Step 1: Validate source identity and access**

Open every release-relevant source URL. Confirm the expected document/version, authoritative host or publication identity, stable retrieval strategy, and cited locator. Reject claims supported only by snippets, summaries, or inaccessible text.

- [ ] **Step 2: Reproduce claim and vector evidence**

Independently read each critical formula/threshold/classification/management statement and recompute the representative and boundary vectors. Record agreement or disagreement with the agent; do not average conflicting interpretations.

- [ ] **Step 3: Score dossier completeness**

For each calculator, report `accepted`, `rework`, or `remain-unverified` across source identity, complete claim mapping, boundary coverage, unsupported-claim scan, deterministic-audit feasibility, and disposition correctness.

- [ ] **Step 4: Select the first release candidate**

Choose the accepted calculator with the clearest authoritative artifact and smallest independently reviewable clinical delta. Do not select based only on which agent finished first.

Expected: one accepted candidate id, or a bounded rework assignment if no dossier is acceptable. Writing the candidate's calculator-specific TDD/release plan is the next planning phase and must use its actual findings and exact filenames; this evidence-wave plan does not guess clinical changes before source review.
