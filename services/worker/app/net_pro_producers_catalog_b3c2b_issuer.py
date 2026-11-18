"""B3.C2.B — trusted first-party source-vs-private-file verification.

Only individually attested producer files with an *independently verified
corporate claim* can be leased. An official same-company HTTPS document must
have the exact same SHA256 as the private uploaded bytes. No web crawler,
link-only catalogue or model-generated licence can enter B2.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import http.client
import ipaddress
import json
import os
import re
import socket
import ssl
from typing import Any
from urllib.parse import urlsplit

from .net_pro_producers_catalog_b3c_queue import (
    BUCKET, MAX_CSV_BYTES, MAX_PDF_BYTES,
    VALID_SHA, VALID_UUID, _download_private_catalogue,
)
from .supabase_credentials import get_supabase_admin_key

RPC = "netproducers1_b3c2b_verified_issuer"
CONTRACT = "netproducers-b3c2b-issuer-v1"
MAX_BATCH = 2
VALID_DOMAIN = re.compile(r"^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$")


class VerifiedIssuerError(ValueError):
    def __init__(self, error_code: str):
        self.error_code = error_code
        super().__init__(error_code)


def _rpc(db: Any, action: str, payload: dict) -> dict:
    data = db.rpc(RPC, {"p_operation": action, "p_payload": payload}).execute().data
    if not isinstance(data, dict) or data.get("contract") != CONTRACT:
        raise VerifiedIssuerError("unexpected")
    return data


def _submission(raw: Any) -> dict:
    if not isinstance(raw, dict):
        raise VerifiedIssuerError("unexpected")
    company = raw.get("company_id")
    catalog = raw.get("catalog_id")
    token = raw.get("lease_token")
    digest = raw.get("sha256")
    format_ = raw.get("format")
    if (not all(isinstance(x, str) and VALID_UUID.fullmatch(x)
                for x in (company, catalog, token))
            or not isinstance(digest, str) or not VALID_SHA.fullmatch(digest)
            or format_ not in ("csv", "pdf")
            or raw.get("object_path") !=
               f"{company}/{catalog}/{digest}.{format_}"
            or not isinstance(raw.get("source_url"), str)):
        raise VerifiedIssuerError("unexpected")
    return raw


def _verified_source_url(source_url: str) -> tuple[str, str]:
    """Validate URL syntax. Database independently binds host to company."""
    if not 14 <= len(source_url) <= 1200 or any(c.isspace() for c in source_url):
        raise VerifiedIssuerError("unsafe_source")
    try:
        url = urlsplit(source_url)
        host = url.hostname
        if (url.scheme != "https" or not host
                or not VALID_DOMAIN.fullmatch(host)
                or url.username or url.password or url.port not in (None, 443)
                or url.fragment or host.startswith(".")
                or host.endswith(".") or ".." in host
                or "." not in host):
            raise VerifiedIssuerError("unsafe_source")
        # Names can be first-party domains, not raw IP addresses.
        try:
            ipaddress.ip_address(host)
            raise VerifiedIssuerError("unsafe_source")
        except ValueError:
            pass
        path = url.path or "/"
        if not path.startswith("/") or any(ord(c)<33 for c in path):
            raise VerifiedIssuerError("unsafe_source")
        # No redirect, proxy, userinfo, port override or fragment.
        return host.lower(), path + ("?" + url.query if url.query else "")
    except ValueError as exc:
        if isinstance(exc, VerifiedIssuerError):
            raise
        raise VerifiedIssuerError("unsafe_source") from exc


def _resolve_public_ip(host: str) -> str:
    """Require every DNS answer to be globally routed, not internal/private."""
    try:
        records = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    except (OSError, ValueError) as exc:
        raise VerifiedIssuerError("source_unreachable") from exc
    if not records:
        raise VerifiedIssuerError("source_unreachable")
    values = []
    for record in records:
        address = ipaddress.ip_address(record[4][0])
        if not address.is_global:
            raise VerifiedIssuerError("unsafe_source")
        values.append(str(address))
    return values[0]


def _read_pinned_firstparty_bytes(source_url: str, format_: str) -> bytes:
    """Pinned-IP TLS with original hostname SNI and certificate verification.

    DNS is resolved ONCE; the chosen public address is used directly in the
    socket connection, not resolved a second time by an HTTP client.
    """
    host, path = _verified_source_url(source_url)
    ip = _resolve_public_ip(host)
    limit = MAX_PDF_BYTES if format_ == "pdf" else MAX_CSV_BYTES
    conn = http.client.HTTPSConnection(
        host, 443, timeout=12, context=ssl.create_default_context()
    )
    try:
        # Explicitly pin to the vetted public IP, but keep the original host
        # for certificate validation, SNI and HTTP Host.
        tcp = socket.create_connection((ip, 443), timeout=12)
        try:
            conn.sock = conn._context.wrap_socket(tcp, server_hostname=host)
        except Exception:
            tcp.close()
            raise
        conn.request("GET", path, headers={
            "Accept": "application/pdf,text/csv;q=0.9",
            "Accept-Encoding": "identity",
            "User-Agent": "SmartSteelSales-CatalogueRightsVerifier/1.0",
            "Connection": "close",
        })
        response = conn.getresponse()
        if response.status != 200:
            raise VerifiedIssuerError("source_unreachable")
        size = response.getheader("Content-Length")
        if size is not None and (not size.isdigit() or int(size) > limit):
            raise VerifiedIssuerError("unsupported_document")
        if response.getheader("Content-Encoding", "identity").lower() != "identity":
            raise VerifiedIssuerError("unsupported_document")
        content = bytearray()
        while True:
            chunk = response.read(min(65536, limit + 1 - len(content)))
            if not chunk:
                break
            content.extend(chunk)
            if len(content) > limit:
                raise VerifiedIssuerError("unsupported_document")
        if not content or (format_ == "pdf" and not bytes(content).startswith(b"%PDF-")):
            raise VerifiedIssuerError("unsupported_document")
        return bytes(content)
    except (TimeoutError, OSError, ssl.SSLError, http.client.HTTPException) as exc:
        raise VerifiedIssuerError("source_unreachable") from exc
    finally:
        conn.close()


async def _verify_claimed_submission(submission: dict) -> str:
    """Both independent downloaded byte streams must match the bound SHA."""
    private_lease = {
        "object_path": submission["object_path"],
        "format": submission["format"],
        "sha256": submission["sha256"],
    }
    try:
        private_bytes = await _download_private_catalogue(private_lease)
    except Exception as exc:
        raise VerifiedIssuerError("storage_unavailable") from exc
    actual_private = hashlib.sha256(private_bytes).hexdigest()
    if actual_private != submission["sha256"]:
        raise VerifiedIssuerError("hash_mismatch")
    official = await asyncio.to_thread(
        _read_pinned_firstparty_bytes,
        submission["source_url"], submission["format"],
    )
    actual_official = hashlib.sha256(official).hexdigest()
    if actual_official != actual_private:
        raise VerifiedIssuerError("hash_mismatch")
    return actual_official


async def verify_pending_catalogues(db: Any, *, limit: int = MAX_BATCH) -> dict:
    """Per-cron bounded, audited issuer. The RPC atomically registers B2+C1."""
    if type(limit) is not int or not 1 <= limit <= 3:
        raise ValueError("Catalogue issuer limit must be 1..3")
    result = _rpc(db, "claim", {"limit": limit})
    items = result.get("items")
    if (result.get("status") != "claimed"
        or type(result.get("count")) is not int
        or not isinstance(items, list) or result["count"] != len(items)
        or len(items) > limit):
        raise VerifiedIssuerError("unexpected")
    issued = errors = 0
    for item in items:
        data = _submission(item)
        auth = {
            "company_id": data["company_id"],
            "catalog_id": data["catalog_id"],
            "lease_token": data["lease_token"],
        }
        try:
            digest = await _verify_claimed_submission(data)
            response = _rpc(db, "accept", {
                **auth, "source_sha256": digest,
            })
            if response.get("status") != "issued_and_enqueued" or \
               response.get("published_claims") != 0:
                raise VerifiedIssuerError("unexpected")
            issued += 1
        except VerifiedIssuerError as exc:
            outcome = _rpc(db, "reject", {
                **auth, "error_code": exc.error_code,
            })
            if outcome.get("status") != "failure_recorded":
                raise VerifiedIssuerError("unexpected")
            errors += 1
        except Exception:
            outcome = _rpc(db, "reject", {
                **auth, "error_code": "unexpected",
            })
            if outcome.get("status") != "failure_recorded":
                raise VerifiedIssuerError("unexpected")
            errors += 1
    return {
        "contract": "netproducers-b3c2b-worker-v1",
        "eligible_leased": len(items),
        "verified_licensed_and_enqueued": issued,
        "deferred_or_review": errors,
        "published_claims": 0,
        "manufacturer_confirmed": 0,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="First-party producer PDF rights issuer")
    parser.add_argument("--persist", action="store_true")
    parser.add_argument("--limit", type=int, default=2)
    args = parser.parse_args()
    if not args.persist:
        parser.error("--persist required; does not fabricate rights in dry run")
    from supabase import create_client
    db = create_client(os.environ["SUPABASE_URL"], get_supabase_admin_key())
    print(json.dumps(asyncio.run(verify_pending_catalogues(db, limit=args.limit))))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
