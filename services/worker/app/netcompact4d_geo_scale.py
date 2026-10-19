"""COMPACT4D: dynamic service-only next-25 discovery. Dry-run by default."""
import argparse
import asyncio
import json
import os
from supabase import create_client
from .company_discovery import canonical_domain
from .network_profile_batch import validated_seeds
from .netcompact4b_geo_batch import run_batch, MAX_SITES

def next_batch(db,limit):
    if not 1 <= limit <= MAX_SITES:
        raise ValueError("Invalid bounded size")
    data=db.rpc("netcompact4d_next_discovered_geo_batch",{"p_limit":limit}).execute().data
    if not isinstance(data,dict) or data.get("contract")!="netcompact4d-next-geo-v1":
        raise ValueError("Unexpected source contract")
    raw=data.get("items")
    if not isinstance(raw,list) or len(raw)>limit:
        raise ValueError("Unbounded result")
    entries=validated_seeds(raw)
    domains=set()
    for item,source in zip(entries,raw,strict=True):
        domain=str(source.get("domain") or "").lower().removeprefix("www.")
        if (source.get("kind")!="discovered" or not domain or
            canonical_domain(item["site"])!=domain or domain in domains or
            not source.get("company_name")):
            raise ValueError("Company identity or official domain mismatch")
        item["domain"]=domain
        item["company_name"]=str(source["company_name"])[:180]
        domains.add(domain)
    return entries,int(data.get("eligible",0))

def source_audit(db):
    result=db.rpc("netcompact4d_geo_quality_audit",{"p_limit":50}).execute().data
    if not isinstance(result,dict) or result.get("contract")!="netcompact4d-quality-v1":
        raise ValueError("Unexpected audit contract")
    return result

def main():
    parser=argparse.ArgumentParser(description="Service-only geographic scale and quality")
    parser.add_argument("--max-sites",type=int,default=25)
    parser.add_argument("--persist",action="store_true",help="Explicitly stage nonverified candidates")
    parser.add_argument("--quality-audit",action="store_true")
    args=parser.parse_args()
    if not 1<=args.max_sites<=MAX_SITES or (args.quality_audit and args.persist):
        parser.error("Invalid size or audit write")
    db=create_client(os.environ["SUPABASE_URL"],os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    if args.quality_audit:
        output=source_audit(db)
    else:
        entries,total=next_batch(db,args.max_sites)
        output=asyncio.run(run_batch(entries,persist=args.persist,
                                     max_sites=args.max_sites,db=db))
        output["eligible_before_batch"]=total
        output["selection"]="next_eligible_service_only"
    print(json.dumps(output,ensure_ascii=False,indent=2))

if __name__=="__main__":
    main()
