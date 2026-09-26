# Fleischner secondary-table source snapshots

These two files contain the unaltered `<table>…</table>` fragments extracted from
the official publisher's table pages, with one final newline added for storage.
They are **not NLM response bytes**, new clinical guidance, or release approval.

## Attribution and permitted reuse

Gerald F. Abbott and Ioannis Vlahos, *CT Diagnosis and Management of Focal Lung
Disease*, 2019, in *Diseases of the Chest, Breast, Heart and Vessels 2019–2022*,
Springer, DOI [10.1007/978-3-030-11149-6_5](https://doi.org/10.1007/978-3-030-11149-6_5).

- [Chapter and rights statement](https://link.springer.com/chapter/10.1007/978-3-030-11149-6_5)
- [Table 5.1](https://link.springer.com/chapter/10.1007/978-3-030-11149-6_5/tables/1)
- [Table 5.2](https://link.springer.com/chapter/10.1007/978-3-030-11149-6_5/tables/2)
- [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

The chapter explicitly licenses reuse under CC BY 4.0, including third-party
material unless a credit line excludes it. The inspected table footers cite
MacMahon H, Naidich DP, Goo JM et al., *Radiology* 2017;284:228–243 and contain
no separate exclusion or permission-only credit. Website navigation and wrapper
content are omitted; table contents are not edited. Full downloaded responses
and their identities are retained in the owner's existing evidence store, not
published as part of these fragments.

## Independent source review

On September 24, 2026 (Pacific), the independent read-only reviewer
`/root/nlm_snapshot_provenance` inspected both downloaded publisher tables, their
back-links and adjacent credits, and the chapter's rights notice. It ran the
existing `extractHtmlLiteralText()` without changing that parser and compared
the full normalized text against the existing reviewed NLM locator digests.

| Table | Original fragment bytes | Original fragment SHA-256 | Complete normalized text SHA-256 |
|---|---:|---|---|
| 5.1 | 1586 | fbae89fb9c8a9fdd91fa767fc15b0617ce978f1d74ef8481557b4caf202c4c06 | 5a9a7516677d89bebaacb9febb486dad0946ab8170a5047d52a20ab623648c5e |
| 5.2 | 1053 | f109012079057aff8ea2a3ecd26f030945a1a9a3e8510e7fd46c554fc43cc26a | fee89cdab0d0498ac55ecb9bb6f655fe555ca9a857fd662636dd5304447ae3e9 |

Result: both complete normalized text identities match the previously reviewed
NLM table text exactly; all four existing required snippets are present. The
review supports these explicitly identified alternate secondary snapshots only.
It does not establish equality of the original markup, full documents, response
provenance, or currently inaccessible live NLM content. It is a source-based AI
review, not professional certification or a signed release verdict.

The existing reviewed payload and clinical expected answers are unchanged.
`table_snapshots` in the existing Fleischner evidence manifest records the
actual stored-file hashes (including the final newline), download-response
identities, claim bindings, and 30-day review deadline. The audit verifies the
full normalized text, not just selected substrings. Its output labels alternate
publisher provenance separately from the historical NLM claim identifiers.

## Renewal and invalidation

The RSNA measurement figure's archive route now serves the 2022-01-19T11:06:01Z
capture instead of the original 2020 capture. A narrowly pinned transport refresh
retains the original RSNA URL, 62,198-byte length, SHA-256
`5ec3df4bb0491f3d0eca1d84b85bd77882161d9c5628c0151b24f7e5a8f070a9`,
media type, dimensions/transcription and last-modified value. The new ETag is
`"36aed1d449f2d313"`; the actual capture identity is reported in audit output.
The original reviewed clinical payload is retained unchanged as historical
evidence. All primary-source assertions still run; no arbitrary redirect,
content substitution, or primary-source snapshot exception is allowed.

Renew only after checking source currency and independently reviewing the
affected provenance/claim scope. Do not refresh dates or parser fingerprints just
to make a failing gate green. Valid changed live content, changed clinical code
or expected vectors, an altered parser, corrupt bytes, or expired review blocks
reuse. Source availability is not evidence of guideline currency. Independent
signed exact-head release approval and production verification remain separate.
