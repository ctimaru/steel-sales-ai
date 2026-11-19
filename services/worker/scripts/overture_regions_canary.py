"""NET-IT-FAST1 national-mix bounded free Overture Places discovery canary.

Read-only: no database writes, Supabase secrets, company identity inferences,
personal contact data, addresses or exact location. Output consists solely of
official-place website DOMAIN pointers and their public Overture provenance.
"""
from __future__ import annotations

import json
import re

import duckdb

from overture_canary20 import SOURCE, RELEASE, company_domain

# Macro-area tiles are not precise regional boundaries. They diversify this
# convenience sample; they do NOT prove Italian legal establishment.
AREAS = {
    "piemonte": (7.45, 9.20, 44.20, 45.90),
    "nord_est": (10.60, 13.75, 45.20, 46.70),
    "emilia_romagna": (9.20, 12.80, 43.85, 45.20),
    "centro": (10.00, 13.60, 41.45, 44.30),
    "sud": (13.40, 18.65, 39.60, 41.80),
    "sicilia": (12.30, 15.75, 36.50, 38.45),
    "sardegna": (8.05, 9.85, 38.80, 41.25),
}
MAX_RAW_PER_AREA = 1600
MAX_DOMAINS_PER_AREA = 250
PREFERRED_KEYWORD_QUOTA = 160
LICENSES = {"CDLA-Permissive-2.0", "Apache-2.0", "CC0-1.0"}
CATEGORIES = (
    "metal_fabricator", "sheet_metal_fabricator",
    "steel_fabricators", "metal_fabrication", "welding_service",
)
# An industrial domain name is a discovery hint, NOT role/identity evidence.
TECHNICAL = re.compile(
    r"(accia|steel|sider|inox|metal|carpent|lamier|ferr|tub|weld|"
    r"sald|lavoraz|fonder|stamp|forg|profil|taglio|meccan|tranci)",
    re.IGNORECASE,
)


def collect_area(db: duckdb.DuckDBPyConnection, area: str, bbox: tuple) -> dict:
    sql = """
    SELECT id, taxonomy.primary AS category, websites[1] AS website,
           addresses[1].country AS country, confidence,
           CAST(sources AS JSON)::VARCHAR AS sources_json
    FROM read_parquet(?, hive_partitioning=1)
    WHERE bbox.xmin BETWEEN ? AND ? AND bbox.ymin BETWEEN ? AND ?
      AND addresses[1].country='IT' AND list_count(websites)>0
      AND taxonomy.primary IN (""" + ",".join("?" for _ in CATEGORIES) + """)
    LIMIT ?
    """
    records = db.execute(
        sql, [SOURCE, *bbox, *CATEGORIES, MAX_RAW_PER_AREA]
    ).fetchall()
    by_domain = {}
    excluded_license = 0
    for gers, category, website, country, confidence, source_json in records:
        domain = company_domain(website)
        if not domain or country != "IT":
            continue
        sources = json.loads(source_json) if source_json else []
        licenses = sorted({
            x.get("license") for x in sources
            if isinstance(x, dict) and isinstance(x.get("license"), str)
        })
        if not licenses or not set(licenses).issubset(LICENSES):
            excluded_license += 1
            continue
        lead = {
            "domain": domain, "gers": str(gers),
            "region_bucket": area, "category": category,
            "confidence": confidence, "licenses": licenses,
        }
        prev = by_domain.get(domain)
        if prev is None or float(confidence or 0) > float(prev["confidence"] or 0):
            by_domain[domain] = lead
    ranked = sorted(
        by_domain.values(),
        key=lambda x: (-float(x["confidence"] or 0), x["domain"]),
    )
    technical = [x for x in ranked if TECHNICAL.search(x["domain"])]
    selection = technical[:PREFERRED_KEYWORD_QUOTA]
    selected_domains = {x["domain"] for x in selection}
    for lead in ranked:
        if lead["domain"] in selected_domains:
            continue
        selection.append(lead)
        selected_domains.add(lead["domain"])
        if len(selection) >= MAX_DOMAINS_PER_AREA:
            break
    return {
        "area": area, "raw_records": len(records),
        "distinct_licensed_domains": len(by_domain),
        "rejected_rights": excluded_license, "selected": selection,
    }


def main() -> None:
    db = duckdb.connect(config={"threads": 2, "memory_limit": "512MB"})
    db.execute("INSTALL httpfs")
    db.execute("LOAD httpfs")
    db.execute("SET s3_region = 'us-west-2'")
    db.execute("SET http_timeout = 60000")
    runs = [collect_area(db, area, bbox) for area, bbox in AREAS.items()]
    unique = {}
    for run in runs:
        for lead in run["selected"]:
            unique.setdefault(lead["domain"], lead)
    result = {
        "contract": "net-it-carp-mass1-seven-area-readonly-v1",
        "release": RELEASE,
        "selection": "carpentry-first discovery; max 250/area; up to 160 technical domain hints/area; category and tile are NOT company evidence",
        "areas": [
            {"name": run["area"], "raw_records": run["raw_records"],
             "licensed_domains": run["distinct_licensed_domains"],
             "rejected_rights": run["rejected_rights"],
             "selected": len(run["selected"])}
            for run in runs
        ],
        "selected_distinct_domains": len(unique),
        "published": 0, "firstparty_verified": 0, "persisted": False,
        "candidates": list(unique.values()),
    }
    print("OVERTURE_REGIONS_RESULT=" + json.dumps(result, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
