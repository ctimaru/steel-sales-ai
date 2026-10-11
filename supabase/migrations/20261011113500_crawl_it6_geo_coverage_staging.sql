-- CRAWL-IT6: evidence-only geographic coverage expansion staging.
-- No existing facility/company rows are changed by this migration.
create table if not exists public.network_it_geo_evidence_candidates (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.network_companies(id) on delete restrict,
 source_url text not null check (source_url ~* '^https://[^[:space:]]+$'),
 source_kind text not null check (source_kind in ('company_json_ld','company_official_site','official_business_registry','company_submitted')),
 source_company_domain text null,
 facility_name text null,
 address_line_1 text null,
 city text not null check (length(btrim(city)) between 2 and 120),
 province_code text null check (province_code is null or province_code ~ '^[A-Z]{2}$'),
 region text null,
 postal_code text null,
 istat_code text null references public.network_it_municipalities(istat_code),
 evidence_snippet text not null check (length(btrim(evidence_snippet)) between 12 and 1500),
 status text not null default 'pending_review'
   check (status in ('pending_review','approved_for_facility_review','rejected','conflict')),
 review_note text null,
 reviewed_by uuid null references auth.users(id),
 reviewed_at timestamptz null,
 created_at timestamptz not null default now(),
 unique(company_id,source_url,city,address_line_1)
);
create index if not exists network_it_geo_evidence_company_idx
 on public.network_it_geo_evidence_candidates(company_id,status);
alter table public.network_it_geo_evidence_candidates enable row level security;
revoke all on public.network_it_geo_evidence_candidates from public,anon,authenticated;
grant select,insert,update on public.network_it_geo_evidence_candidates to service_role;

-- A read-only operations snapshot; public profile identity and tenant permissions unaffected.
create or replace view public.network_it_geographic_coverage_v
with (security_invoker=true) as
select c.id company_id,c.legal_name,c.website_url,
 exists(select 1 from public.network_facilities f
        where f.company_id=c.id and f.archived_at is null
          and f.publication_status='published'
          and nullif(btrim(f.city),'') is not null) as has_published_city,
 exists(select 1 from public.network_it_geo_evidence_candidates e
        where e.company_id=c.id and e.status='pending_review') as has_pending_geo_evidence,
 (select count(*) from public.network_facilities f where f.company_id=c.id
  and f.archived_at is null and f.publication_status='published') as published_facility_count
from public.network_companies c
where c.archived_at is null and c.publication_status='published';
revoke all on public.network_it_geographic_coverage_v from public,anon,authenticated;
grant select on public.network_it_geographic_coverage_v to service_role;
comment on view public.network_it_geographic_coverage_v is
'Operator-only geographic coverage dashboard; published city is distinct from verified ISTAT province.';
