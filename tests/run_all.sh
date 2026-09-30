#!/usr/bin/env bash
# Runs every test against single/copyset-erp.html (and dist/ for Hailer). Requires: pip install playwright && playwright install chromium
set -e
cd "$(dirname "$0")/.."
node build.mjs
for t in test_flow test_quickcalc test_pricetables test_vat test_margin test_mobile; do echo "== $t"; python3 tests/$t.py; done
echo "== test_sections (10 kierrosta)"; python3 tests/test_sections.py 3 10 | tail -3
echo "== test_fuzz (50 läpikäyntiä)"; python3 tests/test_fuzz.py 7 50 | tail -3
echo "== test_hailer"; python3 tests/test_hailer.py
