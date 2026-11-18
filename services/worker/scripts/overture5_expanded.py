"""NET-IT-OVERTURE5 — expanded Italian industrial website discovery.

Runs as an isolated, read-only GitHub Action against the public, permissively
licensed Overture Places October 2026 release; nothing publishes or calls a
database. All website leads are UNVERIFIED pointers (not legal entities).

Existing tested Overture4 readers enforce valid website hosts, the Italian
place-country filter, and industrial taxonomy. Overture5 adds new spatial
buckets, different raw offsets, single-license CDLA-only and hosted-site
exclusions. Results still REQUIRE Supabase cross-index dedup, source audit,
SEED1 crawler, AUTO2 legal identity and AUTO3 release.
"""
from __future__ import annotations

import json
import duckdb
import overture4_national_next as upstream

ROUND = "net-it-overture5-national-expansion-2026-11-18"
RELEASE = "2026-10-21.0"
assert upstream.RELEASE == RELEASE

# These are approximate regional buckets, NOT administrative boundaries.
AREAS = {
    "piemonte_liguria": (7.10, 9.30, 43.85, 46.00),
    "nord_est": (10.45, 13.85, 44.85, 46.70),
    "lombardia": (8.75, 10.75, 45.00, 46.10),
    "toscana_umbria": (9.60, 12.75, 42.40, 44.55),
    "lazio_abruzzo": (11.70, 14.60, 40.65, 43.25),
    "campania_puglia": (13.45, 18.65, 39.75, 41.80),
    "sardegna": (8.00, 9.85, 38.75, 41.30),
    "calabria_basilicata": (14.45, 17.40, 37.75, 40.75),
}
# Different windows from Overture1-4; OFFSET is not a uniqueness guarantee.
# The five-index production dedup performed after this scan is authoritative.
RAW_OFFSET = {
    "piemonte_liguria": 750,
    "nord_est": 1200,
    "lombardia": 1350,
    "toscana_umbria": 450,
    "lazio_abruzzo": 500,
    "campania_puglia": 800,
    "sardegna": 180,
    "calabria_basilicata": 120,
}
RAW_LIMIT = 1200
PER_AREA = 150
LICENSE = "CDLA-Permissive-2.0"
HOSTED = frozenset({
    "weebly.com", "jimdo.com", "wixsite.com",
    "blogspot.com", "wordpress.com", "sites.google.com",
})

def main() -> None:
    upstream.AREAS = AREAS
    upstream.RAW_OFFSET = RAW_OFFSET
    upstream.RAW_LIMIT = RAW_LIMIT
    upstream.PER_AREA = PER_AREA
    upstream.LICENSES = frozenset({LICENSE})
    upstream.REJECT_HOSTS = upstream.REJECT_HOSTS | HOSTED

    db = duckdb.connect(config={"threads": 2, "memory_limit": "512MB"})
    db.execute("INSTALL httpfs")
    db.execute("LOAD httpfs")
    db.execute("SET s3_region='us-west-2'")
    db.execute("SET http_timeout=60000")
    datasets = [upstream.collect(db, name, area)
                for name, area in AREAS.items()]
    selected = {}
    for entry in datasets:
        for lead in entry["selected"]:
            if lead["licenses"] == [LICENSE]:
                selected.setdefault(lead["domain"], lead)
    results = {
        "contract": "net-it-overture5-readonly-v1",
        "round": ROUND,
        "release": RELEASE,
        "source": upstream.SOURCE,
        "read_only": True,
        "production_writes": False,
        "verified_companies": 0,
        "published": 0,
        "allowed_license": LICENSE,
        "sampling": "new spatial buckets, offset convenience sample, not administrative region counts",
        "regions": [
            {
                "bucket": v["area"], "raw": v["raw_records"],
                "licensed_distinct": v["distinct_licensed"],
                "excluded_rights": v["excluded_rights"],
                "selected": len(v["selected"]),
            } for v in datasets
        ],
        "distinct_selected": len(selected),
        "candidates": list(selected.values()),
    }
    print("OVERTURE5_RESULT=" + json.dumps(
        results, separators=(",", ":"), ensure_ascii=False))

if __name__ == "__main__":
    main()
