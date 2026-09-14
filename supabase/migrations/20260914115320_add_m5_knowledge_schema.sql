create table public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  access_scope text not null default 'owner' check (access_scope in ('owner', 'global')),
  source_key text not null,
  source_type text not null,
  source_class text not null default 'internal' check (source_class in ('internal', 'official', 'primary', 'secondary', 'inferred')),
  name text not null,
  provider text,
  source_uri text,
  country_code text,
  language_code text,
  license_name text,
  trust_score numeric check (trust_score is null or (trust_score >= 0 and trust_score <= 1)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (access_scope = 'owner' and owner_id is not null)
    or (access_scope = 'global' and owner_id is null)
  )
);

create unique index knowledge_sources_owner_key_uq
  on public.knowledge_sources (owner_id, source_key)
  where access_scope = 'owner';

create unique index knowledge_sources_global_key_uq
  on public.knowledge_sources (source_key)
  where access_scope = 'global';

create index knowledge_sources_owner_scope_idx
  on public.knowledge_sources (owner_id, access_scope);

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  external_id text,
  document_type text not null,
  title text,
  filename text,
  mime_type text,
  storage_path text,
  source_uri text,
  checksum_algorithm text not null default 'sha256',
  content_checksum text not null,
  document_version text,
  language_code text,
  published_at timestamptz,
  valid_from date,
  valid_to date,
  fetched_at timestamptz,
  extracted_at timestamptz,
  extraction_method text,
  extraction_version text,
  status text not null default 'ready' check (status in ('pending', 'ready', 'failed', 'superseded')),
  supersedes_document_id uuid references public.knowledge_documents(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, source_id),
  unique (source_id, checksum_algorithm, content_checksum),
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

create unique index knowledge_documents_external_version_uq
  on public.knowledge_documents (source_id, external_id, coalesce(document_version, ''))
  where external_id is not null;

create index knowledge_documents_source_status_idx
  on public.knowledge_documents (source_id, status, created_at desc);

create index knowledge_documents_published_idx
  on public.knowledge_documents (published_at desc)
  where published_at is not null;

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null,
  document_id uuid not null,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  checksum_algorithm text not null default 'sha256',
  content_checksum text not null,
  language_code text,
  token_count integer check (token_count is null or token_count >= 0),
  char_start integer check (char_start is null or char_start >= 0),
  char_end integer check (char_end is null or char_end >= 0),
  page_start integer check (page_start is null or page_start >= 1),
  page_end integer check (page_end is null or page_end >= 1),
  section_path text[] not null default '{}'::text[],
  source_locator jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (document_id, source_id)
    references public.knowledge_documents(id, source_id)
    on delete cascade,
  unique (document_id, chunk_index),
  unique (id, document_id, source_id),
  check (char_end is null or char_start is null or char_end >= char_start),
  check (page_end is null or page_start is null or page_end >= page_start)
);

create index knowledge_chunks_source_document_idx
  on public.knowledge_chunks (source_id, document_id, chunk_index);

create index knowledge_chunks_checksum_idx
  on public.knowledge_chunks (content_checksum);

create table public.knowledge_evidence (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null,
  document_id uuid not null,
  chunk_id uuid,
  evidence_type text not null default 'fact' check (evidence_type in ('quote', 'fact', 'table_cell', 'metadata')),
  subject_type text,
  subject_key text,
  predicate text,
  object_value jsonb,
  evidence_text text,
  confidence numeric not null default 1 check (confidence >= 0 and confidence <= 1),
  extraction_method text,
  extraction_version text,
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed', 'confirmed', 'rejected', 'corrected')),
  valid_from date,
  valid_to date,
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (document_id, source_id)
    references public.knowledge_documents(id, source_id)
    on delete cascade,
  foreign key (chunk_id, document_id, source_id)
    references public.knowledge_chunks(id, document_id, source_id)
    on delete cascade,
  check (valid_to is null or valid_from is null or valid_to >= valid_from),
  check (chunk_id is not null or evidence_text is not null or object_value is not null)
);

create index knowledge_evidence_source_document_idx
  on public.knowledge_evidence (source_id, document_id, created_at desc);

create index knowledge_evidence_subject_idx
  on public.knowledge_evidence (subject_type, subject_key)
  where subject_type is not null and subject_key is not null;

create index knowledge_evidence_review_idx
  on public.knowledge_evidence (review_status, confidence);

comment on table public.knowledge_sources is
  'Authoritative registry of private owner-scoped and global curated knowledge sources.';
comment on table public.knowledge_documents is
  'Versioned source documents with checksums, validity, extraction metadata and provenance.';
comment on table public.knowledge_chunks is
  'Deterministic text chunks derived from knowledge documents; embeddings are added in M5.2 as derived indexes.';
comment on table public.knowledge_evidence is
  'Evidence/claim records grounded in a document or chunk, with confidence and review state.';

alter table public.knowledge_sources enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.knowledge_evidence enable row level security;

revoke all on table public.knowledge_sources from public, anon, authenticated;
revoke all on table public.knowledge_documents from public, anon, authenticated;
revoke all on table public.knowledge_chunks from public, anon, authenticated;
revoke all on table public.knowledge_evidence from public, anon, authenticated;

grant select on table public.knowledge_sources to authenticated;
grant select on table public.knowledge_documents to authenticated;
grant select on table public.knowledge_chunks to authenticated;
grant select on table public.knowledge_evidence to authenticated;

grant select, insert, update, delete on table public.knowledge_sources to service_role;
grant select, insert, update, delete on table public.knowledge_documents to service_role;
grant select, insert, update, delete on table public.knowledge_chunks to service_role;
grant select, insert, update, delete on table public.knowledge_evidence to service_role;

create policy knowledge_sources_read_visible
  on public.knowledge_sources
  for select
  to authenticated
  using (
    access_scope = 'global'
    or owner_id = (select auth.uid())
  );

create policy knowledge_documents_read_visible
  on public.knowledge_documents
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.knowledge_sources s
      where s.id = knowledge_documents.source_id
        and (s.access_scope = 'global' or s.owner_id = (select auth.uid()))
    )
  );

create policy knowledge_chunks_read_visible
  on public.knowledge_chunks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.knowledge_sources s
      where s.id = knowledge_chunks.source_id
        and (s.access_scope = 'global' or s.owner_id = (select auth.uid()))
    )
  );

create policy knowledge_evidence_read_visible
  on public.knowledge_evidence
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.knowledge_sources s
      where s.id = knowledge_evidence.source_id
        and (s.access_scope = 'global' or s.owner_id = (select auth.uid()))
    )
  );
