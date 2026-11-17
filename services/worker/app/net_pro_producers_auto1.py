"""NET-PRO-PRODUCERS1.AUTO1.A — bounded first-party manufacturer evidence intake.

Only a service-role Railway worker can lease canonical producer sites. Scraping
does NOT publish technical assertions: evidence is stored privately as candidate
facts for separate per-attribute verification. A producer role does not certify
tube production. Never infer a product SKU from isolated norm/grade/range claims.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
from html.parser import HTMLParser
import ipaddress
import json
import os
import re
import socket
from urllib.parse import urljoin, urlsplit, urlunsplit
from urllib.robotparser import RobotFileParser

import httpx

from .net_pro_producers_auto1a4 import discover_detail_links, extract_exact_row_candidates
from .net_pro_producers_auto1a5 import diagnose_detail_html
from .net_pro_producers_auto1a53 import fingerprint_technical_rows
from .net_pro_producers_auto1a54 import (
    technical_sheet_hint, link_priority_bonus, classify_html_layout,
    LAYOUT_CATEGORIES,
)

USER_AGENT = "SmartSteelSalesTechnicalEvidenceBot/1.0"
MAX_BATCH = 25
MAX_HTML_BYTES = 512_000
MAX_TEXT_CHARS = 80_000
MAX_CANDIDATES = 25
MAX_PRODUCT_PAGES_PER_COMPANY = 8
MAX_PRODUCT_PAGES_PER_RUN = 5
MAX_DETAIL_PAGES_PER_RUN = 3
PRODUCT_LINK_PATTERNS = {
    "catalog": re.compile(
        r"(?:catalog(?:o|hi|ue|ues|os)?|katalog|brochure|download|technical[-_/ ]?documents?)", re.I
    ),
    "products": re.compile(
        r"(?:prodott[oi]|products?|produits?|productos?|produkte|"
        r"tub[io]|tubes?|pipes?|hollow[-_/ ]?section|structural|"
        r"profil[io]|sections?|gamma|range|lavorazion[ie])", re.I
    ),
    "standards": re.compile(
        r"(?:norm[ae]|standards?|specifications?|specifiche|certificazion[ie])", re.I
    ),
}
IGNORE_LINK_PATTERN = re.compile(
    r"(?:privacy|cookies?|consent|contact|contatt|about|chi[-_/ ]?siamo|"
    r"news|blog|career|jobs?|lavora[-_/ ]?con|login|registr|cart|checkout|"
    r"social|facebook|instagram|linkedin|event|press|cookie-policy)", re.I
)
NON_HTML_EXTENSION = re.compile(
    r"\.(?:pdf|zip|docx?|xlsx?|csv|xml|jpg|jpeg|png|gif|svg|webp)(?:$|[?#])", re.I
)


# These are RESEARCH CANDIDATES only, even for a company tagged "producer".
TOKEN_PATTERNS = (
    ("technical_standard", re.compile(r"(?<![\w])EN[\s\u00a0]+(?:10219|10210|10305)(?:[\-–][12-5])?(?![\d])", re.I)),
    ("steel_grade", re.compile(r"(?<![\w])S(?:235|275|355|420|460)(?:JR|J0|J2|M|ML|N|NL)?H(?![\w])", re.I)),
    ("manufacturing_process", re.compile(r"\b(?:tubi saldati|tubi senza saldatura|tubi elettrosaldati|welded steel tubes|seamless steel tubes)\b", re.I)),
)

class SafeHtmlText(HTMLParser):
    """Discard scripts, CSS and navigation. No HTML is saved to the database."""
    SKIP = {"script", "style", "noscript", "nav", "footer", "header"}
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self._skip = []
        self._pieces = []
        self._chars = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self._skip.append(tag)
        elif tag in {"p", "li", "article", "h1", "h2", "h3", "h4", "tr", "br"} and not self._skip:
            self._pieces.append("\n")

    def handle_endtag(self, tag):
        if self._skip and self._skip[-1] == tag:
            self._skip.pop()

    def handle_data(self, data):
        if self._skip or self._chars >= MAX_TEXT_CHARS:
            return
        data = data.strip()
        if not data:
            return
        data = data[:MAX_TEXT_CHARS-self._chars]
        self._chars += len(data)
        self._pieces.append(" " + data)

    def text(self):
        return " ".join(" ".join(self._pieces).split())[:MAX_TEXT_CHARS]


class ProductLinkParser(HTMLParser):
    """Collect only href+short anchor text, including site navigation labels."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links: list[tuple[str, str]] = []
        self._current: list[str] | None = None

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            href = dict(attrs).get("href")
            self._current = [href, ""] if isinstance(href, str) else None

    def handle_data(self, data):
        if self._current is not None:
            self._current[1] += data[:100]

    def handle_endtag(self, tag):
        if tag == "a" and self._current is not None:
            self.links.append(tuple(self._current))
            self._current = None


def discover_product_links(
    html: str, root_url: str, canonical_domain: str,
    *, a54_enabled: bool = False,
) -> list[dict]:
    """Single-depth first-party discovery; NO PDF downloads or external links."""
    parser = ProductLinkParser()
    parser.feed(html[:MAX_HTML_BYTES])
    ranked: dict[str, tuple[int, str]] = {}
    for href, label in parser.links[:1500]:
        if not href or href.startswith(("#", "mailto:", "javascript:", "tel:")):
            continue
        if len(href) > 1000:
            continue
        try:
            joined = urljoin(root_url, href)
            parsed = urlsplit(joined)
            if parsed.scheme != "https" or parsed.username or parsed.password:
                continue
            if parsed.port not in (None, 443):
                continue
            path = parsed.path or "/"
            if path in ("", "/") or NON_HTML_EXTENSION.search(path):
                continue
            if len(path) > 800 or not re.fullmatch(r"/[A-Za-z0-9._~/%-]+", path):
                continue
            # Normalize www/apex variants to the already-verified official
            # homepage host. This avoids duplicate pages and persistent 301s.
            if not safe_official_url(joined, canonical_domain):
                continue
            primary_host = (urlsplit(root_url).hostname or "").lower()
            normalized = urlunsplit(("https", primary_host, path, "", ""))
            if not safe_official_url(normalized, canonical_domain):
                continue
            slug = path.replace("-", " ").replace("_", " ")
            short_label = " ".join(label.split())[:100]
            if IGNORE_LINK_PATTERN.search(slug):
                continue
            kind = None
            score = 0
            for candidate, pattern in PRODUCT_LINK_PATTERNS.items():
                path_hit = pattern.search(slug) is not None
                label_hit = pattern.search(short_label) is not None
                if not path_hit and not label_hit:
                    continue
                candidate_score = (8 if path_hit else 0) + (3 if label_hit else 0)
                if candidate == "products":
                    candidate_score += 2
                if candidate_score > score:
                    kind, score = candidate, candidate_score
            if kind is None and a54_enabled and technical_sheet_hint(
                slug + " " + short_label
            ):
                kind, score = "catalog", 8
            if kind is None:
                continue
            if a54_enabled:
                score += link_priority_bonus(path, short_label)
            previous = ranked.get(normalized)
            if previous is None or score > previous[0]:
                ranked[normalized] = (score, kind)
        except (ValueError, TypeError, UnicodeError):
            continue
    return [
        {"url": url, "kind": kind}
        for url, (_, kind) in sorted(ranked.items(), key=lambda kv: (-kv[1][0], kv[0]))
    ][:MAX_PRODUCT_PAGES_PER_COMPANY]


def safe_official_url(value: str, canonical_domain: str) -> bool:
    try:
        parsed = urlsplit(value)
        host = (parsed.hostname or "").lower().rstrip(".")
        canonical = canonical_domain.lower().rstrip(".")
        if parsed.scheme != "https" or parsed.username or parsed.password:
            return False
        if parsed.port not in (None, 443) or not canonical or not host:
            return False
        if host != canonical and host != "www." + canonical:
            return False
        if any(c in host for c in ("_", "@", " ")):
            return False
        try:
            ipaddress.ip_address(host)
            return False
        except ValueError:
            return "." in host and host not in ("localhost", "localhost.localdomain")
    except (ValueError, TypeError, AttributeError):
        return False


def public_dns_only(host: str) -> bool:
    """Best-effort SSRF guard. HTTPS, no redirects and canonical domain required too."""
    try:
        ips = {info[4][0] for info in socket.getaddrinfo(host, 443, proto=socket.IPPROTO_TCP)}
        return bool(ips) and all(ipaddress.ip_address(ip).is_global for ip in ips)
    except (socket.gaierror, OSError, ValueError):
        return False


def extract_candidates(html: str) -> list[dict]:
    parser = SafeHtmlText()
    parser.feed(html[:MAX_HTML_BYTES])
    text = parser.text()
    seen = set()
    candidates = []
    for kind, pattern in TOKEN_PATTERNS:
        for match in pattern.finditer(text):
            claim = match.group(0)
            # The exact text observed on the source must remain in a short excerpt.
            excerpt = text[max(0, match.start()-80):min(len(text), match.end()+80)]
            key = (kind, claim.casefold())
            if key in seen:
                continue
            seen.add(key)
            candidates.append({
                "claim_kind": kind,
                "claim_value": claim,
                "evidence_excerpt": excerpt[:240],
            })
            if len(candidates) >= MAX_CANDIDATES:
                return candidates
    return candidates


def parse_lease(payload: object) -> list[dict]:
    if not isinstance(payload, dict) or payload.get("contract") != "netproducers1-auto1-claim-v1":
        raise ValueError("Invalid lease contract")
    items = payload.get("items")
    if not isinstance(items, list) or len(items) > MAX_BATCH or payload.get("count") != len(items):
        raise ValueError("Invalid lease list")
    for row in items:
        if not isinstance(row, dict) or not safe_official_url(
            row.get("source_url", ""), row.get("canonical_domain", "")
        ):
            raise ValueError("Unexpected non-canonical page")
    return items


def parse_product_page_lease(payload: object) -> list[dict]:
    if not isinstance(payload, dict) or payload.get("contract") != "netproducers-auto1a3-claim-v1":
        raise ValueError("Invalid product page claim contract")
    items = payload.get("items")
    if not isinstance(items, list) or len(items) > MAX_PRODUCT_PAGES_PER_RUN or payload.get("count") != len(items):
        raise ValueError("Invalid product page claim batch")
    for row in items:
        if not isinstance(row, dict) or not isinstance(row.get("page_id"), str) or not safe_official_url(
            row.get("source_url", ""), row.get("canonical_domain", "")
        ):
            raise ValueError("Invalid first-party product page")
    return items


def parse_detail_page_lease(payload: object) -> list[dict]:
    if not isinstance(payload, dict) or payload.get("contract") != "netproducers-auto1a4-claim-v1":
        raise ValueError("Invalid depth-two claim contract")
    items = payload.get("items")
    if not isinstance(items, list) or len(items) > MAX_DETAIL_PAGES_PER_RUN or payload.get("count") != len(items):
        raise ValueError("Invalid depth-two claim list")
    for row in items:
        if (not isinstance(row, dict)
            or not isinstance(row.get("page_id"), str)
            or not isinstance(row.get("parent_page_id"), str)
            or not isinstance(row.get("parent_sha256"), str)
            or re.fullmatch(r"[0-9a-f]{64}", row["parent_sha256"]) is None
            or not safe_official_url(row.get("source_url", ""), row.get("canonical_domain", ""))):
            raise ValueError("Invalid depth-two official source")
    return items


def db_rpc(db, name: str, arguments: dict) -> dict:
    res = db.rpc(name, arguments).execute()
    if not isinstance(res.data, dict):
        raise ValueError("Unexpected RPC response")
    return res.data


async def fetch_official_page(client: httpx.AsyncClient, lease: dict) -> dict:
    url = lease["source_url"]
    host = urlsplit(url).hostname
    if not host or not public_dns_only(host):
        return {"status": "blocked", "error": "dns_not_public"}

    robots_url = f"https://{host}/robots.txt"
    try:
        robots = await client.get(robots_url, headers={"User-Agent": USER_AGENT})
        if robots.status_code == 200:
            if len(robots.content) > 100_000:
                return {"status": "blocked", "error": "robots_too_large"}
            rules = RobotFileParser()
            rules.parse(robots.text.splitlines())
            if not rules.can_fetch(USER_AGENT, url):
                return {"status": "blocked", "error": "robots_disallow"}
        elif robots.status_code not in (404, 410):
            return {"status": "blocked", "error": "robots_unknown"}
    except (httpx.HTTPError, UnicodeError):
        return {"status": "blocked", "error": "robots_unavailable"}

    headers = {"User-Agent": USER_AGENT, "Accept": "text/html"}
    if isinstance(lease.get("etag"), str) and lease["etag"]:
        headers["If-None-Match"] = lease["etag"][:200]
    if isinstance(lease.get("last_modified"), str) and lease["last_modified"]:
        headers["If-Modified-Since"] = lease["last_modified"][:200]

    try:
        async with client.stream("GET", url, headers=headers) as response:
            if response.status_code == 304:
                return {"status": "unchanged", "sha256": lease.get("last_sha256")}
            if response.status_code != 200:
                return {"status": "failed", "error": "http_" + str(response.status_code)}
            if "text/html" not in response.headers.get("content-type", "").lower():
                return {"status": "blocked", "error": "not_html"}
            content = bytearray()
            async for chunk in response.aiter_bytes():
                content.extend(chunk)
                if len(content) > MAX_HTML_BYTES:
                    return {"status": "blocked", "error": "html_too_large"}
            raw = bytes(content)
            digest = hashlib.sha256(raw).hexdigest()
            if digest == lease.get("last_sha256") and not (lease.get("needs_detail_discovery") or lease.get("needs_content_reparse")):
                return {"status": "unchanged", "sha256": digest}
            text = raw.decode("utf-8", errors="replace")
            # Diagnose only the same first-party depth-two HTML that A4 processes.
            # Nothing here combines evidence across rows or persists raw HTML.
            is_detail = bool(lease.get("parent_page_id"))
            technical_candidates = extract_exact_row_candidates(text, url, digest) if is_detail else []
            diagnostic = diagnose_detail_html(text, technical_candidates) if is_detail else None
            technical_fingerprint = fingerprint_technical_rows(text) if is_detail else None
            a54_enabled = os.getenv("NETPRODUCERS_A54_ENABLED", "false").lower() == "true"
            # The product page can itself have an HTML table. For A5.4 only
            # classify the layout; do NOT extract a first-level technical claim.
            layout = None
            if a54_enabled and lease.get("page_id"):
                layout_diagnostic = diagnostic or diagnose_detail_html(text, [])
                layout_fingerprint = technical_fingerprint or fingerprint_technical_rows(text)
                layout = classify_html_layout(layout_diagnostic, layout_fingerprint)
            return {
                "status": "processed",
                "sha256": digest,
                "etag": response.headers.get("etag", "")[:200] or None,
                "last_modified": response.headers.get("last-modified", "")[:200] or None,
                "candidates": extract_candidates(text),
                "product_links": discover_product_links(
                    text, url, lease["canonical_domain"], a54_enabled=a54_enabled
                ) if not lease.get("page_id") else [],
                "detail_links": discover_detail_links(
                    text, url, host, digest, a54_enabled=a54_enabled
                ) if lease.get("page_id") and not lease.get("parent_page_id") else [],
                "technical_candidates": technical_candidates,
                "diagnostic": diagnostic,
                "technical_fingerprint": technical_fingerprint,
                "a54_layout": layout,
            }
    except httpx.HTTPError:
        return {"status": "failed", "error": "http_transport_error"}


async def run(db, *, limit: int = 10, dry_run: bool = True) -> dict:
    if not 1 <= limit <= MAX_BATCH:
        raise ValueError("1-25 companies per worker call")
    if dry_run:
        # Status-only default: do not lease anything or contact external websites.
        return {"mode": "dry_run", "status": db_rpc(db, "netproducers1_auto1_status", {})}

    # Release flag: never call A4 RPCs before its migration is installed.
    a4_enabled = os.getenv("NETPRODUCERS_A4_ENABLED", "false").lower() == "true"
    # Explicit rollout flag: SQL A5 migration must exist before calling its RPC.
    a5_enabled = a4_enabled and os.getenv("NETPRODUCERS_A5_ENABLED", "false").lower() == "true"
    # Separate migration + release flag: never call the A5.3 RPC prematurely.
    a53_enabled = a5_enabled and os.getenv("NETPRODUCERS_A53_ENABLED", "false").lower() == "true"
    # A5.4 changes discovery ranking + aggregate HTML layout metrics only.
    a54_enabled = os.getenv("NETPRODUCERS_A54_ENABLED", "false").lower() == "true"

    # Grow the durable queue automatically as newly published canonical IT
    # producers appear. Only the private service role can invoke this RPC.
    # Existing sources are skipped by the idempotent DB seed.
    seed = db_rpc(db, "netproducers1_auto1_seed", {"p_limit": 100})
    if (seed.get("contract") != "netproducers1-auto1-seed-v1"
            or type(seed.get("added")) is not int
            or not 0 <= seed["added"] <= 100):
        raise ValueError("Invalid automatic seed response")

    leases = parse_lease(db_rpc(db, "netproducers1_auto1_claim", {"p_limit": limit}))
    outcomes = []
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(12.0), follow_redirects=False, trust_env=False,
    ) as client:
        for idx, lease in enumerate(leases):
            if idx:
                await asyncio.sleep(1.5)  # avoid hammering first-party hosts
            outcome = await fetch_official_page(client, lease)
            result = db_rpc(db, "netproducers1_auto1_complete", {
                "p_company_id": lease["company_id"],
                "p_source_sha256": outcome.get("sha256"),
                "p_status": outcome["status"],
                "p_candidates": outcome.get("candidates", []),
                "p_etag": outcome.get("etag"),
                "p_last_modified": outcome.get("last_modified"),
                "p_error": outcome.get("error"),
            })
            if outcome["status"] == "processed":
                # SQL rechecks the ROOT's exact SHA after completion. Discovery
                # is idempotent and bounded even on a repeated HTML snapshot.
                discovery = db_rpc(db, "netproducers1_auto1a3_discover", {
                    "p_company_id": lease["company_id"],
                    "p_home_sha256": outcome["sha256"],
                    "p_pages": outcome.get("product_links", []),
                })
                if discovery.get("contract") != "netproducers-auto1a3-discover-v1":
                    raise ValueError("Invalid discovery acknowledgement")
            outcomes.append({
                "company_id": lease["company_id"],
                "status": outcome["status"],
                "candidate_count": result.get("candidate_count", 0),
                "published_claims": 0,
            })
    page_leases = parse_product_page_lease(db_rpc(
        db, "netproducers1_auto1a3_claim_pages",
        {"p_limit": min(MAX_PRODUCT_PAGES_PER_RUN, limit)}
    ))
    page_outcomes = []
    a54_product_quality = {}
    a54_detail_quality = {}
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(12.0), follow_redirects=False, trust_env=False,
    ) as client:
        for idx, page in enumerate(page_leases):
            if idx:
                await asyncio.sleep(1.5)
            outcome = await fetch_official_page(client, page)
            result = db_rpc(db, "netproducers1_auto1a3_complete_page", {
                "p_page_id": page["page_id"],
                "p_source_sha256": outcome.get("sha256"),
                "p_status": outcome["status"],
                "p_candidates": outcome.get("candidates", []),
                "p_etag": outcome.get("etag"),
                "p_last_modified": outcome.get("last_modified"),
                "p_error": outcome.get("error"),
            })
            if result.get("contract") != "netproducers-auto1a3-complete-v1":
                raise ValueError("Invalid product page completion")
            discovery_rejected = False
            if a4_enabled and outcome["status"] == "processed" and "detail_links" in outcome:
                try:
                    discovery = db_rpc(db, "netproducers1_auto1a4_discover", {
                        "p_parent_page_id": page["page_id"],
                        "p_parent_sha256": outcome["sha256"],
                        "p_links": outcome["detail_links"],
                    })
                except Exception as exc:
                    # Source navigation can include an already indexed product
                    # link. Reject that parent's A4 batch without killing the
                    # remaining companies; DO NOT swallow permission, DB or
                    # other URL errors. A failed parent remains unscanned and
                    # eligible for a bounded future retry.
                    if (str(getattr(exc, "code", "")) != "22023"
                            or str(getattr(exc, "message", "")) !=
                                "Invalid, duplicate or foreign second-level URL"):
                        raise
                    discovery_rejected = True
                    print(json.dumps({
                        "event": "netproducers_auto1a4_discovery_rejected",
                        "page_id": page["page_id"],
                        "links_considered": len(outcome["detail_links"]),
                        "reason": "invalid_or_duplicate_link",
                        "published_claims": 0,
                    }))
                else:
                    if discovery.get("contract") != "netproducers-auto1a4-discover-v1":
                        raise ValueError("Invalid depth-two discovery response")
            if a54_enabled and outcome["status"] == "processed":
                layout = outcome.get("a54_layout")
                if layout not in LAYOUT_CATEGORIES:
                    raise ValueError("Missing bounded A5.4 product HTML layout")
                a54_product_quality[layout] = a54_product_quality.get(layout, 0) + 1
            page_outcomes.append({
                "page_id": page["page_id"],
                "status": outcome["status"],
                "candidate_count": result.get("candidate_count", 0),
                "discovery_rejected": discovery_rejected,
            })
    detail_outcomes = []
    if a4_enabled:
        detail_leases = parse_detail_page_lease(db_rpc(
            db, "netproducers1_auto1a4_claim_pages",
            {"p_limit": min(MAX_DETAIL_PAGES_PER_RUN, limit)}
        ))
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(12.0), follow_redirects=False, trust_env=False,
        ) as client:
            for idx, detail in enumerate(detail_leases):
                if idx:
                    await asyncio.sleep(1.5)
                outcome = await fetch_official_page(client, detail)
                completed = db_rpc(db, "netproducers1_auto1a4_complete_page", {
                    "p_page_id": detail["page_id"],
                    "p_source_sha256": outcome.get("sha256"),
                    "p_status": outcome["status"],
                    "p_candidates": outcome.get("technical_candidates", []),
                    "p_etag": outcome.get("etag"),
                    "p_last_modified": outcome.get("last_modified"),
                    "p_error": outcome.get("error"),
                })
                if completed.get("contract") != "netproducers-auto1a4-complete-v1":
                    raise ValueError("Invalid depth-two completion response")
                diagnostic_recorded = False
                if a5_enabled and outcome["status"] == "processed":
                    diagnostic = outcome.get("diagnostic")
                    if not isinstance(diagnostic, dict):
                        raise ValueError("Missing A5 structural diagnostic on processed HTML")
                    ack = db_rpc(db, "netproducers1_auto1a5_record_diagnostic", {
                        "p_page_id": detail["page_id"],
                        "p_source_sha256": outcome["sha256"],
                        "p_diagnostic": diagnostic,
                    })
                    if (ack.get("contract") != "netproducers-auto1a5-record-v1"
                            or ack.get("recorded") is not True):
                        raise ValueError("Invalid A5 diagnostic acknowledgement")
                    diagnostic_recorded = True
                fingerprint_comparison = None
                if a53_enabled and diagnostic_recorded:
                    fingerprint = outcome.get("technical_fingerprint")
                    if (not isinstance(fingerprint, dict)
                            or fingerprint.get("contract") != "netproducers-auto1a53-row-fingerprint-v1"
                            or type(fingerprint.get("technical_rows")) is not int
                            or fingerprint["technical_rows"] < 0
                            or fingerprint["technical_rows"] > 120):
                        raise ValueError("Missing bounded A5.3 row signature")
                    ack53 = db_rpc(db, "netproducers1_auto1a53_record_fingerprint", {
                        "p_page_id": detail["page_id"],
                        "p_source_sha256": outcome["sha256"],
                        "p_technical_sha256": fingerprint.get("technical_sha256"),
                        "p_technical_rows": fingerprint["technical_rows"],
                    })
                    if (ack53.get("contract") != "netproducers-auto1a53-record-v1"
                            or ack53.get("recorded") is not True
                            or ack53.get("comparison") not in (
                                "baseline", "no_comparable_rows",
                                "same_observed_rows", "changed_observed_rows",
                                "unchanged_snapshot"
                            ) or ack53.get("published_capabilities") != 0):
                        raise ValueError("Invalid A5.3 fingerprint acknowledgement")
                    fingerprint_comparison = ack53["comparison"]
                if a54_enabled and outcome["status"] == "processed":
                    layout = outcome.get("a54_layout")
                    if layout not in LAYOUT_CATEGORIES:
                        raise ValueError("Missing bounded A5.4 detail HTML layout")
                    a54_detail_quality[layout] = a54_detail_quality.get(layout, 0) + 1
                detail_outcomes.append({
                    "page_id": detail["page_id"], "status": outcome["status"],
                    "private_technical_candidates": completed.get("candidate_count", 0),
                    "diagnostic_recorded": diagnostic_recorded,
                    "fingerprint_comparison": fingerprint_comparison,
                    "diagnostic_reason": (
                        outcome["diagnostic"]["reason"] if diagnostic_recorded else None
                    ),
                })
    # Per-attribute verification is independent from collection. It never
    # publishes manufacturing capability, size/grade combinations or stock.
    verification = db_rpc(db, "netproducers1_auto1b_verify", {"p_limit": 100})
    page_verification = db_rpc(db, "netproducers1_auto1a3_verify", {"p_limit": 100})
    return {"mode": "private_candidate_intake", "new_sources": seed["added"],
            "processed": len(outcomes),
            "new_candidates": sum(x["candidate_count"] for x in outcomes),
            "product_pages_processed": len(page_outcomes),
            "page_candidate_mentions": sum(x["candidate_count"] for x in page_outcomes),
            "depth_two_discovery_rejections": sum(x["discovery_rejected"] for x in page_outcomes),
            "verification": verification,
            "page_verification": page_verification,
            "detail_pages_processed": len(detail_outcomes),
            "private_technical_candidates": sum(x["private_technical_candidates"] for x in detail_outcomes),
            "a5_diagnostics_recorded": sum(x["diagnostic_recorded"] for x in detail_outcomes),
            "a54_product_page_quality": dict(sorted(a54_product_quality.items())),
            "a54_detail_page_quality": dict(sorted(a54_detail_quality.items())),
            "a53_fingerprints_recorded": sum(bool(x["fingerprint_comparison"]) for x in detail_outcomes),
            "a53_comparisons": {
                key: sum(x["fingerprint_comparison"] == key for x in detail_outcomes)
                for key in (
                    "baseline", "no_comparable_rows", "same_observed_rows",
                    "changed_observed_rows", "unchanged_snapshot"
                ) if any(x["fingerprint_comparison"] == key for x in detail_outcomes)
            },
            "published_claims": 0, "outcomes": outcomes,
            "page_outcomes": page_outcomes, "detail_outcomes": detail_outcomes}


def main() -> int:
    parser = argparse.ArgumentParser(description="Incremental first-party producer research")
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--persist", action="store_true", help="Lease + fetch + private candidate write")
    parser.add_argument("--audit-a5", action="store_true",
                        help="Manual A5.2 read-only historical snapshot audit; never requeue/publish")
    parser.add_argument("--sample", type=int, default=8,
                        help="Number of already-processed pages for A5.2 audit (1..12)")
    args = parser.parse_args()
    if args.audit_a5 and args.persist:
        parser.error("--audit-a5 is read-only and incompatible with --persist")
    if not args.audit_a5 and args.sample != 8:
        parser.error("--sample is only valid with --audit-a5")
    from supabase import create_client
    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    if args.audit_a5:
        from .net_pro_producers_auto1a5_audit import audit_historical_details
        report = asyncio.run(audit_historical_details(db, limit=args.sample))
    else:
        report = asyncio.run(run(db, limit=args.limit, dry_run=not args.persist))
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
