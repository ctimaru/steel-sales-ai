# SEC-P0 — Launch security and operational reliability

Observed: 25 October 2026 UTC. Source baseline: `a113e142a1bdd96dbae4855b095ce563fdbeb860`.
Tracking: [incident #866](https://github.com/ctimaru/steel-sales-ai/issues/866),
[Worker acceptance #865](https://github.com/ctimaru/steel-sales-ai/issues/865),
[semantic fallback #921](https://github.com/ctimaru/steel-sales-ai/issues/921),
[migration reconciliation #780](https://github.com/ctimaru/steel-sales-ai/issues/780).

**Status: OPEN. This checkpoint does not certify credential retirement, production
acceptance, complete incident containment or disaster recovery.**

## Exit criteria

- [ ] All affected credentials rotated, all consumers checked, old credentials
  rejected and retirement recorded without credential values.
- [ ] Worker database, private Storage and web integration pass positive and
  negative acceptance with the selected credentials and exact release commit.
- [ ] Tenant isolation verified for the intended production behavior; staging
  differences explicitly accounted for.
- [ ] Restore procedure exercised on an isolated target; database and actual
  Storage files restored; measured recovery evidence recorded.
- [ ] Critical findings resolved or explicitly classified with evidence; no
  unresolved critical launch blocker. Keep #866 open until all gates pass.

## Verified evidence

| Check | Observation | Limit |
| --- | --- | --- |
| Production Worker | Deployment `7a32c59b-3f0a-4be1-a1dd-1d286202024f`, code `90d86b687322d2c8e02eceaf74a8659c09db78d9`, online, 1/1 replicas; no warning/critical notifications or failures in the sampled 24 hours | Platform health is not authenticated database/Storage acceptance |
| Staging Worker | Deployment `b7abd3df-38d4-49ed-84b1-6593f46f27bb`, same code; no staged configuration in the inspected environment | Historical success is not acceptance of this patch |
| Direct HTTP | `/health` returns 200 in production and staging; `/v1/ops/data-lifecycle/health` without a token returns 401 in both | No privileged credentials used in these probes |
| Existing Worker A/B | [run 40099938911](https://github.com/ctimaru/steel-sales-ai/actions/runs/40099938911) passed GoTrue-derived actors, own/foreign RFQ checks, bad-token rejection and reserved-fixture cleanup | Direct Worker calls, not browser integration; historical commit |
| Existing browser A/B | #866 comments dated 24 October 15:18 and 15:20 UTC record user-driven A/B on isolated Vercel QA, then SQL fixture cleanup | Staging-specific search implementation; not full production acceptance |
| Vercel inventory | Production and dedicated QA branch have separate Worker-token variable records; no production `SUPABASE_SERVICE_ROLE_KEY` variable listed | Metadata proves neither token equality nor rotation |
| Production log sample | 21 October UTC: 3,755 edge 2xx, 80 4xx, 73 1xx, 15 3xx; Auth audit: 24 refresh and 12 revoke events | Session `token_revoked` events do **not** prove API-key retirement; counts do not exclude compromise |
| Recent API-key usage | 24 October 11:00 to 25 October 11:00 UTC: 14,042 successful requests classified as modern backend key | No key identifiers/values exported; requests cannot be attributed to this Worker from this aggregate |

The linked [JSON checkpoint](sec-p0-launch-evidence-20261025.json) contains
catalog fingerprints, privileges, advisor counts and migration identities only.
No customer rows, token values, archive contents or private historical SQL are included.

## Code correction prepared in this change

The previous key migration covered `repository.py` and `storage.py`, but several
other API consumers still required the legacy key or sent the new key as a Bearer
JWT. Revoking the old key before fixing these paths could break operations.

- Queries, market data, observability, lifecycle export/retention, tenant
  administration, evidence signing and bulk import now use the existing shared
  credential resolver and API-key header policy. Legacy fallback remains during
  the controlled transition; this is not permission to retain a compromised key.
- Evidence/bulk Storage and invitation Auth clients use their dedicated SDKs so
  `sb_secret_` is not inserted as an Authorization Bearer JWT. Direct dependencies
  are pinned to the tested `storage3` / `supabase-auth` 2.33.0 versions.
- Bulk-import and price-list-import guards reject absent/blank server token
  configuration with 503, and absent/wrong caller tokens with 401. Previously these
  two guards admitted requests when the server token was missing. The live Worker
  has a configured token; this defect alone is not evidence of unauthorized access.
- Regression tests intercept actual HTTP requests, exercise new-key-only operation,
  preserve legacy header behavior, and test negative endpoint authorization. They
  never send invitations, access customer records or contact a live database.

Local validation: **362 Worker tests passed**, including **27 new cases**. This
must remain distinct from required remote CI and exact-commit runtime acceptance.

## Credential and consumer inventory

| Credential/data | Verified consumers or locations | Required action before retirement |
| --- | --- | --- |
| Worker backend key | Production Railway has both `SUPABASE_SECRET_KEY` and legacy `SUPABASE_SERVICE_ROLE_KEY`; staging lists only the new variable | Deploy the compatibility correction; verify database, Storage, operations and Auth paths |
| Legacy Supabase key | Offline Railway service `smoke-test-bulk-import` lists it; five operator tools below and three repository workflows reference legacy variable names | Identify actual key provenance and use; migrate required consumers or retire unused ones; verify at provider, not from names alone |
| Worker internal token | Production Worker, Vercel server actions/routes, separate QA branch, staging Worker, GitHub staging acceptance, offline smoke service | Coordinate all active callers; verify new-token success and old-token failure after cutover |
| `HF_TOKEN` | Present by name in production Railway; embeddings consume it | Rotate at Hugging Face and update intended consumer; inspect usage/costs; no value read here |
| Recovery upload/stage tokens | `PA23010_UPLOAD_TOKEN`, `PA23016_STAGE_TOKEN` and related bootstrap identifiers in production Railway | Establish whether recovery bridges remain necessary; revoke/disable obsolete capabilities after preserving required audit evidence |
| Staged Base64 archive | `PA23016_STAGE_ARCHIVE_B64_PART_0` through `_5`, count/hash/manifest variables still present by name | Establish owner, retention and trusted backup; disposition is data handling, not key rotation; do not decode or publish contents |
| Supabase Edge Functions | `sa3-platform-staff-invite` uses the built-in legacy name; `rfqh4-offer-upload` supports modern keys with fallback | Inspect deployed secrets and behavior before disabling legacy API keys globally |

Remaining legacy-only **operator tools**, outside this API correction:
`netcompact4d_geo_scale.py`, `netcompact4b_geo_batch.py`,
`network_profile_persistence.py`, `network_profile_batch.py`,
`netdata1_company_audit.py`.

Repository workflows referencing the legacy slot:
`netcompact4b-geo-batch.yml`, `netux-data1-company-audit.yml`,
`netux3a-istat-official-reference.yml` (the last uses a separate named repository
secret). A legacy variable name does not prove its current value is the incident
key. Dedicated crawler keys must not be conflated with the Worker key.

The offline smoke service is a second production-project service, with no latest
deployment in the inspected metadata. Offline status does not retire its secrets.
All inventories above are names-only. Other service environments and secret stores
still require provider-side inventory before a global revocation claim.

## Migration and current-schema reconciliation

Observed ledger counts: **476 production / 452 staging / 439 repository files**.
These counts do not establish schema equivalence or a required repair.

The repository's existing `migration_sql_fingerprint_audit.py` was run against
fresh read-only remote SHA-256/byte-size snapshots, joining ledger statement arrays
with newline, and unchanged main migration files:

| Classification of repository files | Production | Staging |
| --- | ---: | ---: |
| Exact version and submitted SQL | 33 | 4 |
| Same submitted SQL, different version | 270 | 0 |
| Same name, differing submitted SQL bytes | 116 | 433 |
| Ambiguous duplicate name | 7 | 2 |
| Name present only in repository | 13 | 0 |
| Remote rows with names absent from repository | 45 | 13 |

Byte differences include formatting/statement serialization and are **not** a
semantic SQL diff. No automatic history repair is authorized by this classifier.
Obtain a fresh snapshot using this read-only query, then run the existing audit:

```sql
select version, name,
  encode(sha256(convert_to(array_to_string(statements, E'\n'), 'UTF8')), 'hex') as sha256,
  octet_length(array_to_string(statements, E'\n')) as bytes
from supabase_migrations.schema_migrations order by version;
```

Wrap rows in `{ "contract": "supa-ledger2-sql-sha256-v1", "migrations": [...] }`.
The audit command is `python supabase/tools/migration_sql_fingerprint_audit.py
--remote-hashes <metadata-snapshot.json> --report <comparison.json>`.

Specific findings requiring resolution:

1. Version **20261005130000** identifies
   `pl1_5_wc31_weight_update_join_fix` in production, but
   `pl1_5_padana_full_import_promotion` in staging. A version-only repair would be unsafe.
2. Staging contains two CI baseline entries and additional CRM/trust migrations
   absent from main by version. Their corresponding open PRs, differing names and
   application order need individual reconciliation.
3. Five of six sampled current RPC definitions and grants match byte-for-byte
   across environments. **`p1_global_structured_search_bridge_v2` differs:** production
   is a SQL wrapper over `p1_global_structured_search_bridge` enriching canonical
   product IDs; staging is a PL/pgSQL replacement that reads `buyer_rfq_campaigns`
   directly and combines those rows with legacy structured search. Both are
   SECURITY INVOKER, executable by service_role, denied to anon/authenticated.
   Staging A/B therefore does not certify production search behavior. Review filter,
   result-limit and product-navigation parity before proposing a unified migration.
4. The strict repository-only rebuild remains a known unresolved gate. The last
   documented first failure is `commercial_datasets` missing before the historical
   7 September predecessors. See [SUPA-LEDGER5F](../architecture/supa-ledger5f-historical-foundation-candidate.md).
   Assisted CI baselines and passing SQL tests do not prove a strict replay.
   The current environment could not access Docker; no fresh clean replay is claimed.

No migration, history rewrite, production DDL or password reset was performed.

## Security advisors

Production: 11 anon-executable and 76 authenticated-executable SECURITY DEFINER
function warnings; 101 RLS/no-policy informational findings; leaked-password
protection warning. Staging: 66 authenticated-executable warnings, 104 no-policy
informational findings and the password-protection warning.

These are review findings, not proof of exploitation. Classify function guards,
execute grants, source rights and intended deny-all tables before changing policy.
The known SEC1 public-function divergence remains a separate unresolved release gate.
Remediation references:
[anon functions](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
[authenticated functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
[RLS/no-policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
[password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Controlled execution order

1. Review this change and its required CI; exercise the exact candidate on dedicated
   staging, whose variable names do not include the legacy backend key. Test database
   queries, Storage upload/download/signing, lifecycle health and the optional
   semantic fallback independently of public `/health`.
2. Use reserved synthetic fixtures only. The previous manual QA deliberately left
   two staging Auth identities; the existing acceptance workflow expects an empty
   Auth directory. Do not blindly rerun its setup/cleanup or delete unrelated users.
3. Complete the consumer matrix, including offline smoke, operator scripts, CI,
   Edge Functions, provider tokens and obsolete recovery bridges. Configure modern
   credentials directly through the relevant secret stores; never paste values in
   chat, GitHub, Notion, logs or artifacts.
4. Perform a bounded, coordinated production cutover after staging acceptance.
   Check new-token success at every active caller, database/Storage operations and
   relevant tenant negatives. Record deployment IDs and key metadata, not values.
   Define the maintenance/rollback sequence before changing a single-token service.
5. Revoke the old credentials at their issuers and verify rejection; deleting a
   Railway variable is not revocation. Do not rotate the JWT signing secret blindly.
   Remove retired legacy references and expired recovery data after retention review.
   Rollback must use a trusted replacement key, not restore a compromised credential.
6. Resolve schema provenance and behavior differences on an isolated candidate;
   prove clean replay, then perform the database-plus-Storage restore rehearsal in
   [P0.10](../p0-10-data-lifecycle-and-disaster-recovery.md). Record backup availability,
   offsite Storage backup, measured RPO/RTO and row/object-manifest checks. No paid
   upgrade or successful restore is assumed from the historical document.
7. Reassess the function/password findings and incident window; record disposition
   and evidence. Only then mark the launch-security goal and incident complete.

The available Supabase connector exposes no backend-key creation/revocation API.
Railway OAuth supplies variable names, not their values; Vercel sensitive production
variables cannot be read back. These are operational limits, not missing user approval.
Provider-side secret operations or an approved secret-bearing execution path are
required to finish the remaining credential gates.
