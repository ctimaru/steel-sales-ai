"""NET-IT-CARP-MASS5: deep-page Overture scan to push Italian Network beyond 2,000.
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

LB = (9.15, 10.75, 45.25, 46.25)
LM = (9.15, 11.35, 44.70, 45.75)
VV = (10.55, 12.20, 44.65, 46.25)
VP = (11.40, 13.05, 44.85, 46.10)
EP = (9.00, 11.10, 44.25, 45.25)
EB = (10.45, 12.45, 44.00, 45.15)
TR = (10.35, 12.65, 45.65, 47.20)

AREAS = {
    "lombardia_bergamo_brescia_p2": LB,
    "lombardia_bergamo_brescia_p3": LB,
    "lombardia_bergamo_brescia_p4": LB,
    "lombardia_mantova_cremona_lodi_p2": LM,
    "lombardia_mantova_cremona_lodi_p3": LM,
    "lombardia_mantova_cremona_lodi_p4": LM,
    "veneto_vicenza_verona_rovigo_p2": VV,
    "veneto_vicenza_verona_rovigo_p3": VV,
    "veneto_vicenza_verona_rovigo_p4": VV,
    "veneto_padova_treviso_venezia_p2": VP,
    "veneto_padova_treviso_venezia_p3": VP,
    "emilia_parma_piacenza_reggio_p2": EP,
    "emilia_bologna_modena_ferrara_p2": EB,
    "toscana_arezzo_siena": (10.75, 12.45, 42.75, 43.85),
    "toscana_grosseto": (10.35, 12.00, 42.15, 43.25),
    "trentino_alto_adige_p2": TR,
    "lazio_roma_periferia": (11.75, 13.45, 41.35, 42.25),
}

OFFSETS = {
    "lombardia_bergamo_brescia_p2": 220,
    "lombardia_bergamo_brescia_p3": 440,
    "lombardia_bergamo_brescia_p4": 660,
    "lombardia_mantova_cremona_lodi_p2": 220,
    "lombardia_mantova_cremona_lodi_p3": 440,
    "lombardia_mantova_cremona_lodi_p4": 660,
    "veneto_vicenza_verona_rovigo_p2": 220,
    "veneto_vicenza_verona_rovigo_p3": 440,
    "veneto_vicenza_verona_rovigo_p4": 660,
    "veneto_padova_treviso_venezia_p2": 220,
    "veneto_padova_treviso_venezia_p3": 440,
    "emilia_parma_piacenza_reggio_p2": 220,
    "emilia_bologna_modena_ferrara_p2": 220,
    "toscana_arezzo_siena": 0,
    "toscana_grosseto": 0,
    "trentino_alto_adige_p2": 205,
    "lazio_roma_periferia": 0,
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
    source.RAW_LIMIT = 1400
    source.PER_AREA = 220
    source.LICENSES = frozenset({LICENSE})
    source.REJECT_HOSTS = source.REJECT_HOSTS | frozenset(
        {
            "weebly.com", "jimdo.com", "jimdosite.com", "wixsite.com",
            "blogspot.com", "wordpress.com", "sites.google.com", "site123.me",
            "business.site", "facebook.com", "instagram.com", "linkedin.com",
            "youtube.com", "wa.me",
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
        / "net_it_carp_mass5_20261120_gers.csv"
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
            assert source.company_domain("https://" + domain + "/") == domain
            writer.writerow((
                domain, item["gers"], item["region_bucket"], item["category"],
                LICENSE, RELEASE,
            ))

    assert sum(1 for _ in audit.open(encoding="utf-8")) == len(domains) + 1
    print(
        "CARP_MASS5_RESULT="
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
                "audit_path": str(audit.relative_to(Path(__file__).resolve().parents[1])),
            },
            separators=(",", ":"),
        )
    )


if __name__ == "__main__":
    main()
