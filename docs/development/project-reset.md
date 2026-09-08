# Project-scoped audit reset — 2026-09-08

Owner approval: current conversation, 2026-09-08. This is an implementation
checkpoint, not a new calculator tracker or clinical certification.

## Scope and outcomes

1. Deliver a pure-control change relative to protected develop. Verify that its
   controller-created squash and subsequent production promotion preserve the
   already-live runtime and privacy checks. Do not activate single-main, change
   protections, or provision a broker.
2. Make the shared browser harness use the exact worktree and a strict dedicated
   port without server reuse. The compact production-preview receipt command is
   implemented in the retained pre-split commit but deferred from this release
   because it depends on main-only privacy build support.
3. Add programmatic PubMed research retrieval and offline integrity verification:
   official APIs, exact identifiers, structured abstracts, correction/retraction
   relationships, legal full-text availability, immutable response hashes and
   explicit clinical-review limits. No new database, model server or paid API.
4. Consolidate project instructions around one whole calculator's supported
   scope; independent bounded reviews; evidence reuse; focused local tests and
   unchanged protected release gates.

## Constraints and integration decisions

- Research retrieval verifies citation identity and cached bytes, not clinical
  truth. Actual source review and independent expected answers remain required.
- Public literature queries only: no patient data, inputs, results or secrets.
- Keys stay in the host environment; request receipts and errors omit them.
- Raw research material stays in the local Git common-directory cache and is
  not redistributed or committed automatically.
- The research CLI and QA harness are independent. They share only npm command
  registration and these instructions, edited by the coordinating owner.
- Existing privacy and deployment tests remain required. Source caches do not
  grant permission to reuse stale signed approvals.
- Use the existing isolated release-simplification worktree. Preserve all other
  worktrees, unfinished calculator edits and Wells close-out receipts.

## Acceptance

- Test-first regressions cover wrong/missing IDs, DOI mismatch, retraction
  notices, unavailable full text, malformed responses, cache tampering and
  secret-free requests/receipts.
- A live public research lookup and repeat offline verification succeed without
  a key; access failures remain accurately labeled.
- Browser configuration rejects invalid/occupied ports and cannot reuse a
  different checkout. The compact receipt runner has separate later acceptance.
- Build, lint, invariants, focused control/privacy tests and independent review
  cover the final local changes. Required remote checks and signed reviews are
  still separate publication requirements.

## Historical pre-split checkpoint

The following results describe retained commit
`f79c684cb586251263672a44918d82ac83f091b2`, not the narrowed candidate below.
That mixed clinical/control candidate is not eligible for release. Its files and
local receipts remain recoverable from the commit and worktree evidence paths.

- Current production incorporated locally: `941d67b95af5aadd6875bc9e7dd5f807a139d23f`.
- Active release mode is unset: existing release-train remains authoritative.
- Installed and enabled `pubmed@life-sciences` version `1.0.0` through Codex CLI.
  The official Anthropic marketplace was inspected at commit
  `e96556b637b56d6cc3a5ad33987009be9e60aa5c`; it has no PubMed local hooks/scripts.
  An unauthenticated `get_article_metadata` call returned PMID `25512453` and its
  expected title. This is an Anthropic-hosted discovery connector; the retained
  CLI evidence route connects directly to NCBI. No extra account/key required.
- Research tests reproduced and fixed cache-pointer PMID substitution, integrity
  checking of metadata-only PMC bytes, and nested section locator ambiguity.
  Independent scoped re-review accepted those fixes. No clinical verdict implied.
- Local implementation and independent code/spec review: complete.
- Canonical lint/invariants pass. The scratch-only lint failure was corrected by
  ignoring `.superpowers`, with maintained app/test files still checked.
- 15 deterministic research tests and 9 QA harness tests pass. The harness test
  includes actual refusal of an occupied HTTP server, leaving that server alive.
- Configured production build/privacy artifact checks pass. Browser receipts:
  `test-results/local-qa/run-CSwz48/receipt.json` (23 smoke/privacy/error-boundary
  passes) and `test-results/local-qa/run-yOzIm8/receipt.json` (12 KBRC passes,
  including static-route hydration). Both have zero skips/failures/flaky tests,
  unchanged source/artifact checks and retained manifests/logs.
- Initial smoke proof `run-axamn2` correctly failed on one skipped static-route
  test. Smoke and KBRC now derive preview applicability from actual server-mode
  metadata, not a magic port. The independent reviewer accepted this small fix.
- Selected release-policy, workflow-permission, artifact-verification and privacy
  root-error tests pass. Production privacy runtime is byte-identical to main.
- Direct NCBI live search and metadata retrieval pass. PMID `25512453` and
  `30482764` accurately retain metadata-only/full-text-unavailable outcomes;
  PMID `42504234`, DOI `10.1002/hsr2.72892`, supplied full-text XML, which also
  passed subsequent offline integrity verification. These are retrieval probes,
  not newly accepted clinical evidence for calculator rules.
- Exact-head remote CI/signed reviews, protected merge, rollback rehearsal and
  single-main activation/canary are still outstanding. No production deployment,
  reviewer configuration or native protection was changed by this reset.

## Pure-control release split — 2026-09-08

The actual ready-gate check rejected the pre-split PR with
`MIXED_TRUST_DOMAIN_CHANGE`: its main import mixed already-live clinical changes
with new release controls relative to develop. Readiness was withdrawn. The
current candidate restores those imported runtime/evidence/privacy files to
exact develop `e3682c844e436c266ba49ae55132ef3b0d2927cd`; it does not revert them
on production. The existing trusted controller squashes a develop PR before
the promoter merges current main with develop. Recheck that topology and the
actual promotion tree before release; never manually merge this feature branch
straight to main.

Retained here: release controls, strict worktree-aware Playwright configuration,
seven configuration tests, the research CLI and15 research tests, and concise
instructions. Deferred from this candidate: `qa:local`, its runner/two tests,
and the accompanying clinical-spec port corrections. Main-only privacy package
commands, scripts, runtime and workflow steps must remain in the production
merge. Restore the deferred receipt runner in a later control-only PR after the
protected migration makes that existing production support the normal base.

Independent planning simulated the squash/promotion and preserved the entire
current-main source tree, clinical tests/evidence and privacy build/runtime.
The coordinating owner repeated that proof on the actual narrowed tree against
main `be969cc11191a1d8767d08e30560b525a788b19c`: the trusted develop classifier
reported only `RELEASE_CONTROL_CHANGE`, and the clean simulated promotion kept
those source/evidence/privacy paths unchanged, including all four privacy
commands and both workflow steps. Refresh this proof if either branch changes.
Fresh15 research tests, seven QA configuration tests, build, lint, invariants,
release-policy, merge, workflow-permission, authorization, artifact, marker,
smoke and rollback tests passed. Independent narrowing review found no blocker.
This is local/simulated evidence, not signed authorization or a live rollback
rehearsal. The active main/develop
rulesets already require signed clinical authorization and strict checks; those
settings were read, not changed. Release mode remains unset/release-train.

Signed review also has a separate operational blocker: the unchanged primary
Hermes reviewer failed before reviewing because its Codex refresh token is
invalid. Reconnect that existing provider on the Mac mini; do not replace its
signature with owner/subagent approval or weaken the gate. No model, key,
credential, scheduler, native-protection or production changes were made.
