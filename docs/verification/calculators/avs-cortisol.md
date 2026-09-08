# AVS cortisol — current-input report ownership

Permanent ID `avs-cortisol`; source
`src/components/calculators/AdrenalVeinSamplingCortisol.jsx`.

## Current state and owner-approved task

Owner live triage2026-09-08 used synthetic IVC cortisol10/epinephrine100,
left100/1000 and right20/1000 in standard units. Results showed AV/PV10 and2,
CLR5. Editing right cortisol to200 retained the old report and CSV until explicit
Calculate, which returned AV/PV10 and20, CLR2. Receipt:
`custom-calculator-live-triage.json`,2026-09-08T14:52:38.168Z. No clinical
validation is inferred from this observed arithmetic.

Owner read all838 lines of the current component. As in the aldosterone form,
results are only set by Calculate; measurement/metadata/unit setters and four
sample-structure handlers never invalidate them. CSV uses stored results with
current units. Required behavior: an actual input or sample change withdraws
the old report and export until recalculated, preserving all entered data.
Focus and downloading a current report must not clear it. Apply the already
tested local invalidation pattern, not a shared-component or architecture rewrite.

Allowed files: this document, this calculator and its new state browser spec.
First reproduce the stale-state failures against actual controls, then implement
minimal invalidation. Do not change formulas, thresholds, units, interpretation,
sample selection or CSV format. This pairs with the same defect in aldosterone
AVS in the existing implementation lane; it does not start a third lane.

## Independent acceptance cases

Using the synthetic data above, old CLR5 must disappear after right cortisol
becomes200; recalculated CLR2 and CSV right ratio20 must reflect the new input.
Cover peripheral and adrenal measurements, metadata, cortisol-unit changes,
sample time and both sides' add/remove actions. Check actual downloaded bytes,
input preservation and unchanged-focus behavior. Existing end-to-end tests are
regression evidence only, not independent evidence for inherited clinical rules.

## Outstanding clinical audit and completion

Clinical source review of Young2008 and Acharya2019, intended population,
epinephrine threshold, finite/missing inputs, peripheral-site pairing, selective
sample aggregation, equality/indeterminate cases, CSV escaping and medical
interpretation remain pending. No numeric or interpretation repair is authorized
by this UI-state task. Both cited primary-study URLs remain unchanged.

## Local state-repair evidence — 2026-09-08

The runtime change only invalidates stored results when a native field changes
or a permitted add/remove action changes sample structure. It does not change
the clinical calculations or their interpretation. Before the fix, all14 state
regressions failed because the old report/export remained available; retained
receipt `avs-cortisol-state-red.json` records those failures. After the fix, the
paired AVS focused run passed77 tests with no failures, skips or flakiness
(`avs-paired-state-focused.json`). Build, lint and invariants passed during that
implementation checkpoint.

After adding the mobile case, the complete15-case cortisol state spec passed
again on production preview, retries0, four workers,2026-09-08T15:24:11.144Z,
5452.922ms; receipt `avs-cortisol-final-state.json`. It verifies actual downloaded
CSV values, concentration edits, metadata/units, both-side sample actions,
preserved input and focus behavior, and390px keyboard recalculation without
horizontal overflow. Owner visually inspected and retained
`avs-cortisol-mobile-report.png`: the updated ratios and export fit the viewport.
The screenshot's inherited diagnostic interpretation is not clinically accepted
by this UI test. Native mobile browsers and native printing were not tested.

The independent read-only state reviewer found no introduced state-handling
defect. Nonblocking coverage limits: suprarenal edits, extra-row edits and
disabled sample actions are not individually browser-tested; common event
coverage is structural evidence only. All receipts above are in the retained
`release-simplification/.superpowers/sdd/2026-09-07-verified-baseline` directory.

Local bounded state repair is implemented and tested. No release, clinical
verification upgrade or complete calculator acceptance is claimed. Final
release-base checks, required signed gates and live acceptance remain pending.
