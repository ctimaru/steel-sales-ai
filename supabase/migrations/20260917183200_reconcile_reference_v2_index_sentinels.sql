-- P1.15 / SK4.1 — deterministic reconciliation for nullable-key sentinels.
-- Recreates v2 unique indexes with the canonical nil UUID sentinel used by the
-- repository migration contract. This is schema-only and does not mutate data.

drop index if exists public.steel_standard_dimension_applicability_uq;
create unique index steel_standard_dimension_applicability_uq
  on public.steel_standard_dimension_applicability (
    standard_id,
    geometry_id,
    coalesce(material_grade_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(dimensional_system_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(public.canonical_steel_token(manufacturing_process), ''),
    applicability_type,
    coalesce(knowledge_source_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

drop index if exists public.steel_weight_references_source_uq;
create unique index steel_weight_references_source_uq
  on public.steel_weight_references (
    geometry_id,
    coalesce(material_grade_id, '00000000-0000-0000-0000-000000000000'::uuid),
    weight_method,
    weight_kg_m,
    coalesce(knowledge_source_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(formula_version, '')
  );

drop index if exists public.steel_grade_cross_references_uq;
create unique index steel_grade_cross_references_uq
  on public.steel_grade_cross_references (
    from_material_grade_id,
    to_material_grade_id,
    relation_type,
    coalesce(knowledge_source_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
