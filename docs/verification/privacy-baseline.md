# Privacy baseline — staged delivery

## Runtime containment (this change)

Application analytics helper exports are inert; raw search and initial-URL event calls are removed. Compute diagnostics and React caught/uncaught/recoverable callbacks emit fixed codes without error arguments. Calculator behavior, navigation, copy/print controls and deliberate Formspree feedback remain available. No clinical formulas, release controls or build configuration change.

Owner and independent source review accepted these runtime changes as part of the integrated privacy candidate `94a2f43646699a2974eb5563fe448468f4f6d861`. This PR separates its unchanged runtime subset to preserve the existing mixed-trust-domain protection; final signed review still judges the actual PR revision.

Focused production-preview tests exercise searches, numeric calculation/results, actual Chromium clipboard, feedback interception and actual error recovery on main/static routes. A strict request predicate rejects nonstatic, external, query-bearing and unknown-file requests after the initial document request; deliberate aborted controls prove rejection of numeric POST/image payloads. The separate real React probe covers development and production caught/uncaught/hydration paths. Local Vite development runs visibly skip the production-only transport spec; they are not privacy acceptance evidence.

Commands for this stage:

```text
npm ci
npm run build
node scripts/privacy-root-errors.test.mjs
CI=true npx playwright test tests/e2e/privacy-baseline.spec.js tests/e2e/error-boundary.spec.js tests/e2e/feedback-form.spec.js --project=chromium
npm run lint
npm run check:invariants
```

Owner observed13/13 focused tests, the real React probe, build, lint and invariant checks passing on the staged tree before publication. Required final full CI, signed acceptance and exact live proof remain separate release steps.

## Still required: build-side containment

This stage does **not** remove the old analytics SDK build injection or assert that its automatic collection is safe. The build/control-only follow-up removes that loader/CSP destinations even with a configured measurement ID, installs the repeatable `npm run test:privacy` configured-artifact gate referenced by the test's local skip message, integrates it into existing CI without rebuilding, and updates public privacy wording. Those changes are independently reviewed locally but not delivered by this runtime-only PR. Do not claim the whole privacy baseline complete until both stages and live production-configured QA pass.

Hosting/request logs, browser/device copies and voluntary feedback remain external or user-controlled data surfaces. These tests do not establish global anonymity, secure erasure, legal certification or arbitrary third-party exception sanitization.
