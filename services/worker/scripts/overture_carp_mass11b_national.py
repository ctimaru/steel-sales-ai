"""MASS11-B: secondary national welding/sheet-metal discovery on Overture 2026-11.

Reads only official Overture place website pointers and per-record licensing.
No Supabase connection, no corporate identity claim and no publication.
Never overwrite the prior MASS11 audit referenced by provenance records.
"""
from __future__ import annotations

import csv
import json
from pathlib import Path
import duckdb
import overture_carp_mass11_national as core

# Expand to adjacent shop categories. NONE establishes actual carpentry work.
core.CATEGORIES = (
    "sheet_metal_fabricator", "welding_service", "steel_fabricators",
    "metal_workshop", "metalworking_shop", "metal_processing",
    "metal_manufacturer", "machine_shop", "industrial_equipment_manufacturer",
    "metal_supplier",
)
core.MAX_ROWS_PER_TILE = 2300
core.MAX_SELECTED_PER_TILE = 125
core.AREAS = {
    "nord_ovest_b": ((6.60, 9.55, 43.90, 46.75), 180),
    "lombardia_b": ((8.65, 10.95, 44.85, 46.65), 260),
    "nord_est_b": ((10.30, 13.90, 44.75, 46.75), 240),
    "emilia_romagna_b": ((9.10, 12.85, 43.65, 45.35), 135),
    "toscana_umbria_marche_b": ((9.35, 13.85, 42.15, 44.45), 110),
    "lazio_abruzzo_molise_b": ((11.50, 15.25, 40.80, 43.05), 65),
    "campania_puglia_b": ((13.35, 18.65, 39.70, 41.90), 100),
    "basilicata_calabria_b": ((14.45, 17.75, 37.75, 40.80), 0),
    "sicilia_b": ((12.25, 15.85, 36.45, 38.60), 65),
    "sardegna_b": ((8.00, 9.95, 38.70, 41.40), 0),
}

def main() -> None:
    db = duckdb.connect(config={"threads": 2, "memory_limit": "768MB"})
    db.execute("INSTALL httpfs")
    db.execute("LOAD httpfs")
    db.execute("SET s3_region='us-west-2'")
    db.execute("SET http_timeout=60000")
    outcomes = [core.collect(db, label, bbox, offset)
                for label, (bbox, offset) in core.AREAS.items()]
    leads = {}
    for area in outcomes:
        for item in area["selected"]:
            old = leads.get(item["domain"])
            if old is None or item["confidence"] > old["confidence"]:
                leads[item["domain"]] = item
    audit = Path(__file__).resolve().parents[1] / "audits/net_it_carp_mass11b_20261123_gers.csv"
    audit.parent.mkdir(parents=True, exist_ok=True)
    with audit.open("w", encoding="utf-8", newline="") as fp:
        wr = csv.writer(fp)
        wr.writerow(("domain","gers_id","area_bucket","overture_taxonomy","source_license","release"))
        for domain, entry in sorted(leads.items()):
            wr.writerow((domain,entry["gers"],entry["area"],entry["category"],
                        core.LICENSE,core.RELEASE))
    assert sum(1 for _ in audit.open(encoding="utf-8")) == len(leads) + 1
    print("MASS11B_READ_ONLY=" + json.dumps({
        "release":core.RELEASE, "licensed_domains":len(leads),
        "scope":"candidate website pointers only", "db_writes":0, "published":0,
        "requires_dedup_and_firstparty_review":True,
        "audit_path":str(audit.relative_to(Path(__file__).resolve().parents[1])),
        "areas":[{"area":r["tile"],"scanned":r["scanned"],
                  "licensed":r["licensed"],"selected":len(r["selected"]),
                  "rights_excluded":r["rights_excluded"]} for r in outcomes],
    }, ensure_ascii=False, separators=(",", ":")))

if __name__ == "__main__":
    main()
