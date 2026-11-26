"""Read-only audit, using the same bounded production crawler and text extractor."""
import asyncio
import csv
import re
from pathlib import Path
import httpx
from app.company_discovery import _fetch_page, _it_priority_links, _it_text_localities, canonical_domain, MAX_PAGES_PER_DOMAIN

ROOT = Path(__file__).resolve().parents[1]
async def main():
    targets = sorted(set((ROOT / "audits/net_it_lombardia1q_text_targets.txt").read_text().splitlines()))
    assert 0 < len(targets) <= 50
    gate = asyncio.Semaphore(4)
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0), follow_redirects=False) as web:
        async def one(domain):
            async with gate:
                if not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.[a-z]{2,24}", domain):
                    return [(domain,"invalid_target","","","","","")]
                url = "https://" + domain + "/"
                try:
                    home = await _fetch_page(web,url,url)
                    if home is None or canonical_domain(home.url) != domain:
                        return [(domain,"unreachable","","","","","")]
                    pages = [home]
                    for link in _it_priority_links(home):
                        try:
                            page = await _fetch_page(web,link,home.url)
                            if page is not None and canonical_domain(page.url) == domain:
                                pages.append(page)
                        except Exception:
                            continue
                    hits = _it_text_localities(pages[:MAX_PAGES_PER_DOMAIN],domain)
                    status = "locality_signal" if len(hits)==1 else "multiple_locations"
                    return [(domain,status,h["city"],h["province_code"],h["postal_code"],h["source_url"],h["source_excerpt"]) for h in hits] or [(domain,"no_signal","","","","","")]
                except Exception:
                    return [(domain,"error","","","","","")]
        results = await asyncio.gather(*(one(d) for d in targets))
    with (ROOT / "audits/net_it_lombardia1q_text_results.csv").open("w",newline="",encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(("domain","outcome","city","province_code","postal_code","source_url","source_excerpt"))
        for batch in results:
            writer.writerows(batch)
    print(f"targets={len(targets)} single_location={sum(b[0][1]=='locality_signal' for b in results)} published=0")
if __name__ == "__main__":
    asyncio.run(main())
