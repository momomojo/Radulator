# ASPECTS region texts and region grouping: source evidence

Scope: the ten region checkboxes of `src/components/calculators/ASPECTSScore.jsx`
(label, subLabel), the region list in the info text, and the "Regional Breakdown"
result with the two clinical notes that depend on it. The score arithmetic
(ASPECTS = 10 minus the number of affected regions) is unchanged.

## How this is checked

Claims are split into two groups.

- **Automated claims** are checked on every PR by
  `scripts/audit-aspects-region-source.mjs`, which Smoke runs through its
  `scripts/audit-*-source.test.mjs` loop. The audit contacts only NCBI
  E-utilities, with two requests per run, and refuses any other host.
- **Documented claims** rest on sources that have no byte-stable copy: Pexman
  2001 and the developers' own site. The judges read those sources here, at the
  URLs and capture times below. The audit does not fetch them. It still pins
  the exact runtime wording of each documented claim and lists the claim as
  `documented_only` in its report, so a silent change to that text also fails.

```bash
node scripts/audit-aspects-region-source.test.mjs
# or the audit alone:
node --import ./scripts/register-jsx-loader.mjs scripts/audit-aspects-region-source.mjs
```

Each fetched artifact is pinned by its exact byte length and the SHA-256 of its
raw bytes. `retrieve()` checks the pins, the final URL and the media type
before it returns, so nothing is parsed until every pin holds.

A 200 response that misses a pin fails at once and is never retried. Only
transport failures are retried: network errors, timeouts, and HTTP 408, 429
and 5xx. The policy matches the ALBI and KBRC audits: five attempts, 1, 2, 4
and 8 s backoff, and Retry-After honoured and clamped to 30 s.

The repository stores no copied source passages. Each fetched statement is
pinned by the SHA-256 of its exact normalized text between two markers of at
most six words, with a locator and a paraphrase in our own words. This
document gives locators, markers of at most six words and paraphrases only.

## Automated sources

| Key | Source | Identifiers | URL | Pin | Stability |
|---|---|---|---|---|---|
| `barber2000` | Barber PA, Demchuk AM, Zhang J, Buchan AM. Validity and reliability of a quantitative computed tomography score in predicting outcome of hyperacute stroke before thrombolytic therapy. Lancet. 2000;355(9216):1670-1674. The original ASPECTS paper; only the abstract is free. | PMID 10905241 (verified); DOI 10.1016/S0140-6736(00)02237-6 | `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=10905241&rettype=abstract&retmode=text&tool=radulator-aspects-audit` | text/plain, 2,463 bytes, SHA-256 `fee68808adc8d45b02413464c7dc282361e72458bb2a9d340a69becad7a3960d` | Identical bytes at 04:29:01, 04:34:23, 04:52:33 and 04:53:41 UTC on 2026-09-28 |
| `dubey2013` | Dubey P, et al. Acute stroke imaging: recent updates. Stroke Res Treat. 2013;2013:767212. Figure 1 reprints the developers' ASPECTS template from aspectsinstroke.com with the Calgary group's permission. | PMID 23970999; PMCID PMC3732599; DOI 10.1155/2013/767212; CC BY 3.0 | `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&retmode=xml&tool=radulator-aspects-audit&id=3732599` | text/xml, 65,170 bytes, SHA-256 `7a0479726ba0956a36ce9e63050bf0e052fe69ac292428a67a9254b26d54a2ba` | Identical bytes from about 03:30 to 04:53:41 UTC on 2026-09-28, including fetches 68 s apart |

No e-mail parameter is sent. PubMed lists an erratum for Barber 2000 (Lancet
2000;355(9221):2170). The erratum is paywalled, and its content is unknown.

## Checked and not usable for the automated audit

- **Pexman 2001 as PMC XML.** `efetch db=pmc id=7974585` returns 8,178 bytes
  (SHA-256 `71e3f3e95f46a1365a7ab3ada49be5116815f500b8cfaa284a1b2281e8b19e86`).
  That is front matter and abstract only; the record notes that the publisher
  bars full-text XML. It is byte-stable, but it has no body and no figure
  legends, so it cannot carry any claim below.
- **Pexman 2001 as the PMC article page.** Not byte-stable: a per-request id
  and a CSRF token change on every fetch.
- **Pexman 2001 as the PMC PDF.** PMC answers with a short "Preparing to
  download" browser-challenge page. This was not bypassed.
- **The developers' site, aspectsinstroke.com.** The live site fails TLS with
  an expired certificate, which was not bypassed. The pages survive only as
  Internet Archive captures. The archive rate-limits: after about 80 requests
  in 20 minutes it refused connections from this host for about 10 minutes. It
  therefore cannot be a Smoke dependency.

## Documented sources (read by the judges, not fetched)

| Key | Source | Where to read it | Observed bytes (reference only) |
|---|---|---|---|
| `pexman2001` | Pexman JHW, Barber PA, Hill MD, et al. Use of the Alberta Stroke Program Early CT Score (ASPECTS) for assessing CT scans in patients with acute stroke. AJNR Am J Neuroradiol. 2001;22(8):1534-1542. PMID 11559501, PMC7974585. The developers' methods paper. | Live: https://pmc.ncbi.nlm.nih.gov/articles/PMC7974585/ . Fixed copy: https://web.archive.org/web/20250202055743id_/https://pmc.ncbi.nlm.nih.gov/articles/PMC7974585/ (captured 2025-02-02 05:57:43 GMT; its 46-paragraph article body matched the live page on 2026-09-28) | Capture: 143,520 bytes, SHA-256 `1167a826eb0079f360f2cafdbe0040fb39a9bdaa0e6ca92dc54a5132d5b569d7`, archive SHA-1 `6CAKOH2THRQX4SAUN7IR3CMVB4IQDWUJ` |
| `developers_site` "What is ASPECTS" | aspectsinstroke.com (Foothills Medical Centre, University of Calgary) | https://web.archive.org/web/20161206115358id_/http://www.aspectsinstroke.com:80/aspects/what-is-aspects/ (captured 2016-12-06 11:53:58 GMT) | 12,396 bytes, SHA-256 `0fa6d381b95c3eb6d61f082c2c1e5821d3b5b00fcc461fa3666359adebb5a03e`, archive SHA-1 `IEC2BKTXILM7IDIMIOYD3C7XG3CJKYBZ` |
| `developers_site` Training "Insula and basal ganglia" | as above | https://web.archive.org/web/20161229222203id_/http://www.aspectsinstroke.com:80/training-for-aspects/optimal-window-settings222/ (captured 2016-12-29 22:22:03 GMT) | 11,387 bytes, SHA-256 `2ab9a266bbfd2dfbfcb1b8f60bded61ca9befa29393c1d6a768a0c264f5befe5`, archive SHA-1 `YUXRQZ452UCGIVYWN5VJRD43FQHOU6A2` |
| `developers_site` Training "M1-M6 regions" | as above | https://web.archive.org/web/20161230025253id_/http://www.aspectsinstroke.com:80/training-for-aspects/optimal-window-settings227/ (captured 2016-12-30 02:52:53 GMT) | 10,930 bytes, SHA-256 `c2f480242b0061b6a0c122496dbdf45cf6c0a416ffddec1a7f7977a87fd657fb`, archive SHA-1 `YSZ7GX7XZFGGGMWDXBIO7FZHYDQFDDB5` |

The developers' template legend and internal-capsule guidance read the same in
the earliest (2012) captures as in these 2016 captures. The redesigned site
(captured 2024) no longer carries this text.

## Automated claims

| Claim | Runtime text or behaviour | Source and locator | What the source says (paraphrase) |
|---|---|---|---|
| `breakdown-subcortical-is-c-l-ic` | "Regional Breakdown" counts C, L and IC as `Subcortical (C, L, IC): n/3`. Checked for all 1024 region combinations. | `dubey2013` Figure 1 caption | 3 of the 10 points go to the subcortical structures: caudate, lentiform nucleus, internal capsule. |
| `breakdown-insula-is-ganglionic-cortex` | The insular ribbon moves from the old "Subcortical: n/4" to `Ganglionic cortical (I, M1-M3): n/4`; M4-M6 stay `Supraganglionic (M4-M6): n/3`. | `dubey2013` Figure 1 caption | The other 7 points go to MCA cortex: the insular cortex and M1-M6. The template defines M2 by its position beside the insular ribbon, so the ribbon lies on the lower cut with M1-M3. M4-M6 are the territories directly above M1-M3, higher than the basal ganglia. |
| `subcortical-note-uses-corrected-grouping` | The "Predominantly subcortical involvement" rule text is unchanged. It now needs C, L and IC with no cortical region (I or M1-M6). Before, any 3 of C, L, IC and I with no M region triggered it. | as above | as above (grouping only; the note's clinical suggestion is not source-audited) |
| `m1-m6-note-names-its-trigger` | The collateral note now reads "Complete M1-M6 cortical involvement ...". The trigger (M1-M6 all involved) is unchanged. | `dubey2013` Figure 1 caption | MCA cortex includes the insular cortex, so "complete cortical MCA involvement" overstated a trigger that never required the insula. |
| `score-is-ten-minus-regions` | Ten region checkboxes; ASPECTS = 10 minus affected regions. Checked for all 1024 combinations; unchanged by this PR. | `barber2000` Abstract, Methods; `dubey2013` Figure 1 caption | The score splits the MCA territory into ten regions. The template gives 3 points to the three subcortical regions and 7 to the seven cortical ones, one point per region. |
| `region-labels-name-template-regions` | The ten labels, e.g. "M1 - Anterior MCA Cortex (Ganglionic Level)" and "M4 - Anterior MCA Territory (Supraganglionic)" | `dubey2013` Figure 1 caption | The template key names C, I, IC and L; M1, M2 and M3 as the front, lateral and back MCA cortex; and M4, M5 and M6 as the matching territories above them. |
| `two-levels-in-info-text` | Info text lists C, L, IC, I and M1-M3 under the ganglionic level and M4-M6 under the supraganglionic level. | `dubey2013` Figure 1 caption | M4-M6 lie directly above M1-M3, higher than the basal ganglia. |
| `m2-lateral-to-insular-ribbon` | M2 subLabel "Anterior temporal lobe, lateral to insular ribbon" and info line: the "lateral to insular ribbon" part | `dubey2013` Figure 1 caption | M2 is the MCA cortex on the lateral side of the insular ribbon. |
| `m3-posterior-mca-cortex-behind-m2` | M3 subLabel changes from "Posterior temporal lobe at ganglionic level" to "MCA cortex behind M2". The info line "M3 - Posterior temporal lobe (posterior MCA cortex)" becomes "M3 - Posterior MCA cortex (behind M2)". | `dubey2013` Figure 1 caption | M3 is the back part of the MCA cortex, after the front (M1) and lateral (M2) parts. No source equates M3 with the posterior temporal lobe. |
| `m4-m6-immediately-superior` | M4-M6 subLabels "Immediately superior to M1/M2/M3" and info lines | `dubey2013` Figure 1 caption | M4-M6 are the front, lateral and back MCA territories directly above M1-M3. |
| `insular-ribbon-is-insular-cortex` | I subLabel "Insular cortex / ..." and info line "I - Insular ribbon (insular cortex)" | `dubey2013` Figure 1 caption | The insular ribbon region is scored as insular cortex, one of the 7 cortical points. |

Rendering guardrails (app rules, not source claims) are checked for every
checkbox. A subLabel must not contain parentheses, because FieldLabel renders
`label (subLabel)`. It also must not repeat the level named in the label's
parenthesis. For that reason all ten subLabels drop "(-1 point)"; the info text
still states the one-point-per-region rule. The M1 and M3 subLabels also drop
"at ganglionic level", since the label already says "(Ganglionic Level)".

## Documented-only claims

These claims are **not** in the automated audit. The runtime wording is pinned
by the audit, and the source is read by hand at the locator. "Starts at" gives
a marker of at most six words.

| Claim | Runtime text | Source, locator, starts at | What the source says (paraphrase) |
|---|---|---|---|
| `internal-capsule-posterior-limb` | IC subLabel "Posterior limb of internal capsule"; info line "IC - Internal capsule (posterior limb)" | `developers_site` Training "Insula and basal ganglia", Internal capsule section, starts at "Internal capsular region is scored 0". Also `pexman2001` Results, "How Different Physicians Interpreted ASPECTS", starts at "The internal capsule was scored variably." | The developers count the internal capsule region as involved when its posterior limb is hypodense, because anterior-limb hypodensity is hard to score on non-contrast CT. Pexman records that the six developers first split 3:3 on this: three looked only at the posterior limb, three at any part of either limb. The earlier review's proposed "Internal capsule at the ganglionic level" was therefore not applied. |
| `m1-frontal-operculum` | M1 subLabel "Frontal operculum" (was "Frontal operculum at ganglionic level"); info line "M1 - Frontal operculum (anterior MCA cortex)" | `pexman2001` Results, M-area paragraph, starts at "All observers regarded M1 as anterior" | All six developers put M1 ahead of where the sylvian fissure begins, and counted the frontal operculum as part of M1. |
| `m2-front-edge-anterior-temporal-lobe` | M2 subLabel and info line: the "anterior temporal lobe" part | `pexman2001` Results, M-area paragraph, starts at "All observers identified the anterior end" | All six developers started M2 at the front tip of the temporal lobe; they disagreed on where its slanted back edge lies. |
| `insular-ribbon-sign` | I subLabel: "... / loss of insular ribbon" | `pexman2001` Results, first paragraph, starts at "Hypoattenuation of the insular ribbon was". Also `developers_site` "Insula and basal ganglia", Insular cortex section, starts at "Hypoattenuation of the insular ribbon is". | Insular ribbon hypoattenuation is loss of gray/white differentiation of the insular cortex; either half can be lost on its own. |
| `caudate-head` | Label "C - Caudate Head"; info line "C - Caudate head" | `pexman2001` Fig 1 legend, starts at "C = caudate head;". Also `developers_site` "Insula and basal ganglia", Basal ganglia section, starts at "The caudate nucleus is assessed in". | The study-form key names the caudate head. The developers assess the caudate head on the ganglionic level, and its body and tail on the supraganglionic level. |
| `one-point-subtracted-per-region` (supplements `score-is-ten-minus-regions`) | Info text: subtract 1 point for each affected region | `pexman2001` Methods, starts at "The ASPECTS was determined from two". Also `developers_site` "What is ASPECTS", How to compute ASPECTS, starts at "To compute the ASPECTS, 1 point". | ASPECTS is read on two standard cuts. The MCA territory is worth 10 points, and one point comes off for early ischemic change in each defined region. |
| `level-assignment-at-caudate-head` (supplements `breakdown-insula-is-ganglionic-cortex`) | Breakdown and info text place I with M1-M3 on the ganglionic level | `developers_site` Training "M1-M6 regions", starts at "Any ischemic lesion on axial CT" and "Ischemic lesions above the level of" | A lesion at or below the caudate-head level is assigned to a ganglionic region (M1-M3, insula, caudate, lentiform nucleus, internal capsule). A lesion above it is assigned to M4-M6. |
| `m-areas-geometric-and-sylvian-divisions` (supplements `m3-posterior-mca-cortex-behind-m2`) | M3 wording names no lobe | `pexman2001` Results, M-area paragraph, starts at "It was stressed that the M5". Also Discussion, paragraph on CT baselines, starts at "On the ganglionic level, the anatomic". | The M areas are geometric rather than anatomic, and on the ganglionic cut the developers drew the divisions from the two ends of the sylvian fissure. |

**Reference digests, not enforced.** When these documented statements were
read on 2026-09-28, the extraction code in commit `806e37c`
(`scripts/audit-aspects-region-source.mjs` at that commit) gave these span
SHA-256 values:
- Pexman internal capsule: `9300a10d7a5ca35955e2334a3244569522638ccf15b7170f754a1cf603786718`
- Pexman M1: `c3fc285ddd730bd33f095f1b4cbce00ac609424fb717c5d26fb5e2e1101781f4`
- Pexman M2: `1fea8ceb03ab7347e74d4b8646d9d79d3dcf293295dee978889047ebb0911707`
- Pexman insular ribbon: `dcdf78866e77297b2231c64533dc39bdd9a4eed90b6dcc739e9a29ed07fbc499`
- Pexman Fig 1 legend: `2e95916967d22cee28ea0d2130fbfc9684c20bd75d073fbd264ae65dfb5b4bba`
- Pexman Methods: `6ce958a5911d5a9479eaa9c45c77c012c61bfb2dd21ecafdc8939fdf42fa822f`
- Pexman geometric M areas: `be694873d12f98d72ed6c585971f4ba004e8aae4963feeab4045d9d3292be3a6`
- Pexman sylvian divisions: `2c7354c6d6715be5e26c6318ff3c3e086009b7c000c2e2ba1cd429299fd40666`
- Developers' internal capsule: `548826ea3a4d0ed4a817cdabc6d16851da8ec321fe10d84576a496eea34f3dde`
- Developers' insular cortex: `564331d2e51274aa4db5d22d1eac2410754d2d23c6f95d12d8a8d3a758654a43`
- Developers' caudate: `61fb2e7a599f2bbd7e7f98dacebf6a3366ee951d7673ff2a3a60aa5f5a5d9cfb`
- Developers' one point per region: `551b459d7e6ca0a957e9c19a4f33d90eb6f2dcee4beddff4d29cdb1e1ffa9f45`
- Developers' ganglionic assignment: `079d3b6025afc5419561e9352d2640af49e5a9f1a0ae23549e5d1c83552fb6fd`
- Developers' supraganglionic assignment: `87a688d9bf54efc2a59054489572bfbc95ffbefea74ab2c7e9b6b448b038d135`

## Not asserted by these sources

- The lentiform subLabel "Putamen and globus pallidus". This is standard
  anatomy and none of these sources states it.
- The clinical suggestions in the pattern notes (proximal M1 occlusion,
  lenticulostriate territory, collateral status). Only their region grouping is
  bound here.
- Thrombectomy eligibility, time-window and trial-threshold text.
- Whole-calculator clinical acceptance.

## Tests

- `tests/aspects-regions-compute.test.mjs` covers:
  - the breakdown vectors;
  - all 1024 region combinations (score, breakdown and both notes);
  - the exact subLabels;
  - the rendering guardrails (no parentheses, no repeated level);
  - the info-text region list.
- `tests/e2e/calculators/neuroradiology/aspects-score.spec.js` covers the
  visible breakdown, the isolated-insula case, the note boundary, the renamed
  collateral note and the M3 info line.
- `scripts/audit-aspects-region-source.test.mjs` runs the live audit. It then
  replays the fetched bytes through `retrieve()` with a counting fake fetch.
  For both sources, each failure mode must fail at once with exactly one fetch
  and no retry:
  1. same-length digest drift (one byte changed);
  2. byte-length drift (one byte added or removed);
  3. a drifted HTTP 200: an E-utilities error page, a wrong media type, or a
     moved host, path, query or protocol.

  It also covers:
  - edits inside a fetched statement, which fail at the byte pin before any
    parsing;
  - span drift under re-pinned bytes;
  - the NCBI-only host rule;
  - transport retries (network error, 503 with Retry-After, 429, 500), and
    403/404/410, which are not retried;
  - the Retry-After clamp;
  - a reverted calculator (old grouping, old note trigger, old M3 text, the
    reviewer's IC text, a level-repeating M1 or M3 subLabel, and "(-1 point)");
  - that every documented claim is listed here.

  It also writes weakened copies of the audit (retrying a pin miss, no length
  check, no SHA-256 check, no media-type check) to a temporary directory. It
  shows that each copy lets a drift through, or fails on a different pin, so
  the failure-mode tests would go red.
