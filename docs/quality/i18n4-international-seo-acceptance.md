# I18N4 — International SEO acceptance and Search Console handoff
Date: 2026-10-10  
Site: https://www.smartsteelsales.com  
Safety: **anonymous GET/HEAD only**. No production login, supplier request, sitemap submission without property authorization, analytics-cookie change or mutation.

## Release evidence & acceptance

| Control | Source | Acceptance |
|---|---|---|
| Canonical host | Production HTTP audit | Every tested English page: HTTP 200, HTTPS, one canonical on `www.smartsteelsales.com` |
| Language alternates | HTTP audit | Reciprocal IT/EN alternates, including self-references on all paired routes and sampled published detail pages |
| Sitemap | Production HTTP audit | Unique canonical HTTPS `<loc>` entries; seven EN public routes; published English standard and grade detail links; no private routes |
| Robots | Production HTTP audit | EN public routes crawlable, private routes remain disallowed |
| Parameter searches | Production HTTP audit | `?q=` remains `noindex` and points canonically to the unsuffixed catalogue |
| Chrome mobile/desktop | Playwright Chrome audit | Pages load anonymously; H1 and `main lang=en`; at 390px no horizontal overflow; actual public calculator and RFQ builder work |
| UI evidence | GitHub Actions artifact | Read-only screenshots from standards/grades on mobile and desktop; short artifact retention (3 days) |
| Public data trust | I18N3 test gates | English details only for published Knowledge records; otherwise 404 |
| English document root | **KNOWN FOLLOW-UP** | `app/layout.tsx` still emits `<html lang="it">` for every route; `<main lang="en">` provides a contained-language override. Proper route-specific root language requires a planned layout restructuring; do not silently make the entire shared authenticated shell dynamic |
| Google Search Console | **BLOCKED on external permission** | No GSC properties accessible through current connected GSC account; cannot inspect or submit remotely |
| Real indexing | **NOT ESTABLISHED** | A live and crawlable page is not necessarily indexed by Google |

The CI workflow is `.github/workflows/demotest2-4-production-smoke.yml`, with two additional scripts:
`apps/web/tests/i18n4-production-seo-http.mjs` and `apps/web/tests/i18n4-production-seo-chrome.mjs`.
Workflow can be re-run manually after deployment. PR runs inspect the **currently deployed production site**; they do not assert unreleased code is live.

## Google Search Console activation (manual authorization required)

1. Open https://search.google.com/search-console and choose the verified **Domain property** `smartsteelsales.com` (or add it and verify its DNS TXT ownership). A `https://www.smartsteelsales.com/` URL-prefix property is also acceptable, but it must match the URLs being inspected.
2. Connect that readable property in GSC Wizard / the Search Console connector used by ChatGPT. Until it appears in `list_sites`, no GSC API actions are authorized or possible from here.
3. Open **Indexing → Sitemaps** and submit `https://www.smartsteelsales.com/sitemap.xml`. Check **Success** and read errors/warnings after Google has downloaded it. Submission only signals discovery; it does **not** request or guarantee full indexing.
4. In **URL Inspection**, test live and inspect a representative set: `/en`, `/en/knowledge`, `/en/knowledge/standards`, `/en/knowledge/grades`, `/en/knowledge/tubes`, `/en/distinta` and one **actually published** standard and grade URL from the sitemap. Use `Request Indexing` only if the live test is eligible; do not spam repeated requests.
5. Review **Page Indexing**, the selected Google canonical, last crawl, `noindex`, redirect issues, and the sitemap's discovered page count. Different language pages are distinct canonical URLs, with reciprocal `hreflang`; Italian pages must not accidentally canonicalize to English.
6. In **Performance → Search results**, monitor impressions, clicks, CTR, positions by **page path beginning with `/en`**, then **country** (US/UK/DE/FR/ES and other relevant markets) and queries such as EN 10219, tube weight kg/m, S355J2H. Search Console typically lags by days. Record baseline and compare 7/28-day windows after crawling rather than claiming instant results.

## Performance, cost & safety

- SEO acceptance is only triggered by relevant changes or manual dispatch, rather than hourly cron. No service-role keys, production mutations or LLM usage are needed. Chrome runs on an isolated GitHub Actions runner; screenshots persist only three days.
- Do not enable GSC/Google indexing automation based on page-view data or inference. Use actual Search Console verdicts when connected.
- `main lang=en` mitigates screen reader behavior in content. A separate redesign of shared root layout / route groups can correct `html lang` without breaking Italian authenticated pages or PERF1 static homepage. Avoid synchronous per-request middleware header lookups in the root layout.
- Treat a sitemap containing an URL that then returns 404 (when a publication gate was revoked) as a real stale indexing issue. Tighten cache invalidation/public read-model governance only after identifying the source record.

Official Google guidance: https://developers.google.com/search/docs/specialty/international/localized-versions and https://support.google.com/webmasters/answer/9012289 .
