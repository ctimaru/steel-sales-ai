from __future__ import annotations

import asyncio
from unittest.mock import patch

from app.company_discovery import CrawledPage
from app.geo_enrichment import GeoEnrichmentRequest, evidence_rows, run_geo_enrichment


def page(url: str, country: str = "IT") -> CrawledPage:
    return CrawledPage(
        url=url, title=None, site_name=None, meta_description=None,
        h1=None, text="", links=(),
        structured_data=({
            "@type": "Organization",
            "name": "Test Tubi S.r.l.",
            "address": {
                "@type": "PostalAddress",
                "streetAddress": "Via Test 10",
                "addressLocality": "Milano",
                "addressRegion": "MI",
                "postalCode": "20100",
                "addressCountry": country,
            },
        },),
    )


def test_only_matching_domain_italian_address_is_staged():
    company = {"id": "c0000000-0000-0000-0000-000000000001"}
    rows = evidence_rows(company, "https://www.testtubi.it/", page("https://www.testtubi.it/"))
    assert len(rows) == 1
    assert rows[0]["city"] == "Milano"
    assert rows[0]["province_code"] == "MI"
    assert rows[0]["status"] == "pending_review"
    assert rows[0]["source_kind"] == "company_json_ld"
    assert evidence_rows(company, "https://www.testtubi.it/", page("https://attacker.example/")) == []
    assert evidence_rows(company, "https://www.testtubi.it/", page("https://www.testtubi.it/", "FR")) == []


def test_default_dry_run_and_hard_limit():
    request = GeoEnrichmentRequest()
    assert request.dry_run is True
    assert request.limit == 5
    from pydantic import ValidationError
    try:
        GeoEnrichmentRequest(limit=6)
        assert False, "excessive batch accepted"
    except ValidationError:
        pass


def test_dry_run_never_writes():
    class FakeRepo:
        async def _request(self, method, url, **kwargs):
            assert method == "GET"
            if "network_companies?" in url:
                return [{"id": "c0000000-0000-0000-0000-000000000001",
                         "website_url": "https://testtubi.it",
                         "website_domain": "testtubi.it"}]
            return []
    async def fake_fetch(_client, _url, _base):
        return page("https://testtubi.it")
    with patch("app.geo_enrichment.WorkerRepository", return_value=FakeRepo()), patch(
        "app.geo_enrichment._fetch_page", side_effect=fake_fetch
    ):
        result = asyncio.run(run_geo_enrichment(GeoEnrichmentRequest(limit=1)))
    assert result.checked == 1
    assert result.candidates == 1
    assert result.staged == 0
