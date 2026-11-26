"""NET-CONTACT2: run the NET-CONTACT1 company-channel collection on a schedule.

Founder decision (26 nov 2026): collect the email of every Network company,
with the same rules as NET-CONTACT1 (2 nov 2026): only a generic mailbox on
the company's own domain (info@, commerciale@, vendite@…) and the switchboard
phone, read from the official website; never personal names, mobiles, or
mailboxes on Gmail/Libero and similar providers.

Each cron run:
1. takes up to --lots × 25 never-visited companies from the NET-CONTACT1 queue
   (each visited company leaves the queue for 30 days);
2. reads home + contact pages with the existing protected fetcher;
3. before staging an email, checks that its domain receives mail (MX record,
   via DNS-over-HTTPS; nothing is ever sent);
4. stages channels through the existing NET-CONTACT1 RPC, then publishes the
   strict generic company mailboxes through PROD-EMAIL1.B's audited review.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os

import httpx

from .company_discovery import CompanyDiscoveryError
from .netcontact1_public_contacts import MAX_SITES, examine, next_batch, stage

VERSION = "net-contact2-collector-v1"
MAX_LOTS = 3
DOH_URL = "https://cloudflare-dns.com/dns-query"
ALLOWED_RPCS = ("netcontact1_next_batch", "netcontact1_stage_company_channel",
                "netcontact1_record_attempt", "net_contact2_auto_publish")


class ServiceRpc:
    """Same call shape as NET-CONTACT1's client, with the worker service key."""

    def __init__(self, url: str, key: str):
        self._url, self._key = url.rstrip("/"), key

    def rpc(self, name: str, params: dict):
        if name not in ALLOWED_RPCS:
            raise ValueError("Unexpected RPC")
        client = self

        class _Call:
            def execute(self):
                response = httpx.post(
                    f"{client._url}/rest/v1/rpc/{name}", json=params, timeout=httpx.Timeout(30),
                    headers={"apikey": client._key, "Authorization": f"Bearer {client._key}",
                             "Content-Type": "application/json", "Accept": "application/json"},
                    follow_redirects=False)
                if response.status_code != 200:
                    raise RuntimeError(f"RPC {name} returned HTTP {response.status_code}")

                class _Result:
                    data = response.json()
                return _Result()
        return _Call()


def interpret_doh(payload: object) -> str:
    """'mx' | 'no_mx' | 'unknown' from a DNS-over-HTTPS JSON answer."""
    if not isinstance(payload, dict) or not isinstance(payload.get("Status"), int):
        return "unknown"
    if payload["Status"] == 3:  # NXDOMAIN
        return "no_mx"
    if payload["Status"] != 0:
        return "unknown"
    answers = payload.get("Answer") or []
    return "mx" if any(isinstance(a, dict) and a.get("type") == 15 for a in answers) else "no_mx"


async def mail_domain_status(client: httpx.AsyncClient, email: str) -> str:
    domain = email.rsplit("@", 1)[-1].strip().lower()
    if not domain or "." not in domain:
        return "no_mx"
    try:
        response = await client.get(DOH_URL, params={"name": domain, "type": "MX"},
                                    headers={"Accept": "application/dns-json"})
        if response.status_code != 200:
            return "unknown"
        return interpret_doh(response.json())
    except (httpx.HTTPError, ValueError):
        return "unknown"


async def run_lot(db, entries: list[dict], *, pause: float = 2.0) -> dict:
    counts: dict[str, int] = {}
    async with httpx.AsyncClient(timeout=httpx.Timeout(10), follow_redirects=False) as web, \
            httpx.AsyncClient(timeout=httpx.Timeout(10)) as dns:
        for index, item in enumerate(entries):
            if index and pause:
                await asyncio.sleep(pause)
            try:
                result = await examine(web, item)
            except (httpx.HTTPError, CompanyDiscoveryError, ValueError):
                result = dict(status="blocked_or_unavailable", email=None, phone=None)
            email, phone = result.get("email"), result.get("phone")
            if email and await mail_domain_status(dns, email[0]) == "no_mx":
                counts["email_domain_without_mx"] = counts.get("email_domain_without_mx", 0) + 1
                email = None
            status = result["status"] if (email or phone or result["status"] != "sourced_channel") \
                else "no_company_channel"
            try:
                db.rpc("netcontact1_record_attempt",
                       {"p_company_id": item["company_id"], "p_outcome": status}).execute()
            except RuntimeError:  # company unpublished meanwhile: skip it
                continue
            counts[status] = counts.get(status, 0) + 1
            if email or phone:
                try:
                    staged = stage(db, item["company_id"], email, phone)
                except RuntimeError:
                    staged = ["rejected_or_unavailable"]
                if email and any(s in ("staged", "existing") for s in staged):
                    counts["email_staged"] = counts.get("email_staged", 0) + 1
    return counts


async def execute(*, lots: int = 2) -> dict:
    if lots not in range(1, MAX_LOTS + 1):
        raise ValueError("lots must be 1..3")
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise RuntimeError("server-side database credential unavailable")
    db = ServiceRpc(url, key)
    totals: dict[str, int] = {}
    eligible = None
    for _ in range(lots):
        entries, eligible_now, skipped = next_batch(db, MAX_SITES)
        eligible = eligible_now if eligible is None else eligible
        for company_id in skipped:
            try:
                db.rpc("netcontact1_record_attempt",
                       {"p_company_id": company_id, "p_outcome": "blocked_or_unavailable"}).execute()
            except RuntimeError:
                pass
        totals["skipped_identity_mismatch"] = totals.get("skipped_identity_mismatch", 0) + len(skipped)
        if not entries:
            break
        for name, value in (await run_lot(db, entries)).items():
            totals[name] = totals.get(name, 0) + value
    published = db.rpc("net_contact2_auto_publish", {"p_limit": 200}).execute().data
    return {"version": VERSION, "eligible_before_run": eligible, "outcomes": totals,
            "published": (published or {}).get("published", 0) if isinstance(published, dict) else 0}


def main() -> int:
    parser = argparse.ArgumentParser(description="NET-CONTACT2 scheduled company-channel collection")
    parser.add_argument("--lots", type=int, default=2, help="Lots of 25 sites per run, maximum 3")
    args = parser.parse_args()
    try:
        result = asyncio.run(execute(lots=args.lots))
    except (ValueError, RuntimeError, httpx.HTTPError) as exc:
        print(json.dumps({"status": "contact_collection_failed", "error_type": type(exc).__name__}))
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
