-- PL1.3A hardening — keep RLS visibility helper out of the exposed API surface.

begin;

create schema if not exists pl1_private;

revoke all on schema pl1_private from public;
grant usage on schema pl1_private to anon, authenticated;

alter default privileges in schema pl1_private
  revoke execute on functions from public;

create or replace function pl1_private.version_visible_to(
  p_version_id uuid,
  p_audience text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.price_list_versions v
    join public.knowledge_documents d
      on d.id = v.primary_source_document_id
    join lateral (
      select g.decision, g.structured_data_visibility
      from public.price_list_source_governance_events g
      where g.knowledge_source_id = d.source_id
        and (g.knowledge_document_id = d.id or g.knowledge_document_id is null)
      order by g.decided_at desc, g.created_at desc, g.id desc
      limit 1
    ) g on true
    where v.id = p_version_id
      and v.status = 'published'
      and (
        (p_audience = 'public'
          and v.publication_scope = 'public'
          and g.decision = 'approved_public'
          and g.structured_data_visibility = 'public')
        or
        (p_audience = 'authenticated'
          and v.publication_scope in ('public','authenticated')
          and g.decision in ('approved_public','approved_authenticated')
          and g.structured_data_visibility in ('public','authenticated'))
      )
  );
$$;

revoke all on function pl1_private.version_visible_to(uuid, text)
  from public, anon, authenticated;
grant execute on function pl1_private.version_visible_to(uuid, text)
  to anon, authenticated;

create or replace function public.pl1_version_visible_to(
  p_version_id uuid,
  p_audience text
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select pl1_private.version_visible_to(p_version_id, p_audience);
$$;

revoke all on function public.pl1_version_visible_to(uuid, text) from public;
grant execute on function public.pl1_version_visible_to(uuid, text)
  to anon, authenticated;

commit;
