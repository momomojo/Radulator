#!/usr/bin/env python3
"""Classify the 279 failures by error type and extract sample locators."""
import re
from collections import Counter

with open('/tmp/run_27443.log') as f:
    content = f.read()

# Remove ANSI escape codes
clean = re.sub(r'\x1b\[[0-9;]*[a-zA-Z]', '', content)
lines = clean.split('\n')

# Find every Error: expect(locator).XXX line and capture context
errors = []
for i, line in enumerate(lines):
    if 'Error:' in line and 'expect(' in line:
        # Find which spec
        spec = 'unknown'
        for j in range(max(0, i - 15), i):
            tl = lines[j].strip()
            m = re.search(r'tests/e2e/calculators/[^/]+/([^/.]+)', tl)
            if m:
                spec = m.group(1)
                break

        # Get the actual error message lines (locator info)
        err_parts = []
        for k in range(i, min(len(lines), i + 6)):
            ll = lines[k].strip()
            if ll:
                err_parts.append(ll)

        errors.append({
            'spec': spec,
            'error_text': ' | '.join(err_parts)[:300],
        })

# Classify each error by assertion type
error_types = Counter()
for e in errors:
    el = e['error_text']
    if 'toBeVisible' in el:
        error_types['toBeVisible'] += 1
    elif 'toHaveCount' in el:
        error_types['toHaveCount'] += 1
    elif 'toContainText' in el:
        error_types['toContainText'] += 1
    elif 'toHaveText' in el:
        error_types['toHaveText'] += 1
    elif 'toHaveValue' in el:
        error_types['toHaveValue'] += 1
    elif 'toBeChecked' in el:
        error_types['toBeChecked'] += 1
    elif 'toBeEnabled' in el:
        error_types['toBeEnabled'] += 1
    elif 'toHaveClass' in el:
        error_types['toHaveClass'] += 1
    else:
        short = el[:80].replace('\n', ' ')
        error_types[f'other: {short}'] += 1

print('=== ERROR TYPE COUNTS ===')
for k, v in error_types.most_common(30):
    print(f'  {k}: {v}')

print()
print(f'Total errors sampled: {len(errors)}')

# Show unique locator patterns (first 10)
print()
print('=== FIRST 8 UNIQUE ERROR PATTERNS ===')
seen = set()
for e in errors:
    # Normalize to get the locator pattern
    raw = e['error_text']
    key = re.sub(r'\s+', ' ', raw)[:150]
    if key not in seen:
        seen.add(key)
        print(f'[{e["spec"]}] {key}')
        print()

# Spec-by-spec breakdown
print('=== BREAKDOWN BY SPEC (failure count) ===')
spec_counts = Counter()
for e in errors:
    spec_counts[e['spec']] += 1
for k, v in spec_counts.most_common(40):
    print(f'  {k}: {v}')
