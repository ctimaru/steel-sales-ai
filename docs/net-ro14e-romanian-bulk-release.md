# NET-RO1.4.E — Romania: single protected bulk publication

Status: **PREPARED, NOT APPLIED** (6 November 2026).

The founder requested one grouped publication effort rather than repeated 20-company mini-releases. This supersedes **execution** of NET-RO1.4.D WEB20; the WEB20 candidate list is included within the pinned 122-company NET-RO1.4.E cohort. The old WEB20 migration remains in Git history for auditability; **do not execute `network_ro14d_publish_wave20(true)`** if following this release.

## Evidence baseline (production SQL, read-only)

- 256 Romanian private research seeds. This is a research count, not 256 independently verified legal entities.
- 9 Romanian public canonical companies, already claimable.
- 122 nonduplicate, first-party-web private candidates with explicit `web_profile_review_pending` lane, allowed role, HTTPS source URL, unclaimed/unverified/not-published flags, no published canonical-domain or normalized-name match.
- The 122 consist of **8 proposed producers, 63 proposed traders and 51 proposed processors**. All have industrial source summaries; one processor's source refers to naval piping rather than explicitly saying "tubi".
- 125 remaining candidate records excluded from bulk publication: **123 in private review** (46 industrial-fit, 35 retail/B2B, 30 identity/group/brand, 9 secondary/stale sources, 3 other) plus **2 shared-domain collisions with Italian canonical records** (`tenaris.com` and `vanleeuwen.com`). These require individual reconciliation or correct group/subsidiary modelling; do not create a second company just to hit a quota.
- 0 suppressed domains, 0 prior publication crosswalk links among the pinned 122, 0 inactive proposed roles at baseline. The exact 122 domain/role pairs are pinned into the migration; source changes must cause a fail-closed review, not silent inclusion of unrelated new leads.

## Contents of this PR

- Existing NET-RO1.4.D profile UX/mobile claim path, local authenticated Chrome acceptance, protected migrations and twenty-company curated descriptions.
- New definition-only `supabase/migrations/20261106161500_net_ro14e_bulk_source_profiles.sql`, private publisher `private.network_ro14e_publish_bulk122(boolean)`. The migration **does not publish any company when applied**.
- New offline source-guard tests in `services/worker/tests/test_netro14e_bulk122_publication.py`.
- Neutral, source-attributed profiles, marked **published / unclaimed / unverified**. Proposed roles and relationships are not certifications; no contacts, RFQ invitations, owner-affiliation claims, or external emails are generated.
- Only source-summary-backed tubes/pipes family relationships are created; no claims about dimensions, EN grade, certifications, production capacity, stock, prices, or supplier response status.

## One release, two deliberate actions

1. Before merging: all required GitHub CI gates GREEN; authenticated production visit on 1440/390/320 for Network directory, company profile, single claim CTA and admin/viewer permissions; confirm no overflow, layout hydration errors, accidental claim or RFQ.
2. Respect one Vercel production deploy per day. As of November 6 a READY production deploy for RFQC1 already exists. Merge only in the next permitted protected deployment window.
3. Confirm migration ledger against existing `20261105151955` C pilot without replaying existing SQL. Apply the new migrations through the established protected migration mechanism. Do not manually edit `supabase_migrations`.
4. Check release baseline read-only and role/domain suppression again; if 9 public +122 eligible cannot be established, abort and reconcile:
   ```sql
   SELECT count(*) FROM public.network_companies
   WHERE country_code='RO' AND publication_status='published';
   SELECT count(*) FROM private.network_web_research_seeds WHERE country_code='RO';
   SELECT to_regprocedure('private.network_ro14e_publish_bulk122(boolean)');
   SELECT private.network_ro14e_publish_bulk122(false) AS preview;
   ```
   Preview must be `status=preview_only`, `eligible=122`, `would_publish=122`, `suppressed=0`, `requires_explicit_commit=true`. The function is private/service-role-only and snapshots pinned domain/role pairs.
5. **Only after human sign-off and exact preview:** perform one explicit SQL call under the authorized privileged connection:
   ```sql
   SELECT private.network_ro14e_publish_bulk122(true) AS result;
   ```
   It is transactional, rejects partial/duplicate/suppressed publication and returns `published_count=122` on success. The prior D20 publisher must NOT be used for this release.
6. Read back totals and evidence:
   ```sql
   SELECT count(*) AS public_ro FROM public.network_companies
   WHERE country_code='RO' AND publication_status='published';
   SELECT count(*) AS wave_rows
   FROM private.network_ro14c_publication_links
   WHERE publication_wave='NET-RO1.4.E-BULK122';
   SELECT count(*) AS claim_safe
   FROM private.network_ro14c_publication_links l
   JOIN public.network_companies c ON c.id=l.company_id
   WHERE l.publication_wave='NET-RO1.4.E-BULK122'
   AND c.country_code='RO' AND c.publication_status='published'
   AND c.claimed_status='unclaimed' AND c.verification_status='unverified';
   ```
   Expected: **131 public RO profiles, 122 bulk-wave rows, 122 claim-safe**, no automatically verified/claimed companies. Confirm actual appearance in the live Network, not only the SQL count.

## Continuing the rest of the research in one grouped review

The other 125 private research records are a single exception queue, **not 125 separate PRs**. Keep them private until role/identity, site, and industrial relevance are resolved from public sources; then use one follow-up protected batch with owner-claim enrichment. No paid official visura is mandatory for a minimal source-backed profile.

**Sign-off distinction:** local CI with synthetic Supabase users proves product behavior in isolation; it does **not** substitute for a live logged-in account on the production site.
