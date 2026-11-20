"""NET-IT-MASS10: November Overture release delta for Italian industrial companies.

Read-only discovery only. Overture website pointers are leads, never company verification.
No company names, contacts, addresses, PII, Supabase writes, or publication.
"""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

import duckdb

RELEASE = "2026-11-18.0"
SOURCE = (
    "s3://overturemaps-us-west-2/release/"
    + RELEASE + "/theme=places/type=place/*.parquet"
)
LICENSE = "CDLA-Permissive-2.0"
LICENSES = frozenset(("CDLA-Permissive-2.0", "CC0-1.0", "Apache-2.0"))

CATEGORIES = (
    "metal_fabricator", "metal_supplier", "sheet_metal_fabricator",
    "steel_fabricators", "steel_supplier", "steel_distributor",
    "iron_and_steel_industry", "metal_manufacturer", "metal_processing",
    "welding_service", "metalworking", "metal_worker", "metal_workshop",
    "metalworking_shop", "metal_fabrication", "iron_works", "metal_works",
)

AREAS = {
    "nov_lombardia_ovest": (8.25, 9.75, 45.10, 46.25),
    "nov_lombardia_est": (9.55, 11.35, 44.65, 46.25),
    "nov_piemonte_liguria": (6.70, 10.10, 43.60, 46.15),
    "nov_veneto_fvg": (10.35, 13.95, 44.70, 46.80),
    "nov_emilia": (8.80, 12.85, 43.80, 45.35),
    "nov_toscana_umbria_marche": (9.65, 13.95, 42.20, 44.35),
    "nov_lazio_abruzzo_molise": (11.40, 15.35, 40.70, 43.00),
    "nov_campania_puglia": (13.40, 18.70, 39.45, 42.20),
    "nov_basilicata_calabria": (15.00, 17.70, 37.65, 41.35),
    "nov_sicilia": (12.00, 15.80, 36.30, 38.60),
    "nov_sardegna": (7.70, 10.10, 38.60, 41.70),
}

TECHNICAL = re.compile(
    r"(accia|steel|sider|inox|metal|carpent|lamier|ferr|tub|weld|"
    r"sald|lavoraz|fonder|stamp|forg|profil|taglio|meccan|tranci)",
    re.I,
)
REJECT_HOSTS = frozenset((
    "facebook.com", "instagram.com", "linkedin.com", "google.com",
    "wikipedia.org", "youtube.com", "tiktok.com", "x.com",
    "paginegialle.it", "europages.com", "kompass.com", "wa.me",
    "weebly.com", "jimdo.com", "jimdosite.com", "wixsite.com",
    "blogspot.com", "wordpress.com", "sites.google.com", "site123.me",
    "business.site", "godaddysites.com", "webnode.it",
))


def company_domain(value: str) -> str | None:
    try:
        u = urlsplit(str(value))
        if u.scheme not in ("https", "http") or u.username or u.password or u.port:
            return None
        host = (u.hostname or "").lower().removeprefix("www.")
        if (
            not re.fullmatch(r"[a-z0-9][a-z0-9.-]*\.[a-z]{2,24}", host)
            or ".." in host
            or any(host == h or host.endswith("." + h) for h in REJECT_HOSTS)
        ):
            return None
        return host
    except (ValueError, TypeError):
        return None


def collect(db: duckdb.DuckDBPyConnection, area: str, bbox: tuple[float, float, float, float]) -> dict:
    sql = """
      SELECT id, taxonomy.primary AS category, websites[1] AS website,
             addresses[1].country AS country, confidence,
             CAST(sources AS JSON)::VARCHAR AS license_sources
      FROM read_parquet(?, hive_partitioning=1)
      WHERE bbox.xmin BETWEEN ? AND ? AND bbox.ymin BETWEEN ? AND ?
        AND addresses[1].country='IT' AND list_count(websites)>0
        AND taxonomy.primary IN (""" + ",".join("?" for _ in CATEGORIES) + """)
      LIMIT 4000
    """
    rows = db.execute(sql, [SOURCE, *bbox, *CATEGORIES]).fetchall()
    distinct: dict[str, dict] = {}
    bad_license = 0
    for gers, cat, website, country, confidence, sources_json in rows:
        domain = company_domain(website)
        if not domain or country != "IT":
            continue
        sources = json.loads(sources_json) if sources_json else []
        rights = sorted({
            s["license"] for s in sources
            if isinstance(s, dict) and isinstance(s.get("license"), str)
        })
        if not rights or not set(rights).issubset(LICENSES):
            bad_license += 1
            continue
        info = {
            "domain": domain,
            "gers": str(gers),
            "region_bucket": area,
            "category": str(cat),
            "licenses": rights,
            "confidence": float(confidence or 0),
        }
        old = distinct.get(domain)
        if old is None or old["confidence"] < info["confidence"]:
            distinct[domain] = info

    ranked = sorted(
        distinct.values(),
        key=lambda x: (
            0 if TECHNICAL.search(x["domain"]) else 1,
            -x["confidence"],
            x["domain"],
        ),
    )
    return {
        "area": area,
        "raw_records": len(rows),
        "distinct_licensed": len(distinct),
        "excluded_rights": bad_license,
        "selected": ranked[:700],
    }


def main() -> None:
    db = duckdb.connect(config={"threads": 2, "memory_limit": "768MB"})
    db.execute("INSTALL httpfs")
    db.execute("LOAD httpfs")
    db.execute("SET s3_region='us-west-2'")
    db.execute("SET http_timeout=60000")

    results = [collect(db, key, bbox) for key, bbox in AREAS.items()]
    domains: dict[str, dict] = {}
    for group in results:
        for item in group["selected"]:
            domains.setdefault(item["domain"], item)

    audit = (
        Path(__file__).resolve().parents[1]
        / "audits"
        / "net_it_mass10_novrelease_20261120_gers.csv"
    )
    audit.parent.mkdir(parents=True, exist_ok=True)
    with audit.open("w", encoding="utf-8", newline="") as fp:
        writer = csv.writer(fp)
        writer.writerow((
            "domain", "gers_id", "search_bucket", "overture_taxonomy",
            "source_license", "release",
        ))
        for domain in sorted(domains):
            item = domains[domain]
            writer.writerow((
                domain, item["gers"], item["region_bucket"], item["category"],
                "|".join(item["licenses"]), RELEASE,
            ))

    print("MASS10_RESULT=" + json.dumps({
        "release": RELEASE,
        "read_only": True,
        "published": 0,
        "selected_distinct_domains": len(domains),
        "areas": [
            {
                "bucket": group["area"],
                "raw": group["raw_records"],
                "licensed_distinct": group["distinct_licensed"],
                "excluded_rights": group["excluded_rights"],
                "selected": len(group["selected"]),
            }
            for group in results
        ],
        "audit_path": str(audit.relative_to(Path(__file__).resolve().parents[1])),
    }, separators=(",", ":")))


if __name__ == "__main__":
    main()
