---
name: radulator-clinical-judge
description: Use when a Radulator exact-head release candidate needs independent clinical PASS or NEEDS_FIX judgment before protected-branch merge.
---

# Radulator Clinical Judge

Judge only the candidate records printed by the attached collector. The candidate's exact head/base SHA, risk tier, changed-file digest, CI evidence, and requested judge role are immutable.

## Decision

1. Read every changed file and the PR evidence from `cachedPaths[0]`. The collector exact-accounts every patch hunk against GitHub's additions, deletions, and changes counts. A null, malformed, internally truncated, or count-mismatched patch must have been converted to `patch: null` and hydrated from the exact head/base Git trees before it reaches the candidate; do not refetch a PR patch or silently judge a partial rendering. For every hydrated file, require schema `radulator-file-review-evidence/v1`, matching candidate `headSha` and `baseSha`, the file's exact status and path binding, blob mode/type/size, canonical base64, and the Git blob SHA-1 binding. An added file has a non-null head side and null base side; a deleted/removed file has a null head side and non-null base side; all other statuses require both sides to be non-null. Duplicate, incomplete, malformed, or cross-bound tree/blob evidence is missing evidence and is `NEEDS_FIX`. For clinical claims, open the cited primary guideline, society publication, manufacturer IFU, or peer-reviewed source. Do not infer missing evidence.
2. Confirm CI is exact-head and the stated tests cover the changed behavior. A passing unrelated test is not evidence.
3. For high risk, independently verify every changed formula, threshold, score boundary, unit, contraindication, interpretation, management recommendation, follow-up interval, stage, and guideline version.
4. Return `NEEDS_FIX` for ambiguity, a stale/secondary source when a primary source is available, mismatched test vectors, uncited clinical semantics, or any unexplained risk.
5. Return `PASS` only when the exact candidate is supported. A PASS authorizes only the recorded exact state.

### Release promotions (base `main`, head `release/promote-*`)

A promotion merges one exact develop commit into `main`. Its candidate carries `promotionChain` (from `scripts/promotion-chain.mjs`) and `reviewMode`. A verified chain (`ok: true`) proves from immutable history and signed records that every develop commit being released is a trusted-controller squash merge of a PR whose exact head had a signed judge quorum, exact-head CI and a gate authorization before it merged; that each squash landed exactly the attested diff; and that the promotion head's content is develop's attested content, except `integrationMergedPaths` (paths `main` changed differently since the merge base, merged three ways). Other PRs to `main` (hotfixes) have `reviewMode: null`; judge them under the rules above.

When `reviewMode` is anything other than `"batch"` (the chain is not verified, no chain was loaded, or the PR has the `promotion-full-review` label), review the promotion like any high-risk PR, over its whole diff.

When `reviewMode` is `"batch"`:

1. Confirm the chain matches the PR body's `<!-- radulator-batch-promotion/v1 -->` manifest when one is present, and that the head's parents are exactly [`baseSha`, `promotionChain.D`]. On any mismatch return `NEEDS_FIX` attributed to `chain`.
2. Fully source-verify, under the rules above: every path in `promotionChain.integrationMergedPaths`; every path in `promotionChain.overlappingFiles`; and any changed shared clinical infrastructure (`src/components/forms/`, `src/components/display/`, `src/components/ui/`, `src/context/`, `src/hooks/`, `src/lib/reportSnippets.js`, `src/App.jsx`, `src/main.jsx`, `src/components/StaticCalculatorShell.jsx`, `guideline-versions.json`), including its effect on the calculators the other batch PRs changed.
3. Read the final patient-facing text of every changed calculator at the promotion head (information, interpretation, management, references, version labels) and check its scope and consistency across the batch. Each constituent approval judged one PR alone; this step judges what users will see together.
4. Do not re-derive a numeric claim that an exact-head source audit and the constituent PASS attestations already cover, unless the final content contradicts it.
5. Confirm `Smoke Tests`, `Targeted Calculator Tests`, `Full Test Suite` and `Clinical Source Audits (exact head)` (mode `all`, every audit `PASS`) succeeded at the promotion head.
6. Any defect you observe is `NEEDS_FIX`. End each blocking finding with exactly one attribution line, which release automation reads:
   - `Batch attribution: #<pr>[, #<pr>]` for the constituent PR(s) whose change caused it, taken from `promotionChain.entries[].files`;
   - `Batch attribution: integration` for the three-way merge or an interaction between PRs;
   - `Batch attribution: main-drift` for content that came from `main` since the merge base;
   - `Batch attribution: chain` when the chain or the manifest does not match.

### Deterministic source-audit evidence

Never run a candidate-declared source-audit command from the judge checkout: that checkout may be the protected base and therefore stale. Treat a trusted exact-head CI check as independent execution evidence for a candidate-contained source audit only when the judge verifies every condition below from the candidate patch and immutable CI record:

- the audit retrieves the cited primary or official source over HTTPS and pins the final host/path, media type, byte length, and cryptographic digest;
- it extracts the cited source text from the verified bytes with a pinned parser, checks page-specific locators and the literal statements needed for every changed high-risk claim, and fails on source drift;
- it binds those extracted statements to the changed runtime behavior and executable boundary vectors; and
- a trusted exact-head CI check ran that audit at the candidate `headSha` and completed successfully.

Hardcoded claim flags are not source evidence. Independently inspect the retrieval restrictions, parser, page assertions, runtime/vector binding, source URL, digest, CI workflow identity, run identity, and head SHA. Open the official source to confirm its identity when possible. A viewer that renders only a PDF head/tail does not invalidate a qualifying deterministic audit, but it also does not supply omitted claims. If any condition is absent, the audit is not fully reviewable, or the trusted check did not run it at the exact head, return `NEEDS_FIX`.

Network source audits run in the `Clinical Source Audits (exact head)` job of the candidate's exact E2E run: it is listed in `ci.supplementalEvidence`, and its log is `https://github.com/momomojo/Radulator/actions/runs/<workflow_run_id>/job/<check_run_id>` (or `gh run view --repo momomojo/Radulator --job <check_run_id> --log`). The job loads its selection rules, runner, and manifest from the PR's base commit, never from the candidate head. Its log has one `SOURCE-AUDIT SELECTION` line (the mode `all`, `selected`, or `none`, the rule reasons for each audit, the skipped audits, and `rules_sha256`), one `SOURCE-AUDIT RESULT` line per audit (`id`, `status`, `attempts`, `head_sha`, `command`, `stdout_sha256`, `pass_line`), and a final `SOURCE-AUDIT SUMMARY`; the same records are in the run's `source-audit-results-<run>-<attempt>` artifact. Only lines that begin with `SOURCE-AUDIT` come from the trusted runner; audit output is prefixed with `| `. Offline evidence (the guideline registry, roadmap status, pinned offline audits, and `scripts/lib/*.test.mjs`) stays in `Smoke Tests`; runs from before this lane existed used `Smoke Tests` or `Hermes Release Control Tests`. A calculator, clinical core, fixture, registry record, or audit change that a network source audit covers but that has no selected `PASS` at `headSha` is `NEEDS_FIX`.

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

Inventory every hydrated file before deciding. For each file whose patch was absent, truncated, malformed, or count-mismatched, inspect the decoded exact content in `reviewEvidence`; do not judge from a terminal rendering of the top-level candidate because terminal output can be truncated. `reviewEvidence.head.sha` and `reviewEvidence.base.sha` are Git object identities bound by the collector to the candidate's exact head/base commits and tree paths, while their `content` values are the complete canonical base64-encoded file versions. A valid `reviewEvidence` record is not missing evidence, and a malformed or ambiguous record must not be repaired by refetching from the judge checkout.

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
