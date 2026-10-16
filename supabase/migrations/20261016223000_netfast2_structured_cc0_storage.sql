-- NET-FAST2: CC0 structured industrial company feed. Not a website crawler.
-- Only service_role can insert. No canonical publication, tenant data or PII.
create table public.network_netfast2_structured_entities(
 id uuid primary key default gen_random_uuid(),
 source_entity_id text not null unique
   check(source_entity_id ~ '^Q[1-9][0-9]{0,13}$'),
 company_name text not null check(length(btrim(company_name)) between 3 and 180),
 domain text not null unique
   check(domain ~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$' and domain not like '%..%'),
 website_url text not null check(website_url like 'https://%'),
 industry_qid text not null check(industry_qid in ('Q2285982','Q1924906','Q1957908','Q190117')),
 source_url text generated always as ('https://www.wikidata.org/wiki/' || source_entity_id) stored,
 license_url text not null default 'https://www.wikidata.org/wiki/Wikidata:Licensing',
 country_code text not null default 'IT' check(country_code='IT'),
 discovered_at timestamptz not null default now(),
 removed_at timestamptz,
 removal_reason text
);
create index netfast2_entities_visible_idx on public.network_netfast2_structured_entities(industry_qid)
 where removed_at is null;
alter table public.network_netfast2_structured_entities enable row level security;
revoke all on public.network_netfast2_structured_entities from public,anon,authenticated;
grant select,insert,update on public.network_netfast2_structured_entities to service_role;
create policy netfast2_entities_deny_clients on public.network_netfast2_structured_entities
 as restrictive for all to anon,authenticated using(false) with check(false);

create table public.network_netfast2_batches (
 id uuid primary key default gen_random_uuid(),
 run_day date not null unique,
 industry_qid text not null check(industry_qid in ('Q2285982','Q1924906','Q1957908','Q190117')),
 status text not null default 'claimed' check(status in ('claimed','completed')),
 claimed_at timestamptz not null default now(),
 finished_at timestamptz,
 proposed integer not null default 0,
 inserted integer not null default 0,
 skipped integer not null default 0,
 constraint netfast2_counts check(proposed between 0 and 100 and inserted between 0 and proposed and skipped between 0 and proposed)
);
alter table public.network_netfast2_batches enable row level security;
revoke all on public.network_netfast2_batches from public,anon,authenticated;
grant select,insert,update on public.network_netfast2_batches to service_role;
create policy netfast2_batches_deny_clients on public.network_netfast2_batches
 as restrictive for all to anon,authenticated using(false) with check(false);

-- The exact Wikidata source was approved by Platform previously. Expanding its
-- bounded throughput is an explicit separate source policy; never changes RNA/Telemaco.
do $$
declare n integer;
begin
 update public.network_discovery_source_registry
 set max_domains_per_run=100,minimum_interval_hours=24,
 updated_at=now()
 where id='8425ec0f-c855-41d8-9bea-70a95fd8a6ba'::uuid
  and source_url='https://query.wikidata.org/sparql'
  and source_type='curated_public_source' and governance_status='approved'
  and enabled_for_discovery
  and terms_status='allows_reuse'
  and database_rights_status='low_risk'
  and personal_data_policy='exclude_personal_data'
  and rights_evidence_url='https://www.wikidata.org/wiki/Wikidata:Licensing'
  and reviewed_by is not null and reviewed_at is not null;
 get diagnostics n=row_count;
 if n<>1 then raise exception 'NET-FAST2: approved CC0 Wikidata source missing, leave disabled' using errcode='42501';end if;
end $$;
