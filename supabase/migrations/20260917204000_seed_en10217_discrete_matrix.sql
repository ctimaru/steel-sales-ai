-- P1.15 / SK4.3c — controlled discrete EN 10217 manufacturer-matrix sample.
--
-- Source: ArcelorMittal Tubular Products Europe EN 10217 public product-range matrix.
-- This migration promotes only a small set of visually verified matrix cells.
-- It does NOT claim normative completeness and does NOT infer every point inside
-- the previously stored range envelope.
--
-- Weight semantics:
--   * the source matrix proves manufacturer availability/process for OD x wall;
--   * kg/m below is CALCULATED, not published by the matrix;
--   * formula_version = round-annulus-density-7850-v1;
--   * calculated weights are non-canonical reference values.

insert into public.steel_standards (
  id, code, title, short_explanation, scope_summary, issuing_body, edition,
  status, knowledge_source_id, source_locator, metadata, standard_series_id,
  standard_system, part_number, application_category, manufacturing_processes,
  dimensional_basis
) values (
  '10217000-0000-4000-8000-000000000190'::uuid,
  'EN 10217',
  'EN 10217 — welded pressure tubes manufacturer reference',
  'Commercial manufacturer-range umbrella for discrete EN 10217 matrix cells; normative parts remain separate.',
  'Used only to attach source-backed ArcelorMittal product-range geometries without assigning a matrix cell to a specific EN 10217 part or grade.',
  'CEN; manufacturer range via ArcelorMittal',
  'manufacturer-reference umbrella; normative parts tracked separately',
  'active',
  '10217000-0000-4000-8000-000000000020'::uuid,
  jsonb_build_object('page',1,'section','Dimensions matrix'),
  jsonb_build_object(
    'dataset_role','manufacturer_range_umbrella',
    'not_normative_complete',true,
    'no_part_specific_inference',true
  ),
  '10217000-0000-4000-8000-000000000100'::uuid,
  'EN', null, 'pressure_tubes',
  array['welded','hot_stretch_reduced','cold_formed']::text[],
  'metric_od_t'
)
on conflict do nothing;

insert into public.steel_standard_product_families (
  standard_id, product_family, notes, metadata
)
select id, 'round_tube',
       'Discrete manufacturer-matrix cells only; not a complete EN 10217 dimensional table.',
       jsonb_build_object('manufacturer_matrix_sample',true,'not_normative_complete',true)
from public.steel_standards
where code_key=public.canonical_steel_token('EN 10217')
  and status='active'
on conflict do nothing;

create temporary table sk43c_en10217_cells (
  outer_diameter_mm numeric not null,
  thickness_mm numeric not null,
  manufacturing_process text not null
) on commit preserve rows;

insert into sk43c_en10217_cells (
  outer_diameter_mm, thickness_mm, manufacturing_process
) values
  (17.2,  1.8, 'hot_stretch_reduced'),
  (60.3,  4.5, 'hot_stretch_reduced'),
  (82.5,  4.5, 'hot_stretch_reduced'),
  (114.3, 8.0, 'hot_stretch_reduced'),
  (165.1, 8.0, 'hot_stretch_reduced'),
  (193.7, 4.0, 'cold_formed'),
  (193.7, 6.3, 'cold_formed'),
  (219.1, 4.0, 'cold_formed'),
  (219.1, 6.3, 'cold_formed'),
  (219.1, 8.0, 'cold_formed');

insert into public.steel_geometries (
  product_family, outer_diameter_mm, thickness_mm, metadata
)
select
  'round_tube', c.outer_diameter_mm, c.thickness_mm,
  jsonb_build_object(
    'seed','sk4.3c-en10217-discrete-matrix',
    'source_class','manufacturer_product_range'
  )
from sk43c_en10217_cells c
on conflict (geometry_key) do nothing;

with std as (
  select id
  from public.steel_standards
  where code_key=public.canonical_steel_token('EN 10217')
    and status='active'
  limit 1
)
insert into public.steel_standard_dimension_applicability (
  standard_id, geometry_id, dimensional_system_id, manufacturing_process,
  applicability_type, is_normative_complete, notes, knowledge_source_id,
  source_locator, metadata
)
select
  std.id,
  g.id,
  'a1100000-0000-4000-8000-000000000001'::uuid,
  c.manufacturing_process,
  'manufacturer_range',
  false,
  'Visually verified discrete cell from the ArcelorMittal EN 10217 product-range matrix.',
  '10217000-0000-4000-8000-000000000020'::uuid,
  jsonb_build_object(
    'page',1,
    'section','Dimensions matrix',
    'legend_process',c.manufacturing_process
  ),
  jsonb_build_object(
    'seed','sk4.3c-en10217-discrete-matrix',
    'matrix_cell_verified',true,
    'not_normative_complete',true,
    'no_part_specific_inference',true
  )
from sk43c_en10217_cells c
join public.steel_geometries g
  on g.geometry_key='round|od='||public.canonical_mm_value(c.outer_diameter_mm)
    ||'|t='||public.canonical_mm_value(c.thickness_mm)
cross join std
on conflict do nothing;

insert into public.steel_weight_references (
  geometry_id, weight_kg_m, weight_method, density_kg_m3, formula_version,
  is_canonical, knowledge_source_id, source_locator, metadata
)
select
  g.id,
  round((pi()/4 * (
    power(g.outer_diameter_mm,2)
    - power(g.outer_diameter_mm - 2*g.thickness_mm,2)
  ) * 1e-6 * 7850)::numeric, 4),
  'calculated',
  7850,
  'round-annulus-density-7850-v1',
  false,
  '10217000-0000-4000-8000-000000000020'::uuid,
  jsonb_build_object(
    'page',1,
    'section','Dimensions matrix',
    'formula','pi/4*(D^2-(D-2t)^2)*1e-6*density'
  ),
  jsonb_build_object(
    'seed','sk4.3c-en10217-discrete-matrix',
    'dataset_scope','manufacturer_product_range',
    'matrix_cell_verified',true,
    'not_published_mass',true,
    'not_normative_complete',true,
    'price_safe_reference',true
  )
from sk43c_en10217_cells c
join public.steel_geometries g
  on g.geometry_key='round|od='||public.canonical_mm_value(c.outer_diameter_mm)
    ||'|t='||public.canonical_mm_value(c.thickness_mm)
on conflict do nothing;

-- Backwards-compatible projection for the existing SK4 read/calculator RPC.
with std as (
  select id
  from public.steel_standards
  where code_key=public.canonical_steel_token('EN 10217')
    and status='active'
  limit 1
)
insert into public.steel_dimensional_rows (
  standard_id, product_family, outer_diameter_mm, thickness_mm,
  theoretical_weight_kg_m, weight_method, weight_formula_version,
  knowledge_source_id, source_locator, metadata, geometry_id
)
select
  std.id,
  'round_tube',
  c.outer_diameter_mm,
  c.thickness_mm,
  round((pi()/4 * (
    power(c.outer_diameter_mm,2)
    - power(c.outer_diameter_mm - 2*c.thickness_mm,2)
  ) * 1e-6 * 7850)::numeric, 4),
  'calculated',
  'round-annulus-density-7850-v1',
  '10217000-0000-4000-8000-000000000020'::uuid,
  jsonb_build_object(
    'page',1,
    'section','Dimensions matrix',
    'legend_process',c.manufacturing_process
  ),
  jsonb_build_object(
    'dataset_scope','manufacturer_product_range',
    'projection_of_reference_v2',true,
    'matrix_cell_verified',true,
    'manufacturing_process',c.manufacturing_process,
    'not_published_mass',true,
    'not_normative_complete',true
  ),
  g.id
from sk43c_en10217_cells c
join public.steel_geometries g
  on g.geometry_key='round|od='||public.canonical_mm_value(c.outer_diameter_mm)
    ||'|t='||public.canonical_mm_value(c.thickness_mm)
cross join std
on conflict do nothing;

with std as (
  select id
  from public.steel_standards
  where code_key=public.canonical_steel_token('EN 10217')
    and status='active'
  limit 1
)
insert into public.steel_reference_observations (
  knowledge_source_id, source_locator, observation_type,
  observed_standard_code, observed_product_family,
  normalized_standard_id, normalized_geometry_id,
  raw_payload, content_checksum, promotion_status, reviewed_at, metadata
)
select
  '10217000-0000-4000-8000-000000000020'::uuid,
  jsonb_build_object('page',1,'section','Dimensions matrix'),
  'dimension',
  'EN 10217',
  'round_tube',
  std.id,
  g.id,
  jsonb_build_object(
    'outer_diameter_mm',c.outer_diameter_mm,
    'thickness_mm',c.thickness_mm,
    'manufacturing_process',c.manufacturing_process,
    'weight_semantic','calculated_separately'
  ),
  md5(concat_ws('|','EN10217',c.outer_diameter_mm::text,c.thickness_mm::text,c.manufacturing_process,'arcelormittal-matrix')),
  'promoted',
  now(),
  jsonb_build_object(
    'seed','sk4.3c-en10217-discrete-matrix',
    'human_visual_reviewed_seed',true,
    'not_normative_complete',true
  )
from sk43c_en10217_cells c
join public.steel_geometries g
  on g.geometry_key='round|od='||public.canonical_mm_value(c.outer_diameter_mm)
    ||'|t='||public.canonical_mm_value(c.thickness_mm)
cross join std
on conflict do nothing;

drop table sk43c_en10217_cells;
