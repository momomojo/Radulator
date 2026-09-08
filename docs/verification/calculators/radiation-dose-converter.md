# Radiation dose converter — review and gap plan

Permanent ID `radiation-dose-converter`, route `/#/radiation-dose-converter`.
Owner source-based review started 2026-09-08. This is not clinical certification.

## Current state

Read the complete `RadiationDoseConverter.jsx` and exercised the live activity
and absorbed-dose forms. Explicit1Ci produced37GBq; explicit1Gy produced100rad
and1000mGy. Mode changes cleared the prior report. A finite input1e308Gy produced
Infinity in several outputs; restoring1 recovered. Unrepresentable1e309 entered
through the browser instead led to the generic reference report, so it is not
the reproduced Infinity case. Live proof: retained
`radiation-converter-live-triage.md` in the baseline proof directory.

The implementation combines three same-quantity unit converters with absorbed/
equivalent-dose relationships, contextual comparisons, and a CT dose estimator.
Its permissive parseFloat/default branches also accept numeric prefixes and
unknown enums through callable inputs. Blank CT age silently means adult.
These require explicit contracts; existing reference tables do not make missing
or invalid input a successful calculation.

## Evidence reviewed and independent anchors

[NIST SP811 Appendix B.9, Radiology rows](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9)
reviewed2026-09-08:1Ci=3.7e10Bq,1rad=0.01Gy,1rem=0.01Sv. These establish
same-quantity conversions, not interchangeability of absorbed, equivalent and
effective dose or clinical dosing recommendations.

- 1 Ci must convert to 37 GBq, 37000 MBq, 1000 mCi.
- 1 Gy must convert to 100 rad, 100 cGy, 1000 mGy.
- 1 Sv must convert to 100 rem, 1000 mSv, 1e6 microsievert, 100000 mrem.
- Explicit zero is a valid unit-conversion value; blank is not known zero.
- Negative, malformed, nonfinite and unknown-unit inputs must produce a clear
 recoverable error, not conversion output or an unrelated reference table.

## Required state and small tasks

### Confirmed CT source mismatch

[AAPM Report 96](https://www.aapm.org/pubs/reports/RPT_96.pdf), printed p.13,
Table3 and Eq.12, re-read2026-09-08 in extracted text and the retained rendered
page: factors vary by both region and age. The table's pediatric factors use
the16cm phantom; adult body factors use32cm, while adult head/neck use16cm.
The current universal age multiplier is not that table. Independent example:
newborn head, DLP100mGy.cm on the16cm basis, k0.011, gives1.10mSv. Actual-export
CTDIvol10mGy times10cm with newborn/head produces0.47mSv using0.0021 times2.25.
This head comparison uses the same stated phantom basis and establishes a
source mismatch, not merely a different comparator model.

The future correction must use explicitly supported region/age factors and
confirm the scanner CTDI phantom basis before applying them. Do not silently
substitute a16cm pediatric factor into32cm body DLP or assume a universal
phantom conversion. Unknown/mismatched basis needs an explicit limitation and
withheld effective-dose estimate, while supported unit conversion and DLP
arithmetic remain available. Do not compare pediatric estimates against generic
adult typical-dose ranges as a patient-specific dose assessment. Full current-
applicability review remains separate from reproducing this historical table.

### Quantity and patient-exposure boundaries

Owner reviewed the official [ICRP103 free extract](https://icrp.org/docs/ICRP_Publication_103-Annals_of_the_ICRP_37%282-4%29-Free_extract.pdf),
glossary printed p.23 (effective/equivalent dose) and Executive Summary(h), plus
[ICRP92 official abstract](https://www.icrp.org/publication.asp?id=ICRP+Publication+92).
Organ-equivalent dose weights organ-mean absorbed dose; effective dose additionally
requires tissue weighting. The runtime's unqualified Gy=Sv notes and effective-
dose comparisons attached to any equivalent-dose input do not preserve that
distinction. The extract also identifies neutron weighting as an energy-dependent
continuous function, not the current three fixed bins. Exact replacement neutron
equations require additional directly reviewed source; do not guess them.

[ICRP105 official abstract](https://www.icrp.org/publication.asp?id=ICRP+Publication+105)
explicitly distinguishes medical patient exposure from dose-limit application.
Prescribe removing occupational-limit exceedance as a patient-dose interpretation;
if retained as reference material, separate and label the exposure category and
source scope. Preserve same-quantity Sv/rem arithmetic. Any organ-dose inverse
must identify its organ-equivalent and single-radiation assumptions rather than
imply it converts an arbitrary effective dose into absorbed dose. No new radiation-
therapy, compliance or patient-risk decision tool is authorized.

1. Source-review the remaining CT/weighting/context functions before changing
   clinical rules. Specifically adjudicate regional phantom/age factors (the
   current single pediatric multiplier across every region needs evidence),
   absorbed-versus-equivalent/effective quantity distinctions, neutron energy
   factors, generic radiopharmaceutical activity ranges and occupational/public
   limit context. Unit-conversion evidence does not substantiate those claims.
2. Prescribe a strict input/enum contract and add actual-export regression cases
   before the numerical repair: whole finite decimals, nonnegative conversion
   values, explicit mode/unit, selected CT mode with all required inputs, and
   rejection of nonfinite derived values. Test zero separately from positive
   values that underflow. No silent coercion, default unknown units or invalid
   age-to-adult fallback. Decide mixed-mode errors explicitly before edits;
   no partial successful-looking report with invalid selected calculations.
3. Preserve supported same-quantity conversions and permanent routes. Correct
   or explicitly withhold any independently unsupported clinical output while
   retaining supported functions; do not call a unit-only repair full acceptance
   of the current CT and contextual scope. Allowed future files: existing
   calculator, focused computation/browser tests, this record and registry link.
4. Verify all input units and three modes, conversion inversion/rounding,
   zero/invalid/overflow/underflow, conditional CT fields, stale-result recovery,
   actual copy, mobile/keyboard and print layout. Representative conversion-
   coefficient and guard mutations must fail independent tests. Finish protected
   CI/signed review, exact deployment and changed-tool live QA.

## Completion

### Additional source adjudication — 2026-09-08

Re-read the complete current calculator and visually inspected AAPM96 Table3.
The pediatric values are separate region/age rows, not a common multiplier.
For the existing order newborn/1yr/5yr/10yr/adult, independently transcribed:

| Region | k values, mSv/(mGy.cm) |
| --- | --- |
| Head | .011 / .0067 / .0040 / .0032 / .0021 |
| Neck | .017 / .012 / .011 / .0079 / .0059 |
| Chest | .039 / .026 / .018 / .013 / .014 |
| Abdomen/pelvis | .049 / .030 / .020 / .015 / .015 |
| Trunk | .044 / .028 / .019 / .014 / .015 |

Pediatric and adult head/neck factors assume16cm CTDI phantom; adult body
factors assume32cm. Preserve that explicit basis and historical table identity.
The10yr chest factor is less than the adult value; do not impose monotonic
age multipliers. Separate abdomen and pelvis selections may share the published
abdomen/pelvis row only with its scope disclosed; no invented organ-specific
coefficient. Original report remains the authority; one retrieved lecture slide
has decimal transcription errors in pediatric neck values and is not used.

The [DailyMed FDG F18 product label](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=1deaaa92-1c98-4295-8aa6-7a70bc29f55d),
revised12/2025, updated2026-06-10, section2.1, gives185–370MBq for adults in
its indicated settings. This directly contradicts the converter's claim that
every activity below370MBq is below typical diagnostic nuclear-medicine doses.
The calculator collects neither tracer nor indication/patient/protocol details.
Remove these automatic clinical-activity classifications; retain Bq/Ci unit
conversion and state that activity alone does not determine dose appropriateness.
Do not replace the generic cutoff with this one product's dose range or turn
the converter into an unreviewed prescribing tool.

### Neutron weighting adjudication

Owner visually reviewed [IAEA Safety Reports Series115 (2023)](https://www-pub.iaea.org/MTCD/Publications/PDF/PUB1987_web.pdf),
printed pp41–42, Eq5.10/Table5.4, including surrounding text and figure. Its
ICRP103 neutron function uses incident energy E in MeV:

- E<1:2.5+18.2 exp(-ln(E)^2/6).
- 1<=E<=50:5+17 exp(-ln(2E)^2/6).
- E>50:2.5+3.25 exp(-ln(.04E)^2/6).

Photons/electrons use1, protons2, alpha particles20. The printed table's
equation cross-reference differs from the actual printed Eq5.10; cite the
inspected equation, not that erroneous cross-reference. No neutron spectrum,
operational dosimeter reading or radiotherapy biological-dose conversion is
implemented. The inverse H/wR assumes organ-mean equivalent dose from one
radiation type; neutron use additionally assumes a specified incident energy.

Independent40-digit Decimal evaluation of the printed equation gives:
E=.1→10.02154755744613;1→20.69179307706779;10→8.809424145952329;
50→5.495897812701171;100→4.859271740927569. Test just below/at/above1 and50;
retain the printed coefficients and branch ownership, not an invented smoothing
or substitution of the old fixed bins.

### Owner-approved implementation contract

This supersedes earlier pending-equation/planning statements, not the original
goal. Preserve all three unit-conversion modes, the organ-dose relationship and
CT estimation with the supported source/quantity boundaries below.

1. Strict whole decimal inputs and explicit supported mode/unit enums. Zero is
   valid for same-quantity conversion. Reject negatives, prefix parses, NaN,
   Infinity, overflow and positive-input underflow; check every numeric output
   before formatting. Do not round a small nonzero value to displayed zero.
2. A selected conversion mode requires its value and unit, even when CT is also
   selected. CT alone is allowed with no selected conversion mode/value. A value
   without a mode, or neither calculation selected, is a recoverable error.
   All selected calculations must validate before any successful result is
   returned. Ignore hidden fields from unselected modes. Checkbox flags accept
   only real booleans (absent means false), not truthy strings.
3. Sv/rem conversion preserves the input physical quantity; it does not turn
   organ-equivalent dose into effective dose. Preserve the optional H/wR inverse
   only after explicit confirmation that the input is organ-equivalent dose
   for one radiation type. Then require a valid radiation selection; neutron
   replaces the three incomplete fixed bins and requires finite positive MeV.
   Unknown radiation selections error when that operation is selected. Use
   numerically stable ln(E)+ln(2) and ln(E)+ln(.04), avoiding intermediate2E
   overflow. Report assumptions and the actual wR; no patient-risk or RBE claim.
4. Absorbed-dose mode retains its same-quantity conversions. Replace unqualified
   Gy=Sv strings with a short explanation of H=wR*D for organ-mean absorbed
   dose and that effective dose needs tissue weighting; no automatic effective
   dose or unrelated radiation-type calculation from an unqualified Gy value.
5. CT requires finite positive CTDIvol and length, explicit supported age/region,
   and a phantom selection16cm/32cm/unknown. Blank selections error. DLP is
   CTDIvol*length. For a matching phantom use the exact Table3 age/region factor
   above. Unknown/mismatched phantom retains DLP but explicitly withholds E;
   never silently rescale. Identify AAPM96's historical population/reference
   estimate, not an individualized dose/risk or ICRP103-specific k table.
   No interpolation or age-based multiplier. Region labels must not display
   adult k values for children. Separate abdomen/pelvis use the published shared
   row with the scope visible. Explain that actual scanner-reported DLP may
   differ from this simple product; no multiseries/protocol optimization claim.
6. Remove unsupported automatic clinical-activity classifications, generic
   CT normal/abnormal ranges, occupational-limit patient flags and unrelated
   reference-table fallback. Keep clinically relevant quantity/assumption
   context and source links. This does not add prescribing, compliance or
   patient-specific cancer-risk scope. Missing evidence does not become a
   generic success or a whole-calculator verification label.

Independent CT anchors at DLP100: newborn head1.10mSv(16cm),adult head.21(16cm),
newborn chest3.9(16cm),10yr chest1.3(16cm),adult chest1.4(32cm). Exercise all25
published cells and30 UI age/region combinations (abdomen/pelvis share a row), phantom
mismatch/unknown, blank/invalid age and underflow/overflow. Unit fixtures cover
every offered input unit, zero and round trips; weighting cases cover photons,
electrons, protons, alpha and all neutron branches, absent confirmation and
invalid energy. Mixed CT/conversion cases must prove no partial success on a
selected invalid operation. Deliberate coefficient, age-row, phantom, branch,
enum and nonfinite-guard mutations must fail source-derived expectations.

Allowed files remain the modular definition, focused actual-export/browser
tests, this clinical record, registry link and generated inventory. Do not edit
shared rendering or the separate DLP calculator unless a reproduced dependency
requires a separate approved scope. Use existing field showIf/checkbox support.
Canonical checks, focused desktop/mobile/keyboard/copy/print-media recovery,
final integrated suite, signed reviews and exact deployed/live QA remain.

No runtime edits or complete clinical acceptance yet. KBRC/Mehran are now live;
IPSS PR261 is in CI. This is the next implementation lane, not a claim that
historical AAPM factors establish comprehensive current CT dosimetry validation.

## Implementation checkpoint

2026-09-08: Reused the clean released Mehran workspace on new branch
`codex/radiation-converter-safety-2026-09-08`, base dd915ad. Dependency install
succeeded (three inherited advisories remain). Source-derived tests first
reproduced invalid-input/partial-success/overflow defects, wrong newborn CT
factor, missing phantom guard, missing organ-dose confirmation and fixed-neutron
weighting. The first15 actual-export groups now pass after scoped runtime and
form-definition corrections, including all30 UI age/region combinations.

Runtime/tests remain a local draft. Browser suite updates, all-unit coverage,
representative mutations, final code review, inventory linkage, integrated
suite, protected release and live acceptance remain. Do not publish this draft
or count it as a completed whole-calculator audit. The separately open IPSS
PR261 stays unchanged while required CI completes.

### Latest local acceptance checkpoint

The earlier15-group checkpoint is superseded:18 actual-export groups now pass,
including all16 offered input units,30 CT UI region/age combinations, neutron
branch boundaries and underflow. Twelve deliberate rule/guard mutations fail
the expected tests; unchanged control passes. Removing the unit guard alone
was behaviorally redundant with the numeric guard, so the default-unit mutation
reproduces both parts of the actual legacy fallback, not an equivalent variant.
Receipts: radiation-mutation-results.json in the retained baseline proof folder.

27 focused browser cases passed on the current build, plus a separate fresh390px
CT report geometry case. Actual clipboard, keyboard calculation, valid-invalid-
recovered transitions, optional fields, mixed operations and print-media report
visibility were exercised. Owner inspected desktop and print-media screenshots.
A capture taken during desktop-to-mobile resize was cropped; the fresh-mobile
geometry test proves the report text spans remain within the report bounds.
No shared component change or native-printing claim is made.

Visual review found the CT report highlighting the reference title as clinical
success. A RED-to-GREEN regression now requires the actual E (or DLP when E is
withheld) first, with explicit informational severity. Revised capture verifies
that correction. Build, lint, invariants, registry validation and the complete
computation suite passed after the runtime correction. Inventory generated and
checked current; verification status remains seed-unverified.

Still required: final independent/code-source acceptance, finalized-base full
integrated suite, protected CI/signed release, exact deployment/live QA and the
whole-baseline disposition. Do not silently treat a bounded local correction
as complete baseline verification. IPSS required CI has now passed and its
primary signed review was requested separately.

### Post-review regression checkpoint

2026-09-08: The read-only reviewer identified JavaScript property-key coercion:
an array-valued mode could pass dictionary validation but take the wrong strict
comparison branch. A reproduced failing case now passes after explicit string
validation of mode, unit and radiation type. No clinical rule was changed.
Added independently calculated nontrivial conversion round trips for Gy/mGy,
Sv/rem and MBq/mCi, including the effect of copying rounded displayed values.
A deliberate premature-rounding mutation fails this new regression.

Fresh verification:20 actual-export groups pass;13 deliberate mutations are
detected and the unchanged control passes. Build, lint and invariants pass.
All28 focused Chromium cases pass together on the rebuilt candidate, including
fresh-mobile CT layout, clipboard and print-media checks. Retained receipts:
`radiation-mutation-results.json` and `radiation-focused-results.json` in the
baseline proof directory. These supersede the earlier split browser receipt.
Finalized-base integrated suite and protected release/live acceptance remain
pending; no full-audit or production-completion status is assigned.

The same independent read-only reviewer rechecked the two findings and confirmed
both resolved, independently rerunning20/20 computation groups. Owner inspected
the fresh390px full-page capture: CT report values and limitations are visible
within the report bounds. This is limited code/UI acceptance, not the separate
signed clinical release authorization or a native-printing claim.

### Finalized-base local release acceptance — 2026-09-08

Rebased cleanly onto released/live-accepted main
`a941c43171040bb452cb0442dbf9aaa82025c0b1`; implementation revision
`7ed09ac3b0138fe0c635a545e0a7f8bece7bf622`. Dependency lockfile unchanged.
Fresh build, lint, invariants,20 actual-export groups, complete computation
suite (313 fixtures plus supplemental suites), guideline registry validation
and generated inventory check passed. Full integrated Playwright suite on the
production preview passed1542, failed0, skipped0, flaky0, errors0, with retries
disabled; duration289073.952ms, start2026-09-08T14:09:17.917Z.
Receipt: `test-results/results.json` in this implementation workspace.

The prior main suite had1553 cases: this correction replaces39 legacy radiation
browser cases with28 source-aligned cases; all other browser files are unchanged.
Coverage is assessed against the clinical contract, not the numeric test count.
Owner re-read complete runtime/tests and registry diff after rebase; no shared
runtime/control changes were introduced. This follow-up changes only this
acceptance record. Required final-head CI, independent signed reviews, trusted
merge, artifact verification and live QA remain pending.
