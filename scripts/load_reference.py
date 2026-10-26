"""Load the HS nomenclature and seed the product catalogue into Supabase.

HS data: server/data/hs_codes.csv from github.com/datasets/harmonized-system
(UN Comtrade, ODC-PDDL public domain). Run: python scripts/load_reference.py
"""
import csv
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
for line in (ROOT / ".env").read_text().splitlines():
    if "=" in line:
        k, v = line.split("=", 1)
        os.environ.setdefault(k, v)

from server import db  # noqa: E402

rows = []
with open(ROOT / "server/data/hs_codes.csv", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        if r["level"] in ("2", "4", "6"):
            rows.append({"code": r["hscode"], "description": r["description"], "level": int(r["level"]),
                         "parent": None if r["parent"] == "TOTAL" else r["parent"], "section": r["section"]})

import httpx  # noqa: E402

url = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/"
key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
           "Prefer": "resolution=merge-duplicates,return=minimal"}
with httpx.Client(base_url=url, headers=headers, timeout=60) as c:
    for i in range(0, len(rows), 1000):
        c.post("ts_hs_codes", json=rows[i:i + 1000]).raise_for_status()
    # catalogue seeds: the case template example and the sample workbook's clean products
    seeds = [
        {"sku": "MUG-01", "description": "Ceramic coffee mug, 350 ml", "hs_code": "691200", "country_of_origin": "United Kingdom", "unit_weight_kg": 0.5, "source": "case template"},
        {"sku": "TSH-01", "description": "Cotton t-shirt", "hs_code": "610910", "country_of_origin": "India", "unit_weight_kg": 0.2, "source": "sample sheet"},
        {"sku": "SCF-02", "description": "Wool scarf", "hs_code": "611710", "country_of_origin": "Turkey", "unit_weight_kg": 0.15, "source": "sample sheet"},
        {"sku": "HAM-01", "description": "Steel claw hammer", "hs_code": "820520", "country_of_origin": "Germany", "unit_weight_kg": 1.8, "source": "sample sheet"},
        {"sku": "CBL-02", "description": "USB-C charging cable", "hs_code": "854442", "country_of_origin": "Vietnam", "unit_weight_kg": 0.05, "source": "sample sheet"},
    ]
    c.post("ts_products", json=seeds).raise_for_status()
print(f"loaded {len(rows)} HS rows and {len(seeds)} catalogue seeds")
