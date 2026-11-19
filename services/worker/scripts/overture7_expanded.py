"""NET-IT-OVERTURE7 — expanded Italian industrial website discovery.

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
import csv
from pathlib import Path

import duckdb
import overture4_national_next as upstream

ROUND = "net-it-overture7-national-expansion-2026-11-19"
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
    "piemonte_liguria": 950,
    "nord_est": 1350,
    "lombardia": 1500,
    "toscana_umbria": 750,
    "lazio_abruzzo": 750,
    "campania_puglia": 150,
    "sardegna": 0,
    "calabria_basilicata": 0,
}
RAW_LIMIT = 1500
PER_AREA = 180
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
        "contract": "net-it-overture7-readonly-v1",
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
    # Durable, auditable website-pointer input for controlled Supabase
    # ingestion. No names, locations, addresses, PII or contacts.
    audit_path = (Path(__file__).resolve().parents[1] /
                  "audits/net_it_overture7_20261119_gers.csv")
    audit_path.parent.mkdir(parents=True, exist_ok=True)
    with audit_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(("domain", "gers_id", "area_bucket",
                         "overture_taxonomy", "source_licenses", "release"))
        for domain in sorted(selected):
            lead = selected[domain]
            assert lead["licenses"] == [LICENSE]
            assert upstream.company_domain("https://" + domain + "/") == domain
            writer.writerow((domain, lead["gers"], lead["region_bucket"],
                             lead["category"], LICENSE, RELEASE))
    assert sum(1 for _ in audit_path.open(encoding="utf-8")) == len(selected) + 1
    print("OVERTURE7_RESULT=" + json.dumps(
        results, separators=(",", ":"), ensure_ascii=False))
    print("OVERTURE7_AUDIT=" + json.dumps({
        "path": str(audit_path.relative_to(Path(__file__).resolve().parents[1])),
        "rows": len(selected), "rights": LICENSE}, separators=(",", ":")))

if __name__ == "__main__":
    main()
