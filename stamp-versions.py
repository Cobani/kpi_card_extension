#!/usr/bin/env python3
"""Cache-busting for GitHub Pages.

Adds ?v=<content hash> to every local .js/.css reference in the HTML pages, so
a browser or CDN can never mix an old file with a new page after a deploy.
The hash only changes when that file's content changes.

Run before every commit/push:   python3 stamp-versions.py
Running it twice is safe; it only updates hashes that are out of date.
"""
import hashlib
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
PAGES = sorted(ROOT.glob('*.html'))
REF = re.compile(r'((?:src|href)=")(\./[^"?#]+\.(?:js|css))(?:\?v=[0-9a-f]*)?(")')


def file_hash(rel):
    path = (ROOT / rel).resolve()
    if not path.is_file():
        return None
    return hashlib.sha1(path.read_bytes()).hexdigest()[:10]


def main():
    changed = []
    missing = set()
    for page in PAGES:
        text = page.read_text(encoding='utf-8')

        def stamp(m):
            h = file_hash(m.group(2))
            if h is None:
                missing.add(m.group(2))
                return m.group(0)
            return '%s%s?v=%s%s' % (m.group(1), m.group(2), h, m.group(3))

        new = REF.sub(stamp, text)
        if new != text:
            page.write_text(new, encoding='utf-8')
            changed.append(page.name)
    for rel in sorted(missing):
        print('warning: %s not found, left unstamped' % rel, file=sys.stderr)
    print('updated: ' + ', '.join(changed) if changed else 'all versions up to date')


if __name__ == '__main__':
    main()
