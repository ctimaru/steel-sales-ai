"""NET-IT-VIES1: unblock Italian Network candidates whose official site does
not print the ragione sociale with its legal form.

Founder decision (27 nov 2026): the legal form is verified with the P.IVA and
VIES, the link with steel by reading the company's own site. Sole traders and
companies without a corporate legal form stay excluded.

For every leased candidate (``net_it_vies1_queue``):
1. read the official HTTPS site (homepage, legal/contact and activity pages)
   through the robots-, SSRF-, redirect- and size-protected fetcher;
2. find the company's own P.IVA on those pages (check digit, no web-agency
   credits);
3. ask VIES: the number must be valid, registered to a name matching the
   candidate (name or domain) with S.r.l./S.r.l.s./S.p.A./S.n.c./S.a.s.;
4. require at least one steel/metal-working term on the pages.
Only then ``net_it_vies1_apply`` stores the VIES legal name and an evidence
row; publication stays with AUTO3 and its own checks. With --dry-run nothing
is leased or written.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import re
from html import unescape

import httpx

from .company_discovery import CompanyDiscoveryError, _fetch_page, canonical_domain, canonicalize_seed_url
from .net_it_auto2_reviewer import RESTRICTED_REUSE, _identity_links
from .net_research1_pipeline import research_links
from .net_vat1_extract import find_firstparty_vat, vies_name_match
from .net_vat1_vies import check_vat

VERSION = "net-it-vies1-unblock-v1"
MAX_BATCH = 50
MAX_IDENTITY_PAGES = 5
MAX_ACTIVITY_PAGES = 3
VIES_PAUSE_SECONDS = 1.5
MAX_VIES_UNAVAILABLE = 5

# Corporate legal forms admitted by AUTO3 (never ditte individuali).
_FORM = (r"(s\.?\s?r\.?\s?l\.?(?:\s?s\.?)?|s\.?\s?p\.?\s?a\.?|s\.?\s?n\.?\s?c\.?|s\.?\s?a\.?\s?s\.?)")
LEGAL_FORM_RE = re.compile(r"(?:^|[^a-z0-9])" + _FORM + r"(?![a-z0-9])", re.I)
WINDING_UP_RE = re.compile(r"\b(?:in\s+liquidazione|liquidazione|fallimento|fallita|cessata)\b", re.I)
CANONICAL_FORMS = {"srl": "S.r.l.", "srls": "S.r.l.s.", "spa": "S.p.A.", "snc": "S.n.c.", "sas": "S.a.s."}

# The company produces, works, trades or uses steel and metal products.
STEEL_TERMS = re.compile(
    r"\b(acciai\w*|inox|ferr(?:o|i|osi|osa|ose)\b|metall\w*|metalmeccanic\w*|lamier\w*|tub[io]\b|"
    r"tubolar\w*|tubazion\w*|profilat\w*|carpenteri\w*|saldat\w*|saldatur\w*|laminat\w*|"
    r"siderurg\w*|fucinat\w*|forgiat\w*|stampaggi\w*|tornit\w*|torneri\w*|zincat\w*|"
    r"lattoneri\w*|caldareri\w*|raccord\w*|flang\w*|trafilat\w*|piegatur\w*|calandratur\w*|"
    r"taglio\s+laser|lavorazioni\s+meccaniche|meccanica\s+di\s+precisione|"
    r"steel|stainless|metalwork\w*|sheet\s+metal|welding|forging|pipes?\b|tubes?\b)",
    re.I,
)


def steel_terms(texts: list[str]) -> list[str]:
    found: dict[str, None] = {}
    for text in texts:
        for match in STEEL_TERMS.finditer(text or ""):
            found.setdefault(match.group(1).casefold(), None)
            if len(found) >= 20:
                return list(found)
    return list(found)


def legal_form_key(registered_name: str) -> str | None:
    matches = list(LEGAL_FORM_RE.finditer(registered_name or ""))
    if not matches:
        return None
    return re.sub(r"[^a-z]", "", matches[-1].group(1).casefold())


def _stem(domain: str) -> str:
    first = (domain or "").casefold().removeprefix("www.").split(".")[0]
    return re.sub(r"[^a-z0-9]", "", first)


def _compact(value: str) -> str:
    value = LEGAL_FORM_RE.sub(" ", unescape(value or "").casefold().replace("f.lli", "fratelli"))
    return re.sub(r"[^a-z0-9]", "", value)


def identity_matches(candidate_name: str, domain: str, registered_name: str) -> bool:
    """The VIES holder is this candidate: same name, or the domain names it."""
    if vies_name_match(candidate_name, registered_name) == "match":
        return True
    stem, registered = _stem(domain), _compact(registered_name)
    if len(stem) >= 4 and len(registered) >= 4:
        return stem in registered or (len(registered) >= 5 and registered in stem)
    return False


def format_legal_name(registered_name: str, candidate_name: str = "") -> str:
    """VIES uppercase name → display name ending with the canonical legal form.

    Words also present in our candidate name keep its casing; acronyms stay
    upper case; any qualifier after the legal form (UNIPERSONALE, A SOCIO
    UNICO) is dropped.
    """
    raw = " ".join(unescape(registered_name or "").split())
    matches = list(LEGAL_FORM_RE.finditer(raw))
    if not matches:
        return ""
    last = matches[-1]
    form = CANONICAL_FORMS.get(re.sub(r"[^a-z]", "", last.group(1).casefold()))
    if not form:
        return ""
    head = raw[:last.start(1)].strip(" ,-'\"")
    known = {w.casefold(): w for w in re.findall(r"[^\s]+", candidate_name or "")
             if not LEGAL_FORM_RE.fullmatch(" " + w)}
    words = []
    for word in head.split():
        lower = word.casefold()
        if lower in known and not known[lower].islower():
            words.append(known[lower])
        elif lower == "f.lli":
            words.append("F.lli")
        elif lower in {"&", "e", "di", "de", "del", "della", "dei", "c.", "&c."}:
            words.append({"c.": "C.", "&c.": "&C."}.get(lower, lower))
        elif "." in word or any(ch.isdigit() for ch in word) or (len(word) <= 3 and word.isupper()):
            words.append(word.upper())
        elif word.isupper() or word.islower():
            words.append(word[:1].upper() + word[1:].lower())
        else:
            words.append(word)
    if not words:
        return ""
    words[0] = words[0][:1].upper() + words[0][1:]
    return f"{' '.join(words)} {form}"


def page_hash(pages: list) -> str:
    return hashlib.sha256(
        "\n".join(f"{p.url}\n{str(p.text)[:10000]}" for p in pages).encode("utf-8")
    ).hexdigest()


async def read_official_site(client: httpx.AsyncClient, candidate: dict) -> list:
    domain = str(candidate.get("domain") or "").lower().removeprefix("www.")
    try:
        home_url = canonicalize_seed_url(str(candidate["website_url"]))
    except (KeyError, TypeError, ValueError, CompanyDiscoveryError):
        return []
    if not domain or canonical_domain(home_url) != domain or not home_url.startswith("https://"):
        return []
    try:
        home = await _fetch_page(client, home_url, home_url)
    except (CompanyDiscoveryError, httpx.HTTPError, ValueError):
        return []
    if not home or canonical_domain(home.url) != domain or not home.url.startswith("https://"):
        return []
    pages, seen = [home], {home.url}
    links = list(_identity_links(home, MAX_IDENTITY_PAGES))
    links += [u for u in research_links(home, domain, MAX_ACTIVITY_PAGES + 2) if u not in links]
    activity = 0
    for index, link in enumerate(links):
        is_identity = index < MAX_IDENTITY_PAGES
        if link in seen or (not is_identity and activity >= MAX_ACTIVITY_PAGES):
            continue
        seen.add(link)
        try:
            page = await _fetch_page(client, link, home.url)
        except (CompanyDiscoveryError, httpx.HTTPError, ValueError):
            continue
        if page and canonical_domain(page.url) == domain and page.url.startswith("https://"):
            pages.append(page)
            activity += 0 if is_identity else 1
    return pages


class ViesGate:
    """Serialize VIES calls with a pause; stop after repeated unavailability."""

    def __init__(self, client: httpx.AsyncClient, pause: float = VIES_PAUSE_SECONDS) -> None:
        self.client, self.pause, self.lock = client, pause, asyncio.Lock()
        self.unavailable_streak = 0

    @property
    def closed(self) -> bool:
        return self.unavailable_streak >= MAX_VIES_UNAVAILABLE

    async def check(self, vat: str, name: str) -> dict:
        async with self.lock:
            if self.closed:
                return {"status": "unavailable"}
            result = await check_vat(self.client, vat, name)
            self.unavailable_streak = self.unavailable_streak + 1 if result.get("status") == "unavailable" else 0
            if self.pause:
                await asyncio.sleep(self.pause)
            return result


async def examine(client: httpx.AsyncClient, vies: ViesGate, candidate: dict) -> dict:
    """Return the decision for one candidate, never raising."""
    name, domain = str(candidate.get("name") or ""), str(candidate.get("domain") or "")
    pages = await read_official_site(client, candidate)
    if not pages:
        return {"outcome": "site_unreachable"}
    texts = [str(p.text) for p in pages]
    if any(RESTRICTED_REUSE.search(t) for t in texts):
        return {"outcome": "reuse_restricted"}
    finding = find_firstparty_vat(texts, name)
    if finding.outcome != "found" or finding.page_index is None or not finding.vat_id:
        return {"outcome": "no_vat_on_site"}
    vat, page_url = finding.vat_id, pages[finding.page_index].url
    answer = await vies.check(vat, name)
    status = answer.get("status")
    if status == "unavailable":
        return {"outcome": "vies_unavailable", "vat": vat}
    if status != "valid":
        return {"outcome": "not_in_vies", "vat": vat}
    registered = str(answer.get("registered_name") or "")
    if not registered or not legal_form_key(registered):
        return {"outcome": "sole_trader_or_no_legal_form", "vat": vat, "vies_name": registered}
    if WINDING_UP_RE.search(registered):
        return {"outcome": "in_liquidation", "vat": vat, "vies_name": registered}
    if not identity_matches(name, domain, registered):
        return {"outcome": "vies_name_mismatch", "vat": vat, "vies_name": registered}
    terms = steel_terms(texts)
    if not terms:
        return {"outcome": "no_steel_link", "vat": vat, "vies_name": registered}
    legal_name = format_legal_name(registered, name)
    if not legal_name:
        return {"outcome": "sole_trader_or_no_legal_form", "vat": vat, "vies_name": registered}
    return {"outcome": "verified", "vat": vat, "vies_name": registered, "legal_name": legal_name,
            "page_url": page_url, "steel_terms": terms, "page_hash": page_hash(pages)}


async def examine_batch(candidates: list[dict], *, vies_pause: float = VIES_PAUSE_SECONDS) -> list[dict]:
    semaphore = asyncio.Semaphore(4)
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0), follow_redirects=False) as client, \
            httpx.AsyncClient(timeout=httpx.Timeout(20.0)) as vies_client:
        vies = ViesGate(vies_client, vies_pause)

        async def one(candidate: dict) -> dict:
            async with semaphore:
                try:
                    result = await examine(client, vies, candidate)
                except Exception:  # one broken site must not stop the batch
                    result = {"outcome": "site_unreachable"}
                return {"id": str(candidate.get("id")), **result}
        return list(await asyncio.gather(*(one(c) for c in candidates)))


async def execute(*, limit: int = 40, dry_run: bool = False) -> dict:
    if limit not in range(1, MAX_BATCH + 1):
        raise ValueError("limit must be 1..50")
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise RuntimeError("server-side database credential unavailable")
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    summary: dict[str, object] = {"version": VERSION, "dry_run": dry_run}
    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as db:
        if dry_run:
            response = await db.get(
                f"{url}/rest/v1/network_company_discovery_candidates", headers=headers,
                params={"select": "id,website_url,canonical_domain,legal_name,trading_name",
                        "country_code": "eq.IT", "review_status": "eq.pending_review",
                        "limit": str(limit)})
            response.raise_for_status()
            candidates = [{"id": r["id"], "website_url": r["website_url"], "domain": r["canonical_domain"],
                           "name": r.get("trading_name") or r.get("legal_name")} for r in response.json()]
        else:
            queue = await db.post(f"{url}/rest/v1/rpc/net_it_vies1_queue", headers=headers,
                                  json={"p_max": limit})
            queue.raise_for_status()
            payload = queue.json()
            if payload.get("contract") != "net-it-vies1-queue-v1":
                raise RuntimeError("unexpected queue contract")
            candidates = payload.get("items", [])
        results = await examine_batch(candidates) if candidates else []
        outcomes: dict[str, int] = {}
        for result in results:
            outcome = result["outcome"]
            if not dry_run:
                if outcome == "verified":
                    record = await db.post(
                        f"{url}/rest/v1/rpc/net_it_vies1_apply", headers=headers,
                        json={"p_candidate_id": result["id"], "p_vat": result["vat"],
                              "p_page_url": result["page_url"], "p_vies_name": result["vies_name"],
                              "p_legal_name": result["legal_name"], "p_steel_terms": result["steel_terms"],
                              "p_page_hash": result["page_hash"]})
                else:
                    record = await db.post(
                        f"{url}/rest/v1/rpc/net_it_vies1_record", headers=headers,
                        json={"p_candidate_id": result["id"], "p_outcome": outcome,
                              "p_vat": result.get("vat"), "p_vies_name": result.get("vies_name")})
                record.raise_for_status()
                outcome = str(record.json().get("outcome") or outcome)
            outcomes[outcome] = outcomes.get(outcome, 0) + 1
    summary.update({"examined": len(results), "outcomes": outcomes})
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="NET-IT-VIES1 candidate identity via P.IVA + VIES")
    parser.add_argument("--limit", type=int, default=40, help="Candidates per run, maximum 50")
    parser.add_argument("--dry-run", action="store_true", help="Read only, lease and write nothing")
    args = parser.parse_args()
    try:
        result = asyncio.run(execute(limit=args.limit, dry_run=args.dry_run))
    except (ValueError, RuntimeError, httpx.HTTPError) as exc:
        print(json.dumps({"status": "vies1_unblock_failed", "error_type": type(exc).__name__}))
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
