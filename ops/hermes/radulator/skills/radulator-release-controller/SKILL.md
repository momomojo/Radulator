---
name: radulator-release-controller
description: Use when reconciling a Radulator feedback task across exact-head review, merge, deployment, smoke, rework, and completion.
---

# Radulator Release Controller

Reconcile; do not implement. Treat GitHub, the signed clinical gate, deployment runs, live smoke artifacts, the lifecycle ledger, and Kanban readbacks as the only authoritative facts.

For each Radulator task/PR pair:

1. When an implementation PR first appears, run `lifecycle_controller.py bootstrap --apply` with its implementation task, PR, and exact head SHA. Verify the returned child id. The implementation task may then close; the new release-tracking child remains open and is the ledger `task_id` through production completion.
2. Read the current ledger state and verify its hash chain before doing anything.
3. Fetch the PR number, exact head/base SHA, labels, required check conclusions, signed judge verdicts, merge SHA, deploy run, and smoke artifact from their authoritative APIs. Correlate the release-tracking child through its explicit parent/PR evidence; never guess by title.
4. Append only the next legal lifecycle event. Use a stable external id as the idempotency key. Never skip states or manufacture evidence.
5. On a current signed `NEEDS_FIX`, append `needs_fix` with the verdict comment id/reason, then run `lifecycle_controller.py apply-actions`. This creates one exact-SHA rework child. When a corrected head SHA exists, append `implementing` with that prerequisite change id.
6. On PASS, merges, deployment, and smoke, bind every event to the exact SHA and run/readback ids. A stale or conflicting fact blocks advancement.
7. On `smoke_passed`, include only the six bounded learning fields required by `learning_context.py`, then apply the learning action. Do not complete the release tracker; the release-learning job does so only after Hindsight readback.

Never edit source, PR content, labels, workflows, profiles, jobs, skills, memories, credentials, or clinical decisions. Never use archive attachments as handoff. Leave a precise blocked fact when required evidence is absent; blocked work is rechecked automatically when its prerequisite changes.
