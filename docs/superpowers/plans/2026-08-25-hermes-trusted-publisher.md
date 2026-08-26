# Hermes Trusted Publisher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish dispatcher-sealed Radulator worker commits through a separate no-agent, non-force, exact-readback GitHub path without exposing credentials to the model.

**Architecture:** A Python publisher reads the immutable `hermes.trusted_local_commit.v1` event from the selected Hermes Kanban DB, independently proves the local Git state, then performs an idempotent non-force push and exact PR readback. It waits for exact-head develop CI before labeling, bootstraps the release tracker, and completes only the implementation task. The reversible installer deploys the publisher disabled-first and refuses enablement without the broker contract.

**Tech Stack:** Python 3.9, Hermes `kanban_db`, Git, GitHub CLI, `unittest`, Hermes cron JSON, Bash wrapper.

**Spec:** `docs/superpowers/specs/2026-08-25-hermes-trusted-publisher.md`

## Global Constraints

- Canonical repository is exactly `momomojo/Radulator`; PR base is exactly `develop`.
- Worker and commit broker never receive GitHub credentials or publication network access.
- Publisher uses no agent, never force-pushes, and processes at most one oldest eligible task per run.
- Every remote mutation is preceded and followed by authoritative exact-object readback.
- The task's project identity is bound exactly and may be null when the selected
  authoritative board has no project id.
- The installer remains reversible, idempotent, and disabled-first.
- No Mini mutation occurs until both broker and publisher changes independently merge.

---

### Task 1: Fail-closed publisher core

**Files:**
- Create: `ops/hermes/radulator/trusted_publisher.py`
- Create: `ops/hermes/radulator/tests/test_trusted_publisher.py`

**Interfaces:**
- Consumes: `hermes_cli.kanban_db.connect`, `get_task`, `list_tasks`, `list_events`, `add_comment`, `complete_task`.
- Produces: `TrustedCommit`, `PublisherConfig`, `select_candidate(kb, board)`, `validate_local_candidate(candidate, config, runner)`, and `run_once(config, kb_module, runner)`.

- [ ] **Step 1: Write failing contract-selection tests**

Create fixtures for an exact blocked task/event and assert rejection of wrong contract, board, task, project, run, blocked marker, publisher state, duplicate latest records, malformed SHA/path, and more than one selected candidate. Assert the oldest exact eligible task is the sole result.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `python3 -m unittest ops.hermes.radulator.tests.test_trusted_publisher.TrustedPublisherSelectionTests -v`

Expected: import failure because `trusted_publisher.py` does not exist.

- [ ] **Step 3: Implement immutable contract parsing and selection**

Use frozen dataclasses, exact-key validation, 40-lowercase-hex SHA validation, sorted unique repo-relative paths, current task status/readback, and matching event/run/blocked reason. Select only the oldest exact eligible blocked task and return no work when none exist.

- [ ] **Step 4: Write failing local-Git authority tests**

Cover wrong worktree root, wrong sealed branch, protected/release branch, detached HEAD, dirty worktree, wrong head/parent/base ancestry, changed-path mismatch, sibling worktree, executable Git config, wrong remote, symlink escape, and unexpected credential/proxy/askpass environment.

- [ ] **Step 5: Run the local-Git tests and verify RED**

Run: `python3 -m unittest ops.hermes.radulator.tests.test_trusted_publisher.TrustedPublisherGitAuthorityTests -v`

Expected: failures naming the missing validation behavior.

- [ ] **Step 6: Implement minimal local-Git validation**

Resolve the workspace without following it outside the configured project root. Invoke Git with an explicit credential-free environment and `-c core.hooksPath=/dev/null -c credential.helper=`. Compare exact `rev-parse`, `show --format=%P`, `merge-base --is-ancestor`, `status --porcelain`, `diff-tree --name-only`, `worktree list --porcelain`, config origins/values, and normalized origin URL.

- [ ] **Step 7: Run selection and Git tests GREEN**

Run: `python3 -m unittest ops.hermes.radulator.tests.test_trusted_publisher -v`

Expected: all Task 1 tests pass.

### Task 2: Idempotent GitHub publish and CI/label readback

**Files:**
- Modify: `ops/hermes/radulator/trusted_publisher.py`
- Modify: `ops/hermes/radulator/tests/test_trusted_publisher.py`

**Interfaces:**
- Consumes: validated `TrustedCommit` from Task 1.
- Produces: `PublishedPullRequest(number, url, head_sha, branch, base)` and `ensure_published(candidate, config, runner)`.

- [ ] **Step 1: Write failing non-force publication tests**

Assert remote absent permits one plain push; exact remote SHA reuses it; differing remote SHA rejects; no command contains `--force` or `--force-with-lease`; an existing exact PR is reused; zero/multiple/mismatched PRs reject; create success without exact readback rejects.

- [ ] **Step 2: Run publication tests and verify RED**

Run: `python3 -m unittest ops.hermes.radulator.tests.test_trusted_publisher.TrustedPublisherGitHubTests -v`

Expected: failures because publication is not implemented.

- [ ] **Step 3: Implement push and exact PR readback**

Use a minimal publisher environment, `git ls-remote`, and a plain non-force
`git push https://github.com/momomojo/Radulator.git <sealed-40-hex-sha>:refs/heads/<branch>`. Authenticate Git only
through the fixed `gh auth git-credential` helper in the no-agent process; the
token must never appear in argv or output. Enumerate the branch's complete PR
history (`--state all`), reuse/reopen the one exact unmerged PR, and never create
a duplicate. Read the feature ref and current `develop` ref independently before
each mutation; keep the correction commit parent distinct from the PR target-base
SHA. Parse only bounded JSON and require exact repository/head/base/state fields
after every write.

- [ ] **Step 4: Write failing CI and label tests**

Assert missing/running/failed/wrong-app/wrong-SHA checks never label; three exact successful required checks permit one label write; label write without exact PR/head/base/label readback rejects; retries reuse the exact label.

- [ ] **Step 5: Implement exact-head CI and label reconciliation**

Resolve the E2E workflow by exact ID/path/name, select the newest exact PR-bound
run attempt before evaluating its result, then bind its complete attempt-specific
job list and each required job's exact Actions App/check-suite check run. Treat
labeling as a compensating transaction: after any attempted or observed label,
revalidate all task/run/local/remote/PR/CI authority; remove and prove absence on
every failure, or return `UNSAFE_LABEL_STATE`.

- [ ] **Step 6: Run publisher tests GREEN**

Run: `python3 -m unittest ops.hermes.radulator.tests.test_trusted_publisher -v`

Expected: all publication, CI, and label tests pass.

### Task 3: Release tracker handoff and no-agent wrapper

**Files:**
- Modify: `ops/hermes/radulator/trusted_publisher.py`
- Create: `ops/hermes/radulator/trusted_publisher_cron.sh`
- Modify: `ops/hermes/radulator/tests/test_trusted_publisher.py`

**Interfaces:**
- Consumes: exact labeled `PublishedPullRequest`.
- Produces: idempotent release tracker and completed implementation task result containing `TRUSTED_PUBLISHER v1`, PR URL, exact SHA, and tracker id.

- [ ] **Step 1: Write failing lifecycle/completion tests**

Assert lifecycle bootstrap receives exact task/PR/head, malformed/conflicting tracker output rejects, implementation task remains blocked until label readback, completion verifies the exact same task/event/head, and retries reuse the tracker/PR without duplicate writes.

- [ ] **Step 2: Run lifecycle tests and verify RED**

Run: `python3 -m unittest ops.hermes.radulator.tests.test_trusted_publisher.TrustedPublisherLifecycleTests -v`

Expected: failures because the handoff is not implemented.

- [ ] **Step 3: Implement lifecycle bootstrap and task completion**

Call `lifecycle_controller.py bootstrap --apply --parent-task-id <task> --pr <number> --head-sha <sha>`, require bounded JSON with one exact tracker id, re-read the parent and child, add an auditable publisher comment, and complete only the implementation task with the structured exact result.

- [ ] **Step 4: Write and validate the no-agent wrapper**

The wrapper resolves the profile, never sources `.env`, discards inherited
GitHub credential/config overrides, obtains the host `github.com` token from the
fixed GitHub CLI without printing it, and invokes the Hermes venv Python with a
fixed `default` board, null project identity, canonical repository/root, and no
model prompt or runtime override arguments. Run `bash -n
ops/hermes/radulator/trusted_publisher_cron.sh`.

- [ ] **Step 5: Run the full publisher suite GREEN**

Run: `python3 -m py_compile ops/hermes/radulator/trusted_publisher.py && bash -n ops/hermes/radulator/trusted_publisher_cron.sh && python3 -m unittest ops.hermes.radulator.tests.test_trusted_publisher -v`

Expected: all tests pass.

### Task 4: Reversible disabled-first installation

**Files:**
- Modify: `ops/hermes/radulator/install.py`
- Modify: `ops/hermes/radulator/tests/test_install.py`
- Modify: `ops/hermes/radulator/README.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: publisher and wrapper from Tasks 1-3 and Hermes broker module contract.
- Produces: managed `radulator-trusted-publisher` no-agent job and activation self-test.

- [ ] **Step 1: Write failing installer tests**

Require the eighth stable managed job, `no_agent=true`, no prompt/model/provider,
one-item run, copied scripts at mode 0700, disabled-first behavior, quiesced
enabled-script upgrades, authenticated allowlisted reversible restore, publisher
test in activation matrix, and refusal to enable unless both
`hermes.trusted_local_commit.v1` and `hermes.worker_git_isolation.v1` are present.

- [ ] **Step 2: Run installer tests and verify RED**

Run: `python3 -m unittest ops.hermes.radulator.tests.test_install -v`

Expected: failures showing the publisher job/scripts are absent.

- [ ] **Step 3: Implement installer and package wiring**

Add a stable publisher job id, copy both publisher files, authenticate a symbolic
target-ID backup manifest with a dedicated owner-only key, prevalidate every
restore entry before writing, and quiesce an enabled publisher before replacing
drifted assets. Include `test:hermes-trusted-publisher` and both broker/security
contract activation probes before any job is enabled. Preserve unrelated job
state.

- [ ] **Step 4: Document the trust boundary and recovery behavior**

Update the operator README with credential separation, no-force rules, exact readbacks, disabled-first activation dependency, retry semantics, and the release tracker handoff.

- [ ] **Step 5: Run focused and canonical gates**

Run: `npm run test:hermes-trusted-publisher && npm run test:hermes-install && npm ci && npm run build && npm run lint && npm run check:invariants`

Expected: all commands pass and `npm audit` reports zero vulnerabilities.

- [ ] **Step 6: Hostile diff review**

Run: `git diff --check && git status --short && git diff --stat && git diff -- ops/hermes/radulator package.json docs/superpowers`

Expected: only the publisher, installer, tests, docs, and package wiring are changed; no secrets, generated `dist`, clinical logic, workflow, or roadmap files appear.

### Task 5: Protected publication and live canary

**Files:**
- No new source files; use the reviewed branch and merged installer.

**Interfaces:**
- Consumes: exact green publisher PR, exact green Hermes broker PR, and their protected merges.
- Produces: Mac-mini-live-verified publisher job plus one exact canary task progressing from sealed worker commit to protected PR gate.

- [ ] **Step 1: Publish through the existing human-operated path**

Push this implementation branch, open a PR to `develop`, wait for exact Smoke/Targeted/Hermes checks, then add `ready-for-gate`. Do not use the new publisher to publish itself.

- [ ] **Step 2: Require independent reviews and protected merges**

Require no-blocker independent review of the exact Hermes broker head and exact publisher head. Let only the existing trusted controllers merge them.

- [ ] **Step 3: Install broker then publisher disabled-first**

Update the Mini canonical Hermes runtime to the exact merged broker head, run its focused tests, install the Radulator overlay at the exact merged publisher head, and verify the publisher remains disabled until its activation probe succeeds.

- [ ] **Step 4: Enable and read back the no-agent job**

Enable `radulator-trusted-publisher`; verify exact job id, `no_agent=true`, wrapper hash, script hash, schedule, profile, and absence of a model/provider/prompt.

- [ ] **Step 5: Canary one real task**

Requeue one approved stalled Radulator task. Through the exact model execution
path, prove `gh auth token`, profile `.env`, GitHub/SSH config, Keychain lookup,
network/loopback, and Git-metadata writes fail while ordinary workspace edits and
tests succeed. Then observe the sealed broker event, credential-free local commit,
non-force push, exact PR readback, newest exact CI attempt, compensated label
readback, lifecycle seed/tracker lineage, and implementation-task completion.

- [ ] **Step 6: Final live audit**

Verify no force push, no credential exposure, no duplicate PR/tracker, current protected branch rules, open release tracker, clean canonical clone, and a second no-op publisher invocation. Report `Mac-mini-live-verified` only after all readbacks pass.
