"""Read-only first-party locality recrawl of existing industrial domains.
No database credentials; emit minimal address signals, not identity or verified seats.
All requests use the existing discovery crawler, including robots and SSRF checks.
"""
from __future__ import annotations
import asyncio
import csv
import re
from pathlib import Path
from urllib.parse import urlsplit
import httpx
from app.net_it_seed1_pipeline import inspect_site
from app.company_discovery import canonical_domain

ROOT = Path(__file__).resolve().parents[1]
PROVINCES = {"BG","BS","CO","CR","LC","LO","MB","MI","MN","PV","SO","VA"}

async def main():
    domains = sorted(set((ROOT / "audits/net_it_lombardia1o_geo_targets.txt").read_text().splitlines()))
    assert 0 < len(domains) <= 50
    gate = asyncio.Semaphore(6)
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0), follow_redirects=False) as web:
        async def one(domain):
            async with gate:
                if not re.fullmatch(r"[a-z0-9][a-z0-9.-]*\.[a-z]{2,24}", domain):
                    return [(domain,"invalid_target","","","","","")]
                try:
                    outcome, candidate, _ = await inspect_site(web, {"domain": domain, "url": "https://" + domain + "/"})
                    rows = set()
                    for loc in (candidate or {}).get("facility_candidates", []):
                        if loc.get("country_code") != "IT" or loc.get("source_kind") != "json_ld_postal_address":
                            continue
                        city = str(loc.get("city") or "").strip()
                        postal = str(loc.get("postal_code") or "").strip()
                        prov = str(loc.get("province_code") or "").strip().upper()
                        region = str(loc.get("region") or "").strip()
                        source = str(loc.get("source_url") or "")
                        url = urlsplit(source)
                        if (not re.fullmatch(r"[A-Za-zÀ-ÖØ-öø-ÿ'’ -]{2,80}", city)
                            or not re.fullmatch(r"[0-9]{5}", postal)
                            or (region.casefold() != "lombardia" and prov not in PROVINCES)
                            or url.scheme != "https" or url.query or url.fragment
                            or url.username or url.password or canonical_domain(source) != domain):
                            continue
                        rows.add((domain,"locality_signal",city,prov,region,postal,source))
                    return sorted(rows) or [(domain,outcome,"","","","","")]
                except Exception:
                    return [(domain,"error","","","","","")]
        batches = await asyncio.gather(*(one(d) for d in domains))
    out = ROOT / "audits/net_it_lombardia1o_geo_observations.csv"
    with out.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(("domain","outcome","city","province_code","region","postal_code","source_url"))
        for batch in batches:
            writer.writerows(batch)
    signals = sum(any(r[1]=="locality_signal" for r in b) for b in batches)
    print(f"targets={len(domains)} locality_signal_domains={signals} published=0")

if __name__ == "__main__":
    asyncio.run(main())
