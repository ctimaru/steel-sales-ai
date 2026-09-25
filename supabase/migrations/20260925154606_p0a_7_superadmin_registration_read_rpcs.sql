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
  v_user_id uuid;
  v_rows jsonb;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null or not private.is_platform_superadmin() then
    raise exception 'platform superadmin required'
      using errcode = '42501';
  end if;

  if p_status is not null and p_status not in (
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

revoke all on function private.p0a_admin_registration_queue_impl(text) from public;
revoke all on function private.p0a_admin_registration_queue_impl(text) from anon;
grant execute on function private.p0a_admin_registration_queue_impl(text) to authenticated, service_role;

create or replace function public.p0a_admin_registration_queue(
  p_status text default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.p0a_admin_registration_queue_impl(p_status);
$function$;

revoke all on function public.p0a_admin_registration_queue(text) from public;
revoke all on function public.p0a_admin_registration_queue(text) from anon;
grant execute on function public.p0a_admin_registration_queue(text) to authenticated, service_role;

create or replace function private.p0a_admin_registration_detail_impl(
  p_application_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_application jsonb;
  v_events jsonb;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null or not private.is_platform_superadmin() then
    raise exception 'platform superadmin required'
      using errcode = '42501';
  end if;

  select to_jsonb(a)
    into v_application
  from public.company_registration_applications a
  where a.id = p_application_id;

  if v_application is null then
    raise exception 'registration application not found'
      using errcode = 'P0002';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'event_type', e.event_type,
        'actor_user_id', e.actor_user_id,
        'actor_type', e.actor_type,
        'from_status', e.from_status,
        'to_status', e.to_status,
        'metadata', e.metadata,
        'occurred_at', e.occurred_at
      )
      order by e.occurred_at asc, e.id asc
    ),
    '[]'::jsonb
  )
  into v_events
  from public.platform_registration_events e
  where e.application_id = p_application_id;

  return jsonb_build_object(
    'application', v_application,
    'events', v_events
  );
end;
$function$;

revoke all on function private.p0a_admin_registration_detail_impl(uuid) from public;
revoke all on function private.p0a_admin_registration_detail_impl(uuid) from anon;
grant execute on function private.p0a_admin_registration_detail_impl(uuid) to authenticated, service_role;

create or replace function public.p0a_admin_registration_detail(
  p_application_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.p0a_admin_registration_detail_impl(p_application_id);
$function$;

revoke all on function public.p0a_admin_registration_detail(uuid) from public;
revoke all on function public.p0a_admin_registration_detail(uuid) from anon;
grant execute on function public.p0a_admin_registration_detail(uuid) to authenticated, service_role;
