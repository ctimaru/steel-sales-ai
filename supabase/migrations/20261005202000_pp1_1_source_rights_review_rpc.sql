-- PP1.1 — expose latest internal publication-rights review to authorized preview users.

begin;

create or replace function public.pl1_source_rights_review(
  p_version_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  v_source_id uuid;
  v_document_id uuid;
  v_event public.price_list_source_governance_events%rowtype;
begin
  if (select auth.uid()) is null
     or not (
       public.has_platform_permission('knowledge.read_drafts')
       or public.has_platform_permission('knowledge.review')
       or public.has_platform_permission('knowledge.publish')
     ) then
    raise exception 'Platform permission required: knowledge.read_drafts'
      using errcode='42501';
  end if;

  select d.source_id,v.primary_source_document_id
    into v_source_id,v_document_id
  from public.price_list_versions v
  join public.knowledge_documents d on d.id=v.primary_source_document_id
  where v.id=p_version_id;

  if v_document_id is null then
    return null;
  end if;

  select g.*
    into v_event
  from public.price_list_source_governance_events g
  where g.knowledge_source_id=v_source_id
    and (g.knowledge_document_id=v_document_id or g.knowledge_document_id is null)
    and g.decision_type='publication_rights'
  order by g.decided_at desc,g.created_at desc,g.id desc
  limit 1;

  if v_event.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'decision',v_event.decision,
    'raw_document_visibility',v_event.raw_document_visibility,
    'structured_data_visibility',v_event.structured_data_visibility,
    'attribution_requirement',v_event.attribution_requirement,
    'terms_reference',v_event.terms_reference,
    'evidence_snapshot',v_event.evidence_snapshot,
    'rationale',v_event.rationale,
    'decided_at',v_event.decided_at
  );
end;
$$;

revoke all on function public.pl1_source_rights_review(uuid)
from public,anon;

grant execute on function public.pl1_source_rights_review(uuid)
to authenticated;

comment on function public.pl1_source_rights_review(uuid) is
  'PP1.1 internal publication-rights review for the source behind a price-list version.';

commit;
