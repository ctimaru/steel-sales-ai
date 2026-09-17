-- P1.15 — Shared Steel Knowledge foundation.
--
-- Purpose:
--   * provide one globally readable technical reference catalog for every tenant;
--   * keep canonical standards/dimensions separate from tenant-private products and prices;
--   * reuse the existing Knowledge Layer for provenance and semantic identity;
--   * keep canonical writes service/admin governed while authenticated users are read-only.

create table public.steel_standards (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  code_key text generated always as (public.canonical_steel_token(code)) stored,
  title text not null,
  short_explanation text not null,
  scope_summary text,
  issuing_body text,
  edition text,
  valid_from date,
  valid_to date,
  status text not null default 'active'
    check (status in ('active', 'superseded', 'draft')),
  knowledge_entity_id uuid references public.knowledge_entities(id) on delete set null,
  knowledge_source_id uuid not null references public.knowledge_sources(id) on delete restrict,
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
  check (length(btrim(short_explanation)) > 0),
  check (valid_to is null or valid_from is null or valid_to >= valid_from),
  check (source_document_id is null or knowledge_source_id is not null)
);

create unique index steel_standards_code_edition_uq
  on public.steel_standards (code_key, coalesce(edition, ''));

create unique index steel_standards_one_active_code_uq
  on public.steel_standards (code_key)
  where status = 'active';

create index steel_standards_status_code_idx
  on public.steel_standards (status, code_key);

create table public.steel_standard_product_families (
  standard_id uuid not null references public.steel_standards(id) on delete cascade,
  product_family text not null
    check (product_family in ('round_tube', 'square_tube', 'rectangular_tube')),
  knowledge_entity_id uuid references public.knowledge_entities(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (standard_id, product_family)
);

create table public.steel_standard_grades (
  id uuid primary key default gen_random_uuid(),
  standard_id uuid not null references public.steel_standards(id) on delete cascade,
  grade text not null,
  grade_key text generated always as (public.canonical_steel_token(grade)) stored,
  material_number text,
  material_number_key text generated always as (
    coalesce(public.canonical_steel_token(material_number), '')
  ) stored,
  knowledge_entity_id uuid references public.knowledge_entities(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (grade_key is not null),
  unique (standard_id, grade_key, material_number_key)
);

create index steel_standard_grades_standard_idx
  on public.steel_standard_grades (standard_id, grade_key);

create table public.steel_dimensional_rows (
  id uuid primary key default gen_random_uuid(),
  standard_id uuid not null references public.steel_standards(id) on delete cascade,
  product_family text not null
    check (product_family in ('round_tube', 'square_tube', 'rectangular_tube')),
  outer_diameter_mm numeric,
  width_mm numeric,
  height_mm numeric,
  thickness_mm numeric not null check (thickness_mm > 0),
  dimension_key text generated always as (
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
  theoretical_weight_kg_m numeric not null check (theoretical_weight_kg_m > 0),
  weight_method text not null default 'published'
    check (weight_method in ('published', 'calculated', 'verified')),
  weight_formula_version text,
  valid_from date,
  valid_to date,
  knowledge_source_id uuid references public.knowledge_sources(id) on delete restrict,
  source_document_id uuid,
  source_locator jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (source_document_id, knowledge_source_id)
    references public.knowledge_documents(id, source_id)
    on delete restrict,
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
  check (dimension_key is not null),
  check (valid_to is null or valid_from is null or valid_to >= valid_from),
  check (weight_method <> 'calculated' or weight_formula_version is not null),
  check (source_document_id is null or knowledge_source_id is not null),
  unique (standard_id, dimension_key)
);

create index steel_dimensional_rows_standard_round_idx
  on public.steel_dimensional_rows (
    standard_id, outer_diameter_mm, thickness_mm
  )
  where product_family = 'round_tube';

create index steel_dimensional_rows_standard_shape_idx
  on public.steel_dimensional_rows (
    standard_id, product_family, width_mm, height_mm, thickness_mm
  )
  where product_family in ('square_tube', 'rectangular_tube');

comment on table public.steel_standards is
  'P1.15 globally readable curated registry of steel tube standards. Normative full text is not stored unless licensing permits it.';
comment on table public.steel_standard_product_families is
  'P1.15 relationship between a shared standard and supported canonical tube product families.';
comment on table public.steel_standard_grades is
  'P1.15 optional grade/material references associated with a shared standard.';
comment on table public.steel_dimensional_rows is
  'P1.15 globally readable dimensional reference rows with explicit theoretical weight provenance method.';
comment on column public.steel_dimensional_rows.theoretical_weight_kg_m is
  'Authoritative displayed reference kg/m for this row; published, calculated or verified is declared by weight_method.';
comment on column public.steel_dimensional_rows.dimension_key is
  'Deterministic geometry+thickness identity within a standard edition. It intentionally excludes tenant and commercial price.';

alter table public.steel_standards enable row level security;
alter table public.steel_standard_product_families enable row level security;
alter table public.steel_standard_grades enable row level security;
alter table public.steel_dimensional_rows enable row level security;

revoke all on table public.steel_standards from public, anon, authenticated;
revoke all on table public.steel_standard_product_families from public, anon, authenticated;
revoke all on table public.steel_standard_grades from public, anon, authenticated;
revoke all on table public.steel_dimensional_rows from public, anon, authenticated;

grant select on table public.steel_standards to authenticated;
grant select on table public.steel_standard_product_families to authenticated;
grant select on table public.steel_standard_grades to authenticated;
grant select on table public.steel_dimensional_rows to authenticated;

grant select, insert, update, delete on table public.steel_standards to service_role;
grant select, insert, update, delete on table public.steel_standard_product_families to service_role;
grant select, insert, update, delete on table public.steel_standard_grades to service_role;
grant select, insert, update, delete on table public.steel_dimensional_rows to service_role;

create policy steel_standards_authenticated_read
  on public.steel_standards
  for select
  to authenticated
  using (true);

create policy steel_standard_product_families_authenticated_read
  on public.steel_standard_product_families
  for select
  to authenticated
  using (true);

create policy steel_standard_grades_authenticated_read
  on public.steel_standard_grades
  for select
  to authenticated
  using (true);

create policy steel_dimensional_rows_authenticated_read
  on public.steel_dimensional_rows
  for select
  to authenticated
  using (true);
