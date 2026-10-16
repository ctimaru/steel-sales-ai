# CALC-INT4.4A — Shared Inline Distinta Contract & State
**Date:** 2026-10-16 · **Scope:** data-layer only · **Status:** PR acceptance pending.

## Product decision
The user's approved sequence is **live calculator → click Add → inline technical bill below the calculator → deliberate private RFQ creation**. The next feature blocks will own visible UX (4.4B), commercial-rate opt-in (4.4C), auth/private RFQ creation (4.4D), five-language parity (4.4E), and production acceptance (4.4F). This block introduces **no UI** and **no remote writes**.

## Actual existing contracts
- `apps/web/components/public-tube-weight-calculator.tsx` already exposes `onAddToDistinta(item): boolean`; default public behavior still navigates through the 10-minute `CALC_RFQ_HANDOFF_KEY` queue.
- `apps/web/lib/calculator-rfq-handoff.ts` validates the geometry/standard/quantity/density and adapts a calculator item to an existing `BuyerDistintaDraftLine`.
- `apps/web/lib/buyer-distinta.ts` remains the sole authority for line calculations and bill totals; no duplicate mass or pricing formula.
- `apps/web/components/buyer-distinta-builder.tsx` remains the existing full public/private builder, with existing `buyer-distinta-session-draft.ts` draft key and 500-line internal limit.
- `apps/web/lib/buyer-distinta-rfq-one-step.ts` remains the one-step authenticated private campaign workflow, not invoked by 4.4A.

## Implemented contracts
New pure library `apps/web/lib/calculator-inline-distinta.ts`:
- `emptyInlineDistinta()`
- `addInlineDistintaItem(state, item, now?)`: validated item → canonical buyer line, stable event ID; repeated same event is rejected (never silently duplicates). 50-line mobile public composition bound.
- `editInlineDistintaLine(state, id, patch)`: quantity, bar length, buyer grade, finish and notes only; geometry, kg/m and norm cannot be edited without recalculation; requires the resulting line to be valid and complete.
- `duplicateInlineDistintaLine(state, id, newId)` and `removeInlineDistintaLine`: explicit immutable edits.
- `inlineDistintaTotals(state)` delegates to the existing `calculateBuyerDistintaLine` and `calculateBuyerDistintaTotals`.
- `inlineDistintaBuyerLines(state)`: returns cloned canonical buyer lines for **future** authorized snapshot save. Does NOT create a database row or dispatch.
- `serializeInlineDistinta`, `parseInlineDistinta`, `readInlineDistintaSession`, `persistInlineDistintaSession`: single-tab, distinct session namespace `sss:inline-distinta:v1`, 24-hour TTL, max 100,000 chars, strict unknown fields, duplicate IDs and invalid numeric payload rejection. Does not consume legacy handoff or overwrite `/distinta` draft.
- Results carry `ok` and `reason` (`invalid`, `duplicate`, `full`, `missing`) for clear future UI feedback.

**Price/privacy invariant:** all initial calculator-to-bill rows have `targetEurT: ""`; 4.4A rejects state/session edits that contain prices, including unknown commercial fields. `€/ton ↔ €/m` stays ephemeral in its current component; opt-in buyer target functionality is exclusively 4.4C. Neither bill contents nor commercial prices are written to URL, cookies, remote storage, analytics or supplier payloads.

## Automated acceptance
`apps/web/tests/calc-int4-4a-inline-distinta-contract.test.mjs` executes real transpiled pure modules, covering:
- CHS/SHS/RHS and EN 10210/10219/free-geometric with their unique buyer lines, kg/m, totals, grade blank and price blank.
- Idempotent add, user-triggered duplicate, independent line edits, removal and immutable state.
- Invalid geometry, stale item, invalid quantity, fractional bars, malicious edit fields, mixed quantity modes.
- Same-tab restore/expiry, version, oversized payload, unknown fields, prices, duplicate IDs and storage errors.
- 50-line cap, stable identity, 1:1 Buyer Distinta total and safe future snapshot adapter.
- Regression on legacy builder, buyer session, original public calculator, US engine and existing SEO URLs is intentionally passive (not modified).

## Delivery
- [ ] Required Gate green (frontend tests/typecheck/build).
- [ ] Chrome mobile acceptance green if triggered.
- [ ] No shadow UI, no migration, no analytics changes, no extra Vercel deployments.
- [ ] PR squash merge protected branch only at green.
- [ ] Update Notion and verify merged source on main.

## Next
**CALC-INT4.4B — In-Place Calculator → Distinta UX (IT pilot)**. Wire existing `onAddToDistinta` only on the Italian public calculator page, lazily mount compact inline bill below the result, synchronize new state to same-tab session and preserve legacy `/distinta` for compatibility. Do not prematurely connect the international copy-oriented builder or private RFQ actions.
