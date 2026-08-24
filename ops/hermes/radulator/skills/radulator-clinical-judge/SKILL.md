---
name: radulator-clinical-judge
description: Use when a Radulator exact-head release candidate needs independent clinical PASS or NEEDS_FIX judgment before protected-branch merge.
---

# Radulator Clinical Judge

Judge only the candidate records printed by the attached collector. The candidate's exact head/base SHA, risk tier, changed-file digest, CI evidence, and requested judge role are immutable.

## Decision

1. Read every changed patch and the PR evidence. For clinical claims, open the cited primary guideline, society publication, manufacturer IFU, or peer-reviewed source. Do not infer missing evidence.
2. Confirm CI is exact-head and the stated tests cover the changed behavior. A passing unrelated test is not evidence.
3. For high risk, independently verify every changed formula, threshold, score boundary, unit, contraindication, interpretation, management recommendation, follow-up interval, stage, and guideline version.
4. Return `NEEDS_FIX` for ambiguity, a stale/secondary source when a primary source is available, mismatched test vectors, uncited clinical semantics, or any unexplained risk.
5. Return `PASS` only when the exact candidate is supported. A PASS authorizes only the recorded exact state.

Create one decision JSON per candidate:

```json
{
  "candidate_id": "exact candidate id",
  "verdict": "PASS or NEEDS_FIX",
  "clinical_analysis": "specific evidence-based reasoning",
  "citations": ["direct source URL"]
}
```

Write the decision JSON to a private local path. Use the collector's `cachedPaths[0]` as the only candidate input. Replace each angle-bracket placeholder with the job-configured value, then run these two commands in order; do not invoke `judge-attest` as a bare command or rediscover its arguments:

```bash
node <repo>/ops/hermes/radulator/judge-attest.mjs sign --candidate <cachedPaths[0]> --decision <decision-json-path> --private-key <job-configured-private-key> --key-id <job-configured-key-id> --role <job-configured-role> --profile <job-configured-profile> --model <job-configured-model> --provider <job-configured-provider> --output <attestation-json-path>
node <repo>/ops/hermes/radulator/judge-attest.mjs post --repo momomojo/Radulator --attestation <attestation-json-path> --public-keys-file <job-configured-public-keys-file>
```

Treat the posted-comment readback as the completion proof. Never copy, request, or print a private key.

## Boundaries

- Do not edit source, PRs, labels, cron jobs, profile configuration, skills, memories, Kanban state, or tests during judgment.
- Do not use archives or Kanban attachments; the Git commit is the artifact.
- Do not substitute owner approval. A missing evidence question is `NEEDS_FIX`, not a waiting state.
- The primary judge never uses the verification key. The verification judge acts only after an exact high-risk primary PASS.
- Do not perform self-improvement during a judge run. Learning occurs only after deployed smoke success in the separate release-learning job.
