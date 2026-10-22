# NETG2 — Network Coverage Audit
**Snapshot:** 2026-10-10 · Supabase production project `steel-sales-ai` (`ecrafjdummcdfycznitx`). Read-only SQL, no data changes.

## Baseline
- 32 active non-archived Network companies; 30 published, 2 pending review.
- All 32 are in Italy. Roles are non-exclusive: 15 processor/service provider, 11 trader/distributor, 10 producer; 0 end-user assignments; 0 companies without a role.
- 28 unclaimed, 3 claimed, 1 pending claim-status; 0 verified.
- 30/32 have a website domain; 30/32 a description; 18/32 VAT; 0/32 registration number.
- Facilities: 3 across 3 companies: Lombardia 2, Emilia-Romagna 1. Geographic regional coverage is **unknown for the other 29**; country coverage is 32/32 Italy.
- 87 accepted source assertions (this is source governance, **not** company identity verification).
- Discovery candidates by review status: rejected 88, pending_review 43, published 20, duplicate_existing 10, enriched_existing 1 (162 total). All showed `governance_status=unreviewed`; requires evidence/governance audit before use.
- Claim records: 3 approved, 1 requested. Approved claims do not imply verified companies.
- No exact normalized-name duplicates by country; not a comprehensive identity-resolution audit.

## Risks / prioritization
1. **P0: Network buyer-side gap:** no end-user companies classified. Prioritize qualified Italian buyer/end-user discovery and invite campaigns only after source-law and data-governance checks.
2. **P0: Low territorial coverage:** only 3/32 have a structured facility; backfill locations from governed sources, without inferring locations from country or domain.
3. **P1: Identity completeness:** 14 companies lack VAT and all 32 lack registration IDs; distinguish legitimately unavailable fields from incomplete records.
4. **P1: Discovery backlog:** review 43 pending candidates for identity confidence, source licensing/robots/terms, personal-data flags, duplicates and publication gate.
5. **P1: Trust:** verification status is 0 verified. Never represent accepted source assertions or approved claims as company verification.

## Proposed next microblock
**NETG3 — Governed Network Expansion Plan:** coverage targets by role and region; reviewed candidate batches; buyer-side acquisition activation plan. Keep imports and publication behind existing approval gates.

## Reproducible read-only SQL
```sql
select count(*) total, count(*) filter(where archived_at is null) active,
  count(*) filter(where publication_status='published' and archived_at is null) published
from public.network_companies;
select r.canonical_key,count(distinct a.company_id) companies
from public.network_company_role_assignments a
join public.network_company_roles r on r.id=a.role_id
join public.network_companies c on c.id=a.company_id
where c.archived_at is null group by r.canonical_key order by companies desc;
select country_code,count(*) companies from public.network_companies
where archived_at is null group by country_code;
select region,count(distinct company_id) companies from public.network_facilities
where archived_at is null group by region;
select review_status,governance_status,count(*) candidates
from public.network_company_discovery_candidates group by 1,2;
```
