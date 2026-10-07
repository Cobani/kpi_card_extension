#!/usr/bin/env python3
"""
Local server for the KPI Card Tableau extension.

Serves the extension on http://localhost:8766 (the URL in kpiCard.trex) and
exposes Tableau's shape palettes to the Format dialog:

    GET /shapes/index.json               list of palettes and their files
    GET /shapes/file/<palette>/<file>    one shape image

Shape folders searched (first match wins for duplicate palette names):
    * every folder in the KPI_SHAPES_DIRS environment variable (os.pathsep separated)
    * <Documents>/My Tableau Repository/Shapes      (your custom palettes)
    * Tableau Desktop's built-in "Shapes" folders   (Default, Filled, Arrows, KPI, ...)

Standard library only — no pip installs needed.
"""
import glob
import http.server
import json
import mimetypes
import os
import socketserver
import sys
import urllib.parse

PORT = int(os.environ.get("KPI_PORT", "8766"))
ROOT = os.path.dirname(os.path.abspath(__file__))
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".bmp", ".webp", ".ico"}

mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("font/ttf", ".ttf")
mimetypes.add_type("font/woff2", ".woff2")


def candidate_roots():
    roots = []
    for p in os.environ.get("KPI_SHAPES_DIRS", "").split(os.pathsep):
        if p.strip():
            roots.append(os.path.expanduser(p.strip()))

    home = os.path.expanduser("~")
    docs = [os.path.join(home, "Documents")]
    docs += glob.glob(os.path.join(home, "OneDrive*", "Documents"))
    for d in docs:
        for repo in sorted(glob.glob(os.path.join(d, "My Tableau Repository*"))):
            roots.append(os.path.join(repo, "Shapes"))

    # Built-in palettes live inside the Tableau Desktop install.
    installs = []
    if sys.platform == "darwin":
        installs += sorted(glob.glob("/Applications/Tableau Desktop*.app"), reverse=True)
    elif os.name == "nt":
        for pf in {os.environ.get("ProgramFiles", r"C:\Program Files"),
                   os.environ.get("ProgramW6432", r"C:\Program Files")}:
            installs += sorted(glob.glob(os.path.join(pf, "Tableau", "Tableau *")), reverse=True)
    for inst in installs[:1]:  # newest version only
        for dirpath, dirnames, _ in os.walk(inst):
            depth = dirpath[len(inst):].count(os.sep)
            if depth > 6:
                dirnames[:] = []
                continue
            for dn in list(dirnames):
                if dn.lower() == "shapes":
                    roots.append(os.path.join(dirpath, dn))
    return roots


def scan():
    roots = candidate_roots()
    palettes, seen = [], set()
    for root in roots:
        if not os.path.isdir(root):
            continue
        entries = sorted(os.listdir(root), key=str.lower)
        # A Shapes folder holds one sub-folder per palette.
        for name in entries:
            folder = os.path.join(root, name)
            if not os.path.isdir(folder) or name.lower() in seen:
                continue
            files = sorted(
                (f for f in os.listdir(folder)
                 if os.path.splitext(f)[1].lower() in IMAGE_EXT and not f.startswith(".")),
                key=str.lower,
            )
            if not files:
                continue
            seen.add(name.lower())
            palettes.append({
                "name": name,
                "dir": folder,
                "files": [{
                    "name": os.path.splitext(f)[0],
                    "url": "shapes/file/" + urllib.parse.quote(name) + "/" + urllib.parse.quote(f),
                } for f in files],
            })
    return roots, palettes


_cache = {}


def palettes():
    if "p" not in _cache:
        _cache["roots"], _cache["p"] = scan()
    return _cache["roots"], _cache["p"]


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path.endswith("/shapes/index.json") or path == "/shapes/index.json":
            _cache.clear()  # rescan so newly added palettes show up
            roots, pals = palettes()
            body = json.dumps({
                "searched": roots,
                "palettes": [{"name": p["name"], "files": p["files"]} for p in pals],
            }).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if "/shapes/file/" in path:
            rest = path.split("/shapes/file/", 1)[1]
            parts = [urllib.parse.unquote(x) for x in rest.split("/")]
            if len(parts) == 2:
                _, pals = palettes()
                pal = next((p for p in pals if p["name"] == parts[0]), None)
                if pal:
                    fname = os.path.basename(parts[1])
                    full = os.path.join(pal["dir"], fname)
                    if os.path.isfile(full):
                        with open(full, "rb") as fh:
                            data = fh.read()
                        self.send_response(200)
                        self.send_header("Content-Type", mimetypes.guess_type(full)[0] or "application/octet-stream")
                        self.send_header("Content-Length", str(len(data)))
                        self.end_headers()
                        self.wfile.write(data)
                        return
            self.send_error(404, "Shape not found")
            return

        super().do_GET()

    def log_message(self, fmt, *args):
        if os.environ.get("KPI_VERBOSE"):
            super().log_message(fmt, *args)


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    roots, pals = palettes()
    print("KPI Card served at http://localhost:%d/index.html" % PORT)
    print("Shape palettes found: %d" % len(pals))
    for p in pals:
        print("  - %s (%d)" % (p["name"], len(p["files"])))
    with Server(("127.0.0.1", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
