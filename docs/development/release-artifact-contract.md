# Release artifact contract

The protected Pages workflow builds one immutable artifact for each workflow
run attempt. The authorizer first captures the trusted controller commit and
returns the authorized source commit, source tree, deployment mode, and (for
ordinary releases) the reviewed PR head. Every later controller checkout uses
that captured controller SHA.

The build writes `releases/<source-sha>.json` with the source SHA, source tree
SHA, reviewed head (or explicit `null` for rollback), a sorted binary payload
manifest, and its SHA-256 `payloadDigest`. The marker is verified after the
already-built preview smoke and immediately before the single
`actions/upload-pages-artifact@v3` upload.

The native artifact name is
`radulator-pages-<build-run-id>-<build-attempt>`. Deployment re-reads the
original event through the pinned authorizer, compares all source identity
fields with the authorized build, and validates the exact artifact ID/name,
run, attempt, size, expiry, and native `sha256:` archive digest through
`verify-release-artifact.mjs`. The retained receipt keeps that archive digest
separate from the site payload digest. The exact captured artifact name is
passed to `actions/deploy-pages@v4`.

Live smoke checks the source SHA, source tree SHA, and payload digest from the
same build. Smoke and artifact receipts include the workflow run attempt in
their evidence names. A failed or skipped authorization, build, marker, smoke,
or artifact-validation step leaves publication skipped.

Rollback keeps the existing verified historical-source selection and
supersession/loop-prevention behavior. It rebuilds that authorized historical
source with current production configuration and writes a new manifest; it is
not represented as a bit-identical historical artifact. Rollback markers carry
`reviewedHeadSha: null`. The independently selected last-known-good source may
be older than, or equal to, the current controller/main head; no source equality
or inequality replaces run-level rollback authority and supersession checks.

The migration remains opt-in: missing/empty `RADULATOR_RELEASE_MODE` means the
existing release train. Deploy this control change through that protected path,
add the existing exact-head clinical authorization to required native protection,
and rehearse rollback without changing production before opting into single-main.
Prove a normal calculator PR and its exact live artifact before disabling the
promotion routine. If acceptance fails, leave or restore release-train routing;
do not weaken the gates to make the canary pass. No broker provisioning belongs
to this migration.
