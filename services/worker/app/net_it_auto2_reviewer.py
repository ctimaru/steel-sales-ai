"""NET-IT-AUTO2: automatic first-party identity research, never automatic approval.

Read-only by default. The --persist mode records *machine evidence* privately,
not human governance decisions and never public Network companies. Uses the
existing SSRF-, DNS-, redirect-, robots- and body-size-protected crawler.
Run under the worker's existing service credential on a bounded schedule.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import re
from datetime import datetime, timezone
from html import unescape
from urllib.parse import urlsplit

import httpx

from .company_discovery import (
    CompanyDiscoveryError, _fetch_page, _priority_links,
    canonical_domain, canonicalize_seed_url,
)

VERSION = "net-it-auto2-firstparty-v1"
MAX_BATCH = 50
MAX_PAGES = 3
CORPORATE_SUFFIX = re.compile(
    r"\b(?:S\.?\s*R\.?\s*L\.?|S\.?\s*P\.?\s*A\.?|S\.?\s*N\.?\s*C\.?|"
    r"S\.?\s*A\.?\s*S\.?|SRLS|SOCIETA|SOCIETÀ|LIMITED|LTD)\b", re.I
)
NON_BUSINESS = ("facebook.com", "linkedin.com", "paginegialle.it",
                "instagram.com", "google.com", "kompass.com", "europages.com")
RESTRICTED_REUSE = re.compile(
    r"(?:vietat[oa]|non\s+[eè]\s+consentit[oa]|prohibit(?:ed)?|not\s+permitted)"
    r".{0,90}(?:riutilizz|riproduzion|scraping|automati|database|data\s+extraction)"
    r"|(?:scraping|data\s+extraction|riutilizz|riproduzion)"
    r".{0,90}(?:vietat[oa]|non\s+[eè]\s+consentit[oa]|prohibit(?:ed)?|not\s+permitted)",
    re.I,
)


def _normalize_name(value: str) -> str:
    value = unescape(value).casefold()
    value = CORPORATE_SUFFIX.sub(" ", value)
    value = re.sub(r"[^a-z0-9à-ÿ]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def _normalize_full_legal_name(value: str) -> str:
    """Keep legal form: a brand alone is NOT proof of S.r.l./S.p.A."""
    value = unescape(value).casefold()
    for letters in ("srl", "spa", "snc", "sas"):
        dotted = r"\b" + r"[.\s]*".join(letters) + r"[.\s]*\b"
        value = re.sub(dotted, letters, value)
    value = re.sub(r"[^a-z0-9à-ÿ]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def _name_evidenced(name: str, page_texts: list[str]) -> bool:
    normalized = _normalize_full_legal_name(name)
    # A corporate suffix on the candidate must ALSO appear on the first-party
    # body text. A brand-only title or partial token match is not enough.
    if len(normalized) < 8:
        return False
    for page in page_texts:
        text = _normalize_full_legal_name(page)
        if re.search(r"(?<![a-z0-9à-ÿ])" + re.escape(normalized)
                     + r"(?![a-z0-9à-ÿ])", text):
            return True
    return False


def _validate_official_website(candidate: dict) -> tuple[str, str]:
    source = canonicalize_seed_url(str(candidate["url"]))
    website = canonicalize_seed_url(str(candidate["website_url"]))
    domain = str(candidate["domain"]).lower().strip()
    if not domain or domain in NON_BUSINESS or any(
        domain.endswith("." + blocked) for blocked in NON_BUSINESS
    ):
        raise ValueError("not_an_independent_corporate_domain")
    if canonical_domain(source) != domain or canonical_domain(website) != domain:
        raise ValueError("source_website_domain_mismatch")
    if urlsplit(source).scheme != "https" or urlsplit(website).scheme != "https":
        raise ValueError("https_required_for_machine_verification")
    return source, domain


async def inspect_candidate(client: httpx.AsyncClient, candidate: dict) -> dict:
    """Return bounded evidence fields only; never a human approval decision."""
    reasons: list[str] = []
    try:
        source, domain = _validate_official_website(candidate)
    except (ValueError, KeyError, CompanyDiscoveryError, TypeError):
        return _finding(candidate, "needs_human", ["invalid_or_untrusted_domain"])

    pages = []
    try:
        home = await _fetch_page(client, source, source)
        if not home:
            return _finding(candidate, "needs_human", ["robots_blocked_or_unavailable"])
        pages.append(home)
        for link in _priority_links(home)[: MAX_PAGES - 1]:
            try:
                page = await _fetch_page(client, link, source)
                if page and canonical_domain(page.url) == domain:
                    pages.append(page)
            except (CompanyDiscoveryError, httpx.HTTPError, ValueError):
                pass
    except (CompanyDiscoveryError, httpx.HTTPError, ValueError):
        return _finding(candidate, "needs_human", ["fetch_rejected_or_unavailable"])

    # Title/H1/og:site_name may repeat an unverified brand, even when the
    # actual company identity on the page is different. Require the full
    # corporate name in first-party BODY text, not merely page metadata.
    texts = [str(p.text[:18000]) for p in pages]
    matched = _name_evidenced(str(candidate.get("company_name") or ""), texts)
    if not matched:
        reasons.append("corporate_name_not_evidenced")
    if "legal_identity_not_verified" in candidate.get("quality_flags", []):
        reasons.append("existing_legal_identity_hold")
    if "historical_sole_trader_vat_context" in candidate.get("quality_flags", []):
        reasons.append("sole_trader_identity_exception")
    if not candidate.get("role_keys"):
        reasons.append("industrial_role_unknown")
    # Safeguard: the terms check is a signal, NOT a license determination.
    restricted = any(RESTRICTED_REUSE.search(t) for t in texts)
    if restricted:
        reasons.append("explicit_reuse_restriction_detected")
    # Provenance is hash only: no raw page, phone, emails or names of persons.
    digest = hashlib.sha256(
        "\n".join(f"{p.url}\n{p.text[:10000]}" for p in pages)
        .encode("utf-8")
    ).hexdigest()
    verdict = "blocked" if restricted else (
        "identity_supported" if matched and not reasons else "needs_human"
    )
    # Even identity_supported is NOT rights-approved / publishable.
    return _finding(
        candidate,verdict,reasons,domain=domain,name_matched=matched,
        observed_name=str(candidate.get("company_name") or "") if matched else None,
        page_url=pages[0].url,page_hash=digest,
        confidence=0.94 if verdict == "identity_supported" else 0.4,
        rights="restricts_reuse" if restricted else "unknown",
    )


def _finding(candidate: dict, verdict: str, reasons: list[str],
             *, domain: str | None = None,name_matched: bool = False,
             observed_name: str | None = None,page_url: str | None = None,
             page_hash: str | None = None,confidence: float = 0.0,
             rights: str = "unknown") -> dict:
    return {
        "p_candidate_id": str(candidate["id"]),
        "p_reviewer_version": VERSION,
        "p_verdict": verdict,
        "p_reasons": reasons,
        "p_observed_domain": domain,
        "p_matched_name": name_matched,
        "p_observed_name": observed_name,
        "p_page_url": page_url,
        "p_hash": page_hash,
        "p_confidence": confidence,
        "p_terms_url": None,
        "p_rights_state": rights,
    }


async def review_batch(candidates: list[dict], *, pause_seconds: float = 0.3) -> list[dict]:
    if not 1 <= len(candidates) <= MAX_BATCH:
        raise ValueError("batch must contain 1 to 50 company records")
    found_ids = [str(c.get("id")) for c in candidates]
    if len(set(found_ids)) != len(found_ids):
        raise ValueError("duplicate candidate identifiers")
    results = []
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(10.0), follow_redirects=False
    ) as client:
        for i, candidate in enumerate(candidates):
            if i:
                await asyncio.sleep(pause_seconds)
            results.append(await inspect_candidate(client, candidate))
    return results


async def execute(*, limit: int = 25, persist: bool = False) -> dict:
    if limit not in range(1, MAX_BATCH + 1):
        raise ValueError("limit must be 1..50")
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise RuntimeError("server-side database credential unavailable")
    headers = {
        "apikey": key, "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    # Service credential never enters the browser.
    async with httpx.AsyncClient(timeout=httpx.Timeout(35.0)) as client:
        response = await client.post(f"{url}/rest/v1/rpc/net_it_auto2_queue",
                                     headers=headers,json={"p_max":limit})
        response.raise_for_status()
        payload = response.json()
        if payload.get("contract") != "net-it-auto2-queue-v1":
            raise RuntimeError("unexpected queue contract")
        candidates = payload.get("items", [])
        if not candidates:
            return {"mode":"evidence_recording" if persist else "dry_run",
                    "reviewed":0,"recorded":0,"published":0,"exceptions":0}

        findings = await review_batch(candidates)
        written = 0
        if persist:
            for finding in findings:
                r = await client.post(f"{url}/rest/v1/rpc/net_it_auto2_record",
                                      headers=headers,json=finding)
                r.raise_for_status()
                result = r.json()
                if result.get("contract") != "net-it-auto2-review-v1" or result.get("publication_count") != 0:
                    raise RuntimeError("unexpected evidence-only response")
                written += 1
        return {
            "mode":"evidence_recording" if persist else "dry_run",
            "reviewed":len(findings),"recorded":written,
            "identity_supported":sum(f["p_verdict"]=="identity_supported" for f in findings),
            "exceptions":sum(f["p_verdict"]!="identity_supported" for f in findings),
            "published":0,
            "candidate_ids":[f["p_candidate_id"] for f in findings],
        }


def main() -> int:
    parser=argparse.ArgumentParser(description="NET-IT-AUTO2 official-site reviewer")
    parser.add_argument("--limit",type=int,default=25)
    parser.add_argument("--persist",action="store_true",
                        help="Record private agent evidence; never publish profiles")
    args=parser.parse_args()
    try:
        result=asyncio.run(execute(limit=args.limit,persist=args.persist))
    except (ValueError,RuntimeError,httpx.HTTPError) as exc:
        print(json.dumps({"status":"review_failed","error_type":type(exc).__name__}))
        return 1
    print(json.dumps(result,ensure_ascii=False,sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
