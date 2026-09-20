-- P1.15 / SK4.3b-c — EN 10217 range-envelope + discrete-matrix acceptance test.
-- Disposable CI database only.

begin;

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000a431'::uuid, 'en10217-range@p1-test.example');

create or replace function pg_temp.p115_en10217_assert(ok boolean, message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(ok, false) then
    raise exception 'P1.15 EN 10217 range assertion failed: %', message;
  end if;
end;
$$;

select pg_temp.p115_en10217_assert(
  to_regclass('public.steel_product_range_envelopes') is not null,
  'range-envelope table must exist'
);

select pg_temp.p115_en10217_assert(
  exists (
    select 1 from public.steel_standards
    where code_key=public.canonical_steel_token('EN 10217-3')
      and edition='EN 10217-3:2019 / UNI EN 10217-3:2019'
      and valid_from='2019-06-13'::date
      and status='active'
      and manufacturing_processes @> array['electric_welded','submerged_arc_welded']::text[]
  ),
  'EN 10217-3:2019 active metadata must exist'
);

select pg_temp.p115_en10217_assert(
  (select count(*)=6 from public.steel_material_grades
   where standard_system_key='en'
     and (designation_key,material_number_key) in (
       ('p195tr2',public.canonical_steel_token('1.0108')),
       ('p235tr2',public.canonical_steel_token('1.0255')),
       ('p265tr2',public.canonical_steel_token('1.0259')),
       ('p275nl1',public.canonical_steel_token('1.0488')),
       ('p355nh',public.canonical_steel_token('1.0565')),
       ('p355nl1',public.canonical_steel_token('1.0566'))
     )),
  'TR2 and fine-grain material identities must exist with canonical material numbers'
);

select pg_temp.p115_en10217_assert(
  (select count(*)=3
   from public.steel_standard_grade_applicability a
   join public.steel_standards s on s.id=a.standard_id
   join public.steel_material_grades g on g.id=a.material_grade_id
   where s.code_key=public.canonical_steel_token('EN 10217-1')
     and g.designation_key in ('p195tr2','p235tr2','p265tr2')
     and a.applicability_type='manufacturer_range'),
  'EN 10217-1 must expose three TR2 manufacturer grade links'
);

select pg_temp.p115_en10217_assert(
  (select count(*)=3
   from public.steel_standard_grade_applicability a
   join public.steel_standards s on s.id=a.standard_id
   join public.steel_material_grades g on g.id=a.material_grade_id
   where s.code_key=public.canonical_steel_token('EN 10217-2')
     and g.designation_key in ('p195gh','p235gh','p265gh')
     and a.applicability_type='manufacturer_range'
     and a.metadata->'test_classes' = '["TC1","TC2"]'::jsonb),
  'EN 10217-2 must expose P195/P235/P265GH with TC1/TC2 manufacturer metadata'
);

select pg_temp.p115_en10217_assert(
  (select count(*)=4
   from public.steel_standard_grade_applicability a
   join public.steel_standards s on s.id=a.standard_id
   join public.steel_material_grades g on g.id=a.material_grade_id
   where s.code_key=public.canonical_steel_token('EN 10217-3')
     and g.designation_key in ('p275nl1','p355n','p355nh','p355nl1')
     and a.applicability_type='manufacturer_range'),
  'EN 10217-3 must expose four fine-grain manufacturer grade links'
);

select pg_temp.p115_en10217_assert(
  (select count(*)=4
   from public.steel_product_range_envelopes e
   join public.knowledge_sources ks on ks.id=e.knowledge_source_id
   where ks.provider='ArcelorMittal'
     and e.product_family='round_tube'
     and e.range_type='manufacturer_range'
     and not e.combination_complete),
  'four ArcelorMittal EN 10217 range envelopes must exist and remain non-complete'
);

select pg_temp.p115_en10217_assert(
  exists (
    select 1
    from public.steel_product_range_envelopes e
    join public.steel_standards s on s.id=e.standard_id
    where s.code_key=public.canonical_steel_token('EN 10217-1')
      and e.outer_diameter_min_mm=60.3 and e.outer_diameter_max_mm=219.1
      and e.thickness_min_mm=2.0 and e.thickness_max_mm=10.0
      and e.manufacturing_process='welded'
      and not e.combination_complete
      and coalesce((e.metadata->>'envelope_only')::boolean,false)
  ),
  'EN 10217-1 manufacturer envelope must be 60.3–219.1 mm OD and 2–10 mm wall'
);

select pg_temp.p115_en10217_assert(
  exists (
    select 1
    from public.steel_product_range_envelopes e
    join public.steel_standards s on s.id=e.standard_id
    where s.code_key=public.canonical_steel_token('EN 10217-2')
      and e.outer_diameter_min_mm=114.3 and e.outer_diameter_max_mm=219.1
      and e.thickness_min_mm=3.2 and e.thickness_max_mm=6.3
      and e.manufacturing_process='electric_welded'
      and not e.combination_complete
  ),
  'EN 10217-2 manufacturer envelope must be 114.3–219.1 mm OD and 3.2–6.3 mm wall'
);

select pg_temp.p115_en10217_assert(
  exists (
    select 1
    from public.steel_product_range_envelopes e
    join public.steel_standards s on s.id=e.standard_id
    where s.code_key=public.canonical_steel_token('EN 10217-3')
      and e.outer_diameter_min_mm=17.2 and e.outer_diameter_max_mm=168.3
      and e.thickness_min_mm=1.8 and e.thickness_max_mm=8.0
      and not e.combination_complete
  ),
  'EN 10217-3 manufacturer envelope must preserve the published 17.2–168.3 / 1.8–8 range'
);

select pg_temp.p115_en10217_assert(
  exists (
    select 1
    from public.steel_product_range_envelopes e
    join public.steel_standard_series ss on ss.id=e.standard_series_id
    where e.standard_id is null
      and ss.code_key=public.canonical_steel_token('EN 10217')
      and e.outer_diameter_min_mm=17.2 and e.outer_diameter_max_mm=219.1
      and e.thickness_min_mm=1.8 and e.thickness_max_mm=8.0
      and coalesce((e.metadata->>'matrix_available')::boolean,false)
      and coalesce((e.metadata->>'not_all_cells_implied')::boolean,false)
  ),
  'series-level EN 10217 matrix envelope must not imply every cell exists'
);

-- SK4.3c: controlled discrete matrix sample.
select pg_temp.p115_en10217_assert(
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

select pg_temp.p115_en10217_assert(
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

select pg_temp.p115_en10217_assert(
  (select count(*)=5
   from public.steel_standard_dimension_applicability a
   join public.steel_standards s on s.id=a.standard_id
   where s.code_key=public.canonical_steel_token('EN 10217')
     and a.knowledge_source_id='10217000-0000-4000-8000-000000000020'::uuid
     and a.manufacturing_process='hot_stretch_reduced'),
  'sample must contain five hot-stretch-reduced cells'
);

select pg_temp.p115_en10217_assert(
  (select count(*)=5
   from public.steel_standard_dimension_applicability a
   join public.steel_standards s on s.id=a.standard_id
   where s.code_key=public.canonical_steel_token('EN 10217')
     and a.knowledge_source_id='10217000-0000-4000-8000-000000000020'::uuid
     and a.manufacturing_process='cold_formed'),
  'sample must contain five cold-formed cells'
);

select pg_temp.p115_en10217_assert(
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

select pg_temp.p115_en10217_assert(
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

select pg_temp.p115_en10217_assert(
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

select pg_temp.p115_en10217_assert(
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

select pg_temp.p115_en10217_assert(
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

select pg_temp.p115_en10217_assert(
  exists (
    select 1
    from public.p1_shared_steel_effective_dimensions(
      'EN 10217',null,'round_tube',219.1,8,1000,12,50,0
    ) d
    where d.effective_weight_status='canonical_missing'
      and d.effective_weight_reference_id is null
      and d.effective_weight_kg_m is null
      and d.reference_price_eur_m is null
      and d.reference_price_eur_piece is null
      and d.price_semantic='unavailable_without_canonical'
  ),
  'SK4.5j must keep EN 10217 calculated mass as evidence but withhold pricing until a neutral canonical exists'
);

select pg_temp.p115_en10217_assert(
  (select count(*)=10
   from public.steel_reference_observations o
   where o.knowledge_source_id='10217000-0000-4000-8000-000000000020'::uuid
     and o.observed_standard_code='EN 10217'
     and o.observation_type='dimension'
     and o.promotion_status='promoted'
     and coalesce((o.metadata->>'human_visual_reviewed_seed')::boolean,false)),
  '10 promoted visual matrix observations must preserve raw provenance'
);

-- Regression: prior P265GH EN 10216-2 controlled dataset remains untouched.
select pg_temp.p115_en10217_assert(
  (select count(*)=56
   from public.steel_standard_dimension_applicability a
   join public.steel_standards s on s.id=a.standard_id
   join public.steel_material_grades g on g.id=a.material_grade_id
   where s.code_key=public.canonical_steel_token('EN 10216-2')
     and g.designation_key='p265gh'
     and a.applicability_type='supplier_range'),
  'existing 56-row P265GH EN 10216-2 dataset must remain unchanged'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a431',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.p115_en10217_assert(
  has_table_privilege('authenticated','public.steel_product_range_envelopes','SELECT')
  and not has_table_privilege('authenticated','public.steel_product_range_envelopes','INSERT')
  and not has_table_privilege('authenticated','public.steel_product_range_envelopes','UPDATE')
  and not has_table_privilege('authenticated','public.steel_product_range_envelopes','DELETE'),
  'authenticated users must have shared read-only access to promoted range envelopes'
);

reset role;

select pg_temp.p115_en10217_assert(
  not has_table_privilege('anon','public.steel_product_range_envelopes','SELECT'),
  'anon must not read range envelopes'
);

rollback;
