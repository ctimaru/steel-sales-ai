"""TRADER1D.3B.2 — live, service-only EU trader source health observations.

The official source URLs are selected from CURRENT private Supabase research, not
from a stale GitHub seed file. No site body harvesting, legal/source rights
assessment, company publishing, contacts, RFQ, or human verification.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone, date
import json
import math
import re

import httpx

from .company_discovery import CompanyDiscoveryError, canonicalize_seed_url, canonical_domain
from .github_actions_crawler import credentials_from_environment
from .public_website_preview import BLOCKED
from .trader1d3b_source_refresh import DELAY_SECONDS, inspect_source

BATCH_SIZE = 5
MAX_TOTAL = 2000
CONTRACT = "trader1d3b2-source-batch-v1"
COMMIT_CONTRACT = "trader1d3b2-commit-v1"
KINDS = frozenset(("role_evidence", "product_evidence"))
START = date(2026, 10, 20)


def validate_items(data: object, *, expected_offset: int) -> tuple[int, list[dict[str, str]]]:
    if not isinstance(data, dict) or data.get("contract") != CONTRACT:
        raise ValueError("Unrecognized live source contract")
    total = data.get("total")
    if not isinstance(total, int) or isinstance(total, bool) or not 1 <= total <= MAX_TOTAL:
        raise ValueError("Live source count unavailable or out of bounds")
    if data.get("limit") != BATCH_SIZE or data.get("offset") != expected_offset:
        raise ValueError("Live source pagination mismatch")
    incoming = data.get("items")
    if not isinstance(incoming, list) or len(incoming) > BATCH_SIZE:
        raise ValueError("Invalid bounded live source page")
    if len(incoming) != min(BATCH_SIZE, max(0, total-expected_offset)):
        raise ValueError("Source page changed during batch; skip rather than cross-wire URLs")
    clean = []
    unique = set()
    for row in incoming:
        if not isinstance(row, dict):
            raise ValueError("Malformed source row")
        domain = row.get("domain")
        url = row.get("source_url")
        kind = row.get("source_kind")
        rid = row.get("research_id")
        market = row.get("market")
        if not all(isinstance(v, str) for v in (domain, url, kind, rid, market)):
            raise ValueError("Missing required sourced metadata")
        if not re.fullmatch(r"[0-9a-f]{8}-[0-9a-f-]{27,36}", rid, flags=re.I):
            raise ValueError("Malformed live research identifier")
        if kind not in KINDS or not re.fullmatch(r"[A-Z]{2}", market):
            raise ValueError("Invalid source scope")
        normalized = canonicalize_seed_url(url)
        if (url != normalized or len(url) > 500 or not url.startswith("https://")
            or canonical_domain(url) != domain
            or any(domain == blocked or domain.endswith("."+blocked) for blocked in BLOCKED)):
            raise ValueError("Unsafe or non-first-party source")
        key = (rid, kind)
        if key in unique:
            raise ValueError("Duplicate research source in one batch")
        unique.add(key)
        clean.append({"research_id": rid, "domain": domain, "market": market,
                      "source_kind": kind, "source_url": normalized})
    return total, clean


async def service_rpc(
    client: httpx.AsyncClient, url: str, key: str, name: str, args: dict,
) -> dict:
    if name not in {"trader1d3b2_source_batch", "trader1d3b2_commit_observations"}:
        raise ValueError("Unapproved service method")
    response = await client.post(
        f"{url}/rest/v1/rpc/{name}", json=args,
        headers={"apikey": key, "Accept": "application/json",
                 "Content-Type": "application/json", "User-Agent": "SmartSteelSales-TRADER1D3B2/1.0"},
    )
    # No logged header/body, even on failure (may contain request metadata).
    if response.status_code != 200:
        raise RuntimeError(f"TRADER1D.3B.2 RPC unavailable: HTTP {response.status_code}")
    value = response.json()
    if not isinstance(value, dict):
        raise ValueError("Unexpected Supabase RPC response")
    return value


def utc_rotation(day: date, total: int) -> int:
    if not 1 <= total <= MAX_TOTAL:
        raise ValueError("Invalid source inventory size")
    pages = math.ceil(total / BATCH_SIZE)
    return (day - START).days % pages


async def run(
    *, day: date | None = None, delay: float = DELAY_SECONDS,
    api_client: httpx.AsyncClient | None = None,
    source_client: httpx.AsyncClient | None = None,
    credentials: tuple[str, str] | None = None,
) -> dict[str, object]:
    base, key = credentials or credentials_from_environment()
    today = day or datetime.now(timezone.utc).date()
    own_api = api_client is None
    own_source = source_client is None
    if api_client is None:
        api_client = httpx.AsyncClient(timeout=httpx.Timeout(12), follow_redirects=False,
                                       trust_env=False)
    if source_client is None:
        source_client = httpx.AsyncClient(timeout=httpx.Timeout(12), follow_redirects=False,
                                          trust_env=False)
    try:
        initial = await service_rpc(api_client, base, key, "trader1d3b2_source_batch",
                                    {"p_limit": BATCH_SIZE, "p_offset": 0})
        total, batch = validate_items(initial, expected_offset=0)
        slot = utc_rotation(today, total)
        offset = slot * BATCH_SIZE
        if offset != 0:
            page = await service_rpc(api_client, base, key, "trader1d3b2_source_batch",
                                      {"p_limit": BATCH_SIZE, "p_offset": offset})
            total_now, batch = validate_items(page, expected_offset=offset)
            if total_now != total:
                raise RuntimeError("Live source inventory changed during current rotation")
        results = []
        for i, item in enumerate(batch):
            outcome = await inspect_source(source_client, item)
            results.append({
                "research_id": item["research_id"], "source_kind": item["source_kind"],
                "source_url": item["source_url"],
                "checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "status": outcome["status"], "http_status": outcome["http_status"],
                "content_type": outcome["content_type"],
                "fingerprint": outcome["fingerprint"],
            })
            if i + 1 < len(batch) and delay:
                await asyncio.sleep(delay)
        # One atomic, fully validated commit; DB rejects stale or changed URL and
        # same-day duplicate inserts. No human / published Network mutations.
        if not results:
            raise RuntimeError("Empty rotating source batch")
        outcome = await service_rpc(api_client, base, key,
                                    "trader1d3b2_commit_observations", {"p_items": results})
        if (outcome.get("contract") != COMMIT_CONTRACT
            or outcome.get("published") != 0 or outcome.get("rights_updated") != 0
            or not isinstance(outcome.get("inserted"), int)
            or not isinstance(outcome.get("duplicate_day"), int)
            or outcome["inserted"] + outcome["duplicate_day"] != len(results)):
            raise RuntimeError("Unexpected source storage response — fail closed")
        summary = {
            "contract": "trader1d3b2-live-refresh-report-v1",
            "date_utc": today.isoformat(), "total_live_sources": total,
            "batch_slot": slot, "selected": len(batch),
            "recorded": outcome["inserted"], "duplicate_day": outcome["duplicate_day"],
            "reachable_head": sum(
                item["status"] in ("reachable_html","reachable_unknown_type") for item in results),
            "published": 0, "source_rights_updated": 0, "manual_decisions": 0,
            "company_content_downloaded": False,
        }
        return summary
    finally:
        if own_source:
            await source_client.aclose()
        if own_api:
            await api_client.aclose()


if __name__ == "__main__":
    print(json.dumps(asyncio.run(run()), sort_keys=True))
