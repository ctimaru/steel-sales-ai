"""EU1.E2.A — source-bound verification of licensed full PDF technical rows.

Unlike dimensional observations, one verified tuple must include standard,
grade, section, outer sizes and wall thickness on the *same original PDF line*.
This is document evidence, not manufacturer confirmation or availability.
The only authority for PDF reuse is a current independently verified B2 grant.
No network fetch, OCR, PDF text logging, or public data publishing.
"""
from __future__ import annotations

from datetime import datetime
import hashlib
from typing import Any

from .net_pro_producers_catalog_b1 import (
    CatalogueRejected, inspect_authorised_catalogue,
)
from .net_pro_producers_catalog_b2 import _rpc as b2_rpc
from .net_pro_producers_catalog_b3b_pdf import (
    _candidate_rows, _read_pdf_lines, stage_authorised_pdf,
)

RPC_NAME = "netproducers_e2_pdf_verify"
RPC_CONTRACT = "netproducers-e2-pdf-v1"
RESULT_CONTRACT = "netproducers-e2-pdf-worker-v1"
MAX_CHUNK = 50


def verify_authorised_pdf(
    db: Any, manifest: dict, content: bytes, *, now: datetime | None = None
) -> dict:
    """Reread the exact bytes, compare each line SHA and ask SQL to verify rows.

    The SQL function independently locks/rechecks rights, canonical identity,
    original staged row, source locator and evidence hash before promotion.
    """
    if not isinstance(manifest, dict) or manifest.get("format") != "pdf":
        raise CatalogueRejected("EU1.E2 accepts only licensed PDF documents")

    def trusted_lookup(company_id: str, catalog_id: str) -> dict:
        result = b2_rpc(db, "get", {
            "company_id": company_id, "catalog_id": catalog_id,
        })
        grant = result.get("grant")
        if not isinstance(grant, dict) or grant.get("format") != "pdf":
            raise CatalogueRejected("EU1.E2 requires current verified PDF rights")
        return grant

    source = inspect_authorised_catalogue(
        manifest, content, grant_lookup=trusted_lookup, now=now,
    )
    if source["status"] != "licensed_pdf_registered_not_extracted":
        raise CatalogueRejected("EU1.E2 unsupported document grant state")

    # Isolated subprocess: maximum 8 MiB / 15 pages / 500 lines per page.
    pages = _read_pdf_lines(content)
    candidates, ignored = _candidate_rows(
        pages, manifest, source["document_sha256"],
    )
    # Explicitly recheck that the original page/line still has the digest
    # previously used at staging; never concatenate separated labels.
    for item in candidates:
        page = item["source_page"]
        line = item["source_line"]
        if not (1 <= page <= len(pages) and
                1 <= line <= len(pages[page - 1]["lines"])):
            raise CatalogueRejected("Original PDF source locator unavailable")
        original = pages[page - 1]["lines"][line - 1]
        if hashlib.sha256(original.encode("utf-8")).hexdigest() != item["source_line_sha256"]:
            raise CatalogueRejected("Original PDF line digest mismatch")
        if item["source_locator"] != f"pdf_page:{page}:line:{line}":
            raise CatalogueRejected("Ambiguous PDF locator")

    if not candidates:
        return {
            "contract": RESULT_CONTRACT,
            "status": "no_exact_source_lines",
            "catalog_id": source["catalog_id"],
            "document_sha256": source["document_sha256"],
            "candidate_rows": 0,
            "ignored_lines": ignored,
            "source_verified": 0,
            "replayed": 0,
            "published_claims": 0,
            "manufacturer_confirmed": 0,
        }

    staged = stage_authorised_pdf(db, manifest, content, now=now)
    if (staged.get("candidate_rows") != len(candidates)
            or staged.get("staged", 0) + staged.get("replayed", 0) != len(candidates)
            or staged.get("published_claims") != 0
            or staged.get("manufacturer_confirmed") != 0):
        raise CatalogueRejected("EU1.E2 stage evidence changed before verification")

    verified = replayed = 0
    for off in range(0, len(candidates), MAX_CHUNK):
        group = candidates[off:off + MAX_CHUNK]
        response = db.rpc(RPC_NAME, {
            "p_operation": "verify",
            "p_payload": {
                "company_id": source["company_id"],
                "catalog_id": source["catalog_id"],
                "sha256": source["document_sha256"],
                "rows": group,
            },
        }).execute()
        result = response.data
        if (not isinstance(result, dict)
                or result.get("contract") != RPC_CONTRACT
                or result.get("status") != "source_verified"
                or type(result.get("verified")) is not int
                or type(result.get("replayed")) is not int
                or result["verified"] < 0 or result["replayed"] < 0
                or result["verified"] + result["replayed"] != len(group)
                or result.get("published_claims") != 0
                or result.get("manufacturer_confirmed") != 0):
            raise CatalogueRejected("EU1.E2 private verification contract rejected")
        verified += result["verified"]
        replayed += result["replayed"]

    return {
        "contract": RESULT_CONTRACT,
        "status": "source_rows_verified",
        "catalog_id": source["catalog_id"],
        "document_sha256": source["document_sha256"],
        "candidate_rows": len(candidates),
        "ignored_lines": ignored,
        "source_verified": verified,
        "replayed": replayed,
        "published_claims": 0,
        "manufacturer_confirmed": 0,
    }
