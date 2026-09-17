-- P1.15 / SK4.3 — EN 10216 / EN 10217 pressure reference catalog acceptance test.
-- Disposable CI database only.

begin;

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000a431'::uuid, 'pressure-catalog@p1-test.example');

create or replace function pg_temp.p115_pressure_assert(ok boolean, message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(ok, false) then
    raise exception 'P1.15 pressure catalog assertion failed: %', message;
  end if;
end;
$$;

-- Multipart families and concrete parts.
select pg_temp.p115_pressure_assert(
  (select count(*) = 2
   from public.steel_standard_series
   where standard_system_key='en'
     and code_key in ('en10216','en10217')),
  'EN 10216 and EN 10217 standard series must exist'
);

select pg_temp.p115_pressure_assert(
  (select count(*) = 6
   from public.steel_standards
   where code_key in ('en102161','en102162','en102163','en102164','en102171','en102172')
     and status='active'),
  'six controlled EN 10216/10217 part records must exist'
);

select pg_temp.p115_pressure_assert(
  exists (
    select 1 from public.steel_standards
    where code_key='en102162'
      and part_number='2'
      and edition='EN 10216-2:2024 / BS EN 10216-2:2024'
      and manufacturing_processes=array['seamless']::text[]
  ),
  'EN 10216-2:2024 metadata/process record must exist'
);

select pg_temp.p115_pressure_assert(
  exists (
    select 1 from public.steel_standards
    where code_key='en102172'
      and part_number='2'
      and edition='EN 10217-2:2019 / UNI EN 10217-2:2019'
      and manufacturing_processes=array['electric_welded']::text[]
  ),
  'EN 10217-2:2019 metadata/process record must exist'
);

-- Core pressure grades and material numbers are canonical identities independent of geometry.
select pg_temp.p115_pressure_assert(
  (select count(*) = 13
   from public.steel_material_grades
   where standard_system_key='en'
     and designation_key in (
       'p195tr1','p235tr1','p265tr1','p195gh','p235gh','p265gh','16mo3',
       '13crmo45','10crmo910','p355n','p215nl','p255ql','p265nl'
     )),
  'thirteen controlled EN pressure grades must exist'
);

select pg_temp.p115_pressure_assert(
  exists (
    select 1 from public.steel_material_grades
    where standard_system_key='en'
      and designation_key='p265gh'
      and material_number_key=public.canonical_steel_token('1.0425')
      and density_kg_m3=7850
  ),
  'P265GH / 1.0425 must exist as canonical material identity'
);

select pg_temp.p115_pressure_assert(
  exists (
    select 1 from public.steel_material_grades
    where standard_system_key='en'
      and designation_key='16mo3'
      and material_number_key=public.canonical_steel_token('1.5415')
  ),
  '16Mo3 / 1.5415 must exist'
);

select pg_temp.p115_pressure_assert(
  exists (
    select 1 from public.steel_material_grades
    where standard_system_key='en'
      and designation_key='13crmo45'
      and material_number_key=public.canonical_steel_token('1.7335')
  ),
  '13CrMo4-5 / 1.7335 must exist'
);

select pg_temp.p115_pressure_assert(
  exists (
    select 1 from public.steel_material_grades
    where standard_system_key='en'
      and designation_key='10crmo910'
      and material_number_key=public.canonical_steel_token('1.7380')
  ),
  '10CrMo9-10 / 1.7380 must exist'
);

-- Source-backed grade applicability stays separate from normative equivalence.
select pg_temp.p115_pressure_assert(
  (select count(*) = 6
   from public.steel_standard_grade_applicability a
   join public.steel_standards s on s.id=a.standard_id
   where s.code_key='en102162'
     and a.product_family='round_tube'
     and a.manufacturing_process='seamless'
     and a.applicability_type='supplier_range'),
  'EN 10216-2 must have six controlled supplier-backed grade/process links'
);

select pg_temp.p115_pressure_assert(
  (select count(*) = 3
   from public.steel_standard_grade_applicability a
   join public.steel_standards s on s.id=a.standard_id
   where s.code_key='en102171'
     and a.product_family='round_tube'
     and a.manufacturing_process='welded'
     and a.applicability_type='supplier_range'),
  'EN 10217-1 must have three controlled supplier-backed grade/process links'
);

-- Controlled P265GH EN 10216-2 supplier range: 56 unique OD × wall combinations.
select pg_temp.p115_pressure_assert(
  (select count(*) = 56
   from public.steel_dimensional_rows d
   join public.steel_standards s on s.id=d.standard_id
   where s.code_key='en102162'
     and d.product_family='round_tube'
     and d.metadata->>'dataset_scope'='supplier_product_range'
     and d.metadata->>'grade'='P265GH'
     and coalesce((d.metadata->>'not_normative_complete')::boolean,false)),
  'EN 10216-2 P265GH controlled supplier range must contain 56 rows'
);

select pg_temp.p115_pressure_assert(
  (select count(*) = 56
   from public.steel_standard_dimension_applicability a
   join public.steel_standards s on s.id=a.standard_id
   join public.steel_material_grades g on g.id=a.material_grade_id
   where s.code_key='en102162'
     and g.designation_key='p265gh'
     and a.applicability_type='supplier_range'
     and a.manufacturing_process='seamless'
     and not a.is_normative_complete
     and a.knowledge_source_id='10216000-0000-4000-8000-000000000013'::uuid),
  'all 56 P265GH rows must be linked as non-normative supplier range'
);

select pg_temp.p115_pressure_assert(
  (select count(*) = 56
   from public.steel_weight_references w
   join public.steel_material_grades g on g.id=w.material_grade_id
   where g.designation_key='p265gh'
     and w.knowledge_source_id='10216000-0000-4000-8000-000000000013'::uuid
     and w.weight_method='published'
     and w.is_canonical),
  'all 56 P265GH rows must have source-backed published kg/m'
);

select pg_temp.p115_pressure_assert(
  (select count(*) = 56
   from public.steel_reference_observations o
   where o.knowledge_source_id='10216000-0000-4000-8000-000000000013'::uuid
     and o.observed_standard_code='EN 10216-2'
     and o.observed_grade='P265GH'
     and o.promotion_status='promoted'),
  'all 56 source observations must be retained in service-only staging/audit'
);

-- Published samples around commercially important OD values.
select pg_temp.p115_pressure_assert(
  exists (
    select 1
    from public.steel_dimensional_rows d
    join public.steel_standards s on s.id=d.standard_id
    where s.code_key='en102162'
      and d.outer_diameter_mm=323.90 and d.thickness_mm=9.53
      and d.theoretical_weight_kg_m=73.88 and d.weight_method='published'
      and d.metadata->>'supplier_designation'='STD'
  ),
  'P265GH 323.9x9.53 STD must be 73.88 kg/m'
);

select pg_temp.p115_pressure_assert(
  exists (
    select 1
    from public.steel_dimensional_rows d
    join public.steel_standards s on s.id=d.standard_id
    where s.code_key='en102162'
      and d.outer_diameter_mm=323.90 and d.thickness_mm=12.70
      and d.theoretical_weight_kg_m=97.46
      and d.metadata->>'supplier_designation'='XS'
  ),
  'P265GH 323.9x12.70 XS must be 97.46 kg/m'
);

select pg_temp.p115_pressure_assert(
  exists (
    select 1
    from public.steel_dimensional_rows d
    join public.steel_standards s on s.id=d.standard_id
    where s.code_key='en102162'
      and d.outer_diameter_mm=323.90 and d.thickness_mm=25.40
      and d.theoretical_weight_kg_m=186.90
      and d.metadata->>'supplier_designation'='XXS'
  ),
  'P265GH 323.9x25.40 XXS must be 186.90 kg/m'
);

select pg_temp.p115_pressure_assert(
  exists (
    select 1
    from public.steel_dimensional_rows d
    join public.steel_standards s on s.id=d.standard_id
    where s.code_key='en102162'
      and d.outer_diameter_mm=406.40 and d.thickness_mm=9.53
      and d.theoretical_weight_kg_m=93.27
  ),
  'P265GH 406.4x9.53 must be 93.27 kg/m'
);

-- Supplier NPS / STD / XS / XXS labels are preserved but are explicitly not claimed as ASME normative mappings.
select pg_temp.p115_pressure_assert(
  exists (
    select 1
    from public.steel_dimension_designations dd
    join public.steel_geometries g on g.id=dd.geometry_id
    where g.product_family='round_tube'
      and g.outer_diameter_mm=323.90 and g.thickness_mm=9.53
      and dd.nps=12 and dd.schedule_key='std'
      and coalesce((dd.metadata->>'supplier_designation_only')::boolean,false)
      and coalesce((dd.metadata->>'not_asme_normative_mapping')::boolean,false)
  ),
  '323.9x9.53 must preserve NPS 12 / STD as supplier designation only'
);

select pg_temp.p115_pressure_assert(
  (select count(*) = 56
   from public.steel_dimension_designations dd
   where coalesce((dd.metadata->>'supplier_designation_only')::boolean,false)
     and coalesce((dd.metadata->>'not_asme_normative_mapping')::boolean,false)
     and dd.metadata->>'source'='Metal Service Zwevegem P265GH table'),
  'all 56 P265GH NPS labels must remain explicitly non-ASME supplier designations'
);

-- Existing SK4 read/pricing contract must expose pressure rows without new API code.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a431', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select pg_temp.p115_pressure_assert(
  exists (
    select 1
    from public.p1_shared_steel_dimensions(
      'EN 10216-2','round_tube',323.9,9.53,850,12,100,0
    ) r
    where r.outer_diameter_mm=323.9
      and r.thickness_mm=9.53
      and r.theoretical_weight_kg_m=73.88
      and r.reference_price_eur_m=62.7980
      and r.reference_price_eur_piece=753.5760
      and r.price_semantic='reference_price'
      and r.not_normative_complete
  ),
  'SK4 RPC must expose P265GH supplier row and deterministic EUR/m and EUR/piece'
);

select pg_temp.p115_pressure_assert(
  has_table_privilege('authenticated','public.steel_material_grades','SELECT')
  and has_table_privilege('authenticated','public.steel_geometries','SELECT')
  and not has_table_privilege('authenticated','public.steel_geometries','INSERT'),
  'authenticated users must read canonical pressure reference data but not write it'
);

select pg_temp.p115_pressure_assert(
  not has_table_privilege('authenticated','public.steel_reference_observations','SELECT'),
  'raw pressure observation staging must remain hidden from authenticated users'
);

reset role;

rollback;
