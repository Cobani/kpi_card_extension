#!/usr/bin/env bash
# Serves KPI Card on http://localhost:8766 — the URL declared in kpiCard.trex —
# and lists Tableau shape palettes for the Format dialog's icon picker.
set -euo pipefail
cd "$(dirname "$0")"
exec python3 serve.py
