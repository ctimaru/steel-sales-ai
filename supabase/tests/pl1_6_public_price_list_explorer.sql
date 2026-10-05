-- PL1.6 — public interactive price-list explorer read-model acceptance.
begin;

create or replace function pg_temp.pl16_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PL1.6 assertion failed: %',message;
  end if;
end;
$$;

select pg_temp.pl16_assert(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='pl1_price_list_catalog'
      and not p.prosecdef
  ),
  'catalog function must exist as SECURITY INVOKER'
);

select pg_temp.pl16_assert(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='pl1_price_list_explorer_version'
      and not p.prosecdef
  ),
  'single-version function must exist as SECURITY INVOKER'
);

select pg_temp.pl16_assert(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='pl1_price_list_explorer_items'
      and not p.prosecdef
  ),
  'item explorer function must exist as SECURITY INVOKER'
);

select pg_temp.pl16_assert(
  has_function_privilege('anon','public.pl1_price_list_catalog(boolean)','EXECUTE')
  and has_function_privilege('authenticated','public.pl1_price_list_catalog(boolean)','EXECUTE')
  and has_function_privilege('anon','public.pl1_price_list_explorer_version(uuid,boolean)','EXECUTE')
  and has_function_privilege('authenticated','public.pl1_price_list_explorer_version(uuid,boolean)','EXECUTE')
  and has_function_privilege('anon','public.pl1_price_list_explorer_items(uuid,boolean)','EXECUTE')
  and has_function_privilege('authenticated','public.pl1_price_list_explorer_items(uuid,boolean)','EXECUTE'),
  'anon/authenticated callers must be able to execute RLS-bound explorer functions'
);

select pg_temp.pl16_assert(
  exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname='price_list_versions'
      and c.relrowsecurity
  )
  and exists (
    select 1
    from pg_policies p
    where p.schemaname='public'
      and p.tablename='price_list_versions'
      and p.policyname='price_list_versions_authenticated_read'
      and p.qual like '%knowledge.read_drafts%'
  ),
  'internal preview must remain bounded by existing price-list RLS'
);

select pg_temp.pl16_assert(
  position(
    'price_per_t_ready'
    in pg_get_functiondef('public.pl1_price_list_explorer_items(uuid,boolean)'::regprocedure)
  ) > 0
  and position(
    'price_per_t_status'
    in pg_get_functiondef('public.pl1_price_list_explorer_items(uuid,boolean)'::regprocedure)
  ) > 0,
  'explorer items must expose bounded weight readiness'
);

select pg_temp.pl16_assert(
  position(
    'fixed_extra'
    in pg_get_functiondef('public.pl1_price_list_explorer_items(uuid,boolean)'::regprocedure)
  ) > 0
  and position(
    'base'
    in pg_get_functiondef('public.pl1_price_list_explorer_items(uuid,boolean)'::regprocedure)
  ) > 0,
  'explorer items must preserve Base and fixed Extra separately'
);

-- Production-style fail-closed behavior is inherited from underlying PL1 RLS.
set local role anon;
select pg_temp.pl16_assert(
  not exists (
    select 1
    from public.pl1_price_list_catalog(false)
    where is_internal_preview
  ),
  'anonymous catalogue must never expose internal-preview versions'
);
reset role;

rollback;
