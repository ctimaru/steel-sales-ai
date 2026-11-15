"""NET-INTEL1.B — conservative, idempotent ingestion of sourced company candidates.

Run as a one-shot Railway job with backend-only credentials:
  python -m app.net_intel1_ingest --limit 25

This does not approve candidates or update public company profiles. It reuses
the validated published-only cohort and existing crawler + evidence RPC.
"""
from __future__ import annotations

import argparse
import asyncio
import json
from datetime import UTC, datetime
from urllib.parse import urlsplit

import httpx

from .company_discovery import REQUEST_TIMEOUT_SECONDS
from .net_intel1_canary import extract_one, fetch_published_profiles, select_canary
from .repository import WorkerRepository


def evidence_batch(outcome: dict, fetched_at: str) -> list[dict]:
    """Accept only sourced candidate text; never infer prices, stock or standards."""
    if outcome.get("status") != "candidate_only":
        return []
    description = str(outcome.get("description") or "").strip()
    evidence = outcome.get("evidence")
    if not description or not isinstance(evidence, list):
        return []
    source_domain = (urlsplit(str(outcome.get("source_website") or "")).hostname or "").lower()
    if source_domain.startswith("www."):
        source_domain = source_domain[4:]
    for page in evidence:
        if not isinstance(page, dict):
            continue
        source_url = str(page.get("url") or "")
        parsed = urlsplit(source_url)
        host = (parsed.hostname or "").lower()
        if host.startswith("www."):
            host = host[4:]
        excerpt = str(page.get("snippet") or "").strip()
        if parsed.scheme != "https" or host != source_domain or not excerpt:
            continue
        # One minimally useful, evidenced description per company. Product and
        # role relations require an independent field-level evidence matcher.
        return [{
            "field_key": "description",
            "field_value": description[:600],
            "evidence_url": source_url[:2048],
            "evidence_excerpt": excerpt[:1200],
            "extractor_version": "net-intel1-b-description-v1",
            "fetched_at": fetched_at,
        }]
    return []


async def ingest_canary(limit: int = 25) -> dict:
    repo = WorkerRepository()
    cohort = select_canary(await fetch_published_profiles(repo), limit)
    counts: dict[str, int] = {}
    stored = 0
    failed = 0
    async with httpx.AsyncClient(timeout=httpx.Timeout(REQUEST_TIMEOUT_SECONDS)) as client:
        for row in cohort:
            outcome = await extract_one(client, row)
            status = str(outcome["status"])
            counts[status] = counts.get(status, 0) + 1
            batch = evidence_batch(outcome, datetime.now(UTC).isoformat())
            if not batch:
                continue
            try:
                result = await repo._request(
                    "POST",
                    "/rest/v1/rpc/netprofile1c3_ingest_evidence",
                    json={
                        "p_canonical_company_id": str(row["id"]),
                        "p_discovered_record_id": None,
                        "p_candidates": batch,
                    },
                )
                if not isinstance(result, int):
                    raise RuntimeError("Evidence ingest RPC returned an invalid result")
                stored += 1
            except Exception as exc:
                failed += 1
                counts["ingest_error"] = counts.get("ingest_error", 0) + 1
                # No raw response or secrets in logs.
                print(json.dumps({"company_id": str(row["id"]), "ingest_error_type": type(exc).__name__}), flush=True)
    summary = {
        "mode": "private_candidates_only",
        "selected": len(cohort),
        "extracted": counts.get("candidate_only", 0),
        "companies_with_evidence_in_db": stored,
        "ingest_errors": failed,
        "counts": counts,
    }
    print(json.dumps(summary, ensure_ascii=False), flush=True)
    return summary


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=25)
    args = parser.parse_args()
    summary = asyncio.run(ingest_canary(args.limit))
    if summary["ingest_errors"]:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
