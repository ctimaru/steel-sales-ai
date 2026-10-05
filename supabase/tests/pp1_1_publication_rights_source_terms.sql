-- PP1.1 — Publication Rights & Source Terms acceptance.
begin;

create or replace function pg_temp.pp11_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PP1.1 assertion failed: %',message;
  end if;
end;
$$;

select pg_temp.pp11_assert(
  exists (
    select 1
    from public.price_list_source_governance_events g
    join public.price_list_versions v
      on v.primary_source_document_id=g.knowledge_document_id
    where v.manufacturer_version_code='PTC 18/2026'
      and g.decision_type='publication_rights'
      and g.decision='internal_only'
      and g.raw_document_visibility='internal'
      and g.structured_data_visibility='internal'
      and g.terms_reference='https://www.padanatubi.it/note-legali/'
      and g.evidence_snapshot->>'reviewed_at'='2026-10-05'
  ),
  'Padana publication-rights review must remain internal_only'
);

select pg_temp.pp11_assert(
  exists (
    select 1
    from public.price_list_source_governance_events g
    join public.price_list_versions v
      on v.primary_source_document_id=g.knowledge_document_id
    where v.manufacturer_version_code='PTC 18/2026'
      and g.decision_type='publication_rights'
      and g.decision='internal_only'
      and g.attribution_requirement ilike '%Attribution alone is not sufficient%'
      and g.evidence_snapshot->>'required_next_evidence' ilike '%Written Padana authorization%'
  ),
  'source attribution alone must not satisfy the publication-rights gate'
);

select pg_temp.pp11_assert(
  not has_function_privilege(
    'anon',
    'public.pl1_source_rights_review(uuid)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.pl1_source_rights_review(uuid)',
    'EXECUTE'
  ),
  'source-rights review RPC must remain internal'
);

select pg_temp.pp11_assert(
  not (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='pl1_source_rights_review'
  ),
  'source-rights review must remain SECURITY INVOKER'
);

select pg_temp.pp11_assert(
  position(
    'decision_type=''publication_rights'''
    in pg_get_functiondef('public.pl1_publication_readiness(uuid)'::regprocedure)
  )>0,
  'publication readiness must select publication-rights governance rather than unrelated events'
);

rollback;
