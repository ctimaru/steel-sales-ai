-- PP1 — Padana Publication Readiness acceptance.
begin;

create or replace function pg_temp.pp1_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PP1 assertion failed: %',message;
  end if;
end;
$$;

select pg_temp.pp1_assert(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='pl1_publication_readiness'
      and not p.prosecdef
  ),
  'publication readiness audit must exist as SECURITY INVOKER'
);

select pg_temp.pp1_assert(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='pl1_price_list_public_notices'
      and not p.prosecdef
  ),
  'public source-rule notices must exist as SECURITY INVOKER'
);

select pg_temp.pp1_assert(
  not has_function_privilege(
    'anon',
    'public.pl1_publication_readiness(uuid)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.pl1_publication_readiness(uuid)',
    'EXECUTE'
  ),
  'readiness audit must remain internal/authenticated'
);

select pg_temp.pp1_assert(
  has_function_privilege(
    'anon',
    'public.pl1_price_list_public_notices(uuid,boolean)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.pl1_price_list_public_notices(uuid,boolean)',
    'EXECUTE'
  ),
  'public-safe notices must be executable under RLS'
);

select pg_temp.pp1_assert(
  position(
    'publication_rights_not_approved'
    in pg_get_functiondef('public.pl1_publication_readiness(uuid)'::regprocedure)
  )>0
  and position(
    'delivery_term_conflict'
    in pg_get_functiondef('public.pl1_publication_readiness(uuid)'::regprocedure)
  )>0
  and position(
    'commercial_price_incomplete'
    in pg_get_functiondef('public.pl1_publication_readiness(uuid)'::regprocedure)
  )>0
  and position(
    'version_not_verified'
    in pg_get_functiondef('public.pl1_publication_readiness(uuid)'::regprocedure)
  )>0,
  'readiness audit must fail closed on source rights, source terms, price integrity and lifecycle state'
);

select pg_temp.pp1_assert(
  position(
    'partial_eur_t_coverage'
    in pg_get_functiondef('public.pl1_publication_readiness(uuid)'::regprocedure)
  )>0
  and position(
    'unresolved_standard'
    in pg_get_functiondef('public.pl1_publication_readiness(uuid)'::regprocedure)
  )>0
  and position(
    'special_shape_without_weight'
    in pg_get_functiondef('public.pl1_publication_readiness(uuid)'::regprocedure)
  )>0
  and position(
    'non_automated_source_rules'
    in pg_get_functiondef('public.pl1_publication_readiness(uuid)'::regprocedure)
  )>0,
  'bounded technical gaps must remain warnings instead of invented data'
);

set local role anon;

select pg_temp.pp1_assert(
  not exists (
    select 1
    from public.pl1_price_list_public_notices(
      '00000000-0000-0000-0000-000000000001'::uuid,
      true
    )
  ),
  'anonymous include_internal must not bypass publication governance'
);

reset role;
rollback;
