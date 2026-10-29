# SEO-GROWTH2 — School → Calculator → Distinta/RFQ
Baseline: GSC property `sc-domain:smartsteelsales.com`, **Web**, 2026-10-03–2026-10-27 (last settled day 2026-10-27). Confirm actual periods before using for growth claims.

## Decision and current evidence
- GSC: **810 impressions, 8 clicks**, CTR 0.99%, position 26.33 (property-level totals; **do not** sum page-level impressions to reproduce property totals).
- 2026-10-21–27: 588 impressions; 2026-10-14–20: 174. Small volume. Do not predict conversion.
- GSC hides **7 of 8 clicks** and **553 of 810 impressions** at query level (anonymized rare queries). Never infer the hidden queries or assert unobserved query-to-page attribution.
- Existing `/en/knowledge/tubes`: 172 impressions, 0 clicks, average position 48.4. This is **ranking**, not just snippet CTR.
- Existing `/knowledge/tubes/quadro-120x120x5`: 15 impressions, 0 clicks, average position 6.67. Low-sample title pilot in SEO-GROWTH2.B; no new URL.
- GSC sitemap has 274 submitted URLs, 119 with impressions in this window; that is not a full indexed count.
- GA4 has 119 sessions / 21 active users overall, but **0 google / organic** sessions attributed during this same window, and **0 key events**. Do not equate 8 GSC clicks with GA4 sessions or claim that GA4 is broken without diagnostics.

## A — Attribution & privacy gate (P0)
1. Check GA4 stream hostnames and `page_location` against www/non-www canonical and redirects; inspect `source/medium` and any referral exclusions without silently recategorizing traffic.
2. On production, use an authorized, consented test only: Search-result click to public School, calculator open, meaningful calculation, add to bill, RFQ start. Separate test/synthetic traffic from production pilot metrics.
3. Test consent denied / undecided / granted and revocation across IT/EN/DE/FR/ES and anonymous/authenticated surfaces. Never loosen Consent Mode v2 gates or expose dimensions, unit prices, RFQ, personal identifiers or company IDs to GA4.
4. Audit existing GA4 public event mapping: `calculator_used`, `rfq_bill_add`, `rfq_create_start`, `signup_start`; confirm events actually fire after valid consent, and configure key events only after a recorded policy decision.
5. Compare daily GSC clicks vs consented GA4 google organic sessions by landing page; document limits from blockers, consent and attribution. **Acceptance**: reproducible diagnostics and truthful unknowns; do not require equality between GSC clicks and GA4 sessions.

## B — Italian existing-page CTR pilot (P1)
- Keep the canonical, structured references, verified vs theoretical weight and calculator deep link untouched.
- Add only `quadro-120x120x5` to the existing bounded, descriptive title experiment; monitor 28 **settled** days before and after (not a claim of uplift). Baseline is 15 impressions / 0 clicks, low statistical power.
- Investigate higher-impression technical standard pages EN 10219 and 16Mo3 as separate editorial reviews, not keyword-stuffed automatic replacements.
- **Acceptance**: test suite, typecheck, build, no unexpected canonical/robots behavior, mobile visual smoke of breadcrumb → prefilled calculator.

## C — English calculator intent (P1, no new pages yet)
- Inspect the existing `/en/knowledge/tubes` and its CHS/SHS/RHS sections before proposing URLs. Baseline: 172 impressions, position 48.4, 0 clicks.
- For each proposed query intent (CHS weight, SHS weight, RHS weight, section area) verify technical completeness, existing target, internal links and potential cannibalization. Prefer improvement to existing indexed URLs first.
- Keep public calculator compact and inline, preserving mobile experience and canonical for query-param states. Keep Distinta handoff in the same flow; avoid multiple independent calculators.
- **Acceptance**: source-to-calculator-to-bill functional journey in anonymous and authenticated sessions; scope of future content backed by additional GSC query/page evidence.

## Measurement
Monitor weekly: settled 7d vs previous 7d and 28d, clicks, impressions, positions for priority URLs, real consented GA4 sessions, calculator uses, bill adds and RFQ starts. Report test versus real events separately. Never infer conversion rates from aggregates across unrelated populations.

Dependencies: Notion G1 — Google Measurement & Organic Growth; SI — Scuola Iteration Series; WC — Weight Calculator Experience; CALC-INT4.2 evidence runbook. Existing implementation: SCHOOL-GROWTH1A/B/D, SEO-GROWTH1C, SEO-ITA1D. No new paid services.


## SEO-GROWTH2.A — Verified diagnostics and implementation (2026-10-29)
- GA4 property `properties/557280842`, 2026-10-03–27: 119 sessions, 21 active users, 0 key events, 0 Google Organic attributed sessions.
- GA4 hostName: `www.smartsteelsales.com` 98 sessions; 21 sessions from Vercel-generated preview URLs. GA4 source/medium by host confirms production 80 Direct, 14 chatgpt.com / ai-assistant, 3 vercel.com referral, 1 not set.
- GA4 actual events: `calculator_used` **25**, `rfq_bill_add` **12**, `rfq_create_start` **2**. Host split is **25/0** calculator uses on production/preview, **7/5** bill adds, **0/2** RFQ creation starts. Thus every observed RFQ-create start is **preview/test-side**, NOT a production commercial conversion. No verified real-customer event counts.
- Root `SiteDocument` previously loaded canonical GA4 tag even on previews. New guard only loads it when server-side `VERCEL_ENV === "production"`; preview/local must not emit GA4 anymore after deployment. Existing historical preview events cannot be removed from GA4 retrospectively by this code change.
- Public route allowlist in `GoogleAnalyticsConsent` now strips the locale prefix before evaluating explicit public sections. Broad `/en/*`, `/de/*`, `/fr/*`, `/es/*` previously included private paths. Query strings/fragments stripped from explicit pageview payloads, including re-consent path.
- **Residual validation**: GA4 enhanced-measurement history tracking might still emit automatically on private production navigation after global tag setup; browser Network panel acceptance is mandatory. Do not claim private-route suppression is complete without network verification and review GA4 web stream Enhanced Measurement settings.
- **Attribution still unresolved**: GSC 8 search clicks vs GA4 0 google / organic, 0 key events. Difference can be caused by consent, sampling, analytics blocking and session attribution, but no verified root cause yet.
- **Not deployed / no real-user verification yet**: PR code must pass protected P0, mobile and browser acceptance.
