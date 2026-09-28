-- K8 — Organic Discovery & SEO Quality Control acceptance.
begin;

create or replace function pg_temp.k8_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'K8 assertion failed: %',message;
  end if;
end;
$$;

select pg_temp.k8_assert(
  not has_function_privilege('anon','public.k8_knowledge_seo_quality_audit()','EXECUTE')
  and not has_function_privilege('authenticated','public.k8_knowledge_seo_quality_audit()','EXECUTE')
  and not has_function_privilege('anon','public.k8_knowledge_publication_readiness()','EXECUTE')
  and not has_function_privilege('authenticated','public.k8_knowledge_publication_readiness()','EXECUTE'),
  'K8 quality/readiness audits must stay internal'
);

select pg_temp.k8_assert(
  has_function_privilege('service_role','public.k8_knowledge_seo_quality_audit()','EXECUTE')
  and has_function_privilege('service_role','public.k8_knowledge_publication_readiness()','EXECUTE'),
  'service role must be able to execute K8 audits'
);

select pg_temp.k8_assert(
  exists (
    select 1 from public.k8_knowledge_seo_quality_audit()
    where content_type='standard'
      and indexable_rows=6
      and missing_sources=0
      and missing_seo=0
      and stale_rows=0
      and structural_issues=0
  ),
  'published standards must pass source, SEO, freshness and structure checks'
);

select pg_temp.k8_assert(
  exists (
    select 1 from public.k8_knowledge_seo_quality_audit()
    where content_type='grade'
      and indexable_rows=10
      and missing_sources=0
      and missing_seo=0
      and stale_rows=0
      and structural_issues=0
  ),
  'published grades must pass source, SEO, freshness and structure checks'
);

select pg_temp.k8_assert(
  exists (
    select 1 from public.k8_knowledge_seo_quality_audit()
    where content_type='dimension'
      and total_rows=109
      and indexable_rows=109
      and missing_sources=0
      and structural_issues=0
  ),
  'all canonical K6 dimensions must be source-complete and uniquely slugged'
);

select pg_temp.k8_assert(
  exists (
    select 1 from public.k8_knowledge_seo_quality_audit()
    where content_type='size_hub'
      and total_rows=34
      and indexable_rows=34
      and structural_issues=0
  ),
  'K7 size hubs must remain free of thin pages'
);

select pg_temp.k8_assert(
  not exists (
    select 1
    from public.k8_knowledge_publication_readiness()
    where page_status='published' and ready=false
  ),
  'every published editorial page must pass the K8 readiness gate'
);

select pg_temp.k8_assert(
  exists (
    select 1
    from public.k8_knowledge_publication_readiness()
    where page_status='draft' and ready=false
  ),
  'draft editorial pages with blockers must stay visibly not ready'
);

rollback;
