"""NET-IT-MASS11: read-only Overture discovery for welding and fabrication.

Overture taxonomy and websites are discovery hints only. Every domain must be
deduplicated against production and pass first-party SEED1, AUTO2 and AUTO3
before a Network company can be published.
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

AREAS = {
    "piemonte_liguria": (7.10, 9.30, 43.85, 46.00),
    "lombardia": (8.50, 10.90, 44.90, 46.30),
    "nord_est": (10.40, 13.90, 44.80, 46.80),
    "emilia_romagna": (9.00, 12.90, 43.80, 45.30),
    "toscana_umbria_marche": (9.50, 13.90, 42.20, 44.60),
    "lazio_abruzzo_molise": (11.60, 15.20, 40.90, 43.30),
    "campania_puglia_basilicata": (13.30, 18.70, 39.50, 41.90),
    "calabria_sicilia": (12.20, 17.60, 36.40, 40.30),
    "sardegna": (7.80, 10.10, 38.60, 41.60),
}
# A deeper layer than MASS10. Production dedup remains authoritative because
# Overture reads without a stable total ordering.
OFFSETS = {
    "piemonte_liguria": 900,
    "lombardia": 1200,
    "nord_est": 1050,
    "emilia_romagna": 900,
    "toscana_umbria_marche": 750,
    "lazio_abruzzo_molise": 600,
    "campania_puglia_basilicata": 450,
    "calabria_sicilia": 250,
    "sardegna": 80,
}
CATEGORIES = (
    "welding_service",
    "metal_fabricator",
    "sheet_metal_fabricator",
    "steel_fabricators",
    "metal_fabrication",
    "iron_works",
    "metal_works",
    "metalworking",
    "metal_worker",
    "metal_workshop",
    "metalworking_shop",
    "steel_erector",
)


def main() -> None:
    source.AREAS = AREAS
    source.RAW_OFFSET = OFFSETS
    source.CATEGORY = CATEGORIES
    source.RAW_LIMIT = 1800
    source.PER_AREA = 250
    source.LICENSES = frozenset({LICENSE})
    source.REJECT_HOSTS = source.REJECT_HOSTS | frozenset({
        "weebly.com", "jimdo.com", "jimdosite.com", "wixsite.com",
        "blogspot.com", "wordpress.com", "sites.google.com", "site123.me",
        "business.site", "facebook.com", "instagram.com", "linkedin.com",
        "youtube.com", "wa.me", "godaddysites.com", "infoisinfo.it",
        "reteimprese.it", "autoline.info", "simdif.com",
    })

    db = duckdb.connect(config={"threads": 2, "memory_limit": "768MB"})
    db.execute("INSTALL httpfs")
    db.execute("LOAD httpfs")
    db.execute("SET s3_region='us-west-2'")
    db.execute("SET http_timeout=60000")

    groups = [source.collect(db, key, bbox) for key, bbox in AREAS.items()]
    domains = {}
    for group in groups:
        for item in group["selected"]:
            if item["licenses"] == [LICENSE]:
                domains.setdefault(item["domain"], item)

    audit = (
        Path(__file__).resolve().parents[1]
        / "audits/net_it_mass11_20261123_gers.csv"
    )
    audit.parent.mkdir(parents=True, exist_ok=True)
    with audit.open("w", encoding="utf-8", newline="") as fp:
        writer = csv.writer(fp)
        writer.writerow((
            "domain", "gers_id", "search_bucket", "overture_taxonomy",
            "source_license", "release",
        ))
        for domain in sorted(domains):
            item = domains[domain]
            writer.writerow((
                domain, item["gers"], item["region_bucket"], item["category"],
                LICENSE, RELEASE,
            ))

    print("MASS11_RESULT=" + json.dumps({
        "release": RELEASE,
        "license": LICENSE,
        "read_only": True,
        "selected_distinct_domains": len(domains),
        "areas": [{
            "bucket": group["area"],
            "raw": group["raw_records"],
            "licensed_distinct": group["distinct_licensed"],
            "selected": len(group["selected"]),
        } for group in groups],
        "audit_path": str(audit.relative_to(Path(__file__).resolve().parents[1])),
    }, separators=(",", ":")))


if __name__ == "__main__":
    main()
