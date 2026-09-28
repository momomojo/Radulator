# LI-RADS v2018: LR-M order and hidden-field guards

This note records the source evidence for the LI-RADS v2018 CT/MRI calculator
fix in `src/components/calculators/LIRADS.jsx`. It covers four things: the LR-M
step order, the LR-5 exception for nontargetoid LR-M features, the "LR-M
Features Present" dead end, and the reworded checkbox subLabels.

## What was wrong

- **Wrong order.** Any ticked LR-M feature, targetoid or nontargetoid, returned
  LR-M before the diagnostic table was consulted.
  - Example: a 25 mm observation with nonrim APHE, washout and necrosis was
    reported as LR-M instead of LR-5.
  - That usually changes management from treatment to biopsy.
- **Hidden major features.** Ticking "LR-M Features Present" hid every
  major-feature input, even when only nontargetoid features were selected.
  - Those are exactly the inputs needed to check LR-5 criteria.
- **Dead end.** If the box was ticked with no feature selected, the major
  features stayed hidden, but compute still reached the diagnostic table.
  - It then asked for inputs the user could not see.
  - Or it categorized from hidden values entered earlier.
  - The app passes every stored value to `compute`, including values of hidden
    fields.

## Source

| Item | Value |
| --- | --- |
| Document | ACR CT/MRI LI-RADS v2018 Core (© 2018 American College of Radiology) |
| Found via | "CT/MRI v2018 Core" link on https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/LI-RADS |
| URL (final, no redirect) | https://edge.sitecorecloud.io/americancoldf5f-acrorgf92a-productioncb02-3650/media/ACR/Files/RADS/LI-RADS/LI-RADS-CT-MRI-2018-Core.pdf |
| Media type | `application/pdf` |
| Bytes | 1,840,136 |
| SHA-256 | `89fddfbd66641f37055fc16082f338bc4fec880f3d3e0042a7a9b6b69f4acfb4` |
| Pages | 61 (PDF page N is printed page N - 3) |
| Retrieved | 2026-09-28 UTC, plain HTTPS GET, no bot check or login |

**Corroboration (retrieved, not pinned in CI).** The same ACR page links the
LI-RADS v2018 CT/MRI Manual, Chapter 8 "Diagnostic Categories":

- File: `Chapter-8-Diagnostic-Categories.pdf` on the same host.
- Size and digest: 24,234,380 bytes, SHA-256
  `7620daa70405cf306d739c21113388d269f502c44ae2bd86ad5bdc98b9423a66`.
- What it confirms:
  - The LR-5 page (printed p. 8-12) resolves uncertainty between LR-5 and LR-M
    in favor of LR-M.
  - The LR-M page (printed p. 8-14) resolves LR-M against LR-3 in favor of
    LR-3, and against LR-4, LR-5 or LR-TIV in favor of LR-M.
  - It also restates the same targetoid and nontargetoid criteria.
- It is not pinned in CI because of its size.

## How the audit pins the source

`scripts/audit-lirads-lrm-source.mjs` (run by
`scripts/audit-lirads-lrm-source.test.mjs`, which Smoke runs on every PR) does
the following:

- **Retrieval.** It fetches the PDF and checks the final URL (host, path,
  query), the media type, the `%PDF-` header, the byte length and the raw-byte
  SHA-256.
  - Network errors, HTTP 408/425/429 and 5xx are retried with exponential
    backoff, honoring `Retry-After` (capped at 60 s).
  - Any other status fails at once. A bot check is never bypassed.
- **Statement pins.** Each source statement is pinned by the SHA-256 and length
  of its exact span.
  - The span runs between two markers of at most six words on the named page.
  - Text is normalized first: NFKC, quote and dash folding, lower case, with
    whitespace and hyphens removed.
- **Layout checks.** Some facts are only visible in the layout, so they are
  checked from the PDF's text coordinates:
  - the Step 1 branch order;
  - every diagnostic-table cell, including the split 10-19 mm cell;
  - that the no-TIV / not-LR-5 box sits inside the nontargetoid list, below the
    "OR" and the targetoid line;
  - that the hepatocellular-origin tiebreak label spans from the LR-4/LR-5 row
    down to LR-M.
- **Runtime binding.** Every statement is bound to a runtime claim, which the
  audit exercises against the exported calculator:
  - 104 diagnostic-table vectors, each with no LR-M feature, each nontargetoid
    feature and each targetoid feature;
  - the Step 1 precedence ladder;
  - ancillary-feature ordering;
  - the subLabels;
  - 547 hidden-field mutations.
- **Mutation checks.** The test also shows that each guard rejects a deliberate
  break: 11 runtime mutants, including the old LR-M order and the old `showIf`.
  Source-span, raw-byte, URL/media-type, layout and retry mutants are rejected
  too.

The repository stores only titles, identifiers, numeric criteria, text
coordinates, short markers, digests and the paraphrases below. It does not
store the ACR text.

## Evidence table

Printed pages refer to the Core unless noted.

| Changed behavior | Source and locator | What the source says (paraphrase) | Runtime binding |
| --- | --- | --- | --- |
| Step 1 order: LR-NC, then LR-TIV, LR-1, LR-2, LR-M, then the diagnostic table (LR-3/4/5) | Printed p. 8 (PDF p. 11), Step 1 flowchart. Statement `step1-diagnostic-algorithm`; layout check `step1_order` (branch rows at y 597.6 > 567.4 > 535.9 > 505.1 > 474.3 > 439.9) | An untreated, unproven observation in a high-risk patient is checked in turn for not categorizable, definite tumor in vein, definitely benign, probably benign, and probably or definitely malignant but not HCC-specific (for example targetoid). Only otherwise does the table assign LR-3 to LR-5. | `compute` keeps this order. Audit claim `step1-order` (precedence ladder); compute test "step 1 order". |
| A targetoid mass is LR-M whatever its major features. The major-feature inputs are hidden once a targetoid feature is ticked. | Printed p. 22 (PDF p. 25), "LR-M Criteria". Statement `lrm-criteria` spans 1 and 3 | LR-M covers a targetoid mass. Targetoid appearances are rim APHE, peripheral washout, delayed central enhancement, targetoid diffusion restriction, and targetoid transitional or hepatobiliary phase appearance. | `TARGETOID_LRM_FEATURES`; `showsMajorFeatures` hides the major features when `hasTargetoidLrmFeature`; the result carries `LR-M Basis: Targetoid mass`. Claim `targetoid-mass-is-lrm` (521 vectors). |
| A nontargetoid LR-M feature gives LR-M only when the observation does not meet LR-5 criteria; otherwise it stays LR-5. The major features stay visible so this can be checked. | Printed p. 22 (PDF p. 25): statement `lrm-criteria` span 2, plus layout check `lrm_condition_box` (condition box y 545.5/532.3 inside the nontargetoid list 512.5-565.3, below OR 616.9). Also printed p. 4 `whats-new-lr5-criteria-are-table`, printed p. 8 `step1-diagnostic-table`, and FAQ printed p. 39 `faq-infiltrative-not-lr5-is-lrm` | The nontargetoid branch needs one of: infiltrative appearance, marked diffusion restriction, necrosis/severe ischemia, or another feature suggesting non-HCC malignancy. It also needs no tumor in vein and not meeting LR-5 criteria; that condition box belongs to the nontargetoid branch only. The FAQ gives LR-M for an infiltrative mass that meets neither LR-TIV nor LR-5 criteria. | `compute` evaluates the table first. LR-M only if the table category is not LR-5, with `LR-M Basis` naming the table category. If it is LR-5, the result lists the features as "LR-M not assigned: LR-5 criteria met". Claim `nontargetoid-lrm-only-if-not-lr5` (128 LR-5 kept, 288 LR-M). |
| "LR-5 criteria" means the diagnostic table's LR-5 cells. The table itself is unchanged. | Printed p. 4 (What's New): statement `whats-new-lr5-criteria-are-table`. Printed p. 8: statement `step1-diagnostic-table`, layout check `diagnostic_table` | v2018 revised the LR-5 criteria to match AASLD, and the Diagnostic Table summarizes them. Cells: no APHE <20 mm LR-3/LR-3/LR-4; no APHE ≥20 mm LR-3/LR-4/LR-4; nonrim APHE <10 mm LR-3/LR-4/LR-4; 10-19 mm LR-3 / (capsule LR-4, washout or threshold growth LR-5) / LR-5; ≥20 mm LR-4/LR-5/LR-5 (for 0 / 1 / ≥2 additional features). | Unchanged table code. Claim `lr5-criteria-are-the-diagnostic-table` (104 vectors against the cells parsed from the PDF). |
| The LR-M decision comes before ancillary features. The LR-5 path still goes through Step 2. | Printed p. 8 (Step 1) and p. 9 (PDF p. 12), Step 2. Statement `step2-ancillary-features` | Ancillary features are optional and applied after Step 1. They upgrade one category but not above LR-4, or downgrade one category. With both kinds present, the category is not adjusted. They never upgrade to LR-5. | A nontargetoid LR-M result returns before the ancillary step. Nontargetoid + LR-5 + a feature favoring benignity gives LR-4 (base LR-5). Claim `lrm-decided-before-ancillary-features`. |
| New note on nontargetoid + LR-5 results: if unsure between LR-M and this category, choose LR-M | Printed p. 10 (PDF p. 13), Step 3. Statement `step3-tiebreaking`; layout check `tiebreak_label` (label y 369.6/356.4 between the LR-4/LR-5 row at 389.5 and LR-M at 339.6). Corroborated by Manual Ch. 8 printed pp. 8-12 and 8-14 | When torn between two categories, take the one with lower certainty. The figure marks the step from LR-4 or LR-5 down to LR-M as lower certainty of hepatocellular origin. | `Clinical Notes` begins with the tiebreak note. Claim `tiebreak-note-lrm-vs-lr5` (128 results). |
| subLabel `high_risk_population` | Printed p. 6 (PDF p. 9), Getting Started. Statement `getting-started-population` | Use LI-RADS for cirrhosis, chronic hepatitis B infection, or current or prior HCC. Do not use it under age 18, or when cirrhosis is due to congenital hepatic fibrosis or a vascular disorder. | Exact text checked by claim `sublabel-high-risk-population`. |
| subLabel `study_adequate` | Printed p. 7 (PDF p. 10), Categories, and printed p. 8. Statements `categories-lr-nc`, `step1-diagnostic-algorithm` | LR-NC applies when missing or degraded images prevent categorization. | Claim `sublabel-study-adequate`; unchecked still gives LR-NC. |
| subLabel `tumor_in_vein` | Printed p. 21 (PDF p. 24), and printed p. 10. Statements `tumor-in-vein-definition`, `step3-tiebreaking` | Tumor in vein is unequivocal enhancing soft tissue in a vein, with or without a visible parenchymal mass. It is not limited to portal or hepatic veins. If uncertain, do not assign LR-TIV. | Claim `sublabel-tumor-in-vein`. |
| subLabel `has_lrm_features` | Printed p. 22 (PDF p. 25). Statement `lrm-criteria` | The LR-M criteria as above: targetoid mass, or a nontargetoid mass not meeting LR-5 criteria with one of the four nontargetoid features. | Claim `sublabel-has-lrm-features`. |
| LR-M box ticked with no feature: an actionable message, and the major features are shown. Benignity not chosen: a message pointing to that input. Nontargetoid feature with size or APHE missing: a message asking for the major features. | Radulator data-entry guardrail, not derived from the publication | Not applicable | The audit's `app_guardrails` (three actionable errors). Compute tests "dead end" and "unselected benignity". |
| `compute` never reads a field that the form hides | Radulator data-entry guardrail, not derived from the publication | Not applicable | `compute` reads values only through the same `showIf` chain as the form; every predicate includes its parents. 547 hidden-field mutations change no result (audit), plus the compute-test sweep. |

The four subLabel rows answer the checkbox subLabel evidence review, which
flagged them as REWORD. Each proposed text was re-checked against the Core
before it was adopted:

- `tumor_in_vein` also gained the Step 3 "if unsure" guidance.
- `high_risk_population` keeps its "(required)" suffix.

## Judgment calls for clinical review

- **When LR-5 criteria are evaluated.** "Not meeting LR-5 criteria" is read as
  the diagnostic table's LR-5 cells, evaluated in Step 1 before ancillary
  features. This follows the step order of printed pp. 8-9.
  - As a result, a nontargetoid LR-M feature on an observation that meets LR-5
    criteria and has a feature favoring benignity gives LR-5 in Step 1, then
    LR-4 after Step 2, with the LR-M tiebreak note.
  - Reading the condition after ancillary features would give LR-M instead.
    The Core's step order does not support that reading.
- **Unentered major features.** An unselected washout, capsule or threshold
  growth radio counts as absent. That is the calculator's existing convention,
  and it matches the p. 8 rule to treat uncertain major features as absent.
  - The nontargetoid prompt asks for all five major features, but only size
    and APHE are required before the table runs.
- **Tiebreak arrows.** The arrow direction in the Step 3 figure is drawn as
  graphics. The audit therefore checks the label's position, and the Manual's
  text states the LR-5 versus LR-M resolution explicitly.

## Found but not changed (outside this fix)

- **LR-3 downgrade missing.** A feature favoring benignity does not downgrade
  LR-3 to LR-2: the calculator says no further downgrade is possible. Printed
  p. 9 allows a one-category downgrade from LR-3 as well.
- **Stale threshold-growth wording.** The threshold-growth subLabel and result
  note still count a new observation of 10 mm or more as threshold growth.
  Printed p. 4 says v2018 moved that to subthreshold growth, which is an
  ancillary feature. A user following the subLabel could upgrade a 10-19 mm
  nonrim-APHE observation to LR-5.
- **Stale fixture.** `tests/fixtures/lirads-test-data.json` is not used by any
  test.
  - Cases 7, 32 and 33 and algorithm note 12 still describe the old LR-M order.
  - Note 5 still uses the v2017 threshold-growth definition.
  - Six other cases already disagree with current clinical-note text.
- **Dead reference link.** The calculator's ACR reference link
  (`/Clinical-Resources/Reporting-and-Data-Systems/LI-RADS`) returns HTTP 404
  since ACR moved its site. The live page is the one listed under Source.

## Reproduce

```bash
node scripts/audit-lirads-lrm-source.test.mjs          # live pins, layout, bindings, mutants
node --import ./scripts/register-jsx-loader.mjs --test tests/lirads-compute.test.mjs
npm run build && CI=true npx playwright test tests/e2e/calculators/hepatology/lirads.spec.js
```
