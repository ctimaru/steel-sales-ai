# RFQAI3.2 — Geometry recognition and editable review fix

## Incident
An authenticated user successfully received AI text extraction, but the exact quoted request
`30 barre da 12 metri di tubo quadro 100x100x5 S355J2H EN 10219`
was rendered as **Geometria non riconosciuta / invalid geometry / ambiguous geometry**, with no kg/m
and an unavailable approval checkbox. The AI can populate overlapping `outerDiameterMm`
and `widthMm/heightMm`, or omit the quote's norm/quantity. RFQAI3's original review UI did
not expose geometry fields for correction.

## Fix and acceptance
1. **Conservative deterministic reconciliation:** only when the model-supplied `sourceText`
   appears verbatim in the submitted text and names exactly one explicit tube shape, parse a
   single matching 2-/3-dimension size. Clear conflicting geometry fields (OD for square/rectangular;
   width/height for round). Resolve *uniquely present* norm, grade, bar quantity and 12m length from
   that same quote. A bare `100x100x5`, fabricated source citation, multiple conflicting sizes or
   shape without matching dimensions **cannot** silently infer shape/measurements.
2. **Repair UX in same RFQAI3 candidate card:** select Round / Square / Rectangular, edit
   diameter or sides and wall thickness in mm. Every correction reruns RFQAI1 normalization and
   theoretical kg/m. Editing resets confirmation, no auto-save/dispatch. Explain disabled checkbox
   instead of leaving user with an unexplained inert option.
3. **Regression:** square 100x100x5 mixed invalid OD+width/height recovers to 360 m at 30×12 m,
   norm EN 10219 and grade S355J2H; round 60.3x3 EN 10210 120 m remains correct; rectangular
   120x80x4; explicit manual repair; ambiguous/unsupported source remains invalid.

No new model/provider request, auth changes, Supabase migration, or RFQ permission changes.
Pending checks: GitHub required gate, browser/mobile tests, then merge and production verification.
