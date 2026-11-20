"""NET-IT-CARP-MASS3: bounded Overture scan for under-covered Italian industrial areas.
Run isolated/read-only. Overture website pointers are discovery leads only.
No company names, contacts, addresses, PII, Supabase writes, or publication.
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

import duckdb
import overture4_national_next as source

LICENSE = "CDLA-Permissive-2.0"
RELEASE = "2026-10-21.0"
assert source.RELEASE == RELEASE

# Deliberately complement CARP-MASS2/MASS2B. Some boundary overlap is acceptable:
# production dedup remains authoritative before any SEED1 staging.
AREAS = {
    "lombardia_milano_monza_varese_como": (8.25, 9.65, 45.20, 46.25),
    "friuli_venezia_giulia": (12.25, 13.95, 45.50, 46.75),
    "trentino_alto_adige": (10.35, 12.65, 45.65, 47.20),
    "liguria": (7.40, 10.20, 43.65, 44.80),
    "umbria": (11.80, 13.35, 42.30, 43.70),
    "marche": (12.05, 13.85, 42.65, 44.05),
    "abruzzo": (13.00, 14.85, 41.60, 43.00),
    "molise": (13.90, 15.25, 41.30, 42.15),
    "basilicata": (15.25, 16.95, 39.75, 41.25),
    "calabria": (15.50, 17.35, 37.80, 40.25),
    "sardegna": (8.00, 9.95, 38.75, 41.45),
    "campania_salerno_caserta": (13.55, 15.85, 39.85, 41.45),
    "puglia_foggia_taranto_lecce": (15.00, 18.60, 39.65, 42.05),
    "sicilia_messina_siracusa_ragusa": (14.05, 15.80, 36.60, 38.40),
    "valle_aosta": (6.75, 8.05, 45.40, 46.15),
}

OFFSETS = {
    "lombardia_milano_monza_varese_como": 220,
    "friuli_venezia_giulia": 40,
    "trentino_alto_adige": 25,
    "liguria": 60,
    "umbria": 20,
    "marche": 100,
    "abruzzo": 40,
    "molise": 0,
    "basilicata": 0,
    "calabria": 20,
    "sardegna": 20,
    "campania_salerno_caserta": 150,
    "puglia_foggia_taranto_lecce": 180,
    "sicilia_messina_siracusa_ragusa": 130,
    "valle_aosta": 0,
}

CATEGORIES = (
    "metal_fabricator",
    "sheet_metal_fabricator",
    "steel_fabricators",
    "metal_fabrication",
    "welding_service",
    "iron_works",
    "metalworking_shop",
    "metal_workshop",
)


def main() -> None:
    source.AREAS = AREAS
    source.RAW_OFFSET = OFFSETS
    source.CATEGORY = CATEGORIES
    source.RAW_LIMIT = 1000
    source.PER_AREA = 180
    source.LICENSES = frozenset({LICENSE})
    source.REJECT_HOSTS = source.REJECT_HOSTS | frozenset(
        {
            "weebly.com",
            "jimdo.com",
            "wixsite.com",
            "blogspot.com",
            "wordpress.com",
            "sites.google.com",
        }
    )

    db = duckdb.connect(config={"threads": 2, "memory_limit": "512MB"})
    db.execute("INSTALL httpfs")
    db.execute("LOAD httpfs")
    db.execute("SET s3_region='us-west-2'")
    db.execute("SET http_timeout=60000")

    results = [source.collect(db, key, bbox) for key, bbox in AREAS.items()]
    domains = {}
    for group in results:
        for item in group["selected"]:
            if item["licenses"] == [LICENSE]:
                domains.setdefault(item["domain"], item)

    audit = (
        Path(__file__).resolve().parents[1]
        / "audits"
        / "net_it_carp_mass3_20261120_gers.csv"
    )
    audit.parent.mkdir(parents=True, exist_ok=True)
    with audit.open("w", encoding="utf-8", newline="") as fp:
        writer = csv.writer(fp)
        writer.writerow(
            (
                "domain",
                "gers_id",
                "search_bucket",
                "overture_taxonomy",
                "source_license",
                "release",
            )
        )
        for domain in sorted(domains):
            item = domains[domain]
            assert source.company_domain("https://" + domain + "/") == domain
            writer.writerow(
                (
                    domain,
                    item["gers"],
                    item["region_bucket"],
                    item["category"],
                    LICENSE,
                    RELEASE,
                )
            )

    assert sum(1 for _ in audit.open(encoding="utf-8")) == len(domains) + 1
    print(
        "CARP_MASS3_RESULT="
        + json.dumps(
            {
                "release": RELEASE,
                "license": LICENSE,
                "read_only": True,
                "verified_companies": 0,
                "published": 0,
                "selected_distinct_domains": len(domains),
                "areas": [
                    {
                        "bucket": group["area"],
                        "raw": group["raw_records"],
                        "licensed_distinct": group["distinct_licensed"],
                        "selected": len(group["selected"]),
                    }
                    for group in results
                ],
                "audit_path": str(
                    audit.relative_to(Path(__file__).resolve().parents[1])
                ),
            },
            separators=(",", ":"),
        )
    )


if __name__ == "__main__":
    main()
