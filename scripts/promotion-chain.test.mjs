#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";

import * as gate from "./independent-review-gate.mjs";
import {
  ATTESTATION_MARKER,
  BATCH_POLICY,
  CHAIN_REASON_CODES,
  clearPromotionChainCache,
  decodeAttestedLabels,
  ENFORCEMENT_CONTEXT,
  GATE_CHECK_CONTEXT,
  gatePassFingerprint,
  isPromotionPr,
  loadPromotionChain,
  loadPromotionChainFacts,
  PROMOTION_CHAIN_SCHEMA,
  promotionExactStateReview,
  promotionReviewBinding,
  promotionReviewMode,
  riskDomain,
  riskDomains,
  summarizePromotionChain,
  unavailablePromotionChain,
  verifyPromotionChain,
} from "./promotion-chain.mjs";
import {
  ATTESTATION_SCHEMA,
  canonicalJson,
  classifyRisk,
  digest,
  verifyAttestation,
  verifyAttestationRecord,
} from "./release-policy.mjs";

const REPO = "momomojo/Radulator";
const REPO_ID = 1027532341;
const ROOT = `/repos/${REPO}`;

function hex(label) {
  return createHash("sha1").update(label).digest("hex");
}

function hex64(label) {
  return createHash("sha256").update(label).digest("hex");
}

function keyFixture(keyId, role, profile) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return { keyId, role, profile, privateKey, publicKey: publicKey.export({ type: "spki", format: "pem" }) };
}

const PRIMARY = keyFixture("primary-2026-08", "primary", "radulator");
const VERIFICATION = keyFixture("verification-2026-08", "verification", "default");
const SAME_PROFILE_VERIFICATION = keyFixture("verification-same-profile", "verification", "radulator");
const PUBLIC_KEYS = Object.fromEntries([PRIMARY, VERIFICATION, SAME_PROFILE_VERIFICATION].map((key) => [
  key.keyId,
  { role: key.role, profile: key.profile, publicKey: key.publicKey },
]));

function minutes(base, count) {
  return new Date(Date.parse(base) + count * 60_000).toISOString().replace(".000Z", "Z");
}

function file(filename, blobLabel, overrides = {}) {
  return {
    filename,
    status: "modified",
    sha: hex(blobLabel),
    additions: 1,
    deletions: 1,
    changes: 2,
    patch: "@@ -1 +1 @@\n-const threshold = 1\n+const threshold = 2",
    ...overrides,
  };
}

function withoutPatch(files) {
  return files.map((item) => Object.fromEntries(Object.entries(item).filter(([key]) => key !== "patch")));
}

function signedRecord(key, state, overrides = {}) {
  const record = {
    schema: ATTESTATION_SCHEMA,
    repository_id: state.repositoryId,
    pr: state.pr,
    head_sha: state.headSha,
    base_sha: state.baseSha,
    base_ref: "develop",
    state_epoch: state.stateEpoch,
    labels_sha256: state.labelsSha256,
    risk: state.risk,
    ci: state.ci,
    ci_sha256: digest(state.ci),
    verdict: "PASS",
    clinical_analysis: "Exact diff and primary sources support release.",
    citations: ["https://example.org/source"],
    judge: { key_id: key.keyId, role: key.role, profile: key.profile, model: "gpt-5.6-sol", provider: "openai-codex" },
    reviewed_at: state.reviewedAt,
    ...overrides,
  };
  record.signature = sign(null, Buffer.from(canonicalJson(record)), key.privateKey).toString("base64");
  return record;
}

function carrier(record, id) {
  return {
    id,
    created_at: record.reviewed_at,
    updated_at: record.reviewed_at,
    user: { login: "judge-carrier" },
    body: `${ATTESTATION_MARKER}\n\`\`\`json\n${JSON.stringify(record, null, 2)}\n\`\`\``,
  };
}

// One develop PR squash-merged by the controller. Times are relative to `start`.
function entrySpec(pr, overrides = {}) {
  return {
    pr,
    title: `fix: change ${pr}`,
    start: "2026-09-27T10:00:00Z",
    files: [file("src/components/calculators/NIRADS.jsx", `nirads-${pr}`)],
    labels: ["ready-for-gate"],
    body: "",
    ...overrides,
  };
}

// Builds raw GitHub REST responses for main M, merge base S0, the develop chain, and a promotion P.
function world({
  entries = [
    entrySpec(101, {
      files: [
        file("src/components/calculators/NIRADS.jsx", "nirads-101"),
        file("tests/e2e/calculators/neuroradiology/ni-rads.spec.js", "spec-101"),
      ],
    }),
    entrySpec(102, {
      start: "2026-09-27T12:00:00Z",
      labels: ["ready-for-gate", "release-remediation"],
      files: [
        file("src/components/calculators/NIRADS.jsx", "nirads-102"),
        file("docs/verification/calculator-inventory.json", "inventory-102"),
      ],
    }),
  ],
  developFiles = [
    file("src/components/calculators/NIRADS.jsx", "nirads-102"),
    file("tests/e2e/calculators/neuroradiology/ni-rads.spec.js", "spec-101"),
    file("docs/verification/calculator-inventory.json", "inventory-102"),
  ],
  mainDriftFiles = [
    file("src/App.jsx", "app-main"),
    file("docs/verification/calculator-inventory.json", "inventory-main"),
    file("tests/e2e/calculators/neuroradiology/ni-rads.spec.js", "spec-101"),
  ],
  promotionFiles = [
    file("src/components/calculators/NIRADS.jsx", "nirads-102"),
    file("docs/verification/calculator-inventory.json", "inventory-merged"),
  ],
  promotion = true,
} = {}) {
  const M = hex("main");
  const S0 = hex("merge-base");
  const responses = {};
  const rangeCommits = [];
  const heads = {};
  let parent = S0;
  for (const spec of entries) {
    const squash = hex(`squash-${spec.pr}`);
    const head = hex(`head-${spec.pr}`);
    const tree = hex(`tree-${spec.pr}`);
    heads[spec.pr] = { squash, head, tree, base: parent };
    const epochAt = spec.start;
    const ciAt = minutes(spec.start, 1);
    const risk = classifyRisk(spec.files, { title: spec.title, body: spec.body });
    const ciNames = risk.tier === "high"
      ? ["Smoke Tests", "Targeted Calculator Tests", "Full Test Suite"]
      : ["Smoke Tests", "Targeted Calculator Tests"];
    const ci = ciNames.map((name, index) => ({
      name,
      app_id: 15368,
      check_run_id: spec.pr * 100 + index,
      check_suite_id: spec.pr * 10,
      workflow_id: 227376261,
      workflow_run_id: spec.pr * 1000,
      run_attempt: 1,
      head_sha: head,
      conclusion: "success",
      completed_at: ciAt,
    }));
    const state = {
      repositoryId: REPO_ID,
      pr: spec.pr,
      headSha: head,
      baseSha: parent,
      stateEpoch: { event_id: spec.pr * 7, event_created_at: epochAt },
      labelsSha256: gate.relevantLabelsDigest(spec.labels).sha256,
      risk,
      ci,
      reviewedAt: minutes(spec.start, 2),
    };
    const records = [signedRecord(PRIMARY, state)];
    if (risk.tier === "high") records.push(signedRecord(VERIFICATION, { ...state, reviewedAt: minutes(spec.start, 3) }));
    const committedAt = minutes(spec.start, 5);
    rangeCommits.push({
      sha: squash,
      parents: [{ sha: parent }],
      committer: { login: "web-flow" },
      commit: {
        message: `PR #${spec.pr}: exact-head clinical gate passed\n\n* ${spec.title}`,
        tree: { sha: tree },
        committer: { date: committedAt },
        verification: { verified: true, reason: "valid" },
      },
    });
    responses[`${ROOT}/pulls/${spec.pr}`] = {
      number: spec.pr,
      state: "closed",
      merged: true,
      merged_at: committedAt,
      merged_by: { login: "github-actions[bot]", id: 41898282, type: "Bot" },
      merge_commit_sha: squash,
      title: spec.title,
      base: { ref: "develop", sha: parent, repo: { id: REPO_ID, full_name: REPO } },
      head: { ref: `feature/${spec.pr}`, sha: head, repo: { full_name: REPO } },
    };
    responses[`${ROOT}/git/commits/${head}`] = { sha: head, tree: { sha: tree }, parents: [{ sha: parent }] };
    responses[`${ROOT}/compare/${parent}...${head}`] = {
      status: "ahead",
      ahead_by: 2,
      behind_by: 0,
      merge_base_commit: { sha: parent },
      files: withoutPatch(spec.files),
    };
    responses[`${ROOT}/issues/${spec.pr}/comments`] = [
      { id: spec.pr * 10 + 9, body: "Looks good to me.", created_at: epochAt, updated_at: epochAt },
      ...records.map((record, index) => carrier(record, spec.pr * 10 + index)),
    ];
    responses[`${ROOT}/commits/${head}/statuses`] = [
      {
        id: spec.pr * 10 + 3,
        state: "failure",
        context: ENFORCEMENT_CONTEXT,
        description: `PR_NOT_OPEN_READY ${hex64(`after-${spec.pr}`)}`,
        created_at: minutes(spec.start, 6),
        creator: { id: 41898282, login: "github-actions[bot]" },
      },
      {
        id: spec.pr * 10 + 2,
        state: "success",
        context: ENFORCEMENT_CONTEXT,
        description: `PASS ${gatePassFingerprint({ headSha: head, baseSha: parent, risk })}`,
        created_at: minutes(spec.start, 4),
        creator: { id: 41898282, login: "github-actions[bot]" },
      },
      {
        id: spec.pr * 10 + 1,
        state: "pending",
        context: ENFORCEMENT_CONTEXT,
        description: `Evaluating exact state for PR #${spec.pr} in run 1`,
        created_at: minutes(spec.start, 3),
        creator: { id: 41898282, login: "github-actions[bot]" },
      },
      { id: spec.pr * 10 + 4, state: "success", context: "ci/other", description: "unrelated", created_at: epochAt, creator: { id: 1, login: "x" } },
    ];
    parent = squash;
  }
  const D = parent;
  responses[`${ROOT}/compare/${M}...${D}`] = {
    status: "diverged",
    ahead_by: rangeCommits.length,
    behind_by: 7,
    merge_base_commit: { sha: S0 },
    commits: rangeCommits,
    files: withoutPatch(developFiles),
  };
  const P = hex("promotion");
  if (promotion) {
    responses[`${ROOT}/git/commits/${P}`] = { sha: P, parents: [{ sha: M }, { sha: D }] };
    responses[`${ROOT}/compare/${M}...${P}`] = {
      status: "ahead",
      ahead_by: rangeCommits.length + 1,
      behind_by: 0,
      merge_base_commit: { sha: M },
      files: withoutPatch(promotionFiles),
    };
    responses[`${ROOT}/compare/${S0}...${M}`] = {
      status: "ahead",
      ahead_by: 7,
      behind_by: 0,
      merge_base_commit: { sha: S0 },
      files: withoutPatch(mainDriftFiles),
    };
  }
  return { M, S0, D, P, heads, responses };
}

function fakeApi(responses) {
  const calls = [];
  const lookup = (path) => {
    calls.push(path);
    if (!Object.hasOwn(responses, path)) {
      const error = new Error(`GET ${path} failed: 404`);
      error.status = 404;
      throw error;
    }
    return structuredClone(responses[path]);
  };
  return {
    calls,
    async request(path) { return lookup(path); },
    async paged(path) {
      const value = lookup(path);
      if (!Array.isArray(value)) throw new Error(`Expected paginated array at ${path}.`);
      return value;
    },
  };
}

async function run(fixture, { promotion = true, mutate = null, policy = BATCH_POLICY, publicKeys = PUBLIC_KEYS } = {}) {
  clearPromotionChainCache();
  const responses = structuredClone(fixture.responses);
  if (mutate) mutate(responses, fixture);
  const api = fakeApi(responses);
  const chain = await loadPromotionChain({
    api,
    repository: REPO,
    mainSha: fixture.M,
    developSha: promotion ? null : fixture.D,
    promotionHeadSha: promotion ? fixture.P : null,
    publicKeys,
    policy,
  });
  return { chain, api };
}

async function expectReason(reasonCode, options, message) {
  const { chain } = await run(options.fixture || world(), options);
  assert.equal(chain.ok, false, `${message}: expected a failure`);
  assert.equal(chain.reasonCode, reasonCode, `${message}: ${chain.summary}`);
  assert.ok(CHAIN_REASON_CODES.includes(chain.reasonCode), `${reasonCode} is a documented reason code`);
  return chain;
}

function attestedRecord(responses, pr, index) {
  const comment = responses[`${ROOT}/issues/${pr}/comments`].find((item) => item.id === pr * 10 + index);
  return JSON.parse(comment.body.slice(comment.body.indexOf("```json") + 7, comment.body.lastIndexOf("```")));
}

// Re-publishes a PR's gate PASS for its current attested risk, as the gate would after the re-review.
function repass(responses, pr) {
  const { head, base } = responses[`${ROOT}/pulls/${pr}`];
  const pass = responses[`${ROOT}/commits/${head.sha}/statuses`].find((status) => status.state === "success" && status.context === ENFORCEMENT_CONTEXT);
  pass.description = `PASS ${gatePassFingerprint({ headSha: head.sha, baseSha: base.sha, risk: attestedRecord(responses, pr, 0).risk })}`;
}

function resignComment(responses, pr, index, key, overrides) {
  const path = `${ROOT}/issues/${pr}/comments`;
  const comment = responses[path].find((item) => item.id === pr * 10 + index);
  const current = JSON.parse(comment.body.slice(comment.body.indexOf("```json") + 7, comment.body.lastIndexOf("```")));
  const { signature: _signature, ...unsigned } = current;
  const next = { ...unsigned, ...overrides };
  next.signature = sign(null, Buffer.from(canonicalJson(next)), key.privateKey).toString("base64");
  Object.assign(comment, carrier(next, comment.id));
}

// ---- The constants stay equal to the gate's own ----------------------------------------------------
assert.equal(ATTESTATION_MARKER, gate.ATTESTATION_MARKER, "the chain parses the gate's attestation carriers");
assert.equal(ENFORCEMENT_CONTEXT, gate.ENFORCEMENT_CONTEXT, "the chain reads the gate's authorization status");
assert.equal(GATE_CHECK_CONTEXT, gate.REQUIRED_CONTEXT, "the chain recomputes the gate's PASS for its check context");

// ---- verifyAttestationRecord: record-only verification, verifyAttestation unchanged -------------
{
  const state = {
    repositoryId: REPO_ID,
    pr: 7,
    headSha: hex("h7"),
    baseSha: hex("b7"),
    stateEpoch: { event_id: 1, event_created_at: "2026-09-27T10:00:00Z" },
    labelsSha256: gate.relevantLabelsDigest(["ready-for-gate"]).sha256,
    risk: classifyRisk([file("README.md", "readme")]),
    ci: [{ name: "Smoke Tests", head_sha: hex("h7"), conclusion: "success", completed_at: "2026-09-27T10:01:00Z" }],
    reviewedAt: "2026-09-27T10:02:00Z",
  };
  const record = signedRecord(PRIMARY, state);
  assert.deepEqual(verifyAttestationRecord(record, PUBLIC_KEYS), { ok: true, reasonCode: "VALID_ATTESTATION_RECORD", record });
  assert.equal(verifyAttestationRecord({ ...record, clinical_analysis: "changed" }, PUBLIC_KEYS).reasonCode, "INVALID_SIGNATURE");
  assert.equal(verifyAttestationRecord(record, {}).reasonCode, "JUDGE_IDENTITY_MISMATCH");
  assert.equal(verifyAttestationRecord({ ...record, schema: "other" }, PUBLIC_KEYS).reasonCode, "MALFORMED_ATTESTATION");
  assert.equal(verifyAttestationRecord({ ...record, ci_sha256: hex64("x") }, PUBLIC_KEYS).reasonCode, "MALFORMED_ATTESTATION");
  const exact = {
    repositoryId: REPO_ID,
    pr: 7,
    headSha: state.headSha,
    baseSha: state.baseSha,
    baseRef: "develop",
    stateEpoch: state.stateEpoch,
    labelsSha256: state.labelsSha256,
    risk: state.risk,
    ci: state.ci,
    ciSha256: digest(state.ci),
  };
  assert.equal(verifyAttestation(record, PUBLIC_KEYS, exact).reasonCode, "VALID_ATTESTATION", "live verification is unchanged");
  assert.equal(
    verifyAttestation(record, PUBLIC_KEYS, { ...exact, stateEpoch: { event_id: 2, event_created_at: "2026-09-28T00:00:00Z" } }).reasonCode,
    "ATTESTATION_STATE_MISMATCH",
    "a merged PR's moved epoch fails live verification, which is why the chain verifies records only",
  );
  assert.equal(verifyAttestationRecord(record, PUBLIC_KEYS).ok, true, "the same record still verifies as a record");
}

// ---- Pure helpers ----------------------------------------------------------------------------------
{
  const optional = ["release-remediation", "release-urgent", "promotion-full-review"];
  for (let mask = 0; mask < 8; mask += 1) {
    const chosen = optional.filter((_, index) => mask & (2 ** index));
    const decoded = decodeAttestedLabels(gate.relevantLabelsDigest(["ready-for-gate", ...chosen, "promotion", "unrelated"]).sha256);
    assert.ok(decoded, `labels ${chosen.join(",") || "(none)"} decode`);
    assert.equal(decoded.remediation, chosen.includes("release-remediation"));
    assert.equal(decoded.urgent, chosen.includes("release-urgent"));
    assert.equal(decoded.fullReview, chosen.includes("promotion-full-review"));
  }
  assert.equal(decodeAttestedLabels(gate.relevantLabelsDigest(["ready-for-gate", "gate-hold"]).sha256), null, "a hold label is not PASS-eligible");
  assert.equal(decodeAttestedLabels(gate.relevantLabelsDigest([]).sha256), null, "ready-for-gate is required");
  assert.equal(decodeAttestedLabels("not a digest"), null);

  assert.equal(riskDomain(["CLINICAL_RUNTIME_CHANGE", "EXPLICIT_HIGH_RISK"]), "clinical");
  assert.equal(riskDomain(["RELEASE_CONTROL_CHANGE", "EXPLICIT_HIGH_RISK"]), "release-control");
  assert.equal(riskDomain(["EXPLICIT_HIGH_RISK"]), "neutral");
  assert.equal(riskDomain(["NO_HIGH_RISK_CHANGE"]), "neutral");
  assert.deepEqual(riskDomains(["RELEASE_CONTROL_CHANGE", "CLINICAL_EVIDENCE_CHANGE"]), ["clinical", "release-control"]);
  assert.deepEqual(riskDomains(["EXPLICIT_HIGH_RISK"]), []);
  assert.deepEqual(riskDomains(null), []);

  const promotionPr = {
    baseRef: "main",
    headRef: "release/promote-484c9ee59ce2-6d7f8d95a462",
    headRepoFullName: REPO,
    repositoryFullName: REPO,
  };
  assert.equal(isPromotionPr(promotionPr), true);
  assert.equal(isPromotionPr({ ...promotionPr, baseRef: "develop" }), false, "only PRs to main promote");
  assert.equal(isPromotionPr({ ...promotionPr, headRef: "hotfix/live-outage" }), false, "hotfixes to main are not promotions");
  assert.equal(isPromotionPr({ ...promotionPr, headRepoFullName: "someone/Radulator" }), false, "fork heads are never promotions");
  assert.equal(isPromotionPr({ ...promotionPr, headRepoFullName: null }), false, "a deleted head repository is not a promotion");
}

// ---- The happy path: a verified promotion with main drift ------------------------------------------
const baseline = world();
{
  const { chain, api } = await run(baseline);
  assert.equal(chain.schema, PROMOTION_CHAIN_SCHEMA);
  assert.equal(chain.ok, true, chain.summary);
  assert.equal(chain.reasonCode, "CHAIN_VERIFIED");
  assert.equal(chain.M, baseline.M);
  assert.equal(chain.D, baseline.D, "D is the promotion head's second parent");
  assert.equal(chain.S0, baseline.S0);
  assert.equal(chain.P, baseline.P);
  assert.deepEqual(chain.entries.map((entry) => entry.pr), [101, 102]);
  assert.deepEqual(chain.entries.map((entry) => entry.remediation), [false, true]);
  assert.deepEqual(chain.entries.map((entry) => entry.domain), ["clinical", "clinical"]);
  assert.deepEqual(chain.entries[0].roles.map((role) => role.role), ["primary", "verification"]);
  assert.deepEqual(chain.entries[0].attestationCommentIds, [1010, 1011]);
  assert.equal(chain.entries[0].gateAuthorizationStatusId, 1012, "the latest pre-merge authorization, not the post-merge failure");
  assert.equal(chain.entries[0].base, baseline.S0);
  assert.equal(chain.entries[1].base, baseline.heads[101].squash);
  assert.deepEqual(chain.counts, {
    commits: 2,
    prs: 2,
    nonRemediation: 1,
    remediation: 1,
    urgent: 0,
    highRiskClinical: 1,
    domains: { clinical: 2, "release-control": 0, neutral: 0 },
  });
  assert.equal(chain.domain, "clinical");
  assert.deepEqual(chain.overlappingFiles, ["src/components/calculators/NIRADS.jsx"]);
  assert.deepEqual(
    chain.integrationMergedPaths,
    ["docs/verification/calculator-inventory.json"],
    "a path main changed to a different blob is a three-way merge for full review; a converged path is not",
  );
  assert.equal(chain.firstMergedAt, baseline.responses[`${ROOT}/pulls/101`].merged_at);
  const { digest: recorded, ...unsigned } = chain;
  assert.equal(recorded, digest(unsigned), "the digest covers the whole result");
  const again = await run(baseline);
  assert.equal(again.chain.digest, chain.digest, "the digest is stable for the same history");
  assert.ok(api.calls.every((path) => path.startsWith(ROOT)), "the loader reads only this repository");
  assert.ok(api.calls.every((path) => !/\/(merge|update-branch|labels)\b/.test(path)), "the loader only reads");

  const summary = summarizePromotionChain(chain);
  assert.equal(summary.ok, true);
  assert.equal(summary.digest, chain.digest);
  assert.deepEqual(summary.prs.map((entry) => entry.pr), [101, 102]);
  assert.deepEqual(summary.integrationMergedPaths, { count: 1, items: ["docs/verification/calculator-inventory.json"] });
  assert.equal(summarizePromotionChain(null).reasonCode, "CHAIN_EVIDENCE_UNAVAILABLE");

  assert.equal(promotionReviewMode(chain, ["ready-for-gate", "promotion"]), "batch");
  assert.equal(promotionReviewMode(chain, ["ready-for-gate", "promotion-full-review"]), "full", "the escape label forces a full review");
  assert.equal(promotionReviewMode({ ...chain, ok: false }, []), "full");
  assert.equal(promotionReviewMode(null, []), "full", "a missing chain is a full review");

  // Codex on #317: the binding a promotion attestation signs is the review mode plus the chain it came from.
  assert.deepEqual(promotionReviewBinding(chain, ["ready-for-gate"]), { mode: "batch", promotion_chain_sha256: chain.digest });
  assert.deepEqual(promotionReviewBinding(chain, ["promotion-full-review"]), { mode: "full", promotion_chain_sha256: chain.digest });
  assert.deepEqual(promotionReviewBinding({ ...chain, ok: false }), { mode: "full", promotion_chain_sha256: chain.digest });
  assert.deepEqual(promotionReviewBinding(null), { mode: "full", promotion_chain_sha256: null });
  assert.deepEqual(promotionReviewBinding({ ...chain, digest: "not-a-digest" }), { mode: "full", promotion_chain_sha256: null },
    "batch review needs a chain digest to bind");
  const promotionPr = {
    baseRef: "main",
    headRef: "release/promote-484c9ee59ce2-6d7f8d95a462",
    headRepoFullName: REPO,
    repositoryFullName: REPO,
    labels: ["ready-for-gate"],
  };
  assert.deepEqual(promotionExactStateReview(promotionPr, chain), { review: { mode: "batch", promotion_chain_sha256: chain.digest } });
  assert.deepEqual(promotionExactStateReview({ ...promotionPr, baseRef: "develop" }, chain), {}, "other PRs carry no binding");
}

// Range mode (the controller and promoter): no promotion head, no content step.
{
  const fixture = world({ promotion: false });
  const { chain } = await run(fixture, { promotion: false });
  assert.equal(chain.ok, true, chain.summary);
  assert.equal(chain.P, null);
  assert.deepEqual(chain.integrationMergedPaths, []);
}

// The loader is memoized per (M, D, P) and never re-reads within a process.
{
  clearPromotionChainCache();
  const api = fakeApi(baseline.responses);
  const options = { repository: REPO, mainSha: baseline.M, promotionHeadSha: baseline.P };
  const first = await loadPromotionChainFacts(api, options);
  const count = api.calls.length;
  const second = await loadPromotionChainFacts(api, options);
  assert.equal(second, first, "the same facts object is returned");
  assert.equal(api.calls.length, count, "no second round of requests");
  const chainA = await loadPromotionChain({ api, repository: REPO, mainSha: baseline.M, promotionHeadSha: baseline.P, publicKeys: PUBLIC_KEYS });
  const chainB = await loadPromotionChain({ api, repository: REPO, mainSha: baseline.M, promotionHeadSha: baseline.P, publicKeys: PUBLIC_KEYS });
  assert.equal(chainA, chainB);
  assert.equal(api.calls.length, count);
  await assert.rejects(loadPromotionChainFacts(api, { repository: REPO, mainSha: "bad" }), /malformed/);
  await assert.rejects(loadPromotionChainFacts({}, options), /incomplete/);
}

// Evidence that cannot be loaded is a not-ok chain, memoized so repeated loads agree.
{
  clearPromotionChainCache();
  const api = fakeApi({});
  const first = await loadPromotionChain({ api, repository: REPO, mainSha: baseline.M, promotionHeadSha: baseline.P, publicKeys: PUBLIC_KEYS });
  assert.equal(first.ok, false);
  assert.equal(first.reasonCode, "CHAIN_EVIDENCE_UNAVAILABLE");
  assert.match(first.summary, /404/);
  const calls = api.calls.length;
  const second = await loadPromotionChain({ api, repository: REPO, mainSha: baseline.M, promotionHeadSha: baseline.P, publicKeys: PUBLIC_KEYS });
  assert.equal(second.digest, first.digest);
  assert.equal(api.calls.length, calls, "a failed load is not retried within the process");
  const unavailable = unavailablePromotionChain({ repository: REPO, mainSha: baseline.M, promotionHeadSha: baseline.P, error: new Error("boom") });
  assert.equal(unavailable.reasonCode, "CHAIN_EVIDENCE_UNAVAILABLE");
  const { digest: unavailableDigest, ...unavailableRest } = unavailable;
  assert.equal(unavailableDigest, digest(unavailableRest));
}

// ---- Step 1 and 3: the range -------------------------------------------------------------------------
await expectReason("NOTHING_TO_RELEASE", {
  promotion: false,
  fixture: world({ promotion: false }),
  mutate(responses, fixture) {
    Object.assign(responses[`${ROOT}/compare/${fixture.M}...${fixture.D}`], { ahead_by: 0, commits: [], status: "behind" });
  },
}, "develop already released");
await expectReason("CHAIN_TOO_LARGE", {
  mutate(responses, fixture) {
    responses[`${ROOT}/compare/${fixture.M}...${fixture.D}`].ahead_by = BATCH_POLICY.maxChainCommits + 1;
  },
}, "a range beyond the loader bound");
await expectReason("CHAIN_TOO_LARGE", {
  mutate(responses, fixture) {
    responses[`${ROOT}/compare/${fixture.M}...${fixture.D}`].commits.pop();
  },
}, "a comparison that lists fewer commits than ahead_by");
await expectReason("CHAIN_EVIDENCE_UNAVAILABLE", {
  mutate(responses, fixture) {
    responses[`${ROOT}/compare/${fixture.M}...${fixture.D}`].merge_base_commit.sha = "not-a-sha";
  },
}, "a malformed merge base");

await expectReason("CHAIN_NOT_LINEAR", {
  mutate(responses, fixture) {
    const range = responses[`${ROOT}/compare/${fixture.M}...${fixture.D}`];
    range.commits = range.commits.slice(0, 1);
    range.ahead_by = 1;
  },
}, "a verified chain that stops short of the develop head");

// ---- Step 2a-e: each commit -------------------------------------------------------------------------
await expectReason("CHAIN_NOT_LINEAR", {
  mutate(responses, fixture) {
    responses[`${ROOT}/compare/${fixture.M}...${fixture.D}`].commits[1].parents.push({ sha: hex("main-back-merge") });
  },
}, "a merge commit inside develop");
await expectReason("CHAIN_NOT_LINEAR", {
  mutate(responses, fixture) {
    responses[`${ROOT}/compare/${fixture.M}...${fixture.D}`].commits[0].parents = [{ sha: hex("elsewhere") }];
  },
}, "a first commit that does not start at the merge base");
await expectReason("CHAIN_NOT_LINEAR", {
  mutate(responses, fixture) {
    const range = responses[`${ROOT}/compare/${fixture.M}...${fixture.D}`];
    range.commits.reverse();
  },
}, "commits listed out of parent order");
for (const [label, mutateCommit] of [
  ["an unsigned squash", (commit) => { commit.commit.verification.verified = false; }],
  ["a squash committed by a person", (commit) => { commit.committer.login = "someone"; }],
  ["a manual merge title", (commit) => { commit.commit.message = "Merge pull request #101 from feature"; }],
  ["a title with a suffix", (commit) => { commit.commit.message = "PR #101: exact-head clinical gate passed (manual)"; }],
]) {
  await expectReason("CHAIN_COMMIT_NOT_CONTROLLER_MERGE", {
    mutate(responses, fixture) {
      mutateCommit(responses[`${ROOT}/compare/${fixture.M}...${fixture.D}`].commits[0]);
    },
  }, label);
}
// Codex on #317: a person who squash-merges with the controller's title gets the same title, web-flow committer and
// GitHub signature, so only GitHub's own merged_by record tells the controller's merge apart.
for (const [label, mergedBy] of [
  ["a maintainer's squash merge with the controller's title", { login: "momomojo", id: 12345, type: "User" }],
  ["a merger with the bot's login but another account id", { login: "github-actions[bot]", id: 5, type: "Bot" }],
  ["a merge with no recorded merger", null],
]) {
  const chain = await expectReason("CHAIN_COMMIT_NOT_CONTROLLER_MERGE", {
    mutate(responses) {
      responses[`${ROOT}/pulls/102`].merged_by = mergedBy;
    },
  }, label);
  assert.equal(chain.failure.pr, 102, `${label}: the failure names the PR`);
  assert.match(chain.summary, /not the trusted controller/);
}
for (const [label, mutatePr] of [
  ["an unmerged PR", (pr) => { pr.merged = false; }],
  ["a PR merged into main", (pr) => { pr.base.ref = "main"; }],
  ["a different merge commit", (pr) => { pr.merge_commit_sha = hex("other-merge"); }],
  ["a stale PR base", (pr) => { pr.base.sha = hex("stale-base"); }],
  ["another repository", (pr) => { pr.base.repo.full_name = "someone/Radulator"; }],
  ["a missing merge time", (pr) => { pr.merged_at = null; }],
]) {
  await expectReason("CHAIN_PR_MISMATCH", {
    mutate(responses) {
      mutatePr(responses[`${ROOT}/pulls/102`]);
    },
  }, label);
}
await expectReason("CHAIN_TREE_MISMATCH", {
  mutate(responses, fixture) {
    responses[`${ROOT}/git/commits/${fixture.heads[101].head}`].tree.sha = hex("different-tree");
  },
}, "a squash whose tree is not the attested head tree");
await expectReason("CHAIN_TREE_MISMATCH", {
  mutate(responses, fixture) {
    responses[`${ROOT}/git/commits/${fixture.heads[101].head}`].sha = hex("another-commit-with-the-same-tree");
  },
}, "a head-commit readback for another commit");
for (const [label, change] of [
  ["a head behind its base", { status: "diverged", behind_by: 1 }],
  ["an inconsistent comparison that is ahead yet behind", { status: "ahead", behind_by: 1 }],
  ["a head compared from another base", { merge_base_commit: { sha: hex("older-base") } }],
]) {
  await expectReason("CHAIN_HEAD_NOT_UP_TO_DATE", {
    mutate(responses, fixture) {
      Object.assign(responses[`${ROOT}/compare/${fixture.S0}...${fixture.heads[101].head}`], change);
    },
  }, label);
}

// ---- Step 2g: attestations ------------------------------------------------------------------------
for (const [label, mutate] of [
  ["no carriers", (responses) => { responses[`${ROOT}/issues/101/comments`] = []; }],
  ["a tampered verification PASS", (responses) => {
    const comment = responses[`${ROOT}/issues/101/comments`].find((item) => item.id === 1011);
    comment.body = comment.body.replace("Exact diff and primary sources support release.", "Edited after signing.");
  }],
  ["a verification PASS from an unconfigured key", (responses) => {
    resignComment(responses, 101, 1, VERIFICATION, { judge: { key_id: "retired-key", role: "verification", profile: "default", model: "m", provider: "p" } });
  }],
  ["a verification PASS dated after the merge", (responses) => {
    resignComment(responses, 101, 1, VERIFICATION, { reviewed_at: "2026-09-27T10:05:30Z" });
  }],
  ["a verification PASS older than the CI evidence", (responses) => {
    resignComment(responses, 101, 1, VERIFICATION, { reviewed_at: "2026-09-27T10:00:30Z" });
  }],
  ["a required-role NEEDS_FIX in the same state", (responses) => {
    const comments = responses[`${ROOT}/issues/101/comments`];
    const current = comments.find((item) => item.id === 1011);
    const record = JSON.parse(current.body.slice(current.body.indexOf("```json") + 7, current.body.lastIndexOf("```")));
    const { signature: _signature, ...unsigned } = record;
    const needsFix = { ...unsigned, verdict: "NEEDS_FIX", clinical_analysis: "The threshold is unsourced.", reviewed_at: "2026-09-27T10:03:30Z" };
    needsFix.signature = sign(null, Buffer.from(canonicalJson(needsFix)), VERIFICATION.privateKey).toString("base64");
    comments.push(carrier(needsFix, 1015));
  }],
  ["high risk approved by one profile twice", (responses) => {
    resignComment(responses, 101, 1, SAME_PROFILE_VERIFICATION, {
      judge: { key_id: SAME_PROFILE_VERIFICATION.keyId, role: "verification", profile: "radulator", model: "m", provider: "p" },
    });
  }],
  ["a PASS bound to another base", (responses) => {
    resignComment(responses, 101, 1, VERIFICATION, { base_sha: hex("other-base") });
  }],
]) {
  await expectReason("CHAIN_ATTESTATION_MISSING", { mutate }, label);
}
{
  // A second, later valid quorum for another exact state (for example after a label change) is fine,
  // and the verified entry reports the newest one.
  const { chain } = await run(baseline, {
    mutate(responses) {
      const comments = responses[`${ROOT}/issues/101/comments`];
      for (const [index, key, at] of [[0, PRIMARY, "2026-09-27T10:03:10Z"], [1, VERIFICATION, "2026-09-27T10:03:20Z"]]) {
        const current = comments.find((item) => item.id === 1010 + index);
        const record = JSON.parse(current.body.slice(current.body.indexOf("```json") + 7, current.body.lastIndexOf("```")));
        const { signature: _signature, ...unsigned } = record;
        const next = { ...unsigned, state_epoch: { event_id: 999, event_created_at: "2026-09-27T10:02:30Z" }, reviewed_at: at };
        next.signature = sign(null, Buffer.from(canonicalJson(next)), key.privateKey).toString("base64");
        comments.push(carrier(next, 1020 + index));
      }
    },
  });
  assert.equal(chain.ok, true, chain.summary);
  assert.deepEqual(chain.entries[0].attestationCommentIds, [1020, 1021]);
}

// ---- Step 2h: CI -------------------------------------------------------------------------------------
for (const [label, mutateCi] of [
  ["CI from another head", (ci) => { ci[0].head_sha = hex("other-head"); }],
  ["a failed attested check", (ci) => { ci[1].conclusion = "failure"; }],
  ["high risk without Full Test Suite", (ci) => { ci.pop(); }],
]) {
  await expectReason("CHAIN_CI_NOT_EXACT", {
    mutate(responses, fixture) {
      const comments = responses[`${ROOT}/issues/101/comments`];
      for (const [index, key] of [[0, PRIMARY], [1, VERIFICATION]]) {
        const current = comments.find((item) => item.id === 1010 + index);
        const record = JSON.parse(current.body.slice(current.body.indexOf("```json") + 7, current.body.lastIndexOf("```")));
        const { signature: _signature, ...unsigned } = record;
        const ci = structuredClone(unsigned.ci);
        mutateCi(ci, fixture);
        const next = { ...unsigned, ci, ci_sha256: digest(ci) };
        next.signature = sign(null, Buffer.from(canonicalJson(next)), key.privateKey).toString("base64");
        Object.assign(current, carrier(next, current.id));
      }
    },
  }, label);
}

// ---- Step 2j: risk -----------------------------------------------------------------------------------
{
  // The attestation recorded standard risk for a non-semantic clinical-document edit; with patches
  // withheld the chain classifies the landed diff conservatively as high and fails closed.
  const docsOnly = world({
    entries: [entrySpec(201, {
      files: [file("docs/calculators/neuroradiology/nirads.md", "doc-201", { patch: "@@ -1 +1 @@\n-Overview\n+Overview." })],
    })],
    developFiles: [file("docs/calculators/neuroradiology/nirads.md", "doc-201")],
    mainDriftFiles: [],
    promotionFiles: [file("docs/calculators/neuroradiology/nirads.md", "doc-201")],
  });
  await expectReason("CHAIN_RISK_UNDERSTATED", { fixture: docsOnly }, "a standard-risk attestation for a clinical path");
  const tooLarge = await expectReason("CHAIN_TOO_LARGE", {
    mutate(responses, fixture) {
      const compare = responses[`${ROOT}/compare/${fixture.S0}...${fixture.heads[101].head}`];
      compare.files = Array.from({ length: BATCH_POLICY.maxCompareFiles }, (_, index) => withoutPatch([file(`docs/notes/${index}.md`, `n-${index}`)])[0]);
    },
  }, "a PR diff at the comparison file cap");
  assert.equal(tooLarge.failure.pr, 101);
}

// ---- Step 2k: labels ---------------------------------------------------------------------------------
await expectReason("CHAIN_LABELS_UNDECODABLE", {
  mutate(responses) {
    const labelsSha256 = gate.relevantLabelsDigest(["ready-for-gate", "do-not-merge"]).sha256;
    resignComment(responses, 101, 0, PRIMARY, { labels_sha256: labelsSha256 });
    resignComment(responses, 101, 1, VERIFICATION, { labels_sha256: labelsSha256 });
  },
}, "an attested label set that could never pass the gate");

// ---- Step 2f and 2i: gate authorization ---------------------------------------------------------------------
for (const [label, mutateStatuses] of [
  ["no authorization status", (statuses) => statuses.splice(0)],
  ["a revoked authorization before the merge", (statuses) => statuses.push({
    id: 1099,
    state: "failure",
    context: ENFORCEMENT_CONTEXT,
    description: `POST_PUBLISH_STATE_CHANGE ${hex64("revoked")}`,
    created_at: "2026-09-27T10:04:30Z",
    creator: { id: 41898282, login: "github-actions[bot]" },
  })],
  ["a PASS status from another account", (statuses) => {
    statuses.find((status) => status.state === "success").creator = { id: 5, login: "someone" };
  }],
  ["a PASS status whose creator id is not GitHub Actions", (statuses) => {
    statuses.find((status) => status.state === "success").creator = { id: 5, login: "github-actions[bot]" };
  }],
  ["a success status without a PASS fingerprint", (statuses) => {
    statuses.find((status) => status.state === "success").description = "PASS";
  }],
  ["a PASS status set only after the merge", (statuses) => {
    statuses.find((status) => status.state === "success").created_at = "2026-09-27T10:05:30Z";
  }],
]) {
  await expectReason("CHAIN_GATE_AUTHORIZATION_MISSING", {
    mutate(responses, fixture) {
      mutateStatuses(responses[`${ROOT}/commits/${fixture.heads[101].head}/statuses`]);
    },
  }, label);
}
// Primary judge on #317 (82a3b65): the PASS must be the gate's fingerprint for an attested state. The fingerprint does
// not cover labels, so when the states it matches disagree on the release flags the chain fails closed.
assert.equal(
  baseline.responses[`${ROOT}/commits/${baseline.heads[101].head}/statuses`].find((status) => status.state === "success").description,
  `PASS ${gatePassFingerprint({
    headSha: baseline.heads[101].head,
    baseSha: baseline.S0,
    risk: attestedRecord(baseline.responses, 101, 0).risk,
  })}`,
  "the fixture publishes the gate's real PASS fingerprint",
);
for (const [label, fingerprint] of [
  ["a PASS fingerprint that belongs to no attested state", () => hex64("another-state")],
  ["the PASS of another risk classification of the same head", (responses, fixture) => gatePassFingerprint({
    headSha: fixture.heads[101].head,
    baseSha: fixture.S0,
    risk: { ...attestedRecord(responses, 101, 0).risk, tier: "standard" },
  })],
]) {
  const chain = await expectReason("CHAIN_GATE_AUTHORIZATION_MISSING", {
    mutate(responses, fixture) {
      const pass = responses[`${ROOT}/commits/${fixture.heads[101].head}/statuses`].find((status) => status.state === "success");
      pass.description = `PASS ${fingerprint(responses, fixture)}`;
    },
  }, label);
  assert.match(chain.summary, /matches no attested state/);
}
{
  // #101's fixture: epoch 10:00, quorum 10:02/10:03, gate PASS 10:04, merge 10:05. A second state signs a second
  // quorum (same head, risk and CI) with other labels; its epoch and review times decide which state the PASS is for.
  const otherState = (labels, { epochAt, eventId = 999, reviewedAt, replace = false }) => (responses) => {
    const comments = responses[`${ROOT}/issues/101/comments`];
    for (const [index, key, at] of [[0, PRIMARY, reviewedAt[0]], [1, VERIFICATION, reviewedAt[1]]]) {
      const { signature: _signature, ...unsigned } = attestedRecord(responses, 101, index);
      const next = {
        ...unsigned,
        labels_sha256: gate.relevantLabelsDigest(labels).sha256,
        state_epoch: { event_id: eventId, event_created_at: epochAt },
        reviewed_at: at,
      };
      next.signature = sign(null, Buffer.from(canonicalJson(next)), key.privateKey).toString("base64");
      if (replace) Object.assign(comments.find((item) => item.id === 1010 + index), carrier(next, 1010 + index));
      else comments.push(carrier(next, 1020 + index));
    }
  };
  const remediation = ["ready-for-gate", "release-remediation"];
  // The label changed before the PASS (as on real #245): the PASS is for the newer, remediation state.
  const { chain: relabelled } = await run(baseline, {
    mutate: otherState(remediation, { epochAt: "2026-09-27T10:02:30Z", reviewedAt: ["2026-09-27T10:03:10Z", "2026-09-27T10:03:20Z"] }),
  });
  assert.equal(relabelled.ok, true, relabelled.summary);
  assert.deepEqual(relabelled.entries[0].attestationCommentIds, [1020, 1021]);
  assert.equal(relabelled.entries[0].remediation, true, "the state current at the PASS sets the release flags");
  // The judge's vector: a remediation state signed after the PASS (but before the merge) is not what the PASS
  // authorized, although its records are the newest. The chain keeps the PASS's state (the old code took the newest).
  const { chain: afterPass } = await run(baseline, {
    mutate: otherState(remediation, { epochAt: "2026-09-27T10:04:30Z", reviewedAt: ["2026-09-27T10:04:40Z", "2026-09-27T10:04:50Z"] }),
  });
  assert.equal(afterPass.ok, true, afterPass.summary);
  assert.deepEqual(afterPass.entries[0].attestationCommentIds, [1010, 1011], "the state the PASS authorized is used");
  assert.equal(afterPass.entries[0].remediation, false, "a later remediation label cannot change the accounting");
  // Two states with one epoch but different release labels: the PASS cannot tell them apart.
  const ambiguous = await expectReason("CHAIN_GATE_STATE_AMBIGUOUS", {
    mutate: otherState(remediation, {
      epochAt: "2026-09-27T10:00:00Z",
      eventId: 707,
      reviewedAt: ["2026-09-27T10:03:10Z", "2026-09-27T10:03:20Z"],
    }),
  }, "one epoch attested with two release-label sets");
  assert.equal(ambiguous.failure.pr, 101);
  await expectReason("CHAIN_GATE_STATE_AMBIGUOUS", {
    mutate: otherState(["ready-for-gate", "release-urgent"], {
      epochAt: "2026-09-27T10:00:00Z",
      eventId: 707,
      reviewedAt: ["2026-09-27T10:03:10Z", "2026-09-27T10:03:20Z"],
    }),
  }, "one epoch attested with and without release-urgent");
  // Same epoch, same release flags: not ambiguous.
  const { chain: sameFlags } = await run(baseline, {
    mutate: otherState(["ready-for-gate", "promotion-full-review"], {
      epochAt: "2026-09-27T10:00:00Z",
      eventId: 707,
      reviewedAt: ["2026-09-27T10:03:10Z", "2026-09-27T10:03:20Z"],
    }),
  });
  assert.equal(sameFlags.ok, true, sameFlags.summary);
  // Every attested state is newer than the PASS: nothing the PASS could have authorized.
  const tooLate = await expectReason("CHAIN_ATTESTATION_MISSING", {
    mutate: otherState(["ready-for-gate"], {
      epochAt: "2026-09-27T10:04:20Z",
      reviewedAt: ["2026-09-27T10:04:30Z", "2026-09-27T10:04:40Z"],
      replace: true,
    }),
  }, "attested states that all postdate the gate PASS");
  assert.match(tooLate.summary, /existed before its gate PASS/);

  // Primary judge on #317 (896fbce): the quorum must have existed, unedited, when the gate published its PASS.
  // (1) The only quorum, for the PASS's own pre-PASS epoch, was reviewed and posted after the PASS.
  await expectReason("CHAIN_ATTESTATION_MISSING", {
    mutate: otherState(["ready-for-gate"], {
      epochAt: "2026-09-27T10:00:00Z",
      eventId: 707,
      reviewedAt: ["2026-09-27T10:04:20Z", "2026-09-27T10:04:30Z"],
      replace: true,
    }),
  }, "a pre-PASS epoch whose only quorum was reviewed after the PASS");
  // (1b) A record signed with a backdated reviewed_at, in a comment posted after the PASS.
  await expectReason("CHAIN_ATTESTATION_MISSING", {
    mutate(responses) {
      const comment = responses[`${ROOT}/issues/101/comments`].find((item) => item.id === 1011);
      comment.created_at = "2026-09-27T10:04:30Z";
      comment.updated_at = "2026-09-27T10:04:30Z";
    },
  }, "a backdated verification PASS posted after the gate PASS");
  // (2) A comment that existed before the PASS, edited after it to carry a newly signed record.
  await expectReason("CHAIN_ATTESTATION_MISSING", {
    mutate(responses) {
      resignComment(responses, 101, 1, VERIFICATION, { clinical_analysis: "Re-signed after the gate PASS." });
      const comment = responses[`${ROOT}/issues/101/comments`].find((item) => item.id === 1011);
      comment.created_at = "2026-09-27T10:03:00Z";
      comment.updated_at = "2026-09-27T10:04:30Z";
    },
  }, "a pre-PASS comment edited after the PASS to carry a new signed record");
  // (3) Carrier times that are missing or malformed never count.
  for (const [label, change] of [
    ["a carrier without created_at", (comment) => { delete comment.created_at; }],
    ["a carrier without updated_at", (comment) => { comment.updated_at = null; }],
    ["a carrier with a malformed updated_at", (comment) => { comment.updated_at = "not a date"; }],
  ]) {
    await expectReason("CHAIN_ATTESTATION_MISSING", {
      mutate(responses) {
        change(responses[`${ROOT}/issues/101/comments`].find((item) => item.id === 1011));
      },
    }, label);
  }
  // A carrier posted before the PASS and edited only before it still counts.
  const { chain: editedEarly } = await run(baseline, {
    mutate(responses) {
      responses[`${ROOT}/issues/101/comments`].find((item) => item.id === 1011).updated_at = "2026-09-27T10:03:50Z";
    },
  });
  assert.equal(editedEarly.ok, true, editedEarly.summary);
}

// ---- Step 4: promotion content -----------------------------------------------------------------------
for (const [label, parents] of [
  ["swapped parents", (fixture) => [{ sha: fixture.D }, { sha: fixture.M }]],
  ["a single-parent promotion head", (fixture) => [{ sha: fixture.D }]],
  ["an octopus merge", (fixture) => [{ sha: fixture.M }, { sha: fixture.D }, { sha: hex("extra") }]],
  ["a merge of an older main", (fixture) => [{ sha: hex("old-main") }, { sha: fixture.D }]],
]) {
  await expectReason("PROMOTION_HEAD_NOT_EXACT_MERGE", {
    mutate(responses, fixture) {
      responses[`${ROOT}/git/commits/${fixture.P}`].parents = parents(fixture);
    },
  }, label);
}
{
  // An explicit develop head that is not the promotion's second parent is not an exact merge either.
  clearPromotionChainCache();
  const api = fakeApi(baseline.responses);
  const facts = await loadPromotionChainFacts(api, {
    repository: REPO,
    mainSha: baseline.M,
    developSha: baseline.heads[101].squash,
    promotionHeadSha: baseline.P,
  });
  const chain = verifyPromotionChain({ facts, publicKeys: PUBLIC_KEYS });
  assert.equal(chain.reasonCode, "PROMOTION_HEAD_NOT_EXACT_MERGE");
  // With an explicit develop head, a promotion merged onto another main commit is refused too.
  clearPromotionChainCache();
  const olderMain = structuredClone(baseline.responses);
  olderMain[`${ROOT}/git/commits/${baseline.P}`].parents = [{ sha: hex("old-main") }, { sha: baseline.D }];
  const explicit = await loadPromotionChainFacts(fakeApi(olderMain), {
    repository: REPO,
    mainSha: baseline.M,
    developSha: baseline.D,
    promotionHeadSha: baseline.P,
  });
  assert.equal(verifyPromotionChain({ facts: explicit, publicKeys: PUBLIC_KEYS }).reasonCode, "PROMOTION_HEAD_NOT_EXACT_MERGE");
}
await expectReason("PROMOTION_HEAD_NOT_EXACT_MERGE", {
  mutate(responses, fixture) {
    responses[`${ROOT}/compare/${fixture.M}...${fixture.P}`].merge_base_commit.sha = hex("elsewhere");
  },
}, "a promotion comparison that does not start at main");
await expectReason("PROMOTION_UNATTESTED_PATH", {
  mutate(responses, fixture) {
    responses[`${ROOT}/compare/${fixture.M}...${fixture.P}`].files.push(withoutPatch([file("src/App.jsx", "evil-merge")])[0]);
  },
}, "an evil merge that changes a main-only path");
await expectReason("PROMOTION_CONTENT_MISMATCH", {
  mutate(responses, fixture) {
    responses[`${ROOT}/compare/${fixture.M}...${fixture.P}`].files[0].sha = hex("nirads-edited-in-merge");
  },
}, "a promoted blob that is not develop's");
await expectReason("PROMOTION_CONTENT_MISMATCH", {
  mutate(responses, fixture) {
    responses[`${ROOT}/compare/${fixture.M}...${fixture.P}`].files.shift();
  },
}, "a promotion that drops a develop change");
{
  // A path main changed to a different blob is integration-merged and reported, not refused.
  const { chain } = await run(baseline, {
    mutate(responses, fixture) {
      responses[`${ROOT}/compare/${fixture.S0}...${fixture.M}`].files[2].sha = hex("spec-main");
      responses[`${ROOT}/compare/${fixture.M}...${fixture.P}`].files.push(withoutPatch([file("tests/e2e/calculators/neuroradiology/ni-rads.spec.js", "spec-merged")])[0]);
    },
  });
  assert.equal(chain.ok, true, chain.summary);
  assert.deepEqual(chain.integrationMergedPaths, [
    "docs/verification/calculator-inventory.json",
    "tests/e2e/calculators/neuroradiology/ni-rads.spec.js",
  ]);
}
{
  // Removed and renamed files: develop removes a fixture and renames a document.
  const removedAndRenamed = [
    file("tests/fixtures/old-vectors.json", "old-vectors", { status: "removed", additions: 0, deletions: 3, changes: 3, patch: undefined }),
    file("docs/guides/new-name.md", "renamed-doc", { status: "renamed", previous_filename: "docs/guides/old-name.md", additions: 0, deletions: 0, changes: 0, patch: undefined }),
  ];
  const specFiles = [file("src/components/calculators/NIRADS.jsx", "nirads-301"), ...removedAndRenamed];
  const fixture = world({
    entries: [entrySpec(301, { files: specFiles })],
    developFiles: specFiles,
    mainDriftFiles: [],
    promotionFiles: specFiles,
  });
  const { chain } = await run(fixture);
  assert.equal(chain.ok, true, chain.summary);
  assert.deepEqual(chain.entries[0].files, [
    "docs/guides/new-name.md",
    "docs/guides/old-name.md",
    "src/components/calculators/NIRADS.jsx",
    "tests/fixtures/old-vectors.json",
  ], "renames count both names for attribution");
  await expectReason("PROMOTION_CONTENT_MISMATCH", {
    fixture,
    mutate(responses) {
      responses[`${ROOT}/compare/${fixture.M}...${fixture.P}`].files = withoutPatch([specFiles[0], specFiles[2]]);
    },
  }, "a promotion that keeps a file develop removed");
  await expectReason("PROMOTION_CONTENT_MISMATCH", {
    fixture,
    mutate(responses) {
      responses[`${ROOT}/compare/${fixture.M}...${fixture.P}`].files = withoutPatch([
        specFiles[0],
        specFiles[1],
        file("docs/guides/new-name.md", "renamed-doc", { status: "added" }),
      ]);
    },
  }, "a promotion that copies instead of renaming");
  await expectReason("CHAIN_EVIDENCE_UNAVAILABLE", {
    fixture,
    mutate(responses) {
      responses[`${ROOT}/compare/${fixture.M}...${fixture.P}`].files[0].sha = null;
    },
  }, "a modified promoted entry without a blob identity");
  await expectReason("CHAIN_TOO_LARGE", {
    fixture,
    mutate(responses) {
      responses[`${ROOT}/compare/${fixture.S0}...${fixture.M}`].files = Array.from(
        { length: BATCH_POLICY.maxCompareFiles },
        (_, index) => withoutPatch([file(`src/generated/${index}.js`, `g-${index}`)])[0],
      );
    },
  }, "main drift at the comparison file cap");
}

// ---- Step 5: limits, domains, urgency ----------------------------------------------------------------
function batch(specs) {
  const files = specs.flatMap((spec) => spec.files);
  const unique = [...new Map(files.map((item) => [item.filename, item])).values()];
  return world({ entries: specs, developFiles: unique, mainDriftFiles: [], promotionFiles: unique });
}
const clinicalA = (pr, overrides = {}) => entrySpec(pr, { files: [file(`src/components/calculators/Calc${pr}.jsx`, `calc-${pr}`)], ...overrides });
const releaseControl = (pr, overrides = {}) => entrySpec(pr, {
  files: [file(`scripts/auto-merge-helper-${pr}.mjs`, `rc-${pr}`)],
  ...overrides,
});
const neutral = (pr, overrides = {}) => entrySpec(pr, {
  files: [file(`README-${pr}.md`, `readme-${pr}`, { patch: "@@ -1 +1 @@\n-a\n+b" })],
  ...overrides,
});
{
  const spread = (specs) => specs.map((spec, index) => ({ ...spec, start: minutes("2026-09-27T08:00:00Z", index * 30) }));
  const three = batch(spread([clinicalA(401), clinicalA(402), clinicalA(403)]));
  const exceeded = await expectReason("BATCH_BOUND_EXCEEDED", { fixture: three }, "three PRs over N=2");
  assert.equal(exceeded.entries.length, 3, "a limits failure still reports every verified entry");
  const { chain: wider } = await run(three, { policy: { ...BATCH_POLICY, maxPrs: 3, maxHighRiskClinical: 3 } });
  assert.equal(wider.ok, true, "the same batch passes a wider judged policy");
  assert.notEqual(wider.digest, (await run(three, { policy: { ...BATCH_POLICY, maxPrs: 4, maxHighRiskClinical: 4 } })).chain.digest,
    "the policy is bound into the digest");
  await expectReason("BATCH_BOUND_EXCEEDED", {
    fixture: three,
    policy: { ...BATCH_POLICY, maxPrs: 2, maxHighRiskClinical: 5 },
  }, "three PRs over N=2 with M not reached");
  await expectReason("BATCH_BOUND_EXCEEDED", {
    fixture: batch(spread([clinicalA(411), clinicalA(412)])),
    policy: { ...BATCH_POLICY, maxPrs: 4, maxHighRiskClinical: 1 },
  }, "two high-risk clinical PRs over M=1");
  // Primary judge on #317: maxAgeHours is enforced against the batch's own newest GitHub merged_at (deterministic,
  // already verified). Just inside, exactly at and just outside 24 h; an expired batch gets full review.
  const pair = (secondStart) => batch([
    clinicalA(431, { start: "2026-09-27T08:00:00Z" }),
    clinicalA(432, { start: secondStart }),
  ]);
  const { chain: inside } = await run(pair("2026-09-28T07:59:59Z"));
  assert.equal(inside.ok, true, `23:59:59 apart passes: ${inside.summary}`);
  const { chain: atLimit } = await run(pair("2026-09-28T08:00:00Z"));
  assert.equal(atLimit.ok, true, `exactly 24 h apart passes: ${atLimit.summary}`);
  const expired = await expectReason("BATCH_TOO_OLD", { fixture: pair("2026-09-28T08:00:01Z") }, "24 h + 1 s apart");
  assert.match(expired.summary, /merged 24\.00 h before its newest \(limit 24 h\)/);
  assert.equal(promotionReviewMode(expired), "full", "an expired batch never gets batch review");
  const { chain: widened } = await run(pair("2026-09-28T08:00:01Z"), { policy: { ...BATCH_POLICY, maxAgeHours: 25 } });
  assert.equal(widened.ok, true, "the bound follows the judged policy");
  const remediationTooOld = batch([
    clinicalA(441, { start: "2026-09-27T08:00:00Z" }),
    clinicalA(442, { start: "2026-09-28T09:00:00Z", labels: ["ready-for-gate", "release-remediation"] }),
  ]);
  await expectReason("BATCH_TOO_OLD", { fixture: remediationTooOld }, "remediation entries count toward the age too");
  const withRemediation = batch(spread([
    clinicalA(421),
    clinicalA(422),
    clinicalA(423, { labels: ["ready-for-gate", "release-remediation"] }),
  ]));
  const { chain: remediated } = await run(withRemediation);
  assert.equal(remediated.ok, true, "remediation PRs do not count toward N or M");
  assert.equal(remediated.counts.nonRemediation, 2);
  assert.equal(remediated.counts.remediation, 1);

  const mixed = await expectReason("BATCH_DOMAIN_MIXED", {
    fixture: batch(spread([clinicalA(431), releaseControl(432)])),
  }, "clinical and release-control PRs in one batch");
  assert.equal(mixed.domain, "mixed");
  // Primary judge on #317 (302d452): a PR whose own diff changes a clinical path and a release-control path is mixed
  // by itself, so it never gets batch review, alone or batched with a clinical PR (riskDomain alone would call it
  // clinical).
  const bothDomains = (pr) => entrySpec(pr, {
    files: [file(`src/components/calculators/Calc${pr}.jsx`, `calc-${pr}`), file(`scripts/auto-merge-helper-${pr}.mjs`, `rc-${pr}`)],
  });
  const alone = await expectReason("BATCH_DOMAIN_MIXED", { fixture: batch(spread([bothDomains(471)])) },
    "one PR that changes both trust domains");
  assert.equal(alone.domain, "mixed");
  assert.deepEqual(alone.entries[0].domains, ["clinical", "release-control"]);
  assert.equal(alone.entries[0].domain, "mixed");
  assert.deepEqual(alone.counts.domains, { clinical: 1, "release-control": 1, neutral: 0 });
  assert.equal(alone.counts.highRiskClinical, 1, "a two-domain high-risk PR still counts toward M");
  assert.match(alone.summary, /\(#471 changes both\)/);
  const withClinical = await expectReason("BATCH_DOMAIN_MIXED", { fixture: batch(spread([clinicalA(472), bothDomains(473)])) },
    "a two-domain PR batched with a clinical PR");
  assert.match(withClinical.summary, /\(#473 changes both\)/);
  assert.equal(promotionReviewMode(withClinical), "full");
  const { chain: withNeutral } = await run(batch(spread([releaseControl(441), neutral(442)])));
  assert.equal(withNeutral.ok, true, "a standard-risk neutral PR joins any batch");
  assert.equal(withNeutral.domain, "release-control");
  assert.deepEqual(withNeutral.entries.map((entry) => entry.tier), ["high", "standard"]);
  assert.deepEqual(withNeutral.entries[1].roles.map((role) => role.role), ["primary"], "standard risk needs only the primary PASS");

  await expectReason("BATCH_URGENT_NOT_SOLO", {
    fixture: batch(spread([clinicalA(451, { labels: ["ready-for-gate", "release-urgent"] }), neutral(452)])),
  }, "an urgent PR released with another PR");
  const { chain: soloUrgent } = await run(batch(spread([
    clinicalA(461, { labels: ["ready-for-gate", "release-urgent"] }),
    clinicalA(462, { labels: ["ready-for-gate", "release-remediation"] }),
  ])));
  assert.equal(soloUrgent.ok, true, "an urgent PR may release with remediation PRs");
  assert.equal(soloUrgent.counts.urgent, 1);
}

// ---- Step 2j again: recorded codes name every domain the landed diff has ----------------------------
{
  // Codex on #317: the batch's domain and high-risk clinical count come from the recorded reason codes, so a high-risk
  // attestation whose (older or incomplete) codes miss a domain the landed files have fails closed.
  const spread = (specs) => specs.map((spec, index) => ({ ...spec, start: minutes("2026-09-27T08:00:00Z", index * 30) }));
  const recode = (pr, reasonCodes) => (responses) => {
    for (const [index, key] of [[0, PRIMARY], [1, VERIFICATION]]) {
      const comment = responses[`${ROOT}/issues/${pr}/comments`].find((item) => item.id === pr * 10 + index);
      const { risk } = JSON.parse(comment.body.slice(comment.body.indexOf("```json") + 7, comment.body.lastIndexOf("```")));
      resignComment(responses, pr, index, key, { risk: { ...risk, reasonCodes: reasonCodes(risk.reasonCodes) } });
    }
    repass(responses, pr);
  };
  // Without the check, #511 counted as neutral and the batch with a release-control PR verified unmixed.
  const hiddenMix = await expectReason("CHAIN_RISK_UNDERSTATED", {
    fixture: batch(spread([clinicalA(511), releaseControl(512)])),
    mutate: recode(511, () => ["EXPLICIT_HIGH_RISK"]),
  }, "a clinical PR recorded with no clinical code, batched with a release-control PR");
  assert.equal(hiddenMix.failure.pr, 511);
  assert.match(hiddenMix.summary, /records no clinical risk/);
  // Without the check, #522 did not count toward M=1 and two high-risk clinical PRs verified.
  await expectReason("CHAIN_RISK_UNDERSTATED", {
    fixture: batch(spread([clinicalA(521), clinicalA(522)])),
    policy: { ...BATCH_POLICY, maxHighRiskClinical: 1 },
    mutate: recode(522, () => ["EXPLICIT_HIGH_RISK"]),
  }, "a high-risk clinical PR recorded without a clinical code under M=1");
  const wrongDomain = await expectReason("CHAIN_RISK_UNDERSTATED", {
    fixture: batch(spread([releaseControl(531)])),
    mutate: recode(531, () => ["CLINICAL_EVIDENCE_CHANGE"]),
  }, "a release-control PR recorded as clinical");
  assert.match(wrongDomain.summary, /records no release-control risk/);
  // Recorded codes may name more than the re-classification finds within a domain...
  const { chain: broader } = await run(batch(spread([clinicalA(541)])), {
    mutate: recode(541, (codes) => [...codes, "CLINICAL_EVIDENCE_CHANGE"]),
  });
  assert.equal(broader.ok, true, broader.summary);
  assert.equal(broader.entries[0].domain, "clinical");
  // ...but a recorded second domain makes the entry mixed (fail toward full review).
  const recordedBoth = await expectReason("BATCH_DOMAIN_MIXED", {
    fixture: batch(spread([clinicalA(542)])),
    mutate: recode(542, (codes) => [...codes, "RELEASE_CONTROL_CHANGE"]),
  }, "recorded codes that name both domains");
  assert.deepEqual(recordedBoth.entries[0].domains, ["clinical", "release-control"]);
}

// ---- Malformed inputs fail closed ------------------------------------------------------------------
assert.equal(verifyPromotionChain({ facts: null, publicKeys: PUBLIC_KEYS }).reasonCode, "CHAIN_EVIDENCE_UNAVAILABLE");
assert.equal(verifyPromotionChain({ facts: { schema: "x" }, publicKeys: PUBLIC_KEYS }).reasonCode, "CHAIN_EVIDENCE_UNAVAILABLE");
{
  clearPromotionChainCache();
  const facts = await loadPromotionChainFacts(fakeApi(baseline.responses), { repository: REPO, mainSha: baseline.M, promotionHeadSha: baseline.P });
  assert.equal(verifyPromotionChain({ facts, publicKeys: PUBLIC_KEYS, policy: { maxPrs: 0 } }).reasonCode, "CHAIN_EVIDENCE_UNAVAILABLE");
  assert.equal(verifyPromotionChain({ facts, publicKeys: {} }).reasonCode, "CHAIN_ATTESTATION_MISSING", "no configured keys verify nothing");
  const noCommits = structuredClone(facts);
  delete noCommits.commits[baseline.heads[102].squash];
  assert.equal(verifyPromotionChain({ facts: noCommits, publicKeys: PUBLIC_KEYS }).reasonCode, "CHAIN_EVIDENCE_UNAVAILABLE");
}

console.log("promotion chain tests passed");
