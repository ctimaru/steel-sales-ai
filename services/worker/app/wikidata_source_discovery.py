"""CRAWL-IT6.5: bounded, CC0 Wikidata steel-company lead preview.

One WDQS request per invocation. Never visits proposed company sites. Company
roles (trader / producer / buyer) must be assigned by a human, not inferred here.
This file can run as a *read-only* CLI dry run without credentials or DB writes.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
from urllib.parse import urlsplit

import httpx

from .company_discovery import CompanyDiscoveryError, canonical_domain, canonicalize_seed_url

SOURCE_URL = "https://query.wikidata.org/sparql"
RIGHTS_URL = "https://www.wikidata.org/wiki/Wikidata:Licensing"
USAGE_URL = "https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual"
USER_AGENT = "SmartSteelSales-DiscoveryPilot/1.0 (contact: hello@smartsteelsales.com)"
MAX_RESULTS = 20
MAX_RESPONSE_BYTES = 512_000
# Explicit Italy P17=Q38, siderurgia industry P452=Q2285982,
# website P856; no people's contacts, descriptions or geo are retained.
QUERY = """SELECT DISTINCT ?item ?website WHERE {
  ?item wdt:P452 wd:Q2285982 .
  ?item wdt:P17 wd:Q38 .
  ?item wdt:P856 ?website .
} LIMIT 20"""
ITEM_RE = re.compile(r"^https://www\.wikidata\.org/entity/(Q[1-9][0-9]{0,13})$")
EXCLUDED = frozenset({
    "facebook.com", "linkedin.com", "instagram.com", "youtube.com",
    "google.com", "twitter.com", "x.com", "tiktok.com", "wikipedia.org",
    "wikidata.org", "wikimedia.org", "wordpress.com", "blogspot.com",
})


def parse_steel_italy_bindings(payload: object, limit: int = 5) -> list[tuple[str, str, str]]:
    """Return (canonical domain, proposed homepage, Wikidata entity evidence URL)."""
    if not isinstance(limit, int) or not 1 <= limit <= MAX_RESULTS:
        raise ValueError("Wikidata lead budget must be 1-20")
    if not isinstance(payload, dict) or not isinstance(payload.get("results"), dict):
        raise ValueError("Unexpected WDQS response")
    rows = payload["results"].get("bindings")
    if not isinstance(rows, list) or len(rows) > 100:
        raise ValueError("Unexpected WDQS result count")
    unique: dict[str, tuple[str, str, str]] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        item = row.get("item", {})
        website = row.get("website", {})
        entity_uri = item.get("value") if isinstance(item, dict) else None
        raw_url = website.get("value") if isinstance(website, dict) else None
        match = ITEM_RE.fullmatch(entity_uri or "")
        if not match or not isinstance(raw_url, str):
            continue
        try:
            url = canonicalize_seed_url(raw_url)
        except (CompanyDiscoveryError, ValueError, TypeError):
            continue
        parts = urlsplit(url)
        if parts.scheme != "https" or parts.port not in (None, 443):
            continue
        domain = canonical_domain(url)
        if "." not in domain or domain.endswith(".local"):
            continue
        if any(domain == bad or domain.endswith("." + bad) for bad in EXCLUDED):
            continue
        # Never fetch website. Evidence refers to the structured CC0 item only.
        unique.setdefault(domain, (
            domain, "https://" + parts.netloc + "/", "https://www.wikidata.org/wiki/" + match.group(1)
        ))
        if len(unique) >= limit:
            break
    return list(unique.values())


async def preview_wikidata_steel_italy(limit: int = 5) -> list[tuple[str, str, str]]:
    """At most one public query, fail closed on timeout, rate limit or invalid data."""
    if not isinstance(limit, int) or not 1 <= limit <= MAX_RESULTS:
        raise ValueError("Wikidata lead budget must be 1-20")
    async with httpx.AsyncClient(timeout=httpx.Timeout(12.0), follow_redirects=False) as client:
        res = await client.get(
            SOURCE_URL,
            params={"query": QUERY, "format": "json"},
            headers={
                "Accept": "application/sparql-results+json",
                "User-Agent": USER_AGENT,
            },
        )
    if res.status_code != 200:
        raise RuntimeError(f"WDQS unavailable HTTP {res.status_code}; do not retry automatically")
    if len(res.content) > MAX_RESPONSE_BYTES:
        raise ValueError("WDQS response too large")
    return parse_steel_italy_bindings(res.json(), limit=limit)


async def main(limit: int) -> int:
    results = await preview_wikidata_steel_italy(limit)
    # Output public CC0 item identifiers only; never emails, contacts or stored secrets.
    print(json.dumps({
        "mode": "READ_ONLY_DRY_RUN",
        "source": SOURCE_URL,
        "license": RIGHTS_URL,
        "requested_max": limit,
        "unique_domains": len(results),
        "leads": [
            {"domain": domain, "website": website, "evidence": evidence}
            for domain, website, evidence in results
        ],
        "persisted": False,
        "worker_schedule_modified": False,
        "published_companies": 0,
    }, indent=2))
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CC0 Wikidata Italy steel-company discovery (dry-run only)")
    parser.add_argument("--limit", type=int, default=5)
    args = parser.parse_args()
    raise SystemExit(asyncio.run(main(args.limit)))
