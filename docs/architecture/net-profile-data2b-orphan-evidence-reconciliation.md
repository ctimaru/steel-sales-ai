# NET-PROFILE-DATA2.B — Safe orphan evidence reconciliation

**Status:** implementation proposal on an isolated branch. **Not executed in production.** Do not merge ahead of DATA2 PR #1297 or independently of the daily production release plan.

## Production read-only baseline — 13 November 2026

Direct aggregate readback, project `steel-sales-ai`:
- 585 published canonical companies, 310 pending source-evidence claims, 8 already accepted.
- 30 candidate claims already eligible for strict first-party DATA2 review.
- 280 claims still reference discovered IDs rather than canonical company IDs.
- 116 of these still have a discovery record; **do not re-link them** by this procedure.
- 164 have a discovered ID that no longer resolves. For **all 164**, the HTTPS evidence host matches the domain of exactly one active, published canonical company with HTTPS official website, nonempty legal name and fresh evidence. Of these 164: 159 products, 5 services; 164 different company IDs, 0 existing same-URL/field or same-value/field canonical duplicates.
- Domain uniqueness is an **association precondition**, not legal identity verification. All 164 still require the independent DATA2 official-source and AI content checks; this procedure never auto-accepts them.

## Implemented contract

The SQL migration installs `public.netprofile_data2_relink_orphans(integer,boolean,uuid)` and private append-only `private.netprofile_data2_relink_audit`.

- `service_role` only; `anon`/`authenticated` have no RPC execute or table access. Audit has RLS and an immutable trigger.
- Preview is the default: `p_apply=false`, bounded to 1–50 candidates.
- Explicit `p_apply=true` relinks only an eligible, missing-discovery source to an **unambiguous canonical company** under a fully matched official HTTPS domain; rechecks fresh source, published active entity, existing duplicate evidence, and field allowlist in the transaction.
- Each relink preserves the original discovered UUID and company target in a private audit row before clearing the stale discovered reference. An ambiguous domain or already-present discovered record does not enter the queue.
- `review_status='candidate'` remains unchanged. The main DATA2 verifier must independently fetch the live source, check legal name, claims, citation, and source hash before acceptance. Nothing updates claims, verification, stock, prices, networks or RFQs.
- Existing `network_company_enrichment` XOR check remains satisfied at every committed row.

## Release and operational gates

1. PR #1297 must first finish its own protected merge, DB migration, access checks and **first private batch of 5**. Do not fold this change into the already accepted DATA2 release.
2. Confirm DATA2.B P0 local Supabase rebuild and negative SQL checks: unauthenticated denial, default no-write, collision refusal, original-ID audit, idempotence, no status upgrade.
3. Apply migration only in a separately authorized release window. Verify function, table, RLS, grants, immutable trigger in the production catalog before running any mutations.
4. Run a read-only preview (maximum 5), compare count/target domains and ownership against the production baseline, then explicitly approve a small initial 5-row `p_apply=true` batch. Independently re-read source candidates, audit and unchanged publication/claim/stock counts.
5. Scale bounded batches up to 25–50 only if all checks remain green; a changed identity/duplicate must be blocked, not forced. Report actual reconciled and accepted numbers separately.
6. The other 116 discovered-linked claims remain part of the **separate discovery-to-canonical publication pipeline**, not this repair. One contains an `industry` field excluded from source AI acceptance; this is intentional.

**Do not use raw SQL bulk UPDATE in production** as a shortcut. Never equate unique domain with identity verification, never rewrite public companies or mark candidate claims accepted here.
