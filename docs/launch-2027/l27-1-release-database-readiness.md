# L27.1 — Release Controls & Database Readiness

## Release controls

The repository-level GitHub ruleset **Protect main - Steel Sales AI** is active on the default branch.

Verified contract:

- pull request required for `main`;
- required status check context: `required`;
- strict required-status policy enabled;
- branch deletion blocked;
- non-fast-forward updates blocked;
- no bypass actors;
- current user cannot bypass the ruleset.

The `required` job in `.github/workflows/p0-required-gate.yml` remains the canonical release gate.

## Database readiness decision

The review deliberately does **not** turn every informational advisor finding into a schema change.

Production evidence at closure:

- `pg_stat_statements` enabled;
- critical product tables are still small;
- observed core read paths are low-latency at the current scale;
- Supabase performance advisor reports unindexed foreign keys and unused indexes as **INFO**, not launch-blocking errors;
- automatic bulk indexing is rejected because indexes add write and storage overhead and should follow demonstrated query patterns.

### Deterministic cleanup completed

Two indexes on `public.conversations(organization_id, external_thread_id)` had identical unique partial definitions:

- retained: `conversations_org_external_thread_uidx`;
- removed: `conversations_org_external_thread_uq`.

The retained index had materially more recorded scans and neither duplicate backed a constraint. The removed index had no dependent database objects.

## Postgres maintenance classification

Production currently runs PostgreSQL 17.6.

Before the next managed Postgres minor upgrade:

- `ltree` is not installed;
- `btree_gist` is not installed;
- repository search found no application use of `pgp_sym_encrypt`, `pgp_sym_decrypt`, `crypt`, or `gen_salt`;
- no application-schema custom operators with custom estimators were found.

A managed minor-version upgrade should still be scheduled through Supabase Infrastructure as a normal pre-launch maintenance action and followed by the HP18 production journey acceptance.

## Closure rule

L27.1 is considered closed when:

1. the ruleset evidence above is still active;
2. the duplicate-index migration is reproducible from a clean database;
3. L27.1 SQL acceptance is in the required gate;
4. the required gate is green;
5. production advisors show no new deterministic blocker introduced by the change.
