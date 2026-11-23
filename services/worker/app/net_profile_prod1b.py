"""NET-PROFILE-PROD1.B: bounded, first-party verified manufacturer statements.

Only exact, explicit "we produce X" relations may become source-backed
public profile summaries. Merely selling X, making machines for X, matching an
ATECO, or mentioning a norm is not manufacturing evidence.

Uses the existing safe robots/SSRF-aware website crawler and its canonical
producer identities. Runs inside the EXISTING Railway producer cron when the
migration and opt-in flag have been deployed. No new scheduler.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import re
import unicodedata
from urllib.parse import urlsplit

import httpx

from .company_discovery import (
    CompanyDiscoveryError, _fetch_page, _redact_personal_channels,
    canonical_domain,
)

CONTRACT = "netprofile-prod1b"
VERSION = "netprofile-prod1b-v1"
MAX_BATCH = 10
PRODUCT_PATTERNS = (
    ("Tubi e condotte", re.compile(r"\b(?:tubi|tubo|tubes?|pipes?|condotte)\b", re.I)),
    ("Profilati in acciaio", re.compile(r"\b(?:profilati|profilo|profiles?|hollow sections?)\b", re.I)),
    ("Lamiere", re.compile(r"\b(?:lamiere|lamiera|sheet metal|steel sheets?|plates?)\b", re.I)),
    ("Barre in acciaio", re.compile(r"\b(?:barre|barretonde|steel bars?|round bars?)\b", re.I)),
    ("Coils e nastri", re.compile(r"\b(?:coils?|nastri|steel strips?)\b", re.I)),
    ("Carpenteria metallica", re.compile(r"\b(?:carpenteria metallica|strutture metalliche|steel structures?)\b", re.I)),
    ("Reti elettrosaldate", re.compile(r"\b(?:reti elettrosaldate|welded wire mesh)\b", re.I)),
    ("Viti e bulloneria", re.compile(r"\b(?:bulloni|viti|fasteners?|bolts?)\b", re.I)),
    ("Stampi e portastampi", re.compile(r"\b(?:portastampi|stampi|mould bases?|molds?)\b", re.I)),
)
PRODUCES = re.compile(
    r"\b(?:produciamo|producono|produce|fabbrichiamo|fabbricano|fabbrica|"
    r"realizziamo|realizza|produzione\s+di|fabbricazione\s+di|"
    r"we\s+manufacture|manufactures?|we\s+produce|production\s+of)\b", re.I,
)
# Restrict automatic acceptance to a positive, short verb-object relationship.
# Negative context is deliberately broad: false negatives are safer than
# attributing a tube product to a supplier of tube-making equipment.
NEGATIVE = re.compile(
    r"\b(?:macchin[ea]|macchinari|impiant[io]|attrezzatur[ea]|"
    r"linee|sistemi|machines?|equipment|plants?|machinery)\b", re.I,
)
SALE_ONLY = re.compile(
    r"\b(?:commercializziamo|commercializza|rivendiamo|distribuiamo|"
    r"distribuzione|ingrosso|vendita|sells?|supplies?|resell)\b", re.I,
)
MARKETING_NOISE = re.compile(
    r"(?:cookie|privacy|consent|lavora\s+con\s+noi|tutti\s+i\s+diritti|"
    r"all\s+rights\s+reserved|subscribe|iscrivit[ie]|offerta\s+di\s+lavoro)", re.I,
)
NAME_SKIP = {
    "srl", "spa", "snc", "sas", "sapa", "societa", "society", "company",
    "limited", "gmbh", "siderurgica", "industria", "group", "the", "and",
    "ing", "manager", "quality", "certificato", "iso",
}


def normalize_words(value: str) -> list[str]:
    plain = unicodedata.normalize("NFKD", value.lower())
    plain = "".join(c for c in plain if not unicodedata.combining(c))
    return re.findall(r"[a-z0-9]+", plain)


def identity_matches_domain(legal_name: str, trading_name: str | None, domain: str) -> bool:
    """Reject obviously cross-linked company/domain records before publishing."""
    domain_tokens = re.findall(r"[a-z0-9]+", domain.lower().removeprefix("www.").split(".")[0])
    stem = "".join(domain_tokens)
    if len(stem) < 4:
        return False
    names = (legal_name or "") + " " + (trading_name or "")
    tokens = [t for t in normalize_words(names) if len(t) >= 4 and t not in NAME_SKIP]
    return any(t in stem or (len(stem) >= 6 and stem in t) for t in tokens)


def safe_official_source(url: str, canonical: str) -> bool:
    try:
        parsed = urlsplit(url)
        host = (parsed.hostname or "").lower()
        return (
            parsed.scheme == "https" and not parsed.username and not parsed.password
            and parsed.port in (None, 443) and canonical_domain(url) == canonical.lower()
            and host in (canonical.lower(), "www." + canonical.lower())
            and len(url) <= 1200
        )
    except (TypeError, ValueError):
        return False


def _page_segments(page) -> list[str]:
    # Metadata is corporate-first-party material too; it is not an AI claim.
    fields = [page.meta_description or "", page.h1 or "", page.text or ""]
    pieces: list[str] = []
    for field in fields:
        value = " ".join(field.split())[:24000]
        if not value:
            continue
        pieces.extend(re.split(r"(?<=[.!?;])\s+", value))
    return pieces[:300]


def source_backed_facts(page) -> list[dict]:
    """Deterministic fact generation with an exact short on-page excerpt."""
    for segment in _page_segments(page):
        if MARKETING_NOISE.search(segment[:250]):
            continue
        for verb in PRODUCES.finditer(segment):
            # No production claim from "machines for production of tubes".
            prefix = segment[max(0, verb.start() - 75):verb.start()]
            if NEGATIVE.search(prefix):
                continue
            object_text = segment[verb.end():verb.end() + 78]
            # A machinery producer must not be mistaken for a tube producer.
            if NEGATIVE.search(object_text[:50]):
                continue
            # Seller-only copy is not proof, but "produciamo e
            # commercializziamo tubi" is supported by the positive verb.
            # Do not accept an isolated distribution/retail phrase.
            if SALE_ONLY.search(object_text[:35]) and not re.search(
                r"\b(?:e|and)\s+commercializziamo\b", object_text[:35], re.I
            ):
                continue
            excerpt = " ".join(segment[max(0, verb.start() - 12):verb.end() + 145].split())
            excerpt = _redact_personal_channels(excerpt).strip()
            if not 24 <= len(excerpt) <= 300 or "@" in excerpt or "http" in excerpt.lower():
                continue
            labels = []
            for label, pattern in PRODUCT_PATTERNS:
                hit = pattern.search(object_text)
                if hit and hit.start() <= 65:
                    labels.append(label)
            if not labels:
                continue
            # All labels MUST appear in this exact one source excerpt.
            # Combining phrases from separate paragraphs under one citation
            # would make some company product assertions unverifiable.
            products = {
                "field_key": "products",
                "field_value": labels[:5],
                "evidence_excerpt": excerpt,
            }
            description_text = "Il sito ufficiale documenta la produzione di " + ", ".join(
                label.lower() for label in labels[:5]
            ) + "."
            return [products, {
                "field_key": "description",
                "field_value": description_text[:240],
                "evidence_excerpt": excerpt,
            }]
    return []


def _rpc(db, action: str, payload: dict, contract: str) -> dict:
    response = db.rpc(action, payload).execute()
    data = response.data
    if not isinstance(data, dict) or data.get("contract") != contract:
        raise ValueError("Unexpected producer activity RPC contract: " + action)
    return data


async def run_cycle(db, *, persist: bool = False, limit: int = 5) -> dict:
    if not 1 <= limit <= MAX_BATCH:
        raise ValueError("Producer enrichment batch must be 1–10")
    if not persist:
        return {
            "mode": "dry_run", "source_sites_fetched": 0,
            "accepted_facts": 0, "published_profiles": 0,
        }
    seed = _rpc(db, "netprofile_prod1b_seed", {"p_limit": 250},
                "netprofile-prod1b-seed-v1")
    lease = _rpc(db, "netprofile_prod1b_claim", {"p_limit": limit},
                 "netprofile-prod1b-claim-v1")
    rows = lease.get("items")
    if not isinstance(rows, list) or len(rows) > limit:
        raise ValueError("Invalid producer activity lease")
    outcomes: list[dict] = []
    async with httpx.AsyncClient(timeout=httpx.Timeout(12.0),
                                 follow_redirects=False, trust_env=False) as client:
        for index, item in enumerate(rows):
            if index:
                await asyncio.sleep(2)
            canonical = str(item.get("canonical_domain") or "").lower()
            site = str(item.get("site_url") or "")
            company_id = str(item.get("company_id") or "")
            lease_token = str(item.get("lease_token") or "")
            label = str(item.get("legal_name") or "")
            alias = item.get("trading_name")
            urls = [str(item.get("product_url") or ""), site]
            checked = 0
            status = "no_evidence"
            reason = "no_explicit_manufacture_relation"
            source_url = None
            source_sha256 = None
            facts: list[dict] = []

            if (not safe_official_source(site, canonical) or
                    not identity_matches_domain(label, alias, canonical)):
                status = "blocked"
                reason = "canonical_identity_or_domain_mismatch"
            else:
                for url in dict.fromkeys(urls):
                    if not url or not safe_official_source(url, canonical):
                        continue
                    try:
                        page = await _fetch_page(client, url, site)
                    except (httpx.HTTPError, CompanyDiscoveryError):
                        page = None
                    if page is None or not safe_official_source(page.url, canonical):
                        continue
                    checked += 1
                    source_url = page.url
                    facts = source_backed_facts(page)
                    if facts:
                        source_sha256 = hashlib.sha256(
                            ((page.title or "") + "\n" +
                             (page.meta_description or "") + "\n" +
                             page.text).encode("utf-8")
                        ).hexdigest()
                        status = "verified"
                        reason = "explicit_firstparty_manufacturing_relation"
                        break
                if checked == 0:
                    status = "blocked"
                    reason = "robots_or_source_unavailable"

            result = _rpc(db, "netprofile_prod1b_complete", {
                "p_company_id": company_id, "p_lease_token": lease_token,
                "p_status": status, "p_source_url": source_url,
                "p_source_sha256": source_sha256,
                "p_facts": facts, "p_reason": reason,
            }, "netprofile-prod1b-complete-v1")
            outcomes.append({
                "company_id": company_id, "status": status,
                "source_pages_read": checked,
                "accepted_facts": result["accepted"],
            })
    return {
        "mode": "verified_firstparty_activity",
        "new_queue_entries": seed["added"],
        "processed": len(outcomes),
        "accepted_facts": sum(o["accepted_facts"] for o in outcomes),
        "published_profiles": sum(o["accepted_facts"] > 0 for o in outcomes),
        "outcomes": outcomes,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Bounded official manufacturer statements; Railway cron integration"
    )
    parser.add_argument("--limit", type=int, default=5)
    parser.add_argument("--persist", action="store_true",
                        help="Enable privileged lease and accepted source-backed facts")
    args = parser.parse_args()
    from supabase import create_client
    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    print(json.dumps(asyncio.run(run_cycle(db, persist=args.persist, limit=args.limit)),
                     ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
