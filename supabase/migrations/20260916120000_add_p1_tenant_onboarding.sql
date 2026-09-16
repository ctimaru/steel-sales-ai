-- P1.1 — Tenant onboarding, invitations and user-role administration.
--
-- P0.2 already established organization-level tenant isolation. P1.1 adds the
-- self-service SaaS lifecycle on top of that foundation without moving
-- authorization into JWT user metadata.

alter table public.organizations
  add column if not exists industry text,
  add column if not exists country_code text,
  add column if not exists onboarding_status text not null default 'not_started',
  add column if not exists source_preferences text[] not null default '{}'::text[],
  add column if not exists consent_version text,
  add column if not exists consent_accepted_at timestamptz,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists onboarding_updated_by uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.organizations'::regclass
      and conname = 'organizations_country_code_check'
  ) then
    alter table public.organizations
      add constraint organizations_country_code_check
      check (country_code is null or country_code ~ '^[A-Z]{2}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.organizations'::regclass
      and conname = 'organizations_onboarding_status_check'
  ) then
    alter table public.organizations
      add constraint organizations_onboarding_status_check
      check (onboarding_status in ('not_started', 'profile', 'sources', 'team', 'completed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.organizations'::regclass
      and conname = 'organizations_source_preferences_check'
  ) then
    alter table public.organizations
      add constraint organizations_source_preferences_check
      check (source_preferences <@ array['email', 'pdf', 'xlsx']::text[]);
  end if;
end $$;

-- Existing internal production tenants pre-date the wizard. Keep them usable
-- without inventing a consent record that was never collected.
update public.organizations
set
  onboarding_status = 'completed',
  onboarding_completed_at = coalesce(onboarding_completed_at, now()),
  updated_at = now()
where onboarding_status <> 'completed';

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid references auth.users(id) on delete set null,
  auth_user_id uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_invitations_email_normalized_check
    check (email = lower(trim(email)) and position('@' in email) > 1),
  constraint organization_invitations_expiry_check
    check (expires_at > invited_at)
);

create unique index if not exists organization_invitations_pending_email_uq
  on public.organization_invitations (organization_id, email)
  where status = 'pending';

create index if not exists organization_invitations_email_status_idx
  on public.organization_invitations (email, status, expires_at);

create index if not exists organization_invitations_organization_status_idx
  on public.organization_invitations (organization_id, status, created_at desc);

create index if not exists organizations_onboarding_status_idx
  on public.organizations (onboarding_status, created_at);

alter table public.organization_invitations enable row level security;
revoke all on public.organization_invitations from public;
revoke all on public.organization_invitations from anon;
revoke insert, update, delete on public.organization_invitations from authenticated;
grant select on public.organization_invitations to authenticated;
grant select, insert, update, delete on public.organization_invitations to service_role;

create or replace function public.is_organization_admin(target_organization_id uuid)
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

revoke execute on function public.is_organization_admin(uuid) from public;
revoke execute on function public.is_organization_admin(uuid) from anon;
grant execute on function public.is_organization_admin(uuid) to authenticated;
grant execute on function public.is_organization_admin(uuid) to service_role;

-- P0 only allowed users to inspect their own membership row. P1 admins need a
-- tenant-scoped team view. The SECURITY DEFINER boolean helper avoids recursive
-- RLS evaluation on organization_memberships while returning no membership data.
drop policy if exists organization_memberships_admin_select on public.organization_memberships;
create policy organization_memberships_admin_select
on public.organization_memberships
for select
to authenticated
using (public.is_organization_admin(organization_id));

drop policy if exists organization_invitations_admin_select on public.organization_invitations;
create policy organization_invitations_admin_select
on public.organization_invitations
for select
to authenticated
using (public.is_organization_admin(organization_id));

create or replace function public.create_organization_for_current_user(
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

revoke execute on function public.create_organization_for_current_user(text, text, text) from public;
revoke execute on function public.create_organization_for_current_user(text, text, text) from anon;
grant execute on function public.create_organization_for_current_user(text, text, text) to authenticated;
grant execute on function public.create_organization_for_current_user(text, text, text) to service_role;

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

  if not public.is_organization_admin(p_organization_id) then
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

revoke execute on function public.update_organization_onboarding(uuid, text, text, text, text[], boolean, boolean) from public;
revoke execute on function public.update_organization_onboarding(uuid, text, text, text, text[], boolean, boolean) from anon;
grant execute on function public.update_organization_onboarding(uuid, text, text, text, text[], boolean, boolean) to authenticated;
grant execute on function public.update_organization_onboarding(uuid, text, text, text, text[], boolean, boolean) to service_role;

create or replace function public.claim_pending_organization_invitations()
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

revoke execute on function public.claim_pending_organization_invitations() from public;
revoke execute on function public.claim_pending_organization_invitations() from anon;
grant execute on function public.claim_pending_organization_invitations() to authenticated;
grant execute on function public.claim_pending_organization_invitations() to service_role;

create or replace function public.set_organization_member_role(
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

  if not public.is_organization_admin(p_organization_id) then
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

revoke execute on function public.set_organization_member_role(uuid, uuid, text) from public;
revoke execute on function public.set_organization_member_role(uuid, uuid, text) from anon;
grant execute on function public.set_organization_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.set_organization_member_role(uuid, uuid, text) to service_role;
