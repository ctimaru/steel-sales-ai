"""NET-RO1.3: readiness cannot be inferred from website research or fake approval."""
from copy import deepcopy
import json
from pathlib import Path
import sys

WORKER = Path(__file__).resolve().parents[1]
if str(WORKER) not in sys.path:
    sys.path.insert(0, str(WORKER))
from scripts import netro1_3_import_readiness as gate  # noqa: E402


def source_files():
    return (
        json.loads(gate.LEDGER_PATH.read_text(encoding="utf-8")),
        json.loads(gate.OBSERVATIONS_PATH.read_text(encoding="utf-8")),
    )


def test_real_research_does_not_qualify_any_company_for_import():
    ledger, identities = source_files()
    result = gate.report(ledger, identities)
    assert result["contract"] == "netro1.3-readonly-qualification-v1"
    assert result["candidate_websites"] == 50
    assert result["identity_observations"] == 7
    assert result["approved_new_legal_entities"] == 0
    assert result["missing_approved_entities_to_minimum"] == 50
    assert result["eligible_for_protected_import_manifest"] is False
    assert result["authorization"] == "RESEARCH_ONLY_NO_IMPORT"
    assert result["import_performed"] is False
    assert result["publication_performed"] is False
    assert result["hold_reason_counts"]["source_rights_approval_missing"] == 50


def _hypothetical_approved(candidate, identity, cui):
    candidate = deepcopy(candidate)
    identity = deepcopy(identity)
    candidate.update({
        "qualification_lane": "net_new_eligible",
        "exact_catalog_screen": "no_exact_normalized_domain_or_name_match",
        "legal_identity_status": "onrc_verified",
        "source_rights_status": "approved_for_public_facts",
        "opt_out_status": "checked_no_objection",
        "technical_semantics_status": "verified",
        "company_facility_separation_status": "verified",
        "import_ready": True,
        "publication_approved": True,
        "independent_legal_reviewer": "registry-reviewer",
        "independent_rights_reviewer": "rights-reviewer",
        "last_registry_verified_at": "2026-11-05T00:00:00Z",
        "last_rights_approved_at": "2026-11-05T00:00:00Z",
    })
    identity.update({
        "onrc_live_check": "verified",
        "source_rights_review": "approved",
        "opt_out_check": "clear",
        "identity_approved": True,
        "import_ready": True,
        "cui_hint": cui,
        "register_no_hint": "J2000000000000",
        "evidence": [
            {"tier": "official_onrc", "url": "https://portal.onrc.ro/", "supports": "test fixture"},
        ],
    })
    return candidate, identity


def test_fake_approved_candidate_cannot_bypass_actual_pending_onrc_and_rights():
    ledger, identities = source_files()
    company = ledger["records"][1]  # ARTROM
    identity = next(x for x in identities["records"] if x["candidate_id"] == company["candidate_id"])
    approved_candidate, _ = _hypothetical_approved(company, identity, "1510210")
    # Current observations remain pending even if candidate state were tampered.
    decision = gate.assess_candidate(approved_candidate, identity)
    assert not decision.eligible
    assert "official_onrc_evidence_missing" in decision.reasons
    assert "independent_use_rights_not_approved" in decision.reasons


def test_shared_domain_collision_not_automatically_eligible():
    ledger, identities = source_files()
    company = next(x for x in ledger["records"] if x["domain"] == "vanleeuwen.com")
    identity = next(x for x in identities["records"] if x["candidate_id"] == company["candidate_id"])
    hypothetical, evidenced = _hypothetical_approved(company, identity, "18587332")
    hypothetical["exact_catalog_screen"] = "shared_domain_collision_it"
    decision = gate.assess_candidate(hypothetical, evidenced)
    assert not decision.eligible
    assert "cross_catalog_conflict" in decision.reasons


def test_dual_review_rejects_same_actor():
    ledger, identities = source_files()
    company = ledger["records"][1]
    identity = next(x for x in identities["records"] if x["candidate_id"] == company["candidate_id"])
    hypothetical, evidenced = _hypothetical_approved(company, identity, "1510210")
    hypothetical["independent_rights_reviewer"] = "registry-reviewer"
    decision = gate.assess_candidate(hypothetical, evidenced)
    assert not decision.eligible
    assert "dual_control_reviewers_not_independent" in decision.reasons


def test_same_romanian_cui_twice_never_counts_as_two_companies(monkeypatch):
    ledger, identities = source_files()
    # Hypothetical fixtures: no real company identities are approved.
    candidates = [ledger["records"][1], ledger["records"][4]]
    observations = [
        next(x for x in identities["records"] if x["candidate_id"] == c["candidate_id"])
        for c in candidates
    ]
    qualified = [_hypothetical_approved(c, o, "12345678") for c, o in zip(candidates, observations)]
    sample_ledger = deepcopy(ledger)
    sample_ledger["records"] = [c for c, _ in qualified]
    sample_observations = deepcopy(identities)
    sample_observations["records"] = [o for _, o in qualified]
    monkeypatch.setattr(gate, "MIN_IMPORT_SIZE", 2)
    output = gate.report(sample_ledger, sample_observations)
    assert output["approved_new_legal_entities"] == 2
    assert output["approved_cui_uniqueness_confirmed"] is False
    assert output["eligible_for_protected_import_manifest"] is False
    # Even a correctly distinguished, fully approved fixture only permits
    # manifest design review, NOT an import. There is no writer in this script.
    sample_observations["records"][1]["cui_hint"] = "87654321"
    output = gate.report(sample_ledger, sample_observations)
    assert output["approved_cui_uniqueness_confirmed"] is True
    assert output["eligible_for_protected_import_manifest"] is True
    assert output["authorization"] == "MANIFEST_DESIGN_REVIEW_REQUIRED"
    assert output["import_performed"] is False


def test_evidence_rename_is_an_alias_not_new_legal_company():
    _, observations = source_files()
    renamed = next(x for x in observations["records"] if x["domain"] == "thyssenkrupp-materials.ro")
    assert renamed["observed_current_name"] == "tk accelis Materials Romania SRL"
    assert renamed["research_name"] == "thyssenkrupp Materials Romania S.R.L."
    assert renamed["cui_hint"] == "18992475"
    assert renamed["onrc_live_check"] == "not_completed"
    assert renamed["import_ready"] is False


def test_unsupported_italian_import_contract_cannot_admit_traders():
    ledger, _ = source_files()
    from collections import Counter
    roles = Counter(r["proposed_role"] for r in ledger["records"])
    assert roles == {
        "producer": 9,
        "trader_distributor": 30,
        "processor_service_provider": 11,
    }
    assert gate.SUPPORTED_ROLES == set(roles)
    # This module must not attempt to call Italy's NET-GROWTH3D 50..100
    # service role RPC; which only supports producers and processors.
    import inspect
    assert "netgrowth3d_stage_industrial" not in inspect.getsource(gate)
