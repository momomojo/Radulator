import json, sys

data = json.load(sys.stdin)
for a in data.get('artifacts', []):
    print(f'{a["name"]}: {a["size_in_bytes"]} bytes')
    print(f'  URL: {a["archive_download_url"]}')
