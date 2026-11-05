"""NET-GROWTH3.F.2C.1 acceptance: source changes cannot bypass legal/rights gates."""
import json
from app.netgrowth3f2c1_remediation import readback, REMEDIATION, source_domain


def test_1_excluded_2_replacements_and_zero_approval():
    r=readback()
    assert r["original_candidates"] == 50
    assert r["excluded_from_original_new_entity_count"] == 1
    assert r["remaining_original_prospects"] == 49
    assert r["new_reserve_prospects"] == 2
    assert r["total_non_excluded_research_prospects"] == 51
    assert r["confirmed_approved"] == 0
    assert r["technical_source_corrections"] == 4
    assert r["preflight_rpc_permitted"] is False
    assert r["production_import_permitted"] is False


def test_documentary_id_collision_does_not_create_an_unverified_supplier():
    a=json.loads(REMEDIATION.read_text(encoding="utf-8"))
    t=a["domain_vat_reconciliation"]["tcbtubi.it"]
    assert t["website_legal_owner_vat"] == "06651880962"
    assert t["existing_network_match"]["domain"] == "alessiotubi.it"
    assert t["decision"].startswith("excluded_from_net_new")
    assert a["status_summary"]["production_approved"]==0
    assert a["rights"]["general_rule"]


def test_claim_corrections_bind_to_same_official_source_domain():
    a=json.loads(REMEDIATION.read_text(encoding="utf-8"))
    by_domain={x["domain"]:x for x in a["technical_claim_source_corrections"]}
    assert set(by_domain)=={"euroflexspa.it","ocsaspa.com","sgmsrl.com","teknolaser.it"}
    for domain,x in by_domain.items():
        assert source_domain(x["new_url"]) == domain
        assert x["old_url"] != x["new_url"]
    for replacement in a["replacement_reserve"]:
        assert source_domain(replacement["first_party_identity_url"]) == replacement["domain"]
        assert replacement["rights_review"] == "pending"


def test_better_independent_corporate_evidence_still_no_false_approval():
    a=json.loads(REMEDIATION.read_text(encoding="utf-8"))
    refs={x["domain"]:x for x in a["independent_corporate_cross_evidence"]}
    assert refs["tubi-tis.it"]["review_decision"] == "supporting_registry_evidence_not_human_approval"
    assert refs["cctinox.it"]["review_decision"] == "stale_renewal_status_check_required"
    assert refs["amarossi.it"]["review_decision"] == "needs_current_registry_validation"
