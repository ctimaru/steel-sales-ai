-- SA3 — Superadmin People & Access acceptance.
begin;

create or replace function pg_temp.sa3_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'SA3 assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.sa3_assert_raises(statement text,expected_fragment text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm)=0 then
      raise exception 'SA3 expected error containing "%", got "%"',expected_fragment,sqlerrm;
    end if;
    return;
  end;
  raise exception 'SA3 statement unexpectedly succeeded: %',statement;
end;
$$;

insert into auth.users(id,email,email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000a301'::uuid,'sa3-registration-admin@example.com',now()),
  ('00000000-0000-0000-0000-00000000a302'::uuid,'sa3-auditor@example.com',now())
on conflict (id) do nothing;

do $root$
begin
  if not exists (
    select 1 from public.platform_user_roles
    where role='platform_superadmin' and status='active'
  ) then
    insert into auth.users(id,email,email_confirmed_at)
    values ('00000000-0000-0000-0000-00000000a300'::uuid,'sa3-owner@example.com',now())
    on conflict (id) do nothing;

    insert into public.platform_user_roles(user_id,role,status,granted_by,reason)
    values (
      '00000000-0000-0000-0000-00000000a300'::uuid,
      'platform_superadmin','active',null,'SA3 acceptance fallback owner'
    );
  end if;
end
$root$;

select user_id as owner_id
from public.platform_user_roles
where role='platform_superadmin' and status='active'
limit 1 \gset

set local role authenticated;
select set_config('request.jwt.claim.sub',:'owner_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.sa2_create_platform_staff_invitation(
  'sa3-registration-admin@example.com',
  array['registration_admin'],
  now()+interval '7 days',
  'SA3 People & Access acceptance'
) as invitation_id \gset

select pg_temp.sa3_assert(
  exists (
    select 1
    from public.sa2_platform_staff_invitation_queue()
    where invitation_id=:'invitation_id'::uuid
      and email='sa3-registration-admin@example.com'
      and status='pending'
      and roles=array['registration_admin']::text[]
  ),
  'Platform Owner must see the pending invitation and assigned role template'
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a301',true);

select public.sa2_claim_platform_staff_invitation() as claim_payload \gset

select pg_temp.sa3_assert(
  (:'claim_payload'::jsonb->>'claimed')::boolean=true,
  'matching verified staff email must claim the Platform invitation'
);

select pg_temp.sa3_assert(
  public.has_platform_permission('registrations.read')
  and public.has_platform_permission('registrations.approve')
  and not public.has_platform_permission('platform.staff.invite'),
  'activated Registration Admin must get only its fixed delegated capabilities'
);

reset role;

select pg_temp.sa3_assert(
  not exists (
    select 1
    from public.organization_memberships
    where user_id='00000000-0000-0000-0000-00000000a301'::uuid
  ),
  'Platform Staff activation must not create tenant membership'
);

set local role authenticated;
select set_config('request.jwt.claim.sub',:'owner_id',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.sa3_assert(
  exists (
    select 1
    from public.sa2_platform_staff_directory()
    where user_id='00000000-0000-0000-0000-00000000a301'::uuid
      and email='sa3-registration-admin@example.com'
      and status='active'
      and roles=array['registration_admin']::text[]
  ),
  'People & Access directory must show activated delegated staff'
);

select public.sa2_set_platform_staff_status(
  '00000000-0000-0000-0000-00000000a301'::uuid,
  'suspended',
  'SA3 suspension acceptance'
);

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a301',true);

select pg_temp.sa3_assert(
  not public.has_platform_permission('platform.console.access')
  and not public.has_platform_permission('registrations.read'),
  'People & Access suspension must remove effective capabilities immediately'
);

select pg_temp.sa3_assert_raises(
  $$select public.sa2_create_platform_staff_invitation(
      'should-not-work@example.com',
      array['platform_auditor'],
      now()+interval '7 days',
      'delegated self expansion'
    )$$,
  'Platform permission required'
);

select set_config('request.jwt.claim.sub',:'owner_id',true);

select public.sa2_set_platform_staff_status(
  '00000000-0000-0000-0000-00000000a301'::uuid,
  'active',
  'SA3 reactivation acceptance'
);

select public.sa2_create_platform_staff_invitation(
  'sa3-auditor@example.com',
  array['platform_auditor'],
  now()+interval '7 days',
  'SA3 revoke pending invitation'
) as revoked_invitation_id \gset

select public.sa2_revoke_platform_staff_invitation(
  :'revoked_invitation_id'::uuid,
  'SA3 acceptance revocation'
);

select pg_temp.sa3_assert(
  exists (
    select 1
    from public.sa2_platform_staff_invitation_queue()
    where invitation_id=:'revoked_invitation_id'::uuid
      and status='revoked'
  ),
  'revoked pending invitations must remain visible as lifecycle history'
);

reset role;

select pg_temp.sa3_assert(
  exists (
    select 1 from public.platform_access_events
    where action='staff_invitation_created'
      and permission_key='platform.staff.invite'
  )
  and exists (
    select 1 from public.platform_access_events
    where action='staff_status_changed'
      and permission_key='platform.staff.suspend'
  )
  and exists (
    select 1 from public.platform_access_events
    where action='staff_invitation_revoked'
      and permission_key='platform.staff.invite'
  ),
  'People & Access mutations must remain auditable'
);

rollback;
