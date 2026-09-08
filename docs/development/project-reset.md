# Project-scoped audit reset — 2026-09-08

Owner approval: current conversation, 2026-09-08. This is an implementation
checkpoint, not a new calculator tracker or clinical certification.

## Scope and outcomes

1. Reconcile the existing delivery branch with current production, preserving
   privacy checks and all signed/native release requirements. Do not activate
   single-main, change protections, or provision a broker.
2. Make the shared browser harness use the exact worktree and a strict dedicated
   port without server reuse. Provide a compact production-preview QA command
   with persistent logs and source/artifact identities.
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
  different checkout. A production-preview smoke saves a concise receipt.
- Build, lint, invariants, focused control/privacy tests and independent review
  cover the final local changes. Required remote checks and signed reviews are
  still separate publication requirements.

## Checkpoint

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
