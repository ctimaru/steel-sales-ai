"""Read-only multi-source readiness; no rights or status modifications."""
import asyncio
import json
import httpx
from .approved_source_batch import StagingRepository

async def run():
    repo = StagingRepository()
    url = repo.url + "/rest/v1/network_discovery_source_registry?select=governance_status,enabled_for_discovery,terms_status,database_rights_status,personal_data_policy,reviewed_at,reviewed_by,rights_evidence_url,max_domains_per_run"
    async with httpx.AsyncClient(timeout=12, follow_redirects=False) as client:
        response = await client.get(url, headers={"apikey": repo.key})
    if response.status_code != 200:
        raise RuntimeError(f"Source readiness returned HTTP {response.status_code}")
    rows = response.json()
    if not isinstance(rows, list) or len(rows)>1000:
        raise RuntimeError("Invalid registry response")
    eligible = [r for r in rows if r.get("enabled_for_discovery") is True
        and r.get("governance_status") == "approved"
        and r.get("terms_status") in ("allows_reuse","allows_limited_reuse")
        and r.get("database_rights_status") in ("low_risk","licensed")
        and r.get("personal_data_policy") in ("company_data_only","exclude_personal_data")
        and r.get("reviewed_at") and r.get("reviewed_by") and r.get("rights_evidence_url")]
    return {"mode":"READ_ONLY_SOURCE_INVENTORY", "registered_sources":len(rows),
        "rights_approved_enabled":len(eligible),
        "max_proposed_leads_per_cycle":sum(min(20,int(r["max_domains_per_run"])) for r in eligible),
        "db_writes":0,"published":0}

if __name__ == "__main__":
    print(json.dumps(asyncio.run(run()),indent=2))
