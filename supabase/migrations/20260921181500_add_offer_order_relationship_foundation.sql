-- PA2.2d — Offer/Order relationship columns and same-org workflow foundation.
-- Extends normalized Offer/Order entities only. No promotion ledger or backfill.

-- Parent lookup keys for new same-org composite references.
create unique index if not exists rfq_lines_org_id_id_uq
  on public.rfq_lines (organization_id, id);

-- OFFER HEADER
alter table public.offers
  add column if not exists rfq_id uuid,
  add column if not exists created_by_user_id uuid,
  add column if not exists assigned_to_user_id uuid,
  add column if not exists source_message_id uuid;

alter table public.offers
  add constraint offers_rfq_id_fkey
  foreign key (rfq_id)
  references public.rfqs(id)
  on delete set null;

alter table public.offers
  add constraint offers_created_by_user_id_fkey
  foreign key (created_by_user_id)
  references auth.users(id)
  on delete set null;

alter table public.offers
  add constraint offers_assigned_to_user_id_fkey
  foreign key (assigned_to_user_id)
  references auth.users(id)
  on delete set null;

alter table public.offers
  add constraint offers_source_message_id_fkey
  foreign key (source_message_id)
  references public.messages(id)
  on delete set null;

alter table public.offers
  add constraint offers_org_rfq_fkey
  foreign key (organization_id, rfq_id)
  references public.rfqs(organization_id, id);

alter table public.offers
  add constraint offers_org_source_message_fkey
  foreign key (organization_id, source_message_id)
  references public.messages(organization_id, id);

create index if not exists offers_rfq_id_idx on public.offers(rfq_id);
create index if not exists offers_created_by_user_id_idx on public.offers(created_by_user_id);
create index if not exists offers_assigned_to_user_id_idx on public.offers(assigned_to_user_id);
create index if not exists offers_source_message_id_idx on public.offers(source_message_id);

-- OFFER LINE
alter table public.offer_lines
  add column if not exists rfq_line_id uuid,
  add column if not exists canonical_product_id uuid,
  add column if not exists canonical_product_key text,
  add column if not exists source_observation_id bigint,
  add column if not exists raw_spec_text text;

alter table public.offer_lines
  add constraint offer_lines_rfq_line_id_fkey
  foreign key (rfq_line_id)
  references public.rfq_lines(id)
  on delete set null;

alter table public.offer_lines
  add constraint offer_lines_source_observation_id_fkey
  foreign key (source_observation_id)
  references public.commercial_observations(id)
  on delete set null;

alter table public.offer_lines
  add constraint offer_lines_org_rfq_line_fkey
  foreign key (organization_id, rfq_line_id)
  references public.rfq_lines(organization_id, id);

alter table public.offer_lines
  add constraint offer_lines_org_source_observation_fkey
  foreign key (organization_id, source_observation_id)
  references public.commercial_observations(organization_id, id);

create index if not exists offer_lines_rfq_line_id_idx on public.offer_lines(rfq_line_id);
create index if not exists offer_lines_canonical_product_id_idx on public.offer_lines(canonical_product_id);
create index if not exists offer_lines_canonical_product_key_idx on public.offer_lines(canonical_product_key);
create index if not exists offer_lines_source_observation_id_idx on public.offer_lines(source_observation_id);

-- ORDER HEADER
alter table public.orders
  add column if not exists rfq_id uuid,
  add column if not exists offer_id uuid,
  add column if not exists created_by_user_id uuid,
  add column if not exists assigned_to_user_id uuid,
  add column if not exists source_message_id uuid;

alter table public.orders
  add constraint orders_rfq_id_fkey
  foreign key (rfq_id)
  references public.rfqs(id)
  on delete set null;

alter table public.orders
  add constraint orders_offer_id_fkey
  foreign key (offer_id)
  references public.offers(id)
  on delete set null;

alter table public.orders
  add constraint orders_created_by_user_id_fkey
  foreign key (created_by_user_id)
  references auth.users(id)
  on delete set null;

alter table public.orders
  add constraint orders_assigned_to_user_id_fkey
  foreign key (assigned_to_user_id)
  references auth.users(id)
  on delete set null;

alter table public.orders
  add constraint orders_source_message_id_fkey
  foreign key (source_message_id)
  references public.messages(id)
  on delete set null;

alter table public.orders
  add constraint orders_org_rfq_fkey
  foreign key (organization_id, rfq_id)
  references public.rfqs(organization_id, id);

alter table public.orders
  add constraint orders_org_offer_fkey
  foreign key (organization_id, offer_id)
  references public.offers(organization_id, id);

alter table public.orders
  add constraint orders_org_source_message_fkey
  foreign key (organization_id, source_message_id)
  references public.messages(organization_id, id);

create index if not exists orders_rfq_id_idx on public.orders(rfq_id);
create index if not exists orders_offer_id_idx on public.orders(offer_id);
create index if not exists orders_created_by_user_id_idx on public.orders(created_by_user_id);
create index if not exists orders_assigned_to_user_id_idx on public.orders(assigned_to_user_id);
create index if not exists orders_source_message_id_idx on public.orders(source_message_id);

-- ORDER LINE
alter table public.order_lines
  add column if not exists offer_line_id uuid,
  add column if not exists canonical_product_id uuid,
  add column if not exists canonical_product_key text,
  add column if not exists source_observation_id bigint,
  add column if not exists raw_spec_text text;

alter table public.order_lines
  add constraint order_lines_offer_line_id_fkey
  foreign key (offer_line_id)
  references public.offer_lines(id)
  on delete set null;

alter table public.order_lines
  add constraint order_lines_source_observation_id_fkey
  foreign key (source_observation_id)
  references public.commercial_observations(id)
  on delete set null;

alter table public.order_lines
  add constraint order_lines_org_offer_line_fkey
  foreign key (organization_id, offer_line_id)
  references public.offer_lines(organization_id, id);

alter table public.order_lines
  add constraint order_lines_org_source_observation_fkey
  foreign key (organization_id, source_observation_id)
  references public.commercial_observations(organization_id, id);

create index if not exists order_lines_offer_line_id_idx on public.order_lines(offer_line_id);
create index if not exists order_lines_canonical_product_id_idx on public.order_lines(canonical_product_id);
create index if not exists order_lines_canonical_product_key_idx on public.order_lines(canonical_product_key);
create index if not exists order_lines_source_observation_id_idx on public.order_lines(source_observation_id);

-- User relationship validation. Workflow users must be active members of the row organization.
create or replace function private.validate_offer_order_membership_users()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assigned_to_user_id is not null and not exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = new.organization_id
      and m.user_id = new.assigned_to_user_id
      and m.status = 'active'
  ) then
    raise exception '% assigned user must be an active member of the organization', tg_table_name;
  end if;

  if new.created_by_user_id is not null and not exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = new.organization_id
      and m.user_id = new.created_by_user_id
      and m.status = 'active'
  ) then
    raise exception '% creator must be an active member of the organization', tg_table_name;
  end if;

  return new;
end;
$$;

revoke execute on function private.validate_offer_order_membership_users() from public;
revoke execute on function private.validate_offer_order_membership_users() from anon;
revoke execute on function private.validate_offer_order_membership_users() from authenticated;
grant execute on function private.validate_offer_order_membership_users() to service_role;

drop trigger if exists offers_validate_membership_users on public.offers;
create trigger offers_validate_membership_users
before insert or update of organization_id, assigned_to_user_id, created_by_user_id
on public.offers
for each row
execute function private.validate_offer_order_membership_users();

drop trigger if exists orders_validate_membership_users on public.orders;
create trigger orders_validate_membership_users
before insert or update of organization_id, assigned_to_user_id, created_by_user_id
on public.orders
for each row
execute function private.validate_offer_order_membership_users();

comment on column public.offers.rfq_id is
  'Optional RFQ that this offer answers. Same-organization constrained.';

comment on column public.offer_lines.rfq_line_id is
  'Optional RFQ line answered by this offer line. Same-organization constrained.';

comment on column public.orders.offer_id is
  'Optional accepted/converted offer that led to this order. Same-organization constrained.';

comment on column public.order_lines.offer_line_id is
  'Optional offer line converted into this order line. Same-organization constrained.';

comment on column public.offer_lines.raw_spec_text is
  'Snapshot of the offered specification for historical fidelity.';

comment on column public.order_lines.raw_spec_text is
  'Snapshot of the ordered specification for historical fidelity.';
