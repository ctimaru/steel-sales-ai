"""TRADER1D.3B — scheduled, read-only, robots-aware EU source HEAD metadata refresh.

No company-content downloads, license inference, company publication, claim, personal
data extraction or database writes. The manifest is a snapshot of public first-party
role-evidence URLs already present in private research, not a scraping permission.
"""
from __future__ import annotations

import argparse
import asyncio
from datetime import date, datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

import httpx

from .company_discovery import (
    CompanyDiscoveryError,
    USER_AGENT,
    _assert_public_hostname,
    _robots_allows,
    canonical_domain,
    canonicalize_seed_url,
)
from .public_website_preview import BLOCKED

MAX_SOURCES = 250
MAX_PER_RUN = 5
DELAY_SECONDS = 2
EXPECTED_CONTRACT = "trader1d3b-source-seeds-v1"
EU = frozenset(
    "AT BE BG CY CZ DE DK EE ES FI FR GR HR HU IE IT LT LU LV MT NL PL PT RO SE SI SK".split()
)
ALLOWED_STATES = frozenset({
    "reachable_html", "reachable_unknown_type", "redirect_observed",
    "not_found", "access_denied", "rate_limited", "server_error",
    "method_not_supported", "robots_or_unavailable", "network_error", "http_other",
})


def load_manifest(path: Path) -> list[dict[str, str]]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict) or value.get("contract") != EXPECTED_CONTRACT:
        raise ValueError("Unknown source manifest contract")
    if value.get("source_rights") != "not_assessed":
        raise ValueError("This read-only pilot must never infer reuse permission")
    items = value.get("items")
    if not isinstance(items, list) or not 1 <= len(items) <= MAX_SOURCES:
        raise ValueError("Source count exceeds the approved budget")
    result: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in items:
        if not isinstance(item, dict):
            raise ValueError("Malformed manifest entry")
        domain = item.get("domain")
        market = item.get("market")
        raw_url = item.get("source_url")
        if not all(isinstance(x, str) for x in (domain, market, raw_url)):
            raise ValueError("Missing domain, market or first-party source URL")
        if not re.fullmatch(r"[a-z0-9][a-z0-9.-]{2,180}", domain):
            raise ValueError("Invalid company domain")
        if market not in EU or domain in seen:
            raise ValueError("Duplicate domain or market outside EU")
        if len(raw_url) > 500:
            raise ValueError("Excessive source URL")
        normalized = canonicalize_seed_url(raw_url)
        if (urlsplit(normalized).scheme != "https"
                or canonical_domain(normalized) != domain
                or any(domain == b or domain.endswith("." + b) for b in BLOCKED)):
            raise ValueError("Only first-party HTTPS business websites are permitted")
        seen.add(domain)
        result.append({"domain": domain, "market": market, "source_url": normalized})
    # Rotation identity must be independent of ingestion order.
    return sorted(result, key=lambda item: item["domain"])


def select_batch(items: list[dict[str, str]], day: date) -> tuple[int, list[dict[str, str]]]:
    if not items or len(items) > MAX_SOURCES:
        raise ValueError("Invalid bounded manifest")
    buckets = (len(items) + MAX_PER_RUN - 1) // MAX_PER_RUN
    slot = (day - date(2026, 10, 20)).days % buckets
    return slot, items[slot * MAX_PER_RUN:(slot + 1) * MAX_PER_RUN]


def load_prior(path: Path) -> dict[str, dict[str, str]]:
    if not path.exists():
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        if value.get("contract") != "trader1d3b-state-v1":
            return {}
        rows = value.get("items", {})
        if not isinstance(rows, dict) or len(rows) > MAX_SOURCES:
            return {}
        return {
            k: v for k, v in rows.items()
            if isinstance(k, str) and isinstance(v, dict)
            and v.get("status") in ALLOWED_STATES
            and isinstance(v.get("fingerprint"), str)
            and re.fullmatch(r"[a-f0-9]{64}", v["fingerprint"])
            and isinstance(v.get("last_checked_at"), str)
        }
    except (ValueError, OSError, TypeError, AttributeError):
        # GitHub Actions cache is best-effort; never claim "unchanged" without history.
        return {}


async def inspect_source(client: httpx.AsyncClient, item: dict[str, str]) -> dict[str, str | int | None]:
    url = item["source_url"]
    # Robots.txt is fetched via existing SSRF-protected bounded GET; the company
    # page itself is checked with HEAD ONLY, without reading page content.
    try:
        if not await _robots_allows(client, url, url):
            return {"status": "robots_or_unavailable", "http_status": None,
                    "content_type": None, "fingerprint": None}
        parsed = urlsplit(url)
        if parsed.hostname is None:
            raise CompanyDiscoveryError("Missing source hostname")
        await _assert_public_hostname(parsed.hostname)
        response = await client.head(
            url, follow_redirects=False,
            headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
        )
        code = response.status_code
        content_type = response.headers.get("content-type", "").split(";", 1)[0].lower()[:80]
        if 200 <= code < 300:
            status = "reachable_html" if content_type in ("text/html", "application/xhtml+xml") else "reachable_unknown_type"
        elif 300 <= code < 400:
            status = "redirect_observed"  # No external redirect followed.
        elif code in (404, 410):
            status = "not_found"
        elif code == 403 or code == 401:
            status = "access_denied"
        elif code == 429:
            status = "rate_limited"
        elif code == 405 or code == 501:
            status = "method_not_supported"  # Not a broken website.
        elif code >= 500:
            status = "server_error"
        else:
            status = "http_other"
        # Fingerprint only metadata, not copyrighted page text or personal data.
        fingerprint = sha256(
            ("|".join([url, status, str(code), content_type,
                       response.headers.get("etag", "")[:180],
                       response.headers.get("last-modified", "")[:100]])).encode("utf-8")
        ).hexdigest()
        return {"status": status, "http_status": code,
                "content_type": content_type or None, "fingerprint": fingerprint}
    except (httpx.HTTPError, CompanyDiscoveryError, ValueError, OSError):
        return {"status": "network_error", "http_status": None,
                "content_type": None, "fingerprint": None}


async def run(
    manifest: Path, state_path: Path, report_path: Path, *,
    day: date | None = None, delay: float = DELAY_SECONDS,
    client: httpx.AsyncClient | None = None,
) -> dict[str, object]:
    items = load_manifest(manifest)
    today = day or datetime.now(timezone.utc).date()
    slot, batch = select_batch(items, today)
    old = load_prior(state_path)
    state = {k: v for k, v in old.items() if k in {i["domain"] for i in items}}
    owns_client = client is None
    if client is None:
        client = httpx.AsyncClient(timeout=httpx.Timeout(12), follow_redirects=False,
                                   trust_env=False)
    outcomes: list[dict[str, object]] = []
    try:
        for ix, item in enumerate(batch):
            check = await inspect_source(client, item)
            domain = item["domain"]
            previous = state.get(domain)
            fp = str(check.get("fingerprint") or "")
            if previous is None:
                change = "first_observation"
            elif previous["fingerprint"] == fp and previous["status"] == check["status"]:
                change = "unchanged"
            else:
                change = "changed"
            timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
            if fp:
                state[domain] = {"status": str(check["status"]),
                                 "fingerprint": fp, "last_checked_at": timestamp}
            # Failure cannot overwrite prior fingerprint; preserve last success, report failure.
            outcomes.append({
                "domain": domain, "market": item["market"],
                "source_url": item["source_url"], "checked_at": timestamp,
                "status": check["status"], "http_status": check["http_status"],
                "content_type": check["content_type"],
                "change": change if fp else "observation_unavailable",
            })
            if ix < len(batch) - 1 and delay:
                await asyncio.sleep(delay)
    finally:
        if owns_client:
            await client.aclose()
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(json.dumps({"contract": "trader1d3b-state-v1",
        "items": state}, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    report = {
        "contract": "trader1d3b-report-v1", "mode": "READ_ONLY_HEAD_METADATA",
        "date_utc": today.isoformat(), "batch_slot": slot,
        "manifest_count": len(items), "checked_count": len(outcomes),
        "observed_in_cache": len(state),
        "outcomes": outcomes, "supabase_writes": 0, "published": 0,
        "source_rights_updated": 0, "company_content_captured": False,
        "cache_warning": "Best-effort CI cache; loss resets change detection, not source rights.",
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n",
                           encoding="utf-8")
    return report


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path,
                        default=Path("data/trader1d3b_sources.json"))
    parser.add_argument("--state", type=Path,
                        default=Path("data/trader1d3b_state.json"))
    parser.add_argument("--report", type=Path,
                        default=Path("trader1d3b_report.json"))
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    if args.validate_only:
        print(json.dumps({"manifest_count": len(load_manifest(args.manifest)),
                          "network_requests": 0, "published": 0}))
        return 0
    report = await run(args.manifest, args.state, args.report)
    # Safe aggregate output; detailed sourced URL metadata only in artifact.
    summary = {k: report[k] for k in
               ("contract", "date_utc", "batch_slot", "manifest_count",
                "checked_count", "observed_in_cache", "supabase_writes", "published")}
    summary["reachable_count"] = sum(
        str(row["status"]).startswith("reachable") for row in report["outcomes"])
    print(json.dumps(summary, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
