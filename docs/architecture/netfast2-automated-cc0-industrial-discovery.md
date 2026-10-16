# NET-FAST2 — Automated CC0 Industrial Discovery (16 October 2026)

## Founder decision
Speed up Italian steel industrial Network density without manual company-by-company review. Use real, reusable structured data instead of extracting copyrighted website material. All profiles remain **unconfirmed**, not sales customers, qualified tube buyers, verified suppliers or endorsed/claimed organizations.

## Licensed source and exact limits

- Wikidata structural statements are CC0: https://www.wikidata.org/wiki/Wikidata:Licensing
- The **previously Platform-approved** source registry entry for https://query.wikidata.org/sparql (UUID 8425ec0f-c855-41d8-9bea-70a95fd8a6ba) has its max **per-run record budget raised from 5 to 100**, and source interval from 168h to 24h. This does not approve any other source.
- WDQS imposes request processing/time and user-agent limits: https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual. **Exactly one source query per UTC day**, no automated retries or parallel requests, at most 100 result rows and 768KB, 45-second caller timeout.
- No HTTP fetching any target company's website. P856 is used only as a CC0 data item to point users to the company's site.
- Four verified industry cohorts: steel Q2285982; metal industry Q1924906; machinery/equipment Q1957908; automotive Q190117. Country Italy P17=Q38, industry P452, website P856, label it/en. Excludes human Q5; no email or personal information extraction. Rotates cohort daily and 0/100/200/300 pages over a 16-day cycle. Actual yield cannot be guaranteed.

## Data and UX

- `network_netfast2_structured_entities`: unique Wikidata QID, canonical company domain, official website URL, label and origin industry. No private Company Memory.
- `network_netfast2_batches`: one claimed run/day, database-enforced cap 100, counts for proposed/new/skipped; no manual per-company action. Run is consumed even on WDQS errors to prevent retries hammering Wikimedia.
- Service-role only RPC `netfast2_claim_daily_batch` / `netfast2_commit_daily_batch`. Both reject browser access; source preflight verifies the exact reviewed CC0 source and license.
- Existing Free discovery overlay adds source records only when unremoved and not already in canonical Network or existing candidate/target tables. Existing negative candidate rejection suppresses provisional entity. Website and evidence provenance are visible, role based on cohort is **indicative only**; industry does NOT establish tube-buying behavior.
- All discovery profiles remain in the authenticated Network Free view under label **Scoperta dal Network · Da confermare** and correction/removal channel `/company-data`; no canonical auto-publish, no private buyer data, no location fabrication.
- Do not conflate published canonical companies, source entities stored, and visible distinct unconfirmed company cards.

## Automation

`.github/workflows/netfast2-wikidata-feed.yml` runs once daily at **02:23 UTC** on main. The new workflow triggers once on its initial push to main to attempt the first acquisition without user clicking anything. Can also manually dispatch; daily uniqueness prevents a second ingest. Uses the previously configured `CRAWL_IT65B_SUPABASE_URL` and `CRAWL_IT65B_SUPABASE_SECRET_KEY` dedicated GitHub secrets. Credentials and keys are never printed.

## Acceptance

- P0 Required Gate frontend, worker, SQL RLS and structured source contract green;
- Local migration reset and runtime negative access assertions;
- Production migrations applied only after CI green;
- PR squash merge, GitHub Vercel deploy confirmation;
- Initial GitHub Action result (if secrets configured) and production counts read back; otherwise don't invent increased company counts.

## Business limitations and next

This first source is **bounded and may provide far fewer than 100 real unique companies**; Wikidata coverage varies by industry. Fast scaling beyond it requires 1+ genuine licensed manufacturing/company dataset feeds with documented external redistributable rights and an adapter, not unauthorized crawling of company websites. Follow with NET-FAST3 provider ingestion, company opt-out removal from preliminary directory, filter/pagination beyond first 50 cards and geo enrichment with actual evidence.
