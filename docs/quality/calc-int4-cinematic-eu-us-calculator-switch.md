# CALC-INT4 — Cinematic EU / USA Calculator Switch

Release scope: UI-only interaction. No changes to mass formulas,
standards registry, reference source claims, RFQ v1/v2 schema, URLs,
canonicals, hreflang or sitemap.

## User experience

- Visible above the calculator: a two-state pill switch `🇪🇺 EUROPA / EUROPE · EN 10219/10210`
  and `🇺🇸 USA · NPS/SCHEDULE`.
- Clicking switches in place: the selection slides across a green-gradient
  track, and the calculator panel crossfades while gently moving/collapsing.
- CSS transitions only, no new animation dependencies. Duration about 580 ms.
- `prefers-reduced-motion: reduce` removes motion while retaining the UI.
- Both independent calculator components mount only when first selected;
  afterwards each stays mounted, retaining entered dimensions, bar count and
  US NPS/Schedule selections during switching.
- Hidden mode uses `aria-hidden`, HTML `inert` and CSS `visibility:hidden`,
  so focus and assistive technology do not enter inactive controls.
- Native buttons with `aria-pressed`, proper labels, focus rings, minimum
  59px target height and mobile 320px layout. No keyboard traps.
- Main IT and EN calculators default to EU (the existing indexed
  calculator and its prefilled query parameters).
- Existing IT and EN US pipe SEO landings default to USA (manufacturer
  evidence for selected NPS/Schedules); their canonical and headings
  continue to describe American pipe.
- Each initial HTML render contains only its primary region to avoid
  duplicating hidden content on crawled pages. The secondary calculator is
  mounted on demand after hydration.
- The original EU technical evidence block now belongs to the EU pane,
  rather than being shown beneath the US mass form.

## Commercial and technical guardrails

- European section engine: EN 10219/EN 10210/geometric unchanged,
  published reference evidence untouched.
- American section engine: source-backed 13-row manufacturer sample,
  theoretical vs published mass distinction unchanged.
- Switching does not navigate or modify the address or canonical.
- EN calculator still transfers via `sss:calc-rfq-handoff:v1`.
- US calculator still transfers via `sss:us-pipe-rfq-handoff:v2`.
- No automatic RFQ dispatch or new server writes.
- Dedicated US SEO pages remain separate to address search intent.

## Acceptance

1. `apps/web`: `npm test`, `npm run typecheck`, `npm run build`.
2. `tests/calc-int4-cinematic-eu-us-switch.test.mjs`: four routes,
   state preservation, accessibility, reduced motion and SEO/RFQ contracts.
3. `tests/calc-int4-chrome-cinematic-switch.mjs`: mobile IT/EN,
   no-navigation switches, EU input edits preserved, USA NPS choice preserved,
   inert hidden panel, reduced-motion CSS, dedicated US page default.
4. Existing CALC-UX3, BD11 and CALC-INT3C Chrome tests green; merge only after
   required CI and Chrome checks pass.
5. Production smoke after Vercel deploy separately: run the switch without
   changing URLs, inspect mobile layout, confirm the two RFQ paths.

Future standards/languages remain independent of this component: translation
into DE/FR/ES must be released with actual localized calculator UI and correct
SEO before making those language routes public.
