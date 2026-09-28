-- K2 — Standards & Grades Information Architecture.
--
-- Purpose:
--   * introduce an editorial publication layer for public Steel Knowledge pages;
--   * keep canonical technical tables private/authenticated-only;
--   * expose only a narrow, reviewed anonymous read contract;
--   * establish stable human-readable slugs for standards and steel grades;
--   * preserve applicability semantics so supplier/manufacturer evidence is never
--     presented as normative equivalence by the public layer.

create or replace function public.steel_knowledge_slug(p_value text)
returns text
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select nullif(
    trim(both '-' from lower(regexp_replace(btrim(p_value), '[^[:alnum:]]+', '-', 'g'))),
    ''
  );
$$;

revoke all on function public.steel_knowledge_slug(text)
  from public, anon, authenticated;
grant execute on function public.steel_knowledge_slug(text)
  to service_role;

create table public.steel_knowledge_standard_pages (
  id uuid primary key default gen_random_uuid(),
  standard_id uuid not null unique
    references public.steel_standards(id) on delete cascade,
  slug text not null unique,
  page_status text not null default 'draft'
    check (page_status in ('draft','published','archived')),
  seo_title text,
  seo_description text,
  intro text,
  what_it_covers text,
  how_to_read text,
  typical_applications text,
  editorial_sections jsonb not null default '[]'::jsonb
    check (jsonb_typeof(editorial_sections)='array'),
  faq jsonb not null default '[]'::jsonb
    check (jsonb_typeof(faq)='array'),
  editorial_version integer not null default 1
    check (editorial_version > 0),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  check (
    page_status <> 'published'
    or (
      nullif(btrim(coalesce(seo_title,'')), '') is not null
      and nullif(btrim(coalesce(seo_description,'')), '') is not null
      and nullif(btrim(coalesce(intro,'')), '') is not null
      and nullif(btrim(coalesce(what_it_covers,'')), '') is not null
      and published_at is not null
    )
  )
);

create table public.steel_knowledge_grade_pages (
  id uuid primary key default gen_random_uuid(),
  material_grade_id uuid not null unique
    references public.steel_material_grades(id) on delete cascade,
  slug text not null unique,
  page_status text not null default 'draft'
    check (page_status in ('draft','published','archived')),
  seo_title text,
  seo_description text,
  intro text,
  designation_explanation text,
  typical_applications text,
  editorial_sections jsonb not null default '[]'::jsonb
    check (jsonb_typeof(editorial_sections)='array'),
  faq jsonb not null default '[]'::jsonb
    check (jsonb_typeof(faq)='array'),
  editorial_version integer not null default 1
    check (editorial_version > 0),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  check (
    page_status <> 'published'
    or (
      nullif(btrim(coalesce(seo_title,'')), '') is not null
      and nullif(btrim(coalesce(seo_description,'')), '') is not null
      and nullif(btrim(coalesce(intro,'')), '') is not null
      and nullif(btrim(coalesce(designation_explanation,'')), '') is not null
      and published_at is not null
    )
  )
);

comment on table public.steel_knowledge_standard_pages is
  'K2 editorial publication registry for public standard pages. Canonical technical facts remain in steel_standards and related reference tables.';
comment on table public.steel_knowledge_grade_pages is
  'K2 editorial publication registry for public steel-grade pages. Public visibility requires explicit published state and editorial completeness.';

alter table public.steel_knowledge_standard_pages enable row level security;
alter table public.steel_knowledge_grade_pages enable row level security;

revoke all on table public.steel_knowledge_standard_pages
  from public, anon, authenticated;
revoke all on table public.steel_knowledge_grade_pages
  from public, anon, authenticated;

grant select, insert, update, delete on table public.steel_knowledge_standard_pages
  to service_role;
grant select, insert, update, delete on table public.steel_knowledge_grade_pages
  to service_role;

-- Seed an editorial backlog without publishing anything automatically.
insert into public.steel_knowledge_standard_pages (
  standard_id,
  slug,
  page_status
)
select
  s.id,
  public.steel_knowledge_slug(s.code),
  'draft'
from public.steel_standards s
where s.status='active'
  and public.steel_knowledge_slug(s.code) is not null
on conflict (standard_id) do nothing;

with grade_slugs as (
  select
    g.id,
    public.steel_knowledge_slug(g.designation) as base_slug,
    public.steel_knowledge_slug(coalesce(g.standard_system,'steel')) as system_slug,
    public.steel_knowledge_slug(coalesce(g.material_number,'')) as material_slug,
    count(*) over (
      partition by public.steel_knowledge_slug(g.designation)
    ) as slug_count
  from public.steel_material_grades g
),
resolved as (
  select
    id,
    case
      when slug_count=1 then base_slug
      else base_slug
        || '-' || coalesce(system_slug,'steel')
        || case
             when material_slug is null then ''
             else '-' || material_slug
           end
    end as slug
  from grade_slugs
  where base_slug is not null
)
insert into public.steel_knowledge_grade_pages (
  material_grade_id,
  slug,
  page_status
)
select id, slug, 'draft'
from resolved
on conflict (material_grade_id) do nothing;

-- Public list of published standard pages.
create or replace function public.k2_public_knowledge_standards(
  p_query text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  standard_id uuid,
  slug text,
  code text,
  title text,
  standard_system text,
  application_category text,
  short_explanation text,
  seo_title text,
  seo_description text,
  product_families text[],
  related_grade_count integer,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    p.slug,
    s.code,
    s.title,
    s.standard_system,
    s.application_category,
    s.short_explanation,
    p.seo_title,
    p.seo_description,
    coalesce((
      select array_agg(distinct pf.product_family order by pf.product_family)
      from public.steel_standard_product_families pf
      where pf.standard_id=s.id
    ), array[]::text[]) as product_families,
    (
      select count(distinct a.material_grade_id)::integer
      from public.steel_standard_grade_applicability a
      where a.standard_id=s.id
    ) as related_grade_count,
    p.published_at
  from public.steel_knowledge_standard_pages p
  join public.steel_standards s on s.id=p.standard_id
  where p.page_status='published'
    and s.status='active'
    and (
      nullif(btrim(coalesce(p_query,'')), '') is null
      or s.code ilike '%' || btrim(p_query) || '%'
      or s.title ilike '%' || btrim(p_query) || '%'
      or coalesce(s.short_explanation,'') ilike '%' || btrim(p_query) || '%'
    )
  order by s.standard_system nulls last, s.code_key, s.id
  limit greatest(1,least(coalesce(p_limit,100),250))
  offset greatest(0,coalesce(p_offset,0));
$$;

-- Public detail contract for one standard.
create or replace function public.k2_public_knowledge_standard(
  p_slug text
)
returns table (
  standard_id uuid,
  slug text,
  code text,
  title text,
  standard_system text,
  issuing_body text,
  edition text,
  part_number text,
  application_category text,
  manufacturing_processes text[],
  dimensional_basis text,
  short_explanation text,
  scope_summary text,
  seo_title text,
  seo_description text,
  intro text,
  what_it_covers text,
  how_to_read text,
  typical_applications text,
  editorial_sections jsonb,
  faq jsonb,
  product_families text[],
  related_grades jsonb,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    p.slug,
    s.code,
    s.title,
    s.standard_system,
    s.issuing_body,
    s.edition,
    s.part_number,
    s.application_category,
    s.manufacturing_processes,
    s.dimensional_basis,
    s.short_explanation,
    s.scope_summary,
    p.seo_title,
    p.seo_description,
    p.intro,
    p.what_it_covers,
    p.how_to_read,
    p.typical_applications,
    p.editorial_sections,
    p.faq,
    coalesce((
      select array_agg(distinct pf.product_family order by pf.product_family)
      from public.steel_standard_product_families pf
      where pf.standard_id=s.id
    ), array[]::text[]) as product_families,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'material_grade_id', r.material_grade_id,
          'designation', r.designation,
          'material_number', r.material_number,
          'standard_system', r.standard_system,
          'applicability_type', r.applicability_type,
          'is_normative', r.applicability_type='normative',
          'manufacturing_processes', r.manufacturing_processes,
          'slug', r.public_slug
        )
        order by r.designation, r.material_number nulls last
      )
      from (
        select
          g.id as material_grade_id,
          g.designation,
          g.material_number,
          g.standard_system,
          case min(
            case a.applicability_type
              when 'normative' then 1
              when 'official_reference' then 2
              when 'manufacturer_range' then 3
              when 'supplier_range' then 4
              when 'verified_internal' then 5
              else 9
            end
          )
            when 1 then 'normative'
            when 2 then 'official_reference'
            when 3 then 'manufacturer_range'
            when 4 then 'supplier_range'
            when 5 then 'verified_internal'
            else 'reference'
          end as applicability_type,
          coalesce(
            array_agg(distinct a.manufacturing_process)
              filter (where a.manufacturing_process is not null),
            array[]::text[]
          ) as manufacturing_processes,
          gp.slug as public_slug
        from public.steel_standard_grade_applicability a
        join public.steel_material_grades g
          on g.id=a.material_grade_id
        left join public.steel_knowledge_grade_pages gp
          on gp.material_grade_id=g.id
         and gp.page_status='published'
        where a.standard_id=s.id
        group by
          g.id,g.designation,g.material_number,g.standard_system,gp.slug
      ) r
    ), '[]'::jsonb) as related_grades,
    p.published_at
  from public.steel_knowledge_standard_pages p
  join public.steel_standards s on s.id=p.standard_id
  where p.page_status='published'
    and s.status='active'
    and p.slug=lower(btrim(p_slug))
  limit 1;
$$;

-- Public list of published grade pages.
create or replace function public.k2_public_knowledge_grades(
  p_query text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  material_grade_id uuid,
  slug text,
  designation text,
  material_number text,
  standard_system text,
  material_family text,
  short_description text,
  seo_title text,
  seo_description text,
  related_standard_count integer,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id,
    p.slug,
    g.designation,
    g.material_number,
    g.standard_system,
    g.material_family,
    g.short_description,
    p.seo_title,
    p.seo_description,
    (
      select count(distinct a.standard_id)::integer
      from public.steel_standard_grade_applicability a
      where a.material_grade_id=g.id
    ) as related_standard_count,
    p.published_at
  from public.steel_knowledge_grade_pages p
  join public.steel_material_grades g on g.id=p.material_grade_id
  where p.page_status='published'
    and (
      nullif(btrim(coalesce(p_query,'')), '') is null
      or g.designation ilike '%' || btrim(p_query) || '%'
      or coalesce(g.material_number,'') ilike '%' || btrim(p_query) || '%'
      or coalesce(g.short_description,'') ilike '%' || btrim(p_query) || '%'
    )
  order by g.standard_system nulls last, g.designation_key, g.material_number_key, g.id
  limit greatest(1,least(coalesce(p_limit,100),250))
  offset greatest(0,coalesce(p_offset,0));
$$;

-- Public detail contract for one steel grade.
create or replace function public.k2_public_knowledge_grade(
  p_slug text
)
returns table (
  material_grade_id uuid,
  slug text,
  designation text,
  material_number text,
  standard_system text,
  material_family text,
  density_kg_m3 numeric,
  short_description text,
  seo_title text,
  seo_description text,
  intro text,
  designation_explanation text,
  typical_applications text,
  editorial_sections jsonb,
  faq jsonb,
  related_standards jsonb,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id,
    p.slug,
    g.designation,
    g.material_number,
    g.standard_system,
    g.material_family,
    g.density_kg_m3,
    g.short_description,
    p.seo_title,
    p.seo_description,
    p.intro,
    p.designation_explanation,
    p.typical_applications,
    p.editorial_sections,
    p.faq,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'standard_id', r.standard_id,
          'code', r.code,
          'title', r.title,
          'standard_system', r.standard_system,
          'applicability_type', r.applicability_type,
          'is_normative', r.applicability_type='normative',
          'manufacturing_processes', r.manufacturing_processes,
          'slug', r.public_slug
        )
        order by r.code
      )
      from (
        select
          s.id as standard_id,
          s.code,
          s.title,
          s.standard_system,
          case min(
            case a.applicability_type
              when 'normative' then 1
              when 'official_reference' then 2
              when 'manufacturer_range' then 3
              when 'supplier_range' then 4
              when 'verified_internal' then 5
              else 9
            end
          )
            when 1 then 'normative'
            when 2 then 'official_reference'
            when 3 then 'manufacturer_range'
            when 4 then 'supplier_range'
            when 5 then 'verified_internal'
            else 'reference'
          end as applicability_type,
          coalesce(
            array_agg(distinct a.manufacturing_process)
              filter (where a.manufacturing_process is not null),
            array[]::text[]
          ) as manufacturing_processes,
          sp.slug as public_slug
        from public.steel_standard_grade_applicability a
        join public.steel_standards s
          on s.id=a.standard_id
         and s.status='active'
        left join public.steel_knowledge_standard_pages sp
          on sp.standard_id=s.id
         and sp.page_status='published'
        where a.material_grade_id=g.id
        group by s.id,s.code,s.title,s.standard_system,sp.slug
      ) r
    ), '[]'::jsonb) as related_standards,
    p.published_at
  from public.steel_knowledge_grade_pages p
  join public.steel_material_grades g on g.id=p.material_grade_id
  where p.page_status='published'
    and p.slug=lower(btrim(p_slug))
  limit 1;
$$;

revoke all on function public.k2_public_knowledge_standards(text,integer,integer)
  from public;
revoke all on function public.k2_public_knowledge_standard(text)
  from public;
revoke all on function public.k2_public_knowledge_grades(text,integer,integer)
  from public;
revoke all on function public.k2_public_knowledge_grade(text)
  from public;

grant execute on function public.k2_public_knowledge_standards(text,integer,integer)
  to anon, authenticated, service_role;
grant execute on function public.k2_public_knowledge_standard(text)
  to anon, authenticated, service_role;
grant execute on function public.k2_public_knowledge_grades(text,integer,integer)
  to anon, authenticated, service_role;
grant execute on function public.k2_public_knowledge_grade(text)
  to anon, authenticated, service_role;

comment on function public.k2_public_knowledge_standards(text,integer,integer) is
  'K2 anonymous-safe list contract. Returns published editorial pages plus selected non-sensitive standard metadata only.';
comment on function public.k2_public_knowledge_standard(text) is
  'K2 anonymous-safe standard detail contract. Applicability type is preserved so weak supplier/manufacturer evidence is not mislabeled as normative.';
comment on function public.k2_public_knowledge_grades(text,integer,integer) is
  'K2 anonymous-safe published steel-grade list contract.';
comment on function public.k2_public_knowledge_grade(text) is
  'K2 anonymous-safe grade detail contract with related standards and explicit applicability semantics.';

-- Contract guards: anonymous users read through RPC only, never the editorial or
-- canonical backing tables directly.
do $$
begin
  if has_table_privilege('anon','public.steel_knowledge_standard_pages','SELECT')
     or has_table_privilege('anon','public.steel_knowledge_grade_pages','SELECT')
     or has_table_privilege('anon','public.steel_standards','SELECT')
     or has_table_privilege('anon','public.steel_material_grades','SELECT') then
    raise exception 'K2 anonymous direct-table read privilege regression';
  end if;

  if not has_function_privilege(
       'anon',
       'public.k2_public_knowledge_standards(text,integer,integer)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'anon',
       'public.k2_public_knowledge_standard(text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'anon',
       'public.k2_public_knowledge_grades(text,integer,integer)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'anon',
       'public.k2_public_knowledge_grade(text)',
       'EXECUTE'
     ) then
    raise exception 'K2 anonymous public read RPC privilege missing';
  end if;
end
$$;
