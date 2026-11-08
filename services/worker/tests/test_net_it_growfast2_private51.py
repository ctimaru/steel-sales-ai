"""Offline guards for NET-IT-GROWFAST2 production readback (no Supabase writes)."""
import json
from pathlib import Path
from urllib.parse import urlparse

DATA=Path(__file__).resolve().parents[1]/"data"/"net_it_growfast2_private51_readback_20261108.json"

def test_netit_growfast2_readback():
    obj=json.loads(DATA.read_text(encoding="utf-8"))
    rows=obj["records"]
    assert obj["status"]=="confirmed_private_research_readback"
    assert obj["count"]==len(rows)==51
    assert len({x["canonical_domain"] for x in rows})==51
    assert len({x["research_id"] for x in rows})==51
    expected={"end_user":27,"processor_service_provider":16,"trader_distributor":6,"producer":2}
    assert {k:sum(x["proposed_role"]==k for x in rows) for k in expected}==expected
    assert sum(x["review_lane"]=="web_profile_review_pending" for x in rows)==5
    for x in rows:
        h=urlparse(x["source_url"])
        assert h.scheme=="https" and h.hostname in {x["canonical_domain"],"www."+x["canonical_domain"]}
        assert x["source_kind"]=="first_party_web"
        assert x["claim_status"]=="unclaimed"
        assert x["verification_status"]=="web_sourced_unverified"
        assert x["publication_status"]=="not_published"
