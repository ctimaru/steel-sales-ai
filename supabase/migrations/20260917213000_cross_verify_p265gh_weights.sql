-- P1.15 / SK4.3f — cross-verify selected EN 10216-2 P265GH weights.
--
-- Purpose:
--   Add an independent dimensional/weight reference for five geometries already
--   present in the MSZ EN 10216-2 P265GH supplier range, then mark only exact
--   geometry + kg/m matches as cross-verified.
--
-- Source semantics:
--   * Metal Service Zwevegem remains the P265GH / EN 10216-2 supplier-range source.
--   * Ferrostaal Piping Supply Catalogue is used only as an independent dimensional
--     and nominal plain-end mass reference (ASME B36.10/B36.19 table).
--   * The archived copy is not treated as current stock availability and is not
--     used to assert P265GH applicability.
--   * No paid normative table is reproduced; only five factual geometry/mass pairs
--     needed for controlled reconciliation are retained.

insert into public.knowledge_sources (
  owner_id, access_scope, source_key, source_type, source_class,
  name, provider, source_uri, language_code, trust_score, metadata, organization_id
) values (
  null,
  'global',
  'secondary:ferrostaal:piping-supply-catalogue-2014-dimensions',
  'archived_supplier_catalog',
  'secondary',
  'Ferrostaal Piping Supply Catalogue — dimensional and kg/m cross-check',
  'Ferrostaal Piping Supply',
  'https://www.slideshare.net/slideshow/ferrostaal-piping-supply-catalogue-49686049/49686049',
  'en',
  0.85,
  jsonb_build_object(
    'reference_purpose','independent_dimensional_weight_crosscheck',
    'original_author','Ferrostaal Piping Supply',
    'publication_date','2014-03',
    'hosting_context','public archived copy on SlideShare',
    'dimensional_basis','ASME B36.10 / ASME B36.19 table',
    'availability_semantic',false,
    'grade_applicability_semantic',false,
    'current_stock_semantic',false,
    'factual_rows_only',true,
    'verified_on','2026-09-17'
  ),
  null
)
on conflict do nothing;

create temporary table sk43f_p265gh_crosscheck (
  outer_diameter_mm numeric not null,
  thickness_mm numeric not null,
  weight_kg_m numeric not null
) on commit preserve rows;

insert into sk43f_p265gh_crosscheck values
  (168.3, 7.11, 28.26),
  (219.1, 8.18, 42.55),
  (273.0, 9.27, 60.31),
  (355.6, 9.53, 81.33),
  (406.4, 9.53, 93.27);

-- Independent grade-neutral published mass references.
-- material_grade_id is deliberately NULL because this source validates geometry/mass,
-- not the P265GH material applicability itself.
with src as (
  select id
  from public.knowledge_sources
  where access_scope='global'
    and source_key='secondary:ferrostaal:piping-supply-catalogue-2014-dimensions'
  limit 1
)
insert into public.steel_weight_references (
  geometry_id, material_grade_id, weight_kg_m, weight_method,
  is_canonical, knowledge_source_id, source_locator, metadata
)
select
  g.id,
  null,
  x.weight_kg_m,
  'published',
  false,
  src.id,
  jsonb_build_object(
    'section','ASME pipe schedule list — dimensions in mm and weights in kg/m',
    'outer_diameter_mm',x.outer_diameter_mm,
    'thickness_mm',x.thickness_mm
  ),
  jsonb_build_object(
    'seed','sk4.3f-p265gh-cross-verification',
    'reference_role','independent_geometry_mass_crosscheck',
    'grade_neutral',true,
    'availability_semantic',false,
    'not_current_stock',true
  )
from sk43f_p265gh_crosscheck x
join public.steel_geometries g
  on g.geometry_key='round|od='||public.canonical_mm_value(x.outer_diameter_mm)
    ||'|t='||public.canonical_mm_value(x.thickness_mm)
cross join src
on conflict do nothing;

-- Mark the MSZ P265GH source rows as cross-verified only when the independent
-- source has the exact same canonical geometry and exact published kg/m.
with
  msz as (
    select id, source_key
    from public.knowledge_sources
    where access_scope='global'
      and source_key='primary:msz:en10216-2-p265gh-dimensions'
    limit 1
  ),
  ferro as (
    select id, source_key
    from public.knowledge_sources
    where access_scope='global'
      and source_key='secondary:ferrostaal:piping-supply-catalogue-2014-dimensions'
    limit 1
  ),
  grade as (
    select id
    from public.steel_material_grades
    where standard_system_key=public.canonical_steel_token('EN')
      and designation_key=public.canonical_steel_token('P265GH')
      and material_number_key=public.canonical_steel_token('1.0425')
    limit 1
  ),
  matches as (
    select msz_wr.id as msz_weight_id
    from public.steel_weight_references msz_wr
    join public.steel_geometries g on g.id=msz_wr.geometry_id
    join sk43f_p265gh_crosscheck x
      on g.geometry_key='round|od='||public.canonical_mm_value(x.outer_diameter_mm)
        ||'|t='||public.canonical_mm_value(x.thickness_mm)
     and msz_wr.weight_kg_m=x.weight_kg_m
    join public.steel_weight_references ferro_wr
      on ferro_wr.geometry_id=msz_wr.geometry_id
     and ferro_wr.material_grade_id is null
     and ferro_wr.weight_method='published'
     and ferro_wr.weight_kg_m=msz_wr.weight_kg_m
    cross join msz
    cross join ferro
    cross join grade
    where msz_wr.material_grade_id=grade.id
      and msz_wr.knowledge_source_id=msz.id
      and msz_wr.weight_method='published'
      and ferro_wr.knowledge_source_id=ferro.id
  )
update public.steel_weight_references wr
set metadata = coalesce(wr.metadata,'{}'::jsonb) || jsonb_build_object(
  'cross_verified',true,
  'cross_verification_basis','two_independent_published_sources_exact_geometry_exact_mass',
  'cross_verification_source_count',2,
  'cross_verification_sources',jsonb_build_array(
    'primary:msz:en10216-2-p265gh-dimensions',
    'secondary:ferrostaal:piping-supply-catalogue-2014-dimensions'
  ),
  'cross_verified_on','2026-09-17'
)
from matches
where wr.id=matches.msz_weight_id;

-- Surface the same confidence signal on the backwards-compatible dimensional rows
-- consumed by the current SK4 RPC, without altering the published weight itself.
with
  msz as (
    select id
    from public.knowledge_sources
    where access_scope='global'
      and source_key='primary:msz:en10216-2-p265gh-dimensions'
    limit 1
  ),
  ferro as (
    select id
    from public.knowledge_sources
    where access_scope='global'
      and source_key='secondary:ferrostaal:piping-supply-catalogue-2014-dimensions'
    limit 1
  )
update public.steel_dimensional_rows d
set metadata = coalesce(d.metadata,'{}'::jsonb) || jsonb_build_object(
  'cross_verified',true,
  'cross_verification_basis','two_independent_published_sources_exact_geometry_exact_mass',
  'cross_verification_source_count',2,
  'cross_verified_on','2026-09-17'
)
from sk43f_p265gh_crosscheck x, msz, ferro
where d.knowledge_source_id=msz.id
  and d.product_family='round_tube'
  and d.outer_diameter_mm=x.outer_diameter_mm
  and d.thickness_mm=x.thickness_mm
  and d.theoretical_weight_kg_m=x.weight_kg_m
  and d.metadata->>'grade'='P265GH'
  and exists (
    select 1
    from public.steel_weight_references fw
    join public.steel_geometries g on g.id=fw.geometry_id
    where fw.knowledge_source_id=ferro.id
      and fw.material_grade_id is null
      and fw.weight_method='published'
      and fw.weight_kg_m=x.weight_kg_m
      and g.geometry_key='round|od='||public.canonical_mm_value(x.outer_diameter_mm)
        ||'|t='||public.canonical_mm_value(x.thickness_mm)
  );

-- Deterministic assertions: exactly five independent references, exactly five
-- cross-verified P265GH rows, exact mass equality, and no change to the 56-row MSZ range.
do $$
declare
  v_count integer;
  v_mismatch integer;
begin
  select count(*) into v_count
  from public.steel_weight_references w
  join public.knowledge_sources s on s.id=w.knowledge_source_id
  where s.source_key='secondary:ferrostaal:piping-supply-catalogue-2014-dimensions'
    and w.weight_method='published'
    and w.material_grade_id is null
    and w.metadata->>'seed'='sk4.3f-p265gh-cross-verification';
  if v_count <> 5 then
    raise exception 'SK4.3f expected 5 independent geometry/mass references, got %', v_count;
  end if;

  select count(*) into v_count
  from public.steel_weight_references w
  join public.knowledge_sources s on s.id=w.knowledge_source_id
  join public.steel_material_grades g on g.id=w.material_grade_id
  where s.source_key='primary:msz:en10216-2-p265gh-dimensions'
    and g.designation_key=public.canonical_steel_token('P265GH')
    and w.weight_method='published'
    and coalesce((w.metadata->>'cross_verified')::boolean,false)
    and w.metadata->>'cross_verification_basis'='two_independent_published_sources_exact_geometry_exact_mass';
  if v_count <> 5 then
    raise exception 'SK4.3f expected exactly 5 cross-verified MSZ P265GH weights, got %', v_count;
  end if;

  select count(*) into v_mismatch
  from public.steel_weight_references m
  join public.knowledge_sources ms on ms.id=m.knowledge_source_id
  join public.steel_weight_references f
    on f.geometry_id=m.geometry_id
   and f.material_grade_id is null
   and f.weight_method='published'
  join public.knowledge_sources fs on fs.id=f.knowledge_source_id
  where ms.source_key='primary:msz:en10216-2-p265gh-dimensions'
    and fs.source_key='secondary:ferrostaal:piping-supply-catalogue-2014-dimensions'
    and coalesce((m.metadata->>'cross_verified')::boolean,false)
    and m.weight_kg_m<>f.weight_kg_m;
  if v_mismatch <> 0 then
    raise exception 'SK4.3f found % cross-verified rows with unequal published masses', v_mismatch;
  end if;

  select count(*) into v_count
  from public.steel_dimensional_rows d
  join public.steel_standards s on s.id=d.standard_id
  where s.code_key=public.canonical_steel_token('EN 10216-2')
    and d.metadata->>'grade'='P265GH'
    and d.knowledge_source_id=(
      select id from public.knowledge_sources
      where source_key='primary:msz:en10216-2-p265gh-dimensions'
      limit 1
    );
  if v_count <> 56 then
    raise exception 'SK4.3f P265GH regression: expected 56 MSZ dimensional rows, got %', v_count;
  end if;
end
$$;

drop table sk43f_p265gh_crosscheck;