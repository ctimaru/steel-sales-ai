"""NET-PROFILE1C.2: bounded, source-grounded corporate website extraction.

Uses the already hardened CRAWL-IT public HTTP/robots/SSRF fetcher.
Produces candidate evidence, never writes to DB or publishes profiles.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
from datetime import datetime, timezone
from urllib.parse import urlsplit

import httpx

from .company_discovery import (
    CompanyDiscoveryError, _fetch_page, _priority_links, _classify_enrichment,
    _redact_personal_channels, canonical_domain,
)
from .public_website_preview import normalize_seeds

EXTRACTOR_VERSION = "net-profile1c2-v1"
MAX_PAGES = 3
MAX_EXCERPT = 900
MAX_DESCRIPTION = 480


def description_candidate(text: str) -> str | None:
    """Return a bounded source quotation, not a generated business assertion."""
    text = _redact_personal_channels(re.sub(r"\s+", " ", text)).strip()
    text = re.sub(r"\[[^\]]+ removed\]", "", text).strip()
    if len(text) < 50:
        return None
    return text[:MAX_DESCRIPTION].rsplit(" ", 1)[0].strip() or None


def candidates_from_pages(pages: list, *, fetched_at: str) -> list[dict[str, object]]:
    output: list[dict[str, object]] = []
    for page in pages[:MAX_PAGES]:
        desc = description_candidate(page.text)
        if not desc:
            continue
        fields: list[tuple[str, object]] = [("description", desc)]
        capabilities, industries = _classify_enrichment(page.text)
        if capabilities:
            fields.append(("services", capabilities[:12]))
        if industries:
            fields.append(("industry", industries[:12]))
        for key, value in fields:
            output.append({
                "field_key": key,
                "field_value": value,
                "evidence_url": page.url,
                "evidence_excerpt": desc[:MAX_EXCERPT],
                "extractor_version": EXTRACTOR_VERSION,
                "fetched_at": fetched_at,
                "review_status": "candidate",
                # Lexical matches and extracted excerpts are NOT verified company facts.
                "confidence": None,
            })
    return output


async def extract_site(client: httpx.AsyncClient, site: str) -> dict[str, object]:
    try:
        home = await _fetch_page(client, site, site)
        if home is None:
            return {"site": site, "status": "blocked_or_unavailable", "pages": 0, "candidates": []}
        pages = [home]
        for url in _priority_links(home)[:MAX_PAGES - 1]:
            try:
                page = await _fetch_page(client, url, site)
                if page and canonical_domain(page.url) == canonical_domain(site):
                    pages.append(page)
            except (httpx.HTTPError, CompanyDiscoveryError):
                continue
        return {
            "site": site, "status": "candidates_only", "pages": len(pages),
            "candidates": candidates_from_pages(
                pages, fetched_at=datetime.now(timezone.utc).isoformat()
            ),
        }
    except (httpx.HTTPError, CompanyDiscoveryError):
        return {"site": site, "status": "blocked_or_unavailable", "pages": 0, "candidates": []}


async def run(urls: str) -> dict[str, object]:
    seeds = normalize_seeds(urls)  # HTTPS only, max 5, unique, no social/directories
    results = []
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0), follow_redirects=False) as client:
        for n, url in enumerate(seeds):
            if n:
                await asyncio.sleep(2)
            results.append(await extract_site(client, url))
    return {
        "contract": "net-profile1c2-candidates-v1",
        "results": results,
        "source_sites": len(seeds),
        "database_writes": 0,
        "published_profiles": 0,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Preview bounded company evidence without publishing")
    parser.add_argument("--urls", required=True, help="Comma-separated official HTTPS sites (max 5)")
    args = parser.parse_args()
    print(json.dumps(asyncio.run(run(args.urls)), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
