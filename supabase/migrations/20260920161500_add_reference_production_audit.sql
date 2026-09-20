-- P1.15 / SK4.6a — production coverage audit & end-to-end readiness contract.
--
-- This layer does not promote or mutate reference data. It exposes:
--   * structural integrity / provenance / access-control health;
--   * effective-weight contract consistency;
--   * explicit catalog coverage gaps (including missing canonical scopes);
--   * a scoped SK5 readiness signal that distinguishes "safe to consume"
--     from "catalog complete".

create or replace function public.p1_shared_steel_reference_coverage_audit()
returns table (
  audit_key text,
  category text,
  status text,
  severity text,
  observed_value numeric,
  target_value numeric,
  details jsonb
)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
with
standard_stats as (
  select
    count(*)::numeric as total,
    count(*) filter (where knowledge_source_id is null)::numeric as missing_source,
    count(*) filter (where standard_series_id is null)::numeric as missing_series
  from public.steel_standards
),
grade_stats as (
  select
    count(*)::numeric as total,
    count(*) filter (where material_number is null)::numeric as missing_material_number,
    count(*) filter (where knowledge_source_id is null)::numeric as missing_source
  from public.steel_material_grades
),
geometry_stats as (
  select count(*)::numeric as total
  from public.steel_geometries
),
weight_scope_stats as (
  select
    count(*)::numeric as total_scopes,
    count(*) filter (where canonical_count=1)::numeric as canonical_scopes,
    count(*) filter (where canonical_count=0)::numeric as missing_canonical_scopes,
    count(*) filter (where canonical_count>1)::numeric as duplicate_canonical_scopes,
    count(*) filter (
      where canonical_count=0
        and published_count=0
        and calculated_count>0
        and verified_count=0
    )::numeric as missing_calculated_only,
    count(*) filter (
      where canonical_count=0
        and published_count>0
        and calculated_count=0
        and verified_count=0
    )::numeric as missing_published_only,
    count(*) filter (
      where canonical_count=0
        and published_count>0
        and calculated_count>0
        and verified_count=0
    )::numeric as missing_published_plus_calculated,
    count(*) filter (
      where canonical_count=0 and verified_count>0
    )::numeric as missing_with_verified
  from (
    select
      geometry_id,
      material_grade_id,
      count(*) filter (where is_canonical) as canonical_count,
      count(*) filter (where weight_method='published') as published_count,
      count(*) filter (where weight_method='calculated') as calculated_count,
      count(*) filter (where weight_method='verified') as verified_count
    from public.steel_weight_references
    group by geometry_id,material_grade_id
  ) s
),
dimension_stats as (
  select
    count(*)::numeric as total,
    count(*) filter (where is_normative_complete)::numeric as normative_complete,
    count(*) filter (where not is_normative_complete)::numeric as partial_or_source_scoped
  from public.steel_standard_dimension_applicability
),
integrity_stats as (
  select
    (
      (select count(*) from public.steel_standard_grade_applicability ga
       left join public.steel_standards s on s.id=ga.standard_id
       where s.id is null)
      +
      (select count(*) from public.steel_standard_grade_applicability ga
       left join public.steel_material_grades g on g.id=ga.material_grade_id
       where g.id is null)
      +
      (select count(*) from public.steel_standard_dimension_applicability da
       left join public.steel_standards s on s.id=da.standard_id
       where s.id is null)
      +
      (select count(*) from public.steel_standard_dimension_applicability da
       left join public.steel_geometries g on g.id=da.geometry_id
       where g.id is null)
      +
      (select count(*) from public.steel_weight_references w
       left join public.steel_geometries g on g.id=w.geometry_id
       where g.id is null)
      +
      (select count(*) from public.steel_weight_references w
       left join public.steel_material_grades g on g.id=w.material_grade_id
       where w.material_grade_id is not null and g.id is null)
    )::numeric as orphan_count,
    (
      (select count(*) from (
        select geometry_key
        from public.steel_geometries
        group by geometry_key
        having count(*)>1
      ) d)
      +
      (select count(*) from (
        select standard_system_key,designation_key,material_number_key
        from public.steel_material_grades
        group by standard_system_key,designation_key,material_number_key
        having count(*)>1
      ) d)
    )::numeric as duplicate_identity_count
),
access_stats as (
  select count(*)::numeric as violation_count
  from (
    select
      c.relname,
      c.relrowsecurity,
      has_table_privilege(
        'authenticated',
        format('public.%I',c.relname),
        'SELECT'
      ) as authenticated_can_read,
      has_table_privilege(
        'anon',
        format('public.%I',c.relname),
        'SELECT'
      ) as anon_can_read
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname in (
        'steel_standards',
        'steel_material_grades',
        'steel_geometries',
        'steel_standard_grade_applicability',
        'steel_standard_dimension_applicability',
        'steel_weight_references',
        'steel_grade_cross_references'
      )
  ) x
  where not relrowsecurity
     or not authenticated_can_read
     or anon_can_read
),
effective_catalog as (
  select *
  from public.p1_shared_steel_effective_weight_catalog(null,1000,0)
),
effective_stats as (
  select
    count(*)::numeric as catalog_scope_count,
    count(*) filter (
      where effective_status='canonical_missing'
        and (
          calculation_allowed
          or effective_reference_id is not null
          or effective_weight_kg_m is not null
        )
    )::numeric as unsafe_missing_scope_count,
    count(*) filter (
      where effective_status='canonical_available'
        and (
          not calculation_allowed
          or effective_reference_id is null
          or effective_weight_kg_m is null
        )
    )::numeric as invalid_available_scope_count
  from effective_catalog
),
system_stats as (
  select
    count(distinct standard_system)::numeric as system_count,
    coalesce(
      jsonb_agg(distinct standard_system order by standard_system),
      '[]'::jsonb
    ) as systems
  from public.steel_standards
),
crossref_stats as (
  select count(*)::numeric as total
  from public.steel_grade_cross_references
)
select
  'referential_integrity',
  'integrity',
  case when i.orphan_count=0 then 'pass' else 'fail' end,
  'blocker',
  i.orphan_count,
  0::numeric,
  jsonb_build_object('meaning','orphan foreign-key references across core reference tables')
from integrity_stats i

union all
select
  'identity_uniqueness',
  'integrity',
  case when i.duplicate_identity_count=0 then 'pass' else 'fail' end,
  'blocker',
  i.duplicate_identity_count,
  0::numeric,
  jsonb_build_object('meaning','duplicate geometry keys + duplicate canonical grade identities')
from integrity_stats i

union all
select
  'canonical_scope_uniqueness',
  'effective_weight',
  case when w.duplicate_canonical_scopes=0 then 'pass' else 'fail' end,
  'blocker',
  w.duplicate_canonical_scopes,
  0::numeric,
  jsonb_build_object('meaning','scopes with more than one canonical weight')
from weight_scope_stats w

union all
select
  'effective_catalog_scope_consistency',
  'effective_weight',
  case when e.catalog_scope_count=w.total_scopes then 'pass' else 'fail' end,
  'blocker',
  e.catalog_scope_count,
  w.total_scopes,
  jsonb_build_object('meaning','effective-weight catalog must expose every stored geometry+grade weight scope')
from effective_stats e cross join weight_scope_stats w

union all
select
  'unsafe_missing_canonical_fallback',
  'effective_weight',
  case when e.unsafe_missing_scope_count=0 then 'pass' else 'fail' end,
  'blocker',
  e.unsafe_missing_scope_count,
  0::numeric,
  jsonb_build_object('meaning','canonical_missing scopes must never expose an effective weight or allow calculation')
from effective_stats e

union all
select
  'invalid_available_canonical_contract',
  'effective_weight',
  case when e.invalid_available_scope_count=0 then 'pass' else 'fail' end,
  'blocker',
  e.invalid_available_scope_count,
  0::numeric,
  jsonb_build_object('meaning','canonical_available scopes must expose reference+kg/m and allow calculation')
from effective_stats e

union all
select
  'shared_reference_access_contract',
  'security',
  case when a.violation_count=0 then 'pass' else 'fail' end,
  'blocker',
  a.violation_count,
  0::numeric,
  jsonb_build_object(
    'meaning',
    'core shared reference tables require RLS, authenticated SELECT and no anon SELECT'
  )
from access_stats a

union all
select
  'standards_without_provenance',
  'provenance',
  case when s.missing_source=0 then 'pass' else 'fail' end,
  'blocker',
  s.missing_source,
  0::numeric,
  jsonb_build_object('standards_total',s.total)
from standard_stats s

union all
select
  'grades_without_provenance',
  'provenance',
  case when g.missing_source=0 then 'pass' else 'fail' end,
  'blocker',
  g.missing_source,
  0::numeric,
  jsonb_build_object('grades_total',g.total)
from grade_stats g

union all
select
  'grades_without_material_number',
  'coverage',
  case when g.missing_material_number=0 then 'pass' else 'warning' end,
  'warning',
  g.missing_material_number,
  0::numeric,
  jsonb_build_object('grades_total',g.total)
from grade_stats g

union all
select
  'missing_canonical_scopes',
  'coverage',
  case when w.missing_canonical_scopes=0 then 'pass' else 'warning' end,
  'warning',
  w.missing_canonical_scopes,
  0::numeric,
  jsonb_build_object(
    'total_scopes',w.total_scopes,
    'canonical_scopes',w.canonical_scopes,
    'calculated_only',w.missing_calculated_only,
    'published_only',w.missing_published_only,
    'published_plus_calculated',w.missing_published_plus_calculated,
    'with_verified',w.missing_with_verified
  )
from weight_scope_stats w

union all
select
  'normative_complete_dimension_rows',
  'coverage',
  case when d.normative_complete>0 then 'pass' else 'warning' end,
  'warning',
  d.normative_complete,
  null::numeric,
  jsonb_build_object(
    'dimension_applicability_total',d.total,
    'source_scoped_or_partial_rows',d.partial_or_source_scoped,
    'meaning','zero is acceptable for source-scoped datasets but proves catalog is not normatively complete'
  )
from dimension_stats d

union all
select
  'standard_system_coverage',
  'coverage',
  case when ss.system_count>1 then 'pass' else 'warning' end,
  'warning',
  ss.system_count,
  null::numeric,
  jsonb_build_object(
    'systems',ss.systems,
    'meaning','current catalog breadth by standards system; one system means catalog remains geographically/standards-family partial'
  )
from system_stats ss

union all
select
  'grade_cross_reference_population',
  'coverage',
  case when c.total>0 then 'pass' else 'warning' end,
  'warning',
  c.total,
  null::numeric,
  jsonb_build_object(
    'meaning','policy is live but no real grade cross-reference has yet been promoted'
  )
from crossref_stats c

union all
select
  'production_volume_snapshot',
  'inventory',
  'info',
  'info',
  s.total,
  null::numeric,
  jsonb_build_object(
    'standards',s.total,
    'grades',g.total,
    'geometries',geo.total,
    'weight_scopes',w.total_scopes,
    'canonical_scopes',w.canonical_scopes
  )
from standard_stats s
cross join grade_stats g
cross join geometry_stats geo
cross join weight_scope_stats w
$$;

comment on function public.p1_shared_steel_reference_coverage_audit() is
  'SK4.6a production audit: integrity, provenance, RLS/access, effective-weight safety and explicit catalog coverage gaps. Read-only.';

revoke all on function public.p1_shared_steel_reference_coverage_audit()
  from public,anon;

grant execute on function public.p1_shared_steel_reference_coverage_audit()
  to authenticated,service_role;

create or replace function public.p1_shared_steel_reference_production_readiness()
returns table (
  production_contract_ready boolean,
  catalog_coverage_complete boolean,
  sk5_gate_status text,
  blocker_count integer,
  warning_count integer,
  standards_count integer,
  grades_count integer,
  geometries_count integer,
  weight_scope_count integer,
  canonical_scope_count integer,
  missing_canonical_scope_count integer,
  standard_systems text[],
  assessed_at timestamptz
)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
with audit as (
  select * from public.p1_shared_steel_reference_coverage_audit()
),
counts as (
  select
    count(*) filter (
      where severity='blocker' and status='fail'
    )::integer as blockers,
    count(*) filter (
      where severity='warning' and status='warning'
    )::integer as warnings
  from audit
),
inventory as (
  select
    (select count(*) from public.steel_standards)::integer as standards,
    (select count(*) from public.steel_material_grades)::integer as grades,
    (select count(*) from public.steel_geometries)::integer as geometries,
    (select count(*) from (
      select geometry_id,material_grade_id
      from public.steel_weight_references
      group by geometry_id,material_grade_id
    ) s)::integer as weight_scopes,
    (select count(*) from (
      select geometry_id,material_grade_id
      from public.steel_weight_references
      where is_canonical
      group by geometry_id,material_grade_id
    ) s)::integer as canonical_scopes,
    (select count(*) from (
      select geometry_id,material_grade_id
      from public.steel_weight_references
      group by geometry_id,material_grade_id
      having count(*) filter (where is_canonical)=0
    ) s)::integer as missing_canonical_scopes,
    coalesce(
      (select array_agg(distinct standard_system order by standard_system)
       from public.steel_standards),
      array[]::text[]
    ) as systems
),
coverage as (
  select
    (
      i.missing_canonical_scopes=0
      and cardinality(i.systems)>1
      and exists (
        select 1
        from public.steel_standard_dimension_applicability
        where is_normative_complete
      )
      and exists (
        select 1 from public.steel_grade_cross_references
      )
    ) as complete
  from inventory i
)
select
  c.blockers=0,
  cv.complete,
  case
    when c.blockers>0 then 'blocked'
    when cv.complete then 'ready_full_catalog'
    else 'ready_scoped_partial_catalog'
  end,
  c.blockers,
  c.warnings,
  i.standards,
  i.grades,
  i.geometries,
  i.weight_scopes,
  i.canonical_scopes,
  i.missing_canonical_scopes,
  i.systems,
  now()
from counts c
cross join inventory i
cross join coverage cv
$$;

comment on function public.p1_shared_steel_reference_production_readiness() is
  'SK4.6a readiness summary. ready_scoped_partial_catalog means the production contract is safe for supported scopes while catalog breadth/completeness gaps remain explicit.';

revoke all on function public.p1_shared_steel_reference_production_readiness()
  from public,anon;

grant execute on function public.p1_shared_steel_reference_production_readiness()
  to authenticated,service_role;

-- Acceptance: audit must be self-consistent, read-only and preserve the safe
-- canonical-missing behavior established by SK4.5j.
do $$
declare
  v_before_refs bigint;
  v_after_refs bigint;
  v_before_canonical bigint;
  v_after_canonical bigint;
  v_readiness record;
  v_missing record;
begin
  select count(*),count(*) filter (where is_canonical)
  into v_before_refs,v_before_canonical
  from public.steel_weight_references;

  select * into v_readiness
  from public.p1_shared_steel_reference_production_readiness();

  if v_readiness.blocker_count<>0
     or not v_readiness.production_contract_ready then
    raise exception
      'SK4.6a baseline production contract unexpectedly contains a blocker';
  end if;

  if not exists (
    select 1
    from public.p1_shared_steel_reference_coverage_audit()
    where audit_key='referential_integrity'
      and status='pass'
  ) then
    raise exception 'SK4.6a referential-integrity audit regression';
  end if;

  if not exists (
    select 1
    from public.p1_shared_steel_reference_coverage_audit()
    where audit_key='shared_reference_access_contract'
      and status='pass'
  ) then
    raise exception 'SK4.6a shared-reference access audit regression';
  end if;

  select * into v_missing
  from public.p1_shared_steel_effective_weight_catalog(
    'canonical_missing',1000,0
  )
  limit 1;

  if found and (
    v_missing.calculation_allowed
    or v_missing.effective_reference_id is not null
    or v_missing.effective_weight_kg_m is not null
  ) then
    raise exception
      'SK4.6a end-to-end QA found unsafe canonical_missing fallback';
  end if;

  if has_function_privilege(
       'anon',
       'public.p1_shared_steel_reference_coverage_audit()',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.p1_shared_steel_reference_production_readiness()',
       'EXECUTE'
     ) then
    raise exception 'SK4.6a audit RPCs must not be anon executable';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.p1_shared_steel_reference_coverage_audit()',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.p1_shared_steel_reference_production_readiness()',
       'EXECUTE'
     ) then
    raise exception 'SK4.6a authenticated audit RPC privilege missing';
  end if;

  select count(*),count(*) filter (where is_canonical)
  into v_after_refs,v_after_canonical
  from public.steel_weight_references;

  if v_after_refs<>v_before_refs
     or v_after_canonical<>v_before_canonical then
    raise exception 'SK4.6a read-only audit mutated weight reference state';
  end if;
end
$$;
