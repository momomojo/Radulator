# Wells DVT — clinical review and gap plan

Permanent ID `wells-dvt`; source `src/components/calculators/WellsDVT.jsx`.
Owner source-based review started2026-09-08; incomplete, not certification.

## Latest acceptance checkpoint

The entries below retain the source-review and implementation chronology; this
checkpoint supersedes their earlier pending local-test statements. At commit
`6abd5a9d226a8ddc780c86fc1f5fbeb4ea646730`, on released main
`ce67c278239389c88a14c37d14010a19d65646dd`, the final production-preview
Playwright run passed all1545 tests, with0 failures/skips/flaky cases and no
runner errors, retries0. It started2026-09-08T14:54:36.112Z and completed in
293396.934ms. Receipt: `wells-dvt-integrated-final-results.json` in the retained
baseline proof directory. The earlier1544/1 failed run remains retained too.

Owner reread the complete candidate diff against the approved source-specific
contract. This evidence-only update does not alter the tested runtime, tests,
dependencies or build configuration. Required final-head CI, independent signed
primary and verification reviews, protected merge, exact deployment readback
and live browser acceptance remain outstanding. Registry status remains
seed-unverified; this is not whole-calculator audit completion.

## Current state

Owner read the entire implementation and exercised the public route. Selecting
calf swelling and previous DVT returned2points; adding active cancer returned3.
Changing an input cleared the previous result. No page errors were observed.
Live result text includes `Calf swelling >3 cm`; the input also says bedridden
`>3 days`. The displayed recommendations include repeat/whole-leg ultrasound
and anticoagulation context without collecting the complete pathway inputs.
Existing 3-tier/2-tier prevalence percentages require population-specific
provenance; arithmetic alone does not establish their applicability.

Retained synthetic observation: baseline proof directory `acute-live-triage.json`,
2026-09-08T13:53:39Z; public index SHA256
749ee631cb46f09a8bfb085b02e70b8e751d691f59f88517604a0238033f1578;
loaded WellsDVT-BCKMSsPd.js SHA256
8a1c2b3cd8fbce7e2828214075af2f2f02a0cc0236722f1c471c3179a93372f1.
These identify observed content, not source-to-artifact release acceptance.

## Evidence and present gap

[NICE NG158 recommendations, Table1 and section1.1](https://www.nice.org.uk/guidance/ng158/chapter/Recommendations),
official search-index text retrieved2026-09-08. Direct page requests returned403;
do not claim full-page review. Table1 explicitly includes exactly3days bedridden
and exactly3cm calf difference. It assigns one point to each of nine positive
features and minus2 for an alternative diagnosis at least as likely; the two-level
boundary is2points. The current strict-greater-than labels therefore exclude
two source-defined equality cases. This is a label/selection defect, not a
reason to change the point weights.

Full diagnostic pathway, population/exclusions and original2003 study remain
to be read through legitimate accessible sources before approving revised
management text. The current pregnancy-PE reference is off-topic for a general
lower-limb DVT score; verify and replace with directly applicable evidence.

## Required state and independently derived cases

Preserve lower-extremity clinical probability scoring, permanent URL and useful
score breakdown. Clearly separate probability assessment from definitive DVT
diagnosis; annotate cohort prevalence rather than present individual risk.

- Exactly3cm calf difference plus previous DVT:2points, two-level likely.
- Exactly3days bedridden plus previous DVT:2points, two-level likely.
- Previous DVT alone:1point, two-level unlikely.
- Alternative diagnosis alone:minus2points; nine positive features plus that
  alternative:7points. Negative score is arithmetic, not proof of exclusion.
- Test every feature weight, category-changing totals, malformed booleans,
  changing inputs, report/copy wording and keyboard/mobile interaction.

## Bounded tasks and dependencies

1. Complete primary-source and current-guidance review; adjudicate prevalence,
   three-tier model, diagnostic pathway and notes before any medical edits.
2. Fix prescribed inclusive equality labels and report breakdown with regression
   cases. Do not infer new treatment criteria from the two-level score.
3. Correct citations and any unsupported claims according to that reviewed plan;
   preserve supported score functionality. Allowed files: this calculator,
   its focused tests, this record, existing registry/generated inventory.
4. Final owner source/code/browser review, signed release gates, deployed revision
   and live proof. No new implementation lane until current IPSS/radiation work
   has room under the two-lane limit.

## Completion record

Clinical review partial; no implementation, independent full case matrix,
mutation acceptance, complete browser/report acceptance or release yet.
Do not upgrade the registry from this triage or count it as a completed audit.

## Source-access and pathway review update

The initial403 was retrieval-tool-specific, not a paywall: ordinary HTTPS
downloads of the official NICE PDFs succeeded. Owner read full-guideline
printed pp5–10 and visually inspected page1 of the visual summary, including
arrows and footnotes. Sources:
[NG158 full guideline](https://www.nice.org.uk/guidance/ng158/resources/venous-thromboembolic-diseases-diagnosis-management-and-thrombophilia-testing-pdf-66141847001797)
and [official visual summary](https://www.nice.org.uk/guidance/ng158/resources/visual-summary-pdf-11193380893).
Local read-only copies: /tmp/radulator-ng158-full.pdf and
/tmp/radulator-ng158-visual-summary.pdf; portable locators above govern.

The two inclusive boundaries are now directly source-confirmed. NICE's scope is
adults, excluding pregnancy. Its likely-score pathway uses proximal ultrasound,
then D-dimer if negative; repeat imaging at6–8days belongs to the negative-scan/
positive-D-dimer branch, not every negative scan. The unlikely-score pathway
starts with D-dimer. Interim anticoagulation depends on investigation delays and
clinical assessment; existing long-term secondary-prevention therapy and COVID
prophylaxis have explicit exceptions to stopping interim therapy. A generic
one-week-repeat instruction omits clinically relevant branching.

[Wells2003 PubMed abstract](https://pubmed.ncbi.nlm.nih.gov/14507948/) read directly:
randomized outpatient suspected lower-extremity-DVT evaluation,1096participants,
not a universal risk-percentage calibration. Its negative-D-dimer plus unlikely
clinical-probability strategy supports avoiding ultrasound in that study setting.
The publisher full text request returned403; other legitimate full-text routes
remain to try. Do not infer all exclusions, exact prevalence strata or assay
details from the abstract.

Implementation planning decision: retain a useful deterministic probability
score and concise, explicitly conditional diagnostic context. Do not turn this
into an anticoagulant prescriber or silently apply the NICE pathway to pregnancy.
Before finalizing the whole-calculator contract, reconcile the original score
version, three-tier prevalence provenance and applicable non-NICE guidance
(including proximal versus whole-leg ultrasound pathways). No new clinical
runtime change is approved solely by this partial update.

## Cross-guideline reconciliation — do not mix pathways

Owner retrieved and read ASH2018 lower-extremity recommendations5a–8 and
their remarks from [the PMC full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC6258916/)
using ordinary HTTPS after the web retrieval tool returned a browser-check page.
Local source: /tmp/radulator-ash2018-diagnosis.html. The
[ASH diagnosis guideline page](https://www.hematology.org/education/clinicians/guidelines-and-quality-care/clinical-practice-guidelines/venous-thromboembolism-guidelines/diagnosis)
still lists this guideline and explains its review/monitoring status; do not
rename it a2026guideline.

ASH distinguishes low, intermediate and high pretest-probability populations,
ultrasound extent and recurrence. At intermediate probability, a negative
whole-leg study needs no further testing; a negative proximal study may require
serial imaging when no alternative diagnosis is identified. High-probability
negative imaging also warrants further assessment. Prior images matter in
suspected recurrent DVT; D-dimer usefulness is limited in several populations.

Thus the existing whole-leg/serial-US wording is not intrinsically unsupported;
it resembles an ASH strategy but omits its conditions. It must not be declared
wrong merely because it differs from NICE. The actual defect is an unlabeled,
incompletely conditioned recommendation alongside uncalibrated prevalence text.
Keep source-specific pathways separate in any revised presentation. A material
choice between pathways requires independent review and the user's presentation
decision, not an owner-invented hybrid. Inclusive NICE labels must also be
identified as the selected source version when reconciling historical wording.

Next source leads: original1997study located in the Penn State CiteSeerX archive;
2003publisher PDF remains403;2014individual-patient meta-analysis
PMC3948465 may clarify version/subgroup calibration. None has yet been read
in full. No inaccessible-source exception or full review completion is claimed.

## Historical calibration and modified-score reconciliation

Owner read the full main text of [Geersing et al., BMJ2014;348:g1340](https://pmc.ncbi.nlm.nih.gov/articles/PMC3948465/)
(including Tables1,3–6 and limitations; appendices not yet inspected). This
individual-patient analysis included10002outpatients from13studies, not inpatients.
It distinguishes the original score from the modified score that adds prior DVT.
The current runtime already assigns that point; do not add another point for
recurrence. Its Table1 uses historical strict-greater labels and a4-week surgery
window, whereas the NICE-adapted current rule has inclusive labels and12weeks.
This establishes a version difference, not license to combine whichever fields
yield preferred outputs. Prediction varies by population and prevalence; a score
alone cannot exclude DVT. Cancer/recurrence findings need explicit applicability
and must not become a universal numeric risk or automatic rule-out claim.

[Wells et al., JAMA2006;295:199–207](https://pubmed.ncbi.nlm.nih.gov/16403932/)
abstract directly confirms the three-tier5%,17%,53% estimates from a systematic
review of14outpatient studies. Thus those values are not invented. Retainable
presentation: historical pooled cohort context with the correct source and
uncertainty, separate from the calculated score/category. Do not claim they are
individual calibrated probabilities or the original1997study's rates.
The current6%/28% two-tier estimates are also described in CHEST2012indexed
text, but relevant full-text retrieval/locator verification remains before
final acceptance. Original1997archive retrieval timed out after30seconds;
2003publisher PDF returned403. No access-control bypass attempted.

Proposed clinical target: explicitly name the modified Wells rule/version,
preserve both supported category interpretations, and label historical cohort
context without patient-specific calibration. Preserve meaningful conditional
imaging guidance, separate source-specific algorithms, and require independent
review of any material pathway presentation choice. Remaining work is not merely
to delete everything except arithmetic: input definitions, intended population,
score/report usefulness, diagnostic limitations and citation accuracy all need
the planned acceptance matrix.

Two-tier prevalence retrieval gap resolved: owner read
[CHEST2012 diagnosis guideline, section3.1.1](https://pmc.ncbi.nlm.nih.gov/articles/PMC3278048/),
including the reference32 linkage. It explicitly reports likely28% (95%CI24–32)
and unlikely6% (95%CI4–8), alongside the three-tier historical pooled estimates.
Keep the distinction between guideline-reported historical validation rates
and a directly inspected original trial. This supports carefully attributed
cohort context, not automatic individual risk estimation. Local full-text copy:
/tmp/radulator-chest2012-dvt.html. Current guidance remains NICE/ASH, not a
silent upgrade of a2012reference to current management authority.

## Owner-approved implementation contract — 2026-09-08

The source review above supports a named NICE-adapted modified Wells scoring
implementation. The two-level result is primary. Preserve the familiar secondary
three-band grouping, but do not label it an independently calibrated current
model or silently call the modified score the original1997rule. No full
diagnostic, anticoagulant-prescribing or recurrence-imaging algorithm is added.

1. Preserve all10 permanent field IDs and the route. Nine positive items each
   contribute1; the alternative diagnosis contributes-2. Undefined flags mean
   unselected; supplied flags must be booleans. Strings, numbers, null, arrays
   and objects produce error-only output. No truthy coercion or partial score.
2. Identify NICE NG158 Table1 as the applied definition: bedridden at least3days
   or major surgery in12weeks requiring general/regional anesthesia; calf
   difference at least3cm. Apply these definitions consistently in inputs,
   help and report. Keep the clinician-measured calf context. This is not a
   versionless synthesis with the older4-week surgery rule.
3. Primary two-level category: score>=2 likely, otherwise unlikely. Secondary
   historical bands: <=0 low,1–2 moderate,>=3 high. Report score, selected-item
   breakdown and version. Unselected items mean not entered as present, not
   proof of examination. Zero/negative results must not state DVT excluded or
   imply that no risk exists; use informational rather than clearance styling.
4. Historical cohort prevalence must be separately labeled, not embedded as an
   individual probability: two-level6%/28% with CHEST2012section3.1.1 provenance;
   three-level5%/17%/53% with Wells2006 systematic-review provenance. Explain
   population/version dependence and that these are not recalibrated estimates
   for this exact NICE-adapted input set or special populations.
5. Give concise NICE-labeled next-investigation context, not an asserted patient
   diagnosis. Unlikely starts with D-dimer; positive leads to proximal ultrasound.
   Likely starts with proximal ultrasound, with D-dimer after a negative scan.
   The likely/negative-proximal/positive-D-dimer branch calls for repeat proximal
   imaging6–8days later. Do not apply that repeat instruction to every negative
   scan or attach unconditional negative-predictive-value claims. Link the full
   pathway for timing and interim treatment; do not issue start/stop instructions
   without the missing clinical inputs.
6. Preserve separately labeled ASH reference context: whole-leg versus proximal
   strategies depend on pretest-probability population, recurrence and image
   quality. Do not combine ASH repeat-scan branches with the NICE pathway.
   The selected primary presentation follows its named input definition, not a
   finding that ASH is wrong. No material contradictory recommendation is adopted.
7. State adult suspected lower-extremity DVT scope; pregnancy, pediatric and
   upper-extremity evaluation are not supported. Historical calibration is
   predominantly outpatient; inpatient/cancer/recurrent disease need contextual
   assessment. Prior DVT is counted once; compare previous imaging when relevant.
   Remove score-driven treatment-duration advice, invented combined-swelling
   specificity and negative-score reassurance. Keep concise diagnostic limitations
   and relevant references; remove duplicate/fictitious and pregnancy-PE citations.

### Independent acceptance cases and allowed work

All1024 boolean combinations: expected sum of independently specified nine
unit weights and-2alternative weight, complete totals-2..9, both band boundaries
and exact selected-item breakdown. Explicit fixtures: allfalse0; prioronly1;
calf+prior2; bedrest+prior2; calf+prior+cancer3; alternativeonly-2;
allpositives9; allpositives+alternative7. Verify no double recurrence point.
Mutations of a positive weight, alternative sign, either category boundary,
boolean guard and unconditional rule-out/repeat-scan wording must be detected.

Small tasks: first actual-export/source-definition regressions; then scoped
calculator correction; then focused browser/report/copy/mobile/keyboard recovery;
finally registry linkage, canonical/integrated checks and protected release.
Allowed files: WellsDVT.jsx, its dedicated browser/compute tests, this document,
guideline registry and generated inventory. Use `navigateToCalculator` in the
dedicated browser spec and verify `spec-map.js --check` before push. Do not edit
shared components, deployment gates or another calculator for this change.

Owner final acceptance must compare the implementation with the source-specific
contract, not just test counts. This plan approves implementation, not a verified
registry status; final live proof and any remaining full-audit limitations must
be recorded explicitly. Radiation PR262 remains the separate release lane.

## Local review correction and verification — 2026-09-08

Independent read-only review found that the score breakdown dropped the surgery
anesthesia qualifier and calf comparison/measurement context. The owner reproduced
the failing actual-export test before restoring both qualifiers in the report.
All 1,024 input combinations now check selected-item identities and weights, not
just the number of entries. Eight compute groups pass. Nine deliberate mutations
are caught, including assigning a different finding's label without changing its
weight. This does not change the clinical scoring rule.

Supplemental measurement source: NHS Borders, *Deep Venous Thrombosis —
Ambulatory care plan*, Diagnosis / Initial Assessment and Wells clinical score
table, accessed 2026-09-08:
https://www.rightdecisions.scot.nhs.uk/nhs-borders-clinical-guidelines/acute-services/ambulatory-care/deep-venous-thrombosis-ambulatory-care-plan/
The public HTML was read directly after the browsing service returned 403. It
specifies the 10 cm below-tibial-tuberosity measurement and comparison against
the asymptomatic side. Scope of use is this measurement detail only: the page
contains a prior-PE-or-DVT item different from NICE's prior-DVT item, which is
not adopted, and its embedded review-date field is 2024-02-28. Its management
pathway is not treated as current national guidance. The attempted ESVS PDF
download returned HTML, so no ESVS full-PDF review is claimed.

Fresh production build, lint and invariants passed after the report correction;
all 30 dedicated browser tests passed with retries disabled. These include copy,
input changes, print-media layout, and mobile keyboard/report checks. Native
printing is not claimed. Full integrated tests on the finalized release base,
signed release review, deployment, and live acceptance remain pending. The
registry remains seed-unverified; this checkpoint is not full-audit completion.

The same independent reviewer rechecked the two corrections and the strengthened
test, finding no remaining actionable issues within that scope. The owner also
read the runtime/test/registry diff. This is not a signed release authorization.
Focused browser receipt: retained baseline proof directory,
`wells-dvt-focused-results.json`; mutation receipt: `wells-dvt-mutation-results.json`.

At implementation commit `be3cc4f`, `npm run test:compute` completed with exit0:
313 fixture cases across12 fixture files, KBRC supplemental checks and all
discovered supplemental compute suites, including the eight Wells groups.
This is cross-catalog computation regression evidence, not the still-pending
full Playwright release suite or independent validation of every fixture.

## Final-base integrated check and shared badge correction

Rebased cleanly onto radiation release `ce67c278239389c88a14c37d14010a19d65646dd`.
Fresh build, lint, invariants, generated-inventory freshness and42/42 dedicated
spec discovery passed. The first full production-preview run at90df332, retries0,
completed1544 passed/1 failed/0 skipped/0 flaky in294447 ms. Retained receipt:
`wells-dvt-integrated-full-results.json` in the baseline proof directory.

The only failure was the shared guideline-badge test's old `Wells Criteria (2003)`
expectation. The captured actual page displayed the owner-approved
`Modified Wells DVT / NICE NG158` label. Repository search found no other stale
badge expectation. The owner expanded the bounded test scope to
`tests/e2e/calculators/guideline-badges.spec.js` and changed only that expected
string; the exact-text assertion remains. Focused reproduction now passes1/1
with retries0; changed-file lint and diff whitespace checks pass. No clinical
runtime or expected score changed. The corrected final-head full suite is still
required; no Wells release or complete clinical audit is claimed here.
