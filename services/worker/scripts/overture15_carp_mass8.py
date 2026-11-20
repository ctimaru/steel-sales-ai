"""NET-IT-CARP-MASS8: full industrial-taxonomy Overture wave for the 2,250 milestone.
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

# Reuse the full industrial taxonomy already encoded in the project source:
# fabrication + suppliers/distributors + manufacturers + processing/metalworking.
CATEGORIES = tuple(source.CATEGORY)

MIL = (8.65, 9.75, 45.30, 45.85)
LBC = (9.20, 10.70, 45.25, 46.05)
LML = (9.10, 11.45, 44.65, 45.65)
VV = (10.45, 12.05, 45.00, 46.10)
VP = (11.35, 13.00, 44.95, 46.10)
EP = (8.95, 11.05, 44.20, 45.25)
EB = (10.40, 12.55, 43.95, 45.20)
PT = (7.10, 8.45, 44.75, 45.75)
PC = (6.75, 9.25, 43.95, 45.35)
TF = (10.35, 12.05, 43.15, 44.35)
TW = (9.70, 11.55, 42.75, 44.25)
MN = (12.20, 13.85, 43.15, 44.30)
MS = (12.45, 14.00, 42.35, 43.60)
UMB = (11.70, 13.45, 42.20, 43.75)
LR = (11.45, 13.65, 41.35, 42.55)
LS = (12.30, 14.25, 40.70, 41.85)
CN = (13.45, 15.35, 40.35, 41.65)
CS = (14.10, 15.95, 39.75, 41.50)
PN = (14.80, 16.95, 40.55, 42.20)
PS = (16.00, 18.70, 39.45, 41.40)
AM = (13.00, 15.20, 41.20, 43.00)
CB = (15.10, 17.55, 37.70, 41.35)
SW = (12.00, 14.20, 36.45, 38.50)
SE = (13.70, 15.65, 36.40, 38.35)
SAR = (7.80, 10.00, 38.70, 41.60)

AREAS = {
    "mass8_lombardia_milano_p1": MIL,
    "mass8_lombardia_milano_p2": MIL,
    "mass8_lombardia_bergamo_brescia_p1": LBC,
    "mass8_lombardia_bergamo_brescia_p2": LBC,
    "mass8_lombardia_mantova_cremona_lodi": LML,
    "mass8_veneto_verona_vicenza_p1": VV,
    "mass8_veneto_verona_vicenza_p2": VV,
    "mass8_veneto_padova_treviso_p1": VP,
    "mass8_veneto_padova_treviso_p2": VP,
    "mass8_emilia_parma_reggio_p1": EP,
    "mass8_emilia_parma_reggio_p2": EP,
    "mass8_emilia_bologna_modena_p1": EB,
    "mass8_emilia_bologna_modena_p2": EB,
    "mass8_piemonte_torino_p1": PT,
    "mass8_piemonte_torino_p2": PT,
    "mass8_piemonte_cuneo_asti_alessandria": PC,
    "mass8_toscana_firenze_arezzo_p1": TF,
    "mass8_toscana_firenze_arezzo_p2": TF,
    "mass8_toscana_ovest_siena": TW,
    "mass8_marche_nord": MN,
    "mass8_marche_sud": MS,
    "mass8_umbria": UMB,
    "mass8_lazio_roma": LR,
    "mass8_lazio_sud": LS,
    "mass8_campania_nord_p1": CN,
    "mass8_campania_nord_p2": CN,
    "mass8_campania_sud": CS,
    "mass8_puglia_nord": PN,
    "mass8_puglia_sud_p1": PS,
    "mass8_puglia_sud_p2": PS,
    "mass8_abruzzo_molise": AM,
    "mass8_calabria_basilicata": CB,
    "mass8_sicilia_ovest": SW,
    "mass8_sicilia_est": SE,
    "mass8_sardegna": SAR,
}

OFFSETS = {key: 0 for key in AREAS}
for key in (
    "mass8_lombardia_milano_p2",
    "mass8_lombardia_bergamo_brescia_p2",
    "mass8_veneto_verona_vicenza_p2",
    "mass8_veneto_padova_treviso_p2",
    "mass8_emilia_parma_reggio_p2",
    "mass8_emilia_bologna_modena_p2",
    "mass8_piemonte_torino_p2",
    "mass8_toscana_firenze_arezzo_p2",
    "mass8_campania_nord_p2",
    "mass8_puglia_sud_p2",
):
    OFFSETS[key] = 320


def main() -> None:
    source.AREAS = AREAS
    source.RAW_OFFSET = OFFSETS
    source.CATEGORY = CATEGORIES
    source.RAW_LIMIT = 2500
    source.PER_AREA = 320
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
        / "net_it_carp_mass8_20261120_gers.csv"
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
        "CARP_MASS8_RESULT="
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
