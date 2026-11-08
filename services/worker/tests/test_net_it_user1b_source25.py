"""Offline-only guards for sourced 25 Italian end-user research candidates."""
import json
from pathlib import Path
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parents[1]/"data"
MANIFEST=ROOT/"net_it_user1b_source25_20261108.json"
PAYLOAD=ROOT/"net_it_user1b_platform_stage21_20261108.json"


def test_netit_user1b_source25():
    d=json.loads(MANIFEST.read_text(encoding="utf-8"))
    rows=d["records"]
    assert d["source_count"]==len(rows)==25
    assert len({r["domain"] for r in rows})==25
    assert d["lane_counts"]=={"stage":21,"hold":4}
    assert d["grade_counts"]=={g:sum(r["grade"]==g for r in rows) for g in "ABC" if any(r["grade"]==g for r in rows)}
    assert not d["database_mutations_performed"] and d["published_companies_added"]==0
    for r in rows:
        h=urlparse(r["evidence_url"])
        assert h.scheme=="https"
        assert h.hostname==r["domain"] or h.hostname=="www."+r["domain"]
        assert r["source_kind"]=="first_party_site" and r["status"]=="research_only_not_staged"
        assert not r["buyer_verified"] and not r["acquisition_or_purchase_verified"]
        assert not r["owner_claimed"] and not r["rights_cleared_for_bulk_reuse"]
        assert r["material_signal"]==("explicit_steel_tube_product" if r["grade"]=="A" else "finished_equipment_only")


def test_netit_user1b_stage21_review_payload():
    rows=json.loads(MANIFEST.read_text(encoding="utf-8"))["records"]
    payload=json.loads(PAYLOAD.read_text(encoding="utf-8"))
    assert len(payload)==21
    src={r["domain"]:r for r in rows}
    assert {p["domain"] for p in payload}=={r["domain"] for r in rows if r["research_lane"]=="stage"}
    assert {r["domain"] for r in rows if r["research_lane"]=="hold"}=={
        "ctsponteggi.com","piscopielloponteggi.it","effedimetaldesign.it","portabiciclettemodelloverona.it"
    }
    for p in payload:
        assert set(p)=={"name","domain","evidence_url","summary","segment","material_signal","role"}
        assert p["role"]=="end_user"
        assert p["evidence_url"]==src[p["domain"]]["evidence_url"]
