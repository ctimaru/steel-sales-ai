# CALC-NEXT1D — Private RFQ cart visual convergence

Date: 2026-10-21. Objective: bring the private Buyer Distinta builder closer to CALC-NEXT1A/B's user-directed floating cart and drawer while preserving all commercial/RFQ capabilities.

## Delivered in this microblock
- Calculator-first canvas: one-column editor, independent technical cart with floating quantity/metre/tonne monitoring; no automatic drawer opening or scroll after add.
- Private drawer with desktop right-side design and phone bottom sheet, portal escaping transformed layouts, Escape, focus trap, outside-click, body scroll lock and restored trigger focus.
- Editing, duplicate, remove, requirement-level documentation, private buyer target €/t, draft resume and RFQ Hub route remain intact. A top inline button opens even an empty draft for manual addition.
- Existing canonical `calculateBuyerDistintaTotals` is the only source for the quantities. Floating trigger shows technical totals only, never economic target values.
- Existing incomplete-row HUD action opens the drawer then focuses the relevant row; buyer draft stays tab-scoped.
- No Supabase migration, automatic supplier email, upload of private rates, or publication to network. Private builder remains IT; multilingual private workspace copy is a separate I18N item.

## Gates
- BD1–BD18, CALC-UX, UI-SYSTEM2/UI-SYSTEM4, P0 required, frontend typecheck/build.
- Chrome BD11 390/1440: no automatic opening; count, add with EN 10219/10210, open/close and no overflow.
- Further authenticated cross-tenant RFQ acceptance is out of scope for this UI-only PR; use existing production/staging gates.
- Vercel cost control: one PR preview, no manual rebuilds, protected merge only after all applicable tests are green.
