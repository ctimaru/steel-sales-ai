"""EU1.D3: automatic, source-bound European steel tube producer recovery.

Visits curated first-party legal/factory pages on the SAME canonical host. The
recipe URLs are search hints, not an identity verdict: a failed fetch, legal
name, manufacturing statement, or explicit extraction restriction fails closed.
Persists short original factual evidence metadata only (URLs + SHA-256), never
copies HTML/PDF content, changes group/legal entities, or publishes a company.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import re
from dataclasses import dataclass
from urllib.parse import urlsplit

import httpx

from .company_discovery import CompanyDiscoveryError, _fetch_page, canonical_domain
from .net_eu_tubifici1_reviewer import full_name_observed, legal_form_present, normalized

# Deliberately bounded to the eight source-identified D3 pending candidates;
# new companies must first pass D1 seed-backed acquisition. Keep group entities
# and ambiguous legal forms on hold until source-specific reconciliation.
@dataclass(frozen=True)
class Recipe:
    legal_url: str
    factory_url: str
    manufacturing_markers: tuple[str, ...]
    process: str
    note: str
    city: str | None = None
    legal_alias: str | None = None


RECIPES: dict[str, Recipe] = {
    "toptubes.co.uk": Recipe(
        "https://www.toptubes.co.uk/top-tubes-terms-conditions/",
        "https://www.toptubes.co.uk/about-us/",
        ("welded tube manufacture", "erw steel tube"),
        "welded_steel_tubes",
        "First-party corporate sales terms identify Top Tubes Limited; its own factory page describes ERW welded steel tube manufacture at Wednesbury.",
        "Wednesbury", legal_alias="Top Tubes Limited",
    ),
    "rsteel.pt": Recipe(
        "https://rsteel.pt/politica-privacidade/",
        "https://rsteel.pt/tubo-de-precisao/",
        ("soldados longitudinalmente", "tubos de precisão produzidas"),
        "welded_steel_tubes",
        "RSTEEL's own company notice names the Portuguese factory operator, and its product page describes welded precision steel tube production.",
    ),
    "aratubo.com": Recipe(
        "https://www.aratubo.com/legal-notices/",
        "https://www.aratubo.com/we-are-aratubo/",
        ("manufacturer of precision welded steel tubes", "manufacturer of precision-welded steel tubes"),
        "welded_steel_tubes",
        "First-party legal notice names Aratubo S.A.U. and manufacturing page describes welded precision tubes; hold where website restricts extraction.",
    ),
    "mannesmann.com": Recipe(
        "https://www.mannesmann.com/en/contact/legal-notice.html",
        "https://www.mannesmann.com/en/locations.html",
        ("mannesmann precision tubes gmbh", "brackwede plant"),
        "welded_steel_tubes",
        "The Salzgitter Mannesmann legal imprint identifies Mannesmann Precision Tubes GmbH and site listing distinguishes its operating tube plants.",
    ),
    "tubulareurope.arcelormittal.com": Recipe(
        "https://tubulareurope.arcelormittal.com/index.php/about-us/our-company",
        "https://tubulareurope.arcelormittal.com/index.php/about-us/our-company",
        ("mills in europe", "seamless and small welded tubes"),
        "group_division_unspecified",
        "Official ArcelorMittal source describes a pan-European tubular division, not one identified registered factory-operating legal entity.",
    ),
    "tatasteeluk.com": Recipe(
        "https://www.tatasteeluk.com/legal-notice/entities",
        "https://www.tatasteeluk.com/about-us/our-operations",
        ("corby", "tubes"),
        "group_division_unspecified",
        "Tata Steel UK Tubes is a manufacturing business description; the UK legal operator must be resolved before creating a company profile.",
    ),
    "alleima.com": Recipe(
        "https://www.alleima.com/en/about-this-site/data-privacy-portal/list-of-alleima-entities/",
        "https://www.alleima.com/en/about-us/strategy-and-operations/divisions/tube/",
        ("seamless tubes", "division tube"),
        "group_division_unspecified",
        "Group registry distinguishes parent Alleima AB from operating manufacturer Alleima Tube AB (556234-6832) in Sandviken; original parent candidate stays held.",
    ),
    "ferpinta.pt": Recipe(
        "https://www.ferpinta.pt/pt/",
        "https://www.ferpinta.pt/pt/",
        ("tubos de aço soldados", "produção de tubos"),
        "welded_steel_tubes",
        "Portuguese governmental company record supports the longer registered FERPINTA name and NIF 500113009; website supports welded tube production, original abbreviated candidate held.",
    ),
}
RESTRICTED = re.compile(
    r"(?:extracting or reusing (?:the )?contents|extraction or reuse of content|"
    r"scraping (?:is )?prohibited|reutilização (?:dos )?conteúdos|"
    r"data extraction (?:is )?(?:not permitted|prohibited))", re.I
)


def hash_page(page) -> str:
    return hashlib.sha256(
        (page.url + "\n" + page.text[:10000]).encode("utf-8")
    ).hexdigest()


def same_firstparty(url: str, domain: str) -> bool:
    try:
        return urlsplit(url).scheme == "https" and canonical_domain(url) == domain
    except (ValueError, CompanyDiscoveryError):
        return False


async def inspect(client: httpx.AsyncClient, candidate: dict) -> dict:
    domain = str(candidate.get("domain") or "").lower()
    recipe = RECIPES.get(domain)
    if recipe is None or candidate.get("country_code") == "IT":
        raise ValueError("out_of_scope_candidate")
    if not all(same_firstparty(url, domain) for url in (
        recipe.legal_url, recipe.factory_url, candidate["source_url"])):
        raise ValueError("invalid_first_party_origin")

    try:
        legal = await _fetch_page(client, recipe.legal_url, candidate["source_url"])
        factory = (legal if recipe.factory_url == recipe.legal_url
                   else await _fetch_page(client, recipe.factory_url, candidate["source_url"]))
    except (CompanyDiscoveryError, httpx.HTTPError, ValueError) as exc:
        raise RuntimeError(f"source_not_available:{domain}:{type(exc).__name__}") from exc
    if not legal or not factory or not (
        same_firstparty(legal.url, domain) and same_firstparty(factory.url, domain)
    ):
        raise RuntimeError(f"first_party_fetch_failed:{domain}")

    name = str(candidate.get("company_name") or "")
    legal_name_matched = full_name_observed(name, legal.text)
    if recipe.legal_alias and not legal_name_matched:
        # Both the full corporate alias in official terms AND the registered
        # trading short name on the factory page are required.
        legal_name_matched = (
            full_name_observed(recipe.legal_alias, legal.text)
            and full_name_observed(name, factory.text)
        )
    legal_name_matched = bool(legal_name_matched and legal_form_present(
        name, str(candidate.get("country_code") or "")))
    factory_text = normalized(factory.text)
    manufacturing_observed = any(
        normalized(x) in factory_text for x in recipe.manufacturing_markers
    )
    rights_restricted = any(RESTRICTED.search(p.text) for p in (legal, factory))
    # Do not attach a plant city merely because a recipe proposed one.
    supported_city = (recipe.city if recipe.city and
                      normalized(recipe.city) in normalized(factory.text) else None)
    return {
        "p_candidate_id": str(candidate["id"]),
        "p_legal_url": legal.url, "p_legal_hash": hash_page(legal),
        "p_factory_url": factory.url, "p_factory_hash": hash_page(factory),
        "p_name_observed": legal_name_matched,
        "p_manufacturing_observed": manufacturing_observed,
        "p_rights_restricted": rights_restricted,
        "p_process_code": recipe.process, "p_factory_city": supported_city,
        "p_note": recipe.note,
    }


async def execute(*, limit: int = 8, persist: bool = False) -> dict:
    if not 1 <= limit <= 8:
        raise ValueError("EU D3 limit must be between 1 and 8")
    host = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not host or not key:
        raise RuntimeError("service-only Supabase credentials missing")
    headers = {"apikey": key, "Authorization": "Bearer "+key,
               "Content-Type": "application/json"}
    found, stored, outcomes, failures = 0, 0, [], []
    async with httpx.AsyncClient(timeout=httpx.Timeout(35), follow_redirects=False) as client:
        response = await client.post(host+"/rest/v1/rpc/net_eu_tubifici1_d3_queue",
                                     headers=headers, json={"p_max": limit})
        response.raise_for_status()
        payload = response.json()
        if payload.get("contract") != "net-eu-tubifici1-d3-queue-v1":
            raise RuntimeError("unexpected EU D3 source queue")
        candidates = payload.get("items", [])
        found = len(candidates)
        if found > limit:
            raise RuntimeError("EU D3 bounded queue exceeded")
        for i, item in enumerate(candidates):
            if i: await asyncio.sleep(0.5)
            try:
                observation = await inspect(client, item)
                if persist:
                    saved = await client.post(
                        host+"/rest/v1/rpc/net_eu_tubifici1_d3_record",
                        headers=headers, json=observation)
                    saved.raise_for_status()
                    receipt = saved.json()
                    if receipt.get("contract")!="net-eu-tubifici1-d3-observation-v1" or receipt.get("published")!=0:
                        raise RuntimeError("D3 must not publish on identity recovery")
                    stored += 1
                    outcomes.append({"domain": item["domain"], "status": receipt["status"]})
                else:
                    outcomes.append({"domain": item["domain"],
                        "name_observed":observation["p_name_observed"],
                        "manufacturing_observed":observation["p_manufacturing_observed"],
                        "rights_restricted":observation["p_rights_restricted"]})
            except (RuntimeError, ValueError, httpx.HTTPError) as exc:
                # Do not invent missing pages or hashes to fill the ledger.
                failures.append({"domain": item.get("domain"), "error_type": type(exc).__name__})
    return {"contract":"net-eu-tubifici1-d3-recovery-report-v1",
        "mode":"persist_private_evidence" if persist else "dry_run",
        "queued":found,"inspected":len(outcomes)+len(failures),
        "recorded":stored,"failed":failures,"results":outcomes,
        "qualified":sum(x.get("status")=="qualified_firstparty" for x in outcomes),
        "published":0}


def main() -> int:
    parser=argparse.ArgumentParser(description="First-party EU manufacturer identity recovery")
    parser.add_argument("--limit",type=int,default=8)
    parser.add_argument("--persist",action="store_true")
    args=parser.parse_args()
    try:
        print(json.dumps(asyncio.run(execute(limit=args.limit,persist=args.persist)),sort_keys=True))
        return 0
    except (ValueError,RuntimeError,httpx.HTTPError) as exc:
        print(json.dumps({"status":"review_failed","error_type":type(exc).__name__}))
        return 1


if __name__=="__main__":
    raise SystemExit(main())
