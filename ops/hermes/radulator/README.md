# Radulator Hermes release control plane

This overlay installs four disabled-first Hermes jobs: an exact-head primary clinical judge, an independent high-risk verification judge, a lifecycle reconciler, and a post-smoke learning worker. Standard-risk PRs require the primary signature; calculator/formula/threshold/management changes require both signatures.

## Prerequisites

- Use the canonical Radulator clone and pull the reviewed control-plane release before installation.
- The primary and verification Hermes homes must be distinct profiles. Both `config.yaml` files must set `agent.reasoning_effort: xhigh`; Hermes 0.19 has no per-job effort field.
- Both profiles need working GitHub authentication. Do not put tokens or private keys in this repository or in job prompts.
- The repository's protected checks, clinical gate, automatic merger, deployment smoke, and rollback workflows must already be active.

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
npm run test:post-deploy-smoke
npm run test:rollback-deployment
npm run test:hermes-judge-candidates
npm run test:hermes-judge-attest
npm run test:hermes-lifecycle
npm run test:hermes-learning
npm run test:hermes-install
```

Key creation is intentionally a separate, security-sensitive action. With operator approval, add `--generate-keys` to `--apply`. The command creates one `0600` Ed25519 private key in each profile and prints `public_keys`, an object ready for the repository variable `RADULATOR_JUDGE_PUBLIC_KEYS_JSON`. Never copy private material to GitHub or between profiles. Re-running refuses an incomplete pair and otherwise preserves the existing key.

After public-key and branch-rule readback, enable all managed jobs:

```bash
python3 ops/hermes/radulator/install.py \
  --repo /Users/agent/Documents/Radulator \
  --radulator-home /Users/agent/.hermes/profiles/radulator \
  --default-home /Users/agent/.hermes \
  --apply --enable
```

Activation also pauses legacy `pr-gate-poller` and `judge-queue` jobs in either judge profile with the reason `replaced-by-radulator-signed-clinical-gate`. Disabled-first installation leaves them unchanged, so there is no unguarded interval before the signed replacement is ready. The baseline restore returns both profiles' complete cron files—including those legacy jobs—to their exact pre-install bytes.

## Pause, rotate, and recover

Temporarily pause the complete control plane with the same command plus `--apply --disable`. This preserves jobs, keys, ledger, and restartability.

For rotation, disable first, create a new uniquely named key id through `judge-attest.mjs generate-key`, add its public role mapping to the repository variable, test one signed canary, remove the old public mapping, and then archive the old private pair outside Hermes. Never overwrite or reuse a key id.

Restore the exact pre-install files from the protected baseline backup:

```bash
python3 ops/hermes/radulator/install.py \
  --radulator-home /Users/agent/.hermes/profiles/radulator \
  --restore
```

The backup manifest is `state/radulator-release-backup.json`; the active installation manifest is `state/radulator-release-control.json`. The lifecycle ledger is `state/radulator-release-lifecycle.jsonl`. Restore does not delete either judge's private keys or the lifecycle ledger.
