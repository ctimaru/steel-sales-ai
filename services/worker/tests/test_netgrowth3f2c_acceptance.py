"""No unsigned research-only seed may become a production RPC payload."""
import json
from pathlib import Path
from app.netgrowth3f2c_acceptance_gate import ROOT, FILES, LEDGER, assess, report


def read():
    manifests=[json.loads((ROOT/f).read_text(encoding="utf-8")) for f in FILES]
    audit=json.loads(LEDGER.read_text(encoding="utf-8"))
    return manifests,audit


def test_50_candidate_independent_acceptance_remains_blocked():
    manifests,audit=read()
    r=assess(manifests,audit)
    assert r["candidate_count"]==50
    assert r["blocked_count"]==50
    assert r["approved_count"]==0
    assert r["preflight_rpc_permitted"] is False
    assert r["production_write_permitted"] is False
    assert sum(r["reuse_rights_status"]!="approved" for r in audit["entries"])==50
    assert sum(r["live_source_access_status"]=="text_readable" for r in audit["entries"])==45
    assert sum(r["live_source_access_status"]=="failed_original_found_indexed_alternative" for r in audit["entries"])==5
    assert {r["domain"] for r in audit["entries"]}=={r["domain"] for m in manifests for r in m["records"]}
    assert audit["readback"]["new_f_import_rows"]==0


def test_legal_aliases_and_explicit_site_restriction_always_hold():
    manifests,audit=read()
    reasons=assess(manifests,audit)["blocking_reasons"]
    assert "manual_hold_unresolved" in reasons["dematubi.it"]
    assert "manual_hold_unresolved" in reasons["amarossi.it"]
    assert "manual_hold_unresolved" in reasons["envasald.com"]
    assert "reuse_rights_not_approved" in reasons["teknolaser.it"]
    assert "manual_hold_unresolved" in reasons["euroflexspa.it"]
    assert audit["entries"][0]["public_first_party_legal_evidence_url"] is not None


def test_false_self_attestation_cannot_unlock():
    manifests,audit=read()
    for row in audit["entries"]:
        row["legal_identity_review"]="approved"
        row["role_review"]="approved"
        row["claim_review"]="approved"
        row["group_alias_review"]="approved"
        row["reuse_rights_status"]="approved"
    r=assess(manifests,audit)
    assert r["preflight_rpc_permitted"] is False
    assert r["approved_count"]==0  # Missing registry, rights basis, reviewer and holds.


def test_missing_audit_or_source_swap_fails_closed():
    manifests,audit=read()
    audit["entries"].pop()
    try:
        assess(manifests,audit)
    except ValueError as e:
        assert "Missing/extra" in str(e)
    else:
        raise AssertionError("missing review was accepted")
