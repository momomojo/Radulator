# Risk-Tiered Autonomous Release Design

## Outcome

Radulator feedback work moves without an owner handoff from an implementation commit through independent clinical judgment, protected-branch merge, GitHub Pages deployment, live smoke testing, and retained learning. The system fails closed: missing, stale, conflicting, or malformed evidence can never publish.

## Safety and authority model

- Workers may create commits and pull requests but may not push directly to `develop` or `main`.
- GitHub Actions is the sole merge identity. It may merge only the exact PR head that has exact-head CI and valid judge attestations.
- A standard-risk change requires one PASS from the primary clinical judge.
- A high-risk change requires PASS from both the primary clinical judge and the independent verification judge.
- The two judge identities use separate Ed25519 signing keys and separate Hermes profiles. The private keys stay on the Mac mini; GitHub receives only the public keys.
- Any new commit, base-branch advance, relevant label transition, failed check, valid signed NEEDS_FIX verdict, or absent required signature invalidates authorization. Malformed or unverifiable outsider carriers never contribute authority or veto a valid signed quorum.
- Attestations authorize review and merge of one exact state only. They do not grant general repository access.

## Risk classification

The trusted gate computes risk from the complete GitHub PR file list and patch; the judge cannot lower it. Because GitHub caps the PR-files endpoint at 3,000 files, the gate refuses incomplete evidence or any PR above that bound.

High risk includes:

- any production calculator implementation change under `src/components/calculators/`, except feedback-only components;
- shared calculator execution, input/UI primitives, result-display, URL-state, context, or report-snippet code that can affect clinical inputs or outputs;
- missing/truncated patch data for a clinical runtime or clinical documentation file;
- calculator documentation changes that add or remove formulas, numeric thresholds, score boundaries, units, dosage, contraindications, interpretations, management recommendations, follow-up intervals, staging, or guideline versions;
- any explicit high-risk declaration in the PR evidence.

All other changes are standard risk. Clinical wording, citations, and usability changes therefore receive at least one clinical judge; formula/threshold/management changes receive two.

## Exact-state attestation

Schema `radulator-clinical-attestation/v1` contains:

- repository id, PR number, exact head SHA, base SHA, and base ref;
- state epoch and relevant-label digest;
- deterministic risk classification and changed-files digest;
- exact CI check names, run/check ids, conclusions, completion times, and evidence digest;
- verdict (`PASS` or `NEEDS_FIX`), clinical analysis, and citations;
- judge key id, judge role, Hermes profile, model/provider declaration, and review time;
- an Ed25519 signature over canonical JSON excluding the signature field.

The carrier is a GitHub PR comment containing the canonical signed record. Carrier identity is informational; cryptographic signature, exact-state binding, and configured public-key role are authoritative. High-risk quorum additionally requires distinct profile identities and distinct normalized public-key fingerprints, so one credential cannot impersonate both roles. Any valid signed NEEDS_FIX is terminal for its unchanged exact state; unsigned, malformed, or unverifiable carriers are ignored and reported without gaining veto authority.

## Review handoff

Git commit SHA is the review artifact. Large Kanban archives are not required. A small lifecycle manifest points to the exact commit, PR, changed-files digest, CI evidence digest, judge verdict ids, deploy run, and smoke result. All readbacks verify ids and hashes.

The Mac mini judge collector discovers open `ready-for-gate` PRs, obtains the exact diff and CI evidence from GitHub, writes an atomic candidate cache, and prints self-contained review context to a fresh Hermes cron session. The agent returns PASS or NEEDS_FIX through the signer, which re-fetches GitHub state before signing and posting.

## Merge and deployment

The trusted gate publishes the fingerprint-bearing check `Radulator Clinical Release Gate (exact head)` and the suite-independent, App-bound required status `Radulator Clinical Release Authorization`. A separate trusted workflow verifies both, re-evaluates the exact state, and calls GitHub's merge endpoint with the expected head SHA. Branch protection and required checks remain in force.

- Feature PRs merge into `develop` after exact smoke/targeted CI and the risk-tiered judge gate.
- The existing promoter opens `develop -> main` PRs.
- Production PRs require smoke, targeted, full-suite CI, and a fresh risk-tiered judge gate over the whole batch.
- A human-token merge to `main` deploys from the normal `push` event. A trusted-controller merge made with `GITHUB_TOKEN` performs an explicit `radulator-auto-merge-deploy` repository dispatch after authoritative merge readback, because its push event cannot start another workflow.
- Deployment authorization independently proves a real main push, the exact current-main merged PR, or the rollback selector's exact last-known-good SHA before checking out the artifact source. A scheduled reconciler retries an absent automatic-merge deployment obligation.
- A trusted controller writes `releases/<authorized-sha>.json` into the completed artifact. Post-deploy smoke must first retrieve that exact immutable marker, then verify the production URL, a known calculator route, and sitemap content.
- If live smoke fails, a rollback workflow redeploys the last successful production SHA and records the failed release for remediation. It does not bypass branch protection or rewrite history.

## Lifecycle retention and learning

The Mac mini controller maintains an append-only JSONL ledger. Each event has an idempotency key, previous-event hash, event hash, source id, task id, PR/head SHA, state, evidence, and timestamp. Valid states are:

`feedback -> implementing -> testing -> review -> needs_fix | approved -> merged_develop -> promotion -> merged_main -> deploying -> deployed -> smoke_passed -> learned -> complete`

Failures enter `needs_fix` or `blocked` with a machine-readable reason and are automatically re-queued when their prerequisite changes. A replay reconstructs current state and never duplicates a child task, PR, verdict, merge, or memory update.

After `smoke_passed`, a fresh Hermes learning job distills only stable information: the feedback symptom, root cause, regression test, released SHA, smoke proof, and reusable rule. It writes a lifecycle `learned` event and retains the concise lesson in the Radulator Hindsight bank. Failed or unshipped experiments are not promoted to durable learning.

## Mac mini installation

Versioned overlay files live under `ops/hermes/radulator/` in this repository. The installer:

- requires an explicit canonical repository path;
- backs up modified job and skill files and verifies both profile configs;
- installs the clinical-judge/controller/learning skills and references versioned repository scripts;
- creates two separate judge signing keys only under an explicit security-sensitive flag and prints public keys only;
- creates/updates primary, verification, lifecycle-controller, and post-smoke learning jobs;
- sets an explicit absolute `workdir` and pinned model/provider, and requires profile-level `xhigh` effort because Hermes has no per-job effort field;
- installs jobs disabled and requires dry-run plus repository self-tests before enabling;
- is idempotent and supports uninstall/restore from its backup manifest.

## Verification

Repository tests cover classifier boundaries, canonical signatures, stale-head rejection, conflicting verdicts, one-vs-two-judge quorum, merge idempotency, lifecycle replay, tamper detection, deployment smoke, and rollback selection. Workflow contract tests execute the scripts rather than searching for source strings.

Staged live verification is:

1. local unit/integration tests;
2. GitHub dry-run gate on a test PR without merge authority;
3. standard-risk non-clinical canary through `develop`;
4. high-risk synthetic canary proving two-judge quorum without merging clinical content;
5. production promotion, deploy, live smoke, and lifecycle/memory readback;
6. rollback drill against a deliberately failing smoke target without changing `main`.
