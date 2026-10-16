-- NET-FAST3: batch ingestion from independently rights-cleared structured company datasets.
-- Import approval is NOT a website crawling permission and never enables the crawler.
create table public.network_netfast3_feed_grants(
 source_id uuid primary key references public.network_discovery_source_registry(id),
 license_url text not null check(license_url ~ '^https://[^[:space:]<>]+$'),
 permission_note text not null check(length(btrim(permission_note)) between 60 and 3000),
 approved_by uuid not null references auth.users(id),
 approved_at timestamptz not null default now(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 revoked_reason text
);
alter table public.network_netfast3_feed_grants enable row level security;
revoke all on public.network_netfast3_feed_grants from public,anon,authenticated;
grant select,insert,update on public.network_netfast3_feed_grants to service_role;
create policy netfast3_grants_deny_clients on public.network_netfast3_feed_grants
 as restrictive for all to anon,authenticated using(false) with check(false);

create table public.network_netfast3_entities(
 id uuid primary key default gen_random_uuid(),
 source_id uuid not null references public.network_discovery_source_registry(id),
 external_id text not null check(length(btrim(external_id)) between 2 and 160),
 domain text not null unique check(
  domain ~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$' and domain not like '%..%'),
 company_name text not null check(length(btrim(company_name)) between 3 and 180),
 role_hint text not null default 'unknown'
   check(role_hint in ('unknown','producer','trader_distributor','processor_service_provider','end_user')),
 country_code text not null default 'IT' check(country_code='IT'),
 created_at timestamptz not null default now(),
 removed_at timestamptz,
 removal_reason text,
 unique(source_id,external_id)
);
create index netfast3_entities_source_idx on public.network_netfast3_entities(source_id)
 where removed_at is null;
alter table public.network_netfast3_entities enable row level security;
revoke all on public.network_netfast3_entities from public,anon,authenticated;
grant select,insert,update on public.network_netfast3_entities to service_role;
create policy netfast3_entities_deny_clients on public.network_netfast3_entities
 as restrictive for all to anon,authenticated using(false) with check(false);

create table public.network_netfast3_import_batches(
 id uuid primary key default gen_random_uuid(),
 source_id uuid not null references public.network_discovery_source_registry(id),
 campaign text not null check(length(btrim(campaign)) between 3 and 80),
 operator_id uuid not null references auth.users(id),
 rows_received integer not null,
 rows_added integer not null,
 rows_duplicate integer not null,
 rows_skipped integer not null,
 created_at timestamptz not null default now(),
 check(rows_received between 1 and 1000),
 check(rows_added>=0 and rows_duplicate>=0 and rows_skipped>=0),
 check(rows_added+rows_duplicate+rows_skipped=rows_received)
);
alter table public.network_netfast3_import_batches enable row level security;
revoke all on public.network_netfast3_import_batches from public,anon,authenticated;
grant select,insert on public.network_netfast3_import_batches to service_role;
create policy netfast3_batches_deny_clients on public.network_netfast3_import_batches
 as restrictive for all to anon,authenticated using(false) with check(false);

-- Exact-domain suppression survives imports, including across different providers.
create table public.network_netfast3_suppressed_domains(
 domain text primary key check(domain ~ '^[a-z0-9][a-z0-9.-]*[.][a-z]{2,24}$'),
 reason text not null check(length(btrim(reason)) between 15 and 1000),
 suppressed_by uuid not null references auth.users(id),
 suppressed_at timestamptz not null default now()
);
alter table public.network_netfast3_suppressed_domains enable row level security;
revoke all on public.network_netfast3_suppressed_domains from public,anon,authenticated;
grant select,insert,update on public.network_netfast3_suppressed_domains to service_role;
create policy netfast3_suppressed_deny_clients on public.network_netfast3_suppressed_domains
 as restrictive for all to anon,authenticated using(false) with check(false);
