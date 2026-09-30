-- HP3 — Registration State Machine Hardening
-- Canonicalize the registration lifecycle and make every mutation deterministic
-- and retry-safe without changing tenant, RBAC, or Network ownership boundaries.

-- 1) Canonical application states.
alter table public.company_registration_applications
  drop constraint company_registration_applications_status_check;

alter table public.company_registration_applications
  add constraint company_registration_applications_status_check
  check (application_status in (
    'draft',
    'pending_review',
    'needs_information',
    'approved',
    'rejected',
    'activated'
  ));

alter table public.platform_registration_events
  drop constraint platform_registration_events_from_status_check;

alter table public.platform_registration_events
  add constraint platform_registration_events_from_status_check
  check (
    from_status is null
    or from_status in (
      'draft',
      'pending_review',
      'needs_information',
      'approved',
      'rejected',
      'activated'
    )
  );

alter table public.platform_registration_events
  drop constraint platform_registration_events_to_status_check;

alter table public.platform_registration_events
  add constraint platform_registration_events_to_status_check
  check (
    to_status is null
    or to_status in (
      'draft',
      'pending_review',
      'needs_information',
      'approved',
      'rejected',
      'activated'
    )
  );

-- 2) Strong row invariants by lifecycle state.
alter table public.company_registration_applications
  add constraint company_registration_applications_hp3_lifecycle_integrity_check
  check (
    case application_status
      when 'draft' then
        submitted_at is null
        and reviewed_at is null
        and reviewed_by is null
        and rejection_reason_code is null
        and rejection_note is null
        and activated_organization_id is null
        and matched_network_company_id is null
      when 'pending_review' then
        submitted_at is not null
        and email_verified_at is not null
        and reviewed_at is null
        and reviewed_by is null
        and rejection_reason_code is null
        and rejection_note is null
        and activated_organization_id is null
        and matched_network_company_id is null
      when 'needs_information' then
        submitted_at is not null
        and email_verified_at is not null
        and reviewed_at is not null
        and reviewed_by is not null
        and rejection_reason_code is null
        and rejection_note is null
        and activated_organization_id is null
        and matched_network_company_id is null
      when 'approved' then
        submitted_at is not null
        and email_verified_at is not null
        and reviewed_at is not null
        and reviewed_by is not null
        and rejection_reason_code is null
        and rejection_note is null
        and activated_organization_id is null
        and matched_network_company_id is null
      when 'rejected' then
        submitted_at is not null
        and email_verified_at is not null
        and reviewed_at is not null
        and reviewed_by is not null
        and rejection_reason_code is not null
        and activated_organization_id is null
        and matched_network_company_id is null
      when 'activated' then
        submitted_at is not null
        and email_verified_at is not null
        and reviewed_at is not null
        and reviewed_by is not null
        and rejection_reason_code is null
        and rejection_note is null
        and activated_organization_id is not null
      else false
    end
  );

alter table public.company_registration_applications
  add constraint company_registration_applications_hp3_network_match_state_check
  check (
    matched_network_company_id is null
    or application_status = 'activated'
  );

-- 3) One canonical transition matrix for all current/future registration code.
create or replace function private.hp3_registration_transition_allowed(
  p_from_status text,
  p_to_status text
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $function$
  select case
    when p_from_status is null or p_to_status is null then false
    when p_from_status = p_to_status then true
    when p_from_status = 'draft' and p_to_status = 'pending_review' then true
    when p_from_status = 'pending_review' and p_to_status in (
      'needs_information',
      'approved',
      'rejected'
    ) then true
    when p_from_status = 'needs_information' and p_to_status = 'pending_review' then true
    when p_from_status = 'approved' and p_to_status = 'activated' then true
    else false
  end;
$function$;

revoke all on function private.hp3_registration_transition_allowed(text,text)
  from public, anon, authenticated;

create or replace function private.hp3_guard_registration_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.application_status is distinct from new.application_status
     and not private.hp3_registration_transition_allowed(
       old.application_status,
       new.application_status
     ) then
    raise exception 'invalid registration transition: % -> %',
      old.application_status,
      new.application_status
      using errcode = '22023';
  end if;

  return new;
end;
$function$;

revoke all on function private.hp3_guard_registration_transition()
  from public, anon, authenticated;

drop trigger if exists hp3_guard_registration_transition
  on public.company_registration_applications;

create trigger hp3_guard_registration_transition
before update of application_status
on public.company_registration_applications
for each row
execute function private.hp3_guard_registration_transition();

-- 4) Audit ledger must describe only canonical transitions.
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

  if p_from_status is not null
     and p_to_status is not null
     and not private.hp3_registration_transition_allowed(
       p_from_status,
       p_to_status
     ) then
    raise exception 'invalid registration event transition: % -> %',
      p_from_status,
      p_to_status
      using errcode = '22023';
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
) from public, anon, authenticated;

create unique index platform_registration_events_singleton_event_uidx
  on public.platform_registration_events (application_id, event_type)
  where event_type in (
    'application_created',
    'email_verified',
    'application_approved',
    'application_rejected',
    'activation_started',
    'organization_created',
    'network_company_linked',
    'claim_created',
    'activation_completed'
  );

-- 5) Applicant submit/resubmit is retry-safe and records the real source state.
create or replace function private.p0a_submit_registration_application_impl(
  p_application_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_email_verified_at timestamptz;
  v_from_status text;
  v_row public.company_registration_applications%rowtype;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null then
    raise exception 'authentication required'
      using errcode = '42501';
  end if;

  select *
    into v_row
  from public.company_registration_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'registration application not found'
      using errcode = 'P0002';
  end if;

  if v_row.applicant_user_id <> v_user_id then
    raise exception 'not allowed to submit this registration application'
      using errcode = '42501';
  end if;

  if v_row.application_status = 'pending_review' then
    return jsonb_build_object(
      'application_id', v_row.id,
      'status', v_row.application_status,
      'submitted_at', v_row.submitted_at,
      'email_verified_at', v_row.email_verified_at,
      'idempotent_replay', true
    );
  end if;

  if v_row.application_status not in ('draft','needs_information') then
    raise exception 'application cannot be submitted from status %',
      v_row.application_status
      using errcode = '22023';
  end if;

  v_from_status := v_row.application_status;

  select u.email_confirmed_at
    into v_email_verified_at
  from auth.users u
  where u.id = v_user_id;

  if v_email_verified_at is null then
    raise exception 'email verification required before submission'
      using errcode = '42501';
  end if;

  update public.company_registration_applications
  set
    application_status = 'pending_review',
    submitted_at = coalesce(submitted_at, now()),
    email_verified_at = coalesce(email_verified_at, v_email_verified_at),
    reviewed_at = null,
    reviewed_by = null,
    rejection_reason_code = null,
    rejection_note = null
  where id = p_application_id
  returning * into v_row;

  perform private.p0a_append_registration_event(
    p_application_id,
    'application_submitted',
    v_user_id,
    'applicant',
    v_from_status,
    'pending_review',
    jsonb_build_object(
      'submission_channel', 'authenticated_rpc',
      'resubmission', v_from_status = 'needs_information'
    )
  );

  if not exists (
    select 1
    from public.platform_registration_events e
    where e.application_id = p_application_id
      and e.event_type = 'email_verified'
  ) then
    perform private.p0a_append_registration_event(
      p_application_id,
      'email_verified',
      v_user_id,
      'applicant',
      null,
      null,
      jsonb_build_object('verified_at', v_email_verified_at)
    );
  end if;

  return jsonb_build_object(
    'application_id', v_row.id,
    'status', v_row.application_status,
    'submitted_at', v_row.submitted_at,
    'email_verified_at', v_row.email_verified_at,
    'idempotent_replay', false
  );
end;
$function$;

-- 6) Review actions are retry-safe but terminal decisions stay immutable.
create or replace function private.p0a_request_registration_information_impl(
  p_application_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_row public.company_registration_applications%rowtype;
  v_note text;
begin
  v_user_id := (select auth.uid());

  perform private.require_platform_permission('registrations.request_information');

  v_note := nullif(btrim(p_note), '');
  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'information request note exceeds 1000 characters'
      using errcode = '22023';
  end if;

  select *
    into v_row
  from public.company_registration_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'registration application not found'
      using errcode = 'P0002';
  end if;

  if v_row.application_status = 'needs_information' then
    return jsonb_build_object(
      'application_id', v_row.id,
      'status', v_row.application_status,
      'reviewed_at', v_row.reviewed_at,
      'idempotent_replay', true
    );
  end if;

  if v_row.application_status <> 'pending_review' then
    raise exception 'information can only be requested from pending_review'
      using errcode = '22023';
  end if;

  update public.company_registration_applications
  set
    application_status = 'needs_information',
    reviewed_at = now(),
    reviewed_by = v_user_id,
    rejection_reason_code = null,
    rejection_note = null
  where id = p_application_id
  returning * into v_row;

  perform private.p0a_append_registration_event(
    p_application_id,
    'information_requested',
    v_user_id,
    private.sa4_platform_actor_type(),
    'pending_review',
    'needs_information',
    case
      when v_note is null then '{}'::jsonb
      else jsonb_build_object('note', v_note)
    end
  );

  perform private.sa4_record_registration_action(
    'registrations.request_information',
    'registration_information_requested',
    p_application_id,
    'pending_review',
    'needs_information',
    v_note
  );

  return jsonb_build_object(
    'application_id', v_row.id,
    'status', v_row.application_status,
    'reviewed_at', v_row.reviewed_at,
    'idempotent_replay', false
  );
end;
$function$;

create or replace function private.p0a_approve_registration_application_impl(
  p_application_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_row public.company_registration_applications%rowtype;
begin
  v_user_id := (select auth.uid());

  perform private.require_platform_permission('registrations.approve');

  select *
    into v_row
  from public.company_registration_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'registration application not found'
      using errcode = 'P0002';
  end if;

  if v_row.application_status = 'approved' then
    return jsonb_build_object(
      'application_id', v_row.id,
      'status', v_row.application_status,
      'reviewed_at', v_row.reviewed_at,
      'reviewed_by', v_row.reviewed_by,
      'idempotent_replay', true
    );
  end if;

  if v_row.application_status <> 'pending_review' then
    raise exception 'application can only be approved from pending_review'
      using errcode = '22023';
  end if;

  if v_row.email_verified_at is null then
    raise exception 'verified email required before approval'
      using errcode = '22023';
  end if;

  update public.company_registration_applications
  set
    application_status = 'approved',
    reviewed_at = now(),
    reviewed_by = v_user_id,
    rejection_reason_code = null,
    rejection_note = null
  where id = p_application_id
  returning * into v_row;

  perform private.p0a_append_registration_event(
    p_application_id,
    'application_approved',
    v_user_id,
    private.sa4_platform_actor_type(),
    'pending_review',
    'approved',
    '{}'::jsonb
  );

  perform private.sa4_record_registration_action(
    'registrations.approve',
    'registration_application_approved',
    p_application_id,
    'pending_review',
    'approved',
    null
  );

  return jsonb_build_object(
    'application_id', v_row.id,
    'status', v_row.application_status,
    'reviewed_at', v_row.reviewed_at,
    'reviewed_by', v_row.reviewed_by,
    'idempotent_replay', false
  );
end;
$function$;

create or replace function private.p0a_reject_registration_application_impl(
  p_application_id uuid,
  p_reason_code text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_row public.company_registration_applications%rowtype;
  v_note text;
begin
  v_user_id := (select auth.uid());

  perform private.require_platform_permission('registrations.reject');

  if p_reason_code not in (
    'duplicate_application',
    'unverifiable_identity',
    'incomplete_information',
    'unsupported_business',
    'abuse_or_spam',
    'other'
  ) then
    raise exception 'invalid rejection reason code'
      using errcode = '22023';
  end if;

  v_note := nullif(btrim(p_note), '');
  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'rejection note exceeds 1000 characters'
      using errcode = '22023';
  end if;

  select *
    into v_row
  from public.company_registration_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'registration application not found'
      using errcode = 'P0002';
  end if;

  if v_row.application_status = 'rejected' then
    if v_row.rejection_reason_code = p_reason_code
       and coalesce(v_row.rejection_note, '') = coalesce(v_note, '') then
      return jsonb_build_object(
        'application_id', v_row.id,
        'status', v_row.application_status,
        'reviewed_at', v_row.reviewed_at,
        'reviewed_by', v_row.reviewed_by,
        'rejection_reason_code', v_row.rejection_reason_code,
        'idempotent_replay', true
      );
    end if;

    raise exception 'rejected application decision is immutable'
      using errcode = '22023';
  end if;

  if v_row.application_status <> 'pending_review' then
    raise exception 'application can only be rejected from pending_review'
      using errcode = '22023';
  end if;

  update public.company_registration_applications
  set
    application_status = 'rejected',
    reviewed_at = now(),
    reviewed_by = v_user_id,
    rejection_reason_code = p_reason_code,
    rejection_note = v_note
  where id = p_application_id
  returning * into v_row;

  perform private.p0a_append_registration_event(
    p_application_id,
    'application_rejected',
    v_user_id,
    private.sa4_platform_actor_type(),
    'pending_review',
    'rejected',
    jsonb_build_object(
      'reason_code', p_reason_code,
      'note_present', v_note is not null
    )
  );

  perform private.sa4_record_registration_action(
    'registrations.reject',
    'registration_application_rejected',
    p_application_id,
    'pending_review',
    'rejected',
    coalesce(v_note, p_reason_code)
  );

  return jsonb_build_object(
    'application_id', v_row.id,
    'status', v_row.application_status,
    'reviewed_at', v_row.reviewed_at,
    'reviewed_by', v_row.reviewed_by,
    'rejection_reason_code', v_row.rejection_reason_code,
    'idempotent_replay', false
  );
end;
$function$;

-- 7) Platform queue accepts only canonical lifecycle filters.
create or replace function private.p0a_admin_registration_queue_impl(
  p_status text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_rows jsonb;
begin
  perform private.require_platform_permission('registrations.read');

  if p_status is not null and p_status not in (
    'draft',
    'pending_review',
    'needs_information',
    'approved',
    'rejected',
    'activated'
  ) then
    raise exception 'invalid registration status filter'
      using errcode = '22023';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'applicant_user_id', a.applicant_user_id,
        'applicant_email', a.applicant_email_snapshot,
        'legal_name', a.legal_name,
        'trading_name', a.trading_name,
        'country_code', a.country_code,
        'vat_id', a.vat_id,
        'primary_company_type', a.primary_company_type,
        'application_status', a.application_status,
        'submitted_at', a.submitted_at,
        'reviewed_at', a.reviewed_at,
        'reviewed_by', a.reviewed_by,
        'activated_organization_id', a.activated_organization_id,
        'matched_network_company_id', a.matched_network_company_id,
        'created_at', a.created_at,
        'updated_at', a.updated_at
      )
      order by
        case
          when a.application_status = 'pending_review' then 0
          when a.application_status = 'needs_information' then 1
          when a.application_status = 'approved' then 2
          else 3
        end,
        a.updated_at desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.company_registration_applications a
  where p_status is null or a.application_status = p_status;

  return jsonb_build_object(
    'status_filter', p_status,
    'count', jsonb_array_length(v_rows),
    'applications', v_rows
  );
end;
$function$;

revoke all on function private.p0a_admin_registration_queue_impl(text)
  from public, anon;
grant execute on function private.p0a_admin_registration_queue_impl(text)
  to authenticated, service_role;

comment on function private.hp3_registration_transition_allowed(text,text) is
  'HP3 canonical registration state transition matrix. Same-state updates are allowed; terminal states cannot transition onward.';

comment on function private.hp3_guard_registration_transition() is
  'HP3 central guard preventing invalid company-registration lifecycle transitions.';

comment on index public.platform_registration_events_singleton_event_uidx is
  'HP3 prevents duplicate one-time audit events while allowing legitimate resubmission/information-request cycles.';
