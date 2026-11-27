"""MASS11-C: new *spatial discovery tiles*, not a corporate-location census.

Official, free Overture Places pointers only. Preserve original MASS11 A/B audit
files. Area labels indicate search bounding boxes, never verified company sites
or official ATECO codes. Original rights/host filters inherited from core.
No Supabase writes; all leads require full production dedup before staging.
"""
from __future__ import annotations

import csv
import json
from pathlib import Path
import duckdb
import overture_carp_mass11_national as core

core.CATEGORIES = (
    "metal_fabricator", "sheet_metal_fabricator", "steel_fabricators",
    "metal_fabrication", "metal_works", "iron_works",
    "metalworking", "metal_workshop", "metalworking_shop",
    "welding_service", "metal_processing", "metal_manufacturer",
    "machine_shop", "industrial_equipment_manufacturer", "metal_supplier",
)
# Smaller boxes uncover websites missed by large nationwide limited selections.
# Some overlap is deliberate and must be deduplicated by website + GERS.
core.MAX_ROWS_PER_TILE = 2100
core.MAX_SELECTED_PER_TILE = 175
core.AREAS = {
    "piemonte_al_tile": ((8.18, 9.18, 44.46, 45.24), 0),
    "piemonte_at_tile": ((7.70, 8.59, 44.58, 45.24), 0),
    "piemonte_bi_tile": ((7.70, 8.37, 45.34, 45.81), 0),
    "piemonte_cn_tile": ((6.75, 8.28, 43.98, 44.93), 0),
    "piemonte_no_tile": ((8.25, 9.03, 45.22, 45.88), 0),
    "piemonte_to_tile": ((6.65, 8.17, 44.68, 45.49), 280),
    "piemonte_vb_tile": ((7.93, 8.91, 45.63, 46.33), 0),
    "piemonte_vc_tile": ((7.73, 8.68, 45.13, 46.00), 0),
    "lombardia_bg_tile": ((9.30, 10.20, 45.49, 46.13), 310),
    "lombardia_bs_tile": ((9.80, 10.70, 45.32, 46.14), 260),
    "lombardia_co_lc_tile": ((8.71, 9.60, 45.70, 46.24), 0),
    "lombardia_mi_mb_tile": ((8.85, 9.56, 45.32, 45.85), 590),
    "lombardia_pv_tile": ((8.54, 9.51, 44.63, 45.37), 0),
    "lombardia_va_tile": ((8.50, 9.32, 45.54, 46.04), 0),
    "veneto_pd_ve_tile": ((11.50, 12.50, 45.22, 45.78), 300),
    "veneto_tv_tile": ((11.73, 12.76, 45.48, 46.04), 0),
    "veneto_vi_tile": ((10.89, 11.82, 45.37, 46.12), 200),
    "veneto_vr_tile": ((10.62, 11.42, 45.25, 45.72), 180),
    "emilia_bo_tile": ((11.01, 11.75, 44.25, 44.84), 220),
    "emilia_mo_re_tile": ((10.31, 11.24, 44.40, 45.02), 0),
    "emilia_pr_pc_tile": ((9.31, 10.65, 44.46, 45.18), 0),
    "emilia_ra_fc_tile": ((11.68, 12.53, 43.80, 44.68), 0),
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
        for entry in area["selected"]:
            previous = leads.get(entry["domain"])
            if previous is None or entry["confidence"] > previous["confidence"]:
                leads[entry["domain"]] = entry
    out = Path(__file__).resolve().parents[1] / "audits/net_it_carp_mass11c_20261123_gers.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(("domain", "gers_id", "area_bucket", "overture_taxonomy",
                         "source_license", "release"))
        for domain, entry in sorted(leads.items()):
            writer.writerow((domain, entry["gers"], entry["area"], entry["category"],
                             core.LICENSE, core.RELEASE))
    assert sum(1 for _ in out.open(encoding="utf-8")) == len(leads) + 1
    print("MASS11C_DISCOVERY=" + json.dumps({
        "release":core.RELEASE, "licensed_website_pointers":len(leads),
        "spatial_tiles":len(core.AREAS), "supabase_writes":0,
        "published":0, "corporate_ateco_verified":0,
        "requires_live_cross_table_dedup":True,
        "audit_path":str(out.relative_to(Path(__file__).resolve().parents[1])),
        "areas":[{"tile":x["tile"], "scanned":x["scanned"],
                  "licensed":x["licensed"], "selected":len(x["selected"]),
                  "rights_excluded":x["rights_excluded"]} for x in outcomes],
    }, ensure_ascii=False, separators=(",", ":")))

if __name__ == "__main__":
    main()
