create table public.platform_registration_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null
    references public.company_registration_applications(id) on delete restrict,
  event_type text not null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_type text not null,
  from_status text null,
  to_status text null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),

  constraint platform_registration_events_event_type_check
    check (event_type in (
      'application_created',
      'application_submitted',
      'email_verified',
      'review_started',
      'information_requested',
      'information_provided',
      'application_approved',
      'application_rejected',
      'application_withdrawn',
      'activation_started',
      'organization_created',
      'network_company_linked',
      'claim_created',
      'activation_completed',
      'application_suspended'
    )),

  constraint platform_registration_events_actor_type_check
    check (actor_type in ('applicant','platform_superadmin','system','service')),

  constraint platform_registration_events_from_status_check
    check (
      from_status is null
      or from_status in (
        'draft',
        'submitted',
        'email_verification_pending',
        'pending_review',
        'needs_information',
        'approved',
        'rejected',
        'withdrawn',
        'activated',
        'suspended'
      )
    ),

  constraint platform_registration_events_to_status_check
    check (
      to_status is null
      or to_status in (
        'draft',
        'submitted',
        'email_verification_pending',
        'pending_review',
        'needs_information',
        'approved',
        'rejected',
        'withdrawn',
        'activated',
        'suspended'
      )
    ),

  constraint platform_registration_events_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),

  constraint platform_registration_events_metadata_size_check
    check (octet_length(metadata::text) <= 4096),

  constraint platform_registration_events_actor_integrity_check
    check (
      (actor_type in ('applicant','platform_superadmin') and actor_user_id is not null)
      or actor_type in ('system','service')
    )
);

create index platform_registration_events_application_idx
  on public.platform_registration_events (application_id, occurred_at, id);

create index platform_registration_events_event_type_idx
  on public.platform_registration_events (event_type, occurred_at desc);

create index platform_registration_events_actor_idx
  on public.platform_registration_events (actor_user_id, occurred_at desc)
  where actor_user_id is not null;

alter table public.platform_registration_events enable row level security;

revoke all on table public.platform_registration_events from public;
revoke all on table public.platform_registration_events from anon;
revoke all on table public.platform_registration_events from authenticated;

grant select, insert on table public.platform_registration_events to service_role;

create or replace function private.p0a_append_registration_event(
  p_application_id uuid,
  p_event_type text,
  p_actor_user_id uuid,
  p_actor_type text,
  p_from_status text,
  p_to_status text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event_id uuid;
  v_metadata jsonb;
begin
  if p_application_id is null then
    raise exception 'application_id is required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.company_registration_applications a
    where a.id = p_application_id
  ) then
    raise exception 'registration application not found'
      using errcode = '23503';
  end if;

  v_metadata := coalesce(p_metadata, '{}'::jsonb);

  if jsonb_typeof(v_metadata) <> 'object' then
    raise exception 'registration event metadata must be a JSON object'
      using errcode = '22023';
  end if;

  if octet_length(v_metadata::text) > 4096 then
    raise exception 'registration event metadata exceeds 4096 bytes'
      using errcode = '22023';
  end if;

  insert into public.platform_registration_events (
    application_id,
    event_type,
    actor_user_id,
    actor_type,
    from_status,
    to_status,
    metadata
  )
  values (
    p_application_id,
    p_event_type,
    p_actor_user_id,
    p_actor_type,
    p_from_status,
    p_to_status,
    v_metadata
  )
  returning id into v_event_id;

  return v_event_id;
end;
$function$;

revoke all on function private.p0a_append_registration_event(
  uuid,text,uuid,text,text,text,jsonb
) from public;
revoke all on function private.p0a_append_registration_event(
  uuid,text,uuid,text,text,text,jsonb
) from anon;
revoke all on function private.p0a_append_registration_event(
  uuid,text,uuid,text,text,text,jsonb
) from authenticated;

grant execute on function private.p0a_append_registration_event(
  uuid,text,uuid,text,text,text,jsonb
) to service_role;

create or replace function private.p0a_log_registration_application_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.p0a_append_registration_event(
    new.id,
    'application_created',
    new.applicant_user_id,
    'applicant',
    null,
    'draft',
    jsonb_build_object(
      'primary_company_type', new.primary_company_type,
      'country_code', new.country_code
    )
  );

  return new;
end;
$function$;

revoke all on function private.p0a_log_registration_application_created() from public;
revoke all on function private.p0a_log_registration_application_created() from anon;
revoke all on function private.p0a_log_registration_application_created() from authenticated;

create trigger p0a_log_registration_application_created
after insert on public.company_registration_applications
for each row
execute function private.p0a_log_registration_application_created();

create or replace function private.p0a_registration_event_immutable()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  raise exception 'platform_registration_events is append-only'
    using errcode = '55000';
end;
$function$;

revoke all on function private.p0a_registration_event_immutable() from public;
revoke all on function private.p0a_registration_event_immutable() from anon;
revoke all on function private.p0a_registration_event_immutable() from authenticated;

create trigger p0a_registration_event_immutable
before update or delete on public.platform_registration_events
for each row
execute function private.p0a_registration_event_immutable();
