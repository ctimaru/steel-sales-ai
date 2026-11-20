"""NET-IT-MASS11: targeted industrial production categories from the official Overture taxonomy.

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
LICENSES = frozenset(("CDLA-Permissive-2.0", "CC0-1.0", "Apache-2.0"))

CATEGORIES = (
    "machine_shop",
    "industrial_equipment_manufacturer",
    "machinery_and_tool_manufacturer",
    "b2b_industrial_and_machine_service",
    "steel_fabricator",
    "welder",
    "iron_fabricator",
    "welding_supply_store",
    "laser_cutting_service",
    "aluminum_supplier",
    "metal_plating_service",
    "industrial_spares_and_products_wholesaler",
)

AREAS = {
    "m11_lombardia_ovest": (8.20, 9.80, 45.05, 46.30),
    "m11_lombardia_est": (9.45, 11.40, 44.60, 46.30),
    "m11_piemonte_liguria": (6.65, 10.10, 43.55, 46.20),
    "m11_veneto_fvg": (10.30, 14.00, 44.65, 46.85),
    "m11_emilia": (8.75, 12.90, 43.75, 45.40),
    "m11_toscana_umbria_marche": (9.60, 14.00, 42.10, 44.40),
    "m11_lazio_abruzzo_molise": (11.35, 15.40, 40.65, 43.05),
    "m11_campania_puglia": (13.35, 18.75, 39.40, 42.25),
}

TECHNICAL = re.compile(
    r"(accia|steel|sider|inox|metal|carpent|lamier|ferr|tub|weld|sald|"
    r"lavoraz|fonder|stamp|forg|profil|taglio|meccan|tranci|cnc|laser|utens)",
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
        AND addresses[1].country='IT'
        AND list_count(websites)>0
        AND taxonomy.primary IN (""" + ",".join("?" for _ in CATEGORIES) + """)
      LIMIT 5000
    """
    rows = db.execute(sql, [SOURCE, *bbox, *CATEGORIES]).fetchall()
    distinct: dict[str, dict] = {}
    excluded_rights = 0
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
            excluded_rights += 1
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
        "excluded_rights": excluded_rights,
        "selected": ranked[:900],
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
        / "net_it_mass11_industrial_20261120_gers.csv"
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

    print("MASS11_RESULT=" + json.dumps({
        "release": RELEASE,
        "read_only": True,
        "published": 0,
        "taxonomy": list(CATEGORIES),
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
