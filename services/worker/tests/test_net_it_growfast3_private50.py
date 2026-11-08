"""Offline guards for the real NET-IT-GROWFAST3 private production readback."""
import json
from pathlib import Path
from urllib.parse import urlparse

MANIFEST=Path(__file__).resolve().parents[1]/"data"/"net_it_growfast3_private50_readback_20261108.json"

def test_growfast3_private50_readback_invariants():
    d=json.loads(MANIFEST.read_text(encoding="utf-8"))
    rows=d["records"]
    assert d["status"]=="production_private_research_readback_confirmed"
    assert d["record_count"]==len(rows)==50
    assert len({r["research_id"] for r in rows})==50
    assert len({r["canonical_domain"] for r in rows})==50
    expected={"processor_service_provider":26,"end_user":21,"trader_distributor":3}
    assert {k:sum(r["proposed_role"]==k for r in rows) for k in expected}==expected
    assert sum(r["review_lane"]=="web_profile_review_pending" for r in rows)==10
    assert sum(r["review_lane"]=="industrial_fit_review" for r in rows)==40
    for r in rows:
        p=urlparse(r["source_url"])
        assert p.scheme=="https"
        assert p.hostname in {r["canonical_domain"],"www."+r["canonical_domain"]}
        assert r["source_kind"]=="first_party_web"
        assert r["claim_status"]=="unclaimed"
        assert r["verification_status"]=="web_sourced_unverified"
        assert r["publication_status"]=="not_published"
