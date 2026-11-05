"""NET-GROWTH3.F.2C.2: no false verified company, source right or stock."""
from app.netgrowth3f2c2_registered_rights import audit, snapshot


def test_reconciliation_yields_50_unapproved_business_prospects():
    r = audit()
    assert r["reviewed"] == 52
    assert r["research_candidates"] == 50
    assert r["excluded_brand_collisions"] == 2
    assert r["company_approvals"] == 0
    assert r["held"] == 52
    assert r["can_stage_rollback_preflight"] is False
    assert r["production_write_authorized"] is False


def test_tcb_and_lasermec_are_brand_and_group_holds():
    d = snapshot()
    x = {r["domain"]: r for r in d["records"]}
    assert not x["tcbtubi.it"]["is_counted_as_net_new_research_candidate"]
    assert not x["lasermec.it"]["is_counted_as_net_new_research_candidate"]
    assert d["exclusions"]["tcbtubi.it"]["related_company_vat"] == "06651880962"
    assert d["exclusions"]["lasermec.it"]["secondary_company_vat"] == "00287740260"


def test_lei_issued_is_not_company_signoff():
    x = {r["domain"]:r for r in snapshot()["records"]}
    assert x["tubi-tis.it"]["independent_corporate_evidence"]["registration_status"] == "ISSUED"
    assert x["tubi-tis.it"]["legal_entity_confirmation"] == "pending_human_review"
    assert x["cctinox.it"]["independent_corporate_evidence"]["next_renewal_date"] == "2026-10-04"
    assert x["cctinox.it"]["registration_verification"] != "official_current_registry_validated"


def test_rights_not_automatically_conferred_by_reading_websites():
    d = snapshot()
    assert all(r["rights_assessment"] != "approved_legal_basis" for r in d["records"])
    assert all(not r["reuse_of_protected_media_or_bulk_catalog"] for r in d["records"])
    assert not d["production_rpc_authorized"]


def test_unsupported_approval_flags_are_insufficient():
    d = snapshot()
    # Some flags may be changed in a future human review, but without a
    # company-specific registry record and signed acceptance, the gate fails.
    for r in d["records"]:
        r["rights_assessment"] = "approved_legal_basis"
        r["source_quality_review"] = "approved_human"
    assert all(r["registration_verification"] != "official_current_registry_validated"
               for r in d["records"])
    assert all(not r["acceptance_artifact_url"] for r in d["records"])
