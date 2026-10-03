# AAST grade-advance modifiers: evidence and runtime bindings

Scope of `src/components/calculators/AASTTraumaGrading.jsx` changes covered here:

- the "advance one grade" modifiers, per organ **and** OIS version;
- the result-text and input follow-ups: the grade description after an advance, a pancreatic duct injury without a location, the pancreas grade-advance note, the liver grade II length and the AAST website reference;
- two reworded subLabels and one citation correction.

Everything else in the calculator is unchanged.

Re-verify at head:

```bash
node scripts/audit-aast-injury-modifier-source.test.mjs          # audit + mutation checks + compute tests
node --import ./scripts/register-jsx-loader.mjs scripts/audit-aast-injury-modifier-source.mjs --json
node --import ./scripts/register-jsx-loader.mjs --test tests/aast-trauma-grading-compute.test.mjs
```

No source text is committed. Every retrieved artifact is pinned by its exact byte length and SHA-256, and those pins are checked before anything is parsed. Each source statement is then pinned by the SHA-256 and length of its exact normalized span between two anchors of at most six words, with a locator. The wording below is our own paraphrase.

## Artifacts (byte-pinned, verified before parsing)

| Key | Source | Retrieval | Pin |
|---|---|---|---|
| `kozar2018` | Kozar RA, Crandall M, Shanmuganathan K, Zarzaur BL, Coburn M, Cribari C, Kaups K, Schuster K, Tominaga GT; AAST Patient Assessment Committee. Organ injury scaling 2018 update: Spleen, liver, and kidney. *J Trauma Acute Care Surg.* 2018;85(6):1119-1122. DOI [10.1097/TA.0000000000002058](https://doi.org/10.1097/TA.0000000000002058), PMID [30462622](https://pubmed.ncbi.nlm.nih.gov/30462622/). | AAST-hosted copy: <https://www.aast.org/asset/1EDF1B04-6B52-4E7B-9130ACA30413089D/> (redirects into AAST's static store). If AAST's transport retries run out (for example because of a Cloudflare challenge), the audit uses the Internet Archive capture of the same AAST file (2026-04-19, [link](https://web.archive.org/web/20260419100016id_/https://www.aast.org/static/journal_pdf_1ea6c353-e5b1-40d7-85ab-2a7cb76e886a/1ea6c353-e5b1-40d7-85ab-2a7cb76e886a.pdf)). The capture serves identical bytes, and the audit checks its Memento-Datetime and original URL. | 174,748 bytes, SHA-256 `bcd66906506efee3757ce1ea39e0da66bf30e39ffa7ccf3c33cc2678b3430965`, 4 pages. |
| `aastScalePage2020` | The AAST's own injury scoring scale page, with the organ injury scale tables, as served by aast.org. | Internet Archive capture of <https://www.aast.org/resources-detail/injury-scoring-scale> taken 2020-11-01 ([link](https://web.archive.org/web/20201101034458id_/https://www.aast.org/resources-detail/injury-scoring-scale)). The audit checks its Memento-Datetime and original URL. A 2025-07-02 capture still shows the same pancreas table. The live page is now only a reprint-permissions notice. | 274,891 bytes, SHA-256 `e60dd713368a7ceddf61d368cf9d8ac9dc70d183d64096753c93cb218816481b`. |
| `pubmed30462622`, `pubmed39836096`, `pubmed39898876` | PubMed records of Kozar 2018, Keihani 2025 (kidney 2025 update) and Notrica 2025 (pancreas 2024 revision). | NCBI E-utilities `efetch` in its plain-text abstract form (`rettype=abstract&retmode=text`), with `tool=radulator-aast-audit` and no `email` parameter. | 1,474 bytes / `da35009c…e7a5eec8`, 2,069 bytes / `909f1364…f0f723ec`, and 3,705 bytes / `fad50e9d…f4d62911`. Full digests are in the audit. |

PMID check: the brief suggested PMID 30358764 for Kozar 2018. That PMID does not resolve to a PubMed record. The article's PMID is **30462622**, confirmed by title, DOI and pages.

**Erratum.** PubMed links one erratum to Kozar 2018 (*J Trauma Acute Care Surg.* 2019;87(2):512, PMID 31348410, DOI 10.1097/TA.0000000000002419).
- Its text is not openly retrievable: LWW is Cloudflare-challenged, Ovid returns HTTP 402, and PubMed has no abstract.
- The indirect evidence points to an author-name correction:
  - the AAST PDF byline, downloaded 12/10/2018 before the erratum, reads "Kaup";
  - PubMed and Crossref now list "Kaups";
  - search-index snippets describe a surname correction.
- The audit pins the erratum link, so any new erratum changes the pinned record bytes and fails the audit.

Could not be retrieved (not bypassed):

- **Keihani S, Tominaga GT, Matta R, et al.** Kidney organ injury scaling: 2025 update. *J Trauma Acute Care Surg.* 2025;98(3):448-451. DOI 10.1097/TA.0000000000004509, PMID 39836096.
  - AAST links only the LWW abstract page.
  - LWW serves a Cloudflare challenge and Ovid returns HTTP 402.
  - OpenAlex lists it as closed access, and it is not in PMC.
  - The PubMed abstract does not mention modifiers.
- **Notrica DM, Tominaga GT, Gross JA, et al.** American Association for the Surgery of Trauma pancreatic organ injury scale: 2024 revision. *J Trauma Acute Care Surg.* 2025;98(3):442-447. DOI 10.1097/TA.0000000000004522, PMID 39898876.
  - Same access status as Keihani 2025.
  - The PubMed abstract defines grades III-V but does not mention modifiers.
  - No open reproduction of the 2024 table and its notes was found.

## Rules now applied, per organ and version

PDF page numbers are the AAST copy's; printed journal pages are in brackets.

| Organ / version | Rule now applied | Source + locator | Paraphrase | Runtime binding |
|---|---|---|---|---|
| Liver, 2018 | "Multiple Injuries in Same Organ" is shown. A base grade I or II rises by one, to Grade III at most; grades III-V are unchanged. "Grade Description" describes the final grade. | Kozar 2018, Table 2 notes, PDF p. 3 [p. 1121]. The introduction paragraph on the three sets of grading criteria, PDF p. 2 [p. 1120]. | When two or more grade I-II liver injuries coexist, the grade rises by one, capped at III. | Audit claim `liver-2018-multiple-injury-advance`. Compute: *each path applies only its own modifier, at the grade I-II boundaries with ceiling III*, *explicit boundary vectors...*, *after an advance, Grade Description describes the advanced grade...*. E2E: *should advance grade by 1 for multiple injuries (Grade I to II)*, *should not advance grade beyond III for multiple injuries*, *should show the multiple injuries checkbox only for liver and spleen*. |
| Spleen, 2018 | Same as liver. | Kozar 2018, Table 1 notes, PDF p. 2 [p. 1120], and the same introduction paragraph. | Same rule for the spleen. | Audit claim `spleen-2018-multiple-injury-advance`. The same compute tests. E2E: *spleen: multiple grade II injuries advance to Grade III*. |
| Kidney, 2018 | **"Bilateral Renal Injuries"** checkbox. A base grade I or II rises by one, to Grade III at most, and is described at the final grade. "Multiple Injuries in Same Organ" is hidden and never applied. | Kozar 2018, Table 3 notes, PDF p. 3 [p. 1121]. | Several injury grades in one kidney take the highest grade. The one-grade advance, capped at III, applies when both kidneys are injured. The audit checks that the kidney table has no multiple-injury note. | Audit claims `kidney-2018-bilateral-advance` and `kidney-2018-no-multiple-injury-advance`. Compute: *explicit boundary vectors...*, *after an advance...*, *kidney 2018 bilateral advance changes the management tier with the grade*. E2E: the three *kidney 2018: ...* tests. |
| Kidney, 2025 (also used when no version is chosen) | **Unchanged from develop.** "Multiple Injuries in Same Organ" is shown, and a base grade I or II rises by one, to Grade III at most, as the calculator did before this PR. The bilateral checkbox (a 2018-only rule) is not shown and never applies. | Not verified. The Keihani 2025 full text is not retrievable (see above). The PubMed abstract identifies the update but does not mention modifiers. A secondary source, Radiopaedia, says the 2025 update grades each kidney separately and no longer upgrades multiple grade I-II injuries, but a secondary report is not primary evidence. | No primary rule is confirmed. The primary judge on #304 required that kidney-2025 scoring stay unchanged until the primary table notes are pinned, so this PR leaves it as it was. | Not publication-derived: `runtime.unchanged` (`radulator-unchanged-pending-primary-text`). Compute: *each path applies only its own modifier...*, *explicit boundary vectors...*, *stale hidden checkbox values...*, *modifier checkboxes are shown only on the organ/version that owns them*. E2E: *kidney 2025 and no-version kidney: multiple-injury checkbox kept, no bilateral checkbox*, *kidney 2025: multiple injuries advance one grade, as before*, *a bilateral value left checked on kidney 2018 never advances the 2025 grade*. |
| Pancreas, 2024 revision | "Multiple Injuries in Same Organ" is shown. A base grade I or II rises by one, to Grade III at most, as on the earlier 1990 AAST pancreas scale, and the result describes the final grade. Every base grade I-II result carries a "Grade-Advance Note": the 2024 revision's table notes could not be verified, so the 1990 advance is kept. Clinical judgment applies. | The 1990 rule comes from the AAST's own pancreas scale table: `aastScalePage2020`, Table 10 (Pancreas Injury Scale), table note and credit line (Moore et al.). The year comes from Notrica 2025's PubMed abstract, first sentence (the original pancreatic OIS was published in 1990). Whether the 2024 revision keeps the note is not verified. | The pre-2024 AAST pancreas table raises the grade by one, capped at III, for multiple injuries. The 2024 notes could not be read. Being unable to read them is not evidence that the revision removed the rule, and dropping it could under-grade, so the 1990 rule is kept and the result says why. | Audit claim `pancreas-1990-multiple-injury-advance-kept`. Compute: *each path applies only its own modifier...*, *explicit boundary vectors: liver/spleen/pancreas multiple...*, *kidney 2025 grade I-II results carry a no-modifier note; pancreas base grade I-II results say the 1990 advance is kept*. E2E: *keeps the 1990 multiple-injury advance on the 2024 revision path*, and the pancreas case of *should show the multiple injuries checkbox only for liver, spleen and pancreas*. |

compute() checks the organ and version itself, not only the visibility rule. The app passes hidden field values to compute(), so a checkbox left checked on another organ or version cannot change the grade. Only a boolean `true` counts as checked.

**Decided (coordinator, under Mohib's delegation, 2026-09-28): each organ's own table governs.** **Revised 2026-10-03 (Codex P1 and the primary judge on #304):** a scoring rule changes only where a primary source states the new rule.
- **2024 pancreas revision.** Its notes cannot be read, so the earlier verified 1990 rule is kept rather than removed without evidence, and the result says so.
- **2025 kidney revision.** Its notes cannot be read either, so the calculator's earlier behavior is left unchanged.
- **Neither is current-revision validation.** Both revisions' modifier rules remain listed as not asserted.
- Kozar 2018's introduction states the multiple grade I-II advance in general terms for "the solid organ injury scale".
- The kidney table's own notes give the bilateral advance and direct that several kidney injury grades take the highest grade.
- The introduction sentence therefore supports only the liver and spleen claims, whose table notes agree with it.

## Follow-up fixes

| Changed behavior | Source + locator | Paraphrase | Runtime binding |
|---|---|---|---|
| **Grade Description after an advance** now describes the final grade (e.g., liver base I plus multiple injuries gives Grade 2, "Moderate ..."). The adjustment line still names the base grade. | Calculator presentation, following the modifier rules above. | The description is read from the organ/version path's own table after any advance. | Audit `verifyRuntime`: every vector's description equals the path's description at the final grade. Compute: *after an advance, Grade Description describes the advanced grade (liver, spleen, kidney 2018)*. E2E: the Grade I to II liver test asserts "Moderate ...". |
| **Pancreatic duct injury without a location** now fails closed. compute() returns only an Error asking for the location of the duct injury (neck/body/tail = Grade III, head = Grade IV), with no grade. It used to score Grade III, which under-graded head injuries. It applies to every duct subgrade and to any invalid location value, with or without other findings. The exception is a destructive head injury, which is Grade V whatever the duct location (Codex P1 on #304), so its critical result never waits for an answer that cannot change it. | Notrica 2025, PubMed abstract: the sentences on grade III and grade IV duct injuries. The calculator's own 2024 logic already graded neck/body/tail as III and head as IV. | In the 2024 revision a duct injury in the neck, body or tail stays grade III, while the same injury located right of the portal vein/SMV (the head) is grade IV. The grade depends on location, so none can be given without it. | Audit claim `pancreas-2024-duct-location-required`. Compute: *a pancreatic duct injury without a location fails closed, unless a destructive head injury makes it grade V*. E2E: *should ask for the duct injury location instead of grading*, *grades a destructive head injury as V without a duct location*. |
| **No-modifier note** on kidney 2025 (and the default kidney path) and pancreas 2024, for grades I-II only. | See the rules table above. | See the rules table above. | See the rules table above. The audit checks the exact texts, for grades I-II only. |
| **Liver grade II laceration** option text is now "1-3 cm parenchymal depth, ≤10 cm length (Grade II)" instead of "<10 cm". Scoring is unchanged. | Kozar 2018, Table 2, grade II row, Imaging Criteria laceration item, PDF p. 3 [p. 1121]. | A grade II liver laceration is 1-3 cm deep and at most 10 cm long. | Audit claim `liver-2018-grade-ii-laceration-length`. The audit also runs a mutation check that "≤" inside the pinned span changes the digest. Compute: *liver grade II laceration length follows Kozar 2018 Table 2 (≤10 cm)*. E2E: *should classify Grade II liver injury - laceration 1-3 cm*. |
| **AAST website reference** keeps its citation text ("AAST Official Website - Organ Injury Scale") but no longer links a URL. | Checked 2026-09-28: `https://www.aast.org/resources-detail/injury-scoring-scale` now redirects to a page that holds only a reprint-permissions notice, with no tables. AAST's "Organ Injury Scale Revisions (2018-)" page lists the revisions and links out to the journal, but serves no tables either. No stable public AAST page serves the scales. | Instead of a dead link, only the citation is kept. References without a URL are now rendered as plain text in three places: the in-app list, the static calculator page, and that page's React hydration. The static page generator also accepts a citation without a URL; before, it silently dropped one. The AAST static page is the only generated page that changes. | `verifyRuntime` requires the citation to have no URL and no reference to point at the permissions page. Compute: *the AAST website reference keeps its citation text without the dead link*. E2E: *should keep the AAST website citation without its dead link* and *static page keeps the AAST citation as plain text and hydrates cleanly*. |

## Earlier wording changes (scoring unchanged)

| Changed text | Source + locator | Paraphrase | Runtime binding |
|---|---|---|---|
| `kidney_2018_urinary_extrav` subLabel: "Excreted contrast leaking outside the collecting system on delayed (excretory) phase → Grade IV" (was "Contrast extravasation on delayed phase → Grade IV"). | Kozar 2018: Table 3 grade IV imaging criterion; Table 3 note defining active bleeding; closing paragraph on CT technique, PDF p. 4 [p. 1122]. | Urinary extravasation into a lacerated collecting system is imaging grade IV. Active bleeding is vascular contrast that grows on the delayed phase, so the old wording also fit hemorrhage. Renal injury calls for a delayed excretory phase. | Audit claim `kidney-2018-urinary-extravasation-sublabel`. Compute: *modifier and reworded subLabels are version-accurate*. |
| `pancreas_destructive` subLabel: "Pancreatic head destruction with nonviable parenchyma (2024 revision) → Grade V" (was the 1990 wording). | Notrica 2025, PubMed abstract, sentence defining grade V. | In the 2024 revision, grade V is a destructive pancreatic-head injury with nonviable tissue, subgraded by ductal injury. | Audit claim `pancreas-2024-grade-v-sublabel`. The same compute test. |
| `multiple_injuries` subLabel names the 2018 liver/spleen scope. `kidney_2018_bilateral` gets its own label and subLabel. The info text gains a "GRADE-ADVANCE MODIFIERS" section. | Kozar 2018, Tables 1-3 notes. | As above. | Exact strings in `verifyRuntime`. The same compute test. |
| Keihani 2025 reference: third author is **Matta R** (was "Swaroop M"). | PubMed 39836096 plain-text record, author block. | PubMed lists Keihani S, Tominaga GT, Matta R, and others. | Audit claim `reference-list-identities`. Compute: *the 2025 kidney reference names the published author list*. |

Checkbox subLabels are not rendered yet (a separate renderer change will show them), so they are checked in data, not in the browser.

## Kidney version labels and default: checked, unchanged

- The fields not marked `kidney_2018_*` are the 2025 (Keihani) path. Nothing in the calculator calls that path "legacy".
- With no version chosen, the calculator shows and computes the 2025 fields and reports "OIS Version: 2025". The output is the same as choosing 2025 explicitly.
- The compute test *kidney version labels: no version chosen runs and reports the 2025 path* pins this.

## Audit design notes

- **Exact bytes first.** Each artifact must match its pinned byte length and SHA-256 before it is parsed. A served artifact (HTTP 2xx) that misses any pin fails at once and is never retried or replaced by another host. Pins cover final URL, media type, Memento provenance for archive captures, and bytes.
- **Retries.** Transport failures are retried up to five times per host, with 1/2/4/8 s backoff or `Retry-After` (capped at 20 s). Transport failures are network errors, HTTP 429, HTTP 5xx, a recognised Cloudflare challenge or block page, and HTTP 400 from NCBI only.
- **Fallback and failure.** Only the Kozar PDF has a second host: the Internet Archive capture with identical pinned bytes. Once every host is exhausted the audit fails loudly. A non-transient error such as HTTP 404 fails at once, with no fallback. No path passes without verifying the bytes.
- **Source mutation checks** run at audit time on the real spans. Swapping each trigger word or ceiling (bilateral and multiple, grade III and grade IV, ≤ and <, Moore and Kozar) must change the pinned digest. The audit also confirms that the kidney table has no multiple-injury note and the liver and spleen tables have no bilateral note.
- **Test-file mutation checks.**
  - Artifact drift: same-length digest drift, byte-length drift, and a drifted HTTP 200 that must fail at once (one request, no sleep, no second host).
  - Retrieval: challenge responses are retried and then the archive host is used; exhaustion fails loudly.
  - Runtime mutants, each of which must be rejected by `verifyRuntime`:
    - the former unconditional rule;
    - the rule on the kidney or pancreas;
    - boxes shown on the wrong path;
    - the ceiling removed;
    - loose truthy values;
    - the base-grade description;
    - a duct injury graded without a location;
    - a missing or misplaced note;
    - reverted wording, citation or liver length;
    - a restored dead link;
    - missing info lines.
- Aast.org is behind Cloudflare. Requests from the host were served without a challenge, but GitHub-hosted runners (datacenter IPs) may be challenged. That case is covered by retries and then the identical-bytes archive capture, never by skipping verification.

## Follow-ups (not addressed here)

- `tests/fixtures/aast-trauma-test-data.json` is unused and stale:
  - it uses option values that no longer exist;
  - it labels 2025 kidney changes as "2018";
  - it describes the multiple-injury rule as applying to every organ.
- The 2024 pancreas grade V ductal subgrades are not modeled.
