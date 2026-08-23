# Radulator Hermes release control plane

This overlay installs four disabled-first Hermes jobs: an exact-head primary clinical judge, an independent high-risk verification judge, a lifecycle reconciler, and a post-smoke learning worker. Standard-risk PRs require the primary signature; calculator/formula/threshold/management changes require both signatures.

The trusted merge controller explicitly dispatches the Pages workflow after an automatic merge to `main`; GitHub suppresses ordinary push-triggered workflows when the merge uses the repository `GITHUB_TOKEN`. A trusted authorizer accepts only the exact current-main merged PR, and a scheduled reconciler retries a missing dispatch. The deployment remains eligible for the same post-deploy smoke and narrowly scoped rollback path.

## Prerequisites

- Use the canonical Radulator clone and pull the reviewed control-plane release before installation.
- The primary and verification Hermes homes must be distinct profiles. Both `config.yaml` files must set `agent.reasoning_effort: xhigh`; Hermes 0.19 has no per-job effort field.
- Both profiles need working GitHub authentication. Do not put tokens or private keys in this repository or in job prompts.
- The repository's protected checks, clinical gate, automatic merger, deployment smoke, and rollback workflows must already be active. An enforced repository ruleset for both `develop` and `main` must require the exact-head clinical gate with `strict_required_status_checks_policy: true`; the controller verifies it through GitHub's metadata-readable active-branch-rules endpoint before every merge.

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

Activation refuses missing/mismatched keys, a local/GitHub public-map mismatch, or any failed release, judge, deployment, lifecycle, invariant, lint, or build self-test. It then pauses legacy `pr-gate-poller` and `judge-queue` jobs in either judge profile with the reason `replaced-by-radulator-signed-clinical-gate`. Disabled-first installation leaves them unchanged, so there is no unguarded interval before the signed replacement is ready. The baseline restore returns both profiles' complete cron files—including those legacy jobs—to their exact pre-install bytes.

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
