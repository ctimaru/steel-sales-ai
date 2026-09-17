-- P1.15 / SK4.2 — EN 10210 / EN 10219 structural reference catalog acceptance test.
-- Disposable CI database only.

begin;

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000a421'::uuid, 'structural-catalog@p1-test.example');

create or replace function pg_temp.p115_struct_assert(ok boolean, message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(ok, false) then
    raise exception 'P1.15 structural catalog assertion failed: %', message;
  end if;
end;
$$;

-- Standard-family and concrete part metadata.
select pg_temp.p115_struct_assert(
  (select count(*) = 2
   from public.steel_standard_series
   where standard_system_key = 'en'
     and code_key in ('en10210','en10219')),
  'EN 10210 and EN 10219 standard series must exist'
);

select pg_temp.p115_struct_assert(
  (select count(*) = 1
   from public.steel_standards
   where code_key = 'en10210-2' and edition = '2019' and part_number = '2' and status = 'active'),
  'EN 10210-2:2019 metadata record must exist'
);

select pg_temp.p115_struct_assert(
  (select count(*) = 1
   from public.steel_standards
   where code_key = 'en10219-2' and edition = '2019' and part_number = '2' and status = 'active'),
  'EN 10219-2:2019 metadata record must exist'
);

-- Canonical material identities are independent from geometry/source rows.
select pg_temp.p115_struct_assert(
  (select count(*) = 1 from public.steel_material_grades
   where standard_system_key='en' and designation_key='s355j2h' and material_number_key='1.0576'),
  'S355J2H / 1.0576 must exist'
);
select pg_temp.p115_struct_assert(
  (select count(*) = 1 from public.steel_material_grades
   where standard_system_key='en' and designation_key='s355nh' and material_number_key='1.0539'),
  'S355NH / 1.0539 must exist'
);
select pg_temp.p115_struct_assert(
  (select count(*) = 1 from public.steel_material_grades
   where standard_system_key='en' and designation_key='s355nlh' and material_number_key='1.0549'),
  'S355NLH / 1.0549 must exist'
);

-- EN 10219 first controlled tranche: 27 SHS + 23 RHS published manufacturer rows.
select pg_temp.p115_struct_assert(
  (select count(*) = 27
   from public.steel_dimensional_rows d
   join public.steel_standards s on s.id=d.standard_id
   where s.code_key='en10219' and d.product_family='square_tube'
     and d.metadata->>'dataset_scope'='manufacturer_product_range'),
  'EN 10219 SHS tranche must contain exactly 27 published rows'
);

select pg_temp.p115_struct_assert(
  (select count(*) = 23
   from public.steel_dimensional_rows d
   join public.steel_standards s on s.id=d.standard_id
   where s.code_key='en10219' and d.product_family='rectangular_tube'
     and d.metadata->>'dataset_scope'='manufacturer_product_range'),
  'EN 10219 RHS tranche must contain exactly 23 published rows'
);

select pg_temp.p115_struct_assert(
  (select count(*) = 50
   from public.steel_standard_dimension_applicability a
   join public.steel_standards s on s.id=a.standard_id
   where s.code_key='en10219'
     and a.applicability_type='manufacturer_range'
     and not a.is_normative_complete),
  'all 50 EN 10219 dimensions must be manufacturer-range and non-normative-complete'
);

select pg_temp.p115_struct_assert(
  (select count(*) = 50
   from public.steel_weight_references w
   join public.knowledge_sources ks on ks.id=w.knowledge_source_id
   where w.weight_method='published'
     and w.is_canonical
     and ks.source_key in ('primary:arcelormittal:distribution:shs-cold','primary:arcelormittal:distribution:rhs-cold')),
  'all 50 EN 10219 structural rows must have canonical published manufacturer kg/m'
);

-- Published sample values.
select pg_temp.p115_struct_assert(
  exists (
    select 1
    from public.steel_dimensional_rows d
    join public.steel_standards s on s.id=d.standard_id
    where s.code_key='en10219'
      and d.product_family='square_tube'
      and d.width_mm=100 and d.height_mm=100 and d.thickness_mm=4
      and d.theoretical_weight_kg_m=11.7 and d.weight_method='published'
  ),
  'EN 10219 SHS 100x100x4 must be 11.7 kg/m'
);

select pg_temp.p115_struct_assert(
  exists (
    select 1
    from public.steel_dimensional_rows d
    join public.steel_standards s on s.id=d.standard_id
    where s.code_key='en10219'
      and d.product_family='rectangular_tube'
      and greatest(d.width_mm,d.height_mm)=200 and least(d.width_mm,d.height_mm)=100
      and d.thickness_mm=8 and d.theoretical_weight_kg_m=33.9
  ),
  'EN 10219 RHS 200x100x8 must be 33.9 kg/m'
);

select pg_temp.p115_struct_assert(
  exists (
    select 1
    from public.steel_dimensional_rows d
    join public.steel_standards s on s.id=d.standard_id
    where s.code_key='en10219'
      and d.product_family='rectangular_tube'
      and greatest(d.width_mm,d.height_mm)=300 and least(d.width_mm,d.height_mm)=200
      and d.thickness_mm=10 and d.theoretical_weight_kg_m=72.7
  ),
  'EN 10219 RHS 300x200x10 must be 72.7 kg/m'
);

-- Existing read contract already exposes shape geometry and deterministic reference pricing.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a421', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select pg_temp.p115_struct_assert(
  exists (
    select 1
    from public.p1_shared_steel_dimensions(
      'EN 10219','square_tube',null,4,850,null,250,0
    ) r
    where r.width_mm=100 and r.height_mm=100
      and r.theoretical_weight_kg_m=11.7
      and r.reference_price_eur_m=9.9450
      and r.price_semantic='reference_price'
      and r.not_normative_complete
  ),
  'SK4 RPC must expose SHS geometry and 11.7 kg/m at 850 EUR/t as 9.9450 EUR/m'
);

select pg_temp.p115_struct_assert(
  exists (
    select 1
    from public.p1_shared_steel_dimensions(
      'EN 10219','rectangular_tube',null,8,850,12,250,0
    ) r
    where greatest(r.width_mm,r.height_mm)=200
      and least(r.width_mm,r.height_mm)=100
      and r.theoretical_weight_kg_m=33.9
      and r.reference_price_eur_m=28.8150
      and r.reference_price_eur_piece=345.7800
      and r.price_semantic='reference_price'
  ),
  'SK4 RPC must calculate RHS reference EUR/m and EUR/piece deterministically'
);

reset role;

-- EN 10210 hot-finished manufacturer availability: controlled CHS + SHS geometry tranche.
select pg_temp.p115_struct_assert(
  (select count(*) = 16 from public.steel_geometries
   where product_family='round_tube' and metadata->>'seed'='sk4.2-en10210'),
  'EN 10210 hot CHS tranche must contain 16 canonical geometries'
);

select pg_temp.p115_struct_assert(
  (select count(*) = 16 from public.steel_geometries
   where product_family='square_tube' and metadata->>'seed'='sk4.2-en10210'),
  'EN 10210 hot SHS tranche must contain 16 canonical geometries'
);

select pg_temp.p115_struct_assert(
  (select count(*) = 32
   from public.steel_standard_dimension_applicability a
   join public.steel_standards s on s.id=a.standard_id
   where s.code_key='en10210'
     and a.applicability_type='manufacturer_range'
     and a.manufacturing_process='hot_finished'
     and not a.is_normative_complete),
  'EN 10210 hot tranche must keep 32 manufacturer-range availability links'
);

-- CHS calculated references are explicitly not published/canonical manufacturer mass.
select pg_temp.p115_struct_assert(
  (select count(*) = 16
   from public.steel_weight_references w
   join public.steel_geometries g on g.id=w.geometry_id
   where g.product_family='round_tube'
     and g.metadata->>'seed'='sk4.2-en10210'
     and w.weight_method='calculated'
     and w.formula_version='round-annulus-density-7850-v1'
     and w.density_kg_m3=7850
     and not w.is_canonical
     and coalesce((w.metadata->>'not_published_mass')::boolean,false)),
  'EN 10210 CHS must have 16 explicit non-canonical calculated weight references'
);

select pg_temp.p115_struct_assert(
  (select count(*) = 0
   from public.steel_weight_references w
   join public.steel_geometries g on g.id=w.geometry_id
   where g.product_family='square_tube'
     and g.metadata->>'seed'='sk4.2-en10210'
     and w.knowledge_source_id='10210000-0000-4000-8000-000000000010'::uuid),
  'EN 10210 hot SHS must not invent kg/m before a published source is loaded'
);

-- Grade/process applicability must stay source-backed and separate from geometry.
select pg_temp.p115_struct_assert(
  (select count(*) = 3
   from public.steel_standard_grade_applicability a
   join public.steel_standards s on s.id=a.standard_id
   join public.steel_material_grades g on g.id=a.material_grade_id
   where s.code_key='en10219' and g.designation_key='s355j2h'
     and a.manufacturing_process='cold_formed'
     and a.applicability_type='manufacturer_range'),
  'EN 10219 S355J2H must be linked to CHS/SHS/RHS as manufacturer-range availability'
);

select pg_temp.p115_struct_assert(
  (select count(*) = 9
   from public.steel_standard_grade_applicability a
   join public.steel_standards s on s.id=a.standard_id
   where s.code_key='en10210'
     and a.manufacturing_process='hot_finished'
     and a.applicability_type='manufacturer_range'),
  'EN 10210 must contain 3 grades x 3 product families in manufacturer-range applicability'
);

-- Security boundary inherited from v2: canonical promoted data is shared read-only; staging remains service-only.
select pg_temp.p115_struct_assert(
  has_table_privilege('authenticated','public.steel_geometries','SELECT')
  and not has_table_privilege('authenticated','public.steel_geometries','INSERT'),
  'authenticated users must read but not write structural canonical geometries'
);
select pg_temp.p115_struct_assert(
  not has_table_privilege('authenticated','public.steel_reference_observations','SELECT'),
  'raw source observation staging must remain hidden from authenticated users'
);

rollback;
