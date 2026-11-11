-- NET-PROFILE-UX1.B — CI-only structural and negative security tests.
begin;
create or replace function pg_temp.ux1b_ok(ok boolean,what text)
returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'NET-PROFILE-UX1.B: %',what; end if; end $$;

select pg_temp.ux1b_ok(
  (select relrowsecurity from pg_class where oid='private.netprofile_ux1b_inventory'::regclass),
  'inventory table has RLS');
select pg_temp.ux1b_ok(
  (select relrowsecurity from pg_class where oid='private.netprofile_ux1b_events'::regclass),
  'audit ledger has RLS');
select pg_temp.ux1b_ok(
  not has_table_privilege('anon','private.netprofile_ux1b_inventory','SELECT')
  and not has_table_privilege('authenticated','private.netprofile_ux1b_inventory','SELECT')
  and not has_table_privilege('authenticated','private.netprofile_ux1b_inventory','INSERT')
  and not has_table_privilege('authenticated','private.netprofile_ux1b_inventory','UPDATE'),
  'direct browser data access forbidden');
select pg_temp.ux1b_ok(
  not has_table_privilege('authenticated','private.netprofile_ux1b_events','SELECT'),
  'private audit ledger inaccessible');
select pg_temp.ux1b_ok(
  not has_function_privilege('anon','public.netprofile_ux1b_public(uuid,uuid)','EXECUTE')
  and not has_function_privilege('anon','public.netprofile_ux1b_manage(uuid,uuid)','EXECUTE')
  and not has_function_privilege('anon',
    'public.netprofile_ux1b_upsert(uuid,uuid,uuid,text,text,text,text,text,numeric,text,text,date,text)','EXECUTE'),
  'anonymous readers and writers denied');
select pg_temp.ux1b_ok(
  has_function_privilege('authenticated','public.netprofile_ux1b_public(uuid,uuid)','EXECUTE')
  and has_function_privilege('authenticated','public.netprofile_ux1b_manage(uuid,uuid)','EXECUTE'),
  'authenticated API grant established');
select pg_temp.ux1b_ok(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'netprofile_ux1b_%' and p.prosecdef
  ),'all browser-callable API functions remain SECURITY INVOKER');
select pg_temp.ux1b_ok(
  position('netux11_require_active_company' in
    pg_get_functiondef('private.netprofile_ux1b_public_impl(uuid,uuid)'::regprocedure))>0,
  'public stock reader requires active member');
select pg_temp.ux1b_ok(
  position('publication_status=''published''' in
    pg_get_functiondef('private.netprofile_ux1b_public_impl(uuid,uuid)'::regprocedure))>0,
  'public stock reader limits to published rows');
select pg_temp.ux1b_ok(
  position('cl.status=''approved''' in
    pg_get_functiondef('private.netprofile_ux1b_public_impl(uuid,uuid)'::regprocedure))>0,
  'revoking claim makes stock invisible');
select pg_temp.ux1b_ok(
  position('m7_user_can_manage_network_company' in
    pg_get_functiondef('private.netprofile_ux1b_can_manage(uuid,uuid)'::regprocedure))>0,
  'same approved claim and active admin guard as managed company profile');
select pg_temp.ux1b_ok(
  position('p_org' in
    pg_get_functiondef('private.netprofile_ux1b_can_manage(uuid,uuid)'::regprocedure))>0,
  'tenant organization is bound and checked');
select pg_temp.ux1b_ok(
  position('insert into private.netprofile_ux1b_events' in
    pg_get_functiondef('private.netprofile_ux1b_upsert_impl(uuid,uuid,uuid,text,text,text,text,text,numeric,text,text,date,text)'::regprocedure))>0,
  'all stock changes are written to private audit log');

-- The invoker wrapper must not bypass guards under an unauthenticated JWT.
set local role authenticated;
do $t$
begin
  begin
    perform public.netprofile_ux1b_public('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
    raise exception 'public stock unexpectedly accessible without authenticated company context';
  exception when sqlstate '42501' then null;
  end;
end;
$t$;
reset role;
rollback;
