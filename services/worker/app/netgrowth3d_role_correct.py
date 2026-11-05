"""NET-GROWTH3.D: first-party research queue and role-correct 50–100 intake.

One role-coherent cohort per batch; no publishing, scraping, contact harvesting,
automatic dispatch, or classification shortcuts. Partial research is *not* importable.
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
from .netgrowth3b_firstparty_batch import (
    DOMAIN_PATTERN, EXPECTED, legacy_rpc_items, preflight,
)

DEFAULT_MANIFEST = (
    Path(__file__).resolve().parents[1] / "data"
    / "netgrowth3d_traders_research_20261105.json"
)
SUPPORTED_KINDS = {
    "trader": frozenset(("trader_distributor",)),
    "industrial": frozenset(("producer", "processor_service_provider")),
}
EXTRA_FIELDS = {"role_evidence_url", "identity_evidence_url", "source_status"}
SOURCE_STATUS = "first_party_screened"


def _official_url(url: str, domain: str) -> None:
    parsed = urlsplit(url)
    host = (parsed.hostname or "").lower().removeprefix("www.")
    if (
        parsed.scheme != "https" or parsed.username or parsed.password
        or parsed.port is not None or parsed.fragment
        or host != domain or not parsed.path.startswith("/")
        or len(url) > 1800 or "@" in url
    ):
        raise ValueError("All source and identity evidence must be exact HTTPS first-party URLs")


def validate_manifest(data: object) -> tuple[str, str, list[dict[str, str]], list[str]]:
    if not isinstance(data, dict) or set(data) != {
        "batch", "observed_date", "kind", "records", "review_hold_domains",
    }:
        raise ValueError("Missing or unexpected NET-GROWTH3.D research fields")
    batch, observed, kind = data["batch"], data["observed_date"], data["kind"]
    if (
        not isinstance(batch, str)
        or not re.fullmatch(r"NET-GROWTH3D-[A-Z0-9-]{3,70}", batch)
        or not isinstance(observed, str)
        or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", observed)
        or kind not in SUPPORTED_KINDS
    ):
        raise ValueError("Invalid first-party research batch identity")
    records = data["records"]
    holds = data["review_hold_domains"]
    if not isinstance(records, list) or not 1 <= len(records) <= 100:
        raise ValueError("Research must have 1..100 records; apply requires 50..100")
    if not isinstance(holds, list) or any(not isinstance(h, str) for h in holds):
        raise ValueError("Invalid hold list")
    domains: set[str] = set()
    names: set[str] = set()
    for record in records:
        if (
            not isinstance(record, dict)
            or set(record) != EXPECTED | EXTRA_FIELDS
            or not all(isinstance(v, str) for v in record.values())
        ):
            raise ValueError("Unexpected company/role evidence fields")
        name, domain, summary = (record[k] for k in ("name", "domain", "summary"))
        if not DOMAIN_PATTERN.fullmatch(domain) or domain.startswith("www.") or ".." in domain:
            raise ValueError("Invalid company domain")
        normalized_name = re.sub(r"[^\w]", "", name.lower())
        if domain in domains or normalized_name in names:
            raise ValueError("Duplicated company domain or near-identical legal identity")
        domains.add(domain)
        names.add(normalized_name)
        if (
            not 3 <= len(name) <= 180 or not 25 <= len(summary) <= 1000
            or re.search(r"[@<>\x00-\x1f]", name + summary)
            or record["role"] not in SUPPORTED_KINDS[kind]
            or record["segment"] != "other"
            or record["material_signal"] != "explicit_steel_tube_product"
            or record["source_status"] != SOURCE_STATUS
        ):
            raise ValueError("Incorrect role, material relevance, or unreviewed source")
        for key in ("evidence_url", "role_evidence_url", "identity_evidence_url"):
            _official_url(record[key], domain)
    if len(set(holds)) != len(holds) or not set(holds).issubset(domains):
        raise ValueError("Unknown or duplicate review hold")
    return batch, kind, records, holds


async def run(*, manifest: Path = DEFAULT_MANIFEST, apply: bool = False,
              preflight_only: bool = False) -> dict:
    batch, kind, records, holds = validate_manifest(
        json.loads(manifest.read_text(encoding="utf-8"))
    )
    if apply and preflight_only:
        raise ValueError("Choose read-only preflight or explicit apply")
    if apply and (len(records) < 50 or holds):
        raise RuntimeError(
            "NET-GROWTH3.D import blocked: require 50..100 independently sourced "
            "businesses and zero legal identity/source holds"
        )
    if not apply and not preflight_only:
        result = {
            "mode": "dry_run", "status": "research_only" if len(records) < 50 or holds
            else "ready_for_live_preflight", "kind": kind, "requested": len(records),
            "held_for_review": len(holds), "ready_count": len(records) - len(holds),
            "new_unconfirmed": 0, "published": 0,
        }
        print(json.dumps(result, sort_keys=True))
        return result

    url, key = credentials_from_environment()
    if url != "https://ecrafjdummcdfycznitx.supabase.co" or not key.startswith("sb_secret_"):
        raise RuntimeError("Dedicated production service-role secret and URL required")

    async with httpx.AsyncClient(timeout=httpx.Timeout(40), follow_redirects=False) as client:
        await preflight(client, url, key, records)
        if preflight_only:
            result = {
                "mode": "preflight", "kind": kind, "requested": len(records),
                "held_for_review": len(holds), "status": "verified_no_write",
                "new_unconfirmed": 0, "published": 0,
            }
            print(json.dumps(result, sort_keys=True))
            return result

        core_records = [
            {key: record[key] for key in EXPECTED}
            for record in records
        ]
        rpc = (
            "netdensity3_seed_first_party"
            if kind == "trader" else "netgrowth3d_stage_industrial"
        )
        response = await client.post(
            f"{url}/rest/v1/rpc/{rpc}",
            headers={
                "apikey": key, "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "SmartSteelSales-NETGROWTH3D/1.0",
            },
            json={
                "p_batch": batch,
                "p_items": legacy_rpc_items(core_records),
            },
        )
    if response.status_code != 200:
        raise RuntimeError(f"Governed role-correct intake unavailable: HTTP {response.status_code}")

    payload = response.json()
    contract = (
        "netdensity3-bulk-v1" if kind == "trader"
        else "netgrowth3d-industrial-atomic-v1"
    )
    if (
        not isinstance(payload, dict)
        or payload.get("contract") != contract
        or payload.get("status") != "completed"
        or payload.get("requested") != len(records)
        or payload.get("new_unconfirmed") != len(records)
        or payload.get("duplicates") != 0
        or payload.get("invalid") != 0
        or payload.get("published") != 0
        or payload.get("verified_buyers") != 0
    ):
        raise RuntimeError("Unexpected intake outcome: reconcile database before retry")
    result = {
        "mode": "apply", "status": "completed", "kind": kind,
        "requested": len(records), "new_unconfirmed": len(records),
        "duplicates": 0, "invalid": 0, "published": 0,
    }
    print(json.dumps(result, sort_keys=True))
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="NET-GROWTH3.D source-backed role-correct intake")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument("--dry-run", action="store_true")
    modes.add_argument("--preflight", action="store_true")
    modes.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    asyncio.run(run(
        manifest=args.manifest, apply=args.apply, preflight_only=args.preflight
    ))
