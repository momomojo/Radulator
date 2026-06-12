#!/usr/bin/env python3
"""Analyze all hepatology specs for broken locator patterns."""
import subprocess

specs = [
    "hepatology/child-pugh",
    "hepatology/y90-radiation",
    "hepatology/bclc-staging",
    "hepatology/lirads",
    "hepatology/albi-score",
    "hepatology/milan-criteria",
    "hepatology/meld-na",
]

# Patterns to flag
patterns = {
    '.card, [class*="card"]': 'BROKEN: matches hidden mobile header bg-card',
    "text=\\\\\"g/dL": 'STRICT-VIOLATION: matches both (mg/dL) and (g/dL)',
    "text=\\\\\"mg/dL": 'STRICT-VIOLATION: matches both (mg/dL) and (g/dL)',
    "text=/Class": 'STRICT-VIOLATION: regex matches multiple result rows',
    "text=Child-Pugh Class": 'NOT-FOUND: result text not rendered',
    "text=Points Breakdown": 'NOT-FOUND: result text not rendered',
    "text=\\\\\"5 points": 'NOT-FOUND: no calculation triggered',
    "text=\\\\\"6 points": 'NOT-FOUND: no calculation triggered',
    "text=\\\\\"7 points": 'NOT-FOUND: no calculation triggered',
    "text=\\\\\"8 points": 'NOT-FOUND: no calculation triggered',
    "text=\\\\\"9 points": 'NOT-FOUND: no calculation triggered',
    "text=\\\\\"10 points": 'NOT-FOUND: no calculation triggered',
    "text=\\\\\"12 points": 'NOT-FOUND: no calculation triggered',
    "text=\\\\\"15 points": 'NOT-FOUND: no calculation triggered',
    "a:has-text(Banks PA": 'NOT-FOUND: wrong reference text',
    "a:has-text(\"Banks PA": 'NOT-FOUND: wrong reference text',
}

for spec in specs:
    result = subprocess.run(
        ["git", "show", f"origin/develop:tests/e2e/calculators/{spec}.spec.js"],
        capture_output=True, text=True, timeout=10
    )
    content = result.stdout
    issues = []
    for pat, desc in patterns.items():
        if pat in content:
            count = content.count(pat)
            issues.append(f"  {desc} ({count}×)")
    
    if issues:
        print(f"\n=== {spec} ===")
        for i in issues:
            print(i)