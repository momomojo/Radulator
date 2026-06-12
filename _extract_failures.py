import re
from collections import defaultdict

with open('/tmp/run_27443.log') as f:
    content = f.read()

# Remove ANSI escape codes
clean = re.sub(r'\x1b\[[0-9;]*[a-zA-Z]', '', content)

lines = clean.split('\n')

# Find all failed test entries in the summary at the end
failed = []
capture = False
for line in lines:
    clean_line = line.strip()
    if '279 failed' in clean_line:
        capture = True
        continue
    if capture and '1153 passed' in clean_line:
        break
    if capture and clean_line and '›' in clean_line:
        # Clean the line
        entry = clean_line.strip()
        entry = re.sub(r'\[\d+m', '', entry)
        entry = re.sub(r'\[\dm', '', entry)
        entry = entry.strip()
        if entry:
            failed.append(entry)

# Group by spec file
by_file = defaultdict(list)
for fentry in failed:
    m = re.search(r'tests/e2e/[^:]+', fentry)
    spec = m.group(0) if m else 'unknown'
    by_file[spec].append(fentry)

print(f'Total failed: {len(failed)}')
print()

for spec in sorted(by_file.keys()):
    entries = by_file[spec]
    test_names = []
    for e in entries:
        # Extract the part after the third › for the test name
        parts = e.split('›')
        if len(parts) >= 3:
            tn = '›'.join(parts[2:]).strip()
        else:
            tn = e[:80]
        test_names.append(tn)
    print(f'{len(entries)} failures in {spec}')
    for tn in test_names[:2]:
        print(f'  › {tn[:100]}')
    if len(test_names) > 2:
        print(f'  ... and {len(test_names)-2} more')
    print()