"""NET-GROWTH3.F.2C — fail-closed human audit gate, strictly offline.

No SQL, no Supabase secrets, no RPC execution, no import manifest writer.
Permission to read a company web page is NOT approval to reuse copyrighted text.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import urlsplit
from typing import Any


ROOT = Path(__file__).resolve().parents[1] / "data"
FILES = (
    "netgrowth3f_first_party_research_20261105.json",
    "netgrowth3f2_industrial_research_20261105.json",
    "netgrowth3f2b_industrial_research_20261105.json",
)
LEDGER = ROOT / "netgrowth3f2c_independent_acceptance_20261105.json"
REVIEW_STATUSES = ("pending_independent_review", "not_verified", "pending_human_review")


def _host(url: str) -> str | None:
    try:
        u = urlsplit(url)
        if u.scheme != "https" or u.username or u.password or u.port is not None or u.fragment:
            return None
        return (u.hostname or "").lower().removeprefix("www.")
    except (ValueError, TypeError):
        return None


def assess(manifests: list[dict[str, Any]], audit: dict[str, Any]) -> dict[str, Any]:
    """Report blockers; never produce a write-capable array for a production RPC."""
    candidates = [r for data in manifests for r in data["records"]]
    if len(candidates) not in range(50, 101):
        raise ValueError("50 to 100 candidates required before any full-cohort review")
    by_domain = {r["domain"]: r for r in candidates}
    if len(by_domain) != len(candidates):
        raise ValueError("Repeated company domains in manifest")
    review = audit.get("entries")
    if not isinstance(review, list) or len(review) != len(candidates):
        raise ValueError("Missing/extra independent review decisions")
    by_review = {r["domain"]: r for r in review}
    if set(by_review) != set(by_domain) or len(by_review) != len(review):
        raise ValueError("Review must cover every candidate exactly once")

    reasons: dict[str, list[str]] = {}
    approved = []
    for domain, candidate in by_domain.items():
        item = by_review[domain]
        errors = []
        source_url = candidate.get("source_url") or candidate.get("evidence_url")
        if _host(source_url) != domain:
            errors.append("source_not_first_party")
        if item.get("original_evidence_url") != source_url or item.get("source_name") != candidate.get("name"):
            errors.append("source_snapshot_mismatch")
        if item.get("proposed_role") != candidate.get("role"):
            errors.append("role_snapshot_mismatch")
        if item.get("live_source_access_status") != "text_readable":
            errors.append("live_source_unavailable_or_requires_recheck")
        if not item.get("public_first_party_tax_id_observed") or not re.fullmatch(
                r"\d{11}", item.get("public_first_party_tax_id_observed", "")):
            errors.append("legal_identifier_not_sourced")
        if item.get("independent_registry_status") != "verified":
            errors.append("independent_registry_unverified")
        if item.get("legal_identity_review") != "approved" or item.get("group_alias_review") != "approved":
            errors.append("legal_identity_or_group_alias_not_approved")
        if item.get("role_review") != "approved":
            errors.append("industrial_role_not_approved")
        if item.get("claim_review") != "approved":
            errors.append("technical_claims_not_approved")
        if item.get("reuse_rights_status") != "approved":
            errors.append("reuse_rights_not_approved")
        if not item.get("reuse_rights_basis_url") or not _host(item["reuse_rights_basis_url"]):
            errors.append("reuse_rights_evidence_missing")
        if not item.get("reviewer") or not item.get("reviewed_at"):
            errors.append("independent_reviewer_missing")
        if item.get("review_holds"):
            errors.append("manual_hold_unresolved")
        if errors:
            reasons[domain] = sorted(set(errors))
        else:
            approved.append(domain)

    # Even if a future human reviewer clears entries, this module does not
    # execute a dry-run or import; a separate production preflight must recheck
    # all current database collisions and obtain the protected merge gate.
    return {
        "mode": "read_only_acceptance",
        "candidate_count": len(candidates),
        "approved_count": len(approved),
        "blocked_count": len(reasons),
        "preflight_rpc_permitted": len(approved) >= 50 and not reasons,
        "production_write_permitted": False,
        "blocking_reasons": reasons,
    }


def report() -> dict[str, Any]:
    manifests = [json.loads((ROOT / f).read_text(encoding="utf-8")) for f in FILES]
    audit = json.loads(LEDGER.read_text(encoding="utf-8"))
    return assess(manifests, audit)


if __name__ == "__main__":
    print(json.dumps(report(), ensure_ascii=False, indent=2))
