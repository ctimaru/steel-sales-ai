"""NET-VAT1 fase 3: cross-check published Italian P.IVA with VIES.

VIES is the European Commission's official VAT validation service. For Italy
it only lists VAT numbers enabled for intra-EU trade, so "not in VIES" is
recorded but never treated as an error. A valid number registered to a clearly
different company (typically a web agency's P.IVA in the footer) is reported
as a mismatch and the database removes it from the profile.

Polite by design: one request at a time, a pause between requests, a bounded
batch per cron run, and national-service outages are simply retried later.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os

import httpx

from .net_vat1_extract import vies_name_match

VERSION = "net-vat1-vies-v1"
VIES_URL = "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number"
MAX_BATCH = 200
USER_AGENT = "SteelSalesAI-VatCheck/1.0 (+public-company-profile-crawler)"


def interpret_vies(payload: object, legal_name: str) -> dict:
    """Map a VIES REST answer to {'status', 'name_match', 'registered_name'}."""
    if not isinstance(payload, dict):
        return {"status": "unavailable"}
    if payload.get("actionSucceed") is False or payload.get("errorWrappers"):
        return {"status": "unavailable"}
    valid = payload.get("valid", payload.get("isValid"))
    if valid is True:
        name = payload.get("name")
        name = name.strip() if isinstance(name, str) else None
        if name in ("", "---"):
            name = None
        return {"status": "valid", "name_match": vies_name_match(legal_name, name),
                "registered_name": name}
    if valid is False:
        return {"status": "not_in_vies"}
    return {"status": "unavailable"}


async def check_vat(client: httpx.AsyncClient, vat: str, legal_name: str) -> dict:
    try:
        response = await client.post(VIES_URL, json={"countryCode": "IT", "vatNumber": vat},
                                     headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    except httpx.HTTPError:
        return {"status": "unavailable"}
    if response.status_code != 200:
        return {"status": "unavailable"}
    try:
        return interpret_vies(response.json(), legal_name)
    except ValueError:
        return {"status": "unavailable"}


async def execute(*, limit: int = 100, pause_seconds: float = 1.5) -> dict:
    if limit not in range(1, MAX_BATCH + 1):
        raise ValueError("limit must be 1..200")
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise RuntimeError("server-side database credential unavailable")
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    outcomes: dict[str, int] = {}
    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as db, \
            httpx.AsyncClient(timeout=httpx.Timeout(20.0), follow_redirects=False) as vies:
        queue = await db.post(f"{url}/rest/v1/rpc/net_vat1_vies_queue", headers=headers,
                              json={"p_max": limit})
        queue.raise_for_status()
        payload = queue.json()
        if payload.get("contract") != "net-vat1-vies-queue-v1":
            raise RuntimeError("unexpected VIES queue contract")
        consecutive_unavailable = 0
        for index, item in enumerate(payload.get("items", [])):
            if index and pause_seconds:
                await asyncio.sleep(pause_seconds)
            result = await check_vat(vies, str(item["vat_id"]), str(item.get("legal_name") or ""))
            record = await db.post(
                f"{url}/rest/v1/rpc/net_vat1_record_vies", headers=headers,
                json={"p_company_id": item["id"], "p_vat": item["vat_id"],
                      "p_status": result["status"], "p_name_match": result.get("name_match"),
                      "p_registered_name": result.get("registered_name")})
            record.raise_for_status()
            outcome = str(record.json().get("outcome") or result["status"])
            outcomes[outcome] = outcomes.get(outcome, 0) + 1
            # The Italian national service is down: stop, leases expire, retry next run.
            consecutive_unavailable = consecutive_unavailable + 1 if outcome == "unavailable" else 0
            if consecutive_unavailable >= 5:
                break
    return {"version": VERSION, "checked": sum(outcomes.values()), "outcomes": outcomes}


def main() -> int:
    parser = argparse.ArgumentParser(description="NET-VAT1 VIES cross-check")
    parser.add_argument("--limit", type=int, default=100, help="P.IVA per run, maximum 200")
    args = parser.parse_args()
    try:
        result = asyncio.run(execute(limit=args.limit))
    except (ValueError, RuntimeError, httpx.HTTPError) as exc:
        print(json.dumps({"status": "vies_check_failed", "error_type": type(exc).__name__}))
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
