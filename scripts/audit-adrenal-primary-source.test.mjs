#!/usr/bin/env node

import "./register-jsx-loader.mjs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import process from "node:process";

const run = spawnSync(
  process.execPath,
  ["--import", "./scripts/register-jsx-loader.mjs", "scripts/audit-adrenal-primary-source.mjs", "--json"],
  { cwd: process.cwd(), encoding: "utf8" },
);
assert.equal(
  run.status,
  0,
  `adrenal primary-source audit failed\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`,
);

const computeTests = spawnSync(
  process.execPath,
  ["--import", "./scripts/register-jsx-loader.mjs", "--test", "tests/adrenal-input-safety-compute.test.mjs"],
  { cwd: process.cwd(), encoding: "utf8" },
);
assert.equal(
  computeTests.status,
  0,
  `adrenal input-safety computation tests failed\nstdout:\n${computeTests.stdout}\nstderr:\n${computeTests.stderr}`,
);

const audit = JSON.parse(run.stdout);
assert.equal(audit.schema, "radulator-adrenal-primary-source-audit/v1");
assert.deepEqual(audit.calculator_ids, ["adrenal-ct", "adrenal-mri"]);
const [ese, pmc, pubmed] = audit.artifacts;
assert.deepEqual(ese, {
  id: "ese-ensat-2023-guideline-pdf",
  doi: "10.1093/ejendo/lvad066",
  final_url: "https://eprints.whiterose.ac.uk/id/eprint/208070/1/lvad066.pdf",
  media_type: "application/pdf",
  bytes: 2_086_909,
  sha256: "70faac5423838b806d5be7abe489a8bd35b7ae12714d32d821fcdc083f80d47f",
  digest_scope: "artifact-bytes",
  pages: 43,
  license: "CC BY",
});
assert.deepEqual(pmc, {
  id: "schloetelburg-2021-pmc-jats",
  doi: "10.1530/EJE-21-0650",
  pmcid: "PMC8679842",
  final_url: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi",
  media_type: "text/xml",
  bytes: 116_668,
  sha256: "9210b41674e56030b538fc9329a94b540a0079e64ba4e162819eb16a33221d75",
  digest_scope: "artifact-bytes",
  license: "CC BY 4.0",
});
assert.equal(pubmed.id, "pubmed-primary-abstracts");
assert.equal(pubmed.final_url, "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi");
assert.equal(pubmed.media_type, "text/xml");
assert.equal(pubmed.digest_scope, "normalized-record-json (PubMed XML bytes are volatile)");
assert.deepEqual(pubmed.records, {
  "8598820": { doi: "10.1002/mrm.1910340618", normalized_bytes: 690, normalized_sha256: "d62283e1af3bff96f54aeea728f55cece85c0843d7c1eeee5faf5d8a61dbb42e" },
  "8756926": { doi: "10.1148/radiology.200.3.8756926", normalized_bytes: 1673, normalized_sha256: "14ffba8c110b5926addf25aea7b0b9624d286be5b25de5e4f7ae2a5552b74dc5" },
  "11044054": { doi: "10.2214/ajr.175.5.1751411", normalized_bytes: 2033, normalized_sha256: "5b11073e37b139d5b8c77f5b27d9ea6ba44c48e7eaa824eeab80a4c831ffc648" },
  "11867777": { doi: "10.1148/radiol.2223010766", normalized_bytes: 1407, normalized_sha256: "42ff089818380f9f0bf38c218e2c4312b5a52d0a4384faa318d8cf28247ce990" },
  "12760936": { doi: "10.2214/ajr.180.6.1801649", normalized_bytes: 1562, normalized_sha256: "ff16a896fe75842f30a710aae1be2e2ec90de4d24ff575e5067942d027e97c2c" },
  "15208141": { doi: "10.2214/ajr.183.1.1830215", normalized_bytes: 2056, normalized_sha256: "84566191b9f711268c3072d5571273f7df5b0f3e820515e6f283db6a120b55ba" },
  "23151828": { doi: "10.1148/radiol.12120110", normalized_bytes: 2320, normalized_sha256: "c06c66e114f99bc0bfa143af4febc570cd59207fe8a07488ee207ccdf3109cea" },
  "23789665": { doi: "10.2214/AJR.12.9620", normalized_bytes: 2028, normalized_sha256: "78f7dc67f910f69d272a53a16a96a57647669794d56dffef4040ab86fe3f4984" },
  "26254908": { doi: "10.1007/s00261-015-0521-x", normalized_bytes: 1754, normalized_sha256: "cb0a1dbb095aa60ed6f0395c50a3d4ff762fdaf12978eab7d0c9265c30bdefd1" },
});

// Every source statement is pinned by the length and SHA-256 of its exact normalized span.
assert.deepEqual(
  audit.source_statements.map(({ id, source, locator, length, sha256 }) => [id, source, locator, length, sha256]),
  [
    ["ese-hu-scale", "ese", "ESE/ENSAT 2023 §2.3 Short overview on adrenal imaging, printed p. G8 (PDF page 9)", 95, "e045075c40fb71cdf0a16bec0114b33c54a42a8e9bea9fd0593324564b73add0"],
    ["ese-washout-timing", "ese", "ESE/ENSAT 2023 §2.3 Short overview on adrenal imaging, printed p. G9 (PDF page 10)", 139, "86a8c839ba090790fdc057d34743c9071746b46a499acb8194f5f25c61a6b19f"],
    ["ese-chemical-shift-lipid", "ese", "ESE/ENSAT 2023 §2.3 Short overview on adrenal imaging, printed p. G9 (PDF page 10)", 261, "0029c943d5729476d3f94845155c76331687da9cddfae1c792c2c34c983530e2"],
    ["ese-mr-arbitrary-units", "ese", "ESE/ENSAT 2023 §2.3 Short overview on adrenal imaging, printed p. G9 (PDF page 10)", 101, "7a98625ab4bae9b1baeb37975ad27091058efc9d9afb191501ff5d3d86e0fd55"],
    ["ese-mr-quantitative-measures", "ese", "ESE/ENSAT 2023 §2.3 Short overview on adrenal imaging, printed p. G9 (PDF page 10)", 90, "f25b98b38c21310950d1bf1d5bd656a71edf081237ab9fd0ba39bb83e14b6b22"],
    ["ese-washout-cutoffs-low-evidence", "ese", "ESE/ENSAT 2023 §4.1.1, paragraph 'Washout-CT.', printed p. G13 (PDF page 14)", 198, "a26fc67e73c8467d6bd931c0324f6f0190846ba74d486914c94a86bf10e0f375"],
    ["ese-washout-malignant-misses", "ese", "ESE/ENSAT 2023 §4.1.1, paragraph 'Washout-CT.', printed p. G13 (PDF page 14)", 151, "d95ea1c6fd72baadbdeb6955f2cee2c0b149b47108c2114de5b013736ecac1b3"],
    ["ese-washout-58-needs-validation", "ese", "ESE/ENSAT 2023 §4.1.1, paragraph 'Washout-CT.', printed p. G13 (PDF page 14)", 171, "7a938dcc11d8b9b39ae43776a4bb9f1afc5136bd8f3f0bc8e67f7a56a0e3581f"],
    ["ese-mri-quantitation-not-standardized", "ese", "ESE/ENSAT 2023 §5.2 R.2.3 Reasoning, printed p. G19 (PDF page 20)", 218, "de324ed7b55a5ce0f6ae375077642bb1e89025e909b724a5af22bbc89edec7f9"],
    ["ese-table4-mri-row", "ese", "ESE/ENSAT 2023 §5.2 Table 4, row 'MRI\u2014chemical shift', printed p. G19 (PDF page 20)", 84, "83ff5038b674f3aa22557a6c27403f8cc212bee344ba7aa19fd5566094763de0"],
    ["ese-table4-washout-row", "ese", "ESE/ENSAT 2023 §5.2 Table 4, row 'CT with delayed contrast media washout', printed p. G19 (PDF page 20)", 54, "a53163ff468c9bb11f3cd0f1baa7fd2bcdf779951ff65793e2d14ea795a33d4a"],
    ["ese-table4-footnote-a", "ese", "ESE/ENSAT 2023 §5.2 Table 4 footnote a, printed p. G19 (PDF page 20)", 427, "d802b679fdf36bff9c1fc4cfafaae61fd14be87c36e17cf01dea2563398fbe6b"],
    ["ese-table4-footnote-f", "ese", "ESE/ENSAT 2023 §5.2 Table 4 footnote f, printed p. G19 (PDF page 20)", 125, "1a0fe6310f6eb0242bec3fbc25767e44a1541dfc9122d283bc3512f831e34f61"],
    ["ese-reference-72", "ese", "ESE/ENSAT 2023 References, entry 72, printed p. G35 (PDF page 36)", 197, "630ef8c7884cea3f35c69c4f3e1ee8db6417bf32f0fbc847b91d2539c2b15a65"],
    ["caoili-2000-thresholds", "pubmed", "PMID 11044054 (Caoili 2000) abstract CONCLUSION", 261, "a84cf8326fab5f0410d8aca746a77d47d41966d8a2dee525df683c2804ab1881"],
    ["caoili-2002-apw-inclusive", "pubmed", "PMID 11867777 (Caoili 2002) abstract MATERIALS AND METHODS", 153, "c6cbb3ba4f59f2c13df2943848ce97d9bd7d4533c0955cdd751bd5481e473034"],
    ["caoili-2002-accuracy", "pubmed", "PMID 11867777 (Caoili 2002) abstract RESULTS", 80, "016217b29d7fac4db80f62d58143136aec22fd4de4791657b6f156652729bf03"],
    ["choi-2013-metastases-meet-thresholds", "pubmed", "PMID 23151828 (Choi 2013) abstract RESULTS", 178, "f99fbd92bc4597824a93d63d0b012e30c6a6705a46ab00f9c62c1977ce98a851"],
    ["choi-2013-conclusion", "pubmed", "PMID 23151828 (Choi 2013) abstract CONCLUSION", 275, "b7681ac955490c1a73461af8776733d10fca49e818141e154c837b3b3743f96e"],
    ["park-2015-criteria", "pubmed", "PMID 26254908 (Park 2015) abstract MATERIALS AND METHODS", 196, "7b7360853d8bc16a119689e0cee93088e5392fc1d1012a2e1c453f44075712ac"],
    ["park-2015-large-adenoma-sensitivity", "pubmed", "PMID 26254908 (Park 2015) abstract RESULTS", 139, "a41a02e2914c5bfb91695c937bcbf30578683b4ebf005e71fec1339054bbd477"],
    ["patel-2013-pheochromocytoma-overlap", "pubmed", "PMID 23789665 (Patel 2013) abstract RESULTS", 128, "2e45cac4c3c2b21b543bde1ea8fad37464f4d11c9bfd65971efffdd79a3a3e74"],
    ["patel-2013-conclusion", "pubmed", "PMID 23789665 (Patel 2013) abstract CONCLUSION", 141, "cbfe9b87f2055d37d2b46125409bd28a0398e6b29710148de5f6b28370c5eef8"],
    ["fujiyoshi-2003-sii-formula", "pubmed", "PMID 12760936 (Fujiyoshi 2003) abstract MATERIALS AND METHODS", 170, "1b33964bf6005981e7c14617365aad4856163cdff94e1f998ee3a4e152124a62"],
    ["fujiyoshi-2003-sii-cutoff", "pubmed", "PMID 12760936 (Fujiyoshi 2003) abstract RESULTS", 146, "10901e15a82e2bb2e1f660ba1fec798d7e844b32be03ce78bce1f2131821ada4"],
    ["israel-2004-sii-criterion", "pubmed", "PMID 15208141 (Israel 2004) abstract MATERIALS AND METHODS", 300, "930015e47e5c9192a8e3b5fe9e9e8acaf75a9c428d36dc82897fd3b781798b6b"],
    ["outwater-1996-lesion-to-spleen-ratios", "pubmed", "PMID 8756926 (Outwater 1996) abstract MATERIALS AND METHODS", 287, "77412c407885adf58267202a18b85fbcc731bf0b4115a3fcb0e3a30673b8e737"],
    ["gudbjartsson-1995-magnitude-rician", "pubmed", "PMID 8598820 (Gudbjartsson 1995, PMC2254141) abstract", 205, "d06684a5d7e09790b0b9db9344ad86c1b88f3a0a399436999de57524a667fbb6"],
    ["gudbjartsson-1995-phase-differs", "pubmed", "PMID 8598820 (Gudbjartsson 1995, PMC2254141) abstract", 125, "c1427a8926210928054103c997928555dd4d9ab8bb7c8797f61a6e249b6b161e"],
    ["schloetelburg-2021-apw-malignant-above-60", "pmc", "PMC8679842 Results > 'Absolute percentage wash-out'", 139, "c94e2a1ec6197fe598e3b03bb2e644b9430249a1e0ee92f25c1051d9caa7a623"],
    ["schloetelburg-2021-rcc-metastasis-example", "pmc", "PMC8679842 Results > 'Absolute percentage wash-out', Figure 2 caption", 113, "76292dc9af70176e0985731aa5a946c799f8a6f1da0b6ae926aa42be95c41fa6"],
    ["schloetelburg-2021-rpw-malignant-above-40", "pmc", "PMC8679842 Results > 'Relative percentage wash-out'", 136, "fed5b72a6c67d0c279334d782008ba6614ed96b6970a4fd59c942d50e2e5272c"],
    ["schloetelburg-2021-conclusion", "pmc", "PMC8679842 Abstract > Conclusions", 112, "dbddc6e4bd1edda83e0b4135064a8f9e8126a1cb755b0eaea5a2dcccf4d8f94f"],
  ],
);
for (const statement of audit.source_statements) {
  for (const marker of [statement.from, statement.to]) {
    const words = marker.trim().split(/[\s\u2010-\u2015\u2212-]+/).filter(Boolean).length;
    assert.ok(words <= 6, `${statement.id}: marker ${JSON.stringify(marker)} exceeds 6 words`);
  }
  assert.ok(statement.paraphrase.length > 0 && !statement.paraphrase.includes("\n"), `${statement.id}: one-line paraphrase required`);
}
assert.equal(audit.ese_equations, "ESE/ENSAT 2023 §2.3 Short overview on adrenal imaging, printed p. G9 (PDF page 10)");
assert.deepEqual(audit.source_claims, {
  rpw_equation: "100 x (HUmax - HU10/15min) / HUmax",
  apw_equation: "100 x (HUmax - HU10/15min) / (HUmax - HUnativ)",
  washout_criteria: "APW ≥ 60% or RPW ≥ 40%",
  malignant_tumors_missed_at_conventional_cutoffs: { apw: "22%", rpw: "8%" },
  rcc_hcc_metastases_falsely_adenoma: { apw: "95% (18/19)", rpw: "89% (17/19)" },
  large_adenoma_ct_sensitivity: "66.7% (22/33)",
  ese_2023_table4_washout_criterion: "RPW > 58%",
  ese_2023_older_rpw_cutoff: "40%",
  sii_equation: "100 x (SI in-phase - SI opposed-phase) / SI in-phase",
  sii_cutoff: 16.5,
  sii_cutoff_range: "11.2-16.5%",
  sii_later_criterion: "greater than 16.5%",
});
assert.deepEqual(audit.runtime_bindings, {
  app_benign_adenoma_banner_absent: true,
  ct_formula_vectors: 5,
  ct_boundaries: [
    { id: "apw-at-threshold", apw: "60.0", rpw: "30.0", interpretation: "Suggests adrenal adenoma" },
    { id: "apw-below-threshold", apw: "59.9", rpw: "30.0", interpretation: "Indeterminate / non\u2011adenoma" },
    { id: "rpw-at-threshold", apw: "50.0", rpw: "40.0", interpretation: "Suggests adrenal adenoma" },
    { id: "rpw-below-threshold", apw: "49.9", rpw: "39.9", interpretation: "Indeterminate / non\u2011adenoma" },
    { id: "smoke-5-80-35", apw: "60.0", rpw: "56.3", interpretation: "Suggests adrenal adenoma" },
  ],
  ct_undefined_equations_error_only: ["missing", "HUmax=0", "HUmax=HUnativ", "non-finite"],
  mri_boundaries: [
    { id: "sii-above-threshold", sii: "16.6", interpretation: "Suggests lipid\u2011rich adenoma" },
    { id: "sii-at-threshold", sii: "16.5", interpretation: "Suggests lipid\u2011rich adenoma" },
    { id: "sii-below-threshold", sii: "16.4", interpretation: "Non\u2011adenoma / lipid\u2011poor" },
    { id: "zero-opposed-phase-magnitude", sii: "100.0", interpretation: "Suggests lipid\u2011rich adenoma" },
  ],
  mri_invalid_domain_error_only: ["missing", "negative magnitude", "adrenal in-phase=0", "spleen in-phase=0", "spleen opposed-phase=0"],
  mri_magnitude_instruction_present: true,
});
// Pre-existing gaps are reported, never silently certified.
assert.deepEqual(
  audit.open_discrepancies.map(({ id, status }) => [id, status]),
  [
    ["ct-conventional-thresholds-vs-ese-2023-table4", "pre-existing; not changed by this branch; not certified by this audit"],
    ["mri-sii-exact-threshold-inclusivity", "pre-existing; not changed by this branch; not certified by this audit"],
  ],
);
assert.equal(audit.source_text_committed, false);
assert.equal(audit.source_bytes_committed, false);

// In-process mutation checks against the live sources: the audit must reject a
// one-word edit inside every pinned span, a changed source threshold, a changed
// runtime rule or formula, a reintroduced benign banner and bad retrieval identity.
const {
  MAX_MARKER_WORDS,
  STATEMENTS,
  bindCtRuntime,
  bindMriRuntime,
  checkStatementText,
  compactProse,
  fetchArtifact,
  loadSources,
  locateStatement,
  markerWordCount,
  parsePubmed,
  sourceThresholds,
  spanOf,
  verifyStatements,
} = await import("./audit-adrenal-primary-source.mjs");

assert.equal(MAX_MARKER_WORDS, 6);
for (const statement of STATEMENTS) {
  for (const marker of [statement.from, statement.to, statement.after, statement.before].filter(Boolean)) {
    assert.ok(markerWordCount(marker) <= MAX_MARKER_WORDS, `${statement.id}: marker ${JSON.stringify(marker)} exceeds ${MAX_MARKER_WORDS} words`);
  }
}

const sources = await loadSources();
const spans = verifyStatements(sources);
const thresholds = sourceThresholds(spans);
assert.deepEqual([thresholds.ct.apw, thresholds.ct.rpw, thresholds.mri.sii], [60, 40, 16.5]);

function mutateOneWord(statement, text) {
  const span = spanOf(text, statement);
  assert.ok(span.interiorEnd > span.interiorStart, `${statement.id}: span has no text between its markers`);
  if (statement.source === "ese") {
    // Compacted PDF text has no spaces: change one letter in the middle of the span.
    const at = span.interiorStart + Math.floor((span.interiorEnd - span.interiorStart) / 2);
    return `${text.slice(0, at)}${text[at] === "x" ? "y" : "x"}${text.slice(at + 1)}`;
  }
  const words = [...text.slice(span.interiorStart, span.interiorEnd).matchAll(/\S+/g)];
  assert.ok(words.length > 0, `${statement.id}: span has no word between its markers`);
  const word = words[Math.floor(words.length / 2)];
  const at = span.interiorStart + word.index;
  return `${text.slice(0, at)}mutated${text.slice(at + word[0].length)}`;
}
for (const statement of STATEMENTS) {
  const { text, scope } = locateStatement(sources, statement);
  checkStatementText(statement, text, scope);
  assert.throws(
    () => checkStatementText(statement, mutateOneWord(statement, text), scope),
    new RegExp(`${statement.id}: pinned span drifted`),
  );
}

// A changed source threshold fails the span digest, and would fail the
// cross-source and runtime bindings even if the digest were bypassed.
const park = STATEMENTS.find(({ id }) => id === "park-2015-criteria");
const parkLocator = locateStatement(sources, park);
assert.ok(parkLocator.text.includes("≥ 60%"));
assert.throws(
  () => checkStatementText(park, parkLocator.text.replace("≥ 60%", "≥ 58%"), parkLocator.scope),
  /park-2015-criteria: pinned span drifted/,
);
const bypassed = new Map(spans);
bypassed.set("park-2015-criteria", { ...spans.get("park-2015-criteria"), value: spans.get("park-2015-criteria").value.replace("≥ 60%", "≥ 58%") });
assert.throws(() => sourceThresholds(bypassed), /APW thresholds disagree/);

const runtimeSources = {
  appSource: await readFile("src/App.jsx", "utf8"),
  ctSource: await readFile("src/components/calculators/AdrenalCTWashout.jsx", "utf8"),
  mriSource: await readFile("src/components/calculators/AdrenalMRICSI.jsx", "utf8"),
};
bindCtRuntime(thresholds.ct, runtimeSources);
bindMriRuntime(thresholds.mri, runtimeSources);
assert.throws(() => bindCtRuntime({ ...thresholds.ct, apw: 58 }, runtimeSources), /decision rule/);
assert.throws(() => bindCtRuntime({ ...thresholds.ct, rpw: 58 }, runtimeSources), /decision rule/);
assert.throws(() => bindCtRuntime({ ...thresholds.ct, largeAdenomaSensitivity: 60 }, runtimeSources), /large-adenoma caveat/);
assert.throws(() => bindMriRuntime({ ...thresholds.mri, sii: 11.2 }, runtimeSources), /SII threshold/);
assert.throws(
  () => bindCtRuntime(thresholds.ct, {
    ...runtimeSources,
    appSource: `${runtimeSources.appSource}\n<span>Absolute washout ≥60% indicates benign adenoma.</span>`,
  }),
  /benign adenoma/,
);
assert.throws(
  () => bindCtRuntime(thresholds.ct, {
    ...runtimeSources,
    ctSource: runtimeSources.ctSource.replace("const rpw = (decrease / portal) * 100;", "const rpw = (decrease / enhancement) * 100;"),
  }),
  /RPW expression drifted/,
);
assert.throws(
  () => bindMriRuntime(thresholds.mri, {
    mriSource: runtimeSources.mriSource.replace("const siIdx = ((a_ip - a_op) / a_ip) * 100;", "const siIdx = ((a_ip - a_op) / a_op) * 100;"),
  }),
  /SII drifted/,
);

assert.equal(compactProse("wash-\nout at 15 min-\nutes"), compactProse("washout at 15 minutes"));

// parsePubmed must take the article's own DOI, never one from its reference list.
const pubmedXml = `<PubmedArticleSet><PubmedArticle><MedlineCitation Status="MEDLINE"><PMID Version="1">1</PMID><Article><ArticleTitle>T</ArticleTitle><Abstract><AbstractText Label="RESULTS">a &lt; b</AbstractText></Abstract></Article></MedlineCitation><PubmedData><ArticleIdList><ArticleId IdType="pubmed">1</ArticleId><ArticleId IdType="doi">10.1/own</ArticleId></ArticleIdList><ReferenceList><Reference><ArticleIdList><ArticleId IdType="doi">10.1/cited</ArticleId></ArticleIdList></Reference></ReferenceList></PubmedData></PubmedArticle></PubmedArticleSet>`;
const parsed = parsePubmed(pubmedXml).get("1");
assert.equal(parsed.doi, "10.1/own");
assert.deepEqual(parsed.sections, [["RESULTS", "a < b"]]);

const artifact = { id: "fake", url: "https://example.org/a.pdf", host: "example.org", path: "/a.pdf", media_type: "application/pdf" };
const reply = (status, url = artifact.url, type = "application/pdf") => ({
  ok: status >= 200 && status < 300,
  status,
  url,
  headers: new Headers({ "content-type": type }),
  arrayBuffer: async () => new TextEncoder().encode("pdf").buffer,
  body: { cancel: async () => {} },
});
await assert.rejects(fetchArtifact(artifact, async () => reply(200, "https://mirror.example.net/a.pdf")), /final URL host drifted/);
await assert.rejects(fetchArtifact(artifact, async () => reply(200, artifact.url, "text/html")), /media type drifted/);
let calls = 0;
await assert.rejects(fetchArtifact(artifact, async () => { calls += 1; return reply(404); }), /after 1 attempt\(s\) \(HTTP 404\)/);
assert.equal(calls, 1, "a 4xx must not be retried");
calls = 0;
await assert.rejects(fetchArtifact(artifact, async () => { calls += 1; return reply(400); }), /after 1 attempt\(s\) \(HTTP 400\)/);
assert.equal(calls, 1, "a 400 from a non-NCBI host must not be retried");
calls = 0;
const retried = await fetchArtifact(artifact, async () => { calls += 1; return reply(calls === 1 ? 503 : 200); });
assert.equal(retried.attempts, 2);
assert.equal(retried.bytes.toString(), "pdf");
calls = 0;
const ncbiArtifact = { ...artifact, retry_statuses: [400, 429, 500, 502, 503, 504] };
const ncbiRetried = await fetchArtifact(ncbiArtifact, async () => { calls += 1; return reply(calls === 1 ? 400 : 200); });
assert.equal(ncbiRetried.attempts, 2, "NCBI artifacts retry a transient 400");

console.log(
  `Adrenal primary-source audit verified 3 pinned artifacts and ${STATEMENTS.length} span-pinned statements, bound washout and chemical-shift boundaries to the runtime, and rejected a one-word edit in every span plus threshold, formula, banner and retrieval mutations.`,
);
