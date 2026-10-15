# CALC-INT1 — International Calculator Architecture & SEO Foundation

Date: 2026-10-15. Status: implementation baseline, release gated by CI.
Scope: non-breaking foundation for public steel-tube calculators. This is **not**
the release of German, French or Spanish calculators or additional standards.

## 1. Preserve existing public URLs and ranking signals

| Locale | Live public calculator | Public RFQ bill | HTML root |
| --- | --- | --- | --- |
| it | `/knowledge/tubes` | `/distinta` | `lang="it"` |
| en | `/en/knowledge/tubes` | `/en/distinta` | `lang="en"` |

No redirects, renames, canonical migrations, host changes, or changed SEO copy
are permitted as part of CALC-INT1. Keep the current IT/EN sitemap entries and
bidirectional `hreflang`, with each page using its own canonical URL.

The local SEO policy for calculator variants is:
- the clean IT and EN URLs are indexable;
- links containing query parameters continue to hydrate their calculator state;
- all parameterized variants are `noindex,follow` while preserving their
  clean page canonical (IT already did this; EN reaches parity in this block);
- links with `#calcolatore-pesi` and analytics `source`/`surface` remain valid;
- no query-string/shape/length combination generates an indexable URL.

`lib/calculator-international-contract.ts` contains the published route
contract. It intentionally reserves `/de/knowledge/tubes`,
`/fr/knowledge/tubes` and `/es/knowledge/tubes` as **unreleased**: these MUST
NOT enter sitemap, `hreflang`, the language selector, or navigation until actual
content and route QA are complete. Do not render redirects or placeholders
to manufacture these pages.

## 2. What is intentionally kept unchanged

- The public IT and EN pages share `PublicTubeWeightCalculator`.
- Active calculation modes remain EN 10210, EN 10219 and free geometric mode,
  for CHS/SHS/RHS; the existing density and nominal-corner behaviour remains.
- Existing calculator inputs are serialized as shareable query parameters.
- The calculator-to-RFQ interface uses `calculator-rfq-handoff.ts` and the
  existing `sss:calc-rfq-handoff:v1` sessionStorage key. The tab-local,
  time-limited, bounded and validated payload schema remains version 1.
- The calculator sends users to `/distinta` for IT or `/en/distinta` for EN;
  the existing builders consume the payload and do not auto-send an RFQ.
- A product standard, published reference weight and theoretical mass must
  never be silently treated as interchangeable.

## 3. Technical inventory for CALC-INT2

Current math-related code is distributed between:
- `components/public-tube-weight-calculator.tsx` — the live shared UI also
  calculates areas, nominal radii, mass, total bars and inverse tonnage;
- `lib/international-tube-mass.ts` — separate pure estimator;
- `lib/calculator-rfq-handoff.ts` — accepts a computed mass and transports
  the validated selection into the public bill of materials.

CALC-INT2 should create one typed, pure mathematical implementation with
reference vectors and an adapter preserving the exact existing user-facing
results and RFQ v1 handoff. Do not change numerical algorithms in CALC-INT1.

The future normative registry must distinguish:
1. calculation method and its applicable geometries;
2. dimensional or mass-series reference;
3. product/delivery/quality standard;
4. verified source/evidence vs theoretical estimate.

EN 10220, EN 10255, EN 10305, EN 10216/10217, EN ISO 1127 and ASME
B36.10/B36.19 are **candidate scopes only**. Verify applicability, editions,
table licensing and reference evidence before exposing each as a selection.

## 4. International page release gates

For each proposed translated/geometry/standard-specific page:
1. Its technical calculator really works for the declared standard/family.
2. Page contains full localized visible body copy, form labels, validation,
   results, method explanation, CTA, accessible language navigation and
   meaningful local search intent (not template-only text).
3. Separate route uses correct root `<html lang>`, self-canonical, clear title,
   heading and search description, and appears in sitemap only after release.
4. Hreflang set is bidirectional, includes the page itself, and references
   *only released equivalent content*. Each localized route is independently
   indexable; no cross-language canonical.
5. Existing bookmarked URLs and shareable query parameters still load.
6. Caller can calculate without a login; the public RFQ bill opens from the
   same tab with geometry, standard, mass, quantity and length intact.
7. Mobile, accessibility, Core Web Vitals and privacy/consent review pass.
8. No unlicensed standards tables, uncertified weight claims or fake
   `verified` classifications appear.

Avoid auto-translating search traffic into thin programmatic combinations.
Dimension URLs should be released selectively, backed by real dimension data.

## 5. CI and post-release acceptance

Automated baseline:
- `npm run typecheck` under `apps/web`
- `npm test` under `apps/web`
- `npm run build` under `apps/web` where deployment secrets/config allow
- `tests/calc-int1-international-seo-foundation.test.mjs`
- `tests/i18n7-unified-tube-calculator.test.mjs`
- `tests/calc-ux2-result-to-rfq.test.mjs`
- `tests/i18n4-seo-contract.test.mjs`

Production read-only smoke after merge:
- `GET /knowledge/tubes` and `GET /en/knowledge/tubes`: HTTP 200,
  correct page language, self-canonical and reciprocal hreflang.
- `GET /knowledge/tubes?standard=en10219&family=round_tube` and
  `GET /en/knowledge/tubes?standard=en10219&family=round_tube`:
  inputs prefill and parameterized response declares `noindex`.
- `GET /sitemap.xml`: both clean calculator routes present; reserved
  DE/FR/ES calculator pages absent.
- In a browser, calculate a CHS and an RHS in both languages, add each to
  the RFQ bill and confirm dimensions, standard, bars and theoretical kg/m
  survived. **Do not submit real RFQs during acceptance.**

Google Search Console checks (separate from app CI): monitor coverage,
Google-selected canonical, impressions and clicks for the original URLs.
A successful sitemap response or URL inspection eligibility is not proof of
indexing. Do not request indexing for non-published localized URLs.

## 6. Exit criteria

CALC-INT1 ends with a small reviewed PR, CI green, unchanged published
IT/EN addresses, parameterized EN robots parity, protected RFQ handoff and
a reusable route/release registry. CALC-INT2 can start once these checks pass.
