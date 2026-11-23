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
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx

from .company_discovery import (
    CompanyDiscoveryError, _fetch_page, _redact_personal_channels,
    canonical_domain,
)

CONTRACT = "netprofile-prod1b"
VERSION = "netprofile-prod1b-v1"
MAX_BATCH = 10
MAX_SOURCE_PAGES = 5   # homepage + four bounded first-party technical sections
MAX_DISCOVERED_LINKS = 14
PRODUCT_PATTERNS = (
    ("Tubi e condotte", re.compile(r"\b(?:tubi|tubo|tubes?|pipes?|condotte)\b", re.I)),
    # Steel-specific labels require steel *inside the same product phrase*.
    # "profili in alluminio" and "barre in ottone" are not steel products.
    ("Profilati in acciaio", re.compile(
        r"\b(?:profilati|profili)(?:\s+(?:speciali|aperti|chiusi|tubolari)){0,2}"
        r"\s+(?:in|di)\s+acciaio\b|"
        r"\b(?:steel|stainless\s+steel)\s+(?:hollow\s+)?(?:profiles?|sections?)\b",
        re.I
    )),
    ("Lamiere", re.compile(r"\b(?:lamiere|lamiera|sheet metal|steel sheets?|plates?)\b", re.I)),
    ("Barre in acciaio", re.compile(
        r"\bbarre(?:\s+(?:tonde|trafilate|laminate|rettificate)){0,2}"
        r"\s+(?:in|di)\s+acciaio\b|"
        r"\b(?:steel\s+bars?|round\s+steel\s+bars?|bars?\s+(?:of|in)\s+steel)\b",
        re.I
    )),
    ("Coils e nastri", re.compile(r"\b(?:coils?|nastri|steel strips?)\b", re.I)),
    ("Carpenteria metallica", re.compile(r"\b(?:carpenteria metallica|strutture metalliche|steel structures?)\b", re.I)),
    ("Reti elettrosaldate", re.compile(r"\b(?:reti elettrosaldate|welded wire mesh)\b", re.I)),
    ("Viti e bulloneria", re.compile(r"\b(?:bulloni|viti|fasteners?|bolts?)\b", re.I)),
    ("Stampi e portastampi", re.compile(r"\b(?:portastampi|stampi|mould bases?|molds?)\b", re.I)),
)
# Business activities are distinct from manufactured products. A process
# is accepted only with explicit first-party execution/capability wording.
PROCESS_PATTERNS = (
    ("Taglio laser", re.compile(r"\b(?:taglio\s+laser|laser\s+cutting)\b", re.I)),
    ("Taglio plasma", re.compile(r"\b(?:taglio\s+plasma|plasma\s+cutting)\b", re.I)),
    ("Saldatura", re.compile(r"\b(?:saldatur[ae]|welding)\b", re.I)),
    ("Piegatura", re.compile(r"\b(?:piegatur[ae]|bending)\b", re.I)),
    ("Calandratura", re.compile(r"\b(?:calandrat(?:ura|ure)|plate\s+rolling)\b", re.I)),
    ("Tornitura", re.compile(r"\b(?:tornitur[ae]|turning\s+operations?)\b", re.I)),
    ("Fresatura", re.compile(r"\b(?:fresatur[ae]|milling\s+operations?)\b", re.I)),
    ("Lavorazioni meccaniche", re.compile(
        r"\b(?:lavorazioni\s+meccaniche|mechanical\s+machining)\b", re.I
    )),
    ("Carpenteria metallica", re.compile(
        r"\b(?:carpenteria\s+metallica|metal\s+fabrication)\b", re.I
    )),
)
PROCESS_VERBS = re.compile(
    r"\b(?:eseguiamo|effettuiamo|svolgiamo|offriamo\s+(?:servizi\s+di|lavorazioni\s+di)|"
    r"ci\s+occupiamo\s+di|(?:siamo\s+)?specializzat[ioe]\s+(?:in|nella|nelle)|"
    r"we\s+(?:perform|carry\s+out|speciali[sz]e\s+in)|"
    r"our\s+company\s+(?:performs|carries\s+out))\b", re.I
)
SECTION_PATH = re.compile(
    r"(?:^|/)(?:prodott[oi]|produzion[ei]|lavorazion[ei]|"
    r"product(?:s|ion)?|manufactur(?:e|ing)|processing|"
    r"workings?|fabrication|tub[ioe]|profilat[io]|lamiere)"
    r"(?:[-_/]|$)", re.I
)
SECTION_EXCLUDE = re.compile(
    r"(?:^|/)(?:privacy|cookies?|legal|certificazion[ie]|"
    r"qualit[aà]|quality|sistema-qualita|contatt[io]|contacts?|"
    r"chi-siamo|about|news|blog|press|jobs|career|login|"
    r"download|policy|sustainability)(?:[-_/]|$)", re.I
)
NON_HTML_PATH = re.compile(
    r"\.(?:pdf|zip|docx?|xlsx?|csv|xml|jpe?g|png|gif|svg|webp)$", re.I
)


PRODUCES = re.compile(
    r"\b(?:produciamo|fabbrichiamo|realizziamo|produce|"
    r"produzione\s+di|fabbricazione\s+di|"
    r"we\s+manufacture|we\s+produce|production\s+of)\b", re.I,
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


def _validated_excerpt(segment: str, verb: re.Match[str]) -> str | None:
    excerpt = " ".join(
        segment[max(0, verb.start() - 16):verb.end() + 155].split()
    )
    excerpt = _redact_personal_channels(excerpt).strip()
    if not 24 <= len(excerpt) <= 300 or "@" in excerpt or "http" in excerpt.lower():
        return None
    return excerpt


def _production_from_segment(segment: str) -> dict | None:
    if MARKETING_NOISE.search(segment[:250]):
        return None
    for verb in PRODUCES.finditer(segment):
        prefix = segment[max(0, verb.start() - 75):verb.start()]
        if NEGATIVE.search(prefix):
            continue
        if verb.group().lower() == "produce" and (
            not re.search(r"\b(?:azienda|impresa|societ[aà])\b", prefix, re.I)
            or re.search(r"\b(?:fornitori|partner|clienti|terzi)\b", prefix, re.I)
        ):
            continue
        object_text = segment[verb.end():verb.end() + 78]
        if NEGATIVE.search(object_text[:50]):
            continue
        if SALE_ONLY.search(object_text[:35]) and not re.search(
            r"\b(?:e|and)\s+commercializziamo\b", object_text[:35], re.I
        ):
            continue
        excerpt = _validated_excerpt(segment, verb)
        if not excerpt:
            continue
        labels = []
        for label, pattern in PRODUCT_PATTERNS:
            hit = pattern.search(object_text)
            if hit and hit.start() <= 65:
                labels.append(label)
        if labels:
            return {
                "field_key": "products",
                "field_value": labels[:5],
                "evidence_excerpt": excerpt,
            }
    return None


def _process_from_segment(segment: str) -> dict | None:
    if MARKETING_NOISE.search(segment[:250]):
        return None
    for verb in PROCESS_VERBS.finditer(segment):
        prefix = segment[max(0, verb.start() - 75):verb.start()]
        object_text = segment[verb.end():verb.end() + 95]
        if NEGATIVE.search(prefix) or NEGATIVE.search(object_text[:45]):
            continue
        if re.search(r"\b(?:fornitori|partner|clienti|terzi)\b", prefix, re.I):
            continue
        excerpt = _validated_excerpt(segment, verb)
        if not excerpt:
            continue
        labels = []
        for label, pattern in PROCESS_PATTERNS:
            hit = pattern.search(object_text)
            if hit and hit.start() <= 75:
                labels.append(label)
        if labels:
            return {
                "field_key": "services",
                "field_value": labels[:5],
                "evidence_excerpt": excerpt,
            }
    return None


def source_backed_facts(page) -> list[dict]:
    """Independent same-page quotes for products and performed workings.

    An HTML heading or menu term by itself is NEVER proof of manufacturing.
    Every approved family gets its own short on-page verb-object excerpt.
    """
    product = process = None
    for segment in _page_segments(page):
        if product is None:
            product = _production_from_segment(segment)
        if process is None:
            process = _process_from_segment(segment)
        if product and process:
            break
    if not product and not process:
        return []
    base = product or process
    labels = base["field_value"]
    topic = "produzione" if product else "lavorazioni"
    description = {
        "field_key": "description",
        "field_value": (
            f"Il sito ufficiale documenta {topic} di " +
            ", ".join(label.lower() for label in labels) + "."
        )[:240],
        "evidence_excerpt": base["evidence_excerpt"],
    }
    return ([product] if product else []) + [description] + (
        [process] if process else []
    )


def _official_section_links(page, canonical: str) -> list[str]:
    """Bounded same-company discovery; reject offsite, auth, media, tracking."""
    ranked: dict[str, tuple[int, int]] = {}
    for index, href in enumerate((getattr(page, "links", ()) or ())[:500]):
        if not isinstance(href, str) or not href or len(href) > 900:
            continue
        if href.startswith(("#", "mailto:", "tel:", "javascript:", "data:")):
            continue
        try:
            raw = urlsplit(urljoin(page.url, href))
            if raw.query or raw.fragment or raw.path in ("", "/"):
                continue
            path = raw.path
            if len(path) > 500 or NON_HTML_PATH.search(path) or (
                SECTION_EXCLUDE.search(path) or not SECTION_PATH.search(path)
            ):
                continue
            candidate = urlunsplit(("https", raw.netloc, path, "", ""))
            if not safe_official_source(candidate, canonical):
                continue
            # A company may publish nested /produzione/tubi and /lavorazioni.
            score = 0 if re.search(r"(?:^|/)(?:produzione|prodotti|lavorazioni|"
                                    r"production|products|manufacturing)/", path, re.I) else 1
            old = ranked.get(candidate)
            if old is None or (score, index) < old:
                ranked[candidate] = (score, index)
        except (ValueError, UnicodeError, TypeError):
            continue
    return [
        url for url, _ in sorted(ranked.items(), key=lambda x: (x[1][0], x[1][1]))
    ][:MAX_DISCOVERED_LINKS]


def _queued_sources(item: dict, site: str, canonical: str) -> list[str]:
    """Prioritize processed first-party pages, never arbitrary supplied URLs."""
    supplied = item.get("product_urls")
    urls = supplied if isinstance(supplied, list) else []
    if not urls and isinstance(item.get("product_url"), str):
        urls = [item["product_url"]]
    found = []
    for url in urls[:8]:
        if not isinstance(url, str) or not safe_official_source(url, canonical):
            continue
        parts = urlsplit(url)
        if parts.query or parts.fragment or NON_HTML_PATH.search(parts.path):
            continue
        if SECTION_EXCLUDE.search(parts.path):
            continue
        if url not in found and url != site:
            found.append(url)
    return found[:MAX_DISCOVERED_LINKS]


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
            checked = 0
            status = "no_evidence"
            reason = "no_explicit_manufacture_or_working_relation"
            source_url = None
            source_sha256 = None
            facts: list[dict] = []

            if (not safe_official_source(site, canonical) or
                    not identity_matches_domain(label, alias, canonical)):
                status = "blocked"
                reason = "canonical_identity_or_domain_mismatch"
            else:
                # Read the homepage ONCE for menus and as a fallback, but favor
                # dedicated technical sections over a generic marketing intro.
                homepage = None
                try:
                    homepage = await _fetch_page(client, site, site)
                except (httpx.HTTPError, CompanyDiscoveryError):
                    pass
                if homepage and not safe_official_source(homepage.url, canonical):
                    homepage = None
                if homepage:
                    checked += 1
                urls = _queued_sources(item, site, canonical)
                if homepage:
                    for discovered in _official_section_links(homepage, canonical):
                        if discovered not in urls and discovered != homepage.url:
                            urls.append(discovered)
                visited = {homepage.url} if homepage else set()
                # Do not let a large navigation menu exhaust the visit budget.
                for url in urls[:MAX_DISCOVERED_LINKS]:
                    if checked >= MAX_SOURCE_PAGES:
                        break
                    if url in visited or not safe_official_source(url, canonical):
                        continue
                    visited.add(url)
                    try:
                        page = await _fetch_page(client, url, site)
                    except (httpx.HTTPError, CompanyDiscoveryError):
                        continue
                    if not page or not safe_official_source(page.url, canonical):
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
                        reason = "explicit_firstparty_manufacturing_or_working_relation"
                        break
                    if len(urls) < MAX_DISCOVERED_LINKS:
                        # At most one extra depth from technical section pages,
                        # still inside the SAME canonical, bounded page budget.
                        for discovered in _official_section_links(page, canonical):
                            if discovered not in visited and discovered not in urls:
                                urls.append(discovered)
                            if len(urls) >= MAX_DISCOVERED_LINKS:
                                break
                # Homepage relation is still valid but lower priority than
                # dedicated product/manufacturing/workings statements.
                if not facts and homepage:
                    source_url = homepage.url
                    facts = source_backed_facts(homepage)
                    if facts:
                        source_sha256 = hashlib.sha256(
                            ((homepage.title or "") + "\n" +
                             (homepage.meta_description or "") + "\n" +
                             homepage.text).encode("utf-8")
                        ).hexdigest()
                        status = "verified"
                        reason = "explicit_firstparty_home_manufacturing_or_working_relation"
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
