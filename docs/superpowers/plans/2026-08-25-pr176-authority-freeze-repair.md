# PR 176 Authority Freeze Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PR #176 fail closed on mixed prose authority, overlong receipt-digest tokens, and mutable/unbound reconciliation spec files.

**Architecture:** Replace three independent token searches with one exact-task authority verifier that either trusts corresponding structured fields or parses one role-bound PR/head/base record from a single current body/comment line. Add a dedicated exact receipt-digest verifier. Load the reviewed spec only through one no-follow descriptor, verify descriptor metadata before and after reading, and require a caller-supplied SHA-256 digest.

**Tech Stack:** Python 3 standard library, `unittest`, argparse, POSIX `open`/`fstat`, SHA-256, Hermes Kanban readback.

**Spec:** Fresh independent P1 review of PR #176 exact head `a264542b5a90a42305b50f928f0173a8d4bb779d`.

## Global Constraints

- Keep `ready-for-gate` absent until exact-head CI and a new independent review are green.
- Do not mutate live Mac mini, Kanban, Formspree, lifecycle ledger, or production state.
- Preserve unrelated parents, history, exact `0600` state, idempotency, and batch preflight behavior.
- Every production change follows an observed red-green regression cycle.

---

### Task 1: Coherent PR/head/base authority

**Files:**
- Modify: `ops/hermes/radulator/lifecycle_controller.py`
- Test: `ops/hermes/radulator/tests/test_lifecycle_controller.py`

**Interfaces:**
- Consumes: exact current task record/body/comments and reviewed `pr`, `head_sha`, `base_sha`.
- Produces: `_has_exact_authority_mapping(value, task_id, pr, head_sha, base_sha) -> bool`.

- [ ] **Step 1: Write the failing adversarial test**

Create a current task with no structured authority, one role-bound actual record `PR #999; head=<d*40>; base=<a*40>`, and one stale record `PR #16; head=<a*40>; base=<d*40>` whose unordered tokens could satisfy three independent searches. Assert reconciliation raises before any ledger/Kanban mutation.

- [ ] **Step 2: Run the single test and verify the expected failure**

Run the exact unittest method and confirm the current implementation incorrectly accepts the mixed authority.

- [ ] **Step 3: Implement the minimal coherent parser**

Structured fields remain authoritative when present. If any corresponding field is absent, parse complete role-bound PR/head/base records from individual current task body/comment lines and require one record to match the reviewed tuple exactly; never combine tokens across records or nested event history.

- [ ] **Step 4: Run focused and lifecycle tests**

Run the new method, then the complete lifecycle-controller test module.

### Task 2: Exact receipt digest readback

**Files:**
- Modify: `ops/hermes/radulator/lifecycle_controller.py`
- Test: `ops/hermes/radulator/tests/test_lifecycle_controller.py`

**Interfaces:**
- Consumes: exact source task record/body/comments and reviewed 64-hex digest.
- Produces: `_has_exact_receipt_digest(value, task_id, digest) -> bool`.

- [ ] **Step 1: Write the failing boundary test**

Use a source task containing the requested 64-hex digest only as the prefix of a 65-hex token. Assert reconciliation rejects it with zero mutations.

- [ ] **Step 2: Verify red**

Run the exact method and confirm substring containment incorrectly accepts the overlong token.

- [ ] **Step 3: Implement exact structured/delimited binding**

Treat an exact structured `receipt_digest` or `digest` field as authoritative when present; otherwise search only exact current body/comment text with non-hex boundaries around the full 64-character digest.

- [ ] **Step 4: Verify green and lifecycle regression coverage**

Run the focused method and lifecycle module.

### Task 3: Immutable reviewed spec binding

**Files:**
- Modify: `ops/hermes/radulator/lifecycle_controller.py`
- Test: `ops/hermes/radulator/tests/test_lifecycle_controller.py`
- Modify: `ops/hermes/radulator/README.md`
- Modify: `ops/hermes/radulator/STATE_RECONCILIATION_RUNBOOK.md`

**Interfaces:**
- Consumes: `path` plus required lowercase 64-hex `expected_sha256`.
- Produces: `_load_reconciliation_spec(path, expected_sha256) -> dict` and required CLI `reconcile --spec-sha256 <digest>`.

- [ ] **Step 1: Write failing trust tests**

Add tests for a wrong reviewed digest, same-size content replacement, and a same-descriptor in-place mutation during read. Retain symlink, owner, and exact-mode cases while passing the independently calculated expected digest.

- [ ] **Step 2: Verify red**

Run only the new loader tests and confirm the old one-argument loader or missing post-read checks fail the expected assertions.

- [ ] **Step 3: Implement descriptor-only freeze**

Open with `O_NOFOLLOW`, validate the opened descriptor is a bounded regular file owned by the agent with exact `0600`, read bytes only from that descriptor, `fstat` again, compare device/inode/owner/mode/size/mtime/ctime, compare SHA-256 to the required expected digest, then decode/validate JSON. Add required argparse `--spec-sha256` and pass it to the loader.

- [ ] **Step 4: Update operator instructions**

Document calculating the reviewed digest before reconcile and passing `--spec-sha256`, plus coherent mapping and exact receipt-token rules.

- [ ] **Step 5: Run complete verification and publish**

Run full 124+ Hermes discovery as updated, all release-control npm suites including guideline registry, dependency audit, build, lint, invariants, syntax checks, and `git diff --check`. Commit/push the exact head, refresh the PR verification block, wait for exact-head Smoke/Hermes/Targeted checks, and request another independent review without restoring `ready-for-gate`.

### Task 4: Durable single-agent judge resource limits

**Files:**
- Modify: `ops/hermes/radulator/install.py`
- Test: `ops/hermes/radulator/tests/test_install.py`
- Modify: `ops/hermes/radulator/README.md`

**Interfaces:**
- Consumes: primary and verification `_job` prompt construction.
- Produces: identical durable safety suffix in both judge prompts.

- [ ] **Step 1: Write the failing installer assertion**

Assert both generated judge prompts contain the exact operational requirements: strictly single-agent; never `delegate_task`, subagents, MOA, or delegation; never `execute_code`; at most three concurrent web requests; at most six source retrieval attempts; fail closed rather than broaden.

- [ ] **Step 2: Verify red**

Run the focused installer test and confirm the current generated prompts omit the mitigation.

- [ ] **Step 3: Add one shared durable suffix**

Define the suffix once in `install.py` and append it to both primary and verification judge prompts so reinstall cannot diverge their resource policy.

- [ ] **Step 4: Verify installer coverage**

Run the focused method and full installer module, then include it in the complete verification gate.
