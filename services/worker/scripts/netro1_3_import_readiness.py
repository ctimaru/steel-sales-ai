"""NET-RO1.3: fail-closed, read-only country-scoped company qualification preflight.

This module has no DB connection, credentials, HTTP calls, publication action,
or import writer. It reads versioned research ledgers and prints an assessment.
ONRC evidence and human source-rights decisions are essential; a domain or
a scraped registry mirror never grants publication or import rights.
"""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
import json
from pathlib import Path
from typing import Any

DATA = Path(__file__).resolve().parents[1] / "data"
LEDGER_PATH = DATA / "netro1_first50_qualification_ledger_20261105.json"
OBSERVATIONS_PATH = DATA / "netro1_3_identity_evidence_observations_20261105.json"
MIN_IMPORT_SIZE = 50
MAX_IMPORT_SIZE = 100
SUPPORTED_ROLES = {"producer", "trader_distributor", "processor_service_provider"}


@dataclass(frozen=True)
class CandidateDecision:
    candidate_id: str
    domain: str
    proposed_role: str
    eligible: bool
    reasons: tuple[str, ...]


def _load(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def assess_candidate(
    candidate: dict[str, Any], observation: dict[str, Any] | None
) -> CandidateDecision:
    """Fail closed for any missing evidence or unresolved block."""
    reasons: list[str] = []
    if candidate.get("country") != "RO":
        reasons.append("wrong_country")
    if candidate.get("proposed_role") not in SUPPORTED_ROLES:
        reasons.append("role_not_in_canonical_network_taxonomy")
    if candidate.get("qualification_lane") != "net_new_eligible":
        reasons.append("not_adjudicated_net_new")
    if candidate.get("exact_catalog_screen") != "no_exact_normalized_domain_or_name_match":
        reasons.append("cross_catalog_conflict")
    if candidate.get("legal_identity_status") != "onrc_verified":
        reasons.append("live_registry_verification_missing")
    if candidate.get("source_rights_status") != "approved_for_public_facts":
        reasons.append("source_rights_approval_missing")
    if candidate.get("opt_out_status") != "checked_no_objection":
        reasons.append("objection_and_opt_out_screen_missing")
    if candidate.get("technical_semantics_status") != "verified":
        reasons.append("industrial_role_and_product_check_missing")
    if candidate.get("company_facility_separation_status") != "verified":
        reasons.append("legal_entity_facility_group_review_missing")
    if candidate.get("import_ready") is not True:
        reasons.append("explicit_import_readiness_not_approved")
    if candidate.get("publication_approved") is not True:
        reasons.append("publication_governance_not_approved")
    if not candidate.get("independent_legal_reviewer") or not candidate.get("independent_rights_reviewer"):
        reasons.append("independent_review_actors_missing")
    if not candidate.get("last_registry_verified_at") or not candidate.get("last_rights_approved_at"):
        reasons.append("dated_registry_and_rights_evidence_missing")

    if observation is None:
        reasons.append("company_legal_evidence_not_collected")
    else:
        if observation.get("domain") != candidate.get("domain") or observation.get("candidate_id") != candidate.get("candidate_id"):
            reasons.append("legal_evidence_candidate_mismatch")
        if observation.get("onrc_live_check") != "verified":
            reasons.append("official_onrc_evidence_missing")
        if observation.get("source_rights_review") != "approved":
            reasons.append("independent_use_rights_not_approved")
        if observation.get("opt_out_check") != "clear":
            reasons.append("company_objection_check_not_cleared")
        if observation.get("identity_approved") is not True:
            reasons.append("legal_identity_approval_missing")
        if observation.get("import_ready") is not True:
            reasons.append("observation_is_research_only")
        if not observation.get("cui_hint") or not observation.get("register_no_hint"):
            reasons.append("verified_romanian_cui_and_registration_missing")
        if not any(e.get("tier") == "official_onrc" for e in observation.get("evidence", [])):
            reasons.append("official_registry_source_reference_missing")

    return CandidateDecision(
        candidate_id=str(candidate.get("candidate_id", "")),
        domain=str(candidate.get("domain", "")),
        proposed_role=str(candidate.get("proposed_role", "")),
        eligible=not reasons,
        reasons=tuple(reasons),
    )


def report(ledger: dict[str, Any], observations: dict[str, Any]) -> dict[str, Any]:
    if ledger.get("country") != "RO" or ledger.get("production_write_authorized") is not False:
        raise ValueError("Qualification ledger is not an authorized read-only RO cohort")
    if observations.get("country") != "RO" or observations.get("production_write_authorized") is not False:
        raise ValueError("Identity observations are not an authorized read-only RO source")
    candidates = ledger.get("records", [])
    if len({x["candidate_id"] for x in candidates}) != len(candidates):
        raise ValueError("Duplicate candidate ID")
    if len({x["domain"] for x in candidates}) != len(candidates):
        raise ValueError("Duplicate research domain")
    obs_rows = observations.get("records", [])
    if len({x["candidate_id"] for x in obs_rows}) != len(obs_rows):
        raise ValueError("Duplicate identity observations")
    obs = {x["candidate_id"]: x for x in obs_rows}
    if any(x not in {r["candidate_id"] for r in candidates} for x in obs):
        raise ValueError("Evidence references unknown candidate ID")

    assessments = [assess_candidate(c, obs.get(c["candidate_id"])) for c in candidates]
    approved = [x for x in assessments if x.eligible]
    # A dataset with fewer than 50 genuinely approved RO legal entities is
    # never a permissible import cohort, even if all research domains are unique.
    enough = MIN_IMPORT_SIZE <= len(approved) <= MAX_IMPORT_SIZE
    reason_counts = Counter(reason for x in assessments for reason in x.reasons)
    return {
        "contract": "netro1.3-readonly-qualification-v1",
        "mode": "read_only",
        "country": "RO",
        "candidate_websites": len(assessments),
        "identity_observations": len(obs),
        "approved_new_legal_entities": len(approved),
        "import_batch_minimum": MIN_IMPORT_SIZE,
        "import_batch_maximum": MAX_IMPORT_SIZE,
        "eligible_for_protected_import_manifest": enough,
        "missing_approved_entities_to_minimum": max(0, MIN_IMPORT_SIZE - len(approved)),
        "hold_reason_counts": dict(sorted(reason_counts.items())),
        "eligible_by_primary_role": dict(sorted(Counter(x.proposed_role for x in approved).items())),
        "import_performed": False,
        "publication_performed": False,
        "authorization": "RESEARCH_ONLY_NO_IMPORT" if not enough else "MANIFEST_DESIGN_REVIEW_REQUIRED",
    }


def main() -> None:
    result = report(_load(LEDGER_PATH), _load(OBSERVATIONS_PATH))
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
