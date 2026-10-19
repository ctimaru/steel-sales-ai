# SCHOOL-GROWTH1D — Acquisition Funnel & Conversion Intelligence
19 ottobre 2026 | Existing Vercel Web Analytics and Platform Analytics only; no new DB, cookie or persistent ID.

## Event contract
Public /knowledge homepage, articles list, three article detail pages -> `school_funnel_content_view` with fixed surface home/articles/article. Delegated click on existing intra-site school links -> `school_funnel_calculator_click` for exact `/knowledge/tubes?source=school`, or `school_funnel_distinta_click` for `/distinta`. No HTML SEO changes to links.
Consent-gated utility open -> `school_funnel_calculator_open`. Subsequent confirmed existing inline calculator milestones emit `school_funnel_bill_line_added`, `school_funnel_rfq_create_click`, `school_funnel_guest_handoff`, `school_funnel_registration_click`, `school_funnel_login_click`, `school_funnel_rfq_created` only when calculator pathname=/knowledge/tubes and source=school.
No query values, user IDs, session/correlation ID, RFQ IDs, geometry, price or CRM details. Source is explicitly URL-declared and may be spoofed; it is **not deterministic person attribution**. Direct `/distinta` click is **not** proof of a private RFQ conversion.
Every new custom event requires current granted analytics consent. Existing Supabase `public_utility_events` insertion is also gated; analytics opt-out doesn't block tools. No tracking added to private workspaces.

## Data interpretation
Admin console cards are aggregate event counts over 1d/7d/30d. Not unique visitors, cohorts, causal funnel conversion, drop-off, conversions from Google queries, revenue or ROI. No dividing independent stages. A zero can mean no consent or tiny volume. Partial/missing API shows unavailable.

## QA and release
Run npm test, typecheck, build, P0 Required Gate, UI-SYSTEM2 and PERF2.1 on real branch; inspect Vercel Preview. Merge only with green CI. Postdeploy inspect /knowledge, calculator link attribution, analytics opt-out, cockpit and no new private leakage. SCHOOL-GROWTH1E retains pixel-perfect browser/contrast audit and protected Preview login issue.
