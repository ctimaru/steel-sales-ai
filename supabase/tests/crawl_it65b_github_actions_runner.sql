-- CRAWL-IT6.5b acceptance: synthetic Supabase only; rollback every fixture.
begin;
create or replace function pg_temp.crawl65_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then raise exception 'CRAWL-IT6.5b %',message; end if;
end $$;
do $$
begin
 if has_function_privilege('anon','public.crawl_it65b_source_preflight()','EXECUTE')
    or has_function_privilege('authenticated','public.crawl_it65b_source_preflight()','EXECUTE')
    or has_function_privilege('anon','public.crawl_it65b_commit_wikidata_leads(jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.crawl_it65b_commit_wikidata_leads(jsonb)','EXECUTE') then
   raise exception 'Crawler RPC accidentally accessible outside service role';
 end if;
 if (select prosecdef from pg_proc where oid='public.crawl_it65b_commit_wikidata_leads(jsonb)'::regprocedure) then
   raise exception 'Crawler write RPC should be SECURITY INVOKER';
 end if;
end $$;

-- A normal company user must not be able to inspect source readiness.
set local role authenticated;
do $$
begin
  begin
    perform public.crawl_it65b_source_preflight();
    raise exception 'unexpected crawler permission';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

insert into auth.users(id,email,email_confirmed_at)
values ('00000000-0000-0000-0000-000000006561','crawler65b@example.test',now())
on conflict(id) do nothing;
update public.network_discovery_source_registry
set governance_status='approved', terms_status='allows_reuse',
    database_rights_status='low_risk',personal_data_policy='exclude_personal_data',
    review_note='Synthetic rights verified, safe 5-domain public CC0 query only',
    rights_evidence_url='https://www.wikidata.org/wiki/Wikidata:Licensing',
    reviewed_by='00000000-0000-0000-0000-000000006561',reviewed_at=now(),
    max_domains_per_run=5,minimum_interval_hours=168,
    enabled_for_discovery=true,last_discovered_at=null
where source_url='https://query.wikidata.org/sparql';
insert into public.network_discovery_domain_leads(
 source_id,country_code,domain,proposed_url,evidence_url,status)
select id,'IT','known.example','https://known.example/',
       'https://www.wikidata.org/wiki/Q12345','rejected'
from public.network_discovery_source_registry
where source_url='https://query.wikidata.org/sparql';

set local role service_role;
select public.crawl_it65b_source_preflight()::text as ready \gset
select public.crawl_it65b_commit_wikidata_leads(
  '[{"domain":"new-steel.example","website":"https://new-steel.example/","evidence":"https://www.wikidata.org/wiki/Q19999"},
    {"domain":"known.example","website":"https://known.example/","evidence":"https://www.wikidata.org/wiki/Q12345"}]'::jsonb
)::text as first_batch \gset
reset role;

select pg_temp.crawl65_assert(
 (:'ready'::jsonb->>'eligible')::boolean is true,
 'Approved synthetic source should be eligible');
select pg_temp.crawl65_assert(
 (:'first_batch'::jsonb->>'inserted')::integer=1
 and (:'first_batch'::jsonb->>'existing_leads')::integer=1
 and (:'first_batch'::jsonb->>'published')::integer=0,
 'Expected 1 new, 1 duplicate, 0 published');
select pg_temp.crawl65_assert(
 (select count(*) from public.network_discovery_domain_leads
   where domain='new-steel.example' and status='pending_review'
     and evidence_url='https://www.wikidata.org/wiki/Q19999')=1,
 'Missing single staging evidence');
select pg_temp.crawl65_assert(
 (select count(*) from public.network_companies where lower(website_domain)='new-steel.example')=0,
 'Crawler illegally published a company');

set local role service_role;
select public.crawl_it65b_source_preflight()::text as after_run \gset
do $$
begin
 begin
   perform public.crawl_it65b_commit_wikidata_leads(
     '[{"domain":"other-steel.example","website":"https://other-steel.example/","evidence":"https://www.wikidata.org/wiki/Q45555"}]'::jsonb);
   raise exception 'second batch unexpectedly passed weekly cooldown';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
select pg_temp.crawl65_assert(
 (:'after_run'::jsonb->>'reason')='not_due','Weekly source cooldown failed');

-- Move synthetic lease into previous week, then test stale duplicate and
-- fail-closed invalid metadata without corrupting the due interval.
update public.network_discovery_source_registry
set last_discovered_at=now()-interval '8 days'
where source_url='https://query.wikidata.org/sparql';

set local role service_role;
do $$
begin
 begin
   perform public.crawl_it65b_commit_wikidata_leads(
     '[{"domain":"evil.example","website":"https://evil.example/","evidence":"https://evil.example/?token=1"}]'::jsonb);
   raise exception 'untrusted provenance unexpectedly accepted';
 exception when invalid_parameter_value then null;
 end;
end $$;
select public.crawl_it65b_commit_wikidata_leads(
 '[{"domain":"new-steel.example","website":"https://new-steel.example/","evidence":"https://www.wikidata.org/wiki/Q19999"}]'::jsonb
)::text as replay \gset
reset role;
select pg_temp.crawl65_assert(
 (:'replay'::jsonb->>'inserted')::integer=0
 and (:'replay'::jsonb->>'existing_leads')::integer=1,
 'Idempotent replay must skip known lead');
select pg_temp.crawl65_assert(
 (select count(*) from public.network_discovery_domain_leads
  where domain='new-steel.example')=1,'Duplicate lead persisted');

rollback;
