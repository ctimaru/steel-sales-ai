"""Offline regression guard for NET-IT-GROWFAST1 readback (no production calls)."""
import json
from pathlib import Path
from urllib.parse import urlparse

F=Path(__file__).resolve().parents[1]/"data"/"net_it_growfast1_research33_20261108.json"


def test_net_it_growfast1_private_research_invariants():
    d=json.loads(F.read_text(encoding="utf-8"))
    rows=d["records"]
    assert d["artifact_type"]=="production_private_research_readback"
    assert d["counts"]["rows"]==len(rows)==33
    assert len({x["canonical_domain"] for x in rows})==len(rows)
    assert len({x["research_id"] for x in rows})==len(rows)
    assert d["counts"]["roles"]=={"end_user":21,"processor_service_provider":8,"producer":4}
    for x in rows:
        host=urlparse(x["source_url"])
        assert host.scheme=="https"
        assert host.hostname==x["canonical_domain"] or host.hostname.endswith("."+x["canonical_domain"])
        assert x["verification_status"]=="web_sourced_unverified"
        assert x["publication_status"]=="not_published"
        assert x["review_lane"] in ("web_profile_review_pending","industrial_fit_review")
