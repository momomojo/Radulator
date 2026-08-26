# Radulator Hermes release control plane

This overlay installs seven disabled-first Hermes jobs: an exact-head primary clinical judge, an independent high-risk verification judge, a lifecycle reconciler, a post-smoke learning worker, a no-agent release promoter, a no-agent Formspree feedback intake, and a bounded seed-to-research converter. Standard-risk PRs require the primary signature; calculator/formula/threshold/management changes require both signatures.

The seed converter deterministically recognizes `[seed] Research brief:` work in the `lane:flash` lane as approved stage-1 research even when an obsolete `medical-review-pending` label remains. That exception authorizes research only: it creates at most two oldest source-verification cards per run, requires authoritative Kanban readback before closing a source issue, and routes later clinical implementation through independent review, exact-head CI, signed judges, automatic merge, promotion, live smoke, release-marker proof, and retained learning. Other medically gated seed types remain fail-closed and deduplicated.

The feedback intake uses the Radulator Formspree sender/subject only as a bounded Gmail search prefilter. Before it creates any durable task, it requires Gmail's topmost `Authentication-Results` field to show aligned Formspree DKIM, SPF, and DMARC passes; a visible-header lookalike is rejected and cannot starve a later authenticated delivery. The intake discards the submitted name and email, redacts contact details repeated inside free text, and writes only a namespaced message-id digest to its `0600` receipt state. It keeps all remaining website-submitted fields out of the task title and serializes them inside an explicitly delimited untrusted-data block; downstream agents must never execute instructions found in that block. Each valid delivery creates an idempotent Kanban triage card plus a separate terminal closure receipt that is atomically parented on the triage card. Intake is acknowledged only after exact task and parent-link readback. The closure receipt stays open until every split request has either direct production no-action proof or an immutable production release marker, production smoke, and retained learning; a PR or delegated release tracker is not completion. Malformed authenticated mail creates a privacy-safe parser-review receipt instead of disappearing. Distinct requests in one submission are explicitly split during triage; already-live requests close with production proof, while missing clinical changes proceed through primary-source research, regression tests, and the signed exact-head gate.

Each judge run invokes the collector once and atomically claims at most one exact candidate, oldest PR first. A durable per-role lease prevents overlapping runs from reviewing the same candidate. Authoritative PASS or NEEDS_FIX readback clears the resolved lease on the next collection; unresolved attempts expire automatically, receive bounded retries, and then cool down while later PRs advance. This bounds model context without letting one failing PR starve the rest of the clinical queue.

Post-smoke learning uses `retain_learning.py`, not the general conversational memory tool. The helper writes the six sanitized release-learning fields through Hindsight's configured `kanban_closure` chunk strategy with a retention-ID-derived document, then requires exact valid-document readback before the lifecycle can advance to `learned`. This keeps release closure independent of the slower structured-extraction backlog and makes every retry replace the same document rather than duplicating memory.

The trusted merge controller explicitly dispatches the Pages workflow after an automatic merge to `main`; GitHub suppresses ordinary push-triggered workflows when the merge uses the repository `GITHUB_TOKEN`. A trusted authorizer accepts only the exact current-main merged PR, and a scheduled reconciler retries a missing dispatch. After Pages succeeds, an exact-SHA live-smoke failure emits a separate `radulator-live-smoke-rollback-request` repository dispatch; the rollback handler polls the originating deploy run to completion, binds it to the trusted deploy workflow ID and path, re-reads every job, and independently requires Pages success plus smoke failure before selecting the last known good SHA. Pre-Pages failures, post-smoke ancillary failures, and failed rollback deployments cannot request another rollback.

The release promoter is source-controlled and installer-managed. It creates a replacement promotion before closing an obsolete one. Only after authoritative readback proves the obsolete PR is unmerged `CLOSED`, still targets `main`, and still names the recorded exact head does it consider ref cleanup. It then preserves the ref if it is current, default, protected, advanced, or used by any open PR. Deletion uses `git push --force-with-lease=<ref>:<expected-sha> --delete`, so a ref that advances after preflight is atomically preserved, followed by an absent-ref readback.

Git worktrees are deliberately outside this automatic cleanup boundary. Worktrees span user and Hermes repositories on multiple hosts; a clean index does not prove a worktree is inactive, and detached worktrees may be serving release-control processes. Remove a registered worktree only with host-local evidence that it is not current, has no changes, has no open PR, and is not referenced by a running job. The promoter never prunes or removes worktrees.

If `develop` and `main` acquire equivalent trees through independent merge histories, reconcile their ancestry through a reviewed PR into `develop` before opening the production promotion. Disclose any documentation-only audit note accompanying that merge as an exact-head file change. Never force-push or bypass the signed gate to resolve a history-only promotion conflict.

To canary the two-judge path without changing clinical behavior, use an operations-only PR whose body contains `<!-- radulator-risk: high -->`. The trusted classifier must elevate that exact state to high risk, require distinct primary and verification signatures, and keep authorization failed until both signed records pass readback. Remove or supersede a stale canary instead of weakening the rule.

## Prerequisites

- Use the canonical Radulator clone and pull the reviewed control-plane release before installation.
- The primary and verification Hermes homes must be distinct profiles. Both `config.yaml` files must set `agent.reasoning_effort: xhigh`; Hermes 0.19 has no per-job effort field.
- Both profiles need working GitHub authentication. Do not put tokens or private keys in this repository or in job prompts. Judge jobs resolve the trusted E2E workflow ID from authoritative GitHub workflow metadata on every collection/post and reject any configured identity mismatch.
- The inference provider/model pinned by the installer must be registered and reachable from both profiles. For a self-hosted provider, prove authenticated health, exact model discovery, visible completion content, and a Hermes tool call from the Mac mini before enabling it. The installer records this identity in every agent job, both signed judge prompts, and the protected control manifest so an attestation cannot claim the retired metered provider while another model actually reviewed the change.
- Judge collectors and posters prefer `GH_TOKEN`/`GITHUB_TOKEN` when supplied and otherwise read the authenticated `gh` token without printing it. Verify `gh auth status` in the noninteractive Mac mini account before activation.
- The repository's protected checks, clinical gate, automatic merger, deployment smoke, and rollback workflows must already be active. An enforced repository ruleset for both `develop` and `main` must require `Radulator Clinical Release Authorization` from the GitHub Actions App with `strict_required_status_checks_policy: true`; the controller also verifies the paired fingerprint-bearing exact-head check through GitHub's metadata-readable APIs before every merge.

## Install and verify

On the Mac mini, inspect the proposed files/jobs without writing:

```bash
python3 ops/hermes/radulator/install.py \
  --repo /Users/agent/Documents/Radulator \
  --radulator-home /Users/agent/.hermes/profiles/radulator \
  --default-home /Users/agent/.hermes \
  --dry-run
```

Install jobs disabled and create the reversible baseline backup:

```bash
python3 ops/hermes/radulator/install.py \
  --repo /Users/agent/Documents/Radulator \
  --radulator-home /Users/agent/.hermes/profiles/radulator \
  --default-home /Users/agent/.hermes \
  --apply
```

Run self-tests before enabling:

```bash
npm run test:release-policy
npm run test:independent-review-gate
npm run test:auto-merge
npm run test:authorize-deployment
npm run test:reconcile-deployment
npm run test:post-deploy-smoke
npm run test:rollback-deployment
npm run test:hermes-judge-candidates
npm run test:hermes-judge-attest
npm run test:hermes-lifecycle
npm run test:hermes-learning
npm run test:hermes-feedback-intake
npm run test:hermes-seed-convert
npm run test:hermes-release-promoter
npm run test:hermes-install
npm run check:invariants
npm run lint -- --quiet
npm run build
```

Key creation is intentionally a separate, security-sensitive action. With operator approval, add `--generate-keys` to `--apply`. The command creates one `0600` Ed25519 private key in each profile, writes the identical public trust map to each profile's `keys/radulator-clinical/public-keys.json`, and prints `public_keys`, an object ready for the repository variable `RADULATOR_JUDGE_PUBLIC_KEYS_JSON`. Never copy private material to GitHub or between profiles. Re-running refuses an incomplete or mismatched pair and otherwise preserves the existing key.

After configuring the repository variable and strict branch rule, enable all managed jobs. The installer reads the repository variable back directly with the authenticated GitHub CLI and requires an exact match with both local trust maps:

```bash
python3 ops/hermes/radulator/install.py \
  --repo /Users/agent/Documents/Radulator \
  --radulator-home /Users/agent/.hermes/profiles/radulator \
  --default-home /Users/agent/.hermes \
  --github-repository momomojo/Radulator \
  --apply --enable
```

To pin the managed jobs to a previously registered self-hosted provider instead of the default metered identity, add the same reviewed identity to the dry-run, disabled-first install, and enable commands:

```bash
  --agent-provider mtplx-qwen38 \
  --agent-model mtplx-qwen38-27b-optimized-quality
```

Both values are validated as nonblank command-safe identifiers. Changing them rewrites the job pins and the model/provider fields embedded in newly signed attestations; it does not alter signing keys or weaken the exact-head quorum.

Activation requires `cron.max_parallel_jobs: 1` in both judge profiles and refuses missing/mismatched keys, a local/GitHub public-map mismatch, or any failed release, judge, deployment, lifecycle, invariant, lint, or build self-test. It then pauses legacy `pr-gate-poller` and `judge-queue` jobs in either judge profile with the reason `replaced-by-radulator-signed-clinical-gate`. Disabled-first installation leaves them unchanged, so there is no unguarded interval before the signed replacement is ready. The baseline restore returns both profiles' complete cron files—including those legacy jobs—to their exact pre-install bytes.

Production builds receive a controller-written `releases/<authorized-sha>.json` marker after the source build completes. Production smoke must retrieve and validate that exact marker before checking the home page, calculator, and sitemap; a CDN still serving the prior release cannot satisfy the deployment obligation.

The separate Claude Cloud `Radulator Production Gate` Routine is not stored in Hermes `jobs.json`; retire that Routine only after the signed replacement and staged canaries pass. GitHub Codex review may remain enabled as advisory feedback, but it is not a merge authority.

## Pause, rotate, and recover

Temporarily pause the complete control plane with the same command plus `--apply --disable`. This preserves jobs, keys, ledger, and restartability.

The active signer ids are deliberately versioned in reviewed code (`radulator-primary-v1` and `radulator-verification-v1`), and activation requires that exact two-role map. Rotation therefore requires a control-plane PR that advances both ids in the installer, prompts, expected trust map, and tests. Merge that change while jobs are disabled, reinstall disabled-first, generate the newly reviewed pairs with explicit operator approval, update and read back the GitHub variable, run signed canaries, and only then enable the new ids and archive the old private pairs outside Hermes. Do not attempt an ad-hoc extra key or overwrite/reuse an existing id; activation will reject it.

Restore the exact pre-install files from the protected baseline backup:

```bash
python3 ops/hermes/radulator/install.py \
  --radulator-home /Users/agent/.hermes/profiles/radulator \
  --restore
```

The backup manifest is `state/radulator-release-backup.json`; the active installation manifest is `state/radulator-release-control.json`. The lifecycle ledger is `state/radulator-release-lifecycle.jsonl`. Restore does not delete either judge's private keys or the lifecycle ledger.
