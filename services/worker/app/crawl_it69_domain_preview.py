"""CRAWL-IT6.9 — preview websites already discovered from approved sources.

No publication, contact scraping, database mutations or unlicensed directory crawling.
"""
from __future__ import annotations
import asyncio
import json
import httpx
from urllib.parse import quote
from .approved_source_batch import StagingRepository
from .public_website_preview import preview_site, normalize_seeds

MAX_CANDIDATES = 10

async def eligible_urls(client: httpx.AsyncClient, repo: StagingRepository) -> list[str]:
    # Data API embedded source join verifies review and rights before touching each website.
    # No proposed source URL is used as a target.
    fields = (
        "proposed_url,network_discovery_source_registry!inner("
        "governance_status,enabled_for_discovery,terms_status,"
        "database_rights_status,personal_data_policy,reviewed_at,reviewed_by,rights_evidence_url)"
    )
    path = ("/rest/v1/network_discovery_domain_leads?status=eq.pending_review"
            "&country_code=eq.IT&order=created_at.asc&limit=40&select=" + quote(fields,safe=",()!"))
    resp = await client.get(repo.url + path, headers={"apikey": repo.key, "Accept": "application/json"})
    if resp.status_code != 200:
        raise RuntimeError(f"Approved lead lookup returned HTTP {resp.status_code}")
    rows = resp.json()
    if not isinstance(rows,list):
        raise RuntimeError("Unexpected lead lookup")
    urls=[]
    for row in rows:
        source=row.get("network_discovery_source_registry")
        if not isinstance(source,dict) or not (
            source.get("governance_status")=="approved"
            and source.get("enabled_for_discovery") is True
            and source.get("terms_status") in ("allows_reuse","allows_limited_reuse")
            and source.get("database_rights_status") in ("low_risk","licensed")
            and source.get("personal_data_policy") in ("company_data_only","exclude_personal_data")
            and source.get("reviewed_at") and source.get("reviewed_by")
            and source.get("rights_evidence_url")
        ):
            continue
        raw=row.get("proposed_url")
        if not isinstance(raw,str):
            continue
        try:
            url=normalize_seeds(raw)[0]
        except (ValueError,RuntimeError,TypeError):
            continue
        if url not in urls:
            urls.append(url)
        if len(urls)>=MAX_CANDIDATES:
            break
    return urls

async def run() -> dict[str,object]:
    repo=StagingRepository()
    async with httpx.AsyncClient(timeout=httpx.Timeout(10),follow_redirects=False) as client:
        urls=await eligible_urls(client,repo)
        outcomes=[]
        for i,url in enumerate(urls,1):
            result=await preview_site(client,url)
            outcomes.append({"candidate_index":i, **result})
            if i<len(urls):
                await asyncio.sleep(2)
    return {"mode":"READ_ONLY_APPROVED_DOMAIN_ENRICHMENT","reviewed_source_sites":len(urls),
            "outcomes":outcomes,"supabase_writes":0,"published":0,"contacts_collected":0}

if __name__=="__main__":
    print(json.dumps(asyncio.run(run()),sort_keys=True,indent=2))
