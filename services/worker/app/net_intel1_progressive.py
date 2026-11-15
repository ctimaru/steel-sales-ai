"""NET-INTEL1.C: progressive batch of published companies, no human approval queue.

Reuses the verified crawler, the original private evidence ingestion RPC and
the service-role-only checkpoint / automatic-description-publication RPCs.
Run with backend-only credentials: python -m app.net_intel1_progressive --limit 100
"""
from __future__ import annotations

import argparse
import asyncio
import json
from datetime import UTC, datetime

import httpx

from .company_discovery import REQUEST_TIMEOUT_SECONDS
from .net_intel1_canary import extract_one
from .net_intel1_ingest import evidence_batch
from .net_intel1_fields import industrial_evidence
from .repository import WorkerRepository


async def _rpc(repo: WorkerRepository, name: str, payload: dict):
    return await repo._request("POST", f"/rest/v1/rpc/{name}", json=payload)


async def process_batch(limit: int = 100) -> dict:
    if not 1 <= limit <= 100:
        raise ValueError("Batch size must be from 1 to 100")
    repo = WorkerRepository()

    # Covers candidates already ingested before the publisher was installed.
    initial = await _rpc(repo, "netintel1_publish_safe_descriptions", {})
    rows = await _rpc(repo, "netintel1_next_batch", {"p_limit": limit})
    if not isinstance(rows, list):
        raise RuntimeError("Next-batch RPC did not return an array")

    counters: dict[str, int] = {}
    staged = 0
    failures = 0
    async with httpx.AsyncClient(timeout=httpx.Timeout(REQUEST_TIMEOUT_SECONDS)) as client:
        for row in rows:
            company_id = str(row["id"])
            outcome = await extract_one(client, row)
            status = str(outcome["status"])
            evidence = evidence_batch(outcome, datetime.now(UTC).isoformat())
            evidence.extend(industrial_evidence(outcome, datetime.now(UTC).isoformat()))
            if status == "candidate_only" and not evidence:
                status = "no_safe_evidence"
            if evidence:
                try:
                    response = await _rpc(repo, "netprofile1c3_ingest_evidence", {
                        "p_canonical_company_id": company_id,
                        "p_discovered_record_id": None,
                        "p_candidates": evidence[:20],
                    })
                    if not isinstance(response, int):
                        raise RuntimeError("Evidence ingest returned an invalid response")
                    staged += 1
                except Exception as exc:
                    status = "ingest_error"
                    failures += 1
                    print(json.dumps({"company_id": company_id, "ingest_error": type(exc).__name__}), flush=True)
            try:
                await _rpc(repo, "netintel1_record_attempt", {
                    "p_company_id": company_id, "p_status": status,
                })
            except Exception as exc:
                failures += 1
                print(json.dumps({"company_id": company_id, "checkpoint_error": type(exc).__name__}), flush=True)
            counters[status] = counters.get(status, 0) + 1

    publication = await _rpc(repo, "netintel1_publish_safe_descriptions", {})
    summary = {
        "mode": "progressive_auto_publish",
        "selected": len(rows),
        "companies_with_evidence": staged,
        "counts": counters,
        "published_this_run": publication,
        "published_prior_candidates": initial,
        "errors": failures,
    }
    print(json.dumps(summary, ensure_ascii=False), flush=True)
    return summary


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=100)
    args = parser.parse_args()
    result = asyncio.run(process_batch(args.limit))
    if result["errors"]:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
