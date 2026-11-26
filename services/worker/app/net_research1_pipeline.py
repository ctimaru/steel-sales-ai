"""NET-RESEARCH1: research each Network company on its official website.

Founder decisions (26 nov 2026): a «Profilo in breve» on the first profile tab;
revenue only when the company states it; employees and revenue as bands;
pilot of 50 companies in private review, then automatic publication.

Per company: home + up to 9 same-domain pages about the company, products,
processes, quality and contacts, through the existing robots-, SSRF- and
redirect-protected fetcher. E-mails, links and phone numbers are removed
before the text reaches the model already used by the project
(RAG_LLM_MODEL via Hugging Face). net_research1_extract checks every proposal
against the pages before anything is recorded.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
from urllib.parse import urljoin, urlsplit

import httpx

from .company_discovery import CompanyDiscoveryError, _fetch_page, canonical_domain, canonicalize_seed_url
from .net_research1_extract import clean_page_text, parse_model_json, validate_profile

VERSION = "net-research1-v1"
MAX_PAGES = 10
MAX_CORPUS = 9000
PAGE_CHARS = 2200
DEFAULT_MODEL = "Qwen/Qwen3-4B-Instruct-2507"
PAGE_HINTS = (
    ("chi-siamo", 0), ("chisiamo", 0), ("azienda", 0), ("about", 0), ("company", 0), ("profilo", 0),
    ("storia", 1), ("history", 1), ("prodott", 1), ("products", 1), ("lavorazion", 1), ("servizi", 1),
    ("services", 1), ("produzione", 1), ("certificaz", 2), ("qualita", 2), ("quality", 2),
    ("settori", 2), ("applicazion", 2), ("industries", 2), ("contatt", 3), ("contact", 3),
)
SYSTEM_PROMPT = """Sei un analista del settore siderurgico. Leggi il testo del sito ufficiale di
un'azienda e rispondi SOLO con un oggetto JSON con queste chiavi:
"summary": 2-4 frasi in italiano, scritte con parole tue (non copiare frasi dal sito), su cosa fa
  l'azienda, per chi e con quali specializzazioni. Niente nomi di persone, email, telefoni, link,
  aggettivi promozionali. Solo fatti presenti nel testo.
"activities": attività e lavorazioni (es. "Taglio laser", "Commercio di tubi"), max 12.
"products": prodotti principali con le parole del sito, max 20.
"sectors": settori serviti citati nel testo, max 12.
"markets": Paesi o aree in cui vende, solo se citati, max 12.
"certifications": codici delle certificazioni citate (es. "ISO 9001", "EN 1090-1"), max 12.
"founded_year", "employees", "revenue", "plants": ciascuno null oppure
  {"value": numero, "quote": "frase copiata IDENTICA dal testo che contiene il numero"}.
  revenue solo se il sito dichiara il fatturato; employees solo se dichiara il numero di dipendenti.
Se un dato non c'è nel testo usa null o una lista vuota. Non inventare nulla."""


def _rank(url: str) -> int | None:
    path = urlsplit(url).path.casefold()
    ranks = [rank for hint, rank in PAGE_HINTS if hint in path]
    return min(ranks) if ranks else None


def research_links(home, domain: str, limit: int = MAX_PAGES - 1) -> list[str]:
    seen, ranked = {home.url}, []
    for position, href in enumerate(home.links):
        try:
            url = canonicalize_seed_url(urljoin(home.url, href))
        except (CompanyDiscoveryError, ValueError):
            continue
        rank = _rank(url)
        if url in seen or rank is None or canonical_domain(url) != domain:
            continue
        seen.add(url)
        ranked.append((rank, position, url))
    ranked.sort()
    return [url for _, _, url in ranked[:limit]]


async def read_site(client: httpx.AsyncClient, company: dict) -> list[tuple[str, str]]:
    domain = str(company.get("domain") or "").lower().removeprefix("www.")
    try:
        home_url = canonicalize_seed_url(str(company["website_url"]))
    except (KeyError, TypeError, ValueError, CompanyDiscoveryError):
        return []
    if not domain or canonical_domain(home_url) != domain or not home_url.startswith("https://"):
        return []
    try:
        home = await _fetch_page(client, home_url, home_url)
    except (CompanyDiscoveryError, httpx.HTTPError, ValueError):
        return []
    if not home or canonical_domain(home.url) != domain:
        return []
    pages = [(home.url, str(home.text))]
    for link in research_links(home, domain):
        try:
            page = await _fetch_page(client, link, home.url)
        except (CompanyDiscoveryError, httpx.HTTPError, ValueError):
            continue
        if page and canonical_domain(page.url) == domain and page.url.startswith("https://"):
            pages.append((page.url, str(page.text)))
    return pages


def model_input(company: dict, pages: list[tuple[str, str]]) -> str:
    parts, used = [f"Azienda: {company.get('name', '')}"], 0
    for url, text in pages:
        chunk = clean_page_text(text, PAGE_CHARS)
        if not chunk:
            continue
        chunk = chunk[:max(0, MAX_CORPUS - used)]
        if not chunk:
            break
        parts.append(f"--- Pagina {urlsplit(url).path or '/'} ---\n{chunk}")
        used += len(chunk)
    return "\n\n".join(parts)


class HuggingFaceReader:
    def __init__(self) -> None:
        from huggingface_hub import InferenceClient

        token = os.getenv("HF_TOKEN", "").strip()
        if not token:
            raise RuntimeError("HF_TOKEN missing")
        self.model = os.getenv("RAG_LLM_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
        provider = os.getenv("RAG_INFERENCE_PROVIDER", "auto").strip() or "auto"
        self.client = InferenceClient(api_key=token, provider=provider)

    async def read(self, text: str) -> dict:
        output = await asyncio.to_thread(
            self.client.chat_completion,
            messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": text}],
            model=self.model, max_tokens=900, temperature=0.1)
        return parse_model_json(output.choices[0].message.content or "")


async def research_company(client, reader, company: dict) -> tuple[str, dict]:
    pages = await read_site(client, company)
    cleaned = [(url, clean_page_text(text, 20000)) for url, text in pages]
    if not cleaned or sum(len(t) for _, t in cleaned) < 300:
        return "no_content", {"error": "site_unreadable_or_empty"}
    try:
        raw = await reader.read(model_input(company, pages))
    except Exception as exc:  # provider-specific transport errors
        # Short provider reason for diagnosis (no page text is ever echoed back).
        reason = re.sub(r"\s+", " ", str(exc))[:50]
        return "failed", {"error": f"model_{type(exc).__name__}: {reason}"[:80]}
    profile = validate_profile(raw, cleaned)
    outcome = profile.pop("outcome")
    profile.update(source_urls=[url for url, _ in cleaned], extractor_version=VERSION, model=reader.model)
    return outcome, profile


async def execute(*, limit: int, publish: bool) -> dict:
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise RuntimeError("server-side database credential unavailable")
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    reader = HuggingFaceReader()
    outcomes: dict[str, int] = {}
    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as db, \
            httpx.AsyncClient(timeout=httpx.Timeout(10.0), follow_redirects=False) as web:
        queue = await db.post(f"{url}/rest/v1/rpc/net_research1_queue", headers=headers,
                              json={"p_max": limit, "p_pilot": not publish})
        queue.raise_for_status()
        payload = queue.json()
        if payload.get("contract") != "net-research1-queue-v1":
            raise RuntimeError("unexpected research queue contract")
        for company in payload.get("items", []):
            try:
                outcome, profile = await research_company(web, reader, company)
            except Exception as exc:
                outcome, profile = "failed", {"error": type(exc).__name__}
            record = await db.post(f"{url}/rest/v1/rpc/net_research1_record", headers=headers,
                                   json={"p_company_id": company["id"], "p_outcome": outcome,
                                         "p_profile": profile, "p_publish": publish})
            if record.status_code != 200:
                outcome = "rejected_by_database"
            outcomes[outcome] = outcomes.get(outcome, 0) + 1
    return {"version": VERSION, "mode": "publish" if publish else "pilot", "outcomes": outcomes}


def main() -> int:
    parser = argparse.ArgumentParser(description="NET-RESEARCH1 company research")
    parser.add_argument("--limit", type=int, default=5, help="Companies per run, maximum 25")
    parser.add_argument("--publish", action="store_true",
                        help="Publish automatically (only after the founder approved the pilot)")
    args = parser.parse_args()
    if not 1 <= args.limit <= 25:
        parser.error("limit must be 1..25")
    try:
        result = asyncio.run(execute(limit=args.limit, publish=args.publish))
    except (ValueError, RuntimeError, httpx.HTTPError) as exc:
        print(json.dumps({"status": "research_failed", "error_type": type(exc).__name__}))
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
