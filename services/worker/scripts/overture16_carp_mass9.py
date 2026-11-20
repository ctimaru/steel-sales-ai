"""NET-IT-CARP-MASS9: supplier/manufacturer/processing Overture wave for the 2,250 milestone.
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

CATEGORIES = (
    "metal_supplier",
    "steel_supplier",
    "steel_distributor",
    "iron_and_steel_industry",
    "metal_manufacturer",
    "metal_processing",
    "metalworking",
    "metal_worker",
    "metal_workshop",
    "metalworking_shop",
    "metal_works",
)

AREAS = {
    "mass9_lombardia_ovest_p1": (8.25, 9.75, 45.10, 46.25),
    "mass9_lombardia_ovest_p2": (8.25, 9.75, 45.10, 46.25),
    "mass9_lombardia_est_p1": (9.55, 11.35, 44.65, 46.25),
    "mass9_lombardia_est_p2": (9.55, 11.35, 44.65, 46.25),
    "mass9_veneto_ovest_p1": (10.35, 12.15, 44.70, 46.35),
    "mass9_veneto_ovest_p2": (10.35, 12.15, 44.70, 46.35),
    "mass9_veneto_est_fvg_p1": (11.75, 13.95, 44.75, 46.80),
    "mass9_veneto_est_fvg_p2": (11.75, 13.95, 44.75, 46.80),
    "mass9_emilia_ovest_p1": (8.80, 11.05, 44.10, 45.35),
    "mass9_emilia_ovest_p2": (8.80, 11.05, 44.10, 45.35),
    "mass9_emilia_est_p1": (10.75, 12.85, 43.80, 45.25),
    "mass9_emilia_est_p2": (10.75, 12.85, 43.80, 45.25),
    "mass9_piemonte_torino_p1": (6.95, 8.35, 44.75, 45.75),
    "mass9_piemonte_torino_p2": (6.95, 8.35, 44.75, 45.75),
    "mass9_piemonte_est_sud_p1": (7.55, 9.35, 43.90, 45.65),
    "mass9_piemonte_est_sud_p2": (7.55, 9.35, 43.90, 45.65),
    "mass9_toscana_nord_p1": (9.70, 11.75, 43.15, 44.35),
    "mass9_toscana_nord_p2": (9.70, 11.75, 43.15, 44.35),
    "mass9_toscana_sud_umbria": (10.70, 13.45, 42.20, 43.55),
    "mass9_marche": (12.05, 13.95, 42.45, 44.30),
    "mass9_lazio_roma_p1": (11.45, 13.75, 41.15, 42.65),
    "mass9_lazio_roma_p2": (11.45, 13.75, 41.15, 42.65),
    "mass9_campania_p1": (13.45, 15.95, 39.75, 41.75),
    "mass9_campania_p2": (13.45, 15.95, 39.75, 41.75),
    "mass9_puglia_p1": (14.80, 18.65, 39.45, 42.20),
    "mass9_puglia_p2": (14.80, 18.65, 39.45, 42.20),
    "mass9_abruzzo_molise": (13.00, 15.35, 41.10, 43.00),
    "mass9_calabria_basilicata": (15.00, 17.65, 37.70, 41.35),
    "mass9_sicilia_p1": (12.00, 15.75, 36.35, 38.55),
    "mass9_sicilia_p2": (12.00, 15.75, 36.35, 38.55),
    "mass9_sardegna": (7.75, 10.05, 38.65, 41.65),
    "mass9_liguria": (7.45, 10.10, 43.60, 44.85),
}

OFFSETS = {key: 0 for key in AREAS}
for key in (
    "mass9_lombardia_ovest_p2",
    "mass9_lombardia_est_p2",
    "mass9_veneto_ovest_p2",
    "mass9_veneto_est_fvg_p2",
    "mass9_emilia_ovest_p2",
    "mass9_emilia_est_p2",
    "mass9_piemonte_torino_p2",
    "mass9_piemonte_est_sud_p2",
    "mass9_toscana_nord_p2",
    "mass9_lazio_roma_p2",
    "mass9_campania_p2",
    "mass9_puglia_p2",
    "mass9_sicilia_p2",
):
    OFFSETS[key] = 450


def main() -> None:
    source.AREAS = AREAS
    source.RAW_OFFSET = OFFSETS
    source.CATEGORY = CATEGORIES
    source.RAW_LIMIT = 3000
    source.PER_AREA = 420
    source.LICENSES = frozenset({LICENSE})
    source.REJECT_HOSTS = source.REJECT_HOSTS | frozenset(
        {
            "weebly.com", "jimdo.com", "jimdosite.com", "wixsite.com",
            "blogspot.com", "wordpress.com", "sites.google.com", "site123.me",
            "business.site", "facebook.com", "instagram.com", "linkedin.com",
            "youtube.com", "wa.me", "godaddysites.com", "webnode.it",
        }
    )

    db = duckdb.connect(config={"threads": 2, "memory_limit": "768MB"})
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
        / "net_it_carp_mass9_20261120_gers.csv"
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
        "CARP_MASS9_RESULT="
        + json.dumps(
            {
                "release": RELEASE,
                "license": LICENSE,
                "read_only": True,
                "verified_companies": 0,
                "published": 0,
                "taxonomy": list(CATEGORIES),
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
