"""B3.B — governed Italian industrial lead discovery from EU CORDIS CSV.

Source: European Commission CORDIS Horizon Europe public dataset, CC BY 4.0
(https://cordis.europa.eu/about/legal). This job REFUSES to download anything
unless the pre-existing CORDIS registry entry has been independently approved
and enabled by a named Platform Owner. Source approval is never automated.

Extract only official site URLs of Italian private companies with a technical
sector keyword. All other fields remain in memory and are not retained,
especially personal contacts. Websites are UNVERIFIED pointers handed to
SEED1 -> AUTO2 -> AUTO3, never a published company.
"""
from __future__ import annotations

import asyncio
import csv
import io
import json
import re
import tempfile
import zipfile
from urllib.parse import urlsplit

import httpx

from .company_discovery import (
    canonical_domain, canonicalize_seed_url, CompanyDiscoveryError
)
from .github_actions_crawler import credentials_from_environment
from .net_it_seed1_pipeline import BLOCKED_HOSTS

DOWNLOAD_URL = "https://cordis.europa.eu/data/cordis-HORIZONprojects-csv.zip"
MAX_ZIP_BYTES = 200_000_000
MAX_ORG_CSV_BYTES = 850_000_000
MAX_RAW_RECORDS = 700_000
MAX_ITEMS = 100
SOURCE = "cordis-horizon-organisations"
KEYWORDS = re.compile(
    r"accia|steel|metall|meccan|mechanic|carpenter|tubif|tubol|tubi\b|"
    r"pipe|profilat|lamier|siderurg|weld|saldatur|officin|machin|"
    r"metalwork|fabricat|fonder|foundr|forge|fucin|stampagg|"
    r"automat|robotic|precision|industrial engineering",
    re.I,
)
# Explicit *source-locality hints*, not verified region assignments.
PIEMONTE_CAPITALS = frozenset(
    {"torino", "turin", "novara", "cuneo", "alessandria", "asti",
     "vercelli", "biella", "verbania"}
)
OTHER_INDUSTRIAL_CAPITALS = frozenset({
    "milano", "milan", "brescia", "bergamo", "monza", "varese", "lecco",
    "como", "pavia", "vicenza", "verona", "treviso", "padova",
    "modena", "parma", "piacenza", "bologna", "reggio emilia", "genova",
    "trieste", "udine", "pordenone", "firenze", "prato", "pisa",
    "arezzo", "ancona", "pesaro", "terni", "roma", "napoli", "bari",
    "taranto", "palermo", "catania", "cagliari",
})
EXCLUDED = frozenset({
    "linkedin.com", "facebook.com", "youtube.com", "instagram.com",
    "wikipedia.org", "cordis.europa.eu", "europa.eu", "google.com",
    "researchgate.net", "unibo.it", "polimi.it", "polito.it",
})
DOMAIN_PATTERN = re.compile(
    r"^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?[.][a-z]{2,24}$"
)
NUMERIC_ID = re.compile(r"^[0-9]{1,20}$")
PROJECT_ID = re.compile(r"^[0-9]{4,14}$")


def column_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(name).lower())


def choose_columns(header: list[str]) -> dict[str, str]:
    by_key = {column_key(name): name for name in header}
    aliases = {
        "country": ("country",),
        "activity": ("activitytype",),
        "website": ("organizationurl", "organisationurl"),
        "name": ("name",),
        "organization_id": ("organizationid", "organisationid"),
        "project_id": ("projectid",),
        "city": ("city",),
    }
    selected = {}
    for key, keys in aliases.items():
        selected[key] = next((by_key[alias] for alias in keys if alias in by_key), "")
    if any(not value for value in selected.values()):
        raise ValueError("CORDIS organization.csv has an unsupported field schema")
    return selected


def canonical_website(raw: str) -> tuple[str, str] | None:
    try:
        url = canonicalize_seed_url(raw.strip())
        parts = urlsplit(url)
        domain = canonical_domain(url)
    except (CompanyDiscoveryError, ValueError, TypeError):
        return None
    if (parts.scheme not in ("http", "https")
            or parts.username or parts.password
            or parts.port is not None
            or not DOMAIN_PATTERN.fullmatch(domain)
            or domain.startswith("www.") or ".." in domain
            or any(domain == v or domain.endswith("." + v)
                   for v in EXCLUDED | BLOCKED_HOSTS)):
        return None
    return domain, "https://" + domain + "/"


def parse_organisations(
    csv_data: io.TextIOBase, *, offset: int, limit: int
) -> tuple[list[dict[str, str]], dict[str, int | bool]]:
    """Parse CORDIS private-for-profit companies; no names retained.

    Stable order: CORDIS ZIP order. Offset counts eligible distinct domains, so
    paging traverses a large dataset even when a batch is all duplicates.
    Source city only drives an in-memory prioritization: NOT a location proof.
    """
    if (type(offset) is not int or not 0 <= offset <= 1_000_000
            or type(limit) is not int or not 1 <= limit <= MAX_ITEMS):
        raise ValueError("Unbounded CORDIS pagination")
    # CORDIS CSV exports may be semicolon- or comma-delimited.
    reader_sample = csv_data.read(8192)
    csv_data.seek(0)
    delimiter = ";" if reader_sample.count(";") > reader_sample.count(",") else ","
    reader = csv.DictReader(csv_data, delimiter=delimiter)
    if not reader.fieldnames or len(reader.fieldnames) > 200:
        raise ValueError("Unsupported CORDIS header")
    cols = choose_columns(reader.fieldnames)
    seen: set[str] = set()
    matches: list[tuple[int, str, dict[str, str]]] = []
    raw = 0
    for row in reader:
        raw += 1
        if raw > MAX_RAW_RECORDS:
            raise ValueError("CORDIS dataset exceeded source row budget")
        if not isinstance(row, dict):
            continue
        if str(row.get(cols["country"]) or "").strip().upper() not in ("IT", "ITALY"):
            continue
        if str(row.get(cols["activity"]) or "").strip().upper() not in (
                "PRC", "PRIVATE FOR PROFIT", "PRIVATE FOR-PROFIT"):
            continue
        company_name = str(row.get(cols["name"]) or "")[:300]
        if not KEYWORDS.search(company_name):
            continue
        domain_data = canonical_website(str(row.get(cols["website"]) or ""))
        if not domain_data:
            continue
        domain, home = domain_data
        organisation = str(row.get(cols["organization_id"]) or "").strip()
        project = str(row.get(cols["project_id"]) or "").strip()
        if not NUMERIC_ID.fullmatch(organisation) or not PROJECT_ID.fullmatch(project):
            continue
        if domain in seen:
            continue
        seen.add(domain)
        city = str(row.get(cols["city"]) or "").strip().casefold()
        # Ranking only; do not send source city or role to the persistence API.
        geography_rank = (
            0 if city in PIEMONTE_CAPITALS else
            1 if city in OTHER_INDUSTRIAL_CAPITALS else 2
        )
        sector_rank = 0 if re.search(
            r"accia|steel|siderurg|tubif|pipe|carpenter|metal|lamier", company_name, re.I
        ) else 1
        record = {
            "domain": domain, "homepage": home,
            "organization_id": organisation, "project_id": project,
        }
        matches.append((geography_rank * 2 + sector_rank, domain, record))
    matches.sort(key=lambda entry: (entry[0], entry[1]))
    page = [entry[2] for entry in matches[offset:offset + limit]]
    return page, {
        "raw_rows": raw, "eligible_distinct_domains": len(matches),
        "exhausted": offset + len(page) >= len(matches),
    }


async def download_archive(web: httpx.AsyncClient) -> tempfile.SpooledTemporaryFile:
    """Fixed official host, bounded ZIP, no cross-origin redirects / extraction."""
    result = tempfile.SpooledTemporaryFile(max_size=16_000_000)
    size = 0
    try:
        async with web.stream(
            "GET", DOWNLOAD_URL,
            headers={"User-Agent": "SmartSteelSales-CORDISIndustrialDiscovery/1.0",
                     "Accept": "application/zip,application/octet-stream"},
            follow_redirects=False,
        ) as response:
            if response.status_code != 200:
                raise RuntimeError(
                    f"CORDIS official archive unavailable HTTP {response.status_code}"
                )
            async for chunk in response.aiter_bytes():
                size += len(chunk)
                if size > MAX_ZIP_BYTES:
                    raise ValueError("CORDIS ZIP larger than approved limit")
                result.write(chunk)
        result.seek(0)
        if result.read(4) != b"PK\x03\x04":
            raise ValueError("Source did not return a ZIP dataset")
        result.seek(0)
        return result
    except BaseException:
        result.close()
        raise


def parse_archive(
    archive: tempfile.SpooledTemporaryFile, *, offset: int, limit: int
) -> tuple[list[dict[str, str]], dict[str, int | bool]]:
    with zipfile.ZipFile(archive) as z:
        matching = [
            item for item in z.infolist()
            if item.filename.rsplit("/", 1)[-1].lower() == "organization.csv"
        ]
        if len(matching) != 1:
            raise ValueError("Expected one CORDIS organization.csv")
        info = matching[0]
        if (info.file_size > MAX_ORG_CSV_BYTES
                or info.file_size <= 0 or info.compress_size <= 0
                or info.file_size > info.compress_size * 120):
            raise ValueError("Suspicious CORDIS organisation archive")
        with z.open(info) as f:
            # csv.DictReader requires seeking, so a bounded single-member
            # decompression is used. Only organization.csv is ever read.
            content = f.read(MAX_ORG_CSV_BYTES + 1)
            if len(content) > MAX_ORG_CSV_BYTES:
                raise ValueError("CORDIS organization CSV exceeds budget")
            text = content.decode("utf-8-sig")
        return parse_organisations(
            io.StringIO(text), offset=offset, limit=limit
        )


async def call_rpc(
    api: httpx.AsyncClient, url: str, key: str, rpc_name: str, args: dict
) -> dict:
    if rpc_name not in (
        "net_it_growthb3b_claim_daily", "net_it_growthb3b_commit_daily"
    ):
        raise ValueError("Unapproved B3.B RPC")
    response = await api.post(
        url + "/rest/v1/rpc/" + rpc_name,
        headers={"apikey": key, "Content-Type": "application/json",
                 "Accept": "application/json",
                 "User-Agent": "SmartSteelSales-CORDISIndustrialDiscovery/1.0"},
        json=args
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"B3.B RPC {rpc_name} failed HTTP {response.status_code}"
        )
    body = response.json()
    if not isinstance(body, dict):
        raise ValueError("Unexpected B3.B source contract")
    return body


async def main() -> dict:
    url, key = credentials_from_environment()
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(20), follow_redirects=False
    ) as api:
        claim = await call_rpc(api, url, key, "net_it_growthb3b_claim_daily", {})
        if claim.get("contract") != "net-it-growthb3b-v1":
            raise RuntimeError("Unknown B3.B claim contract")
        if claim.get("eligible") is not True:
            report = {
                "status": "skipped", "reason": claim.get("reason", "disabled"),
                "net_new_to_network": 0, "published": 0,
            }
            print(json.dumps(report, sort_keys=True))
            return report
        if (claim.get("source") != SOURCE
                or claim.get("download_url") != DOWNLOAD_URL
                or type(claim.get("offset")) is not int
                or type(claim.get("limit")) is not int
                or not 1 <= claim["limit"] <= MAX_ITEMS):
            raise RuntimeError("Unapproved CORDIS endpoint or volume")
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(90), follow_redirects=False
        ) as web:
            zipped = await download_archive(web)
        try:
            items, metrics = parse_archive(
                zipped, offset=claim["offset"], limit=claim["limit"]
            )
        finally:
            zipped.close()
        saved = await call_rpc(
            api, url, key, "net_it_growthb3b_commit_daily", {
                "p_run_id": claim["run_id"], "p_items": items,
                "p_raw_rows": metrics["raw_rows"],
                "p_exhausted": metrics["exhausted"],
            }
        )
        if (saved.get("contract") != "net-it-growthb3b-v1"
                or saved.get("status") != "completed"
                or saved.get("published") != 0):
            raise RuntimeError("Unexpected CORDIS persistence result")
        result = {
            "status": "completed", "source": SOURCE,
            "raw_rows": metrics["raw_rows"],
            "eligible_distinct_domains": metrics["eligible_distinct_domains"],
            "batch": len(items),
            "net_new_to_network": saved.get("net_new_to_network", 0),
            "duplicate_or_rejected": saved.get("duplicate_or_rejected", 0),
            "published": 0,
        }
        print(json.dumps(result, sort_keys=True))
        return result


if __name__ == "__main__":
    asyncio.run(main())
