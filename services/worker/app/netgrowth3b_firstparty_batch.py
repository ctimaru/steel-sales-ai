"""NET-GROWTH3.B — audited first-party Italian steel/tube trader cohort.

Manual, service-role-only acquisition. No web crawling, no canonical publishing,
no claimed buyers, no contact harvesting. A dry-run never contacts production.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

import httpx

from .github_actions_crawler import credentials_from_environment

MANIFEST = Path(__file__).resolve().parents[1] / "data" / "netgrowth3b_italian_traders_20261104.json"
EXPECTED = {"name", "domain", "evidence_url", "summary", "segment", "material_signal", "role"}
ROLE = "trader_distributor"
SOURCE_TABLES = {
    "network_companies": "website_domain",
    "network_core_target_leads": "canonical_domain",
    "network_company_discovery_candidates": "canonical_domain",
    "network_netfast2_structured_entities": "domain",
    "network_netfast3_entities": "domain",
    "network_netfast3_suppressed_domains": "domain",
}
DOMAIN_PATTERN = re.compile(r"^[a-z0-9][a-z0-9.-]*\.[a-z]{2,24}$")


def validate_manifest(payload: object) -> tuple[str, list[dict[str, str]]]:
    if not isinstance(payload, dict) or set(payload) != {"batch", "observed_date", "records"}:
        raise ValueError("Invalid source-backed manifest")
    batch, observed, records = payload["batch"], payload["observed_date"], payload["records"]
    if (not isinstance(batch, str) or not 3 <= len(batch) <= 90 or
            not re.fullmatch(r"[A-Z0-9-]+", batch)):
        raise ValueError("Invalid cohort key")
    if observed != "2026-11-04":
        raise ValueError("Unexpected source observation date")
    if not isinstance(records, list) or not 1 <= len(records) <= 100:
        raise ValueError("Source-backed cohort must have 1..100 records")
    domains: set[str] = set()
    for record in records:
        if not isinstance(record, dict) or set(record) != EXPECTED:
            raise ValueError("Unexpected company fields")
        if not all(isinstance(v, str) for v in record.values()):
            raise ValueError("Expected text-only company facts")
        name, domain, link, summary = (record[key] for key in ("name", "domain", "evidence_url", "summary"))
        if (not 3 <= len(name) <= 180 or not 25 <= len(summary) <= 1000 or
                re.search(r"[@<>\x00-\x1f]", name + summary)):
            raise ValueError("Unsafe or insufficiently sourced company facts")
        if (not DOMAIN_PATTERN.fullmatch(domain) or ".." in domain or
                domain.startswith("www.") or domain in domains):
            raise ValueError("Unsafe or repeated company domain")
        domains.add(domain)
        parsed = urlsplit(link)
        host = (parsed.hostname or "").lower()
        if host.startswith("www."):
            host = host[4:]
        if (parsed.scheme != "https" or host != domain or parsed.port is not None or
                parsed.username or parsed.password or parsed.fragment or not parsed.path.startswith("/") or
                len(link) > 1800 or "@" in link):
            raise ValueError("Company evidence is not from exact first-party HTTPS domain")
        if (record["segment"] != "other" or record["role"] != ROLE or
                record["material_signal"] != "explicit_steel_tube_product"):
            raise ValueError("This cohort admits documented steel-tube traders only")
    return batch, records


def normalized(value: str) -> str:
    return value.lower().removeprefix("www.").strip()


async def preflight(client: httpx.AsyncClient, url: str, key: str,
                    records: list[dict[str, str]]) -> None:
    """Fail closed if any source has already claimed or suppressed this domain."""
    candidates = {r["domain"] for r in records}
    for table, column in SOURCE_TABLES.items():
        offset = 0
        while True:
            resp = await client.get(
                f"{url}/rest/v1/{table}",
                params={"select": column, "limit": "500", "offset": str(offset),
                        "order": f"{column}.asc"},
                headers={"apikey": key, "Accept": "application/json",
                         "User-Agent": "SmartSteelSales-NETGROWTH3B/1.0"},
            )
            if resp.status_code != 200:
                raise RuntimeError(f"Cross-source preflight unavailable: {table}, HTTP {resp.status_code}")
            rows = resp.json()
            if not isinstance(rows, list) or len(rows) > 500:
                raise RuntimeError(f"Cross-source preflight incomplete: {table}")
            known = {normalized(row[column]) for row in rows
                     if isinstance(row, dict) and isinstance(row.get(column), str)}
            conflicts = candidates & known
            if conflicts:
                raise RuntimeError(f"Cross-source duplicate/opt-out hold ({table}): {len(conflicts)}")
            if len(rows) < 500:
                break
            offset += 500
            if offset > 50000:
                raise RuntimeError(f"Cross-source preflight exceeds verified page limit: {table}")


async def run(*, apply: bool, preflight_only: bool = False, manifest: Path = MANIFEST) -> dict:
    batch, records = validate_manifest(json.loads(manifest.read_text(encoding="utf-8")))
    if preflight_only and apply:
        raise ValueError('Choose read-only preflight or explicit apply')
    if not apply and not preflight_only:
        report = {"mode": "dry_run", "status": "validated_offline",
                  "requested": len(records), "unique_domains": len(records),
                  "new_unconfirmed": 0, "published": 0}
        print(json.dumps(report, sort_keys=True))
        return report
    url, key = credentials_from_environment()
    if not url.startswith("https://") or not key.startswith("sb_secret_"):
        raise RuntimeError("Dedicated service-role secret and HTTPS Supabase URL required")
    async with httpx.AsyncClient(timeout=httpx.Timeout(30), follow_redirects=False) as client:
        await preflight(client, url, key, records)
        if preflight_only:
            report = {'mode': 'preflight', 'status': 'verified_no_write',
                      'requested': len(records), 'new_unconfirmed': 0, 'published': 0}
            print(json.dumps(report, sort_keys=True))
            return report
        response = await client.post(
            f"{url}/rest/v1/rpc/netdensity3_seed_first_party",
            headers={"apikey": key, "Content-Type": "application/json",
                     "Accept": "application/json",
                     "User-Agent": "SmartSteelSales-NETGROWTH3B/1.0"},
            json={"p_batch": batch, "p_items": records},
        )
    if response.status_code != 200:
        raise RuntimeError(f"Governed first-party intake failed: HTTP {response.status_code}")
    result = response.json()
    if (not isinstance(result, dict) or result.get("contract") != "netdensity3-bulk-v1"
            or result.get("status") != "completed" or result.get("requested") != len(records)
            or result.get("published") != 0 or result.get("verified_buyers") != 0):
        raise RuntimeError("Governed intake returned an unexpected contract")
    report = {"mode": "apply", "status": "completed", "requested": len(records),
              "new_unconfirmed": result.get("new_unconfirmed"),
              "duplicates": result.get("duplicates"), "invalid": result.get("invalid"),
              "published": 0, "verified_buyers": 0}
    print(json.dumps(report, sort_keys=True))
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="NET-GROWTH3B first-party cohort")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--preflight", action="store_true", help="Live read-only cross-source audit")
    mode.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    asyncio.run(run(apply=args.apply, preflight_only=args.preflight))
