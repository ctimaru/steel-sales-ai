"""NET-CONTACT1: public company channels from official websites. Dry-run by default.

Founder decisions (2026-11-02): collect only company channels, i.e. a generic
mailbox on the company's own domain (info@, commerciale@, vendite@, sales@ …)
and the switchboard phone. Personal names and mobiles are never collected.
Everything persisted is staged as pending_review; publication happens only
after human bulk review in Platform (LR4).
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
from urllib.parse import unquote, urlsplit

import httpx

from .company_discovery import CompanyDiscoveryError, _fetch_page, _walk_structured_nodes, canonical_domain
from .github_actions_crawler import credentials_from_environment
from .netcompact4b_geo_batch import contact_links
from .network_profile_batch import validated_seeds

MAX_SITES = 25
# Mirrors private.netcontact1_generic_local_part (the database re-checks).
GENERIC_LOCAL = re.compile(
    r"^(info|informazioni|contatti|contact|contacts|commerciale|commerciali|vendite|vendita|sales|"
    r"ufficio\.?commerciale|ufficiocommerciale|ordini|orders|offerte|preventivi|quotes|export|"
    r"italia|segreteria|office|mail|posta|amministrazione|acquisti|purchasing|tecnico|technical|"
    r"ufficio\.?tecnico|ufficiotecnico|logistica|spedizioni|customer\.?service|servizio\.?clienti|"
    r"assistenza|support|qualita|quality|marketing|direzione|reception|centralino|azienda|company|hello)"
    r"([._-]?[a-z]{2})?([._-]?[0-9]{1,2})?$"
)
# Preferred mailbox for an RFQ: sales first, then general.
PRIORITY = ("commerciale", "ufficio", "vendite", "vendita", "sales", "ordini", "orders", "offerte",
            "preventivi", "quotes", "export", "info", "informazioni", "contatti", "contact")
EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)
PHONE_TEXT_RE = re.compile(
    r"(?:\btel(?:efono)?\b\.?|\bphone\b|\bcentralino\b|\bt\.)\s*[:.]?\s*(\+?\(?\d[\d\s()./-]{5,20}\d)", re.I)


ALLOWED_RPCS = ("netcontact1_next_batch", "netcontact1_stage_company_channel", "netcontact1_record_attempt")


class SecretKeyRpc:
    """Minimal PostgREST RPC client for the dedicated crawler secret key
    (CRAWL_IT65B_*, same project guard as the other GitHub Actions crawlers).
    sb_secret keys go in the apikey header only, never as a Bearer JWT."""

    def __init__(self, url: str, key: str):
        self._url, self._key = url, key

    def rpc(self, name: str, params: dict):
        if name not in ALLOWED_RPCS:
            raise ValueError("Unexpected RPC")
        client = self

        class _Call:
            def execute(self):
                response = httpx.post(
                    f"{client._url}/rest/v1/rpc/{name}", json=params, timeout=httpx.Timeout(15),
                    headers={"apikey": client._key, "Content-Type": "application/json",
                             "Accept": "application/json", "User-Agent": "SmartSteelSales-NetContact1/1.0"},
                    follow_redirects=False)
                if response.status_code != 200:
                    # Never echo the body: it could carry request metadata.
                    raise RuntimeError(f"RPC {name} returned HTTP {response.status_code}")

                class _Result:
                    data = response.json()
                return _Result()
        return _Call()


def db_from_environment() -> SecretKeyRpc:
    return SecretKeyRpc(*credentials_from_environment())


def is_company_email(email: str, domain: str) -> bool:
    email = email.strip().lower()
    if len(email) > 254 or email.count("@") != 1:
        return False
    local, host = email.split("@")
    domain = domain.lower().removeprefix("www.")
    return bool(GENERIC_LOCAL.fullmatch(local)) and (host == domain or host.endswith("." + domain))


def normalize_phone(raw: str) -> str | None:
    """Italian switchboard numbers only; mobiles (+39 3…) are skipped as possibly personal."""
    digits = re.sub(r"[^\d+]", "", raw or "")
    if digits.startswith("0039"):
        digits = "+39" + digits[4:]
    elif digits.startswith("39") and len(digits) >= 11 and not digits.startswith("+"):
        digits = "+" + digits
    elif digits.startswith("0"):
        digits = "+39" + digits
    if not re.fullmatch(r"\+\d{8,15}", digits):
        return None
    if digits.startswith("+39") and not digits.startswith("+390"):
        return None  # mobile or non-geographic: never treated as a switchboard
    return digits


def _priority(email: str) -> tuple[int, str]:
    local = email.split("@")[0]
    for index, prefix in enumerate(PRIORITY):
        if local.startswith(prefix):
            return index, email
    return len(PRIORITY), email


def page_channels(page, domain: str) -> tuple[list[str], list[str]]:
    """Return (company emails, switchboard phones) explicitly published on one page."""
    emails: list[str] = []
    phones: list[str] = []
    for href in page.links:
        value = unquote(href or "").strip()
        if value.lower().startswith("mailto:"):
            emails.append(value[7:].split("?")[0])
        elif value.lower().startswith("tel:"):
            phones.append(value[4:])
    emails.extend(EMAIL_RE.findall(page.text))
    for match in PHONE_TEXT_RE.finditer(page.text):
        before = page.text[max(0, match.start() - 12):match.start()].lower()
        if "fax" not in before:
            phones.append(match.group(1))
    for root in page.structured_data:
        for node in _walk_structured_nodes(root):
            if isinstance(node.get("email"), str):
                emails.append(node["email"].removeprefix("mailto:"))
            if isinstance(node.get("telephone"), str):
                phones.append(node["telephone"])
    good_emails = sorted({e.strip().lower() for e in emails if is_company_email(e, domain)}, key=_priority)
    good_phones = list(dict.fromkeys(p for p in (normalize_phone(x) for x in phones) if p))
    return good_emails, good_phones


async def examine(client, item) -> dict:
    domain = item["domain"]
    home = await _fetch_page(client, item["site"], item["site"])
    if not home or canonical_domain(home.url) != domain:
        return dict(status="blocked_or_unavailable", pages=0, email=None, phone=None)
    pages = [home]
    for url in contact_links(home, domain):
        try:
            page = await _fetch_page(client, url, item["site"])
            if page and canonical_domain(page.url) == domain:
                pages.append(page)
        except (httpx.HTTPError, CompanyDiscoveryError, ValueError):
            pass
    email = phone = None
    for page in pages[:3]:
        emails, phones = page_channels(page, domain)
        if emails and (email is None or _priority(emails[0]) < _priority(email[0])):
            email = (emails[0], page.url)
        if phones and phone is None:
            phone = (phones[0], page.url)
    if not email and not phone:
        return dict(status="no_company_channel", pages=len(pages), email=None, phone=None)
    return dict(status="sourced_channel", pages=len(pages), email=email, phone=phone)


def stage(db, company_id: str, email, phone) -> list[str]:
    """One RPC when both channels come from the same page, otherwise one per channel."""
    calls = []
    if email and phone and email[1] == phone[1]:
        calls.append(dict(p_email=email[0], p_phone=phone[0], p_source_url=email[1]))
    else:
        if email:
            calls.append(dict(p_email=email[0], p_phone=None, p_source_url=email[1]))
        if phone:
            calls.append(dict(p_email=None, p_phone=phone[0], p_source_url=phone[1]))
    statuses = []
    for call in calls:
        if not call["p_source_url"].startswith("https://"):
            statuses.append("rejected_insecure_source")
            continue
        out = db.rpc("netcontact1_stage_company_channel", dict(call, p_company_id=company_id)).execute().data
        statuses.append(out.get("status", "invalid") if isinstance(out, dict) else "invalid")
    return statuses


async def run_batch(entries, *, persist=False, max_sites=25, pause=2, db=None) -> dict:
    if not 1 <= max_sites <= MAX_SITES or len(entries) > MAX_SITES:
        raise ValueError("Batch limit exceeded")
    if persist and db is None:
        db = db_from_environment()
    results = []
    async with httpx.AsyncClient(timeout=httpx.Timeout(10), follow_redirects=False) as client:
        for index, item in enumerate(entries[:max_sites]):
            if index:
                await asyncio.sleep(pause)
            try:
                r = await examine(client, item)
            except (httpx.HTTPError, CompanyDiscoveryError, ValueError):
                r = dict(status="blocked_or_unavailable", pages=0, email=None, phone=None)
            row = dict(company_id=item["company_id"], name=item["company_name"], status=r["status"],
                       pages=r["pages"], email=r["email"][0] if r["email"] else None,
                       phone=r["phone"][0] if r["phone"] else None, staged=False)
            if persist:
                # NET-CONTACT1B: every visited company leaves the queue for 30 days.
                try:
                    db.rpc("netcontact1_record_attempt",
                           {"p_company_id": item["company_id"], "p_outcome": r["status"]}).execute()
                except Exception:
                    row["attempt_recorded"] = False
            if persist and (r["email"] or r["phone"]):
                try:
                    statuses = stage(db, item["company_id"], r["email"], r["phone"])
                    row["persistence_status"] = statuses
                    row["staged"] = any(s in ("staged", "existing") for s in statuses)
                except Exception:
                    row["persistence_status"] = ["rejected_or_unavailable"]
            results.append(row)
    return dict(contract="netcontact1-crawl-v1", mode="pending_review_staging" if persist else "dry_run",
                sites=len(results), with_email=sum(bool(x["email"]) for x in results),
                with_phone=sum(bool(x["phone"]) for x in results),
                staged_or_existing=sum(x["staged"] for x in results), published=0, outcomes=results)


def next_batch(db, limit):
    if not 1 <= limit <= MAX_SITES:
        raise ValueError("Invalid bounded size")
    data = db.rpc("netcontact1_next_batch", {"p_limit": limit}).execute().data
    if not isinstance(data, dict) or data.get("contract") != "netcontact1-next-v1":
        raise ValueError("Unexpected source contract")
    raw = data.get("items")
    if not isinstance(raw, list) or len(raw) > limit:
        raise ValueError("Unbounded result")
    if not raw:
        return [], int(data.get("eligible", 0))
    entries = validated_seeds(raw)
    domains = set()
    for item, source in zip(entries, raw, strict=True):
        domain = str(source.get("domain") or "").lower().removeprefix("www.")
        if (source.get("kind") != "canonical" or not domain or canonical_domain(item["site"]) != domain
                or domain in domains or not source.get("company_name")):
            raise ValueError("Company identity or official domain mismatch")
        item["domain"] = domain
        item["company_name"] = str(source["company_name"])[:180]
        domains.add(domain)
    return entries, int(data.get("eligible", 0))


def main():
    parser = argparse.ArgumentParser(description="Public company channels from official websites")
    parser.add_argument("--max-sites", type=int, default=25)
    parser.add_argument("--persist", action="store_true", help="Stage channels as pending_review")
    args = parser.parse_args()
    if not 1 <= args.max_sites <= MAX_SITES:
        parser.error("Invalid size")
    db = db_from_environment()
    entries, total = next_batch(db, args.max_sites)
    output = asyncio.run(run_batch(entries, persist=args.persist, max_sites=args.max_sites, db=db)) if entries \
        else dict(contract="netcontact1-crawl-v1", mode="nothing_eligible", sites=0, outcomes=[])
    output["eligible_before_batch"] = total
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
