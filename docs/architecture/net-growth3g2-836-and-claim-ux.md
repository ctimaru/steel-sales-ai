# NET-GROWTH3.G.2 — 836 Sourced Network Profiles & Visible Owner Claim Journey

**5 Nov 2026. Actual production readback: 278 canonical published + 558 provisional profiles = 836 backing directory entries** (786 → 836, +50). Batch `NET-GROWTH3G-ONLINE-20261105-C` staged 50 trader/distributor companies from HTTPS first-party web references using already-deployed `public.netdensity3_seed_first_party`. A separate 50-item **ROLLBACK** returned 50 `needs_review`, 0 duplicates, 0 invalid, 0 published. A later distinct transaction **COMMIT** inserted the same count. Independent readback: 50 distinct core-target domains and 50/50 provisional mirror domains and role keys, all `trader_distributor`; no canonical company published.

Previous online-first batches: 50 industry A and 50 industry B. This tranche deliberately emphasizes steel tube distributors after the preceding 49:1 processor/producer imbalance. The companies listed remain **unclaimed, unverified, unconfirmed**. Product stock, price, standards, material grade, legal-group relationship or supply readiness cannot be inferred from public web entries. B2B suppliers cannot receive RFQ or be shown as verified until the independent onboarding gates permit it.

## Claim UX on the profile

The existing website currently handles `published` UUIDs through `/network/{id}/claim`, using an authenticated proof/organization context; a provisional UUID is **not a canonical company ID** and is not eligible for automatic transfer. For provisional records, the existing `NetworkActivationCta` safely opens `/register?company=...#company-check` to register and confirm corporate identity without passing the provisional UUID as a claim token.

This change places the existing CTA in a compact first-screen section on company profiles, with three visible steps:
1. **Rivendica azienda** — first register your company and demonstrate control; company matching and review are required.
2. **Arricchisci profilo** — after approval, the authorized owner can add real products, grades, dimensions and capacity.
3. **Verifica informazioni** — declarations remain separate from supplier verification; no automatic certified badge.

The CTA for published profiles remains "Rivendica il profilo" and routes to the real claim workflow. The provisional CTA now reads "Rivendica azienda" while clearly explaining the registration/claim gate, preserving existing fraud protection and avoiding any claim that a registration instantly grants ownership. It replaces a buried `<details>` accordion; no extra menus or decorative changes. No database schema/RLS migration, no automated matching, no claim approval, no live availability claims and no new emails.

## Signed-off release gates

- Frontend test suite, worker tests, QA visual 1440/390/320 px with authenticated free/pro session, existing claim path and provisional registration redirect.
- Merge order **#1149 → #1150 → G.2** with required protected gates; one planned Vercel deployment/day.
- Future distinct development **G.3 Claim Reconciliation & Enrichment Acceptance**: authenticated organization ownership proof, provisional-to-canonical reviewed association, permitted company profile updates, independent review of certificates/EN/ASTM claims, audit trail and opt-out. Do not call a provisional registration a completed claim.
- Owner-claimed status and verified supplier status stay independent in the AI layer.

No mandatory purchased corporate Visura for initial source-backed unclaimed profile acquisition. Only minimal originally worded factual summaries, first-party links, no personal contact enrichment or re-publication of protected catalog text/photos.

[Notion NET-GROWTH3.G](https://app.notion.com/p/40ff059cecb58184a284e22c2ffa3304).
