# PROD-NEXT1.E3.B — Real database & Storage recovery evidence

**29 October 2026: source audit complete; recovery operator package implemented; actual real backup and isolated restore NOT YET EXECUTED. Pilot NO-GO.**

## Verified production inventory

- PostgreSQL 17, approximately 142 MB, Supabase Free plan.
- 3 Storage buckets: 2 private and 1 public. All 23 current objects are in the private buckets; metadata reports 1,271,853 bytes.
- The pilot database release gate is OFF. Zero active companies and zero analytics grants.
- Production and validation are distinct; neither is an acceptable destination for a recovery test containing real customer data.

Supabase's [backup guide](https://supabase.com/docs/guides/platform/backups) states that database backups do not include Storage object bytes, and Free projects should maintain independent offsite exports. Its [CLI backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) uses filtered roles/schema/data exports rather than raw pg_dump of managed system schemas.

## Trust boundaries and prerequisites

The first actual export is **operator-controlled**, not a GitHub Action or background job. Before running it:

- [ ] Founder authorizes handling of real production business data for recovery and assigns an independent reviewer.
- [ ] Dedicated private, encrypted local work volume with enough capacity, disk encryption verified by operator.
- [ ] Private external AWS S3 bucket with versioning Enabled, all four Public Access Block flags true, server-side encryption and proper least-privilege write policies. Retention and access logging defined.
- [ ] age public X25519 recipient and independently safeguarded private identity; successful synthetic decrypt rehearsed.
- [ ] Python 3.11+, psql 17, Supabase CLI (verify CLI help), Docker, age, AWS CLI installed.
- [ ] Supabase CLI explicitly linked to the approved production source; operator verifies supabase/.temp/project-ref before any dump. No schema migration, db push or repair.
- [ ] Runtime credentials are provisioned from a secrets vault, never pasted into chat, shell-history commands, GitHub issue, Notion or repository.
- [ ] Independent isolated database and **new empty Supabase Storage project** have been approved for recovery validation; provisioning can incur cost.

The operator supplies these environment variables via a secure secrets manager: E3B_SOURCE_REF, PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE, SUPABASE_ACCESS_TOKEN, E3B_SOURCE_SERVICE_ROLE_KEY, E3B_AGE_RECIPIENT, E3B_S3_BUCKET, E3B_SECURE_WORKDIR; plus two intentional acknowledgements E3B_OPERATOR_ACK=approved-encrypted-offsite-backup and E3B_ENCRYPTED_DISK_ACK=encrypted-scratch-confirmed.

Never enable shell xtrace; do not print credentials or raw Storage object paths.

## Real source backup — separate encrypted output

From the reviewed repository checkout on the approved operator machine, execute:

    python3 supabase/tools/e3b_production_backup.py

The tool first refuses GitHub CI, missing approvals, incorrect production project link, unencrypted scratch attestation, non-versioned/public S3 or a pilot that is no longer NO-GO. It uses Supabase CLI filtered exports for roles, schema, data, supplemental Auth/Storage data and migration provenance (not a raw managed-schema pg_dump). It inventories the current Storage metadata and downloads each file's **actual bytes via authenticated HTTPS**, verifies size and SHA-256, writes a sealed manifest, and encrypts DB exports and files together with age before uploading to private versioned S3.

**An export can only produce EXPORTED_NOT_RESTORED.** Save the ciphertext checksum, S3 object version, count, snapshot time and operator attestation in a restricted recovery register. Source paths, manifest, private bytes and keys remain inside the sealed archive or protected vault.

Known limits: DB and Storage reads are not one atomic transaction; file metadata is subject to concurrent updates; current objects do not prove coverage of prior deletions or historical versions. Confirm Supabase Auth/Storage managed-schema export coverage before claiming recoverability. Migration history is preserved as evidence, never automatically repaired.

## Independent DB and Storage restore

Get the encrypted archive from S3 into the operator's encrypted secure volume. The age identity remains with the independent custodian.

Offline verification without an import:

    python3 supabase/tools/e3b_isolated_restore.py --encrypted-archive /encrypted/archive.tar.age --age-identity /keys/offline-identity.txt

The verifier checks the manifest, seven expected DB export hashes, all private Storage object sizes and SHA-256. It never outputs private object names.

For the database, configure a dedicated EMPTY localhost PostgreSQL environment compatible with Supabase, PGHOST 127.0.0.1, a DB name prefixed e3b_restore_, and only then E3B_LOCAL_DB_RESTORE_ACK=dedicated-disposable-local-database with E3B_RESTORE_PGHOST/E3B_RESTORE_PGDATABASE/E3B_RESTORE_PGUSER/E3B_RESTORE_PGPASSWORD/E3B_RESTORE_PGPORT. Use the --restore-db flag. Managed schema/role/extension incompatibilities must produce a NO-GO and be corrected in a reviewed future iteration; do not suppress restore errors. Migration history exports remain sealed forensic evidence pending [SUPA-LEDGER1 #780](https://github.com/ctimaru/steel-sales-ai/issues/780).

For private Storage bytes, use a separately provisioned, fresh project that is NOT production or staging. Set E3B_ISOLATED_TARGET_REF, E3B_ISOLATED_TARGET_SERVICE_ROLE_KEY and E3B_ISOLATED_RESTORE_ACK=restore-to-empty-<target-ref>. Use --restore-storage. The script requires the destination to have zero buckets, restores bucket privacy flags, uploads each object without overwriting existing objects, re-downloads it and verifies its original SHA-256. Do not connect the isolated target to any live app, user email or commercial workflow.

The operator must manually verify a sample unauthorized read is denied, an authorized read succeeds, Auth/roles/tenant price isolation works, and the database plus actual file bytes are both recoverable. Measure real restore times and consistency/RPO/RTO; independently sign off the redacted evidence. No automatic GO is permitted.

## Evidence / completion criteria

| Gate | Present state |
|---|---|
| Actual encrypted offsite archive with S3 version ID and verified ciphertext hash | NOT RUN |
| Full database restore into an isolated environment, including Auth and RLS checks | NOT RUN |
| All current private Storage objects restored and hash-verified via Storage API | NOT RUN |
| Private ACL denial/allowance and snapshot consistency verified | NOT RUN |
| Measured RTO/RPO, retention, second reviewer and recovery decision recorded | NOT SIGNED |
| Legal, support, approved pilot cohort and dated founder GO | NO-GO |

Offline GitHub CI tests only the script's fail-closed behavior and synthetic archive verification. It carries **zero production credentials and zero customer content**, performs no export, and cannot satisfy real recovery acceptance.

Related: [E3 foundation](./prod-next1e3-recovery-and-pilot-authorization.md), [pilot #1024](https://github.com/ctimaru/steel-sales-ai/issues/1024), [migration #780](https://github.com/ctimaru/steel-sales-ai/issues/780), [Notion E](https://app.notion.com/p/407f059cecb581929401e5c899912dc2).
