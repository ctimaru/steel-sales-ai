-- DASH-NEXT1C.4B — organization-private, explicit Network relationship and immutable activity ledger.
-- Distinct from public Network identity, personal bookmarks and verified Company 360.
-- No automatic Company 360 links, RFQ suppliers, contacts, orders, or outreach.
create table public.crm_network_relationships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  network_company_id uuid not null references public.network_companies(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint crm_c4b_org_network_unique unique (organization_id,network_company_id),
  constraint crm_c4b_id_org_unique unique (id,organization_id)
);

create index crm_c4b_relationships_org_created_idx
  on public.crm_network_relationships(organization_id,created_at desc);

create table public.crm_network_relationship_events (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null,
  organization_id uuid not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null,
  note text,
  created_at timestamptz not null default now(),
  constraint crm_c4b_event_fk foreign key(relationship_id,organization_id)
    references public.crm_network_relationships(id,organization_id) on delete restrict,
  constraint crm_c4b_event_type_check check (event_type in ('created','note','call','meeting','follow_up')),
  constraint crm_c4b_event_note_check check(
    (event_type='created' and note is null)
    or (event_type<>'created' and char_length(btrim(note)) between 1 and 1200)
  )
);
create index crm_c4b_events_org_relationship_idx
  on public.crm_network_relationship_events(organization_id,relationship_id,created_at desc);

alter table public.crm_network_relationships enable row level security;
alter table public.crm_network_relationship_events enable row level security;
revoke all on public.crm_network_relationships from public,anon,authenticated;
revoke all on public.crm_network_relationship_events from public,anon,authenticated;
grant select on public.crm_network_relationships to authenticated;
grant insert(organization_id,network_company_id,created_by)
  on public.crm_network_relationships to authenticated;
grant select on public.crm_network_relationship_events to authenticated;
grant insert(relationship_id,organization_id,actor_user_id,event_type,note)
  on public.crm_network_relationship_events to authenticated;
grant select,insert,update,delete on public.crm_network_relationships to service_role;
grant select,insert,update,delete on public.crm_network_relationship_events to service_role;

-- Both read/write are explicitly organization-bound and Network-entitled.
-- A viewer can read shared activity but cannot insert relationships or events.
create policy crm_c4b_relationship_read on public.crm_network_relationships
for select to authenticated
using (
  exists(select 1 from public.organization_memberships om
    where om.user_id=(select auth.uid())
      and om.organization_id=organization_id and om.status='active')
  and private.pa1_3_network_access_allowed_for(organization_id)
);
create policy crm_c4b_relationship_create on public.crm_network_relationships
for insert to authenticated
with check (
  created_by=(select auth.uid())
  and exists(select 1 from public.organization_memberships om
    where om.user_id=(select auth.uid())
      and om.organization_id=organization_id and om.status='active'
      and om.role in ('admin','member'))
  and private.pa1_3_network_access_allowed_for(organization_id)
  and exists(select 1 from public.network_companies nc
    where nc.id=network_company_id and nc.publication_status='published')
);
create policy crm_c4b_event_read on public.crm_network_relationship_events
for select to authenticated
using (
  exists(select 1 from public.organization_memberships om
    where om.user_id=(select auth.uid())
      and om.organization_id=organization_id and om.status='active')
  and private.pa1_3_network_access_allowed_for(organization_id)
);
create policy crm_c4b_event_append on public.crm_network_relationship_events
for insert to authenticated
with check (
  actor_user_id=(select auth.uid())
  and event_type in ('note','call','meeting','follow_up')
  and exists(select 1 from public.organization_memberships om
    where om.user_id=(select auth.uid())
      and om.organization_id=organization_id and om.status='active'
      and om.role in ('admin','member'))
  and private.pa1_3_network_access_allowed_for(organization_id)
  and exists(select 1 from public.crm_network_relationships r
    where r.id=relationship_id and r.organization_id=organization_id)
);
-- No UPDATE/DELETE policies and no user GRANT: ledger and identity keys immutable.
-- Inserting a new relationship atomically creates its provenance event.
create or replace function private.crm_c4b_record_initial_event()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  insert into public.crm_network_relationship_events
    (relationship_id,organization_id,actor_user_id,event_type,note)
  values (new.id,new.organization_id,new.created_by,'created',null);
  return new;
end;
$function$;
revoke all on function private.crm_c4b_record_initial_event() from public,anon,authenticated;
create trigger crm_c4b_created_audit
after insert on public.crm_network_relationships
for each row execute function private.crm_c4b_record_initial_event();

comment on table public.crm_network_relationships is
  'C4B: one organization-owned prospect per published Network company; no implied Company 360 identity or supplier status.';
comment on table public.crm_network_relationship_events is
  'C4B: immutable organization-scoped append-only commercial event ledger, no automatic supplier outreach.';
