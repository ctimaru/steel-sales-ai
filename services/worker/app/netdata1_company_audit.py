"""NET-UX DATA1: bounded, service-only audit across all Network profile types.

Scan never means identity verification. Each item is sourced to a candidate official
HTTPS domain; duplicate-domain and missing-site records are excluded from scans
and retained as explicit review gaps. No automatic publication or entity claims.
"""
from __future__ import annotations
import argparse
import asyncio
import json
import os
from supabase import create_client
from .network_profile_batch import run_batch, MAX_BATCH, validated_seeds

CONTRACT="netux-data1-audit-v1"
MAX_OFFSET=10000

def page(db,*,limit=25,offset=0):
    if not 1 <= limit <= MAX_BATCH or not 0 <= offset <= MAX_OFFSET:
        raise ValueError("Invalid bounded page")
    data=db.rpc("netdata1_company_audit",{
        "p_limit":limit,"p_offset":offset,
    }).execute().data
    if not isinstance(data,dict) or data.get("contract")!=CONTRACT:
        raise ValueError("Unexpected full-Network audit contract")
    items=data.get("items")
    if not isinstance(items,list) or len(items)>limit:
        raise ValueError("Unexpected or unbounded audit page")
    candidates=[]
    domains=set()
    for row in items:
        if not isinstance(row,dict):raise ValueError("Malformed company audit row")
        site=row.get("site")
        if site is None:
            continue  # Still counted as identity/source gap in full snapshot.
        if row.get("source_identity_status")!="site_domain_matches_unconfirmed_identity":
            raise ValueError("Unreviewed official source status")
        entries=validated_seeds([{
            "kind":row["kind"],"company_id":row["company_id"],"site":site,
        }])
        item=entries[0]
        from urllib.parse import urlsplit
        host=(urlsplit(item["site"]).hostname or "").lower().removeprefix("www.")
        if not host or host!=str(row["domain"]).lower() or host in domains:
            raise ValueError("Potential shared/impersonated corporate domain")
        domains.add(host)
        candidates.append(item)
    return data,candidates

def main():
    parser=argparse.ArgumentParser(description="NET-UX DATA1 official-source audit and evidence scan")
    parser.add_argument("--offset",type=int,default=0,
                        help="0-based stable profile page offset; iterate 0,25,...,500")
    parser.add_argument("--limit",type=int,default=25)
    parser.add_argument("--scan",action="store_true",help="Fetch reviewed same-domain sources")
    parser.add_argument("--persist",action="store_true",
                        help="Explicit candidate-only staging; requires --scan")
    args=parser.parse_args()
    if not 1<=args.limit<=MAX_BATCH or not 0<=args.offset<=MAX_OFFSET or (args.persist and not args.scan):
        parser.error("Invalid bounded page or stage-without-scan")
    db=create_client(os.environ["SUPABASE_URL"],os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    snapshot,entries=page(db,limit=args.limit,offset=args.offset)
    output={
        "contract":CONTRACT,
        "profile_count":snapshot["profiles_total"],
        "canonical_published":snapshot["canonical_published"],
        "discovered":snapshot["discovered"],
        "geographic_source_coverage":snapshot["geographic_source_coverage"],
        "geographic_published":snapshot["geographic_published"],
        "geographic_candidate_only":snapshot["geographic_candidate_only"],
        "capability_published":snapshot["capability_published"],
        "technical_evidence_profiles":snapshot["technical_evidence_profiles"],
        "matching_https_domains":snapshot["official_site_candidate"],
        "shared_or_duplicate_domains":snapshot["shared_or_duplicate_domain"],
        "not_scan_ready":snapshot["not_scan_ready"],
        "offset":args.offset,"page_size":len(snapshot["items"]),
        "scan_candidates":len(entries),
        "scan_excluded":len(snapshot["items"])-len(entries),
        "mode":"audit_only",
        "published":0,"verified":0,
    }
    if args.scan and entries:
        result=asyncio.run(run_batch(entries,persist=args.persist,
                                     pause_seconds=2,db=db if args.persist else None))
        output["mode"]="candidate_staging" if args.persist else "site_scan_dry_run"
        output["processed"]=result["processed"]
        output["extracted_candidates"]=result["candidates"]
        output["outcomes"]=result["outcomes"]  # status & count only, no excerpts.
    print(json.dumps(output,ensure_ascii=False,indent=2))

if __name__=="__main__":
    main()
