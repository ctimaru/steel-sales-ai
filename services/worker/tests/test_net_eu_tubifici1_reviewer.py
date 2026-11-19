"""EU tube producer first-party observation and country isolation tests."""
from __future__ import annotations

import asyncio
from uuid import uuid4

import pytest

from app.company_discovery import CrawledPage
from app import net_eu_tubifici1_reviewer as eu


def make_candidate(**patch):
    base = {
        "id": str(uuid4()),
        "domain": "stalatube.com",
        "url": "https://stalatube.com/",
        "website_url": "https://stalatube.com/",
        "company_name": "Stalatube Oy",
        "country_code": "FI",
        "quality_flags": ["legal_identity_not_verified"],
    }
    return {**base, **patch}


def test_eu_legal_forms_and_unicode_not_italian_only():
    assert eu.legal_form_present("BENTELER Steel/Tube GmbH & Co. KG", "DE")
    assert eu.legal_form_present("Stalatube Oy", "FI")
    assert eu.legal_form_present("BRT N.V.", "BE")
    assert eu.legal_form_present("SWISS-TUBE LN Industries SA", "CH")
    assert eu.legal_form_present("ZM Tubes SA", "CH")
    assert eu.legal_form_present("Tata Steel Nederland Tubes B.V.", "NL")
    assert not eu.legal_form_present("BRT Pipes & Profiles", "BE")
    assert not eu.legal_form_present("ZM Tubes", "CH")
    assert not eu.legal_form_present("Tata Steel Nederland", "NL")
    assert eu.legal_form_present("Třinecké železárny, a.s.", "CZ")
    assert eu.legal_form_present("Tubacex Tubos Inoxidables S.A.U.", "ES")
    assert eu.legal_form_present("Marcegaglia (UK) Limited", "GB")
    assert eu.legal_form_present("Centravis Production Ukraine PrJSC", "UA")
    assert not eu.legal_form_present("Interpipe", "UA")
    assert not eu.legal_form_present("Stalatube Oy", "IT")


def test_full_name_requires_exact_body_text_not_brand_or_prefix():
    assert eu.full_name_observed(
        "Stalatube Oy", "Welcome — Stalatube Oy manufactures welded profiles."
    )
    assert not eu.full_name_observed("Stalatube Oy", "Stalatube Oyj is a different name")
    assert not eu.full_name_observed("Stalatube Oy", "Stalatube products are available")
    assert eu.normalized("Třinecké železárny, a.s.") == "třinecké železárny a s"


def test_external_or_subdomain_sources_are_never_relabelled_as_verified():
    with pytest.raises(ValueError):
        eu.prepare(make_candidate(
            domain="vallourec.com", url="https://france.vallourec.com/en/",
            website_url="https://vallourec.com/", country_code="FR"))
    with pytest.raises(ValueError):
        eu.prepare(make_candidate(country_code="IT"))
    with pytest.raises(ValueError):
        eu.prepare(make_candidate(url="http://stalatube.com/"))


def test_firstparty_name_observed_but_never_company_verified(monkeypatch):
    page = CrawledPage(
        url="https://stalatube.com/", title="Stalatube Oy", site_name=None,
        meta_description=None, h1="Stalatube", links=(),
        text="About us: Stalatube Oy is a supplier of stainless steel profiles."
    )

    async def fetch(*_args):
        return page

    monkeypatch.setattr(eu, "_fetch_page", fetch)
    observation = asyncio.run(eu.inspect_candidate(None, make_candidate()))
    assert observation["p_verdict"] == "observed_match"
    assert observation["p_name_matched"] is True
    assert len(observation["p_hash"]) == 64
    assert observation["p_page_url"] == "https://stalatube.com/"


def test_group_ambiguity_remains_insufficient_even_when_name_visible(monkeypatch):
    page = CrawledPage(
        url="https://stalatube.com/", title="Stalatube", site_name=None,
        meta_description=None, h1="Stalatube", links=(),
        text="Stalatube Oy is part of the group."
    )

    async def fetch(*_args):
        return page

    monkeypatch.setattr(eu, "_fetch_page", fetch)
    observation = asyncio.run(eu.inspect_candidate(
        None, make_candidate(quality_flags=["group_or_legal_entity_review"])))
    assert observation["p_verdict"] == "insufficient"
    assert "group_or_facility_identity_unresolved" in observation["p_reasons"]


def test_reuse_restriction_blocks_even_full_name(monkeypatch):
    page = CrawledPage(
        url="https://stalatube.com/", title="Stalatube Oy", site_name=None,
        meta_description=None, h1="Stalatube Oy", links=(),
        text="Stalatube Oy. Website scraping prohibited without permission."
    )

    async def fetch(*_args):
        return page

    monkeypatch.setattr(eu, "_fetch_page", fetch)
    observation = asyncio.run(eu.inspect_candidate(None, make_candidate()))
    assert observation["p_verdict"] == "blocked"
    assert observation["p_rights_state"] == "restricts_reuse"
