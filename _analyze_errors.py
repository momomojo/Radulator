#!/usr/bin/env python3
"""Extract detailed failure info from CI log for key failing specs."""

import re

with open('/tmp/run_27443.log') as f:
    content = f.read()

# Remove ANSI escape codes
clean = re.sub(r'\x1b\[[0-9;]*[a-zA-Z]', '', content)

lines = clean.split('\n')

# Look for test failure messages that tell us which LOCATOR failed
# Pattern: After "Error: expect(locator).toBeVisible() failed",
# we see screenshot paths, then the actual locator description

# We want: the line after "Error:" that describes what wasn't found
focus_specs = [
    'child-pugh',
    'shim',
    'bclc-staging',
    'contrast-dosing',
]

spec_blocks = {}
current_spec = None
for i, line in enumerate(lines):
    cl = line.strip()
    
    # Detect spec from test path
    for fs in focus_specs:
        if fs in cl and '›' in cl and '[' not in cl[:10]:
            current_spec = fs
    
    if current_spec is None:
        continue
    
    # When we see an Error, capture context
    if 'Error:' in cl and 'expect(' in cl:
        block_start = i
        # Read context: before the Error there should be the test name
        test_name = ''
        for j in range(max(0, i-20), i):
            if '›' in lines[j]:
                test_name = lines[j].strip()[:100]
            if 'should' in lines[j].lower() and '›' in lines[j]:
                test_name = lines[j].strip()[:120]
        
        # Read locator info after Error
        locator_info = ''
        for k in range(i, min(len(lines), i+8)):
            ll = lines[k].strip()
            if ll and 'screenshot' not in ll and 'test-results' not in ll:
                if 'Error:' in ll or 'expect(' in ll or 'locator' in ll.lower() or ll.startswith('Received') or ll.startswith('Expected'):
                    locator_info += ll[:150] + ' | '
        
        if current_spec not in spec_blocks:
            spec_blocks[current_spec] = []
        spec_blocks[current_spec].append({
            'test': test_name,
            'error': locator_info[:200],
        })

for spec in focus_specs:
    if spec in spec_blocks:
        print(f'\n=== {spec} ({len(spec_blocks[spec])} errors sampled) ===')
        for err in spec_blocks[spec][:8]:
            print(f'  Test: {err["test"]}')
            print(f'  Error: {err["error"]}')
            print()
