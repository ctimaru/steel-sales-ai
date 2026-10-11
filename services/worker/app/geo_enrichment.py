"""CRAWL-IT6.2: strictly bounded, manual-only geographic evidence extraction.

Dry run is default. Worker token required. Only the company's exact known website
is requested, with robots.txt and SSRF protections inherited from the crawler.
Never writes network_facilities or publishes company data.
"""
from __future__ import annotations

from typing import Annotated
from urllib.parse import quote, urlsplit

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .bulk_import import _require_worker_token
from .company_discovery import (
    CompanyDiscoveryError, _fetch_page, _structured_facilities,
    canonical_domain, canonicalize_seed_url,
)
from .repository import WorkerRepository

router = APIRouter(prefix="/v1/network/geo-enrichment", tags=["geo-enrichment"])


class GeoEnrichmentRequest(BaseModel):
    dry_run: bool = True
    limit: int = Field(default=5, ge=1, le=5)


class GeoEnrichmentResult(BaseModel):
    checked: int = 0
    candidates: int = 0
    staged: int = 0
    skipped: int = 0
    errors: int = 0
    dry_run: bool = True


def evidence_rows(company: dict, website: str, page) -> list[dict]:
    domain = canonical_domain(website)
    if canonical_domain(page.url) != domain:
        return []
    rows = []
    for place in _structured_facilities([page], "IT"):
        if place.get("country_code") != "IT" or not place.get("city"):
            continue
        # Source must be the actual known company domain, not a third-party listing.
        source = str(place.get("source_url") or "")
        if canonical_domain(source) != domain:
            continue
        city = str(place["city"]).strip()
        address = str(place.get("address_line_1") or "").strip() or None
        snippet = f"Official site JSON-LD PostalAddress: {city}; {address or 'street unspecified'}"
        rows.append({
            "company_id": company["id"],
            "source_url": source,
            "source_kind": "company_json_ld",
            "source_company_domain": domain,
            "facility_name": place.get("name"),
            "city": city,
            "province_code": place.get("province_code"),
            "region": place.get("region"),
            "postal_code": place.get("postal_code"),
            "address_line_1": address,
            "evidence_snippet": snippet[:1500],
            "status": "pending_review",
        })
    return rows[:3]


async def run_geo_enrichment(payload: GeoEnrichmentRequest) -> GeoEnrichmentResult:
    repo = WorkerRepository()
    result = GeoEnrichmentResult(dry_run=payload.dry_run)
    # A small, deterministic batch: Italian, published, website-bearing companies.
    # Skip those with a published facility or any prior geo evidence candidate.
    companies = await repo._request(
        "GET", "/rest/v1/network_companies?select=id,website_url,website_domain"
        "&country_code=eq.IT&publication_status=eq.published"
        "&archived_at=is.null&website_url=not.is.null"
        "&order=id.asc&limit=100",
    )
    if not isinstance(companies, list):
        raise RuntimeError("unexpected Network result")
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
        for company in companies:
            if result.checked >= payload.limit:
                break
            company_id = str(company["id"])
            facilities = await repo._request(
                "GET", f"/rest/v1/network_facilities?company_id=eq.{company_id}"
                "&archived_at=is.null&publication_status=eq.published&select=id&limit=1",
            )
            existing = await repo._request(
                "GET", f"/rest/v1/network_it_geo_evidence_candidates?company_id=eq.{company_id}"
                "&select=id&limit=1",
            )
            if facilities or existing:
                continue
            website = str(company.get("website_url") or "")
            try:
                normalized = canonicalize_seed_url(website)
                if urlsplit(normalized).scheme != "https":
                    result.skipped += 1
                    continue
                domain = canonical_domain(normalized)
                if domain != str(company.get("website_domain") or "").lower().removeprefix("www."):
                    result.skipped += 1
                    continue
                result.checked += 1
                page = await _fetch_page(client, normalized, normalized)
                if page is None:
                    result.skipped += 1
                    continue
                rows = evidence_rows(company, normalized, page)
                result.candidates += len(rows)
                if not payload.dry_run:
                    for row in rows:
                        # Race-safe dedup at application boundary and review remains mandatory.
                        await repo._request(
                            "POST", "/rest/v1/network_it_geo_evidence_candidates",
                            json=row, prefer="return=minimal",
                        )
                        result.staged += 1
            except (CompanyDiscoveryError, httpx.HTTPError, ValueError):
                result.errors += 1
    return result


@router.post("/existing-companies", response_model=GeoEnrichmentResult)
async def enrich_existing_companies(
    payload: GeoEnrichmentRequest,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> GeoEnrichmentResult:
    _require_worker_token(x_worker_token)
    try:
        return await run_geo_enrichment(payload)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="geographic enrichment unavailable") from exc
