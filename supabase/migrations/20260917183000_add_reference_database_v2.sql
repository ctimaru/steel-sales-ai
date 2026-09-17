-- P1.15 / SK4.1 — Reference Database v2.
--
-- Extends Shared Steel Knowledge from a small standard-specific catalog into a
-- normalized technical reference model capable of representing:
--   * multipart EN/API/ASTM/ASME standard families;
--   * canonical material grades and material numbers;
--   * reusable CHS/SHS/RHS geometry independent from standard and supplier;
--   * metric OD×t and nominal NPS/DN/Schedule designation systems;
--   * many-to-many standard/grade/dimension applicability;
--   * multiple published/calculated/verified weight references;
--   * raw source observations and explicit grade cross-reference semantics.
--
-- Existing P1.15 tables and RPCs remain intact for backwards compatibility.

create table public.steel_standard_series (
  id uuid primary key default gen_random_uuid(),
  standard_system text not null,
  standard_system_key text generated always as (
    public.canonical_steel_token(standard_system)
  ) stored,
  code text not null,
  code_key text generated always as (public.canonical_steel_token(code)) stored,
  title text not null,
  issuing_body text,
  application_category text,
  short_explanation text,
  knowledge_source_id uuid references public.knowledge_sources(id) on delete restrict,
  source_document_id uuid,
  source_locator jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (source_document_id, knowledge_source_id)
    references public.knowledge_documents(id, source_id)
    on delete restrict,
  check (standard_system_key is not null),
  check (code_key is not null),
  check (length(btrim(title)) > 0),
  check (source_document_id is null or knowledge_source_id is not null)
);

create unique index steel_standard_series_system_code_uq
  on public.steel_standard_series (standard_system_key, code_key);

create index steel_standard_series_application_idx
  on public.steel_standard_series (application_category, code_key);

alter table public.steel_standards
  add column standard_series_id uuid references public.steel_standard_series(id) on delete restrict,
  add column standard_system text,
  add column part_number text,
  add column application_category text,
  add column manufacturing_processes text[] not null default '{}'::text[],
  add column dimensional_basis text;

create index steel_standards_series_idx
  on public.steel_standards (standard_series_id, status, code_key);

create table public.steel_material_grades (
  id uuid primary key default gen_random_uuid(),
  standard_system text,
  standard_system_key text generated always as (
    coalesce(public.canonical_steel_token(standard_system), '')
  ) stored,
  designation text not null,
  designation_key text generated always as (
    public.canonical_steel_token(designation)
  ) stored,
  material_number text,
  material_number_key text generated always as (
    coalesce(public.canonical_steel_token(material_number), '')
  ) stored,
  material_family text,
  density_kg_m3 numeric check (density_kg_m3 is null or density_kg_m3 > 0),
  short_description text,
  knowledge_source_id uuid references public.knowledge_sources(id) on delete restrict,
  source_document_id uuid,
  source_locator jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (source_document_id, knowledge_source_id)
    references public.knowledge_documents(id, source_id)
    on delete restrict,
  check (designation_key is not null),
  check (source_document_id is null or knowledge_source_id is not null)
);

create unique index steel_material_grades_identity_uq
  on public.steel_material_grades (
    standard_system_key,
    designation_key,
    material_number_key
  );

create index steel_material_grades_material_number_idx
  on public.steel_material_grades (material_number_key)
  where material_number_key <> '';

alter table public.steel_standard_grades
  add column material_grade_id uuid references public.steel_material_grades(id) on delete restrict;

create index steel_standard_grades_material_grade_idx
  on public.steel_standard_grades (standard_id, material_grade_id)
  where material_grade_id is not null;

create table public.steel_standard_grade_applicability (
  id uuid primary key default gen_random_uuid(),
  standard_id uuid not null references public.steel_standards(id) on delete cascade,
  material_grade_id uuid not null references public.steel_material_grades(id) on delete cascade,
  product_family text check (
    product_family is null
    or product_family in ('round_tube', 'square_tube', 'rectangular_tube')
  ),
  manufacturing_process text,
  applicability_type text not null default 'normative'
    check (applicability_type in (
      'normative',
      'official_reference',
      'manufacturer_range',
      'supplier_range',
      'verified_internal'
    )),
  notes text,
  knowledge_source_id uuid references public.knowledge_sources(id) on delete restrict,
  source_document_id uuid,
  source_locator jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (source_document_id, knowledge_source_id)
    references public.knowledge_documents(id, source_id)
    on delete restrict,
  check (source_document_id is null or knowledge_source_id is not null)
);

create unique index steel_standard_grade_applicability_uq
  on public.steel_standard_grade_applicability (
    standard_id,
    material_grade_id,
    coalesce(product_family, ''),
    coalesce(public.canonical_steel_token(manufacturing_process), ''),
    applicability_type,
    coalesce(knowledge_source_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index steel_standard_grade_applicability_grade_idx
  on public.steel_standard_grade_applicability (material_grade_id, standard_id);

create table public.steel_geometries (
  id uuid primary key default gen_random_uuid(),
  product_family text not null
    check (product_family in ('round_tube', 'square_tube', 'rectangular_tube')),
  outer_diameter_mm numeric,
  width_mm numeric,
  height_mm numeric,
  thickness_mm numeric not null check (thickness_mm > 0),
  geometry_key text generated always as (
    case
      when product_family = 'round_tube' then
        'round|od=' || public.canonical_mm_value(outer_diameter_mm)
        || '|t=' || public.canonical_mm_value(thickness_mm)
      when product_family = 'square_tube' then
        'square|' || public.canonical_mm_value(width_mm)
        || 'x' || public.canonical_mm_value(height_mm)
        || '|t=' || public.canonical_mm_value(thickness_mm)
      when product_family = 'rectangular_tube' then
        'rect|' || public.canonical_mm_value(greatest(width_mm, height_mm))
        || 'x' || public.canonical_mm_value(least(width_mm, height_mm))
        || '|t=' || public.canonical_mm_value(thickness_mm)
      else null
    end
  ) stored,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (product_family = 'round_tube'
      and outer_diameter_mm is not null and outer_diameter_mm > 0
      and width_mm is null and height_mm is null)
    or
    (product_family = 'square_tube'
      and outer_diameter_mm is null
      and width_mm is not null and width_mm > 0
      and height_mm is not null and height_mm > 0
      and width_mm = height_mm)
    or
    (product_family = 'rectangular_tube'
      and outer_diameter_mm is null
      and width_mm is not null and width_mm > 0
      and height_mm is not null and height_mm > 0
      and width_mm <> height_mm)
  ),
  check (geometry_key is not null),
  unique (geometry_key)
);

create index steel_geometries_round_idx
  on public.steel_geometries (outer_diameter_mm, thickness_mm)
  where product_family = 'round_tube';

create index steel_geometries_shape_idx
  on public.steel_geometries (product_family, width_mm, height_mm, thickness_mm)
  where product_family in ('square_tube', 'rectangular_tube');

alter table public.steel_dimensional_rows
  add column geometry_id uuid references public.steel_geometries(id) on delete restrict;

create index steel_dimensional_rows_geometry_idx
  on public.steel_dimensional_rows (geometry_id)
  where geometry_id is not null;

create table public.steel_dimensional_systems (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  code_key text generated always as (public.canonical_steel_token(code)) stored,
  title text not null,
  unit_system text not null default 'metric'
    check (unit_system in ('metric', 'inch', 'mixed')),
  issuing_body text,
  standard_id uuid references public.steel_standards(id) on delete set null,
  knowledge_source_id uuid references public.knowledge_sources(id) on delete restrict,
  source_document_id uuid,
  source_locator jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (source_document_id, knowledge_source_id)
    references public.knowledge_documents(id, source_id)
    on delete restrict,
  check (code_key is not null),
  check (length(btrim(title)) > 0),
  check (source_document_id is null or knowledge_source_id is not null),
  unique (code_key)
);

create table public.steel_dimension_designations (
  id uuid primary key default gen_random_uuid(),
  geometry_id uuid not null references public.steel_geometries(id) on delete cascade,
  dimensional_system_id uuid not null references public.steel_dimensional_systems(id) on delete cascade,
  nominal_designation text,
  nps numeric check (nps is null or nps > 0),
  dn integer check (dn is null or dn > 0),
  schedule text,
  schedule_key text generated always as (
    coalesce(public.canonical_steel_token(schedule), '')
  ) stored,
  designation_key text generated always as (
    coalesce(public.canonical_steel_token(nominal_designation), '')
  ) stored,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (
    nominal_designation is not null
    or nps is not null
    or dn is not null
    or schedule is not null
  )
);

create unique index steel_dimension_designations_uq
  on public.steel_dimension_designations (
    geometry_id,
    dimensional_system_id,
    designation_key,
    coalesce(nps, 0),
    coalesce(dn, 0),
    schedule_key
  );

create index steel_dimension_designations_nominal_idx
  on public.steel_dimension_designations (
    dimensional_system_id,
    nps,
    dn,
    schedule_key
  );

create table public.steel_standard_dimension_applicability (
  id uuid primary key default gen_random_uuid(),
  standard_id uuid not null references public.steel_standards(id) on delete cascade,
  geometry_id uuid not null references public.steel_geometries(id) on delete cascade,
  material_grade_id uuid references public.steel_material_grades(id) on delete cascade,
  dimensional_system_id uuid references public.steel_dimensional_systems(id) on delete set null,
  manufacturing_process text,
  applicability_type text not null default 'normative'
    check (applicability_type in (
      'normative',
      'official_reference',
      'manufacturer_range',
      'supplier_range',
      'verified_internal',
      'calculated_reference'
    )),
  is_normative_complete boolean not null default false,
  notes text,
  knowledge_source_id uuid references public.knowledge_sources(id) on delete restrict,
  source_document_id uuid,
  source_locator jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (source_document_id, knowledge_source_id)
    references public.knowledge_documents(id, source_id)
    on delete restrict,
  check (source_document_id is null or knowledge_source_id is not null)
);

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

create index steel_standard_dimension_applicability_lookup_idx
  on public.steel_standard_dimension_applicability (
    standard_id,
    geometry_id,
    material_grade_id
  );

create table public.steel_weight_references (
  id uuid primary key default gen_random_uuid(),
  geometry_id uuid not null references public.steel_geometries(id) on delete cascade,
  material_grade_id uuid references public.steel_material_grades(id) on delete set null,
  weight_kg_m numeric not null check (weight_kg_m > 0),
  weight_method text not null
    check (weight_method in ('published', 'calculated', 'verified')),
  density_kg_m3 numeric check (density_kg_m3 is null or density_kg_m3 > 0),
  formula_version text,
  is_canonical boolean not null default false,
  knowledge_source_id uuid references public.knowledge_sources(id) on delete restrict,
  source_document_id uuid,
  source_locator jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  foreign key (source_document_id, knowledge_source_id)
    references public.knowledge_documents(id, source_id)
    on delete restrict,
  check (weight_method <> 'calculated' or formula_version is not null),
  check (source_document_id is null or knowledge_source_id is not null)
);

create unique index steel_weight_references_source_uq
  on public.steel_weight_references (
    geometry_id,
    coalesce(material_grade_id, '00000000-0000-0000-0000-000000000000'::uuid),
    weight_method,
    weight_kg_m,
    coalesce(knowledge_source_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(formula_version, '')
  );

create index steel_weight_references_geometry_idx
  on public.steel_weight_references (
    geometry_id,
    material_grade_id,
    is_canonical,
    weight_method
  );

create table public.steel_reference_observations (
  id uuid primary key default gen_random_uuid(),
  knowledge_source_id uuid not null references public.knowledge_sources(id) on delete restrict,
  source_document_id uuid,
  source_locator jsonb not null default '{}'::jsonb,
  observation_type text not null
    check (observation_type in (
      'standard_metadata',
      'grade',
      'dimension',
      'weight',
      'schedule',
      'cross_reference',
      'product_range'
    )),
  observed_standard_code text,
  observed_grade text,
  observed_product_family text,
  normalized_standard_id uuid references public.steel_standards(id) on delete set null,
  normalized_material_grade_id uuid references public.steel_material_grades(id) on delete set null,
  normalized_geometry_id uuid references public.steel_geometries(id) on delete set null,
  raw_payload jsonb not null,
  content_checksum text not null,
  promotion_status text not null default 'pending'
    check (promotion_status in ('pending', 'promoted', 'rejected')),
  observed_at timestamptz,
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (source_document_id, knowledge_source_id)
    references public.knowledge_documents(id, source_id)
    on delete restrict,
  unique (knowledge_source_id, content_checksum)
);

create index steel_reference_observations_review_idx
  on public.steel_reference_observations (
    promotion_status,
    observation_type,
    created_at
  );

create table public.steel_grade_cross_references (
  id uuid primary key default gen_random_uuid(),
  from_material_grade_id uuid not null references public.steel_material_grades(id) on delete cascade,
  to_material_grade_id uuid not null references public.steel_material_grades(id) on delete cascade,
  relation_type text not null
    check (relation_type in (
      'same_material',
      'national_adoption',
      'supplier_cross_reference',
      'commercially_comparable'
    )),
  notes text,
  knowledge_source_id uuid references public.knowledge_sources(id) on delete restrict,
  source_document_id uuid,
  source_locator jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (source_document_id, knowledge_source_id)
    references public.knowledge_documents(id, source_id)
    on delete restrict,
  check (from_material_grade_id <> to_material_grade_id),
  check (source_document_id is null or knowledge_source_id is not null)
);

create unique index steel_grade_cross_references_uq
  on public.steel_grade_cross_references (
    from_material_grade_id,
    to_material_grade_id,
    relation_type,
    coalesce(knowledge_source_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- Canonical internal dimensional systems used by the importer. Normative systems
-- such as ASME B36.10/B36.19 are seeded later only with explicit provenance.
insert into public.steel_dimensional_systems (
  id,
  code,
  title,
  unit_system,
  metadata
) values
  (
    'a1100000-0000-4000-8000-000000000001'::uuid,
    'metric-od-t',
    'Metric round tube OD × wall thickness',
    'metric',
    jsonb_build_object('internal_reference', true, 'geometry_family', 'round_tube')
  ),
  (
    'a1100000-0000-4000-8000-000000000002'::uuid,
    'metric-shape-t',
    'Metric hollow section width × height × wall thickness',
    'metric',
    jsonb_build_object('internal_reference', true, 'geometry_family', 'square_rectangular')
  )
on conflict do nothing;

-- Backfill the existing EN 10224 record into the new standard-series model.
insert into public.steel_standard_series (
  id,
  standard_system,
  code,
  title,
  issuing_body,
  application_category,
  short_explanation,
  knowledge_source_id,
  source_locator,
  metadata
)
select
  '10224000-0000-4000-8000-000000000010'::uuid,
  'EN',
  'EN 10224',
  'Steel tubes and fittings for the conveyance of aqueous liquids',
  'CEN',
  'water_transport',
  'European standard family for non-alloy steel tubes and fittings used to convey water and other aqueous liquids.',
  s.knowledge_source_id,
  s.source_locator,
  jsonb_build_object('migrated_from', 'p1.15-sk3', 'reference_database_v2', true)
from public.steel_standards s
where s.code_key = public.canonical_steel_token('EN 10224')
limit 1
on conflict do nothing;

update public.steel_standards
set
  standard_series_id = '10224000-0000-4000-8000-000000000010'::uuid,
  standard_system = coalesce(standard_system, 'EN'),
  application_category = coalesce(application_category, 'water_transport'),
  manufacturing_processes = case
    when cardinality(manufacturing_processes) = 0 then array['seamless', 'welded']::text[]
    else manufacturing_processes
  end,
  dimensional_basis = coalesce(dimensional_basis, 'metric_od_t')
where code_key = public.canonical_steel_token('EN 10224');

-- Promote the already loaded SK3 dimensional rows into reusable canonical geometry.
insert into public.steel_geometries (
  product_family,
  outer_diameter_mm,
  width_mm,
  height_mm,
  thickness_mm,
  metadata
)
select distinct
  d.product_family,
  d.outer_diameter_mm,
  d.width_mm,
  d.height_mm,
  d.thickness_mm,
  jsonb_build_object('migrated_from', 'steel_dimensional_rows', 'reference_database_v2', true)
from public.steel_dimensional_rows d
on conflict (geometry_key) do nothing;

update public.steel_dimensional_rows d
set geometry_id = g.id
from public.steel_geometries g
where g.geometry_key = d.dimension_key
  and d.geometry_id is null;

-- Preserve current source-specific EN 10224 rows as explicit applicability and
-- weight references. They remain manufacturer-range evidence, not normative-complete.
insert into public.steel_standard_dimension_applicability (
  standard_id,
  geometry_id,
  dimensional_system_id,
  applicability_type,
  is_normative_complete,
  knowledge_source_id,
  source_document_id,
  source_locator,
  metadata
)
select
  d.standard_id,
  d.geometry_id,
  'a1100000-0000-4000-8000-000000000001'::uuid,
  case
    when d.metadata ->> 'dataset_scope' = 'manufacturer_product_range'
      then 'manufacturer_range'
    else 'verified_internal'
  end,
  not coalesce((d.metadata ->> 'not_normative_complete')::boolean, false),
  d.knowledge_source_id,
  d.source_document_id,
  d.source_locator,
  d.metadata || jsonb_build_object('migrated_from', 'steel_dimensional_rows')
from public.steel_dimensional_rows d
where d.geometry_id is not null
on conflict do nothing;

insert into public.steel_weight_references (
  geometry_id,
  weight_kg_m,
  weight_method,
  formula_version,
  is_canonical,
  knowledge_source_id,
  source_document_id,
  source_locator,
  metadata
)
select
  d.geometry_id,
  d.theoretical_weight_kg_m,
  d.weight_method,
  d.weight_formula_version,
  true,
  d.knowledge_source_id,
  d.source_document_id,
  d.source_locator,
  d.metadata || jsonb_build_object('migrated_from', 'steel_dimensional_rows')
from public.steel_dimensional_rows d
where d.geometry_id is not null
on conflict do nothing;

comment on table public.steel_standard_series is
  'P1.15 SK4.1 standard-family registry. Groups multipart standards such as EN 10216 while steel_standards stores concrete parts/editions.';
comment on table public.steel_material_grades is
  'P1.15 SK4.1 canonical steel material/grade registry independent from dimensions and suppliers.';
comment on table public.steel_geometries is
  'P1.15 SK4.1 canonical reusable CHS/SHS/RHS geometry. One geometry can be referenced by many standards, grades and sources.';
comment on table public.steel_dimension_designations is
  'P1.15 SK4.1 nominal NPS/DN/Schedule or other dimensional designation mapped to canonical geometry.';
comment on table public.steel_standard_dimension_applicability is
  'P1.15 SK4.1 evidence-backed relationship between standards and canonical geometries; normative and manufacturer ranges remain distinct.';
comment on table public.steel_weight_references is
  'P1.15 SK4.1 multi-source kg/m references. Published, calculated and verified values are stored separately with provenance.';
comment on table public.steel_reference_observations is
  'P1.15 SK4.1 append-only import staging for catalog facts before promotion into canonical shared reference entities.';
comment on table public.steel_grade_cross_references is
  'P1.15 SK4.1 explicit grade relationship semantics. Commercial comparability must never be represented as normative equivalence.';

-- Shared catalog read policy: all authenticated users can read; canonical writes
-- remain service/admin controlled exactly like SK1.
alter table public.steel_standard_series enable row level security;
alter table public.steel_material_grades enable row level security;
alter table public.steel_standard_grade_applicability enable row level security;
alter table public.steel_geometries enable row level security;
alter table public.steel_dimensional_systems enable row level security;
alter table public.steel_dimension_designations enable row level security;
alter table public.steel_standard_dimension_applicability enable row level security;
alter table public.steel_weight_references enable row level security;
alter table public.steel_reference_observations enable row level security;
alter table public.steel_grade_cross_references enable row level security;

revoke all on table public.steel_standard_series from public, anon, authenticated;
revoke all on table public.steel_material_grades from public, anon, authenticated;
revoke all on table public.steel_standard_grade_applicability from public, anon, authenticated;
revoke all on table public.steel_geometries from public, anon, authenticated;
revoke all on table public.steel_dimensional_systems from public, anon, authenticated;
revoke all on table public.steel_dimension_designations from public, anon, authenticated;
revoke all on table public.steel_standard_dimension_applicability from public, anon, authenticated;
revoke all on table public.steel_weight_references from public, anon, authenticated;
revoke all on table public.steel_reference_observations from public, anon, authenticated;
revoke all on table public.steel_grade_cross_references from public, anon, authenticated;

grant select on table public.steel_standard_series to authenticated;
grant select on table public.steel_material_grades to authenticated;
grant select on table public.steel_standard_grade_applicability to authenticated;
grant select on table public.steel_geometries to authenticated;
grant select on table public.steel_dimensional_systems to authenticated;
grant select on table public.steel_dimension_designations to authenticated;
grant select on table public.steel_standard_dimension_applicability to authenticated;
grant select on table public.steel_weight_references to authenticated;
grant select on table public.steel_reference_observations to authenticated;
grant select on table public.steel_grade_cross_references to authenticated;

grant select, insert, update, delete on table public.steel_standard_series to service_role;
grant select, insert, update, delete on table public.steel_material_grades to service_role;
grant select, insert, update, delete on table public.steel_standard_grade_applicability to service_role;
grant select, insert, update, delete on table public.steel_geometries to service_role;
grant select, insert, update, delete on table public.steel_dimensional_systems to service_role;
grant select, insert, update, delete on table public.steel_dimension_designations to service_role;
grant select, insert, update, delete on table public.steel_standard_dimension_applicability to service_role;
grant select, insert, update, delete on table public.steel_weight_references to service_role;
grant select, insert, update, delete on table public.steel_reference_observations to service_role;
grant select, insert, update, delete on table public.steel_grade_cross_references to service_role;

create policy steel_standard_series_authenticated_read
  on public.steel_standard_series for select to authenticated using (true);
create policy steel_material_grades_authenticated_read
  on public.steel_material_grades for select to authenticated using (true);
create policy steel_standard_grade_applicability_authenticated_read
  on public.steel_standard_grade_applicability for select to authenticated using (true);
create policy steel_geometries_authenticated_read
  on public.steel_geometries for select to authenticated using (true);
create policy steel_dimensional_systems_authenticated_read
  on public.steel_dimensional_systems for select to authenticated using (true);
create policy steel_dimension_designations_authenticated_read
  on public.steel_dimension_designations for select to authenticated using (true);
create policy steel_standard_dimension_applicability_authenticated_read
  on public.steel_standard_dimension_applicability for select to authenticated using (true);
create policy steel_weight_references_authenticated_read
  on public.steel_weight_references for select to authenticated using (true);
create policy steel_reference_observations_authenticated_read
  on public.steel_reference_observations for select to authenticated using (true);
create policy steel_grade_cross_references_authenticated_read
  on public.steel_grade_cross_references for select to authenticated using (true);
