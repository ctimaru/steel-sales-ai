-- K8 — Organic Discovery & SEO Quality Control.
--
-- Adds internal-only SEO/content quality observability and a publication
-- readiness contract. These functions never publish content automatically:
-- they expose blockers so future standards/grades can be reviewed before the
-- page_status is changed to published.

create or replace function public.k8_knowledge_seo_quality_audit()
returns table (
  content_type text,
  total_rows integer,
  indexable_rows integer,
  missing_sources integer,
  missing_seo integer,
  stale_rows integer,
  structural_issues integer,
  details jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    'standard'::text,
    count(*)::integer,
    count(*) filter (
      where p.page_status='published'
        and p.last_reviewed_at is not null
        and jsonb_array_length(p.source_references)>0
        and nullif(btrim(coalesce(p.seo_title,'')),'') is not null
        and nullif(btrim(coalesce(p.seo_description,'')),'') is not null
    )::integer,
    count(*) filter (
      where p.page_status='published'
        and jsonb_array_length(p.source_references)=0
    )::integer,
    count(*) filter (
      where p.page_status='published'
        and (
          nullif(btrim(coalesce(p.seo_title,'')),'') is null
          or nullif(btrim(coalesce(p.seo_description,'')),'') is null
        )
    )::integer,
    count(*) filter (
      where p.page_status='published'
        and (
          p.last_reviewed_at is null
          or p.last_reviewed_at < current_date - 365
        )
    )::integer,
    count(*) filter (
      where p.page_status='published'
        and (
          jsonb_array_length(p.editorial_sections)<2
          or jsonb_array_length(p.faq)<2
          or nullif(btrim(coalesce(p.intro,'')),'') is null
          or nullif(btrim(coalesce(p.what_it_covers,'')),'') is null
        )
    )::integer,
    jsonb_build_object(
      'freshness_days',365,
      'published_rows',count(*) filter (where p.page_status='published')
    )
  from public.steel_knowledge_standard_pages p

  union all

  select
    'grade'::text,
    count(*)::integer,
    count(*) filter (
      where p.page_status='published'
        and p.last_reviewed_at is not null
        and jsonb_array_length(p.source_references)>0
        and nullif(btrim(coalesce(p.seo_title,'')),'') is not null
        and nullif(btrim(coalesce(p.seo_description,'')),'') is not null
    )::integer,
    count(*) filter (
      where p.page_status='published'
        and jsonb_array_length(p.source_references)=0
    )::integer,
    count(*) filter (
      where p.page_status='published'
        and (
          nullif(btrim(coalesce(p.seo_title,'')),'') is null
          or nullif(btrim(coalesce(p.seo_description,'')),'') is null
        )
    )::integer,
    count(*) filter (
      where p.page_status='published'
        and (
          p.last_reviewed_at is null
          or p.last_reviewed_at < current_date - 365
        )
    )::integer,
    count(*) filter (
      where p.page_status='published'
        and (
          jsonb_array_length(p.editorial_sections)<2
          or jsonb_array_length(p.faq)<2
          or nullif(btrim(coalesce(p.intro,'')),'') is null
          or nullif(btrim(coalesce(p.designation_explanation,'')),'') is null
        )
    )::integer,
    jsonb_build_object(
      'freshness_days',365,
      'published_rows',count(*) filter (where p.page_status='published')
    )
  from public.steel_knowledge_grade_pages p

  union all

  select
    'dimension'::text,
    count(*)::integer,
    count(*)::integer,
    count(*) filter (
      where nullif(btrim(coalesce(d.source_url,'')),'') is null
         or nullif(btrim(coalesce(d.source_provider,'')),'') is null
    )::integer,
    0::integer,
    0::integer,
    (count(*) - count(distinct d.dimension_slug))::integer,
    jsonb_build_object(
      'families',count(distinct d.product_family),
      'source_complete',count(*) filter (
        where nullif(btrim(coalesce(d.source_url,'')),'') is not null
          and nullif(btrim(coalesce(d.source_provider,'')),'') is not null
      )
    )
  from public.k6_public_tube_dimension_pages(null,500,0) d

  union all

  select
    'size_hub'::text,
    count(*)::integer,
    count(*) filter (where h.variant_count>=2)::integer,
    0::integer,
    0::integer,
    0::integer,
    count(*) filter (where h.variant_count<2)::integer,
    jsonb_build_object(
      'round_hubs',count(*) filter (where h.product_family='round_tube'),
      'square_hubs',count(*) filter (where h.product_family='square_tube'),
      'rectangular_hubs',count(*) filter (where h.product_family='rectangular_tube')
    )
  from public.k7_public_tube_size_hubs(null) h;
$$;

create or replace function public.k8_knowledge_publication_readiness()
returns table (
  content_type text,
  page_id uuid,
  slug text,
  page_status text,
  ready boolean,
  blockers text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    'standard'::text,
    p.id,
    p.slug,
    p.page_status,
    cardinality(array_remove(array[
      case when nullif(btrim(coalesce(p.seo_title,'')),'') is null then 'missing_seo_title' end,
      case when nullif(btrim(coalesce(p.seo_description,'')),'') is null then 'missing_seo_description' end,
      case when nullif(btrim(coalesce(p.intro,'')),'') is null then 'missing_intro' end,
      case when nullif(btrim(coalesce(p.what_it_covers,'')),'') is null then 'missing_scope_copy' end,
      case when p.last_reviewed_at is null then 'missing_review_date' end,
      case when jsonb_array_length(p.source_references)<1 then 'missing_sources' end,
      case when jsonb_array_length(p.editorial_sections)<2 then 'insufficient_editorial_sections' end,
      case when jsonb_array_length(p.faq)<2 then 'insufficient_faq' end
    ]::text[],null))=0,
    array_remove(array[
      case when nullif(btrim(coalesce(p.seo_title,'')),'') is null then 'missing_seo_title' end,
      case when nullif(btrim(coalesce(p.seo_description,'')),'') is null then 'missing_seo_description' end,
      case when nullif(btrim(coalesce(p.intro,'')),'') is null then 'missing_intro' end,
      case when nullif(btrim(coalesce(p.what_it_covers,'')),'') is null then 'missing_scope_copy' end,
      case when p.last_reviewed_at is null then 'missing_review_date' end,
      case when jsonb_array_length(p.source_references)<1 then 'missing_sources' end,
      case when jsonb_array_length(p.editorial_sections)<2 then 'insufficient_editorial_sections' end,
      case when jsonb_array_length(p.faq)<2 then 'insufficient_faq' end
    ]::text[],null)
  from public.steel_knowledge_standard_pages p

  union all

  select
    'grade'::text,
    p.id,
    p.slug,
    p.page_status,
    cardinality(array_remove(array[
      case when nullif(btrim(coalesce(p.seo_title,'')),'') is null then 'missing_seo_title' end,
      case when nullif(btrim(coalesce(p.seo_description,'')),'') is null then 'missing_seo_description' end,
      case when nullif(btrim(coalesce(p.intro,'')),'') is null then 'missing_intro' end,
      case when nullif(btrim(coalesce(p.designation_explanation,'')),'') is null then 'missing_designation_copy' end,
      case when p.last_reviewed_at is null then 'missing_review_date' end,
      case when jsonb_array_length(p.source_references)<1 then 'missing_sources' end,
      case when jsonb_array_length(p.editorial_sections)<2 then 'insufficient_editorial_sections' end,
      case when jsonb_array_length(p.faq)<2 then 'insufficient_faq' end
    ]::text[],null))=0,
    array_remove(array[
      case when nullif(btrim(coalesce(p.seo_title,'')),'') is null then 'missing_seo_title' end,
      case when nullif(btrim(coalesce(p.seo_description,'')),'') is null then 'missing_seo_description' end,
      case when nullif(btrim(coalesce(p.intro,'')),'') is null then 'missing_intro' end,
      case when nullif(btrim(coalesce(p.designation_explanation,'')),'') is null then 'missing_designation_copy' end,
      case when p.last_reviewed_at is null then 'missing_review_date' end,
      case when jsonb_array_length(p.source_references)<1 then 'missing_sources' end,
      case when jsonb_array_length(p.editorial_sections)<2 then 'insufficient_editorial_sections' end,
      case when jsonb_array_length(p.faq)<2 then 'insufficient_faq' end
    ]::text[],null)
  from public.steel_knowledge_grade_pages p;
$$;

revoke all on function public.k8_knowledge_seo_quality_audit()
  from public, anon, authenticated;
revoke all on function public.k8_knowledge_publication_readiness()
  from public, anon, authenticated;

grant execute on function public.k8_knowledge_seo_quality_audit()
  to service_role;
grant execute on function public.k8_knowledge_publication_readiness()
  to service_role;

comment on function public.k8_knowledge_seo_quality_audit() is
  'K8 internal SEO/content quality report. Tracks indexability, source completeness, editorial structure and 365-day review freshness.';
comment on function public.k8_knowledge_publication_readiness() is
  'K8 internal publication gate for standard and grade editorial pages. Reports blockers only; never changes page_status.';

do $$
begin
  if exists (
    select 1
    from public.k8_knowledge_seo_quality_audit()
    where content_type in ('standard','grade')
      and (missing_sources>0 or missing_seo>0 or structural_issues>0)
  ) then
    raise exception 'K8 published standard/grade quality regression';
  end if;

  if exists (
    select 1
    from public.k8_knowledge_publication_readiness()
    where page_status='published'
      and ready=false
  ) then
    raise exception 'K8 published editorial pages must pass publication readiness';
  end if;

  if exists (
    select 1
    from public.k8_knowledge_seo_quality_audit()
    where content_type='size_hub'
      and structural_issues>0
  ) then
    raise exception 'K8 thin size-hub regression';
  end if;
end
$$;
