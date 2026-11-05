"""NET-GROWTH3.F.2C.3 official evidence preclearance: offline, no SQL/RPC.

GLEIF (with Infocamere RA identifier) is independently corroborative only.
No claim of an active legal entity if a LEI is merely present, particularly
when its registration is LAPSED. Public first-party sources do not grant a
general license for content reuse or turn an entity into a verified supplier.
"""
import json
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit

ROOT=Path(__file__).resolve().parents[1]/"data"
EVIDENCE=ROOT/"netgrowth3f2c3_official_evidence_20261105.json"
PARENT=ROOT/"netgrowth3f2c2_registered_rights_20261105.json"
ASOF=date.fromisoformat("2026-11-05")


def host(u):
    try:
        x=urlsplit(u)
        if x.scheme!="https" or x.username or x.password or x.fragment or x.port is not None:
            return None
        return (x.hostname or "").lower().removeprefix("www.")
    except (TypeError,ValueError):
        return None


def verify():
    e=json.loads(EVIDENCE.read_text(encoding="utf-8"))
    prev=json.loads(PARENT.read_text(encoding="utf-8"))
    rows=e["records"]
    originals=prev["records"]
    if len(rows)!=52 or len(originals)!=52:
        raise ValueError("52 legally reviewed research identities required")
    if len({r["domain"] for r in rows})!=52:
        raise ValueError("Duplicate domains")
    if {r["domain"] for r in rows}!={r["domain"] for r in originals}:
        raise ValueError("An unreviewed domain was inserted")
    parentmap={r["domain"]:r for r in originals}
    issues={}
    current_lei=[]
    lapsed=[]
    for r in rows:
        dom=r["domain"]
        errs=[]
        if r["quarantined"]!= (not parentmap[dom]["is_counted_as_net_new_research_candidate"]):
            errs.append("quarantine_history_mismatch")
        v=r.get("first_party_vat_observed")
        if v is not None and (len(v)!=11 or not v.isdigit() or host(r.get("vat_source_url"))!=dom):
            errs.append("vat_not_sourced_to_first_party")
        l=r.get("gleif_vat_exact_match")
        if l:
            if not v or l["registered_as"]!=v or l["validated_at_authority"]!="RA000407" or l["country"]!="IT":
                errs.append("gleif_identity_mismatch")
            if l["source_url"]!="https://api.gleif.org/api/v1/lei-records/"+l["lei"]:
                errs.append("gleif_url_mismatch")
            if l["registration_status"]=="ISSUED" and l["entity_status"]=="ACTIVE" and date.fromisoformat(l["next_renewal_date"])>ASOF:
                current_lei.append(dom)
            else:
                lapsed.append(dom)
        if r["source_claims_verified_for_ai"] or r["supplier_verified"] or r["rfq_allowed"] or r["stock_confirmed"]:
            errs.append("unapproved_supplier_claim")
        if r["current_chamber_report_verified"] is not True:
            errs.append("official_current_company_registration_not_accepted")
        if r["rights_legal_decision"]!="approved_for_minimized_facts":
            errs.append("rights_review_pending")
        if r["human_role_claim_signoff"]!="approved":
            errs.append("role_and_claim_review_pending")
        if not r["reviewer"] or not r["reviewed_at"] or not r["current_chamber_report_url"]:
            errs.append("signed_reviewer_and_official_document_missing")
        if r["quarantined"]:
            errs.append("brand_or_operator_collision")
        if errs:
            issues[dom]=sorted(set(errs))
    eligible=len(rows)-len(issues)
    return {
      "mode":"read_only",
      "total":len(rows),
      "counted_research_candidates":sum(not r["quarantined"] for r in rows),
      "gleif_current_issued_correlated":len(current_lei),
      "gleif_lapsed_not_entity_ceased":len(lapsed),
      "eligible":eligible,
      "blocked":len(issues),
      "atomic_rollback_preflight_permitted":eligible>=50 and not e["import_allowed"] and not issues,
      "production_commit_permitted":False,
      "issues":issues,
    }


if __name__=="__main__":
    print(json.dumps(verify(),sort_keys=True,indent=2))
