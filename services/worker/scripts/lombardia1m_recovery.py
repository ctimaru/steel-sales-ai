"""Bounded read-only recovery audit for first-party sites, no DB credentials."""
from __future__ import annotations
import asyncio
import csv
from pathlib import Path
from urllib.robotparser import RobotFileParser
import httpx
from app.company_discovery import (
    CompanyDiscoveryError, USER_AGENT, _request_public_url,
)
from app.net_it_seed1_pipeline import inspect_site

ROOT = Path(__file__).resolve().parents[1]

async def inspect(web, domain):
    url = "https://" + domain + "/"
    try:
        response, final = await _request_public_url(web, url + "robots.txt")
    except httpx.TimeoutException:
        return domain, "robots_timeout", "not_crawled"
    except (httpx.HTTPError, CompanyDiscoveryError, ValueError):
        return domain, "robots_unavailable", "not_crawled"
    if response.status_code not in (404, 410):
        if response.status_code >= 400:
            return domain, "robots_http_" + str(response.status_code), "not_crawled"
        parser = RobotFileParser()
        parser.set_url(final)
        parser.parse(response.text.splitlines())
        if not parser.can_fetch(USER_AGENT, url):
            return domain, "robots_disallow", "not_crawled"
    # The production crawler repeats its own robots, network and content gates.
    # Do not try an alternate hostname or bypass a refusal.
    try:
        outcome, candidate, detail = await inspect_site(web, {"domain": domain, "url": url})
        return domain, "robots_allowed", outcome
    except Exception:
        return domain, "robots_allowed", "error"

async def main():
    domains = sorted(set((ROOT / "audits/net_it_lombardia1m_recovery_targets.txt").read_text().splitlines()))
    assert 0 < len(domains) <= 100
    gate = asyncio.Semaphore(4)
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0), follow_redirects=False) as web:
        async def one(domain):
            async with gate:
                return await inspect(web, domain)
        rows = await asyncio.gather(*(one(domain) for domain in domains))
    with (ROOT / "audits/net_it_lombardia1m_recovery_results.csv").open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(("domain","robots_result","crawler_outcome"))
        writer.writerows(rows)
    print(f"targets={len(rows)} recoverable={sum(row[2]=='candidate' for row in rows)} published=0")

if __name__ == "__main__":
    asyncio.run(main())
