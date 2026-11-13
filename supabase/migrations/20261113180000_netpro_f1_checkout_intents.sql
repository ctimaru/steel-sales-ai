-- NET-PRO-CATALOG1.F.1 — Private Stripe checkout intent record.
-- No payment, subscription or entitlement is granted by this migration.
create table public.network_pro_checkout_intents(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  module_keys text[] not null,
  territory text not null,
  billing_interval text not null,
  stripe_price_id text not null,
  stripe_checkout_session_id text unique,
  stripe_subscription_id text unique,
  stripe_customer_id text,
  status text not null default 'pending',
  paid_until timestamptz,
  last_paid_invoice_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint netpro_f1_modules check(
    cardinality(module_keys) between 1 and 4
    and module_keys <@ array['producers','distributors','end_users','processors']::text[]
    and array_position(module_keys,null) is null
  ),
  constraint netpro_f1_territory check(territory in ('IT','EU')),
  constraint netpro_f1_interval check(billing_interval in ('monthly','annual')),
  constraint netpro_f1_price check(stripe_price_id ~ '^price_[A-Za-z0-9]{10,}$'),
  constraint netpro_f1_status check(status in ('pending','paid','expired','canceled'))
);
-- An organization cannot accidentally open multiple pending subscriptions.
create unique index network_pro_checkout_intents_active_org
  on public.network_pro_checkout_intents(organization_id)
  where status in ('pending','paid');
create index network_pro_checkout_intents_sub_idx
  on public.network_pro_checkout_intents(stripe_subscription_id)
  where stripe_subscription_id is not null;
alter table public.network_pro_checkout_intents enable row level security;
revoke all on public.network_pro_checkout_intents from public,anon,authenticated;
grant select,insert,update on public.network_pro_checkout_intents to service_role;

comment on table public.network_pro_checkout_intents is
  'Private, server-only checkout sessions; Stripe payment confirmation is required before a PRO entitlement. Browser roles have no CRUD.';
