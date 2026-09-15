-- P0.2 hardening: organization_id and owner_id are identity/provenance columns,
-- not ordinary mutable business fields.

revoke all on public.organizations from public, anon, authenticated;
revoke all on public.organization_memberships from public, anon, authenticated;
grant select on public.organizations to authenticated;
grant select on public.organization_memberships to authenticated;

create or replace function public.assign_organization_from_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  resolved_organization_id uuid;
  caller_role text := coalesce((select auth.role()), '');
begin
  if tg_op = 'UPDATE'
     and caller_role <> 'service_role'
     and (
       new.owner_id is distinct from old.owner_id
       or new.organization_id is distinct from old.organization_id
     ) then
    raise exception 'owner_id and organization_id cannot be changed by client roles';
  end if;

  if new.owner_id is null then
    return new;
  end if;

  resolved_organization_id := public.default_organization_for_user(new.owner_id);
  if resolved_organization_id is null then
    raise exception 'No active organization membership for owner %', new.owner_id;
  end if;

  if new.organization_id is null then
    new.organization_id := resolved_organization_id;
  elsif not exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = new.organization_id
      and m.user_id = new.owner_id
      and m.status = 'active'
  ) then
    raise exception 'Owner % is not an active member of organization %', new.owner_id, new.organization_id;
  end if;

  return new;
end;
$$;

revoke execute on function public.assign_organization_from_owner() from public, anon, authenticated;
grant execute on function public.assign_organization_from_owner() to service_role;
