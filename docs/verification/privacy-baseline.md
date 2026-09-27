# Privacy baseline verification

Task 5 is a bounded application-analytics containment change. The owner decision is to pause analytics SDK/event sinks for this baseline, not to replace them. Calculator formulas, search/navigation, copy/print, feedback submission, permanent routes, registry metadata, and generated static pages remain in scope for preservation only.

## Implemented boundary

- `src/lib/analytics.js` keeps the existing named exports as documented compatibility no-ops. They do not read or forward event parameters to browser globals, network destinations, or console output.
- `src/App.jsx` no longer sends a separate pageview or debounced search event. Compute failures retain the existing visible recovery state and may emit only the fixed development code `RADULATOR_COMPUTE_ERROR`.
- `src/components/ErrorBoundary.jsx` retains visible recovery UI without duplicate payload logging. `src/lib/rootErrorDiagnostics.js` supplies fixed-code `onCaughtError`, `onUncaughtError`, and `onRecoverableError` callbacks to both `hydrateRoot` and `createRoot` through the exported `ROOT_OPTIONS` in `src/main.jsx`; callbacks do not access or serialize React error arguments.
- `vite.config.js` retains search-verification injection and static-page generation but removes GA/tag-manager injection, analytics resource hints, measurement-ID branching, and build-time analytics messages.
- `index.html` removes GA destinations from the application CSP and leaves same-origin plus Formspree connectivity. The GA placeholder is removed.
- `public/privacy.html` states that application analytics are paused, calculator processing is local, feedback is voluntary and handled by Formspree, hosting/request logs remain possible, and patient information must not be placed in feedback or URLs. It does not claim global anonymity, legal certification, or that submitted feedback text cannot contain PHI.

## Focused evidence

`tests/privacy-baseline.test.mjs` covers inert compatibility helpers with synthetic parameters, fixed error-log source contracts and both root entry paths, production HTML built with a valid-looking synthetic `VITE_GA4_MEASUREMENT_ID`, CSP removal, retained Google/Bing verification tags, retained `/calculators/tirads/` static output, and privacy text.

`scripts/privacy-root-errors.test.mjs` bundles the real `ErrorBoundary`, React 19, and exported root options in memory and runs real Chromium caught, uncaught, and hydration-recoverable synthetic failures in development and production. It asserts recovery where supported, the fixed generic diagnostic, and absence of the raw synthetic error from console/pageerror.

`tests/e2e/privacy-baseline.spec.js` records request URL, method, resource type, and POST body before aborting unexpected transports. After the initial document request, only same-origin GET requests for existing files in the tested build, without query parameters, are accepted. This rejects ordinary numeric input/result payloads as well as named canaries, including image requests used as transport. It lets the former 500ms search debounce expire, enters synthetic search text and actual numeric calculator inputs, checks the calculated result, copy and print controls, fragment/query URL behavior, requests/resources, and console messages. Native clipboard read is granted on Chromium. A deliberate same-origin POST containing named search/input/result/URL/error canaries is intercepted and aborted; the assertion must reject it without sending it to a server. The named input/result strings belong to that negative control, not to the numeric calculator fields. The initial hosting document request remains outside application telemetry containment.

The same spec exercises actual render and compute failures through the existing localhost-only test fixtures after both the main route and generated static TI-RADS route load. It checks recovery, navigation, and absence of raw synthetic error text. It does not introduce a public production fault-injection API. `tests/e2e/feedback-form.spec.js` separately intercepts the Formspree POST and asserts success without analytics transport.

The repeatable local gate is `npm run test:privacy`: `test:privacy:artifact` constructs one test-only `dist` build and validates it with `tests/privacy-baseline.test.mjs`, then `test:privacy:browser` runs the real React error probe and Chromium privacy/recovery tests against that artifact. It is never a deploy command. The Smoke workflow uses the same two commands around browser installation, then runs its ordinary smoke tests without rebuilding. Static regression assertions enforce this one-build command/workflow contract.

The containment spec explicitly skips with this command as its explanation when the ordinary local runner serves Vite development on port 5173: development source modules are not published build files. Required PR checks and `test:privacy` serve the production build on port 4173 and run every containment case. Both calculation and real-error browser paths use the same strict request predicate; the independent React probe still exercises development and production bundles.

The configured artifact is built with:

```text
VITE_GA4_MEASUREMENT_ID=G-PRIVACY-BASELINE
VITE_GOOGLE_SITE_VERIFICATION=privacy-google-token
VITE_BING_SITE_VERIFICATION=privacy-bing-token
CI=true npm run build
```

## Scope boundary and limitations

The scoped source review found no additional `window.gtag`, data-layer, beacon, XHR/fetch, or console input-bearing sink under `src`; UI preference localStorage remains local and was not changed. Console/error handling in unrelated scripts and deployment tooling remains outside this task. Hosting/CDN/request logs and voluntarily submitted Formspree content remain external processing surfaces. The root-error probe proves application callback redaction for the exercised React paths; it does not claim to hide developer-tool DOM values or sanitize arbitrary third-party/browser exceptions. The full Playwright suite and release/publication steps remain owner-coordinated and are not claimed here.
