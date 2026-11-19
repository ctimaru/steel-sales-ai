"""B3.C.1: Drain only licensed, private, producer-provided catalogue files.

No first-party URL download or rights auto-approval. Job grants are independently
approved under B2. The service-role worker fetches a *private* Storage object,
recomputes SHA-256, then invokes B3.A (CSV) or B3.B (PDF).
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import re
from typing import Any
from urllib.parse import quote

import httpx

from .net_pro_producers_catalog_b1 import CatalogueRejected
from .net_pro_producers_catalog_b3 import verify_authorised_csv
from .net_pro_producers_catalog_b3b_pdf import stage_authorised_pdf
from .net_pro_producers_catalog_e2_pdf_verify import verify_authorised_pdf
from .supabase_credentials import get_supabase_admin_key, supabase_admin_headers

QUEUE_NAME = "netproducers1_b3c_catalog_queue"
QUEUE_CONTRACT = "netproducers-b3c-queue-v1"
BUCKET = "producer-authorized-catalogs"
MAX_PDF_BYTES = 8 * 1024 * 1024
MAX_CSV_BYTES = 2 * 1024 * 1024
VALID_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
VALID_SHA = re.compile(r"^[0-9a-f]{64}$")


class IntakeFailure(ValueError):
    """Categorised, non-sensitive failure safe for private audit."""
    def __init__(self, error_code: str):
        self.error_code = error_code
        super().__init__(error_code)


def _queue_rpc(db: Any, operation: str, payload: dict) -> dict:
    result = db.rpc(QUEUE_NAME, {
        "p_operation": operation, "p_payload": payload,
    }).execute().data
    if not isinstance(result, dict) or result.get("contract") != QUEUE_CONTRACT:
        raise IntakeFailure("rpc_rejected")
    return result


def _checked_lease(value: Any) -> dict:
    if not isinstance(value, dict):
        raise IntakeFailure("rpc_rejected")
    company = value.get("company_id")
    catalog = value.get("catalog_id")
    sha = value.get("sha256")
    format_ = value.get("format")
    lease = value.get("lease_token")
    job_id = value.get("job_id")
    if (not all(isinstance(v, str) and VALID_UUID.fullmatch(v)
                for v in (company, catalog, lease, job_id))
            or not isinstance(sha, str) or not VALID_SHA.fullmatch(sha)
            or format_ not in ("pdf", "csv")
            or value.get("object_bucket") != BUCKET
            or value.get("object_path") != f"{company}/{catalog}/{sha}.{format_}"
            or not isinstance(value.get("edition"), str)
            or not isinstance(value.get("source_url"), str)):
        raise IntakeFailure("rpc_rejected")
    return value


async def _download_private_catalogue(lease: dict) -> bytes:
    """Only Supabase Storage is fetched; bounded stream, no redirects or URL input."""
    server = os.environ.get("SUPABASE_URL", "").rstrip("/")
    if not server.startswith("https://"):
        raise IntakeFailure("storage_missing")
    key = get_supabase_admin_key()
    path = lease["object_path"]
    # The strict path has been reconstructed by _checked_lease.
    endpoint = (
        f"{server}/storage/v1/object/{BUCKET}/"
        f"{quote(path, safe='/')}"
    )
    max_bytes = MAX_PDF_BYTES if lease["format"] == "pdf" else MAX_CSV_BYTES
    try:
        async with httpx.AsyncClient(
            follow_redirects=False, trust_env=False,
            timeout=httpx.Timeout(20.0),
        ) as client:
            async with client.stream(
                "GET", endpoint, headers=supabase_admin_headers(key),
            ) as response:
                if response.status_code != 200:
                    raise IntakeFailure("storage_missing")
                data = bytearray()
                async for part in response.aiter_bytes():
                    data.extend(part)
                    if len(data) > max_bytes:
                        raise IntakeFailure("size_or_digest")
    except httpx.HTTPError as exc:
        raise IntakeFailure("storage_missing") from exc
    content = bytes(data)
    if not content or hashlib.sha256(content).hexdigest() != lease["sha256"]:
        raise IntakeFailure("size_or_digest")
    if lease["format"] == "pdf" and not content.startswith(b"%PDF-"):
        raise IntakeFailure("invalid_document")
    return content


async def _consume(db: Any, lease: dict) -> dict:
    verified = _checked_lease(lease)
    content = await _download_private_catalogue(verified)
    manifest = {
        "catalog_id": verified["catalog_id"],
        "company_id": verified["company_id"],
        "source_url": verified["source_url"],
        "edition": verified["edition"],
        "format": verified["format"],
        "sha256": verified["sha256"],
    }
    try:
        if verified["format"] == "csv":
            parsed = verify_authorised_csv(db, manifest, content)
        else:
            # Opt-in only after E2 migration and a pinned Railway worker deploy.
            # Every job still requires real B2 rights and private Storage bytes.
            if os.getenv("NETPRODUCERS_E2_PDF_VERIFY_ENABLED") == "1":
                parsed = verify_authorised_pdf(db, manifest, content)
            else:
                parsed = stage_authorised_pdf(db, manifest, content)
    except CatalogueRejected as exc:
        # Do not expose doc content or grant identifiers to logs.
        message = str(exc).lower()
        code = "grant_inactive" if any(
            word in message for word in ("grant", "right", "licens")
        ) else "invalid_document"
        raise IntakeFailure(code) from exc
    if (parsed.get("published_claims") != 0
            or parsed.get("manufacturer_confirmed") != 0
            or type(parsed.get("candidate_rows")) is not int
            or not 0 <= parsed["candidate_rows"] <= 500):
        raise IntakeFailure("rpc_rejected")
    return {
        "candidate_rows": parsed["candidate_rows"],
        "source_verified": parsed.get("source_verified", 0),
        "format": verified["format"],
    }


async def drain_authorised_catalogues(db: Any, *, limit: int = 2) -> dict:
    """Leases at most three jobs; retries and revocation are enforced by SQL."""
    if type(limit) is not int or not 1 <= limit <= 3:
        raise ValueError("Queue limit must be 1..3")
    response = _queue_rpc(db, "claim", {"limit": limit})
    jobs = response.get("items")
    if (response.get("status") != "claimed" or not isinstance(jobs, list)
            or type(response.get("count")) is not int
            or response["count"] != len(jobs) or len(jobs) > limit):
        raise IntakeFailure("rpc_rejected")

    completed = failed = pending_rows = verified_csv = verified_pdf = 0
    for lease in jobs:
        if not isinstance(lease, dict):
            raise IntakeFailure("rpc_rejected")
        # A malformed remote lease is a hard-stop, never a blind requeue.
        safe = _checked_lease(lease)
        credentials = {
            "catalog_id": safe["catalog_id"],
            "company_id": safe["company_id"],
            "lease_token": safe["lease_token"],
        }
        try:
            output = await _consume(db, safe)
            reply = _queue_rpc(db, "complete", {
                **credentials, "candidate_rows": output["candidate_rows"],
            })
            if reply.get("status") != "completed" or reply.get("published_claims") != 0:
                raise IntakeFailure("rpc_rejected")
            completed += 1
            pending_rows += output["candidate_rows"]
            if output["format"] == "pdf":
                verified_pdf += output["source_verified"]
            else:
                verified_csv += output["source_verified"]
        except IntakeFailure as exc:
            reply = _queue_rpc(db, "fail", {
                **credentials, "error_code": exc.error_code,
            })
            if reply.get("status") != "failure_recorded":
                raise IntakeFailure("rpc_rejected")
            failed += 1
        except Exception:
            # Categorised operational error, no raw stack / secret / PDF logging.
            reply = _queue_rpc(db, "fail", {
                **credentials, "error_code": "unexpected",
            })
            if reply.get("status") != "failure_recorded":
                raise IntakeFailure("rpc_rejected")
            failed += 1
    return {
        "contract": "netproducers-b3c-worker-v1",
        "jobs_claimed": len(jobs),
        "jobs_completed": completed,
        "jobs_failed": failed,
        "private_candidate_rows": pending_rows,
        "source_verified_csv_rows": verified_csv,
        "pdf_source_verified_rows": verified_pdf,
        "published_claims": 0,
        "manufacturer_confirmed": 0,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Rights-gated catalogue queue worker")
    parser.add_argument("--limit", type=int, default=2)
    parser.add_argument("--persist", action="store_true")
    args = parser.parse_args()
    if not args.persist:
        raise SystemExit("--persist required; no dry-run may mutate job leases")
    from supabase import create_client
    db = create_client(os.environ["SUPABASE_URL"], get_supabase_admin_key())
    result = asyncio.run(drain_authorised_catalogues(db, limit=args.limit))
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
