-- P1.15 / SK4.1 — Reference Database v2 acceptance test.
-- Disposable CI database only.

begin;

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000a411'::uuid, 'reference-v2@p1-test.example');

create or replace function pg_temp.p115_v2_assert(ok boolean, message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(ok, false) then
    raise exception 'P1.15 v2 assertion failed: %', message;
  end if;
end;
$$;

-- Existing EN 10224 seed must be promoted into the v2 canonical model without
-- breaking the SK4 read contract.
select pg_temp.p115_v2_assert(
  (
    select count(*) = 1
    from public.steel_standard_series
    where standard_system_key = 'en'
      and code_key = 'en10224'
  ),
  'EN 10224 must be backfilled into steel_standard_series'
);

select pg_temp.p115_v2_assert(
  (
    select count(*) = 1
    from public.steel_standards
    where code_key = 'en10224'
      and standard_series_id = '10224000-0000-4000-8000-000000000010'::uuid
      and standard_system = 'EN'
      and application_category = 'water_transport'
  ),
  'existing EN 10224 standard must link to its v2 series'
);

select pg_temp.p115_v2_assert(
  (
    select count(distinct d.geometry_id) = 3
    from public.steel_dimensional_rows d
    join public.steel_standards s on s.id = d.standard_id
    where s.code_key = public.canonical_steel_token('EN 10224')
      and d.geometry_id is not null
  ),
  'three existing EN 10224 rows must become three reusable canonical geometries'
);

select pg_temp.p115_v2_assert(
  (
    select count(*) = 3
    from public.steel_dimensional_rows d
    join public.steel_standards s on s.id = d.standard_id
    where s.code_key = public.canonical_steel_token('EN 10224')
      and d.geometry_id is not null
  ),
  'all legacy EN 10224 dimensional rows must point to canonical geometry'
);

select pg_temp.p115_v2_assert(
  (
    select count(*) = 3
    from public.steel_standard_dimension_applicability a
    join public.steel_standards s on s.id = a.standard_id
    where s.code_key = public.canonical_steel_token('EN 10224')
      and a.applicability_type = 'manufacturer_range'
      and not a.is_normative_complete
  ),
  'legacy EN 10224 manufacturer rows must remain explicitly non-normative-complete'
);

select pg_temp.p115_v2_assert(
  (
    select count(*) = 3
    from public.steel_weight_references w
    where w.weight_method = 'published'
      and w.is_canonical
      and exists (
        select 1
        from public.steel_dimensional_rows d
        join public.steel_standards s on s.id = d.standard_id
        where s.code_key = public.canonical_steel_token('EN 10224')
          and d.geometry_id = w.geometry_id
          and d.knowledge_source_id = w.knowledge_source_id
      )
  ),
  'legacy EN 10224 published kg/m values must be promoted into weight references'
);

-- The old SK4 RPC remains a compatibility contract while the v2 API evolves.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a411', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select pg_temp.p115_v2_assert(
  (
    select count(*) = 3
    from public.p1_shared_steel_dimensions(
      'EN 10224', null, null, null, null, null, 250, 0
    )
  ),
  'SK4 dimensions RPC must remain backwards-compatible after v2 migration'
);

reset role;

-- Canonical geometries are standard-independent and cover CHS / SHS / RHS.
-- Deliberately unusual values keep these CI fixtures outside real catalog ranges.
insert into public.steel_geometries (
  id, product_family, outer_diameter_mm, width_mm, height_mm, thickness_mm, metadata
) values
  (
    'a4110000-0000-4000-8000-000000000001'::uuid,
    'round_tube', 987.6, null, null, 12.34,
    jsonb_build_object('test_fixture', true)
  ),
  (
    'a4110000-0000-4000-8000-000000000002'::uuid,
    'square_tube', null, 101.1, 101.1, 5.1,
    jsonb_build_object('test_fixture', true)
  ),
  (
    'a4110000-0000-4000-8000-000000000003'::uuid,
    'rectangular_tube', null, 201.1, 101.1, 8.1,
    jsonb_build_object('test_fixture', true)
  );

select pg_temp.p115_v2_assert(
  (
    select geometry_key = 'round|od=987.6|t=12.34'
    from public.steel_geometries
    where id = 'a4110000-0000-4000-8000-000000000001'::uuid
  ),
  'round geometry identity must be deterministic'
);

select pg_temp.p115_v2_assert(
  (
    select geometry_key = 'rect|201.1x101.1|t=8.1'
    from public.steel_geometries
    where id = 'a4110000-0000-4000-8000-000000000003'::uuid
  ),
  'rectangular geometry identity must normalize orientation'
);

do $$
begin
  begin
    insert into public.steel_geometries (
      product_family, width_mm, height_mm, thickness_mm
    ) values ('rectangular_tube', 101.1, 201.1, 8.1);
    raise exception 'reversed RHS orientation unexpectedly created a duplicate';
  exception
    when unique_violation then null;
  end;
end;
$$;

-- Multipart standard family + part/edition model.
insert into public.steel_standard_series (
  id, standard_system, code, title, issuing_body, application_category, metadata
) values (
  'a4110000-0000-4000-8000-000000000010'::uuid,
  'TEST',
  'TEST 9000',
  'Synthetic multipart tube standard family',
  'TEST BODY',
  'pressure',
  jsonb_build_object('test_fixture', true)
);

insert into public.steel_standards (
  id,
  code,
  title,
  short_explanation,
  issuing_body,
  edition,
  status,
  knowledge_source_id,
  standard_series_id,
  standard_system,
  part_number,
  application_category,
  manufacturing_processes,
  dimensional_basis,
  metadata
) values (
  'a4110000-0000-4000-8000-000000000011'::uuid,
  'TEST 9000-2',
  'Synthetic part 2',
  'CI-only multipart standard fixture.',
  'TEST BODY',
  '2026',
  'active',
  '10224000-0000-4000-8000-000000000001'::uuid,
  'a4110000-0000-4000-8000-000000000010'::uuid,
  'TEST',
  '2',
  'pressure',
  array['seamless']::text[],
  'metric_od_t',
  jsonb_build_object('test_fixture', true)
);

select pg_temp.p115_v2_assert(
  (
    select s.code = 'TEST 9000-2'
      and ss.code = 'TEST 9000'
      and s.part_number = '2'
    from public.steel_standards s
    join public.steel_standard_series ss on ss.id = s.standard_series_id
    where s.id = 'a4110000-0000-4000-8000-000000000011'::uuid
  ),
  'standard part must resolve to its standard family'
);

-- Canonical materials and explicit applicability.
insert into public.steel_material_grades (
  id, standard_system, designation, material_number, material_family, density_kg_m3, metadata
) values
  (
    'a4110000-0000-4000-8000-000000000020'::uuid,
    'TEST', 'GRADE-A', '1.TESTA', 'carbon_steel', 7850,
    jsonb_build_object('test_fixture', true)
  ),
  (
    'a4110000-0000-4000-8000-000000000021'::uuid,
    'TEST', 'GRADE-B', '1.TESTB', 'carbon_steel', 7850,
    jsonb_build_object('test_fixture', true)
  );

insert into public.steel_standard_grade_applicability (
  standard_id,
  material_grade_id,
  product_family,
  manufacturing_process,
  applicability_type,
  metadata
) values (
  'a4110000-0000-4000-8000-000000000011'::uuid,
  'a4110000-0000-4000-8000-000000000020'::uuid,
  'round_tube',
  'seamless',
  'normative',
  jsonb_build_object('test_fixture', true)
);

select pg_temp.p115_v2_assert(
  (
    select count(*) = 1
    from public.steel_standard_grade_applicability
    where standard_id = 'a4110000-0000-4000-8000-000000000011'::uuid
      and material_grade_id = 'a4110000-0000-4000-8000-000000000020'::uuid
      and product_family = 'round_tube'
      and manufacturing_process = 'seamless'
  ),
  'grade applicability must be independent from geometry'
);

-- NPS / DN / Schedule is a designation of canonical geometry, not a duplicate geometry.
insert into public.steel_dimensional_systems (
  id, code, title, unit_system, issuing_body, metadata
) values (
  'a4110000-0000-4000-8000-000000000030'::uuid,
  'test-nps-schedule',
  'Synthetic NPS/DN/Schedule system',
  'mixed',
  'TEST BODY',
  jsonb_build_object('test_fixture', true)
);

insert into public.steel_dimension_designations (
  geometry_id,
  dimensional_system_id,
  nominal_designation,
  nps,
  dn,
  schedule,
  metadata
) values (
  'a4110000-0000-4000-8000-000000000001'::uuid,
  'a4110000-0000-4000-8000-000000000030'::uuid,
  'TEST NPS 6',
  6,
  150,
  'TEST40',
  jsonb_build_object('test_fixture', true)
);

select pg_temp.p115_v2_assert(
  (
    select g.outer_diameter_mm = 987.6
      and d.nps = 6
      and d.dn = 150
      and d.schedule = 'TEST40'
    from public.steel_dimension_designations d
    join public.steel_geometries g on g.id = d.geometry_id
    where d.dimensional_system_id = 'a4110000-0000-4000-8000-000000000030'::uuid
  ),
  'nominal designation must resolve to canonical metric geometry'
);

insert into public.steel_standard_dimension_applicability (
  standard_id,
  geometry_id,
  material_grade_id,
  dimensional_system_id,
  manufacturing_process,
  applicability_type,
  is_normative_complete,
  metadata
) values (
  'a4110000-0000-4000-8000-000000000011'::uuid,
  'a4110000-0000-4000-8000-000000000001'::uuid,
  'a4110000-0000-4000-8000-000000000020'::uuid,
  'a4110000-0000-4000-8000-000000000030'::uuid,
  'seamless',
  'normative',
  true,
  jsonb_build_object('test_fixture', true)
);

-- Multiple weight sources/methods can coexist. Calculated weights require a formula version.
do $$
begin
  begin
    insert into public.steel_weight_references (
      geometry_id, weight_kg_m, weight_method, density_kg_m3
    ) values (
      'a4110000-0000-4000-8000-000000000001'::uuid,
      28.2,
      'calculated',
      7850
    );
    raise exception 'calculated weight unexpectedly accepted without formula version';
  exception
    when check_violation then null;
  end;
end;
$$;

insert into public.steel_weight_references (
  geometry_id,
  material_grade_id,
  weight_kg_m,
  weight_method,
  density_kg_m3,
  formula_version,
  is_canonical,
  metadata
) values (
  'a4110000-0000-4000-8000-000000000001'::uuid,
  'a4110000-0000-4000-8000-000000000020'::uuid,
  28.2,
  'calculated',
  7850,
  'test-round-v1',
  false,
  jsonb_build_object('test_fixture', true)
);

-- Grade relationships must preserve semantics; commercially comparable is not same material.
insert into public.steel_grade_cross_references (
  from_material_grade_id,
  to_material_grade_id,
  relation_type,
  notes,
  metadata
) values (
  'a4110000-0000-4000-8000-000000000020'::uuid,
  'a4110000-0000-4000-8000-000000000021'::uuid,
  'commercially_comparable',
  'CI fixture proving relationship semantics.',
  jsonb_build_object('test_fixture', true)
);

select pg_temp.p115_v2_assert(
  (
    select relation_type = 'commercially_comparable'
    from public.steel_grade_cross_references
    where from_material_grade_id = 'a4110000-0000-4000-8000-000000000020'::uuid
      and to_material_grade_id = 'a4110000-0000-4000-8000-000000000021'::uuid
  ),
  'grade cross-reference must retain explicit relation semantics'
);

-- Security: promoted canonical reference is shared read-only; raw observation staging is service-only.
select pg_temp.p115_v2_assert(
  has_table_privilege('authenticated', 'public.steel_standard_series', 'SELECT'),
  'authenticated must read promoted standard series'
);
select pg_temp.p115_v2_assert(
  has_table_privilege('authenticated', 'public.steel_geometries', 'SELECT'),
  'authenticated must read canonical geometries'
);
select pg_temp.p115_v2_assert(
  not has_table_privilege('authenticated', 'public.steel_geometries', 'INSERT'),
  'authenticated must not write canonical geometries'
);
select pg_temp.p115_v2_assert(
  not has_table_privilege('authenticated', 'public.steel_reference_observations', 'SELECT'),
  'raw unreviewed observations must not be exposed to authenticated users'
);
select pg_temp.p115_v2_assert(
  has_table_privilege('service_role', 'public.steel_reference_observations', 'SELECT,INSERT,UPDATE,DELETE'),
  'service role must manage observation staging'
);

rollback;
