"""NET-IT-SEED1: find Italian company websites at scale, stage private candidates.

Two bounded commands, meant to run on a schedule:

  harvest  Read index pages registered by Platform users (association member
           lists, trade-fair exhibitor lists, certification lists) and keep
           ONLY the outbound company domains. An index page is a pointer: no
           names, descriptions or contacts are copied from it.
  crawl    Visit each discovered company's OWN website with the existing
           robots-, SSRF-, redirect- and size-protected crawler, and stage a
           private pending candidate when the site describes a steel company.

Nothing here publishes or approves anything. The database refuses every call
unless a Platform Owner has enabled the NET-IT-SEED1 policy, enforces the
daily cap and deduplicates against the catalogue. Publication remains with the
human publisher, NET-IT-AUTO1 or NET-IT-AUTO3.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
from urllib.parse import urljoin, urlsplit

import httpx

from .company_discovery import (
    MAX_PAGES_PER_DOMAIN, CompanyDiscoveryError, _fetch_page, _priority_links,
    canonical_domain, canonicalize_seed_url, extract_candidate,
)

MAX_SOURCES_PER_RUN = 20
MAX_LINKS_PER_SOURCE = 1000
MAX_BATCH = 100
MAX_BATCHES_PER_RUN = 10
CRAWL_CONCURRENCY = 6
SCAN_LINKS_PER_PAGE = 5000

# Hosts that are never a company's own website: social networks, platforms,
# marketplaces, directories, maps, site builders, public bodies.
BLOCKED_HOSTS = frozenset({
    "facebook.com", "fb.com", "linkedin.com", "instagram.com", "youtube.com",
    "youtu.be", "twitter.com", "x.com", "tiktok.com", "pinterest.com",
    "whatsapp.com", "wa.me", "t.me", "telegram.org", "vimeo.com", "flickr.com",
    "google.com", "google.it", "goo.gl", "g.page", "apple.com", "microsoft.com",
    "bing.com", "amazon.com", "amazon.it", "ebay.it", "wikipedia.org",
    "wikimedia.org", "paginegialle.it", "paginebianche.it", "europages.com",
    "europages.it", "kompass.com", "yelp.com", "yelp.it", "tripadvisor.it",
    "wordpress.com", "wordpress.org", "wix.com", "wixsite.com", "blogspot.com",
    "jimdo.com", "weebly.com", "godaddy.com", "aruba.it", "register.it",
    "cloudflare.com", "iubenda.com", "cookiebot.com", "addthis.com",
    "mailchimp.com", "eventbrite.com", "eventbrite.it", "issuu.com",
    "slideshare.net", "github.com", "adobe.com", "zoom.us", "paypal.com",
    "europa.eu", "gov.it", "camcom.it", "camcom.gov.it", "istat.it",
    "confindustria.it", "bit.ly", "tinyurl.com", "linktr.ee",
})
ITALIAN_VAT = re.compile(r"^(?:IT)?[0-9]{11}$", re.I)
DOMAIN_SHAPE = re.compile(r"^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?\.[a-z]{2,24}$")


def _blocked(domain: str) -> bool:
    return any(domain == host or domain.endswith("." + host) for host in BLOCKED_HOSTS)


def outbound_company_domains(
    source_url: str, links: tuple[str, ...] | list[str], limit: int,
) -> list[dict[str, str]]:
    """Unique outbound https domains seen on an index page, in page order.

    The index page's own domain, social/platform/directory hosts and anything
    that is not a plain public https website are dropped.
    """
    limit = min(max(1, int(limit)), MAX_LINKS_PER_SOURCE)
    source_domain = canonical_domain(source_url)
    found: dict[str, str] = {}
    for raw in list(links)[:SCAN_LINKS_PER_PAGE]:
        try:
            url = canonicalize_seed_url(urljoin(source_url, str(raw)))
        except (CompanyDiscoveryError, ValueError, TypeError):
            continue
        parts = urlsplit(url)
        if parts.scheme != "https" or parts.username or parts.password or parts.port:
            continue
        try:
            domain = canonical_domain(url)
        except (CompanyDiscoveryError, ValueError, TypeError):
            continue
        if (not DOMAIN_SHAPE.match(domain) or domain in found
                or domain == source_domain or domain.endswith("." + source_domain)
                or source_domain.endswith("." + domain) or _blocked(domain)):
            continue
        found[domain] = f"https://{parts.netloc}/"
        if len(found) >= limit:
            break
    return [{"domain": d, "url": u, "evidence": source_url} for d, u in found.items()]


def looks_italian(domain: str, candidate: dict[str, object]) -> bool:
    """Exhibitor and member lists include foreign firms: keep a site only when
    it is on .it or shows an Italian VAT number (11 digits, optional IT)."""
    if domain.endswith(".it"):
        return True
    vat = re.sub(r"[\s.]", "", str(candidate.get("vat_id") or ""))
    return bool(ITALIAN_VAT.match(vat))


class SeedApi:
    """The five NET-IT-SEED1 worker RPCs and nothing else."""
    ALLOWED = frozenset({
        "net_it_seed1_claim_sources", "net_it_seed1_stage",
        "net_it_seed1_claim_batch", "net_it_seed1_record",
        "net_it_seed1_finish_batch",
    })

    def __init__(self, client: httpx.AsyncClient, url: str, key: str) -> None:
        self._client, self._url = client, url
        self._headers = {"apikey": key, "Content-Type": "application/json",
                         "Accept": "application/json",
                         "User-Agent": "SmartSteelSales-SiteFinder/1.0"}
        # Legacy service keys are JWTs and must also be sent as Bearer; the new
        # sb_secret_ keys are NOT JWTs and must never be sent as Bearer.
        if not key.startswith("sb_secret_"):
            self._headers["Authorization"] = f"Bearer {key}"

    async def call(self, name: str, payload: dict[str, object]) -> dict[str, object]:
        if name not in self.ALLOWED:
            raise ValueError("Unexpected RPC")
        response = await self._client.post(
            f"{self._url}/rest/v1/rpc/{name}", headers=self._headers, json=payload)
        # Never echo response bodies: they may contain request metadata.
        if response.status_code != 200:
            raise RuntimeError(f"RPC {name} returned HTTP {response.status_code}")
        value = response.json()
        if not isinstance(value, dict):
            raise RuntimeError(f"RPC {name} returned an unexpected shape")
        return value


def credentials_from_environment() -> tuple[str, str]:
    url = (os.getenv("NET_IT_SEED1_SUPABASE_URL") or os.getenv("SUPABASE_URL") or "").strip().rstrip("/")
    key = (os.getenv("NET_IT_SEED1_SUPABASE_SECRET_KEY")
           or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    parsed = urlsplit(url)
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username
            or parsed.password or parsed.path not in ("", "/") or parsed.query):
        raise RuntimeError("server-side database URL unavailable")
    if len(key) < 32:
        raise RuntimeError("server-side database credential unavailable")
    return url, key


async def harvest(api: SeedApi, web: httpx.AsyncClient, *, max_sources: int,
                  persist: bool) -> dict[str, object]:
    if not 1 <= max_sources <= MAX_SOURCES_PER_RUN:
        raise ValueError("max_sources must be 1..20")
    if not persist:
        # Claiming a source records the visit; a dry run must not do that.
        return {"mode": "harvest", "status": "dry_run_needs_persist", "sources": 0,
                "staged": 0, "published": 0}
    claimed = await api.call("net_it_seed1_claim_sources", {"p_max": max_sources})
    if claimed.get("contract") != "net-it-seed1-sources-v1":
        raise RuntimeError("unexpected sources contract")
    report = {"mode": "harvest", "status": str(claimed.get("status")), "sources": 0,
              "links_found": 0, "staged": 0, "already_known": 0, "unreadable": 0,
              "published": 0}
    for source in claimed.get("items") or []:
        report["sources"] += 1
        try:
            source_url = canonicalize_seed_url(str(source["url"]))
            page = await _fetch_page(web, source_url, source_url)
        except (CompanyDiscoveryError, httpx.HTTPError, ValueError, KeyError):
            page = None
        if page is None:  # robots.txt refusal or unreachable: respect it.
            report["unreadable"] += 1
            continue
        items = outbound_company_domains(page.url, page.links, int(source["max_links"]))
        report["links_found"] += len(items)
        if not items:
            continue
        staged = await api.call("net_it_seed1_stage",
                                {"p_source_id": str(source["id"]), "p_items": items})
        if staged.get("contract") != "net-it-seed1-stage-v1" or staged.get("published") != 0:
            raise RuntimeError("unexpected staging response")
        report["staged"] += int(staged.get("staged", 0))
        report["already_known"] += int(staged.get("already_known", 0))
    return report


async def inspect_site(web: httpx.AsyncClient, item: dict[str, object]) -> tuple[str, dict | None, str | None]:
    """(outcome, candidate, detail) for one company website."""
    domain = str(item["domain"])
    try:
        seed = canonicalize_seed_url(str(item["url"]))
        if canonical_domain(seed) != domain:
            return "error", None, "claimed url is not on the claimed domain"
        home = await _fetch_page(web, seed, seed)
        if home is None:
            return "unreachable", None, "robots refusal or no readable page"
        if canonical_domain(home.url) != domain:
            return "no_candidate", None, "site redirects to another domain"
        pages = [home]
        for link in _priority_links(home)[: MAX_PAGES_PER_DOMAIN - 1]:
            try:
                page = await _fetch_page(web, link, home.url)
            except (CompanyDiscoveryError, httpx.HTTPError, ValueError):
                continue
            if page is not None and canonical_domain(page.url) == domain:
                pages.append(page)
        candidate = extract_candidate(pages[:MAX_PAGES_PER_DOMAIN], "IT")
    except (CompanyDiscoveryError, httpx.HTTPError, ValueError) as exc:
        return "unreachable", None, type(exc).__name__
    if candidate is None:
        return "no_candidate", None, "no steel role evidence on the site"
    if not looks_italian(domain, candidate):
        return "not_italian", None, "no .it domain and no Italian VAT on the site"
    return "candidate", candidate, None


async def crawl(api: SeedApi, web: httpx.AsyncClient, *, limit: int,
                persist: bool) -> dict[str, object]:
    if not 1 <= limit <= MAX_BATCH * MAX_BATCHES_PER_RUN:
        raise ValueError("limit must be 1..1000")
    if not persist:
        return {"mode": "crawl", "status": "dry_run_needs_persist", "visited": 0,
                "candidates": 0, "published": 0}
    report = {"mode": "crawl", "status": "ok", "batches": 0, "visited": 0,
              "candidates": 0, "no_candidate": 0, "not_italian": 0,
              "unreachable": 0, "error": 0, "published": 0}
    gate = asyncio.Semaphore(CRAWL_CONCURRENCY)

    async def one(run_id: str, item: dict[str, object]) -> None:
        async with gate:
            outcome, candidate, detail = await inspect_site(web, item)
            recorded = await api.call("net_it_seed1_record", {
                "p_run_id": run_id, "p_domain": item["domain"], "p_outcome": outcome,
                "p_candidate": candidate, "p_detail": detail})
            if recorded.get("contract") != "net-it-seed1-record-v1" or recorded.get("published") != 0:
                raise RuntimeError("unexpected record response")
            report["visited"] += 1
            report[str(recorded.get("outcome", outcome))] = report.get(
                str(recorded.get("outcome", outcome)), 0) + 1

    remaining = limit
    while remaining > 0 and report["batches"] < MAX_BATCHES_PER_RUN:
        batch = await api.call("net_it_seed1_claim_batch", {"p_max": min(remaining, MAX_BATCH)})
        if batch.get("contract") != "net-it-seed1-batch-v1":
            raise RuntimeError("unexpected batch contract")
        items = batch.get("items") or []
        if batch.get("status") != "ok" or not items:
            report["status"] = str(batch.get("status"))
            break
        run_id = str(batch["run_id"])
        report["batches"] += 1
        try:
            results = await asyncio.gather(*(one(run_id, i) for i in items),
                                           return_exceptions=True)
            report["error"] += sum(isinstance(r, Exception) for r in results)
        finally:
            # Always close the run; unreported websites return to the queue.
            await api.call("net_it_seed1_finish_batch", {"p_run_id": run_id})
        remaining -= len(items)
    report["candidates"] = report.pop("candidate", 0) + report["candidates"]
    return report


async def execute(mode: str, *, limit: int, persist: bool) -> dict[str, object]:
    url, key = credentials_from_environment()
    async with httpx.AsyncClient(timeout=httpx.Timeout(40.0)) as db, \
            httpx.AsyncClient(timeout=httpx.Timeout(10.0), follow_redirects=False) as web:
        api = SeedApi(db, url, key)
        if mode == "harvest":
            return await harvest(api, web, max_sources=limit, persist=persist)
        return await crawl(api, web, limit=limit, persist=persist)


def main() -> int:
    parser = argparse.ArgumentParser(description="NET-IT-SEED1 site finder and first-party stager")
    parser.add_argument("--mode", choices=("harvest", "crawl"), required=True)
    parser.add_argument("--limit", type=int, default=5,
                        help="harvest: index pages (1-20); crawl: websites (1-1000)")
    parser.add_argument("--persist", action="store_true",
                        help="Required to claim work; never publishes profiles")
    args = parser.parse_args()
    try:
        result = asyncio.run(execute(args.mode, limit=args.limit, persist=args.persist))
    except (ValueError, RuntimeError, httpx.HTTPError) as exc:
        print(json.dumps({"status": "seed1_failed", "error_type": type(exc).__name__}))
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
