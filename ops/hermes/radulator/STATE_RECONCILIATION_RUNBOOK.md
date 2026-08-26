# Radulator state reconciliation runbook

Current authority contract: authenticated Formspree repair rotates over the privacy-minimized durable receipt set rather than current Gmail search summaries, preserving recovery beyond Gmail's newest-100 window without persisting raw ids. Reconciliation apply holds one exclusive lifecycle-ledger lease across the complete external action plan after comparing every exact frozen event; prior advances reject the plan before mutation and later appends wait for lease release.

Use this runbook only after the integrity change is merged, installed on the Mac mini, and its exact installed commit passes the managed self-tests. The commands below intentionally fail closed. They must not be run from an unreviewed branch or against an edited reconciliation spec.

## 1. Refresh the authoritative audit

Read each named task with `hermes kanban show <task-id> --json` and replay the lifecycle ledger before changing anything. The 2026-08-25 audit identifiers are routing clues, not permission to reuse stale facts:

- legacy KBRC feedback receipt/closure: `t_1630667d`
- legacy feedback tasks whose current Kanban body may lack the protected receipt digest: `t_a2add0b9`, `t_ae78d46c`
- KBRC release tracker with no lifecycle entry: `t_56c8fd34`
- MELD release tracker with no lifecycle entry: `t_f60ac506`
- archived CAC tracker with terminal `NEEDS_FIX` ledger state: `t_b3daef55`
- release tracker with the legacy inverted NEEDS_FIX edge: `t_45a5323f`
- dependency-cycle triage card: `t_16af0162`

Stop if an id, receipt digest, source mapping, PR, head SHA, base SHA, lifecycle event, or relationship differs from the reviewed audit. Do not infer a PR/head/base mapping from titles. Do not archive, complete, unlink, or recreate any card during this read-only pass.

## 2. Migrate and repair the Formspree receipt

Run the installed feedback intake once through its managed job or with the same installed paths:

```bash
HERMES_HOME=/Users/agent/.hermes/profiles/radulator \
python3 /Users/agent/Documents/Radulator/ops/hermes/radulator/formspree_feedback_intake.py \
  --hermes-home /Users/agent/.hermes/profiles/radulator \
  --state /Users/agent/.hermes/profiles/radulator/state/radulator-formspree-feedback.json \
  --max-messages 100
```

Each legacy delivery is re-read from Gmail and must pass aligned Formspree authentication before any migration. When the exact persisted digest is present on the legacy Kanban task, intake preserves that task in `superseded_task_ids`, assigns it as `triage_task_id`, and creates one idempotent open replacement closure whose key is versioned by the old task id. It persists the new closure as `task_id` only after digest, parent, status, and task-id readback. Task identity and canonical status must come from the exact root/top-level `task`; parent links must come from that task's current relation list or its matching top-level relation list, and task references must come from its current body or exact top-level comments. Nested children, events, runs, history, relations, or duplicate task records are never authority.

If authoritative Kanban readback does not contain the protected receipt digest, intake must not infer that the legacy task is the triage task. Digest authority is limited to an exact `receipt_digest`/`digest` field on the currently shown task or a delimited 64-hex token in that task's current body or exact top-level comments. A longer hex token, nested relation, child, run, or event-history value is ignored. Intake creates one idempotent privacy-safe binding-quarantine task, records its exact id and `legacy_binding_status: quarantined` in the `0600` receipt state, preserves the original task id, and continues processing later authenticated feedback. Re-running intake reads the open quarantine back and creates nothing else. If the quarantine is terminal without a reviewed binding, intake adds it to `superseded_legacy_binding_quarantine_task_ids` and creates one versioned open replacement; if that idempotent replacement is also terminal, intake fails closed. Resolve such a quarantine only from an explicit reviewed binding or documented replacement; a title, similar body, or nearby timestamp is not authority.

Authenticated receipt repair is bounded separately from new intake. At most `--max-messages` authenticated receipts receive Kanban repair readback per run, and the `0600` state persists only the last namespaced receipt digest as `authenticated_reconciliation_cursor`. Repeated runs must rotate across every authenticated receipt while new mail continues independently; they must not repeatedly spend the entire budget on the oldest unchanged receipt. Both the authenticated rotation and the first authenticated replay of a legacy receipt use this same recovery path. If a receipt's durable task/readback is broken, intake must create/read back one idempotent open `radulator-formspree-reconciliation-failure:<digest>` obligation, persist its task id, increment `repair_failed`, advance the cursor, and continue. That outcome is not `reconciled`. If the persisted failure obligation is prematurely terminal, preserve its id in `superseded_reconciliation_failure_task_ids` and create/read back the versioned open `radulator-formspree-reconciliation-failure-repair:<digest>:<old-task-id>` replacement; the stale terminal task must not starve later repairs or new mail. Failure to create the open corrective obligation remains fail-closed.

Read the receipt state and both Kanban cards back. The new closure must be open, must depend on `t_1630667d`, and must not be terminal until its exact completed run contains one of two non-interchangeable proofs. A deployed change uses `radulator-feedback-closure-proof/v1` metadata, but the metadata is only an index: intake must fetch the exact no-query/no-fragment `https://radulator.com/releases/<40hex>.json` without a redirect and read back `radulator-release/v1` with the same SHA, fetch the named GitHub Actions run and require canonical `.github/workflows/deploy.yml`, matching `head_sha`, and `success`, then read an exact terminal `radulator-feedback-learning-receipt/v1` Kanban task binding the receipt digest, production SHA, and retained-learning receipt id. A request verified as already live uses `radulator-feedback-no-action-proof/v1`; intake fetches the same exact current live marker and separately reads exact terminal `radulator-feedback-production-verification/v1` and learning-receipt tasks whose digest, production SHA, verification URL/run, observed behavior, and receipt id exactly match the closure. A PR, audit, delegated tracker, opaque id, nested run, prose-only claim, arbitrary/nonexistent HTTPS endpoint, redirect, or mismatched SHA is not closure. Re-running intake must create no additional task.

## 3. Create the reviewed reconciliation spec

Create `/Users/agent/.hermes/profiles/radulator/state/radulator-lifecycle-reconciliation.json` outside the autonomous job, review it line by line, and record its lowercase 64-hex SHA-256. It must be a non-symlink regular file owned by `agent` with exact mode `0600`. The loader opens it with `O_NOFOLLOW`, validates the descriptor's type/owner/mode/size, reads only from that descriptor, and verifies device, inode, owner, mode, size, mtime, and ctime are unchanged afterward. It then requires the bytes to match the explicit reviewed SHA-256. A symlink, wrong owner, any other mode, same-size replacement, in-place read race, digest mismatch, or oversized file is rejected. The job never creates or edits this file. Re-run the installer after placing a new reviewed spec so the managed lifecycle prompt is bound to that exact digest; an installed job without such a binding refuses a later file.

Use one entry per tracker. MELD and KBRC must omit `pr`, `head_sha`, and `base_sha` together unless the refreshed audit has authoritative readback for all three. Their missing ledger history bootstraps only to `feedback`. The KBRC source must name the exact authenticated receipt task and full 64-character receipt digest. The source readback must contain that digest in an exact structured `receipt_digest`/`digest` field or as a delimited 64-hex token; a prefix of longer hex is not authority. CAC may include its PR/head/base only when all three are present in the refreshed tracker readback. A structured `pr`, `head_sha`, or `base_sha` field on the exact task is authoritative for that field: a conflicting value fails closed, even if stale body/comment prose contains the requested token. If a field is absent, fallback requires one current body/comment clause containing one coherent role-bound `PR #<n> ... head <40hex> ... base <40hex>` record matching the whole tuple. Each new `PR #` marker starts a new clause, even on the same line, so head/base tokens can never cross a second PR token. Never combine tokens from separate or stale mappings. When an existing lifecycle event renders a corrective action, its exact PR, head SHA, and evidence `base_sha` must also equal the reviewed tuple; matching Kanban prose alone is insufficient.

```json
{
  "schema": "radulator-lifecycle-reconciliation/v1",
  "review_id": "REPLACE_WITH_REVIEWED_AUDIT_ID",
  "trackers": [
    {
      "task_id": "t_f60ac506",
      "source_id": "REPLACE_WITH_REVIEWED_MELD_SOURCE_ID",
      "source": {"kind": "kanban_task", "task_id": "t_REPLACE_WITH_MELD_SOURCE_TASK"}
    },
    {
      "task_id": "t_56c8fd34",
      "source_id": "REPLACE_WITH_REVIEWED_KBRC_SOURCE_ID",
      "source": {
        "kind": "formspree_receipt",
        "task_id": "t_1630667d",
        "digest": "REPLACE_WITH_FULL_64_CHARACTER_RECEIPT_DIGEST"
      }
    },
    {
      "task_id": "t_b3daef55",
      "source_id": "REPLACE_WITH_EXISTING_CAC_LEDGER_SOURCE_ID",
      "source": {"kind": "kanban_task", "task_id": "t_REPLACE_WITH_CAC_SOURCE_TASK"},
      "pr": 169,
      "head_sha": "REPLACE_WITH_EXACT_40_CHARACTER_HEAD_SHA",
      "base_sha": "REPLACE_WITH_EXACT_40_CHARACTER_BASE_SHA"
    },
    {
      "task_id": "t_45a5323f",
      "source_id": "REPLACE_WITH_EXISTING_BLOCKED_TRACKER_SOURCE_ID",
      "source": {
        "kind": "kanban_task",
        "task_id": "t_REPLACE_WITH_BLOCKED_TRACKER_SOURCE_TASK"
      }
    }
  ]
}
```

Placeholders make this template invalid on purpose. Do not apply it until every placeholder has been replaced by refreshed authoritative evidence.

## 4. Plan, freeze, and apply once

Run without `--apply` first:

```bash
python3 /Users/agent/Documents/Radulator/ops/hermes/radulator/lifecycle_controller.py reconcile \
  --ledger /Users/agent/.hermes/profiles/radulator/state/radulator-release-lifecycle.jsonl \
  --spec /Users/agent/.hermes/profiles/radulator/state/radulator-lifecycle-reconciliation.json \
  --spec-sha256 REPLACE_WITH_REVIEWED_64_HEX_SHA256 \
  --hermes /Users/agent/.local/bin/hermes
```

The plan must show only `feedback` bootstrap for missing MELD/KBRC coverage, a corrective prerequisite for archived/nonterminal CAC, and—when the refreshed ledger still shows it—the exact retained `NEEDS_FIX` recovery for `t_45a5323f`. It must not show approval, merge, deploy, smoke, learning, or completion. The controller freezes and validates every tracker, source, digest, optional PR/head/base tuple, existing ledger source/digest, exact rendering lifecycle event, and rendered action before any apply-side mutation. Every tracker/source `show` response must identify the requested id in its root record or exact top-level `task` record, and status is read only from that same record and must be one of `triage`, `todo`, `scheduled`, `ready`, `running`, `blocked`, `review`, `done`, or `archived`; a requested id nested under an unrelated child, event, relation, or history is not authority. On apply it validates the full proposed ledger batch, including semantic/idempotency collisions, under one exclusive lock and writes nothing if any later event conflicts. Immediately before every individual Kanban action, it replays the ledger and requires the frozen current event hash, state, and head SHA to remain exact; a concurrent advance rejects the stale action before `perform`. PR `#16` must never match `#169`; authority parsing must stop before any second PR marker; a requested SHA must never match the first 40 characters of a longer hex token; a receipt digest must never match the first 64 characters of longer hex; and authority plus current prerequisite body/assignee must come from the exact task record, not historical events or related tasks. Recheck the frozen spec digest, then repeat the same command with the same `--spec-sha256` plus `--apply`. Repeat it once more: it must report idempotent action readback and create no duplicate events, tasks, comments, or dependency edges.

## 5. Repair only the latest exact inverted NEEDS_FIX edge

Do not decompose or replay `t_45a5323f` or `t_16af0162` merely because this runbook is being applied. Their current decomposed prerequisites may be valid work and must remain intact. Include `t_45a5323f` in the reviewed reconciliation spec only after refreshing its exact `source_id` and source-task mapping.

When the current ledger event is `blocked` with retained `resume_state: needs_fix`, reconciliation selects the immediately preceding exact `NEEDS_FIX` event for that tracker—not an older verdict or a task id copied from this runbook. Inspect the planned `radulator-rework:<tracker>:<latest-verdict>` action and require its body, verdict, exact PR/head/base, and idempotent Kanban readback to agree with the refreshed audit. The controller removes only the tracker's parent edge from that exact recovered task, adds only the recovered-task prerequisite edge to the tracker, verifies the recovered task has no open-tracker parent, and promotes it if needed. If the idempotent correction task is already terminal for the unchanged head, the controller preserves it, records it in the replacement's recovery instruction, and uses `radulator-rework:<tracker>:<latest-verdict>:repair:<terminal-task-id>` to create/read back one open runnable successor. A terminal or mismatched successor fails closed. It preserves every unrelated parent on both tasks and creates no duplicate correction, comment, link, unlink, promotion, or replacement on replay.

If the current blocked event does not retain `needs_fix`, if the immediately preceding tracker event is not the expected exact `NEEDS_FIX`, or if idempotent create readback resolves a different task/verdict/body than the refreshed audit, stop for review. Never choose a correction by title, historical task id, or stale runbook example.

## 6. Final readback

Verify all of the following before allowing autonomous work to continue:

- each digest-bound Formspree receipt maps the authenticated legacy digest to the exact old triage/history id and one new open closure id;
- each digestless legacy receipt retains its old task id plus exactly one open binding-quarantine id, without an inferred `triage_task_id`, and does not prevent later feedback from being processed;
- MELD and KBRC have exactly one initial `feedback` ledger event with no inferred later state;
- CAC remains `NEEDS_FIX` and has a runnable corrective obligation; it is not learned or complete;
- the exact legacy NEEDS_FIX obligation is runnable and is a prerequisite of its tracker;
- unrelated decomposed prerequisites are unchanged;
- a second intake/reconciliation/action pass is idempotent;
- no tracker or closure becomes terminal without exact production release-marker, smoke, and learning evidence.

Remove the reviewed reconciliation file only after its SHA, applied result, and final authoritative readback have been retained in the operational audit. Keep the immutable lifecycle ledger and superseded task history.
