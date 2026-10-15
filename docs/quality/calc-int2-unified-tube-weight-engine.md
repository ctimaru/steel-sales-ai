# CALC-INT2 — Unified Steel Tube Weight Calculation Engine

Date: 2026-10-15. This microblock consolidates the numerical source of truth,
without publishing a new engineering norm, adding a route, or changing the RFQ
handoff contract.

## One engine, two existing consumers

- `apps/web/lib/international-tube-mass.ts` exports `calculateTubeSection`
  for shape, nominal radii, area, theoretical kg/m and method provenance.
- `PublicTubeWeightCalculator` (the same component for IT and EN) delegates
  **all section geometry and kg/m computation** to `calculateTubeSection`.
  Display, translations, input validation, copy, inverse tonnage and history
  remain in the UI without duplicating the section geometry formula.
- The English RFQ bill continues to call `estimatePublicTubeMass`, which
  now delegates to the same `calculateTubeSection` and multiplies kg/m by
  bar length and integer quantity, maintaining the established API response.
- The guided Italian RFQ tube configurator (`buyer-tube-guidance.ts`) also
  delegates its normative section mass to this same engine, preserving the
  original EN 10210 / EN 10219 labels, null-on-invalid behaviour and grade gate.
- The Italian public RFQ bill continues to import the unchanged
  `calculator-rfq-handoff.ts` format and `/distinta` route.

## Nominal methods (unchanged)

- Circular: `π × t × (D − t)` mm²; true for EN10210/EN10219/geometric.
- SHS/RHS free geometry: `B × H − (B − 2t) × (H − 2t)` mm².
- EN10210 SHS/RHS: outer radius 1.5t, inner radius 1t.
- EN10219 SHS/RHS: radii (2t, 1t) when t<=6; (2.5t,1.5t)
  when 6<t<=10; (3t,2t) when t>10.
- Rounded-corner area correction:
  `2t(B+H−2t) − (4−π)(R_outer²−R_inner²)`.
- EN10210/10219 effective density remains 7,850 kg/m³.
- Free geometry allows custom positive density; mass follows
  `areaMm2 × kg/m³ / 1_000_000`.
- These are theoretical masses only; they do not certify products or
  upgrade source evidence to a published or verified reference.

## Fixed contracts

- Calculators: `/knowledge/tubes` and `/en/knowledge/tubes`.
- Public bills: `/distinta` and `/en/distinta`.
- Handoff key `sss:calc-rfq-handoff:v1`; schema `version:1`, same-tab
  bounded queue, TTL and no automatic dispatch.
- All CALC-INT1 hreflang, canonical and `noindex` rules remain unchanged.
- No new UI option claims EN10220/EN10255 support: registry extension
  requires source/evidence verification and a separate acceptance.

## Release acceptance

1. `npm test` (including `calc-int2-unified-tube-mass-engine.test.mjs`
   and updated WC3/K5/I18N2/I18N7 tests).
2. `npm run typecheck` and `npm run build`.
3. Required GitHub CI green before merge.
4. Chrome QA on existing IT/EN pages: one CHS and one RHS, theoretical
   kg/m, reference labels, total bar mass and copy; add to public RFQ
   in the same tab and confirm dimensions, standard, length and bars.

The numerical regression suite compares original equations with the
shared engine across the three shapes, three current methods, EN10219
thickness boundaries and custom-density cases. No network access is used.
