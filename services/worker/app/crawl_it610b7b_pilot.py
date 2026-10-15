"""Single-run, manually dispatched four-domain Candidate Gate pilot.

The Platform owner links all four leads first. The Action cannot link leads,
approve governance, publish companies, or claim an unrelated queued run.
"""
from __future__ import annotations
import asyncio
import json
import os
import re
from urllib.parse import quote
import httpx
from .approved_source_batch import StagingRepository
from .company_discovery import _fetch_page, _priority_links, extract_candidate, canonical_domain, canonicalize_seed_url

RUN_ID_RE = re.compile(r"^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$", re.I)

async def pilot():
    repo = StagingRepository()
    run_id = os.environ.get("CRAWL_PILOT_RUN_ID", "")
    if not RUN_ID_RE.fullmatch(run_id):
        raise ValueError("Expected a single valid run UUID")
    headers = {"apikey": repo.key, "Content-Type": "application/json", "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=httpx.Timeout(15), follow_redirects=False) as api:
        async def request(method, path, **kwargs):
            response = await api.request(method, repo.url + path, headers=headers, **kwargs)
            if response.status_code >= 400:
                raise RuntimeError("Pilot Data API refused operation: HTTP " + str(response.status_code))
            return response.json() if response.content else None
        run_path = "/rest/v1/network_company_discovery_runs?id=eq." + run_id
        runs = await request("GET", run_path + "&select=id,status,governance_status,terms_status,database_rights_status,personal_data_policy,source_reference,seed_urls")
        if len(runs) != 1:
            raise RuntimeError("Run not found")
        run = runs[0]
        if not (run["status"] == "queued" and run["governance_status"] == "approved"
                and run["terms_status"] in ("allows_reuse", "allows_limited_reuse")
                and run["database_rights_status"] in ("low_risk", "licensed")
                and run["personal_data_policy"] in ("company_data_only", "exclude_personal_data")
                and run["source_reference"] == "https://query.wikidata.org/sparql"):
            raise RuntimeError("Only approved, queued Wikidata pilot is allowed")
        fields = "id,domain,proposed_url,status,intake_run_id,source_id"
        leads = await request("GET", "/rest/v1/network_discovery_domain_leads?intake_run_id=eq." +
                              run_id + "&select=" + quote(fields, safe=",") + "&order=created_at.asc&limit=5")
        seeds = run.get("seed_urls")
        if len(leads) != 4 or not isinstance(seeds, list) or len(seeds) != 4:
            raise RuntimeError("Exactly four linked seed domains required")
        approved_urls = {canonicalize_seed_url(str(seed)) for seed in seeds}
        if (any(lead["status"] != "pending_review" for lead in leads)
                or {canonicalize_seed_url(lead["proposed_url"]) for lead in leads} != approved_urls
                or len({lead["source_id"] for lead in leads}) != 1):
            raise RuntimeError("Lead/run mismatch")
        # Conditional atomic claim: no global queue polling or unrelated run selection.
        patch_path = run_path + "&status=eq.queued&governance_status=eq.approved&select=id"
        response = await api.patch(repo.url + patch_path, headers={**headers,
            "Prefer":"return=representation"}, json={"status":"running",
            "started_at":__import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()})
        if response.status_code >= 400 or len(response.json()) != 1:
            raise RuntimeError("Run claim failed or another runner claimed it")
        inserted = skipped = errors = 0
        try:
            for index, lead in enumerate(leads):
                try:
                    url = canonicalize_seed_url(lead["proposed_url"])
                    async with httpx.AsyncClient(timeout=httpx.Timeout(10),follow_redirects=False) as site:
                        home = await _fetch_page(site,url,url)
                        if home is None:
                            skipped += 1
                            continue
                        pages = [home]
                        for next_url in _priority_links(home)[:2]:
                            page = await _fetch_page(site,next_url,url)
                            if page and canonical_domain(page.url) == canonical_domain(url):
                                pages.append(page)
                    candidate = extract_candidate(pages,"IT")
                    if not candidate:
                        skipped += 1
                        continue
                    result = await request("POST","/rest/v1/rpc/crawl_it610b2_stage_candidate",
                        json={"p_lead_id":lead["id"],"p_candidate":candidate})
                    if result.get("inserted") == 1: inserted += 1
                    else: skipped += 1
                except (ValueError,httpx.HTTPError,RuntimeError) as exc:
                    errors += 1
                    print(json.dumps({"index":index+1,"status":"error","kind":type(exc).__name__}))
                if index < len(leads)-1: await asyncio.sleep(2)
        finally:
            from datetime import datetime, timezone
            done = datetime.now(timezone.utc).isoformat()
            response = await api.patch(repo.url+run_path+"&status=eq.running",
                headers={**headers,"Prefer":"return=representation"},
                json={"status":"completed" if inserted or not errors else "failed",
                      "completed_at":done,"skipped_count":skipped,"error_count":errors,
                      "stats":{"pilot":"CRAWL-IT6.10b.7b","seed_count":4,
                               "inserted":inserted,"skipped":skipped,"errors":errors}})
            if response.status_code >= 400: raise RuntimeError("Run finalization failed")
        summary = {"run_id":run_id,"processed":4,"inserted_pending_review":inserted,
                   "skipped":skipped,"errors":errors,"published":0,"requires_human_review":True}
        print(json.dumps(summary,sort_keys=True))
        return summary

if __name__ == "__main__":
    asyncio.run(pilot())
