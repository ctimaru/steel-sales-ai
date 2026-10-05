-- PL1.5A — residual weight closure and special-profile readiness acceptance.
begin;

create or replace function pg_temp.pl15a_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PL1.5A assertion failed: %',message;
  end if;
end;
$$;

select pg_temp.pl15a_assert(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private'
      and p.proname='pl1_close_residual_weight_links'
  ),
  'residual closure function must exist'
);

select pg_temp.pl15a_assert(
  not has_function_privilege(
    'anon',
    'private.pl1_close_residual_weight_links(uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'private.pl1_close_residual_weight_links(uuid)',
    'EXECUTE'
  ),
  'residual closure must remain service-only'
);

select pg_temp.pl15a_assert(
  exists (
    select 1
    from pg_views
    where schemaname='public'
      and viewname='price_list_item_pricing_readiness'
  ),
  'pricing readiness view must exist'
);

select pg_temp.pl15a_assert(
  coalesce((
    select 'security_invoker=true'=any(c.reloptions)
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname='price_list_item_pricing_readiness'
  ),false),
  'pricing readiness view must use security_invoker'
);

select pg_temp.pl15a_assert(
  has_table_privilege('anon','public.price_list_item_pricing_readiness','SELECT')
  and has_table_privilege('authenticated','public.price_list_item_pricing_readiness','SELECT'),
  'readiness surface must be readable by public/authenticated clients through underlying RLS'
);

select pg_temp.pl15a_assert(
  position('weight_standard_key' in pg_get_functiondef('private.pl1_close_residual_weight_links(uuid)'::regprocedure)) > 0
  and position('standard_code' in pg_get_functiondef('private.pl1_close_residual_weight_links(uuid)'::regprocedure)) > 0,
  'governed reference adoption must require explicit same-standard evidence'
);

select pg_temp.pl15a_assert(
  position('unsupported_special_shape' in pg_get_viewdef('public.price_list_item_pricing_readiness'::regclass,true)) > 0
  and position('unresolved_standard' in pg_get_viewdef('public.price_list_item_pricing_readiness'::regclass,true)) > 0
  and position('no_compatible_weight_reference' in pg_get_viewdef('public.price_list_item_pricing_readiness'::regclass,true)) > 0,
  'view must preserve bounded non-ready reasons instead of inventing kg/m'
);

rollback;
