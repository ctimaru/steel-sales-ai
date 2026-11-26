"""NET-VAT1 fase 2: collect the P.IVA from the official website of published
Italian Network companies that do not have one yet.

Founder decision (26 nov 2026). Each cron run:
1. sweeps P.IVA already found by other pipelines on published candidates;
2. leases up to --limit companies and visits only their own HTTPS domain:
   homepage plus legal/contact pages (Contatti, Note legali, Privacy...),
   through the existing robots-, SSRF-, redirect- and size-protected fetcher;
3. records one outcome per company. The database writes the profile only via
   private.net_vat1_apply (check digit, official domain, never overwrites).
Read-only with --dry-run: nothing is leased or recorded.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os

import httpx

from .company_discovery import CompanyDiscoveryError, _fetch_page, canonical_domain, canonicalize_seed_url
from .net_it_auto2_reviewer import _identity_links
from .net_vat1_extract import find_firstparty_vat

VERSION = "net-vat1-collector-v1"
MAX_BATCH = 50
MAX_PAGES = 6


async def scan_company(client: httpx.AsyncClient, company: dict) -> dict:
    """Return {'outcome', 'vat', 'page_url'} for one company, never raising."""
    domain = str(company.get("domain") or "").lower().removeprefix("www.")
    try:
        home_url = canonicalize_seed_url(str(company["website_url"]))
    except (KeyError, TypeError, ValueError, CompanyDiscoveryError):
        return {"outcome": "unreachable"}
    if not domain or canonical_domain(home_url) != domain or not home_url.startswith("https://"):
        return {"outcome": "unreachable"}
    try:
        home = await _fetch_page(client, home_url, home_url)
    except (CompanyDiscoveryError, httpx.HTTPError, ValueError):
        home = None
    if not home or canonical_domain(home.url) != domain:
        return {"outcome": "unreachable"}
    pages = [home]
    for link in _identity_links(home, MAX_PAGES - 1):
        try:
            page = await _fetch_page(client, link, home.url)
        except (CompanyDiscoveryError, httpx.HTTPError, ValueError):
            continue
        if page and canonical_domain(page.url) == domain:
            pages.append(page)
    finding = find_firstparty_vat([str(p.text) for p in pages], str(company.get("legal_name") or ""))
    if finding.outcome != "found" or finding.page_index is None:
        return {"outcome": finding.outcome}
    page_url = pages[finding.page_index].url
    if not page_url.startswith("https://"):
        return {"outcome": "unreachable"}
    return {"outcome": "found", "vat": finding.vat_id, "page_url": page_url}


async def scan_batch(companies: list[dict], *, pause_seconds: float = 0.3) -> list[dict]:
    semaphore = asyncio.Semaphore(4)
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0), follow_redirects=False) as client:
        async def one(index: int, company: dict) -> dict:
            async with semaphore:
                if index and pause_seconds:
                    await asyncio.sleep(pause_seconds)
                try:
                    result = await scan_company(client, company)
                except Exception:  # one broken site must not stop the batch
                    result = {"outcome": "unreachable"}
                return {"id": str(company.get("id")), **result}
        return list(await asyncio.gather(*(one(i, c) for i, c in enumerate(companies))))


async def execute(*, limit: int = 40, dry_run: bool = False) -> dict:
    if limit not in range(1, MAX_BATCH + 1):
        raise ValueError("limit must be 1..50")
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise RuntimeError("server-side database credential unavailable")
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    summary: dict[str, object] = {"version": VERSION, "dry_run": dry_run}
    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as db:
        if not dry_run:
            sweep = await db.post(f"{url}/rest/v1/rpc/net_vat1_sweep", headers=headers, json={"p_max": 500})
            sweep.raise_for_status()
            summary["sweep"] = sweep.json().get("outcomes", {})
            queue = await db.post(f"{url}/rest/v1/rpc/net_vat1_scan_queue", headers=headers,
                                  json={"p_max": limit})
            queue.raise_for_status()
            payload = queue.json()
            if payload.get("contract") != "net-vat1-scan-queue-v1":
                raise RuntimeError("unexpected scan queue contract")
            companies = payload.get("items", [])
        else:
            response = await db.get(
                f"{url}/rest/v1/network_companies", headers=headers,
                params={"select": "id,website_url,website_domain,legal_name", "country_code": "eq.IT",
                        "publication_status": "eq.published", "archived_at": "is.null",
                        "vat_id": "is.null", "limit": str(limit)})
            response.raise_for_status()
            companies = [{**row, "domain": row.get("website_domain")} for row in response.json()]
        results = await scan_batch(companies) if companies else []
        outcomes: dict[str, int] = {}
        for result in results:
            outcome = result["outcome"]
            if not dry_run:
                record = await db.post(
                    f"{url}/rest/v1/rpc/net_vat1_record_scan", headers=headers,
                    json={"p_company_id": result["id"], "p_vat": result.get("vat"),
                          "p_page_url": result.get("page_url"), "p_outcome": outcome})
                record.raise_for_status()
                outcome = str(record.json().get("outcome") or outcome)
            outcomes[outcome] = outcomes.get(outcome, 0) + 1
    summary.update({"scanned": len(results), "outcomes": outcomes})
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="NET-VAT1 official-site P.IVA collector")
    parser.add_argument("--limit", type=int, default=40, help="Companies per run, maximum 50")
    parser.add_argument("--dry-run", action="store_true", help="Read and scan only, record nothing")
    args = parser.parse_args()
    try:
        result = asyncio.run(execute(limit=args.limit, dry_run=args.dry_run))
    except (ValueError, RuntimeError, httpx.HTTPError) as exc:
        print(json.dumps({"status": "vat_collection_failed", "error_type": type(exc).__name__}))
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
