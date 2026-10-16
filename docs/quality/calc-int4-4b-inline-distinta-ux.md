# CALC-INT4.4B — In-Place Calculator → Distinta UX (Italian pilot)
2026-10-16 · Italian public calculator only · PR acceptance pending.

## User-facing behavior
At `/knowledge/tubes` the existing EU calculator retains its full layout and commercial `€/ton ↔ €/m` converter. The existing `onAddToDistinta` callback now appends a validated item to a lightweight, expandable technical bill immediately below the calculator, without sending the user to `/distinta`, refreshing, or requiring sign-in. The top section displays article count/metres/tonnes, the line cards expose the current standard, shape, dimensions, quantity, theoretical kg/m and tonnes. Each row can be modified (quantity mode, quantity, bar length, grade, finish, notes), duplicated explicitly or removed. A full bill can be copied locally.

- New `apps/web/components/calculator-inline-distinta-experience.tsx`: owns React state/ref, hydration-safe same-tab restore, guarded `sessionStorage` persistence, collapsible preview, edit form, actions and feedback.
- `apps/web/components/calculator-region-switch.tsx`: optional injected EU callback/slot; **US calculator untouched**. Only Italian page passes opt-in.
- `apps/web/components/public-tube-weight-calculator.tsx`: separates embedded /distinta workbench mode from new public-inline mode so original public two-column layout, h1, copy/favorites and price converter all remain. Added accessible "Vedi la distinta · N righe" anchor after first add, changed inline feedback from "a fianco" to "sotto".
- `apps/web/app/(italian)/(public)/knowledge/tubes/page.tsx`: uses new wrapper; canonical, hreflang, article content and metadata unchanged.
- Pure math, validation, immutable event identifiers, 50-line max and 24h session expiry all reuse `apps/web/lib/calculator-inline-distinta.ts` from 4.4A and existing `buyer-distinta.ts`. No new API, database migration, tier gating, supplier dispatch or market listing.
- The old /distinta and international calculators and their legacy handoff queues remain unchanged; users can still reach them separately.

## Explicit boundaries
- The commercial rate remains ephemeral in the calculator. Every inline bill line has blank `targetEurT`. No rates/targets in session, URL, copy, analytics, supplier payload.
- **4.4B does not yet create an authenticated private RFQ campaign.** The UI explicitly explains that private creation inside this surface arrives in 4.4D. Avoid misleading CTAs or navigation that silently loses the inline draft.
- Session is tied to the current browser tab and validates each restored row; if blocked, work remains in React memory and user receives a warning to copy the bill before leaving.
- No regression to mobile EU/US toggle; hidden EU calculator persists its state across region switch.
- Large SEO landing remains server-rendered; bill is client state only. The user can add before/after selecting EN10210/EN10219 and quantity remains per row.

## Verification
- [ ] New source/UX contracts `apps/web/tests/calc-int4-4b-inline-distinta-ux.test.mjs` pass.
- [ ] Existing CALC-INT4, CALC-UX4, BD11 and RFQ handoff tests pass.
- [ ] Chrome **actual end-to-end** script `apps/web/tests/calc-int4-4b-chrome-inline-distinta.mjs`: 390/1440px, add two standards, edit 3→5 bars, duplicate/delete, copy, 24h session format/no target, reload restores 2 rows, no horizontal overflow.
- [ ] GitHub protected P0 Required Gate (frontend tests, typecheck, build) green.
- [ ] Mobile acceptance Chrome/Lighthouse green, including new script.
- [ ] Merge only CI green, normal Vercel production READY, anonymous live DOM/smoke verifies Italian-only inline bill and unaltered EN.
- [ ] Notion updated with PR/commit/evidence.

## Next
4.4C — price reference as *deliberate* internal buyer target only; no silent transfer of current calculator €/t/€/m. 4.4D — safe account handoff and RFQ draft create (no automatic dispatch). 4.4E — five-language EU parity.

## Project context
[Approved CALC-INT4.4](https://app.notion.com/p/3fbf059cecb581528fcad191b369b266) · [4.4A completed](https://app.notion.com/p/3fbf059cecb5817e8700d6aa310035b6) · [RFQH governance](https://app.notion.com/p/3f1f059cecb58182b887e37f7a795f2f).
