-- P0.7 advisor hardening.
-- Restore FK coverage lost when private entity identity moved from owner to
-- organization scope, index merge provenance, and make the client-deny RLS
-- posture on the internal merge audit table explicit.

create index if not exists knowledge_entities_owner_id_idx
  on public.knowledge_entities (owner_id)
  where owner_id is not null;

create index if not exists knowledge_entity_merge_audit_merged_by_idx
  on public.knowledge_entity_merge_audit (merged_by)
  where merged_by is not null;

drop policy if exists knowledge_entity_merge_audit_deny_client_access
  on public.knowledge_entity_merge_audit;
create policy knowledge_entity_merge_audit_deny_client_access
  on public.knowledge_entity_merge_audit
  for all
  to anon, authenticated
  using (false)
  with check (false);

comment on policy knowledge_entity_merge_audit_deny_client_access
  on public.knowledge_entity_merge_audit is
  'P0.7 defense-in-depth: merge governance audit is internal/service-role only; browser clients are explicitly denied by RLS in addition to revoked table privileges.';
