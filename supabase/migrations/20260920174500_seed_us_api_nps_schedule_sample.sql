-- P1.15 / SK4.4b — controlled NPS / Schedule sample from U. S. Steel.
--
-- Source: U. S. Steel Standard & Line Pipe Catalog, Pipe Tables, NPS 6.
-- Public manufacturer facts only. We normalize inch and lb/ft values into the
-- shared metric geometry/weight model while retaining original source values.
--
-- IMPORTANT:
--   * these are manufacturer-published product-table rows, not a copied
--     ASME B36.10 normative table;
--   * DN is deliberately left null because this source labels NPS, not DN;
--   * rows remain non-normative-complete;
--   * published weights remain non-canonical until the existing SK4.5
--     reconciliation / decision / promotion path accepts them.

with rows(
  nps,
  od_in,
  od_mm,
  schedule,
  class_label,
  wall_in,
  wall_mm,
  weight_lb_ft,
  weight_kg_m,
  source_page
) as (
  values
    (6.0,6.625,168.30,'40','STD',0.280,7.11,18.99,28.26,49),
    (6.0,6.625,168.30,'80','XS',0.432,10.97,28.60,42.56,50),
    (6.0,6.625,168.30,'120',null,0.562,14.27,36.43,54.21,50),
    (6.0,6.625,168.30,'160',null,0.719,18.26,45.39,67.55,50)
)
insert into public.steel_geometries (
  product_family,outer_diameter_mm,thickness_mm,metadata
)
select
  'round_tube',
  r.od_mm,
  r.wall_mm,
  jsonb_build_object(
    'seed','sk4.4b-ussteel-nps6',
    'source_class','manufacturer_product_table',
    'source_od_in',r.od_in,
    'source_wall_in',r.wall_in,
    'metric_normalization','rounded_to_0.01_mm'
  )
from rows r
on conflict (geometry_key) do nothing;

with rows(
  nps,
  od_in,
  od_mm,
  schedule,
  class_label,
  wall_in,
  wall_mm,
  weight_lb_ft,
  weight_kg_m,
  source_page
) as (
  values
    (6.0,6.625,168.30,'40','STD',0.280,7.11,18.99,28.26,49),
    (6.0,6.625,168.30,'80','XS',0.432,10.97,28.60,42.56,50),
    (6.0,6.625,168.30,'120',null,0.562,14.27,36.43,54.21,50),
    (6.0,6.625,168.30,'160',null,0.719,18.26,45.39,67.55,50)
)
insert into public.steel_dimension_designations (
  geometry_id,
  dimensional_system_id,
  nominal_designation,
  nps,
  dn,
  schedule,
  metadata
)
select
  g.id,
  'a5440000-0000-4000-8000-000000000201'::uuid,
  'NPS 6 Sch '||r.schedule,
  r.nps,
  null,
  r.schedule,
  jsonb_strip_nulls(jsonb_build_object(
    'source','U. S. Steel Standard & Line Pipe Catalog',
    'source_page',r.source_page,
    'source_od_in',r.od_in,
    'source_wall_in',r.wall_in,
    'class_label',r.class_label,
    'manufacturer_designation_only',true,
    'not_normative_complete',true,
    'not_asme_normative_mapping',true,
    'microblock','SK4.4b'
  ))
from rows r
join public.steel_geometries g
  on g.geometry_key=
    'round|od='||public.canonical_mm_value(r.od_mm)
    ||'|t='||public.canonical_mm_value(r.wall_mm)
on conflict do nothing;

with rows(
  nps,
  od_in,
  od_mm,
  schedule,
  class_label,
  wall_in,
  wall_mm,
  weight_lb_ft,
  weight_kg_m,
  source_page
) as (
  values
    (6.0,6.625,168.30,'40','STD',0.280,7.11,18.99,28.26,49),
    (6.0,6.625,168.30,'80','XS',0.432,10.97,28.60,42.56,50),
    (6.0,6.625,168.30,'120',null,0.562,14.27,36.43,54.21,50),
    (6.0,6.625,168.30,'160',null,0.719,18.26,45.39,67.55,50)
)
insert into public.steel_standard_dimension_applicability (
  standard_id,
  geometry_id,
  material_grade_id,
  dimensional_system_id,
  manufacturing_process,
  applicability_type,
  is_normative_complete,
  knowledge_source_id,
  source_locator,
  metadata
)
select
  'a5440000-0000-4000-8000-000000000101'::uuid,
  g.id,
  null,
  'a5440000-0000-4000-8000-000000000201'::uuid,
  'seamless_or_welded',
  'manufacturer_range',
  false,
  'a5440000-0000-4000-8000-000000000005'::uuid,
  jsonb_build_object(
    'pdf_uri',
    'https://www.ussteel.com/documents/40705/12686766/Standard%2Band%2BLine%2BPipe%2BCatalog.pdf/4eef8247-d217-2e20-0eb3-dd427cf4aa58',
    'section','Pipe Tables',
    'page',r.source_page,
    'nps',r.nps,
    'schedule',r.schedule
  ),
  jsonb_strip_nulls(jsonb_build_object(
    'dataset_scope','manufacturer_product_table_sample',
    'not_normative_complete',true,
    'source_od_in',r.od_in,
    'source_wall_in',r.wall_in,
    'source_weight_lb_ft',r.weight_lb_ft,
    'class_label',r.class_label,
    'metric_normalization','OD rounded to 0.1 mm; wall and kg/m rounded to 0.01',
    'microblock','SK4.4b'
  ))
from rows r
join public.steel_geometries g
  on g.geometry_key=
    'round|od='||public.canonical_mm_value(r.od_mm)
    ||'|t='||public.canonical_mm_value(r.wall_mm)
on conflict do nothing;

with rows(
  nps,
  od_in,
  od_mm,
  schedule,
  class_label,
  wall_in,
  wall_mm,
  weight_lb_ft,
  weight_kg_m,
  source_page
) as (
  values
    (6.0,6.625,168.30,'40','STD',0.280,7.11,18.99,28.26,49),
    (6.0,6.625,168.30,'80','XS',0.432,10.97,28.60,42.56,50),
    (6.0,6.625,168.30,'120',null,0.562,14.27,36.43,54.21,50),
    (6.0,6.625,168.30,'160',null,0.719,18.26,45.39,67.55,50)
)
insert into public.steel_weight_references (
  geometry_id,
  material_grade_id,
  weight_kg_m,
  weight_method,
  density_kg_m3,
  formula_version,
  is_canonical,
  knowledge_source_id,
  source_locator,
  metadata
)
select
  g.id,
  null,
  r.weight_kg_m,
  'published',
  null,
  null,
  false,
  'a5440000-0000-4000-8000-000000000005'::uuid,
  jsonb_build_object(
    'pdf_uri',
    'https://www.ussteel.com/documents/40705/12686766/Standard%2Band%2BLine%2BPipe%2BCatalog.pdf/4eef8247-d217-2e20-0eb3-dd427cf4aa58',
    'section','Pipe Tables',
    'page',r.source_page,
    'nps',r.nps,
    'schedule',r.schedule
  ),
  jsonb_strip_nulls(jsonb_build_object(
    'dataset_scope','manufacturer_product_table_sample',
    'source_unit','lb/ft',
    'source_weight_lb_ft',r.weight_lb_ft,
    'normalized_unit','kg/m',
    'unit_conversion_only',true,
    'normalized_weight_kg_m',r.weight_kg_m,
    'not_normative_complete',true,
    'canonical_auto_promotion_allowed',false,
    'microblock','SK4.4b'
  ))
from rows r
join public.steel_geometries g
  on g.geometry_key=
    'round|od='||public.canonical_mm_value(r.od_mm)
    ||'|t='||public.canonical_mm_value(r.wall_mm)
on conflict do nothing;

-- Preserve the legacy/read projection for the API 5L sample without claiming
-- normative completeness or grade applicability.
with rows(
  nps,
  od_mm,
  schedule,
  wall_mm,
  weight_kg_m,
  source_page
) as (
  values
    (6.0,168.30,'40',7.11,28.26,49),
    (6.0,168.30,'80',10.97,42.56,50),
    (6.0,168.30,'120',14.27,54.21,50),
    (6.0,168.30,'160',18.26,67.55,50)
)
insert into public.steel_dimensional_rows (
  standard_id,
  product_family,
  outer_diameter_mm,
  thickness_mm,
  theoretical_weight_kg_m,
  weight_method,
  knowledge_source_id,
  source_locator,
  metadata,
  geometry_id
)
select
  'a5440000-0000-4000-8000-000000000101'::uuid,
  'round_tube',
  r.od_mm,
  r.wall_mm,
  r.weight_kg_m,
  'published',
  'a5440000-0000-4000-8000-000000000005'::uuid,
  jsonb_build_object('section','Pipe Tables','page',r.source_page),
  jsonb_build_object(
    'dataset_scope','manufacturer_product_table_sample',
    'nps',r.nps,
    'schedule',r.schedule,
    'not_normative_complete',true,
    'projection_of_reference_v2',true,
    'microblock','SK4.4b'
  ),
  g.id
from rows r
join public.steel_geometries g
  on g.geometry_key=
    'round|od='||public.canonical_mm_value(r.od_mm)
    ||'|t='||public.canonical_mm_value(r.wall_mm)
on conflict do nothing;
