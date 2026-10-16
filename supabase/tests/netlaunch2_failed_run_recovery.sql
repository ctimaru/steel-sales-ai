begin;
create or replace function pg_temp.assert_l2_recovery(ok boolean, msg text)
returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'NET-LAUNCH2 RECOVERY %',msg;end if;end $$;
select pg_temp.assert_l2_recovery(
 (select pg_get_functiondef('public.netlaunch2_commit_daily(uuid,jsonb,jsonb)'::regprocedure) like '%accepted=v_accepted%')
 and (select pg_get_functiondef('public.netlaunch2_commit_daily(uuid,jsonb,jsonb)'::regprocedure) like '%skipped=v_skipped%')
 and (select pg_get_functiondef('public.netlaunch2_claim_daily()'::regprocedure) like '%claimed_at < (now() -%'),
 'counter ambiguity fixed and failed run reclaim exists');
select pg_temp.assert_l2_recovery(
 not has_function_privilege('anon','public.netlaunch2_claim_daily()','EXECUTE')
 and not has_function_privilege('authenticated','public.netlaunch2_commit_daily(uuid,jsonb,jsonb)','EXECUTE'),
 'service-only recovery retained');
rollback;