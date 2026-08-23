#!/usr/bin/env node
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";

import {
  ATTESTATION_SCHEMA,
  canonicalJson,
  classifyRisk,
  digest,
  evaluateAttestationQuorum,
  requiredJudgeRoles,
  verifyAttestation,
} from "./release-policy.mjs";

const HEAD = "a".repeat(40);
const BASE = "b".repeat(40);

function keyFixture(keyId, role, profile) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    keyId,
    role,
    profile,
    privateKey,
    publicKey: publicKey.export({ type: "spki", format: "pem" }),
  };
}

const PRIMARY = keyFixture("primary-2026-08", "primary", "radulator");
const VERIFICATION = keyFixture("verification-2026-08", "verification", "default");
const PUBLIC_KEYS = {
  [PRIMARY.keyId]: {
    role: PRIMARY.role,
    profile: PRIMARY.profile,
    publicKey: PRIMARY.publicKey,
  },
  [VERIFICATION.keyId]: {
    role: VERIFICATION.role,
    profile: VERIFICATION.profile,
    publicKey: VERIFICATION.publicKey,
  },
};

function stateFixture(risk) {
  const ci = [{
    name: "Smoke Tests",
    app_id: 15368,
    check_run_id: 7001,
    check_suite_id: 6001,
    workflow_id: 5001,
    workflow_run_id: 4001,
    run_attempt: 1,
    head_sha: HEAD,
    conclusion: "success",
    completed_at: "2026-08-23T20:00:00Z",
  }];
  return {
    repositoryId: 1027532341,
    pr: 123,
    headSha: HEAD,
    baseSha: BASE,
    baseRef: "develop",
    stateEpoch: { event_id: 77, event_created_at: "2026-08-23T19:55:00Z" },
    labelsSha256: digest(["ready-for-gate"]),
    risk,
    ci,
    ciSha256: digest(ci),
  };
}

function signedRecord(key, exactState, overrides = {}) {
  const record = {
    schema: ATTESTATION_SCHEMA,
    repository_id: exactState.repositoryId,
    pr: exactState.pr,
    head_sha: exactState.headSha,
    base_sha: exactState.baseSha,
    base_ref: exactState.baseRef,
    state_epoch: exactState.stateEpoch,
    labels_sha256: exactState.labelsSha256,
    risk: exactState.risk,
    ci: exactState.ci,
    ci_sha256: exactState.ciSha256,
    verdict: "PASS",
    clinical_analysis: "The exact diff and required test evidence support release.",
    citations: ["https://example.org/source"],
    judge: {
      key_id: key.keyId,
      role: key.role,
      profile: key.profile,
      model: "gpt-5.6-sol",
      provider: "openai-codex",
    },
    reviewed_at: "2026-08-23T20:01:00Z",
    ...overrides,
  };
  record.signature = sign(null, Buffer.from(canonicalJson(record)), key.privateKey).toString("base64");
  return record;
}

const feedbackRisk = classifyRisk([{
  filename: "src/components/calculators/FeedbackForm.jsx",
  status: "modified",
  patch: "@@ -1 +1 @@\n-old label\n+clearer feedback label",
}]);
assert.equal(feedbackRisk.tier, "standard");
assert.deepEqual(requiredJudgeRoles(feedbackRisk.tier), ["primary"]);

const calculatorFiles = [{
  filename: "src/components/calculators/MELDNa.jsx",
  status: "modified",
  patch: "@@ -10 +10 @@\n-const score = 1\n+const score = 2",
}];
const calculatorRisk = classifyRisk(calculatorFiles);
assert.equal(calculatorRisk.tier, "high");
assert.ok(calculatorRisk.reasonCodes.includes("CLINICAL_RUNTIME_CHANGE"));
assert.deepEqual(requiredJudgeRoles(calculatorRisk.tier), ["primary", "verification"]);
assert.equal("files" in calculatorRisk, false, "signed risk metadata never embeds changed patches");

for (const filename of [
  "src/App.jsx",
  "src/components/StaticCalculatorShell.jsx",
  "src/components/forms/Field.jsx",
  "src/components/display/ResultDisplay.jsx",
  "src/components/ui/input.jsx",
  "src/components/ui/select.jsx",
  "src/components/ui/switch.jsx",
  "src/context/CalculatorContext.jsx",
  "src/hooks/useUrlSync.js",
  "src/lib/reportSnippets.js",
]) {
  const sharedRuntimeRisk = classifyRisk([{
    filename,
    status: "modified",
    patch: "@@ -1 +1 @@\n-return oldValue\n+return newValue",
  }]);
  assert.equal(sharedRuntimeRisk.tier, "high", `${filename} can change shared clinical inputs or outputs`);
}

const thresholdRisk = classifyRisk([{
  filename: "docs/calculators/hepatology/meld-na.md",
  status: "modified",
  patch: "@@ -20 +20 @@\n-Use a score above 20\n+Use a threshold of 18",
}]);
assert.equal(thresholdRisk.tier, "high");

const missingPatchRisk = classifyRisk([{
  filename: "docs/calculators/hepatology/meld-na.md",
  status: "modified",
  patch: null,
}]);
assert.equal(missingPatchRisk.tier, "high");
assert.ok(missingPatchRisk.reasonCodes.includes("CLINICAL_DOCUMENT_PATCH_MISSING"));

const explicitHighRisk = classifyRisk([{
  filename: "README.md",
  status: "modified",
  patch: "@@ -1 +1 @@\n-old\n+new",
}], { title: "Improve copy", body: "Risk-Tier: high" });
assert.equal(explicitHighRisk.tier, "high");
assert.ok(explicitHighRisk.reasonCodes.includes("EXPLICIT_HIGH_RISK"));

const renamedClinicalRisk = classifyRisk([{
  filename: "archive/meld-na.md",
  previous_filename: "docs/calculators/hepatology/meld-na.md",
  status: "renamed",
  changes: 0,
  patch: null,
}]);
assert.equal(renamedClinicalRisk.tier, "high");
assert.ok(renamedClinicalRisk.reasonCodes.includes("CLINICAL_DOCUMENT_PATCH_MISSING"));

const truncatedClinicalPatchRisk = classifyRisk([{
  filename: "docs/calculators/hepatology/meld-na.md",
  status: "modified",
  changes: 10,
  additions: 5,
  deletions: 5,
  patch: "@@ -1 +1 @@\n-old\n+new",
}]);
assert.equal(truncatedClinicalPatchRisk.tier, "high");
assert.ok(truncatedClinicalPatchRisk.reasonCodes.includes("CLINICAL_DOCUMENT_PATCH_TRUNCATED"));

assert.notEqual(
  classifyRisk([{ filename: "README.md", status: "modified", patch: "+new" }], { body: "Risk: high" }).evidenceSha256,
  classifyRisk([{ filename: "README.md", status: "modified", patch: "+new" }], { body: "Risk: standard" }).evidenceSha256,
  "PR evidence is part of the exact risk record",
);

const reorderedRisk = classifyRisk([...calculatorFiles].reverse());
assert.equal(calculatorRisk.filesSha256, reorderedRisk.filesSha256);

const manyClinicalRisk = classifyRisk(Array.from({ length: 3000 }, (_, index) => ({
  filename: `src/components/calculators/generated-${index}.jsx`,
  status: "modified",
  patch: "@@ -1 +1 @@\n-return oldValue\n+return newValue",
})));
assert.equal(manyClinicalRisk.reasonCount, 3000);
assert.ok(JSON.stringify(manyClinicalRisk).length < 2000, "signed risk metadata is bounded independently of file count");

const standardState = stateFixture(feedbackRisk);
const primaryPass = signedRecord(PRIMARY, standardState);
assert.equal(verifyAttestation(primaryPass, PUBLIC_KEYS, standardState).ok, true);
assert.deepEqual(evaluateAttestationQuorum([primaryPass], PUBLIC_KEYS, standardState), {
  ok: true,
  reasonCode: "ATTESTATION_QUORUM_PASS",
  roles: ["primary"],
});

const missingCitation = signedRecord(PRIMARY, standardState, { citations: [] });
assert.equal(verifyAttestation(missingCitation, PUBLIC_KEYS, standardState).reasonCode, "MALFORMED_ATTESTATION");
const missingProvider = signedRecord(PRIMARY, standardState, { judge: { ...primaryPass.judge, provider: "" } });
assert.equal(verifyAttestation(missingProvider, PUBLIC_KEYS, standardState).reasonCode, "MALFORMED_ATTESTATION");

const mutated = structuredClone(primaryPass);
mutated.clinical_analysis = "Changed after signing";
assert.equal(verifyAttestation(mutated, PUBLIC_KEYS, standardState).reasonCode, "INVALID_SIGNATURE");
assert.equal(
  evaluateAttestationQuorum([mutated, primaryPass], PUBLIC_KEYS, standardState).ok,
  true,
  "an unsigned forged carrier cannot veto a valid signed quorum",
);

const staleState = { ...standardState, headSha: "c".repeat(40) };
assert.equal(verifyAttestation(primaryPass, PUBLIC_KEYS, staleState).reasonCode, "ATTESTATION_STATE_MISMATCH");

const highState = stateFixture(calculatorRisk);
const highPrimary = signedRecord(PRIMARY, highState);
assert.equal(evaluateAttestationQuorum([highPrimary], PUBLIC_KEYS, highState).reasonCode, "MISSING_JUDGE_ROLE");

const highVerification = signedRecord(VERIFICATION, highState, { reviewed_at: "2026-08-23T20:02:00Z" });
assert.deepEqual(evaluateAttestationQuorum([highPrimary, highVerification], PUBLIC_KEYS, highState), {
  ok: true,
  reasonCode: "ATTESTATION_QUORUM_PASS",
  roles: ["primary", "verification"],
});

const sameProfileVerification = signedRecord(VERIFICATION, highState, {
  judge: { ...highVerification.judge, profile: PRIMARY.profile },
  reviewed_at: "2026-08-23T20:03:00Z",
});
const sameProfileKeys = structuredClone(PUBLIC_KEYS);
sameProfileKeys[VERIFICATION.keyId].profile = PRIMARY.profile;
assert.equal(
  evaluateAttestationQuorum([highPrimary, sameProfileVerification], sameProfileKeys, highState).reasonCode,
  "JUDGE_PROFILE_NOT_INDEPENDENT",
);

const needsFix = signedRecord(PRIMARY, standardState, {
  verdict: "NEEDS_FIX",
  clinical_analysis: "The cited evidence does not support the changed interpretation.",
  reviewed_at: "2026-08-23T20:03:00Z",
});
assert.equal(evaluateAttestationQuorum([primaryPass, needsFix], PUBLIC_KEYS, standardState).reasonCode, "NEEDS_FIX");

const laterPassOnRejectedHead = signedRecord(PRIMARY, standardState, {
  reviewed_at: "2026-08-23T20:04:00Z",
});
assert.equal(
  evaluateAttestationQuorum([needsFix, laterPassOnRejectedHead], PUBLIC_KEYS, standardState).reasonCode,
  "NEEDS_FIX",
  "a later PASS cannot supersede NEEDS_FIX for the unchanged exact state",
);

const wrongRole = signedRecord(PRIMARY, highState, {
  judge: { ...highPrimary.judge, role: "verification" },
  reviewed_at: "2026-08-23T20:04:00Z",
});
assert.equal(verifyAttestation(wrongRole, PUBLIC_KEYS, highState).reasonCode, "JUDGE_IDENTITY_MISMATCH");

console.log("risk-tiered release policy tests passed");
