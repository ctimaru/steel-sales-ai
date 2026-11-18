# NET-PRO-PRODUCERS1.AUTO1.B3.A — Licensed catalogue source-row verification

## Contract
**Scope:** CSV supplied by a producer and independently licensed under B2. B3 verifies the presence of a complete `standard + grade + shape + exact_dimensions_mm` tuple in one logical CSV row, with the same document SHA, company, catalogue, edition, first-party URL and source locator. The only output is **source_verified**: this does NOT prove factory-specific capability, current stock, lead time, price or regulatory certification.

**Never:** infer an exact SKU from a dimensional range, join values across rows/files, auto-promote legacy `link_only` links to active grants, download third-party PDFs, expose verified rows to Free/PRO/browser, or auto-send RFQs.

## Trusted entry point
`verify_authorised_csv(db, manifest, csv_bytes, now=...)` in `app.net_pro_producers_catalog_b3` is a privileged worker-only call. The `db` must be a dedicated service-role connection sourced from server secrets. The worker:
1. Fetches a current B2 grant **from a trusted DB RPC**, not the catalogue manifest.
2. Checks document bytes SHA256, scope, expiry, revocation, producer identity and first-party source.
3. Parses candidates and re-checks each **original CSV logical row** (blank fields and ranges are never filled in).
4. Stages only private `pending_verification` candidate rows via B2 batches <=50.
5. Calls the B3 service-only RPC for each batch to attest strict equality with B2's quarantined rows.
6. Returns separate counts for `source_verified`, `replayed`, `rejected_rows`, and `no_exact_source_rows`.

The SQL migration adds private `network_producer_catalog_verifications` and an append-only event ledger, with deny-all browser RLS and no direct service-role table access. Its RPC locks the exact grant, ensures current rights and company role, and rechecks all dimensions against the B2 candidate. B2 revocation atomically marks B3 evidence stale; expiry is checked on every B3 operation.

## Release protocol
1. P0 GitHub required worker tests, secret guard, full Supabase foundation/local strict rebuild and security review on **exact HEAD**.
2. Reconcile production migration history; protected merge. Install new migration only **once** (never in a draft PR), followed by privilege checks: `anon/authenticated` must NOT execute B3, `service_role` may execute RPC but not read private tables directly. Confirm trigger active.
3. Verify production table readback starts at 0 and unchanged B2 grants/candidates/claims. Do not alter Railway cron or frontend for B3.A.
4. First canary only after a **genuine first-party authorized CSV and independently verified B2 grant** exist. If no grant exists: report `0 eligible`, do not fabricate one or import a previously discovered PDF by assumption.
5. Canary checks: one valid same-row exact tuple; one incomplete/cross-row/ambiguous tuple; repeat; revoke in a transaction; check B3 stats fail closed and verified row becomes stale; confirm `published_claims=0`.
6. For subsequent B4, only show data through a separate audited tenant/entitlement-bound read model with live rights checks and per-claim source citations.

## B3.B — Not part of this PR
A later separately reviewed, bounded, sandboxed extractor may process PDF **only with specific documented extraction/derived-use permissions**, retaining a source page, table/row, edition and SHA. Never treat `rights_status=link_only` as an extraction licence. Verify PDF resource limits, embedded scripts/attachments, text extraction accuracy, layout ambiguity and cross-page boundaries before creating candidates.

## Observability
Metrics by batch: authorized documents, source rows inspected, full same-row candidates, rejected/incomplete, verified/replayed/stale, rights-expired/revoked, parser errors, and per-producer coverage. Counts of source_verified are documentary, not manufacturing claims.
