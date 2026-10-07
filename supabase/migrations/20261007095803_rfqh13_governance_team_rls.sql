create table public.buyer_procurement_governance (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  require_award_approval boolean not null default false,
  require_po_approval boolean not null default false,
  approval_expiry_hours integer not null default 168
    check (approval_expiry_hours between 1 and 720),
  operational_event_retention_days integer not null default 730
    check (operational_event_retention_days between 30 and 3650),
  webhook_payload_retention_days integer not null default 90
    check (webhook_payload_retention_days between 7 and 730),
  commercial_record_retention_days integer null
    check (commercial_record_retention_days is null or commercial_record_retention_days between 365 and 7300),
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index buyer_procurement_governance_updated_by_idx
  on public.buyer_procurement_governance(updated_by)
  where updated_by is not null;

alter table public.buyer_procurement_governance enable row level security;
revoke all on table public.buyer_procurement_governance from anon;
revoke insert, update, delete on table public.buyer_procurement_governance from authenticated;
grant select on table public.buyer_procurement_governance to authenticated;

create policy buyer_procurement_governance_member_select
on public.buyer_procurement_governance
for select to authenticated
using (public.is_organization_member(organization_id,false));

create table public.buyer_rfq_team_members (
  rfq_id uuid not null references public.buyer_rfq_campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('collaborator','approver')),
  status text not null default 'active' check (status in ('active','revoked')),
  added_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz null,
  primary key (rfq_id,user_id)
);

create index buyer_rfq_team_members_user_idx on public.buyer_rfq_team_members(user_id);
create index buyer_rfq_team_members_org_idx on public.buyer_rfq_team_members(organization_id);
create index buyer_rfq_team_members_added_by_idx on public.buyer_rfq_team_members(added_by);
create index buyer_rfq_team_members_active_idx
  on public.buyer_rfq_team_members(rfq_id,role,user_id)
  where status='active';

alter table public.buyer_rfq_team_members enable row level security;
revoke all on table public.buyer_rfq_team_members from anon;
revoke insert, update, delete on table public.buyer_rfq_team_members from authenticated;
grant select on table public.buyer_rfq_team_members to authenticated;

create table public.buyer_procurement_approvals (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.buyer_rfq_campaigns(id) on delete cascade,
  po_draft_id uuid null references public.buyer_purchase_order_drafts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  action_type text not null check (action_type in ('award','po_issue')),
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','expired','cancelled','consumed')),
  reason text null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  decided_by uuid null references auth.users(id) on delete restrict,
  decided_at timestamptz null,
  decision_note text null,
  consumed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index buyer_procurement_approvals_rfq_status_idx
  on public.buyer_procurement_approvals(rfq_id,status,requested_at desc);
create index buyer_procurement_approvals_po_idx
  on public.buyer_procurement_approvals(po_draft_id)
  where po_draft_id is not null;
create index buyer_procurement_approvals_org_idx
  on public.buyer_procurement_approvals(organization_id,status);
create index buyer_procurement_approvals_requested_by_idx
  on public.buyer_procurement_approvals(requested_by);
create index buyer_procurement_approvals_decided_by_idx
  on public.buyer_procurement_approvals(decided_by)
  where decided_by is not null;
create unique index buyer_procurement_approvals_live_payload_uniq
  on public.buyer_procurement_approvals(
    rfq_id,action_type,
    coalesce(po_draft_id,'00000000-0000-0000-0000-000000000000'::uuid),
    payload_sha256
  )
  where status in ('pending','approved');

alter table public.buyer_procurement_approvals enable row level security;
revoke all on table public.buyer_procurement_approvals from anon;
revoke insert, update, delete on table public.buyer_procurement_approvals from authenticated;
grant select on table public.buyer_procurement_approvals to authenticated;

create or replace function private.rfqh13_is_org_admin(
  p_organization_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(exists(
    select 1 from public.organization_memberships m
    where m.organization_id=p_organization_id
      and m.user_id=p_user_id
      and m.status='active'
      and m.role='admin'
  ),false);
$$;

create or replace function private.rfqh13_can_view_rfq(
  p_rfq_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(exists(
    select 1 from public.buyer_rfq_campaigns r
    where r.id=p_rfq_id
      and (
        r.owner_user_id=p_user_id
        or private.rfqh13_is_org_admin(r.organization_id,p_user_id)
        or exists(
          select 1 from public.buyer_rfq_team_members tm
          where tm.rfq_id=r.id and tm.user_id=p_user_id and tm.status='active'
        )
      )
  ),false);
$$;

create or replace function private.rfqh13_can_manage_rfq(
  p_rfq_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(exists(
    select 1 from public.buyer_rfq_campaigns r
    where r.id=p_rfq_id
      and (
        r.owner_user_id=p_user_id
        or private.rfqh13_is_org_admin(r.organization_id,p_user_id)
        or exists(
          select 1 from public.buyer_rfq_team_members tm
          where tm.rfq_id=r.id and tm.user_id=p_user_id and tm.status='active'
            and tm.role='collaborator'
        )
      )
  ),false);
$$;

create or replace function private.rfqh13_can_manage_team(
  p_rfq_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(exists(
    select 1 from public.buyer_rfq_campaigns r
    where r.id=p_rfq_id
      and (r.owner_user_id=p_user_id or private.rfqh13_is_org_admin(r.organization_id,p_user_id))
  ),false);
$$;

create or replace function private.rfqh13_can_approve_rfq(
  p_rfq_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(exists(
    select 1 from public.buyer_rfq_campaigns r
    where r.id=p_rfq_id
      and (
        private.rfqh13_is_org_admin(r.organization_id,p_user_id)
        or exists(
          select 1 from public.buyer_rfq_team_members tm
          where tm.rfq_id=r.id and tm.user_id=p_user_id and tm.status='active'
            and tm.role='approver'
        )
      )
  ),false);
$$;

create policy buyer_rfq_team_members_viewer_select
on public.buyer_rfq_team_members for select to authenticated
using (private.rfqh13_can_view_rfq(rfq_id,(select auth.uid())));

create policy buyer_procurement_approvals_viewer_select
on public.buyer_procurement_approvals for select to authenticated
using (private.rfqh13_can_view_rfq(rfq_id,(select auth.uid())));

create policy buyer_rfq_campaigns_team_select on public.buyer_rfq_campaigns
for select to authenticated using (private.rfqh13_can_view_rfq(id,(select auth.uid())));
create policy buyer_rfq_suppliers_team_select on public.buyer_rfq_suppliers
for select to authenticated using (private.rfqh13_can_view_rfq(rfq_id,(select auth.uid())));
create policy buyer_rfq_dispatches_team_select on public.buyer_rfq_dispatches
for select to authenticated using (private.rfqh13_can_view_rfq(rfq_id,(select auth.uid())));
create policy buyer_rfq_quotes_team_select on public.buyer_rfq_quotes
for select to authenticated using (private.rfqh13_can_view_rfq(rfq_id,(select auth.uid())));
create policy buyer_rfq_quote_lines_team_select on public.buyer_rfq_quote_lines
for select to authenticated using (exists(
  select 1 from public.buyer_rfq_quotes q
  where q.id=buyer_rfq_quote_lines.quote_id
    and private.rfqh13_can_view_rfq(q.rfq_id,(select auth.uid()))
));
create policy buyer_rfq_negotiation_threads_team_select on public.buyer_rfq_negotiation_threads
for select to authenticated using (private.rfqh13_can_view_rfq(rfq_id,(select auth.uid())));
create policy buyer_rfq_negotiation_messages_team_select on public.buyer_rfq_negotiation_messages
for select to authenticated using (private.rfqh13_can_view_rfq(rfq_id,(select auth.uid())));
create policy buyer_rfq_negotiation_targets_team_select on public.buyer_rfq_negotiation_targets
for select to authenticated using (exists(
  select 1 from public.buyer_rfq_negotiation_threads t
  where t.id=buyer_rfq_negotiation_targets.thread_id
    and private.rfqh13_can_view_rfq(t.rfq_id,(select auth.uid()))
));
create policy buyer_rfq_events_team_select on public.buyer_rfq_events
for select to authenticated using (private.rfqh13_can_view_rfq(rfq_id,(select auth.uid())));
create policy buyer_rfq_awards_team_select on public.buyer_rfq_awards
for select to authenticated using (private.rfqh13_can_view_rfq(rfq_id,(select auth.uid())));
create policy buyer_rfq_award_allocations_team_select on public.buyer_rfq_award_allocations
for select to authenticated using (private.rfqh13_can_view_rfq(rfq_id,(select auth.uid())));
create policy buyer_purchase_order_drafts_team_select on public.buyer_purchase_order_drafts
for select to authenticated using (private.rfqh13_can_view_rfq(rfq_id,(select auth.uid())));
create policy buyer_purchase_order_lines_team_select on public.buyer_purchase_order_lines
for select to authenticated using (exists(
  select 1 from public.buyer_purchase_order_drafts p
  where p.id=buyer_purchase_order_lines.po_draft_id
    and private.rfqh13_can_view_rfq(p.rfq_id,(select auth.uid()))
));
create policy buyer_purchase_order_versions_team_select on public.buyer_purchase_order_versions
for select to authenticated using (private.rfqh13_can_view_rfq(rfq_id,(select auth.uid())));
create policy buyer_purchase_order_version_lines_team_select on public.buyer_purchase_order_version_lines
for select to authenticated using (exists(
  select 1 from public.buyer_purchase_order_versions v
  where v.id=buyer_purchase_order_version_lines.po_version_id
    and private.rfqh13_can_view_rfq(v.rfq_id,(select auth.uid()))
));
create policy buyer_purchase_order_supplier_responses_team_select on public.buyer_purchase_order_supplier_responses
for select to authenticated using (private.rfqh13_can_view_rfq(rfq_id,(select auth.uid())));
create policy buyer_distintas_shared_rfq_select on public.buyer_distintas
for select to authenticated using (exists(
  select 1 from public.buyer_rfq_campaigns r
  where r.source_distinta_id=buyer_distintas.id
    and private.rfqh13_can_view_rfq(r.id,(select auth.uid()))
));
create policy buyer_distinta_lines_shared_rfq_select on public.buyer_distinta_lines
for select to authenticated using (exists(
  select 1 from public.buyer_rfq_campaigns r
  where r.source_distinta_id=buyer_distinta_lines.distinta_id
    and private.rfqh13_can_view_rfq(r.id,(select auth.uid()))
));
