"""NET-IT-CARP-MASS2: licensed Overture carpenteria website pointers, read-only.

On-demand regional discovery on a GitHub Actions *isolated branch*.
A place taxonomy, tile or domain name is not company identity, proof of legal
establishment, verified activity, technical capability or publication consent.
Output is ONLY domain, Overture GERS, category, approximate tile and license.
No contact, person, address, public-company write, service secret or publication.
"""
from __future__ import annotations
import csv
import json
from pathlib import Path
import duckdb
import overture4_national_next as source

RELEASE = "2026-10-21.0"
assert source.RELEASE == RELEASE
LICENSE = "CDLA-Permissive-2.0"
ROUND = "net-it-carp-mass2-2026-11-20"

# Approximate search windows, intentionally offset from prior broad samples.
# Tiles do NOT determine a company's actual province or region.
AREAS = {
    "piemonte_torino_sud": (7.40, 8.45, 44.58, 45.30),
    "piemonte_cuneo": (7.08, 8.25, 44.12, 45.10),
    "piemonte_novara_vercelli": (8.12, 9.05, 45.10, 45.85),
    "lombardia_industriale": (8.55, 10.80, 45.05, 46.05),
    "veneto_industriale": (10.70, 12.80, 44.90, 46.20),
    "emilia_industriale": (9.12, 12.75, 43.88, 45.22),
    "toscana_marche": (10.02, 13.70, 42.52, 44.52),
    "puglia_basilicata": (14.80, 18.64, 39.72, 41.72),
}
OFFSETS = {
    "piemonte_torino_sud": 320,
    "piemonte_cuneo": 240,
    "piemonte_novara_vercelli": 270,
    "lombardia_industriale": 2350,
    "veneto_industriale": 1620,
    "emilia_industriale": 650,
    "toscana_marche": 750,
    "puglia_basilicata": 650,
}
CATEGORIES = (
    "metal_fabricator", "sheet_metal_fabricator", "steel_fabricators",
    "metal_fabrication", "welding_service", "iron_works",
    "metalworking_shop", "metal_workshop",
)

def main() -> None:
    source.AREAS = AREAS
    source.RAW_OFFSET = OFFSETS
    source.CATEGORY = CATEGORIES
    source.RAW_LIMIT = 1450
    source.PER_AREA = 180
    source.LICENSES = frozenset({LICENSE})
    source.REJECT_HOSTS = source.REJECT_HOSTS | frozenset({
        "weebly.com", "jimdo.com", "wixsite.com", "blogspot.com",
        "wordpress.com", "sites.google.com",
    })

    db = duckdb.connect(config={"threads": 2, "memory_limit": "512MB"})
    db.execute("INSTALL httpfs")
    db.execute("LOAD httpfs")
    db.execute("SET s3_region='us-west-2'")
    db.execute("SET http_timeout=60000")

    outputs = [source.collect(db, key, bbox) for key, bbox in AREAS.items()]
    unique = {}
    for item in outputs:
        for lead in item["selected"]:
            if lead["licenses"] == [LICENSE]:
                unique.setdefault(lead["domain"], lead)

    outdir = Path(__file__).resolve().parents[1] / "audits"
    outdir.mkdir(parents=True, exist_ok=True)
    audit = outdir / "net_it_carp_mass2_20261120_gers.csv"
    with audit.open("w", encoding="utf-8", newline="") as h:
        writer = csv.writer(h)
        writer.writerow(("domain", "gers_id", "search_bucket",
                         "overture_taxonomy", "source_license", "release"))
        for domain in sorted(unique):
            lead = unique[domain]
            assert source.company_domain("https://" + domain + "/") == domain
            writer.writerow((domain, lead["gers"], lead["region_bucket"],
                             lead["category"], LICENSE, RELEASE))
    assert sum(1 for _ in audit.open(encoding="utf-8")) == len(unique) + 1

    print("CARP_MASS2_RESULT=" + json.dumps({
        "round": ROUND,
        "release": RELEASE,
        "license": LICENSE,
        "read_only": True,
        "verified_companies": 0,
        "published": 0,
        "source_path": str(audit.relative_to(Path(__file__).resolve().parents[1])),
        "selected_distinct_domains": len(unique),
        "areas": [{"bucket": o["area"], "raw": o["raw_records"],
                   "licensed_distinct": o["distinct_licensed"],
                   "selected": len(o["selected"]),
                   "excluded_rights": o["excluded_rights"]}
                  for o in outputs],
    }, ensure_ascii=False, separators=(",", ":")))

if __name__ == "__main__":
    main()
