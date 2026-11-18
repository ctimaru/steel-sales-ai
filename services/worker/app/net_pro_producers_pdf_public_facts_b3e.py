"""B3.E: bounded first-party *factual observation* of public technical PDFs.

This is deliberately separate from B2's producer-licensed document workflow.
It does not create a B2 grant, copy or redistribute a PDF or establish a
manufacturer's production capability. Only small, source-bound, provisional
facts may be staged through the existing service-only C3 RPCs.

The caller must read company identity and indexed PDF URL from the trusted DB,
not from request or page content. Access disallowed by robots must be skipped.
"""
from __future__ import annotations

import hashlib
import http.client
import ipaddress
import socket
import ssl
from urllib.parse import urlsplit, urlunsplit

from .net_pro_producers_catalog_b1 import CatalogueRejected
from .net_pro_producers_catalog_discovery import (
    _official_url, _robots_allows, _resolve_public_ip, USER_AGENT,
)
from .net_pro_producers_catalog_b3b_pdf import _read_pdf_lines
from .net_pro_producers_pdf_positions_c3 import read_pdf_text_origins
from .net_pro_producers_pdf_table_sizes_c3 import (
    extract_pdf_table_sizes, stage_pdf_table_sizes,
)
from .net_pro_producers_pdf_table_geometry_c3 import (
    extract_positioned_thickness, stage_positioned_thickness,
)

MAX_PDF = 8 * 1024 * 1024


def bounded_official_pdf(url: str, domain: str) -> bytes:
    """DNS-pinned TLS PDF fetch with no redirects, cookies, proxy or disk.

    The upstream robots/terms eligibility is checked by observe_pdf_source;
    this low-level reader never decides licensing or public publication.
    """
    if not _official_url(url, domain) or not urlsplit(url).path.lower().endswith(".pdf"):
        raise CatalogueRejected("B3.E invalid first-party PDF URL")
    parsed = urlsplit(url)
    host = parsed.hostname or ""
    try:
        address = _resolve_public_ip(host)
        if not ipaddress.ip_address(address).is_global:
            raise ValueError("non-public IP")
    except Exception as exc:
        raise CatalogueRejected("B3.E public DNS resolution denied") from exc
    conn = http.client.HTTPSConnection(host, 443, timeout=10,
                                      context=ssl.create_default_context())
    try:
        sock = socket.create_connection((address, 443), timeout=10)
        try:
            conn.sock = conn._context.wrap_socket(sock, server_hostname=host)
        except Exception:
            sock.close()
            raise
        path = urlunsplit(("", "", parsed.path, parsed.query, ""))
        conn.request("GET", path, headers={
            "Host": host, "User-Agent": USER_AGENT,
            "Accept": "application/pdf", "Accept-Encoding": "identity",
            "Connection": "close",
        })
        response = conn.getresponse()
        if response.status != 200:
            raise CatalogueRejected("B3.E PDF source unavailable")
        if "application/pdf" not in (response.getheader("Content-Type", "") or "").lower():
            raise CatalogueRejected("B3.E source is not PDF")
        if (response.getheader("Content-Encoding", "identity") or "").lower() != "identity":
            raise CatalogueRejected("B3.E encoded source denied")
        length = response.getheader("Content-Length")
        if length and (not length.isdecimal() or int(length) > MAX_PDF):
            raise CatalogueRejected("B3.E PDF exceeds size cap")
        content = bytearray()
        while len(content) <= MAX_PDF:
            chunk = response.read(min(65536, MAX_PDF + 1 - len(content)))
            if not chunk:
                break
            content.extend(chunk)
        if not 0 < len(content) <= MAX_PDF or not content.startswith(b"%PDF-"):
            raise CatalogueRejected("B3.E PDF invalid or over limit")
        return bytes(content)
    except (OSError, TimeoutError, ssl.SSLError, http.client.HTTPException) as exc:
        raise CatalogueRejected("B3.E PDF network failure") from exc
    finally:
        conn.close()


def observe_pdf_source(db, *, company_id: str, source_url: str,
                       canonical_domain: str, source_status: str,
                       rights_status: str, allow_factual_observation: bool,
                       dry_run: bool = True) -> dict:
    """Read a narrowly bounded official source, optionally stage facts.

    The explicit opt-in is a *deployment* policy for factual observation only,
    not a representation of a producer's copyright permission. It is never
    used to register producer B2 grants or publish PDF content itself.
    A link-only record is never silently upgraded to an approved grant.
    """
    if (source_status != "official_link_observed"
        or rights_status != "link_only"
        or not _official_url(source_url, canonical_domain)
        or not allow_factual_observation):
        raise CatalogueRejected("B3.E public fact observation not eligible")
    if not _robots_allows(source_url, canonical_domain, {}):
        raise CatalogueRejected("B3.E robots unavailable or denied")
    content = bounded_official_pdf(source_url, canonical_domain)
    digest = hashlib.sha256(content).hexdigest()
    pages = _read_pdf_lines(content)
    positions = read_pdf_text_origins(content)
    dimensions = extract_pdf_table_sizes(pages)
    geometry = extract_positioned_thickness(positions, dimensions["rows"])
    # No raw PDF, copied tables, or source text ever returned or staged.
    result = {
        "contract": "netproducers-b3e-factual-observation-v1",
        "document_sha256": digest, "pages_inspected": len(pages),
        "dimension_candidates": len(dimensions["rows"]),
        "thickness_candidates": len(geometry["candidate_rows"]),
        "ambiguous_rows": geometry["ambiguous_rows"],
        "published_claims": 0, "manufacturer_confirmed": 0,
        "staged_dimensions": 0, "staged_thickness": 0,
        "dry_run": dry_run,
    }
    if dry_run:
        return result
    manifest = {"company_id": company_id, "source_url": source_url}
    size_outcome = stage_pdf_table_sizes(db, manifest, pages)
    result["staged_dimensions"] = size_outcome["size_rows_new"]
    if geometry["candidate_rows"]:
        thickness_outcome = stage_positioned_thickness(
            db, manifest, digest, geometry["candidate_rows"]
        )
        result["staged_thickness"] = thickness_outcome["added"]
    return result


async def run_b3e_fact_queue(db, *, limit: int = 1, stage: bool = False) -> dict:
    """Drain a bounded persistent queue only when Railway opts in.

    Failures are per-source, recorded as short error codes. A bad document
    cannot block the remaining sources or silently grant any rights.
    """
    import asyncio
    if type(limit) is not int or not 1 <= limit <= 3:
        raise ValueError("B3.E limit must be 1-3")
    def rpc(operation, payload):
        result = db.rpc("netproducers_b3e_pdf_fact_queue", {
            "p_operation": operation, "p_payload": payload
        }).execute().data
        if (not isinstance(result, dict)
            or result.get("contract") != "netproducers-b3e-pdf-queue-v1"
            or result.get("operation") != operation):
            raise CatalogueRejected("B3.E queue RPC contract failure")
        return result
    seeded=rpc("seed", {"limit":40})
    claimed=rpc("claim", {"limit":limit})
    items=claimed.get("items")
    if (not isinstance(items,list) or len(items)>limit
        or claimed.get("count")!=len(items)):
        raise CatalogueRejected("B3.E unexpected source lease")
    report={"contract":"netproducers-b3e-worker-v1",
            "seeded":seeded.get("added",0),"leased":len(items),
            "complete":0,"blocked":0,"retry":0,
            "dimension_candidates":0,"thickness_candidates":0,
            "staged_dimensions":0,"staged_thickness":0,
            "published_claims":0}
    for item in items:
        if (not isinstance(item,dict)
            or not item.get("company_id") or not item.get("lease_token")
            or item.get("source_status")!="official_link_observed"
            or item.get("rights_status")!="link_only"):
            raise CatalogueRejected("B3.E invalid trusted source lease")
        try:
            output=await asyncio.to_thread(observe_pdf_source, db,
                company_id=item["company_id"],
                source_url=item["source_url"],
                canonical_domain=item["canonical_domain"],
                source_status=item["source_status"],
                rights_status=item["rights_status"],
                allow_factual_observation=True, dry_run=not stage)
            status="complete"
            info={key:output[key] for key in (
                "dimension_candidates","thickness_candidates",
                "staged_dimensions","staged_thickness")}
            for key,value in info.items():
                report[key]+=value
        except CatalogueRejected as exc:
            status="blocked"
            info={"error_code":"source_rejected"}
            # Source-specific policy errors cannot be converted into grants.
        except Exception:
            status="retry"
            info={"error_code":"extractor_or_stage_error"}
        rpc("complete", {
            "company_id":item["company_id"],
            "source_url":item["source_url"],
            "lease_token":item["lease_token"],
            "status":status,**info
        })
        report[status]+=1
    return report
