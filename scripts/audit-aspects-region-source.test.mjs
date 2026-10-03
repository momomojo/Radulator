#!/usr/bin/env node

// Runs the ASPECTS region source audit once against the live NCBI sources and checks its JSON
// report. It then replays the bytes that run fetched, offline and with targeted mutations, to
// show that every raw-byte pin holds, that a drifted 200 response fails at once without a
// retry, that requests go one at a time through the shared NCBI helper with redirects refused,
// and that weakened copies of the audit would let those drifts through. The fetched bytes and
// the weakened copies live only in temporary directories deleted at the end.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { after, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const saveDir = mkdtempSync(join(tmpdir(), "aspects-region-audit-"));
const mutantDir = mkdtempSync(join(tmpdir(), "aspects-region-audit-mutants-"));
after(() => {
  rmSync(saveDir, { recursive: true, force: true });
  rmSync(mutantDir, { recursive: true, force: true });
});

const run = spawnSync(
  process.execPath,
  [
    "--import",
    "./scripts/register-jsx-loader.mjs",
    "scripts/audit-aspects-region-source.mjs",
    "--json",
    "--save-sources",
    saveDir,
  ],
  { cwd: repoRoot, encoding: "utf8" },
);
if (run.status !== 0) {
  rmSync(saveDir, { recursive: true, force: true });
  rmSync(mutantDir, { recursive: true, force: true });
  assert.fail(`ASPECTS region source audit failed\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`);
}
const report = JSON.parse(run.stdout);

// The audit module imports the calculator JSX, so register the repository's JSX loader first.
await import("./register-jsx-loader.mjs");
const audit = await import("./audit-aspects-region-source.mjs");
const { ASPECTSScore } = await import("../src/components/calculators/ASPECTSScore.jsx");
const auditSource = readFileSync(new URL("./audit-aspects-region-source.mjs", import.meta.url), "utf8");

function savedArtifacts() {
  return Object.fromEntries(
    Object.keys(audit.SOURCES).map((key) => {
      const meta = JSON.parse(readFileSync(join(saveDir, `${key}.json`), "utf8"));
      return [key, { ...meta, bytes: readFileSync(join(saveDir, `${key}.bin`)) }];
    }),
  );
}

function withText(artifacts, key, edit) {
  const text = artifacts[key].bytes.toString("utf8");
  const edited = edit(text);
  assert.notEqual(edited, text, `${key}: mutation did not change the artifact`);
  return { ...artifacts, [key]: { ...artifacts[key], bytes: Buffer.from(edited, "utf8") } };
}

function calculatorWith(overrides) {
  return { ...ASPECTSScore, ...overrides };
}

function fakeResponse({ status = 200, url, contentType, bytes = Buffer.alloc(0), retryAfter }) {
  const headers = new Headers();
  if (contentType) headers.set("content-type", contentType);
  if (retryAfter) headers.set("retry-after", retryAfter);
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    headers,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    body: { cancel: async () => {} },
  };
}

// A fetch that serves one saved artifact, optionally drifted on the first `driftCalls` calls,
// and counts its calls.
function serving(saved, drift = {}, driftCalls = Infinity) {
  let calls = 0;
  return {
    fetchImpl: async () => {
      calls += 1;
      const d = calls <= driftCalls ? drift : {};
      return fakeResponse({
        url: d.finalUrl ?? saved.finalUrl,
        contentType: d.contentType ?? saved.contentType,
        bytes: d.bytes ?? saved.bytes,
      });
    },
    calls: () => calls,
  };
}

const noRetry = async () => {
  assert.fail("a 200 response that misses a pin must not be retried");
};
const noSleep = async () => {};

function sameLengthDrift(bytes) {
  const drifted = Buffer.from(bytes);
  const index = Math.floor(drifted.length / 2);
  drifted[index] = drifted[index] === 0x20 ? 0x21 : 0x20;
  return drifted;
}

const SOURCE_KEYS = ["barber2000", "dubey2013"];

test("report pins both NCBI artifacts by raw bytes, final URL and media type", () => {
  assert.equal(report.schema, "radulator-aspects-region-source-audit/v2");
  assert.equal(report.calculator_id, "aspects-score");
  assert.equal(report.calculator_path, "src/components/calculators/ASPECTSScore.jsx");
  assert.deepEqual(report.network, { hosts: ["eutils.ncbi.nlm.nih.gov"], requests_per_run: 2 });
  assert.deepEqual(
    report.sources.map(({ key, final_url, media_type, pin, bytes, sha256 }) => [
      key,
      final_url,
      media_type,
      pin,
      bytes,
      sha256,
    ]),
    [
      [
        "barber2000",
        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=10905241&rettype=abstract&retmode=text&tool=radulator-aspects-audit",
        "text/plain",
        "raw-bytes",
        2463,
        "fee68808adc8d45b02413464c7dc282361e72458bb2a9d340a69becad7a3960d",
      ],
      [
        "dubey2013",
        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&retmode=xml&tool=radulator-aspects-audit&id=3732599",
        "text/xml",
        "raw-bytes",
        65170,
        "7a0479726ba0956a36ce9e63050bf0e052fe69ac292428a67a9254b26d54a2ba",
      ],
    ],
  );
  for (const source of report.sources) {
    const url = new URL(source.url);
    assert.equal(source.final_url, source.url, `${source.key}: final URL must be the pinned URL`);
    assert.equal(url.hostname, "eutils.ncbi.nlm.nih.gov", `${source.key}: NCBI only`);
    assert.equal(url.searchParams.get("tool"), "radulator-aspects-audit", `${source.key}: NCBI tool`);
    assert.equal(url.searchParams.get("email"), null, `${source.key}: no e-mail parameter`);
  }
  const sources = Object.fromEntries(report.sources.map((source) => [source.key, source]));
  assert.deepEqual([sources.barber2000.pmid, sources.barber2000.doi], ["10905241", "10.1016/S0140-6736(00)02237-6"]);
  assert.deepEqual(
    [sources.dubey2013.pmcid, sources.dubey2013.pmid, sources.dubey2013.doi, sources.dubey2013.license],
    ["PMC3732599", "23970999", "10.1155/2013/767212", "https://creativecommons.org/licenses/by/3.0/"],
  );
  assert.deepEqual(report.informational.barber2000_errata_listed_by_pubmed, ["Lancet 2000 Jun 17;355(9221):2170."]);
  assert.equal(report.source_bytes_committed, false);
});

test("the audit contacts NCBI only", async () => {
  assert.deepEqual([...audit.ALLOWED_HOSTS], ["eutils.ncbi.nlm.nih.gov"]);
  for (const source of Object.values(audit.SOURCES)) {
    assert.ok(audit.ALLOWED_HOSTS.includes(new URL(source.url).hostname), `${source.key}: host`);
  }
  assert.ok(!auditSource.includes("web.archive.org"), "the audit must not reference the Internet Archive host");
  let calls = 0;
  await assert.rejects(
    audit.retrieve(
      { ...audit.SOURCES.dubey2013, key: "offsite", url: "https://example.org/capture" },
      {
        fetchImpl: async () => {
          calls += 1;
        },
        sleep: noRetry,
      },
    ),
    /offsite: example\.org is not an allowed audit host/,
  );
  assert.equal(calls, 0, "a disallowed host is refused before any request");
});

test("report pins every statement span by digest and binds every fetched statement", () => {
  assert.deepEqual(
    report.source_statements.map(({ id, source, spans }) => [id, source, spans.map(({ sha256 }) => sha256)]),
    [
      ["barber2000-abstract-ten-regions", "barber2000", ["b0108d25834178967bc1c3e82c1ec497ce6163ce41198d188bc142245d7905c1"]],
      [
        "dubey2013-fig1-provenance",
        "dubey2013",
        [
          "655e31450499f5368e14932b101ad828556e8e32cb4ae7ae435f1393419d6e5b",
          "d65b587338b7d73a2d0ec3853e19fe48c67b37dc9eda15464201c80d86f3f35c",
        ],
      ],
      ["dubey2013-fig1-region-definitions", "dubey2013", ["4ec9c3c6f82b61d04280908ac4703108df66ee85d369331b849fefb0f4bca908"]],
      [
        "dubey2013-fig1-subcortical-three-points",
        "dubey2013",
        ["403235c61ec228d999245dde0fe79472671b4ccf4cb64fd2da7db5cd78106e76"],
      ],
      ["dubey2013-fig1-cortex-seven-points", "dubey2013", ["cde321c5e5ced68389d9ce3a4c69128cfe328897eeeeda0272fb7f6d5425b469"]],
    ],
  );
  for (const statement of report.source_statements) {
    assert.ok(statement.paraphrase.length > 20, `${statement.id}: paraphrase`);
    assert.ok(statement.locator, `${statement.id}: locator`);
  }
  assert.deepEqual(
    report.claim_bindings.map(({ claim_id, source_statement_ids }) => [claim_id, source_statement_ids]),
    [
      ["breakdown-subcortical-is-c-l-ic", ["dubey2013-fig1-subcortical-three-points"]],
      [
        "breakdown-insula-is-ganglionic-cortex",
        ["dubey2013-fig1-cortex-seven-points", "dubey2013-fig1-region-definitions"],
      ],
      [
        "score-is-ten-minus-regions",
        [
          "barber2000-abstract-ten-regions",
          "dubey2013-fig1-subcortical-three-points",
          "dubey2013-fig1-cortex-seven-points",
        ],
      ],
      ["region-labels-name-template-regions", ["dubey2013-fig1-region-definitions"]],
      ["two-levels-in-info-text", ["dubey2013-fig1-region-definitions"]],
      ["m2-lateral-to-insular-ribbon", ["dubey2013-fig1-region-definitions"]],
      ["m3-posterior-mca-cortex", ["dubey2013-fig1-region-definitions"]],
      ["m4-m6-immediately-superior", ["dubey2013-fig1-region-definitions"]],
      ["insular-ribbon-is-insular-cortex", ["dubey2013-fig1-region-definitions", "dubey2013-fig1-cortex-seven-points"]],
    ],
  );
  const bound = new Set(report.claim_bindings.flatMap(({ source_statement_ids }) => source_statement_ids));
  for (const { id } of report.source_statements) {
    if (!id.endsWith("-provenance")) assert.ok(bound.has(id), `${id}: not bound to a runtime claim`);
  }
  const byClaim = Object.fromEntries(report.claim_bindings.map((binding) => [binding.claim_id, binding.runtime]));
  assert.deepEqual(byClaim["breakdown-subcortical-is-c-l-ic"].subcortical, ["caudate", "lentiform", "internal_capsule"]);
  assert.deepEqual(byClaim["breakdown-insula-is-ganglionic-cortex"].ganglionic_cortical, ["insular", "m1", "m2", "m3"]);
  assert.equal(byClaim["breakdown-insula-is-ganglionic-cortex"].cortical_points, 7);
  assert.equal(byClaim["score-is-ten-minus-regions"].region_combinations_checked, 1024);
  assert.deepEqual(byClaim["m3-posterior-mca-cortex"].sublabels, { m3: "Posterior MCA cortex" });
  assert.deepEqual(byClaim["m3-posterior-mca-cortex"].info_lines, ["• M3 - Posterior MCA cortex"]);
  assert.deepEqual(byClaim["m2-lateral-to-insular-ribbon"].sublabels, {
    m2: "Anterior temporal lobe, lateral to insular ribbon",
  });
  assert.equal(Object.keys(byClaim["region-labels-name-template-regions"].labels).length, 10);
  assert.equal(report.runtime.region_combinations_checked, 1024);
  assert.equal(report.scope.score_arithmetic_changed, false);
  // The two pattern notes the primary judge on #305 found unsourced are removed, and their
  // absence is checked over every region combination.
  assert.deepEqual(report.removed_notes.notes, [...audit.REMOVED_PATTERN_NOTES]);
  assert.equal(report.removed_notes.publication_derived, false);
  assert.equal(report.removed_notes.region_combinations_checked, 1024);
});

test("documented-only claims are listed with their sources and pinned runtime text", () => {
  assert.deepEqual(
    report.documented_only.map(({ claim_id, supplements }) => [claim_id, supplements ?? null]),
    [
      ["internal-capsule-posterior-limb", null],
      ["m1-frontal-operculum", null],
      ["m2-front-edge-anterior-temporal-lobe", null],
      ["insular-ribbon-sign", null],
      ["caudate-head", null],
      ["one-point-subtracted-per-region", "score-is-ten-minus-regions"],
      ["level-assignment-at-caudate-head", "breakdown-insula-is-ganglionic-cortex"],
      ["m-areas-geometric-and-sylvian-divisions", "m3-posterior-mca-cortex"],
    ],
  );
  const byClaim = Object.fromEntries(report.documented_only.map((claim) => [claim.claim_id, claim]));
  assert.deepEqual(byClaim["internal-capsule-posterior-limb"].runtime, {
    sublabels: { internal_capsule: "Posterior limb of internal capsule" },
    info_lines: ["• IC - Internal capsule (posterior limb)"],
  });
  assert.deepEqual(byClaim["m1-frontal-operculum"].runtime, {
    sublabels: { m1: "Frontal operculum" },
    info_lines: ["• M1 - Frontal operculum (anterior MCA cortex)"],
  });
  assert.deepEqual(byClaim["caudate-head"].runtime, {
    labels: { caudate: "C - Caudate Head" },
    info_lines: ["• C - Caudate head"],
  });
  for (const claim of report.documented_only) {
    assert.equal(claim.evidence, "docs/evidence/aspects-regions.md", claim.claim_id);
    assert.ok(claim.sources.length > 0, claim.claim_id);
    for (const source of claim.sources) {
      assert.match(source, /^(pexman2001|developers_site): /, `${claim.claim_id}: documented source key`);
    }
    assert.ok(Object.keys(claim.runtime).length > 0, `${claim.claim_id}: runtime text pinned`);
  }
  assert.deepEqual(Object.keys(report.documented_sources), ["pexman2001", "developers_site"]);
  for (const value of Object.values(report.documented_sources)) {
    assert.ok(value.document && value.read_at && value.not_fetched_because);
  }
  // The evidence document carries every documented claim.
  const evidence = readFileSync(join(repoRoot, "docs/evidence/aspects-regions.md"), "utf8");
  for (const claim of report.documented_only) {
    assert.ok(evidence.includes(`\`${claim.claim_id}\``), `${claim.claim_id}: missing from the evidence document`);
  }
});

test("markers stay within the six-word limit and paraphrases do not copy their spans", () => {
  const words = (value) => value.trim().split(/\s+/).length;
  for (const statement of audit.STATEMENTS) {
    for (const span of statement.spans) {
      assert.ok(words(span.from) <= 6, `${statement.id}: from marker has more than six words`);
      assert.ok(words(span.to) <= 6, `${statement.id}: to marker has more than six words`);
      // The two markers must not reconstruct the span, even joined by a space.
      assert.ok(span.length > span.from.length + span.to.length + 1, `${statement.id}: markers cover the whole span`);
      assert.ok(!statement.paraphrase.includes(`${span.from} `), `${statement.id}: paraphrase repeats a marker`);
    }
  }
});

test("retrieve() accepts each unmodified saved artifact on the first attempt", async () => {
  const artifacts = savedArtifacts();
  for (const key of SOURCE_KEYS) {
    const fetch = serving(artifacts[key]);
    const retrieved = await audit.retrieve(audit.SOURCES[key], { fetchImpl: fetch.fetchImpl, sleep: noRetry });
    assert.equal(retrieved.attempts, 1, key);
    assert.equal(fetch.calls(), 1, key);
  }
});

test("failure mode 1: same-length digest drift fails at once, without a retry", async () => {
  const artifacts = savedArtifacts();
  for (const key of SOURCE_KEYS) {
    const bytes = sameLengthDrift(artifacts[key].bytes);
    assert.equal(bytes.length, audit.SOURCES[key].bytes, `${key}: the mutation keeps the length`);
    const fetch = serving(artifacts[key], { bytes });
    await assert.rejects(
      audit.retrieve(audit.SOURCES[key], { fetchImpl: fetch.fetchImpl, sleep: noRetry }),
      new RegExp(`${key}: artifact SHA-256 drifted`),
    );
    assert.equal(fetch.calls(), 1, `${key}: fetched exactly once`);
  }
});

test("failure mode 2: byte-length drift fails at once, without a retry", async () => {
  const artifacts = savedArtifacts();
  for (const key of SOURCE_KEYS) {
    for (const bytes of [
      Buffer.concat([artifacts[key].bytes, Buffer.from("\n")]),
      artifacts[key].bytes.subarray(0, audit.SOURCES[key].bytes - 1),
    ]) {
      const fetch = serving(artifacts[key], { bytes });
      await assert.rejects(
        audit.retrieve(audit.SOURCES[key], { fetchImpl: fetch.fetchImpl, sleep: noRetry }),
        new RegExp(`${key}: artifact byte length drifted`),
      );
      assert.equal(fetch.calls(), 1, `${key}: fetched exactly once`);
    }
  }
});

test("failure mode 3: a drifted HTTP 200 fails at once, without a retry", async () => {
  const artifacts = savedArtifacts();
  for (const key of SOURCE_KEYS) {
    const source = audit.SOURCES[key];
    const changedQuery = new URL(source.url);
    changedQuery.search = "?changed=1";
    const changedPath = new URL(source.url);
    changedPath.pathname = "/entrez/eutils/esummary.fcgi";
    const drifts = [
      // A different document served with status 200 and the pinned media type, such as an
      // E-utilities error page or a front-matter-only record.
      [{ bytes: Buffer.from("<eFetchResult><ERROR>Temporarily unavailable</ERROR></eFetchResult>") }, /artifact byte length drifted/],
      [{ contentType: "text/html; charset=UTF-8" }, /media type drifted/],
      [{ finalUrl: "https://www.ncbi.nlm.nih.gov/error" }, /final URL host drifted/],
      [{ finalUrl: changedPath.href }, /final URL path drifted/],
      [{ finalUrl: changedQuery.href }, /final URL query drifted/],
      [{ finalUrl: source.url.replace("https:", "http:") }, /final URL left HTTPS/],
    ];
    for (const [drift, message] of drifts) {
      const fetch = serving(artifacts[key], drift);
      await assert.rejects(
        audit.retrieve(source, { fetchImpl: fetch.fetchImpl, sleep: noRetry }),
        message,
        `${key}: ${JSON.stringify(Object.keys(drift))}`,
      );
      assert.equal(fetch.calls(), 1, `${key}: fetched exactly once`);
    }
  }
});

test("offline verification checks every pin before parsing", () => {
  const artifacts = savedArtifacts();
  assert.doesNotThrow(() => audit.buildAudit(artifacts));
  // Same-length edits inside a statement fail on the SHA-256 pin, not later in a parser.
  const dubey = withText(artifacts, "dubey2013", (xml) => xml.replace("allotted 3 points", "allotted 4 points"));
  assert.throws(() => audit.buildAudit(dubey), /dubey2013: artifact SHA-256 drifted/);
  const barber = withText(artifacts, "barber2000", (text) => text.replace("ten regions", "nine region"));
  assert.throws(() => audit.buildAudit(barber), /barber2000: artifact SHA-256 drifted/);
  const insula = withText(artifacts, "dubey2013", (xml) => xml.replace("(insular cortex, M1", "(M1"));
  assert.throws(() => audit.buildAudit(insula), /dubey2013: artifact byte length drifted/);
  // A truncated record fails on its byte length before the parser could miss a section.
  const truncated = {
    ...artifacts,
    barber2000: { ...artifacts.barber2000, bytes: artifacts.barber2000.bytes.subarray(0, 1000) },
  };
  assert.throws(() => audit.buildAudit(truncated), /barber2000: artifact byte length drifted/);
  const redirected = {
    ...artifacts,
    dubey2013: { ...artifacts.dubey2013, finalUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3732599/" },
  };
  assert.throws(() => audit.buildAudit(redirected), /dubey2013: final URL host drifted/);
});

test("statement spans catch an edit inside a span even under re-pinned bytes", () => {
  const artifacts = savedArtifacts();
  const caption = audit.dubeyFigure1Caption(artifacts.dubey2013.bytes.toString("utf8"));
  const cortex = audit.STATEMENTS.find(({ id }) => id === "dubey2013-fig1-cortex-seven-points");
  const mismatches = [];
  audit.checkSpans(cortex, caption.replace("insular cortex, M1", "M1"), mismatches);
  assert.equal(mismatches.length, 1);
  const regions = audit.STATEMENTS.find(({ id }) => id === "dubey2013-fig1-region-definitions");
  const moved = [];
  audit.checkSpans(regions, caption.replace("M3, posteriorMCA cortex", "M3, posterior temporal lobe"), moved);
  assert.equal(moved.length, 1);
  assert.throws(
    () => audit.checkSpans(cortex, caption.replace("MCA cortex is allotted 7 points", "MCA cortex scores"), []),
    /span start marker/,
  );
  const barber = audit.pubmedAbstractText(artifacts.barber2000.bytes.toString("utf8"));
  assert.deepEqual([...barber.sections.keys()], [
    "abstract:BACKGROUND",
    "abstract:METHODS",
    "abstract:FINDINGS",
    "abstract:INTERPRETATION",
  ]);
});

test("runtime mutations fail the binding", () => {
  // Old insula-as-subcortical breakdown.
  const oldBreakdown = calculatorWith({
    compute: (values) => {
      const result = ASPECTSScore.compute(values);
      const count = (ids) => ids.filter((id) => values[id]).length;
      result["Regional Breakdown"] = `Subcortical: ${count(["caudate", "lentiform", "internal_capsule", "insular"])}/4 | Ganglionic cortical (M1-M3): ${count(["m1", "m2", "m3"])}/3 | Supraganglionic (M4-M6): ${count(["m4", "m5", "m6"])}/3`;
      return result;
    },
  });
  assert.throws(() => audit.verifyRuntime(oldBreakdown), /Regional Breakdown grouping/);

  // The removed pattern notes (primary judge on #305) must not come back, under any trigger:
  // develop's insula-as-subcortical trigger, the earlier PR trigger, or the collateral note.
  const withNote = (note, fires) =>
    calculatorWith({
      compute: (values) => {
        const result = ASPECTSScore.compute(values);
        if (fires(values)) {
          const notes = (result["Clinical Notes"] ?? "").split("; ").filter(Boolean);
          result["Clinical Notes"] = [...notes, note].join("; ");
        }
        return result;
      },
    });
  const count = (values, ids) => ids.filter((id) => values[id]).length;
  const developSubcortical = (values) =>
    count(values, ["caudate", "lentiform", "internal_capsule", "insular"]) >= 3 &&
    count(values, ["m1", "m2", "m3", "m4", "m5", "m6"]) === 0;
  const correctedSubcortical = (values) =>
    count(values, ["caudate", "lentiform", "internal_capsule"]) === 3 &&
    count(values, ["insular", "m1", "m2", "m3", "m4", "m5", "m6"]) === 0;
  const allM = (values) => count(values, ["m1", "m2", "m3", "m4", "m5", "m6"]) === 6;
  const [subcorticalNote, developCollateral, prCollateral] = audit.REMOVED_PATTERN_NOTES;
  for (const [note, fires] of [
    [subcorticalNote, developSubcortical],
    [subcorticalNote, correctedSubcortical],
    [developCollateral, allM],
    [prCollateral, allM],
  ]) {
    assert.throws(() => audit.verifyRuntime(withNote(note, fires)), /removed pattern note is shown again/);
  }
  // A reworded version of either claim is caught too.
  assert.throws(
    () => audit.verifyRuntime(withNote("All six M regions involved: very poor collateral circulation", allM)),
    /a removed pattern note's claim is shown again/,
  );
  assert.throws(
    () => audit.verifyRuntime(withNote("Predominantly subcortical pattern", correctedSubcortical)),
    /a removed pattern note's claim is shown again/,
  );

  const withField = (id, change) =>
    calculatorWith({ fields: ASPECTSScore.fields.map((field) => (field.id === id ? { ...field, ...change } : field)) });
  assert.throws(() => audit.verifyRuntime(withField("m3", { subLabel: "Posterior temporal lobe" })), /subLabels drifted/);
  assert.throws(
    () => audit.verifyRuntime(withField("internal_capsule", { subLabel: "Internal capsule at the ganglionic level" })),
    /subLabels drifted/,
  );
  assert.throws(() => audit.verifyRuntime(withField("m1", { label: "M1 - Frontal Operculum" })), /labels drifted/);
  // The previous M1 and M3 wording repeated the label's level.
  assert.throws(
    () => audit.verifyRuntime(withField("m1", { subLabel: "Frontal operculum at ganglionic level" })),
    /m1: subLabel repeats the label's level \(Ganglionic\)/,
  );
  assert.throws(
    () => audit.verifyRuntime(withField("m3", { subLabel: "Posterior MCA cortex at ganglionic level" })),
    /m3: subLabel repeats the label's level \(Ganglionic\)/,
  );
  assert.throws(
    () => audit.verifyRuntime(withField("m1", { subLabel: "Frontal operculum (-1 point)" })),
    /m1: subLabel would render nested parentheses/,
  );
  assert.throws(
    () =>
      audit.verifyRuntime(
        calculatorWith({
          info: {
            ...ASPECTSScore.info,
            text: ASPECTSScore.info.text.replace(
              "M3 - Posterior MCA cortex\n",
              "M3 - Posterior temporal lobe (posterior MCA cortex)\n",
            ),
          },
        }),
      ),
    /ganglionic-level region list drifted/,
  );
  // The unsourced "behind M2" gloss (primary judge on #305) fails in the info text, the subLabel
  // and the calculator source.
  assert.throws(
    () =>
      audit.verifyRuntime(
        calculatorWith({
          info: {
            ...ASPECTSScore.info,
            text: ASPECTSScore.info.text.replace("M3 - Posterior MCA cortex\n", "M3 - Posterior MCA cortex (behind M2)\n"),
          },
        }),
      ),
    /ganglionic-level region list drifted/,
  );
  assert.throws(() => audit.verifyRuntime(withField("m3", { subLabel: "MCA cortex behind M2" })), /subLabels drifted/);
  assert.throws(
    () => audit.verifyRuntime(ASPECTSScore, 'subLabel: "MCA cortex behind M2"'),
    /calculator source still contains "behind M2"/,
  );
  assert.throws(
    () => audit.verifyRuntime(ASPECTSScore, 'subLabel: "Posterior limb of internal capsule (-1 point)"'),
    /calculator source still contains "\(-1 point\)"/,
  );
  assert.throws(
    () => audit.verifyRuntime(ASPECTSScore, 'subLabel: "Frontal operculum at ganglionic level"'),
    /calculator source still contains "at ganglionic level"/,
  );
});

test("the rendering guardrail rejects nested parentheses and a repeated level", () => {
  const check = (label, subLabel) => () => audit.assertSubLabelRendering({ id: "x", label, subLabel });
  assert.doesNotThrow(check("M1 - Anterior MCA Cortex (Ganglionic Level)", "Frontal operculum"));
  assert.doesNotThrow(check("M2 - Lateral MCA Cortex (Ganglionic Level)", "Anterior temporal lobe, lateral to insular ribbon"));
  assert.doesNotThrow(check("M4 - Anterior MCA Territory (Supraganglionic)", "Immediately superior to M1"));
  assert.doesNotThrow(check("IC - Internal Capsule", "Posterior limb of internal capsule"));
  assert.throws(check("M1 - Anterior MCA Cortex (Ganglionic Level)", "Cortex at ganglionic level"), /level \(Ganglionic\)/);
  assert.throws(check("M1 - Anterior MCA Cortex (Ganglionic Level)", "Upper level only"), /level \(Level\)/);
  assert.throws(check("M4 - Anterior MCA Territory (Supraganglionic)", "Supraganglionic cortex"), /level \(Supraganglionic\)/);
  assert.throws(check("C - Caudate Head", "Caudate (head)"), /nested parentheses/);
});

// Each weakened copy of the audit removes one protection. The real audit rejects the input;
// the weakened copy lets it through, or fails on a different check than the failure-mode test
// expects. Either way the tests above would go red, so they guard the protection.
test("weakened copies of the audit are caught by the failure-mode checks", async () => {
  const calculatorImport = '"../src/components/calculators/ASPECTSScore.jsx"';
  const calculatorUrl = JSON.stringify(new URL("../src/components/calculators/ASPECTSScore.jsx", import.meta.url).href);
  assert.equal(auditSource.split(calculatorImport).length, 2, "calculator import anchor must occur once");
  const helperImport = '"./lib/ncbi-fetch.mjs"';
  const helperUrl = JSON.stringify(new URL("./lib/ncbi-fetch.mjs", import.meta.url).href);
  assert.equal(auditSource.split(helperImport).length, 2, "NCBI helper import anchor must occur once");

  async function weakened(id, from, to) {
    assert.equal(auditSource.split(from).length, 2, `${id}: mutation anchor must occur exactly once`);
    const file = join(mutantDir, `${id}.mjs`);
    writeFileSync(
      file,
      auditSource
        .replace(from, () => to)
        .replace(calculatorImport, () => calculatorUrl)
        .replace(helperImport, () => helperUrl),
    );
    return import(pathToFileURL(file).href);
  }

  // A pin miss treated as a challenge page is retried by the shared helper.
  const retrying = await weakened(
    "retry-on-pin-miss",
    "    minBytes: 0,\n",
    "    minBytes: 0,\n    isChallenge: (bytes) => sha256(bytes) !== source.sha256,\n",
  );
  const following = await weakened("follow-redirects", '    redirect: "error",\n', '    redirect: "follow",\n');
  const concurrent = await weakened(
    "concurrent-retrieval",
    "  for (const source of Object.values(SOURCES)) retrieved[source.key] = await retrieve(source, options);\n",
    "  await Promise.all(\n    Object.values(SOURCES).map(async (source) => {\n      retrieved[source.key] = await retrieve(source, options);\n    }),\n  );\n",
  );
  const noDigest = await weakened(
    "no-sha256-check",
    "    sha256(bytes),\n    source.sha256,",
    "    source.sha256,\n    source.sha256,",
  );
  const noLength = await weakened(
    "no-length-check",
    "    bytes.length,\n    source.bytes,",
    "    source.bytes,\n    source.bytes,",
  );
  const noMediaType = await weakened(
    "no-media-type-check",
    "  assert.equal(mediaType, source.media_type, `${source.key}: media type drifted`);",
    "  void mediaType;",
  );

  const artifacts = savedArtifacts();
  for (const key of SOURCE_KEYS) {
    const source = audit.SOURCES[key];
    const saved = artifacts[key];

    // 1. Retrying a 200 that misses a pin: the drifted first answer is retried away.
    const flaky = serving(saved, { bytes: sameLengthDrift(saved.bytes) }, 1);
    const accepted = await retrying.retrieve(source, { fetchImpl: flaky.fetchImpl, sleep: noSleep });
    assert.equal(accepted.attempts, 2, `${key}: the weakened audit retried a drifted 200`);
    const strict = serving(saved, { bytes: sameLengthDrift(saved.bytes) }, 1);
    await assert.rejects(audit.retrieve(source, { fetchImpl: strict.fetchImpl, sleep: noRetry }), /SHA-256 drifted/);
    assert.equal(strict.calls(), 1, `${key}: the real audit does not retry`);

    // 2. No SHA-256 check: a same-length drift gets past the audit's own pins and is caught only
    // by the shared helper's second raw-pin check, under the helper's message, so failure mode 1
    // (which requires the audit's message) goes red.
    const drifted = serving(saved, { bytes: sameLengthDrift(saved.bytes) });
    await assert.rejects(
      noDigest.retrieve(source, { fetchImpl: drifted.fetchImpl, sleep: noRetry }),
      (error) => /SHA-256 drifted/.test(error.message) && !new RegExp(`${key}: artifact SHA-256 drifted`).test(error.message),
    );

    // 3. No byte-length check: a length drift is caught only by the digest, under the wrong
    // message, so failure mode 2 goes red.
    const longer = serving(saved, { bytes: Buffer.concat([saved.bytes, Buffer.from("\n")]) });
    await assert.rejects(
      noLength.retrieve(source, { fetchImpl: longer.fetchImpl, sleep: noRetry }),
      (error) => !/byte length drifted/.test(error.message),
    );

    // 4. No media-type check: a drifted content type is accepted.
    const html = serving(saved, { contentType: "text/html; charset=UTF-8" });
    await noMediaType.retrieve(source, { fetchImpl: html.fetchImpl, sleep: noRetry });

    // 5. Following redirects: the request would follow a redirect to another host.
    const modes = [];
    await following.retrieve(source, {
      fetchImpl: async (url, init) => {
        modes.push(init.redirect);
        return fakeResponse({ url: saved.finalUrl, contentType: saved.contentType, bytes: saved.bytes });
      },
      sleep: noRetry,
    });
    assert.deepEqual(modes, ["follow"], `${key}: the weakened audit would follow a redirect`);
  }

  // 6. Concurrent retrieval: both requests are in flight together.
  const counted = inFlightFetch(artifacts);
  await concurrent.retrieveAll({ fetchImpl: counted.fetchImpl, sleep: noRetry });
  assert.equal(counted.maxInFlight(), 2, "the weakened audit sends both requests at once");
});

// A fetch that serves the saved artifacts by URL and records how many requests overlap.
function inFlightFetch(artifacts) {
  let inFlight = 0;
  let maxInFlight = 0;
  const requested = [];
  return {
    fetchImpl: async (url, init) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      requested.push([url, init.redirect]);
      await new Promise((resolve) => setImmediate(resolve));
      inFlight -= 1;
      const key = SOURCE_KEYS.find((candidate) => audit.SOURCES[candidate].url === url);
      assert.ok(key, `unexpected request ${url}`);
      const saved = artifacts[key];
      return fakeResponse({ url: saved.finalUrl, contentType: saved.contentType, bytes: saved.bytes });
    },
    maxInFlight: () => maxInFlight,
    requested: () => requested,
  };
}

test("requests go one at a time through the shared NCBI gate and fetch log (Codex review on #305)", async () => {
  const artifacts = savedArtifacts();
  const logDir = mkdtempSync(join(tmpdir(), "aspects-region-fetch-log-"));
  try {
    const log = join(logDir, "fetch.jsonl");
    const counted = inFlightFetch(artifacts);
    const booked = [];
    const gate = {
      reserve: async (host, keyed) => {
        booked.push([host, keyed]);
        return 0;
      },
    };
    const retrieved = await audit.retrieveAll({
      fetchImpl: counted.fetchImpl,
      sleep: noRetry,
      gate,
      env: { RADULATOR_SOURCE_FETCH_LOG: log },
    });
    assert.deepEqual(Object.keys(retrieved), SOURCE_KEYS);
    assert.equal(counted.maxInFlight(), 1, "one request at a time");
    assert.deepEqual(
      booked,
      SOURCE_KEYS.map(() => ["eutils.ncbi.nlm.nih.gov", false]),
      "every request books a slot in the shared request spacing",
    );
    assert.deepEqual(
      counted.requested(),
      SOURCE_KEYS.map((key) => [audit.SOURCES[key].url, "error"]),
      "only the pinned URLs are requested, with redirects refused",
    );
    const lines = readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    assert.deepEqual(
      lines.map(({ label, host, status, outcome, provenance }) => [label, host, status, outcome, provenance]),
      SOURCE_KEYS.map((key) => [key, "eutils.ncbi.nlm.nih.gov", 200, "ok", "live"]),
      "each request is in the runner's fetch log",
    );
  } finally {
    rmSync(logDir, { recursive: true, force: true });
  }
});

test("a redirect is never followed, so no other host is contacted (Codex review on #305)", async () => {
  const source = audit.SOURCES.dubey2013;
  const saved = savedArtifacts().dubey2013;
  // With redirect "error", fetch rejects a 3xx instead of following it: a transport failure,
  // retried and then reported, with no request to the redirect target.
  const requested = [];
  await assert.rejects(
    audit.retrieve(source, {
      fetchImpl: async (url, init) => {
        requested.push([url, init.redirect]);
        throw new TypeError("fetch failed (unexpected redirect)");
      },
      sleep: noSleep,
    }),
    /dubey2013 retrieval failed after 5 of 5 attempts \(fetch failed \(unexpected redirect\)\)/,
  );
  assert.deepEqual(requested, Array.from({ length: audit.FETCH_ATTEMPTS }, () => [source.url, "error"]));
  // A response that reports a redirect is never accepted either.
  let calls = 0;
  await assert.rejects(
    audit.retrieve(source, {
      fetchImpl: async () => {
        calls += 1;
        return {
          ...fakeResponse({ url: saved.finalUrl, contentType: saved.contentType, bytes: saved.bytes }),
          redirected: true,
        };
      },
      sleep: noSleep,
    }),
    /dubey2013: redirected response/,
  );
  assert.equal(calls, audit.FETCH_ATTEMPTS);
});

test("retrieval retries transport failures only", async () => {
  const source = audit.SOURCES.dubey2013;
  const saved = savedArtifacts().dubey2013;
  const sleeps = [];
  const sleep = async (ms) => {
    sleeps.push(ms);
  };

  let calls = 0;
  const flaky = async (url) => {
    calls += 1;
    if (calls === 1) throw new TypeError("fetch failed");
    if (calls === 2) return fakeResponse({ status: 503, url, retryAfter: "2" });
    if (calls === 3) return fakeResponse({ status: 429, url });
    if (calls === 4) return fakeResponse({ status: 500, url });
    return fakeResponse({ url: saved.finalUrl, contentType: saved.contentType, bytes: saved.bytes });
  };
  const retrieved = await audit.retrieve(source, { fetchImpl: flaky, sleep });
  assert.equal(retrieved.attempts, 5);
  assert.deepEqual(sleeps, [1000, 2000, 4000, 8000]);

  for (const status of [404, 403, 410]) {
    calls = 0;
    await assert.rejects(
      audit.retrieve(source, {
        fetchImpl: async (url) => {
          calls += 1;
          return fakeResponse({ status, url });
        },
        sleep,
      }),
      new RegExp(`dubey2013 retrieval failed after 1 of 5 attempts \\(HTTP ${status}\\)`),
    );
    assert.equal(calls, 1, `HTTP ${status} is not retried`);
  }

  calls = 0;
  sleeps.length = 0;
  await assert.rejects(
    audit.retrieve(source, {
      fetchImpl: async () => {
        calls += 1;
        throw new TypeError("fetch failed");
      },
      sleep,
    }),
    /dubey2013 retrieval failed after 5 of 5 attempts \(fetch failed\)/,
  );
  assert.equal(calls, audit.FETCH_ATTEMPTS);
  assert.deepEqual(sleeps, [1000, 2000, 4000, 8000]);

  // Retry-After can lengthen a wait, never shorten it, and never past 30 s (Codex review on
  // #305): a 1 s Retry-After on attempt 4 still waits the scheduled 8 s.
  calls = 0;
  sleeps.length = 0;
  const throttled = async (url) => {
    calls += 1;
    if (calls === 1) return fakeResponse({ status: 429, url, retryAfter: "120" });
    if (calls < 5) return fakeResponse({ status: 429, url, retryAfter: "1" });
    return fakeResponse({ url: saved.finalUrl, contentType: saved.contentType, bytes: saved.bytes });
  };
  assert.equal((await audit.retrieve(source, { fetchImpl: throttled, sleep })).attempts, 5);
  assert.deepEqual(sleeps, [30_000, 2000, 4000, 8000]);
});
