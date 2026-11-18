"""B3.A — Source-bound verification of producer-authorised CSV technical rows.

Never interprets ranges as exact sizes; only a complete tuple in one CSV row
can become source_verified. The B2 catalogue grant must come from a trusted
server-side issuer. No public capabilities, PDF extraction or network access.
"""
from __future__ import annotations

import csv
from datetime import datetime
import io
from typing import Any

from .net_pro_producers_catalog_b1 import (
    CatalogueRejected, REQUIRED_COLUMNS, _dimensions,
    inspect_authorised_catalogue,
)
from .net_pro_producers_catalog_b2 import (
    MAX_STAGE_CHUNK, _rpc as b2_rpc, stage_authorised_document,
)

RPC_NAME = "netproducers1_b3_catalog_verify"
RPC_CONTRACT = "netproducers-b3-v1"
RESULT_CONTRACT = "netproducers-b3-worker-verify-v1"


def _source_bound_row_check(content: bytes, candidates: list[dict]) -> None:
    """Revisit original CSV logical rows, never join separate rows/sections.

    In particular, a heading or a dimensional range is NOT an exact producer
    capability. The hash of these bytes is independently checked by B1.
    """
    try:
        reader = csv.DictReader(
            io.StringIO(content.decode("utf-8-sig"), newline=""),
            strict=True,
        )
        rows = {f"csv_row:{i}": row for i, row in enumerate(reader, start=2)}
    except (UnicodeDecodeError, csv.Error) as exc:
        raise CatalogueRejected("Invalid B3 CSV evidence") from exc
    for candidate in candidates:
        original = rows.get(candidate["source_locator"])
        if not original or any(not isinstance(original.get(k), str) for k in REQUIRED_COLUMNS):
            raise CatalogueRejected("Missing source-local candidate row")
        standard = "".join(original["standard"].upper().split())
        grade = original["grade"].strip().upper()
        shape = original["shape"].strip().upper()
        dimensions = _dimensions(shape, original["dimensions_mm"].strip())
        if (standard != candidate["standard"]
                or grade != candidate["grade"] or shape != candidate["shape"]
                or dimensions != candidate["dimensions_mm"]):
            raise CatalogueRejected("Candidate differs from the original CSV row")


def verify_authorised_csv(
    db: Any, manifest: dict, content: bytes, *, now: datetime | None = None
) -> dict:
    """Stage via B2 then attest only exact, same-row licensed source tuples.

    Call only from an isolated service-role worker. All mutations are private;
    SOURCE_VERIFIED is documentary evidence, NOT manufacturer confirmation.
    """
    if not isinstance(manifest, dict) or manifest.get("format") != "csv":
        raise CatalogueRejected("B3 only supports producer-authorised CSV")

    def trusted_grant_lookup(company_id: str, catalog_id: str) -> dict:
        result = b2_rpc(db, "get", {
            "company_id": company_id, "catalog_id": catalog_id,
        })
        grant = result.get("grant")
        if not isinstance(grant, dict):
            raise CatalogueRejected("Missing current B2 verified rights")
        return grant

    parsed = inspect_authorised_catalogue(
        manifest, content, grant_lookup=trusted_grant_lookup, now=now,
    )
    if parsed["status"] != "csv_parsed":
        raise CatalogueRejected("B3 cannot verify non-CSV documents")
    candidates = parsed["candidates"]
    _source_bound_row_check(content, candidates)

    # SQL checks staged row, source SHA, exact tuple and current rights again.
    # Keep B2 candidate quarantine if a later chunk is rejected.
    staged = stage_authorised_document(db, manifest, content, now=now)
    if staged["candidate_rows"] != len(candidates) or staged["published_claims"] != 0:
        raise CatalogueRejected("B2 stage contract mismatch")
    verified = replayed = 0
    for offset in range(0, len(candidates), MAX_STAGE_CHUNK):
        batch = candidates[offset:offset + MAX_STAGE_CHUNK]
        payload = {
            "company_id": parsed["company_id"],
            "catalog_id": parsed["catalog_id"],
            "sha256": parsed["document_sha256"],
            "rows": batch,
        }
        response = db.rpc(RPC_NAME, {
            "p_operation": "verify",
            "p_payload": payload,
        }).execute()
        result = response.data
        if (not isinstance(result, dict)
                or result.get("contract") != RPC_CONTRACT
                or result.get("status") != "source_verified"
                or type(result.get("verified")) is not int
                or type(result.get("replayed")) is not int
                or result["verified"] < 0 or result["replayed"] < 0
                or result["verified"] + result["replayed"] != len(batch)
                or result.get("published_claims") != 0):
            raise CatalogueRejected("Unexpected B3 service verification outcome")
        verified += result["verified"]
        replayed += result["replayed"]

    return {
        "contract": RESULT_CONTRACT,
        "status": "source_rows_verified",
        "source_verified": verified,
        "replayed": replayed,
        "candidate_rows": len(candidates),
        "rejected_rows": parsed["rejected_rows"],
        "document_sha256": parsed["document_sha256"],
        "catalog_id": parsed["catalog_id"],
        "published_claims": 0,
        "manufacturer_confirmed": 0,
    }
