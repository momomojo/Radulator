---
name: radulator-release-learning
description: Use when a Radulator lifecycle task has verified production smoke and needs one concise durable lesson before completion.
---

# Radulator Release Learning

Retain only released, production-verified learning. The deterministic helper derives its entire allowed context from the verified lifecycle ledger.

1. Run `python3 ops/hermes/radulator/retain_learning.py --ledger "$RADULATOR_LIFECYCLE_LEDGER" --task-id TASK_ID --config "$HERMES_HOME/hindsight/config.json"` exactly once. Do not call `hindsight_retain` directly.
2. Require a `radulator-release-learning-receipt/v1` response. The helper uses the idempotent `kanban_closure` strategy, stores only the six sanitized learning fields, and performs exact-document Hindsight readback.
3. Only after successful readback, append `learned` with the returned receipt id and retention id using `lifecycle_controller.py append`.
4. Render the deterministic `learned` actions, complete the parent Kanban task, verify the task readback is terminal (`done` or an already-archived tracker), then append `complete` with the Kanban receipt.

Never retain failed experiments, review discussion, raw PR bodies, credentials, patient data, clinical images, or unsupported conclusions. Never edit source, jobs, profiles, skills, or memories during this job. If the state changed, retention failed, or readback is unavailable, leave the task incomplete and report the exact failure.
