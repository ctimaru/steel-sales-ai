begin;
create or replace function pg_temp.assert_launch2(v boolean,msg text)
returns void language plpgsql as $$
begin if not coalesce(v,false) then raise exception 'NET-LAUNCH2 %',msg;end if;end $$;
select pg_temp.assert_launch2(
 not has_function_privilege('anon','public.netlaunch2_claim_daily()','EXECUTE')
 and not has_function_privilege('authenticated','public.netlaunch2_commit_daily(uuid,jsonb,jsonb)','EXECUTE')
 and has_function_privilege('service_role','public.netlaunch2_commit_daily(uuid,jsonb,jsonb)','EXECUTE'),
 'source-only service worker rights');
select pg_temp.assert_launch2(
 not has_table_privilege('anon','public.network_netlaunch2_runs','SELECT')
 and not has_table_privilege('authenticated','public.network_netlaunch2_cursors','SELECT'),
 'no client source-run leakage');
select pg_temp.assert_launch2(
 (select count(*) from public.network_netlaunch2_cursors)=4
 and (select count(*) from public.network_netlaunch2_runs)=0,
 'no manufactured candidate data');
select pg_temp.assert_launch2(
 (select pg_get_functiondef('public.netlaunch2_commit_daily(uuid,jsonb,jsonb)'::regprocedure) like '%values(qid,nm,dom,web,sector)%')
 and (select pg_get_functiondef('public.netlaunch2_commit_daily(uuid,jsonb,jsonb)'::regprocedure) like '%network_netfast3_suppressed_domains%'),
 'company QID not industry QID; honor takedowns');
set local role authenticated;
do $$
begin
 begin
  perform public.netlaunch2_claim_daily();
  raise exception 'Non-service caller unexpectedly allowed';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;