-- P1.15 / SK4.3c — EN 10217 discrete manufacturer-matrix sample acceptance.
-- Disposable CI database only.

begin;

create or replace function pg_temp.p115_en10217_matrix_assert(ok boolean, message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(ok, false) then
    raise exception 'P1.15 EN 10217 matrix assertion failed: %', message;
  end if;
end;
$$;

select pg_temp.p115_en10217_matrix_assert(
  exists (
    select 1
    from public.steel_standards s
    where s.code_key=public.canonical_steel_token('EN 10217')
      and s.status='active'
      and s.metadata->>'dataset_role'='manufacturer_range_umbrella'
      and coalesce((s.metadata->>'not_normative_complete')::boolean,false)
      and coalesce((s.metadata->>'no_part_specific_inference')::boolean,false)
  ),
  'EN 10217 manufacturer-range umbrella must exist without part-specific inference'
);

select pg_temp.p115_en10217_matrix_assert(
  (select count(*)=10
   from public.steel_standard_dimension_applicability a
   join public.steel_standards s on s.id=a.standard_id
   where s.code_key=public.canonical_steel_token('EN 10217')
     and a.knowledge_source_id='10217000-0000-4000-8000-000000000020'::uuid
     and a.applicability_type='manufacturer_range'
     and not a.is_normative_complete
     and coalesce((a.metadata->>'matrix_cell_verified')::boolean,false)),
  'exactly 10 visually verified ArcelorMittal matrix cells must be promoted'
);

select pg_temp.p115_en10217_matrix_assert(
  (select count(*)=5
   from public.steel_standard_dimension_applicability a
   join public.steel_standards s on s.id=a.standard_id
   where s.code_key=public.canonical_steel_token('EN 10217')
     and a.knowledge_source_id='10217000-0000-4000-8000-000000000020'::uuid
     and a.manufacturing_process='hot_stretch_reduced'),
  'sample must contain five hot-stretch-reduced cells'
);

select pg_temp.p115_en10217_matrix_assert(
  (select count(*)=5
   from public.steel_standard_dimension_applicability a
   join public.steel_standards s on s.id=a.standard_id
   where s.code_key=public.canonical_steel_token('EN 10217')
     and a.knowledge_source_id='10217000-0000-4000-8000-000000000020'::uuid
     and a.manufacturing_process='cold_formed'),
  'sample must contain five cold-formed cells'
);

-- Do not assign the series-level matrix sample to a concrete EN 10217 part.
select pg_temp.p115_en10217_matrix_assert(
  not exists (
    select 1
    from public.steel_standard_dimension_applicability a
    join public.steel_standards s on s.id=a.standard_id
    where s.code_key in (
      public.canonical_steel_token('EN 10217-1'),
      public.canonical_steel_token('EN 10217-2'),
      public.canonical_steel_token('EN 10217-3')
    )
      and a.knowledge_source_id='10217000-0000-4000-8000-000000000020'::uuid
      and coalesce((a.metadata->>'matrix_cell_verified')::boolean,false)
  ),
  'series-level matrix cells must not be inferred as part-specific dimensions'
);

select pg_temp.p115_en10217_matrix_assert(
  (select count(*)=10
   from public.steel_weight_references w
   where w.knowledge_source_id='10217000-0000-4000-8000-000000000020'::uuid
     and w.weight_method='calculated'
     and w.formula_version='round-annulus-density-7850-v1'
     and w.density_kg_m3=7850
     and not w.is_canonical
     and coalesce((w.metadata->>'not_published_mass')::boolean,false)
     and coalesce((w.metadata->>'matrix_cell_verified')::boolean,false)),
  '10 non-canonical calculated weight references must exist with explicit formula semantics'
);

select pg_temp.p115_en10217_matrix_assert(
  exists (
    select 1
    from public.steel_weight_references w
    join public.steel_geometries g on g.id=w.geometry_id
    where g.geometry_key='round|od=60.3|t=4.5'
      and w.knowledge_source_id='10217000-0000-4000-8000-000000000020'::uuid
      and w.weight_method='calculated'
      and w.weight_kg_m=6.1925
  ),
  '60.3 x 4.5 calculated mass must be 6.1925 kg/m'
);

select pg_temp.p115_en10217_matrix_assert(
  exists (
    select 1
    from public.steel_weight_references w
    join public.steel_geometries g on g.id=w.geometry_id
    where g.geometry_key='round|od=219.1|t=8'
      and w.knowledge_source_id='10217000-0000-4000-8000-000000000020'::uuid
      and w.weight_method='calculated'
      and w.weight_kg_m=41.6483
  ),
  '219.1 x 8 calculated mass must be 41.6483 kg/m'
);

select pg_temp.p115_en10217_matrix_assert(
  (select count(*)=10
   from public.steel_dimensional_rows d
   join public.steel_standards s on s.id=d.standard_id
   where s.code_key=public.canonical_steel_token('EN 10217')
     and d.knowledge_source_id='10217000-0000-4000-8000-000000000020'::uuid
     and d.weight_method='calculated'
     and d.weight_formula_version='round-annulus-density-7850-v1'
     and coalesce((d.metadata->>'not_published_mass')::boolean,false)),
  'legacy SK4 projection must expose all 10 rows as calculated, not published weights'
);

select pg_temp.p115_en10217_matrix_assert(
  exists (
    select 1
    from public.p1_shared_steel_dimensions(
      'EN 10217','round_tube',219.1,8,1000,12,50,0
    ) d
    where d.theoretical_weight_kg_m=41.6483
      and d.reference_price_eur_m=41.6483
      and d.reference_price_eur_piece=499.7796
      and d.price_semantic='reference_price'
      and d.not_normative_complete
  ),
  'existing SK4 RPC must calculate reference €/m and €/piece from the discrete EN 10217 row'
);

select pg_temp.p115_en10217_matrix_assert(
  (select count(*)=10
   from public.steel_reference_observations o
   where o.knowledge_source_id='10217000-0000-4000-8000-000000000020'::uuid
     and o.observed_standard_code='EN 10217'
     and o.observation_type='dimension'
     and o.promotion_status='promoted'
     and coalesce((o.metadata->>'human_visual_reviewed_seed')::boolean,false)),
  '10 promoted visual matrix observations must preserve raw provenance'
);

-- Regression: controlled EN 10216-2 P265GH dataset remains untouched.
select pg_temp.p115_en10217_matrix_assert(
  (select count(*)=56
   from public.steel_standard_dimension_applicability a
   join public.steel_standards s on s.id=a.standard_id
   join public.steel_material_grades g on g.id=a.material_grade_id
   where s.code_key=public.canonical_steel_token('EN 10216-2')
     and g.designation_key='p265gh'
     and a.applicability_type='supplier_range'),
  'existing 56-row P265GH EN 10216-2 dataset must remain unchanged'
);

rollback;
