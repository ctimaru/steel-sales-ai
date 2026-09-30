-- HP1.1 — Registration Gate & Integrity Hotfix
-- Close the legacy self-service tenant path, enforce one open application per
-- applicant, and make Organization activation + Network identity bridge atomic.

revoke execute on function public.create_organization_for_current_user(text,text,text)
  from public, anon, authenticated;

revoke execute on function private.create_organization_for_current_user_impl(text,text,text)
  from public, anon, authenticated;

create unique index company_registration_applications_one_open_per_applicant_uidx
  on public.company_registration_applications (applicant_user_id)
  where application_status in (
    'draft',
    'submitted',
    'email_verification_pending',
    'pending_review',
    'needs_information',
    'approved'
  );

comment on index public.company_registration_applications_one_open_per_applicant_uidx is
  'HP1.1: at most one non-terminal registration application per applicant.';

create or replace function private.hp1_1_activate_registration_application_impl(
  p_application_id uuid,
  p_network_company_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor_user_id uuid;
  v_app public.company_registration_applications%rowtype;
  v_organization_id uuid;
  v_slug_base text;
  v_slug text;
  v_is_default boolean;
  v_existing_membership boolean;
  v_candidates jsonb;
  v_candidate_count integer;
  v_selected_is_candidate boolean;
  v_bridge jsonb;
begin
  v_actor_user_id := (select auth.uid());

  perform private.require_platform_permission('registrations.activate');
  perform private.require_platform_permission('registrations.bridge_network');

  select *
    into v_app
  from public.company_registration_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'registration application not found'
      using errcode = 'P0002';
  end if;

  -- Historical activated rows can be healed idempotently through the same
  -- bridge contract without creating another Organization.
  if v_app.application_status = 'activated' then
    if v_app.activated_organization_id is null then
      raise exception 'activated application has no organization'
        using errcode = '23514';
    end if;

    v_bridge := private.m7_bridge_registration_impl(
      p_application_id,
      p_network_company_id
    );

    return jsonb_build_object(
      'application_id', v_app.id,
      'status', v_app.application_status,
      'organization_id', v_app.activated_organization_id,
      'network_company_id', v_bridge->>'network_company_id',
      'claim_id', v_bridge->>'claim_id',
      'bridge_idempotent_replay',
        coalesce((v_bridge->>'idempotent_replay')::boolean, false),
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

  -- Resolve Network identity before any tenant state is committed.
  v_candidates := private.m7_application_candidates_impl(v_app.id)->'candidates';
  v_candidate_count := jsonb_array_length(coalesce(v_candidates, '[]'::jsonb));

  if v_candidate_count > 0 and p_network_company_id is null then
    raise exception
      'identity candidates exist; explicit network company selection required before activation'
      using errcode = '22023';
  end if;

  if p_network_company_id is not null then
    select exists (
      select 1
      from jsonb_array_elements(coalesce(v_candidates, '[]'::jsonb)) candidate
      where candidate->>'network_company_id' = p_network_company_id::text
    )
    into v_selected_is_candidate;

    if not coalesce(v_selected_is_candidate, false) then
      raise exception
        'selected network company is not an identity candidate for this application'
        using errcode = '22023';
    end if;
  end if;

  perform private.p0a_append_registration_event(
    p_application_id,
    'activation_started',
    v_actor_user_id,
    private.sa4_platform_actor_type(),
    'approved',
    'approved',
    jsonb_build_object(
      'network_candidate_count', v_candidate_count,
      'selected_network_company_id', p_network_company_id
    )
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

  v_slug :=
    left(v_slug_base, 48) || '-' ||
    left(replace(v_app.id::text, '-', ''), 12);

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
    private.sa4_platform_actor_type(),
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

  -- This call runs in the same transaction. Any identity/claim failure rolls
  -- back the Organization, membership and application status update above.
  v_bridge := private.m7_bridge_registration_impl(
    p_application_id,
    p_network_company_id
  );

  perform private.p0a_append_registration_event(
    p_application_id,
    'activation_completed',
    v_actor_user_id,
    private.sa4_platform_actor_type(),
    'approved',
    'activated',
    jsonb_build_object(
      'organization_id', v_organization_id,
      'membership_role', 'admin',
      'membership_status', 'active',
      'is_default', v_is_default,
      'network_link_status', 'active',
      'network_company_id', v_bridge->>'network_company_id',
      'claim_id', v_bridge->>'claim_id'
    )
  );

  perform private.sa4_record_registration_action(
    'registrations.activate',
    'registration_workspace_activated',
    p_application_id,
    'approved',
    'activated',
    null
  );

  return jsonb_build_object(
    'application_id', v_app.id,
    'status', v_app.application_status,
    'organization_id', v_organization_id,
    'membership_role', 'admin',
    'membership_status', 'active',
    'is_default', v_is_default,
    'network_link_status', 'active',
    'network_company_id', v_bridge->>'network_company_id',
    'claim_id', v_bridge->>'claim_id',
    'created_network_company',
      coalesce((v_bridge->>'created_network_company')::boolean, false),
    'idempotent_replay', false
  );
end;
$function$;

revoke all on function private.hp1_1_activate_registration_application_impl(uuid,uuid)
  from public, anon;
grant execute on function private.hp1_1_activate_registration_application_impl(uuid,uuid)
  to authenticated, service_role;

-- Keep the existing public RPC compatible, but route it through the atomic
-- activation contract. It succeeds only when no identity candidates require
-- an explicit choice.
create or replace function private.p0a_activate_registration_application_impl(
  p_application_id uuid
)
returns jsonb
language sql
volatile
security definer
set search_path=''
as $function$
  select private.hp1_1_activate_registration_application_impl(
    p_application_id,
    null
  );
$function$;

revoke all on function private.p0a_activate_registration_application_impl(uuid)
  from public, anon;
grant execute on function private.p0a_activate_registration_application_impl(uuid)
  to authenticated, service_role;

-- Platform UI uses this RPC when identity candidates exist and an operator has
-- explicitly selected the intended Network Company.
create or replace function public.p0a_activate_registration_application_with_network(
  p_application_id uuid,
  p_network_company_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.hp1_1_activate_registration_application_impl(
    p_application_id,
    p_network_company_id
  );
$function$;

revoke all on function public.p0a_activate_registration_application_with_network(uuid,uuid)
  from public, anon;
grant execute on function public.p0a_activate_registration_application_with_network(uuid,uuid)
  to authenticated, service_role;

comment on function public.p0a_activate_registration_application_with_network(uuid,uuid) is
  'HP1.1 atomic registration activation with explicit Network identity selection. Any bridge/claim failure rolls back tenant activation.';
