-- CRAWL-IT2: private governance of potential Italian discovery sources.
-- Registration is NOT permission to crawl; scheduled use is disabled until separately activated.
create table if not exists public.network_discovery_source_registry (
  id uuid primary key default gen_random_uuid(),
  source_name text not null check (char_length(btrim(source_name)) between 2 and 180),
  source_url text not null check (source_url ~* '^https://[^/[:space:]]+/?'),
  source_type text not null check (source_type in ('association','industry_directory','licensed_search','company_submission','curated_public_source')),
  country_code text not null default 'IT' check (country_code = 'IT'),
  governance_status text not null default 'unreviewed'
    check (governance_status in ('unreviewed','approved','restricted','blocked')),
  terms_status text not null default 'not_checked'
    check (terms_status in ('not_checked','allows_reuse','allows_limited_reuse','restricts_reuse','unknown')),
  database_rights_status text not null default 'not_assessed'
    check (database_rights_status in ('not_assessed','low_risk','licensed','restricted','unknown')),
  personal_data_policy text not null default 'not_assessed'
    check (personal_data_policy in ('not_assessed','company_data_only','exclude_personal_data','legal_review_required')),
  rights_evidence_url text null,
  review_note text null check (review_note is null or char_length(review_note) <= 4000),
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  enabled_for_discovery boolean not null default false,
  max_domains_per_run integer not null default 20 check (max_domains_per_run between 1 and 100),
  minimum_interval_hours integer not null default 168 check (minimum_interval_hours >= 24),
  last_discovered_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crawl_it2_source_not_enabled_without_governance check (
    not enabled_for_discovery or (
      governance_status='approved'
      and terms_status in ('allows_reuse','allows_limited_reuse')
      and database_rights_status in ('low_risk','licensed')
      and personal_data_policy in ('company_data_only','exclude_personal_data')
      and reviewed_by is not null and reviewed_at is not null
      and nullif(btrim(coalesce(review_note,'')),'') is not null
      and nullif(btrim(coalesce(rights_evidence_url,'')),'') is not null
    )
  )
);
create unique index if not exists network_discovery_source_registry_url_unique
  on public.network_discovery_source_registry (lower(source_url));
create index if not exists network_discovery_source_registry_governance_idx
  on public.network_discovery_source_registry(governance_status, enabled_for_discovery);
alter table public.network_discovery_source_registry enable row level security;
revoke all on public.network_discovery_source_registry from public, anon, authenticated;
grant select, insert, update on public.network_discovery_source_registry to service_role;
comment on table public.network_discovery_source_registry is
'CRAWL-IT2: private Italy-only rights-reviewed source catalog; not a scheduler. Do not enable without human legal/governance sign-off.';
