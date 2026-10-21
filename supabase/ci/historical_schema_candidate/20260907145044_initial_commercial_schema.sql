create extension if not exists pgcrypto;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  name text not null,
  company_type text check (company_type in ('customer','supplier','producer','distributor','other')),
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
  status text check (status in ('open','won','lost','archived')) default 'open',
  started_at timestamptz,
  last_activity_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  external_message_id text,
  direction text check (direction in ('inbound','outbound')),
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
  product_type text check (product_type in ('round_tube','square_tube','rectangular_tube','other')),
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
  status text check (status in ('open','quoted','closed','cancelled')) default 'open',
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
  status text check (status in ('draft','sent','accepted','rejected','expired')) default 'draft',
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
  price_type text check (price_type in ('direct','discount','calculated','unknown')) default 'direct',
  discount_percentage numeric(7,3),
  availability_status text,
  available_from date,
  source_text text,
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  conversation_id uuid references public.conversations(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  ordered_at timestamptz,
  customer_order_ref text,
  status text check (status in ('received','confirmed','in_production','ready','shipped','delivered','cancelled')) default 'received',
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
  status text check (status in ('stock','production','not_available','unknown')) default 'unknown',
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
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
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

create index idx_companies_owner on public.companies(owner_id);
create index idx_contacts_company on public.contacts(company_id);
create index idx_conversations_company on public.conversations(company_id);
create index idx_messages_conversation on public.messages(conversation_id);
create index idx_messages_sent_at on public.messages(sent_at desc);
create index idx_documents_conversation on public.documents(conversation_id);
create index idx_products_round_dims on public.products(outer_diameter_mm, thickness_mm, length_mm);
create index idx_products_grade_standard on public.products(grade, standard);
create index idx_offer_lines_product on public.offer_lines(product_id);
create index idx_price_history_product_date on public.price_history(product_id, observed_at desc);

alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.documents enable row level security;
alter table public.products enable row level security;
alter table public.rfqs enable row level security;
alter table public.rfq_lines enable row level security;
alter table public.offers enable row level security;
alter table public.offer_lines enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
alter table public.availability enable row level security;
alter table public.deliveries enable row level security;
alter table public.certificates enable row level security;
alter table public.extracted_fields enable row level security;
alter table public.price_history enable row level security;

create policy companies_owner_all on public.companies for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy contacts_owner_all on public.contacts for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy conversations_owner_all on public.conversations for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy messages_owner_all on public.messages for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy documents_owner_all on public.documents for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy products_owner_all on public.products for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy rfqs_owner_all on public.rfqs for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy rfq_lines_owner_all on public.rfq_lines for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy offers_owner_all on public.offers for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy offer_lines_owner_all on public.offer_lines for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy orders_owner_all on public.orders for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy order_lines_owner_all on public.order_lines for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy availability_owner_all on public.availability for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy deliveries_owner_all on public.deliveries for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy certificates_owner_all on public.certificates for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy extracted_fields_owner_all on public.extracted_fields for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy price_history_owner_all on public.price_history for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
