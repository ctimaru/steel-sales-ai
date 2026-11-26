"""NET-IT-LOMBARDIA1.A: Brescia/Bergamo industrial website pointer discovery.

This scanner reads Overture Places website pointers (not business identity).
No Supabase credentials, no personal contacts, no company publications and
no production writes. Audit CSV requires live cross-table dedup in Supabase
before candidates may be staged in SEED1. Spatial tiles are NOT legal regions.
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
# Search tiles cover mainland Italy and both major islands. Tiles overlap;
# never infer legal location/province from a tile.
# MASS11G exhaustively samples licensed structural-metalwork categories
# in 10 overlapping geographic discovery tiles, no legal seat inference.
# Unlike MASS11D, do not truncate each tile to 260 leads: the previously
# sampled high-confidence top 260 domains are already mostly in the Network.
AREAS = {
    "bergamo_tile": ((9.35, 10.24, 45.37, 46.14), 0),
    "brescia_tile": ((9.77, 11.02, 45.16, 46.38), 0),
}
# Search licensed source's business label instead of requiring a technical domain
# or a particular taxonomy. The label is used ONLY to select website pointers.
# No names/contacts persisted; true activity and identity require first-party evidence.
TARGET_NAME = r"(?i)(carpenter[ií]a|carpenterie|costruzioni[ -]+metalliche|strutture[ -]+metalliche|strutture[ -]+in[ -]+acciaio|lavorazion[ei][ -]+(della[ -]+|di[ -]+)?(lamier[ae]|metall[io])|taglio[ -]+laser|saldatur[ae]|piegatura[ -]+(della[ -]+)?lamier[ae]|metal[ -]+fabrication|steel[ -]+fabrication|caldareria|officin[ae][ -]+meccanic[hae]+|lavorazion[ei][ -]+meccanic[hae]+|tornitura|fresatura|meccanica[ -]+di[ -]+precisione|costruzioni[ -]+meccaniche|stampaggio[ -]+metall|tranciatura|trattamenti[ -]+termici|fonderia|macchine[ -]+industrial[ei]|impianti[ -]+industrial[ei]|acciaieria)"
EXCLUDE_NAME = r"(?i)(carpenteria[ -]+(in[ -]+)?legno|carpenteria[ -]+navale[ -]+in[ -]+legno|falegnameria|woodwork|autocarrozzeria|autoriparazione|serramenti|infissi|ferramenta|gioielleria|negozio)"
REJECT = frozenset((
    "facebook.com", "instagram.com", "linkedin.com", "youtube.com",
    "google.com", "wikipedia.org", "paginegialle.it", "europages.com",
    "kompass.com", "tiktok.com", "x.com", "weebly.com",
    "jimdo.com", "wixsite.com", "blogspot.com",
    "wordpress.com", "sites.google.com", "goo.gl", "bit.ly", "tinyurl.com", "t.co", "linktr.ee", "rb.gy", "ow.ly", "cutt.ly", "shorturl.at",
))
TECH = re.compile(r"carpent|metal|accia|steel|sald|lamier|ferr|inox|lavoraz|weld|tagli", re.I)
MAX_ROWS_PER_TILE = 20000
MAX_SELECTED_PER_TILE = 5000


def valid_domain(value: str) -> str | None:
    try:
        p = urlsplit(str(value))
        if p.scheme not in ("http", "https") or p.username or p.password or p.port:
            return None
        host = (p.hostname or "").lower().removeprefix("www.")
        if (".." in host
            or not re.fullmatch(r"[a-z0-9][a-z0-9.-]*\.[a-z]{2,24}", host)
            or any(host == h or host.endswith("." + h) for h in REJECT)):
            return None
        return host
    except (TypeError, ValueError):
        return None


def collect(db: duckdb.DuckDBPyConnection, label: str, bounds: tuple, offset: int) -> dict:
    query = """
    SELECT id, taxonomy.primary, websites[1], addresses[1].country,
           confidence, CAST(sources AS JSON)::VARCHAR
    FROM read_parquet(?, hive_partitioning=1)
    WHERE bbox.xmin BETWEEN ? AND ? AND bbox.ymin BETWEEN ? AND ?
      AND addresses[1].country='IT' AND list_count(websites)>0
      AND (regexp_matches(coalesce(names.primary,''), ?) OR taxonomy.primary IN ('metal_fabricator','iron_fabricator','welder','steel_fabricator','laser_cutting_service','machine_shop','metalworking','metal_working_shop','metal_stamping_service','sheet_metal_contractor','steel_distributor','metal_supplier'))
      AND NOT regexp_matches(coalesce(names.primary,''), ?)
    ORDER BY confidence DESC NULLS LAST, id
    LIMIT ? OFFSET ?
    """
    rows = db.execute(
        query, [SOURCE, *bounds, TARGET_NAME, EXCLUDE_NAME, MAX_ROWS_PER_TILE, offset]
    ).fetchall()
    distinct = {}
    excluded_rights = 0
    for gers, cat, website, country, confidence, source_json in rows:
        domain = valid_domain(website)
        if not domain or country != "IT":
            continue
        try:
            sources = json.loads(source_json) if source_json else []
            licenses = {s.get("license") for s in sources if isinstance(s, dict)}
        except (ValueError, TypeError):
            continue
        if not licenses or licenses != {LICENSE}:
            excluded_rights += 1
            continue
        item = dict(domain=domain, gers=str(gers), area=label,
                    category=str(cat or "uncategorized"), confidence=float(confidence or 0))
        prev = distinct.get(domain)
        if prev is None or item["confidence"] > prev["confidence"]:
            distinct[domain] = item
    ranked = sorted(distinct.values(), key=lambda item: (-item["confidence"], item["domain"]))
    preferred = [item for item in ranked if TECH.search(item["domain"])]
    selected = preferred[:MAX_SELECTED_PER_TILE]
    seen = {x["domain"] for x in selected}
    for item in ranked:
        if len(selected) >= MAX_SELECTED_PER_TILE:
            break
        if item["domain"] not in seen:
            selected.append(item)
            seen.add(item["domain"])
    return dict(tile=label, scanned=len(rows), licensed=len(distinct),
                rights_excluded=excluded_rights, selected=selected)


def main() -> None:
    db = duckdb.connect(config={"threads": 2, "memory_limit": "768MB"})
    db.execute("INSTALL httpfs")
    db.execute("LOAD httpfs")
    db.execute("SET s3_region='us-west-2'")
    db.execute("SET http_timeout=60000")
    outcomes = [collect(db, label, bounds, offset)
                for label, (bounds, offset) in AREAS.items()]
    discovered = {}
    for area in outcomes:
        for item in area["selected"]:
            old = discovered.get(item["domain"])
            if old is None or old["confidence"] < item["confidence"]:
                discovered[item["domain"]] = item

    path = Path(__file__).resolve().parents[1] / "audits/net_it_lombardia1a_20261126_gers.csv"
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        wr = csv.writer(f)
        wr.writerow(("domain", "gers_id", "area_bucket", "overture_taxonomy",
                     "source_license", "release"))
        for domain in sorted(discovered):
            x = discovered[domain]
            wr.writerow((x["domain"], x["gers"], x["area"], x["category"],
                         LICENSE, RELEASE))
    assert sum(1 for _ in path.open(encoding="utf-8")) == len(discovered) + 1
    print("LOMBARDIA1A_READ_ONLY=" + json.dumps(dict(
        dataset=SOURCE, release=RELEASE, source_license=LICENSE,
        scanned_tiles=len(outcomes), distinct_website_leads=len(discovered),
        verified_companies=0, published=0, production_writes=False,
        requires_live_dedup=True,
        area_results=[{key: o[key] for key in ("tile","scanned","licensed","rights_excluded")}
                      | {"selected":len(o["selected"])} for o in outcomes],
        audit_path=str(path.relative_to(Path(__file__).resolve().parents[1])),
    ), ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
