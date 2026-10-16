-- NET-UX3B: rollback-only import gate acceptance (no published locations).
begin;
create or replace function pg_temp.assert_netux3b(ok boolean,msg text)
returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'NETUX3B %',msg; end if; end $$;
select pg_temp.assert_netux3b(
  not has_function_privilege('anon','public.netux3b_operator_stage_geo(uuid,text,text,text,text)','EXECUTE')
  and not has_function_privilege('authenticated','public.netux3b_stage_screened_official_geo(uuid,uuid,text,text,text,text)','EXECUTE')
  and has_function_privilege('service_role','public.netux3b_stage_screened_official_geo(uuid,uuid,text,text,text,text)','EXECUTE'),
  'screening boundary');
select pg_temp.assert_netux3b(
  not exists(select 1 from pg_proc p join pg_namespace n on p.pronamespace=n.oid
             where n.nspname='public' and p.proname like 'netux3b_%' and p.prosecdef),
  'HP13 public invoker-only functions');
insert into public.network_it_municipalities(
 istat_code,municipality_name,municipality_normalized,province_code,province_name,
 region_code,region_name,reference_date,source_url,is_current)
values ('015146','Milano','milano','MI','Milano','03','Lombardia','2026-02-21',
 'https://www.istat.it/storage/codici-unita-amministrative/Elenco-comuni-italiani.xlsx',true)
on conflict(istat_code) do nothing;
insert into public.network_companies(id,legal_name,trading_name,country_code,
 website_url,website_domain,description,publication_status,claimed_status,verification_status)
values ('00000000-0000-4000-8000-000000008333','NETUX3B Rollback Company',null,'IT',
 'https://netux3b-acceptance.invalid/','netux3b-acceptance.invalid',
 'Transaction only acceptance company','published','unclaimed','unverified');
set local role service_role;
insert into public.network_it_geo_collection_batches(label,description)
values ('NETUX3B Acceptance','Official source rollback acceptance test');
do $$
declare v jsonb; v_batch uuid;
begin
 select id into v_batch from public.network_it_geo_collection_batches
 where label='NETUX3B Acceptance' limit 1;
 v:=public.netux3b_stage_screened_official_geo(
    v_batch,'00000000-0000-4000-8000-000000008333',
    'https://netux3b-acceptance.invalid/contatti','Milano','MI',
    'Sede societaria Milano (MI), Italia.'
 );
 if v->>'status'<>'pending_review' or v->>'istat_code'<>'015146'
 then raise exception 'ISTAT staging failed %',v; end if;
 if exists(select 1 from public.network_facilities
           where company_id='00000000-0000-4000-8000-000000008333')
 then raise exception 'Staging published a facility'; end if;
 v:=public.netux3b_stage_screened_official_geo(
    v_batch,'00000000-0000-4000-8000-000000008333',
    'https://netux3b-acceptance.invalid/contatti','Milano','MI',
    'Sede societaria Milano (MI), Italia.');
 if v->>'status'<>'already_staged'
 then raise exception 'Idempotency missing'; end if;
end $$;
rollback;
