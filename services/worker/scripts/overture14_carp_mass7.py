"""NET-IT-CARP-MASS7: broad net-new Overture wave for the 2,250 milestone.
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

TFP = (10.45, 11.65, 43.35, 44.25)
LVR = (11.35, 13.55, 41.45, 42.95)
LLF = (12.20, 14.05, 40.75, 42.05)
EP = (9.00, 11.10, 44.25, 45.25)
EB = (10.45, 12.45, 44.00, 45.15)
VV = (10.55, 12.20, 44.65, 46.25)
MIL = (8.25, 9.65, 45.20, 46.25)

AREAS = {
    "calabria_cosenza": (15.45, 17.35, 38.95, 40.25),
    "calabria_catanzaro_vibo": (15.55, 17.45, 38.15, 39.20),
    "calabria_reggio": (15.35, 16.85, 37.75, 38.55),
    "basilicata_potenza_matera": (15.15, 17.25, 39.65, 41.30),
    "puglia_foggia_bat": (14.85, 16.95, 40.65, 42.20),
    "puglia_taranto_lecce_brindisi": (16.15, 18.65, 39.55, 41.35),
    "campania_caserta_napoli": (13.55, 15.25, 40.45, 41.65),
    "campania_salerno_avellino_benevento": (14.15, 15.95, 39.85, 41.55),
    "sicilia_palermo_trapani_agrigento_p2": (12.10, 14.20, 36.55, 38.45),
    "sicilia_catania_siracusa_ragusa_p2": (13.75, 15.55, 36.45, 38.30),
    "sardegna_nord": (7.85, 9.95, 39.95, 41.55),
    "sardegna_sud": (8.05, 9.95, 38.75, 40.35),
    "molise": (13.65, 15.25, 41.25, 42.25),
    "abruzzo_pescara_chieti": (13.75, 14.95, 41.65, 42.70),
    "abruzzo_laquila_teramo": (13.05, 14.55, 41.85, 42.95),
    "marche_ancona_pesaro": (12.30, 13.85, 43.15, 44.25),
    "marche_macerata_ascoli": (12.55, 13.95, 42.45, 43.60),
    "umbria_perugia_terni_p2": (11.75, 13.45, 42.25, 43.70),
    "liguria_genova_savona": (7.95, 9.45, 43.75, 44.75),
    "liguria_la_spezia": (9.25, 10.10, 43.75, 44.55),
    "toscana_firenze_prato_pistoia_p2": TFP,
    "toscana_firenze_prato_pistoia_p3": TFP,
    "lazio_viterbo_rieti_p2": LVR,
    "lazio_latina_frosinone_p2": LLF,
    "emilia_parma_piacenza_reggio_p3": EP,
    "emilia_bologna_modena_ferrara_p4": EB,
    "veneto_vicenza_verona_rovigo_p6": VV,
    "lombardia_milano_monza_varese_como_p6": MIL,
    "piemonte_torino_nord_est": (7.35, 8.45, 44.95, 45.70),
    "piemonte_cuneo_langhe": (6.75, 8.25, 43.95, 45.10),
}

OFFSETS = {
    "calabria_cosenza": 0,
    "calabria_catanzaro_vibo": 0,
    "calabria_reggio": 0,
    "basilicata_potenza_matera": 0,
    "puglia_foggia_bat": 0,
    "puglia_taranto_lecce_brindisi": 0,
    "campania_caserta_napoli": 0,
    "campania_salerno_avellino_benevento": 0,
    "sicilia_palermo_trapani_agrigento_p2": 220,
    "sicilia_catania_siracusa_ragusa_p2": 220,
    "sardegna_nord": 0,
    "sardegna_sud": 0,
    "molise": 0,
    "abruzzo_pescara_chieti": 0,
    "abruzzo_laquila_teramo": 0,
    "marche_ancona_pesaro": 0,
    "marche_macerata_ascoli": 0,
    "umbria_perugia_terni_p2": 220,
    "liguria_genova_savona": 0,
    "liguria_la_spezia": 0,
    "toscana_firenze_prato_pistoia_p2": 220,
    "toscana_firenze_prato_pistoia_p3": 440,
    "lazio_viterbo_rieti_p2": 220,
    "lazio_latina_frosinone_p2": 220,
    "emilia_parma_piacenza_reggio_p3": 440,
    "emilia_bologna_modena_ferrara_p4": 660,
    "veneto_vicenza_verona_rovigo_p6": 1100,
    "lombardia_milano_monza_varese_como_p6": 980,
    "piemonte_torino_nord_est": 0,
    "piemonte_cuneo_langhe": 0,
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
    source.RAW_LIMIT = 1800
    source.PER_AREA = 260
    source.LICENSES = frozenset({LICENSE})
    source.REJECT_HOSTS = source.REJECT_HOSTS | frozenset(
        {
            "weebly.com", "jimdo.com", "jimdosite.com", "wixsite.com",
            "blogspot.com", "wordpress.com", "sites.google.com", "site123.me",
            "business.site", "facebook.com", "instagram.com", "linkedin.com",
            "youtube.com", "wa.me", "godaddysites.com",
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
        / "net_it_carp_mass7_20261120_gers.csv"
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
        "CARP_MASS7_RESULT="
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
