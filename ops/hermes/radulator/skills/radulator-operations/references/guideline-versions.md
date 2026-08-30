# Radulator guideline and source registry — WF-3

The canonical machine-readable registry is [`guideline-versions.json`](guideline-versions.json). The monthly WF-3 watcher must read that JSON, not infer versions from this prose.

Each live calculator export has exactly one registry record. A record identifies the basis implemented by the calculator:

- a versioned clinical guideline or reporting/classification system;
- a consensus statement;
- a primary model, published formula, reference dataset, or measurement reference;
- manufacturer data that must be checked against current product information; or
- an explicit non-clinical row.

`verification_status: "verified"` is a dated assertion bounded to the listed source, the wording in `justification`, and `implementation_evidence`. Each verified row identifies the exact executable calculator, canonical compute fixture, bounded source locators and facts, dimensions under review, and literal vector IDs that exercise those facts. Every listed primary publication or official authority must have at least one such claim. When a primary equation or reference artifact is supplied separately, the evidence may pin its name, size, and SHA-256 digest. The KBRC row names `npm run test:kbrc-source`, which downloads the primary XML and the directly reviewable Elsevier supplementary PDF, verifies the exact member digest, derives the signed terms and published vectors, compares them with runtime and fixtures, and deletes the source bytes without committing them. The Bosniak row names `npm run test:bosniak-source`, which retrieves both the Silverman v2019 classification publication and the CUA 2023 management guideline. The temporary BI-RADS row retains the historical command `npm run test:birads-fda-source` for workflow compatibility. It retrieves the digest-pinned official ACR Fifth Edition Quick Reference plus the public ACR mammography, ultrasound, and MRI summary forms. The former constrains modality-gated descriptor choices; the latter constrain category structure, source-literal likelihood endpoints, and management wording. It explicitly does not claim full fifth- or sixth-edition manual validation or descriptor-to-category inference. `verification_status: "seed-unverified"` records the app's implemented claim and a primary-source check target only. It must never be described as current or verified, must not carry `implementation_evidence`, and `last_verified` must remain `null` until an authoritative review is completed.

## Migrated and rechecked status

- The prior Mini registry was audited read-only on 2026-08-25. Bosniak v2019 was rechecked on 2026-08-26 against the Silverman classification publication and CUA 2023 IIF management recommendations. MELD 3.0/OPTN was rechecked on 2026-08-25 against Policy 9.1.D for calculation rules and the official calculator user guide for the distinct laboratory-entry domains. On 2026-08-29, BI-RADS was temporarily rolled back to a clearly labeled fifth-edition workflow while the full sixth-edition manual is pending. Its bounded verification covers the digest-pinned fifth-edition quick reference for modality-gated descriptors and the public v2025 modality summaries for category structure, source-literal likelihood endpoints, and management wording; full manual validation and descriptor-to-category inference remain pending.
- CAC/MESA, Cockcroft-Gault, and PESI received dedicated primary-source records verified on 2026-08-25. CAC/MESA now binds the exact-300 CAC-DRS boundary to the accessible 2023 multi-society AUC Table 1.2. The Kidney Biopsy Major Bleeding Risk Calculator is verified from the 2026 primary paper and its digest-pinned Item S1 supplement with an independent live-source audit rather than a same-commit manifest oracle.
- All other clinical records remain `seed-unverified`; the migration does not upgrade their evidence status.
- The website feedback form is mapped explicitly as `non-clinical` and has no invented medical source.

## Watcher rules

1. Process only records whose source can be read from the named primary publication or official authority.
2. A no-change review may update `last_verified` and `verification_status` only after the exact source was read, each source-derived claim was bounded in `justification` and `implementation_evidence`, and the referenced vectors passed against the real calculator export.
3. A version or source delta creates or updates one deduplicated `guideline-review:` Kanban card and release tracker; the watcher never edits calculator logic.
4. Calculator changes proceed through deterministic clinical tests, exact-head signed primary and verification review when high-risk, protected merge, promotion, deployment smoke, release-marker readback, and retained learning.
5. `NEEDS_FIX` requires a corrected head and re-review; it is not a passive owner hold.

The repository test `npm run test:hermes-guideline-registry` fails when a live calculator lacks a mapping; a row invents verification status; a source URL, locator, fact, artifact digest, path, or vector is missing or unbounded; a verified claim lacks primary/official-source coverage; a seed-unverified row carries implementation evidence; or a referenced vector does not produce its literal expected result from the real calculator code. The separate `npm run test:kbrc-source`, `npm run test:cac-drs-source`, `npm run test:bosniak-source`, and historically named `npm run test:birads-fda-source` commands retrieve and verify the named primary or official artifacts. The BI-RADS command verifies the ACR fifth-edition quick-reference artifact and three public modality summary forms, not FDA pages and not a complete manual. Exact-head clinical judges still decide whether each bounded source interpretation is clinically sufficient.
