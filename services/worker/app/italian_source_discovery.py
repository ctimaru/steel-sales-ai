"""Conservative Italy-only lead harvesting from explicitly approved public sources.

Never publishes profiles or crawls proposed company websites. Opt-in only.
"""
from __future__ import annotations

import asyncio
import logging
import os
from contextlib import suppress
from urllib.parse import urljoin, urlsplit

import httpx

from .company_discovery import (
    CompanyDiscoveryService, _fetch_page, canonical_domain, canonicalize_seed_url
)

logger = logging.getLogger(__name__)
MAX_LEADS_PER_SOURCE = 20
POLL_SECONDS = 3600
BLOCKED_HOSTS = frozenset({
    "facebook.com", "linkedin.com", "instagram.com", "youtube.com",
    "google.com", "twitter.com", "x.com", "tiktok.com", "wikipedia.org",
})


def discover_external_domains(source_url: str, links: tuple[str, ...], limit: int = MAX_LEADS_PER_SOURCE) -> list[tuple[str, str]]:
    """Return unique candidate websites, never the source or obvious social links."""
    source_domain = canonical_domain(source_url)
    found: dict[str, str] = {}
    for raw in links[:500]:
        try:
            url = canonicalize_seed_url(urljoin(source_url, raw))
            if urlsplit(url).scheme != "https":
                continue
            domain = canonical_domain(url)
            if domain == source_domain or domain.endswith("." + source_domain):
                continue
            if any(domain == host or domain.endswith("." + host) for host in BLOCKED_HOSTS):
                continue
            if "." not in domain or domain in found:
                continue
            found[domain] = "https://" + urlsplit(url).netloc + "/"
            if len(found) >= min(max(1, limit), MAX_LEADS_PER_SOURCE):
                break
        except (ValueError, TypeError):
            continue
        except Exception as exc:
            # Invalid public targets are ignored; never weaken URL validation.
            if exc.__class__.__name__ != "CompanyDiscoveryError":
                raise
    return list(found.items())


async def harvest_once() -> int:
    service = CompanyDiscoveryService()
    repo = service.repo
    source = await repo._request("POST", "/rest/v1/rpc/crawl_it3_claim_due_source", json={})
    if not isinstance(source, dict) or not source.get("id"):
        return 0
    source_url = canonicalize_seed_url(str(source["source_url"]))
    if urlsplit(source_url).scheme != "https":
        return 0
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
        page = await _fetch_page(client, source_url, source_url)
    if page is None:
        return 0
    n = 0
    for domain, proposed_url in discover_external_domains(
        page.url, page.links, min(int(source["max_domains_per_run"]), MAX_LEADS_PER_SOURCE)
    ):
        # Durable staging with source ID + domain idempotence. Never auto-crawl leads.
        await repo._request(
            "POST",
            "/rest/v1/network_discovery_domain_leads?on_conflict=source_id,domain",
            json={
                "source_id": str(source["id"]), "country_code": "IT",
                "domain": domain, "proposed_url": proposed_url,
                "evidence_url": page.url, "status": "pending_review",
            },
            prefer="resolution=ignore-duplicates,return=minimal",
        )
        n += 1
    return n


async def approved_source_harvest_loop() -> None:
    while True:
        try:
            await harvest_once()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("CRAWL-IT3 source harvest failed (no approval or publication performed)")
        await asyncio.sleep(POLL_SECONDS)


def install_italian_source_harvester(app) -> None:
    if getattr(app.state, "crawl_it3_installed", False):
        return
    app.state.crawl_it3_installed = True

    @app.on_event("startup")
    async def start() -> None:
        if os.getenv("CRAWL_IT3_ENABLED", "false").lower() not in {"true", "1", "yes"}:
            return
        app.state.crawl_it3_task = asyncio.create_task(approved_source_harvest_loop())

    @app.on_event("shutdown")
    async def stop() -> None:
        task = getattr(app.state, "crawl_it3_task", None)
        if task:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
