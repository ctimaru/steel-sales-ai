"""NET-IT-CARP-MASS6: final deep-page discovery wave for the 2,000-company milestone.
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
EB = (10.45, 12.45, 44.00, 45.15)
MIL = (8.25, 9.65, 45.20, 46.25)
PIE = (7.60, 9.18, 44.30, 45.39)
FVG = (12.25, 13.95, 45.50, 46.75)
MAR = (12.05, 13.85, 42.65, 44.05)

AREAS = {
    "lombardia_bergamo_brescia_p5": LB,
    "lombardia_bergamo_brescia_p6": LB,
    "lombardia_mantova_cremona_lodi_p5": LM,
    "lombardia_mantova_cremona_lodi_p6": LM,
    "lombardia_mantova_cremona_lodi_p7": LM,
    "veneto_vicenza_verona_rovigo_p5": VV,
    "veneto_padova_treviso_venezia_p4": VP,
    "emilia_bologna_modena_ferrara_p3": EB,
    "lombardia_milano_monza_varese_como_p3": MIL,
    "lombardia_milano_monza_varese_como_p4": MIL,
    "lombardia_milano_monza_varese_como_p5": MIL,
    "piemonte_asti_alessandria_p3": PIE,
    "piemonte_asti_alessandria_p4": PIE,
    "friuli_venezia_giulia_p2": FVG,
    "marche_p2": MAR,
}

OFFSETS = {
    "lombardia_bergamo_brescia_p5": 880,
    "lombardia_bergamo_brescia_p6": 1100,
    "lombardia_mantova_cremona_lodi_p5": 880,
    "lombardia_mantova_cremona_lodi_p6": 1100,
    "lombardia_mantova_cremona_lodi_p7": 1320,
    "veneto_vicenza_verona_rovigo_p5": 880,
    "veneto_padova_treviso_venezia_p4": 660,
    "emilia_bologna_modena_ferrara_p3": 440,
    "lombardia_milano_monza_varese_como_p3": 400,
    "lombardia_milano_monza_varese_como_p4": 580,
    "lombardia_milano_monza_varese_como_p5": 760,
    "piemonte_asti_alessandria_p3": 270,
    "piemonte_asti_alessandria_p4": 450,
    "friuli_venezia_giulia_p2": 220,
    "marche_p2": 280,
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
    source.RAW_LIMIT = 1600
    source.PER_AREA = 220
    source.LICENSES = frozenset({LICENSE})
    source.REJECT_HOSTS = source.REJECT_HOSTS | frozenset(
        {
            "weebly.com", "jimdo.com", "jimdosite.com", "wixsite.com",
            "blogspot.com", "wordpress.com", "sites.google.com", "site123.me",
            "business.site", "facebook.com", "instagram.com", "linkedin.com",
            "youtube.com", "wa.me", "godaddysites.com",
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
        / "net_it_carp_mass6_20261120_gers.csv"
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
        "CARP_MASS6_RESULT="
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
