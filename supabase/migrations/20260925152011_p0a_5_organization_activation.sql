create or replace function private.p0a_activate_registration_application_impl(
  p_application_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid;
  v_app public.company_registration_applications%rowtype;
  v_organization_id uuid;
  v_slug_base text;
  v_slug text;
  v_is_default boolean;
  v_existing_membership boolean;
begin
  v_actor_user_id := (select auth.uid());

  if v_actor_user_id is null or not private.is_platform_superadmin() then
    raise exception 'platform superadmin required'
      using errcode = '42501';
  end if;

  select *
    into v_app
  from public.company_registration_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'registration application not found'
      using errcode = 'P0002';
  end if;

  if v_app.application_status = 'activated' then
    if v_app.activated_organization_id is null then
      raise exception 'activated application has no organization'
        using errcode = '23514';
    end if;

    return jsonb_build_object(
      'application_id', v_app.id,
      'status', v_app.application_status,
      'organization_id', v_app.activated_organization_id,
      'idempotent_replay', true
    );
  end if;

  if v_app.application_status <> 'approved' then
    raise exception 'application can only be activated from approved'
      using errcode = '22023';
  end if;

  if v_app.activated_organization_id is not null then
    raise exception 'approved application already references an organization'
      using errcode = '23514';
  end if;

  perform private.p0a_append_registration_event(
    p_application_id,
    'activation_started',
    v_actor_user_id,
    'platform_superadmin',
    'approved',
    'approved',
    '{}'::jsonb
  );

  v_slug_base := regexp_replace(
    lower(btrim(v_app.legal_name)),
    '[^a-z0-9]+',
    '-',
    'g'
  );
  v_slug_base := trim(both '-' from v_slug_base);

  if v_slug_base = '' then
    v_slug_base := 'company';
  end if;

  v_slug := left(v_slug_base, 48) || '-' || left(replace(v_app.id::text, '-', ''), 12);

  insert into public.organizations (
    name,
    slug,
    created_by,
    industry,
    country_code,
    onboarding_status,
    source_preferences,
    onboarding_updated_by
  )
  values (
    btrim(v_app.legal_name),
    v_slug,
    v_app.applicant_user_id,
    'steel',
    v_app.country_code,
    'not_started',
    '{}'::text[],
    v_app.applicant_user_id
  )
  returning id into v_organization_id;

  perform private.p0a_append_registration_event(
    p_application_id,
    'organization_created',
    v_actor_user_id,
    'platform_superadmin',
    'approved',
    'approved',
    jsonb_build_object(
      'organization_id', v_organization_id,
      'slug', v_slug
    )
  );

  select exists (
    select 1
    from public.organization_memberships om
    where om.user_id = v_app.applicant_user_id
      and om.status = 'active'
      and om.is_default
  )
  into v_existing_membership;

  v_is_default := not v_existing_membership;

  insert into public.organization_memberships (
    organization_id,
    user_id,
    role,
    status,
    is_default,
    business_role
  )
  values (
    v_organization_id,
    v_app.applicant_user_id,
    'admin',
    'active',
    v_is_default,
    null
  )
  on conflict (organization_id, user_id) do update
  set
    role = 'admin',
    status = 'active',
    updated_at = now();

  update public.company_registration_applications
  set
    application_status = 'activated',
    activated_organization_id = v_organization_id,
    reviewed_at = coalesce(reviewed_at, now()),
    reviewed_by = coalesce(reviewed_by, v_actor_user_id)
  where id = p_application_id
  returning * into v_app;

  perform private.p0a_append_registration_event(
    p_application_id,
    'activation_completed',
    v_actor_user_id,
    'platform_superadmin',
    'approved',
    'activated',
    jsonb_build_object(
      'organization_id', v_organization_id,
      'membership_role', 'admin',
      'membership_status', 'active',
      'is_default', v_is_default,
      'network_link_status', 'pending_m2_m4'
    )
  );

  return jsonb_build_object(
    'application_id', v_app.id,
    'status', v_app.application_status,
    'organization_id', v_organization_id,
    'membership_role', 'admin',
    'membership_status', 'active',
    'is_default', v_is_default,
    'network_link_status', 'pending_m2_m4',
    'idempotent_replay', false
  );
end;
$function$;

revoke all on function private.p0a_activate_registration_application_impl(uuid) from public;
revoke all on function private.p0a_activate_registration_application_impl(uuid) from anon;
grant execute on function private.p0a_activate_registration_application_impl(uuid) to authenticated, service_role;

create or replace function public.p0a_activate_registration_application(
  p_application_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $function$
  select private.p0a_activate_registration_application_impl(p_application_id);
$function$;

revoke all on function public.p0a_activate_registration_application(uuid) from public;
revoke all on function public.p0a_activate_registration_application(uuid) from anon;
grant execute on function public.p0a_activate_registration_application(uuid) to authenticated, service_role;
