"""NET-GROWTH3.F.2C.4: fail-closed 50-company documentary acceptance."""
import json
import copy
import pytest
from app.netgrowth3f2c4_visure_rights import QUEUE, report, validate, evaluate_row


def _data():
    return json.loads(QUEUE.read_text(encoding="utf-8"))


def test_50_request_queue_and_67_source_claims():
    data=_data()
    records=data["records"]
    assert len(records)==52
    assert sum(not x["quarantined"] for x in records)==50
    assert sum(x["priority"]=="P1_GLEIF_CORROBORATED" for x in records)==13
    assert sum(x["priority"]=="P2_COMPANY_VAT_ONLY" for x in records)==14
    assert sum(x["priority"]=="P3_MISSING_TAX_ID" for x in records)==23
    assert sum(x["priority"]=="QUARANTINE" for x in records)==2
    assert sum(len(r["claims"]) for r in records)==67
    assert all(r["visura_request"]["document_storage_ref"] is None for r in records)


def test_zero_real_approval_and_no_rpc():
    r=report()
    assert r["profiles_total"]==52
    assert r["research_eligible"]==50
    assert r["company_paperwork_approved"]==0
    assert r["blocked_active"]==50
    assert r["may_request_separate_db_preflight"] is False
    assert r["transactional_rpc_rollback_executed"] is False
    assert r["production_commit_permitted"] is False


def test_gleif_cc0_does_not_authorize_website_material():
    rows=_data()["records"]
    matched=[x for x in rows if x["identity_evidence"]["gleif_lei"]]
    assert len(matched)==13
    for r in matched:
        assert r["rights"]["gleif_reference_license"]=="CC0_1.0"
        assert r["rights"]["website_rights_decision"]=="pending_legal_review"
        assert not r["rights"]["copy_site_text_photos_logos_catalog"]
        assert not r["ai_visibility"]["supplier_verified"]


def test_out_of_scope_brand_never_counts():
    data=_data()
    for r in data["records"]:
        if r["domain"] in {"tcbtubi.it","lasermec.it"}:
            assert r["quarantined"]
            assert evaluate_row(r)==["quarantined_brand_or_owner"]
    data["records"][0]["quarantined"]=True
    with pytest.raises(ValueError, match="quarantines"):
        validate(data)


def test_toggling_approval_still_requires_official_document():
    data=_data()
    r=next(x for x in data["records"] if x["domain"]=="euroflexspa.it")
    r["final_company_decision"]["status"]="approved_for_further_preflight"
    r["rights"]["website_rights_decision"]="approved_minimal_original_facts"
    reasons=evaluate_row(r)
    assert "official_document_missing" in reasons
    assert "official_document_not_signed" in reasons
    assert "rights_approval_artifact_missing" in reasons


def test_no_declared_stock_rfqs_or_grade_inference():
    data=_data()
    assert not data["import_authorized"]
    assert not data["rpc_rollback_executed"]
    for r in data["records"]:
        assert not r["ai_visibility"]["supplier_verified"]
        assert not r["ai_visibility"]["stock_known"]
        assert not r["ai_visibility"]["rfq_allowed"]
        assert not any(c["review_decision"]=="approved_first_party_factual_claim" for c in r["claims"])
