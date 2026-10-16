# CALC-INT4.4C — Commercial Rate Opt-In & Internal Target Boundary
16 October 2026 · IT pilot · frontend, buyer-only price in memory.

## Product behavior
The already-live EU weight calculator's **Prezzo rapido** still accepts last-edited `€/ton` or `€/m` and calculates the other unit using current theoretical kg/m, without storing prices or modifying the calculation engine. On the Italian inline-bill surface only, when the commercial value is valid and positive, a button **«Usa come target interno → scegli la riga»** is offered. Clicking it is *not* assignment: the user must then choose **«Associa target interno alla riga N»** beneath the calculator. A line accepts the candidate only if its kg/m matches the calculator source weight, allowing the three-decimal roundtrip tolerance of the original calculator→bill adapter. Cross-size accidental assignment is rejected.

After explicit opt-in, the selected line displays **private buyer target €/t, €/m and estimated value for its quantity**, using the existing `calculateBuyerDistintaLine` pricing/total model. Users can override using either rate unit with a per-line editor; the converted rate uses that line's kg/m, not another dimension. Each line can remove its target, and removing a line prunes its target. Explicit duplication does not duplicate prices.

## Critical security and storage decision
The approved Notion product plan explicitly says buyer targets are saved on the backend **only after deliberate authenticated creation of the private bill/RFQ**. Thus 4.4C keeps all buyer targets in component-local React state only; **nothing new goes into `sss:inline-distinta:v1` or any other storage.** They are intentionally lost on refresh, logout, navigation or unmount. Existing technical bill rows (no prices) still survive the 24h tab-local session. The UI warns of this. Future 4.4D will introduce the authorized server snapshot handoff with opt-in and tenant protection.

Public **Copia distinta** remains a *technical, price-redacted* copy; it always uses the 4.4A `BuyerDistintaDraftLine` rows whose `targetEurT` stays blank. No prices in URLs, search metadata, cookies, clipboard, analytics, public network, supplier email, marketplace, or backend during 4.4C. Commercial display values aren't supplier quotes. No API calls, migrations, RFQ creation or supplier dispatch.

## Code
- `apps/web/lib/calculator-inline-buyer-target.ts`: pure canonical rate capture, source-kg/m weight match, per-line assign/edit/delete/prune, buyer target display computed by existing Buyer Distinta engine; no session/network access.
- `apps/web/components/calculator-commercial-pricing.tsx`: optional Italian opt-in button (the default 5-language calculator remains identical with no callback).
- `apps/web/components/public-tube-weight-calculator.tsx`: optional callback forwarded to pricing only.
- `apps/web/components/calculator-inline-distinta-experience.tsx`: two explicit actions, pending candidate, per-line target display/modify/remove, private in-memory map; technical clipboard/session unchanged.
- `apps/web/tests/calc-int4-4c-private-buyer-target.test.mjs`: actual pure calculation tests for €/ton→€/m and €/m→€/ton, weight-mismatch, negative/zero/huge rates, independent line edits, pruning and privacy invariants.
- `apps/web/tests/calc-int4-4c-chrome-private-target.mjs`: browser E2E IT at 390/1440px, no automatic target, two actions, per-line editing €/m, zero clipboard/session leakage and refresh erases target but retains bill.
- `.github/workflows/perf2-1-mobile-acceptance.yml`: Chrome test in existing production-build acceptance sequence.

## Acceptance
- [ ] Required P0 gate tests/typecheck/build green.
- [ ] Chrome touch, mobile, desktop and privacy acceptance green.
- [ ] No regression EU/USA or EN/DE/FR/ES, and original public technical references remain.
- [ ] Protected PR merge only with gate success and main synced.
- [ ] Vercel READY on `www.smartsteelsales.com` and read-only smoke; Notion updated.
- [ ] Private RFQ snapshot and target persistence deferred **specifically** to 4.4D; international rollout 4.4E.

## References
[CALC-INT4.4](https://app.notion.com/p/3fbf059cecb581528fcad191b369b266) · [4.4B](https://app.notion.com/p/3fbf059cecb581bebe00dc28f02cb226) · [RFQH governance](https://app.notion.com/p/3f1f059cecb58182b887e37f7a795f2f).
