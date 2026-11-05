"""NET-GROWTH3.F.2C.4 — official visure and rights sign-off queue, fail-closed.

A GLEIF CC0 LEI record is identity evidence, not a Visura, factory capability,
supplier certification, rights approval for a company website or stock.
No database connectivity. No import payload generator. No RPC/COMMIT.
"""
from __future__ import annotations
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

ROOT=Path(__file__).resolve().parents[1]/"data"
QUEUE=ROOT/"netgrowth3f2c4_visure_rights_queue_20261105.json"
PARENT=ROOT/"netgrowth3f2c3_official_evidence_20261105.json"
EXPECTED_ACTIVE=50
VISURA_ISSUER="Registro Imprese / InfoCamere"


def _host(u):
    try:
        x=urlsplit(u)
        if x.scheme != "https" or x.port is not None or x.username or x.password or x.fragment:
            return None
        return (x.hostname or "").lower().removeprefix("www.")
    except (TypeError, ValueError):
        return None


def _docref(u):
    # Document must be a nonpublic evidence-store handle, NOT personal data.
    return isinstance(u, str) and bool(re.fullmatch(r"evidence://[a-z0-9][a-z0-9/_-]{5,180}", u))


def _vat(v):
    return isinstance(v, str) and bool(re.fullmatch(r"[0-9]{11}", v))


def evaluate_row(r):
    if r["quarantined"]:
        return ["quarantined_brand_or_owner"]
    errors=[]
    vat=r["identity_evidence"].get("company_vat")
    if not _vat(vat):
        errors.append("company_tax_id_missing")
    elif _host(r["identity_evidence"].get("company_vat_url")) != r["domain"]:
        errors.append("company_tax_id_provenance_incorrect")
    lei=r["identity_evidence"].get("gleif_lei")
    if lei:
        i=r["identity_evidence"]
        if i.get("gleif_registered_vat") != vat or i.get("gleif_source_url") != (
            "https://api.gleif.org/api/v1/lei-records/"+lei
        ):
            errors.append("gleif_reference_mismatch")
    v=r["visura_request"]
    if not (_docref(v["document_storage_ref"]) and re.fullmatch(r"[a-f0-9]{64}",v.get("document_sha256") or "")):
        errors.append("official_document_missing")
    if v["issuer"] != VISURA_ISSUER or not v["issue_date"] or not v["reviewed_at"]:
        errors.append("official_document_review_missing")
    if v["registered_vat"] != vat or not v["registered_legal_name"] or v["registered_company_status"]!="active":
        errors.append("registered_identity_not_confirmed")
    if not v["registered_legal_form"] or not v["registered_office"] or not v["rea_number"]:
        errors.append("company_register_fields_incomplete")
    if v["group_brand_operating_entity_resolution"]!="approved":
        errors.append("company_alias_or_operator_not_resolved")
    if not v["reviewer"] or not _docref(v["review_attestation_ref"]):
        errors.append("official_document_not_signed")
    x=r["rights"]
    if not (x["website_rights_decision"]=="approved_minimal_original_facts" and
            x["database_rights_evaluation"]=="approved_no_bulk_copy" and
            x["personal_data_legal_basis"]=="approved_for_legal_person_metadata" and
            x["optout_check"]=="clear"):
        errors.append("rights_privacy_or_optout_not_approved")
    if not x["legal_reviewer"] or not _docref(x["decision_document_ref"]) or not x["allowed_publication_scope"]:
        errors.append("rights_approval_artifact_missing")
    if x["copy_site_text_photos_logos_catalog"] or not x["original_summary_only"]:
        errors.append("protected_company_content_prohibited")
    role=r["industrial_role"]
    if role["role_review"]!="approved" or role["final_role"] not in ("producer","processor_service_provider"):
        errors.append("industrial_role_not_approved")
    if role["final_role"]!=role["proposal"] and not role["changed_role_reason"]:
        errors.append("industrial_role_correction_unexplained")
    if _host(role["source_url"])!=r["domain"] or not role["reviewer"] or not _docref(role["review_attestation_ref"]):
        errors.append("industrial_role_evidence_missing")
    claims=r["claims"]
    if not claims:
        errors.append("no_technical_source_claims")
    accepted=0
    for c in claims:
        if c["review_decision"]=="approved_first_party_factual_claim":
            accepted+=1
            if _host(c["review_url"])!=r["domain"] or not c["approved_original_summary"] or not c["reviewer"] or not c["reviewed_at"]:
                errors.append("approved_technical_claim_lacks_evidence")
        elif c["review_decision"]!="rejected_not_reusable":
            errors.append("unreviewed_technical_claim")
    if accepted<1:
        errors.append("no_approved_technical_relevance")
    a=r["final_company_decision"]
    if a["status"]!="approved_for_further_preflight" or not a["reviewer"] or not a["reviewed_at"] or not _docref(a["approval_document_ref"]):
        errors.append("independent_company_acceptance_not_signed")
    # This is a paperwork gate only. A fresh DB + aliases/opt-outs preflight,
    # branch protection, CI and separate RPC service-role ROLLBACK are required.
    if r["ai_visibility"]["supplier_verified"] or r["ai_visibility"]["stock_known"] or r["ai_visibility"]["rfq_allowed"]:
        errors.append("unapproved_ai_supplier_or_stock_assertion")
    return sorted(set(errors))


def validate(queue):
    parent=json.loads(PARENT.read_text(encoding="utf-8"))
    records=queue["records"]
    if len(records)!=52 or len({r["domain"] for r in records})!=52:
        raise ValueError("Complete 52-company review packet required")
    by_parent={r["domain"]:r for r in parent["records"]}
    if set(by_parent)!={r["domain"] for r in records}:
        raise ValueError("Company research source snapshot was changed")
    for r in records:
        if r["quarantined"]!=by_parent[r["domain"]]["quarantined"]:
            raise ValueError("Branded/duplicate quarantines cannot be bypassed")
        if r["identity_evidence"]["company_vat"]!=by_parent[r["domain"]]["first_party_vat_observed"]:
            raise ValueError("VAT identity changed without separate source review")
    active=[r for r in records if not r["quarantined"]]
    if len(active)!=EXPECTED_ACTIVE:
        raise ValueError("Need 50 non-excluded legal prospects")
    violations={r["domain"]:evaluate_row(r) for r in records if evaluate_row(r)}
    ready=len(active)-sum(r["domain"] in violations for r in active)
    return {
        "mode":"read_only", "profiles_total":len(records),
        "research_eligible":len(active), "quarantined":len(records)-len(active),
        "official_documents_recorded":sum(_docref(r["visura_request"]["document_storage_ref"]) for r in active),
        "company_paperwork_approved":ready,
        "blocked_active":len(active)-ready,
        "may_request_separate_db_preflight":ready==len(active) and not violations.get(""),
        "transactional_rpc_rollback_executed":False,
        "production_commit_permitted":False,
        "blocking_reasons":violations,
    }


def report():
    return validate(json.loads(QUEUE.read_text(encoding="utf-8")))


if __name__=="__main__":
    print(json.dumps(report(),ensure_ascii=False,indent=2))
