# IPSS — clinical review and urgent correction plan

ID `ipss`; route `/#/ipss`. Owner GPT-6 Astra; review started2026-09-08.
Source-based AI review, not certification. Preserve the deterministic sampling
calculator and report; do not turn it into an autonomous treatment selector.

## Current acceptance record — supersedes historical checkpoints below

Release branch `codex/ipss-safety-2026-09-08`, based on released main
`dd915adb3d39c78a2b35fa36124c7d794dc2869f`. Bounded source contract
and implementation are locally complete; independent code review found the
decimal-comparison defect and confirmed its correction. Fresh21 computation
groups,14 focused browser cases, nine deliberate mutations, complete
`npm run test:compute` (including313 fixture cases plus supplemental suites),
build, lint, invariants and registry validation pass. Owner inspected desktop,
clean mobile and print-media captures; clipboard verified. Native printing
was not tested. After rebasing onto that released base, fresh build, lint and
invariants passed; the full integrated Playwright run on implementation revision
`8875b1eeea2019b5e63d3587c757d872fef15ba2` passed1553 cases with zero failures,
skips or flaky results (2026-09-08T13:23:20Z,297628ms). Receipt:
`ipss-integrated-full-results.json` in the retained baseline proof directory.
This acceptance-record update changes no runtime or test files. Signed release
quorum, deployment and live acceptance remain pending. Full IPSS audit
remainders below remain explicit; this is not whole-calculator certification.

Tested file SHA-256 fingerprints:
- IPSS.jsx: `38d0bea50304a940a1d371ee1f9e93b81ae9b48f9f5a0028b11e97da631ae4be`
- App.jsx: `6f6f45a86d9786cddac21b0af89e89008b52712090c1ad9f7ebc3098cb6ca1f1`
- Actual-export tests: `8ee556ca197ce1424fbca9e61b739ab75753c5745b142f5ee21710e773baf490`
- Focused browser tests: `81aa49bee2e7736c793ae2420e51ecdab0601bc639a735d10eadfa521ab7b53b`

The earlier checkpoint paragraphs retain the source-review and RED-to-GREEN
history; statements such as "not edited yet" describe that earlier checkpoint,
not the current draft. The current supported contract is the owner-approved
completion contract after SVIN review plus the decimal and presentation fixes.

## Current state and demonstrated gaps

Live synthetic baseline ACTH left100/right50/peripheral20 and prolactin
left30/right30/peripheral10 returns ACTH ratios5/2.5 and prolactin ratios3/3.
The default empty post-CRH row produces a fictitious peak0 and+null minutes.
Changing peripheral ACTH to string0 produces Infinity ratios and still a
pituitary diagnosis/surgery instruction; peripheral prolactin0 produces
Infinity with successful-cannulation labels. Restoring values recovers. Receipt:
`ipss-live-triage.json` in the existing retained baseline proof directory.

Read the runtime calculation/report: partial post-CRH rows are silently skipped;
missing post-CRH prolactin is replaced with basal values; empty rows count as
stimulation evidence. Ratio-based output includes unconditional surgery and
side-directed hemihypophysectomy advice. These are separate from computing
descriptive sampling ratios and require correction/source adjudication.

## Reviewed clinical evidence

[Fleseriu et al.2021, author manuscript in the University of Sheffield repository](https://eprints.whiterose.ac.uk/id/eprint/180612/5/THELANCETDE-D-21-00487R1_Manuscript%20Clean.pdf),
DOI10.1016/S2213-8587(21)00235-7: manuscript p.13 lines245–250 and pp.16–18
lines318–365. IPSS is not a test to establish hypercortisolism; active cortisol
excess must be established when interpreting localization. False results occur;
prolactin may help assess sampling. The consensus explicitly cautions against
reliable right/left tumor localization from IPSS alone. These support removing
automatic surgery/side-directed resection advice and unconditional diagnoses,
not discarding useful ratios. PMC challenge, EuropePMC XML404 and publisher403
were encountered; the legitimate institutional manuscript was accessible.

## Required state and bounded implementation tasks

1. Strict complete finite-decimal input handling. Reject zero/negative/nonfinite
   required concentrations and undefined/nonfinite derived ratios before any
   diagnostic or cannulation interpretation. No parseFloat prefixes/coercion.
   Required numerical regression: the baseline above retains5,2.5,3,3; either
   zero peripheral denominator returns a recoverable error and no interpretation.
2. Distinguish wholly empty default rows from partially completed samples. Empty
   rows are absent, not a peak0 result or stimulation evidence. Reject partially
   entered ACTH/time data with a row-specific error. Preserve actual complete
   rows and their measured time. No null/NaN peak labels. Define the optional
   prolactin/correction method from its source before changing that algorithm;
   never silently mix unmatched measurements and claim a validated correction.
3. Replace treatment directives, exact-confidence claims attached to absent
   stimulation and unconditional pituitary/ectopic diagnosis with qualified
   localization-pattern reporting. State required clinical context, sampling
   limitations and unreliability of side localization for surgical planning.
   Preserve numerical ratios; no numeric threshold revision without the original
   derivation and applicable current guidance review. Carry limitations in copy
   and print. An empty post-stimulation section cannot justify an ectopic result.
4. Allowed next files: existing IPSS definition, focused actual-export tests,
   existing IPSS browser tests, this record and registry linkage. Touch shared
   dynamic-row code only if a reproduced problem cannot be fixed in the adapter.
   Tests first: all missing/zero/malformed fields; blank/partial/complete rows;
   valid-invalid-corrected recovery; independent arithmetic and representative
   guard/output mutations; actual copy, keyboard/mobile and print-media checks.
   Required full suite, signed reviews, exact deployment and live QA remain.

## Whole-audit remainder and disposition

Original basal/stimulated equality boundaries, sampling-adequacy conventions,
prolactin-normalized method and time matching, optional prolactin usability,
protocol/assay applicability, lateralization evidence and complete bibliography
remain to be adjudicated before full acceptance. A newly discovered2026 biomarker
consensus also needs scope review; no recommendation is inferred from its search
snippet. This urgent correction precedes routine ALBI/TI work once an active
implementation slot clears. No IPSS runtime has been edited or published yet.

## Implementation checkpoint — 2026-09-08

After KBRC live acceptance, reused its clean isolated workspace
`.worktrees/kbrc-baseline-verification` on new branch
`codex/ipss-safety-2026-09-08`, based on released main3cf6561. Preserved the
previous KBRC branch. Dependency installation succeeded; the three existing
dependency advisories remain separate from this calculator correction.

Six actual-export regression groups were added before runtime edits. Independent
basal ratios passed; five safety groups failed on the expected defects. The first
local change implements complete positive finite decimal basal input handling
and representability checks before interpretation. It preserves the independent
ratios and passes the two new basal guard groups. Three groups intentionally
remain failing while empty/partial rows and qualified report output are unfinished.
No thresholds changed. Draft runtime/tests are uncommitted in that workspace;
no full-suite, browser, signed review or IPSS release acceptance is claimed.

### Follow-on local checkpoint

Expanded to eight groups: measured complete stimulated sample preserves +3min
and independently derived peak10.00; malformed time/concentrations/row shapes
are rejected. New failing groups were observed before row changes. Empty rows
are filtered, partial rows return indexed errors, and validated ACTH ratios must
be representable. Post-stimulation time must be positive (the basal sample is
separate). Missing optional PRL fallback is still inherited and is NOT accepted
as a validated normalization method; resolve before release.

Reopened the institutional2021 manuscript and re-read pp.13,16–18. Draft report
now uses qualified localization patterns, omits unconditional diagnosis and
confidence percentages, and replaces surgical prescriptions with limitations.
All eight computation groups pass. Remaining metadata/info and lateralization
wording, normalized-ratio arithmetic/time matching, new browser regressions,
canonical/full checks and review/release gates remain. Draft is uncommitted;
this checkpoint does not assert a finished IPSS correction.

## Primary normalization study review — 2026-09-08

[Sharma, Raff and Nieman2011](https://pmc.ncbi.nlm.nih.gov/articles/PMC3232627/),
DOI10.1210/jc.2011-2149. PMC browser retrieval returned a challenge and EuropePMC
XML returned404; ordinary direct HTTP retrieved the public article successfully.
Read Subjects and Methods / Study analysis, Results / Evaluation of post-CRH
prolactin, Table3 and Discussion. Twenty-nine retrospective patients,25 with
pathologically proven diagnosis; small numbers of erroneous IPSS results.

Important correction to the initial suspicion: basal PRL normalization is an
intentional published method, not intrinsically a mismatched-sample error. The
study divides the dominant post-CRH ACTH IPS/P ratio by the ipsilateral BASAL
PRL IPS/P ratio. Substituting post-CRH PRL did not improve diagnostic accuracy
in that study. Current Radulator silently switches between basal and stimulated
PRL (even partly mixed within a row), then applies a bilateral lateralization
comparison. That hybrid must not be described as this study's validated method.

The study also describes two true-positive CD cases with low PRL ratios, and
states PRL assessment is not necessary when ACTH gradients already suggest CD.
Therefore the current early return when both basal PRL ratios are <=1.8 can
suppress useful ACTH information. A PRL criterion alone is not definitive proof
of failed catheterization. Keep numerical ACTH outputs with a qualified sampling
warning instead of equating low PRL with categorical procedural failure.

Next owner planning requirements before normalization edits:
- Separate dominant-side basal-PRL normalization from simultaneous-sample and
  bilateral lateralization methods; explicitly label the method and inputs.
- Do not infer surgical side or apply the unadjusted1.4 threshold to a new
  normalized method without its own source support. Preserve raw ratios.
- Independently derive a contrasting example: dominant stimulated ACTH200/20
  is10; basal ipsilateral PRL30/10 is3, yielding3.3333. Stimulated PRL60/10 is6,
  yielding1.6667 under a DIFFERENT method. Input availability must not silently
  switch3.3333 to1.6667.
- Add a regression with strong ACTH gradients but low bilateral basal PRL so
  sampling caution cannot erase the raw ACTH results.
- Review the newly found SVIN consensus DOI10.1161/SVIN.125.002309 and the2025
  original study PMC12404901 before making current-method or cutoff claims.
  Search snippets are discovery only; their full methods remain unreviewed.
No normalized-method algorithm change is authorized by this checkpoint alone;
it identifies the exact remaining decision/evidence work, not an audit completion.

### 2025 primary-study methods retrieved

[Sprenkeler et al.2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12404901/),
DOI10.1111/jne.70066, public PMC HTML retrieved by ordinary HTTP after the browser
challenge. Reviewed Methods2.1,2.3,2.5–2.7 and Discussion/limitations. Main cohort
19 patients/20CRH procedures,16CD and3EAS; one ectopic source unconfirmed.
Method1 uses dominant peak post-CRH ACTH divided by ipsilateral basal(t0) PRL
ratio. Method2 uses peak ACTH over all sampled times divided by concurrent PRL
ratio. Methods3/4 maximize the adjusted ratios across samples, a different
operation that did not distinguish groups in this cohort. Do not implement
max(adjusted ratios) as though it equals adjusting the unadjusted peak.

Both basal and concurrent methods have published precedent, but their selection
rules and proposed cutoffs differ. This is method/population heterogeneity, not
grounds to silently combine them or replace established criteria with this small
cohort's ROC thresholds. Retain separately labeled arithmetic if both are offered;
report missing data for the selected method, not a silent fallback. No claimed
100% accuracy or transplanting CRH thresholds to DDAVP. The SVIN guideline full
text still needs retrieval and review before final clinical contract approval.

## Owner-approved completion contract after SVIN review

[Siddiq et al., SVIN2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC13138407/),
DOI10.1161/SVIN.125.002309: public HTML retrieved directly. Reviewed Methods,
Important Lab Values, Figure5 caption, Timing, Stimulation and Proposed Procedure.
Adult scope; observational/heterogeneous evidence and consensus. It uses ACTH
IPS/P >=2 basal and >=3 stimulated, PRL IPS/P >=1.8 as support for adequate
sampling, and concurrent ipsilateral PRL at the dominant stimulated ACTH peak
for its normalized ratio. Neither low PRL nor right-left gradients independently
establish catheter failure or a surgical target. Numeric equality behavior can
now be corrected using this explicitly reviewed guidance; do not claim1991
source-literal thresholds without reviewing that original separately.

Approved implementation scope for the current repair:
1. Preserve raw basal and valid stimulated ACTH ratios regardless of PRL
   adequacy; low PRL adds caution and does not terminate numeric reporting.
   Basal/stimulated comparison uses >=2/>=3; PRL support uses >=1.8.
2. Keep CRH-labeled scope of existing interface. Do not silently claim a new
   DDAVP protocol implementation. No numeric management or procedural orders.
3. Replace the hybrid normalized bilateral lateralization block with explicitly
   labeled dominant-poststimulation-peak arithmetic: basal-PRL normalized ratio
   (2011 method) and concurrent-PRL normalized ratio (SVIN2026 Figure5).
   Both share the dominant UNADJUSTED stimulated ACTH peak, not a maximum across
   adjusted values. Report which side/time/denominator produced each value.
   No substitution of missing concurrent PRL and no inference of tumor side.
   Tied unadjusted peaks need explicit ambiguity handling, not silent side choice.
4. Missing entire optional PRL sets must preserve ACTH functions and say which
   assessment cannot be computed. Partially supplied sets are recoverable input
   errors. This replaces the current unnecessary mandatory basal PRL restriction.
5. Do not add normalized diagnostic cutoffs in this repair. The2011 basal method
   and2026 concurrent discussion have different lower cutoffs and evidence.
   Numeric outputs with method/source labels preserve useful clinical information
   without silently combining thresholds. Full cutoff presentation stays an
   explicit audit remainder, not a completed certification.
6. Hand-derived boundaries: basal40/20=2 and stimulated60/20=3 meet the displayed
   criteria; PRL18/10=1.8 supports adequacy. Strong ACTH100/20=5 with PRL10/10=1
   still reports5 plus sampling caution. Normalization contrast3.3333 vs1.6667
   above must be reported separately. Missing concurrent PRL cannot change the
   basal result or fabricate a concurrent result. Add overflow/underflow and
   tied-peak cases, then real browser/copy/mobile/print checks before full CI.
Source-based owner clinical planning complete for this bounded contract; full
audit acceptance, independent signed reviews and release proof remain pending.

Implementation follow-through: added RED tests for suppressed ACTH with low
bilateral PRL and exact basal/PRL equality. Removed the premature return and
changed current draft to the source-reviewed inclusive comparisons; ten groups
now pass. Descriptive sampling caution replaces definitive failure labels.
Normalization replacement, optional PRL sets and all remaining UI/report
wording are still pending; old header/info text has not yet been reconciled.
Do not publish this uncommitted partial draft. Canonical gates need refreshing
after the final changes; the earlier eight-group build is not final evidence.

Normalization implementation checkpoint: four new RED groups then GREEN;
14computation groups now pass. Runtime selects the dominant unadjusted stimulated
peak before adjustment; reports separate basal/concurrent denominators; no longer
silently substitutes prolactin or emits normalized lateralization/surgical-side
claims. Entire PRL sets are optional; partial sets rejected. Tied peaks produce
an explicit ambiguity notice and no arbitrarily selected normalized ratio.
Metadata/info now describe actual adult CRH scope with SVIN2026 criteria and
source references. Header comments, registry linkage, browser tests and focused
overflow/rounding/mutation coverage still require completion. All changes remain
an unpublished, uncommitted draft in the IPSS branch; no final audit claim.

## Browser checkpoint

Twelve focused Chromium cases passed (3.5seconds), including actual clipboard,
optional/partial PRL, recovery, ties, unadjusted peak selection, keyboard,
390px overflow and print-media visibility. No native-print claim. The temporary
configuration initially mixed two worktrees' Playwright installations; corrected
it to import only this candidate's configuration, then ran the tests successfully.
Retained proof: ipss-focused-results.json in the existing baseline proof folder.
Registry scope updated without upgrading seed-unverified. Full-suite, mutation,
final owner review, signed reviews and live release proof remain pending.

## Additional regression and registry checkpoint

Seventeen actual-export computation groups pass after adding independent
right-sided normalization (10/5=2 and10/4=2.5), unadjusted-versus-adjusted peak
selection, and nonrepresentable normalization cases. These exercise existing
draft behavior; no new clinical rule was introduced in this checkpoint.
Eight deliberate runtime mutations are rejected by the real computation tests,
including wrong-side normalization, substituted concurrent data, ignored ties,
nonrepresentable output, exclusive basal equality, automatic diagnosis and
silently skipped partial samples. Production files are not modified by this
in-memory mutation runner. Receipt: ipss-mutation-results.json in the retained
baseline proof folder.

The canonical `npm run test:hermes-guideline-registry` passes for43 exports
(including the nonmedical feedback export; this is not43 medical calculators).
An initial direct Node invocation omitted the repository JSX loader and failed
before registry execution; using the documented command resolved that invocation
error. `git diff --check` passes. Full integrated suite, final visual/report
review, signed reviews and live acceptance remain outstanding. No IPSS release
or whole-calculator audit completion is claimed.

## Owner visual-review findings and scoped follow-through

Headless Chromium capture exposed two presentation gaps: the shared result
renderer highlights the first result entry, currently a long context warning
rather than the computed finding; and IPSS-specific sample-table help is
hardcoded in App.jsx with the obsolete improved-lateralization claim. Desktop
automation was unavailable because the Mac was locked; headless capture and
actual clipboard worked without unlocking it. Screenshots were inspected.

Approved correction: prepend a concise numerical ACTH sampling summary, retain
the full clinical limitations below, and use neutral informational severity
rather than a green success cue for a positive localization pattern. Replace
only the IPSS-specific help paragraph in App.jsx with actual measured-time,
same-analyte unit consistency and optional-complete-PRL guidance. No shared
renderer rewrite or new clinical criteria. Add tests before those edits.
The mobile table is internally scrollable; printed mobile-width capture clips
its columns and must not be counted as a verified full-input print report.
Final print QA must use an appropriate page width and preserve input context.

The subsequent900px print-media capture still clipped sample columns. Header
and data grids have independent intrinsic minimum widths; filling the final
input also leaves their overflow container scrolled. This is an IPSS-specific
input/report defect, not just a narrow screenshot. Extend the allowed App.jsx
change to matching header/data column tracks, a seven-column print layout with
the action column hidden, and print overflow visibility. Add a geometry-based
browser regression before the layout edit; preserve the existing scrolling
table on narrow screens. No shared CSS or other calculator layout changes.

Follow-through: the alignment test first failed with an83.25px header/input
offset. Matching grid tracks and seven-column print styles now pass it; all14
focused Chromium cases pass. The new summary test first failed on the long
context warning; all18 computation groups now pass with the concise numerical
summary leading the report. Eight representative mutations still fail as
expected. Fresh build, lint, invariants and registry checks pass.

Owner inspected the updated900px print-media screenshot: all seven sample
headers and values are visible and aligned, with the summary and limitations
retained. Actual clipboard contains both normalization values and limitations;
no page errors, and390px document width does not overflow. Files:
ipss-visual-check.json, ipss-desktop-report.png, ipss-print-media.png in the
retained proof folder. Mobile capture also shows the open navigation drawer;
closing/navigation behavior needs a clean mobile-context check before claiming
the final mobile walkthrough. Native printing was not tested. These findings
do not replace full integrated tests, independent review or deployed proof.

## Independent code review and decimal-precision correction

Read-only reviewer reproduced exact decimal ACTH30.9/10.3 returning just below3,
PRL18.54/10.3 returning just below1.8, and mathematically tied peaks30.9/10.3
and60/20 being treated as different. Owner reproduced these in two failing
actual-export regression groups before correcting comparison arithmetic.
Validated entered decimals are now converted to integer fractions; threshold
and peak/tie comparisons use exact cross-products. No tolerance is applied:
30.899999999999999/10.3 and18.539999999999999/10.3 remain below their respective
criteria. Display and descriptive normalization retain finite-number guards.
BigInt intermediates never enter returned results or clipboard serialization.

The same reviewer checked the correction read-only with seven decimal,
scientific and numeric spellings and extreme equal ratios, found the important
defect resolved and no new blocker in that scope. A third RED-to-GREEN test
clarifies the invalid-ACTH message so it does not require optional prolactin.
All21 actual-export groups pass; nine deliberate mutations are caught. Fresh
build/lint/invariants pass. This is independent code review, not the signed
release quorum or a full clinical audit.

Clean390px mobile-context QA also passed opening/closing navigation and a
basal-only calculation with absent PRL. The drawer clears the content after
its transition; the earlier resized-desktop screenshot captured that transition,
not a reproduced persistent obstruction. Proofs: ipss-mobile-clean-viewport.png
and ipss-mobile-clean-report.png. Native printing remains untested.
