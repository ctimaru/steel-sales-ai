-- HP12 — Error Handling & Recovery
-- Applicant-safe registration recovery state + controlled reapplication.
-- Keeps rejection decisions immutable while allowing eligible applicants to start
-- a fresh draft without mutating the rejected source application.

create or replace function private.hp12_registration_recovery_state_impl(
  p_application_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_application public.company_registration_applications%rowtype;
  v_information_note text;
  v_can_reapply boolean := false;
  v_recovery_kind text;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  select *
  into v_application
  from public.company_registration_applications a
  where a.applicant_user_id=v_user_id
    and (p_application_id is null or a.id=p_application_id)
  order by a.created_at desc,a.id
  limit 1;

  if not found then
    return jsonb_build_object(
      'contract','HP12-registration-recovery-v1',
      'application',null,
      'recovery_kind','new_application',
      'can_reapply',false
    );
  end if;

  if v_application.application_status='needs_information' then
    select nullif(btrim(e.metadata->>'note'),'')
    into v_information_note
    from public.platform_registration_events e
    where e.application_id=v_application.id
      and e.event_type='information_requested'
    order by e.occurred_at desc,e.id desc
    limit 1;
  end if;

  v_can_reapply :=
    v_application.application_status='rejected'
    and v_application.rejection_reason_code in (
      'incomplete_information',
      'unverifiable_identity'
    );

  v_recovery_kind := case
    when v_application.application_status='draft' then 'edit_draft'
    when v_application.application_status='needs_information' then 'provide_information'
    when v_application.application_status='pending_review' then 'wait_review'
    when v_application.application_status='approved' then 'wait_activation'
    when v_application.application_status='activated' then 'continue_onboarding'
    when v_application.application_status='rejected' and v_can_reapply then 'reapply'
    when v_application.application_status='rejected' then 'support_required'
    else 'status_refresh'
  end;

  return jsonb_build_object(
    'contract','HP12-registration-recovery-v1',
    'application',jsonb_build_object(
      'id',v_application.id,
      'status',v_application.application_status,
      'legal_name',v_application.legal_name,
      'updated_at',v_application.updated_at,
      'rejection_reason_code',v_application.rejection_reason_code,
      'rejection_note',case
        when v_application.application_status='rejected'
          then v_application.rejection_note
        else null
      end,
      'information_request_note',v_information_note
    ),
    'recovery_kind',v_recovery_kind,
    'can_reapply',v_can_reapply
  );
end;
$function$;

revoke all on function private.hp12_registration_recovery_state_impl(uuid)
from public,anon;

grant execute on function private.hp12_registration_recovery_state_impl(uuid)
to authenticated,service_role;

create or replace function public.hp12_registration_recovery_state(
  p_application_id uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.hp12_registration_recovery_state_impl(p_application_id);
$function$;

revoke all on function public.hp12_registration_recovery_state(uuid)
from public,anon;

grant execute on function public.hp12_registration_recovery_state(uuid)
to authenticated,service_role;

create or replace function private.hp12_reapply_registration_impl(
  p_application_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_email_confirmed_at timestamptz;
  v_source public.company_registration_applications%rowtype;
  v_existing public.company_registration_applications%rowtype;
  v_new_id uuid;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  select u.email_confirmed_at
  into v_email_confirmed_at
  from auth.users u
  where u.id=v_user_id;

  if v_email_confirmed_at is null then
    raise exception 'email verification required before reapplication'
      using errcode='42501';
  end if;

  select *
  into v_source
  from public.company_registration_applications a
  where a.id=p_application_id
    and a.applicant_user_id=v_user_id
  for update;

  if not found then
    raise exception 'registration application not found'
      using errcode='P0002';
  end if;

  if v_source.application_status<>'rejected' then
    raise exception 'only rejected applications can start reapplication'
      using errcode='22023';
  end if;

  if v_source.rejection_reason_code not in (
    'incomplete_information',
    'unverifiable_identity'
  ) then
    raise exception 'registration reapplication requires platform support'
      using errcode='22023';
  end if;

  select *
  into v_existing
  from public.company_registration_applications a
  where a.applicant_user_id=v_user_id
    and a.application_status in (
      'draft',
      'pending_review',
      'needs_information',
      'approved'
    )
  order by a.created_at desc,a.id
  limit 1;

  if found then
    return jsonb_build_object(
      'contract','HP12-registration-reapply-v1',
      'application_id',v_existing.id,
      'status',v_existing.application_status,
      'idempotent_replay',true
    );
  end if;

  insert into public.company_registration_applications(
    legal_name,
    trading_name,
    country_code,
    vat_id,
    registration_id,
    website_url,
    primary_company_type,
    secondary_company_types,
    contact_name,
    contact_phone,
    short_description
  )
  values(
    v_source.legal_name,
    v_source.trading_name,
    v_source.country_code,
    v_source.vat_id,
    v_source.registration_id,
    v_source.website_url,
    v_source.primary_company_type,
    v_source.secondary_company_types,
    v_source.contact_name,
    v_source.contact_phone,
    v_source.short_description
  )
  returning id into v_new_id;

  return jsonb_build_object(
    'contract','HP12-registration-reapply-v1',
    'application_id',v_new_id,
    'status','draft',
    'source_application_id',v_source.id,
    'idempotent_replay',false
  );
exception
  when unique_violation then
    select *
    into v_existing
    from public.company_registration_applications a
    where a.applicant_user_id=v_user_id
      and a.application_status in (
        'draft',
        'pending_review',
        'needs_information',
        'approved'
      )
    order by a.created_at desc,a.id
    limit 1;

    if found then
      return jsonb_build_object(
        'contract','HP12-registration-reapply-v1',
        'application_id',v_existing.id,
        'status',v_existing.application_status,
        'idempotent_replay',true
      );
    end if;

    raise;
end;
$function$;

revoke all on function private.hp12_reapply_registration_impl(uuid)
from public,anon;

grant execute on function private.hp12_reapply_registration_impl(uuid)
to authenticated,service_role;

create or replace function public.hp12_reapply_registration(
  p_application_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.hp12_reapply_registration_impl(p_application_id);
$function$;

revoke all on function public.hp12_reapply_registration(uuid)
from public,anon;

grant execute on function public.hp12_reapply_registration(uuid)
to authenticated,service_role;

comment on function public.hp12_registration_recovery_state(uuid) is
  'HP12 applicant-scoped recovery read model exposing only applicant-facing information request and rejection data.';

comment on function public.hp12_reapply_registration(uuid) is
  'HP12 retry-safe creation of a new draft from an eligible rejected registration without mutating the rejected source application.';
