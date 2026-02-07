# UI Testing Best Practices Alignment

Source: https://github.com/NoriSte/ui-testing-best-practices
Last updated: 2026-01-28

Scope: Playwright E2E tests under tests/e2e and shared helpers.

## Status Legend
- OK: implemented or already satisfied
- NA: not applicable to this app/test suite

## Checklist
| Area | Practice | Status | Notes |
| --- | --- | --- | --- |
| 1.1 | Use multiple test types where appropriate | OK | E2E plus compute tests; scope is calculator UI + compute accuracy. |
| 1.3 | Choose a reference browser | OK | Playwright config uses chromium as the default project. |
| 1.5 | Prefer small independent tests | OK | Each test navigates to a calculator and asserts locally. |
| 2.1 | Await, do not sleep | OK | No fixed sleeps in tests/helpers or E2E specs. |
| 2.2 | Name test files clearly | OK | Files follow calculator-based naming. |
| 2.4 | Reach UI state without using UI when possible | OK | Helper navigates via URL hash; smoke tests still exercise UI flows. |
| 2.6 | Keep abstraction low | OK | Helper utilities are minimal and focused. |
| 3.1 | Test request/response payloads | NA | Calculators are client-only; no backend payloads. |
| 3.2 | Test server schema | NA | No server schema in this app. |
| 3.3 | Test monitoring | NA | No monitoring endpoints in this app. |
| 4.1 | Use a testing strategy (pyramid) | OK | E2E for UI + compute tests for formulas. |
| 5.1 | Tests as documentation | OK | Descriptive test names and grouped suites per calculator. |
| 6.2 | Visual regression testing | NA | Not required for this UI; consider future visual baselines. |
| 7.1 | Repeatable test states | OK | Each test starts from a clean navigation state. |
| 7.2 | Reduce test flake | OK | Removed brittle style-class selectors; prefer stable test ids or text/role locators. |
| 7.3 | Limit combinatorial explosion | OK | Tests focus on representative boundary and clinical cases. |
| 7.4 | Performance testing | OK | Targeted performance checks exist (Khoury selector). |
| 7.5 | Email testing | NA | No email flows. |
| 8.1 | Learn from real-life examples | OK | Applied to test design where relevant. |
| 8.2 | Use interviews and pairing | NA | No formal pairing process embedded in repo. |

## Notes
- Smoke tests still use sidebar clicks to validate navigation UI.
- Calculator info/description now have stable data-testid attributes for resilient locators.