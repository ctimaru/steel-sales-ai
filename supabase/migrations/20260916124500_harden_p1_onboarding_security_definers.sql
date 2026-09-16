-- P1.1 security hardening — keep privileged implementations outside the exposed
-- public API schema while preserving the browser-facing RPC contract.
-- Public RPCs are SECURITY INVOKER wrappers. Private helpers remain SECURITY
-- DEFINER because they must bypass RLS after explicit auth.uid()/tenant checks.

grant usage on schema private to authenticated, service_role;

create or replace function private.is_organization_admin(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = target_organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = 'admin'
  );
$$;

revoke execute on function private.is_organization_admin(uuid) from public;
revoke execute on function private.is_organization_admin(uuid) from anon;
grant execute on function private.is_organization_admin(uuid) to authenticated, service_role;

create or replace function public.is_organization_admin(target_organization_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_organization_admin(target_organization_id);
$$;

revoke execute on function public.is_organization_admin(uuid) from public;
revoke execute on function public.is_organization_admin(uuid) from anon;
grant execute on function public.is_organization_admin(uuid) to authenticated, service_role;

-- RLS uses the non-exposed helper directly, avoiding recursion on the
-- organization_memberships table without exposing a SECURITY DEFINER RPC.
drop policy if exists organization_memberships_admin_select on public.organization_memberships;
create policy organization_memberships_admin_select
on public.organization_memberships
for select
to authenticated
using (private.is_organization_admin(organization_id));

drop policy if exists organization_invitations_admin_select on public.organization_invitations;
create policy organization_invitations_admin_select
on public.organization_invitations
for select
to authenticated
using (private.is_organization_admin(organization_id));

create or replace function private.create_organization_for_current_user_impl(
  p_name text,
  p_country_code text default null,
  p_industry text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  new_organization_id uuid := gen_random_uuid();
  normalized_name text := nullif(trim(p_name), '');
  normalized_country text := nullif(upper(trim(p_country_code)), '');
  normalized_industry text := nullif(trim(p_industry), '');
  slug_base text;
  generated_slug text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if normalized_name is null or char_length(normalized_name) < 2 then
    raise exception 'Organization name must contain at least 2 characters';
  end if;

  if normalized_country is not null and normalized_country !~ '^[A-Z]{2}$' then
    raise exception 'Country code must be ISO alpha-2';
  end if;

  if exists (
    select 1
    from public.organization_memberships m
    where m.user_id = current_user_id
      and m.status = 'active'
  ) then
    raise exception 'User already belongs to an active organization';
  end if;

  slug_base := lower(regexp_replace(normalized_name, '[^a-zA-Z0-9]+', '-', 'g'));
  slug_base := trim(both '-' from slug_base);
  if slug_base = '' then
    slug_base := 'workspace';
  end if;
  generated_slug := left(slug_base, 48) || '-' || left(replace(new_organization_id::text, '-', ''), 8);

  insert into public.organizations (
    id, name, slug, created_by, country_code, industry,
    onboarding_status, onboarding_updated_by
  ) values (
    new_organization_id,
    normalized_name,
    generated_slug,
    current_user_id,
    normalized_country,
    normalized_industry,
    'profile',
    current_user_id
  );

  insert into public.organization_memberships (
    organization_id, user_id, role, status, is_default
  ) values (
    new_organization_id, current_user_id, 'admin', 'active', true
  );

  return new_organization_id;
end;
$$;

revoke execute on function private.create_organization_for_current_user_impl(text, text, text) from public;
revoke execute on function private.create_organization_for_current_user_impl(text, text, text) from anon;
grant execute on function private.create_organization_for_current_user_impl(text, text, text) to authenticated, service_role;

create or replace function public.create_organization_for_current_user(
  p_name text,
  p_country_code text default null,
  p_industry text default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_organization_for_current_user_impl(p_name, p_country_code, p_industry);
$$;

revoke execute on function public.create_organization_for_current_user(text, text, text) from public;
revoke execute on function public.create_organization_for_current_user(text, text, text) from anon;
grant execute on function public.create_organization_for_current_user(text, text, text) to authenticated, service_role;

create or replace function private.update_organization_onboarding_impl(
  p_organization_id uuid,
  p_name text,
  p_country_code text,
  p_industry text,
  p_source_preferences text[],
  p_accept_consent boolean default false,
  p_complete boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_name text := nullif(trim(p_name), '');
  normalized_country text := nullif(upper(trim(p_country_code)), '');
  normalized_industry text := nullif(trim(p_industry), '');
  normalized_sources text[];
  effective_consent_version text;
  effective_consent_at timestamptz;
  resulting_status text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not private.is_organization_admin(p_organization_id) then
    raise exception 'Organization admin role required';
  end if;

  if normalized_name is null or char_length(normalized_name) < 2 then
    raise exception 'Organization name must contain at least 2 characters';
  end if;

  if normalized_country is not null and normalized_country !~ '^[A-Z]{2}$' then
    raise exception 'Country code must be ISO alpha-2';
  end if;

  select coalesce(array_agg(distinct lower(trim(source_name)) order by lower(trim(source_name))), '{}'::text[])
  into normalized_sources
  from unnest(coalesce(p_source_preferences, '{}'::text[])) as source_name
  where nullif(trim(source_name), '') is not null;

  if not normalized_sources <@ array['email', 'pdf', 'xlsx']::text[] then
    raise exception 'Unsupported data source preference';
  end if;

  select
    case when p_accept_consent then 'p1-v1' else o.consent_version end,
    case when p_accept_consent then coalesce(o.consent_accepted_at, now()) else o.consent_accepted_at end
  into effective_consent_version, effective_consent_at
  from public.organizations o
  where o.id = p_organization_id;

  if not found then
    raise exception 'Organization not found';
  end if;

  if p_complete then
    if cardinality(normalized_sources) = 0 then
      raise exception 'At least one data source preference is required';
    end if;
    if effective_consent_version is null or effective_consent_at is null then
      raise exception 'Data processing acknowledgement is required';
    end if;
    resulting_status := 'completed';
  elsif cardinality(normalized_sources) > 0 then
    resulting_status := 'sources';
  else
    resulting_status := 'profile';
  end if;

  update public.organizations
  set
    name = normalized_name,
    country_code = normalized_country,
    industry = normalized_industry,
    source_preferences = normalized_sources,
    consent_version = effective_consent_version,
    consent_accepted_at = effective_consent_at,
    onboarding_status = resulting_status,
    onboarding_completed_at = case
      when resulting_status = 'completed' then coalesce(onboarding_completed_at, now())
      else onboarding_completed_at
    end,
    onboarding_updated_by = current_user_id,
    updated_at = now()
  where id = p_organization_id;

  return jsonb_build_object(
    'organization_id', p_organization_id,
    'onboarding_status', resulting_status,
    'source_preferences', normalized_sources,
    'consent_version', effective_consent_version,
    'completed', resulting_status = 'completed'
  );
end;
$$;

revoke execute on function private.update_organization_onboarding_impl(uuid, text, text, text, text[], boolean, boolean) from public;
revoke execute on function private.update_organization_onboarding_impl(uuid, text, text, text, text[], boolean, boolean) from anon;
grant execute on function private.update_organization_onboarding_impl(uuid, text, text, text, text[], boolean, boolean) to authenticated, service_role;

create or replace function public.update_organization_onboarding(
  p_organization_id uuid,
  p_name text,
  p_country_code text,
  p_industry text,
  p_source_preferences text[],
  p_accept_consent boolean default false,
  p_complete boolean default false
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.update_organization_onboarding_impl(
    p_organization_id, p_name, p_country_code, p_industry,
    p_source_preferences, p_accept_consent, p_complete
  );
$$;

revoke execute on function public.update_organization_onboarding(uuid, text, text, text, text[], boolean, boolean) from public;
revoke execute on function public.update_organization_onboarding(uuid, text, text, text, text[], boolean, boolean) from anon;
grant execute on function public.update_organization_onboarding(uuid, text, text, text, text[], boolean, boolean) to authenticated, service_role;

create or replace function private.claim_pending_organization_invitations_impl()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_email text;
  invitation record;
  claimed_count integer := 0;
  make_default boolean;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select lower(trim(u.email))
  into current_email
  from auth.users u
  where u.id = current_user_id;

  if current_email is null then
    return 0;
  end if;

  update public.organization_invitations
  set status = 'expired', updated_at = now()
  where email = current_email
    and status = 'pending'
    and expires_at <= now();

  for invitation in
    select i.*
    from public.organization_invitations i
    where i.email = current_email
      and i.status = 'pending'
      and i.expires_at > now()
    order by i.invited_at, i.id
    for update
  loop
    select not exists (
      select 1
      from public.organization_memberships m
      where m.user_id = current_user_id
        and m.status = 'active'
        and m.is_default
    ) into make_default;

    insert into public.organization_memberships (
      organization_id, user_id, role, status, is_default
    ) values (
      invitation.organization_id,
      current_user_id,
      invitation.role,
      'active',
      make_default
    )
    on conflict (organization_id, user_id) do update
    set
      role = case
        when public.organization_memberships.status = 'active' then public.organization_memberships.role
        else excluded.role
      end,
      status = 'active',
      is_default = public.organization_memberships.is_default or excluded.is_default,
      updated_at = now();

    update public.organization_invitations
    set
      status = 'accepted',
      auth_user_id = current_user_id,
      accepted_at = now(),
      updated_at = now()
    where id = invitation.id;

    claimed_count := claimed_count + 1;
  end loop;

  return claimed_count;
end;
$$;

revoke execute on function private.claim_pending_organization_invitations_impl() from public;
revoke execute on function private.claim_pending_organization_invitations_impl() from anon;
grant execute on function private.claim_pending_organization_invitations_impl() to authenticated, service_role;

create or replace function public.claim_pending_organization_invitations()
returns integer
language sql
security invoker
set search_path = ''
as $$
  select private.claim_pending_organization_invitations_impl();
$$;

revoke execute on function public.claim_pending_organization_invitations() from public;
revoke execute on function public.claim_pending_organization_invitations() from anon;
grant execute on function public.claim_pending_organization_invitations() to authenticated, service_role;

create or replace function private.set_organization_member_role_impl(
  p_organization_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_current_role text;
  target_status text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if not private.is_organization_admin(p_organization_id) then
    raise exception 'Organization admin role required';
  end if;

  if p_role not in ('admin', 'member', 'viewer') then
    raise exception 'Unsupported organization role';
  end if;

  select m.role, m.status
  into target_current_role, target_status
  from public.organization_memberships m
  where m.organization_id = p_organization_id
    and m.user_id = p_user_id
  for update;

  if not found or target_status <> 'active' then
    raise exception 'Active organization membership not found';
  end if;

  if target_current_role = 'admin' and p_role <> 'admin' then
    if (
      select count(*)
      from public.organization_memberships m
      where m.organization_id = p_organization_id
        and m.status = 'active'
        and m.role = 'admin'
    ) <= 1 then
      raise exception 'Cannot demote the last active organization admin';
    end if;
  end if;

  update public.organization_memberships
  set role = p_role, updated_at = now()
  where organization_id = p_organization_id
    and user_id = p_user_id;
end;
$$;

revoke execute on function private.set_organization_member_role_impl(uuid, uuid, text) from public;
revoke execute on function private.set_organization_member_role_impl(uuid, uuid, text) from anon;
grant execute on function private.set_organization_member_role_impl(uuid, uuid, text) to authenticated, service_role;

create or replace function public.set_organization_member_role(
  p_organization_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.set_organization_member_role_impl(p_organization_id, p_user_id, p_role);
$$;

revoke execute on function public.set_organization_member_role(uuid, uuid, text) from public;
revoke execute on function public.set_organization_member_role(uuid, uuid, text) from anon;
grant execute on function public.set_organization_member_role(uuid, uuid, text) to authenticated, service_role;

create or replace function private.organization_team_members_impl(p_organization_id uuid)
returns table (
  user_id uuid,
  email text,
  role text,
  status text,
  is_default boolean,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if not private.is_organization_admin(p_organization_id) then
    raise exception 'Organization admin role required';
  end if;

  return query
  select
    m.user_id,
    lower(u.email) as email,
    m.role,
    m.status,
    m.is_default,
    m.created_at as joined_at
  from public.organization_memberships m
  join auth.users u on u.id = m.user_id
  where m.organization_id = p_organization_id
  order by
    case m.role when 'admin' then 0 when 'member' then 1 else 2 end,
    lower(u.email),
    m.created_at;
end;
$$;

revoke execute on function private.organization_team_members_impl(uuid) from public;
revoke execute on function private.organization_team_members_impl(uuid) from anon;
grant execute on function private.organization_team_members_impl(uuid) to authenticated, service_role;

create or replace function public.organization_team_members(p_organization_id uuid)
returns table (
  user_id uuid,
  email text,
  role text,
  status text,
  is_default boolean,
  joined_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.organization_team_members_impl(p_organization_id);
$$;

revoke execute on function public.organization_team_members(uuid) from public;
revoke execute on function public.organization_team_members(uuid) from anon;
grant execute on function public.organization_team_members(uuid) to authenticated, service_role;
