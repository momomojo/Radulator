#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { evaluateGate, gateStateFingerprint, REQUIRED_CONTEXT } from "./independent-review-gate.mjs";

const HEAD = "a".repeat(40);
const BASE = "b".repeat(40);
const REVIEW_BOT = "radulator-independent-review[bot]";
const CLOUD_MERGE_BOT = "radulator-cloud-merger[bot]";

function fixture({ pr: prOverrides = {}, ci: ciOverrides = {}, reviews = [passRecord()], ...gateOverrides } = {}) {
  return {
    pr: {
      number: 95,
      state: "open",
      headSha: HEAD,
      baseSha: BASE,
      baseRef: "develop",
      author: "implementation-worker",
      updatedAt: "2026-07-27T23:23:34Z",
      labels: [],
      draft: false,
      ...prOverrides,
    },
    reviewBotLogin: REVIEW_BOT,
    reviewSystem: "independent-security-review",
    cloudMergeBotLogin: CLOUD_MERGE_BOT,
    cloudMergeSystem: "cloud-merge-routine",
    ...gateOverrides,
    requiredCi: ["Smoke Tests", "Targeted Calculator Tests"],
    ci: {
      "Smoke Tests": "success",
      "Targeted Calculator Tests": "success",
      ...ciOverrides,
    },
    reviews,
  };
}

function passRecord({ author = REVIEW_BOT, ...overrides } = {}) {
  return {
    id: 812,
    author,
    createdAt: "2026-07-27T23:24:00Z",
    updatedAt: "2026-07-27T23:24:00Z",
    body: JSON.stringify({
      schema: "radulator-independent-review/v1",
      pr: 95,
      verdict: "PASS",
      head_sha: HEAD,
      base_sha: BASE,
      base_ref: "develop",
      pr_updated_at: "2026-07-27T23:23:34Z",
      reviewed_at: "2026-07-27T23:24:00Z",
      reviewer_system: "independent-security-review",
      ...overrides,
    }),
  };
}

function expectBlocked(reason, setup) {
  const result = evaluateGate(setup());
  assert.equal(result.context, REQUIRED_CONTEXT);
  assert.equal(result.conclusion, "failure");
  assert.match(result.summary, reason);
}

// PR #95: a post-merge review record must never establish a merge prerequisite.
expectBlocked(/PR is not open/, () => fixture({
  pr: { state: "closed" },
  reviews: [passRecord({ reviewed_at: "2026-07-27T23:27:23Z" })],
}));

// PR #97: any label mutation during review invalidates the record, including
// ready-for-gate removal immediately before the old merge routine acted.
expectBlocked(/review snapshot changed/, () => fixture({
  pr: { updatedAt: "2026-07-27T23:41:21Z" },
  reviews: [passRecord({ reviewed_at: "2026-07-27T23:23:34Z" })],
}));

expectBlocked(/head SHA does not match/, () => fixture({
  pr: { headSha: "c".repeat(40) },
}));

expectBlocked(/base SHA does not match/, () => fixture({
  pr: { baseSha: "d".repeat(40) },
}));

// Reopening or removing a hold is a state transition: the old snapshot is no
// longer eligible even though the PR is open and CI may still be green.
expectBlocked(/review snapshot changed/, () => fixture({
  pr: { updatedAt: "2026-07-27T23:44:00Z", labels: [] },
}));

expectBlocked(/no valid independent PASS/, () => fixture({ reviews: [] }));

// A malformed newer record from the trusted reviewer must invalidate an older
// PASS rather than silently falling back to it.
expectBlocked(/review record is malformed/, () => fixture({
  reviews: [
    passRecord(),
    {
      id: 813,
      author: REVIEW_BOT,
      createdAt: "2026-07-27T23:25:00Z",
      updatedAt: "2026-07-27T23:25:00Z",
      body: "not a durable review record",
    },
  ],
}));

expectBlocked(/not independent/, () => fixture({
  reviewBotLogin: CLOUD_MERGE_BOT,
  cloudMergeBotLogin: CLOUD_MERGE_BOT,
  reviews: [passRecord({ author: CLOUD_MERGE_BOT })],
}));

expectBlocked(/base ref does not match/, () => fixture({
  pr: { baseRef: "main" },
}));

expectBlocked(/created before the reviewed PR snapshot/, () => fixture({
  reviews: [passRecord({ pr_updated_at: "2026-07-27T23:25:00Z", reviewed_at: "2026-07-27T23:24:00Z" })],
  pr: { updatedAt: "2026-07-27T23:25:00Z" },
}));

for (const verdict of ["CHANGES", "HOLD"]) {
  expectBlocked(new RegExp(`verdict ${verdict}`), () => fixture({
    reviews: [passRecord({ verdict })],
  }));
}

expectBlocked(/no valid independent PASS/, () => fixture({
  reviews: [passRecord({ author: "implementation-worker" })],
}));

expectBlocked(/Required CI is not green/, () => fixture({
  ci: { "Targeted Calculator Tests": "failure" },
}));

expectBlocked(/hold label is present/, () => fixture({
  pr: { labels: ["hold"] },
}));

expectBlocked(/hold label is present/, () => fixture({
  pr: { labels: ["cancelled"] },
}));

{
  const result = evaluateGate(fixture());
  assert.equal(result.conclusion, "success");
  assert.equal(result.context, "Radulator Independent Review (exact head)");
  assert.equal(result.headSha, HEAD);
  assert.equal(result.baseSha, BASE);
  assert.equal(result.fingerprint.length, 64);
  assert.equal(
    result.fingerprint,
    createHash("sha256").update(result.record.canonical, "utf8").digest("hex")
  );
}

{
  const before = fixture();
  const after = fixture({ pr: { labels: ["hold"] } });
  assert.notEqual(
    gateStateFingerprint(before),
    gateStateFingerprint(after),
    "the final re-fetch must detect a label mutation even when the head SHA is unchanged"
  );
}

console.log("independent review exact-head gate tests passed");
