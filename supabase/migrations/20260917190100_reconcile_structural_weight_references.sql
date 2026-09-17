-- P1.15 / SK4.2 — reconcile EN 10219 published weights after geometry promotion.
--
-- The initial structural seed creates canonical geometries and weight references in
-- one data-modifying CTE statement. PostgreSQL executes sibling CTEs from the same
-- snapshot, so geometries created by that statement are not visible to its weight
-- SELECT unless they already existed. At this point the legacy dimensional projection
-- is fully populated and linked to canonical geometry, so promote those source-backed
-- published masses deterministically.

insert into public.steel_weight_references (
  geometry_id,
  weight_kg_m,
  weight_method,
  is_canonical,
  knowledge_source_id,
  source_document_id,
  source_locator,
  metadata
)
select
  d.geometry_id,
  d.theoretical_weight_kg_m,
  'published',
  true,
  d.knowledge_source_id,
  d.source_document_id,
  d.source_locator,
  coalesce(d.metadata, '{}'::jsonb) || jsonb_build_object(
    'dataset_scope', 'manufacturer_product_range',
    'not_normative_complete', true,
    'seed', 'sk4.2-en10219',
    'reconciled_by', 'sk4.2-weight-reference-visibility-fix'
  )
from public.steel_dimensional_rows d
join public.steel_standards s on s.id = d.standard_id
where s.code_key = public.canonical_steel_token('EN 10219')
  and d.geometry_id is not null
  and d.theoretical_weight_kg_m is not null
  and d.weight_method = 'published'
  and d.knowledge_source_id in (
    '10219000-0000-4000-8000-000000000010'::uuid,
    '10219000-0000-4000-8000-000000000011'::uuid
  )
  and d.metadata->>'dataset_scope' = 'manufacturer_product_range'
on conflict do nothing;
