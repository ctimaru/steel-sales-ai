# CALC-INT3 — EN Structural + US API/ASME/ASTM Expansion (Phase A)

Date: 2026-10-15.

## Goals and what is actually released

- **EN 10219 and EN 10210 remain first-class, live calculation methods** for CHS/SHS/RHS on the original IT and EN URLs. The same CALC-INT2 engine produces their theoretical section weights. No geometry or norm formula was changed.
- **API Spec 5L, ASTM A53 and ASTM A106 are product requirements, not mass formulas**. API 5L 47th edition was published June 2, 2026; legacy U.S. Steel catalog evidence seeded with older API edition context must *not* be relabelled as API 5L 47th conformity.
- **ASME B36.10 is a dimensional designation context** for NPS/Schedule; no full proprietary ASME table was ingested or exposed.
- **ASTM A500 (HSS)** is intentionally in the registry as an informational US structural standard. EN 10219 and ASTM A500 are **not mathematically interchangeable** for SHS/RHS.
- **ASME B36.19M stainless Schedule S and API 5CT OCTG** are inventoried as planned but have no calculations until sourced/validated data, tolerances and material density are separately governed.

## New public pages

- IT: `/knowledge/tubes/tubi-americani`
- EN: `/en/knowledge/tubes/american-pipe`

Both self-canonical; reciprocal `hreflang`; both in public sitemap. Existing
`/knowledge/tubes` and `/en/knowledge/tubes` are untouched except one contextual link each.
No redirects, loss of ranking signals or alteration of parameterized-route noindex.

The UI supports only **13 manufacturer-published sample dimensions** for NPS 6, 8, 10, 12
and selected Schedules. They already exist in the project's original controlled
SK4.4b/SK4.4c migration data, sourced from U.S. Steel *Standard and Line Pipe
Catalog*, Pipe Tables, with page-level evidence and original lb/ft retained.

Data is replicated as small, statically checked **public manufacturing facts**
from existing governed sources. This is not a complete normative table; it
must never be described as a list of ASME-verified or API-compliant
dimensions. NPS/Schedule/class combinations are intentionally not extrapolated
to arbitrary other sizes.

## Calculation and user-facing honesty

- Geometry-only calculation uses CALC-INT2 shared `estimatePublicTubeMass`,
  `shape=round, standard=geometric`, with the source OD/wall and illustrative
  carbon-steel density 7,850 kg/m³.
- The source **published** weight (both lb/ft and its rounded kg/m) is displayed
  in a separate field. This may differ from the weight calculated from nominal
  dimensions. Neither is "verified" or "certified" merely by appearing here.
- Product-standard choice (API 5L, ASTM A53, ASTM A106) is informative **only**;
  never changes the weight equation or silently implies grade, PSL,
  process, applicable edition or regulatory conformity.
- To move into the original RFQ bill, the user can copy an explicit
  full specification and open the current calculator with shareable geometric
  dimensions. The current `sss:calc-rfq-handoff:v1` schema accepts EN10210,
  EN10219 and geometric only; we **do not invent or auto-insert** an API standard
  into it. A next dedicated migration can evolve the handoff schema after
  separate acceptance, but must preserve old queue migration safely.

## Technical contracts

- `lib/calculator-standards-registry.ts`: role
  `calculation-method | dimensional | product`, rollout status
  `calculator-live | context-only | planned`, issuer, shapes, source and
  localized caveat.
- `lib/us-pipe-catalog-sample.ts`: 13 explicitly sourced samples,
  manufacturer weight separated from theoretical estimate.
- `components/us-pipe-sample-calculator.tsx`: separate bilingual NPS/Schedule
  interface; keeps existing EN calculator and commercial handoff unchanged.
- `tests/calc-int3-us-standards-and-sample.test.mjs`: independent numeric
  vectors, provenance and non-equivalence tests, SEO URL contract and RFQ
  payload boundaries.

## Next governed work, in priority order

1. **CALC-INT3B — EN 10219 / EN 10210 reference QA**: check published
   dimensions, radii, tolerance definitions and mass reporting against
   licensed normative references; never infer EN certificate from calculation.
2. **CALC-INT3C — API 5L + ASME B36.10 structured NPS**: approval of source
   rights, dimensional mapping by edition, larger source coverage, verified
   product standard/grading and v2 RFQ handoff with product-standard context.
3. **CALC-INT3D — ASTM A500 HSS / ASTM A53 / A106**: source-specific geometry
   and product rules, no EN corner-radius assumptions.
4. **CALC-INT3E — ASME B36.19M / API 5CT**: independent series,
   stainless densities and OCTG spec evidence.

## Release QA

- Run `npm test`, `npm run typecheck`, `npm run build` from `apps/web`.
- Existing I18N7, CALC-INT1 and CALC-UX2 regression tests must stay green.
- Check clean new URL canonical/hreflang, reciprocal sitemap and all three
  existing main route URLs.
- Test NPS 6 Sch40, NPS 10 Sch140, NPS 12 STD: weight label must distinguish
  nominal theoretical vs published; validate kg/m, lb/ft, total.
- Confirm API/ASTM intent is not silently passed to RFQ as a certified standard;
  EN 10219 and EN 10210 calculator→distinta→RFQ still work unmodified.
- Production smoke after merge separately from CI; sitemap availability is
  not evidence of Google's indexation.

## Issuing-body reference links (descriptions, not reproduced tables)

- API Spec 5L 47th (June 2026): https://www.api.org/products-and-services/standards/important-standards-announcements/api-announces-47th-edition-of-foundational-line-pipe-standard-5l
- ASME B36.10 dimensions: https://www.asme.org/codes-standards/find-codes-standards/b36-10m-welded-seamless-wrought-steel-pipe
- ASTM A53/A53M-24: https://store.astm.org/a0053_a0053m-24.html
- ASTM A500/A500M-23: https://store.astm.org/a0500_a0500m-23.html
- ASME B36.19M: https://www.asme.org/codes-standards/find-codes-standards/b36-19m-stainless-steel-pipe
