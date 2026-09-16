-- P1.1 — Admin-only tenant team directory.
-- Email addresses live in auth.users and are exposed only through this
-- authorization-checked RPC, never through a broadly readable mirror table.

create or replace function public.organization_team_members(p_organization_id uuid)
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

  if not public.is_organization_admin(p_organization_id) then
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

revoke execute on function public.organization_team_members(uuid) from public;
revoke execute on function public.organization_team_members(uuid) from anon;
grant execute on function public.organization_team_members(uuid) to authenticated;
grant execute on function public.organization_team_members(uuid) to service_role;
