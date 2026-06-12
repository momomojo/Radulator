#!/usr/bin/env python3
"""Fix strict mode violations in spec files by adding .first() to ambiguous locators."""
import os
import re

WORKSPACE = "/Users/agent/.hermes/kanban/workspaces/t_0ad0a046/Radulator/tests/e2e/calculators"

def fix_file(filepath):
    with open(filepath) as f:
        content = f.read()
    
    original = content
    
    # Pattern 1: getByText('...') or getByText("...") without .first()
    content = re.sub(
        r'(getByText\(["\'][^"\']+["\']\))(?!\s*\.)',
        r'\1.first()',
        content
    )
    
    # Pattern 2: locator('text=...') or locator("text=...") without .first()
    content = re.sub(
        r'(locator\(["\']text=[^"\']+["\']\))(?!\s*\.)',
        r'\1.first()',
        content
    )
    
    # Pattern 3: getByRole('radio', ...) without .first()
    content = re.sub(
        r'(getByRole\(["\']radio["\'][^)]*\))(?!\s*\.)',
        r'\1.first()',
        content
    )
    
    # Pattern 4: getByRole('status', ...) without .first()
    content = re.sub(
        r'(getByRole\(["\']status["\'][^)]*\))(?!\s*\.)',
        r'\1.first()',
        content
    )
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False

# Find all spec files
changed = []
for root, dirs, files in os.walk(WORKSPACE):
    for f in files:
        if f.endswith('.spec.js'):
            filepath = os.path.join(root, f)
            if fix_file(filepath):
                changed.append(filepath)
                print(f"  Fixed: {filepath}")

print(f"\nTotal files changed: {len(changed)}")
