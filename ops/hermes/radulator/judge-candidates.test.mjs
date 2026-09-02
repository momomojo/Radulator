#!/usr/bin/env node
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  claimNextCandidate,
  collectCandidates,
  FILE_REVIEW_EVIDENCE_SCHEMA,
  hydratePatchlessReviewEvidence,
  selectCandidateBatch,
  writeCandidateCache,
} from "./judge-candidates.mjs";
import { resolveCiIdentity } from "./github-ci-identity.mjs";
import { resolveGithubToken } from "./github-token.mjs";
import {
  ATTESTATION_MARKER,
  relevantLabelsDigest,
} from "../../../scripts/independent-review-gate.mjs";
import {
  ATTESTATION_SCHEMA,
  canonicalJson,
  classifyRisk,
  digest,
} from "../../../scripts/release-policy.mjs";

const HEAD = "a".repeat(40);
const BASE = "b".repeat(40);
const PRIMARY_ID = "primary-2026-08";
const VERIFY_ID = "verification-2026-08";
const STANDARD_REQUIRED_CI = ["Smoke Tests", "Targeted Calculator Tests"];
const HIGH_REQUIRED_CI = [...STANDARD_REQUIRED_CI, "Full Test Suite"];
const primaryKeys = generateKeyPairSync("ed25519");
const verificationKeys = generateKeyPairSync("ed25519");
const PUBLIC_KEYS = {
  [PRIMARY_ID]: {
    role: "primary",
    profile: "radulator",
    publicKey: primaryKeys.publicKey.export({ type: "spki", format: "pem" }),
  },
  [VERIFY_ID]: {
    role: "verification",
    profile: "default",
    publicKey: verificationKeys.publicKey.export({ type: "spki", format: "pem" }),
  },
};

{
  const backlog = [{ pr: 82 }, { pr: 93 }, { pr: 112 }];
  assert.deepEqual(selectCandidateBatch(backlog), [{ pr: 82 }], "one candidate is the safe default batch");
  assert.throws(() => selectCandidateBatch(backlog, 2), /exactly one/i);
  assert.throws(() => selectCandidateBatch(backlog, 0), /positive integer/i);
  assert.throws(() => selectCandidateBatch(backlog, 1.5), /positive integer/i);
}

{
  const root = await mkdtemp(path.join(os.tmpdir(), "radulator-judge-claims-"));
  const stateFile = path.join(root, "primary.json");
  const backlog = [
    { candidateId: "candidate-a", pr: 82 },
    { candidateId: "candidate-b", pr: 93 },
  ];
  try {
    const [left, right] = await Promise.all([
      claimNextCandidate(backlog, { role: "primary", stateFile, nowMs: 1_000, leaseMs: 100 }),
      claimNextCandidate(backlog, { role: "primary", stateFile, nowMs: 1_000, leaseMs: 100 }),
    ]);
    assert.equal(
      [left, right].filter((result) => result.candidate).length,
      1,
      "concurrent collectors may create only one role claim",
    );
    assert.equal([left, right].find((result) => result.candidate).candidate.candidateId, "candidate-a");
    assert.equal((await stat(stateFile)).mode & 0o777, 0o600, "claim state is private");

    const overlap = await claimNextCandidate(backlog, {
      role: "primary",
      stateFile,
      nowMs: 1_050,
      leaseMs: 100,
    });
    assert.equal(overlap.candidate, null);
    assert.equal(overlap.reason, "active-lease", "an active role lease prevents a second review turn");

    const rotated = await claimNextCandidate(backlog, {
      role: "primary",
      stateFile,
      nowMs: 1_101,
      leaseMs: 100,
      retryLimit: 1,
      cooldownMs: 1_000,
    });
    assert.equal(rotated.candidate.candidateId, "candidate-b", "an expired failing claim rotates to later work");

    const resolved = await claimNextCandidate([backlog[0]], {
      role: "primary",
      stateFile,
      nowMs: 1_102,
      leaseMs: 100,
      retryLimit: 1,
      cooldownMs: 1_000,
    });
    assert.equal(resolved.candidate, null, "cooldown remains bounded after authoritative backlog pruning");

    const retried = await claimNextCandidate([backlog[0]], {
      role: "primary",
      stateFile,
      nowMs: 2_102,
      leaseMs: 100,
      retryLimit: 1,
      cooldownMs: 1_000,
    });
    assert.equal(retried.candidate.candidateId, "candidate-a", "cooled-down work automatically becomes eligible again");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

{
  const root = await mkdtemp(path.join(os.tmpdir(), "radulator-judge-readback-"));
  const stateFile = path.join(root, "verification.json");
  const primary = { candidateId: "high-a", pr: 82 };
  const next = { candidateId: "high-b", pr: 93 };
  try {
    const first = await claimNextCandidate([primary, next], {
      role: "verification",
      stateFile,
      nowMs: 5_000,
      leaseMs: 10_000,
    });
    assert.equal(first.candidate.candidateId, primary.candidateId);
    const afterReadback = await claimNextCandidate([next], {
      role: "verification",
      stateFile,
      nowMs: 5_001,
      leaseMs: 10_000,
    });
    assert.equal(
      afterReadback.candidate.candidateId,
      next.candidateId,
      "authoritative attestation readback removes the resolved lease without waiting for expiry",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

{
  const root = await mkdtemp(path.join(os.tmpdir(), "radulator-judge-stale-lock-"));
  const stateFile = path.join(root, "primary.json");
  const lockFile = `${stateFile}.lock`;
  const candidate = { candidateId: "stale-lock-candidate", pr: 101 };
  try {
    await writeFile(lockFile, "orphaned lock content\n", { mode: 0o600 });
    const staleTime = new Date(Date.now() - 10_000);
    await utimes(lockFile, staleTime, staleTime);
    const results = await Promise.all(
      Array.from({ length: 8 }, () => claimNextCandidate([candidate], {
        role: "primary",
        stateFile,
        nowMs: 10_000,
        leaseMs: 10_000,
      })),
    );
    assert.equal(
      results.filter((result) => result.candidate).length,
      1,
      "concurrent stale-lock recovery must preserve exactly one critical-section owner",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

{
  const calls = [];
  const identity = await resolveCiIdentity({
    token: "opaque-token",
    owner: "momomojo",
    repo: "Radulator",
    env: {},
    async request(token, endpoint) {
      calls.push({ token, endpoint });
      return {
        id: 227376261,
        path: ".github/workflows/e2e-tests.yml",
        state: "active",
      };
    },
  });
  assert.deepEqual(identity, { expectedWorkflowId: 227376261, expectedCiAppId: 15368 });
  assert.deepEqual(calls, [{
    token: "opaque-token",
    endpoint: "/repos/momomojo/Radulator/actions/workflows/e2e-tests.yml",
  }]);

  await assert.rejects(
    resolveCiIdentity({
      token: "opaque-token",
      owner: "momomojo",
      repo: "Radulator",
      env: { RADULATOR_E2E_WORKFLOW_ID: "999" },
      async request() {
        return { id: 227376261, path: ".github/workflows/e2e-tests.yml", state: "active" };
      },
    }),
    /does not match/i,
    "a configured workflow identity may not silently disagree with GitHub",
  );

  await assert.rejects(
    resolveCiIdentity({
      token: "opaque-token",
      owner: "momomojo",
      repo: "Radulator",
      env: {},
      async request() {
        return { id: 227376261, path: ".github/workflows/renamed.yml", state: "active" };
      },
    }),
    /path/i,
    "the resolved workflow must retain the trusted repository path",
  );
}

{
  let fallbackCalls = 0;
  const fromEnvironment = resolveGithubToken({
    env: { GH_TOKEN: " environment-token ", GITHUB_TOKEN: "lower-priority-token" },
    execFile() {
      fallbackCalls += 1;
      return "unexpected";
    },
  });
  assert.equal(fromEnvironment, "environment-token");
  assert.equal(fallbackCalls, 0, "an explicit environment token never invokes the gh fallback");

  let invocation;
  const fromGh = resolveGithubToken({
    env: {},
    execFile(command, arguments_, options) {
      invocation = { command, arguments_, options };
      return " cli-token\n";
    },
  });
  assert.equal(fromGh, "cli-token");
  assert.equal(invocation.command, "gh");
  assert.deepEqual(invocation.arguments_, ["auth", "token", "--hostname", "github.com"]);
  assert.deepEqual(invocation.options.stdio, ["ignore", "pipe", "ignore"], "token fallback never prints credentials");

  assert.equal(resolveGithubToken({ env: {}, execFile() { throw new Error("not authenticated"); } }), "");
}

const STANDARD_FILES = [{ filename: "README.md", status: "modified", additions: 1, deletions: 1, changes: 2, patch: "@@ -1 +1 @@\n-old\n+new" }];
const HIGH_FILES = [{ filename: "src/components/calculators/MELDNa.jsx", status: "modified", additions: 1, deletions: 1, changes: 2, patch: "@@ -1 +1 @@\n-1\n+2" }];

function gitBlob(text) {
  const bytes = Buffer.from(text);
  return {
    sha: createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex"),
    size: bytes.length,
    content: bytes.toString("base64"),
  };
}

function githubWrappedBase64(value, lineLength = 60, lineEnding = "\n") {
  const lines = [];
  for (let offset = 0; offset < value.length; offset += lineLength) {
    lines.push(value.slice(offset, offset + lineLength));
  }
  return `${lines.join(lineEnding)}${lineEnding}`;
}

function exactHydrationRequest({ headTreeSha, baseTreeSha, headBlob, baseBlob, overrides = {} }) {
  return async (_token, endpoint) => {
    if (overrides[endpoint]) return overrides[endpoint];
    if (endpoint === `/repos/momomojo/Radulator/git/commits/${HEAD}`) {
      return { sha: HEAD, tree: { sha: headTreeSha } };
    }
    if (endpoint === `/repos/momomojo/Radulator/git/commits/${BASE}`) {
      return { sha: BASE, tree: { sha: baseTreeSha } };
    }
    if (endpoint === `/repos/momomojo/Radulator/git/trees/${headTreeSha}?recursive=1`) {
      return {
        sha: headTreeSha,
        truncated: false,
        tree: [{ path: "tests/fixtures/compute/meld-na.json", mode: "100644", type: "blob", ...headBlob }],
      };
    }
    if (endpoint === `/repos/momomojo/Radulator/git/trees/${baseTreeSha}?recursive=1`) {
      return {
        sha: baseTreeSha,
        truncated: false,
        tree: [{ path: "tests/fixtures/compute/meld-na.json", mode: "100644", type: "blob", ...baseBlob }],
      };
    }
    if (endpoint === `/repos/momomojo/Radulator/git/blobs/${headBlob.sha}`) {
      return { sha: headBlob.sha, encoding: "base64", size: headBlob.size, content: headBlob.content };
    }
    if (endpoint === `/repos/momomojo/Radulator/git/blobs/${baseBlob.sha}`) {
      return { sha: baseBlob.sha, encoding: "base64", size: baseBlob.size, content: baseBlob.content };
    }
    throw new Error(`Unexpected endpoint: ${endpoint}`);
  };
}

{
  const headTreeSha = "1".repeat(40);
  const baseTreeSha = "2".repeat(40);
  const headBlob = gitBlob('{"current": true}\n');
  const baseBlob = gitBlob('{"prior": true}\n');
  const files = [
    {
      filename: "tests/fixtures/compute/meld-na.json",
      status: "modified",
      additions: 0,
      deletions: 0,
      changes: 0,
      patch: null,
    },
    ...STANDARD_FILES,
  ];
  const calls = [];
  const exactRequest = exactHydrationRequest({ headTreeSha, baseTreeSha, headBlob, baseBlob });
  const hydrated = await hydratePatchlessReviewEvidence({
    token: "opaque-token",
    owner: "momomojo",
    repo: "Radulator",
    headSha: HEAD,
    baseSha: BASE,
    files,
    async request(token, endpoint) {
      calls.push({ token, endpoint });
      return exactRequest(token, endpoint);
    },
  });

  assert.equal(hydrated[1], files[1], "ordinary textual patches do not gain redundant blob evidence");
  assert.deepEqual(hydrated[0].reviewEvidence, {
    schema: "radulator-file-review-evidence/v1",
    status: "modified",
    headSha: HEAD,
    baseSha: BASE,
    head: {
      path: "tests/fixtures/compute/meld-na.json",
      mode: "100644",
      type: "blob",
      sha: headBlob.sha,
      size: headBlob.size,
      encoding: "base64",
      content: headBlob.content,
    },
    base: {
      path: "tests/fixtures/compute/meld-na.json",
      mode: "100644",
      type: "blob",
      sha: baseBlob.sha,
      size: baseBlob.size,
      encoding: "base64",
      content: baseBlob.content,
    },
  });
  assert.ok(calls.every((call) => call.token === "opaque-token"));

  await assert.rejects(
    hydratePatchlessReviewEvidence({
      token: "opaque-token",
      owner: "momomojo",
      repo: "Radulator",
      headSha: HEAD,
      baseSha: BASE,
      files: [files[0]],
      async request(_token, endpoint) {
        if (endpoint.endsWith(`/git/commits/${HEAD}`)) return { sha: HEAD, tree: { sha: headTreeSha } };
        if (endpoint.endsWith(`/git/commits/${BASE}`)) return { sha: BASE, tree: { sha: baseTreeSha } };
        return { truncated: true, tree: [] };
      },
    }),
    /truncated/i,
    "patchless files are never judged from an incomplete Git tree",
  );
}

{
  const headTreeSha = "3".repeat(40);
  const baseTreeSha = "4".repeat(40);
  const headBlob = gitBlob(`${"current line with enough bytes to wrap\n".repeat(12)}current tail\n`);
  const baseBlob = gitBlob(`${"prior line with enough bytes to wrap\n".repeat(12)}prior tail\n`);
  const wrappedHead = githubWrappedBase64(headBlob.content);
  const wrappedBase = githubWrappedBase64(baseBlob.content, 60, "\r\n");
  assert.ok(wrappedHead.includes("\n") && wrappedHead.endsWith("\n"));
  assert.ok(wrappedBase.includes("\r\n") && wrappedBase.endsWith("\r\n"));
  const hydrated = await hydratePatchlessReviewEvidence({
    token: "opaque-token",
    owner: "momomojo",
    repo: "Radulator",
    headSha: HEAD,
    baseSha: BASE,
    files: [{
      filename: "tests/fixtures/compute/meld-na.json",
      status: "modified",
      additions: 0,
      deletions: 0,
      changes: 0,
      patch: null,
    }],
    request: exactHydrationRequest({
      headTreeSha,
      baseTreeSha,
      headBlob,
      baseBlob,
      overrides: {
        [`/repos/momomojo/Radulator/git/blobs/${headBlob.sha}`]: {
          sha: headBlob.sha,
          encoding: "base64",
          size: headBlob.size,
          content: wrappedHead,
        },
        [`/repos/momomojo/Radulator/git/blobs/${baseBlob.sha}`]: {
          sha: baseBlob.sha,
          encoding: "base64",
          size: baseBlob.size,
          content: wrappedBase,
        },
      },
    }),
  });
  assert.equal(hydrated[0].reviewEvidence.head.content, headBlob.content,
    "GitHub-wrapped LF base64 with a final newline is normalized to canonical base64");
  assert.equal(hydrated[0].reviewEvidence.base.content, baseBlob.content,
    "GitHub-wrapped CRLF base64 with a final newline is normalized to canonical base64");
}

{
  const headTreeSha = "1".repeat(40);
  const baseTreeSha = "2".repeat(40);
  const headBlob = gitBlob('{"current":true}\n');
  const baseBlob = gitBlob('{"prior":true}\n');
  const file = {
    filename: "tests/fixtures/compute/meld-na.json",
    status: "modified",
    additions: 1,
    deletions: 1,
    changes: 2,
    patch: "@@ -1 +1 @@\n-old",
  };
  const request = exactHydrationRequest({ headTreeSha, baseTreeSha, headBlob, baseBlob });
  const hydrated = await hydratePatchlessReviewEvidence({
    token: "opaque-token",
    owner: "momomojo",
    repo: "Radulator",
    headSha: HEAD,
    baseSha: BASE,
    files: [file],
    request,
  });
  assert.equal(hydrated[0].reviewEvidence.head.sha, headBlob.sha,
    "an incomplete patch must be replaced with exact object evidence");

  await assert.rejects(
    hydratePatchlessReviewEvidence({
      token: "opaque-token",
      owner: "momomojo",
      repo: "Radulator",
      headSha: HEAD,
      baseSha: BASE,
      files: [{ ...file, changes: 3, patch: "@@ -1 +1 @@\n-old\n+new" }],
      request,
    }),
    /changes count/i,
    "an additions-plus-deletions mismatch must fail closed",
  );

  await assert.rejects(
    hydratePatchlessReviewEvidence({
      token: "opaque-token",
      owner: "momomojo",
      repo: "Radulator",
      headSha: HEAD,
      baseSha: BASE,
      files: [{
        ...STANDARD_FILES[0],
        reviewEvidence: { schema: FILE_REVIEW_EVIDENCE_SCHEMA, headSha: HEAD, baseSha: BASE, head: null, base: null },
      }],
      request,
    }),
    /evidence|side/i,
    "even an exact patch may not carry weak review evidence",
  );

  for (const malformedPatch of [
    "@@ -1,0 +1,0 @@",
    "@@ -01 +1 @@\n-old\n+new",
  ]) {
    const malformed = await hydratePatchlessReviewEvidence({
      token: "opaque-token",
      owner: "momomojo",
      repo: "Radulator",
      headSha: HEAD,
      baseSha: BASE,
      files: [{ ...file, additions: 0, deletions: 0, changes: 0, patch: malformedPatch }],
      request,
    });
    assert.equal(malformed[0].patch, null, "non-canonical or no-op hunk headers require hydration");
    assert.ok(malformed[0].reviewEvidence);
  }

  for (const [label, overrides] of [
    ["commit binding", { [`/repos/momomojo/Radulator/git/commits/${HEAD}`]: { sha: BASE, tree: { sha: headTreeSha } } }],
    ["tree binding", { [`/repos/momomojo/Radulator/git/trees/${headTreeSha}?recursive=1`]: { sha: baseTreeSha, truncated: false, tree: [] } }],
    ["blob response sha", { [`/repos/momomojo/Radulator/git/blobs/${headBlob.sha}`]: { sha: baseBlob.sha, encoding: "base64", size: headBlob.size, content: headBlob.content } }],
    ["blob payload sha", { [`/repos/momomojo/Radulator/git/blobs/${headBlob.sha}`]: { sha: headBlob.sha, encoding: "base64", size: headBlob.size, content: baseBlob.content } }],
    ["ambiguous base64 whitespace", { [`/repos/momomojo/Radulator/git/blobs/${headBlob.sha}`]: { sha: headBlob.sha, encoding: "base64", size: headBlob.size, content: `${headBlob.content}\t` } }],
    ["malformed base64 character", { [`/repos/momomojo/Radulator/git/blobs/${headBlob.sha}`]: { sha: headBlob.sha, encoding: "base64", size: headBlob.size, content: `${headBlob.content}!` } }],
    ["wrong mode", { [`/repos/momomojo/Radulator/git/trees/${headTreeSha}?recursive=1`]: { sha: headTreeSha, truncated: false, tree: [{ path: file.filename, mode: "100644", type: "tree", ...headBlob }] } }],
    ["wrong size", { [`/repos/momomojo/Radulator/git/trees/${headTreeSha}?recursive=1`]: { sha: headTreeSha, truncated: false, tree: [{ path: file.filename, mode: "100644", type: "blob", ...headBlob, size: headBlob.size + 1 }] } }],
    ["duplicate path", { [`/repos/momomojo/Radulator/git/trees/${headTreeSha}?recursive=1`]: { sha: headTreeSha, truncated: false, tree: [
      { path: file.filename, mode: "100644", type: "blob", ...headBlob },
      { path: file.filename, mode: "100644", type: "blob", ...headBlob },
    ] } }],
  ]) {
    await assert.rejects(
      hydratePatchlessReviewEvidence({
        token: "opaque-token",
        owner: "momomojo",
        repo: "Radulator",
        headSha: HEAD,
        baseSha: BASE,
        files: [{ ...file, patch: null }],
        request: exactHydrationRequest({ headTreeSha, baseTreeSha, headBlob, baseBlob, overrides }),
      }),
      /exact|malformed|binding|duplicate/i,
      `${label} must fail closed`,
    );
  }
}

function stateFixture(files = STANDARD_FILES, reviews = [], overrides = {}) {
  const labels = relevantLabelsDigest(["ready-for-gate"]);
  const requiredCi = overrides.requiredCi || STANDARD_REQUIRED_CI;
  const evidenceNames = overrides.evidenceNames || requiredCi;
  return {
    pr: {
      repositoryId: 1027532341,
      number: 123,
      changedFiles: files.length,
      title: "Improve exact behavior",
      body: "Evidence: https://example.org/source",
      state: "open",
      draft: false,
      headSha: HEAD,
      baseSha: BASE,
      baseRef: "develop",
      author: "implementation-worker",
      authorId: 5001,
      createdAt: "2026-08-23T19:50:00Z",
      stateEpoch: { eventId: 88, eventCreatedAt: "2026-08-23T19:55:00Z" },
      labels: labels.labels,
      labelsDigest: labels.sha256,
    },
    requiredCi,
    ci: {
      ok: overrides.ciOk ?? true,
      evidence: evidenceNames.map((name, index) => ({
        name,
        app_id: 15368,
        check_run_id: 1 + index,
        check_suite_id: 2,
        workflow_id: 3,
        workflow_run_id: 4,
        run_attempt: 1,
        head_sha: HEAD,
        conclusion: "success",
        completed_at: `2026-08-23T20:00:0${index}Z`,
      })),
    },
    files,
    reviews,
    publicKeys: PUBLIC_KEYS,
  };
}

function signedCarrier(keyId, role, profile, privateKey, state, verdict = "PASS", overrides = {}) {
  const risk = classifyRisk(state.files, state.pr);
  const exact = {
    repositoryId: state.pr.repositoryId,
    pr: state.pr.number,
    headSha: state.pr.headSha,
    baseSha: state.pr.baseSha,
    baseRef: state.pr.baseRef,
    stateEpoch: { event_id: state.pr.stateEpoch.eventId, event_created_at: state.pr.stateEpoch.eventCreatedAt },
    labelsSha256: state.pr.labelsDigest,
    risk,
    ci: state.ci.evidence,
    ciSha256: digest(state.ci.evidence),
  };
  const record = {
    schema: ATTESTATION_SCHEMA,
    repository_id: exact.repositoryId,
    pr: exact.pr,
    head_sha: exact.headSha,
    base_sha: exact.baseSha,
    base_ref: exact.baseRef,
    state_epoch: exact.stateEpoch,
    labels_sha256: exact.labelsSha256,
    risk: exact.risk,
    ci: exact.ci,
    ci_sha256: exact.ciSha256,
    verdict,
    clinical_analysis: overrides.clinicalAnalysis || (verdict === "PASS" ? "Evidence supports release." : "Evidence is insufficient."),
    citations: ["https://example.org/source"],
    judge: { key_id: keyId, role, profile, model: "gpt-5.6-sol", provider: "openai-codex" },
    reviewed_at: overrides.reviewedAt || "2026-08-23T20:01:00Z",
  };
  record.signature = sign(null, Buffer.from(canonicalJson(record)), privateKey).toString("base64");
  return {
    id: 9001,
    body: `${ATTESTATION_MARKER}\n\`\`\`json\n${JSON.stringify(record)}\n\`\`\``,
    updatedAt: record.reviewed_at,
  };
}

async function collect(role, state) {
  return collectCandidates({
    repository: "momomojo/Radulator",
    role,
    publicKeys: PUBLIC_KEYS,
    api: {
      async listOpenPrs() { return [{ number: 123, labels: [{ name: "ready-for-gate" }] }]; },
      async loadGateState() { return structuredClone(state); },
    },
    now: "2026-08-23T20:02:00Z",
  });
}

const standard = await collect("primary", stateFixture());
assert.equal(standard.length, 1);
assert.equal(standard[0].role, "primary");
assert.equal(standard[0].risk.tier, "standard");
assert.equal(standard[0].headSha, HEAD);
assert.equal(standard[0].candidateId.length, 64);
assert.ok(standard[0].riskDetails.length > 0);

const patchlessFilename = "tests/fixtures/compute/meld-na.json";
const patchlessFile = {
  filename: patchlessFilename,
  status: "modified",
  additions: 0,
  deletions: 0,
  changes: 0,
  patch: null,
};
const patchlessHeadBlob = gitBlob('{"current":true}\n');
const patchlessBaseBlob = gitBlob('{"prior":true}\n');
const patchlessEvidence = (await hydratePatchlessReviewEvidence({
  token: "opaque-token",
  owner: "momomojo",
  repo: "Radulator",
  headSha: HEAD,
  baseSha: BASE,
  files: [patchlessFile],
  request: exactHydrationRequest({
    headTreeSha: "1".repeat(40),
    baseTreeSha: "2".repeat(40),
    headBlob: patchlessHeadBlob,
    baseBlob: patchlessBaseBlob,
  }),
}))[0].reviewEvidence;

async function collectHydrated(file, evidence) {
  return collectCandidates({
    repository: "momomojo/Radulator",
    role: "primary",
    publicKeys: PUBLIC_KEYS,
    api: {
      async listOpenPrs() { return [{ number: 123, labels: [{ name: "ready-for-gate" }] }]; },
      async loadGateState() { return stateFixture([file]); },
      async hydrateReviewEvidence() { return [{ ...file, reviewEvidence: evidence }]; },
    },
    now: "2026-08-23T20:02:00Z",
  });
}

await assert.rejects(
  collectHydrated(patchlessFile, {
    ...structuredClone(patchlessEvidence),
    head: { sha: patchlessEvidence.head.sha },
    base: { sha: patchlessEvidence.base.sha },
  }),
  /evidence|malformed|incomplete/i,
  "review evidence without exact object metadata and bytes is not sufficient",
);

for (const [label, file, evidence] of [
  ["invalid status", { ...patchlessFile, status: "unknown" }, patchlessEvidence],
  ["absolute path", { ...patchlessFile, filename: "/etc/passwd" }, patchlessEvidence],
  ["dot path", { ...patchlessFile, filename: "src/../secret.js" }, patchlessEvidence],
  ["mismatched changes", { ...patchlessFile, changes: 1 }, patchlessEvidence],
  ["missing evidence status", patchlessFile, (() => {
    const evidence = structuredClone(patchlessEvidence);
    delete evidence.status;
    return evidence;
  })()],
  ["wrong evidence status", patchlessFile, { ...structuredClone(patchlessEvidence), status: "added" }],
  ["wrong evidence path", patchlessFile, { ...structuredClone(patchlessEvidence), head: { ...patchlessEvidence.head, path: "other.json" } }],
  ["wrong evidence mode", patchlessFile, { ...structuredClone(patchlessEvidence), head: { ...patchlessEvidence.head, mode: "100600" } }],
  ["wrong evidence type", patchlessFile, { ...structuredClone(patchlessEvidence), head: { ...patchlessEvidence.head, type: "tree" } }],
  ["wrong evidence size", patchlessFile, { ...structuredClone(patchlessEvidence), head: { ...patchlessEvidence.head, size: patchlessEvidence.head.size + 1 } }],
  ["ambiguous evidence base64 whitespace", patchlessFile, { ...structuredClone(patchlessEvidence), head: { ...patchlessEvidence.head, content: `${patchlessEvidence.head.content}\t` } }],
  ["malformed evidence base64 character", patchlessFile, { ...structuredClone(patchlessEvidence), head: { ...patchlessEvidence.head, content: `${patchlessEvidence.head.content}!` } }],
  ["cross-bound evidence", patchlessFile, { ...structuredClone(patchlessEvidence), head: { ...patchlessEvidence.head, sha: patchlessEvidence.base.sha } }],
  ["modified null head", patchlessFile, { ...structuredClone(patchlessEvidence), head: null }],
  ["modified null base", patchlessFile, { ...structuredClone(patchlessEvidence), base: null }],
  ["added non-null base", { ...patchlessFile, status: "added", additions: 1, changes: 1 }, patchlessEvidence],
  ["removed non-null head", { ...patchlessFile, status: "removed" }, patchlessEvidence],
]) {
  await assert.rejects(
    collectHydrated(file, evidence),
    /evidence|malformed|incomplete|changes|path|status|mode|type|size|base64|side/i,
    `${label} review evidence must fail closed`,
  );
}

await assert.rejects(
  collectCandidates({
    repository: "momomojo/Radulator",
    role: "primary",
    publicKeys: PUBLIC_KEYS,
    api: {
      async listOpenPrs() { return [{ number: 123, labels: [{ name: "ready-for-gate" }] }]; },
      async loadGateState() { return stateFixture([patchlessFile]); },
      async hydrateReviewEvidence(_pr, files) {
        files[0].filename = "other.json";
        const evidence = structuredClone(patchlessEvidence);
        evidence.head.path = "other.json";
        evidence.base.path = "other.json";
        return [{ ...files[0], reviewEvidence: evidence }];
      },
    },
  }),
  /identity|evidence|path/i,
  "hydration may not mutate a file identity in place to cross-bind evidence",
);

await assert.rejects(
  collectCandidates({
    repository: "momomojo/Radulator",
    role: "primary",
    publicKeys: PUBLIC_KEYS,
    api: {
      async listOpenPrs() { return [{ number: 123, labels: [{ name: "ready-for-gate" }] }]; },
      async loadGateState() {
        return stateFixture([patchlessFile, structuredClone(patchlessFile)]);
      },
      async hydrateReviewEvidence(_pr, files) {
        return files.map((file) => ({ ...file, reviewEvidence: structuredClone(patchlessEvidence) }));
      },
    },
  }),
  /duplicate|identity|path/i,
  "duplicate changed-file identities and current paths must fail closed before hydration",
);

await assert.rejects(
  collectCandidates({
    repository: "momomojo/Radulator",
    role: "primary",
    publicKeys: PUBLIC_KEYS,
    api: {
      async listOpenPrs() { return [{ number: 123, labels: [{ name: "ready-for-gate" }] }]; },
      async loadGateState() {
        return stateFixture([patchlessFile, { ...patchlessFile, filename: "tests/fixtures/compute/other.json" }]);
      },
      async hydrateReviewEvidence(_pr, files) {
        return files.map((file) => ({
          ...file,
          filename: patchlessFilename,
          reviewEvidence: structuredClone(patchlessEvidence),
        }));
      },
    },
  }),
  /duplicate|identity|path/i,
  "hydration may not return duplicate changed-file identities or current paths",
);

{
  const incomplete = stateFixture();
  incomplete.pr.changedFiles = 2;
  assert.deepEqual(await collect("primary", incomplete), [], "incomplete GitHub file evidence is never judged");
}

{
  const ambiguousState = stateFixture();
  ambiguousState.reviews = [
    signedCarrier(PRIMARY_ID, "primary", "radulator", primaryKeys.privateKey, ambiguousState),
    signedCarrier(PRIMARY_ID, "primary", "radulator", primaryKeys.privateKey, ambiguousState, "PASS", {
      clinicalAnalysis: "A distinct valid analysis at the same newest timestamp.",
    }),
  ];
  assert.equal((await collect("primary", ambiguousState)).length, 1,
    "an ambiguous newest role is automatically requeued for a later resolving attestation");

  const duplicateState = stateFixture();
  const exactCarrier = signedCarrier(PRIMARY_ID, "primary", "radulator", primaryKeys.privateKey, duplicateState);
  duplicateState.reviews = [exactCarrier, structuredClone(exactCarrier)];
  assert.deepEqual(await collect("primary", duplicateState), [], "copied exact carriers remain idempotent");

  ambiguousState.reviews.push(signedCarrier(
    PRIMARY_ID, "primary", "radulator", primaryKeys.privateKey, ambiguousState, "PASS",
    { reviewedAt: "2026-08-23T20:02:00Z" },
  ));
  assert.deepEqual(await collect("primary", ambiguousState), [], "a newer unique PASS supersedes an older collision");
}

const highNoPrimary = await collect("verification", stateFixture(HIGH_FILES, [], {
  requiredCi: HIGH_REQUIRED_CI,
  evidenceNames: HIGH_REQUIRED_CI,
}));
assert.deepEqual(highNoPrimary, [], "verification waits for the primary PASS on high risk");

const downgradedHighState = stateFixture(HIGH_FILES, [], {
  requiredCi: STANDARD_REQUIRED_CI,
  evidenceNames: STANDARD_REQUIRED_CI,
});
assert.deepEqual(
  await collect("primary", downgradedHighState),
  [],
  "the collector must reject a mocked high-risk state that claims green under a downgraded CI policy",
);

const missingFullEvidenceState = stateFixture(HIGH_FILES, [], {
  requiredCi: HIGH_REQUIRED_CI,
  evidenceNames: STANDARD_REQUIRED_CI,
});
assert.deepEqual(
  await collect("primary", missingFullEvidenceState),
  [],
  "the collector must reject a required-CI list whose immutable evidence omits Full Test Suite",
);

const mixedTrustDomainState = stateFixture([
  ...HIGH_FILES,
  {
    filename: ".github/workflows/e2e-tests.yml",
    status: "modified",
    additions: 1,
    deletions: 1,
    changes: 2,
    patch: "@@ -1 +1 @@\n-npx playwright test\n+echo skipped",
  },
], [], {
  requiredCi: HIGH_REQUIRED_CI,
  evidenceNames: HIGH_REQUIRED_CI,
});
assert.deepEqual(
  await collect("primary", mixedTrustDomainState),
  [],
  "the collector must not spend a judge turn on a clinical PR that redefines its own release controls",
);

const highState = stateFixture(HIGH_FILES, [], {
  requiredCi: HIGH_REQUIRED_CI,
  evidenceNames: HIGH_REQUIRED_CI,
});
highState.reviews = [signedCarrier(PRIMARY_ID, "primary", "radulator", primaryKeys.privateKey, highState)];
const highVerification = await collect("verification", highState);
assert.equal(highVerification.length, 1);
assert.equal(highVerification[0].risk.tier, "high");
assert.deepEqual(highVerification[0].requiredRoles, ["primary", "verification"]);
assert.deepEqual(
  highVerification[0].exactState.ci.map((item) => item.name),
  ["Smoke Tests", "Targeted Calculator Tests", "Full Test Suite"],
  "the high-risk candidate and its signature digest must bind Full Test Suite identity",
);
assert.notEqual(
  highVerification[0].exactState.ciSha256,
  digest(downgradedHighState.ci.evidence),
  "removing Full Test Suite must change the exact-state CI digest",
);

const needsFixState = stateFixture(HIGH_FILES, [], {
  requiredCi: HIGH_REQUIRED_CI,
  evidenceNames: HIGH_REQUIRED_CI,
});
needsFixState.reviews = [signedCarrier(PRIMARY_ID, "primary", "radulator", primaryKeys.privateKey, needsFixState, "NEEDS_FIX")];
assert.deepEqual(await collect("verification", needsFixState), [], "verification never overrides a primary NEEDS_FIX");

const temp = await mkdtemp(path.join(os.tmpdir(), "radulator-candidate-test-"));
try {
  const first = await writeCandidateCache(temp, standard);
  const second = await writeCandidateCache(temp, standard);
  assert.deepEqual(first, second, "cache writes are idempotent");
  const cached = JSON.parse(await readFile(first[0], "utf8"));
  assert.equal(cached.candidateId, standard[0].candidateId);
  assert.equal(cached.headSha, HEAD);
} finally {
  await rm(temp, { recursive: true, force: true });
}

console.log("Hermes clinical judge candidate tests passed");
