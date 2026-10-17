-- NET-DENS3: rollback-only bulk import regression.
begin;
create or replace function pg_temp.netdensity3_assert(ok boolean,msg text)
returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'NET-DENS3 %',msg;end if;end $$;
select pg_temp.netdensity3_assert(
 not has_function_privilege('anon','public.netdensity3_seed_first_party(jsonb,text)','EXECUTE')
 and not has_function_privilege('authenticated','public.netdensity3_seed_first_party(jsonb,text)','EXECUTE')
 and has_function_privilege('service_role','public.netdensity3_seed_first_party(jsonb,text)','EXECUTE'),
 'only service role can batch import');
select pg_temp.netdensity3_assert(
 not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='netdensity3_seed_first_party' and p.prosecdef),
 'bulk RPC must be invoker');
set local role authenticated;
do $$
begin
  perform public.netdensity3_seed_first_party('[]'::jsonb,'NETDENS3 synthetic');
  raise exception 'Authenticated role bypassed service-only source gate';
exception when insufficient_privilege then null;
end $$;
reset role;
set local role service_role;
do $$
declare r jsonb;
begin
 select public.netdensity3_seed_first_party(
   jsonb_build_array(
     jsonb_build_object('name','NETDENS3 Original Equipments','domain','netdens3-fixture.invalid',
       'evidence_url','https://netdens3-fixture.invalid/machines',
       'summary','Synthetic first-party evidence of equipment manufacturing only.',
       'segment','industrial_equipment','material_signal','finished_equipment_only','role','end_user'),
     jsonb_build_object('name','Bad web','domain','netdens3-malformed.invalid',
       'evidence_url','https://wrong-domain.invalid/irrelevant',
       'summary','Noncorresponding first party link for negative fixture.',
       'segment','industrial_equipment','material_signal','finished_equipment_only','role','end_user'),
     jsonb_build_object('name','NETDENS3 Original Equipments','domain','netdens3-fixture.invalid',
       'evidence_url','https://netdens3-fixture.invalid/machines',
       'summary','Synthetic first-party evidence of equipment manufacturing only.',
       'segment','industrial_equipment','material_signal','finished_equipment_only','role','end_user')),
    'NETDENS3 rollback') into r;
 perform pg_temp.netdensity3_assert(
   r->>'status'='completed' and (r->>'new_unconfirmed')::int=1
   and (r->>'duplicates')::int=1 and (r->>'invalid')::int=1
   and (r->>'published')::int=0,
   'row-level failure isolation and idempotency');
end $$;
reset role;
select pg_temp.netdensity3_assert(
 (select count(*) from public.network_core_target_leads where canonical_domain='netdens3-fixture.invalid')=1
 and not exists(select 1 from public.network_companies where website_domain='netdens3-fixture.invalid')
 and not exists(select 1 from public.network_company_discovery_candidates
   where canonical_domain='netdens3-fixture.invalid'),
 'only one provisional target, no canonical promotion');
rollback;
