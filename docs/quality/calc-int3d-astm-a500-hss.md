# CALC-INT3D — ASTM A500 HSS / AISC design-section model

Date: 2026-10-15. Public, non-certifying theoretical **AISC HSS section-property mass proxy** for round, square and rectangular structural tubing.

## Sources and distinctions

- ASTM active A500/A500M-23 product specification: https://store.astm.org/a0500_a0500m-23.html
- Steel Tube Institute ASTM A500 technical overview: https://steeltubeinstitute.org/resources/astm-a500/
- Steel Tube Institute AISC 16th Manual HSS geometry: https://steeltubeinstitute.org/resources/filling-the-void-a-central-resource-for-designing-concrete-filled-hss-columns/
- AISC HSS FAQ describing designation differences from ASTM A53 pipe: https://www.aisc.org/aisc/solutions-center/hss/

ASTM A500 is a **product** specification; AISC provides a **structural design convention**. This change computes the latter, without claiming the result equals actual as-delivered mass or a published/verified catalog weight. No protected dimensional or shape-property table is reproduced.

AISC conventional properties for A500 HSS:
- `t_design = 0.93 × t_nom`.
- Square/rectangular mean section-property outside corner `r_out = 2 × t_design`, inside `r_in = r_out - t_design`.
- Rectangular reference area `A = 2 t_design (B + H - 2 t_design) - (4 - π) × (r_out² - r_in²)`.
- Round `A = π × t_design × (D - t_design)`.
- `kg/m = A × 7850 / 1e6`, `lb/ft = kg/m / 1.48816394357`.
- This is *not* a wall-tolerance compliance check, certified weight, or proof of grade C/B availability; confirm manufacturing and design suitability independently.
- Scope gates: 88 in perimeter, 1 in nominal wall, positive core dimensions; no size availability inference.

## UI

Within the existing cinematic Europa ↔ USA switch, the USA calculator gains
a third self-contained mode **HSS · ASTM A500** alongside documented
NPS/Schedule and custom line pipe modes. It supports CHS, SHS and RHS,
mm or inches, bar count and length; a source-labelled design-proxy result
is displayed with supplier confirmation disclaimers. Inputs persist when
switching between tabs and EU/USA.

## RFQ compatibility

An additive `mode:"hss"` variation in the existing
`sss:us-pipe-rfq-handoff:v2` uses `productStandard:"astm-a500"` and
shape + bounded dimensions. Rejects A500 coupled to NPS catalog or
ordinary custom pipe mode. Existing API 5L, ASTM A53/A106 v2 and EN
`sss:calc-rfq-handoff:v1` remain unchanged.

On import:
- IT `/distinta`: line explicitly HSS shape, ASTM A500 product requirement
  and theoretical AISC mass, not pipe OD and not manufacturer published mass.
- EN `/en/distinta`: original HSS shape and **`aisc-a500` design method**,
  with recomputation by the shared CALC-INT2 engine. The RFQ is editable and
  the grade must be added by the user.
- Editing geometry in the English bill invalidates the inherited product
  intent, preventing an obsolete designation from silently following edits.
- No automatic RFQ dispatch, authentication, migration or DB write.

## SEO and release guards

Existing canonical URLs, multilingual hreflang, sitemap, EU formula outputs
and anonymous calculation → bill → RFQ flows are unchanged.

Run `npm test`, `npm run typecheck`, `npm run build` under
`apps/web` plus Chrome mobile HSS acceptance and existing
CALC-INT3C, CALC-INT4 and BD11 tests. Merge only after all green.
Use production visual QA after deployment; Google indexing is separate.
