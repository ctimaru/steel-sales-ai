-- PA2.2b — organization-safe ownership / same-org FK foundation.
-- Normalized private business tables are organization-owned. Existing simple
-- foreign keys remain in place during the expand phase to preserve their
-- current delete semantics; composite foreign keys add tenant-coherence.

-- These tables are currently empty in production. Make the tenant boundary
-- explicit before they become the normalized business system of record.
alter table public.companies alter column organization_id set not null;
alter table public.contacts alter column organization_id set not null;
alter table public.conversations alter column organization_id set not null;
alter table public.messages alter column organization_id set not null;
alter table public.documents alter column organization_id set not null;
alter table public.products alter column organization_id set not null;
alter table public.rfqs alter column organization_id set not null;
alter table public.rfq_lines alter column organization_id set not null;
alter table public.offers alter column organization_id set not null;
alter table public.offer_lines alter column organization_id set not null;
alter table public.orders alter column organization_id set not null;
alter table public.order_lines alter column organization_id set not null;
alter table public.price_history alter column organization_id set not null;

-- Parent lookup keys for organization-safe composite foreign keys.
create unique index if not exists companies_org_id_id_uq
  on public.companies (organization_id, id);
create unique index if not exists conversations_org_id_id_uq
  on public.conversations (organization_id, id);
create unique index if not exists messages_org_id_id_uq
  on public.messages (organization_id, id);
create unique index if not exists products_org_id_id_uq
  on public.products (organization_id, id);
create unique index if not exists rfqs_org_id_id_uq
  on public.rfqs (organization_id, id);
create unique index if not exists offers_org_id_id_uq
  on public.offers (organization_id, id);
create unique index if not exists offer_lines_org_id_id_uq
  on public.offer_lines (organization_id, id);
create unique index if not exists orders_org_id_id_uq
  on public.orders (organization_id, id);

do $pa22b$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.contacts'::regclass
      and conname='contacts_org_company_fkey'
  ) then
    alter table public.contacts
      add constraint contacts_org_company_fkey
      foreign key (organization_id, company_id)
      references public.companies (organization_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.conversations'::regclass
      and conname='conversations_org_company_fkey'
  ) then
    alter table public.conversations
      add constraint conversations_org_company_fkey
      foreign key (organization_id, company_id)
      references public.companies (organization_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.messages'::regclass
      and conname='messages_org_conversation_fkey'
  ) then
    alter table public.messages
      add constraint messages_org_conversation_fkey
      foreign key (organization_id, conversation_id)
      references public.conversations (organization_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.documents'::regclass
      and conname='documents_org_conversation_fkey'
  ) then
    alter table public.documents
      add constraint documents_org_conversation_fkey
      foreign key (organization_id, conversation_id)
      references public.conversations (organization_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.documents'::regclass
      and conname='documents_org_message_fkey'
  ) then
    alter table public.documents
      add constraint documents_org_message_fkey
      foreign key (organization_id, message_id)
      references public.messages (organization_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.documents'::regclass
      and conname='documents_org_company_fkey'
  ) then
    alter table public.documents
      add constraint documents_org_company_fkey
      foreign key (organization_id, company_id)
      references public.companies (organization_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.rfqs'::regclass
      and conname='rfqs_org_conversation_fkey'
  ) then
    alter table public.rfqs
      add constraint rfqs_org_conversation_fkey
      foreign key (organization_id, conversation_id)
      references public.conversations (organization_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.rfqs'::regclass
      and conname='rfqs_org_company_fkey'
  ) then
    alter table public.rfqs
      add constraint rfqs_org_company_fkey
      foreign key (organization_id, company_id)
      references public.companies (organization_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.rfq_lines'::regclass
      and conname='rfq_lines_org_rfq_fkey'
  ) then
    alter table public.rfq_lines
      add constraint rfq_lines_org_rfq_fkey
      foreign key (organization_id, rfq_id)
      references public.rfqs (organization_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.rfq_lines'::regclass
      and conname='rfq_lines_org_product_fkey'
  ) then
    alter table public.rfq_lines
      add constraint rfq_lines_org_product_fkey
      foreign key (organization_id, product_id)
      references public.products (organization_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.offers'::regclass
      and conname='offers_org_conversation_fkey'
  ) then
    alter table public.offers
      add constraint offers_org_conversation_fkey
      foreign key (organization_id, conversation_id)
      references public.conversations (organization_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.offers'::regclass
      and conname='offers_org_company_fkey'
  ) then
    alter table public.offers
      add constraint offers_org_company_fkey
      foreign key (organization_id, company_id)
      references public.companies (organization_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.offer_lines'::regclass
      and conname='offer_lines_org_offer_fkey'
  ) then
    alter table public.offer_lines
      add constraint offer_lines_org_offer_fkey
      foreign key (organization_id, offer_id)
      references public.offers (organization_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.offer_lines'::regclass
      and conname='offer_lines_org_product_fkey'
  ) then
    alter table public.offer_lines
      add constraint offer_lines_org_product_fkey
      foreign key (organization_id, product_id)
      references public.products (organization_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.orders'::regclass
      and conname='orders_org_conversation_fkey'
  ) then
    alter table public.orders
      add constraint orders_org_conversation_fkey
      foreign key (organization_id, conversation_id)
      references public.conversations (organization_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.orders'::regclass
      and conname='orders_org_company_fkey'
  ) then
    alter table public.orders
      add constraint orders_org_company_fkey
      foreign key (organization_id, company_id)
      references public.companies (organization_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.order_lines'::regclass
      and conname='order_lines_org_order_fkey'
  ) then
    alter table public.order_lines
      add constraint order_lines_org_order_fkey
      foreign key (organization_id, order_id)
      references public.orders (organization_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.order_lines'::regclass
      and conname='order_lines_org_product_fkey'
  ) then
    alter table public.order_lines
      add constraint order_lines_org_product_fkey
      foreign key (organization_id, product_id)
      references public.products (organization_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.price_history'::regclass
      and conname='price_history_org_company_fkey'
  ) then
    alter table public.price_history
      add constraint price_history_org_company_fkey
      foreign key (organization_id, company_id)
      references public.companies (organization_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.price_history'::regclass
      and conname='price_history_org_product_fkey'
  ) then
    alter table public.price_history
      add constraint price_history_org_product_fkey
      foreign key (organization_id, product_id)
      references public.products (organization_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.price_history'::regclass
      and conname='price_history_org_offer_line_fkey'
  ) then
    alter table public.price_history
      add constraint price_history_org_offer_line_fkey
      foreign key (organization_id, offer_line_id)
      references public.offer_lines (organization_id, id);
  end if;
end
$pa22b$;
