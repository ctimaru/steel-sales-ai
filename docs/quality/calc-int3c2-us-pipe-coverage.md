# CALC-INT3C.2 — US pipe source coverage and custom geometry

Implementation date: 2026-10-15. In scope: curated public manufacturer facts
and user-supplied dimensions; not a licensed ASME dimensional series.

## Published content

- **20** source-located U.S. Steel Standard & Line Pipe combinations
  (previously 13). Source NPS bands: 2, 2½, 3, 4, 6, 8, 10, 12.
- Seven incremental facts: NPS 2 Sch80/160, NPS 2½ Sch40/80/160,
  NPS 3 Sch40 and NPS 4 Sch40. The source wall/OD values are
  published in inches and converted to mm. Published lb/ft and
  kg/m are displayed separately from the CALC-INT2 mathematical output.
- Publisher: U.S. Steel `Pipe Tables`,
  https://www.ussteel.com/documents/d/home/standard-and-line-pipe-catalog
  for the seven new rows. The 13 legacy rows keep the original
  PDF and page-level sources.
- No unverified PDF page numbers are assigned to the incremental rows;
  they retain an explicit manufacturer table locator instead.
- Importantly, this is still *not* a complete ASME B36.10 dataset and
  does not establish API 5L 47th or ASTM material conformity.

## Unlimited theoretical calculation without inventing size mappings

New USA mode: `NPS / Schedule samples` vs `Custom dimensions`.
The custom input accepts outside diameter and wall thickness in mm
or inches (1 in = 25.4 mm). Selected values are converted when switching
units, and the same shared pure geometric engine computes kg/m, lb/ft,
kg per batch and tonnes at nominal carbon-steel density 7850 kg/m³.
No NPS, Schedule, manufacturer published weight or supplier grade is
implied by arbitrary numbers. Out-of-range, incomplete and implausible
section dimensions are rejected, not rounded into catalog rows.

The calculator retains the region selector from CALC-INT4: IT/EN
Europe <-> USA preserves separate state in both calculators.

## RFQ safety

The established `sss:us-pipe-rfq-handoff:v2` queue still accepts
**all original catalog payloads** without changing their serialized
shape. A strict discriminant `mode:"custom"` additionally allows a
bounded OD/wall geometry, request intent (API 5L, ASTM A53/A106), bars
and bar length, but *not* an NPS/Schedule or manufacturer weight.

Both existing public bills use the trusted geometry re-calculated
from the shared engine, display the product standard as an unverified
supplier requirement, and keep provenance explanatory. The Italian
draft no longer prints `null kg/m` when there is no published catalog
weight. No dispatch, auth or server database writes were added.

## Non-goals and future source gates

- No complete copy of proprietary ASME tables.
- No automatic NPS/Schedule derivation for user-supplied dimensions.
- No API 5L grade, PSL, product tolerance or certification inference.
- No changes to EN 10219/10210 nominal-corner formulas, URLs, canonical,
  reciprocal hreflang, sitemap or already published indexed pages.
- ASTM A500 HSS structural mass, ASME B36.19 Schedule S and API 5CT
  remain evidence- and license-gated.
- Any future bulk source ingestion will need documented reproduction
  permission, edition, supplier scope, and conflict handling.

## Acceptance

- `npm test` including `calc-int3c2-us-coverage-custom.test.mjs`,
  CALC-INT3A/3C and CALC-INT4, all original RFQ/SEO contracts.
- `npm run typecheck` and `npm run build`.
- Browser test in IT+EN checks 2½ Sch80 and custom 4.5 in x
  0.237 in, user standard identity, no NPS guessing, visible RFQ
  intent and v2 consumed queue; no actual RFQ submission.
- Merge only when required P0 and Chrome checks green. Production
  smoke and Search Console inspection are separate.
