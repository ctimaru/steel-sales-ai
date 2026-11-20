"""NET-IT-CARP-MASS4: second-wave Overture scan for under-covered Italian industrial areas.
Read-only discovery only. Overture website pointers are leads, never company verification.
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

# Province-oriented boxes complement MASS2/MASS3 and deliberately trade some
# overlap for deeper coverage. Production dedup remains authoritative.
AREAS = {
    "lombardia_bergamo_brescia": (9.15, 10.75, 45.25, 46.25),
    "lombardia_mantova_cremona_lodi": (9.15, 11.35, 44.70, 45.75),
    "veneto_vicenza_verona_rovigo": (10.55, 12.20, 44.65, 46.25),
    "veneto_padova_treviso_venezia": (11.40, 13.05, 44.85, 46.10),
    "emilia_parma_piacenza_reggio": (9.00, 11.10, 44.25, 45.25),
    "emilia_bologna_modena_ferrara": (10.45, 12.45, 44.00, 45.15),
    "toscana_firenze_prato_pistoia": (10.45, 11.65, 43.35, 44.25),
    "toscana_pisa_lucca_livorno": (9.85, 10.95, 43.05, 44.25),
    "lazio_viterbo_rieti": (11.35, 13.55, 41.45, 42.95),
    "lazio_latina_frosinone": (12.20, 14.05, 40.75, 42.05),
    "campania_avellino_benevento": (14.35, 15.75, 40.65, 41.65),
    "puglia_bari_brindisi": (15.45, 18.15, 40.30, 41.75),
    "sicilia_occidentale": (12.15, 14.20, 36.55, 38.45),
    "sicilia_centro_orientale": (13.55, 15.35, 36.65, 38.35),
}

# Start at zero inside smaller boxes; prior broad scans are deduplicated later
# against companies, candidates, research, SEED1 and provenance.
OFFSETS = {key: 0 for key in AREAS}

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
    source.RAW_LIMIT = 1200
    source.PER_AREA = 220
    source.LICENSES = frozenset({LICENSE})
    source.REJECT_HOSTS = source.REJECT_HOSTS | frozenset(
        {
            "weebly.com",
            "jimdo.com",
            "jimdosite.com",
            "wixsite.com",
            "blogspot.com",
            "wordpress.com",
            "sites.google.com",
            "site123.me",
            "business.site",
            "facebook.com",
            "instagram.com",
            "linkedin.com",
            "youtube.com",
            "wa.me",
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
        / "net_it_carp_mass4_20261120_gers.csv"
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
        "CARP_MASS4_RESULT="
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
