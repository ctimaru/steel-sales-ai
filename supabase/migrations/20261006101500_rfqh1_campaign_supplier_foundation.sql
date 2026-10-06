-- RFQH1 — Campaign & Supplier Target Foundation.
-- Buyer Distinta remains the immutable request content snapshot.
-- RFQ Hub orchestrates one buyer request across N private supplier targets.

create table if not exists public.buyer_rfq_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_distinta_id uuid not null references public.buyer_distintas(id) on delete restrict,
  marketplace_request_id uuid null references public.marketplace_requests(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  status text not null default 'draft'
    check (status in ('draft','ready','launched','collecting','awarded','closed','cancelled')),
  due_at timestamptz null,
  delivery_country_code text null
    check (delivery_country_code is null or delivery_country_code ~ '^[A-Z]{2}$'),
  delivery_region text null,
  incoterm text null,
  payment_terms text null,
  buyer_message text null check (buyer_message is null or char_length(buyer_message) <= 4000),
  launched_at timestamptz null,
  awarded_at timestamptz null,
  closed_at timestamptz null,
  cancelled_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status in ('draft','ready') and launched_at is null)
    or (status in ('launched','collecting','awarded','closed','cancelled'))
  )
);

create table if not exists public.buyer_rfq_suppliers (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.buyer_rfq_campaigns(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  supplier_organization_id uuid null references public.organizations(id) on delete restrict,
  supplier_network_company_id uuid null references public.network_companies(id) on delete restrict,
  supplier_name text null check (supplier_name is null or char_length(btrim(supplier_name)) between 1 and 200),
  supplier_email text null,
  supplier_email_normalized text null,
  status text not null default 'draft'
    check (status in ('draft','queued','sent','delivered','opened','responded','declined','bounced','failed','cancelled','awarded')),
  delivery_channel text not null default 'email'
    check (delivery_channel in ('email','platform','both')),
  invite_token_hash text null,
  provider_message_id text null,
  last_error text null,
  queued_at timestamptz null,
  sent_at timestamptz null,
  delivered_at timestamptz null,
  opened_at timestamptz null,
  responded_at timestamptz null,
  declined_at timestamptz null,
  awarded_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    supplier_organization_id is not null
    or supplier_network_company_id is not null
    or supplier_email_normalized is not null
  ),
  check (
    supplier_email_normalized is null
    or supplier_email_normalized = lower(btrim(supplier_email_normalized))
  )
);

create table if not exists public.buyer_rfq_events (
  id uuid primary key default gen_random_uuid(),
  event_sequence bigint generated always as identity unique,
  rfq_id uuid not null references public.buyer_rfq_campaigns(id) on delete cascade,
  supplier_id uuid null references public.buyer_rfq_suppliers(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid null references auth.users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata)='object' and pg_column_size(metadata) <= 16384),
  created_at timestamptz not null default now()
);

create unique index if not exists buyer_rfq_suppliers_rfq_email_uidx
  on public.buyer_rfq_suppliers(rfq_id, supplier_email_normalized)
  where supplier_email_normalized is not null;

create unique index if not exists buyer_rfq_suppliers_rfq_org_uidx
  on public.buyer_rfq_suppliers(rfq_id, supplier_organization_id)
  where supplier_organization_id is not null;

create unique index if not exists buyer_rfq_suppliers_rfq_network_company_uidx
  on public.buyer_rfq_suppliers(rfq_id, supplier_network_company_id)
  where supplier_network_company_id is not null;

create index if not exists buyer_rfq_campaigns_owner_created_idx
  on public.buyer_rfq_campaigns(owner_user_id, created_at desc);

create index if not exists buyer_rfq_suppliers_rfq_created_idx
  on public.buyer_rfq_suppliers(rfq_id, created_at);

create index if not exists buyer_rfq_events_rfq_sequence_idx
  on public.buyer_rfq_events(rfq_id, event_sequence);

alter table public.buyer_rfq_campaigns enable row level security;
alter table public.buyer_rfq_suppliers enable row level security;
alter table public.buyer_rfq_events enable row level security;

revoke all on public.buyer_rfq_campaigns from anon, authenticated;
revoke all on public.buyer_rfq_suppliers from anon, authenticated;
revoke all on public.buyer_rfq_events from anon, authenticated;

grant select, insert on public.buyer_rfq_campaigns to authenticated;
grant select, insert on public.buyer_rfq_suppliers to authenticated;
grant select on public.buyer_rfq_events to authenticated;

drop policy if exists buyer_rfq_campaigns_owner_select on public.buyer_rfq_campaigns;
create policy buyer_rfq_campaigns_owner_select
on public.buyer_rfq_campaigns for select to authenticated
using (owner_user_id=(select auth.uid()));

drop policy if exists buyer_rfq_campaigns_owner_insert on public.buyer_rfq_campaigns;
create policy buyer_rfq_campaigns_owner_insert
on public.buyer_rfq_campaigns for insert to authenticated
with check (
  owner_user_id=(select auth.uid())
  and status='draft'
  and exists (
    select 1
    from public.buyer_distintas d
    where d.id=source_distinta_id
      and d.owner_user_id=(select auth.uid())
      and d.organization_id=buyer_rfq_campaigns.organization_id
  )
);

drop policy if exists buyer_rfq_suppliers_owner_select on public.buyer_rfq_suppliers;
create policy buyer_rfq_suppliers_owner_select
on public.buyer_rfq_suppliers for select to authenticated
using (owner_user_id=(select auth.uid()));

drop policy if exists buyer_rfq_suppliers_owner_insert on public.buyer_rfq_suppliers;
create policy buyer_rfq_suppliers_owner_insert
on public.buyer_rfq_suppliers for insert to authenticated
with check (
  owner_user_id=(select auth.uid())
  and status='draft'
  and exists (
    select 1
    from public.buyer_rfq_campaigns r
    where r.id=rfq_id
      and r.owner_user_id=(select auth.uid())
      and r.status in ('draft','ready')
  )
);

drop policy if exists buyer_rfq_events_owner_select on public.buyer_rfq_events;
create policy buyer_rfq_events_owner_select
on public.buyer_rfq_events for select to authenticated
using (owner_user_id=(select auth.uid()));

create or replace function private.rfqh1_log_campaign_created()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into public.buyer_rfq_events(
    rfq_id, owner_user_id, organization_id, actor_user_id, event_type, metadata
  ) values (
    new.id, new.owner_user_id, new.organization_id, new.owner_user_id,
    'campaign_created',
    jsonb_build_object('source_distinta_id', new.source_distinta_id, 'status', new.status)
  );
  return new;
end;
$$;

revoke all on function private.rfqh1_log_campaign_created()
from public, anon, authenticated;

drop trigger if exists buyer_rfq_campaign_created_event on public.buyer_rfq_campaigns;
create trigger buyer_rfq_campaign_created_event
after insert on public.buyer_rfq_campaigns
for each row execute function private.rfqh1_log_campaign_created();

create or replace function private.rfqh1_log_supplier_added()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_org_id uuid;
begin
  select r.organization_id into v_org_id
  from public.buyer_rfq_campaigns r
  where r.id=new.rfq_id;

  insert into public.buyer_rfq_events(
    rfq_id, supplier_id, owner_user_id, organization_id,
    actor_user_id, event_type, metadata
  ) values (
    new.rfq_id, new.id, new.owner_user_id, v_org_id,
    new.owner_user_id, 'supplier_added',
    jsonb_build_object(
      'supplier_organization_id', new.supplier_organization_id,
      'supplier_network_company_id', new.supplier_network_company_id,
      'supplier_email', new.supplier_email_normalized,
      'delivery_channel', new.delivery_channel
    )
  );
  return new;
end;
$$;

revoke all on function private.rfqh1_log_supplier_added()
from public, anon, authenticated;

drop trigger if exists buyer_rfq_supplier_added_event on public.buyer_rfq_suppliers;
create trigger buyer_rfq_supplier_added_event
after insert on public.buyer_rfq_suppliers
for each row execute function private.rfqh1_log_supplier_added();

create or replace function public.rfqh1_create_campaign_from_distinta(
  p_distinta_id uuid,
  p_due_at timestamptz default null,
  p_buyer_message text default null
)
returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_distinta public.buyer_distintas%rowtype;
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authenticated user required' using errcode='42501';
  end if;

  select *
  into v_distinta
  from public.buyer_distintas d
  where d.id=p_distinta_id
    and d.owner_user_id=v_user_id;

  if not found then
    raise exception 'Buyer Distinta not found or not owned by caller' using errcode='42501';
  end if;

  if v_distinta.organization_id is null then
    raise exception 'Active organization required before creating an RFQ';
  end if;

  if p_due_at is not null and p_due_at <= now() then
    raise exception 'RFQ due date must be in the future';
  end if;

  if p_buyer_message is not null and char_length(p_buyer_message) > 4000 then
    raise exception 'RFQ message too long';
  end if;

  insert into public.buyer_rfq_campaigns(
    owner_user_id, organization_id, source_distinta_id, title, due_at, buyer_message
  ) values (
    v_user_id, v_distinta.organization_id, v_distinta.id,
    v_distinta.title, p_due_at, nullif(btrim(p_buyer_message),'')
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.rfqh1_create_campaign_from_distinta(uuid,timestamptz,text)
from public, anon, authenticated;
grant execute on function public.rfqh1_create_campaign_from_distinta(uuid,timestamptz,text)
to authenticated;

create or replace function public.rfqh1_add_supplier(
  p_rfq_id uuid,
  p_supplier_name text default null,
  p_supplier_email text default null,
  p_supplier_network_company_id uuid default null,
  p_supplier_organization_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_rfq public.buyer_rfq_campaigns%rowtype;
  v_email text := nullif(lower(btrim(coalesce(p_supplier_email,''))),'');
  v_name text := nullif(btrim(coalesce(p_supplier_name,'')),'');
  v_id uuid;
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'Authenticated user required' using errcode='42501';
  end if;

  select *
  into v_rfq
  from public.buyer_rfq_campaigns r
  where r.id=p_rfq_id
    and r.owner_user_id=v_user_id;

  if not found then
    raise exception 'RFQ not found or not owned by caller' using errcode='42501';
  end if;

  if v_rfq.status not in ('draft','ready') then
    raise exception 'Suppliers can only be added before launch';
  end if;

  select count(*) into v_count
  from public.buyer_rfq_suppliers s
  where s.rfq_id=p_rfq_id;

  if v_count >= 100 then
    raise exception 'Maximum 100 suppliers per RFQ';
  end if;

  if v_email is not null
     and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Supplier email is invalid';
  end if;

  if v_name is not null and char_length(v_name) > 200 then
    raise exception 'Supplier name is too long';
  end if;

  if v_email is null
     and p_supplier_network_company_id is null
     and p_supplier_organization_id is null then
    raise exception 'At least one supplier identity is required';
  end if;

  insert into public.buyer_rfq_suppliers(
    rfq_id, owner_user_id, supplier_organization_id,
    supplier_network_company_id, supplier_name,
    supplier_email, supplier_email_normalized
  ) values (
    p_rfq_id, v_user_id, p_supplier_organization_id,
    p_supplier_network_company_id, v_name, v_email, v_email
  )
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'Supplier already added to this RFQ';
end;
$$;

revoke all on function public.rfqh1_add_supplier(uuid,text,text,uuid,uuid)
from public, anon, authenticated;
grant execute on function public.rfqh1_add_supplier(uuid,text,text,uuid,uuid)
to authenticated;
