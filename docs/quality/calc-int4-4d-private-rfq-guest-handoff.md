# CALC-INT4.4D — One-Page Private RFQ Creation & Guest Handoff
16 October 2026 · Implementation contract and acceptance record

## Objective
The Italian public calculator is now an actual conversion workflow:
**calculate → add to visible inline bill → optionally set buyer-only price reference → explicitly create private RFQ draft → open RFQ Hub**. No page detour to compose lines and no supplier dispatch or Marketplace publication.

## Reuse, not reinvention
- `apps/web/lib/calculator-inline-distinta.ts` from 4.4A remains the strict validation and session-only *technical* draft contract.
- `apps/web/lib/calculator-inline-buyer-target.ts` from 4.4C remains React-memory-only. Guest technical drafts never acquire prices in browser storage.
- `apps/web/lib/buyer-distinta-rfq-one-step.ts` from BD12 remains the idempotent guarded save→create orchestration. This block reuses the *existing* `saveBuyerDistinta` and `createBuyerRfqCampaign` server actions, which validate auth and owner/tenant through Supabase RPC/RLS.
- No new data table or migration; no duplicate RFQ backend.
- The actual server-side click-time eligibility check `inlinePrivateRfqAccess` consults `auth.getUser` and active `organization_memberships`; full server-side save/create authorization remains in existing server actions and RPC.

## UX and guest handoff
1. Anonymous visitors can add/edit/duplicate/copy rows without login. After there are lines, a **«Crea RFQ privata →»** button appears under the bill. Nothing is created by adding or editing lines.
2. Clicking requires a deliberate action. If no authenticated user or company membership, the page shows sign-in/registration or company activation links; **no server snapshot or RFQ is created**. A login link uses a sanitized, fixed `next=/knowledge/tubes` path. The technical draft survives in existing same-tab sessionStorage (24h); after authentication user returns to the same calculator, reviews recovered technical rows and clicks create again. No automatic creation.
3. *Buyer commercial targets are deliberately ephemeral while anonymous and disappear on navigation/reload.* The UI explicitly warns this; do not save guest pricing into localStorage/sessionStorage/cookies/URL/analytics as an unauthorized convenience.
4. Buyer targets are **not** included in the saved private snapshot by default. With targets present, user can separately check **«Includi i target buyer nel salvataggio aziendale privato»**. Only with this consent and successful authenticated server action is the chosen target stored privately. The builder validates resulting buyer lines, preserving all 4.4A invariants and all 4.4C pricing rules. No commercial data in copy.
5. On successful private snapshot save, the existing one-step helper creates a campaign draft; a confirmation leads to `/rfq-hub/:id`. This action has NO send/supplier selection/publish. To avoid duplicate snapshots after partial failure, the client caches a *same-page in-memory* snapshot ID associated with an immutable payload signature and retries creation from that ID only if rows/consent remain unchanged. The existing server campaign creation is owner-scoped idempotent.
6. The public calculator's canonical and hreflang URLs stay indexed; auth is checked only when the button is clicked, not during SEO page render. US and international calculators remain outside scope until 4.4E.

## Confidentiality hardening
Audit identified legacy direct supplier email `sendBuyerDistinta` reading `buyer_distinta_lines.target_eur_t/target_eur_m/target_total_eur` into the email formatter. This would expose 4.4D's newly persisted buyer targets on later email sends. To close that gap:
- New `supplierVisibleBuyerLines` always strips the three confidential fields for outbound supplier projection.
- `buildBuyerDistintaPlainText` and `buildBuyerDistintaHtml` accept an optional `includeBuyerTargets` flag, default `true` to preserve all buyer-side existing behavior.
- Direct supplier email explicitly passes `false` and redacted line data, removing **both prices and target column headings** from supplier plaintext and HTML. The supplier secure token portal also has a technical-only request line contract (no buyer target fields).
- All supplier messaging remains separate and requires another user action; 4.4D triggers none.

## Changed files
- `apps/web/lib/calculator-inline-private-rfq.ts`: pure canonical snapshot builder, explicit opt-in targets and signature.
- `apps/web/app/(italian)/(public)/knowledge/tubes/actions.ts`: read-only access probe (at click).
- `apps/web/components/calculator-inline-distinta-experience.tsx`: private RFQ CTA, access states, protected save→create and guest handoff.
- `apps/web/lib/buyer-distinta-supplier-redaction.ts`, `apps/web/lib/buyer-distinta.ts`, `apps/web/app/(italian)/(public)/distinta/actions.ts`: outbound supplier price isolation.
- `apps/web/tests/calc-int4-4d-private-rfq-guest-handoff.test.mjs`: pure builder consent/supplier privacy/retry constraints.
- `apps/web/tests/calc-int4-4d-chrome-guest-private-rfq.mjs`: guest UI, technical restore, target consent and no dispatch on local build (390/1440px).
- Chrome workflow retains prior 4.4B/4.4C and all older regression steps.

## Acceptance
- [ ] Required Gate: full test, TypeScript and build PASS
- [ ] Chrome mobile/desktop 4.4D guest + opt-in + retention PASS; older EU/USA/international flows PASS
- [ ] Protected PR merge to current main; no force, no skipping
- [ ] Vercel production READY / canonical self, Italian CTAs present
- [ ] Notion written with PR, gate, deployment proof
- [ ] Authenticated enterprise tenant E2E with live production data **not performed** unless separately authorized and test identities provided. Static/test evidence supports guarded server actions and mocked one-step outcomes; don't claim live RFQ created during CI.

## Next
CALC-INT4.4E — Five-Language EU Parity & US Isolation, preserving role-based RLS and target confidentiality.

[CALC-INT4.4 parent](https://app.notion.com/p/3fbf059cecb581528fcad191b369b266) · [RFQ Hub](https://app.notion.com/p/3f1f059cecb58182b887e37f7a795f2f).
