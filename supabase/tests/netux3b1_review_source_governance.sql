-- NET-UX3B.1: source provenance and authenticated conflict reopen remain private.
begin;
create or replace function pg_temp.netux3b1_assert(ok boolean,msg text)
returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'NET-UX3B1 %',msg; end if; end $$;

select pg_temp.netux3b1_assert(
  (select relrowsecurity from pg_class where oid='public.network_it_geo_source_recheck_ledger'::regclass)
  and (select relrowsecurity from pg_class where oid='public.network_it_geo_conflict_reopen_ledger'::regclass),
  'provenance tables must have RLS'
);
select pg_temp.netux3b1_assert(
  (select count(*) from pg_policies where schemaname='public'
    and tablename='network_it_geo_source_recheck_ledger'
    and policyname='netux3b1_source_ledger_deny_clients')=1
  and (select count(*) from pg_policies where schemaname='public'
    and tablename='network_it_geo_conflict_reopen_ledger'
    and policyname='netux3b1_reopen_ledger_deny_clients')=1,
  'explicit denial policies should exist on both private ledgers'
);
select pg_temp.netux3b1_assert(
  not has_table_privilege('authenticated','public.network_it_geo_source_recheck_ledger','SELECT')
  and not has_table_privilege('anon','public.network_it_geo_conflict_reopen_ledger','SELECT'),
  'internal ledgers must not be readable by end users'
);
select pg_temp.netux3b1_assert(
  has_function_privilege('authenticated','public.netux3b1_conflicts_queue()','EXECUTE')
  and has_function_privilege('authenticated','public.netux3b1_reopen_conflict(uuid,text)','EXECUTE')
  and not has_function_privilege('anon','public.netux3b1_conflicts_queue()','EXECUTE')
  and not has_function_privilege('anon','public.netux3b1_reopen_conflict(uuid,text)','EXECUTE'),
  'authenticated-only review RPC boundary'
);
select pg_temp.netux3b1_assert(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'netux3b1_%' and p.prosecdef
  ),'HP13 public RPC definer forbidden'
);
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$
declare denied boolean:=false;
begin
  begin
    perform public.netux3b1_reopen_conflict(
      '00000000-0000-0000-0000-000000000001'::uuid,
      'Unauthorized identity must never reopen a conflict'
    );
  exception when sqlstate '42501' then denied:=true;
  end;
  if not denied then raise exception 'Unauthorized conflict reopening was not rejected'; end if;
end $$;
rollback;
