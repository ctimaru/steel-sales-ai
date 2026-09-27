from __future__ import annotations

import asyncio
import ipaddress
import json
import logging
import os
import re
import socket
from contextlib import suppress
from dataclasses import dataclass
from datetime import UTC, datetime
from html.parser import HTMLParser
from typing import Annotated
from urllib.parse import quote, urljoin, urlsplit, urlunsplit
from urllib.robotparser import RobotFileParser
from uuid import UUID

import httpx
from fastapi import APIRouter, BackgroundTasks, FastAPI, Header, HTTPException, status
from pydantic import BaseModel

from .bulk_import import _require_worker_token
from .repository import RepositoryConfigurationError, RepositoryError, WorkerRepository

router = APIRouter(prefix="/v1/network/discovery", tags=["network-discovery"])
logger = logging.getLogger(__name__)

USER_AGENT = "SteelSalesAI-CompanyDiscovery/1.0 (+public-company-profile-crawler)"
EXTRACTION_VERSION = "p3.4-v1"
MAX_PAGES_PER_DOMAIN = 5
MAX_RESPONSE_BYTES = 1_500_000
MAX_TEXT_CHARS_PER_PAGE = 24_000
REQUEST_TIMEOUT_SECONDS = 10.0
MAX_REDIRECTS = 4

PRIORITY_PATH_HINTS = (
    "about",
    "company",
    "chi-siamo",
    "azienda",
    "products",
    "prodotti",
    "tubes",
    "tubi",
    "pipes",
    "services",
    "servizi",
    "capabilities",
    "lavorazioni",
)

LEGAL_SUFFIX_RE = re.compile(
    r"\b([A-ZÀ-ÖØ-Ý0-9][A-Za-zÀ-ÿ0-9&.'’\- ]{2,100}?"
    r"(?:S\.?\s*p\.?\s*A\.?|S\.?\s*r\.?\s*l\.?|S\.?\s*a\.?\s*s\.?|"
    r"S\.?\s*n\.?\s*c\.?|Società\s+per\s+Azioni|Limited|Ltd\.?|GmbH|AG))\b",
    re.IGNORECASE,
)
VAT_PATTERNS = (
    re.compile(r"(?:P\.?\s*IVA|Partita\s+IVA|VAT(?:\s+number)?)[\s:#-]*([A-Z]{0,2}\s*\d{8,13})", re.I),
    re.compile(r"\bIT\s*(\d{11})\b", re.I),
)


class CompanyDiscoveryError(RuntimeError):
    pass


class DiscoveryCrawlRequest(BaseModel):
    run_id: UUID


class DiscoveryCrawlResponse(BaseModel):
    run_id: UUID
    status: str
    candidate_count: int
    skipped_count: int
    error_count: int


@dataclass(frozen=True)
class CrawledPage:
    url: str
    title: str | None
    site_name: str | None
    meta_description: str | None
    h1: str | None
    text: str
    links: tuple[str, ...]
    structured_data: tuple[dict[str, object], ...] = ()


class _PublicHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._skip_depth = 0
        self._tag: str | None = None
        self._title: list[str] = []
        self._h1: list[str] = []
        self._text: list[str] = []
        self._links: list[str] = []
        self.site_name: str | None = None
        self.meta_description: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attrs_map = {key.lower(): value for key, value in attrs}
        if tag in {"script", "style", "noscript", "svg"}:
            self._skip_depth += 1
        if self._skip_depth:
            return
        self._tag = tag
        if tag == "a" and attrs_map.get("href"):
            self._links.append(attrs_map["href"] or "")
        if tag == "meta":
            key = (attrs_map.get("property") or attrs_map.get("name") or "").lower()
            value = (attrs_map.get("content") or "").strip()
            if key == "og:site_name" and value:
                self.site_name = value[:255]
            elif key in {"description", "og:description"} and value and not self.meta_description:
                self.meta_description = value[:1000]

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in {"script", "style", "noscript", "svg"} and self._skip_depth:
            self._skip_depth -= 1
        if self._tag == tag:
            self._tag = None

    def handle_data(self, data: str) -> None:
        if self._skip_depth:
            return
        value = " ".join(data.split())
        if not value:
            return
        self._text.append(value)
        if self._tag == "title":
            self._title.append(value)
        elif self._tag == "h1" and len(" ".join(self._h1)) < 500:
            self._h1.append(value)

    def result(
        self,
        url: str,
        structured_data: tuple[dict[str, object], ...] = (),
    ) -> CrawledPage:
        title = " ".join(self._title).strip()[:500] or None
        h1 = " ".join(self._h1).strip()[:500] or None
        text = " ".join(self._text)
        return CrawledPage(
            url=url,
            title=title,
            site_name=self.site_name,
            meta_description=self.meta_description,
            h1=h1,
            text=text[:MAX_TEXT_CHARS_PER_PAGE],
            links=tuple(self._links[:500]),
            structured_data=structured_data,
        )


JSON_LD_SCRIPT_RE = re.compile(
    r"""<script\b[^>]*type=["']application/ld\+json["'][^>]*>(.*?)</script\s*>""",
    re.IGNORECASE | re.DOTALL,
)


def _extract_structured_data(html: str) -> tuple[dict[str, object], ...]:
    output: list[dict[str, object]] = []
    for raw in JSON_LD_SCRIPT_RE.findall(html[:MAX_RESPONSE_BYTES]):
        if len(raw) > 256_000:
            continue
        try:
            payload = json.loads(raw.strip())
        except (json.JSONDecodeError, TypeError, ValueError):
            continue
        values = payload if isinstance(payload, list) else [payload]
        for value in values:
            if isinstance(value, dict):
                output.append(value)
                if len(output) >= 24:
                    return tuple(output)
    return tuple(output)


def canonical_domain(url: str) -> str:
    host = (urlsplit(url).hostname or "").lower().rstrip(".")
    if host.startswith("www."):
        host = host[4:]
    return host


def canonicalize_seed_url(url: str) -> str:
    value = url.strip()
    parsed = urlsplit(value)
    if parsed.scheme.lower() not in {"http", "https"}:
        raise CompanyDiscoveryError("Only absolute http(s) seed URLs are allowed.")
    if parsed.username or parsed.password:
        raise CompanyDiscoveryError("Credentials in discovery URLs are not allowed.")
    if parsed.port not in (None, 80, 443):
        raise CompanyDiscoveryError("Only ports 80 and 443 are allowed.")
    host = (parsed.hostname or "").lower().rstrip(".")
    if not host:
        raise CompanyDiscoveryError("Discovery URL is missing a host.")
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        address = None
    if address and not address.is_global:
        raise CompanyDiscoveryError("Private, local, reserved or non-global IPs are not allowed.")
    netloc = host
    if parsed.port:
        netloc += f":{parsed.port}"
    return urlunsplit((parsed.scheme.lower(), netloc, parsed.path or "/", parsed.query, ""))


async def _assert_public_hostname(host: str) -> None:
    try:
        results = await asyncio.to_thread(socket.getaddrinfo, host, None, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise CompanyDiscoveryError(f"DNS resolution failed for {host}.") from exc
    addresses = {row[4][0] for row in results}
    if not addresses:
        raise CompanyDiscoveryError(f"DNS returned no address for {host}.")
    for value in addresses:
        try:
            address = ipaddress.ip_address(value)
        except ValueError as exc:
            raise CompanyDiscoveryError(f"Invalid DNS address for {host}.") from exc
        if not address.is_global:
            raise CompanyDiscoveryError(f"Host {host} resolves to a non-public address.")


async def _request_public_url(
    client: httpx.AsyncClient,
    url: str,
) -> tuple[httpx.Response, str]:
    current = canonicalize_seed_url(url)
    for _ in range(MAX_REDIRECTS + 1):
        parsed = urlsplit(current)
        assert parsed.hostname
        await _assert_public_hostname(parsed.hostname)
        async with client.stream(
            "GET",
            current,
            headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
            follow_redirects=False,
        ) as response:
            if response.status_code in {301, 302, 303, 307, 308}:
                location = response.headers.get("location")
                if not location:
                    raise CompanyDiscoveryError(f"Redirect without location from {current}.")
                current = canonicalize_seed_url(urljoin(current, location))
                continue
            chunks: list[bytes] = []
            total = 0
            async for chunk in response.aiter_bytes():
                total += len(chunk)
                if total > MAX_RESPONSE_BYTES:
                    raise CompanyDiscoveryError(f"Response exceeds {MAX_RESPONSE_BYTES} bytes.")
                chunks.append(chunk)
            body = b"".join(chunks)
            response._content = body
            return response, current
    raise CompanyDiscoveryError("Too many redirects.")


async def _robots_allows(client: httpx.AsyncClient, base_url: str, target_url: str) -> bool:
    parsed = urlsplit(base_url)
    robots_url = urlunsplit((parsed.scheme, parsed.netloc, "/robots.txt", "", ""))
    try:
        response, _ = await _request_public_url(client, robots_url)
    except (httpx.HTTPError, CompanyDiscoveryError):
        return False
    if response.status_code in {404, 410}:
        return True
    if response.status_code >= 400:
        return False
    parser = RobotFileParser()
    parser.set_url(robots_url)
    parser.parse(response.text.splitlines())
    return parser.can_fetch(USER_AGENT, target_url)


async def _fetch_page(client: httpx.AsyncClient, url: str, base_url: str) -> CrawledPage | None:
    if not await _robots_allows(client, base_url, url):
        return None
    response, final_url = await _request_public_url(client, url)
    if response.status_code >= 400:
        return None
    content_type = (response.headers.get("content-type") or "").lower()
    if "html" not in content_type and "xhtml" not in content_type:
        return None
    structured_data = _extract_structured_data(response.text)
    parser = _PublicHTMLParser()
    parser.feed(response.text)
    return parser.result(final_url, structured_data)


def _priority_links(home: CrawledPage) -> list[str]:
    domain = canonical_domain(home.url)
    output: list[str] = []
    seen: set[str] = {home.url}
    for href in home.links:
        absolute = urljoin(home.url, href)
        try:
            normalized = canonicalize_seed_url(absolute)
        except CompanyDiscoveryError:
            continue
        if canonical_domain(normalized) != domain or normalized in seen:
            continue
        lowered = urlsplit(normalized).path.lower()
        if not any(hint in lowered for hint in PRIORITY_PATH_HINTS):
            continue
        seen.add(normalized)
        output.append(normalized)
        if len(output) >= MAX_PAGES_PER_DOMAIN - 1:
            break
    return output


def _redact_personal_channels(value: str) -> str:
    value = re.sub(
        r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b",
        "[email removed]",
        value,
        flags=re.IGNORECASE,
    )
    return re.sub(
        r"(?<![A-Za-z0-9])\+?\d[\d\s()./-]{7,}\d(?![A-Za-z0-9])",
        "[phone removed]",
        value,
    )


def _walk_structured_nodes(value: object):
    if isinstance(value, dict):
        yield value
        graph = value.get("@graph")
        if isinstance(graph, list):
            for item in graph:
                yield from _walk_structured_nodes(item)
        for key in ("department", "subOrganization", "location"):
            nested = value.get(key)
            if isinstance(nested, (dict, list)):
                yield from _walk_structured_nodes(nested)
    elif isinstance(value, list):
        for item in value:
            yield from _walk_structured_nodes(item)


def _normalize_country_code(value: object, fallback: str) -> str:
    if isinstance(value, dict):
        value = value.get("name") or value.get("@id") or ""
    text = str(value or "").strip()
    normalized = text.upper()
    aliases = {
        "ITALIA": "IT",
        "ITALY": "IT",
        "ITALIEN": "IT",
    }
    if normalized in aliases:
        return aliases[normalized]
    if re.fullmatch(r"[A-Z]{2}", normalized):
        return normalized
    return fallback.upper()


def _structured_facilities(
    pages: list[CrawledPage],
    country_code: str,
) -> list[dict[str, object]]:
    facilities: list[dict[str, object]] = []
    seen: set[tuple[str, str, str, str, str]] = set()

    for page in pages:
        for root in page.structured_data:
            for node in _walk_structured_nodes(root):
                address = node.get("address")
                if not isinstance(address, dict):
                    continue
                address_type = str(address.get("@type") or "").lower()
                if address_type and "postaladdress" not in address_type:
                    continue

                street = str(address.get("streetAddress") or "").strip() or None
                city = str(address.get("addressLocality") or "").strip() or None
                region = str(address.get("addressRegion") or "").strip() or None
                postal = str(address.get("postalCode") or "").strip() or None
                country = _normalize_country_code(
                    address.get("addressCountry"),
                    country_code,
                )
                if street is None and city is None:
                    continue

                node_name = str(node.get("name") or "").strip()
                node_type = node.get("@type")
                if isinstance(node_type, list):
                    type_text = " ".join(str(item) for item in node_type)
                else:
                    type_text = str(node_type or "")
                facility_type = (
                    "plant"
                    if re.search(r"(?i)factory|manufacturing|plant", type_text)
                    else "public_business_location"
                )
                website_url = str(node.get("url") or page.url).strip() or page.url
                name = node_name[:255] if node_name else None

                key = (
                    (name or "").lower(),
                    (street or "").lower(),
                    (city or "").lower(),
                    postal or "",
                    country,
                )
                if key in seen:
                    continue
                seen.add(key)
                facilities.append({
                    "name": name,
                    "facility_type": facility_type,
                    "address_line_1": street,
                    "address_line_2": None,
                    "postal_code": postal,
                    "city": city,
                    "region": region,
                    "country_code": country,
                    "website_url": website_url[:500],
                    "source_url": page.url,
                    "source_kind": "json_ld_postal_address",
                })
                if len(facilities) >= 12:
                    return facilities
    return facilities


CAPABILITY_SIGNALS: dict[str, tuple[str, ...]] = {
    "laser_cutting": (
        "taglio laser tubo", "taglio laser tubi", "taglio laser",
        "tube laser cutting", "laser cutting",
    ),
    "bending_forming": (
        "piegatura tubi", "piegatura tubo", "curvatura tubi",
        "tube bending", "bending",
    ),
    "welding_fabrication": (
        "saldatura", "carpenteria", "welding", "fabrication",
    ),
    "sawing": ("segatura", "sawing"),
    "stockholding": (
        "stockholder", "stockist", "stock di tubi", "magazzino tubi",
        "ampio stock", "pronta consegna",
    ),
    "galvanizing": ("zincatura", "galvanizing", "hot dip galvanizing"),
    "painting_coating": (
        "verniciatura", "painting", "powder coating", "coating",
    ),
    "cut_to_length": ("taglio a misura", "cut to length", "cut-to-length"),
    "slitting": ("slitting", "taglio nastri"),
    "heat_treatment": ("trattamento termico", "heat treatment"),
    "testing_ndt": (
        "prove non distruttive", "non destructive testing",
        "non-destructive testing", "ultrasonic testing", "ndt",
    ),
}

MARKET_SIGNALS: dict[str, tuple[str, ...]] = {
    "automotive": ("automotive", "automobilistico", "automobilistica"),
    "energy": ("oil & gas", "oil and gas", "energy sector", "settore energia"),
    "hvac": ("hvac", "heating", "ventilation", "climatizzazione"),
    "construction_infrastructure": (
        "construction", "costruzioni", "infrastructure", "infrastrutture",
    ),
    "agri_machinery": (
        "agricultural machinery", "macchine agricole", "agricoltura",
    ),
    "mechanical_engineering_market": (
        "mechanical engineering", "meccanica", "macchine industriali",
    ),
    "marine": ("marine sector", "settore navale", "navale"),
    "appliances": ("appliances", "elettrodomestici"),
}


def _classify_enrichment(text: str) -> tuple[list[str], list[str]]:
    lowered = " ".join(text.lower().split())

    def matched(mapping: dict[str, tuple[str, ...]]) -> list[str]:
        return [
            key
            for key, phrases in mapping.items()
            if any(phrase in lowered for phrase in phrases)
        ]

    return matched(CAPABILITY_SIGNALS), matched(MARKET_SIGNALS)


def _domain_identity_stem(domain: str) -> str:
    stem = domain.split(".")[0].replace("-", " ").replace("_", " ").strip()
    # Company domains frequently concatenate the Italian legal form to the brand
    # (e.g. morandispa.it). Remove it only as a terminal domain suffix.
    stem = re.sub(r"(?i)(?:spa|srl|sas|snc)$", "", stem).strip()
    return " ".join(stem.split())


def _normalize_identity(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def _clean_identity_candidate(value: str) -> str:
    candidate = re.split(r"\s+[|–—]\s+|\s+-\s+", value, maxsplit=1)[0].strip()
    candidate = re.sub(
        r"(?i)^(?:home|chi\s+siamo|azienda|company|produzione|production|"
        r"la\s+nostra\s+produzione|our\s+production)\s*[:|\-–—]*\s*",
        "",
        candidate,
    ).strip(" -|,;:")
    candidate = re.sub(r"\s{2,}", " ", candidate).strip()

    # Normalize common Italian legal suffixes so identity matching remains stable.
    suffixes = (
        (r"(?i)\bS\.?\s*P\.?\s*A\.?$", "S.p.A."),
        (r"(?i)\bS\.?\s*R\.?\s*L\.?$", "S.r.l."),
        (r"(?i)\bS\.?\s*A\.?\s*S\.?$", "S.a.s."),
        (r"(?i)\bS\.?\s*N\.?\s*C\.?$", "S.n.c."),
    )
    for pattern, replacement in suffixes:
        if re.search(pattern, candidate):
            candidate = re.sub(pattern, replacement, candidate)
            break

    return candidate[:255]


def _candidate_identity(
    pages: list[CrawledPage],
    domain: str,
) -> tuple[str, dict[str, object], list[str]]:
    domain_stem = _domain_identity_stem(domain)
    normalized_domain = _normalize_identity(domain_stem)
    candidates: list[tuple[str, str, int]] = []

    for page in pages:
        for source, value, base_score in (
            ("site_name", page.site_name, 7),
            ("title", page.title, 6),
            ("h1", page.h1, 5),
        ):
            if not value:
                continue
            cleaned = _clean_identity_candidate(value)
            if 2 < len(cleaned) <= 255:
                candidates.append((cleaned, source, base_score))

    for page in pages:
        for match in LEGAL_SUFFIX_RE.finditer(page.text[:16000]):
            cleaned = _clean_identity_candidate(match.group(1))
            if 2 < len(cleaned) <= 255:
                candidates.append((cleaned, "page_text_legal_suffix", 4))

    scored: list[tuple[int, int, str, str]] = []
    for candidate, source, base_score in candidates:
        normalized = _normalize_identity(candidate)
        if normalized_domain and normalized_domain in normalized:
            domain_token = re.sub(r"[^A-Za-z0-9]+", ".*?", re.escape(domain_stem), flags=re.IGNORECASE)
            suffix = r"(?:S\.?\s*p\.?\s*A\.?|S\.?\s*r\.?\s*l\.?|S\.?\s*a\.?\s*s\.?|S\.?\s*n\.?\s*c\.?|Società\s+per\s+Azioni|Limited|Ltd\.?|GmbH|AG)"
            match = re.search(rf"(?i)({domain_token}\s*{suffix})", candidate)
            if match:
                candidate = match.group(1).strip()
                normalized = _normalize_identity(candidate)
        score = base_score
        domain_aligned = bool(normalized_domain and normalized_domain in normalized)
        legal_suffix_present = bool(LEGAL_SUFFIX_RE.search(candidate))
        if domain_aligned:
            score += 8
        elif not legal_suffix_present:
            # Generic headings such as "Soluzioni per tubi in acciaio" are
            # descriptions, not identities. Prefer a clean domain fallback.
            score -= 10
        if legal_suffix_present:
            score += 5
        token_count = len(candidate.split())
        if 1 <= token_count <= 8:
            score += 2
        if token_count > 12:
            score -= 5
        if re.search(
            r"(?i)\b(?:produzione|production|prodotti|products|servizi|services|"
            r"lavorazioni|solutions|homepage|welcome)\b",
            candidate,
        ):
            score -= 5
        scored.append((score, -len(candidate), candidate, source))

    if scored:
        scored.sort(reverse=True)
        score, _, candidate, source = scored[0]
        if score >= 3:
            quality_flags: list[str] = []
            if not LEGAL_SUFFIX_RE.search(candidate):
                quality_flags.append("identity_no_legal_suffix")
            if normalized_domain and normalized_domain not in _normalize_identity(candidate):
                quality_flags.append("identity_domain_mismatch")
            return (
                candidate,
                {
                    "source": source,
                    "score": score,
                    "domain_stem": domain_stem,
                    "legal_suffix_present": bool(LEGAL_SUFFIX_RE.search(candidate)),
                },
                quality_flags,
            )

    fallback = domain_stem.title() or domain
    return (
        fallback[:255],
        {
            "source": "domain_fallback",
            "score": 1,
            "domain_stem": domain_stem,
            "legal_suffix_present": False,
        },
        ["identity_domain_fallback", "identity_no_legal_suffix"],
    )

def _vat_id(text: str) -> str | None:
    for pattern in VAT_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue
        value = re.sub(r"\s+", "", match.group(1)).upper()
        if value.startswith("IT") and value[2:].isdigit():
            return value[2:]
        if value.isdigit():
            return value
    return None


def _has_any(text: str, terms: tuple[str, ...]) -> bool:
    return any(term in text for term in terms)


def _weighted_signal_score(text: str, signals: tuple[tuple[str, float], ...]) -> float:
    lowered = " ".join(text.lower().split())
    score = 0.0
    for phrase, weight in signals:
        if phrase in lowered:
            score += weight
    return score


def classify_company(
    text: str,
) -> tuple[
    list[str],
    list[str],
    list[dict[str, str]],
    dict[str, float],
    list[str],
]:
    lowered = " ".join(text.lower().split())
    tube_terms = (
        "tubi", "tubo ", "tubes", "tube ", "pipes", "pipe ",
        "tubolare", "tubolari", "tubing",
    )
    hollow_terms = (
        "hollow section", "profilati cavi", "tubi quadri", "tubi rettangolari",
        "square tube", "rectangular tube",
    )
    has_tube = _has_any(lowered, tube_terms)
    if not has_tube:
        return [], [], [], {
            "producer": 0.0,
            "trader_distributor": 0.0,
            "processor_service_provider": 0.0,
            "end_user": 0.0,
        }, ["classification_no_tube_evidence"]

    producer_raw = _weighted_signal_score(lowered, (
        ("tubificio", 6.0),
        ("produttore di tubi", 6.0),
        ("produttori di tubi", 6.0),
        ("produzione di tubi", 5.0),
        ("produciamo tubi", 6.0),
        ("fabbricazione di tubi", 5.0),
        ("tube manufacturer", 6.0),
        ("manufacturer of tubes", 6.0),
        ("manufacturer of steel tubes", 7.0),
        ("manufactures steel tubes", 7.0),
        ("welded tube manufacturer", 7.0),
        ("seamless tube manufacturer", 7.0),
        ("welded pipe manufacturer", 7.0),
        ("seamless pipe manufacturer", 7.0),
        ("production of steel tubes", 6.0),
        ("produzione", 0.5),
        ("manufacturing", 0.5),
    ))
    trader_raw = _weighted_signal_score(lowered, (
        ("stockholder", 6.0),
        ("stockist", 6.0),
        ("distributore di tubi", 6.0),
        ("distribuzione di tubi", 5.0),
        ("tube distributor", 6.0),
        ("pipe distributor", 6.0),
        ("stock di tubi", 5.0),
        ("magazzino tubi", 4.0),
        ("ampio stock", 3.0),
        ("pronta consegna", 2.0),
        ("commercializzazione", 2.0),
        ("wholesale", 2.0),
    ))
    processor_raw = _weighted_signal_score(lowered, (
        ("lavorazione tubi", 6.0),
        ("lavorazioni tubi", 6.0),
        ("lavorazione tubo", 6.0),
        ("tube processing", 6.0),
        ("taglio laser tubo", 7.0),
        ("taglio laser tubi", 7.0),
        ("tube laser cutting", 7.0),
        ("piegatura tubi", 6.0),
        ("tube bending", 6.0),
        ("service center", 4.0),
        ("centro servizi", 4.0),
        ("carpenteria", 2.5),
        ("fabrication", 2.5),
        ("saldatura", 1.0),
        ("welding", 1.0),
    ))
    end_user_raw = _weighted_signal_score(lowered, (
        ("costruzione macchine", 5.0),
        ("machinery manufacturer", 5.0),
        ("industrial equipment manufacturer", 6.0),
        ("epc contractor", 5.0),
        ("impianti industriali", 3.0),
        ("oem", 3.0),
    ))

    role_thresholds = {
        "producer": 4.0,
        "trader_distributor": 4.0,
        "processor_service_provider": 4.0,
        "end_user": 5.0,
    }
    raw_scores = {
        "producer": producer_raw,
        "trader_distributor": trader_raw,
        "processor_service_provider": processor_raw,
        "end_user": end_user_raw,
    }
    scores = {
        role: round(min(raw / max(role_thresholds[role] * 1.75, 1.0), 1.0), 3)
        for role, raw in raw_scores.items()
    }

    roles = [
        role
        for role in (
            "producer",
            "trader_distributor",
            "processor_service_provider",
        )
        if raw_scores[role] >= role_thresholds[role]
    ]
    if not roles and end_user_raw >= role_thresholds["end_user"]:
        roles.append("end_user")

    quality_flags: list[str] = []
    if len(roles) >= 3:
        quality_flags.append("classification_multi_role")
    ranked = sorted(scores.values(), reverse=True)
    if len(ranked) >= 2 and ranked[0] > 0 and ranked[0] - ranked[1] < 0.12:
        quality_flags.append("classification_low_margin")
    if not roles:
        quality_flags.append("classification_insufficient_role_evidence")

    subtypes: list[str] = []
    if "producer" in roles:
        subtypes.append("tube_pipe_producer")
    if "trader_distributor" in roles:
        if _has_any(lowered, (
            "stockholder", "stockist", "stock di tubi", "magazzino tubi",
            "ampio stock", "pronta consegna",
        )):
            subtypes.append("stockholder")
        else:
            subtypes.append("distributor")
    if "processor_service_provider" in roles:
        if _has_any(lowered, ("service center", "centro servizi")):
            subtypes.append("steel_service_center")
        if _has_any(lowered, (
            "taglio laser", "laser cutting", "taglio tubo", "tube cutting", "cutting",
        )):
            subtypes.append("cutting_specialist")
        if _has_any(lowered, (
            "carpenteria", "fabrication", "saldatura", "welding",
            "piegatura", "bending",
        )):
            subtypes.append("fabricator")
    if "end_user" in roles:
        subtypes.append("mechanical_engineering")

    product_relations: list[dict[str, str]] = []
    if roles:
        for role in roles:
            relation = {
                "producer": "produces",
                "trader_distributor": "distributes",
                "processor_service_provider": "processes",
                "end_user": "uses",
            }[role]
            product_relations.append({
                "key": "tubes_pipes",
                "relationship_type": relation,
            })
            if _has_any(lowered, hollow_terms):
                product_relations.append({
                    "key": "hollow_sections",
                    "relationship_type": relation,
                })

    deduped_products: list[dict[str, str]] = []
    for item in product_relations:
        if item not in deduped_products:
            deduped_products.append(item)

    return roles, list(dict.fromkeys(subtypes)), deduped_products, scores, quality_flags

def extract_candidate(pages: list[CrawledPage], country_code: str) -> dict[str, object] | None:
    if not pages:
        return None
    domain = canonical_domain(pages[0].url)
    combined = "\n".join(page.text for page in pages)
    roles, subtypes, product_relations, classification_scores, class_flags = classify_company(combined)
    if not roles or not any(item["key"] == "tubes_pipes" for item in product_relations):
        return None

    legal_name, identity_quality, identity_flags = _candidate_identity(pages, domain)
    vat_id = _vat_id(combined)
    facility_candidates = _structured_facilities(pages, country_code)
    capability_keys, market_keys = _classify_enrichment(combined)
    description = next(
        (page.meta_description for page in pages if page.meta_description),
        None,
    )
    if not description:
        description = _redact_personal_channels(" ".join(combined.split()))[:600] or None
    else:
        description = _redact_personal_channels(description)

    quality_flags = list(dict.fromkeys(identity_flags + class_flags))
    identity_score = float(identity_quality.get("score", 0))
    role_score = max(classification_scores.values(), default=0.0)
    confidence = 0.28
    confidence += min(identity_score / 20.0, 0.28)
    confidence += role_score * 0.28
    confidence += 0.07 if vat_id else 0
    confidence += min(len(pages), MAX_PAGES_PER_DOMAIN) * 0.015
    confidence -= min(len(quality_flags), 4) * 0.025
    confidence = max(0.0, min(confidence, 0.98))

    evidence = []
    for page in pages:
        snippet = _redact_personal_channels(" ".join(page.text.split()))[:1200]
        evidence.append({
            "url": page.url,
            "title": page.title,
            "snippet": snippet,
        })

    return {
        "source_url": pages[0].url,
        "canonical_domain": domain,
        "website_url": pages[0].url,
        "legal_name": legal_name,
        "trading_name": None,
        "country_code": country_code,
        "vat_id": vat_id,
        "registration_id": None,
        "description": description,
        "role_keys": roles,
        "subtype_keys": subtypes,
        "product_relations": product_relations,
        "evidence": evidence,
        "source_urls": [page.url for page in pages],
        "confidence": round(confidence, 4),
        "extraction_version": EXTRACTION_VERSION,
        "identity_quality": identity_quality,
        "classification_scores": classification_scores,
        "quality_flags": quality_flags,
        "facility_candidates": facility_candidates,
        "capability_keys": capability_keys,
        "market_keys": market_keys,
        "enrichment_quality": {
            "structured_facility_count": len(facility_candidates),
            "capability_count": len(capability_keys),
            "market_count": len(market_keys),
            "facility_extraction": "json_ld_postal_address_only",
        },
    }


class CompanyDiscoveryService:
    def __init__(self) -> None:
        self.repo = WorkerRepository()

    async def _run(self, run_id: UUID) -> dict[str, object]:
        rows = await self.repo._request(
            "GET",
            f"/rest/v1/network_company_discovery_runs?id=eq.{run_id}&select=*",
        )
        if not isinstance(rows, list) or not rows:
            raise CompanyDiscoveryError("Discovery run not found.")
        return rows[0]

    async def _mark_run(self, run_id: UUID, values: dict[str, object]) -> None:
        await self.repo._request(
            "PATCH",
            f"/rest/v1/network_company_discovery_runs?id=eq.{run_id}",
            json=values,
            prefer="return=minimal",
        )

    async def _existing_match(self, candidate: dict[str, object]) -> tuple[str | None, list[str]]:
        domain = str(candidate["canonical_domain"])
        country = str(candidate["country_code"])
        legal_name = " ".join(str(candidate["legal_name"]).lower().split())
        vat_id = candidate.get("vat_id")

        filters: list[tuple[str, str]] = [
            (
                "website_domain_exact",
                f"website_domain=ilike.{quote(domain, safe='')}",
            ),
            (
                "country_normalized_legal_name_exact",
                f"country_code=eq.{quote(country, safe='')}"
                f"&normalized_legal_name=eq.{quote(legal_name, safe='')}",
            ),
        ]
        if vat_id:
            filters.append((
                "country_vat_exact",
                f"country_code=eq.{quote(country, safe='')}"
                f"&vat_id=eq.{quote(str(vat_id), safe='')}",
            ))

        for signal, filter_value in filters:
            rows = await self.repo._request(
                "GET",
                "/rest/v1/network_companies"
                f"?{filter_value}&publication_status=neq.archived"
                "&select=id,website_domain,vat_id,normalized_legal_name,country_code&limit=1",
            )
            if isinstance(rows, list) and rows:
                return str(rows[0]["id"]), [signal]
        return None, []

    async def claim_next(self) -> dict[str, object] | None:
        payload = await self.repo._request(
            "POST",
            "/rest/v1/rpc/p3_claim_next_company_discovery",
            json={},
        )
        if payload is None:
            return None
        if not isinstance(payload, dict):
            raise CompanyDiscoveryError("Discovery queue claim returned an invalid payload.")
        return payload

    async def _stage_candidate(
        self,
        run_id: UUID,
        candidate: dict[str, object],
    ) -> tuple[str | None, list[str]]:
        match_company_id, match_signals = await self._existing_match(candidate)
        payload = {
            "run_id": str(run_id),
            **candidate,
            "match_company_id": match_company_id,
            "match_signals": match_signals,
            "review_status": "pending_review",
        }
        await self.repo._request(
            "POST",
            "/rest/v1/network_company_discovery_candidates?on_conflict=run_id,canonical_domain",
            json=payload,
            prefer="resolution=merge-duplicates,return=minimal",
        )
        return match_company_id, match_signals

    async def crawl(
        self,
        run_id: UUID,
        *,
        already_claimed: bool = False,
    ) -> DiscoveryCrawlResponse:
        run = await self._run(run_id)
        allowed = {"running"} if already_claimed else {"queued", "failed"}
        if run.get("status") not in allowed:
            raise CompanyDiscoveryError("Discovery run is not crawlable from its current state.")

        seeds = run.get("seed_urls")
        if not isinstance(seeds, list) or not seeds:
            raise CompanyDiscoveryError("Discovery run has no seed URLs.")
        country_code = str(run.get("country_code") or "IT").upper()

        if not already_claimed:
            await self._mark_run(run_id, {
                "status": "running",
                "started_at": datetime.now(UTC).isoformat(),
                "completed_at": None,
                "error": None,
            })

        candidate_count = 0
        skipped_count = 0
        error_count = 0
        exact_match_count = 0
        quality_flag_count = 0
        role_counts: dict[str, int] = {}
        facility_candidate_count = 0
        capability_proposal_count = 0
        market_proposal_count = 0
        errors: list[str] = []

        timeout = httpx.Timeout(REQUEST_TIMEOUT_SECONDS)
        async with httpx.AsyncClient(timeout=timeout) as client:
            for raw_seed in seeds:
                try:
                    seed = canonicalize_seed_url(str(raw_seed))
                    home = await _fetch_page(client, seed, seed)
                    if home is None:
                        skipped_count += 1
                        continue
                    pages = [home]
                    for link in _priority_links(home):
                        page = await _fetch_page(client, link, home.url)
                        if page is not None:
                            pages.append(page)
                    candidate = extract_candidate(pages[:MAX_PAGES_PER_DOMAIN], country_code)
                    if candidate is None:
                        skipped_count += 1
                        continue
                    match_company_id, match_signals = await self._stage_candidate(run_id, candidate)
                    candidate_count += 1
                    if match_company_id and any(
                        signal in {"website_domain_exact", "country_vat_exact"}
                        for signal in match_signals
                    ):
                        exact_match_count += 1
                    quality_flag_count += len(candidate.get("quality_flags", []))
                    for role in candidate.get("role_keys", []):
                        role_counts[str(role)] = role_counts.get(str(role), 0) + 1
                    facility_candidate_count += len(candidate.get("facility_candidates", []))
                    capability_proposal_count += len(candidate.get("capability_keys", []))
                    market_proposal_count += len(candidate.get("market_keys", []))
                except (CompanyDiscoveryError, httpx.HTTPError, RepositoryError, ValueError) as exc:
                    error_count += 1
                    errors.append(f"{str(raw_seed)[:160]}: {str(exc)[:300]}")

        status = "completed" if candidate_count or not error_count else "failed"
        await self._mark_run(run_id, {
            "status": status,
            "candidate_count": candidate_count,
            "skipped_count": skipped_count,
            "error_count": error_count,
            "exact_match_count": exact_match_count,
            "extraction_version": EXTRACTION_VERSION,
            "stats": {
                "seed_count": len(seeds),
                "candidate_count": candidate_count,
                "skipped_count": skipped_count,
                "error_count": error_count,
                "exact_match_count": exact_match_count,
                "quality_flag_count": quality_flag_count,
                "facility_candidate_count": facility_candidate_count,
                "capability_proposal_count": capability_proposal_count,
                "market_proposal_count": market_proposal_count,
                "role_counts": role_counts,
            },
            "completed_at": datetime.now(UTC).isoformat(),
            "error": "\n".join(errors)[:4000] or None,
        })

        return DiscoveryCrawlResponse(
            run_id=run_id,
            status=status,
            candidate_count=candidate_count,
            skipped_count=skipped_count,
            error_count=error_count,
        )


async def _crawl_background(run_id: UUID) -> None:
    try:
        await CompanyDiscoveryService().crawl(run_id)
    except (
        CompanyDiscoveryError,
        RepositoryConfigurationError,
        RepositoryError,
        httpx.HTTPError,
        ValueError,
    ) as exc:
        try:
            service = CompanyDiscoveryService()
            run = await service._run(run_id)
            if run.get("status") in {"queued", "running"}:
                await service._mark_run(
                    run_id,
                    {
                        "status": "failed",
                        "started_at": run.get("started_at") or datetime.now(UTC).isoformat(),
                        "completed_at": datetime.now(UTC).isoformat(),
                        "error": str(exc)[:4000],
                    },
                )
        except (CompanyDiscoveryError, RepositoryConfigurationError, RepositoryError):
            pass




def company_discovery_poller_enabled() -> bool:
    if os.getenv("WORKER_STORAGE_MODE", "supabase") == "memory":
        return False
    return os.getenv("COMPANY_DISCOVERY_ENABLED", "true").lower() not in {
        "0",
        "false",
        "no",
    }


async def _company_discovery_queue_loop() -> None:
    raw_poll = os.getenv("COMPANY_DISCOVERY_POLL_SECONDS", "10").strip()
    try:
        poll_seconds = min(max(int(raw_poll), 5), 300)
    except ValueError:
        poll_seconds = 10

    while True:
        claimed_run_id: UUID | None = None
        service: CompanyDiscoveryService | None = None
        try:
            service = CompanyDiscoveryService()
            claimed = await service.claim_next()
            if claimed is None:
                await asyncio.sleep(poll_seconds)
                continue

            claimed_run_id = UUID(str(claimed["run_id"]))
            result = await service.crawl(claimed_run_id, already_claimed=True)
            logger.info("Company discovery run completed: %s", result.model_dump())
        except asyncio.CancelledError:
            raise
        except (
            CompanyDiscoveryError,
            RepositoryConfigurationError,
            RepositoryError,
            httpx.HTTPError,
            ValueError,
            KeyError,
        ) as exc:
            if service is not None and claimed_run_id is not None:
                try:
                    await service._mark_run(
                        claimed_run_id,
                        {
                            "status": "failed",
                            "completed_at": datetime.now(UTC).isoformat(),
                            "error": str(exc)[:4000],
                        },
                    )
                except (RepositoryConfigurationError, RepositoryError):
                    pass
            logger.warning("Company discovery queue pass failed; it will retry: %s", exc)
            await asyncio.sleep(poll_seconds)


def install_company_discovery_poller(app: FastAPI) -> None:
    if getattr(app.state, "company_discovery_poller_installed", False):
        return
    app.state.company_discovery_poller_installed = True

    @app.on_event("startup")
    async def start_company_discovery_poller() -> None:
        if not company_discovery_poller_enabled():
            return
        app.state.company_discovery_task = asyncio.create_task(
            _company_discovery_queue_loop()
        )

    @app.on_event("shutdown")
    async def stop_company_discovery_poller() -> None:
        task = getattr(app.state, "company_discovery_task", None)
        if task is None:
            return
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


@router.post(
    "/crawl",
    response_model=DiscoveryCrawlResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def crawl_company_discovery(
    background_tasks: BackgroundTasks,
    request: DiscoveryCrawlRequest,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> DiscoveryCrawlResponse:
    _require_worker_token(x_worker_token)
    try:
        run = await CompanyDiscoveryService()._run(request.run_id)
        if run.get("status") not in {"queued", "failed"}:
            raise CompanyDiscoveryError("Discovery run is not crawlable from its current state.")
        background_tasks.add_task(_crawl_background, request.run_id)
        return DiscoveryCrawlResponse(
            run_id=request.run_id,
            status="queued",
            candidate_count=0,
            skipped_count=0,
            error_count=0,
        )
    except (
        CompanyDiscoveryError,
        RepositoryConfigurationError,
        RepositoryError,
        httpx.HTTPError,
        ValueError,
    ) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
