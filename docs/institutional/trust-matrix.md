# Radulator Institutional Trust Boundary

Status: implementation draft for owner/counsel review.

## Implemented Facts

- Institutional builds use a separate edition resolver and output directory.
- The current institutional allowlist and validation manifest are exactly `[]`.
- Institutional generated registry imports zero calculator components.
- Institutional builds require `RADULATOR_RELEASE_VERSION`.
- Institutional builds reject public telemetry, search-verification, form-provider, ad-provider, and pixel environment variables before Vite runs.
- Institutional HTML uses a first-party-only static meta CSP. `frame-ancestors` is not claimed from meta CSP.
- Release metadata and emergency release control are first-party static JSON files.

## Explicit Holds

- No calculator has rights, validation, clinical, and deployment approval for this institutional release.
- No UCI branding, endorsement, pricing, deployment authorization, or support channel is included.
- No license choice or commercial contract term is changed by this implementation.
- No FDA/device classification statement is made by this implementation. Regulatory positioning is owner/counsel-gated.
- Public privacy or terms legal wording is not revised in this PR except for the new draft institutional pages and docs.

## Safe Product Copy Boundary

Permitted implementation copy may say that the institutional build is browser-local, first-party static, zero telemetry after proof, versioned, and release controlled. It may say independent professional judgment remains required.

Do not claim blanket calculator validation, licensing clearance, clinical authorization, endorsement, or regulatory classification.
