from __future__ import annotations

import asyncio
from unittest.mock import patch

import pytest

from app.company_discovery import CrawledPage
from app.netcontact1_public_contacts import (
    examine, is_company_email, next_batch, normalize_phone, page_channels, run_batch, stage,
)

SITE = "https://www.morandispa.it/"
ID = "51100000-0000-5000-8000-000000000005"


def page(url=SITE, text="", links=(), structured_data=()):
    return CrawledPage(url=url, title=None, site_name=None, meta_description=None, h1=None,
                       text=text, links=tuple(links), structured_data=tuple(structured_data))


def item():
    return dict(kind="canonical", company_id=ID, company_name="Morandi S.p.A.", site=SITE, domain="morandispa.it")


def test_only_generic_mailboxes_on_the_company_domain():
    assert is_company_email("info@morandispa.it", "morandispa.it")
    assert is_company_email("Ufficio.Commerciale@mail.morandispa.it", "www.morandispa.it")
    assert is_company_email("sales.it@morandispa.it", "morandispa.it")
    assert not is_company_email("mario.rossi@morandispa.it", "morandispa.it")
    assert not is_company_email("info.mario@morandispa.it", "morandispa.it")
    assert not is_company_email("info@gmail.com", "morandispa.it")
    assert not is_company_email("info@evilmorandispa.it", "morandispa.it")


def test_phone_normalization_keeps_switchboards_only():
    assert normalize_phone("0372 123.456") == "+390372123456"
    assert normalize_phone("+39 02 1234 5678") == "+390212345678"
    assert normalize_phone("0039 02 1234567") == "+39021234567"
    assert normalize_phone("+39 333 1234567") is None  # mobile: possibly personal
    assert normalize_phone("12") is None


def test_page_channels_prefers_sales_and_skips_fax_and_personal():
    p = page(text="Tel. 0372 123456 Fax 0372 654321 scrivi a info@morandispa.it oppure mario.rossi@morandispa.it",
             links=["mailto:commerciale@morandispa.it?subject=RFQ", "mailto:x@other.example"],
             structured_data=[{"@type": "Organization", "telephone": "+39 0372 123456"}])
    emails, phones = page_channels(p, "morandispa.it")
    assert emails[0] == "commerciale@morandispa.it"
    assert "mario.rossi@morandispa.it" not in emails and all(e.endswith("morandispa.it") for e in emails)
    assert phones == ["+390372123456"]


def test_examine_reads_only_exact_domain_contact_pages():
    home = page(links=["/contatti", "https://attacker.example/contatti"])
    contact = page(url=SITE + "contatti", text="Centralino: 0372 123456 - vendite@morandispa.it")
    calls = []

    async def fake(client, url, base):
        calls.append(url)
        return home if url == SITE else contact

    with patch("app.netcontact1_public_contacts._fetch_page", fake):
        r = asyncio.run(examine(None, item()))
    assert r["status"] == "sourced_channel"
    assert r["email"] == ("vendite@morandispa.it", SITE + "contatti")
    assert r["phone"] == ("+390372123456", SITE + "contatti")
    assert all("attacker" not in url for url in calls)


class FakeDb:
    def __init__(self):
        self.calls = []

    def rpc(self, name, params):
        self.calls.append((name, params))
        db = self

        class Q:
            def execute(self):
                class R:
                    data = ({"contract": "netcontact1-next-v1", "eligible": 1,
                             "items": [dict(kind="canonical", company_id=ID, site=SITE,
                                            domain="morandispa.it", company_name="Morandi S.p.A.")]}
                            if name == "netcontact1_next_batch" else {"status": "staged"})
                return R()
        return Q()


def test_stage_groups_same_page_and_splits_different_pages():
    db = FakeDb()
    assert stage(db, ID, ("info@morandispa.it", SITE), ("+390372123456", SITE)) == ["staged"]
    assert len(db.calls) == 1 and db.calls[0][1]["p_phone"] == "+390372123456"
    db = FakeDb()
    stage(db, ID, ("info@morandispa.it", SITE), ("+390372123456", SITE + "contatti"))
    assert [c[1]["p_source_url"] for c in db.calls] == [SITE, SITE + "contatti"]


def test_dry_run_never_writes():
    db = FakeDb()

    async def fake(client, url, base):
        return page(text="info@morandispa.it")

    with patch("app.netcontact1_public_contacts._fetch_page", fake):
        out = asyncio.run(run_batch([item()], persist=False, db=db, pause=0))
    assert out["mode"] == "dry_run" and out["with_email"] == 1 and out["published"] == 0
    assert db.calls == []


def test_next_batch_is_bounded_and_domain_bound():
    entries, total, skipped = next_batch(FakeDb(), 5)
    assert total == 1 and entries[0]["domain"] == "morandispa.it" and skipped == []
    with pytest.raises(ValueError):
        next_batch(FakeDb(), 26)


def test_secret_key_client_is_bounded_and_project_pinned(monkeypatch):
    from app.netcontact1_public_contacts import SecretKeyRpc, db_from_environment
    with pytest.raises(ValueError):
        SecretKeyRpc("https://ecrafjdummcdfycznitx.supabase.co", "sb_secret_x" * 4).rpc("netfast3_bulk_import", {})
    monkeypatch.setenv("CRAWL_IT65B_SUPABASE_URL", "https://attacker.example")
    monkeypatch.setenv("CRAWL_IT65B_SUPABASE_SECRET_KEY", "sb_secret_" + "x" * 30)
    with pytest.raises(ValueError):
        db_from_environment()


def test_persist_records_every_attempt_even_without_channels():
    db = FakeDb()

    async def fake(client, url, base):
        return page(text="Nessun contatto qui")

    with patch("app.netcontact1_public_contacts._fetch_page", fake):
        out = asyncio.run(run_batch([item()], persist=True, db=db, pause=0))
    assert out["outcomes"][0]["status"] == "no_company_channel"
    assert db.calls == [("netcontact1_record_attempt", {"p_company_id": ID, "p_outcome": "no_company_channel"})]


def test_next_batch_skips_mismatched_identity_and_allows_shared_group_domain():
    other = "61100000-0000-5000-8000-000000000006"
    stray = "71100000-0000-5000-8000-000000000007"
    items = [dict(kind="canonical", company_id=ID, site=SITE, domain="morandispa.it", company_name="Morandi S.p.A."),
             dict(kind="canonical", company_id=other, site=SITE, domain="morandispa.it", company_name="Morandi Group"),
             dict(kind="canonical", company_id=stray, site="https://other.example/", domain="morandispa.it", company_name="Stray")]

    class Db:
        def rpc(self, name, params):
            class Q:
                def execute(self):
                    class R:
                        data = {"contract": "netcontact1-next-v1", "eligible": 3, "items": items}
                    return R()
            return Q()

    entries, total, skipped = next_batch(Db(), 5)
    assert [e["company_id"] for e in entries] == [ID, other]
    assert skipped == [stray]
