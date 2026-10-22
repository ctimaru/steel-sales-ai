-- TRUST-AUDIT1C.2C — quarantine-derived Knowledge read protection.
-- Runtime policy already accepted on staging and production on 2026-10-22.
-- Strictly limits authenticated direct table reads. It does NOT remove data or
-- protect privileged SECURITY DEFINER / service_role paths; audit separately.
-- Production migration ledger version: 20261022153144.

drop policy if exists trust_no_superseded_entity_mentions
  on public.knowledge_entity_mentions;

create policy trust_no_superseded_entity_mentions
  on public.knowledge_entity_mentions
  as restrictive
  for select
  to authenticated
  using (
    document_id is null or exists (
      select 1
      from public.knowledge_documents d
      where d.id = knowledge_entity_mentions.document_id
        and d.source_id = knowledge_entity_mentions.source_id
        and d.status <> 'superseded'
    )
  );

drop policy if exists trust_no_superseded_knowledge_evidence
  on public.knowledge_evidence;

create policy trust_no_superseded_knowledge_evidence
  on public.knowledge_evidence
  as restrictive
  for select
  to authenticated
  using (
    document_id is null or exists (
      select 1
      from public.knowledge_documents d
      where d.id = knowledge_evidence.document_id
        and d.source_id = knowledge_evidence.source_id
        and d.status <> 'superseded'
    )
  );
