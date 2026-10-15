"""CRAWL-IT6.10b.4: read-only production acceptance readiness.

Do not impersonate operators, create runs or modify existing leads.
"""
import asyncio
import json
import httpx
from .approved_source_batch import StagingRepository

async def fetch(client, repo, table, fields):
    response = await client.get(
        repo.url + "/rest/v1/" + table + "?select=" + fields + "&limit=100",
        headers={"apikey":repo.key,"Accept":"application/json"},
    )
    if response.status_code != 200:
        raise RuntimeError(f"Read-only acceptance lookup HTTP {response.status_code}")
    records=response.json()
    if not isinstance(records,list): raise RuntimeError("Unexpected records")
    return records

async def run():
    repo=StagingRepository()
    async with httpx.AsyncClient(timeout=12,follow_redirects=False) as client:
        leads=await fetch(client,repo,"network_discovery_domain_leads","id,status,intake_run_id,source_id")
        sources=await fetch(client,repo,"network_discovery_source_registry","id,source_url,governance_status,enabled_for_discovery")
        runs=await fetch(client,repo,"network_company_discovery_runs","id,source_reference,status,governance_status")
    approved={s["id"]:s["source_url"] for s in sources
        if s.get("governance_status")=="approved" and s.get("enabled_for_discovery") is True}
    valid_runs={r["source_reference"] for r in runs
        if r.get("governance_status")=="approved" and r.get("status") in ("running","completed")}
    pending=[x for x in leads if x.get("status")=="pending_review"]
    return {"mode":"READ_ONLY_CANDIDATE_GATE_ACCEPTANCE_PREFLIGHT",
            "pending_leads":len(pending),"linked_pending_leads":sum(bool(x.get("intake_run_id")) for x in pending),
            "leads_with_possible_approved_source_run":sum(approved.get(x.get("source_id")) in valid_runs
                for x in pending if x.get("source_id") in approved),
            "requires_operator_created_approved_run":not any(approved.get(x.get("source_id")) in valid_runs
                for x in pending if x.get("source_id") in approved),
            "supabase_writes":0,"published":0}

if __name__=="__main__":
    print(json.dumps(asyncio.run(run()),indent=2,sort_keys=True))
