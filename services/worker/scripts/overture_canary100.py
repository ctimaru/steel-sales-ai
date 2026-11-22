"""Free and read-only expanded Overture industrial website candidate sample.

Only domains and dataset provenance leave this tool. Sites remain unverified;
no contact/person/address data and no Supabase credentials or writes.
"""
from __future__ import annotations
import json
import duckdb
from overture_canary20 import SOURCE, RELEASE, BBOX, company_domain

RECORD_LIMIT = 400
SAMPLE_LIMIT = 100
CATEGORIES = (
  "iron_and_steel_industry", "steel_fabricators",
  "steel_supplier", "steel_distributor",
  "sheet_metal_fabricator", "metal_fabricator", "metal_fabrication",
  "metal_manufacturer", "metal_processing", "metalworking",
  "metal_worker", "metal_workshop", "metalworking_shop",
  "welding_service", "iron_works", "metal_works", "metal_supplier",
)
ALLOWED_LICENSES = {"CDLA-Permissive-2.0", "Apache-2.0", "CC0-1.0"}
PRIORITY = {
  "iron_and_steel_industry": 6, "steel_fabricators": 6,
  "steel_supplier": 6, "steel_distributor": 6,
  "sheet_metal_fabricator": 5, "metal_fabrication": 4,
  "metal_fabricator": 4, "metal_processing": 3,
  "metalworking": 3, "metal_manufacturer": 3,
}

def main() -> None:
    db = duckdb.connect(config={"threads": 2, "memory_limit": "512MB"})
    db.execute("INSTALL httpfs")
    db.execute("LOAD httpfs")
    db.execute("SET s3_region = 'us-west-2'")
    db.execute("SET http_timeout = 60000")
    sql = """
    SELECT id, taxonomy.primary AS category, websites[1] AS website,
           addresses[1].country AS country, confidence,
           CAST(sources AS JSON)::VARCHAR AS source_json
    FROM read_parquet(?, hive_partitioning=1)
    WHERE bbox.xmin BETWEEN ? AND ? AND bbox.ymin BETWEEN ? AND ?
      AND addresses[1].country='IT' AND list_count(websites)>0
      AND taxonomy.primary IN (""" + ",".join("?" for _ in CATEGORIES) + """)
    LIMIT ?
    """
    rows = db.execute(sql, [SOURCE,*BBOX,*CATEGORIES,RECORD_LIMIT]).fetchall()
    leads = {}
    rejected_rights = 0
    for place_id,cat,url,country,confidence,source_json in rows:
        domain = company_domain(url)
        if not domain or country != "IT":
            continue
        sources = json.loads(source_json) if source_json else []
        licenses = sorted({s.get("license") for s in sources
                         if isinstance(s,dict) and isinstance(s.get("license"),str)})
        if not licenses or not set(licenses).issubset(ALLOWED_LICENSES):
            rejected_rights += 1
            continue
        item = {"domain":domain,"overture_id":str(place_id),
                "category":cat,"confidence":confidence,"licenses":licenses}
        prev = leads.get(domain)
        if prev is None or float(prev["confidence"] or 0) < float(confidence or 0):
            leads[domain] = item
    sample = sorted(leads.values(),key=lambda v:(
        -PRIORITY.get(v["category"],2),
        -float(v["confidence"] or 0),v["domain"]))[:SAMPLE_LIMIT]
    print("OVERTURE100_RESULT="+json.dumps({
        "contract":"net-it-overture100-readonly-v1",
        "release":RELEASE,"bbox":list(BBOX),
        "source_kind":"places_open_geoparquet",
        "selection":"licensed industrial-category high-confidence convenience sample",
        "returned_rows":len(rows),"distinct_licensed_domains":len(leads),
        "rejected_rights":rejected_rights,
        "selected_count":len(sample),
        "firstparty_verified":0,"published":0,"persisted":False,
        "candidates":sample},separators=(",",":")))

if __name__ == "__main__":
    main()
