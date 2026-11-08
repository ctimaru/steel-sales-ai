"""Offline integrity checks for NET-IT-USER1.C operator review packet."""
import csv
import json
from pathlib import Path

DATA=Path(__file__).resolve().parents[1] / "data"
M=DATA / "net_it_user1c_first5_operator_packet_20261108.json"
T=DATA / "net_it_user1c_first5_platform_operator_20261108.tsv"

def test_first5_review_only():
    m=json.loads(M.read_text(encoding="utf-8"))
    rows=m["rows"]
    assert m["country_code"]=="IT"
    assert len(rows)==5
    assert len({r["domain"] for r in rows})==5
    assert m["checks"]["exact_domain_collision_count"]==0
    assert m["checks"]["known_vat_collision_count"]==0
    for gate in ("source_rights_approved","platform_operator_signed_in","platform_review_attested","canonical_publication_authorized"):
        assert m["checks"][gate] is False
    for r in rows:
        assert r["proposed_role"]=="end_user"
        assert r["publication_status"]=="not_published"
        assert r["rights_review"]=="pending"
        assert r["verified_buyer"] is False and r["owner_claimed"] is False
        p=r["platform_stage_payload"]
        assert set(p)=={"name","domain","evidence_url","summary","segment","material_signal","role"}
        assert p["domain"]==r["domain"] and p["role"]=="end_user"
        assert p["material_signal"]=="explicit_steel_tube_product"
        assert p["evidence_url"].startswith("https://")
        assert p["evidence_url"].split("/")[2].removeprefix("www.")==r["domain"]
    assert {r["domain"] for r in rows}=={"augspa.com","lazzarisrl.it","retissima.it","sottileserre.com","tecnocarpenteria.it"}

def test_first5_tsv_matches():
    m=json.loads(M.read_text(encoding="utf-8"))
    with T.open(encoding="utf-8",newline="") as f:
        allrows=list(csv.DictReader(f,delimiter="\t"))
    assert len(allrows)==5
    for a,b in zip(allrows,m["rows"]):
        assert a==b["platform_stage_payload"]
