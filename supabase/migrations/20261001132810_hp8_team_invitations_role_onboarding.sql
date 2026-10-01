-- HP8 — Team Invitations & Role Onboarding.
-- Govern invitation delivery, deterministic acceptance, expiry/revoke/resend,
-- permission + business-role assignment, and member access suspension.

alter table public.organization_invitations
  add column if not exists business_role text,
  add column if not exists delivery_status text not null default 'pending',
  add column if not exists delivery_mode text,
  add column if not exists send_count integer not null default 0,
  add column if not exists last_sent_at timestamptz,
  add column if not exists last_delivery_error text,
  add column if not exists revoked_by uuid references auth.users(id) on delete set null,
  add column if not exists expired_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.organization_invitations'::regclass
      and conname='organization_invitations_business_role_check'
  ) then
    alter table public.organization_invitations
      add constraint organization_invitations_business_role_check
      check (
        business_role is null
        or business_role in ('sales_director','salesperson','operations')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.organization_invitations'::regclass
      and conname='organization_invitations_delivery_status_check'
  ) then
    alter table public.organization_invitations
      add constraint organization_invitations_delivery_status_check
      check (delivery_status in ('pending','sent','failed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.organization_invitations'::regclass
      and conname='organization_invitations_delivery_mode_check'
  ) then
    alter table public.organization_invitations
      add constraint organization_invitations_delivery_mode_check
      check (delivery_mode is null or delivery_mode in ('invite','magic_link'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.organization_invitations'::regclass
      and conname='organization_invitations_send_count_check'
  ) then
    alter table public.organization_invitations
      add constraint organization_invitations_send_count_check
      check (send_count >= 0);
  end if;
end $$;

create index if not exists organization_invitations_revoked_by_idx
  on public.organization_invitations(revoked_by);

create index if not exists organization_invitations_org_status_updated_idx
  on public.organization_invitations(organization_id,status,updated_at desc);

create or replace function private.hp8_invitation_context_impl(p_invitation_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_email text;
  v_invitation public.organization_invitations%rowtype;
  v_org_name text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  select lower(trim(u.email)) into v_email
  from auth.users u
  where u.id=v_user_id;

  if v_email is null then
    raise exception 'authenticated email required' using errcode='42501';
  end if;

  select i.* into v_invitation
  from public.organization_invitations i
  where i.id=p_invitation_id and i.email=v_email
  for update;

  if not found then
    raise exception 'invitation not available' using errcode='42501';
  end if;

  if v_invitation.status='pending' and v_invitation.expires_at <= now() then
    update public.organization_invitations
    set status='expired',
        expired_at=coalesce(expired_at,now()),
        updated_at=now()
    where id=v_invitation.id
    returning * into v_invitation;
  end if;

  select o.name into v_org_name
  from public.organizations o
  where o.id=v_invitation.organization_id;

  return jsonb_build_object(
    'invitation_id',v_invitation.id,
    'organization_id',v_invitation.organization_id,
    'organization_name',v_org_name,
    'email',v_invitation.email,
    'role',v_invitation.role,
    'business_role',v_invitation.business_role,
    'status',v_invitation.status,
    'expires_at',v_invitation.expires_at,
    'accepted_at',v_invitation.accepted_at,
    'delivery_status',v_invitation.delivery_status
  );
end;
$function$;

revoke all on function private.hp8_invitation_context_impl(uuid) from public,anon;
grant execute on function private.hp8_invitation_context_impl(uuid)
  to authenticated,service_role;

create or replace function public.hp8_invitation_context(p_invitation_id uuid)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $function$
  select private.hp8_invitation_context_impl(p_invitation_id);
$function$;

revoke all on function public.hp8_invitation_context(uuid) from public,anon;
grant execute on function public.hp8_invitation_context(uuid)
  to authenticated,service_role;

create or replace function private.hp8_claim_organization_invitation_impl(
  p_invitation_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_email text;
  v_invitation public.organization_invitations%rowtype;
  v_make_default boolean;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  select lower(trim(u.email)) into v_email
  from auth.users u
  where u.id=v_user_id;

  if v_email is null then
    raise exception 'authenticated email required' using errcode='42501';
  end if;

  select i.* into v_invitation
  from public.organization_invitations i
  where i.id=p_invitation_id and i.email=v_email
  for update;

  if not found then
    raise exception 'invitation not available' using errcode='42501';
  end if;

  if v_invitation.status='accepted' then
    if v_invitation.auth_user_id=v_user_id then
      return jsonb_build_object(
        'claimed',false,
        'idempotent_replay',true,
        'status','accepted',
        'organization_id',v_invitation.organization_id,
        'role',v_invitation.role,
        'business_role',v_invitation.business_role
      );
    end if;
    raise exception 'invitation already accepted';
  end if;

  if v_invitation.status='revoked' then
    return jsonb_build_object(
      'claimed',false,
      'idempotent_replay',false,
      'status','revoked',
      'organization_id',v_invitation.organization_id
    );
  end if;

  if v_invitation.status='expired' or v_invitation.expires_at <= now() then
    if v_invitation.status='pending' then
      update public.organization_invitations
      set status='expired',
          expired_at=coalesce(expired_at,now()),
          updated_at=now()
      where id=v_invitation.id;
    end if;

    return jsonb_build_object(
      'claimed',false,
      'idempotent_replay',false,
      'status','expired',
      'organization_id',v_invitation.organization_id
    );
  end if;

  if v_invitation.status <> 'pending' then
    raise exception 'invitation is not claimable';
  end if;

  select not exists (
    select 1
    from public.organization_memberships m
    where m.user_id=v_user_id
      and m.status='active'
      and m.is_default
  ) into v_make_default;

  insert into public.organization_memberships(
    organization_id,user_id,role,business_role,status,is_default
  ) values (
    v_invitation.organization_id,
    v_user_id,
    v_invitation.role,
    v_invitation.business_role,
    'active',
    v_make_default
  )
  on conflict (organization_id,user_id) do update
  set
    role=case
      when public.organization_memberships.status='active'
        then public.organization_memberships.role
      else excluded.role
    end,
    business_role=case
      when public.organization_memberships.status='active'
        then public.organization_memberships.business_role
      else excluded.business_role
    end,
    status='active',
    is_default=public.organization_memberships.is_default or excluded.is_default,
    updated_at=now();

  update public.organization_invitations
  set status='accepted',
      auth_user_id=v_user_id,
      accepted_at=now(),
      updated_at=now()
  where id=v_invitation.id;

  return jsonb_build_object(
    'claimed',true,
    'idempotent_replay',false,
    'status','accepted',
    'organization_id',v_invitation.organization_id,
    'role',v_invitation.role,
    'business_role',v_invitation.business_role
  );
end;
$function$;

revoke all on function private.hp8_claim_organization_invitation_impl(uuid)
  from public,anon;
grant execute on function private.hp8_claim_organization_invitation_impl(uuid)
  to authenticated,service_role;

create or replace function public.hp8_claim_organization_invitation(
  p_invitation_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $function$
  select private.hp8_claim_organization_invitation_impl(p_invitation_id);
$function$;

revoke all on function public.hp8_claim_organization_invitation(uuid)
  from public,anon;
grant execute on function public.hp8_claim_organization_invitation(uuid)
  to authenticated,service_role;

create or replace function private.hp8_team_state_impl(p_organization_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_members jsonb;
  v_invitations jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  if not private.is_organization_admin(p_organization_id) then
    raise exception 'organization admin role required' using errcode='42501';
  end if;

  update public.organization_invitations
  set status='expired',
      expired_at=coalesce(expired_at,now()),
      updated_at=now()
  where organization_id=p_organization_id
    and status='pending'
    and expires_at <= now();

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id',m.user_id,
        'email',lower(u.email),
        'role',m.role,
        'business_role',m.business_role,
        'status',m.status,
        'is_default',m.is_default,
        'joined_at',m.created_at
      )
      order by
        case m.status when 'active' then 0 else 1 end,
        case m.role when 'admin' then 0 when 'member' then 1 else 2 end,
        lower(u.email)
    ),
    '[]'::jsonb
  ) into v_members
  from public.organization_memberships m
  join auth.users u on u.id=m.user_id
  where m.organization_id=p_organization_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',i.id,
        'email',i.email,
        'role',i.role,
        'business_role',i.business_role,
        'status',i.status,
        'delivery_status',i.delivery_status,
        'delivery_mode',i.delivery_mode,
        'send_count',i.send_count,
        'last_sent_at',i.last_sent_at,
        'expires_at',i.expires_at,
        'accepted_at',i.accepted_at,
        'revoked_at',i.revoked_at,
        'expired_at',i.expired_at,
        'updated_at',i.updated_at
      )
      order by i.updated_at desc,i.created_at desc
    ),
    '[]'::jsonb
  ) into v_invitations
  from public.organization_invitations i
  where i.organization_id=p_organization_id;

  return jsonb_build_object(
    'organization_id',p_organization_id,
    'members',v_members,
    'invitations',v_invitations
  );
end;
$function$;

revoke all on function private.hp8_team_state_impl(uuid) from public,anon;
grant execute on function private.hp8_team_state_impl(uuid)
  to authenticated,service_role;

create or replace function public.hp8_team_state(p_organization_id uuid)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $function$
  select private.hp8_team_state_impl(p_organization_id);
$function$;

revoke all on function public.hp8_team_state(uuid) from public,anon;
grant execute on function public.hp8_team_state(uuid)
  to authenticated,service_role;

create or replace function private.hp8_revoke_organization_invitation_impl(
  p_invitation_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_invitation public.organization_invitations%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  select i.* into v_invitation
  from public.organization_invitations i
  where i.id=p_invitation_id
  for update;

  if not found then
    raise exception 'invitation not found' using errcode='P0002';
  end if;

  if not private.is_organization_admin(v_invitation.organization_id) then
    raise exception 'organization admin role required' using errcode='42501';
  end if;

  if v_invitation.status='revoked' then
    return jsonb_build_object(
      'status','revoked',
      'idempotent_replay',true,
      'invitation_id',v_invitation.id
    );
  end if;

  if v_invitation.status <> 'pending' then
    raise exception 'only pending invitations can be revoked';
  end if;

  update public.organization_invitations
  set status='revoked',
      revoked_at=now(),
      revoked_by=v_user_id,
      updated_at=now()
  where id=v_invitation.id;

  return jsonb_build_object(
    'status','revoked',
    'idempotent_replay',false,
    'invitation_id',v_invitation.id
  );
end;
$function$;

revoke all on function private.hp8_revoke_organization_invitation_impl(uuid)
  from public,anon;
grant execute on function private.hp8_revoke_organization_invitation_impl(uuid)
  to authenticated,service_role;

create or replace function public.hp8_revoke_organization_invitation(
  p_invitation_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $function$
  select private.hp8_revoke_organization_invitation_impl(p_invitation_id);
$function$;

revoke all on function public.hp8_revoke_organization_invitation(uuid)
  from public,anon;
grant execute on function public.hp8_revoke_organization_invitation(uuid)
  to authenticated,service_role;

create or replace function private.hp8_set_organization_member_status_impl(
  p_organization_id uuid,
  p_user_id uuid,
  p_status text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := (select auth.uid());
  v_role text;
  v_current_status text;
begin
  if v_actor_id is null then
    raise exception 'authentication required' using errcode='42501';
  end if;

  if not private.is_organization_admin(p_organization_id) then
    raise exception 'organization admin role required' using errcode='42501';
  end if;

  if p_status not in ('active','suspended') then
    raise exception 'unsupported organization membership status';
  end if;

  select m.role,m.status into v_role,v_current_status
  from public.organization_memberships m
  where m.organization_id=p_organization_id
    and m.user_id=p_user_id
  for update;

  if not found then
    raise exception 'organization membership not found' using errcode='P0002';
  end if;

  if v_current_status=p_status then
    return jsonb_build_object(
      'status',p_status,
      'idempotent_replay',true,
      'user_id',p_user_id
    );
  end if;

  if p_status='suspended' then
    if p_user_id=v_actor_id then
      raise exception 'cannot suspend your own organization membership';
    end if;

    if v_role='admin' and (
      select count(*)
      from public.organization_memberships m
      where m.organization_id=p_organization_id
        and m.status='active'
        and m.role='admin'
    ) <= 1 then
      raise exception 'cannot suspend the last active organization admin';
    end if;
  end if;

  update public.organization_memberships
  set status=p_status,
      updated_at=now()
  where organization_id=p_organization_id
    and user_id=p_user_id;

  return jsonb_build_object(
    'status',p_status,
    'idempotent_replay',false,
    'user_id',p_user_id
  );
end;
$function$;

revoke all on function private.hp8_set_organization_member_status_impl(uuid,uuid,text)
  from public,anon;
grant execute on function private.hp8_set_organization_member_status_impl(uuid,uuid,text)
  to authenticated,service_role;

create or replace function public.hp8_set_organization_member_status(
  p_organization_id uuid,
  p_user_id uuid,
  p_status text
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $function$
  select private.hp8_set_organization_member_status_impl(
    p_organization_id,p_user_id,p_status
  );
$function$;

revoke all on function public.hp8_set_organization_member_status(uuid,uuid,text)
  from public,anon;
grant execute on function public.hp8_set_organization_member_status(uuid,uuid,text)
  to authenticated,service_role;

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
  claimed_count integer := 0;
  make_default boolean;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select lower(trim(u.email)) into current_email
  from auth.users u
  where u.id = current_user_id;

  if current_email is null then
    return 0;
  end if;

  update public.organization_invitations
  set status = 'expired',
      expired_at=coalesce(expired_at,now()),
      updated_at = now()
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
      select 1 from public.organization_memberships m
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

    claimed_count := claimed_count + 1;
  end loop;

  return claimed_count;
end;
$function$;

create or replace function private.hp8_auth_user_lookup_impl(p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_email text := lower(trim(p_email));
  v_user record;
begin
  if v_email is null or position('@' in v_email) <= 1 then
    raise exception 'valid email required';
  end if;

  select u.id,u.email_confirmed_at,u.invited_at into v_user
  from auth.users u
  where lower(trim(u.email))=v_email
  order by u.created_at asc
  limit 1;

  if not found then
    return jsonb_build_object(
      'exists',false,
      'user_id',null,
      'email_confirmed',false,
      'invited_at',null
    );
  end if;

  return jsonb_build_object(
    'exists',true,
    'user_id',v_user.id,
    'email_confirmed',v_user.email_confirmed_at is not null,
    'invited_at',v_user.invited_at
  );
end;
$function$;

revoke all on function private.hp8_auth_user_lookup_impl(text)
  from public,anon,authenticated;
grant execute on function private.hp8_auth_user_lookup_impl(text)
  to service_role;

create or replace function public.hp8_auth_user_lookup(p_email text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.hp8_auth_user_lookup_impl(p_email);
$function$;

revoke all on function public.hp8_auth_user_lookup(text)
  from public,anon,authenticated;
grant execute on function public.hp8_auth_user_lookup(text)
  to service_role;

comment on function public.hp8_claim_organization_invitation(uuid) is
  'HP8 deterministic single-invitation acceptance for the authenticated email identity.';

comment on function public.hp8_team_state(uuid) is
  'HP8 admin-only team and invitation lifecycle read model; expires stale pending invitations before returning state.';

comment on function public.hp8_auth_user_lookup(text) is
  'HP8 service-role-only Auth identity lookup used by the trusted invitation delivery worker.';
