# WCAG 2.1 AA Phase 1 Accessibility Audit

## Scope

Initial audit pass covered the Radulator app shell, shared form/result components, onboarding overlay, and custom calculator components that bypass the shared field renderer.

## Fixed In This Sprint

- Added a skip-to-calculator link and targetable main content landmark.
- Added stronger global `:focus-visible` styles for links, buttons, form fields, and custom interactive controls.
- Replaced nested/invalid favorite controls with sibling buttons and added `aria-pressed`/`aria-current` states.
- Added polite live-region semantics to calculator results, CSV import status, feedback submission status, and custom AVS result panels.
- Added assertive alert semantics for dynamic errors and conflicting AVS validation messages.
- Added generated accessible names for repeated dynamic inputs in IPSS, MR elastography, AVS cortisol, and AVS hyperaldosteronism workflows.
- Added persistent ids/label associations for top-level controls in the AVS custom calculators.
- Increased light-mode result severity text contrast tokens to better satisfy WCAG AA contrast targets.
- Added accessible state/name metadata for collapsible input sections, references, guide dialog, and Khoury filter controls.
- Defaulted shared non-link `Button` components to `type="button"` while preserving explicit submit buttons.

## Verification

- `git diff --check` passes.
- Parsed all 68 `src` JS/JSX files successfully with Babel parser.
- Confirmed all raw JSX `<button>` elements have explicit `type` attributes.
- `npm run build` passes.
- `npm run lint` reports 71 existing project-wide errors; a clean `main` baseline run reports the same 71 errors, so no lint delta was introduced by this accessibility pass.
- `npm run test:smoke` could not start in this sandbox because local port binding is denied (`listen EPERM` on `127.0.0.1:5173` and `::1:5173`).

## Remaining Follow-Up Items

- Run a full browser-based axe or equivalent audit across representative calculators once an accessibility test dependency is available.
- Re-run `npm run test:smoke` in an environment that allows Playwright to bind a local Vite server.
- Complete manual keyboard tab-order QA across all calculator categories, especially dense dynamic-row workflows.
- Consider converting repeated dynamic sample grids into semantic tables or grouped fieldsets in a later UI pass.
- Contrast-check static public HTML pages (`about.html`, `privacy.html`, `terms.html`) separately from the React app shell.
