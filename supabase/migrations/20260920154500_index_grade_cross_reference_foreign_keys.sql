-- P1.15 / SK4.5k hardening — cover grade cross-reference foreign keys.

create index steel_grade_cross_references_to_grade_idx
  on public.steel_grade_cross_references (to_material_grade_id);

create index steel_grade_cross_references_knowledge_source_idx
  on public.steel_grade_cross_references (knowledge_source_id)
  where knowledge_source_id is not null;

create index steel_grade_cross_references_source_document_source_idx
  on public.steel_grade_cross_references (
    source_document_id,
    knowledge_source_id
  )
  where source_document_id is not null;
