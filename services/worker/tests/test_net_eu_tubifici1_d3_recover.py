"""EU1.D3 recovery: legal operator, factory source, rights and no publication."""
from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

from app import net_eu_tubifici1_d3_recover as d3


def candidate(domain="toptubes.co.uk", **changes):
    data={
        "id":"a32af238-c6b4-4d5f-9d7f-4083173c14f0",
        "domain":domain,
        "company_name":"Top Tubes Ltd",
        "country_code":"GB",
        "source_url":"https://www.toptubes.co.uk/about-us/",
        "website_url":"https://www.toptubes.co.uk/"
    }
    return {**data, **changes}


def page(url,text):
    return SimpleNamespace(url=url,text=text)


def test_allowlisted_firstparty_origins_only():
    assert d3.same_firstparty("https://www.toptubes.co.uk/about-us/","toptubes.co.uk")
    assert not d3.same_firstparty("http://www.toptubes.co.uk/about-us/","toptubes.co.uk")
    assert not d3.same_firstparty("https://fake.toptubes.co.uk/about-us/","toptubes.co.uk")
    assert not d3.same_firstparty("https://malicious.example/about-us/","toptubes.co.uk")
    assert len(d3.RECIPES)==8
    assert "ferpinta.pt" in d3.RECIPES and "alleima.com" in d3.RECIPES


def test_top_tubes_requires_legal_identity_plus_factory_observation(monkeypatch):
    legal=page(d3.RECIPES["toptubes.co.uk"].legal_url,
        'Sales conditions: "the Company" means Top Tubes Limited, Company Number 3000662.')
    factory=page(d3.RECIPES["toptubes.co.uk"].factory_url,
        "Established in 1994, Top Tubes Ltd operates from a 14,000 square metre "
        "factory in Wednesbury. We offer welded tube manufacture and ERW steel tube.")
    async def fetch(_client,url,_ref):
        return legal if url==legal.url else factory
    monkeypatch.setattr(d3,"_fetch_page",fetch)
    obs=asyncio.run(d3.inspect(None,candidate()))
    assert obs["p_name_observed"] is True
    assert obs["p_manufacturing_observed"] is True
    assert obs["p_rights_restricted"] is False
    assert obs["p_factory_city"]=="Wednesbury"
    assert len(obs["p_legal_hash"])==64
    assert len(obs["p_factory_hash"])==64
    assert obs["p_process_code"]=="welded_steel_tubes"


def test_rsteel_firstparty_full_legal_and_welded_tube(monkeypatch):
    rec=d3.RECIPES["rsteel.pt"]
    legal=page(rec.legal_url,
        "RSTEEL – FÁBRICA DE TUBOS METÁLICOS S.A. é responsável pelo website.")
    factory=page(rec.factory_url,
        "Os Tubos de Precisão produzidas pela Rsteel – Fábrica de Tubos Metálicos, S.A. "
        "são perfis soldados longitudinalmente.")
    async def fetch(_client,url,_ref):return legal if url==legal.url else factory
    monkeypatch.setattr(d3,"_fetch_page",fetch)
    x=asyncio.run(d3.inspect(None,candidate(
        "rsteel.pt",company_name="RSTEEL – Fábrica de Tubos Metálicos S.A.",
        country_code="PT",source_url="https://rsteel.pt/en/about-us/")))
    assert x["p_name_observed"] is True
    assert x["p_manufacturing_observed"] is True
    assert x["p_factory_city"] is None


def test_aratubo_explicit_content_extraction_rights_are_a_hold(monkeypatch):
    rec=d3.RECIPES["aratubo.com"]
    legal=page(rec.legal_url,
        "This Website is the property of ARATUBO S.A.U. "
        "The user must refrain from extracting or reusing the contents of this website.")
    factory=page(rec.factory_url,
        "Aratubo is a manufacturer of precision-welded steel tubes in Spain.")
    async def fetch(_client,url,_ref):return legal if url==legal.url else factory
    monkeypatch.setattr(d3,"_fetch_page",fetch)
    x=asyncio.run(d3.inspect(None,candidate(
        "aratubo.com",company_name="ARATUBO S.A.U.",country_code="ES",
        source_url="https://www.aratubo.com/we-are-aratubo/")))
    assert x["p_name_observed"] is True
    assert x["p_manufacturing_observed"] is True
    assert x["p_rights_restricted"] is True


def test_company_group_does_not_become_certified_sole_operator(monkeypatch):
    rec=d3.RECIPES["alleima.com"]
    legal=page(rec.legal_url,
        "Alleima AB, 559224-1433 and Alleima Tube AB, 556234-6832 are separate entities")
    factory=page(rec.factory_url,"Division Tube offers an extensive portfolio of seamless tubes.")
    async def fetch(_client,url,_ref):return legal if url==legal.url else factory
    monkeypatch.setattr(d3,"_fetch_page",fetch)
    x=asyncio.run(d3.inspect(None,candidate(
        "alleima.com",company_name="Alleima AB",country_code="SE",
        source_url="https://www.alleima.com/en/about-us/strategy-and-operations/divisions/tube/")))
    assert x["p_name_observed"]
    assert x["p_manufacturing_observed"]
    assert x["p_process_code"]=="group_division_unspecified"


def test_unavailable_firstparty_never_fabricates_a_hash(monkeypatch):
    async def unavailable(*_args):return None
    monkeypatch.setattr(d3,"_fetch_page",unavailable)
    with pytest.raises(RuntimeError,match="first_party_fetch_failed"):
        asyncio.run(d3.inspect(None,candidate()))


def test_d3_code_never_calls_publisher():
    import inspect
    source=inspect.getsource(d3.execute)
    assert 'net_eu_tubifici1_d3_queue' in source
    assert 'net_eu_tubifici1_d3_record' in source
    assert 'net_eu_tubifici1_publish' not in source
    assert 'net_it_auto3' not in source
