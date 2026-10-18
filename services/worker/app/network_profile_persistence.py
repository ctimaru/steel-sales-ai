"""NET-PROFILE1C.3 — opt-in, idempotent source-evidence persistence.

Never exposed as a public route. The operator selects a known company UUID
and its official site; Supabase service credentials remain worker-side only.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
from uuid import UUID

import httpx
from supabase import create_client

from .network_profile_extraction import extract_site
from .public_website_preview import normalize_seeds

MAX_CANDIDATES_PER_CALL = 20


def parse_company_id(value: str) -> str:
    return str(UUID(value))


def prepare_candidates(result: dict) -> list[dict]:
    """Only candidate evidence from the bounded extractor is eligible."""
    entries = result.get("candidates", [])
    if result.get("status") != "candidates_only" or not isinstance(entries, list):
        return []
    sanitized = []
    for item in entries:
        if not isinstance(item, dict) or item.get("review_status") != "candidate":
            continue
        if item.get("field_key") not in ("description", "products", "services", "industry", "city", "region", "website"):
            continue
        url = item.get("evidence_url")
        if not isinstance(url, str) or not url.startswith("https://"):
            continue
        sanitized.append({key: item[key] for key in
            ("field_key", "field_value", "evidence_url", "evidence_excerpt",
             "extractor_version", "fetched_at") if key in item})
    return sanitized[:MAX_CANDIDATES_PER_CALL]


def persist_candidates(db, *, company_id: str, kind: str, candidates: list[dict]) -> int:
    """RPC owns uniqueness and does not permit caller-set publication status."""
    if not candidates:
        return 0
    if kind not in ("canonical", "discovered"):
        raise ValueError("Invalid company kind")
    ref = parse_company_id(company_id)
    payload = {
        "p_canonical_company_id": ref if kind == "canonical" else None,
        "p_discovered_record_id": ref if kind == "discovered" else None,
        "p_candidates": candidates,
    }
    response = db.rpc("netprofile1c3_ingest_evidence", payload).execute()
    return int(response.data)


async def run(*, company_id: str, kind: str, site: str, persist: bool) -> dict:
    parse_company_id(company_id)
    if kind not in ("canonical", "discovered"):
        raise ValueError("Invalid company kind")
    normalized = normalize_seeds(site)
    if len(normalized) != 1:
        raise ValueError("Exactly one reviewed official HTTPS site is required")
    async with httpx.AsyncClient(timeout=httpx.Timeout(10), follow_redirects=False) as client:
        result = await extract_site(client, normalized[0])
    candidates = prepare_candidates(result)
    output = {"company_id": company_id, "kind": kind, "site": normalized[0],
              "status": result["status"], "pages": result["pages"],
              "candidate_count": len(candidates), "saved": None, "published": 0}
    if persist and candidates:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        client = create_client(url, key)
        output["saved"] = persist_candidates(client, company_id=company_id,
                                             kind=kind, candidates=candidates)
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description="Review official site candidates and optionally persist")
    parser.add_argument("--company-id", required=True)
    parser.add_argument("--kind", choices=("canonical", "discovered"), required=True)
    parser.add_argument("--site", required=True)
    parser.add_argument("--persist", action="store_true", help="Explicitly enable privileged candidate writes")
    args = parser.parse_args()
    print(json.dumps(asyncio.run(run(company_id=args.company_id, kind=args.kind,
                                    site=args.site, persist=args.persist)), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
