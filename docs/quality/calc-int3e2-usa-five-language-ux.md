# CALC-INT3E.2 — Five-language USA Calculator UX

Date: 2026-10-15. Build on CALC-INT3E.1 and all previous USA
CALC-INT3C, 3D, 3D.2 and 3D.3 acceptances.

## What is now genuinely translated

- Animated **🇪🇺 Europe ↔ 🇺🇸 USA** region selection on all five
  canonical calculator pages: IT, EN, DE, FR, ES. IT/EN previous routes,
  default EU behavior and all indexed canonical URLs remain unchanged.
- USA NPS/Schedule catalog mode, custom dimensions mode, and ASTM A500
  structural HSS mode (round/square/rectangular) use one shared component
  implementation on all five routes. No additional numerical engine.
- DE/FR/ES support genuine UI translations for source labels, manufacturer
  nominal weights vs theoretical masses, product standard intent, bar counts,
  physical units, warnings, copy, RFQ buttons and error messages.
- SEO-localized evergreen paragraphs explain NPS/API and A500 HSS in each
  target language, without claiming complete ASME tables or certification.
- Catalog/sample facts and publisher provenance remain unchanged.

## Switching regions / languages

- Switch is on-page with hidden inert panels and reduced-motion acceptance;
  EU and USA states remain mounted after first activation.
- Flag navigation within USA uses `system=us` and an explicit
  `usMode=catalog|custom|hss`. Catalog NPS, row ID, requested product norm,
  custom dimensions, bar counts, HSS source ID or free geometry are
  represented by bounded URL query parameters for cross-language navigation.
- IT/EN clean page defaults remain EU. The new DE/FR/ES clean pages default
  EU. URLs containing any share parameters are **noindex** and retain the
  original page's clean canonical. No geo redirects or redirect rewriting.
- HSS reference identity is re-resolved from curated Atlas facts, not trusted
  as a source of raw numerical mass. mm/in hydration accounts for the
  selected units. Geometric edits still revoke Atlas manufacturer references.
- DE/FR/ES submissions transfer into the **English** RFQ bill via the
  unchanged sessionStorage `sss:us-pipe-rfq-handoff:v2`. Italian submissions
  go to the Italian bill, English to English. No automatic dispatch or
  translation of supplier-certified property/grade requirements.

## Technical invariants

- EN 10219/10210 and pure geometric mass unchanged.
- NPS, Schedule and U.S. Steel nominal catalog data unchanged.
- HSS AISC 0.93*t_nom geometric design model unchanged and distinct from
  Atlas nominal lb/ft reference values.
- Existing `sss:calc-rfq-handoff:v1` untouched; v2 payload shape unchanged.
- IT/EN published URLs, noindex variants, sitemap and reciprocal hreflang
  untouched.
- No migrations, new proprietary-table uploads, third-party dependencies,
  network dispatch or additional customer data capture.

## QA

Run `npm test`, `npm run typecheck`, `npm run build`,
the existing IT/EN Chrome calculator, US NPS/HSS, accessibility and
Lighthouse gates, and:
- `calc-int3e2-usa-five-language-ux.test.mjs` for numerical invariants,
  five-language copy, provenance claims and robust bounded share state.
- `calc-int3e2-chrome-usa-five-language.mjs` on mobile for DE/FR/ES,
  animated EU/US state, NPS, custom, HSS Atlas, RFQ v2, and DE↔FR HSS
  cross-language identity/canonical/noindex.
Merge only after all CI green. Independent live Vercel and GSC checks
after deployment are not inferred from the merge.
