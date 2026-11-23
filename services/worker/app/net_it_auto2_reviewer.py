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
import time
from datetime import datetime, timezone
from html import unescape
from urllib.parse import urljoin, urlsplit

import httpx

from .company_discovery import (
    PRIORITY_PATH_HINTS, CompanyDiscoveryError, CrawledPage, _fetch_page,
    canonical_domain, canonicalize_seed_url,
)
from .net_it_identity_extract import (find_company_identity, is_civic_snc_address,
                                       legal_name_is_clean, publisher_legal_name_is_clean)

# v2 (NET-IT-GROWTH1): reads legal/contact pages where Italian companies print
# their ragione sociale and P.IVA, matches on the whole extracted page text,
# and no longer treats the legacy "legal_identity_not_verified" flag as an
# automatic exception: this first-party check IS the identity check it asks for.
# v3 (NET-IT-GROWTH5, founder decision 13 Nov 2026): partnerships S.n.c. and
# S.a.s. are admitted with the same full-name first-party check; sole traders
# (no corporate legal form) still go to human review.
# v4 (NET-IT-AUTO4, founder decision 13 Nov 2026, "no human review"): when the
# crawler's name is a brand or a domain, the reviewer reads the company's own
# ragione sociale (legal form included, usually next to the P.IVA) from the
# official pages and proposes it as a correction. When no company name exists
# on the site it says so ("no_company_name_on_site"); the database then
# discards the candidate automatically instead of waiting for a human.
VERSION = "net-it-auto2-firstparty-v4"
MAX_BATCH = 50
MAX_PAGES = 5
# One-time Overture4 recovery: deeper first-party pages, bounded I/O per run.
RECOVERY_MAX_BATCH = 12
RECOVERY_MAX_PAGES = 10
# Pages where the company's own legal identity is usually printed.
IDENTITY_PATH_HINTS = (
    "contatt", "contact", "dove-siamo", "privacy", "note-legali", "legal",
    "imprint", "impressum", "dati-societari", "informativa", "cookie",
)
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
        dotted = r"\b" + r"[.\s]*".join(letters) + r"\.?(?![a-z0-9])"
        value = re.sub(dotted, letters, value)
    value = re.sub(r"[^a-z0-9à-ÿ]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


ADMITTED_LEGAL_FORMS = ("srl", "spa", "srls", "snc", "sas")


def _is_capital_company(name: str) -> bool:
    """An admitted company legal form as a whole token: S.r.l./S.r.l.s./S.p.A.
    and, since v3, the partnerships S.n.c./S.a.s. Sole traders have no such
    token and stay with human review; the same rule is enforced again by the
    AUTO3 release query and the PA1.5 guard."""
    tokens = _normalize_full_legal_name(name).split()
    return any(token in ADMITTED_LEGAL_FORMS for token in tokens)


def _has_contaminated_name_prefix(current: str, evidenced: str) -> bool:
    """An official page may print '© 2023 ... Acme S.r.l.' as one text run.

    Remove leading or trailing footer/product copy only when the entire
    independently evidenced legal name is an exact word-boundary prefix or
    suffix of the initial guess. Never invent a legal form or alias.
    """
    bad = _normalize_full_legal_name(current)
    clean = _normalize_full_legal_name(evidenced)
    return bool(clean and bad != clean and
                (bad.endswith(" " + clean) or bad.startswith(clean + " ")))


def _has_bad_name_case_or_spacing(current: str, evidenced: str) -> bool:
    """Repair typography only when the extracted whole identity is identical.

    A first-party string like 'grisenti.S.n.c.' can be proven but cannot pass
    the publication quality gate. This must never replace a different brand.
    """
    return bool(current and evidenced and current != evidenced
                and current[:1].islower() and evidenced[:1].isupper()
                and _normalize_full_legal_name(current)
                    == _normalize_full_legal_name(evidenced))


def _name_evidenced(name: str, page_texts: list[str]) -> bool:
    # "C.da Piana snc" in an address means no civic number, not a company.
    if is_civic_snc_address(name):
        return False
    normalized = _normalize_full_legal_name(name)
    # A corporate suffix on the candidate must ALSO appear on the first-party
    # body text. A brand-only title or partial token match is not enough.
    # Three-letter official acronyms (e.g. CDM S.r.l.) are valid complete
    # first-party identities; two-letter guesses still fail closed. The
    # domain relationship and legal form are checked separately before write.
    if len(normalized) < 7:
        return False
    for page in page_texts:
        text = _normalize_full_legal_name(page)
        for match in re.finditer(r"(?<![a-z0-9à-ÿ])" + re.escape(normalized)
                                 + r"(?![a-z0-9à-ÿ])", text):
            # "2M S.n.c. di Alfred e Denis Murer" is NOT first-party proof
            # that the truncated "2M S.n.c." is the legal company name.
            # A standalone occurrence elsewhere is still valid evidence.
            following = text[match.end():match.end() + 90]
            if re.match(r"\s+(?:di|de|del|della)\s+[a-zà-ÿ]", following):
                continue
            return True
    return False


def _identity_links(home: CrawledPage, limit: int) -> list[str]:
    """Same-domain links ranked: legal/contact pages first, then company pages."""
    domain = canonical_domain(home.url)
    seen: set[str] = {home.url}
    ranked: list[tuple[int, int, str]] = []
    for position, href in enumerate(home.links):
        try:
            url = canonicalize_seed_url(urljoin(home.url, href))
        except CompanyDiscoveryError:
            continue
        if url in seen or canonical_domain(url) != domain:
            continue
        path = urlsplit(url).path.lower()
        if any(h in path for h in IDENTITY_PATH_HINTS):
            rank = 0
        elif any(h in path for h in PRIORITY_PATH_HINTS):
            rank = 1
        else:
            continue
        seen.add(url)
        ranked.append((rank, position, url))
    ranked.sort()
    return [url for _, _, url in ranked[:limit]]


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


def _same_host_root_fallback(candidate: dict, source: str, domain: str) -> str | None:
    """One pre-recorded company homepage, never a fabricated bypass URL.

    A denied subpath does not imply the official homepage is allowed. The
    normal _fetch_page must independently enforce robots, DNS, SSRF, size,
    redirect, and rights restrictions on BOTH URLs. No new host is accepted.
    """
    try:
        website = canonicalize_seed_url(str(candidate["website_url"]))
        src, dst = urlsplit(source), urlsplit(website)
        if (website == source or dst.scheme != "https"
                or src.netloc != dst.netloc or dst.path not in ("", "/")
                or dst.query or dst.fragment or canonical_domain(website) != domain):
            return None
        return website
    except (KeyError, TypeError, ValueError, CompanyDiscoveryError):
        return None


async def inspect_candidate(client: httpx.AsyncClient, candidate: dict,
                            *, deep_recovery: bool = False) -> dict:
    """Return bounded evidence fields only; never a human approval decision."""
    reasons: list[str] = []
    try:
        source, domain = _validate_official_website(candidate)
    except (ValueError, KeyError, CompanyDiscoveryError, TypeError):
        return _finding(candidate, "needs_human", ["invalid_or_untrusted_domain"])

    pages = []
    primary_fetch_error = False
    try:
        home = await _fetch_page(client, source, source)
    except (CompanyDiscoveryError, httpx.HTTPError, ValueError):
        primary_fetch_error = True
        home = None
    if not home:
        # Only a previously recorded official homepage on the SAME HTTPS host.
        # Never infer a new URL and never override a robots denial: the normal
        # protected fetch independently checks the fallback as well.
        website = _same_host_root_fallback(candidate, source, domain)
        if website:
            try:
                home = await _fetch_page(client, website, website)
            except (CompanyDiscoveryError, httpx.HTTPError, ValueError):
                home = None
    if not home or canonical_domain(home.url) != domain:
        reason = ("fetch_rejected_or_unavailable" if primary_fetch_error
                  else "robots_blocked_or_unavailable")
        return _finding(candidate, "needs_human", [reason])
    pages.append(home)
    if deep_recovery:
        # Prefer up to six direct links, reserving slots for legal/contact
        # links discovered one level deeper. Never cross the owning domain.
        pending = _identity_links(home, RECOVERY_MAX_PAGES - 4)
        seen = {home.url}
        while pending and len(pages) < RECOVERY_MAX_PAGES:
            link = pending.pop(0)
            if link in seen:
                continue
            seen.add(link)
            try:
                page = await _fetch_page(client, link, home.url)
                if not page or canonical_domain(page.url) != domain:
                    continue
                pages.append(page)
                for nested in _identity_links(page, RECOVERY_MAX_PAGES):
                    if (nested not in seen and nested not in pending
                            and len(pending) < RECOVERY_MAX_PAGES * 3):
                        pending.append(nested)
            except (CompanyDiscoveryError, httpx.HTTPError, ValueError):
                pass
    else:
        for link in _identity_links(home, MAX_PAGES - 1):
            try:
                page = await _fetch_page(client, link, home.url)
                if page and canonical_domain(page.url) == domain:
                    pages.append(page)
            except (CompanyDiscoveryError, httpx.HTTPError, ValueError):
                pass

    # Title/H1/og:site_name may repeat an unverified brand, even when the
    # actual company identity on the page is different. Require the full
    # corporate name in first-party BODY text, not merely page metadata.
    texts = [str(p.text) for p in pages]
    name = str(candidate.get("company_name") or "")
    # Do not report identity_supported for a name that AUTO3 will reject.
    # The full company identity still must appear on its own official pages.
    matched = _name_evidenced(name, texts) and publisher_legal_name_is_clean(name)
    correction = None
    # A crawler guess can literally occur in the official footer but include
    # copyright years, cookie notices or nearby marketing prose. A positive
    # substring match alone must not suppress v4's clean-name extraction:
    # AUTO3 will correctly reject these contaminated names, starving growth.
    # Reconsider only a shorter, domain-related first-party company name when
    # the old name ENDS with that exact legal name (never an unrelated alias).
    structured = [node for p in pages for node in getattr(p, "structured_data", ())][:20]
    found = find_company_identity(texts, domain, name, structured)
    # A legal suffix appearing as a substring of a flattened CTA is NOT
    # independent proof. Require company/legal context (e.g. P.IVA) within
    # the bounded first-party extract, or corroborated Organization.legalName.
    # A repeated flattened CTA isn't proof even if the stripped substring
    # appears several times. Accept independent evidence only when the full
    # legal name has company-identifying metadata on the same page, OR when
    # the company's own structured Organization.legalName corroborates it.
    def _has_legal_context(full_name: str) -> bool:
        full = re.escape(_normalize_full_legal_name(full_name))
        cues = re.compile(
            r"(?i)(?:p\.?\s*iva|partita\s+iva|ragione\s+sociale|"
            r"codice\s+fiscale|sede\s+legale|capitale\s+sociale)"
        )
        for page in texts:
            norm = _normalize_full_legal_name(page)
            for match in re.finditer(full, norm):
                if cues.search(norm[max(0, match.start() - 120):
                                    min(len(norm), match.end() + 120)]):
                    return True
        return False

    def _structured_corrob(full_name: str) -> bool:
        for node in structured:
            if not isinstance(node, dict):
                continue
            types = node.get("@type", [])
            types = [types] if isinstance(types, str) else types
            if not isinstance(types, list) or not any(
                str(t).casefold() in ("organization", "corporation", "localbusiness")
                for t in types
            ):
                continue
            raw = node.get("legalName")
            if not isinstance(raw, str) or (
                _normalize_full_legal_name(raw) !=
                    _normalize_full_legal_name(full_name)
            ):
                continue
            url = node.get("url")
            if url:
                if not isinstance(url, str):
                    continue
                try:
                    parsed = urlsplit(url)
                    if (parsed.scheme != "https" or not parsed.hostname
                            or parsed.hostname.casefold().removeprefix("www.") != domain):
                        continue
                except ValueError:
                    continue
            return True
        return False

    independently_evidenced = bool(
        found and (_has_legal_context(found.legal_name)
                   or _structured_corrob(found.legal_name))
    )
    if (found and publisher_legal_name_is_clean(found.legal_name)
            and _is_capital_company(found.legal_name)
            and _name_evidenced(found.legal_name, texts)
            # Legacy v4 still recovers known noisy footer forms. But a
            # flattened *new* UI label (MASS11G) must never turn a clean
            # substring on the same page into a verified legal identity
            # without independent legal context or first-party JSON-LD.
            and ((legal_name_is_clean(name) and not re.match(
                    r"(?i)^(?:whistleblowing|entra|da\\s+wikipedia)\\b",
                    name))
                 or independently_evidenced)
            and (not matched or not legal_name_is_clean(name)
                 or not _is_capital_company(name)
                 or not publisher_legal_name_is_clean(name)
                  or _has_contaminated_name_prefix(name, found.legal_name)
                 or _has_bad_name_case_or_spacing(name, found.legal_name))):
        page_url = next((p.url for p in pages
                         if _name_evidenced(found.legal_name, [str(p.text)])), pages[0].url)
        correction = {"p_candidate_id": str(candidate["id"]),
                      "p_legal_name": found.legal_name[:255],
                      "p_vat_id": found.vat_id, "p_page_url": page_url,
                      "p_reviewer_version": VERSION}
        name, matched = found.legal_name, True
    if not matched:
        reasons.append("corporate_name_not_evidenced")
        if not publisher_legal_name_is_clean(name):
            reasons.append("legal_name_contaminated")
            reasons.append("publisher_legal_name_quality_failed")
    if not _is_capital_company(name):
        reasons.append("legal_form_requires_human_review")
    if not matched or not _is_capital_company(name):
        reasons.append("no_company_name_on_site")
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
    # In recovery mode a second-level page may be the *only* place that
    # prints the legal entity. Save the exact proof URL rather than incorrectly
    # pointing the evidence back to the homepage.
    proof_url = (next((p.url for p in pages
                       if _name_evidenced(name, [str(p.text)])), pages[0].url)
                 if verdict == "identity_supported" else pages[0].url)
    finding = _finding(
        candidate,verdict,reasons,domain=domain,name_matched=matched,
        observed_name=name if matched else None,
        page_url=proof_url,page_hash=digest,
        confidence=0.94 if verdict == "identity_supported" else 0.4,
        rights="restricts_reuse" if restricted else "unknown",
    )
    if correction and verdict == "identity_supported":
        finding["_identity_correction"] = correction
    return finding


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


async def review_batch(candidates: list[dict], *, pause_seconds: float = 0.3,
                       deep_recovery: bool = False) -> list[dict]:
    if not 1 <= len(candidates) <= MAX_BATCH:
        raise ValueError("batch must contain 1 to 50 company records")
    found_ids = [str(c.get("id")) for c in candidates]
    if len(set(found_ids)) != len(found_ids):
        raise ValueError("duplicate candidate identifiers")
    # Bound concurrency to four DISTINCT company websites. Serialise visits
    # to the same domain and preserve the input order for evidence recording.
    semaphore = asyncio.Semaphore(4)
    host_locks = {
        str(c.get("domain") or "").strip().lower(): asyncio.Lock()
        for c in candidates
    }
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(10.0), follow_redirects=False
    ) as client:
        async def one(index: int, candidate: dict) -> dict:
            host = str(candidate.get("domain") or "").strip().lower()
            async with host_locks[host]:
                async with semaphore:
                    if index and pause_seconds:
                        await asyncio.sleep(pause_seconds)
                    try:
                        return await inspect_candidate(
                            client, candidate, deep_recovery=deep_recovery)
                    except (ValueError, CompanyDiscoveryError) as exc:
                        # One malformed official site's URL/body must not
                        # abort the *other* companies' first-party reviews.
                        # Do NOT persist any fabricated verdict for this site.
                        return {
                            "p_candidate_id": str(candidate.get("id")),
                            "_review_error": type(exc).__name__,
                        }
        return list(await asyncio.gather(
            *(one(i, candidate) for i, candidate in enumerate(candidates))
        ))


# PostgREST answers 400 (22023 invalid parameter) when a database contract
# refuses one finding; anything else (auth, server errors) still stops the run.
REJECTED_STATUSES = frozenset({400})


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
        # Before ordinary growth, drain the fixed 78-company Overture4
        # recovery campaign. The private RPC atomically claims <=12 candidates
        # so another reviewer cannot steal or double-process this same batch.
        recovery = await client.post(
            f"{url}/rest/v1/rpc/net_it_auto2_recovery_queue",
            headers=headers, json={"p_max":min(limit, RECOVERY_MAX_BATCH)})
        if recovery.status_code == 404:
            # Railway may deploy a few moments before its SQL migration.
            recovering, candidates = False, []
        else:
            recovery.raise_for_status()
            recovery_payload = recovery.json()
            if recovery_payload.get("contract") != "net-it-auto2-recovery-queue-v1":
                raise RuntimeError("unexpected recovery queue contract")
            candidates = recovery_payload.get("items", [])
            recovering = bool(candidates)
        # MASS11C: a one-time source-bound recovery pass. The RPC claims only
        # the named cohort and is optional during a rolling SQL migration.
        # Never claim special recovery rows on a dry run.
        mass11c_recovering = False
        if not recovering and persist:
            response_c = await client.post(
                f"{url}/rest/v1/rpc/net_it_mass11c_recovery_queue",
                headers=headers, json={"p_max": min(limit, RECOVERY_MAX_BATCH)})
            if response_c.status_code != 404:
                response_c.raise_for_status()
                payload_c = response_c.json()
                if payload_c.get("contract") != "net-it-mass11c-recovery-queue-v1":
                    raise RuntimeError("unexpected MASS11C recovery contract")
                candidates = payload_c.get("items", [])
                mass11c_recovering = bool(candidates)
                recovering = mass11c_recovering
        if not recovering:
            response = await client.post(f"{url}/rest/v1/rpc/net_it_auto2_queue",
                                         headers=headers,json={"p_max":limit})
            response.raise_for_status()
            payload = response.json()
            if payload.get("contract") != "net-it-auto2-queue-v1":
                raise RuntimeError("unexpected queue contract")
            candidates = payload.get("items", [])
        if not candidates:
            return {"mode":"evidence_recording" if persist else "dry_run",
                    "queue_kind":"standard", "reviewed":0,"recorded":0,
                    "published":0,"exceptions":0}

        findings = await review_batch(candidates, deep_recovery=recovering)
        # No evidence is written for a failed individual site; all successful
        # verifications from the same bounded batch continue to persistence.
        failures = [f for f in findings if "_review_error" in f]
        for failure in failures:
            print(json.dumps({
                "status": "candidate_review_error",
                "candidate_id": failure["p_candidate_id"],
                "error_type": failure["_review_error"],
            }))
        findings = [f for f in findings if "_review_error" not in f]
        written = 0
        rejected = 0
        recovery_restored = 0
        mass11c_recovered = 0
        mass11c_finalized = 0

        async def _finalize_mass11c(candidate_id: str) -> None:
            nonlocal mass11c_recovered, mass11c_finalized
            if not mass11c_recovering:
                return
            done = await client.post(
                f"{url}/rest/v1/rpc/net_it_mass11c_recovery_finalize",
                headers=headers, json={"p_candidate_id": candidate_id})
            done.raise_for_status()
            outcome = done.json()
            if (outcome.get("contract") != "net-it-mass11c-recovery-finalize-v1"
                    or outcome.get("published") != 0
                    or outcome.get("recovered") not in (0, 1)):
                raise RuntimeError("unexpected MASS11C evidence-only finalize")
            mass11c_finalized += 1
            mass11c_recovered += int(outcome["recovered"])

        if persist:
            for finding in findings:
                correction = finding.pop("_identity_correction", None)
                if correction:
                    c = await client.post(
                        f"{url}/rest/v1/rpc/net_it_auto2_correct_identity",
                        headers=headers, json=correction)
                    if c.status_code in REJECTED_STATUSES:
                        # The database refused the corrected name: never record
                        # this candidate as supported under its old name.
                        finding["p_verdict"] = "needs_human"
                        finding["p_reasons"] = sorted(
                            set(finding["p_reasons"]) | {"corporate_name_not_evidenced"})
                        finding["p_confidence"] = 0.4
                    else:
                        c.raise_for_status()
                        if c.json().get("contract") != "net-it-auto2-identity-v1":
                            raise RuntimeError("unexpected identity correction response")
                r = await client.post(f"{url}/rest/v1/rpc/net_it_auto2_record",
                                      headers=headers,json=finding)
                if r.status_code in REJECTED_STATUSES:
                    # Preserve the rejected observation as a private exception,
                    # not as supported identity. This prevents a deterministic
                    # invalid evidence payload from starving the entire queue.
                    # No URL, hash, observed name or rights assertion is carried
                    # into the fallback; the DB still enforces candidate scope.
                    fallback = dict(finding)
                    fallback.update(
                        p_verdict="needs_human",
                        p_reasons=sorted(set(finding["p_reasons"]) |
                                         {"evidence_contract_rejected"}),
                        p_observed_domain=None,
                        p_matched_name=False,
                        p_observed_name=None,
                        p_page_url=None,
                        p_hash=None,
                        p_confidence=0.0,
                        p_terms_url=None,
                        p_rights_state="unknown",
                    )
                    retry = await client.post(
                        f"{url}/rest/v1/rpc/net_it_auto2_record",
                        headers=headers, json=fallback)
                    if retry.status_code in REJECTED_STATUSES:
                        rejected += 1
                        await _finalize_mass11c(finding["p_candidate_id"])
                        continue
                    retry.raise_for_status()
                    result = retry.json()
                    if (result.get("contract") != "net-it-auto2-review-v1"
                            or result.get("publication_count") != 0
                            or result.get("verdict") != "needs_human"):
                        raise RuntimeError("unexpected exception evidence response")
                    written += 1
                    await _finalize_mass11c(finding["p_candidate_id"])
                    continue
                r.raise_for_status()
                result = r.json()
                if result.get("contract") != "net-it-auto2-review-v1" or result.get("publication_count") != 0:
                    raise RuntimeError("unexpected evidence-only response")
                written += 1
                await _finalize_mass11c(finding["p_candidate_id"])
                if recovering and not mass11c_recovering and result.get("verdict") == "identity_supported":
                    # A fresh, first-party corporate proof can lift ONLY the
                    # 'no_company_on_site' AUTO4 discard, after database
                    # checks. This RPC never publishes or creates approvals.
                    restore = await client.post(
                        f"{url}/rest/v1/rpc/net_it_auto2_recovery_restore",
                        headers=headers,
                        json={"p_candidate_id":finding["p_candidate_id"]})
                    if restore.status_code in REJECTED_STATUSES:
                        continue
                    restore.raise_for_status()
                    restored = restore.json()
                    if (restored.get("contract") != "net-it-auto2-recovery-restore-v1"
                            or restored.get("published") != 0):
                        raise RuntimeError("unexpected recovery restore response")
                    recovery_restored += int(restored.get("restored", 0))
            # GROWTH10: do NOT create a fabricated needs_human evidence row for
            # a parse failure. Store ONLY a bounded attempt/backoff ledger.
            # This is a best-effort performance hint, not an identity verdict:
            # an unavailable RPC during a rolling migration must never block
            # the successful evidence already persisted above.
            for failure in failures:
                try:
                    error_response = await client.post(
                        f"{url}/rest/v1/rpc/net_it_auto2_record_site_error",
                        headers=headers, json={
                            "p_candidate_id": failure["p_candidate_id"],
                            "p_error_type": failure["_review_error"],
                        })
                    if error_response.status_code == 404:
                        print(json.dumps({"status": "error_backoff_not_installed"}))
                        continue
                    error_response.raise_for_status()
                    error_payload = error_response.json()
                    if (error_payload.get("contract") != "net-it-auto2-site-error-v1"
                            or error_payload.get("publication_count") != 0):
                        raise ValueError("Unexpected site-error backoff contract")
                except (httpx.HTTPError, ValueError):
                    print(json.dumps({"status": "site_error_backoff_unavailable"}))
                # A failed inspection is a bounded attempt, never evidence.
                await _finalize_mass11c(failure["p_candidate_id"])
        return {
            "mode":"evidence_recording" if persist else "dry_run",
            "queue_kind":("mass11c_firstparty_recovery" if mass11c_recovering
                          else "overture4_recovery" if recovering else "standard"),
            "recovery_restored":recovery_restored,
            "mass11c_recovered":mass11c_recovered,
            "mass11c_finalized":mass11c_finalized,
            "reviewed":len(findings),"attempted":len(candidates),
            "site_errors":len(failures),
            "recorded":written,"rejected":rejected,
            "identity_supported":sum(f["p_verdict"]=="identity_supported" for f in findings),
            "exceptions":sum(f["p_verdict"]!="identity_supported" for f in findings),
            "published":0,
            "candidate_ids":[f["p_candidate_id"] for f in findings],
        }


async def execute_lots(*, limit: int = 50, lots: int = 4,
                       persist: bool = False, max_seconds: float = 420) -> dict:
    """Drain up to four sequential 50-site lots, with only four active hosts.

    A failed batch never spins, and the next cron can continue automatically.
    No approval or publication is performed here; each lot reuses execute()
    and the existing first-party security / evidence contracts.
    """
    if limit not in range(1, MAX_BATCH + 1) or lots not in range(1, 5):
        raise ValueError("limit must be 1..50 and lots 1..4")
    if max_seconds < 30:
        raise ValueError("max_seconds must be at least 30")
    start = time.monotonic()
    # Dry run does not record evidence/cooldowns: repeating would re-read the
    # same candidates, so a dry run ALWAYS examines a single bounded lot.
    effective_lots = lots if persist else 1
    summaries = []
    summed = {key: 0 for key in ("attempted", "reviewed", "recorded",
                                  "rejected", "site_errors",
                                  "identity_supported", "exceptions",
                                  "recovery_restored", "mass11c_recovered",
                                  "mass11c_finalized", "published")}
    for lot in range(effective_lots):
        if lot and time.monotonic() - start >= max_seconds:
            break
        result = await execute(limit=limit, persist=persist)
        summaries.append({"lot": lot + 1,
                          "queue_kind": result.get("queue_kind", "standard"),
                          "attempted": result.get("attempted", 0),
                          "recorded": result.get("recorded", 0),
                          "site_errors": result.get("site_errors", 0)})
        for field in summed:
            summed[field] += int(result.get(field, 0))
        # Stop on empty queue or zero progress, never retry a malformed site
        # repeatedly inside the same cron invocation.
        if not result.get("attempted") or not result.get("recorded"):
            break
    return {
        "mode": "evidence_recording" if persist else "dry_run",
        "contract": "net-it-auto2-bulk-lots-v1",
        "max_batch_size": limit,
        "configured_capacity": limit * effective_lots,
        "lots_processed": len(summaries),
        "lots": summaries,
        **summed,
    }


def main() -> int:
    parser=argparse.ArgumentParser(description="NET-IT-AUTO2 official-site reviewer")
    parser.add_argument("--limit",type=int,default=25,
                        help="First-party websites per lot, maximum 50")
    parser.add_argument("--lots",type=int,default=4,
                        help="Maximum sequential lots per cron (up to 4)")
    parser.add_argument("--persist",action="store_true",
                        help="Record private agent evidence; never publish profiles")
    args=parser.parse_args()
    try:
        result=asyncio.run(execute_lots(limit=args.limit,lots=args.lots,persist=args.persist))
    except (ValueError,RuntimeError,httpx.HTTPError) as exc:
        print(json.dumps({"status":"review_failed","error_type":type(exc).__name__}))
        return 1
    print(json.dumps(result,ensure_ascii=False,sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
