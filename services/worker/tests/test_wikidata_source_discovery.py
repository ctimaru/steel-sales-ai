"""CRAWL-IT6.5 CC0 one-shot source adapter — network mocked, no production writes."""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.wikidata_source_discovery import (
    SOURCE_URL, QUERY, MAX_RESULTS, parse_steel_italy_bindings, preview_wikidata_steel_italy,
)
from app.italian_source_discovery import harvest_once


def fixture():
    def row(qid, site):
        return {"item":{"type":"uri","value":"https://www.wikidata.org/entity/"+qid},
                "website":{"type":"uri","value":site}}
    return {"results":{"bindings":[
        row("Q12345","https://example-steel.it/about"),
        row("Q98765","https://www.example-steel.it/"),
        row("Q12346","http://unsafe-steel.it"),
        row("Q12347","https://linkedin.com/company/steel"),
        row("Q12348","https://other-tubes.it/"),
        row("bad-id","https://bad.example/"),
        row("Q12349","https://127.0.0.1/admin"),
    ]}}


def test_one_query_and_no_contacts_or_unbounded_sweep():
    assert "wdt:P17 wd:Q38" in QUERY and "wdt:P452 wd:Q2285982" in QUERY
    assert "wdt:P856 ?website" in QUERY and "LIMIT 20" in QUERY
    assert "email" not in QUERY.lower()
    assert MAX_RESULTS == 20


def test_parser_only_https_company_websites_and_provenance():
    rows = parse_steel_italy_bindings(fixture(),limit=5)
    assert rows == [
        ("example-steel.it","https://example-steel.it/","https://www.wikidata.org/wiki/Q12345"),
        ("other-tubes.it","https://other-tubes.it/","https://www.wikidata.org/wiki/Q12348"),
    ]
    assert parse_steel_italy_bindings(fixture(),1) == rows[:1]
    for limit in (0,21,999):
        with pytest.raises(ValueError):
            parse_steel_italy_bindings(fixture(),limit)


def test_preview_one_http_request_and_honors_429_no_retry():
    def handler(request):
        assert request.url.host=="query.wikidata.org"
        assert request.headers["user-agent"].startswith("SmartSteelSales-DiscoveryPilot/")
        assert request.url.params["format"]=="json"
        assert request.url.params["query"]==QUERY
        return httpx.Response(200,json=fixture())
    mock = httpx.MockTransport(handler)
    with patch("app.wikidata_source_discovery.httpx.AsyncClient",
        side_effect=lambda **kw:httpx.AsyncClient(transport=mock, **kw)):
        pass
    # patch the class with a fixed real client (avoids recursion) in controlled scope.
    client = httpx.AsyncClient(transport=mock,follow_redirects=False)
    with patch("app.wikidata_source_discovery.httpx.AsyncClient",return_value=client):
        rows=asyncio.run(preview_wikidata_steel_italy(limit=5))
    assert len(rows)==2
    blocked=httpx.AsyncClient(transport=httpx.MockTransport(
        lambda req:httpx.Response(429,headers={"Retry-After":"600"})),follow_redirects=False)
    with patch("app.wikidata_source_discovery.httpx.AsyncClient",return_value=blocked):
        with pytest.raises(RuntimeError,match="HTTP 429"):
            asyncio.run(preview_wikidata_steel_italy(limit=5))


def test_worker_claim_requires_source_then_stages_only_unmatched():
    requests=[]
    class Repo:
        async def _request(self,method,path,**kwargs):
            requests.append((method,path,kwargs))
            if path.endswith("/rpc/crawl_it3_claim_due_source"):
                return {"id":"00000000-0000-0000-0000-000000006500",
                        "source_url":SOURCE_URL,"max_domains_per_run":5}
            if "website_domain=eq.example-steel.it" in path:
                return [{"id":"already-network"}]
            if method=="GET":return []
            return None
    class Service:repo=Repo()
    with patch("app.italian_source_discovery.CompanyDiscoveryService",return_value=Service()),patch(
        "app.italian_source_discovery.preview_wikidata_steel_italy",
        new_callable=AsyncMock,
        return_value=parse_steel_italy_bindings(fixture(),limit=5)
    ) as preview:
        count=asyncio.run(harvest_once())
    assert count==1
    preview.assert_awaited_once_with(limit=5)
    stage=[(p,k) for method,p,k in requests if method=="POST" and "network_discovery_domain_leads" in p]
    assert len(stage)==1
    assert stage[0][1]["json"]["domain"]=="other-tubes.it"
    assert stage[0][1]["json"]["evidence_url"]=="https://www.wikidata.org/wiki/Q12348"
    assert stage[0][1]["json"]["status"]=="pending_review"
    assert all("network_companies" not in p for method,p,k in requests if method=="POST")


def test_worker_no_claim_no_wikidata_fetch():
    class Repo:
        async def _request(self,method,path,**kw):
            assert method=="POST" and path.endswith("/rpc/crawl_it3_claim_due_source")
            return None
    class Service:repo=Repo()
    with patch("app.italian_source_discovery.CompanyDiscoveryService",return_value=Service()),patch(
        "app.italian_source_discovery.preview_wikidata_steel_italy",new_callable=AsyncMock
    ) as preview:
        assert asyncio.run(harvest_once())==0
    preview.assert_not_awaited()
