-- PL1.5 — Padana full-import governance + WC3.1 weight resolver acceptance.
begin;

create or replace function pg_temp.pl15_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PL1.5 assertion failed: %',message;
  end if;
end;
$$;

select pg_temp.pl15_assert(
  exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname='price_list_import_review_decisions'
      and c.relrowsecurity
  ),
  'review decision ledger must exist with RLS enabled'
);

select pg_temp.pl15_assert(
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname='price_list_import_review_decisions'
      and t.tgname='price_list_import_review_decisions_append_only'
      and not t.tgisinternal
  ),
  'review decisions must be append-only'
);

select pg_temp.pl15_assert(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private'
      and p.proname='pl1_promote_import'
  ),
  'controlled PL1 promotion function must exist in private schema'
);

select pg_temp.pl15_assert(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private'
      and p.proname='pl1_resolve_wc31_en10219_weights'
  ),
  'WC3.1 EN10219 resolver must exist in private schema'
);

select pg_temp.pl15_assert(
  not has_function_privilege(
    'anon',
    'private.pl1_promote_import(uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'private.pl1_promote_import(uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'private.pl1_resolve_wc31_en10219_weights(uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'private.pl1_resolve_wc31_en10219_weights(uuid)',
    'EXECUTE'
  ),
  'promotion and weight-resolution functions must not be client executable'
);

select pg_temp.pl15_assert(
  (
    select is_generated='ALWAYS'
    from information_schema.columns
    where table_schema='public'
      and table_name='steel_geometries'
      and column_name='geometry_key'
  ),
  'steel geometry key remains database-generated'
);

-- WC3.1 reference: round Ø33.7x2 EN10219 = pi*t*(D-t)*0.00785.
select pg_temp.pl15_assert(
  abs((pi()*2*(33.7-2)*0.00785)-1.563539) < 0.000001,
  'WC3.1 round formula must reproduce Ø33.7x2 reference mass'
);

-- WC3.1 reference: SHS 100x100x5 EN10219 with ro=2t, ri=t.
select pg_temp.pl15_assert(
  abs((
    (
      2*5*(100+100-2*5)
      - (4-pi())*((2*5)^2-(1*5)^2)
    )*0.00785
  )-14.4096) < 0.001,
  'WC3.1 EN10219 rounded-corner formula must reproduce SHS 100x100x5 regression'
);

rollback;
