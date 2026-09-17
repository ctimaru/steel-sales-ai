-- P1.15 / SK4.2 — reconcile EN 10210 hot-finished SHS applicability.
--
-- Some square geometries in the EN 10210 manufacturer range already exist in the
-- canonical geometry table because the same physical section was seeded earlier
-- for EN 10219. Canonical geometry deduplication is intentional; applicability
-- must therefore be linked by geometry identity rather than by seed ownership.

with hot_shs(side_mm, thickness_mm) as (
  values
    (100::numeric,5::numeric),(100,6),(100,8),(100,10),
    (120,5),(120,6),(120,8),(120,10),
    (150,5),(150,6),(150,8),(150,10),
    (200,5),(200,6),(200,8),(200,10)
), std as (
  select id
  from public.steel_standards
  where code_key = public.canonical_steel_token('EN 10210')
    and status = 'active'
  limit 1
), matched as (
  select g.id as geometry_id
  from hot_shs h
  join public.steel_geometries g
    on g.product_family = 'square_tube'
   and g.width_mm = h.side_mm
   and g.height_mm = h.side_mm
   and g.thickness_mm = h.thickness_mm
)
insert into public.steel_standard_dimension_applicability (
  standard_id,
  geometry_id,
  dimensional_system_id,
  manufacturing_process,
  applicability_type,
  is_normative_complete,
  knowledge_source_id,
  source_locator,
  metadata
)
select
  std.id,
  matched.geometry_id,
  'a1100000-0000-4000-8000-000000000002'::uuid,
  'hot_finished',
  'manufacturer_range',
  false,
  '10210000-0000-4000-8000-000000000010'::uuid,
  jsonb_build_object('page','ArcelorMittal Distribution HOT range'),
  jsonb_build_object(
    'seed','sk4.2-en10210',
    'weight_status','published_weight_pending',
    'canonical_geometry_reuse',true
  )
from matched
cross join std
on conflict do nothing;
