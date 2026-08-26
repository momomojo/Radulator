# Radulator state reconciliation runbook

Use this runbook only after the integrity change is merged, installed on the Mac mini, and its exact installed commit passes the managed self-tests. The commands below intentionally fail closed. They must not be run from an unreviewed branch or against an edited reconciliation spec.

## 1. Refresh the authoritative audit

Read each named task with `hermes kanban show <task-id> --json` and replay the lifecycle ledger before changing anything. The 2026-08-25 audit identifiers are routing clues, not permission to reuse stale facts:

- legacy KBRC feedback receipt/closure: `t_1630667d`
- KBRC release tracker with no lifecycle entry: `t_56c8fd34`
- MELD release tracker with no lifecycle entry: `t_f60ac506`
- archived CAC tracker with terminal `NEEDS_FIX` ledger state: `t_b3daef55`
- release tracker with the legacy inverted NEEDS_FIX edge: `t_45a5323f`
- legacy NEEDS_FIX correction: `t_f55aa2c2`
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

The legacy delivery is re-read from Gmail and must pass aligned Formspree authentication before any migration. Intake then verifies the exact persisted digest on `t_1630667d`, preserves that task in `superseded_task_ids`, assigns it as `triage_task_id`, and creates one idempotent open replacement closure whose key is versioned by the old task id. It persists the new closure as `task_id` only after digest, parent, status, and task-id readback.

Read the receipt state and both Kanban cards back. The new closure must be open, must depend on `t_1630667d`, and must not be terminal until its exact completed run contains `radulator-feedback-closure-proof/v1` metadata binding the receipt digest to one immutable release-marker SHA, the same production-smoke SHA/run, and the retained-learning receipt id. A PR, audit, delegated tracker, or prose-only claim is not closure. Re-running intake must create no additional task.

## 3. Create the reviewed reconciliation spec

Create `/Users/agent/.hermes/profiles/radulator/state/radulator-lifecycle-reconciliation.json` outside the autonomous job, review it line by line, make it owned by `agent` and mode `0600`, and record its SHA-256. The job never creates or edits this file.

Use one entry per tracker. MELD and KBRC must omit `pr`, `head_sha`, and `base_sha` together unless the refreshed audit has authoritative readback for all three. Their missing ledger history bootstraps only to `feedback`. The KBRC source must name the exact authenticated receipt task and full 64-character receipt digest. CAC may include its PR/head/base only when all three are present in the refreshed tracker readback.

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
  --hermes /Users/agent/.local/bin/hermes
```

The plan must show only `feedback` bootstrap for missing MELD/KBRC coverage and a corrective prerequisite for archived/nonterminal CAC. It must not show approval, merge, deploy, smoke, learning, or completion. The controller preflights every tracker, source, digest, and optional PR/head/base tuple before any apply-side mutation, so one invalid entry leaves the whole batch unapplied. Recheck the frozen spec digest, then repeat the same command with `--apply`. Repeat it once more: it must report already reconciled/idempotent results and create no duplicate events or tasks.

## 5. Repair only the exact inverted NEEDS_FIX edge

Do not decompose or replay `t_45a5323f` or `t_16af0162` merely because this runbook is being applied. Their current decomposed prerequisites may be valid work and must remain intact.

Replay the exact `NEEDS_FIX` ledger event for `t_45a5323f` and inspect the deterministic `radulator-rework:<tracker>:<verdict>` action. Apply it only if its idempotency key, body, verdict, exact PR/head, and recovered task all identify `t_f55aa2c2`. The controller then removes only `t_45a5323f -> t_f55aa2c2`, adds only `t_f55aa2c2 -> t_45a5323f`, verifies `t_f55aa2c2` has no open-tracker parent, and promotes it if needed. It preserves every unrelated decomposed prerequisite and creates no duplicate correction on replay.

If the recovered task is not `t_f55aa2c2`, stop for review; never choose a child or parent by title alone.

## 6. Final readback

Verify all of the following before allowing autonomous work to continue:

- the Formspree receipt maps the authenticated legacy digest to the exact old triage/history id and one new open closure id;
- MELD and KBRC have exactly one initial `feedback` ledger event with no inferred later state;
- CAC remains `NEEDS_FIX` and has a runnable corrective obligation; it is not learned or complete;
- the exact legacy NEEDS_FIX obligation is runnable and is a prerequisite of its tracker;
- unrelated decomposed prerequisites are unchanged;
- a second intake/reconciliation/action pass is idempotent;
- no tracker or closure becomes terminal without exact production release-marker, smoke, and learning evidence.

Remove the reviewed reconciliation file only after its SHA, applied result, and final authoritative readback have been retained in the operational audit. Keep the immutable lifecycle ledger and superseded task history.
