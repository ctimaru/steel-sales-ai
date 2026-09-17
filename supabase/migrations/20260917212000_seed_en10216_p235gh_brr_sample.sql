-- P1.15 / SK4.3e — independent EN 10216-2 P235GH published-weight sample.
--
-- Source: Brütsch/Rüegger Metals AG live public catalog.
-- Scope is a deliberately small, source-backed supplier sample: 5 discrete P235GH TC1 rows.
-- It is NOT a normative EN 10216-2 dimensional table and does not imply full availability.
--
-- Weight semantics:
--   * supplier-published kg/m is stored as weight_method='published';
--   * theoretical annulus kg/m is stored separately as weight_method='calculated';
--   * both remain non-canonical until reconciliation policy promotes a value;
--   * material identity is P235GH / 1.0345, linked explicitly to EN 10216-2.

insert into public.knowledge_sources (
  id, owner_id, access_scope, source_key, source_type, source_class,
  name, provider, source_uri, language_code, trust_score, metadata, organization_id
) values (
  '10216000-0000-4000-8000-000000000030'::uuid,
  null,
  'global',
  'primary:brr:en10216-2-p235gh-live-catalog',
  'supplier_live_catalog',
  'primary',
  'Brütsch/Rüegger Metals — EN 10216-2 P235GH TC1 live catalog',
  'Brütsch/Rüegger Metals AG',
  'https://www.brr.ch/en/catalog/seamless-heavy-wall-tubes-and-hollow-bars-OXMMo6qyndJ',
  'en',
  0.92,
  jsonb_build_object(
    'dataset_scope','supplier_stock_catalog_sample',
    'independent_corroboration',true,
    'independence_group','brr-live-catalog',
    'not_normative_complete',true,
    'verified_on','2026-09-17'
  ),
  null
)
on conflict do nothing;

-- Independent grade applicability evidence from the supplier catalog.
insert into public.steel_standard_grade_applicability (
  standard_id, material_grade_id, product_family, manufacturing_process,
  applicability_type, notes, knowledge_source_id, source_locator, metadata
)
select
  s.id,
  g.id,
  'round_tube',
  'seamless',
  'supplier_range',
  'Brütsch/Rüegger live catalog lists seamless boiler tubes to EN 10216-2 in P235GH TC1 / 1.0345.',
  '10216000-0000-4000-8000-000000000030'::uuid,
  jsonb_build_object('section','Seamless boiler tubes','delivery_state','GH TC1'),
  jsonb_build_object(
    'dataset_scope','supplier_stock_catalog_sample',
    'independent_corroboration',true,
    'not_normative_complete',true,
    'test_class','TC1'
  )
from public.steel_standards s
join public.steel_material_grades g
  on g.designation_key=public.canonical_steel_token('P235GH')
 and g.material_number_key=public.canonical_steel_token('1.0345')
where s.code_key=public.canonical_steel_token('EN 10216-2')
  and s.status='active'
on conflict do nothing;

create temporary table sk43e_p235gh_brr (
  outer_diameter_mm numeric not null,
  thickness_mm numeric not null,
  published_weight_kg_m numeric not null,
  source_url text not null
) on commit preserve rows;

insert into sk43e_p235gh_brr values
  (21.3,  2.0,  0.950, 'https://www.brr.ch/en/catalog/seamless-heavy-wall-tubes-and-hollow-bars-OXMMo6qyndJ'),
  (33.7,  3.2,  2.410, 'https://www.brr.ch/de/item/nahtl-kesselrohre-en-10216-p235gh-tc1/23300337000000000320'),
  (76.1,  2.9,  5.240, 'https://www.brr.ch/de/item/nahtl-kesselrohre-en-10216-p235gh-tc1/23300761000000000290'),
  (139.7, 4.0, 13.390, 'https://www.brr.ch/de/item/nahtl-kesselrohre-en-10216-p235gh-tc1/23301397000000000400'),
  (168.3, 4.5, 18.180, 'https://www.brr.ch/en/item/boiler-tubes-en-10216-p235gh-tc1/23301683000000000450');

insert into public.steel_geometries (
  product_family, outer_diameter_mm, thickness_mm, metadata
)
select
  'round_tube', x.outer_diameter_mm, x.thickness_mm,
  jsonb_build_object(
    'seed','sk4.3e-en10216-p235gh-brr',
    'source_class','supplier_stock_catalog_sample'
  )
from sk43e_p235gh_brr x
on conflict (geometry_key) do nothing;

with ctx as (
  select
    s.id as standard_id,
    g.id as grade_id,
    ds.id as dimensional_system_id
  from public.steel_standards s
  join public.steel_material_grades g
    on g.designation_key=public.canonical_steel_token('P235GH')
   and g.material_number_key=public.canonical_steel_token('1.0345')
  cross join lateral (
    select id from public.steel_dimensional_systems
    where code_key=public.canonical_steel_token('metric-od-t')
    limit 1
  ) ds
  where s.code_key=public.canonical_steel_token('EN 10216-2')
    and s.status='active'
  limit 1
)
insert into public.steel_standard_dimension_applicability (
  standard_id, geometry_id, material_grade_id, dimensional_system_id,
  manufacturing_process, applicability_type, is_normative_complete,
  notes, knowledge_source_id, source_locator, metadata
)
select
  ctx.standard_id,
  geo.id,
  ctx.grade_id,
  ctx.dimensional_system_id,
  'seamless',
  'supplier_range',
  false,
  'Published P235GH TC1 stock/catalog row from Brütsch/Rüegger Metals; not a normative-complete EN 10216-2 table.',
  '10216000-0000-4000-8000-000000000030'::uuid,
  jsonb_build_object('url',x.source_url,'delivery_state','GH TC1'),
  jsonb_build_object(
    'seed','sk4.3e-en10216-p235gh-brr',
    'published_weight_available',true,
    'independent_corroboration',true,
    'not_normative_complete',true
  )
from sk43e_p235gh_brr x
join public.steel_geometries geo
  on geo.geometry_key='round|od='||public.canonical_mm_value(x.outer_diameter_mm)
    ||'|t='||public.canonical_mm_value(x.thickness_mm)
cross join ctx
on conflict do nothing;

-- Supplier-published weight reference.
with grade as (
  select id from public.steel_material_grades
  where designation_key=public.canonical_steel_token('P235GH')
    and material_number_key=public.canonical_steel_token('1.0345')
  limit 1
)
insert into public.steel_weight_references (
  geometry_id, material_grade_id, weight_kg_m, weight_method,
  is_canonical, knowledge_source_id, source_locator, metadata
)
select
  geo.id,
  grade.id,
  x.published_weight_kg_m,
  'published',
  false,
  '10216000-0000-4000-8000-000000000030'::uuid,
  jsonb_build_object('url',x.source_url,'unit','kg/m'),
  jsonb_build_object(
    'seed','sk4.3e-en10216-p235gh-brr',
    'dataset_scope','supplier_stock_catalog_sample',
    'published_by_supplier',true,
    'independent_corroboration',true,
    'not_normative_complete',true
  )
from sk43e_p235gh_brr x
join public.steel_geometries geo
  on geo.geometry_key='round|od='||public.canonical_mm_value(x.outer_diameter_mm)
    ||'|t='||public.canonical_mm_value(x.thickness_mm)
cross join grade
on conflict do nothing;

-- Separate theoretical calculation for reconciliation; never relabel supplier mass as calculated.
with grade as (
  select id from public.steel_material_grades
  where designation_key=public.canonical_steel_token('P235GH')
    and material_number_key=public.canonical_steel_token('1.0345')
  limit 1
)
insert into public.steel_weight_references (
  geometry_id, material_grade_id, weight_kg_m, weight_method,
  density_kg_m3, formula_version, is_canonical,
  knowledge_source_id, source_locator, metadata
)
select
  geo.id,
  grade.id,
  round((pi()/4 * (
    power(x.outer_diameter_mm,2)
    - power(x.outer_diameter_mm - 2*x.thickness_mm,2)
  ) * 1e-6 * 7850)::numeric, 4),
  'calculated',
  7850,
  'round-annulus-density-7850-v1',
  false,
  '10216000-0000-4000-8000-000000000030'::uuid,
  jsonb_build_object('derived_from','supplier geometry','formula','pi/4*(D^2-(D-2t)^2)*1e-6*density'),
  jsonb_build_object(
    'seed','sk4.3e-en10216-p235gh-brr',
    'reconciliation_role','calculated_check',
    'not_published_mass',true,
    'not_normative_complete',true
  )
from sk43e_p235gh_brr x
join public.steel_geometries geo
  on geo.geometry_key='round|od='||public.canonical_mm_value(x.outer_diameter_mm)
    ||'|t='||public.canonical_mm_value(x.thickness_mm)
cross join grade
on conflict do nothing;

-- Backwards-compatible SK4 projection uses the published supplier mass.
with std as (
  select id from public.steel_standards
  where code_key=public.canonical_steel_token('EN 10216-2')
    and status='active'
  limit 1
)
insert into public.steel_dimensional_rows (
  standard_id, product_family, outer_diameter_mm, thickness_mm,
  theoretical_weight_kg_m, weight_method, knowledge_source_id,
  source_locator, metadata, geometry_id
)
select
  std.id,
  'round_tube',
  x.outer_diameter_mm,
  x.thickness_mm,
  x.published_weight_kg_m,
  'published',
  '10216000-0000-4000-8000-000000000030'::uuid,
  jsonb_build_object('url',x.source_url,'unit','kg/m'),
  jsonb_build_object(
    'seed','sk4.3e-en10216-p235gh-brr',
    'grade','P235GH',
    'material_number','1.0345',
    'test_class','TC1',
    'published_by_supplier',true,
    'not_normative_complete',true,
    'projection_of_reference_v2',true
  ),
  geo.id
from sk43e_p235gh_brr x
join public.steel_geometries geo
  on geo.geometry_key='round|od='||public.canonical_mm_value(x.outer_diameter_mm)
    ||'|t='||public.canonical_mm_value(x.thickness_mm)
cross join std
on conflict do nothing;

-- Raw/promoted provenance observations.
with ctx as (
  select s.id as standard_id
  from public.steel_standards s
  where s.code_key=public.canonical_steel_token('EN 10216-2')
    and s.status='active'
  limit 1
)
insert into public.steel_reference_observations (
  knowledge_source_id, source_locator, observation_type,
  observed_standard_code, observed_grade, observed_product_family,
  normalized_standard_id, normalized_geometry_id,
  raw_payload, content_checksum, promotion_status, reviewed_at, metadata
)
select
  '10216000-0000-4000-8000-000000000030'::uuid,
  jsonb_build_object('url',x.source_url),
  'dimension',
  'EN 10216-2',
  'P235GH',
  'round_tube',
  ctx.standard_id,
  geo.id,
  jsonb_build_object(
    'outer_diameter_mm',x.outer_diameter_mm,
    'thickness_mm',x.thickness_mm,
    'published_weight_kg_m',x.published_weight_kg_m,
    'material_number','1.0345',
    'test_class','TC1'
  ),
  md5(concat_ws('|','BRR','EN10216-2','P235GH',x.outer_diameter_mm::text,x.thickness_mm::text,x.published_weight_kg_m::text)),
  'promoted',
  now(),
  jsonb_build_object(
    'seed','sk4.3e-en10216-p235gh-brr',
    'material_number','1.0345',
    'independent_corroboration',true,
    'not_normative_complete',true
  )
from sk43e_p235gh_brr x
join public.steel_geometries geo
  on geo.geometry_key='round|od='||public.canonical_mm_value(x.outer_diameter_mm)
    ||'|t='||public.canonical_mm_value(x.thickness_mm)
cross join ctx
on conflict do nothing;

-- Deterministic migration assertions.
do $$
declare
  v_count integer;
  v_max_diff numeric;
begin
  select count(*) into v_count
  from public.steel_standard_dimension_applicability a
  where a.knowledge_source_id='10216000-0000-4000-8000-000000000030'::uuid
    and a.metadata->>'seed'='sk4.3e-en10216-p235gh-brr';
  if v_count <> 5 then
    raise exception 'SK4.3e expected exactly 5 P235GH applicability rows, got %', v_count;
  end if;

  select count(*) into v_count
  from public.steel_weight_references w
  where w.knowledge_source_id='10216000-0000-4000-8000-000000000030'::uuid
    and w.weight_method='published'
    and w.metadata->>'seed'='sk4.3e-en10216-p235gh-brr';
  if v_count <> 5 then
    raise exception 'SK4.3e expected exactly 5 published weights, got %', v_count;
  end if;

  select max(abs((pub.weight_kg_m-calc.weight_kg_m)/pub.weight_kg_m*100))
    into v_max_diff
  from public.steel_weight_references pub
  join public.steel_weight_references calc
    on calc.geometry_id=pub.geometry_id
   and calc.material_grade_id=pub.material_grade_id
   and calc.knowledge_source_id=pub.knowledge_source_id
   and calc.weight_method='calculated'
   and calc.formula_version='round-annulus-density-7850-v1'
  where pub.knowledge_source_id='10216000-0000-4000-8000-000000000030'::uuid
    and pub.weight_method='published';
  if v_max_diff is null or v_max_diff > 1.0 then
    raise exception 'SK4.3e published-vs-calculated max difference exceeds 1%%: %', v_max_diff;
  end if;

  if not exists (
    select 1 from public.steel_weight_references w
    join public.steel_geometries g on g.id=w.geometry_id
    where g.geometry_key='round|od=168.3|t=4.5'
      and w.knowledge_source_id='10216000-0000-4000-8000-000000000030'::uuid
      and w.weight_method='published'
      and w.weight_kg_m=18.180
  ) then
    raise exception 'SK4.3e expected published 168.3 x 4.5 = 18.180 kg/m';
  end if;
end
$$;

drop table sk43e_p235gh_brr;