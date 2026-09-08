# Adrenal CT Washout — source review and correction plan

Owner GPT-6 Astra; reviewed 2026-09-08 against main/live `5c4dcbaafb53d99415569e65e1245f80b9e6532a`. Permanent ID `adrenal-ct`. Source-based AI review, not professional certification. The full supported-scope audit remains open.

## Current state and required correction

Live empty form returns two `NaN` percentages plus `Indeterminate / non-adenoma`. Inputs pre10/post10/delayed0 HU produce absolute `Infinity`, relative100.0%, `Suggests adrenal adenoma`, and a separate unconditional benign-adenoma banner in App.jsx. Root reproduced both through actual browser interactions and the exported compute function. Missing measurements default to zero; divisions have no denominator or finite-output validation. The generic Calculate button invokes compute directly, so HTML required attributes alone cannot fix this.

Required bounded correction: retain actual absolute/relative washout computation and existing defined finite numerical results, but reject missing/malformed/nonfinite measurements and undefined/overflowed calculations before producing any interpretation. Signed HU values remain accepted; zero is a real measurement, not equivalent to missing. Do not add arbitrary scanner-value caps or silently clamp results. Remove the extra App.jsx statement that absolute washout alone establishes benign adenoma; the calculator's qualified interpretation and caveats remain.

## Evidence and scope

- [ESE/ENSAT guideline, Fassnacht et al. 2023, DOI10.1093/ejendo/lvad066](https://academic.oup.com/ejendo/article/189/1/G1/7198474): owner read section4.1.1 Washout-CT, section5.2 and Table4 with footnotes. The guideline describes limitations of conventional washout cutoffs and confines imaging criteria to appropriate lesion/measurement contexts; it does not support the app's unconditional benign banner. Table4's alternative relative threshold has limited supporting evidence and is not silently substituted in this correction.
- Mathematical domain: APW=100(P−D)/(P−U); RPW=100(P−D)/P. Required denominators are nonzero; every input, intermediate difference and final percentage must be finite. This is arithmetic validity, not a claim that every mathematically defined phase combination is clinically interpretable.
- Existing Caoili/Choi/Park bibliography, exact threshold inclusivity, population/lesion/timing eligibility, and current-guidance presentation remain subject to full source review. Direct publisher DOI retrieval did not expose the original texts during this bounded review. The displayed conventional thresholds are not newly validated by preservation tests. No new management recommendation or current-version certification is authorized.

## Independent expected cases and allowed work

### Review rework: directly accessible primary evidence

Primary signed review of531f0bf returned NEEDS_FIX because Oxford blocked retrieval, not because the guard arithmetic failed. The [University of Sheffield deposit record](https://eprints.whiterose.ac.uk/id/eprint/208070/) identifies the published ESE/ENSAT2023 version, DOI and CC-BY license. Its [full published PDF](https://eprints.whiterose.ac.uk/id/eprint/208070/1/lvad066.pdf) is directly accessible: SHA256 `70faac5423838b806d5be7abe489a8bd35b7ae12714d32d821fcdc083f80d47f`, matching independent downloads on this workstation and the review host2026-09-08. This is source accessibility/identity evidence, not signed approval or a new deterministic source-audit gate.

Exact locators with the deposit cover sheet included: printedG9/PDFpage10, section2.3, gives both washout equations and MRI chemical-shift context; printedG13/PDFpage14, section4.1.1 Washout-CT, describes limitations of the conventional cutoffs; printedG19/PDFpage20, Table4 and footnotes, limits imaging criteria to appropriate lesion/ROI contexts and cautions about the alternative cutoff's evidence. Owner read these passages. The preserved60/40 cutoffs are not newly certified. No additional source-audit infrastructure or clinical threshold change is part of this rework.

1. U10/P100/D40 → APW66.7%, RPW60.0%; U20/P80/D70 →16.7%,12.5%; U−20/P100/D40 →50.0%,60.0%. Derive these independently by differences/division; preserve existing defined outputs.
2. Omitted/blank/null/boolean/array/object, numeric suffixes/hexadecimal and nonfinite measurements → meaningful Error only, no percentage or diagnostic interpretation. Ordinary finite decimal/scientific strings are accepted.
3. P=U (including10/10/0) or P=0 → Error only. Finite inputs whose subtraction or quotient overflows → Error only. Do not display `NaN`/`Infinity` or false positive/negative guidance.
4. Live UI: blank → error; valid inputs → numeric results; editing clears stale results; division-by-zero → error; correction recovers. Copy cannot retain the prior valid report after invalid recalculation. The standalone categorical benign banner is absent even with APW above its conventional threshold.

Allowed files: `AdrenalCTWashout.jsx`, removal of only the adrenal-specific benign banner in `src/App.jsx`, `tests/adrenal-input-safety-compute.test.mjs`, the focused adrenal browser regression, and this plan. A closely related MRI input-domain correction may share the release while retaining its own plan. No release-control/package/registry certification changes.

Shared usability addition, identified before its repair: the 390px mobile regression cannot click the medical disclaimer dismissal because the fixed top header covers it. App.jsx renders the disclaimer/welcome content at document top underneath the fixed header. Reserve the existing header's 4rem height above this content on mobile while either banner is visible; retain the ordinary pointer dismissal test through both states and verify keyboard calculation. A disclaimer-only margin did not fix the following welcome-only state and was replaced by this common offset. This is the single shared spacing correction allowed by the baseline's demonstrated-obstruction rule, not a layout redesign. Error-only results intentionally offer no Copy/Print action; regression checks must establish that no stale report is offered, not require copying an error or clearing the system clipboard.

## Acceptance record

Up-front review and live defect reproduction complete. The bounded implementation is locally complete; publication and live acceptance are pending.

- 2026-09-08: six combined actual-export computation tests pass. Representative in-memory mutations changing CT's absolute denominator to portal attenuation and permitting negative opposed-phase MRI signal were caught by independent expectations; production files were never mutated.
- Focused Chromium: all four new safety/UI cases pass, including invalid → valid → invalid → corrected recovery, actual valid clipboard readback, no report actions on Error-only results, mobile pointer dismissal of both banners, keyboard calculation and print-media layout. All26 existing MRI cases pass after replacing the obsolete undefined-ratio expectation. The preceding63-case run also passed the remaining CT/onboarding cases; its sole failure was that subsequently corrected MRI expectation. No native-printer claim.
- Build, lint, invariants and the aggregate computation command passed. The generated inventory and its existing spec-file-count assertion were updated for the new browser file only; no clinical status was promoted. The inherited invariant warning references contrast/Y90 changes relative to develop, not extra changes in this hotfix's diff against current main.
- Root inspected desktop CT and mobile MRI screenshots from the isolated production preview on4194. Safe synthetic artifacts are retained in the release-simplification worktree's `.superpowers/sdd/2026-09-07-verified-baseline/` (`adrenal-ct-candidate-desktop.png`, `adrenal-mri-candidate-mobile.png`). Copy assertions test actual clipboard content; print evidence covers CSS layout only.
- Independent read-only code/source review found no critical or important issue in this bounded change. This is not the independent signed release authorization.
- Final local full Playwright suite:1541 passed,0 skipped/failed/flaky,4.9min, isolated production preview4173 with strict port and exact candidate cwd. The earlier4194 run passed1539, skipped the port-bound static-page test and exposed an old smoke assertion matching the removed threshold banner; the smoke case now checks actual independently derived APW60.0/RPW56.3 for5/80/35 HU. The final run includes that correction and the static-page test. Receipt `adrenal-isolated-results.json` in the same retained proof directory. Tested runtime blobs: App`747cc8d25460f76a693cf47575d30dfa89b82334`, CT`0c368f514307edf5808dcc9d3610fe7629f21c9f`, MRI`9996ab3bc7cfe2e657b8f75309218a6b4e96e5ed`. No production code changed after this build/run.
- Exact-head required CI, signed reviews, deployment and changed-tool live proof remain pending until their receipts are recorded.

Full calculator audit additionally requires the source/eligibility/threshold decisions above and complete browser/report/privacy proof; this repair must not be counted as full acceptance.
