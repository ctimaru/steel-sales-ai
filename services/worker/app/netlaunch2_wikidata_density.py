"""NET-LAUNCH2: sequential industry-specific Wikidata CC0 company discovery.

Each company requires an Italian Wikidata country (P17), an actual industry
(P452), an official website (P856), and a nonempty Italian or English label.
Every candidate is explicitly unconfirmed. No business websites are fetched.
"""
from __future__ import annotations
import asyncio
import json
import re
import httpx

from .company_discovery import CompanyDiscoveryError, canonical_domain, canonicalize_seed_url
from .github_actions_crawler import credentials_from_environment
from .wikidata_source_discovery import EXCLUDED, SOURCE_URL, USER_AGENT

SECTORS=frozenset(("Q2285982","Q1924906","Q1957908","Q190117"))
ENTITY=re.compile(r"^https?://www[.]wikidata[.]org/entity/(Q[1-9][0-9]{0,13})$")
MAX_PAGE=100
MAX_RESPONSE=850_000

def sparql(sector:str,offset:int)->str:
    if sector not in SECTORS or type(offset)!=int or offset<0 or offset>2000 or offset%100!=0:
        raise ValueError("Unknown industry or invalid controlled paging")
    return f"""PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT DISTINCT ?item ?website ?label WHERE {{
 ?item wdt:P17 wd:Q38 ; wdt:P452 wd:{sector} ; wdt:P856 ?website ; rdfs:label ?label .
 FILTER(LANG(?label) = "it" || LANG(?label) = "en")
 FILTER NOT EXISTS {{ ?item wdt:P31 wd:Q5 . }}
}}
ORDER BY ?item
LIMIT 100
OFFSET {offset}"""

def parse_bindings(payload:object,sector:str)->tuple[list[dict[str,str]],int]:
    if sector not in SECTORS or not isinstance(payload,dict):
        raise ValueError("Unexpected Wikidata industry or response")
    rows=payload.get("results",{}).get("bindings") if isinstance(payload.get("results"),dict) else None
    if not isinstance(rows,list) or len(rows)>MAX_PAGE:
        raise ValueError("Invalid or over-budget Wikidata result")
    seen_id:set[str]=set()
    seen_domain:set[str]=set()
    out:list[dict[str,str]]=[]
    for row in rows:
        if not isinstance(row,dict):continue
        def field(k:str)->str:
            v=row.get(k)
            return v.get("value","") if isinstance(v,dict) and isinstance(v.get("value"),str) else ""
        match=ENTITY.fullmatch(field("item"))
        if not match: continue
        name=field("label").strip()
        if not 3<=len(name)<=180 or re.search(r"[<>@\x00-\x1f]|https?://",name):continue
        try:
            canonical=canonicalize_seed_url(field("website"))
            domain=canonical_domain(canonical)
        except (CompanyDiscoveryError,ValueError,TypeError):
            continue
        if (not canonical.startswith("https://") or
            not re.fullmatch(r"[a-z0-9][a-z0-9.-]*\.[a-z]{2,24}",domain) or
            any(domain==bad or domain.endswith("."+bad) for bad in EXCLUDED)):
            continue
        qid=match.group(1)
        if qid in seen_id or domain in seen_domain:continue
        seen_id.add(qid);seen_domain.add(domain)
        out.append({"qid":qid,"label":name,"domain":domain,
                    "website":"https://"+domain+"/","industry_qid":sector})
    return out,len(rows)

async def rpc(client:httpx.AsyncClient,url:str,key:str,name:str,args:dict)->dict:
    if name not in {"netlaunch2_claim_daily","netlaunch2_commit_daily"}:
        raise ValueError("Unknown NET-LAUNCH2 worker action")
    res=await client.post(url+"/rest/v1/rpc/"+name,json=args,
      headers={"apikey":key,"Content-Type":"application/json",
               "Accept":"application/json","User-Agent":"SmartSteelSales-NETLAUNCH2/1.0"})
    if res.status_code!=200:
        raise RuntimeError(f"NET-LAUNCH2 RPC {name}: HTTP {res.status_code}")
    body=res.json()
    if not isinstance(body,dict):raise RuntimeError("Unexpected RPC payload")
    return body

async def fetch_sector(client:httpx.AsyncClient,sector:str,offset:int)->tuple[list[dict[str,str]],int]:
    response=await client.get(SOURCE_URL,
        params={"query":sparql(sector,offset),"format":"json"},
        headers={"Accept":"application/sparql-results+json",
                 "Accept-Encoding":"gzip,deflate",
                 "User-Agent":USER_AGENT.replace("DiscoveryPilot","NetworkLaunch2")})
    # Do not retry or hammer a throttled WDQS endpoint.
    if response.status_code!=200:raise RuntimeError(f"Wikidata HTTP {response.status_code}")
    if len(response.content)>MAX_RESPONSE:raise ValueError("Wikidata response exceeds size cap")
    return parse_bindings(response.json(),sector)

async def main()->dict:
    url,key=credentials_from_environment()
    async with httpx.AsyncClient(timeout=httpx.Timeout(15),follow_redirects=False) as api:
        claim=await rpc(api,url,key,"netlaunch2_claim_daily",{})
        if claim.get("eligible") is not True:
            report={"status":"skipped","reason":claim.get("reason","source_disabled"),
                    "new_unconfirmed":0,"published":0}
            print(json.dumps(report,sort_keys=True));return report
        sectors=claim.get("industries")
        offsets=claim.get("offsets")
        if (not isinstance(sectors,list) or len(sectors)!=2 or len(set(sectors))!=2
            or any(s not in SECTORS for s in sectors) or not isinstance(offsets,dict)
            or claim.get("page_size")!=100 or claim.get("max_records")!=200):
            raise RuntimeError("Unexpected sourced industry limits")
        rows:list[dict[str,str]]=[]
        counts:dict[str,int]={}
        async with httpx.AsyncClient(timeout=httpx.Timeout(50),follow_redirects=False) as wd:
            for i,sector in enumerate(sectors):
                offset=offsets.get(sector)
                if not isinstance(offset,int) or offset<0 or offset>2000 or offset%100:
                    raise RuntimeError("Unauthorized source page offset")
                if i:await asyncio.sleep(8)
                company_rows,raw_count=await fetch_sector(wd,sector,offset)
                counts[sector]=raw_count
                rows+=company_rows
        async with httpx.AsyncClient(timeout=httpx.Timeout(15),follow_redirects=False) as api:
            saved=await rpc(api,url,key,"netlaunch2_commit_daily",
                 {"p_run_id":claim["run_id"],"p_items":rows,"p_counts":counts})
        if saved.get("status")!="completed" or saved.get("canonical_published")!=0:
            raise RuntimeError("Invalid NET-LAUNCH2 response, no verified publication permitted")
        report={"status":"completed","industries":sectors,"offsets":offsets,
                "queried":saved.get("queried"),"accepted":saved.get("accepted"),
                "new_unconfirmed":saved.get("new_unconfirmed"),
                "duplicates":saved.get("duplicate_or_rejected"),"published":0}
        print(json.dumps(report,sort_keys=True))
        return report

if __name__=="__main__":
    asyncio.run(main())
