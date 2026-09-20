-- P1.15 / SK4.4c — expand controlled U. S. Steel NPS / Schedule sample.
--
-- Source: U. S. Steel Standard & Line Pipe Catalog, Pipe Tables.
-- Public manufacturer product-table facts only; no ASME normative table copied.
--
-- NPS 8: Sch 60, 80/XS, 100
-- NPS 10: Sch 20, 40/STD, 140/XXS
-- NPS 12: STD, Sch 60, Sch 100
--
-- Original inch / lb-ft values remain in metadata. Metric values are normalized
-- using 25.4 mm/in and 1.48816394357 kg/m per lb/ft, rounded as documented.
-- DN remains null because this manufacturer source does not provide DN mapping.

with rows(
  nps, od_in, od_mm, schedule, class_label,
  wall_in, wall_mm, weight_lb_ft, weight_kg_m, source_page
) as (
  values
    (8.0,  8.625, 219.10, '60',  null, 0.406, 10.31,  35.67,  53.08, 53),
    (8.0,  8.625, 219.10, '80',  'XS', 0.500, 12.70,  43.43,  64.63, 53),
    (8.0,  8.625, 219.10, '100', null, 0.594, 15.09,  51.00,  75.90, 54),
    (10.0,10.750, 273.10, '20',  null, 0.250,  6.35,  28.06,  41.76, 56),
    (10.0,10.750, 273.10, '40',  'STD',0.365,  9.27,  40.52,  60.30, 56),
    (10.0,10.750, 273.10, '140', 'XXS',1.000, 25.40, 104.23, 155.11, 58),
    (12.0,12.750, 323.90, null,  'STD',0.375,  9.53,  49.61,  73.83, 61),
    (12.0,12.750, 323.90, '60',  null, 0.562, 14.27,  73.22, 108.96, 62),
    (12.0,12.750, 323.90, '100', null, 0.844, 21.44, 107.42, 159.86, 63)
)
insert into public.steel_geometries (
  product_family,outer_diameter_mm,thickness_mm,metadata
)
select
  'round_tube',
  r.od_mm,
  r.wall_mm,
  jsonb_build_object(
    'seed','sk4.4c-ussteel-nps-expansion',
    'source_class','manufacturer_product_table',
    'source_od_in',r.od_in,
    'source_wall_in',r.wall_in,
    'metric_normalization','OD rounded to 0.1 mm; wall rounded to 0.01 mm'
  )
from rows r
on conflict (geometry_key) do nothing;

with rows(
  nps, od_in, od_mm, schedule, class_label,
  wall_in, wall_mm, weight_lb_ft, weight_kg_m, source_page
) as (
  values
    (8.0,  8.625, 219.10, '60',  null, 0.406, 10.31,  35.67,  53.08, 53),
    (8.0,  8.625, 219.10, '80',  'XS', 0.500, 12.70,  43.43,  64.63, 53),
    (8.0,  8.625, 219.10, '100', null, 0.594, 15.09,  51.00,  75.90, 54),
    (10.0,10.750, 273.10, '20',  null, 0.250,  6.35,  28.06,  41.76, 56),
    (10.0,10.750, 273.10, '40',  'STD',0.365,  9.27,  40.52,  60.30, 56),
    (10.0,10.750, 273.10, '140', 'XXS',1.000, 25.40, 104.23, 155.11, 58),
    (12.0,12.750, 323.90, null,  'STD',0.375,  9.53,  49.61,  73.83, 61),
    (12.0,12.750, 323.90, '60',  null, 0.562, 14.27,  73.22, 108.96, 62),
    (12.0,12.750, 323.90, '100', null, 0.844, 21.44, 107.42, 159.86, 63)
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
  case
    when r.schedule is not null then 'NPS '||trim(to_char(r.nps,'FM999990.###'))||' Sch '||r.schedule
    else 'NPS '||trim(to_char(r.nps,'FM999990.###'))||' '||r.class_label
  end,
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
    'microblock','SK4.4c'
  ))
from rows r
join public.steel_geometries g
  on g.geometry_key=
    'round|od='||public.canonical_mm_value(r.od_mm)
    ||'|t='||public.canonical_mm_value(r.wall_mm)
on conflict do nothing;

with rows(
  nps, od_in, od_mm, schedule, class_label,
  wall_in, wall_mm, weight_lb_ft, weight_kg_m, source_page
) as (
  values
    (8.0,  8.625, 219.10, '60',  null, 0.406, 10.31,  35.67,  53.08, 53),
    (8.0,  8.625, 219.10, '80',  'XS', 0.500, 12.70,  43.43,  64.63, 53),
    (8.0,  8.625, 219.10, '100', null, 0.594, 15.09,  51.00,  75.90, 54),
    (10.0,10.750, 273.10, '20',  null, 0.250,  6.35,  28.06,  41.76, 56),
    (10.0,10.750, 273.10, '40',  'STD',0.365,  9.27,  40.52,  60.30, 56),
    (10.0,10.750, 273.10, '140', 'XXS',1.000, 25.40, 104.23, 155.11, 58),
    (12.0,12.750, 323.90, null,  'STD',0.375,  9.53,  49.61,  73.83, 61),
    (12.0,12.750, 323.90, '60',  null, 0.562, 14.27,  73.22, 108.96, 62),
    (12.0,12.750, 323.90, '100', null, 0.844, 21.44, 107.42, 159.86, 63)
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
    'schedule',r.schedule,
    'class_label',r.class_label
  ),
  jsonb_strip_nulls(jsonb_build_object(
    'dataset_scope','manufacturer_product_table_sample',
    'not_normative_complete',true,
    'source_od_in',r.od_in,
    'source_wall_in',r.wall_in,
    'source_weight_lb_ft',r.weight_lb_ft,
    'class_label',r.class_label,
    'metric_normalization','OD rounded to 0.1 mm; wall and kg/m rounded to 0.01',
    'microblock','SK4.4c'
  ))
from rows r
join public.steel_geometries g
  on g.geometry_key=
    'round|od='||public.canonical_mm_value(r.od_mm)
    ||'|t='||public.canonical_mm_value(r.wall_mm)
on conflict do nothing;

with rows(
  nps, od_in, od_mm, schedule, class_label,
  wall_in, wall_mm, weight_lb_ft, weight_kg_m, source_page
) as (
  values
    (8.0,  8.625, 219.10, '60',  null, 0.406, 10.31,  35.67,  53.08, 53),
    (8.0,  8.625, 219.10, '80',  'XS', 0.500, 12.70,  43.43,  64.63, 53),
    (8.0,  8.625, 219.10, '100', null, 0.594, 15.09,  51.00,  75.90, 54),
    (10.0,10.750, 273.10, '20',  null, 0.250,  6.35,  28.06,  41.76, 56),
    (10.0,10.750, 273.10, '40',  'STD',0.365,  9.27,  40.52,  60.30, 56),
    (10.0,10.750, 273.10, '140', 'XXS',1.000, 25.40, 104.23, 155.11, 58),
    (12.0,12.750, 323.90, null,  'STD',0.375,  9.53,  49.61,  73.83, 61),
    (12.0,12.750, 323.90, '60',  null, 0.562, 14.27,  73.22, 108.96, 62),
    (12.0,12.750, 323.90, '100', null, 0.844, 21.44, 107.42, 159.86, 63)
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
    'schedule',r.schedule,
    'class_label',r.class_label
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
    'microblock','SK4.4c'
  ))
from rows r
join public.steel_geometries g
  on g.geometry_key=
    'round|od='||public.canonical_mm_value(r.od_mm)
    ||'|t='||public.canonical_mm_value(r.wall_mm)
on conflict do nothing;

with rows(
  nps, od_mm, schedule, class_label, wall_mm, weight_kg_m, source_page
) as (
  values
    (8.0,  219.10, '60',  null, 10.31,  53.08, 53),
    (8.0,  219.10, '80',  'XS', 12.70,  64.63, 53),
    (8.0,  219.10, '100', null, 15.09,  75.90, 54),
    (10.0, 273.10, '20',  null,  6.35,  41.76, 56),
    (10.0, 273.10, '40',  'STD', 9.27,  60.30, 56),
    (10.0, 273.10, '140', 'XXS',25.40, 155.11, 58),
    (12.0, 323.90, null,  'STD', 9.53,  73.83, 61),
    (12.0, 323.90, '60',  null, 14.27, 108.96, 62),
    (12.0, 323.90, '100', null, 21.44, 159.86, 63)
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
  jsonb_strip_nulls(jsonb_build_object(
    'dataset_scope','manufacturer_product_table_sample',
    'nps',r.nps,
    'schedule',r.schedule,
    'class_label',r.class_label,
    'not_normative_complete',true,
    'projection_of_reference_v2',true,
    'microblock','SK4.4c'
  )),
  g.id
from rows r
join public.steel_geometries g
  on g.geometry_key=
    'round|od='||public.canonical_mm_value(r.od_mm)
    ||'|t='||public.canonical_mm_value(r.wall_mm)
on conflict do nothing;
