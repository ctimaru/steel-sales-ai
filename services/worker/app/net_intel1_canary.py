"""NET-INTEL1.A: read-only canary for existing published Network companies.

Run from services/worker with Railway backend credentials:
    python -m app.net_intel1_canary --limit 25 --output /tmp/net-intel1-canary.json

No database writes or public publication. This deliberately reuses the existing
SSRF-safe, robots-aware discovery extractor; promotion is a separate gate.
"""
from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
from urllib.parse import urlsplit

import httpx

from .company_discovery import (
    MAX_PAGES_PER_DOMAIN,
    REQUEST_TIMEOUT_SECONDS,
    CompanyDiscoveryError,
    _fetch_page,
    _priority_links,
    canonical_domain,
    canonicalize_seed_url,
    extract_candidate,
    robots_crawl_delay,
)
from .repository import WorkerRepository


def select_canary(rows: list[dict], limit: int = 25) -> list[dict]:
    """Choose unique published IT profiles missing description; never new leads."""
    if not 1 <= limit <= 100:
        raise ValueError("Canary limit must be between 1 and 100")
    eligible: dict[str, dict] = {}
    for row in rows:
        if (row.get("publication_status") != "published"
                or row.get("archived_at") is not None
                or row.get("country_code") != "IT"
                or str(row.get("description") or "").strip()):
            continue
        company_id = str(row.get("id") or "")
        raw_url = str(row.get("website_url") or "")
        if not company_id or not raw_url:
            continue
        try:
            seed = canonicalize_seed_url(raw_url)
        except (CompanyDiscoveryError, ValueError):
            continue
        eligible[company_id] = {**row, "website_url": seed}
    return sorted(eligible.values(), key=lambda row: str(row["id"]))[:limit]


async def fetch_published_profiles(repository: WorkerRepository) -> list[dict]:
    rows = await repository._request(
        "GET",
        "/rest/v1/network_companies"
        "?select=id,legal_name,country_code,website_url,description,"
        "publication_status,archived_at"
        "&publication_status=eq.published&archived_at=is.null"
        "&country_code=eq.IT&order=id.asc&limit=1000",
    )
    if not isinstance(rows, list):
        raise RuntimeError("Published company query returned a non-list payload")
    return rows


async def extract_one(client: httpx.AsyncClient, row: dict) -> dict:
    company_id = str(row["id"])
    seed = str(row["website_url"])
    try:
        home = await _fetch_page(client, seed, seed)
        if home is None:
            return {"company_id": company_id, "status": "unavailable"}
        # Reject cross-domain redirects: never enrich a company from another site's content.
        if canonical_domain(home.url) != canonical_domain(seed):
            return {"company_id": company_id, "status": "domain_mismatch"}
        pages = [home]
        # Sequential, bounded requests; observe robots.txt crawl delay on each domain.
        pause = min(max(await robots_crawl_delay(client, seed), 0.5), 30.0)
        for link in _priority_links(home):
            await asyncio.sleep(pause)
            page = await _fetch_page(client, link, home.url)
            if page is not None and canonical_domain(page.url) == canonical_domain(seed):
                pages.append(page)
        candidate = extract_candidate(pages[:MAX_PAGES_PER_DOMAIN], "IT")
        if candidate is None:
            return {"company_id": company_id, "status": "insufficient_steel_evidence"}
        return {
            "company_id": company_id,
            "status": "candidate_only",
            "source_website": seed,
            "extraction_version": candidate["extraction_version"],
            "description": candidate["description"],
            "roles": candidate["role_keys"],
            "products": candidate["product_relations"],
            "capabilities": candidate["capability_keys"],
            "markets": candidate["market_keys"],
            "confidence": candidate["confidence"],
            "quality_flags": candidate["quality_flags"],
            "evidence": candidate["evidence"],
        }
    except (CompanyDiscoveryError, httpx.HTTPError, ValueError) as exc:
        return {
            "company_id": company_id,
            "status": "error",
            "error_type": type(exc).__name__,
        }


async def run_canary(limit: int = 25) -> dict:
    repo = WorkerRepository()
    rows = await fetch_published_profiles(repo)
    cohort = select_canary(rows, limit)
    outcomes = []
    async with httpx.AsyncClient(timeout=httpx.Timeout(REQUEST_TIMEOUT_SECONDS)) as client:
        for row in cohort:
            outcomes.append(await extract_one(client, row))
    counts: dict[str, int] = {}
    for outcome in outcomes:
        key = outcome["status"]
        counts[key] = counts.get(key, 0) + 1
    return {
        "mode": "read_only_no_publication",
        "selected": len(cohort),
        "counts": counts,
        "results": outcomes,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Read-only Network Intelligence canary")
    parser.add_argument("--limit", type=int, default=25)
    parser.add_argument("--output", type=Path, required=True,
                        help="Private local JSON report; never place inside apps/web")
    args = parser.parse_args()
    report = asyncio.run(run_canary(args.limit))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n",
                           encoding="utf-8")
    args.output.chmod(0o600)
    print(json.dumps({key: report[key] for key in ("mode", "selected", "counts")}))


if __name__ == "__main__":
    main()
