"""CRAWL-IT6.8a — dedicated scoped Supabase secret, approved-source staging only."""
from __future__ import annotations

import argparse
import asyncio
import json
import os
from urllib.parse import urlsplit

import httpx

from .italian_source_discovery import harvest_once

MAX_SOURCES_PER_RUN = 3
EXPECTED_SUPABASE_HOST = "ecrafjdummcdfycznitx.supabase.co"


class StagingRepository:
    """Narrow REST client; never supplies a legacy service_role Bearer JWT."""
    def __init__(self) -> None:
        url = os.getenv("CRAWL_IT68_SUPABASE_URL", "").strip().rstrip("/")
        key = os.getenv("CRAWL_IT68_SUPABASE_SECRET_KEY", "").strip()
        parsed = urlsplit(url)
        if (parsed.scheme != "https" or parsed.hostname != EXPECTED_SUPABASE_HOST
                or parsed.port or parsed.username or parsed.password
                or parsed.path or parsed.query or parsed.fragment):
            raise ValueError("Unexpected Supabase project URL")
        if not key.startswith("sb_secret_") or len(key) < 32:
            raise ValueError("Dedicated Supabase sb_secret key required")
        self.url = url
        self.key = key

    async def _request(self, method: str, path: str, *, json=None, prefer=None):
        # Fixed destinations and verbs: no generic privileged Data API client.
        if (method, path) == ("POST", "/rest/v1/rpc/crawl_it3_claim_due_source"):
            pass
        elif method == "GET" and path.startswith(
            "/rest/v1/network_companies?website_domain=eq."
        ) and path.endswith("&archived_at=is.null&select=id&limit=1"):
            pass
        elif method == "POST" and path == (
            "/rest/v1/network_discovery_domain_leads?on_conflict=source_id,domain"
        ):
            if not isinstance(json, dict) or json.get("status") != "pending_review":
                raise ValueError("Only pending_review domain staging is allowed")
        else:
            raise ValueError("Unexpected crawler Data API operation")
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(12), follow_redirects=False
        ) as client:
            response = await client.request(
                method, self.url + path,
                headers={
                    "apikey": self.key, "Content-Type": "application/json",
                    "Accept": "application/json",
                    **({"Prefer": prefer} if prefer else {}),
                },
                json=json,
            )
        if response.status_code not in (200, 201, 204):
            # Do not log response contents, tokens, or company-level payloads.
            raise RuntimeError(f"Crawler approved-source API returned HTTP {response.status_code}")
        return response.json() if response.content else None


async def run(max_sources: int) -> dict[str, object]:
    if os.getenv("CRAWL_IT68_ENABLED") != "true":
        raise RuntimeError("CRAWL_IT68_ENABLED must be true; staging is disabled")
    if not 1 <= max_sources <= MAX_SOURCES_PER_RUN:
        raise ValueError("Source limit must be 1-3")
    repo = StagingRepository()
    staged = 0
    for _ in range(max_sources):
        staged += await harvest_once(repo=repo)
    return {
        "mode": "GOVERNED_APPROVED_SOURCE_STAGING",
        "source_attempts": max_sources,
        "staged_leads": staged,
        "max_leads_per_source": 20,
        "published": 0,
        "personal_contacts": 0,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sources", type=int, choices=(1, 2, 3), default=1)
    args = parser.parse_args()
    print(json.dumps(asyncio.run(run(args.sources)), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
