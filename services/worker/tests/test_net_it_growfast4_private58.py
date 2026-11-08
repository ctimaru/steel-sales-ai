"""NET-IT-GROWFAST4 source manifest guard; no DB writes or network calls."""
import json
from pathlib import Path
from urllib.parse import urlparse

DATA=Path(__file__).resolve().parents[1]/"data"/"net_it_growfast4_private58_readback_20261108.json"

def test_growfast4_private58_integrity():
    manifest=json.loads(DATA.read_text(encoding="utf-8"))
    rows=manifest["records"]
    assert manifest["status"]=="production_private_research_readback"
    assert manifest["count"]==len(rows)==58
    assert len({x["canonical_domain"] for x in rows})==58
    assert len({x["research_id"] for x in rows})==58
    expected={"end_user":27,"processor_service_provider":18,"trader_distributor":11,"producer":2}
    assert {k:sum(x["proposed_role"]==k for x in rows) for k in expected}==expected
    assert sum(x["review_lane"]=="web_profile_review_pending" for x in rows)==14
    assert sum(x["review_lane"]=="industrial_fit_review" for x in rows)==44
    for x in rows:
        url=urlparse(x["source_url"])
        assert url.scheme=="https"
        assert url.hostname in {x["canonical_domain"],"www."+x["canonical_domain"]}
        assert x["source_kind"]=="first_party_web"
        assert x["publication_status"]=="not_published"
        assert x["verification_status"]=="web_sourced_unverified"
        assert x["claim_status"]=="unclaimed"
