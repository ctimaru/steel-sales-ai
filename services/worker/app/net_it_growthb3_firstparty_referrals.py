"""NET-IT-GROWTH.B3.A: bounded first-party industrial ecosystem source discovery.

Use only existing published Italian steel-network companies as crawl ORIGINS.
Visit first-party partner/supply-chain pages (never external targets). Retain
only outbound website domains, NOT names, contacts, text, roles or production
assertions. The existing SEED1 crawler verifies official business evidence.
"""
from __future__ import annotations

import asyncio
import json
import re
from urllib.parse import urljoin, urlsplit

import httpx

from .company_discovery import (
    CompanyDiscoveryError, _fetch_page, canonical_domain, canonicalize_seed_url,
)
from .github_actions_crawler import credentials_from_environment
from .net_it_seed1_pipeline import outbound_company_domains

MAX_SOURCES = 12
MAX_INTERNAL_PAGES = 2
MAX_PER_PAGE = 10
MAX_REFERRALS = 120
MAX_RAW_LINKS = 10_000

# Partner/supplier pages are first-party editorial content, not third-party
# search-engine result pages or downloaded association/member databases.
PARTNER_PATH = re.compile(
    r"/(?:partner|partners|partnership|collaborazion[a-z-]*|"
    r"fornitor[a-z-]*|supply-chain|network|associat[a-z-]*|"
    r"referenz[a-z-]*|soci)(?:[/_-]|$)", re.IGNORECASE
)


def partner_pages(home_url: str, links: tuple[str, ...] | list[str]) -> list[str]:
    """Return at most two unique SAME-DOMAIN safe pages explicitly about partners."""
    source_domain = canonical_domain(home_url)
    seen: set[str] = set()
    out: list[str] = []
    for value in list(links)[:500]:
        if not isinstance(value, str):
            continue
        try:
            u = canonicalize_seed_url(urljoin(home_url, value))
        except (CompanyDiscoveryError, ValueError, TypeError):
            continue
        p = urlsplit(u)
        if (p.scheme != "https" or p.port is not None
                or p.query or p.fragment or u in seen
                or canonical_domain(u) != source_domain
                or not PARTNER_PATH.search(p.path)):
            continue
        seen.add(u)
        out.append(u)
        if len(out) >= MAX_INTERNAL_PAGES:
            break
    return out


def referrals_on_partner_page(
    page_url: str, links: tuple[str, ...] | list[str],
    source_id: str
) -> list[dict[str, str]]:
    """Never copy visible descriptions or names from the referring webpage."""
    if not PARTNER_PATH.search(urlsplit(page_url).path):
        return []
    results = outbound_company_domains(page_url, links, MAX_PER_PAGE)
    return [{
        "domain": i["domain"],
        "homepage": f"https://{i['domain']}/",
        "source_company_id": source_id,
        "evidence_url": page_url,
    } for i in results]


async def rpc(
    api: httpx.AsyncClient, url: str, key: str,
    action: str, data: dict
) -> dict:
    if action not in {"net_it_growthb3_claim_daily",
                      "net_it_growthb3_commit_daily"}:
        raise ValueError("Unexpected B3 action")
    response = await api.post(
        url + "/rest/v1/rpc/" + action, json=data,
        headers={"apikey": key, "Content-Type": "application/json",
                 "Accept": "application/json",
                 "User-Agent": "SmartSteelSales-B3FirstParty/1.0"},
    )
    if response.status_code != 200:
        raise RuntimeError(f"B3 {action} returned HTTP {response.status_code}")
    result = response.json()
    if not isinstance(result, dict):
        raise ValueError("Unexpected B3 RPC contract")
    return result


async def harvest_site(
    web: httpx.AsyncClient, source: dict
) -> tuple[list[dict[str, str]], int, bool]:
    """Fetch max 1 origin+2 partner pages with existing robots/SSRF protection."""
    name = source.get("domain")
    home = source.get("homepage")
    company_id = source.get("company_id")
    if (not isinstance(name, str) or
            not isinstance(home, str) or not isinstance(company_id, str)
            or not re.fullmatch(r"[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}", name)
            or home != f"https://{name}/"):
        raise RuntimeError("Unexpected first-party root")
    page = await _fetch_page(web, home, home)
    if page is None or canonical_domain(page.url) != name:
        return [], 0, True
    raw = len(page.links)
    found: dict[str, dict[str, str]] = {}
    for target in partner_pages(page.url, page.links):
        # Strictly first-party, with robots check again on target URL.
        try:
            partner = await _fetch_page(web, target, home)
        except (httpx.HTTPError, CompanyDiscoveryError, ValueError):
            continue
        if partner is None or canonical_domain(partner.url) != name:
            continue
        raw += len(partner.links)
        for item in referrals_on_partner_page(
            partner.url, partner.links, company_id
        ):
            if item["domain"] != name and item["domain"] not in found:
                found[item["domain"]] = item
                if len(found) >= MAX_PER_PAGE * MAX_INTERNAL_PAGES:
                    break
    return list(found.values()), raw, False


async def main() -> dict:
    base, key = credentials_from_environment()
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(15), follow_redirects=False
    ) as api:
        claim = await rpc(api, base, key, "net_it_growthb3_claim_daily", {})
        if claim.get("contract") != "net-it-growthb3-v1":
            raise RuntimeError("Unexpected B3 claim")
        if claim.get("eligible") is not True:
            report = {"status": "skipped",
                      "reason": claim.get("reason", "source_inactive"),
                      "net_new_to_network": 0, "published": 0}
            print(json.dumps(report, sort_keys=True))
            return report
        roots = claim.get("items")
        if (not isinstance(roots, list) or not 1 <= len(roots) <= MAX_SOURCES
                or claim.get("max_referrals") != MAX_REFERRALS):
            raise RuntimeError("B3 source batch not authorized")
        seen_roots: set[str] = set()
        found: dict[str, dict[str, str]] = {}
        raw_links = 0
        failures = 0
        # Keep one bounded site fetch sequence at a time to avoid bursts.
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(15), follow_redirects=False,
        ) as web:
            for source in roots:
                if not isinstance(source, dict) or source.get("company_id") in seen_roots:
                    raise RuntimeError("Duplicate or malformed first-party root")
                seen_roots.add(source["company_id"])
                try:
                    items, count, failed = await harvest_site(web, source)
                except (httpx.HTTPError, CompanyDiscoveryError, ValueError):
                    items, count, failed = [], 0, True
                raw_links += count
                failures += int(failed)
                for item in items:
                    if item["domain"] not in found:
                        found[item["domain"]] = item
                    if len(found) >= MAX_REFERRALS:
                        break
                if len(found) >= MAX_REFERRALS or raw_links > MAX_RAW_LINKS:
                    break
        # JSON body never includes company name, PII, roles or third-party text.
        result = await rpc(api, base, key, "net_it_growthb3_commit_daily", {
            "p_run_id": claim["run_id"],
            "p_items": list(found.values())[:MAX_REFERRALS],
            "p_metrics": {
                "raw_links": min(raw_links, MAX_RAW_LINKS),
                "failures": min(failures, MAX_SOURCES),
            },
        })
        if (result.get("contract") != "net-it-growthb3-v1"
                or result.get("status") != "completed"
                or result.get("published") != 0):
            raise RuntimeError("B3 commit refused or publication unexpectedly attempted")
        report = {
            "status": "completed", "source_sites": len(roots),
            "pages_links_seen": raw_links,
            "new_unverified_domains": result.get("net_new_to_network", 0),
            "duplicates_or_invalid": result.get("duplicate_or_invalid", 0),
            "source_failures": failures, "published": 0,
        }
        print(json.dumps(report, sort_keys=True))
        return report


if __name__ == "__main__":
    asyncio.run(main())
