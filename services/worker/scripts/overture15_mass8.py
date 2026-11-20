"""NET-IT-MASS8: national Overture scan for non-carpenteria steel/metal industrial categories.
Read-only discovery only. Website pointers are leads, never company verification.
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
OFFSETS={k:0 for k in AREAS}
CATEGORIES=(
 "metal_supplier","steel_supplier","steel_distributor",
 "iron_and_steel_industry","metal_manufacturer","metal_processing",
 "metalworking","metal_worker","metal_works",
)

def main():
    source.AREAS=AREAS
    source.RAW_OFFSET=OFFSETS
    source.CATEGORY=CATEGORIES
    source.RAW_LIMIT=1800
    source.PER_AREA=260
    source.LICENSES=frozenset({LICENSE})
    source.REJECT_HOSTS=source.REJECT_HOSTS|frozenset({
      "weebly.com","jimdo.com","jimdosite.com","wixsite.com","blogspot.com",
      "wordpress.com","sites.google.com","site123.me","business.site",
      "facebook.com","instagram.com","linkedin.com","youtube.com","wa.me",
      "godaddysites.com",
    })
    db=duckdb.connect(config={"threads":2,"memory_limit":"768MB"})
    db.execute("INSTALL httpfs"); db.execute("LOAD httpfs")
    db.execute("SET s3_region='us-west-2'"); db.execute("SET http_timeout=60000")
    groups=[source.collect(db,k,v) for k,v in AREAS.items()]
    domains={}
    for g in groups:
        for item in g["selected"]:
            if item["licenses"]==[LICENSE]:
                domains.setdefault(item["domain"],item)
    audit=Path(__file__).resolve().parents[1]/"audits/net_it_mass8_20261120_gers.csv"
    audit.parent.mkdir(parents=True,exist_ok=True)
    with audit.open("w",encoding="utf-8",newline="") as fp:
        w=csv.writer(fp)
        w.writerow(("domain","gers_id","search_bucket","overture_taxonomy","source_license","release"))
        for domain in sorted(domains):
            i=domains[domain]
            w.writerow((domain,i["gers"],i["region_bucket"],i["category"],LICENSE,RELEASE))
    print("MASS8_RESULT="+json.dumps({
      "release":RELEASE,"license":LICENSE,"read_only":True,
      "selected_distinct_domains":len(domains),
      "areas":[{"bucket":g["area"],"raw":g["raw_records"],
                "licensed_distinct":g["distinct_licensed"],
                "selected":len(g["selected"])} for g in groups],
      "audit_path":str(audit.relative_to(Path(__file__).resolve().parents[1]))
    },separators=(",",":")))

if __name__=="__main__": main()
