# CALC-INT3D.3 — Controlled HSS Expansion & Search UX

2026-10-15. Follow-on to CALC-INT3D.2 (PR #599). The Atlas Tube HSS
ASTM A500 sample increases from **15 to 30 individually sourced rows**:
10 round, 10 square and 10 rectangular.

## Source references for the incremental 15 records

All new records are manually selected from public, manufacturer-published PDF
charts; each record includes the exact source row and **1-based PDF page**.

- Round: Atlas Tube A500 Round Current, PDF **page 3**:
  https://www.atlastube.com/wp-content/uploads/2018/04/A500-Round-Current.pdf
  - HSS 12.000 × 0.625 — 76.00 lb/ft
  - HSS 12.000 × 0.500 — 61.47 lb/ft
  - HSS 11.750 × 0.250 — 30.73 lb/ft
  - HSS 10.750 × 0.375 — 41.59 lb/ft
  - HSS 9.625 × 0.250 — 25.06 lb/ft
- Square: Atlas Tube A500 Squares, PDF **page 2**:
  https://www.atlastube.com/wp-content/uploads/2018/04/Atlas-HSS-Section-Properties-A500-Squares.pdf
  - HSS 8 × 8 × 3/8 — 37.69 lb/ft
  - HSS 7 × 7 × 1/4 — 22.42 lb/ft
  - HSS 6 × 6 × 5/16 (nominal 0.313 in) — 23.34 lb/ft
  - HSS 5 × 5 × 1/4 — 15.62 lb/ft
  - HSS 4.5 × 4.5 × 3/8 — 19.82 lb/ft
- Rectangle: Atlas Tube A500 Rectangle Current, PDF **page 3**:
  https://www.atlastube.com/wp-content/uploads/2018/04/A500-Rectangle-Current.pdf
  - HSS 12 × 10 × 3/8 — 53.00 lb/ft
  - HSS 12 × 8 × 1/4 — 32.63 lb/ft
  - HSS 12 × 6 × 3/8 — 42.79 lb/ft
  - HSS 12 × 4 × 1/4 — 25.82 lb/ft
  - HSS 10 × 8 × 3/8 — 42.79 lb/ft

These are individual nominal catalog facts, not an import/republishing of an
entire proprietary standard, manufacturer database or STI/AISC subscription.
Do not extend to bulk coverage without a separate rights/provenance review.

## Search experience

In USA → HSS · ASTM A500, with no route change:

- Shape filter remains via the existing HSS shape select.
- An accessible search field accepts designations, dimensions, fractions,
  e.g. `6x4`, `6 × 4 3/8`, `12.000 0.625`, `6x6 5/16`.
- Nominal wall filter offers only walls in the source-backed shape subset.
- Count `matches / 10`, visible no-match note, quick clear.
- A selected row is pinned in the dropdown if the search temporarily
  excludes it, preventing the search field from silently revoking provenance.
- Changing any shape/nominal geometry immediately removes the reference.
- Same-tab EN and IT RFQ continue to recalculate AISC theoretical mass
  and keep Atlas nominal weight as separately labelled non-certifying evidence.
- No inferred sizes, no automatic RFQ submission and no SEO URL changes.

## Acceptance

- All existing CALC-INT3D/3D.2, EN, API/NPS and SEO unit tests.
- `calc-int3d3-hss-search-expansion.test.mjs`: 15 new golden vectors,
  provenance page, mathematical independence, pure search/wall filters,
  RFQ anti-forgery and backward compatibility.
- `calc-int3d3-chrome-hss-search.mjs`: 360px IT and EN, filters, no-match,
  pinned selection, reset, provenance revoked after manual edit and RFQ.
- `npm test`, `npm run typecheck`, `npm run build` plus Chrome mobile,
  accessiblity and Lighthouse required CI; squash merge only with all green.
- Check live Vercel deployment and mobile display separately after merge.
