"""NET-EU-TUBIFICI1.B1: conservative first-party European identity observations.

Dedicated canary: never calls the Italian AUTO2/AUTO3 RPCs, never creates
companies, verifies production capacity, grants catalogue rights or publishes.
The database also constrains every observation to the 2026-11-18 EU batch.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import re
import unicodedata
from urllib.parse import urljoin, urlsplit

import httpx

from .company_discovery import (
    CompanyDiscoveryError, _fetch_page, canonical_domain, canonicalize_seed_url,
)
from .net_it_auto2_reviewer import RESTRICTED_REUSE

VERSION = "net-eu-tubifici1-firstparty-v1"
MAX_BATCH = 20
MAX_PAGES = 4
LEGAL_PATH_HINTS = (
    "impressum", "imprint", "legal", "contact", "about", "company",
    "corporate", "datenschutz", "privacy", "unternehmen", "kontakt",
    "aviso-legal", "quienes-somos", "societe", "mentions-legales",
)
# Candidate names are NOT corrected. A country-specific legal form is only
# one necessary signal; a full first-party body-text match is mandatory too.
LEGAL_FORMS = {
    "AT": ("gmbh", "ag", "kg"),
    "CZ": ("a s", "s r o"),
    "DE": ("gmbh", "ag", "kg"),
    "ES": ("s a", "s a u", "s l", "s l u"),
    "FI": ("oy", "oyj"),
    "FR": ("sas", "sarl", "sa", "sasu"),
    "GB": ("limited", "ltd", "plc"),
    "PL": ("s a", "sp z o o"),
    "PT": ("s a", "lda"),
    "SE": ("ab",),
    "SK": ("a s", "s r o"),
    "TR": ("a s", "ltd", "sti"),
    "UA": ("prjsc", "pjsc", "llc", "jsc", "tov"),
}


def normalized(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).casefold()
    return " ".join(re.sub(r"[^\w]+", " ", value, flags=re.UNICODE).split())


def full_name_observed(name: str, body_text: str) -> bool:
    n, t = normalized(name), normalized(body_text)
    return bool(len(n) >= 6 and re.search(r"(?<!\w)" + re.escape(n) + r"(?!\w)", t))


def legal_form_present(name: str, country: str) -> bool:
    words = " " + normalized(name) + " "
    return any(" " + form + " " in words for form in LEGAL_FORMS.get(country, ()))


def prepare(candidate: dict) -> tuple[str, str]:
    if candidate.get("country_code") not in LEGAL_FORMS:
        raise ValueError("country_not_supported_by_canary")
    domain = str(candidate.get("domain") or "").lower().strip()
    source = canonicalize_seed_url(str(candidate["url"]))
    homepage = canonicalize_seed_url(str(candidate["website_url"]))
    if (urlsplit(source).scheme != "https"
            or urlsplit(homepage).scheme != "https"
            or canonical_domain(source) != domain
            or canonical_domain(homepage) != domain):
        raise ValueError("first_party_https_domain_mismatch")
    return source, domain


def result(candidate: dict, verdict: str, reasons: list[str], *,
           domain: str | None = None, page_url: str | None = None,
           digest: str | None = None, matched: bool = False,
           rights: str = "unknown") -> dict:
    return {
        "p_candidate_id": str(candidate["id"]),
        "p_reviewer_version": VERSION,
        "p_verdict": verdict,
        "p_reasons": sorted(set(reasons))[:20],
        "p_observed_domain": domain,
        "p_observed_name": candidate.get("company_name") if matched else None,
        "p_page_url": page_url,
        "p_hash": digest,
        "p_name_matched": matched,
        "p_confidence": 0.95 if verdict == "observed_match" else 0.0,
        "p_rights_state": rights,
    }


async def inspect_candidate(client: httpx.AsyncClient, candidate: dict) -> dict:
    try:
        source, domain = prepare(candidate)
    except (KeyError, TypeError, ValueError, CompanyDiscoveryError):
        return result(candidate, "insufficient", ["invalid_or_unsupported_source"])
    pages = []
    try:
        first = await _fetch_page(client, source, source)
        if first and canonical_domain(first.url) == domain:
            pages.append(first)
    except (CompanyDiscoveryError, httpx.HTTPError, ValueError):
        pass
    if not pages:
        return result(candidate, "insufficient", ["source_unavailable_or_restricted"])
    root = str(candidate["website_url"])
    if root != source and len(pages) < MAX_PAGES:
        try:
            home = await _fetch_page(client, root, source)
            if home and canonical_domain(home.url) == domain:
                pages.append(home)
        except (CompanyDiscoveryError, httpx.HTTPError, ValueError):
            pass
    seen = {p.url for p in pages}
    for page in list(pages):
        if len(pages) >= MAX_PAGES:
            break
        for href in page.links:
            if len(pages) >= MAX_PAGES:
                break
            try:
                target = canonicalize_seed_url(urljoin(page.url, href))
            except (CompanyDiscoveryError, ValueError):
                continue
            if (target in seen or canonical_domain(target) != domain
                    or not any(k in urlsplit(target).path.lower() for k in LEGAL_PATH_HINTS)):
                continue
            seen.add(target)
            try:
                doc = await _fetch_page(client, target, source)
                if doc and canonical_domain(doc.url) == domain:
                    pages.append(doc)
            except (CompanyDiscoveryError, httpx.HTTPError, ValueError):
                pass
    name = str(candidate.get("company_name") or "")
    matched_page = next((p for p in pages if full_name_observed(name, p.text)), None)
    terms_restricted = any(RESTRICTED_REUSE.search(p.text) for p in pages)
    reasons: list[str] = []
    if not matched_page:
        reasons.append("full_legal_name_not_observed")
    if not legal_form_present(name, str(candidate["country_code"])):
        reasons.append("local_legal_form_not_identified")
    if "group_or_legal_entity_review" in candidate.get("quality_flags", []):
        reasons.append("group_or_facility_identity_unresolved")
    if terms_restricted:
        reasons.append("explicit_source_reuse_restriction")
    # An exact first-party name and local form are observations, not a verified
    # legal entity or proof that this company produces a particular tube.
    verdict = ("blocked" if terms_restricted else
               "observed_match" if matched_page and not reasons else "insufficient")
    proof = matched_page or pages[0]
    digest = hashlib.sha256(
        (proof.url + "\\n" + proof.text[:10000]).encode("utf-8")
    ).hexdigest()
    return result(candidate, verdict, reasons, domain=domain, page_url=proof.url,
                  digest=digest, matched=bool(matched_page),
                  rights="restricts_reuse" if terms_restricted else "unknown")


async def execute(*, limit: int = 20, persist: bool = False) -> dict:
    if not 1 <= limit <= MAX_BATCH:
        raise ValueError("limit must be 1..20")
    host = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not host or not key:
        raise RuntimeError("service-side Supabase credential missing")
    headers = {"apikey": key, "Authorization": "Bearer " + key,
               "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=httpx.Timeout(35), follow_redirects=False) as api:
        q = await api.post(host + "/rest/v1/rpc/net_eu_tubifici1_queue",
                           headers=headers, json={"p_max": limit})
        q.raise_for_status()
        payload = q.json()
        if payload.get("contract") != "net-eu-tubifici1-identity-queue-v1":
            raise RuntimeError("unexpected EU research contract")
        candidates = payload.get("items", [])
        observations: list[dict] = []
        for i, candidate in enumerate(candidates):
            if i:
                await asyncio.sleep(0.5)
            observations.append(await inspect_candidate(api, candidate))
        stored = 0
        if persist:
            for finding in observations:
                response = await api.post(host + "/rest/v1/rpc/net_eu_tubifici1_record",
                                          headers=headers, json=finding)
                response.raise_for_status()
                receipt = response.json()
                if (receipt.get("contract") != "net-eu-tubifici1-identity-observation-v1"
                        or receipt.get("published") != 0
                        or receipt.get("identity_verified") is not False):
                    raise RuntimeError("EU research must remain evidence-only")
                stored += 1
        return {
            "mode": "persist_private_evidence" if persist else "dry_run",
            "queued": len(candidates), "inspected": len(observations),
            "recorded": stored, "published": 0,
            "observed_match": sum(x["p_verdict"] == "observed_match" for x in observations),
            "insufficient": sum(x["p_verdict"] == "insufficient" for x in observations),
            "blocked": sum(x["p_verdict"] == "blocked" for x in observations),
        }


def main() -> int:
    parser = argparse.ArgumentParser(description="EU steel tube producer identity canary")
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--persist", action="store_true",
                        help="Only append private first-party observations; never publish")
    args = parser.parse_args()
    try:
        print(json.dumps(asyncio.run(execute(limit=args.limit, persist=args.persist)),
                         sort_keys=True))
        return 0
    except (ValueError, RuntimeError, httpx.HTTPError) as exc:
        print(json.dumps({"status": "review_failed", "error_type": type(exc).__name__}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
