# NET-RO1.4.C.1 + D — Production authenticated visual acceptance / next 20 Romanian profiles

**5 November 2026. Status:** production has 9 published, unclaimed/unverified RO profiles from NET-RO1.4.C plus 117 private website research seeds. Next **20** are validated as suitable business-description candidates, but **NOT YET PUBLISHED**.

## Acceptance report: live site and authenticated browsing

- **Vercel release and routing:** release `ffd4d3dabda8c2a70030dc00b20c2af3fc2a8098` is READY; `www.smartsteelsales.com` is aliased to that release. The existing claim CTA source code puts `Rivendica questa azienda` directly in the first profile viewport for an authenticated workspace admin. HP5/P3.6 request handler authenticates and checks organization administrator membership, corporate email uniqueness and proof approval.
- **GitHub acceptance:** prior PR #1152 passed P0, FLOW1, UI Contrast and PERF2.1 mobile CI, covering functionality and responsive regressions. These are **NOT proof of manual production-screen visual acceptance**.
- **Connected authenticated browser:** a live Chrome tab exists at `www.smartsteelsales.com/network?country=IT&advanced=1`, but the available Browser connector is *read-only* in Chat mode and cannot navigate or resize it to the Romanian profile URL. Opera connector is disconnected. TinyFish browser wallet currently has no available credit. Therefore **no authenticated screenshot for RO at 1440/390/320 px was taken**.
- **Gate outcome C.1: PARTIAL / HOLD VISUAL SIGNOFF.** Do not claim visual acceptance or that users have successfully submitted a live company claim. Completing the live 1440/390/320 browser checks requires an active session in a controllable browser; test at least producer, trader, processor, viewer/admin access and claim-request workflow with a real account.

### Manual authenticated visual checklist

- [ ] At 1440 px, `/network?country=RO` shows exactly 9 RO published companies (unless other waves have since shipped) and map/card counts based on actual data. No forced Italy fallback.
- [ ] At 390 px, search and country filter, company name, role, source website, and `Rivendica questa azienda` are visible in the first useful screen with keyboard focus accessible.
- [ ] At 320 px, no horizontal overflow, no competing claim/connection buttons and no clipped names or links; check real page, not only CI screenshot.
- [ ] Open producer, distributor and processor sample profile URLs, verify displayed `Non verificato` and `non rivendicato`, and visible website link; source provenance `public_web` not "verified by platform".
- [ ] Authenticated workspace admin: claim CTA `/network/{id}/claim` opens existing HP5 flow. Domain affiliation, duplicate pending claim, approved claim and ownership proof remain guarded; do not approve or send outbound mail to a real company during synthetic QA.
- [ ] Non-admin viewers must not be able to issue or approve ownership claims; requests require active admin and affiliation verification.
- [ ] Confirm 9 canonical links + 117 unchanged private seeds via live SQL readback after final screen review.

## NET-RO1.4.D — 20 next profiles (source-based intake)

**Read-only live preflight: PASS (5 Nov 2026).** Chosen 20 private RO rows are unique domain candidates, `source_kind=first_party_web`, `review_lane=web_profile_review_pending`, `unclaimed`, `web_sourced_unverified`, `not_published`; zero canonical name/domain collisions against public Network, zero suppressed domains, zero already linked to the existing 9-profile pilot. Every proposed public business description paraphrases an actual company website; no personal contacts, copying product content, badges, certificates, stock or industrial capacity assertions.

| Role | Proposed 20 company website profiles |
| --- | --- |
| Producer (1) | [METINVEST TUBULAR IAȘI](https://iasi.metinvestholding.com/ro-ro/) |
| Trader/distributor (15) | [Țevi Romania](https://tevi-romania.ro/), [Metalcas](https://www.metalcas.ro/produse-otel-metalcas-gama-completa), [QCB](https://qcb.ro/produse/), [DITA Industrial](https://ditaindustrial.ro/despre-noi/), [Intact Eco](https://www.intacteco.ro/tevi-din-otel-instalatii-constructii/tevi-otel-rectangulare-si-patrate), [Alcon Ind](https://www.alconind.ro/produse/tevi), [Meta Cos](https://www.meta-cos.ro/categorie-produs/tevi-metalice/tevi-patrate-si-rectangulare/), [SCI Distribution](https://sci-distribution.ro/categorie-produs/tevi/teava-rectangulara/), [RETA COM](https://retacom.ro/categorie-produs/teava/teava-rectangulara/), [REMAT Brașov](https://rematbv.ro/produse-siderurgice), [UTCHIM Steel](https://www.utchimsteel.ro/?lang=en&page=company), [Metaltrading](https://metaltrading.ro/), [Primetal](https://primetal.ro/teava-constructii/teava-rotunda/), [Profilometal](https://profilometal.ro/), [DECCONS](https://www.deccons.ro/Profile-si-tevi-pentru-constructii) |
| Processing/service (4) | [SMP](https://smp-srl.ro/debitare-laser-tuburi-metalice/), [Technic Steel](https://technicsteel.ro/servicii/debitare-laser-teava-si-profile/), [NETVERS](https://www.netvers.ro/prelucrari-cnc/debitare-laser-profile-metalice/), [HABA Research](https://habaresearch.eu/debitare-laser-teava-profile) |

A website business statement supports a **provisional public company profile**, not an independent legal-entity certification or a verified supply capacity.

### Implementation on PR branch

- Curated manifest `services/worker/data/netro14d_web20_curated_20261105.json`, 20 distinct websites, Italian own-word summaries, proposed roles, individual source reference retained in original private seed.
- Definition-only SQL `supabase/migrations/20261105170500_net_ro14d_web20_claimable_publication.sql` provides **private service-only** `network_ro14d_publish_wave20(p_commit boolean DEFAULT false)`. No automatic publishing on migration. Existing `private.network_ro14c_publication_links` is reused for crosswalk and distinct publication-wave metadata, not a new parallel company identity. Guards: source, role, source lane, suppressed domains, canonical collision, rollback-on-any-error, transaction advisory lock, no automatic claim or verification.
- Worker regression test `services/worker/tests/test_netro14d_web20_publication.py`: 20 domain allowlist ×4, no duplicates, private preview default, 1/15/4 roles, source attribution and non-owner claim guards.

### Release gate / operational roadmap

1. Run protected P0, UI and FLOW1 / mobile gates; review source consistency and any company opt-out before proceeding.
2. **Close C.1 actual authenticated production visual signoff** on `/network?country=RO` and sample profiles at 1440/390/320. Do not mistake responsive CI for an account browser session.
3. Reconcile the **previous** Supabase migration history mismatch safely through a separately reviewed repair process: the definition SQL from `20261105161000` was installed and verified identical, while the live recorded version is `20261105151955`. Do not reapply the old migration; do not alter the ledger through ad-hoc SQL without authorization.
4. Merge protected in the approved one-deploy-per-day window; apply new SQL definition-only migration (with exact version handling), call `SELECT private.network_ro14d_publish_wave20(false)`; expect `eligible=20`, `suppressed=0`, `duplicate_canonical=0`.
5. Only after confirmed visual signoff and acceptable source state, execute `SELECT private.network_ro14d_publish_wave20(true)` once.
6. Readback: **29** total public canonical RO profiles if successful, **20** new exact role/product/assertion/link records, all unclaimed/unverified, **117** unchanged research seeds; no automated RFQs, mail or company owner contact.

**No paid visura required** for basic source-backed public profile descriptions. Advanced technical declarations, certificates and actual availability are owner-entered after the authenticated and approved claim.


## NET-RO1.4.C.1 UX correction — Claim visibility for new owners

A source audit found that `Rivendica questa azienda` on the published profile appeared only when the current user already had an administrator organization. That hid the claim entry for prospective new owners, even after an unclaimed profile was publicly discoverable.

The existing company-profile first-screen now prioritizes **one claim CTA above secondary Connect / website actions**:
- **Authenticated organization administrator**: `Rivendica questa azienda` links directly to `/network/{id}/claim` and reuses the server-side `requireWorkspaceAdmin`, ownership proof, duplicate-domain, claimant-role and superadmin approval process.
- **User without an administrator workspace**: the same claim label enters the established `/register?company={companyName}&return_to={canonicalClaimPath}#company-check` registration/company check. The existing `safeCommercialReturnTo` guard explicitly permits `/network/{uuid}/claim`, so the user retains the **original published company claim target** after registration instead of starting a detached company identity. Claim approval is never automatic.
- **Pending claim, already claimed, or approved claim**: no second redundant claim CTA is created for the same administrator. Existing pending and managed states remain governed separately.

This is a UI/accessibility funnel change, **not** permission escalation: no new RPC grants, no claim approval, no certificates, no unverified personal contact, and no automatic company ownership. It must pass frontend tests, UI contrast and mobile gates; it must also be visually inspected in production at 1440, 390 and 320 px **after the next approved deployment**. The real claim submission remains a distinct authenticated acceptance scenario.

**Release note:** adding this to PR #1155 keeps the company-claim entry consistent before growing the public RO directory from 9 to 29. It does not itself publish any of the 20 proposed companies. The known Supabase migration history mismatch remains an independent unresolved release blocker.
