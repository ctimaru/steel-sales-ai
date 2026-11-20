"""NET-IT-MASS13 taxonomy probe — read-only category discovery.

Outputs only aggregate taxonomy counts for Italian Overture Places with websites.
No company names, domains, contacts, PII or production writes.
"""
from __future__ import annotations
import json
import duckdb
import overture4_national_next as source

def main():
    db=duckdb.connect(config={"threads":2,"memory_limit":"768MB"})
    db.execute("INSTALL httpfs"); db.execute("LOAD httpfs")
    db.execute("SET s3_region='us-west-2'"); db.execute("SET http_timeout=60000")
    sql="""
    SELECT taxonomy.primary AS category, COUNT(*) AS n
    FROM read_parquet(?, hive_partitioning=1)
    WHERE bbox.xmin BETWEEN 6.2 AND 19.0
      AND bbox.ymin BETWEEN 36.2 AND 47.2
      AND addresses[1].country='IT'
      AND list_count(websites)>0
      AND taxonomy.primary IS NOT NULL
      AND regexp_matches(
        lower(taxonomy.primary),
        '(agric|farm|trailer|machin|manufact|engineer|construct|vehicle|equipment|industrial|mechanic|fabric|weld|metal|steel|body|coach|hydraul|automation|robot)'
      )
    GROUP BY taxonomy.primary
    ORDER BY n DESC, category
    LIMIT 250
    """
    rows=db.execute(sql,[source.SOURCE]).fetchall()
    print("MASS13_TAXONOMY="+json.dumps(
      {"release":source.RELEASE,"read_only":True,
       "categories":[{"category":c,"count":int(n)} for c,n in rows]},
      separators=(",",":")
    ))

if __name__=="__main__": main()
