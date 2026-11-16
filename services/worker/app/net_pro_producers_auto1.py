"""NET-PRO-PRODUCERS1.AUTO1.A — bounded first-party manufacturer evidence intake.

Only a service-role Railway worker can lease canonical producer sites. Scraping
does NOT publish technical assertions: evidence is stored privately as candidate
facts for separate per-attribute verification. A producer role does not certify
tube production. Never infer a product SKU from isolated norm/grade/range claims.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
from html.parser import HTMLParser
import ipaddress
import json
import os
import re
import socket
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

import httpx

USER_AGENT = "SmartSteelSalesTechnicalEvidenceBot/1.0"
MAX_BATCH = 25
MAX_HTML_BYTES = 512_000
MAX_TEXT_CHARS = 80_000
MAX_CANDIDATES = 25

# These are RESEARCH CANDIDATES only, even for a company tagged "producer".
TOKEN_PATTERNS = (
    ("technical_standard", re.compile(r"(?<![\w])EN[\s\u00a0]+(?:10219|10210|10305)(?:[\-–][12-5])?(?![\d])", re.I)),
    ("steel_grade", re.compile(r"(?<![\w])S(?:235|275|355|420|460)(?:JR|J0|J2|M|ML|N|NL)?H(?![\w])", re.I)),
    ("manufacturing_process", re.compile(r"\b(?:tubi saldati|tubi senza saldatura|tubi elettrosaldati|welded steel tubes|seamless steel tubes)\b", re.I)),
)

class SafeHtmlText(HTMLParser):
    """Discard scripts, CSS and navigation. No HTML is saved to the database."""
    SKIP = {"script", "style", "noscript", "nav", "footer", "header"}
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self._skip = []
        self._pieces = []
        self._chars = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self._skip.append(tag)
        elif tag in {"p", "li", "article", "h1", "h2", "h3", "h4", "tr", "br"} and not self._skip:
            self._pieces.append("\n")

    def handle_endtag(self, tag):
        if self._skip and self._skip[-1] == tag:
            self._skip.pop()

    def handle_data(self, data):
        if self._skip or self._chars >= MAX_TEXT_CHARS:
            return
        data = data.strip()
        if not data:
            return
        data = data[:MAX_TEXT_CHARS-self._chars]
        self._chars += len(data)
        self._pieces.append(" " + data)

    def text(self):
        return " ".join(" ".join(self._pieces).split())[:MAX_TEXT_CHARS]


def safe_official_url(value: str, canonical_domain: str) -> bool:
    try:
        parsed = urlsplit(value)
        host = (parsed.hostname or "").lower().rstrip(".")
        canonical = canonical_domain.lower().rstrip(".")
        if parsed.scheme != "https" or parsed.username or parsed.password:
            return False
        if parsed.port not in (None, 443) or not canonical or not host:
            return False
        if host != canonical and host != "www." + canonical:
            return False
        if any(c in host for c in ("_", "@", " ")):
            return False
        try:
            ipaddress.ip_address(host)
            return False
        except ValueError:
            return "." in host and host not in ("localhost", "localhost.localdomain")
    except (ValueError, TypeError, AttributeError):
        return False


def public_dns_only(host: str) -> bool:
    """Best-effort SSRF guard. HTTPS, no redirects and canonical domain required too."""
    try:
        ips = {info[4][0] for info in socket.getaddrinfo(host, 443, proto=socket.IPPROTO_TCP)}
        return bool(ips) and all(ipaddress.ip_address(ip).is_global for ip in ips)
    except (socket.gaierror, OSError, ValueError):
        return False


def extract_candidates(html: str) -> list[dict]:
    parser = SafeHtmlText()
    parser.feed(html[:MAX_HTML_BYTES])
    text = parser.text()
    seen = set()
    candidates = []
    for kind, pattern in TOKEN_PATTERNS:
        for match in pattern.finditer(text):
            claim = match.group(0)
            # The exact text observed on the source must remain in a short excerpt.
            excerpt = text[max(0, match.start()-80):min(len(text), match.end()+80)]
            key = (kind, claim.casefold())
            if key in seen:
                continue
            seen.add(key)
            candidates.append({
                "claim_kind": kind,
                "claim_value": claim,
                "evidence_excerpt": excerpt[:240],
            })
            if len(candidates) >= MAX_CANDIDATES:
                return candidates
    return candidates


def parse_lease(payload: object) -> list[dict]:
    if not isinstance(payload, dict) or payload.get("contract") != "netproducers1-auto1-claim-v1":
        raise ValueError("Invalid lease contract")
    items = payload.get("items")
    if not isinstance(items, list) or len(items) > MAX_BATCH or payload.get("count") != len(items):
        raise ValueError("Invalid lease list")
    for row in items:
        if not isinstance(row, dict) or not safe_official_url(
            row.get("source_url", ""), row.get("canonical_domain", "")
        ):
            raise ValueError("Unexpected non-canonical page")
    return items


def db_rpc(db, name: str, arguments: dict) -> dict:
    res = db.rpc(name, arguments).execute()
    if not isinstance(res.data, dict):
        raise ValueError("Unexpected RPC response")
    return res.data


async def fetch_official_page(client: httpx.AsyncClient, lease: dict) -> dict:
    url = lease["source_url"]
    host = urlsplit(url).hostname
    if not host or not public_dns_only(host):
        return {"status": "blocked", "error": "dns_not_public"}

    robots_url = f"https://{host}/robots.txt"
    try:
        robots = await client.get(robots_url, headers={"User-Agent": USER_AGENT})
        if robots.status_code == 200:
            if len(robots.content) > 100_000:
                return {"status": "blocked", "error": "robots_too_large"}
            rules = RobotFileParser()
            rules.parse(robots.text.splitlines())
            if not rules.can_fetch(USER_AGENT, url):
                return {"status": "blocked", "error": "robots_disallow"}
        elif robots.status_code not in (404, 410):
            return {"status": "blocked", "error": "robots_unknown"}
    except (httpx.HTTPError, UnicodeError):
        return {"status": "blocked", "error": "robots_unavailable"}

    headers = {"User-Agent": USER_AGENT, "Accept": "text/html"}
    if isinstance(lease.get("etag"), str) and lease["etag"]:
        headers["If-None-Match"] = lease["etag"][:200]
    if isinstance(lease.get("last_modified"), str) and lease["last_modified"]:
        headers["If-Modified-Since"] = lease["last_modified"][:200]

    try:
        async with client.stream("GET", url, headers=headers) as response:
            if response.status_code == 304:
                return {"status": "unchanged", "sha256": lease.get("last_sha256")}
            if response.status_code != 200:
                return {"status": "failed", "error": "http_" + str(response.status_code)}
            if "text/html" not in response.headers.get("content-type", "").lower():
                return {"status": "blocked", "error": "not_html"}
            content = bytearray()
            async for chunk in response.aiter_bytes():
                content.extend(chunk)
                if len(content) > MAX_HTML_BYTES:
                    return {"status": "blocked", "error": "html_too_large"}
            raw = bytes(content)
            digest = hashlib.sha256(raw).hexdigest()
            if digest == lease.get("last_sha256"):
                return {"status": "unchanged", "sha256": digest}
            text = raw.decode("utf-8", errors="replace")
            return {
                "status": "processed",
                "sha256": digest,
                "etag": response.headers.get("etag", "")[:200] or None,
                "last_modified": response.headers.get("last-modified", "")[:200] or None,
                "candidates": extract_candidates(text),
            }
    except httpx.HTTPError:
        return {"status": "failed", "error": "http_transport_error"}


async def run(db, *, limit: int = 10, dry_run: bool = True) -> dict:
    if not 1 <= limit <= MAX_BATCH:
        raise ValueError("1-25 companies per worker call")
    if dry_run:
        # Status-only default: do not lease anything or contact external websites.
        return {"mode": "dry_run", "status": db_rpc(db, "netproducers1_auto1_status", {})}

    # Grow the durable queue automatically as newly published canonical IT
    # producers appear. Only the private service role can invoke this RPC.
    # Existing sources are skipped by the idempotent DB seed.
    seed = db_rpc(db, "netproducers1_auto1_seed", {"p_limit": 100})
    if (seed.get("contract") != "netproducers1-auto1-seed-v1"
            or type(seed.get("added")) is not int
            or not 0 <= seed["added"] <= 100):
        raise ValueError("Invalid automatic seed response")

    leases = parse_lease(db_rpc(db, "netproducers1_auto1_claim", {"p_limit": limit}))
    outcomes = []
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(12.0), follow_redirects=False, trust_env=False,
    ) as client:
        for idx, lease in enumerate(leases):
            if idx:
                await asyncio.sleep(1.5)  # avoid hammering first-party hosts
            outcome = await fetch_official_page(client, lease)
            result = db_rpc(db, "netproducers1_auto1_complete", {
                "p_company_id": lease["company_id"],
                "p_source_sha256": outcome.get("sha256"),
                "p_status": outcome["status"],
                "p_candidates": outcome.get("candidates", []),
                "p_etag": outcome.get("etag"),
                "p_last_modified": outcome.get("last_modified"),
                "p_error": outcome.get("error"),
            })
            outcomes.append({
                "company_id": lease["company_id"],
                "status": outcome["status"],
                "candidate_count": result.get("candidate_count", 0),
                "published_claims": 0,
            })
    # Per-attribute verification is independent from collection. It never
    # publishes manufacturing capability, size/grade combinations or stock.
    verification = db_rpc(db, "netproducers1_auto1b_verify", {"p_limit": 100})
    return {"mode": "private_candidate_intake", "new_sources": seed["added"],
            "processed": len(outcomes),
            "new_candidates": sum(x["candidate_count"] for x in outcomes),
            "verification": verification,
            "published_claims": 0, "outcomes": outcomes}


def main() -> int:
    parser = argparse.ArgumentParser(description="Incremental first-party producer research")
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--persist", action="store_true", help="Lease + fetch + private candidate write")
    args = parser.parse_args()
    from supabase import create_client
    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    print(json.dumps(asyncio.run(run(db, limit=args.limit, dry_run=not args.persist)), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
