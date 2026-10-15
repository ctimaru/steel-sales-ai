# CALC-INT3D.2 — American HSS Size Library & Reference Weights

Date: 2026-10-15. Scope: curated public manufacturer reference facts, not the
AISC Shapes Database, an ASTM table, bulk publisher redistribution or a stock
availability feed. NO new indexable routes.

## Data governance

- **15** individual, manually selected ASTM A500 HSS nominal size/weight
  records: 5 round, 5 square, 5 rectangular. Selected dimensions are in
  inches, and supplied manufacturer-published weight is **nominal lb/ft**.
- Atlas Tube source PDFs and exact *PDF page + source row* on each entry:
  - Round (current): https://www.atlastube.com/wp-content/uploads/2018/04/A500-Round-Current.pdf
  - Square: https://www.atlastube.com/wp-content/uploads/2018/04/Atlas-HSS-Section-Properties-A500-Squares.pdf
  - Rectangle (current): https://www.atlastube.com/wp-content/uploads/2018/04/A500-Rectangle-Current.pdf
- Publisher identification: Atlas Tube, manufacturer chart, ASTM A500.
  AISC Shapes Database v16.0 is referenced for standards context only,
  **not copied or bulk imported**:
  https://www.aisc.org/aisc/publications/steel-construction-manual/aisc-shapes-database-v160/
- Steel Tube Institute HSS Design Manuals are licensed for individual use
  absent group membership; the commercial SaaS must not republish the STI
  tables without authorization:
  https://steeltubeinstitute.org/hollow-structural-sections/hss-manuals/
- Expansion beyond this curated manufacturer-fact pilot requires a rights,
  edition, provenance, availability and change-monitoring review.

## Critical meaning of the two mass values

**Atlas Tube nominal catalog weight** = source `lb/ft` converted independently
to `kg/m` by `1 lb/ft = 1.48816394357 kg/m`.

**AISC ASTM A500 design-section estimate** = the shared CALC-INT2
`aisc-a500` method with effective wall `0.93 t_nom` and modeled corners.
It is NOT actual as-manufactured mass, not mill-certified delivered weight, not
equivalent to manufacturer nominal reference, and not a compliance assessment.
Percent delta is `(Atlas nominal kg/m / AISC design estimate kg/m - 1)*100`.

Every sampled row shows the original source with PDF page and designation.
No claims of inventory, grade, fulfillment, certification or applicability
of exact product edition are made.

## User experience

- In existing `🇺🇸 USA → HSS · ASTM A500` view, a compact **Atlas sizes**
  select filters to the active HSS cross-section (5 each).
- Choice populates the controlled round/square/rectangular nominal values,
  switches dimensions to inches for transparent sourcing, and displays two
  separate mass cards with difference and caveat.
- Changing any dimension or the HSS shape immediately revokes source identity
  and hides Atlas's published reference, leaving pure theoretical calculation.
- mm/in toggle retains proper dimensions and existing selection.
- IT and EN pages remain the same; no automatic commercial submission.

## RFQ integrity

The v2 key `sss:us-pipe-rfq-handoff:v2` remains. An optional
`hssReferenceId` on `mode:"hss"` is allowlisted and checked against all
dimensions converted to millimeters within 0.0002 mm. A browser cannot attach
a selected published weight to altered shape/dimensions or API/A53/A106.
The bridge re-resolves the manufacturer row, never trusts stored weight, and
**recomputes** AISC mass from the shared engine. The full reference intent
(source, page, nominal lb/ft and kg/m, not certified) survives as explanatory
text in the IT and EN RFQ draft. The manufacturer's weight NEVER replaces
the modeled mass used for tonnage.

Existing US NPS/Schedule and custom modes plus EN RFQ v1 remain compatible;
no migration or backend write.

## Acceptance

- `npm test`, `npm run typecheck`, `npm run build` in `apps/web`.
- New `calc-int3d2-hss-size-library.test.mjs`: 15 curated source vectors,
  unit conversion, independent nominal-vs-AISC comparison, hostile payloads,
  no provenance elevation, existing v1/v2 compatibility.
- New `calc-int3d2-chrome-hss-library.mjs`: IT/EN, selected reference,
  dimension edit revocation, source link, RFQ provenance.
- Existing CALC-INT3D, CALC-INT4, CALC-INT3C, BD11 and SEO regressions green.
- Protected merge only after all CI and Chrome checks green. Then independently
  verify Vercel production deployment and the bilingual mobile UI.
