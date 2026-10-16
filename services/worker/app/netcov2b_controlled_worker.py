"""NET-COV2B: manual, consent-scoped first-party run; no auto publish.

The source registry authorizes the submission channel; each website must ALSO
have explicit time-bounded permission, separate human target review, a linked
run, and an independent run-governance approval. Never fall back to Wikidata.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
import os
import re
from urllib.parse import quote

import httpx

from .approved_source_batch import StagingRepository
from .company_discovery import (
    _fetch_page, _priority_links, extract_candidate, canonical_domain,
    canonicalize_seed_url,
)

RUN_ID_PATTERN = re.compile(r"^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$", re.I)
LABEL = "NET-COV2B first-party; separate run governance required"
MAX_SITES = 10
MAX_PAGES = 3


def validate_manifest(run: dict, source: dict, leads: list, grants: list, now: datetime) -> list[dict]:
    if (run.get("status") != "queued" or run.get("governance_status") != "approved"
            or run.get("label") != LABEL
            or run.get("terms_status") not in ("allows_reuse", "allows_limited_reuse")
            or run.get("database_rights_status") not in ("low_risk", "licensed")
            or run.get("personal_data_policy") not in ("company_data_only", "exclude_personal_data")):
        raise RuntimeError("Run governance is not separately approved")
    if (source.get("source_type") != "company_submission"
            or source.get("enabled_for_discovery") is not True
            or source.get("governance_status") != "approved"
            or source.get("terms_status") not in ("allows_reuse", "allows_limited_reuse")
            or source.get("database_rights_status") not in ("low_risk", "licensed")
            or source.get("personal_data_policy") not in ("company_data_only", "exclude_personal_data")
            or not source.get("reviewed_by") or not source.get("reviewed_at")
            or not source.get("rights_evidence_url")
            or run.get("source_reference") != source.get("source_url")):
        raise RuntimeError("First-party submission source is not currently authorized")
    seeds = run.get("seed_urls")
    maximum = min(MAX_SITES, int(source.get("max_domains_per_run") or 0))
    if not isinstance(seeds, list) or not 1 <= len(seeds) <= maximum:
        raise RuntimeError("Run seed budget not authorized")
    allowed_seeds = {canonicalize_seed_url(x) for x in seeds}
    if len(allowed_seeds) != len(seeds) or len(leads) != len(seeds):
        raise RuntimeError("Mismatched or duplicated run seeds")
    grant_domains = set()
    for grant in grants:
        if grant.get("revoked_at") is not None:
            continue
        expires = grant.get("expires_at")
        if not isinstance(expires, str):
            continue
        try:
            expiry = datetime.fromisoformat(expires.replace("Z", "+00:00"))
        except ValueError:
            continue
        if expiry.tzinfo and expiry > now:
            grant_domains.add(grant["domain"])
    urls = set()
    for lead in leads:
        if (lead.get("status") != "pending_review"
                or lead.get("intake_run_id") != run["id"]
                or lead.get("source_id") != source["id"]
                or lead.get("domain") not in grant_domains):
            raise RuntimeError("Lead is unlinked, unapproved, or missing direct consent")
        url = canonicalize_seed_url(lead["proposed_url"])
        if url != "https://" + lead["domain"] + "/" or canonical_domain(url) != lead["domain"]:
            raise RuntimeError("Only exact official HTTPS company homepage seeds allowed")
        urls.add(url)
    if urls != allowed_seeds:
        raise RuntimeError("Run seed/lead mismatch")
    return leads


async def run() -> dict[str, object]:
    run_id = os.environ.get("NETCOV2B_RUN_ID", "").strip()
    if not RUN_ID_PATTERN.fullmatch(run_id):
        raise ValueError("NETCOV2B_RUN_ID must be a run UUID")
    repo = StagingRepository()  # dedicated CRAWL_IT68 credentials; no browser token
    headers = {"apikey": repo.key, "Content-Type": "application/json", "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=httpx.Timeout(15), follow_redirects=False) as api:
        async def request(method: str, path: str, **kwargs):
            response = await api.request(method, repo.url + path, headers=headers, **kwargs)
            if response.status_code >= 400:
                raise RuntimeError(f"NET-COV2B gated Data API HTTP {response.status_code}")
            return response.json() if response.content else None

        rows = await request("GET", "/rest/v1/network_company_discovery_runs?id=eq." + run_id
            + "&select=id,status,label,governance_status,terms_status,database_rights_status,"
              "personal_data_policy,source_reference,seed_urls")
        if len(rows) != 1:
            raise RuntimeError("Exactly one governed run required")
        planned = rows[0]
        fields = "id,domain,proposed_url,status,intake_run_id,source_id"
        leads = await request("GET", "/rest/v1/network_discovery_domain_leads?intake_run_id=eq."
            + run_id + "&select=" + quote(fields, safe=",") + "&order=domain.asc&limit=11")
        if not 1 <= len(leads) <= MAX_SITES or len({l["source_id"] for l in leads}) != 1:
            raise RuntimeError("One source with 1-10 prelinked leads required")
        source_id = leads[0]["source_id"]
        sources = await request("GET", "/rest/v1/network_discovery_source_registry?id=eq."
            + source_id + "&select=id,source_url,source_type,enabled_for_discovery,"
              "governance_status,terms_status,database_rights_status,personal_data_policy,"
              "reviewed_by,reviewed_at,rights_evidence_url,max_domains_per_run")
        grants = await request("GET", "/rest/v1/network_netcov2b_domain_permissions?source_id=eq."
            + source_id + "&select=domain,expires_at,revoked_at&limit=100")
        if len(sources) != 1:
            raise RuntimeError("Source missing")
        validate_manifest(planned, sources[0], leads, grants, datetime.now(timezone.utc))

        # One compare-and-set claim; no global queue claiming or auto scheduling.
        patched = await api.patch(repo.url + "/rest/v1/network_company_discovery_runs?id=eq."
            + run_id + "&status=eq.queued&governance_status=eq.approved&select=id",
            headers={**headers, "Prefer": "return=representation"},
            json={"status": "running", "started_at": datetime.now(timezone.utc).isoformat()})
        if patched.status_code >= 400 or len(patched.json()) != 1:
            raise RuntimeError("Run already claimed or no longer approved")

        inserted = skipped = errors = 0
        try:
            for index, lead in enumerate(leads):
                try:
                    url = canonicalize_seed_url(lead["proposed_url"])
                    async with httpx.AsyncClient(timeout=httpx.Timeout(10), follow_redirects=False) as site:
                        home = await _fetch_page(site, url, url)  # robots, DNS/public IP, response-size bounds
                        if home is None:
                            skipped += 1
                            continue
                        pages = [home]
                        for link in _priority_links(home)[:MAX_PAGES - 1]:
                            page = await _fetch_page(site, link, url)
                            if page is not None and canonical_domain(page.url) == lead["domain"]:
                                pages.append(page)
                    candidate = extract_candidate(pages, "IT")
                    if candidate is None:
                        skipped += 1
                        continue
                    result = await request("POST", "/rest/v1/rpc/netcov2b_stage_candidate",
                        json={"p_lead_id": lead["id"], "p_candidate": candidate})
                    if result.get("inserted") == 1:
                        inserted += 1
                    else:
                        skipped += 1
                except (ValueError, RuntimeError, httpx.HTTPError) as exc:
                    errors += 1
                    print(json.dumps({"site_index": index + 1, "status": "error",
                                      "kind": type(exc).__name__}))
                if index + 1 < len(leads):
                    await asyncio.sleep(2)
        finally:
            finished = await api.patch(repo.url + "/rest/v1/network_company_discovery_runs?id=eq."
                + run_id + "&status=eq.running", headers={**headers, "Prefer": "return=representation"},
                json={"status": "completed" if inserted or errors == 0 else "failed",
                      "completed_at": datetime.now(timezone.utc).isoformat(),
                      "skipped_count": skipped, "error_count": errors,
                      "stats": {"contract": "NET-COV2B", "processed": len(leads),
                                "inserted_pending_review": inserted, "errors": errors,
                                "skipped": skipped, "published": 0}})
            if finished.status_code >= 400 or len(finished.json()) != 1:
                raise RuntimeError("Run completion could not be persisted")
    result = {"run_id": run_id, "processed": len(leads), "pending_review": inserted,
              "skipped": skipped, "errors": errors, "published": 0}
    print(json.dumps(result, sort_keys=True))
    return result


if __name__ == "__main__":
    asyncio.run(run())
