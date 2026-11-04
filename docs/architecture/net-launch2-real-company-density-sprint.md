# NET-LAUNCH2 — Real Company Density Sprint

Date: 2026-10-16. Existing baseline: 31 canonical published + 27 source-screened provisional previews = 58 distinct authorized Network listings. The user wants visible industrial companies, not internal candidates.

## Critical root cause: why Wikidata yielded zero
On 2026-10-16, NET-FAST2 completed industry Q1924906 with **0 suggested, 0 inserted**. The legacy worker offset rotated among 0,100,200,300 regardless of how many companies Wikidata has in each sector; the first result was often an empty page. More seriously, its legacy SQL inserted **industry QID** as `source_entity_id`, not the actual company item ID, so even a successful page would only insert one per industry or fail uniqueness. NET-LAUNCH2 replaces this scheduled path; legacy NET-FAST2 retained manual-only and its bug is not called in routine runs.

## Product outcome
The existing CC0 Wikidata source in production was human-reviewed with rights evidence and is the *only* discovery feed. It supplies first-party official website URLs as structured P856 data; **no external company website crawl** or per-company approval. New listings appear automatically via existing `private.netfast_discovered_records` in Free and Pro, with **Da confermare** on each card, permanent opt-out and exact provenance.

## Acquisition contract
- Two bounded country-Italy, industry-specific, official-website Wikidata SPARQL requests per UTC day: 100 raw rows per segment (max 200). Four sectors rotate: iron & steel (Q2285982), metal (Q1924906), machinery (Q1957908), automotive (Q190117).
- Query includes P17=Italy, P452=exact sector, P856=official website, labeled entity, exclude humans. No scraping unapproved directories, no third-party company page visits.
- Per-industry offsets in private `network_netlaunch2_cursors` advance using true returned raw SPARQL row counts and reset at the last page rather than endlessly requesting empty offsets. User-Agent identifies client; no concurrency, 8-second gap, no retries on 429.
- Service-role-only `netlaunch2_claim_daily` checks precisely approved Wikidata source + up to 200 approved daily budget. `netlaunch2_commit_daily` rechecks rights **at write**, validates actual company QID, country/site-name fields from worker, dedup versus published/targets/research/other feeds/suppressed domains. Atomic metrics: raw queried, candidates accepted, new provisional, duplicates or rejection; canonical published count always 0.
- The front-end displays recently discovered cards first in Free, as Pro already did. Free/Pro membership segregation remains untouched; 20-region map uses **only published facilities**, never inferred regions for provisional businesses.
- The predecessor `netfast2-wikidata-feed.yml` no longer has its own daily schedule to avoid running two independent jobs against WDQS; the replacement `netlaunch2-cc0-company-density.yml` runs daily 03:11 UTC and on the first main merge.

## Honesty and operating expectation
The 200 cap is **two queries × 100 candidate rows**, not 200 new distinct company profiles. Many source entities are duplicate, defunct, brand names, incorrect, HTTP-only, or without HTTPS websites; they are filtered/deduplicated and never called verified customers. WDQS has query-time and fair-use constraints; a 429/timeout is an error, not a reason to hammer the endpoint. An operator can always suppress a domain permanently using Platform bulk control.

Acceptance:
- [ ] Full P0 Required Gate (frontend, worker, local SQL negative ACL & metadata integrity).
- [ ] Additive prod migrations; readback source 200 record budget and two RPC grants.
- [ ] GitHub PR merge, first actual main Actions import, count added and exact Network visible totals.
- [ ] Vercel deploy success.
- [ ] Authenticated Free and Pro visual acceptance pending until actually performed.

Next: curated *official first-party company cohorts* for metal stockholders, machinery makers, processors, equipment makers, with source-specific evidence and real incremental counts. Target 100–300 usable profiles is a business objective to be measured, not an ungrounded release claim. Eventually pagination for >50 provisional matches, role confidence and source correction tools are needed.

## NET-GROWTH3 — Industrial sub-sector coverage (4 November 2026)

Production baseline read-only: 278 canonical published + 232 provisional = 510 visible; scheduled Wikidata imports complete, but 2026-11-04 queried 28 raw items, accepted 5, inserted 0 and 2026-11-03 queried 115, accepted 29, inserted 0. This is **source coverage exhaustion**, not evidence of successful acquisition. Publisher `private.net_pipeline1b2_settings.enabled=false`, unchanged. No licensed external NET-FAST3 feed grants exist.

This worker-only change expands each **already approved Wikidata CC0 industry cohort** from exact P452 matching to exact or one-hop Wikidata `subclass of` (P279) matching. Every hit must still explicitly identify an Italian organisation (P17), an industrial classification (P452), an official website (P856) and an IT/EN label; humans are excluded. The stored `industry_qid` remains the reviewed **cohort**, not a fabricated exact P452 claim. No external site crawling, alternative source, new cron, broad business category, import rights approval, canonical publishing, automatic verification, RLS change or frontend change.

Operational limits are unchanged: 2 sequential Wikidata queries/day, at most 100 raw rows each; 8-second separation, no automatic retry on rate limits, current source rights checked by the DB before claiming and committing; duplicate and removal controls remain. Query order includes item+website+label to make capped paging stable. On publication of this worker-only PR, the **next eligible daily job** exercises the wider cohort; no additional same-day call should bypass daily rate limits.

Acceptance: worker unit tests and P0 CI green; preserve service-only RPC permissions, source rights and opt-out; next run readback of queried/accepted/inserted and reader total, with zero invented improvement. If one-hop expansion yields zero additional companies or times out, leave source guardrails intact and prioritize a separately licensed supplier dataset or first-party submitted company cohorts; do not weaken governance.
