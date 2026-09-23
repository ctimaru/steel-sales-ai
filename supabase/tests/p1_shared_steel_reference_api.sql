-- P1.15 / SK4 Shared Steel Knowledge read API + reference price acceptance.
-- Disposable CI database only.

begin;

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000015c1'::uuid, 'shared-api@p1-test.example');

create or replace function pg_temp.p115_api_assert(ok boolean, message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(ok, false) then
    raise exception 'P1.15 API assertion failed: %', message;
  end if;
end;
$$;

select pg_temp.p115_api_assert(
  has_function_privilege(
    'authenticated',
    'public.p1_shared_steel_standards(text,text,integer,integer)',
    'EXECUTE'
  ),
  'authenticated must execute shared standards API'
);
select pg_temp.p115_api_assert(
  has_function_privilege(
    'authenticated',
    'public.p1_shared_steel_dimensions(text,text,numeric,numeric,numeric,numeric,integer,integer)',
    'EXECUTE'
  ),
  'authenticated must execute shared dimensions API'
);
select pg_temp.p115_api_assert(
  has_function_privilege(
    'authenticated',
    'public.p1_shared_steel_effective_weight(uuid,uuid)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.p1_shared_steel_effective_dimensions(text,text,text,numeric,numeric,numeric,numeric,integer,integer)',
    'EXECUTE'
  ),
  'authenticated must execute SK4.5j effective-weight APIs'
);
select pg_temp.p115_api_assert(
  not has_function_privilege(
    'anon',
    'public.p1_shared_steel_standards(text,text,integer,integer)',
    'EXECUTE'
  ),
  'anon must not execute shared standards API'
);
select pg_temp.p115_api_assert(
  not has_function_privilege(
    'anon',
    'public.p1_shared_steel_dimensions(text,text,numeric,numeric,numeric,numeric,integer,integer)',
    'EXECUTE'
  ),
  'anon must not execute shared dimensions API'
);
select pg_temp.p115_api_assert(
  not has_function_privilege(
    'anon',
    'public.p1_shared_steel_effective_weight(uuid,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.p1_shared_steel_effective_dimensions(text,text,text,numeric,numeric,numeric,numeric,integer,integer)',
    'EXECUTE'
  ),
  'anon must not execute SK4.5j effective-weight APIs'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000015c1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select pg_temp.p115_api_assert(
  (
    select count(*) = 1
    from public.p1_shared_steel_standards('10224', 'active', 100, 0)
    where code = 'EN 10224'
      and source_class = 'official'
      and source_provider = 'UNI — Ente Italiano di Normazione'
      and product_families = array['round_tube']::text[]
  ),
  'standards API must return traceable EN 10224 metadata'
);

select pg_temp.p115_api_assert(
  (
    select count(*) = 3
    from public.p1_shared_steel_dimensions(
      'EN 10224', null, null, null, null, null, 250, 0
    )
  ),
  'dimensions API must return the three controlled manufacturer-range seed rows'
);

select pg_temp.p115_api_assert(
  (
    select
      theoretical_weight_kg_m = 62.2
      and base_price_eur_t = 850
      and reference_price_eur_m = 52.8700
      and length_m = 12
      and reference_price_eur_piece = 634.4400
      and price_semantic = 'canonical_reference_price'
      and provenance_class = 'published_canonical'
      and not_normative_complete
      and source_provider = 'Metalcondotte'
      and source_class = 'primary'
      and row_metadata ->> 'effective_weight_contract' = 'canonical_exact_scope'
      and row_metadata ->> 'effective_weight_status' = 'canonical_available'
    from public.p1_shared_steel_dimensions(
      'en10224', 'round_tube', 406.4, 6.3, 850, 12, 250, 0
    )
  ),
  '406.4x6.3 must expose the neutral canonical kg/m and deterministic canonical EUR reference pricing'
);

select pg_temp.p115_api_assert(
  (
    select count(*) > 0
    from public.p1_shared_steel_effective_dimensions(
      'EN 10216-2', 'P265GH', null, null, null, 1000, null, 250, 0
    )
    where effective_weight_status = 'canonical_available'
      and reference_price_eur_m = round(effective_weight_kg_m, 4)
      and price_semantic = 'canonical_reference_price'
      and grade_scope = 'grade_specific'
  ),
  'P265GH effective API must price from the exact grade-specific canonical scope'
);

select pg_temp.p115_api_assert(
  (
    select count(*) > 0
    from public.p1_shared_steel_effective_dimensions(
      'EN 10216-2', 'P235GH', null, null, null, 1000, 12, 250, 0
    )
    where effective_weight_status = 'canonical_missing'
      and effective_weight_kg_m is null
      and reference_price_eur_m is null
      and reference_price_eur_piece is null
      and price_semantic = 'unavailable_without_canonical'
  ),
  'P235GH effective API must surface canonical_missing instead of falling back'
);

select pg_temp.p115_api_assert(
  (
    select count(*) = 0
    from public.p1_shared_steel_dimensions(
      'EN 10216-2', null, null, null, 1000, 12, 250, 0
    )
    where theoretical_weight_kg_m is not null
       or reference_price_eur_m is not null
       or reference_price_eur_piece is not null
  ),
  'legacy no-grade API must not leak grade-specific or dimensional evidence into pricing'
);

select pg_temp.p115_api_assert(
  (
    select count(*) = 1
    from public.p1_shared_steel_dimensions(
      'EN 10224', 'round_tube', 323.9, 5.9, 1000, null, 250, 0
    )
    where reference_price_eur_m = 46.3000
      and reference_price_eur_piece is null
  ),
  'EUR/m must equal kg/m at EUR 1000/t and piece price must remain null without length'
);

reset role;

-- Validation must reject commercially nonsensical or unsupported input rather than returning misleading values.
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000015c1', true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  begin
    perform *
    from public.p1_shared_steel_dimensions(
      'EN 10224', null, null, null, -1, null, 250, 0
    );
    raise exception 'negative price unexpectedly accepted';
  exception
    when sqlstate '22023' then null;
  end;

  begin
    perform *
    from public.p1_shared_steel_dimensions(
      'EN 10224', 'plate', null, null, null, null, 250, 0
    );
    raise exception 'unsupported product family unexpectedly accepted';
  exception
    when sqlstate '22023' then null;
  end;
end;
$$;

rollback;
