# Per-calculator baseline record contract

This document defines the optional `baseline_review` field on an existing
guideline-registry record. It is an evidence interface, not a new registry,
service, database, clinical certification, or release authorization. Existing
registry fields (including `verification_status`, `last_verified`, sources, and
implementation evidence) remain independent and unchanged.

## Contract

The registry record may contain one `baseline_review` object with these fields:

```json
{
  "plan_path": "docs/verification/plans/example.md",
  "applicability": "current",
  "supported_scope": "The exact calculator subject and supported clinical scope.",
  "clinical_review": {
    "status": "pending",
    "date": null,
    "reviewer": null,
    "revision": null,
    "evidence": [],
    "scope": null
  },
  "calculation_tests": {
    "status": "pending",
    "date": null,
    "reviewer": null,
    "revision": null,
    "evidence": []
  },
  "browser_review": {
    "status": "pending",
    "date": null,
    "reviewer": null,
    "revision": null,
    "evidence": []
  },
  "release": {
    "status": "pending",
    "date": null,
    "reviewer": null,
    "revision": null,
    "evidence": []
  },
  "blockers": [],
  "restrictions": []
}
```

`plan_path` is either `null` or a repository-relative Markdown path. Inventory
generation requires every non-null path to resolve to an existing regular file
inside the selected repository, including after symlink resolution. Missing
files, directory paths, absolute paths and repository escapes are rejected.
This checks the artifact's existence, not the clinical adequacy of its content.
`applicability` is one of
`unassessed`, `current`, `legacy`, or `deferred`. `supported_scope` is a
non-empty string. Each phase has a status of `pending`, `recorded`, `blocked`,
or `deferred`; a date is `YYYY-MM-DD` or `null`; a reviewer is a string or
`null`; a revision is a 40-character lowercase Git SHA or `null`; and evidence
is an array of non-empty citation/path/locator strings. Recorded phases require
non-empty evidence. A recorded clinical review additionally requires a
non-empty `clinical_review.scope` and a non-null `plan_path`. For non-recorded
clinical phases, `scope` may be omitted or null; an omitted scope is rendered
as null. This is the only optional phase field. Plan paths cannot contain NUL.
Blocked or
deferred records require a clear blocker or restriction.

An absent `baseline_review` is rendered as explicit `unassessed` applicability
with all four phases `pending`. A present but malformed record is rejected;
missing fields are not silently converted to pending. Legacy `verified` flags,
fixture counts, test files, URLs, and browser-spec presence never promote a
baseline phase. Clinical review does not promote calculation tests, browser
review, release, the existing `clinicalSignoff` field, or live proof.

Baseline counts are reported per applicability and independently per phase.
There is intentionally no single certified or completed count. Recorded
evidence is historical: the exact subject, scope, source, revision, and current
state must be rechecked before reuse. The schema makes no claim of live
freshness.

## Compact per-calculator plan template

Create and review a real plan before adding a record. Do not create placeholder
plans or populate records from registry/spec presence alone.

```markdown
# [Calculator name] baseline plan

- Calculator ID: `[permanent-id]`
- Subject and applicability: [current / legacy / deferred, with the exact population or use context]
- Supported scope: [what the calculator covers, including explicit exclusions]
- Primary sources: [citation, URL or repository path, and locator]
- Clinical questions: [claims, units, thresholds, interpretation, and management wording to verify]
- Expected calculation cases: [owner-approved case IDs and expected outputs]
- Browser proof: [routes, interactions, and output assertions to verify]
- Release proof: [exact revision, environment, and live-state checks required]
- Blockers/restrictions: [what prevents a complete phase or limits reuse]
- Reviewer and date: [record only after the review actually occurs]
```

The owner populates genuine plans and registry entries after source research.
This interface does not assert that any calculator has completed clinical review.
