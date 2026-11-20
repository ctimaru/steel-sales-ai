"""NET-IT-MASS9-FAST: bounded machine-shop/CNC discovery in high-density northern Italy."""
from __future__ import annotations
import csv,json
from pathlib import Path
import duckdb
import overture4_national_next as source
LICENSE="CDLA-Permissive-2.0"; RELEASE="2026-10-21.0"
assert source.RELEASE==RELEASE
AREAS={
 "lombardia_machining":(8.50,10.90,44.90,46.30),
 "nord_est_machining":(10.40,13.90,44.80,46.80),
 "emilia_machining":(9.00,12.90,43.80,45.30),
}
CATEGORIES=("machine_shop","industrial_company","tool_and_die_shop",
            "laser_cutting_service","metal_heat_treating","metal_finishing",
            "sandblasting_service","foundry","forging")
def main():
    source.AREAS=AREAS
    source.RAW_OFFSET={k:0 for k in AREAS}
    source.CATEGORY=CATEGORIES
    source.RAW_LIMIT=700
    source.PER_AREA=200
    source.LICENSES=frozenset({LICENSE})
    source.REJECT_HOSTS=source.REJECT_HOSTS|frozenset({
      "weebly.com","jimdo.com","jimdosite.com","wixsite.com","blogspot.com",
      "wordpress.com","sites.google.com","site123.me","business.site",
      "facebook.com","instagram.com","linkedin.com","youtube.com","wa.me",
      "godaddysites.com","infoisinfo.it","reteimprese.it",
    })
    db=duckdb.connect(config={"threads":2,"memory_limit":"512MB"})
    db.execute("INSTALL httpfs"); db.execute("LOAD httpfs")
    db.execute("SET s3_region='us-west-2'"); db.execute("SET http_timeout=60000")
    groups=[source.collect(db,k,v) for k,v in AREAS.items()]
    domains={}
    for g in groups:
        for i in g["selected"]:
            if i["licenses"]==[LICENSE]: domains.setdefault(i["domain"],i)
    audit=Path(__file__).resolve().parents[1]/"audits/net_it_mass9_fast_20261120_gers.csv"
    audit.parent.mkdir(parents=True,exist_ok=True)
    with audit.open("w",encoding="utf-8",newline="") as fp:
        w=csv.writer(fp); w.writerow(("domain","gers_id","search_bucket","overture_taxonomy","source_license","release"))
        for d in sorted(domains):
            i=domains[d]; w.writerow((d,i["gers"],i["region_bucket"],i["category"],LICENSE,RELEASE))
    print("MASS9_FAST_RESULT="+json.dumps({
      "release":RELEASE,"license":LICENSE,"read_only":True,
      "selected_distinct_domains":len(domains),
      "areas":[{"bucket":g["area"],"raw":g["raw_records"],"licensed_distinct":g["distinct_licensed"],"selected":len(g["selected"])} for g in groups],
      "audit_path":str(audit.relative_to(Path(__file__).resolve().parents[1]))
    },separators=(",",":")))
if __name__=="__main__": main()
