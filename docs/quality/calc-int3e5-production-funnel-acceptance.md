# CALC-INT3E.5 — Production Funnel Acceptance & Conversion Optimization

## Scope and live baseline (2026-10-16)

Anonymous read-only fetch verified that EN, DE, FR and ES public RFQ bill URLs resolve with their respective localized titles and self-canonical metadata. /en/register is publicly readable. This does **not** verify private analytics event delivery, consented user actions, or completed registrations. The superadmin private Vercel events endpoint was **not** queried; real production stage volumes and country-by-event conversion remain **unverified**.

## UX changes

- Imported EU/US/AISC calculator lines still arrive with a deliberately empty steel grade. A new compact button at the successful import notice focuses the first incomplete field. An identical recovery action is shown by the disabled Copy button. No grade is inferred from mass method, US product intent or imported dimension.
- Correct singular item wording in the four locales. Preserve the existing copy-only/no-server-write behavior.
- After a successful clipboard write, show an immediate localized confirmation and optional registration CTA beside the RFQ bill. This click uses the existing consent-gated international registration_click event. A prominent note says the public bill is **not** saved/transferred and no request has been sent.
- Consent UX uses German, French and Spanish for public DE/FR/ES locales. Existing IT/EN consent behavior, privacy URLs, Google Consent Mode defaults and opt-in storage contract remain unchanged.

## Automated acceptance

1. Node unit tests execute the real consent record parser and tracking function in a sandbox. Missing, denied and expired consent send zero events; revocation suppresses subsequent events. Granted consent sends the original two allowlisted categories only.
2. Existing P0 gate: npm test, typecheck, production Next build, tracked secret scan.
3. PERF2.1 browser job: Playwright Chrome mobile 360px for DE/FR/ES Europe import, consent choice, grade focus, real clipboard and post-copy CTA; EN mobile USA NPS/ASTM provenance validation and supplier disclosure. Only localhost production build, synthetic measurements, no signups, email send or private network operations.
4. DEMOTEST2.4 job: production anonymous GET-only for all four bill URLs, calculator URLs and English registration; localized HTML, canonical and hreflang. This job probes already deployed production, **not** the PR preview.
5. Pre-existing SEO, EU/US handoff, AISC/HSS, mobile performance and RFQ validations remain in the workflows.

## Manual go-live acceptance (superadmin)

After protected merge and Vercel production deployment completes:
- Open each clean /en/distinta, /de/distinta, /fr/distinta, /es/distinta URL. Confirm GET 200, correct language, canonical, reciprocal hreflang and noindex on parameterized URLs; old /distinta remains valid.
- In a private tab, test analytics denied, accepted, revoked for each locale. No new international custom events may be sent without current opt-in.
- Complete one **local/test** EU and USA calculator handoff, supply grade and copy an RFQ; verify only 16 fixed international event names plus system/standard in consented Vercel Analytics. Do not transmit private RFQ content as analytics.
- Inspect /platform/product-analytics using a legitimate superadmin account. Check event freshness, ingestion and counts by locale; treat zeros as observations, not proven failures or user abandonment. Compare only compatible periods; never infer per-user cohorts, completed registrations or conversion-by-country from those counts.
- Do **not** perform artificial account creation, supplier dispatch, commercial RFQ sends or test requests in production.

## Limits and next decision

Acceptance of public routes and synthetic Chrome actions is automated, but the private live event-ingestion report needs genuine consented production traffic and authenticated platform access. No new database, scheduled job or repeated Vercel deployment was introduced. If organic event volume remains sparse, wait for a meaningful observation window before A/B tests or changes to the registration funnel.
