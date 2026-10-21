create table if not exists staging.thread_payloads (
  conversation_id uuid primary key references staging.conversations(id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  extractions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists staging_thread_payloads_gin on staging.thread_payloads using gin (extractions);