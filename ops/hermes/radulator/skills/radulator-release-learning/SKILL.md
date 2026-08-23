---
name: radulator-release-learning
description: Use when a Radulator lifecycle task has verified production smoke and needs one concise durable lesson before completion.
---

# Radulator Release Learning

Retain only released, production-verified learning. Run `learning_context.py --ledger "$RADULATOR_LIFECYCLE_LEDGER" --task-id TASK_ID` and treat its JSON as the entire allowed context.

1. Confirm the candidate schema is `radulator-release-learning/v1` and the lifecycle is still `smoke_passed` for the same task and released SHA.
2. Call `hindsight_retain` once using `retention_id` as the idempotency key. Retain the feedback symptom, root cause, regression test, released SHA, smoke proof, and reusable rule—nothing else.
3. Read back the retention receipt. Only after successful readback, append `learned` with the receipt id and the same retention id using `lifecycle_controller.py append`.
4. Render the deterministic `learned` actions, complete the parent Kanban task, verify the task readback is complete, then append `complete` with the Kanban receipt.

Never retain failed experiments, review discussion, raw PR bodies, credentials, patient data, clinical images, or unsupported conclusions. Never edit source, jobs, profiles, skills, or memories during this job. If the state changed, retention failed, or readback is unavailable, leave the task incomplete and report the exact failure.
