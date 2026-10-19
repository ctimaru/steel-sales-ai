from __future__ import annotations
import asyncio
import json
from pathlib import Path
from unittest.mock import patch
import pytest
from app.company_discovery import CrawledPage
from app.netcompact4b_geo_batch import (
    ADDRESS_RE, read_manifest, contact_links, page_candidates, examine,
    run_batch, stage,
)

OFFICIAL="https://www.cpssrl.com/"
ID="84e64990-7a88-47c7-8445-d5e75e96fd42"

def page(url=OFFICIAL,text="",links=(),structured_data=()):
    return CrawledPage(
        url=url,title=None,site_name=None,meta_description=None,h1=None,
        text=text,links=tuple(links),structured_data=tuple(structured_data),
    )

def row():
    return dict(kind="canonical",company_id=ID,company_name="CPS S.r.l.",
                site=OFFICIAL,domain="cpssrl.com")

def test_manifest_must_be_exact_domain_and_uuid(tmp_path:Path):
    f=tmp_path/"batch.json"
    f.write_text(json.dumps([row()]))
    assert read_manifest(f)[0]["domain"]=="cpssrl.com"
    swapped=dict(row(),site="https://other-company.example/")
    f.write_text(json.dumps([swapped]))
    with pytest.raises(ValueError):
        read_manifest(f)
    f.write_text(json.dumps([row(),row()]))
    with pytest.raises(ValueError):
        read_manifest(f)

def test_contacts_never_leave_official_domain():
    home=page(text="",links=[
        "/it/contacts.php","https://attacker.example/contatti",
        "/it/about.php","/en/contact.php",
    ])
    links=contact_links(home,"cpssrl.com")
    assert "https://www.cpssrl.com/it/contacts.php" in links
    assert all("attacker" not in link and "about.php" not in link for link in links)

def test_postal_city_province_evidence_stays_quote_not_inference():
    source="Contatti Via Tiberio Bianchi 5 20863 Concorezzo (MB) - ITALY"
    match=ADDRESS_RE.search(source)
    assert match and match.group(1)=="Concorezzo" and match.group(2)=="MB"
    candidates=page_candidates(page(url="https://www.cpssrl.com/it/contacts.php",text=source))
    assert candidates and candidates[0]["city"]=="Concorezzo"
    assert candidates[0]["province_code"]=="MB"
    assert "Concorezzo (MB)" in candidates[0]["excerpt"]
    assert page_candidates(page(text="Operiamo a Milano, Roma, Bergamo."))==[]

def test_jsonld_company_address_keeps_original_source():
    structured=({"@type":"Organization","name":"CPS S.r.l.","address":{
        "@type":"PostalAddress","addressLocality":"Concorezzo",
        "addressRegion":"MB","addressCountry":"IT","postalCode":"20863"}},)
    candidates=page_candidates(page(structured_data=structured))
    assert len(candidates)==1
    assert candidates[0]["city"]=="Concorezzo"
    assert '"addressRegion": "MB"' in candidates[0]["excerpt"]

def test_multiple_distinct_localities_not_promoted():
    async def fake_fetch(_client,url,_site):
        if url==OFFICIAL:
            return page(text="20863 Concorezzo (MB)",links=["/it/contacts.php"])
        return page(url=url,text="20100 Milano (MI)")
    with patch("app.netcompact4b_geo_batch._fetch_page",side_effect=fake_fetch):
        async def run():
            async with __import__("httpx").AsyncClient() as client:
                return await examine(client,row())
        result=asyncio.run(run())
    assert result["status"]=="multiple_localities_manual_review"
    assert result["candidate"] is None

def test_dry_run_never_calls_persistence():
    async def fake_examine(*_):
        return {"status":"sourced_candidate","pages":1,
                "candidate":{"city":"Concorezzo","province_code":"MB",
                             "source_url":"https://www.cpssrl.com/it/contacts.php",
                             "excerpt":"20863 Concorezzo (MB)"}}
    with patch("app.netcompact4b_geo_batch.examine",side_effect=fake_examine),patch(
        "app.netcompact4b_geo_batch.stage",side_effect=AssertionError("dry run attempted a write")
    ):
        result=asyncio.run(run_batch([row()],persist=False,pause=0))
    assert result["sites"]==1 and result["candidates"]==1
    assert result["published_facilities"]==0 and result["staged_or_existing"]==0

def test_stage_uses_only_service_side_restricted_rpcs():
    class DB:
        def rpc(self,name,args):
            self.name=name; self.args=args
            return self
        def execute(self):
            return type("Response",(),{"data":{"status":"source_observed","staged":True}})()
    db=DB()
    candidate={"city":"Concorezzo","province_code":"MB",
               "source_url":"https://www.cpssrl.com/it/contacts.php",
               "excerpt":"Via Tiberio Bianchi 5 20863 Concorezzo (MB)"}
    stage(db,row(),candidate)
    assert db.name=="netcompact4b_stage_canonical_geo"
    assert db.args["p_company_id"]==ID
    stage(db,dict(row(),kind="discovered"),candidate)
    assert db.name=="neteima2_stage_provisional_geo"

def test_batch_cap_enforced():
    with pytest.raises(ValueError):
        asyncio.run(run_batch([row()],max_sites=26))
