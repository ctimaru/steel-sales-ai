"""CRAWL-IT6.7 — read-only corporate website crawl, human-reviewed seeds.

No directory/aggregator scraping, profiles, contacts, CSV artifacts or DB writes.
"""
from __future__ import annotations

import argparse
import asyncio
import json
from urllib.parse import urlsplit

import httpx

from .company_discovery import (
    CompanyDiscoveryError, _fetch_page, _priority_links,
    _classify_enrichment, _structured_facilities,
    canonical_domain, canonicalize_seed_url,
)

MAX_SEEDS = 5
MAX_PAGES_PER_SITE = 3
BLOCKED = ("linkedin.com", "facebook.com", "instagram.com", "google.com",
           "paginegialle.it", "kompass.com", "europages.com", "indeed.com")


def normalize_seeds(raw: str) -> list[str]:
    seeds = [x.strip() for x in raw.split(",") if x.strip()]
    if not 1 <= len(seeds) <= MAX_SEEDS:
        raise ValueError("Use 1 to 5 manually selected corporate website URLs")
    output = []
    domains = set()
    for seed in seeds:
        url = canonicalize_seed_url(seed)
        domain = canonical_domain(url)
        if (urlsplit(url).scheme != "https" or
                any(domain == b or domain.endswith("." + b) for b in BLOCKED)):
            raise ValueError("HTTPS corporate sites only, no social or directory websites")
        if domain in domains:
            raise ValueError("Duplicate site in batch")
        domains.add(domain)
        output.append(url)
    return output


async def preview_site(client: httpx.AsyncClient, url: str) -> dict[str, object]:
    try:
        home = await _fetch_page(client, url, url)
        if not home:
            return {"status": "skipped_robots_or_unavailable", "pages": 0}
        pages = [home]
        for next_url in _priority_links(home)[:MAX_PAGES_PER_SITE - 1]:
            try:
                page = await _fetch_page(client, next_url, url)
                if page and canonical_domain(page.url) == canonical_domain(url):
                    pages.append(page)
            except (httpx.HTTPError, CompanyDiscoveryError):
                continue
        signals, markets = _classify_enrichment(" ".join(p.text for p in pages))
        facilities = _structured_facilities(pages, "IT")
        return {
            "status": "preview_only", "pages": len(pages),
            "capability_signal_count": len(signals),
            "market_signal_count": len(markets),
            "structured_facility_count": len(facilities),
            "review_required": True,
        }
    except (httpx.HTTPError, CompanyDiscoveryError):
        return {"status": "unavailable_or_blocked", "pages": 0}


async def run(urls: str) -> dict[str, object]:
    seeds = normalize_seeds(urls)
    # Sequential, conservative request budget; _fetch_page enforces robots,
    # public IP safety, redirects, HTML-only and body-size limits.
    async with httpx.AsyncClient(timeout=httpx.Timeout(10)) as client:
        results = []
        for i, seed in enumerate(seeds, 1):
            outcome = await preview_site(client, seed)
            results.append({"seed_index": i, **outcome})
            if i < len(seeds):
                await asyncio.sleep(2)
    return {
        "mode": "READ_ONLY_COMPANY_WEBSITE_PREVIEW",
        "requested_sites": len(seeds), "outcomes": results,
        "max_pages_per_site": MAX_PAGES_PER_SITE,
        "supabase_writes": 0, "published": 0,
        "contacts_collected": 0, "csv_artifacts": 0,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--urls", required=True, help="Comma-separated approved HTTPS company sites (max 5)")
    args = parser.parse_args()
    print(json.dumps(asyncio.run(run(args.urls)), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
