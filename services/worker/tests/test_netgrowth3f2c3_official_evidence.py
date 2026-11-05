"""Official entity verification cannot promote research-only profiles."""
from app.netgrowth3f2c3_official_evidence import verify, EVIDENCE
import json


def test_dedupe_firstparty_current_evidence_but_no_production():
    report=verify()
    assert report["total"]==52
    assert report["counted_research_candidates"]==50
    assert report["gleif_current_issued_correlated"]==9
    assert report["gleif_lapsed_not_entity_ceased"]==4
    assert report["eligible"]==0
    assert report["blocked"]==52
    assert report["atomic_rollback_preflight_permitted"] is False
    assert report["production_commit_permitted"] is False


def test_lei_exact_vat_is_required_never_name_only():
    data=json.loads(EVIDENCE.read_text(encoding="utf-8"))
    rows={r["domain"]:r for r in data["records"]}
    assert rows["cctinox.it"]["gleif_vat_exact_match"]["next_renewal_date"]=="2027-10-04"
    assert rows["sideralba.it"]["first_party_vat_observed"]=="02731591216"
    assert rows["nanniottavio.it"]["first_party_vat_observed"]=="02014650408"
    assert rows["nanniottavio.it"]["personal_data_review"]=="legal_person_srl_proven_first_party_metadata_only_pending_signoff"
    assert rows["lasar.it"]["gleif_vat_exact_match"]["registration_status"]=="LAPSED"
    assert rows["scrosati.com"]["gleif_vat_exact_match"]["registration_status"]=="LAPSED"
    assert rows["lasermec.it"]["gleif_vat_exact_match"] is None
    assert rows["tcbtubi.it"]["gleif_vat_exact_match"] is None
    assert rows["fapisrl.com"]["first_party_vat_observed"]=="00141970434"
    assert rows["fapisrl.com"]["gleif_vat_exact_match"] is None


def test_brand_and_role_blocks():
    r={x["domain"]:x for x in json.loads(EVIDENCE.read_text(encoding="utf-8"))["records"]}
    assert r["tcbtubi.it"]["quarantined"]
    assert r["lasermec.it"]["quarantined"]
    assert r["envasald.com"]["role_source_read_status"]=="mismatch_requires_taxonomy_review"
    assert r["emmeerreinox.it"]["role_source_read_status"]=="mismatch_requires_taxonomy_review"
    assert r["t-erre.it"]["role_source_read_status"]=="mismatch_requires_taxonomy_review"
    assert r["officineforesto.com"]["role_source_read_status"]=="first_party_process_or_product_source_found"
    for row in r.values():
        assert not row["supplier_verified"]
        assert not row["rfq_allowed"]
        assert not row["stock_confirmed"]
        assert not row["source_claims_verified_for_ai"]
        assert row["rights_legal_decision"]=="pending_human_legal_review"
