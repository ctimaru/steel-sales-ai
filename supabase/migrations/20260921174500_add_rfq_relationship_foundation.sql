-- PA2.2c — RFQ relationship columns and status foundation.
-- Extends normalized RFQ business entities only. No offer/order or promotion writer changes.

-- Parent keys needed for same-organization composite references.
create unique index if not exists contacts_org_id_id_uq
  on public.contacts (organization_id, id);

create unique index if not exists commercial_observations_org_id_id_uq
  on public.commercial_observations (organization_id, id);

-- RFQ header relationships and workflow metadata.
alter table public.rfqs
  add column if not exists contact_id uuid,
  add column if not exists assigned_to_user_id uuid,
  add column if not exists source_message_id uuid,
  add column if not exists due_at timestamptz,
  add column if not exists priority text not null default 'normal',
  add column if not exists created_by_user_id uuid;

alter table public.rfqs
  drop constraint if exists rfqs_status_check;

alter table public.rfqs
  alter column status set default 'new',
  alter column status set not null;

alter table public.rfqs
  add constraint rfqs_status_check
  check (status in (
    'new',
    'review_needed',
    'qualified',
    'in_progress',
    'quoted',
    'closed_won',
    'closed_lost',
    'cancelled'
  ));

alter table public.rfqs
  add constraint rfqs_priority_check
  check (priority in ('low', 'normal', 'high', 'urgent'));

alter table public.rfqs
  add constraint rfqs_contact_id_fkey
  foreign key (contact_id)
  references public.contacts(id)
  on delete set null;

alter table public.rfqs
  add constraint rfqs_assigned_to_user_id_fkey
  foreign key (assigned_to_user_id)
  references auth.users(id)
  on delete set null;

alter table public.rfqs
  add constraint rfqs_source_message_id_fkey
  foreign key (source_message_id)
  references public.messages(id)
  on delete set null;

alter table public.rfqs
  add constraint rfqs_created_by_user_id_fkey
  foreign key (created_by_user_id)
  references auth.users(id)
  on delete set null;

alter table public.rfqs
  add constraint rfqs_org_contact_fkey
  foreign key (organization_id, contact_id)
  references public.contacts(organization_id, id);

alter table public.rfqs
  add constraint rfqs_org_source_message_fkey
  foreign key (organization_id, source_message_id)
  references public.messages(organization_id, id);

create index if not exists rfqs_contact_id_idx on public.rfqs(contact_id);
create index if not exists rfqs_assigned_to_user_id_idx on public.rfqs(assigned_to_user_id);
create index if not exists rfqs_source_message_id_idx on public.rfqs(source_message_id);
create index if not exists rfqs_created_by_user_id_idx on public.rfqs(created_by_user_id);
create index if not exists rfqs_due_at_idx on public.rfqs(due_at);
create index if not exists rfqs_priority_idx on public.rfqs(priority);

-- Business-role user references must resolve to active memberships in the same org.
create or replace function private.validate_rfq_membership_users()
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
    raise exception 'RFQ assigned user must be an active member of the organization';
  end if;

  if new.created_by_user_id is not null and not exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = new.organization_id
      and m.user_id = new.created_by_user_id
      and m.status = 'active'
  ) then
    raise exception 'RFQ creator must be an active member of the organization';
  end if;

  return new;
end;
$$;

revoke execute on function private.validate_rfq_membership_users() from public;
revoke execute on function private.validate_rfq_membership_users() from anon;
revoke execute on function private.validate_rfq_membership_users() from authenticated;
grant execute on function private.validate_rfq_membership_users() to service_role;

drop trigger if exists rfqs_validate_membership_users on public.rfqs;
create trigger rfqs_validate_membership_users
before insert or update of organization_id, assigned_to_user_id, created_by_user_id
on public.rfqs
for each row
execute function private.validate_rfq_membership_users();

-- RFQ line identity/evidence snapshot.
alter table public.rfq_lines
  add column if not exists canonical_product_id uuid,
  add column if not exists canonical_product_key text,
  add column if not exists source_observation_id bigint,
  add column if not exists requested_delivery_date date,
  add column if not exists raw_spec_text text;

alter table public.rfq_lines
  add constraint rfq_lines_source_observation_id_fkey
  foreign key (source_observation_id)
  references public.commercial_observations(id)
  on delete set null;

alter table public.rfq_lines
  add constraint rfq_lines_org_source_observation_fkey
  foreign key (organization_id, source_observation_id)
  references public.commercial_observations(organization_id, id);

create index if not exists rfq_lines_canonical_product_id_idx
  on public.rfq_lines(canonical_product_id);

create index if not exists rfq_lines_canonical_product_key_idx
  on public.rfq_lines(canonical_product_key);

create index if not exists rfq_lines_source_observation_id_idx
  on public.rfq_lines(source_observation_id);

comment on column public.rfqs.assigned_to_user_id is
  'Sales workflow assignee. Must be an active member of the same organization; not an ownership boundary.';

comment on column public.rfqs.created_by_user_id is
  'User who created or promoted the RFQ business entity. Must be an active member of the same organization.';

comment on column public.rfq_lines.raw_spec_text is
  'Immutable-style snapshot of the original requested product specification used for historical fidelity.';

comment on column public.rfq_lines.canonical_product_id is
  'Optional technical identity reference. No shared/private ownership transfer is implied.';
