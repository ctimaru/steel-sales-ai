-- SA2 — Platform RBAC Foundation.
--
-- Adds the delegated Platform Staff/RBAC substrate while keeping the existing
-- platform_superadmin authorization path untouched. No existing Platform RPC
-- is cut over in SA2: the current singleton root remains the production
-- authority until each domain is migrated deliberately in SA4+.

create table public.platform_permissions (
  permission_key text primary key,
  area text not null,
  action text not null,
  risk_level text not null,
  description text not null,
  is_root_only boolean not null default false,
  created_at timestamptz not null default now(),
  constraint platform_permissions_key_check
    check (permission_key ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_.]*$'),
  constraint platform_permissions_area_check
    check (area in ('platform','registrations','discovery','claims','knowledge','tenant_access')),
  constraint platform_permissions_risk_check
    check (risk_level in ('low','medium','high','critical'))
);

create table public.platform_roles (
  role_key text primary key,
  label text not null,
  description text not null,
  status text not null default 'active',
  is_system_role boolean not null default true,
  created_at timestamptz not null default now(),
  constraint platform_roles_key_check
    check (role_key ~ '^[a-z][a-z0-9_]*$'),
  constraint platform_roles_status_check
    check (status in ('active','retired'))
);

create table public.platform_role_permissions (
  role_key text not null references public.platform_roles(role_key) on delete restrict,
  permission_key text not null references public.platform_permissions(permission_key) on delete restrict,
  created_at timestamptz not null default now(),
  constraint platform_role_permissions_pkey primary key (role_key, permission_key)
);

create table public.platform_staff_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  status text not null default 'pending',
  invited_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_by uuid null references auth.users(id) on delete restrict,
  accepted_at timestamptz null,
  revoked_by uuid null references auth.users(id) on delete restrict,
  revoked_at timestamptz null,
  expired_at timestamptz null,
  reason text null,
  constraint platform_staff_invitations_email_check
    check (email = lower(btrim(email)) and email <> ''),
  constraint platform_staff_invitations_status_check
    check (status in ('pending','accepted','revoked','expired')),
  constraint platform_staff_invitations_lifecycle_check
    check (
      (status='pending' and accepted_by is null and accepted_at is null and revoked_by is null and revoked_at is null and expired_at is null)
      or
      (status='accepted' and accepted_by is not null and accepted_at is not null and revoked_by is null and revoked_at is null and expired_at is null)
      or
      (status='revoked' and accepted_by is null and accepted_at is null and revoked_by is not null and revoked_at is not null and expired_at is null)
      or
      (status='expired' and accepted_by is null and accepted_at is null and revoked_by is null and revoked_at is null and expired_at is not null)
    )
);

create unique index platform_staff_one_pending_invitation_per_email_idx
  on public.platform_staff_invitations (lower(email))
  where status='pending';

create table public.platform_staff_invitation_roles (
  invitation_id uuid not null references public.platform_staff_invitations(id) on delete cascade,
  role_key text not null references public.platform_roles(role_key) on delete restrict,
  created_at timestamptz not null default now(),
  constraint platform_staff_invitation_roles_pkey primary key (invitation_id, role_key)
);

create table public.platform_staff (
  user_id uuid primary key references auth.users(id) on delete restrict,
  status text not null default 'active',
  source_invitation_id uuid null references public.platform_staff_invitations(id) on delete set null,
  activated_at timestamptz not null default now(),
  suspended_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_staff_status_check
    check (status in ('active','suspended','revoked')),
  constraint platform_staff_lifecycle_check
    check (
      (status='active' and suspended_at is null and revoked_at is null)
      or
      (status='suspended' and suspended_at is not null and revoked_at is null)
      or
      (status='revoked' and revoked_at is not null)
    )
);

create table public.platform_staff_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.platform_staff(user_id) on delete restrict,
  role_key text not null references public.platform_roles(role_key) on delete restrict,
  status text not null default 'active',
  assigned_by uuid not null references auth.users(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  revoked_by uuid null references auth.users(id) on delete restrict,
  revoked_at timestamptz null,
  reason text null,
  constraint platform_staff_roles_status_check
    check (status in ('active','revoked')),
  constraint platform_staff_roles_lifecycle_check
    check (
      (status='active' and revoked_by is null and revoked_at is null)
      or
      (status='revoked' and revoked_by is not null and revoked_at is not null)
    )
);

create unique index platform_staff_roles_one_active_assignment_idx
  on public.platform_staff_roles (user_id, role_key)
  where status='active';

create index platform_staff_roles_active_user_idx
  on public.platform_staff_roles (user_id)
  where status='active';

create table public.platform_access_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null references auth.users(id) on delete restrict,
  actor_authority_type text not null,
  actor_role_snapshot text[] not null default '{}'::text[],
  permission_key text null references public.platform_permissions(permission_key) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id text null,
  target_organization_id uuid null,
  before_state jsonb null,
  after_state jsonb null,
  reason text null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint platform_access_events_actor_type_check
    check (actor_authority_type in ('platform_owner','platform_staff','system')),
  constraint platform_access_events_action_check
    check (btrim(action) <> ''),
  constraint platform_access_events_entity_type_check
    check (btrim(entity_type) <> '')
);

create index platform_access_events_occurred_at_idx
  on public.platform_access_events (occurred_at desc);

create index platform_access_events_actor_idx
  on public.platform_access_events (actor_user_id, occurred_at desc);

create index platform_access_events_entity_idx
  on public.platform_access_events (entity_type, entity_id, occurred_at desc);

alter table public.platform_permissions enable row level security;
alter table public.platform_roles enable row level security;
alter table public.platform_role_permissions enable row level security;
alter table public.platform_staff_invitations enable row level security;
alter table public.platform_staff_invitation_roles enable row level security;
alter table public.platform_staff enable row level security;
alter table public.platform_staff_roles enable row level security;
alter table public.platform_access_events enable row level security;

revoke all on table public.platform_permissions from public, anon, authenticated;
revoke all on table public.platform_roles from public, anon, authenticated;
revoke all on table public.platform_role_permissions from public, anon, authenticated;
revoke all on table public.platform_staff_invitations from public, anon, authenticated;
revoke all on table public.platform_staff_invitation_roles from public, anon, authenticated;
revoke all on table public.platform_staff from public, anon, authenticated;
revoke all on table public.platform_staff_roles from public, anon, authenticated;
revoke all on table public.platform_access_events from public, anon, authenticated;

insert into public.platform_permissions (
  permission_key, area, action, risk_level, description, is_root_only
) values
  ('platform.console.access','platform','access','low','Open the Platform Control Plane.',false),
  ('platform.staff.read','platform','staff_read','medium','View Platform Staff identities, roles and status.',false),
  ('platform.staff.invite','platform','staff_invite','critical','Invite a new Platform Staff identity.',true),
  ('platform.staff.manage_roles','platform','staff_manage_roles','critical','Assign or remove Platform Staff role templates.',true),
  ('platform.staff.suspend','platform','staff_suspend','critical','Suspend or revoke Platform Staff access.',true),
  ('platform.audit.read','platform','audit_read','medium','Read the global privileged-action audit trail.',false),
  ('platform.settings.manage','platform','settings_manage','critical','Change global platform configuration.',true),

  ('registrations.read','registrations','read','low','Read the company registration queue and application detail.',false),
  ('registrations.review','registrations','review','medium','Start and perform registration identity review.',false),
  ('registrations.request_information','registrations','request_information','medium','Request additional information from an applicant.',false),
  ('registrations.approve','registrations','approve','high','Approve a company registration application.',false),
  ('registrations.reject','registrations','reject','high','Reject a company registration application.',false),
  ('registrations.activate','registrations','activate','high','Activate an approved company workspace.',false),
  ('registrations.bridge_network','registrations','bridge_network','high','Link an activated registration to the Network identity graph.',false),

  ('discovery.read','discovery','read','low','Read Company Discovery runs, candidates and evidence.',false),
  ('discovery.run','discovery','run','medium','Start a Company Discovery crawl batch.',false),
  ('discovery.review','discovery','review','medium','Review Company Discovery candidates and evidence.',false),
  ('discovery.publish','discovery','publish','high','Publish an accepted candidate as a public Network company.',false),
  ('discovery.enrich','discovery','enrich','high','Apply selected public evidence to an existing Network company.',false),
  ('discovery.close_duplicates','discovery','close_duplicates','high','Close exact discovery matches as duplicates without merging identities.',false),

  ('claims.read','claims','read','low','Read company ownership claims and proof evidence.',false),
  ('claims.review_proof','claims','review_proof','medium','Verify or reject ownership proof.',false),
  ('claims.approve','claims','approve','high','Approve a company ownership claim.',false),
  ('claims.reject','claims','reject','high','Reject a company ownership claim.',false),
  ('claims.revoke','claims','revoke','high','Revoke an existing company ownership claim.',false),

  ('knowledge.read_drafts','knowledge','read_drafts','low','Read unpublished Knowledge editorial content.',false),
  ('knowledge.edit','knowledge','edit','medium','Create and edit Knowledge drafts.',false),
  ('knowledge.review','knowledge','review','medium','Review editorial quality, sources and readiness blockers.',false),
  ('knowledge.publish','knowledge','publish','high','Publish or unpublish Knowledge content.',false),
  ('knowledge.quality_audit','knowledge','quality_audit','medium','Read Knowledge freshness, SEO and publication-readiness audits.',false),

  ('tenant_access.break_glass','tenant_access','break_glass','critical','Reserved emergency tenant-private-data access. Not implemented in SA2.',true);

insert into public.platform_roles (role_key, label, description) values
  ('registration_admin','Registration Admin','Runs company onboarding from review through activation and Network bridge.'),
  ('network_operations_admin','Network Operations Admin','Operates Company Discovery and controlled public Network enrichment.'),
  ('claims_verification_admin','Claims & Verification Admin','Processes company ownership proofs and claim lifecycle decisions.'),
  ('knowledge_editor','Knowledge Editor','Prepares and reviews Knowledge content but cannot publish it.'),
  ('knowledge_publisher','Knowledge Publisher','Reviews and publishes Knowledge content; draft editing remains separate.'),
  ('platform_auditor','Platform Auditor','Read-only platform oversight across operational queues and privileged-action audit.');

create or replace function private.sa2_reject_root_only_role_permission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_root_only boolean;
begin
  select p.is_root_only
    into v_root_only
  from public.platform_permissions p
  where p.permission_key = new.permission_key;

  if coalesce(v_root_only,false) then
    raise exception 'Root-only permission % cannot be assigned to a Platform Staff role', new.permission_key
      using errcode='42501';
  end if;

  return new;
end;
$function$;

revoke all on function private.sa2_reject_root_only_role_permission() from public, anon, authenticated;

create trigger platform_role_permissions_root_only_guard
before insert or update on public.platform_role_permissions
for each row execute function private.sa2_reject_root_only_role_permission();

insert into public.platform_role_permissions (role_key, permission_key) values
  ('registration_admin','platform.console.access'),
  ('registration_admin','registrations.read'),
  ('registration_admin','registrations.review'),
  ('registration_admin','registrations.request_information'),
  ('registration_admin','registrations.approve'),
  ('registration_admin','registrations.reject'),
  ('registration_admin','registrations.activate'),
  ('registration_admin','registrations.bridge_network'),

  ('network_operations_admin','platform.console.access'),
  ('network_operations_admin','discovery.read'),
  ('network_operations_admin','discovery.run'),
  ('network_operations_admin','discovery.review'),
  ('network_operations_admin','discovery.publish'),
  ('network_operations_admin','discovery.enrich'),
  ('network_operations_admin','discovery.close_duplicates'),

  ('claims_verification_admin','platform.console.access'),
  ('claims_verification_admin','claims.read'),
  ('claims_verification_admin','claims.review_proof'),
  ('claims_verification_admin','claims.approve'),
  ('claims_verification_admin','claims.reject'),
  ('claims_verification_admin','claims.revoke'),

  ('knowledge_editor','platform.console.access'),
  ('knowledge_editor','knowledge.read_drafts'),
  ('knowledge_editor','knowledge.edit'),
  ('knowledge_editor','knowledge.review'),
  ('knowledge_editor','knowledge.quality_audit'),

  ('knowledge_publisher','platform.console.access'),
  ('knowledge_publisher','knowledge.read_drafts'),
  ('knowledge_publisher','knowledge.review'),
  ('knowledge_publisher','knowledge.publish'),
  ('knowledge_publisher','knowledge.quality_audit'),

  ('platform_auditor','platform.console.access'),
  ('platform_auditor','platform.staff.read'),
  ('platform_auditor','platform.audit.read'),
  ('platform_auditor','registrations.read'),
  ('platform_auditor','discovery.read'),
  ('platform_auditor','claims.read'),
  ('platform_auditor','knowledge.read_drafts'),
  ('platform_auditor','knowledge.quality_audit');

create or replace function private.sa2_reject_platform_owner_staff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if exists (
    select 1
    from public.platform_user_roles pur
    where pur.user_id=new.user_id
      and pur.role='platform_superadmin'
      and pur.status='active'
  ) then
    raise exception 'Platform Owner cannot also be a Platform Staff identity'
      using errcode='42501';
  end if;
  return new;
end;
$function$;

revoke all on function private.sa2_reject_platform_owner_staff() from public, anon, authenticated;

create trigger platform_staff_root_separation_guard
before insert or update of user_id on public.platform_staff
for each row execute function private.sa2_reject_platform_owner_staff();

create or replace function private.sa2_active_role_keys(p_user_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(array_agg(psr.role_key order by psr.role_key), '{}'::text[])
  from public.platform_staff_roles psr
  join public.platform_roles pr on pr.role_key=psr.role_key
  where psr.user_id=p_user_id
    and psr.status='active'
    and pr.status='active';
$function$;

revoke all on function private.sa2_active_role_keys(uuid) from public, anon;

create or replace function private.has_platform_permission(p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    exists (
      select 1
      from public.platform_permissions pp
      where pp.permission_key=p_permission_key
    )
    and (
      private.is_platform_superadmin()
      or exists (
        select 1
        from public.platform_staff ps
        join public.platform_staff_roles psr
          on psr.user_id=ps.user_id
         and psr.status='active'
        join public.platform_roles pr
          on pr.role_key=psr.role_key
         and pr.status='active'
        join public.platform_role_permissions prp
          on prp.role_key=pr.role_key
        where ps.user_id=(select auth.uid())
          and ps.status='active'
          and prp.permission_key=p_permission_key
      )
    );
$function$;

revoke all on function private.has_platform_permission(text) from public, anon;
grant execute on function private.has_platform_permission(text) to authenticated, service_role;

create or replace function private.require_platform_permission(p_permission_key text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not private.has_platform_permission(p_permission_key) then
    raise exception 'Platform permission required: %', p_permission_key
      using errcode='42501';
  end if;
end;
$function$;

revoke all on function private.require_platform_permission(text) from public, anon;
grant execute on function private.require_platform_permission(text) to authenticated, service_role;

create or replace function public.has_platform_permission(p_permission_key text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.has_platform_permission(p_permission_key);
$function$;

revoke all on function public.has_platform_permission(text) from public, anon;
grant execute on function public.has_platform_permission(text) to authenticated, service_role;

create or replace function private.sa2_normalize_role_keys(p_role_keys text[])
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_roles text[];
  v_invalid text[];
begin
  select coalesce(
    array_agg(distinct lower(btrim(x)) order by lower(btrim(x))),
    '{}'::text[]
  )
    into v_roles
  from unnest(coalesce(p_role_keys,'{}'::text[])) as x
  where nullif(btrim(x),'') is not null;

  if cardinality(v_roles)=0 then
    raise exception 'At least one Platform Staff role is required'
      using errcode='22023';
  end if;

  select coalesce(array_agg(r order by r),'{}'::text[])
    into v_invalid
  from unnest(v_roles) as r
  where not exists (
    select 1
    from public.platform_roles pr
    where pr.role_key=r
      and pr.status='active'
  );

  if cardinality(v_invalid)>0 then
    raise exception 'Unknown or inactive Platform Staff roles: %', array_to_string(v_invalid,', ')
      using errcode='22023';
  end if;

  return v_roles;
end;
$function$;

revoke all on function private.sa2_normalize_role_keys(text[]) from public, anon, authenticated;

create or replace function private.sa2_record_platform_event(
  p_permission_key text,
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_target_organization_id uuid default null,
  p_before_state jsonb default null,
  p_after_state jsonb default null,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event_id uuid;
  v_actor uuid := (select auth.uid());
  v_actor_type text;
  v_role_snapshot text[];
begin
  if v_actor is null then
    v_actor_type := 'system';
    v_role_snapshot := '{}'::text[];
  elsif private.is_platform_superadmin() then
    v_actor_type := 'platform_owner';
    v_role_snapshot := array['platform_owner']::text[];
  else
    v_actor_type := 'platform_staff';
    v_role_snapshot := private.sa2_active_role_keys(v_actor);
  end if;

  insert into public.platform_access_events (
    actor_user_id,
    actor_authority_type,
    actor_role_snapshot,
    permission_key,
    action,
    entity_type,
    entity_id,
    target_organization_id,
    before_state,
    after_state,
    reason,
    metadata
  ) values (
    v_actor,
    v_actor_type,
    v_role_snapshot,
    p_permission_key,
    p_action,
    p_entity_type,
    p_entity_id,
    p_target_organization_id,
    p_before_state,
    p_after_state,
    nullif(btrim(coalesce(p_reason,'')),''),
    coalesce(p_metadata,'{}'::jsonb)
  )
  returning id into v_event_id;

  return v_event_id;
end;
$function$;

revoke all on function private.sa2_record_platform_event(text,text,text,text,uuid,jsonb,jsonb,text,jsonb)
  from public, anon, authenticated;

create or replace function public.platform_access_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_is_owner boolean;
  v_staff_status text;
  v_roles text[];
  v_permissions text[];
begin
  if v_user_id is null then
    raise exception 'Authenticated user required' using errcode='42501';
  end if;

  v_is_owner := private.is_platform_superadmin();

  if v_is_owner then
    select coalesce(array_agg(pp.permission_key order by pp.permission_key),'{}'::text[])
      into v_permissions
    from public.platform_permissions pp;

    return jsonb_build_object(
      'user_id',v_user_id,
      'authority_type','platform_owner',
      'is_platform_owner',true,
      'is_platform_staff',false,
      'staff_status',null,
      'roles',to_jsonb(array['platform_owner']::text[]),
      'permissions',to_jsonb(v_permissions)
    );
  end if;

  select ps.status
    into v_staff_status
  from public.platform_staff ps
  where ps.user_id=v_user_id;

  v_roles := private.sa2_active_role_keys(v_user_id);

  if v_staff_status='active' then
    select coalesce(array_agg(distinct prp.permission_key order by prp.permission_key),'{}'::text[])
      into v_permissions
    from public.platform_staff_roles psr
    join public.platform_roles pr
      on pr.role_key=psr.role_key
     and pr.status='active'
    join public.platform_role_permissions prp
      on prp.role_key=pr.role_key
    where psr.user_id=v_user_id
      and psr.status='active';
  else
    v_permissions := '{}'::text[];
  end if;

  return jsonb_build_object(
    'user_id',v_user_id,
    'authority_type',case when v_staff_status is null then 'none' else 'platform_staff' end,
    'is_platform_owner',false,
    'is_platform_staff',v_staff_status is not null,
    'staff_status',v_staff_status,
    'roles',to_jsonb(v_roles),
    'permissions',to_jsonb(v_permissions)
  );
end;
$function$;

revoke all on function public.platform_access_context() from public, anon;
grant execute on function public.platform_access_context() to authenticated;

create or replace function public.sa2_create_platform_staff_invitation(
  p_email text,
  p_role_keys text[],
  p_expires_at timestamptz default (now() + interval '7 days'),
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_email text := lower(btrim(coalesce(p_email,'')));
  v_roles text[];
  v_invitation_id uuid;
  v_expired_id uuid;
begin
  perform private.require_platform_permission('platform.staff.invite');

  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Valid staff email required' using errcode='22023';
  end if;

  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'Invitation expiry must be in the future' using errcode='22023';
  end if;

  v_roles := private.sa2_normalize_role_keys(p_role_keys);

  if exists (
    select 1
    from auth.users u
    join public.platform_staff ps on ps.user_id=u.id
    where lower(u.email)=v_email
      and ps.status='active'
  ) then
    raise exception 'Platform Staff identity is already active for %', v_email
      using errcode='23505';
  end if;

  for v_expired_id in
    update public.platform_staff_invitations psi
    set status='expired',
        expired_at=now()
    where psi.email=v_email
      and psi.status='pending'
      and psi.expires_at<=now()
    returning psi.id
  loop
    perform private.sa2_record_platform_event(
      'platform.staff.invite',
      'staff_invitation_expired',
      'platform_staff_invitation',
      v_expired_id::text,
      null,
      null,
      jsonb_build_object('status','expired'),
      'Expired before replacement invitation'
    );
  end loop;

  if exists (
    select 1
    from public.platform_staff_invitations psi
    where psi.email=v_email
      and psi.status='pending'
  ) then
    raise exception 'A pending Platform Staff invitation already exists for %', v_email
      using errcode='23505';
  end if;

  insert into public.platform_staff_invitations (
    email,status,invited_by,expires_at,reason
  ) values (
    v_email,'pending',(select auth.uid()),p_expires_at,nullif(btrim(coalesce(p_reason,'')),'')
  )
  returning id into v_invitation_id;

  insert into public.platform_staff_invitation_roles (invitation_id,role_key)
  select v_invitation_id,role_key
  from unnest(v_roles) as role_key;

  perform private.sa2_record_platform_event(
    'platform.staff.invite',
    'staff_invitation_created',
    'platform_staff_invitation',
    v_invitation_id::text,
    null,
    null,
    jsonb_build_object(
      'email',v_email,
      'roles',to_jsonb(v_roles),
      'expires_at',p_expires_at
    ),
    p_reason
  );

  return v_invitation_id;
end;
$function$;

revoke all on function public.sa2_create_platform_staff_invitation(text,text[],timestamptz,text)
  from public, anon;
grant execute on function public.sa2_create_platform_staff_invitation(text,text[],timestamptz,text)
  to authenticated;

create or replace function public.sa2_revoke_platform_staff_invitation(
  p_invitation_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_before jsonb;
begin
  perform private.require_platform_permission('platform.staff.invite');

  if nullif(btrim(coalesce(p_reason,'')),'') is null then
    raise exception 'Revocation reason required' using errcode='22023';
  end if;

  select to_jsonb(psi)
    into v_before
  from public.platform_staff_invitations psi
  where psi.id=p_invitation_id
    and psi.status='pending'
  for update;

  if v_before is null then
    raise exception 'Pending Platform Staff invitation not found' using errcode='P0002';
  end if;

  update public.platform_staff_invitations
  set status='revoked',
      revoked_by=(select auth.uid()),
      revoked_at=now()
  where id=p_invitation_id;

  perform private.sa2_record_platform_event(
    'platform.staff.invite',
    'staff_invitation_revoked',
    'platform_staff_invitation',
    p_invitation_id::text,
    null,
    v_before,
    jsonb_build_object('status','revoked'),
    p_reason
  );
end;
$function$;

revoke all on function public.sa2_revoke_platform_staff_invitation(uuid,text)
  from public, anon;
grant execute on function public.sa2_revoke_platform_staff_invitation(uuid,text)
  to authenticated;

create or replace function public.sa2_claim_platform_staff_invitation()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_email text;
  v_email_confirmed_at timestamptz;
  v_invitation public.platform_staff_invitations%rowtype;
  v_roles text[];
begin
  if v_user_id is null then
    raise exception 'Authenticated user required' using errcode='42501';
  end if;

  if private.is_platform_superadmin() then
    raise exception 'Platform Owner cannot claim a Platform Staff invitation'
      using errcode='42501';
  end if;

  select lower(btrim(u.email)),u.email_confirmed_at
    into v_email,v_email_confirmed_at
  from auth.users u
  where u.id=v_user_id;

  if v_email is null or v_email_confirmed_at is null then
    raise exception 'Verified account email required to claim Platform Staff invitation'
      using errcode='42501';
  end if;

  update public.platform_staff_invitations
  set status='expired',
      expired_at=now()
  where email=v_email
    and status='pending'
    and expires_at<=now();

  select psi.*
    into v_invitation
  from public.platform_staff_invitations psi
  where psi.email=v_email
    and psi.status='pending'
    and psi.expires_at>now()
  order by psi.created_at desc
  limit 1
  for update;

  if v_invitation.id is null then
    return jsonb_build_object('claimed',false);
  end if;

  select array_agg(psir.role_key order by psir.role_key)
    into v_roles
  from public.platform_staff_invitation_roles psir
  where psir.invitation_id=v_invitation.id;

  if coalesce(cardinality(v_roles),0)=0 then
    raise exception 'Platform Staff invitation has no roles' using errcode='23514';
  end if;

  insert into public.platform_staff (
    user_id,status,source_invitation_id,activated_at,suspended_at,revoked_at,updated_at
  ) values (
    v_user_id,'active',v_invitation.id,now(),null,null,now()
  )
  on conflict (user_id) do update
  set status='active',
      source_invitation_id=excluded.source_invitation_id,
      activated_at=now(),
      suspended_at=null,
      revoked_at=null,
      updated_at=now();

  update public.platform_staff_roles
  set status='revoked',
      revoked_by=v_invitation.invited_by,
      revoked_at=now(),
      reason='Replaced by accepted Platform Staff invitation'
  where user_id=v_user_id
    and status='active';

  insert into public.platform_staff_roles (
    user_id,role_key,status,assigned_by,assigned_at,reason
  )
  select
    v_user_id,
    r,
    'active',
    v_invitation.invited_by,
    now(),
    'Assigned by accepted Platform Staff invitation'
  from unnest(v_roles) as r;

  update public.platform_staff_invitations
  set status='accepted',
      accepted_by=v_user_id,
      accepted_at=now()
  where id=v_invitation.id;

  perform private.sa2_record_platform_event(
    null,
    'staff_invitation_accepted',
    'platform_staff',
    v_user_id::text,
    null,
    null,
    jsonb_build_object(
      'status','active',
      'invitation_id',v_invitation.id,
      'roles',to_jsonb(v_roles)
    ),
    null,
    jsonb_build_object('invited_by',v_invitation.invited_by)
  );

  return jsonb_build_object(
    'claimed',true,
    'invitation_id',v_invitation.id,
    'staff_status','active',
    'roles',to_jsonb(v_roles)
  );
end;
$function$;

revoke all on function public.sa2_claim_platform_staff_invitation() from public, anon;
grant execute on function public.sa2_claim_platform_staff_invitation() to authenticated;

create or replace function public.sa2_set_platform_staff_roles(
  p_user_id uuid,
  p_role_keys text[],
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_roles text[];
  v_before_roles text[];
  v_after_roles text[];
  v_status text;
begin
  perform private.require_platform_permission('platform.staff.manage_roles');

  if p_user_id is null then
    raise exception 'Platform Staff user_id required' using errcode='22023';
  end if;

  if exists (
    select 1
    from public.platform_user_roles pur
    where pur.user_id=p_user_id
      and pur.role='platform_superadmin'
      and pur.status='active'
  ) then
    raise exception 'Platform Owner cannot receive Platform Staff roles'
      using errcode='42501';
  end if;

  if nullif(btrim(coalesce(p_reason,'')),'') is null then
    raise exception 'Role change reason required' using errcode='22023';
  end if;

  select ps.status
    into v_status
  from public.platform_staff ps
  where ps.user_id=p_user_id
  for update;

  if v_status is null then
    raise exception 'Platform Staff identity not found' using errcode='P0002';
  end if;

  if v_status='revoked' then
    raise exception 'Revoked Platform Staff must be re-invited before role assignment'
      using errcode='42501';
  end if;

  v_roles := private.sa2_normalize_role_keys(p_role_keys);
  v_before_roles := private.sa2_active_role_keys(p_user_id);

  update public.platform_staff_roles psr
  set status='revoked',
      revoked_by=(select auth.uid()),
      revoked_at=now(),
      reason=p_reason
  where psr.user_id=p_user_id
    and psr.status='active'
    and not (psr.role_key=any(v_roles));

  insert into public.platform_staff_roles (
    user_id,role_key,status,assigned_by,assigned_at,reason
  )
  select
    p_user_id,
    r,
    'active',
    (select auth.uid()),
    now(),
    p_reason
  from unnest(v_roles) as r
  where not exists (
    select 1
    from public.platform_staff_roles psr
    where psr.user_id=p_user_id
      and psr.role_key=r
      and psr.status='active'
  );

  v_after_roles := private.sa2_active_role_keys(p_user_id);

  perform private.sa2_record_platform_event(
    'platform.staff.manage_roles',
    'staff_roles_changed',
    'platform_staff',
    p_user_id::text,
    null,
    jsonb_build_object('roles',to_jsonb(v_before_roles)),
    jsonb_build_object('roles',to_jsonb(v_after_roles)),
    p_reason
  );

  return jsonb_build_object(
    'user_id',p_user_id,
    'status',v_status,
    'roles',to_jsonb(v_after_roles)
  );
end;
$function$;

revoke all on function public.sa2_set_platform_staff_roles(uuid,text[],text)
  from public, anon;
grant execute on function public.sa2_set_platform_staff_roles(uuid,text[],text)
  to authenticated;

create or replace function public.sa2_set_platform_staff_status(
  p_user_id uuid,
  p_status text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_before public.platform_staff%rowtype;
  v_after public.platform_staff%rowtype;
  v_permission text;
begin
  if lower(btrim(coalesce(p_status,''))) in ('suspended','revoked') then
    v_permission := 'platform.staff.suspend';
  else
    v_permission := 'platform.staff.manage_roles';
  end if;

  perform private.require_platform_permission(v_permission);

  if p_user_id is null then
    raise exception 'Platform Staff user_id required' using errcode='22023';
  end if;

  if exists (
    select 1
    from public.platform_user_roles pur
    where pur.user_id=p_user_id
      and pur.role='platform_superadmin'
      and pur.status='active'
  ) then
    raise exception 'Platform Owner lifecycle is outside Platform Staff administration'
      using errcode='42501';
  end if;

  if lower(btrim(coalesce(p_status,''))) not in ('active','suspended','revoked') then
    raise exception 'Unsupported Platform Staff status: %', p_status
      using errcode='22023';
  end if;

  select ps.*
    into v_before
  from public.platform_staff ps
  where ps.user_id=p_user_id
  for update;

  if v_before.user_id is null then
    raise exception 'Platform Staff identity not found' using errcode='P0002';
  end if;

  if v_before.status='revoked' and lower(btrim(p_status))<>'revoked' then
    raise exception 'Revoked Platform Staff must be re-invited before reactivation'
      using errcode='42501';
  end if;

  if v_before.status<>lower(btrim(p_status))
     and nullif(btrim(coalesce(p_reason,'')),'') is null then
    raise exception 'Platform Staff status change reason required'
      using errcode='22023';
  end if;

  if v_before.status=lower(btrim(p_status)) then
    return jsonb_build_object(
      'user_id',p_user_id,
      'status',v_before.status,
      'roles',to_jsonb(private.sa2_active_role_keys(p_user_id))
    );
  end if;

  update public.platform_staff
  set status=lower(btrim(p_status)),
      suspended_at=case when lower(btrim(p_status))='suspended' then now() else null end,
      revoked_at=case when lower(btrim(p_status))='revoked' then now() else null end,
      updated_at=now()
  where user_id=p_user_id
  returning * into v_after;

  if v_after.status='revoked' then
    update public.platform_staff_roles
    set status='revoked',
        revoked_by=(select auth.uid()),
        revoked_at=now(),
        reason=p_reason
    where user_id=p_user_id
      and status='active';
  end if;

  perform private.sa2_record_platform_event(
    v_permission,
    'staff_status_changed',
    'platform_staff',
    p_user_id::text,
    null,
    jsonb_build_object('status',v_before.status),
    jsonb_build_object('status',v_after.status),
    p_reason
  );

  return jsonb_build_object(
    'user_id',p_user_id,
    'status',v_after.status,
    'roles',to_jsonb(private.sa2_active_role_keys(p_user_id))
  );
end;
$function$;

revoke all on function public.sa2_set_platform_staff_status(uuid,text,text)
  from public, anon;
grant execute on function public.sa2_set_platform_staff_status(uuid,text,text)
  to authenticated;

create or replace function public.sa2_platform_staff_directory()
returns table (
  user_id uuid,
  email text,
  status text,
  roles text[],
  activated_at timestamptz,
  suspended_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  perform private.require_platform_permission('platform.staff.read');

  return query
  select
    ps.user_id,
    u.email,
    ps.status,
    private.sa2_active_role_keys(ps.user_id),
    ps.activated_at,
    ps.suspended_at,
    ps.revoked_at,
    ps.updated_at
  from public.platform_staff ps
  join auth.users u on u.id=ps.user_id
  order by
    case ps.status when 'active' then 1 when 'suspended' then 2 else 3 end,
    lower(u.email);
end;
$function$;

revoke all on function public.sa2_platform_staff_directory() from public, anon;
grant execute on function public.sa2_platform_staff_directory() to authenticated;

create or replace function public.sa2_platform_staff_invitation_queue()
returns table (
  invitation_id uuid,
  email text,
  status text,
  roles text[],
  invited_by uuid,
  created_at timestamptz,
  expires_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  expired_at timestamptz,
  reason text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  perform private.require_platform_permission('platform.staff.read');

  return query
  select
    psi.id,
    psi.email,
    psi.status,
    coalesce(array_agg(psir.role_key order by psir.role_key)
      filter (where psir.role_key is not null),'{}'::text[]),
    psi.invited_by,
    psi.created_at,
    psi.expires_at,
    psi.accepted_at,
    psi.revoked_at,
    psi.expired_at,
    psi.reason
  from public.platform_staff_invitations psi
  left join public.platform_staff_invitation_roles psir
    on psir.invitation_id=psi.id
  group by psi.id
  order by psi.created_at desc;
end;
$function$;

revoke all on function public.sa2_platform_staff_invitation_queue() from public, anon;
grant execute on function public.sa2_platform_staff_invitation_queue() to authenticated;

comment on table public.platform_permissions is
  'SA2 immutable semantic Platform permission catalog. Browser roles have no direct table access.';
comment on table public.platform_roles is
  'SA2 fixed Platform Staff role templates. Platform Owner is deliberately not represented as a staff role.';
comment on table public.platform_staff is
  'SA2 delegated human Platform Staff identities, separate from organization membership and root ownership.';
comment on table public.platform_access_events is
  'SA2 privileged Platform audit ledger. Assignment/lifecycle events are append-only through security-definer functions.';
comment on function public.has_platform_permission(text) is
  'SA2 capability resolver. Unknown permissions fail closed; active Platform Owner bypasses all known permissions.';
comment on function public.platform_access_context() is
  'SA2 authenticated Platform authority snapshot for future role-aware Platform UI.';
comment on function public.sa2_claim_platform_staff_invitation() is
  'SA2 verified-email invitation claim. Activates staff and the invitation role set without granting tenant membership.';

do $sa2$
declare
  v_permission_count integer;
  v_role_count integer;
  v_mapping_count integer;
begin
  select count(*) into v_permission_count from public.platform_permissions;
  select count(*) into v_role_count from public.platform_roles where status='active';
  select count(*) into v_mapping_count from public.platform_role_permissions;

  if v_permission_count<>31 then
    raise exception 'SA2 expected 31 permissions, got %',v_permission_count;
  end if;

  if v_role_count<>6 then
    raise exception 'SA2 expected 6 active Platform Staff roles, got %',v_role_count;
  end if;

  if v_mapping_count<>39 then
    raise exception 'SA2 expected 39 role-permission mappings, got %',v_mapping_count;
  end if;

  if exists (
    select 1
    from public.platform_role_permissions prp
    join public.platform_permissions pp on pp.permission_key=prp.permission_key
    where pp.is_root_only
  ) then
    raise exception 'SA2 root-only permission leaked into a staff role';
  end if;

  if exists (
    select 1
    from public.platform_staff ps
    join public.platform_user_roles pur
      on pur.user_id=ps.user_id
     and pur.role='platform_superadmin'
     and pur.status='active'
  ) then
    raise exception 'SA2 Platform Owner / Platform Staff separation violated';
  end if;
end
$sa2$;
