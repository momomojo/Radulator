# Radulator Hermes release control plane

This overlay installs seven disabled-first Hermes jobs plus one permanently paused publisher tombstone: an exact-head primary clinical judge, an independent high-risk verification judge, a lifecycle reconciler, a post-smoke learning worker, a no-agent release promoter, a no-agent Formspree feedback intake, and a bounded seed-to-research converter. Publication is not a Hermes cron job. It runs as a separately provisioned launchd service under a dedicated publisher UID. The tombstone makes upgrades quiesce any older same-UID publisher consumer. The overlay also installs the repo-owned WF-3 guideline/source registry into the existing `radulator-operations` skill reversibly; installer restore returns the authenticated baseline while deliberately keeping every managed-target consumer disabled. Standard-risk PRs require the primary signature; calculator/formula/threshold/management changes require both signatures.

The seed converter deterministically recognizes `[seed] Research brief:` work in the `lane:flash` lane as approved stage-1 research even when an obsolete `medical-review-pending` label remains. That exception authorizes research only: it creates at most two oldest source-verification cards per run, requires authoritative Kanban readback before closing a source issue, and routes later clinical implementation through independent review, exact-head CI, signed judges, automatic merge, promotion, live smoke, release-marker proof, and retained learning. Other medically gated seed types remain fail-closed and deduplicated.

The feedback intake uses the Radulator Formspree sender/subject only as a bounded Gmail search prefilter. Before it creates any durable task, it requires Gmail's topmost `Authentication-Results` field to show aligned Formspree DKIM, SPF, and DMARC passes; a visible-header lookalike is rejected and cannot starve a later authenticated delivery. The intake discards the submitted name and email, redacts contact details repeated inside free text, and writes only a namespaced message-id digest to its `0600` receipt state. It keeps all remaining website-submitted fields out of the task title and serializes them inside an explicitly delimited untrusted-data block; downstream agents must never execute instructions found in that block. Each valid delivery creates an idempotent Kanban triage card plus a separate terminal closure receipt that is atomically parented on the triage card. Intake is acknowledged only after exact task and parent-link readback. The closure receipt stays open until every split request has either direct production no-action proof or an immutable production release marker, production smoke, and retained learning; a PR or delegated release tracker is not completion. Malformed authenticated mail creates a privacy-safe parser-review receipt instead of disappearing. Distinct requests in one submission are explicitly split during triage; already-live requests close with production proof, while missing clinical changes proceed through primary-source research, regression tests, and the signed exact-head gate.

Each judge run invokes the collector once and atomically claims at most one exact candidate, oldest PR first. A durable per-role lease prevents overlapping runs from reviewing the same candidate. Authoritative PASS or NEEDS_FIX readback clears the resolved lease on the next collection; unresolved attempts expire automatically, receive bounded retries, and then cool down while later PRs advance. This bounds model context without letting one failing PR starve the rest of the clinical queue.

Post-smoke learning uses `retain_learning.py`, not the general conversational memory tool. The helper writes the six sanitized release-learning fields through Hindsight's configured `kanban_closure` chunk strategy with a retention-ID-derived document, then requires exact valid-document readback before the lifecycle can advance to `learned`. This keeps release closure independent of the slower structured-extraction backlog and makes every retry replace the same document rather than duplicating memory.

The trusted merge controller explicitly dispatches the Pages workflow after an automatic merge to `main`; GitHub suppresses ordinary push-triggered workflows when the merge uses the repository `GITHUB_TOKEN`. A trusted authorizer accepts only the exact current-main merged PR, and a scheduled reconciler retries a missing dispatch. After Pages succeeds, an exact-SHA live-smoke failure emits a separate `radulator-live-smoke-rollback-request` repository dispatch; the rollback handler polls the originating deploy run to completion, binds it to the trusted deploy workflow ID and path, re-reads every job, and independently requires Pages success plus smoke failure before selecting the last known good SHA. Pre-Pages failures, post-smoke ancillary failures, and failed rollback deployments cannot request another rollback.

The release promoter is source-controlled and installer-managed. It creates a replacement promotion before closing an obsolete one. Only after authoritative readback proves the obsolete PR is unmerged `CLOSED`, still targets `main`, and still names the recorded exact head does it consider ref cleanup. It then preserves the ref if it is current, default, protected, advanced, or used by any open PR. Deletion uses `git push --force-with-lease=<ref>:<expected-sha> --delete`, so a ref that advances after preflight is atomically preserved, followed by an absent-ref readback.

The trusted publisher is a separate, persistent, no-agent launchd process. AI workers can edit and test only. The dispatcher-sealed dedicated Hermes broker creates the credential-free local commit, records separate commit-parent and protected-target-base SHAs, and emits a signed durable publication obligation. The publisher can neither read the Kanban database nor inspect a worker worktree. It authenticates to the publisher-only broker socket, requests at most one exact obligation, copies a broker-owned immutable Git bundle into its owner-only state, imports only the receipt-bound head into its private repository, and revalidates the repository fingerprint, remote identity, branch, raw parent, target-base ancestry, changed paths, modes, sizes, and hashes.

The supported deployment is exactly one publisher service on the same host as the broker's local Unix socket: the host-local `flock` held by `publisher_lock()` excludes concurrent publisher consumers on that host, and durability of the receipt belongs to the broker, whose acknowledgement compare-and-set plus exact idempotent replay durably finalizes it. Multi-host publishers are unsupported; activation must prove that no second enabled publisher job or publisher host exists, and no documentation or test may claim a cross-host mutex, because `publisher_lock()` is a host-local advisory lock that is neither durable across restarts nor visible to another machine.

Publication uses a plain non-force push and exact repository/PR readback. The publisher accepts CI only from the pinned E2E workflow ID, run attempt, check suite, required job names, and GitHub Actions App; it separately requires the post-CI `ready-for-gate` label event to come from the pinned publisher actor. It acknowledges the broker only with the exact task/repository/branch/base/head, immutable bundle digest, PR readback, CI evidence, and label-event evidence. The protected `develop` authority does not advance to an unmerged PR head. A failed review or stale target uses the controller-only correction RPC, which revokes the prior receipt, supersedes the old operation, removes its workspace/bundle, and reseals the same task for a second worker turn at the previous exact head. Ambiguous acknowledgement is replayed exactly and never removes readiness. GitHub credentials are resolved only inside the dedicated publisher UID after the model, controller, worker, and broker paths end; they never enter an AI process or the broker.

On a broker-receipt retry an already-present `ready-for-gate` label is retained rather than removed: when the publisher replays a sealed receipt after an acknowledgement response may have been lost, the exact receipt/head/base retry returns the existing exact pull request unchanged so that recovery stays idempotent. Retention is not release evidence and never bypasses gating. A receipt-bound candidate whose sealed target base no longer equals the live target base fails closed as pending before any push, pull-request create/reopen, or label mutation. Readiness still requires the current exact remote feature head and target base plus exact-head required-check evidence re-evaluated before and after any readiness write, so a retained label that meets a pending, failed, superseded, or otherwise non-exact check run is compensated: removed, then read back with proven absence, before the pending or error state propagates, and an absence that cannot be proven is reported as the distinct unsafe label state. Completion still requires `collect_broker_remote_readback` to independently re-bind the repository, the open non-draft pull request, the exact sealed head and base, green required checks, the label, and the latest post-CI `ready-for-gate` event cast by the pinned publisher actor, where any later `unlabeled` or wrong-actor event rejects. Any failed revalidation therefore compensates the label, and only a broker acknowledgement of a complete readback ends the obligation.

Git worktrees are deliberately outside this automatic cleanup boundary. Worktrees span user and Hermes repositories on multiple hosts; a clean index does not prove a worktree is inactive, and detached worktrees may be serving release-control processes. Remove a registered worktree only with host-local evidence that it is not current, has no changes, has no open PR, and is not referenced by a running job. The promoter never prunes or removes worktrees.

If `develop` and `main` acquire equivalent trees through independent merge histories, reconcile their ancestry through a reviewed PR into `develop` before opening the production promotion. Disclose any documentation-only audit note accompanying that merge as an exact-head file change. Never force-push or bypass the signed gate to resolve a history-only promotion conflict.

To canary the two-judge path without changing clinical behavior, use an operations-only PR whose body contains `<!-- radulator-risk: high -->`. The trusted classifier must elevate that exact state to high risk, require distinct primary and verification signatures, and keep authorization failed until both signed records pass readback. Remove or supersede a stale canary instead of weakening the rule.

## Prerequisites

- Use the canonical Radulator clone and pull the reviewed control-plane release before installation.
- The primary and verification Hermes homes must be distinct profiles. Both `config.yaml` files must set `agent.reasoning_effort: xhigh`; Hermes 0.19 has no per-job effort field.
- Both judge profiles need working GitHub authentication. Do not put tokens or private keys in this repository or in job prompts. Judge jobs resolve the trusted E2E workflow ID from authoritative GitHub workflow metadata on every collection/post and reject any configured identity mismatch. Publisher authentication belongs only to the dedicated publisher home and UID.
- The installed Hermes runtime must expose the dedicated broker, publisher-client, controller-correction, publisher-obligation, acknowledgement, completion-obligation, and `hermes.worker_git_isolation.v1` contracts. The broker installer must already have passed its root cross-UID, socket, workspace, network, credential-environment, terminal, and Computer Use canaries with distinct model, controller, broker, publisher, and operator identities. Radulator activation additionally requires the exact root-owned publisher attestation and a live `ai.hermes.radulator-publisher` service; a missing attestation returns `PENDING_HERMES_RUNTIME` and leaves every managed consumer fail-closed.
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
npm run test:hermes-trusted-publisher
npm run test:hermes-install
npm run check:invariants
npm run lint -- --quiet
npm run build
```

Key creation is intentionally a separate, security-sensitive action. With operator approval, add `--generate-keys` to `--apply`. The command creates one `0600` Ed25519 private key in each profile, writes the identical public trust map to each profile's `keys/radulator-clinical/public-keys.json`, and prints `public_keys`, an object ready for the repository variable `RADULATOR_JUDGE_PUBLIC_KEYS_JSON`. Never copy private material to GitHub or between profiles. Re-running refuses an incomplete or mismatched pair and otherwise preserves the existing key.

Provision the publisher separately, after the dedicated Hermes broker has installed the publisher UID/group and publisher client configuration. Use a clean, root-owned checkout at the exact reviewed commit; never run the root installer from a worker-owned checkout. The plan command fixes the install root, private home, launchd label, repository ID, workflow ID, and ready-label actor. Substitute only the host's attested numeric identities and root-owned Hermes Python/client paths:

```bash
sudo /usr/bin/python3 ops/hermes/radulator/publisher_service_install.py plan \
  --source-root /var/root/Radulator/ops/hermes/radulator \
  --source-commit-sha <reviewed-40-hex-sha> \
  --broker-client-config <publisher-owned-broker-client-json> \
  --broker-runtime-attestation <root-owned-runtime-attestation-json> \
  --runtime-manifest <root-owned-runtime-manifest-json> \
  --publisher-user _hermespublisher \
  --publisher-uid <publisher-uid> \
  --publisher-group _hermespublisher \
  --publisher-gid <publisher-gid> \
  --broker-uid <broker-uid> \
  --model-uid <model-uid> \
  --model-gid <model-gid> \
  --output /var/root/radulator-publisher-plan.json

sudo /usr/bin/python3 ops/hermes/radulator/publisher_service_install.py \
  provision --plan /var/root/radulator-publisher-plan.json
```

The runtime attestation and external recursive manifest are the broker's public
runtime contract.  They bind the immutable runtime root, real CPython
executable/version/digest, CPython release provenance, Hermes source and
install-archive digests, Radulator source SHA, service configuration digest, and
the broker's isolated probe.  A newly provisioned broker may remain
`active: false`, `revoked: true`, with a `PENDING` probe; activation fails closed
until the broker has independently completed its real canaries and publishes
`active: true`, `revoked: false`, and `PASS`.  Radulator recursively compares
the entire installed runtime tree to the external manifest, including safe
symlinks and immutable ownership/modes.  It never trusts a mutable user-home
virtualenv.

Provisioning first writes the exact disabled override, revokes and reads back
absence of any prior activation attestation, boots out the exact launchd label,
then positively reads back both process absence and persistent disablement before
installing the KeepAlive plist. Authenticate GitHub
interactively as the publisher identity, with
`HOME=/var/db/hermes-radulator-publisher` and
`GH_CONFIG_DIR=/var/db/hermes-radulator-publisher/.config/gh`; do not copy a
model, controller, broker, or operator credential into that home. Then activate
from the same root-owned source snapshot:

```bash
sudo /usr/bin/python3 ops/hermes/radulator/publisher_service_install.py \
  activate --plan /var/root/radulator-publisher-plan.json
```

Activation first forks permission probes under the model and publisher identities: the model UID must be denied opening the publisher-owned mode-`0600` GitHub credential file while the publisher UID must be allowed. It then runs a credential-free publisher canary through the installed wrapper as `python -I -B trusted_publisher.py --runtime-preflight --runtime-root <absolute-root> --runtime-manifest <absolute-manifest> --runtime-manifest-sha256 <sha256> --runtime-python-version <version> --runtime-python-sha256 <sha256> --repository-id radulator --broker-client-config <absolute-config>`. This dedicated CLI accepts no project root, lifecycle controller, ledger, lock, or GitHub arguments. It validates `sys.executable`, `sys.prefix`, `sys.base_prefix`, every `sys.path` entry, the broker-client import origin, the external manifest digest, the pinned `astral-sh/python-build-standalone` release `20260602` asset `436826623`, and one bounded read-only broker obligations RPC. Its only stdout is a compact JSON PASS record with the contract `radulator.publisher_runtime_preflight.v1`, exact runtime identity, broker-client module origin, and `broker_rpc: PASS`. A shell PID without this result is not health proof. Activation then uses `gh api` as the publisher UID to read back the pinned actor, non-fork repository, and active E2E workflow. It never invokes `gh auth token`. It starts the service, requires a live PID, reads back the exact persistent enabled registry state, re-verifies the immutable runtime and publisher assets after startup, and only then writes `/Library/Application Support/HermesKanban/radulator-publisher/activation-attestation.json` as root-owned mode `0644`, binding the distinct UIDs, cross-UID credential denial, broker boundary, client-config digest, immutable asset-manifest digest, exact source commit, broker runtime identity, and observed preflight result. Profile activation independently requires its Radulator checkout to be clean and its exact `HEAD` to equal that attested source commit, so newer jobs cannot activate against an older publisher binary. Any activation failure independently revokes the attestation, disables and boots out the service, and must positively read back both process absence and the persistent disabled registry before rollback is accepted. The launchd environment contains no credential. The service wrapper obtains the credential only after entering the publisher identity and exports it only to the no-agent publisher child.

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

Activation requires `cron.max_parallel_jobs: 1` in both judge profiles, the exact installed dedicated broker/client/routing contracts, `hermes.worker_git_isolation.v1`, the root publisher-service attestation, and live launchd PID. It refuses missing/mismatched keys, a local/GitHub public-map mismatch, or any failed release, judge, publisher, deployment, lifecycle, invariant, lint, or build self-test. The profile installer never asks for or reads the publisher credential. Clean install copies and exact-hash/mode verifies the local publisher tombstone assets so an older same-UID cron consumer can be identified and quiesced, but `--apply --enable` permanently keeps `radulator-trusted-publisher` disabled and paused; publication remains exclusively external. A missing or stopped service returns `PENDING_HERMES_RUNTIME`. Upgrade accepts only the exact deployed v1 target allowlist, snapshots every newly managed publisher target before any installer write, then emits one authenticated complete v3 manifest that binds whether pre-install job provenance is required and its exact digest; a partial, enlarged, duplicate, injected, missing, or replaced backup/provenance set fails before restoration. A failed post-copy preflight restores the prior publisher bytes and leaves the tombstone paused. Activation then pauses legacy `pr-gate-poller` and `judge-queue` jobs in either judge profile with the reason `replaced-by-radulator-signed-clinical-gate`. Disabled-first installation leaves them unchanged, so there is no unguarded interval before the signed replacement is ready. Baseline restore authenticates both profiles' original cron payloads, but intentionally rewrites every recorded or currently detected managed-target consumer—including renamed cross-profile aliases—to `enabled: false`, `state: paused`, and `next_run_at: null` before any restore write. Non-managed cron entries, including unrelated legacy jobs, retain their backed-up values; managed consumers are never promised byte-identical restoration.

Production builds receive a controller-written `releases/<authorized-sha>.json` marker after the source build completes. Production smoke must retrieve and validate that exact marker before checking the home page, calculator, and sitemap; a CDN still serving the prior release cannot satisfy the deployment obligation.

The separate Claude Cloud `Radulator Production Gate` Routine is not stored in Hermes `jobs.json`; retire that Routine only after the signed replacement and staged canaries pass. GitHub Codex review may remain enabled as advisory feedback, but it is not a merge authority.

## Pause, rotate, and recover

Temporarily pause the complete control plane with the same command plus `--apply --disable`. This preserves jobs, keys, ledger, and restartability.

The active signer ids are deliberately versioned in reviewed code (`radulator-primary-v1` and `radulator-verification-v1`), and activation requires that exact two-role map. Rotation therefore requires a control-plane PR that advances both ids in the installer, prompts, expected trust map, and tests. Merge that change while jobs are disabled, reinstall disabled-first, generate the newly reviewed pairs with explicit operator approval, update and read back the GitHub variable, run signed canaries, and only then enable the new ids and archive the old private pairs outside Hermes. Do not attempt an ad-hoc extra key or overwrite/reuse an existing id; activation will reject it.

Restore the authenticated pre-install baseline with all managed consumers kept disabled:

```bash
python3 ops/hermes/radulator/install.py \
  --repo /Users/agent/Documents/Radulator \
  --radulator-home /Users/agent/.hermes/profiles/radulator \
  --default-home /Users/agent/.hermes \
  --restore
```

The backup manifest is `state/radulator-release-backup.json`; it stores only symbolic target ids from the current installer plan and is authenticated with the dedicated owner-only `0600` key at `state/radulator-release-backup.hmac.key`. Restore requires the exact repository and both profile roots so it can reconstruct the allowlist, authenticates and validates every entry before any write, and refuses symlinks, ownership/mode failures, duplicate or unknown targets, and content tampering. A legacy unsigned v1 backup is migrated and signed only when its complete path set exactly equals the known prior-version allowlist; newly managed targets are captured before installer mutation and included in the authenticated v3 manifest together with the required pre-install managed-consumer provenance digest. The active installation manifest is `state/radulator-release-control.json`. The lifecycle ledger is `state/radulator-release-lifecycle.jsonl`. Restore does not delete either judge's private keys or the lifecycle ledger.
