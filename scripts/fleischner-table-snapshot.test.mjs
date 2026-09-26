import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as audit from "./audit-fleischner-primary-source.mjs";

// Detects accepting a challenge as evidence, masking drift, or accepting an
// unreviewed/stale/corrupt alternate source. Synthetic text is not clinical evidence.
assert.equal(typeof audit.resolveNlmTableEvidence, "function", "bounded NLM snapshot resolution is available");
const sha = (s) => createHash("sha256").update(s).digest("hex");
const table = "<table><tr><td>reviewed</td></tr></table>";
const url = "https://www.ncbi.nlm.nih.gov/books/NBK553863/table/ch5.Tab1/?report=objectonly";
const expected = { url, objectId: "ch5.Tab1", bytes: Buffer.byteLength(table), sha256: sha(table), text_sha256: sha("reviewed") };
const snapshot = {
  schema: "radulator-fleischner-table-snapshot/v1",
  object_id: "ch5.Tab1", original_url: url,
  publisher_url: "https://link.springer.com/chapter/10.1007/978-3-030-11149-6_5/tables/1",
  locator: "Springer Table 5.1",
  artifact_path: "docs/evidence/source-snapshots/fleischner-table1.html",
  bytes: Buffer.byteLength(table), sha256: sha(table), text_sha256: sha("reviewed"),
  parser_version: "fleischner-html-literal/v1",
  retrieved_at: "2026-09-24T00:00:00Z",
  retrieval_bytes: 2000, retrieval_sha256: "a".repeat(64),
  claim_id: "nlm-fleischner-solid-table-cross-check",
  bindings: { runtime: "b".repeat(64), vectors: "c".repeat(64), parser: "d".repeat(64) },
  review: { disposition: "PASS", reference: "independent-test-review", reviewer: "independent-reviewer", reviewed_at: "2026-09-24T01:00:00Z", revalidate_by: "2026-10-24T01:00:00Z", release_authority: false },
};
const response = (body, status = 200, finalUrl = url) => ({ ok: status === 200, status, url: finalUrl, headers: new Headers({ "content-type": "text/html" }), text: async () => body, body: { cancel: async () => {} } });
const options = (overrides = {}) => ({ expected, snapshot: structuredClone(snapshot), bindings: snapshot.bindings, now: Date.parse("2026-09-25T00:00:00Z"), readArtifact: () => Buffer.from(table), literalText: () => "reviewed", fetchImpl: async () => response("<title>Checking your browser - reCAPTCHA</title>"), sleepImpl: async () => {}, ...overrides });
const resolve = (overrides) => audit.resolveNlmTableEvidence(options(overrides));

assert.equal((await resolve({ fetchImpl: async () => response(table) })).mode, "live");
const fallback = await resolve();
assert.equal(fallback.mode, "reviewed-snapshot");
assert.equal(fallback.source_url, snapshot.publisher_url);
assert.equal(fallback.locator, "Springer Table 5.1");
assert.equal(fallback.revalidate_by, snapshot.review.revalidate_by);
assert.equal((await resolve({ fetchImpl: async () => { throw new TypeError("network failure"); } })).mode, "reviewed-snapshot");
assert.equal((await resolve({ fetchImpl: async () => response("unavailable", 503) })).mode, "reviewed-snapshot");
assert.equal((await resolve({ fetchImpl: async () => response("limited", 429) })).mode, "reviewed-snapshot");
await assert.rejects(resolve({ snapshot: null }), /approved snapshot/);
await assert.rejects(resolve({ fetchImpl: async () => response(table.replace("reviewed", "changed")) }), /drift/);
await assert.rejects(resolve({ fetchImpl: async () => response("ordinary malformed page") }), /table/);
await assert.rejects(resolve({ fetchImpl: async () => response(table, 200, "https://evil.test/") }), /URL/);
await assert.rejects(resolve({ fetchImpl: async () => response("forbidden", 403) }), /HTTP 403/);
await assert.rejects(resolve({ readArtifact: () => Buffer.from("reCAPTCHA") }), /snapshot/);
await assert.rejects(resolve({ now: Date.parse("2026-10-24T01:00:00Z") }), /expired/);
await assert.rejects(resolve({ bindings: { ...snapshot.bindings, runtime: "e".repeat(64) } }), /bindings/);
await assert.rejects(resolve({ literalText: () => "changed" }), /text/);
for (const mutate of [
  s => { s.bytes += 1; },
  s => { s.sha256 = "e".repeat(64); },
  s => { s.original_url = "https://evil.test/"; },
  s => { s.object_id = "ch5.Tab2"; },
  s => { s.publisher_url = "https://evil.test/table"; },
  s => { s.artifact_path = "../../outside.html"; },
  s => { s.parser_version = "unknown"; },
  s => { s.review = null; },
  s => { s.review.reference = ""; },
  s => { s.review.disposition = "pending"; },
  s => { s.review.release_authority = true; },
  s => { s.review.revalidate_by = "2027-01-01T00:00:00Z"; },
  s => { s.retrieved_at = "2027-01-01T00:00:00Z"; },
]) {
  const changed = structuredClone(snapshot); mutate(changed);
  await assert.rejects(resolve({ snapshot: changed }), /snapshot/i);
}
console.log("Fleischner snapshot resolver: live/fallback and negative/identity checks passed");

// Exercise actual committed publisher bytes and preserved complete NLM text
// identities, independently of availability of the three RSNA primary artifacts.
const manifest = JSON.parse(readFileSync("docs/evidence/fleischner-2017-reviewed-evidence.json", "utf8"));
const realBindings = {
  runtime: sha(readFileSync("src/components/calculators/Fleischner.jsx")),
  vectors: sha(readFileSync("tests/fixtures/compute/fleischner.json")),
  parser: sha(readFileSync("scripts/audit-fleischner-primary-source.mjs")),
};
for (const [kind, n, bytes, hash] of [
  ["solid", 1, 3153, "d9cec9955406cd10d6ec93298dd61f1215dbdd18a38815a33d1af93407c1dbb9"],
  ["subsolid", 2, 1912, "7e28fe2305cd1ce68afbd6bbd25e092f8301082085c7f8c6efec16d2b5b21997"],
]) {
  const record = manifest.table_snapshots[kind];
  const claim = manifest.payload.claims.find(c => c.id === `nlm-fleischner-${kind}-table-cross-check`);
  const result = await audit.resolveNlmTableEvidence({
    expected: { url: record.original_url, objectId: `ch5.Tab${n}`, bytes, sha256: hash, text_sha256: claim.source_text_assertions[0].locator_text_sha256 },
    snapshot: record, bindings: realBindings,
    now: Date.parse(record.review.reviewed_at) + 1000,
    fetchImpl: async () => response("<title>Checking your browser - reCAPTCHA</title>", 200, record.original_url),
  });
  assert.equal(result.mode, "reviewed-snapshot");
  assert.equal(sha(audit.extractHtmlLiteralText(result.fragment)), claim.source_text_assertions[0].locator_text_sha256);
}
console.log("Both committed publisher snapshots match complete reviewed NLM table text");
