"""NET-PROFILE1E: bounded, opt-in batch for approved company website seeds.

The input is an operator-reviewed JSON list, not arbitrary web links from users.
Dry-run default; no public profile publication; all storage is candidate-only.
"""
from __future__ import annotations
import argparse
import asyncio
import json
from pathlib import Path
from uuid import UUID
from urllib.parse import urlsplit
import httpx
from supabase import create_client
import os
from .network_profile_extraction import extract_site
from .network_profile_persistence import prepare_candidates, persist_candidates
from .public_website_preview import normalize_seeds

MAX_BATCH=25
MAX_CONCURRENCY=1

def validated_seeds(raw):
    if not isinstance(raw,list) or not 1<=len(raw)<=MAX_BATCH:
        raise ValueError("batch must contain 1 to 25 manually reviewed company sites")
    seen=set()
    output=[]
    for row in raw:
        if not isinstance(row,dict) or row.get("kind") not in ("canonical","discovered"):
            raise ValueError("missing validated company type")
        uid=str(UUID(row["company_id"]))
        site=normalize_seeds(row["site"])[0]
        domain=urlsplit(site).hostname or ""
        key=(row["kind"],uid)
        if key in seen or not domain:
            raise ValueError("duplicate company or invalid website")
        seen.add(key)
        output.append({"kind":row["kind"],"company_id":uid,"site":site})
    return output

async def run_batch(seeds, *, persist=False, pause_seconds=2, db=None):
    seeds=validated_seeds(seeds)
    if persist and db is None:
        db=create_client(os.environ["SUPABASE_URL"],os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    outcomes=[]
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0),follow_redirects=False) as client:
        for index,row in enumerate(seeds):
            if index:
                await asyncio.sleep(pause_seconds)
            result=await extract_site(client,row["site"])
            candidates=prepare_candidates(result)
            saved=None
            if persist and candidates:
                saved=persist_candidates(db,company_id=row["company_id"],kind=row["kind"],candidates=candidates)
            outcomes.append({"company_id":row["company_id"],"kind":row["kind"],
                "status":result["status"],"pages":result["pages"],
                "candidate_count":len(candidates),"stored_company_evidence_total":saved})
    return {"mode":"candidate_persistence" if persist else "dry_run",
            "processed":len(outcomes),"candidates":sum(x["candidate_count"] for x in outcomes),
            "published":0,"outcomes":outcomes}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--manifest",required=True,help="JSON file with 1–25 operator-reviewed company UUIDs and HTTPS sites")
    parser.add_argument("--persist",action="store_true",help="Explicitly enable worker-service candidate ingestion")
    args=parser.parse_args()
    manifest=json.loads(Path(args.manifest).read_text(encoding="utf8"))
    print(json.dumps(asyncio.run(run_batch(manifest,persist=args.persist)),indent=2))
    return 0

if __name__=="__main__":
    raise SystemExit(main())
