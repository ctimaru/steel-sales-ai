# PROD-NEXT1.E3 — Recovery & Pilot Authorization

**Current status: NO-GO for real companies, mail sends and pilot analytics.** Owner: Founder / Superadmin; independent reviewers: Legal and Recovery operator. This runbook is evidence tracking, not permission to enable a pilot.

## Verified baseline, 29 October 2026

| Evidence | Production | Validation |
|---|---|---|
| Pilot enabled | false | false |
| Legal, restore, support gates | false | false |
| Active companies / admissions / analytics opt-ins | 0 / 0 / 0 | 0 / 0 / 0 |
| Supabase Storage buckets | 3 | 2 |
| Storage metadata objects | 23 | 0 |

The E1 Vercel release is READY at main `01d56a32`. SQL file version `20261028190000` was applied in production with Supabase migration ledger version `20261029080001` and in validation as `20261029075859`. This mapping belongs to [SUPA-LEDGER1 #780](https://github.com/ctimaru/steel-sales-ai/issues/780). No automatic `db push` or `migration repair` while global drift remains.

## Level A — synthetic isolated recovery proof

`.github/workflows/prod-next1e3-recovery.yml` uses disposable local Supabase with CI-only baselines. The read-only `supabase/tests/prod_next1e3_live_no_go.sql` verifies the default gate, absence of active pilot participants, intact security triggers and privilege boundaries.

`supabase/tools/prod_next1e3_restore_drill.sh` must run only with `CI=true` and `E3_LOCAL_RESTORE_ACK=disposable-local-only`. Host and port are hardcoded to 127.0.0.1:54322. It backs up **only two synthetic fixture records** with `pg_dump`, restores them into a separate transient database with `pg_restore`, verifies count and checksum, cleans the scratch resources and checks one synthetic file byte-for-byte.

**Level A PASS is not production recovery evidence.** The byte copy is not a Supabase Storage API restore. No production credentials, customer content, automatic enrollment or downloadable backup artifacts are used.

## Level B — independently verified production DB and Storage restore

**Not yet performed.** Before starting, the recovery operator needs an authorized encrypted offsite destination, key custody, retention policy, suitable isolated restoration environment and explicit scope. The connected Supabase organization currently reports Free plan. [Supabase official backups](https://supabase.com/docs/guides/platform/backups) recommends logical off-site exports for Free, and confirms that database backups do **not** contain the actual Storage object bytes.

1. Capture an independently protected, encrypted **real** production database backup with a supported Supabase CLI/Postgres procedure. Document version compatibility, coverage of roles, Auth, nonpublic schemas, RLS, extensions and migrations, plus snapshot date and hashes. Never log tokens, URLs with credentials or DB contents.
2. Inventory all Storage buckets and obtain the **actual file bytes** through an authorized Storage API export, to a separate encrypted destination. Include a signed manifest of bucket/object names or redacted IDs, checksum, visibility and version state. DB `storage.objects` rows alone are insufficient.
3. Restore DB into a distinct permitted environment, then restore Storage objects into isolated buckets. Verify data integrity, selected private-object byte checksums, ACLs, JWT / RLS and organization boundaries. Never restore over production or copy sensitive data to public CI runners.
4. Record elapsed restore times, measured RPO/RTO, checksum results, any missing objects, exclusions, operator and second reviewer. Retain only non-sensitive evidence pointers in Notion and GitHub. Actual backups must remain in restricted offsite storage.
5. Only an independent reviewer may attest a real successful restore; a CI green status does not satisfy `restore_approved`.

## Formal authorization matrix

| Gate | Real evidence required | Status |
|---|---|---|
| DB disaster recovery | Encrypted backup, isolated restore, hashes, measured RPO/RTO | **MISSING** |
| Supabase Storage | Real object-byte export / import, integrity and ACL restore | **MISSING** |
| Migration history | Whole-project provenance reconciliation, #780 | **BLOCKED** |
| Real JWT / tenant isolation | Staging buyer/supplier/viewer/owner matrix; private prices, withdrawal | **PENDING** |
| Legal, privacy, terms | Named legal entity, lawful basis by purpose, pilot terms, DPA as applicable, retention / DSAR | **PENDING** |
| Support and incidents | Named operator, response channel, escalation and rollback procedure | **PENDING** |
| Founder GO | Approved named cohort, explicit dated decision after independent sign-offs | **NOT GIVEN** |

### Authorized pre-pilot test

In staging, use only dedicated test organizations and synthetic content. Test buyer private RFQ, supplier only-addressed offers, read-only viewer, owner audit and isolation of buyer prices; expired/invalid JWT; withdraw analytics and verify no events. A real production authenticated browser test remains separate from the CI-only proof. Never reclassify synthetic fixtures as customer traction.

### Emergency handling

Keep the release gate OFF. On incident, escalate to the named operator; use governed P5.6 suspension only when authorized, retain audit evidence and do not delete or export private business data into logs. UI rollback is separate from database recovery and does not undo schema changes. Use independently reviewed forward-only corrections for schema faults.

### Launch rule

Even if E3 CI is green, real pilot activation requires legal/privacy, recovery, support, founder decision and a **separately reviewed** server-side event collector. E1/E2 explicitly have `PILOT_ACTIVATION_TELEMETRY_ENABLED=false` and no five-event emitter. Turning on a DB field cannot create a legitimate analytics rollout.

Evidence sources: [GitHub pilot #1024](https://github.com/ctimaru/steel-sales-ai/issues/1024), [Notion PROD-NEXT1.E](https://app.notion.com/p/407f059cecb581929401e5c899912dc2), [Notion L27.5](https://app.notion.com/p/3eaf059cecb5810fb2a9cfc1adc97b83).
