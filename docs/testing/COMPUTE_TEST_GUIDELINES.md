# Compute Test Guidelines (Manual Spot Checks)

Purpose: verify calculator compute logic with deterministic, hand-picked edge cases.
Scope: compute-only correctness. UI and component behavior remain in Playwright tests.

## Structure
- Fixtures live in `tests/fixtures/compute/`.
- One JSON file per calculator: `<calculator-id>.json`.
- Use fake data only (no PHI).

## Fixture Schema
```
{
  "calculatorId": "lung-rads",
  "calculatorName": "Lung-RADS v2022",
  "version": "compute-spotcheck-v1",
  "cases": [
    {
      "id": "baseline-no-nodules",
      "description": "Baseline exam with no nodules",
      "inputs": { "prior_ct": "no_not_expected", "nodule_type": "none" },
      "expect": {
        "noError": true,
        "fields": [
          { "key": "Lung-RADS Category", "equals": "1 - Negative" },
          { "key": "Management", "includes": "12 months" }
        ]
      }
    }
  ]
}
```

### Optional `inputPreset` (calculator-specific shorthand)

Fixtures may use a compact `inputPreset` when direct `inputs` would be repetitive.
Current supported preset is for `thypro-39`:

```
{
  "inputPreset": {
    "mode": "single",
    "singleValue": "2",
    "overrides": { "gs1": "4" }
  }
}
```

Delta mode shorthand:

```
{
  "inputPreset": {
    "mode": "delta",
    "baselineValue": "3",
    "followupValue": "1",
    "baselineOverrides": {},
    "followupOverrides": {}
  }
}
```

## Expectations
- Use `equals` for stable, short values.
- Use `includes` for long sentences or when symbols (>=) may vary by encoding.
- Each case must include at least 2 field checks.
- If an error path is expected, set `expect.noError` to false and include
  `{ "key": "Error", "includes": "..." }`.

## Coverage Rules
- Include at least:
  - 1 benign/low-risk case
  - 1 boundary/threshold case
  - 1 high-risk/escalation case
- For complex rule sets, add a downgrade/upgrade case if applicable.

## Test Runner
- Compute tests: `npm run test:compute`
- UI tests: `npm run test:calculator` (Playwright)
