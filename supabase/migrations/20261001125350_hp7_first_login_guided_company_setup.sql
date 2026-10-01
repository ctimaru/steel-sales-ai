-- HP7 — First Login & Guided Company Setup.
--
-- Replace rigid workspace gating with a guided, measurable first-login setup.
-- Workspace navigation stays available, while Commercial Memory imports remain
-- fail-closed until source preferences and processing acknowledgement exist.

alter table public.organizations
  add column if not exists first_workspace_seen_at timestamptz,
  add column if not exists guided_setup_completed_at timestamptz,
  add column if not exists first_value_at timestamptz;

update public.organizations
set guided_setup_completed_at = coalesce(guided_setup_completed_at, onboarding_completed_at, created_at)
where onboarding_status = 'completed'
  and guided_setup_completed_at is null;

create or replace function private.hp7_company_setup_state_impl(
  p_organization_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_org public.organizations%rowtype;
  v_role text;
  v_network_company_id uuid;
  v_network_company public.network_companies%rowtype;
  v_profile_ready boolean := false;
  v_data_ready boolean := false;
  v_team_ready boolean := false;
  v_first_value_at timestamptz;
  v_member_count integer := 0;
  v_guided_completed_at timestamptz;
  v_first_seen_at timestamptz;
  v_first_value_ready boolean := false;
begin
  if v_user_id is null then
    raise exception 'authentication required'
      using errcode = '42501';
  end if;

  select m.role
    into v_role
  from public.organization_memberships m
  where m.organization_id = p_organization_id
    and m.user_id = v_user_id
    and m.status = 'active'
  limit 1;

  if v_role is null then
    raise exception 'active organization membership required'
      using errcode = '42501';
  end if;

  select *
    into v_org
  from public.organizations o
  where o.id = p_organization_id
  for update;

  if not found then
    raise exception 'organization not found'
      using errcode = 'P0002';
  end if;

  v_first_seen_at := coalesce(v_org.first_workspace_seen_at, now());

  if v_org.first_workspace_seen_at is null then
    update public.organizations
    set first_workspace_seen_at = v_first_seen_at
    where id = p_organization_id;
  end if;

  select l.network_company_id
    into v_network_company_id
  from public.organization_network_company_links l
  where l.organization_id = p_organization_id
    and l.link_status = 'active'
  order by l.created_at asc, l.id asc
  limit 1;

  if v_network_company_id is not null then
    select *
      into v_network_company
    from public.network_companies nc
    where nc.id = v_network_company_id;

    if found then
      v_profile_ready :=
        nullif(btrim(coalesce(v_network_company.trading_name, '')), '') is not null
        or nullif(btrim(coalesce(v_network_company.website_url, '')), '') is not null
        or nullif(btrim(coalesce(v_network_company.description, '')), '') is not null
        or v_network_company.logo_path is not null;
    end if;
  end if;

  v_data_ready :=
    cardinality(coalesce(v_org.source_preferences, '{}'::text[])) > 0
    and v_org.consent_version is not null
    and v_org.consent_accepted_at is not null;

  select count(*)
    into v_member_count
  from public.organization_memberships m
  where m.organization_id = p_organization_id
    and m.status = 'active';

  v_team_ready := v_member_count > 1;

  select min(x.created_at)
    into v_first_value_at
  from (
    select d.created_at
    from public.documents d
    where d.organization_id = p_organization_id
    union all
    select m.created_at
    from public.messages m
    where m.organization_id = p_organization_id
    union all
    select r.created_at
    from public.rfqs r
    where r.organization_id = p_organization_id
    union all
    select o.created_at
    from public.offers o
    where o.organization_id = p_organization_id
    union all
    select ord.created_at
    from public.orders ord
    where ord.organization_id = p_organization_id
  ) x;

  if v_org.first_value_at is null and v_first_value_at is not null then
    update public.organizations
    set first_value_at = v_first_value_at
    where id = p_organization_id;

    v_org.first_value_at := v_first_value_at;
  end if;

  v_first_value_ready := coalesce(v_org.first_value_at, v_first_value_at) is not null;

  v_guided_completed_at := v_org.guided_setup_completed_at;

  if v_guided_completed_at is null and v_profile_ready and v_data_ready then
    v_guided_completed_at := now();

    update public.organizations
    set guided_setup_completed_at = v_guided_completed_at
    where id = p_organization_id;
  end if;

  return jsonb_build_object(
    'organization_id', v_org.id,
    'organization_name', v_org.name,
    'role', v_role,
    'onboarding_status', v_org.onboarding_status,
    'first_workspace_seen_at', v_first_seen_at,
    'guided_setup_completed_at', v_guided_completed_at,
    'first_value_at', coalesce(v_org.first_value_at, v_first_value_at),
    'profile_ready', v_profile_ready,
    'data_ready', v_data_ready,
    'team_ready', v_team_ready,
    'first_value_ready', v_first_value_ready,
    'commercial_memory_ready', v_data_ready,
    'network_company_id', v_network_company_id,
    'member_count', v_member_count,
    'source_preferences', v_org.source_preferences,
    'consent_accepted_at', v_org.consent_accepted_at,
    'essential_completed_count',
      (case when v_profile_ready then 1 else 0 end)
      + (case when v_data_ready then 1 else 0 end),
    'essential_total_count', 2,
    'essential_completion_percentage',
      (
        (
          (case when v_profile_ready then 1 else 0 end)
          + (case when v_data_ready then 1 else 0 end)
        ) * 50
      ),
    'setup_completed', v_guided_completed_at is not null,
    'time_to_setup_seconds',
      case
        when v_guided_completed_at is null then null
        else greatest(
          0,
          extract(epoch from (v_guided_completed_at - v_org.created_at))::bigint
        )
      end,
    'time_to_first_value_seconds',
      case
        when coalesce(v_org.first_value_at, v_first_value_at) is null then null
        else greatest(
          0,
          extract(
            epoch from (
              coalesce(v_org.first_value_at, v_first_value_at) - v_org.created_at
            )
          )::bigint
        )
      end,
    'time_from_first_workspace_to_value_seconds',
      case
        when coalesce(v_org.first_value_at, v_first_value_at) is null then null
        else greatest(
          0,
          extract(
            epoch from (
              coalesce(v_org.first_value_at, v_first_value_at) - v_first_seen_at
            )
          )::bigint
        )
      end
  );
end;
$function$;

revoke all on function private.hp7_company_setup_state_impl(uuid)
  from public, anon;
grant execute on function private.hp7_company_setup_state_impl(uuid)
  to authenticated, service_role;

create or replace function public.hp7_company_setup_state(
  p_organization_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $function$
  select private.hp7_company_setup_state_impl(p_organization_id);
$function$;

revoke all on function public.hp7_company_setup_state(uuid)
  from public, anon;
grant execute on function public.hp7_company_setup_state(uuid)
  to authenticated, service_role;

comment on column public.organizations.first_workspace_seen_at is
  'HP7 first authenticated workspace/setup surface observed for this organization.';

comment on column public.organizations.guided_setup_completed_at is
  'HP7 timestamp when essential guided setup became complete: useful Network profile + Commercial Memory authorization/sources.';

comment on column public.organizations.first_value_at is
  'HP7 first private commercial artifact timestamp used for time-to-first-value measurement.';

comment on function public.hp7_company_setup_state(uuid) is
  'HP7 active-member setup state. Idempotently records first workspace observation, guided setup completion and first commercial value.';
