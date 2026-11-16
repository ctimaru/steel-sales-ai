"""NET-IT-PIEMONTE2: automated first-party contact-page geography research.

Never publishes or approves companies/facilities. The maintenance geo-agent
alone may publish an unverified location after ISTAT, identity and ledger
validation. Uses the existing robots/SSRF/redirect/size protected crawler.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
from dataclasses import dataclass
from urllib.parse import urljoin
from uuid import UUID

import httpx

from .company_discovery import (
    CompanyDiscoveryError, _fetch_page, _redact_personal_channels,
    canonical_domain, canonicalize_seed_url,
)
from .netcompact4b_geo_batch import ADDRESS_RE, contact_links

MAX_SITES = 10
MAX_PAGES = 4
POSTAL_CONTEXT = (
    "via", "viale", "strada", "sede", "indirizzo", "piazza",
    "corso", "zona", "area", "loc.", "località", "contrada",
)


@dataclass(frozen=True)
class Locality:
    source_url: str
    excerpt: str
    postal_code: str
    city: str
    province_code: str


def first_party_text_localities(pages: list[object], domain: str) -> list[Locality]:
    """Extract only explicit postal addresses from the same company website.

    Do not infer that the company operates in a region from an SEO title,
    generic marketing text or the postal code by itself.
    """
    found: dict[tuple[str, str, str], Locality] = {}
    for page in pages[:MAX_PAGES]:
        url = str(getattr(page, "url", ""))
        try:
            if canonical_domain(url) != domain or not url.startswith("https://"):
                continue
        except (CompanyDiscoveryError, ValueError, TypeError):
            continue
        text = str(getattr(page, "text", ""))[:24000]
        for match in list(ADDRESS_RE.finditer(text))[:12]:
            postal = match.group(0)[:5]
            city = " ".join(match.group(1).split()).strip(" ,.-")
            province = match.group(2).upper()
            if not (postal.isdigit() and len(postal) == 5
                    and 2 <= len(city) <= 120 and len(province) == 2):
                continue
            prefix = text[max(0, match.start()-95):match.start()]
            if not any(hint in prefix.casefold() for hint in POSTAL_CONTEXT):
                continue
            # A generic phone redactor can mistake "12 - 10100" (street
            # number + postcode) for a long phone number and erase the CAP.
            # Redact the surrounding channels separately, preserving only the
            # explicit, already-public postal tuple matched by ADDRESS_RE.
            before_address = _redact_personal_channels(
                text[max(0, match.start()-45):match.start()]
            )
            after_address = _redact_personal_channels(
                text[match.end():min(len(text), match.end()+30)]
            )
            excerpt = " ".join(
                (before_address + " " + match.group(0) + " " + after_address).split()
            )[:420]
            if not (18 <= len(excerpt) <= 500 and postal in excerpt
                    and city.casefold() in excerpt.casefold()
                    and f"({province})" in excerpt):
                continue
            found[(city.casefold(), province, postal)] = Locality(
                source_url=url, excerpt=excerpt, postal_code=postal,
                city=city, province_code=province,
            )
    return list(found.values())


async def inspect_company(client: httpx.AsyncClient, item: dict) -> dict:
    """No promotion; only a bounded public postal observation or safe exception."""
    domain = str(item["domain"]).lower().strip()
    site = canonicalize_seed_url(str(item["site"]))
    if canonical_domain(site) != domain or not site.startswith("https://"):
        raise ValueError("claim provided a non-first-party website")

    pages = []
    try:
        home = await _fetch_page(client, site, site)
    except (CompanyDiscoveryError, httpx.HTTPError, ValueError):
        home = None
    if not home or canonical_domain(home.url) != domain:
        return {"status": "blocked", "pages": 0}

    pages.append(home)
    discovered = contact_links(home, domain)
    # Some compact/JS sites omit their contact URL from the static home links.
    # Probe a MAXIMUM of two conventional HTTPS paths, through the same
    # robots/SSRF/DNS-protected fetcher, never by unrestricted HTTP requests.
    if len(discovered) < 2:
        for path in ("/contatti/", "/contact/"):
            candidate = canonicalize_seed_url(urljoin(site, path))
            if candidate not in discovered and candidate != site:
                discovered.append(candidate)
            if len(discovered) >= 3:
                break

    for link in discovered[:MAX_PAGES-1]:
        try:
            page = await _fetch_page(client, link, site)
            if page is not None and canonical_domain(page.url) == domain \
                    and page.url.startswith("https://"):
                pages.append(page)
        except (CompanyDiscoveryError, httpx.HTTPError, ValueError):
            continue

    localities = first_party_text_localities(pages, domain)
    if not localities:
        return {"status": "no_evidence", "pages": len(pages)}
    if len(localities) != 1:
        return {"status": "multiple_localities", "pages": len(pages)}
    proof = localities[0]
    return {
        "status": "sourced", "pages": len(pages),
        "source_url": proof.source_url, "excerpt": proof.excerpt,
        "postal_code": proof.postal_code, "city": proof.city,
        "province_code": proof.province_code,
    }


async def run(*, limit: int = MAX_SITES, persist: bool = False) -> dict:
    if not 1 <= limit <= MAX_SITES:
        raise ValueError("bounded site limit must be 1..10")
    if not persist:
        return {"contract": "net-it-piemonte2-worker-v1",
                "status": "dry_run", "claimed": 0, "published": 0}
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    if not url.startswith("https://") or not key:
        raise ValueError("worker-only database configuration missing")
    headers = {
        "apikey": key, "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    report = {
        "contract": "net-it-piemonte2-worker-v1",
        "status": "ok", "claimed": 0, "processed": 0,
        "recorded": 0, "multiple_localities": 0,
        "no_evidence": 0, "blocked": 0, "errors": 0, "published": 0,
    }
    async with httpx.AsyncClient(timeout=httpx.Timeout(35.0)) as db, \
            httpx.AsyncClient(timeout=httpx.Timeout(12.0),
                              follow_redirects=False) as web:
        reply = await db.post(f"{url}/rest/v1/rpc/net_it_piemonte2_contact_claim",
                              headers=headers, json={"p_max": limit})
        reply.raise_for_status()
        batch = reply.json()
        if batch.get("contract") != "net-it-piemonte2-contact-claim-v1":
            raise RuntimeError("unexpected private contact research queue contract")
        items = batch.get("items")
        if not isinstance(items, list) or len(items) > limit \
                or batch.get("published") != 0:
            raise RuntimeError("unbounded or publishing queue is forbidden")
        report["claimed"] = len(items)

        for index, item in enumerate(items):
            if index:
                await asyncio.sleep(0.4)
            try:
                UUID(str(item["company_id"]))
                UUID(str(item["claim_token"]))
                result = await inspect_company(web, item)
                body = {
                    "p_company_id": item["company_id"],
                    "p_claim_token": item["claim_token"],
                    "p_status": result["status"],
                    "p_pages": result["pages"],
                    "p_source_url": result.get("source_url"),
                    "p_excerpt": result.get("excerpt"),
                    "p_postal_code": result.get("postal_code"),
                    "p_city": result.get("city"),
                    "p_province_code": result.get("province_code"),
                }
                saved = await db.post(
                    f"{url}/rest/v1/rpc/net_it_piemonte2_contact_record",
                    headers=headers, json=body,
                )
                saved.raise_for_status()
                result_db = saved.json()
                if result_db.get("contract") != "net-it-piemonte2-contact-record-v1" \
                        or result_db.get("published") != 0:
                    raise RuntimeError("unexpected geographic record result")
                report["processed"] += 1
                report[result["status"]] = report.get(result["status"], 0) + 1
                report["recorded"] += int(result_db.get("observations_recorded", 0))
            except (ValueError, KeyError, TypeError, httpx.HTTPError, RuntimeError):
                report["errors"] += 1
                # Fail closed. The claim expires and is retryable after its
                # bounded cooldown; do not forge a status/evidence to unblock it.
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Piemonte first-party contact research")
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--persist", action="store_true",
                        help="Claim and record only private sourced observations")
    args = parser.parse_args()
    try:
        output = asyncio.run(run(limit=args.limit, persist=args.persist))
    except (RuntimeError, KeyError, ValueError, httpx.HTTPError) as exc:
        print(json.dumps({"status": "research_failed",
                          "error_type": type(exc).__name__}))
        return 1
    print(json.dumps(output, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
