from __future__ import annotations

import asyncio
from unittest.mock import patch

from app.italian_source_discovery import (
    discover_external_domains, harvest_once, MAX_LEADS_PER_SOURCE,
)


def test_harvest_respects_source_boundary_dedup_and_budget() -> None:
    links = (
        "/internal", "https://association.example/member",
        "https://www.new-tubes.it/azienda",
        "https://new-tubes.it/contatti",
        "https://linkedin.com/company/example",
        "http://insecure.example/",
        "https://other-factory.it/about",
        "http://127.0.0.1/admin",
    )
    out = discover_external_domains("https://association.example/members", links)
    assert [domain for domain, _ in out] == ["new-tubes.it", "other-factory.it"]
    assert out[0][1] == "https://www.new-tubes.it/"
    assert len(out) <= MAX_LEADS_PER_SOURCE
    assert len(discover_external_domains("https://association.example/", links, limit=1)) == 1


def test_harvest_opt_in_defaults_off() -> None:
    import inspect
    from app.italian_source_discovery import install_italian_source_harvester
    body = inspect.getsource(install_italian_source_harvester)
    assert 'os.getenv("CRAWL_IT3_ENABLED", "false")' in body


def test_no_approved_source_does_not_fetch_or_write() -> None:
    class FakeRepo:
        async def _request(self, method, url, **kwargs):
            assert method == "POST"
            assert url.endswith("/rpc/crawl_it3_claim_due_source")
            return None
    class FakeService:
        repo = FakeRepo()
    with patch("app.italian_source_discovery.CompanyDiscoveryService", return_value=FakeService()):
        assert asyncio.run(harvest_once()) == 0
