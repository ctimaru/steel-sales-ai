-- TRUST-AUDIT1C.2B
-- Defense in depth: superseded commercial knowledge is inaccessible to
-- ordinary authenticated Data API clients while audit metadata remains available
-- to privileged, lawful remediation workflows.
-- Matches the production Supabase migration ledger entry 20261022152031.
-- Service-role/privileged definer paths need their own authorization audits.

drop policy if exists trust_no_superseded_knowledge_documents
  on public.knowledge_documents;
create policy trust_no_superseded_knowledge_documents
  on public.knowledge_documents
  as restrictive
  for select
  to authenticated
  using (status <> 'superseded');

drop policy if exists trust_no_superseded_knowledge_chunks
  on public.knowledge_chunks;
create policy trust_no_superseded_knowledge_chunks
  on public.knowledge_chunks
  as restrictive
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.knowledge_documents d
      where d.id = knowledge_chunks.document_id
        and d.source_id = knowledge_chunks.source_id
        and d.status <> 'superseded'
    )
  );
