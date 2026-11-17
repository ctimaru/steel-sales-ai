"""B2 — trusted-worker bridge from B1 offline parsing to private Supabase staging.

No HTTP, upload endpoint, grant auto-approval or public technical claims.
The independent grant is registered by an authenticated, verified producer-rights
process elsewhere; manifest fields are never sufficient to create that grant.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from .net_pro_producers_catalog_b1 import (
    CatalogueRejected, inspect_authorised_catalogue,
)

RPC_NAME = "netproducers1_b2_catalog"
RPC_CONTRACT = "netproducers-b2-v1"
MAX_STAGE_CHUNK = 50


def _rpc(db: Any, operation: str, payload: dict) -> dict:
    response = db.rpc(RPC_NAME, {
        "p_operation": operation,
        "p_payload": payload,
    }).execute()
    data = response.data
    if not isinstance(data, dict) or data.get("contract") != RPC_CONTRACT:
        raise CatalogueRejected("Unexpected B2 server contract")
    return data


def stage_authorised_document(
    db: Any, manifest: dict, content: bytes, *, now: datetime | None = None,
) -> dict:
    """Stage B1 candidates ONLY through B2's independent rights-gated RPC.

    Call from a sealed service-role worker; callers must never supply a grant
    resolver or a DB client connected with browser credentials.
    """
    if not isinstance(manifest, dict):
        raise CatalogueRejected("Invalid B2 document manifest")

    def trusted_grant_lookup(company_id: str, catalog_id: str) -> dict | None:
        result = _rpc(db, "get", {
            "company_id": company_id, "catalog_id": catalog_id,
        })
        grant = result.get("grant")
        if not isinstance(grant, dict):
            raise CatalogueRejected("Verified B2 grant missing")
        return grant

    parsed = inspect_authorised_catalogue(
        manifest, content, grant_lookup=trusted_grant_lookup, now=now,
    )
    if parsed["status"] == "licensed_pdf_registered_not_extracted":
        return {
            "contract": "netproducers-b2-worker-stage-v1",
            "status": "licensed_pdf_not_parsed",
            "candidate_rows": 0, "staged": 0, "replayed": 0,
            "db_writes": 0, "published_claims": 0,
        }
    if parsed["status"] != "csv_parsed":
        raise CatalogueRejected("Invalid B2 intake result")
    candidates = parsed["candidates"]
    staged = replayed = 0
    for index in range(0, len(candidates), MAX_STAGE_CHUNK):
        chunk = candidates[index:index+MAX_STAGE_CHUNK]
        # Entire batch is rejected in SQL if the grant is now expired, revoked,
        # cross-company, or any locator/hash is inconsistent.
        outcome = _rpc(db, "stage", {
            "company_id": parsed["company_id"],
            "catalog_id": parsed["catalog_id"],
            "sha256": parsed["document_sha256"],
            "candidates": chunk,
        })
        if (outcome.get("status") != "staged"
                or outcome.get("published_claims") != 0
                or type(outcome.get("added")) is not int
                or type(outcome.get("replayed")) is not int
                or outcome["added"] < 0 or outcome["replayed"] < 0
                or outcome["added"] + outcome["replayed"] != len(chunk)):
            raise CatalogueRejected("Unexpected B2 staging outcome")
        staged += outcome["added"]
        replayed += outcome["replayed"]
    return {
        "contract": "netproducers-b2-worker-stage-v1",
        "status": "candidate_rows_staged",
        "candidate_rows": len(candidates),
        "rejected_rows": parsed["rejected_rows"],
        "staged": staged,
        "replayed": replayed,
        "published_claims": 0,
    }
