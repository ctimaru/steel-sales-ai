-- NC2.1 — Segregated Inbox Schema
-- Additive, non-dispatching database foundation. No client writes, no realtime
-- publication, no email/push, no backfill or source-system modifications.
-- The NC1.3 event catalog is the source of truth for canonical event types.

create table public.workspace_notification_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  contract_version text not null default 'NC1.3-v1'
    check (contract_version = 'NC1.3-v1'),
  event_type text not null check (
    event_type in (
      'workspace.rfq.response_received',
      'workspace.rfq.clarification_requested',
      'workspace.rfq.award_confirmed',
      'workspace.rfq.supplier_confirmation_received',
      'workspace.marketplace.opportunity_matched',
      'workspace.import.failed',
      'workspace.operations.regression_detected'
    )
  ),
  source_table text not null,
  source_event_id text not null check (
    char_length(source_event_id) between 1 and 128
    and source_event_id ~ '^[A-Za-z0-9:_-]+$'
  ),
  source_revision integer not null check (source_revision >= 1),
  priority text not null check (priority in ('informational','action_required','critical')),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint nc21_workspace_event_source_type check (
    (event_type like 'workspace.rfq.%' and source_table = 'buyer_rfq_events')
    or (event_type = 'workspace.marketplace.opportunity_matched' and source_table = 'marketplace_notifications')
    or (event_type = 'workspace.import.failed' and source_table = 'worker_jobs')
    or (event_type = 'workspace.operations.regression_detected' and source_table = 'operational_alerts')
  ),
  constraint nc21_workspace_dedupe unique (
    organization_id,event_type,source_table,source_event_id,source_revision
  ),
  constraint nc21_workspace_event_org_pair unique (id,organization_id)
);

create table public.platform_notification_events (
  id uuid primary key default gen_random_uuid(),
  contract_version text not null default 'NC1.3-v1'
    check (contract_version = 'NC1.3-v1'),
  event_type text not null check (
    event_type in (
      'platform.registration.submitted',
      'platform.registration.information_provided',
      'platform.claim.requested',
      'platform.infrastructure.critical_incident'
    )
  ),
  source_table text not null,
  source_event_id text not null check (
    char_length(source_event_id) between 1 and 128
    and source_event_id ~ '^[A-Za-z0-9:_-]+$'
  ),
  source_revision integer not null check (source_revision >= 1),
  priority text not null check (priority in ('informational','action_required','critical')),
  required_permission_key text not null
    references public.platform_permissions(permission_key) on delete restrict,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint nc21_platform_event_source_permission check (
    (event_type in ('platform.registration.submitted','platform.registration.information_provided')
      and source_table = 'platform_registration_events'
      and required_permission_key = 'registrations.review')
    or (event_type = 'platform.claim.requested'
      and source_table = 'network_company_claims'
      and required_permission_key = 'claims.read')
    or (event_type = 'platform.infrastructure.critical_incident'
      and source_table = 'observability_events'
      and required_permission_key = 'platform.audit.read')
  ),
  constraint nc21_platform_dedupe unique (
    event_type,source_table,source_event_id,source_revision
  ),
  constraint nc21_platform_event_permission_pair unique (id,required_permission_key)
);

-- States are personalized: a user's read/archive never marks another user's
-- notification read or changes an RFQ/Marketplace/original operational alert.
create table public.workspace_notification_recipients (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  organization_id uuid not null,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  archived_at timestamptz,
  constraint nc21_workspace_recipient_event_fk
    foreign key (event_id,organization_id)
    references public.workspace_notification_events(id,organization_id) on delete cascade,
  constraint nc21_workspace_one_recipient unique (event_id,recipient_user_id),
  constraint nc21_workspace_recipient_lifecycle check (
    archived_at is null or (read_at is not null and archived_at >= read_at)
  )
);

create table public.platform_notification_recipients (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  required_permission_key text not null,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  archived_at timestamptz,
  constraint nc21_platform_recipient_event_fk
    foreign key (event_id,required_permission_key)
    references public.platform_notification_events(id,required_permission_key) on delete cascade,
  constraint nc21_platform_one_recipient unique (event_id,recipient_user_id),
  constraint nc21_platform_recipient_lifecycle check (
    archived_at is null or (read_at is not null and archived_at >= read_at)
  )
);

-- Bounding/paging indexes, source replays and per-user unread counters.
create index nc21_workspace_event_recent_idx
  on public.workspace_notification_events(organization_id,created_at desc,id desc);
create index nc21_platform_event_recent_idx
  on public.platform_notification_events(created_at desc,id desc);
create index nc21_workspace_user_recent_idx
  on public.workspace_notification_recipients(organization_id,recipient_user_id,created_at desc,id desc);
create index nc21_workspace_user_unread_idx
  on public.workspace_notification_recipients(organization_id,recipient_user_id,created_at desc)
  where read_at is null and archived_at is null;
create index nc21_platform_user_recent_idx
  on public.platform_notification_recipients(recipient_user_id,created_at desc,id desc);
create index nc21_platform_user_unread_idx
  on public.platform_notification_recipients(recipient_user_id,created_at desc)
  where read_at is null and archived_at is null;

-- RLS applies even if someone later grants direct REST/Realtime table access.
alter table public.workspace_notification_events enable row level security;
alter table public.workspace_notification_recipients enable row level security;
alter table public.platform_notification_events enable row level security;
alter table public.platform_notification_recipients enable row level security;

-- Explicit minimal grants; service_role is the ONLY event/recipient writer.
revoke all on public.workspace_notification_events,
  public.workspace_notification_recipients,
  public.platform_notification_events,
  public.platform_notification_recipients from public,anon,authenticated;
grant select on public.workspace_notification_events,
  public.workspace_notification_recipients,
  public.platform_notification_events,
  public.platform_notification_recipients to authenticated;
grant all on public.workspace_notification_events,
  public.workspace_notification_recipients,
  public.platform_notification_events,
  public.platform_notification_recipients to service_role;

-- Recipients: active membership is rechecked on every read.
create policy nc21_workspace_recipient_read on public.workspace_notification_recipients
  for select to authenticated
  using (
    recipient_user_id = (select auth.uid())
    and public.is_organization_member(organization_id,false)
  );

-- Events are reference-only and visible strictly through a user's recipient row.
create policy nc21_workspace_event_read on public.workspace_notification_events
  for select to authenticated
  using (
    public.is_organization_member(organization_id,false)
    and exists (
      select 1 from public.workspace_notification_recipients r
      where r.event_id = workspace_notification_events.id
        and r.organization_id = workspace_notification_events.organization_id
        and r.recipient_user_id = (select auth.uid())
    )
  );

-- Platform permission is checked live (role revocations hide existing messages).
-- Never equate a Platform Owner/Staff grant with tenant membership.
create policy nc21_platform_recipient_read on public.platform_notification_recipients
  for select to authenticated
  using (
    recipient_user_id = (select auth.uid())
    and public.has_platform_permission(required_permission_key)
  );

create policy nc21_platform_event_read on public.platform_notification_events
  for select to authenticated
  using (
    public.has_platform_permission(required_permission_key)
    and exists (
      select 1 from public.platform_notification_recipients r
      where r.event_id = platform_notification_events.id
        and r.required_permission_key = platform_notification_events.required_permission_key
        and r.recipient_user_id = (select auth.uid())
    )
  );

-- No UPDATE/INSERT/DELETE policies for authenticated. All future state transitions
-- must go through NC2.2/NC3 business logic with rechecked per-user permissions.
-- No grants or policies for anon; no REPLICA IDENTITY FULL or realtime publication.
