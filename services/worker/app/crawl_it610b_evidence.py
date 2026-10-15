"""CRAWL-IT6.10b — validate evidence records for review-only staging.

No implicit DB writes: intentionally separate planning from committing.
"""
from __future__ import annotations
from typing import Any
from urllib.parse import urlsplit
from .company_discovery import canonical_domain, canonicalize_seed_url

ALLOWED_ROLES = frozenset({"producer","trader_distributor","processor_service_provider","end_user"})
MAX_PAGES = 3

def proposed_evidence(candidate: dict[str, Any], lead_id: str) -> dict[str, Any]:
    domain = str(candidate.get("canonical_domain") or "")
    url = canonicalize_seed_url(str(candidate.get("website_url") or ""))
    if urlsplit(url).scheme != "https" or canonical_domain(url) != domain:
        raise ValueError("Mismatched company domain or non-HTTPS URL")
    roles = candidate.get("role_keys") or []
    if not isinstance(roles, list) or not roles or any(r not in ALLOWED_ROLES for r in roles):
        raise ValueError("Unverified role classification")
    evidence = candidate.get("evidence") or []
    if not isinstance(evidence, list) or not 1 <= len(evidence) <= MAX_PAGES:
        raise ValueError("Evidence must contain 1-3 official-site pages")
    for item in evidence:
        if not isinstance(item,dict) or canonical_domain(canonicalize_seed_url(item.get("url",""))) != domain:
            raise ValueError("Cross-domain evidence is not allowed")
    facilities = candidate.get("facility_candidates") or []
    clean_geo = [{"city": f.get("city"),"province_code":f.get("province_code"),
                  "region":f.get("region"),"source_url":f.get("source_url")}
                 for f in facilities if f.get("country_code")=="IT" and f.get("city")]
    return {
        "lead_id":lead_id, "domain":domain, "website_url":url,
        "company_name":str(candidate.get("legal_name") or "")[:180],
        "role_keys":roles, "confidence":float(candidate.get("confidence") or 0),
        "quality_flags":list(candidate.get("quality_flags") or []),
        "evidence_urls":[x["url"] for x in evidence],
        "geo_evidence":clean_geo[:5],
        "status":"pending_review",
        "human_approval_required":True,
    }
