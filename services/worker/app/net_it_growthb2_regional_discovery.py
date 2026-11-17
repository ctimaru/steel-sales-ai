"""NET-IT-GROWTH.B2: bounded Italy CC0 discovery by region and industrial sector.

Two Wikidata Query Service requests per UTC day (one per claimed region).
All hits remain UNVERIFIED discovery leads in the existing structured table;
NET-IT-GROWTH.B1 / SEED1 then read official first-party sites. No publishing.
Only the already Owner-approved Wikidata CC0 source may be queried.
"""
from __future__ import annotations

import asyncio
import json
import re

import httpx

from .company_discovery import CompanyDiscoveryError, canonical_domain, canonicalize_seed_url
from .github_actions_crawler import credentials_from_environment
from .netlaunch2_wikidata_density import SECTORS
from .wikidata_source_discovery import EXCLUDED, SOURCE_URL, USER_AGENT

# Wikimedia region entity IDs (not territorial assignments to company profiles).
# Source: https://www.wikidata.org/wiki/Wikidata:WikiProject_Italy/Administrative_divisions
REGIONS: dict[str, str] = {
    "Piemonte": "Q1216", "Lombardia": "Q1210",
    "Veneto": "Q1243", "Emilia-Romagna": "Q1263",
    "Toscana": "Q1273", "Marche": "Q1279",
    "Liguria": "Q1256", "Friuli-Venezia Giulia": "Q1250",
    "Trentino-Alto Adige": "Q1237", "Valle d'Aosta": "Q1222",
    "Umbria": "Q1280", "Lazio": "Q1282",
    "Abruzzo": "Q1284", "Molise": "Q1443",
    "Campania": "Q1438", "Puglia": "Q1447",
    "Basilicata": "Q1452", "Calabria": "Q1458",
    "Sicilia": "Q1460", "Sardegna": "Q1462",
}
QID = re.compile(r"^Q[1-9][0-9]{0,13}$")
ENTITY = re.compile(r"^https?://www[.]wikidata[.]org/entity/(Q[1-9][0-9]{0,13})$")
MAX_ROWS = 100
MAX_BYTES = 850_000


def sparql(region_qid: str, offset: int) -> str:
    """One bounded region-sector query, requiring an actual HQ location path.

    P159 headquarters -> P131* administrative hierarchy -> named IT region.
    Headquarters evidence is only a LEAD HINT; first-party verifies actual
    locality, products, roles and identity before publication.
    """
    if (region_qid not in REGIONS.values() or type(offset) is not int
            or offset not in range(0, 1001, 100)):
        raise ValueError("Unapproved region or unbounded pagination")
    values = " ".join("wd:" + sector for sector in sorted(SECTORS))
    return f"""PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT DISTINCT ?item ?website ?label ?industry WHERE {{
  VALUES ?industry {{ {values} }}
  ?item wdt:P17 wd:Q38 ;
        wdt:P452 ?industry ;
        wdt:P856 ?website ;
        wdt:P159 ?headquarters ;
        rdfs:label ?label .
  ?headquarters wdt:P131* wd:{region_qid} .
  FILTER(LANG(?label) = "it" || LANG(?label) = "en")
  FILTER NOT EXISTS {{ ?item wdt:P31 wd:Q5 . }}
}}
ORDER BY ?item ?industry
LIMIT 100 OFFSET {offset}"""


def parse_bindings(payload: object, region_qid: str) -> tuple[list[dict[str, str]], int]:
    if region_qid not in REGIONS.values():
        raise ValueError("Unrecognized region")
    obj = payload.get("results") if isinstance(payload, dict) else None
    bindings = obj.get("bindings") if isinstance(obj, dict) else None
    if not isinstance(bindings, list) or len(bindings) > MAX_ROWS:
        raise ValueError("Invalid/unbounded WDQS response")
    seen: set[tuple[str, str]] = set()
    records: list[dict[str, str]] = []
    for row in bindings:
        if not isinstance(row, dict):
            continue

        def get(name: str) -> str:
            value = row.get(name)
            return value.get("value", "") if (
                isinstance(value, dict) and isinstance(value.get("value"), str)
            ) else ""

        match = ENTITY.fullmatch(get("item"))
        sector = ENTITY.fullmatch(get("industry"))
        company_name = get("label").strip()
        if (not match or not sector or sector.group(1) not in SECTORS
                or not 3 <= len(company_name) <= 180
                or re.search(r"[@<>\x00-\x1f]|https?://", company_name)):
            continue
        try:
            canonical = canonicalize_seed_url(get("website"))
            domain = canonical_domain(canonical)
        except (CompanyDiscoveryError, ValueError, TypeError):
            continue
        if (not canonical.startswith("https://")
                or not re.fullmatch(r"[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}", domain)
                or ".." in domain or any(
                    domain == bad or domain.endswith("." + bad) for bad in EXCLUDED
                )):
            continue
        key = (match.group(1), sector.group(1))
        if key in seen:
            continue
        seen.add(key)
        records.append({
            "qid": match.group(1), "label": company_name, "domain": domain,
            "website": f"https://{domain}/", "industry_qid": sector.group(1),
            "region_qid": region_qid,
        })
    return records, len(bindings)


async def call_rpc(
    api: httpx.AsyncClient, base_url: str, key: str, name: str, params: dict
) -> dict:
    if name not in ("net_it_growthb2_claim_daily", "net_it_growthb2_commit_daily"):
        raise ValueError("Unknown B2 RPC")
    response = await api.post(
        base_url + "/rest/v1/rpc/" + name,
        headers={
            "apikey": key, "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "SmartSteelSales-ItalyRegionCC0/1.0",
        }, json=params
    )
    if response.status_code != 200:
        raise RuntimeError(f"B2 {name}: Supabase HTTP {response.status_code}")
    result = response.json()
    if not isinstance(result, dict):
        raise ValueError("Unexpected B2 RPC contract")
    return result


async def fetch_region(
    web: httpx.AsyncClient, region_qid: str, offset: int
) -> tuple[list[dict[str, str]], int]:
    result = await web.get(
        SOURCE_URL,
        params={"query": sparql(region_qid, offset), "format": "json"},
        headers={
            "Accept": "application/sparql-results+json",
            "Accept-Encoding": "gzip,deflate",
            "User-Agent": USER_AGENT.replace("DiscoveryPilot", "ItalyRegionCC0"),
        },
    )
    # Fail closed; no automated retry on throttling, 5xx, timeout or malformed data.
    if result.status_code != 200:
        raise RuntimeError(f"WDQS HTTP {result.status_code}; no retry")
    if len(result.content) > MAX_BYTES:
        raise ValueError("WDQS response too large")
    return parse_bindings(result.json(), region_qid)


async def main() -> dict:
    url, key = credentials_from_environment()
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(15), follow_redirects=False
    ) as api:
        claim = await call_rpc(api, url, key, "net_it_growthb2_claim_daily", {})
        if claim.get("contract") != "net-it-growthb2-v1":
            raise RuntimeError("Unexpected B2 claim contract")
        if claim.get("eligible") is not True:
            report = {
                "status": "skipped", "reason": claim.get("reason", "inactive"),
                "source_leads": 0, "published": 0,
            }
            print(json.dumps(report, sort_keys=True))
            return report

        regions = claim.get("regions")
        if (not isinstance(regions, list) or len(regions) != 2
                or claim.get("max_records") != 200):
            raise RuntimeError("Unauthorized B2 regional budget")
        ids: set[str] = set()
        for region in regions:
            if (not isinstance(region, dict)
                    or region.get("qid") not in REGIONS.values()
                    or not isinstance(region.get("offset"), int)
                    or region["offset"] not in range(0, 1001, 100)
                    or region["qid"] in ids):
                raise RuntimeError("Unexpected B2 region or offset")
            ids.add(region["qid"])

        records: list[dict[str, str]] = []
        counts: dict[str, int] = {}
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(45), follow_redirects=False
        ) as web:
            for index, region in enumerate(regions):
                if index:
                    await asyncio.sleep(8)  # at most two sequential queries/day
                items, count = await fetch_region(
                    web, region["qid"], region["offset"])
                records.extend(items)
                counts[region["qid"]] = count
        stored = await call_rpc(api, url, key, "net_it_growthb2_commit_daily", {
            "p_run_id": claim["run_id"], "p_items": records, "p_counts": counts,
        })
        if stored.get("contract") != "net-it-growthb2-v1" or stored.get("published") != 0:
            raise RuntimeError("Unexpected B2 persistence result")
        report = {
            "status": stored.get("status"), "region_qids": sorted(ids),
            "fetched": sum(counts.values()),
            "new_unverified_domains": stored.get("new_domains", 0),
            "existing_or_rejected": stored.get("duplicate_or_rejected", 0),
            "published": 0,
        }
        print(json.dumps(report, sort_keys=True))
        return report


if __name__ == "__main__":
    asyncio.run(main())
