# Release lane: empty promotion

## Symptom

- A promotion PR (`release/promote-<main>-<develop>`) changes no files: merging develop into main gives main's own tree.
- The clinical gate refuses any PR without changed files (`INCOMPLETE_FILE_LIST`), so that promotion can never merge.
- Develop's head therefore never becomes part of main. The merge controller holds every develop PR without the `release-remediation` label (`UNRELEASED_DEVELOP_HEAD`), and the release queue stops.

## Cause

The same change landed on main and on develop, for example a hotfix to main and its develop counterpart, so the develop commit adds nothing main lacks.

On 2026-10-03 this happened with the `braces` advisory fix:
- it went to main as #334 and to develop as #335, with an identical lockfile so the two would not conflict;
- the promotion carrying #335, #336, was empty.

## Recovery

1. Merge one `release-remediation` PR into develop that carries a real, low-risk change. This runbook was that change. The label lets it merge past `UNRELEASED_DEVELOP_HEAD`.
2. The promoter replaces the empty promotion with one that carries the stuck develop commit plus that change. Its diff is not empty, so it goes through the gate and judges as usual.
3. Once that promotion merges, develop's head is part of main and the lane reopens for every develop PR.

## Prevention

- **Pair the counterpart with real content.** A develop PR whose content main already has must not be the only unreleased develop change. Put real content in the same PR. Or give the counterpart the `release-remediation` label and merge it while another develop change is still unreleased. Without the label, the controller holds it as `UNRELEASED_DEVELOP_HEAD` as soon as that other change has merged. Either way, the promotion that carries it is not empty.
- **Code fix (follow-up).** The controller could treat develop as released when the promotion of develop's exact head has main's tree. Until then, use the recovery above.
