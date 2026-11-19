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
# Secondary *discovery hint* for misclassified Overture Places; never a role claim.
# The service-only stage RPC enforces the same expression independently.
NAME_HINT_CATEGORY = "keyword_industrial_hint"
# Bare "otel" matched hotel/motel, and substring matching confused
# "teaverse", "equinox" and "stube" with steel industry terms.
# This is a RE2-compatible expression, shared by DuckDB and PostgreSQL.
NAME_HINT_REGEX = (
    r"(metal|metall|steel|sider|profil|carpenter|sudur|forjat|prelucr"
    r"|(^|[^a-z])(inox|tub|teav|țeav|fier|oțel))"
)
NONINDUSTRIAL_REGEX = (
    r"(hotel|motel|resort|hostel|restaurant|pensiun|cafenea|cafe"
    r"|bubble.?tea|salon|cosmetic|beauty|epil|gym|fitness"
    r"|muze|museum|biseric|church|scoal|școal|school"
    r"|laser.?tag|barber|spa|dent|stomat|clinic|dermat|chirurg"
    r"|estet|fotbal|football|stadion|printer|imprimant|toner|cartu"
    r"|detecto|laser.?game|lasertime|metalul.?buz)"
)
NAME_HINT = re.compile(NAME_HINT_REGEX, re.I)
NONINDUSTRIAL = re.compile(NONINDUSTRIAL_REGEX, re.I)

EXCLUDED = frozenset({
    "facebook.com", "instagram.com", "linkedin.com", "google.com",
    "maps.google.com", "youtube.com", "tiktok.com", "wixsite.com",
    "linktr.ee", "wix.com", "wordpress.com", "blogspot.com",
})
DOMAIN = re.compile(r"^[a-z0-9][a-z0-9.-]*\.[a-z]{2,24}$")
ALLOWED_TLDS = frozenset({"ro", "com", "eu", "net", "org", "de", "it", "fr",
                           "co", "info", "biz", "global", "group", "industry"})
SOURCE = re.compile(r"^[a-zA-Z0-9_-]{2,60}$")
# Romanian bounding-box prefilter. Address.country must ALSO be RO.
ROMANIA_BOX = (20.0, 30.3, 43.5, 48.4)
MAX_RESULTS = 8 * 160  # upper bound across eight geographic tiles
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
    if (not DOMAIN.fullmatch(domain) or ".." in domain
            or domain.rsplit(".", 1)[-1] not in ALLOWED_TLDS):
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
    if (site is None or not isinstance(label, str) or
            (category not in CATEGORIES and category != NAME_HINT_CATEGORY)):
        return None
    label = " ".join(label.split())
    if category == NAME_HINT_CATEGORY and (
            not NAME_HINT.search(label) or NONINDUSTRIAL.search(label)):
        return None
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


# Spatial buckets ensure national coverage instead of favoring dense cities.
# These are search tiles, NOT administrative counties or verified company regions.
MAX_PER_TILE = 160
LON_BANDS = (22.5, 25.0, 27.5)
LAT_SPLIT = 45.8


def tile_for(lon: float, lat: float) -> str:
    column = sum(lon >= split for split in LON_BANDS)
    return ("north" if lat >= LAT_SPLIT else "south") + "-" + str(column)


def query_places() -> list[tuple]:
    """One parquet scan, eight balanced Romanian geographic search tiles.

    Include taxonomy.primary, hierarchy and alternates so that companies
    with a broader primary category are not invisible to industrial search.
    The place record remains a research hint, never legal identity proof.
    """
    import duckdb  # lazy import keeps pure tests network-independent
    con = duckdb.connect(config={"threads": 2})
    try:
        con.execute("INSTALL httpfs; LOAD httpfs;")
        con.execute("SET s3_region='us-west-2';")
        con.execute("SET enable_progress_bar=false;")
        con.execute("SET memory_limit='3GB';")
        # Overture Places v2.0.0: taxonomy.alternates (NOT categories.alternate).
        # Do not select addresses, personal contacts, emails, phones or logos.
        return con.execute(
            """
            WITH scope AS (
              SELECT id::VARCHAR AS gers,
                     names.primary AS label,
                     websites[1] AS website,
                     CASE
                       WHEN taxonomy.primary IN (
                         'metal_fabricator','sheet_metal_fabricator',
                         'metal_supplier','steel_mill','steel_supplier',
                         'machine_shop','welding_service',
                         'metal_processing','metalworking'
                       ) THEN taxonomy.primary
                       WHEN coalesce(list_has_any(taxonomy.hierarchy, [
                         'metal_fabricator','sheet_metal_fabricator',
                         'metal_supplier','steel_mill','steel_supplier',
                         'machine_shop','welding_service',
                         'metal_processing','metalworking'
                       ]),false) THEN list_extract(list_intersect(
                         taxonomy.hierarchy, [
                         'metal_fabricator','sheet_metal_fabricator',
                         'metal_supplier','steel_mill','steel_supplier',
                         'machine_shop','welding_service',
                         'metal_processing','metalworking'
                       ]),1)
                       WHEN coalesce(list_has_any(taxonomy.alternates, [
                         'metal_fabricator','sheet_metal_fabricator',
                         'metal_supplier','steel_mill','steel_supplier',
                         'machine_shop','welding_service',
                         'metal_processing','metalworking'
                       ]),false)
                       THEN list_extract(list_intersect(
                         taxonomy.alternates, [
                         'metal_fabricator','sheet_metal_fabricator',
                         'metal_supplier','steel_mill','steel_supplier',
                         'machine_shop','welding_service',
                         'metal_processing','metalworking'
                       ]),1)
                       WHEN regexp_matches(lower(names.primary),
                         '(metal|metall|steel|sider|profil|carpenter|sudur|forjat|prelucr|(^|[^a-z])(inox|tub|teav|țeav|fier|oțel))')
                       THEN 'keyword_industrial_hint'
                     END AS category,
                     sources[1].dataset AS source_dataset,
                     sources[1].license AS source_license,
                     bbox.xmin AS lon,bbox.ymin AS lat,confidence,
                     CASE
                       WHEN bbox.xmin < 22.5 THEN 0
                       WHEN bbox.xmin < 25.0 THEN 1
                       WHEN bbox.xmin < 27.5 THEN 2
                       ELSE 3
                     END AS lon_tile,
                     CASE WHEN bbox.ymin < 45.8 THEN 0 ELSE 1 END AS lat_tile
              FROM read_parquet(?, hive_partitioning=true)
              WHERE bbox.xmin BETWEEN 20.0 AND 30.3
                AND bbox.ymin BETWEEN 43.5 AND 48.4
                AND addresses[1].country='RO'
                AND (
                   taxonomy.primary IN (
                     'metal_fabricator','sheet_metal_fabricator',
                     'metal_supplier','steel_mill','steel_supplier',
                     'machine_shop','welding_service',
                     'metal_processing','metalworking'
                   )
                   OR coalesce(list_has_any(taxonomy.hierarchy, [
                     'metal_fabricator','sheet_metal_fabricator',
                     'metal_supplier','steel_mill','steel_supplier',
                     'machine_shop','welding_service',
                     'metal_processing','metalworking'
                   ]),false)
                   OR coalesce(list_has_any(taxonomy.alternates, [
                     'metal_fabricator','sheet_metal_fabricator',
                     'metal_supplier','steel_mill','steel_supplier',
                     'machine_shop','welding_service',
                     'metal_processing','metalworking'
                   ]),false)
                   OR regexp_matches(lower(names.primary),
                     '(metal|metall|steel|sider|profil|carpenter|sudur|forjat|prelucr|(^|[^a-z])(inox|tub|teav|țeav|fier|oțel))')
                )
                AND NOT regexp_matches(lower(names.primary),
                  '(hotel|motel|resort|hostel|restaurant|pensiun|cafenea|cafe|bubble.?tea|salon|cosmetic|beauty|epil|gym|fitness|muze|museum|biseric|church|scoal|școal|school|laser.?tag|barber|spa)')
                AND websites[1] IS NOT NULL
                AND names.primary IS NOT NULL
                AND confidence >= 0.75
                AND coalesce(operating_status, 'open') <> 'permanently_closed'
            ), ranked AS (
              SELECT *,row_number() OVER (
                PARTITION BY lat_tile,lon_tile ORDER BY
                  CASE WHEN category='keyword_industrial_hint' THEN 1 ELSE 0 END,
                  confidence DESC,gers
              ) AS tile_rank FROM scope
              WHERE category IS NOT NULL
            )
            SELECT gers,label,website,category,source_dataset,
                   source_license,lon,lat,confidence
            FROM ranked WHERE tile_rank <= ?
            ORDER BY lat_tile,lon_tile,tile_rank
            """, [S3_PATH, MAX_PER_TILE]
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
        "geographic_tiles": dict(sorted({
            tile: sum(1 for row in leads if tile_for(row["longitude"], row["latitude"]) == tile)
            for tile in {tile_for(row["longitude"], row["latitude"]) for row in leads}
        }.items())),
        "max_per_tile": MAX_PER_TILE,
        "keyword_hint_leads": sum(1 for row in leads if row["category"] == NAME_HINT_CATEGORY),
        **stats,
        "published": 0,
        "first_party_auto2_required": True,
    }
    print(json.dumps(output, ensure_ascii=False, sort_keys=True))
    return output


if __name__ == "__main__":
    main()
