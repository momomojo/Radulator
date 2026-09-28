#!/usr/bin/env node

// Tests for scripts/audit-aast-injury-modifier-source.mjs.
// - Runs the exact-head audit live and checks its byte-pinned artifacts, statements and bindings.
// - Artifact mutation checks: same-length digest drift, byte-length drift, and a drifted HTTP 200
//   that fails at once (never retried, never replaced by another host).
// - Retrieval checks: transport failures and Cloudflare challenges are retried with 1/2/4/8 s
//   backoff (or Retry-After), then the next host with the same pinned bytes, then a loud failure.
// - Runtime mutation checks: each regression must be rejected by the audit's runtime verifier.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import process from "node:process";
import test from "node:test";

await import("./register-jsx-loader.mjs");
const { AASTTraumaGrading } = await import("../src/components/calculators/AASTTraumaGrading.jsx");
const audit = await import("./audit-aast-injury-modifier-source.mjs");

const KOZAR_STATIC_URL =
  "https://www.aast.org/static/journal_pdf_1ea6c353-e5b1-40d7-85ab-2a7cb76e886a/1ea6c353-e5b1-40d7-85ab-2a7cb76e886a.pdf";
const CHALLENGE_BODY =
  '<!DOCTYPE html><html><head><title>Just a moment...</title></head><body><script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script></body></html>';

function response({ status = 200, url = "https://example.test/", body = "", headers = {} }) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    url,
    headers: new Headers(headers),
    body: { cancel: async () => {} },
    async text() {
      return bytes.toString("utf8");
    },
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  };
}

// The real Kozar hosts, with a synthetic payload pinned in place of the PDF bytes.
const PAYLOAD = Buffer.from("%PDF-1.4 synthetic pinned payload for retrieval tests");
const SYNTHETIC_KOZAR = {
  ...audit.ARTIFACTS.kozar2018,
  bytes: PAYLOAD.length,
  sha256: audit.sha256(PAYLOAD),
};
const AAST_OK = (body = PAYLOAD) =>
  response({ url: KOZAR_STATIC_URL, body, headers: { "content-type": "application/pdf" } });
const ARCHIVE_OK = (body = PAYLOAD, datetime = "Sun, 19 Apr 2026 10:00:16 GMT") =>
  response({
    url: audit.ARTIFACTS.kozar2018.hosts[1].url,
    body,
    headers: {
      "content-type": "application/pdf",
      "memento-datetime": datetime,
      link: `<${KOZAR_STATIC_URL}>; rel="original", <https://web.archive.org/web/timemap/link/${KOZAR_STATIC_URL}>; rel="timemap"`,
    },
  });
const CHALLENGE = () =>
  response({ status: 403, body: CHALLENGE_BODY, headers: { "cf-mitigated": "challenge", server: "cloudflare" } });

function scripted(byHost) {
  const calls = [];
  const fetchImpl = async (url) => {
    const host = url.startsWith("https://web.archive.org/") ? "archive" : url.startsWith("https://www.aast.org/") ? "aast" : "other";
    calls.push(host);
    const next = byHost[host].shift();
    if (next instanceof Error) throw next;
    return next();
  };
  const sleeps = [];
  const sleepImpl = async (ms) => {
    sleeps.push(ms);
  };
  return { fetchImpl, sleepImpl, calls, sleeps };
}

function sameLengthDrift(buffer) {
  const drifted = Buffer.from(buffer);
  drifted[drifted.length - 1] ^= 0x01;
  return drifted;
}

test("artifact pins: same-length digest drift and byte-length drift are rejected before parsing", () => {
  assert.equal(audit.verifyArtifactBytes(SYNTHETIC_KOZAR, PAYLOAD), audit.sha256(PAYLOAD));
  assert.throws(() => audit.verifyArtifactBytes(SYNTHETIC_KOZAR, sameLengthDrift(PAYLOAD)), /SHA-256 drifted/);
  assert.throws(() => audit.verifyArtifactBytes(SYNTHETIC_KOZAR, Buffer.concat([PAYLOAD, Buffer.from(" ")])), /byte length drifted/);
  assert.throws(() => audit.verifyArtifactBytes(SYNTHETIC_KOZAR, PAYLOAD.subarray(1)), /byte length drifted/);
  // The real pins reject same-length and wrong-length stand-ins for every artifact.
  for (const artifact of Object.values(audit.ARTIFACTS)) {
    assert.throws(() => audit.verifyArtifactBytes(artifact, Buffer.alloc(artifact.bytes)), /SHA-256 drifted/, artifact.key);
    assert.throws(() => audit.verifyArtifactBytes(artifact, Buffer.alloc(artifact.bytes + 1)), /byte length drifted/, artifact.key);
  }
});

test("a drifted HTTP 200 fails at once: never retried and never replaced by another host", async () => {
  for (const drifted of [sameLengthDrift(PAYLOAD), Buffer.concat([PAYLOAD, Buffer.from("!")])]) {
    const run = scripted({ aast: [() => AAST_OK(drifted)], archive: [() => ARCHIVE_OK()] });
    await assert.rejects(audit.fetchArtifact(SYNTHETIC_KOZAR, run), /SHA-256 drifted|byte length drifted/);
    assert.deepEqual(run.calls, ["aast"]);
    assert.deepEqual(run.sleeps, []);
  }
  // Wrong media type, wrong final URL and wrong Memento provenance are drift too.
  const wrongType = scripted({
    aast: [() => response({ url: KOZAR_STATIC_URL, body: PAYLOAD, headers: { "content-type": "text/html" } })],
    archive: [],
  });
  await assert.rejects(audit.fetchArtifact(SYNTHETIC_KOZAR, wrongType), /media type drifted/);
  assert.deepEqual(wrongType.calls, ["aast"]);
  const wrongUrl = scripted({
    aast: [() => response({ url: "https://www.aast.org/login.html", body: PAYLOAD, headers: { "content-type": "application/pdf" } })],
    archive: [],
  });
  await assert.rejects(audit.fetchArtifact(SYNTHETIC_KOZAR, wrongUrl), /final URL path drifted/);
  assert.deepEqual(wrongUrl.calls, ["aast"]);
  const archiveOnly = { ...SYNTHETIC_KOZAR, hosts: [audit.ARTIFACTS.kozar2018.hosts[1]] };
  const wrongMemento = scripted({ aast: [], archive: [() => ARCHIVE_OK(PAYLOAD, "Sun, 19 Apr 2026 10:00:17 GMT")] });
  await assert.rejects(audit.fetchArtifact(archiveOnly, wrongMemento), /Memento-Datetime drifted/);
  assert.deepEqual(wrongMemento.calls, ["archive"]);
});

test("transport failures are retried with 1/2/4/8 s backoff or Retry-After", async () => {
  const run = scripted({
    aast: [() => response({ status: 503 }), () => response({ status: 502, headers: { "retry-after": "3" } }), () => AAST_OK()],
    archive: [],
  });
  const ok = await audit.fetchArtifact(SYNTHETIC_KOZAR, run);
  assert.equal(ok.host, "aast");
  assert.equal(ok.attempts, 3);
  assert.deepEqual(run.sleeps, [1000, 3000]);
  assert.deepEqual([1, 2, 3, 4].map((attempt) => audit.retryDelayMs(undefined, attempt)), [1000, 2000, 4000, 8000]);
  assert.equal(audit.retryDelayMs(response({ status: 429, headers: { "retry-after": "600" } }), 1), 20000, "Retry-After is capped");
});

test("a Cloudflare challenge is retried, then the identical-bytes archive host is used; exhaustion fails loudly", async () => {
  const challenged = scripted({
    aast: Array.from({ length: audit.MAX_ATTEMPTS }, () => CHALLENGE),
    archive: [() => ARCHIVE_OK()],
  });
  const viaArchive = await audit.fetchArtifact(SYNTHETIC_KOZAR, challenged);
  assert.equal(viaArchive.host, "internet-archive");
  assert.deepEqual(viaArchive.bytes, PAYLOAD);
  assert.deepEqual(challenged.calls, ["aast", "aast", "aast", "aast", "aast", "archive"]);
  assert.deepEqual(challenged.sleeps, [1000, 2000, 4000, 8000]);
  assert.equal(viaArchive.failed_hosts.length, 1);
  assert.match(viaArchive.failed_hosts[0].last_failure, /HTTP 403 \(Cloudflare bot protection/);

  const exhausted = scripted({
    aast: Array.from({ length: audit.MAX_ATTEMPTS }, () => CHALLENGE),
    archive: Array.from({ length: audit.MAX_ATTEMPTS }, () => new Error("socket hang up")),
  });
  await assert.rejects(
    audit.fetchArtifact(SYNTHETIC_KOZAR, exhausted),
    /kozar2018: the pinned bytes were not verified on any host \(aast: 5 attempt\(s\), HTTP 403 .*internet-archive: 5 attempt\(s\), socket hang up\)/,
  );
  assert.equal(exhausted.calls.length, 2 * audit.MAX_ATTEMPTS);

  // A non-transient failure is a changed source: no retry and no other host.
  const missing = scripted({ aast: [() => response({ status: 404 })], archive: [() => ARCHIVE_OK()] });
  await assert.rejects(audit.fetchArtifact(SYNTHETIC_KOZAR, missing), /aast: 1 attempt\(s\), HTTP 404/);
  assert.deepEqual(missing.calls, ["aast"]);
  const forbidden = scripted({ aast: [() => response({ status: 403, body: "Forbidden", headers: { server: "cloudflare" } })], archive: [] });
  await assert.rejects(audit.fetchArtifact(SYNTHETIC_KOZAR, forbidden), /HTTP 403\)/);
  assert.deepEqual(forbidden.calls, ["aast"]);
});

test("HTTP 400 is retried only for NCBI, whose requests carry the tool parameter and no email", async () => {
  const pubmed = audit.ARTIFACTS.pubmed39836096;
  const host = pubmed.hosts[0];
  const url = new URL(host.url);
  assert.equal(url.hostname, "eutils.ncbi.nlm.nih.gov");
  assert.equal(url.searchParams.get("rettype"), "abstract");
  assert.equal(url.searchParams.get("retmode"), "text");
  assert.equal(url.searchParams.get("tool"), audit.NCBI_TOOL);
  assert.equal(url.searchParams.has("email"), false);
  for (const artifact of Object.values(audit.ARTIFACTS)) {
    for (const candidate of artifact.hosts) assert.ok(!/[?&]email=/.test(candidate.url), candidate.url);
  }
  const text = Buffer.from("synthetic record");
  const synthetic = { ...pubmed, bytes: text.length, sha256: audit.sha256(text) };
  let calls = 0;
  const transient400 = async () => {
    calls += 1;
    return calls < 3 ? response({ status: 400 }) : response({ url: host.url, body: text, headers: { "content-type": "text/plain; charset=UTF-8" } });
  };
  const ok = await audit.fetchArtifact(synthetic, { fetchImpl: transient400, sleepImpl: async () => {} });
  assert.equal(ok.attempts, 3);
  const run = scripted({ aast: [() => response({ status: 400 })], archive: [] });
  await assert.rejects(audit.fetchArtifact(SYNTHETIC_KOZAR, run), /HTTP 400/);
  assert.deepEqual(run.calls, ["aast"]);
});

test("only Cloudflare-generated pages are recognised as bot protection", () => {
  const detect = audit.detectCloudflareChallenge;
  assert.equal(detect({ status: 403, headers: new Headers({ "cf-mitigated": "challenge" }), body: CHALLENGE_BODY }).challenged, true);
  assert.equal(
    detect({
      status: 403,
      headers: new Headers({ server: "cloudflare", "cf-ray": "0000000000000000-XXX" }),
      body: '<html><head><title>Access denied | www.aast.org used Cloudflare to restrict access</title></head><body><div id="cf-error-details">Error 1020</div></body></html>',
    }).challenged,
    true,
  );
  assert.equal(detect({ status: 403, headers: new Headers(), body: "Forbidden" }).challenged, false);
  assert.equal(detect({ status: 403, headers: new Headers({ "cf-mitigated": "challenge" }), body: "" }).challenged, false, "one signal is not enough");
  assert.equal(detect({ status: 200, headers: new Headers({ "cf-mitigated": "challenge" }), body: CHALLENGE_BODY }).challenged, false);
  assert.equal(
    detect({ status: 403, headers: new Headers({ server: "cloudflare", "cf-ray": "x" }), body: "<title>Forbidden</title>" }).challenged,
    false,
    "an origin 403 passing through Cloudflare is a real failure",
  );
});

test("span anchors fail closed when missing, repeated or changed (synthetic text)", () => {
  const text = "alpha beta gamma delta epsilon zeta";
  assert.equal(audit.spanText(text, "beta", "delta", "ok"), "beta gamma delta");
  assert.throws(() => audit.spanText(text, "omega", "delta", "missing"), /start anchor/);
  assert.throws(() => audit.spanText(`${text} beta`, "beta", "delta", "repeated"), /not unique/);
  assert.throws(() => audit.spanText(text, "beta", "omega", "no end"), /end anchor/);
  const statement = { id: "synthetic", spans: [{ from: "beta", to: "delta", length: 16, sha256: audit.sha256("beta gamma delta") }] };
  const clean = [];
  audit.checkSpans(statement, text, (value) => value, clean);
  assert.deepEqual(clean, []);
  const drifted = [];
  audit.checkSpans(statement, text.replace("gamma", "gamme"), (value) => value, drifted);
  assert.equal(drifted.length, 1, "a one-letter change inside a pinned span must be reported");
  assert.throws(() => audit.paragraphSlice("one two one", { id: "dup", start: "one", end: null }), /not unique/);
});

test("parseRecordText reads the citation, authors and linked errata of a plain-text record (synthetic)", () => {
  const record = audit.parseRecordText(
    [
      "1. J Trauma Acute Care Surg. 2018 Dec;85(6):1119-1122. doi: ",
      "10.1097/TA.0000000000002058.",
      "",
      "Synthetic title.",
      "",
      "Alpha AB(1), Beta C, Gamma D; Example Committee.",
      "",
      "Author information:",
      "(1)Somewhere.",
      "",
      "Erratum in",
      "    J Trauma Acute Care Surg. 2019 Aug;87(2):512. doi: ",
      "10.1097/TA.0000000000002419.",
      "",
      "Comment in",
      "    J Trauma Acute Care Surg. 2019 Oct;87(4):999.",
      "",
      "DOI: 10.1097/TA.0000000000002058",
      "PMID: 30462622 [Indexed for MEDLINE]",
    ].join("\n"),
  );
  assert.deepEqual(record.authors, ["Alpha AB", "Beta C", "Gamma D", "Example Committee"]);
  assert.deepEqual(
    [record.journal, record.year, record.volume, record.issue, record.pages, record.doi, record.pmid],
    ["J Trauma Acute Care Surg", "2018", "85", "6", "1119-1122", "10.1097/TA.0000000000002058", "30462622"],
  );
  assert.deepEqual(record.errata, ["J Trauma Acute Care Surg. 2019 Aug;87(2):512. doi: 10.1097/TA.0000000000002419."]);
  assert.equal(record.abstract, "", "linked-record notices are not an abstract");
});

// ---------------------------------------------------------------------------------------------
// Runtime mutation checks

function mutant(overrides = {}) {
  return {
    ...AASTTraumaGrading,
    fields: overrides.fields ?? AASTTraumaGrading.fields,
    compute: overrides.compute ?? AASTTraumaGrading.compute,
    refs: overrides.refs ?? AASTTraumaGrading.refs,
    info: overrides.info ?? AASTTraumaGrading.info,
  };
}

function withField(id, change) {
  return AASTTraumaGrading.fields.map((field) => (field.id === id ? change({ ...field }) : field));
}

// Reapplies an advance on top of the real (modifier-free) grade, the way a regression would.
function computeWithRule(predicate) {
  return (vals) => {
    const result = AASTTraumaGrading.compute({ ...vals, multiple_injuries: false, kidney_2018_bilateral: false });
    if (result.Error) return result;
    const base = Number(result["AAST Grade"].replace("Grade ", ""));
    if (!predicate(vals, base)) return result;
    return {
      ...result,
      "AAST Grade": `Grade ${base + 1}`,
      "Key Findings": `${result["Key Findings"]}; Multiple injuries (+1 grade)`,
      "Multiple Injury Adjustment": `Base grade ${base} advanced to Grade ${base + 1} due to multiple injuries`,
    };
  };
}

test("the real calculator satisfies every runtime binding", () => {
  const runtime = audit.verifyRuntime(AASTTraumaGrading);
  assert.equal(runtime.vectors, 312);
  assert.deepEqual(Object.keys(runtime.bindings).sort(), audit.CLAIM_BINDINGS.map((binding) => binding.claim_id).sort());
  assert.equal(runtime.fail_safe.publication_derived, false);
  assert.deepEqual(runtime.fail_safe.paths, ["kidney2025", "kidneyDefault", "pancreas"]);
});

test("mutation checks: runtime regressions are rejected", () => {
  const mutants = {
    "former unconditional multiple-injury rule on every organ": mutant({
      fields: withField("multiple_injuries", (field) => ({ ...field, showIf: undefined })),
      compute: computeWithRule((vals, base) => vals.multiple_injuries && base > 0 && base < 3),
    }),
    "multiple-injury rule still applied to the kidney": mutant({
      compute: (vals) =>
        vals.organ === "kidney" && vals.multiple_injuries === true
          ? computeWithRule((_, base) => base < 3)(vals)
          : AASTTraumaGrading.compute(vals),
    }),
    "multiple-injury rule applied to the 2024 pancreas path": mutant({
      compute: (vals) =>
        vals.organ === "pancreas"
          ? computeWithRule((_, base) => vals.multiple_injuries === true && base < 3)(vals)
          : AASTTraumaGrading.compute(vals),
    }),
    "multiple-injury checkbox shown for the kidney": mutant({
      fields: withField("multiple_injuries", (field) => ({
        ...field,
        showIf: (vals) => ["liver", "spleen", "kidney"].includes(vals.organ),
      })),
    }),
    "bilateral checkbox shown on the 2025 kidney path": mutant({
      fields: withField("kidney_2018_bilateral", (field) => ({ ...field, showIf: (vals) => vals.organ === "kidney" })),
    }),
    "bilateral advance applied on the 2025 kidney path": mutant({
      compute: (vals) =>
        vals.organ === "kidney" && vals.kidney_ois_version !== "2018" && vals.kidney_2018_bilateral === true
          ? computeWithRule((_, base) => base < 3)(vals)
          : AASTTraumaGrading.compute(vals),
    }),
    "grade III ceiling removed": mutant({
      compute: (vals) => {
        const result = AASTTraumaGrading.compute(vals);
        const atCeiling =
          ["liver", "spleen"].includes(vals.organ) && vals.multiple_injuries === true && result["AAST Grade"] === "Grade 3" && !result["Multiple Injury Adjustment"];
        return atCeiling
          ? { ...result, "AAST Grade": "Grade 4", "Multiple Injury Adjustment": "Base grade 3 advanced to Grade 4 due to multiple injuries" }
          : result;
      },
    }),
    "loose truthy value applies the modifier": mutant({
      compute: (vals) => AASTTraumaGrading.compute({ ...vals, multiple_injuries: Boolean(vals.multiple_injuries) }),
    }),
    "description left at the base grade after an advance": mutant({
      compute: (vals) => {
        const result = AASTTraumaGrading.compute(vals);
        if (!result["Multiple Injury Adjustment"] && !result["Bilateral Injury Adjustment"]) return result;
        const base = AASTTraumaGrading.compute({ ...vals, multiple_injuries: false, kidney_2018_bilateral: false });
        return { ...result, "Grade Description": base["Grade Description"] };
      },
    }),
    "duct injury without a location graded as Grade III": mutant({
      compute: (vals) =>
        vals.organ === "pancreas" && vals.pancreas_duct && vals.pancreas_duct !== "none" && !["head", "body_tail"].includes(vals.pancreas_duct_location)
          ? AASTTraumaGrading.compute({ ...vals, pancreas_duct_location: "body_tail" })
          : AASTTraumaGrading.compute(vals),
    }),
    "no-modifier note missing on the 2025 kidney path": mutant({
      compute: (vals) => {
        const result = AASTTraumaGrading.compute(vals);
        if (vals.organ !== "kidney") return result;
        const { "Grade-Advance Note": _dropped, ...rest } = result;
        return rest;
      },
    }),
    "no-modifier note shown at grade III and above": mutant({
      compute: (vals) => {
        const result = AASTTraumaGrading.compute(vals);
        return vals.organ === "pancreas" && !result.Error ? { ...result, "Grade-Advance Note": audit.RUNTIME_TEXT.pancreas_2024_note } : result;
      },
    }),
    "liver grade II length reverted to <10 cm": mutant({
      fields: withField("liver_laceration", (field) => ({
        ...field,
        opts: field.opts.map((opt) => (opt.value === "1_3cm" ? { ...opt, label: "1-3 cm parenchymal depth, <10 cm length (Grade II)" } : opt)),
      })),
    }),
    "2018 urinary extravasation subLabel reverted": mutant({
      fields: withField("kidney_2018_urinary_extrav", (field) => ({
        ...field,
        subLabel: "Contrast extravasation on delayed phase → Grade IV",
      })),
    }),
    "pancreas grade V subLabel reverted to the 1990 wording": mutant({
      fields: withField("pancreas_destructive", (field) => ({
        ...field,
        subLabel: "Massive disruption of pancreatic head with nonviable parenchyma → Grade V",
      })),
    }),
    "Keihani 2025 citation reverted to the wrong third author": mutant({
      refs: AASTTraumaGrading.refs.map((ref) =>
        ref.u === "https://pubmed.ncbi.nlm.nih.gov/39836096/" ? { ...ref, t: ref.t.replace("Matta R", "Swaroop M") } : ref,
      ),
    }),
    "AAST website citation linked to the permissions page again": mutant({
      refs: AASTTraumaGrading.refs.map((ref) =>
        ref.t === "AAST Official Website - Organ Injury Scale" ? { ...ref, u: "https://www.aast.org/resources-detail/injury-scoring-scale" } : ref,
      ),
    }),
    "info text no longer states the modifiers": mutant({
      info: { ...AASTTraumaGrading.info, text: AASTTraumaGrading.info.text.split("GRADE-ADVANCE MODIFIERS")[0] },
    }),
  };
  for (const [name, calculator] of Object.entries(mutants)) {
    assert.throws(() => audit.verifyRuntime(calculator), `mutant was not rejected: ${name}`);
  }
});

// ---------------------------------------------------------------------------------------------
// Live exact-head run

test("live exact-head audit and the compute regression tests pass", () => {
  const run = spawnSync(
    process.execPath,
    ["--import", "./scripts/register-jsx-loader.mjs", "scripts/audit-aast-injury-modifier-source.mjs", "--json"],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  assert.equal(run.status, 0, `AAST source audit failed\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`);

  const computeTests = spawnSync(
    process.execPath,
    ["--import", "./scripts/register-jsx-loader.mjs", "--test", "tests/aast-trauma-grading-compute.test.mjs"],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  assert.equal(computeTests.status, 0, `AAST compute tests failed\nstdout:\n${computeTests.stdout}\nstderr:\n${computeTests.stderr}`);

  const result = JSON.parse(run.stdout);
  assert.equal(result.schema, "radulator-aast-injury-modifier-source-audit/v2");
  assert.equal(result.calculator_id, "aast-trauma-grading");
  assert.equal(result.calculator_path, "src/components/calculators/AASTTraumaGrading.jsx");
  assert.equal(result.source_bytes_committed, false);

  assert.deepEqual(
    result.artifacts.map(({ key, pin, bytes, sha256 }) => [key, pin, bytes, sha256]),
    [
      ["kozar2018", "raw-bytes", 174748, "bcd66906506efee3757ce1ea39e0da66bf30e39ffa7ccf3c33cc2678b3430965"],
      ["aastScalePage2020", "raw-bytes", 274891, "e60dd713368a7ceddf61d368cf9d8ac9dc70d183d64096753c93cb218816481b"],
      ["pubmed30462622", "raw-bytes", 1474, "da35009c9ef5910296f34614591307c25c4b1d2b6ca4deeae109932ae7a5eec8"],
      ["pubmed39836096", "raw-bytes", 2069, "909f136488d4777571f78604db5b9183751e88f61fc338a54f70ee45f0f723ec"],
      ["pubmed39898876", "raw-bytes", 3705, "fad50e9dcbc52c90879d1d7fdf6100de46cd94481ce9c1e2a27c9bf7f4d62911"],
    ],
  );
  const artifacts = new Map(result.artifacts.map((artifact) => [artifact.key, artifact]));
  assert.ok(["aast", "internet-archive"].includes(artifacts.get("kozar2018").verified_host));
  assert.equal(artifacts.get("aastScalePage2020").verified_host, "internet-archive");
  for (const pmid of ["30462622", "39836096", "39898876"]) {
    const artifact = artifacts.get(`pubmed${pmid}`);
    assert.equal(artifact.verified_host, "ncbi");
    assert.equal(
      artifact.final_url,
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&rettype=abstract&retmode=text&tool=radulator-aast-audit`,
    );
  }

  assert.deepEqual(
    result.source_statements.map(({ id }) => id),
    [
      "kozar2018-identity",
      "kozar2018-intro-multiple-grade-i-ii",
      "kozar2018-table1-spleen-notes",
      "kozar2018-table2-liver-notes",
      "kozar2018-table2-liver-grade-ii-laceration-length",
      "kozar2018-table3-kidney-notes",
      "kozar2018-table3-kidney-grade-iv-urinary-extravasation",
      "kozar2018-table3-active-bleeding-delayed-phase",
      "kozar2018-delayed-excretory-phase",
      "aast-scale-page-pancreas-multiple-injury-note",
      "aast-scale-page-pancreas-table-credit",
      "kozar2018-pubmed-identity",
      "keihani2025-pubmed-identity",
      "notrica2025-pubmed-identity",
      "notrica2025-abstract-grade-v",
      "notrica2025-abstract-duct-location",
      "notrica2025-abstract-original-1990",
    ],
  );
  const statements = new Map(result.source_statements.map((statement) => [statement.id, statement]));
  const digests = (id) => statements.get(id).spans.map(({ sha256 }) => sha256);
  assert.deepEqual(digests("kozar2018-table3-kidney-notes"), [
    "b039c9dd44be2b078d880698ef176fdfb197aafaed3ab9a94784c1cdc204182a",
    "9890ed6ae41178c64c3064697c32e9b08671b5b90b7f507959a7cf8f9ef2ca67",
  ]);
  assert.deepEqual(digests("kozar2018-table2-liver-grade-ii-laceration-length"), [
    "7fadb0444b9ddd8503b61f3e45cdf342f7b6eeeedda4625ba46ac8826328f63e",
  ]);
  assert.deepEqual(digests("aast-scale-page-pancreas-multiple-injury-note"), [
    "939484753d687225e497a3ee438eb597c0601b067a8f28bb080a90da75ecc2c4",
  ]);
  assert.deepEqual(digests("notrica2025-abstract-duct-location"), [
    "9faf71e7e381594585e50b298613b78e5dfa487cdc5ecd71a10bc27af4ddb774",
    "a78807cbc064ef6bb0d10e7a0e0f9ee9a93ff7229d28b4db5aadef6033777c4a",
  ]);
  assert.deepEqual(statements.get("kozar2018-pubmed-identity").identity.errata, [
    "J Trauma Acute Care Surg. 2019 Aug;87(2):512. doi: 10.1097/TA.0000000000002419.",
  ]);
  assert.deepEqual(statements.get("kozar2018-table3-kidney-notes").absent_anchors, ["Advance one grade for multiple"]);
  // Source-side mutation checks run on the real spans at audit time.
  assert.equal(result.source_mutation_checks.length, 15);
  assert.ok(result.source_mutation_checks.every((check) => check.rejected === true));
  assert.deepEqual(
    result.source_mutation_checks
      .filter((check) => check.statement_id === "kozar2018-table2-liver-grade-ii-laceration-length")
      .map(({ replaced, with: replacement }) => [replaced, replacement]),
    [["≤10cm", "<10cm"]],
  );
  for (const statement of result.source_statements) {
    assert.equal(typeof statement.paraphrase, "string", `${statement.id}: paraphrase`);
    for (const span of statement.spans ?? []) {
      assert.ok(span.from && span.to && span.length > 0, `${statement.id}: span anchors and length`);
      for (const anchor of [span.from, span.to]) {
        assert.ok(anchor.split(/\s+/).length <= 6, `${statement.id}: anchor longer than six words`);
      }
    }
  }

  assert.deepEqual(
    result.claim_bindings.map(({ claim_id, source_statement_ids }) => [claim_id, source_statement_ids]),
    [
      ["liver-2018-multiple-injury-advance", ["kozar2018-intro-multiple-grade-i-ii", "kozar2018-table2-liver-notes"]],
      ["spleen-2018-multiple-injury-advance", ["kozar2018-intro-multiple-grade-i-ii", "kozar2018-table1-spleen-notes"]],
      ["kidney-2018-bilateral-advance", ["kozar2018-table3-kidney-notes"]],
      ["kidney-2018-no-multiple-injury-advance", ["kozar2018-table3-kidney-notes"]],
      ["liver-2018-grade-ii-laceration-length", ["kozar2018-table2-liver-grade-ii-laceration-length"]],
      [
        "kidney-2018-urinary-extravasation-sublabel",
        [
          "kozar2018-table3-kidney-grade-iv-urinary-extravasation",
          "kozar2018-table3-active-bleeding-delayed-phase",
          "kozar2018-delayed-excretory-phase",
        ],
      ],
      ["pancreas-2024-grade-v-sublabel", ["notrica2025-abstract-grade-v"]],
      ["pancreas-2024-duct-location-required", ["notrica2025-abstract-duct-location"]],
      [
        "pancreas-2024-no-modifier-note-1990-sentence",
        ["aast-scale-page-pancreas-multiple-injury-note", "aast-scale-page-pancreas-table-credit", "notrica2025-abstract-original-1990"],
      ],
      [
        "reference-list-identities",
        ["kozar2018-identity", "kozar2018-pubmed-identity", "keihani2025-pubmed-identity", "notrica2025-pubmed-identity"],
      ],
    ],
  );
  assert.equal(result.runtime.vectors, 312);
  assert.equal(result.runtime.fail_safe.publication_derived, false);
  assert.equal(result.runtime.fail_safe.aast_reference.linked, false);
  assert.deepEqual(result.scope.not_asserted, [
    "whether the 2025 kidney revision (Keihani 2025) keeps any grade-advance rule: full text not openly retrievable",
    "whether the 2024 pancreas revision (Notrica 2025) keeps any grade-advance rule: full text not openly retrievable",
    "content of the Kozar 2018 erratum (PMID 31348410): not openly retrievable; indirect evidence points to an author-name correction",
    "2024 pancreas grade V ductal subgrades (not modeled by the calculator)",
    "whole-calculator clinical acceptance",
  ]);
});
