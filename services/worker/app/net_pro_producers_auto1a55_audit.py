"""AUTO1.A.5.5 — SHA-verified, read-only quality audit of first-level HTML.

Manual only, NEVER the 20-minute producer cron:
    python -m app.net_pro_producers_auto1 --audit-a55 --sample 8

The service-only RPC selects current, canonical and already-processed producer
product-page snapshots (max 12, max 2/host). This runner re-fetches under the
existing HTTPS/DNS/robots/512KB safeguards, refuses to attribute a category
unless the FULL HTML byte SHA equals the saved one, and emits ONLY aggregate
layout counters. No DB writes, no PDF fetch, no source text in logs, no SKU.
"""
from __future__ import annotations

import asyncio
from collections import Counter
import os
import re
from urllib.parse import urlsplit
from uuid import UUID

import httpx

from .net_pro_producers_auto1 import (
    db_rpc, fetch_official_page, safe_official_url,
)
from .net_pro_producers_auto1a54 import LAYOUT_CATEGORIES

MAX_AUDIT_SAMPLE = 12
HEX_SHA256 = re.compile(r"^[0-9a-f]{64}$")
KNOWN_OUTCOMES = frozenset({"processed", "failed", "blocked", "unchanged"})
SAMPLE_CONTRACT = "netproducers-auto1a55-product-audit-sample-v1"


def validate_sample(payload: object, limit: int) -> list[dict]:
    """Fail closed on malformed, duplicated, off-host or oversized RPC data."""
    if not 1 <= limit <= MAX_AUDIT_SAMPLE:
        raise ValueError("A5.5 audit sample must be 1..12")
    if not isinstance(payload, dict) or payload.get("contract") != SAMPLE_CONTRACT:
        raise ValueError("Unexpected A5.5 audit sample contract")
    items = payload.get("items")
    if (not isinstance(items, list) or len(items) > limit
            or type(payload.get("count")) is not int
            or payload["count"] != len(items)):
        raise ValueError("Invalid A5.5 audit sample count")
    seen_ids, seen_urls = set(), set()
    per_host = Counter()
    for row in items:
        if not isinstance(row, dict):
            raise ValueError("Invalid A5.5 sampled product page")
        try:
            page_id = str(UUID(row["page_id"]))
        except (ValueError, TypeError, KeyError, AttributeError) as exc:
            raise ValueError("Invalid A5.5 page identity") from exc
        url = row.get("source_url")
        canonical_domain = row.get("canonical_domain")
        sha = row.get("source_sha256")
        if (not isinstance(url, str) or not isinstance(canonical_domain, str)
                or not safe_official_url(url, canonical_domain)
                or not isinstance(sha, str) or not HEX_SHA256.fullmatch(sha)
                or page_id in seen_ids or url in seen_urls):
            raise ValueError("Invalid A5.5 official page or SHA")
        host = urlsplit(url).hostname
        per_host[host] += 1
        if per_host[host] > 2:
            raise ValueError("A5.5 audit host rate limit exceeded")
        seen_ids.add(page_id)
        seen_urls.add(url)
    return items


async def audit_historical_products(db, *, limit: int = 8) -> dict:
    """A manual, bounded observational read: never lease/requeue/save claims."""
    if not 1 <= limit <= MAX_AUDIT_SAMPLE:
        raise ValueError("A5.5 audit limit must be 1..12")
    if os.getenv("NETPRODUCERS_A54_ENABLED", "false").lower() != "true":
        raise ValueError("A5.5 requires the A5.4 HTML classifier enabled")
    sample = validate_sample(
        db_rpc(db, "netproducers1_auto1a55_product_audit_sample",
               {"p_limit": limit}),
        limit,
    )
    counts, layouts = Counter(), Counter()
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(12.0), follow_redirects=False, trust_env=False,
    ) as client:
        for index, page in enumerate(sample):
            if index:
                await asyncio.sleep(1.5)
            lease = {
                "source_url": page["source_url"],
                "canonical_domain": page["canonical_domain"],
                "page_id": page["page_id"],
                "last_sha256": page["source_sha256"],
                # Parse in memory on exact-body GET, not queue reprocessing.
                # ETag/Last-Modified are intentionally omitted.
                "needs_content_reparse": True,
            }
            result = await fetch_official_page(client, lease)
            status = result.get("status")
            if status not in KNOWN_OUTCOMES:
                raise ValueError("Unexpected A5.5 HTTP status")
            if status != "processed":
                counts["http_" + status] += 1
                continue
            if result.get("sha256") != page["source_sha256"]:
                counts["changed_snapshot"] += 1
                continue
            layout = result.get("a54_layout")
            if layout not in LAYOUT_CATEGORIES:
                raise ValueError("Missing valid source-local A5.4 layout")
            counts["sha_matched"] += 1
            layouts[layout] += 1
    return {
        "contract": "netproducers-auto1a55-readonly-audit-v1",
        "mode": "read_only",
        "selected": len(sample),
        "sha_matched": counts["sha_matched"],
        "changed_snapshot": counts["changed_snapshot"],
        "http_failed": counts["http_failed"],
        "http_blocked": counts["http_blocked"],
        "http_unchanged": counts["http_unchanged"],
        "layout_categories": dict(sorted(layouts.items())),
        "db_writes": 0,
        "published_claims": 0,
    }
