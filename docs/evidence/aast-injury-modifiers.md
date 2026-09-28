# AAST grade-advance modifiers: evidence and runtime bindings

Scope: the "advance one grade" modifiers in
`src/components/calculators/AASTTraumaGrading.jsx`, per organ **and** OIS
version, plus two reworded checkbox subLabels and one citation correction.
Everything else in the calculator is unchanged.

Re-verify at head:

```bash
node scripts/audit-aast-injury-modifier-source.test.mjs          # audit + mutation checks + compute tests
node --import ./scripts/register-jsx-loader.mjs scripts/audit-aast-injury-modifier-source.mjs --json
node --import ./scripts/register-jsx-loader.mjs --test tests/aast-trauma-grading-compute.test.mjs
```

No source text is committed. Each source statement is pinned in the audit by
the SHA-256 and length of its exact normalized span between two anchors of at
most six words, with a locator; the wording below is our own paraphrase.

## Sources

| Key | Source | Retrieval | Pin |
|---|---|---|---|
| `kozar2018` | Kozar RA, Crandall M, Shanmuganathan K, Zarzaur BL, Coburn M, Cribari C, Kaups K, Schuster K, Tominaga GT; AAST Patient Assessment Committee. Organ injury scaling 2018 update: Spleen, liver, and kidney. *J Trauma Acute Care Surg.* 2018;85(6):1119-1122. DOI [10.1097/TA.0000000000002058](https://doi.org/10.1097/TA.0000000000002058), PMID [30462622](https://pubmed.ncbi.nlm.nih.gov/30462622/). | AAST-hosted copy of the article: <https://www.aast.org/asset/1EDF1B04-6B52-4E7B-9130ACA30413089D/> (redirects into AAST's static store; the AAST "Organ Injury Scale Revisions (2018-)" page lists this 2018 revision). | Raw bytes: 174,748 bytes, SHA-256 `bcd66906506efee3757ce1ea39e0da66bf30e39ffa7ccf3c33cc2678b3430965`, 4 pages. |
| `pubmed` | PubMed records 30462622 (Kozar 2018), 39836096 (Keihani 2025), 39898876 (Notrica 2025). | NCBI E-utilities `efetch` with `tool=radulator-aast-audit` and no `email` parameter. | SHA-256 of the normalized citation fields and abstracts, `20638d0a63f3574ea7a5b7c07640233d9ab8ab2c9b721b111342954f9366bca7`. Raw XML is not pinned because PubMed indexing data changes after publication. |

PMID check: the brief suggested PMID 30358764 for Kozar 2018. That PMID does
not resolve to a PubMed record. The article's PMID is **30462622**, confirmed
by title, DOI and pages.

Could not be retrieved (not bypassed):

- **Keihani S, Tominaga GT, Matta R, et al.** Kidney organ injury scaling:
  2025 update. *J Trauma Acute Care Surg.* 2025;98(3):448-451. DOI
  10.1097/TA.0000000000004509, PMID 39836096. AAST links only the LWW abstract
  page. LWW serves a Cloudflare challenge, Ovid returns HTTP 402 (paywall),
  OpenAlex lists it as closed access with no repository copy, and it is not in
  PMC. The PubMed abstract does not mention modifiers.
- **Notrica DM, Tominaga GT, Gross JA, et al.** American Association for the
  Surgery of Trauma pancreatic organ injury scale: 2024 revision. *J Trauma
  Acute Care Surg.* 2025;98(3):442-447. DOI 10.1097/TA.0000000000004522, PMID
  39898876. It has the same access status. The PubMed abstract defines grade V
  but does not mention modifiers. No open reproduction of the 2024 table and
  its notes was found (Europe PMC open-access search; the three PMC articles
  that cite it).

## Rules now applied, per organ and version

The PDF page numbers are the AAST copy's page numbers. The printed journal page is given in brackets.

| Organ / version | Rule now applied | Source + locator | Paraphrase | Runtime binding |
|---|---|---|---|---|
| Liver, 2018 | "Multiple Injuries in Same Organ" is shown. A base grade I or II is raised by one, to Grade III at most. Grades III-V are unchanged. | Kozar 2018, Table 2 (Liver Injury Scale, 2018 Revision), table notes, PDF p. 3 [p. 1121]. The introduction's paragraph on the three sets of grading criteria, PDF p. 2 [p. 1120], says the same. | When two or more grade I-II liver injuries coexist, the grade rises by one, capped at III. Several injury grades are otherwise classified by the highest. | Audit claim `liver-2018-multiple-injury-advance`. Compute tests: *each path applies only its own modifier, at the grade I-II boundaries with ceiling III* and *explicit boundary vectors: liver/spleen multiple and kidney 2018 bilateral*. E2E: *should advance grade by 1 for multiple injuries (Grade I to II)*, *should not advance grade beyond III for multiple injuries* and *should show the multiple injuries checkbox only for liver and spleen*. |
| Spleen, 2018 | Same as liver. | Kozar 2018, Table 1 (Spleen Organ Injury Scale, 2018 Revision), table notes, PDF p. 2 [p. 1120], and the same introduction paragraph. | Same rule for the spleen. | Audit claim `spleen-2018-multiple-injury-advance`. The same compute tests. E2E: *spleen: multiple grade II injuries advance to Grade III*. |
| Kidney, 2018 | New **"Bilateral Renal Injuries"** checkbox. A base grade I or II is raised by one, to Grade III at most. "Multiple Injuries in Same Organ" is hidden and never applied. | Kozar 2018, Table 3 (Kidney Injury Scale, 2018 Revision), table notes, PDF p. 3 [p. 1121]. | Several injury grades in one kidney are classified by the highest. The one-grade advance, capped at III, applies when both kidneys are injured. The kidney table has no multiple-injury note, and the audit checks that the note is absent. | Audit claims `kidney-2018-bilateral-advance` and `kidney-2018-no-multiple-injury-advance`. Compute tests: *each path applies only its own modifier...*, *explicit boundary vectors...* and *kidney 2018 bilateral advance changes the management tier with the grade*. E2E: *kidney 2018: bilateral checkbox shown, multiple hidden*, *kidney 2018: bilateral injuries advance Grade II to Grade III* and *kidney 2018: bilateral injuries do not advance beyond Grade III*. |
| Kidney, 2025. This is also the path used when no version is chosen. | No modifier is shown or applied. | Not verified, because the Keihani 2025 full text was not retrievable (see above). Secondary sources only: Radiopaedia's "AAST kidney injury scale" (revised 23 Sep 2026, citing Keihani 2025) says the 2025 update grades each kidney on its own and no longer upgrades multiple grade I-II injuries. Acosta 2026 (JACC Case Rep, PMC12948569, Table 1) reproduces the 2025 grades without notes. | We could not confirm any rule, so none is applied. This matches the secondary reports. | Fail-safe policy (`runtime.fail_safe` in the audit, not publication-derived). Compute tests: *stale hidden checkbox values never change a grade on a path that does not own them* and *modifier checkboxes are shown only on the organ/version that owns them*. E2E: *kidney 2025 and no-version kidney: no modifier checkbox* and *a bilateral value left checked on kidney 2018 never advances the 2025 grade*. |
| Pancreas, 2024 revision | No modifier is shown or applied. | Not verified, because the Notrica 2025 full text was not retrievable. The **1990** pancreas scale did carry a multiple-injury note: Coccolini F, et al. WSES-AAST guidelines, *World J Emerg Surg.* 2019;14:56, Table 4 note (PMC6907251). The AAST-hosted review by Soltani and Jurkovich (*J Trauma Acute Care Surg.* 2025), Table 2, reprints the 1990 table. The calculator implements the 2024 revision, not the 1990 scale. | We could not confirm whether the 2024 revision keeps the 1990 note, so none is applied. | Fail-safe policy, as for kidney 2025. The same compute tests. E2E: *should not offer or apply a multiple-injury advance (2024 revision)* and *a multiple-injury value left checked on liver never advances a kidney grade*. |

For every organ and version, compute() checks the organ and version itself as well as the visibility rule. The app passes hidden field values to compute(), so a checkbox left checked on another organ or version cannot change the grade. Only a boolean `true` counts as checked.

**Open point for physician review.** Kozar 2018's introduction states the multiple grade I-II advance in general terms for "the solid organ injury scale". The kidney table's own notes give the bilateral advance instead and direct that several kidney injury grades take the highest grade. We bind each organ to its own table notes. The introduction sentence supports only the liver and spleen claims, whose table notes agree with it. The original 1989 kidney scale also used a bilateral trigger, according to secondary reproductions (Lee 2024, PMC11495897, Table 1; Smith 2021, PMC8350687, Table 1).

## Wording changes (scoring unchanged)

| Changed text | Source + locator | Paraphrase | Runtime binding |
|---|---|---|---|
| `kidney_2018_urinary_extrav` subLabel changed from "Contrast extravasation on delayed phase → Grade IV" to "Excreted contrast leaking outside the collecting system on delayed (excretory) phase → Grade IV". | Kozar 2018, Table 3, grade IV row, first Imaging Criteria item. The Table 3 note defining active bleeding. The closing paragraph on CT technique, PDF p. 4 [p. 1122]. | A laceration into the collecting system with urinary extravasation is imaging grade IV. Active bleeding is vascular contrast that grows on the delayed phase, so "contrast on the delayed phase" also describes hemorrhage. Renal injury calls for a delayed excretory phase. | Audit claim `kidney-2018-urinary-extravasation-sublabel`. Compute test: *modifier and reworded subLabels are version-accurate*. The checkbox still gives Grade IV. |
| `pancreas_destructive` subLabel changed from the 1990 wording ("Massive disruption of pancreatic head...") to "Pancreatic head destruction with nonviable parenchyma (2024 revision) → Grade V". | Notrica 2025, PubMed abstract, sentence defining grade V. | In the 2024 revision, grade V is a destructive pancreatic-head injury with nonviable tissue, subgraded by ductal injury. The subgrades are not modeled. | Audit claim `pancreas-2024-grade-v-sublabel`. The same compute test. The checkbox still gives Grade V. |
| `multiple_injuries` subLabel now names the 2018 liver/spleen scope. New `kidney_2018_bilateral` label and subLabel. New "GRADE-ADVANCE MODIFIERS" lines in the info text. | Kozar 2018, Tables 1-3 notes. | As above. | The audit checks these exact strings in `verifyRuntime`. Compute test: *modifier and reworded subLabels are version-accurate*. |
| Keihani 2025 reference: third author corrected from "Swaroop M" to **"Matta R"**. | PubMed 39836096 author list. | PubMed lists the authors as Keihani S, Tominaga GT, Matta R, and others. | Audit claim `reference-list-identities`. Compute test: *the 2025 kidney reference names the published author list*. |

Checkbox subLabels are not rendered yet. A separate renderer change will show them, so the tests check them in data, not in the browser.

## Kidney version labels and default: checked, unchanged

The fields not marked `kidney_2018_*` are the 2025 (Keihani) path. Nothing in
the calculator calls that path "legacy". The version selector labels it
"2025 Revision (Keihani et al.)". When no version is chosen, the calculator
shows and computes the 2025 fields and reports "OIS Version: 2025", with the
same output as choosing 2025 explicitly. The runtime labeling is therefore
consistent and was left unchanged. The compute test *kidney version labels: no
version chosen runs and reports the 2025 path* pins this.

## Audit design notes

- The Kozar PDF is a static artifact, so its raw bytes are pinned. The asset
  link must redirect to `www.aast.org/static/journal_pdf_<uuid>/<uuid>.pdf`.
- Mutation checks:
  - At audit time, each Kozar modifier span is re-hashed with its trigger word
    swapped (bilateral and multiple) and with grade III swapped for grade IV.
    The digest must change, which also proves the pinned span holds the
    trigger and the ceiling.
  - The test file builds runtime mutants, and each must be rejected:
    - the former unconditional rule;
    - the rule applied to the kidney or pancreas;
    - boxes shown on the wrong path;
    - the ceiling removed;
    - loose truthy values;
    - reverted wording or citation;
    - missing info lines.
- Retrieval makes up to five attempts on network errors, HTTP 429 and HTTP
  5xx, and also on HTTP 400 for NCBI, which returns it transiently. It honours
  `Retry-After` (capped at 20 s) and then fails closed. Other client errors
  fail at once.
- A recognised Cloudflare bot-protection page from aast.org, challenge or
  block, is reported and skips only the re-reading of the Kozar statements.
  Recognition needs HTTP 403, 429 or 503, a Cloudflare page marker and one
  more signal. Every runtime binding and the PubMed pins still run.
  `--require-live` turns the challenge into a failure. A plain origin error
  that only passes through Cloudflare still fails closed.
