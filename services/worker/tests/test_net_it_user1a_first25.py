"""Offline-only test of NET-IT-USER1.A non-importable source assessment."""
import json
from pathlib import Path
from urllib.parse import urlparse

DATA = Path(__file__).resolve().parents[1] / "data" / "net_it_user1a_first25_20261108.json"


def test_net_it_user1a_first25_manifest():
    p = json.loads(DATA.read_text(encoding="utf-8"))
    rows = p["records"]
    assert p["artifact_type"] == "non_importable_research_assessment"
    assert p["selection_count"] == 25 == len(rows)
    assert p["grade_counts"] == {"A": 14, "B": 5, "C": 6}
    assert {x: sum(r["evidence_grade"] == x for r in rows) for x in "ABC"} == p["grade_counts"]
    assert len(set(r["canonical_domain"] for r in rows)) == 25
    assert not p["database_mutations_performed"] and not p["publication_mutations_performed"]
    assert {r["canonical_domain"] for r in rows if r["next_gate"] == "existing_canonical_enrich"} == {"alpego.com", "maschiogaspardo.com"}
    for r in rows:
        host = urlparse(r["first_party_source_url"])
        assert host.scheme == "https"
        assert host.hostname == r["canonical_domain"] or host.hostname.endswith("." + r["canonical_domain"])
        assert r["current_lead_status"] == "needs_review" and r["proposed_role"] == "end_user"
        assert not r["buyer_confirmed"] and not r["procurement_confirmed"]
        assert not r["material_standard_inferred"] and not r["source_reuse_approved"]
