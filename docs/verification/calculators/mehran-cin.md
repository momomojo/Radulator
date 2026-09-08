# Mehran CIN: clinical review and bounded correction plan

Owner: coordinating Astra; source-based AI review, not professional certification.
Review date: 2026-09-08. Calculator ID and public routes remain `mehran-cin`.
Reviewed implementation: `src/components/calculators/MehranCIN.jsx` at main
`58a8a912b99c6b3865f80c6f0db374feed49fd6c`.

## Current state and demonstrated defects

The existing tool adds clinical factors, contrast-volume points and either supplied
eGFR tiers or a creatinine threshold, then displays historical risk-group rates.
It also invents an eGFR from creatinine without collecting age or sex, derives
purported contrast limits, and generates score-linked treatment instructions.
The tool's description broadens applicability beyond its PCI derivation setting.

Fresh actual-export probes of the reviewed revision:

| Synthetic inputs | Observed output | Problem |
| --- | --- | --- |
| Creatinine 1 mg/dL; contrast 100 mL; other factors false | Score 1; eGFR 123; target 246 mL / maximum 369 mL | No age/sex inputs or supported eGFR equation; derived limits compound the error. |
| eGFR 19; contrast 100; hypotension, IABP, CHF and diabetes true | Score 25; hydration 1.5–3 mL/kg/h for 6–12 h; prophylactic renal replacement access | Score alone does not authorize these interventions; severe CHF requires individualized hydration. |
| eGFR -1; contrast -100; other factors false | Score 0, low risk, 7.5%, success styling and hydration advice | Invalid measurements produce an apparently usable clinical report. |

The original-study link uses DOI suffix `.06.034`; the Mehran paper is `.06.068`.

## Evidence actually reviewed

1. [ESUR renal adverse reactions](https://esur-cm.org/index.php/en/b-renal-adverse-reactions),
   public guideline page, B.2.2–B.2.3, B.4.1 and B.5, read 2026-09-08.
   Hydration is individualized in severe CHF/end-stage renal failure. Its stated
   contrast-volume/eGFR ratio is conditional on first-pass renal exposure and
   iodine concentration, not a universal safe maximum. Metformin precautions
   depend on renal function, AKI and exposure route, not a Mehran score category.
   The page contains legacy renal-estimation guidance; it is not authority to
   implement a new eGFR formula here. Review is limited to these claims.
2. KDIGO 2012 AKI guideline, [Section 4](https://pmc.ncbi.nlm.nih.gov/articles/PMC4089629/),
   retrieved through the legitimate [Europe PMC full-text XML API](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4089629/fullTextXML)
   after the PMC HTML route returned a browser challenge. Chapter 4.5,
   recommendation 4.5.1 advises against prophylactic intermittent hemodialysis or
   hemofiltration for contrast removal. This does not forbid dialysis for other
   established clinical indications. Chapter 4.2, risk-model discussion and Table
   15 identify the PCI setting and the alternative renal-function score inputs.
   This historical guideline is corroboration, not a claim of a current complete
   AKI-guideline review or independent rederivation of every score output.
3. Mehran et al. 2004, DOI
   [10.1016/j.jacc.2004.06.068](https://doi.org/10.1016/j.jacc.2004.06.068),
   [PubMed 15464318](https://pubmed.ncbi.nlm.nih.gov/15464318/).
   Bibliographic identity established; publisher full text returned HTTP 403.
   Full derivation tables, contrast-volume rounding, endpoint timing, exclusion
   criteria and all four dialysis-rate values are NOT yet independently accepted.

### Retrieval outcome, 2026-09-08

The publisher full-text endpoint returned403, while its abstract page explicitly
offered subscription/purchase access. A university-hosted CiteSeerX original-paper
copy was identified at
<https://citeseerx.ist.psu.edu/document?doi=1dfede89cab98b8cc1286a3399efced31e3c0616&repid=rep1&type=pdf>;
both web retrieval and a30-second direct download timed out. No PDF or table was
successfully inspected, so its search excerpts do not close the gap. OpenAlex's
DOI record listed no open repository full text. A bounded author/title/PDF search
returned later studies and reproductions, not an additional accessible original.
Do not repeat these failed routes continuously or bypass subscription controls.
Revisit when an accessible original or user-supplied copy is available.

This does not block the independently supported removal of invented measurements
and unsafe treatment outputs. The first safety repair must not claim complete
original-score validation or change ambiguous score rules merely to match tests.

## Required state

Preserve a useful original-2004 PCI risk calculator, not a generic IV-contrast
clearance or treatment tool. Display score contributions, the selected renal
input method, historical cohort-rate context and concise applicability limits.
Do not replace the score with a reference selector or silently upgrade to a
different Mehran model. Distinguish anticipated procedural inputs from completed
procedure inputs; estimates are conditional, not guarantees or causal attribution.

Immediate safety correction approved by owner review:

- Remove invented eGFR and its derived contrast limits. A supplied eGFR may be
  reported as supplied, never as a newly calculated measurement.
- Remove score-triggered hydration doses, blanket medication holds, prophylactic
  dialysis-access advice and universal maximum-contrast claims. Replace with
  concise source-linked context that prevention requires renal function, exposure
  route and volume-status assessment; explicitly individualize hydration in CHF.
- Reject malformed, nonfinite, nonpositive renal measurements and negative
  contrast volume before producing a score/report. Do not coerce invalid supplied
  values to zero or silently ignore them when another renal input is valid.
- Make renal-input precedence explicit if retaining both fields; do not double
  count. Preserve existing score rules until primary-source adjudication below.
- Correct the original DOI and narrow misleading non-PCI applicability wording.

## Tasks and independent acceptance

1. **Finish score-source adjudication before formula changes.** Seek legitimate
   open author/institutional or publisher copies of the original study. Resolve
   volume-point rounding, eGFR boundaries and method, all event-rate strata,
   definitions and exclusions. KDIGO Table 15 has coarse integer labels and
   inconsistent shorthand inequalities; do not normalize those by guessing.
   Unknown contrast volume must not masquerade as known zero; decide and document
   required-input versus explicitly partial-score behavior before implementation.
2. **Bounded safety repair, test first.** Allowed runtime file: existing Mehran
   definition only; add focused actual-export and existing-route browser tests.
   Update its registry justification and generated inventory through the existing
   generator. No shared-component or release-controller rewrite.
3. **Independent regression cases.** Creatinine 1 plus 100 mL must not emit any
   inferred eGFR or contrast maximum. The CHF/eGFR19 case must not emit a fixed
   hydration regimen or prophylactic dialysis-access instruction. Negative,
   malformed, infinity, partial-decimal, object and boolean numeric inputs must
   yield a recoverable error with no clinical report. Invalid-to-valid and
   valid-to-invalid UI transitions must not leave stale results. Prove removal
   tests fail when the unsafe outputs are deliberately restored. Derive exact
   full-score boundary vectors only after task 1; observed implementation values
   above are defect reproductions, not independently certified expected answers.
4. **Owner final acceptance and release.** Inspect source/code and report copy,
   mobile/keyboard interaction, print layout and preserved deep links. Run local
   canonical gates plus full final-candidate suite; retain separate signed exact-
   head reviews and artifact/live QA. No native-print claim from a print stub.

## Scheduling and completion record

- Confirmed unsafe management/output behavior makes this an urgent next repair,
  ahead of routine prostate/ALBI work. DLP is already in signed review; KBRC is
  committed locally. Do not open a third runtime implementation while those two
  scopes are active. Reassess release order when DLP completes; preserve KBRC work.
- Source-based safety review: recorded above, bounded scope only.
- Complete original-score clinical review: pending source retrieval/adjudication.
- Implementation, new regression tests, browser acceptance and deployment: pending.
- Existing registry status is not upgraded by this document. No whole-calculator
  completion, current-guideline certification or production repair is claimed.

## Implementation input contract — owner decision before edits

For the bounded repair, require an explicit finite contrast volume >=0; a blank
volume is unknown, not zero, and must produce an error rather than a partial score
with a full risk report. Retain current whole-100mL scoring for compatibility;
this is not a claim that its rounding has been independently validated. Supplied
eGFR takes precedence over supplied creatinine, but validate both if entered and
state the selected method in the report. Optional blank renal fields are absent;
at least one valid positive renal measurement is required. Checkbox inputs follow
the existing explicit boolean UI contract (omitted/empty means unchecked);
reject other types rather than treating strings such as false as checked.
Preserve existing point/rate tables in this bounded repair and keep their
unresolved full-audit provenance explicit. No blanket clinical verification.

### Local test-first checkpoint

Reused the now-released DLP workspace on branch
`codex/mehran-safety-2026-09-08` from mainfa95f0b, preserving the DLP branch.
Six actual-export regression groups failed against the original implementation,
then passed after the bounded output/input repair. npm ci, build, lint and
invariants passed. No Mehran PR or deployment. Browser regressions, compatibility
fixtures, mutation checks, registry linkage, final integrated full suite and
independent signed review remain pending. Runtime and tests are an uncommitted
local draft; do not treat this checkpoint as full clinical acceptance.

### Subsequent bounded verification — 2026-09-08

All 44 focused Chromium tests passed, including invalid-input recovery, actual
clipboard output, 390px mobile overflow checks and print-media report visibility.
Print-media emulation is not native printing. Owner desktop browser/clipboard
inspection also confirmed the scope limitation and absence of invented eGFR and
contrast limits. The aggregate computation suite, registry validation, build,
lint and invariants passed during this draft's verification.

An in-memory mutation run executed the same six actual-export test groups against
the unchanged control (zero failures) and four separate mutations: restored
invented eGFR, restored fixed hydration, accepted unknown volume, and accepted
negative volume. Each mutation caused a regression group to fail; no production
file was modified by that experiment. The 4,480 valid-input comparison cases
preserved existing score/category/rate outputs; compatibility does not validate
their unresolved medical provenance.

Read-only independent draft review found no actionable defect in the bounded
repair. This is not either required signed release review. Final integrated
testing on the release base, signed reviews, deployment and live proof remain
pending. No whole-calculator audit completion is claimed.

Additional whole-audit usability gap: the existing checkbox renderer in
`src/components/forms/Field.jsx` omits `subLabel`, hiding definitions present in
the Mehran field metadata. Confirm and expose the reviewed clinical definitions
in a separately scoped correction; this repair does not change shared components.
