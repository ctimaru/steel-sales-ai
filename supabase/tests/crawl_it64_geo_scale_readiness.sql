-- CRAWL-IT6.4 transaction-only security contract. Runs against ephemeral Supabase in CI.
begin;
do $$
declare v_oid oid;
begin
  v_oid := to_regprocedure('public.crawl_it64_geographic_scale_snapshot()');
  if v_oid is null then
    raise exception 'CRAWL-IT6.4 read-only readiness function missing';
  end if;

  if has_function_privilege('anon',v_oid,'EXECUTE') or
     exists (select 1 from pg_proc p, aclexplode(p.proacl) acl
       where p.oid=v_oid and acl.grantee=0 and acl.privilege_type='EXECUTE') then
    raise exception 'CRAWL-IT6.4 aggregate unexpectedly public';
  end if;

  if not has_function_privilege('authenticated',v_oid,'EXECUTE') then
    raise exception 'CRAWL-IT6.4 authenticated Platform staff cannot reach guarded RPC';
  end if;

  if not exists (
    select 1 from pg_proc where oid=v_oid and prosecdef and provolatile='s'
  ) then
    raise exception 'CRAWL-IT6.4 requires stable secured access to private aggregates';
  end if;

  if not exists (
    select 1 from pg_proc where oid=v_oid and pg_get_functiondef(oid) like
    '%private.require_platform_permission(''discovery.read'')%'
  ) then
    raise exception 'CRAWL-IT6.4 missing privileged server permission gate';
  end if;

  if (select count(*) from public.network_discovery_source_registry
    where enabled_for_discovery=true and governance_status='approved') <> 0 then
    raise notice 'Sources enabled in CI; this test does not toggle any source';
  end if;
end $$;
rollback;
