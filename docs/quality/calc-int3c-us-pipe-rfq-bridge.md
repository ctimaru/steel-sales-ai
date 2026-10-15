# CALC-INT3C — API/ASTM NPS/Schedule to RFQ (controlled v2 pilot)

## Release contract
This release is a **complete, fail-closed handoff for the 13 governed U.S. Steel
NPS/Schedule sample combinations**. It does **not** represent full ASME B36.10
dimension coverage or API/ASTM certification; expanding the licensed US tables,
ASTM A500 HSS and API 5CT will require separate source verification.

- New browser-only queue: `sss:us-pipe-rfq-handoff:v2`.
- The existing `sss:calc-rfq-handoff:v1` is untouched and continues to
  carry EN 10219 / EN 10210 / geometric calculations.
- v2 stores the sample ID, selected *requested* product standard (API 5L,
  ASTM A53 or A106), length, bar count, time and queue ID. It never stores
  a manufacturer-published weight as the calculation result.
- It enforces a strict allowlist of standard identifiers and the 13
  source-backed sample IDs; 10-minute TTL, positive numeric dimensions,
  integer bars, max 20 items, no duplicates, no network or automatic dispatch.
- Consumers re-read the governing sample and recompute the theoretical
  geometry-only mass using the CALC-INT2 shared numerical engine.
- The sample source is still the U.S. Steel catalog. Grade, edition,
  PSL, manufacturing process, tolerances and certificates always require
  supplier/user confirmation. Manufacturer-published mass remains separately
  labelled and never replaces theoretical kg/m.
- English: `/en/distinta` creates an editable geometric line with
  the requested US product standard and NPS/Schedule included in the
  item-specific description, visible callout, persisted session draft and
  copied RFQ text. Grade must be entered by the user.
- Italian: `/distinta` creates an editable line with the requested product
  designation in `standard`, source NPS/Schedule in `description`, and
  provenance/caveats in `note`. No grade is invented and nothing auto-sends.
- The US calculator offers a direct "Add to RFQ bill" action and retains the
  manual "Open geometric calculator" link.
- Existing published SEO URLs, canonicals and hreflang remain intact.
- All tool operations are client-side, same-tab and optional; blocked
  sessionStorage yields a visible failure and never dispatches RFQs.

## Technical acceptance
- `npm test`, `npm run typecheck`, `npm run build` under `apps/web`.
- `calc-int3c-us-rfq-handoff.test.mjs` guards source integrity, v1
  coexistence, hostile payloads, expiry and duplicate prevention.
- All established CALC-INT1/2/3A, BD11, RFQAI and I18N tests remain green.
- Chrome: in IT and EN, choose NPS 6 Sch40, API 5L, 12m × 10 bars,
  click Add to RFQ, confirm the line is present with correct NPS, grade
  still empty, editable kg/m, and provenance. No RFQ is sent.
- Also test an existing EN 10219 SHS into /distinta and EN 10210 RHS
  into /en/distinta, proving v1 remains valid.
- Refresh the English bill to verify the US item-specific product intent
  survives the existing `sss:english-rfq-bill:v1` browser draft format.
- Production deployment and Search Console indexation are separate from CI.

## Next source-gated work
CALC-INT3C.2: licensed, edition-controlled ASME B36.10 / B36.19
NPS/Schedule expansion, API 5L 47th PSL/grade compatibility matrices and
ASTM A500-specific HSS geometry. Do not extrapolate the current 13-row sample.
