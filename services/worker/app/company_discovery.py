from __future__ import annotations

import asyncio
import ipaddress
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

    def result(self, url: str) -> CrawledPage:
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
        )


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
    parser = _PublicHTMLParser()
    parser.feed(response.text)
    return parser.result(final_url)


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


def _candidate_name(pages: list[CrawledPage], domain: str) -> str:
    combined = "\n".join(page.text[:12000] for page in pages)
    legal_matches = [match.group(1).strip(" -|,.;") for match in LEGAL_SUFFIX_RE.finditer(combined)]
    if legal_matches:
        legal_matches.sort(key=lambda value: (len(value) > 100, len(value)))
        return legal_matches[0][:255]

    for page in pages:
        for value in (page.site_name, page.h1, page.title):
            if not value:
                continue
            candidate = re.split(r"\s+[|–—]\s+|\s+-\s+", value, maxsplit=1)[0].strip()
            if 2 < len(candidate) <= 120:
                return candidate
    return domain.split(".")[0].replace("-", " ").title()[:255]


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


def classify_company(text: str) -> tuple[list[str], list[str], list[dict[str, str]]]:
    lowered = " ".join(text.lower().split())
    tube_terms = ("tubi", "tubo ", "tubes", "tube ", "pipes", "pipe ", "tubolare", "tubolari")
    hollow_terms = ("hollow section", "profilati cavi", "tubi quadri", "tubi rettangolari", "square tube", "rectangular tube")

    producer = _has_any(lowered, (
        "produzione", "produttore", "manufacturer", "manufacturing", "tubificio",
        "produciamo", "production of", "welded tube", "welded pipe", "seamless tube", "seamless pipe",
    ))
    trader = _has_any(lowered, (
        "distributore", "distribuzione", "commercializzazione", "stockholder", "stockist",
        "stock di", "ampio stock", "magazzino", "pronta consegna", "distributor", "wholesale",
    ))
    processor = _has_any(lowered, (
        "service center", "centro servizi", "taglio laser", "laser cutting", "taglio tubo",
        "lavorazione tubo", "lavorazioni tubi", "tube processing", "piegatura", "bending",
        "saldatura", "welding", "carpenteria", "fabrication", "lavorazioni meccaniche",
    ))
    end_user = _has_any(lowered, (
        "oem", "epc contractor", "costruzione macchine", "machinery manufacturer",
        "impianti industriali", "industrial equipment manufacturer",
    )) and not (producer or trader or processor)

    roles: list[str] = []
    if producer:
        roles.append("producer")
    if trader:
        roles.append("trader_distributor")
    if processor:
        roles.append("processor_service_provider")
    if end_user:
        roles.append("end_user")
    subtypes: list[str] = []
    if producer and _has_any(lowered, tube_terms):
        subtypes.append("tube_pipe_producer")
    if trader:
        if _has_any(lowered, ("stockholder", "stockist", "stock di", "ampio stock", "magazzino", "pronta consegna")):
            subtypes.append("stockholder")
        else:
            subtypes.append("distributor")
    if processor:
        if _has_any(lowered, ("service center", "centro servizi")):
            subtypes.append("steel_service_center")
        if _has_any(lowered, ("taglio laser", "laser cutting", "taglio tubo", "cutting")):
            subtypes.append("cutting_specialist")
        if _has_any(lowered, ("carpenteria", "fabrication", "saldatura", "welding", "piegatura", "bending")):
            subtypes.append("fabricator")
    if end_user:
        subtypes.append("mechanical_engineering")

    product_relations: list[dict[str, str]] = []
    if _has_any(lowered, tube_terms):
        for role in roles:
            relation = {
                "producer": "produces",
                "trader_distributor": "distributes",
                "processor_service_provider": "processes",
                "end_user": "uses",
            }[role]
            item = {"key": "tubes_pipes", "relationship_type": relation}
            if item not in product_relations:
                product_relations.append(item)
    if _has_any(lowered, hollow_terms):
        for role in roles:
            relation = {
                "producer": "produces",
                "trader_distributor": "distributes",
                "processor_service_provider": "processes",
                "end_user": "uses",
            }[role]
            item = {"key": "hollow_sections", "relationship_type": relation}
            if item not in product_relations:
                product_relations.append(item)

    return roles, list(dict.fromkeys(subtypes)), product_relations


def extract_candidate(pages: list[CrawledPage], country_code: str) -> dict[str, object] | None:
    if not pages:
        return None
    domain = canonical_domain(pages[0].url)
    combined = "\n".join(page.text for page in pages)
    roles, subtypes, product_relations = classify_company(combined)
    if not roles or not any(item["key"] == "tubes_pipes" for item in product_relations):
        return None

    legal_name = _candidate_name(pages, domain)
    vat_id = _vat_id(combined)
    description = next(
        (page.meta_description for page in pages if page.meta_description),
        None,
    )
    if not description:
        description = _redact_personal_channels(" ".join(combined.split()))[:600] or None
    elif description:
        description = _redact_personal_channels(description)

    confidence = 0.45
    confidence += 0.15 if roles else 0
    confidence += 0.15 if product_relations else 0
    confidence += 0.08 if LEGAL_SUFFIX_RE.search(legal_name) else 0
    confidence += 0.05 if vat_id else 0
    confidence += min(len(pages), MAX_PAGES_PER_DOMAIN) * 0.02
    confidence = min(confidence, 0.98)

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

        filters = [
            f"website_domain=ilike.{quote(domain, safe='')}",
            f"and=(country_code.eq.{quote(country)},normalized_legal_name.eq.{quote(legal_name, safe='')})",
        ]
        if vat_id:
            filters.append(f"and=(country_code.eq.{quote(country)},vat_id.eq.{quote(str(vat_id), safe='')})")

        for index, filter_value in enumerate(filters):
            rows = await self.repo._request(
                "GET",
                "/rest/v1/network_companies"
                f"?{filter_value}&publication_status=neq.archived"
                "&select=id,website_domain,vat_id,normalized_legal_name,country_code&limit=1",
            )
            if isinstance(rows, list) and rows:
                signal = (
                    "website_domain_exact"
                    if index == 0
                    else "country_normalized_legal_name_exact"
                    if index == 1
                    else "country_vat_exact"
                )
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

    async def _stage_candidate(self, run_id: UUID, candidate: dict[str, object]) -> None:
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
                    await self._stage_candidate(run_id, candidate)
                    candidate_count += 1
                except (CompanyDiscoveryError, httpx.HTTPError, RepositoryError, ValueError) as exc:
                    error_count += 1
                    errors.append(f"{str(raw_seed)[:160]}: {str(exc)[:300]}")

        status = "completed" if candidate_count or not error_count else "failed"
        await self._mark_run(run_id, {
            "status": status,
            "candidate_count": candidate_count,
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
