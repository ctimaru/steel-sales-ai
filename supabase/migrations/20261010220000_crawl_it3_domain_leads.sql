-- CRAWL-IT3: durable domain discovery staging; never publishes network companies.
create table if not exists public.network_discovery_domain_leads (
 id uuid primary key default gen_random_uuid(),
 source_id uuid not null references public.network_discovery_source_registry(id) on delete restrict,
 country_code text not null default 'IT' check (country_code='IT'),
 domain text not null check (char_length(domain) between 4 and 255),
 proposed_url text not null check (proposed_url like 'https://%'),
 status text not null default 'pending_review' check (status in ('pending_review','rejected','accepted')),
 evidence_url text not null,
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id),
 unique(source_id,domain)
);
create index if not exists network_discovery_domain_leads_review_idx on public.network_discovery_domain_leads(status,created_at);
alter table public.network_discovery_domain_leads enable row level security;
revoke all on public.network_discovery_domain_leads from public,anon,authenticated;
grant select,insert on public.network_discovery_domain_leads to service_role;

-- Worker atomic lease: single eligible source per due interval, opt-in env + reviewed source.
create or replace function public.crawl_it3_claim_due_source()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v public.network_discovery_source_registry%rowtype;
begin
 if auth.role() <> 'service_role' then
   raise exception 'worker role required' using errcode='42501';
 end if;
 select * into v from public.network_discovery_source_registry
 where enabled_for_discovery=true and governance_status='approved'
   and country_code='IT'
   and terms_status in ('allows_reuse','allows_limited_reuse')
   and database_rights_status in ('low_risk','licensed')
   and personal_data_policy in ('company_data_only','exclude_personal_data')
   and reviewed_at is not null and reviewed_by is not null
   and nullif(btrim(coalesce(rights_evidence_url,'')),'') is not null
   and (last_discovered_at is null or last_discovered_at <= now() - make_interval(hours=>minimum_interval_hours))
 order by coalesce(last_discovered_at,'epoch'::timestamptz), created_at
 for update skip locked limit 1;
 if not found then return null; end if;
 update public.network_discovery_source_registry
 set last_discovered_at=now(),updated_at=now() where id=v.id;
 return jsonb_build_object('id',v.id,'source_url',v.source_url,'max_domains_per_run',least(v.max_domains_per_run,20));
end; $$;
revoke all on function public.crawl_it3_claim_due_source() from public,anon,authenticated;
grant execute on function public.crawl_it3_claim_due_source() to service_role;
