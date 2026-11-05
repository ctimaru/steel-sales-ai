# NET-RO1.4.C — Romania claimable public pilot (9 companies)

**Decision — 2026-11-05:** publish a *small* evidence-backed set of minimal industrial Network company profiles without making ONRC/Visura mandatory for public facts. Preserve claims and independent verification as separate, authenticated processes.

## Pilot cohort (9, all website-evidence-only)

| Domain | Type | Visible summary source |
| --- | --- | --- |
| [ARTROM](https://www.artrom.com/products/) | Tube producer | Seamless industrial steel tubes |
| [STEEL TUBES](https://steel-tubes.ro/despre-noi) | Distributor | Carbon and low-alloy steel pipes |
| [BAUROM](https://www.baurom.ro/portfolio-item/tevi-sudate-longitudinal-en-10219/) | Distributor | Longitudinal welded construction tubes |
| [RMC](https://www.laser-rmc.ro/debitare-laser-teava-rectangulara) | Tube processor | Tube/profile laser cutting |
| [Zsofia](https://zsofia.ro/ro/capabilitati/debitare-laser-3d/) | Tube processor | 3D laser profiling including tubes |
| [Metal Distribution](https://metaldistribution.ro/) | Distributor | Welded and seamless steel pipes |
| [BADUC](https://www.baduc.ro/metalurgice/4295-teava-profilata) | Distributor | Square and rectangular steel tubes |
| [Conbuz](https://conbuz.ro/teava-rectangulara/) | Distributor | Steel RHS product catalogue |
| [Plasma Rapid](https://www.plasmarapid.ro/debitare-tevi) | Tube processor | Laser, saw and plasma tube cutting |

These are **public company-business facts only**, paraphrased rather than copied. The public names derive from the existing research seed; they are not asserted to be a verified trade registry identity. No logos, personal contact details, third-party photographs, certificates, private inventory or price lists are imported. Supplier capacity, grades, standards and active availability are unknown unless independently substantiated later.

## Implementation

- `supabase/migrations/20261105151955_net_ro14c_claimable_web_pilot.sql`
  - Private, RLS-protected publication ledger `private.network_ro14c_publication_links`.
  - `private.network_ro14c_publish_pilot(p_commit boolean DEFAULT false)`: **preview-only by default**, protected on the private schema, `EXECUTE` revoked for `PUBLIC`, `anon`, and `authenticated`; service role and migration operator allowed.
  - Explicit nine-domain allowlist, only `RO`, `first_party_web`, neutral `web_profile_review_pending`, `unclaimed`, `web_sourced_unverified`, `not_published`.
  - Before publication: exact domain/normalized-name duplicate check against canonical company records, suppressions/opt-outs, exactly 9 eligible research records, active role and `tubes_pipes` taxonomy. Commit acquires transaction lock; all nine succeed atomically or roll back. Idempotent post-publication response.
  - Creates one canonical `public.network_companies` profile per site with `publication_status='published'`, `claimed_status='unclaimed'`, `verification_status='unverified'`; one `public_web` source assertion, one correct primary role and one conservative tubes/pipes family relationship per company.
  - Research seed remains `not_published` *as a private seed* even after canonical promotion; the explicit publication ledger is the crosswalk. No mutation of existing 117 source research rows.
- `apps/web/components/network-activation-cta.tsx` changes CTA copy to **Rivendica questa azienda**.
- Canonical `apps/web/app/(italian)/(workspace)/network/[id]/page.tsx` presents the existing claim action near the first-screen profile actions, not hidden under the old accordion. Company admin account and user/organization proof still use existing HP5/P3.6 logic, including domain ambiguity manual review.
- `services/worker/tests/test_netro14c_claimable_web_pilot.py` and updated HP5 test cover source allowlist, role distinctions, read-only preview, opt-out/dedup, restricted execution, UI and claim protections.

## Release sequence — do NOT skip

1. Read-only Supabase preflight: all nine exist, first-party, neutral source-review lane, no suppressed domain or canonical collision; we have verified this against current production.
2. Protected GitHub PR/CI P0 (local database rebuild, Worker and frontend) and FLOW1 acceptance, including 390/1440 px. Do not claim authenticated Vercel visual acceptance without a real browser run.
3. Merge into `main` only when protected checks green, respecting the project's deployment budget.
4. Apply the **definition-only** migration in Supabase. If Supabase automatically generates a different migration history timestamp, safely reconcile exact source bytes and then align the history entry to the GitHub version.
5. `SELECT private.network_ro14c_publish_pilot(false)` as a read-only preflight; it MUST show `would_publish=9`, `duplicate_canonical=0`, `suppressed=0`, `requires_explicit_commit=true`.
6. After go/no-go decision, `SELECT private.network_ro14c_publish_pilot(true)` once: private/service-only publishing, **atomic nine-company batch**.
7. Independent readback: 9 canonical RO companies, 9 separate claims unclaimed/unverified, 9 role assignments, 9 `tubes_pipes` relation rows, 9 `public_web` provenance assertions, 9 publication ledger rows and **117 unchanged private research seeds**. Check network results from a suitably authenticated user; never issue RFQs to unclaimed companies.
8. Test published URLs `/network/{uuid}` and claim page `/network/{uuid}/claim`, first screen CTA, source attribution, no verification badge, desktop/mobile and active account proof; do not promote from draft to verified automatically.

## Follow-up

**NET-RO1.4.C.2** should make it easier for qualified companies to claim and enrich dimensions, products, facilities, services and company documents with simple, compact inline UI. **NET-RO1.4.D**: expand from a small company-sourced pilot through incremental 20–50 public profiles per wave once quality, opt-outs, deduplication and claim UX are verified. Do not create a paid-visura prerequisite for company-business website facts.

### Production-migration version alignment (NET-RO1.4.D)

The live SQL was applied by Supabase under migration version `20261105151955` and its stored statement was checked byte-for-byte identical to the tracked SQL. The migration file is renamed from `20261105161000` to `20261105151955` in the protected NET-RO1.4.D PR with **exactly the same blob**, without touching production SQL or the migration ledger. Check local/other environment histories individually before `db push`.
