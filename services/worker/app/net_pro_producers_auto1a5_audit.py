"""AUTO1.A.5.2: bounded, *read-only* retrospective source diagnostics.

Manual invocation after the A5/A5.2 migrations (never in the production cron):
    python -m app.net_pro_producers_auto1 --audit-a5 --sample 8

Only current producer-owned depth-two HTML snapshots selected by a service-only
RPC may be fetched. The HTTP SHA-256 must match the saved fingerprint exactly;
changed/failed/blocked sources produce no diagnostic attribution. No raw HTML,
URLs, page identifiers, candidate values or hashes leave the process as logs.
No completion/lease/record/requeue RPC is ever invoked by this command.
"""
from __future__ import annotations

import asyncio
from collections import Counter
import re
from urllib.parse import urlsplit
from uuid import UUID

import httpx

from .net_pro_producers_auto1 import (
    db_rpc, fetch_official_page, safe_official_url,
)

MAX_AUDIT_SAMPLE = 12
HEX_SHA256 = re.compile(r"^[0-9a-f]{64}$")
KNOWN_OUTCOMES = frozenset({"processed", "failed", "blocked", "unchanged"})


def validate_sample(payload: object, limit: int) -> list[dict]:
    """Fail closed on malformed, duplicate, off-domain or oversized RPC data."""
    if not 1 <= limit <= MAX_AUDIT_SAMPLE:
        raise ValueError("Audit sample must be 1..12")
    if (not isinstance(payload, dict)
            or payload.get("contract") != "netproducers-auto1a5-audit-sample-v1"):
        raise ValueError("Unexpected A5.2 sample contract")
    items = payload.get("items")
    if (not isinstance(items, list) or len(items) > limit
            or type(payload.get("count")) is not int
            or payload["count"] != len(items)):
        raise ValueError("Invalid A5.2 sample count")
    seen = set()
    per_host = Counter()
    for row in items:
        if not isinstance(row, dict):
            raise ValueError("Invalid A5.2 sampled page")
        try:
            page_id = str(UUID(row["page_id"]))
            parent_id = str(UUID(row["parent_page_id"]))
        except (ValueError, TypeError, KeyError, AttributeError) as exc:
            raise ValueError("Invalid A5.2 page identity") from exc
        url, canonical_domain = row.get("source_url"), row.get("canonical_domain")
        sha = row.get("source_sha256")
        if (not isinstance(url, str) or not isinstance(canonical_domain, str)
                or not safe_official_url(url, canonical_domain)
                or not isinstance(sha, str) or not HEX_SHA256.fullmatch(sha)
                or page_id in seen or not parent_id):
            raise ValueError("Unexpected A5.2 source or fingerprint")
        host = urlsplit(url).hostname
        per_host[host] += 1
        if per_host[host] > 2:
            raise ValueError("Audit host rate limit exceeded")
        seen.add(page_id)
    return items


async def audit_historical_details(db, *, limit: int = 8) -> dict:
    """No DB writes; GET only approved pages with robots, DNS and SHA checks."""
    if not 1 <= limit <= MAX_AUDIT_SAMPLE:
        raise ValueError("Audit sample must be 1..12")
    sample = validate_sample(
        db_rpc(db, "netproducers1_auto1a5_audit_sample", {"p_limit": limit}),
        limit,
    )
    counts = Counter()
    reasons = Counter()
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
                "parent_page_id": page["parent_page_id"],
                "last_sha256": page["source_sha256"],
                # Forces an in-memory parse after GET, NOT a queue reparse.
                # No conditional ETag/Last-Modified and no state updates.
                "needs_content_reparse": True,
            }
            result = await fetch_official_page(client, lease)
            status = result.get("status")
            if status not in KNOWN_OUTCOMES:
                raise ValueError("Unexpected audit HTTP outcome")
            if status != "processed":
                counts["http_" + status] += 1
                continue
            if result.get("sha256") != page["source_sha256"]:
                counts["changed_snapshot"] += 1
                continue
            diagnostic = result.get("diagnostic")
            if (not isinstance(diagnostic, dict)
                    or diagnostic.get("contract") != "netproducers-auto1a5-diagnostic-v1"
                    or not isinstance(diagnostic.get("reason"), str)):
                raise ValueError("Processed same-SHA page lacks valid A5 diagnostics")
            # Only counts from the original, same-row A4 parser. We never
            # record technical candidates or claim producibility here.
            counts["sha_matched"] += 1
            reasons[diagnostic["reason"]] += 1
    return {
        "contract": "netproducers-auto1a5-readonly-audit-v1",
        "mode": "read_only",
        "selected": len(sample),
        "sha_matched": counts["sha_matched"],
        "changed_snapshot": counts["changed_snapshot"],
        "http_failed": counts["http_failed"],
        "http_blocked": counts["http_blocked"],
        "http_unchanged": counts["http_unchanged"],
        "reasons": dict(sorted(reasons.items())),
        "db_writes": 0,
        "published_claims": 0,
    }
