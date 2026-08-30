# Parallel Calculator Audit and Sequential Release Design

## Outcome

Radulator clears the remaining `seed-unverified` calculator registry records through parallel, primary-source research without allowing concurrent agents to race shared clinical or release state. Each calculator is independently reviewed, tested, released, and verified on the public site before the integration lane advances to the next calculator.

The registry is the live queue. The coordinator derives pending work from `verification_status === "seed-unverified"`; no second hand-maintained calculator count or roadmap is introduced.

## Concurrency boundary

Four active roles operate as a wavefront:

1. Three evidence agents each audit one different calculator at a time.
2. The coordinator owns the single integration and release lane.

Evidence agents are read-only. They do not edit files, create branches or PRs, apply labels, invoke release jobs, read credentials, or update the registry. Each agent returns one bounded dossier. When an agent finishes, it receives the next pending calculator that is not already claimed.

The coordinator alone:

- reviews and reproduces agent findings;
- creates a fresh worktree from current `origin/develop`;
- edits calculator, test, documentation, registry, and workflow files;
- commits, pushes, and opens the feature PR;
- applies `ready-for-gate` only after exact-head CI passes;
- invokes the existing signed review jobs;
- verifies controller merge, promotion, deployment, release marker, and live browser behavior;
- removes the completed worktree and advances the queue.

Only one calculator may be in the integration/release lane at once. Research for later calculators continues while that release is in CI or review.

## Evidence-agent dossier

Every dossier must identify:

- calculator id, implementation path, existing tests, and implemented version claim;
- authoritative primary or official source URLs and exact document/version identity;
- source locators for every formula, coefficient, unit, threshold, boundary, classification, interpretation, or management statement used by the calculator;
- independently calculated representative, exact-boundary, adjacent-boundary, invalid-input, and unit-equivalence vectors as applicable;
- discrepancies between source, runtime, tests, documentation, and current live behavior;
- unsupported or overbroad clinical claims;
- source-access limitations, ambiguity, proprietary-material dependency, or conflicts;
- a recommended disposition: `correct-and-verify`, `verify-without-behavior-change`, `nonclinical-functional-audit`, or `remain-unverified`.

Agents must distinguish direct source support from inference. Search snippets, secondary summaries, current tests, and the calculator's own citations are discovery aids, not verification evidence.

## Source and audit contract

The coordinator accepts a dossier only after independently opening the cited source and reproducing its critical claims and arithmetic.

For an accepted clinical calculator:

- prefer an official immutable PDF or primary-publication artifact;
- constrain redirects, host, path, media type, and size;
- pin exact bytes and SHA-256 when the official artifact is stable;
- if official HTML contains narrowly identified request tokens, canonicalize only those named volatile fields, assert their exact occurrence count, and pin canonical bytes and SHA-256;
- enforce semantic source locators rather than whole-document string presence;
- parse or otherwise bind the runtime formula and boundaries to the source audit;
- execute named fixture vectors through the real calculator implementation;
- commit no copyrighted source bytes unless redistribution is explicitly permitted.

Registry status changes to `verified` only when exact executable evidence and the deterministic source audit pass in trusted exact-head CI. A source outage, inaccessible manual, ambiguous boundary, or unresolved contradiction remains fail-closed.

## Per-calculator integration lifecycle

For each accepted dossier, the coordinator performs this sequence:

1. Fetch current `origin/develop`; create one isolated calculator worktree and branch.
2. Write a failing regression/source-contract test before production changes.
3. Correct only source-supported discrepancies. Preserve permanent calculator ids and unrelated behavior.
4. Add canonical compute fixtures, boundary cases, safety wording, documentation, and registry evidence.
5. Run `npm ci`, source audit, registry test, compute fixtures, calculator-specific Playwright tests, build, lint, and invariants. Run the full Playwright suite for calculator logic changes.
6. Hostile-review the complete diff and verify no unrelated/generated/roadmap changes.
7. Rebase on current `origin/develop`, rerun affected gates, push the feature branch, and open a PR targeting `develop`.
8. Wait for exact-head smoke and targeted CI before applying `ready-for-gate`.
9. Require a signed primary PASS; require independent primary and verification PASSes for formula, threshold, management, or other high-risk changes. Any new head invalidates prior attestations.
10. Let the trusted controller merge; never merge manually.
11. Promote the resulting `develop` head alone to `main`, require the full production suite and fresh production-head review quorum, then let the controller merge.
12. Verify the deployment run and immutable release marker for exact `main` SHA.
13. Drive the public calculator in a real browser across representative and boundary vectors, source links, safety text, responsive usability, and unexpected console errors.
14. Remove the feature worktree and start integration of the next ready dossier.

## Failure and rework rules

- A reviewer `NEEDS_FIX` immediately removes merge readiness. The coordinator fixes the same PR, creating a new SHA and fresh CI/reviews.
- A flaky test is reproduced in isolation and in a clean full rerun; it is never silently waived.
- A source retrieval failure is not evidence that the implementation is correct.
- An agent disagreement is resolved by direct source readback and independent arithmetic; uncertainty leaves the record unverified.
- If a calculator depends on unavailable proprietary content, the coordinator may improve clearly independent safety/usability issues only when separately authorized, but may not claim full source verification.
- If a production smoke or browser check fails, the lane stops. Existing rollback controls operate before any later calculator enters integration.
- The existing unrelated PR #176 is not modified. Before every branch or PR, the coordinator reads current branch and open-PR state so an external merge cannot create stale-base work.

## Ordering

The first research wave is:

- AAST Trauma Grading;
- ASPECTS Score;
- Fleischner Pulmonary Nodule Guidance.

After a lane returns, the coordinator refills it from the pending registry using this order:

1. high-use clinical classifications and primary models with open authoritative sources;
2. interventional and dose/measurement tools;
3. patient-reported instruments and manufacturer-reference tools, which may have licensing or redistribution constraints;
4. the feedback form as a nonclinical functional/security audit.

Release order follows dossier readiness, clinical risk, and source completeness, not agent completion time alone. Each release remains one calculator.

## Verification of the workflow itself

The first three calculators are the canary wave. After they finish research, the coordinator checks that:

- no two agents touched shared state;
- every dossier supplied reproducible claims and vectors;
- integration did not begin from stale `develop`;
- each production PR contained exactly one calculator's release delta;
- exact-head reviews, deployment marker, and live browser evidence remained attributable to that calculator;
- agent findings that failed review were corrected in the dossier prompt before the next wave.

No new persistent scheduler, database, plugin, or queue service is added. The existing registry, Git branches, CI, signed judges, trusted controller, release marker, and browser verification are sufficient.

## Completion

The batch is complete only when every initially pending registry record has one of two evidence-backed outcomes:

1. `verified`, with source claims, executable vectors, exact-head CI/review evidence, production deployment, and live calculator QA; or
2. still unverified, with a precise documented blocker that identifies the missing or conflicting authority and does not overstate correctness.

A green build, an open PR, an agent report, or a registry label without executable evidence is never completion.
