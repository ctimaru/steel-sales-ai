"""Field-scoped, source-backed industrial extraction (never auto-publish scopes).

A source excerpt must explicitly mention the operation and steel/tube family.
Norm mentions are recorded as unlinked observations, NOT as certified scopes.
"""
from __future__ import annotations

import re
from urllib.parse import urlsplit

from .company_discovery import CAPABILITY_SIGNALS

STEEL_RE = re.compile(r"(?i)\b(acciai?o|inox|steel|siderurg|tub[io]|tubes?|pipes?|carpenteria metallica|lamiere?)\b")
TUBE_RE = re.compile(r"(?i)\b(tub[io]|tubes?|pipes?)\b")
HOLLOW_RE = re.compile(r"(?i)(tubi? (?:quadri|rettangolari)|hollow sections?|square tubes?|rectangular tubes?|profilati cavi)")
RELATION_RE: dict[str, tuple[re.Pattern[str], ...]] = {
    "produces": (
        re.compile(r"(?i)\b(produciamo|fabbrichiamo|produzione di|produttori? di|manufacturer of|manufactures?)\s+(?:\w+\s+){0,4}(?:tubi|tubo|tubes?|pipes?)\b"),
    ),
    "distributes": (
        re.compile(r"(?i)\b(distribuzione di|vendita di|distributori? di|commercio di|stock di|distribution of|supplier of)\s+(?:\w+\s+){0,4}(?:tubi|tubo|tubes?|pipes?)\b"),
    ),
    "processes": (
        re.compile(r"(?i)\b(lavorazione di|lavorazione|taglio|piegatura|curvatura|processing of|cutting of)\s+(?:\w+\s+){0,4}(?:tubi|tubo|tubes?|pipes?)\b"),
    ),
}
STANDARDS = {
    "EN 10219": re.compile(r"(?i)\bEN[\s-]*10219(?:-\d+)?\b"),
    "EN 10210": re.compile(r"(?i)\bEN[\s-]*10210(?:-\d+)?\b"),
    "EN 10305": re.compile(r"(?i)\bEN[\s-]*10305(?:-\d+)?\b"),
    "EN 10217": re.compile(r"(?i)\bEN[\s-]*10217(?:-\d+)?\b"),
    "EN 10216": re.compile(r"(?i)\bEN[\s-]*10216(?:-\d+)?\b"),
    "ASTM A500": re.compile(r"(?i)\bASTM[\s-]*A500\b"),
}
ROLE_FOR_RELATION = {"produces": "producer", "distributes": "trader_distributor", "processes": "processor_service_provider"}


def _domain(url: str) -> str:
    host = (urlsplit(url).hostname or "").lower()
    return host.removeprefix("www.")


def industrial_evidence(outcome: dict, fetched_at: str) -> list[dict]:
    if outcome.get("status") != "candidate_only":
        return []
    source_site = str(outcome.get("source_website") or "")
    domain = _domain(source_site)
    if not domain:
        return []
    candidates: list[dict] = []
    for page in outcome.get("evidence") or []:
        if not isinstance(page, dict):
            continue
        url = str(page.get("url") or "")
        excerpt = str(page.get("snippet") or "")[:1200]
        if urlsplit(url).scheme != "https" or _domain(url) != domain or not excerpt or not STEEL_RE.search(excerpt):
            continue
        fields: list[tuple[str, object]] = []
        relationships = [
            {"family": "tubes_pipes", "relationship": relation}
            for relation, patterns in RELATION_RE.items()
            if TUBE_RE.search(excerpt) and any(p.search(excerpt) for p in patterns)
        ]
        standards = [key for key, pattern in STANDARDS.items() if pattern.search(excerpt)]
        # A named standard is NOT automatically certified for the company's products.
        if relationships or standards:
            fields.append(("products", {
                "explicit_relationships": relationships,
                "standards_mentioned_unlinked": standards,
                "verified_scope": False,
            }))
        capabilities = [
            key for key, phrases in CAPABILITY_SIGNALS.items()
            if any(phrase.lower() in excerpt.lower() for phrase in phrases)
        ]
        if capabilities:
            fields.append(("services", sorted(set(capabilities))))
        roles = [ROLE_FOR_RELATION[rel["relationship"]] for rel in relationships]
        if roles:
            fields.append(("industry", sorted(set(roles))))
        for field_key, field_value in fields:
            candidates.append({
                "field_key": field_key,
                "field_value": field_value,
                "evidence_url": url,
                "evidence_excerpt": excerpt,
                "extractor_version": "net-intel1-c-fields-v1",
                "fetched_at": fetched_at,
            })
            if len(candidates) >= 18:
                return candidates
    return candidates
