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

  if v_row.application_status not in ('draft','needs_information') then
    raise exception 'application cannot be submitted from status %', v_row.application_status
      using errcode = '22023';
  end if;

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
    case when v_row.submitted_at is not null then
      case when exists (
        select 1
        from public.platform_registration_events e
        where e.application_id = p_application_id
          and e.event_type = 'information_requested'
      ) then 'needs_information' else 'draft' end
    else 'draft' end,
    'pending_review',
    jsonb_build_object('submission_channel','authenticated_rpc')
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
    'email_verified_at', v_row.email_verified_at
  );
end;
$function$;

revoke all on function private.p0a_submit_registration_application_impl(uuid) from public;
revoke all on function private.p0a_submit_registration_application_impl(uuid) from anon;
grant execute on function private.p0a_submit_registration_application_impl(uuid) to authenticated, service_role;

create or replace function public.p0a_submit_registration_application(
  p_application_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $function$
  select private.p0a_submit_registration_application_impl(p_application_id);
$function$;

revoke all on function public.p0a_submit_registration_application(uuid) from public;
revoke all on function public.p0a_submit_registration_application(uuid) from anon;
grant execute on function public.p0a_submit_registration_application(uuid) to authenticated, service_role;

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

  if v_user_id is null or not private.is_platform_superadmin() then
    raise exception 'platform superadmin required'
      using errcode = '42501';
  end if;

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
    'platform_superadmin',
    'pending_review',
    'needs_information',
    case
      when v_note is null then '{}'::jsonb
      else jsonb_build_object('note', v_note)
    end
  );

  return jsonb_build_object(
    'application_id', v_row.id,
    'status', v_row.application_status,
    'reviewed_at', v_row.reviewed_at
  );
end;
$function$;

revoke all on function private.p0a_request_registration_information_impl(uuid,text) from public;
revoke all on function private.p0a_request_registration_information_impl(uuid,text) from anon;
grant execute on function private.p0a_request_registration_information_impl(uuid,text) to authenticated, service_role;

create or replace function public.p0a_request_registration_information(
  p_application_id uuid,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $function$
  select private.p0a_request_registration_information_impl(p_application_id,p_note);
$function$;

revoke all on function public.p0a_request_registration_information(uuid,text) from public;
revoke all on function public.p0a_request_registration_information(uuid,text) from anon;
grant execute on function public.p0a_request_registration_information(uuid,text) to authenticated, service_role;

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

  if v_user_id is null or not private.is_platform_superadmin() then
    raise exception 'platform superadmin required'
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
    'platform_superadmin',
    'pending_review',
    'approved',
    '{}'::jsonb
  );

  return jsonb_build_object(
    'application_id', v_row.id,
    'status', v_row.application_status,
    'reviewed_at', v_row.reviewed_at,
    'reviewed_by', v_row.reviewed_by
  );
end;
$function$;

revoke all on function private.p0a_approve_registration_application_impl(uuid) from public;
revoke all on function private.p0a_approve_registration_application_impl(uuid) from anon;
grant execute on function private.p0a_approve_registration_application_impl(uuid) to authenticated, service_role;

create or replace function public.p0a_approve_registration_application(
  p_application_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $function$
  select private.p0a_approve_registration_application_impl(p_application_id);
$function$;

revoke all on function public.p0a_approve_registration_application(uuid) from public;
revoke all on function public.p0a_approve_registration_application(uuid) from anon;
grant execute on function public.p0a_approve_registration_application(uuid) to authenticated, service_role;

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

  if v_user_id is null or not private.is_platform_superadmin() then
    raise exception 'platform superadmin required'
      using errcode = '42501';
  end if;

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
    'platform_superadmin',
    'pending_review',
    'rejected',
    jsonb_build_object(
      'reason_code', p_reason_code,
      'note_present', v_note is not null
    )
  );

  return jsonb_build_object(
    'application_id', v_row.id,
    'status', v_row.application_status,
    'reviewed_at', v_row.reviewed_at,
    'reviewed_by', v_row.reviewed_by,
    'rejection_reason_code', v_row.rejection_reason_code
  );
end;
$function$;

revoke all on function private.p0a_reject_registration_application_impl(uuid,text,text) from public;
revoke all on function private.p0a_reject_registration_application_impl(uuid,text,text) from anon;
grant execute on function private.p0a_reject_registration_application_impl(uuid,text,text) to authenticated, service_role;

create or replace function public.p0a_reject_registration_application(
  p_application_id uuid,
  p_reason_code text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $function$
  select private.p0a_reject_registration_application_impl(
    p_application_id,
    p_reason_code,
    p_note
  );
$function$;

revoke all on function public.p0a_reject_registration_application(uuid,text,text) from public;
revoke all on function public.p0a_reject_registration_application(uuid,text,text) from anon;
grant execute on function public.p0a_reject_registration_application(uuid,text,text) to authenticated, service_role;
