"""Credential and source eligibility preflight; no writes or source claims."""
from __future__ import annotations
import asyncio
import json
import httpx
from .approved_source_batch import StagingRepository

async def run() -> dict[str, object]:
    repo = StagingRepository()
    async with httpx.AsyncClient(timeout=httpx.Timeout(12), follow_redirects=False) as client:
        response = await client.post(
            repo.url + "/rest/v1/rpc/crawl_it65b_source_preflight",
            headers={"apikey": repo.key, "Accept": "application/json",
                     "Content-Type": "application/json"},
            json={},
        )
    if response.status_code != 200:
        raise RuntimeError(f"Read-only Supabase source preflight returned HTTP {response.status_code}")
    result = response.json()
    if not isinstance(result, dict) or not isinstance(result.get("eligible"), bool):
        raise RuntimeError("Unexpected source preflight response")
    return {"mode": "READ_ONLY_PREFLIGHT", "credentials_valid": True,
            "source_eligible_now": result["eligible"],
            "source_reason": result.get("reason"),
            "next_due_at": result.get("next_due_at"),
            "supabase_writes": 0, "published": 0}

if __name__ == "__main__":
    print(json.dumps(asyncio.run(run()), indent=2, sort_keys=True))
