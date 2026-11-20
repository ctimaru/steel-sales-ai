"""Read-only Overture taxonomy probe for additional Italian industrial categories.

No company names, domains, contacts, addresses, PII, database writes or publication.
Outputs aggregate category counts only for the pinned Overture release.
"""
from __future__ import annotations

import json
import duckdb

RELEASE = "2026-10-21.0"
SOURCE = (
    "s3://overturemaps-us-west-2/release/"
    + RELEASE + "/theme=places/type=place/*.parquet"
)

EXISTING = (
    "metal_fabricator", "metal_supplier", "sheet_metal_fabricator",
    "steel_fabricators", "steel_supplier", "steel_distributor",
    "iron_and_steel_industry", "metal_manufacturer", "metal_processing",
    "welding_service", "metalworking", "metal_worker", "metal_workshop",
    "metalworking_shop", "metal_fabrication", "iron_works", "metal_works",
)

PATTERN = (
    "machin|cnc|laser|weld|fabric|steel|metal|iron|foundr|forge|"
    "sheet|coil|alumin|stainless|tool|engineering|industrial"
)


def main() -> None:
    db = duckdb.connect(config={"threads": 2, "memory_limit": "768MB"})
    db.execute("INSTALL httpfs")
    db.execute("LOAD httpfs")
    db.execute("SET s3_region='us-west-2'")
    db.execute("SET http_timeout=60000")

    # Aggregate taxonomy only. Italy is bounded spatially as an additional
    # pruning hint; country='IT' remains authoritative for the probe.
    sql = """
      SELECT taxonomy.primary AS category,
             count(*)::BIGINT AS places,
             count(*) FILTER (WHERE list_count(websites)>0)::BIGINT AS with_website
      FROM read_parquet(?, hive_partitioning=1)
      WHERE bbox.xmin BETWEEN 6.0 AND 19.0
        AND bbox.ymin BETWEEN 35.0 AND 48.0
        AND addresses[1].country='IT'
        AND taxonomy.primary IS NOT NULL
        AND regexp_matches(lower(taxonomy.primary), ?)
      GROUP BY taxonomy.primary
      HAVING count(*) FILTER (WHERE list_count(websites)>0) > 0
      ORDER BY with_website DESC, places DESC, category
      LIMIT 150
    """
    rows = db.execute(sql, [SOURCE, PATTERN]).fetchall()
    results = [
        {
            "category": str(category),
            "places": int(places),
            "with_website": int(with_website),
            "already_used": str(category) in EXISTING,
        }
        for category, places, with_website in rows
    ]
    print("TAXONOMY_PROBE_RESULT=" + json.dumps({
        "release": RELEASE,
        "read_only": True,
        "aggregates_only": True,
        "published": 0,
        "pattern": PATTERN,
        "categories": results,
    }, separators=(",", ":")))


if __name__ == "__main__":
    main()
