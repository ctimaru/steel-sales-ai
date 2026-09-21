-- PA2.2a — Membership business role foundation.
-- Permission role (admin/member/viewer) remains the authorization contract.
-- business_role is descriptive workflow metadata and must not grant access by itself.

alter table public.organization_memberships
  add column if not exists business_role text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.organization_memberships'::regclass
      and conname = 'organization_memberships_business_role_check'
  ) then
    alter table public.organization_memberships
      add constraint organization_memberships_business_role_check
      check (
        business_role is null
        or business_role in ('sales_director', 'salesperson', 'operations')
      );
  end if;
end $$;

comment on column public.organization_memberships.business_role is
  'Business/workflow role only. Authorization continues to use organization membership role.';

create or replace function private.set_organization_member_business_role_impl(
  p_organization_id uuid,
  p_user_id uuid,
  p_business_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_status text;
  normalized_business_role text := nullif(trim(lower(p_business_role)), '');
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if not private.is_organization_admin(p_organization_id) then
    raise exception 'Organization admin role required';
  end if;

  if normalized_business_role is not null
     and normalized_business_role not in ('sales_director', 'salesperson', 'operations') then
    raise exception 'Unsupported organization business role';
  end if;

  select m.status
  into target_status
  from public.organization_memberships m
  where m.organization_id = p_organization_id
    and m.user_id = p_user_id
  for update;

  if not found or target_status <> 'active' then
    raise exception 'Active organization membership not found';
  end if;

  update public.organization_memberships
  set
    business_role = normalized_business_role,
    updated_at = now()
  where organization_id = p_organization_id
    and user_id = p_user_id;
end;
$$;

revoke execute on function private.set_organization_member_business_role_impl(uuid, uuid, text) from public;
revoke execute on function private.set_organization_member_business_role_impl(uuid, uuid, text) from anon;
grant execute on function private.set_organization_member_business_role_impl(uuid, uuid, text)
  to authenticated, service_role;

create or replace function public.set_organization_member_business_role(
  p_organization_id uuid,
  p_user_id uuid,
  p_business_role text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.set_organization_member_business_role_impl(
    p_organization_id,
    p_user_id,
    p_business_role
  );
$$;

revoke execute on function public.set_organization_member_business_role(uuid, uuid, text) from public;
revoke execute on function public.set_organization_member_business_role(uuid, uuid, text) from anon;
grant execute on function public.set_organization_member_business_role(uuid, uuid, text)
  to authenticated, service_role;

-- The return type changes, so recreate the directory functions explicitly.
drop function if exists public.organization_team_members(uuid);
drop function if exists private.organization_team_members_impl(uuid);

create function private.organization_team_members_impl(p_organization_id uuid)
returns table (
  user_id uuid,
  email text,
  role text,
  business_role text,
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
    m.business_role,
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
grant execute on function private.organization_team_members_impl(uuid)
  to authenticated, service_role;

create function public.organization_team_members(p_organization_id uuid)
returns table (
  user_id uuid,
  email text,
  role text,
  business_role text,
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
grant execute on function public.organization_team_members(uuid)
  to authenticated, service_role;
