"""NET-GROWTH3.C — guarded bulk Italian trader cohorts (50–100).

Reads independently documented company-owned pages only. Business facts are
original and do not contain personal data. No new ownership, CRM, crawlers or
canonically published profiles. Unresolved sources block the entire live batch.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
from pathlib import Path

import httpx

from .github_actions_crawler import credentials_from_environment
from .netgrowth3b_firstparty_batch import (
    legacy_rpc_items, preflight, validate_manifest as validate_legacy,
)

MANIFEST = Path(__file__).resolve().parents[1] / "data" / "netgrowth3c_italian_traders_20261105.json"
BATCH = "NET-GROWTH3C-IT-TRADERS-20261105-A"


def validate_manifest(data: object) -> tuple[str, list[dict[str, str]], list[str]]:
    if not isinstance(data, dict) or set(data) != {
        "batch", "observed_date", "records", "review_hold_domains",
    }:
        raise ValueError("NET-GROWTH3.C requires provenance and explicit review holds")
    if data["batch"] != BATCH or data["observed_date"] != "2026-11-05":
        raise ValueError("Unexpected source cohort identity")
    records = data["records"]
    if not isinstance(records, list) or not 50 <= len(records) <= 100:
        raise ValueError("Only source-backed cohorts of 50–100 are admitted")
    hold = data["review_hold_domains"]
    if not isinstance(hold, list) or len(hold) != len(set(hold)) or not all(
        isinstance(domain, str) and domain for domain in hold
    ):
        raise ValueError("Invalid review-hold list")
    if not set(hold).issubset({r["domain"] for r in records if isinstance(r, dict) and "domain" in r}):
        raise ValueError("Unknown company held for review")
    # Reuse the already-tested safety checks for each of the original 7 fields.
    _, records = validate_legacy({
        "batch": BATCH,
        "observed_date": "2026-11-04",
        "records": records,
    })
    if len(set(r["name"].lower().strip() for r in records)) != len(records):
        raise ValueError("Duplicate company identity names")
    return BATCH, records, hold


async def run(*, apply: bool, preflight_only: bool = False,
              manifest: Path = MANIFEST) -> dict:
    batch, records, hold = validate_manifest(json.loads(
        manifest.read_text(encoding="utf-8")
    ))
    if preflight_only and apply:
        raise ValueError("Select read-only preflight or explicit apply")
    if not preflight_only and not apply:
        report = {"mode": "dry_run", "status": "validated_offline",
                  "requested": len(records), "held_for_source_review": len(hold),
                  "ready_for_review": len(records) - len(hold),
                  "new_unconfirmed": 0, "published": 0}
        print(json.dumps(report, sort_keys=True))
        return report
    if hold and apply:
        raise RuntimeError("Source review holds must be cleared before any import")
    url, key = credentials_from_environment()
    if not url.startswith("https://") or not key.startswith("sb_secret_"):
        raise RuntimeError("Dedicated service-role HTTPS connection required")
    async with httpx.AsyncClient(timeout=httpx.Timeout(45), follow_redirects=False) as client:
        # Even on a read-only request, examine all existing domain sources.
        await preflight(client, url, key, records)
        if preflight_only:
            report = {"mode": "preflight", "status": "read_only_complete",
                      "requested": len(records), "held_for_source_review": len(hold),
                      "new_unconfirmed": 0, "published": 0}
            print(json.dumps(report, sort_keys=True))
            return report
        resp = await client.post(
            url + "/rest/v1/rpc/netdensity3_seed_first_party",
            headers={"apikey": key, "Content-Type": "application/json",
                     "Accept": "application/json",
                     "User-Agent": "SmartSteelSales-NETGROWTH3C/1.0"},
            json={"p_batch": batch, "p_items": legacy_rpc_items(records)},
        )
    if resp.status_code != 200:
        raise RuntimeError(f"Governed service-only intake unavailable: HTTP {resp.status_code}")
    result = resp.json()
    if (not isinstance(result, dict) or result.get("contract") != "netdensity3-bulk-v1"
            or result.get("status") != "completed" or result.get("requested") != len(records)
            or result.get("published") != 0 or result.get("verified_buyers") != 0
            or not all(isinstance(result.get(x), int)
                       for x in ("new_unconfirmed", "duplicates", "invalid"))):
        raise RuntimeError("Unexpected NET-GROWTH3.C import contract")
    report = {"mode": "apply", "requested": len(records),
              "new_unconfirmed": result["new_unconfirmed"],
              "duplicates": result["duplicates"], "invalid": result["invalid"],
              "published": 0, "verified_buyers": 0}
    print(json.dumps(report, sort_keys=True))
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="NET-GROWTH3.C source-reviewed industrial traders")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--preflight", action="store_true")
    mode.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    asyncio.run(run(apply=args.apply, preflight_only=args.preflight))
