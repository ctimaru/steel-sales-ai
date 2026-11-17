"""B1 — Producer-authorised catalogue intake; no web fetch or automatic publishing.

Trust boundary: grant_lookup MUST resolve an independently verified, server-side
grant. Never pass rights assertions taken from the uploaded catalogue itself.
PDF is registered by digest only; a separately sandboxed/authorised extractor
must be added before PDFs can produce technical candidates.
"""
from __future__ import annotations

import csv
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import io
import re
from urllib.parse import urlsplit
from uuid import UUID

CSV_LIMIT = 2 * 1024 * 1024
PDF_LIMIT = 12 * 1024 * 1024
ROW_LIMIT = 500
HEX_SHA = re.compile(r"^[0-9a-f]{64}$")
STANDARD = re.compile(r"^EN\s*10(?:219|210)(?:-[12])?$", re.I)
GRADE = re.compile(r"^S(?:235|275|355|420|460)(?:JR|J0|J2|M|ML|N|NL)?H$", re.I)
NUMBER = r"(?:\d{2,4})(?:[.,]\d+)?"
WALL = r"(?:\d{1,2})(?:[.,]\d+)?"
RECT = re.compile(rf"^({NUMBER})\s*[x×]\s*({NUMBER})\s*[x×]\s*({WALL})$", re.I)
ROUND = re.compile(rf"^(?:Ø|OD\s*)({NUMBER})\s*[x×]\s*({WALL})$", re.I)
REQUIRED_COLUMNS = ("standard", "grade", "shape", "dimensions_mm")
REQUIRED_RIGHTS = frozenset(("extract", "store_derived", "use_in_producer_search"))


class CatalogueRejected(ValueError):
    """Fail-closed intake: no persistence or inferred technical capability."""


def _uuid(value: object) -> str:
    try:
        return str(UUID(str(value)))
    except (ValueError, TypeError, AttributeError) as exc:
        raise CatalogueRejected("Invalid company or catalogue ID") from exc


def _date(value: object) -> datetime:
    if not isinstance(value, str):
        raise CatalogueRejected("Missing verified rights timestamp")
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise CatalogueRejected("Invalid rights timestamp") from exc
    if result.tzinfo is None:
        raise CatalogueRejected("Rights timestamp must be timezone-aware")
    return result.astimezone(timezone.utc)


def _url(value: object) -> str:
    if not isinstance(value, str) or len(value) > 1200:
        raise CatalogueRejected("Invalid source URL")
    try:
        p = urlsplit(value)
        if (p.scheme != "https" or not p.hostname or p.username or p.password
                or p.port not in (None, 443) or p.fragment
                or not p.path.startswith("/") or any(c.isspace() for c in value)):
            raise CatalogueRejected("Only an exact HTTPS official source is accepted")
        return value
    except ValueError as exc:
        raise CatalogueRejected("Invalid HTTPS source") from exc


def _dimensions(shape: str, text: str) -> list[float] | None:
    match = ROUND.fullmatch(text) if shape == "CHS" else RECT.fullmatch(text)
    if not match:
        return None
    try:
        values = [Decimal(v.replace(",", ".")) for v in match.groups()]
    except InvalidOperation:
        return None
    if any(not v.is_finite() or v <= 0 for v in values):
        return None
    wall = values[-1]
    min_section = min(values[:-1])
    if wall >= min_section / 2:
        return None
    if shape == "SHS" and values[0] != values[1]:
        return None
    if shape == "RHS" and values[0] == values[1]:
        return None
    return [float(v) for v in values]


def _candidate(row: dict, line: int, manifest: dict, actual_sha: str) -> dict | None:
    if any(not isinstance(row.get(key), str) for key in REQUIRED_COLUMNS):
        return None
    norm = " ".join(row["standard"].upper().split())
    grade = row["grade"].strip().upper()
    shape = row["shape"].strip().upper()
    if not STANDARD.fullmatch(norm) or not GRADE.fullmatch(grade):
        return None
    if shape not in ("CHS", "SHS", "RHS"):
        return None
    dimensions = _dimensions(shape, row["dimensions_mm"].strip())
    if dimensions is None:
        return None
    return {
        "company_id": _uuid(manifest["company_id"]),
        "catalog_id": _uuid(manifest["catalog_id"]),
        "document_sha256": actual_sha,
        "source_url": manifest["source_url"],
        "edition": manifest["edition"],
        "source_locator": f"csv_row:{line}",
        "standard": norm.replace(" ", ""),
        "grade": grade,
        "shape": shape,
        "dimensions_mm": dimensions,
        "evidence_status": "pending_verification",
        "interpretation": "licensed_source_row_candidate",
    }


def inspect_authorised_catalogue(
    manifest: dict, content: bytes, *, grant_lookup, now: datetime | None = None
) -> dict:
    """Offline, no-write first gate; grant_lookup is a SERVER-TRUSTED resolver.

    No right is created by a field in the uploaded manifest. A separately
    verified grant must match company, catalog, exact URL and document SHA,
    contain extraction/derivation/search rights and remain active.
    """
    if not isinstance(manifest, dict) or not isinstance(content, bytes):
        raise CatalogueRejected("Invalid catalogue input")
    company_id = _uuid(manifest.get("company_id"))
    catalog_id = _uuid(manifest.get("catalog_id"))
    source_url = _url(manifest.get("source_url"))
    edition = manifest.get("edition")
    if not isinstance(edition, str) or not 1 <= len(edition) <= 80:
        raise CatalogueRejected("Missing catalogue edition")
    media = manifest.get("format")
    if media not in ("csv", "pdf"):
        raise CatalogueRejected("Unsupported catalogue format")
    if len(content) == 0 or len(content) > (CSV_LIMIT if media == "csv" else PDF_LIMIT):
        raise CatalogueRejected("Document size outside bounded intake")
    actual_sha = hashlib.sha256(content).hexdigest()
    if manifest.get("sha256") != actual_sha or not HEX_SHA.fullmatch(actual_sha):
        raise CatalogueRejected("Document hash mismatch")
    if not callable(grant_lookup):
        raise CatalogueRejected("Trusted grant resolver required")
    grant = grant_lookup(company_id, catalog_id)
    if not isinstance(grant, dict):
        raise CatalogueRejected("No independently verified grant")
    if (_uuid(grant.get("company_id")) != company_id
            or _uuid(grant.get("catalog_id")) != catalog_id
            or _url(grant.get("source_url")) != source_url
            or grant.get("sha256") != actual_sha
            or grant.get("status") != "approved"
            or grant.get("revoked_at") is not None
            or not isinstance(grant.get("rights"), (list, tuple, set, frozenset))
            or not REQUIRED_RIGHTS.issubset(set(grant["rights"]))):
        raise CatalogueRejected("No matching active document-level rights")
    reference_time = now or datetime.now(timezone.utc)
    if reference_time.tzinfo is None:
        raise CatalogueRejected("Current time must include a timezone")
    if not (_date(grant.get("verified_at")) <= reference_time.astimezone(timezone.utc)
            < _date(grant.get("expires_at"))):
        raise CatalogueRejected("Document rights are not currently valid")
    result = {
        "contract": "netproducers-catalog-b1-v1",
        "company_id": company_id,
        "catalog_id": catalog_id,
        "document_sha256": actual_sha,
        "mode": "no_write_private_intake",
        "format": media,
        "status": "licensed_pdf_registered_not_extracted" if media == "pdf" else "csv_parsed",
        "candidates": [],
        "rejected_rows": 0,
        "db_writes": 0,
        "published_claims": 0,
    }
    if media == "pdf":
        if not content.startswith(b"%PDF-"):
            raise CatalogueRejected("Invalid PDF signature")
        return result
    try:
        text = content.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text, newline=""), strict=True)
        if (not reader.fieldnames or len(reader.fieldnames) != len(set(reader.fieldnames))
                or any(k not in reader.fieldnames for k in REQUIRED_COLUMNS)
                or len(reader.fieldnames) > 12):
            raise CatalogueRejected("Invalid CSV schema")
        seen = set()
        for index, row in enumerate(reader, start=2):
            if index > ROW_LIMIT + 1:
                raise CatalogueRejected("CSV row limit exceeded")
            candidate = _candidate(row, index, manifest, actual_sha)
            if candidate is None:
                result["rejected_rows"] += 1
                continue
            key = (candidate["standard"], candidate["grade"],
                   candidate["shape"], tuple(candidate["dimensions_mm"]))
            if key in seen:
                result["rejected_rows"] += 1
                continue
            seen.add(key)
            result["candidates"].append(candidate)
    except (UnicodeDecodeError, csv.Error) as exc:
        raise CatalogueRejected("Invalid UTF-8 CSV") from exc
    return result
