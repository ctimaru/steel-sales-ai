# TRUST-AUDIT1C.2G.3 — Superadmin Rights Decision Console

Date: 2026-10-23. **Owner-only RPCs applied to staging and production; frontend PR Draft and not deployed.**

## Scope
Provide a compact interface inside Platform → Network Trust to inspect company provenance, source URLs, status/holds, use-scoped decisions and prior append-only reviews. Neither viewing nor recording creates entitlements in AI/RAG, public Knowledge, crawler or paid Network; operational rights enforcement is a separate C2G.4 gate.

## Security
- Frontend route/server action require the unique Platform Superadmin and a verified Supabase user. Database RPC repeats the definitive role check in `private.is_platform_superadmin()` based on `platform_user_roles` rather than client-controlled profile metadata.
- Public RPCs are `SECURITY DEFINER`, explicit `search_path=''`. EXECUTE only for `authenticated`; direct `anon` and `service_role` calls are denied. The owner validation remains mandatory for authenticated users.
- The rights ledger remains private, RLS-enabled, append-only; service_role SELECT only; writes only via tightly constrained owner RPC. Proof URL/terms/reviewer/date are mandatory for allowed/limited, as is a future expiration and human reason. An unresolved hold denies grants.
- Per-evidence latest decision UUID is checked with advisory transaction lock to prevent stale updates; prior events are preserved, not mutated.
- Externally linked URLs are rendered only when HTTPS. No source file content or employment/price list data is printed into Git.
- The console selects at most 50 companies per page, 40 evidence records on the detail panel and 20 history entries; no unconstrained source dumping.
- A failed RPC does not claim success; the app shows a generic error and nothing is published.

## Acceptance results
- Staging: `authenticated` without owner role denied; `service_role` cannot execute the RPCs, grants checked.
- Production: simulated owner JWT-sub SQL context can read 34-company queue and append a synthetic BLOCK within transaction, rolled back; service_role and unauthenticated identity are rejected.
- Migration `20261023103723_trust_audit1c2g3_superadmin_rights_rpc` registered in both environments.
- SQL acceptance script in this PR should be executed in staging and production. Real signed JWT login/Chrome tests and UI visual QA are still required before release.

## Release/roadmap
Stacked branch depends on #876 → #874 → #873 → #872 → #870 → #869 → #867 → #861. Merge only after required checks and reconciliation of migrations applied in Supabase. Console has no live permissions after database deploy alone; Vercel requires separate merge/deployment. C2G.4 will enforce actual AI/paid Network use only after the rights evidence and policy are independently accepted.

No deletion of records, object storage, Git history, or legal evidentiary materials.
