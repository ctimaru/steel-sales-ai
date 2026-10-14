"""CRAWL-IT6.5b — secret-isolated GitHub Actions, one-source weekly staging.

This runner is intentionally NOT the Railway worker. It never opens company
websites or publishes company profiles. Only the Supabase RPC commits leads.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
from urllib.parse import urlsplit

import httpx

from .wikidata_source_discovery import (
    MAX_RESULTS,
    preview_wikidata_steel_italy,
)

EXPECTED_SUPABASE_HOST = "ecrafjdummcdfycznitx.supabase.co"
MAX_DOMAINS = 5


def credentials_from_environment() -> tuple[str, str]:
    url = os.getenv("CRAWL_IT65B_SUPABASE_URL", "").strip().rstrip("/")
    key = os.getenv("CRAWL_IT65B_SUPABASE_SECRET_KEY", "").strip()
    parsed = urlsplit(url)
    if (parsed.scheme != "https" or parsed.hostname != EXPECTED_SUPABASE_HOST
            or parsed.username or parsed.password or parsed.port
            or parsed.path not in ("", "/") or parsed.query or parsed.fragment):
        raise ValueError("Crawler is not configured for the approved Supabase project")
    # New scoped-per-component API key. Never pass sb_secret as Bearer JWT.
    if not key.startswith("sb_secret_") or len(key) < 32:
        raise ValueError("Dedicated Supabase secret key required; do not use a publishable key")
    return url, key


async def rpc(name: str, payload: dict[str, object], url: str, key: str) -> dict[str, object]:
    if name not in ("crawl_it65b_source_preflight", "crawl_it65b_commit_wikidata_leads"):
        raise ValueError("Unexpected RPC")
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(10.0), follow_redirects=False
    ) as client:
        response = await client.post(
            f"{url}/rest/v1/rpc/{name}",
            headers={
                "apikey": key,  # Supabase sb_secret keys are NOT bearer JWTs.
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "SmartSteelSales-GitHubCrawler/1.0",
            },
            json=payload,
        )
    # Do not echo response bodies or header values: failed upstream calls
    # could return request metadata or other sensitive diagnostic content.
    if response.status_code != 200:
        raise RuntimeError(f"Approved-source RPC {name} returned HTTP {response.status_code}")
    value = response.json()
    if not isinstance(value, dict):
        raise RuntimeError("Unexpected Supabase RPC result format")
    return value


async def run_stage() -> dict[str, object]:
    url, key = credentials_from_environment()
    state = await rpc("crawl_it65b_source_preflight", {}, url, key)
    if state.get("eligible") is not True:
        return {
            "mode": "stage", "status": "skipped",
            "reason": str(state.get("reason", "not_eligible")),
            "next_due_at": state.get("next_due_at"),
            "wikidata_requests": 0, "inserted": 0, "published": 0,
        }
    budget = state.get("max_domains")
    if not isinstance(budget, int) or budget < 1 or budget > MAX_DOMAINS:
        raise RuntimeError("Database source budget exceeds approved cap")
    # Only this one official SPARQL request; only CC0 company website Q evidence.
    leads = await preview_wikidata_steel_italy(limit=budget)
    if len(leads) > budget:
        raise RuntimeError("Public source query exceeded approved limit")
    items = [
        {"domain": domain, "website": website, "evidence": evidence}
        for domain, website, evidence in leads
    ]
    result = await rpc(
        "crawl_it65b_commit_wikidata_leads", {"p_items": items}, url, key
    )
    if (result.get("published") != 0
            or result.get("status") != "staged_for_human_review"
            or not isinstance(result.get("inserted"), int)
            or result["inserted"] > budget):
        raise RuntimeError("Unexpected ingestion outcome — operator audit required")
    return {
        "mode": "stage", "status": "completed",
        "source": "wikidata_cc0", "wikidata_requests": 1,
        "budget": budget, "proposed": len(leads),
        "inserted": result["inserted"],
        "existing_leads": result.get("existing_leads", 0),
        "existing_network": result.get("existing_network", 0),
        "existing_candidates": result.get("existing_candidates", 0),
        "next_due_at": result.get("next_due_at"),
        "published": 0,
    }


async def run_preview(limit: int) -> dict[str, object]:
    if not isinstance(limit, int) or not 1 <= limit <= MAX_DOMAINS:
        raise ValueError("Preview limit must be 1–5")
    leads = await preview_wikidata_steel_italy(limit=limit)
    return {
        "mode": "preview", "status": "completed", "source": "wikidata_cc0",
        "budget": limit, "wikidata_requests": 1, "unique_proposals": len(leads),
        "proposals": [
            {"domain": domain, "website": website, "evidence": evidence}
            for domain, website, evidence in leads
        ],
        "inserted": 0, "published": 0,
    }


async def main() -> int:
    parser = argparse.ArgumentParser(description="Governed GitHub Actions Wikidata runner")
    parser.add_argument("--mode", choices=("preview", "stage"), required=True)
    parser.add_argument("--limit", type=int, default=MAX_DOMAINS)
    args = parser.parse_args()
    if args.mode == "stage":
        if os.getenv("CRAWL_IT65B_ENABLED", "").lower() != "true":
            raise RuntimeError("CRAWL_IT65B_ENABLED is not true: staging disabled")
        report = await run_stage()
    else:
        report = await run_preview(args.limit)
    print(json.dumps(report, indent=2, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
