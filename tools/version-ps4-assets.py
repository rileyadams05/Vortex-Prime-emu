"""Stamp PS4 script references with their content hash before publishing Pages."""
from pathlib import Path
import hashlib
import re

ROOT = Path(__file__).resolve().parents[1]
for page in (ROOT / 'docs/ps4').glob('*/index.html'):
    def version(match):
        asset = (page.parent / match.group(1)).resolve()
        digest = hashlib.sha256(asset.read_bytes()).hexdigest()[:16]
        return f'src="{match.group(1)}?v={digest}"'

    html = page.read_bytes().decode('utf-8')
    html = re.sub(r'src="(../../assets/js/ps4-[^"?]+\.js)(?:\?[^" ]*)?"', version, html)
    page.write_bytes(html.encode('utf-8'))
