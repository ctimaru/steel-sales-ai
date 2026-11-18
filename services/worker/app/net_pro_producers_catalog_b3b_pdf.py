"""B3.B — Conservative producer-authorised PDF extraction to PRIVATE candidates.

No web fetching, OCR, PDF attachments, scripts, manufacturer confirmation,
publication or autonomous rights approval. A complete tuple must occur in ONE
extracted PDF layout line with four explicit delimited technical columns.
An isolated child process enforces time/CPU/address-space and output limits.
"""
from __future__ import annotations

from datetime import datetime
import os
import hashlib
import json
import re
import subprocess
import sys
from typing import Any

from .net_pro_producers_catalog_b1 import (
    CatalogueRejected, _candidate, inspect_authorised_catalogue,
)
from .net_pro_producers_catalog_b2 import _rpc as b2_rpc

PDF_BYTE_LIMIT = 8 * 1024 * 1024
MAX_PAGES = 15
MAX_LINES_PER_PAGE = 500
MAX_CANDIDATES = 150
MAX_CHUNK = 50
PDF_RPC_NAME = "netproducers1_b3b_pdf_catalog"
PDF_RPC_CONTRACT = "netproducers-b3b-v1"

# Isolated interpreter: bytes enter through stdin, bounded JSON exits stdout.
# Layout extraction ONLY. No OCR, images, Javascript, attachments or links.
# RLIMIT_AS and RLIMIT_CPU require Linux/POSIX (Railway's worker runtime).
_CHILD = r"""
import io
import json
import resource
import sys

def bounded():
    resource.setrlimit(resource.RLIMIT_AS, (512*1024*1024, 512*1024*1024))
    resource.setrlimit(resource.RLIMIT_CPU, (5, 5))
    data = sys.stdin.buffer.read(8*1024*1024 + 1)
    if not data.startswith(b"%PDF-") or not 0 < len(data) <= 8*1024*1024:
        raise ValueError("invalid_size")
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(data), strict=True)
    if reader.is_encrypted:
        raise ValueError("encrypted")
    page_count = len(reader.pages)
    if not 1 <= page_count <= 15:
        raise ValueError("page_limit")
    pages = []
    total_chars = 0
    for index, page in enumerate(reader.pages, start=1):
        # A valid blank/image-only page may have no /Contents stream.
        # That means zero documentary text, not a malformed PDF.
        content = (page.extract_text(extraction_mode="layout") or "") if "/Contents" in page else ""
        if not isinstance(content, str) or len(content) > 20000:
            raise ValueError("page_text_limit")
        total_chars += len(content)
        if total_chars > 150000:
            raise ValueError("document_text_limit")
        lines = content.splitlines()
        if len(lines) > 500:
            raise ValueError("line_limit")
        pages.append({"page": index, "lines": lines})
    sys.stdout.write(json.dumps({"pages": pages}, ensure_ascii=True))
bounded()
"""


def _read_pdf_lines(content: bytes) -> list[dict]:
    """Bounded PDF text subprocess, never emit PDF text into logs/errors."""
    if not isinstance(content, bytes) or not 0 < len(content) <= PDF_BYTE_LIMIT:
        raise CatalogueRejected("B3.B PDF outside bounded size")
    if not content.startswith(b"%PDF-"):
        raise CatalogueRejected("B3.B PDF signature missing")
    try:
        finished = subprocess.run(
            [sys.executable, "-I", "-c", _CHILD],
            input=content,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=9,
            check=False,
        )
    except (subprocess.TimeoutExpired, OSError) as exc:
        raise CatalogueRejected("B3.B isolated PDF extractor unavailable") from exc
    if finished.returncode != 0 or len(finished.stdout) > 250000:
        raise CatalogueRejected("B3.B PDF rejected by isolated extractor")
    try:
        body = json.loads(finished.stdout)
    except (UnicodeDecodeError, ValueError) as exc:
        raise CatalogueRejected("B3.B invalid extracted PDF result") from exc
    if not isinstance(body, dict) or not isinstance(body.get("pages"), list):
        raise CatalogueRejected("B3.B invalid extracted PDF structure")
    pages = body["pages"]
    if not 1 <= len(pages) <= MAX_PAGES:
        raise CatalogueRejected("B3.B PDF page count invalid")
    for pageno, page in enumerate(pages, start=1):
        if (not isinstance(page, dict) or page.get("page") != pageno
                or not isinstance(page.get("lines"), list)
                or len(page["lines"]) > MAX_LINES_PER_PAGE
                or any(not isinstance(s, str) or len(s) > 20000
                       for s in page["lines"])):
            raise CatalogueRejected("B3.B invalid PDF line locator")
    return pages


def _candidate_rows(pages: list[dict], manifest: dict, actual_sha: str) -> tuple[list[dict], int]:
    candidates: list[dict] = []
    ignored_lines = 0
    # Require four independently explicit columns separated by a table-like
    # delimiter; no concatenation across rows, pages or catalogue headings.
    for page in pages:
        for lineno, raw in enumerate(page["lines"], start=1):
            if len(raw) > 300:
                ignored_lines += 1
                continue
            pieces = re.split(r"\s*\|\s*|\s*;\s*|\t+|\s{3,}", raw.strip())
            if len(pieces) != 4:
                ignored_lines += 1
                continue
            row = dict(zip(("standard", "grade", "shape", "dimensions_mm"), pieces))
            candidate = _candidate(row, 2, manifest, actual_sha)
            if candidate is None:
                ignored_lines += 1
                continue
            candidate["source_page"] = page["page"]
            candidate["source_line"] = lineno
            candidate["source_locator"] = f"pdf_page:{page['page']}:line:{lineno}"
            candidate["source_line_sha256"] = hashlib.sha256(raw.encode("utf-8")).hexdigest()
            candidate["interpretation"] = "pdf_extracted_exact_line_candidate"
            candidates.append(candidate)
            if len(candidates) > MAX_CANDIDATES:
                raise CatalogueRejected("B3.B candidate cap exceeded")
    return candidates, ignored_lines


def stage_authorised_pdf(
    db: Any, manifest: dict, content: bytes, *, now: datetime | None = None
) -> dict:
    """Stage technical PDF candidates via a grant-bound service-only private RPC.

    The result is PENDING_VERIFICATION, NEVER source_verified or producibility.
    The PDF grant is fetched from B2, not from the caller's own assertions.
    """
    if not isinstance(manifest, dict) or manifest.get("format") != "pdf":
        raise CatalogueRejected("B3.B requires an authorised PDF manifest")

    def trusted_grant_lookup(company_id: str, catalog_id: str) -> dict:
        response = b2_rpc(db, "get", {
            "company_id": company_id, "catalog_id": catalog_id,
        })
        grant = response.get("grant")
        if not isinstance(grant, dict) or grant.get("format") != "pdf":
            raise CatalogueRejected("B3.B verified PDF rights missing")
        return grant

    source = inspect_authorised_catalogue(
        manifest, content, grant_lookup=trusted_grant_lookup, now=now,
    )
    if source["status"] != "licensed_pdf_registered_not_extracted":
        raise CatalogueRejected("B3.B invalid B2 PDF registration")
    pages = _read_pdf_lines(content)
    # Coordinate inspection is automatic per eligible PDF once enabled.
    # It is independently isolated and returns diagnostic counts only until
    # a cell-to-row proof can be validated by the service-side writer.
    position_metrics = None
    position_pages = None
    if os.getenv("NETPRODUCERS_C3_POSITION_OBSERVATION_ENABLED") == "1":
        from .net_pro_producers_pdf_positions_c3 import (
            read_pdf_text_origins, position_diagnostics,
        )
        position_pages = read_pdf_text_origins(content)
        position_metrics = position_diagnostics(position_pages)
    candidates, ignored = _candidate_rows(
        pages, manifest, source["document_sha256"],
    )
    # Separately publish factual, page-local outer sizes. No grade or
    # thickness association; only after valid producer document B2 rights.
    # The existing Railway cron stays OFF until its pinned deploy is updated.
    pdf_size_rows = {"size_rows_found": 0, "size_rows_new": 0}
    if os.getenv("NETPRODUCERS_C3_PDF_SIZE_PUBLISH_ENABLED") == "1":
        from .net_pro_producers_pdf_table_sizes_c3 import stage_pdf_table_sizes
        pdf_size_rows = stage_pdf_table_sizes(db, manifest, pages)

    # Stage candidate geometry only after original size rows are present.
    # No public thickness/grade SKU is inferred from these observations.
    geometry_stage = None
    if os.getenv("NETPRODUCERS_C3_GEOMETRY_STAGE_ENABLED") == "1":
        if position_pages is None or os.getenv("NETPRODUCERS_C3_PDF_SIZE_PUBLISH_ENABLED") != "1":
            raise CatalogueRejected("C3 geometry requires positional evidence and source rows")
        from .net_pro_producers_pdf_table_sizes_c3 import extract_pdf_table_sizes
        from .net_pro_producers_pdf_table_geometry_c3 import (
            extract_positioned_thickness, stage_positioned_thickness,
        )
        geometry = extract_positioned_thickness(
            position_pages, extract_pdf_table_sizes(pages)["rows"]
        )
        geometry_stage = stage_positioned_thickness(
            db, manifest, source["document_sha256"], geometry["candidate_rows"]
        )
        geometry_stage["ambiguous_rows"] = geometry["ambiguous_rows"]

    staged = replayed = 0
    for i in range(0, len(candidates), MAX_CHUNK):
        group = candidates[i:i + MAX_CHUNK]
        result = db.rpc(PDF_RPC_NAME, {
            "p_operation": "stage",
            "p_payload": {
                "company_id": source["company_id"],
                "catalog_id": source["catalog_id"],
                "sha256": source["document_sha256"],
                "candidates": group,
            },
        }).execute().data
        if (not isinstance(result, dict)
                or result.get("contract") != PDF_RPC_CONTRACT
                or result.get("status") != "staged"
                or type(result.get("added")) is not int
                or type(result.get("replayed")) is not int
                or result["added"] < 0 or result["replayed"] < 0
                or result["added"] + result["replayed"] != len(group)
                or result.get("published_claims") != 0):
            raise CatalogueRejected("B3.B unexpected private-stage contract")
        staged += result["added"]
        replayed += result["replayed"]
    return {
        "contract": "netproducers-b3b-worker-v1",
        "status": "pending_private_pdf_candidates" if candidates else "no_exact_pdf_lines",
        "catalog_id": source["catalog_id"],
        "document_sha256": source["document_sha256"],
        "pages_inspected": len(pages),
        "candidate_rows": len(candidates),
        "ignored_lines": ignored,
        "staged": staged,
        "replayed": replayed,
        "source_verified": 0,
        "manufacturer_confirmed": 0,
        "published_claims": 0,
        "published_observed_size_rows": pdf_size_rows["size_rows_new"],
        "observed_size_rows_found": pdf_size_rows["size_rows_found"],
        "position_observation": position_metrics,
        "geometry_staged": geometry_stage,
    }
