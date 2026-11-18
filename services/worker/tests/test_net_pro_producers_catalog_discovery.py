"""Catalogue discovery: first-party only, bounded, reviewable source leads."""
from __future__ import annotations
from pathlib import Path
import pytest

from app.net_pro_producers_catalog_discovery import (
    DiscoveryProblem,_official_url,_parse_links,_discover_one,
    _read_firstparty_bytes,_lease,run_catalogue_discovery,
)
from app.net_pro_producers_auto1 import main as producer_main

ROOT=Path(__file__).resolve().parents[3]
SQL=(ROOT/"supabase/migrations"/
     "20261118195000_net_producers_all_catalog_discovery_queue.sql").read_text()


def test_official_url_rejects_cross_domain_and_private_network_and_creds():
    domain="tubificio.it"
    assert _official_url("https://tubificio.it/files/specs.pdf",domain)
    assert _official_url("https://www.tubificio.it/download/steel.pdf",domain)
    for bad in (
        "http://tubificio.it/file.pdf",
        "https://tubificio.it.evil.org/file.pdf",
        "https://private.net/file.pdf","https://127.0.0.1/file.pdf",
        "https://username:pass@tubificio.it/file.pdf",
        "https://tubificio.it:8443/file.pdf",
        "https://tubificio.it/file.pdf#fragment",
    ):
        assert not _official_url(bad,domain),bad


def test_links_are_from_first_party_and_steel_related_pdf_not_privacy_or_adverts():
    html=b"""
    <html><body><h2>Steel tubes, hollow sections and pipe manufacturing</h2>
    <a href="/files/steel_tubes_catalogue.pdf">Technical catalogue EN 10219</a>
    <a href="https://tubificio.it/tech/steel.pdf">Steel technical PDF</a>
    <a href="https://other.com/tubes.pdf">Off-site catalogue</a>
    <a href="https://tubificio.it.evil.com/steel.pdf">Lookalike</a>
    <a href="/legal/terms.pdf">Legal terms</a>
    <a href="/cataloghi">Cataloghi</a>
    <a href="/prodotti">Prodotti</a>
    </body></html>
    """
    links,pages,industrial=_parse_links(html,"https://tubificio.it/","tubificio.it")
    assert industrial
    assert {x["url"] for x in links}=={
        "https://tubificio.it/files/steel_tubes_catalogue.pdf",
        "https://tubificio.it/tech/steel.pdf",
    }
    assert all(x["discovery_page_url"]=="https://tubificio.it/" for x in links)
    assert "https://tubificio.it/cataloghi" in pages


def test_false_producer_role_cannot_publish_unrelated_downloads():
    html=b"""<h1>Microscopes and cameras</h1>
    <a href="/manuals/catalog.pdf">General catalogue</a>
    <a href="https://offsite.com/tubes.pdf">Third-party tubes</a>"""
    links,_,industrial=_parse_links(html,"https://zeiss.it/","zeiss.it")
    assert not industrial
    assert links==[]


def test_company_leases_are_explicitly_validated():
    valid={
      "company_id":"00000000-0000-4000-8000-000000000001",
      "lease_token":"00000000-0000-4000-8000-000000000002",
      "canonical_domain":"tubificio.it",
      "homepage":"https://tubificio.it/",
    }
    assert _lease(valid) is valid
    with pytest.raises(DiscoveryProblem):
      _lease({**valid,"homepage":"https://evil.com/"})
    with pytest.raises(DiscoveryProblem):
      _lease({**valid,"canonical_domain":"127.0.0.1"})


def test_worker_persists_no_catalog_without_fabricated_links(monkeypatch):
    import asyncio
    import app.net_pro_producers_catalog_discovery as discovery
    lease={
      "company_id":"00000000-0000-4000-8000-000000000001",
      "lease_token":"00000000-0000-4000-8000-000000000002",
      "canonical_domain":"tubificio.it","homepage":"https://tubificio.it/",
    }
    monkeypatch.setattr(discovery,"_discover_one",lambda _:([],"none_found",None))
    class FakeDB:
      def __init__(self):self.calls=[]
      def rpc(self,name,args):
        assert name=="netproducers_catalog_discovery"
        self.calls.append(args)
        op=args["p_operation"]
        payload=args["p_payload"]
        if op=="seed":data={"contract":discovery.CONTRACT,"operation":"seed","added":0}
        elif op=="claim":data={"contract":discovery.CONTRACT,"operation":"claim","count":1,"items":[lease]}
        elif op=="complete":
          assert payload["status"]=="none_found"
          assert "links" not in payload
          data={"contract":discovery.CONTRACT,"operation":"complete","added":0}
        else:raise AssertionError(op)
        class Result:
          def execute(self):
            self.data=data
            return self
        return Result()
    db=FakeDB()
    result=asyncio.run(discovery.run_catalogue_discovery(db,limit=1))
    assert result["sites_checked"]==1
    assert result["catalog_links_added"]==result["claims_of_manufacturing"]==0
    assert [x["p_operation"] for x in db.calls]==["seed","claim","complete"]


def test_sql_queue_service_role_only_and_all_published_producer_leads():
    for s in [
     "create table private.network_producer_catalog_discovery_queue",
     "enable row level security",
     "revoke all on private.network_producer_catalog_discovery_queue",
     "for update of q skip locked",
     "country_code in ('IT','RO')",
     "r.canonical_key='producer'",
     "and c.publication_status='published'",
     "lease_expires_at>now()",
     "on conflict(company_id,source_url) do nothing",
     "values(v_company,v_title,v_url,'official_pdf','link_only','official_link_observed')",
    ]:
     assert s in SQL,s
    assert "grant execute on function public.netproducers_catalog_discovery(text,jsonb)\n to service_role;" in SQL
    assert "to anon,authenticated;" not in SQL.split("grant execute on function public.netproducers_catalog_discovery(text,jsonb)")[-1]
    assert "PDF bytes" in SQL
