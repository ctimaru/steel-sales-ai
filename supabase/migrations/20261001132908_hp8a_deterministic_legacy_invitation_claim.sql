-- HP8a — Keep the legacy no-id claim RPC safe.
-- It remains compatible with a single pending invite, but refuses ambiguous
-- same-email multi-organization acceptance and forces the HP8 explicit-id flow.

create or replace function private.claim_pending_organization_invitations_impl()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  current_email text;
  invitation record;
  pending_count integer := 0;
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
  set status = 'expired',
      expired_at = coalesce(expired_at, now()),
      updated_at = now()
  where email = current_email
    and status = 'pending'
    and expires_at <= now();

  select count(*)
  into pending_count
  from public.organization_invitations i
  where i.email = current_email
    and i.status = 'pending'
    and i.expires_at > now();

  if pending_count = 0 then
    return 0;
  end if;

  if pending_count > 1 then
    raise exception 'multiple pending invitations require explicit invitation id';
  end if;

  select i.*
  into invitation
  from public.organization_invitations i
  where i.email = current_email
    and i.status = 'pending'
    and i.expires_at > now()
  order by i.invited_at, i.id
  limit 1
  for update;

  select not exists (
    select 1
    from public.organization_memberships m
    where m.user_id = current_user_id
      and m.status = 'active'
      and m.is_default
  ) into make_default;

  insert into public.organization_memberships (
    organization_id, user_id, role, business_role, status, is_default
  ) values (
    invitation.organization_id,
    current_user_id,
    invitation.role,
    invitation.business_role,
    'active',
    make_default
  )
  on conflict (organization_id, user_id) do update
  set
    role = case
      when public.organization_memberships.status = 'active'
        then public.organization_memberships.role
      else excluded.role
    end,
    business_role = case
      when public.organization_memberships.status = 'active'
        then public.organization_memberships.business_role
      else excluded.business_role
    end,
    status = 'active',
    is_default = public.organization_memberships.is_default or excluded.is_default,
    updated_at = now();

  update public.organization_invitations
  set status = 'accepted',
      auth_user_id = current_user_id,
      accepted_at = now(),
      updated_at = now()
  where id = invitation.id;

  return 1;
end;
$function$;
