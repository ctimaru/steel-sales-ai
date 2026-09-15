\set ON_ERROR_STOP on

begin;

do $$
declare
  v_round_key text;
  v_round_id uuid;
  v_round_variant_id uuid;
  v_rect_id_a uuid;
  v_rect_id_b uuid;
  v_square_id_a uuid;
  v_square_id_b uuid;
  v_column_count integer;
begin
  v_round_key := public.canonical_tube_product_key(
    'round_tube',
    'P265GH',
    'EN 10224 L275',
    null,
    406.400,
    null,
    null,
    6.300,
    null
  );

  if v_round_key <> 'tube:v1|family=round_tube|grade=p265gh|standard=en10224l275|material=_|geom=od:406.4|t=6.3|process=_' then
    raise exception 'Unexpected canonical round-tube key: %', v_round_key;
  end if;

  v_round_id := public.canonical_tube_product_id(
    'ROUND TUBE',
    'p265 gh',
    'EN-10224 L275',
    null,
    406.4,
    null,
    null,
    6.3,
    null
  );

  v_round_variant_id := public.canonical_tube_product_id(
    'chs',
    'P265GH',
    'EN 10224 L275',
    null,
    406.4000,
    null,
    null,
    6.3000,
    null
  );

  if v_round_id is null or v_round_id <> v_round_variant_id then
    raise exception 'Equivalent round-tube spellings did not resolve to the same canonical ID';
  end if;

  v_rect_id_a := public.canonical_tube_product_id(
    'rectangular_tube',
    'S355J2H',
    'EN 10219',
    null,
    null,
    120,
    80,
    5,
    null
  );

  v_rect_id_b := public.canonical_tube_product_id(
    'rhs',
    's355j2h',
    'EN10219',
    null,
    null,
    80,
    120,
    5.0,
    null
  );

  if v_rect_id_a is null or v_rect_id_a <> v_rect_id_b then
    raise exception 'RHS orientation normalization failed';
  end if;

  v_square_id_a := public.canonical_tube_product_id(
    'square_tube',
    'S355J2H',
    'EN 10219',
    null,
    null,
    100,
    100,
    4,
    null
  );

  v_square_id_b := public.canonical_tube_product_id(
    'shs',
    'S355J2H',
    'EN10219',
    null,
    null,
    100.0,
    100.00,
    4.000,
    null
  );

  if v_square_id_a is null or v_square_id_a <> v_square_id_b then
    raise exception 'SHS alias normalization failed';
  end if;

  if public.canonical_tube_product_id(
    'round_tube', 'P265GH', 'EN 10224', null,
    null, null, null, 6.3, null
  ) is not null then
    raise exception 'Incomplete round geometry must not receive a canonical ID';
  end if;

  if public.canonical_tube_product_id(
    'rectangular_tube', 'S355J2H', 'EN 10219', null,
    null, 120, null, 5, null
  ) is not null then
    raise exception 'Incomplete rectangular geometry must not receive a canonical ID';
  end if;

  select count(*) into v_column_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('commercial_observations', 'products')
    and column_name in ('canonical_product_key', 'canonical_product_id');

  if v_column_count <> 4 then
    raise exception 'Expected four generated canonical product columns, found %', v_column_count;
  end if;
end;
$$;

-- The production archive baseline must be canonicalizable without changing
-- tenant boundaries. This query is a no-op on an empty local database.
do $$
declare
  v_invalid bigint;
begin
  select count(*) into v_invalid
  from public.commercial_observations
  where canonical_product_id is null
    and (
      (outer_diameter_mm is not null and thickness_mm is not null)
      or (width_mm is not null and height_mm is not null and thickness_mm is not null)
    );

  -- A missing canonical ID for a complete geometry is allowed only when the
  -- family cannot be inferred; parser-produced tube rows must be inferable.
  if exists (
    select 1
    from public.commercial_observations
    where canonical_product_id is null
      and product_type in ('round_tube', 'square_tube', 'rectangular_tube')
      and thickness_mm is not null
      and (
        outer_diameter_mm is not null
        or (width_mm is not null and height_mm is not null)
      )
  ) then
    raise exception 'Parser-produced complete tube geometry failed canonicalization';
  end if;
end;
$$;

rollback;
