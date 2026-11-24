"""Select Overture website pointers for a separately authorized SEED1 source.

No company identity, publication, source registration or credentials here.
The server must independently enforce source authorization, policy, deduplication,
queue limits and atomic provenance. Geographic buckets are not company addresses.
"""
from __future__ import annotations

import csv
import re
from collections.abc import Iterable
from uuid import UUID

LICENSE = "CDLA-Permissive-2.0"
MAX_LOT = 250
SOURCE_URL = "https://docs.overturemaps.org/guides/places/#sss-autofeed-v1"
TAXONOMIES = frozenset({
    "metal_fabricator", "iron_fabricator", "steel_fabricator", "welder",
    "laser_cutting_service", "sheet_metal_contractor", "sheet_metal_fabricator",
})
REGIONS = frozenset({
    "nord_ovest", "lombardia", "nord_est", "emilia_romagna",
    "toscana_umbria_marche", "lazio_abruzzo_molise", "campania_puglia",
    "basilicata_calabria", "sicilia", "sardegna",
})
DOMAIN = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.[a-z]{2,24}$")
RELEASE = re.compile(r"^20\d{2}-\d{2}-\d{2}\.\d+$")
AUDIT = re.compile(
    r"^https://github\.com/ctimaru/steel-sales-ai/blob/[0-9a-f]{40}/"
    r"services/worker/audits/[A-Za-z0-9_.-]+\.csv$"
)
EXCLUDED = re.compile(
    r"legno|infissi|serrament|falegnam|ferrament|autoofficina|porte-corazzate"
)
BLOCKED = frozenset({
    "facebook.com", "linkedin.com", "instagram.com", "youtube.com",
    "google.com", "google.it", "paginegialle.it", "europages.com",
    "kompass.com", "wordpress.com", "wixsite.com", "blogspot.com",
})


def select_items(lines: Iterable[str], *, release: str, audit_url: str,
                 known_domains: Iterable[str] = (), limit: int = MAX_LOT
                 ) -> list[dict[str, str]]:
    """Return strict, deduplicated pointers, never verified companies.

    known_domains is an optimization, not an authority: dedup must run again
    in the transactional server intake. Only an immutable repo audit is accepted.
    """
    if not 1 <= limit <= MAX_LOT or not RELEASE.fullmatch(release):
        raise ValueError("invalid release or batch limit")
    if not AUDIT.fullmatch(audit_url):
        raise ValueError("immutable audit URL required")
    known = {str(d).strip().lower() for d in known_domains}
    fields = ("domain", "gers_id", "area_bucket", "overture_taxonomy",
              "source_license", "release")
    reader = csv.DictReader(lines)
    if tuple(reader.fieldnames or ()) != fields:
        raise ValueError("unexpected audit schema")
    found: dict[str, dict[str, str]] = {}
    conflicting: set[str] = set()
    for row in reader:
        if None in row or any(row.get(key) is None for key in fields):
            raise ValueError("malformed audit row")
        domain = row["domain"].strip().lower()
        if (not DOMAIN.fullmatch(domain) or domain in known or domain in BLOCKED
                or EXCLUDED.search(domain)
                or row["source_license"] != LICENSE or row["release"] != release
                or row["area_bucket"] not in REGIONS
                or row["overture_taxonomy"] not in TAXONOMIES):
            continue
        try:
            gers = str(UUID(row["gers_id"]))
        except (ValueError, AttributeError):
            continue
        item = {
            "domain": domain, "url": f"https://{domain}/", "evidence": audit_url,
            "gers_id": gers, "release": release, "source_license": LICENSE,
            "region_bucket": row["area_bucket"], "taxonomy": row["overture_taxonomy"],
        }
        if domain in found and found[domain]["gers_id"] != gers:
            conflicting.add(domain)
        found.setdefault(domain, item)
    return [found[d] for d in sorted(found) if d not in conflicting][:limit]
