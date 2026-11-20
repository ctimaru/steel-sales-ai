"""NET-IT-MASS10: deeper read-only Overture discovery for machining and metal processes.

Second sampling layer after MASS9. Overture taxonomy and websites are discovery
hints only; first-party AUTO2/AUTO3 remains mandatory before publication.
"""
from __future__ import annotations
import csv, json
from pathlib import Path
import duckdb
import overture4_national_next as source

LICENSE="CDLA-Permissive-2.0"
RELEASE="2026-10-21.0"
assert source.RELEASE==RELEASE

AREAS={
 "piemonte_liguria":(7.10,9.30,43.85,46.00),
 "lombardia":(8.50,10.90,44.90,46.30),
 "nord_est":(10.40,13.90,44.80,46.80),
 "emilia_romagna":(9.00,12.90,43.80,45.30),
 "toscana_umbria_marche":(9.50,13.90,42.20,44.60),
 "lazio_abruzzo_molise":(11.60,15.20,40.90,43.30),
 "campania_puglia_basilicata":(13.30,18.70,39.50,41.90),
 "calabria_sicilia":(12.20,17.60,36.40,40.30),
 "sardegna":(7.80,10.10,38.60,41.60),
}
OFFSETS={
 "piemonte_liguria":350,
 "lombardia":450,
 "nord_est":450,
 "emilia_romagna":350,
 "toscana_umbria_marche":250,
 "lazio_abruzzo_molise":200,
 "campania_puglia_basilicata":120,
 "calabria_sicilia":80,
 "sardegna":0,
}
CATEGORIES=(
 "machine_shop",
 "tool_and_die_shop",
 "laser_cutting_service",
 "water_jet_cutting_service",
 "metal_heat_treating",
 "metal_finishing",
 "powder_coating_service",
 "plating_service",
 "anodizing_service",
 "sandblasting_service",
 "foundry",
 "forging",
 "steel_erector",
)

def main():
    source.AREAS=AREAS
    source.RAW_OFFSET=OFFSETS
    source.CATEGORY=CATEGORIES
    source.RAW_LIMIT=1200
    source.PER_AREA=220
    source.LICENSES=frozenset({LICENSE})
    source.REJECT_HOSTS=source.REJECT_HOSTS|frozenset({
      "weebly.com","jimdo.com","jimdosite.com","wixsite.com","blogspot.com",
      "wordpress.com","sites.google.com","site123.me","business.site",
      "facebook.com","instagram.com","linkedin.com","youtube.com","wa.me",
      "godaddysites.com","infoisinfo.it","reteimprese.it","autoline.info",
      "simdif.com",
    })
    db=duckdb.connect(config={"threads":2,"memory_limit":"768MB"})
    db.execute("INSTALL httpfs"); db.execute("LOAD httpfs")
    db.execute("SET s3_region='us-west-2'"); db.execute("SET http_timeout=60000")
    groups=[source.collect(db,k,v) for k,v in AREAS.items()]
    domains={}
    for g in groups:
        for i in g["selected"]:
            if i["licenses"]==[LICENSE]:
                domains.setdefault(i["domain"],i)
    audit=Path(__file__).resolve().parents[1]/"audits/net_it_mass10_20261120_gers.csv"
    audit.parent.mkdir(parents=True,exist_ok=True)
    with audit.open("w",encoding="utf-8",newline="") as fp:
        w=csv.writer(fp)
        w.writerow(("domain","gers_id","search_bucket","overture_taxonomy","source_license","release"))
        for d in sorted(domains):
            i=domains[d]
            w.writerow((d,i["gers"],i["region_bucket"],i["category"],LICENSE,RELEASE))
    print("MASS10_RESULT="+json.dumps({
      "release":RELEASE,"license":LICENSE,"read_only":True,
      "selected_distinct_domains":len(domains),
      "areas":[{"bucket":g["area"],"raw":g["raw_records"],
                "licensed_distinct":g["distinct_licensed"],
                "selected":len(g["selected"])} for g in groups],
      "audit_path":str(audit.relative_to(Path(__file__).resolve().parents[1]))
    },separators=(",",":")))

if __name__=="__main__": main()
