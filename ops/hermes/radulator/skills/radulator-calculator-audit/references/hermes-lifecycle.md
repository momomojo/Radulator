# Hermes lifecycle integration reference

This is a routing map and dated inspection, not a parallel calculator tracker.
Runtime status must be re-read. The skill does not start jobs, synchronize remote
files, grant release authority or provide deterministic duplicate suppression.

## Intake and closure check

Before proposing/converting/assigning calculator work, resolve calculator ID →
current protected-source canonical record → current release receipt. If the
receipt is pending, continue that task's obligations; if accepted scope is live,
reopen only a demonstrated defect, source delta or approved scope change. An
old registry/roadmap/journal is a lead, not authority to reimplement.

For claims about Hermes integration, inspect each relevant consumer and read
back its installed configuration/data. Keep these states separate:

```text
Source-reviewed scope → implemented/tested → signed/merged → deployed/live QA
                                                        ↓
                       installed planning records → acknowledged learning
```

Release success does not itself establish the bottom row. Ordinary owner work
need not be moved into a Hermes worker queue. If using the existing managed
lifecycle/learning path, create the authorized handoff and verify exact released
SHA, smoke evidence and retention readback; do not fabricate historical events.

## Existing paths to inspect

Paths are repository-relative unless stated otherwise:

| Consumer | Location / decisive check |
|---|---|
| Calculator truth | `docs/verification/calculators/<id>.md`, linked receipt, `ops/hermes/radulator/skills/radulator-operations/references/guideline-versions.json` |
| Generated summary | `scripts/calculator-verification-inventory.mjs`; verify what fields it actually evaluates |
| Planning/backlog | Installed `<profile>/skills/domain/radulator-operations/SKILL.md`, its `references/autonomy-loop.md` and `references/backlog-seeds.md`, actual job prompts |
| Intake dedupe | `ops/hermes/radulator/seed_convert_gate_dedupe.py`; issue identity alone does not establish calculator/scope closure |
| Managed task progression | `ops/hermes/radulator/lifecycle_controller.py`, `ops/hermes/radulator/skills/radulator-release-controller/SKILL.md`, actual lifecycle ledger |
| Independent review | `ops/hermes/radulator/skills/radulator-clinical-judge/SKILL.md`, exact candidate evidence and signed readback; inspect unchanged calculator records too when relevant |
| Retained learning | `ops/hermes/radulator/learning_context.py`, `ops/hermes/radulator/skills/radulator-release-learning/SKILL.md`, exact retention acknowledgment |
| Installation | `ops/hermes/radulator/install.py`; review selective file mapping, not a blind full-overlay reinstall |

The inspected host was `agent@agents-mac-mini.tail1339c4.ts.net`, with repository
`/Users/agent/Documents/Radulator`, profile
`/Users/agent/.hermes/profiles/radulator`, and default profile
`/Users/agent/.hermes`. Confirm host/profile ownership before operating. Read only
needed nonsecret fields. Never inspect private keys/auth tokens or copy credentials.

## Observed 2026-09-08 gaps (not repaired by installing this skill)

- ALBI candidate record and generated inventory linked the canonical receipt;
  profile-local registry still had an August29 row without those pointers.
  Inventory generation copied fields but did not evaluate receipt completion.
- Guideline watcher/digest read profile-local records. Seed dedupe bound issue
  identity, not calculator + accepted scope + released revision. No active ALBI
  duplicate issue was found; duplicate prevention was nevertheless unproven.
- No PR265/ALBI lifecycle event was found. Lifecycle and release-learning jobs
  were paused. GitHub release closure would not automatically establish Hermes
  retained learning. Seed conversion was also paused; preserve that state.
- Installed operations workflow9 described obsolete batching/backmerge/deploy
  behavior; actual promoter/controller scripts were authoritative. Roadmap text
  also overstated “merge equals deploy.”
- Fleet Brain distillation consumed historical closure/task/learning material
  without an explicit canonical-receipt preflight. A Strategist was described in
  documents, but current scheduled execution was not established.

Small follow-up integration: after protected release, selectively synchronize
registry pointers and read them back; add canonical-record preflight to existing
planning consumers; correct contradictory prose; connect an explicitly requested
lifecycle/learning handoff. Test consumer behavior on a completed scope and a new
source delta before claiming duplicate prevention. Keep these control changes
separate from the clinical PR and preserve customized judge prompts/schedules.

## Selective planning repair inspected 2026-09-09

The shared `radulator-operations/references/calculator-closure-preflight.md` is
installed on the Mac mini, with the existing ALBI canonical record/receipt as
the owner-directed handoff. The operations skill, autonomy reference and four
actual planning-consumer prompts (watcher, digest, paused seed conversion and
Fleet Brain) now route through that preflight. Stale owner-gate/batching/merge-
equals-deploy prose was corrected. Models, schedules, enabled/state and all other
non-prompt fields were read back unchanged; the other14 job configurations were
also compared. Original copies and SHA-256 identities are retained privately.

Three synthetic pending/completed/new-delta scenarios produced correct decisions
before and after; independent review found and repaired remaining contradictory
prose. This proves bounded instruction routing, not deterministic dedupe or
future behavior guarantees. The source-access/comparator workflow also records
raw-cutoff versus displayed-rounding differences and legitimate HTTPS fallbacks.

Registry synchronization still follows the actual protected ALBI release. No
ALBI managed-lifecycle event or retained-learning acknowledgment was fabricated;
those paused systems remain separate from this owner-directed closure. The
full profile overlay was not reinstalled, and judge jobs/keys were not changed.
