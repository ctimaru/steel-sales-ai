create schema if not exists staging;
revoke all on schema staging from anon, authenticated;

create table if not exists staging.import_batches (
  id uuid primary key default gen_random_uuid(),
  source_filename text not null,
  sample_method text,
  status text not null default 'processing',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists staging.conversations (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references staging.import_batches(id) on delete cascade,
  external_thread_id text not null,
  company_name text,
  subject text,
  classification text,
  started_at timestamptz,
  last_activity_at timestamptz,
  actual_message_count integer not null default 0,
  embedded_message_count integer not null default 0,
  reconstruction_confidence numeric,
  created_at timestamptz not null default now(),
  unique(batch_id, external_thread_id)
);

create table if not exists staging.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references staging.conversations(id) on delete cascade,
  external_message_id text,
  parent_external_message_id text,
  is_embedded boolean not null default false,
  direction text,
  sender_email text,
  sender_name text,
  recipient_emails text[],
  sent_at timestamptz,
  sent_at_raw text,
  subject text,
  raw_body text,
  clean_body text,
  source_filename text,
  content_hash text,
  classification text,
  created_at timestamptz not null default now()
);
create unique index if not exists staging_messages_hash_uq on staging.messages(conversation_id, content_hash) where content_hash is not null;

create table if not exists staging.product_extractions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references staging.conversations(id) on delete cascade,
  message_id uuid references staging.messages(id) on delete set null,
  product_type text,
  grade text,
  standard text,
  material_number text,
  outer_diameter_mm numeric,
  width_mm numeric,
  height_mm numeric,
  thickness_mm numeric,
  length_mm numeric,
  quantity numeric,
  quantity_unit text,
  price_value numeric,
  price_unit text,
  currency text,
  discount_percentage numeric,
  availability_status text,
  available_from date,
  delivery_term text,
  substitution_allowed boolean,
  source_text text,
  confidence numeric,
  extraction_method text,
  created_at timestamptz not null default now()
);

create index if not exists staging_conv_batch_idx on staging.conversations(batch_id);
create index if not exists staging_msg_conv_idx on staging.messages(conversation_id);
create index if not exists staging_ext_conv_idx on staging.product_extractions(conversation_id);
