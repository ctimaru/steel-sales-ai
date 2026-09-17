-- P1.15 / SK4.3d — controlled EN 10217 discrete matrix tranche 2.
--
-- Source: ArcelorMittal Tubular Products Europe EN 10217 public product-range matrix.
-- Adds only a second small set of visually verified matrix cells.
-- No normative completeness is claimed and no cell is assigned to a concrete EN 10217 part.
--
-- Provenance semantics:
--   * tranche 2 is represented as a review/extraction batch linked to the same primary PDF;
--   * it is explicitly NOT independent corroboration of the parent ArcelorMittal source;
--   * this preserves stable acceptance counts for tranche 1 without pretending a second source exists.
--
-- Weight semantics:
--   * manufacturer matrix proves OD x wall availability / process;
--   * kg/m is CALCULATED, not published by the source;
--   * formula_version = round-annulus-density-7850-v1;
--   * calculated weights are non-canonical reference values.

insert into public.knowledge_sources (
  id, owner_id, access_scope, source_key, source_type, source_class,
  name, provider, source_uri, language_code, trust_score, metadata, organization_id
) values (
  '10217000-0000-4000-8000-000000000023'::uuid,
  null,
  'global',
  'derived:arcelormittal:en10217-product-range:review-batch-2',
  'manufacturer_catalog_review_batch',
  'primary',
  'ArcelorMittal EN 10217 product range — reviewed matrix batch 2',
  'ArcelorMittal',
  'https://constructalia.arcelormittal.com/files/EN%20Welded%20steel%20tubes%20for%20pressure%20purposes--7f7156c483b35d1754278e30839d8133.pdf',
  'en',
  0.95,
  jsonb_build_object(
    'reference_purpose','reviewed_discrete_matrix_batch',
    'parent_source_key','primary:arcelormittal:en10217-product-range',
    'independence_group','arcelormittal-en10217-product-range-pdf',
    'independent_corroboration',false,
    'dataset_scope','manufacturer_product_range',
    'not_normative_complete',true,
    'human_visual_reviewed_seed',true,
    'verified_on','2026-09-17'
  ),
  null
)
on conflict do nothing;

create temporary table sk43d_en10217_cells (
  outer_diameter_mm numeric not null,
  thickness_mm numeric not null,
  manufacturing_process text not null
) on commit preserve rows;

insert into sk43d_en10217_cells (
  outer_diameter_mm, thickness_mm, manufacturing_process
) values
  (21.3, 2.5, 'hot_stretch_reduced'),
  (28.0, 3.6, 'hot_stretch_reduced'),
  (38.0, 4.5, 'hot_stretch_reduced'),
  (70.0, 6.3, 'hot_stretch_reduced'),
  (73.0, 7.1, 'hot_stretch_reduced'),
  (193.7, 5.0, 'cold_formed'),
  (219.1, 4.5, 'cold_formed'),
  (219.1, 5.0, 'cold_formed'),
  (219.1, 5.6, 'cold_formed'),
  (219.1, 7.1, 'cold_formed');

insert into public.steel_geometries (
  product_family, outer_diameter_mm, thickness_mm, metadata
)
select
  'round_tube', c.outer_diameter_mm, c.thickness_mm,
  jsonb_build_object(
    'seed','sk4.3d-en10217-discrete-matrix-2',
    'source_class','manufacturer_product_range'
  )
from sk43d_en10217_cells c
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
  'Visually verified discrete cell from the ArcelorMittal EN 10217 product-range matrix — tranche 2.',
  '10217000-0000-4000-8000-000000000023'::uuid,
  jsonb_build_object(
    'page',1,
    'section','Dimensions matrix',
    'legend_process',c.manufacturing_process,
    'parent_source_key','primary:arcelormittal:en10217-product-range'
  ),
  jsonb_build_object(
    'seed','sk4.3d-en10217-discrete-matrix-2',
    'matrix_cell_verified',true,
    'human_visual_reviewed_seed',true,
    'not_normative_complete',true,
    'no_part_specific_inference',true,
    'independent_corroboration',false
  )
from sk43d_en10217_cells c
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
  '10217000-0000-4000-8000-000000000023'::uuid,
  jsonb_build_object(
    'page',1,
    'section','Dimensions matrix',
    'formula','pi/4*(D^2-(D-2t)^2)*1e-6*density',
    'parent_source_key','primary:arcelormittal:en10217-product-range'
  ),
  jsonb_build_object(
    'seed','sk4.3d-en10217-discrete-matrix-2',
    'dataset_scope','manufacturer_product_range',
    'matrix_cell_verified',true,
    'human_visual_reviewed_seed',true,
    'not_published_mass',true,
    'not_normative_complete',true,
    'price_safe_reference',true,
    'independent_corroboration',false
  )
from sk43d_en10217_cells c
join public.steel_geometries g
  on g.geometry_key='round|od='||public.canonical_mm_value(c.outer_diameter_mm)
    ||'|t='||public.canonical_mm_value(c.thickness_mm)
on conflict do nothing;

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
  '10217000-0000-4000-8000-000000000023'::uuid,
  jsonb_build_object(
    'page',1,
    'section','Dimensions matrix',
    'legend_process',c.manufacturing_process,
    'parent_source_key','primary:arcelormittal:en10217-product-range'
  ),
  jsonb_build_object(
    'dataset_scope','manufacturer_product_range',
    'projection_of_reference_v2',true,
    'seed','sk4.3d-en10217-discrete-matrix-2',
    'matrix_cell_verified',true,
    'manufacturing_process',c.manufacturing_process,
    'not_published_mass',true,
    'not_normative_complete',true,
    'independent_corroboration',false
  ),
  g.id
from sk43d_en10217_cells c
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
  '10217000-0000-4000-8000-000000000023'::uuid,
  jsonb_build_object(
    'page',1,
    'section','Dimensions matrix',
    'parent_source_key','primary:arcelormittal:en10217-product-range'
  ),
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
  md5(concat_ws('|','EN10217',c.outer_diameter_mm::text,c.thickness_mm::text,c.manufacturing_process,'arcelormittal-matrix-tranche2')),
  'promoted',
  now(),
  jsonb_build_object(
    'seed','sk4.3d-en10217-discrete-matrix-2',
    'human_visual_reviewed_seed',true,
    'not_normative_complete',true,
    'independent_corroboration',false
  )
from sk43d_en10217_cells c
join public.steel_geometries g
  on g.geometry_key='round|od='||public.canonical_mm_value(c.outer_diameter_mm)
    ||'|t='||public.canonical_mm_value(c.thickness_mm)
cross join std
on conflict do nothing;

-- Seed-integrity assertions run in CI and production migration execution.
do $$
begin
  if (
    select count(*)
    from public.steel_standard_dimension_applicability a
    where a.knowledge_source_id='10217000-0000-4000-8000-000000000023'::uuid
      and a.metadata->>'seed'='sk4.3d-en10217-discrete-matrix-2'
      and coalesce((a.metadata->>'matrix_cell_verified')::boolean,false)
  ) <> 10 then
    raise exception 'SK4.3d expected exactly 10 promoted matrix cells';
  end if;

  if (
    select count(*)
    from public.steel_standard_dimension_applicability a
    where a.knowledge_source_id='10217000-0000-4000-8000-000000000023'::uuid
      and a.metadata->>'seed'='sk4.3d-en10217-discrete-matrix-2'
      and a.manufacturing_process='hot_stretch_reduced'
  ) <> 5 then
    raise exception 'SK4.3d expected five hot-stretch-reduced cells';
  end if;

  if (
    select count(*)
    from public.steel_standard_dimension_applicability a
    where a.knowledge_source_id='10217000-0000-4000-8000-000000000023'::uuid
      and a.metadata->>'seed'='sk4.3d-en10217-discrete-matrix-2'
      and a.manufacturing_process='cold_formed'
  ) <> 5 then
    raise exception 'SK4.3d expected five cold-formed cells';
  end if;

  if not exists (
    select 1
    from public.steel_weight_references w
    join public.steel_geometries g on g.id=w.geometry_id
    where w.knowledge_source_id='10217000-0000-4000-8000-000000000023'::uuid
      and g.geometry_key='round|od=219.1|t=7.1'
      and w.weight_method='calculated'
      and w.formula_version='round-annulus-density-7850-v1'
      and w.weight_kg_m=37.1205
      and not w.is_canonical
      and coalesce((w.metadata->>'not_published_mass')::boolean,false)
  ) then
    raise exception 'SK4.3d expected 219.1 x 7.1 calculated mass 37.1205 kg/m';
  end if;
end
$$;

drop table sk43d_en10217_cells;
