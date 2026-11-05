"""NET-GROWTH3.F.2C.2: read-only legal/rights acceptance, no RPC payload.

Company web pages and LEI records provide evidence, not a human publication
authorization. The only output of this module is an audit report.
"""
from __future__ import annotations
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1] / "data"
LEDGER = ROOT / "netgrowth3f2c2_registered_rights_20261105.json"
SOURCE_FILES = (
    "netgrowth3f_first_party_research_20261105.json",
    "netgrowth3f2_industrial_research_20261105.json",
    "netgrowth3f2b_industrial_research_20261105.json",
)
RESERVES = ROOT / "netgrowth3f2c1_corporate_source_remediation_20261105.json"
HOLD_CODES = {
    "not_counted_or_brand_collision",
    "official_registry_not_accepted",
    "missing_business_vat",
    "source_claim_not_accepted",
    "rights_decision_not_signed",
    "company_reviewer_not_signed",
    "source_url_not_first_party",
}


def _host(url):
    try:
        x = urlsplit(url)
        if x.scheme != "https" or x.username or x.password or x.port is not None or x.fragment:
            return None
        return (x.hostname or "").lower().removeprefix("www.")
    except (TypeError, ValueError):
        return None


def snapshot():
    return json.loads(LEDGER.read_text(encoding="utf8"))


def audit():
    data = snapshot()
    rows = data["records"]
    original = [
        row for f in SOURCE_FILES
        for row in json.loads((ROOT / f).read_text(encoding="utf8"))["records"]
    ]
    reserves = json.loads(RESERVES.read_text(encoding="utf8"))["replacement_reserve"]
    research_domains = {r["domain"] for r in original + reserves}
    if len(original) != 50 or len(reserves) != 2:
        raise ValueError("Research source counts changed")
    if len(rows) != len(research_domains) or len(rows) != 52:
        raise ValueError("Missing or extra corporate identity review")
    if len({r["domain"] for r in rows}) != len(rows):
        raise ValueError("Repeated domain in reviewed companies")
    if {r["domain"] for r in rows} != research_domains:
        raise ValueError("Reviewed domains do not match versioned research sources")
    status = []
    for r in rows:
        reasons = []
        if not r["is_counted_as_net_new_research_candidate"]:
            reasons.append("not_counted_or_brand_collision")
        if _host(r["source_url"]) != r["domain"]:
            reasons.append("source_url_not_first_party")
        if not r["first_party_vat_candidate"] or not re.fullmatch(r"\d{11}", r["first_party_vat_candidate"]):
            reasons.append("missing_business_vat")
        if r["registration_verification"] != "official_current_registry_validated" or r["legal_entity_confirmation"] != "approved_human":
            reasons.append("official_registry_not_accepted")
        if r["source_quality_review"] != "approved_human" or r["technical_claim_review"] != "approved_human":
            reasons.append("source_claim_not_accepted")
        if r["rights_assessment"] != "approved_legal_basis":
            reasons.append("rights_decision_not_signed")
        if not r.get("reviewer") or not r.get("reviewed_at") or not r.get("acceptance_artifact_url"):
            reasons.append("company_reviewer_not_signed")
        if r["reuse_of_protected_media_or_bulk_catalog"]:
            reasons.append("rights_decision_not_signed")
        status.append({"domain":r["domain"],"status":"held" if reasons else "candidate_eligible_for_separate_preflight",
                       "blockers":sorted(set(reasons))})
    eligible = sum(not x["blockers"] for x in status)
    research = sum(r["is_counted_as_net_new_research_candidate"] for r in rows)
    # Absolutely no DB writes, secrets, or RPC. A subsequent read-only run must
    # re-check domain/name/VAT/opt-out collisions and protected CI on exact approved manifest.
    return {"mode":"read_only", "reviewed":len(rows), "research_candidates":research,
            "excluded_brand_collisions":len(rows)-research,
            "company_approvals":eligible,"held":len(rows)-eligible,
            "can_stage_rollback_preflight":eligible >= 50 and eligible == research,
            "production_write_authorized":False,
            "cases":status}


if __name__ == "__main__":
    print(json.dumps(audit(),ensure_ascii=False,indent=2))
