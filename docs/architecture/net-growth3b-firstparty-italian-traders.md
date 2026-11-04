# NET-GROWTH3.B — First-Party Italian Steel Trader Acquisition

Date: 2026-11-04. Scope: **database density only**; no user-interface or commercial workspace changes.

## Baseline & real source review
- Production read-back before this PR: **278** canonical published plus **232** visible provisional company cards = **510** distinct accessible listings.
- The source registry has only one approved automated dataset (Wikidata CC0); licensed NET-FAST3 grants in effect: **0**. No unlicensed third-party company feeds, exhibitor directories or business registry copies are ingested.
- Cross-source read-only triage checked 27 first-party candidates; two already listed (Vicini Tubi and CPS) were excluded. Trafiltubi was independently found to be a **manufacturer**, not a trader, and was excluded from this trader-only cohort. APM Italia (legal owner Alloy Pipe & Metal) is independently documented as a steel trader.
- The 25 curated entries in `services/worker/data/netgrowth3b_italian_traders_20261104.json` record **only** a company/brand name, domain, official HTTPS business page, original short industrial fact, and the supported role/material/segment metadata. These entries were not counted as company publications or verified customers.

## What the PR enables
- An **offline dry-run** that rejects invalid records, duplicate domains, personal data patterns, unsupported company roles, non-company URLs, and non-first-party HTTPS evidence.
- A **separate, explicitly manual** GitHub Actions operation for the one initial cohort, restricted to the repository `main` branch. Default workflow-dispatch choice is `apply=false`; its first stage performs an offline validation and the second stage performs a **live read-only service-role preflight**. No database write is made without `apply=true`.
- Applying is permitted only after CI, source and rights review. The service-role worker uses the **existing** `public.netdensity3_seed_first_party` RPC; no SQL bypass, secret exposure or direct writes to the canonical `network_companies`.
- Before the write, it reads all relevant public identity/domain sources: canonical companies, existing core targets, discovery candidates, Wikidata provisional sources, licensed feed entities and suppressed domains. Any conflict or access failure **aborts the entire job**. The SQL layer independently performs its existing dedup checks.
- Returned counters must match the `netdensity3-bulk-v1` contract, with `published=0`, `verified_buyers=0`; actual new candidate counts may be lower than 25 and are not reported before the first write + live Network reader readback.
- Roles are intentionally limited to `trader_distributor` because the existing service-only first-party staging RPC does not support `producer` or `processor_service_provider`; this PR does **not** falsely label those firms as traders.

## Acceptance before first live acquisition
1. Protected CI tests and migration/secret gate: **must be green**; draft PR, no automatic merge.
2. Audit all 25 official source pages, identifiers, distinct legal entities (especially groups and brands) and privacy/copyright evidence. Official business facts only, no copying prose or contacts.
3. Main-only manual workflow dispatch with `apply=false` runs offline source validation plus live cross-source **read-only** checks; only then a separately authorized `apply=true` action.
4. Production readback: pre/post `network_core_target_leads`, `private.netfast_discovered_records`, canonical published count and duplicate report. The visible reader total, not imported row count, is the KPI.
5. Record added/duplicate/invalid/held counts in NET-GROWTH issue and Notion. Do not claim 25 new companies before the actual import succeeds.

## Next batches for the 1,000-company target
The first **25** records are a pilot deliberately smaller than the normal 50–100 batch target, to preserve evidence quality. Once data and grant gates prove safe, extend to source-backed 50–100 **unique** trader companies per cohort; producers and processors need their own supported source-backed classification path. Do not enable unsupervised crawling or pretend source rights exist when not approved.

## Source evidence acceptance — Nov 4, 2026

Twenty-five prospective firms were cross-checked against individual, public, first-party company pages. The manifest now uses canonical landing pages (including `www` where needed) and original short factual assertions. No text from the websites or personal contact data is redistributed. This is a **human source screen**, not a company verification, claim, sales relationship, buyer identification or blanket license to crawl.

- Official source pages confirm distribution or supply of steel tubes for Artigiantubi, Boccardo Tubi, Centro Acciai Inox, PZ Tubi, Inox Steel, Intertubi, TNV, Tubimec, EFC Acciai, Fratelli Pinato, Firas Italia, Da.Ma.An, Pipex Italia, I.M.S., Steel Center, Arena Acciai, Acciai Vender, ITM International Tubing & Materials Group, T. Consonni, Steelnet, Tirelli Ferro e Inox, Commercio Ferro, Merigo's qualified-tubes division, Soluzioni Piping and Alloy Pipe e Metal / APM Italia.
- Corporate identity caveats: Tubimec belongs to the Interacciai group but is identified as a distinct legal company on its own site. Arena Acciai S.r.l. and Acciai Vender S.p.A. both appear under the Vender commercial group but have distinct named company entities. Fratelli Pinato also appears at `pinatoinox.it`; that alias must never become a second legal profile. Merigo's different divisions belong to the same company. These are **one record per legal entity**, not per website or business unit.
- Hybrid firms (e.g., Fratelli Pinato, Intertubi, Merigo) also conduct production or processing, but have documented distribution activity; the `trader_distributor` role is a proposed supported capability, not an exclusive or certified categorization.
- Sources that block automatic open still require a final operator source sign-off if evidence can't be reached in the run context; an indexed search result is not a software-level license. No bulk scraping of websites, copyrighted descriptive copy or extraction of named personnel.

The live **read-only** `--preflight` now runs on **every manual workflow dispatch**, even when no write is selected; only `--apply` invokes the existing service-role import RPC. Final post-run counters are separate from the manifest length. The commit does not alter the canonical publisher's OFF switch.
