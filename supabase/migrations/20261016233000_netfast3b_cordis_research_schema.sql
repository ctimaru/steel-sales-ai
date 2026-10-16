-- NET-FAST3B: CORDIS Horizon Europe organisations adapter. Candidate source registration is
-- unreviewed and NEVER a license grant or a permission to crawl company websites.
insert into public.network_discovery_source_registry
 (source_name,source_url,source_type,country_code,enabled_for_discovery,
  governance_status,terms_status,database_rights_status,personal_data_policy)
select 'CORDIS Horizon Europe — organisations (licensed dataset preflight)',
 'https://data.europa.eu/data/datasets/cordis-eu-research-projects-under-horizon-europe-2021-2027',
 'curated_public_source','IT',false,
 'unreviewed','not_checked','not_assessed','not_assessed'
where not exists (
 select 1 from public.network_discovery_source_registry
 where source_url='https://data.europa.eu/data/datasets/cordis-eu-research-projects-under-horizon-europe-2021-2027'
);

create table public.network_netfast3b_cordis_runs (
 id uuid primary key default gen_random_uuid(),
 source_id uuid not null references public.network_discovery_source_registry(id),
 release_month date not null,
 status text not null default 'running'
   check(status in ('running','completed','failed')),
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 scanned_count integer not null default 0 check(scanned_count between 0 and 30000),
 added_research integer not null default 0 check(added_research between 0 and 30000),
 added_preview integer not null default 0 check(added_preview between 0 and 30000),
 discarded integer not null default 0 check(discarded between 0 and 30000),
 unique(source_id,release_month)
);
alter table public.network_netfast3b_cordis_runs enable row level security;
revoke all on public.network_netfast3b_cordis_runs from public,anon,authenticated;
grant select,insert,update on public.network_netfast3b_cordis_runs to service_role;
create policy netfast3b_runs_deny_clients on public.network_netfast3b_cordis_runs
 as restrictive for all to anon,authenticated using(false) with check(false);

-- This is NOT Network Free: an organization record alone is not a steel company
-- nor evidence of an official corporate website.
create table public.network_netfast3b_cordis_research (
 id uuid primary key default gen_random_uuid(),
 source_id uuid not null references public.network_discovery_source_registry(id),
 cordis_organisation_id text not null check(cordis_organisation_id ~ '^[0-9]{2,20}$'),
 project_id text not null check(project_id ~ '^[0-9]{2,20}$'),
 company_name text not null check(length(btrim(company_name)) between 3 and 180),
 website_domain text check(website_domain is null or
  (website_domain ~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$' and website_domain not like '%..%')),
 status text not null default 'needs_official_website'
  check(status in ('needs_official_website','domain_available')),
 first_seen_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(source_id,cordis_organisation_id)
);
create index netfast3b_research_status_idx
 on public.network_netfast3b_cordis_research(status,first_seen_at);
alter table public.network_netfast3b_cordis_research enable row level security;
revoke all on public.network_netfast3b_cordis_research from public,anon,authenticated;
grant select,insert,update on public.network_netfast3b_cordis_research to service_role;
create policy netfast3b_research_deny_clients on public.network_netfast3b_cordis_research
 as restrictive for all to anon,authenticated using(false) with check(false);
