-- NET-UX3A negative access, incomplete import and privacy smoke (rollback).
begin;
create or replace function pg_temp.netux3a_assert(ok boolean,msg text)
returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'NET-UX3A %',msg; end if; end $$;
select pg_temp.netux3a_assert(
 not has_function_privilege('anon','public.netux3a_activate_istat_import(uuid)','EXECUTE')
 and not has_function_privilege('authenticated','public.netux3a_activate_istat_import(uuid)','EXECUTE')
 and has_function_privilege('service_role','public.netux3a_activate_istat_import(uuid)','EXECUTE'),
 'activation privilege');
select pg_temp.netux3a_assert(
 not has_function_privilege('anon','public.netux3a_reconciliation_queue()','EXECUTE')
 and has_function_privilege('authenticated','public.netux3a_reconciliation_queue()','EXECUTE'),
 'queue role boundary');
select pg_temp.netux3a_assert(
 not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'netux3a_%' and p.prosecdef),
 'HP13 public invoker only');
set local role service_role;
select set_config('request.netux3a.testbatch',gen_random_uuid()::text,true);
insert into public.network_it_istat_import_batches
 (id,source_url,file_sha256,reference_date,expected_count)
 values (
 current_setting('request.netux3a.testbatch')::uuid,
 'https://www.istat.it/storage/codici-unita-amministrative/Elenco-comuni-italiani.xlsx',
 repeat('a',64),'2026-02-21',7894
 );
insert into public.network_it_istat_import_staging(
 batch_id,istat_code,municipality_name,municipality_normalized,province_code,
 province_name,region_code,region_name
) values(current_setting('request.netux3a.testbatch')::uuid,
 '015146','Milano','milano','MI','Milano','03','Lombardia');
do $$
declare rejected boolean:=false;
begin
 begin
  perform public.netux3a_activate_istat_import(current_setting('request.netux3a.testbatch')::uuid);
 exception when sqlstate '22023' then rejected:=true; end;
 if not rejected then raise exception 'Incomplete ISTAT batch was activated'; end if;
 if (select count(*) from public.network_it_municipalities where is_current)<>0 then
  raise exception 'Incomplete import mutated active reference'; end if;
end $$;
rollback;
