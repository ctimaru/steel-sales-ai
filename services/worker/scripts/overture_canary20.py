"""NET-IT-FAST1.O — Overture Places read-only, free canary (no Supabase writes).

Consumes only October 2026 Overture Places open GeoParquet from S3. Deliberately
selects a bounded Lombardy area and emits website domains; no persons, contacts,
emails, phones, addresses or place geometry leave this script.  Records remain
UNVERIFIED discovery leads until separate first-party site verification.
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
# Industrial belt across Milano, Monza, Bergamo, Brescia. This is a regional
# convenience sample, NOT a representative estimate of Italy's total supply.
BBOX = (8.85, 10.55, 45.1, 45.95)
MAX_RECORDS = 200
SAMPLE = 20

# Exact industrial categories: never infer steel from a generic company name.
CATEGORIES = (
    "metal_fabricator", "steel_fabricators", "metal_supplier",
    "iron_and_steel_industry", "steel_supplier", "steel_distributor",
    "metal_manufacturer", "sheet_metal_fabricator", "metal_processing",
    "welding_service", "metalworking", "metal_worker",
    "metal_workshop", "metalworking_shop", "metal_fabrication",
    "foundry", "machine_shop", "iron_works", "metal_works",
)
REJECT_HOSTS = (
    "facebook.com", "instagram.com", "linkedin.com", "google.com",
    "wikipedia.org", "youtube.com", "tiktok.com", "x.com",
    "paginegialle.it", "europages.com", "kompass.com",
)


def company_domain(url: str) -> str | None:
    try:
        u = urlsplit(str(url))
        if u.scheme not in ("https", "http") or u.username or u.password or u.port:
            return None
        host = (u.hostname or "").lower().removeprefix("www.")
        if (not re.fullmatch(r"[a-z0-9][a-z0-9.-]*\\.[a-z]{2,24}", host)
                or ".." in host or any(
                    host == b or host.endswith("." + b) for b in REJECT_HOSTS
                )):
            return None
        return host
    except (ValueError, TypeError):
        return None


def main() -> None:
    db = duckdb.connect(config={"threads": 2, "memory_limit": "512MB"})
    db.execute("INSTALL httpfs")
    db.execute("LOAD httpfs")
    db.execute("SET s3_region = 'us-west-2'")
    db.execute("SET http_timeout = 60000")
    # Select only scalar/non-personal attributes. sources is retained for
    # per-row licensing and attribution review before any downstream use.
    query = """
    SELECT id, names.primary AS place_name,
           taxonomy.primary AS category,
           websites[1] AS website,
           addresses[1].country AS country,
           confidence,
           CAST(sources AS JSON)::VARCHAR AS sources_json
    FROM read_parquet(?, hive_partitioning = 1)
    WHERE bbox.xmin BETWEEN ? AND ?
      AND bbox.ymin BETWEEN ? AND ?
      AND addresses[1].country = 'IT'
      AND list_count(websites) > 0
      AND taxonomy.primary IN (
        """ + ",".join(["?"] * len(CATEGORIES)) + """
      )
    LIMIT ?
    """
    args = [SOURCE, BBOX[0], BBOX[1], BBOX[2], BBOX[3], *CATEGORIES, MAX_RECORDS]
    rows = db.execute(query, args).fetchall()
    by_domain: dict[str, dict] = {}
    for rid, name, category, website, country, confidence, source_json in rows:
        domain = company_domain(website)
        if not domain or country != "IT":
            continue
        candidate = {
            "overture_id": rid,
            "overture_release": RELEASE,
            "domain": domain,
            "overture_name": str(name or "")[:120],
            "overture_category": category,
            "confidence": confidence,
            "overture_sources": json.loads(source_json) if source_json else [],
        }
        prev = by_domain.get(domain)
        if prev is None or float(prev.get("confidence") or 0) < float(confidence or 0):
            by_domain[domain] = candidate
    selected = sorted(
        by_domain.values(),
        key=lambda x: (-float(x.get("confidence") or 0), x["domain"])
    )[:SAMPLE]
    report = {
        "contract": "net-it-overture-readonly-canary20-v1",
        "data_origin": "Overture Maps Places: free public S3, not a paid API",
        "release": RELEASE,
        "bbox": list(BBOX),
        "sample_geography": "Lombardy industrial belt; convenience sample",
        "category_filter": list(CATEGORIES),
        "returned_rows": len(rows),
        "distinct_eligible_domains": len(by_domain),
        "selected_count": len(selected),
        "verified_firstparty": 0,
        "network_matches": "not_checked_yet",
        "published": 0,
        "persisted": False,
        "candidates": selected,
    }
    print("OVERTURE_CANARY_RESULT=" + json.dumps(report, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
