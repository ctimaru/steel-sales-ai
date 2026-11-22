"""NET-IT-OVERTURE4 — bounded national next-source free Overture Places

Seven macro-area tiles; a bounded larger next-source candidate pool for the
active steel network, with cross-table production dedup before any ingestion. These tiles are NOT administrative
region boundaries. Overture taxonomy and domain names are discovery hints,
NEVER proofs of an Italian legal entity, products or industrial capability.

No contacts, PII, place names, addresses or geometry are printed. No secrets,
API purchases, DB writes or publication. Each record has GERS and source license.
"""
from __future__ import annotations

import json
import re
from urllib.parse import urlsplit

import duckdb

RELEASE = "2026-10-21.0"
SOURCE = (
    "s3://overturemaps-us-west-2/release/"
    + RELEASE + "/theme=places/type=place/*.parquet"
)
# Names are buckets for spatial diversification, not claims of exact regions.
AREAS = {
    "piemonte": (7.45, 9.20, 44.20, 45.90),
    "nord_est": (10.60, 13.75, 45.20, 46.70),
    "lombardia": (8.85, 10.55, 45.10, 45.95),
    "emilia_romagna": (9.20, 12.80, 43.85, 45.20),
    "centro": (10.00, 13.60, 41.45, 44.30),
    "sud": (13.40, 18.65, 39.60, 41.80),
    "sicilia": (12.30, 15.75, 36.50, 38.45),
}

CATEGORY = (
    "metal_fabricator", "metal_supplier", "sheet_metal_fabricator",
    "steel_fabricators", "steel_supplier", "steel_distributor",
    "iron_and_steel_industry", "metal_manufacturer", "metal_processing",
    "welding_service", "metalworking", "metal_worker", "metal_workshop",
    "metalworking_shop", "metal_fabrication", "iron_works", "metal_works",
)
# Avoid repeating the first LIMIT 250 regional dataset. Since the original
# canary had no ORDER BY, a production cross-DB dedupe remains mandatory.
# OFFSET is only a sampling convenience: no ORDER BY guarantee between
# reads; the Supabase five-table dedup is authoritative for new domains.
RAW_OFFSET = {
    "piemonte": 250, "nord_est": 650, "lombardia": 850,
    "emilia_romagna": 250, "centro": 250, "sud": 250,
    "sicilia": 300,
}
RAW_LIMIT = 900
PER_AREA = 180

TECHNICAL = re.compile(
    r"(accia|steel|sider|inox|metal|carpent|lamier|ferr|tub|weld|"
    r"sald|lavoraz|fonder|stamp|forg|profil|taglio|meccan|tranci)",
    re.I,
)
REJECT_HOSTS = frozenset((
    "facebook.com", "instagram.com", "linkedin.com", "google.com",
    "wikipedia.org", "youtube.com", "tiktok.com", "x.com",
    "paginegialle.it", "europages.com", "kompass.com",
))
LICENSES = frozenset(("CDLA-Permissive-2.0", "CC0-1.0", "Apache-2.0"))


def company_domain(value: str) -> str | None:
    try:
        u = urlsplit(str(value))
        if u.scheme not in ("https", "http") or u.username or u.password or u.port:
            return None
        host = (u.hostname or "").lower().removeprefix("www.")
        if (not re.fullmatch(r"[a-z0-9][a-z0-9.-]*\.[a-z]{2,24}", host)
                or ".." in host or any(host == h or host.endswith("." + h)
                  for h in REJECT_HOSTS)):
            return None
        return host
    except (ValueError, TypeError):
        return None


def collect(db: duckdb.DuckDBPyConnection, area: str, bbox: tuple) -> dict:
    sql = """
    SELECT id, taxonomy.primary AS category, websites[1] AS website,
           addresses[1].country AS country, confidence,
           CAST(sources AS JSON)::VARCHAR AS license_sources
    FROM read_parquet(?, hive_partitioning=1)
    WHERE bbox.xmin BETWEEN ? AND ? AND bbox.ymin BETWEEN ? AND ?
      AND addresses[1].country='IT' AND list_count(websites)>0
      AND taxonomy.primary IN (""" + ",".join("?" for _ in CATEGORY) + """)
    LIMIT ? OFFSET ?
    """
    rows = db.execute(
        sql, [SOURCE, *bbox, *CATEGORY, RAW_LIMIT, RAW_OFFSET[area]]
    ).fetchall()
    distinct = {}
    bad_license = 0
    for gers, cat, website, country, confidence, sources_json in rows:
        domain = company_domain(website)
        if not domain or country != "IT":
            continue
        sources = json.loads(sources_json) if sources_json else []
        rights = sorted({s["license"] for s in sources
                         if isinstance(s, dict) and isinstance(s.get("license"), str)})
        if not rights or not set(rights).issubset(LICENSES):
            bad_license += 1
            continue
        info = {
            "domain": domain, "gers": str(gers), "region_bucket": area,
            "category": cat, "licenses": rights, "confidence": confidence,
        }
        old = distinct.get(domain)
        if old is None or float(old["confidence"] or 0) < float(confidence or 0):
            distinct[domain] = info
    ranked = sorted(distinct.values(),
                    key=lambda x: (-float(x["confidence"] or 0), x["domain"]))
    # Favor actual steel-sector hints for stronger conversion; still keep
    # non-keyword records for discovery diversity. No pre-approval implied.
    technical = [x for x in ranked if TECHNICAL.search(x["domain"])]
    selection = technical[:100]
    seen = {x["domain"] for x in selection}
    for item in ranked:
        if len(selection) >= PER_AREA:
            break
        if item["domain"] not in seen:
            seen.add(item["domain"])
            selection.append(item)
    return {
        "area": area, "raw_records": len(rows),
        "distinct_licensed": len(distinct), "excluded_rights": bad_license,
        "selected": selection,
    }


def main() -> None:
    db = duckdb.connect(config={"threads": 2, "memory_limit": "512MB"})
    db.execute("INSTALL httpfs")
    db.execute("LOAD httpfs")
    db.execute("SET s3_region='us-west-2'")
    db.execute("SET http_timeout=60000")
    fetched = [collect(db, k, v) for k, v in AREAS.items()]
    leads = {}
    for area in fetched:
        for item in area["selected"]:
            leads.setdefault(item["domain"], item)
    result = {
        "contract": "net-it-overture4-seven-area-readonly-v1",
        "release": RELEASE, "read_only": True, "db_modified": False,
        "company_identity_verified": False, "published": 0,
        "selection": "yield-focused convenience tiles, offset+dedup, no claims of representative samples",
        "regions": [{
            "bucket": a["area"], "raw": a["raw_records"],
            "licensed_domains": a["distinct_licensed"],
            "excluded_rights": a["excluded_rights"],
            "selected": len(a["selected"]),
        } for a in fetched],
        "distinct_selected": len(leads),
        "candidates": list(leads.values()),
    }
    print("OVERTURE3_RESULT=" +
          json.dumps(result, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
