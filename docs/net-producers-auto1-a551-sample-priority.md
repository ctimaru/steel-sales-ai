# NET-PRO-PRODUCERS1 · AUTO1.A.5.5.1 — source-local audit sample prioritisation

Read-only baseline on Supabase production (17 November 2026) after the additive
A5.5 sampler was installed:

- 165 current first-level pages in the eligible pool.
- 21 include at least one persisted A3 attribute mention. Of those:
  14 pages have confirmed standard mentions, 4 pages have confirmed grade
  mentions, and **4 pages on 2 producers** have both types on the very same
  first-party URL with the exact same full source SHA.
- These are **separately confirmed attribute mentions only**: no evidence of
  standard×grade×shape×size in an unambiguous technical table row. There are
  still **zero exact manufacturing SKU candidates**.
- The original URL-hint prioritisation selected 8/8 technical-looking URLs
  but **zero** of these four source-local overlap pages.
- A read-only SQL dry-run of the new ranking selects **8 pages across 6
  hosts**, including **all four** source-local pages; maximum 2/host,
  all with valid 64-hex full page hashes.

## Change

The *same* `netproducers1_auto1a55_product_audit_sample` RPC returns the
identical contract and identical fields. Its priority order becomes:

1. First-party pages with independently **confirmed** standard **and**
   steel-grade mentions, both bound to the SAME company, URL and current
   source SHA. This is a hint to inspect for HTML tables, **not proof** of a
   combined production claim.
2. Existing technical-looking URL hints (fallback only).
3. Other existing eligible pages.

Existing service_role grants, company role, canonical publication status,
latest source SHA, 35-day freshness, 12-page total, 2/host, robots/HTTPS/DNS,
PDF link-only and source SHA-matched HTML audit all remain unchanged.

## Release and verification

- Separate additive/replacement function migration on `main`, after P0
  Required Gate and independent review. Do not rewrite A5.5 migration history.
- Apply once via Supabase migration tooling; read back migration version and
  both function ACLs (anon/authenticated FALSE; service_role TRUE).
- Repeat **read-only selection**: 8 pages, 6 hosts, 4 source-local overlap
  matches, no published SKU. Do NOT enumerate full URLs/SHAs in public logs.
- Railway patch for A5.5 Python code is already **STAGED** from #1412;
  A5.5.1 is SQL-only and needs **no extra Railway rebuild or cron changes**.
- Real HTML audit must later execute `--audit-a55 --sample 8` in an approved
  one-shot worker runtime. Do not claim SHA matches or page layout findings
  until it does; don't override one-deploy/day without explicit exception.

Tracking: issue #1410 and PR #1412. No product, stock or price publication.
