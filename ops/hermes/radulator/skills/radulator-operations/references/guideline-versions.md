# Radulator guideline and source registry — WF-3

The canonical machine-readable registry is [`guideline-versions.json`](guideline-versions.json). The monthly WF-3 watcher must read that JSON, not infer versions from this prose.

Each live calculator export has exactly one registry record. A record identifies the basis implemented by the calculator:

- a versioned clinical guideline or reporting/classification system;
- a consensus statement;
- a primary model, published formula, reference dataset, or measurement reference;
- manufacturer data that must be checked against current product information; or
- an explicit non-clinical row.

`verification_status: "verified"` is a dated assertion bounded to the listed source and the wording in `justification`. `verification_status: "seed-unverified"` records the app's implemented claim and a primary-source check target only. It must never be described as current or verified, and `last_verified` must remain `null` until an authoritative review is completed.

## Migrated and rechecked status

- The prior Mini registry was audited read-only on 2026-08-25. Its BI-RADS v2025, Bosniak v2019, and MELD 3.0/OPTN rows retain their existing 2026-08-24 verification dates and exact sources.
- CAC/MESA, Cockcroft-Gault, PESI, and the Kidney Biopsy Major Bleeding Risk Calculator received dedicated primary-source records verified on 2026-08-25.
- All other clinical records remain `seed-unverified`; the migration does not upgrade their evidence status.
- The website feedback form is mapped explicitly as `non-clinical` and has no invented medical source.

## Watcher rules

1. Process only records whose source can be read from the named primary publication or official authority.
2. A no-change review may update `last_verified` and `verification_status` only after the exact source was read and its claim was bounded in `justification`.
3. A version or source delta creates or updates one deduplicated `guideline-review:` Kanban card and release tracker; the watcher never edits calculator logic.
4. Calculator changes proceed through deterministic clinical tests, exact-head signed primary and verification review when high-risk, protected merge, promotion, deployment smoke, release-marker readback, and retained learning.
5. `NEEDS_FIX` requires a corrected head and re-review; it is not a passive owner hold.

The repository test `npm run test:hermes-guideline-registry` fails when a live calculator lacks a mapping, a record invents verification status, a source URL is unbounded or non-HTTPS, or a required field exceeds its schema bounds.
