# CALC-NEXT1C — Intelligent Dimension Discovery & Geometric Preview
Date: 2026-10-21.

## Scope implemented
- Search in current published Public Knowledge geometry only: round CHS, square SHS, rectangular RHS. Private builder uses its existing public-derived catalog, never the proprietary Alessio Tubi list.
- Instant local search tolerant of decimal comma/dot, multiplication signs, spacing and shape names. Filter by geometry and exact available wall thickness. Zero data fallback to manual entry (no fabricated "stock" values).
- Cards with inline source label and small proportional cross-section SVG; applying a candidate updates only `family/diameter/width/height/thickness`. Norm EN 10210/EN 10219/geometric, density, qty, length, commercial targets and RFQ state do not change.
- Existing `ParametricShapeDiagram` now visible on mobile rather than hidden on viewports below 1024px, and continues to use the current calculation standard and geometric validation.
- IT/EN/DE/FR/ES texts in the shared selector. No claim of stock, standard conformity or price equivalence implied by a published source.
- No additional Supabase reads, migrations, price publications, automatic supplier dispatch, or new tracking of user geometry.

## Acceptance
- New pure-data tests: 3 shapes, decimal comma, wall filter, dedup, missing/invalid shape sources; translations and source privacy static tests.
- Existing CALC-INT4.4 Chrome and BD11 390/1440: calculator to cart unchanged; P0, PERF, UI-SYSTEM2 and UI-SYSTEM4.
- Explicit visual QA outstanding: authenticated role flows with real company datasets. Public published-data availability depends on existing source queries (no invented fixture).

Next: NEXT1F international private builder acceptance and stronger geometry relevance search, evidence metrics after initial real usage.
