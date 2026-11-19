"""NET-RO-OVERTURE1: bounded Overture Places -> private Romanian discovery leads.

No publishing, legal-name verification, commercial data, personal contacts,
or protected website content is attempted. Company facts require RO AUTO2.
"""
from __future__ import annotations

import json
import os
import re
import uuid
from urllib.parse import urlsplit

RELEASE = "2026-11-18.0"
S3_PATH = (
    "s3://overturemaps-us-west-2/release/"
    + RELEASE + "/theme=places/type=place/*"
)
CATEGORIES = frozenset({
    "metal_fabricator", "sheet_metal_fabricator", "metal_supplier",
    "steel_mill", "steel_supplier", "machine_shop", "welding_service",
    "metal_processing", "metalworking",
})
EXCLUDED = frozenset({
    "facebook.com", "instagram.com", "linkedin.com", "google.com",
    "maps.google.com", "youtube.com", "tiktok.com", "wixsite.com",
    "linktr.ee", "wix.com", "wordpress.com", "blogspot.com",
})
DOMAIN = re.compile(r"^[a-z0-9][a-z0-9.-]*\.[a-z]{2,24}$")
SOURCE = re.compile(r"^[a-zA-Z0-9_-]{2,60}$")
# Romanian bounding-box prefilter. Address.country must ALSO be RO.
ROMANIA_BOX = (20.0, 30.3, 43.5, 48.4)
MAX_RESULTS = 500
MAX_BATCH = 100


def canonical_website(value: object) -> tuple[str, str] | None:
    if not isinstance(value, str) or len(value) > 500 or "\\" in value:
        return None
    try:
        parsed = urlsplit(value.strip())
        host = parsed.hostname
        if parsed.scheme != "https" or not host or parsed.username or parsed.password:
            return None
        if parsed.port not in (None, 443):
            return None
    except ValueError:
        return None
    domain = host.lower().removeprefix("www.")
    if not DOMAIN.fullmatch(domain) or ".." in domain:
        return None
    if domain in EXCLUDED or any(domain.endswith("." + bad) for bad in EXCLUDED):
        return None
    if any(part in ("localhost", "local", "internal") for part in domain.split(".")):
        return None
    return domain, "https://" + domain + "/"


def parse_place(row: tuple) -> dict | None:
    """No source name is promoted to a legal name; all records stay private."""
    (gers, label, website, category, source_dataset, source_license,
     lon, lat, confidence) = row
    site = canonical_website(website)
    if site is None or category not in CATEGORIES or not isinstance(label, str):
        return None
    label = " ".join(label.split())
    if not (3 <= len(label) <= 180) or any(c in label for c in "@<>"):
        return None
    if not isinstance(source_dataset, str) or not SOURCE.fullmatch(source_dataset):
        return None
    # The Places theme is CDLA Permissive 2.0, not OSM/ODbL. Discard
    # any record that explicitly declares an incompatible source license.
    if source_license and source_license.lower().replace(" ", "-") not in {
        "cdla-permissive-2.0", "cdla-permissive-v2",
    }:
        return None
    try:
        gers = str(uuid.UUID(str(gers)))
        lon, lat, confidence = float(lon), float(lat), float(confidence)
    except (ValueError, TypeError):
        return None
    if not (20.0 <= lon <= 30.3 and 43.5 <= lat <= 48.4
            and 0.75 <= confidence <= 1.0):
        return None
    domain, url = site
    return {
        "gers_id": gers, "domain": domain, "website": url,
        "label": label, "category": category,
        "source_dataset": source_dataset,
        "license": "CDLA-Permissive-2.0", "country": "RO",
        "longitude": round(lon, 6), "latitude": round(lat, 6),
        "confidence": round(confidence, 3),
    }


def query_places() -> list[tuple]:
    import duckdb  # lazy import makes the pure parsing tests independent
    con = duckdb.connect(config={"threads": 2})
    try:
        con.execute("INSTALL httpfs; LOAD httpfs;")
        con.execute("SET s3_region='us-west-2';")
        con.execute("SET enable_progress_bar=false;")
        con.execute("SET memory_limit='3GB';")
        # Use the current Overture v2 schema, not removed categories.primary.
        # Select no emails, phones, socials, street addresses or artwork.
        return con.execute(
            """
            SELECT id::VARCHAR, names.primary, websites[1],
                   taxonomy.primary, sources[1].dataset,
                   sources[1].license,
                   bbox.xmin, bbox.ymin, confidence
            FROM read_parquet(?, hive_partitioning=true)
            WHERE bbox.xmin BETWEEN 20.0 AND 30.3
              AND bbox.ymin BETWEEN 43.5 AND 48.4
              AND addresses[1].country='RO'
              AND taxonomy.primary IN (
                'metal_fabricator','sheet_metal_fabricator',
                'metal_supplier','steel_mill','steel_supplier',
                'machine_shop','welding_service','metal_processing',
                'metalworking'
              )
              AND websites[1] IS NOT NULL AND names.primary IS NOT NULL
              AND confidence>=0.75
              AND coalesce(operating_status, 'open')<>'permanently_closed'
            LIMIT ?
            """, [S3_PATH, MAX_RESULTS]
        ).fetchall()
    finally:
        con.close()


def stage_batches(rows: list[dict]) -> dict:
    import httpx
    base = os.environ.get("CRAWL_IT65B_SUPABASE_URL", "").rstrip("/")
    secret = os.environ.get("CRAWL_IT65B_SUPABASE_SECRET_KEY", "")
    if (base != "https://ecrafjdummcdfycznitx.supabase.co"
            or not secret.startswith("sb_secret_")):
        raise RuntimeError("RO Overture: production service credentials missing")
    totals = {"received": 0, "new_leads": 0, "new_private_seeds": 0}
    with httpx.Client(timeout=40.0, follow_redirects=False) as client:
        for start in range(0, len(rows), MAX_BATCH):
            batch = rows[start:start + MAX_BATCH]
            result = client.post(
                base + "/rest/v1/rpc/net_ro_overture1_stage",
                headers={"apikey": secret, "Content-Type": "application/json",
                         "Accept": "application/json"},
                json={"p_release": RELEASE, "p_items": batch},
            )
            if result.status_code != 200:
                raise RuntimeError(
                    "RO Overture stage HTTP " + str(result.status_code)
                )
            response = result.json()
            if (response.get("contract") != "net-ro-overture1-v1"
                    or response.get("release") != RELEASE
                    or response.get("received") != len(batch)
                    or response.get("published") != 0):
                raise RuntimeError("Unexpected RO Overture staging contract")
            for key in totals:
                totals[key] += response[key]
    return totals


def main() -> dict:
    observed = query_places()
    parsed = [r for raw in observed if (r := parse_place(raw)) is not None]
    by_domain = {}
    for row in parsed:
        current = by_domain.get(row["domain"])
        if current is None or row["confidence"] > current["confidence"]:
            by_domain[row["domain"]] = row
    leads = list(by_domain.values())
    stats = stage_batches(leads) if leads else {
        "received": 0, "new_leads": 0, "new_private_seeds": 0,
    }
    output = {
        "contract": "net-ro-overture1-client-v1",
        "release": RELEASE,
        "overture_places_inspected": len(observed),
        "candidate_website_domains": len(leads),
        **stats,
        "published": 0,
        "first_party_auto2_required": True,
    }
    print(json.dumps(output, ensure_ascii=False, sort_keys=True))
    return output


if __name__ == "__main__":
    main()
