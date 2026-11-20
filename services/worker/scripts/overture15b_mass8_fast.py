"""NET-IT-MASS8-FAST: bounded read-only scan of supplier/manufacturer categories."""
from __future__ import annotations
import csv,json
from pathlib import Path
import duckdb
import overture4_national_next as source
LICENSE="CDLA-Permissive-2.0"; RELEASE="2026-10-21.0"
assert source.RELEASE==RELEASE
AREAS={
 "lombardia_supplier":(8.50,10.90,44.90,46.30),
 "nord_est_supplier":(10.40,13.90,44.80,46.80),
 "emilia_supplier":(9.00,12.90,43.80,45.30),
}
CATEGORIES=("metal_supplier","steel_supplier","steel_distributor","iron_and_steel_industry",
            "metal_manufacturer","metal_processing","metalworking","metal_worker","metal_works")
def main():
    source.AREAS=AREAS
    source.RAW_OFFSET={k:0 for k in AREAS}
    source.CATEGORY=CATEGORIES
    source.RAW_LIMIT=650
    source.PER_AREA=180
    source.LICENSES=frozenset({LICENSE})
    db=duckdb.connect(config={"threads":2,"memory_limit":"512MB"})
    db.execute("INSTALL httpfs"); db.execute("LOAD httpfs")
    db.execute("SET s3_region='us-west-2'"); db.execute("SET http_timeout=60000")
    groups=[source.collect(db,k,v) for k,v in AREAS.items()]
    domains={}
    for g in groups:
        for i in g["selected"]:
            if i["licenses"]==[LICENSE]: domains.setdefault(i["domain"],i)
    audit=Path(__file__).resolve().parents[1]/"audits/net_it_mass8_fast_20261120_gers.csv"
    audit.parent.mkdir(parents=True,exist_ok=True)
    with audit.open("w",encoding="utf-8",newline="") as fp:
        w=csv.writer(fp); w.writerow(("domain","gers_id","search_bucket","overture_taxonomy","source_license","release"))
        for d in sorted(domains):
            i=domains[d]; w.writerow((d,i["gers"],i["region_bucket"],i["category"],LICENSE,RELEASE))
    print("MASS8_FAST_RESULT="+json.dumps({
      "release":RELEASE,"license":LICENSE,"read_only":True,
      "selected_distinct_domains":len(domains),
      "areas":[{"bucket":g["area"],"raw":g["raw_records"],"licensed_distinct":g["distinct_licensed"],"selected":len(g["selected"])} for g in groups],
      "audit_path":str(audit.relative_to(Path(__file__).resolve().parents[1]))
    },separators=(",",":")))
if __name__=="__main__": main()
