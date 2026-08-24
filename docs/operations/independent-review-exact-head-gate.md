# Clinical release exact-head gate

`Radulator Clinical Release Gate (exact head)` is the fingerprint-bearing clinical approval check for PRs targeting `develop` or `main`. The same evaluation publishes the suite-independent commit status `Radulator Clinical Release Authorization`, which is the App-bound context required by branch protection. It runs trusted base-branch code through `pull_request_target`, reads PR files and CI through GitHub APIs, and never checks out or executes PR-controlled scripts.

## Authorization contract

The gate independently derives the exact state:

- repository and PR id;
- current source head, base SHA, and base ref;
- relevant PR-state epoch and label digest;
- normalized changed-file digest and risk classification;
- exact E2E workflow/check-run identities and completion times.

A signed `radulator-clinical-attestation/v1` PR comment must match every field. Signatures use Ed25519. Private keys remain on the Mac mini judge profiles; GitHub stores only the public-key map in the `RADULATOR_JUDGE_PUBLIC_KEYS_JSON` repository variable.

Standard risk requires the configured `primary` judge. High risk requires both `primary` and `verification` keys from separate Hermes profiles. Any valid signed `NEEDS_FIX` is terminal for that unchanged exact state. Malformed or unverifiable outsider carriers are ignored and never gain veto authority; without a valid current signed role the gate still fails as missing quorum. Stale review time, state change, failed CI, a hold label, or a missing `ready-for-gate` label also fails the gate.

## Risk classification

The trusted classifier, not the judge, sets the minimum tier. Calculator runtime changes are high risk. Clinical documentation patches are high risk when they change numeric values, formulas, thresholds, units, scoring, contraindications, interpretations, management, follow-up, staging, or guideline versions. Missing or truncated clinical patch data, clinical paths present only as `previous_filename`, and an explicit `Risk-Tier: high` PR declaration are also high risk. PR evidence and full GitHub file metadata are bound into the exact risk record. Feedback-only and other changes are standard risk and still require the primary judge.

## CI binding

PRs targeting `develop` require `Smoke Tests` and `Targeted Calculator Tests`. PRs targeting `main` additionally require `Full Test Suite`. Evidence is accepted only from the configured E2E workflow id and GitHub Actions App id, on one exact successful workflow run associated with the current PR head/base. Duplicate same-name checks are ambiguous and fail closed.

## State-change handling

The gate first publishes a `pending` authorization status, then loads the state twice before evaluation. Any mismatch blocks. It publishes and reads back the fingerprint-bearing check, then replaces the status with the exact PASS/failure fingerprint and a link to that check. A post-publication state change revokes success and replaces both signals with failure. The separate status prevents a canceled or unrelated Actions check suite from deciding whether GitHub recognizes the authorization. Base-branch pushes re-evaluate all open PRs because their reviewed base changed. Automatic merges use one repository-wide lane and require an active server-side repository rule with `strict_required_status_checks_policy: true`, including `Radulator Clinical Release Authorization` and the GitHub Actions App id. The controller independently verifies that status, its fixed Actions-bot identity, its exact fingerprint/link, and the signed check before every merge.

## Configuration

Required repository variables:

- `RADULATOR_CLINICAL_GATE_ENABLED=true`
- `RADULATOR_E2E_WORKFLOW_ID=<numeric workflow id>`
- `RADULATOR_CI_APP_ID=15368`
- `RADULATOR_JUDGE_PUBLIC_KEYS_JSON=<JSON object keyed by judge key id>`

Each public-key entry has `role`, `profile`, and PEM `publicKey`. No private key, GitHub token, or Hermes credential belongs in repository variables or source.

## Safe activation order

1. Merge the code to `develop` through the existing bootstrap gate.
2. Promote it to `main` and leave `RADULATOR_CLINICAL_GATE_ENABLED` false.
3. Install the Mac mini judge overlay and create separate keys.
4. Configure the public-key map and verify both candidate collectors in dry-run mode.
5. Keep automatic merge disabled, enable the clinical gate, and verify a canary publishes both the fingerprint-bearing check and a GitHub-Actions-authored `Radulator Clinical Release Authorization` status for the same exact head.
6. Add the App-bound authorization status to the `develop` and `main` rulesets with strict required-status enforcement while retaining the old required exact-head check; read the effective rules back from GitHub.
7. Prove standard and high-risk canaries pass both requirements and that the merge controller verifies both signals.
8. Remove only the old exact-head check from the server-side required-context lists, read the rules back again, and enable the separate automatic merge controller.

Rollback reverses that migration without opening an unprotected interval: disable automatic merge, restore the old exact-head check as a server-side requirement, prove a canary, then remove the authorization-status requirement before disabling its producer. Existing protected-branch rules remain in force throughout. Revert repository code through a normal PR; never remove or rename either context before coordinating and reading back the branch rules.
