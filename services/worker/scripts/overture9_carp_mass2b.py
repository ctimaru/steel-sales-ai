"""NET-IT-CARP-MASS2B: second bounded Overture scan focused on steel fabrication.
Run isolated/read-only. All place classifications are unverified leads.
No company names/contacts/addresses/PII or database writes.
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
    "piemonte_asti_alessandria": (7.60, 9.18, 44.30, 45.39),
    "piemonte_biella": (7.90, 8.80, 45.26, 46.08),
    "lombardia_brescia_bergamo": (9.05, 10.85, 45.23, 45.98),
    "veneto_vicenza_verona": (10.52, 11.95, 45.07, 46.02),
    "veneto_treviso_padova": (11.65, 12.85, 45.08, 46.20),
    "emilia_bologna_modena": (10.65, 12.18, 44.13, 45.08),
    "lazio_roma": (11.45, 13.80, 41.20, 42.79),
    "campania_napoli": (13.46, 15.62, 40.33, 41.49),
    "puglia_bari": (15.02, 17.41, 40.42, 41.77),
    "sicilia_palermo_catania": (12.35, 15.41, 37.17, 38.39),
}
OFFSETS = {
    "piemonte_asti_alessandria": 90,
    "piemonte_biella": 10,
    "lombardia_brescia_bergamo": 180,
    "veneto_vicenza_verona": 70,
    "veneto_treviso_padova": 65,
    "emilia_bologna_modena": 100,
    "lazio_roma": 140,
    "campania_napoli": 50,
    "puglia_bari": 50,
    "sicilia_palermo_catania": 150,
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
    source.RAW_LIMIT = 1000
    source.PER_AREA = 180
    source.LICENSES = frozenset({LICENSE})
    source.REJECT_HOSTS = source.REJECT_HOSTS | frozenset({
        "weebly.com", "jimdo.com", "wixsite.com", "blogspot.com",
        "wordpress.com", "sites.google.com"
    })
    db = duckdb.connect(config={"threads": 2, "memory_limit": "512MB"})
    db.execute("INSTALL httpfs")
    db.execute("LOAD httpfs")
    db.execute("SET s3_region='us-west-2'")
    db.execute("SET http_timeout=60000")
    results = [source.collect(db, k, v) for k,v in AREAS.items()]
    domains = {}
    for group in results:
        for item in group["selected"]:
            if item["licenses"] == [LICENSE]:
                domains.setdefault(item["domain"], item)
    audit = Path(__file__).resolve().parents[1] / "audits" / "net_it_carp_mass2b_20261120_gers.csv"
    audit.parent.mkdir(parents=True,exist_ok=True)
    with audit.open("w", encoding="utf-8",newline="") as fp:
        writer=csv.writer(fp)
        writer.writerow(("domain","gers_id","search_bucket","overture_taxonomy","source_license","release"))
        for d in sorted(domains):
            item=domains[d]
            assert source.company_domain("https://"+d+"/")==d
            writer.writerow((d,item["gers"],item["region_bucket"],item["category"],LICENSE,RELEASE))
    assert sum(1 for _ in audit.open(encoding="utf-8"))==len(domains)+1
    print("CARP_MASS2B_RESULT="+json.dumps({
       "release":RELEASE,"license":LICENSE,"read_only":True,
       "verified_companies":0,"published":0,
       "selected_distinct_domains":len(domains),
       "areas":[{"bucket":g["area"],"raw":g["raw_records"],
                 "licensed_distinct":g["distinct_licensed"],
                 "selected":len(g["selected"])} for g in results],
       "audit_path":str(audit.relative_to(Path(__file__).resolve().parents[1]))
    },separators=(",",":")))

if __name__=="__main__":
    main()
