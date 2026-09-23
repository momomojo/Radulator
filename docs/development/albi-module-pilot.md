# ALBI modularity pilot

> Historical implementation note for PR #251 (merged and promoted by #252).
> Not the current input contract or an open task. Current clinical behavior,
> acceptance and release status live only in the
> [ALBI canonical record](../verification/calculators/albi-score.md).

This pilot extracts the ALBI numeric calculation into `src/clinical/albi.js`.
The `ALBIScore.jsx` adapter remains the registry-facing definition and retains
the existing metadata, user-facing copy, formatting, severity, and URLs.

At that historical revision, the pure function preserved parseFloat-or-zero behavior, SI/US
conversion factors, then-existing application input limits, raw-score grade boundaries,
and six canonical fixture vectors. It is an extraction only; it does not add
clinical input hardening or broaden the model's source-defined scope. Later
ALBI work replaced loose parsing and hard application limits; do not restore
those historical behaviors from this note.

The ALBI primary-source audit continues to validate the published equation,
units, grade intervals, safety boundary, and executable vectors after the
formula moved to the clinical core. The focused modularity test is run through
the existing JSX-loader test path, alongside the canonical compute fixtures.
