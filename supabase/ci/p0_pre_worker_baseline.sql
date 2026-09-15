-- CI-only schema baseline representing the production application schema
-- immediately before the first worker migration committed in this repository.
-- This file is copied into supabase/migrations only inside disposable CI.
-- It must never be pushed to production as a migration.

create extension if not exists pgcrypto;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  name text not null,
  company_type text,
  country text,
  vat_number text,
  website text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  company_id uuid references public.companies(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  role text,
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  company_id uuid references public.companies(id) on delete set null,
  subject text,
  external_thread_id text,
  status text default 'open',
  started_at timestamptz,
  last_activity_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  external_message_id text,
  direction text,
  sender_email text,
  recipient_emails text[],
  sent_at timestamptz,
  subject text,
  body_text text,
  clean_body_text text,
  classification text,
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  conversation_id uuid references public.conversations(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  document_type text,
  filename text not null,
  mime_type text,
  storage_path text,
  extracted_text text,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  product_type text,
  standard text,
  grade text,
  material_number text,
  manufacturing_process text,
  outer_diameter_mm numeric(12,3),
  width_mm numeric(12,3),
  height_mm numeric(12,3),
  thickness_mm numeric(12,3),
  length_mm numeric(12,3),
  certificate_type text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.rfqs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  conversation_id uuid references public.conversations(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  requested_at timestamptz,
  status text default 'open',
  notes text,
  created_at timestamptz not null default now()
);

create table public.rfq_lines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  rfq_id uuid references public.rfqs(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  requested_quantity numeric(14,3),
  quantity_unit text,
  requested_grade text,
  requested_standard text,
  min_length_mm numeric(12,3),
  max_length_mm numeric(12,3),
  substitution_allowed boolean,
  notes text,
  created_at timestamptz not null default now()
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  conversation_id uuid references public.conversations(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  offered_at timestamptz,
  valid_until date,
  currency text default 'EUR',
  delivery_term text,
  payment_terms text,
  status text default 'draft',
  notes text,
  created_at timestamptz not null default now()
);

create table public.offer_lines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  offer_id uuid references public.offers(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity numeric(14,3),
  quantity_unit text,
  price_value numeric(14,4),
  price_unit text,
  price_type text default 'direct',
  discount_percentage numeric(7,3),
  availability_status text,
  available_from date,
  source_text text,
  confidence numeric(5,4),
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  conversation_id uuid references public.conversations(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  ordered_at timestamptz,
  customer_order_ref text,
  status text default 'received',
  notes text,
  created_at timestamptz not null default now()
);

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  order_id uuid references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity numeric(14,3),
  quantity_unit text,
  unit_price numeric(14,4),
  price_unit text,
  promised_date date,
  created_at timestamptz not null default now()
);

create table public.availability (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  company_id uuid references public.companies(id) on delete set null,
  product_id uuid references public.products(id) on delete cascade,
  status text default 'unknown',
  quantity numeric(14,3),
  quantity_unit text,
  available_from date,
  source_document_id uuid references public.documents(id) on delete set null,
  source_message_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  order_id uuid references public.orders(id) on delete set null,
  planned_date date,
  delivered_date date,
  destination text,
  transport_type text,
  special_transport boolean default false,
  notes text,
  created_at timestamptz not null default now()
);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  product_id uuid references public.products(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  certificate_type text,
  certificate_number text,
  issuer text,
  created_at timestamptz not null default now()
);

create table public.extracted_fields (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  document_id uuid references public.documents(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  entity_type text,
  entity_id uuid,
  field_name text not null,
  field_value_json jsonb,
  source_text text,
  confidence numeric(5,4),
  extraction_model text,
  reviewed boolean not null default false,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.price_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  company_id uuid references public.companies(id) on delete set null,
  product_id uuid references public.products(id) on delete cascade,
  offer_line_id uuid references public.offer_lines(id) on delete set null,
  observed_at timestamptz not null default now(),
  currency text not null default 'EUR',
  price_value numeric(14,4) not null,
  price_unit text not null,
  normalized_eur_per_m numeric(14,4),
  normalized_eur_per_t numeric(14,4),
  created_at timestamptz not null default now()
);

-- App-facing commercial read models, already in their pre-worker production shape.
create table public.commercial_datasets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid default auth.uid() references auth.users(id) on delete cascade,
  source_run_id uuid not null,
  source_filename text,
  parser_version text,
  email_count integer not null default 0,
  thread_count integer not null default 0,
  message_count integer not null default 0,
  extraction_count integer not null default 0,
  status text not null default 'ready',
  created_at timestamptz not null default now(),
  unique (owner_id, source_run_id)
);

create table public.commercial_threads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid default auth.uid() references auth.users(id) on delete cascade,
  dataset_id uuid not null references public.commercial_datasets(id) on delete cascade,
  source_conversation_id uuid not null,
  subject text,
  classification text,
  started_at timestamptz,
  last_activity_at timestamptz,
  email_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (owner_id, dataset_id, source_conversation_id)
);

create table public.commercial_observations (
  id bigint generated by default as identity primary key,
  owner_id uuid default auth.uid() references auth.users(id) on delete cascade,
  dataset_id uuid not null references public.commercial_datasets(id) on delete cascade,
  thread_id uuid not null references public.commercial_threads(id) on delete cascade,
  source_extraction_id bigint,
  source_conversation_id uuid not null,
  item_role text not null,
  role_method text,
  direction text,
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
  source_filename text,
  source_text text,
  source_clause text,
  confidence numeric,
  flags jsonb not null default '[]'::jsonb,
  search_text text,
  created_at timestamptz not null default now()
);

create table public.commercial_review_queue (
  id bigint generated by default as identity primary key,
  owner_id uuid default auth.uid() references auth.users(id) on delete cascade,
  dataset_id uuid not null references public.commercial_datasets(id) on delete cascade,
  thread_id uuid not null references public.commercial_threads(id) on delete cascade,
  source_review_id bigint not null,
  source_extraction_ordinal integer,
  reason text not null,
  severity text not null default 'warning',
  source_text text,
  status text not null default 'pending',
  corrected_values jsonb,
  reviewed_at timestamptz,
  observation_id bigint references public.commercial_observations(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (owner_id, dataset_id, source_review_id)
);

-- RLS must be active before P0 replaces owner policies with organization policies.
do $$
declare
  t text;
begin
  foreach t in array array[
    'companies','contacts','conversations','messages','documents','products','rfqs','rfq_lines',
    'offers','offer_lines','orders','order_lines','availability','deliveries','certificates',
    'extracted_fields','price_history','commercial_datasets','commercial_threads',
    'commercial_observations','commercial_review_queue'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- CI permissions approximate the Supabase project defaults used by the app.
grant select, insert, update, delete on
  public.companies, public.contacts, public.conversations, public.messages,
  public.documents, public.products, public.rfqs, public.rfq_lines,
  public.offers, public.offer_lines, public.orders, public.order_lines,
  public.availability, public.deliveries, public.certificates,
  public.extracted_fields, public.price_history
to authenticated;

grant select on public.commercial_datasets, public.commercial_threads,
  public.commercial_observations, public.commercial_review_queue
to authenticated;
grant update (status, corrected_values, reviewed_at)
  on public.commercial_review_queue to authenticated;
