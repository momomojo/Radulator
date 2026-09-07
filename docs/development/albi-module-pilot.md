# ALBI modularity pilot

This pilot extracts the ALBI numeric calculation into `src/clinical/albi.js`.
The `ALBIScore.jsx` adapter remains the registry-facing definition and retains
the existing metadata, user-facing copy, formatting, severity, and URLs.

The pure function preserves the existing parseFloat-or-zero behavior, SI/US
conversion factors, physiological input ranges, raw-score grade boundaries,
and six canonical fixture vectors. It is an extraction only; it does not add
clinical input hardening or broaden the model's source-defined scope.

The ALBI primary-source audit continues to validate the published equation,
units, grade intervals, safety boundary, and executable vectors after the
formula moved to the clinical core. The focused modularity test is run through
the existing JSX-loader test path, alongside the canonical compute fixtures.
