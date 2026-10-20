# TRADER1D.2 — Superadmin Company Verification Console

**20 October 2026 · Implementation in feature branch · production activation still blocked by [#771](https://github.com/ctimaru/steel-sales-ai/issues/771).**

## Purpose
One-screen, desktop-first operator cockpit for **one active platform superadmin** to review EU steel trader research. This is a private evidence workflow, not a directory publisher or a legal verification service.

## UX and behavior
- Platform → Network → **Verifica commercianti UE** (`/platform/company-discovery/trader-verification`), owner-only; country filter (27 EU markets), 25 dossiers/page, holds and domain collisions prioritized.
- Select dossier in the left worklist. Right panel shows legal identity as sourced (or *not documented*), first-party role and product evidence, observed places, current research rights, six review statuses, decision history.
- Enter a distinct decision per dimension: legal_identity, trader_role, product_evidence, domain_reconciliation, reuse_rights, facility_source. Allowed outcomes: accepted / hold / rejected.
- **Accepted requires a specific HTTPS source.** Legal identity acceptance additionally requires legal name and legal country. Reuse-rights acceptance requires explicit permission/ license basis and scope; an official web page alone never grants reuse.
- Every decision has 20–800 character grounds. The server authenticates the owner again at submission, and the DB records `auth.uid()` (not a client-supplied reviewer).
- Server page fails closed when its data contract or migrations are unavailable: no pretend zero totals, synthetic candidates or approval controls.
- History is append-only with a 100-item bounded preview. Supersede a bad decision with a new review; never edit existing evidence.
- Clear contrast and focus on mobile and desktop; no generic green-on-green buttons.

## Security boundary
- Existing `private.netdata1eu_trader_research`, `private.netdata1eu_trader_facility_evidence`, `private.netdata1eu_trader_review_decisions` stay in unexposed schema with RLS and direct browser role GRANTs revoked.
- Two narrow public-schema `SECURITY DEFINER` RPCs are the authenticated **superadmin-only** gate, and check `public.platform_user_roles` with the current `auth.uid()` *inside SQL*, pinned empty search_path and revoked PUBLIC/anon EXECUTE.
- `trader1d2_superadmin_queue` limits 1–25/page and max offset 10,000; returns limited dossier fields and optional selected dossier history.
- `trader1d2_record_decision` appends only to existing review ledger. It cannot change source_rights, research_state, publish companies, facilities, Network, profile claims, connections or RFQ.
- No service secret introduced in Next.js, no client-side privileged key, no exposure of private schema to Supabase Data API, no HTTP proxy around its RLS.
- This is a narrowly reviewed authenticated privileged RPC surface; register in the HP13 allowlist and test direct SQL authorization.

## Scope / intentionally not shipped
- **No auto-verified labels**, promotion, data ingestion, company claim, location geocoding, mass scanning, supplier RFQ or marketplace.
- Review rights `accepted` in the immutable ledger does **not** update `source_rights` to `license_approved`; TRADER1D.1's independent editorial gate will still hold until documented change control and a separate approved promotion process.
- No production activation before prior six migrations + this seventh migration are approved and security reviewed.

## Release and verification checklist
- [ ] Supabase local rebuild / SQL security test `netdata1eu_trader1d2_superadmin_console.sql`, including non-owner deny.
- [ ] `apps/web` tests, typecheck, production build and HP13 guard pass.
- [ ] PR merged through protected P0 Required Gate.
- [ ] Vercel READY for that commit with real owner-only browser QA (keyboard, mobile, screen contrast).
- [ ] #771 authorized production rollout, seven migrations in chronological order; no bypass.
- [ ] Confirm in production 60 private research dossiers and 29 provisional location evidence records after approved rollout; compare actual readback, no synthetic counts.
- [ ] Confirm 0 unrequested public publications / 0 decision inserts before the first authenticated manual review; deny anon, normal registered user and delegated platform staff.
- [ ] Confirm superadmin can review selected dossier; reloading shows saved append-only history with correct reviewer UUID; rejection/hold never promote.
- [ ] Next microblock **TRADER1D.3 — Controlled Evidence-to-Publication Gate**, separately authorized, only after rights, legal identity and collision resolution.

Related: [TRADER1D.1 readiness](./netdata1eu-trader1d-review-readiness.md); [PR #778](https://github.com/ctimaru/steel-sales-ai/pull/778).
