"""NET-FAST2: one fair-use Wikidata CC0 industrial query/day, no website visits.

The first-party company site URL is a Wikidata P856 data field. We never fetch it.
Results are *unconfirmed* business profiles and never create verified companies.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
import re

import httpx

from .company_discovery import CompanyDiscoveryError, canonical_domain, canonicalize_seed_url
from .github_actions_crawler import credentials_from_environment
from .wikidata_source_discovery import EXCLUDED, SOURCE_URL, USER_AGENT

ALLOWED_INDUSTRIES = frozenset({"Q2285982", "Q1924906", "Q1957908", "Q190117"})
ENTITY = re.compile(r"^https?://www\.wikidata\.org/entity/(Q[1-9][0-9]{0,13})$")
MAX_ITEMS = 100
MAX_BYTES = 768_000

def sparql(industry_qid: str, offset: int = 0) -> str:
    if industry_qid not in ALLOWED_INDUSTRIES or not isinstance(offset,int) or offset not in (0,100,200,300):
        raise ValueError("Industry or page is not in approved NET-FAST2 cohort")
    return f"""PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT DISTINCT ?item ?website ?label WHERE {{
  ?item wdt:P452 wd:{industry_qid} ;
        wdt:P17 wd:Q38 ;
        wdt:P856 ?website ;
        rdfs:label ?label .
  FILTER(LANG(?label) = "it" || LANG(?label) = "en")
  FILTER NOT EXISTS {{ ?item wdt:P31 wd:Q5 . }}
}}
ORDER BY ?item
LIMIT 100
OFFSET {offset}"""


def parse_bindings(payload: object, industry_qid: str) -> list[dict[str,str]]:
    if industry_qid not in ALLOWED_INDUSTRIES:
        raise ValueError("Unexpected industry")
    if not isinstance(payload,dict) or not isinstance(payload.get("results"),dict):
        raise ValueError("Malformed WDQS response")
    rows=payload["results"].get("bindings")
    if not isinstance(rows,list) or len(rows)>MAX_ITEMS:
        raise ValueError("Unexpected or unbounded response")
    unique: dict[str,dict[str,str]] = {}
    domains: set[str] = set()
    for row in rows:
        if not isinstance(row,dict):
            continue
        def value(field:str) -> str:
            part=row.get(field)
            return part.get("value","") if isinstance(part,dict) and isinstance(part.get("value"),str) else ""
        match=ENTITY.fullmatch(value("item"))
        name=value("label").strip()
        if not match or not 3<=len(name)<=180 or re.search(r"[<>@\x00-\x1f]|https?://",name):
            continue
        # Wikidata labels may have multiple languages; no trust in translated descriptions.
        try:
            canonical=canonicalize_seed_url(value("website"))
            domain=canonical_domain(canonical)
        except (CompanyDiscoveryError,ValueError,TypeError):
            continue
        if canonical.split(":",1)[0]!="https" or not re.fullmatch(r"[a-z0-9][a-z0-9.-]*\.[a-z]{2,24}",domain):
            continue
        if any(domain==bad or domain.endswith("."+bad) for bad in EXCLUDED):
            continue
        if domain in domains:
            continue
        domains.add(domain)
        unique[match.group(1)]={"qid":match.group(1),"label":name,"domain":domain,
          "website":"https://"+domain+"/","industry_qid":industry_qid}
    return list(unique.values())


async def fetch_structured_entities(industry_qid:str, offset:int) -> list[dict[str,str]]:
    query=sparql(industry_qid,offset)
    async with httpx.AsyncClient(timeout=httpx.Timeout(45),follow_redirects=False) as client:
        res=await client.get(SOURCE_URL,params={"query":query,"format":"json"},
             headers={"Accept":"application/sparql-results+json",
                      "Accept-Encoding":"gzip,deflate",
                      "User-Agent":USER_AGENT.replace("DiscoveryPilot","NetFast2Structured")})
    # No retry on HTTP 429/5xx; the next scheduled run happens the next day.
    if res.status_code!=200:
        raise RuntimeError(f"WDQS request failed HTTP {res.status_code}; no retry")
    if len(res.content)>MAX_BYTES:
        raise ValueError("WDQS response exceeds budget")
    return parse_bindings(res.json(),industry_qid)


async def api_rpc(client:httpx.AsyncClient,url:str,key:str,name:str,args:dict) -> dict:
    if name not in {"netfast2_claim_daily_batch","netfast2_commit_daily_batch"}:
        raise ValueError("Unexpected NET-FAST2 RPC")
    res=await client.post(url+"/rest/v1/rpc/"+name,json=args,
      headers={"apikey":key,"Content-Type":"application/json","Accept":"application/json",
               "User-Agent":"SmartSteelSales-NETFAST2/1.0"})
    if res.status_code!=200:
        raise RuntimeError(f"NET-FAST2 Supabase RPC HTTP {res.status_code}")
    body=res.json()
    if not isinstance(body,dict):
        raise RuntimeError("Invalid NET-FAST2 RPC payload")
    return body


async def main() -> dict:
    url,key=credentials_from_environment()
    async with httpx.AsyncClient(timeout=httpx.Timeout(12),follow_redirects=False) as api:
        pre=await api_rpc(api,url,key,"netfast2_claim_daily_batch",{})
        if pre.get("eligible") is not True:
            result={"status":"skipped","reason":pre.get("reason","source_not_enabled"),"published":0}
            print(json.dumps(result,sort_keys=True))
            return result
        industry=pre.get("industry_qid")
        if industry not in ALLOWED_INDUSTRIES or pre.get("max_records")!=MAX_ITEMS:
            raise RuntimeError("Unapproved source budget")
        # 4 segments × 4 windows, deterministic across days, no parallel calls.
        day=datetime.now(timezone.utc).timetuple().tm_yday
        offset=100*((day//4)%4)
        records=await fetch_structured_entities(industry,offset)
        result=await api_rpc(api,url,key,"netfast2_commit_daily_batch",
            {"p_run_id":pre["run_id"],"p_items":records})
        if result.get("status")!="completed" or result.get("published")!=0:
            raise RuntimeError("Unexpected publication or batch outcome")
        report={"status":"completed","industry":industry,"offset":offset,
          "proposed":len(records),"new_discoveries":result["inserted_discovered"],
          "skipped":result["skipped"],"published":0}
        print(json.dumps(report,sort_keys=True))
        return report


if __name__=="__main__":
    asyncio.run(main())
