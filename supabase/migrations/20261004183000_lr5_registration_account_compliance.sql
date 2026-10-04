-- LR5 — Registration & Account Compliance
-- Versioned legal acceptance, account export/closure, and retention enforcement.
--
-- Privacy acknowledgement is evidence that the Art. 13 notice was presented,
-- not consent. Terms acceptance is recorded separately and versioned.
-- Account closure suspends access immediately; final erasure follows the
-- retention/legal-hold matrix because business/audit records reference actors.

create table if not exists public.user_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  subject_user_ref uuid not null,
  privacy_notice_version text not null check (char_length(privacy_notice_version) between 1 and 120),
  privacy_acknowledged_at timestamptz not null,
  terms_version text not null check (char_length(terms_version) between 1 and 120),
  terms_accepted_at timestamptz not null,
  acceptance_source text not null check (
    acceptance_source in ('registration','first_login','team_invite','account')
  ),
  created_at timestamptz not null default now(),
  unique(user_id,privacy_notice_version,terms_version)
);

alter table public.user_legal_acceptances enable row level security;
revoke all on table public.user_legal_acceptances from public,anon,authenticated;
grant select on table public.user_legal_acceptances to authenticated;
grant all on table public.user_legal_acceptances to service_role;

drop policy if exists "Users can read own legal acceptance evidence"
  on public.user_legal_acceptances;
create policy "Users can read own legal acceptance evidence"
on public.user_legal_acceptances
for select
to authenticated
using ((select auth.uid())=user_id);

create index if not exists user_legal_acceptances_subject_idx
  on public.user_legal_acceptances(subject_user_ref,created_at desc);

create table if not exists public.account_lifecycle_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  subject_user_ref uuid not null,
  request_type text not null default 'erasure' check (request_type='erasure'),
  status text not null check (
    status in ('requested','processing','completed','rejected','cancelled','blocked')
  ),
  blocker_code text null check (
    blocker_code is null
    or blocker_code in (
      'platform_superadmin_protected',
      'platform_staff_protected',
      'last_organization_member',
      'last_organization_admin'
    )
  ),
  requested_at timestamptz not null default now(),
  access_suspended_at timestamptz null,
  completed_at timestamptz null,
  resolution_note text null check (
    resolution_note is null or char_length(resolution_note)<=4000
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_lifecycle_requests enable row level security;
revoke all on table public.account_lifecycle_requests from public,anon,authenticated;
grant select on table public.account_lifecycle_requests to authenticated;
grant all on table public.account_lifecycle_requests to service_role;

drop policy if exists "Users can read own account lifecycle requests"
  on public.account_lifecycle_requests;
create policy "Users can read own account lifecycle requests"
on public.account_lifecycle_requests
for select
to authenticated
using ((select auth.uid())=user_id);

create unique index if not exists account_lifecycle_one_active_erasure_idx
  on public.account_lifecycle_requests(subject_user_ref)
  where request_type='erasure' and status in ('requested','processing');

create index if not exists account_lifecycle_user_idx
  on public.account_lifecycle_requests(user_id,requested_at desc);

create table if not exists public.account_data_export_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  subject_user_ref uuid not null,
  export_version text not null check (char_length(export_version) between 1 and 120),
  exported_at timestamptz not null default now()
);

alter table public.account_data_export_events enable row level security;
revoke all on table public.account_data_export_events from public,anon,authenticated;
grant select on table public.account_data_export_events to authenticated;
grant all on table public.account_data_export_events to service_role;

drop policy if exists "Users can read own export events"
  on public.account_data_export_events;
create policy "Users can read own export events"
on public.account_data_export_events
for select
to authenticated
using ((select auth.uid())=user_id);

create index if not exists account_data_export_events_user_idx
  on public.account_data_export_events(user_id,exported_at desc);

create or replace function private.lr5_immutable_evidence_guard()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
begin
  raise exception 'LR5 compliance evidence is immutable'
    using errcode='55000';
end;
$function$;

revoke all on function private.lr5_immutable_evidence_guard()
from public,anon,authenticated;

drop trigger if exists user_legal_acceptances_immutable
  on public.user_legal_acceptances;
create trigger user_legal_acceptances_immutable
before update or delete on public.user_legal_acceptances
for each row execute function private.lr5_immutable_evidence_guard();

drop trigger if exists account_data_export_events_immutable
  on public.account_data_export_events;
create trigger account_data_export_events_immutable
before update or delete on public.account_data_export_events
for each row execute function private.lr5_immutable_evidence_guard();

create or replace function public.lr5_current_legal_acceptance_state()
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_row public.user_legal_acceptances%rowtype;
  v_privacy_version constant text := '2026-10-04-lr5-v1';
  v_terms_version constant text := '2026-10-04-lr5-v1';
begin
  if v_user is null then
    return jsonb_build_object(
      'authenticated',false,
      'accepted',false,
      'privacy_notice_version',v_privacy_version,
      'terms_version',v_terms_version
    );
  end if;

  select *
  into v_row
  from public.user_legal_acceptances
  where user_id=v_user
    and privacy_notice_version=v_privacy_version
    and terms_version=v_terms_version
  order by created_at desc
  limit 1;

  return jsonb_build_object(
    'authenticated',true,
    'accepted',v_row.id is not null,
    'privacy_acknowledged',v_row.id is not null,
    'terms_accepted',v_row.id is not null,
    'privacy_notice_version',v_privacy_version,
    'terms_version',v_terms_version,
    'accepted_at',case when v_row.id is null then null else v_row.created_at end,
    'acceptance_source',case when v_row.id is null then null else v_row.acceptance_source end
  );
end;
$function$;

revoke all on function public.lr5_current_legal_acceptance_state()
from public,anon;
grant execute on function public.lr5_current_legal_acceptance_state()
to authenticated,service_role;

create or replace function private.lr5_record_legal_acceptance_impl(
  p_privacy_acknowledged boolean,
  p_terms_accepted boolean,
  p_source text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_source text := lower(btrim(coalesce(p_source,'')));
  v_privacy_version constant text := '2026-10-04-lr5-v1';
  v_terms_version constant text := '2026-10-04-lr5-v1';
  v_id uuid;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode='42501';
  end if;
  if p_privacy_acknowledged is not true then
    raise exception 'privacy notice acknowledgement is required' using errcode='22023';
  end if;
  if p_terms_accepted is not true then
    raise exception 'terms acceptance is required' using errcode='22023';
  end if;
  if v_source not in ('registration','first_login','team_invite','account') then
    raise exception 'invalid legal acceptance source' using errcode='22023';
  end if;

  insert into public.user_legal_acceptances(
    user_id,subject_user_ref,
    privacy_notice_version,privacy_acknowledged_at,
    terms_version,terms_accepted_at,
    acceptance_source
  )
  values(
    v_user,v_user,
    v_privacy_version,now(),
    v_terms_version,now(),
    v_source
  )
  on conflict (user_id,privacy_notice_version,terms_version)
  do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
    from public.user_legal_acceptances
    where user_id=v_user
      and privacy_notice_version=v_privacy_version
      and terms_version=v_terms_version
    limit 1;
  end if;

  return jsonb_build_object(
    'accepted',true,
    'acceptance_id',v_id,
    'privacy_notice_version',v_privacy_version,
    'terms_version',v_terms_version
  );
end;
$function$;

revoke all on function private.lr5_record_legal_acceptance_impl(boolean,boolean,text)
from public,anon;
grant execute on function private.lr5_record_legal_acceptance_impl(boolean,boolean,text)
to authenticated,service_role;

create or replace function public.lr5_record_legal_acceptance(
  p_privacy_acknowledged boolean,
  p_terms_accepted boolean,
  p_source text
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.lr5_record_legal_acceptance_impl(
    p_privacy_acknowledged,p_terms_accepted,p_source
  );
$function$;

revoke all on function public.lr5_record_legal_acceptance(boolean,boolean,text)
from public,anon;
grant execute on function public.lr5_record_legal_acceptance(boolean,boolean,text)
to authenticated,service_role;

create or replace function public.lr5_account_lifecycle_state()
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_row public.account_lifecycle_requests%rowtype;
begin
  if v_user is null then
    return jsonb_build_object('authenticated',false,'access_suspended',false);
  end if;

  select *
  into v_row
  from public.account_lifecycle_requests
  where user_id=v_user
  order by requested_at desc
  limit 1;

  return jsonb_build_object(
    'authenticated',true,
    'request_id',v_row.id,
    'status',v_row.status,
    'blocker_code',v_row.blocker_code,
    'requested_at',v_row.requested_at,
    'access_suspended_at',v_row.access_suspended_at,
    'access_suspended',coalesce(v_row.status in ('requested','processing'),false)
  );
end;
$function$;

revoke all on function public.lr5_account_lifecycle_state()
from public,anon;
grant execute on function public.lr5_account_lifecycle_state()
to authenticated,service_role;

create or replace function private.lr5_account_export_impl()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_payload jsonb;
  v_export_version constant text := '2026-10-04-lr5-v1';
begin
  if v_user is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  select jsonb_build_object(
    'export_version',v_export_version,
    'generated_at',now(),
    'scope','User-level account data. Organization-controlled Commercial Memory and other users'' data are excluded.',
    'account',(
      select jsonb_build_object(
        'id',u.id,
        'email',u.email,
        'created_at',u.created_at,
        'email_confirmed_at',u.email_confirmed_at,
        'last_sign_in_at',u.last_sign_in_at
      )
      from auth.users u
      where u.id=v_user
    ),
    'legal_acceptances',coalesce((
      select jsonb_agg(jsonb_build_object(
        'privacy_notice_version',a.privacy_notice_version,
        'privacy_acknowledged_at',a.privacy_acknowledged_at,
        'terms_version',a.terms_version,
        'terms_accepted_at',a.terms_accepted_at,
        'acceptance_source',a.acceptance_source
      ) order by a.created_at)
      from public.user_legal_acceptances a
      where a.user_id=v_user
    ),'[]'::jsonb),
    'organization_memberships',coalesce((
      select jsonb_agg(jsonb_build_object(
        'organization_id',m.organization_id,
        'organization_name',o.name,
        'role',m.role,
        'business_role',m.business_role,
        'status',m.status,
        'is_default',m.is_default
      ) order by o.name)
      from public.organization_memberships m
      join public.organizations o on o.id=m.organization_id
      where m.user_id=v_user
    ),'[]'::jsonb),
    'registration_applications',coalesce((
      select jsonb_agg(to_jsonb(a)-'reviewed_by' order by a.created_at)
      from public.company_registration_applications a
      where a.applicant_user_id=v_user
    ),'[]'::jsonb),
    'network_follows',coalesce((
      select jsonb_agg(to_jsonb(f))
      from public.network_company_follows f
      where f.user_id=v_user
    ),'[]'::jsonb),
    'network_saved_companies',coalesce((
      select jsonb_agg(to_jsonb(s))
      from public.network_saved_companies s
      where s.user_id=v_user
    ),'[]'::jsonb),
    'account_lifecycle_requests',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,
        'request_type',r.request_type,
        'status',r.status,
        'blocker_code',r.blocker_code,
        'requested_at',r.requested_at,
        'access_suspended_at',r.access_suspended_at,
        'completed_at',r.completed_at
      ) order by r.requested_at)
      from public.account_lifecycle_requests r
      where r.user_id=v_user
    ),'[]'::jsonb)
  ) into v_payload;

  insert into public.account_data_export_events(
    user_id,subject_user_ref,export_version
  )
  values(v_user,v_user,v_export_version);

  return v_payload;
end;
$function$;

revoke all on function private.lr5_account_export_impl()
from public,anon;
grant execute on function private.lr5_account_export_impl()
to authenticated,service_role;

create or replace function public.lr5_account_export()
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.lr5_account_export_impl();
$function$;

revoke all on function public.lr5_account_export()
from public,anon;
grant execute on function public.lr5_account_export()
to authenticated,service_role;

create or replace function private.lr5_request_account_erasure_impl(
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_existing public.account_lifecycle_requests%rowtype;
  v_org uuid;
  v_request_id uuid;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode='42501';
  end if;
  if p_confirmation is distinct from 'DELETE_MY_ACCOUNT' then
    raise exception 'explicit account deletion confirmation required' using errcode='22023';
  end if;

  select *
  into v_existing
  from public.account_lifecycle_requests
  where subject_user_ref=v_user
    and request_type='erasure'
    and status in ('requested','processing')
  order by requested_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'requested',true,
      'idempotent_replay',true,
      'request_id',v_existing.id,
      'status',v_existing.status,
      'access_suspended',v_existing.access_suspended_at is not null
    );
  end if;

  if exists(
    select 1 from public.platform_user_roles
    where user_id=v_user
      and role='platform_superadmin'
      and status='active'
  ) then
    insert into public.account_lifecycle_requests(
      user_id,subject_user_ref,status,blocker_code,resolution_note
    )
    values(
      v_user,v_user,'blocked','platform_superadmin_protected',
      'Platform Superadmin accounts require controlled ownership handoff before closure.'
    )
    returning id into v_request_id;
    return jsonb_build_object(
      'requested',false,'blocked',true,
      'request_id',v_request_id,'code','platform_superadmin_protected'
    );
  end if;

  if exists(
    select 1 from public.platform_staff
    where user_id=v_user and status in ('active','suspended')
  ) then
    insert into public.account_lifecycle_requests(
      user_id,subject_user_ref,status,blocker_code,resolution_note
    )
    values(
      v_user,v_user,'blocked','platform_staff_protected',
      'Platform Staff accounts require access revocation/handoff before closure.'
    )
    returning id into v_request_id;
    return jsonb_build_object(
      'requested',false,'blocked',true,
      'request_id',v_request_id,'code','platform_staff_protected'
    );
  end if;

  select m.organization_id
  into v_org
  from public.organization_memberships m
  where m.user_id=v_user
    and m.status='active'
    and not exists(
      select 1 from public.organization_memberships other
      where other.organization_id=m.organization_id
        and other.user_id<>v_user
        and other.status='active'
    )
  limit 1;

  if v_org is not null then
    insert into public.account_lifecycle_requests(
      user_id,subject_user_ref,status,blocker_code,resolution_note
    )
    values(
      v_user,v_user,'blocked','last_organization_member',
      'Invite another active organization member before closing the final account.'
    )
    returning id into v_request_id;
    return jsonb_build_object(
      'requested',false,'blocked',true,
      'request_id',v_request_id,'code','last_organization_member',
      'organization_id',v_org
    );
  end if;

  select m.organization_id
  into v_org
  from public.organization_memberships m
  where m.user_id=v_user
    and m.status='active'
    and m.role='admin'
    and not exists(
      select 1 from public.organization_memberships other
      where other.organization_id=m.organization_id
        and other.user_id<>v_user
        and other.status='active'
        and other.role='admin'
    )
  limit 1;

  if v_org is not null then
    insert into public.account_lifecycle_requests(
      user_id,subject_user_ref,status,blocker_code,resolution_note
    )
    values(
      v_user,v_user,'blocked','last_organization_admin',
      'Promote another active organization admin before closing this account.'
    )
    returning id into v_request_id;
    return jsonb_build_object(
      'requested',false,'blocked',true,
      'request_id',v_request_id,'code','last_organization_admin',
      'organization_id',v_org
    );
  end if;

  insert into public.account_lifecycle_requests(
    user_id,subject_user_ref,status,requested_at,access_suspended_at
  )
  values(v_user,v_user,'requested',now(),now())
  returning id into v_request_id;

  update public.organization_memberships
  set status='suspended'
  where user_id=v_user and status='active';

  delete from public.network_company_follows where user_id=v_user;
  delete from public.network_saved_companies where user_id=v_user;
  delete from public.network_activity_reads where user_id=v_user;

  return jsonb_build_object(
    'requested',true,
    'request_id',v_request_id,
    'status','requested',
    'access_suspended',true,
    'hard_delete_automatic',false,
    'retention_review_required',true
  );
end;
$function$;

revoke all on function private.lr5_request_account_erasure_impl(text)
from public,anon;
grant execute on function private.lr5_request_account_erasure_impl(text)
to authenticated,service_role;

create or replace function public.lr5_request_account_erasure(
  p_confirmation text
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.lr5_request_account_erasure_impl(p_confirmation);
$function$;

revoke all on function public.lr5_request_account_erasure(text)
from public,anon;
grant execute on function public.lr5_request_account_erasure(text)
to authenticated,service_role;

alter table public.company_registration_applications
  alter column applicant_user_id drop not null;

alter table public.company_registration_applications
  drop constraint if exists company_registration_applications_applicant_user_id_fkey;

alter table public.company_registration_applications
  add constraint company_registration_applications_applicant_user_id_fkey
  foreign key (applicant_user_id)
  references auth.users(id)
  on delete set null;

create or replace function private.lr5_retention_cleanup_impl(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_deleted_drafts integer := 0;
  v_deleted_rejected integer := 0;
  v_redacted_activated integer := 0;
  v_deleted_export_events integer := 0;
  v_deleted_lifecycle_events integer := 0;
begin
  with deleted as (
    delete from public.company_registration_applications
    where application_status='draft'
      and updated_at < p_now-interval '90 days'
    returning 1
  )
  select count(*)::integer into v_deleted_drafts from deleted;

  with deleted as (
    delete from public.company_registration_applications
    where application_status='rejected'
      and reviewed_at is not null
      and reviewed_at < p_now-interval '12 months'
    returning 1
  )
  select count(*)::integer into v_deleted_rejected from deleted;

  with redacted as (
    update public.company_registration_applications
    set applicant_user_id=null,
        applicant_email_snapshot=
          'retention-redacted+'||substr(id::text,1,12)||'@invalid.local',
        contact_name='Retention redacted',
        contact_phone=null,
        short_description=null,
        updated_at=p_now
    where application_status='activated'
      and reviewed_at is not null
      and reviewed_at < p_now-interval '24 months'
      and (
        applicant_user_id is not null
        or contact_name<>'Retention redacted'
        or contact_phone is not null
        or short_description is not null
      )
    returning 1
  )
  select count(*)::integer into v_redacted_activated from redacted;

  with deleted as (
    delete from public.account_data_export_events
    where exported_at < p_now-interval '24 months'
    returning 1
  )
  select count(*)::integer into v_deleted_export_events from deleted;

  with deleted as (
    delete from public.account_lifecycle_requests
    where status in ('completed','rejected','cancelled','blocked')
      and coalesce(completed_at,updated_at,requested_at) < p_now-interval '24 months'
    returning 1
  )
  select count(*)::integer into v_deleted_lifecycle_events from deleted;

  return jsonb_build_object(
    'ran_at',p_now,
    'deleted_drafts',v_deleted_drafts,
    'deleted_rejected',v_deleted_rejected,
    'redacted_activated',v_redacted_activated,
    'deleted_export_events',v_deleted_export_events,
    'deleted_lifecycle_events',v_deleted_lifecycle_events
  );
end;
$function$;

revoke all on function private.lr5_retention_cleanup_impl(timestamptz)
from public,anon,authenticated;

create or replace function public.lr5_retention_cleanup()
returns jsonb
language sql
volatile
security definer
set search_path=''
as $function$
  select private.lr5_retention_cleanup_impl(now());
$function$;

revoke all on function public.lr5_retention_cleanup()
from public,anon,authenticated;
grant execute on function public.lr5_retention_cleanup()
to service_role;

do $lr5_cron$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname='lr5-retention-cleanup-daily'
  limit 1;

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'lr5-retention-cleanup-daily',
    '15 3 * * *',
    'select private.lr5_retention_cleanup_impl(now());'
  );
end;
$lr5_cron$;

comment on table public.user_legal_acceptances is
  'LR5 immutable evidence of separate Privacy notice acknowledgement and Terms acceptance.';
comment on table public.account_lifecycle_requests is
  'LR5 account closure/erasure request ledger. Access suspension is immediate when eligible; final erasure follows retention/legal review.';
comment on function public.lr5_account_export() is
  'LR5 self-service user-level account export. Organization-controlled Commercial Memory is intentionally excluded.';
comment on function public.lr5_request_account_erasure(text) is
  'LR5 self-service account closure request. Blocks protected platform roles and orphaning of organizations.';
