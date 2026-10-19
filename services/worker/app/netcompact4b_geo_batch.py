"""COMPACT4B: 25 official sites, candidate-only geographic evidence; dry-run default."""
from __future__ import annotations
import argparse
import asyncio
import json
import os
import re
from pathlib import Path
from urllib.parse import urljoin, urlsplit
from uuid import UUID
import httpx
from supabase import create_client
from .company_discovery import (
    CompanyDiscoveryError, _fetch_page, _structured_facilities, _walk_structured_nodes,
    canonical_domain, canonicalize_seed_url,
)
from .network_profile_batch import validated_seeds

MAX_SITES=25
CONTACT_HINTS=("contatt","contact","dove-siamo","where-we-are","sedi","locations")
ADDRESS_RE=re.compile(r"\b\d{5}\s+([A-ZÀ-Ý][a-zA-ZÀ-ÿ'’ -]{2,44}?)\s*\(([A-Z]{2})\)",re.I)

def read_manifest(path:Path)->list[dict]:
    raw=json.loads(path.read_text(encoding="utf8"))
    entries=validated_seeds(raw)
    domains=set()
    for original,entry in zip(raw,entries,strict=True):
        domain=str(original.get("domain") or "").lower().removeprefix("www.")
        if not domain or canonical_domain(entry["site"])!=domain or domain in domains:
            raise ValueError("Duplicate or unbound official company site")
        if not original.get("company_name"):
            raise ValueError("Company label missing")
        domains.add(domain)
        entry.update(domain=domain,company_name=str(original["company_name"])[:180])
    return entries

def contact_links(home,domain):
    found=[]
    for href in home.links:
        try:
            url=canonicalize_seed_url(urljoin(home.url,href))
            if canonical_domain(url)!=domain or not any(h in urlsplit(url).path.lower() for h in CONTACT_HINTS):
                continue
            if url not in found:found.append(url)
        except (ValueError,CompanyDiscoveryError):continue
    return found[:2]

def page_candidates(page):
    result=[]
    for facility in _structured_facilities([page],"IT"):
        city=str(facility.get("city") or "").strip()
        province=str(facility.get("province_code") or "").upper()
        if not city or not re.fullmatch(r"[A-Z]{2}",province):continue
        for root in page.structured_data:
            for node in _walk_structured_nodes(root):
                addr=node.get("address")
                if (isinstance(addr,dict) and
                    str(addr.get("addressLocality") or "").casefold()==city.casefold() and
                    str(addr.get("addressRegion") or "").upper()==province):
                    quote=json.dumps(addr,ensure_ascii=False)[:900]
                    result.append(dict(city=city,province_code=province,source_url=page.url,excerpt=quote))
                    break
    for match in ADDRESS_RE.finditer(page.text):
        city=" ".join(match.group(1).split()).strip(" ,.-")
        province=match.group(2).upper()
        quote=" ".join(page.text[max(0,match.start()-60):match.end()+65].split())
        quote=re.sub(r"[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}","[contact omitted]",quote,flags=re.I)
        if 20<=len(quote)<=1000 and city.casefold() in quote.casefold():
            result.append(dict(city=city,province_code=province,source_url=page.url,excerpt=quote))
    return result

async def examine(client,item):
    domain=item["domain"]
    home=await _fetch_page(client,item["site"],item["site"])
    if not home or canonical_domain(home.url)!=domain:
        return dict(status="blocked_or_unavailable",pages=0,candidate=None)
    pages=[home]
    for url in contact_links(home,domain):
        try:
            page=await _fetch_page(client,url,item["site"])
            if page and canonical_domain(page.url)==domain:pages.append(page)
        except (httpx.HTTPError,CompanyDiscoveryError,ValueError):pass
    candidates=[c for page in pages[:3] for c in page_candidates(page)]
    unique={(c["city"].casefold(),c["province_code"]) for c in candidates}
    if len(unique)>1:return dict(status="multiple_localities_manual_review",pages=len(pages),candidate=None)
    if not candidates:return dict(status="no_explicit_city_province",pages=len(pages),candidate=None)
    return dict(status="sourced_candidate",pages=len(pages),candidate=candidates[0])

def stage(db,item,c):
    common=dict(p_source_url=c["source_url"],p_city=c["city"],p_province_code=c["province_code"],p_excerpt=c["excerpt"])
    if item["kind"]=="canonical":
        return db.rpc("netcompact4b_stage_canonical_geo",dict(common,p_company_id=item["company_id"])).execute().data
    return db.rpc("neteima2_stage_provisional_geo",dict(common,p_target_id=item["company_id"])).execute().data

async def run_batch(entries,*,persist=False,max_sites=25,pause=2,db=None):
    if not 1<=max_sites<=MAX_SITES or len(entries)>MAX_SITES:raise ValueError("Batch limit exceeded")
    if persist and db is None:db=create_client(os.environ["SUPABASE_URL"],os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    results=[]
    async with httpx.AsyncClient(timeout=httpx.Timeout(10),follow_redirects=False) as client:
        for i,item in enumerate(entries[:max_sites]):
            if i:await asyncio.sleep(pause)
            try:r=await examine(client,item)
            except (httpx.HTTPError,CompanyDiscoveryError,ValueError):
                r=dict(status="blocked_or_unavailable",pages=0,candidate=None)
            row=dict(company_id=item["company_id"],name=item["company_name"],kind=item["kind"],
                     status=r["status"],pages=r["pages"],staged=False)
            if r["candidate"]:
                c=r["candidate"]
                row.update(city=c["city"],province=c["province_code"],source_url=c["source_url"])
                if persist:
                    try:
                        out=stage(db,item,c)
                        row["persistence_status"]=out.get("status") if isinstance(out,dict) else "invalid"
                        row["staged"]=bool(isinstance(out,dict) and
                            (out.get("staged") or out.get("status")=="staged_or_existing"))
                    except Exception:row["persistence_status"]="rejected_or_unavailable"
            results.append(row)
    return dict(contract="netcompact4b-v1",mode="candidate_persistence" if persist else "dry_run",
        sites=len(results),candidates=sum("city" in x for x in results),
        staged_or_existing=sum(x["staged"] for x in results),published_facilities=0,outcomes=results)

def main():
    parser=argparse.ArgumentParser(description="25 website first-party city/province pilot")
    parser.add_argument("--manifest",required=True)
    parser.add_argument("--max-sites",type=int,default=25)
    parser.add_argument("--persist",action="store_true")
    args=parser.parse_args()
    rows=read_manifest(Path(args.manifest))
    print(json.dumps(asyncio.run(run_batch(rows,persist=args.persist,max_sites=args.max_sites)),
                     ensure_ascii=False,indent=2))

if __name__=="__main__":main()
