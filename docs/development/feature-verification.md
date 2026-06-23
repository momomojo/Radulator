# Feature verification and vibe proof

For UI/product changes, green tests are necessary but not enough. A fresh verifier should drive the running app and capture evidence that the intended user outcome works and feels Radulator-grade.

## When required

Use this before PR handoff for:

- new visible UI behavior;
- report/copy/print workflow changes;
- navigation/search/onboarding changes;
- calculator layout/presentation changes that do **not** alter medical logic.

Medical formula/threshold/guideline/content changes still require the medical evidence/signoff pipeline before implementation.

## Procedure

1. Start a local app target:

```bash
scripts/dev-local.sh up
# or production-like:
scripts/dev-local.sh preview
```

2. Capture deterministic proof for the target route:

```bash
node scripts/capture-feature-proof.mjs \
  --url http://127.0.0.1:5173 \
  --route '/#/dlp-dose' \
  --name dlp-report-snippet \
  --expect-text 'DLP to Effective Dose'
```

3. For subjective UX/vibe, ask a fresh read-only verifier to drive the app. Suggested prompt:

```text
You are a read-only Radulator feature verifier. Do not edit code. Drive the running app at <url> and verify this feature: <acceptance criteria>. Check desktop and mobile, console/page errors, keyboard flow where relevant, copy/report behavior, and Radulator vibe: calm clinical tone, polished spacing/typography, no clutter, no generated-feeling copy, no bolted-on UI. Return works|broken with observed evidence and screenshot/trace paths.
```

4. Include the proof artifacts in the PR/task note:

- `test-results/feature-proof/<name>.md`
- `test-results/feature-proof/<name>.json`
- `test-results/feature-proof/<name>.png`

## PR body checklist

```markdown
## Feature verified
- [ ] Fresh verifier drove the real app
- [ ] Screenshot/trace/proof path linked
- [ ] Desktop/mobile or relevant viewport checked
- [ ] Console/page errors checked
- [ ] Radulator vibe checked

## Regression guardrails
- [ ] npm run check:invariants
- [ ] npm run lint
- [ ] npm run build
- [ ] npm run test:smoke
```
